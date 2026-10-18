// Pila de efectos de vídeo, con los nombres y los parámetros de los efectos que VEGAS Pro 15 trae en su
// catálogo (leído de `OFX Video Plug-Ins\Vfx1.ofx.bundle\Contents\Resources\Vfx1.es-ES.xml`).
//
// Cada efecto se aplica sobre la capa del evento (un lienzo del tamaño del fotograma, con transparencia) en
// el orden en que aparece en la pila, que es como los aplica VEGAS. Los que se pueden resolver con aritmética
// de píxeles se hacen así (blanco y negro, sepia, invertir y clave cromática) porque el resultado es exacto
// y se puede comprobar píxel a píxel; el desenfoque y el centelleo usan `ctx.filter`, que es mucho más rápido
// y existe tanto en los navegadores como en el lienzo de las pruebas (se comprueba en tiempo de ejecución).
import type { VideoEffect, VideoEffectKind } from './project';

export type CanvasFactory = (width: number, height: number) => HTMLCanvasElement;

export const EFFECT_KINDS: VideoEffectKind[] = ['blur', 'blackAndWhite', 'sepia', 'invert', 'chromaKey', 'pixelate', 'mirror', 'border', 'vignette', 'glow'];
export const EFFECT_LABEL: Record<VideoEffectKind, string> = {
  blur: 'Desenfoque gaussiano', blackAndWhite: 'Blanco y negro', sepia: 'Sepia', invert: 'Invertir',
  chromaKey: 'Clave cromática', pixelate: 'Pixelar', mirror: 'Espejo', border: 'Borde', vignette: 'Viñeta', glow: 'Centelleo',
};
export const EFFECT_DESCRIPTION: Record<VideoEffectKind, string> = {
  blur: 'Radio del desenfoque, en píxeles del proyecto.',
  blackAndWhite: 'Cantidad de fusión: 1 deja la imagen en gris y 0,5 la mezcla a medias.',
  sepia: 'Cantidad de fusión con el tono sepia.',
  invert: 'Cantidad de inversión de los colores.',
  chromaKey: 'Quita el color elegido: umbral inferior, suavidad del borde y color de la clave.',
  pixelate: 'Tamaño del bloque, en píxeles del proyecto.',
  mirror: 'Invierte la imagen en horizontal, en vertical o en ambos ejes.',
  border: 'Grosor y color del borde que se pinta sobre el fotograma.',
  vignette: 'Oscurecimiento de las esquinas y color de la viñeta.',
  glow: 'Radio del resplandor y cantidad que se suma a la imagen.',
};
// Qué parámetros usa cada efecto, para que la interfaz muestre solo los que sirven.
export const EFFECT_PARAMS: Record<VideoEffectKind, ('amount' | 'size' | 'color' | 'softness' | 'horizontal' | 'vertical')[]> = {
  blur: ['amount'], blackAndWhite: ['amount'], sepia: ['amount'], invert: ['amount'],
  chromaKey: ['color', 'amount', 'softness'], pixelate: ['size'], mirror: ['horizontal', 'vertical'],
  border: ['size', 'color'], vignette: ['amount', 'color'], glow: ['size', 'amount'],
};

const clamp = (value: number, min: number, max: number) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
const clamp01 = (value: number) => clamp(value, 0, 1);
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;

