// Pruebas de las transiciones premium: geometría, transformaciones y destellos, medidas sobre dos clips
// rojo y azul reales a mitad de la transición.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {compose} from '../lib/editor/compositor';
import {MediaLibrary} from '../lib/editor/media';
import {newEvent,newProject,ticks,type TransitionKind} from '../lib/editor/project';
import {TRANSITION_GROUP,TRANSITION_LABEL,TRANSITION_NOTE,TRANSITION_KINDS,isGeometric,isTransformOnly} from '../lib/editor/transitions';

const factory=(width:number,height:number)=>createCanvas(width,height) as unknown as HTMLCanvasElement;
const SIZE=64;
const PREMIUM:TransitionKind[]=['zoom-blur','flip-3d','whip-left','diagonal-wipe','split-open','glitch-slices','light-leak','film-burn','flash-black'];

function overlap(kind:TransitionKind){
 const project=newProject();project.width=SIZE;project.height=SIZE;
 const track=project.tracks[1].id;
 const outgoing=newEvent(track,'color',0,ticks(2));outgoing.color='#ff0000';outgoing.name='Saliente';outgoing.fadeOut=ticks(1);
 const incoming=newEvent(track,'color',ticks(1),ticks(2));incoming.color='#0000ff';incoming.name='Entrante';incoming.fadeIn=ticks(1);incoming.transition=kind;
 project.events.push(outgoing,incoming);
 return project;
}
async function render(kind:TransitionKind,seconds:number){
 const canvas=createCanvas(SIZE,SIZE);
 await compose(canvas as unknown as HTMLCanvasElement,overlap(kind),new MediaLibrary(),ticks(seconds),{createCanvas:factory});
 const ctx=canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
 const at=(x:number,y:number)=>Array.from(ctx.getImageData(x,y,1,1).data).slice(0,3) as [number,number,number];
 const data=ctx.getImageData(0,0,SIZE,SIZE).data;
 return {at,data};
}
const blue=(p:[number,number,number])=>p[2]>180&&p[0]<80;
const red=(p:[number,number,number])=>p[0]>180&&p[2]<80;
const warm=(p:[number,number,number])=>p[0]>p[2]+20;

test('catálogo premium: nueve transiciones con nombre, familia y nota honesta',()=>{
 for(const kind of PREMIUM){
  assert.ok(TRANSITION_KINDS.includes(kind),`${kind} no está en el catálogo`);
  assert.ok(TRANSITION_LABEL[kind]);
  assert.equal(TRANSITION_GROUP[kind],'Premium');
  assert.ok(TRANSITION_NOTE[kind]!.length>40,`${kind} no explica su aproximación`);
 }
 assert.equal(isTransformOnly('flip-3d'),true);
 assert.equal(isTransformOnly('whip-left'),true);
 assert.equal(isGeometric('glitch-slices'),true);
 assert.equal(isGeometric('split-open'),true);
});

test('apertura central: a mitad, el centro ya es del clip entrante y los lados no',async()=>{
 const {at}=await render('split-open',1.5);
 assert.ok(blue(at(32,32)),'centro entrante');
 assert.ok(red(at(2,32))&&red(at(61,32)),'lados salientes');
});

test('barrido diagonal: la esquina superior izquierda entra antes que la inferior derecha',async()=>{
 const {at}=await render('diagonal-wipe',1.5);
 assert.ok(blue(at(2,2)),'esquina superior izquierda entrante');
 assert.ok(red(at(61,61)),'esquina inferior derecha saliente');
});

test('glitch: a mitad hay franjas del clip entrante mezcladas con el saliente',async()=>{
 const {data}=await render('glitch-slices',1.5);
 const rows={blue:0,red:0};
 for(let y=0;y<SIZE;y++){
  const index=(y*SIZE+32)*4;
  if(data[index+2]>180&&data[index]<80)rows.blue++;
  if(data[index]>180&&data[index+2]<80)rows.red++;
 }
 assert.ok(rows.blue>5,`filas azules (${rows.blue})`);
 assert.ok(rows.red>5,`filas rojas (${rows.red})`);
});

test('destello negro: a mitad oscurece los dos clips y al final entra el entrante',async()=>{
 const mid=await render('flash-black',1.5);
 const [r,g,b]=mid.at(32,32);
 assert.ok(r<25&&g<25&&b<75,`debería quedar muy oscuro (${r},${g},${b})`);
 const end=await render('flash-black',1.95);
 assert.ok(blue(end.at(32,32)),'al final se ve el clip entrante');
});

test('zoom con desenfoque: el centro entra y los bordes conservan el clip anterior',async()=>{
 const {at}=await render('zoom-blur',1.5);
 assert.ok(blue(at(32,32)),'centro entrante');
 assert.ok(red(at(1,1)),'esquina saliente');
});

test('giro 3D y barrido izquierdo: el clip entrante ocupa su mitad sin recortar el fotograma al final',async()=>{
 const flip=await render('flip-3d',1.5);
 assert.ok(blue(flip.at(32,32)),'centro del giro');
 assert.ok(red(flip.at(2,32))&&red(flip.at(61,32)),'los lados siguen siendo del saliente');
 const whip=await render('whip-left',1.5);
 assert.ok(blue(whip.at(10,32))||blue(whip.at(32,32)));
 assert.ok(red(whip.at(62,32)),'queda saliente por la derecha');
 for(const kind of ['flip-3d','whip-left'] as TransitionKind[]){
  const end=await render(kind,1.95);
  assert.ok(blue(end.at(32,32)),`${kind} termina con el entrante`);
 }
});

test('fuga de luz y quemado: a mitad hay tonos cálidos, no solo rojo y azul',async()=>{
 for(const kind of ['light-leak','film-burn'] as TransitionKind[]){
  const {data}=await render(kind,1.5);
  let warmish=0;
  for(let i=0;i<data.length;i+=4)if(data[i]>100&&data[i]>data[i+2]+20)warmish++;
  assert.ok(warmish>100,`${kind} debería teñir de cálido (${warmish})`);
 }
});

test('todas las premium terminan cubriendo el fotograma',async()=>{
 for(const kind of PREMIUM){
  const end=await render(kind,1.95);
  assert.ok(blue(end.at(32,32)),`${kind} no termina con el entrante en el centro`);
 }
});
