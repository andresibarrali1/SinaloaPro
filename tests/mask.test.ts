// Pruebas de las máscaras libres: geometría del trazado y —lo importante— que recorte de verdad los píxeles
// del evento, con pluma e inversión, renderizando con el mismo compositor de la vista previa y la exportación.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {compose} from '../lib/editor/compositor';
import {MediaLibrary} from '../lib/editor/media';
import {MaskPath,newEvent,newMaskPath,newProject,ticks} from '../lib/editor/project';
import {MAX_MASK_POINTS,addMaskPoint,applyMaskPath,clearMask,maskActive,normalizeMaskPath,maskPointAt,moveMaskPoint,removeMaskPoint} from '../lib/editor/mask';

const factory=(width:number,height:number)=>createCanvas(width,height) as unknown as HTMLCanvasElement;
const SIZE=64;
// Un triángulo que cubre la esquina superior izquierda: x + y <= 1 en fracciones.
const triangle:MaskPoint[]=[{x:0,y:0},{x:1,y:0},{x:0,y:1}];
type MaskPoint={x:number;y:number};

test('geometría: añadir, mover, quitar, vaciar y buscar el punto más cercano',()=>{
  let path:MaskPath|undefined=newMaskPath();
  assert.equal(maskActive(path),false,'con menos de tres puntos no hay máscara');
  path=addMaskPoint(path,{x:.2,y:.2});
  path=addMaskPoint(path,{x:.8,y:.2});
  path=addMaskPoint(path,{x:.5,y:.8});
  assert.equal(path.points.length,3);
  assert.equal(maskActive(path),true);
  assert.deepEqual(path.points[0],{x:.2,y:.2});
  // Los puntos se acotan al fotograma.
  path=addMaskPoint(path,{x:-4,y:9});
  assert.deepEqual(path.points[3],{x:0,y:1});
  path=moveMaskPoint(path,0,{x:.4,y:-1});
  assert.deepEqual(path.points[0],{x:.4,y:0});
  assert.deepEqual(moveMaskPoint(path,99,{x:0,y:0}).points.length,4,'un índice que no existe no cambia nada');
  path=removeMaskPoint(path,1);
  assert.equal(path.points.length,3);
  assert.equal(maskPointAt(path,{x:.41,y:.01},.05),0,'encuentra el punto más cercano');
  assert.equal(maskPointAt(path,{x:.9,y:.9},.05),-1,'y devuelve -1 si no hay ninguno cerca');
  assert.equal(clearMask(path).points.length,0);
  assert.deepEqual(normalizeMaskPath(undefined),{points:[],feather:0,invert:false});
  // El límite de puntos evita trazados imposibles.
  let big=newMaskPath();
  for(let index=0;index<MAX_MASK_POINTS+5;index++)big=addMaskPoint(big,{x:index/100,y:.5});
  assert.equal(big.points.length,MAX_MASK_POINTS);
});

async function renderWithMask(maskPath?:MaskPath){
  const library=new MediaLibrary();
  const image=createCanvas(SIZE,SIZE);
  const ctx=image.getContext('2d');
  ctx.fillStyle='#ff0000';ctx.fillRect(0,0,SIZE,SIZE);
  library.items.set('i',{file:{} as File,firstVideo:0,image:image as unknown as ImageBitmap});
  const project=newProject();
  project.width=SIZE;project.height=SIZE;
  const event=newEvent(project.tracks[1].id,'image',0,ticks(2));
  event.mediaId='i';
  if(maskPath)event.maskPath=maskPath;
  project.events.push(event);
  const canvas=createCanvas(SIZE,SIZE);
  await compose(canvas as unknown as HTMLCanvasElement,project,library,ticks(1),{createCanvas:factory});
  const data=canvas.getContext('2d').getImageData(0,0,SIZE,SIZE).data;
  return (x:number,y:number)=>Array.from(data.slice((y*SIZE+x)*4,(y*SIZE+x)*4+3)) as [number,number,number];
}
const red=(pixel:[number,number,number])=>pixel[0]>200&&pixel[2]<60;
const black=(pixel:[number,number,number])=>pixel[0]<40&&pixel[1]<40&&pixel[2]<40;

