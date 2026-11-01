import {test,expect} from '@playwright/test';
import {newProject,newEvent} from '../lib/editor/project';
test('propiedades modernas: secciones, cambios y cancelar',async({page})=>{
 await page.setViewportSize({width:1366,height:900});const p=newProject(),e=newEvent(p.tracks[0].id,'text');e.name='Subtítulo 30';e.text='Tu siguiente historia';p.events.push(e);
 await page.goto('/?bienvenida=no');await page.locator('input[type=file][accept*=".sinaloapro"]').setInputFiles({name:'Propiedades.sinaloapro',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
 const clip=page.locator(`[data-event-id="${e.id}"]`);await clip.dblclick();await expect(page.getByRole('textbox',{name:'Nombre del recurso'})).toHaveValue(e.name);
 await page.getByRole('textbox',{name:'Nombre del recurso'}).fill('Nombre editado');
 await page.getByRole('tab',{name:'Tiempo y efectos',exact:true}).click();await expect(page.getByRole('spinbutton',{name:'Duración (s)',exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Encuadre',exact:true}).click();await expect(page.getByRole('spinbutton',{name:'Escala',exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Color y contenido',exact:true}).click();await expect(page.getByRole('textbox',{name:'Texto del título'})).toBeVisible();
 await page.getByRole('tab',{name:'General',exact:true}).click();await page.screenshot({path:'evidencias/propiedades-modernas.png'});
 await page.getByRole('button',{name:'Cancelar cambios',exact:true}).click();await clip.dblclick();await expect(page.getByRole('textbox',{name:'Nombre del recurso'})).toHaveValue(e.name);
 const panel=page.locator('.resource-inspector');expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.getByRole('button',{name:'Listo',exact:true}).click();await expect(panel).toHaveCount(0);
});
