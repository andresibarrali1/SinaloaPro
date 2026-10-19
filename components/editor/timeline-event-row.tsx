// Una fila de la línea de tiempo: el bloque de un evento con su título, sus botones, el cuerpo (miniatura, texto
// u onda), el control de opacidad, las asas de recorte y los fundidos.
//
// Es `memo` a propósito: el editor se repinta entero en cada gesto (mover la aguja, seleccionar, marcar el tramo,
// abrir un diálogo) y esos repintados **no cambian el evento**. Sin esta barrera, cada clic del usuario volvía a
// construir decenas de elementos por evento, y el coste crecía con el tamaño del montaje hasta congelar la
// interfaz. Las acciones llegan en un objeto estable (ver `TimelineActions`) cuyas propiedades se leen **al
// llamarlas**, así que el gesto siempre usa la versión actual del editor aunque la fila no se haya repintado.
import { memo, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Crop, Link } from "lucide-react";
import { AudioWaveform } from "./audio-waveform";
import { EventOpacity } from "./event-opacity";
import { TRANSITION_LABEL } from "@/lib/editor/transitions";
import { seconds, type Event, type Media } from "@/lib/editor/project";

export type TimelineDragMode = "move" | "left" | "right" | "fadeIn" | "fadeOut";

// Las acciones del editor que usa una fila. El objeto se conserva entre repintados (está en una `ref`) y se
// actualiza después de cada repintado del editor, por eso las filas pueden leerlo sin volver a renderizarse.
export type TimelineActions = {
  drag: (ev: ReactPointerEvent, event: Event, mode: TimelineDragMode) => void;
  select: (ids: string[]) => void;
  open: (dialog: "event" | "titles" | "pancrop") => void;
  beginOpacity: (id: string) => void;
  previewOpacity: (value: number) => void;
  endOpacity: (cancel: boolean) => void;
  commitOpacity: (id: string, value: number) => void;
};

export type TimelineEventRowProps = {
  event: Event;
  media?: Media;
  // Muestras decodificadas del material, si están: la onda las usa cuando el tramo es corto.
  pcm?: { channels: Float32Array[]; sampleRate: number };
  zoom: number;
  trackKind: "video" | "audio";
  selected: boolean;
  groupMember: boolean;
  locked: boolean;
  rendering: boolean;
  // «nombre, 00:00:00:00»: se calcula en el editor para que la fila no dependa del formato del proyecto.
  label: string;
  actions: TimelineActions;
};

// El icono del complemento de texto (el mismo dibujo que usa la barra del evento).
function TextEditorIcon({ size = 11 }: { size?: number }): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true" focusable="false">
      <rect x="1.1" y="1.6" width="10.2" height="7.6" rx="1" />
      <rect x="7.1" y="6.6" width="7.8" height="7.8" rx="1" fill="#1e2429" />
      <path d="M8.7 9.1h4.6M8.7 10.7h4.6M8.7 12.3h2.8" strokeLinecap="round" />
    </svg>
  );
}

export const TimelineEventRow = memo(function TimelineEventRow({
  event,
  media,
  pcm,
  zoom,
  trackKind,
  selected,
  groupMember,
  locked,
  rendering,
  label,
  actions,
}: TimelineEventRowProps) {
  const width = Math.max(4, seconds(event.duration) * zoom);
  return (
    <div
      // El navegador arrastra imágenes y SVG por su cuenta, y eso cancela el gesto del editor: aquí se apaga.
      draggable={false}
      onDragStart={(ev) => ev.preventDefault()}
      role="button"
      tabIndex={0}
      aria-label={label}
      data-event-id={event.id}
      className={`timeline-event ${trackKind} ${selected ? "selected" : ""} ${groupMember ? "group-member" : ""}`}
      style={{ left: seconds(event.start) * zoom, width }}
      onPointerDown={(ev) => actions.drag(ev, event, "move")}
      onDoubleClick={() => {
        actions.select([event.id]);
        actions.open("event");
      }}
    >
      <div className="event-title">
        <span>{event.name}</span>
        {event.kind === "text" && (
          <button
            className="event-button"
            title="Abrir el editor de texto"
            aria-label={`Abrir el editor de texto de ${event.name}`}
            onPointerDown={(ev) => ev.stopPropagation()}
            onClick={() => {
              actions.select([event.id]);
              actions.open("titles");
            }}
          >
            <TextEditorIcon />
          </button>
        )}
        {event.kind !== "audio" && (
          <button
            className="event-button"
            title="Panoramización y recorte"
            aria-label={`Panoramización y recorte de ${event.name}`}
            onPointerDown={(ev) => ev.stopPropagation()}
            onClick={() => {
              actions.select([event.id]);
              actions.open("pancrop");
            }}
          >
            <Crop size={11} />
          </button>
        )}
        <button
          className="event-button"
          title="Propiedades y efectos"
          onPointerDown={(ev) => ev.stopPropagation()}
          onClick={() => {
            actions.select([event.id]);
            actions.open("event");
          }}
        >
          {event.group && <Link size={11} />}
          <span>ƒx</span>
        </button>
      </div>
      <div className="event-body">
        {event.kind === "audio" && media ? (
          <AudioWaveform event={event} media={media} width={width} channels={pcm?.channels} sampleRate={pcm?.sampleRate} />
        ) : media?.thumbnail ? (
          <div className="event-thumbnails" style={{ backgroundImage: `url(${media.thumbnail})` }} />
        ) : event.kind === "text" ? (
          <span className="event-text">{event.text}</span>
        ) : (
          <span className="event-color" style={{ backgroundColor: event.color }} />
        )}
      </div>
      {event.kind !== "audio" && (
        <EventOpacity
          name={event.name}
          value={event.videoOpacity ?? 1}
          disabled={rendering || locked}
          onBegin={() => actions.beginOpacity(event.id)}
          onPreview={(value) => actions.previewOpacity(value)}
          onEnd={(cancel) => actions.endOpacity(cancel)}
          onSet={(value) => actions.commitOpacity(event.id, value)}
        />
      )}
      <div className="trim-handle left" onPointerDown={(ev) => actions.drag(ev, event, "left")} title="Recortar inicio" />
      <div className="trim-handle right" onPointerDown={(ev) => actions.drag(ev, event, "right")} title="Recortar final" />
      <div
        className="fade-shade in"
        title={event.transition ? `Transición de entrada: ${TRANSITION_LABEL[event.transition]}` : undefined}
        style={{ width: seconds(event.fadeIn) * zoom }}
      />
      <div
        className="fade-shade out"
        title={event.transitionOut ? `Transición de salida: ${TRANSITION_LABEL[event.transitionOut]}` : undefined}
        style={{ width: seconds(event.fadeOut) * zoom }}
      />
      <div
        className="fade-handle in"
        style={{ left: Math.max(4, seconds(event.fadeIn) * zoom) }}
        title="Fundido de entrada"
        onPointerDown={(ev) => actions.drag(ev, event, "fadeIn")}
      />
      <div
        className="fade-handle out"
        style={{ right: Math.max(4, seconds(event.fadeOut) * zoom) }}
        title="Fundido de salida"
        onPointerDown={(ev) => actions.drag(ev, event, "fadeOut")}
      />
    </div>
  );
});
