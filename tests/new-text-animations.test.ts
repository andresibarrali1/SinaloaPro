import {test} from 'node:test';
import assert from 'node:assert/strict';
import {animationState,STILL} from '../lib/editor/titles';
import {newProject,newEvent,ticks,type TextAnimation} from '../lib/editor/project';
import {validateProject} from '../lib/editor/validation';
import {createCanvas} from '@napi-rs/canvas';
import {compose} from '../lib/editor/compositor';
import {MediaLibrary} from '../lib/editor/media';
const names:TextAnimation[]=['slide-left','slide-right','spin-in','drop-in','zoom-out','pulse','float','swing'];
const frame={width:320,height:180};
const factory=(w:number,h:number)=>createCanvas(w,h) as unknown as HTMLCanvasElement;
for(const animation of names)test(`${animation}: persistencia, tiempos y píxeles animados`,async()=>{
 const p=newProject();p.width=320;p.height=180;
 const e=newEvent(p.tracks[0].id,'text',0,ticks(3));e.text='Sinaloa';e.fontSize=36;e.animation=animation;p.events.push(e);
 const saved=validateProject(JSON.parse(JSON.stringify(p)));assert.equal(saved.events[0].animation,animation);
 for(const duration of [ticks(.02),ticks(3),ticks(30)])for(const t of [0,.1,.4,1]){
  const state=animationState(animation,duration*t,duration,frame);
  assert.ok(Object.values(state).every(Number.isFinite));assert.ok(state.scale>0);assert.ok(state.opacity>=0&&state.opacity<=1);
  assert.deepEqual(state,animationState(animation,duration*t,duration,frame));
 }
 if(names.indexOf(animation)<5){const end=animationState(animation,ticks(3),ticks(3),frame);for(const key of Object.keys(STILL) as (keyof typeof STILL)[])assert.ok(Math.abs(end[key]-STILL[key])<1e-10);}
 const canvas=factory(320,180),library=new MediaLibrary();
 try {
  await compose(canvas,saved,library,ticks(.1),{createCanvas:factory});
  const a=canvas.getContext('2d')!.getImageData(0,0,320,180).data.slice();
  await compose(canvas,saved,library,ticks(.37),{createCanvas:factory});
  const b=canvas.getContext('2d')!.getImageData(0,0,320,180).data;
  assert.notDeepEqual(a,b);
 }finally{library.dispose();}
});
