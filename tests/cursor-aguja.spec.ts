import {test,expect} from '@playwright/test';

// El puntero toma la forma del cursor de la aguja en toda su altura: en la cabeza y a lo largo de la
// línea que baja por los carriles. La zona es la misma que ya usaba el arrastre (7 px por lado).
test('el cursor de la aguja cubre la cabeza y toda la línea',async({page})=>{
 const imagen=page.waitForResponse(respuesta=>respuesta.url().includes('cursor-aguja.png'));
 await page.goto('/?bienvenida=no');
 await page.evaluate(()=>localStorage.clear());
 await page.reload();
 await page.waitForTimeout(400);
 const ruler=page.locator('.ruler').first();
 await ruler.click({position:{x:130,y:40}});
 await page.waitForTimeout(150);
 const left=await page.locator('.playhead').evaluate(el=>parseFloat(el.style.left));

 await page.locator('.playhead i').hover();
 const enCabeza=await page.locator('.playhead i').evaluate(el=>getComputedStyle(el).cursor);
 expect(enCabeza).toContain('cursor-aguja.png');
 expect(enCabeza).toContain('12 31');

 const contenido=page.locator('.timeline-content').first();
 const caja=await contenido.boundingBox();
 const x=caja!.x+left;
 const y=caja!.y+140;
 await page.mouse.move(x,y);
 await page.waitForTimeout(150);
 expect(await contenido.evaluate(el=>el.className)).toContain('cerca-de-aguja');
 const bajoElPuntero=await page.evaluate(({x,y})=>{
  const el=document.elementFromPoint(x,y) as HTMLElement|null;
  return {cursor:el?getComputedStyle(el).cursor:'',clase:el?.className??''};
 },{x,y});
 expect(bajoElPuntero.cursor).toContain('cursor-aguja.png');

 await page.mouse.move(x+120,y);
 await page.waitForTimeout(150);
 expect(await contenido.evaluate(el=>el.className)).not.toContain('cerca-de-aguja');

 // Arrastrar desde la línea sigue moviendo la aguja, no el clip que hay debajo.
 await page.mouse.move(x,y);
 await page.mouse.down();
 await page.mouse.move(x+60,y);
 await page.mouse.up();
 await page.waitForTimeout(150);
 const nueva=await page.locator('.playhead').evaluate(el=>parseFloat(el.style.left));
 expect(nueva).toBeGreaterThan(left+40);

 expect((await imagen).status()).toBe(200);
});
