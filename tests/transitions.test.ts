import {transitionJunctions} from '../lib/editor/transition-drop';
import {validateProject} from '../lib/editor/validation';
// Pruebas de las transiciones: se renderizan dos clips solapados (rojo → azul) y se mira qué hay en cada
// punto del fotograma a mitad de la transición. Así se comprueba la geometría de cada familia y las curvas de
// los fundidos, no una descripción de la geometría.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {compose} from '../lib/editor/compositor';
import {MediaLibrary} from '../lib/editor/media';
import {Project,TransitionKind,newEvent,newProject,ticks} from '../lib/editor/project';
import {TRANSITION_GROUP,TRANSITION_GROUPS,TRANSITION_KINDS,TRANSITION_LABEL,transitionAlpha,transitionProgress,isDissolve,isGeometric,isSlide,isSqueeze,isZoom} from '../lib/editor/transitions';

const factory=(width:number,height:number)=>createCanvas(width,height) as unknown as HTMLCanvasElement;
const SIZE=32;
const OUT='#ff0000', IN='#0000ff';

// Dos clips solapados un segundo en la misma pista: el rojo sale y el azul entra con la transición pedida.
function overlap(kind:TransitionKind):Project{
  const project=newProject();
  project.width=SIZE;project.height=SIZE;
  const track=project.tracks[1].id;
  const outgoing=newEvent(track,'color',0,ticks(2));
  outgoing.color=OUT;outgoing.name='Saliente';outgoing.fadeOut=ticks(1);
  const incoming=newEvent(track,'color',ticks(1),ticks(2));
  incoming.color=IN;incoming.name='Entrante';incoming.fadeIn=ticks(1);incoming.transition=kind;
  project.events.push(outgoing,incoming);
  return project;
}
async function render(project:Project,seconds:number){
  const canvas=createCanvas(SIZE,SIZE);
  await compose(canvas as unknown as HTMLCanvasElement,project,new MediaLibrary(),ticks(seconds),{createCanvas:factory});
  const ctx=canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
  return {ctx,at:(x:number,y:number)=>Array.from(ctx.getImageData(x,y,1,1).data).slice(0,3) as [number,number,number]};
}
const blue=(pixel:[number,number,number])=>pixel[2]>200&&pixel[0]<60;
const red=(pixel:[number,number,number])=>pixel[0]>200&&pixel[2]<60;
const mixed=(pixel:[number,number,number])=>pixel[0]>60&&pixel[0]<200&&pixel[2]>60&&pixel[2]<200;

test('catálogo: cuarenta transiciones con nombre y familia',()=>{
  assert.equal(TRANSITION_KINDS.length,40);
  for(const kind of TRANSITION_KINDS){
    assert.ok(TRANSITION_LABEL[kind],`falta el nombre de ${kind}`);
    assert.ok(TRANSITION_GROUP[kind],`falta la familia de ${kind}`);
    assert.ok(TRANSITION_GROUPS.includes(TRANSITION_GROUP[kind]),`la familia ${TRANSITION_GROUP[kind]} no está en la lista de la pestaña`);
  }
  assert.equal(new Set(TRANSITION_KINDS).size,TRANSITION_KINDS.length,'no hay transiciones repetidas');
  assert.equal(isDissolve('dissolve-slow'),true);
  assert.equal(isDissolve('dissolve-smooth'),true);
  assert.equal(isSlide('slide-from-top'),true);
  assert.equal(isSqueeze('squeeze-from-right'),true);
  assert.equal(isSqueeze('squeeze-from-top'),true);
  assert.equal(isZoom('zoom-in'),true);
  assert.equal(isGeometric('wipe-from-left'),true);
  assert.equal(isGeometric('slide-from-left'),false);
  assert.equal(isGeometric('zoom-out'),false,'el zoom no recorta: escala');
});

test('curvas: el fundido lento entra más despacio que el lineal y el brusco más deprisa',()=>{
  assert.equal(transitionAlpha('dissolve-linear',.5),.5);
  assert.ok(transitionAlpha('dissolve-slow',.5)<.4);
  assert.ok(transitionAlpha('dissolve-fast',.5)>.6);
  assert.equal(transitionAlpha('wipe-from-left',.5),1,'las geométricas no atenúan: recortan');
  assert.equal(transitionAlpha('dissolve-linear',2),1);
  assert.equal(transitionAlpha('dissolve-linear',-1),0);
});

