import {test} from 'node:test';
import assert from 'node:assert/strict';
import {insertGenerator,isGenerator,type DroppedGenerator} from '../lib/editor/generator-drop';
import {newProject,ticks,quantize} from '../lib/editor/project';
import {validateProject} from '../lib/editor/validation';
for(const kind of ['text','adjustment','solid','gradient','checkerboard','bars','noise'] as DroppedGenerator[])test(`drop ${kind} uses chosen track and frame and survives saving`,()=>{
 const p=newProject(),lane=p.tracks[1].id;const count=p.tracks.length;
 const e=insertGenerator(p,kind,lane,ticks(3.14159));
 assert.equal(e.trackId,lane);assert.equal(e.start,quantize(ticks(3.14159),p.fps));assert.equal(p.tracks.length,count);assert.equal(e.adjustmentLayer,kind==='adjustment'?true:undefined);
 const saved=validateProject(JSON.parse(JSON.stringify(p)));assert.deepEqual(saved.events[0],e);
});
test('blank space creates a video track at the top',()=>{const p=newProject();const e=insertGenerator(p,'adjustment',null,ticks(2));assert.equal(p.tracks.length,4);assert.equal(p.tracks[0].id,e.trackId);assert.equal(p.tracks[0].kind,'video');});
test('audio and stale tracks are rejected without changing the project',()=>{const p=newProject(),before=JSON.stringify(p);assert.throws(()=>insertGenerator(p,'text',p.tracks[2].id,0),/vídeo/);assert.throws(()=>insertGenerator(p,'solid','missing',0),/existe/);assert.equal(JSON.stringify(p),before);assert.equal(isGenerator('__proto__'),false);assert.equal(isGenerator('unknown'),false);});
