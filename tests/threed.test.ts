// Pruebas de la composición 3D (giros X e Y y distancia). Comprueban la geometría de la proyección
// contra un modelo independiente, que el mapeo proyectivo de Heckbert reproduce las esquinas y su
// inverso, que la deformación ocurre de verdad en los píxeles, que la pose neutra no cambia nada de lo
// que ya había y que las claves y la validación cubren los campos nuevos.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {compose} from '../lib/editor/compositor';
import {MediaLibrary} from '../lib/editor/media';
import {newEvent,newProject,pose,ticks,transform} from '../lib/editor/project';
import {validateProject} from '../lib/editor/validation';
import {FOCAL,MAX_DEPTH,MIN_DEPTH,composeQuad,evaluate,inversePoint,is3D,jacobian,pose3D,projectiveCoefficients,projectivePoint,projectPoint,projectQuad,projectQuadAt,rotate,rotateX,rotateY,signedArea,type Point} from '../lib/editor/threed';

const DEG=Math.PI/180;
const frame={width:640,height:360};
const near=(a:number,b:number,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} no está a menos de ${tolerance} de ${b}`);
const canvasOf=(width:number,height:number)=>createCanvas(width,height) as unknown as HTMLCanvasElement;
const factory=(width:number,height:number)=>createCanvas(width,height) as unknown as HTMLCanvasElement;
const projectWith=(setup:(p:ReturnType<typeof newProject>)=>void)=>{const p=newProject();p.width=320;p.height=180;setup(p);return p;};
// Modelo independiente de la cámara: gira la esquina en el espacio y proyecta dividiendo por la
// distancia. No usa ninguna función del editor salvo las constantes, y es la referencia de las pruebas.
const camera=(pose:{rotationX?:number;rotationY?:number;depth?:number},center:Point,frameSize=frame):Point[]=>{
  const rx=(pose.rotationX??0)*DEG, ry=(pose.rotationY??0)*DEG, depth=pose.depth??1;
  return [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([x,y])=>{
    const ax=x, ay=y*Math.cos(rx), az=y*Math.sin(rx);
    const bx=ax*Math.cos(ry)+az*Math.sin(ry);
    const bz=-ax*Math.sin(ry)+az*Math.cos(ry);
    const k=FOCAL/Math.max(.05,depth-bz);
    return {x:center.x+frameSize.width*bx*k,y:center.y+frameSize.height*ay*k};
  });
};
// Homografía del cuadrado unitario al cuadrilátero resuelta como sistema lineal (forma estándar). Es
// la referencia independiente del mapeo proyectivo: si coincide con `projectiveCoefficients`, la
// descomposición en (g,h) y C está bien.
const homographyAt=(quad:Point[],u:number,v:number):Point=>{
  // Misma convención que el editor: el recorrido del cuadrilátero se usa tal cual y el signo del
  // denominador se normaliza para que sea positivo en el centro.
  const matrix:number[][]=[], vector:number[]=[];
  for(const [tu,tv,point] of [[0,0,quad[0]],[1,0,quad[1]],[1,1,quad[2]],[0,1,quad[3]]] as [number,number,Point][]){
    matrix.push([tu,tv,1,0,0,0,-tu*point.x,-tv*point.x]); vector.push(point.x);
    matrix.push([0,0,0,tu,tv,1,-tu*point.y,-tv*point.y]); vector.push(point.y);
  }
  const n=vector.length;
  const a=matrix.map((row,index)=>[...row,vector[index]]);
  for(let column=0;column<n;column++){
    let pivot=column;
    for(let row=column+1;row<n;row++)if(Math.abs(a[row][column])>Math.abs(a[pivot][column]))pivot=row;
    [a[column],a[pivot]]=[a[pivot],a[column]];
    for(let row=0;row<n;row++){
      if(row===column||Math.abs(a[column][column])<1e-14)continue;
      const factor=a[row][column]/a[column][column];
      for(let k=column;k<=n;k++)a[row][k]-=factor*a[column][k];
    }
  }
  const h=a.map((row,index)=>row[n]/a[index][index]);
  // El editor normaliza el signo del denominador para que sea positivo en el centro; aquí se hace lo
  // mismo para poder comparar las dos implementaciones.
  const scale=(h[6]/2+h[7]/2+1)<0?-1:1;
  const w=scale*(h[6]*u+h[7]*v+1);
  return {x:scale*(h[0]*u+h[1]*v+h[2])/w,y:scale*(h[3]*u+h[4]*v+h[5])/w};
};

test('3D: la proyección sin giros devuelve el fotograma tal cual',()=>{
  const quad=projectQuad({},frame);
  assert.deepEqual(quad.map(point=>[point.x,point.y]),
    [[-160,-90],[800,-90],[800,450],[-160,450]],
    'con la pose neutra el cuadrilátero es el fotograma completo (con las esquinas fuera, que es como VEGAS compone)');
  near(projectiveCoefficients(quad).g,0,1e-12);
  near(projectiveCoefficients(quad).h,0,1e-12);            // un rectángulo no tiene perspectiva
  // Sin giros el mapeo es afín, así que el centro del cuadrado unitario cae en el centro del
  // cuadrilátero.
  const centroid={x:quad.reduce((total,point)=>total+point.x,0)/4,y:quad.reduce((total,point)=>total+point.y,0)/4};
  near(projectivePoint(quad,.5,.5).x,centroid.x,1e-9);
  near(projectivePoint(quad,.5,.5).y,centroid.y,1e-9);
});

test('3D: los giros y la distancia coinciden con la cámara de perspectiva',()=>{
  for(const pose of [{rotationY:40},{rotationY:60},{rotationX:35},{rotationY:40,rotationX:15},{rotationY:40,depth:.6},{rotationX:-25,depth:2},{rotationY:-40}]){
    const mine=projectQuad(pose,frame), theirs=camera(pose,{x:frame.width/2,y:frame.height/2});
    for(let index=0;index<4;index++){
      near(mine[index].x,theirs[index].x,1e-9);
      near(mine[index].y,theirs[index].y,1e-9);
    }
  }
  for(const size of [{width:320,height:180},{width:160,height:90}]){
    const middle={x:size.width/2,y:size.height/2};
    for(const pose of [{rotationY:40},{rotationX:20},{rotationY:-30,rotationX:10}]){
      const mine=projectQuad(pose,size), theirs=camera(pose,middle,size);
      for(let index=0;index<4;index++){
        near(mine[index].x,theirs[index].x,1e-9);
        near(mine[index].y,theirs[index].y,1e-9);
      }
    }
  }
  // Y también descentrado, que es donde aparece el trapecio.
  const off={x:frame.width*.8,y:frame.height*.4};
  for(const pose of [{rotationY:40},{rotationY:25,rotationX:20}]){
    const mine=projectQuadAt(pose,frame,off), theirs=camera(pose,off);
    for(let index=0;index<4;index++){
      near(mine[index].x,theirs[index].x,1e-9);
      near(mine[index].y,theirs[index].y,1e-9);
    }
  }
});

test('3D: el giro se calcula con la fórmula exacta de la proyección',()=>{
  // Paso a paso, con el plano de 320×180 para tener valores redondos: la esquina (−0,5; −0,5) queda en
  // (−0,5·cos40; −0,5; 0,5·sen40) al girarla sobre Y, y la proyección la lleva a x = −0,846637… y
  // y = −1,105206…, que en píxeles son (−110,9239; −108,9372).
  const size={width:320,height:180};
  const rotated=rotate({x:-.5,y:-.5,z:0},{rotationY:40});
  near(rotated.x,-.5*Math.cos(40*DEG),1e-12);
  near(rotated.z,.5*Math.sin(40*DEG),1e-12);
  near(rotated.y,-.5,1e-12);
  const projected=projectPoint(rotated,1,FOCAL);
  near(projected.x,-.846637322853411,1e-12);
  near(projected.y,-1.1052065326736085,1e-12);
  const corner={x:size.width/2+size.width*projected.x,y:size.height/2+size.height*projected.y};
  near(corner.x,-110.923943313,1e-9);
  near(corner.y,-108.937175881,1e-9);
  const quad=projectQuad({rotationY:40},size);
  near(quad[0].x,corner.x,1e-9);
  near(quad[0].y,corner.y,1e-9);
  // El lado que se aleja se encoge y el que se acerca crece: no son iguales.
  const left=quad[3].y-quad[0].y, right=quad[2].y-quad[1].y;
  assert.ok(left>right*1.9,`el borde lejano (izquierdo) se encoge y el cercano (derecho) crece (izquierda ${left.toFixed(2)}, derecha ${right.toFixed(2)})`);
  const inverted=projectQuad({rotationY:-40},size);
  assert.ok(inverted[2].y-inverted[1].y>inverted[3].y-inverted[0].y*1.9,'con el giro al revés se invierte');
  // La esquina superior del plano inclinado se aleja y sube hasta quedar cerca del borde superior.
  const pitched=projectQuad({rotationX:35},size);
  const pitchedExpected=camera({rotationX:35},{x:size.width/2,y:size.height/2},size);
  near(pitched[0].y,pitchedExpected[0].y,1e-9);
  assert.ok(pitched[0].y>0&&pitched[0].y<40,'la esquina superior se aleja y queda cerca del borde superior');
  assert.ok(pitched[2].y>size.height,'y la inferior baja por debajo del fotograma');
  assert.ok(pitched[0].x<0&&pitched[1].x>size.width,'el borde cercano se ensancha más allá del fotograma');
  assert.equal(is3D({depth:2}),false,'la distancia sola no activa la vía 3D porque no deforma');
  const far=projectQuad({depth:2},frame);
  near(far[1].x-far[0].x,frame.width*FOCAL/2,1e-9);       // de frente, alejar el plano solo lo encoge
});

test('3D: el trapecio descentrado y el mapeo afín',()=>{
  // Con la cámara por defecto (foco 1,5 y distancia 1), el trozo de plano que cabe en el fotograma es
  // casi plano en profundidad: el mapeo sale afín (el término proyectivo es del orden de 1e-16) aunque
  // el cuadrilátero sea un trapecio. La perspectiva fuerte se comprueba aparte, con un cuadrilátero
  // construido a mano.
  const centered=projectQuad({rotationY:40},frame);
  const centeredLeftHeight=centered[3].y-centered[0].y, centeredRightHeight=centered[2].y-centered[1].y;
  near(centeredLeftHeight/centeredRightHeight,1.9479,1e-3);
  const offAxis=projectQuadAt({rotationY:40},frame,{x:frame.width*.8,y:frame.height/2});
  const coefficients=projectiveCoefficients(offAxis);
  assert.ok(Math.abs(coefficients.g)<1e-6&&Math.abs(coefficients.h)<1e-6,'con esta cámara el mapeo sale afín');
  const left=offAxis[3].y-offAxis[0].y, right=offAxis[2].y-offAxis[1].y;
  assert.ok(left>right*1.4,`el lado lejano (izquierdo) se encoge más que el cercano (izquierda ${left.toFixed(2)}, derecha ${right.toFixed(2)})`);
});

test('3D: las rotaciones se componen en el orden de VEGAS y son invertibles',()=>{
  const point={x:.3,y:-.2,z:0};
  const composed=rotate(point,{rotationX:20,rotationY:25});
  const manual=rotateY(rotateX(point,20),25);
  near(composed.x,manual.x,1e-12);
  near(composed.z,manual.z,1e-12);
  // Un giro sobre Y no cambia la altura; uno sobre X sí.
  near(rotateY(point,40).y,point.y,1e-12);
  assert.notEqual(rotateX(point,40).y,point.y);
  // Ida y vuelta: como la composición es Y después de X, el inverso deshace Y primero y X después.
  const back=rotateX(rotateY({x:composed.x,y:composed.y,z:composed.z},-25),-20);
  near(back.x,point.x,1e-12);
  near(back.y,point.y,1e-12);
  near(back.z,point.z,1e-12);
  // Proyección: un punto alejado se encoge y el que está a la distancia del observador se queda igual.
  const atDepth=projectPoint({x:.5,y:.25,z:0},1,FOCAL);
  near(atDepth.x,.75,1e-12);
  near(atDepth.y,.375,1e-12);
  assert.ok(projectPoint({x:.5,y:.25,z:-.5},1,FOCAL).x<atDepth.x);
});

test('3D: el mapeo proyectivo lleva las esquinas del cuadrado a las del cuadrilátero',()=>{
  // Se prueban cuadriláteros proyectivos de verdad (trapecios) además de los que salen de la cámara, que
  // con la distancia por defecto son casi afines.
  const quads: [Point,Point,Point,Point][] = [
    [{x:100,y:40},{x:300,y:60},{x:280,y:200},{x:110,y:190}],
    [{x:0,y:0},{x:200,y:0},{x:180,y:120},{x:20,y:100}],
    projectQuadAt({rotationY:40,rotationX:15},frame,{x:frame.width*.7,y:frame.height*.4}),
  ];
  for(const quad of quads){
    // El contrato del mapeo: (0,0) va a la primera esquina, (1,0) a la segunda, (1,1) a la tercera y
    // (0,1) a la cuarta, en el orden en que llegan. Es lo que fija la homografía.
    for(const [index,[u,v]] of [[0,[0,0]],[1,[1,0]],[2,[1,1]],[3,[0,1]]] as [number,[number,number]][]){
      const point=projectivePoint(quad,u,v);
      near(point.x,quad[index].x,1e-9);
      near(point.y,quad[index].y,1e-9);
    }
    const map=projectiveCoefficients(quad);
    let inverseWorst=0;
    for(let i=1;i<12;i++)for(let j=1;j<12;j++){
      const u=i/12,v=j/12;
      const back=inversePoint(projectivePoint(quad,u,v),quad);
      inverseWorst=Math.max(inverseWorst,Math.abs(back.x-u),Math.abs(back.y-v));
    }
    assert.ok(inverseWorst<1e-9,`el inverso tiene que volver al punto de partida (error máximo ${inverseWorst})`);
    // El jacobiano coincide con la diferencia numérica del mapeo.
    const step=1e-4;
    const at=evaluate(map,.5,.5), right=evaluate(map,.5+step,.5), down=evaluate(map,.5,.5+step);
    // El jacobiano coincide con la diferencia numérica del mapeo, con tolerancia relativa porque la
    // derivada numérica de un mapeo con denominador variable tiene error de redondeo.
    const j=jacobian(map,.5,.5);
    const tolerance=(value:number)=>Math.max(1e-2,Math.abs(value)*1e-3);
    near(j.a,(right.x-at.x)/step,tolerance(j.a));
    near(j.b,(down.x-at.x)/step,tolerance(j.b));
    near(j.c,(right.y-at.y)/step,tolerance(j.c));
    near(j.d,(down.y-at.y)/step,tolerance(j.d));
    // Con perspectiva de verdad el punto medio del mapeo no es el centro geométrico del cuadrilátero.
    if(Math.abs(map.g)+Math.abs(map.h)>1e-6){
      const middle=projectivePoint(quad,.5,.5);
      const centroid=quad.reduce((total,point)=>({x:total.x+point.x/4,y:total.y+point.y/4}),{x:0,y:0});
      assert.ok(Math.hypot(middle.x-centroid.x,middle.y-centroid.y)>5,'con perspectiva el punto medio se corre');
    }
  }
});

test('3D: la rejilla deforma de verdad los píxeles y no deja costuras',()=>{
  const source=canvasOf(320,180);
  const sourceCtx=source.getContext('2d')!;
  sourceCtx.fillStyle='#ffffff';sourceCtx.fillRect(0,0,320,180);
  const target=canvasOf(frame.width,frame.height);
  const targetCtx=target.getContext('2d')!;
  targetCtx.fillStyle='#000000';targetCtx.fillRect(0,0,frame.width,frame.height);
  const quad=projectQuad({rotationY:60},frame);
  composeQuad(targetCtx as unknown as CanvasRenderingContext2D,source,quad,{createCanvas:factory});
  const pixels=targetCtx.getImageData(0,0,frame.width,frame.height).data;
  const at=(x:number,y:number)=>pixels[(y*frame.width+x)*4];
  let painted=0;
  for(let index=0;index<pixels.length;index+=4)if(pixels[index]>200)painted++;
  assert.ok(painted>100000,'el plano girado tiene que cubrir una parte grande del fotograma');
  // Con 60° el trapecio entra por la derecha y por la izquierda se sale del fotograma (el plano girado
  // es más ancho que el fotograma), así que se comprueba el borde derecho y que la parte visible esté
  // pintada. Se evitan los píxeles del borde porque el muestreo bilineal del lienzo los mezcla.
  const middle=Math.round((quad[0].y+quad[3].y)/2);
  assert.equal(at(10,middle),255,'dentro del plano visible sí se pinta');
  assert.equal(at(200,middle),255);
  assert.equal(at(Math.round(quad[1].x)+14,middle),0,'a la derecha del plano no se pinta nada');
  assert.equal(at(Math.round(quad[1].x)-14,middle),255,'y justo dentro sí');
  assert.equal(at(320,0),255,'el plano cubre el fotograma de arriba abajo');
  assert.equal(at(320,frame.height-1),255);
  // Sin costuras: ninguna columna del interior puede quedar casi vacía entre las dos que sí tienen
  // píxeles, que es lo que se vería si las celdas de la rejilla no se tocaran.
  const right=Math.min(frame.width-1,Math.round(quad[1].x));
  for(let x=5;x<right-5;x++){
    let count=0;
    for(let y=0;y<frame.height;y++)if(at(x,y)>200)count++;
    assert.ok(count>60,`la columna ${x} quedó casi vacía: hay una costura en la rejilla`);
  }
});

test('3D: el compositor proyecta el evento y conserva el resto del fotograma',async()=>{
  const size={width:320,height:180};
  const p=projectWith(project=>{
    const background=newEvent(project.tracks[1].id,'color');
    background.color='#00ff00';
    const tilted=newEvent(project.tracks[0].id,'color',0,ticks(2));
    tilted.color='#ff0000';
    tilted.transform.rotationY=20;
    tilted.transform.scale=.4;
    project.events.push(background,tilted);
  });
  const canvas=canvasOf(size.width,size.height);
  await compose(canvas,p,new MediaLibrary(),ticks(1),{createCanvas:factory});
  const ctx=canvas.getContext('2d')!;
  const pixel=(x:number,y:number)=>ctx.getImageData(x,y,1,1).data;
  // El plano se reduce al 40 % y se gira 20°, así que entra en el fotograma: en la fila central hay fondo
  // a los dos lados y el plano en medio. En vez de fijar las columnas a mano se buscan las fronteras y se
  // comprueba que el fondo quede fuera y el evento dentro.
  const row=90;
  let left=-1, right=-1;
  for(let x=0;x<size.width;x++)if(pixel(x,row)[0]>200){if(left<0)left=x;right=x;}
  if(process.env.CORTE15_3D_DEBUG)console.log('[TEST] rojo',left,'..',right,'| fila',[0,10,20,30,50,100,150,200,250,300,319].map(x=>`${x}:${pixel(x,row)[0]}/${pixel(x,row)[1]}`).join(' '));
  assert.ok(left>5&&right<size.width-5,`el plano tiene que entrar en el fotograma en la fila ${row} (${left}..${right})`);
  assert.equal(pixel(0,row)[1],255,'a la izquierda del plano se ve el fondo');
  assert.equal(pixel(size.width-1,row)[1],255,'y a la derecha también');
  assert.equal(pixel(left+8,row)[0],255,'y dentro el color del evento');
  assert.equal(pixel(right-8,row)[0],255);
  // Sin giro ni escala, el mismo evento tapa el fotograma entero.
  p.events[1].transform.rotationY=0;
  p.events[1].transform.scale=1;
  await compose(canvas,p,new MediaLibrary(),ticks(1),{createCanvas:factory});
  assert.equal(ctx.getImageData(2,2,1,1).data[0],255);
  // Y una pista girada (y reducida) proyecta todos sus eventos: el giro pasa del evento a la pista.
  p.events[1].transform.rotationY=0;
  p.events[1].transform.scale=1;
  p.tracks[0].transform.rotationY=20;
  p.tracks[0].transform.scale=.4;
  await compose(canvas,p,new MediaLibrary(),ticks(1),{createCanvas:factory});
  assert.equal(ctx.getImageData(0,row,1,1).data[1],255,'con la pista girada, el fondo vuelve a verse a los lados');
  assert.equal(ctx.getImageData(left+8,row,1,1).data[0],255);
});

test('3D: la máscara libre y los efectos siguen funcionando con el giro',async()=>{
  const size={width:320,height:180};
  const p=projectWith(project=>{
    const tilted=newEvent(project.tracks[0].id,'color',0,ticks(2));
    tilted.color='#ff0000';
    tilted.transform.rotationY=30;
    tilted.maskPath={points:[{x:0,y:0},{x:.5,y:0},{x:.5,y:1},{x:0,y:1}],feather:0,invert:false};
    project.events.push(tilted);
  });
  const canvas=canvasOf(size.width,size.height);
  await compose(canvas,p,new MediaLibrary(),ticks(1),{createCanvas:factory});
  const ctx=canvas.getContext('2d')!;
  // La máscara se aplica antes del giro: la mitad derecha del plano queda transparente, así que hay
  // negro a la derecha del centro y color a la izquierda.
  assert.equal(ctx.getImageData(300,90,1,1).data[0],0,'fuera de la máscara no hay color');
  assert.ok(ctx.getImageData(20,90,1,1).data[0]>200,'dentro de la máscara sí');
  // La frontera de la máscara, proyectada, cae donde dice la geometría.
  const quad=projectQuad({rotationY:30},size);
  const boundary=Math.round(projectivePoint(quad,.5,.5).x);
  assert.equal(ctx.getImageData(boundary+8,90,1,1).data[0],0);
  assert.ok(ctx.getImageData(boundary-8,90,1,1).data[0]>200);
  // Con un efecto de desenfoque la capa se sigue proyectando sin errores.
  p.events[0].effects=[{id:'e1',kind:'blur',enabled:true,amount:6,size:4,color:'#ffffff',softness:.5,horizontal:false,vertical:false}];
  p.events[0].maskPath=undefined;
  await compose(canvas,p,new MediaLibrary(),ticks(1),{createCanvas:factory});
  assert.equal(ctx.getImageData(160,90,1,1).data[0],255,'el evento desenfocado sigue proyectado');
});

test('3D: las claves de pose interpolan los giros y los proyectos viejos siguen abriendo',()=>{
  const p=newProject();
  const e=newEvent(p.tracks[0].id,'color',0,ticks(4));
  e.keys=[{...transform(),time:0,rotationY:0,depth:1},{...transform(),time:ticks(4),rotationY:80,depth:2}];
  near(pose(e,ticks(2)).rotationY??0,40,1e-6);
  near(pose(e,ticks(2)).depth??0,1.5,1e-6);
  near(pose(e,ticks(0)).rotationY??0,0,1e-6);
  // Una clave guardada antes de que existiera el 3D no tiene las claves nuevas y debe valer el neutro.
  const older=newEvent(p.tracks[0].id,'color',0,ticks(4));
  older.transform={...transform(),rotationX:undefined,rotationY:undefined,depth:undefined};
  older.keys=[{...transform(),time:0,rotationY:undefined,rotationX:undefined,depth:undefined}];
  const interpolated=pose(older,ticks(1));
  assert.equal(interpolated.rotationY,0);
  assert.equal(interpolated.depth,1);
  assert.deepEqual(pose3D(undefined),{rotationX:0,rotationY:0,depth:1});
  assert.deepEqual(pose3D({rotationY:120,depth:.5}),{rotationX:0,rotationY:120,depth:.5});
  assert.equal(pose3D({depth:0}).depth,MIN_DEPTH,'la distancia nunca llega a cero: el plano no puede pegarse al foco');
});

test('3D: la validación rechaza giros y distancias imposibles',()=>{
  const p=newProject();
  const e=newEvent(p.tracks[0].id,'color',0,ticks(2));
  p.events.push(e);
  assert.doesNotThrow(()=>validateProject(p));
  for(const bad of [{rotationY:361},{rotationX:-400},{depth:0},{depth:MAX_DEPTH+.5},{rotationY:Number.NaN}]){
    p.events[0].transform={...transform(),...bad};
    assert.throws(()=>validateProject(p),/Proyecto inválido/,'tiene que rechazar '+JSON.stringify(bad));
  }
  p.events[0].transform={...transform(),rotationY:360,rotationX:-360,depth:MAX_DEPTH};
  assert.doesNotThrow(()=>validateProject(p));
});
