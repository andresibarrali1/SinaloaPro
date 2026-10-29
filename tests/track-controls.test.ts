import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {compose} from '../lib/editor/compositor';
import {MediaLibrary} from '../lib/editor/media';
import {newProject,newEvent,newTrack,ticks,frameTicks,transform,History,clone} from '../lib/editor/project';
import {defaultEffect} from '../lib/editor/effects';
import {validateProject} from '../lib/editor/validation';
import {makeChild,makePrimary,trackPose,videoTracks} from '../lib/editor/track-controls';
const factory=(w:number,h:number)=>createCanvas(w,h) as unknown as HTMLCanvasElement;
function fixture(){
 const p=newProject();p.width=64;p.height=64;
 const top=newTrack('video','Primaria'),child=newTrack('video','Secundaria'),bottom=newTrack('video','Fondo');
 p.tracks=[top,child,bottom];
 const red=newEvent(child.id,'color');red.color='#ff0000';red.duration=ticks(3);red.transform.scale=.5;
 const blue=newEvent(bottom.id,'color');blue.color='#0000ff';blue.duration=ticks(3);
 p.events=[red,blue];return {p,top,child,bottom,red};
}
async function render(p:ReturnType<typeof newProject>,time=ticks(1)){
 const c=factory(64,64),lib=new MediaLibrary();try{await compose(c,p,lib,time,{createCanvas:factory});return c.getContext('2d')!;}finally{lib.dispose();}
}
const pixel=(c:CanvasRenderingContext2D,x=32,y=32)=>Array.from(c.getImageData(x,y,1,1).data).slice(0,3);
test('track effects operate on its isolated pixels without affecting lower tracks',async()=>{
 const {p,child}=fixture();child.effects=[defaultEffect('invert','effect')];
 const ctx=await render(p);assert.deepEqual(pixel(ctx),[0,255,255]);assert.deepEqual(pixel(ctx,2,2),[0,0,255]);
});
test('parent group transform and effect affect children; promotion restores independence',async()=>{
 const {p,top,child}=fixture();assert.equal(makeChild(p,child.id),true);
 top.effects=[defaultEffect('invert','effect')];top.transform.x=.25;
 const ctx=await render(p);assert.deepEqual(pixel(ctx,45,32),[0,255,255]);assert.deepEqual(pixel(ctx,17,32),[0,0,255]);
 makePrimary(p,child.id);assert.equal(child.parentId,undefined);assert.deepEqual(pixel(await render(p)),[255,0,0]);
});
test('group opacity preserves transparency and blends with lower content',async()=>{
 const {p,top,child}=fixture();makeChild(p,child.id);top.transform.opacity=.5;
 const color=pixel(await render(p));assert.ok(color[0]>=127&&color[0]<=128);assert.ok(color[2]>=127&&color[2]<=128);
});
test('parent mute and solo include descendants',async()=>{
 const {p,top,child,bottom}=fixture();makeChild(p,child.id);
 top.mute=true;assert.deepEqual(pixel(await render(p)),[0,0,255]);
 top.mute=false;top.solo=true;assert.deepEqual(videoTracks(p).map(t=>t.id),[top.id,child.id]);
 assert.deepEqual(pixel(await render(p),2,2),[0,0,0]);assert.ok(!videoTracks(p).includes(bottom));
});
test('track motion keys interpolate and automation off uses the static value',async()=>{
 const {p,child}=fixture();child.keys=[{...transform(),time:0,x:0},{...transform(),time:ticks(2),x:.5}];
 assert.equal(trackPose(child,ticks(1)).x,.25);
 assert.deepEqual(pixel(await render(p),17,32),[0,0,255]);
 child.automationMode='off';assert.equal(trackPose(child,ticks(1)).x,0);assert.deepEqual(pixel(await render(p)),[255,0,0]);
});
test('motion blur samples moving content and bypass restores the crisp frame',async()=>{
 const {p,child,red}=fixture();red.transform.scale=.15;
 const end=ticks(1);child.keys=[{...transform(),time:end-frameTicks(p.fps),x:0},{...transform(),time:end,x:.5}];
 child.motionBlurFrames=1;const blurred=await render(p,end);assert.ok(pixel(blurred,40,32)[0]>0);
 child.bypassMotionBlur=true;assert.deepEqual(pixel(await render(p,end),40,32),[0,0,255]);
});
test('track settings survive project validation and undo/redo',()=>{
 const {p,top,child}=fixture(),history=new History();history.push(p);
 makeChild(p,child.id);child.effects=[defaultEffect('invert','fx')];child.visibleButtons=['effects','blur'];child.showAutomation=true;child.motionBlurFrames=.5;child.bypassMotionBlur=true;child.automationMode='read';child.keys=[{...transform(),time:0}];
 const saved=validateProject(JSON.parse(JSON.stringify(p)));assert.deepEqual(saved.tracks[1],p.tracks[1]);
 const before=history.undo(p)!;assert.equal(before.tracks[1].parentId,undefined);
 const after=history.redo(before)!;assert.equal(after.tracks[1].parentId,top.id);
});
test('invalid hierarchy is rejected rather than recursing indefinitely',()=>{
 const {p,top,child}=fixture();top.parentId=child.id;
 assert.throws(()=>validateProject(p),/primaria/);
});
