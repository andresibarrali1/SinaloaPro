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
  events?: { id: string; name: string; start: number; kind: string; trackId: string; transition?: string; transitionOut?: string; fadeIn: number; fadeOut: number }[];
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

test('arrastrar un evento fuera de las pistas (abajo o arriba) crea una pista nueva de su tipo', async ({ page }) => {
  // Ventana alta: hace falta hueco por debajo de las pistas para poder soltar ahí.
  await page.setViewportSize({ width: 1500, height: 1040 });
  await nuevaSesion(page);
  await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Video_A.mp4'), fixture('Audio.wav')]);
  await expect(page.locator('.media-item')).toHaveCount(2, { timeout: 60000 });
  await page.locator('.media-item').filter({ hasText: 'Video_A.mp4' }).dblclick();
  await page.waitForTimeout(900);
  await page.locator('.media-item').filter({ hasText: 'Audio.wav' }).dblclick();
  const inicial = await esperarProyecto(
    page,
    (valor) => (valor.events ?? []).some((evento) => evento.kind === 'audio') && (valor.events ?? []).some((evento) => evento.kind === 'video'),
    'el montaje entra en el proyecto',
  );
  expect((inicial.tracks ?? []).length).toBe(3);

  // 1) El audio se baja al hueco de debajo de todas las pistas: pista de audio nueva al final.
  const audio = page.locator('.timeline-event.audio').first();
  const cajaAudio = (await audio.boundingBox())!;
  const contenido = (await page.locator('.timeline-content').boundingBox())!;
  const carriles = page.locator('.track-lane');
  const ultimoCarril = (await carriles.last().boundingBox())!;
  expect(
    contenido.y + contenido.height - (ultimoCarril.y + ultimoCarril.height),
    'la ventana deja hueco por debajo de las pistas para poder soltar',
  ).toBeGreaterThan(12);
  await page.mouse.move(cajaAudio.x + cajaAudio.width / 2, cajaAudio.y + cajaAudio.height / 2);
  await page.mouse.down();
  await page.mouse.move(cajaAudio.x + cajaAudio.width / 2, cajaAudio.y + cajaAudio.height / 2 + 5, { steps: 2 });
  await page.mouse.move(cajaAudio.x + cajaAudio.width / 2, Math.min(contenido.y + contenido.height - 4, ultimoCarril.y + ultimoCarril.height + 30), { steps: 8 });
  await page.mouse.up();

  const conPistaAbajo = await esperarProyecto(
    page,
    (valor) => (valor.tracks ?? []).length === 4,
    'bajar el audio fuera de las pistas crea una pista de audio',
  );
  const pistas = conPistaAbajo.tracks ?? [];
  expect(pistas[pistas.length - 1].kind, 'la pista nueva va al final y es de audio').toBe('audio');
  // Hay dos audios (el del vídeo enlazado y el de Audio.wav): se comprueba que alguno se haya mudado a la pista nueva.
  const mudados = (conPistaAbajo.events ?? []).filter((evento) => evento.trackId === pistas[pistas.length - 1].id);
  expect(mudados.length, 'el clip arrastrado se muda a la pista nueva').toBeGreaterThan(0);
  expect(mudados.every((evento) => evento.kind === 'audio'), 'y lo que se muda es audio').toBe(true);

  // 2) El vídeo se sube por encima de la primera pista (sobre la regla): pista de vídeo nueva arriba.
  const video = page.locator('.timeline-event.video').first();
  const cajaVideo = (await video.boundingBox())!;
  const contenido2 = (await page.locator('.timeline-content').boundingBox())!;
  await page.mouse.move(cajaVideo.x + cajaVideo.width / 2, cajaVideo.y + cajaVideo.height / 2);
  await page.mouse.down();
  await page.mouse.move(cajaVideo.x + cajaVideo.width / 2, cajaVideo.y + cajaVideo.height / 2 - 5, { steps: 2 });
  await page.mouse.move(cajaVideo.x + cajaVideo.width / 2, contenido2.y + 4, { steps: 8 });
  await page.mouse.up();

  const conPistaArriba = await esperarProyecto(
    page,
    (valor) => (valor.tracks ?? []).length === 5,
    'subir el vídeo por encima de las pistas crea una pista de vídeo',
  );
  const pistas2 = conPistaArriba.tracks ?? [];
  expect(pistas2[0].kind, 'la pista nueva va arriba y es de vídeo').toBe('video');
  const clipVideo = (conPistaArriba.events ?? []).find((evento) => evento.kind === 'video')!;
  expect(clipVideo.trackId, 'el clip de vídeo se muda a la pista nueva de arriba').toBe(pistas2[0].id);
});

