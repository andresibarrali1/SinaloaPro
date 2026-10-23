"use client";
import { useEffect, useRef, useState } from "react";
import {
  MaskPen,
  MaskDelete,
  MaskRectangle,
  MaskEllipse,
  Settings,
  MousePointer2,
  ZoomIn,
  Magnet,
  Lock,
  Move,
  Save,
  X,
  Diamond,
  SkipBack,
  SkipForward,
  ArrowLeft,
  ArrowRight,
  Plus,
  Minus,
  Focus,
  Aspect,
  AddKey,
  DeleteKey,
  SyncCursor,
} from "./pan-crop-icons";
import { setKeyInterpolation } from "@/lib/editor/keyframe-actions";
import type { PanCropWindowProps } from "./pan-crop";
import {
  cropFrameSpace,
  cropMargins,
  setCropMargin,
  matchCropAspect,
  type CropFrame,
  defaultCropFrame,
  resizeCropFrame,
  moveCropFrame,
  rotateCropFrame,
} from "@/lib/editor/crop-frame";
import { compose } from "@/lib/editor/compositor";
import {
  transform,
  pose as eventPose,
  frameTicks,
  quantize,
  EASE_KINDS,
  EASE_LABEL,
  type Keyframe,
} from "@/lib/editor/project";
import {
  keyAt,
  upsertKey,
  removeKey,
  poseMatrix,
  applyMatrix,
  toLocal,
} from "@/lib/editor/pancrop";
import {
  shapeMask,
  normalizeMaskPath,
  addMaskPoint,
  moveMaskPoint,
  removeMaskPoint,
} from "@/lib/editor/mask";
import "./event-pan-crop.css";

