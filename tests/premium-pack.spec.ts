import {test,expect} from '@playwright/test';
import {newProject,newEvent} from '../lib/editor/project';
import {defaultEffect} from '../lib/editor/effects';

// Los packs premium, vistos en la interfaz real: una plantilla de subtítulo que activa mayúsculas y caja de
// palabra, la familia Premium de transiciones y un look de efectos que añade su pila completa.
test('packs premium: plantillas, transiciones y looks desde la interfaz',async({page})=>{
 await page.setViewportSize({width:1440,height:980});
 const p=newProject();p.width=1080;p.height=1920;
 const text=newEvent(p.tracks[0].id,'text');text.text='Tu próximo gran vídeo';p.events.push(text);
 const clip=newEvent(p.tracks[1].id,'color');clip.name='Recurso de prueba';clip.effects=[{...defaultEffect('blur','base-fx'),enabled:false}];p.events.push(clip);
 await page.goto('/?bienvenida=no');
 await page.locator('input[type=file][accept*=".sinaloapro"]').setInputFiles({name:'Premium.sinaloapro',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});

 // 1) Plantilla premium de subtítulo.
 await page.locator(`[data-event-id="${text.id}"]`).click();
 await page.getByRole('button',{name:'Herramientas',exact:true}).click();
 await page.getByText('Títulos y texto→',{exact:true}).click();
 await page.getByRole('tab',{name:'Plantillas',exact:true}).click();
 await page.getByLabel('Buscar plantillas').fill('Caja que crece');
 await expect(page.getByRole('button',{name:'Plantilla Caja que crece (verde)'})).toBeVisible();
 await page.getByRole('button',{name:'Plantilla Caja que crece (verde)'}).click();
 await expect(page.getByRole('button',{name:'Plantilla Caja que crece (verde)'})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('tab',{name:'Estilo',exact:true}).click();
 await expect(page.getByText('Acabados premium')).toBeVisible();
 await expect(page.getByLabel('Mayúsculas')).toContainText('Sí');
 await expect(page.getByLabel('Caja en la palabra activa')).toContainText('Sí');
 await page.locator('.titles-panel').evaluate(node => { node.scrollTop = node.scrollHeight; });
 await page.waitForTimeout(200);
 await page.screenshot({path:'evidencias/premium-titulos.png'});
 await page.getByRole('button',{name:'Listo',exact:true}).click();
 // Cerrar títulos vuelve a las propiedades del recurso: se cierra también para seguir con la línea de tiempo.
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toHaveCount(0);

 // 2) Familia Premium de transiciones.
 await page.locator(`[data-event-id="${clip.id}"]`).click();
 if(await page.getByRole('dialog').count())await page.keyboard.press('Escape');
 await page.getByRole('tab',{name:'Transiciones',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Premium',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Glitch digital'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Fuga de luz'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Giro 3D'})).toBeVisible();
 await page.getByRole('heading',{name:'Premium',exact:true}).scrollIntoViewIfNeeded();
 await page.waitForTimeout(250);
 await page.screenshot({path:'evidencias/premium-transiciones.png'});

 // 3) Look de efectos: añade la pila completa.
 await page.locator(`[data-event-id="${clip.id}"]`).click();
 if(await page.getByRole('dialog').count())await page.keyboard.press('Escape');
 const effectsButton=page.locator(`[data-event-id="${clip.id}"]`).getByRole('button',{name:/Editar efectos de/});
 await effectsButton.click();
 await expect(page.locator('.effects-window')).toBeVisible();
 await page.getByRole('button',{name:'＋ Añadir efecto'}).click();
 await expect(page.getByText('Looks de un clic')).toBeVisible();
 await expect(page.getByRole('button',{name:/Cine 2026/})).toBeVisible();
 await page.screenshot({path:'evidencias/premium-looks.png'});
 await page.getByRole('button',{name:/Cine 2026/}).click();
 await expect(page.locator('.fx-stack button')).toHaveCount(5);
 await expect(page.locator('.fx-stack button').filter({hasText:'Teal & naranja'})).toBeVisible();
 await page.screenshot({path:'evidencias/premium-efectos.png'});
 await page.getByRole('button',{name:'Listo',exact:true}).click();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toHaveCount(0);

 // 4) Estilo premium al generar subtítulos.
 await page.getByRole('button',{name:'Generar subtítulos'}).click();
 await expect(page.getByLabel('Estilo de subtítulo')).toBeVisible();
 await page.getByLabel('Estilo de subtítulo').click();
 await page.getByRole('option',{name:'Caja que crece (verde)'}).click();
 await expect(page.getByRole('listbox')).toHaveCount(0);
 await expect(page.getByLabel('Estilo de subtítulo')).toContainText('Caja que crece (verde)');
 await page.screenshot({path:'evidencias/premium-subtitulos.png'});
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();
});
