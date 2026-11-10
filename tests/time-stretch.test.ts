import {test} from 'node:test';import assert from 'node:assert/strict';
import {newProject,newEvent,ticks,clone} from '../lib/editor/project';import {stretchEvent} from '../lib/editor/time-stretch';
for(const edge of ['left','right'] as const)test(`velocidad y audio vinculado ${edge}`,()=>{
 const p=newProject(),v=newEvent(p.tracks[0].id,'video',ticks(5),ticks(4)),a=newEvent(p.tracks[2].id,'audio',ticks(5),ticks(4));v.group=a.group='g';v.offset=a.offset=ticks(2);v.fadeIn=ticks(1);v.keys=[{...v.transform,time:ticks(2)}];p.events.push(v,a);const before=clone(p);
 stretchEvent(p,v.id,edge,edge==='right'?-ticks(2):ticks(2));assert.equal(v.speed,2);assert.equal(a.speed,2);assert.equal(v.duration,ticks(2));assert.equal(v.offset,ticks(2));assert.equal(v.duration*v.speed,before.events[0].duration);assert.equal(v.fadeIn,ticks(.5));assert.equal(v.keys[0].time,ticks(1));assert.equal(a.start,v.start);
 stretchEvent(p,v.id,edge,edge==='right'?ticks(2):-ticks(2));assert.equal(v.speed,1);assert.equal(v.start,ticks(5));assert.equal(v.duration,ticks(4));
});
test('bloqueo vinculado evita cambios y límite 4x',()=>{const p=newProject(),e=newEvent(p.tracks[0].id,'video');p.events.push(e);e.locked=true;stretchEvent(p,e.id,'right',-ticks(50));assert.equal(e.speed,1);e.locked=false;stretchEvent(p,e.id,'right',-ticks(50));assert.equal(e.speed,4);});
