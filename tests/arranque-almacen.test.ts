// Marca de «hay trabajo sin guardar» del almacén local: de ella depende que el editor arranque limpio o que ofrezca
// la copia automática. Se prueba con un localStorage de mentira, sin navegador.
import test from 'node:test';
import assert from 'node:assert/strict';

const almacen = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  get length() {
    return almacen.size;
  },
  clear: () => almacen.clear(),
  getItem: (clave: string) => (almacen.has(clave) ? almacen.get(clave)! : null),
  key: (indice: number) => [...almacen.keys()][indice] ?? null,
  removeItem: (clave: string) => void almacen.delete(clave),
  setItem: (clave: string, valor: string) => void almacen.set(clave, String(valor)),
} as Storage;

const { estadoDeGuardado, hayCambiosSinGuardar, marcarPendiente, olvidarProyecto, saveLocal, recover } = await import('../lib/editor/storage');
const { newProject } = await import('../lib/editor/project');

test('sin copia automática no hay nada que recuperar', () => {
  almacen.clear();
  assert.equal(recover(), null, 'un navegador recién estrenado no tiene proyecto guardado');
  // Sin marca no se avisa al cerrar (no consta que haya trabajo sin guardar), pero al arrancar sí se ofrece la copia
  // si existe: es la postura que no pierde trabajo (lo prueba el E2E del arranque).
  assert.equal(estadoDeGuardado(), 'sin-marca');
  assert.equal(hayCambiosSinGuardar(), false);
});

test('la marca distingue trabajo sin guardar de proyecto guardado', () => {
  almacen.clear();
  marcarPendiente(true);
  assert.equal(hayCambiosSinGuardar(), true, 'hay cambios sin guardar');
  marcarPendiente(false);
  assert.equal(hayCambiosSinGuardar(), false, 'el proyecto está guardado');
});

test('un proyecto de antes de esta regla (sin marca) se ofrece una vez, para no perder trabajo', () => {
  almacen.clear();
  almacen.set('corte15-autosave-v1', JSON.stringify(newProject()));
  assert.equal(estadoDeGuardado(), 'sin-marca', 'sin marca, al arrancar se ofrece la copia');
  assert.equal(hayCambiosSinGuardar(), false, 'pero al cerrar no se avisa sin constancia de cambios');
});

test('olvidar el proyecto borra la copia y la marca (el siguiente arranque es limpio)', () => {
  almacen.clear();
  saveLocal(newProject());
  marcarPendiente(true);
  assert.equal(almacen.size, 2, 'hay copia y marca');
  olvidarProyecto();
  assert.equal(almacen.size, 0, 'no queda ni proyecto ni marca');
  assert.equal(recover(), null);
});

test('la copia automática se puede volver a leer', () => {
  almacen.clear();
  saveLocal(newProject());
  const leido = recover();
  assert.ok(leido, 'la copia se lee');
  assert.equal(leido!.tracks.length, 3, 'y es el proyecto que se guardó');
});
