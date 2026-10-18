// Pruebas del escalado con ancla fija: es lo que hace el redimensionado desde la vista previa.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyMatrix,boxCorners,contentBox,dragScale,fittedBox,frameBox,handlePoint,oppositeHandle,poseMatrix} from '../lib/editor/pancrop';
import {CropMask,Transform,transform as newTransform} from '../lib/editor/project';

const frame={width:320,height:180};
const source={width:320,height:180};
const noMask:CropMask={left:0,right:0,top:0,bottom:0};
const close=(actual:number,expected:number,tolerance=1e-6)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} no está cerca de ${expected}`);
const box=()=>contentBox(frame,source,noMask);

test('el asa contraria es el ancla y la caja neutra llena el fotograma',()=>{
 assert.equal(oppositeHandle('nw'),'se');
 assert.equal(oppositeHandle('s'),'n');
 assert.equal(oppositeHandle('e'),'w');
 const b=box();
 close(b.x,0);close(b.y,0);close(b.width,320);close(b.height,180);
});

test('arrastrar un asa hacia fuera agranda y deja el ancla clavada en su sitio',()=>{
 const pose=newTransform();
 const anchorBefore=applyMatrix(poseMatrix(frame,pose),handlePoint(box(),oppositeHandle('se')));
 // Se tira de la esquina inferior derecha hacia fuera: la caja dobla su tamaño (320 → 640 de ancho).
 const scaled=dragScale({frame,box:box(),pose,handle:'se',delta:{x:320,y:180}});
 close(scaled.scale,2,1e-9);
 // La esquina superior izquierda (el ancla) sigue exactamente donde estaba.
 const anchorAfter=applyMatrix(poseMatrix(frame,scaled),handlePoint(box(),oppositeHandle('se')));
 close(anchorAfter.x,anchorBefore.x,1e-9);
 close(anchorAfter.y,anchorBefore.y,1e-9);
 // Y la esquina que se arrastra se ha movido el doble de lejos del ancla.
 const cornerBefore=applyMatrix(poseMatrix(frame,pose),handlePoint(box(),'se'));
 const cornerAfter=applyMatrix(poseMatrix(frame,scaled),handlePoint(box(),'se'));
 close((cornerAfter.x-anchorAfter.x)/(cornerBefore.x-anchorBefore.x),2,1e-9);
 close((cornerAfter.y-anchorAfter.y)/(cornerBefore.y-anchorBefore.y),2,1e-9);
});

test('cada asa ancla en la esquina o el lado contrario, y arrastrar hacia dentro encoge',()=>{
 const pose=newTransform();
 // Tirando del lado derecho hacia la izquierda, la escala baja y el borde izquierdo no se mueve.
 const shrunken=dragScale({frame,box:box(),pose,handle:'e',delta:{x:-160,y:0}});
 close(shrunken.scale,.5,1e-9);
 const leftBefore=applyMatrix(poseMatrix(frame,pose),handlePoint(box(),'w'));
 const leftAfter=applyMatrix(poseMatrix(frame,shrunken),handlePoint(box(),'w'));
 close(leftAfter.x,leftBefore.x,1e-9);
 close(leftAfter.y,leftBefore.y,1e-9);
 // Tirando del lado superior hacia abajo, el borde inferior se queda quieto.
 const down=dragScale({frame,box:box(),pose,handle:'n',delta:{x:0,y:90}});
 close(down.scale,.5,1e-9);
 const bottom=applyMatrix(poseMatrix(frame,down),handlePoint(box(),'s'));
 close(bottom.y,180,1e-9);
 // Con el asa superior izquierda, el ancla es la esquina inferior derecha.
 const fromCorner=dragScale({frame,box:box(),pose,handle:'nw',delta:{x:-320,y:-180}});
 close(fromCorner.scale,2,1e-9);
 const bottomRight=applyMatrix(poseMatrix(frame,fromCorner),handlePoint(box(),'se'));
 close(bottomRight.x,320,1e-9);
 close(bottomRight.y,180,1e-9);
});

test('el escalado respeta los topes y no toca la pose cuando el arrastre es nulo o degenerado',()=>{
 const pose=newTransform();
 assert.deepEqual(dragScale({frame,box:box(),pose,handle:'se',delta:{x:0,y:0}}),pose);
 close(dragScale({frame,box:box(),pose,handle:'se',delta:{x:10000,y:10000}}).scale,10);
 close(dragScale({frame,box:box(),pose,handle:'se',delta:{x:-10000,y:-10000}}).scale,.05);
 assert.deepEqual(dragScale({frame,box:{x:10,y:10,width:0,height:0},pose,handle:'se',delta:{x:50,y:50}}),pose);
 assert.deepEqual(dragScale({frame,box:box(),pose,handle:'move',delta:{x:50,y:50}}),pose);
 // Una caja que no llena el fotograma (un medio más pequeño) también escala desde su propio ancla.
 const small={x:80,y:45,width:160,height:90};
 const fromSmall=dragScale({frame,box:small,pose,handle:'se',delta:{x:160,y:90}});
 close(fromSmall.scale,2,1e-9);
 const anchor=applyMatrix(poseMatrix(frame,fromSmall),handlePoint(small,'nw'));
 close(anchor.x,80,1e-9);
 close(anchor.y,45,1e-9);
});

test('con giro y con centro de giro, el ancla sigue quieta y la escala es la misma',()=>{
 for(const pose of [
  {...newTransform(),rotation:30},
  {...newTransform(),rotation:-20,scale:1.5,x:.1,y:-.05},
  {...newTransform(),rotation:45,pivot:{x:.2,y:.8}},
 ] as Transform[]){
  const before=applyMatrix(poseMatrix(frame,pose),handlePoint(box(),oppositeHandle('ne')));
  const moving=applyMatrix(poseMatrix(frame,pose),handlePoint(box(),'ne'));
  // El arrastre va justo por la diagonal del asa, la mitad de su longitud: el factor es 1,5 exacto.
  const diagonal={x:(moving.x-before.x)*.5,y:(moving.y-before.y)*.5};
  const scaled=dragScale({frame,box:box(),pose,handle:'ne',delta:diagonal});
  const after=applyMatrix(poseMatrix(frame,scaled),handlePoint(box(),oppositeHandle('ne')));
  close(after.x,before.x,1e-9);
  close(after.y,before.y,1e-9);
  close(scaled.scale,pose.scale*1.5,1e-9);
  // Ni el giro ni la opacidad cambian: solo la escala y el desplazamiento.
  close(scaled.rotation,pose.rotation,1e-12);
  close(scaled.opacity,pose.opacity,1e-12);
 }
});

test('el recorte no se toca al escalar desde la vista previa',()=>{
 const pose=newTransform();
 const mask:CropMask={left:.2,right:.1,top:.05,bottom:0};
 const cropped=contentBox(frame,source,mask);
 const scaled=dragScale({frame,box:cropped,pose,handle:'se',delta:{x:100,y:60}});
 assert.ok(scaled.scale>1);
 // La caja recortada sigue siendo la misma: solo cambia la pose.
 const after=contentBox(frame,source,mask);
 close(after.x,cropped.x,1e-12);
 close(after.width,cropped.width,1e-12);
 // Y el tamaño dibujado crece en la misma proporción.
 const beforeWidth=boxCorners(cropped,frame,pose)[1].x-boxCorners(cropped,frame,pose)[0].x;
 const afterWidth=boxCorners(after,frame,scaled)[1].x-boxCorners(after,frame,scaled)[0].x;
 close(afterWidth/beforeWidth,scaled.scale,1e-9);
 void fittedBox; void frameBox;
});
