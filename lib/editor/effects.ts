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

export const EFFECT_KINDS: VideoEffectKind[] = ['blur', 'blackAndWhite', 'sepia', 'invert', 'chromaKey', 'pixelate', 'mirror', 'border', 'vignette', 'glow', 'chromaticAberration', 'filmGrain', 'posterize', 'tealOrange', 'bleachBypass', 'vhs', 'lightLeak', 'halation'];
export const EFFECT_LABEL: Record<VideoEffectKind, string> = {
  blur: 'Desenfoque gaussiano', blackAndWhite: 'Blanco y negro', sepia: 'Sepia', invert: 'Invertir',
  chromaKey: 'Clave cromática', pixelate: 'Pixelar', mirror: 'Espejo', border: 'Borde', vignette: 'Viñeta', glow: 'Centelleo',
  chromaticAberration: 'Aberración cromática', filmGrain: 'Grano de película', posterize: 'Posterizar',
  tealOrange: 'Teal & naranja', bleachBypass: 'Bleach bypass', vhs: 'VHS', lightLeak: 'Fuga de luz', halation: 'Halación',
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
  chromaticAberration: 'Separa los canales rojo y azul hacia los lados: el borde de color de las lentes y del glitch.',
  filmGrain: 'Grano fotográfico animado, con su intensidad y el tamaño de la partícula.',
  posterize: 'Reduce los niveles de color: el look de impresión y de los carteles.',
  tealOrange: 'Lleva las sombras al verde azulado y las luces al naranja: el contraste de cine.',
  bleachBypass: 'Desatura y sube el contraste: el revelado químico de las películas de acción.',
  vhs: 'Desplaza el color, marca las líneas de barrido y añade ruido: la cinta de los ochenta.',
  lightLeak: 'Una fuga de luz cálida cruza el fotograma en el ángulo elegido.',
  halation: 'Resplandor rojizo alrededor de las zonas claras, como la emulsión de cine.',
};
// Qué parámetros usa cada efecto, para que la interfaz muestre solo los que sirven.
export const EFFECT_PARAMS: Record<VideoEffectKind, ('amount' | 'size' | 'color' | 'softness' | 'horizontal' | 'vertical')[]> = {
  blur: ['amount'], blackAndWhite: ['amount'], sepia: ['amount'], invert: ['amount'],
  chromaKey: ['color', 'amount', 'softness'], pixelate: ['size'], mirror: ['horizontal', 'vertical'],
  border: ['size', 'color'], vignette: ['amount', 'color'], glow: ['size', 'amount'],
  chromaticAberration: ['amount', 'size'], filmGrain: ['amount', 'size'], posterize: ['amount', 'size'],
  tealOrange: ['amount'], bleachBypass: ['amount'], vhs: ['amount'],
  lightLeak: ['amount', 'color', 'size'], halation: ['amount', 'size', 'color'],
};

const clamp = (value: number, min: number, max: number) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
const clamp01 = (value: number) => clamp(value, 0, 1);
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;
const clamp255 = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

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
    case 'chromaticAberration': return { ...base, amount: .5, size: 4 };
    case 'filmGrain': return { ...base, amount: .22, size: 2 };
    case 'posterize': return { ...base, amount: .4, size: 10 };
    case 'tealOrange': return { ...base, amount: .4 };
    case 'bleachBypass': return { ...base, amount: .45 };
    case 'vhs': return { ...base, amount: .45 };
    case 'lightLeak': return { ...base, amount: .45, size: 135, color: '#ff9a4d' };
    case 'halation': return { ...base, amount: .35, size: 14, color: '#ff5a36' };
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

