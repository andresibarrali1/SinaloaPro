// El proyecto abierto se restaura al recargar, tanto guardado como con cambios pendientes.
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const fixture = (name: string) => path.resolve('tests/fixtures', name);
const CLAVE = 'corte15-autosave-v1';
const MARCA = 'corte15-pendiente-v1';

const guardado = async (page: Page) => {
  const texto = await page.evaluate((clave) => localStorage.getItem(clave), CLAVE);
  return texto ? (JSON.parse(texto) as { events?: unknown[] }) : null;
};
const marca = (page: Page) => page.evaluate((clave) => localStorage.getItem(clave), MARCA);

async function abrir(page: Page) {
  await page.goto('/?bienvenida=no');
  await expect(page.locator('.vegas-toolbar')).toBeVisible();
  await page.waitForTimeout(900);
}
/** Monta un clip de vídeo (con su audio enlazado) en la línea de tiempo. */
async function montarClip(page: Page) {
  await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Video_A.mp4')]);
  await expect(page.locator('.media-item')).toHaveCount(1, { timeout: 60000 });
  await page.locator('.media-item').filter({ hasText: 'Video_A.mp4' }).dblclick();
  await expect(page.locator('.timeline-event.video')).toHaveCount(1, { timeout: 20000 });
  await page.waitForTimeout(900);
}

test('sin copia automática, el editor arranca limpio', async ({ page }) => {
  await page.goto('/?bienvenida=no');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.vegas-toolbar')).toBeVisible();
  await expect(page.locator('.timeline-event')).toHaveCount(0);
  expect((await guardado(page))?.events??[]).toHaveLength(0);
});

test('un proyecto sin guardar se recupera al volver a abrir (cierre inesperado)', async ({ page }) => {
  await abrir(page);
  await montarClip(page);
  expect(await marca(page), 'tras editar, el proyecto queda como pendiente de guardar').toBe('1');
  const contenido = await guardado(page);
  expect((contenido?.events ?? []).length, 'la copia automática tiene el montaje').toBe(2);

  // Recargar equivale a un cierre inesperado: al abrir, el proyecto sigue donde se quedó.
  await page.reload();
  await expect(page.locator('.vegas-toolbar')).toBeVisible();
  await expect(page.locator('.timeline-event.video'), 'el clip vuelve').toHaveCount(1, { timeout: 20000 });
  await expect(page.locator('.statusbar [role=status]')).toContainText('Proyecto restaurado');
});

test('un proyecto guardado se conserva al recargar', async ({ page }) => {
  await abrir(page);
  await montarClip(page);
  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Guardar proyecto/ }).first().click();
  const archivo = await descarga;
  await archivo.saveAs(path.resolve('test-results', 'arranque-limpio.corte15'));
  await expect.poll(async () => marca(page), { message: 'guardar deja el proyecto como guardado' }).toBe('0');

  await page.reload();
  await expect(page.locator('.vegas-toolbar')).toBeVisible();
  await expect(page.locator('.timeline-event')).toHaveCount(2);
  expect((await guardado(page))?.events).toHaveLength(2);
  await expect(page.locator('.statusbar [role=status]')).toContainText('Proyecto restaurado');

  // Y el archivo guardado sí se puede abrir a mano: eso no es «arranque», es abrir un proyecto.
  await page.locator('input[type=file]').nth(1).setInputFiles(path.resolve('test-results', 'arranque-limpio.corte15'));
  await expect(page.locator('.timeline-event.video'), 'el proyecto guardado se abre desde el archivo').toHaveCount(1, { timeout: 20000 });
  // Abrir un archivo no cuenta como trabajo sin guardar: si se cierra sin editar, el siguiente arranque sigue limpio.
  expect(await marca(page), 'el proyecto abierto está guardado').toBe('0');
  await page.reload();
  await expect(page.locator('.timeline-event')).toHaveCount(2);
});

test('si se edita después de abrir un archivo, esa sesión sí se recupera', async ({ page }) => {
  await abrir(page);
  await montarClip(page);
  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Guardar proyecto/ }).first().click();
  const archivo = await descarga;
  const ruta = path.resolve('test-results', 'arranque-edicion.corte15');
  await archivo.saveAs(ruta);
  await expect.poll(async () => marca(page)).toBe('0');

  await page.reload();
  await expect(page.locator('.timeline-event')).toHaveCount(2);
  await page.locator('input[type=file]').nth(1).setInputFiles(ruta);
  await expect(page.locator('.timeline-event.video')).toHaveCount(1, { timeout: 20000 });
  // Un cambio cualquiera (mover la aguja no cuenta; dividir sí): el proyecto vuelve a quedar pendiente. Se pulsa en
  // el centro del clip para que la aguja caiga dentro y la división parta de verdad.
  const clip = page.locator('.timeline-event.video').first();
  const caja = (await clip.boundingBox())!;
  await clip.click({ position: { x: caja.width / 2, y: caja.height / 2 } });
  await page.keyboard.press('s');
  await expect(page.locator('.timeline-event.video'), 'la división deja dos tramos').toHaveCount(2, { timeout: 20000 });
  await expect.poll(async () => marca(page), { message: 'dividir deja el proyecto pendiente' }).toBe('1');
  // La copia automática se escribe con un retardo corto (450 ms) desde el último cambio: se espera a que el proyecto
  // guardado ya tenga la división antes de simular el cierre inesperado.
  await expect
    .poll(async () => ((await guardado(page))?.events ?? []).length, { message: 'la copia automática ya tiene la división' })
    .toBe(4);
  await page.reload();
  await expect(page.locator('.timeline-event.video').first(), 'la sesión editada se recupera').toBeVisible({ timeout: 20000 });
});
