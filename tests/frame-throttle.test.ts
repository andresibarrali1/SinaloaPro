// El aglutinador de gestos tiene que dejar pasar **un** valor por fotograma y no perder el último al soltar:
// de eso depende que arrastrar la aguja o marcar un tramo no encole repintados ni termine en un sitio distinto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frameThrottle } from '../lib/editor/frame-throttle';

// `requestAnimationFrame` no existe en Node: se simula con una cola que se vacía a mano.
function fakeAnimationFrame() {
  const queue = new Map<number, (time: number) => void>();
  let next = 1;
  const previous = {
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };
  globalThis.requestAnimationFrame = ((callback: (time: number) => void) => {
    const id = next++;
    queue.set(id, callback);
    return id;
  }) as typeof globalThis.requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) => {
    queue.delete(id);
  }) as typeof globalThis.cancelAnimationFrame;
  return {
    frame() {
      const pending = [...queue.entries()];
      queue.clear();
      for (const [, callback] of pending) callback(performance.now());
    },
    get size() {
      return queue.size;
    },
    restore() {
      globalThis.requestAnimationFrame = previous.requestAnimationFrame;
      globalThis.cancelAnimationFrame = previous.cancelAnimationFrame;
    },
  };
}

test('aguantar mil movimientos: se aplica el último, una vez por fotograma', () => {
  const frames = fakeAnimationFrame();
  try {
    const applied: number[] = [];
    const throttle = frameThrottle<number>((value) => applied.push(value));
    for (let step = 1; step <= 1000; step++) throttle.push(step);
    assert.deepEqual(applied, [], 'nada se aplica hasta que llega el fotograma');
    assert.equal(frames.size, 1, 'sólo hay un fotograma pedido, no mil');
    frames.frame();
    assert.deepEqual(applied, [1000], 'gana el último valor recibido');
  } finally {
    frames.restore();
  }
});

test('al soltar, el último valor se aplica ya (no se pierde si el fotograma no llegó)', () => {
  const frames = fakeAnimationFrame();
  try {
    const applied: number[] = [];
    const throttle = frameThrottle<number>((value) => applied.push(value));
    throttle.push(10);
    throttle.push(20);
    assert.deepEqual(applied, []);
    assert.equal(throttle.flush(), 20, 'flush devuelve el valor pendiente');
    assert.deepEqual(applied, [20], 'y lo aplica en el acto');
    assert.equal(frames.size, 0, 'el fotograma pedido se cancela para no repetir');
    frames.frame();
    assert.deepEqual(applied, [20], 'y no se aplica dos veces');
  } finally {
    frames.restore();
  }
});

test('sin nada pendiente, soltar no aplica nada; cancelar descarta sin aplicar', () => {
  const frames = fakeAnimationFrame();
  try {
    const applied: number[] = [];
    const throttle = frameThrottle<number>((value) => applied.push(value));
    assert.equal(throttle.flush(), undefined);
    throttle.push(7);
    throttle.cancel();
    frames.frame();
    assert.deepEqual(applied, [], 'lo cancelado no se aplica nunca');
    throttle.push(8);
    frames.frame();
    assert.deepEqual(applied, [8], 'después de cancelar se puede volver a usar');
  } finally {
    frames.restore();
  }
});
