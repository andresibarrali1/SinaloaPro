import type {Box} from './tracking';
import type {TrackingData} from './project';
type Native={core:{invoke:<T>(cmd:string,args?:Record<string,unknown>)=>Promise<T>};event:{listen:<T>(name:string,callback:(event:{payload:T})=>void)=>Promise<()=>void>}};
export function trackingNative(){return (window as unknown as {__TAURI__?:Native}).__TAURI__;}
export type TrackingInfo={fps:number;width:number;height:number;frames:number};
export async function prepareTracking(file:File,signal:AbortSignal,progress:(fraction:number)=>void){
 const native=trackingNative();if(!native)throw new Error('Para calcular el seguimiento, abre este proyecto en Sinaloa Pro de escritorio.');
 const path=await native.core.invoke<string>('begin_tracking_media');
 try{for(let offset=0;offset<file.size;offset+=262144){if(signal.aborted)throw new DOMException('Cancelado','AbortError');const bytes=Array.from(new Uint8Array(await file.slice(offset,offset+262144).arrayBuffer()));await native.core.invoke('tracking_media_chunk',{path,bytes});progress(Math.min(1,(offset+bytes.length)/file.size));}
 const info=await native.core.invoke<TrackingInfo>('tracking_info',{path});if(signal.aborted)throw new DOMException('Cancelado','AbortError');return {path,info};
 }catch(e){await native.core.invoke('cancel_tracking',{path}).catch(()=>{});throw e;}
}
export async function calculateTracking(path:string,startFrame:number,bbox:Box,onProgress:(done:number,total:number)=>void):Promise<TrackingData>{
 const native=trackingNative()!;
 let unlisten:(()=>void)|undefined;
 try{
  unlisten=await native.event.listen<{job:string;done:number;total:number}>('tracking-progress',({payload})=>{if(payload.job===path)onProgress(payload.done,payload.total);});
  return await native.core.invoke<TrackingData>('track_object',{path,startFrame,bbox});
 }catch(error){
  // A failed subscription must release the uploaded media too, so another job can start.
  await native.core.invoke('cancel_tracking',{path}).catch(()=>{});
  throw error;
 }finally{unlisten?.();}
}
export async function cancelTracking(path:string){await trackingNative()?.core.invoke('cancel_tracking',{path});}