test('ventana: la transición dura lo que el fundido de entrada y fuera de ella no hay transición',()=>{
  assert.equal(transitionProgress(0,1000),0);
  assert.equal(transitionProgress(500,1000),.5);
  assert.equal(transitionProgress(1000,1000),1);
  assert.equal(transitionProgress(1500,1000),null);
  assert.equal(transitionProgress(-1,1000),null);
  assert.equal(transitionProgress(10,0),null,'sin fundido de entrada no hay ventana');
});

test('fundido lineal: a mitad se ven los dos clips mezclados, y el saliente sigue opaco debajo',async()=>{
  const {at}=await render(overlap('dissolve-linear'),1.5);
  assert.ok(mixed(at(16,16)),`esperaba mezcla y salió ${at(16,16)}`);
  const plain=await render(overlap('dissolve-linear'),1.999);
  assert.ok(blue(plain.at(16,16)));
});

test('fundido lento y brusco: la misma mitad de tiempo da menos y más imagen entrante',async()=>{
  const slow=await render(overlap('dissolve-slow'),1.5);
  const fast=await render(overlap('dissolve-fast'),1.5);
  const linear=await render(overlap('dissolve-linear'),1.5);
  const redOf=([r]:[number,number,number])=>r;
  assert.ok(redOf(slow.at(16,16))>redOf(linear.at(16,16)),'el lento deja más rojo (entra más tarde)');
  assert.ok(redOf(fast.at(16,16))<redOf(linear.at(16,16)),'el brusco deja menos rojo (entra antes)');
});

test('barridos: la mitad ya está invadida y la otra mitad conserva el clip anterior',async()=>{
  const left=await render(overlap('wipe-from-left'),1.5);
  assert.ok(blue(left.at(8,16))&&red(left.at(24,16)),`barrido desde la izquierda: ${left.at(8,16)} / ${left.at(24,16)}`);
  const right=await render(overlap('wipe-from-right'),1.5);
  assert.ok(red(right.at(8,16))&&blue(right.at(24,16)));
  const top=await render(overlap('wipe-from-top'),1.5);
  assert.ok(blue(top.at(16,8))&&red(top.at(16,24)));
  const bottom=await render(overlap('wipe-from-bottom'),1.5);
  assert.ok(red(bottom.at(16,8))&&blue(bottom.at(16,24)));
});

test('barrido con degradado: el borde no es un canto recto',async()=>{
  const {at}=await render(overlap('gradient-wipe'),1.5);
  assert.ok(blue(at(2,16)),'el extremo ya entró');
  assert.ok(red(at(30,16)),'el otro extremo todavía no');
  assert.ok(mixed(at(15,16))||mixed(at(17,16)),`el borde va a medias y salió ${at(15,16)} / ${at(17,16)}`)
});

test('deslizar: el clip entrante ocupa la mitad hacia la que entra',async()=>{
  const left=await render(overlap('slide-from-left'),1.5);
  assert.ok(blue(left.at(8,16))&&red(left.at(24,16)));
  const top=await render(overlap('slide-from-top'),1.5);
  assert.ok(blue(top.at(16,8))&&red(top.at(16,24)));
  const full=await render(overlap('slide-from-left'),1.999);
  assert.ok(blue(full.at(2,16))&&blue(full.at(30,16)),'al final ya está entero');
});

test('comprimir: el clip entrante se estruja desde el borde por el que entra',async()=>{
  const {at}=await render(overlap('squeeze-from-left'),1.5);
  assert.ok(blue(at(8,16)),'la mitad comprimida está a la izquierda');
  assert.ok(red(at(24,16)),'y el resto sigue siendo el anterior');
});

