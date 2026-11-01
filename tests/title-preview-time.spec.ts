import {test,expect} from '@playwright/test';
import {newProject,newEvent,ticks} from '../lib/editor/project';
for(const key of ['Control+Home','Control+End'])test(`texto visible fuera de su intervalo: ${key}`,async({page})=>{
 await page.setViewportSize({width:1440,height:1000});const p=newProject();const e=newEvent(p.tracks[0].id,'text',ticks(8),ticks(2));e.text='TEXTO SELECCIONADO';e.fadeIn=ticks(.3);p.events.push(e);
 await page.goto('/?bienvenida=no');await page.locator('input[type=file][accept*=".sinaloapro"]').setInputFiles({name:'Texto.sinaloapro',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
 await page.locator(`[data-event-id="${e.id}"]`).click();await page.keyboard.press(key);
 const timeBefore=await page.locator('.preview-transport span').last().textContent();
 await page.getByRole('button',{name:'Herramientas',exact:true}).click();await page.getByText('Títulos y texto→',{exact:true}).click();
 const preview=page.getByLabel('Vista previa del texto compuesto');
 await expect.poll(()=>preview.evaluate((c:HTMLCanvasElement)=>{const pixels=c.getContext('2d')!.getImageData(0,0,c.width,c.height).data;let bright=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>100)bright++;return bright;})).toBeGreaterThan(100);
 await page.getByRole('textbox',{name:'Contenido del texto'}).fill('OTRO TEXTO');
 await expect(page.locator('.preview-transport span').last()).toHaveText(timeBefore!);
 await expect(page.getByRole('textbox',{name:'Contenido del texto'})).toHaveValue('OTRO TEXTO');
});
