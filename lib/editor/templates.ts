// Plantillas de proyecto: los formatos con los que se empieza un montaje.
//
// Las medidas son las que publican las propias plataformas: TikTok, Instagram Reels y YouTube Shorts usan
// 1080 × 1920 (9:16) y admiten 30 o 60 fotogramas por segundo; el feed de Instagram, 1080 × 1080 (1:1);
// YouTube y la mayoría de los monitores, 1920 × 1080 (16:9). Una plantilla solo cambia el tamaño del
// fotograma, la velocidad y la frecuencia de audio del proyecto: no mueve ni reencuadra lo que ya está en la
// línea de tiempo (para eso está la ventana de Panoramización y recorte, que sí lo hace evento a evento).
import { FPS, Project } from './project';

export type ProjectTemplate = {
  id: string;
  name: string;        // nombre corto, el que se ve en la lista
  group: string;       // agrupación en la lista
  width: number;
  height: number;
  fps: FPS;
  sampleRate: number;
  note: string;        // por qué esas medidas
};

const NTSC: FPS = { num: 30000, den: 1001 };
const AUDIO_48 = 48000, AUDIO_441 = 44100;

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'tiktok', name: 'TikTok 1080×1920', group: 'Vertical (9:16)', width: 1080, height: 1920, fps: { num: 30, den: 1 }, sampleRate: AUDIO_48,
    note: 'El formato con el que TikTok reproduce a pantalla completa: 1080 × 1920 y 30 fps (también admite 60).',
  },
  {
    id: 'reels', name: 'Instagram Reels 1080×1920', group: 'Vertical (9:16)', width: 1080, height: 1920, fps: { num: 30, den: 1 }, sampleRate: AUDIO_48,
    note: 'Instagram Reels usa el mismo lienzo vertical que TikTok; 30 fps es lo que recomienda para que no se recomprima.',
  },
  {
    id: 'shorts', name: 'YouTube Shorts 1080×1920', group: 'Vertical (9:16)', width: 1080, height: 1920, fps: { num: 60, den: 1 }, sampleRate: AUDIO_48,
    note: 'YouTube Shorts admite hasta 60 fps en 1080 × 1920; esta plantilla los pone desde el principio.',
  },
  {
    id: 'vertical-720', name: 'Vertical 720×1280 (borrador)', group: 'Vertical (9:16)', width: 720, height: 1280, fps: { num: 30, den: 1 }, sampleRate: AUDIO_48,
    note: 'Mismo encuadre vertical con la mitad de píxeles: va más rápido para montar y para probar en equipos lentos.',
  },
  {
    id: 'cuadrado', name: 'Cuadrado 1080×1080 (feed)', group: 'Cuadrado (1:1)', width: 1080, height: 1080, fps: { num: 30, den: 1 }, sampleRate: AUDIO_48,
    note: 'El formato cuadrado del feed de Instagram y de algunas publicaciones de Facebook.',
  },
  {
    id: 'youtube-1080', name: 'YouTube 1080p', group: 'Horizontal (16:9)', width: 1920, height: 1080, fps: { num: 30, den: 1 }, sampleRate: AUDIO_48,
    note: 'Full HD horizontal a 30 fps: el ajuste de partida del editor y el que YouTube reproduce sin reescalar.',
  },
  {
    id: 'horizontal-720', name: 'Horizontal 720p', group: 'Horizontal (16:9)', width: 1280, height: 720, fps: { num: 30, den: 1 }, sampleRate: AUDIO_48,
    note: 'HD horizontal: útil para pruebas y para equipos que no aguantan el Full HD.',
  },
  {
    id: 'youtube-4k', name: 'YouTube 4K 2160p', group: 'Horizontal (16:9)', width: 3840, height: 2160, fps: { num: 30, den: 1 }, sampleRate: AUDIO_48,
    note: '4K a 30 fps. El renderizado tarda unas cuatro veces más que en 1080p porque hay cuatro veces más píxeles.',
  },
  {
    id: 'cine-24', name: 'Cine 24p', group: 'Cine', width: 1920, height: 1080, fps: { num: 24, den: 1 }, sampleRate: AUDIO_48,
    note: '24 fotogramas por segundo, el paso del cine: el movimiento tiene el pequeño salto que se espera de una película.',
  },
  {
    id: 'cine-4k-24', name: 'Cine 4K 24p', group: 'Cine', width: 3840, height: 2160, fps: { num: 24, den: 1 }, sampleRate: AUDIO_48,
    note: '4K a 24 fps, la combinación habitual de cámara grande.',
  },
  {
    id: 'ntsc-2997', name: 'NTSC 29,97 (1080)', group: 'Cine', width: 1920, height: 1080, fps: NTSC, sampleRate: AUDIO_48,
    note: '29,97 fps (30000/1001): la velocidad real de la televisión NTSC, con timecode con descarte disponible.',
  },
  {
    id: 'pal-25', name: 'PAL 25p (1080)', group: 'Cine', width: 1920, height: 1080, fps: { num: 25, den: 1 }, sampleRate: AUDIO_48,
    note: '25 fps: la velocidad de la televisión europea.',
  },
  {
    id: 'audio-441', name: 'Audio 44,1 kHz', group: 'Solo audio', width: 1920, height: 1080, fps: { num: 30, den: 1 }, sampleRate: AUDIO_441,
    note: 'Para montajes que solo llevan audio: el proyecto baja a 44,1 kHz, la frecuencia de los CD.',
  },
];

export const templateById = (id: string): ProjectTemplate | null => PROJECT_TEMPLATES.find(template => template.id === id) ?? null;
export const templateLabel = (template: ProjectTemplate) => `${template.group} · ${template.name}`;
export const templateItems = (): [string, string][] => [['custom', 'Personalizada'], ...PROJECT_TEMPLATES.map(template => [template.id, templateLabel(template)] as [string, string])];

export function sameFps(a: FPS, b: FPS) { return a.num === b.num && a.den === b.den; }
export const aspectRatio = (template: Pick<ProjectTemplate, 'width' | 'height'>) => {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const divisor = gcd(template.width, template.height) || 1;
  return `${template.width / divisor}:${template.height / divisor}`;
};
export const isVertical = (template: Pick<ProjectTemplate, 'width' | 'height'>) => template.height > template.width;

// Aplica la plantilla al proyecto: tamaño, velocidad y audio. No toca pistas, eventos ni medios, y deja el
// nombre como estaba (la plantilla es del formato, no del montaje).
export function applyProjectTemplate(project: Project, id: string): Project {
  const template = templateById(id);
  if (!template) return project;
  return { ...project, width: template.width, height: template.height, fps: { ...template.fps }, sampleRate: template.sampleRate };
}

// Qué plantilla describe el proyecto tal como está ahora, o «custom» si no coincide con ninguna.
export function detectTemplate(project: Pick<Project, 'width' | 'height' | 'fps' | 'sampleRate'>): string {
  const match = PROJECT_TEMPLATES.find(template =>
    template.width === project.width && template.height === project.height &&
    sameFps(template.fps, project.fps) && template.sampleRate === project.sampleRate);
  return match?.id ?? 'custom';
}

// Resumen del formato, para la barra de estado y las pruebas.
export const describeFormat = (project: Pick<Project, 'width' | 'height' | 'fps' | 'sampleRate'>) =>
  `${project.width}×${project.height} (${aspectRatio(project)}), ${project.fps.num / project.fps.den} fps, ${project.sampleRate} Hz`;
