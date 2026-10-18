// Posiciones del texto en el fotograma: los nombres que se eligen de un vistazo —«Texto centrado», «Arriba a la
// izquierda», «Tercio inferior»…— con el punto de anclaje y el desplazamiento que dejan el texto ahí.
//
// El anclaje de cada posición se elige para que aguante cuando el texto crece: arriba el bloque cuelga hacia
// abajo (anclaje `top-*`), abajo crece hacia arriba (`bottom-*`) y en el centro se centra (`middle-*`). El
// desplazamiento va en fracciones del fotograma, la misma magnitud que «Posición X/Y (%)» de Panoramización y
// recorte, así que después se puede afinar desde esa ventana (o con la pose del evento en el `.corte15`).
//
// `y = .34` con el anclaje del centro es, exactamente, la posición que usa el generador de subtítulos
// (`SUBTITLE_STYLE.offsetY` en `lib/editor/subtitles.ts`): por eso se ofrece como «Subtítulo».
import type { Event, TextAnchor } from './project';

export type TextPosition = {
  id: string;
  name: string;                      // el nombre que se ve, como «Texto centrado»
  group: string;                     // para agrupar las entradas en la lista
  note: string;
  anchor: TextAnchor;                // qué punto del bloque se coloca en el sitio
  x: number; y: number;              // desplazamiento en fracciones del fotograma
};

// Margen de los bordes: el bloque toca el 5 % por la izquierda y el 95 % por la derecha (o el 8 % y el 92 % de
// alto), que es el mismo margen que usa el pintado clásico sin punto de anclaje.
const SIDE = .45;        // centro del fotograma ± 45 %
const TOP = -.42;        // el anclaje de arriba cae al 8 % del alto
const BOTTOM = .42;      // y el de abajo, al 92 %
const LOWER_THIRD = .14; // el tercio inferior: el bloque termina alrededor del 64 % del alto

export const TEXT_POSITION_GROUPS: string[] = ['Centro', 'Arriba', 'A los lados', 'Abajo', 'Tercio inferior'];

export const TEXT_POSITIONS: TextPosition[] = [
  { id: 'center', name: 'Texto centrado', group: 'Centro', anchor: 'middle-center', x: 0, y: 0, note: 'El bloque de texto, centrado en el fotograma y con cada línea centrada.' },
  { id: 'subtitle', name: 'Subtítulo (centro abajo)', group: 'Centro', anchor: 'middle-center', x: 0, y: .34, note: 'La posición que usa el generador de subtítulos: el centro del bloque al 84 % del alto.' },
  { id: 'top-center', name: 'Arriba (centrado)', group: 'Arriba', anchor: 'top-center', x: 0, y: TOP, note: 'El texto arriba y centrado; si crece, baja.' },
  { id: 'top-left', name: 'Arriba a la izquierda', group: 'Arriba', anchor: 'top-left', x: -SIDE, y: TOP, note: 'Arriba, pegado al margen izquierdo.' },
  { id: 'top-right', name: 'Arriba a la derecha', group: 'Arriba', anchor: 'top-right', x: SIDE, y: TOP, note: 'Arriba, pegado al margen derecho.' },
  { id: 'middle-left', name: 'Centro a la izquierda', group: 'A los lados', anchor: 'middle-left', x: -SIDE, y: 0, note: 'Centrado en vertical y pegado al margen izquierdo.' },
  { id: 'middle-right', name: 'Centro a la derecha', group: 'A los lados', anchor: 'middle-right', x: SIDE, y: 0, note: 'Centrado en vertical y pegado al margen derecho.' },
  { id: 'bottom-center', name: 'Abajo (centrado)', group: 'Abajo', anchor: 'bottom-center', x: 0, y: BOTTOM, note: 'El texto abajo y centrado; si crece, sube.' },
  { id: 'bottom-left', name: 'Abajo a la izquierda', group: 'Abajo', anchor: 'bottom-left', x: -SIDE, y: BOTTOM, note: 'Abajo, pegado al margen izquierdo.' },
  { id: 'bottom-right', name: 'Abajo a la derecha', group: 'Abajo', anchor: 'bottom-right', x: SIDE, y: BOTTOM, note: 'Abajo, pegado al margen derecho.' },
  { id: 'lower-third', name: 'Tercio inferior (centrado)', group: 'Tercio inferior', anchor: 'bottom-center', x: 0, y: LOWER_THIRD, note: 'Rótulo de la zona baja sin llegar al borde: el bloque termina alrededor del 64 % del alto.' },
  { id: 'lower-third-left', name: 'Tercio inferior a la izquierda', group: 'Tercio inferior', anchor: 'bottom-left', x: -SIDE, y: LOWER_THIRD, note: 'Rótulo de la zona baja, pegado al margen izquierdo.' },
  { id: 'lower-third-right', name: 'Tercio inferior a la derecha', group: 'Tercio inferior', anchor: 'bottom-right', x: SIDE, y: LOWER_THIRD, note: 'Rótulo de la zona baja, pegado al margen derecho.' },
];

