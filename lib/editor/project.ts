import { type CropFrame, defaultCropFrame, interpolateCropFrame } from './crop-frame';
import {validateProject} from "./validation";
export const TICKS = 705600000;
export type FPS = { num: number; den: number };
export const uid = () => crypto.randomUUID();
export const ticks = (seconds: number) => Math.round(seconds * TICKS);
export const seconds = (time: number) => time / TICKS;
export const frameTicks = (fps: FPS) => TICKS * fps.den / fps.num;
export const quantize = (time: number, fps: FPS) => Math.max(0, Math.round(time / frameTicks(fps)) * frameTicks(fps));
// Pose de un evento o de una pista. Los tres últimos campos son el 3D de VEGAS 15 («Movimiento de
// pista 3D»): giro sobre los ejes X e Y y distancia al plano de proyección. Son opcionales porque los
// proyectos guardados antes de que existiera el 3D no los traen; el valor neutro es 0, 0 y 1 (ver
// lib/editor/threed.ts).
// `pivot` es el centro de giro de la ventana de Panoramización y recorte (el «Rotación → Centro X/Y» de
// VEGAS), en fracciones del fotograma. Sin él, se gira sobre el centro del fotograma, que es el
// comportamiento de siempre.
export type Point = { x: number; y: number };
export type Transform = { x: number; y: number; scale: number; rotation: number; opacity: number; crop: number; rotationX?: number; rotationY?: number; depth?: number; pivot?: Point; cropFrame?: CropFrame };
export const transform = (): Transform => ({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, crop: 0, rotationX: 0, rotationY: 0, depth: 1 });
// Las claves de pose se interpolan como cualquier otra; las que falten se completan con el neutro. El centro
// de giro (`pivot`) no es un número, así que se interpola aparte, en `pose()`.
type PoseNumberKey = 'x'|'y'|'scale'|'rotation'|'opacity'|'crop'|'rotationX'|'rotationY'|'depth';
const POSE_KEYS: PoseNumberKey[] = ['x','y','scale','rotation','opacity','crop','rotationX','rotationY','depth'];
const POSE_NEUTRAL = transform() as Record<PoseNumberKey, number>;
export type CropMask = { left: number; right: number; top: number; bottom: number };
export type CompositeMode = 'normal'|'add'|'screen'|'multiply'|'overlay'|'darken'|'lighten'|'difference';
export type TextAnchor = 'top-left'|'top-center'|'top-right'|'middle-left'|'middle-center'|'middle-right'|'bottom-left'|'bottom-center'|'bottom-right';
// Animaciones de texto: las cinco del plugin «Títulos & Texto» de VEGAS 15 (ninguna, fundido, dos
// desplazamientos y máquina de escribir) más las de plantilla tipo CapCut (aparición con rebote, zoom,
// deslizamientos, rebote y sacudida continuos y karaoke palabra a palabra).
export type TextAnimation = 'none'|'fade'|'scroll-up'|'scroll-left'|'typewriter'|'pop'|'zoom-in'|'slide-up'|'slide-down'|'bounce'|'shake'|'karaoke';
export type TextShadow = { enabled: boolean; color: string; offsetX: number; offsetY: number; blur: number };
export type TextBackground = { color: string; opacity: number; padding: number };
// Modos de interpolación de fotogramas clave de VEGAS 15: en sus recursos aparecen como KeyframeModeLinear,
// Smooth, Sharp, Hold, Fast y Slow (el menú español llama «Brusco» al Sharp). La curva de una clave describe
// cómo va desde ella hasta la siguiente.
export type EaseKind = 'linear'|'smooth'|'sharp'|'hold'|'fast'|'slow';
export const EASE_KINDS: EaseKind[] = ['linear','smooth','sharp','hold','fast','slow'];
export const EASE_LABEL: Record<EaseKind,string> = { linear:'Lineal', smooth:'Suave', sharp:'Brusco', hold:'Mantener', fast:'Rápido', slow:'Lento' };
export const EASE_NOTE: Record<EaseKind,string> = {
  linear: 'El valor cambia a ritmo constante.',
  smooth: 'Entra y sale despacio, con una curva en S.',
  sharp: 'Se queda en el valor anterior y salta al final del tramo.',
  hold: 'Mantiene el valor anterior hasta la clave siguiente, sin interpolar.',
  fast: 'Llega antes: la mayor parte del cambio ocurre al principio.',
  slow: 'Sale más tarde: la mayor parte del cambio ocurre al final.',
};
// `smoothness` es la «Suavidad (%)» del grupo «Interpolación de fotogramas clave» de la ventana de
// Panoramización y recorte: 0 % deja la curva lineal y 100 % la curva en S completa. Solo afecta a las claves
// con curva «Suave»; las demás curvas son las que son.
export function easeValue(kind: EaseKind|undefined, fraction: number, smoothness = 1): number {
  const f = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  const strength = Math.max(0, Math.min(1, Number.isFinite(smoothness) ? smoothness : 1));
  switch (kind) {
    case 'hold': return 0;
    case 'smooth': { const smooth = f * f * (3 - 2 * f); return f + (smooth - f) * strength; }
    case 'sharp': return f * f * f * f;
    case 'fast': return 1 - (1 - f) * (1 - f);
    case 'slow': return f * f;
    default: return f;
  }
}
export type Keyframe = Transform & { time: number; mask?: CropMask; curve?: EaseKind };
// Efectos de vídeo del catálogo de VEGAS 15 que este editor sabe aplicar (ver lib/editor/effects.ts).
export type VideoEffectKind = 'blur'|'blackAndWhite'|'sepia'|'invert'|'chromaKey'|'pixelate'|'mirror'|'border'|'vignette'|'glow';
export type VideoEffect = { id: string; kind: VideoEffectKind; enabled: boolean; amount: number; size: number; color: string; softness: number; horizontal: boolean; vertical: boolean };
// Generadores de medios: el evento de color puede ser liso, degradado, tablero, barras o ruido.
export type GeneratorKind = 'solid'|'gradient'|'checkerboard'|'bars'|'noise';
export type Generator = { kind: GeneratorKind; color: string; color2: string; angle: number; size: number; amount: number };
// Máscara libre (trazado): un polígono en fracciones del fotograma, con pluma y opción de invertirla.
export type MaskPoint = { x: number; y: number };
export type MaskPath = { points: MaskPoint[]; feather: number; invert: boolean };
export const newMaskPath = (): MaskPath => ({ points: [], feather: 0, invert: false });
// Transiciones de VEGAS 15 que este editor reproduce; la transición de un evento es su entrada (ver
// lib/editor/transitions.ts). Las de la ronda 18 salen del catálogo en español del propio complemento
// `sftrans1.dll` (Fundido suave/rápido, Barrido de salida, Círculos centrados, Comprimir verticalmente,
// Persianas en pendiente/superpuestas/torcidas, Acercar y alejar zoom, Espiral exterior) más el despegado de
// página de `sfpagepeel.dll`.
export type TransitionKind = 'dissolve-linear'|'dissolve-slow'|'dissolve-fast'|'dissolve-smooth'|'dissolve-quick'|'wipe-from-left'|'wipe-from-right'|'wipe-from-top'|'wipe-from-bottom'|'wipe-out-left'|'wipe-out-right'|'wipe-out-top'|'wipe-out-bottom'|'gradient-wipe'|'iris-circle'|'iris-diamond'|'blinds-vertical'|'blinds-horizontal'|'blinds-venetian'|'blinds-slanted'|'blinds-stacked'|'blinds-twisted'|'checkerboard'|'slide-from-left'|'slide-from-right'|'slide-from-top'|'slide-from-bottom'|'squeeze-from-left'|'squeeze-from-right'|'squeeze-from-top'|'squeeze-from-bottom'|'zoom-in'|'zoom-out'|'spiral'|'spiral-out'|'page-peel';
export const generator = (kind: GeneratorKind = 'solid', color = '#28688d'): Generator => ({ kind, color, color2: '#101010', angle: 0, size: 24, amount: .5 });
export type Media = { id: string; name: string; size: number; modified: number; kind: 'video'|'audio'|'image'|'subtitle'; duration: number; width: number; height: number; hasAudio: boolean; mime: string; thumbnail?: string; peaks?: number[]; channelPeaks?: number[][]; sourcePath?: string; text?: string };
// Audio: buses (el «Mezclador» de VEGAS, que enruta pistas a un bus A–Z antes del maestro), el maestro y las
// envolventes de volumen y panorámica que se dibujan sobre la pista.
export type AudioPoint = { time: number; value: number };
export type AudioBus = { id: string; name: string; gain: number; pan: number; mute: boolean; solo: boolean; inserts?: AudioEffect[] };
export const newBus = (name: string): AudioBus => ({ id: uid(), name, gain: 1, pan: 0, mute: false, solo: false });
// Valor de una envolvente en un instante: tramos rectos entre puntos y, fuera de ellos, el valor del extremo.
export function envelopeValue(points: AudioPoint[]|undefined, time: number, fallback=1): number {
  if(!points?.length)return fallback;
  const sorted=[...points].sort((a,b)=>a.time-b.time);
  if(time<=sorted[0].time)return sorted[0].value;
  const last=sorted[sorted.length-1];
  if(time>=last.time)return last.value;
  const before=[...sorted].reverse().find(point=>point.time<=time) as AudioPoint;
  const after=sorted.find(point=>point.time>time) as AudioPoint;
  const fraction=(time-before.time)/(after.time-before.time);
  return before.value+(after.value-before.value)*fraction;
}
export function addEnvelopePoint(points: AudioPoint[]|undefined, time: number, value: number): AudioPoint[] {
  const list=(points??[]).filter(point=>Math.abs(point.time-time)>1);
  return [...list,{time,value}].sort((a,b)=>a.time-b.time);
}
export function removeEnvelopePoint(points: AudioPoint[]|undefined, time: number): AudioPoint[] {
  return (points??[]).filter(point=>Math.abs(point.time-time)>1);
}
// Tomas de efectos de audio del catálogo de VEGAS 15 que este editor sabe procesar (ver
// lib/editor/audio-effects.ts). Van en la pista o en el bus, después de sumar sus eventos y antes del
// nivel y del envío al bus siguiente.
export type AudioEffectKind = 'eq'|'compressor'|'limiter'|'gate'|'distortion'|'delay'|'reverb'|'phone';
export type AudioEffect = { id: string; kind: AudioEffectKind; enabled: boolean; amount: number; threshold: number; ratio: number; attack: number; release: number; makeup: number; time: number; feedback: number; damping: number; low: number; mid: number; high: number };
export type Track = { id: string; name: string; kind: 'video'|'audio'; mute: boolean; solo: boolean; gain: number; pan: number; height: number; transform: Transform; composite?: CompositeMode; busId?: string; volumeCurve?: AudioPoint[]; panCurve?: AudioPoint[]; inserts?: AudioEffect[] };
// Modo de re-muestreo del evento, como los tres botones del diálogo «Propiedades» de VEGAS 15. Los nombres
// españoles son los de su tabla de cadenas (idioma 1034 del ejecutable), con los aceleradores quitados.
export type ResampleMode = 'project'|'force'|'off';
export const RESAMPLE_MODES: ResampleMode[] = ['project','force','off'];
export const RESAMPLE_LABEL: Record<ResampleMode,string> = { project:'Utilice el modo Re-muestreo de proyecto', force:'Forzar re-muestreo', off:'Deshabilitar re-muestreo' };
// Qué hace aquí cada interruptor del evento («Modificadores» en VEGAS): los que el motor aplica y los que solo
// se anotan. Se muestra en el diálogo para no prometer nada que el motor no haga.
export const EVENT_SWITCH_NOTE: Record<string,string> = {
 muted: 'Silencia el evento. Si el audio del vídeo vive en un evento enlazado del mismo grupo, también lo calla.',
 locked: 'Bloquea el evento: no se puede arrastrar, recortar, dividir ni borrar hasta desbloquearlo.',
 loop: 'Si el evento dura más que el material, el material se repite hasta el final del evento.',
 reversed: 'Reproduce el material al revés dentro del evento (vídeo o audio).',
 maintainAspect: 'Con la casilla puesta el material conserva su proporción y deja bandas si no cuadra con el fotograma; al quitarla se estira hasta llenarlo, aunque se deforme. Está puesta por defecto.',
 reduceFlicker: 'Suaviza el borde vertical del evento con una mezcla de tres tomas, como aproximación al «reducir parpadeo de entrelazado».',
 conform: 'Ajusta el instante de origen al fotograma del proyecto: el material se pide en el fotograma exacto.',
 undersample: 'Cuadricula el instante de origen a la velocidad de inframuestreo indicada (0 = sin inframuestreo).',
};
export type Event = { videoOpacity?: number; id: string; trackId: string; mediaId?: string; kind: 'video'|'audio'|'image'|'text'|'color'; name: string; start: number; duration: number; offset: number; speed: number; group?: string; muted?: boolean; locked?: boolean; loop?: boolean; reversed?: boolean; maintainAspect?: boolean; reduceFlicker?: boolean; resample?: ResampleMode; conform?: boolean; undersample?: number; invertPhase?: boolean; channel?: 'both'|'left'|'right'|'combine'|'swap'; stretchFill?: boolean; keySmoothness?: number; fadeIn: number; fadeOut: number; gain: number; gainCurve?: {time:number;value:number}[]; transform: Transform; keys: Keyframe[]; brightness: number; contrast: number; saturation: number; hue: number; text: string; font: string; fontSize: number; color: string; align: 'left'|'center'|'right'; mask?: CropMask; bold?: boolean; italic?: boolean; lineSpacing?: number; tracking?: number; wrap?: number; outlineWidth?: number; outlineColor?: string; shadow?: TextShadow; background?: TextBackground; anchor?: TextAnchor; animation?: TextAnimation; highlightColor?: string; effects?: VideoEffect[]; generator?: Generator; transition?: TransitionKind; maskPath?: MaskPath };
export type Project = { format: 'corte15'; version: 1; name: string; width: number; height: number; fps: FPS; sampleRate: number; tracks: Track[]; events: Event[]; media: Media[]; markers: { id: string; time: number; name: string }[]; region: { start: number; end: number } | null; buses?: AudioBus[]; master?: { gain: number; pan: number }; timecodeFormat?: 'non-drop' | 'drop-frame' | 'seconds'; loopRegion?: { start: number; end: number } | null; panCropPresets?: PanCropPreset[] };
// «Guardar parámetro preestablecido» de la ventana de Panoramización y recorte: guarda el encuadre (y el
// recorte) con un nombre para volver a aplicarlo. Viaja dentro del `.corte15`, así que el preestablecido
// sobrevive a guardar y abrir el proyecto.
export type PanCropPreset = { name: string; pose: Transform; mask?: CropMask };
export function newTrack(kind: Track['kind'], name?: string): Track { return { id: uid(), name: name || (kind === 'video' ? 'Video' : 'Audio'), kind, mute: false, solo: false, gain: 1, pan: 0, height: 84, transform: transform() }; }
export function newProject(): Project { return { format: 'corte15', version: 1, name: 'Sin título', width: 1920, height: 1080, fps: { num: 30, den: 1 }, sampleRate: 48000, tracks: [newTrack('video','Títulos'), newTrack('video','Video'),newTrack('audio','Audio')], events: [], media: [], markers: [], region: null }; }
export function newEvent(trackId: string, kind: Event['kind'], start=0, duration=ticks(5)): Event { return { id: uid(), trackId, kind, name: kind === 'text' ? 'Texto' : 'Color sólido', start, duration, offset: 0, speed: 1, fadeIn: 0, fadeOut: 0, gain: 1, transform: transform(), keys: [], brightness: 1, contrast: 1, saturation: 1, hue: 0, text: 'Escribe tu título', font: 'Arial', fontSize: 90, color: '#ffffff', align: 'center' }; }
export const endTime = (p: Project) => p.events.reduce((n,e)=>Math.max(n,e.start+e.duration),0);
// Bounding range of the selected events, used to set the render range from a selection.
export function selectionRange(p:Project,ids:string[]):{start:number;end:number}|null{const chosen=p.events.filter(e=>ids.includes(e.id));if(!chosen.length)return null;return {start:Math.min(...chosen.map(e=>e.start)),end:Math.max(...chosen.map(e=>e.start+e.duration))};}
// Región de bucle: es **independiente** del tramo de renderizado (`region`), como en VEGAS. El tramo decide
// qué se renderiza; el bucle, qué se repite al reproducir. Pueden solaparse o no tener nada que ver.
export type TimeRange = { start:number; end:number };
// Un instante está dentro de un rango. Se usa para el bucle y para saber si el cursor está en el tramo.
export const inRange = (range:TimeRange|null|undefined, time:number) => !!range && time >= range.start && time < range.end;
// Duración de un rango, en ticks.
export const rangeDuration = (range:TimeRange|null|undefined) => range ? Math.max(0, range.end - range.start) : 0;
// Normaliza un rango escrito en cualquier orden y con el mínimo de un fotograma.
export function normalizeRange(a:number,b:number,fps:FPS):TimeRange{const min=frameTicks(fps);const start=Math.max(0,Math.min(a,b));const end=Math.max(start+min,Math.max(a,b));return {start:quantize(start,fps),end:quantize(end,fps)};}
// Mueve un rango con el proyecto (lo usan el rizo y el borrado con rizo).
export function shiftRange(range:TimeRange|null|undefined, from:number, delta:number):TimeRange|null|undefined{
 if(!range||range.start<from)return range;
 return {start:Math.max(0,range.start+delta),end:Math.max(0,range.end+delta)};
}
// Zona que se repite al reproducir: manda la región de bucle y, si no hay, se usa el tramo de renderizado (como
// en VEGAS, donde el bucle puede seguir al tramo). Sin ninguno de los dos, el bucle repite el proyecto entero y
// esta función devuelve null, que es lo que el editor interpreta como «hasta el final».
export function playbackSpan(project:Project, looping:boolean):TimeRange|null{
 if(!looping)return null;
 const range=project.loopRegion??project.region;
 return range&&range.end>range.start?range:null;
}
export const clone = <T,>(value: T): T => structuredClone(value);
export function activeTracks(p: Project, kind: Track['kind']) { const tracks = p.tracks.filter(t=>t.kind===kind); const solo=tracks.some(t=>t.solo); return tracks.filter(t=>!t.mute && (!solo || t.solo)); }
// Instante del material, **en segundos**, que corresponde a `local` (en tics) dentro del evento, con los
// interruptores aplicados: inversión, bucle, ajuste al fotograma del proyecto y velocidad de inframuestreo.
// «Deshabilitar re-muestreo» pide el fotograma exacto, igual que el ajuste al fotograma del proyecto: sin
// instantes intermedios. `mediaDuration` va en segundos porque es la duración del archivo.
export function sourceTime(e:Event,local:number,mediaDuration:number,projectFps?:FPS):number{
 const span=Math.max(0,e.duration*e.speed);
 const offset=e.offset+(e.reversed?Math.max(0,span-local*e.speed):local*e.speed);
 let source=seconds(offset);
 if(e.loop&&mediaDuration>0)source=((source%mediaDuration)+mediaDuration)%mediaDuration;
 if((e.conform||e.resample==='off')&&projectFps)source=quantize(Math.round(source*TICKS),projectFps)/TICKS;
 if(e.undersample&&e.undersample>0)source=Math.round(source*e.undersample)/e.undersample;
 return Math.max(0,source);
}
// Eventos silenciados: los que llevan «Silencio» y, con ellos, los que comparten grupo (el audio enlazado de
// un evento de vídeo), que es lo que en VEGAS silencia el interruptor del vídeo.
export function silencedIds(p:Project):Set<string>{
 const groups=new Set(p.events.filter(e=>e.muted&&e.group).map(e=>e.group as string));
 return new Set(p.events.filter(e=>e.muted||(e.group!==undefined&&groups.has(e.group))).map(e=>e.id));
}
// Eventos bloqueados: no se mueven, no se recortan y no se borran hasta desbloquearlos.
export function lockedIds(p:Project):Set<string>{return new Set(p.events.filter(e=>e.locked).map(e=>e.id));}
// «Sincronizar» del clic derecho de VEGAS, en sus dos formas, sobre los eventos seleccionados que comparten el
// material del ancla:
//  · por desplazamiento: se mueven en el tiempo, sin tocar el material, hasta que el instante de origen que
//    muestran coincide con el del ancla;
//  · por deslizamiento: se quedan donde están y se desliza su material para que el instante de origen siga al
//    del ancla en el mismo punto de la línea de tiempo.
export function syncEvents(p:Project,ids:string[],anchorId:string,mode:'move'|'slip'):string[]{
 const anchor=p.events.find(e=>e.id===anchorId);if(!anchor?.mediaId)return[];
 const targets=p.events.filter(e=>ids.includes(e.id)&&e.id!==anchorId&&e.mediaId===anchor.mediaId);
 for(const e of targets){
  if(mode==='move')e.start=Math.max(0,anchor.start+(e.offset-anchor.offset)/e.speed);
  else e.offset=Math.max(0,anchor.offset+(e.start-anchor.start)*anchor.speed);
 }
 return targets.map(e=>e.id);
}
// «Invertir» del menú del evento: el material se reproduce al revés dentro del evento.
export function toggleReverse(p:Project,ids:string[]):number{let count=0;for(const e of p.events)if(ids.includes(e.id)){e.reversed=!e.reversed;count+=1;}return count;}
export function envelope(e: Event, time: number): number { const local=time-e.start; const curve=(e as Event & {gainCurve?:{time:number;value:number}[]}).gainCurve;if(curve?.length){const a=[...curve].reverse().find(k=>k.time<=local)||curve[0];const b=curve.find(k=>k.time>local)||a;return a.value+(b.value-a.value)*(b.time===a.time?0:Math.max(0,Math.min(1,(local-a.time)/(b.time-a.time))));}return Math.max(0, Math.min(1, e.fadeIn ? local/e.fadeIn : 1, e.fadeOut ? (e.duration-local)/e.fadeOut : 1)); }
export function pose(e: Event,time: number): Transform { const result=transform(); if (!e.keys.length) return {...result,...e.transform}; const local=time-e.start; const keys=[...e.keys].sort((a,b)=>a.time-b.time); const a=[...keys].reverse().find(k=>k.time<=local)||keys[0]; const b=keys.find(k=>k.time>local)||a; const f=b.time===a.time?0:easeValue(a.curve,Math.max(0,Math.min(1,(local-a.time)/(b.time-a.time))),(e.keySmoothness??100)/100); for (const k of POSE_KEYS){const from=a[k]??POSE_NEUTRAL[k],to=b[k]??POSE_NEUTRAL[k];result[k]=from+(to-from)*f;} /* El centro de giro no es un número: se interpola aparte (y si ninguna clave lo trae, se usa la del evento). */ const pivotFrom=a.pivot??e.transform.pivot,pivotTo=b.pivot??e.transform.pivot; if(pivotFrom||pivotTo){const from=pivotFrom??{x:.5,y:.5},to=pivotTo??{x:.5,y:.5};result.pivot={x:from.x+(to.x-from.x)*f,y:from.y+(to.y-from.y)*f};} if(a.cropFrame||b.cropFrame||e.transform.cropFrame){result.cropFrame=interpolateCropFrame(a.cropFrame??e.transform.cropFrame??defaultCropFrame(),b.cropFrame??e.transform.cropFrame??defaultCropFrame(),f);} return result; }
export function linkedIds(p:Project, ids:string[]) { const groups=new Set(p.events.filter(e=>ids.includes(e.id)&&e.group).map(e=>e.group)); return p.events.filter(e=>ids.includes(e.id)||(e.group&&groups.has(e.group))).map(e=>e.id); }
export function split(p: Project, ids: string[], at: number) { const chosen=new Set(linkedIds(p,ids)); const result:Event[]=[]; const groups=new Map<string,string>(); for(const e of p.events){ if(!chosen.has(e.id)||at<=e.start||at>=e.start+e.duration){result.push(e);continue;} const left=at-e.start; const boundary=pose(e,at); const a=clone(e),b=clone(e); a.duration=left;a.fadeOut=0;a.fadeIn=Math.min(a.fadeIn,left); b.id=uid();b.start=at;b.offset+=left*e.speed;b.duration-=left;b.fadeIn=0;b.fadeOut=Math.min(b.fadeOut,b.duration); a.keys=e.keys.length?[...e.keys.filter(k=>k.time<left),{...boundary,time:left}]:[];b.keys=e.keys.length?[{...boundary,time:0},...e.keys.filter(k=>k.time>left).map(k=>({...k,time:k.time-left}))]:[]; const fadeTimes=[0,e.fadeIn,e.duration-e.fadeOut,e.duration,e.fadeIn&&e.fadeOut?e.duration*e.fadeIn/(e.fadeIn+e.fadeOut):0,...(e.gainCurve||[]).map(k=>k.time)].filter(t=>t>=0&&t<=e.duration);const points=[...new Set(fadeTimes)].sort((a,b)=>a-b).map(time=>({time,value:envelope(e,e.start+time)}));a.gainCurve=[...points.filter(k=>k.time<left),{time:left,value:envelope(e,at)}];b.gainCurve=[{time:0,value:envelope(e,at)},...points.filter(k=>k.time>left).map(k=>({...k,time:k.time-left}))];if(e.group){if(!groups.has(e.group))groups.set(e.group,uid());b.group=groups.get(e.group);}result.push(a,b); } p.events=result; }
export type Ripple = 'off'|'track'|'all';
export function trim(p:Project,id:string,edge:'left'|'right',delta:number,ripple:Ripple='off'){const base=p.events.find(e=>e.id===id);if(!base)return; const ids=linkedIds(p,[id]);const min=frameTicks(p.fps);let d=delta;for(const e of p.events.filter(e=>ids.includes(e.id))){ const m=p.media.find(m=>m.id===e.mediaId);d=edge==='left'?Math.min(d,e.duration-min):Math.max(d,min-e.duration);if(edge==='left')d=Math.max(d,-e.offset/e.speed,-e.start);else if(m&&e.kind!=='image'&&!e.loop)d=Math.min(d,(m.duration-e.offset)/e.speed-e.duration); } const oldEnd=base.start+base.duration; for(const e of p.events.filter(e=>ids.includes(e.id))){if(edge==='left'){e.start+=d;e.offset+=d*e.speed;e.duration-=d;e.keys=e.keys.map(k=>({...k,time:k.time-d}));if(e.gainCurve)e.gainCurve=e.gainCurve.map(k=>({...k,time:k.time-d}));}else e.duration+=d;e.fadeIn=Math.min(e.fadeIn,e.duration);e.fadeOut=Math.min(e.fadeOut,e.duration);} if(ripple!=='off'&&edge==='right'){const tracks=new Set(p.events.filter(e=>ids.includes(e.id)).map(e=>e.trackId));for(const e of p.events)if(!ids.includes(e.id)&&e.start>=oldEnd&&(ripple==='all'||tracks.has(e.trackId)))e.start=Math.max(0,e.start+d);if(ripple==='all'){for(const m of p.markers)if(m.time>=oldEnd)m.time=Math.max(0,m.time+d);if(p.region&&p.region.start>=oldEnd){p.region.start+=d;p.region.end+=d;}if(p.loopRegion)p.loopRegion=shiftRange(p.loopRegion,oldEnd,d) as {start:number;end:number};}}}
export function removeEvents(p:Project,ids:string[],ripple:Ripple){const chosen=new Set(linkedIds(p,ids)); const removed=p.events.filter(e=>chosen.has(e.id));if(!removed.length)return; p.events=p.events.filter(e=>!chosen.has(e.id));if(ripple==='off')return;const intervals=(items:Event[])=>{const merged:{start:number;end:number}[]=[];for(const e of [...items].sort((a,b)=>a.start-b.start)){const last=merged.at(-1);if(last&&e.start<=last.end)last.end=Math.max(last.end,e.start+e.duration);else merged.push({start:e.start,end:e.start+e.duration});}return merged;};const all=intervals(removed);const shift=(time:number,ranges:{start:number;end:number}[])=>ranges.reduce((n,r)=>n+Math.max(0,Math.min(time,r.end)-r.start),0);for(const e of p.events){const ranges=ripple==='all'?all:intervals(removed.filter(r=>r.trackId===e.trackId));e.start=Math.max(0,e.start-shift(e.start,ranges));}if(ripple==='all'){p.markers=p.markers.map(m=>({...m,time:m.time-shift(m.time,all)}));if(p.region){p.region={start:p.region.start-shift(p.region.start,all),end:p.region.end-shift(p.region.end,all)};}if(p.loopRegion){p.loopRegion={start:p.loopRegion.start-shift(p.loopRegion.start,all),end:p.loopRegion.end-shift(p.loopRegion.end,all)};}}}
export function autoCrossfade(p:Project,ids:string[]){for(const id of ids){const e=p.events.find(e=>e.id===id);if(!e)continue;for(const other of p.events){if(other.id===id||other.trackId!==e.trackId)continue;if(other.start<e.start&&other.start+other.duration>e.start){const overlap=Math.min(e.duration,other.start+other.duration-e.start);e.fadeIn=overlap;other.fadeOut=overlap;}}}}
// ------------------------------------------------------------------ edición de precisión
// Cuánto material queda antes o después del que usa un evento, en ticks de la línea de tiempo. Infinito para
// los generadores y las imágenes, que no dependen de un archivo.
function sourceRoom(p:Project,e:Event,side:'before'|'after'){
 const media=p.media.find(m=>m.id===e.mediaId);
 if(!media||!media.duration||e.kind==='image'||e.kind==='text'||e.kind==='color')return Number.POSITIVE_INFINITY;
 return side==='before'?e.offset/e.speed:(media.duration-e.offset)/e.speed-e.duration;
}
// Deslizar el contenido (lo que VEGAS llama Slip): el material se mueve dentro del evento, que no cambia de
// sitio ni de duración. Los eventos vinculados de audio y vídeo se deslizan juntos.
export function slip(p:Project,ids:string[],delta:number){
 const chosen=new Set(linkedIds(p,ids));
 const targets=p.events.filter(e=>chosen.has(e.id)&&e.kind!=='image'&&e.kind!=='text'&&e.kind!=='color');
 if(!targets.length)return false;
 let d=delta;
 for(const e of targets){d=Math.max(d,-sourceRoom(p,e,'before'));d=Math.min(d,sourceRoom(p,e,'after'));}
 if(!d)return false;
 for(const e of targets)e.offset=Math.max(0,e.offset+d*e.speed);
 return true;
}
// Desplazar el evento (Slide): el bloque se mueve y los vecinos que lo tocan estiran o encogen su borde para
// que no quede hueco ni se pise nada.
export function slide(p:Project,ids:string[],delta:number){
 const chosen=new Set(linkedIds(p,ids));
 const moved=p.events.filter(e=>chosen.has(e.id));
 if(!moved.length)return false;
 const min=frameTicks(p.fps);
 const spans=new Map<string,{start:number;end:number}>();
 for(const e of moved){const span=spans.get(e.trackId)??{start:Number.POSITIVE_INFINITY,end:Number.NEGATIVE_INFINITY};spans.set(e.trackId,{start:Math.min(span.start,e.start),end:Math.max(span.end,e.start+e.duration)});}
 let d=delta;
 const neighbours:{event:Event;edge:'left'|'right'}[]=[];
 for(const [trackId,span] of spans){
  const previous=p.events.filter(e=>e.trackId===trackId&&!chosen.has(e.id)&&Math.abs(e.start+e.duration-span.start)<=1).sort((a,b)=>b.start-a.start)[0];
  const next=p.events.filter(e=>e.trackId===trackId&&!chosen.has(e.id)&&Math.abs(e.start-span.end)<=1).sort((a,b)=>a.start-b.start)[0];
  if(previous){d=Math.max(d,min-previous.duration);d=Math.min(d,sourceRoom(p,previous,'after'));neighbours.push({event:previous,edge:'right'});}
  if(next){d=Math.min(d,next.duration-min);d=Math.max(d,-sourceRoom(p,next,'before'));neighbours.push({event:next,edge:'left'});}
  d=Math.max(d,-span.start);
 }
 if(!d)return false;
 for(const e of moved)e.start=Math.max(0,e.start+d);
 for(const {event,edge} of neighbours)trim(p,event.id,edge,d);
 return true;
}
// Recorte por rizo hasta el cursor: el borde elegido del evento bajo el cursor se lleva al cursor y lo que
// venía después se adelanta para cerrar el hueco (el «Auto Ripple» de VEGAS).
export function rippleTrimToCursor(p:Project,ids:string[],edge:'left'|'right',at:number,ripple:Ripple='track'){
 const chosen=new Set(linkedIds(p,ids));
 const targets=p.events.filter(e=>chosen.has(e.id)&&at>e.start+1&&at<e.start+e.duration-1);
 if(!targets.length)return false;
 const tracks=new Set(targets.map(e=>e.trackId));
 const blockEnd=Math.max(...targets.map(e=>e.start+e.duration));
 const cut=edge==='left'?Math.min(...targets.map(e=>at-e.start)):Math.min(...targets.map(e=>e.start+e.duration-at));
 if(cut<=0)return false;
 for(const e of targets){
  if(edge==='left'){
   // Las claves que quedan antes del corte desaparecen; para que la animación no dé un salto, el valor que
   // tenía en el punto de corte se guarda como primera clave (en el instante 0 del evento recortado).
   if(e.keys.length)e.keys=[{...pose(e,e.start+cut),time:0,mask:e.mask},...e.keys.filter(k=>k.time>cut).map(k=>({...k,time:k.time-cut}))];
   e.offset+=cut*e.speed;
   if(e.gainCurve)e.gainCurve=e.gainCurve.map(k=>({...k,time:k.time-cut}));
  }
  e.duration-=cut;
  e.fadeIn=Math.min(e.fadeIn,e.duration);
  e.fadeOut=Math.min(e.fadeOut,e.duration);
 }
 if(ripple!=='off')for(const e of p.events)if(!targets.includes(e)&&e.start>=blockEnd-1&&(ripple==='all'||tracks.has(e.trackId)))e.start=Math.max(0,e.start-cut);
 // Con rizo total, el tramo de renderizado y la región de bucle acompañan al material que se adelanta.
 if(ripple==='all'){
  for(const m of p.markers)if(m.time>=blockEnd)m.time=Math.max(0,m.time-cut);
  if(p.region&&p.region.start>=blockEnd){p.region.start=Math.max(0,p.region.start-cut);p.region.end=Math.max(0,p.region.end-cut);}
  if(p.loopRegion)p.loopRegion=shiftRange(p.loopRegion,blockEnd,-cut) as {start:number;end:number};
 }
 return true;
}
// Rizo al mover o al pegar: lo que venía a partir de `from` se desplaza lo mismo que el bloque editado.
export function rippleMove(p:Project,ids:string[],delta:number,ripple:Ripple,from:number){ if(ripple==='off'||!delta)return;
 const chosen=new Set(ids);
 const tracks=new Set(p.events.filter(e=>chosen.has(e.id)).map(e=>e.trackId));
 for(const e of p.events){if(chosen.has(e.id))continue;if(e.start>=from-1&&(ripple==='all'||tracks.has(e.trackId)))e.start=Math.max(0,e.start+delta);}
 if(ripple==='all'){
  for(const m of p.markers)if(m.time>=from)m.time=Math.max(0,m.time+delta);
  if(p.region&&p.region.start>=from){p.region.start=Math.max(0,p.region.start+delta);p.region.end=Math.max(0,p.region.end+delta);}
  if(p.loopRegion)p.loopRegion=shiftRange(p.loopRegion,from,delta) as {start:number;end:number};
 }
}
// ------------------------------------------------------------------ edición de tres puntos
// Sobrescribir un tramo de una pista: lo que había dentro desaparece y lo que lo cruzaba se recorta (o se
// parte en dos) para dejar el hueco limpio. Se apoya en recortar y dividir, que ya conservan la animación.
export function overwriteRange(p:Project,trackId:string,from:number,to:number){
 const min=frameTicks(p.fps);
 if(to-from<min)return false;
 // 1) Nada puede cruzar el final del tramo: se parte ahí primero.
 for(const e of [...p.events])if(e.trackId===trackId&&e.start<to&&e.start+e.duration>to)split(p,[e.id],to);
 // 2) Ahora nada cruza el principio: se parte ahí (el trozo de la izquierda es el que se queda).
 for(const e of [...p.events])if(e.trackId===trackId&&e.start<from&&e.start+e.duration>from)split(p,[e.id],from);
 // 3) Lo que empieza dentro del tramo ya está entero dentro: se va.
 const doomed=p.events.filter(e=>e.trackId===trackId&&e.start>=from-1&&e.start<to-1).map(e=>e.id);
 if(doomed.length)removeEvents(p,doomed,'off');
 return true;
}
export type ThreePointEdit = { inPoint:number; outPoint:number; at:number; trackId?:string; mode:'insert'|'overwrite'; ripple?:Ripple };
// Edición de tres puntos: se marcan entrada y salida en el origen y se coloca en el cursor. «Insertar» corre
// lo que venía después (según el rizo) y «Sobrescribir» deja el hueco limpio. Devuelve los ids creados.
export function threePointEdit(p:Project,media:Media,edit:ThreePointEdit):string[]{
 const min=frameTicks(p.fps);
 const kind:Event['kind']=media.kind==='audio'?'audio':media.kind==='image'?'image':'video';
 const trackKind=kind==='audio'?'audio':'video';
 const source=media.duration||0;
 const from=Math.max(0,Math.min(edit.inPoint,Math.max(0,source-min)));
 const to=source?Math.min(source,Math.max(from+min,edit.outPoint)):Math.max(from+min,edit.outPoint);
 const duration=to-from;
 const at=Math.max(0,edit.at);
 let track=p.tracks.find(t=>t.id===edit.trackId&&t.kind===trackKind)??p.tracks.find(t=>t.kind===trackKind);
 if(!track){track=newTrack(trackKind);p.tracks.push(track);}
 if(edit.mode==='overwrite')overwriteRange(p,track.id,at,at+duration);
 else{
  const ripple=edit.ripple??'off';
  if(ripple!=='off')for(const e of p.events)if(e.start>=at-1&&(ripple==='all'||e.trackId===track.id))e.start+=duration;
 }
 const event:Event={...newEvent(track.id,kind,at,duration),name:media.name,mediaId:media.id,offset:from};
 p.events.push(event);
 const created=[event.id];
 if(kind==='video'&&media.hasAudio){
  let audio=p.tracks.find(t=>t.kind==='audio');
  if(!audio){audio=newTrack('audio');p.tracks.push(audio);}
  const group=uid();
  event.group=group;
  const twin:Event={...clone(event),id:uid(),trackId:audio.id,kind:'audio',group};
  p.events.push(twin);
  created.push(twin.id);
 }
 return created;
}
export class History { past:Project[]=[];future:Project[]=[]; push(p:Project){this.past.push(clone(p));if(this.past.length>100)this.past.shift();this.future=[];} undo(p:Project){const last=this.past.pop();if(!last)return p;this.future.push(clone(p));return last;} redo(p:Project){const next=this.future.pop();if(!next)return p;this.past.push(clone(p));return next;} }
export function parseProject(text:string):Project { const value=JSON.parse(text); if(value.format!=="corte15"||value.version!==1)throw new Error("Formato no compatible. Abre un proyecto .corte15 versión 1; .veg no es compatible.");return validateProject(value); }
export function timecode(time:number,fps:FPS){const s=Math.max(0,seconds(time));const f=Math.floor((s%1)*fps.num/fps.den+1e-5);return `${Math.floor(s/3600).toString().padStart(2,'0')}:${Math.floor(s/60%60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}.${f.toString().padStart(2,'0')}`;}
