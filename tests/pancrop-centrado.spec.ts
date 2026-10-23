// La ventana de Pan/Crop (Panoramización y recorte) tiene que abrirse **centrada y entera** en pantalla. Se coloca
// centrada desde el componente, pero el diálogo flotante del editor lleva las utilidades de Tailwind que lo centran
// con `translate(-50%, -50%)`; si esa traslación no se anula, la ventana aparece desplazada media pantalla (era el
// caso: se veía arriba a la izquierda, cortada). Esta prueba comprueba las dos cosas: que no hay traslación y que la
// ventana cae en el centro del hueco visible.
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const fixture = (name: string) => path.resolve('tests/fixtures', name);

async function abrirPanCrop(page: Page) {
  await page.goto('/?bienvenida=no');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.vegas-toolbar')).toBeVisible();
  await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Video_A.mp4')]);
  await expect(page.locator('.media-item')).toHaveCount(1, { timeout: 60000 });
  await page.locator('.media-item').filter({ hasText: 'Video_A.mp4' }).dblclick();
  await expect(page.locator('.timeline-event.video')).toHaveCount(1, { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.locator('.timeline-event.video').first().click();
  await page.getByRole('button', { name: 'Herramientas', exact: true }).click();
  await page.getByRole('menuitem', { name: /Panoramizaci/ }).first().click();
  await expect(page.locator('.ec-window')).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(400);
}

/** Mide la ventana y el diálogo flotante: centrada, dentro de la pantalla y sin traslación heredada. */
async function medir(page: Page) {
  return page.evaluate(() => {
    const ventana = document.querySelector<HTMLElement>('.ec-window')!;
    const dialogo = document.querySelector<HTMLElement>('.editor-dialog')!;
    const caja = ventana.getBoundingClientRect();
    const estilo = getComputedStyle(dialogo);
    return {
      x: caja.x,
      y: caja.y,
      ancho: caja.width,
      alto: caja.height,
      viewportAncho: window.innerWidth,
      viewportAlto: window.innerHeight,
      translate: estilo.translate,
      escalaX: estilo.getPropertyValue('--tw-translate-x').trim(),
      escalaY: estilo.getPropertyValue('--tw-translate-y').trim(),
    };
  });
}

test('Pan/Crop se abre centrada, entera y sin la traslación del diálogo', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 940 });
  await abrirPanCrop(page);
  const medida = await medir(page);
  // Sin traslación: es lo que se rompía al minificar el CSS (la ventana salía media pantalla arriba/izquierda).
  expect(medida.translate === 'none' || medida.translate === '0px', `el diálogo no debe estar trasladado (${medida.translate})`).toBe(true);
  expect(medida.escalaX === '0px' || medida.escalaX === '0', `la traslación horizontal del diálogo está anulada (${medida.escalaX})`).toBe(true);
  expect(medida.escalaY === '0px' || medida.escalaY === '0', `la traslación vertical del diálogo está anulada (${medida.escalaY})`).toBe(true);
  // Centrada en el hueco visible, con un par de píxeles de margen.
  expect(Math.abs(medida.x - (medida.viewportAncho - medida.ancho) / 2), 'centrada en horizontal').toBeLessThanOrEqual(4);
  expect(Math.abs(medida.y - (medida.viewportAlto - medida.alto) / 2), 'centrada en vertical').toBeLessThanOrEqual(4);
  // Y entera dentro de la pantalla.
  expect(medida.x).toBeGreaterThanOrEqual(0);
  expect(medida.y).toBeGreaterThanOrEqual(0);
  expect(medida.x + medida.ancho).toBeLessThanOrEqual(medida.viewportAncho);
  expect(medida.y + medida.alto).toBeLessThanOrEqual(medida.viewportAlto);
});

test('la ventana sigue centrada al abrirla en una pantalla más pequeña', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 700 });
  await abrirPanCrop(page);
  const medida = await medir(page);
  expect(Math.abs(medida.x - (medida.viewportAncho - medida.ancho) / 2), 'centrada en horizontal').toBeLessThanOrEqual(4);
  expect(Math.abs(medida.y - (medida.viewportAlto - medida.alto) / 2), 'centrada en vertical').toBeLessThanOrEqual(4);
  expect(medida.x + medida.ancho, 'cabe a lo ancho').toBeLessThanOrEqual(medida.viewportAncho);
  expect(medida.y + medida.alto, 'cabe a lo alto').toBeLessThanOrEqual(medida.viewportAlto);
});
