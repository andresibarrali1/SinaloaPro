import {test} from 'node:test';import assert from 'node:assert/strict';
import {newProject,newEvent,ticks,pose} from '../lib/editor/project';
import {applyMotionPreset,MOTION_PRESETS} from '../lib/editor/motion-presets';
import {validateProject} from '../lib/editor/validation';
test('all motions fit short and long events and survive project validation',()=>{
 for(const duration of [1,ticks(.2),ticks(5)])for(const preset of MOTION_PRESETS){const p=newProject(),e=newEvent(p.tracks[0].id,'color',0,duration);e.transform.x=.15;e.transform.scale=.8;const animated=applyMotionPreset(e,preset.id,1);p.events=[animated];const saved=validateProject(JSON.parse(JSON.stringify(p)));assert.deepEqual(saved.events[0].keys,animated.keys);assert(animated.keys.every(k=>k.time>=0&&k.time<duration));assert.equal(e.keys.length,0);assert.equal(animated.transform.x,.15);}
});
test('entrance settles to original and exit holds original until its ending',()=>{
 const e=newEvent('track','color',0,ticks(5));e.transform.scale=.7;
 const enter=applyMotionPreset(e,'rise',1);assert.equal(pose(enter,0).opacity,0);assert.equal(pose(enter,ticks(2)).scale,.7);
 const exit=applyMotionPreset(e,'exit-up',1);assert.equal(pose(exit,ticks(2)).y,0);assert.equal(pose(exit,e.duration-1).opacity,0);
});
