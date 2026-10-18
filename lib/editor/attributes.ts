// Atributos de un evento: lo que se copia y se pega de un clip a otro.
//
// Es el «Copiar atributos de evento» / «Pegar atributos de evento» de VEGAS Pro 15: no se copia el material ni
// los tiempos, sino el *aspecto* del evento —los efectos de vídeo, el encuadre y el recorte, el estilo del
// texto (que es lo que llevan las plantillas), el generador, la corrección de color, los fundidos, la
// transición, la velocidad y el audio—. Al pegar se eligen los grupos, así que se puede llevar solo la pila de
// efectos, solo la plantilla de texto o todo junto.
import { Event } from './project';

export type AttributeGroupId = 'effects' | 'panCrop' | 'text' | 'generator' | 'colorCorrection' | 'fades' | 'transition' | 'speed' | 'audio';

export type AttributeGroup = {
  id: AttributeGroupId;
  label: string;
  note: string;
  keys: (keyof Event)[];
  // Algunos grupos solo tienen sentido en ciertos tipos de evento (el texto en los de texto, el audio en los
  // de audio, el generador en los de color…).
  kinds?: Event['kind'][];
};

export const ATTRIBUTE_GROUPS: AttributeGroup[] = [
  {
    id: 'effects', label: 'Efectos de vídeo', note: 'La pila de efectos, con su orden y sus ajustes.',
    keys: ['effects'], kinds: ['video', 'image', 'text', 'color'],
  },
  {
    id: 'panCrop', label: 'Panoramización y recorte', note: 'Encuadre (posición, escala, giro, opacidad y 3D), fotogramas clave, recorte y máscara libre.',
    keys: ['transform', 'keys', 'mask', 'maskPath'], kinds: ['video', 'image', 'text', 'color'],
  },
  {
    id: 'text', label: 'Títulos y texto (plantilla)', note: 'Fuente, tamaño, color, contorno, sombra, fondo, anclaje, animación y color de resalte: el estilo y la plantilla, sin cambiar el texto.',
    keys: ['font', 'fontSize', 'color', 'align', 'bold', 'italic', 'lineSpacing', 'tracking', 'wrap', 'outlineWidth', 'outlineColor', 'shadow', 'background', 'anchor', 'animation', 'highlightColor'],
    kinds: ['text'],
  },
  {
    id: 'generator', label: 'Generador de medios', note: 'El tipo de generador y sus dos colores, su ángulo y su tamaño.',
    keys: ['generator', 'color'], kinds: ['color'],
  },
  {
    id: 'colorCorrection', label: 'Color y correcciones', note: 'Brillo, contraste, saturación y tono.',
    keys: ['brightness', 'contrast', 'saturation', 'hue'], kinds: ['video', 'image', 'text', 'color'],
  },
  {
    id: 'fades', label: 'Fundidos de entrada y salida', note: 'La duración de los fundidos; nunca más larga que el evento destino.',
    keys: ['fadeIn', 'fadeOut'],
  },
  {
    id: 'transition', label: 'Transición de entrada', note: 'La transición del evento (necesita un fundido de entrada para verse).',
    keys: ['transition'], kinds: ['video', 'image', 'text', 'color'],
  },
  {
    id: 'speed', label: 'Velocidad', note: 'La velocidad de reproducción del material.',
    keys: ['speed'], kinds: ['video', 'image'],
  },
  {
    id: 'audio', label: 'Audio del evento', note: 'La ganancia y su envolvente.',
    keys: ['gain', 'gainCurve'], kinds: ['audio'],
  },
];

export const ALL_ATTRIBUTES: AttributeGroupId[] = ATTRIBUTE_GROUPS.map(group => group.id);
export const groupById = (id: AttributeGroupId) => ATTRIBUTE_GROUPS.find(group => group.id === id) ?? null;
// Un grupo se puede pegar en un evento si el tipo encaja (sin `kinds`, vale para todos).
export const groupFits = (group: AttributeGroup, kind: Event['kind']) => !group.kinds || group.kinds.includes(kind);
export const groupsFor = (kind: Event['kind']) => ATTRIBUTE_GROUPS.filter(group => groupFits(group, kind));

// Lo que se copia: solo los campos de los grupos elegidos que el evento tenga puestos. Los `undefined` no se
// copian, para que pegar no borre cosas del destino que la fuente no tenía.
export type CopiedAttributes = { from: string; groups: AttributeGroupId[]; patch: Partial<Event> };

export function copyAttributes(event: Event, groups: AttributeGroupId[] = ALL_ATTRIBUTES): CopiedAttributes {
  const patch: Record<string, unknown> = {};
  const used: AttributeGroupId[] = [];
  for (const id of groups) {
    const group = groupById(id);
    if (!group || !groupFits(group, event.kind)) continue;
    let contributed = false;
    for (const key of group.keys) {
      const value = (event as Record<string, unknown>)[key as string];
      if (value !== undefined) { patch[key as string] = structuredClone(value); contributed = true; }
    }
    if (contributed) used.push(id);
  }
  return { from: event.name, groups: used, patch: patch as Partial<Event> };
}

// Pega los atributos en otro evento, con los grupos elegidos. Nunca toca la identidad, el material, los
// tiempos ni el nombre, y recorta los fundidos para que no sean más largos que el evento.
export function pasteAttributes(target: Event, copied: CopiedAttributes, groups: AttributeGroupId[] = copied.groups): Event {
  const next: Event = { ...target };
  const record = next as Record<string, unknown>;
  for (const id of groups) {
    const group = groupById(id);
    if (!group || !groupFits(group, next.kind)) continue;
    for (const key of group.keys) {
      if (!(key in copied.patch)) continue;
      record[key as string] = structuredClone((copied.patch as Record<string, unknown>)[key as string]);
    }
  }
  // Un fundido más largo que el evento dejaría la imagen en negro: se limita al destino.
  next.fadeIn = Math.max(0, Math.min(next.fadeIn ?? 0, next.duration));
  next.fadeOut = Math.max(0, Math.min(next.fadeOut ?? 0, next.duration));
  return next;
}

// Qué se va a pegar realmente en un evento concreto: los grupos que llevan algo y encajan en su tipo.
export function pasteableGroups(copied: CopiedAttributes | null, kind: Event['kind']): AttributeGroupId[] {
  if (!copied) return [];
  return copied.groups.filter(id => {
    const group = groupById(id);
    if (!group || !groupFits(group, kind)) return false;
    return group.keys.some(key => key in copied.patch);
  });
}

// Resumen para el menú y la barra de estado: «3 grupos: efectos de vídeo, títulos y texto…».
export function describeAttributes(copied: CopiedAttributes | null, kind?: Event['kind']): string {
  if (!copied) return 'No hay atributos copiados.';
  const ids = kind ? pasteableGroups(copied, kind) : copied.groups;
  const labels = ids.map(id => groupById(id)?.label ?? id);
  if (!labels.length) return `Lo copiado de «${copied.from}» no se puede pegar en este evento.`;
  return `${labels.join(', ')} (copiado de «${copied.from}»)`;
}

// Cuántos campos distintos lleva lo copiado: sirve para avisar cuando la fuente no tenía nada que copiar.
export const attributeCount = (copied: CopiedAttributes | null) => copied ? Object.keys(copied.patch).length : 0;
