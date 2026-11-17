import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {screenBox,trackingPoint} from '../lib/editor/tracking';
import {newProject,newEvent,ticks,parseProject,type TrackingData} from '../lib/editor/project';
import {defaultEffect} from '../lib/editor/effects';
import {compose} from '../lib/editor/compositor';
import {MediaLibrary} from '../lib/editor/media';
const data:TrackingData={fps:25,width:100,height:100,points:[{frame:0,time:0,x:10,y:10,w:20,h:20,ok:true},{frame:1,time:.04,x:20,y:10,w:20,h:20,ok:true},{frame:2,time:.08,x:20,y:10,w:20,h:20,ok:false}]};
test('selection maps CSS pixels to video pixels in either drag direction',()=>{assert.deepEqual(screenBox({x:80,y:60},{x:20,y:10},{width:100,height:100},{width:1920,height:1080}),{x:384,y:108,w:1152,h:540});});
test('interpolation is source-timed and never displays lost or out-of-range points',()=>{assert.equal(trackingPoint(data,.02)?.x,15);assert.equal(trackingPoint(data,.08),null);assert.equal(trackingPoint(data,-1),null);assert.equal(trackingPoint(data,9),null);assert.ok(trackingPoint(data,.04,.5)!.x<20);});
test('trajectory survives project serialization and renders transformed source pixels',async()=>{
 const p=newProject();p.width=p.height=100;const e=newEvent(p.tracks[0].id,'image',0,ticks(1));e.mediaId='fixture';e.effects=[{...defaultEffect('tracking','t'),trackingData:data}];p.events.push(e);
 p.media.push({id:'fixture',name:'fixture.png',size:1,modified:0,kind:'image',duration:ticks(1),width:100,height:100,hasAudio:false,mime:'image/png'});
 const restored=parseProject(JSON.stringify(p));assert.deepEqual(restored.events[0].effects?.[0].trackingData,data);
 const library=new MediaLibrary(),source=createCanvas(100,100);source.getContext('2d').fillRect(0,0,100,100);library.items.set('fixture',{image:source as unknown as ImageBitmap,file:{} as File,firstVideo:0});
 const canvas=createCanvas(100,100);await compose(canvas as unknown as HTMLCanvasElement,restored,library,ticks(.02),{createCanvas:(w,h)=>createCanvas(w,h) as unknown as HTMLCanvasElement});
 assert.ok(canvas.getContext('2d').getImageData(15,10,1,1).data[1]>200,'export compositor includes green outline');
});
import {trackingCamera} from '../lib/editor/tracking';
test('camera centers the person, preserves aspect and holds the last known position',()=>{
 const fx={...defaultEffect('tracking','camera'),trackingMode:'camera' as const,trackingZoom:2,trackingData:{...data,points:data.points.map(p=>({...p,x:30,y:40,w:10,h:10}))}};
 const c=trackingCamera(fx,.02,1)!;assert.equal(c.w,50);assert.equal(c.h,50);assert.equal(c.x+c.w/2,35);assert.equal(c.y+c.h/2,45);
 assert.deepEqual(trackingCamera(fx,.08,1),c);assert.equal(trackingCamera(fx,-1,1),null);
 fx.trackingData.points[0].x=0;const edge=trackingCamera(fx,0,1)!;assert.equal(edge.x,0);
 fx.trackingData.points[0].w=80;assert.ok(trackingCamera(fx,0,1)!.w>=96);
});
test('camera export compositor centers source content without a green outline',async()=>{
 const p=newProject();p.width=p.height=100;const e=newEvent(p.tracks[0].id,'image',0,ticks(1));e.mediaId='cam';e.effects=[{...defaultEffect('tracking','cam'),trackingMode:'camera',trackingZoom:2,trackingData:{fps:25,width:100,height:100,points:[{frame:0,time:0,x:25,y:40,w:10,h:10,ok:true}]}}];p.events.push(e);
 p.media.push({id:'cam',name:'cam',size:1,modified:0,kind:'image',duration:ticks(1),width:100,height:100,hasAudio:false,mime:'image/png'});
 const restored=parseProject(JSON.stringify(p));assert.equal(restored.events[0].effects![0].trackingMode,'camera');
 const lib=new MediaLibrary(),image=createCanvas(100,100),ctx=image.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,100,100);ctx.fillStyle='#fff';ctx.fillRect(25,40,10,10);lib.items.set('cam',{file:{} as File,firstVideo:0,image:image as unknown as ImageBitmap});
 const out=createCanvas(100,100);await compose(out as unknown as HTMLCanvasElement,restored,lib,0,{createCanvas:(w,h)=>createCanvas(w,h) as unknown as HTMLCanvasElement});
 const pixel=out.getContext('2d').getImageData(50,50,1,1).data;assert.ok(pixel[0]>240&&pixel[1]>240&&pixel[2]>240);
});
