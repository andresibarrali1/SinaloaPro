// Pruebas de navegador de las ventanas de Panoramización y recorte, Movimiento de pista y Títulos y texto.
//
// Se comprueba el recorrido real: crear un título, abrir cada ventana desde el diálogo del evento, arrastrar
// y escribir como lo haría una persona, y leer después el proyecto autoguardado para verificar que los
// valores han llegado al modelo (no solo a la pantalla). Las lecturas esperan al autoguardado en vez de
// dormir un tiempo fijo, así que la prueba falla por el valor, no por la prisa.
import {test,expect,type Page} from '@playwright/test';
import path from 'node:path';
const fixture=(name:string)=>path.resolve('tests/fixtures',name);

type Saved = Record<string, unknown> & { events?: Record<string, unknown>[]; tracks?: Record<string, unknown>[] };
const autosave = (page:Page) => page.evaluate(() => JSON.parse(localStorage.getItem('corte15-autosave-v1') ?? '{}')) as Promise<Saved>;
const titleOf = async (page:Page) => ((await autosave(page)).events ?? []).find(event => event.kind === 'text');
// Espera a que el título guardado cumpla una condición y lo devuelve.
async function waitForTitle(page:Page, check:(event:Record<string, unknown>)=>boolean, message:string){
  await expect.poll(async()=>{const event=await titleOf(page);return event?check(event):false;},{message,timeout:20000}).toBe(true);
  return (await titleOf(page))!;
}

test.beforeEach(async({page})=>{
  await page.goto('/?bienvenida=no');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('button',{name:'Nuevo proyecto',exact:true})).toBeVisible();
});

async function createTitle(page:Page,content='TITULO DE PRUEBA'){
  await page.locator('.bottom-toolbar .transport').getByRole('button',{name:'Ir al inicio',exact:true}).click();
  await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();
  await page.getByRole('button',{name:'Títulos y texto',exact:true}).click();
  await page.getByLabel('Texto del título').fill(content);
  await waitForTitle(page,event=>event.text===content,'el título llega al proyecto');
}

// Los flujos que importan medios reales necesitan los decodificadores y Web Audio. Si el motor no los expone,
// la prueba se omite diciendo qué API falta en lugar de fallar como si fuera un defecto del editor: es el mismo
// criterio que sigue `browser.spec.ts`. WebKit (el binario de Playwright) no trae ninguna de las dos cosas.
async function requireMediaApis(page:Page,names:string[]=['VideoDecoder','AudioDecoder','AudioContext']){
  const missing=await page.evaluate(list=>list.filter(name=>typeof (globalThis as Record<string,unknown>)[name]==='undefined'),names);
  test.skip(missing.length>0,`El motor no expone: ${missing.join(', ')}.`);
}

test('Panoramización y recorte: la ventana abre con asas, mueve el encuadre, recorta los cuatro lados y guarda claves',async({page})=>{
  await createTitle(page);
  await page.getByRole('button',{name:/Abrir la ventana de Panoramización y recorte/}).click();
  const window=page.locator('.pan-crop-window');
  await expect(window).toBeVisible();
  const stage=window.locator('.pan-crop-stage');
  await expect(stage).toBeVisible();
  // El diálogo puede ser más alto que la pantalla: hay que dejar el lienzo a la vista antes de arrastrar.
  await stage.scrollIntoViewIfNeeded();
  const box=(await stage.boundingBox())!;

  // Arrastrar el centro mueve el encuadre (el ratón trabaja en píxeles; el modelo, en fracciones). Los
  // movimientos van espaciados, como los de un ratón real: en ráfaga el motor puede agruparlos y perder el
  // gesto (en WebKit se ha visto fallar así al correr la suite completa, y pasar siempre en solitario).
  const dragStage=async(targetX:number,targetY:number,steps:number)=>{
    const from=(await stage.boundingBox())!;
    const startX=from.x+from.width/2,startY=from.y+from.height/2;
    await page.mouse.move(startX,startY);
    await page.mouse.down();
    for(let step=1;step<=steps;step++){
      await page.mouse.move(startX+(targetX-startX)*step/steps,startY+(targetY-startY)*step/steps);
      await page.waitForTimeout(25);
    }
    await page.mouse.up();
  };
  await dragStage(box.x+box.width/2+45,box.y+box.height/2+25,8);
  const moved=await waitForTitle(page,event=>Number((event.transform as {x:number}).x)>0.02,'el arrastre mueve el encuadre');
  const movedX=Number((moved.transform as {x:number}).x);
  expect(movedX).toBeGreaterThan(.02);
  expect(Number((moved.transform as {y:number}).y)).toBeGreaterThan(.01);

  // El recorte de cuatro lados, por sus campos: izquierda 20 % y abajo 15 %.
  await window.getByLabel('Recorte izq. (%)').fill('20');
  await window.getByLabel('Recorte abajo (%)').fill('15');
  const cropped=await waitForTitle(page,event=>(event.mask as {left:number})?.left===.2&&(event.mask as {bottom:number})?.bottom===.15,'el recorte llega al modelo');
  const mask=cropped.mask as {left:number;right:number;top:number;bottom:number};
  expect(Math.round(mask.left*100)).toBe(20);
  expect(Math.round(mask.bottom*100)).toBe(15);
  expect(mask.right).toBe(0);
  expect(mask.top).toBe(0);
  await expect(window.locator('.export-plan').filter({hasText:'Recorte actual'})).toContainText('izq 20%');

  // Fijar lo hecho como fotograma clave en el cursor.
  await window.getByRole('button',{name:'Añadir clave aquí'}).click();
  const keyed=await waitForTitle(page,event=>(event.keys as unknown[])?.length===1,'la clave se guarda');
  const keys=keyed.keys as {x:number;mask?:{left:number}}[];
  expect(keys[0].mask?.left).toBeCloseTo(.2,3);
  expect(keys[0].x).toBeCloseTo(movedX,3);
  await expect(window.locator('.export-plan').first()).toContainText('Envolvente con 1 clave');

  // Con la envolvente activa, mover otra vez escribe en la clave, no en el valor fijo. El diálogo puede
  // haberse desplazado al rellenar los campos, así que se vuelve a medir el lienzo.
  await stage.scrollIntoViewIfNeeded();
  const settled=(await stage.boundingBox())!;
  await dragStage(settled.x+settled.width/2-30,settled.y+settled.height/2,6);
  const animated=await waitForTitle(page,event=>Number((event.keys as {x:number}[])[0]?.x)<movedX-0.005,'la clave se actualiza');
  expect((animated.keys as unknown[]).length).toBe(1);
  expect(Number((animated.transform as {x:number}).x)).toBeCloseTo(movedX,3);
});

// La ventana se organiza como la de VEGAS: parámetros a la izquierda (en píxeles del proyecto), monitor a la
// derecha sobre el tablero de cuadros, tira de fotogramas clave y barra inferior con las claves y el cierre.
test('Panoramización y recorte: la ventana se organiza como la de VEGAS',async({page})=>{
  await createTitle(page);
  await page.getByRole('button',{name:/Abrir la ventana de Panoramización y recorte/}).click();
  const window=page.locator('.pan-crop-window');
  await expect(window).toBeVisible();
  // Parámetros a la izquierda, monitor a la derecha.
  const params=(await window.locator('.pan-crop-params').boundingBox())!;
  const view=(await window.locator('.pan-crop-view').boundingBox())!;
  expect(params.x+params.width,`parámetros ${JSON.stringify(params)} y monitor ${JSON.stringify(view)}`).toBeLessThanOrEqual(view.x+1);
  // Los valores son los de VEGAS y con su formato: el evento ocupa el fotograma del proyecto, su centro es el
  // del fotograma y los números llevan separador de millares y un decimal, como el «1,920.0» de su ventana.
  await expect(window.getByLabel('Anchura (px)')).toHaveValue('1,920.0');
  await expect(window.getByLabel('Altura (px)')).toHaveValue('1,080.0');
  await expect(window.getByLabel('Centro X (px)')).toHaveValue('960.0');
  await expect(window.getByLabel('Centro Y (px)')).toHaveValue('540.0');
  // Escribir sin separadores también vale, y el campo vuelve al formato de VEGAS al salir.
  await window.getByLabel('Anchura (px)').click();
  await expect(window.getByLabel('Anchura (px)')).toHaveValue('1,920.0');
  // Mover el centro en píxeles mueve el encuadre: 200 px de 1920 son un 10,4 % de desplazamiento.
  await window.getByLabel('Centro X (px)').fill('1160');
  const shifted=await waitForTitle(page,event=>Number((event.transform as {x:number}).x)>0.05,'el centro en píxeles mueve el encuadre');
  expect(Number((shifted.transform as {x:number}).x)).toBeCloseTo(200/1920,3);
  // La anchura en píxeles es la escala: pedir 3840 px (el doble) la pone en 2.
  await window.getByLabel('Anchura (px)').fill('3840');
  const zoomed=await waitForTitle(page,event=>Number((event.transform as {scale:number}).scale)>1.9,'la anchura en píxeles cambia la escala');
  expect(Number((zoomed.transform as {scale:number}).scale)).toBeCloseTo(2,3);
  // Los preestablecidos calculan el recorte: 1:1 sobre un fotograma 16:9 deja 21,875 % por lado.
  await window.getByLabel('Parámetro preestablecido',{exact:true}).click();
  await page.getByRole('option',{name:'Recortar a 1:1'}).click();
  await expect(window.getByLabel('Recorte izq. (%)')).toHaveValue('21.9');
  await expect(window.getByLabel('Recorte der. (%)')).toHaveValue('21.9');
  await expect(window.getByLabel('Recorte arriba (%)')).toHaveValue('0.0');
  await expect(window.getByLabel('Recorte abajo (%)')).toHaveValue('0.0');
  // La tira de claves marca las claves y mueve el cursor al hacer clic.
  await window.getByRole('button',{name:'Añadir clave aquí'}).click();
  await expect(window.locator('.key-mark')).toHaveCount(1);
  const track=window.locator('.pan-crop-keys-track');
  await track.click({position:{x:(await track.boundingBox())!.width*.6,y:11}});
  await expect(page.locator('.big-timecode')).not.toHaveText('00:00:00:00');
  // Y la barra inferior lleva las claves y el cierre, siempre a la vista.
  await expect(window.getByRole('button',{name:'Quitar clave'})).toBeVisible();
  await expect(window.getByRole('button',{name:'Cerrar',exact:true})).toBeVisible();
  await expect(window.locator('.pan-crop-status-time')).toContainText('de 5.00 s');
});