export function defaultEffect(kind: VideoEffectKind, id: string): VideoEffect {
  const base: VideoEffect = { id, kind, enabled: true, amount: 1, size: 8, color: '#000000', softness: .2, horizontal: true, vertical: false };
  switch (kind) {
    case 'blur': return { ...base, amount: 6 };
    case 'blackAndWhite': return { ...base, amount: 1 };
    case 'sepia': return { ...base, amount: 1 };
    case 'invert': return { ...base, amount: 1 };
    case 'chromaKey': return { ...base, color: '#00ff00', amount: .35, softness: .25 };
    case 'pixelate': return { ...base, size: 12 };
    case 'mirror': return { ...base, horizontal: true, vertical: false };
    case 'border': return { ...base, size: 8, color: '#ffffff' };
    case 'vignette': return { ...base, amount: .6, color: '#000000' };
    case 'glow': return { ...base, size: 14, amount: .6 };
  }
}
export function normalizeEffect(effect: Partial<VideoEffect> & { kind: VideoEffectKind }, id?: string): VideoEffect {
  const base = defaultEffect(effect.kind, id ?? effect.id ?? `fx-${effect.kind}`);
  return {
    ...base,
    ...effect,
    id: id ?? effect.id ?? base.id,
    enabled: effect.enabled !== false,
    amount: clamp(Number.isFinite(effect.amount as number) ? effect.amount as number : base.amount, 0, 100),
    size: clamp(Number.isFinite(effect.size as number) ? effect.size as number : base.size, 0, 400),
    softness: clamp01(effect.softness ?? base.softness),
    color: /^#[0-9a-f]{6}$/i.test(effect.color ?? '') ? (effect.color as string) : base.color,
    horizontal: effect.horizontal ?? base.horizontal,
    vertical: effect.vertical ?? base.vertical,
  };
}
export function normalizeEffects(effects?: (Partial<VideoEffect> & { kind: VideoEffectKind })[] | null): VideoEffect[] {
  return (effects ?? []).filter(effect => effect && EFFECT_KINDS.includes(effect.kind)).map(effect => normalizeEffect(effect));
}
// Los efectos apagados no se aplican, pero siguen en la pila para poder volver a encenderlos.
export const activeEffects = (effects?: VideoEffect[]) => (effects ?? []).filter(effect => effect && effect.enabled !== false && EFFECT_KINDS.includes(effect.kind));
export const usesLayer = (effects?: VideoEffect[]) => activeEffects(effects).length > 0;
export function describeEffect(effect: VideoEffect): string {
  const parts: string[] = [];
  if (EFFECT_PARAMS[effect.kind].includes('amount')) parts.push(`cantidad ${Math.round(clamp01(effect.amount) * 100)} %`);
  if (EFFECT_PARAMS[effect.kind].includes('size')) parts.push(`tamaño ${effect.size} px`);
  if (EFFECT_PARAMS[effect.kind].includes('softness')) parts.push(`suavidad ${Math.round(effect.softness * 100)} %`);
  if (EFFECT_PARAMS[effect.kind].includes('color')) parts.push(effect.color);
  if (effect.kind === 'mirror') parts.push([effect.horizontal ? 'horizontal' : '', effect.vertical ? 'vertical' : ''].filter(Boolean).join(' y ') || 'sin ejes');
  return `${EFFECT_LABEL[effect.kind]}: ${parts.join(' · ')}`;
}

// ------------------------------------------------------------------ aplicación

type Pixels = (r: number, g: number, b: number, a: number) => [number, number, number, number];
function pixelPass(layer: HTMLCanvasElement, ctx: CanvasRenderingContext2D, transform: Pixels) {
  const image = ctx.getImageData(0, 0, layer.width, layer.height);
  const data = image.data;
  for (let index = 0; index < data.length; index += 4) {
    const [r, g, b, a] = transform(data[index], data[index + 1], data[index + 2], data[index + 3]);
    data[index] = r; data[index + 1] = g; data[index + 2] = b; data[index + 3] = a;
  }
  ctx.putImageData(image, 0, 0);
}
const hexToRgb = (hex: string): [number, number, number] => {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : [0, 0, 0];
};

// `ctx.filter` no se puede interrogar (leerlo devuelve «none» incluso cuando funciona), así que se prueba con
// un píxel rojo: si tras aplicarle escala de grises deja de ser rojo, el filtro funciona.
let filterSupport: boolean | null = null;
export function detectFilterSupport(createCanvas: CanvasFactory): boolean {
  if (filterSupport !== null) return filterSupport;
  try {
    const target = createCanvas(2, 2), ctx = target.getContext('2d');
    const source = createCanvas(2, 2), sourceCtx = source.getContext('2d');
    if (!ctx || !sourceCtx) { filterSupport = false; return filterSupport; }
    sourceCtx.fillStyle = '#ff0000'; sourceCtx.fillRect(0, 0, 2, 2);
    ctx.filter = 'grayscale(1)';
    ctx.drawImage(source, 0, 0);
    ctx.filter = 'none';
    const data = ctx.getImageData(0, 0, 1, 1).data;
    filterSupport = data[0] > 0 && Math.abs(data[0] - data[1]) < 8 && Math.abs(data[1] - data[2]) < 8;
  } catch { filterSupport = false; }
  return filterSupport;
}