test('persianas: las lamas se abren desde su centro',async()=>{
  const {at}=await render(overlap('blinds-vertical'),1.5);
  // Siete lamas de unos 4,6 px: el centro de la primera está abierto y su extremo aún no.
  assert.ok(blue(at(2,16)),`el centro de la primera lama debería estar abierto: ${at(2,16)}`);
  assert.ok(red(at(0,16)),`el extremo de la lama todavía no: ${at(0,16)}`);
  const horizontal=await render(overlap('blinds-horizontal'),1.5);
  assert.ok(blue(horizontal.at(16,2))&&red(horizontal.at(16,0)));
  // Las venecianas son 24 lamas finas: a este tamaño de fotograma el resultado es un peine muy fino.
  const venecianas=await render(overlap('blinds-venetian'),1.5);
  const linear=(await render(overlap('dissolve-linear'),1.5)).at(1,16);
  const fine=venecianas.at(1,16);
  assert.ok(mixed(fine),`las lamas finas dejan una mezcla: ${fine}`);
  assert.notDeepEqual(fine,linear,'y no es lo mismo que un fundido lineal');
});

test('tablero: las casillas entran por oleadas, no todas a la vez',async()=>{
  const {at}=await render(overlap('checkerboard'),1.5);
  assert.ok(blue(at(2,2)),`la primera casilla ya entró: ${at(2,2)}`);
  assert.ok(red(at(30,30)),`la última todavía no: ${at(30,30)}`);
});

test('remolino: al principio no se ve nada del clip entrante y al final se ve entero',async()=>{
  // El centro exacto siempre queda dentro (el radio es 0 al empezar), así que se sondea fuera del centro.
  const start=await render(overlap('spiral'),1.001);
  assert.ok(red(start.at(8,8)),`al empezar manda el saliente: ${start.at(8,8)}`);
  const end=await render(overlap('spiral'),1.999);
  assert.ok(blue(end.at(8,8))&&blue(end.at(16,16)),`al terminar manda el entrante: ${end.at(8,8)}`);
});

test('sin transición, el fundido de entrada sigue siendo el de siempre',async()=>{
  const project=overlap('dissolve-linear');
  delete project.events[1].transition;
  const {at}=await render(project,1.5);
  assert.ok(mixed(at(16,16)),'la rampa lineal también mezcla a mitad');
  const slow=overlap('dissolve-slow');
  assert.equal(await render(slow,0.5).then(r=>red(r.at(16,16))),true,'antes del solape solo está el saliente');
});

// ---------------------------------------------------------------- familias nuevas (ronda 18)

test('fundidos nuevos: el suave entra más tarde al principio y el rápido antes que el lineal',()=>{
  assert.ok(transitionAlpha('dissolve-smooth',.25)<.25,'el suave arranca despacio');
  assert.ok(transitionAlpha('dissolve-smooth',.75)>.75,'y termina despacio');
  assert.equal(transitionAlpha('dissolve-smooth',.5),.5,'pero pasa por la mitad');
  assert.ok(transitionAlpha('dissolve-quick',.5)>.8,'el rápido deja casi todo el cambio para el final');
});

test('fundidos nuevos: a mitad de la transición el suave deja más saliente y el rápido menos',async()=>{
  const smooth=await render(overlap('dissolve-smooth'),1.25);
  const quick=await render(overlap('dissolve-quick'),1.25);
  const linear=await render(overlap('dissolve-linear'),1.25);
  const redOf=([r]:[number,number,number])=>r;
  assert.ok(redOf(smooth.at(16,16))>redOf(linear.at(16,16)),'el suave va por detrás del lineal al cuarto de camino');
  assert.ok(redOf(quick.at(16,16))<redOf(linear.at(16,16)),'el rápido va por delante');
});

