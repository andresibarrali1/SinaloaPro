import type { ExportFormat, ExportQuality, ExportSettings } from './export';

type RenderPreset = { id: string; label: string; settings: Partial<ExportSettings> };
function video(id: string, label: string, width: number, height: number, fps: number, format: 'mp4'|'webm' = 'mp4'): RenderPreset {
 return {id,label,settings:{width,height,fps:{num:fps,den:1},format,quality:'high',bitrateMbps:null,includeVideo:true,includeAudio:true}};
}
// Dimensions and frame rates only; the exporter still checks actual encoder availability.
export const RENDER_PRESETS: RenderPreset[] = [
 video('mp4-720','MP4 · 720p 30 · Ligera',1280,720,30),
 video('mp4-1080-60','MP4 · 1080p 60 · Alta',1920,1080,60),
 video('mp4-1080-24','MP4 · Cine 1080p 24 · Alta',1920,1080,24),
 video('mp4-1440','MP4 · 1440p 30 · Alta',2560,1440,30),
 video('mp4-2160','MP4 · 4K UHD 30 · Alta',3840,2160,30),
 video('mp4-2160-60','MP4 · 4K UHD 60 · Alta',3840,2160,60),
 video('mp4-vertical','MP4 · Reels / Shorts / TikTok · 1080×1920 · 30',1080,1920,30),
 video('mp4-vertical-60','MP4 · Vertical · 1080×1920 · 60',1080,1920,60),
 video('mp4-square','MP4 · Cuadrado · 1080×1080 · 30',1080,1080,30),
 video('mp4-portrait','MP4 · Retrato 4:5 · 1080×1350 · 30',1080,1350,30),
 video('webm-1080','WebM · 1080p 30 · Alta',1920,1080,30,'webm'),
 video('webm-1080-60','WebM · 1080p 60 · Alta',1920,1080,60,'webm'),
 video('webm-vertical','WebM · Vertical · 1080×1920 · 30',1080,1920,30,'webm'),
];

// ---------------------------------------------------------------------------------------------------
// Plantillas propias: los ajustes que el usuario guarda con un nombre desde la ventana de renderizado.
// Viven en el almacén local del navegador (nunca en un servidor) y se validan al leerlas, porque el
// contenido del almacén lo puede haber escrito una versión anterior o cualquier otra pestaña.
// ---------------------------------------------------------------------------------------------------

export const SAVED_PRESETS_KEY = 'sinaloa.render.presets.v1';
export const MAX_SAVED_PRESETS = 8;
const FORMATS: ExportFormat[] = ['mp4', 'webm', 'wav'];
const QUALITIES: ExportQuality[] = ['draft', 'medium', 'high', 'master'];

export type SavedRenderPreset = { id: string; name: string; settings: Partial<ExportSettings>; savedAt: number };
export type PresetStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void };

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Solo se aceptan los campos que describen una salida; el ámbito depende del proyecto y no se guarda. */
export function sanitizePresetSettings(value: unknown): Partial<ExportSettings> | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const patch: Partial<ExportSettings> = {};
  if (isFiniteNumber(raw.width) && raw.width >= 16 && raw.width <= 3840) patch.width = Math.round(raw.width / 2) * 2;
  if (isFiniteNumber(raw.height) && raw.height >= 16 && raw.height <= 2160) patch.height = Math.round(raw.height / 2) * 2;
  if (raw.fps && typeof raw.fps === 'object') {
    const fps = raw.fps as Record<string, unknown>;
    if (isFiniteNumber(fps.num) && isFiniteNumber(fps.den) && fps.num > 0 && fps.den > 0) patch.fps = { num: fps.num, den: fps.den };
  }
  if (typeof raw.format === 'string' && FORMATS.includes(raw.format as ExportFormat)) patch.format = raw.format as ExportFormat;
  if (typeof raw.quality === 'string' && QUALITIES.includes(raw.quality as ExportQuality)) patch.quality = raw.quality as ExportQuality;
  if (raw.bitrateMbps === null) patch.bitrateMbps = null;
  else if (isFiniteNumber(raw.bitrateMbps) && raw.bitrateMbps > 0 && raw.bitrateMbps <= 100) patch.bitrateMbps = raw.bitrateMbps;
  if (typeof raw.includeVideo === 'boolean') patch.includeVideo = raw.includeVideo;
  if (typeof raw.includeAudio === 'boolean') patch.includeAudio = raw.includeAudio;
  return Object.keys(patch).length ? patch : null;
}

let presetCounter = 0;
function presetId(): string {
  const random = globalThis.crypto?.randomUUID?.();
  if (random) return `p-${random.slice(0, 8)}`;
  presetCounter += 1;
  return `p-${Date.now().toString(36)}-${presetCounter}`;
}

export function presetFromSettings(name: string, settings: ExportSettings, id = presetId(), savedAt = Date.now()): SavedRenderPreset {
  return {
    id,
    name: name.trim().replace(/\s+/g, ' ').slice(0, 40) || 'Sin nombre',
    savedAt,
    settings: {
      width: settings.width,
      height: settings.height,
      fps: { ...settings.fps },
      format: settings.format,
      quality: settings.quality,
      bitrateMbps: settings.bitrateMbps,
      includeVideo: settings.includeVideo,
      includeAudio: settings.includeAudio,
    },
  };
}

export function loadSavedPresets(storage: PresetStorage | null | undefined): SavedRenderPreset[] {
  if (!storage) return [];
  try {
    const text = storage.getItem(SAVED_PRESETS_KEY);
    if (!text) return [];
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return [];
    const presets: SavedRenderPreset[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const raw = item as Record<string, unknown>;
      if (typeof raw.id !== 'string' || typeof raw.name !== 'string') continue;
      const settings = sanitizePresetSettings(raw.settings);
      if (!settings) continue;
      presets.push({ id: raw.id, name: raw.name.slice(0, 40), settings, savedAt: isFiniteNumber(raw.savedAt) ? raw.savedAt : 0 });
      if (presets.length >= MAX_SAVED_PRESETS) break;
    }
    return presets;
  } catch {
    return [];
  }
}

export function writeSavedPresets(list: SavedRenderPreset[], storage: PresetStorage | null | undefined): void {
  if (!storage) return;
  try {
    storage.setItem(SAVED_PRESETS_KEY, JSON.stringify(list.slice(0, MAX_SAVED_PRESETS)));
  } catch {
    // Almacén lleno o bloqueado: la lista sigue viva en memoria durante esta sesión.
  }
}

/** Guarda o reemplaza por nombre, con la más reciente primero y un tope de ocho. */
export function upsertSavedPreset(list: SavedRenderPreset[], preset: SavedRenderPreset): SavedRenderPreset[] {
  const withoutSameName = list.filter(item => item.name.toLowerCase() !== preset.name.toLowerCase());
  return [preset, ...withoutSameName].slice(0, MAX_SAVED_PRESETS);
}

export function removeSavedPreset(list: SavedRenderPreset[], id: string): SavedRenderPreset[] {
  return list.filter(item => item.id !== id);
}
