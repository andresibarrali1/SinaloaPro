import {test,expect} from '@playwright/test';
import path from 'node:path';
const fixture=(name:string)=>path.resolve('tests/fixtures',name);

// El estudio de renderizado: lo que se ve antes de exportar. Comprueba la cabecera, el diagnóstico, los
// tamaños, el peso por calidad, las plantillas propias (que sobreviven a cerrar la ventana) y la cola.
test('el estudio enseña la salida, avisa de lo que falla y guarda plantillas propias',async({page})=>{
 await page.goto('/?bienvenida=no');
 await page.evaluate(()=>localStorage.clear());
 await page.reload();
 await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Video_A.mp4')]);
 await expect(page.locator('.media-item')).toHaveCount(1,{timeout:60000});
 await page.locator('.media-item').first().dblclick();
 await page.getByRole('button',{name:'Renderizar como…',exact:true}).click();

 await expect(page.getByRole('heading',{name:'Estudio de renderizado'})).toBeVisible();
 await expect(page.locator('.render-pill')).toContainText('Listo para exportar');
 await expect(page.locator('.render-check.ok').first()).toContainText('Todo en orden');
 await expect(page.locator('.render-stat').filter({hasText:'Tiempo estimado'})).toContainText('Aún sin medir');

 // Tamaño vertical: insignia, relación y riel cambian juntos.
 await page.getByRole('button',{name:'Tamaño Vertical',exact:true}).click();
 await expect(page.getByRole('button',{name:'Tamaño Vertical',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('button',{name:'Tamaño Proyecto',exact:true})).toHaveAttribute('aria-pressed','false');
 await expect(page.locator('.render-frame-meta')).toContainText('9:16');

 // Un nombre con barra no se puede guardar tal cual: se avisa y se enseña el nombre saneado.
 await page.getByLabel('Nombre del archivo de salida').fill('mi/video final');
 await expect(page.locator('.render-pill')).toContainText('aviso');
 await expect(page.locator('.render-file-preview')).toContainText('mi_video final.mp4');
 await page.getByLabel('Nombre del archivo de salida').fill('');

 // La calidad se puede elegir en la rejilla y en la comparación del riel.
 await page.locator('.render-quality-grid button').filter({hasText:'Borrador'}).click();
 await expect(page.locator('.render-quality-list button').filter({hasText:'Borrador'})).toHaveAttribute('aria-pressed','true');
 const draft=await page.locator('.render-stat').filter({hasText:'Peso estimado'}).innerText();
 await page.locator('.render-quality-list button').filter({hasText:'Máxima'}).click();
 const master=await page.locator('.render-stat').filter({hasText:'Peso estimado'}).innerText();
 expect(draft).not.toBe(master);

 // Plantilla propia: guardar, cerrar, reabrir y comprobar que sigue ahí.
 await page.getByLabel('Nombre de la plantilla propia').fill('Social 9:16');
 await page.getByRole('button',{name:'Guardar',exact:true}).click();
 await expect(page.locator('.render-saved-chip').filter({hasText:'Social 9:16'})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'Renderizar como…',exact:true}).click();
 await expect(page.locator('.render-saved-chip').filter({hasText:'Social 9:16'})).toBeVisible();
 await page.locator('.render-saved-apply').filter({hasText:'Social 9:16'}).click();
 await expect(page.getByLabel('Ancho',{exact:true})).toHaveValue('1080');
 await expect(page.getByLabel('Alto',{exact:true})).toHaveValue('1920');

 // Cola: el trabajo creado y las plantillas del motor, cada uno con su nombre de archivo y su estado.
 await page.getByLabel('Ancho',{exact:true}).fill('320');
 await page.getByLabel('Alto',{exact:true}).fill('180');
 await page.getByRole('button',{name:'Añadir a la cola'}).click();
 await expect(page.locator('.batch-job')).toHaveCount(1);
 await expect(page.locator('.batch-job').first().locator('.batch-label')).toContainText(/MP4 320x180 30 fps/);
 await page.getByRole('button',{name:'Añadir las plantillas disponibles'}).click();
 await expect.poll(async()=>page.locator('.batch-job').count()).toBeGreaterThan(1);
 await expect(page.locator('.batch-job').first().locator('.batch-state')).toHaveText('En espera');
 await page.locator('.batch-block').scrollIntoViewIfNeeded();
 await page.waitForTimeout(250);
 await page.screenshot({path:'evidencias/render-estudio.png'});

 // El diagnóstico detallado se despliega sin salir de la ventana.
 await page.locator('.render-check-details summary').click();
 await expect(page.locator('.render-check.ok').filter({hasText:'Códec MP4 disponible'})).toBeVisible();
});

// Renderizar de verdad desde el estudio, con la barra de progreso y el aviso final. Se salta si el motor
// no expone codificadores, igual que la prueba de la confirmación.
test('el estudio renderiza, muestra el progreso y recuerda la velocidad para estimar',async({page})=>{
 await page.goto('/?bienvenida=no');
 await page.evaluate(()=>localStorage.clear());
 await page.reload();
 const missing=await page.evaluate(()=>['VideoEncoder','AudioEncoder','AudioContext'].filter(name=>typeof (globalThis as Record<string,unknown>)[name]==='undefined'));
 test.skip(missing.length>0,`El motor no expone: ${missing.join(', ')}.`);
 await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Video_A.mp4')]);
 await expect(page.locator('.media-item')).toHaveCount(1,{timeout:60000});
 await page.locator('.media-item').first().dblclick();
 await page.getByRole('button',{name:'Renderizar como…',exact:true}).click();
 await page.getByLabel('Ancho',{exact:true}).fill('320');
 await page.getByLabel('Alto',{exact:true}).fill('180');
 const download=page.waitForEvent('download',{timeout:150000});
 await page.getByRole('button',{name:'Renderizar y descargar'}).click();
 await expect(page.locator('.render-progress')).toBeVisible({timeout:10000});
 await expect(page.locator('.render-progress')).toContainText('fotogramas');
 await expect(page.getByRole('button',{name:'Cancelar renderización'})).toBeVisible();
 const file=await download;
 expect(file.suggestedFilename()).toMatch(/\.(mp4|webm)$/);
 await expect(page.getByTestId('render-completado')).toBeVisible({timeout:60000});
 await page.keyboard.press('Escape');
 await expect(page.getByTestId('render-completado')).toBeHidden();
 await page.getByRole('button',{name:'Renderizar como…',exact:true}).click();
 await expect(page.locator('.render-stat').filter({hasText:'Tiempo estimado'})).not.toContainText('Aún sin medir');
 await page.screenshot({path:'evidencias/render-estudio-medido.png'});
});