// La ventana es la de VEGAS Pro 15 por dentro: barra de herramientas lateral, grupos plegables con los nombres
// de VEGAS, candado, centro de giro, tira de claves con selector de parámetro y barra de navegación.
test('Panoramización y recorte: barra de herramientas, grupos plegables, candado y centro de giro',async({page})=>{
  await createTitle(page);
  await page.getByRole('button',{name:/Abrir la ventana de Panoramización y recorte/}).click();
  const window=page.locator('.pan-crop-window');
  await expect(window).toBeVisible();
  // La barra de herramientas trae las seis herramientas de la ventana de VEGAS.
  const tools=window.locator('.pan-crop-tools');
  await expect(tools).toBeVisible();
  for(const name of ['Mover el encuadre','Acercar y alejar','Girar el encuadre','Recortar','Dibujar la máscara','Girar en 3D'])await expect(tools.getByRole('button',{name})).toHaveCount(1);
  // Grupos plegables con los nombres de VEGAS; «Origen» empieza cerrado y se abre al pulsarlo.
  expect(await window.locator('.param-group-name').allInnerTexts()).toEqual(['Posición','Rotación','Recorte','Interpolación de fotogramas clave','Origen','Área de trabajo','Máscara libre (trazado)']);
  const group=(name:string)=>window.locator('.param-group').filter({has:page.locator('.param-group-name',{hasText:name})});
  await expect(window.locator('.param-list').filter({hasText:'Medio'})).toHaveCount(0);
  await group('Origen').locator('.param-group-title').click();
  await expect(window.locator('.param-list').filter({hasText:'Medio'})).toHaveCount(1);
  await expect(group('Origen').locator('.param-group-title')).toHaveAttribute('aria-expanded','true');
  await group('Origen').locator('.param-group-title').click();
  await expect(window.locator('.param-list').filter({hasText:'Medio'})).toHaveCount(0);
  // El candado bloquea los parámetros y los vuelve a dejar libres.
  const width=window.getByLabel('Anchura (px)');
  await expect(width).toBeEnabled();
  await window.getByRole('button',{name:'Bloquear los parámetros'}).click();
  await expect(width).toBeDisabled();
  await window.getByRole('button',{name:'Desbloquear los parámetros'}).click();
  await expect(width).toBeEnabled();
  // El centro de giro es el «Centro X/Y» de VEGAS: llega al modelo y el monitor dibuja su círculo.
  await window.getByLabel('Centro de giro X (px)').fill('240');
  await waitForTitle(page,event=>(event.transform as {pivot?:{x:number}}).pivot?.x===.125,'el centro de giro llega al modelo');
  await expect(window.locator('.pan-crop-stage')).toHaveAttribute('width',String(640+34*2));
  // La herramienta de girar: el arrastre horizontal cambia el ángulo, no la posición.
  await tools.getByRole('button',{name:'Girar el encuadre'}).click();
  const stage=window.locator('.pan-crop-stage');
  await stage.scrollIntoViewIfNeeded();
  const start=(await stage.boundingBox())!;
  await page.mouse.move(start.x+start.width/2,start.y+start.height/2);
  await page.mouse.down();
  for(let step=1;step<=6;step++){await page.mouse.move(start.x+start.width/2+step*10,start.y+start.height/2);await page.waitForTimeout(20);}
  await page.mouse.up();
  const turned=await waitForTitle(page,event=>Math.abs(Number((event.transform as {rotation:number}).rotation))>1,'el giro llega al modelo');
  expect(Math.abs(Number((turned.transform as {x:number}).x))).toBeLessThan(.01);
  // La herramienta de zoom cambia la escala.
  await tools.getByRole('button',{name:'Acercar y alejar'}).click();
  const before=Number((turned.transform as {scale:number}).scale);
  const again=(await stage.boundingBox())!;
  await page.mouse.move(again.x+again.width/2,again.y+again.height/2);
  await page.mouse.down();
  for(let step=1;step<=6;step++){await page.mouse.move(again.x+again.width/2+step*12,again.y+again.height/2);await page.waitForTimeout(20);}
  await page.mouse.up();
  const zoomed=await waitForTitle(page,event=>Number((event.transform as {scale:number}).scale)>before+.05,'el zoom llega al modelo');
  expect(Number((zoomed.transform as {scale:number}).scale)).toBeGreaterThan(before);
  // El selector de parámetro de la tira filtra las claves que se ven.
  await window.getByRole('button',{name:'Añadir clave aquí'}).click();
  await expect(window.locator('.key-mark')).toHaveCount(1);
  await window.getByLabel('Parámetro de la tira de claves').click();
  await page.getByRole('option',{name:'Recorte'}).click();
  await expect(window.locator('.key-mark')).toHaveCount(1);   // la primera clave siempre se ve
  await expect(window.locator('.pan-crop-keycount')).toContainText('1 de 1 claves');
  await expect(window.locator('.pan-crop-keytools').getByRole('button',{name:'Añadir fotograma clave'})).toHaveCount(1);
});

// Lo que la ventana tiene que enseñar como la de VEGAS 15: las migas de la barra de pestañas, el formato de los
// números con separador de millares, el estarcido del monitor, la vista de zoom y la densidad de cuadrícula del
// grupo «Área de trabajo», el grupo «Origen» y los preestablecidos propios que se guardan y se borran.
test('Panoramización y recorte: migas, números de VEGAS, estarcido, vista y preestablecidos propios',async({page})=>{
  await createTitle(page);
  await page.getByRole('button',{name:/Abrir la ventana de Panoramización y recorte/}).click();
  const window=page.locator('.pan-crop-window');
  await expect(window).toBeVisible();

  // 1. Migas: el nombre de la ventana entre el complemento anterior y el siguiente, como en VEGAS.
  await expect(window.locator('.pan-crop-tab')).toHaveText('Panoramización/Recorte');
  await expect(window.getByRole('button',{name:/Complemento anterior/})).toBeEnabled();
  await expect(window.getByRole('button',{name:'Complemento siguiente'})).toBeDisabled();

  // 2. El árbol de parámetros escribe los números como VEGAS: separador de millares y un decimal.
  await expect(window.getByLabel('Anchura (px)')).toHaveValue('1,920.0');
  await expect(window.getByLabel('Ángulo (°)')).toHaveValue('0.0');
  await expect(window.getByLabel('Recorte izq. (%)')).toHaveValue('0.0');
  // Las flechas del campo suben y bajan por el paso, y al salir se vuelve a formatear.
  await window.getByLabel('Ángulo (°)').click();
  await page.keyboard.press('ArrowUp');
  await window.getByLabel('Ángulo (°)').blur();
  await expect(window.getByLabel('Ángulo (°)')).toHaveValue('1.0');

  // 3. El monitor dibuja el estarcido del recuadro del contenido, y al recortar marca lo que se descarta.
  const inks=async()=>page.evaluate(()=>{
    const canvas=document.querySelector('.pan-crop-stage') as HTMLCanvasElement;
    const ctx=canvas.getContext('2d')!;
    const margin=Number(canvas.dataset.margin), width=Number(canvas.dataset.frameWidth), height=Number(canvas.dataset.frameHeight);
    // Una franja de 8 px del borde superior del recuadro: si hay estarcido, no todos los píxeles son iguales.
    const data=ctx.getImageData(margin+4,margin+4,width-8,6).data;
    const seen=new Set<string>();
    for(let i=0;i<data.length;i+=4)seen.add(`${data[i]},${data[i+1]},${data[i+2]}`);
    return seen.size;
  });
  expect(await inks(),'el recuadro del contenido va estarcido, con más de un tono').toBeGreaterThan(1);

  // 4. «Vista de zoom» y «Densidad de cuadrícula» son de la vista: la vista agranda el lienzo y la cuadrícula
  //    se dibuja sobre el fotograma, sin tocar el encuadre.
  const area=window.locator('.param-group').filter({has:page.locator('.param-group-name',{hasText:'Área de trabajo'})});
  await area.locator('.param-group-title').click();
  const scaleOf=()=>page.evaluate(()=>{
    const project=JSON.parse(localStorage.getItem('corte15-autosave-v1')??'{}') as {events?:{kind?:string;transform?:{scale?:number}}[]};
    return Number((project.events??[]).find(event=>event.kind==='text')?.transform?.scale??1);
  });
  const stage=window.locator('.pan-crop-stage');
  const beforeBox=(await stage.boundingBox())!;
  await area.getByLabel('Vista de zoom (%)').fill('200');
  await area.getByLabel('Vista de zoom (%)').blur();
  await expect.poll(async()=>Math.round((await stage.boundingBox())!.width),{message:'la vista de zoom agranda el monitor',timeout:10000}).toBeGreaterThan(Math.round(beforeBox.width)+20);
  const scaleBefore=await scaleOf();
  await area.getByLabel('Densidad de cuadrícula (px)').fill('48');
  await area.getByLabel('Densidad de cuadrícula (px)').blur();
  await expect(area.getByLabel('Densidad de cuadrícula (px)')).toHaveValue('48.0');
  // La vista no toca el encuadre: la escala del modelo sigue igual.
  expect(await scaleOf()).toBeCloseTo(scaleBefore,6);

  // 5. «Origen»: la casilla de la relación de aspecto describe el motor y «Extender para rellenar f.» está
  //    apagada en un evento generado, porque no hay material que extender (se dice en su pista).
  const source=window.locator('.param-group').filter({has:page.locator('.param-group-name',{hasText:'Origen'})});
  await source.locator('.param-group-title').click();
  await expect(source.getByLabel('Mantener rel. de aspecto')).toBeChecked();
  await expect(source.getByLabel('Mantener rel. de aspecto')).toBeDisabled();
  await expect(source.getByLabel('Extender para rellenar f.')).toBeDisabled();
  await expect(source.locator('label').filter({hasText:'Extender para rellenar f.'})).toHaveAttribute('title',/cubrir el fotograma del proyecto/);
  await expect(source).toContainText('sin medio: se usa el fotograma');

  // 6. «Suavidad (%)» de la interpolación llega al modelo.
  const keys=window.locator('.param-group').filter({has:page.locator('.param-group-name',{hasText:'Interpolación'})});
  await keys.locator('.param-group-title').click();
  await keys.getByLabel('Suavidad (%)').fill('40');
  await keys.getByLabel('Suavidad (%)').blur();
  await expect.poll(async()=>((await autosave(page)).events??[]).find(event=>event.kind==='text')?.keySmoothness,{message:'la suavidad llega al modelo',timeout:20000}).toBe(40);

  // 7. «Guardar parámetro preestablecido» guarda el encuadre en el proyecto y «Eliminar…» lo quita, con la
  //    confirmación de VEGAS.
  await window.getByLabel('Anchura (px)').fill('960');
  await window.getByLabel('Anchura (px)').blur();
  await expect.poll(async()=>await scaleOf(),{message:'la escala cambia antes de guardar',timeout:20000}).toBeCloseTo(.5,3);
  page.once('dialog',dialog=>{void dialog.accept('Encuadre de prueba');});
  await window.getByRole('button',{name:'Guardar parámetro preestablecido'}).click();
  await expect.poll(async()=>((await autosave(page)).panCropPresets as unknown[]|undefined)?.length??0,{message:'el preestablecido se guarda en el proyecto',timeout:20000}).toBe(1);
  await expect(window.getByLabel('Parámetro preestablecido',{exact:true})).toContainText('Encuadre de prueba');
  // Se cambia el encuadre y se vuelve al preestablecido guardado: recupera la escala con la que se guardó.
  await window.getByLabel('Anchura (px)').fill('1920');
  await window.getByLabel('Anchura (px)').blur();
  await expect.poll(async()=>await scaleOf(),{timeout:20000}).toBeCloseTo(1,3);
  await window.getByLabel('Parámetro preestablecido',{exact:true}).click();
  await page.getByRole('option',{name:'Encuadre de prueba'}).click();
  await expect.poll(async()=>await scaleOf(),{message:'el preestablecido guardado se vuelve a aplicar',timeout:20000}).toBeCloseTo(.5,3);
  // Y se borra con la confirmación de VEGAS.
  page.once('dialog',dialog=>{void dialog.accept();});
  await window.getByRole('button',{name:'Eliminar parámetro preestablecido'}).click();
  await expect.poll(async()=>((await autosave(page)).panCropPresets as unknown[]|undefined)?.length??0,{message:'el preestablecido se borra',timeout:20000}).toBe(0);

  // 8. Las migas vuelven a las propiedades del evento.
  await window.getByRole('button',{name:/Complemento anterior/}).click();
  await expect(page.getByRole('dialog').getByRole('tab',{name:'Evento de vídeo'})).toBeVisible();
});


