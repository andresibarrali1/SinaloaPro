// Importar audio largo: antes, un archivo de más de ~11 minutos en estéreo 48 kHz se rechazaba con
// «El audio descomprimido excede el límite local de 256 MB». Ahora se reduce la frecuencia de muestreo lo justo y entra,
// con su onda y su audio en la línea de tiempo.
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const fixture = (name: string) => path.resolve('tests/fixtures', name);
const CLAVE = 'corte15-autosave-v1';

async function abrir(page: Page) {
  await page.goto('/?bienvenida=no');
  await expect(page.locator('.vegas-toolbar')).toBeVisible();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.vegas-toolbar')).toBeVisible();
}

test('un audio de 12 minutos se importa (antes fallaba por el tope de 256 MB)', async ({ page }) => {
  await abrir(page);
  await page.locator('input[type=file]').nth(0).setInputFiles([fixture('audio-largo.m4a')]);
  const medio = page.locator('.media-item').filter({ hasText: 'audio-largo.m4a' });
  await expect(medio).toHaveCount(1, { timeout: 120000 });
  // Ni el error viejo ni ningún otro aviso de fallo.
  await expect(page.getByText(/excede el límite local/)).toHaveCount(0);
  await expect(medio).toContainText('00:12:00', { timeout: 20000 });
  // Se puede montar en la línea de tiempo.
  await medio.dblclick();
  await expect(page.locator('.timeline-event.audio')).toHaveCount(1, { timeout: 30000 });
});

test('el audio largo se decodifica de verdad: tiene picos y onda guardada', async ({ page }) => {
  await abrir(page);
  await page.locator('input[type=file]').nth(0).setInputFiles([fixture('audio-largo.m4a')]);
  const medio = page.locator('.media-item').filter({ hasText: 'audio-largo.m4a' });
  await expect(medio).toHaveCount(1, { timeout: 120000 });
  await medio.dblclick();
  await expect(page.locator('.timeline-event.audio')).toHaveCount(1, { timeout: 30000 });

  // La copia automática guarda la ficha del medio con sus picos: si hay picos, se decodificaron muestras.
  await page.waitForFunction(
    (clave) => {
      const texto = localStorage.getItem(clave);
      if (!texto) return false;
      const proyecto = JSON.parse(texto) as { media?: { name?: string; peaks?: number[] }[] };
      const audio = proyecto.media?.find((m) => m.name === 'audio-largo.m4a');
      return Boolean(audio?.peaks && audio.peaks.length > 100);
    },
    CLAVE,
    { timeout: 120000 },
  );
  const picos = await page.evaluate((clave) => {
    const proyecto = JSON.parse(localStorage.getItem(clave) || '{}') as {
      media?: { name?: string; peaks?: number[]; channelPeaks?: number[][] }[];
    };
    const audio = proyecto.media?.find((m) => m.name === 'audio-largo.m4a');
    return { canales: audio?.peaks?.length ?? 0, canalesEstereo: audio?.channelPeaks?.length ?? 0 };
  }, CLAVE);
  expect(picos.canales).toBeGreaterThan(100);
  expect(picos.canalesEstereo).toBe(2);
});
