import {test} from 'node:test';import assert from 'node:assert/strict';import {createCanvas} from '@napi-rs/canvas';
import {compose} from '../lib/editor/compositor';import {MediaLibrary} from '../lib/editor/media';import {newProject,newEvent,ticks} from '../lib/editor/project';
test('composición: orden de pistas, opacidad, texto y silencio de video',async()=>{const p=newProject();p.width=320;p.height=180;const back=newEvent(p.tracks[1].id,'color');back.color='#ff0000';const front=newEvent(p.tracks[0].id,'color');front.color='#0000ff';front.transform.opacity=.5;p.events.push(back,front);const canvas=createCanvas(320,180);await compose(canvas as unknown as HTMLCanvasElement,p,new MediaLibrary(),ticks(1));const pixel=canvas.getContext('2d').getImageData(3,3,1,1).data;assert.ok(pixel[0]>120&&pixel[2]>120);p.tracks[0].mute=true;await compose(canvas as unknown as HTMLCanvasElement,p,new MediaLibrary(),ticks(1));assert.equal(canvas.getContext('2d').getImageData(3,3,1,1).data[0],255);const text=newEvent(p.tracks[1].id,'text');text.text='CORTE';text.fontSize=40;p.events.push(text);await compose(canvas as unknown as HTMLCanvasElement,p,new MediaLibrary(),ticks(1));const pixels=canvas.getContext('2d').getImageData(0,0,320,180).data;let white=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>230&&pixels[i+1]>230&&pixels[i+2]>230)white++;assert.ok(white>50);});
test('fundido cruzado conserva luminosidad y mezcla los colores al 50%',async()=>{const p=newProject();const a=newEvent(p.tracks[1].id,'color',0,ticks(2));a.color='#ff0000';a.fadeOut=ticks(1);const b=newEvent(p.tracks[1].id,'color',ticks(1),ticks(2));b.color='#0000ff';b.fadeIn=ticks(1);p.events.push(a,b);const canvas=createCanvas(64,36);await compose(canvas as unknown as HTMLCanvasElement,p,new MediaLibrary(),ticks(1.5));const pixel=canvas.getContext('2d').getImageData(30,18,1,1).data;assert.ok(Math.abs(pixel[0]-127)<3);assert.ok(Math.abs(pixel[2]-128)<3);});
test('transformación y recorte se aplican a una imagen real',async()=>{const p=newProject();p.width=100;p.height=100;const lib=new MediaLibrary();const image=createCanvas(100,100);const ctx=image.getContext('2d');ctx.fillStyle='red';ctx.fillRect(0,0,100,100);ctx.fillStyle='blue';ctx.fillRect(25,25,50,50);lib.items.set('i',{file:{} as File,firstVideo:0,image:image as unknown as ImageBitmap});const e=newEvent(p.tracks[1].id,'image');e.mediaId='i';e.transform.crop=.25;e.transform.scale=.5;e.transform.x=.2;p.events.push(e);const canvas=createCanvas(100,100);await compose(canvas as unknown as HTMLCanvasElement,p,lib,ticks(1));assert.equal(canvas.getContext('2d').getImageData(70,50,1,1).data[2],255);assert.equal(canvas.getContext('2d').getImageData(10,50,1,1).data[2],0);});
test('recorte de cuatro lados: se recorta el origen y el medio conserva su sitio',async()=>{const p=newProject();p.width=100;p.height=100;const lib=new MediaLibrary();const image=createCanvas(100,100);const ictx=image.getContext('2d');ictx.fillStyle='red';ictx.fillRect(0,0,100,100);ictx.fillStyle='blue';ictx.fillRect(25,25,50,50);lib.items.set('i',{file:{} as File,firstVideo:0,image:image as unknown as ImageBitmap});const e=newEvent(p.tracks[1].id,'image');e.mediaId='i';e.mask={left:.25,right:.25,top:0,bottom:0};p.events.push(e);const canvas=createCanvas(100,100);await compose(canvas as unknown as HTMLCanvasElement,p,lib,ticks(1));const ctx=canvas.getContext('2d');assert.equal(ctx.getImageData(50,50,1,1).data[2],255);assert.equal(ctx.getImageData(10,50,1,1).data[0],0);assert.equal(ctx.getImageData(90,50,1,1).data[0],0);assert.equal(ctx.getImageData(50,10,1,1).data[0],255);});
test('recorte de cuatro lados: un color sólido también se recorta por lados',async()=>{const p=newProject();p.width=40;p.height=20;const e=newEvent(p.tracks[1].id,'color');e.color='#00ff00';e.mask={left:.25,right:0,top:0,bottom:.5};p.events.push(e);const canvas=createCanvas(40,20);await compose(canvas as unknown as HTMLCanvasElement,p,new MediaLibrary(),ticks(1));const ctx=canvas.getContext('2d');assert.equal(ctx.getImageData(20,5,1,1).data[1],255);assert.equal(ctx.getImageData(5,5,1,1).data[1],0);assert.equal(ctx.getImageData(20,15,1,1).data[1],0);});
test('modos de fusión de pista: añadir suma los colores y multiplicar los apaga',async()=>{const p=newProject();p.width=40;p.height=20;const bottom=newEvent(p.tracks[1].id,'color');bottom.color='#ff0000';const top=newEvent(p.tracks[0].id,'color');top.color='#0000ff';p.events.push(bottom,top);const canvas=createCanvas(40,20);const read=()=>canvas.getContext('2d').getImageData(20,10,1,1).data;await compose(canvas as unknown as HTMLCanvasElement,p,new MediaLibrary(),ticks(1));let pixel=read();assert.equal(pixel[2],255);assert.equal(pixel[0],0);p.tracks[0].composite='add';await compose(canvas as unknown as HTMLCanvasElement,p,new MediaLibrary(),ticks(1));pixel=read();assert.ok(pixel[0]>250&&pixel[2]>250);p.tracks[0].composite='multiply';await compose(canvas as unknown as HTMLCanvasElement,p,new MediaLibrary(),ticks(1));pixel=read();assert.ok(pixel[0]<5&&pixel[2]<5);});
test('texto: el punto de anclaje y el fondo se pintan donde toca',async()=>{const p=newProject();p.width=320;p.height=180;const text=newEvent(p.tracks[0].id,'text');text.text='CORTE';text.fontSize=60;text.anchor='top-left';text.background={color:'#0000ff',opacity:1,padding:4};p.events.push(text);const canvas=createCanvas(320,180);await compose(canvas as unknown as HTMLCanvasElement,p,new MediaLibrary(),ticks(1));const ctx=canvas.getContext('2d');assert.equal(ctx.getImageData(0,0,1,1).data[2],0);assert.equal(ctx.getImageData(160,92,1,1).data[2],255);assert.equal(ctx.getImageData(150,92,1,1).data[2],0);});
test('texto: la máquina de escribir descubre el texto con el tiempo',async()=>{const p=newProject();p.width=320;p.height=180;const text=newEvent(p.tracks[0].id,'text',0,ticks(4));text.text='CORTE QUINCE';text.fontSize=70;text.animation='typewriter';p.events.push(text);const canvas=createCanvas(320,180);const lit=()=>{const pixels=canvas.getContext('2d').getImageData(0,0,320,180).data;let count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>200)count++;return count;};await compose(canvas as unknown as HTMLCanvasElement,p,new MediaLibrary(),ticks(0));const start=lit();await compose(canvas as unknown as HTMLCanvasElement,p,new MediaLibrary(),ticks(3.9));assert.equal(start,0);assert.ok(lit()>50);});
// Karaoke: las palabras ya «cantadas» cambian de color, una a una, sin tocar el resto del estilo.
test('texto karaoke: las palabras se van resaltando con el tiempo y el color base se mantiene',async()=>{
 const p=newProject();p.width=320;p.height=180;
 const text=newEvent(p.tracks[0].id,'text',0,ticks(4));
 text.text='UNO DOS TRES CUATRO';text.fontSize=40;text.color='#ffffff';text.animation='karaoke';text.highlightColor='#ff0000';
 p.events.push(text);
 const canvas=createCanvas(320,180);
 const count=(color:'red'|'white')=>{
  const pixels=canvas.getContext('2d').getImageData(0,0,320,180).data;
  let total=0;
  for(let i=0;i<pixels.length;i+=4){
   const [r,g,b]=[pixels[i],pixels[i+1],pixels[i+2]];
   if(color==='red'&&r>180&&g<90&&b<90)total++;
   if(color==='white'&&r>200&&g>200&&b>200)total++;
  }
  return total;
 };
 await compose(canvas as unknown as HTMLCanvasElement,p,new MediaLibrary(),ticks(0.1));
 const red0=count('red'),white0=count('white');
 assert.equal(red0,0,'al principio ninguna palabra está cantada');
 assert.ok(white0>50,'el texto se ve en blanco');
 await compose(canvas as unknown as HTMLCanvasElement,p,new MediaLibrary(),ticks(2));
 const red2=count('red');
 assert.ok(red2>0,'a mitad del evento ya hay palabras resaltadas');
 assert.ok(count('white')>0,'y las que faltan siguen en el color base');
 await compose(canvas as unknown as HTMLCanvasElement,p,new MediaLibrary(),ticks(3.9));
 const red4=count('red');
 assert.ok(red4>red2,`el resaltado avanza con el tiempo (${red2} → ${red4})`);
});
// Las plantillas de redes juntan contorno, sombra y caja de fondo: los tres se pintan de verdad.
test('texto con contorno, sombra y fondo: los tres se pintan y el contorno queda detrás del relleno',async()=>{
 const p=newProject();p.width=320;p.height=180;
 const text=newEvent(p.tracks[0].id,'text');
 text.text='CORTE';text.fontSize=60;text.color='#ffffff';
 text.outlineWidth=8;text.outlineColor='#00ff00';
 text.shadow={enabled:true,color:'#ff0000',offsetX:6,offsetY:6,blur:0};
 text.background={color:'#0000ff',opacity:1,padding:20};
 p.events.push(text);
 const canvas=createCanvas(320,180);
 await compose(canvas as unknown as HTMLCanvasElement,p,new MediaLibrary(),ticks(1));
 const pixels=canvas.getContext('2d').getImageData(0,0,320,180).data;
 let outline=0,shadow=0,background=0,fill=0;
 for(let i=0;i<pixels.length;i+=4){
  const [r,g,b]=[pixels[i],pixels[i+1],pixels[i+2]];
  if(g>180&&r<90&&b<90)outline++;
  if(r>180&&g<90&&b<90)shadow++;
  if(b>180&&r<90&&g<90)background++;
  if(r>200&&g>200&&b>200)fill++;
 }
 assert.ok(outline>20,`el contorno verde debería verse (${outline})`);
 assert.ok(shadow>20,`la sombra roja debería verse (${shadow})`);
 assert.ok(background>500,`la caja de fondo azul debería verse (${background})`);
 assert.ok(fill>20,`el relleno blanco debería verse (${fill})`);
});
// Se comprueba con píxeles: un cuadro azul en la esquina superior izquierda sobre fondo rojo, girado 180°.
test('centro de giro: la imagen gira sobre el punto elegido, no siempre sobre el centro',async()=>{
 const shoot=async(pivot?:{x:number;y:number})=>{
  const p=newProject();p.width=100;p.height=100;
  const lib=new MediaLibrary();
  const image=createCanvas(100,100);const ictx=image.getContext('2d');
  ictx.fillStyle='#ff0000';ictx.fillRect(0,0,100,100);
  ictx.fillStyle='#0000ff';ictx.fillRect(0,0,20,20);          // cuadro azul en la esquina superior izquierda
  lib.items.set('i',{file:{} as File,firstVideo:0,image:image as unknown as ImageBitmap});
  const e=newEvent(p.tracks[1].id,'image');e.mediaId='i';e.transform.rotation=180;
  if(pivot)e.transform.pivot=pivot;
  p.events.push(e);
  const canvas=createCanvas(100,100);
  await compose(canvas as unknown as HTMLCanvasElement,p,lib,ticks(1));
  return canvas.getContext('2d');
 };
 const read=(ctx:{getImageData:(x:number,y:number,w:number,h:number)=>{data:Uint8ClampedArray}},x:number,y:number)=>Array.from(ctx.getImageData(x,y,1,1).data).slice(0,3) as number[];
 // Sin centro de giro (el de siempre, el centro del fotograma): el cuadro azul acaba abajo a la derecha.
 const centred=await shoot();
 assert.deepEqual(read(centred,90,90),[0,0,255]);
 assert.deepEqual(read(centred,5,5),[255,0,0]);
 // Con el centro de giro a un cuarto por la izquierda y a media altura, el cuadro azul cae abajo en el medio
 // y la esquina inferior derecha se queda sin imagen (el punto que le correspondería está fuera del medio).
 const shifted=await shoot({x:.25,y:.5});
 assert.deepEqual(read(shifted,40,90),[0,0,255]);
 assert.deepEqual(read(shifted,90,90),[0,0,0]);
 assert.deepEqual(read(shifted,5,5),[255,0,0]);
});

