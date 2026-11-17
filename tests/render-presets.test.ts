import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RENDER_PRESETS} from '../lib/editor/render-presets';
test('render presets retain range and declare their outputs: MP3 is audio only, the rest keep video and audio',()=>{
 for(const preset of RENDER_PRESETS){
  const result={scope:'range',start:10,end:100,includeVideo:false,...preset.settings};
  assert.equal(result.scope,'range');assert.equal(result.start,10);assert.equal(result.end,100);
  assert.equal(result.includeAudio,true);
  if(preset.settings.format==='mp3'){assert.equal(result.includeVideo,false);continue;}
  assert.equal(result.includeVideo,true);
  assert.ok(result.width!%2===0 && result.height!%2===0);
  assert.ok(result.width!<=3840 && result.height!<=2160);
  assert.ok(result.fps!.num>0 && result.fps!.den>0);
 }
 assert.equal(new Set(RENDER_PRESETS.map(p=>p.id)).size,RENDER_PRESETS.length);
});
test('the four MP3 presets are the audio-only ladder, one per quality',()=>{
 const mp3=RENDER_PRESETS.filter(p=>p.settings.format==='mp3');
 assert.deepEqual(mp3.map(p=>p.settings.quality),['draft','medium','high','master']);
 assert.ok(mp3.every(p=>p.settings.includeVideo===false&&p.settings.includeAudio===true));
});
test('vertical, square, UHD and 60 fps presets have their actual output dimensions',()=>{
 const get=(id:string)=>RENDER_PRESETS.find(p=>p.id===id)!.settings;
 assert.equal(get('mp4-vertical').width,1080);assert.equal(get('mp4-vertical').height,1920);
 assert.equal(get('mp4-square').width,get('mp4-square').height);
 assert.equal(get('mp4-2160-60').width,3840);assert.equal(get('mp4-2160-60').fps!.num,60);
 assert.equal(get('webm-1080').format,'webm');
});
