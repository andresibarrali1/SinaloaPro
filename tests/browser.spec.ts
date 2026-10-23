// Ejecutado en esta sesión con Chrome y Edge del sistema y con los binarios Firefox y WebKit de Playwright.
// Los tres flujos se saltan explícitamente en motores sin las APIs necesarias.
import {test,expect,type Download,type Page} from '@playwright/test';import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';const require=createRequire(import.meta.url);
const fixture=(s:string)=>path.resolve('tests/fixtures',s);
// El proyecto autoguardado, para comprobar que lo que se ve en pantalla ha llegado de verdad al modelo.
type Saved = { events: Record<string, unknown>[] };
const autosave = (page:Page) => page.evaluate(() => JSON.parse(localStorage.getItem('corte15-autosave-v1') ?? '{}')) as Promise<Saved>;
test.beforeEach(async({page})=>{await page.goto('/?bienvenida=no');await page.evaluate(()=>localStorage.clear());await page.reload();await expect(page.getByRole('button',{name:'Nuevo proyecto',exact:true})).toBeVisible();});
test('flujo real: dos videos y audio, recorte, split, texto, fundido, guardar, abrir, exportar',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 // Capability gate: this scenario needs decoders and Web Audio. Engines that do not expose them are
 // reported as skipped with the concrete missing APIs instead of a misleading failure.
 const missing=await page.evaluate(()=>['VideoDecoder','AudioDecoder','AudioContext'].filter(name=>typeof (globalThis as Record<string,unknown>)[name]==='undefined'));
 test.skip(missing.length>0,`El motor no expone: ${missing.join(', ')}. La suite de diagnóstico documenta el caso.`);
 await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Video_A.mp4'),fixture('Video_B.mp4'),fixture('Audio.wav')]);
 await expect(page.locator('.media-item')).toHaveCount(3,{timeout:60000});
 await page.locator('.media-item').filter({hasText:'Video_A.mp4'}).dblclick();
 const ruler=page.locator('.ruler');await ruler.click({position:{x:130,y:30}});
 await page.locator('.media-item').filter({hasText:'Video_B.mp4'}).dblclick();
 await page.locator('.bottom-toolbar .transport').getByRole('button',{name:'Ir al inicio',exact:true}).click();await page.locator('.media-item').filter({hasText:'Audio.wav'}).dblclick();
 const clip=page.locator('.timeline-event.video').filter({hasText:'Video_A.mp4'}).first();await clip.dblclick();
 await page.getByLabel('Duración (s)',{exact:true}).fill('2.5');await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await ruler.click({position:{x:65,y:30}});await clip.click();await page.keyboard.press('s');await expect(page.locator('.timeline-event.video').filter({hasText:'Video_A.mp4'})).toHaveCount(2);
 await page.keyboard.press('Control+z');await expect(page.locator('.timeline-event.video').filter({hasText:'Video_A.mp4'})).toHaveCount(1);await page.keyboard.press('Control+y');await expect(page.locator('.timeline-event.video').filter({hasText:'Video_A.mp4'})).toHaveCount(2);
 await page.locator('.bottom-toolbar .transport').getByRole('button',{name:'Ir al inicio',exact:true}).click();await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();await page.getByRole('button',{name:'Títulos y texto',exact:true}).click();
 await page.getByLabel('Texto del título').fill('PRUEBA CORTE 15');await page.getByLabel('Entrada (s)',{exact:true}).fill('0.3');await page.getByLabel('Salida (s)',{exact:true}).fill('0.5');await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await page.locator('.preview-transport').getByRole('button',{name:'Reproducir',exact:true}).click();await page.waitForTimeout(700);await page.locator('.bottom-toolbar .transport').getByRole('button',{name:'Pausa (Enter)',exact:true}).click();await expect(page.locator('.big-timecode')).not.toHaveText('00:00:00:00');
 const saved=page.waitForEvent('download');await page.getByRole('button',{name:'Guardar proyecto',exact:true}).click();const projectDownload=await saved;const projectPath=info.outputPath('roundtrip.corte15');await projectDownload.saveAs(projectPath);const data=JSON.parse(fs.readFileSync(projectPath,'utf8'));expect(data.events.some((e:{kind:string})=>e.kind==='text')).toBe(true);
 await page.locator('input[type=file]').nth(1).setInputFiles(projectPath);await expect(page.locator('.timeline-event')).toHaveCount(data.events.length);await expect(page.getByRole('status').first()).toContainText('restaurado',{timeout:60000});
 await page.getByRole('button',{name:'Renderizar como…',exact:true}).click();await page.getByLabel('Ancho',{exact:true}).fill('320');await page.getByLabel('Alto',{exact:true}).fill('180');const result=page.waitForEvent('download',{timeout:120000});await page.getByRole('button',{name:'Renderizar y descargar'}).click();const rendered=await result;const renderPath=info.outputPath(rendered.suggestedFilename());await rendered.saveAs(renderPath);
 const probe=spawnSync(require('@ffprobe-installer/ffprobe').path,['-v','error','-show_streams','-show_format','-of','json',renderPath],{encoding:'utf8'});expect(probe.status).toBe(0);const metadata=JSON.parse(probe.stdout);expect(metadata.streams.some((s:{codec_type:string})=>s.codec_type==='video')).toBe(true);expect(metadata.streams.some((s:{codec_type:string})=>s.codec_type==='audio')).toBe(true);expect(Number(metadata.format.duration)).toBeGreaterThan(4.9);
 const ffmpeg=require('@ffmpeg-installer/ffmpeg').path;const pcm=spawnSync(ffmpeg,['-v','error','-i',renderPath,'-vn','-f','f32le','-ac','1','-ar','48000','-'],{maxBuffer:10*1024*1024});expect(pcm.status).toBe(0);let peak=0;for(let i=0;i<pcm.stdout.length;i+=4)peak=Math.max(peak,Math.abs(pcm.stdout.readFloatLE(i)));expect(peak).toBeGreaterThan(.03);
 const imagePath=info.outputPath('export-frame.png');expect(spawnSync(ffmpeg,['-v','error','-y','-ss','1.5','-i',renderPath,'-frames:v','1',imagePath]).status).toBe(0);expect(errors).toEqual([]);await page.screenshot({path:info.outputPath('editor.png')});
});
test('archivo corrupto muestra un error comprensible',async({page})=>{await page.locator('input[type=file]').nth(0).setInputFiles(fixture('corrupto.mp4'));await expect(page.getByRole('status').first()).toContainText('corrupto.mp4');await expect(page.locator('.media-item')).toHaveCount(0);});
test('exportación se puede cancelar y volver a iniciar',async({page})=>{await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();await page.getByRole('button',{name:'Color sólido',exact:true}).click();await page.getByLabel('Duración (s)',{exact:true}).fill('90');await page.getByRole('button',{name:'Cerrar',exact:true}).click();await page.getByRole('button',{name:'Renderizar como…',exact:true}).click();const render=page.getByRole('button',{name:'Renderizar y descargar'});await expect(render).toBeVisible();if(await render.isDisabled()){ // Sin codificadores disponibles el editor avisa y bloquea en lugar de fallar al pulsar.
  await expect(page.locator('.export-warning')).toBeVisible();test.skip(true,'El motor no expone codificadores (H.264/AAC ni VP9/Opus): se verificó el aviso y el bloqueo del botón.');return;}
 await render.click();await expect(page.getByRole('button',{name:'Cancelar renderización'})).toBeVisible();await page.getByRole('button',{name:'Cancelar renderización'}).click();await expect(page.locator('.export-status')).toContainText('cancelada',{timeout:30000});await expect(page.getByRole('button',{name:'Renderizar y descargar'})).toBeEnabled();});
