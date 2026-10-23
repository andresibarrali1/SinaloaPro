// Barra de herramientas de transporte y edición, copiada de la de Vegas Pro 15 (manual del programa, páginas 28-30
// para los botones y 636-651 para los métodos abreviados). Cada prueba contrasta el botón con el nombre del manual y
// el atajo con la tabla del manual, así que si alguno se cambia de tecla, aquí se ve.
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const fixture = (name: string) => path.resolve('tests/fixtures', name);
const CLAVE = 'corte15-autosave-v1';

type Guardado = { events?: { id: string; kind: string; start: number }[]; markers?: { id: string; name: string }[]; region?: { start: number; end: number } | null };

async function proyectoGuardado(page: Page): Promise<Guardado | null> {
  const texto = await page.evaluate((clave) => localStorage.getItem(clave), CLAVE);
  if (!texto) return null;
  try {
    return JSON.parse(texto) as Guardado;
  } catch {
    return null;
  }
}
async function esperarProyecto(page: Page, comprobar: (proyecto: Guardado) => boolean, mensaje: string) {
  await expect
    .poll(async () => {
      const proyecto = await proyectoGuardado(page);
      return proyecto ? comprobar(proyecto) : false;
    }, { message: mensaje, timeout: 20000 })
    .toBe(true);
  const proyecto = await proyectoGuardado(page);
  if (!proyecto) throw new Error(`sin proyecto guardado después de: ${mensaje}`);
  return proyecto;
}
async function nuevaSesion(page: Page) {
  await page.goto('/?bienvenida=no');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('button', { name: 'Nuevo proyecto', exact: true })).toBeVisible();
  await expect(page.locator('.vegas-toolbar')).toBeVisible();
}
/** Un montaje mínimo: un vídeo importado y colocado en la línea de tiempo. */
async function montar(page: Page) {
  await nuevaSesion(page);
  await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Video_A.mp4')]);
  await expect(page.locator('.media-item')).toHaveCount(1, { timeout: 60000 });
  await page.locator('.media-item').filter({ hasText: 'Video_A.mp4' }).dblclick();
  await expect(page.locator('.timeline-event.video')).toHaveCount(1, { timeout: 20000 });
  await page.waitForTimeout(900);
}
/** Activos de la barra: se leen de `aria-pressed`, que es lo que anuncia el estado de cada interruptor. */
const activos = (page: Page) => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.vegas-toolbar .tool[aria-pressed="true"]')].map((boton) => boton.getAttribute('aria-label')));
const esActivo = async (page: Page, nombre: string) => (await activos(page)).includes(nombre);

test('la barra trae los botones del manual, con su atajo en el rótulo', async ({ page }) => {
  await nuevaSesion(page);
  for (const nombre of [
    'Grabar',
    'Reproducir en bucle',
    'Reproducir desde el inicio',
    'Reproducir',
    'Pausa',
    'Detener',
    'Ir al inicio',
    'Ir al final',
    'Fotograma anterior',
    'Fotograma siguiente',
    'Herramienta de edición normal',
    'Herramienta de edición de envolventes',
    'Herramienta de edición de selección',
    'Herramienta de edición de zoom',
    'Ajuste magnético',
    'Fundidos automáticos',
    'Bloquear envolventes a los eventos',
    'Ignorar la agrupación de eventos',
    'Cuantizar a fotogramas',
    'Insertar marcador',
    'Insertar región',
  ]) {
    await expect(page.locator('.vegas-toolbar').getByRole('button', { name: nombre, exact: true }), `el botón «${nombre}» está en la barra`).toBeVisible();
  }
  // Los atajos del manual, en el rótulo de cada botón (páginas 636-651): F8, Ctrl+Mayús+X, Alt+F8, Q, M, Esc…
  const rotulos = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.vegas-toolbar .tool')].map((boton) => `${boton.getAttribute('aria-label')}|${boton.getAttribute('title')}`));
  const rotulo = (nombre: string) => rotulos.find((texto) => texto.startsWith(`${nombre}|`)) ?? '';
  expect(rotulo('Ajuste magnético')).toContain('(F8)');
  expect(rotulo('Fundidos automáticos')).toContain('(Ctrl+Mayús+X)');
  expect(rotulo('Ignorar la agrupación de eventos')).toContain('(Ctrl+Mayús+U)');
  expect(rotulo('Cuantizar a fotogramas')).toContain('(Alt+F8)');
  expect(rotulo('Reproducir en bucle')).toContain('(Q)');
  expect(rotulo('Reproducir desde el inicio')).toContain('(Mayús+Espacio)');
  expect(rotulo('Detener')).toContain('(Esc)');
  expect(rotulo('Insertar marcador')).toContain('(M)');
  expect(rotulo('Insertar región')).toContain('(R)');
  expect(rotulo('Herramienta de edición normal')).toContain('(Ctrl+D)');
  // La grabación no existe todavía: el botón está apagado y lo explica su propio rótulo en vez de fallar en silencio.
  const grabar = page.locator('.vegas-toolbar').getByRole('button', { name: 'Grabar', exact: true });
  await expect(grabar).toBeDisabled();
  expect(await grabar.getAttribute('title')).toContain('no graba');
});

