import {test,expect} from '@playwright/test';import {newProject,newEvent,ticks} from '../lib/editor/project';
test('arrastrar el final más allá del medio y deshacer',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});const p=newProject(),e=newEvent(p.tracks[0].id,'video',0,ticks(4));e.mediaId='m';p.media.push({id:'m',name:'video.mp4',kind:'video',duration:ticks(4),size:0,modified:0,hasAudio:false,mime:'video/mp4',width:320,height:180});p.events.push(e);
 await page.goto('/?bienvenida=no');await page.locator('input[type=file][accept*=".sinaloapro"]').setInputFiles({name:'Alargar.sinaloapro',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
 const clip=page.locator(`[data-event-id="${e.id}"]`),edge=(await clip.locator('.trim-handle.right').boundingBox())!;
 await page.mouse.move(edge.x+3,edge.y+35);await page.mouse.down();await page.mouse.move(edge.x+133,edge.y+35,{steps:8});await page.mouse.up();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('corte15-autosave-v1')||'{}').events?.[0]?.duration)).toBe(ticks(6));
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('corte15-autosave-v1')!).events[0].loop)).toBe(true);
 await expect(clip.locator('.event-speed-overlay')).toHaveCount(0);await page.keyboard.press('Control+z');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('corte15-autosave-v1')||'{}').events?.[0]?.duration)).toBe(ticks(4));
});
