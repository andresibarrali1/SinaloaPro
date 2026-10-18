// Pruebas de la pila de efectos de vídeo y de los generadores de medios.
//
// Se renderiza de verdad con el mismo compositor que usan la vista previa y la exportación, sobre el lienzo
// de @napi-rs/canvas, y se comprueban los píxeles resultantes: nada de «parece que aplica». La fábrica de
// lienzos se inyecta porque en Node no hay `document`.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {compose} from '../lib/editor/compositor';
import {MediaLibrary} from '../lib/editor/media';
import {Project,VideoEffect,VideoEffectKind,generator,newEvent,newProject,ticks} from '../lib/editor/project';
import {EFFECT_KINDS,EFFECT_LABEL,EFFECT_PARAMS,activeEffects,defaultEffect,describeEffect,detectFilterSupport,normalizeEffect,normalizeEffects,usesLayer} from '../lib/editor/effects';

const factory=(width:number,height:number)=>createCanvas(width,height) as unknown as HTMLCanvasElement;
const SIZE=32;
const px=(ctx:CanvasRenderingContext2D,x:number,y:number)=>Array.from(ctx.getImageData(x,y,1,1).data) as [number,number,number,number];

function base(color:string):Project{
  const project=newProject();
  project.width=SIZE;project.height=SIZE;
  const event=newEvent(project.tracks[1].id,'color');
  event.color=color;event.name='Fondo';
  project.events.push(event);
  return project;
}
function withEffects(project:Project,effects:VideoEffect[]){
  project.events[0].effects=effects;
  return project;
}
async function render(project:Project,library=new MediaLibrary()){
  const canvas=createCanvas(SIZE,SIZE);
  const notes:string[]=[];
  await compose(canvas as unknown as HTMLCanvasElement,project,library,ticks(1),{createCanvas:factory,notes});
  return {ctx:canvas.getContext('2d') as unknown as CanvasRenderingContext2D,notes};
}
// Un medio de prueba: se pinta lo que pida la función y se registra en la biblioteca.
function mediaLibrary(paint:(ctx:CanvasRenderingContext2D)=>void){
  const library=new MediaLibrary();
  const image=createCanvas(SIZE,SIZE);
  paint(image.getContext('2d') as unknown as CanvasRenderingContext2D);
  library.items.set('i',{file:{} as File,firstVideo:0,image:image as unknown as ImageBitmap});
  return library;
}
function imageEvent(project:Project,effects?:VideoEffect[]){
  const event=newEvent(project.tracks[1].id,'image');
  event.mediaId='i';event.name='Imagen';
  if(effects)event.effects=effects;
  project.events.push(event);
  return event;
}

