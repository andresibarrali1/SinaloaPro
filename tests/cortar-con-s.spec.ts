// Cortar con S tras seleccionar un clip: los clips de la línea de tiempo son botones, y una guarda que cedía el paso a
// «botones y deslizadores» dejaba el atajo S sin efecto. Ahora S (y el resto de atajos de edición) funcionan igual con
// el foco en el clip, en un medio o en la barra; el espacio del transporte ya se atiende aparte.
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const fixture = (name: string) => path.resolve('tests/fixtures', name);

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
  await page.waitForTimeout(600);
}

test('S corta el clip seleccionado (el clic deja el foco en el clip)', async ({ page }) => {
  await montar(page);
  const clip = page.locator('.timeline-event.video').first();
  const caja = (await clip.boundingBox())!;
  // Clic en la mitad del clip: lo selecciona y deja el cursor ahí.
  await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await expect(clip).toBeVisible();
  await expect
    .poll(async () => (await page.locator('.big-timecode').textContent()) ?? '', { timeout: 5000 })
    .not.toBe('00:00:00:00');
  await page.keyboard.press('s');
  await expect(page.locator('.timeline-event.video')).toHaveCount(2, { timeout: 10000 });
});

test('S corta también con el foco en el panel de medios', async ({ page }) => {
  await montar(page);
  const clip = page.locator('.timeline-event.video').first();
  const caja = (await clip.boundingBox())!;
  await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.locator('.media-item').first().click();
  await page.keyboard.press('s');
  await expect(page.locator('.timeline-event.video')).toHaveCount(2, { timeout: 10000 });
});

test('S no corta si el cursor está fuera de los clips seleccionados', async ({ page }) => {
  await montar(page);
  const clip = page.locator('.timeline-event.video').first();
  const caja = (await clip.boundingBox())!;
  // Selecciona el clip y luego lleva el cursor al principio: ahí no hay nada que cortar dentro del clip.
  await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.keyboard.press('Home');
  await page.keyboard.press('s');
  await page.waitForTimeout(300);
  await expect(page.locator('.timeline-event.video')).toHaveCount(1);
});
