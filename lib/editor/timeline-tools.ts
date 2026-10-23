// Herramientas de edición de la barra de «transporte y edición» de Vegas Pro 15. El manual las describe en la
// página 17 («Herramienta de edición») y en la 30 (tabla de la barra): la normal, la de envolventes, la de
// selección y la de zoom. Los nombres de aquí son los del manual en español, y las notas dicen qué hace cada una
// para que la barra, la ayuda y las pruebas cuenten lo mismo.
export type TimelineTool = 'normal' | 'envelope' | 'selection' | 'zoom';
export const TIMELINE_TOOLS: readonly TimelineTool[] = ['normal', 'envelope', 'selection', 'zoom'];
export const TOOL_LABEL: Record<TimelineTool, string> = {
  normal: 'Herramienta de edición normal',
  envelope: 'Herramienta de edición de envolventes',
  selection: 'Herramienta de edición de selección',
  zoom: 'Herramienta de edición de zoom',
};
export const TOOL_NOTE: Record<TimelineTool, string> = {
  normal: 'Selecciona y mueve eventos, y recorta por sus bordes: es la herramienta de siempre.',
  envelope: 'Los clics van a la envolvente: añaden un punto sin mover los eventos de debajo.',
  selection: 'Arrastra un rectángulo sobre la línea de tiempo para seleccionar todos los eventos que toca.',
  zoom: 'Clic acerca el zoom, Alt+clic lo aleja y arrastrando se encuadra el tramo que se atraviesa.',
};

// Rectángulo de selección en píxeles del contenido de la línea de tiempo (izquierda/arriba del carril incluidos).
export type SelectionBox = { left: number; top: number; right: number; bottom: number };
export const normalizeBox = (from: { x: number; y: number }, to: { x: number; y: number }): SelectionBox => ({
  left: Math.min(from.x, to.x),
  top: Math.min(from.y, to.y),
  right: Math.max(from.x, to.x),
  bottom: Math.max(from.y, to.y),
});
// Un evento entra en la selección si su rectángulo se cruza con el del gesto (no hace falta rodearlo entero).
export type BoxItem = { id: string; left: number; top: number; width: number; height: number };
export const idsInBox = (items: readonly BoxItem[], box: SelectionBox): string[] =>
  items.filter((item) => item.left < box.right && item.left + item.width > box.left && item.top < box.bottom && item.top + item.height > box.top).map((item) => item.id);
// Cuántos eventos toca el rectángulo: la barra lo dice en el estado mientras se arrastra.
export const boxSize = (box: SelectionBox) => ({ width: box.right - box.left, height: box.bottom - box.top });

// Zoom para encuadrar un tramo: el ancho del hueco entre los segundos elegidos. `viewport` es el ancho visible en
// píxeles y los límites son los mismos que los del resto del zoom de la línea de tiempo (1 … 400 px/s).
export function zoomForRange(startSeconds: number, endSeconds: number, viewport: number, limits = { min: 1, max: 400 }): number {
  const span = Math.max(1e-3, Math.abs(endSeconds - startSeconds));
  return Math.min(limits.max, Math.max(limits.min, viewport / span));
}
