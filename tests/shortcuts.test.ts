// El mapa de teclas reproduce los métodos abreviados **predeterminados de Vegas Pro 15** (manual, «Métodos
// abreviados de teclado», páginas 636-651). Esta prueba fija los valores del manual para la barra de transporte y
// edición, de modo que si alguien cambia una tecla por comodidad, aquí falla y se ve contra qué se contrastó.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHORTCUTS, resolveShortcut, shortcutLabel, isMacPlatform } from '../lib/editor/shortcuts';

type Evento = Parameters<typeof resolveShortcut>[0];
const evento = (key: string, mods: Partial<Evento> = {}): Evento => ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods });
const alterno = (entrada: (typeof SHORTCUTS)[number]) => Boolean('alt' in entrada ? entrada.alt : false);

for (const mac of [false, true])
  test(`Cada atajo anunciado se resuelve tal cual (${mac ? 'Mac' : 'Windows/Linux'})`, () => {
    const vistos = new Set<string>();
    for (const entrada of SHORTCUTS) {
      const firma = [entrada.key, entrada.mod, entrada.shift, alterno(entrada)].join(':');
      assert.ok(!vistos.has(firma), `la combinación ${firma} está repetida`);
      vistos.add(firma);
      const resuelto = resolveShortcut(evento(entrada.key, { ctrlKey: !mac && entrada.mod, metaKey: mac && entrada.mod, shiftKey: entrada.shift, altKey: alterno(entrada) }), mac);
      assert.equal(resuelto, entrada.id, `${firma} debería ser ${entrada.id}`);
    }
  });

test('Los atajos de la barra son los del manual (páginas 636-651)', () => {
  const atajo = (id: string) => {
    const entrada = SHORTCUTS.find((item) => item.id === id);
    assert.ok(entrada, `falta el atajo ${id}`);
    return [...(entrada.mod ? ['Ctrl'] : []), ...(entrada.shift ? ['Mayús'] : []), ...(alterno(entrada) ? ['Alt'] : []), entrada.key].join('+');
  };
  // Transporte: Espacio, Mayús+Espacio, Entrar, Esc, Q, Ctrl+Inicio, Ctrl+Fin, Alt+flecha.
  assert.equal(atajo('transport'), ' ');
  assert.equal(atajo('playAll'), 'Mayús+ ');
  assert.equal(atajo('playPause'), 'Enter');
  assert.equal(atajo('stop'), 'Escape');
  assert.equal(atajo('loop'), 'q');
  assert.equal(atajo('projectStart'), 'Ctrl+Home');
  assert.equal(atajo('projectEnd'), 'Ctrl+End');
  assert.equal(atajo('frameLeft'), 'Alt+ArrowLeft');
  assert.equal(atajo('frameRight'), 'Alt+ArrowRight');
  // Pasos finos con las flechas (el manual: un píxel; con cuantización, un fotograma).
  assert.equal(atajo('pxLeft'), 'ArrowLeft');
  assert.equal(atajo('pxRight'), 'ArrowRight');
  // Interruptores: F8, Ctrl+Mayús+X, Ctrl+Mayús+U, Alt+F8.
  assert.equal(atajo('snap'), 'F8');
  assert.equal(atajo('crossfades'), 'Ctrl+Mayús+x');
  assert.equal(atajo('ignoreGrouping'), 'Ctrl+Mayús+u');
  assert.equal(atajo('quantize'), 'Alt+F8');
  // Herramientas: Ctrl+D y D / Mayús+D para pasar de una a otra.
  assert.equal(atajo('toolNormal'), 'Ctrl+d');
  assert.equal(atajo('toolNext'), 'd');
  assert.equal(atajo('toolPrev'), 'Mayús+d');
  // Marcadores y edición.
  assert.equal(atajo('marker'), 'm');
  assert.equal(atajo('region'), 'r');
  assert.equal(atajo('markerPrev'), 'Ctrl+ArrowLeft');
  assert.equal(atajo('markerNext'), 'Ctrl+ArrowRight');
  assert.equal(atajo('split'), 's');
  assert.equal(atajo('delete'), 'Delete');
  assert.equal(atajo('trim'), 'Ctrl+t');
  assert.equal(atajo('group'), 'g');
  assert.equal(atajo('ungroup'), 'u');
  // Zoom: flechas y Ctrl+flechas.
  assert.equal(atajo('zoomIn'), 'ArrowUp');
  assert.equal(atajo('zoomOut'), 'ArrowDown');
  assert.equal(atajo('zoomInBig'), 'Ctrl+ArrowUp');
  assert.equal(atajo('zoomOutBig'), 'Ctrl+ArrowDown');
});