test('exportación a 1280×720: resolución, audio y texto visibles en el archivo',async({page},info)=>{
 const missing=await page.evaluate(()=>['VideoEncoder','AudioEncoder','AudioContext'].filter(name=>typeof (globalThis as Record<string,unknown>)[name]==='undefined'));
 test.skip(missing.length>0,`El motor no expone: ${missing.join(', ')}.`);
 await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();
 await page.getByRole('button',{name:'Color sólido',exact:true}).click();
 await page.getByLabel('Duración (s)',{exact:true}).fill('3');await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();
 await page.getByRole('button',{name:'Títulos y texto',exact:true}).click();
 await page.getByLabel('Texto del título').fill('TEXTO EXPORTADO');
 await page.getByLabel('Duración (s)',{exact:true}).fill('3');await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await page.getByRole('button',{name:'Renderizar como…',exact:true}).click();
 const render=page.getByRole('button',{name:'Renderizar y descargar'});await expect(render).toBeVisible();
 if(await render.isDisabled()){await expect(page.locator('.export-warning')).toBeVisible();test.skip(true,'El motor no expone codificadores compatibles.');return;}
 await page.getByLabel('Ancho',{exact:true}).fill('1280');await page.getByLabel('Alto',{exact:true}).fill('720');
 const result=page.waitForEvent('download',{timeout:180000});await render.click();
 const rendered=await result;const renderPath=info.outputPath(rendered.suggestedFilename());await rendered.saveAs(renderPath);
 const ffmpeg=require('@ffmpeg-installer/ffmpeg').path;
 const probe=spawnSync(require('@ffprobe-installer/ffprobe').path,['-v','error','-show_streams','-show_format','-of','json',renderPath],{encoding:'utf8'});
 expect(probe.status).toBe(0);const metadata=JSON.parse(probe.stdout);
 const video=metadata.streams.find((s:{codec_type:string})=>s.codec_type==='video');
 expect(video.width).toBe(1280);expect(video.height).toBe(720);
 expect(metadata.streams.some((s:{codec_type:string})=>s.codec_type==='audio')).toBe(true);
 // El texto debe estar realmente dibujado en los píxeles del archivo, no solo en el modelo.
 const frame=spawnSync(ffmpeg,['-v','error','-ss','1.5','-i',renderPath,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'],{maxBuffer:32*1024*1024});
 expect(frame.status).toBe(0);let white=0;for(let i=0;i+2<frame.stdout.length;i+=3)if(frame.stdout[i]>230&&frame.stdout[i+1]>230&&frame.stdout[i+2]>230)white++;
 expect(white,'píxeles casi blancos del texto en el fotograma exportado').toBeGreaterThan(200);
});
test('un clic en un evento lo selecciona y coloca la aguja en ese punto',async({page})=>{
 const missing=await page.evaluate(()=>['VideoDecoder','AudioDecoder'].filter(name=>typeof (globalThis as Record<string,unknown>)[name]==='undefined'));
 test.skip(missing.length>0,`El motor no expone: ${missing.join(', ')}.`);
 await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Video_A.mp4')]);
 await expect(page.locator('.media-item')).toHaveCount(1,{timeout:60000});
 await page.locator('.media-item').first().dblclick();
 await page.locator('.bottom-toolbar .transport').getByRole('button',{name:'Ir al inicio',exact:true}).click();
 const timecode=page.locator('.big-timecode');
 await expect(timecode).toHaveText('00:00:00:00');
 const clip=page.locator('.timeline-event.video').first();
 const box=(await clip.boundingBox())!;
 await page.mouse.click(box.x+box.width*.6,box.y+box.height*.5);
 await expect(clip).toHaveClass(/selected/);
 await expect(timecode).not.toHaveText('00:00:00:00');
});
// La forma de onda de los eventos de audio. Antes se dibujaba con **240 columnas fijas** y el pico más cercano
// de una copia de 240 picos por archivo, así que un evento ancho salía en bloques y un trozo de un archivo largo
// salía plano. Ahora se dibuja una columna por píxel del evento y los picos se leen de las muestras
// decodificadas, con la silueta rellena alrededor de la línea del cero y el contorno repasado.
test('la forma de onda del audio: una columna por píxel, leída del sonido y con la línea del cero',async({page},info)=>{
 const missing=await page.evaluate(()=>['AudioDecoder','AudioContext'].filter(name=>typeof (globalThis as Record<string,unknown>)[name]==='undefined'));
 test.skip(missing.length>0,`El motor no expone: ${missing.join(', ')}.`);
 await page.setViewportSize({width:1440,height:900});
 // Voz real (la misma que usa la prueba de transcripción): su envolvente sube y baja y tiene pausas, así que
 // sirve para comprobar que la onda dice algo y no es una raya.
 await page.locator('input[type=file]').nth(0).setInputFiles(fixture('voz-prueba.wav'));
 await expect(page.locator('.media-item')).toHaveCount(1,{timeout:60000});
 await page.locator('.media-item').first().dblclick();
 const clip=page.locator('.timeline-event.audio').first();
 await expect(clip).toBeVisible();
 const wave=clip.locator('svg.audio-wave');
 await expect(wave).toHaveCount(1);
 // La onda de la línea de tiempo se dibuja solo con los picos guardados en el medio (1024 por canal): pasarle
 // además las muestras de cada evento obligaba a barrer PCM en cada repintado y trababa el editor.
 expect(await wave.getAttribute('data-waveform-source')).toBe('guardado');
 await expect(wave.locator('.audio-wave-center')).toHaveCount(1);
 await expect(wave.locator('.audio-wave-body')).toHaveCount(1);
 // Las columnas son las del ancho del evento en pantalla (bajando al escalón de la escalera), no una constante:
 // 240 ya no manda.
 const shape=async()=>page.evaluate(()=>{
   const svg=document.querySelector('.timeline-event.audio svg.audio-wave') as SVGSVGElement;
   const body=svg.querySelector('.audio-wave-body')?.getAttribute('d')??'';
   // Los números detrás de cada coma son las `y` (el trazado va en pares «x,y»): la silueta trae las de arriba y
   // las de abajo.
   const ys=(body.match(/,(-?\d+)/g)??[]).map(text=>Number(text.slice(1)));
   const upper=ys.filter(y=>y<=50);
   return {
     columns:Number(svg.dataset.waveformColumns),
     source:svg.dataset.waveformSource,
     heights:[...new Set(upper)].length,
     quiet:upper.filter(y=>y>=50).length,
     top:ys.length?Math.min(...ys):0,
     bottom:ys.length?Math.max(...ys):0,
     closed:body.trim().endsWith('Z'),
     points:(body.match(/L/g)??[]).length,
   };
 });
 const drawn=await shape();
 const box=(await clip.boundingBox())!;
 const ladder=Math.max(24,Math.round(box.width));
 expect(drawn.columns,'las columnas salen del ancho del evento, en la escalera').toBeLessThanOrEqual(ladder);
 expect(drawn.columns,'y no se quedan cortas de detalle').toBeGreaterThanOrEqual(ladder/4);
 expect(drawn.closed,'la silueta se cierra').toBe(true);
 expect(drawn.points,'el trazado lleva un punto por columna en cada vuelta').toBe(drawn.columns*2+1);
 // La silueta es simétrica alrededor de la línea del cero (y = 50 en un lienzo de 100) y aprovecha el alto: la
 // voz llega bastante más arriba de la mitad del espacio.
 expect(50-drawn.top,'hay picos hacia arriba').toBeGreaterThan(15);
 expect(drawn.bottom-50,'y hacia abajo, lo mismo').toBeGreaterThan(15);
 expect(Math.abs((50-drawn.top)-(drawn.bottom-50)),'la silueta está centrada en el cero').toBeLessThanOrEqual(1);
 // Y la onda dice algo: al acercar el zoom hay más columnas, la envolvente tiene muchas alturas distintas y las
 // pausas de la voz se ven como columnas casi en el cero (y = 50 en el lienzo de 100). La fuente sigue siendo la
 // guardada en el medio: la línea de tiempo no lee muestras decodificadas —eso es lo que trababa el editor—, así
 // que el detalle al acercar sale de los 1024 picos por canal, no de un barrido de PCM por evento y repintado.
 await page.locator('.timeline-scroll').hover();
 for(let notch=0;notch<6;notch++){await page.mouse.wheel(0,-400);await page.waitForTimeout(120);}
 const zoomed=await shape();
 expect(zoomed.columns).toBeGreaterThan(drawn.columns);
 expect(zoomed.source,'la línea de tiempo no lee PCM: sigue con los picos guardados').toBe('guardado');
 expect(zoomed.heights,`la envolvente tiene detalle (${zoomed.heights} alturas distintas)`).toBeGreaterThan(8);
 expect(zoomed.quiet,`las pausas se ven en la onda (${zoomed.quiet} columnas casi en el cero)`).toBeGreaterThan(0);
 if(info.project.name==='chrome')await page.screenshot({path:path.resolve('evidencias','onda-audio.png')});
 // La misma onda la usa el trimmer, con su color y su resolución de panel (ahí bastan los picos guardados, que
 // son más finos que las 640 columnas del panel).
 await page.locator('.media-item').first().click();
 await page.getByRole('button',{name:'Abrir el trimmer del medio seleccionado'}).click();
 const trimmer=page.locator('.trimmer');
 await expect(trimmer).toBeVisible();
 const trimWave=trimmer.locator('svg.audio-wave');
 await expect(trimWave).toHaveCount(1);
 expect(Number(await trimWave.getAttribute('data-waveform-columns'))).toBe(640);
 expect(['pcm','guardado']).toContain(await trimWave.getAttribute('data-waveform-source'));
 await expect(trimmer.locator('.audio-wave-center')).toHaveCount(1);
 if(info.project.name==='chrome')await page.screenshot({path:path.resolve('evidencias','onda-trimmer.png')});
});
// La aguja del reloj se agarra **desde los carriles**, no solo desde su cabeza o la franja de la regla: si el
// clic cae a menos de unos píxeles de la línea, el gesto la lleva a ella y no mueve ni selecciona el evento que
// hay debajo, ni marca el tramo sobre un hueco. Es el gesto que pide el flujo de trabajo con el clic mantenido.
test('la aguja se agarra desde los carriles y se arrastra sin tocar el evento de debajo',async({page})=>{
 const missing=await page.evaluate(()=>['VideoDecoder','AudioDecoder'].filter(name=>typeof (globalThis as Record<string,unknown>)[name]==='undefined'));
 test.skip(missing.length>0,`El motor no expone: ${missing.join(', ')}.`);
 await page.setViewportSize({width:1440,height:900});
 await page.locator('input[type=file]').nth(0).setInputFiles(fixture('Video_A.mp4'));
 await expect(page.locator('.media-item')).toHaveCount(1,{timeout:60000});
 await page.locator('.media-item').first().dblclick();
 const clip=page.locator('.timeline-event.video').first();
 await expect(clip).toBeVisible();
 await page.locator('.bottom-toolbar .transport').getByRole('button',{name:'Ir al inicio',exact:true}).click();
 const state=()=>page.evaluate(()=>{
   const project=JSON.parse(localStorage.getItem('corte15-autosave-v1')??'{}') as {events?:{start?:number}[];region?:unknown};
   return {start:Number((project.events??[])[0]?.start??0),region:project.region??null};
 });
 // Un clic en medio del evento coloca la aguja ahí (es lo que ya hace) y deja el evento seleccionado.
 const box=(await clip.boundingBox())!;
 await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
 const timecode=page.locator('.big-timecode');
 await expect(timecode).not.toHaveText('00:00:00:00');
 const before=await timecode.innerText();
 const startBefore=(await state()).start;
 // Y ahora se agarra la línea **sobre el propio evento** y se arrastra con el clic mantenido.
 const playhead=page.locator('.playhead');
 const line=(await playhead.boundingBox())!;
 const y=box.y+box.height/2;
 await page.mouse.move(line.x+line.width/2,y);
 await page.mouse.down();
 for(let step=1;step<=8;step++){await page.mouse.move(line.x+line.width/2+step*5,y);await page.waitForTimeout(20);}
 await page.mouse.up();
 await expect(timecode,`la aguja se mueve al agarrarla sobre el evento (antes ${before})`).not.toHaveText(before);
 // El evento no se ha movido de sitio ni se ha marcado un tramo: el gesto era de la aguja.
 await expect.poll(async()=>(await state()).start,{message:'el evento no se mueve al agarrar la aguja encima',timeout:20000}).toBe(startBefore);
 expect((await state()).region,'agarrar la aguja no marca el tramo').toBeNull();
 // Lo mismo sobre un hueco del carril: la aguja se lleva y no se marca el tramo.
 const lane=page.locator('.track-lane').first();
 const laneBox=(await lane.boundingBox())!;
 const moved=await timecode.innerText();
 const line2=(await playhead.boundingBox())!;
 await page.mouse.move(line2.x+line2.width/2,laneBox.y+laneBox.height-6);
 await page.mouse.down();
 for(let step=1;step<=8;step++){await page.mouse.move(line2.x+line2.width/2-step*4,laneBox.y+laneBox.height-6);await page.waitForTimeout(20);}
 await page.mouse.up();
 await expect(timecode,`la aguja se mueve al agarrarla sobre el hueco (antes ${moved})`).not.toHaveText(moved);
 expect((await state()).region,'agarrar la aguja sobre un hueco no marca el tramo').toBeNull();
 // Y lejos de la aguja el evento se sigue moviendo: la tolerancia no se come el gesto normal.
 const line3=(await playhead.boundingBox())!;
 const clipBox=(await clip.boundingBox())!;
 const away=Math.max(line3.x+30,clipBox.x+24);
 await page.mouse.move(away,clipBox.y+clipBox.height/2);
 await page.mouse.down();
 for(let step=1;step<=6;step++){await page.mouse.move(away+step*6,clipBox.y+clipBox.height/2);await page.waitForTimeout(20);}
 await page.mouse.up();
 await expect.poll(async()=>(await state()).start,{message:'lejos de la aguja el evento se mueve, como siempre',timeout:20000}).not.toBe(startBefore);
});
test('la rueda del ratón hace zoom horizontal sobre la línea de tiempo',async({page})=>{ const content=page.locator('.timeline-content');
 const width=async()=>content.evaluate(element=>element.getBoundingClientRect().width);
 const before=await width();
 await page.locator('.timeline-scroll').hover();
 await page.mouse.wheel(0,-300);
 await page.waitForTimeout(250);
 const zoomed=await width();
 expect(zoomed).toBeGreaterThan(before*1.2);
 await page.mouse.wheel(0,600);
 await page.waitForTimeout(250);
 expect(await width()).toBeLessThan(zoomed);
});
test('renderiza solo el tramo seleccionado',async({page},info)=>{
 const missing=await page.evaluate(()=>['VideoEncoder','AudioEncoder','AudioContext'].filter(name=>typeof (globalThis as Record<string,unknown>)[name]==='undefined'));
 test.skip(missing.length>0,`El motor no expone: ${missing.join(', ')}.`);
 await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();
 await page.getByRole('button',{name:'Color sólido',exact:true}).click();
 await page.getByLabel('Duración (s)',{exact:true}).fill('4');
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 const ruler=page.locator('.ruler');const box=(await ruler.boundingBox())!;
 const at=async(x:number)=>{await page.mouse.click(box.x+x,box.y+10);};
 await at(65);await page.getByRole('button',{name:'Marcar inicio del tramo'}).click();
 await at(195);await page.getByRole('button',{name:'Marcar fin del tramo'}).click();
 const label=await page.locator('.range-status').innerText();
 expect(label).toContain('Tramo');
 const stamps=[...label.matchAll(/(\d+):(\d+):(\d+)[:;](\d+)/g)].map(m=>Number(m[1])*3600+Number(m[2])*60+Number(m[3])+Number(m[4])/30);
 expect(stamps.length).toBe(2);
 const expected=stamps[1]-stamps[0];
 expect(expected).toBeGreaterThan(.5);
 await page.getByRole('button',{name:'Renderizar como…',exact:true}).click();
 // El ámbito pasa a «Tramo» automáticamente porque hay un tramo definido.
 await expect(page.getByLabel('Ámbito de render')).toContainText('Tramo');
 await page.getByLabel('Ancho',{exact:true}).fill('320');await page.getByLabel('Alto',{exact:true}).fill('180');
 const render=page.getByRole('button',{name:'Renderizar y descargar'});
 if(await render.isDisabled()){test.skip(true,'El motor no expone codificadores compatibles.');return;}
 const result=page.waitForEvent('download',{timeout:180000});await render.click();
 const rendered=await result;const renderPath=info.outputPath(rendered.suggestedFilename());await rendered.saveAs(renderPath);
 const probe=spawnSync(require('@ffprobe-installer/ffprobe').path,['-v','error','-show_entries','format=duration','-of','json',renderPath],{encoding:'utf8'});
 expect(probe.status).toBe(0);const duration=Number(JSON.parse(probe.stdout).format.duration);
 expect(Math.abs(duration-expected)).toBeLessThan(.25);
});
test('importa un XML exportado por VEGAS, informa de lo que leyó y sombrea el grupo de audio y video',async({page})=>{
 await page.locator('input[type=file]').nth(1).setInputFiles(fixture('vegas-montaje.xml'));
 const report=page.locator('.import-report');
 await expect(report).toBeVisible();
 await expect(report).toContainText('Final Cut Pro 7');
 await expect(report).toContainText('2 pistas, 5 eventos y 3 medios');
 await page.getByRole('button',{name:'Entendido'}).click();
 await expect(page.locator('.timeline-event')).toHaveCount(5);
 await expect(page.locator('.media-item')).toHaveCount(3);
 await expect(page.locator('.media-item.missing')).toHaveCount(3);
 const clip=page.locator('.timeline-event.video').filter({hasText:'Video_A.mp4'}).first();
 await clip.click();
 await expect(clip).toHaveClass(/selected/);
 // El audio vinculado del mismo clip queda sombreado, aunque no se haya pulsado sobre él.
 await expect(page.locator('.timeline-event.audio.group-member')).toHaveCount(1);
});
test('importa un EDL CMX 3600 con sus pistas y eventos',async({page})=>{
 await page.locator('input[type=file]').nth(1).setInputFiles(fixture('vegas-montaje.edl'));
 const report=page.locator('.import-report');
 await expect(report).toBeVisible();
 await expect(report).toContainText('EDL (CMX 3600)');
 await expect(report).toContainText('2 pistas, 4 eventos y 3 medios');
 await page.getByRole('button',{name:'Entendido'}).click();
 await expect(page.locator('.timeline-event')).toHaveCount(4);
 const clip=page.locator('.timeline-event.video').filter({hasText:'Video_A.mp4'}).first();
 await clip.click();
 await expect(page.locator('.timeline-event.audio.group-member')).toHaveCount(1);
});
test('un .veg se analiza: se muestran sus datos reales y se dice qué no se puede reconstruir',async({page})=>{
 await page.locator('input[type=file]').nth(1).setInputFiles(fixture('vegas-real.veg'));
 const report=page.locator('.veg-report');
 await expect(report).toBeVisible({timeout:30000});
 await expect(report).toContainText('292.767');
 await expect(report).toContainText('29.97');
 await expect(report).toContainText('1920×1080');
 await expect(report).toContainText('Apps.mp4');
 await expect(report).toContainText('Sunlight_on_Still_Water.mp3');
 await expect(report).toContainText('ADOBE GRATIS');
 await expect(report).toContainText('no se importa');
 await page.getByRole('button',{name:'Importar los medios referenciados'}).click();
 await expect(page.locator('.media-item')).toHaveCount(4);
 await expect(page.locator('.media-item.missing')).toHaveCount(4);
 await expect(page.getByRole('status').first()).toContainText('referencias');
});
test('un .veg que solo imita la firma se analiza y avisa, sin inventar datos',async({page})=>{
 await page.locator('input[type=file]').nth(1).setInputFiles(fixture('proyecto-ejemplo.veg'));
 const report=page.locator('.veg-report');
 await expect(report).toBeVisible();
 await expect(report).toContainText('tamaño incoherente');
 await expect(report).toContainText('No se pudo recorrer');
});
// Cabeceras CORS para las respuestas simuladas de las APIs.
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'};
async function mockGroq(page:import('@playwright/test').Page,payload:unknown){
 await page.route('**/api.groq.com/**',async route=>{
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:CORS});
  return route.fulfill({status:200,headers:{...CORS,'Content-Type':'application/json'},body:JSON.stringify(payload)});
 });
}
test('el botón «Generar subtítulos» está en la barra del panel de medios, junto al buscador',async({page})=>{
 const button=page.getByRole('button',{name:/Generar subtítulos/});
 await expect(button).toBeVisible();
 const search=page.getByLabel('Buscar medios');
 const searchBox=(await search.boundingBox())!;
 const buttonBox=(await button.boundingBox())!;
 expect(buttonBox.x).toBeGreaterThan(searchBox.x+searchBox.width-2);
 expect(Math.abs(buttonBox.y-searchBox.y)).toBeLessThan(12);
});
test('los subtítulos se generan, se añaden al proyecto como .srt y aparecen en la línea de tiempo',async({page})=>{
 // Transcribir exige poder decodificar el audio del proyecto y exponer Web Audio.
 const missing=await page.evaluate(()=>['AudioDecoder','AudioContext'].filter(name=>typeof (globalThis as Record<string,unknown>)[name]==='undefined'));
 test.skip(missing.length>0,`El motor no expone: ${missing.join(', ')}.`);
 await mockGroq(page,{text:'Hola, esto es una prueba de subtítulos automáticos.',language:'spanish',duration:6,segments:[{start:.2,end:1.4,text:' Hola, esto es una prueba'},{start:1.6,end:3.2,text:' de subtítulos automáticos'}]});
 await page.addInitScript(()=>{localStorage.setItem('corte15-groq-key','clave-de-prueba');});
 await page.reload();
 await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Audio.wav')]);
 await expect(page.locator('.media-item')).toHaveCount(1,{timeout:60000});
 await page.locator('.media-item').first().dblclick();
 // El botón abre un diálogo que pregunta cuántas palabras lleva cada subtítulo: se eligen dos.
 await page.getByRole('button',{name:'Generar subtítulos'}).click();
 const subtitleDialog=page.getByRole('dialog');
 await expect(subtitleDialog.getByLabel('Palabras por subtítulo')).toContainText('4 palabras');
 await subtitleDialog.getByLabel('Palabras por subtítulo').click();
 await page.getByRole('option',{name:'2 palabras',exact:true}).click();
 await expect(subtitleDialog.getByLabel('Palabras por subtítulo')).toContainText('2 palabras');
 if(test.info().project.name==='chrome')await page.screenshot({path:path.resolve('evidencias','subtitulos-palabras.png')});
 await subtitleDialog.getByRole('button',{name:'Transcribir y crear subtítulos'}).click();
 await expect(page.getByRole('status').first()).toContainText('Subtítulos listos',{timeout:60000});
 await expect(page.getByRole('status').first()).toContainText('2 palabras por subtítulo');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 // El .srt queda en Medios de proyecto y se ve en Subtítulos, en Videos y en Todos los medios.
 await expect(page.locator('.media-item').filter({hasText:'subtitulos.srt'})).toHaveCount(1);
 const tree=page.locator('.media-tree');
 await tree.getByRole('button',{name:'Subtítulos',exact:true}).click();
 await expect(page.locator('.media-item')).toHaveCount(1);
 await tree.getByRole('button',{name:'Videos',exact:true}).click();
 await expect(page.locator('.media-item').filter({hasText:'subtitulos.srt'})).toHaveCount(1);
 await tree.getByRole('button',{name:'Todos los medios',exact:true}).click();
 await expect(page.locator('.media-item')).toHaveCount(2);
 // Y los textos están en la línea de tiempo, sobre la pista «Subtítulos»: una línea cada dos palabras (ocho
 // palabras → cuatro líneas), igual que en el .srt.
 await expect(page.locator('.timeline-event').filter({hasText:'Hola, esto'})).toHaveCount(1);
 await expect(page.locator('.timeline-event').filter({hasText:'es una'})).toHaveCount(1);
 await expect(page.locator('.timeline-event').filter({hasText:'prueba de'})).toHaveCount(1);
 await expect(page.locator('.timeline-event').filter({hasText:'subtítulos automáticos'})).toHaveCount(1);
 await expect(page.locator('.timeline-event').filter({hasText:'automáticos'})).toHaveCount(1);
 // El .srt guardado tiene esas cuatro líneas.
 const savedSrt=await page.evaluate(()=>JSON.parse(localStorage.getItem('corte15-autosave-v1')??'{}').media?.find((item:{kind:string})=>item.kind==='subtitle')?.text??'');
 expect(String(savedSrt).split('-->').length-1,'cuatro líneas en el .srt').toBe(4);
 expect(String(savedSrt)).toContain('Hola, esto');
 expect(String(savedSrt)).toContain('subtítulos automáticos');
 // Doble clic en el .srt lo lleva otra vez a la línea de tiempo (es el gesto de insertar subtítulos); se
 // comprueba que aparecen las líneas otra vez y se deshace para no dejar el proyecto tocado.
 await page.locator('.media-item').filter({hasText:'subtitulos.srt'}).dblclick();
 await expect(page.locator('.timeline-event').filter({hasText:'automáticos'})).toHaveCount(2,{timeout:20000});
 await expect(page.getByRole('status').first()).toContainText('línea(s) de subtítulos');
 await page.keyboard.press('Control+z');
 await expect(page.locator('.timeline-event').filter({hasText:'automáticos'})).toHaveCount(1,{timeout:20000});
 // La elección se recuerda: al volver a abrir el diálogo sigue en dos palabras, y «Cancelar» lo cierra sin tocar nada.
 await page.getByRole('button',{name:'Generar subtítulos'}).click();
 await expect(page.getByRole('dialog').getByLabel('Palabras por subtítulo')).toContainText('2 palabras');
 await page.getByRole('dialog').getByRole('button',{name:'Cancelar'}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 // El .srt se descarga desde el botón de descarga de su ficha, no con el doble clic.
 await page.locator('.media-item').filter({hasText:'subtitulos.srt'}).click();
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:/Descargar/}).last().click();
 const file=await download;
 expect(file.suggestedFilename()).toBe('subtitulos.srt');
 await tree.getByRole('button',{name:'Todos los medios',exact:true}).click();
 if(test.info().project.name==='chrome')await page.screenshot({path:path.resolve('evidencias','subtitulos.png')});
 // Y con «Una línea por frase» cada línea es la intervención completa del servicio: dos líneas para dos frases.
 await page.getByRole('button',{name:'Generar subtítulos'}).click();
 await page.getByRole('dialog').getByLabel('Palabras por subtítulo').click();
 await page.getByRole('option',{name:'Una línea por frase',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Transcribir y crear subtítulos'}).click();
 await expect(page.getByRole('status').first()).toContainText('una línea por frase',{timeout:60000});
 await expect(page.locator('.timeline-event').filter({hasText:'de subtítulos automáticos'})).toHaveCount(1,{timeout:20000});
 // El segundo .srt guardado tiene dos líneas (una por frase); el autoguardado tarda 450 ms, así que se espera.
 const lastSrtLines=()=>page.evaluate(()=>{
  const media=(JSON.parse(localStorage.getItem('corte15-autosave-v1')??'{}') as {media?:{kind:string;text?:string}[]}).media??[];
  const text=media.filter(item=>item.kind==='subtitle').at(-1)?.text??'';
  return String(text).split('-->').length-1;
 });
 await expect.poll(lastSrtLines,{timeout:20000}).toBe(2);
 const phraseSrt=await page.evaluate(()=>{
  const media=(JSON.parse(localStorage.getItem('corte15-autosave-v1')??'{}') as {media?:{kind:string;text?:string}[]}).media??[];
  return media.filter(item=>item.kind==='subtitle').at(-1)?.text??'';
 });
 expect(String(phraseSrt)).toContain('Hola, esto es una prueba');
});
test('los recursos de Pexels se descargan, se colocan en la línea de tiempo y se añaden al proyecto',async({page})=>{
 // El clip descargado se importa de verdad, así que hace falta poder decodificarlo.
 const missing=await page.evaluate(()=>['VideoDecoder','AudioDecoder','AudioContext'].filter(name=>typeof (globalThis as Record<string,unknown>)[name]==='undefined'));
 test.skip(missing.length>0,`El motor no expone: ${missing.join(', ')}.`);
 const video=fs.readFileSync(fixture('Video_A.mp4'));
 const payload={videos:[{id:77,url:'https://www.pexels.com/video/ciudad-nocturna-77/',duration:3,width:1920,height:1080,image:'https://v.test/preview.jpg',user:{name:'Ana'},video_files:[{id:1,quality:'hd',file_type:'video/mp4',width:1920,height:1080,link:'https://v.test/ciudad-1080.mp4'}]}]};
 await page.route('**/api.pexels.com/**',async route=>{
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:CORS});
  return route.fulfill({status:200,headers:{...CORS,'Content-Type':'application/json'},body:JSON.stringify(payload)});
 });
 await page.route('https://v.test/**',route=>route.fulfill({status:200,headers:{...CORS,'Content-Type':'video/mp4'},body:video}));
 await page.addInitScript(()=>{localStorage.setItem('corte15-pexels-key','clave-de-prueba');});
 await page.reload();
 await page.getByRole('button',{name:/Recursos Pexels/}).click();
 // Se elige el modo por texto: el modo por transcripción es el que aparece por defecto.
 await page.getByLabel('Modo de búsqueda en Pexels').click();
 await page.getByRole('option',{name:'Buscar por texto'}).click();
 await page.getByLabel('Búsqueda en Pexels',{exact:true}).fill('ciudad nocturna');
 await page.getByRole('button',{name:'Buscar y colocar'}).click();
 await expect(page.getByRole('status').first()).toContainText('Pexels añadidos',{timeout:60000});
 await expect(page.locator('.media-item').filter({hasText:'ciudad-nocturna-77'})).toHaveCount(1);
 await expect(page.locator('.timeline-event.video')).toHaveCount(1);
 const track=page.locator('.track-header').filter({hasText:'Pexels'});
 await expect(track).toHaveCount(1);
});
test('los recursos de Pexels se colocan según lo que dice la transcripción, en su momento',async({page})=>{
 const missing=await page.evaluate(()=>['VideoDecoder','AudioDecoder','AudioContext'].filter(name=>typeof (globalThis as Record<string,unknown>)[name]==='undefined'));
 test.skip(missing.length>0,`El motor no expone: ${missing.join(', ')}.`);
 const video=fs.readFileSync(fixture('Video_A.mp4'));
 await mockGroq(page,{text:'Hola, esto es una prueba. Aquí hablamos del dinero.',language:'spanish',duration:8,segments:[{start:.2,end:1.4,text:' Hola, esto es una prueba'},{start:5.3,end:6.7,text:' Aquí hablamos del dinero'}]});
 const queries:string[]=[];
 await page.route('**/api.pexels.com/**',async route=>{
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:CORS});
  const query=new URL(route.request().url()).searchParams.get('query')??'';
  queries.push(query);
  const payload={videos:[{id:9,url:`https://www.pexels.com/video/${encodeURIComponent(query)}-9/`,duration:8,width:1920,height:1080,user:{name:'Ana'},video_files:[{id:1,quality:'hd',file_type:'video/mp4',width:1920,height:1080,link:`https://v.test/${encodeURIComponent(query)}.mp4`}]}]};
  return route.fulfill({status:200,headers:{...CORS,'Content-Type':'application/json'},body:JSON.stringify(payload)});
 });
 await page.route('https://v.test/**',route=>route.fulfill({status:200,headers:{...CORS,'Content-Type':'video/mp4'},body:video}));
 await page.addInitScript(()=>{localStorage.setItem('corte15-groq-key','clave-de-prueba');localStorage.setItem('corte15-pexels-key','clave-de-prueba');});
 await page.reload();
 await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Audio.wav')]);
 await expect(page.locator('.media-item')).toHaveCount(1,{timeout:60000});
 await page.locator('.media-item').first().dblclick();
 // Los subtítulos se crean con el reparto que se elige en el diálogo; aquí se deja el de por defecto (4 palabras).
 await page.getByRole('button',{name:'Generar subtítulos'}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Transcribir y crear subtítulos'}).click();
 await expect(page.getByRole('status').first()).toContainText('Subtítulos listos',{timeout:60000});
 await expect(page.getByRole('status').first()).toContainText('4 palabras por subtítulo');
 await page.getByRole('button',{name:/Recursos Pexels/}).click();
 await expect(page.getByLabel('Modo de búsqueda en Pexels')).toContainText('transcripción');
 await page.getByRole('button',{name:'Colocar recursos según la transcripción'}).click();
 await expect(page.getByRole('status').first()).toContainText('Recursos por palabra',{timeout:120000});
 expect(queries,'se buscó la palabra que se dice').toContain('dinero');
 // Un clip por palabra: la transcripción tiene 9 palabras y hay 9 eventos en la pista «Pexels», en orden, cada
 // uno en el instante en que se dice su palabra y enlazado con el siguiente sin dejar huecos.
 type SavedEvent={name:string;start:number;duration:number;trackId:string;mediaId:string};
 const placedEvents=async()=>{
  const saved=await page.evaluate(()=>({project:JSON.parse(localStorage.getItem('corte15-autosave-v1')??'{}')})) as {project:{events?:SavedEvent[];tracks?:{id:string;name:string}[]}};
  const track=(saved.project.tracks??[]).find(item=>item.name==='Pexels');
  return track?(saved.project.events??[]).filter(event=>event.trackId===track.id).sort((a,b)=>a.start-b.start):[];
 };
 await expect.poll(async()=>(await placedEvents()).length,{timeout:20000}).toBe(9);
 const placed=await placedEvents();
 expect(placed.map(event=>event.name.split(' · ')[0])).toEqual(['hola','esto','es','una','prueba','Aquí','hablamos','del','dinero']);
 for(let index=1;index<placed.length;index++){
  // Los clips nunca se pisan: cada uno empieza cuando empieza su palabra.
  const gap=placed[index].start-(placed[index-1].start+placed[index-1].duration);
  expect(gap,`«${placed[index-1].name}» y «${placed[index].name}» no se pisan`).toBeGreaterThanOrEqual(-2);
 }
 // Dentro de una frase los clips se tocan (la pista no deja huecos entre palabras); entre frases separadas por
 // un silencio largo puede quedar un hueco, porque el clip dura lo que dura el archivo descargado.
 const insidePhrase=placed.slice(0,5);
 for(let index=1;index<insidePhrase.length;index++){
  const gap=insidePhrase[index].start-(insidePhrase[index-1].start+insidePhrase[index-1].duration);
  expect(Math.abs(gap),`hueco entre «${insidePhrase[index-1].name}» y «${insidePhrase[index].name}»`).toBeLessThanOrEqual(2);
 }
 expect(placed[4].start+placed[4].duration).toBeLessThan(placed[5].start);
 const startOf=(prefix:string)=>placed.find(event=>event.name.startsWith(prefix))!.start/705600000;
 expect(Math.abs(startOf('hola')-0.2),'la primera palabra empieza con su frase').toBeLessThan(.05);
 // «dinero» cae dentro de su frase (5,3 s .. 6,7 s), no al principio del proyecto.
 const moneyStart=startOf('dinero');
 expect(moneyStart,`el recurso de dinero empezó en ${moneyStart} s`).toBeGreaterThan(5.2);
 expect(moneyStart).toBeLessThan(6.8);
 // Las palabras sin búsqueda propia (una muletilla) reutilizan el clip de su frase en vez de descargar otro.
 const shared=placed.find(event=>event.name.startsWith('esto'))!;
 const own=placed.find(event=>event.name.startsWith('hola'))!;
 expect(shared.mediaId,'la muletilla usa el clip de la palabra principal').toBe(own.mediaId);
 await expect(page.locator('.track-header').filter({hasText:'Pexels'})).toHaveCount(1);
 await expect(page.locator('.timeline-event').filter({hasText:'dinero ·'})).toHaveCount(1);
 await expect(page.locator('.timeline-event').filter({hasText:'hola ·'})).toHaveCount(1);
 if(test.info().project.name==='chrome')await page.screenshot({path:path.resolve('evidencias','recursos-transcripcion.png')});
});
test('el proyecto se recupera solo al recargar la página',async({page})=>{
 await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();
 await page.getByRole('button',{name:'Color sólido',exact:true}).click();
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.locator('.timeline-event')).toHaveCount(1);
 // El autoguardado local tarda 450 ms.
 await page.waitForTimeout(900);
 await page.reload();
 await expect(page.locator('.timeline-event')).toHaveCount(1,{timeout:20000});
 await expect(page.locator('.timeline-event').first()).toContainText('Color sólido');
 await expect(page.getByRole('button',{name:'Nuevo proyecto',exact:true})).toBeVisible();
});
test('un medio faltante se revincula con su archivo y deja de faltar',async({page})=>{
 const missing=await page.evaluate(()=>['AudioDecoder','AudioContext'].filter(name=>typeof (globalThis as Record<string,unknown>)[name]==='undefined'));
 test.skip(missing.length>0,`El motor no expone: ${missing.join(', ')}.`);
 // El XML referencia Audio.wav entre sus medios, así que llega como referencia sin archivo.
 await page.locator('input[type=file]').nth(1).setInputFiles(fixture('vegas-montaje.xml'));
 await page.getByRole('button',{name:'Entendido'}).click();
 await expect(page.locator('.media-item.missing')).toHaveCount(3);
 await page.locator('.media-item').filter({hasText:'Audio.wav'}).first().click();
 // El botón fija qué medio se va a revincular y abre el selector; las pruebas cargan el archivo directamente.
 await page.getByRole('button',{name:'Revincular medio seleccionado'}).click();
 await page.locator('input[type=file]').nth(2).setInputFiles(fixture('Audio.wav'));
 await expect(page.getByRole('status').first()).toContainText('revinculado',{timeout:60000});
 await expect(page.locator('.media-item.missing')).toHaveCount(2);
});
test('el bucle de reproducción repite el tramo cuando no hay región de bucle',async({page})=>{
 const missing=await page.evaluate(()=>['AudioDecoder','AudioContext'].filter(name=>typeof (globalThis as Record<string,unknown>)[name]==='undefined'));
 test.skip(missing.length>0,`El motor no expone: ${missing.join(', ')}.`);
 await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();
 await page.getByRole('button',{name:'Color sólido',exact:true}).click();
 await page.getByLabel('Duración (s)',{exact:true}).fill('6');
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 // Tramo de 0 a 1 s marcado con los botones del pie.
 const ruler=page.locator('.ruler');
 await ruler.click({position:{x:2,y:10}});
 await page.getByRole('button',{name:'Marcar inicio del tramo'}).click();
 await ruler.click({position:{x:65,y:10}});
 await page.getByRole('button',{name:'Marcar fin del tramo'}).click();
 await expect(page.locator('.range-status')).toContainText('00:00:01:00');
 // Sin región de bucle marcada, la repetición sigue al tramo de renderizado.
 await page.locator('.bottom-toolbar .transport').getByRole('button',{name:/Bucle de reproducción/}).click();
 await page.locator('.preview-transport').getByRole('button',{name:'Reproducir',exact:true}).click();
 await page.waitForTimeout(2600);
 await page.locator('.bottom-toolbar .transport').getByRole('button',{name:'Pausa (Enter)',exact:true}).click();
 const timecode=await page.locator('.big-timecode').innerText();
 const seconds=Number(timecode.split(':')[2]);
 // Sin bucle el cursor estaría en 2,6 s; con bucle tiene que seguir dentro del tramo.
 expect(seconds,`el cursor quedó en ${timecode}`).toBeLessThan(1.4);
});
test('avisa cuando no hay espacio local para guardar la copia de los medios',async({page})=>{
 const missing=await page.evaluate(()=>['AudioDecoder','AudioContext'].filter(name=>typeof (globalThis as Record<string,unknown>)[name]==='undefined'));
 test.skip(missing.length>0,`El motor no expone: ${missing.join(', ')}.`);
 // Se simula una cuota casi llena para no depender del disco de la máquina.
 await page.addInitScript(()=>{Object.defineProperty(navigator,'storage',{configurable:true,value:{estimate:async()=>({quota:1000,usage:900})}});});
 await page.reload();
 await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Audio.wav')]);
 await expect(page.getByRole('status').first()).toContainText('no hay espacio local suficiente',{timeout:60000});
 // El medio se importa igual: solo se pierde la copia local.
 await expect(page.locator('.media-item')).toHaveCount(1);
 await expect(page.getByRole('status').first()).toContainText('importado');
});
test('se puede exportar solo audio (WAV) y solo vídeo (MP4 sin audio)',async({page},info)=>{
 const missing=await page.evaluate(()=>['VideoEncoder','AudioEncoder','AudioContext'].filter(name=>typeof (globalThis as Record<string,unknown>)[name]==='undefined'));
 test.skip(missing.length>0,`El motor no expone: ${missing.join(', ')}.`);
 await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();
 await page.getByRole('button',{name:'Color sólido',exact:true}).click();
 await page.getByLabel('Duración (s)',{exact:true}).fill('2');
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 const ffprobe=require('@ffprobe-installer/ffprobe').path;
 const streamsOf=(file:string)=>{const probe=spawnSync(ffprobe,['-v','error','-show_streams','-of','json',file],{encoding:'utf8'});expect(probe.status).toBe(0);return (JSON.parse(probe.stdout).streams as {codec_type:string;codec_name:string}[]).map(stream=>stream.codec_type);};
 // 1) Solo audio: WAV sin pista de vídeo.
 await page.getByRole('button',{name:'Renderizar como…',exact:true}).click();
 await page.getByLabel('Formato de exportación').click();
 await page.getByRole('option',{name:/^WAV/}).click();
 await expect(page.getByRole('checkbox',{name:'Incluir video'})).not.toBeChecked();
 let download=page.waitForEvent('download',{timeout:120000});
 await page.getByRole('button',{name:'Renderizar y descargar'}).click();
 let file=await download;
 let path=info.outputPath(file.suggestedFilename());
 await file.saveAs(path);
 expect(file.suggestedFilename()).toMatch(/\.wav$/);
 expect(streamsOf(path)).toEqual(['audio']);
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 // 2) Solo vídeo: se usa el formato de vídeo que este motor sí puede codificar (Firefox no hace MP4).
 await page.getByRole('button',{name:'Renderizar como…',exact:true}).click();
 await page.getByLabel('Formato de exportación').click();
 const offered=await page.getByRole('option').allInnerTexts();
 const videoLabel=offered.find(label=>/^(MP4|WebM)/.test(label)&&!/no disponible/.test(label));
 expect(videoLabel,`formatos ofrecidos: ${offered.join(' | ')}`).toBeTruthy();
 await page.getByRole('option',{name:videoLabel!}).click();
 const videoCheckbox=page.getByRole('checkbox',{name:'Incluir video'});
 if(!(await videoCheckbox.isChecked()))await videoCheckbox.click();
 await page.getByRole('checkbox',{name:'Incluir audio'}).click();
 await expect(page.getByRole('checkbox',{name:'Incluir audio'})).not.toBeChecked();
 download=page.waitForEvent('download',{timeout:120000});
 await page.getByRole('button',{name:'Renderizar y descargar'}).click();
 file=await download;
 path=info.outputPath(file.suggestedFilename());
 await file.saveAs(path);
 expect(streamsOf(path)).toEqual(['video']);
});
// El lote de renderizado es la cola del script «Batch Render» de VEGAS 15: varios trabajos preparados de una vez
// y renderizados en serie. Se comprueba el recorrido completo: añadir dos trabajos (vídeo y WAV), verlos en la
// lista con su nombre de archivo, renderizar la cola y recibir los dos archivos, cada uno con sus pistas.
test('lote: dos trabajos en la cola se renderizan en serie y se descargan',async({page},info)=>{
  const missing=await page.evaluate(()=>['VideoEncoder','AudioEncoder','AudioContext'].filter(name=>typeof (globalThis as Record<string,unknown>)[name]==='undefined'));
  test.skip(missing.length>0,`El motor no expone: ${missing.join(', ')}.`);
  await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();
  await page.getByRole('button',{name:'Color sólido',exact:true}).click();
  await page.getByLabel('Duración (s)',{exact:true}).fill('1');
  await page.getByRole('button',{name:'Cerrar',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Renderizar como…',exact:true}).click();
  await page.getByLabel('Ancho',{exact:true}).fill('160');
  await page.getByLabel('Alto',{exact:true}).fill('90');
  // Trabajo 1: el formato de vídeo que este motor sí puede codificar (Firefox no hace MP4).
  await page.getByLabel('Formato de exportación').click();
  const offered=await page.getByRole('option').allInnerTexts();
  const videoLabel=offered.find(label=>/^(MP4|WebM)/.test(label)&&!/no disponible/.test(label));
  expect(videoLabel,`formatos ofrecidos: ${offered.join(' | ')}`).toBeTruthy();
  await page.getByRole('option',{name:videoLabel!}).click();
  // La extensión depende del formato que este motor puede codificar (Firefox no hace MP4).
  const videoExt=/^WebM/i.test(videoLabel!)?'webm':'mp4';
  await page.getByRole('button',{name:'Añadir a la cola'}).click();
  await expect(page.locator('.batch-job')).toHaveCount(1);
  // Trabajo 2: solo audio en WAV.
  await page.getByLabel('Formato de exportación').click();
  await page.getByRole('option',{name:/^WAV/}).click();
  await page.getByRole('button',{name:'Añadir a la cola'}).click();
  await expect(page.locator('.batch-job')).toHaveCount(2);
  // La lista dice qué se va a hacer, con qué archivo y en qué estado.
  const first=page.locator('.batch-job').first(),second=page.locator('.batch-job').nth(1);
  await expect(first.locator('.batch-label')).toContainText(/^(MP4|WebM) 160x90 30 fps/);
  await expect(first.locator('small')).toContainText(`.${videoExt}`);
  await expect(second.locator('.batch-label')).toContainText(/^WAV solo audio/);
  await expect(second.locator('small')).toContainText('.wav');
  await expect(page.locator('.batch-state')).toHaveText(['En espera','En espera']);
  await expect(page.locator('.batch-summary')).toContainText('2 trabajo(s)');
  await expect(page.locator('.batch-summary')).toContainText('30 fotogramas en total');
  // Se renderizan uno tras otro y cada archivo se descarga al terminarlo.
  const downloads:Download[]=[];
  page.on('download',file=>downloads.push(file));
  await page.getByRole('button',{name:'Renderizar la cola'}).click();
  await expect.poll(()=>downloads.length,{timeout:180000}).toBe(2);
  await expect(page.locator('.batch-job.hecho')).toHaveCount(2);
  await expect(page.locator('.batch-job').first().locator('.batch-state')).toHaveText('Hecho');
  await expect(page.locator('.batch-job').first().locator('small')).toContainText('MB en');
  await expect(page.getByRole('status').first()).toContainText('Lote terminado');
  // Los nombres llevan el proyecto, el trabajo y su extensión; el segundo no pisa al primero.
  const names=downloads.map(file=>file.suggestedFilename());
  expect(names[0]).toMatch(new RegExp(`^Sin título--(MP4|WebM) 160x90 30 fps\\.${videoExt}$`));
  expect(names[1]).toBe('Sin título--WAV solo audio.wav');
  const paths:string[]=[];
  for(const file of downloads){const target=info.outputPath(file.suggestedFilename());await file.saveAs(target);paths.push(target);}
  const ffprobe=require('@ffprobe-installer/ffprobe').path;
  const streamsOf=(file:string)=>{const probe=spawnSync(ffprobe,['-v','error','-show_streams','-of','json',file],{encoding:'utf8'});expect(probe.status).toBe(0);return (JSON.parse(probe.stdout).streams as {codec_type:string}[]).map(stream=>stream.codec_type);};
  expect(streamsOf(paths[0])).toContain('video');
  expect(streamsOf(paths[1])).toEqual(['audio']);
  // El trabajo de vídeo dura lo que el proyecto (1 s), no lo que dure la cola entera.
  const format=spawnSync(ffprobe,['-v','error','-show_format','-of','json',paths[0]],{encoding:'utf8'});
  const duration=Number(JSON.parse(format.stdout).format.duration);
  expect(duration,`duración del primer archivo: ${duration} s`).toBeGreaterThan(.9);
  expect(duration).toBeLessThan(1.2);
});
test('una pista se selecciona con el clic, se borra con Supr y se recupera con Ctrl+Z',async({page})=>{
 await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();
 await page.getByRole('button',{name:'Color sólido',exact:true}).click();
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 // Hay que esperar a que el diálogo termine de cerrarse: mientras anima, su capa tapa la interfaz.
 await expect(page.getByRole('dialog')).toHaveCount(0);
 const headers=page.locator('.track-header');
 await expect(headers).toHaveCount(3);
 await expect(page.locator('.timeline-event')).toHaveCount(1);
 const target=headers.filter({hasText:'Títulos'});
 const box=(await target.boundingBox())!;
 // Se pulsa en una zona neutra de la cabecera (abajo a la izquierda), no sobre el nombre ni los botones.
 await page.mouse.click(box.x+6,box.y+box.height-16);
 await expect(target).toHaveClass(/selected/);
 await expect(page.getByRole('status').first()).toContainText('seleccionada');
 await page.keyboard.press('Delete');
 await expect(headers).toHaveCount(2);
 await expect(page.locator('.timeline-event')).toHaveCount(0);
 await expect(page.getByRole('status').first()).toContainText('Pista «Títulos» eliminada con sus 1 evento');
 await page.keyboard.press('Control+z');
 await expect(headers).toHaveCount(3);
 await expect(page.locator('.timeline-event')).toHaveCount(1);
});
test('el clic derecho sobre una pista ofrece eliminarla',async({page})=>{
 // Con la ventana por defecto la tercera pista queda fuera del área visible.
 await page.setViewportSize({width:1440,height:1000});
 const headers=page.locator('.track-header');
 await expect(headers).toHaveCount(3);
 const target=headers.filter({hasText:'Audio'});
 // El clic del localizador desplaza la pista hasta el área visible en cualquier motor.
 await target.click({button:'right'});
 const menu=page.getByRole('menu');
 await expect(menu).toBeVisible();
 await expect(menu).toContainText('Propiedades de la pista');
 await expect(target).toHaveClass(/selected/);
 await page.getByRole('menuitem',{name:/Eliminar pista/}).click();
 await expect(headers).toHaveCount(2);
 await expect(headers.filter({hasText:'Audio'})).toHaveCount(0);
});
test('con eventos seleccionados, Supr borra los eventos y no la pista',async({page})=>{ await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();
 await page.getByRole('button',{name:'Color sólido',exact:true}).click();
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 const headers=page.locator('.track-header');
 await expect(headers).toHaveCount(3);
 await page.locator('.timeline-event').first().click();
 await expect(page.locator('.timeline-event.selected')).toHaveCount(1);
 await page.keyboard.press('Delete');
 await expect(page.locator('.timeline-event')).toHaveCount(0);
 // La pista sigue en su sitio: con eventos seleccionados, Supr no la toca.
 await expect(headers).toHaveCount(3);
});
test('la aguja se puede arrastrar manteniendo el clic',async({page})=>{ await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();
 await page.getByRole('button',{name:'Color sólido',exact:true}).click();
 await page.getByLabel('Duración (s)',{exact:true}).fill('8');
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 const timecode=page.locator('.big-timecode');
 await expect(timecode).toHaveText('00:00:00:00');
 const handle=page.locator('.playhead i');
 const box=(await handle.boundingBox())!;
 // 195 px a 65 px/s son 3 s.
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.mouse.down();
 await page.mouse.move(box.x+box.width/2+195,box.y+box.height/2,{steps:8});
 await expect(page.locator('.playhead.dragging')).toHaveCount(1);
 await page.mouse.up();
 await expect(page.locator('.playhead.dragging')).toHaveCount(0);
 await expect(timecode).toHaveText('00:00:03:00');
 // Y se puede volver hacia atrás.
 await page.mouse.move(box.x+195+box.width/2,box.y+box.height/2);
 await page.mouse.down();
 await page.mouse.move(box.x+65+box.width/2,box.y+box.height/2,{steps:6});
 await page.mouse.up();
 await expect(timecode).toHaveText('00:00:01:00');
});
// La aguja también se mueve desde la regla: su franja de abajo la arrastra —como el cursor de VEGAS— y la de
// arriba sigue marcando el tramo. Y la propia aguja se agarra por su cabeza o por la franja que la rodea.
test('la aguja se mueve arrastrando por la regla, sin crear tramo',async({page})=>{
 await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();
 await page.getByRole('button',{name:'Color sólido',exact:true}).click();
 await page.getByLabel('Duración (s)',{exact:true}).fill('8');
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 const timecode=page.locator('.big-timecode');
 const ruler=page.locator('.ruler');
 const rect=(await ruler.boundingBox())!;
 // 1. La franja de abajo de la regla (donde se dibuja la aguja) la mueve y NO crea tramo: 260 px a 65 px/s = 4 s.
 await expect(page.locator('.region')).toHaveCount(0);
 await page.mouse.move(rect.x+65,rect.y+34);
 await page.mouse.down();
 await page.mouse.move(rect.x+260,rect.y+34,{steps:8});
 await page.mouse.up();
 await expect(timecode).toHaveText('00:00:04:00');
 await expect(page.locator('.region')).toHaveCount(0);
 // 2. La franja de arriba sigue marcando el tramo, como antes.
 await page.mouse.move(rect.x+65,rect.y+10);
 await page.mouse.down();
 await page.mouse.move(rect.x+195,rect.y+10,{steps:6});
 await page.mouse.up();
 await expect(page.locator('.region')).toHaveCount(1);
 await expect(page.locator('.range-status')).toContainText('00:00:01:00');
 // Al marcar el tramo la aguja se queda donde empezó el arrastre, como antes.
 await expect(timecode).toHaveText('00:00:01:00');
 // 3. Agarrar la aguja por su cabeza dentro de la regla también la mueve: 130 px a la derecha son 2 s.
 const head=page.locator('.playhead i');
 const headBox=(await head.boundingBox())!;
 await page.mouse.move(headBox.x+headBox.width/2,headBox.y+headBox.height/2);
 await page.mouse.down();
 await page.mouse.move(headBox.x+headBox.width/2+130,headBox.y+headBox.height/2,{steps:8});
 await expect(page.locator('.playhead.dragging')).toHaveCount(1);
 await page.mouse.up();
 await expect(timecode).toHaveText('00:00:03:00');
 // 4. Y si el arrastre empieza justo sobre la aguja dentro de la regla, también se la lleva (no marca tramo).
 const rulerBox=(await ruler.boundingBox())!;
 const rangeBefore=await page.locator('.range-status').innerText();
 await page.mouse.move(rulerBox.x+195,rulerBox.y+34);
 await page.mouse.down();
 await page.mouse.move(rulerBox.x+325,rulerBox.y+34,{steps:8});
 await page.mouse.up();
 await expect(timecode).toHaveText('00:00:05:00');
 await expect(page.locator('.range-status')).toHaveText(rangeBefore);
 if(test.info().project.name==='chrome')await page.screenshot({path:path.resolve('evidencias','aguja-regla.png')});
});
test('la pista seleccionada se sombrea, también su carril',async({page})=>{
 // Con la ventana por defecto las pistas de abajo quedan fuera del área visible según el motor.
 await page.setViewportSize({width:1440,height:1000});
 const headers=page.locator('.track-header');
 const video=headers.filter({hasText:'Video'});
 await expect(video).toHaveCSS('background-color','rgb(52, 52, 52)');
 // Clic en una zona neutra de la cabecera (abajo a la izquierda), no sobre el nombre ni los botones.
 await video.click({position:{x:6,y:70}});
 await expect(video).toHaveClass(/selected/);
 await expect(video).toHaveCSS('background-color','rgb(89, 112, 121)');
 await expect(page.locator('.track-lane.selected')).toHaveCount(1);
 await expect(page.locator('.track-lane.selected')).toHaveCSS('background-color','rgb(51, 65, 74)');
 // Una pista de audio se sombrea con su propio tono (el clic del localizador la trae al área visible).
 const audio=headers.filter({hasText:'Audio'});
 await audio.click({position:{x:6,y:70}});
 await expect(audio).toHaveCSS('background-color','rgb(109, 58, 71)');
 await expect(video).toHaveClass(/^(?!.*selected)/);
});
test('arrastrar en un hueco de la línea de tiempo crea el tramo',async({page})=>{ await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();
 await page.getByRole('button',{name:'Color sólido',exact:true}).click();
 await page.getByLabel('Duración (s)',{exact:true}).fill('6');
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 // La pista «Video» queda vacía: es el hueco donde se dibuja el tramo.
 const empty=page.locator('.track-lane').nth(1);
 const box=(await empty.boundingBox())!;
 await expect(page.locator('.region')).toHaveCount(0);
 await page.mouse.move(box.x+65,box.y+20);
 await page.mouse.down();
 await page.mouse.move(box.x+195,box.y+20,{steps:6});
 await page.mouse.up();
 await expect(page.locator('.region')).toHaveCount(1);
 await expect(page.locator('.range-status')).toContainText('00:00:01:00');
 await expect(page.locator('.range-status')).toContainText('00:00:03:00');
 await expect(page.getByRole('status').first()).toContainText('Tramo');
 // Los tiradores de los extremos ajustan el tramo (65 px = 1 s).
 const before=await page.locator('.range-status').innerText();
 const handle=(await page.locator('.region-handle.end').boundingBox())!;
 const startX=handle.x+handle.width/2,startY=handle.y+handle.height/2;
 await page.mouse.move(startX,startY);
 await page.mouse.down();
 // Movimientos espaciados, como los de un ratón real: en ráfaga el navegador los agrupa.
 for(let step=1;step<=10;step++){await page.mouse.move(startX+step*6.5,startY);await page.waitForTimeout(30);}
 await page.mouse.up();
 const after=await page.locator('.range-status').innerText();
 // El timecode es HH:MM:SS:FF: los dos últimos dígitos son fotogramas, no centésimas. El tramo se muestra
 // como «inicio → fin», así que el fin es lo que va después del separador.
 const endSeconds=(text:string)=>{const normalized=text.replace(/\u2014/g,'\u2192');const m=/(\d\d):(\d\d):(\d\d)[:;](\d\d)/.exec(normalized.split('\u2192')[1]??normalized);return m?Number(m[1])*3600+Number(m[2])*60+Number(m[3])+Number(m[4])/30:-1;};
 const grown=endSeconds(after)-endSeconds(before);
 expect(grown,`el tramo pasó de "${before}" a "${after}"`).toBeGreaterThan(.9);
 expect(grown).toBeLessThan(1.1);
 // Y el tramo se puede quitar con doble clic.
 await page.locator('.region').dblclick();
 await expect(page.locator('.region')).toHaveCount(0);
});
// La región de bucle es la parte que se repite al reproducir. Se marca con Ctrl y arrastrar sobre la línea de
// tiempo, se ajusta con sus tiradores y se activa con Q. Es independiente del tramo de renderizado: aquí se
// comprueba que marcar el bucle no crea un tramo, que el archivo guardado lleva el bucle y que la reproducción
// vuelve al principio de la zona en lugar de terminar el proyecto.
test('la región de bucle se marca con Ctrl, se ajusta con sus tiradores y repite la reproducción',async({page})=>{
 const missing=await page.evaluate(()=>['AudioContext'].filter(name=>typeof (globalThis as Record<string,unknown>)[name]==='undefined'));
 test.skip(missing.length>0,`El motor no expone: ${missing.join(', ')}.`);
 await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();
 await page.getByRole('button',{name:'Color sólido',exact:true}).click();
 await page.getByLabel('Duración (s)',{exact:true}).fill('6');
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 // La pista «Video» sigue vacía: es el hueco donde se dibujan las regiones (65 px = 1 s).
 const empty=page.locator('.track-lane').nth(1);
 const box=(await empty.boundingBox())!;
 await page.keyboard.down('Control');
 await page.mouse.move(box.x+65,box.y+20);
 await page.mouse.down();
 await page.mouse.move(box.x+195,box.y+20,{steps:6});
 await page.mouse.up();
 await page.keyboard.up('Control');
 await expect(page.locator('.loop-region')).toHaveCount(1);
 await expect(page.locator('.loop-status')).toContainText('00:00:01:00');
 await expect(page.locator('.loop-status')).toContainText('00:00:03:00');
 // El mismo gesto sin Ctrl no se ha usado: el tramo de renderizado sigue vacío, son dos regiones distintas.
 await expect(page.locator('.region')).toHaveCount(0);
 await expect(page.locator('.range-status')).toContainText('Sin tramo');
 // El autoguardado guarda el bucle en ticks (705 600 000 por segundo).
 const loopSeconds=()=>page.evaluate(()=>{const project=JSON.parse(localStorage.getItem('corte15-autosave-v1')??'{}');const range=project.loopRegion;return range?{start:range.start/705600000,end:range.end/705600000}:null;});
 await expect.poll(loopSeconds).not.toBeNull();
 const saved=await loopSeconds();
 expect(saved!.start).toBeCloseTo(1,.02);
 expect(saved!.end).toBeCloseTo(3,.02);
 // El tirador del final alarga el bucle (mismo gesto que en el tramo: 65 px ≈ 1 s).
 const timecodeSeconds=(text:string)=>{const m=/(\d\d):(\d\d):(\d\d)[:;](\d\d)/.exec(text)!;return Number(m[1])*3600+Number(m[2])*60+Number(m[3])+Number(m[4])/30;};
 const loopEnd=async()=>timecodeSeconds((await page.locator('.loop-status').innerText()).split('\u2192')[1]);
 const beforeEnd=await loopEnd();
 const handle=(await page.locator('.loop-handle.end').boundingBox())!;
 const startX=handle.x+handle.width/2,startY=handle.y+handle.height/2;
 await page.mouse.move(startX,startY);
 await page.mouse.down();
 for(let step=1;step<=10;step++){await page.mouse.move(startX+step*6.5,startY);await page.waitForTimeout(30);}
 await page.mouse.up();
 expect(await loopEnd()-beforeEnd).toBeGreaterThan(.9);
 expect(await loopEnd()-beforeEnd).toBeLessThan(1.1);
 // Q activa la repetición; el botón del pie lo dice y el estado también.
 await page.keyboard.press('q');
 await expect(page.getByLabel('Activar el bucle')).toHaveAttribute('aria-pressed','true');
 await expect(page.getByLabel('Activar el bucle')).toHaveText('Repitiendo');
 await expect(page.locator('.loop-status')).toContainText('activo');
 // Al reproducir desde el principio, la aguja vuelve al inicio de la zona en vez de llegar al final del proyecto:
 // tras 4,2 s de reproducción con un bucle de 2 s, el cursor está dentro de la zona, no en 4,2 s.
 await page.locator('.bottom-toolbar .transport').getByRole('button',{name:'Ir al inicio',exact:true}).click();
 await page.locator('.preview-transport').getByRole('button',{name:'Reproducir',exact:true}).click();
 await page.waitForTimeout(4200);
 const at=await page.locator('.big-timecode').innerText();
 await page.locator('.bottom-toolbar .transport').getByRole('button',{name:'Pausa (Enter)',exact:true}).click();
 const secondsAt=timecodeSeconds(at);
 expect(secondsAt,`cursor en ${at} tras 4,2 s con un bucle de 1 s a 4 s`).toBeGreaterThanOrEqual(1);
 expect(secondsAt).toBeLessThan(4);
 await page.keyboard.press('q');
 await expect(page.getByLabel('Activar el bucle')).toHaveAttribute('aria-pressed','false');
 // Ctrl+L no se captura (el navegador lo reserva para la barra de direcciones): el tramo se copia al bucle con
 // el botón «Desde tramo» o desde el menú Insertar.
 await page.mouse.move(box.x+130,box.y+20);
 await page.mouse.down();
 await page.mouse.move(box.x+325,box.y+20,{steps:6});
 await page.mouse.up();
 await expect(page.locator('.region')).toHaveCount(1);
 await expect(page.locator('.range-status')).toContainText('00:00:02:00');
 await expect(page.locator('.range-status')).toContainText('00:00:05:00');
 // «Desde tramo» copia el tramo de renderizado a la región de bucle, sin tocar el tramo.
 await page.getByLabel('Copiar el tramo al bucle').click();
 await expect(page.locator('.loop-status')).toContainText('00:00:02:00');
 await expect(page.locator('.loop-status')).toContainText('00:00:05:00');
 await expect(page.locator('.region')).toHaveCount(1);
 await expect(page.locator('.range-status')).toContainText('00:00:02:00');
 // Mayús+U quita el bucle (propio de Sinaloa Pro) y deja el tramo como estaba.
 await page.keyboard.press('Shift+u');
 await expect(page.locator('.loop-region')).toHaveCount(0);
 await expect(page.locator('.loop-status')).toContainText('Sin bucle');
 await expect(page.locator('.region')).toHaveCount(1);
 await expect(page.locator('.range-status')).toContainText('00:00:02:00');
});
test('Ctrl + rueda desplaza la línea de tiempo de arriba abajo',async({page})=>{
 // Se añaden pistas para que haya más contenido del que cabe y se pueda desplazar.
 const addVideo=page.locator('.add-track button').first();
 for(let index=0;index<7;index++)await addVideo.click();
 const scroll=page.locator('.timeline-scroll');
 const width=()=>page.locator('.timeline-content').evaluate(node=>node.getBoundingClientRect().width);
 const top=()=>scroll.evaluate(node=>node.scrollTop);
 expect(await top()).toBe(0);
 const widthBefore=await width();
 await scroll.hover();
 await page.keyboard.down('Control');
 await page.mouse.wheel(0,400);
 await page.keyboard.up('Control');
 await page.waitForTimeout(150);
 const scrolled=await top();
 expect(scrolled,`scrollTop tras Ctrl+rueda = ${scrolled}`).toBeGreaterThan(0);
 // No ha hecho zoom: el ancho del contenido no cambia.
 expect(await width()).toBe(widthBefore);
 // Las cabeceras de pista acompañan al desplazamiento vertical.
 expect(await page.locator('#track-headers').evaluate(node=>node.scrollTop)).toBeGreaterThan(0);
 // Y la rueda vuelve hacia arriba.
 await page.keyboard.down('Control');
 await page.mouse.wheel(0,-400);
 await page.keyboard.up('Control');
 await page.waitForTimeout(150);
 expect(await top()).toBeLessThan(scrolled);
});
test('las pistas se pueden mover de sitio: menú, Alt+flechas y arrastre',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 const names=()=>page.locator('#track-headers .track-header button[title^="Propiedades de"]').allInnerTexts();
 expect(await names()).toEqual(['Títulos','Video','Audio']);
 // La pista de audio ya está arriba de su grupo: no puede subir más ni saltar por encima del vídeo.
 const audio=page.locator('.track-header').filter({hasText:'Audio'});
 await audio.click({button:'right'});
 await page.getByRole('menuitem',{name:'Subir pista'}).click();
 expect(await names()).toEqual(['Títulos','Video','Audio']);
 // La pista de vídeo «Video» sube por encima de «Títulos» desde el menú contextual.
 const video=page.locator('.track-header').filter({hasText:'Video'}).first();
 await video.click({button:'right'});
 await page.getByRole('menuitem',{name:'Subir pista'}).click();
 expect(await names()).toEqual(['Video','Títulos','Audio']);
 await expect(page.getByRole('status').first()).toContainText('movida');
 // Alt+flecha abajo la devuelve a su sitio.
 await page.keyboard.press('Shift+ArrowDown');
 expect(await names()).toEqual(['Títulos','Video','Audio']);
 await page.keyboard.press('Control+z');
 expect(await names()).toEqual(['Video','Títulos','Audio']);
 // Arrastrar la primera cabecera sobre la segunda las intercambia.
 const first=page.locator('.track-header').first(),second=page.locator('.track-header').nth(1);
 const boxA=(await first.boundingBox())!,boxB=(await second.boundingBox())!;
 await page.mouse.move(boxA.x+6,boxA.y+20);
 await page.mouse.down();
 await page.mouse.move(boxA.x+6,boxB.y+boxB.height/2,{steps:8});
 await expect(page.locator('.track-header.drop-target')).toHaveCount(1);
 await page.mouse.up();
 expect(await names()).toEqual(['Títulos','Video','Audio']);
 // Y el cambio se puede deshacer.
 await page.keyboard.press('Control+z');
 expect(await names()).toEqual(['Video','Títulos','Audio']);
});
test('la línea de tiempo no deja ningún hueco a la derecha en ventanas anchas',async({page})=>{
 await page.setViewportSize({width:2200,height:900});
 await page.goto('/?bienvenida=no');
 await page.evaluate(()=>localStorage.clear());
 await page.reload();
 // Con el zoom al mínimo, el ancho pedido (900 px) es menor que la ventana: antes quedaba un hueco.
 for(let index=0;index<3;index++)await page.getByRole('button',{name:'Alejar',exact:true}).click();
 await page.waitForTimeout(200);
 const sizes=await page.evaluate(()=>{
  const scroll=document.querySelector('.timeline-scroll') as HTMLElement|null;
  const content=document.querySelector('.timeline-content') as HTMLElement|null;
  const lane=document.querySelector('.track-lane') as HTMLElement|null;
  const ruler=document.querySelector('.ruler') as HTMLElement|null;
  if(!scroll||!content||!lane||!ruler)return null;
  const rect=scroll.getBoundingClientRect();
  const under=document.elementFromPoint(rect.right-20,rect.top+120) as HTMLElement|null;
  return {
   scroll:Math.round(rect.width),
   content:Math.round(content.getBoundingClientRect().width),
   lane:Math.round(lane.getBoundingClientRect().width),
   ruler:Math.round(ruler.getBoundingClientRect().width),
   under:under?`${under.tagName}.${under.className}`:'nada',
   underColor:under?getComputedStyle(under).backgroundColor:'-',
  };
 });
 expect(sizes).not.toBeNull();
 // El contenido, los carriles y la regla cubren como mínimo toda el área visible.
 expect(sizes!.content).toBeGreaterThanOrEqual(sizes!.scroll);
 expect(sizes!.lane).toBeGreaterThanOrEqual(sizes!.scroll);
 expect(sizes!.ruler).toBeGreaterThanOrEqual(sizes!.scroll);
 // Y lo que hay bajo el puntero, en el extremo derecho, ya no es el contenedor vacío.
 expect(sizes!.under).not.toContain('timeline-scroll');
 expect(sizes!.underColor).not.toBe('rgba(0, 0, 0, 0)');
});
test('cada pista coincide con su carril, también al desplazar en vertical',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 // Un evento y varias pistas: cuanto más contenido, más se nota cualquier desfase.
 await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();
 await page.getByRole('button',{name:'Color sólido',exact:true}).click();
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 const addVideo=page.locator('.add-track button').first();
 for(let index=0;index<5;index++)await addVideo.click();
 const filas=()=>page.evaluate(()=>{
  const headers=Array.from(document.querySelectorAll<HTMLElement>('#track-headers .track-header'));
  const lanes=Array.from(document.querySelectorAll<HTMLElement>('.track-lane'));
  return headers.map((node,index)=>({
   cabecera:Math.round(node.getBoundingClientRect().top),
   carril:lanes[index]?Math.round(lanes[index].getBoundingClientRect().top):null,
   altoCabecera:Math.round(node.getBoundingClientRect().height),
   altoCarril:lanes[index]?Math.round(lanes[index].getBoundingClientRect().height):null,
  }));
 });
 const comprobar=async()=>{
  const medidas=await filas();
  for(const fila of medidas){
   expect(fila.carril,`la cabecera no tiene carril: ${JSON.stringify(fila)}`).not.toBeNull();
   expect(Math.abs(fila.cabecera-(fila.carril??0)),`desfase cabecera/carril: ${JSON.stringify(fila)}`).toBeLessThanOrEqual(1);
   expect(fila.altoCabecera,`alturas distintas: ${JSON.stringify(fila)}`).toBe(fila.altoCarril);
  }
  return medidas.length;
 };
 expect(await comprobar()).toBe(8);
 // Con desplazamiento vertical siguen coincidiendo fila a fila.
 await page.locator('.timeline-scroll').hover();
 await page.keyboard.down('Control');
 await page.mouse.wheel(0,120);
 await page.keyboard.up('Control');
 await page.waitForTimeout(200);
 const desplazado=await page.locator('.timeline-scroll').evaluate(node=>node.scrollTop);
 expect(desplazado,`no se desplazó (scrollTop=${desplazado})`).toBeGreaterThan(0);
 expect(await comprobar()).toBe(8);
});
test('cada evento de vídeo lleva el botón de Panoramización y recorte, y los de audio no',async({page})=>{
 await page.locator('input[type=file]').nth(1).setInputFiles(fixture('vegas-montaje.xml'));
 await page.getByRole('button',{name:'Entendido'}).click();
 const videoEvent=page.locator('.timeline-event.video').first();
 const audioEvent=page.locator('.timeline-event.audio').first();
 await expect(videoEvent).toHaveCount(1);
 const cropButton=videoEvent.getByRole('button',{name:/Panoramización y recorte de/});
 await expect(cropButton).toHaveCount(1);
 // En los eventos de audio no tiene sentido y no aparece.
 await expect(audioEvent.getByRole('button',{name:/Panoramización y recorte de/})).toHaveCount(0);
 // El botón abre la ventana flotante directamente, sin pasar por las propiedades.
 await cropButton.click();
 await expect(page.locator('.pan-crop-window')).toHaveCount(1);
 await expect(page.locator('.pan-crop-window')).toBeVisible();
});
// La barra del evento de texto (y de subtítulo, que también es texto) lleva la chapa del complemento de texto
// —la primera de la imagen de referencia—, y su función es abrir el editor de texto; además, ese editor tiene
// que caber en la pantalla sin obligar a desplazar el diálogo para llegar a los ajustes.
test('el evento de texto lleva el icono que abre el editor, y el editor cabe en la pantalla',async({page})=>{
 await page.setViewportSize({width:1366,height:768});
 // Un título y un subtítulo importado desde un .srt, para cubrir los dos caminos.
 await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();
 await page.getByRole('button',{name:'Títulos y texto',exact:true}).click();
 await page.getByLabel('Texto del título').fill('CON ICONO');
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 const textEvent=page.locator('.timeline-event').filter({hasText:'CON ICONO'}).first();
 const textButton=textEvent.getByRole('button',{name:/Abrir el editor de texto de/});
 await expect(textButton).toHaveCount(1);
 // No es un botón de todos los eventos: con un solo evento de texto hay exactamente uno.
 await expect(page.getByRole('button',{name:/Abrir el editor de texto/})).toHaveCount(1);
 // Los subtítulos también son texto, así que su evento lleva el mismo icono.
 await page.locator('input[type=file]').nth(0).setInputFiles([fixture('subtitulos-prueba.srt')]);
 await expect(page.locator('.media-item').filter({hasText:'subtitulos-prueba.srt'})).toHaveCount(1,{timeout:60000});
 await page.locator('.media-item').filter({hasText:'subtitulos-prueba.srt'}).dblclick();
 await expect.poll(async()=>((await autosave(page)).events??[]).filter(event=>event.kind==='text').length,{message:'los subtítulos llegan a la línea de tiempo',timeout:30000}).toBe(3);
 await expect(page.getByRole('button',{name:/Abrir el editor de texto/})).toHaveCount(3);
 if(test.info().project.name==='chrome')await page.screenshot({path:path.resolve('evidencias','evento-icono-texto.png')});
 await textButton.click();
 const titles=page.locator('.titles-window');
 await expect(titles).toBeVisible();
 // El editor cabe: su ventana termina dentro del diálogo y su vista previa se ve entera.
 const fit=await titles.evaluate(()=>{
  const dialog=document.querySelector('.editor-dialog') as HTMLElement;
  const window_=document.querySelector('.titles-window') as HTMLElement;
  const preview=document.querySelector('.titles-preview') as HTMLElement;
  const fields=document.querySelector('.titles-fields') as HTMLElement;
  const dialogBox=dialog.getBoundingClientRect(), titlesBox=window_.getBoundingClientRect(), previewBox=preview.getBoundingClientRect();
  return {
   titlesInsideDialog: titlesBox.bottom<=dialogBox.bottom+1&&titlesBox.top>=dialogBox.top-1,
   dialogNeedsScroll: dialog.scrollHeight>dialog.clientHeight+2,
   previewVisible: previewBox.bottom<=globalThis.innerHeight+1&&previewBox.width>80&&previewBox.height>40,
   previewNextToFields: previewBox.right<=fields.getBoundingClientRect().left+1,
  };
 });
 expect(fit.titlesInsideDialog,'la ventana del editor se sale del diálogo').toBe(true);
 expect(fit.dialogNeedsScroll,'el diálogo obliga a desplazarse para llegar a los ajustes').toBe(false);
 expect(fit.previewVisible,'la vista previa del editor no se ve entera').toBe(true);
 expect(fit.previewNextToFields,'la vista previa y los ajustes van en dos columnas').toBe(true);
 // La ventana entra con una animación de 200 ms: se espera a que esté asentada antes de la captura.
 await page.waitForTimeout(400);
 if(test.info().project.name==='chrome')await page.screenshot({path:path.resolve('evidencias','titles-editor-cabe.png')});
 // Y los ajustes siguen todos ahí: se llega a los de abajo dentro de su columna, sin desplazar el diálogo.
 await titles.getByLabel('Grosor').fill('5');
 await expect(titles.getByLabel('Grosor')).toHaveValue('5');
 await titles.getByRole('button',{name:'Cerrar',exact:true}).click();
 // Cerrar el editor vuelve a las propiedades del evento, que es la ventana desde la que se abrió.
 await expect(titles).toHaveCount(0);
 await expect(page.getByRole('dialog').getByRole('tab',{name:'Evento de vídeo'})).toBeVisible();
});
// Las posiciones del texto de la ventana de títulos: «Texto centrado», «Arriba», «Abajo», el tercio inferior y
// la lista completa. Se comprueba en los píxeles de la vista previa —el texto blanco sobre el fondo negro de un
// proyecto vacío— y en el autoguardado, que es donde queda el anclaje y el desplazamiento.
test('las posiciones del texto: «Texto centrado», arriba, abajo y el tercio inferior colocan el texto',async({page},info)=>{
 await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();
 await page.getByRole('button',{name:'Títulos y texto',exact:true}).click();
 await page.getByLabel('Texto del título').fill('POSICIÓN');
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 const textEvent=page.locator('.timeline-event').filter({hasText:'POSICIÓN'}).first();
 await expect(textEvent).toBeVisible();
 await textEvent.getByRole('button',{name:/Abrir el editor de texto de/}).click();
 const titles=page.locator('.titles-window');
 await expect(titles).toBeVisible();
 await expect(titles.getByRole('group',{name:'Posiciones del texto'})).toBeVisible();
 // La posición del autoguardado, como una cadena que se puede comparar tal cual.
 const placed=()=>page.evaluate(()=>{
   const project=JSON.parse(localStorage.getItem('corte15-autosave-v1')??'{}') as {events?:{kind?:string;anchor?:string;transform?:{x?:number;y?:number}}[]};
   const event=(project.events??[]).find(item=>item.kind==='text');
   return `${event?.anchor??'middle-center'}|${Number(event?.transform?.x??0).toFixed(3)}|${Number(event?.transform?.y??0).toFixed(3)}`;
 });
 // Píxeles casi blancos de la vista previa, contados por tercios de alto: el texto es lo único blanco.
 const thirds=()=>page.evaluate(()=>{
   const canvas=document.querySelector('.titles-preview') as HTMLCanvasElement;
   const data=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;
   const counts=[0,0,0];
   for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
     const i=(y*canvas.width+x)*4;
     if(data[i]>200&&data[i+1]>200&&data[i+2]>200)counts[Math.min(2,Math.floor(y/(canvas.height/3)))]++;
   }
   return counts;
 });
 // Un título recién creado ya está centrado, y su botón lo dice.
 await expect.poll(placed,{message:'el título nuevo está centrado',timeout:20000}).toBe('middle-center|0.000|0.000');
 await expect(titles.getByRole('button',{name:'Texto centrado'})).toHaveAttribute('aria-pressed','true');
 const center=await thirds();
 expect(center[1],'con el texto centrado, lo blanco cae en el tercio de en medio').toBeGreaterThan(0);
 expect(center[0]+center[2],'y no en los de arriba ni abajo').toBe(0);
 // «Arriba (centrado)»: el bloque empieza al 8 % del alto.
 await titles.getByRole('button',{name:'Arriba (centrado)'}).click();
 await expect.poll(placed,{message:'la posición de arriba llega al modelo',timeout:20000}).toBe('top-center|0.000|-0.420');
 const top=await thirds();
 expect(top[0],'arriba el texto cae en el tercio de arriba').toBeGreaterThan(0);
 expect(top[2],'y no en el de abajo').toBe(0);
 // «Abajo (centrado)»: termina al 92 % del alto.
 await titles.getByRole('button',{name:'Abajo (centrado)'}).click();
 await expect.poll(placed,{message:'la posición de abajo llega al modelo',timeout:20000}).toBe('bottom-center|0.000|0.420');
 const bottom=await thirds();
 expect(bottom[2],'abajo el texto cae en el tercio de abajo').toBeGreaterThan(0);
 expect(bottom[0],'y no en el de arriba').toBe(0);
 // La lista completa coloca el tercio inferior, que se queda en la zona baja sin llegar al borde.
 await titles.getByLabel('Posición del texto').click();
 await page.getByRole('option',{name:'Tercio inferior · Tercio inferior (centrado)'}).click();
 await expect.poll(placed,{message:'el tercio inferior llega al modelo',timeout:20000}).toBe('bottom-center|0.000|0.140');
 const lower=await thirds();
 expect(lower[0],'el tercio inferior no toca la parte de arriba').toBe(0);
 expect(lower[1],'y se ve en la mitad del fotograma').toBeGreaterThan(0);
 expect(lower[2],'sin llegar al borde de abajo').toBe(0);
 // Y una esquina desde la lista: abajo a la derecha.
 await titles.getByLabel('Posición del texto').click();
 await page.getByRole('option',{name:'Abajo · Abajo a la derecha'}).click();
 await expect.poll(placed,{message:'la esquina de abajo a la derecha llega al modelo',timeout:20000}).toBe('bottom-right|0.450|0.420');
 const corner=await thirds();
 expect(corner[2],'la esquina se ve en el tercio de abajo').toBeGreaterThan(0);
 // El anclaje del grupo «Punto de anclaje» sigue la posición que se elige.
 await expect(titles.getByRole('button',{name:'Abajo derecha'})).toHaveAttribute('aria-pressed','true');
 if(info.project.name==='chrome')await page.screenshot({path:path.resolve('evidencias','titles-posiciones.png')});
 await titles.getByRole('button',{name:'Cerrar',exact:true}).click();
});
test('las plantillas de proyecto cambian el formato: TikTok, Reels y Shorts son verticales 1080×1920',async({page})=>{ await page.getByRole('button',{name:'Propiedades del proyecto',exact:true}).first().click();
 const panel=page.getByRole('dialog');
 await expect(panel).toBeVisible();
 // El proyecto nuevo es Full HD, así que la lista reconoce su plantilla.
 await expect(panel.getByLabel('Plantilla de proyecto')).toContainText('YouTube 1080p');
 for(const [plantilla,ancho,alto,fps] of [['TikTok','1080','1920','30'],['Reels','1080','1920','30'],['Shorts','1080','1920','60'],['Cuadrado','1080','1080','30']] as const){
  await panel.getByLabel('Plantilla de proyecto').click();
  // Se espera a que la lista esté **una sola vez** en el documento: la del desplegable anterior tarda un momento
  // en retirarse y, mientras conviven las dos, el clic podía caer en la que se está cerrando (y cerrar la
  // ventana al pasar por el fondo). Lo destapó la corrida de los cuatro motores.
  const option=page.getByRole('option',{name:new RegExp(plantilla)});
  await expect(option).toHaveCount(1);
  await option.click();
  await expect(panel,'elegir la plantilla no cierra la ventana de propiedades').toBeVisible();
  await expect(panel.getByLabel('Ancho',{exact:true})).toHaveValue(ancho);
  await expect(panel.getByLabel('Alto',{exact:true})).toHaveValue(alto);
  await expect(panel.getByLabel('FPS del proyecto')).toContainText(fps);
 }
 // La ventana explica qué plantilla está puesta y el formato resultante.
 await expect(panel.locator('.export-plan').first()).toContainText('Cuadrado 1080×1080');
 await expect(panel.locator('.export-plan').first()).toContainText('1080×1080 (1:1)');
 // Volvemos a una vertical y comprobamos que el monitor cambia de proporción (alto > ancho).
 await panel.getByLabel('Plantilla de proyecto').click();
 await page.getByRole('option',{name:/TikTok/}).click();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 const monitor=(await page.locator('.monitor canvas').boundingBox())!;
 expect(monitor.height,`el monitor no es vertical (${monitor.width}×${monitor.height})`).toBeGreaterThan(monitor.width);
 await expect(page.locator('.preview-meta')).toContainText('1080×1920');
 // El formato viaja en el autoguardado y sobrevive a recargar la página.
 await page.waitForTimeout(900);
 await page.reload();
 await expect(page.getByRole('button',{name:'Nuevo proyecto',exact:true})).toBeVisible({timeout:20000});
 await expect(page.locator('.preview-meta')).toContainText('1080×1920');
 if(test.info().project.name==='chrome')await page.screenshot({path:path.resolve('evidencias','plantilla-tiktok.png')});
});
test('el clic derecho abre el menú del editor en cualquier punto de la línea de tiempo',async({page})=>{
 await page.locator('input[type=file]').nth(1).setInputFiles(fixture('vegas-montaje.xml'));
 await page.getByRole('button',{name:'Entendido'}).click();
 await expect(page.locator('.timeline-event').first()).toBeVisible();
 // Un oyente en captura corre antes que el del editor: se lee `defaultPrevented` en el siguiente turno,
 // cuando el manejador del editor ya llamó a `preventDefault` (y cortó la propagación, así que un oyente en
 // fase de burbuja no llegaría a verlo).
 await page.evaluate(()=>{const w=window as unknown as {__menuNavegador:boolean|null};w.__menuNavegador=null;window.addEventListener('contextmenu',event=>{setTimeout(()=>{w.__menuNavegador=event.defaultPrevented;},0);},true);});
 const menu=page.getByRole('menu');
 // 1. Sobre un evento: las acciones del evento, empezando por sus ventanas.
 await page.locator('.timeline-event').first().click({button:'right'});
 await expect(menu).toBeVisible();
 // El menú del evento es el de VEGAS 15 (recurso POPUP_IDX_VIDEO_SURFACE en español): se comprueba la lista
 // entera, no solo un par de entradas.
 for(const label of ['Abrir en recortadora','Seleccionar en lista de medios del proyecto','Editar medios generados...','Efectos de medios...','Panoramización/recorte de evento de vídeo...','Efectos de evento de vídeo...','Cortar','Copiar','Pegar atributos de evento','Pegado selectivo de atributos de evento','Eliminar','Recortar','Recortar principio','Recortar final','Dividir','Crear subclip','Invertir','Seleccionar eventos hasta el final','Insertar/eliminar envolvente','Congelar fotograma en el cursor','Progreso de transición','Modificadores','Toma','Grupo','Sincronizar','Enlace sinc','Propiedades...'])
  await expect(menu.getByRole('menuitem',{name:label,exact:true}),`falta «${label}» en el menú del evento`).toHaveCount(1);
 if(test.info().project.name==='chrome')await page.screenshot({path:path.resolve('evidencias','menu-clic-derecho.png')});
 await page.waitForTimeout(50);
 expect(await page.evaluate(()=>(window as unknown as {__menuNavegador:boolean|null}).__menuNavegador),'el navegador abrió su propio menú').toBe(true);
 // Escape lo cierra sin tocar el proyecto.
 await page.keyboard.press('Escape');
 await expect(menu).toHaveCount(0);
 // 2. Sobre la regla: tramo, bucle y marcador.
 await page.locator('.ruler').click({button:'right',position:{x:220,y:22}});
 await expect(menu).toContainText('Marcar el inicio del tramo aquí');
 await expect(menu).toContainText('Marcar el fin del tramo aquí');
 await expect(menu).toContainText('Quitar la región de bucle');
 await page.keyboard.press('Escape');
 // 3. Sobre un carril vacío, lejos de cualquier evento: las acciones de la pista.
 await page.locator('.track-lane').first().click({button:'right',position:{x:900,y:30}});
 await expect(menu).toContainText('Propiedades de la pista');
 await expect(menu).toContainText('Movimiento de pista');
 await expect(menu).toContainText('Silenciar la pista');
 await page.keyboard.press('Escape');
 // 4. Sobre el panel de medios: insertar, trimmer y revincular.
 await page.locator('.media-item').first().click({button:'right'});
 await expect(menu).toContainText('Insertar en el cursor');
 await expect(menu).toContainText('Revincular con un archivo');
 await page.keyboard.press('Escape');
 // 5. Sobre el monitor: las acciones de la vista previa y del proyecto.
 await page.locator('.monitor').click({button:'right',position:{x:60,y:60}});
 await expect(menu).toContainText('Propiedades del proyecto');
 await expect(menu).toContainText('Reproducir o pausar');
 await page.keyboard.press('Escape');
 // 6. Pegado al borde derecho e inferior, el menú se mete entero en la pantalla.
 const viewport=page.viewportSize()!;
 const shell=page.locator('main.editor');
 const shellBox=(await shell.boundingBox())!;
 await shell.click({button:'right',position:{x:shellBox.width-4,y:shellBox.height-4}});
 await expect(menu).toBeVisible();
 const box=(await menu.boundingBox())!;
 expect(box.x+box.width,`el menú se sale por la derecha (${box.x}+${box.width} > ${viewport.width})`).toBeLessThanOrEqual(viewport.width+1);
 expect(box.y+box.height,`el menú se sale por abajo (${box.y}+${box.height} > ${viewport.height})`).toBeLessThanOrEqual(viewport.height+1);
 await page.keyboard.press('Escape');
 await expect(menu).toHaveCount(0);
});
// Los submenús «▸» del menú del evento (Modificadores, Grupo, Sincronizar…) y la ventana «Propiedades» con sus
// dos pestañas: lo que se replica de VEGAS 15 es lo que se comprueba aquí, incluidos los interruptores.
test('el submenú Modificadores y la ventana Propiedades funcionan como los de VEGAS',async({page})=>{
 // El menú del evento de VEGAS es largo: con una ventana alta cabe entero y se puede recorrer sin desplazarlo.
 await page.setViewportSize({width:1440,height:1200});
 await page.locator('input[type=file]').nth(1).setInputFiles(fixture('vegas-montaje.xml'));
 await page.getByRole('button',{name:'Entendido'}).click();
 const clips=page.locator('.timeline-event');
 await expect(clips.first()).toBeVisible();
 const total=await clips.count();
 const first=clips.first();

 // «Modificadores ▸ Bloqueo»: el evento queda bloqueado y lo dice.
 await first.click({button:'right'});
 const menu=page.getByRole('menu');
 await menu.getByRole('menuitem',{name:'Modificadores',exact:true}).hover();
 const submenu=page.getByRole('menu',{name:'Modificadores'});
 await expect(submenu).toBeVisible();
 for(const label of ['Silencio','Bloqueo','Bucle','Mantener relación de aspecto','Reducir parpadeo de entrelazado','Utilice el modo Re-muestreo de proyecto','Forzar re-muestreo','Deshabilitar re-muestreo'])
  await expect(submenu.getByRole('menuitem',{name:label,exact:true}),`falta «${label}» en Modificadores`).toHaveCount(1);
 await submenu.getByRole('menuitem',{name:'Bloqueo',exact:true}).click();
 await expect(page.getByRole('status').first()).toContainText('Bloqueo activado');
 const lockedCount=async()=>((await autosave(page)).events??[]).filter(item=>item.locked).length;
 await expect.poll(lockedCount,{message:'el bloqueo llega al autoguardado',timeout:20000}).toBeGreaterThan(0);
 // El interruptor se aplica al evento y a su audio enlazado, como en el menú.
 const lockedGroup=await lockedCount();
 expect(lockedGroup).toBeGreaterThanOrEqual(1);

 // Un evento bloqueado no se borra con Supr ni se mueve al arrastrarlo.
 await first.click();
 await page.keyboard.press('Delete');
 await expect(clips).toHaveCount(total);
 await expect(page.getByRole('status').first()).toContainText('bloqueados');

 // La ventana «Propiedades» tiene las dos pestañas de VEGAS y sus interruptores.
 await first.dblclick();
 const dialog=page.getByRole('dialog');
 await expect(dialog.getByRole('tab',{name:'Evento de vídeo'})).toBeVisible();
 await expect(dialog.getByRole('tab',{name:'Medios'})).toBeVisible();
 await expect(dialog.getByLabel('Nombre de toma activa')).toBeVisible();
 for(const label of ['Silencio','Bloqueo','Bucle','Mantener relación de aspecto','Reducir parpadeo de entrelazado','Ajustarse a la velocidad de fotogramas del proyecto','Invertir el material (reproducir al revés)'])
  await expect(dialog.getByLabel(label),`falta «${label}» en la ventana Propiedades`).toHaveCount(1);
 for(const label of ['Utilice el modo Re-muestreo de proyecto','Forzar re-muestreo','Deshabilitar re-muestreo'])
  await expect(dialog.getByRole('radio',{name:label})).toHaveCount(1);
 await expect(dialog.getByLabel('Velocidad de reproducción')).toBeVisible();
 await expect(dialog.getByLabel('Veloc. de inframuestreo (fps)')).toBeVisible();
 if(test.info().project.name==='chrome')await page.screenshot({path:path.resolve('evidencias','propiedades-replica-vegas.png')});
 await dialog.getByRole('tab',{name:'Medios'}).click();
 await expect(dialog).toContainText('Nombre de archivo:');
 await expect(dialog).toContainText('Relación de aspecto del píxel:');
 await expect(dialog).toContainText('Espacio de color:');
 if(test.info().project.name==='chrome')await page.screenshot({path:path.resolve('evidencias','propiedades-replica-medios.png')});
 await dialog.getByRole('tab',{name:'Evento de vídeo'}).click();

 // «Cancelar» devuelve el evento a como estaba: se desbloquea en la ventana, se cancela y vuelve a estar bloqueado.
 await dialog.getByLabel('Bloqueo').uncheck();
 await expect.poll(lockedCount,{message:'el desbloqueo se ve al momento',timeout:20000}).toBe(0);
 await dialog.getByRole('button',{name:'Cancelar'}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect.poll(lockedCount,{message:'Cancelar no revierte el bloqueo',timeout:20000}).toBe(lockedGroup);

 // «Aceptar» sí lo aplica: sin bloqueo, Supr vuelve a borrar.
 await first.dblclick();
 await page.getByRole('dialog').getByLabel('Bloqueo').uncheck();
 await page.getByRole('dialog').getByRole('button',{name:'Aceptar'}).click();
 await expect.poll(lockedCount,{message:'Aceptar aplica el desbloqueo',timeout:20000}).toBe(0);
 await first.click();
 await page.keyboard.press('Delete');
 await expect.poll(async()=>clips.count(),{message:'el evento desbloqueado se borra',timeout:20000}).toBeLessThan(total);
});

// Lo que hace el script «Remove Letterboxing.cs» de VEGAS Pro 15 y, además, la banda negra que ese script no
// mira: la incrustada en el propio archivo, detectada analizando los píxeles del medio.
test('Quitar bandas negras: detecta la banda incrustada en la imagen y la recorta',async({page})=>{
 await page.locator('input[type=file]').nth(0).setInputFiles([fixture('bandas-horizontales.png'),fixture('bandas-laterales.png'),fixture('sin-bandas.png')]);
 await expect(page.locator('.media-item')).toHaveCount(3,{timeout:60000});
 const insert=async(name:string)=>{
  await page.locator('.media-item').filter({hasText:name}).first().click();
  await page.getByRole('button',{name:'Insertar medio seleccionado'}).click();
  await expect(page.locator('.timeline-event').filter({hasText:name})).toHaveCount(1);
 };
 const maskOf=(name:string)=>page.evaluate((pattern)=>{
  const project=JSON.parse(localStorage.getItem('corte15-autosave-v1')??'{}');
  const event=(project.events??[]).find((item:{name:string})=>new RegExp(pattern).test(item.name));
  return event?.mask??null;
 },name);
 // La banda horizontal (30 px arriba y abajo de 180) y la lateral (30 px a cada lado de 180).
 await insert('bandas-horizontales.png');
 await page.getByRole('button',{name:'Herramientas'}).click();
 await page.getByRole('menuitem',{name:/Quitar bandas negras/}).click();
 await expect.poll(async()=>Number((await maskOf('bandas-horizontales'))?.top??0),{message:'la banda de arriba llega al modelo',timeout:20000}).toBeGreaterThan(.15);
 const horizontal=await maskOf('bandas-horizontales');
 expect(Number(horizontal.top)).toBeCloseTo(30/180,2);
 expect(Number(horizontal.bottom)).toBeCloseTo(30/180,2);
 expect(Number(horizontal.left)).toBe(0);
 expect(Number(horizontal.right)).toBe(0);
 await expect(page.getByRole('status').first()).toContainText('Bandas negras recortadas');
 await expect(page.getByRole('status').first()).toContainText('arriba 16.7 %');
 // La lateral, con el mismo comando (sin selección se aplica a todos los eventos de vídeo, como el script).
 await insert('bandas-laterales.png');
 await page.getByRole('button',{name:'Herramientas'}).click();
 await page.getByRole('menuitem',{name:/Quitar bandas negras/}).click();
 await expect.poll(async()=>Number((await maskOf('bandas-laterales'))?.left??0),{message:'la banda lateral llega al modelo',timeout:20000}).toBeGreaterThan(.15);
 const lateral=await maskOf('bandas-laterales');
 expect(Number(lateral.left)).toBeCloseTo(30/180,2);
 expect(Number(lateral.right)).toBeCloseTo(30/180,2);
 expect(Number(lateral.top)).toBe(0);
 // Y una imagen sin bandas no se toca: sigue sin máscara.
 expect(await maskOf('sin-bandas')).toBeNull();
 // El encaje a la relación del proyecto es la otra mitad del script: cubrir el fotograma sin deformar.
 const scaleOf=(name:string)=>page.evaluate((pattern)=>{
  const project=JSON.parse(localStorage.getItem('corte15-autosave-v1')??'{}');
  const event=(project.events??[]).find((item:{name:string})=>new RegExp(pattern).test(item.name));
  return Number(event?.transform?.scale??0);
 },name);
 await page.getByRole('button',{name:'Herramientas'}).click();
 await page.getByRole('menuitem',{name:/Encajar el contenido al fotograma/}).click();
 await expect.poll(()=>scaleOf('bandas-laterales'),{message:'el encaje cambia la escala del medio vertical',timeout:20000}).toBeGreaterThan(1);
 await expect(page.getByRole('status').first()).toContainText('Contenido encajado al fotograma');
 if(test.info().project.name==='chrome')await page.screenshot({path:path.resolve('evidencias','bandas-negras.png')});
});
// «Mantener relación de aspecto» de las propiedades del evento: la casilla viene puesta, así que el material
// conserva su proporción y deja bandas negras donde no cuadra con el fotograma; al quitarla se estira hasta
// llenarlo, aunque se deforme. Es la misma casilla que la del grupo «Origen» de Panoramización/recorte.
test('Mantener relación de aspecto: quitarla estira el material hasta cubrir el fotograma',async({page},info)=>{
 await page.setViewportSize({width:1440,height:1000});
 // Un cuadrado verde de 180×180 en un proyecto 16:9: con la casilla puesta solo ocupa el centro y deja bandas.
 await page.locator('input[type=file]').nth(0).setInputFiles(fixture('cuadro.png'));
 await expect(page.locator('.media-item')).toHaveCount(1,{timeout:60000});
 await page.locator('.media-item').first().click();
 await page.getByRole('button',{name:'Insertar medio seleccionado'}).click();
 const clip=page.locator('.timeline-event.video').first();
 await expect(clip).toBeVisible();
 // Tres columnas del fotograma muestreadas en el lienzo del monitor: los dos bordes laterales y el centro.
 const columns=()=>page.evaluate(()=>{
  const canvas=document.querySelector('.monitor canvas') as HTMLCanvasElement;
  const ctx=canvas.getContext('2d')!;
  const row=Math.round(canvas.height/2);
  const at=(fraction:number)=>{const pixel=ctx.getImageData(Math.min(canvas.width-1,Math.round(canvas.width*fraction)),row,1,1).data;return [pixel[0],pixel[1],pixel[2]];};
  return {left:at(.02),middle:at(.5),right:at(.98),size:`${canvas.width}×${canvas.height}`};
 });
 const isGreen=(pixel:number[])=>pixel[1]>120&&pixel[0]<120&&pixel[2]<160;
 const isBlack=(pixel:number[])=>pixel[0]+pixel[1]+pixel[2]<40;
 // El campo del modelo tal cual queda en el autoguardado: sin tocar nada no se escribe, porque puesto es el valor por defecto.
 const aspectOf=()=>page.evaluate(()=>{
  const project=JSON.parse(localStorage.getItem('corte15-autosave-v1')??'{}');
  return (project.events??[])[0]?.maintainAspect??null;
 });
 await expect.poll(async()=>isGreen((await columns()).middle),{message:'la vista previa pinta el cuadrado',timeout:20000}).toBe(true);
 const framed=await columns();
 expect(isBlack(framed.left),`el borde izquierdo deja banda negra, no se estira (${framed.size})`).toBe(true);
 expect(isBlack(framed.right),`el borde derecho deja banda negra, no se estira (${framed.size})`).toBe(true);
 expect(await aspectOf(),'sin tocar la casilla el evento no lleva el campo: puesto es el valor por defecto').toBe(null);
 // El menú del evento la enseña marcada, como el submenú «Modificadores» de VEGAS.
 await clip.click({button:'right'});
 await page.getByRole('menu').getByRole('menuitem',{name:'Modificadores',exact:true}).hover();
 await expect(page.getByRole('menu',{name:'Modificadores'}).getByRole('menuitem',{name:'Mantener relación de aspecto',exact:true})).toHaveClass(/checked/);
 await page.keyboard.press('Escape');
 // La ventana «Propiedades»: la casilla está activa y marcada.
 await clip.dblclick();
 const dialog=page.getByRole('dialog');
 const aspect=dialog.getByLabel('Mantener relación de aspecto');
 await expect(aspect,'la casilla viene activada por defecto').toBeChecked();
 await expect(aspect).toBeEnabled();
 await aspect.uncheck();
 await dialog.getByRole('button',{name:'Aceptar'}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect.poll(aspectOf,{message:'quitar la casilla llega al modelo',timeout:20000}).toBe(false);
 await expect.poll(async()=>{const probe=await columns();return isGreen(probe.left)&&isGreen(probe.middle)&&isGreen(probe.right);},{message:'el material se estira hasta los tres bordes del fotograma',timeout:20000}).toBe(true);
 // Y desde el grupo «Origen» de Panoramización/recorte se vuelve a poner: reaparecen las bandas laterales.
 await clip.dblclick();
 await page.getByRole('button',{name:/Abrir la ventana de Panoramización y recorte/}).click();
 const window=page.locator('.pan-crop-window');
 await expect(window).toBeVisible();
 const source=window.locator('.param-group').filter({has:page.locator('.param-group-name',{hasText:'Origen'})});
 await source.locator('.param-group-title').click();
 const origin=source.getByLabel('Mantener rel. de aspecto');
 await expect(origin).toBeEnabled();
 await expect(origin).not.toBeChecked();
 await origin.check();
 await expect.poll(aspectOf,{message:'volver a ponerla desde Panoramización/recorte llega al modelo',timeout:20000}).toBe(true);
 await expect.poll(async()=>{const probe=await columns();return isBlack(probe.left)&&isGreen(probe.middle)&&isBlack(probe.right);},{message:'vuelven las bandas laterales',timeout:20000}).toBe(true);
 if(info.project.name==='chrome')await page.screenshot({path:path.resolve('evidencias','relacion-aspecto.png')});
});
// La selección de recorte de la ventana de Panoramización/recorte: «Agregar recorte» la dibuja sobre el monitor
// con sus ocho puntos, **las esquinas recortan y acercan** (cuanto más pequeña la selección, más cerca; al
// agrandarla, se aleja) y **la rueda acerca y aleja la vista** de la ventana sin tocar el encuadre.
test('la selección de recorte: las esquinas recortan y acercan, y la rueda acerca la vista',async({page},info)=>{
 await page.setViewportSize({width:1440,height:1000});
 // Un cuadrado verde de 180×180 en un proyecto 16:9: se ajusta a 360×360 centrado en el fotograma de 640×360.
 await page.locator('input[type=file]').nth(0).setInputFiles(fixture('cuadro.png'));
 await expect(page.locator('.media-item')).toHaveCount(1,{timeout:60000});
 await page.locator('.media-item').first().click();
 await page.getByRole('button',{name:'Insertar medio seleccionado'}).click();
 const clip=page.locator('.timeline-event.video').first();
 await expect(clip).toBeVisible();
 await clip.hover();
 await clip.getByRole('button',{name:/Panoramización y recorte/}).click();
 const pancrop=page.locator('.pan-crop-window');
 await expect(pancrop).toBeVisible();
 const stage=pancrop.locator('.pan-crop-stage');
 // Lo que ha llegado al modelo: el recorte y la pose del evento.
 const state=()=>page.evaluate(()=>{
   const project=JSON.parse(localStorage.getItem('corte15-autosave-v1')??'{}');
   const event=(project.events??[])[0] as {mask?:{left:number;right:number;top:number;bottom:number};transform?:{x:number;y:number;scale:number}}|undefined;
   return {mask:event?.mask??null,transform:event?.transform??{x:0,y:0,scale:1}};
 });
 // Los píxeles del color de la selección (#7ee0ff) que hay en el monitor.
 const selectionInk=()=>stage.evaluate(node=>{
   const canvas=node as HTMLCanvasElement;
   const data=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;
   let total=0;
   for(let i=0;i<data.length;i+=4)if(data[i]<175&&data[i+1]>195&&data[i+2]>235)total++;
   return total;
 });
 // El punto de la selección más abajo y a la derecha es su esquina inferior derecha, tal como se ve en el
 // monitor (ya con el zoom aplicado): se busca en los píxeles en vez de repetir la geometría en la prueba.
 const drawnCorner=async()=>{
   const spot=await stage.evaluate(node=>{
     const canvas=node as HTMLCanvasElement;
     const data=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;
     let best={x:-1,y:-1};
     for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
       const i=(y*canvas.width+x)*4;
       if(data[i]<175&&data[i+1]>195&&data[i+2]>235&&x+y>best.x+best.y)best={x,y};
     }
     return best;
   });
   const box=(await stage.boundingBox())!;
   const ratio=box.width/await stage.evaluate(node=>(node as HTMLCanvasElement).width);
   return {x:box.x+spot.x*ratio,y:box.y+spot.y*ratio};
 };
 const drag=async(from:{x:number;y:number},dx:number,dy:number)=>{
   await page.mouse.move(from.x,from.y);
   await page.mouse.down();
   for(let step=1;step<=8;step++){await page.mouse.move(from.x+dx*step/8,from.y+dy*step/8);await page.waitForTimeout(20);}
   await page.mouse.up();
 };
 // Sin la selección puesta no hay ni un píxel de ese color y el monitor lo dice.
 await expect(stage).toHaveAttribute('data-crop-selection','off');
 expect(await selectionInk(),'sin selección no se dibuja nada de ese color').toBe(0);
 expect((await state()).mask).toBeNull();
 // «Agregar recorte» la pone: aparecen el recuadro discontinuo y sus puntos, y la ventana lo explica.
 await pancrop.getByRole('button',{name:'Agregar recorte'}).click();
 await expect(stage).toHaveAttribute('data-crop-selection','on');
 await expect.poll(selectionInk,{message:'la selección de recorte se dibuja en el monitor',timeout:10000}).toBeGreaterThan(0);
 await expect(pancrop.locator('.pan-crop-hint')).toContainText('Selección de recorte');
 // Arrastrar la esquina inferior derecha hacia dentro recorta (los cuatro márgenes llegan al modelo) y acerca:
 // la escala sube por encima de 1. Es lo que se ve en el monitor: el cuadrado ocupa más.
 const corner=await drawnCorner();
 await drag(corner,-80,-48);
 await expect.poll(async()=>{const current=await state();return Boolean(current.mask)&&Number(current.mask?.right)>0&&Number(current.transform.scale)>1;},{message:'la esquina recorta y acerca',timeout:20000}).toBe(true);
 const zoomed=await state();
 expect(Number(zoomed.mask?.right),'la esquina recorta por la derecha').toBeGreaterThan(0);
 expect(Number(zoomed.mask?.bottom),'la esquina recorta por abajo').toBeGreaterThan(0);
 expect(Number(zoomed.transform.scale),'la selección más pequeña acerca la imagen').toBeGreaterThan(1.05);
 if(info.project.name==='chrome')await page.screenshot({path:path.resolve('evidencias','seleccion-recorte.png')});
 // Y al revés: arrastrar el punto hacia fuera agranda la selección y aleja la imagen.
 const grown=await drawnCorner();
 await drag(grown,90,16);
 await expect.poll(async()=>Number((await state()).transform.scale),{message:'agrandar la selección aleja la imagen',timeout:20000}).toBeLessThan(Number(zoomed.transform.scale));
 const back=await state();
 expect(Number(back.mask?.right)).toBeLessThan(Number(zoomed.mask?.right));
 // La rueda acerca y aleja **la vista** de la ventana («Vista de zoom (%)») y no toca el encuadre. El campo
 // vive en el grupo «Área de trabajo», que empieza plegado: se abre para poder leerlo.
 const area=pancrop.locator('.param-group').filter({has:page.locator('.param-group-name',{hasText:'Área de trabajo'})});
 await area.locator('.param-group-title').click();
 await expect(area.locator('.param-group-title')).toHaveAttribute('aria-expanded','true');
 const beforeWheel=await state();
 const middle=(await stage.boundingBox())!;
 await page.mouse.move(middle.x+middle.width/2,middle.y+middle.height/2);
 await page.mouse.wheel(0,-400);
 await expect.poll(async()=>Number(await stage.getAttribute('data-view-zoom')),{message:'la rueda acerca la vista',timeout:10000}).toBeGreaterThan(100);
 const zoomedView=Number(await stage.getAttribute('data-view-zoom'));
 const field=Number((await pancrop.getByLabel('Vista de zoom (%)').inputValue()).replace(/,/g,''));
 expect(Math.round(field),'el campo de la vista muestra el zoom de la rueda').toBe(zoomedView);
 await page.mouse.wheel(0,600);
 await expect.poll(async()=>Number(await stage.getAttribute('data-view-zoom')),{message:'la rueda hacia abajo aleja la vista',timeout:10000}).toBeLessThan(zoomedView);
 expect(Number((await state()).transform.scale),'la rueda no cambia el encuadre').toBe(Number(beforeWheel.transform.scale));
 // Y **fuera del monitor** la rueda no toca nada: ni la vista del monitor, ni la columna de parámetros (que se
 // desplaza con la barra), ni la línea de tiempo de detrás. Es lo que pide el flujo de trabajo: la rueda solo
 // afecta a lo que está dentro del recuadro.
 const params=pancrop.locator('.pan-crop-params');
 const paramsScroll=await params.evaluate(node=>node.scrollTop);
 const timelineWidth=()=>page.locator('.timeline-content').evaluate(node=>node.getBoundingClientRect().width);
 const timelineBefore=await timelineWidth();
 const viewBefore=Number(await stage.getAttribute('data-view-zoom'));
 const paramsBox=(await params.boundingBox())!;
 await page.mouse.move(paramsBox.x+paramsBox.width/2,paramsBox.y+Math.min(120,paramsBox.height/2));
 await page.mouse.wheel(0,-400);
 await page.waitForTimeout(200);
 expect(Number(await stage.getAttribute('data-view-zoom')),'la rueda fuera del recuadro no cambia la vista del monitor').toBe(viewBefore);
 expect(await params.evaluate(node=>node.scrollTop),'ni desplaza la columna de parámetros').toBe(paramsScroll);
 expect(await timelineWidth(),'ni cambia la línea de tiempo de detrás').toBe(timelineBefore);
});
// El «Render Audio Tracks.cs» de VEGAS: una salida por pista de audio en la cola de renderizado.
test('Una salida por pista de audio: la cola recibe un trabajo WAV por pista',async({page})=>{
 const missing=await page.evaluate(()=>['AudioDecoder','AudioContext'].filter(name=>typeof (globalThis as Record<string,unknown>)[name]==='undefined'));
 test.skip(missing.length>0,`El motor no expone: ${missing.join(', ')}.`);
 await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Audio.wav')]);
 await expect(page.locator('.media-item')).toHaveCount(1,{timeout:60000});
 await page.locator('.media-item').first().dblclick();
 await expect(page.locator('.timeline-event.audio')).toHaveCount(1);
 // Una segunda pista de audio con su propio nombre, para que haya dos salidas.
 await page.getByRole('button',{name:'Insertar',exact:true}).click();
 await page.getByRole('menuitem',{name:'Pista de audio'}).click();
 await expect(page.locator('.track-header.audio')).toHaveCount(2);
 await page.locator('.track-header.audio').nth(1).locator('button[title^="Propiedades de"]').click();
 await page.getByLabel('Nombre',{exact:true}).fill('Música');
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'Renderizar como…'}).click();
 const dialog=page.getByRole('dialog');
 await dialog.getByRole('button',{name:'Añadir una salida por pista de audio'}).click();
 const jobs=dialog.locator('.batch-list li');
 await expect(jobs).toHaveCount(2);
 await expect(jobs.nth(0)).toContainText('WAV · solo la pista «Audio»');
 await expect(jobs.nth(1)).toContainText('WAV · solo la pista «Música»');
 await expect(jobs.nth(0)).toContainText('En espera');
 await dialog.getByRole('button',{name:'Vaciar la cola'}).click();
 await expect(jobs).toHaveCount(0);
 if(test.info().project.name==='chrome')await page.screenshot({path:path.resolve('evidencias','audio-por-pista.png')});
});
// Lo que hacen los scripts «Export Chapters.cs» y «Export Regions as Subtitles.cs» de VEGAS Pro 15.
test('Exportar los marcadores: capítulos para YouTube, CSV, XML y subtítulos .srt',async({page})=>{
 const event=page.locator('.timeline-event');
 // Un proyecto con algo de contenido y tres marcadores en instantes distintos.
 await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();
 await page.getByRole('button',{name:'Color sólido',exact:true}).click();
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 const ruler=page.locator('.ruler');
 for(const [x,label] of [[40,'Primera parte'],[160,'Segunda parte'],[320,'Cierre']] as const){
  await ruler.click({position:{x,y:30}});
  await page.keyboard.press('m');
  void label;
 }
 const markers=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('corte15-autosave-v1')??'{}').markers??[]);
 await expect.poll(async()=>(await markers()).length,{message:'los tres marcadores llegan al autoguardado',timeout:20000}).toBe(3);
 await page.getByRole('button',{name:'Archivo'}).click();
 await page.getByRole('menuitem',{name:/Exportar los marcadores/}).click();
 const dialog=page.getByRole('dialog');
 await expect(dialog).toContainText('3');
 await expect(dialog.locator('.marker-preview')).toContainText('00:00');
 const download=async(option:RegExp)=>{
  await dialog.getByLabel('Formato de exportación').click();
  await page.getByRole('option',{name:option}).click();
  const [file]=await Promise.all([page.waitForEvent('download'),dialog.getByRole('button',{name:/^Descargar/}).click()]);
  return fs.readFileSync((await file.path())!,'utf8');
 };
 // La lista de capítulos para YouTube empieza en 00:00 y lleva nombre.
 const youtube=await download(/YouTube/);
 const lines=youtube.trim().split('\n');
 expect(lines[0]).toMatch(/^0:00 /);
 expect(lines.length).toBeGreaterThanOrEqual(3);
 expect(lines[1]).toMatch(/^\d+:\d\d /);
 // El CSV con cabecera y una fila por marcador.
 const csv=await download(/Hoja de cálculo/);
 expect(csv.split('\n')[0]).toBe('timecode,segundos,nombre');
 expect(csv.trim().split('\n').length).toBe(4);
 // El XML con la estructura del script de VEGAS y el nombre añadido.
 const xml=await download(/Lista XML/);
 expect(xml).toContain('<Chapters>');
 expect(xml).toMatch(/<chapter ID="0" Time-code="[^"]+" Label="[^"]+" \/>/);
 // Y los subtítulos, que es el caso de uso del otro script: cada marcador desde su instante.
 const srt=await download(/Subtítulos/);
 expect(srt).toMatch(/^1\n\d\d:\d\d:\d\d,\d\d\d --> \d\d:\d\d:\d\d,\d\d\d\nMarcador 1/);
 expect(srt.trim().split(/\n{2,}/).length).toBe(3);
 if(test.info().project.name==='chrome')await page.screenshot({path:path.resolve('evidencias','exportar-marcadores.png')});
 // El diálogo se cierra antes de mirar la barra de estado: mientras está abierto, el resto de la página queda
 // fuera del árbol de accesibilidad.
 await dialog.getByRole('button',{name:'Cancelar'}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.getByRole('status').first()).toContainText('Exportados 3 marcador');
});