// «Extender para rellenar f.» del grupo «Origen» de la ventana de Panoramización y recorte: con la casilla
// puesta el material 4:3 cubre el fotograma 16:9; sin ella quedan bandas a los lados.
test('«Extender para rellenar f.» escala el material hasta cubrir el fotograma',async()=>{
 const p=newProject();p.width=320;p.height=180;
 const lib=new MediaLibrary();
 const image=createCanvas(240,180);
 const ictx=image.getContext('2d');ictx.fillStyle='#ff0000';ictx.fillRect(0,0,240,180);
 lib.items.set('i',{file:{} as File,firstVideo:0,image:image as unknown as ImageBitmap});
 p.media.push({id:'i',name:'i.png',size:0,modified:0,kind:'image',duration:ticks(5),width:240,height:180,hasAudio:false,mime:'image/png'});
 const e=newEvent(p.tracks[1].id,'image');e.mediaId='i';p.events.push(e);
 const canvas=createCanvas(320,180);
 const red=(x:number)=>{const data=canvas.getContext('2d').getImageData(x,90,1,1).data;return data[0]>200&&data[1]<60;};
 await compose(canvas as unknown as HTMLCanvasElement,p,lib,ticks(1));
 assert.ok(!red(4)&&!red(315),'sin la casilla el medio encajado deja bandas a los lados');
 e.stretchFill=true;
 await compose(canvas as unknown as HTMLCanvasElement,p,lib,ticks(1));
 assert.ok(red(4)&&red(315),'con la casilla el material cubre el fotograma entero');
 assert.ok(red(160),'y el centro sigue viéndose: no se deforma, se recorta lo que sobra');
});

