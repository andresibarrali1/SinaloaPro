import {test} from 'node:test';
import assert from 'node:assert/strict';
import {transcribe,buildSrt,parseSrt} from '../lib/editor/speech';
import {addSubtitles} from '../lib/editor/subtitles';
import {newProject,ticks} from '../lib/editor/project';

test('transcripción crea una palabra por evento y SRT y conserva silencios y palabras cortas',async()=>{
 const fetchImpl=(async(_url:unknown,init?:RequestInit)=>{
  assert.deepEqual((init?.body as FormData).getAll('timestamp_granularities[]'),['segment','word']);
  return new Response(JSON.stringify({text:'Hola, qué tal',segments:[{start:0,end:1.5,text:'Hola, qué tal'}],words:[{start:0,end:.1,word:'Hola,'},{start:.4,end:.5,word:'qué'},{start:1,end:1.5,word:'tal'}]}));
 }) as typeof fetch;
 const result=await transcribe(new Float32Array(16000),16000,'test',{fetchImpl});
 assert.equal(result.estimatedWordTimes,false);
 assert.equal(result.cues.length,1);
 assert.deepEqual(result.wordCues.map(c=>c.text),['Hola,','qué','tal']);
 assert.deepEqual(parseSrt(buildSrt(result.wordCues)),result.wordCues);
 const p=newProject();addSubtitles(p,result.wordCues);
 assert.equal(p.events.length,3);
 assert.equal(p.events[0].duration,ticks(.1));
 assert.equal(p.events[1].start,ticks(.4));
 assert.ok(p.events[0].start+p.events[0].duration<p.events[1].start);
});
test('sin tiempos de palabras divide la frase e informa que son aproximados',async()=>{
 const fetchImpl=(async()=>new Response(JSON.stringify({segments:[{start:2,end:4,text:'  Uno   dos  '},{start:6,end:7,text:'tres'}]}))) as typeof fetch;
 const result=await transcribe(new Float32Array(16000),16000,'test',{fetchImpl});
 assert.equal(result.estimatedWordTimes,true);
 assert.deepEqual(result.wordCues,[{start:2,end:3,text:'Uno'},{start:3,end:4,text:'dos'},{start:6,end:7,text:'tres'}]);
});
