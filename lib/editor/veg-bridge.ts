// Puente con VEGAS Pro 15 para leer y guardar proyectos .veg de verdad.
//
// El formato .veg es propietario y no tiene especificación pública: el único lector y escritor completo
// es la propia VEGAS, por su API de scripting (ScriptPortal.Vegas.dll). Como el navegador no puede lanzar
// procesos, el editor habla con un servidor local (scripts/veg-bridge-server.mjs) que ejecuta
// bridge/VegBridge.cs dentro de vegas150.exe y devuelve el montaje en JSON (lectura) o le entrega un TSV
// que VEGAS convierte en .veg (escritura).
//
// Este módulo tiene dos mitades bien separadas:
//   · el mapeo puro entre el documento de VEGAS y el modelo de Corte 15, que se prueba sin VEGAS en
//     tests/veg-bridge.test.ts;
//   · el cliente HTTP del puente, que solo se usa desde el navegador.
import { Project,Event,Media,Keyframe,Transform,TICKS,uid,newProject,newTrack,newEvent,transform as newTransform } from './project';
import { validateProject } from './validation';

// ------------------------------------------------------------------ conversión de unidades

// VEGAS mide el tiempo en nanosegundos (Timecode.Nanos) y Corte 15 en «ticks» de 100 ns.
export const NANOS_PER_SECOND=1e9;
export const nanosToTicks=(nanos:number)=>Math.round((nanos/NANOS_PER_SECOND)*TICKS);
export const ticksToNanos=(time:number)=>Math.round((time/TICKS)*NANOS_PER_SECOND);

// ------------------------------------------------------------------ tipos del documento

export type VegMotionKeyframe={nanos:number;rotation?:number;left?:number;top?:number;right?:number;bottom?:number;cx?:number;cy?:number};
export type VegPoint={nanos:number;value:number};
export type VegEventDocument={
 startNanos:number;lengthNanos:number;name?:string|null;mediaType?:string;playbackRate?:number;mute?:boolean;
 fadeInNanos?:number;fadeOutNanos?:number;gain?:number;
 opacityPoints?:VegPoint[];volumePoints?:VegPoint[];motion?:VegMotionKeyframe[];
 mediaPath?:string|null;mediaName?:string|null;offsetNanos?:number;takeLengthNanos?:number;streamIndex?:number;
 effects?:string|null;
};
export type VegTrackDocument={name?:string|null;type?:string;mute?:boolean;solo?:boolean;volume?:number;pan?:number;effects?:string|null;events?:VegEventDocument[]};
export type VegDocument={
 lengthNanos?:number;width?:number;height?:number;frameRate?:number;sampleRate?:number;
 tracks?:VegTrackDocument[];markers?:{nanos:number;label?:string|null}[];regions?:{startNanos:number;lengthNanos:number;label?:string|null}[];
};
export type VegTimelineReport={
 source:string;tracks:number;events:number;media:number;markers:number;regions:number;
 width:number;height:number;fps:string;frameRateExact:boolean;
 warnings:string[];ignored:string[];log:string[];
};

// ------------------------------------------------------------------ utilidades

const clamp=(value:number,min:number,max:number)=>Number.isFinite(value)?Math.min(max,Math.max(min,value)):min;
const number=(value:unknown,fallback:number)=>{const parsed=typeof value==='number'?value:Number(value);return Number.isFinite(parsed)?parsed:fallback;};
const array=<T,>(value:T[]|undefined|null):T[]=>Array.isArray(value)?value:[];
const even=(value:number)=>value%2?value-1:value;
const cell=(value:string)=>value.replace(/[\t\r\n]+/g,' ').trim();
const baseName=(path:string)=>{const clean=path.replace(/\\/g,'/');return clean.slice(clean.lastIndexOf('/')+1)||path;};
const withoutExtension=(name:string)=>name.replace(/\.[^.\\/]+$/,'')||'proyecto';
const seconds=(time:number)=>(time/TICKS).toFixed(6);
const decimal=(value:number)=>Number.isFinite(value)?String(value):'0';

