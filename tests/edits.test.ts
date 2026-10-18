// Pruebas de la edición de precisión: deslizar el contenido (slip), desplazar el evento (slide), recortar por
// rizo hasta el cursor y el rizo al mover o pegar. Todo son funciones puras sobre el proyecto, así que se
// comprueban los ticks exactos, los huecos que no deben quedar y los límites del material.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Event,Media,Project,newEvent,newProject,rippleMove,rippleTrimToCursor,seconds,slip,slide,ticks} from '../lib/editor/project';

const close=(actual:number,expected:number,message?:string,tolerance=1e-6)=>assert.ok(Math.abs(actual-expected)<tolerance,message??`${actual} no está cerca de ${expected}`);
const media=(id:string,duration=10):Media=>({id,name:`${id}.mp4`,size:0,modified:0,kind:'video',duration:ticks(duration),width:1920,height:1080,hasAudio:true,mime:'video/mp4',sourcePath:`C:\\${id}.mp4`});
// Un proyecto con tres clips seguidos en la pista de vídeo (0-2, 2-4, 4-6) y otro suelto en la de audio.
function base(){
  const p=newProject();
  p.media=[media('a'),media('b')];
  const video=p.tracks[1].id, audio=p.tracks[2].id;
  const first={...newEvent(video,'video',ticks(0),ticks(2)),mediaId:'a',name:'Primero'};
  const block={...newEvent(video,'video',ticks(2),ticks(2)),mediaId:'a',name:'Bloque'};
  const next={...newEvent(video,'video',ticks(4),ticks(2)),mediaId:'b',name:'Siguiente'};
  const other={...newEvent(audio,'audio',ticks(4),ticks(2)),mediaId:'b',name:'Audio lejano'};
  p.events.push(first,block,next,other);
  return {p,video,audio,first,block,next,other};
}
const find=(p:Project,id:string)=>p.events.find(e=>e.id===id) as Event;

test('deslizar el contenido: el material se mueve dentro del evento, que no cambia de sitio ni de duración',()=>{
  const {p,block}=base();
  block.offset=ticks(2);
  assert.equal(slip(p,[block.id],ticks(1)),true);
  const after=find(p,block.id);
  close(seconds(after.offset),3);
  close(seconds(after.start),2);
  close(seconds(after.duration),2);
});

test('deslizar el contenido: no se sale del archivo ni hacia atrás ni hacia delante',()=>{
  const {p,block}=base();
  block.offset=ticks(1);
  assert.equal(slip(p,[block.id],ticks(-99)),true);
  close(seconds(find(p,block.id).offset),0);
  assert.equal(slip(p,[block.id],ticks(-1)),false,'ya no queda material por delante');
  // 10 s de archivo, 2 s de evento: como mucho se puede entrar hasta el segundo 8.
  assert.equal(slip(p,[block.id],ticks(99)),true);
  const after=find(p,block.id);
  close(seconds(after.offset),8);
  close(seconds(after.offset+after.duration),10);
});

test('deslizar el contenido: el audio y el vídeo vinculados se deslizan juntos',()=>{
  const {p,audio,block}=base();
  const group='g1';
  block.group=group;block.offset=ticks(1);
  const twin={...newEvent(audio,'audio',ticks(2),ticks(2)),mediaId:'a',name:'Audio del bloque',group,offset:ticks(1)};
  p.events.push(twin);
  assert.equal(slip(p,[block.id],ticks(2)),true);
  close(seconds(find(p,block.id).offset),3);
  close(seconds(find(p,twin.id).offset),3,'el audio se desliza lo mismo');
});

test('deslizar el contenido: los generadores y las imágenes no tienen material que deslizar',()=>{
  const {p,video}=base();
  const color={...newEvent(video,'color',ticks(2),ticks(2)),name:'Color'};
  const text={...newEvent(video,'text',ticks(4),ticks(2)),name:'Texto'};
  p.events.push(color,text);
  assert.equal(slip(p,[color.id],ticks(1)),false);
  assert.equal(slip(p,[text.id],ticks(1)),false);
  assert.equal(slip(p,[color.id,text.id],ticks(1)),false);
});

