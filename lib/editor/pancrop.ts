// Panoramización y recorte (Pan/Crop) y movimiento de pista: toda la geometría en un solo sitio.
//
// Cómo coloca Sinaloa Pro una imagen dentro del fotograma: el medio se ajusta al fotograma conservando su
// proporción (como el «ajustar al fotograma» de VEGAS) y se centra; después `transform.x/y` lo desplazan en
// fracciones del ancho y del alto, `transform.scale` lo escala alrededor del centro y `transform.rotation`
// lo gira. Sobre eso, este módulo añade el recorte por los cuatro lados.
//
// Compatibilidad: si un evento no tiene `mask`, los cuatro márgenes valen `transform.crop` (el recorte
// uniforme de siempre), así que los proyectos anteriores se ven exactamente igual: con márgenes simétricos
// `c`, el destino calculado aquí es idéntico al que producía el compositor anterior. Lo comprueba
// `tests/composition.test.ts`.
//
// VEGAS dibuja en su ventana Pan/Crop una caja que se mueve y se redimensiona (y al agrandarla aleja la
// imagen); aquí la caja visible es el contenido ya recortado: arrastrar dentro mueve, arrastrar un borde o
// una esquina recorta ese lado, y el zoom y el giro van por su campo o con la rueda. La diferencia está
// documentada en el README.
import { CropMask, Keyframe, Transform, easeValue } from './project';

// Mismo tope que el recorte uniforme del modelo: ningún lado puede tapar más del 45 % del fotograma.
export const MAX_SIDE = .45;
export const MIN_SIZE = 8;              // píxeles de fotograma que debe conservar la caja al arrastrar
export const KEY_EPSILON = 1;           // ticks para considerar dos claves «en el mismo instante»
export const noCrop = (): CropMask => ({ left: 0, right: 0, top: 0, bottom: 0 });
export type Frame = { width: number; height: number };
export type Box = { x: number; y: number; width: number; height: number };
export type Point = { x: number; y: number };

export const clampSide = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(MAX_SIDE, value)) : 0;

// Ningún par de márgenes puede tapar el fotograma entero: si se pasa, se reparten proporcionalmente.
function fitPair(a: number, b: number): [number, number] {
  const total = a + b;
  if (total <= MAX_SIDE * 2) return [a, b];
  const factor = (MAX_SIDE * 2) / total;
  return [a * factor, b * factor];
}
export function normalizeMask(mask?: Partial<CropMask> | null): CropMask {
  const left = clampSide(mask?.left ?? 0), right = clampSide(mask?.right ?? 0);
  const top = clampSide(mask?.top ?? 0), bottom = clampSide(mask?.bottom ?? 0);
  const [fittedLeft, fittedRight] = fitPair(left, right);
  const [fittedTop, fittedBottom] = fitPair(top, bottom);
  return { left: fittedLeft, right: fittedRight, top: fittedTop, bottom: fittedBottom };
}
// Márgenes efectivos de un evento o una pista, incluidos los proyectos anteriores sin `mask`.
export function maskOf(source: { transform: Transform; mask?: CropMask }): CropMask {
  if (source.mask) return normalizeMask(source.mask);
  const uniform = Math.max(0, Math.min(MAX_SIDE, Number.isFinite(source.transform.crop) ? source.transform.crop : 0));
  return { left: uniform, right: uniform, top: uniform, bottom: uniform };
}
export const maskIsUniform = (event: { transform: Transform; mask?: CropMask }) => !event.mask && event.transform.crop > 0;

// Caja del medio completo ajustado al fotograma y centrado (sin recortar, sin transformar).
export function fittedBox(frame: Frame, source: Frame): Box {
  const fit = Math.min(frame.width / Math.max(1, source.width), frame.height / Math.max(1, source.height));
  const width = source.width * fit, height = source.height * fit;
  return { x: (frame.width - width) / 2, y: (frame.height - height) / 2, width, height };
}
// Región de origen que se dibuja, en píxeles del medio.
export function sourceRect(source: Frame, mask: CropMask): Box {
  return {
    x: source.width * mask.left,
    y: source.height * mask.top,
    width: source.width * (1 - mask.left - mask.right),
    height: source.height * (1 - mask.top - mask.bottom),
  };
}
// Destino sobre el fotograma, en coordenadas locales (antes de posición, escala y giro).
export function contentBox(frame: Frame, source: Frame, mask: CropMask): Box {
  const full = fittedBox(frame, source);
  return {
    x: full.x + full.width * mask.left,
    y: full.y + full.height * mask.top,
    width: full.width * (1 - mask.left - mask.right),
    height: full.height * (1 - mask.top - mask.bottom),
  };
}
// La misma caja para un evento de texto o de color, que ocupa el fotograma entero. Los valores son
// fracciones del fotograma (0..1): el recorte desplaza el origen además de reducir el tamaño.
export function frameBox(mask: CropMask): Box {
  return { x: mask.left, y: mask.top, width: 1 - mask.left - mask.right, height: 1 - mask.top - mask.bottom };
}