// El panel de medidores del maestro se ensancha y se estrecha arrastrando su divisor: es lo que hace legible su
// nota de sonoridad, que en el ancho mínimo se parte en muchas líneas.
test('los medidores se ensanchan arrastrando su divisor y el texto se lee mejor',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 const meters=page.locator('.meters');
 const splitter=page.locator('.meters-splitter');
 await expect(meters).toBeVisible();
 await expect(splitter).toBeVisible();
 const linesOf=async()=>page.evaluate(()=>{
  const note=document.querySelector('.meter-note') as HTMLElement|null;
  if(!note)return 0;
  const style=getComputedStyle(note);
  return Math.round(note.getBoundingClientRect().height/parseFloat(style.lineHeight||'13'));
 });
 const before=(await meters.boundingBox())!;
 const beforeLines=await linesOf();
 // El divisor se mide en cada intento y el gesto se reintenta si el agarre no prende: en WebKit, con la máquina
 // cargada por los cuatro motores, un «down» que cae justo donde acababa de haber un «up» se pierde de vez en
 // cuando (lo destaparon las corridas completas). Lo que se comprueba es el resultado.
 const dragSplitter=async(delta:number)=>{
  const handle=(await splitter.boundingBox())!;
  await page.mouse.move(24,24);
  await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);
  await page.mouse.down();
  await page.mouse.move(handle.x+handle.width/2+delta,handle.y+handle.height/2,{steps:8});
  await page.mouse.up();
  return (await meters.boundingBox())!;
 };
 // Arrastrar el divisor 120 px hacia la izquierda ensancha el panel.
 let after=await dragSplitter(-120);
 for(let attempt=0;attempt<2&&Math.round(after.width)<=Math.round(before.width)+100;attempt++)after=await dragSplitter(-120);
 expect(Math.round(after.width)).toBeGreaterThan(Math.round(before.width)+100);
 // Y con el panel ancho la nota ocupa menos líneas: el texto se lee de un vistazo.
 const afterLines=await linesOf();
 expect(afterLines,'la nota debería ocupar menos líneas con el panel ancho').toBeLessThan(beforeLines);
 // La barra de medidores sigue dentro del panel y el pie de la línea de tiempo no se ha movido.
 await expect(page.locator('.meter-bar')).toHaveCount(2);
 expect(Math.round((await page.locator('.timeline-section').boundingBox())!.width)).toBe(1440);
 if(test.info().project.name==='chrome')await page.screenshot({path:path.resolve('evidencias','medidores-anchos.png'),clip:{x:1440-420,y:0,width:420,height:900}});
 // Y se puede volver a estrechar: el ancho no se queda pegado. El mismo gesto, con el signo al revés y su
 // reintento, porque tras ensanchar el panel el divisor ya no está donde estaba.
 let narrowed=await dragSplitter(60);
 for(let attempt=0;attempt<2&&Math.round(narrowed.width)>=Math.round(after.width);attempt++)narrowed=await dragSplitter(60);
 expect(Math.round(narrowed.width),'el ancho no se queda pegado').toBeLessThan(Math.round(after.width));
 expect(Math.round(narrowed.width)).toBeGreaterThanOrEqual(54);
});

