import {test,expect} from '@playwright/test';import {newProject,newEvent,ticks} from '../lib/editor/project';
test('animation library previews, applies and undoes',async({page})=>{
 const p=newProject();const e=newEvent(p.tracks[0].id,'color',0,ticks(4));p.events.push(e);
 await page.goto('/?bienvenida=no');await page.locator('input[type=file][accept*=".sinaloapro"]').setInputFiles({name:'Animaciones.sinaloapro',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
 await page.locator(`[data-event-id="${e.id}"]`).click();await page.getByRole('tab',{name:'Animaciones',exact:true}).click();
 await expect(page.locator('.animation-grid button')).toHaveCount(12);
 const card=page.getByRole('button',{name:'Animación: Ascenso elegante',exact:true});
 await expect.poll(()=>card.locator('canvas').evaluate((c:HTMLCanvasElement)=>Array.from(c.getContext('2d')!.getImageData(80,45,1,1).data).some(v=>v>0))).toBe(true);
 await card.click();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('corte15-autosave-v1')||'{}').events?.[0]?.keys?.length)).toBe(2);
 await page.keyboard.press('Control+z');await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('corte15-autosave-v1')||'{}').events?.[0]?.keys?.length)).toBe(0);
 await page.getByRole('button',{name:'Cinemáticas',exact:true}).click();await expect(page.locator('.animation-grid button')).toHaveCount(3);
 await page.screenshot({path:'evidencias/biblioteca-animaciones.png'});
});

