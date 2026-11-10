import { Output, BufferTarget, StreamTarget, Mp4OutputFormat, WebMOutputFormat, WavOutputFormat, CanvasSource, AudioBufferSource, canEncodeVideo, canEncodeAudio, Quality } from 'mediabunny';
import { Project, seconds, ticks, FPS, endTime } from './project';
import { MediaLibrary } from './media';
import { compose } from './compositor';
import { mix } from './audio';
import type { RenderWritable } from './export-file';
export type ExportFormat = 'mp4'|'webm'|'wav';
export type ExportQuality = 'draft'|'medium'|'high'|'master';
export type ExportSettings = { width:number; height:number; fps:FPS; format:ExportFormat; quality:ExportQuality; scope:'full'|'range'; start:number; end:number; includeVideo:boolean; includeAudio:boolean; bitrateMbps:number|null };
export type ExportStage = 'preparando'|'video'|'audio'|'finalizando';
export type ExportProgress = { done:number; total:number; rate:number; elapsedMs:number; etaMs:number; stage:ExportStage; bytes:number };
/** `blob` es null cuando el render se escribió directamente en un archivo: entonces `file` es true. */
export type ExportResult = { blob:Blob|null; bytes:number; file:boolean; elapsedMs:number; frames:number; format:ExportFormat };
/** Destino del render: un flujo escribible donde se vuelca mientras se codifica (el archivo que elige el usuario). */
export type ExportDestination = { stream:RenderWritable };
/** A partir de este peso conviene escribir a disco. Es el umbral del aviso en memoria, no un tope. */
export const EXPORT_MEMORY_WARN = 256*1024*1024;
export const QUALITY_FACTOR:Record<ExportQuality,number> = {draft:.06,medium:.12,high:.2,master:.32};
export const QUALITY_LABEL:Record<ExportQuality,string> = {draft:'Borrador',medium:'Media',high:'Alta',master:'Máxima'};
const QUALITY_LEVEL:Record<ExportQuality,'low'|'medium'|'high'|'very-high'> = {draft:'low',medium:'medium',high:'high',master:'very-high'};
// Reference bitrate derived from pixels, frame rate and a bits-per-pixel factor. It is only a starting
// point shown in the interface; the user can always set an explicit bitrate.
export function suggestedBitrate(width:number,height:number,fps:number,quality:ExportQuality){return Math.max(1,Math.round(width*height*fps*QUALITY_FACTOR[quality]/1e6*10)/10);}
export function resolveRange(p:Project,s:ExportSettings){const useRange=s.scope==='range'&&!!p.region;const rawStart=useRange?s.start:0,rawEnd=useRange?s.end:endTime(p);return {start:Math.max(0,Math.min(rawStart,rawEnd)),end:Math.max(0,rawEnd)};}
export function plannedFrames(fps:FPS,range:{start:number;end:number}){const value=fps.num/fps.den;return {fps:value,frames:Math.max(0,Math.ceil(seconds(range.end-range.start)*value))};}
export async function capabilities(width=1280,height=720,sampleRate=48000){
 return {mp4:await canEncodeVideo('avc',{width,height})&&await canEncodeAudio('aac',{sampleRate,numberOfChannels:2}),webm:await canEncodeVideo('vp9',{width,height})&&await canEncodeAudio('opus',{sampleRate,numberOfChannels:2}),wav:await canEncodeAudio('pcm-s16',{sampleRate,numberOfChannels:2})};
}
// A MessageChannel hop yields to the event loop so the interface can paint and the cancel button stays
// responsive, without the one-second clamping that timers suffer in background tabs.
const yielder=()=>{const channel=new MessageChannel();return ()=>new Promise<void>(resolve=>{channel.port1.onmessage=()=>resolve();channel.port2.postMessage(null);});};
// `destination` es el archivo del usuario: el render se escribe ahí conforme se codifica (sin pasar por memoria y
// sin tope de tamaño), que es lo que permite exportar vídeos largos a buena calidad. Sin destino se acumula en
// memoria y se devuelve un Blob, que es lo que hace un navegador sin File System Access.
export async function renderProject(p:Project,library:MediaLibrary,s:ExportSettings,signal:AbortSignal,onProgress:(progress:ExportProgress)=>void,destination?:ExportDestination):Promise<ExportResult>{
 const fps=s.fps.num/s.fps.den,audioCodec=s.format==='mp4'?'aac':s.format==='webm'?'opus':'pcm-s16';
 const wantsVideo=s.includeVideo&&s.format!=='wav',wantsAudio=s.includeAudio;
 const range=resolveRange(p,s),{frames}=plannedFrames(s.fps,range);
 if(range.end<=range.start)throw new Error('El ámbito de exportación está vacío: elige un tramo con duración o exporta el proyecto completo.');
 if(!wantsVideo&&!wantsAudio)throw new Error('Activa al menos una salida: video o audio.');
 const missing=p.media.filter(m=>p.events.some(e=>e.mediaId===m.id)&&!library.items.has(m.id));if(missing.length)throw new Error(`Revincula antes de exportar: ${missing.map(m=>m.name).join(', ')}`);
 const videoOk=wantsVideo?(s.format==='mp4'?await canEncodeVideo('avc',{width:s.width,height:s.height}):s.format==='webm'?await canEncodeVideo('vp9',{width:s.width,height:s.height}):false):true;
 if(!videoOk)throw new Error(`Este navegador no puede codificar video ${s.format==='mp4'?'H.264':'VP9'} a ${s.width}×${s.height}. Prueba otro formato o una resolución menor.`);
 const audioOk=wantsAudio?await canEncodeAudio(audioCodec,{sampleRate:p.sampleRate,numberOfChannels:2}):true;
 if(!audioOk)throw new Error(`Este navegador no puede codificar audio ${audioCodec.toUpperCase()}. Prueba el formato WebM o exporta solo audio en WAV.`);
 const videoQuality=new Quality(s.bitrateMbps?{bitrate:Math.round(s.bitrateMbps*1e6)}:QUALITY_LEVEL[s.quality]);
 const audioQuality=new Quality({bitrate:s.quality==='draft'?96000:s.quality==='master'?256000:192000});
 const canvas=document.createElement('canvas');canvas.width=s.width;canvas.height=s.height;
 // El contador sale de los avisos de escritura del destino, que valen para las dos formas de guardar: el archivo
 // (donde también se reescriben zonas al final) y el búfer en memoria.
 const target=destination?new StreamTarget(destination.stream,{chunked:true,chunkSize:4*1024*1024}):new BufferTarget();
 let written=0;target.on('write',({end})=>{if(end>written)written=end;});
 const output=new Output({format:s.format==='mp4'?new Mp4OutputFormat():s.format==='webm'?new WebMOutputFormat():new WavOutputFormat(),target});
 const video=wantsVideo?new CanvasSource(canvas,{codec:s.format==='mp4'?'avc':'vp9',quality:videoQuality}):null;
 const audio=wantsAudio?new AudioBufferSource({codec:audioCodec,...(s.format==='wav'?{}:{quality:audioQuality}),transform:{sampleRate:p.sampleRate,numberOfChannels:2}}):null;
 if(video)output.addVideoTrack(video,{frameRate:fps});
 if(audio)output.addAudioTrack(audio);
 const duration=seconds(range.end-range.start),started=performance.now(),yieldToUi=yielder();
 const blockSamples=Math.max(1024,Math.round(p.sampleRate*.5)),yieldEvery=Math.max(1,Math.round(fps/8));
 let success=false,cancelPromise:Promise<void>|null=null,audioCursor=0;
 const cancel=()=>{cancelPromise ||= output.cancel();void cancelPromise.catch(()=>{});};
 const check=()=>{if(signal.aborted)throw new DOMException('Exportación cancelada','AbortError');};
 const report=(done:number,stage:ExportStage)=>{const elapsedMs=performance.now()-started,rate=done/Math.max(.001,elapsedMs/1000);onProgress({done,total:frames,rate,elapsedMs,etaMs:rate>0?(frames-done)/rate*1000:0,stage,bytes:written});};
 try{
  check();onProgress({done:0,total:frames,rate:0,elapsedMs:0,etaMs:0,stage:'preparando',bytes:0});
  await output.start();signal.addEventListener('abort',cancel,{once:true});
  for(let i=0;i<frames;i++){
   check();
   if(video){await compose(canvas,p,library,range.start+ticks(i/fps));check();await video.add(i/fps,Math.min(1/fps,duration-i/fps));}
   const until=Math.min(duration,(i+1)/fps),needed=Math.round(until*p.sampleRate);
   if(audio&&(needed-audioCursor>=blockSamples||i===frames-1)){
    while(audioCursor<needed){
     const count=Math.min(blockSamples,needed-audioCursor),data=mix(p,library,seconds(range.start)+audioCursor/p.sampleRate,count);
     const buffer=new AudioBuffer({length:count,numberOfChannels:2,sampleRate:p.sampleRate});for(let ch=0;ch<2;ch++)buffer.copyToChannel(data[ch] as Float32Array<ArrayBuffer>,ch);
     await audio.add(buffer);audioCursor+=count;
    }
   }
   report(i+1,video?'video':'audio');
   if(i%yieldEvery===yieldEvery-1)await yieldToUi();
  }
  check();report(frames,'finalizando');
  video?.close();audio?.close();await output.finalize();check();
  const elapsedMs=performance.now()-started;success=true;
  const mime=s.format==='mp4'?'video/mp4':s.format==='webm'?'video/webm':'audio/wav';
  // Con destino no hay Blob: el archivo ya está en disco (el flujo lo cerró `finalize`) y solo vuelve su tamaño.
  const blob=!destination&&target instanceof BufferTarget&&target.buffer?new Blob([target.buffer],{type:mime}):null;
  return {blob,bytes:blob?.size??written,file:!!destination,elapsedMs,frames,format:s.format};
 }finally{
  signal.removeEventListener('abort',cancel);
  if(!success){try{cancel();await cancelPromise;}catch{}}
  canvas.width=1;canvas.height=1;
 }
}
