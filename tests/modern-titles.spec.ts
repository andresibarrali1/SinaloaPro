import {test,expect} from '@playwright/test';
import {newProject,newEvent,ticks} from '../lib/editor/project';
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

test('doble clic en un texto o subtítulo abre la ventana de efectos, no las propiedades',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 const p=newProject();p.width=1080;p.height=1920;const t=p.tracks.find(track=>track.kind==='video')!;
 const title=newEvent(t.id,'text');title.name='Texto';title.text='Escribe tu título';p.events.push(title);
 const subtitle=newEvent(t.id,'text',ticks(6),ticks(2));subtitle.name='Subtítulo 1';subtitle.text='Una línea de subtítulo';p.events.push(subtitle);
 await page.goto('/?bienvenida=no');await page.locator('input[type=file][accept*=".sinaloapro"]').setInputFiles({name:'Textos.sinaloapro',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
 for(const event of [title,subtitle]){
  await page.locator(`[data-event-id="${event.id}"]`).dblclick();
  await expect(page.locator('.effects-window')).toBeVisible();
  await expect(page.locator('.resource-inspector')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
 }
 await expect(page.getByRole('button',{name:'Abrir el editor de texto de Texto'})).toBeVisible();
 // El botón ƒx del texto también abre la ventana de efectos, no las propiedades.
 await page.getByRole('button',{name:'Editar efectos de Texto'}).click();
 await expect(page.locator('.effects-window')).toBeVisible();
 await expect(page.locator('.resource-inspector')).toHaveCount(0);
 await page.keyboard.press('Escape');
});
