// Aplicación instalable en el escritorio: manifiesto, iconos, service worker y el botón «Instalar» del editor. Lo que
// no se puede automatizar aquí es el diálogo nativo del navegador ni la ventana ya instalada; eso se midió con el
// propio Chrome (CDP `Page.getInstallabilityErrors`) y con una ventana `--app`, como queda en VERIFICACION.md.
import { test, expect, type Page } from '@playwright/test';

const arrancar = async (page: Page) => {
  // El aviso real del navegador se descarta antes de que la aplicación lo escuche, para poder simularlo con un doble
  // que no abre el diálogo nativo.
  await page.addInitScript(() => {
    window.addEventListener(
      'beforeinstallprompt',
      (evento) => {
        // El doble que trae la prueba se marca para que no se lo coma este filtro.
        if ((evento as unknown as { __sintetico?: boolean }).__sintetico) return;
        evento.preventDefault();
        evento.stopImmediatePropagation();
      },
      true,
    );
  });
  await page.goto('/?bienvenida=no');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.vegas-toolbar')).toBeVisible();
};

test('el manifiesto declara la aplicación instalable y sus iconos existen', async ({ page, request }) => {
  await arrancar(page);
  const enlace = page.locator('link[rel="manifest"]');
  await expect(enlace).toHaveAttribute('href', '/manifest.webmanifest');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#252b30');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);

  const respuesta = await request.get('/manifest.webmanifest');
  expect(respuesta.status(), 'el manifiesto se sirve').toBe(200);
  const manifiesto = (await respuesta.json()) as { name: string; short_name: string; display: string; start_url: string; icons: { src: string; sizes: string; purpose?: string }[] };
  expect(manifiesto.name).toContain('Sinaloa Pro');
  expect(manifiesto.display, 'la ventana instalada no lleva barras del navegador').toBe('standalone');
  expect(manifiesto.start_url).toBe('/');
  const tamanos = manifiesto.icons.map((icono) => `${icono.sizes}:${icono.purpose ?? 'any'}`);
  expect(tamanos, 'Chrome pide 192 y 512, y conviene el maskable').toEqual(expect.arrayContaining(['192x192:any', '512x512:any', '512x512:maskable']));
  for (const icono of manifiesto.icons) {
    const iconoRespuesta = await request.get(icono.src);
    expect(iconoRespuesta.status(), `el icono ${icono.src} existe`).toBe(200);
    expect(iconoRespuesta.headers()['content-type']).toContain('image/png');
  }
});

test('el service worker queda registrado y controla la aplicación', async ({ page }) => {
  await arrancar(page);
  const registro = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return null;
    const listo = await navigator.serviceWorker.ready;
    return { activo: Boolean(listo.active), alcance: listo.scope };
  });
  expect(registro, 'el navegador tiene service workers').not.toBeNull();
  expect(registro!.activo, 'el service worker está activo').toBe(true);
  expect(registro!.alcance).toContain('/');
  await page.reload();
  await page.waitForSelector('.vegas-toolbar');
  await expect.poll(async () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { message: 'tras recargar, la página la controla el service worker' }).toBe(true);
});

test('el botón «Instalar» abre el diálogo del navegador y celebra la instalación', async ({ page }) => {
  await arrancar(page);
  const boton = page.locator('button[aria-label^="Instalar Sinaloa Pro"]');
  await expect(boton).toBeVisible();
  await expect(boton).toHaveAttribute('title', /ventana propia/);

  // Sin oferta del navegador, el botón explica dónde está la instalación en vez de no hacer nada.
  await boton.click();
  await expect(page.locator('.statusbar [role=status]')).toContainText('todavía no ofrece la instalación');

  // Mientras el navegador no ofrece la instalación, el botón no se destaca.
  await expect(page.locator('[data-instalable="true"]')).toHaveCount(0);
  // Con la oferta capturada, el botón se destaca (la opción de instalar se ve) y abre el diálogo del navegador.
  await page.evaluate(() => {
    const evento = new Event('beforeinstallprompt');
    Object.assign(evento, {
      prompt: async () => {
        (window as unknown as { __preguntada: boolean }).__preguntada = true;
      },
      userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
      __sintetico: true,
    });
    window.dispatchEvent(evento);
  });
  await expect(page.locator('[data-instalable="true"]'), 'el botón se destaca al haber oferta de instalación').toHaveCount(1);
  await boton.click();
  await expect.poll(async () => page.evaluate(() => Boolean((window as unknown as { __preguntada?: boolean }).__preguntada)), { message: 'se llamó al diálogo del navegador' }).toBe(true);
  await expect(page.locator('.statusbar [role=status]')).toContainText('canceló');

  // Instalada: el aviso `appinstalled` deja el botón en verde y con el rótulo de «ya instalado».
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(page.locator('button[aria-label^="Sinaloa Pro ya está instalado"]')).toBeVisible();
  await expect(page.locator('button[aria-label^="Sinaloa Pro ya está instalado"]')).toHaveAttribute('aria-pressed', 'true');
});