// La ventana de Pan/Crop es flotante: ancha, se mueve arrastrándola por su barra o por sus bordes y se cambia
// de tamaño desde los ocho tiradores de los extremos, sin poder perderla fuera de la pantalla.
test('Panoramización y recorte: la ventana flotante se mueve y se redimensiona',async({page})=>{
  const viewport=page.viewportSize()!;
  await createTitle(page);
  await page.getByRole('button',{name:/Abrir la ventana de Panoramización y recorte/}).click();
  const window=page.locator('.pan-crop-window');
  await expect(window).toBeVisible();
  const box=async()=>{const rect=(await window.boundingBox())!;return {x:Math.round(rect.x),y:Math.round(rect.y),width:Math.round(rect.width),height:Math.round(rect.height)};};
  // Arranca ancha (más ancha que alta), con el monitor a la vista y dentro de la pantalla.
  const start=await box();
  expect(start.width,`tamaño inicial: ${JSON.stringify(start)}`).toBeGreaterThan(900);
  expect(start.width).toBeGreaterThan(start.height);
  expect(start.x).toBeGreaterThanOrEqual(0);
  expect(start.x+start.width).toBeLessThanOrEqual(viewport.width);
  expect(start.y+start.height).toBeLessThanOrEqual(viewport.height);
  expect(Math.round((await page.locator('.pan-crop-stage').boundingBox())!.width)).toBeGreaterThan(300);
  // El tirador de la esquina inferior derecha cambia el tamaño sin mover la ventana.
  const dragHandle=async(selector:string,dx:number,dy:number)=>{
    const handle=(await window.locator(selector).boundingBox())!;
    const startX=handle.x+handle.width/2,startY=handle.y+handle.height/2;
    await page.mouse.move(startX,startY);
    await page.mouse.down();
    for(let step=1;step<=8;step++){await page.mouse.move(startX+dx*step/8,startY+dy*step/8);await page.waitForTimeout(20);}
    await page.mouse.up();
  };
  await dragHandle('.pan-crop-resize.se',-320,-180);
  const smaller=await box();
  expect(smaller.width,`se encogió a ${JSON.stringify(smaller)}`).toBeLessThan(start.width-250);
  expect(smaller.height).toBeLessThan(start.height-140);
  expect(smaller.x).toBe(start.x);
  expect(smaller.y).toBe(start.y);
  // Arrastrar la barra de título la mueve sin cambiar el tamaño. Se agarra cerca de un extremo, como haría
  // cualquiera, y todos los arrastres se quedan dentro de la ventana del navegador: Firefox recorta las
  // coordenadas que se salen y el gesto se perdería.
  const moveBy=async(dx:number,dy:number)=>{
    const titlebar=(await window.locator('.pan-crop-titlebar').boundingBox())!;
    const startX=titlebar.x+24,startY=titlebar.y+titlebar.height/2;
    await page.mouse.move(startX,startY);
    await page.mouse.down();
    for(let step=1;step<=8;step++){await page.mouse.move(startX+dx*step/8,startY+dy*step/8);await page.waitForTimeout(20);}
    await page.mouse.up();
  };
  await moveBy(120,60);
  const moved=await box();
  expect(Math.abs(moved.x-(smaller.x+120)),`quedó en ${JSON.stringify(moved)}`).toBeLessThan(4);
  expect(Math.abs(moved.y-(smaller.y+60))).toBeLessThan(4);
  expect(moved.width).toBe(smaller.width);
  expect(moved.height).toBe(smaller.height);
  // El tirador izquierdo cambia el ancho por ese lado: la x se mueve y el borde derecho se queda quieto.
  const rightEdge=moved.x+moved.width;
  await dragHandle('.pan-crop-resize.w',70,0);
  const narrowed=await box();
  expect(narrowed.x-moved.x).toBeGreaterThan(50);
  expect(narrowed.width).toBeLessThan(moved.width-50);
  expect(Math.abs(narrowed.x+narrowed.width-rightEdge)).toBeLessThan(3);
  // El tirador derecho lo devuelve a lo ancho.
  await dragHandle('.pan-crop-resize.e',90,0);
  const widened=await box();
  expect(widened.width-narrowed.width).toBeGreaterThan(70);
  expect(widened.x).toBe(narrowed.x);
  // El tamaño mínimo se respeta aunque se arrastre de más.
  await dragHandle('.pan-crop-resize.se',-800,-500);
  const tiny=await box();
  expect(tiny.width,`tamaño mínimo: ${JSON.stringify(tiny)}`).toBe(460);
  expect(tiny.height).toBe(320);
  // Arrastrarla muy a la derecha no la pierde: se queda pegada al borde de la pantalla.
  await moveBy(1000,0);
  const pushed=await box();
  expect(pushed.x+pushed.width,`quedó en ${JSON.stringify(pushed)}`).toBeLessThanOrEqual(viewport.width);
  expect(pushed.x).toBe(viewport.width-pushed.width);
  // Doble clic en la barra de título la vuelve a centrar.
  await window.locator('.pan-crop-titlebar').dblclick();
  const centred=await box();
  expect(Math.abs(centred.x-(viewport.width-centred.width)/2),`quedó en ${JSON.stringify(centred)}`).toBeLessThan(4);
  // Y sigue siendo utilizable: el lienzo responde al arrastre después de mover y redimensionar.
  const stage=window.locator('.pan-crop-stage');
  await stage.scrollIntoViewIfNeeded();
  const from=(await stage.boundingBox())!;
  const cx=from.x+from.width/2,cy=from.y+from.height/2;
  await page.mouse.move(cx,cy);
  await page.mouse.down();
  for(let step=1;step<=6;step++){await page.mouse.move(cx+step*8,cy+step*4);await page.waitForTimeout(25);}
  await page.mouse.up();
  await waitForTitle(page,event=>Number((event.transform as {x:number}).x)>0.02,'el lienzo sigue respondiendo tras mover la ventana');
});

test('Títulos y texto: la ventana edita el texto, el anclaje, la negrita y el contorno, y se ve en la línea de tiempo',async({page})=>{
  await createTitle(page,'TEXTO INICIAL');
  await page.getByRole('button',{name:/Abrir el editor de títulos y texto/}).click();
  const window=page.locator('.titles-window');
  await expect(window).toBeVisible();
  await expect(window.locator('canvas')).toBeVisible();

  await window.locator('textarea').fill('NUEVO TITULO');
  await window.getByRole('button',{name:'Arriba izquierda'}).click();
  await window.getByRole('button',{name:'Negrita'}).click();
  await window.getByLabel('Grosor').fill('6');
  await window.getByLabel('Seguimiento (px)').fill('12');
  const event=await waitForTitle(page,item=>item.bold===true&&item.outlineWidth===6&&item.tracking===12,'el estilo llega al modelo');
  expect(event.text).toBe('NUEVO TITULO');
  expect(event.anchor).toBe('top-left');
  expect(event.bold).toBe(true);
  expect(event.outlineWidth).toBe(6);
  expect(event.tracking).toBe(12);

  await window.getByRole('button',{name:'Cerrar',exact:true}).click();
  await expect(page.locator('.timeline-event.video').filter({hasText:'NUEVO TITULO'})).toHaveCount(1);
});

test('Títulos y texto: restablecer estilo vuelve a los valores del pintado clásico',async({page})=>{
  await createTitle(page);
  await page.getByRole('button',{name:/Abrir el editor de títulos y texto/}).click();
  const window=page.locator('.titles-window');
  await window.getByLabel('Interlineado').fill('2.5');
  await window.getByRole('button',{name:'Abajo derecha'}).click();
  const styled=await waitForTitle(page,event=>event.lineSpacing===2.5&&event.anchor==='bottom-right','el interlineado y el anclaje se guardan');
  expect(styled.lineSpacing).toBe(2.5);
  expect(styled.anchor).toBe('bottom-right');

  await window.getByRole('button',{name:'Restablecer estilo'}).click();
  const plain=await waitForTitle(page,event=>event.lineSpacing===undefined&&event.anchor===undefined,'el estilo vuelve a los valores por defecto');
  expect(plain.lineSpacing).toBeUndefined();
  expect(plain.anchor).toBeUndefined();
  expect(plain.text).toBe('TITULO DE PRUEBA');
});