const AUDIO_EXTENSIONS=['.mp3','.wav','.aif','.aiff','.flac','.m4a','.aac','.ogg','.wma','.caf'];
const IMAGE_EXTENSIONS=['.png','.jpg','.jpeg','.bmp','.gif','.tif','.tiff','.psd','.tga','.exr','.dpx'];
function mediaKindOf(path:string):Media['kind']{
 const lower=path.toLowerCase();
 if(AUDIO_EXTENSIONS.some(extension=>lower.endsWith(extension)))return 'audio';
 if(IMAGE_EXTENSIONS.some(extension=>lower.endsWith(extension)))return 'image';
 return 'video';
}

// Velocidades que admite el modelo de Corte 15; VEGAS guarda un doble, que puede venir con ruido.
const RATES=[{num:24000,den:1001,value:24000/1001},{num:24,den:1,value:24},{num:25,den:1,value:25},{num:30000,den:1001,value:30000/1001},{num:30,den:1,value:30},{num:50,den:1,value:50},{num:60000,den:1001,value:60000/1001},{num:60,den:1,value:60}];
export function mapFrameRate(rate:number):{fps:{num:number;den:number};exact:boolean}{
 if(!Number.isFinite(rate)||rate<=0)return {fps:{num:30,den:1},exact:false};
 const nearest=RATES.reduce((best,entry)=>Math.abs(entry.value-rate)<Math.abs(best.value-rate)?entry:best,RATES[0]);
 return {fps:{num:nearest.num,den:nearest.den},exact:Math.abs(nearest.value-rate)<1e-3};
}

// ------------------------------------------------------------------ movimiento y opacidad

// VEGAS describe el encuadre con cuatro vértices en píxeles del fotograma y un centro; Corte 15 usa
// fracciones del ancho y del alto. La escala es el ancho encuadrado entre el ancho del proyecto, y el
// desplazamiento es la diferencia entre el centro y el centro del fotograma, en fracciones.
function motionSamples(raw:VegEventDocument,width:number,height:number,length:number){
 const samples=new Map<number,Partial<Transform>>();
 const at=(time:number)=>{const key=clamp(time,0,length);let entry=samples.get(key);if(!entry){entry={};samples.set(key,entry);}return entry;};
 for(const frame of array(raw.motion)){
  const scaledWidth=Math.abs(number(frame.right,width)-number(frame.left,0));
  const pose=at(nanosToTicks(number(frame.nanos,0)));
  pose.x=(number(frame.cx,width/2)-width/2)/Math.max(1,width);
  pose.y=(number(frame.cy,height/2)-height/2)/Math.max(1,height);
  pose.scale=clamp(scaledWidth/Math.max(1,width)||1,.001,100);
  pose.rotation=clamp(number(frame.rotation,0),-36000,36000);
 }
 for(const point of array(raw.opacityPoints)){
  const pose=at(nanosToTicks(number(point.nanos,0)));
  pose.opacity=clamp(number(point.value,1),0,1);
 }
 return samples;
}
function motionToPose(raw:VegEventDocument,width:number,height:number,length:number):{transform:Transform;keys:Keyframe[]}{
 const samples=motionSamples(raw,width,height,length);
 const times=[...samples.keys()].sort((a,b)=>a-b);
 if(!times.length)return {transform:newTransform(),keys:[]};
 const keys:Keyframe[]=[];
 let carried=newTransform();
 for(const time of times){
  const pose:Transform={...carried,...samples.get(time)!};
  carried=pose;
  keys.push({...pose,time});
 }
 const first=keys[0];
 const pose:Transform={x:first.x,y:first.y,scale:first.scale,rotation:first.rotation,opacity:first.opacity,crop:first.crop};
 if(keys.length===1)return {transform:pose,keys:[]};
 return {transform:pose,keys};
}

// ------------------------------------------------------------------ .veg -> Corte 15

