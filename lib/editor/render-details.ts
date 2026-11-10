// Datos que la ventana de renderizado enseña antes de exportar: el nombre del archivo que se va a
// descargar, el peso estimado, la comparación entre calidades, el diagnóstico previo y el tiempo que
// se calcula a partir del último render medido en este equipo.
//
// Todo es lógica pura (sin navegador ni códecs) para poder probarla con casos concretos. Lo único que
// guarda algo es la medición de velocidad, y lo hace en el almacén local del navegador, nunca en un
// servidor: los archivos del proyecto no salen del equipo.
import { EXPORT_MEMORY_WARN, QUALITY_LABEL, suggestedBitrate, type ExportFormat, type ExportQuality, type ExportSettings } from './export';

/** Peso a partir del cual conviene escribir a disco. Es un umbral de aviso, no un tope: el render no se corta por tamaño. */
export const RENDER_MEMORY_WARN = EXPORT_MEMORY_WARN;
export const QUALITY_ORDER: ExportQuality[] = ['draft', 'medium', 'high', 'master'];

/** Nombre seguro para el archivo que se descarga, con la extensión del formato elegido. */
export function renderFileName(name: string, format: ExportSettings['format']) {
  const clean = name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\.(mp4|webm|wav|sinaloapro|corte15)$/i, '')
    .trim()
    .replace(/[. ]+$/g, '');
  return `${clean || 'Vídeo'}.${format}`;
}

/** Peso aproximado de la salida: vídeo a su bitrate y audio al del codificador elegido. */
export function estimatedRenderBytes(settings: ExportSettings, duration: number, sampleRate: number) {
  const audio = settings.includeAudio
    ? settings.format === 'wav'
      ? sampleRate * 2 * 16
      : settings.quality === 'draft'
        ? 96000
        : settings.quality === 'master'
          ? 256000
          : 192000
    : 0;
  const video =
    settings.includeVideo && settings.format !== 'wav'
      ? (settings.bitrateMbps ?? suggestedBitrate(settings.width, settings.height, settings.fps.num / settings.fps.den, settings.quality)) * 1e6
      : 0;
  return Math.max(0, duration) * (video + audio) / 8;
}

/** «12,4 MB», «980 kB». Un decimal basta para saber qué se va a descargar. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0).replace('.', ',')} kB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 100 ? 0 : 1).replace('.', ',')} MB`;
}

/** «0:07,3» a partir de segundos, con la coma decimal del español. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const minutes = Math.floor(total / 60);
  const rest = total - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, '0').replace('.', ',')}`;
}

export type SizePressure = 'ok' | 'near' | 'over';

/** Cómo de cerca está la salida del umbral de memoria (256 MB): sirve para el aviso del medidor. */
export function sizePressure(bytes: number, limit = RENDER_MEMORY_WARN): SizePressure {
  if (!Number.isFinite(bytes)) return 'ok';
  if (bytes >= limit) return 'over';
  return bytes >= limit * 0.75 ? 'near' : 'ok';
}

export type QualityEstimate = { quality: ExportQuality; label: string; bytes: number; share: number };

/** Las cuatro calidades con su peso, para compararlas de un vistazo. La mayor ocupa la barra entera. */
export function qualityComparison(settings: ExportSettings, duration: number, sampleRate: number): QualityEstimate[] {
  const rows = QUALITY_ORDER.map(quality => ({
    quality,
    label: QUALITY_LABEL[quality],
    bytes: estimatedRenderBytes({ ...settings, quality }, duration, sampleRate),
  }));
  const largest = Math.max(1, ...rows.map(row => row.bytes));
  return rows.map(row => ({ ...row, share: row.bytes / largest }));
}

export type RenderCheckLevel = 'ok' | 'warn' | 'error';
export type RenderCheck = { id: string; level: RenderCheckLevel; label: string; detail: string };

export type RenderDiagnosticsInput = {
  settings: ExportSettings;
  caps: Record<ExportFormat, boolean>;
  audioSupport: boolean;
  duration: number;
  frames: number;
  sampleRate: number;
  projectWidth: number;
  projectHeight: number;
  projectFps: { num: number; den: number };
  missingMedia: number;
  hasRegion: boolean;
  name: string;
  /** Tramo ya formateado como timecode por el editor; si falta se usan los segundos. */
  rangeLabel?: string;
  /** El render se escribe directamente en un archivo del disco, sin pasar por la memoria del navegador. */
  directToFile?: boolean;
};

