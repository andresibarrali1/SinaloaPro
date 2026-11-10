import {test,expect} from '@playwright/test';
import {newProject,newEvent} from '../lib/editor/project';
import {defaultEffect} from '../lib/editor/effects';
for(const hasEffects of [false,true])test(`apertura con efectos=${hasEffects}`,async({page})=>{
 const p=newProject(),e=newEvent(p.tracks[0].id,'color');e.name='Recurso de prueba';if(hasEffects)e.effects=[{...defaultEffect('blur','test-fx'),enabled:false}];p.events.push(e);
 await page.goto('/?bienvenida=no');await page.locator('input[type=file][accept*=".sinaloapro"]').setInputFiles({name:'Efectos.sinaloapro',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
 const clip=page.locator(`[data-event-id="${e.id}"]`);
 await clip.getByRole('button',{name:hasEffects?'Editar efectos de Recurso de prueba':'Propiedades de Recurso de prueba',exact:true}).click();
 await expect(page.locator(hasEffects?'.effects-window':'.resource-inspector')).toBeVisible();
 await page.keyboard.press('Escape');await clip.dblclick();
 await expect(page.locator(hasEffects?'.effects-window':'.resource-inspector')).toBeVisible();
});