const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
function Field({
  label,
  value,
  change,
  min = -100000,
  max = 100000,
}: {
  label: string;
  value: number;
  change: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft.trim()) {
      const n = Number(draft.replaceAll(",", ""));
      if (Number.isFinite(n)) change(Math.max(min, Math.min(max, n)));
    }
    setDraft(null);
  };
  return (
    <label className="ec-field">
      <span>{label.replace("Centro de rotación", "Centro")}:</span>
      <input
        aria-label={label}
        value={
          draft ??
          value.toLocaleString("en-US", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })
        }
        onFocus={(e) => {
          setDraft(String(value));
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setDraft(null);
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            change(
              Math.max(
                min,
                Math.min(max, value + (e.key === "ArrowUp" ? 1 : -1)),
              ),
            );
            setDraft(null);
          }
        }}
      />
    </label>
  );
}
function Group({
  title,
  children,
  open = false,
}: {
  title: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details className="ec-group" open={open || undefined}>
      <summary>{title}</summary>
      {children}
    </details>
  );
}
function Button({
  label,
  children,
  onClick,
  active,
  disabled = false,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      style={active ? { background: "#246fa8", borderColor: "#79bfff", boxShadow: "inset 1px 1px 0 #15476c, inset -1px -1px 0 #438fc7" } : undefined}
      className={active ? "active" : ""}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function EventPanCrop(p: PanCropWindowProps) {
  const source =
    p.source && p.source.width > 0 && p.source.height > 0
      ? p.source
      : { width: p.project.width, height: p.project.height };
  const w = source.width,
    h = source.height;
  const toStored = (frame: CropFrame) =>
    cropFrameSpace(frame, source, p.project, false, p.maintainAspect === false);
  const fromStored = (frame: CropFrame) =>
    cropFrameSpace(frame, source, p.project, true, p.maintainAspect === false);
  const [showProperties, setShowProperties] = useState(true);
  const [tool, setTool] = useState<"select" | "zoom" | "pan">("select");
  const [maskMode, setMaskMode] = useState(false);
  const [maskTool, setMaskTool] = useState<
    "select" | "add" | "delete" | "rectangle" | "ellipse"
  >("select");
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const shapeGesture = useRef<{
    start: { x: number; y: number };
    next: ReturnType<typeof normalizeMaskPath>;
  } | null>(null);
  const [lock, setLock] = useState(true),
    [center, setCenter] = useState(true),
    [snap, setSnap] = useState(false),
    [axis, setAxis] = useState<"xy" | "x" | "y">("xy");
  const [zoom, setZoom] = useState(1),
    [offset, setOffset] = useState({ x: 0, y: 0 }),
    [grid, setGrid] = useState(32);
  const [preset, setPreset] = useState("default"),
    [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [keyMenu, setKeyMenu] = useState<{
    x: number;
    y: number;
    time: number;
  } | null>(null);
  const keyMenuRef = useRef<HTMLDivElement>(null);
  const keyMenuAnchor = useRef<HTMLButtonElement | null>(null);
  const closeKeyMenu = () => {
    setKeyMenu(null);
    keyMenuAnchor.current?.focus();
  };
  useEffect(() => {
    if (!keyMenu) return;
    keyMenuRef.current
      ?.querySelector<HTMLButtonElement>(
        '[aria-checked="true"],button:not(:disabled)',
      )
      ?.focus();
    const outside = (event: PointerEvent) => {
      if (!keyMenuRef.current?.contains(event.target as Node)) setKeyMenu(null);
    };
    const dismiss = () => setKeyMenu(null);
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [keyMenu]);
  const [keyZoom, setKeyZoom] = useState(1),
    [sync, setSync] = useState(true),
    [localCursor, setLocalCursor] = useState(
      Math.max(0, p.time - p.eventStart),
    );
  const [bounds, setBounds] = useState(() => ({
    x: Math.max(0, (window.innerWidth - 940) / 2),
    y: Math.max(0, (window.innerHeight - 580) / 2),
    width: Math.min(940, window.innerWidth),
    height: Math.min(580, window.innerHeight),
  }));
  const canvas = useRef<HTMLCanvasElement>(null),
    svg = useRef<SVGSVGElement>(null),
    workspace = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 690, height: 355 });
  const local = Math.max(
    0,
    Math.min(p.duration, sync ? p.time - p.eventStart : localCursor),
  );
  const activeEvent = p.project.events.find((e) => e.id === p.eventId);
  const atPose = activeEvent
    ? eventPose(activeEvent, p.eventStart + local)
    : p.pose;
  const initial = atPose.cropFrame
    ? fromStored(atPose.cropFrame)
    : fromStored(defaultCropFrame());
  const [draft, setDraft] = useState<CropFrame | null>(null),
    c = draft ?? initial;
  const current = keyAt(p.keys, local),
    keys = [...p.keys].sort((a, b) => a.time - b.time);
  const fit = Math.min((size.width - 110) / w, (size.height - 36) / h),
    scale = Math.max(0.0001, fit * zoom);
  const ox = size.width / 2 - (w * scale) / 2 + offset.x,
    oy = size.height / 2 - (h * scale) / 2 + offset.y;
  const pos = { x: ox + c.x * w * scale, y: oy + c.y * h * scale },
    cw = c.width * w * scale,
    ch = c.height * h * scale;
  const tick = frameTicks(p.project.fps);
  const seek = (at: number) => {
    const t = Math.min(p.duration, quantize(Math.max(0, at), p.project.fps));
    setLocalCursor(t);
    if (sync) p.onSeek(p.eventStart + t);
  };
  const write = (next: CropFrame) => {
    next = {
      ...next,
      x: Math.max(-100, Math.min(100, next.x)),
      y: Math.max(-100, Math.min(100, next.y)),
      width: Math.max(0.001, Math.min(100, next.width)),
      height: Math.max(0.001, Math.min(100, next.height)),
      angle: Math.max(-36000, Math.min(36000, next.angle)),
      pivotX: Math.max(-100, Math.min(100, next.pivotX)),
      pivotY: Math.max(-100, Math.min(100, next.pivotY)),
    };
    const pose = { ...atPose, cropFrame: toStored(next) };
    // Editing away from zero creates the initial anchor and a key at the cursor in one history command.
    if (p.keys.length || local >= tick) {
      let list = p.keys;
      if (!list.length)
        list = upsertKey([], 0, {
          ...atPose,
          cropFrame: toStored(initial),
          time: 0,
        });
      p.onKeys(upsertKey(list, local, { ...pose, time: local }));
    } else p.onPose(pose);
    setDraft(null);
    setPreset("custom");
  };
  const patch = (part: Partial<CropFrame>) => write({ ...c, ...part });
  const timecode = (at: number) => {
    const frames = Math.floor(at / tick + 0.00001),
      fps = Math.round(p.project.fps.num / p.project.fps.den),
      sec = Math.floor(frames / fps);
    return `${String(Math.floor(sec / 3600)).padStart(2, "0")}:${String(Math.floor(sec / 60) % 60).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}.${String(frames % fps).padStart(2, "0")}`;
  };
  useEffect(() => {
    const el = workspace.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setSize({ width: el.clientWidth, height: el.clientHeight }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let cancelled = false;
    const event = p.project.events.find((e) => e.id === p.eventId);
    if (!event) return;
    const track = p.project.tracks.find((t) => t.id === event.trackId);
    if (!track) return;
    // The workspace shows only this event before its camera rectangle, never other timeline tracks.
    const neutral = { ...atPose, cropFrame: undefined };
    const isolated = {
      ...p.project,
      width: w,
      height: h,
      tracks: [
        {
          ...track,
          transform: transform(),
          mute: false,
          solo: false,
          composite: "normal" as const,
        },
      ],
      events: [
        {
          ...event,
          maskPath: maskMode ? undefined : event.maskPath,
          transform: neutral,
          keys: [],
          fadeIn: 0,
          fadeOut: 0,
          transition: undefined,
        },
      ],
    };
    const off = document.createElement("canvas");
    off.width = 960;
    off.height = Math.max(1, Math.round((960 * h) / w));
    void compose(
      off,
      event.adjustmentLayer ? {
        ...p.project,
        tracks:p.project.tracks.slice(p.project.tracks.findIndex(t=>t.id===event.trackId)+1),
        events:p.project.events.filter(e=>e.id!==event.id),
      } : isolated,
      p.library,
      p.eventStart + Math.min(local, Math.max(0, p.duration - tick)),
    )
      .then(() => {
        if (cancelled || !canvas.current) return;
        const ctx = canvas.current.getContext("2d");
        if (ctx) {
          canvas.current.width = off.width;
          canvas.current.height = off.height;
          ctx.drawImage(off, 0, 0);
        }
      })
      .catch((error) => {
        if (!cancelled) setError(String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [p.project, p.library, p.eventId, local, w, h, maskMode]);
  const [error, setError] = useState("");
  const maskPath = normalizeMaskPath(p.maskPath);
  const maskGesture = useRef<number | null>(null);
  const maskNext = useRef<typeof maskPath | null>(null);
  const maskPoint = (e: React.PointerEvent) => {
    const rect = svg.current!.getBoundingClientRect();
    const point = toLocal(
      {
        x: (e.clientX - rect.left - ox) / scale,
        y: (e.clientY - rect.top - oy) / scale,
      },
      { width: w, height: h },
      atPose,
    );
    return {
      x: (snap ? Math.round(point.x / grid) * grid : point.x) / w,
      y: (snap ? Math.round(point.y / grid) * grid : point.y) / h,
    };
  };
  const editMask = (next: typeof maskPath) => {
    p.onBeginMask();
    p.onMaskPath(next, true);
  };
  const maskSpots = maskPath.points.map((pt) => {
    const q = applyMatrix(poseMatrix({ width: w, height: h }, atPose), {
      x: pt.x * w,
      y: pt.y * h,
    });
    return { x: ox + q.x * scale, y: oy + q.y * scale };
  });
  const gesture = useRef<{
    kind: string;
    x: number;
    y: number;
    crop: CropFrame;
    offset: { x: number; y: number };
    zoom: number;
    next?: CropFrame;
  } | null>(null);
  const start = (e: React.PointerEvent, kind: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = {
      kind,
      x: e.clientX,
      y: e.clientY,
      crop: c,
      offset,
      zoom,
    };
    setMenu(null);
  };
  const move = (e: React.PointerEvent) => {
    if (shapeGesture.current) {
      const g = shapeGesture.current;
      g.next = shapeMask(
        g.next,
        g.start,
        maskPoint(e),
        maskTool === "ellipse" ? "ellipse" : "rectangle",
      );
      p.onMaskPath(g.next, false);
      return;
    }
    if (maskGesture.current !== null) {
      maskNext.current = moveMaskPoint(
        maskPath,
        maskGesture.current,
        maskPoint(e),
      );
      p.onMaskPath(maskNext.current, false);
      return;
    }
    const g = gesture.current;
    if (!g) return;
    let dx = (e.clientX - g.x) / scale,
      dy = (e.clientY - g.y) / scale;
    if (g.kind === "pan") {
      setOffset({
        x: g.offset.x + e.clientX - g.x,
        y: g.offset.y + e.clientY - g.y,
      });
      return;
    }
    if (g.kind === "zoom") {
      setZoom(
        Math.max(0.1, Math.min(8, g.zoom * Math.exp((e.clientX - g.x) / 150))),
      );
      return;
    }
    let next = { ...g.crop };
    if (g.kind === "rotate") {
      const rect = svg.current!.getBoundingClientRect(),
        px = rect.left + ox + g.crop.pivotX * w * scale,
        py = rect.top + oy + g.crop.pivotY * h * scale;
      let angle =
        g.crop.angle +
        ((Math.atan2(e.clientY - py, e.clientX - px) -
          Math.atan2(g.y - py, g.x - px)) *
          180) /
          Math.PI;
      if (e.shiftKey || snap) angle = Math.round(angle / 15) * 15;
      next = rotateCropFrame(g.crop, angle, w, h);
    } else if (g.kind === "pivot") {
      next.pivotX += dx / w;
      next.pivotY += dy / h;
    } else if (g.kind === "move") {
      next = moveCropFrame(g.crop, dx, dy, w, h, axis, snap ? grid : 0);
    } else
      next = resizeCropFrame(
        g.crop,
        g.kind,
        snap ? Math.round(dx / grid) * grid : dx,
        snap ? Math.round(dy / grid) * grid : dy,
        w,
        h,
        lock !== (e.ctrlKey || e.metaKey),
        center !== e.altKey,
      );
    g.next = next;
    setDraft(next);
  };
  const end = (e: React.PointerEvent) => {
    if (shapeGesture.current) {
      p.onMaskPath(shapeGesture.current.next, true);
      shapeGesture.current = null;
    }

    if (maskGesture.current !== null) {
      maskGesture.current = null;
      p.onMaskPath(maskNext.current ?? maskPath, true);
      maskNext.current = null;
    }
    const g = gesture.current;
    gesture.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    if (g?.next) write(g.next);
  };
  const dragWindow = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as Element).closest("button")) return;
    const x = e.clientX,
      y = e.clientY,
      base = bounds;
    const move = (ev: PointerEvent) =>
      setBounds({
        ...base,
        x: Math.max(
          0,
          Math.min(window.innerWidth - 80, base.x + ev.clientX - x),
        ),
        y: Math.max(
          0,
          Math.min(window.innerHeight - 30, base.y + ev.clientY - y),
        ),
      });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };
  const addKey = () => {
    const list =
      !p.keys.length && local >= tick
        ? upsertKey([], 0, { ...atPose, cropFrame: toStored(initial), time: 0 })
        : p.keys;
    p.onKeys(
      upsertKey(list, local, {
        ...atPose,
        cropFrame: toStored(c),
        time: local,
      }),
    );
  };
  const jump = (direction: number) => {
    const key =
      direction < 0
        ? [...keys].reverse().find((k) => k.time < local - 1)
        : keys.find((k) => k.time > local + 1);
    if (key) seek(key.time);
  };
  const remove = () => {
    if (!current) return;
    p.onKeys(removeKey(p.keys, local));
  };
  const keyDrag = useRef<{
    key: Keyframe;
    x: number;
    width: number;
    time: number;
  } | null>(null);
  const updatePreset = (value: string) => {
    setPreset(value);
    const saved = p.presets?.find((item) => item.name === value);
    if (saved) {
      if (p.keys.length)
        p.onKeys(upsertKey(p.keys, local, { ...saved.pose, time: local }));
      else p.onPose(saved.pose);
      if (saved.mask) p.onMask(saved.mask);
    } else if (value === "default") write(defaultCropFrame());
    else if (value === "169")
      write({ ...c, height: (c.width * w) / (16 / 9) / h });
    else if (value === "43")
      write({ ...c, height: (c.width * w) / (4 / 3) / h });
    setPreset(value);
  };

  return (
    <div
      className="ec-window"
      role="dialog"
      aria-label="Panoramización/Recorte de evento"
      style={{
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
      }}
      onKeyDown={(e) => {
        if (
          e.key === "Escape" &&
          !(e.target as Element).matches("input,select")
        ) {
          e.stopPropagation();
          p.onClose();
        }
      }}
    >
      <header
        className="ec-title"
        onPointerDown={dragWindow}
        onDoubleClick={() =>
          setBounds({
            x: 0,
            y: 0,
            width: window.innerWidth,
            height: window.innerHeight,
          })
        }
      >
        <span>Efectos de evento de vídeo</span>
        <Button label="Cerrar Panoramización/Recorte" onClick={p.onClose}>
          <X size={14} />
        </Button>
      </header>
      <div className="ec-plugin">
        <span className="ec-badge">▣</span>
        <span>Panoramización/Recorte de evento: {p.label}</span>
      </div>
      <div className="ec-chain">
        <span>○─</span>
        <span className="ec-tab">Panoramización/Recorte</span>
        <span>─○</span>
      </div>
      <div className="ec-presets">
        <label htmlFor="ec-preset">
          Parámetro
          <br />
          preestablecido:
        </label>
        <select
          id="ec-preset"
          value={preset}
          onChange={(e) => updatePreset(e.target.value)}
        >
          <option value="default">(Predeterminado)</option>
          <option value="custom">(Personalizado)</option>
          <option value="169">16:9</option>
          <option value="43">4:3</option>
          {p.presets?.map((item) => (
            <option key={item.name}>{item.name}</option>
          ))}
        </select>
        <Button
          label="Guardar parámetro preestablecido"
          onClick={() => {
            const name = window.prompt("Nombre del parámetro preestablecido");
            if (name?.trim()) {
              p.onPresets?.([
                ...(p.presets ?? []).filter((i) => i.name !== name.trim()),
                {
                  name: name.trim(),
                  pose: { ...atPose, cropFrame: toStored(c) },
                },
              ]);
              setPreset(name.trim());
            }
          }}
        >
          <Save size={17} />
        </Button>
        <Button
          label="Eliminar parámetro preestablecido"
          disabled={!p.presets?.some((i) => i.name === preset)}
          onClick={() => {
            p.onPresets?.((p.presets ?? []).filter((i) => i.name !== preset));
            setPreset("custom");
          }}
        >
          <X size={17} />
        </Button>
      </div>
      <main
        className={`ec-main ${showProperties ? "" : "ec-properties-hidden"}`}
      >
        <nav className="ec-tools" aria-label="Herramientas de Pan/Crop">
          <Button
            label="Mostrar propiedades"
            active={showProperties}
            onClick={() => setShowProperties((v) => !v)}
          >
            <Settings size={16} />
          </Button>
          <Button
            label="Herramienta de edición normal"
            active={tool === "select" && (!maskMode || maskTool === "select")}
            onClick={() => {
              setTool("select");
              setMaskTool("select");
            }}
          >
            <MousePointer2 size={16} />
          </Button>
          {maskMode && (
            <>
              <Button
                label="Crear puntos de máscara"
                active={tool === "select" && maskTool === "add"}
                onClick={() => {
                  setTool("select");
                  setMaskTool("add");
                }}
              >
                <MaskPen />
              </Button>
              <Button
                label="Eliminar puntos de máscara"
                active={tool === "select" && maskTool === "delete"}
                onClick={() => {
                  setTool("select");
                  setMaskTool("delete");
                }}
              >
                <MaskDelete />
              </Button>
              <Button
                label="Máscara rectangular: arrastrar para dibujar"
                active={tool === "select" && maskTool === "rectangle"}
                onClick={() => {
                  setTool("select");
                  setMaskTool("rectangle");
                }}
              >
                <MaskRectangle />
              </Button>
              <Button
                label="Máscara elíptica: arrastrar para dibujar"
                active={tool === "select" && maskTool === "ellipse"}
                onClick={() => {
                  setTool("select");
                  setMaskTool("ellipse");
                }}
              >
                <MaskEllipse />
              </Button>
            </>
          )}
          <Button
            label="Herramienta de zoom"
            active={tool === "zoom"}
            onClick={() => setTool("zoom")}
          >
            <ZoomIn size={16} />
          </Button>
          <Button
            label="Ajustar a cuadrícula"
            active={snap}
            onClick={() => setSnap(!snap)}
          >
            <Magnet size={16} />
          </Button>
          {!maskMode && (
            <>
              <Button
                label="Bloquear relación de aspecto"
                active={lock}
                onClick={() => setLock(!lock)}
              >
                <Aspect size={16} />
              </Button>
              <Button
                label="Cambiar tamaño respecto al centro"
                active={center}
                onClick={() => setCenter(!center)}
              >
                <Focus size={16} />
              </Button>
              <Button
                label={`Movimiento: ${axis === "xy" ? "libre" : axis === "x" ? "solo X" : "solo Y"}`}
                active={axis !== "xy"}
                onClick={() =>
                  setAxis(axis === "xy" ? "x" : axis === "x" ? "y" : "xy")
                }
              >
                <Move size={16} />
                {axis !== "xy" && <sup>{axis}</sup>}
              </Button>
            </>
          )}
          <Button
            label="Desplazar área de trabajo"
            active={tool === "pan"}
            onClick={() => setTool("pan")}
          >
            <Move size={14} />
          </Button>
        </nav>
        <aside className="ec-params" hidden={!showProperties}>
          {maskMode ? (
            <>
              <Group title="Máscara">
                <p className="ec-mask-note">
                  Seleccione un punto para editar su posición. Dibuje una ruta
                  con la pluma o arrastre una forma. Las formas reemplazan la
                  ruta actual.
                </p>
              </Group>
              <Group title="Posición" open>
                <fieldset
                  disabled={
                    selectedPoint === null || !maskPath.points[selectedPoint]
                  }
                  style={{ border: 0, padding: 0, margin: 0 }}
                >
                  <Field
                    label="X"
                    value={(maskPath.points[selectedPoint ?? -1]?.x ?? 0) * w}
                    min={0}
                    max={w}
                    change={(v) => {
                      if (selectedPoint !== null)
                        editMask(
                          moveMaskPoint(maskPath, selectedPoint, {
                            ...maskPath.points[selectedPoint],
                            x: v / w,
                          }),
                        );
                    }}
                  />
                  <Field
                    label="Y"
                    value={(maskPath.points[selectedPoint ?? -1]?.y ?? 0) * h}
                    min={0}
                    max={h}
                    change={(v) => {
                      if (selectedPoint !== null)
                        editMask(
                          moveMaskPoint(maskPath, selectedPoint, {
                            ...maskPath.points[selectedPoint],
                            y: v / h,
                          }),
                        );
                    }}
                  />
                </fieldset>
              </Group>
              <Group title="Ruta">
                <label className="ec-field">
                  <span>Modo:</span>
                  <select
                    aria-label="Modo de máscara"
                    value={maskPath.invert ? "negative" : "positive"}
                    onChange={(e) =>
                      editMask({
                        ...maskPath,
                        invert: e.target.value === "negative",
                      })
                    }
                  >
                    <option value="positive">Positivo</option>
                    <option value="negative">Negativo</option>
                  </select>
                </label>
                <Field
                  label="Pluma"
                  value={maskPath.feather}
                  min={0}
                  max={200}
                  change={(v) => editMask({ ...maskPath, feather: v })}
                />
                <button
                  disabled={
                    selectedPoint === null || !maskPath.points[selectedPoint]
                  }
                  onClick={() => {
                    if (selectedPoint !== null)
                      editMask(removeMaskPoint(maskPath, selectedPoint));
                    setSelectedPoint(null);
                  }}
                >
                  Eliminar punto seleccionado
                </button>
                <button
                  disabled={!maskPath.points.length}
                  onClick={() => {
                    editMask({ ...maskPath, points: [] });
                    setSelectedPoint(null);
                  }}
                >
                  Borrar ruta
                </button>
                <p className="ec-mask-note">
                  Ruta poligonal; elipse de 64 puntos. Curvas Bézier y animación
                  de máscara pendientes.
                </p>
              </Group>
            </>
          ) : (
            <>
              <Group title="Posición" open>
                <Field
                  label="Anchura"
                  value={c.width * w}
                  min={w * 0.001}
                  max={w * 100}
                  change={(v) =>
                    patch({
                      width: v / w,
                      ...(lock
                        ? { height: (c.height * (v / w)) / c.width }
                        : {}),
                    })
                  }
                />
                <Field
                  label="Altura"
                  value={c.height * h}
                  min={h * 0.001}
                  max={h * 100}
                  change={(v) =>
                    patch({
                      height: v / h,
                      ...(lock
                        ? { width: (c.width * (v / h)) / c.height }
                        : {}),
                    })
                  }
                />
                <Field
                  label="Centro X"
                  value={c.x * w}
                  change={(v) => patch({ x: v / w })}
                />
                <Field
                  label="Centro Y"
                  value={c.y * h}
                  change={(v) => patch({ y: v / h })}
                />
              </Group>
              <Group title="Recorte">
                <label className="ec-field">
                  <span>Modo:</span>
                  <select
                    aria-label="Modo de recorte"
                    value={c.fill ? "fill" : "crop"}
                    onChange={(e) => patch({ fill: e.target.value === "fill" })}
                  >
                    <option value="fill">Rellenar fotograma</option>
                    <option value="crop">Recortar sin ampliar</option>
                  </select>
                </label>
                {(
                  [
                    ["left", "Izquierda"],
                    ["right", "Derecha"],
                    ["top", "Arriba"],
                    ["bottom", "Abajo"],
                  ] as const
                ).map(([edge, label]) => (
                  <Field
                    key={edge}
                    label={`${label} (%)`}
                    value={cropMargins(c)[edge] * 100}
                    min={-9900}
                    max={99.9}
                    change={(v) => write(setCropMargin(c, edge, v / 100))}
                  />
                ))}
                <button
                  onClick={() =>
                    write(
                      matchCropAspect(
                        c,
                        source,
                        p.project.width / p.project.height,
                      ),
                    )
                  }
                >
                  Igualar aspecto de salida
                </button>
                <button onClick={() => write(defaultCropFrame())}>
                  Restaurar recorte
                </button>
                <p className="ec-mask-note">
                  Las asas recortan el encuadre. Ctrl/Comando alterna el bloqueo
                  de proporción; Alt/Opción alterna el tamaño desde el centro.
                  Los márgenes siguen los ejes de la caja antes de girarla.
                </p>
              </Group>
              <Group title="Rotación" open>
                <Field
                  label="Ángulo"
                  value={c.angle}
                  min={-36000}
                  max={36000}
                  change={(v) => write(rotateCropFrame(c, v, w, h))}
                />
                <Field
                  label="Centro de rotación X"
                  value={c.pivotX * w}
                  change={(v) => patch({ pivotX: v / w })}
                />
                <Field
                  label="Centro de rotación Y"
                  value={c.pivotY * h}
                  change={(v) => patch({ pivotY: v / h })}
                />
              </Group>
              <Group title="Interpolación de fotogramas clave">
                <Field
                  label="Suavidad (%)"
                  value={p.smoothness ?? 100}
                  min={0}
                  max={100}
                  change={(v) => p.onSmoothness?.(v)}
                />
                <label className="ec-field">
                  Tipo
                  <select
                    aria-label="Interpolación"
                    disabled={!current}
                    value={current?.curve ?? "linear"}
                    onChange={(e) =>
                      p.onKeys(
                        upsertKey(p.keys, local, {
                          ...atPose,
                          cropFrame: toStored(c),
                          curve: e.target.value as Keyframe["curve"],
                        }),
                      )
                    }
                  >
                    {EASE_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {EASE_LABEL[kind]}
                      </option>
                    ))}
                  </select>
                </label>
              </Group>
              <Group title="Origen">
                <label className="ec-field">
                  Mantener aspecto
                  <select
                    aria-label="Mantener relación de aspecto"
                    value={String(c.aspect)}
                    onChange={(e) =>
                      patch({ aspect: e.target.value === "true" })
                    }
                  >
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                </label>
                <label className="ec-field">
                  Extender al fotograma
                  <select
                    aria-label="Extender para rellenar fotograma"
                    value={String(c.fill)}
                    onChange={(e) => patch({ fill: e.target.value === "true" })}
                  >
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                </label>
              </Group>
            </>
          )}
          <Group title="Área de trabajo">
            <Field
              label="Zoom (%)"
              value={zoom * 100}
              min={10}
              max={800}
              change={(v) => setZoom(v / 100)}
            />
            <Field
              label="Desplazamiento X"
              value={offset.x}
              change={(v) => setOffset({ ...offset, x: v })}
            />
            <Field
              label="Desplazamiento Y"
              value={offset.y}
              change={(v) => setOffset({ ...offset, y: v })}
            />
            <Field
              label="Cuadrícula"
              value={grid}
              min={1}
              max={1000}
              change={setGrid}
            />
          </Group>
        </aside>
        <div
          className="ec-workspace"
          ref={workspace}
          onWheel={(e) => {
            e.stopPropagation();
            setZoom((v) =>
              Math.max(0.1, Math.min(8, v * Math.exp(-e.deltaY * 0.001))),
            );
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            if (tool === "zoom") {
              setZoom((v) => Math.max(0.1, v / 1.25));
              return;
            }
            setMenu({ x: e.clientX - bounds.x, y: e.clientY - bounds.y });
          }}
        >
          <canvas
            ref={canvas}
            style={{ left: ox, top: oy, width: w * scale, height: h * scale }}
          />
          <svg
            ref={svg}
            width="100%"
            height="100%"
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={() => {
              if (shapeGesture.current || maskGesture.current !== null)
                p.onMaskPath(
                  shapeGesture.current?.next ?? maskNext.current ?? maskPath,
                  true,
                );
              shapeGesture.current = null;
              maskGesture.current = null;
              maskNext.current = null;
              gesture.current = null;
              setDraft(null);
            }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              if (maskMode && tool === "select") {
                if (maskTool === "add") {
                  editMask(addMaskPoint(maskPath, maskPoint(e)));
                  setSelectedPoint(maskPath.points.length);
                } else if (maskTool === "rectangle" || maskTool === "ellipse") {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  p.onBeginMask();
                  shapeGesture.current = {
                    start: maskPoint(e),
                    next: maskPath,
                  };
                  setSelectedPoint(null);
                } else setSelectedPoint(null);
              } else start(e, tool === "zoom" ? "zoom" : "pan");
            }}
          >
            {snap && (
              <defs>
                <pattern
                  id="ec-grid"
                  width={grid * scale}
                  height={grid * scale}
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d={`M ${grid * scale} 0 L 0 0 0 ${grid * scale}`}
                    fill="none"
                    stroke="#777"
                    strokeWidth=".3"
                  />
                </pattern>
              </defs>
            )}
            {snap && (
              <rect
                width="100%"
                height="100%"
                fill="url(#ec-grid)"
                pointerEvents="none"
              />
            )}
            {!maskMode && (
              <>
                <circle
                  cx={ox + c.pivotX * w * scale}
                  cy={oy + c.pivotY * h * scale}
                  r={Math.hypot(cw, ch) / 2}
                  className="ec-ring"
                  onPointerDown={(e) => start(e, "rotate")}
                />
                <g
                  transform={`translate(${pos.x} ${pos.y}) rotate(${c.angle})`}
                >
                  <rect
                    x={-cw / 2}
                    y={-ch / 2}
                    width={cw}
                    height={ch}
                    className="ec-frame"
                    onPointerDown={(e) =>
                      start(
                        e,
                        tool === "zoom"
                          ? "zoom"
                          : tool === "pan"
                            ? "pan"
                            : "move",
                      )
                    }
                  />
                  <path
                    d={`M ${-cw * 0.15} ${ch * 0.4} V ${-ch * 0.4} H ${cw * 0.15} V ${-ch * 0.3} H ${-cw * 0.09} V ${-ch * 0.06} H ${cw * 0.12} V ${ch * 0.04} H ${-cw * 0.09} V ${ch * 0.4} Z`}
                    className="ec-orientation"
                    transform={`scale(${c.flipX ? -1 : 1} ${c.flipY ? -1 : 1})`}
                    pointerEvents="none"
                  />
                  {handles.map((id) => {
                    const x = id.includes("w")
                        ? -cw / 2
                        : id.includes("e")
                          ? cw / 2
                          : 0,
                      y = id.includes("n")
                        ? -ch / 2
                        : id.includes("s")
                          ? ch / 2
                          : 0;
                    return (
                      <rect
                        key={id}
                        data-handle={id}
                        x={x - 3}
                        y={y - 3}
                        width={6}
                        height={6}
                        className="ec-handle"
                        style={{ cursor: `${id}-resize` }}
                        onPointerDown={(e) => start(e, id)}
                      />
                    );
                  })}
                </g>
                <circle
                  cx={ox + c.pivotX * w * scale}
                  cy={oy + c.pivotY * h * scale}
                  r="4"
                  className="ec-pivot"
                  onPointerDown={(e) => start(e, "pivot")}
                />
              </>
            )}
            {maskMode && (
              <g>
                <polygon
                  points={maskSpots.map((pt) => `${pt.x},${pt.y}`).join(" ")}
                  fill="none"
                  stroke="#222"
                  strokeDasharray="3 2"
                  pointerEvents="none"
                />
                {maskSpots.map((pt, i) => (
                  <rect
                    key={i}
                    x={pt.x - 4}
                    y={pt.y - 4}
                    width="8"
                    height="8"
                    fill={selectedPoint === i ? "#61b9ed" : "#fff"}
                    stroke="#222"
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      if (
                        tool !== "select" ||
                        maskTool === "rectangle" ||
                        maskTool === "ellipse"
                      )
                        return;
                      e.stopPropagation();
                      if (maskTool === "delete") {
                        editMask(removeMaskPoint(maskPath, i));
                        setSelectedPoint(null);
                        return;
                      }
                      setSelectedPoint(i);
                      e.currentTarget.setPointerCapture(e.pointerId);
                      p.onBeginMask();
                      maskGesture.current = i;
                      maskNext.current = maskPath;
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      editMask(removeMaskPoint(maskPath, i));
                      setSelectedPoint(null);
                    }}
                  />
                ))}
              </g>
            )}
          </svg>
          {error && (
            <div className="ec-error" role="alert">
              {error}
            </div>
          )}
        </div>
      </main>
      <section className="ec-keyeditor" aria-label="Fotogramas clave">
        <div className="ec-keylabels">
          <div
            className={!maskMode ? "selected" : ""}
            onClick={() => {
              setMaskMode(false);
              setTool("select");
            }}
          >
            Posición
          </div>
          <label
            className={maskMode ? "selected" : ""}
            title="Editar máscara poligonal"
          >
            <input
              type="checkbox"
              checked={maskMode}
              onChange={(e) => {
                setMaskMode(e.target.checked);
                setTool("select");
                setSelectedPoint(null);
              }}
            />
            Máscara
          </label>
        </div>
        <div className="ec-keyscroll">
          <div
            className="ec-keytrack"
            style={{ width: `${keyZoom * 100}%` }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              e.currentTarget.setPointerCapture(e.pointerId);
              seek(((e.clientX - rect.left) / rect.width) * p.duration);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 1 && !keyDrag.current) {
                const rect = e.currentTarget.getBoundingClientRect();
                seek(((e.clientX - rect.left) / rect.width) * p.duration);
              }
            }}
          >
            <div className="ec-ruler">
              {Array.from({ length: 11 }, (_, i) => (
                <span key={i} style={{ left: `${i * 10}%` }}>
                  {timecode((p.duration * i) / 10).slice(0, 8)}
                </span>
              ))}
            </div>
            <div className="ec-keylane" />
            <div className="ec-masklane" />
            {(keys.length ? keys : [{ ...atPose, time: 0 }]).map((key) => (
              <button
                key={key.time}
                className={`ec-diamond ${Math.abs(key.time - local) < 1 ? "selected" : ""}`}
                title={`Clave ${timecode(key.time)}`}
                aria-label={`Clave ${timecode(key.time)}`}
                style={{ left: `${(key.time / p.duration) * 100}%` }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  keyDrag.current = null;
                  setMenu(null);
                  keyMenuAnchor.current = e.currentTarget;
                  seek(key.time);
                  setKeyMenu({
                    time: key.time,
                    x: Math.max(
                      4,
                      Math.min(
                        e.clientX ||
                          e.currentTarget.getBoundingClientRect().left,
                        window.innerWidth - 218,
                      ),
                    ),
                    y: Math.max(
                      4,
                      Math.min(
                        e.clientY ||
                          e.currentTarget.getBoundingClientRect().top,
                        window.innerHeight - 216,
                      ),
                    ),
                  });
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (e.button !== 0) return;
                  setKeyMenu(null);
                  e.currentTarget.setPointerCapture(e.pointerId);
                  keyDrag.current = {
                    key,
                    x: e.clientX,
                    width:
                      e.currentTarget.parentElement!.getBoundingClientRect()
                        .width,
                    time: key.time,
                  };
                  seek(key.time);
                }}
                onPointerMove={(e) => {
                  const g = keyDrag.current;
                  if (g) {
                    g.time = Math.min(
                      p.duration,
                      quantize(
                        Math.max(
                          0,
                          g.key.time +
                            ((e.clientX - g.x) / g.width) * p.duration,
                        ),
                        p.project.fps,
                      ),
                    );
                    seek(g.time);
                  }
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  const g = keyDrag.current;
                  keyDrag.current = null;
                  if (g && g.time !== g.key.time)
                    p.onKeys(
                      upsertKey(removeKey(p.keys, g.key.time), g.time, {
                        ...g.key,
                        time: g.time,
                      }),
                    );
                }}
              >
                <Diamond size={10} />
              </button>
            ))}
            <i
              className="ec-keycursor"
              style={{ left: `${(local / p.duration) * 100}%` }}
            />
          </div>
        </div>
        <footer className="ec-keytools">
          <Button
            label="Sincronizar cursor con línea de tiempo"
            active={sync}
            onClick={() => {
              setLocalCursor(local);
              setSync(!sync);
            }}
          >
            <SyncCursor size={16} />
          </Button>
          <Button
            label="Primer fotograma clave"
            onClick={() => seek(keys[0]?.time ?? 0)}
          >
            <SkipBack size={15} />
          </Button>
          <Button
            label="Fotograma clave anterior"
            disabled={!keys.some((k) => k.time < local - 1)}
            onClick={() => jump(-1)}
          >
            <ArrowLeft size={15} />
          </Button>
          <Button
            label="Siguiente fotograma clave"
            disabled={!keys.some((k) => k.time > local + 1)}
            onClick={() => jump(1)}
          >
            <ArrowRight size={15} />
          </Button>
          <Button
            label="Último fotograma clave"
            onClick={() => seek(keys.at(-1)?.time ?? 0)}
          >
            <SkipForward size={15} />
          </Button>
          <Button label="Añadir fotograma clave" onClick={addKey}>
            <AddKey size={16} />
          </Button>
          <Button
            label="Eliminar fotograma clave"
            disabled={!current}
            onClick={remove}
          >
            <DeleteKey size={16} />
          </Button>
          <span className="ec-spacer" />
          <Button
            label="Alejar línea de claves"
            disabled={keyZoom <= 1}
            onClick={() => setKeyZoom((v) => Math.max(1, v / 2))}
          >
            <Minus size={12} />
          </Button>
          <Button
            label="Acercar línea de claves"
            disabled={keyZoom >= 16}
            onClick={() => setKeyZoom((v) => Math.min(16, v * 2))}
          >
            <Plus size={12} />
          </Button>
          <output>{timecode(local)}</output>
        </footer>
      </section>
      {keyMenu && (
        <div
          ref={keyMenuRef}
          className="ec-context ec-key-context"
          role="menu"
          aria-label="Opciones del fotograma clave"
          style={{ position: "fixed", left: keyMenu.x, top: keyMenu.y }}
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") {
              e.preventDefault();
              closeKeyMenu();
              return;
            }
            if (e.key === "Tab") {
              setKeyMenu(null);
              return;
            }
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
              e.preventDefault();
              const buttons = Array.from(
                e.currentTarget.querySelectorAll<HTMLButtonElement>(
                  "button:not(:disabled)",
                ),
              );
              const index = buttons.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              buttons[
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? buttons.length - 1
                    : (index +
                        (e.key === "ArrowDown" ? 1 : -1) +
                        buttons.length) %
                      buttons.length
              ]?.focus();
            }
          }}
        >
          <button
            role="menuitem"
            disabled={!keyAt(p.keys, keyMenu.time)}
            onClick={() => {
              p.onKeys(removeKey(p.keys, keyMenu.time));
              closeKeyMenu();
            }}
          >
            <DeleteKey size={14} />
            <span>Eliminar fotograma clave</span>
          </button>
          <div role="separator" />
          {EASE_KINDS.map((kind) => (
            <button
              key={kind}
              role="menuitemradio"
              aria-checked={
                (keyAt(p.keys, keyMenu.time)?.curve ?? "linear") === kind
              }
              onClick={() => {
                const list = keyAt(p.keys, keyMenu.time)
                  ? p.keys
                  : upsertKey(p.keys, keyMenu.time, {
                      ...(activeEvent
                        ? eventPose(activeEvent, p.eventStart + keyMenu.time)
                        : atPose),
                      time: keyMenu.time,
                    });
                p.onKeys(setKeyInterpolation(list, keyMenu.time, kind));
                closeKeyMenu();
              }}
            >
              <span className="ec-menu-check">
                {(keyAt(p.keys, keyMenu.time)?.curve ?? "linear") === kind
                  ? "✓"
                  : ""}
              </span>
              <span>{EASE_LABEL[kind]}</span>
            </button>
          ))}
        </div>
      )}
      {menu && (
        <div
          className="ec-context"
          style={{
            left: Math.min(menu.x, bounds.width - 220),
            top: Math.min(menu.y, bounds.height - 205),
          }}
          onPointerLeave={() => setMenu(null)}
        >
          {[
            ["Restaurar", () => write(defaultCropFrame())],
            ["Centrar", () => patch({ x: 0.5, y: 0.5 })],
            ["Voltear horizontalmente", () => patch({ flipX: !c.flipX })],
            ["Voltear verticalmente", () => patch({ flipY: !c.flipY })],
            [
              "Igualar aspecto de salida",
              () =>
                write(
                  matchCropAspect(
                    c,
                    source,
                    p.project.width / p.project.height,
                  ),
                ),
            ],
            [
              "Igualar aspecto de origen",
              () =>
                write(matchCropAspect(c, source, source.width / source.height)),
            ],
            [
              "Restablecer vista",
              () => {
                setZoom(1);
                setOffset({ x: 0, y: 0 });
              },
            ],
          ].map(([name, action]) => (
            <button
              key={String(name)}
              onClick={() => {
                (action as () => void)();
                setMenu(null);
              }}
            >
              {String(name)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