// ------------------------------------------------------------------ posición, escala y giro

// Matriz [a,b,c,d,e,f] como la de canvas: gira y escala alrededor del centro de giro y luego desplaza.
// El centro de giro es `pose.pivot` (fracciones del fotograma) o, si no lo hay, el centro del fotograma:
// así los proyectos que ya existían se siguen viendo igual. Con el centro en el medio, esta fórmula es
// exactamente la de antes.
export function poseMatrix(frame: Frame, pose: Transform): [number, number, number, number, number, number] {
  const radians = pose.rotation * Math.PI / 180;
  const cos = Math.cos(radians) * pose.scale, sin = Math.sin(radians) * pose.scale;
  const px = (pose.pivot?.x ?? .5) * frame.width, py = (pose.pivot?.y ?? .5) * frame.height;
  const dx = px + pose.x * frame.width, dy = py + pose.y * frame.height;
  return [cos, sin, -sin, cos, dx - (cos * px - sin * py), dy - (sin * px + cos * py)];
}
export function applyMatrix(matrix: [number, number, number, number, number, number], point: Point): Point {
  const [a, b, c, d, e, f] = matrix;
  return { x: a * point.x + c * point.y + e, y: b * point.x + d * point.y + f };
}
export function invertMatrix(matrix: [number, number, number, number, number, number]): [number, number, number, number, number, number] {
  const [a, b, c, d, e, f] = matrix;
  const determinant = a * d - b * c || 1e-9;
  const na = d / determinant, nb = -b / determinant, nc = -c / determinant, nd = a / determinant;
  return [na, nb, nc, nd, -(na * e + nc * f), -(nb * e + nd * f)];
}
// Las cuatro esquinas de la caja tal como se ven en el monitor.
export function boxCorners(box: Box, frame: Frame, pose: Transform): Point[] {
  const matrix = poseMatrix(frame, pose);
  return [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ].map(point => applyMatrix(matrix, point));
}
// Del monitor al espacio local del fotograma, para poder arrastrar con la imagen girada.
export function toLocal(point: Point, frame: Frame, pose: Transform): Point {
  return applyMatrix(invertMatrix(poseMatrix(frame, pose)), point);
}
// Un desplazamiento en píxeles del monitor expresado en el espacio local (sin girar ni escalar).
export function toLocalDelta(delta: Point, pose: Transform): Point {
  const radians = -pose.rotation * Math.PI / 180;
  const scale = pose.scale || 1e-9;
  return {
    x: (delta.x * Math.cos(radians) - delta.y * Math.sin(radians)) / scale,
    y: (delta.x * Math.sin(radians) + delta.y * Math.cos(radians)) / scale,
  };
}

// ------------------------------------------------------------------ tiradores