export function vegDocumentToProject(document:VegDocument,fallbackName='proyecto.veg'):{project:Project;report:VegTimelineReport}{
 if(!document||typeof document!=='object')throw new Error('El puente no devolvió un montaje legible.');
 const warnings:string[]=[],ignored:string[]=[];
 const rate=mapFrameRate(number(document.frameRate,0));
 if(!rate.exact&&number(document.frameRate,0)>0)warnings.push(`VEGAS guarda ${number(document.frameRate,0).toFixed(6)} fps, que no es una de las velocidades de Corte 15: se importa como ${rate.fps.num}/${rate.fps.den}.`);
 const width=even(clamp(Math.round(number(document.width,1920)),16,7680));
 const height=even(clamp(Math.round(number(document.height,1080)),16,4320));
 const sampleRate=number(document.sampleRate,48000)===44100?44100:48000;

 const project=newProject();
 project.name=withoutExtension(fallbackName);
 project.width=width;project.height=height;project.fps=rate.fps;project.sampleRate=sampleRate;
 project.tracks=[];project.events=[];project.media=[];project.markers=[];project.region=null;

 const mediaByPath=new Map<string,Media>();
 const mediaFor=(path:string):Media=>{
  const key=path.toLowerCase();
  const existing=mediaByPath.get(key);
  if(existing)return existing;
  const kind=mediaKindOf(path);
  const entry:Media={id:uid(),name:baseName(path),size:0,modified:0,kind,duration:0,width:0,height:0,hasAudio:kind!=='image',mime:'',sourcePath:path};
  mediaByPath.set(key,entry);
  project.media.push(entry);
  return entry;
 };

 const tracks=array(document.tracks);
 if(!tracks.length)warnings.push('El .veg no declara pistas: el proyecto se importa vacío.');
 let effectCount=0;
 const trackIds:string[]=[];
 tracks.forEach((entry,index)=>{
  const kind=entry.type==='Audio'?'audio':'video';
  const track=newTrack(kind,cell(String(entry.name??''))||`${kind==='audio'?'Audio':'Video'} ${index+1}`);
  track.mute=!!entry.mute;track.solo=!!entry.solo;
  if(kind==='audio'){track.gain=clamp(number(entry.volume,1),0,2);track.pan=clamp(number(entry.pan,0),-1,1);}
  if(entry.effects)effectCount++;
  trackIds.push(track.id);
  project.tracks.push(track);
 });

 tracks.forEach((entry,index)=>{
  const trackId=trackIds[index];
  const kind=entry.type==='Audio'?'audio':'video';
  for(const raw of array(entry.events)){
   const length=nanosToTicks(number(raw.lengthNanos,0));
   if(length<=0){ignored.push(`«${cell(String(raw.name??''))||'evento'}» sin duración: se omitió.`);continue;}
   const path=typeof raw.mediaPath==='string'?raw.mediaPath.trim():'';
   if(!path){
    ignored.push(`«${cell(String(raw.name??''))||'evento'}» no tiene archivo (título, generador o color): VEGAS lo guarda aparte y este importador no lo reconstruye.`);
    continue;
   }
   if(raw.effects)effectCount++;
   const media=mediaFor(path);
   const eventKind:Event['kind']=kind==='audio'?'audio':media.kind==='image'?'image':'video';
   const start=Math.max(0,nanosToTicks(number(raw.startNanos,0)));
   const event=newEvent(trackId,eventKind,start,length);
   event.name=cell(String(raw.name??''))||media.name;
   event.mediaId=media.id;
   event.offset=Math.max(0,nanosToTicks(number(raw.offsetNanos,0)));
   event.speed=clamp(number(raw.playbackRate,1),.25,4);
   event.fadeIn=clamp(nanosToTicks(number(raw.fadeInNanos,0)),0,length);
   event.fadeOut=clamp(nanosToTicks(number(raw.fadeOutNanos,0)),0,length);
   event.gain=raw.mute?0:clamp(number(raw.gain,1),0,2);
   const pose=motionToPose(raw,width,height,length);
   event.transform=pose.transform;
   event.keys=pose.keys;
   project.events.push(event);
  }
 });

 if(effectCount)warnings.push(`${effectCount} efecto(s) de VEGAS (filtros, transiciones, corrección de color) no se importan: el modelo de Corte 15 no los representa.`);
 if(project.media.length)warnings.push('Los medios del .veg se añaden como referencias sin analizar (duración 0). Selecciona cada uno en Medios de proyecto y pulsa Revincular para poder reproducirlos y recortarlos.');

 project.markers=array(document.markers).map(marker=>({id:uid(),name:cell(String(marker.label??''))||'Marcador',time:Math.max(0,nanosToTicks(number(marker.nanos,0)))}));
 const regions=array(document.regions);
 if(regions.length){
  const start=Math.max(0,nanosToTicks(number(regions[0].startNanos,0)));
  project.region={start,end:start+Math.max(1,nanosToTicks(number(regions[0].lengthNanos,0)))};
  if(regions.length>1)warnings.push(`El .veg tiene ${regions.length} regiones y Corte 15 solo guarda un tramo: se usó la primera.`);
 }

 let validated:Project;
 try{
  validated=validateProject(project);
 }catch(error){
  throw new Error(`El montaje leído de VEGAS no encaja en el modelo de Corte 15: ${error instanceof Error?error.message:String(error)}`);
 }
 return {
  project:validated,
  report:{source:fallbackName,tracks:validated.tracks.length,events:validated.events.length,media:validated.media.length,markers:validated.markers.length,regions:regions.length?1:0,width,height,fps:`${rate.fps.num}/${rate.fps.den}`,frameRateExact:rate.exact,warnings,ignored,log:[]},
 };
}