const one = (value: number) => value.toFixed(1).replace('.', ',');
const rate = (fps: { num: number; den: number }) => {
  const value = fps.num / fps.den;
  return Number.isInteger(value) ? String(value) : one(value);
};

const FORMAT_CODEC: Record<ExportFormat, string> = { mp4: 'H.264 / AAC', webm: 'VP9 / Opus', wav: 'PCM 16 bits' };

/**
 * Comprobaciones que se pueden hacer antes de darle a renderizar: códec disponible, audio, salidas,
 * duración, tramo, medios revinculados, límite de memoria, ampliación y velocidad. No renderiza nada.
 */
export function renderDiagnostics(input: RenderDiagnosticsInput): RenderCheck[] {
  const { settings } = input;
  const checks: RenderCheck[] = [];
  const bytes = estimatedRenderBytes(settings, input.duration, input.sampleRate);
  const wantsVideo = settings.includeVideo && settings.format !== 'wav';

  if (!settings.includeVideo && !settings.includeAudio) {
    checks.push({ id: 'outputs', level: 'error', label: 'Sin salidas activas', detail: 'Activa vídeo, audio o ambos para poder exportar.' });
  } else {
    checks.push({
      id: 'outputs',
      level: 'ok',
      label: wantsVideo && settings.includeAudio ? 'Vídeo y audio' : wantsVideo ? 'Solo vídeo' : 'Solo audio',
      detail: wantsVideo ? `${settings.width} × ${settings.height} · ${rate(settings.fps)} fps` : `${input.sampleRate / 1000} kHz · estéreo`,
    });
  }

  const codecOk = input.caps[settings.format];
  checks.push(
    codecOk
      ? { id: 'codec', level: 'ok', label: `Códec ${settings.format.toUpperCase()} disponible`, detail: FORMAT_CODEC[settings.format] }
      : {
          id: 'codec',
          level: 'error',
          label: `Sin códec ${settings.format.toUpperCase()} en este navegador`,
          detail: 'Prueba WebM o WAV, o abre el proyecto en una versión actual de Chrome, Edge o Firefox.',
        },
  );

  if (settings.includeAudio) {
    checks.push(
      input.audioSupport
        ? { id: 'audio', level: 'ok', label: 'Mezcla de audio lista', detail: `${input.sampleRate / 1000} kHz · estéreo` }
        : {
            id: 'audio',
            level: 'error',
            label: 'Web Audio no disponible',
            detail: 'Desmarca «Incluir audio» o abre el proyecto en un navegador con AudioContext y AudioBuffer.',
          },
    );
  }

  if (input.duration <= 0 || input.frames <= 0) {
    checks.push({ id: 'duration', level: 'error', label: 'No hay nada que renderizar', detail: 'Coloca al menos un clip en la línea de tiempo.' });
  } else {
    checks.push({ id: 'duration', level: 'ok', label: `${input.frames} fotogramas por renderizar`, detail: `${formatDuration(input.duration)} de salida` });
  }

  if (settings.scope === 'range') {
    const valid = input.hasRegion && settings.end > settings.start;
    checks.push(
      valid
        ? { id: 'range', level: 'ok', label: 'Tramo definido', detail: input.rangeLabel ?? `${formatDuration(settings.start)} → ${formatDuration(settings.end)}` }
        : { id: 'range', level: 'error', label: 'Tramo vacío o sin marcar', detail: 'Dibuja un tramo sobre la regla o cambia a «Proyecto completo».' },
    );
  }

  if (input.missingMedia > 0) {
    checks.push({
      id: 'media',
      level: 'error',
      label: `${input.missingMedia} medio${input.missingMedia === 1 ? '' : 's'} sin vincular`,
      detail: 'Revincúlcalos desde Medios de proyecto antes de exportar.',
    });
  } else {
    checks.push({ id: 'media', level: 'ok', label: 'Medios vinculados', detail: 'Todos los clips tienen su archivo.' });
  }

  // El tamaño ya no bloquea nada: con escritura directa se guarda en disco y el peso da igual. Sin ella, el
  // render se genera en memoria, así que a partir de 256 MB solo se avisa de lo que puede tardar y de dónde conviene hacerlo.
  const pressure = sizePressure(bytes);
  checks.push(
    input.directToFile
      ? { id: 'limit', level: 'ok', label: 'Sin límite de tamaño', detail: `Se escribe directamente en el archivo que elijas: ≈ ${formatBytes(bytes)}.` }
      : pressure === 'over'
        ? {
            id: 'limit',
            level: 'warn',
            label: 'Salida grande en memoria',
            detail: `≈ ${formatBytes(bytes)}: este navegador no escribe archivos directamente, así que se genera en memoria. En Chrome o Edge puedes guardarla en disco; aquí, exporta por tramos si el navegador se queda sin memoria.`,
          }
        : pressure === 'near'
          ? { id: 'limit', level: 'warn', label: 'Cerca del umbral de memoria', detail: `≈ ${formatBytes(bytes)} de ${formatBytes(RENDER_MEMORY_WARN)}.` }
          : { id: 'limit', level: 'ok', label: 'Dentro del umbral de memoria', detail: `≈ ${formatBytes(bytes)} de ${formatBytes(RENDER_MEMORY_WARN)}.` },
  );

  if (wantsVideo) {
    const upscaled = settings.width > input.projectWidth || settings.height > input.projectHeight;
    checks.push(
      upscaled
        ? {
            id: 'scale',
            level: 'warn',
            label: 'Se amplía por encima del proyecto',
            detail: `El proyecto es ${input.projectWidth} × ${input.projectHeight} y la salida ${settings.width} × ${settings.height}.`,
          }
        : { id: 'scale', level: 'ok', label: 'Tamaño nativo o reducido', detail: `Proyecto ${input.projectWidth} × ${input.projectHeight}.` },
    );

    const projectRate = input.projectFps.num / input.projectFps.den;
    const outRate = settings.fps.num / settings.fps.den;
    checks.push(
      Math.abs(projectRate - outRate) > 0.001
        ? {
            id: 'fps',
            level: 'warn',
            label: 'Velocidad distinta a la del proyecto',
            detail: `Proyecto ${rate(input.projectFps)} fps · salida ${rate(settings.fps)} fps: el movimiento puede notarse distinto.`,
          }
        : { id: 'fps', level: 'ok', label: 'Velocidad del proyecto', detail: `${rate(settings.fps)} fps.` },
    );
  }

  const fileName = renderFileName(input.name, settings.format);
  const wanted = input.name.replace(/\.(mp4|webm|wav)$/i, '').trim();
  const saved = fileName.slice(0, fileName.lastIndexOf('.'));
  checks.push(
    saved !== wanted || !wanted
      ? { id: 'name', level: 'warn', label: 'El nombre se ajustará al guardar', detail: `Se descargará como «${fileName}».` }
      : { id: 'name', level: 'ok', label: 'Nombre listo', detail: fileName },
  );

  return checks;
}

