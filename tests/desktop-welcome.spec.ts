import {test,expect} from '@playwright/test';
import {newProject} from '../lib/editor/project';
test('desktop welcomes a recovered project, but not on reload',async({page})=>{
 const project=newProject();
 await page.addInitScript(p=>{
  (window as any).__TAURI__={};
  localStorage.setItem('corte15-autosave-v1',JSON.stringify(p));
 },project);
 await page.goto('/');
 await expect(page.locator('.welcome-splash')).toBeVisible();
 await page.getByRole('button',{name:'Cerrar la bienvenida'}).click();
 await page.reload();
 await expect(page.locator('.vegas-toolbar')).toBeVisible();
 await expect(page.locator('.welcome-splash')).toHaveCount(0);
 await page.goto('/?fresh=1');
 await expect(page.locator('.welcome-splash')).toBeVisible();
 await page.goto('/?bienvenida=no');
 await expect(page.locator('.vegas-toolbar')).toBeVisible();
 await expect(page.locator('.welcome-splash')).toHaveCount(0);
});
