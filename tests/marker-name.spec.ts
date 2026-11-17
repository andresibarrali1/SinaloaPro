import {test,expect} from '@playwright/test';
test('marker double click and context menu rename, cancel and undo',async({page})=>{
 await page.goto('/?bienvenida=no');await expect(page.locator('.ruler')).toBeVisible();await page.keyboard.press('m');const marker=page.locator('.marker');await expect(marker).toHaveCount(1);
 await marker.dblclick();await page.getByLabel('Nombre del marcador',{exact:true}).fill('Inicio de escena');await page.getByRole('button',{name:'Guardar nombre',exact:true}).click();await expect(marker).toHaveText('Inicio de escena');
 await marker.click({button:'right'});await page.getByText('Cambiar nombre del marcador',{exact:true}).click();await page.getByLabel('Nombre del marcador',{exact:true}).fill('Descartado');await page.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(marker).toHaveText('Inicio de escena');
 await page.keyboard.press('Control+z');await expect(marker).toHaveText('Marcador 1');
});
