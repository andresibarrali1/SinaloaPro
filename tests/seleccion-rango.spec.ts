// Dos comportamientos de la línea de tiempo que pide el flujo de Vegas (manual, «Edición y selección de eventos»):
// Mayús+clic selecciona todo lo que hay entre dos eventos, y «Pegar atributos de evento» alcanza a todos los eventos
// seleccionados, no solo al que se pulsó con el botón derecho.
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const fixture = (name: string) => path.resolve('tests/fixtures', name);
const CLAVE = 'corte15-autosave-v1';

type Guardado = { events?: { id: string; kind: string; name: string; start: number; duration: number; fadeIn: number; fadeOut: number }[] };

const proyectoGuardado = async (page: Page): Promise<Guardado | null> => {
  const texto = await page.evaluate((clave) => localStorage.getItem(clave), CLAVE);
  try {
    return texto ? (JSON.parse(texto) as Guardado) : null;
  } catch {
    return null;
  }
};
async function esperarProyecto(page: Page, comprobar: (proyecto: Guardado) => boolean, mensaje: string) {
  await expect
    .poll(async () => {
      const proyecto = await proyectoGuardado(page);
      return proyecto ? comprobar(proyecto) : false;
    }, { message: mensaje, timeout: 20000 })
    .toBe(true);
  const proyecto = await proyectoGuardado(page);
  if (!proyecto) throw new Error(`sin proyecto guardado después de: ${mensaje}`);
  return proyecto;
}
const videos = (proyecto: Guardado) => (proyecto.events ?? []).filter((evento) => evento.kind === 'video').sort((uno, otro) => uno.start - otro.start);

/** Tres clips de vídeo separados (sin solaparse, para que no se creen fundidos automáticos). */
async function montarTresClips(page: Page) {
  await page.goto('/?bienvenida=no');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.vegas-toolbar')).toBeVisible();
  await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Video_A.mp4'), fixture('Audio.wav')]);
  await expect(page.locator('.media-item')).toHaveCount(2, { timeout: 60000 });
  const ruler = page.locator('.ruler');
  for (const x of [60, 520, 980]) {
    await ruler.click({ position: { x, y: 30 } });
    await page.locator('.media-item').filter({ hasText: 'Video_A.mp4' }).dblclick();
    await page.waitForTimeout(500);
  }
  // Un audio suelto en la pista de audio, dentro del tramo que luego se selecciona: no va agrupado con nada.
  await ruler.click({ position: { x: 620, y: 30 } });
  await page.locator('.media-item').filter({ hasText: 'Audio.wav' }).dblclick();
  await page.waitForTimeout(600);
  await expect(page.locator('.timeline-event.video')).toHaveCount(3, { timeout: 20000 });
  await expect(page.locator('.timeline-event.audio'), 'tres audios enlazados y uno suelto').toHaveCount(4, { timeout: 20000 });
  const proyecto = await esperarProyecto(page, (valor) => videos(valor).length === 3, 'el montaje tiene tres clips');
  const tramos = videos(proyecto);
  expect(tramos[1].start, 'los clips no se solapan').toBeGreaterThan(tramos[0].start + tramos[0].duration);
  expect(tramos[2].start, 'los clips no se solapan').toBeGreaterThan(tramos[1].start + tramos[1].duration);
  return tramos;
}

