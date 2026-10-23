// Plantillas de texto y subtítulos al estilo de las de CapCut: contorno, sombra, caja de fondo, color de
// resalte y una animación de entrada (o continua) por plantilla.
//
// Una plantilla solo cambia el aspecto y la animación del evento de texto: no toca su contenido, su duración,
// su posición en la línea de tiempo ni su encuadre (eso es de Panoramización y recorte). Las medidas de letra
// son las del proyecto de 1080 de alto; como el tamaño se escala del proyecto al render, una plantilla vale
// igual en vertical que en horizontal.
import { Event, TextAnchor } from './project';
import { DEFAULT_LINE_SPACING, DEFAULT_HIGHLIGHT } from './titles';

export type TextPreset = {
  id: string;
  name: string;
  group: string;
  note: string;
  patch: Partial<Event>;
};

// Valores con los que se completa cada plantilla. Así todas fijan todos los campos del estilo y cambiar de
// plantilla no deja restos de la anterior (por ejemplo, el contorno de una o el resalte del karaoke).
const PRESET_DEFAULTS: Partial<Event> = {
  font: 'Arial', fontSize: 72, color: '#ffffff', bold: false, italic: false,
  anchor: 'middle-center', animation: 'fade', outlineWidth: 0, outlineColor: '#000000',
  shadow: { enabled: false, color: '#000000', offsetX: 0, offsetY: 3, blur: 6 },
  background: { color: '#000000', opacity: 0, padding: 18 },
  tracking: 0, wrap: .9, lineSpacing: DEFAULT_LINE_SPACING, highlightColor: DEFAULT_HIGHLIGHT,
};