// Looks de un clic: varias tomas de la pila que, juntas, dan un acabado coherente. No son un efecto nuevo:
// se añaden a la pila como cualquier otro, se pueden reordenar, apagar o quitar una a una.
export type EffectLook = { id: string; label: string; note: string; effects: (Partial<VideoEffect> & { kind: VideoEffectKind })[] };
export const EFFECT_LOOKS: EffectLook[] = [
  {
    id: 'look-cinematico', label: 'Cine 2026',
    note: 'Teal & naranja suave, halación cálida y grano fino: el contraste de cine sin lavar la piel.',
    effects: [
      { kind: 'tealOrange', amount: .35 },
      { kind: 'halation', amount: .28, size: 16, color: '#ff6a3d' },
      { kind: 'filmGrain', amount: .12, size: 2 },
      { kind: 'vignette', amount: .25, color: '#000000' },
    ],
  },
  {
    id: 'look-vhs', label: 'VHS ochentero',
    note: 'Cinta gastada: color desplazado, líneas de barrido y ruido, con un grano grueso encima.',
    effects: [
      { kind: 'vhs', amount: .5 },
      { kind: 'chromaticAberration', amount: .32, size: 2 },
      { kind: 'filmGrain', amount: .18, size: 3 },
    ],
  },
  {
    id: 'look-dreamy', label: 'Ensueño',
    note: 'Halación amplia y una fuga de luz melocotón: el acabado suave de los vídeos de belleza y lifestyle.',
    effects: [
      { kind: 'halation', amount: .4, size: 24, color: '#ffb39a' },
      { kind: 'lightLeak', amount: .3, size: 135, color: '#ffb36b' },
      { kind: 'glow', amount: .3, size: 18 },
    ],
  },
  {
    id: 'look-noir', label: 'Noir',
    note: 'Blanco y negro con grano y viñeta cerrada: el blanco y negro de las entrevistas y los crímenes.',
    effects: [
      { kind: 'blackAndWhite', amount: .95 },
      { kind: 'filmGrain', amount: .22, size: 2 },
      { kind: 'vignette', amount: .5, color: '#000000' },
      { kind: 'bleachBypass', amount: .2 },
    ],
  },
  {
    id: 'look-editorial', label: 'Editorial limpio',
    note: 'Un contraste de color muy leve y grano casi invisible: el look de marca que no grita.',
    effects: [
      { kind: 'tealOrange', amount: .18 },
      { kind: 'filmGrain', amount: .07, size: 2 },
      { kind: 'bleachBypass', amount: .12 },
    ],
  },
];

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
// La detección de filtros crea dos lienzos de 2×2 y se llamaba una vez por efecto y fotograma: el resultado no
// cambia para una misma fábrica, así que se recuerda.
const filterSupportCache = new WeakMap<CanvasFactory, boolean>();
function filterSupportFor(createCanvas: CanvasFactory): boolean {
  const cached = filterSupportCache.get(createCanvas);
  if (cached !== undefined) return cached;
  const support = detectFilterSupport(createCanvas);
  filterSupportCache.set(createCanvas, support);
  return support;
}

// Lienzos de trabajo compartidos entre eventos y fotogramas: los efectos de un fotograma se aplican uno detrás
// de otro, sin esperas de por medio, así que reutilizar el lienzo del evento anterior es seguro (se limpia al
// tomarlo). Se guardan pocos por medida para que la memoria retenida quede acotada.
const SCRATCH_POOL_LIMIT = 2;
const SCRATCH_POOL_SIZES = 4;
const scratchPools = new Map<string, HTMLCanvasElement[]>();
function takeScratch(createCanvas: CanvasFactory, width: number, height: number): HTMLCanvasElement {
  const key = `${width}x${height}`;
  const pool = scratchPools.get(key);
  const canvas = pool && pool.length ? pool.pop()! : createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.clearRect(0, 0, width, height);
  }
  return canvas;
}
function giveScratch(canvas: HTMLCanvasElement | null | undefined): void {
  if (!canvas) return;
  const key = `${canvas.width}x${canvas.height}`;
  const pool = scratchPools.get(key) ?? [];
  if (pool.length < SCRATCH_POOL_LIMIT) pool.push(canvas);
  // Se acota también el número de medidas distintas: cambiar de calidad o de resolución no debe ir acumulando
  // lienzos de cada tamaño.
  if (!scratchPools.has(key) && scratchPools.size >= SCRATCH_POOL_SIZES) {
    const oldest = scratchPools.keys().next().value;
    if (oldest !== undefined) scratchPools.delete(oldest);
  }
  scratchPools.set(key, pool);
}

