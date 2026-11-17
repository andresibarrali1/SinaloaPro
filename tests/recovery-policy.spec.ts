import {test,expect} from '@playwright/test';
import {newProject,newEvent,ticks} from '../lib/editor/project';
for(const dirty of [true,false]) test(`startup recovery dirty=${dirty}`,async({page})=>{
 const p=newProject();p.events.push(newEvent(p.tracks[0].id,'color',0,ticks(5)));
 await page.addInitScript(({project,dirty})=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('corte15-autosave-v1',JSON.stringify(project));localStorage.setItem('corte15-pendiente-v1',dirty?'1':'0');sessionStorage.setItem('seeded','1');}},{project:p,dirty});
 await page.goto('/?bienvenida=no');
 await expect(page.locator('.vegas-toolbar')).toBeVisible();
 await expect(page.locator('.timeline-event')).toHaveCount(dirty?1:0);
 await page.reload();await expect(page.locator('.vegas-toolbar')).toBeVisible();
 await expect(page.locator('.timeline-event')).toHaveCount(dirty?1:0);
});
