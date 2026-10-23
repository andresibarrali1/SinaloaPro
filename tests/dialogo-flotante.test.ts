// Guarda contra el fallo que hacía que Pan/Crop apareciera media pantalla desplazada: el minimizador de la
// compilación fusiona `transform: none; translate: none; scale: none` en un solo `transform: translate(0) scale(1)`
// y **borra** el `translate`, así que la ventana flotante conservaba el `translate(-50%, -50%)` de Tailwind. La regla
// del estilo compilado tiene que anular las variables `--tw-translate-x/y` para que el desplazamiento no exista.
// Se comprueba sobre el CSS de `dist/`, que es lo que sirve la aplicación instalada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const carpeta = path.resolve('dist', 'assets');
const hojas = existsSync(carpeta) ? readdirSync(carpeta).filter((archivo) => archivo.endsWith('.css')) : [];

test('el CSS compilado anula la traslación del diálogo flotante (Pan/Crop centrado)', { skip: hojas.length === 0 ? 'no hay compilación en dist/: ejecuta npm run build para comprobarlo' : false }, () => {
  const css = hojas.map((archivo) => readFileSync(path.join(carpeta, archivo), 'utf8')).join('\n');
  const regla = css.match(/\.editor-dialog\.floating-dialog\s*\{([^}]*)\}/);
  assert.ok(regla, 'la compilación incluye la regla del diálogo flotante');
  const cuerpo = regla[1].replace(/\s+/g, ' ');
  assert.match(cuerpo, /--tw-translate-x:\s*0(px)?/, `anula la traslación horizontal en el CSS compilado (${cuerpo.slice(0, 200)})`);
  assert.match(cuerpo, /--tw-translate-y:\s*0(px)?/, 'anula la traslación vertical en el CSS compilado');
  assert.match(cuerpo, /position:\s*fixed/, 'el diálogo flotante ocupa la ventana');
});
