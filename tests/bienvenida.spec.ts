// Ventana de bienvenida de Sinaloa Pro: sale al arrancar y al crear un proyecto nuevo, y se quita sola a los 4
// segundos o al pulsar la X (también con Escape). Con `?bienvenida=no` no se muestra, que es lo que usan el resto de
// pruebas para no tapar la interfaz.
import { test, expect, type Page } from '@playwright/test';

const BIENVENIDA = '.welcome-splash';

async function arrancar(page: Page, sufijo = '') {
  await page.goto(`/${sufijo}`);
  await expect(page.locator('.vegas-toolbar')).toBeVisible({ timeout: 20000 });
}

test('al abrir el editor sale la bienvenida con el nombre, la licencia y la firma', async ({ page }) => {
  await arrancar(page);
  const bienvenida = page.locator(BIENVENIDA);
  await expect(bienvenida).toBeVisible();
  await expect(bienvenida).toContainText('Sinaloa Pro');
  await expect(bienvenida).toContainText('gratuito');
  await expect(bienvenida).toContainText('código abierto');
  await expect(bienvenida).toContainText('Hecho con cariño de parte de @andresibarrali');
  // Se va sola: no hace falta tocar nada.
  await expect(bienvenida, 'la bienvenida se cierra sola a los 7 segundos').toHaveCount(0, { timeout: 12000 });
});

test('la X de la esquina la cierra al momento', async ({ page }) => {
  await arrancar(page);
  await expect(page.locator(BIENVENIDA)).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar la bienvenida' }).click();
  await expect(page.locator(BIENVENIDA)).toHaveCount(0);
  // Y no vuelve a salir hasta que se cree otro proyecto.
  await page.waitForTimeout(1200);
  await expect(page.locator(BIENVENIDA)).toHaveCount(0);
});

test('Escape también la cierra', async ({ page }) => {
  await arrancar(page);
  await expect(page.locator(BIENVENIDA)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator(BIENVENIDA)).toHaveCount(0);
});

test('crear un proyecto nuevo vuelve a mostrar la bienvenida', async ({ page }) => {
  await arrancar(page);
  await expect(page.locator(BIENVENIDA)).toHaveCount(0, { timeout: 12000 });
  await page.getByRole('button', { name: 'Nuevo proyecto', exact: true }).first().click();
  await page.getByRole('button', { name: 'Crear proyecto vacío' }).click();
  await expect(page.locator(BIENVENIDA)).toBeVisible();
  await expect(page.locator('.statusbar [role=status]')).toBeVisible();
});

test('con ?bienvenida=no no aparece', async ({ page }) => {
  await arrancar(page, '?bienvenida=no');
  await page.waitForTimeout(1200);
  await expect(page.locator(BIENVENIDA)).toHaveCount(0);
});
