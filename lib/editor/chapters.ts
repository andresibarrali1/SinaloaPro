// Exportar los marcadores del proyecto: capítulos (lo que hace «Export Chapters.cs» de VEGAS Pro 15) y
// subtítulos (el caso de uso de «Export Regions as Subtitles.cs»).
//
// El script de VEGAS escribe TXT y CSV con la **posición** del marcador y se deja el nombre por el camino; el
// XML sí guarda identificador y timecode. Aquí los tres formatos llevan el nombre, se añade la lista de
// capítulos que entiende YouTube (que exige que la primera marca sea 00:00) y se pueden sacar los mismos
// marcadores como subtítulos `.srt`, con cada texto desde su marca hasta la siguiente.
import { FPS } from './project';
import { formatTimecode, TimecodeFormat } from './timecode';
import { buildSrt, Cue } from './speech';

export type Marker = { id: string; time: number; name: string };
export type MarkerExportFormat = 'txt' | 'youtube' | 'csv' | 'xml' | 'srt';

export const MARKER_FORMATS: { value: MarkerExportFormat; label: string; extension: string; note: string }[] = [
  { value: 'txt', label: 'Lista de capítulos (TXT)', extension: 'txt', note: 'Timecode y nombre, una línea por marcador. Mejora al script de VEGAS, que en TXT solo escribe la posición.' },
  { value: 'youtube', label: 'Capítulos para YouTube (TXT)', extension: 'txt', note: 'Formato que YouTube reconoce en la descripción: «00:00 Nombre». La primera marca tiene que ser 00:00; si el proyecto no empieza con un marcador en cero, se añade uno.' },
  { value: 'csv', label: 'Hoja de cálculo (CSV)', extension: 'csv', note: 'Cabecera y una fila por marcador: timecode, segundos y nombre.' },
  { value: 'xml', label: 'Lista XML', extension: 'xml', note: 'Como el XML del script de VEGAS (identificador y timecode) más el nombre.' },
  { value: 'srt', label: 'Subtítulos (SRT)', extension: 'srt', note: 'Cada marcador es un subtítulo que dura hasta el siguiente (el último, cinco segundos).' },
];

const TICKS = 705600000;
export const markerFormatById = (id: string) => MARKER_FORMATS.find(format => format.value === id) ?? MARKER_FORMATS[0];
// Los marcadores en orden y sin repetir el mismo instante dos veces.
export function sortedMarkers(markers: Marker[]): Marker[] {
  const seen = new Set<number>();
  return [...markers]
    .sort((a, b) => a.time - b.time)
    .filter(marker => (seen.has(marker.time) ? false : (seen.add(marker.time), true)));
}
// Escapado mínimo para XML y CSV.
const xmlEscape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const csvField = (text: string) => /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
// Duración del último subtítulo cuando no hay otro marcador después.
export const LAST_CUE_SECONDS = 5;

// Un marcador sin nombre se llama «Marcador n», como en la línea de tiempo.
const nameOf = (marker: Marker, index: number) => marker.name?.trim() || `Marcador ${index + 1}`;

// Los marcadores como subtítulos: de cada marca a la siguiente.
export function markersToCues(markers: Marker[], durationTicks = 0): Cue[] {
  const sorted = sortedMarkers(markers);
  return sorted.map((marker, index) => {
    const start = marker.time / TICKS;
    const next = sorted[index + 1];
    const end = next ? next.time / TICKS : Math.max(start + .5, Math.min(durationTicks / TICKS || start + LAST_CUE_SECONDS, start + LAST_CUE_SECONDS));
    return { start, end: Math.max(start + .5, end), text: nameOf(marker, index) };
  });
}

export function buildMarkerExport(markers: Marker[], format: MarkerExportFormat, fps: FPS, timecodeFormat: TimecodeFormat = 'non-drop', durationTicks = 0): string {
  const sorted = sortedMarkers(markers);
  const tc = (time: number) => formatTimecode(time, fps, timecodeFormat);
  switch (format) {
    case 'txt':
      // Cabecera con almohadilla para que se vea que es una lista, como la del script, pero con el nombre.
      return [`# Capítulos de Sinaloa Pro · ${sorted.length} marcador(es)`, ...sorted.map((marker, index) => `${tc(marker.time)}\t${nameOf(marker, index)}`)].join('\n') + '\n';
    case 'youtube': {
      // YouTube exige que la primera marca sea 00:00 y al menos tres capítulos de 10 s o más.
      const lines = sorted.map((marker, index) => {
        const seconds = marker.time / TICKS;
        const hours = Math.floor(seconds / 3600);
        const stamp = `${hours ? `${hours}:` : ''}${String(Math.floor(seconds / 60) % 60).padStart(hours ? 2 : 1, '0')}:${String(Math.floor(seconds) % 60).padStart(2, '0')}`;
        return `${stamp} ${nameOf(marker, index)}`;
      });
      if (sorted.length && sorted[0].time > 0) lines.unshift('0:00 Inicio');
      if (!sorted.length) return '0:00 Inicio\n';
      return lines.join('\n') + '\n';
    }
    case 'csv':
      return ['timecode,segundos,nombre', ...sorted.map((marker, index) => `${tc(marker.time)},${(marker.time / TICKS).toFixed(3)},${csvField(nameOf(marker, index))}`)].join('\n') + '\n';
    case 'xml':
      return ['<?xml version="1.0" encoding="UTF-8"?>', '<Chapters>',
        ...sorted.map((marker, index) => `  <chapter ID="${index}" Time-code="${xmlEscape(tc(marker.time))}" Label="${xmlEscape(nameOf(marker, index))}" />`),
        '</Chapters>', ''].join('\n');
    case 'srt':
    default:
      return buildSrt(markersToCues(sorted, durationTicks));
  }
}
