// Máscaras libres (trazados): un polígono dibujado sobre el fotograma que recorta el evento, con pluma
// (borde suave) y opción de invertirlo. Se guarda en fracciones del fotograma, así que vale igual para la
// vista previa y para la exportación, y se puede dibujar desde la ventana de Panoramización y recorte.
import type { MaskPath, MaskPoint } from './project';
import { newMaskPath } from './project';
import { CanvasFactory, detectFilterSupport } from './effects';

export const MIN_MASK_POINTS = 3;
export const MAX_MASK_POINTS = 64;
export const clampPoint = (point: MaskPoint): MaskPoint => ({
  x: Math.max(0, Math.min(1, Number.isFinite(point.x) ? point.x : 0)),
  y: Math.max(0, Math.min(1, Number.isFinite(point.y) ? point.y : 0)),
});
// Una máscara necesita al menos tres puntos para encerrar algo.
export const maskActive = (path?: MaskPath) => Boolean(path && path.points.length >= MIN_MASK_POINTS);
// Copia normalizada (puntos acotados al fotograma). Se llama así para no chocar con el `maskOf` del recorte.
export const normalizeMaskPath = (path?: MaskPath): MaskPath => path ? { ...path, points: path.points.map(clampPoint) } : newMaskPath();

export function addMaskPoint(path: MaskPath | undefined, point: MaskPoint): MaskPath {
  const current = normalizeMaskPath(path);
  if (current.points.length >= MAX_MASK_POINTS) return current;
  return { ...current, points: [...current.points, clampPoint(point)] };
}
export function moveMaskPoint(path: MaskPath | undefined, index: number, point: MaskPoint): MaskPath {
  const current = normalizeMaskPath(path);
  if (index < 0 || index >= current.points.length) return current;
  return { ...current, points: current.points.map((candidate, position) => position === index ? clampPoint(point) : candidate) };
}
export function removeMaskPoint(path: MaskPath | undefined, index: number): MaskPath {
  const current = normalizeMaskPath(path);
  if (index < 0 || index >= current.points.length) return current;
  return { ...current, points: current.points.filter((_, position) => position !== index) };
}
export const clearMask = (path?: MaskPath): MaskPath => ({ ...normalizeMaskPath(path), points: [] });
// Punto de la máscara más cercano a uno dado, si está dentro del radio de agarre (en fracciones).
export function maskPointAt(path: MaskPath | undefined, point: MaskPoint, radius: number): number {
  const points = normalizeMaskPath(path).points;
  let best = -1, bestDistance = radius;
  points.forEach((candidate, index) => {
    const distance = Math.hypot((candidate.x - point.x) * 1, (candidate.y - point.y) * 1);
    if (distance <= bestDistance) { best = index; bestDistance = distance; }
  });
  return best;
}

// Recorta la capa del evento con el trazado: se pinta la máscara en un lienzo aparte (con desenfoque si hay
// pluma) y se multiplica el alfa de la capa por la de la máscara. Invertir es hacerlo al revés: en lugar de
// quedarse con lo de dentro, se perfora.
export function applyMaskPath(layer: HTMLCanvasElement, path: MaskPath, options: { width: number; height: number; scale: number; createCanvas: CanvasFactory; note?: (message: string) => void }): void {
  if (!maskActive(path)) return;
  const { width, height, scale, createCanvas } = options;
  const layerCtx = layer.getContext('2d');
  const mask = createCanvas(width, height);
  const maskCtx = mask.getContext('2d');
  if (!layerCtx || !maskCtx) return;
  const blur = Math.max(0, path.feather) * scale;
  if (blur > .01) {
    if (detectFilterSupport(createCanvas)) maskCtx.filter = `blur(${blur.toFixed(2)}px)`;
    else options.note?.('Este motor no aplica filtros de Canvas: la pluma de la máscara se ignora.');
  }
  maskCtx.fillStyle = '#fff';
  maskCtx.beginPath();
  normalizeMaskPath(path).points.forEach((point, index) => {
    const x = point.x * width, y = point.y * height;
    if (index === 0) maskCtx.moveTo(x, y); else maskCtx.lineTo(x, y);
  });
  maskCtx.closePath();
  maskCtx.fill();
  maskCtx.filter = 'none';
  layerCtx.save();
  layerCtx.globalCompositeOperation = path.invert ? 'destination-out' : 'destination-in';
  layerCtx.drawImage(mask, 0, 0);
  layerCtx.restore();
}

// Shapes reuse the saved polygon model and the shared preview/export mask renderer.
export function shapeMask(path:MaskPath, start:MaskPoint, end:MaskPoint, kind:'rectangle'|'ellipse'):MaskPath {
 const a=clampPoint(start),b=clampPoint(end);
 const left=Math.min(a.x,b.x),right=Math.max(a.x,b.x),top=Math.min(a.y,b.y),bottom=Math.max(a.y,b.y);
 const points=kind==='rectangle'?[{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}]:Array.from({length:MAX_MASK_POINTS},(_,i)=>{const angle=i*2*Math.PI/MAX_MASK_POINTS;return {x:(left+right)/2+Math.cos(angle)*(right-left)/2,y:(top+bottom)/2+Math.sin(angle)*(bottom-top)/2};});
 return {...path,points};
}
