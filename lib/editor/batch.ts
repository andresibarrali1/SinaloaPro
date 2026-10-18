// Lote de renderizado: la cola de trabajos de VEGAS 15.
//
// VEGAS trae un script, «Batch Render» (`Script Menu/Batch Render.cs`), que permite elegir varias plantillas de
// render a la vez y renderizar el proyecto (o cada región) una vez por plantilla, en serie. El nombre de cada
// archivo es el nombre base más el tipo de archivo y la plantilla, y los caracteres que Windows no admite se
// sustituyen por guiones.
//
// Aquí el equivalente es una cola: se preparan trabajos con los ajustes del diálogo de renderizado, se ven en
// una lista con su estado y se renderizan uno tras otro. Este módulo es lógica pura (sin navegador ni códecs)
// para poder probarla con casos concretos: nombres, etiquetas, resolución de ámbitos, duplicados y resumen.
import { Project, endTime, uid } from './project';
import { ExportFormat, ExportSettings, plannedFrames, resolveRange } from './export';

export type BatchStatus = 'pendiente' | 'renderizando' | 'hecho' | 'error' | 'cancelado';

export type BatchJob = {
  id: string;
  // Etiqueta legible del trabajo (formato, tamaño, velocidad y ámbito).
  label: string;
  settings: ExportSettings;
  status: BatchStatus;
  // Nombre del archivo que se descargará al terminar.
  fileName: string;
  frames: number;
  done: number;
  bytes: number;
  elapsedMs: number;
  error?: string;
  // Cuando el trabajo es «una pista de audio sola» (el script «Render Audio Tracks.cs» de VEGAS), aquí va el
  // identificador de esa pista: al renderizar se silencian las demás y sale un archivo por pista.
  onlyTrackId?: string;
  trackName?: string;
};

export type BatchPlan = { jobs: BatchJob[]; problems: string[] };

export const BATCH_STATUS_LABEL: Record<BatchStatus, string> = {
  pendiente: 'En espera',
  renderizando: 'Renderizando',
  hecho: 'Hecho',
  error: 'Error',
  cancelado: 'Cancelado',
};

export const FORMAT_LABEL: Record<ExportFormat, string> = { mp4: 'MP4', webm: 'WebM', wav: 'WAV' };

// Caracteres que Windows no admite en un nombre de archivo, más los que se ven mal en cualquier sistema.
const INVALID_FILE_CHARS = /[\\/:*?"<>|\u00d7\u00b7]/g;

// Nombre de archivo seguro, con el criterio del script de VEGAS: los caracteres prohibidos pasan a guion. Se
// añaden «×» y «·» porque se usan en las etiquetas y no son portables en un nombre de archivo.
export function safeFileName(name: string) {
  const cleaned = name.replace(INVALID_FILE_CHARS, '-').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s.-]+|[\s.-]+$/g, '');
  return cleaned || 'sin-nombre';
}

// Velocidad de fotogramas en corto: 30 en lugar de 30,000; 29,97 para las fraccionales.
const shortRate = (fps: { num: number; den: number }) => {
  const value = fps.num / fps.den;
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',');
};

// Etiqueta del trabajo, como las que muestra el diálogo de VEGAS al elegir plantillas.
export function jobLabel(settings: ExportSettings) {
  const scope = settings.scope === 'range' ? ' · tramo' : '';
  if (settings.format === 'wav') return `WAV solo audio${scope}`;
  return `${FORMAT_LABEL[settings.format]} ${settings.width}x${settings.height} ${shortRate(settings.fps)} fps${scope}`;
}

// Nombre del archivo: nombre del proyecto, etiqueta y extensión, todo saneado.
export function fileNameFor(projectName: string, settings: ExportSettings) {
  return `${safeFileName(projectName)}--${safeFileName(jobLabel(settings))}.${settings.format}`;
}

// Un nombre que no choque con los ya usados: se numera antes de la extensión, como el «[índice]» que usa el
// script de VEGAS al renderizar varias regiones.
export function uniqueFileName(base: string, taken: string[]) {
  if (!taken.includes(base)) return base;
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const extension = dot > 0 ? base.slice(dot) : '';
  for (let index = 2; ; index++) {
    const candidate = `${stem}[${index}]${extension}`;
    if (!taken.includes(candidate)) return candidate;
  }
}

// Motivo por el que un trabajo no se puede preparar. Devuelve null cuando está bien.
export function settingsProblem(project: Project, settings: ExportSettings, can?: Record<ExportFormat, boolean>): string | null {
  if (!settings.includeVideo && !settings.includeAudio) return 'Activa al menos una salida: video o audio.';
  if (endTime(project) <= 0 && settings.includeVideo) return 'El proyecto no tiene nada que renderizar todavía.';
  if (can && !can[settings.format]) return `Este navegador no puede codificar ${FORMAT_LABEL[settings.format]}. Prueba otro formato.`;
  if (settings.scope === 'range') {
    const range = resolveRange(project, settings);
    if (!project.region) return 'El trabajo usa el tramo y no hay ninguno marcado.';
    if (range.end <= range.start) return 'El tramo del trabajo está vacío.';
  }
  return null;
}