// Plantillas de texto al estilo de CapCut: contorno, sombra, caja de fondo, karaoke y animaciones de entrada.
test('Plantillas de texto estilo CapCut: se aplican al evento, se pintan en el monitor y no se mezclan entre sí',async({page})=>{
  await createTitle(page);
  await page.getByRole('button',{name:/Abrir el editor de títulos y texto/}).click();
  const window=page.locator('.titles-window');
  // La galería trae las tres familias y una plantilla por estilo.
  await expect(window.locator('.text-preset-group-name')).toHaveText(['Redes (vertical)','Subtítulos','Títulos']);
  expect(await window.locator('.text-preset-buttons button').count()).toBeGreaterThan(12);
  // Cuenta los píxeles amarillos del monitor: es el color de resalte del karaoke.
  const yellow=()=>page.evaluate(()=>{
    const canvas=document.querySelector('.titles-preview') as HTMLCanvasElement|null;
    if(!canvas)return -1;
    const pixels=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;
    let total=0;
    for(let i=0;i<pixels.length;i+=4)if(pixels[i]>200&&pixels[i+1]>180&&pixels[i+2]<80)total++;
    return total;
  });
  // Al principio del evento no hay ninguna palabra cantada.
  expect(await yellow(),'sin karaoke no debería haber amarillo').toBe(0);
  await window.getByRole('button',{name:'Plantilla Karaoke amarillo'}).click();
  const karaoke=await waitForTitle(page,event=>event.animation==='karaoke'&&event.highlightColor==='#ffe600','la plantilla de karaoke llega al modelo');
  expect(karaoke.outlineWidth).toBe(12);
  expect(karaoke.anchor).toBe('bottom-center');
  expect(karaoke.bold).toBe(true);
  await expect(window.getByRole('button',{name:'Plantilla Karaoke amarillo'})).toHaveAttribute('aria-pressed','true');
  await expect(window.locator('.text-presets small')).toContainText('Karaoke amarillo');
  expect(await yellow(),'con el cursor al principio, aún no hay palabras cantadas').toBe(0);
  // Al final del evento, sí: se cierra la ventana, se lleva el cursor cerca del final y se vuelve a abrir.
  await window.getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const ruler=(await page.locator('.ruler').boundingBox())!;
  await page.locator('.ruler').click({position:{x:Math.min(ruler.width-6,120),y:22}});
  await page.waitForTimeout(300);
  await page.locator('.timeline-event').first().dblclick();
  await page.getByRole('button',{name:/Abrir el editor de títulos y texto/}).click();
  await expect.poll(yellow,{message:'las palabras ya cantadas deberían pintarse de amarillo',timeout:10000}).toBeGreaterThan(10);
  // Otra plantilla reemplaza el estilo entero: no quedan restos de la anterior.
  await window.getByRole('button',{name:'Plantilla Subtítulo con caja'}).click();
  const boxed=await waitForTitle(page,event=>event.animation==='fade'&&(event.background as {opacity?:number}|undefined)?.opacity===.85,'la segunda plantilla llega al modelo');
  expect(boxed.outlineWidth).toBe(0);
  expect(boxed.highlightColor).toBe('#ffe600');       // el resalte vuelve al valor neutro
  expect(boxed.animation).toBe('fade');
  await expect(window.getByRole('button',{name:'Plantilla Karaoke amarillo'})).toHaveAttribute('aria-pressed','false');
  // Y un retoque a mano deja el estilo como propio.
  await window.getByLabel('Grosor').fill('7');
  await expect(window.locator('.text-presets small')).toContainText('Estilo propio');
});

test('Movimiento de pista: la ventana mueve y escala la pista entera, y no ofrece recorte',async({page})=>{
  await page.locator('#track-headers .track-header button[title^="Propiedades de"]').first().click();
  await page.getByRole('button',{name:/Abrir la ventana de Movimiento de pista/}).click();
  const window=page.locator('.pan-crop-window');
  await expect(window).toBeVisible();
  await expect(window.getByLabel('Recorte izq. (%)')).toHaveCount(0);
  await window.getByLabel('Escala').fill('1.25');
  await window.getByLabel('Ángulo (°)').fill('15');
  await expect.poll(async()=>{
    const project=await autosave(page);
    const track=project.tracks?.[0] as {transform:{scale:number}}|undefined;
    return track?Math.abs(track.transform.scale-1.25)<1e-6:false;
  },{message:'la escala de la pista llega al modelo',timeout:20000}).toBe(true);
  const project=await autosave(page);
  const track=project.tracks![0] as {transform:{scale:number;rotation:number}};
  expect(track.transform.scale).toBeCloseTo(1.25,3);
  expect(track.transform.rotation).toBe(15);
});

test('Panoramización y recorte: la escala y el giro no tocan la duración del evento',async({page})=>{
  await createTitle(page);
  const before=Number((await waitForTitle(page,event=>event.duration!==undefined,'el título está en el proyecto')).duration);
  await page.getByRole('button',{name:/Abrir la ventana de Panoramización y recorte/}).click();
  const window=page.locator('.pan-crop-window');
  await window.getByLabel('Escala').fill('1.5');
  await window.getByLabel('Ángulo (°)').fill('30');
  const event=await waitForTitle(page,item=>Math.abs(Number((item.transform as {scale:number}).scale)-1.5)<1e-6&&(item.transform as {rotation:number}).rotation===30,'la escala y el giro llegan al modelo');
  const transform=event.transform as {scale:number;rotation:number};
  expect(transform.scale).toBeCloseTo(1.5,3);
  expect(transform.rotation).toBe(30);
  expect(event.duration).toBe(before);
});

// Cualquier evento visible (color, imagen o vídeo), para las pruebas de efectos y generadores.
const visualEventOf = async (page:Page) => ((await autosave(page)).events ?? []).find(event => ['color', 'image', 'video', 'audio'].includes(String(event.kind)));
async function waitForVisualEvent(page:Page, check:(event:Record<string,unknown>)=>boolean, message:string){
  await expect.poll(async()=>{const event=await visualEventOf(page);return event?check(event):false;},{message,timeout:20000}).toBe(true);
  return (await visualEventOf(page))!;
}
// El desplegable de «Transición de entrada» del diálogo es un `Select` propio (no un `<select>` nativo): al
// elegir con el ratón, el motor cierra a veces la lista sin aplicar la opción cuando la máquina está cargada (se
// vio en una corrida de los cuatro motores). Se comprueba el texto del propio disparador y, si no cambió, se
// vuelve a elegir: es un reintento, no una espera más larga.
async function pickTransition(page:Page,label:string){
  const trigger=page.getByLabel('Transición de entrada');
  for(let attempt=0;attempt<3;attempt++){
    if((await trigger.innerText()).trim()===label)return;
    await trigger.click();
    await page.getByRole('option',{name:label,exact:true}).click();
    try{await expect(trigger).toHaveText(label,{timeout:5000});return;}catch{/* se reintenta */ }
  }
  await expect(trigger,'el desplegable no llegó a cambiar de valor').toHaveText(label);
}

test('Efectos de vídeo: se añaden desde la pestaña, se ajustan, se ordenan y se quitan',async({page})=>{
  await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();
  await page.getByRole('button',{name:'Color sólido',exact:true}).click();
  await page.getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.getByRole('tab',{name:'Efectos de video',exact:true}).click();
  await page.getByRole('button',{name:'Invertir',exact:true}).click();
  const window=page.locator('.effects-window');
  await expect(window).toBeVisible();

  const applied=await waitForVisualEvent(page,event=>(event.effects as {kind:string}[])?.[0]?.kind==='invert','el efecto llega al modelo');
  expect((applied.effects as unknown[]).length).toBe(1);
  expect((applied.effects as {enabled:boolean}[])[0].enabled).toBe(true);

  // Un parámetro del efecto: la cantidad de inversión.
  await window.getByLabel('Cantidad de inversión').fill('0.5');
  const tuned=await waitForVisualEvent(page,event=>(event.effects as {amount:number}[])[0]?.amount===.5,'el parámetro llega al modelo');
  expect((tuned.effects as {amount:number}[])[0].amount).toBe(.5);

  // Un segundo efecto y el orden: se sube el desenfoque por delante de la inversión.
  await window.getByRole('button',{name:'Desenfoque gaussiano',exact:true}).click();
  await waitForVisualEvent(page,event=>(event.effects as unknown[])?.length===2,'el segundo efecto se añade');
  await window.getByRole('button',{name:'Subir Desenfoque gaussiano'}).click();
  const ordered=await waitForVisualEvent(page,event=>(event.effects as {kind:string}[])[0]?.kind==='blur','el orden cambia');
  expect((ordered.effects as {kind:string}[]).map(effect=>effect.kind)).toEqual(['blur','invert']);

  // Apagar un efecto no lo borra, y quitarlo sí.
  await window.getByLabel('Aplicado: Invertir').click();
  await page.getByRole('option',{name:'No'}).click();
  const off=await waitForVisualEvent(page,event=>(event.effects as {enabled:boolean}[])[1]?.enabled===false,'el efecto se apaga');
  expect((off.effects as unknown[]).length).toBe(2);
  await window.getByRole('button',{name:'Quitar Invertir'}).click();
  const removed=await waitForVisualEvent(page,event=>(event.effects as unknown[])?.length===1,'el efecto se quita');
  expect((removed.effects as {kind:string}[])[0].kind).toBe('blur');
});

test('Generadores: degradado y patrón de pruebas se crean con su tipo y sus ajustes',async({page})=>{
  await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();
  await page.getByRole('button',{name:'Degradado de color',exact:true}).click();
  const gradient=await waitForVisualEvent(page,event=>(event.generator as {kind:string})?.kind==='gradient','el degradado llega al modelo');
  expect((gradient.generator as {kind:string}).kind).toBe('gradient');
  expect(gradient.name).toBe('Degradado de color');

  await page.getByLabel(/Ángulo del degradado/).fill('90');
  const angled=await waitForVisualEvent(page,event=>(event.generator as {angle:number})?.angle===90,'el ángulo llega al modelo');
  expect((angled.generator as {angle:number}).angle).toBe(90);

  await page.getByLabel('Generador de medios').click();
  await page.getByRole('option',{name:'Patrón de pruebas'}).click();
  const bars=await waitForVisualEvent(page,event=>(event.generator as {kind:string})?.kind==='bars','el cambio de generador llega al modelo');
  expect((bars.generator as {kind:string}).kind).toBe('bars');
});

test('Transiciones: se eligen en la pestaña, llegan al proyecto y duran lo que el fundido de entrada',async({page})=>{
  await page.getByRole('tab',{name:'Generadores de medios',exact:true}).click();
  await page.getByRole('button',{name:'Color sólido',exact:true}).click();
  await page.getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.getByRole('tab',{name:'Transiciones',exact:true}).click();
  await page.getByRole('button',{name:'Barrido de entrada desde la izquierda',exact:true}).click();
  const applied=await waitForVisualEvent(page,event=>event.transition==='wipe-from-left','la transición llega al modelo');
  expect(applied.transition).toBe('wipe-from-left');
  expect(Number(applied.fadeIn)).toBeGreaterThan(0);

  // El catálogo tiene las ocho familias —con las nuevas de iris, zoom y página— y todas sus transiciones.
  const families=await page.locator('.catalog h4').allInnerTexts();
  for(const family of ['Fundidos','Barridos','Iris','Persianas','Deslizamientos','Compresiones','Zoom','Página'])expect(families).toContain(family);
  await expect(page.locator('.preset-list button')).toHaveCount(36);
  // Y una de las nuevas llega al modelo como las de siempre.
  await page.getByRole('button',{name:'Círculos centrados',exact:true}).click();
  const iris=await waitForVisualEvent(page,event=>event.transition==='iris-circle','la transición nueva llega al modelo');
  expect(iris.transition).toBe('iris-circle');

  // Y se puede cambiar desde las propiedades del evento, sin tocar la duración.
  await page.locator('.timeline-event').first().dblclick();
  await pickTransition(page,'Remolino');
  const changed=await waitForVisualEvent(page,event=>event.transition==='spiral','el cambio de transición llega al modelo');
  expect(changed.transition).toBe('spiral');
  expect(Number(changed.fadeIn)).toBe(Number(applied.fadeIn));

  // Y se puede quitar.
  await pickTransition(page,'Ninguna');
  const cleared=await waitForVisualEvent(page,event=>event.transition===undefined,'la transición se quita');
  expect(cleared.transition).toBeUndefined();
});