test('los interruptores de la barra se encienden con los atajos del manual', async ({ page }) => {
  await montar(page);
  await page.locator('.timeline-section').click({ position: { x: 300, y: 120 } });
  expect(await esActivo(page, 'Ajuste magnético'), 'el ajuste empieza encendido').toBe(true);
  await page.keyboard.press('F8');
  expect(await esActivo(page, 'Ajuste magnético'), 'F8 apaga el ajuste').toBe(false);
  await page.keyboard.press('F8');
  expect(await esActivo(page, 'Ajuste magnético'), 'F8 lo vuelve a encender').toBe(true);

  expect(await esActivo(page, 'Fundidos automáticos'), 'los fundidos automáticos empiezan encendidos, como en Vegas').toBe(true);
  await page.keyboard.press('Control+Shift+X');
  expect(await esActivo(page, 'Fundidos automáticos'), 'Ctrl+Mayús+X los apaga').toBe(false);
  await page.keyboard.press('Control+Shift+X');

  await page.keyboard.press('Alt+F8');
  expect(await esActivo(page, 'Cuantizar a fotogramas'), 'Alt+F8 apaga la cuantización').toBe(false);
  await page.keyboard.press('Alt+F8');
  expect(await esActivo(page, 'Cuantizar a fotogramas'), 'Alt+F8 la vuelve a encender').toBe(true);

  await page.keyboard.press('Control+Shift+U');
  expect(await esActivo(page, 'Ignorar la agrupación de eventos'), 'Ctrl+Mayús+U ignora la agrupación').toBe(true);

  await page.keyboard.press('q');
  expect(await esActivo(page, 'Reproducir en bucle'), 'Q activa la reproducción en bucle').toBe(true);
  await page.keyboard.press('q');
  expect(await esActivo(page, 'Reproducir en bucle'), 'Q la desactiva').toBe(false);
});

test('M inserta un marcador y R una región; los dos se guardan', async ({ page }) => {
  await montar(page);
  await page.locator('.timeline-section').click({ position: { x: 260, y: 120 } });
  await page.keyboard.press('m');
  const conMarcador = await esperarProyecto(page, (proyecto) => (proyecto.markers ?? []).length === 1, 'M inserta un marcador');
  expect(conMarcador.markers?.[0]?.name).toBe('Marcador 1');

  await page.keyboard.press('r');
  const conRegion = await esperarProyecto(page, (proyecto) => Boolean(proyecto.region), 'R inserta una región');
  const region = conRegion.region!;
  expect(region.end - region.start, 'la región dura cinco segundos').toBe(5 * 705600000);
});

