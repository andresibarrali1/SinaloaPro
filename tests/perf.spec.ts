// Sonda de rendimiento de la interfaz (no es una prueba de regresión: mide y publica números).
//
// Se ejecuta con `npm run test:perf` y escribe un informe JSON en `outputs/rendimiento-ui.json` con los
// fotogramas reales del navegador en tres situaciones: reproduciendo, arrastrando la aguja y en reposo justo
// después de una edición (que es cuando entra el autoguardado). Los fotogramas se miden con
// `requestAnimationFrame`: si el trabajo por fotograma se pasa del presupuesto, el intervalo crece, así que la
// mediana y el percentil 95 dicen cuánto cuesta de verdad la interfaz.
import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const fixture=(name:string)=>path.resolve('tests/fixtures',name);

type Stats={frames:number;median:number;p95:number;worst:number;over50:number};

async function startFrames(page:import('@playwright/test').Page){
 await page.evaluate(()=>{
  const store=globalThis as unknown as {__frames:number[];__last:number;__raf:number};
  store.__frames=[];store.__last=performance.now();
  const step=(now:number)=>{store.__frames.push(now-store.__last);store.__last=now;store.__raf=requestAnimationFrame(step);};
  store.__raf=requestAnimationFrame(step);
 });
}
async function stopFrames(page:import('@playwright/test').Page):Promise<Stats>{
 return page.evaluate(()=>{
  const store=globalThis as unknown as {__frames:number[];__raf:number};
  cancelAnimationFrame(store.__raf);
  const frames=[...store.__frames].sort((a,b)=>a-b);
  const at=(fraction:number)=>frames.length?Math.round(frames[Math.min(frames.length-1,Math.floor(frames.length*fraction))]*10)/10:0;
  return {frames:frames.length,median:at(.5),p95:at(.95),worst:frames.length?Math.round(frames[frames.length-1]*10)/10:0,over50:frames.filter(value=>value>50).length};
 });
}

test('rendimiento de la interfaz: reproducción, arrastre de la aguja, zoom y reposo tras editar',async({page},info)=>{
 await page.goto('/?bienvenida=no');
 await page.evaluate(()=>localStorage.clear());
 await page.reload();
 await expect(page.getByRole('button',{name:'Nuevo proyecto',exact:true})).toBeVisible();
 // Un montaje con vídeo y audio, que es lo que se edita de verdad.
 await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Video_A.mp4'),fixture('Audio.wav')]);
 await expect(page.locator('.media-item')).toHaveCount(2,{timeout:60000});
 await page.locator('.media-item').filter({hasText:'Video_A.mp4'}).dblclick();
 await page.locator('.media-item').filter({hasText:'Audio.wav'}).dblclick();
 await expect(page.locator('.timeline-event').first()).toBeVisible();
 expect(await page.locator('.timeline-event').count(),'hay un montaje con vídeo y audio').toBeGreaterThan(1);
 // Un montaje más cargado, que es lo que se edita de verdad: se duplican los eventos unas cuantas veces. Cuantos
 // más elementos en la línea de tiempo, más se nota el trabajo de cada fotograma.
 await page.locator('.timeline-event.video').first().click();
 for(let copy=0;copy<Number(process.env.PERF_COPIES??12);copy++){await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');}
 const events=await page.locator('.timeline-event').count();
 if(Number(process.env.PERF_COPIES??12)>0)expect(events,'el montaje de la sonda es pesado a propósito').toBeGreaterThan(10);
 await page.getByRole('button',{name:'Ir al inicio',exact:true}).click();

 // 1. Reproducción de 3 s.
 await startFrames(page);
 await page.getByRole('button',{name:'Reproducir',exact:true}).click();
 await page.waitForTimeout(3000);
 await page.getByRole('button',{name:'Pausa (Enter)',exact:true}).click();
 const playback=await stopFrames(page);

 // 2. Arrastre de la aguja (el gesto que más repinta la línea de tiempo).
 await page.getByRole('button',{name:'Ir al inicio',exact:true}).click();
 const playhead=page.locator('.playhead');
 const line=(await playhead.boundingBox())!;
 await startFrames(page);
 await page.mouse.move(line.x+line.width/2,line.y+line.height-20);
 await page.mouse.down();
 for(let step=1;step<=120;step++){await page.mouse.move(line.x+line.width/2+step*2,line.y+line.height-20);await page.waitForTimeout(8);}
 await page.mouse.up();
 const scrub=await stopFrames(page);

 // 3. Zoom de la línea de tiempo con la rueda: cada paso vuelve a calcular las ondas de los eventos visibles.
 const scroll=page.locator('.timeline-scroll');
 const scrollBox=(await scroll.boundingBox())!;

 await startFrames(page);
 await page.mouse.move(scrollBox.x+scrollBox.width/2,scrollBox.y+scrollBox.height/2);
 for(let step=0;step<10;step++){await page.mouse.wheel(0,-240);await page.waitForTimeout(120);}
 for(let step=0;step<10;step++){await page.mouse.wheel(0,240);await page.waitForTimeout(120);}
 const zoom=await stopFrames(page);

 // 4. Reposo tras una edición: mover un evento y esperar a que el autoguardado (retardo de 450 ms) haga su trabajo.
 const clip=page.locator('.timeline-event.video').first();
 const box=(await clip.boundingBox())!;
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.mouse.down();
 await page.mouse.move(box.x+box.width/2+40,box.y+box.height/2,{steps:10});
 await page.mouse.up();
 await startFrames(page);
 await page.waitForTimeout(1500);
 const autosave=await stopFrames(page);

 const report={playback,scrub,zoom,autosave};
 fs.mkdirSync('outputs',{recursive:true});
 fs.writeFileSync('outputs/rendimiento-ui.json',JSON.stringify(report,null,1),'utf8');
 console.log('rendimiento-ui',JSON.stringify(report));
 if(info.project.name==='chrome')await page.screenshot({path:path.resolve('evidencias','rendimiento-ui.png')});
 // Sin umbrales: la sonda mide y publica. El listón se comprueba en la corrida funcional y en las pruebas.
 expect(playback.frames).toBeGreaterThan(30);
 expect(scrub.frames).toBeGreaterThan(30);
});
