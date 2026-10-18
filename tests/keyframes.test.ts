// Pruebas de las curvas de interpolación de los fotogramas clave (los seis modos de VEGAS 15) y de cómo
// llegan al render: se comprueba la forma de cada curva, la interpolación de la transformación y del recorte,
// y que «Mantener» deja el fotograma anterior quieto hasta la clave siguiente.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {compose} from '../lib/editor/compositor';
import {MediaLibrary} from '../lib/editor/media';
import {EASE_KINDS,EASE_LABEL,EASE_NOTE,EaseKind,easeValue,newEvent,newProject,pose,ticks,transform as newTransform} from '../lib/editor/project';
import {maskAt} from '../lib/editor/pancrop';

const close=(actual:number,expected:number,tolerance=1e-6)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} no está cerca de ${expected}`);
const factory=(width:number,height:number)=>createCanvas(width,height) as unknown as HTMLCanvasElement;

test('catálogo: los seis modos de VEGAS 15 tienen nombre y explicación',()=>{
  assert.deepEqual(EASE_KINDS,['linear','smooth','sharp','hold','fast','slow']);
  for(const kind of EASE_KINDS){
    assert.ok(EASE_LABEL[kind],`falta el nombre de ${kind}`);
    assert.ok(EASE_NOTE[kind],`falta la explicación de ${kind}`);
  }
});

test('curvas: cada modo cambia el reparto del tiempo como se espera',()=>{
  assert.equal(easeValue('linear',.5),.5);
  assert.equal(easeValue(undefined,.5),.5);
  close(easeValue('smooth',.5),.5);          // la curva en S pasa por el centro
  close(easeValue('smooth',.25),.15625);
  close(easeValue('sharp',.5),.0625);        // se queda atrás y salta al final
  assert.equal(easeValue('hold',.9),0);      // no interpola
  close(easeValue('fast',.5),.75);           // llega antes
  close(easeValue('slow',.5),.25);           // sale más tarde
  // Los extremos son los mismos en todas: sólo cambia el camino.
  for(const kind of EASE_KINDS){
    if(kind==='hold')continue;
    close(easeValue(kind,0),0);
    close(easeValue(kind,1),1);
  }
  // Y fuera del tramo no se dispara.
  assert.equal(easeValue('smooth',-3),0);
  assert.equal(easeValue('smooth',4),1);
  assert.equal(easeValue('smooth',Number.NaN),0);
});

test('transformación: la curva de la clave cambia el valor a mitad del tramo',()=>{
  const project=newProject();
  const event=newEvent(project.tracks[0].id,'video',0,ticks(4));
  const base={...newTransform(),opacity:0};
  const end={...newTransform(),opacity:1};
  const build=(curve:EaseKind)=>({...event,keys:[{...base,time:0,curve},{...end,time:ticks(2)}]});
  assert.equal(pose(build('linear'),ticks(1)).opacity,.5);
  assert.equal(pose(build('hold'),ticks(1)).opacity,0);
  assert.equal(pose(build('hold'),ticks(1.999)).opacity,0,'mantiene hasta la clave siguiente');
  assert.equal(pose(build('hold'),ticks(2)).opacity,1);
  assert.ok(pose(build('slow'),ticks(1)).opacity<.5);
  assert.ok(pose(build('fast'),ticks(1)).opacity>.5);
  assert.equal(pose(build('smooth'),ticks(1)).opacity,.5);
  // Una sola clave manda en todo el evento, con o sin curva.
  const single={...event,keys:[{...newTransform(),opacity:.3,time:0,curve:'hold' as EaseKind}]};
  assert.equal(pose(single,ticks(3)).opacity,.3);
  // Sin claves se usa la transformación fija.
  assert.equal(pose(event,ticks(3)).opacity,1);
});

test('recorte: la curva también gobierna la interpolación de los márgenes',()=>{
  const event={transform:newTransform(),keys:[
    {...newTransform(),time:0,mask:{left:0,right:0,top:0,bottom:0},curve:'hold' as EaseKind},
    {...newTransform(),time:ticks(2),mask:{left:.4,right:.4,top:.4,bottom:.4}},
  ]};
  close(maskAt(event,ticks(1)).left,0);
  close(maskAt(event,ticks(2)).left,.4);
  const smooth={...event,keys:[{...event.keys[0],curve:'smooth' as EaseKind},event.keys[1]]};
  close(maskAt(smooth,ticks(1)).left,.2);
  const slow={...event,keys:[{...event.keys[0],curve:'slow' as EaseKind},event.keys[1]]};
  assert.ok(maskAt(slow,ticks(1)).left<.2);
});

test('render: con «Mantener» la imagen no se mueve hasta la clave siguiente',async()=>{
  // Una imagen roja con un cuadro azul en el centro, recortada por la izquierda según la curva de la clave.
  const build=async(curve:EaseKind)=>{
    const library=new MediaLibrary();
    const image=createCanvas(32,32);
    const ctx=image.getContext('2d');
    ctx.fillStyle='#ff0000';ctx.fillRect(0,0,32,32);
    ctx.fillStyle='#0000ff';ctx.fillRect(0,0,16,32);
    library.items.set('i',{file:{} as File,firstVideo:0,image:image as unknown as ImageBitmap});
    const project=newProject();
    project.width=32;project.height=32;
    const event=newEvent(project.tracks[1].id,'image',0,ticks(2));
    event.mediaId='i';
    event.keys=[
      {...newTransform(),time:0,mask:{left:0,right:0,top:0,bottom:0},curve},
      {...newTransform(),time:ticks(2),mask:{left:.4,right:0,top:0,bottom:0}},
    ];
    project.events.push(event);
    const canvas=createCanvas(32,32);
    await compose(canvas as unknown as HTMLCanvasElement,project,library,ticks(1.5),{createCanvas:factory});
    const pixels=canvas.getContext('2d').getImageData(0,0,32,32).data;
    const blueAt=(x:number,y:number)=>{const i=(y*32+x)*4;return pixels[i+2]>200&&pixels[i]<60;};
    return {blueAt};
  };
  const hold=await build('hold');
  assert.equal(hold.blueAt(2,16),true,'con «Mantener» el recorte sigue en el valor inicial');
  const smooth=await build('smooth');
  assert.equal(smooth.blueAt(2,16),false,'con «Suave» a tres cuartos ya se recortó la franja azul');
});
