import {test,expect} from '@playwright/test';import {newProject,newEvent,ticks} from '../lib/editor/project';
test('range guides span tracks and snap to clips',async({page})=>{
 const p=newProject();p.events=[newEvent(p.tracks[0].id,'color',0,ticks(4))];p.region={start:ticks(1),end:ticks(3)};
 await page.goto('/?bienvenida=no');await page.locator('input[type=file][accept*=".SNLPRO"]').setInputFiles({name:'Range.SNLPRO',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
 await expect(page.locator('.timeline-render-line')).toHaveCount(2);
 const guide=page.locator('.timeline-render-line.end');expect((await guide.boundingBox())!.height).toBeGreaterThan(200);await expect(guide).toHaveCSS('pointer-events','none');
 const handle=(await page.locator('.region-handle.end').boundingBox())!;
 await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2+62,handle.y+handle.height/2,{steps:5});await page.mouse.up();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('corte15-autosave-v1')||'{}').region?.end)).toBe(ticks(4));
 await page.keyboard.press('Control+z');await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('corte15-autosave-v1')||'{}').region?.end)).toBe(ticks(3));
});
