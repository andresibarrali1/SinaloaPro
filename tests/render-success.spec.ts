import {test,expect} from '@playwright/test';
import path from 'node:path';
const fixture=(name:string)=>path.resolve('tests/fixtures',name);

// La confirmación del renderizado solo se puede comprobar de verdad renderizando: se recorta el clip a
// un segundo, se exporta a 320×180 y se mira el aviso que aparece al terminar.
test('al terminar el render aparece la confirmación con la ruta de la carpeta',async({page})=>{
 await page.goto('/?bienvenida=no');
 await page.evaluate(()=>localStorage.clear());
 await page.reload();
 const missing=await page.evaluate(()=>['VideoDecoder','AudioDecoder','AudioContext'].filter(name=>typeof (globalThis as Record<string,unknown>)[name]==='undefined'));
 test.skip(missing.length>0,`El motor no expone: ${missing.join(', ')}.`);
 await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Video_A.mp4')]);
 await expect(page.locator('.media-item')).toHaveCount(1,{timeout:60000});
 await page.locator('.media-item').filter({hasText:'Video_A.mp4'}).dblclick();
 const clip=page.locator('.timeline-event.video').first();
 await clip.dblclick();
 await page.getByRole('tab',{name:'Tiempo y efectos'}).click();
 await page.getByLabel('Duración (s)',{exact:true}).fill('1');
 await page.getByRole('button',{name:'Listo',exact:true}).click();
 await page.getByRole('button',{name:'Renderizar como…',exact:true}).click();
 await page.getByLabel('Ancho',{exact:true}).fill('320');
 await page.getByLabel('Alto',{exact:true}).fill('180');
 const downloaded=page.waitForEvent('download',{timeout:150000});
 await page.getByRole('button',{name:'Renderizar y descargar'}).click();
 const file=await downloaded;
 expect(file.suggestedFilename()).toMatch(/\.(mp4|webm|wav)$/);
 const panel=page.getByTestId('render-completado');
 await expect(panel).toBeVisible({timeout:60000});
 await expect(panel.getByRole('heading')).toHaveText('Vídeo renderizado');
 await expect(panel).toContainText(file.suggestedFilename());
 await expect(panel.locator('.render-success-path')).toContainText('Downloads');
 await expect(panel.locator('.render-success-details li').first()).toContainText('de vídeo');
 await page.screenshot({path:'evidencias/confirmacion-render.png'});
 const sonido=panel.getByLabel('Sonido de confirmación');
 await expect(sonido).toBeChecked();
 await sonido.uncheck();
 await expect(sonido).not.toBeChecked();
 await page.keyboard.press('Escape');
 await expect(panel).toBeHidden();
});
