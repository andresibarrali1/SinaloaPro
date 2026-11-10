// Escritura directa en disco con la File System Access API: el render se escribe en el archivo que el usuario
// elige mientras se codifica, así que el vídeo no pasa por la memoria del navegador y no tiene tope de tamaño.
// Donde la API no existe (Firefox, Safari) el editor sigue generando el archivo en memoria y lo descarga: eso se
// dice en la ventana de renderizado en vez de fingir que hay escritura directa.
import type { ExportFormat } from './export';

/** Mismo tipo que `StreamTarget` de mediabunny: cada trozo dice en qué posición del archivo va. */
export type RenderWritable = WritableStream<{ type: 'write'; data: Uint8Array<ArrayBuffer>; position: number }>;
export type RenderFileHandle = { name: string; createWritable: () => Promise<RenderWritable> };
export type RenderFolderHandle = { name: string; getFileHandle: (name: string, options?: { create?: boolean }) => Promise<RenderFileHandle> };
type PickerOptions = { suggestedName?: string; types?: { description: string; accept: Record<string, string[]> }[] };
export type FilePickerScope = {
  showSaveFilePicker?: (options: PickerOptions) => Promise<RenderFileHandle>;
  showDirectoryPicker?: (options?: { mode?: 'readwrite' }) => Promise<RenderFolderHandle>;
};

/** Lo que el diálogo del sistema propone para cada formato. */
export const FILE_TYPES: Record<ExportFormat, { description: string; accept: Record<string, string[]> }> = {
  mp4: { description: 'Vídeo MP4', accept: { 'video/mp4': ['.mp4'] } },
  webm: { description: 'Vídeo WebM', accept: { 'video/webm': ['.webm'] } },
  wav: { description: 'Audio WAV', accept: { 'audio/wav': ['.wav'] } },
};

const pickerScope = (scope?: unknown) => (scope ?? globalThis) as FilePickerScope;
/** ¿Se puede escribir el render directamente en un archivo? Solo lo expone Chromium (Chrome, Edge…). */
export const canSaveRenderToFile = (scope?: unknown) => typeof pickerScope(scope).showSaveFilePicker === 'function';
/** ¿Se puede elegir una carpeta para volcar los archivos de un lote? */
export const canPickRenderFolder = (scope?: unknown) => typeof pickerScope(scope).showDirectoryPicker === 'function';

const cancelled = (error: unknown): boolean => {
  const name = (error as { name?: string } | null)?.name;
  return name === 'AbortError';
};

/** Pide el archivo de salida. Devuelve null si el usuario cancela el diálogo del sistema. */
export async function chooseRenderFile(fileName: string, format: ExportFormat, scope?: unknown): Promise<RenderFileHandle | null> {
  const target = pickerScope(scope);
  const picker = target.showSaveFilePicker;
  if (typeof picker !== 'function') return null;
  try {
    return await picker.call(target, { suggestedName: fileName, types: [FILE_TYPES[format]] });
  } catch (error) {
    if (cancelled(error)) return null;
    throw error;
  }
}

/** Pide una carpeta para el lote. Devuelve null si el usuario cancela. */
export async function chooseRenderFolder(scope?: unknown): Promise<RenderFolderHandle | null> {
  const target = pickerScope(scope);
  const picker = target.showDirectoryPicker;
  if (typeof picker !== 'function') return null;
  try {
    return await picker.call(target, { mode: 'readwrite' });
  } catch (error) {
    if (cancelled(error)) return null;
    throw error;
  }
}

/** Abre el archivo `name` dentro de la carpeta elegida para el lote, creándolo si hace falta. */
export async function folderFile(folder: RenderFolderHandle, name: string): Promise<RenderFileHandle> {
  return await folder.getFileHandle(name, { create: true });
}