export function applyEffects(layer: HTMLCanvasElement, effects: VideoEffect[], options: { scale: number; createCanvas: CanvasFactory; note?: (message: string) => void; time?: number }): void {
  const ctx = layer.getContext('2d');
  if (!ctx) return;
  const { createCanvas } = options;
  const scale = Number.isFinite(options.scale) && options.scale > 0 ? options.scale : 1;
  const width = layer.width, height = layer.height;



  // Vuelca la capa en otro lienzo con un filtro de Canvas aplicado.
  const throughFilter = (filter: string, blend: GlobalCompositeOperation = 'source-over', alpha = 1) => {
    const scratch = takeScratch(createCanvas, width, height);
    const scratchCtx = scratch.getContext('2d');
    if (!scratchCtx) return;
    scratchCtx.filter = filter;
    scratchCtx.globalAlpha = alpha;
    scratchCtx.globalCompositeOperation = blend;
    scratchCtx.drawImage(layer, 0, 0);
    scratchCtx.filter = 'none';
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(scratch, 0, 0);
    giveScratch(scratch);
  };
  const withCopy = (draw: (copy: CanvasRenderingContext2D) => void) => {
    const scratch = takeScratch(createCanvas, width, height);
    const scratchCtx = scratch.getContext('2d');
    if (!scratchCtx) return;
    draw(scratchCtx);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(scratch, 0, 0);
    giveScratch(scratch);
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
        if (!filterSupportFor(createCanvas)) { if (options.note) options.note('Este motor no aplica filtros de Canvas: el desenfoque se omitió.'); break; }
        throughFilter(`blur(${radius.toFixed(2)}px)`);
        break;
      }
      case 'glow': {
        const radius = Math.max(1, effect.size * scale);
        if (!filterSupportFor(createCanvas)) { if (options.note) options.note('Este motor no aplica filtros de Canvas: el centelleo se omitió.'); break; }
        const glowLayer = takeScratch(createCanvas, width, height);
        const glowCtx = glowLayer.getContext('2d');
        if (!glowCtx) break;
        glowCtx.filter = `blur(${radius.toFixed(2)}px)`;
        glowCtx.drawImage(layer, 0, 0);
        glowCtx.filter = 'none';
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = clamp01(effect.amount);
        ctx.drawImage(glowLayer, 0, 0);
        giveScratch(glowLayer);
        ctx.restore();
        break;
      }
      case 'chromaticAberration': {
        // Los canales rojo y azul se separan a izquierda y derecha; el verde se queda en el centro. La mezcla
        // controla cuánto se nota, y el tamaño, cuántos píxeles se desplazan.
        const offset = Math.max(1, Math.round(effect.size * scale));
        const amount = clamp01(effect.amount);
        if (!amount) break;
        const image = ctx.getImageData(0, 0, width, height), data = image.data;
        const source = new Uint8ClampedArray(data);
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          const right = Math.min(width - 1, x + offset), left = Math.max(0, x - offset);
          data[index] = clamp255(mix(data[index], source[(y * width + right) * 4], amount));
          data[index + 2] = clamp255(mix(data[index + 2], source[(y * width + left) * 4 + 2], amount));
        }
        ctx.putImageData(image, 0, 0);
        break;
      }
      case 'filmGrain': {
        // Ruido determinista (la misma semilla da el mismo grano en la vista previa y en el archivo) con un
        // tamaño de partícula configurable.
        const amount = clamp01(effect.amount);
        if (!amount) break;
        const grain = Math.max(1, Math.round(effect.size * scale));
        const image = ctx.getImageData(0, 0, width, height), data = image.data;
        // El grano cambia a 24 pasos por segundo, como el de una película: si no, se queda congelado y se nota.
        const frame = Math.floor((options.time ?? 0) * 24);
        const noise = (x: number, y: number) => {
          let hash = (x * 374761393 + y * 668265263 + frame * 2246822519) >>> 0;
          hash = ((hash ^ (hash >>> 13)) * 1274126177) >>> 0;
          return (((hash ^ (hash >>> 16)) >>> 0) / 4294967295) * 2 - 1;
        };
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          const value = noise(Math.floor(x / grain), Math.floor(y / grain)) * amount * 28;
          data[index] = clamp255(data[index] + value);
          data[index + 1] = clamp255(data[index + 1] + value);
          data[index + 2] = clamp255(data[index + 2] + value);
        }
        ctx.putImageData(image, 0, 0);
        break;
      }
      case 'posterize': {
        const amount = clamp01(effect.amount), levels = Math.max(2, Math.min(64, Math.round(effect.size)));
        const step = 255 / (levels - 1);
        pixelPass(layer, ctx, (r, g, b, a) => [
          mix(r, Math.round(r / step) * step, amount),
          mix(g, Math.round(g / step) * step, amount),
          mix(b, Math.round(b / step) * step, amount), a,
        ]);
        break;
      }
      case 'tealOrange': {
        const amount = clamp01(effect.amount);
        pixelPass(layer, ctx, (r, g, b, a) => {
          const luma = (.2126 * r + .7152 * g + .0722 * b) / 255;
          // Las sombras se quedan en el verde azulado y solo las luces van al naranja: sin este reparto, un
          // gris medio ya saldría cobrizo y el grado de color se comería la imagen.
          const split = Math.max(0, Math.min(1, (luma - .25) / .6));
          return [
            mix(r, mix(8, 255, split), amount),
            mix(g, mix(58, 150, split), amount),
            mix(b, mix(78, 70, split), amount), a,
          ];
        });
        break;
      }
      case 'bleachBypass': {
        const amount = clamp01(effect.amount);
        pixelPass(layer, ctx, (r, g, b, a) => {
          const luma = .2126 * r + .7152 * g + .0722 * b;
          const contrast = Math.max(0, Math.min(255, (luma - 128) * 1.45 + 128));
          return [mix(r, mix(r, contrast, .7), amount), mix(g, mix(g, contrast, .7), amount), mix(b, mix(b, contrast, .7), amount), a];
        });
        break;
      }
      case 'vhs': {
        const amount = clamp01(effect.amount), offset = Math.max(1, Math.round(2 * scale));
        const image = ctx.getImageData(0, 0, width, height), data = image.data;
        const source = new Uint8ClampedArray(data);
        const line = Math.max(2, Math.round(3 * scale));
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          const right = Math.min(width - 1, x + offset), left = Math.max(0, x - offset);
          const scan = y % line === 0 ? -.16 * amount : 0;
          const noise = ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1) * amount * 14;
          data[index] = clamp255(mix(data[index], source[(y * width + right) * 4], .8 * amount) * (1 + scan) + noise);
          data[index + 1] = clamp255(mix(data[index + 1], source[index + 1], .8 * amount) * (1 + scan) + noise);
          data[index + 2] = clamp255(mix(data[index + 2], source[(y * width + left) * 4 + 2], .8 * amount) * (1 + scan) + noise);
        }
        ctx.putImageData(image, 0, 0);
        break;
      }
      case 'lightLeak': {
        const amount = clamp01(effect.amount);
        if (!amount) break;
        const angle = (effect.size || 0) * Math.PI / 180;
        const cx = width / 2, cy = height / 2;
        const dx = Math.cos(angle) * width / 2, dy = Math.sin(angle) * height / 2;
        const [r, g, b] = hexToRgb(effect.color);
        const leak = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
        leak.addColorStop(0, `rgba(${r},${g},${b},0)`);
        leak.addColorStop(.5, `rgba(${r},${g},${b},${(amount * .55).toFixed(3)})`);
        leak.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = leak;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
        break;
      }
      case 'halation': {
        const radius = Math.max(1, effect.size * scale), amount = clamp01(effect.amount);
        if (!amount) break;
        if (!filterSupportFor(createCanvas)) { if (options.note) options.note('Este motor no aplica filtros de Canvas: la halación se omitió.'); break; }
        const glowLayer = takeScratch(createCanvas, width, height);
        const glowCtx = glowLayer.getContext('2d');
        if (!glowCtx) break;
        glowCtx.filter = `blur(${radius.toFixed(2)}px)`;
        glowCtx.drawImage(layer, 0, 0);
        glowCtx.filter = 'none';
        const tinted = takeScratch(createCanvas, width, height);
        const tintedCtx = tinted.getContext('2d');
        if (!tintedCtx) { giveScratch(glowLayer); break; }
        tintedCtx.drawImage(glowLayer, 0, 0);
        tintedCtx.globalCompositeOperation = 'source-in';
        tintedCtx.fillStyle = effect.color;
        tintedCtx.fillRect(0, 0, width, height);
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = amount;
        ctx.drawImage(glowLayer, 0, 0);
        ctx.globalAlpha = amount * .7;
        ctx.drawImage(tinted, 0, 0);
        ctx.restore();
        giveScratch(glowLayer);
        giveScratch(tinted);
        break;
      }
    }
  }
}