test('sin máscara no se recorta nada',async()=>{
  const at=await renderWithMask();
  assert.ok(red(at(8,8))&&red(at(SIZE-8,SIZE-8)));
});

test('la máscara recorta el evento y deja ver lo de debajo',async()=>{
  const at=await renderWithMask({points:triangle,feather:0,invert:false});
  assert.ok(red(at(8,8)),'dentro del triángulo se ve la imagen');
  assert.ok(black(at(SIZE-8,SIZE-8)),'fuera del triángulo queda transparente (fondo negro)');
  assert.ok(black(at(SIZE-8,8)),'y tampoco se cuela por la esquina opuesta');
});

test('invertir la máscara deja justo lo contrario',async()=>{
  const at=await renderWithMask({points:triangle,feather:0,invert:true});
  assert.ok(black(at(8,8)),'lo de dentro se perfora');
  assert.ok(red(at(SIZE-8,SIZE-8)),'y lo de fuera se conserva');
});

test('la pluma suaviza el borde en lugar de cortarlo',async()=>{
  const hard=await renderWithMask({points:triangle,feather:0,invert:false});
  const soft=await renderWithMask({points:triangle,feather:6,invert:false});
  // Un punto sobre la hipotenusa (x + y = ancho): con pluma queda a medias.
  const edge=[hard(32,32),soft(32,32)] as [number,number,number][];
  assert.ok(red(edge[0])||black(edge[0]),'sin pluma el borde es duro: o se ve o no se ve');
  const [r] = edge[1];
  assert.ok(r>20&&r<220,`con pluma el borde queda a medias y salió ${r}`);
});

test('la máscara se combina con los efectos: primero el recorte, después el color',async()=>{
  const library=new MediaLibrary();
  const image=createCanvas(SIZE,SIZE);
  const ctx=image.getContext('2d');
  ctx.fillStyle='#ff0000';ctx.fillRect(0,0,SIZE,SIZE);
  library.items.set('i',{file:{} as File,firstVideo:0,image:image as unknown as ImageBitmap});
  const project=newProject();
  project.width=SIZE;project.height=SIZE;
  const event=newEvent(project.tracks[1].id,'image',0,ticks(2));
  event.mediaId='i';
  event.maskPath={points:triangle,feather:0,invert:false};
  event.effects=[{id:'fx',kind:'invert',enabled:true,amount:1,size:0,color:'#000000',softness:0,horizontal:false,vertical:false}];
  project.events.push(event);
  const canvas=createCanvas(SIZE,SIZE);
  await compose(canvas as unknown as HTMLCanvasElement,project,library,ticks(1),{createCanvas:factory});
  const data=canvas.getContext('2d').getImageData(0,0,SIZE,SIZE).data;
  const pixel=(x:number,y:number)=>Array.from(data.slice((y*SIZE+x)*4,(y*SIZE+x)*4+3)) as [number,number,number];
  assert.deepEqual(pixel(8,8),[0,255,255],'dentro del triángulo y con la inversión aplicada');
  assert.ok(black(pixel(SIZE-8,SIZE-8)),'fuera sigue transparente');
  // La función de recorte también se puede usar suelta sobre un lienzo.
  const layer=createCanvas(SIZE,SIZE);
  const layerCtx=layer.getContext('2d');
  layerCtx.fillStyle='#00ff00';layerCtx.fillRect(0,0,SIZE,SIZE);
  applyMaskPath(layer as unknown as HTMLCanvasElement,{points:triangle,feather:0,invert:false},{width:SIZE,height:SIZE,scale:1,createCanvas:factory});
  const masked=layerCtx.getImageData(8,8,1,1).data;
  assert.equal(masked[3],255,'dentro se conserva el alfa');
  assert.equal(layerCtx.getImageData(SIZE-8,SIZE-8,1,1).data[3],0,'fuera el alfa se va a cero');
});