// Aplica la pila completa sobre la capa del evento, en orden. `scale` convierte píxeles del proyecto a
// píxeles de la capa (la vista previa y la exportación tienen tamaños distintos).
export function applyEffects(layer: HTMLCanvasElement, effects: VideoEffect[], options: { scale: number; createCanvas: CanvasFactory; note?: (message: string) => void }): void {
  const ctx = layer.getContext('2d');
  if (!ctx) return;
  const { createCanvas } = options;
  const scale = Number.isFinite(options.scale) && options.scale > 0 ? options.scale : 1;
  const width = layer.width, height = layer.height;

  // Vuelca la capa en otro lienzo con un filtro de Canvas aplicado.
  const throughFilter = (filter: string, blend: GlobalCompositeOperation = 'source-over', alpha = 1) => {
    const scratch = createCanvas(width, height);
    const scratchCtx = scratch.getContext('2d');
    if (!scratchCtx) return;
    scratchCtx.filter = filter;
    scratchCtx.globalAlpha = alpha;
    scratchCtx.globalCompositeOperation = blend;
    scratchCtx.drawImage(layer, 0, 0);
    scratchCtx.filter = 'none';
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(scratch, 0, 0);
  };
  const withCopy = (draw: (copy: CanvasRenderingContext2D) => void) => {
    const scratch = createCanvas(width, height);
    const scratchCtx = scratch.getContext('2d');
    if (!scratchCtx) return;
    draw(scratchCtx);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(scratch, 0, 0);
  };

  for (const effect of activeEffects(effects)) {
    switch (effect.kind) {
      case 'blackAndWhite': {
        const amount = clamp01(effect.amount);
        pixelPass(layer, ctx, (r, g, b, a) => {
          const luma = .2126 * r + .7152 * g + .0722 * b;
          return [mix(r, luma, amount), mix(g, luma, amount), mix(b, luma, amount), a];
        });
        break;
      }
      case 'sepia': {
        const amount = clamp01(effect.amount);
        pixelPass(layer, ctx, (r, g, b, a) => {
          const sr = .393 * r + .769 * g + .189 * b, sg = .349 * r + .686 * g + .168 * b, sb = .272 * r + .534 * g + .131 * b;
          return [mix(r, Math.min(255, sr), amount), mix(g, Math.min(255, sg), amount), mix(b, Math.min(255, sb), amount), a];
        });
        break;
      }
      case 'invert': {
        const amount = clamp01(effect.amount);
        pixelPass(layer, ctx, (r, g, b, a) => [mix(r, 255 - r, amount), mix(g, 255 - g, amount), mix(b, 255 - b, amount), a]);
        break;
      }
      case 'chromaKey': {
        const [keyR, keyG, keyB] = hexToRgb(effect.color);
        const threshold = clamp(effect.amount, 0, 1) * 255;      // umbral inferior: hasta aquí se quita
        const soft = effect.softness * 255;                      // ancho del borde suave
        pixelPass(layer, ctx, (r, g, b, a) => {
          const distance = Math.max(Math.abs(r - keyR), Math.abs(g - keyG), Math.abs(b - keyB));
          if (distance <= threshold) return [r, g, b, 0];
          if (soft > 0 && distance <= threshold + soft) return [r, g, b, Math.round(a * (distance - threshold) / soft)];
          return [r, g, b, a];
        });
        break;
      }
      case 'pixelate': {
        const block = Math.max(2, Math.round(effect.size * scale));
        const small = createCanvas(Math.max(1, Math.ceil(width / block)), Math.max(1, Math.ceil(height / block)));
        const smallCtx = small.getContext('2d');
        if (!smallCtx) break;
        smallCtx.imageSmoothingEnabled = false;
        smallCtx.drawImage(layer, 0, 0, small.width, small.height);
        ctx.clearRect(0, 0, width, height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(small, 0, 0, width, height);
        ctx.imageSmoothingEnabled = true;
        break;
      }
      case 'mirror': {
        if (!effect.horizontal && !effect.vertical) break;
        withCopy(copy => {
          copy.translate(effect.horizontal ? width : 0, effect.vertical ? height : 0);
          copy.scale(effect.horizontal ? -1 : 1, effect.vertical ? -1 : 1);
          copy.drawImage(layer, 0, 0);
        });
        break;
      }
      case 'border': {
        const size = Math.max(1, Math.round(effect.size * scale));
        ctx.save();
        ctx.fillStyle = effect.color;
        ctx.fillRect(0, 0, width, Math.min(size, height));
        ctx.fillRect(0, height - Math.min(size, height), width, Math.min(size, height));
        ctx.fillRect(0, 0, Math.min(size, width), height);
        ctx.fillRect(width - Math.min(size, width), 0, Math.min(size, width), height);
        ctx.restore();
        break;
      }
      case 'vignette': {
        const strength = clamp01(effect.amount);
        const gradient = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * .25, width / 2, height / 2, Math.max(width, height) * .72);
        const [r, g, b] = hexToRgb(effect.color);
        gradient.addColorStop(0, `rgba(${r},${g},${b},0)`);
        gradient.addColorStop(1, `rgba(${r},${g},${b},${strength})`);
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
        break;
      }
      case 'blur': {
        const radius = effect.amount * scale;
        if (radius <= .01) break;
        if (!detectFilterSupport(createCanvas)) { if (options.note) options.note('Este motor no aplica filtros de Canvas: el desenfoque se omitió.'); break; }
        throughFilter(`blur(${radius.toFixed(2)}px)`);
        break;
      }
      case 'glow': {
        const radius = Math.max(1, effect.size * scale);
        if (!detectFilterSupport(createCanvas)) { if (options.note) options.note('Este motor no aplica filtros de Canvas: el centelleo se omitió.'); break; }
        const glowLayer = createCanvas(width, height);
        const glowCtx = glowLayer.getContext('2d');
        if (!glowCtx) break;
        glowCtx.filter = `blur(${radius.toFixed(2)}px)`;
        glowCtx.drawImage(layer, 0, 0);
        glowCtx.filter = 'none';
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = clamp01(effect.amount);
        ctx.drawImage(glowLayer, 0, 0);
        ctx.restore();
        break;
      }
    }
  }
}
