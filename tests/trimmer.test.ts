// Pruebas de la edición de tres puntos (trimmer): sobrescribir un tramo dejando el hueco limpio e insertar
// respetando lo que venía después, con los puntos de entrada y salida del origen.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Event,Media,Project,newEvent,newProject,overwriteRange,seconds,threePointEdit,ticks} from '../lib/editor/project';

const close=(actual:number,expected:number,message?:string)=>assert.ok(Math.abs(actual-expected)<1e-6,message??`${actual} ≠ ${expected}`);
const media=(id:string,duration=10,extra:Partial<Media>={}):Media=>({id,name:`${id}.mp4`,size:0,modified:0,kind:'video',duration:ticks(duration),width:1920,height:1080,hasAudio:false,mime:'video/mp4',sourcePath:`C:\\${id}.mp4`,...extra});
const find=(p:Project,id:string)=>p.events.find(e=>e.id===id) as Event;
// Una pista de vídeo con un clip de 0 a 5 s y otro después, y una pista de audio con su propio clip.
function base(){
  const p=newProject();
  p.media=[media('a'),media('b'),media('m',10,{kind:'audio',hasAudio:false,mime:'audio/wav'})];
  const video=p.tracks[1].id, audio=p.tracks[2].id;
  const long={...newEvent(video,'video',0,ticks(5)),mediaId:'a',name:'Largo'};
  const tail={...newEvent(video,'video',ticks(6),ticks(2)),mediaId:'b',name:'Cola'};
  const music={...newEvent(audio,'audio',ticks(4),ticks(4)),mediaId:'m',name:'Música'};
  p.events.push(long,tail,music);
  return {p,video,audio,long,tail,music};
}
const onTrack=(p:Project,trackId:string)=>p.events.filter(e=>e.trackId===trackId).sort((a,b)=>a.start-b.start);

test('sobrescribir: un clip que cruza el tramo se parte en dos y conserva su material',()=>{
  const {p,video,long}=base();
  assert.equal(overwriteRange(p,video,ticks(2),ticks(3)),true);
  const pieces=onTrack(p,video);
  assert.equal(pieces.length,3,'el largo se parte en dos y la cola sigue');
  const [before,after]=pieces;
  close(seconds(before.start),0);
  close(seconds(before.duration),2);
  close(seconds(after.start),3);
  close(seconds(after.duration),2);
  close(seconds(after.offset),3,'el trozo de después empieza donde toca del archivo');
  assert.equal(after.mediaId,'a');
  assert.notEqual(after.id,long.id);
});

test('sobrescribir: por el principio y por el final solo recorta',()=>{
  const start=base();
  overwriteRange(start.p,start.video,0,ticks(2));
  const trimmed=onTrack(start.p,start.video)[0];
  close(seconds(trimmed.start),2);
  close(seconds(trimmed.duration),3);
  close(seconds(trimmed.offset),2,'el material se salta lo que se comió');
  const end=base();
  overwriteRange(end.p,end.video,ticks(3),ticks(9));
  const pieces=onTrack(end.p,end.video);
  assert.equal(pieces.length,1,'el clip largo se queda con su principio y la cola desaparece');
  close(seconds(pieces[0].duration),3);
});

test('sobrescribir: un tramo que tapa todo el clip se lo lleva entero',()=>{
  const {p,video}=base();
  overwriteRange(p,video,0,ticks(10));
  assert.equal(onTrack(p,video).length,0);
});

test('sobrescribir: no toca las otras pistas ni lo que queda fuera del tramo',()=>{
  const {p,video,audio,music}=base();
  overwriteRange(p,video,ticks(2),ticks(3));
  assert.equal(find(p,music.id).duration,ticks(4),'la música sigue igual');
  assert.equal(p.events.some(e=>e.trackId===audio&&e.start===music.start),true);
});

test('insertar en el cursor: el clip entra con su entrada y salida, y lo siguiente se corre',()=>{
  const {p,video,tail}=base();
  const created=threePointEdit(p,media('a'),{inPoint:ticks(2),outPoint:ticks(4),at:ticks(1),mode:'insert',ripple:'track',trackId:video});
  assert.equal(created.length,1);
  const inserted=find(p,created[0]);
  close(seconds(inserted.start),1);
  close(seconds(inserted.duration),2,'la duración es la del tramo marcado');
  close(seconds(inserted.offset),2,'y el material empieza en la entrada');
  close(seconds(find(p,tail.id).start),8,'lo que venía después se corre dos segundos');
});

test('insertar sin rizo deja lo de después donde estaba y puede pisarlo',()=>{
  const {p,video,tail}=base();
  threePointEdit(p,media('a'),{inPoint:0,outPoint:ticks(2),at:ticks(5),mode:'insert',trackId:video});
  close(seconds(find(p,tail.id).start),6,'sin rizo nada se mueve');
  assert.equal(p.events.filter(e=>e.trackId===video).length,3);
});

test('sobrescribir en el cursor: deja el hueco limpio y coloca el clip',()=>{
  const {p,video,tail}=base();
  const created=threePointEdit(p,media('b'),{inPoint:0,outPoint:ticks(2),at:ticks(1),mode:'overwrite',trackId:video});
  const inserted=find(p,created[0]);
  close(seconds(inserted.start),1);
  close(seconds(inserted.duration),2);
  const pieces=onTrack(p,video);
  assert.equal(pieces.some(e=>e.start<ticks(1)&&e.start+e.duration>ticks(1)),false,'nada se solapa con el clip nuevo');
  close(seconds(find(p,tail.id).start),6,'y la cola no se mueve al sobrescribir');
});

test('tres puntos: los límites se respetan y el audio vinculado acompaña al vídeo',()=>{
  const {p,video}=base();
  const withAudio=media('c',6,{hasAudio:true});
  const created=threePointEdit(p,withAudio,{inPoint:ticks(5),outPoint:ticks(9),at:0,mode:'insert',trackId:video});
  assert.equal(created.length,2,'el vídeo con audio entra como par vinculado');
  const [picture,sound]=created.map(id=>find(p,id));
  assert.equal(picture.kind,'video');
  assert.equal(sound.kind,'audio');
  assert.equal(picture.group,sound.group);
  close(seconds(picture.duration),1,'la salida se limita a lo que dura el archivo');
  close(seconds(picture.offset),5);
  // Una salida anterior a la entrada deja un fotograma como mínimo.
  const tiny=threePointEdit(p,media('d',6),{inPoint:ticks(3),outPoint:ticks(1),at:ticks(2),mode:'overwrite',trackId:video});
  close(seconds(find(p,tiny[0]).duration),1/30);
});
