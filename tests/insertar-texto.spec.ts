// «Insertar texto en esta pista», como el texto de VEGAS: con el botón derecho sobre una pista de vídeo, imágenes,
// textos o subtítulos se crea un texto en la aguja y se abre el editor de textos para escribir el que se acaba de
// crear. En las pistas de audio la orden aparece deshabilitada.
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const fixture = (name: string) => path.resolve('tests/fixtures', name);
const CLAVE = 'corte15-autosave-v1';

type Evento = { id: string; kind: string; name: string; trackId: string; start: number; duration: number; text: string };
type Guardado = { events?: Evento[]; tracks?: { id: string; kind: string; name: string }[] };

const guardado = async (page: Page): Promise<Guardado | null> => {
  const texto = await page.evaluate((clave) => localStorage.getItem(clave), CLAVE);
  return texto ? (JSON.parse(texto) as Guardado) : null;
};

async function abrirConClip(page: Page) {
  await page.goto('/?bienvenida=no');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.vegas-toolbar')).toBeVisible();
  await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Video_A.mp4')]);
  await expect(page.locator('.media-item')).toHaveCount(1, { timeout: 60000 });
  await page.locator('.media-item').filter({ hasText: 'Video_A.mp4' }).dblclick();
  await expect(page.locator('.timeline-event.video')).toHaveCount(1, { timeout: 20000 });
  await page.waitForTimeout(800);
}

/** Clic derecho en una zona vacía del carril: Playwright lo trae a la vista antes de pulsar. */
async function clicDerechoEnCarril(page: Page, carril: ReturnType<Page['locator']>) {
  await carril.click({ button: 'right', position: { x: 620, y: 10 } });
  await expect(page.locator('.workspace-menu'), 'se abre el menú de la pista').toBeVisible();
}

/** Pone la aguja en un punto conocido de la regla y devuelve su timecode para comparar después. */
async function ponerAguja(page: Page, x = 320) {
  const regla = (await page.locator('.ruler').boundingBox())!;
  await page.mouse.click(regla.x + x, regla.y + 12);
  await page.waitForTimeout(250);
  return page.locator('.big-timecode').innerText();
}

test('clic derecho en una pista de vídeo crea un texto en la aguja y abre el editor de textos', async ({ page }) => {
  await abrirConClip(page);
  const timecode = await ponerAguja(page, 320);
  // Zona vacía del carril (lejos de los clips) para que el menú sea el de la pista y no el del evento.
  await clicDerechoEnCarril(page, page.locator('.track-lane.video').nth(1));
  const orden = page.getByRole('menuitem', { name: /Insertar texto en esta pista/ });
  await expect(orden).toBeVisible();
  await expect(orden).toBeEnabled();

  await orden.click();
  // El editor de textos se abre solo para el texto recién creado.
  await expect(page.getByRole('dialog').filter({ hasText: 'Títulos y texto' })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('dialog').getByLabel(/Texto \(Intro para otra línea\)/)).toHaveValue('Escribe tu título');

  await expect.poll(async () => ((await guardado(page))?.events ?? []).filter((evento) => evento.kind === 'text').length, { message: 'el texto llega al proyecto guardado' }).toBe(1);
  const proyecto = (await guardado(page))!;
  const textos = (proyecto.events ?? []).filter((evento) => evento.kind === 'text');
  expect(textos.length, 'hay un texto nuevo').toBe(1);
  const pistaDelTexto = (proyecto.tracks ?? []).find((pista) => pista.id === textos[0].trackId)!;
  expect(pistaDelTexto.kind, 'el texto va en la pista de vídeo pulsada').toBe('video');
  expect(textos[0].duration, 'dura cinco segundos por defecto').toBe(5 * 705600000);
  // El evento cae en la aguja: el timecode nuevo coincide con el del texto.
  const inicio = textos[0].start / 705600000;
  const [horas, minutos, segundos] = timecode.split(':').map(Number);
  expect(Math.abs(inicio - (horas * 3600 + minutos * 60 + segundos)), 'el texto empieza en la aguja').toBeLessThan(1);

  // Escribir el texto y comprobar que se guarda en el evento.
  const area = page.getByRole('dialog').getByLabel(/Texto \(Intro para otra línea\)/);
  await area.fill('Bienvenidos a Sinaloa Pro');
  await expect.poll(async () => ((await guardado(page))?.events ?? []).filter((evento) => evento.kind === 'text').map((evento) => evento.text)[0]).toBe('Bienvenidos a Sinaloa Pro');
});

test('el clic derecho en la cabecera de la pista también ofrece crear el texto', async ({ page }) => {
  await abrirConClip(page);
  const cabecera = page.locator('#track-headers .track-header.video').first();
  const caja = (await cabecera.boundingBox())!;
  await page.mouse.click(caja.x + 40, caja.y + 12, { button: 'right' });
  await expect(page.locator('.workspace-menu')).toBeVisible();
  await expect(page.locator('.workspace-menu-title')).toContainText('Pista');
  await page.getByRole('menuitem', { name: /Insertar texto en esta pista/ }).click();
  await expect(page.getByRole('dialog').filter({ hasText: 'Títulos y texto' })).toBeVisible({ timeout: 20000 });
  await expect.poll(async () => ((await guardado(page))?.events ?? []).some((evento) => evento.kind === 'text'), { message: 'el texto llega al proyecto guardado' }).toBe(true);
  const proyecto = (await guardado(page))!;
  const texto = (proyecto.events ?? []).find((evento) => evento.kind === 'text')!;
  expect(texto, 'el texto se creó en la pista de la cabecera').toBeTruthy();
  expect(texto.trackId, 'y en esa pista, no en otra').toBe((proyecto.tracks ?? []).find((pista) => pista.name === 'Títulos')?.id ?? texto.trackId);
});

test('en una pista de audio la orden aparece deshabilitada', async ({ page }) => {
  await abrirConClip(page);
  await clicDerechoEnCarril(page, page.locator('.track-lane.audio').first());
  const orden = page.getByRole('menuitem', { name: /Insertar texto en esta pista/ });
  await expect(orden).toBeVisible();
  await expect(orden).toBeDisabled();
  // Y no se crea nada al intentarlo.
  const antes = ((await guardado(page))?.events ?? []).length;
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  expect(((await guardado(page))?.events ?? []).length, 'no se creó ningún evento').toBe(antes);
});
