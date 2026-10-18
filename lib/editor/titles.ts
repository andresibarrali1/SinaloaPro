// Títulos y texto: la composición tipográfica, en funciones puras y comprobables.
//
// Los parámetros son los del plugin «Títulos & Texto de VEGAS» de VEGAS Pro 15, leídos de su archivo de
// recursos (`OFX Video Plug-Ins\TitlesAndText.ofx.bundle\Contents\Resources\TitlesAndText.es-ES.xml`):
// Texto, Escala, Ubicación, Color del texto, Animación, Punto de anclaje (9), Fondo, Seguimiento,
// Interlineado, Contorno (grosor y color) y Sombra (activar, color, desplazamiento X/Y y difuminado).
//
// Aquí solo se calcula el plan de dibujo (líneas, fuente, posición del bloque) y el estado de la animación;
// pintar es cosa de `compositor.ts`. El cálculo no depende del lienzo: la medición del texto se recibe como
// función, de modo que se puede probar sin navegador y con una regla de medir de mentira.
import { TextAnchor, TextAnimation } from './project';

export type Frame = { width: number; height: number };
export type Align = 'left' | 'center' | 'right';

// Los valores por defecto reproducen exactamente el pintado anterior: interlineado 1,2 y sin ajuste de
// línea, así que un proyecto antiguo se sigue viendo igual hasta que se cambie algo a mano.
export const DEFAULT_LINE_SPACING = 1.2;
export const DEFAULT_WRAP = 1;
export const DEFAULT_ANCHOR: TextAnchor = 'middle-center';

export const ANCHORS: TextAnchor[] = ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'];
export const ANCHOR_LABEL: Record<TextAnchor, string> = {
  'top-left': 'Arriba izquierda', 'top-center': 'Arriba centro', 'top-right': 'Arriba derecha',
  'middle-left': 'Centro izquierda', 'middle-center': 'Centro', 'middle-right': 'Centro derecha',
  'bottom-left': 'Abajo izquierda', 'bottom-center': 'Abajo centro', 'bottom-right': 'Abajo derecha',
};
export const ANIMATIONS: { value: TextAnimation; label: string }[] = [
  { value: 'none', label: 'Ninguna (estático)' },
  { value: 'fade', label: 'Fundido de entrada' },
  { value: 'pop', label: 'Aparición con rebote (pop)' },
  { value: 'zoom-in', label: 'Zoom de entrada' },
  { value: 'slide-up', label: 'Entrada desde abajo' },
  { value: 'slide-down', label: 'Entrada desde arriba' },
  { value: 'bounce', label: 'Rebote continuo' },
  { value: 'shake', label: 'Sacudida' },
  { value: 'karaoke', label: 'Karaoke (palabra a palabra)' },
  { value: 'scroll-up', label: 'Desplazamiento hacia arriba (títulos de crédito)' },
  { value: 'scroll-left', label: 'Desplazamiento hacia la izquierda' },
  { value: 'typewriter', label: 'Máquina de escribir' },
];
export const FONTS = ['Arial', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Georgia', 'Times New Roman', 'Courier New', 'Impact', 'Segoe UI', 'Comic Sans MS'];

// La fuente se compone con el tamaño ya escalado a la resolución de render, como hacía el pintado anterior.
export function buildFont(font: string, size: number, bold = false, italic = false) {
  return `${italic ? 'italic ' : ''}${bold ? '700 ' : ''}${Math.max(1, size)}px ${font || 'Arial'}`;
}
export function wrapLines(text: string, maxWidth: number, measure: (line: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of String(text ?? '').split('\n')) {
    if (!paragraph) { lines.push(''); continue; }
    if (!(maxWidth > 0)) { lines.push(paragraph); continue; }
    let current = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && measure(candidate) > maxWidth) { lines.push(current); current = word; }
      else current = candidate;
    }
    lines.push(current);
  }
  return lines;
}

