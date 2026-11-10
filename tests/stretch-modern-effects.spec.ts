import {test,expect} from '@playwright/test';import {newProject,newEvent,ticks} from '../lib/editor/project';import {defaultEffect} from '../lib/editor/effects';
test('Ctrl-borde cambia velocidad sin duplicar y permite deshacer',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});const p=newProject(),e=newEvent(p.tracks[0].id,'video',0,ticks(4));e.mediaId='m';p.media.push({id:'m',name:'video.mp4',kind:'video',duration:ticks(10),size:0,modified:0,hasAudio:false,mime:'video/mp4',width:320,height:180});p.events.push(e);
 await page.goto('/?bienvenida=no');await page.locator('input[type=file][accept*=".sinaloapro"]').setInputFiles({name:'Prueba.sinaloapro',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
 const clip=page.locator(`[data-event-id="${e.id}"]`),edge=(await clip.locator('.trim-handle.right').boundingBox())!;
 await page.keyboard.down('Control');await page.mouse.move(edge.x+3,edge.y+35);await page.mouse.down();await page.mouse.move(edge.x+3-130,edge.y+35,{steps:8});await page.mouse.up();await page.keyboard.up('Control');await expect(clip.locator('.event-title')).toContainText('2.00×');await expect(clip.locator('.event-speed-overlay')).toContainText('Rápido');await expect(page.locator('.timeline-event')).toHaveCount(1);await page.keyboard.press('Control+z');await expect(clip.locator('.event-title')).not.toContainText('2.00×');
});
test('efectos modernos: comparación, duplicar, restablecer y buscar',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});const p=newProject(),e=newEvent(p.tracks[0].id,'color');e.name='Mi vídeo';e.color='#ff0000';e.effects=[defaultEffect('invert','fx')];p.events.push(e);
 await page.goto('/?bienvenida=no');await page.locator('input[type=file][accept*=".sinaloapro"]').setInputFiles({name:'Efectos.sinaloapro',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});await page.locator(`[data-event-id="${e.id}"]`).dblclick();
 const canvas=page.getByLabel('Vista previa de los efectos');const pixel=()=>canvas.evaluate((c:HTMLCanvasElement)=>Array.from(c.getContext('2d')!.getImageData(c.width/2,c.height/2,1,1).data));
 await expect.poll(async()=> (await pixel())[1]).toBe(255);await page.getByRole('button',{name:'Ver antes',exact:true}).click();await expect.poll(async()=> (await pixel())[0]).toBe(255);await expect.poll(async()=> (await pixel())[1]).toBe(0);
 await page.getByRole('button',{name:'Duplicar efecto',exact:true}).click();await expect(page.locator('.fx-stack button')).toHaveCount(2);await page.getByRole('button',{name:'Restablecer',exact:true}).click();await page.getByRole('button',{name:'＋ Añadir efecto',exact:true}).click();await page.getByRole('searchbox',{name:'Buscar efectos'}).fill('desenfoque');await expect(page.locator('.effects-catalog button')).toHaveCount(1);await page.locator('.effects-catalog button').click();await expect(page.locator('.fx-stack button')).toHaveCount(3);await page.getByRole('slider',{name:'Ajustar intensidad'}).focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('spinbutton',{name:'Radio (px)',exact:true})).toHaveValue('7');await page.screenshot({path:'evidencias/efectos-modernos.png'});
});


test('indicadores visibles de cámara rápida y lenta',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});const p=newProject();p.media.push({id:'m',name:'video.mp4',kind:'video',duration:ticks(20),size:0,modified:0,hasAudio:false,mime:'video/mp4',width:320,height:180});
 for(const [i,speed] of [2,.5].entries()){const e=newEvent(p.tracks[0].id,'video',ticks(i*5),ticks(4));e.mediaId='m';e.speed=speed;p.events.push(e);}
 await page.goto('/?bienvenida=no');await page.locator('input[type=file][accept*=".sinaloapro"]').setInputFiles({name:'Velocidades.sinaloapro',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
 await expect(page.locator('.event-speed-overlay.fast')).toContainText('2.00× · Rápido');await expect(page.locator('.event-speed-overlay.slow')).toContainText('0.50× · Lento');await expect(page.locator('.event-speed-overlay.slow')).toBeVisible();await page.screenshot({path:'evidencias/velocidad-visible.png'});
});
