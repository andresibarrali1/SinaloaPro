import { Project, Media, newProject, newTrack, newEvent, uid, TICKS } from './project';
// Intercambio de proyectos con VEGAS Pro.
//
// El formato nativo .veg es un contenedor binario propietario (firma RIFF «riff.», con el tamaño en 0x10)
// que MAGIX/Sony nunca ha publicado: no hay especificación, así que leerlo al 100 % no es posible fuera de
// VEGAS y este editor no finge lo contrario. Lo que sí exporta VEGAS son formatos de intercambio
// documentados, y son los que se leen aquí:
//   · Final Cut Pro 7 / DaVinci Resolve (.xml, xmeml v5)
//   · Archivo de texto EDL (CMX 3600)
// Los medios no viajan dentro de esos archivos: se reconstruyen como referencias y el editor pide
// revincularlos, exactamente igual que al abrir un .corte15 sin sus originales.
export type InterchangeFormat = 'corte15'|'fcpxml'|'edl'|'veg'|'unknown';
export type ImportReport = { format:string; source:string; fps:string; tracks:number; events:number; media:number; warnings:string[]; ignored:string[] };
export type Interchange = { project:Project; report:ImportReport };
export const VEG_EXPLANATION = 'Los archivos .veg son un contenedor binario propietario (RIFF con firma «riff.») y no existe especificación pública: interpretarlos al 100 % no es posible fuera de VEGAS, y este editor no va a simular que puede. En VEGAS Pro 15 abre Archivo → Exportar y elige «Final Cut Pro 7/DaVinci Resolve (*.xml)» o «Archivo de texto EDL (*.txt)»; después abre ese archivo aquí con Abrir proyecto.';
export function detectInterchange(name:string,text:string):InterchangeFormat{
 const lower=name.toLowerCase();
 if(text.startsWith('riff.')||lower.endsWith('.veg'))return 'veg';
 if(/<xmeml[\s>]/.test(text)||lower.endsWith('.fcpxml'))return 'fcpxml';
 if((/^\s*TITLE:/im.test(text)&&/^\s*\d{3,6}\s+\S+\s+\S+\s+\S+\s+\d/m.test(text))||lower.endsWith('.edl'))return 'edl';
 if(lower.endsWith('.corte15')||text.trimStart().startsWith('{'))return 'corte15';
 return 'unknown';
}
// ---------------------------------------------------------------------------------------------------
// Utilidades compartidas
// ---------------------------------------------------------------------------------------------------
type Rate = { num:number; den:number; label:string };
const RATES:Record<string,Rate> = {
 '24':{num:24,den:1,label:'24'},'25':{num:25,den:1,label:'25'},'30':{num:30,den:1,label:'30'},'50':{num:50,den:1,label:'50'},'60':{num:60,den:1,label:'60'},
 '23.976':{num:24000,den:1001,label:'23.976'},'29.97':{num:30000,den:1001,label:'29.97'},'59.94':{num:60000,den:1001,label:'59.94'},
};
export function frameRateFromTimebase(timebase:number,ntsc:boolean):Rate{
 const mapped=ntsc?({24:'23.976',30:'29.97',60:'59.94'} as Record<number,string>)[timebase]:String(timebase);
 return RATES[mapped]??{num:timebase>0?timebase:30,den:1,label:String(timebase>0?timebase:30)};
}
// 1 fotograma = den/num segundos. Con 30000/1001 la cuenta de fotogramas sigue siendo 30 por segundo, como
// en el timecode SMPTE; la aritmética de drop frame no se aplica y se avisa al importar.
export function framesToTicks(frames:number,rate:{num:number;den:number}){return Math.round(frames*rate.den/rate.num*TICKS);}
export function timecodeToFrames(value:string,nominalFps:number){const m=/^(\d{1,3}):(\d{2}):(\d{2})[:;.](\d{1,3})$/.exec(value.trim());if(!m)return null;const [,h,mi,s,f]=m;return (Number(h)*3600+Number(mi)*60+Number(s))*nominalFps+Number(f);}
function baseName(value:string){const clean=value.split(/[?#]/)[0].replace(/\\/g,'/');return decodeURIComponent(clean.slice(clean.lastIndexOf('/')+1)||value);}
function planTracks(video:number,audio:number){const p=newProject();p.tracks=[];for(let i=0;i<video;i++)p.tracks.push(newTrack('video',`V${i+1}`));for(let i=0;i<audio;i++)p.tracks.push(newTrack('audio',`A${i+1}`));if(!p.tracks.length)p.tracks.push(newTrack('video','V1'));return p;}
// Vincula cada evento de audio con el de video que usa el mismo medio y exactamente el mismo tramo, que es
// como VEGAS agrupa el audio y el video de un mismo clip al importar.
function linkAudioVideo(p:Project){
 for(const event of p.events.filter(e=>e.kind==='audio')){
  const twin=p.events.find(other=>other.kind!=='audio'&&other.mediaId&&other.mediaId===event.mediaId&&other.start===event.start&&other.duration===event.duration);
  if(!twin)continue;
  if(!twin.group&&!event.group){const id=uid();twin.group=id;event.group=id;}
  else if(!event.group)event.group=twin.group;
  else if(event.group!==twin.group){
   const audioGroup=event.group;
   if(!twin.group)twin.group=audioGroup;
   else for(const other of p.events)if(other.group===audioGroup)other.group=twin.group;
  }
 }
}
class MediaIndex{
 private byKey=new Map<string,Media>();
 constructor(private project:Project){}
 get(key:string){return this.byKey.get(key);}
 add(key:string,name:string,kind:'video'|'audio'|'image',duration:number,width:number,height:number,sourcePath?:string){
  const existing=this.byKey.get(key);
  if(existing){existing.duration=Math.max(existing.duration,duration);if(existing.kind==='audio'&&kind==='video')existing.kind='video';return existing;}
  const media:Media={id:uid(),name:baseName(name),size:0,modified:0,kind,duration,width,height,hasAudio:kind!=='image',mime:'',...(sourcePath?{sourcePath}:{})};
  this.byKey.set(key,media);this.project.media.push(media);return media;
 }
}
// ---------------------------------------------------------------------------------------------------
// EDL (CMX 3600)
// ---------------------------------------------------------------------------------------------------
export function parseEdl(text:string,sourceName='EDL'):Interchange{
 const warnings:string[]=[],ignored:string[]=[];
 const title=/^TITLE:\s*(.+)$/im.exec(text);
 const fcm=/^FCM:\s*(.+)$/im.exec(text);
 const declared=/^\*\s*(?:FRAME RATE|VEGAS FRAME RATE)\s*:?\s*([\d.]+)/im.exec(text);
 const dropFrame=!!fcm&&/DROP/i.test(fcm[1])&&!/NON/i.test(fcm[1]);
 const rate=declared?RATES[declared[1]]:dropFrame?RATES['29.97']:RATES['30'];
 if(declared&&!RATES[declared[1]])warnings.push(`El EDL declara ${declared[1]} fps, que no está entre las frecuencias admitidas por el proyecto: se usó 30 fps.`);
 else if(!declared&&!fcm)warnings.push('El EDL no declara velocidad de fotogramas ni FCM: se asumió 30 fps. Cámbiala en Propiedades del proyecto si tu EDL venía de otro ajuste.');
 else if(!declared)warnings.push(`El EDL no declara velocidad de fotogramas; se dedujo ${rate.label} fps de la línea FCM.`);
 if(dropFrame)warnings.push('EDL con drop frame: se usa 29.97 fps sin descartar fotogramas de compensación, así que los timecodes largos pueden desviarse hasta un fotograma por minuto.');
 const nominal=rate.num/rate.den>=29?Math.round(rate.num/rate.den):rate.num/rate.den;
 const line=/^\s*(\d{3,6})\s+(\S+)\s+(\S+)\s+(\S+)\s+(\d{1,3}:\d{2}:\d{2}[:;.]\d{1,3})\s+(\d{1,3}:\d{2}:\d{2}[:;.]\d{1,3})\s+(\d{1,3}:\d{2}:\d{2}[:;.]\d{1,3})\s+(\d{1,3}:\d{2}:\d{2}[:;.]\d{1,3})/;
 type Row={number:string;reel:string;channel:string;sourceIn:number;sourceOut:number;recordIn:number;recordOut:number;clip:string};
 const rows:Row[]=[];
 let last:Row|null=null;
 for(const raw of text.split(/\r?\n/)){
  const m=line.exec(raw);
  if(m){
   const [sourceIn,sourceOut,recordIn,recordOut]=[m[5],m[6],m[7],m[8]].map(value=>timecodeToFrames(value,nominal));
   if(sourceIn===null||sourceOut===null||recordIn===null||recordOut===null)continue;
   if(m[4].toUpperCase()!=='C'){ignored.push(`Transición «${m[4]}» del evento ${m[1]}: solo se importan cortes (C).`);last=null;continue;}
   last={number:m[1],reel:m[2],channel:m[3].toUpperCase(),sourceIn,sourceOut,recordIn,recordOut,clip:''};
   rows.push(last);continue;
  }
  const clip=/^\*\s*FROM CLIP NAME:\s*(.+)$/i.exec(raw);
  if(clip&&last)last.clip=clip[1].trim();
 }
 if(!rows.length)throw new Error('El EDL no contiene ninguna línea de evento reconocible (formato CMX 3600).');
 const channels=[...new Set(rows.map(row=>row.channel))];
 const hasVideo=channels.some(c=>c.startsWith('V')||c==='B'||c==='AA');
 const audioNumbers=channels.filter(c=>c.startsWith('A')||c==='AA'||c==='B').map(c=>c==='A'||c==='AA'||c==='B'?1:Number(c.replace(/\D/g,''))||1);
 const audioCount=audioNumbers.length?Math.max(...audioNumbers):0;
 const p=planTracks(hasVideo?1:0,audioCount);
 p.fps={num:rate.num,den:rate.den};
 p.name=title?title[1].trim():sourceName.replace(/\.[^.]+$/,'');
 warnings.push('El EDL no guarda resolución: el proyecto se crea a 1920×1080. Ajusta ancho y alto en Propiedades del proyecto si tu secuencia era otra.');
 const media=new MediaIndex(p),trackIds=new Map<string,string>();
 const videoTracks=p.tracks.filter(t=>t.kind==='video'),audioTracks=p.tracks.filter(t=>t.kind==='audio');
 const trackFor=(channel:string,kind:'video'|'audio')=>{
  const key=`${kind}:${channel}`;const cached=trackIds.get(key);if(cached)return cached;
  const list=kind==='video'?videoTracks:audioTracks;
  const index=kind==='video'?0:Math.max(0,(channel==='A'||channel==='AA'||channel==='B'?1:Number(channel.replace(/\D/g,''))||1)-1);
  const track=(list[index]??list[0])!;trackIds.set(key,track.id);return track.id;
 };
 for(const row of rows){
  const name=row.clip||row.reel;
  const frames=Math.max(1,row.recordOut-row.recordIn);
  const sourceFrames=Math.max(frames,row.sourceOut-row.sourceIn);
  const isVideo=hasVideo&&(row.channel.startsWith('V')||row.channel==='B'||row.channel==='AA');
  const isAudio=audioCount>0&&(row.channel.startsWith('A')||row.channel==='B'||row.channel==='AA');
  const entry=media.add(name,name,isVideo?'video':isAudio?'audio':'video',framesToTicks(sourceFrames,rate),1920,1080,name);
  for(const kind of [isVideo?'video':null,isAudio?'audio':null].filter(Boolean) as ('video'|'audio')[]){
   const event=newEvent(trackFor(row.channel,kind),kind, framesToTicks(row.recordIn,rate), framesToTicks(frames,rate));
   event.mediaId=entry.id;event.name=name;event.offset=framesToTicks(row.sourceIn,rate);
   p.events.push(event);
  }
 }
 linkAudioVideo(p);
 return {project:p,report:{format:'EDL (CMX 3600)',source:sourceName,fps:rate.label,tracks:p.tracks.length,events:p.events.length,media:p.media.length,warnings,ignored}};
}
// ---------------------------------------------------------------------------------------------------
// Final Cut Pro 7 / DaVinci Resolve (xmeml v5)
// ---------------------------------------------------------------------------------------------------
export type XmlNode = { name:string; attrs:Record<string,string>; children:XmlNode[]; text:string };
// Parser XML mínimo (etiquetas, atributos, texto, CDATA, comentarios e instrucciones). Cubre xmeml y
// funciona igual en el navegador y en las pruebas de Node, sin dependencias nuevas.
export function parseXml(source:string):XmlNode{
 const root:XmlNode={name:'#document',attrs:{},children:[],text:''};
 const stack:XmlNode[]=[root];
 let index=0;
 while(index<source.length){
  const open=source.indexOf('<',index);
  if(open<0){stack[stack.length-1].text+=source.slice(index);break;}
  if(open>index)stack[stack.length-1].text+=source.slice(index,open);
  if(source.startsWith('<!--',open)){const end=source.indexOf('-->',open);if(end<0)throw new Error('comentario sin cerrar');index=end+3;continue;}
  if(source.startsWith('<?',open)){const end=source.indexOf('?>',open);if(end<0)throw new Error('instrucción sin cerrar');index=end+2;continue;}
  if(source.startsWith('<![CDATA[',open)){const end=source.indexOf(']]>',open);if(end<0)throw new Error('CDATA sin cerrar');stack[stack.length-1].text+=source.slice(open+9,end);index=end+3;continue;}
  if(source.startsWith('<!',open)){ // DOCTYPE, ENTITY y demás declaraciones: se saltan completas, con su subconjunto interno.
   let depth=0,end=-1;
   for(let cursor=open;cursor<source.length;cursor++){const character=source[cursor];if(character==='[')depth++;else if(character===']')depth--;else if(character==='>'&&depth<=0){end=cursor;break;}}
   if(end<0)throw new Error('declaración sin cerrar');
   index=end+1;continue;
  }
  const close=source.indexOf('>',open);
  if(close<0)throw new Error('etiqueta sin cerrar');
  const inner=source.slice(open+1,close).trim();
  if(inner.startsWith('/')){
   const name=inner.slice(1).trim();
   const current=stack.pop();
   if(!current||current.name!==name)throw new Error(`se esperaba </${current?.name??'?'}> y aparece </${name}>`);
   index=close+1;continue;
  }
  const selfClosing=inner.endsWith('/');
  const body=selfClosing?inner.slice(0,-1).trim():inner;
  const space=body.search(/\s/);
  const name=space<0?body:body.slice(0,space);
  if(!name)throw new Error('etiqueta sin nombre');
  const attrs:Record<string,string>={};
  const pattern=/([\w:.-]+)\s*=\s*"([^"]*)"/g;
  let match:RegExpExecArray|null;
  while((match=pattern.exec(space<0?'':body.slice(space))))attrs[match[1]]=decodeEntities(match[2]);
  const node:XmlNode={name,attrs,children:[],text:''};
  stack[stack.length-1].children.push(node);
  if(!selfClosing)stack.push(node);
  index=close+1;
 }
 if(stack.length!==1)throw new Error(`queda abierta la etiqueta <${stack[stack.length-1].name}>`);
 return root;
}
function decodeEntities(value:string){return value.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi,(all,code:string)=>{const named:Record<string,string>={lt:'<',gt:'>',amp:'&',quot:'"',apos:"'"};const key=code.toLowerCase();if(named[key])return named[key];const numeric=key.startsWith('#x')?parseInt(key.slice(2),16):Number(key.slice(1));return Number.isFinite(numeric)?String.fromCodePoint(numeric):all;});}
function find(node:XmlNode|null|undefined,name:string,depth=0):XmlNode|null{if(!node||depth>12)return null;for(const child of node.children){if(child.name===name)return child;const deep=find(child,name,depth+1);if(deep)return deep;}return null;}
function kids(node:XmlNode|null|undefined,name:string){return node?node.children.filter(c=>c.name===name):[];}
function num(node:XmlNode|null|undefined){const value=node?.text.trim();if(!value)return null;const parsed=Number(value);return Number.isFinite(parsed)?parsed:null;}
function text(node:XmlNode|null|undefined){return node?.text.trim()??'';}
export function parseFcpXml(source:string,sourceName='XML'):Interchange{
 const warnings:string[]=[],ignored:string[]=[];
 let document:XmlNode;
 try{document=parseXml(source);}catch(error){throw new Error(`El archivo no es un XML válido: ${error instanceof Error?error.message:String(error)}.`);}
 const sequence=find(document,'sequence');
 if(!sequence)throw new Error('El XML no contiene ningún elemento <sequence>: no parece un proyecto de Final Cut Pro 7 / DaVinci Resolve.');
 const sequenceRate=find(sequence,'rate');
 const rate=frameRateFromTimebase(num(find(sequenceRate??sequence,'timebase'))??30,/true/i.test(text(find(sequenceRate??sequence,'ntsc'))));
 const media=find(sequence,'media');
 const videoMedia=kids(media,'video')[0];
 const audioMedia=kids(media,'audio')[0];
 if(!videoMedia&&!audioMedia)throw new Error('El XML no contiene elementos <video> ni <audio> dentro de <media>.');
 const videoNodes=kids(videoMedia,'track');
 const audioNodes=kids(audioMedia,'track');
 if(!videoNodes.length&&!audioNodes.length)throw new Error('El XML no contiene pistas de video ni de audio dentro de <media>.');
 // La resolución del proyecto está en la cabecera de la secuencia, no en las características de cada archivo.
 const sequenceFormat=kids(videoMedia,'format')[0];
 const sequenceSample=sequenceFormat?find(sequenceFormat,'samplecharacteristics'):undefined;
 const width=Math.round(num(find(sequenceSample,'width'))??1920),height=Math.round(num(find(sequenceSample,'height'))??1080);
 if(!sequenceSample)warnings.push('El XML no declara el tamaño de la secuencia: el proyecto se creó a 1920×1080.');
 const p=planTracks(videoNodes.length,audioNodes.length);
 p.width=width;p.height=height;p.fps={num:rate.num,den:rate.den};
 p.name=text(find(sequence,'name'))||sourceName.replace(/\.[^.]+$/,'');
 const mediaIndex=new MediaIndex(p);
 const rateOf=(node:XmlNode|undefined,fallback:Rate)=>{const rateNode=find(node,'rate');if(!rateNode)return fallback;const tb=num(find(rateNode,'timebase'));if(tb===null)return fallback;return frameRateFromTimebase(tb,/true/i.test(text(find(rateNode,'ntsc'))));};
 const readTrack=(trackNode:XmlNode,kind:'video'|'audio',trackId:string)=>{
  for(const item of trackNode.children){
   if(item.name==='transitionitem'){ignored.push(`Transición «${text(find(item,'name'))||'sin nombre'}»: se importa como corte, sin efecto.`);continue;}
   if(item.name!=='clipitem'&&item.name!=='generatoritem'){ignored.push(`Elemento <${item.name}> no soportado: se omitió.`);continue;}
   const clipName=text(find(item,'name'))||(item.name==='generatoritem'?'Generador':'Clip');
   const start=num(find(item,'start')),end=num(find(item,'end'));
   if(start===null||end===null){ignored.push(`«${clipName}» sin <start>/<end>: se omitió.`);continue;}
   const frames=Math.max(1,end-start);
   const fileNode=find(item,'file');
   const sourceRate=rateOf(item,rate);
   const sourceIn=num(find(item,'in'))??0;
   const path=fileNode?text(find(fileNode,'pathurl')):undefined;
   const fileRate=fileNode?rateOf(fileNode,sourceRate):sourceRate;
   const fileDuration=fileNode?num(find(fileNode,'duration')):null;
   const characteristics=fileNode?find(fileNode,'samplecharacteristics'):undefined;
   const sourceWidth=Math.round(num(find(characteristics,'width'))??width),sourceHeight=Math.round(num(find(characteristics,'height'))??height);
   const mediaName=fileNode?(text(find(fileNode,'name'))||path||clipName):clipName;
   const event=newEvent(trackId,item.name==='generatoritem'?'color':kind,framesToTicks(start,rate),framesToTicks(frames,rate));
   event.name=clipName;
   if(fileNode){
    const entry=mediaIndex.add(path||mediaName,mediaName,kind,framesToTicks(Math.max(fileDuration??frames,frames),fileRate),sourceWidth,sourceHeight,path?baseName(path):undefined);
    event.mediaId=entry.id;event.offset=framesToTicks(sourceIn,fileRate);
   }else{
    warnings.push(`«${clipName}» es un generador o un elemento sin archivo: se importa como color sólido y su contenido original no se reproduce.`);
    event.color='#000000';
   }
   p.events.push(event);
  }
 };
 videoNodes.forEach((node,index)=>{const track=p.tracks.filter(t=>t.kind==='video')[index];if(track)readTrack(node,'video',track.id);else ignored.push('El XML tiene más pistas de video que las creadas.');});
 audioNodes.forEach((node,index)=>{const track=p.tracks.filter(t=>t.kind==='audio')[index];if(track)readTrack(node,'audio',track.id);else ignored.push('El XML tiene más pistas de audio que las creadas.');});
 // Vincula pares de video y audio que comparten archivo y rango, como hace VEGAS al importar.
 linkAudioVideo(p);
 const unlinked=p.events.filter(e=>e.kind!=='audio'&&e.mediaId&&!e.group&&p.events.some(a=>a.kind==='audio'&&a.mediaId===e.mediaId));
 if(unlinked.length)warnings.push(`${unlinked.length} evento(s) de video comparten archivo con audio pero no coinciden en el tiempo: no se agruparon.`);
 return {project:p,report:{format:'Final Cut Pro 7 / DaVinci Resolve (xmeml v5)',source:sourceName,fps:rate.label,tracks:p.tracks.length,events:p.events.length,media:p.media.length,warnings,ignored}};
}
export function parseInterchange(name:string,content:string):Interchange{
 const kind=detectInterchange(name,content);
 if(kind==='veg')throw new Error(VEG_EXPLANATION);
 if(kind==='fcpxml')return parseFcpXml(content,name);
 if(kind==='edl')return parseEdl(content,name);
 throw new Error('El archivo no parece un proyecto de Corte 15, ni un XML de Final Cut Pro 7/DaVinci Resolve, ni un EDL CMX 3600. Para traer un proyecto desde VEGAS Pro 15, expórtalo antes como XML o EDL.');
}
