import { waveformSource } from '@/lib/editor/waveform-source';
'use client';
// Trimmer (edición de tres puntos): se marca la entrada y la salida en el material de origen y se coloca en el
// cursor de la línea de tiempo, insertando (lo de después se corre) o sobrescribiendo (se deja el hueco limpio).
// El monitor muestra el fotograma del origen en la posición de exploración; para el audio, su forma de onda.
import { useEffect, useRef, useState } from 'react';
import type { Media } from '@/lib/editor/project';
import type { MediaLibrary } from '@/lib/editor/media';
import { seconds, ticks } from '@/lib/editor/project';
import { Field } from './controls';
import { AudioWaveform } from './audio-waveform';

// La onda del trimmer ocupa el ancho del panel del diálogo, que es fijo: se dibuja con esa resolución en vez de
// medir el hueco (el SVG se estira al ancho real igual que la del evento, con `preserveAspectRatio="none"`).
const TRIM_WAVE_COLUMNS = 640;

export type TrimmerProps = {
  library: MediaLibrary;
  media: Media;
  at: number;
  onEdit: (edit: { inPoint: number; outPoint: number; mode: 'insert' | 'overwrite' }) => void;
  onClose: () => void;
};

export function Trimmer({ library, media, at, onEdit, onClose }: TrimmerProps) {
  const duration = media.duration || ticks(5);
  const [inPoint, setInPoint] = useState(0);
  const [outPoint, setOutPoint] = useState(duration);
  const [scrub, setScrub] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const isAudio = media.kind === 'audio';
  const clampTime = (value: number) => Math.max(0, Math.min(duration, value));

  useEffect(() => {
    let cancelled = false;
    const paint = async () => {
      const target = canvas.current;
      if (!target || isAudio) return;
      const ctx = target.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, target.width, target.height);
      const runtime = library.items.get(media.id);
      const image = runtime?.image ?? (await runtime?.canvas?.getCanvas(Math.max(runtime.firstVideo, seconds(scrub))))?.canvas;
      if (cancelled) return;
      if (!image) {
        ctx.fillStyle = '#8a8f93';
        ctx.font = '14px Tahoma';
        ctx.textAlign = 'center';
        ctx.fillText('Sin imagen de este material', target.width / 2, target.height / 2);
        return;
      }
      const scale = Math.min(target.width / image.width, target.height / image.height);
      const width = image.width * scale, height = image.height * scale;
      ctx.drawImage(image as CanvasImageSource, (target.width - width) / 2, (target.height - height) / 2, width, height);
    };
    void paint();
    return () => { cancelled = true; };
  }, [library, media.id, scrub, isAudio]);

  const fraction = (time: number) => Math.max(0, Math.min(1, seconds(time) / Math.max(.001, seconds(duration))));
  const scrubTo = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setScrub(clampTime(ticks((event.clientX - rect.left) / rect.width * seconds(duration))));
  };
  const span = Math.max(1, outPoint - inPoint);

  return (
    <div className="trimmer">
      <p className="export-plan">Origen: <strong>{media.name}</strong> · {seconds(duration).toFixed(2)} s. El tramo marcado dura <strong>{seconds(span).toFixed(2)} s</strong> y se colocará en el cursor ({seconds(at).toFixed(2)} s).</p>
      {isAudio
        ? <div className="trimmer-wave"><AudioWaveform
            media={media}
            width={TRIM_WAVE_COLUMNS}
            columns={TRIM_WAVE_COLUMNS}
            from={0}
            to={seconds(duration)}
            source={waveformSource(library.items.get(media.id)?.pcm)}
            
            label="Forma de onda del material"
          /></div>
        : <canvas ref={canvas} className="trimmer-preview" width={480} height={270} />}
      <div className="trimmer-bar" role="slider" aria-label="Barra del origen" aria-valuemin={0} aria-valuemax={Number(seconds(duration).toFixed(2))} aria-valuenow={Number(seconds(scrub).toFixed(2))} tabIndex={0} onClick={scrubTo}>
        <i className="trimmer-region" style={{ left: `${fraction(inPoint) * 100}%`, width: `${Math.max(0, fraction(outPoint) - fraction(inPoint)) * 100}%` }} />
        <b className="trimmer-in" style={{ left: `${fraction(inPoint) * 100}%` }} />
        <b className="trimmer-out" style={{ left: `${fraction(outPoint) * 100}%` }} />
        <s className="trimmer-scrub" style={{ left: `${fraction(scrub) * 100}%` }} />
      </div>
      <div className="form-grid">
        <Field label="Entrada (s)" value={seconds(inPoint)} min={0} max={seconds(duration)} step={.1} onChange={v => setInPoint(clampTime(Math.min(ticks(v), outPoint - 1)))} />
        <Field label="Salida (s)" value={seconds(outPoint)} min={0} max={seconds(duration)} step={.1} onChange={v => setOutPoint(clampTime(Math.max(ticks(v), inPoint + 1)))} />
        <Field label="Posición de exploración (s)" value={seconds(scrub)} min={0} max={seconds(duration)} step={.1} onChange={v => setScrub(clampTime(ticks(v)))} />
      </div>
      <div className="dialog-actions">
        <button onClick={() => setInPoint(clampTime(Math.min(scrub, outPoint - 1)))}>Marcar entrada aquí</button>
        <button onClick={() => setOutPoint(clampTime(Math.max(scrub, inPoint + 1)))}>Marcar salida aquí</button>
        <button onClick={() => { setInPoint(0); setOutPoint(duration); }}>Marcar todo</button>
      </div>
      <div className="dialog-actions">
        <button onClick={() => onEdit({ inPoint, outPoint, mode: 'insert' })}>Insertar en el cursor</button>
        <button onClick={() => onEdit({ inPoint, outPoint, mode: 'overwrite' })}>Sobrescribir en el cursor</button>
        <button onClick={onClose}>Cerrar</button>
      </div>
      <p><small>Insertar corre lo que venía después según el modo de rizo de la barra inferior; sobrescribir recorta o parte lo que hubiera en ese tramo y deja el hueco limpio. Si el material tiene audio, el par de vídeo y audio entra vinculado.</small></p>
    </div>
  );
}

