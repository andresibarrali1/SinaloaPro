// Informe de capacidades por motor. No afirma nada que no se haya observado en la ejecución:
// imprime en la salida lo que cada navegador expone y qué ocurre al importar medios reales.
import {test,expect} from '@playwright/test';import path from 'node:path';
const fixture=(s:string)=>path.resolve('tests/fixtures',s);
test('capacidades del motor y resultado real de importación',async({page,browserName})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`);});
 await page.goto('/?bienvenida=no');
 const apis=await page.evaluate(()=>({VideoDecoder:typeof (globalThis as unknown as {VideoDecoder?:unknown}).VideoDecoder,AudioDecoder:typeof (globalThis as unknown as {AudioDecoder?:unknown}).AudioDecoder,VideoEncoder:typeof (globalThis as unknown as {VideoEncoder?:unknown}).VideoEncoder,AudioEncoder:typeof (globalThis as unknown as {AudioEncoder?:unknown}).AudioEncoder,OffscreenCanvas:typeof (globalThis as unknown as {OffscreenCanvas?:unknown}).OffscreenCanvas,createImageBitmap:typeof createImageBitmap,AudioContext:typeof (globalThis as unknown as {AudioContext?:unknown}).AudioContext,indexedDB:typeof indexedDB,storageEstimate:typeof navigator.storage?.estimate,isSecureContext:window.isSecureContext}));
 const caps=await page.evaluate(async()=>{try{const modulePath='/lib/editor/export.ts';const mod=await import(modulePath);return await (mod as {capabilities:(w:number,h:number,s:number)=>Promise<{mp4:boolean;webm:boolean}>}).capabilities(320,180,48000);}catch(e){return {error:e instanceof Error?e.message:String(e)};}});
 console.log(`[${browserName}] APIs ${JSON.stringify(apis)}`);
 console.log(`[${browserName}] códecs ${JSON.stringify(caps)}`);
 for(const name of ['Video_A.mp4','Audio.wav','corrupto.mp4']){
  await page.locator('input[type=file]').nth(0).setInputFiles(fixture(name));
  await page.waitForTimeout(4000);
  const status=await page.locator('.statusbar span').first().innerText();
  const items=await page.locator('.media-item').count();
  console.log(`[${browserName}] importar ${name} -> elementos=${items} · estado="${status.replace(/\s+/g,' ').trim()}"`);
 }
 console.log(`[${browserName}] errores de página: ${errors.length?errors.join(' | '):'ninguno'}`);
});
// Medición de rendimiento reproducible del renderizado: 300 fotogramas a 1280×720 (10 s a 30 fps).
test('rendimiento de renderizado: 10 s a 1280×720',async({page,browserName})=>{
 test.skip(browserName!=='chromium','La medición de referencia se toma en Chromium.');
 await page.goto('/?bienvenida=no');
 const caps=await page.evaluate(async()=>{const modulePath='/lib/editor/export.ts';const mod=await import(modulePath);return await (mod as {capabilities:(w:number,h:number,s:number)=>Promise<{mp4:boolean}>}).capabilities(1280,720,48000);});
 test.skip(!caps.mp4,'Sin codificador H.264/AAC: no se puede medir esta ruta.');
 await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();
 await page.getByRole('button',{name:'Color sólido',exact:true}).click();
 await page.getByLabel('Duración (s)',{exact:true}).fill('10');
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await page.getByRole('button',{name:'Renderizar como…',exact:true}).click();
 await page.getByLabel('Ancho',{exact:true}).fill('1280');
 await page.getByLabel('Alto',{exact:true}).fill('720');
 const result=page.waitForEvent('download',{timeout:180000});
 const started=Date.now();
 await page.getByRole('button',{name:'Renderizar y descargar'}).click();
 const rendered=await result;const elapsed=(Date.now()-started)/1000;
 await rendered.saveAs(path.resolve('test-results',rendered.suggestedFilename()));
 const status=(await page.locator('.export-status').innerText()).replace(/\s+/g,' ').trim();
 console.log(`[${browserName}] 300 fotogramas a 1280×720 en ${elapsed.toFixed(2)} s = ${(300/elapsed).toFixed(1)} fps de render · "${status}"`);
 expect(elapsed).toBeLessThan(120);
});
