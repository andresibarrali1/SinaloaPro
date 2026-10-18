// Captura reproducible del espacio de trabajo como evidencia visual. No sustituye a la comparación con la
// captura de referencia (que no estuvo disponible): documenta el estado real de la interfaz.
import {test,expect} from '@playwright/test';import fs from 'node:fs';import path from 'node:path';
const fixture=(s:string)=>path.resolve('tests/fixtures',s);
const out=path.resolve('evidencias');
test('captura el espacio de trabajo a dos tamaños de escritorio',async({page,browserName})=>{
 test.skip(browserName!=='chromium','Las capturas se toman una sola vez, en Chromium.');
 fs.mkdirSync(out,{recursive:true});
 await page.goto('/');await page.evaluate(()=>localStorage.clear());await page.reload();
 await expect(page.getByRole('button',{name:'Nuevo proyecto',exact:true})).toBeVisible();
 await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Video_A.mp4'),fixture('Video_B.mp4'),fixture('Audio.wav')]);
 await expect(page.locator('.media-item')).toHaveCount(3,{timeout:60000});
 await page.locator('.media-item').filter({hasText:'Video_A.mp4'}).dblclick();
 await page.locator('.ruler').click({position:{x:130,y:30}});
 await page.locator('.media-item').filter({hasText:'Video_B.mp4'}).dblclick();
 await page.getByRole('button',{name:'Ir al inicio',exact:true}).click();
 await page.locator('.media-item').filter({hasText:'Audio.wav'}).dblclick();
 await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();
 await page.getByRole('button',{name:'Títulos y texto',exact:true}).click();
 await page.getByLabel('Texto del título').fill('CORTE 15');
 await page.getByLabel('Entrada (s)',{exact:true}).fill('0.5');
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await page.getByRole('tab',{name:'Medios de proyecto',exact:true}).click();
 await page.getByRole('button',{name:'Ir al inicio',exact:true}).click();
 for(const [w,h] of [[1600,900],[1280,720]] as const){await page.setViewportSize({width:w,height:h});await page.waitForTimeout(500);await page.screenshot({path:path.join(out,`editor-${w}x${h}.png`)});}
 // Tramo de renderizado: se dibuja arrastrando sobre la regla.
 const ruler=page.locator('.ruler');const rect=(await ruler.boundingBox())!;
 await page.mouse.move(rect.x+130,rect.y+10);await page.mouse.down();await page.mouse.move(rect.x+390,rect.y+10,{steps:6});await page.mouse.up();
 await page.waitForTimeout(300);await page.screenshot({path:path.join(out,'tramo-render.png')});
 // Región de bucle: se dibuja con Ctrl y arrastrar sobre la regla, y convive con el tramo.
 await page.keyboard.down('Control');
 await page.mouse.move(rect.x+65,rect.y+10);await page.mouse.down();await page.mouse.move(rect.x+520,rect.y+10,{steps:6});await page.mouse.up();
 await page.keyboard.up('Control');
 await page.keyboard.press('Alt+l');
 await page.waitForTimeout(300);await page.screenshot({path:path.join(out,'bucle-region.png')});
 await page.getByRole('button',{name:'Renderizar como…',exact:true}).click();
 await page.waitForTimeout(700);
 await page.screenshot({path:path.join(out,'exportar.png')});
 // Lote de renderizado: un trabajo con los ajustes de arriba y las plantillas disponibles del motor.
 await page.getByLabel('Ancho',{exact:true}).fill('640');
 await page.getByLabel('Alto',{exact:true}).fill('360');
 await page.getByRole('button',{name:'Añadir a la cola'}).click();
 await page.getByRole('button',{name:'Añadir las plantillas disponibles'}).click();
 await page.locator('.batch-block').scrollIntoViewIfNeeded();
 await page.waitForTimeout(300);
 await page.screenshot({path:path.join(out,'lote-render.png')});
 await page.keyboard.press('Escape');
 await page.waitForTimeout(300);
 await page.locator('.timeline-event.video').filter({hasText:'CORTE 15'}).first().dblclick({position:{x:40,y:12}});
 await page.waitForTimeout(500);
 await page.screenshot({path:path.join(out,'propiedades-evento.png')});
 // Ventana flotante de Panoramización y recorte: ancha, movida y redimensionada, como una ventana de VEGAS.
 await page.getByRole('button',{name:/Abrir la ventana de Panoramización y recorte/}).click();
 const floating=page.locator('.pan-crop-window');
 await expect(floating).toBeVisible();
 // La ventana tal como se abre: barra de herramientas, árbol de parámetros de VEGAS y monitor con su círculo de giro.
 await page.waitForTimeout(400);
 await page.screenshot({path:path.join(out,'pancrop-vegas.png')});
 const corner=(await floating.locator('.pan-crop-resize.se').boundingBox())!;
 await page.mouse.move(corner.x+corner.width/2,corner.y+corner.height/2);
 await page.mouse.down();
 for(let step=1;step<=8;step++){await page.mouse.move(corner.x+corner.width/2-step*24,corner.y+corner.height/2-step*14);await page.waitForTimeout(20);}
 await page.mouse.up();
 const header=(await floating.locator('.pan-crop-titlebar').boundingBox())!;
 await page.mouse.move(header.x+header.width/2,header.y+header.height/2);
 await page.mouse.down();
 await page.mouse.move(header.x+header.width/2+70,header.y+header.height/2+40,{steps:8});
 await page.mouse.up();
 await page.waitForTimeout(300);
 await page.screenshot({path:path.join(out,'pancrop-ventana.png')});
 await page.keyboard.press('Escape');
 await page.waitForTimeout(300);
 // Plantillas de texto estilo CapCut: la galería se aplica al evento y el monitor la pinta.
 await expect(page.getByRole('dialog')).toHaveCount(0);
 // Se abre por el borde izquierdo del evento: el clic también coloca la aguja, y así el monitor de la
 // ventana enseña el primer fotograma en vez de mitad de un fundido cruzado.
 await page.locator('.timeline-event').filter({hasText:'CORTE 15'}).first().dblclick({position:{x:40,y:12}});
 await page.getByRole('button',{name:/Abrir el editor de títulos y texto/}).click();
 const titles=page.locator('.titles-window');
 await expect(titles).toBeVisible();
 await titles.getByRole('button',{name:'Plantilla TikTok clásico'}).click();
 await page.waitForTimeout(400);
 await page.screenshot({path:path.join(out,'titles-plantillas.png')});
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 // Vínculo de audio y video: al seleccionar el video, su audio agrupado se sombrea igual.
 await page.locator('input[type=file]').nth(1).setInputFiles(fixture('vegas-montaje.xml'));
 await expect(page.locator('.import-report')).toBeVisible();
 await page.waitForTimeout(300);
 await page.screenshot({path:path.join(out,'informe-importacion.png')});
 await page.getByRole('button',{name:'Entendido'}).click();
 await page.locator('.timeline-event.video').filter({hasText:'Video_A.mp4'}).first().click();
 await page.waitForTimeout(400);
 await page.screenshot({path:path.join(out,'grupo-sombreado.png')});
 // Pista seleccionada: la cabecera se sombrea y su carril queda marcado.
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('.track-header').first().click({position:{x:6,y:70}});
 await page.waitForTimeout(300);
 await page.screenshot({path:path.join(out,'pista-seleccionada.png')});
  // Botón de recorte en la barra del evento, como en VEGAS: a la izquierda de ƒx y solo en los de vídeo.
  const cropEvent=page.locator('.timeline-event.video').first();
  const cropButton=cropEvent.getByRole('button',{name:/Panoramización y recorte de/});
  await cropEvent.click();
  await cropButton.hover();
  await page.waitForTimeout(300);
  await page.screenshot({path:path.join(out,'panoramizacion-boton-evento.png')});
  await cropButton.click();
  await expect(page.locator('.pan-crop-window')).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({path:path.join(out,'panoramizacion-boton-ventana.png')});
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
 // El pie de la línea de tiempo lleva el rizo, la envolvente, el mezclador, el tramo, el bucle y el zoom: en
 // ventanas estrechas tiene que envolver en una segunda fila, no recortar los controles de la derecha.
 for(const [w,h] of [[1600,900],[1280,720]] as const){
  await page.setViewportSize({width:w,height:h});
  await page.waitForTimeout(300);
  const fit=await page.locator('.bottom-toolbar').evaluate(node=>{
   const box=node.getBoundingClientRect();
   const items=Array.from(node.children) as HTMLElement[];
   const outermost=items.reduce((n,item)=>Math.max(n,item.getBoundingClientRect().right),box.left);
   const lowest=items.reduce((n,item)=>Math.max(n,item.getBoundingClientRect().bottom),box.top);
   return {overflowX:node.scrollWidth-node.clientWidth,overflowY:node.scrollHeight-node.clientHeight,slack:Math.round(box.right-outermost),below:Math.round(box.bottom-lowest),rows:Math.round(box.height)};
  });
  expect(fit.overflowX,`el pie se recorta en ${w}×${h}`).toBeLessThanOrEqual(1);
  expect(fit.overflowY,`el pie se recorta en vertical en ${w}×${h}`).toBeLessThanOrEqual(1);
  expect(fit.slack,`hay controles fuera del pie en ${w}×${h}`).toBeGreaterThanOrEqual(0);
  expect(fit.below,`hay controles por debajo del pie en ${w}×${h}`).toBeGreaterThanOrEqual(0);
  if(w===1280)await page.screenshot({path:path.join(out,'pie-1280x720.png')});
 }
});
