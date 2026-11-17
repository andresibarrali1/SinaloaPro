import {PanCropWindow} from '../components/editor/pan-crop';
import React from 'react';
import {createRoot} from 'react-dom/client';
import {EffectsWindow} from '../components/editor/effects';
import {newProject,newEvent,ticks,parseProject} from '../lib/editor/project';
import {defaultEffect} from '../lib/editor/effects';
import {MediaLibrary} from '../lib/editor/media';
export async function mountTrackingHarness(){
  const file=new File([await (await fetch('/tests/fixtures/Video_A.mp4')).blob()],'Video_A.mp4',{type:'video/mp4'});
  const video=document.createElement('video');video.src=URL.createObjectURL(file);await new Promise<void>(resolve=>{video.onloadedmetadata=()=>resolve();});const width=video.videoWidth,height=video.videoHeight;URL.revokeObjectURL(video.src);
  let listener:(event:any)=>void=()=>{};
  (window as any).__TAURI__={event:{listen:async(_name:string,fn:any)=>{listener=fn;return ()=>{(window as any).unlistened=true;};}},core:{invoke:async(name:string,args:any)=>{
   if(name==='begin_tracking_media')return 'test-job';if(name==='tracking_info')return {width,height,fps:25,frames:100};
   if(name==='track_object'){(window as any).trackingArgs=args;listener({payload:{job:'test-job',done:20,total:100}});await new Promise(r=>setTimeout(r,250));return {width,height,fps:25,points:[{frame:0,time:0,...args.bbox,ok:true}]};}return null;
  }}};
  const p=newProject(),e=newEvent(p.tracks[0].id,'video',0,ticks(4));e.mediaId='m';e.effects=[defaultEffect('tracking','fx')];p.events.push(e);p.media.push({id:'m',name:file.name,size:file.size,modified:0,kind:'video',width,height,duration:ticks(4),hasAudio:false,mime:file.type});const lib=new MediaLibrary();lib.items.set('m',{file,firstVideo:0});
  const host=document.createElement('div');host.id='tracking-test-host';document.body.appendChild(host);
  function Harness(){const [event,setEvent]=React.useState(e),[pan,setPan]=React.useState(false);const project={...p,events:[event]};const onChange=(patch:any)=>{const updated={...event,...patch};setEvent(updated);(window as any).persisted=parseProject(JSON.stringify({...p,events:[updated]}));};
   return pan?React.createElement(PanCropWindow,{project,library:lib,eventId:event.id,time:0,duration:event.duration,eventStart:0,pose:event.transform,keys:event.keys,source:{width,height},label:'Prueba',onEventChange:onChange,onPose:()=>{},onMask:()=>{},onKeys:()=>{},onBeginMask:()=>{},onMaskPath:()=>{},onSeek:()=>{},onClose:()=>setPan(false)}):React.createElement(React.Fragment,null,React.createElement(EffectsWindow,{project,library:lib,event,time:0,onChange,onClose:()=>{}}),React.createElement('button',{onClick:()=>setPan(true)},'Abrir Pan/Crop de prueba'));}

  createRoot(host).render(React.createElement(Harness));
}

