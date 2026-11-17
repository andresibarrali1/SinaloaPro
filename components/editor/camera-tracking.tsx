'use client';
import {useState,useEffect,useRef} from 'react';
import type {PanCropWindowProps} from './pan-crop';
import {compose} from '@/lib/editor/compositor';
import {TrackingModal} from './tracking-modal';
import {defaultEffect} from '@/lib/editor/effects';
import {uid,seconds,sourceTime,type VideoEffect} from '@/lib/editor/project';
import {trackingNative} from '@/lib/editor/tracking-native';
export function CameraTracking({p}:{p:PanCropWindowProps}){
 const [select,setSelect]=useState(false),[open,setOpen]=useState(false);const preview=useRef<HTMLCanvasElement>(null);
 const event=p.project.events.find(e=>e.id===p.eventId);
 useEffect(()=>{if(!open||!event||!preview.current)return;let cancelled=false;const canvas=document.createElement('canvas');canvas.width=260;canvas.height=Math.max(2,Math.round(260*p.project.height/p.project.width));
 void compose(canvas,p.project,p.library,event.start+Math.max(0,Math.min(event.duration-1,p.time-event.start)),{cancelled:()=>cancelled}).then(()=>{if(!cancelled&&preview.current){preview.current.width=canvas.width;preview.current.height=canvas.height;preview.current.getContext('2d')?.drawImage(canvas,0,0);}}).catch(()=>{});return()=>{cancelled=true;};},[open,p.project,p.time,p.library,event]);
 if(!event||event.kind!=='video'||!p.onEventChange)return null;
 const effect=event.effects?.find(f=>f.kind==='tracking'),runtime=p.library.items.get(event.mediaId??'');
 const update=(patch:Partial<VideoEffect>)=>{const fx={...(effect??defaultEffect('tracking',uid())),...patch};p.onEventChange!({effects:effect?event.effects!.map(f=>f.id===effect.id?fx:f):[...(event.effects??[]),fx]});};
 return <details className="camera-tracking" onToggle={e=>setOpen(e.currentTarget.open)}><summary>Seguimiento de cámara</summary><div className="camera-tracking-panel">
 <strong>Mantener a la persona en encuadre</strong><canvas ref={preview} aria-label="Vista previa de autoencuadre" style={{display:"block",width:"100%",maxHeight:120,objectFit:"contain",background:"#000",marginTop:8}}/>
 <p>{effect?.trackingData?'Usa el seguimiento ya calculado.':'Selecciona una persona u objeto para calcular su recorrido.'}</p>
 <label><input type="checkbox" checked={!!effect?.enabled&&effect.trackingMode==='camera'} disabled={!effect?.trackingData} onChange={e=>update({trackingMode:e.target.checked?'camera':'box',enabled:true})}/> Autoencuadre</label>
 <label>Zoom máximo <input aria-label="Zoom del seguimiento" type="range" min={1} max={8} step={.1} value={effect?.trackingZoom??1.5} onChange={e=>update({trackingZoom:Number(e.target.value)})}/>{(effect?.trackingZoom??1.5).toFixed(1)}×</label>
 <label>Suavizado <input aria-label="Suavizado de cámara" type="range" min={0} max={.95} step={.05} value={effect?.softness??0} onChange={e=>update({softness:Number(e.target.value)})}/></label>
 <button disabled={!runtime||!trackingNative()||(event.effects?.length??0)>=24&&!effect} onClick={()=>{p.onPause?.();setSelect(true);}}>{effect?.trackingData?'Volver a seleccionar':'Seleccionar persona'}</button>
 <small>El zoom se reduce si hace falta para incluir la selección. Cerca de los bordes, la cámara se limita al vídeo. Los ajustes manuales de Pan/Crop se aplican después.</small>
 </div>{select&&runtime&&<TrackingModal file={runtime.file} sourceSeconds={sourceTime(event,Math.max(0,Math.min(event.duration-1,p.time-event.start)),seconds(p.project.media.find(m=>m.id===event.mediaId)?.duration??0),p.project.fps)} onDone={trackingData=>{update({trackingData,trackingMode:'camera',enabled:true});setSelect(false);}} onCancel={()=>setSelect(false)}/>}</details>;
}
