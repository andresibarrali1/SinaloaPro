// Selección por rango de la línea de tiempo: Mayús+clic en un evento y después Mayús+clic en otro más lejano
// selecciona lo que hay entre los dos, **pero solo de la pista del evento pulsado** (y los grupos que vayan con él),
// que es como se comporta Vegas con «Seleccionar rango» (manual, «Edición y selección de eventos»:
// `Mayús+hacer clic en eventos`). Las funciones son puras: reciben el tramo de cada evento (inicio, duración y pista)
// y devuelven identificadores, así que se pueden probar sin navegador.
export type EventSpan = { id: string; start: number; duration: number; trackId: string };
export type TimeSpan = { start: number; end: number };

/** Tramo que va del principio del evento más temprano al final del más tardío. */
export function spanBetween(uno: EventSpan, otro: EventSpan): TimeSpan {
  return { start: Math.min(uno.start, otro.start), end: Math.max(uno.start + uno.duration, otro.start + otro.duration) };
}

/** Eventos que **tocan** el tramo: los que empiezan dentro, los que lo cruzan y los que lo contienen. */
export function idsInSpan(events: readonly EventSpan[], span: TimeSpan): string[] {
  return events.filter((evento) => evento.start < span.end && evento.start + evento.duration > span.start).map((evento) => evento.id);
}

/** Lo mismo, pero solo los de una pista: el rango no debe saltar a otras pistas sin querer. */
export function idsInSpanOnTrack(events: readonly EventSpan[], span: TimeSpan, trackId: string): string[] {
  return idsInSpan(events.filter((evento) => evento.trackId === trackId), span);
}

/**
 * Selección de rango entre dos eventos. El tramo lo marcan los dos (aunque el ancla esté en otra pista: sirve para
 * decir «hasta aquí»), pero los eventos que entran son los de la **pista del evento pulsado**; los de otras pistas
 * solo llegan después, si van agrupados con alguno de los elegidos (eso lo resuelve el editor con los vínculos).
 * Devuelve lista vacía si alguno de los dos eventos ya no está, y el evento pulsado siempre entra.
 */
export function rangeIds(events: readonly EventSpan[], anchorId: string, targetId: string): string[] {
  const ancla = events.find((evento) => evento.id === anchorId);
  const destino = events.find((evento) => evento.id === targetId);
  if (!ancla || !destino) return [];
  const dentro = idsInSpanOnTrack(events, spanBetween(ancla, destino), destino.trackId);
  return dentro.includes(targetId) ? dentro : [...dentro, targetId];
}
