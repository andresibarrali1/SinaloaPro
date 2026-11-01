import {test,expect} from '@playwright/test';

// El puntero cambia de forma al pasar por encima de la aguja: es el cursor de VEGAS, un escudo claro
// con dos marcas y la punta sobre la línea. Se comprueba el estilo calculado y que el PNG se sirva.
test('sobre la aguja el puntero usa el cursor de la aguja',async({page})=>{
 const imagen=page.waitForResponse(respuesta=>respuesta.url().includes('cursor-aguja.png'));
 await page.goto('/?bienvenida=no');
 await page.evaluate(()=>localStorage.clear());
 await page.reload();
 await page.waitForTimeout(400);
 const ruler=page.locator('.ruler').first();
 await ruler.click({position:{x:130,y:40}});
 await page.waitForTimeout(150);
 const cabeza=page.locator('.playhead i');
 await cabeza.hover();
 const estilo=await cabeza.evaluate(el=>getComputedStyle(el).cursor);
 expect(estilo).toContain('cursor-aguja.png');
 expect(estilo).toContain('12 31');
 const respuesta=await imagen;
 expect(respuesta.status()).toBe(200);
});