const RAW_PRESETS: TextPreset[] = [
 {id:'motion-slide-left',name:'Entrada desde la izquierda',group:'Nuevas animaciones',note:'Entrada desde la izquierda para títulos y subtítulos; conserva el texto y sus tiempos.',patch:{font:'Arial',fontSize:88,bold:true,color:'#ffffff',outlineWidth:5,animation:'slide-left'}},
 {id:'motion-slide-right',name:'Entrada desde la derecha',group:'Nuevas animaciones',note:'Entrada desde la derecha para títulos y subtítulos; conserva el texto y sus tiempos.',patch:{font:'Arial',fontSize:88,bold:true,color:'#fff38c',outlineWidth:5,animation:'slide-right'}},
 {id:'motion-spin-in',name:'Giro de entrada',group:'Nuevas animaciones',note:'Giro de entrada para títulos y subtítulos; conserva el texto y sus tiempos.',patch:{font:'Arial',fontSize:88,bold:true,color:'#ffb0ed',outlineWidth:5,animation:'spin-in'}},
 {id:'motion-drop-in',name:'Caída elástica',group:'Nuevas animaciones',note:'Caída elástica para títulos y subtítulos; conserva el texto y sus tiempos.',patch:{font:'Arial',fontSize:88,bold:true,color:'#baff00',outlineWidth:5,animation:'drop-in'}},
 {id:'motion-zoom-out',name:'Alejamiento de entrada',group:'Nuevas animaciones',note:'Alejamiento de entrada para títulos y subtítulos; conserva el texto y sus tiempos.',patch:{font:'Arial',fontSize:88,bold:true,color:'#ffffff',outlineWidth:5,animation:'zoom-out'}},
 {id:'motion-pulse',name:'Pulso continuo',group:'Nuevas animaciones',note:'Pulso continuo para títulos y subtítulos; conserva el texto y sus tiempos.',patch:{font:'Arial',fontSize:88,bold:true,color:'#ff6688',outlineWidth:5,animation:'pulse'}},
 {id:'motion-float',name:'Flotación suave',group:'Nuevas animaciones',note:'Flotación suave para títulos y subtítulos; conserva el texto y sus tiempos.',patch:{font:'Arial',fontSize:88,bold:true,color:'#a6eeff',outlineWidth:5,animation:'float'}},
 {id:'motion-swing',name:'Balanceo continuo',group:'Nuevas animaciones',note:'Balanceo continuo para títulos y subtítulos; conserva el texto y sus tiempos.',patch:{font:'Arial',fontSize:88,bold:true,color:'#ffda57',outlineWidth:5,animation:'swing'}},
 {id:'social-lima',name:'Palabra lima',group:'Subtítulos dinámicos',note:'Palabra verde lima con borde negro y entrada elástica.',patch:{font:'Arial',fontSize:86,bold:true,color:'#baff00',outlineWidth:9,animation:'pop',anchor:'bottom-center'}},
 {id:'social-pill',name:'Etiqueta violeta',group:'Subtítulos dinámicos',note:'Texto blanco sobre una caja violeta con entrada ascendente.',patch:{font:'Arial',fontSize:70,bold:true,color:'#ffffff',background:{color:'#672ee8',opacity:.95,padding:20},animation:'slide-up',anchor:'bottom-center'}},
 {id:'social-pink',name:'Pop rosa',group:'Subtítulos dinámicos',note:'Letra rosa con contorno blanco y rebote de entrada.',patch:{font:'Arial',fontSize:88,bold:true,color:'#ff389b',outlineWidth:6,outlineColor:'#ffffff',shadow:{enabled:true,color:'#451a40',offsetX:4,offsetY:5,blur:3},animation:'pop',anchor:'bottom-center'}},
 {id:'social-clean',name:'Minimal deslizante',group:'Subtítulos dinámicos',note:'Blanco sobre banda oscura translúcida, entrada desde arriba.',patch:{font:'Arial',fontSize:66,color:'#ffffff',background:{color:'#101010',opacity:.72,padding:16},animation:'slide-down',anchor:'bottom-center'}},
 {id:'social-comic',name:'Cómic amarillo',group:'Títulos dinámicos',note:'Letra gruesa amarilla, sombra marcada y sacudida.',patch:{font:'Arial',fontSize:104,bold:true,color:'#ffe600',outlineWidth:7,outlineColor:'#141414',shadow:{enabled:true,color:'#000000',offsetX:7,offsetY:7,blur:0},animation:'shake'}},
 {id:'social-cyan',name:'Cian eléctrico',group:'Títulos dinámicos',note:'Texto cian con brillo y acercamiento animado.',patch:{font:'Arial',fontSize:96,bold:true,color:'#8cffff',outlineWidth:3,outlineColor:'#00badb',shadow:{enabled:true,color:'#00c8ff',offsetX:0,offsetY:0,blur:32},animation:'zoom-in'}},

  {
    id: 'tiktok-clasico', name: 'TikTok clásico', group: 'Redes (vertical)',
    note: 'Blanco en negrita con contorno negro y sombra, aparece con rebote. El subtítulo que más se ve en TikTok.',
    patch: { font: 'Arial', fontSize: 78, color: '#ffffff', bold: true, italic: false, anchor: 'bottom-center', animation: 'pop', outlineWidth: 10, outlineColor: '#000000', shadow: { enabled: true, color: '#000000', offsetX: 0, offsetY: 5, blur: 8 }, background: { color: '#000000', opacity: 0, padding: 18 }, tracking: 0, wrap: .9 },
  },
  {
    id: 'karaoke-amarillo', name: 'Karaoke amarillo', group: 'Redes (vertical)',
    note: 'Cada palabra se pinta de amarillo cuando le toca, como el karaoke de CapCut.',
    patch: { font: 'Arial', fontSize: 84, color: '#ffffff', highlightColor: '#ffe600', bold: true, italic: false, anchor: 'bottom-center', animation: 'karaoke', outlineWidth: 12, outlineColor: '#000000', shadow: { enabled: true, color: '#000000', offsetX: 0, offsetY: 5, blur: 8 }, background: { color: '#000000', opacity: 0, padding: 18 }, tracking: 0, wrap: .9 },
  },
  {
    id: 'influencer-caja', name: 'Influencer (caja blanca)', group: 'Redes (vertical)',
    note: 'Texto oscuro sobre una caja blanca, sin contorno: el estilo de los vídeos de consejos.',
    patch: { font: 'Segoe UI', fontSize: 70, color: '#111111', bold: true, italic: false, anchor: 'middle-center', animation: 'pop', outlineWidth: 0, outlineColor: '#000000', shadow: { enabled: false, color: '#000000', offsetX: 0, offsetY: 4, blur: 8 }, background: { color: '#ffffff', opacity: .95, padding: 26 }, tracking: 0, wrap: .86 },
  },
  {
    id: 'rebote', name: 'Rebote', group: 'Redes (vertical)',
    note: 'Amarillo con contorno que no para de botar: para frases cortas y rápidas.',
    patch: { font: 'Impact', fontSize: 92, color: '#ffd400', bold: true, italic: false, anchor: 'middle-center', animation: 'bounce', outlineWidth: 9, outlineColor: '#101010', shadow: { enabled: true, color: '#000000', offsetX: 0, offsetY: 6, blur: 10 }, background: { color: '#000000', opacity: 0, padding: 18 }, tracking: 0, wrap: .9 },
  },
  {
    id: 'sacudida', name: 'Sacudida', group: 'Redes (vertical)',
    note: 'Rojo con contorno blanco que tiembla: para avisos y llamadas de atención.',
    patch: { font: 'Arial', fontSize: 88, color: '#ff3b3b', bold: true, italic: false, anchor: 'middle-center', animation: 'shake', outlineWidth: 6, outlineColor: '#ffffff', shadow: { enabled: true, color: '#000000', offsetX: 0, offsetY: 4, blur: 8 }, background: { color: '#000000', opacity: 0, padding: 18 }, tracking: 0, wrap: .9 },
  },
  {
    id: 'neon', name: 'Neón', group: 'Redes (vertical)',
    note: 'Contorno cian con resplandor azul y entrada con zoom: el cartel de neón.',
    patch: { font: 'Segoe UI', fontSize: 100, color: '#eaffff', bold: true, italic: false, anchor: 'middle-center', animation: 'zoom-in', outlineWidth: 5, outlineColor: '#00e5ff', shadow: { enabled: true, color: '#00b3ff', offsetX: 0, offsetY: 0, blur: 60 }, background: { color: '#000000', opacity: 0, padding: 18 }, tracking: 2, wrap: .9 },
  },
  {
    id: 'zoom-impacto', name: 'Zoom de impacto', group: 'Redes (vertical)',
    note: 'Letra muy grande que entra con zoom y contorno grueso, para el gancho del principio.',
    patch: { font: 'Impact', fontSize: 120, color: '#ffffff', bold: true, italic: false, anchor: 'middle-center', animation: 'zoom-in', outlineWidth: 8, outlineColor: '#000000', shadow: { enabled: true, color: '#000000', offsetX: 0, offsetY: 6, blur: 12 }, background: { color: '#000000', opacity: 0, padding: 18 }, tracking: 0, wrap: .9 },
  },
  {
    id: 'subtitulo-cine', name: 'Subtítulo de cine', group: 'Subtítulos',
    note: 'Blanco pequeño con contorno fino y una banda negra suave detrás, como un subtítulo de película.',
    patch: { font: 'Arial', fontSize: 60, color: '#ffffff', bold: false, italic: false, anchor: 'bottom-center', animation: 'fade', outlineWidth: 3, outlineColor: '#000000', shadow: { enabled: true, color: '#000000', offsetX: 0, offsetY: 2, blur: 6 }, background: { color: '#000000', opacity: .45, padding: 18 }, tracking: 0, wrap: .9, lineSpacing: 1.25 },
  },
  {
    id: 'subtitulo-redes', name: 'Subtítulo para redes', group: 'Subtítulos',
    note: 'Negrita con contorno grueso que entra desde abajo: se lee en el móvil y no tapa la imagen.',
    patch: { font: 'Arial', fontSize: 74, color: '#ffffff', bold: true, italic: false, anchor: 'bottom-center', animation: 'slide-up', outlineWidth: 9, outlineColor: '#000000', shadow: { enabled: true, color: '#000000', offsetX: 0, offsetY: 4, blur: 8 }, background: { color: '#000000', opacity: 0, padding: 18 }, tracking: 0, wrap: .86, lineSpacing: 1.2 },
  },
  {
    id: 'subtitulo-caja', name: 'Subtítulo con caja', group: 'Subtítulos',
    note: 'Caja gris casi opaca detrás del texto, sin contorno: el subtítulo más legible sobre cualquier fondo.',
    patch: { font: 'Segoe UI', fontSize: 64, color: '#ffffff', bold: true, italic: false, anchor: 'bottom-center', animation: 'fade', outlineWidth: 0, outlineColor: '#000000', shadow: { enabled: false, color: '#000000', offsetX: 0, offsetY: 2, blur: 4 }, background: { color: '#101010', opacity: .85, padding: 22 }, tracking: 0, wrap: .9, lineSpacing: 1.2 },
  },
  {
    id: 'maquina-escribir', name: 'Máquina de escribir', group: 'Subtítulos',
    note: 'Letra de máquina que se escribe sola sobre una banda negra: para narraciones y datos.',
    patch: { font: 'Courier New', fontSize: 70, color: '#ffffff', bold: false, italic: false, anchor: 'bottom-center', animation: 'typewriter', outlineWidth: 0, outlineColor: '#000000', shadow: { enabled: false, color: '#000000', offsetX: 0, offsetY: 2, blur: 4 }, background: { color: '#000000', opacity: .4, padding: 20 }, tracking: 1, wrap: .9, lineSpacing: 1.3 },
  },
  {
    id: 'deslizar-azul', name: 'Deslizar sobre azul', group: 'Subtítulos',
    note: 'Banda azul con el texto en negrita que sube al aparecer: el rótulo de los tutoriales.',
    patch: { font: 'Segoe UI', fontSize: 66, color: '#ffffff', bold: true, italic: false, anchor: 'bottom-center', animation: 'slide-up', outlineWidth: 0, outlineColor: '#000000', shadow: { enabled: false, color: '#000000', offsetX: 0, offsetY: 2, blur: 4 }, background: { color: '#1b6ef3', opacity: .85, padding: 24 }, tracking: 0, wrap: .9, lineSpacing: 1.2 },
  },
  {
    id: 'titulo-youtube', name: 'Título de YouTube', group: 'Títulos',
    note: 'Título grande arriba, con contorno y sombra, para el arranque del vídeo.',
    patch: { font: 'Segoe UI', fontSize: 118, color: '#ffffff', bold: true, italic: false, anchor: 'top-center', animation: 'fade', outlineWidth: 6, outlineColor: '#000000', shadow: { enabled: true, color: '#000000', offsetX: 2, offsetY: 3, blur: 10 }, background: { color: '#000000', opacity: 0, padding: 18 }, tracking: 1, wrap: .9, lineSpacing: 1.15 },
  },
  {
    id: 'noticias', name: 'Noticias (barra roja)', group: 'Títulos',
    note: 'Barra roja abajo con el texto en negrita que baja al aparecer, como un informativo.',
    patch: { font: 'Arial', fontSize: 62, color: '#ffffff', bold: true, italic: false, anchor: 'bottom-center', animation: 'slide-down', outlineWidth: 0, outlineColor: '#000000', shadow: { enabled: false, color: '#000000', offsetX: 0, offsetY: 2, blur: 4 }, background: { color: '#c00000', opacity: .92, padding: 20 }, tracking: 0, wrap: 1, lineSpacing: 1.2 },
  },
  {
    id: 'cita', name: 'Cita (serif)', group: 'Títulos',
    note: 'Cursiva con serifa, interlineado ancho y sombra suave: para una frase o un testimonio.',
    patch: { font: 'Georgia', fontSize: 64, color: '#f2efe6', bold: false, italic: true, anchor: 'middle-center', animation: 'fade', outlineWidth: 0, outlineColor: '#000000', shadow: { enabled: true, color: '#000000', offsetX: 2, offsetY: 2, blur: 12 }, background: { color: '#000000', opacity: 0, padding: 18 }, tracking: 0, wrap: .8, lineSpacing: 1.35 },
  },
  {
    id: 'creditos', name: 'Créditos finales', group: 'Títulos',
    note: 'Texto que sube por la pantalla como los títulos de crédito, con interlineado amplio.',
    patch: { font: 'Arial', fontSize: 56, color: '#ffffff', bold: false, italic: false, anchor: 'bottom-center', animation: 'scroll-up', outlineWidth: 0, outlineColor: '#000000', shadow: { enabled: false, color: '#000000', offsetX: 0, offsetY: 2, blur: 4 }, background: { color: '#000000', opacity: 0, padding: 18 }, tracking: 0, wrap: .8, lineSpacing: 1.5 },
  },
];

