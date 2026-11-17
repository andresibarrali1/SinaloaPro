import {test,expect} from '@playwright/test';import {newProject,newEvent,ticks} from '../lib/editor/project';
test('marker drags snap to clip end, undo, and respect magnet toggle',async({page})=>{
 const p=newProject();p.events=[newEvent(p.tracks[0].id,'color',0,ticks(4))];p.markers=[{id:'m',name:'Prueba',time:ticks(2)}];
 await page.goto('/?bienvenida=no');await page.locator('input[type=file][accept*=".SNLPRO"]').setInputFiles({name:'Test.SNLPRO',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
 const drag=async()=>{const b=(await page.locator('.marker').boundingBox())!;await page.mouse.move(b.x+5,b.y+6);await page.mouse.down();await page.mouse.move(b.x+132,b.y+6,{steps:6});await page.mouse.up();};
 const at=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('corte15-autosave-v1')||'{}').markers?.[0]?.time);
 await drag();await expect.poll(at).toBe(ticks(4));
 await page.keyboard.press('Control+z');await expect.poll(at).toBe(ticks(2));
 await page.keyboard.press('F8');await drag();await expect.poll(at).toBeGreaterThan(ticks(3.8));expect(await at()).toBeLessThan(ticks(4));
});
