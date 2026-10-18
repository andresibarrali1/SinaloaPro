// Recursos de Pexels. Se usa la API oficial con la clave del usuario; la búsqueda y la descarga ocurren en el
// navegador, sin servidor intermedio, y el vídeo descargado se importa como cualquier otro archivo local.
export const PEXELS_ENDPOINT='https://api.pexels.com/videos/search';
export type PexelsFile = { id:number; quality:string; fileType:string; width:number; height:number; link:string };
export type PexelsVideo = { id:number; url:string; duration:number; width:number; height:number; user:string; preview:string; files:PexelsFile[] };
type RawFile={id?:number;quality?:string;file_type?:string;width?:number;height?:number;link?:string};
type RawVideo={id?:number;url?:string;duration?:number;width?:number;height?:number;image?:string;user?:{name?:string};video_files?:RawFile[]};
export function parsePexelsResponse(payload:unknown):PexelsVideo[]{
 const videos=(payload as {videos?:RawVideo[]})?.videos;
 if(!Array.isArray(videos))return [];
 return videos.map(video=>({
  id:Number(video.id)||0,
  url:String(video.url??''),
  duration:Number(video.duration)||0,
  width:Number(video.width)||0,
  height:Number(video.height)||0,
  user:String(video.user?.name??''),
  preview:String(video.image??''),
  files:(video.video_files??[]).map(file=>({id:Number(file.id)||0,quality:String(file.quality??''),fileType:String(file.file_type??''),width:Number(file.width)||0,height:Number(file.height)||0,link:String(file.link??'')})).filter(file=>file.link),
 })).filter(video=>video.files.length>0);
}
// Se elige un MP4 que quepa con holgura en memoria y que no sea el más pequeño: primero HD/UHD hasta 1920 de
// ancho, y si no hay, el mayor disponible por debajo de 1920.
export function pickFile(video:PexelsVideo,maxWidth=1920){
 const mp4=video.files.filter(file=>/mp4/i.test(file.fileType)||/\.mp4($|\?)/i.test(file.link));
 const pool=mp4.length?mp4:video.files;
 const within=pool.filter(file=>file.width>0&&file.width<=maxWidth).sort((a,b)=>b.width-a.width);
 if(within.length)return within[0];
 return pool.sort((a,b)=>a.width-b.width)[0];
}
export async function searchVideos(query:string,apiKey:string,options:{perPage?:number;orientation?:'landscape'|'portrait'|'square'|'any';signal?:AbortSignal;fetchImpl?:typeof fetch}={}):Promise<PexelsVideo[]>{
 if(!apiKey.trim())throw new Error('Falta la clave de la API de Pexels. Añádela en Configuración → Claves de API.');
 const term=query.trim();
 if(!term)throw new Error('Escribe qué recursos quieres buscar.');
 const doFetch=options.fetchImpl??fetch;
 const url=new URL(PEXELS_ENDPOINT);
 url.searchParams.set('query',term);
 url.searchParams.set('per_page',String(Math.max(1,Math.min(20,options.perPage??6))));
 if(options.orientation&&options.orientation!=='any')url.searchParams.set('orientation',options.orientation);
 const response=await doFetch(url.toString(),{headers:{Authorization:apiKey.trim(),Accept:'application/json'},signal:options.signal});
 const raw=await response.text();
 if(!response.ok)throw new Error(`Pexels respondió ${response.status}: ${raw.slice(0,200)||response.statusText}`);
 let payload:unknown;
 try{payload=JSON.parse(raw);}catch{throw new Error('La respuesta de Pexels no es un JSON válido.');}
 const videos=parsePexelsResponse(payload);
 if(!videos.length)throw new Error(`Pexels no devolvió resultados para «${term}».`);
 return videos;
}
export async function downloadFile(url:string,fileName:string,fetchImpl:typeof fetch=fetch):Promise<File>{
 const response=await fetchImpl(url);
 if(!response.ok)throw new Error(`No se pudo descargar el recurso (${response.status}).`);
 const blob=await response.blob();
 return new File([blob],fileName,{type:blob.type||'video/mp4'});
}
export function pexelsFileName(video:PexelsVideo,file:PexelsFile){
 const base=(video.url.split('/').filter(Boolean).at(-1)??`pexels-${video.id}`).replace(/[^a-z0-9-]/gi,'-');
 return `${base}-${video.id}-${file.width}p.mp4`;
}
export function attribution(video:PexelsVideo){return video.user?`Pexels · ${video.user} · ${video.url}`:`Pexels · ${video.url}`;}
