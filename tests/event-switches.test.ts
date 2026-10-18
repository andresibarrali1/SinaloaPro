// Interruptores del evento («Modificadores» del diálogo Propiedades de VEGAS 15) y las órdenes del menú del
// clic derecho que los usan: instante de origen, silencio, bloqueo, canales, sincronización e inversión.
import assert from 'node:assert/strict';
import test from 'node:test';
import { Event, easeValue, newEvent, newProject, pose, silencedIds, sourceTime, syncEvents, ticks, toggleReverse, lockedIds, seconds } from '../lib/editor/project';
import { MediaLibrary } from '../lib/editor/media';
import { mix } from '../lib/editor/audio';
import { validateProject } from '../lib/editor/validation';

const FPS = { num: 30, den: 1 };

function audioEvent(p: ReturnType<typeof newProject>, samples: number[], sampleRate = 48000) {
  const lib = new MediaLibrary();
  lib.items.set('a', { file: {} as File, firstVideo: 0, pcm: { channels: [Float32Array.from(samples)], sampleRate } });
  const e = newEvent(p.tracks[2].id, 'audio', 0, ticks(1));
  e.mediaId = 'a';
  return { lib, e };
}

test('sourceTime: sin interruptores devuelve el offset más el avance por la velocidad', () => {
  const e = newEvent('t', 'video', 0, ticks(10));
  e.offset = ticks(2);
  e.speed = 2;
  assert.equal(sourceTime(e, 0, 10, FPS), 2);
  assert.equal(sourceTime(e, ticks(1), 10, FPS), 4);
  assert.equal(sourceTime(e, ticks(3), 10, FPS), 8);
});

test('sourceTime: «Invertir» recorre el material al revés dentro del evento', () => {
  const e = newEvent('t', 'video', 0, ticks(4));
  e.offset = ticks(1);
  e.reversed = true;
  // El recorrido útil es 4 s: en el instante 0 se pide el final del recorrido (1+4) y en el 4, el principio (1).
  assert.equal(sourceTime(e, 0, 10, FPS), 5);
  assert.equal(sourceTime(e, ticks(4), 10, FPS), 1);
});

test('sourceTime: «Bucle» repite el material cuando el evento dura más que el archivo', () => {
  const e = newEvent('t', 'video', 0, ticks(5));
  e.loop = true;
  // Con un archivo de 2 s, a los 3 s de evento se vuelve al segundo 1 del material.
  assert.equal(sourceTime(e, ticks(3), 2, FPS), 1);
  assert.equal(sourceTime(e, ticks(5), 2, FPS), 1);
  // Sin bucle se pide el segundo 5, que se queda fuera del archivo (el motor no lo inventa).
  e.loop = false;
  assert.equal(sourceTime(e, ticks(5), 2, FPS), 5);
});

test('sourceTime: «Ajustarse a la velocidad de fotogramas del proyecto» y «Deshabilitar re-muestreo» piden el fotograma exacto', () => {
  const e = newEvent('t', 'video', 0, ticks(1));
  e.offset = ticks(0.51);
  const free = sourceTime(e, 0, 10, FPS);
  assert.equal(free, 0.51);
  e.conform = true;
  const snapped = sourceTime(e, 0, 10, FPS);
  assert.equal(snapped, 15 / 30);            // 0,51 s cae en el fotograma 15 de 30 fps
  e.conform = false;
  e.resample = 'off';
  assert.equal(sourceTime(e, 0, 10, FPS), snapped);
});

test('sourceTime: la velocidad de inframuestreo cuadricula el instante de origen', () => {
  const e = newEvent('t', 'video', 0, ticks(1));
  e.offset = ticks(0.51);
  e.undersample = 4;
  assert.equal(sourceTime(e, 0, 10, FPS), 0.5);
  e.undersample = 0;
  assert.equal(sourceTime(e, 0, 10, FPS), 0.51);
});

test('silenciar calla el evento y también su audio enlazado del mismo grupo', () => {
  const p = newProject();
  const video = newEvent(p.tracks[1].id, 'video', 0, ticks(1));
  const audio = { ...newEvent(p.tracks[2].id, 'audio', 0, ticks(1)), group: 'g1' };
  video.group = 'g1';
  video.muted = true;
  p.events.push(video, audio);
  const silenced = silencedIds(p);
  assert.ok(silenced.has(video.id), 'el evento de vídeo queda silenciado');
  assert.ok(silenced.has(audio.id), 'el audio enlazado queda silenciado con él');
});

