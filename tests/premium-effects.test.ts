// Pruebas de los efectos y looks premium: cada efecto se aplica con el compositor real y se mide un cambio
// concreto en los píxeles (grano, separación de canales, viñeta de color, líneas de barrido, halación…).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {compose} from '../lib/editor/compositor';
import {MediaLibrary} from '../lib/editor/media';
import {newEvent,newProject,ticks,type VideoEffect,type VideoEffectKind} from '../lib/editor/project';
import {EFFECT_KINDS,EFFECT_LOOKS,EFFECT_PARAMS,defaultEffect,normalizeEffects} from '../lib/editor/effects';

const factory=(width:number,height:number)=>createCanvas(width,height) as unknown as HTMLCanvasElement;
const SIZE=64;

async function renderColor(color:string,effects:VideoEffect[]=[],seconds=1){
 const project=newProject();project.width=SIZE;project.height=SIZE;
 const event=newEvent(project.tracks[1].id,'color');event.color=color;event.name='Fondo';event.effects=effects;
 project.events.push(event);
 const canvas=createCanvas(SIZE,SIZE);
 await compose(canvas as unknown as HTMLCanvasElement,project,new MediaLibrary(),ticks(seconds),{createCanvas:factory});
 return canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
}
async function renderImage(paint:(ctx:CanvasRenderingContext2D)=>void,effects:VideoEffect[]=[]){
 const project=newProject();project.width=SIZE;project.height=SIZE;
 const library=new MediaLibrary();const image=createCanvas(SIZE,SIZE);
 paint(image.getContext('2d') as unknown as CanvasRenderingContext2D);
 library.items.set('i',{file:{} as File,firstVideo:0,image:image as unknown as ImageBitmap});
 const event=newEvent(project.tracks[1].id,'image');event.mediaId='i';event.name='Imagen';event.effects=effects;
 project.events.push(event);
 const canvas=createCanvas(SIZE,SIZE);
 await compose(canvas as unknown as HTMLCanvasElement,project,library,ticks(1),{createCanvas:factory});
 return canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
}
const pixel=(ctx:CanvasRenderingContext2D,x:number,y:number)=>Array.from(ctx.getImageData(x,y,1,1).data) as [number,number,number,number];
const all=(ctx:CanvasRenderingContext2D)=>ctx.getImageData(0,0,SIZE,SIZE).data;
const effect=(kind:VideoEffectKind,patch:Partial<VideoEffect>={})=>({...defaultEffect(kind,'fx'),...patch});

test('catálogo: dieciocho efectos y cinco looks con nombres, notas y parámetros válidos',()=>{
 assert.equal(EFFECT_KINDS.length,18);
 assert.equal(EFFECT_LOOKS.length,5);
 const ids=new Set(EFFECT_LOOKS.map(look=>look.id));
 assert.equal(ids.size,EFFECT_LOOKS.length);
 for(const kind of EFFECT_KINDS){assert.ok(EFFECT_PARAMS[kind].length);assert.ok(defaultEffect(kind,'x').enabled);}
 for(const look of EFFECT_LOOKS){
  assert.ok(look.note.length>30,`${look.id} no explica el look`);
  assert.ok(look.effects.length>=2&&look.effects.length<=24);
  for(const part of look.effects)assert.ok(EFFECT_KINDS.includes(part.kind));
 }
 assert.equal(normalizeEffects(EFFECT_LOOKS[0].effects.map((part,index)=>({...part,id:`l${index}`}))).length,EFFECT_LOOKS[0].effects.length);
});

test('grano: una imagen lisa deja de ser lisa y la semilla es estable',async()=>{
 const plain=all(await renderColor('#808080'));
 const grainy=all(await renderColor('#808080',[effect('filmGrain')]));
 let variance=0;for(let i=0;i<grainy.length;i+=4)variance+=Math.abs(grainy[i]-128);
 assert.ok(variance>200,`el grano debería mover los píxeles (${variance})`);
 let plainVariance=0;for(let i=0;i<plain.length;i+=4)plainVariance+=Math.abs(plain[i]-128);
 assert.ok(variance>plainVariance*4);
 // La semilla es estable en el mismo instante y cambia al avanzar el tiempo (el grano no está congelado).
 const same=all(await renderColor('#808080',[effect('filmGrain')],1));
 const later=all(await renderColor('#808080',[effect('filmGrain')],1.5));
 assert.deepEqual(Array.from(grainy),Array.from(same));
 assert.notDeepEqual(Array.from(grainy),Array.from(later));
});

test('aberración cromática: un borde blanco gana franjas roja y azul',async()=>{
 const paint=(ctx:CanvasRenderingContext2D)=>{ctx.fillStyle='#000';ctx.fillRect(0,0,SIZE,SIZE);ctx.fillStyle='#fff';ctx.fillRect(28,0,8,SIZE);};
 const plain=await renderImage(paint);
 const shifted=await renderImage(paint,[effect('chromaticAberration',{amount:1,size:4})]);
 const reds=(ctx:CanvasRenderingContext2D)=>{let n=0;const d=all(ctx);for(let i=0;i<d.length;i+=4)if(d[i]>100&&d[i+2]<60)n++;return n;};
 const blues=(ctx:CanvasRenderingContext2D)=>{let n=0;const d=all(ctx);for(let i=0;i<d.length;i+=4)if(d[i+2]>100&&d[i]<60)n++;return n;};
 assert.equal(reds(plain),0);assert.equal(blues(plain),0);
 assert.ok(reds(shifted)>50,`franja roja (${reds(shifted)})`);
 assert.ok(blues(shifted)>50,`franja azul (${blues(shifted)})`);
});

