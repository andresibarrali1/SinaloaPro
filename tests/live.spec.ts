// Prueba contra los servicios reales. No forma parte de la suite normal (`npm run test:browser`), porque
// necesita red y claves válidas; se ejecuta a mano con `npm run test:live`.
//
// Comprueba la cadena completa dentro del navegador: mezcla local del audio del proyecto, envío a Groq y
// reparto del resultado en el .srt del proyecto y en los eventos de la línea de tiempo. Si el servicio no
// permitiese llamadas desde el navegador (CORS), esta prueba lo diría con el error exacto.
import {test,expect} from '@playwright/test';import path from 'node:path';
const fixture=(s:string)=>path.resolve('tests/fixtures',s);
test('subtítulos reales: de la mezcla local a Groq y de vuelta a la línea de tiempo',async({page})=>{
 test.setTimeout(300000);
 await page.goto('/?bienvenida=no');
 await page.evaluate(()=>localStorage.clear());
 await page.reload();
 await page.locator('input[type=file]').nth(0).setInputFiles([fixture('voz-prueba.wav')]);
 await expect(page.locator('.media-item')).toHaveCount(1,{timeout:60000});
 await page.locator('.media-item').first().dblclick();
 await page.getByRole('button',{name:'Generar subtítulos'}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Transcribir y crear subtítulos'}).click();
 await expect(page.getByRole('status').first()).toContainText('Subtítulos listos',{timeout:240000});
 await expect(page.locator('.media-item').filter({hasText:'subtitulos.srt'})).toHaveCount(1);
 // El autoguardado tarda 450 ms: se espera a que el .srt esté en el proyecto guardado.
 await expect.poll(async()=>page.evaluate(()=>{
  const raw=localStorage.getItem('corte15-autosave-v1');
  const project=raw?JSON.parse(raw):null;
  return (project?.media??[]).find((media:{kind:string})=>media.kind==='subtitle')?.text??'';
 }),{timeout:15000}).toMatch(/-->/);
 const srt=await page.evaluate(()=>{
  const raw=localStorage.getItem('corte15-autosave-v1');
  const project=raw?JSON.parse(raw):null;
  return (project?.media??[]).find((media:{kind:string})=>media.kind==='subtitle')?.text??'';
 });
 console.log(`[live] transcripción real:\n${srt.split('\n').slice(0,6).join('\n')}`);
 // La voz de prueba dice «esto es una prueba de subtítulos automáticos para Corte 15».
 expect(srt.toLowerCase()).toMatch(/prueba|subt[ií]tulos|corte/);
 const cues=await page.locator('.timeline-event.video').count();
 console.log(`[live] eventos de subtítulo en la línea de tiempo: ${cues}`);
 expect(cues).toBeGreaterThan(0);
 await page.screenshot({path:path.resolve('evidencias','subtitulos-reales.png')});
});
