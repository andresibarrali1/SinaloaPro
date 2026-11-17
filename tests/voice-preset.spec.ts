import {test,expect} from '@playwright/test';import {voiceWav} from '../lib/editor/voice-preset';
const bytes=Buffer.from(voiceWav([Float32Array.from({length:48000},(_,i)=>.15*Math.sin(i/48000*2*Math.PI*180))],48000));
test('voice preset drag, restore and click use real worker and persisted WAV',async({page})=>{
 await page.goto('/?bienvenida=no',{waitUntil:'domcontentloaded'});
 await page.locator('input[type=file][multiple]').setInputFiles({name:'Voz.wav',mimeType:'audio/wav',buffer:bytes});
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('corte15-autosave-v1')||'{}'));
 await expect.poll(async()=>(await state()).media?.length).toBe(1);
 // Media import goes to the library; double click inserts its audio event.
 await page.locator('.media-item').filter({hasText:'Voz.wav'}).dblclick();
 await expect(page.locator('.timeline-event')).toHaveCount(1);
 const original=(await state()).media[0].id;
 await page.getByRole('tab',{name:'Presets de audio',exact:true}).click();
 const transfer=await page.evaluateHandle(()=>{const d=new DataTransfer();d.setData('application/sinaloa-audio-preset','andres-audition-v1');return d;});
 const event=page.locator('.timeline-event');await event.dispatchEvent('dragover',{dataTransfer:transfer});await expect(event).toHaveClass(/effect-drop-target/);await event.dispatchEvent('drop',{dataTransfer:transfer});
 await expect.poll(async()=>(await state()).events?.[0]?.audioPreset?.sourceMediaId).toBe(original);
 const processed=(await state()).events[0].mediaId;expect(processed).not.toBe(original);expect((await state()).media.find((m:any)=>m.id===processed).preserveAudioRate).toBe(true);
 const peak=await page.evaluate(async(id)=>{const {readFile}=await import('/lib/editor/storage.ts' as string);const file=await readFile(id);const c=new OfflineAudioContext(1,1,48000);const a=await c.decodeAudioData(await file.arrayBuffer());let max=0;for(const v of a.getChannelData(0))max=Math.max(max,Math.abs(v));return 20*Math.log10(max);},processed);expect(peak).toBeCloseTo(-3.04,3);
 await event.click();await page.getByRole('button',{name:'Quitar preset de los audios seleccionados'}).click();await expect.poll(async()=>(await state()).events[0].mediaId).toBe(original);
 await page.locator('.voice-preset-card').click();await expect.poll(async()=>(await state()).events[0].audioPreset?.id).toBe('andres-audition-v1');
 const exportedPeak=await page.evaluate(async()=>{const load=(u:string):Promise<any>=>import(/* @vite-ignore */u);const {readFile}=await load('/lib/editor/storage.ts'),{MediaLibrary}=await load('/lib/editor/media.ts'),{renderProject}=await load('/lib/editor/export.ts');const p=JSON.parse(localStorage.getItem('corte15-autosave-v1')!);const lib=new MediaLibrary();for(const m of p.media){const f=await readFile(m.id);if(f)await lib.import(f,m.id,m.preserveAudioRate);}const r=await renderProject(p,lib,{width:p.width,height:p.height,fps:p.fps,format:'wav',quality:'high',scope:'full',start:0,end:0,includeVideo:false,includeAudio:true,bitrateMbps:null},new AbortController().signal,()=>{});const c=new OfflineAudioContext(2,1,48000),audio=await c.decodeAudioData(await r.blob.arrayBuffer());let peak=0;for(const v of audio.getChannelData(0))peak=Math.max(peak,Math.abs(v));lib.dispose();return 20*Math.log10(peak);});expect(exportedPeak).toBeCloseTo(-3.04,2);
 await page.reload({waitUntil:'domcontentloaded'});await expect.poll(async()=>(await state()).events[0].audioPreset?.id).toBe('andres-audition-v1');
});
