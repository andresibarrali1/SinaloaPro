import {test,expect} from '@playwright/test';
// Test the desktop production bundle: dev CSS does not detect missing Tailwind sources.
for(const size of [{width:1920,height:1010},{width:1280,height:800}]){
 test(`desktop shared layout ${size.width}`,async({page})=>{
  await page.setViewportSize(size);
  await page.goto('/?bienvenida=no');
  const tabs=page.locator('.media-tabs');
  await expect(tabs).toHaveCSS('flex-direction','column');
  await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();
  const content=page.locator('.media-tabs [data-slot=tabs-content][data-state=active]');
  await expect(content).toBeVisible();
  const panel=await tabs.boundingBox(),body=await content.boundingBox(),bar=await page.locator('.panel-tabs').boundingBox();
  expect(body!.width).toBeGreaterThan(panel!.width*.9);
  expect(body!.height).toBeGreaterThan(120);
  expect(bar!.y).toBeGreaterThanOrEqual(body!.y+body!.height-2);
  const slider=page.locator('.compact-slider [data-slot=slider-track]').first();
  await expect(slider).toHaveCSS('position','relative');
  expect((await slider.boundingBox())!.width).toBeGreaterThan(25);
  await page.screenshot({path:`evidencias/tauri-layout-${size.width}.png`});
 });
}
