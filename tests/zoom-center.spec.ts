import {test,expect} from '@playwright/test';
test('wheel zoom centers the playhead, not the mouse',async({page})=>{
 await page.goto('/?bienvenida=no');
 const ruler=page.locator('.ruler');await ruler.click({position:{x:900,y:30}});
 const time=await page.locator('.big-timecode').innerText();
 const timeline=page.locator('.timeline-scroll');const box=(await timeline.boundingBox())!;
 await page.mouse.move(box.x+80,box.y+80);
 for(const delta of [-180,-180,180]){
  await page.mouse.wheel(0,delta);
  await expect.poll(async()=>page.evaluate(()=>{const t=document.querySelector('.timeline-scroll')!,h=document.querySelector('.playhead')!;const b=t.getBoundingClientRect();return Math.abs(h.getBoundingClientRect().left-b.left-t.clientWidth/2);})).toBeLessThan(2);
  await expect(page.locator('.big-timecode')).toHaveText(time);
 }
 await page.mouse.wheel(0,10000);
 await expect.poll(()=>timeline.evaluate(e=>e.scrollLeft)).toBe(0);
 await expect(page.locator('.big-timecode')).toHaveText(time);
});