test('Fotogramas clave: la curva de aceleración se elige y se guarda en la clave',async({page})=>{
  await createTitle(page);
  await page.getByRole('button',{name:/Abrir la ventana de Panoramización y recorte/}).click();
  const window=page.locator('.pan-crop-window');
  await window.getByRole('button',{name:'Añadir clave aquí'}).click();
  await waitForTitle(page,event=>(event.keys as unknown[])?.length===1,'la primera clave se crea');

  // La curva de la clave en la que está el cursor: se elige «Suave».
  await window.getByLabel('Curva de la clave del cursor').click();
  await page.getByRole('option',{name:'Suave'}).click();
  const curved=await waitForTitle(page,event=>(event.keys as {curve?:string}[])[0]?.curve==='smooth','la curva llega a la clave');
  expect((curved.keys as {curve?:string}[])[0].curve).toBe('smooth');

  // Y los botones que la aplican a todas las claves de golpe.
  await window.getByRole('button',{name:'Linealizar todas'}).click();
  const linear=await waitForTitle(page,event=>(event.keys as {curve?:string}[])[0]?.curve==='linear','se linealizan todas las claves');
  expect((linear.keys as {curve?:string}[])[0].curve).toBe('linear');
  await window.getByRole('button',{name:'Suavizar todas'}).click();
  await waitForTitle(page,event=>(event.keys as {curve?:string}[])[0]?.curve==='smooth','se suavizan todas las claves');
});

test('Edición de precisión: slip, slide y recorte por rizo con el teclado',async({page})=>{
  // Hace falta material real: el deslizamiento mueve el contenido dentro del archivo.
  await requireMediaApis(page);
  await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Video_A.mp4')]);
  await expect(page.locator('.media-item')).toHaveCount(1,{timeout:60000});
  await page.locator('.media-item').filter({hasText:'Video_A.mp4'}).dblclick();
  const inserted=await waitForVisualEvent(page,event=>event.kind==='video','el vídeo entra en la línea de tiempo');
  const duration=Number(inserted.duration);

  // Se acorta para que quede material con el que deslizar, desde el diálogo del evento.
  await page.locator('.timeline-event').first().dblclick();
  await page.getByLabel('Duración (s)').fill(String(Math.round(duration/705600000/2*100)/100));
  await page.getByRole('button',{name:'Cerrar',exact:true}).click();
  const shortened=await waitForVisualEvent(page,event=>Number(event.duration)<duration-1,'el evento se acorta');
  const offsetBefore=Number(shortened.offset);

  // Alt + → desliza el contenido tres fotogramas (sin mover el clip).
  await page.locator('.timeline-event').first().click();
  for(let step=0;step<3;step++)await page.keyboard.press('Alt+ArrowRight');
  const slipped=await waitForVisualEvent(page,event=>Number(event.offset)>offsetBefore+1,'el contenido se desliza');
  expect(Number(slipped.offset)).toBeGreaterThan(offsetBefore);
  expect(Number(slipped.start)).toBe(Number(shortened.start));

  // Ctrl+Alt + → desplaza el evento dos fotogramas.
  const startBefore=Number(slipped.start);
  for(let step=0;step<2;step++)await page.keyboard.press('Control+Alt+ArrowRight');
  const slid=await waitForVisualEvent(page,event=>Number(event.start)>startBefore+1,'el evento se desplaza');
  expect(Number(slid.start)).toBeGreaterThan(startBefore);
  expect(Number(slid.duration)).toBe(Number(slipped.duration));
  expect(Number(slid.offset)).toBe(Number(slipped.offset));

  // Alt+Mayús + ← recorta la cabecera hasta el cursor y adelanta lo que venía después.
  const box=(await page.locator('.timeline-event').first().boundingBox())!;
  await page.mouse.click(box.x+box.width*.75,box.y+box.height/2);
  const beforeTrim=await waitForVisualEvent(page,()=>true,'el cursor está en el evento');
  await page.keyboard.press('Alt+Shift+ArrowLeft');
  const trimmed=await waitForVisualEvent(page,event=>Number(event.duration)<Number(beforeTrim.duration)-1,'el evento se recorta por rizo');
  expect(Number(trimmed.start)).toBe(Number(beforeTrim.start));
  expect(Number(trimmed.offset)).toBeGreaterThan(Number(beforeTrim.offset));

  // Alt + [ y Alt + ] son los atajos que anuncia el menú del clic derecho del evento: recortan por rizo el
  // principio y el final hasta el cursor. Se comprueban en un evento nuevo y entero, porque el de arriba ya está
  // recortado a un trozo diminuto y ahí el cursor no cabe.
  await page.locator('.bottom-toolbar .transport').getByRole('button',{name:'Ir al final',exact:true}).click();
  await page.locator('.media-item').first().dblclick();
  const fresh=page.locator('.timeline-event.video').last();
  await expect(page.locator('.timeline-event.video')).toHaveCount(2);
  await expect.poll(async()=>((await autosave(page)).events??[]).filter(event=>event.kind==='video').length,{message:'el segundo vídeo entra en la línea de tiempo',timeout:20000}).toBe(2);
  const freshId=(await fresh.getAttribute('data-event-id'))!;
  const freshEvent=async()=>((await autosave(page)).events??[]).find(event=>event.id===freshId) as Record<string,unknown>|undefined;
  const clickFresh=async(fraction:number)=>{
    const now=(await fresh.boundingBox())!;
    await page.mouse.click(now.x+now.width*fraction,now.y+now.height/2);
  };
  // Alt + ] recorta el final hasta el cursor.
  await clickFresh(.5);
  const beforeBracket=(await freshEvent())!;
  await page.keyboard.press('Alt+]');
  await expect.poll(async()=>Number((await freshEvent())?.duration),{message:'Alt+] recorta el final hasta el cursor',timeout:20000}).toBeLessThan(Number(beforeBracket.duration)-1);
  const cutEnd=(await freshEvent())!;
  expect(Number(cutEnd.start)).toBe(Number(beforeBracket.start));
  expect(Number(cutEnd.offset)).toBe(Number(beforeBracket.offset));
  // Alt + [ recorta el principio: el evento empieza donde empezaba y el material se adelanta (rizo).
  await clickFresh(.4);
  const beforeStart=(await freshEvent())!;
  await page.keyboard.press('Alt+[');
  await expect.poll(async()=>Number((await freshEvent())?.offset),{message:'Alt+[ recorta el principio hasta el cursor',timeout:20000}).toBeGreaterThan(Number(beforeStart.offset)+1);
  const cutStart=(await freshEvent())!;
  expect(Number(cutStart.start)).toBe(Number(beforeStart.start));
  expect(Number(cutStart.duration)).toBeLessThan(Number(beforeStart.duration));
  expect(Number(cutStart.offset)).toBeGreaterThan(Number(beforeStart.offset));
});

async function waitForProject(page:Page,check:(project:Saved)=>boolean,message:string){
  await expect.poll(async()=>check(await autosave(page)),{message,timeout:20000}).toBe(true);
  return autosave(page);
}

// Los puntos de la envolvente de volumen de la primera pista de audio del proyecto guardado.
const volumePoints=(project:Saved):{time:number;value:number}[]=>{
  const track=(project.tracks??[]).find((item:Record<string,unknown>)=>item.kind==='audio') as {volumeCurve?:{time:number;value:number}[]}|undefined;
  return track?.volumeCurve??[];
};
// Tomas de efectos de audio: las de la primera pista de audio o las del primer bus.
type SavedInsert={kind:string;enabled:boolean;threshold?:number};
const insertsOf=(project:Saved,where:'track'|'bus'):SavedInsert[]=>{
  if(where==='bus'){
    const buses=(project.buses??[]) as {inserts?:SavedInsert[]}[];
    return buses[0]?.inserts??[];
  }
  const track=(project.tracks??[]).find((item:Record<string,unknown>)=>item.kind==='audio') as {inserts?:SavedInsert[]}|undefined;
  return track?.inserts??[];
};

test('Mezclador: buses, enrutado, silencio y envolventes dibujadas sobre la pista',async({page})=>{
  await requireMediaApis(page,['AudioDecoder','AudioContext']);
  await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Audio.wav')]);
  await expect(page.locator('.media-item')).toHaveCount(1,{timeout:60000});
  await page.locator('.media-item').filter({hasText:'Audio.wav'}).dblclick();
  await waitForVisualEvent(page,event=>event.kind==='audio','el audio entra en la línea de tiempo');

  // La consola se abre desde la barra inferior.
  await page.getByRole('button',{name:'Mezclador',exact:true}).click();
  const mixer=page.locator('.mixer');
  await expect(mixer).toBeVisible();
  await mixer.getByRole('button',{name:'Añadir bus'}).click();
  await waitForProject(page,project=>((project.buses??[]) as unknown[]).length===1,'el bus se añade al proyecto');

  // Enrutar la pista de audio al bus y silenciarla.
  await mixer.getByLabel('Bus de Audio').selectOption({index:1});
  await waitForProject(page,project=>(project.tracks??[]).some((track:Record<string,unknown>)=>Boolean(track.busId)),'la pista se enruta al bus');
  await mixer.getByRole('button',{name:'Silenciar Audio'}).click();
  await waitForProject(page,project=>(project.tracks??[]).some((track:Record<string,unknown>)=>track.kind==='audio'&&track.mute===true),'la pista queda en silencio');
  await mixer.getByRole('button',{name:'Silenciar Audio'}).click();
  await waitForProject(page,project=>(project.tracks??[]).some((track:Record<string,unknown>)=>track.kind==='audio'&&track.mute===false),'y se vuelve a oír');

  // Quitar el bus desenruta la pista.
  await mixer.getByRole('button',{name:/^Quitar Bus A$/}).click();
  const withoutBus=await waitForProject(page,project=>((project.buses??[]) as unknown[]).length===0,'el bus se quita');
  expect((withoutBus.tracks??[]).some((track:Record<string,unknown>)=>track.busId)).toBe(false);
  await mixer.getByRole('button',{name:'Cerrar'}).click();

  // Envolvente de volumen: se dibuja sobre la pista (que puede estar fuera del área visible de la línea de tiempo).
  await page.getByRole('button',{name:'Volumen',exact:true}).click();
  const lane=page.locator('.envelope-lane.volume').first();
  await expect(lane).toBeVisible();
  await lane.scrollIntoViewIfNeeded();
  const box=(await lane.boundingBox())!;
  await page.mouse.click(box.x+120,box.y+box.height/2);
  await waitForProject(page,project=>volumePoints(project).length===1,'el punto de la envolvente llega al proyecto');

  // Se arrastra el punto hacia abajo: el valor baja.
  const pointBefore=volumePoints(await autosave(page))[0];
  await page.mouse.move(box.x+120,box.y+box.height/2);
  await page.mouse.down();
  await page.mouse.move(box.x+140,box.y+box.height*.8,{steps:6});
  await page.mouse.up();
  const dragged=await waitForProject(page,project=>volumePoints(project)[0]?.value<pointBefore.value-0.1,'el punto se arrastra');
  expect(volumePoints(dragged)[0].time).toBeGreaterThan(pointBefore.time);

  // El clic derecho lo quita (el punto quedó donde terminó el arrastre).
  const after=volumePoints(await autosave(page))[0];
  await page.mouse.click(box.x+140,box.y+box.height*(1-after.value/2),{button:'right'});
  await waitForProject(page,project=>volumePoints(project).length===0,'el punto se quita');
});

