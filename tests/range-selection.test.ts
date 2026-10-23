// Selección por rango de la línea de tiempo (Mayús+clic en dos eventos): el tramo que los une, pero **solo con los
// eventos de la pista pulsada** (los de otras pistas entran después si van agrupados, y eso lo resuelve el editor).
// Funciones puras, sin navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import { idsInSpan, idsInSpanOnTrack, rangeIds, spanBetween } from '../lib/editor/range-selection';

const V1 = 'pista-video-1';
const V2 = 'pista-video-2';
const A1 = 'pista-audio-1';
const eventos = [
  { id: 'a', start: 0, duration: 100, trackId: V1 },
  { id: 'b', start: 200, duration: 100, trackId: V1 },
  { id: 'c', start: 400, duration: 100, trackId: V1 },
  { id: 'd', start: 1000, duration: 100, trackId: V1 },
  { id: 'e', start: 50, duration: 400, trackId: V1 }, // uno largo que cruza todo el principio
  { id: 'x', start: 250, duration: 100, trackId: V2 }, // otra pista de vídeo, dentro del tramo
  { id: 'y', start: 300, duration: 100, trackId: A1 }, // pista de audio, dentro del tramo
];

test('el tramo entre dos eventos va del principio del primero al final del último', () => {
  assert.deepEqual(spanBetween(eventos[0], eventos[2]), { start: 0, end: 500 });
  assert.deepEqual(spanBetween(eventos[2], eventos[0]), { start: 0, end: 500 });
});

test('entran los eventos que tocan el tramo, no solo los que caben dentro', () => {
  const tramo = spanBetween(eventos[0], eventos[2]);
  assert.deepEqual(idsInSpan(eventos, tramo), ['a', 'b', 'c', 'e', 'x', 'y']);
  // El que empieza justo en el final no entra: el tramo es [inicio, fin).
  assert.deepEqual(idsInSpan(eventos, { start: 500, end: 600 }), []);
  // «b» acaba justo en 300 y «c» empieza en 400: cruzan la franja el largo («e»), la otra pista de vídeo («x»,
  // 250-350) y el audio («y»).
  assert.deepEqual(idsInSpan(eventos, { start: 300, end: 350 }), ['e', 'x', 'y']);
});

test('Mayús+clic se queda en la pista del evento pulsado', () => {
  const tramo = spanBetween(eventos[0], eventos[2]);
  assert.deepEqual(idsInSpanOnTrack(eventos, tramo, V1), ['a', 'b', 'c', 'e']);
  assert.deepEqual(idsInSpanOnTrack(eventos, tramo, V2), ['x']);
  assert.deepEqual(idsInSpanOnTrack(eventos, tramo, A1), ['y']);
  // El rango completo: solo la pista V1, aunque haya eventos de otras pistas dentro del tramo.
  assert.deepEqual(rangeIds(eventos, 'a', 'c'), ['a', 'b', 'c', 'e']);
  assert.deepEqual(rangeIds(eventos, 'c', 'a'), ['a', 'b', 'c', 'e']);
  // Y lo de otras pistas no se cuela en ninguna combinación.
  for (const par of [['a', 'c'], ['b', 'd'], ['c', 'b']] as const) {
    const ids = rangeIds(eventos, par[0], par[1]);
    assert.ok(!ids.includes('x'), `${par.join('→')} no arrastra la otra pista`);
    assert.ok(!ids.includes('y'), `${par.join('→')} no arrastra el audio suelto`);
  }
});

test('si el ancla está en otra pista, el tramo se respeta y se queda en la pista pulsada', () => {
  // Ancla en la pista de audio («y», 300-400) y Mayús+clic en «c» (400-500, pista V1): el tramo es 300 … 500 y de V1
  // entran «c» y el largo «e» que lo cruza; «x» (otra pista) y «y» (audio) se quedan fuera.
  assert.deepEqual(rangeIds(eventos, 'y', 'c'), ['c', 'e']);
  assert.deepEqual(rangeIds(eventos, 'c', 'y'), ['y']);
});

test('si un evento desapareció, no se selecciona nada raro', () => {
  assert.deepEqual(rangeIds(eventos, 'a', 'z'), []);
  assert.deepEqual(rangeIds(eventos, 'z', 'a'), []);
  assert.deepEqual(rangeIds([], 'a', 'b'), []);
});
