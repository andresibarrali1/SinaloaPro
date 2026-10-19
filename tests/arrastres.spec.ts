// Arrastrar y soltar sobre la línea de tiempo: medios (que crean la pista que falte) y transiciones en los
// bordes de un clip. Los arrastres se hacen con eventos de «arrastrar y soltar» de verdad (DataTransfer), así
// que se ejecuta el mismo código que con el ratón.
import { test, expect, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const fixture = (name: string) => path.resolve('tests/fixtures', name);
const CLAVE = 'corte15-autosave-v1';

type Guardado = {
  tracks?: { id: string; kind: string }[];
  media?: { id: string; name: string }[];
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

/** DataTransfer con un archivo real del disco: es lo que entrega el explorador de Windows al arrastrar. */
async function dataTransferConArchivo(page: Page, relativa: string, tipo: string) {
  const bytes = [...readFileSync(path.resolve(relativa))];
  return page.evaluateHandle(
    ({ bytes: contenido, nombre, tipo: mime }) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File([new Uint8Array(contenido)], nombre, { type: mime }));
      return dataTransfer;
    },
    { bytes, nombre: path.basename(relativa), tipo },
  );
}

test('arrastrar un archivo del explorador a la línea de tiempo lo importa y lo coloca en ese punto', async ({ page }) => {
  await nuevaSesion(page);

  // Sin pista de audio, para comprobar de paso que también se crea la que falta.
  await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Audio.wav')]);
  await expect(page.locator('.media-item')).toHaveCount(1, { timeout: 60000 });
  await page.locator('.media-item').filter({ hasText: 'Audio.wav' }).dblclick();
  await expect(page.locator('.timeline-event.audio').first()).toBeVisible();
  const encabezado = page.locator('#track-headers .track-header').filter({ hasText: 'Audio' });
  await encabezado.click({ button: 'right' });
  await page.getByRole('menuitem', { name: /Eliminar pista/ }).click();
  await esperarProyecto(page, (valor) => !(valor.tracks ?? []).some((pista) => pista.kind === 'audio'), 'sin pista de audio');
  // Se vacía la línea de tiempo para que el archivo que se suelta sea el único medio.
  await page.locator('.media-item').filter({ hasText: 'Audio.wav' }).click();
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);
  const caja = (await page.locator('.timeline-content').boundingBox())!;
  const destinoX = caja.x + 200;
  const destinoY = caja.y + 60;

  const dataTransfer = await dataTransferConArchivo(page, 'tests/fixtures/Audio.wav', 'audio/wav');
  await page.locator('.timeline-content').dispatchEvent('dragover', { dataTransfer, clientX: destinoX, clientY: destinoY });
  await page.locator('.timeline-content').dispatchEvent('drop', { dataTransfer, clientX: destinoX, clientY: destinoY });

  await expect(page.locator('.media-item')).toHaveCount(1, { timeout: 60000 });
  const proyecto = await esperarProyecto(
    page,
    (valor) => (valor.events ?? []).some((evento) => evento.kind === 'audio' && evento.start > 0),
    'el archivo suelto se importa y se coloca en el punto donde se soltó',
  );
  const pistaAudio = (proyecto.tracks ?? []).find((pista) => pista.kind === 'audio');
  expect(pistaAudio, 'la pista de audio se crea al soltar el archivo').toBeTruthy();
  const evento = (proyecto.events ?? []).find((otro) => otro.kind === 'audio')!;
  expect(evento.trackId).toBe(pistaAudio!.id);
  expect(evento.start, 'el clip empieza donde se soltó, no en cero').toBeGreaterThan(0);
  await expect(page.locator('.timeline-event.audio').first()).toBeVisible();
});

