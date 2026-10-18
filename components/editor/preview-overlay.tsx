'use client';
// Asas de redimensionado sobre la vista previa.
//
// Cuando hay un evento seleccionado (o, si no, una pista), el monitor enseña la caja de lo que se está viendo
// con sus ocho asas, sin abrir ninguna ventana:
//
//   · arrastrar dentro de la caja mueve el encuadre;
//   · arrastrar un asa lo escala dejando quieta el asa contraria;
//   · con Alt (o manteniendo Alt al empezar) el asa recorta ese lado en lugar de escalar.
//
// La geometría es la misma que la de la ventana de Panoramización y recorte (`poseMatrix`, `contentBox`,
// `dragHandle`, `dragScale`), así que lo que se ve aquí es exactamente lo que compone el motor. Quien decide
// dónde se guarda el cambio (en la pose del evento o en la clave del cursor) es el editor, que es quien conoce
// los fotogramas clave.
import { useMemo, useRef, useState } from 'react';
import { Crop, Maximize2 } from 'lucide-react';
import type { CropMask, Event, Project, Track, Transform } from '@/lib/editor/project';
import { HANDLES, HandleId, applyMatrix, boxCorners, contentBox, dragHandle, dragScale, frameBox, handlePoint, maskOf, poseMatrix, toLocalDelta } from '@/lib/editor/pancrop';

export type PreviewOverlayProps = {
  project: Project;
  event: Event | null;                 // evento seleccionado, si hay uno
  track: Track | null;                 // pista seleccionada, si no hay evento
  pose: Transform;
  source: { width: number; height: number } | null;
  onPose: (pose: Transform) => void;
  onMask?: (mask: CropMask) => void;   // el recorte vive en el evento, no en la pose
  onStatus: (message: string) => void;
};

