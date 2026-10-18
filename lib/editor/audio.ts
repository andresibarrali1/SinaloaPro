import { AudioBus, Project, Track, envelope, envelopeValue, seconds, silencedIds, sourceTime, ticks } from './project';
import { MediaLibrary } from './media';
import { InsertChain, createInsertChain, processInserts } from './audio-effects';
import { LoudnessMeter, MeterReading } from './meter';

// Mezclador: una sola implementación para la vista previa y para la exportación (así lo que se oye es lo que
// se graba). Orden de la señal, como en VEGAS: evento → pista (nivel, panorama y sus envolventes) → tomas de
// efectos de la pista → bus (nivel y panorama) → tomas del bus → maestro (nivel y panorama) → limitador.
//
// Los buses son opcionales: un proyecto sin `buses` ni `master` suena exactamente igual que antes, porque la
// envolvente ausente vale 1 (volumen) o 0 (panorámica) y el maestro ausente vale 1 y centrado. Las tomas
// también son opcionales: sin `inserts` la señal pasa intacta.
const PAN_CENTER = Math.SQRT2;

// Ley de panorama constante: unity en el centro, +3 dB en el extremo, igual que antes de añadir buses.
function panLaw(pan: number): [number, number] {
  const angle = (Math.max(-1, Math.min(1, pan)) + 1) * Math.PI / 4;
  return [Math.cos(angle) * PAN_CENTER, Math.sin(angle) * PAN_CENTER];
}
export function mix(p:Project,library:MediaLibrary,start:number,count:number,rate=p.sampleRate):Float32Array[]{
 const master=[new Float32Array(count),new Float32Array(count)];
 const buses=p.buses??[];
 const busBuffers=new Map<string,Float32Array[]>();
 // El estado de las tomas tiene que vivir mientras dure la mezcla: el compresor y el retardo recuerdan lo
 // que ya pasó. Como `mix` se llama por bloques, se crea aquí y se descarta al final de cada llamada; para
 // que el sonido no dependa del tamaño del bloque, `PlaybackAudio` pide siempre bloques iguales.
 const trackChains=new Map<string,InsertChain>();
 const busChains=new Map<string,InsertChain>();
 const audioTracks=p.tracks.filter(t=>t.kind==='audio');
 const anySolo=audioTracks.some(t=>t.solo)||buses.some(b=>b.solo);
 const busOf=(track:Track)=>buses.find(b=>b.id===track.busId);
 // Con solo activo en cualquier sitio, se oye lo solista (pista o bus) y lo demás calla.
 const audible=(track:Track,bus?:AudioBus)=>!track.mute&&!(bus?.mute)&&(!anySolo||track.solo||bus?.solo===true);
 for(const track of audioTracks){
  const bus=busOf(track);
  if(!audible(track,bus))continue;
  // La pista se suma primero en seco, porque las tomas trabajan sobre la señal de la pista entera y antes
  // del nivel y la panorámica.
  const dry=[new Float32Array(count),new Float32Array(count)];
  // Los eventos con «Silencio» no se mezclan; si el silencio está en un evento de vídeo, calla también al
  // audio enlazado de su mismo grupo, que es lo que hace el interruptor en VEGAS.
  const silenced=silencedIds(p);
  for(const e of p.events.filter(e=>e.trackId===track.id&&e.kind==='audio')){
   if(silenced.has(e.id))continue;
   const pcm=library.items.get(e.mediaId||'')?.pcm;
   if(!pcm)continue;
   const mediaSeconds=seconds(p.media.find(m=>m.id===e.mediaId)?.duration??0);
   const begin=Math.max(0,Math.ceil((seconds(e.start)-start)*rate)),end=Math.min(count,Math.ceil((seconds(e.start+e.duration)-start)*rate));
   for(let n=begin;n<end;n++){
    const t=start+n/rate;
    // `sourceTime` aplica la inversión y el bucle del evento igual que en el vídeo; devuelve segundos.
    const pos=sourceTime(e,ticks(t)-e.start,mediaSeconds,p.fps)*pcm.sampleRate;
    const k=Math.floor(pos),f=pos-k;
    if(k<0||k>=pcm.channels[0].length)continue;
    const gain=e.gain*envelope(e,ticks(t))*(e.invertPhase?-1:1);
    // «Canales» del menú del evento: qué se hace con el izquierdo y el derecho del material. La corriente del
    // material se lee por separado y luego se reparte, así «Sólo izquierdo» suena por los dos altavoces.
    const mode=e.channel??'both';
    const leftData=pcm.channels[0],rightData=pcm.channels.length>1?pcm.channels[1]:pcm.channels[0];
    const left=leftData[k]*(1-f)+(leftData[k+1]||0)*f,right=rightData[k]*(1-f)+(rightData[k+1]||0)*f;
    const pair:Record<string,[number,number]>={
     both:[left,right],
     left:[left,left],
     right:[right,right],
     combine:[(left+right)/2,(left+right)/2],
     swap:[right,left],
    };
    const [toLeft,toRight]=pair[mode];
    dry[0][n]+=toLeft*gain;
    dry[1][n]+=toRight*gain;
   }
  }
  // Tomas de la pista.
  if(track.inserts?.length){
   let chain=trackChains.get(track.id);
   if(!chain){chain=createInsertChain(track.inserts,rate);trackChains.set(track.id,chain);}
   processInserts(chain,dry);
  }
  let target:Float32Array[]=master;
  if(bus){
   let buffer=busBuffers.get(bus.id);
   if(!buffer){buffer=[new Float32Array(count),new Float32Array(count)] as Float32Array[];busBuffers.set(bus.id,buffer);}
   target=buffer;
  }
  // Nivel, envolvente de volumen y panorama de la pista.
  for(let n=0;n<count;n++){
   const t=start+n/rate;
   const gain=track.gain*envelopeValue(track.volumeCurve,t,1);
   const [left,right]=panLaw(track.pan+envelopeValue(track.panCurve,t,0));
   if(gain===1&&left===1&&right===1){target[0][n]+=dry[0][n];target[1][n]+=dry[1][n];continue;}
   target[0][n]+=dry[0][n]*gain*left;
   target[1][n]+=dry[1][n]*gain*right;
  }
 }
 // Los buses se suman al maestro con su nivel y su panorama (el silencio y el solo ya se aplicaron al enrutar).
 for(const bus of buses){
  const buffer=busBuffers.get(bus.id);
  if(!buffer)continue;
  // Tomas del bus: van después de sumar las pistas y antes del nivel del bus.
  if(bus.inserts?.length){
   let chain=busChains.get(bus.id);
   if(!chain){chain=createInsertChain(bus.inserts,rate);busChains.set(bus.id,chain);}
   processInserts(chain,buffer);
  }
  const [left,right]=panLaw(bus.pan);
  for(let n=0;n<count;n++){
   master[0][n]+=buffer[0][n]*bus.gain*left;
   master[1][n]+=buffer[1][n]*bus.gain*right;
  }
 }
 const [masterLeft,masterRight]=panLaw(p.master?.pan??0);
 const masterGain=p.master?.gain??1;
 if(masterGain!==1||masterLeft!==1||masterRight!==1)for(let n=0;n<count;n++){
  master[0][n]*=masterGain*masterLeft;
  master[1][n]*=masterGain*masterRight;
 }
 // Consistent hard limiter for preview and export. No hidden normalization.
 for(const channel of master)for(let i=0;i<channel.length;i++)channel[i]=Math.max(-1,Math.min(1,channel[i]));
 return master;
}
export class PlaybackAudio {
 ctx:AudioContext|null=null;nodes=new Set<AudioBufferSourceNode>();origin=0;position=0;scheduled=0;analyser:AnalyserNode|null=null;meter=new LoudnessMeter(48000,2);
 async start(position:number){this.stop();this.ctx ||= new AudioContext();await this.ctx.resume();this.analyser ||= this.ctx.createAnalyser();this.analyser.fftSize=256;this.analyser.connect(this.ctx.destination);this.origin=this.ctx.currentTime+.08;this.position=position;this.scheduled=position;this.meter=new LoudnessMeter(this.ctx.sampleRate,2);}
 clock(){return this.position+Math.max(0,(this.ctx?.currentTime||0)-this.origin);}
 schedule(p:Project,library:MediaLibrary,end:number){if(!this.ctx||!this.analyser)return;this.scheduled=Math.max(this.scheduled,this.clock());const until=Math.min(end,this.clock()+.65);while(this.scheduled<until){const duration=Math.min(.25,end-this.scheduled);if(duration<=0)break;const count=Math.ceil(duration*p.sampleRate),data=mix(p,library,this.scheduled,count);this.meter.push(data);const b=this.ctx.createBuffer(2,count,p.sampleRate);for(let c=0;c<2;c++)b.copyToChannel(data[c] as Float32Array<ArrayBuffer>,c);const node=this.ctx.createBufferSource();node.buffer=b;node.connect(this.analyser);node.onended=()=>{node.disconnect();this.nodes.delete(node);};node.start(this.origin+this.scheduled-this.position);this.nodes.add(node);this.scheduled+=count/p.sampleRate;}}
 level(){if(!this.analyser)return 0;const values=new Float32Array(this.analyser.fftSize);this.analyser.getFloatTimeDomainData(values);return Math.max(...values.map(Math.abs));}
 // Lectura de los medidores: pico, pico real, RMS y sonoridad de lo que se ha reproducido desde el arranque.
 reading():MeterReading{return this.meter.reading();}
 // Sonoridad integrada de un tramo del proyecto, mezclando por bloques para no tener todo en memoria.
 async loudness(p:Project,library:MediaLibrary,from:number,to:number,blockSeconds=2):Promise<number>{
  const meter=new LoudnessMeter(p.sampleRate,2);
  for(let offset=from;offset<to;offset+=blockSeconds){
   const count=Math.ceil(Math.min(blockSeconds,to-offset)*p.sampleRate);
   if(count<=0)break;
   meter.push(mix(p,library,offset,count));
  }
  return meter.reading().loudnessLufs;
 }
 stop(){for(const n of this.nodes){try{n.stop();}catch{}n.disconnect();}this.nodes.clear();this.analyser?.disconnect();}
 dispose(){this.stop();void this.ctx?.close();this.ctx=null;}
}
