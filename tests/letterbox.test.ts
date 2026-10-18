// Pruebas de quitar bandas negras: detección por píxeles y encaje del contenido.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BAR_DEFAULTS,barsToMask,containScale,coverScale,describeBars,describeFit,detectBars,fillFrame,fitFrame} from '../lib/editor/letterbox';
import {transform as newTransform} from '../lib/editor/project';
import {contentBox} from '../lib/editor/pancrop';

// Dibuja un fotograma de un color con bandas negras opcionales (en píxeles).
function frame(width:number,height:number,bars:{top?:number;bottom?:number;left?:number;right?:number}={},color:[number,number,number]=[200,120,40]){
 const pixels=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y+=1)for(let x=0;x<width;x+=1){
  const inBarTop=y<(bars.top??0),inBarBottom=y>=height-(bars.bottom??0),inBarLeft=x<(bars.left??0),inBarRight=x>=width-(bars.right??0);
  const black=inBarTop||inBarBottom||inBarLeft||inBarRight;
  const index=(y*width+x)*4;
  pixels[index]=black?0:color[0];pixels[index+1]=black?0:color[1];pixels[index+2]=black?0:color[2];pixels[index+3]=255;
 }
 return pixels;
}
const close=(actual:number,expected:number,tolerance=1e-6)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} no está cerca de ${expected}`);

test('detecta las bandas de arriba y abajo y las deja en fracciones del fotograma',()=>{
 const width=100,height=80;
 const bars=detectBars(frame(width,height,{top:10,bottom:6}),width,height);
 assert.ok(bars,'debería haber bandas');
 close(bars!.top,10/80);
 close(bars!.bottom,6/80);
 assert.equal(bars!.left,0);
 assert.equal(bars!.right,0);
 // Y las laterales, que son el «pillarboxing».
 const side=detectBars(frame(width,height,{left:12,right:4}),width,height);
 assert.ok(side);
 close(side!.left,12/100);
 close(side!.right,4/100);
 assert.equal(side!.top,0);
 // Las cuatro a la vez.
 const all=detectBars(frame(width,height,{top:8,bottom:8,left:10,right:10}),width,height);
 assert.ok(all);
 close(all!.top,.1);close(all!.bottom,.1);close(all!.left,.1);close(all!.right,.1);
});

test('sin bandas no hay nada que recortar, y las bandas diminutas se ignoran',()=>{
 const width=60,height=40;
 assert.equal(detectBars(frame(width,height),width,height),null,'un fotograma lleno no tiene bandas');
 // Un par de filas oscuras son un borde, no una banda: por debajo del mínimo no se toca.
 assert.equal(detectBars(frame(width,height,{top:2,bottom:1}),width,height,BAR_DEFAULTS),null);
 // Con el mínimo a 1 sí se ven.
 const tiny=detectBars(frame(width,height,{top:2}),width,height,{minRun:1});
 assert.ok(tiny);
 close(tiny!.top,2/40);
});

test('un fotograma entero oscuro o con una imagen muy pequeña no se toca',()=>{
 const width=20,height=10;
 assert.equal(detectBars(frame(width,height,{top:height}),width,height),null,'todo negro no da información');
 assert.equal(detectBars(new Uint8ClampedArray(width*height*4),width,height),null);
 assert.equal(detectBars(frame(2,2),2,2),null,'demasiado pequeño para decidir');
 assert.equal(detectBars(new Uint8ClampedArray(16),100,100),null,'datos que no corresponden al tamaño');
});

test('el umbral de oscuridad decide qué es banda',()=>{
 const width=40,height=30;
 // Una imagen de gris medio (60) con bandas negras: con el umbral por defecto (24) las bandas se ven.
 const medium=frame(width,height,{top:6},[60,60,60]);
 const bars=detectBars(medium,width,height);
 assert.ok(bars,'las bandas negras sobre gris medio se ven');
 close(bars!.top,6/30);
 // Con un umbral por debajo del gris de la imagen, las bandas siguen viéndose.
 assert.ok(detectBars(medium,width,height,{tolerance:10}));
 // Con un umbral por encima del gris de la imagen, toda la imagen cuenta como banda y no se decide nada.
 assert.equal(detectBars(medium,width,height,{tolerance:80}),null);
 // Una imagen tan oscura como el umbral tampoco da información: no se toca.
 assert.equal(detectBars(frame(width,height,{top:6},[20,20,20]),width,height),null);
 // Si la banda no es uniforme (una esquina clara), la fila no llega a la cobertura exigida.
 const speckled=frame(width,height,{top:6});
 for(let i=0;i<40;i+=1){const index=(0*width+i)*4;speckled[index]=255;speckled[index+1]=255;speckled[index+2]=255;}
 assert.equal(detectBars(speckled,width,height),null,'una fila con píxeles claros no es banda');
});

test('las bandas nunca pasan del tope del modelo de recorte y se describen en porcentaje',()=>{
 const width=100,height=100;
 // Una banda de arriba del 60 % se recorta hasta el tope del modelo (45 % por lado).
 const top=detectBars(frame(width,height,{top:60}),width,height)!;
 close(top.top,.45);
 assert.equal(top.bottom,0);
 // Y una lateral igual.
 const left=detectBars(frame(width,height,{left:70}),width,height)!;
 close(left.left,.45);
 close(left.top,0);
 const mask=barsToMask(top);
 close(mask.top,.45);
 assert.equal(describeBars(top),'arriba 45.0 %');
 assert.equal(describeBars({left:.1,right:.05,top:0,bottom:.2}),'abajo 20.0 % · izquierda 10.0 % · derecha 5.0 %');
 assert.equal(describeBars(null),'sin bandas');
 assert.deepEqual(barsToMask({left:0,right:0,top:0,bottom:0}),{left:0,right:0,top:0,bottom:0});
});

test('encaje: cubrir el fotograma y encajarlo entero, sin deformar',()=>{
 const project={width:1920,height:1080};
 // Un medio 4:3 en un proyecto 16:9: cubrir pide 1920/1440 = 1,333…, encajar pide 1080/1080 = 1.
 const media={width:1440,height:1080};
 close(coverScale(project,media),1920/1440);
 close(containScale(project,media),1);
 // Un medio más grande que el proyecto: encajar lo encoge y cubrir lo deja igual (ya cubre).
 const big={width:3840,height:2160};
 close(containScale(project,big),.5);
 close(coverScale(project,big),.5);
 // El medio vertical en un proyecto horizontal.
 const vertical={width:1080,height:1920};
 close(coverScale(project,vertical),1920/1080);
 close(containScale(project,vertical),1080/1920);
 // La pose que cubre conserva el resto de campos y solo cambia la escala.
 const pose={...newTransform(),x:.1,y:-.2,rotation:12,opacity:.8};
 const filled=fillFrame({project,media,pose});
 close(filled.scale,1920/1440);
 close(filled.x,.1);close(filled.y,-.2);close(filled.rotation,12);close(filled.opacity,.8);
 // Si ya cubre, no se toca nada.
 const already={...pose,scale:2};
 assert.deepEqual(fillFrame({project,media,pose:already}),already);
 // Un medio mayor que el proyecto ya lo cubre a escala 1 (el compositor lo dibuja encajado), así que cubrir no
 // cambia nada y encajar devuelve la escala neutra: antes se encogía a la mitad y el medio quedaba al 25 %.
 assert.deepEqual(fillFrame({project,media:big,pose}),pose);
 close(fitFrame({project,media:big,pose}).scale,1);
 assert.ok(fitFrame({project,media:{width:10,height:10},pose}).scale<=10);
 assert.ok(fitFrame({project,media:{width:100000,height:10},pose}).scale>=.05);
 assert.match(describeFit(project,media),/medio 1440×1080 \(1\.333\) en un fotograma 1920×1080 \(1\.778\)/);
});

test('cubrir el fotograma quita las bandas del recuadro del contenido',()=>{
 // El medio 4:3 se ajusta al fotograma 16:9 y deja franjas a los lados; al cubrir, la caja pasa a llenarlo.
 const project={width:320,height:180};
 const media={width:240,height:180};
 const pose=newTransform();
 const before=contentBox(project,media,{left:0,right:0,top:0,bottom:0});
 assert.ok(before.width<project.width-1,`la caja ajustada es más estrecha (${before.width})`);
 const filled=fillFrame({project,media,pose});
 const after=contentBox(project,media,{left:0,right:0,top:0,bottom:0});
 // La caja local no cambia (el recorte es el mismo); lo que cambia es la escala de la pose.
 close(filled.scale,320/240);
 close(after.width,before.width);
 // Con esa escala, el ancho dibujado cubre el fotograma.
 close(before.width*filled.scale,project.width,1e-6);
 assert.ok(before.height*filled.scale>project.height,'y el alto se sale, que es lo que se recorta');
});
