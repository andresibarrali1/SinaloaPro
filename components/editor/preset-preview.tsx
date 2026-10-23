"use client";
import {memo,useEffect,useRef} from 'react';
import {compose} from '@/lib/editor/compositor';
import {MediaLibrary} from '@/lib/editor/media';
import {ticks} from '@/lib/editor/project';
import {presetPreviewProject,type PreviewKind} from '@/lib/editor/preset-preview';
// One static render per visible card; only the hovered/focused card runs at 15 fps.
export const PresetPreview=memo(function PresetPreview({kind,id}:{kind:PreviewKind;id:string}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=ref.current;if(!canvas)return;
  const button=canvas.closest('button');
  const project=presetPreviewProject(kind,id),library=new MediaLibrary();
  const buffer=document.createElement('canvas');buffer.width=160;buffer.height=90;
  let visible=false,hover=false,focused=false,dead=false,busy=false,pending=false;
  let timer:ReturnType<typeof setTimeout>|undefined;let origin=0;
  const animated=()=> (hover||focused)&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
  const draw=async()=>{
   clearTimeout(timer);
   if(dead||!visible||document.hidden)return;
   if(busy){pending=true;return;}busy=true;
   const elapsed=animated()?((performance.now()-origin)/1000)%3:1.75;
   try{await compose(buffer,project,library,ticks(elapsed),{cancelled:()=>dead});
    if(!dead){canvas.getContext('2d')?.drawImage(buffer,0,0);canvas.removeAttribute('data-error');}
   }catch{if(!dead){canvas.setAttribute('data-error','true');canvas.title='Previsualización no disponible en este navegador';}}
   finally{busy=false;if(!dead&&visible&&(animated()||pending)){pending=false;timer=setTimeout(()=>void draw(),67);}}
  };
  const enter=()=>{hover=true;origin=performance.now();void draw();};
  const leave=()=>{hover=false;void draw();};
  const focus=()=>{focused=true;origin=performance.now();void draw();};
  const blur=()=>{focused=false;void draw();};
  const visibility=()=>{if(document.hidden)clearTimeout(timer);else void draw();};
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)void draw();else clearTimeout(timer);});observer.observe(canvas);
  button?.addEventListener('pointerenter',enter);button?.addEventListener('pointerleave',leave);button?.addEventListener('focus',focus);button?.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
  return()=>{dead=true;clearTimeout(timer);observer.disconnect();button?.removeEventListener('pointerenter',enter);button?.removeEventListener('pointerleave',leave);button?.removeEventListener('focus',focus);button?.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);library.dispose();};
 },[kind,id]);
 return <canvas ref={ref} width={160} height={90} className="preset-preview" aria-hidden="true"/>;
});