test('desplazar el evento: el bloque se mueve y los vecinos ajustan su borde sin dejar hueco',()=>{
  const {p,first,block,next}=base();
  assert.equal(slide(p,[block.id],ticks(.5)),true);
  const moved=find(p,block.id),before=find(p,first.id),after=find(p,next.id);
  close(seconds(moved.start),2.5);
  close(seconds(before.start+before.duration),2.5,'el anterior estira hasta el bloque');
  close(seconds(after.start),4.5);
  close(seconds(after.duration),1.5,'el siguiente se encoge por delante');
  close(seconds(after.start+after.duration),6,'y el final de la pista no se mueve');
  close(seconds(after.offset),0.5,'el contenido del siguiente también se desplaza');
});

test('desplazar el evento: no se puede encoger un vecino por debajo de un fotograma',()=>{
  const {p,block,next}=base();
  assert.equal(slide(p,[block.id],ticks(5)),true);
  const moved=find(p,block.id),after=find(p,next.id);
  close(seconds(after.duration),1/30,'el siguiente se queda con un fotograma');
  close(seconds(moved.start),4-1/30,'y el bloque se para un fotograma antes de donde empezaba el vecino');
});

test('recortar por rizo hasta el cursor: se come la cabecera y lo siguiente se adelanta',()=>{
  const {p,block,next}=base();
  block.offset=ticks(1);
  // Dos claves que van de x=0 a x=1 entre 0,5 s y 1,5 s: al cortar en 1 s el valor era 0,5.
  const key=(x:number,time:number)=>({x,y:0,scale:1,rotation:0,opacity:1,crop:0,time});
  block.keys=[key(0,ticks(.5)),key(1,ticks(1.5))];
  assert.equal(rippleTrimToCursor(p,[block.id],'left',ticks(3),'track'),true);
  const after=find(p,block.id);
  close(seconds(after.start),2,'el evento no se mueve de sitio');
  close(seconds(after.duration),1);
  close(seconds(after.offset),2,'el contenido empieza un segundo más tarde');
  assert.equal(after.keys.length,2);
  close(seconds(after.keys[0].time),0,'el valor del corte se guarda como primera clave');
  close(after.keys[0].x,.5,'y es el que tenía la animación en ese instante');
  close(seconds(after.keys[1].time),.5,'la clave que quedaba se adelanta');
  close(after.keys[1].x,1);
  close(seconds(find(p,next.id).start),3,'el siguiente se adelanta para cerrar el hueco');
});

test('recortar por rizo hasta el cursor: sin rizo lo de después no se mueve',()=>{
  const {p,block,next}=base();
  assert.equal(rippleTrimToCursor(p,[block.id],'right',ticks(3),'off'),true);
  close(seconds(find(p,block.id).duration),1);
  close(seconds(find(p,next.id).start),4,'el siguiente se queda donde estaba');
});

test('recortar por rizo hasta el cursor: fuera del evento no hace nada',()=>{
  const {p,block}=base();
  assert.equal(rippleTrimToCursor(p,[block.id],'left',ticks(9),'track'),false);
  assert.equal(rippleTrimToCursor(p,[block.id],'right',ticks(1),'track'),false);
  close(seconds(find(p,block.id).duration),2);
});

test('rizo al mover: arrastra lo siguiente de la misma pista, o de todas',()=>{
  const {p,block,next,other}=base();
  rippleMove(p,[block.id],ticks(1),'track',ticks(4));
  close(seconds(find(p,next.id).start),5,'el siguiente de la misma pista se mueve');
  close(seconds(find(p,other.id).start),4,'el de otra pista no');
  const second=base();
  rippleMove(second.p,[second.block.id],ticks(1),'all',ticks(4));
  close(seconds(find(second.p,second.other.id).start),5,'con «todas» también el de la otra pista');
});

test('rizo al mover: con los marcadores por delante y el rizo en «todas», se desplazan también',()=>{
  const {p,block}=base();
  p.markers=[{id:'m1',name:'Después',time:ticks(5)},{id:'m2',name:'Antes',time:ticks(1)}];
  p.region={start:ticks(5),end:ticks(6)};
  rippleMove(p,[block.id],ticks(1),'all',ticks(4));
  close(seconds(p.markers[0].time),6);
  close(seconds(p.markers[1].time),1,'el marcador de antes no se toca');
  close(seconds(p.region!.start),6);
  close(seconds(p.region!.end),7);
});
