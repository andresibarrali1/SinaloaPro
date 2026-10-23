import type { ExportSettings } from './export';

type RenderPreset = { id: string; label: string; settings: Partial<ExportSettings> };
function video(id: string, label: string, width: number, height: number, fps: number, format: 'mp4'|'webm' = 'mp4'): RenderPreset {
 return {id,label,settings:{width,height,fps:{num:fps,den:1},format,quality:'high',bitrateMbps:null,includeVideo:true,includeAudio:true}};
}
// Dimensions and frame rates only; the exporter still checks actual encoder availability.
export const RENDER_PRESETS: RenderPreset[] = [
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
