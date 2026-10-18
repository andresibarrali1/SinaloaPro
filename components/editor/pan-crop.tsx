'use client';
// Ventana de Panoramización y recorte (Pan/Crop), que también hace de Movimiento de pista.
//
// La disposición es la del «Efectos de evento de vídeo → Panoramización/Recorte» de VEGAS Pro 15:
//
//   · barra de título con la chapa ƒx, el nombre del evento y los botones de la ventana;
//   · barra de pestañas («Panoramización/Recorte») con el candado que bloquea los parámetros;
//   · fila del parámetro preestablecido;
//   · columna izquierda con la barra de herramientas (mover, zoom, girar, recortar, máscara, 3D) y el árbol
//     de parámetros: Posición, Rotación, Recorte, Interpolación de fotogramas clave, Origen, Área de trabajo
//     y Máscara libre, plegables como los grupos de VEGAS;
//   · monitor a la derecha sobre un tablero de cuadros, con la caja del contenido, sus ocho asas, el círculo
//     del centro de giro y el área del fotograma;
//   · tira de fotogramas clave con la aguja, el selector de parámetro, el casillero de máscara y la barra de
//     navegación entre claves; debajo, la barra con posición, claves y cierre.
//
// Las diferencias con VEGAS que se mantienen a propósito están en el README (§5.5): aquí el recorte es de
// cuatro márgenes independientes que se editan también por campos, el centro de giro se llama «Centro de
// giro» para no confundirlo con el centro de la posición, y la tira de claves no dibuja la curva de cada
// clave (la curva se elige en el grupo «Interpolación de fotogramas clave»).
import { EventPanCrop } from './event-pan-crop';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Boxes, ChevronDown, ChevronLeft, ChevronRight, Crop, Diamond, Lock, LockOpen, Minus, MousePointer2, PenTool,
  Plus, RotateCw, Save, SkipBack, SkipForward, StepBack, StepForward, Trash2, ZoomIn,
} from 'lucide-react';
import { compose } from '@/lib/editor/compositor';
import type { MediaLibrary } from '@/lib/editor/media';
import type { CropMask, Keyframe, MaskPath, PanCropPreset, Project, Transform } from '@/lib/editor/project';
import {
  HANDLES, HandleId, KeyParameter, KEY_PARAMETERS, applyMatrix, boxCorners, contentBox, cropToAspect, describeMask,
  dragCropSelection, dragHandle, fittedBox, handleAt, handlePoint, isCornerHandle, keyAt, keysChanging, maskOf,
  noCrop, poseMatrix, removeKey, resetPose, toLocal, toLocalDelta, upsertKey,
} from '@/lib/editor/pancrop';
import { Choice } from './controls';
import { EASE_KINDS,EASE_LABEL,EASE_NOTE,EaseKind } from '@/lib/editor/project';
import { MAX_DEPTH,MAX_ROTATION_3D,MIN_DEPTH } from '@/lib/editor/threed';
import { addMaskPoint, maskActive, maskPointAt, moveMaskPoint, normalizeMaskPath, removeMaskPoint } from '@/lib/editor/mask';

export type PanCropWindowProps = {
  project: Project;
  eventId?: string;
  library: MediaLibrary;
  time: number;                       // instante del cursor, en ticks
  duration: number;                   // duración del evento (o del proyecto, si es una pista)
  eventStart: number;                 // inicio del evento, para medir las claves
  pose: Transform;
  mask?: CropMask;
  keys: Keyframe[];
  source: { width: number; height: number } | null;   // tamaño del medio; si no hay, el evento ocupa el fotograma
  label: string;
  allowCrop?: boolean;                // las pistas se mueven y se escalan, pero no se recortan
  onPose: (pose: Transform) => void;
  onMask: (mask: CropMask) => void;
  onKeys: (keys: Keyframe[]) => void;
  maskPath?: MaskPath;                // máscara libre (trazado) del evento
  onBeginMask: () => void;            // se llama antes de tocar la máscara, para el historial
  onMaskPath: (path: MaskPath, commit: boolean) => void;
  onSeek: (time: number) => void;
  onClose: () => void;
  // «Guardar/Eliminar parámetro preestablecido» de VEGAS: los preestablecidos propios del proyecto.
  presets?: PanCropPreset[];
  onPresets?: (presets: PanCropPreset[]) => void;
  // Grupo «Origen»: «Extender para rellenar f.» es la casilla que hace que el material cubra el fotograma.
  stretchFill?: boolean;
  onStretchFill?: (value: boolean) => void;
  // Grupo «Origen»: la misma casilla «Mantener relación de aspecto» de las propiedades del evento.
  maintainAspect?: boolean;
  onMaintainAspect?: (value: boolean) => void;
  // Grupo «Interpolación de fotogramas clave»: «Suavidad (%)» de la curva Suave.
  smoothness?: number;
  onSmoothness?: (value: number) => void;
};

const PREVIEW_WIDTH = 640;
// Margen alrededor del fotograma dentro del monitor: VEGAS enseña el fotograma como un rectángulo con sitio
// alrededor, y ese sitio es el que deja ver el círculo del centro de giro y las asas que se salen del marco.
const STAGE_MARGIN = 34;
const TICKS_PER_SECOND = 705600000;

// Herramientas de la barra lateral, en el orden de VEGAS: mover, hacer zoom, girar, recortar, dibujar la
// máscara y girar en 3D. La herramienta decide qué hace el arrastre dentro de la caja; las asas siempre
// recortan, como en VEGAS.
type Tool = 'move' | 'zoom' | 'rotate' | 'crop' | 'mask' | 'spin3d';
const TOOLS: { id: Tool; label: string; hint: string; Icon: typeof MousePointer2 }[] = [
  { id: 'move', label: 'Mover el encuadre', hint: 'Arrastra dentro de la caja para mover el encuadre', Icon: MousePointer2 },
  { id: 'zoom', label: 'Acercar y alejar', hint: 'Arrastra a lo ancho para acercar o alejar', Icon: ZoomIn },
  { id: 'rotate', label: 'Girar el encuadre', hint: 'Arrastra a lo ancho para girar; con Mayús se ajusta fino', Icon: RotateCw },
  { id: 'crop', label: 'Recortar', hint: 'Arrastra las asas para recortar cada lado', Icon: Crop },
  { id: 'mask', label: 'Dibujar la máscara', hint: 'Haz clic en el monitor para añadir puntos; el clic derecho los quita', Icon: PenTool },
  { id: 'spin3d', label: 'Girar en 3D', hint: 'El arrastre horizontal gira sobre el eje Y y el vertical sobre el X', Icon: Boxes },
];

// La ventana es flotante, como la de VEGAS: se mueve arrastrándola por cualquier borde o por su barra de
// título y se cambia de tamaño desde los ocho tiradores de los extremos. El tamaño mínimo deja sitio al
// monitor y a los campos; el máximo es la propia ventana del navegador.
type WindowFrame = { x: number; y: number; width: number; height: number };
const MIN_WINDOW_WIDTH = 460, MIN_WINDOW_HEIGHT = 320, MAX_WINDOW_WIDTH = 1180, MAX_WINDOW_HEIGHT = 820;
const RESIZE_EDGES: [string, string][] = [
  ['n', 'ns-resize'], ['s', 'ns-resize'], ['w', 'ew-resize'], ['e', 'ew-resize'],
  ['nw', 'nwse-resize'], ['ne', 'nesw-resize'], ['sw', 'nesw-resize'], ['se', 'nwse-resize'],
];
// Posición y tamaño de partida: ancha y centrada, sin salirse de la pantalla.
const defaultWindowFrame = (): WindowFrame => {
  const vw = typeof window === 'undefined' ? 1440 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 900 : window.innerHeight;
  const width = Math.round(Math.max(MIN_WINDOW_WIDTH, Math.min(MAX_WINDOW_WIDTH, vw - 80)));
  const height = Math.round(Math.max(MIN_WINDOW_HEIGHT, Math.min(MAX_WINDOW_HEIGHT, vh - 60)));
  return { x: Math.max(8, Math.round((vw - width) / 2)), y: Math.max(8, Math.round((vh - height) / 2)), width, height };
};
// Coloca una ventana dentro de un límite: si cabe, entera; si es más grande que la pantalla, anclada para que
// siempre quede un trozo a la vista.
const fitInside = (value: number, size: number, limit: number) => size >= limit
  ? Math.max(limit - size, Math.min(0, value))
  : Math.max(0, Math.min(limit - size, value));