// ------------------------------------------------------------------ Corte 15 -> .veg (TSV)

export function projectToVegTsv(project:Project):{tsv:string;skipped:string[];stats:{tracks:number;events:number;markers:number;regions:number}}{
 const skipped:string[]=[];
 const lines:string[]=['# corte15 -> vegas 15'];
 lines.push(['project',String(project.width),String(project.height),decimal(project.fps.num/project.fps.den),String(project.sampleRate)].join('\t'));
 for(const track of project.tracks)lines.push(['track',track.kind,cell(track.name),track.mute?'1':'0',track.solo?'1':'0',decimal(track.gain),decimal(track.pan)].join('\t'));
 const order=new Map<string,number>(project.tracks.map((track,index)=>[track.id,index]));
 let events=0;
 const sorted=[...project.events].sort((a,b)=>(order.get(a.trackId)??0)-(order.get(b.trackId)??0)||a.start-b.start);
 for(const event of sorted){
  const trackIndex=order.get(event.trackId);
  if(trackIndex===undefined){skipped.push(`«${event.name}»: su pista ya no existe.`);continue;}
  if(event.kind!=='video'&&event.kind!=='audio'&&event.kind!=='image'){skipped.push(`«${event.name}» (${event.kind}): VEGAS necesita un archivo de medio para ese tipo de evento; créalo como título dentro de VEGAS.`);continue;}
  const media=project.media.find(entry=>entry.id===event.mediaId);
  if(!media?.sourcePath){skipped.push(`«${event.name}»: el medio no tiene ruta en disco (revincúlalo antes de guardar como .veg).`);continue;}
  const rotation=number(event.transform.rotation,0)||number(event.keys[0]?.rotation,0);
  lines.push(['event',String(trackIndex),media.sourcePath,event.kind,seconds(event.start),seconds(event.duration),seconds(event.offset),seconds(event.fadeIn),seconds(event.fadeOut),decimal(event.speed),decimal(rotation)].join('\t'));
  events++;
 }
 for(const marker of project.markers)lines.push(['marker',seconds(marker.time),cell(marker.name)].join('\t'));
 let regions=0;
 if(project.region){lines.push(['region',seconds(project.region.start),seconds(project.region.end-project.region.start),'Tramo de Corte 15'].join('\t'));regions=1;}
 if(!events)skipped.push('No se exportó ningún evento: VEGAS abriría un proyecto vacío.');
 return {tsv:`${lines.join('\n')}\n`,skipped,stats:{tracks:project.tracks.length,events,markers:project.markers.length,regions}};
}

// ------------------------------------------------------------------ cliente del puente local

export const BRIDGE_DEFAULT_URL='http://127.0.0.1:5174';
export const VEG_BRIDGE_HELP='Para leer y guardar .veg hace falta el puente local con VEGAS Pro 15: ejecuta «Iniciar-con-VEGAS.cmd» (o «npm run bridge») y vuelve a intentarlo. La lectura parcial del .veg, sin VEGAS, sigue disponible.';
const BRIDGE_URL_KEY='corte15-bridge-url';

