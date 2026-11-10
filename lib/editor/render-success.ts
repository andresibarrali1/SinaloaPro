// Resumen del renderizado para la pantalla de confirmación.
//
// Vive aparte del componente para poder probarlo: los textos, el tamaño, la duración y la ruta del
// archivo son funciones puras. Nada de esto abre el Finder: un navegador no puede hacerlo desde una
// página, así que la pantalla ofrece la ruta para copiarla y explica dónde está la carpeta.
import type { ExportFormat } from './export';
// El formato de tamaños y duraciones se comparte con la ventana de renderizado, que enseña las mismas
// cifras antes de exportar. Se reexporta para no romper a quien ya las importaba de aquí.
import { formatBytes, formatDuration } from './render-details';
export { formatBytes, formatDuration } from './render-details';

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
  /** El archivo se escribió directamente donde el usuario lo eligió (sin pasar por la carpeta de descargas). */
  savedToFile?: boolean;
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
  savedToFile?: boolean;
}): RenderOutcome {
  return {
    fileName: input.fileName,
    format: input.format,
    bytes: input.bytes,
    frames: input.frames,
    elapsedMs: input.elapsedMs,
    durationSeconds: Math.round(Math.max(0, input.endSeconds - input.startSeconds) * 1000) / 1000,
    files: input.files ?? 1,
    ...(input.savedToFile ? { savedToFile: true } : {}),
  };
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

/**
 * Cuando el render se escribió directamente en el archivo que el usuario eligió, la carpeta de descargas no
 * pinta nada: el navegador tampoco comparte la ruta completa del archivo elegido.
 */
export const SAVED_FILE_NOTE = 'El archivo se escribió directamente donde lo elegiste, sin pasar por la carpeta de descargas. El navegador no comparte su ruta completa: búscalo por su nombre desde la carpeta que hayas abierto en el diálogo del sistema.';