export type TextPlanInput = {
  text: string; font: string; fontSize: number; align: Align;
  bold?: boolean; italic?: boolean; lineSpacing?: number; wrap?: number; anchor?: TextAnchor;
  x: number; y: number;                 // desplazamiento del evento, en fracciones del fotograma
  project: Frame; frame: Frame;         // el tamaño de letra se escala del proyecto a la resolución de render
  measure: (text: string, font: string) => number;
};
export type TextPlan = {
  lines: string[]; font: string; size: number; lineHeight: number;
  align: Align; x: number; top: number;                       // dónde y cómo se dibuja cada línea
  blockLeft: number; blockTop: number; blockWidth: number; blockHeight: number;
};
export function planText(input: TextPlanInput): TextPlan {
  const size = Math.max(1, input.fontSize * input.frame.height / Math.max(1, input.project.height));
  const font = buildFont(input.font, size, input.bold, input.italic);
  const spacing = Number.isFinite(input.lineSpacing as number) ? Math.max(.5, Math.min(4, input.lineSpacing as number)) : DEFAULT_LINE_SPACING;
  const maxWidth = input.frame.width * Math.max(.1, Math.min(1, input.wrap ?? DEFAULT_WRAP));
  const measure = (line: string) => input.measure(line, font);
  const lines = wrapLines(input.text, maxWidth, measure);
  const lineHeight = size * spacing;
  const blockWidth = lines.reduce((widest, line) => Math.max(widest, measure(line)), 0);
  const blockHeight = lineHeight * lines.length;
  const centerX = input.frame.width / 2 + input.x * input.frame.width;
  const centerY = input.frame.height / 2 + input.y * input.frame.height;

  if (input.anchor) {
    const horizontal: Align = input.anchor.endsWith('left') ? 'left' : input.anchor.endsWith('right') ? 'right' : 'center';
    const vertical = input.anchor.startsWith('top') ? 'top' : input.anchor.startsWith('bottom') ? 'bottom' : 'middle';
    const blockLeft = horizontal === 'left' ? centerX : horizontal === 'right' ? centerX - blockWidth : centerX - blockWidth / 2;
    const blockTop = vertical === 'top' ? centerY : vertical === 'bottom' ? centerY - blockHeight : centerY - blockHeight / 2;
    const x = horizontal === 'left' ? blockLeft : horizontal === 'right' ? blockLeft + blockWidth : blockLeft + blockWidth / 2;
    return { lines, font, size, lineHeight, align: horizontal, x, top: blockTop, blockLeft, blockTop, blockWidth, blockHeight };
  }
  // Sin punto de anclaje (proyectos anteriores): la colocación clásica, con márgenes del 8 % a los lados.
  const align = input.align;
  const x = (align === 'left' ? input.frame.width * .08 : align === 'right' ? input.frame.width * .92 : centerX);
  const top = centerY - blockHeight / 2;
  const blockLeft = align === 'left' ? x : align === 'right' ? x - blockWidth : x - blockWidth / 2;
  return { lines, font, size, lineHeight, align, x, top, blockLeft, blockTop: top, blockWidth, blockHeight };
}

// ------------------------------------------------------------------ animación