test('las teclas de selección, herramienta y zoom de la barra mueven el cursor y el zoom', async ({ page }) => {
  await montar(page);
  await page.locator('.timeline-section').click({ position: { x: 300, y: 120 } });
  const ancho = () => page.evaluate(() => Math.round(document.querySelector('.timeline-content')!.getBoundingClientRect().width));
  const anchoInicial = await ancho();
  await page.keyboard.press('ArrowUp');
  expect(await ancho(), 'la flecha arriba acerca el zoom').toBeGreaterThan(anchoInicial);
  await page.keyboard.press('ArrowDown');
  expect(await ancho(), 'la flecha abajo lo aleja').toBeLessThanOrEqual(anchoInicial);

  // D pasa a la herramienta siguiente y Ctrl+D vuelve a la normal (manual, página 641). La tecla solo toca las
  // herramientas de la barra: el selector «Envolvente: Ninguna / Volumen / Panorámica» del pie es otro control y no
  // se mueve.
  const envolventeDelPie = async () => page.evaluate(() => [...document.querySelectorAll('.bottom-toolbar .button-row button')].filter((boton) => boton.getAttribute('aria-pressed') === 'true').map((boton) => boton.textContent));
  expect(await envolventeDelPie(), 'de partida no hay envolvente a la vista').toEqual(['Ninguna']);
  await page.keyboard.press('d');
  expect(await esActivo(page, 'Herramienta de edición de envolventes'), 'D pasa a la envolvente').toBe(true);
  expect(await envolventeDelPie(), 'D no cambia la envolvente del pie').toEqual(['Ninguna']);
  expect(await page.evaluate(() => document.querySelector('.timeline-content')?.className.includes('tool-envelope')), 'sin envolvente a la vista, la herramienta no bloquea los eventos').toBe(false);
  await page.keyboard.press('Control+d');
  expect(await esActivo(page, 'Herramienta de edición normal'), 'Ctrl+D vuelve a la normal').toBe(true);
  // Y al revés: mostrar la envolvente en el pie no cambia la herramienta de la barra.
  await page.getByRole('button', { name: 'Volumen', exact: true }).click();
  expect(await envolventeDelPie(), 'el botón del pie enciende la envolvente').toEqual(['Volumen']);
  expect(await esActivo(page, 'Herramienta de edición normal'), 'y la herramienta sigue siendo la normal').toBe(true);
  await page.getByRole('button', { name: 'Ninguna', exact: true }).click();

  // El manual mueve un píxel con las flechas (un fotograma al cuantizar, que es como está por defecto): el timecode
  // avanza y vuelve. (Alt+flecha, el atajo literal del manual para el fotograma, se lo queda el historial del
  // navegador; por eso las flechas solas hacen el paso fino y así queda dicho en la ayuda.)
  const timecode = () => page.locator('.big-timecode').innerText();
  const fotogramas = (valor: string) => valor.split(':').reduce((total, parte) => total * 30 + Number(parte), 0);
  const antes = fotogramas(await timecode());
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => fotogramas(await timecode()), { message: 'la flecha derecha avanza un fotograma' }).toBeGreaterThan(antes);
  const derecha = fotogramas(await timecode());
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => fotogramas(await timecode()), { message: 'la flecha izquierda retrocede' }).toBeLessThan(derecha);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => fotogramas(await timecode()), { message: 'dos pasos atrás vuelven al punto de partida' }).toBeLessThanOrEqual(antes);
});

test('la herramienta de selección selecciona con un rectángulo y la de zoom acerca con un clic', async ({ page }) => {
  await montar(page);
  await page.getByRole('button', { name: 'Herramienta de edición de selección', exact: true }).click();
  const caja = (await page.locator('.timeline-event.video').first().boundingBox())!;
  const contenido = (await page.locator('.timeline-content').boundingBox())!;
  // El rectángulo empieza por encima del evento y lo atraviesa: los eventos que toca quedan seleccionados.
  await page.mouse.move(contenido.x + 6, contenido.y + 6);
  await page.mouse.down();
  await page.mouse.move(caja.x + 20, caja.y + 20, { steps: 4 });
  await page.mouse.move(caja.x + caja.width - 8, caja.y + caja.height - 8, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('.timeline-event.selected'), 'el rectángulo selecciona el evento que toca').toHaveCount(1);

  const ancho = () => page.evaluate(() => Math.round(document.querySelector('.timeline-content')!.getBoundingClientRect().width));
  const antes = await ancho();
  await page.getByRole('button', { name: 'Herramienta de edición de zoom', exact: true }).click();
  const carril = (await page.locator('.track-lane').first().boundingBox())!;
  await page.mouse.click(carril.x + 220, carril.y + 20);
  await expect.poll(ancho, { message: 'el clic de la herramienta de zoom acerca' }).toBeGreaterThan(antes);
});
