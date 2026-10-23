import {test} from 'node:test';
import assert from 'node:assert/strict';
import {waveformPath} from '../lib/editor/waveform';
import {waveformSource} from '../lib/editor/waveform-source';
import {PlaybackAudio} from '../lib/editor/audio';
test('quiet breaths keep their real amplitude; silence remains zero under visual gain',()=>{
 const pcm={sampleRate:1000,channels:[new Float32Array(1000)]};
 pcm.channels[0].fill(.002,300,350);
 const values=waveformSource(pcm)!(0,1,100)[0];
 assert.ok(values.slice(0,29).every(v=>v===0));
 assert.ok(values[32]>.0019);
 assert.notEqual(waveformPath(values,1),waveformPath(values,8));
 assert.match(waveformPath([0,.002,0],8),/0,50/);
 assert.match(waveformPath([0,.002,0],1),/49\.908/);
 assert.equal(pcm.channels[0][320],Math.fround(.002));
});
test('running seek cancels old scheduled audio and relocates clock synchronously',()=>{
 const audio=new PlaybackAudio();let stops=0,disconnects=0;
 audio.ctx={currentTime:10,sampleRate:48000} as AudioContext;
 audio.nodes.add({stop(){stops++},disconnect(){disconnects++}} as AudioBufferSourceNode);
 audio.seek(15);assert.equal(stops,1);assert.equal(disconnects,1);assert.equal(audio.nodes.size,0);
 assert.equal(audio.position,15);assert.equal(audio.scheduled,15);assert.equal(audio.clock(),15);
 audio.seek(4);audio.seek(8);assert.equal(audio.clock(),8);
 (audio.ctx as unknown as {currentTime:number}).currentTime=10.515;
 assert.ok(Math.abs(audio.clock()-8.5)<.0001);
});
