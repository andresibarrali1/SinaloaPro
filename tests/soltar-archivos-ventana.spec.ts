// Soltar archivos sobre la ventana funciona en cualquier sitio, no solo en la línea de tiempo o en la lista de medios.
// El caso que se reportó era la aplicación instalada: el archivo caía en un diálogo (que se dibuja en un portal fuera
// del editor) y no pasaba nada. Ahora la ventana entera atiende el soltado y avisa mientras se arrastra.
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const VIDEO = readFileSync('tests/fixtures/Video_A.mp4').toString('base64');

/** Suelta un archivo de verdad (DataTransfer con un File) sobre el punto central del elemento. */
async function soltarArchivo(page: Page, selector: string) {
  const caja = (await page.locator(selector).first().boundingBox())!;
  const x = Math.round(caja.x + caja.width / 2);
  const y = Math.round(caja.y + Math.min(40, caja.height / 2));
  await page.evaluate((base64) => {
    const binario = atob(base64);
    const datos = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) datos[i] = binario.charCodeAt(i);
    const transferencia = new DataTransfer();
    transferencia.items.add(new File([datos], 'Video_A.mp4', { type: 'video/mp4' }));
    (window as unknown as { __transferencia: DataTransfer }).__transferencia = transferencia;
  }, VIDEO);
  await page.evaluate(({ x, y }) => {
    const destino = document.elementFromPoint(x, y) ?? document.body;
    const transferencia = (window as unknown as { __transferencia: DataTransfer }).__transferencia;
    for (const tipo of ['dragenter', 'dragover', 'drop']) {
      destino.dispatchEvent(new DragEvent(tipo, { bubbles: true, cancelable: true, dataTransfer: transferencia, clientX: x, clientY: y }));
    }
  }, { x, y });
}

async function arrancar(page: Page, sufijo = '?bienvenida=no') {
  await page.goto(`/${sufijo}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.vegas-toolbar')).toBeVisible({ timeout: 20000 });
}

test('soltar un archivo sobre un diálogo abierto lo importa', async ({ page }) => {
  await arrancar(page);
  await page.locator('.menu-label', { hasText: 'Ayuda' }).click();
  await page.getByRole('menuitem', { name: /Funciones y atajos/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await soltarArchivo(page, '.editor-dialog');
  await expect(page.locator('.media-item'), 'el archivo entra aunque el diálogo esté encima').toHaveCount(1, { timeout: 60000 });
  await expect(page.locator('.statusbar [role=status]')).toContainText('importado');
});

test('soltar un archivo fuera de la línea de tiempo (la vista previa) también lo importa', async ({ page }) => {
  await arrancar(page);
  await soltarArchivo(page, '.preview-panel');
  await expect(page.locator('.media-item')).toHaveCount(1, { timeout: 60000 });
});

test('soltar sobre la bienvenida funciona y el arrastre se anuncia', async ({ page }) => {
  await arrancar(page, '');
  await expect(page.locator('.welcome-splash')).toBeVisible();
  // Durante el arrastre se avisa de que se pueden soltar los archivos.
  await page.evaluate(() => {
    const transferencia = new DataTransfer();
    transferencia.items.add(new File(['x'], 'x.mp4', { type: 'video/mp4' }));
    (window as unknown as { __transferencia: DataTransfer }).__transferencia = transferencia;
    const evento = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transferencia });
    document.body.dispatchEvent(evento);
  });
  await expect(page.locator('.drop-overlay')).toBeVisible();
  await soltarArchivo(page, '.welcome-card');
  await expect(page.locator('.media-item')).toHaveCount(1, { timeout: 60000 });
  await expect(page.locator('.drop-overlay')).toHaveCount(0);
});

test('la ventana cancela el arrastre para que el navegador no abra el archivo', async ({ page }) => {
  await arrancar(page);
  const cancelado = await page.evaluate(() => {
    const transferencia = new DataTransfer();
    transferencia.items.add(new File(['x'], 'x.mp4', { type: 'video/mp4' }));
    const evento = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transferencia });
    document.body.dispatchEvent(evento);
    return evento.defaultPrevented;
  });
  expect(cancelado, 'el dragover se cancela en toda la ventana').toBe(true);
});