test('barridos de salida: el clip anterior se retira hacia su lado y el entrante aparece por el contrario',async()=>{
  const left=await render(overlap('wipe-out-left'),1.5);
  assert.ok(red(left.at(8,16))&&blue(left.at(24,16)),`salida por la izquierda: ${left.at(8,16)} / ${left.at(24,16)}`);
  const right=await render(overlap('wipe-out-right'),1.5);
  assert.ok(blue(right.at(8,16))&&red(right.at(24,16)));
  const top=await render(overlap('wipe-out-top'),1.5);
  assert.ok(red(top.at(16,8))&&blue(top.at(16,24)));
  const bottom=await render(overlap('wipe-out-bottom'),1.5);
  assert.ok(blue(bottom.at(16,8))&&red(bottom.at(16,24)));
  // Al empezar todavía no se ha retirado nada y al terminar el entrante cubre el fotograma.
  const start=await render(overlap('wipe-out-left'),1.001);
  assert.ok(red(start.at(4,16))&&red(start.at(28,16)),'al principio manda el saliente');
  const end=await render(overlap('wipe-out-left'),1.999);
  assert.ok(blue(end.at(4,16))&&blue(end.at(28,16)),'y al final el entrante está entero');
});

test('iris y espiral: el círculo se abre desde el centro y el rombo también',async()=>{
  const circle=await render(overlap('iris-circle'),1.5);
  assert.ok(blue(circle.at(16,16)),`el centro ya está abierto: ${circle.at(16,16)}`);
  assert.ok(red(circle.at(0,0)),`la esquina todavía no: ${circle.at(0,0)}`);
  const end=await render(overlap('iris-circle'),1.999);
  assert.ok(blue(end.at(0,0))&&blue(end.at(31,31)),'al final ya está entero');
  const diamond=await render(overlap('iris-diamond'),1.5);
  assert.ok(blue(diamond.at(16,16)),'el rombo también sale del centro');
  assert.ok(red(diamond.at(2,2)),`y por la esquina todavía no ha llegado: ${diamond.at(2,2)}`);
});

test('espiral exterior: al principio no se ve nada y al final se ve entero',async()=>{
  const start=await render(overlap('spiral-out'),1.001);
  assert.ok(red(start.at(8,8))&&red(start.at(16,16)),'la espiral exterior empieza sin el entrante');
  const end=await render(overlap('spiral-out'),1.999);
  assert.ok(blue(end.at(8,8))&&blue(end.at(16,16)),'y termina con el entrante entero');
});

test('persianas nuevas: inclinadas, superpuestas y torcidas se distinguen del fundido y de las de siempre',async()=>{
  const linear=(await render(overlap('dissolve-linear'),1.5)).at(16,16);
  for(const kind of ['blinds-slanted','blinds-twisted'] as const){
    const {at}=await render(overlap(kind),1.5);
    // Con lamas finas cada píxel es una mezcla, así que se mira de qué color tira cada zona, no si es puro.
    const pixels=[at(4,4),at(16,16),at(28,28),at(4,28),at(28,4),at(8,24)];
    assert.ok(pixels.some(p=>p[2]>p[0]),`${kind} deja zonas entrantes: ${JSON.stringify(pixels)}`);
    assert.ok(pixels.some(p=>p[0]>p[2]),`${kind} deja zonas salientes: ${JSON.stringify(pixels)}`);
  }
  // Las superpuestas van en dos tandas que se cruzan: a mitad de camino el fotograma tiene franjas de las dos
  // capas, así que hay píxeles entrantes, salientes y mezclas, y todavía no ha entrado todo.
  const {ctx}=await render(overlap('blinds-stacked'),1.5);
  const pixels=ctx.getImageData(0,0,SIZE,SIZE).data;
  let entrantes=0,salientes=0;
  for(let index=0;index<pixels.length;index+=4){
    const [r,,b]=[pixels[index],pixels[index+1],pixels[index+2]];
    if(b>r+40)entrantes+=1;else if(r>b+40)salientes+=1;
  }
  assert.ok(entrantes>0&&salientes>0,`las dos capas conviven: ${entrantes} entrantes y ${salientes} salientes`);
  assert.ok(entrantes<SIZE*SIZE*.95,`y todavía no ha entrado todo (${entrantes} de ${SIZE*SIZE})`);
  assert.notDeepEqual((await render(overlap('blinds-stacked'),1.5)).at(16,16),linear,'no es un fundido lineal');
});

