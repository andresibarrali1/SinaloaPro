// Dónde acaba una transición cuando se suelta sobre un clip, al estilo de CapCut: en el borde de entrada, en el
// de salida o en el corte con el clip siguiente.
//
// El modelo de este editor (igual que el de VEGAS) coloca la transición en la **entrada** de un evento y la hace
// durar lo que su fundido de entrada. Por eso:
//
// * Soltar en la mitad izquierda de un clip le pone la transición de entrada a ese clip.
// * Soltar en la mitad derecha, con otro clip pegado justo después, pone la transición en la entrada del
//   siguiente: es el corte entre los dos, que es donde va una transición en CapCut y en VEGAS.
// * Soltar en la mitad derecha **sin** nada después la pone como transición de **salida** del propio clip
//   (`transitionOut`), que se dibuja con el progreso espejado sobre su fundido de salida.
import type { Event, TransitionKind } from './project';

export type TransitionEdge = 'in' | 'out';

export type TransitionDropPlan =
  | { kind: 'apply'; eventId: string; edge: TransitionEdge; fade: number; junction: boolean }
  | { kind: 'none'; reason: string };

/** Duración máxima por defecto de una transición soltada: un segundo, o la mitad del clip si es más corto. */
export const transitionFadeFor = (duration: number) => Math.min(Math.round(705_600_000), Math.floor(duration / 2));

/** Tolerancia para considerar que dos clips están pegados: dos fotogramas del proyecto. */
export const junctionTolerance = (fps: { num: number; den: number }) => Math.ceil((705_600_000 * fps.den) / fps.num) * 2;

/**
 * Decide qué transición se aplica al soltar `kind` en `time` (ticks) sobre una pista.
 *
 * `events` son los eventos de **esa** pista, en cualquier orden.
 */
export function planTransitionDrop(input: {
  events: Event[];
  time: number;
  kind: TransitionKind;
  fps: { num: number; den: number };
}): TransitionDropPlan {
  const { events, time, fps } = input;
  const target = events.find((event) => event.kind !== 'audio' && time >= event.start && time <= event.start + event.duration);
  if (!target) {
    return { kind: 'none', reason: 'Suelta la transición sobre un clip de vídeo, en su mitad izquierda o derecha.' };
  }

  const half = target.start + target.duration / 2;
  if (time <= half) {
    return {
      kind: 'apply',
      eventId: target.id,
      edge: 'in',
      fade: transitionFadeFor(target.duration),
      junction: false,
    };
  }

  const tolerance = junctionTolerance(fps);
  const end = target.start + target.duration;
  const next = events
    .filter((event) => event.id !== target.id && event.kind !== 'audio' && event.start >= end - tolerance)
    .sort((left, right) => left.start - right.start)[0];

  if (next && next.start <= end + tolerance) {
    // Corte entre los dos clips: la transición es la entrada del siguiente, como en VEGAS.
    return {
      kind: 'apply',
      eventId: next.id,
      edge: 'in',
      fade: transitionFadeFor(next.duration),
      junction: true,
    };
  }

  return {
    kind: 'apply',
    eventId: target.id,
    edge: 'out',
    fade: transitionFadeFor(target.duration),
    junction: false,
  };
}

/** Frase para la barra de estado después de soltar una transición.
 *
 * `label` es el nombre de la transición («Fundido lineal»…) y `clip` el nombre del clip afectado. */
export function describeTransitionDrop(
  plan: TransitionDropPlan,
  label: string,
  clip: string,
  seconds: (ticks: number) => number,
): string {
  if (plan.kind === 'none') return plan.reason;
  const duration = seconds(plan.fade).toFixed(2);
  if (plan.junction) {
    return `«${label}» en el corte, como entrada de «${clip}»: dura ${duration} s.`;
  }
  return plan.edge === 'in'
    ? `«${label}» como entrada de «${clip}»: dura ${duration} s.`
    : `«${label}» como salida de «${clip}»: dura ${duration} s. Para el corte entre dos clips, suéltala sobre el segundo.`;
}