test('catálogo: los diez efectos tienen nombre, descripción y parámetros',()=>{
  assert.equal(EFFECT_KINDS.length,10);
  for(const kind of EFFECT_KINDS){
    assert.ok(EFFECT_LABEL[kind],`falta el nombre de ${kind}`);
    assert.ok(EFFECT_PARAMS[kind].length,`faltan los parámetros de ${kind}`);
    const effect=defaultEffect(kind,'fx');
    assert.equal(effect.kind,kind);
    assert.equal(effect.enabled,true);
    assert.match(effect.color,/^#[0-9a-f]{6}$/i);
    assert.match(describeEffect(effect),new RegExp(EFFECT_LABEL[kind]));
  }
});

test('normalizar: los valores fuera de rango se recortan y los inválidos caen al valor por defecto',()=>{
  const clamped=normalizeEffect({kind:'blur',amount:999,size:-5,softness:4,color:'no-es-color'});
  assert.equal(clamped.amount,100);
  assert.equal(clamped.size,0);
  assert.equal(clamped.softness,1);
  assert.equal(clamped.color,defaultEffect('blur','x').color);
  assert.equal(normalizeEffect({kind:'pixelate',enabled:false}).enabled,false);
  assert.equal(normalizeEffect({kind:'mirror',horizontal:false,vertical:true}).vertical,true);
  assert.equal(normalizeEffects([{kind:'invert'},{kind:'sepia'}]).length,2);
  assert.equal(normalizeEffects([{kind:'invert'},null as unknown as {kind:VideoEffectKind}]).length,1);
});

test('pila: los efectos apagados no se aplican pero siguen guardados',()=>{
  const on=defaultEffect('invert','a'),off={...defaultEffect('invert','b'),enabled:false};
  assert.equal(activeEffects([on,off]).length,1);
  assert.equal(activeEffects([off]).length,0);
  assert.equal(usesLayer([on]),true);
  assert.equal(usesLayer([off]),false);
  assert.equal(usesLayer(undefined),false);
});

test('filtros: el motor de las pruebas aplica los filtros de Canvas (el desenfoque los necesita)',()=>{
  assert.equal(detectFilterSupport(factory),true);
});

test('blanco y negro: la cantidad de fusión lleva el color al gris',()=>{
  const gray=(r:number,g:number,b:number)=>Math.abs(r-g)<2&&Math.abs(g-b)<2;
  return render(withEffects(base('#ff0000'),[normalizeEffect({kind:'blackAndWhite',amount:1,id:'fx'})])).then(({ctx})=>{
    const [r,g,b]=px(ctx,16,16);
    assert.ok(gray(r,g,b),`esperaba gris y salió ${r},${g},${b}`);
    assert.ok(r>50&&r<70,'el gris de un rojo puro es oscuro');
  }).then(()=>render(withEffects(base('#ff0000'),[normalizeEffect({kind:'blackAndWhite',amount:.5,id:'fx'})])).then(({ctx})=>{
    const [r,g,b]=px(ctx,16,16);
    assert.ok(r>150,'a medias el rojo sigue mandando');
    assert.ok(Math.abs(r-g)>60,'y no es gris del todo');
    assert.ok(Math.abs(g-b)<2,'verde y azul suben lo mismo: solo se les añade la luminancia');
  }));
});

test('invertir y sepia: uno da la vuelta a los canales y el otro calienta la imagen',async()=>{
  const inverted=await render(withEffects(base('#ff0000'),[normalizeEffect({kind:'invert',amount:1,id:'fx'})]));
  assert.deepEqual(px(inverted.ctx,16,16).slice(0,3),[0,255,255]);
  const half=await render(withEffects(base('#000000'),[normalizeEffect({kind:'invert',amount:.5,id:'fx'})]));
  assert.deepEqual(px(half.ctx,16,16).slice(0,3),[128,128,128]);
  const sepia=await render(withEffects(base('#808080'),[normalizeEffect({kind:'sepia',amount:1,id:'fx'})]));
  const [r,g,b]=px(sepia.ctx,16,16);
  assert.ok(r>g&&g>b,`el sepia es cálido y salió ${r},${g},${b}`);
});

test('clave cromática: se quita el color elegido y se respeta el resto',async()=>{
  const library=mediaLibrary(ctx=>{ctx.fillStyle='#00ff00';ctx.fillRect(0,0,16,SIZE);ctx.fillStyle='#ff0000';ctx.fillRect(16,0,16,SIZE);});
  const project=newProject();project.width=SIZE;project.height=SIZE;
  imageEvent(project,[normalizeEffect({kind:'chromaKey',color:'#00ff00',amount:.35,softness:.25,id:'fx'})]);
  const {ctx}=await render(project,library);
  assert.deepEqual(px(ctx,8,16).slice(0,3),[0,0,0],'el verde queda transparente y se ve el fondo negro');
  assert.deepEqual(px(ctx,24,16).slice(0,3),[255,0,0],'el rojo no se toca');
});

test('espejo: invierte la imagen en el eje que se pida',async()=>{
  const library=mediaLibrary(ctx=>{ctx.fillStyle='#ff0000';ctx.fillRect(0,0,16,SIZE);ctx.fillStyle='#0000ff';ctx.fillRect(16,0,16,SIZE);});
  const project=newProject();project.width=SIZE;project.height=SIZE;
  imageEvent(project,[normalizeEffect({kind:'mirror',horizontal:true,vertical:false,id:'fx'})]);
  const {ctx}=await render(project,library);
  assert.deepEqual(px(ctx,4,16).slice(0,3),[0,0,255],'lo que estaba a la izquierda pasa a la derecha');
  assert.deepEqual(px(ctx,28,16).slice(0,3),[255,0,0]);
});

test('pixelar: los píxeles de un mismo bloque acaban iguales',async()=>{
  const library=mediaLibrary(ctx=>{ctx.fillStyle='#ff0000';ctx.fillRect(0,0,16,SIZE);ctx.fillStyle='#0000ff';ctx.fillRect(16,0,16,SIZE);});
  const project=newProject();project.width=SIZE;project.height=SIZE;
  imageEvent(project,[normalizeEffect({kind:'pixelate',size:8,id:'fx'})]);
  const {ctx}=await render(project,library);
  assert.deepEqual(px(ctx,1,16),px(ctx,6,16),'el bloque de 8 px queda de un solo color');
  assert.deepEqual(px(ctx,1,16).slice(0,3),[255,0,0],'el primer bloque es el rojo de la izquierda');
  assert.deepEqual(px(ctx,20,16).slice(0,3),[0,0,255],'y el tercero es el azul de la derecha');
});

test('borde y viñeta: uno pinta el marco y la otra oscurece las esquinas',async()=>{
  const bordered=await render(withEffects(base('#ff0000'),[normalizeEffect({kind:'border',size:4,color:'#ffffff',id:'fx'})]));
  assert.deepEqual(px(bordered.ctx,1,1).slice(0,3),[255,255,255]);
  assert.deepEqual(px(bordered.ctx,16,16).slice(0,3),[255,0,0]);
  const vignetted=await render(withEffects(base('#ffffff'),[normalizeEffect({kind:'vignette',amount:.8,color:'#000000',id:'fx'})]));
  const corner=px(vignetted.ctx,1,1)[0],centre=px(vignetted.ctx,16,16)[0];
  assert.ok(centre>corner,'el centro queda más claro que las esquinas');
  assert.ok(corner<120,'la esquina se oscurece de verdad');
});

test('desenfoque y centelleo: uno suaviza el borde y el otro reparte luz fuera de la figura',async()=>{
  const library=mediaLibrary(ctx=>{ctx.fillStyle='#ffffff';ctx.fillRect(0,0,16,SIZE);});
  const sharp=newProject();sharp.width=SIZE;sharp.height=SIZE;imageEvent(sharp);
  const plain=await render(sharp,library);
  assert.equal(px(plain.ctx,16,16)[0],0,'sin desenfoque el borde es duro');
  const blurred=newProject();blurred.width=SIZE;blurred.height=SIZE;
  imageEvent(blurred,[normalizeEffect({kind:'blur',amount:3,id:'fx'})]);
  const soft=await render(blurred,library);
  const edge=px(soft.ctx,16,16)[0];
  assert.ok(edge>10&&edge<245,`el borde queda a medias y salió ${edge}`);
  assert.ok(px(soft.ctx,14,16)[0]>10,'y el blanco se corre hacia el lado oscuro');

  const glowLibrary=mediaLibrary(ctx=>{ctx.fillStyle='#ffffff';ctx.fillRect(12,12,8,8);});
  const dark=newProject();dark.width=SIZE;dark.height=SIZE;imageEvent(dark);
  assert.equal(px((await render(dark,glowLibrary)).ctx,4,16)[0],0);
  const glowing=newProject();glowing.width=SIZE;glowing.height=SIZE;
  imageEvent(glowing,[normalizeEffect({kind:'glow',size:6,amount:.9,id:'fx'})]);
  assert.ok(px((await render(glowing,glowLibrary)).ctx,4,16)[0]>5,'el resplandor llega fuera de la figura');
});

test('generadores: degradado, tablero, barras y ruido pintan lo que se espera',async()=>{
  const gradient=newProject();gradient.width=SIZE;gradient.height=SIZE;
  const gradientEvent=newEvent(gradient.tracks[1].id,'color');
  gradientEvent.color='#ff0000';
  gradientEvent.generator={...generator('gradient','#ff0000'),color2:'#0000ff',angle:0};
  gradient.events.push(gradientEvent);
  const g=await render(gradient);
  const left=px(g.ctx,1,16),right=px(g.ctx,30,16);
  assert.ok(left[0]>left[2],'a la izquierda manda el primer color');
  assert.ok(right[2]>right[0],'a la derecha manda el segundo');

  const checker=newProject();checker.width=SIZE;checker.height=SIZE;
  const checkerEvent=newEvent(checker.tracks[1].id,'color');
  checkerEvent.color='#ff0000';
  checkerEvent.generator={...generator('checkerboard','#ff0000'),color2:'#0000ff',size:8};
  checker.events.push(checkerEvent);
  const c=await render(checker);
  const first=px(c.ctx,1,1),second=px(c.ctx,9,1);
  assert.ok(first[2]>200&&first[0]<60,'la primera casilla es la del segundo color');
  assert.ok(second[0]>200&&second[2]<60,'y la siguiente la del primero');

  const bars=newProject();bars.width=SIZE;bars.height=SIZE;
  const barEvent=newEvent(bars.tracks[1].id,'color');
  barEvent.color='#000000';barEvent.generator=generator('bars');
  bars.events.push(barEvent);
  const b=await render(bars);
  assert.deepEqual(px(b.ctx,1,16).slice(0,3),[192,192,192]);
  assert.deepEqual(px(b.ctx,5,16).slice(0,3),[192,192,0]);
  assert.deepEqual(px(b.ctx,29,16).slice(0,3),[16,16,16]);

  const noise=newProject();noise.width=SIZE;noise.height=SIZE;
  const noiseEvent=newEvent(noise.tracks[1].id,'color');
  noiseEvent.color='#000000';noiseEvent.generator=generator('noise');
  noise.events.push(noiseEvent);
  const n=await render(noise);
  const values=new Set<number>();
  for(let x=0;x<SIZE;x+=3)values.add(px(n.ctx,x,16)[0]);
  assert.ok(values.size>3,'el ruido varía entre celdas');
});
