import {test,expect} from '@playwright/test';
test('tracking selection, progress and persisted effect (mock IPC)',async({page})=>{
 await page.goto('/?bienvenida=no',{waitUntil:'domcontentloaded'});
 await page.evaluate(async()=>{
  const url='/tests/tracking-harness.tsx';const {mountTrackingHarness}=await import(/* @vite-ignore */url);await mountTrackingHarness();
 });
 const modal=page.getByRole('dialog',{name:'¿A quién quieres seguir?'});await expect(modal).toBeVisible();const follow=modal.getByRole('button',{name:'Seguir',exact:true});await expect(follow).toBeDisabled();
 await expect(modal.getByText('Dibuja un rectángulo sobre la persona u objeto.')).toBeVisible();
 await page.waitForFunction(()=>{const v=document.querySelector('.tracking-frame video') as HTMLVideoElement;return v?.readyState>=2;});
 const canvas=modal.locator('canvas'),r=(await canvas.boundingBox())!;await page.mouse.move(r.x+r.width*.2,r.y+r.height*.2);await page.mouse.down();await page.mouse.move(r.x+r.width*.5,r.y+r.height*.7,{steps:5});await page.mouse.up();await expect(follow).toBeEnabled();await page.screenshot({path:'evidencias/tracking-selection.png'});await follow.click();await expect(modal.locator('progress')).toBeVisible();await expect(modal).toBeHidden();
 const data=await page.evaluate(()=>({args:(window as any).trackingArgs,data:(window as any).persisted.events[0].effects[0].trackingData,unlistened:(window as any).unlistened}));expect(data.args.bbox.w/data.data.width).toBeCloseTo(.3,1);expect(data.data.points).toHaveLength(1);expect(data.unlistened).toBe(true);
 await page.locator('#tracking-test-host').getByRole('button',{name:'Volver a seleccionar'}).click();await expect(modal).toBeVisible();await modal.getByRole('button',{name:'Cancelar'}).click();await expect(modal).toBeHidden();expect(await page.evaluate(()=>(window as any).persisted.events[0].effects[0].trackingData.points.length)).toBe(1);
 await page.getByRole('button',{name:'Abrir Pan/Crop de prueba'}).click();await page.locator('.camera-tracking summary').click();await page.getByLabel('Autoencuadre',{exact:true}).check();
 expect(await page.evaluate(()=>(window as any).persisted.events[0].effects[0].trackingMode)).toBe('camera');
 await page.getByLabel('Zoom del seguimiento').fill('2');expect(await page.evaluate(()=>(window as any).persisted.events[0].effects[0].trackingZoom)).toBe(2);
 await page.screenshot({path:'evidencias/tracking-camera.png'});

});
test('exported MP4 contains tracking outline and audio',async({page})=>{
 await page.goto('/?bienvenida=no',{waitUntil:'domcontentloaded'});
 const result=await page.evaluate(async()=>{
  const load=(url:string):Promise<any>=>import(/* @vite-ignore */url);
  const {renderProject}=await load('/lib/editor/export.ts'),{newProject,newEvent,ticks}=await load('/lib/editor/project.ts'),{MediaLibrary}=await load('/lib/editor/media.ts'),{defaultEffect}=await load('/lib/editor/effects.ts');
  const p=newProject();p.width=320;p.height=180;const lib=new MediaLibrary();
  const image=document.createElement('canvas');image.width=320;image.height=180;image.getContext('2d')!.fillRect(0,0,320,180);
  const data=Float32Array.from({length:p.sampleRate},(_,i)=>.3*Math.sin(i/p.sampleRate*440*2*Math.PI));
  lib.items.set('m',{file:new File(['x'],'fixture'),image,firstVideo:0,pcm:{sampleRate:p.sampleRate,channels:[data,data]}});
  p.media.push({id:'m',name:'fixture',duration:ticks(1),width:320,height:180,kind:'video',hasAudio:true,size:1,modified:0,mime:'video/mp4'});
  const e=newEvent(p.tracks[0].id,'video',0,ticks(1));e.mediaId='m';e.effects=[{...defaultEffect('tracking','fx'),size:6,trackingData:{fps:25,width:320,height:180,points:Array.from({length:25},(_,frame)=>({frame,time:frame/25,x:20+frame*2,y:40,w:50,h:60,ok:true}))}}];p.events.push(e);
  const a=newEvent(p.tracks.find((t:any)=>t.kind==='audio').id,'audio',0,ticks(1));a.mediaId='m';p.events.push(a);
  const r=await renderProject(p,lib,{width:320,height:180,fps:{num:25,den:1},format:'mp4',quality:'high',scope:'full',start:0,end:ticks(1),includeVideo:true,includeAudio:true,bitrateMbps:2},new AbortController().signal,()=>{});
  const decoded=new MediaLibrary();const meta=await decoded.import(new File([r.blob],'result.mp4',{type:'video/mp4'}));const item=decoded.items.get(meta.id)!;const frame=await item.canvas.getCanvas(.4);const c=document.createElement('canvas');c.width=320;c.height=180;c.getContext('2d')!.drawImage(frame.canvas,0,0);const pixel=c.getContext('2d')!.getImageData(40,60,1,1).data;
  const peak=Math.max(...item.pcm.channels[0]);decoded.dispose();return {green:pixel[1],red:pixel[0],peak,audio:meta.hasAudio};
 });
 expect(result.green).toBeGreaterThan(150);expect(result.red).toBeLessThan(90);expect(result.audio).toBe(true);expect(result.peak).toBeGreaterThan(.15);
});