function envBridgeUrl():string|undefined{
 try{
  const meta=import.meta as unknown as {env?:Record<string,string|undefined>};
  return meta.env?.VITE_CORTE15_BRIDGE;
 }catch{return undefined;}
}
export function bridgeUrl():string{
 try{
  const stored=localStorage.getItem(BRIDGE_URL_KEY);
  if(stored)return stored.replace(/\/+$/,'');
 }catch{/* sin almacenamiento: se usa el valor por defecto */}
 const fromEnv=envBridgeUrl();
 return (fromEnv||BRIDGE_DEFAULT_URL).replace(/\/+$/,'');
}
export function setBridgeUrl(url:string){try{if(url)localStorage.setItem(BRIDGE_URL_KEY,url);else localStorage.removeItem(BRIDGE_URL_KEY);}catch{/* sin almacenamiento */}}

export type BridgeStatus={available:boolean;vegas:boolean;message:string;script?:string|null;output?:string|null};
export type VegWriteResult={path:string;skipped:string[];stats:{tracks:number;events:number;markers:number;regions:number}};
export type VegReadResult={project:Project;report:VegTimelineReport};

async function call(path:string,init:RequestInit,timeoutMs:number):Promise<Response>{
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  return await fetch(`${bridgeUrl()}${path}`,{...init,headers:{'x-corte15-bridge':'1',...(init.headers??{})},signal:controller.signal});
 }finally{clearTimeout(timer);}
}
const reason=(error:unknown)=>error instanceof Error&&error.name==='AbortError'?'el puente no respondió a tiempo':error instanceof Error?error.message:String(error);

export async function bridgeStatus():Promise<BridgeStatus>{
 try{
  const response=await call('/health',{method:'GET'},4000);
  const payload=await response.json() as {ok?:boolean;vegas?:string|null;script?:string|null;output?:string|null};
  if(!response.ok)return {available:false,vegas:false,message:`El puente respondió ${response.status}.`};
  if(!payload.vegas)return {available:true,vegas:false,message:'El puente está en marcha, pero no encuentra vegas150.exe. Define CORTE15_VEGAS con la ruta del ejecutable.',script:payload.script??null,output:payload.output??null};
  return {available:true,vegas:true,message:`Puente listo. Los .veg que guardes irán a ${payload.output??'la carpeta de documentos'}.`,script:payload.script??null,output:payload.output??null};
 }catch(error){
  return {available:false,vegas:false,message:`${VEG_BRIDGE_HELP} (${reason(error)})`};
 }
}

export async function readVegWithVegas(bytes:Uint8Array,name:string):Promise<VegReadResult>{
 let response:Response;
 try{
  response=await call(`/read?name=${encodeURIComponent(name)}`,{method:'POST',headers:{'content-type':'application/octet-stream'},body:bytes as unknown as BodyInit},300000);
 }catch(error){
  throw new Error(`${VEG_BRIDGE_HELP} (${reason(error)})`);
 }
 const payload=await response.json().catch(()=>null) as {document?:VegDocument;log?:string[];error?:string}|null;
 if(!response.ok||!payload?.document)throw new Error(payload?.error||`El puente no pudo leer el .veg (respuesta ${response.status}).`);
 const mapped=vegDocumentToProject(payload.document,name);
 mapped.report.log=array(payload.log);
 return mapped;
}

export async function writeVegWithVegas(project:Project,name:string):Promise<VegWriteResult>{
 const {tsv,skipped,stats}=projectToVegTsv(project);
 let response:Response;
 try{
  response=await call('/write',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:withoutExtension(name)||'proyecto',tsv})},300000);
 }catch(error){
  throw new Error(`${VEG_BRIDGE_HELP} (${reason(error)})`);
 }
 const payload=await response.json().catch(()=>null) as {path?:string;log?:string[];error?:string}|null;
 if(!response.ok||!payload?.path)throw new Error(payload?.error||`El puente no pudo guardar el .veg (respuesta ${response.status}).`);
 const log=array(payload.log);
 const fromVegas=log.filter(line=>line.startsWith('omitido: ')).map(line=>line.slice(9));
 return {path:payload.path,skipped:[...skipped,...fromVegas],stats};
}
