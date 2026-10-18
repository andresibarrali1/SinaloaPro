import { Project, seconds } from './project';
import { MediaLibrary } from './media';
import { mix } from './audio';
// Transcripción con la API de Groq (compatible con la de OpenAI) y utilidades de subtítulos.
// Todo el audio se prepara en local: se mezcla el proyecto, se convierte a 16 kHz mono y se envía en un WAV
// PCM. Nada se sube hasta que el usuario pulsa «Generar subtítulos», y solo se envía el audio.
export type Cue = { start:number; end:number; text:string };
export const GROQ_ENDPOINT='https://api.groq.com/openai/v1/audio/transcriptions';
export const GROQ_MODEL='whisper-large-v3';
export function formatSrtTime(secondsValue:number){const total=Math.max(0,secondsValue);const hours=Math.floor(total/3600),minutes=Math.floor(total/60)%60,secs=Math.floor(total)%60,millis=Math.round((total-Math.floor(total))*1000);return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')},${String(Math.min(999,millis)).padStart(3,'0')}`;}
export function buildSrt(cues:Cue[]){return cues.map((cue,index)=>`${index+1}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}\n${cue.text.trim()}\n`).join('\n');}
export function parseSrt(text:string):Cue[]{
 const cues:Cue[]=[];
 for(const block of text.replace(/\r/g,'').split(/\n{2,}/)){
  const lines=block.split('\n').filter(line=>line.trim().length);
  if(lines.length<2)continue;
  const timing=/^(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})/.exec(lines[0].includes('-->')?lines[0]:lines[1]??'');
  if(!timing)continue;
  const toSeconds=(value:string)=>{const [h,m,rest]=value.split(':');const [s,ms]=rest.split(/[,.]/);return Number(h)*3600+Number(m)*60+Number(s)+Number(ms.padEnd(3,'0'))/1000;};
  const body=lines.slice(lines[0].includes('-->')?1:2).join(' ').trim();
  if(body)cues.push({start:toSeconds(timing[1]),end:toSeconds(timing[2]),text:body});
 }
 return cues;
}
// Mezcla lineal a 16 kHz mono, por bloques, para no mantener todo el audio del proyecto en memoria.
// Al reducir la frecuencia se promedian las muestras de cada intervalo (decimación con filtro de media):
// así no hay aliasing y la posición temporal se conserva.
export function renderSpeechAudio(p:Project,library:MediaLibrary,targetRate=16000,blockSeconds=2){
 const total=seconds(p.events.reduce((end,event)=>Math.max(end,event.start+event.duration),0));
 const ratio=p.sampleRate/targetRate;
 const blocks:Float32Array[]=[];let written=0;
 for(let offset=0;offset<total;offset+=blockSeconds){
  const length=Math.max(1,Math.round(Math.min(blockSeconds,total-offset)*p.sampleRate));
  const mixed=mix(p,library,offset,length);
  const target=Math.max(1,Math.round(Math.min(blockSeconds,total-offset)*targetRate));
  const mono=new Float32Array(target);
  const sample=(channel:Float32Array,at:number)=>at<0||at>=channel.length?0:channel[at];
  for(let index=0;index<target;index++){
   if(ratio<=1){
    const position=index*ratio,low=Math.floor(position),fraction=position-low;
    const a=(sample(mixed[0],low)+sample(mixed[1],low))/2,b=(sample(mixed[0],low+1)+sample(mixed[1],low+1))/2;
    mono[index]=a+(b-a)*fraction;
   }else{
    const from=Math.floor(index*ratio),to=Math.min(mixed[0].length,Math.max(from+1,Math.floor((index+1)*ratio)));
    let sum=0,count=0;
    for(let at=from;at<to;at++){sum+=(sample(mixed[0],at)+sample(mixed[1],at))/2;count++;}
    mono[index]=count?sum/count:0;
   }
  }
  blocks.push(mono);written+=target;
 }
 const samples=new Float32Array(written);let at=0;
 for(const block of blocks){samples.set(block,at);at+=block.length;}
 return {samples,sampleRate:targetRate,duration:total};
}
export function encodeWav16(samples:Float32Array,sampleRate:number){
 const buffer=new ArrayBuffer(44+samples.length*2),view=new DataView(buffer);
 const text=(offset:number,value:string)=>{for(let index=0;index<value.length;index++)view.setUint8(offset+index,value.charCodeAt(index));};
 text(0,'RIFF');view.setUint32(4,36+samples.length*2,true);text(8,'WAVE');text(12,'fmt ');
 view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);
 view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');
 view.setUint32(40,samples.length*2,true);
 for(let index=0;index<samples.length;index++){const value=Math.max(-1,Math.min(1,samples[index]));view.setInt16(44+index*2,value<0?value*0x8000:value*0x7fff,true);}
 return new Blob([buffer],{type:'audio/wav'});
}
export type TranscriptionResult = { cues:Cue[]; text:string; language:string|null; duration:number|null };
export async function transcribe(samples:Float32Array,sampleRate:number,apiKey:string,options:{language?:string;signal?:AbortSignal;fetchImpl?:typeof fetch}={}):Promise<TranscriptionResult>{
 if(!apiKey.trim())throw new Error('Falta la clave de la API de Groq. Añádela en Configuración → Claves de API.');
 const doFetch=options.fetchImpl??fetch;
 const form=new FormData();
 form.append('file',encodeWav16(samples,sampleRate),'corte15-audio.wav');
 form.append('model',GROQ_MODEL);
 form.append('response_format','verbose_json');
 form.append('timestamp_granularities[]','segment');
 if(options.language)form.append('language',options.language);
 const response=await doFetch(GROQ_ENDPOINT,{method:'POST',headers:{Authorization:`Bearer ${apiKey.trim()}`},body:form,signal:options.signal});
 const raw=await response.text();
 if(!response.ok){
  let detail=raw.slice(0,300);
  try{const parsed=JSON.parse(raw) as {error?:{message?:string}};if(parsed.error?.message)detail=parsed.error.message;}catch{/* respuesta no JSON */}
  throw new Error(`Groq respondió ${response.status}: ${detail}`);
 }
 let payload:{text?:string;language?:string;duration?:number;segments?:{start:number;end:number;text:string}[]};
 try{payload=JSON.parse(raw);}catch{throw new Error('La respuesta de Groq no es un JSON válido.');}
 const cues=(payload.segments??[])
  .map(segment=>({start:Number(segment.start)||0,end:Number(segment.end)||0,text:String(segment.text??'').trim()}))
  .filter(cue=>cue.text.length&&cue.end>cue.start);
 if(!cues.length){
  const text=(payload.text??'').trim();
  if(!text)throw new Error('La transcripción no devolvió texto: comprueba que el proyecto tenga audio audible.');
  const duration=Number(payload.duration)||seconds(0)||1;
  return {cues:[{start:0,end:duration,text}],text,language:payload.language??null,duration:payload.duration??null};
 }
 return {cues,text:cues.map(cue=>cue.text).join(' '),language:payload.language??null,duration:payload.duration??null};
}
const STOPWORDS=new Set(['para','como','este','esta','esto','esos','esas','pero','porque','cuando','donde','todo','toda','todos','todas','muy','más','mas','los','las','una','uno','unos','unas','del','con','sin','que','por','sus','les','nos','son','era','fue','han','hay','ser','está','estan','están','the','and','for','you','that','with','this','have','from','your','about','aquí','aqui','allí','alli','pues','entonces','también','tambien','solo','sólo','cada','otro','otra','mismo','misma','desde','entre','sobre','hasta','aunque','mientras','https','www']);
export function keywords(text:string,limit=6){
 const counts=new Map<string,number>();
 for(const raw of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)){
  const word=raw.trim();
  if(word.length<4||STOPWORDS.has(word)||/^\d+$/.test(word))continue;
  counts.set(word,(counts.get(word)??0)+1);
 }
 return [...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,limit).map(([word])=>word);
}
// Términos con los que buscar un recurso para cada frase, en orden de relevancia. Las frases sin palabras
// utilizables (solo muletillas o números) se devuelven con la lista vacía para poder informarlas.
export type CueTerms = { start:number; end:number; text:string; terms:string[] };
export function resourceTerms(cues:Cue[],limit=3):CueTerms[]{
 return cues.map(cue=>({start:cue.start,end:cue.end,text:cue.text,terms:keywords(cue.text,limit)}));
}
// Reparte los recursos en el tiempo: cada frase recibe un clip en el instante en que se dice, recortado a la
// duración de la frase (o a la del clip, si es más corto). Los términos repetidos reutilizan el mismo clip.
export type ResourceAssignment = { term:string; start:number; duration:number };
export function planResourcePlacements(cues:Cue[],clipDurations:Record<string,number>,frameSeconds:number,minimumSeconds=.4):ResourceAssignment[]{
 const placed:ResourceAssignment[]=[];
 for(const entry of resourceTerms(cues)){
  const term=entry.terms.find(candidate=>clipDurations[candidate]!==undefined);
  if(!term)continue;
  const spoken=Math.max(0,entry.end-entry.start);
  const clip=clipDurations[term];
  const duration=Math.max(frameSeconds,Math.min(clip,Math.max(minimumSeconds,spoken)));
  placed.push({term,start:entry.start,duration});
 }
 return placed;
}
