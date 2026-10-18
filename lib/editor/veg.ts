// Lector de proyectos VEGAS (.veg).
//
// El formato es un contenedor binario propietario, pero no es opaco: la firma es «riff.», el tamaño real del
// archivo está en 0x10 y el resto es un árbol de bloques «list/» con el identificador de clase (11 bytes) y
// un tamaño de 64 bits que incluye la cabecera, de modo que los bloques hermanos se encadenan por aritmética.
// Además el archivo incrusta un paquete XMP estándar (metadatos documentados) y guarda rutas y textos como
// cadenas UTF-16. Con eso se puede reconstruir con fiabilidad: propiedades, duración, lista de medios y
// títulos. Lo que NO se reconstruye es la línea de tiempo (posición de cada evento, efectos y curvas), porque
// el significado de los registros numéricos internos no está documentado y no se puede verificar.
export type VegChunk = { offset:number; tag:string; size:number; children:number };
export type VegMediaRef = { path:string; name:string; extension:string; offset:number };
export type VegTitle = { name:string; text:string; rtf:string; offset:number };
export type VegAnalysis = {
 name:string; bytes:number; declaredSize:number; sizeMatches:boolean;
 chunks:{total:number;top:VegChunk[]};
 duration:number|null; frameRate:number|null; frameRateConfidence:'alta'|'baja'|'ninguna';
 width:number|null; height:number|null; dimensionsConfirmed:boolean;
 createDate:string|null; modifyDate:string|null; software:string|null;
 media:VegMediaRef[]; titles:VegTitle[];
 warnings:string[]; notes:string[];
};
const MEDIA_EXTENSIONS=['.mp4','.mov','.avi','.mxf','.mkv','.webm','.m4v','.wmv','.mpg','.mpeg','.mts','.m2ts','.3gp','.mp3','.wav','.aif','.aiff','.flac','.m4a','.aac','.ogg','.wma','.caf','.png','.jpg','.jpeg','.bmp','.gif','.tif','.tiff','.psd','.tga','.exr','.dpx'];
const STANDARD_RATES:[number,string][]=[[23.976023976023978,'23.976'],[24,'24'],[25,'25'],[29.97002997002997,'29.97'],[30,'30'],[50,'50'],[59.94005994005994,'59.94'],[60,'60']];
const u32=(bytes:Uint8Array,at:number)=>at+4<=bytes.length?((bytes[at]|bytes[at+1]<<8|bytes[at+2]<<16|bytes[at+3]<<24)>>>0):0;
const u64=(bytes:Uint8Array,at:number)=>{if(at+8>bytes.length)return 0;return u32(bytes,at+4)*0x100000000+u32(bytes,at);};
const f64=(bytes:Uint8Array,at:number)=>{if(at+8>bytes.length)return NaN;const view=new DataView(bytes.buffer,bytes.byteOffset+at,8);return view.getFloat64(0,true);};
const tagAt=(bytes:Uint8Array,at:number)=>{if(at+5>bytes.length)return '';let text='';for(let index=0;index<5;index++){const code=bytes[at+index];if(code<32||code>126)return '';text+=String.fromCharCode(code);}return /^[A-Za-z]{4}\/$/.test(text)?text:'';};
const asciiAt=(bytes:Uint8Array,from:number,to:number)=>{const end=Math.min(to,bytes.length);let text='';for(let index=from;index<end;index++)text+=String.fromCharCode(bytes[index]);return text;};
export function isVeg(bytes:Uint8Array){return bytes.length>=20&&bytes[0]===0x72&&bytes[1]===0x69&&bytes[2]===0x66&&bytes[3]===0x66&&bytes[4]===0x2e;}
// Cadenas UTF-16LE (rutas y textos). El formato guarda así todo lo legible por humanos.
function utf16Strings(bytes:Uint8Array,minimum=4){const found:{offset:number;value:string}[]=[];let index=0;const length=bytes.length;while(index<length-3){if(bytes[index]!==0&&bytes[index+1]===0){const start=index;let text='';while(index<length-1&&bytes[index]!==0&&bytes[index+1]===0){text+=String.fromCharCode(bytes[index]);index+=2;}if(text.length>=minimum)found.push({offset:start,value:text});}else index++;}return found;}
// Bloques «list/»: la cabecera son 5 bytes de etiqueta, 11 de identificador y un tamaño de 64 bits que
// incluye la propia cabecera (24 bytes), así que el siguiente hermano está en offset+tamaño.
export function vegChunkChain(bytes:Uint8Array,declaredSize:number){
 const candidates:number[]=[];
 for(let index=0;index+24<=bytes.length;index++)if(tagAt(bytes,index)==='list/'){const size=u64(bytes,index+16);if(size>=24&&index+size<=declaredSize+1&&index>0x40)candidates.push(index);}
 for(const start of candidates){
  const chain:VegChunk[]=[];let position=start,guard=0;
  while(guard++<4096){
   if(position+24>bytes.length)break;
   const tag=tagAt(bytes,position);
   if(tag!=='list/')break;
   const size=u64(bytes,position+16);
   if(size<24)break;
   let children=0;
   for(let probe=position+24;probe+24<=Math.min(position+size,bytes.length);probe++)if(tagAt(bytes,probe)==='list/'){const inner=u64(bytes,probe+16);if(inner>=24&&probe+inner<=position+size)children++;}
   chain.push({offset:position,tag,size,children});
   position+=size;
  }
  if(chain.length&&Math.abs(position-declaredSize)<=1)return chain;
 }
 return [];
}
function countChunks(bytes:Uint8Array,declaredSize:number){let total=0;for(let index=0;index+24<=bytes.length;index++)if(tagAt(bytes,index)==='list/'){const size=u64(bytes,index+16);if(size>=24&&index+size<=declaredSize+1)total++;}return total;}
function parseXmp(bytes:Uint8Array){
 const text=asciiAt(bytes,0,bytes.length);
 const start=text.indexOf('<?xpacket begin');
 if(start<0)return null;
 const end=text.indexOf('<?xpacket end',start);
 if(end<0)return null;
 const packet=text.slice(start,end+24);
 const field=(name:string)=>{const match=new RegExp(`<${name}>([^<]*)</${name}>`).exec(packet);return match?match[1]:null;};
 const value=Number(field('xmpDM:value')),scale=field('xmpDM:scale')??'1/1';
 const [numerator,denominator]=scale.split('/').map(Number);
 const duration=Number.isFinite(value)&&Number.isFinite(numerator)&&Number.isFinite(denominator)&&denominator?value*numerator/denominator:null;
 const agents=[...packet.matchAll(/<stEvt:softwareAgent>([^<]*)<\/stEvt:softwareAgent>/g)].map(match=>match[1]);
 return {duration:duration&&duration>0?duration:null,createDate:field('xmp:CreateDate'),modifyDate:field('xmp:ModifyDate'),software:agents.at(-1)??null};
}
// La velocidad de fotogramas y el tamaño no tienen una posición fija, así que se buscan en la cabecera
// (antes del primer bloque) y se informa de la confianza: solo se dan por buenos los valores inequívocos.
function detectFrameRate(bytes:Uint8Array,limit:number){
 const rateLike=STANDARD_RATES.map(([value,label])=>({value,label}));
 const found:{offset:number;label:string;fractional:boolean}[]=[];
 for(let index=0x40;index+8<=Math.min(limit,bytes.length);index++){
  const value=f64(bytes,index);
  if(!Number.isFinite(value)||value<23.9||value>60.1)continue;
  const match=rateLike.find(entry=>Math.abs(entry.value-value)<1e-6);
  if(match)found.push({offset:index,label:match.label,fractional:Math.abs(value-Math.round(value))>1e-9});
 }
 const unique=[...new Map(found.map(entry=>[entry.label,entry])).values()];
 if(!unique.length)return {frameRate:null,confidence:'ninguna' as const,candidates:[] as string[]};
 const fractional=unique.filter(entry=>entry.fractional);
 if(fractional.length===1&&unique.length===1)return {frameRate:Number(fractional[0].label),confidence:'alta' as const,candidates:unique.map(entry=>entry.label)};
 if(fractional.length===1&&unique.every(entry=>entry.fractional||Number(entry.label)%30===0||Number(entry.label)%25===0))return {frameRate:Number(fractional[0].label),confidence:'alta' as const,candidates:unique.map(entry=>entry.label)};
 return {frameRate:null,confidence:'baja' as const,candidates:unique.map(entry=>entry.label)};
}
function detectDimensions(bytes:Uint8Array,limit:number){
 const pairs:{offset:number;width:number;height:number}[]=[];
 for(let index=0x40;index+8<=Math.min(limit,bytes.length);index+=4){
  const width=u32(bytes,index),height=u32(bytes,index+4);
  if(width<320||width>7680||height<240||height>4320)continue;
  if(width%2||height%2)continue;
  const ratio=width/height;
  if(ratio<1||ratio>2.4)continue;
  const standard=[[16,9],[4,3],[3,2],[21,9],[1,1]].some(([a,b])=>Math.abs(ratio-a/b)<0.01);
  if(standard&&!pairs.some(pair=>pair.width===width&&pair.height===height))pairs.push({offset:index,width,height});
 }
 const first=pairs[0];
 return {width:first?.width??null,height:first?.height??null,pairs:pairs.length,confirmed:pairs.length>0&&pairs.every(pair=>pair.width===first.width&&pair.height===first.height)};
}
// Los títulos se guardan como RTF. Antes de limpiar códigos hay que descartar los grupos de destino
// (tabla de fuentes, colores, estilos…) porque su texto interno no forma parte del título.
function stripRtfDestinations(rtf:string){
 const destinations=['fonttbl','colortbl','stylesheet','info','pict','header','footer','object','*','filetbl','listtable','listoverridetable','revtbl','rsidtbl','generator'];
 let result='',index=0;
 while(index<rtf.length){
  if(rtf[index]==='{'){
   const match=/^\{\\([a-z]+|\*)/.exec(rtf.slice(index));
   if(match&&destinations.includes(match[1])){
    let depth=0,scan=index;
    for(;scan<rtf.length;scan++){if(rtf[scan]==='{')depth++;else if(rtf[scan]==='}'){depth--;if(depth===0){scan++;break;}}}
    index=scan;continue;
   }
  }
  result+=rtf[index++];
 }
 return result;
}
function rtfToText(rtf:string){
 return stripRtfDestinations(rtf)
  .replace(/\{\\\*[^{}]*\}/g,'')
  .replace(/\\'([0-9a-f]{2})/gi,'')
  .replace(/\\par[d]?/g,'\n')
  .replace(/\\line/g,'\n')
  .replace(/\\tab/g,'\t')
  .replace(/\\[a-z]+-?\d*\s?/gi,'')
  .replace(/[{}]/g,'')
  .replace(/\r\n?/g,'\n')
  .replace(/[ \t]+\n/g,'\n')
  .replace(/\n[ \t]+/g,'\n')
  .replace(/\n{3,}/g,'\n\n')
  .trim();
}
const PARAMETER_NAMES=new Set(['Text','TextColor','AnimationName','Scale','Location','Alignment','AdvancedGroup','Background','Tracking','LineSpacing','OutlineGroup','OutlineWidth','OutlineColor','ShadowGroup','ShadowEnable','ShadowColor','ShadowOffsetX','ShadowOffsetY','ShadowBlur','TextColor2','_None','(Predeterminado)','VEGAS','Text2']);
export function analyzeVeg(bytes:Uint8Array,name='proyecto.veg'):VegAnalysis{
 const warnings:string[]=[],notes:string[]=[];
 if(!isVeg(bytes))throw new Error('El archivo no empieza por la firma «riff.» de un proyecto de VEGAS.');
 const declaredSize=u32(bytes,0x10);
 const sizeMatches=declaredSize===bytes.length;
 if(!sizeMatches)warnings.push(`El tamaño declarado en la cabecera (${declaredSize} bytes) no coincide con el archivo (${bytes.length} bytes).`);
 const chain=vegChunkChain(bytes,sizeMatches?declaredSize:bytes.length);
 if(!chain.length)warnings.push('No se pudo recorrer el árbol de bloques: el archivo puede estar truncado o ser de otra versión.');
 const xmp=parseXmp(bytes);
 if(!xmp)notes.push('El archivo no contiene un paquete XMP incrustado: la duración y las fechas no se pueden leer.');
 const headerLimit=chain.length?chain[0].offset:bytes.length;
 const rate=detectFrameRate(bytes,headerLimit);
 const dimensions=detectDimensions(bytes,headerLimit);
 if(rate.confidence==='baja')notes.push(`Se encontraron varios valores compatibles con velocidades de fotogramas (${rate.candidates.join(', ')}): no se elige ninguno.`);
 if(dimensions.pairs>1)notes.push(`Hay ${dimensions.pairs} pares de resolución distintos en la cabecera; se muestra el primero.`);
 const strings=utf16Strings(bytes);
 const media:VegMediaRef[]=strings
  .filter(entry=>{const lower=entry.value.toLowerCase();return MEDIA_EXTENSIONS.some(extension=>lower.endsWith(extension))&&entry.value.length>3&&!entry.value.includes('\n');})
  .map(entry=>{const path=entry.value;const clean=path.replace(/\\/g,'/');const base=clean.slice(clean.lastIndexOf('/')+1)||path;return {path,name:base,extension:(base.slice(base.lastIndexOf('.')).toLowerCase()),offset:entry.offset};})
  .filter((entry,index,list)=>list.findIndex(other=>other.path.toLowerCase()===entry.path.toLowerCase())===index);
 const titles:VegTitle[]=[];
 strings.forEach((entry,index)=>{
  if(entry.value.startsWith('{\\rtf1')){
   let titleName='';
   for(let back=index-1;back>=0&&back>index-6;back--){const candidate=strings[back].value;if(candidate&&!PARAMETER_NAMES.has(candidate)&&candidate.length<120&&!candidate.startsWith('{')&&!candidate.includes('\\')){titleName=candidate;break;}}
   const text=rtfToText(entry.value);
   if(text)titles.push({name:titleName||'(sin nombre)',text,rtf:entry.value,offset:entry.offset});
  }
 });
 if(!titles.length)notes.push('No se encontraron títulos ni textos con formato RTF en el proyecto.');
 notes.push('La línea de tiempo no se reconstruye: la posición, los efectos y las curvas de cada evento viven en registros numéricos internos cuyo significado no está documentado, y deducirlos a ojo sería inventar.');
 return {
  name,bytes:bytes.length,declaredSize,sizeMatches,
  chunks:{total:countChunks(bytes,sizeMatches?declaredSize:bytes.length),top:chain},
  duration:xmp?.duration??null,frameRate:rate.frameRate,frameRateConfidence:rate.confidence,
  width:dimensions.width,height:dimensions.height,dimensionsConfirmed:dimensions.confirmed,
  createDate:xmp?.createDate??null,modifyDate:xmp?.modifyDate??null,software:xmp?.software??null,
  media,titles,warnings,notes,
 };
}
export const VEG_LIMITS='De un .veg se leen las propiedades, la lista de medios y los títulos, porque están en la cabecera y en un paquete XMP estándar. La línea de tiempo (posición de los eventos, efectos y curvas) no se importa: esos datos están en registros binarios internos sin documentar.';
