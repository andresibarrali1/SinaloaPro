// Reproducción sin pausas al editar: cortar (S) o mover un evento mientras se reproduce **no** debe detener el monitor.
// Antes `edit()` llamaba a `pause()`; además, el bucle de reproducción dependía del proyecto y se reiniciaba con cada
// cambio. Para que la prueba sea estable se activa el bucle (Q), así la reproducción no termina por llegar al final.
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const fixture = (name: string) => path.resolve('tests/fixtures', name);

const barra = (page: Page) => page.locator('.vegas-toolbar');
const reproduciendo = async (page: Page) =>
  (await barra(page).getByRole('button', { name: 'Reproducir', exact: true }).getAttribute('aria-pressed')) === 'true';

// El reloj de la reproducción lo pone el audio: si el navegador lo suspende (política de gesto), no avanza nada.
const reloj = async (page: Page) => (await page.locator('.big-timecode').textContent()) ?? '';
const monitor = (page: Page) =>
  page
    .locator('canvas[aria-label="Composición del proyecto"]')
    .evaluate((nodo) => (nodo as HTMLCanvasElement).toDataURL().length);

async function montar(page: Page) {
  await page.goto('/?bienvenida=no');
  await expect(page.locator('.vegas-toolbar')).toBeVisible();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.vegas-toolbar')).toBeVisible();
  await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Video_A.mp4')]);
  await expect(page.locator('.media-item')).toHaveCount(1, { timeout: 60000 });
  await page.locator('.media-item').first().dblclick();
  await expect(page.locator('.timeline-event.video')).toHaveCount(1, { timeout: 20000 });
  await page.waitForTimeout(700);
  // Bucle: la reproducción no se para al llegar al final del proyecto.
  await page.keyboard.press('q');
  await barra(page).getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect.poll(() => reproduciendo(page), { timeout: 10000 }).toBe(true);
  await page.waitForTimeout(500);
}

test('cortar mientras se reproduce no detiene la previsualización', async ({ page }) => {
  await montar(page);
  expect(await monitor(page), 'el monitor tiene imagen').toBeGreaterThan(5000);
  const antes = await reloj(page);

  // Cortar usa el cursor de edición (como siempre); lo que se comprueba aquí es que la reproducción no se para.
  await page.keyboard.press('s');
  await page.waitForTimeout(150);

  expect(await reproduciendo(page), 'sigue reproduciendo tras pulsar S').toBe(true);
  await expect(barra(page).getByRole('button', { name: 'Pausa', exact: true })).toBeEnabled();
  await page.waitForTimeout(400);
  const despues = await reloj(page);
  expect(despues, 'el reloj sigue avanzando: la reproducción continúa').not.toBe(antes);
  expect(await reproduciendo(page), 'y sigue reproduciendo un momento después').toBe(true);
});

test('mover un evento mientras se reproduce no detiene la previsualización', async ({ page }) => {
  await montar(page);
  const fila = page.locator('.timeline-event.video').first();
  const caja = await fila.boundingBox();
  expect(caja, 'el evento tiene caja').not.toBeNull();
  const x = (caja?.x ?? 0) + (caja?.width ?? 0) / 2;
  const y = (caja?.y ?? 0) + (caja?.height ?? 0) / 2;

  const antes = await reloj(page);
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let paso = 1; paso <= 6; paso++) await page.mouse.move(x + paso * 14, y, { steps: 2 });
  await page.mouse.up();
  await page.waitForTimeout(400);

  expect(await reproduciendo(page), 'sigue reproduciendo tras mover').toBe(true);
  await expect(barra(page).getByRole('button', { name: 'Pausa', exact: true })).toBeEnabled();
  const despues = await reloj(page);
  expect(despues, 'el reloj no se congela').not.toBe(antes);
});
