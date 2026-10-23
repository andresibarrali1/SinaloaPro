import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {compose} from '../lib/editor/compositor';
import {MediaLibrary} from '../lib/editor/media';
import {newProject,newEvent,newTrack,ticks} from '../lib/editor/project';
import {defaultEffect} from '../lib/editor/effects';
import {defaultCropFrame} from '../lib/editor/crop-frame';
import {validateProject} from '../lib/editor/validation';
const factory=(w:number,h:number)=>createCanvas(w,h) as unknown as HTMLCanvasElement;
function fixture(){const p=newProject();p.width=64;p.height=64;const base=newEvent(p.tracks[1].id,'color');base.color='#ff0000';const layer=newEvent(p.tracks[0].id,'color');layer.adjustmentLayer=true;layer.duration=ticks(2);p.events=[base,layer];return {p,base,layer};}
async function render(p:ReturnType<typeof newProject>,time=ticks(1)){const c=factory(64,64),lib=new MediaLibrary();try{await compose(c,p,lib,time,{createCanvas:factory});return c.getContext('2d')!;}finally{lib.dispose();}}
const pixel=(c:CanvasRenderingContext2D,x=32,y=32)=>Array.from(c.getImageData(x,y,1,1).data).slice(0,3);
test('neutral adjustment preserves lower composite and roundtrips',async()=>{const {p}=fixture();const saved=validateProject(JSON.parse(JSON.stringify(p)));assert.equal(saved.events[1].adjustmentLayer,true);assert.deepEqual(pixel(await render(saved)),[255,0,0]);});
test('effect applies below, never above',async()=>{const {p,layer}=fixture();layer.effects=[defaultEffect('invert','i')];assert.deepEqual(pixel(await render(p)),[0,255,255]);const top=newTrack('video');p.tracks.unshift(top);const e=newEvent(top.id,'color');e.color='#00ff00';p.events.push(e);assert.deepEqual(pixel(await render(p)),[0,255,0]);});
test('mute, zero opacity and duration bypass layer',async()=>{const {p,layer}=fixture();layer.effects=[defaultEffect('invert','i')];layer.muted=true;assert.deepEqual(pixel(await render(p)),[255,0,0]);layer.muted=false;layer.videoOpacity=0;assert.deepEqual(pixel(await render(p)),[255,0,0]);layer.videoOpacity=1;assert.deepEqual(pixel(await render(p,ticks(2.1))),[255,0,0]);p.tracks[0].mute=true;assert.deepEqual(pixel(await render(p)),[255,0,0]);});
test('Pan/Crop zoom out reframes the lower composite',async()=>{const {p,layer}=fixture();layer.transform.cropFrame={...defaultCropFrame(),width:2,height:2};const c=await render(p);assert.deepEqual(pixel(c),[255,0,0]);assert.deepEqual(pixel(c,2,2),[0,0,0]);});
test('stacked adjustments compose in order',async()=>{const {p,layer}=fixture();layer.effects=[defaultEffect('invert','i')];const top=newTrack('video');p.tracks.unshift(top);const e=newEvent(top.id,'color');e.adjustmentLayer=true;e.effects=[defaultEffect('invert','j')];p.events.push(e);assert.deepEqual(pixel(await render(p)),[255,0,0]);});
test('partial opacity blends with the original image',async()=>{const {p,layer}=fixture();layer.effects=[defaultEffect('invert','i')];layer.videoOpacity=.5;const rgb=pixel(await render(p));assert.ok(rgb.every(n=>n>=127&&n<=128));});

test('animated crop changes lower pixels and preserves event data',async()=>{const {p,layer}=fixture();const before=JSON.stringify(p);layer.keys=[{...layer.transform,time:0,cropFrame:defaultCropFrame()},{...layer.transform,time:ticks(1),cropFrame:{...defaultCropFrame(),width:2,height:2}}];const saved=validateProject(JSON.parse(JSON.stringify(p)));assert.deepEqual(pixel(await render(saved,0),2,2),[255,0,0]);assert.deepEqual(pixel(await render(saved,ticks(1)),2,2),[0,0,0]);assert.equal(p.events.length,2);assert.notEqual(JSON.stringify(p),before);});
test('cancelled adjustment stops before publishing its result',async()=>{const {p}=fixture();let calls=0;const c=factory(64,64);await compose(c,p,new MediaLibrary(),ticks(1),{createCanvas:factory,cancelled:()=>++calls>=2});assert.ok(calls>=2);});