test('Tomas de audio: se añaden a la pista y al bus, se ajustan, se ordenan y se apagan',async({page})=>{
  await requireMediaApis(page,['AudioDecoder','AudioContext']);
  await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Audio.wav')]);
  await expect(page.locator('.media-item')).toHaveCount(1,{timeout:60000});
  await page.locator('.media-item').filter({hasText:'Audio.wav'}).dblclick();
  await waitForVisualEvent(page,event=>event.kind==='audio','el audio entra en la línea de tiempo');
  await page.getByRole('button',{name:'Mezclador',exact:true}).click();
  const mixer=page.locator('.mixer');
  await expect(mixer).toBeVisible();

  // El rack de la pista arranca vacío y el catálogo trae las ocho tomas.
  const trackRack=mixer.locator('.mixer-strip.track .insert-rack').first();
  await trackRack.locator('summary').click();
  await expect(trackRack.getByLabel('Toma nueva para Audio')).toHaveValue('eq');
  const options=await trackRack.getByLabel('Toma nueva para Audio').locator('option').allTextContents();
  expect(options.length).toBe(8);
  expect(options).toContain('Ecualizador de 3 bandas');
  expect(options).toContain('Limitador');

  // Añadir un compresor y ajustarle el umbral.
  await trackRack.getByLabel('Toma nueva para Audio').selectOption('compressor');
  await trackRack.getByRole('button',{name:'Añadir toma a Audio'}).click();
  const withInsert=await waitForProject(page,project=>insertsOf(project,'track').length===1,'la toma llega al proyecto');
  expect(insertsOf(withInsert,'track')[0].kind).toBe('compressor');
  expect(insertsOf(withInsert,'track')[0].enabled).toBe(true);
  await trackRack.getByLabel('Umbral (dB) de Compresor en Audio').fill('-24');
  const tuned=await waitForProject(page,project=>insertsOf(project,'track')[0]?.threshold===-24,'el umbral llega al modelo');
  expect(insertsOf(tuned,'track')[0].threshold).toBe(-24);

  // Una segunda toma se coloca detrás y se puede subir: el orden importa porque se procesan en cadena.
  await trackRack.getByLabel('Toma nueva para Audio').selectOption('delay');
  await trackRack.getByRole('button',{name:'Añadir toma a Audio'}).click();
  await waitForProject(page,project=>insertsOf(project,'track').length===2,'la segunda toma entra');
  expect(insertsOf(await autosave(page),'track').map(effect=>effect.kind)).toEqual(['compressor','delay']);
  await trackRack.getByRole('button',{name:'Subir Retardo de Audio'}).click();
  const reordered=await waitForProject(page,project=>insertsOf(project,'track')[0]?.kind==='delay','el orden cambia');
  expect(insertsOf(reordered,'track').map(effect=>effect.kind)).toEqual(['delay','compressor']);

  // Apagar una toma la deja en la lista pero fuera de la cadena.
  await trackRack.getByRole('button',{name:'Apagar Compresor de Audio'}).click();
  const disabled=await waitForProject(page,project=>insertsOf(project,'track').some(effect=>effect.enabled===false),'la toma se apaga');
  expect(insertsOf(disabled,'track').find(effect=>effect.kind==='compressor')!.enabled).toBe(false);

  // Y el bus tiene su propio rack.
  await mixer.getByRole('button',{name:'Añadir bus'}).click();
  await waitForProject(page,project=>((project.buses??[]) as unknown[]).length===1,'el bus se añade');
  const busRack=mixer.locator('.mixer-strip.bus .insert-rack').first();
  await busRack.locator('summary').click();
  await busRack.getByLabel('Toma nueva para Bus A').selectOption('limiter');
  await busRack.getByRole('button',{name:'Añadir toma a Bus A'}).click();
  const busInsert=await waitForProject(page,project=>insertsOf(project,'bus').length===1,'la toma del bus llega al proyecto');
  expect(insertsOf(busInsert,'bus')[0].kind).toBe('limiter');
  expect(insertsOf(busInsert,'bus')[0].threshold).toBe(-1);

  // Quitar una toma de la pista la deja fuera.
  await trackRack.getByRole('button',{name:'Quitar Retardo de Audio'}).click();
  const removed=await waitForProject(page,project=>insertsOf(project,'track').length===1,'la toma se quita');
  expect(insertsOf(removed,'track').map(effect=>effect.kind)).toEqual(['compressor']);
  await mixer.getByRole('button',{name:'Cerrar'}).click();

  // Y todo sobrevive a recargar la página.
  await page.reload();
  await expect.poll(async()=>insertsOf(await autosave(page),'track').length,{message:'las tomas se guardan',timeout:20000}).toBe(1);
});

test('Medidores calibrados: el pico llega a la barra y la sonoridad se informa en LUFS',async({page})=>{
  const missing=await page.evaluate(()=>['AudioDecoder','AudioContext'].filter(name=>typeof (globalThis as Record<string,unknown>)[name]==='undefined'));
  test.skip(missing.length>0,`El motor no expone: ${missing.join(', ')}.`);
  await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Audio.wav')]);
  await expect(page.locator('.media-item')).toHaveCount(1,{timeout:60000});
  await page.locator('.media-item').filter({hasText:'Audio.wav'}).dblclick();
  await waitForVisualEvent(page,event=>event.kind==='audio','el audio entra en la línea de tiempo');

  // Los medidores existen, tienen las dos barras y arrancan en silencio.
  const meters=page.locator('.meters');
  await expect(meters).toBeVisible();
  await expect(meters.locator('.meter-bar')).toHaveCount(2);
  await expect(meters.locator('.clip-light')).toHaveText('OK');
  await expect(meters.getByText(/Pico −∞ dBFS/)).toBeVisible();
  await expect(meters.getByText(/LUFS/)).toBeVisible();
  await expect(meters.getByText(/BS\.1770/)).toBeVisible();

  // Al reproducir, la barra crece y aparece una medición numérica real.
  await page.locator('.bottom-toolbar .transport').getByRole('button',{name:'Ir al inicio',exact:true}).click();
  await page.locator('.preview-transport').getByRole('button',{name:'Reproducir',exact:true}).click();
  await expect.poll(async()=>page.evaluate(()=>{
    const bar=document.querySelector('.meters .meter-bar i') as HTMLElement|null;
    return bar?parseFloat(bar.style.height):0;
  }),{message:'la barra del medidor sube al reproducir',timeout:20000}).toBeGreaterThan(1);
  const reading=await meters.locator('small').first().textContent();
  expect(reading).toMatch(/Pico -?\d/);
  expect(reading).toMatch(/LUFS/);
  await page.locator('.preview-transport').getByRole('button',{name:'Pausa',exact:true}).click();
  // Al pausar, los medidores vuelven al silencio.
  await expect.poll(async()=>page.evaluate(()=>{
    const bar=document.querySelector('.meters .meter-bar i') as HTMLElement|null;
    return bar?parseFloat(bar.style.height):0;
  }),{message:'la barra vuelve a cero al pausar',timeout:20000}).toBe(0);
  await expect(meters.getByText(/Pico −∞ dBFS/)).toBeVisible();
});

test('Trimmer: marcar entrada y salida, e insertar o sobrescribir en el cursor',async({page})=>{
  await requireMediaApis(page);
  await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Video_A.mp4')]);
  await expect(page.locator('.media-item')).toHaveCount(1,{timeout:60000});
  await page.locator('.media-item').filter({hasText:'Video_A.mp4'}).click();
  await page.getByRole('button',{name:'Abrir el trimmer del medio seleccionado'}).click();
  const trimmer=page.locator('.trimmer');
  await expect(trimmer).toBeVisible();

  // Se marca el tramo y se inserta en el cursor (que está al principio).
  await trimmer.getByLabel('Entrada (s)').fill('0.2');
  await trimmer.getByLabel('Salida (s)').fill('0.8');
  await trimmer.getByRole('button',{name:'Insertar en el cursor'}).click();
  const inserted=await waitForProject(page,project=>(project.events??[]).some((event:Record<string,unknown>)=>event.kind==='video'),'el clip entra en la línea de tiempo');
  const first=(inserted.events??[]).find((event:Record<string,unknown>)=>event.kind==='video') as {start:number;duration:number;offset:number};
  expect(first.duration/705600000).toBeCloseTo(.6,2);
  expect(first.offset/705600000).toBeCloseTo(.2,2);
  expect(first.start).toBe(0);

  // Y ahora se sobrescribe otro tramo encima: el anterior se recorta y no se solapan.
  await page.locator('.media-item').filter({hasText:'Video_A.mp4'}).click();
  await page.getByRole('button',{name:'Abrir el trimmer del medio seleccionado'}).click();
  await trimmer.getByLabel('Entrada (s)').fill('0');
  await trimmer.getByLabel('Salida (s)').fill('0.3');
  await trimmer.getByRole('button',{name:'Sobrescribir en el cursor'}).click();
  const overwritten=await waitForProject(page,project=>(project.events??[]).filter((event:Record<string,unknown>)=>event.kind==='video').length===2,'el segundo tramo entra');
  const clips=(overwritten.events??[]).filter((event:Record<string,unknown>)=>event.kind==='video') as {start:number;duration:number}[];
  const sorted=clips.sort((a,b)=>a.start-b.start);
  expect(sorted[0].duration/705600000).toBeCloseTo(.3,2);
  expect(sorted[1].start/705600000).toBeCloseTo(.3,2);
  expect(sorted[1].duration/705600000).toBeCloseTo(.3,2);
  expect(Math.max(...sorted.map(clip=>clip.start+clip.duration))).toBeLessThanOrEqual(first.start+first.duration+1);
});

