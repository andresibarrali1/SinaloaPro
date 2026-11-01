// Resumen del renderizado para la pantalla de confirmación.
//
// Vive aparte del componente para poder probarlo: los textos, el tamaño, la duración y la ruta del
// archivo son funciones puras. Nada de esto abre el Finder: un navegador no puede hacerlo desde una
// página, así que la pantalla ofrece la ruta para copiarla y explica dónde está la carpeta.
import type { ExportFormat } from './export';

export type RenderOutcome = {
  fileName: string;
  format: ExportFormat;
  bytes: number;
  frames: number;
  elapsedMs: number;
  /** Duración del material renderizado, en segundos. */
  durationSeconds: number;
  /** Archivos descargados de una vez: 1 en un render normal, N al terminar un lote. */
  files: number;
};

export function makeOutcome(input: {
  fileName: string;
  format: ExportFormat;
  bytes: number;
  frames: number;
  elapsedMs: number;
  startSeconds: number;
  endSeconds: number;
  files?: number;
}): RenderOutcome {
  return {
    fileName: input.fileName,
    format: input.format,
    bytes: input.bytes,
    frames: input.frames,
    elapsedMs: input.elapsedMs,
    durationSeconds: Math.round(Math.max(0, input.endSeconds - input.startSeconds) * 1000) / 1000,
    files: input.files ?? 1,
  };
}

/** «12,4 MB», «980 kB». Un decimal basta para saber qué se descargó. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0).replace('.', ',')} kB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1).replace('.', ',')} MB`;
}

/** «0:07,3» a partir de segundos, con la coma decimal del español. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const minutes = Math.floor(total / 60);
  const rest = total - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, '0').replace('.', ',')}`;
}

export function renderTitle(outcome: RenderOutcome): string {
  return outcome.files > 1 ? `${outcome.files} archivos renderizados` : 'Vídeo renderizado';
}

/** Las líneas de detalle que se leen bajo el título. */
export function renderDetails(outcome: RenderOutcome): string[] {
  if (outcome.files > 1) {
    return [
      `${formatBytes(outcome.bytes)} en total`,
      `${outcome.files} archivos, uno por trabajo de la cola`,
    ];
  }
  const lines = [
    `${outcome.format.toUpperCase()} · ${formatBytes(outcome.bytes)} · ${formatDuration(outcome.durationSeconds)} de vídeo`,
    `${outcome.frames} fotograma${outcome.frames === 1 ? '' : 's'} en ${formatDuration(outcome.elapsedMs / 1000)}`,
  ];
  const seconds = outcome.elapsedMs / 1000;
  if (seconds > 0) {
    lines.push(`${(outcome.frames / seconds).toFixed(1).replace('.', ',')} fps de render`);
  }
  return lines;
}

export type DownloadsFolder = { label: string; path: string; hint: string };

/**
 * Dónde deja el navegador el archivo. Se usa el nombre real de la carpeta (Downloads), que es el que
 * acepta el buscador del Finder o del Explorador; en español el Finder lo muestra como «Descargas».
 */
export function downloadsFolder(platform: string): DownloadsFolder {
  if (platform === 'win32') {
    return { label: 'Descargas', path: '%USERPROFILE%\\Downloads', hint: 'En el Explorador: Win + E, pega la ruta en la barra superior y pulsa Enter.' };
  }
  if (platform === 'darwin') {
    return { label: 'Descargas', path: '~/Downloads', hint: 'En el Finder: Mayús + Comando + G, pega la ruta y pulsa Enter.' };
  }
  return { label: 'Descargas', path: '~/Downloads', hint: 'En el gestor de archivos: Ctrl + L, pega la ruta y pulsa Enter.' };
}

/** Ruta completa del archivo, lista para pegar en el buscador del sistema. */
export function fileLocation(outcome: RenderOutcome, platform: string): string {
  const folder = downloadsFolder(platform);
  const separator = platform === 'win32' ? '\\' : '/';
  return `${folder.path}${separator}${outcome.fileName}`;
}

/**
 * Texto fijo de la pantalla. Un navegador no expone una API para abrir el Finder o el Explorador, y
 * decirlo es más útil que un botón que no hace nada.
 */
export const FOLDER_NOTE = 'El navegador no puede abrir la carpeta por su cuenta: copia la ruta y pégala en el buscador del sistema.';