test('arrastrar un archivo al panel de medios solo lo importa, sin colocarlo', async ({ page }) => {
  await nuevaSesion(page);
  const destino = page.locator('.media-grid');
  const caja = (await destino.boundingBox())!;
  const dataTransfer = await dataTransferConArchivo(page, 'tests/fixtures/Video_A.mp4', 'video/mp4');
  await destino.dispatchEvent('dragover', { dataTransfer, clientX: caja.x + 10, clientY: caja.y + 10 });
  await destino.dispatchEvent('drop', { dataTransfer, clientX: caja.x + 10, clientY: caja.y + 10 });

  await expect(page.locator('.media-item')).toHaveCount(1, { timeout: 60000 });
  await page.waitForTimeout(1200);
  const proyecto = await proyectoGuardado(page);
  expect((proyecto?.media ?? []).length, 'el medio se importa').toBe(1);
  expect((proyecto?.events ?? []).length, 'pero no se coloca ningún clip').toBe(0);
});
test('soltar un archivo donde no hay pista (encabezados o proyecto vacío) crea la pista y coloca el clip', async ({ page }) => {
  await nuevaSesion(page);

  // 1) Sobre el encabezado de una pista: el clip va a esa pista y el medio se importa.
  const encabezadoVideo = page.locator('#track-headers .track-header.video').first();
  const cajaEncabezado = (await encabezadoVideo.boundingBox())!;
  const dataTransfer1 = await dataTransferConArchivo(page, 'tests/fixtures/Video_A.mp4', 'video/mp4');
  await encabezadoVideo.dispatchEvent('dragover', {
    dataTransfer: dataTransfer1,
    clientX: cajaEncabezado.x + 40,
    clientY: cajaEncabezado.y + 20,
  });
  await encabezadoVideo.dispatchEvent('drop', {
    dataTransfer: dataTransfer1,
    clientX: cajaEncabezado.x + 40,
    clientY: cajaEncabezado.y + 20,
  });
  await expect(page.locator('.media-item')).toHaveCount(1, { timeout: 60000 });
  const trasEncabezado = await esperarProyecto(
    page,
    (valor) => (valor.events ?? []).length > 0,
    'el archivo soltado sobre el encabezado se coloca en la línea de tiempo',
  );
  expect((trasEncabezado.tracks ?? []).length, 'no hizo falta crear pista: ya había una').toBe(3);

  // 2) Proyecto sin ninguna pista: se suelta en el hueco del contenedor con scroll, fuera del contenido.
  for (let intento = 0; intento < 4; intento++) {
    if ((await page.locator('#track-headers .track-header').count()) === 0) break;
    await page.locator('#track-headers .track-header').first().click({ button: 'right' });
    await page.getByRole('menuitem', { name: /Eliminar pista/ }).click();
    await page.waitForTimeout(400);
  }
  await esperarProyecto(page, (valor) => (valor.tracks ?? []).length === 0, 'el proyecto se queda sin pistas');

  const cajaScroll = (await page.locator('.timeline-scroll').boundingBox())!;
  const dataTransfer2 = await dataTransferConArchivo(page, 'tests/fixtures/Video_A.mp4', 'video/mp4');
  const destino = { clientX: cajaScroll.x + 260, clientY: cajaScroll.y + 90 };
  await page.locator('.timeline-scroll').dispatchEvent('dragover', { dataTransfer: dataTransfer2, ...destino });
  await page.locator('.timeline-scroll').dispatchEvent('drop', { dataTransfer: dataTransfer2, ...destino });

  const proyecto = await esperarProyecto(
    page,
    (valor) => (valor.tracks ?? []).length > 0 && (valor.events ?? []).length > 0,
    'sin pistas, soltar el archivo crea las pistas y coloca el clip',
  );
  const pistas = proyecto.tracks ?? [];
  expect(pistas.length, 'se crean las pistas que el material necesita').toBeGreaterThan(0);
  expect(pistas.some((pista) => pista.kind === 'video'), 'hay una pista de vídeo').toBe(true);
  const evento = (proyecto.events ?? []).find((otro) => otro.kind === 'video')!;
  expect(evento).toBeTruthy();
  const pistaDelClip = pistas.find((pista) => pista.id === evento.trackId)!;
  expect(pistaDelClip.kind, 'el clip cae en una pista de vídeo').toBe('video');
});

test('soltar fuera de las pistas (hueco de abajo o regla) crea una pista nueva del tipo del material', async ({ page }) => {
  await nuevaSesion(page);

  // Proyecto de partida: las tres pistas por defecto (dos de vídeo y una de audio).
  const inicial = await esperarProyecto(page, (valor) => (valor.tracks ?? []).length === 3, 'el proyecto arranca con tres pistas');
  expect(inicial.tracks ?? []).toHaveLength(3);

  // 1) Un audio soltado en el hueco por debajo de todas las pistas: pista de audio nueva.
  const contenido = (await page.locator('.timeline-content').boundingBox())!;
  const destinoAudio = { clientX: contenido.x + 300, clientY: contenido.y + contenido.height - 6 };
  const transferenciaAudio = await dataTransferConArchivo(page, 'tests/fixtures/Audio.wav', 'audio/wav');
  await page.locator('.timeline-content').dispatchEvent('dragover', { dataTransfer: transferenciaAudio, ...destinoAudio });
  await page.locator('.timeline-content').dispatchEvent('drop', { dataTransfer: transferenciaAudio, ...destinoAudio });

  const conAudio = await esperarProyecto(
    page,
    (valor) => (valor.tracks ?? []).length === 4,
    'soltar un audio fuera de las pistas crea una pista de audio',
  );
  const pistasAudio = (conAudio.tracks ?? []).filter((pista) => pista.kind === 'audio');
  expect(pistasAudio.length, 'queda una pista de audio más que la que había').toBe(2);
  const clipAudio = (conAudio.events ?? []).find((evento) => evento.kind === 'audio')!;
  const pistaNueva = pistasAudio.find((pista) => pista.id === clipAudio.trackId);
  expect(pistaNueva, 'el clip va a la pista recién creada').toBeTruthy();
  expect(pistaNueva!.id, 'y no a la pista de audio que ya existía').not.toBe(inicial.tracks!.find((pista) => pista.kind === 'audio')!.id);

  // 2) Un vídeo soltado sobre la regla: pista de vídeo nueva.
  const regla = (await page.locator('.ruler').boundingBox())!;
  const transferenciaVideo = await dataTransferConArchivo(page, 'tests/fixtures/Video_A.mp4', 'video/mp4');
  const destinoVideo = { clientX: regla.x + 420, clientY: regla.y + 10 };
  await page.locator('.ruler').dispatchEvent('dragover', { dataTransfer: transferenciaVideo, ...destinoVideo });
  await page.locator('.ruler').dispatchEvent('drop', { dataTransfer: transferenciaVideo, ...destinoVideo });

  const conVideo = await esperarProyecto(
    page,
    (valor) => (valor.tracks ?? []).length === 5,
    'soltar un vídeo sobre la regla crea una pista de vídeo',
  );
  const pistasVideo = (conVideo.tracks ?? []).filter((pista) => pista.kind === 'video');
  expect(pistasVideo.length, 'queda una pista de vídeo más').toBe(3);
  const clipVideo = (conVideo.events ?? []).find((evento) => evento.kind === 'video')!;
  const pistaDelClip = pistasVideo.find((pista) => pista.id === clipVideo.trackId)!;
  expect(pistaDelClip, 'el clip cae en una pista de vídeo').toBeTruthy();
  expect(pistaDelClip.id, 'y no en las dos pistas de vídeo que ya había').not.toBe(inicial.tracks![0].id);
});
