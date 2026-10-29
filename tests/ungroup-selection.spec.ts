import {test,expect} from '@playwright/test';
import {newProject,newEvent,ticks} from '../lib/editor/project';
for(const index of [0,1])test(`U conserva solamente el clip pulsado ${index}`,async({page})=>{
 const p=newProject(),track=p.tracks.find(t=>t.kind==='video')!;
 const a=newEvent(track.id,'color'),b=newEvent(track.id,'color',ticks(6));a.group=b.group='vinculados';p.events.push(a,b);
 await page.goto('/?bienvenida=no');
 await page.locator('input[type=file][accept*=".sinaloapro"]').setInputFiles({name:'Grupo.sinaloapro',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
 await expect(page.locator('.timeline-event')).toHaveCount(2);
 const chosen=page.locator(`[data-event-id="${p.events[index].id}"]`);
 await chosen.click({position:{x:30,y:35}});
 await expect(page.locator('.timeline-event.selected')).toHaveCount(2);
 await page.keyboard.press('u');
 await expect(page.locator('.timeline-event.selected')).toHaveCount(1);
 await expect(chosen).toHaveClass(/selected/);
 await page.keyboard.press('Delete');
 await expect(chosen).toHaveCount(0);
 await expect(page.locator('.timeline-event')).toHaveCount(1);
});