// Estado de la animación en un instante. Los desplazamientos van en píxeles del fotograma de render; `scale` y
// `rotation` los aplica el compositor alrededor del centro del bloque de texto. `highlight` es la fracción de
// palabras ya resaltadas (karaoke): -1 significa «no hay resaltado».
export type AnimationState = { opacity: number; dx: number; dy: number; chars: number; scale: number; rotation: number; highlight: number };
export const STILL: AnimationState = { opacity: 1, dx: 0, dy: 0, chars: -1, scale: 1, rotation: 0, highlight: -1 };
// Rebote de salida (easeOutBack): pasa de largo del 1 y vuelve, que es el gesto de las plantillas de redes.
const easeOutBack = (t: number) => { const c = 1.70158, f = Math.max(0, Math.min(1, t)) - 1; return 1 + (c + 1) * f * f * f + c * f * f; };
// El progreso se mide dentro del evento.
export function animationState(animation: TextAnimation | undefined, local: number, duration: number, frame: Frame): AnimationState {
  const progress = duration > 0 ? Math.max(0, Math.min(1, local / duration)) : 1;
  // Las entradas duran lo que dura el evento, como en el plugin de VEGAS, pero con un tope de 0,6 s para que
  // una plantilla de redes no tarde tres segundos en aparecer.
  const entrance = Math.max(.05, Math.min(1, .6 / Math.max(.001, duration / 705600000)));
  const entry = Math.max(0, Math.min(1, progress / entrance));
  const seconds = duration / 705600000;
  const cycle = seconds > 0 ? local / 705600000 / seconds : progress;   // vueltas completas dentro del evento
  switch (animation) {
    case 'fade': return { ...STILL, opacity: Math.min(1, progress * 4) };
    case 'pop': return { ...STILL, opacity: Math.min(1, entry * 3), scale: Math.max(.05, easeOutBack(entry)) };
    case 'zoom-in': return { ...STILL, opacity: Math.min(1, entry * 3), scale: .2 + .8 * (1 - Math.pow(1 - entry, 3)) };
    case 'slide-up': return { ...STILL, opacity: Math.min(1, entry * 3), dy: (1 - entry) * frame.height * .25 };
    case 'slide-down': return { ...STILL, opacity: Math.min(1, entry * 3), dy: -(1 - entry) * frame.height * .25 };
    case 'bounce': return { ...STILL, dy: -Math.abs(Math.sin(cycle * Math.PI * 3)) * frame.height * .04 };
    case 'shake': return { ...STILL, dx: Math.sin(cycle * Math.PI * 10) * frame.width * .008, rotation: Math.sin(cycle * Math.PI * 10) * 1.5 };
    case 'karaoke': return { ...STILL, highlight: progress };
    case 'scroll-up': return { ...STILL, dy: (1 - progress) * frame.height };
    case 'scroll-left': return { ...STILL, dx: (1 - progress) * frame.width };
    case 'typewriter': return { ...STILL, chars: progress };
    default: return STILL;
  }
}
// Cuántas palabras van resaltadas con una fracción de karaoke. Con el texto entero son las que haya.
export function highlightedWords(text: string, highlight: number): number {
  if (highlight < 0) return -1;
  const words = String(text ?? '').split(/\s+/).filter(Boolean).length;
  return Math.max(0, Math.min(words, Math.floor(words * Math.max(0, Math.min(1, highlight)))));
}
// Reparte las palabras de una línea con su posición, para poder pintarlas de dos colores (karaoke) o animarlas
// una a una. `x` es el punto de alineación que usa el lienzo y `align` su alineación.
export function layoutWords(lines: string[], measure: (text: string) => number, align: Align, x: number, spaceWidth: number): {text: string; left: number}[] {
  const out: {text: string; left: number}[] = [];
  for (const line of lines) {
    const words = line.split(/\s+/).filter(Boolean);
    const width = words.reduce((total, word) => total + measure(word), 0) + spaceWidth * Math.max(0, words.length - 1);
    let cursor = align === 'left' ? x : align === 'right' ? x - width : x - width / 2;
    for (const word of words) {
      out.push({ text: word, left: cursor });
      cursor += measure(word) + spaceWidth;
    }
  }
  return out;
}
// `chars` es una fracción entre 0 y 1; -1 significa «el texto entero».
export function revealText(text: string, chars: number): string {
  if (chars < 0) return text;
  const total = String(text ?? '').replace(/\n/g, '').length;
  const wanted = Math.floor(total * Math.max(0, Math.min(1, chars)));
  let seen = 0, out = '';
  for (const character of String(text ?? '')) {
    if (character === '\n') { out += character; continue; }
    if (seen >= wanted) break;
    out += character;
    seen += 1;
  }
  return out;
}

// ------------------------------------------------------------------ estado de edición

export type TextStyle = {
  bold: boolean; italic: boolean; lineSpacing: number; tracking: number; wrap: number;
  outlineWidth: number; outlineColor: string;
  shadow: { enabled: boolean; color: string; offsetX: number; offsetY: number; blur: number };
  background: { color: string; opacity: number; padding: number };
  anchor: TextAnchor; animation: TextAnimation; highlightColor: string;
};
export const DEFAULT_HIGHLIGHT = '#ffe600';
export function styleOf(event: Partial<TextStyle>): TextStyle {
  return {
    bold: event.bold ?? false,
    italic: event.italic ?? false,
    lineSpacing: event.lineSpacing ?? DEFAULT_LINE_SPACING,
    tracking: event.tracking ?? 0,
    wrap: event.wrap ?? DEFAULT_WRAP,
    outlineWidth: event.outlineWidth ?? 0,
    outlineColor: event.outlineColor ?? '#000000',
    shadow: { enabled: false, color: '#000000', offsetX: 4, offsetY: 4, blur: 6, ...(event.shadow ?? {}) },
    background: { color: '#000000', opacity: 0, padding: 18, ...(event.background ?? {}) },
    anchor: event.anchor ?? DEFAULT_ANCHOR,
    animation: event.animation ?? 'none',
    highlightColor: event.highlightColor ?? DEFAULT_HIGHLIGHT,
  };
}
export const hasTextStyling = (event: Partial<TextStyle>) => Boolean(
  event.bold || event.italic || event.anchor || event.animation || event.outlineWidth || event.highlightColor ||
  event.shadow?.enabled || (event.background?.opacity ?? 0) > 0 || event.tracking || (event.wrap !== undefined && event.wrap < 1) ||
  (event.lineSpacing !== undefined && event.lineSpacing !== DEFAULT_LINE_SPACING),
);
