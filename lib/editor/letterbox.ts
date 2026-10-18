// Quitar bandas negras: lo que hace el script «Remove Letterboxing.cs» que VEGAS Pro 15 instala en su menú,
// y algo más.
//
// El script de VEGAS trabaja solo con geometría: mira la relación de aspecto del medio y la del proyecto y
// encaja la caja del contenido a la del proyecto (deformando la imagen). Eso resuelve el caso de un clip con
// otra relación, pero **no** ve la banda negra que viene incrustada en el propio archivo (una película 2.35:1
// dentro de un MP4 16:9, por ejemplo). Aquí están las dos cosas:
//
//   · `fillFrame`  — encaja el contenido para que cubra el fotograma sin deformarlo (lo que sobra se sale).
//   · `detectBars` — busca la banda negra de verdad, píxel a píxel, sobre el fotograma compuesto.
import { CropMask, Transform } from './project';
import { Frame, clampSide, normalizeMask } from './pancrop';

// Márgenes de la banda, en fracciones del fotograma (0 = no hay banda por ese lado).
export type Bars = { left: number; right: number; top: number; bottom: number };
export type BarOptions = {
  tolerance?: number;   // hasta qué valor de cada canal se considera negro (0..255)
  coverage?: number;    // fracción de píxeles oscuros que hace que una fila o columna sea banda
  minRun?: number;      // píxeles mínimos de banda para admitirla (evita confundir un borde oscuro)
  maxSide?: number;     // tope por lado, el mismo del modelo de recorte (45 %)
};
export const BAR_DEFAULTS: Required<BarOptions> = { tolerance: 24, coverage: .98, minRun: 3, maxSide: .45 };

// Un píxel es «banda» si sus tres canales están por debajo del umbral. Se ignoran los canales alfa.
const darkAt = (pixels: Uint8ClampedArray | number[], index: number, tolerance: number) =>
  pixels[index] <= tolerance && pixels[index + 1] <= tolerance && pixels[index + 2] <= tolerance;

// Fracción de píxeles oscuros de una fila (o columna) concreta.
function darkFraction(pixels: Uint8ClampedArray | number[], width: number, height: number, line: number, vertical: boolean, tolerance: number): number {
  const length = vertical ? height : width;
  let dark = 0;
  for (let step = 0; step < length; step += 1) {
    const x = vertical ? line : step;
    const y = vertical ? step : line;
    if (darkAt(pixels, (y * width + x) * 4, tolerance)) dark += 1;
  }
  return length ? dark / length : 0;
}
// Cuenta las filas (o columnas) de banda desde un extremo hacia dentro.
function runFrom(pixels: Uint8ClampedArray | number[], width: number, height: number, fromStart: boolean, vertical: boolean, options: Required<BarOptions>): number {
  const length = vertical ? width : height;
  let run = 0;
  for (let step = 0; step < length; step += 1) {
    const line = fromStart ? step : length - 1 - step;
    if (darkFraction(pixels, width, height, line, vertical, options.tolerance) < options.coverage) break;
    run += 1;
  }
  return run;
}

// Detecta las bandas negras de un fotograma. Devuelve `null` cuando no hay nada que recortar o cuando no se
// puede decidir (fotograma entero oscuro, imagen demasiado pequeña, banda por debajo del mínimo).
export function detectBars(pixels: Uint8ClampedArray | number[], width: number, height: number, options: BarOptions = {}): Bars | null {
  const settings: Required<BarOptions> = { ...BAR_DEFAULTS, ...options };
  if (!(width > 4) || !(height > 4) || pixels.length < width * height * 4) return null;
  const top = runFrom(pixels, width, height, true, false, settings);
  const bottom = runFrom(pixels, width, height, false, false, settings);
  const left = runFrom(pixels, width, height, true, true, settings);
  const right = runFrom(pixels, width, height, false, true, settings);
  // Si todo el fotograma es banda, no hay imagen que rescatar: no se toca nada.
  if (top + bottom >= height) return null;
  if (left + right >= width) return null;
  const bars: Bars = {
    top: top >= settings.minRun ? top / height : 0,
    bottom: bottom >= settings.minRun ? bottom / height : 0,
    left: left >= settings.minRun ? left / width : 0,
    right: right >= settings.minRun ? right / width : 0,
  };
  if (!bars.top && !bars.bottom && !bars.left && !bars.right) return null;
  // Nunca se recorta más de lo que admite el modelo: si hiciera falta, se recorta hasta el tope y se dice.
  return {
    top: Math.min(settings.maxSide, bars.top),
    bottom: Math.min(settings.maxSide, bars.bottom),
    left: Math.min(settings.maxSide, bars.left),
    right: Math.min(settings.maxSide, bars.right),
  };
}

