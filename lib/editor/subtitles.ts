// Subtítulos: de las frases de la transcripción (o de un archivo .srt) a eventos de texto sobre una pista
// «Subtítulos». El estilo lleva contorno negro porque el texto blanco sin contorno desaparece sobre una
// imagen clara: sin él, un subtítulo sobre una escena luminosa no se ve.
import { Event, Project, frameTicks, newEvent, newTrack, ticks } from './project';
import { applyTextPreset } from './text-presets';

export type SubtitleCue = { start: number; end: number; text: string };
export const SUBTITLE_STYLE = { fontSize: 54, color: '#ffffff', outlineWidth: 6, outlineColor: '#000000', offsetY: .34 };
export const SUBTITLE_TRACK = 'Subtítulos';
// Estilos que se pueden elegir al generar subtítulos. «classic» es el de siempre; el resto son plantillas
// premium pensadas para leerse abajo y sobre imagen en movimiento.
export const SUBTITLE_PRESETS = [
  ['classic', 'Clásico con contorno'],
  ['premium-grow-verde', 'Caja que crece (verde)'],
  ['premium-pastilla-cristal', 'Pastilla de cristal'],
  ['premium-tarjeta-blanca', 'Tarjeta blanca'],
  ['premium-karaoke-ambar', 'Karaoke ámbar'],
  ['premium-minimal-sombra', 'Minimal con sombra'],
  ['premium-etiqueta-ambar', 'Etiqueta ámbar'],
] as const;
export type SubtitlePresetId = typeof SUBTITLE_PRESETS[number][0];

// La pista de subtítulos va la primera de las de vídeo: así se dibuja por encima de todo lo demás.
export function subtitleTrack(project: Project, trackId?: string) {
  let track = project.tracks.find(candidate => candidate.id === trackId && candidate.kind === 'video')
    ?? project.tracks.find(candidate => candidate.name === SUBTITLE_TRACK && candidate.kind === 'video');
  if (!track) { track = newTrack('video', SUBTITLE_TRACK); project.tracks.unshift(track); }
  return track;
}
export function subtitleEvents(project: Project, cues: SubtitleCue[], trackId?: string, presetId: SubtitlePresetId = 'classic'): Event[] {
  const track = subtitleTrack(project, trackId);
  const preset = presetId !== 'classic' && SUBTITLE_PRESETS.some(([id]) => id === presetId) ? presetId : 'classic';
  return cues
    .filter(cue => cue.text?.trim())
    .map((cue, index) => {
      const start = ticks(cue.start);
      // Al menos un fotograma y, si el subtítulo no trae duración, 0,2 s: así nunca queda un evento invisible.
      const duration = Math.max(frameTicks(project.fps), ticks(cue.end > cue.start ? cue.end - cue.start : .2));
      let event = newEvent(track.id, 'text', start, duration);
      // La plantilla premium trae su fuente, caja, mayúsculas y animación; el texto y los tiempos son los de
      // la transcripción. En el estilo clásico se mantiene el contorno que hace legible el blanco.
      if (preset !== 'classic') event = applyTextPreset(event, preset);
      else {
        event.fontSize = SUBTITLE_STYLE.fontSize;
        event.color = SUBTITLE_STYLE.color;
        event.outlineWidth = SUBTITLE_STYLE.outlineWidth;
        event.outlineColor = SUBTITLE_STYLE.outlineColor;
      }
      event.name = `Subtítulo ${index + 1}`;
      event.text = cue.text.trim();
      // Las plantillas de subtítulo ya están ancladas abajo; el clásico necesita el desplazamiento de siempre.
      event.transform = { ...event.transform, y: preset === 'classic' ? SUBTITLE_STYLE.offsetY : 0 };
      return event;
    });
}
// Añade las frases al proyecto (creando la pista si hace falta) y devuelve los ids creados.
export function addSubtitles(project: Project, cues: SubtitleCue[], trackId?: string, presetId: SubtitlePresetId = 'classic'): string[] {
  const events = subtitleEvents(project, cues, trackId, presetId);
  project.events.push(...events);
  return events.map(event => event.id);
}
// Un .srt se reconoce por la extensión o por su contenido: la primera frase con su marca de tiempo.
export function looksLikeSrt(name: string, text: string): boolean {
  return /\.(srt|vtt)$/i.test(name) || /^\s*1\s*\r?\n\s*\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->/.test(text);
}
// Duración aproximada de un archivo de subtítulos: el final de su última frase (la marca de la derecha).
export function srtDuration(text: string): number {
  const stamps = [...text.matchAll(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/g)];
  const last = stamps[stamps.length - 1];
  if (!last) return 0;
  return Number(last[5]) * 3600 + Number(last[6]) * 60 + Number(last[7]) + Number(last[8]) / 1000;
}