test('exported MP4 auto camera centers subject and retains audio',async({page})=>{
 await page.goto('/?bienvenida=no',{waitUntil:'domcontentloaded'});
 const result=await page.evaluate(async()=>{
  const load=(url:string):Promise<any>=>import(/* @vite-ignore */url);
  const {renderProject}=await load('/lib/editor/export.ts'),{newProject,newEvent,ticks}=await load('/lib/editor/project.ts'),{MediaLibrary}=await load('/lib/editor/media.ts'),{defaultEffect}=await load('/lib/editor/effects.ts');
  const p=newProject();p.width=320;p.height=180;const lib=new MediaLibrary();
  const image=document.createElement('canvas');image.width=320;image.height=180;image.getContext('2d')!.fillRect(0,0,320,180);image.getContext('2d')!.fillStyle='#fff';image.getContext('2d')!.fillRect(80,60,30,40);
  const data=Float32Array.from({length:p.sampleRate},(_,i)=>.3*Math.sin(i/p.sampleRate*440*2*Math.PI));
  lib.items.set('m',{file:new File(['x'],'fixture'),image,firstVideo:0,pcm:{sampleRate:p.sampleRate,channels:[data,data]}});
  p.media.push({id:'m',name:'fixture',duration:ticks(1),width:320,height:180,kind:'video',hasAudio:true,size:1,modified:0,mime:'video/mp4'});
  const e=newEvent(p.tracks[0].id,'video',0,ticks(1));e.mediaId='m';e.effects=[{...defaultEffect('tracking','fx'),size:6,trackingMode:'camera',trackingZoom:2,trackingData:{fps:25,width:320,height:180,points:Array.from({length:25},(_,frame)=>({frame,time:frame/25,x:80,y:60,w:30,h:40,ok:true}))}}];p.events.push(e);
  const a=newEvent(p.tracks.find((t:any)=>t.kind==='audio').id,'audio',0,ticks(1));a.mediaId='m';p.events.push(a);
  const r=await renderProject(p,lib,{width:320,height:180,fps:{num:25,den:1},format:'mp4',quality:'high',scope:'full',start:0,end:ticks(1),includeVideo:true,includeAudio:true,bitrateMbps:2},new AbortController().signal,()=>{});
  const decoded=new MediaLibrary();const meta=await decoded.import(new File([r.blob],'result.mp4',{type:'video/mp4'}));const item=decoded.items.get(meta.id)!;const frame=await item.canvas.getCanvas(.4);const c=document.createElement('canvas');c.width=320;c.height=180;c.getContext('2d')!.drawImage(frame.canvas,0,0);const pixel=c.getContext('2d')!.getImageData(160,90,1,1).data;
  const peak=Math.max(...item.pcm.channels[0]);decoded.dispose();return {green:pixel[1],red:pixel[0],peak,audio:meta.hasAudio};
 });
 expect(result.green).toBeGreaterThan(150);expect(result.red).toBeGreaterThan(200);expect(result.audio).toBe(true);expect(result.peak).toBeGreaterThan(.15);
});
