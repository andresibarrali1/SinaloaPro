// Arrastrar y soltar sobre la línea de tiempo: medios (que crean la pista que falte) y transiciones en los
// bordes de un clip. Los arrastres se hacen con eventos de «arrastrar y soltar» de verdad (DataTransfer), así
// que se ejecuta el mismo código que con el ratón.
import { test, expect, type Locator, type Page } from '@playwright/test';
import path from 'node:path';

const fixture = (name: string) => path.resolve('tests/fixtures', name);
const CLAVE = 'corte15-autosave-v1';

type Guardado = {
  tracks?: { id: string; kind: string }[];
  events?: { name: string; start: number; kind: string; trackId: string; transition?: string; transitionOut?: string; fadeIn: number; fadeOut: number }[];
};

/** Proyecto autoguardado, o `null` si todavía no hay ninguno. */
async function proyectoGuardado(page: Page): Promise<Guardado | null> {
  const texto = await page.evaluate((clave) => localStorage.getItem(clave), CLAVE);
  if (!texto) return null;
  try {
    return JSON.parse(texto) as Guardado;
  } catch {
    return null;
  }
}

/** Espera a que el autoguardado cumpla una condición (el autoguardado tarda 450 ms). */
async function esperarProyecto(page: Page, comprobar: (proyecto: Guardado) => boolean, mensaje: string) {
  await expect
    .poll(
      async () => {
        const proyecto = await proyectoGuardado(page);
        return proyecto ? comprobar(proyecto) : false;
      },
      { message: mensaje, timeout: 20000 },
    )
    .toBe(true);
  const proyecto = await proyectoGuardado(page);
  if (!proyecto) throw new Error(`sin proyecto guardado después de: ${mensaje}`);
  return proyecto;
}

async function nuevaSesion(page: Page) {
  await page.goto('/');
  await page.evaluate((clave) => {
    localStorage.clear();
    void clave;
  }, CLAVE);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Nuevo proyecto', exact: true })).toBeVisible();
}

/** Arrastra de verdad: `dragstart` en el origen (que fija el dato) y `dragover` + `drop` en el destino. */
async function arrastrar(page: Page, origen: Locator, destino: Locator, clientX: number, clientY: number) {
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await origen.dispatchEvent('dragstart', { dataTransfer });
  await destino.dispatchEvent('dragover', { dataTransfer, clientX, clientY });
  await destino.dispatchEvent('drop', { dataTransfer, clientX, clientY });
}

test('soltar un medio crea la pista que falta y lo inserta en ella', async ({ page }) => {
  await nuevaSesion(page);
  await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Audio.wav')]);
  await expect(page.locator('.media-item')).toHaveCount(1, { timeout: 60000 });
  await page.locator('.media-item').filter({ hasText: 'Audio.wav' }).dblclick();
  await expect(page.locator('.timeline-event.audio').first()).toBeVisible();

  // Se quita la pista de audio desde el menú del encabezado: el proyecto se queda sin pistas de audio.
  const encabezado = page.locator('#track-headers .track-header').filter({ hasText: 'Audio' });
  await encabezado.click({ button: 'right' });
  await page.getByRole('menuitem', { name: /Eliminar pista/ }).click();
  await expect(page.locator('.timeline-event.audio')).toHaveCount(0);
  const sinAudio = await esperarProyecto(
    page,
    (proyecto) => !(proyecto.tracks ?? []).some((pista) => pista.kind === 'audio'),
    'el proyecto se queda sin pistas de audio',
  );
  expect((sinAudio.tracks ?? []).length).toBe(2);

  // Se suelta el audio sobre la línea de tiempo: tiene que aparecer la pista y el clip dentro.
  const contenido = page.locator('.timeline-content');
  const caja = (await contenido.boundingBox())!;
  await arrastrar(page, page.locator('.media-item').filter({ hasText: 'Audio.wav' }), contenido, caja.x + 120, caja.y + 40);

  const conAudio = await esperarProyecto(
    page,
    (proyecto) => (proyecto.tracks ?? []).some((pista) => pista.kind === 'audio'),
    'la pista de audio se crea al soltar el medio',
  );
  const pistaAudio = (conAudio.tracks ?? []).find((pista) => pista.kind === 'audio')!;
  const enLaPista = (conAudio.events ?? []).filter((evento) => evento.trackId === pistaAudio.id);
  expect(enLaPista.length, 'el audio se inserta en la pista creada').toBe(1);
  expect(enLaPista[0].kind).toBe('audio');
  expect(enLaPista[0].name).toBe('Audio.wav');
  await expect(page.locator('.timeline-event.audio').first()).toBeVisible();
});

