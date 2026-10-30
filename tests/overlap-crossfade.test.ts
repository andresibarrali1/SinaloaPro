import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newProject,newEvent,ticks,clone,autoCrossfade} from '../lib/editor/project';
import {compose} from '../lib/editor/compositor';
import {MediaLibrary} from '../lib/editor/media';
import {createCanvas} from '@napi-rs/canvas';
for(const moved of [0,1])test(`solapamiento con clip movido ${moved}, mezcla y separación`,async()=>{
 const p=newProject();p.width=p.height=32;const lane=p.tracks.find(t=>t.kind==='video')!;
 const a=newEvent(lane.id,'color',0,ticks(3)),b=newEvent(lane.id,'color',ticks(2),ticks(3));a.color='#ff0000';b.color='#0000ff';p.events.push(a,b);
 autoCrossfade(p,[p.events[moved].id]);assert.equal(a.fadeOut,ticks(1));assert.equal(b.fadeIn,ticks(1));
 const surface=createCanvas(32,32);await compose(surface as unknown as HTMLCanvasElement,p,new MediaLibrary(),ticks(2.5),{createCanvas:(w,h)=>createCanvas(w,h) as unknown as HTMLCanvasElement});
 const pixel=surface.getContext('2d').getImageData(16,16,1,1).data;
 assert.ok(Math.abs(pixel[0]-128)<3&&Math.abs(pixel[2]-128)<3,`mezcla rojo/azul ${pixel}`);
 const before=clone(p);if(moved===1)b.start=ticks(4);else a.start=ticks(7);
 autoCrossfade(p,[p.events[moved].id],before);assert.equal(a.fadeOut,0);assert.equal(b.fadeIn,0);
});
test('no crea fundidos al tocar bordes ni entre pistas',()=>{
 const p=newProject(),a=newEvent(p.tracks[0].id,'color'),b=newEvent(p.tracks[0].id,'color',ticks(5));p.events.push(a,b);
 autoCrossfade(p,[a.id]);assert.equal(a.fadeOut,0);b.start=ticks(4);b.trackId='otra';autoCrossfade(p,[a.id]);assert.equal(b.fadeIn,0);
});