test('el mezclador respeta «Silencio» del evento y del grupo', () => {
  const p = newProject();
  const { lib, e } = audioEvent(p, new Array(48000).fill(.5));
  p.events.push(e);
  assert.ok(mix(p, lib, 0, 8)[0][0] > 0);
  e.muted = true;
  assert.equal(mix(p, lib, 0, 8)[0][0], 0);
  // El mismo silencio puesto en el vídeo enlazado calla la pista de audio.
  e.muted = false;
  const partner = { ...newEvent(p.tracks[1].id, 'video', 0, ticks(1)), group: 'g1', muted: true };
  e.group = 'g1';
  p.events.push(partner);
  assert.equal(mix(p, lib, 0, 8)[0][0], 0);
});

test('«Canales» del evento reparte el material entre izquierda y derecha', () => {
  const p = newProject();
  const lib = new MediaLibrary();
  const left = new Float32Array(48000).fill(.4), right = new Float32Array(48000).fill(.1);
  lib.items.set('a', { file: {} as File, firstVideo: 0, pcm: { channels: [left, right], sampleRate: 48000 } });
  const e = newEvent(p.tracks[2].id, 'audio', 0, ticks(1));
  e.mediaId = 'a'; p.events.push(e);
  const both = mix(p, lib, 0, 4);
  assert.ok(Math.abs(both[0][0] - .4) < 1e-6 && Math.abs(both[1][0] - .1) < 1e-6, 'Ambos deja cada canal en su sitio');
  e.channel = 'left';
  const onlyLeft = mix(p, lib, 0, 4);
  assert.ok(Math.abs(onlyLeft[0][0] - .4) < 1e-6 && Math.abs(onlyLeft[1][0] - .4) < 1e-6, 'Sólo izquierdo suena por los dos');
  e.channel = 'swap';
  const swapped = mix(p, lib, 0, 4);
  assert.ok(Math.abs(swapped[0][0] - .1) < 1e-6 && Math.abs(swapped[1][0] - .4) < 1e-6, 'Intercambiar cruza los canales');
  e.channel = 'combine';
  const combined = mix(p, lib, 0, 4);
  assert.ok(Math.abs(combined[0][0] - .25) < 1e-6, 'Combinar mezcla los dos canales a la mitad');
});

test('«Invertir fase» cambia el signo de las muestras', () => {
  const p = newProject();
  const { lib, e } = audioEvent(p, new Array(48000).fill(.5));
  p.events.push(e);
  const normal = mix(p, lib, 0, 4)[0][0];
  e.invertPhase = true;
  assert.equal(mix(p, lib, 0, 4)[0][0], -normal);
});

test('bloquear marca el evento y la validación conserva los interruptores al guardar', () => {
  const p = newProject();
  const e = newEvent(p.tracks[1].id, 'color', 0, ticks(2));
  e.locked = true; e.loop = true; e.reduceFlicker = true; e.resample = 'force'; e.undersample = 24; e.channel = 'left'; e.maintainAspect = false;
  p.events.push(e);
  assert.ok(lockedIds(p).has(e.id));
  const round = validateProject(JSON.parse(JSON.stringify(p)));
  const saved = round.events[0] as Event;
  assert.equal(saved.locked, true);
  assert.equal(saved.loop, true);
  assert.equal(saved.reduceFlicker, true);
  assert.equal(saved.resample, 'force');
  assert.equal(saved.undersample, 24);
  assert.equal(saved.channel, 'left');
  assert.equal(saved.maintainAspect, false, 'y «Mantener relación de aspecto» quitado');
});

test('la validación rechaza un modo de re-muestreo y un canal que no existen', () => {
  const p = newProject();
  p.events.push({ ...newEvent(p.tracks[1].id, 'color', 0, ticks(1)), resample: 'quizá' } as unknown as Event);
  assert.throws(() => validateProject(JSON.parse(JSON.stringify(p))), /Proyecto inválido/);
  const q = newProject();
  q.events.push({ ...newEvent(q.tracks[2].id, 'audio', 0, ticks(1)), mediaId: undefined, channel: 'centro' } as unknown as Event);
  assert.throws(() => validateProject(JSON.parse(JSON.stringify(q))), /Proyecto inválido/);
});