test('soltar una transición en la mitad izquierda la pone como entrada del clip', async ({ page }) => {
  await nuevaSesion(page);
  await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Video_A.mp4')]);
  await expect(page.locator('.media-item')).toHaveCount(1, { timeout: 60000 });
  await page.locator('.media-item').filter({ hasText: 'Video_A.mp4' }).dblclick();
  const clip = page.locator('.timeline-event.video').first();
  await expect(clip).toBeVisible();

  await page.getByRole('tab', { name: 'Transiciones' }).click();
  const transicion = page.getByRole('button', { name: 'Fundido lineal', exact: true });
  const cajaClip = (await clip.boundingBox())!;
  const cajaCarril = (await page.locator('.track-lane.video').first().boundingBox())!;
  await arrastrar(
    page,
    transicion,
    page.locator('.track-lane.video').first(),
    cajaClip.x + cajaClip.width * 0.25,
    cajaCarril.y + cajaCarril.height / 2,
  );

  const proyecto = await esperarProyecto(
    page,
    (valor) => Boolean((valor.events ?? [])[0]?.transition),
    'la transición de entrada llega al proyecto',
  );
  const evento = (proyecto.events ?? [])[0];
  expect(evento.transition).toBe('dissolve-linear');
  expect(Number(evento.fadeIn)).toBeGreaterThan(0);
  expect(evento.transitionOut, 'la salida no se toca').toBeUndefined();
});

test('soltar una transición en la mitad derecha sin vecino la pone como salida del clip', async ({ page }) => {
  await nuevaSesion(page);
  await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Video_A.mp4')]);
  await expect(page.locator('.media-item')).toHaveCount(1, { timeout: 60000 });
  await page.locator('.media-item').filter({ hasText: 'Video_A.mp4' }).dblclick();
  const clip = page.locator('.timeline-event.video').first();
  await expect(clip).toBeVisible();

  await page.getByRole('tab', { name: 'Transiciones' }).click();
  const transicion = page.getByRole('button', { name: 'Barrido de entrada desde la izquierda', exact: true });
  const cajaClip = (await clip.boundingBox())!;
  const cajaCarril = (await page.locator('.track-lane.video').first().boundingBox())!;
  await arrastrar(
    page,
    transicion,
    page.locator('.track-lane.video').first(),
    cajaClip.x + cajaClip.width * 0.8,
    cajaCarril.y + cajaCarril.height / 2,
  );

  const proyecto = await esperarProyecto(
    page,
    (valor) => Boolean((valor.events ?? [])[0]?.transitionOut),
    'la transición de salida llega al proyecto',
  );
  const evento = (proyecto.events ?? [])[0];
  expect(evento.transitionOut).toBe('wipe-from-left');
  expect(Number(evento.fadeOut)).toBeGreaterThan(0);
  expect(evento.transition, 'la entrada no se toca').toBeUndefined();
});

test('soltar una transición en el borde derecho con otro clip pegado usa el corte', async ({ page }) => {
  await nuevaSesion(page);
  await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Video_A.mp4')]);
  await expect(page.locator('.media-item')).toHaveCount(1, { timeout: 60000 });
  await page.locator('.media-item').filter({ hasText: 'Video_A.mp4' }).dblclick();
  const primero = page.locator('.timeline-event.video').first();
  await expect(primero).toBeVisible();

  // Se coloca el cursor al final del primer clip y se inserta otro: quedan pegados, formando un corte.
  const cajaPrimero = (await primero.boundingBox())!;
  const cajaRegla = (await page.locator('.ruler').boundingBox())!;
  await page.mouse.click(cajaPrimero.x + cajaPrimero.width, cajaRegla.y + cajaRegla.height / 2);
  await page.locator('.media-item').filter({ hasText: 'Video_A.mp4' }).dblclick();
  await expect(page.locator('.timeline-event.video')).toHaveCount(2);
  await esperarProyecto(page, (valor) => (valor.events ?? []).filter((evento) => evento.kind === 'video').length === 2, 'el segundo clip entra en el proyecto');

  await page.getByRole('tab', { name: 'Transiciones' }).click();
  const transicion = page.getByRole('button', { name: 'Fundido lineal', exact: true });
  const cajaCarril = (await page.locator('.track-lane.video').first().boundingBox())!;
  await arrastrar(
    page,
    transicion,
    page.locator('.track-lane.video').first(),
    cajaPrimero.x + cajaPrimero.width - 2,
    cajaCarril.y + cajaCarril.height / 2,
  );

  const proyecto = await esperarProyecto(
    page,
    (valor) => (valor.events ?? []).some((evento) => evento.transition === 'dissolve-linear'),
    'la transición del corte llega al proyecto',
  );
  // Sólo los clips de vídeo: la misma inserción puede traer también el audio enlazado.
  const eventos = (proyecto.events ?? []).filter((evento) => evento.kind === 'video').sort((a, b) => a.start - b.start);
  expect(eventos.length).toBe(2);
  expect(eventos[0].transition, 'el primero no lleva transición de entrada').toBeUndefined();
  expect(eventos[0].transitionOut, 'el primero tampoco lleva salida').toBeUndefined();
  expect(eventos[1].transition, 'la transición va en la entrada del segundo').toBe('dissolve-linear');
});
