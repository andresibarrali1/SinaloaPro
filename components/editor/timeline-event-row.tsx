// Una fila de la línea de tiempo: el bloque de un evento con su título, sus botones, el cuerpo (miniatura, texto
// u onda), el control de opacidad, las asas de recorte y los fundidos.
//
// Es `memo` a propósito: el editor se repinta entero en cada gesto (mover la aguja, seleccionar, marcar el tramo,
// abrir un diálogo) y esos repintados **no cambian el evento**. Sin esta barrera, cada clic del usuario volvía a
// construir decenas de elementos por evento, y el coste crecía con el tamaño del montaje hasta congelar la
// interfaz. Las acciones llegan en un objeto estable (ver `TimelineActions`) cuyas propiedades se leen **al
// llamarlas**, así que el gesto siempre usa la versión actual del editor aunque la fila no se haya repintado.
import type { WaveformSourceReader } from "@/lib/editor/waveform-source";
import { memo, type PointerEvent as ReactPointerEvent } from "react";
import { Crop, Link, Type } from "lucide-react";
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
  open: (dialog: "event" | "titles" | "pancrop" | "effects") => void;
  beginOpacity: (id: string) => void;
  previewOpacity: (value: number) => void;
  endOpacity: (cancel: boolean) => void;
  commitOpacity: (id: string, value: number) => void;
};

export type TimelineEventRowProps = {
  event: Event;
  media?: Media;
  crossfadeIn?: number;
  waveSource?: WaveformSourceReader;
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

// El icono del editor de texto: una «T» clara, mejor que el dibujo de dos ventanas, que parecía «copiar».

export const TimelineEventRow = memo(function TimelineEventRow({
  event,
  media,
  crossfadeIn=0,
  waveSource,
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
  // El botón ƒx y el doble clic abren la ventana de efectos; en un texto (o subtítulo) siempre, aunque la pila
  // esté vacía, porque ahí se añaden los acabados. Para un vídeo sin efectos, ƒx sigue abriendo sus propiedades.
  const fxDialog = event.kind === "text" || event.effects?.length ? "effects" : "event";
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
        actions.open(fxDialog);
      }}
    >
      <div className="event-title">
        <span>{event.name}{(event.kind==="video"||event.kind==="audio")&&Math.abs(event.speed-1)>.001?` · ${event.speed.toFixed(2)}×`:""}</span>
        {event.kind === "text" && (
          <button
            className="event-button text-editor"
            title="Abrir el editor de texto"
            aria-label={`Abrir el editor de texto de ${event.name}`}
            onPointerDown={(ev) => ev.stopPropagation()}
            onClick={() => {
              actions.select([event.id]);
              actions.open("titles");
            }}
          >
            <Type size={12} />
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
          title={fxDialog === "effects" ? "Editar los efectos del recurso" : "Propiedades del recurso"}
          aria-label={fxDialog === "effects" ? `Editar efectos de ${event.name}` : `Propiedades de ${event.name}`}
          onPointerDown={(ev) => ev.stopPropagation()}
          onClick={() => {
            actions.select([event.id]);
            actions.open(fxDialog);
          }}
        >
          {event.group && <Link size={11} />}
          <span>ƒx</span>
        </button>
      </div>
      {/* La onda de la línea de tiempo se dibuja con los picos guardados en el medio (`media.peaks`, 1024 por
          canal). Pasarle además las muestras decodificadas de cada evento obligaba a barrer PCM en cada repintado y
          era lo que trababa el editor; las muestras se usan solo en el trimmer, donde hay una sola onda. */}
      <div className="event-body">
        {event.kind === "audio" && media ? (
          <AudioWaveform event={event} media={media} width={width} source={waveSource} />
        ) : media?.thumbnail ? (
          <div className="event-thumbnails" style={{ backgroundImage: `url(${media.thumbnail})` }} />
        ) : event.kind === "text" ? (
          <span className="event-text">{event.text}</span>
        ) : (
          <span className="event-color" style={{ backgroundColor: event.color }} />
        )}
      </div>
      {(event.kind==='video'||event.kind==='audio')&&Math.abs(event.speed-1)>.001&&<div className={`event-speed-overlay ${event.speed>1?'fast':'slow'}`} title={`Velocidad: ${event.speed.toFixed(2)}× · ${event.speed>1?'Rápido':'Lento'}`} aria-label={`Velocidad ${event.speed.toFixed(2)}×, ${event.speed>1?'rápido':'lento'}`}>
        <svg aria-hidden="true" width="100%" height="18"><defs><pattern id={`speed-${event.id}`} width={Math.max(5,Math.min(40,18/event.speed))} height="18" patternUnits="userSpaceOnUse"><path d={`M0 15L${Math.max(5,Math.min(40,18/event.speed))/2} 3L${Math.max(5,Math.min(40,18/event.speed))} 15`} fill="none" stroke="currentColor" strokeWidth="1.4"/></pattern></defs><rect width="100%" height="18" fill={`url(#speed-${event.id})`}/></svg>
        <span>{event.speed.toFixed(2)}× · {event.speed>1?'Rápido':'Lento'}</span>
      </div>}
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
      {crossfadeIn>0&&<div className="overlap-crossfade" style={{width:seconds(crossfadeIn)*zoom}} title={`Fundido cruzado: ${seconds(crossfadeIn).toFixed(2)} s`}>
        <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100"><path d="M0 0L100 100M0 100L100 0" fill="none" stroke="#f3df87" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/></svg>
        <span>{seconds(crossfadeIn).toFixed(2)} s</span>
      </div>}
      <div className="trim-handle left" onPointerDown={(ev) => actions.drag(ev, event, "left")} title="Recortar inicio · Ctrl/Comando + arrastrar: cambiar velocidad" />
      <div className="trim-handle right" onPointerDown={(ev) => actions.drag(ev, event, "right")} title="Arrastra para alargar o recortar; al superar el original, se repite · Ctrl/Comando: cambiar velocidad" />
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
