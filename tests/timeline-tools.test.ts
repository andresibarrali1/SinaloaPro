// Herramientas de edición de la barra (Vegas Pro 15): nombres del manual, geometría del rectángulo de selección y
// zoom para encuadrar un tramo. Son funciones puras, así que se prueban sin navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TIMELINE_TOOLS, TOOL_LABEL, TOOL_NOTE, boxSize, idsInBox, normalizeBox, zoomForRange } from '../lib/editor/timeline-tools';

test('las cuatro herramientas del manual están, con nombre y nota', () => {
  assert.deepEqual([...TIMELINE_TOOLS], ['normal', 'envelope', 'selection', 'zoom']);
  for (const herramienta of TIMELINE_TOOLS) {
    assert.ok(TOOL_LABEL[herramienta].length > 8, `la herramienta ${herramienta} tiene nombre del manual`);
    assert.ok(TOOL_NOTE[herramienta].length > 20, `la herramienta ${herramienta} explica lo que hace`);
  }
  assert.equal(TOOL_LABEL.normal, 'Herramienta de edición normal');
  assert.equal(TOOL_LABEL.selection, 'Herramienta de edición de selección');
});

test('el rectángulo de selección se normaliza venga de donde venga el arrastre', () => {
  const deArribaIzquierda = normalizeBox({ x: 10, y: 20 }, { x: 120, y: 90 });
  const deAbajoDerecha = normalizeBox({ x: 120, y: 90 }, { x: 10, y: 20 });
  assert.deepEqual(deArribaIzquierda, { left: 10, top: 20, right: 120, bottom: 90 });
  assert.deepEqual(deAbajoDerecha, deArribaIzquierda);
  assert.deepEqual(boxSize(deArribaIzquierda), { width: 110, height: 70 });
});

test('el rectángulo selecciona los eventos que toca, no solo los que rodea', () => {
  const eventos = [
    { id: 'a', left: 0, top: 0, width: 100, height: 50 },
    { id: 'b', left: 200, top: 0, width: 100, height: 50 },
    { id: 'c', left: 0, top: 60, width: 100, height: 50 },
  ];
  // Un rectángulo sobre el borde derecho de «a» y la mitad izquierda de «b»: entran los dos.
  const box = normalizeBox({ x: 90, y: 10 }, { x: 260, y: 40 });
  assert.deepEqual(idsInBox(eventos, box), ['a', 'b']);
  // Una franja vertical por la derecha de la pista de arriba: solo «b».
  assert.deepEqual(idsInBox(eventos, normalizeBox({ x: 210, y: 5 }, { x: 215, y: 45 })), ['b']);
  // Un rectángulo que cae entre dos eventos: ninguno.
  assert.deepEqual(idsInBox(eventos, normalizeBox({ x: 120, y: 10 }, { x: 180, y: 40 })), []);
  // Lo de la pista de abajo no entra si el rectángulo se queda arriba.
  assert.deepEqual(idsInBox(eventos, normalizeBox({ x: 0, y: 0 }, { x: 100, y: 55 })), ['a']);
});

test('el zoom para encuadrar un tramo sale del ancho visible y respeta los límites', () => {
  // 10 s en 1000 px son 100 px por segundo.
  assert.equal(zoomForRange(0, 10, 1000), 100);
  // Un tramo de un segundo en el mismo hueco: 1000 px/s.
  assert.equal(zoomForRange(4, 5, 1000), 400);
  // Un tramo enorme no baja del mínimo del zoom de la línea de tiempo.
  assert.equal(zoomForRange(0, 100000, 1000), 1);
  // Un tramo de ancho cero no rompe: se usa el mínimo de tiempo.
  assert.equal(zoomForRange(7, 7, 1000), 400);
});