export const textPositionById = (id: string): TextPosition | null => TEXT_POSITIONS.find(position => position.id === id) ?? null;

// Las posiciones que se ofrecen como botón de un clic, en el orden en que se ven.
export const QUICK_POSITIONS = ['center', 'top-center', 'bottom-center', 'subtitle'];

// Tolerancia al reconocer la posición puesta: los campos de Panoramización y recorte escriben porcentajes con un
// decimal, así que medio punto porcentual de diferencia sigue siendo la misma posición.
const TOLERANCE = .005;

// Aplica la posición: cambia el punto de anclaje y el desplazamiento del evento. El texto, el estilo y los
// tiempos se quedan como están; lo que se pise del encuadre (escala, giro) tampoco se toca.
export function applyTextPosition(event: Event, id: string): Event {
  const position = textPositionById(id);
  if (!position) return event;
  return { ...event, anchor: position.anchor, transform: { ...event.transform, x: position.x, y: position.y } };
}

// Qué posición describe el evento tal como está, o «custom» si no coincide con ninguna.
export function detectTextPosition(event: Partial<Event>): string {
  const anchor = event.anchor ?? 'middle-center';
  const x = event.transform?.x ?? 0, y = event.transform?.y ?? 0;
  const match = TEXT_POSITIONS.find(position =>
    position.anchor === anchor && Math.abs(position.x - x) < TOLERANCE && Math.abs(position.y - y) < TOLERANCE);
  return match?.id ?? 'custom';
}

// El nombre del anclaje, sin depender de `titles.ts` para que este módulo no arrastre el motor de pintado.
const POSITION_ANCHOR_LABEL: Record<TextAnchor, string> = {
  'top-left': 'arriba izquierda', 'top-center': 'arriba centro', 'top-right': 'arriba derecha',
  'middle-left': 'centro izquierda', 'middle-center': 'centro', 'middle-right': 'centro derecha',
  'bottom-left': 'abajo izquierda', 'bottom-center': 'abajo centro', 'bottom-right': 'abajo derecha',
};
const anchorLabel = (anchor: TextAnchor) => POSITION_ANCHOR_LABEL[anchor];

// Resumen para la interfaz: el nombre de la posición puesta o, si es una colocación propia, sus números.
export function describeTextPosition(event: Partial<Event>): string {
  const position = textPositionById(detectTextPosition(event));
  if (position) return `${position.name}: ${position.note}`;
  const x = Math.round((event.transform?.x ?? 0) * 100), y = Math.round((event.transform?.y ?? 0) * 100);
  return `Posición propia: ${x} % a la derecha y ${y} % hacia abajo del centro, con el anclaje en «${anchorLabel(event.anchor ?? 'middle-center')}».`;
}