test('posterizar: el degradado pierde niveles de color',async()=>{
 const paint=(ctx:CanvasRenderingContext2D)=>{const gradient=ctx.createLinearGradient(0,0,SIZE,0);gradient.addColorStop(0,'#000');gradient.addColorStop(1,'#fff');ctx.fillStyle=gradient;ctx.fillRect(0,0,SIZE,SIZE);};
 const unique=(ctx:CanvasRenderingContext2D)=>{const d=all(ctx);const set=new Set<number>();for(let i=0;i<d.length;i+=4)set.add((d[i]<<16)|(d[i+1]<<8)|d[i+2]);return set.size;};
 const plain=unique(await renderImage(paint));
 const posterized=unique(await renderImage(paint,[effect('posterize',{amount:1,size:4})]));
 assert.ok(posterized<plain,`menos colores (${posterized} vs ${plain})`);
 assert.ok(posterized<=6,`cuatro niveles deberían dejar pocos colores (${posterized})`);
});

test('teal & naranja: las sombras van al azul y las luces al naranja',async()=>{
 const dark=pixel(await renderColor('#404040',[effect('tealOrange',{amount:1})]),32,32);
 const light=pixel(await renderColor('#c8c8c8',[effect('tealOrange',{amount:1})]),32,32);
 assert.ok(dark[2]>dark[0]+10,`sombra teal (${dark.slice(0,3)})`);
 assert.ok(light[0]>light[2]+10,`luz naranja (${light.slice(0,3)})`);
});

test('bleach bypass: baja la saturación del rojo',async()=>{
 const plain=pixel(await renderColor('#c03030'),32,32);
 const bleached=pixel(await renderColor('#c03030',[effect('bleachBypass',{amount:1})]),32,32);
 const spread=(value:[number,number,number,number])=>Math.max(...value.slice(0,3))-Math.min(...value.slice(0,3));
 assert.ok(spread(bleached)<spread(plain),`la saturación baja (${spread(bleached)} vs ${spread(plain)})`);
});

test('VHS: aparecen las líneas de barrido',async()=>{
 const ctx=await renderColor('#808080',[effect('vhs',{amount:1})]);
 const rows:number[]=[];
 for(let y=0;y<SIZE;y++){const d=pixel(ctx,32,y);rows.push((d[0]+d[1]+d[2])/3);}
 const darkest=Math.min(...rows);
 assert.ok(darkest<110,`alguna línea se oscurece (${darkest.toFixed(1)})`);
});

test('fuga de luz: un fondo negro se tiñe de cálido',async()=>{
 const plain=pixel(await renderColor('#000000'),32,32);
 const leaked=pixel(await renderColor('#000000',[effect('lightLeak',{amount:1,size:0,color:'#ff9a4d'})]),32,32);
 assert.ok(leaked[0]>10&&leaked[0]>leaked[2],`debería verse naranja (${leaked.slice(0,3)})`);
 assert.equal(plain[0],0);
});

test('halación: el resplandor rodea la zona clara',async()=>{
 const paint=(ctx:CanvasRenderingContext2D)=>{ctx.fillStyle='#000';ctx.fillRect(0,0,SIZE,SIZE);ctx.fillStyle='#fff';ctx.fillRect(24,24,16,16);};
 const plain=pixel(await renderImage(paint),40,32);
 const halo=pixel(await renderImage(paint,[effect('halation',{amount:1,size:10,color:'#ff5a36'})]),40,32);
 assert.ok(plain[0]<10,'sin halación el borde está negro');
 assert.ok(halo[0]>8&&halo[0]>=halo[1],`debería haber resplandor cálido (${halo.slice(0,3)})`);
});

test('los looks cambian la imagen y no son una lista vacía',async()=>{
 const paint=(ctx:CanvasRenderingContext2D)=>{ctx.fillStyle='#a0522d';ctx.fillRect(0,0,SIZE,SIZE);ctx.fillStyle='#e8e8e8';ctx.fillRect(0,0,20,20);};
 const base=all(await renderImage(paint));
 for(const look of EFFECT_LOOKS){
  const effects=look.effects.map((part,index)=>({...defaultEffect(part.kind,`${look.id}-${index}`),...part}));
  const changed=all(await renderImage(paint,effects));
  let difference=0;for(let i=0;i<base.length;i+=4)difference+=Math.abs(base[i]-changed[i])+Math.abs(base[i+1]-changed[i+1])+Math.abs(base[i+2]-changed[i+2]);
  assert.ok(difference>2000,`${look.id} debería notarse (${difference})`);
 }
});