// Regresión: dividir un tramo, borrar una mitad y mover la otra no debe resucitar la mitad borrada. El gesto de
// mover guardaba como «estado de partida» el proyecto del repintado anterior, así que al soltar volvía a escribirlo
// entero y reaparecía el clip borrado. Aquí se comprueba el proyecto autoguardado y el DOM tras cada paso.
type MitadBorrada = 'primera' | 'segunda';

/** Monta un clip de vídeo en la línea de tiempo y lo divide en dos con «S» sobre su centro. */
async function montarYDividir(page: Page) {
  await nuevaSesion(page);
  await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Video_A.mp4')]);
  await expect(page.locator('.media-item')).toHaveCount(1, { timeout: 60000 });
  await page.locator('.media-item').filter({ hasText: 'Video_A.mp4' }).dblclick();
  await expect(page.locator('.timeline-event.video')).toHaveCount(1, { timeout: 20000 });
  await page.waitForTimeout(900);

  const clip = page.locator('.timeline-event.video').first();
  const caja = (await clip.boundingBox())!;
  await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.waitForTimeout(250);
  await page.keyboard.press('s');
  await expect(page.locator('.timeline-event.video'), 'la división deja dos tramos').toHaveCount(2, { timeout: 20000 });
  // El vídeo insertado trae su audio enlazado: al dividir quedan dos tramos de vídeo y dos de audio, así que la
  // comprobación va sobre los tramos de vídeo, que son los que se tocan en esta prueba.
  const partido = await esperarProyecto(
    page,
    (valor) => (valor.events ?? []).filter((evento) => evento.kind === 'video').length === 2,
    'el proyecto guarda los dos tramos de vídeo',
  );
  const tramos = (partido.events ?? [])
    .filter((evento) => evento.kind === 'video')
    .sort((uno, otro) => Number(uno.start) - Number(otro.start))
    .map((evento) => evento.id);
  return { izquierda: tramos[0], derecha: tramos[tramos.length - 1] };
}

for (const borrada of ['segunda', 'primera'] as MitadBorrada[]) {
  test(`dividir, borrar la mitad ${borrada} y mover la otra no recupera el tramo borrado`, async ({ page }) => {
    const { izquierda, derecha } = await montarYDividir(page);

    // Se borra la mitad indicada y se comprueba que el proyecto queda con un único tramo de vídeo.
    const indiceBorrado = borrada === 'segunda' ? 1 : 0;
    const idBorrado = indiceBorrado === 1 ? derecha : izquierda;
    const idVivo = indiceBorrado === 1 ? izquierda : derecha;
    await page.locator('.timeline-event.video').nth(indiceBorrado).click();
    await page.waitForTimeout(200);
    await page.keyboard.press('Delete');
    await expect(page.locator('.timeline-event.video'), 'queda un solo tramo en pantalla').toHaveCount(1, { timeout: 20000 });
    await esperarProyecto(
      page,
      (valor) =>
        (valor.events ?? []).filter((evento) => evento.kind === 'video').length === 1 &&
        (valor.events ?? []).some((evento) => evento.id === idVivo) &&
        !(valor.events ?? []).some((evento) => evento.id === idBorrado),
      'el proyecto guarda solo el tramo que sobrevive',
    );

    // Se arrastra el tramo que sobrevive (en horizontal, dentro de su propia pista).
    const vivo = page.locator('.timeline-event.video').first();
    const caja = (await vivo.boundingBox())!;
    await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
    await page.mouse.down();
    await page.mouse.move(caja.x + caja.width / 2 + 5, caja.y + caja.height / 2, { steps: 2 });
    await page.mouse.move(caja.x + caja.width / 2 + 70, caja.y + caja.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(1200);

    // El tramo borrado no vuelve, ni en el proyecto guardado ni en la línea de tiempo.
    const final = await esperarProyecto(
      page,
      (valor) => (valor.events ?? []).filter((evento) => evento.kind === 'video').length === 1,
      'tras mover sigue habiendo un único tramo de vídeo',
    );
    expect(
      (final.events ?? []).filter((evento) => evento.kind === 'video').map((evento) => evento.id),
      'el tramo borrado no reaparece',
    ).toEqual([idVivo]);
    expect((final.events ?? []).some((evento) => evento.id === idBorrado), 'el identificador borrado sigue ausente').toBe(false);
    await expect(page.locator('.timeline-event.video'), 'y en pantalla sigue habiendo un tramo').toHaveCount(1);
  });
}
