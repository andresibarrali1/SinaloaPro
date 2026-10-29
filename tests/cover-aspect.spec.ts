import {test,expect} from '@playwright/test';
import {newProject,newEvent,ticks} from '../lib/editor/project';
test('cubrir desmarca aspecto y se copia al pegar atributos',async({page})=>{
 const p=newProject();p.media.push({id:'m',name:'foto',kind:'image',size:0,modified:0,duration:ticks(5),width:100,height:200,hasAudio:false,mime:'image/png'});
 const a=newEvent(p.tracks.find(t=>t.kind==='video')!.id,'image'),b=newEvent(a.trackId,'image',ticks(6));a.mediaId=b.mediaId='m';p.events.push(a,b);
 await page.goto('/?bienvenida=no');await page.locator('input[type=file][accept*=".sinaloapro"]').setInputFiles({name:'Aspecto.sinaloapro',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
 await expect(page.locator('.timeline-event')).toHaveCount(2);
 const first=page.locator(`[data-event-id="${a.id}"]`);await first.click({position:{x:30,y:35}});
 await page.getByRole('button',{name:'Herramientas',exact:true}).click();
 await page.getByRole('menuitem',{name:'Encajar el contenido al fotograma (cubrir)',exact:true}).click();
 await first.dblclick({position:{x:30,y:35}});
 await expect(page.getByRole('checkbox',{name:'Mantener relación de aspecto',exact:true})).not.toBeChecked();
 await page.getByRole('button',{name:'Aceptar',exact:true}).click();
 await page.keyboard.press('Shift+c');
 await page.locator(`[data-event-id="${b.id}"]`).click({position:{x:30,y:35}});await page.keyboard.press('Shift+v');
 await page.locator(`[data-event-id="${b.id}"]`).dblclick({position:{x:30,y:35}});
 await expect(page.getByRole('checkbox',{name:'Mantener relación de aspecto',exact:true})).not.toBeChecked();
});
