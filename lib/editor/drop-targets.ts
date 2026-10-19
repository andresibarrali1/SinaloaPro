// Dónde acaba un recurso de medios cuando se suelta en la línea de tiempo.
//
// La regla de VEGAS es que cada material va a una pista de su clase: el audio a una pista de audio y la imagen a
// una de vídeo. Si el proyecto **no tiene** ninguna pista de esa clase, hay que crearla, y eso es lo que decide
// esta función, para que la interfaz pueda decirlo antes de soltar («se creará una pista de audio»).
import type { Track } from './project';

export type DropMediaKind = 'video' | 'audio' | 'image' | 'subtitle';

export type MediaDropPlan =
  | { kind: 'track'; trackId: string | null; createTrack: 'video' | 'audio' | null }
  | { kind: 'none'; reason: string };

export const laneKindForMedia = (media: DropMediaKind): 'video' | 'audio' => (media === 'audio' ? 'audio' : 'video');

/** Pista del proyecto que le corresponde a un material, o `null` si hay que crearla. */
export function compatibleTrack(tracks: Track[], media: DropMediaKind, preferred?: string | null): Track | null {
  const lane = laneKindForMedia(media);
  const target = preferred ? tracks.find((track) => track.id === preferred && track.kind === lane) : undefined;
  return target ?? tracks.find((track) => track.kind === lane) ?? null;
}

/**
 * Decide en qué pista se inserta un material soltado.
 *
 * * Si se suelta sobre una pista de su clase, va ahí (`preferred`).
 * * Si no, va a la primera pista de su clase.
 * * Si no hay ninguna, se crea una (`createTrack`), que es lo que evita que un proyecto sin pistas de audio no
 *   acepte un audio.
 * * Los subtítulos no van a una pista concreta: se reparten por los títulos del proyecto, así que se dejan a
 *   quien los inserta.
 */
export function planMediaDrop(input: {
  mediaKind: DropMediaKind;
  tracks: Track[];
  preferred?: string | null;
}): MediaDropPlan {
  if (input.mediaKind === 'subtitle') return { kind: 'track', trackId: null, createTrack: null };
  const track = compatibleTrack(input.tracks, input.mediaKind, input.preferred ?? null);
  if (track) return { kind: 'track', trackId: track.id, createTrack: null };
  return { kind: 'track', trackId: null, createTrack: laneKindForMedia(input.mediaKind) };
}

/** Frase para la barra de estado cuando se arrastra un material sobre la línea de tiempo. */
export function describeMediaDrop(plan: MediaDropPlan, tracks: Track[]): string {
  if (plan.kind === 'none') return plan.reason;
  if (plan.createTrack) {
    return plan.createTrack === 'audio'
      ? 'Se creará una pista de audio para este material.'
      : 'Se creará una pista de vídeo para este material.';
  }
  if (!plan.trackId) return 'Se insertará en la línea de tiempo.';
  const track = tracks.find((item) => item.id === plan.trackId);
  return track ? `Se insertará en la pista «${track.name}».` : 'Se insertará en la línea de tiempo.';
}