// La vista previa se acerca y se aleja con la rueda del ratón (y con los botones del panel). El zoom es de la
// **vista**, no del recurso: la escala del evento no se toca. Además, desde que el marco envuelve al lienzo, la
// caja de las asas mide exactamente lo mismo que el vídeo, también con un proyecto vertical.
test('la rueda acerca la vista previa sin tocar el encuadre y las asas siguen al vídeo',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();
 await page.getByRole('button',{name:'Color sólido',exact:true}).click();
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.locator('.timeline-event').first().click();
 const frame=page.locator('.monitor-frame');
 const monitor=page.locator('.monitor');
 await expect(frame).toBeVisible();
 const before=(await frame.boundingBox())!;
 const monitorBox=(await monitor.boundingBox())!;
 const zoomChip=page.getByRole('button',{name:'Ajustar la vista previa al panel'});
 await expect(zoomChip).toHaveText('100 %');
 // 1. La rueda hacia arriba acerca: el fotograma crece y el monitor se vuelve desplazable.
 await page.mouse.move(monitorBox.x+monitorBox.width/2,monitorBox.y+monitorBox.height/2);
 await page.mouse.wheel(0,-400);
 await expect.poll(async()=>Math.round((await frame.boundingBox())!.width),{message:'la rueda acerca la vista',timeout:10000}).toBeGreaterThan(Math.round(before.width)+40);
 await expect(zoomChip).not.toHaveText('100 %');
 const grown=await monitor.evaluate(node=>({scrollWidth:node.scrollWidth,clientWidth:node.clientWidth,scrollHeight:node.scrollHeight,clientHeight:node.clientHeight}));
 expect(grown.scrollWidth,'el monitor se puede desplazar al ampliar').toBeGreaterThan(grown.clientWidth);
 // 2. El encuadre del evento no se ha tocado: la escala sigue en el 100 %.
 await expect(page.locator('.preview-badge')).toContainText('100 %');
 const scale=await page.evaluate(()=>Number((JSON.parse(localStorage.getItem("corte15-autosave-v1")||"{}").events||[])[0]?.transform?.scale??1));
 expect(scale).toBe(1);
 // 3. Las asas caen sobre el vídeo: la caja del overlay mide lo mismo que el lienzo.
 const aligned=await page.evaluate(()=>{
  const canvas=document.querySelector<HTMLElement>('.monitor-frame canvas')!.getBoundingClientRect();
  const overlay=document.querySelector<HTMLElement>('.preview-overlay')!.getBoundingClientRect();
  return {dx:Math.abs(canvas.width-overlay.width),dy:Math.abs(canvas.height-overlay.height)};
 });
 expect(aligned.dx,'la caja de las asas coincide con el vídeo a lo ancho').toBeLessThanOrEqual(1);
 expect(aligned.dy,'la caja de las asas coincide con el vídeo a lo alto').toBeLessThanOrEqual(1);
 if(test.info().project.name==='chrome')await page.screenshot({path:path.resolve('evidencias','vista-previa-zoom.png')});
 // 4. La rueda hacia abajo aleja y el botón del porcentaje vuelve al encaje.
 await page.mouse.wheel(0,900);
 await expect(zoomChip).not.toHaveText('100 %');
 await zoomChip.click();
 await expect(zoomChip).toHaveText('100 %');
 await expect.poll(async()=>Math.round((await frame.boundingBox())!.width),{timeout:10000}).toBe(Math.round(before.width));
 // 5. Con un proyecto vertical la caja también queda sobre el vídeo (antes cubría todo el monitor).
 await page.getByRole('button',{name:'Propiedades del proyecto',exact:true}).first().click();
 await page.getByLabel('Plantilla de proyecto').click();
 await page.getByRole('option',{name:/TikTok/}).click();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.waitForTimeout(300);
 const vertical=await page.evaluate(()=>{
  const canvas=document.querySelector<HTMLElement>('.monitor-frame canvas')!.getBoundingClientRect();
  const overlay=document.querySelector<HTMLElement>('.preview-overlay')!.getBoundingClientRect();
  return {dx:Math.abs(canvas.width-overlay.width),dy:Math.abs(canvas.height-overlay.height)};
 });
 expect(vertical.dx,'vertical: la caja coincide con el vídeo a lo ancho').toBeLessThanOrEqual(1);
 expect(vertical.dy,'vertical: la caja coincide con el vídeo a lo alto').toBeLessThanOrEqual(1);
});