// La banda detectada, como máscara de recorte del evento (ya normalizada y con los topes del modelo).
export const barsToMask = (bars: Bars): CropMask => normalizeMask({ left: clampSide(bars.left), right: clampSide(bars.right), top: clampSide(bars.top), bottom: clampSide(bars.bottom) });
// Cuánto se recorta en total, para el mensaje de estado.
export const describeBars = (bars: Bars | null): string => bars
  ? [bars.top ? `arriba ${(bars.top * 100).toFixed(1)} %` : '', bars.bottom ? `abajo ${(bars.bottom * 100).toFixed(1)} %` : '', bars.left ? `izquierda ${(bars.left * 100).toFixed(1)} %` : '', bars.right ? `derecha ${(bars.right * 100).toFixed(1)} %` : ''].filter(Boolean).join(' · ') || 'sin bandas'
  : 'sin bandas';

// Relación de aspecto de un fotograma.
export const aspectOf = (frame: Frame) => frame.width / Math.max(1, frame.height);
// Escala que hace que el contenido cubra el fotograma sin deformarlo (la mayor de las dos).
export const coverScale = (project: Frame, media: Frame) => Math.max(project.width / Math.max(1, media.width), project.height / Math.max(1, media.height));
// Escala que hace que el contenido quepa entero dentro del fotograma (la menor de las dos): es lo que ya hace
// el editor al ajustar el medio, y sirve para volver atrás.
export const containScale = (project: Frame, media: Frame) => Math.min(project.width / Math.max(1, media.width), project.height / Math.max(1, media.height));

// La escala de la pose se mide sobre el fotograma del proyecto, y a escala 1 el compositor ya dibuja el medio
// **encajado** (`contentBox` usa la menor de las dos relaciones). Por eso las dos poses se calculan contra esa
// base: cubrir pide `coverScale / containScale` y encajar vuelve a 1. Sin esa división, un medio más grande que
// el proyecto (donde `containScale` ≠ 1) quedaba encogido de más.
//
// Pose que cubre el fotograma: conserva el centro y el resto de la pose, y solo cambia la escala. Si el medio
// ya cubre el fotograma, devuelve la pose tal cual.
export function fillFrame(input: { project: Frame; media: Frame; pose: Transform }): Transform {
  const contain = containScale(input.project, input.media);
  const target = coverScale(input.project, input.media) / (contain || 1);
  const current = input.pose.scale || 1;
  if (target <= current + 1e-9) return input.pose;
  return { ...input.pose, scale: Math.min(10, target) };
}
// Y la vuelta: encajar el contenido entero dentro del fotograma, sin bandas negras alrededor del recuadro. Como
// la base del compositor ya es el encaje, esto devuelve la escala neutra.
export function fitFrame(input: { project: Frame; media: Frame; pose: Transform }): Transform {
  return { ...input.pose, scale: 1 };
}
// Informe del encaje, para la barra de estado.
export function describeFit(project: Frame, media: Frame): string {
  const cover = coverScale(project, media), contain = containScale(project, media);
  return `medio ${media.width}×${media.height} (${aspectOf(media).toFixed(3)}) en un fotograma ${project.width}×${project.height} (${aspectOf(project).toFixed(3)}): cubrir pide escala ${cover.toFixed(3)} y encajar ${contain.toFixed(3)}.`;
}
