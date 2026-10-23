// Aviso al cerrar: si el proyecto tiene cambios sin guardar, el navegador pregunta antes de cerrar la pestaña o la
// ventana de la aplicación instalada. Si ya se guardó, se cierra sin preguntar nada.
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const fixture = (name: string) => path.resolve('tests/fixtures', name);
/** Espera en el propio proceso de pruebas (la página puede haberse cerrado ya). */
const esperar = (ms: number) => new Promise((listo) => setTimeout(listo, ms));
const MARCA = 'corte15-pendiente-v1';

/** Recoge los diálogos del navegador y los descarta (descartar el aviso de cierre deja la página abierta). */
function escucharAvisos(page: Page) {
  const avisos: string[] = [];
  page.on('dialog', async (dialogo) => {
    avisos.push(dialogo.type());
    await dialogo.dismiss().catch(() => undefined);
  });
  return avisos;
}

async function arrancar(page: Page) {
  await page.goto('/?bienvenida=no');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.vegas-toolbar')).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(500);
}

async function montarClip(page: Page) {
  await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Video_A.mp4')]);
  await expect(page.locator('.media-item')).toHaveCount(1, { timeout: 60000 });
  await page.locator('.media-item').filter({ hasText: 'Video_A.mp4' }).dblclick();
  await expect(page.locator('.timeline-event.video')).toHaveCount(1, { timeout: 20000 });
  await page.waitForTimeout(900);
}

test('sin cambios, cerrar no pregunta nada', async ({ page }) => {
  const avisos = escucharAvisos(page);
  await arrancar(page);
  expect(await page.evaluate((marca) => localStorage.getItem(marca), MARCA), 'el proyecto nuevo no queda pendiente').toBe('0');
  await page.reload();
  await page.waitForTimeout(600);
  expect(avisos, 'no hay aviso al recargar un proyecto sin cambios').toEqual([]);
  // Y al cerrar la pestaña tampoco: se cierra sin más.
  await page.close({ runBeforeUnload: true }).catch(() => undefined);
  await esperar(400);
  expect(avisos, 'no hay aviso al cerrar').toEqual([]);
});

test('con cambios sin guardar, el navegador pregunta al cerrar la pestaña o la ventana', async ({ page }) => {
  const avisos = escucharAvisos(page);
  await arrancar(page);
  await montarClip(page);
  expect(await page.evaluate((marca) => localStorage.getItem(marca), MARCA), 'el montaje deja el proyecto pendiente').toBe('1');

  // Recargar equivale a cerrar la pestaña: el navegador pide confirmación.
  await page.reload({ timeout: 5000 }).catch(() => undefined);
  await page.waitForTimeout(800);
  expect(avisos, 'el navegador avisa al cerrar con cambios sin guardar').toContain('beforeunload');

  // Y lo mismo al cerrar la ventana (la página sigue abierta porque el aviso se descartó).
  avisos.length = 0;
  await page.close({ runBeforeUnload: true }).catch(() => undefined);
  await esperar(600);
  expect(avisos, 'el aviso también sale al cerrar la ventana').toContain('beforeunload');
});

test('si se guarda, cerrar no pregunta nada', async ({ page }) => {
  const avisos = escucharAvisos(page);
  await arrancar(page);
  await montarClip(page);
  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Guardar proyecto/ }).first().click();
  await descarga;
  await expect.poll(async () => page.evaluate((marca) => localStorage.getItem(marca), MARCA), { message: 'guardar deja el proyecto como guardado' }).toBe('0');

  avisos.length = 0;
  await page.reload({ timeout: 5000 }).catch(() => undefined);
  await page.waitForTimeout(800);
  expect(avisos, 'con el proyecto guardado no se pregunta').toEqual([]);
  await expect(page.locator('.vegas-toolbar')).toBeVisible();
});
