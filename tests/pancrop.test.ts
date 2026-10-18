// Pruebas de panoramización y recorte: geometría pura, sin lienzo ni navegador.
//
// Lo que se comprueba aquí es que el recorte de cuatro lados generaliza el recorte uniforme anterior (los
// proyectos que ya existían se siguen colocando igual), que los tiradores hacen lo que se espera y que las
// claves de recorte se interpolan.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HANDLES,boxCorners,contentBox,cropToAspect,cropZoomPose,dragCropSelection,dragHandle,fittedBox,frameBox,handleAt,handlePoint,isCornerHandle,keyAt,keysChanging,maskAt,maskOf,moveKey,normalizeMask,noCrop,poseMatrix,removeKey,resetPose,sourceRect,toLocal,toLocalDelta,upsertKey,applyMatrix} from '../lib/editor/pancrop';
import {Transform,ticks,transform as newTransform,pose,newEvent,CropMask} from '../lib/editor/project';

const close=(actual:number,expected:number,tolerance=1e-6)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} no está cerca de ${expected}`);
const square={width:100,height:100};

test('recorte: sin máscara se usan los cuatro márgenes del recorte uniforme de siempre',()=>{
 const event={transform:{...newTransform(),crop:.2}};
 assert.deepEqual(maskOf(event),{left:.2,right:.2,top:.2,bottom:.2});
 assert.deepEqual(maskOf({transform:newTransform()}),{left:0,right:0,top:0,bottom:0});
 assert.deepEqual(maskOf({transform:newTransform(),mask:{left:.1,right:0,top:.05,bottom:0}}),{left:.1,right:0,top:.05,bottom:0});
});

test('recorte: los márgenes se limitan y ningún par puede tapar el fotograma entero',()=>{
 assert.deepEqual(normalizeMask({left:2,right:-1,top:.3,bottom:.3}),{left:.45,right:0,top:.3,bottom:.3});
 assert.deepEqual(normalizeMask({left:.5,right:.5,top:.5,bottom:.5}),{left:.45,right:.45,top:.45,bottom:.45});
 assert.deepEqual(normalizeMask(undefined),noCrop());
 assert.deepEqual(normalizeMask({left:Number.NaN,right:.1}),{left:0,right:.1,top:0,bottom:0});
});

test('preestablecidos de recorte: se recorta por los lados largos y queda la relación pedida',()=>{
 // Un fotograma 16:9 recortado a 4:3 pierde (1 - (4/3)/(16/9))/2 = 12,5 % por cada lado.
 const wide=cropToAspect({width:1920,height:1080},4/3)!;
 assert.deepEqual(wide,{left:.125,right:.125,top:0,bottom:0});
 close((1920*(1-wide.left-wide.right))/(1080*(1-wide.top-wide.bottom)),4/3,1e-9);
 // A 1:1 se conserva 9/16 del ancho: 7/32 = 21,875 % por cada lado.
 const squareCrop=cropToAspect({width:1920,height:1080},1)!;
 assert.deepEqual(squareCrop,{left:.21875,right:.21875,top:0,bottom:0});
 close((1920*(1-squareCrop.left-squareCrop.right))/(1080*(1-squareCrop.top-squareCrop.bottom)),1,1e-9);
 // Un encuadre vertical recorta arriba y abajo, no a los lados, y la relación sale exacta.
 const tall=cropToAspect({width:1080,height:1920},16/9)!;
 assert.deepEqual(tall,{left:0,right:0,top:.341796875,bottom:.341796875});
 close((1080*(1-tall.left-tall.right))/(1920*(1-tall.top-tall.bottom)),16/9,1e-9);
 // Si ya tiene la relación pedida no hay nada que recortar, y sin medidas tampoco se inventa nada.
 assert.equal(cropToAspect({width:1920,height:1080},16/9),null);
 assert.equal(cropToAspect({width:0,height:0},1),null);
 assert.equal(cropToAspect({width:1920,height:1080},0),null);
});

test('geometría: el medio se ajusta al fotograma, se centra y luego se recorta en su sitio',()=>{
 assert.deepEqual(fittedBox(square,{width:100,height:100}),{x:0,y:0,width:100,height:100});
 // Un medio 2:1 dentro de un fotograma cuadrado se ajusta por el ancho y queda con bandas arriba y abajo.
 assert.deepEqual(fittedBox(square,{width:200,height:100}),{x:0,y:25,width:100,height:50});
 assert.deepEqual(contentBox(square,square,noCrop()),{x:0,y:0,width:100,height:100});
 assert.deepEqual(contentBox(square,square,{left:.25,right:.25,top:.25,bottom:.25}),{x:25,y:25,width:50,height:50});
 assert.deepEqual(contentBox(square,square,{left:.1,right:.2,top:0,bottom:.4}),{x:10,y:0,width:70,height:60});
 assert.deepEqual(contentBox(square,{width:200,height:100},{left:.25,right:.25,top:.5,bottom:0}),{x:25,y:50,width:50,height:25});
 assert.deepEqual(sourceRect({width:200,height:100},{left:.1,right:.2,top:.05,bottom:.15}),{x:20,y:5,width:140,height:80});
 // Un evento de texto o color ocupa el fotograma entero.
 assert.deepEqual(frameBox({left:.1,right:.1,top:0,bottom:.5}),{x:.1,y:0,width:.8,height:.5});
});

test('recorte: se aplica en el sitio, y la escala sigue siendo el zoom (cambio documentado)',()=>{
 // El compositor anterior, al recortar, estiraba lo recortado hasta llenar el fotograma: recortar un 25 %
 // hacía además un zoom de 2×. Ahora el recorte deja el medio donde está y los cuatro lados son
 // independientes; el zoom se hace con la escala, como en VEGAS.
 const cropped=contentBox(square,square,{left:.25,right:.25,top:.25,bottom:.25});
 assert.deepEqual(cropped,{x:25,y:25,width:50,height:50});
 assert.notDeepEqual(cropped,{x:0,y:0,width:100,height:100});   // lo que hacía el compositor anterior
 // Con escala 1/(1-2c) = 2 el encuadre vuelve a llenar el fotograma, igual que antes.
 const filled=boxCorners(cropped,square,{...newTransform(),scale:2});
 assert.ok(filled[0].x<=0&&filled[0].y<=0&&filled[2].x>=100&&filled[2].y>=100);
 // Un medio cuya proporción no es la del fotograma se ajusta primero (2:1 en un cuadrado: 100×50 centrado)
 // y el recorte se aplica sobre esa colocación, conservando la proporción.
 const wide=contentBox(square,{width:200,height:100},{left:.1,right:.1,top:.2,bottom:.2});
 close(wide.x,10);close(wide.y,25+50*.2);close(wide.width,80);close(wide.height,30);
 close(wide.width/(200*.8),wide.height/(100*.6));   // un solo factor: el medio no se deforma
});

test('tiradores: mover desplaza y los bordes recortan el lado que se arrastra',()=>{
 const pose:{x:number;y:number;scale:number;rotation:number;opacity:number;crop:number}=newTransform();
 const moved=dragHandle({frame:square,source:square,pose,mask:noCrop(),handle:'move',delta:{x:10,y:-10}});
 close(moved.pose.x,.1);close(moved.pose.y,-.1);
 close(moved.pose.scale,1);
 const west=dragHandle({frame:square,source:square,pose,mask:noCrop(),handle:'w',delta:{x:20,y:0}});
 close(west.mask.left,.2);close(west.mask.right,0);
 const east=dragHandle({frame:square,source:square,pose,mask:noCrop(),handle:'e',delta:{x:-30,y:0}});
 close(east.mask.right,.3);close(east.mask.left,0);
 const corner=dragHandle({frame:square,source:square,pose,mask:noCrop(),handle:'nw',delta:{x:10,y:10}});
 close(corner.mask.left,.1);close(corner.mask.top,.1);
 const north=dragHandle({frame:square,source:square,pose,mask:noCrop(),handle:'n',delta:{x:0,y:-100}});
 close(north.mask.top,0);   // arrastrar hacia fuera no puede «desrecortar» por debajo de cero
 const tiny=dragHandle({frame:square,source:square,pose,mask:noCrop(),handle:'w',delta:{x:98,y:0}});
 assert.deepEqual(tiny.mask,noCrop());   // se conserva un tamaño mínimo
});

test('selección de recorte: las esquinas recortan y acercan, y los lados solo recortan',()=>{
  // El zoom de la selección: la región que queda se lleva al fotograma cubriéndolo con la escala uniforme más
  // pequeña que lo cubre. Sin recorte no hay zoom que aplicar.
  const none=cropZoomPose({frame:square,source:square,pose:newTransform(),mask:noCrop()});
  close(none.scale,1);
  close(none.x,0);close(none.y,0);
  // Recortando un 25 % por cada lado el recuadro queda en 50×50: se acerca 2× y sigue centrado.
  const centered=cropZoomPose({frame:square,source:square,pose:newTransform(),mask:{left:.25,right:.25,top:.25,bottom:.25}});
  close(centered.scale,2);
  close(centered.x,0);close(centered.y,0);
  const filled=boxCorners(contentBox(square,square,{left:.25,right:.25,top:.25,bottom:.25}),square,centered);
  assert.ok(filled[0].x<=0&&filled[0].y<=0&&filled[2].x>=100&&filled[2].y>=100,'la región recortada cubre el fotograma');
  // Un recorte descentrado se recentra: el centro de la región recortada cae en el centro del fotograma.
  const offCenter={left:.35,right:0,top:0,bottom:0};
  const recentered=cropZoomPose({frame:square,source:square,pose:newTransform(),mask:offCenter});
  close(recentered.scale,1/.65);          // el recuadro es 65×100: se llena por el ancho
  const offBox=contentBox(square,square,offCenter);
  const middle=applyMatrix(poseMatrix(square,recentered),{x:offBox.x+offBox.width/2,y:offBox.y+offBox.height/2});
  close(middle.x,50);close(middle.y,50);
  // Y con el encuadre girado el centro sigue cayendo en el centro del fotograma.
  const spun=cropZoomPose({frame:square,source:square,pose:{...newTransform(),rotation:90},mask:{left:.25,right:0,top:0,bottom:0}});
  const spunMiddle=applyMatrix(poseMatrix(square,spun),{x:62.5,y:50});
  close(spunMiddle.x,50,1e-6);close(spunMiddle.y,50,1e-6);
  // Un recorte que no conserva la proporción del fotograma se cubre igual: se ve todo lo seleccionado y además
  // se recorta lo que sobra del lado largo, nunca quedan bandas.
  const squareCrop={left:.21875,right:.21875,top:0,bottom:0};    // 1:1 en un fotograma 16:9
  const wide={width:1920,height:1080};
  const zoomed=cropZoomPose({frame:wide,source:wide,pose:newTransform(),mask:squareCrop});
  close(zoomed.scale,1920/1080,1e-9);
  assert.ok(isCornerHandle('nw')&&isCornerHandle('se')&&!isCornerHandle('n')&&!isCornerHandle('move'));
  // Arrastre: hacia dentro recorta y acerca (escala mayor que 1); hacia fuera vuelve a alejarse.
  const pose=newTransform();
  const inward=dragCropSelection({frame:square,source:square,pose,mask:noCrop(),handle:'se',delta:{x:-20,y:-20},zoom:true});
  close(inward.mask.right,.2);close(inward.mask.bottom,.2);
  close(inward.pose.scale,1/.8);
  assert.ok(inward.pose.scale>1,'la selección más pequeña acerca');
  const outward=dragCropSelection({frame:square,source:square,pose:inward.pose,mask:inward.mask,handle:'se',delta:{x:20,y:20},zoom:true});
  assert.deepEqual(outward.mask,noCrop());
  close(outward.pose.scale,1);
  // Los puntos de los lados recortan sin acercar, y sin `zoom` el arrastre es el de siempre.
  const side=dragCropSelection({frame:square,source:square,pose,mask:noCrop(),handle:'e',delta:{x:-30,y:0},zoom:true});
  close(side.mask.right,.3);close(side.pose.scale,1);
  const plain=dragCropSelection({frame:square,source:square,pose,mask:noCrop(),handle:'se',delta:{x:-20,y:-20}});
  assert.deepEqual(plain.mask,inward.mask);close(plain.pose.scale,1);
  // El recorte no puede pasar del tope de cada lado (45 %), y el zoom se calcula sobre el recorte ya limitado:
  // el arrastre de la esquina «se» deja 45 % por la derecha y por abajo, o sea 1/(1-0,45) = 1,818.
  const huge=dragCropSelection({frame:square,source:square,pose,mask:noCrop(),handle:'se',delta:{x:-49,y:-49},zoom:true});
  close(huge.mask.right,.45);close(huge.mask.bottom,.45);
  close(huge.pose.scale,100/55,1e-9);
  assert.ok(huge.pose.scale>=.05&&huge.pose.scale<=10);
  // El zoom se mide sobre los márgenes del recorte y no sobre el tamaño del fotograma: un material con bandas
  // (un cuadrado en un fotograma 16:9) no salta al empezar a recortar —sin recorte la escala sigue siendo 1— y
  // al recortar un 20 % por cada lado se acerca 1/(1-0,4) = 1,667, que es exactamente lo que se ha recortado.
  const wide16={width:1920,height:1080}, squareSource={width:1080,height:1080};
  close(cropZoomPose({frame:wide16,source:squareSource,pose:newTransform(),mask:noCrop()}).scale,1);
  const cropped20=cropZoomPose({frame:wide16,source:squareSource,pose:newTransform(),mask:{left:.2,right:.2,top:.2,bottom:.2}});
  close(cropped20.scale,1/.6);
  close(cropped20.x,0);close(cropped20.y,0);
});

test('tiradores: se detecta qué se agarra y dónde están las asas',()=>{ const box={x:20,y:30,width:60,height:40};
 assert.equal(handleAt(box,{x:20,y:30}),'nw');
 assert.equal(handleAt(box,{x:80,y:50}),'e');
 assert.equal(handleAt(box,{x:50,y:70}),'s');
 assert.equal(handleAt(box,{x:50,y:50}),'move');
 assert.equal(handleAt(box,{x:5,y:5}),null);
 assert.equal(handlePoint(box,'se').x,80);
 assert.equal(handlePoint(box,'n').y,30);
 assert.equal(HANDLES.length,8);
});

test('giro y escala: el arrastre del ratón se convierte al espacio del fotograma',()=>{
 const rotated:Transform={...newTransform(),rotation:90};
 const delta=toLocalDelta({x:1,y:0},rotated);
 close(delta.x,0,1e-9);close(delta.y,-1,1e-9);
 const scaled:Transform={...newTransform(),scale:2};
 const half=toLocalDelta({x:10,y:0},scaled);
 close(half.x,5);close(half.y,0);
 const local=toLocal({x:100,y:100},square,newTransform());
 close(local.x,100);close(local.y,100);
 const corners=boxCorners({x:0,y:0,width:100,height:100},square,newTransform());
 assert.deepEqual(corners,[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}]);
});

test('claves: se añaden, se sustituyen, se mueven y se interpolan los márgenes',()=>{
 let keys=upsertKey([],1000,{x:.2});
 assert.equal(keys.length,1);
 keys=upsertKey(keys,1000,{x:.3});
 assert.equal(keys.length,1);
 close(keys[0].x,.3);
 keys=upsertKey(keys,2000,{x:.5});
 assert.equal(keys.length,2);
 assert.equal(keyAt(keys,1000)?.time,1000);
 keys=moveKey(keys,2000,1500,ticks(5));
 assert.equal(keys[1].time,1500);
 keys=removeKey(keys,1000);
 assert.equal(keys.length,1);

 const event={transform:{...newTransform(),crop:.1},keys:[
  {...newTransform(),time:0,mask:{left:0,right:0,top:0,bottom:0}},
  {...newTransform(),time:1000,mask:{left:.4,right:.4,top:.4,bottom:.4}},
 ]};
 close(maskAt(event,500).left,.2);
 close(maskAt(event,-100).left,0);      // antes de la primera clave
 close(maskAt(event,5000).left,.4);     // después de la última
 const plain={transform:{...newTransform(),crop:.1},keys:[{...newTransform(),time:0},{...newTransform(),time:1000}]};
 close(maskAt(plain,500).left,.1);      // claves sin máscara: manda el recorte uniforme
 const single={transform:newTransform(),keys:[{...newTransform(),time:0,mask:{left:.3,right:.3,top:0,bottom:0}}]};
 close(maskAt(single,500).left,.3);     // con una sola clave no hay nada que interpolar
});

test('encaje: restablecer repone posición, escala y giro sin tocar la opacidad ni el recorte',()=>{
 const pose:Transform={x:.4,y:-.2,scale:2,rotation:45,opacity:.5,crop:.2};
 assert.deepEqual(resetPose(pose),{x:0,y:0,scale:1,rotation:0,opacity:.5,crop:.2});
 const mask:CropMask={left:.1,right:.2,top:0,bottom:.3};
 assert.equal(sourceRect({width:100,height:100},mask).width,70);
});

test('centro de giro: es el punto fijo de la rotación y sin él se gira sobre el centro del fotograma',()=>{
 const frame={width:100,height:100};
 // Sin centro de giro, la matriz es exactamente la de siempre: girar 90° lleva la esquina (0,0) a (100,0).
 const centred:Transform={...newTransform(),rotation:90};
 const corner=applyMatrix(poseMatrix(frame,centred),{x:0,y:0});
 close(corner.x,100);close(corner.y,0);
 // Con el centro de giro en la esquina superior izquierda, esa esquina no se mueve y (100,0) cae en (0,100).
 const atCorner:Transform={...centred,pivot:{x:0,y:0}};
 const fixed=applyMatrix(poseMatrix(frame,atCorner),{x:0,y:0});
 close(fixed.x,0);close(fixed.y,0);
 const swung=applyMatrix(poseMatrix(frame,atCorner),{x:100,y:0});
 close(swung.x,0);close(swung.y,100);
 // Cambiar el centro de giro no mueve nada mientras no haya giro ni escala: es un punto de referencia.
 const still:Transform={...newTransform(),x:.1,y:-.05,pivot:{x:.2,y:.7}};
 const moved=applyMatrix(poseMatrix(frame,still),{x:37,y:11});
 close(moved.x,47);close(moved.y,6);
 // El centro de giro también sirve para el giro 3D de la ventana: la matriz y el compositor usan el mismo.
 const quarter=applyMatrix(poseMatrix(frame,{...newTransform(),scale:2}),{x:50,y:50});
 close(quarter.x,50);close(quarter.y,50);
});

test('pose: el centro de giro viaja con las claves y se interpola entre ellas',()=>{
 const base=newEvent('t','video',0,ticks(4));
 base.transform={...newTransform(),pivot:{x:.5,y:.5}};
 // Sin claves manda el valor del evento.
 close(pose({...base,keys:[]},ticks(2)).pivot!.x,.5);
 // Con dos claves que lo llevan, a mitad de camino está en el medio.
 base.keys=[
  {...newTransform(),time:0,pivot:{x:0,y:0}},
  {...newTransform(),time:ticks(2),pivot:{x:1,y:.5}},
 ];
 close(pose(base,ticks(1)).pivot!.x,.5);
 close(pose(base,ticks(1)).pivot!.y,.25);
 close(pose(base,ticks(2)).pivot!.x,1);
 // Si ninguna clave lo trae, se usa el del evento (no se pierde al animar).
 base.transform={...newTransform(),pivot:{x:.25,y:.75}};
 base.keys=[{...newTransform(),time:0},{...newTransform(),time:ticks(2)}];
 close(pose(base,ticks(1)).pivot!.x,.25);
 close(pose(base,ticks(1)).pivot!.y,.75);
});

test('la tira de claves muestra solo las claves que cambian el parámetro elegido',()=>{
 const keys=[
  {...newTransform(),time:0},
  {...newTransform(),time:100,x:.3},
  {...newTransform(),time:200,x:.3,rotation:45},
  {...newTransform(),time:300,x:.3,rotation:45,mask:{left:.2,right:.2,top:0,bottom:0}},
  {...newTransform(),time:400,x:.3,rotation:45,opacity:.4},
 ];
 // La primera siempre se ve: es donde empieza la envolvente.
 assert.deepEqual(keysChanging(keys,'all').map(key=>key.time),[0,100,200,300,400]);
 assert.deepEqual(keysChanging(keys,'position').map(key=>key.time),[0,100]);
 assert.deepEqual(keysChanging(keys,'rotation').map(key=>key.time),[0,200]);
 // En el recorte, la clave 400 también sale: quita el recorte que puso la 300, así que el recorte cambia ahí.
 assert.deepEqual(keysChanging(keys,'crop').map(key=>key.time),[0,300,400]);
 assert.deepEqual(keysChanging(keys,'opacity').map(key=>key.time),[0,400]);
 assert.deepEqual(keysChanging([],'position'),[]);
});
