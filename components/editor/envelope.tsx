'use client';
// Envolvente dibujable sobre la pista: volumen o panorámica, como las de VEGAS. Se dibuja sobre el carril,
// en las mismas coordenadas que los eventos (segundos × zoom), así que se mueve y se estira con la línea de
// tiempo. Clic en la línea añade un punto, arrastrarlo lo mueve y el clic derecho lo quita.
import { useRef } from 'react';
import type { AudioPoint, Track } from '@/lib/editor/project';
import { addEnvelopePoint, removeEnvelopePoint, seconds, ticks } from '@/lib/editor/project';

export type EnvelopeMode = 'off' | 'volume' | 'pan';
export type EnvelopeLaneProps = {
  track: Track;
  mode: 'volume' | 'pan';
  zoom: number;
  height: number;
  onStart: () => void;
  onUpdate: (points: AudioPoint[]) => void;
  onCommit: () => void;
  // Si el clic cayó sobre la aguja de la línea de tiempo, devuelve `true` y la envolvente no añade un punto: el
  // gesto es para mover la aguja (lo resuelve el editor, que es quien conoce la posición del cursor).
  onPlayheadPress?: (event: { clientX: number; currentTarget: EventTarget | null }) => boolean;
};

export function EnvelopeLane({ track, mode, zoom, height, onStart, onUpdate, onCommit, onPlayheadPress }: EnvelopeLaneProps) {
  const points = (mode === 'volume' ? track.volumeCurve : track.panCurve) ?? [];
  const sorted = [...points].sort((a, b) => a.time - b.time);
  const min = mode === 'volume' ? 0 : -1;
  const max = mode === 'volume' ? 2 : 1;
  const fallback = Math.max(min, Math.min(max, mode === 'volume' ? track.gain : track.pan));
  const toY = (value: number) => height * (1 - (Math.max(min, Math.min(max, value)) - min) / (max - min));
  const fromY = (y: number) => min + (max - min) * (1 - Math.max(0, Math.min(height, y)) / height);
  const toX = (time: number) => seconds(time) * zoom;
  const fromX = (x: number) => Math.max(0, ticks(Math.max(0, x) / zoom));
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef<number | null>(null);

  const path = () => {
    if (!sorted.length) return `M 0 ${toY(fallback)} L 100000 ${toY(fallback)}`;
    const body = sorted.map(point => `${toX(point.time)} ${toY(point.value)}`).join(' L ');
    return `M 0 ${toY(sorted[0].value)} L ${body} L 100000 ${toY(sorted[sorted.length - 1].value)}`;
  };
  const position = (event: { clientX: number; clientY: number }) => {
    const rect = svg.current?.getBoundingClientRect();
    if (!rect) return { time: 0, value: fallback };
    return { time: fromX(event.clientX - rect.left), value: fromY(event.clientY - rect.top) };
  };
  const addPoint = (event: React.MouseEvent) => {
    if (onPlayheadPress?.(event)) return;
    event.stopPropagation();
    const at = position(event);
    onStart();
    onUpdate(addEnvelopePoint(sorted, at.time, at.value));
    onCommit();
  };
  const startDrag = (index: number, event: React.PointerEvent<SVGCircleElement>) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = index;
    onStart();
  };
  const dragMove = (event: React.PointerEvent<SVGCircleElement>) => {
    if (dragging.current === null) return;
    event.stopPropagation();
    const at = position(event);
    onUpdate(sorted.map((point, index) => index === dragging.current ? { time: at.time, value: at.value } : point).sort((a, b) => a.time - b.time));
  };
  const endDrag = (event: React.PointerEvent<SVGCircleElement>) => {
    if (dragging.current === null) return;
    dragging.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ya liberado */ }
    onCommit();
  };
  const removePoint = (point: AudioPoint, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onStart();
    onUpdate(removeEnvelopePoint(sorted, point.time));
    onCommit();
  };

  return (
    <svg ref={svg} className={`envelope-lane ${mode}`} aria-label={`Envolvente de ${mode === 'volume' ? 'volumen' : 'panorámica'} de ${track.name}`}>
      <path className="envelope-line-hit" d={path()} onClick={addPoint} />
      <path className="envelope-line" d={path()} />
      {sorted.map((point, index) => (
        <circle
          // La clave es el índice a propósito: si cambiara al arrastrar, React recrearía el círculo y se
          // perdería la captura del puntero a mitad del movimiento.
          key={index}
          className="envelope-point"
          cx={toX(point.time)}
          cy={toY(point.value)}
          r={4}
          onPointerDown={event => startDrag(index, event)}
          onPointerMove={dragMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onContextMenu={event => removePoint(point, event)}
        />
      ))}
    </svg>
  );
}