test('Mayús+clic selecciona todo lo que queda entre dos eventos de la línea de tiempo', async ({ page }) => {
  await montarTresClips(page);
  const clips = page.locator('.timeline-event.video');
  // Clic normal en el primero: ancla la selección.
  await clips.nth(0).click();
  await expect(page.locator('.timeline-event.video.selected'), 'el clic normal selecciona uno').toHaveCount(1);
  // Mayús+clic en el tercero: entran los tres clips de vídeo y sus audios enlazados (grupos), pero **no** el audio
  // suelto que hay dentro del mismo tramo en otra pista.
  await clips.nth(2).click({ modifiers: ['Shift'] });
  await expect(page.locator('.timeline-event.video.selected'), 'Mayús+clic alcanza el del medio').toHaveCount(3);
  await expect(page.locator('.timeline-event.audio.selected'), 'solo los audios agrupados con los vídeos').toHaveCount(3);
  await expect(page.locator('.timeline-event.selected'), 'nada de otras pistas sin agrupar').toHaveCount(6);
  await expect(page.locator('.statusbar [role=status]')).toContainText('seleccionados entre el ancla');
  // Ctrl+clic sigue sumando o quitando de uno en uno: se quita el del medio y quedan dos.
  await clips.nth(1).click({ modifiers: ['Control'] });
  await expect(page.locator('.timeline-event.video.selected'), 'Ctrl+clic quita uno de la selección').toHaveCount(2);
  // El ancla pasa a ser el último clic sin Mayús: al volver a pulsar el primero y hacer Mayús+clic en el tercero,
  // el rango vuelve a abarcar los tres.
  await clips.nth(0).click();
  await clips.nth(2).click({ modifiers: ['Shift'] });
  await expect(page.locator('.timeline-event.video.selected'), 'el rango se recalcula desde el ancla nueva').toHaveCount(3);
});

test('Pegar atributos de evento alcanza a todos los eventos seleccionados, de una vez', async ({ page }) => {
  const tramos = await montarTresClips(page);
  const clips = page.locator('.timeline-event.video');
  // Un fundido de entrada distinguible en el primero, arrastrando su tirador.
  const caja = (await clips.nth(0).boundingBox())!;
  const tirador = (await clips.nth(0).locator('.fade-handle.in').boundingBox())!;
  await page.mouse.move(tirador.x + tirador.width / 2, tirador.y + tirador.height / 2);
  await page.mouse.down();
  await page.mouse.move(caja.x + 60, tirador.y + tirador.height / 2, { steps: 8 });
  await page.mouse.up();
  const conFundido = await esperarProyecto(page, (valor) => videos(valor)[0].fadeIn > 0, 'el primer clip tiene fundido de entrada');
  const fundidoOrigen = videos(conFundido)[0].fadeIn;
  expect(videos(conFundido)[1].fadeIn, 'los demás siguen sin fundido').toBe(0);

  // Copiar los atributos del primero desde el menú del clic derecho.
  await clips.nth(0).click({ button: 'right' });
  await page.getByRole('menuitem', { name: /Copiar los efectos y el estilo/ }).click();
  await expect(page.locator('.statusbar [role=status]')).toContainText('Atributos copiados');

  // Seleccionar los tres con Mayús+clic y pegar en el del medio: tienen que recibirlo los tres.
  await clips.nth(0).click();
  await clips.nth(2).click({ modifiers: ['Shift'] });
  await expect(page.locator('.timeline-event.video.selected')).toHaveCount(3);
  await clips.nth(1).click({ button: 'right' });
  await page.getByRole('menuitem', { name: /Pegar atributos de evento/ }).click();
  await expect(page.locator('.statusbar [role=status]')).toContainText('Atributos pegados en');
  const pegado = await esperarProyecto(
    page,
    (valor) => videos(valor).every((evento) => evento.fadeIn === fundidoOrigen),
    'el fundido llega a los tres clips',
  );
  expect(videos(pegado).map((evento) => evento.fadeIn), 'los tres comparten el fundido copiado').toEqual([fundidoOrigen, fundidoOrigen, fundidoOrigen]);

  // Todo el pegado es un solo paso de deshacer: un Ctrl+Z devuelve los tres a cero.
  await page.keyboard.press('Control+z');
  const deshecho = await esperarProyecto(
    page,
    (valor) => videos(valor)[1].fadeIn === 0 && videos(valor)[2].fadeIn === 0,
    'un solo deshacer quita el pegado de los tres',
  );
  expect(videos(deshecho)[1].fadeIn, 'el segundo vuelve a estar sin fundido').toBe(0);
  expect(tramos.length, 'el montaje sigue teniendo tres clips').toBe(3);
});
