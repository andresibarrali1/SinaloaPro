import {test,expect} from '@playwright/test';import {newProject} from '../lib/editor/project';
test('SNLPRO opens and saves with the new extension without duplicating it',async({page})=>{
 const p=newProject();p.name='Proyecto.SNLPRO';await page.goto('/?bienvenida=no');
 await page.locator('input[type=file][accept*=".SNLPRO"]').setInputFiles({name:'Proyecto.SNLPRO',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
 await expect(page.locator('.titlebar')).toContainText('Proyecto.SNLPRO');
 const saved=page.waitForEvent('download');await page.keyboard.press('Control+s');expect((await saved).suggestedFilename()).toBe('Proyecto.SNLPRO');
});