test('El zoom se ancla en la aguja: al acercar y alejar, la aguja no se mueve de su sitio en pantalla',async({page})=>{
  await page.locator('.ruler').click({position:{x:320,y:30}});
  const playhead=page.locator('.playhead');
  const before=(await playhead.boundingBox())!;
  expect(before.x,'la aguja se colocó donde se hizo clic').toBeGreaterThan(250);
  const width=()=>page.locator('.timeline-content').evaluate(node=>node.getBoundingClientRect().width);
  const start=await width();

  await page.locator('.timeline-scroll').hover();
  await page.mouse.wheel(0,-400);
  await page.waitForTimeout(300);
  expect(await width()).toBeGreaterThan(start*1.2);
  expect(Math.abs((await playhead.boundingBox())!.x-before.x),'acercar no mueve la aguja').toBeLessThan(2);

  await page.mouse.wheel(0,200);
  await page.waitForTimeout(300);
  expect(Math.abs((await playhead.boundingBox())!.x-before.x),'alejar tampoco').toBeLessThan(2);

  // Al alejar del todo ya no hay margen a la izquierda: la aguja se queda en el principio del contenido,
  // que es lo más a la izquierda que se puede llegar.
  await page.mouse.wheel(0,900);
  await page.waitForTimeout(300);
  const far=(await playhead.boundingBox())!;
  expect(far.x).toBeLessThanOrEqual(before.x+2);
  expect(far.x).toBeGreaterThan(0);
});

test('Subtítulos: un .srt se importa, se coloca en la línea de tiempo y se ve en el monitor',async({page})=>{
  await page.locator('input[type=file]').nth(0).setInputFiles([fixture('subtitulos-prueba.srt')]);
  await expect(page.locator('.media-item')).toHaveCount(1,{timeout:60000});
  await page.locator('.media-item').filter({hasText:'subtitulos-prueba.srt'}).dblclick();
  const project=await waitForProject(page,project=>(project.events??[]).filter((event:Record<string,unknown>)=>event.kind==='text').length===2,'los subtítulos llegan a la línea de tiempo');
  const events=(project.events??[]).filter((event:Record<string,unknown>)=>event.kind==='text') as {text:string;outlineWidth?:number;transform:{y:number}}[];
  expect(String(events[0].text)).toContain('subtítulo de prueba');
  expect(Number(events[0].outlineWidth),'llevan contorno para leerse sobre cualquier imagen').toBeGreaterThan(0);
  expect(Number(events[0].transform.y),'y van en el tercio inferior').toBeGreaterThan(0);

  // Y se ven de verdad en el monitor: texto blanco en la mitad inferior del fotograma.
  const seen=await page.locator('.monitor canvas').evaluate(node=>{
    const canvas=node as HTMLCanvasElement;
    const data=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;
    let white=0,lowest=0;
    for(let row=0;row<canvas.height;row++)for(let column=0;column<canvas.width;column++){
      const index=(row*canvas.width+column)*4;
      if(data[index]>230&&data[index+1]>230&&data[index+2]>230){white++;lowest=Math.max(lowest,row);}
    }
    return {white,lowest,height:canvas.height};
  });
  expect(seen.white,'el subtítulo se pinta en el monitor').toBeGreaterThan(0);
  expect(seen.lowest,'y cae en la mitad inferior').toBeGreaterThan(seen.height/2);
});

test('Máscara libre: se dibuja sobre el monitor, se invierte, se le da pluma y se quitan puntos',async({page})=>{
  await createTitle(page);
  await page.getByRole('button',{name:/Abrir la ventana de Panoramización y recorte/}).click();
  const window=page.locator('.pan-crop-window');
  // Los grupos del árbol de parámetros son plegables, como los de VEGAS: se abre el de la máscara.
  await window.locator('.param-group').filter({has:page.locator('.param-group-name',{hasText:'Máscara libre'})}).locator('.param-group-title').click();
  await window.getByRole('button',{name:'Dibujar máscara'}).click();
  const stage=window.locator('.pan-crop-stage');
  await stage.scrollIntoViewIfNeeded();
  const box=(await stage.boundingBox())!;
  // El monitor enseña el fotograma con un margen alrededor, así que una fracción del lienzo no es la misma
  // fracción del fotograma: se calcula el punto dentro del fotograma con los datos que publica el lienzo.
  const geometry=await stage.evaluate((node:HTMLCanvasElement)=>({margin:Number(node.dataset.margin),frameWidth:Number(node.dataset.frameWidth),frameHeight:Number(node.dataset.frameHeight),width:node.width,height:node.height}));
  const scale=box.width/geometry.width;
  const atFrame=(fx:number,fy:number)=>({x:box.x+(geometry.margin+geometry.frameWidth*fx)*scale,y:box.y+(geometry.margin+geometry.frameHeight*fy)*scale});

  // Tres clics dibujan un triángulo en la esquina superior izquierda del fotograma.
  for(const [fx,fy] of [[.1,.1],[.45,.1],[.1,.45]]){const spot=atFrame(fx,fy);await page.mouse.click(spot.x,spot.y);}
  const drawn=await waitForTitle(page,event=>((event.maskPath as {points?:unknown[]})?.points?.length??0)===3,'los tres puntos de la máscara llegan al modelo');
  const points=(drawn.maskPath as {points:{x:number;y:number}[]}).points;
  expect(points.length).toBe(3);
  expect(Math.round(points[0].x*100)).toBe(10);
  expect(Math.round(points[0].y*100)).toBe(10);
  expect(Math.round(points[1].x*100)).toBe(45);

  // Invertir y pluma se guardan en el evento.
  await window.getByRole('button',{name:'Invertir'}).click();
  const inverted=await waitForTitle(page,event=>(event.maskPath as {invert?:boolean})?.invert===true,'la inversión llega al modelo');
  expect((inverted.maskPath as {invert:boolean}).invert).toBe(true);
  await window.getByLabel('Pluma (px)').fill('8');
  const feathered=await waitForTitle(page,event=>(event.maskPath as {feather?:number})?.feather===8,'la pluma llega al modelo');
  expect((feathered.maskPath as {feather:number}).feather).toBe(8);

  // El clic derecho quita un punto y el botón «Vaciar» los quita todos. Se vuelve a medir el lienzo porque
  // rellenar un campo puede haber desplazado el diálogo.
  await stage.scrollIntoViewIfNeeded();
  const again=(await stage.boundingBox())!;
  const spot=atFrame(.1,.1);
  await page.mouse.click(again.x+(spot.x-box.x),again.y+(spot.y-box.y),{button:'right'});
  await waitForTitle(page,event=>((event.maskPath as {points?:unknown[]})?.points?.length??0)===2,'el punto se quita con el clic derecho');
  await window.getByRole('button',{name:'Vaciar'}).click();
  await waitForTitle(page,event=>((event.maskPath as {points?:unknown[]})?.points?.length??0)===0,'la máscara se vacía');
});

test('Movimiento 3D: los giros y la distancia llegan al modelo y sobreviven a recargar',async({page})=>{
  await createTitle(page);
  await page.getByRole('button',{name:/Abrir la ventana de Panoramización y recorte/}).click();
  const window=page.locator('.pan-crop-window');
  await expect(window.getByText('Movimiento 3D')).toBeVisible();

  // Los tres campos del «Movimiento de pista 3D» se escriben y llegan al evento autoguardado.
  await window.getByLabel('Rotación X (°)').fill('15');
  const pitched=await waitForTitle(page,event=>Number((event.transform as {rotationX?:number}).rotationX)===15,'el giro sobre X llega al modelo');
  expect((pitched.transform as {rotationX:number}).rotationX).toBe(15);
  await window.getByLabel('Rotación Y (°)').fill('40');
  const yawed=await waitForTitle(page,event=>Number((event.transform as {rotationY?:number}).rotationY)===40,'el giro sobre Y llega al modelo');
  expect((yawed.transform as {rotationY:number}).rotationY).toBe(40);
  await window.getByLabel('Distancia').fill('0.8');
  const near=await waitForTitle(page,event=>Math.abs(Number((event.transform as {depth?:number}).depth)-.8)<1e-6,'la distancia llega al modelo');
  expect((near.transform as {depth:number}).depth).toBeCloseTo(.8,6);

  // Con el giro activo, el monitor sigue pintando (la proyección no rompe el render).
  const stage=window.locator('.pan-crop-stage');
  await stage.scrollIntoViewIfNeeded();
  await expect.poll(async()=>page.evaluate(()=>{
    const canvas=document.querySelector('.pan-crop-stage') as HTMLCanvasElement | null;
    if(!canvas)return 0;
    const context=canvas.getContext('2d');
    if(!context)return 0;
    const data=context.getImageData(0,0,canvas.width,canvas.height).data;
    let lit=0;
    for(let index=0;index<data.length;index+=4)if(data[index]>40||data[index+1]>40||data[index+2]>40)lit++;
    return lit;
  }),{message:'el monitor pinta el plano girado',timeout:20000}).toBeGreaterThan(1000);

  // El gesto de girar con el ratón escribe en el modelo. Se mide el lienzo otra vez porque rellenar los
  // campos puede haber desplazado el diálogo.
  await window.getByRole('button',{name:'Girar con el ratón'}).click();
  await expect(window.getByRole('button',{name:'Terminar de girar'})).toBeVisible();
  await stage.scrollIntoViewIfNeeded();
  const box=(await stage.boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+80,box.y+box.height/2+30,{steps:10});
  await page.mouse.up();
  const dragged=await waitForTitle(page,event=>Number((event.transform as {rotationY?:number}).rotationY)!==40,'el arrastre gira el plano');
  expect((dragged.transform as {rotationY:number}).rotationY).toBeGreaterThan(40);

  // «Quitar 3D» devuelve la pose al neutro y al recargar la página los valores siguen ahí.
  await window.getByRole('button',{name:'Quitar 3D'}).click();
  const cleared=await waitForTitle(page,event=>Number((event.transform as {rotationY?:number}).rotationY)===0,'quitar 3D vuelve al neutro');
  expect((cleared.transform as {rotationX:number}).rotationX).toBe(0);
  expect((cleared.transform as {depth:number}).depth).toBe(1);
  await window.getByLabel('Rotación Y (°)').fill('25');
  await waitForTitle(page,event=>Number((event.transform as {rotationY?:number}).rotationY)===25,'el giro vuelve a guardarse');
  await page.reload();
  await expect.poll(async()=>{const event=await titleOf(page);return event?Number((event.transform as {rotationY?:number}).rotationY):-1;},{message:'el giro sobrevive a recargar',timeout:20000}).toBe(25);
});