export type HandleId = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export const HANDLES: HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
export function handlePoint(box: Box, id: HandleId): Point {
  const left = box.x, right = box.x + box.width, top = box.y, bottom = box.y + box.height;
  const middleX = box.x + box.width / 2, middleY = box.y + box.height / 2;
  switch (id) {
    case 'nw': return { x: left, y: top };
    case 'n': return { x: middleX, y: top };
    case 'ne': return { x: right, y: top };
    case 'e': return { x: right, y: middleY };
    case 'se': return { x: right, y: bottom };
    case 's': return { x: middleX, y: bottom };
    case 'sw': return { x: left, y: bottom };
    case 'w': return { x: left, y: middleY };
    default: return { x: middleX, y: middleY };
  }
}
// Qué se está agarrando: un tirador, o el interior de la caja (mover). Las coordenadas son locales.
export function handleAt(box: Box, point: Point, radius = 10): HandleId | null {
  for (const id of HANDLES) {
    const spot = handlePoint(box, id);
    if (Math.abs(spot.x - point.x) <= radius && Math.abs(spot.y - point.y) <= radius) return id;
  }
  const inside = point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height;
  return inside ? 'move' : null;
}
// Arrastre: mover cambia la posición; los bordes y esquinas cambian los márgenes del recorte.
export function dragHandle(input: { frame: Frame; source: Frame; pose: Transform; mask: CropMask; handle: HandleId; delta: Point }): { pose: Transform; mask: CropMask } {
  const { frame, source, pose, mask, handle, delta } = input;
  if (handle === 'move') {
    return { pose: { ...pose, x: pose.x + delta.x / frame.width, y: pose.y + delta.y / frame.height }, mask };
  }
  const full = fittedBox(frame, source);
  const box = contentBox(frame, source, mask);
  let { x, y, width, height } = box;
  if (handle.includes('w')) { const next = x + delta.x; width += x - next; x = next; }
  if (handle.includes('e')) width += delta.x;
  if (handle.includes('n')) { const next = y + delta.y; height += y - next; y = next; }
  if (handle.includes('s')) height += delta.y;
  if (width < MIN_SIZE || height < MIN_SIZE) return { pose, mask };
  return {
    pose,
    mask: normalizeMask({
      left: (x - full.x) / full.width,
      right: (full.x + full.width - (x + width)) / full.width,
      top: (y - full.y) / full.height,
      bottom: (full.y + full.height - (y + height)) / full.height,
    }),
  };
}

// La selección de recorte: los cuatro puntos de las esquinas, que son los que cambian el tamaño del recorte
// (y, con el zoom de la selección, acercan la imagen) y los cuatro de los lados, que recortan sin acercar.
export const CROP_CORNERS: HandleId[] = ['nw', 'ne', 'se', 'sw'];
export const isCornerHandle = (id: HandleId): boolean => CROP_CORNERS.includes(id);

// Zoom de la selección de recorte: la región recortada se acerca lo que haga falta para ocupar el fotograma,
// así que **cuanto más pequeña es la selección, más se acerca la imagen** y al agrandarla se aleja. La escala
// es uniforme (una sola, la mayor de las dos que llenarían el fotograma por cada eje: nunca deforma) y se
// calcula sobre los márgenes del recorte, no sobre el tamaño del fotograma: así una selección sin recortar
// deja la escala en 1 y no da ningún salto, y el material que ya venía con bandas las conserva. El centro de la
// región recortada se lleva al centro del fotograma, con el giro que tuviera el encuadre.
export function cropZoomPose(input: { frame: Frame; source: Frame; pose: Transform; mask: CropMask; min?: number; max?: number }): Transform {
  const { frame, source, pose, mask } = input;
  const box = contentBox(frame, source, mask);
  if (!(box.width > 0) || !(box.height > 0) || !(frame.width > 0) || !(frame.height > 0)) return pose;
  const min = input.min ?? .05, max = input.max ?? 10;
  const margin = normalizeMask(mask);
  const horizontal = 1 / Math.max(1e-6, 1 - margin.left - margin.right);
  const vertical = 1 / Math.max(1e-6, 1 - margin.top - margin.bottom);
  const scale = Math.max(min, Math.min(max, Math.max(horizontal, vertical)));
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const pivot = { x: (pose.pivot?.x ?? .5) * frame.width, y: (pose.pivot?.y ?? .5) * frame.height };
  // La escala se aplica alrededor del centro de giro: se despeja el desplazamiento para que el centro de la
  // región recortada caiga en el centro del fotograma.
  const { a, b, c, d } = linearMatrix({ ...pose, scale });
  const ax = center.x - pivot.x, ay = center.y - pivot.y;
  const offsetX = frame.width / 2 - pivot.x - (a * ax + c * ay);
  const offsetY = frame.height / 2 - pivot.y - (b * ax + d * ay);
  return { ...pose, scale, x: offsetX / frame.width, y: offsetY / frame.height };
}

