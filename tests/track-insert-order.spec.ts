import {test,expect} from '@playwright/test';
test('new video tracks go above and new audio tracks below',async({page})=>{
 await page.goto('/?bienvenida=no');await expect(page.locator('.track-header')).toHaveCount(3);
 const old=await page.locator('.track-header').evaluateAll(es=>es.map(e=>e.getAttribute('data-track')));
 await page.locator('.add-track button').filter({hasText:'Video'}).click();
 await expect(page.locator('.track-header')).toHaveCount(4);
 const video=await page.locator('.track-header').evaluateAll(es=>es.map(e=>e.getAttribute('data-track')));expect(video.slice(1)).toEqual(old);
 await page.locator('.add-track button').filter({hasText:'Audio'}).click();await expect(page.locator('.track-header')).toHaveCount(5);
 const audio=await page.locator('.track-header').evaluateAll(es=>es.map(e=>e.getAttribute('data-track')));expect(audio.slice(0,4)).toEqual(video);
 await expect(page.locator('.track-header').last()).toHaveClass(/audio/);
});
