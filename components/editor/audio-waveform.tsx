"use client";
// La forma de onda de un material de audio: la usan los eventos de audio de la línea de tiempo y el trimmer.
//
// Se dibuja como una **silueta rellena y simétrica** alrededor de la **línea del cero**, con el contorno
// repasado y el trazo en 1 px **real** (`vector-effect: non-scaling-stroke`), porque el lienzo se estira a lo
// ancho del hueco con `preserveAspectRatio="none"` y un trazo normal engordaría con el zoom.
//
// El número de columnas sale del ancho que ocupa la onda en pantalla (una por píxel, con topes: `columnsFor`), y
// los picos se leen de las muestras decodificadas cuando están —detalle real a cualquier zoom— o de los picos
// guardados en el medio cuando el proyecto se abre sin el archivo. Lo cuenta `data-waveform-source` y
// `data-waveform-columns`, que es lo que comprueban las pruebas.
import { indexedPeakColumns } from "@/lib/editor/waveform-index";
import { memo, useMemo } from "react";
import {
  columnsFor,
  sourceRange,
  waveformFor,
  waveformPath,
} from "@/lib/editor/waveform";
import type { Event, Media } from "@/lib/editor/project";

const TICKS_PER_SECOND = 705600000;
const seconds = (value: number) => value / TICKS_PER_SECOND;

export type AudioWaveformProps = {
  media: Media;
  width: number; // ancho en pantalla, en píxeles: de ahí salen las columnas
  channels?: Float32Array[];
  samples?: Float32Array; // muestras decodificadas del material, si están
  sampleRate?: number;
  // El tramo que se dibuja: lo decide el evento (con su recorte, su velocidad y su inversión) o, si no hay
  // evento, los segundos que se pasen (el trimmer enseña el material entero).
  event?: Event;
  from?: number;
  to?: number;
  reversed?: boolean;
  columns?: number; // para huecos cuyo ancho real no se mide (el trimmer)
  label?: string; // el rótulo accesible: «Forma de onda real» por defecto
};

// `memo`: la onda solo depende de sus datos (tramo, ancho y muestras), así que un repintado del editor por otro
// motivo —una selección, el estado, un aviso— no vuelve a construir el trazado de cada evento.
export const AudioWaveform = memo(function AudioWaveform({
  media,
  width,
  channels,
  samples,
  sampleRate,
  event,
  from,
  to,
  reversed,
  columns,
  label = "Forma de onda real",
}: AudioWaveformProps) {
  const count = columns ?? columnsFor(width);
  const range = event
    ? sourceRange(seconds(event.offset), seconds(event.duration), event.speed)
    : { from: from ?? 0, to: to ?? seconds(media.duration) };
  const reversedWave = event ? Boolean(event.reversed) : Boolean(reversed);
  // Leer las muestras cuesta un barrido por columna, así que se guarda mientras no cambien ni el tramo ni el
  // ancho: arrastrar un evento por la línea de tiempo repinta muchas veces y la onda no cambia.
  const waveforms = useMemo(() => {
    const countChannels = channels?.length ?? media.channelPeaks?.length ?? 1;
    return Array.from({ length: Math.min(2, countChannels) }, (_, channel) => {
      const pcm = channels?.[channel] ?? (channel === 0 ? samples : undefined);
      if (pcm && sampleRate) {
        const values = indexedPeakColumns(
          pcm,
          sampleRate,
          range.from,
          range.to,
          count,
        );
        return {
          values: reversedWave ? values.reverse() : values,
          source: "pcm" as const,
        };
      }
      return waveformFor({
        peaks:
          media.channelPeaks?.[channel] ??
          (channel === 0 ? media.peaks : undefined),
        duration: seconds(media.duration),
        from: range.from,
        to: range.to,
        columns: count,
        reversed: reversedWave,
      });
    }).filter((wave): wave is NonNullable<typeof wave> => Boolean(wave));
  }, [
    channels,
    samples,
    sampleRate,
    media.channelPeaks,
    media.peaks,
    media.duration,
    range.from,
    range.to,
    count,
    reversedWave,
  ]);
  if (!waveforms.length)
    return <span className="waveform-unavailable">Sin datos de onda</span>;
  return (
    <svg
      className="audio-wave"
      viewBox={`0 0 ${waveforms[0].values.length} ${100 * waveforms.length}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${label} · ${waveforms.length === 2 ? "estéreo" : "mono"}`}
      data-waveform-columns={waveforms[0].values.length}
      data-waveform-source={waveforms[0].source}
      data-waveform-channels={waveforms.length}
    >
      {waveforms.map((wave, index) => (
        <g
          key={index}
          transform={`translate(0 ${index * 100})`}
          data-audio-channel={index}
        >
          <line
            className="audio-wave-center"
            x1="0"
            y1="50"
            x2={wave.values.length}
            y2="50"
            vectorEffect="non-scaling-stroke"
          />
          <path
            className="audio-wave-body"
            d={waveformPath(wave.values)}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
      {waveforms.length === 2 && (
        <line
          className="audio-wave-divider"
          x1="0"
          y1="100"
          x2={waveforms[0].values.length}
          y2="100"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
});
