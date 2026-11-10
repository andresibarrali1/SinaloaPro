'use client';
// Ventana de renderizado: el paso final del proyecto. Enseña lo que se va a descargar antes de
// descargarlo (nombre, peso, calidad, tiempo estimado), comprueba que el navegador pueda codificarlo,
// deja guardar plantillas propias y mantiene la cola de trabajos a la vista.
//
// Todo se calcula en el equipo: la ventana no sube nada a ningún servidor. El diagnóstico y el peso son
// estimaciones basadas en los ajustes, no una promesa del codificador; el tiempo se apoya en el último
// render medido aquí y, mientras no haya ninguno, se dice que todavía no se sabe.
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, Download, Film, Info, Magnet, Music, Plus, Save, Trash2, XCircle } from 'lucide-react';
import { Check, Choice, Field } from './controls';
import { BATCH_STATUS_LABEL, summarize, type BatchJob } from '@/lib/editor/batch';
import { seconds, ticks } from '@/lib/editor/project';
import { QUALITY_LABEL, suggestedBitrate, type ExportFormat, type ExportProgress, type ExportQuality, type ExportSettings } from '@/lib/editor/export';
import {
  RENDER_MEMORY_WARN,
  estimateRenderSeconds,
  estimatedRenderBytes,
  formatBytes,
  formatDuration,
  qualityComparison,
  renderDiagnostics,
  renderFileName,
  sizePressure,
} from '@/lib/editor/render-details';
import { RENDER_PRESETS, loadSavedPresets, presetFromSettings, removeSavedPreset, upsertSavedPreset, writeSavedPresets, type SavedRenderPreset } from '@/lib/editor/render-presets';

export type RenderWorkspaceProps = {
  projectName: string;
  projectSize: { width: number; height: number };
  projectFps: { num: number; den: number };
  settings: ExportSettings;
  onSettings: (patch: Partial<ExportSettings>) => void;
  preset: string;
  onPreset: (id: string) => void;
  cap: Record<ExportFormat, boolean>;
  audioSupport: boolean;
  duration: number;
  durationLabel: string;
  frames: number;
  sampleRate: number;
  name: string;
  onName: (name: string) => void;
  hasRegion: boolean;
  snap: boolean;
  onSnap: () => void;
  /** Convierte ticks del proyecto a timecode, para el nombre del tramo. */
  formatTick: (ticks: number) => string;
  progress: ExportProgress | null;
  rendering: boolean;
  status: string;
  jobs: BatchJob[];
  batchProblem: string | null;
  missingMedia: number;
  hasEvents: boolean;
  /** Dónde se guarda: en el archivo que se elija (sin límite de tamaño) o descargándolo al terminar. */
  destination: 'file' | 'download';
  /** Este navegador puede escribir el render directamente en disco. */
  canSaveFile: boolean;
  onDestination: (destination: 'file' | 'download') => void;
  onAddToBatch: () => void;
  onAddVariants: () => void;
  onAddAudioTracks: () => void;
  onClearBatch: () => void;
  onRemoveJob: (id: string) => void;
  onRunBatch: () => void;
  onRender: () => void;
  onCancel: () => void;
};

const FPS_ITEMS: [string, string][] = [
  ['24/1', '24'],
  ['25/1', '25'],
  ['30/1', '30'],
  ['30000/1001', '29,970'],
  ['24000/1001', '23,976'],
  ['50/1', '50'],
  ['60/1', '60'],
  ['60000/1001', '59,940'],
];

const STAGES = [
  { id: 'preparando', label: 'Preparar' },
  { id: 'video', label: 'Vídeo' },
  { id: 'audio', label: 'Audio' },
  { id: 'finalizando', label: 'Finalizar' },
] as const;

const FORMAT_INFO: Record<ExportFormat, { label: string; codec: string; hint: string }> = {
  mp4: { label: 'MP4', codec: 'H.264 · AAC', hint: 'Máxima compatibilidad' },
  webm: { label: 'WebM', codec: 'VP9 · Opus', hint: 'Mejor compresión web' },
  wav: { label: 'WAV', codec: 'PCM 16 bits', hint: 'Solo audio, sin pérdida' },
};

const QUALITY_INFO: Record<ExportQuality, string> = {
  draft: 'Rápida, para revisar',
  medium: 'Equilibrio diario',
  high: 'Buena para publicar',
  master: 'La mejor calidad',
};