test('zoom: el clip entrante se escala desde el centro y deja ver el saliente alrededor',async()=>{
  const zoomIn=await render(overlap('zoom-in'),1.1);
  assert.ok(red(zoomIn.at(1,1))&&red(zoomIn.at(30,30)),`las esquinas siguen siendo del saliente: ${zoomIn.at(1,1)}`);
  assert.ok(blue(zoomIn.at(16,16)),'el centro ya es del entrante');
  const end=await render(overlap('zoom-in'),1.999);
  assert.ok(blue(end.at(1,1))&&blue(end.at(30,30)),'al final ocupa el fotograma entero');
  // Alejar llega desde más grande: al principio el entrante ya tapa las esquinas y el centro.
  const zoomOut=await render(overlap('zoom-out'),1.02);
  assert.ok(blue(zoomOut.at(2,2))&&blue(zoomOut.at(29,29)),'alejar empieza cubriendo todo');
});

test('comprimir en vertical: el clip se estruja desde el borde por el que entra',async()=>{
  const top=await render(overlap('squeeze-from-top'),1.5);
  assert.ok(blue(top.at(16,8)),'la mitad comprimida está arriba');
  assert.ok(red(top.at(16,24)),'y el resto sigue siendo el anterior');
  const bottom=await render(overlap('squeeze-from-bottom'),1.5);
  assert.ok(red(bottom.at(16,8))&&blue(bottom.at(16,24)));
});

test('despegado de página: la esquina superior derecha entra primero y la inferior izquierda después',async()=>{
  const {at}=await render(overlap('page-peel'),1.5);
  assert.ok(blue(at(30,28)),`la zona de arriba a la derecha ya entró: ${at(30,28)}`);
  assert.ok(red(at(4,6)),`la de abajo a la izquierda todavía no: ${at(4,6)}`);
  const end=await render(overlap('page-peel'),1.999);
  assert.ok(blue(end.at(1,1))&&blue(end.at(31,31)),'al final la página está entera');
  const start=await render(overlap('page-peel'),1.001);
  assert.ok(red(start.at(30,2)),'al principio no se ve nada del entrante');
});

test('todas las transiciones del catálogo entran sin dejar el fotograma a medias al terminar',async()=>{
  for(const kind of TRANSITION_KINDS){
    const end=await render(overlap(kind),1.999);
    assert.ok(blue(end.at(4,4))&&blue(end.at(16,16))&&blue(end.at(28,28)),`${kind} no termina cubriendo el fotograma`);
  }
});


test('corte: + solo entre clips contiguos, omite huecos, solapamientos y bloqueos',()=>{
 const p=overlap('dissolve-linear');const [a,b]=p.events;b.start=a.start+a.duration;
 assert.equal(transitionJunctions(p.events,p.fps).length,1);
 b.start+=ticks(1);assert.equal(transitionJunctions(p.events,p.fps).length,0);
 b.start-=ticks(2);assert.equal(transitionJunctions(p.events,p.fps).length,0);
 b.start=a.start+a.duration;b.locked=true;assert.equal(transitionJunctions(p.events,p.fps).length,0);
});
test('corte contiguo mezcla ambos clips sin mover sus tiempos y persiste',async()=>{
 const p=overlap('dissolve-linear');const [a,b]=p.events;b.start=ticks(2);a.fadeOut=0;
 const before=JSON.stringify(p);
 const frame=await render(p,2.5);assert.ok(mixed(frame.at(16,16)),String(frame.at(16,16)));
 assert.equal(JSON.stringify(p),before);
 b.locked=true;const locked=await render(p,2.5);assert.ok(mixed(locked.at(16,16)));
 for(const kind of ['punch-zoom','spin-pop','whip-right','flash-white'] as const){
  b.transition=kind;const saved=validateProject(JSON.parse(JSON.stringify(p)));
  assert.equal(saved.events[1].transition,kind);
  const start=await render(p,2);assert.ok(red(start.at(16,16)),kind);
  const end=await render(p,3.01);assert.ok(blue(end.at(16,16)),kind);
 }
});
test('destello blanco ilumina realmente la mezcla a mitad del corte',async()=>{
 const p=overlap('flash-white');p.events[1].start=ticks(2);
 const frame=await render(p,2.5);assert.ok(frame.at(16,16)[1]>100);
});