// Arrastre de un punto de la selección de recorte. `delta` va en el espacio local y **desde el principio del
// arrastre** (no incremental): como el zoom cambia mientras se arrastra, medir desde el principio es lo que
// mantiene el gesto estable en lugar de acelerarse a cada fotograma. Con `zoom` las esquinas recortan y
// acercan; los puntos de los lados recortan sin tocar la escala.
export function dragCropSelection(input: { frame: Frame; source: Frame; pose: Transform; mask: CropMask; handle: HandleId; delta: Point; zoom?: boolean }): { pose: Transform; mask: CropMask } {
  const next = dragHandle(input);
  if (!input.zoom || !isCornerHandle(input.handle)) return next;
  return { mask: next.mask, pose: cropZoomPose({ frame: input.frame, source: input.source, pose: input.pose, mask: next.mask }) };
}

// El asa contraria: es el punto que se queda quieto mientras se escala.
export const oppositeHandle = (id: HandleId): HandleId => ({ nw: 'se', n: 's', ne: 'sw', e: 'w', se: 'nw', s: 'n', sw: 'ne', w: 'e', move: 'move' } as Record<HandleId, HandleId>)[id];
// La parte lineal de la matriz (giro y escala), sin el desplazamiento.
function linearMatrix(pose: Transform) {
  const radians = pose.rotation * Math.PI / 180;
  const cos = Math.cos(radians) * pose.scale, sin = Math.sin(radians) * pose.scale;
  return { a: cos, b: sin, c: -sin, d: cos };
}
// Escalado con un asa, para redimensionar desde la vista previa: el asa contraria (el ancla) se queda quieta y
// el desplazamiento se recalcula para que así sea. `delta` llega en píxeles del monitor y en el espacio local
// (sin girar): se proyecta sobre la diagonal entre el ancla y el asa, así que el resultado es un escalado
// uniforme, que es lo que admite la pose de un evento.
export function dragScale(input: { frame: Frame; box: Box; pose: Transform; handle: HandleId; delta: Point; min?: number; max?: number }): Transform {
  const { frame, box, pose, handle, delta } = input;
  if (handle === 'move') return pose;
  const anchorLocal = handlePoint(box, oppositeHandle(handle));
  const movingLocal = handlePoint(box, handle);
  const matrix = poseMatrix(frame, pose);
  const anchor = applyMatrix(matrix, anchorLocal);
  const moving = applyMatrix(matrix, movingLocal);
  const dx = moving.x - anchor.x, dy = moving.y - anchor.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!(lengthSquared > 1e-9)) return pose;
  const factor = 1 + (delta.x * dx + delta.y * dy) / lengthSquared;
  const min = input.min ?? .05, max = input.max ?? 10;
  const scale = Math.max(min, Math.min(max, pose.scale * factor));
  // Con la escala nueva, el ancla tiene que seguir cayendo donde estaba: se despeja el desplazamiento.
  const { a, b, c, d } = linearMatrix({ ...pose, scale });
  const px = (pose.pivot?.x ?? .5) * frame.width, py = (pose.pivot?.y ?? .5) * frame.height;
  const ax = anchorLocal.x - px, ay = anchorLocal.y - py;
  const offsetX = anchor.x - px - (a * ax + c * ay);
  const offsetY = anchor.y - py - (b * ax + d * ay);
  return { ...pose, scale, x: offsetX / frame.width, y: offsetY / frame.height };
}

// ------------------------------------------------------------------ claves

export const keyAt = (keys: Keyframe[] | undefined, local: number) => (keys ?? []).find(key => Math.abs(key.time - local) <= KEY_EPSILON);
export function upsertKey(keys: Keyframe[] | undefined, local: number, patch: Partial<Keyframe>): Keyframe[] {
  const list = [...(keys ?? [])];
  const index = list.findIndex(key => Math.abs(key.time - local) <= KEY_EPSILON);
  if (index >= 0) list[index] = { ...list[index], ...patch, time: local };
  else list.push({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, crop: 0, ...patch, time: local });
  return list.sort((a, b) => a.time - b.time);
}
export const removeKey = (keys: Keyframe[] | undefined, local: number) => (keys ?? []).filter(key => Math.abs(key.time - local) > KEY_EPSILON);