const one = (value: number) => value.toFixed(1).replace('.', ',');
const fpsLabel = (fps: { num: number; den: number }) => {
  const value = fps.num / fps.den;
  return Number.isInteger(value) ? String(value) : one(value);
};
const fpsKey = (fps: { num: number; den: number }) => `${fps.num}/${fps.den}`;
const readFps = (value: string) => {
  const [num, den] = value.split('/').map(Number);
  return { num, den };
};
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const ratioLabel = (width: number, height: number) => {
  const divisor = gcd(Math.round(width), Math.round(height)) || 1;
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
};
const storage = () => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

export function RenderWorkspace(p: RenderWorkspaceProps) {
  const [presetName, setPresetName] = useState('');
  const [saved, setSaved] = useState<SavedRenderPreset[]>(() => loadSavedPresets(storage()));
  const [copied, setCopied] = useState(false);
  const { settings } = p;

  const fileName = renderFileName(p.name, settings.format);
  const size = estimatedRenderBytes(settings, p.duration, p.sampleRate);
  // Con escritura directa el peso no presiona a nada: se guarda en disco mientras se codifica.
  const pressure: 'ok' | 'near' | 'over' = p.destination === 'file' ? 'ok' : sizePressure(size);
  const wantsVideo = settings.includeVideo && settings.format !== 'wav';
  const rangeLabel = p.hasRegion ? `${p.formatTick(settings.start)} → ${p.formatTick(settings.end)}` : '';
  const fpsItems: [string, string][] = FPS_ITEMS.some(([value]) => value === fpsKey(settings.fps))
    ? FPS_ITEMS
    : [[fpsKey(settings.fps), fpsLabel(settings.fps)], ...FPS_ITEMS];
  const checks = renderDiagnostics({
    settings,
    caps: p.cap,
    audioSupport: p.audioSupport,
    duration: p.duration,
    frames: p.frames,
    sampleRate: p.sampleRate,
    projectWidth: p.projectSize.width,
    projectHeight: p.projectSize.height,
    projectFps: p.projectFps,
    missingMedia: p.missingMedia,
    hasRegion: p.hasRegion,
    name: p.name,
    rangeLabel,
    directToFile: p.destination === 'file',
  });
  const errors = checks.filter(check => check.level === 'error').length;
  const warnings = checks.filter(check => check.level === 'warn').length;
  const problems = checks.filter(check => check.level !== 'ok');
  const passed = checks.length - problems.length;
  const checkIcon = (level: 'ok' | 'warn' | 'error') => level === 'ok' ? <CheckCircle2 aria-hidden="true" /> : level === 'warn' ? <AlertTriangle aria-hidden="true" /> : <XCircle aria-hidden="true" />;
  const formatReady = p.cap[settings.format] && (!settings.includeAudio || p.audioSupport);
  const rangeBlocked = settings.scope === 'range' && !p.hasRegion;
  const canRender = p.hasEvents && p.frames > 0 && formatReady && (settings.includeVideo || settings.includeAudio) && !rangeBlocked && !p.rendering && errors === 0;
  const megapixels = Math.max(0.01, settings.width * settings.height / 1e6);
  const suggested = suggestedBitrate(settings.width, settings.height, settings.fps.num / settings.fps.den, settings.quality);
  const bitrateMax = Math.max(40, Math.ceil(suggested * 2));
  const bitrateMin = Math.min(1, Math.max(0.2, Math.round(suggested * 0.4 * 10) / 10));
  const estimate = estimateRenderSeconds(p.frames, megapixels);
  const qualities = qualityComparison(settings, p.duration, p.sampleRate);
  const queue = summarize(p.jobs);
  const percent = p.progress?.total ? Math.min(100, (p.progress.done / p.progress.total) * 100) : 0;
  const stageIndex = p.progress ? Math.max(0, STAGES.findIndex(stage => stage.id === p.progress!.stage)) : 0;
  const queueFrames = p.jobs.reduce((total, job) => total + job.frames, 0);
  const queueDone = p.jobs.reduce((total, job) => total + job.done, 0);
  const queueReady = p.jobs.some(job => job.status === 'pendiente' || job.status === 'error');
  const sizeOptions = [
    { width: p.projectSize.width, height: p.projectSize.height, label: 'Proyecto' },
    { width: 1920, height: 1080, label: 'Horizontal' },
    { width: 1080, height: 1920, label: 'Vertical' },
    { width: 1080, height: 1080, label: 'Cuadrado' },
  ];
  const activeSize = sizeOptions.findIndex(option => settings.width === option.width && settings.height === option.height);

  function persist(next: SavedRenderPreset[]) {
    setSaved(next);
    writeSavedPresets(next, storage());
  }

  function savePreset() {
    const name = presetName.trim();
    if (!name) return;
    persist(upsertSavedPreset(saved, presetFromSettings(name, settings)));
    setPresetName('');
  }

  function applySaved(savedPreset: SavedRenderPreset) {
    p.onSettings({ ...savedPreset.settings, ...(savedPreset.settings.fps ? { fps: { ...savedPreset.settings.fps } } : {}) });
  }

  async function copySummary() {
    const lines = [
      'Estudio de renderizado · Sinaloa Pro',
      `Archivo: ${fileName}`,
      `Formato: ${settings.format.toUpperCase()} · ${wantsVideo ? `${settings.width} × ${settings.height} · ${fpsLabel(settings.fps)} fps` : `${p.sampleRate / 1000} kHz estéreo`}`,
      `Duración: ${p.durationLabel} · ${p.frames} fotogramas`,
      `Peso estimado: ${formatBytes(size)}`,
      `Tiempo estimado: ${estimate === null ? 'todavía sin medir' : formatDuration(estimate)}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="render-studio">
      <header className="render-hero">
        <span className="render-hero-icon" aria-hidden="true"><Film /></span>
        <div className="render-hero-copy">
          <p className="render-eyebrow">Salida de vídeo</p>
          <h2>Estudio de renderizado</h2>
          <p className="render-hero-meta">
            <span>{p.projectName}</span><i aria-hidden="true" />
            <span>{p.durationLabel}</span><i aria-hidden="true" />
            <span>{p.frames} fotogramas</span><i aria-hidden="true" />
            <span>Procesamiento local</span>
          </p>
        </div>
        <div className="render-hero-badges">
          <span className="render-badge format">{settings.format.toUpperCase()}</span>
          <span className="render-badge">{wantsVideo ? `${settings.width}×${settings.height}` : 'Audio'}</span>
          <span className="render-badge">{wantsVideo ? `${fpsLabel(settings.fps)} fps` : `${p.sampleRate / 1000} kHz`}</span>
        </div>
      </header>

      <div className="render-body">
        <div className="render-form">
          <fieldset className="render-fields" disabled={p.rendering}>
            <section className="render-card">
              <header>
                <h3>Archivo</h3>
                <span className="render-card-note">{p.destination === 'file' ? 'Se guarda donde elijas' : 'Se descarga a tu carpeta de descargas'}</span>
              </header>
              <label className="render-name-field">
                <span>Nombre del archivo</span>
                <span className="render-name-input">
                  <input aria-label="Nombre del archivo de salida" value={p.name} onChange={event => p.onName(event.target.value)} placeholder="Mi vídeo" />
                  <b>.{settings.format}</b>
                </span>
              </label>
              <p className="render-file-preview">Salida: <code>{fileName}</code></p>
              <label className="field render-destination">Destino
                <Choice
                  label="Destino del render"
                  value={p.destination}
                  items={p.canSaveFile ? [['file', 'Guardar en un archivo (sin límite)'], ['download', 'Descargar al terminar']] : [['download', 'Descargar al terminar']]}
                  onChange={value => p.onDestination(value === 'file' ? 'file' : 'download')}
                />
              </label>
              <p className="render-hint">
                {p.destination === 'file'
                  ? 'El vídeo se escribe en el archivo que elijas mientras se codifica: no pasa por la memoria del navegador y no hay tope de tamaño, así que puedes exportar horas a la máxima calidad.'
                  : p.canSaveFile
                    ? 'Se genera en memoria y se descarga al terminar. Para vídeos largos, elige «Guardar en un archivo»: no hay límite de tamaño.'
                    : 'Este navegador no puede escribir el archivo directamente: se genera en memoria y se descarga. Para vídeos largos ábrelo en Chrome o Edge, que sí escriben en disco.'}
              </p>
              <div className="render-size-presets">
                {sizeOptions.map((option, index) => (
                  <button
                    key={option.label}
                    type="button"
                    aria-label={`Tamaño ${option.label}`}
                    aria-pressed={index === activeSize}
                    onClick={() => p.onSettings({ width: option.width, height: option.height })}
                  >
                    <span className="render-aspect" style={{ aspectRatio: `${option.width}/${option.height}` }} aria-hidden="true" />
                    <span className="render-size-name">{option.label}</span>
                    <small>{option.width}×{option.height}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="render-card">
              <header>
                <h3>Formato y calidad</h3>
                <span className="render-card-note">{FORMAT_INFO[settings.format].codec}</span>
              </header>
              <div className="render-format-row">
                <label className="field render-format-select">Formato
                  <Choice
                    label="Formato de exportación"
                    value={settings.format}
                    items={[
                      ['mp4', `MP4 · H.264 / AAC${p.cap.mp4 ? '' : ' (no disponible)'}`],
                      ['webm', `WebM · VP9 / Opus${p.cap.webm ? '' : ' (no disponible)'}`],
                      ['wav', `WAV · PCM 16 bits${p.cap.wav ? '' : ' (no disponible)'}`],
                    ]}
                    onChange={value => p.onSettings({ format: value as ExportFormat, ...(value === 'wav' ? { includeVideo: false } : {}) })}
                  />
                </label>
                <div className="render-format-hint">{FORMAT_INFO[settings.format].hint}</div>
                <div className="render-capabilities" aria-label="Códecs de este navegador">
                  {(['mp4', 'webm', 'wav'] as ExportFormat[]).map(format => (
                    <span key={format} className={p.cap[format] ? 'on' : 'off'} title={`${FORMAT_INFO[format].label}: ${p.cap[format] ? 'disponible' : 'no disponible'}`}>
                      {FORMAT_INFO[format].label}
                    </span>
                  ))}
                </div>
              </div>

              {settings.format !== 'wav' && (
                <div className="render-quality-grid" role="group" aria-label="Calidad de exportación">
                  {(['draft', 'medium', 'high', 'master'] as ExportQuality[]).map(quality => (
                    <button
                      key={quality}
                      type="button"
                      aria-pressed={settings.quality === quality}
                      onClick={() => p.onSettings({ quality, bitrateMbps: null })}
                    >
                      <strong>{QUALITY_LABEL[quality]}</strong>
                      <small>{QUALITY_INFO[quality]}</small>
                    </button>
                  ))}
                </div>
              )}

              <div className="render-dimensions">
                <Field label="Ancho" value={settings.width} min={16} max={3840} step={2} onChange={value => p.onSettings({ width: Math.round(value / 2) * 2 })} />
                <Field label="Alto" value={settings.height} min={16} max={2160} step={2} onChange={value => p.onSettings({ height: Math.round(value / 2) * 2 })} />
                <label className="field">FPS
                  <Choice label="FPS de exportación" value={fpsKey(settings.fps)} items={fpsItems} onChange={value => p.onSettings({ fps: readFps(value) })} />
                </label>
              </div>

              {wantsVideo && (
                <div className="render-bitrate">
                  <div className="render-bitrate-head">
                    <span>Bitrate de vídeo</span>
                    <b>{settings.bitrateMbps === null ? `Automático · ${one(suggested)} Mbps` : `${one(settings.bitrateMbps)} Mbps`}</b>
                  </div>
                  <div className="render-bitrate-row">
                    <input
                      type="range"
                      aria-label="Bitrate de video"
                      min={bitrateMin}
                      max={bitrateMax}
                      step={0.5}
                      value={settings.bitrateMbps ?? suggested}
                      onChange={event => p.onSettings({ bitrateMbps: Number(event.target.value) })}
                    />
                    <button type="button" className="render-auto" aria-pressed={settings.bitrateMbps === null} onClick={() => p.onSettings({ bitrateMbps: null })}>Auto</button>
                  </div>
                  <p className="render-hint">Más bitrate es más calidad y más peso. «Auto» parte del tamaño y la velocidad de la salida.</p>
                </div>
              )}

              <div className="render-switches">
                <Check checked={settings.includeVideo} onChange={value => p.onSettings({ includeVideo: value })} disabled={settings.format === 'wav'}>Incluir video</Check>
                <Check checked={settings.includeAudio} onChange={value => p.onSettings({ includeAudio: value })}>Incluir audio</Check>
              </div>            </section>

            <section className="render-card">
              <header>
                <h3>Ámbito</h3>
                <span className="render-card-note">{settings.scope === 'full' ? 'Todo el proyecto' : 'Solo la parte marcada'}</span>
              </header>
              <div className="render-range-row">
                <label className="field render-scope">Ámbito
                  <Choice
                    label="Ámbito de render"
                    value={settings.scope}
                    onChange={value => p.onSettings({
                      scope: value as ExportSettings['scope'],
                      ...(value === 'range' && p.hasRegion ? { start: settings.start, end: settings.end } : {}),
                    })}
                    items={[
                      ['full', 'Proyecto completo'],
                      ['range', p.hasRegion ? `Tramo ${rangeLabel}` : 'Tramo (sin definir)'],
                    ]}
                  />
                </label>
                <button type="button" className="render-snap" aria-pressed={p.snap} onClick={p.onSnap} title="Ajustar los extremos del tramo a bordes de clips, cursor y marcadores (F8)">
                  <Magnet size={14} aria-hidden="true" /> Imán: {p.snap ? 'activado' : 'desactivado'}
                </button>
              </div>
              {settings.scope === 'range' && (
                p.hasRegion ? (
                  <div className="render-range-fields">
                    <Field label="Inicio del tramo (s)" value={seconds(settings.start)} min={0} step={0.01} onChange={value => p.onSettings({ start: ticks(Math.max(0, Math.min(value, seconds(settings.end) - 0.001))) })} />
                    <Field label="Fin del tramo (s)" value={seconds(settings.end)} min={0} step={0.01} onChange={value => p.onSettings({ end: ticks(Math.max(seconds(settings.start) + 0.001, value)) })} />
                  </div>
                ) : (
                  <p className="render-warning" role="alert">No hay tramo definido. Arrastra sobre la regla de la línea de tiempo, o marca «[» y «]» con el cursor, para elegir qué parte se renderiza.</p>
                )
              )}
            </section>

            <section className="render-card">
              <header>
                <h3>Plantillas</h3>
                <span className="render-card-note">{p.preset === 'custom' ? 'Personalizada' : 'Aplicada'}</span>
              </header>
              <div className="render-presets" role="group" aria-label="Plantillas de render">
                <button
                  type="button"
                  className="render-preset"
                  aria-pressed={p.preset === 'proyecto'}
                  onClick={() => p.onPreset('proyecto')}
                  title="Los mismos tamaño y velocidad del proyecto"
                >
                  <span className="render-preset-tag">PROY</span>
                  <span className="render-preset-copy"><strong>Igual que el proyecto</strong><small>{p.projectSize.width}×{p.projectSize.height} · {fpsLabel(p.projectFps)} fps</small></span>
                </button>
                {RENDER_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    className="render-preset"
                    aria-pressed={p.preset === preset.id}
                    onClick={() => p.onPreset(preset.id)}
                    title={preset.label}
                  >
                    <span className="render-preset-tag">{preset.settings.format?.toUpperCase()}</span>
                    <span className="render-preset-copy">
                      <strong>{preset.settings.width}×{preset.settings.height}</strong>
                      <small>{preset.settings.fps ? fpsLabel(preset.settings.fps) : ''} fps · {QUALITY_LABEL[preset.settings.quality ?? 'high']}</small>
                    </span>
                  </button>
                ))}
              </div>

              <div className="render-saved">
                <input
                  value={presetName}
                  maxLength={40}
                  onChange={event => setPresetName(event.target.value)}
                  onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); savePreset(); } }}
                  placeholder="Nombre de tu plantilla"
                  aria-label="Nombre de la plantilla propia"
                />
                <button type="button" onClick={savePreset} disabled={!presetName.trim()} title="Guardar los ajustes actuales con este nombre en este equipo">
                  <Save size={13} aria-hidden="true" /> Guardar
                </button>
              </div>
              {saved.length > 0 ? (
                <ul className="render-saved-list" aria-label="Plantillas guardadas">
                  {saved.map(item => (
                    <li key={item.id} className="render-saved-chip">
                      <button type="button" className="render-saved-apply" onClick={() => applySaved(item)} title={`Aplicar «${item.name}»`}>
                        {item.name}
                        <small>{item.settings.width ?? '—'}×{item.settings.height ?? '—'} · {(item.settings.format ?? 'mp4').toUpperCase()}</small>
                      </button>
                      <button type="button" className="render-saved-remove" aria-label={`Eliminar la plantilla ${item.name}`} title="Eliminar esta plantilla" onClick={() => persist(removeSavedPreset(saved, item.id))}>
                        <Trash2 size={11} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="render-hint">Guarda tus ajustes favoritos y vuelve a aplicarlos con un clic. Se guardan hasta ocho en este equipo.</p>
              )}
            </section>

            <section className="render-card batch-block">
              <header>
                <h3>Cola de trabajos</h3>
                <span className="render-card-note">{p.jobs.length ? `${queue.total} en cola` : 'Sin trabajos'}</span>
              </header>
              <p className="batch-note">Prepara varias versiones y expórtalas una tras otra. Cada trabajo conserva los ajustes que tenía al añadirlo; el navegador puede pedir permiso para varias descargas.</p>
              <div className="batch-add">
                <button type="button" onClick={p.onAddToBatch} disabled={p.rendering || !p.hasEvents || p.batchProblem !== null}><Plus size={13} aria-hidden="true" /> Añadir a la cola</button>
                <button type="button" onClick={p.onAddVariants} disabled={p.rendering || !p.hasEvents}>Añadir las plantillas disponibles</button>
                <button type="button" onClick={p.onAddAudioTracks} disabled={p.rendering || !p.cap.wav} title="Una salida WAV por cada pista de audio, como el script «Render Audio Tracks» de VEGAS 15">Añadir una salida por pista de audio</button>
                <button type="button" onClick={p.onClearBatch} disabled={p.rendering || !p.jobs.length}>Vaciar la cola</button>
              </div>
              {p.batchProblem && <p className="render-warning" role="alert">{p.batchProblem}</p>}
              {p.jobs.length > 0 && (
                <>
                  <ol className="batch-list" aria-label="Trabajos del lote">
                    {p.jobs.map((job, index) => (
                      <li key={job.id} className={`batch-job ${job.status}`}>
                        <span className="batch-order">{index + 1}</span>
                        <span className="batch-label">
                          {job.label}
                          <small>
                            {job.fileName}
                            {job.status === 'hecho' ? ` · ${formatBytes(job.bytes)} en ${one(job.elapsedMs / 1000)} s` : ''}
                            {job.status === 'renderizando' ? ` · ${job.done}/${job.frames} fotogramas` : ''}
                            {job.status === 'error' ? ` · ${job.error}` : ''}
                          </small>
                        </span>
                        <span className="batch-state">{BATCH_STATUS_LABEL[job.status]}</span>
                        <button type="button" className="batch-remove" aria-label={`Quitar ${job.label} de la cola`} title="Quitar este trabajo de la cola" onClick={() => p.onRemoveJob(job.id)} disabled={p.rendering}>Quitar</button>
                        {(job.status === 'renderizando' || job.status === 'hecho') && (
                          <span className="batch-bar" aria-hidden="true"><i style={{ width: `${job.frames ? Math.min(100, (job.done / job.frames) * 100) : 0}%` }} /></span>
                        )}
                      </li>
                    ))}
                  </ol>
                  <div className="batch-summary">
                    <span>{queue.pending} en espera · {queue.done} hecho{queue.done === 1 ? '' : 's'}{queue.failed ? ` · ${queue.failed} con error` : ''} · {queueFrames} fotogramas en total</span>
                    <span className="batch-progress" aria-hidden="true"><i style={{ width: `${queueFrames ? Math.min(100, (queueDone / queueFrames) * 100) : 0}%` }} /></span>
                  </div>
                  <div className="batch-run">
                    <button type="button" className="render-cta small" onClick={p.onRunBatch} disabled={p.rendering || !queueReady || !p.hasEvents}>
                      <Download size={14} aria-hidden="true" /> Renderizar la cola
                    </button>
                  </div>
                </>
              )}
            </section>
          </fieldset>
        </div>

        <aside className="render-rail">
          <section className="render-preview">
            <div className="render-frame-stage">
              <span
                className="render-frame"
                style={{
                  aspectRatio: wantsVideo ? settings.width / settings.height : 1.6,
                  width: `min(100%, calc(132px * ${wantsVideo ? settings.width / settings.height : 1.6}))`,
                }}
                aria-hidden="true"
              >
                <span className="render-frame-chip">{settings.format.toUpperCase()}</span>
                <span className="render-frame-glyph">{wantsVideo ? <Film /> : <Music />}</span>
                <span className="render-frame-meta">{wantsVideo ? `${settings.width} × ${settings.height} · ${ratioLabel(settings.width, settings.height)}` : `${p.sampleRate / 1000} kHz · estéreo`}</span>
              </span>
            </div>
            <p className="render-preview-name" title={fileName}>{fileName}</p>
            <div className="render-preview-actions">
              <span className={`render-pill ${errors ? 'bad' : warnings ? 'warn' : 'good'}`}>
                {errors ? `${errors} bloqueo${errors === 1 ? '' : 's'}` : warnings ? `${warnings} aviso${warnings === 1 ? '' : 's'}` : 'Listo para exportar'}
              </span>
              <button type="button" className="render-copy" onClick={() => void copySummary()}>
                <Copy size={12} aria-hidden="true" /> {copied ? 'Copiado' : 'Copiar resumen'}
              </button>
            </div>
          </section>

          <dl className="render-stats" aria-label="Resumen de la salida">
            <div className="render-stat"><dt>Duración</dt><dd>{p.durationLabel}</dd></div>
            <div className="render-stat"><dt>Fotogramas</dt><dd>{wantsVideo ? `${p.frames} · ${fpsLabel(settings.fps)} fps` : 'Sin vídeo'}</dd></div>
            <div className="render-stat"><dt>Imagen</dt><dd>{wantsVideo ? `${settings.width} × ${settings.height}` : 'Solo audio'}</dd></div>
            <div className="render-stat"><dt>Audio</dt><dd>{settings.includeAudio ? `${p.sampleRate / 1000} kHz · estéreo` : 'Sin audio'}</dd></div>
            <div className="render-stat"><dt>Peso estimado</dt><dd>{formatBytes(size)}</dd></div>
            <div className="render-stat"><dt>Tiempo estimado</dt><dd>{p.rendering ? 'En curso' : estimate === null ? 'Aún sin medir' : `≈ ${formatDuration(estimate)}`}</dd></div>
          </dl>

          <section className="render-card tight">
            <header>
              <h3>Diagnóstico</h3>
              <span className="render-card-note">{errors ? 'Hay que corregir' : warnings ? 'Revisa los avisos' : `${checks.length} comprobaciones`}</span>
            </header>
            <div className="render-checks">
              {problems.map(check => (
                <div key={check.id} className={`render-check ${check.level}`}>
                  {checkIcon(check.level)}
                  <div><strong>{check.label}</strong><small>{check.detail}</small></div>
                </div>
              ))}
              {problems.length === 0 && (
                <div className="render-check ok">
                  <CheckCircle2 aria-hidden="true" />
                  <div><strong>Todo en orden</strong><small>{passed} comprobaciones superadas: códec, audio, duración, medios, memoria y nombre.</small></div>
                </div>
              )}
              {passed > 0 && (
                <details className="render-check-details">
                  <summary>Ver las {passed} comprobaciones correctas</summary>
                  <div className="render-checks">
                    {checks.filter(check => check.level === 'ok').map(check => (
                      <div key={check.id} className="render-check ok">
                        {checkIcon('ok')}
                        <div><strong>{check.label}</strong><small>{check.detail}</small></div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </section>

          <section className="render-card tight">
            <header>
              <h3>Peso por calidad</h3>
              <span className="render-card-note">{p.destination === 'file' ? `sin límite · ${formatBytes(size)}` : `del aviso de ${formatBytes(RENDER_MEMORY_WARN)}`}</span>
            </header>
            <div className={`render-meter ${pressure}`} role="img" aria-label={p.destination === 'file' ? `Peso estimado ${formatBytes(size)}, sin límite al escribir en disco` : `Peso estimado ${formatBytes(size)} de ${formatBytes(RENDER_MEMORY_WARN)}`}>
              <i style={{ width: `${p.destination === 'file' ? 100 : Math.min(100, (size / RENDER_MEMORY_WARN) * 100)}%` }} />
            </div>
            <p className="render-meter-note">{p.destination === 'file' ? <>{formatBytes(size)} <span>·</span> se escribe en el archivo que elijas</> : <>{formatBytes(size)} de {formatBytes(RENDER_MEMORY_WARN)} <span>·</span> {pressure === 'over' ? 'por encima del aviso' : pressure === 'near' ? 'cerca del aviso' : 'holgado'}</>}</p>
            {settings.format === 'wav' ? (
              <p className="render-hint">WAV guarda PCM sin pérdida: la calidad no cambia el archivo, solo la duración y el audio incluido.</p>
            ) : (
              <div className="render-quality-list">
                {qualities.map(row => (
                  <button key={row.quality} type="button" aria-pressed={settings.quality === row.quality} onClick={() => p.onSettings({ quality: row.quality, bitrateMbps: null })} title={`${row.label}: ${formatBytes(row.bytes)} estimados`}>
                    <span>{row.label}</span>
                    <span className="render-quality-bar"><i style={{ width: `${Math.max(4, row.share * 100)}%` }} /></span>
                    <b>{formatBytes(row.bytes)}</b>
                  </button>
                ))}
              </div>
            )}
            <p className="render-hint">Estimación orientativa: el peso real depende del contenido. El tiempo se calcula con tu último render en este equipo.</p>
          </section>
        </aside>
      </div>

      {p.progress && (
        <section className="render-progress" aria-label="Progreso de renderizado">
          <div className="render-ring" role="progressbar" aria-label="Progreso de renderizado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <circle className="track" cx="32" cy="32" r="26" />
              <circle className="value" cx="32" cy="32" r="26" strokeDasharray={2 * Math.PI * 26} strokeDashoffset={2 * Math.PI * 26 * (1 - percent / 100)} />
            </svg>
            <b>{Math.round(percent)}%</b>
          </div>
          <div className="render-progress-main">
            <div className="render-progress-head">
              <strong>{p.rendering ? (p.progress.stage === 'preparando' ? 'Preparando los medios' : p.progress.stage === 'video' ? 'Componiendo y codificando vídeo' : p.progress.stage === 'audio' ? 'Mezclando y codificando audio' : 'Finalizando el archivo') : 'Render detenido'}</strong>
              <span>{p.progress.done} / {p.progress.total || 0} fotogramas</span>
            </div>
            <div className="render-stages">
              {STAGES.map((stage, index) => ({ stage, index })).filter(({ stage }) => stage.id !== 'video' || wantsVideo).map(({ stage, index }) => (
                <span key={stage.id} className={`render-stage ${index < stageIndex ? 'done' : index === stageIndex && p.rendering ? 'active' : ''}`}>{stage.label}</span>
              ))}
            </div>
          </div>
          <dl className="render-progress-stats">
            <div><dt>Velocidad</dt><dd>{p.progress.rate > 0 ? `${one(p.progress.rate)} fps` : '—'}</dd></div>
            <div><dt>Transcurrido</dt><dd>{formatDuration(p.progress.elapsedMs / 1000)}</dd></div>
            <div><dt>Restante</dt><dd>{p.rendering && p.progress.etaMs > 0 && p.progress.done > 0 ? `≈ ${formatDuration(p.progress.etaMs / 1000)}` : '—'}</dd></div>
            <div><dt>Escrito</dt><dd>{p.progress.bytes > 0 ? formatBytes(p.progress.bytes) : '—'}</dd></div>
          </dl>
        </section>
      )}

      <footer className="render-footer">
        <p className="export-status" role="status"><Info size={12} aria-hidden="true" /> {p.status}</p>
        <div className="dialog-actions">
          {p.rendering ? (
            <button type="button" className="render-cancel" onClick={p.onCancel}>Cancelar renderización</button>
          ) : (
            <button type="button" className="render-cta" onClick={p.onRender} disabled={!canRender} title={errors ? 'Corrige los bloqueos del diagnóstico antes de exportar' : !formatReady ? 'El formato elegido no está disponible en este navegador' : p.destination === 'file' ? 'Elegir el archivo y renderizar en él, sin límite de tamaño' : 'Renderizar y descargar el archivo'}>
              <Download size={15} aria-hidden="true" /> {p.destination === 'file' ? 'Renderizar y guardar' : 'Renderizar y descargar'}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