// Añade trabajos a la cola resolviendo el nombre, el ámbito y los fotogramas de cada uno. No modifica la lista
// recibida: devuelve una lista nueva, que es lo que espera el estado de React.
export function appendJobs(jobs: BatchJob[], project: Project, settingsList: ExportSettings[], can?: Record<ExportFormat, boolean>): BatchJob[] {
  const next = [...jobs];
  for (const settings of settingsList) {
    if (settingsProblem(project, settings, can)) continue;
    const range = resolveRange(project, settings);
    next.push({
      id: uid(),
      label: jobLabel(settings),
      settings: { ...settings, fps: { ...settings.fps } },
      status: 'pendiente',
      fileName: uniqueFileName(fileNameFor(project.name, settings), next.map(job => job.fileName)),
      frames: plannedFrames(settings.fps, range).frames,
      done: 0,
      bytes: 0,
      elapsedMs: 0,
    });
  }
  return next;
}

// Las variantes que ofrece el botón «Añadir las plantillas disponibles», con el mismo espíritu que la lista de
// plantillas del script de VEGAS: alta, media y audio solo, cada una en los formatos que el motor admita. La
// velocidad y el ámbito son los del diálogo, para que el lote no cambie lo que el usuario ya eligió.
export const BATCH_VARIANTS: { id: string; label: string; patch: Partial<ExportSettings> }[] = [
  { id: 'mp4-1080', label: 'MP4 · 1080p · Alta', patch: { format: 'mp4', width: 1920, height: 1080, quality: 'high', includeVideo: true, includeAudio: true, bitrateMbps: null } },
  { id: 'mp4-720', label: 'MP4 · 720p · Media', patch: { format: 'mp4', width: 1280, height: 720, quality: 'medium', includeVideo: true, includeAudio: true, bitrateMbps: null } },
  { id: 'webm-720', label: 'WebM · 720p · Media', patch: { format: 'webm', width: 1280, height: 720, quality: 'medium', includeVideo: true, includeAudio: true, bitrateMbps: null } },
  { id: 'wav', label: 'WAV · solo audio', patch: { format: 'wav', quality: 'high', includeVideo: false, includeAudio: true, bitrateMbps: null } },
];

// Ajustes de las plantillas disponibles para este motor, partiendo de los ajustes actuales del diálogo.
export function variantSettings(base: ExportSettings, can: Record<ExportFormat, boolean>): ExportSettings[] {
  return BATCH_VARIANTS.filter(variant => can[(variant.patch.format ?? base.format) as ExportFormat]).map(variant => ({ ...base, ...variant.patch, fps: { ...base.fps } }));
}

// Una salida por pista de audio, como el script «Render Audio Tracks.cs» de VEGAS: un WAV por cada pista de
// audio del proyecto, con el nombre de la pista en el archivo. La velocidad y el ámbito son los del diálogo, y
// se respeta el orden de las pistas. Es lógica pura: los trabajos se añaden a la cola, no se renderiza nada.
export function audioTrackJobs(project: Project, base: ExportSettings, can?: Record<ExportFormat, boolean>): BatchJob[] {
  if (can && !can.wav) return [];
  const tracks = project.tracks.filter(track => track.kind === 'audio');
  if (!tracks.length) return [];
  const settings: ExportSettings = { ...base, format: 'wav', includeVideo: false, includeAudio: true, bitrateMbps: null, fps: { ...base.fps } };
  const jobs = appendJobs([], project, [settings], can);
  if (!jobs.length) return [];
  const template = jobs[0];
  const used: string[] = [];
  return tracks.map(track => {
    const stem = `${safeFileName(project.name)}--Audio ${safeFileName(track.name)}`;
    const fileName = uniqueFileName(`${stem}.wav`, used);
    used.push(fileName);
    return {
      ...template,
      id: uid(),
      label: `WAV · solo la pista «${track.name}»`,
      fileName,
      onlyTrackId: track.id,
      trackName: track.name,
    };
  });
}
// El proyecto que se renderiza para un trabajo: si el trabajo es de una pista sola, las demás quedan en
// silencio (el solo y el silencio del mezclador ya se respetan al mezclar).
export function jobProject(project: Project, job: BatchJob): Project {
  if (!job.onlyTrackId) return project;
  return { ...project, tracks: project.tracks.map(track => track.kind === 'audio' ? { ...track, mute: track.id !== job.onlyTrackId, solo: false } : track) };
}

// Prepara una cola entera desde cero, informando de lo que no se pudo añadir.
export function planBatch(project: Project, settingsList: ExportSettings[], can?: Record<ExportFormat, boolean>): BatchPlan {
  const problems: string[] = [];
  const usable: ExportSettings[] = [];
  for (const settings of settingsList) {
    const problem = settingsProblem(project, settings, can);
    if (problem) problems.push(`${jobLabel(settings)}: ${problem}`);
    else usable.push(settings);
  }
  return { jobs: appendJobs([], project, usable, can), problems };
}

// Resumen de la cola para la barra de estado del diálogo.
export function summarize(jobs: BatchJob[]) {
  const count = (status: BatchStatus) => jobs.filter(job => job.status === status).length;
  return {
    total: jobs.length,
    pending: count('pendiente'),
    running: count('renderizando'),
    done: count('hecho'),
    failed: count('error'),
    cancelled: count('cancelado'),
    // Los fotogramas solo cuentan en los trabajos con vídeo: un WAV no tiene fotogramas que renderizar.
    frames: jobs.filter(job => job.status !== 'cancelado' && job.settings.includeVideo).reduce((total, job) => total + job.frames, 0),
    bytes: jobs.reduce((total, job) => total + job.bytes, 0),
  };
}

// Primer trabajo por hacer: al reintentar entran también los que fallaron.
export function nextJob(jobs: BatchJob[]) {
  return jobs.find(job => job.status === 'pendiente' || job.status === 'error');
}
