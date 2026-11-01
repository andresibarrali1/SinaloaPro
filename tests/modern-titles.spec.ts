import {test,expect} from '@playwright/test';
import {newProject,newEvent} from '../lib/editor/project';
test('inspector de títulos: edición, pestañas y búsqueda',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 const p=newProject();p.width=1080;p.height=1920;const t=p.tracks.find(t=>t.kind==='video')!;const e=newEvent(t.id,'text');e.text='Tu próximo gran vídeo';p.events.push(e);
 await page.goto('/?bienvenida=no');await page.locator('input[type=file][accept*=".sinaloapro"]').setInputFiles({name:'Texto.sinaloapro',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
 await page.locator(`[data-event-id="${e.id}"]`).click();await page.getByRole('button',{name:'Herramientas',exact:true}).click();await page.getByText('Títulos y texto→',{exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Contenido del texto'})).toBeVisible();await page.getByRole('textbox',{name:'Contenido del texto'}).fill('Nuevo título');
 await page.getByRole('tab',{name:'Estilo',exact:true}).click();await expect(page.getByText('Personaliza el acabado')).toBeVisible();
 await page.getByRole('tab',{name:'Animación',exact:true}).click();await expect(page.locator('.titles-animation-grid button').first()).toBeVisible();await page.locator('.titles-animation-grid button').nth(1).click();await expect(page.locator('.titles-animation-grid button').nth(1)).toHaveAttribute('aria-pressed','true');
 await page.getByRole('tab',{name:'Plantillas',exact:true}).click();await page.getByRole('searchbox',{name:'Buscar plantillas'}).fill('ningun-estilo-123');await expect(page.getByText('No hay plantillas con ese nombre.')).toBeVisible();
 await page.getByRole('tab',{name:'Texto',exact:true}).click();await expect(page.getByRole('textbox',{name:'Contenido del texto'})).toHaveValue('Nuevo título');
 const pane=page.locator('.titles-fields');expect(await pane.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.screenshot({path:'evidencias/titulos-modernos.png'});
 await page.getByRole('button',{name:'Listo',exact:true}).click();await expect(page.locator('.titles-modern')).toHaveCount(0);
});
