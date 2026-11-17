'use client';
import {useEffect,useRef,useState} from 'react';
import type {TrackingData} from '@/lib/editor/project';
import {screenBox,type Box} from '@/lib/editor/tracking';
import {prepareTracking,calculateTracking,cancelTracking,type TrackingInfo} from '@/lib/editor/tracking-native';
export function TrackingModal({file,sourceSeconds,onDone,onCancel}:{file:File;sourceSeconds:number;onDone:(data:TrackingData)=>void;onCancel:()=>void}){
 const video=useRef<HTMLVideoElement>(null),canvas=useRef<HTMLCanvasElement>(null),start=useRef<{x:number;y:number}|null>(null);
 const alive=useRef(true),job=useRef<string|null>(null),abort=useRef(new AbortController());
 const [url,setUrl]=useState(''),[info,setInfo]=useState<TrackingInfo|null>(null),[box,setBox]=useState<Box|null>(null),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[label,setLabel]=useState('Preparando vídeo…'),[error,setError]=useState('');
 const frame=info?Math.min(Math.max(0,Math.floor(sourceSeconds*info.fps)),(info.frames>0?info.frames-1:Infinity)):0;
 useEffect(()=>{alive.current=true;abort.current=new AbortController();const objectUrl=URL.createObjectURL(file);setUrl(objectUrl);
 void prepareTracking(file,abort.current.signal,setProgress).then(({path,info})=>{if(!alive.current){void cancelTracking(path);return;}job.current=path;setInfo(info);setLabel('Dibuja un rectángulo sobre la persona u objeto.');setProgress(0);}).catch(e=>{if(alive.current)setError(e.message);});
 return()=>{alive.current=false;abort.current.abort();if(job.current)void cancelTracking(job.current);URL.revokeObjectURL(objectUrl);};},[file]);
 useEffect(()=>{const v=video.current;if(!v||!info)return;
 const seek=()=>{v.pause();setReady(false);v.currentTime=frame/info.fps;};
 const done=()=>setReady(true);v.addEventListener('seeked',done);v.addEventListener('loadeddata',done);v.addEventListener('loadedmetadata',seek);
 let callback:number|undefined;if(v.requestVideoFrameCallback)callback=v.requestVideoFrameCallback(()=>{if(alive.current)setReady(true);});
 if(v.readyState>=1)seek();if(v.readyState>=2&&frame===0)setReady(true);
 return()=>{v.removeEventListener('seeked',done);v.removeEventListener('loadeddata',done);v.removeEventListener('loadedmetadata',seek);if(callback!==undefined)v.cancelVideoFrameCallback(callback);};},[info,frame,url]);
 const pointer=(e:React.PointerEvent<HTMLCanvasElement>)=>{const r=e.currentTarget.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
 const draw=(e:React.PointerEvent<HTMLCanvasElement>)=>{if(!start.current||!info)return;const c=e.currentTarget,r=c.getBoundingClientRect();const b=screenBox(start.current,pointer(e),r,{width:info.width,height:info.height});setBox(b);c.width=info.width;c.height=info.height;const ctx=c.getContext('2d')!;ctx.strokeStyle='#00ff70';ctx.lineWidth=3*info.width/r.width;ctx.strokeRect(b.x,b.y,b.w,b.h);};
 async function follow(){if(!box||!job.current||!info)return;setBusy(true);setError('');setLabel('Siguiendo el objeto con CSRT…');setProgress(0);
 try{const result=await calculateTracking(job.current,frame,box,(done,total)=>{if(alive.current){setProgress(total?done/total:0);setLabel(`Seguimiento: ${done} de ${total||'?'} fotogramas`);}});job.current=null;if(alive.current)onDone(result);}catch(e){if(alive.current){setError(e instanceof Error?e.message:String(e));setBusy(false);setLabel('Cierra esta ventana y vuelve a seleccionar para reintentar.');job.current=null;}}}
 return <div className="tracking-overlay" onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape')onCancel();}}><section role="dialog" aria-modal="true" aria-label="¿A quién quieres seguir?" className="tracking-dialog">
 <h2>¿A quién quieres seguir?</h2><p>{label}</p>
 <div className="tracking-frame" style={{aspectRatio:info?`${info.width}/${info.height}`:'16/9',width:info?`min(100%, ${62*info.width/info.height}vh)`:'100%'}}>
 <video ref={video} src={url||undefined} muted playsInline preload="auto" onError={()=>setError('No se pudo mostrar este vídeo. Revincula un archivo compatible.')} />
 <canvas ref={canvas} aria-label="Seleccionar objeto" onPointerDown={e=>{if(!ready||busy||!info)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);start.current=pointer(e);setBox(null);draw(e);}} onPointerMove={draw} onPointerUp={e=>{draw(e);start.current=null;}} onPointerCancel={()=>{start.current=null;setBox(null);}} />
 </div>
 {(!info||busy)&&!error&&<progress max={1} value={progress}/>}
 {info&&<small>Desde el fotograma {frame} · {info.fps.toFixed(3)} fps · Recuadro verde · El análisis se guarda en el proyecto.</small>}
 {error&&<p role="alert">{error}</p>}
 <footer><button onClick={onCancel}>Cancelar</button><button disabled={!ready||!box||box.w<4||box.h<4||busy||!!error||!info} onClick={()=>void follow()}>Seguir</button></footer>
 </section></div>;
}
