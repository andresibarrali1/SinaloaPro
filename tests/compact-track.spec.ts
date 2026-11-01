import {test,expect} from '@playwright/test';
import {newProject,newEvent} from '../lib/editor/project';
test('altura mínima, restauración y ampliación de pista',async({page})=>{
 await page.setViewportSize({width:1600,height:1000});
 const p=newProject(),t=p.tracks.find(t=>t.kind==='video')!;t.height=100;p.events.push(newEvent(t.id,'color'));
 await page.goto('/?bienvenida=no');await page.locator('input[type=file][accept*=".sinaloapro"]').setInputFiles({name:'Compacta.sinaloapro',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
 const header=page.locator(`.track-header[data-track="${t.id}"]`),lane=page.locator(`.track-lane[data-track="${t.id}"]`);
 const edge=(await header.locator('.track-resize').boundingBox())!;
 await page.mouse.move(edge.x+40,edge.y+2);await page.mouse.down();await page.mouse.move(edge.x+40,edge.y-100,{steps:8});await page.mouse.up();
 await expect(header).toHaveAttribute('data-compact','true');expect((await header.boundingBox())!.height).toBe(28);expect((await lane.boundingBox())!.height).toBe(28);
 await expect(lane.locator('.event-body')).toBeHidden();await expect(lane.locator('.event-title')).toBeVisible();
 await page.waitForTimeout(600);await page.reload();await expect(header).toHaveAttribute('data-compact','true');
 const lower=(await header.locator('.track-resize').boundingBox())!;
 await page.mouse.move(lower.x+40,lower.y+2);await page.mouse.down();await page.mouse.move(lower.x+40,lower.y+82,{steps:8});await page.mouse.up();
 await expect(header).toHaveAttribute('data-compact','false');await expect(lane.locator('.event-body')).toBeVisible();
});