// El selector de la tira de claves (el combo «Posición» de la ventana de VEGAS) elige de qué parámetro se
// ven las claves. Una clave se muestra si cambia ese parámetro respecto de la clave anterior; la primera
// siempre se ve, porque es donde empieza la envolvente.
export type KeyParameter = 'all' | 'position' | 'rotation' | 'crop' | 'opacity';
export const KEY_PARAMETERS: { value: KeyParameter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'position', label: 'Posición' },
  { value: 'rotation', label: 'Rotación' },
  { value: 'crop', label: 'Recorte' },
  { value: 'opacity', label: 'Opacidad' },
];
export function keyChanges(key: Keyframe, previous: Keyframe | undefined, parameter: KeyParameter): boolean {
  if (parameter === 'all' || !previous) return true;
  switch (parameter) {
    case 'position': return key.x !== previous.x || key.y !== previous.y || key.scale !== previous.scale;
    case 'rotation': return key.rotation !== previous.rotation;
    case 'opacity': return key.opacity !== previous.opacity;
    case 'crop': return Boolean(key.mask) || Boolean(previous.mask);
    default: return true;
  }
}
export function keysChanging(keys: Keyframe[] | undefined, parameter: KeyParameter): Keyframe[] {
  const sorted = [...(keys ?? [])].sort((a, b) => a.time - b.time);
  return sorted.filter((key, index) => keyChanges(key, index ? sorted[index - 1] : undefined, parameter));
}
export const moveKey = (keys: Keyframe[] | undefined, from: number, to: number, duration: number) => (keys ?? [])
  .map(key => Math.abs(key.time - from) <= KEY_EPSILON ? { ...key, time: Math.max(0, Math.min(duration, to)) } : key)
  .sort((a, b) => a.time - b.time);

// Márgenes en un instante, interpolando las claves que lleven máscara. `local` se mide desde el inicio del
// evento, igual que en `pose()`.
export function maskAt(source: { transform: Transform; mask?: CropMask; keys?: Keyframe[] }, local: number): CropMask {
  const keys = (source.keys ?? []).filter(key => key.mask).sort((a, b) => a.time - b.time);
  if (!keys.length) return maskOf(source);
  const before = [...keys].reverse().find(key => key.time <= local) ?? keys[0];
  const after = keys.find(key => key.time > local) ?? before;
  if (after.time === before.time) return normalizeMask(before.mask);
  const progress = easeValue(before.curve, (local - before.time) / (after.time - before.time));
  const from = before.mask as CropMask, to = after.mask as CropMask;
  return normalizeMask({
    left: from.left + (to.left - from.left) * progress,
    right: from.right + (to.right - from.right) * progress,
    top: from.top + (to.top - from.top) * progress,
    bottom: from.bottom + (to.bottom - from.bottom) * progress,
  });
}
// Un resumen para la interfaz y el estado del editor.
export function describeMask(mask: CropMask): string {
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  const parts: string[] = [];
  if (mask.left) parts.push(`izq ${percent(mask.left)}`);
  if (mask.right) parts.push(`der ${percent(mask.right)}`);
  if (mask.top) parts.push(`arr ${percent(mask.top)}`);
  if (mask.bottom) parts.push(`aba ${percent(mask.bottom)}`);
  return parts.length ? parts.join(' · ') : 'sin recorte';
}
// Encaje rápido: repone el encuadre y quita el recorte.
export const resetPose = (pose: Transform): Transform => ({ ...pose, x: 0, y: 0, scale: 1, rotation: 0 });
// Recorta el encuadre para dejarlo en una relación de aspecto concreta (4:3, 1:1…), quitando lo que sobra de
// los lados largos y centrado. Es la base de los preestablecidos de recorte: si el encuadre ya es más alto que
// ancho, se recorta arriba y abajo. Devuelve null si no hay nada que recortar.
export function cropToAspect(source: Frame, target: number): CropMask | null {
  if (!(source.width > 0) || !(source.height > 0) || !(target > 0)) return null;
  const current = source.width / source.height;
  if (Math.abs(current - target) < 1e-6) return null;
  if (current > target) {
    // Sobra a los lados: se recorta la misma proporción por la izquierda y por la derecha.
    const keep = target / current;
    const side = clampSide((1 - keep) / 2);
    return normalizeMask({ left: side, right: side });
  }
  const keep = current / target;
  const side = clampSide((1 - keep) / 2);
  return normalizeMask({ top: side, bottom: side });
}