export function PreviewOverlay({ project, event, track, pose, source, onPose, onMask, onStatus }: PreviewOverlayProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ handle: HandleId; startX: number; startY: number; pose: Transform; perPixel: number } | null>(null);
  const [active, setActive] = useState<HandleId | null>(null);
  // Modo de las asas: redimensionar (lo normal) o recortar. Se puede cambiar con el botón de la caja o, sin
  // soltar, manteniendo Alt.
  const [mode, setMode] = useState<'scale' | 'crop'>('scale');
  // Todo se calcula en píxeles del fotograma del proyecto y se coloca con porcentajes: el monitor puede cambiar
  // de tamaño sin que haya que recalcular nada.
  const frame = useMemo(() => ({ width: Math.max(1, project.width), height: Math.max(1, project.height) }), [project.width, project.height]);
  const mask = useMemo(() => maskOf(event ?? { transform: pose }), [event, pose]);
  const box = useMemo(() => {
    if (event && (event.kind === 'text' || event.kind === 'color')) return frameBox(mask);
    return contentBox(frame, source ?? frame, mask);
  }, [event, frame, mask, source]);
  const matrix = poseMatrix(frame, pose);
  const corners = boxCorners(box, frame, pose);
  const left = Math.min(...corners.map(point => point.x)), right = Math.max(...corners.map(point => point.x));
  const top = Math.min(...corners.map(point => point.y)), bottom = Math.max(...corners.map(point => point.y));
  const width = Math.max(1, right - left), height = Math.max(1, bottom - top);
  const spots = HANDLES.map(id => {
    const spot = applyMatrix(matrix, handlePoint(box, id));
    return { id, x: (spot.x - left) / width * 100, y: (spot.y - top) / height * 100 };
  });
  const label = event ? event.name : track ? `Pista ${track.name}` : '';
  const canCrop = Boolean(event) && event?.kind !== 'audio' && Boolean(onMask);

  const start = (pointer: React.PointerEvent, handle: HandleId) => {
    if (pointer.button !== 0) return;
    const rect = hostRef.current?.getBoundingClientRect();
    if (!rect) return;
    pointer.preventDefault();
    pointer.stopPropagation();
    (pointer.currentTarget as HTMLElement).setPointerCapture(pointer.pointerId);
    drag.current = { handle, startX: pointer.clientX, startY: pointer.clientY, pose, perPixel: frame.width / Math.max(1, rect.width) };
    setActive(handle);
  };
  const move = (pointer: React.PointerEvent) => {
    const current = drag.current;
    if (!current) return;
    const output = { x: (pointer.clientX - current.startX) * current.perPixel, y: (pointer.clientY - current.startY) * current.perPixel };
    if (current.handle === 'move') {
      const next = dragHandle({ frame, source: source ?? frame, pose: current.pose, mask, handle: 'move', delta: toLocalDelta(output, current.pose) });
      onPose(next.pose);
      onStatus(`Encuadre de «${label}»: ${(next.pose.x * 100).toFixed(1)} % a la derecha, ${(next.pose.y * 100).toFixed(1)} % hacia abajo.`);
      return;
    }
    if (canCrop && (mode === 'crop' || pointer.altKey)) {
      const next = dragHandle({ frame, source: source ?? frame, pose: current.pose, mask, handle: current.handle, delta: toLocalDelta(output, current.pose) });
      onMask?.(next.mask);
      onStatus(`Recorte de «${label}»: ${Math.round(next.mask.left * 100)} % izq · ${Math.round(next.mask.right * 100)} % der · ${Math.round(next.mask.top * 100)} % arr · ${Math.round(next.mask.bottom * 100)} % aba.`);
      return;
    }
    const scaled = dragScale({ frame, box, pose: current.pose, handle: current.handle, delta: output });
    onPose(scaled);
    onStatus(`Escala de «${label}»: ${Math.round(scaled.scale * 100)} % · ${Math.round(frame.width * scaled.scale)}×${Math.round(frame.height * scaled.scale)} px.`);
  };
  const end = (pointer: React.PointerEvent) => {
    if (!drag.current) return;
    drag.current = null;
    setActive(null);
    try { (pointer.currentTarget as HTMLElement).releasePointerCapture(pointer.pointerId); } catch { /* ya liberado */ }
  };

  if (!event && !track) return null;
  return (
    <div className="preview-overlay" ref={hostRef}>
      {canCrop && <span className="preview-modes" onPointerDown={pointer => pointer.stopPropagation()}>
        <button
          type="button"
          className={mode === 'scale' ? 'active' : ''}
          aria-pressed={mode === 'scale'}
          aria-label="Redimensionar con las asas"
          title="Las asas escalan el recurso dejando quieta el asa contraria"
          onClick={() => setMode('scale')}
        ><Maximize2 size={11}/></button>
        <button
          type="button"
          className={mode === 'crop' ? 'active' : ''}
          aria-pressed={mode === 'crop'}
          aria-label="Recortar con las asas"
          title="Las asas recortan ese lado (también con Alt, sin cambiar de modo)"
          onClick={() => setMode('crop')}
        ><Crop size={11}/></button>
      </span>}
      <span className="preview-badge" aria-label="Escala del evento seleccionado">{Math.round(pose.scale * 100)} % · {Math.round(frame.width * pose.scale)}×{Math.round(frame.height * pose.scale)} px</span>
      <div
        className="preview-box"
        style={{ left: `${left / frame.width * 100}%`, top: `${top / frame.height * 100}%`, width: `${width / frame.width * 100}%`, height: `${height / frame.height * 100}%` }}
        data-label={label}
        onPointerDown={pointer => start(pointer, 'move')}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        title={`${label} · arrastra para mover, las asas para redimensionar y con Alt para recortar`}
      >
        {spots.map(spot => (
          <i
            key={spot.id}
            className={`preview-handle ${spot.id} ${active === spot.id ? 'active' : ''}`}
            style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
            data-handle={spot.id}
            onPointerDown={pointer => start(pointer, spot.id)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          />
        ))}
      </div>
    </div>
  );
}
