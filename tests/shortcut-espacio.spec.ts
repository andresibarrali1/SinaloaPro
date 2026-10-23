// La barra espaciadora tiene que reproducir y pausar **siempre**, sin importar dónde esté el foco: sobre un medio de la
// biblioteca (que es un botón), sobre un clip de la línea de tiempo, sobre un botón de la barra o sobre un deslizador.
// Antes, si el foco estaba en un botón o en un clip, el manejador cedía el paso y el espacio activaba ese botón (o no
// hacía nada), así que el atajo «a veces» fallaba. Lo que no debe cambiar: escribiendo en un campo, el espacio es un
// espacio.
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const fixture = (name: string) => path.resolve('tests/fixtures', name);
const barra = (page: Page) => page.locator('.vegas-toolbar');
const reproduciendo = async (page: Page) =>
  (await barra(page).getByRole('button', { name: 'Reproducir', exact: true }).getAttribute('aria-pressed')) === 'true';

async function montar(page: Page) {
  await page.goto('/?bienvenida=no');
  await expect(page.locator('.vegas-toolbar')).toBeVisible();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.vegas-toolbar')).toBeVisible();
  await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Video_A.mp4'), fixture('Audio.wav')]);
  await expect(page.locator('.media-item')).toHaveCount(2, { timeout: 60000 });
  await page.locator('.media-item').first().dblclick();
  await expect(page.locator('.timeline-event.video')).toHaveCount(1, { timeout: 20000 });
  await page.waitForTimeout(500);
}

/** Pulsa espacio y comprueba que alterna: primero reproduce y luego pausa (un solo cambio por pulsación). */
async function alternaConEspacio(page: Page) {
  await page.keyboard.press('Space');
  await expect.poll(() => reproduciendo(page), { timeout: 10000 }).toBe(true);
  await page.keyboard.press('Space');
  await expect.poll(() => reproduciendo(page), { timeout: 10000 }).toBe(false);
}

test('espacio funciona con el foco en un medio de la biblioteca', async ({ page }) => {
  await montar(page);
  await page.locator('.media-item').first().click();
  await expect(page.locator('.media-item').first()).toBeFocused();
  await alternaConEspacio(page);
});

test('espacio funciona con el foco en un clip de la línea de tiempo', async ({ page }) => {
  await montar(page);
  await page.locator('.timeline-event.video').first().click();
  await alternaConEspacio(page);
});

test('espacio funciona con el foco en un botón de la barra (y no activa dos veces)', async ({ page }) => {
  await montar(page);
  // El botón de reproducir arranca la reproducción al pulsarlo con el ratón…
  await barra(page).getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect.poll(() => reproduciendo(page), { timeout: 10000 }).toBe(true);
  // …y el espacio debe **pausar** (un solo cambio), no activar otra vez el botón y reactivar la reproducción.
  await page.keyboard.press('Space');
  await expect.poll(() => reproduciendo(page), { timeout: 10000 }).toBe(false);
  await page.keyboard.press('Space');
  await expect.poll(() => reproduciendo(page), { timeout: 10000 }).toBe(true);
});

test('espacio funciona con el foco en un deslizador', async ({ page }) => {
  await montar(page);
  const deslizador = page.locator('.timeline-section [role=slider], .vegas-toolbar [role=slider]').first();
  await deslizador.focus();
  await alternaConEspacio(page);
});

test('escribiendo en un campo el espacio escribe, no reproduce', async ({ page }) => {
  await montar(page);
  const buscador = page.getByPlaceholder(/Buscar medios/i).first();
  await buscador.click();
  await buscador.pressSequentially('vo');
  await page.keyboard.press('Space');
  await page.waitForTimeout(250);
  expect(await buscador.inputValue(), 'el espacio llega al campo').toBe('vo ');
  expect(await reproduciendo(page), 'y no arranca la reproducción').toBe(false);
});