test('«Sincronizar» empareja por desplazamiento o por deslizamiento', () => {
  const p = newProject();
  const anchor = newEvent(p.tracks[1].id, 'video', 0, ticks(2));
  anchor.mediaId = 'm'; anchor.offset = ticks(1);
  const other = newEvent(p.tracks[1].id, 'video', ticks(5), ticks(2));
  other.mediaId = 'm'; other.offset = ticks(3);
  p.events.push(anchor, other);

  // Por desplazamiento: el otro se mueve para mostrar el mismo instante de origen que el ancla.
  const moved = syncEvents(p, [anchor.id, other.id], anchor.id, 'move');
  assert.deepEqual(moved, [other.id]);
  assert.equal(seconds(other.start), 2);            // 0 + (3-1)/1
  assert.equal(other.offset, ticks(3));             // el material no se toca

  // Por deslizamiento: el otro se queda donde está y se desliza su material.
  other.start = ticks(5); other.offset = ticks(3);
  const slipped = syncEvents(p, [anchor.id, other.id], anchor.id, 'slip');
  assert.deepEqual(slipped, [other.id]);
  assert.equal(other.start, ticks(5));
  assert.equal(seconds(other.offset), 6);           // 1 + (5-0)*1
});

test('«Invertir» alterna la reproducción hacia atrás de los eventos enlazados', () => {
  const p = newProject();
  const e = newEvent(p.tracks[1].id, 'video', 0, ticks(1));
  p.events.push(e);
  assert.equal(toggleReverse(p, [e.id]), 1);
  assert.equal(e.reversed, true);
  toggleReverse(p, [e.id]);
  assert.equal(e.reversed, false);
});

// «Suavidad (%)» del grupo «Interpolación de fotogramas clave»: 0 % deja la curva lineal, 100 % la curva en S
// completa y los valores intermedios mezclan las dos. Solo afecta a las claves con curva «Suave».
test('la suavidad de la interpolación mezcla la curva en S con la línea recta', () => {
  assert.equal(easeValue('smooth', .25, 0), .25);
  assert.equal(easeValue('smooth', .25, 1), .15625);
  const middle = easeValue('smooth', .25, .5);
  assert.ok(middle > .15625 && middle < .25, `queda entre la curva y la recta (${middle})`);
  // Las demás curvas no la miran.
  assert.equal(easeValue('linear', .3, .5), .3);
  assert.equal(easeValue('hold', .9, .5), 0);
  // Y en el modelo, el evento sin campo se comporta como el 100 %: el comportamiento de siempre.
  const p = newProject();
  const e = newEvent(p.tracks[1].id, 'color', 0, ticks(2));
  e.keys = [{ ...e.transform, time: 0, curve: 'smooth' as const }, { ...e.transform, x: 1, time: ticks(2), curve: 'smooth' as const }];
  const full = pose(e, ticks(.5)).x;
  e.keySmoothness = 0;
  const none = pose(e, ticks(.5)).x;
  assert.ok(none > full, `con 0 % la curva va más adelantada (${none} frente a ${full})`);
});

test('la validación guarda los preestablecidos de Panoramización y recorte dentro del proyecto', () => {
  const p = newProject();
  const e = newEvent(p.tracks[1].id, 'color', 0, ticks(2));
  p.events.push(e);
  p.panCropPresets = [{ name: 'Mi encuadre', pose: { ...e.transform, scale: 2, x: .1 }, mask: { left: .1, right: 0, top: 0, bottom: 0 } }];
  const round = validateProject(JSON.parse(JSON.stringify(p)));
  assert.equal(round.panCropPresets?.length, 1);
  assert.equal(round.panCropPresets?.[0].name, 'Mi encuadre');
  assert.equal(round.panCropPresets?.[0].pose.scale, 2);
  assert.equal(round.panCropPresets?.[0].mask?.left, .1);
  // Un preestablecido sin nombre no pasa la validación.
  const bad = newProject();
  (bad as { panCropPresets?: unknown }).panCropPresets = [{ name: '', pose: bad.tracks[0].transform }];
  assert.throws(() => validateProject(JSON.parse(JSON.stringify(bad))), /Proyecto inválido/);
});