// El estarcido del monitor: una trama de puntos sobre el recuadro del contenido, como el relleno de la ventana
// de VEGAS. Se construye sobre el contexto que la va a usar (el patrón pertenece al contexto).
function stipplePattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const tile = document.createElement('canvas');
  tile.width = 8; tile.height = 8;
  const tileCtx = tile.getContext('2d');
  if (!tileCtx) return null;
  tileCtx.fillStyle = 'rgba(255,255,255,.30)';
  tileCtx.fillRect(0, 0, 1, 1);
  tileCtx.fillRect(4, 4, 1, 1);
  return ctx.createPattern(tile, 'repeat');
}

// Un grupo plegable del árbol de parámetros, con el cuadro [+]/[−] de VEGAS.
function ParamGroup({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <section className={`param-group ${open ? 'open' : 'closed'}`}>
      <button type="button" className="param-group-title" aria-expanded={open} onClick={onToggle}>
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <span className="param-group-mark">{open ? '−' : '+'}</span>
        <span className="param-group-name">{title}</span>
      </button>
      {open && <div className="param-group-body">{children}</div>}
    </section>
  );
}

// Campo numérico con el formato de VEGAS: separador de millares y un decimal, como el «1,920.0» de su árbol de
// parámetros. Mientras se escribe se respeta el texto tal cual (para no pelear con el cursor) y al salir del
// campo se vuelve a formatear; las flechas suben y bajan el valor por el paso. Se acepta lo que se escriba con o
// sin separadores: «1920», «1,920», «1,920.5» y «1920.5» valen lo mismo.
function CropField({ label, value, onChange, min, max, step = 1, decimals = 1, note }: {
  label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; decimals?: number; note?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const format = (number: number) => number.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const clamp = (number: number) => Math.max(min ?? -Infinity, Math.min(max ?? Infinity, number));
  const commit = (raw: string) => {
    const cleaned = raw.replace(/\s/g, '').replace(/,/g, '');
    if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.') return;
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) onChange(clamp(parsed));
  };
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        aria-label={label}
        title={note}
        value={draft ?? format(value)}
        onFocus={event => { setDraft(format(value)); event.currentTarget.select(); }}
        onChange={event => { setDraft(event.target.value); commit(event.target.value); }}
        onBlur={() => setDraft(null)}
        onKeyDown={event => {
          if (event.key === 'Enter') { setDraft(null); event.currentTarget.blur(); return; }
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
          event.preventDefault();
          const next = clamp(Number((value + (event.key === 'ArrowUp' ? step : -step)).toFixed(4)));
          setDraft(null);
          onChange(next);
        }}
      />
    </label>
  );
}