// Campos que una plantilla puede cambiar. Se usan para aplicar la plantilla y para reconocer cuál está puesta.
const PRESET_KEYS: (keyof Event)[] = ['font', 'fontSize', 'color', 'bold', 'italic', 'anchor', 'animation', 'outlineWidth', 'outlineColor', 'shadow', 'background', 'tracking', 'wrap', 'lineSpacing', 'highlightColor'];

// Cada plantilla sale con todos los campos del estilo puestos: los suyos y, en lo que no diga nada, el valor
// neutro de arriba.
export const TEXT_PRESETS: TextPreset[] = RAW_PRESETS.map(preset => ({ ...preset, patch: { ...PRESET_DEFAULTS, ...preset.patch } }));

export const TEXT_PRESET_GROUPS: string[] = [...new Set(TEXT_PRESETS.map(preset => preset.group))];
export const textPresetById = (id: string): TextPreset | null => TEXT_PRESETS.find(preset => preset.id === id) ?? null;

// Aplica la plantilla: copia el evento y escribe solo los campos de la plantilla. El texto, los tiempos, el
// encuadre y los fotogramas clave se quedan como estaban.
export function applyTextPreset(event: Event, id: string): Event {
  const preset = textPresetById(id);
  if (!preset) return event;
  const next: Event = { ...event };
  for (const key of PRESET_KEYS) {
    if (key in preset.patch) (next as Record<string, unknown>)[key as string] = (preset.patch as Record<string, unknown>)[key as string];
  }
  return next;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// Qué plantilla describe el evento tal como está, o «custom» si no coincide con ninguna.
export function detectTextPreset(event: Partial<Event>): string {
  const match = TEXT_PRESETS.find(preset => PRESET_KEYS.every(key => same((event as Record<string, unknown>)[key as string], (preset.patch as Record<string, unknown>)[key as string])));
  return match?.id ?? 'custom';
}

// Resumen del estilo para el estado del editor.
export function describeTextPreset(event: Partial<Event>): string {
  const preset = textPresetById(detectTextPreset(event));
  return preset ? `${preset.name}: ${preset.note}` : 'Estilo propio: no coincide con ninguna plantilla.';
}

// Anclajes que usan las plantillas, para poder comprobarlos en las pruebas.
export const PRESET_ANCHORS: TextAnchor[] = [...new Set(TEXT_PRESETS.map(preset => (preset.patch.anchor ?? 'middle-center') as TextAnchor))];
