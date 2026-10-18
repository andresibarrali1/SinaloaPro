import { useEffect, useRef, useState } from "react";
import { clampOpacity, opacityFromDrag } from "@/lib/editor/event-opacity";
type Props = {
  value: number;
  name: string;
  disabled: boolean;
  onBegin: () => void;
  onPreview: (value: number) => void;
  onEnd: (cancel: boolean) => void;
  onSet: (value: number) => void;
};
export function EventOpacity({
  value,
  name,
  disabled,
  onBegin,
  onPreview,
  onEnd,
  onSet,
}: Props) {
  const host = useRef<HTMLDivElement>(null),
    drag = useRef<{ y: number; value: number; height: number } | null>(null);
  const [active, setActive] = useState(false);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  useEffect(
    () => () => {
      if (drag.current) endRef.current(true);
    },
    [],
  );
  const percent = Math.round(value * 100);
  return (
    <div ref={host} className={`event-opacity ${active ? "adjusting" : ""}`}>
      <div
        className="event-opacity-line"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={`Opacidad de ${name}`}
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent} %`}
        aria-disabled={disabled}
        title={
          disabled
            ? "Evento bloqueado"
            : `Opacidad: ${percent} % · arrastra hacia abajo · doble clic: 100 %`
        }
        style={{ top: `${(1 - value) * 100}%` }}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (e.button !== 0 || disabled) return;
          e.preventDefault();
          e.currentTarget.focus();
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = {
            y: e.clientY,
            value,
            height: host.current?.clientHeight ?? 1,
          };
          setActive(true);
          onBegin();
        }}
        onPointerMove={(e) => {
          if (drag.current) {
            e.stopPropagation();
            const g = drag.current;
            onPreview(opacityFromDrag(g.value, e.clientY - g.y, g.height));
          }
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          if (!drag.current) return;
          drag.current = null;
          setActive(false);
          onEnd(false);
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          if (drag.current) {
            drag.current = null;
            setActive(false);
            onEnd(true);
          }
        }}
        onLostPointerCapture={() => {
          if (drag.current) {
            drag.current = null;
            setActive(false);
            onEnd(true);
          }
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) onSet(1);
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (
            (e.ctrlKey || e.metaKey) &&
            ["z", "y"].includes(e.key.toLowerCase())
          )
            return;
          e.stopPropagation();
          if (disabled) return;
          if (e.key === "Escape" && drag.current) {
            e.preventDefault();
            drag.current = null;
            setActive(false);
            onEnd(true);
            return;
          }
          const next =
            e.key === "Home"
              ? 1
              : e.key === "End"
                ? 0
                : e.key === "ArrowUp" || e.key === "ArrowRight"
                  ? value + (e.shiftKey ? 0.1 : 0.01)
                  : e.key === "ArrowDown" || e.key === "ArrowLeft"
                    ? value - (e.shiftKey ? 0.1 : 0.01)
                    : null;
          if (next !== null) {
            e.preventDefault();
            onSet(clampOpacity(next));
          }
        }}
      >
        <span
          className="event-opacity-value"
          style={{ top: value < 0.15 ? -18 : 5 }}
        >
          {percent} %
        </span>
      </div>
    </div>
  );
}