export function PanCropWindow(props: PanCropWindowProps) {
 return props.allowCrop === false ? <TrackMotionWindow {...props}/> : <EventPanCrop {...props}/>;
}
function TrackMotionWindow(props: PanCropWindowProps) {
  const { project, library, time, duration, eventStart, pose, mask, keys, source, label, allowCrop = true } = props;
  const preview = useMemo(() => ({ width: PREVIEW_WIDTH, height: Math.max(2, Math.round(PREVIEW_WIDTH * project.height / Math.max(1, project.width))) }), [project.width, project.height]);
  const frame = preview;
  // El lienzo del monitor es el fotograma más un margen, como el del monitor de VEGAS.
  const stage = { width: frame.width + STAGE_MARGIN * 2, height: frame.height + STAGE_MARGIN * 2 };
  const sourceSize = source ?? { width: frame.width, height: frame.height };
  const maskValue = mask ? maskOf({ transform: pose, mask }) : maskOf({ transform: pose });
  const box = contentBox(frame, sourceSize, maskValue);
  const local = time - eventStart;
  const current = keyAt(keys, local);
  const animated = keys.length > 0;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // La ventana entera, para el oyente de la rueda (que solo debe responder dentro del monitor).
  const rootRef = useRef<HTMLDivElement>(null);
  const [handle, setHandle] = useState<HandleId | null>(null);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [tool, setTool] = useState<Tool>('move');
  const [preset, setPreset] = useState('default');
  const [presetNote, setPresetNote] = useState('');
  const [locked, setLocked] = useState(false);
  const [windowFrame, setWindowFrame] = useState<WindowFrame>(defaultWindowFrame);
  // Los grupos del árbol se abren por defecto según lo que tenga el evento (Posición y Rotación siempre; el
  // recorte si el evento se recorta; la interpolación cuando ya hay claves —es donde se elige la curva de la
  // clave que se acaba de crear— y la máscara cuando hay un trazado). El usuario puede plegarlos o desplegarlos
  // y su decisión manda sobre el valor por defecto: así no hace falta sincronizar nada con un efecto.
  const [groupChoice, setGroupChoice] = useState<Record<string, boolean>>({});
  const defaultOpen = (id: string): boolean => id === 'position' || id === 'rotation' ? true
    : id === 'crop' ? allowCrop
    : id === 'keys' ? (keys ?? []).length > 0
    : id === 'mask' ? maskActive(maskPath)
    : false;
  const groupOpen = (id: string) => groupChoice[id] ?? defaultOpen(id);
  const toggleGroup = (id: string) => setGroupChoice(groups => ({ ...groups, [id]: !groupOpen(id) }));
  const [keyParameter, setKeyParameter] = useState<KeyParameter>('all');
  const [windowMenu, setWindowMenu] = useState(false);
  // «Vista de zoom (%)» y «Densidad de cuadrícula» del grupo «Área de trabajo»: son de la **vista** del monitor
  // (cuánto se agranda el fotograma en pantalla y cada cuántos píxeles se dibuja la cuadrícula), no del encuadre.
  const [viewZoom, setViewZoom] = useState(100);
  const [gridDensity, setGridDensity] = useState(0);
  // «Agregar recorte»: la selección de recorte sobre el monitor. Con ella puesta se dibujan los puntos de la
  // selección (las cuatro esquinas y los cuatro lados del recuadro que se conserva) y **las esquinas recortan y
  // acercan**: la región recortada se lleva al fotograma, así que cuanto más pequeña es la selección, más se
  // acerca la imagen, y al agrandarla se aleja. Los puntos de los lados recortan sin tocar el zoom.
  const [cropMode, setCropMode] = useState(false);
  const toolStart = useRef<{ x: number; y: number; pose: Transform } | null>(null);
  const toolDrag = useRef(false);
  // El arrastre de la selección se mide desde el principio (posición, pose y recorte de partida) y no fotograma
  // a fotograma: el zoom cambia durante el gesto y medirlo desde el principio evita que se acelere solo.
  const cropDrag = useRef<{ x: number; y: number; pose: Transform; mask: CropMask } | null>(null);
  const maskDrag = useRef<number | null>(null);
  const maskPath = normalizeMaskPath(props.maskPath);
  const maskMode = tool === 'mask';
  // Un cambio de máscara es un solo paso del historial: se avisa al empezar y se confirma al terminar.
  const editMask = (next: MaskPath) => { props.onBeginMask(); props.onMaskPath(next, true); };

  // ---------------------------------------------------------------- ventana flotante: mover y redimensionar
  // El arrastre se resuelve con oyentes en `window` (como el resto del editor): así el gesto sigue vivo
  // aunque el puntero salga de la ventana, y no depende de capturar el puntero.
  const clampWindowFrame = (next: WindowFrame): WindowFrame => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const width = Math.max(MIN_WINDOW_WIDTH, Math.min(Math.max(MIN_WINDOW_WIDTH, vw), next.width));
    const height = Math.max(MIN_WINDOW_HEIGHT, Math.min(Math.max(MIN_WINDOW_HEIGHT, vh), next.height));
    return { width, height, x: fitInside(next.x, width, vw), y: fitInside(next.y, height, vh) };
  };
  // `edge` es 'move' o el nombre del lado o esquina que se arrastra (n, s, e, w y las cuatro esquinas).
  const beginFrameDrag = (event: React.PointerEvent, edge: string) => {
    if (event.button !== 0) return;
    if (edge === 'move' && (event.target as HTMLElement).closest('button,input,select,textarea,canvas,label,a,[role=combobox]')) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX, startY = event.clientY, base = windowFrame;
    const move = (moved: PointerEvent) => {
      const dx = moved.clientX - startX, dy = moved.clientY - startY;
      if (edge === 'move') { setWindowFrame(clampWindowFrame({ ...base, x: base.x + dx, y: base.y + dy })); return; }
      let { x, y, width, height } = base;
      if (edge.includes('e')) width = base.width + dx;
      if (edge.includes('s')) height = base.height + dy;
      if (edge.includes('w')) { width = base.width - dx; x = base.x + dx; }
      if (edge.includes('n')) { height = base.height - dy; y = base.y + dy; }
      const next = clampWindowFrame({ x, y, width, height });
      // Al crecer hacia arriba o hacia la izquierda, el borde opuesto se queda quieto: se recalcula la posición
      // con el tamaño que realmente se ha podido aplicar.
      if (edge.includes('w')) next.x = base.x + base.width - next.width;
      if (edge.includes('n')) next.y = base.y + base.height - next.height;
      setWindowFrame(next);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  };
  // Si la ventana del navegador cambia de tamaño, la ventana flotante se mete de nuevo en pantalla.
  useEffect(() => {
    const fit = () => setWindowFrame(current => clampWindowFrame(current));
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // Cambiar un valor con la envolvente animada escribe en la clave del cursor (y la crea si no existe); sin
  // claves, cambia el valor fijo del evento. Es el comportamiento de VEGAS. `fromPreset` distingue los cambios
  // que vienen de un preestablecido para no borrar su nombre de la lista.
  const apply = (patch: { pose?: Transform; mask?: CropMask }, fromPreset = false) => {
    if (locked) return;
    if (!fromPreset) { setPreset('default'); setPresetNote(''); }
    if (animated) props.onKeys(upsertKey(keys, local, { ...(patch.pose ?? pose), ...(patch.mask ? { mask: patch.mask } : {}), time: local }));
    else {
      if (patch.pose) props.onPose(patch.pose);
      if (patch.mask) props.onMask(patch.mask);
    }
  };

  // La cadena de dependencias incluye lo que cambia el dibujo: la geometría, la selección de recorte y el modo
  // de máscara (con la máscara puesta no se dibujan las asas).
  const dependency = `${preview.width}x${preview.height}|${sourceSize.width}x${sourceSize.height}|${pose.x},${pose.y},${pose.scale},${pose.rotation},${pose.opacity}|${pose.pivot?.x??.5},${pose.pivot?.y??.5}|${maskValue.left},${maskValue.right},${maskValue.top},${maskValue.bottom}|${maskPath.points.map(point => `${point.x.toFixed(4)},${point.y.toFixed(4)}`).join(';')}|${maskPath.feather}|${maskPath.invert}|selection:${cropMode}|mask:${maskMode}|grid:${gridDensity}`;
  useEffect(() => {
    let cancelled = false;
    const paint = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      // La composición se hace en un lienzo del tamaño del fotograma y se pega dentro del margen: así el
      // monitor enseña lo que rodea al fotograma, como el de VEGAS.
      const offscreen = document.createElement('canvas');
      offscreen.width = frame.width; offscreen.height = frame.height;
      await compose(offscreen, project, library, time);
      if (cancelled) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, stage.width, stage.height);
      ctx.fillStyle = '#101010';
      ctx.fillRect(0, 0, stage.width, stage.height);
      ctx.drawImage(offscreen, STAGE_MARGIN, STAGE_MARGIN);
      // El borde del fotograma (el «área de trabajo» del proyecto).
      ctx.strokeStyle = '#8a8a8a';
      ctx.lineWidth = 1;
      ctx.strokeRect(STAGE_MARGIN - .5, STAGE_MARGIN - .5, frame.width + 1, frame.height + 1);
      const matrix = poseMatrix(frame, pose);
      // Todo lo que sigue se dibuja en coordenadas del fotograma, desplazadas por el margen.
      // La cuadrícula de referencia del grupo «Área de trabajo»: se dibuja sobre el fotograma, antes que la
      // caja, para que sirva de guía al encuadrar.
      if (gridDensity >= 8) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,.16)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = gridDensity; x < frame.width; x += gridDensity) { ctx.moveTo(STAGE_MARGIN + x + .5, STAGE_MARGIN); ctx.lineTo(STAGE_MARGIN + x + .5, STAGE_MARGIN + frame.height); }
        for (let y = gridDensity; y < frame.height; y += gridDensity) { ctx.moveTo(STAGE_MARGIN, STAGE_MARGIN + y + .5); ctx.lineTo(STAGE_MARGIN + frame.width, STAGE_MARGIN + y + .5); }
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.translate(STAGE_MARGIN, STAGE_MARGIN);
      // El medio completo, de referencia, y encima la caja de lo que se ve.
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      const whole = boxCorners(fittedBox(frame, sourceSize), frame, pose);
      ctx.beginPath();
      whole.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.closePath();
      ctx.stroke();
      // El estarcido del monitor: el recuadro del contenido se rellena con una trama de puntos —como el de la
      // ventana de VEGAS— para que se distinga del fotograma aunque el vídeo sea claro, y lo que el recorte
      // descarta se marca con rayas diagonales para ver de un vistazo qué se pierde.
      ctx.setLineDash([]);
      // El círculo del centro de giro, como la guía de VEGAS: pasa por las cuatro esquinas de la caja.
      const pivot = { x: (pose.pivot?.x ?? .5) * frame.width, y: (pose.pivot?.y ?? .5) * frame.height };
      const corners = boxCorners(box, frame, pose);
      // El estarcido del monitor: el recuadro del contenido se rellena con una trama de puntos —como el de la
      // ventana de VEGAS— para que se distinga del fotograma aunque el vídeo sea claro, y lo que el recorte
      // descarta se marca con rayas diagonales para ver de un vistazo qué se pierde.
      const stipple = stipplePattern(ctx);
      ctx.beginPath();
      corners.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.closePath();
      if (stipple) { ctx.fillStyle = stipple; ctx.fill(); }
      const discards = maskValue.left || maskValue.right || maskValue.top || maskValue.bottom;
      if (discards) {
        ctx.save();
        // El área que el recorte descarta: el medio menos el recuadro del contenido (regla par-impar).
        ctx.beginPath();
        whole.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
        ctx.closePath();
        corners.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
        ctx.closePath();
        ctx.clip('evenodd');
        ctx.strokeStyle = 'rgba(255,255,255,.22)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = -frame.height; x < frame.width; x += 7) { ctx.moveTo(x, frame.height); ctx.lineTo(x + frame.height, 0); }
        ctx.stroke();
        ctx.restore();
      }
      const radius = Math.max(...corners.map(point => Math.hypot(point.x - pivot.x, point.y - pivot.y)));
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.beginPath();
      ctx.arc(pivot.x, pivot.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pivot.x - 7, pivot.y); ctx.lineTo(pivot.x + 7, pivot.y);
      ctx.moveTo(pivot.x, pivot.y - 7); ctx.lineTo(pivot.x, pivot.y + 7);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffd166';
      ctx.beginPath();
      corners.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.closePath();
      ctx.stroke();
      // La selección de recorte, cuando está puesta: el recuadro que se conserva con su marca discontinua y sus
      // ocho puntos. Las esquinas (círculos) son los puntos que cambian el tamaño del recorte y acercan; los
      // puntos de los lados (cuadraditos) recortan sin acercar.
      const selectionColor = '#7ee0ff';
      if (cropMode) {
        ctx.save();
        ctx.setLineDash([7, 4]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = selectionColor;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      for (const id of HANDLES) {
        if (maskMode) break;                 // mientras se dibuja la máscara, las asas estorban
        const spot = applyMatrix(matrix, handlePoint(box, id));
        if (cropMode && isCornerHandle(id)) {
          // Las esquinas de la selección: punto redondo, que es el que se agarra para recortar y acercar.
          ctx.beginPath();
          ctx.arc(spot.x, spot.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = selectionColor;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#0d1b21';
          ctx.stroke();
          continue;
        }
        ctx.fillStyle = cropMode ? selectionColor : '#ffd166';
        const size = cropMode ? 7 : 8;
        ctx.fillRect(spot.x - size / 2, spot.y - size / 2, size, size);
        ctx.strokeStyle = '#1b1b1b';
        ctx.lineWidth = 1;
        ctx.strokeRect(spot.x - size / 2, spot.y - size / 2, size, size);
      }
      // La máscara libre, con sus puntos, encima de todo.
      if (maskPath.points.length) {
        const spots = maskPath.points.map(point => applyMatrix(matrix, { x: point.x * frame.width, y: point.y * frame.height }));
        ctx.beginPath();
        spots.forEach((spot, index) => index ? ctx.lineTo(spot.x, spot.y) : ctx.moveTo(spot.x, spot.y));
        if (spots.length >= 3) { ctx.closePath(); ctx.fillStyle = 'rgba(143,240,176,.14)'; ctx.fill(); }
        ctx.setLineDash(maskPath.invert ? [6, 4] : []);
        ctx.lineWidth = 2;
        ctx.strokeStyle = maskPath.invert ? '#ff9f9f' : '#8ff0b0';
        ctx.stroke();
        ctx.setLineDash([]);
        for (const spot of spots) {
          ctx.fillStyle = maskPath.invert ? '#ff9f9f' : '#8ff0b0';
          ctx.fillRect(spot.x - 3, spot.y - 3, 6, 6);
        }
      }
      ctx.restore();
    };
    void paint();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, library, time, dependency]);

  // La rueda solo afecta al **monitor** (lo que queda dentro del recuadro de la ventana): acerca y aleja la vista
  // («Vista de zoom (%)» del grupo Área de trabajo), como el zoom de la vista de la ventana de VEGAS, sin tocar el
  // encuadre. En el resto de la ventana la rueda **no hace nada**: ni desplaza la columna de parámetros, ni la
  // tira de claves, ni llega a la línea de tiempo de detrás. Por eso el oyente va en la ventana y no en el lienzo:
  // así se puede cancelar el desplazamiento del diálogo y del carril de debajo, y como `preventDefault` no vale en
  // un oyente pasivo, se registra a mano.
  useEffect(() => {
    const host = rootRef.current;
    if (!host) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const monitor = host.querySelector('.pan-crop-monitor');
      if (!monitor || !(event.target instanceof Node) || !monitor.contains(event.target)) return;
      const step = event.deltaMode === 0 ? event.deltaY * .0015 : event.deltaY * .02;
      setViewZoom(value => Math.max(25, Math.min(400, Math.round(value * Math.exp(-step)))));
    };
    host.addEventListener('wheel', onWheel, { passive: false });
    return () => host.removeEventListener('wheel', onWheel);
  });

  const measure = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = event.currentTarget.width / rect.width, scaleY = event.currentTarget.height / rect.height;
    return { scaleX, scaleY, point: toLocal({ x: (event.clientX - rect.left) * scaleX - STAGE_MARGIN, y: (event.clientY - rect.top) * scaleY - STAGE_MARGIN }, frame, pose) };
  };
  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    const { point, scaleX } = measure(event);
    // Giro 3D: el arrastre horizontal gira sobre el eje Y y el vertical sobre el X, como el «Movimiento de
    // pista 3D» de VEGAS. Va antes que las asas para que no compitan con ellas.
    if (tool === 'spin3d') {
      event.currentTarget.setPointerCapture(event.pointerId);
      toolStart.current = { x: event.clientX, y: event.clientY, pose };
      toolDrag.current = true;
      return;
    }
    // Dibujando la máscara: se agarra un punto existente o se añade uno nuevo.
    if (maskMode) {
      const fraction = { x: point.x / frame.width, y: point.y / frame.height };
      const index = maskPointAt(maskPath, fraction, 12 * scaleX / frame.width);
      if (index >= 0) {
        event.currentTarget.setPointerCapture(event.pointerId);
        props.onBeginMask();
        maskDrag.current = index;
        return;
      }
      editMask(addMaskPoint(maskPath, fraction));
      return;
    }
    // En una pista solo se mueve: el recorte es cosa de los eventos.
    const inside = point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height;
    // Las asas siempre recortan (salvo en una pista, que no recorta). Dentro de la caja manda la herramienta.
    const hit = allowCrop && tool !== 'zoom' && tool !== 'rotate' ? handleAt(box, point, 12 * scaleX) : (inside ? 'move' as HandleId : null);
    if (!hit) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setHandle(hit);
    lastPoint.current = { x: event.clientX, y: event.clientY };
    toolStart.current = { x: event.clientX, y: event.clientY, pose };
    toolDrag.current = tool === 'zoom' || tool === 'rotate';
    cropDrag.current = { x: event.clientX, y: event.clientY, pose, mask: maskValue };
  };
  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (toolStart.current && (tool === 'spin3d' || tool === 'zoom' || tool === 'rotate') && (toolDrag.current || handle)) {
      const start = toolStart.current;
      const limit = (value: number) => Math.max(-MAX_ROTATION_3D, Math.min(MAX_ROTATION_3D, value));
      // Un arrastre de todo el ancho del monitor equivale a 180°; con Mayús, a la mitad, para ajustar fino.
      const fine = event.shiftKey ? .5 : 1;
      if (tool === 'spin3d') {
        const deltaY = (event.clientX - start.x) / Math.max(1, frame.width) * 180 * fine;
        const deltaX = (event.clientY - start.y) / Math.max(1, frame.height) * 180 * fine;
        apply({ pose: { ...start.pose, rotationY: limit((start.pose.rotationY ?? 0) + deltaY), rotationX: limit((start.pose.rotationX ?? 0) + deltaX) } });
      } else if (tool === 'zoom') {
        const factor = Math.max(.05, Math.min(10, 1 + (event.clientX - start.x) / Math.max(120, frame.width / 2)));
        apply({ pose: { ...start.pose, scale: Math.max(.05, Math.min(10, start.pose.scale * factor)) } });
      } else {
        apply({ pose: { ...start.pose, rotation: start.pose.rotation + (event.clientX - start.x) / Math.max(1, frame.width) * 180 * fine } });
      }
      return;
    }
    if (maskDrag.current !== null) {
      const { point } = measure(event);
      props.onMaskPath(moveMaskPoint(maskPath, maskDrag.current, { x: point.x / frame.width, y: point.y / frame.height }), false);
      return;
    }
    if (!handle || !lastPoint.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = event.currentTarget.width / rect.width, scaleY = event.currentTarget.height / rect.height;
    // La herramienta «recortar» no mueve: solo las asas cambian algo.
    if (tool === 'crop' && handle === 'move') return;
    // Con la selección de recorte puesta, el arrastre se mide desde el principio y las esquinas, además de
    // recortar, llevan la región recortada al fotograma (acercan o alejan).
    const selection = cropDrag.current;
    if (cropMode && selection) {
      const total = { x: (event.clientX - selection.x) * scaleX, y: (event.clientY - selection.y) * scaleY };
      const moved = dragCropSelection({ frame, source: sourceSize, pose: selection.pose, mask: selection.mask, handle, delta: toLocalDelta(total, selection.pose), zoom: true });
      const change: { pose?: Transform; mask?: CropMask } = {};
      if (moved.pose.scale !== pose.scale || moved.pose.x !== pose.x || moved.pose.y !== pose.y) change.pose = moved.pose;
      if (moved.mask.left !== maskValue.left || moved.mask.right !== maskValue.right || moved.mask.top !== maskValue.top || moved.mask.bottom !== maskValue.bottom) change.mask = moved.mask;
      if (change.pose || change.mask) apply(change);
      return;
    }
    const raw = { x: (event.clientX - lastPoint.current.x) * scaleX, y: (event.clientY - lastPoint.current.y) * scaleY };
    lastPoint.current = { x: event.clientX, y: event.clientY };
    const next = dragHandle({ frame, source: sourceSize, pose, mask: maskValue, handle, delta: toLocalDelta(raw, pose) });
    const patch: { pose?: Transform; mask?: CropMask } = {};
    if (next.pose.x !== pose.x || next.pose.y !== pose.y) patch.pose = next.pose;
    if (next.mask.left !== maskValue.left || next.mask.right !== maskValue.right || next.mask.top !== maskValue.top || next.mask.bottom !== maskValue.bottom) patch.mask = next.mask;
    if (patch.pose || patch.mask) apply(patch);
  };
  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (toolStart.current && (tool === 'spin3d' || tool === 'zoom' || tool === 'rotate') && (toolDrag.current || handle)) {
      toolStart.current = null;
      toolDrag.current = false;
      setHandle(null);
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ya liberado */ }
      return;
    }
    if (maskDrag.current !== null) {
      maskDrag.current = null;
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ya liberado */ }
      props.onMaskPath(maskPath, true);      // un solo paso de historial para todo el arrastre
      return;
    }
    if (handle) { try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ya liberado */ } }
    setHandle(null);
    lastPoint.current = null;
    toolStart.current = null;
    toolDrag.current = false;
    cropDrag.current = null;
  };
  // Clic derecho sobre un punto de la máscara: se quita.
  const onContextMenu = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!maskMode) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = event.currentTarget.width / rect.width, scaleY = event.currentTarget.height / rect.height;
    const point = toLocal({ x: (event.clientX - rect.left) * scaleX - STAGE_MARGIN, y: (event.clientY - rect.top) * scaleY - STAGE_MARGIN }, frame, pose);
    const index = maskPointAt(maskPath, { x: point.x / frame.width, y: point.y / frame.height }, 12 / frame.width);
    if (index < 0) return;
    event.preventDefault();
    event.stopPropagation();
    editMask(removeMaskPoint(maskPath, index));
  };

  const goToKey = (direction: -1 | 1) => {
    const sorted = [...keys].sort((a, b) => a.time - b.time);
    const target = direction < 0 ? [...sorted].reverse().find(key => key.time < local - 1) : sorted.find(key => key.time > local + 1);
    if (target) props.onSeek(eventStart + target.time);
  };
  const goToEdgeKey = (edge: -1 | 1) => {
    const sorted = [...keys].sort((a, b) => a.time - b.time);
    const target = edge < 0 ? sorted[0] : sorted[sorted.length - 1];
    if (target) props.onSeek(eventStart + target.time);
  };
  // Los campos de la ventana de VEGAS van en píxeles del proyecto: a escala 1 el evento ocupa el fotograma
  // entero, así que «Anchura» es el ancho del proyecto por la escala y «Centro X» el centro del fotograma más
  // el desplazamiento. Así los números coinciden con los que muestra VEGAS (1920 / 1080 / 960 / 540).
  const projectWidth = Math.max(1, project.width), projectHeight = Math.max(1, project.height);
  const boxWidth = projectWidth * pose.scale, boxHeight = projectHeight * pose.scale;
  const centerX = projectWidth / 2 + pose.x * projectWidth, centerY = projectHeight / 2 + pose.y * projectHeight;
  // El centro de giro, en píxeles del proyecto. Se llama «Centro de giro» (y no «Centro X/Y») para no
  // confundirlo con el centro de la posición: dos campos con el mismo nombre serían ambiguos.
  const pivotX = (pose.pivot?.x ?? .5) * projectWidth, pivotY = (pose.pivot?.y ?? .5) * projectHeight;
  const setPivot = (x: number, y: number) => apply({ pose: { ...pose, pivot: { x: x / projectWidth, y: y / projectHeight } } });
  // Preestablecidos del encuadre, como la lista «Parámetro preestablecido» de VEGAS: los seis de serie más los
  // que se guardan con el botón «Guardar parámetro preestablecido» (viven en el proyecto, así que viajan con el
  // archivo). El valor del desplegable es `saved:<nombre>` para los guardados.
  const saved = props.presets ?? [];
  const savedPreset = preset.startsWith('saved:') ? saved.find(item => item.name === preset.slice(6)) ?? null : null;
  const presets: [string, string][] = [
    ['default', '(Predeterminado)'], ['center', 'Centrar el encuadre'], ['zoom2', 'Zoom 2× al centro'], ['rotate90', 'Girar 90°'],
    ...(allowCrop ? [['crop43', 'Recortar a 4:3'], ['crop11', 'Recortar a 1:1']] as [string, string][] : []),
    ...saved.map(item => [`saved:${item.name}`, item.name] as [string, string]),
  ];
  const savePreset = () => {
    const name = window.prompt('Nombre del parámetro preestablecido', `Encuadre ${saved.length + 1}`);
    if (name === null) return;
    const clean = name.trim();
    if (!clean) { setPresetNote('El parámetro preestablecido necesita un nombre.'); return; }
    const next = [...saved.filter(item => item.name !== clean), { name: clean, pose, ...(allowCrop ? { mask: maskValue } : {}) }];
    props.onPresets?.(next);
    setPreset(`saved:${clean}`); setPresetNote('');
  };
  const removePreset = () => {
    if (!savedPreset) return;
    if (!window.confirm('¿Está seguro que desea eliminar el parámetro? (Todos los fotogramas clave para ese parámetro se perderán.)')) return;
    props.onPresets?.(saved.filter(item => item.name !== savedPreset.name));
    setPreset('default');
  };
  const applyPreset = (id: string) => {
    setPreset(id);
    const stored = id.startsWith('saved:') ? saved.find(item => item.name === id.slice(6)) : null;
    if (stored) { apply({ pose: stored.pose, ...(allowCrop && stored.mask ? { mask: stored.mask } : {}) }, true); return; }
    if (id === 'default') apply({ pose: { ...resetPose(pose), opacity: 1, rotationX: 0, rotationY: 0, depth: 1, pivot: undefined }, mask: noCrop() }, true);
    else if (id === 'center') apply({ pose: { ...pose, x: 0, y: 0 } }, true);
    else if (id === 'zoom2') apply({ pose: { ...pose, x: 0, y: 0, scale: 2 } }, true);
    else if (id === 'rotate90') apply({ pose: { ...pose, rotation: 90 } }, true);
    else if (allowCrop) {
      const target = id === 'crop43' ? 4 / 3 : 1;
      const cropped = cropToAspect({ width: projectWidth, height: projectHeight }, target);
      if (cropped) apply({ mask: cropped }, true);
      else setPresetNote(`El fotograma del proyecto ya tiene la relación ${id === 'crop43' ? '4:3' : '1:1'}: no hay nada que recortar.`);
    }
  };
  // La tira de claves bajo el monitor: cada clave en su instante y la aguja del cursor, clic para ir.
  const seconds = (value: number) => value / TICKS_PER_SECOND;
  const stripStep = Math.max(1, Math.round(seconds(duration) / 5));
  const seekStrip = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
    props.onSeek(eventStart + fraction * duration);
  };
  // Claves que se ven según el parámetro elegido en la tira.
  const visibleKeys = keysChanging(keys, keyParameter);
  // Área de trabajo (el tramo de renderizado del proyecto): sirve para recortar el evento a esa relación.
  const workspace = project.region && project.region.end > project.region.start ? project.region : null;
  const workspaceAspect = workspace ? (projectWidth * (workspace.end - workspace.start) / projectHeight) : null;
  const regionSeconds = workspace ? seconds(workspace.end - workspace.start) : 0;

  return (
    <div
      ref={rootRef}
      className="pan-crop-window"
      style={{ left: windowFrame.x, top: windowFrame.y, width: windowFrame.width, height: windowFrame.height }}
      onPointerDown={event => beginFrameDrag(event, 'move')}
      aria-label={`Ventana de ${label}`}
    >
      {RESIZE_EDGES.map(([edge, cursor]) => (
        <span
          key={edge}
          className={`pan-crop-resize ${edge}`}
          style={{ cursor }}
          data-edge={edge}
          title="Arrastra para cambiar el tamaño de la ventana"
          onPointerDown={event => beginFrameDrag(event, edge)}
        />
      ))}
      <header className="pan-crop-titlebar" onDoubleClick={() => setWindowFrame(defaultWindowFrame())} title="Arrastra para mover la ventana · doble clic para centrarla">
        <span className="pan-crop-plugin">ƒx</span>
        <span className="pan-crop-label">{allowCrop ? 'Panoramización/Recorte de evento' : 'Movimiento de pista'}: {label}</span>
        <span className="pan-crop-size">{windowFrame.width}×{windowFrame.height}</span>
        <div className="pan-crop-windowmenu">
          <button className="pan-crop-icon" aria-label="Menú de la ventana" aria-expanded={windowMenu} title="Menú de la ventana" onClick={() => setWindowMenu(!windowMenu)}>≡</button>
          {windowMenu && <div className="pan-crop-windowmenu-list" role="menu">
            <button role="menuitem" onClick={() => { setWindowFrame(defaultWindowFrame()); setWindowMenu(false); }}>Centrar la ventana</button>
            <button role="menuitem" onClick={() => { applyPreset('default'); setWindowMenu(false); }}>Restablecer el encuadre</button>
            {allowCrop && <button role="menuitem" onClick={() => { setCropMode(!cropMode); setWindowMenu(false); }}>{cropMode ? 'Quitar la selección de recorte' : 'Agregar recorte'}</button>}
            {allowCrop && <button role="menuitem" onClick={() => { apply({ mask: noCrop() }); setWindowMenu(false); }}>Quitar el recorte</button>}
            <button role="menuitem" onClick={() => { setLocked(!locked); setWindowMenu(false); }}>{locked ? 'Desbloquear los parámetros' : 'Bloquear los parámetros'}</button>
            <button role="menuitem" onClick={props.onClose}>Cerrar</button>
          </div>}
        </div>
        <button className="range-button" aria-label="Centrar la ventana" title="Volver a centrar la ventana" onClick={() => setWindowFrame(defaultWindowFrame())}>Centrar</button>
        <button className="pan-crop-close" aria-label={`Cerrar la ventana de ${label}`} title="Cerrar la ventana" onClick={props.onClose}>×</button>
      </header>
      <div className="pan-crop-tabstrip">
        {/* Migas de la ventana, como las de VEGAS: a la izquierda el complemento anterior de la cadena y a la
            derecha el siguiente. Aquí la cadena tiene un solo complemento, así que el anterior vuelve a las
            propiedades del evento y el siguiente está apagado diciéndolo. */}
        <button
          className="pan-crop-icon"
          aria-label="Complemento anterior: volver a las propiedades del evento"
          title="Complemento anterior: vuelve a las propiedades del evento"
          onClick={props.onClose}
        ><ChevronLeft size={12} /></button>
        <span className="pan-crop-tab">{allowCrop ? 'Panoramización/Recorte' : 'Movimiento de pista'}</span>
        <button
          className="pan-crop-icon"
          aria-label="Complemento siguiente"
          title="No hay más complementos en esta cadena de efectos"
          disabled
        ><ChevronRight size={12} /></button>
        <button
          className={`pan-crop-icon ${locked ? 'active' : ''}`}
          aria-pressed={locked}
          aria-label={locked ? 'Desbloquear los parámetros' : 'Bloquear los parámetros'}
          title={locked ? 'Los parámetros están bloqueados: no se pueden cambiar' : 'Bloquear los parámetros para no cambiarlos sin querer'}
          onClick={() => setLocked(!locked)}
        >{locked ? <Lock size={12} /> : <LockOpen size={12} />}</button>
        <span className="grow" />
        <span className="pan-crop-hint">{cropMode ? 'Selección de recorte: las esquinas cambian el tamaño y acercan; los lados recortan sin acercar · la rueda acerca y aleja la vista' : TOOLS.find(item => item.id === tool)?.hint}</span>
      </div>
      <div className="pan-crop-preset">
        <span className="range-label">Parámetro preestablecido:</span>
        <Choice label="Parámetro preestablecido" value={preset} items={presets} onChange={applyPreset} />
        <button
          className="pan-crop-icon"
          aria-label="Guardar parámetro preestablecido"
          title="Guardar el encuadre actual como parámetro preestablecido"
          onClick={savePreset}
        ><Save size={12} /></button>
        <button
          className="pan-crop-icon"
          aria-label="Eliminar parámetro preestablecido"
          title={savedPreset ? 'Eliminar el parámetro preestablecido seleccionado' : 'Solo se pueden eliminar los preestablecidos guardados aquí'}
          disabled={!savedPreset}
          onClick={removePreset}
        ><Trash2 size={12} /></button>
        <button className="range-button wide" onClick={() => apply({ pose: resetPose(pose) })} disabled={locked}>Restablecer encuadre</button>
        {allowCrop && <button className="range-button wide" onClick={() => apply({ mask: noCrop() })} disabled={locked}>Quitar recorte</button>}
      </div>
      {presetNote && <p className="export-warning" role="alert">{presetNote}</p>}
      <div className="pan-crop-body">
        <div className="pan-crop-tools" role="toolbar" aria-label="Herramientas de la ventana de recorte">
          {TOOLS.filter(item => allowCrop || (item.id !== 'crop' && item.id !== 'mask')).map(item => (
            <button
              key={item.id}
              className={`pan-crop-tool ${tool === item.id ? 'active' : ''}`}
              aria-pressed={tool === item.id}
              aria-label={item.label}
              title={`${item.label} · ${item.hint}`}
              onClick={() => { setTool(item.id); if (item.id === 'crop') setCropMode(true); }}
            ><item.Icon size={14} /></button>
          ))}
        </div>
        <div className="pan-crop-params">
          <ParamGroup title="Posición" open={groupOpen('position')} onToggle={() => toggleGroup('position')}>
            <fieldset disabled={locked}>
              <CropField label="Anchura (px)" value={boxWidth} min={1} max={projectWidth * 10} step={1} onChange={v => apply({ pose: { ...pose, scale: v / projectWidth } })} note="Anchura del encuadre en píxeles del proyecto" />
              <CropField label="Altura (px)" value={boxHeight} min={1} max={projectHeight * 10} step={1} onChange={v => apply({ pose: { ...pose, scale: v / projectHeight } })} note="Altura del encuadre en píxeles del proyecto" />
              <CropField label="Centro X (px)" value={centerX} min={-projectWidth * 2} max={projectWidth * 3} step={1} onChange={v => apply({ pose: { ...pose, x: (v - projectWidth / 2) / projectWidth } })} note="Centro del encuadre en píxeles del proyecto" />
              <CropField label="Centro Y (px)" value={centerY} min={-projectHeight * 2} max={projectHeight * 3} step={1} onChange={v => apply({ pose: { ...pose, y: (v - projectHeight / 2) / projectHeight } })} note="Centro del encuadre en píxeles del proyecto" />
              <CropField label="Posición X (%)" value={pose.x * 100} min={-200} max={200} step={1} onChange={v => apply({ pose: { ...pose, x: v / 100 } })} note="Desplazamiento horizontal en porcentaje del fotograma" />
              <CropField label="Posición Y (%)" value={pose.y * 100} min={-200} max={200} step={1} onChange={v => apply({ pose: { ...pose, y: v / 100 } })} note="Desplazamiento vertical en porcentaje del fotograma" />
              <CropField label="Escala" value={pose.scale} min={.05} max={10} step={.05} decimals={2} onChange={v => apply({ pose: { ...pose, scale: v } })} note="Escala uniforme del encuadre" />
              <CropField label="Opacidad" value={pose.opacity} min={0} max={1} step={.05} decimals={2} onChange={v => apply({ pose: { ...pose, opacity: v } })} note="Opacidad del evento" />
            </fieldset>
          </ParamGroup>
          <ParamGroup title="Rotación" open={groupOpen('rotation')} onToggle={() => toggleGroup('rotation')}>
            <fieldset disabled={locked}>
              <CropField label="Ángulo (°)" value={pose.rotation} min={-36000} max={36000} step={1} onChange={v => apply({ pose: { ...pose, rotation: v } })} note="Giro del encuadre en grados" />
              <CropField label="Centro de giro X (px)" value={pivotX} min={-projectWidth * 2} max={projectWidth * 3} step={1} onChange={v => setPivot(v, pivotY)} note="Centro X del grupo Rotación de VEGAS: el punto sobre el que gira la caja" />
              <CropField label="Centro de giro Y (px)" value={pivotY} min={-projectHeight * 2} max={projectHeight * 3} step={1} onChange={v => setPivot(pivotX, v)} note="Centro Y del grupo Rotación de VEGAS: el punto sobre el que gira la caja" />
              <div className="button-row">
                <button onClick={() => setPivot(projectWidth / 2, projectHeight / 2)}>Centrar el giro</button>
                <button onClick={() => setPivot(centerX, centerY)} title="Pone el centro de giro en el centro del encuadre">Girar sobre el encuadre</button>
              </div>
              <p><small>El centro de giro es el «Centro X/Y» del grupo Rotación de VEGAS: el círculo del monitor lo señala y la caja gira alrededor de él. Por defecto es el centro del fotograma.</small></p>
              <h5 className="param-subhead">Movimiento 3D</h5>
              <CropField label="Rotación X (°)" value={pose.rotationX ?? 0} min={-MAX_ROTATION_3D} max={MAX_ROTATION_3D} step={1} onChange={v => apply({ pose: { ...pose, rotationX: v } })} note="Giro sobre el eje horizontal" />
              <CropField label="Rotación Y (°)" value={pose.rotationY ?? 0} min={-MAX_ROTATION_3D} max={MAX_ROTATION_3D} step={1} onChange={v => apply({ pose: { ...pose, rotationY: v } })} note="Giro sobre el eje vertical" />
              <CropField label="Distancia" value={pose.depth ?? 1} min={MIN_DEPTH} max={MAX_DEPTH} step={.05} decimals={2} onChange={v => apply({ pose: { ...pose, depth: v } })} note="Distancia al plano de imagen" />
              <div className="button-row">
                <button className={tool === 'spin3d' ? 'active' : ''} aria-pressed={tool === 'spin3d'} onClick={() => setTool(tool === 'spin3d' ? 'move' : 'spin3d')}>{tool === 'spin3d' ? 'Terminar de girar' : 'Girar con el ratón'}</button>
                <button onClick={() => apply({ pose: { ...pose, rotationX: 0, rotationY: 0, depth: 1 } })}>Quitar 3D</button>
              </div>
              <p><small>Los giros sobre los ejes X e Y y la distancia al plano son los del «Movimiento de pista 3D» de VEGAS 15. Con «Girar con el ratón» el arrastre horizontal gira sobre Y y el vertical sobre X, y con Mayús se ajusta fino. La distancia solo cambia el tamaño mientras los giros estén a cero.</small></p>
            </fieldset>
          </ParamGroup>
          {allowCrop && <ParamGroup title="Recorte" open={groupOpen('crop')} onToggle={() => toggleGroup('crop')}>
            <fieldset disabled={locked}>
              <CropField label="Recorte izq. (%)" value={maskValue.left * 100} min={0} max={45} step={1} onChange={v => apply({ mask: { ...maskValue, left: v / 100 } })} note="Porcentaje recortado por la izquierda" />
              <CropField label="Recorte der. (%)" value={maskValue.right * 100} min={0} max={45} step={1} onChange={v => apply({ mask: { ...maskValue, right: v / 100 } })} note="Porcentaje recortado por la derecha" />
              <CropField label="Recorte arriba (%)" value={maskValue.top * 100} min={0} max={45} step={1} onChange={v => apply({ mask: { ...maskValue, top: v / 100 } })} note="Porcentaje recortado por arriba" />
              <CropField label="Recorte abajo (%)" value={maskValue.bottom * 100} min={0} max={45} step={1} onChange={v => apply({ mask: { ...maskValue, bottom: v / 100 } })} note="Porcentaje recortado por abajo" />
              <div className="button-row">
                <button
                  className={cropMode ? 'active' : ''}
                  aria-pressed={cropMode}
                  aria-label="Agregar recorte"
                  title="Muestra la selección de recorte sobre el monitor: las esquinas cambian el tamaño del recorte y acercan la imagen (cuanto más pequeña la selección, más cerca), y los puntos de los lados recortan sin acercar"
                  onClick={() => setCropMode(!cropMode)}
                >Agregar recorte</button>
                <button onClick={() => apply({ mask: noCrop() })}>Sin recorte</button>
                <button onClick={() => { const cropped = cropToAspect({ width: projectWidth, height: projectHeight }, 1); if (cropped) apply({ mask: cropped }); }}>Cuadrado (1:1)</button>
              </div>
              <p><small>{describeMask(maskValue)}. El recorte es de cuatro márgenes independientes: en VEGAS se hace arrastrando las asas del monitor y aquí, además, se puede escribir el porcentaje de cada lado.{cropMode ? ' Con la selección puesta, las esquinas recortan y acercan: la región que queda se lleva al fotograma. Se pone y se quita con «Agregar recorte» o con la herramienta «Recortar».' : ''}</small></p>
            </fieldset>
          </ParamGroup>}
          <ParamGroup title="Interpolación de fotogramas clave" open={groupOpen('keys')} onToggle={() => toggleGroup('keys')}>
            {/* «Suavidad (%)» es el control del grupo en VEGAS: 0 % deja la curva lineal y 100 % la curva en S
                completa, y solo afecta a las claves con curva «Suave». En la ventana de una pista no hay
                interpolación que suavizar, así que el campo no se muestra. */}
            {props.onSmoothness && <fieldset disabled={locked}>
              <CropField label="Suavidad (%)" value={props.smoothness ?? 100} min={0} max={100} step={1} onChange={v => props.onSmoothness?.(v)} note="Cuánto se suaviza la curva «Suave» de las claves: 0 % lineal y 100 % curva en S" />
            </fieldset>}
            {animated ? <fieldset disabled={locked}>
              <div className="field"><span>Curva de la clave del cursor</span>
                <Choice label="Curva de la clave del cursor" value={current?.curve ?? 'linear'} items={EASE_KINDS.map(kind => [kind, EASE_LABEL[kind]])} onChange={v => props.onKeys(upsertKey(keys, local, { curve: v as EaseKind }))} />
              </div>
              <p><small>{current ? `${EASE_NOTE[(current.curve ?? 'linear') as EaseKind]} Clave en ${seconds(local).toFixed(2)} s.` : 'No hay clave en el cursor: usa «Añadir clave aquí» para crear una y poder darle curva.'}</small></p>
              <div className="button-row">
                <button onClick={() => props.onKeys(keys.map(key => ({ ...key, curve: 'smooth' as EaseKind })))}>Suavizar todas</button>
                <button onClick={() => props.onKeys(keys.map(key => ({ ...key, curve: 'linear' as EaseKind })))}>Linealizar todas</button>
              </div>
            </fieldset> : <p><small>Sin claves todavía: la envolvente se crea al pulsar «Añadir clave aquí» o al cambiar un valor con una clave en el cursor.</small></p>}
          </ParamGroup>
          <ParamGroup title="Origen" open={groupOpen('source')} onToggle={() => toggleGroup('source')}>
            {/* El grupo «Origen» de VEGAS son dos casillas: «Mantener rel. de aspecto» y «Extender para rellenar
                f.», y las dos son interruptores de verdad sobre el mismo evento que el de las propiedades. La
                primera viene puesta (proporción conservada, con bandas donde no cuadra) y quitada estira el
                material hasta llenar el fotograma; sin medio no hay nada que encajar, así que se bloquean. */}
            <label className="check" title="Puesta, el material conserva su proporción y deja bandas si no cuadra con el fotograma; quitada, se estira hasta llenarlo aunque se deforme. Es la misma casilla que en las propiedades del evento. Sin medio (un generador) no hay nada que encajar, así que queda bloqueada.">
              <input
                type="checkbox"
                aria-label="Mantener rel. de aspecto"
                checked={props.maintainAspect ?? true}
                disabled={locked || !source}
                onChange={event => props.onMaintainAspect?.(event.target.checked)}
              />
              Mantener rel. de aspecto
            </label>
            <label className="check" title="El material se escala hasta cubrir el fotograma del proyecto sin deformarse: lo que sobra se sale del encuadre. Es lo mismo que la acción «Encajar el contenido al fotograma».">
              <input
                type="checkbox"
                aria-label="Extender para rellenar f."
                checked={Boolean(props.stretchFill)}
                disabled={locked || !source}
                onChange={event => props.onStretchFill?.(event.target.checked)}
              />
              Extender para rellenar f.
            </label>
            <dl className="param-list">
              <div><dt>Medio</dt><dd>{source ? `${source.width} × ${source.height} px` : 'sin medio: se usa el fotograma'}</dd></div>
              <div><dt>Fotograma del proyecto</dt><dd>{projectWidth} × {projectHeight} px</dd></div>
              <div><dt>Monitor</dt><dd>{preview.width} × {preview.height} px</dd></div>
            </dl>
          </ParamGroup>
          <ParamGroup title="Área de trabajo" open={groupOpen('workspace')} onToggle={() => toggleGroup('workspace')}>
            {/* «Vista de zoom» agranda el fotograma **en el monitor** y «Densidad de cuadrícula» dibuja una
                cuadrícula cada tantos píxeles del fotograma: son de la vista, no del encuadre. */}
            <CropField label="Vista de zoom (%)" value={viewZoom} min={25} max={400} step={5} onChange={setViewZoom} note="Cuánto se agranda el fotograma en el monitor (no cambia el encuadre)" />
            <CropField label="Densidad de cuadrícula (px)" value={gridDensity} min={0} max={480} step={8} onChange={setGridDensity} note="Cuadrícula de referencia cada tantos píxeles del fotograma (0 = sin cuadrícula)" />
            <dl className="param-list">
              <div><dt>Tramo de renderizado</dt><dd>{workspace ? `${seconds(workspace.start).toFixed(2)} s → ${seconds(workspace.end).toFixed(2)} s` : 'sin tramo'}</dd></div>
              <div><dt>Relación del área</dt><dd>{workspaceAspect ? workspaceAspect.toFixed(3) : '—'}</dd></div>
            </dl>
            <button
              className="wide-button"
              disabled={!allowCrop || !workspaceAspect || locked}
              title={workspaceAspect ? 'Recorta el evento a la relación de aspecto del tramo de renderizado' : 'Marca primero un tramo de renderizado en la línea de tiempo'}
              onClick={() => { const cropped = workspaceAspect ? cropToAspect({ width: projectWidth, height: projectHeight }, workspaceAspect) : null; if (cropped) apply({ mask: cropped }); }}
            >Recortar al área de trabajo ({regionSeconds.toFixed(2)} s)</button>
          </ParamGroup>
          {allowCrop && <ParamGroup title="Máscara libre (trazado)" open={groupOpen('mask')} onToggle={() => toggleGroup('mask')}>
            <div className="button-row">
              <button className={maskMode ? 'active' : ''} aria-pressed={maskMode} onClick={() => setTool(maskMode ? 'move' : 'mask')}>{maskMode ? 'Terminar de dibujar' : 'Dibujar máscara'}</button>
              <button onClick={() => editMask({ ...maskPath, points: [] })} disabled={!maskPath.points.length}>Vaciar</button>
              <button className={maskPath.invert ? 'active' : ''} aria-pressed={maskPath.invert} onClick={() => editMask({ ...maskPath, invert: !maskPath.invert })} disabled={!maskActive(maskPath)}>Invertir</button>
            </div>
            <CropField label="Pluma (px)" value={maskPath.feather} min={0} max={200} step={1} onChange={v => editMask({ ...maskPath, feather: v })} note="Suavizado del borde de la máscara libre" />
            <p><small>{maskActive(maskPath)
              ? `Recorta el evento con ${maskPath.points.length} punto(s)${maskPath.invert ? ' e invierte lo de dentro' : ''}${maskPath.feather ? ` y un borde suave de ${maskPath.feather} px` : ''}.`
              : `La máscara necesita al menos tres puntos para recortar; llevas ${maskPath.points.length}.`} {maskMode ? 'Haz clic en el monitor para añadir puntos, arrástralos para moverlos y usa el clic derecho para quitarlos.' : 'Pulsa «Dibujar máscara» para editarla.'}</small></p>
          </ParamGroup>}
        </div>
        <div className="pan-crop-view">
          <div className="pan-crop-monitor">
            <canvas
              ref={canvasRef}
              className="pan-crop-stage"
              width={stage.width}
              height={stage.height}
              data-margin={STAGE_MARGIN}
              data-frame-width={frame.width}
              data-frame-height={frame.height}
              data-view-zoom={viewZoom}
              data-grid-density={gridDensity}
              data-crop-selection={cropMode ? 'on' : 'off'}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onContextMenu={onContextMenu}
              style={{ cursor: maskMode ? 'copy' : tool === 'rotate' || tool === 'spin3d' ? 'ew-resize' : tool === 'zoom' ? 'ns-resize' : handle === 'move' ? 'grabbing' : 'crosshair', touchAction: 'none', width: `${viewZoom}%`, maxWidth: viewZoom > 100 ? 'none' : '100%', flexShrink: 0 }}
            />
          </div>
          <div className="pan-crop-keybar">
            <div className="pan-crop-keyrow">
              <div className="field pan-crop-keyparam"><span>Parámetro</span>
                <Choice label="Parámetro de la tira de claves" value={keyParameter} items={KEY_PARAMETERS.map(item => [item.value, item.label])} onChange={v => setKeyParameter(v as KeyParameter)} />
              </div>
              <label className="check pan-crop-maskcheck" title="Dibuja y edita la máscara libre sobre el monitor">
                <input type="checkbox" aria-label="Máscara" checked={maskMode} onChange={e => setTool(e.target.checked ? 'mask' : 'move')} />
                Máscara
              </label>
              <div className="pan-crop-keytools">
                <button className="pan-crop-icon" aria-label="Primer fotograma clave" title="Primer fotograma clave" disabled={!keys.length} onClick={() => goToEdgeKey(-1)}><SkipBack size={12} /></button>
                <button className="pan-crop-icon" aria-label="Fotograma clave anterior" title="Fotograma clave anterior" disabled={!keys.length} onClick={() => goToKey(-1)}><StepBack size={12} /></button>
                <button className="pan-crop-icon" aria-label="Añadir fotograma clave" title="Añadir fotograma clave" onClick={() => props.onKeys(upsertKey(keys, local, { ...pose, mask: maskValue, time: local }))}><Diamond size={12} /></button>
                <button className="pan-crop-icon" aria-label="Siguiente fotograma clave" title="Siguiente fotograma clave" disabled={!keys.length} onClick={() => goToKey(1)}><StepForward size={12} /></button>
                <button className="pan-crop-icon" aria-label="Último fotograma clave" title="Último fotograma clave" disabled={!keys.length} onClick={() => goToEdgeKey(1)}><SkipForward size={12} /></button>
                <button className="pan-crop-icon" aria-label="Eliminar fotograma clave" title="Eliminar el fotograma clave que hay en el cursor" disabled={!current} onClick={() => props.onKeys(removeKey(keys, local))}><Trash2 size={12} /></button>
              </div>
              <span className="grow" />
              <span className="pan-crop-keycount" title="Claves que muestra la tira">{visibleKeys.length} de {keys.length} claves</span>
              <div className="pan-crop-zoom">
                <button className="pan-crop-icon" aria-label="Alejar la vista" title="Alejar la vista del monitor" onClick={() => setViewZoom(value => Math.max(25, value - 25))}><Minus size={12} /></button>
                <button className="pan-crop-icon" aria-label="Acercar la vista" title="Acercar la vista del monitor" onClick={() => setViewZoom(value => Math.min(400, value + 25))}><Plus size={12} /></button>
              </div>
            </div>
            <div className="pan-crop-keys" title="Claves del encuadre: clic para colocar el cursor">
              <div className="pan-crop-keys-track" onPointerDown={seekStrip}>
                {Array.from({ length: Math.max(2, Math.ceil(seconds(duration) / stripStep) + 1) }, (_, index) => {
                  const at = index * stripStep;
                  return <span key={at} className="key-tick" style={{ left: `${Math.min(100, at / Math.max(.001, seconds(duration)) * 100)}%` }}>{`00:00:${String(Math.floor(at)).padStart(2, '0')}`}</span>;
                })}
                {visibleKeys.map(key => <i key={`${key.time}`} className={`key-mark ${current && Math.abs(key.time - local) <= 1 ? 'current' : ''}`} style={{ left: `${Math.min(100, Math.max(0, key.time / Math.max(1, duration) * 100))}%` }} />)}
                <i className="key-playhead" style={{ left: `${Math.min(100, Math.max(0, local / Math.max(1, duration) * 100))}%` }} />
              </div>
              <span className="pan-crop-timecode">{seconds(local).toFixed(2)} s</span>
            </div>
          </div>
          <p className="export-plan">{animated
            ? `Envolvente con ${keys.length} clave(s). ${current ? `Clave en ${seconds(local).toFixed(2)} s.` : 'No hay clave en el cursor: al mover algo se creará aquí.'}`
            : 'Sin claves: los valores son fijos. Al añadir una clave, los cambios se guardan en la clave del cursor.'}</p>
          <p className="export-plan">{allowCrop ? `Recorte actual: ${describeMask(maskValue)}. Arrastra las asas para recortar, el centro para mover y usa la rueda para acercar y alejar la vista de la ventana (no cambia el encuadre).${cropMode ? ' Con la selección de recorte puesta, las esquinas del recuadro recortan y acercan a la vez.' : ''}` : 'Arrastra dentro de la caja para mover la pista y usa la rueda para acercar y alejar la vista. El giro y la escala también valen para la pista entera.'}</p>
          <div className="pan-crop-status">
            <button onClick={() => props.onKeys(upsertKey(keys, local, { ...pose, mask: maskValue, time: local }))}>Añadir clave aquí</button>
            <button onClick={() => props.onKeys(removeKey(keys, local))} disabled={!current}>Quitar clave</button>
            <button onClick={() => goToKey(-1)} disabled={!keys.length}>← Clave anterior</button>
            <button onClick={() => goToKey(1)} disabled={!keys.length}>Clave siguiente →</button>
            <span className="pan-crop-status-time">{seconds(local).toFixed(2)} s de {seconds(duration).toFixed(2)} s</span>
            <button onClick={props.onClose}>Cerrar</button>
          </div>
          <p><small>El encuadre y el recorte también se guardan al dividir, recortar o mover el evento: las claves viajan con él. Duración de referencia: {seconds(duration).toFixed(2)} s.</small></p>
        </div>
      </div>
    </div>
  );
}