test('Mac usa Comando y Windows Control, también en guardar y deshacer', () => {
  for (const [key, action] of [['s', 'save'], ['z', 'undo'], ['o', 'open'], ['c', 'copy'], ['v', 'paste']] as const) {
    assert.equal(resolveShortcut(evento(key, { metaKey: true }), true), action);
    assert.equal(resolveShortcut(evento(key, { ctrlKey: true }), false), action);
    assert.equal(resolveShortcut(evento(key, { ctrlKey: true }), true), null);
  }
  assert.equal(resolveShortcut(evento('Z', { metaKey: true, shiftKey: true }), true), 'redo');
  assert.equal(resolveShortcut(evento('y', { metaKey: true }), true), null);
  assert.equal(resolveShortcut(evento('y', { ctrlKey: true }), false), 'redo');
});

// El editor no puede quedarse con las teclas del navegador o del sistema: estas combinaciones siguen sin hacer nada.
test('Las combinaciones del navegador y del sistema no editan el proyecto', () => {
  for (const mac of [false, true]) {
    const mod = mac ? { metaKey: true } : { ctrlKey: true };
    for (const key of ['n', 'w', 'l', 'q', 'r']) assert.equal(resolveShortcut(evento(key, mod), mac), null, `${key} con el modificador del sistema`);
    for (const key of ['c', 'v', 'l', 'n']) assert.equal(resolveShortcut(evento(key, { ...mod, shiftKey: true }), mac), null, `${key} con Mayús`);
    // Cmd/Ctrl+Alt: no es un atajo del editor.
    for (const key of ['a', 'd', 's']) assert.equal(resolveShortcut(evento(key, { ...mod, altKey: true }), mac), null);
  }
});

test('La composición y los modificadores inesperados no disparan una edición', () => {
  assert.equal(resolveShortcut(evento('s', { isComposing: true }), true), null);
  // Alta/Mayús (AltGr) es Ctrl+Alt y no debe editar; Alt a secas sí es un atajo del manual (Alt+flecha, Alt+F8).
  assert.equal(resolveShortcut(evento('s', { ctrlKey: true, altKey: true, getModifierState: () => true }), false), null);
  assert.equal(resolveShortcut(evento('s', { metaKey: true, shiftKey: true }), true), null);
  assert.equal(resolveShortcut(evento('s', { ctrlKey: true, metaKey: true }), true), null);
});

test('Los alias que el manual documenta y los rótulos', () => {
  assert.equal(resolveShortcut(evento('C', { shiftKey: true }), true), 'copyAttributes');
  assert.equal(resolveShortcut(evento('V', { shiftKey: true }), true), 'pasteAttributes');
  // El manual da dos teclas para borrar (Suprimir o Retroceso) y dos para rehacer (Ctrl+Mayús+Z o Ctrl+Y).
  assert.equal(resolveShortcut(evento('Backspace'), true), 'delete');
  assert.equal(resolveShortcut(evento('Delete'), false), 'delete');
  assert.equal(resolveShortcut(evento('y', { ctrlKey: true }), false), 'redo');
  assert.equal(shortcutLabel('save', true), '⌘ Comando+S');
  assert.equal(shortcutLabel('redo', true), '⌘ Comando+Mayús+Z');
  assert.equal(shortcutLabel('snap', false), 'F8');
  assert.equal(shortcutLabel('crossfades', false), 'Ctrl+Mayús+X');
  assert.equal(shortcutLabel('quantize', false), 'Alt+F8');
  assert.equal(shortcutLabel('frameLeft', false), 'Alt+←');
  assert.equal(shortcutLabel('transport', false), 'Espacio');
  assert.equal(shortcutLabel('playAll', false), 'Mayús+Espacio');
  assert.equal(shortcutLabel('marker', false), 'M');
  assert.ok(isMacPlatform('MacIntel'));
  assert.ok(!isMacPlatform('Win32'));
});