export type RenderRateSample = { perFrameMs: number; megapixels: number; at: number };
export type StorageLike = { getItem(key: string): string | null; setItem(key: string, value: string): void };
const RATE_KEY = 'sinaloa.render.rate.v1';

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Guarda el ritmo real del último render para poder estimar el siguiente en el mismo equipo. */
export function rememberRenderRate(sample: { frames: number; elapsedMs: number; width: number; height: number }, storage: StorageLike | null = browserStorage()): void {
  if (!storage || sample.frames <= 0 || sample.elapsedMs <= 0) return;
  const megapixels = Math.max(0.01, sample.width * sample.height / 1e6);
  try {
    storage.setItem(RATE_KEY, JSON.stringify({ perFrameMs: sample.elapsedMs / sample.frames, megapixels, at: Date.now() } satisfies RenderRateSample));
  } catch {
    // Sin almacén local no pasa nada: la estimación simplemente no estará disponible.
  }
}

/**
 * Segundos estimados para `frames` fotogramas, escalando la medición por los megapíxeles de la salida.
 * Devuelve null cuando todavía no hay ningún render medido: es más honesto que inventar una cifra.
 */
export function estimateRenderSeconds(frames: number, megapixels: number, storage: StorageLike | null = browserStorage()): number | null {
  if (!storage || frames <= 0) return null;
  try {
    const raw = storage.getItem(RATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RenderRateSample>;
    if (typeof parsed.perFrameMs !== 'number' || typeof parsed.megapixels !== 'number' || parsed.perFrameMs <= 0 || parsed.megapixels <= 0) return null;
    const factor = Math.max(0.2, Math.min(5, Math.max(0.01, megapixels) / parsed.megapixels));
    const seconds = frames * parsed.perFrameMs * factor / 1000;
    return Math.max(0.1, Math.round(seconds * 10) / 10);
  } catch {
    return null;
  }
}