// «Mantener relación de aspecto» quitado: el material se estira hasta llenar el fotograma, aunque se deforme. Es
// uno de los Modificadores del evento; puesto (o sin campo propio) se encaja dentro y quedan bandas.
test('«Mantener relación de aspecto» quitado estira el material hasta llenar el fotograma',async()=>{
 const p=newProject();p.width=320;p.height=180;
 const lib=new MediaLibrary();
 const image=createCanvas(180,180);
 const ictx=image.getContext('2d');ictx.fillStyle='#20b070';ictx.fillRect(0,0,180,180);
 lib.items.set('i',{file:{} as File,firstVideo:0,image:image as unknown as ImageBitmap});
 p.media.push({id:'i',name:'i.png',size:0,modified:0,kind:'image',duration:ticks(5),width:180,height:180,hasAudio:false,mime:'image/png'});
 const e=newEvent(p.tracks[1].id,'image');e.mediaId='i';p.events.push(e);
 const canvas=createCanvas(320,180);
 const green=(x:number,y:number)=>{const data=canvas.getContext('2d').getImageData(x,y,1,1).data;return data[1]>120&&data[0]<90&&data[2]<170;};
 await compose(canvas as unknown as HTMLCanvasElement,p,lib,ticks(1));
 assert.ok(green(160,90),'el centro lo ocupa el material');
 assert.ok(!green(4,90)&&!green(315,90),'y a los lados quedan bandas: es cuadrado en un fotograma 16:9');
 e.maintainAspect=false;
 await compose(canvas as unknown as HTMLCanvasElement,p,lib,ticks(1));
 assert.ok(green(4,90)&&green(315,90),'quitando la casilla el material llega a los bordes laterales');
 assert.ok(green(160,4)&&green(160,175),'y también arriba y abajo');
});
