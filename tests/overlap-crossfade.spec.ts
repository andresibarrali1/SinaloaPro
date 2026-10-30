import {test,expect} from '@playwright/test';
import {newProject,newEvent,ticks} from '../lib/editor/project';
test('solapar por arrastre dibuja fundido y deshacer lo restaura',async({page})=>{
 const p=newProject(),lane=p.tracks.find(t=>t.kind==='video')!;
 const a=newEvent(lane.id,'color',0,ticks(4)),b=newEvent(lane.id,'color',ticks(4),ticks(4));p.events.push(a,b);
 await page.goto('/?bienvenida=no');await page.locator('input[type=file][accept*=".sinaloapro"]').setInputFiles({name:'Fundido.sinaloapro',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
 await expect(page.locator('.timeline-event')).toHaveCount(2);
 const clip=page.locator(`[data-event-id="${b.id}"]`),box=(await clip.boundingBox())!;
 await page.mouse.move(box.x+box.width/2,box.y+40);await page.mouse.down();await page.mouse.move(box.x+box.width/2-65,box.y+40,{steps:10});await page.mouse.up();
 await expect(clip.locator('.overlap-crossfade')).toBeVisible();
 await expect(clip.locator('.overlap-crossfade')).toContainText('1.00 s');
 await page.keyboard.press('Control+z');await expect(page.locator('.overlap-crossfade')).toHaveCount(0);
});