// La vista previa también redimensiona: la caja del evento seleccionado tiene ocho asas y se arrastra sin
// abrir ninguna ventana. La geometría es la misma que la de la ventana de Panoramización y recorte.
test('La vista previa redimensiona el recurso seleccionado: mover, escalar y recortar con Alt',async({page})=>{
  await requireMediaApis(page);
  await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Video_A.mp4')]);
  await expect(page.locator('.media-item')).toHaveCount(1,{timeout:60000});
  await page.locator('.media-item').filter({hasText:'Video_A.mp4'}).dblclick();
  const clip=page.locator('.timeline-event.video').first();
  await expect(clip).toBeVisible();
  const saved=async()=>((await autosave(page)).events??[]).find(event=>event.kind==='video') as Record<string,unknown>|undefined;
  await expect.poll(async()=>Boolean(await saved()),{message:'el clip llega al autoguardado',timeout:20000}).toBe(true);

  // Con el clip seleccionado (al insertarlo queda seleccionado) aparece la caja con sus ocho asas.
  const box=page.locator('.preview-box');
  await expect(box).toBeVisible();
  await expect(page.locator('.preview-handle')).toHaveCount(8);
  await expect(page.locator('.preview-badge')).toContainText('100 %');
  await expect(box).toHaveAttribute('data-label','Video_A.mp4');
  // Al deseleccionar, la caja desaparece: no estorba cuando solo se mira el monitor.
  await page.locator('.track-lane').first().click({position:{x:900,y:30}});
  await expect(box).toHaveCount(0);
  await clip.click();
  await expect(box).toBeVisible();

  // Arrastrar el asa inferior derecha escala: el asa contraria (arriba a la izquierda) se queda quieta.
  const before=(await box.boundingBox())!;
  const dragHandle=async(selector:string,dx:number,dy:number,modifiers:string[]=[])=>{
    const handle=(await page.locator(selector).boundingBox())!;
    const startX=handle.x+handle.width/2,startY=handle.y+handle.height/2;
    for(const key of modifiers)await page.keyboard.down(key);
    await page.mouse.move(startX,startY);
    await page.mouse.down();
    for(let step=1;step<=8;step++){await page.mouse.move(startX+dx*step/8,startY+dy*step/8);await page.waitForTimeout(20);}
    await page.mouse.up();
    for(const key of modifiers)await page.keyboard.up(key);
  };
  await dragHandle('.preview-handle.se',70,45);
  await expect.poll(async()=>Number((await saved())?.transform&&((await saved())!.transform as {scale:number}).scale),{message:'la escala llega al modelo',timeout:20000}).toBeGreaterThan(1.05);
  const scaled=(await box.boundingBox())!;
  expect(scaled.width,`la caja creció (${before.width} → ${scaled.width})`).toBeGreaterThan(before.width+20);
  expect(Math.abs(scaled.x-before.x),'el asa contraria se queda quieta').toBeLessThan(4);
  expect(Math.abs(scaled.y-before.y)).toBeLessThan(4);
  await expect(page.getByRole('status').first()).toContainText('Escala de «Video_A.mp4»');
  await page.waitForTimeout(300);
  if(test.info().project.name==='chrome')await page.screenshot({path:path.resolve('evidencias','vista-previa-redimensionar.png')});

  // Arrastrar dentro de la caja mueve el encuadre.
  const center=(await box.boundingBox())!;
  await page.mouse.move(center.x+center.width/2,center.y+center.height/2);
  await page.mouse.down();
  for(let step=1;step<=6;step++){await page.mouse.move(center.x+center.width/2+step*6,center.y+center.height/2+step*3);await page.waitForTimeout(20);}
  await page.mouse.up();
  await expect.poll(async()=>Number(((await saved())!.transform as {x:number}).x),{message:'el movimiento llega al modelo',timeout:20000}).toBeGreaterThan(.01);

  // El modo «recortar» de la caja recorta ese lado en lugar de escalar (Alt hace lo mismo sin cambiar de modo).
  const scaleBeforeCrop=Number(((await saved())!.transform as {scale:number}).scale);
  await page.getByRole('button',{name:'Recortar con las asas'}).click();
  await dragHandle('.preview-handle.w',45,0);
  await expect.poll(async()=>Number(((await saved())!.mask as {left?:number}|undefined)?.left??0),{message:'el recorte llega al modelo',timeout:20000}).toBeGreaterThan(.02);
  const cropped=await saved();
  expect(Number((cropped!.transform as {scale:number}).scale)).toBeCloseTo(scaleBeforeCrop,3);
  await expect(page.getByRole('status').first()).toContainText('Recorte de «Video_A.mp4»');
  await page.getByRole('button',{name:'Redimensionar con las asas'}).click();

  // Con fotogramas clave, el arrastre escribe en la clave del cursor y no en la pose fija. Se restablece el
  // encuadre antes para que la caja vuelva al centro y sus asas queden dentro de la ventana.
  await clip.dblclick();
  await page.getByRole('button',{name:/Abrir la ventana de Panoramización y recorte/}).click();
  await page.getByRole('button',{name:'Restablecer encuadre'}).click();
  await page.getByRole('button',{name:'Añadir clave aquí'}).click();
  await expect.poll(async()=>(((await saved())!.keys as unknown[])??[]).length,{message:'la clave se guarda',timeout:20000}).toBe(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const fixedScale=Number(((await saved())!.transform as {scale:number}).scale);
  expect(Number(((await saved())!.keys as {scale:number}[])[0].scale)).toBeCloseTo(fixedScale,3);
  await dragHandle('.preview-handle.se',40,25);
  await expect.poll(async()=>Number(((await saved())!.keys as {scale:number}[])[0]?.scale),{message:'el arrastre se guarda en la clave',timeout:20000}).toBeGreaterThan(fixedScale+.03);
  expect(Number(((await saved())!.transform as {scale:number}).scale)).toBeCloseTo(fixedScale,3);
});
// Copiar los atributos de un clip y pegarlos en otro es el «Copiar/Pegar atributos de evento» de VEGAS: llega
// el aspecto (efectos, plantilla, encuadre, color, fundidos…), no el material ni los tiempos.
test('Copiar y pegar atributos: los efectos y el estilo de un clip pasan a otro, y se puede elegir qué grupos',async({page})=>{
  await requireMediaApis(page);
  await page.locator('input[type=file]').nth(0).setInputFiles([fixture('Video_A.mp4'),fixture('Video_B.mp4')]);
  await expect(page.locator('.media-item')).toHaveCount(2,{timeout:60000});
  await page.locator('.media-item').filter({hasText:'Video_A.mp4'}).dblclick();
  await page.locator('.bottom-toolbar .transport').getByRole('button',{name:'Ir al final',exact:true}).click();
  await page.locator('.media-item').filter({hasText:'Video_B.mp4'}).dblclick();
  const clips=page.locator('.timeline-event.video');
  await expect(clips).toHaveCount(2);
  const saved=async()=>((await autosave(page)).events??[]).filter(event=>event.kind==='video');
  await expect.poll(async()=>(await saved()).length,{message:'los dos clips llegan al autoguardado',timeout:20000}).toBe(2);
  const first=(await saved())[0].id as string;
  const second=(await saved())[1].id as string;

  // Al primero se le pone un efecto (desde la pestaña de efectos) y un encuadre distinto.
  await clips.first().click();
  await page.getByRole('tab',{name:'Efectos de video',exact:true}).click();
  await page.getByRole('button',{name:'Desenfoque gaussiano',exact:true}).click();
  await expect(page.locator('.effects-window')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(async()=>((await saved()).find(event=>event.id===first)?.effects as unknown[]|undefined)?.length,{message:'el efecto llega al primer clip',timeout:20000}).toBe(1);
  await clips.first().click({button:'right'});
  await page.getByRole('menu').getByRole('menuitem',{name:'Panoramización/recorte de evento de vídeo...'}).click();
  await page.getByLabel('Anchura (px)').fill('3840');
  await page.getByLabel('Centro X (px)').fill('1160');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Copiar del primero y pegar en el segundo con el menú del clic derecho.
  await clips.first().click({button:'right'});
  await page.getByRole('menu').getByRole('menuitem',{name:'Copiar',exact:true}).click();
  await expect(page.getByRole('status').first()).toContainText('Eventos copiados');
  await clips.nth(1).click({button:'right'});
  const menu=page.getByRole('menu');
  await expect(menu.getByRole('menuitem',{name:'Pegar atributos de evento',exact:true})).toBeEnabled();
  await menu.getByRole('menuitem',{name:'Pegar atributos de evento',exact:true}).click();
  await expect.poll(async()=>{
    const event=(await saved()).find(item=>item.id===second);
    return JSON.stringify({effects:(event?.effects as unknown[]|undefined)?.length??0,scale:Number((event?.transform as {scale?:number})?.scale),x:Number((event?.transform as {x?:number})?.x)});
  },{message:'los atributos llegan al segundo clip',timeout:20000}).toBe(JSON.stringify({effects:1,scale:2,x:200/1920}));
  const source=(await saved()).find(event=>event.id===first)!;
  const target=(await saved()).find(event=>event.id===second)!;
  expect(target.brightness).toBe(source.brightness);
  // El material y los tiempos del destino no se tocan.
  expect(target.mediaId).not.toBe(source.mediaId);
  expect(target.start).not.toBe(source.start);
  await expect(page.getByRole('status').first()).toContainText('Atributos pegados en «Video_B.mp4»');

  // El diálogo deja elegir los grupos: se copia otra vez del primero y se pega solo los efectos en un tercer
  // clip, que debe quedarse con su encuadre neutro y quedarse con el efecto.
  await page.locator('.bottom-toolbar .transport').getByRole('button',{name:'Ir al final',exact:true}).click();
  await page.getByRole('tab',{name:'Medios de proyecto',exact:true}).click();
  await page.locator('.media-item').filter({hasText:'Video_A.mp4'}).dblclick();
  await expect(clips).toHaveCount(3);
  await expect.poll(async()=>(await saved()).length,{message:'el tercer clip llega al autoguardado',timeout:20000}).toBe(3);
  const third=(await saved())[2].id as string;
  await clips.first().click({button:'right'});
  await page.getByRole('menu').getByRole('menuitem',{name:'Copiar',exact:true}).click();
  await clips.nth(2).click({button:'right'});
  await page.getByRole('menu').getByRole('menuitem',{name:'Pegado selectivo de atributos de evento'}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toContainText('Atributos copiados de');
  // El diálogo entra con una animación de 200 ms: se espera a que esté asentado antes de la captura.
  await page.waitForTimeout(400);
  if(test.info().project.name==='chrome')await page.screenshot({path:path.resolve('evidencias','pegado-atributos.png')});
  // Los grupos que la fuente no tenía salen desactivados y lo dicen.
  await expect(dialog.locator('.check.disabled').first()).toContainText('El evento copiado no tenía esto.');
  for(const label of ['Panoramización y recorte','Color y correcciones','Fundidos de entrada y salida','Velocidad'])await dialog.getByLabel(label).uncheck();
  await expect(dialog.getByLabel('Panoramización y recorte')).not.toBeChecked();
  await dialog.getByRole('button',{name:/^Pegar 1 grupo/}).click();
  await expect.poll(async()=>((await saved()).find(item=>item.id===third)?.effects as unknown[]|undefined)?.length??0,{message:'el efecto llega al tercer clip',timeout:20000}).toBe(1);
  const onlyEffects=(await saved()).find(event=>event.id===third)!;
  expect((onlyEffects.effects as unknown[]).length).toBe(1);
  // Y el encuadre del tercero sigue neutro: solo se pegó el grupo de los efectos.
  expect(Number((onlyEffects.transform as {scale:number}).scale)).toBe(1);
  expect(Number((onlyEffects.transform as {x:number}).x)).toBe(0);
  await expect(page.getByRole('status').first()).toContainText('Atributos pegados en');
});
