import {test,expect} from '@playwright/test';
test('MP3 renders real mixed audio, supports streaming and cancellation',async({page})=>{
 await page.goto('/?bienvenida=no');
 const result=await page.evaluate(async()=>{
  const load=(url:string)=>import(/* @vite-ignore */ url);
  const {renderProject,capabilities}=await load('/lib/editor/export.ts');
  const {newProject,newEvent,ticks}=await load('/lib/editor/project.ts');
  const {MediaLibrary}=await load('/lib/editor/media.ts');
  const p=newProject(),lib=new MediaLibrary(),rate=p.sampleRate;
  const track=p.tracks.find((t:any)=>t.kind==='audio');
  const e=newEvent(track.id,'audio',0,ticks(1));e.mediaId='tone';p.events.push(e);
  p.media.push({id:'tone',name:'tone.wav',duration:ticks(1),kind:'audio',hasAudio:true});
  const data=Float32Array.from({length:rate},(_,i)=>.4*Math.sin(2*Math.PI*440*i/rate));
  lib.items.set('tone',{firstVideo:0,file:new File(['tone'],'tone.wav'),pcm:{channels:[data,data],sampleRate:rate}});
  const settings={width:320,height:180,fps:{num:30,den:1},format:'mp3',quality:'high',scope:'full',start:0,end:ticks(1),includeVideo:false,includeAudio:true,bitrateMbps:null};
  const cap=await capabilities(320,180,rate);
  const r=await renderProject(p,lib,settings,new AbortController().signal,()=>{});
  const ctx=new AudioContext();const decoded=await ctx.decodeAudioData(await r.blob.arrayBuffer());
  const peak=Math.max(...decoded.getChannelData(0));await ctx.close();
  let closed=false,bytes=0;
  await renderProject(p,lib,settings,new AbortController().signal,()=>{},{stream:new WritableStream({write(chunk){bytes+=chunk.data.length;},close(){closed=true;}})});
  const ac=new AbortController();let cancelled=false;
  try{await renderProject(p,lib,settings,ac.signal,()=>ac.abort());}catch(error){cancelled=(error as DOMException).name==='AbortError';}
  return {available:cap.mp3,mime:r.blob.type,size:r.bytes,duration:decoded.duration,channels:decoded.numberOfChannels,peak,closed,bytes,cancelled};
 });
 expect(result.available).toBe(true);expect(result.mime).toBe('audio/mpeg');expect(result.size).toBeGreaterThan(10000);
 expect(result.duration).toBeGreaterThan(.95);expect(result.duration).toBeLessThan(1.15);expect(result.channels).toBe(2);expect(result.peak).toBeGreaterThan(.2);
 expect(result.closed).toBe(true);expect(result.bytes).toBeGreaterThan(10000);expect(result.cancelled).toBe(true);
});
