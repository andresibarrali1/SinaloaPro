// Transcripción de una selección: qué audio sale del equipo cuando se elige «Solo lo seleccionado en la línea
// de tiempo». Se comprueba sin red: se mira el alcance que se calcula, las muestras que se enviarían y el
// desplazamiento de los tiempos de vuelta a su sitio.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderSpeechAudio,shiftCues,groupWordCues,speechSelection} from '../lib/editor/speech';
import {newProject,newEvent,newTrack,ticks,seconds,uid} from '../lib/editor/project';
import {MediaLibrary} from '../lib/editor/media';

// Un proyecto con dos pistas de audio: «Audio» con dos clips separados (el segundo empieza en 5 s) y «Música»
// con un clip que suena por encima de la selección. Los valores de cada material son constantes, así que en las
// muestras se ve qué se mezcló y qué no.
function fixture(){
 const p=newProject();
 const voz=p.tracks[2];
 const musica=newTrack('audio','Música');
 p.tracks.push(musica);
 const library=new MediaLibrary();
 const material=(value:number)=>{
  const samples=new Float32Array(48000*4).fill(value);
  const id=uid();
  library.items.set(id,{file:{} as File,firstVideo:0,pcm:{channels:[samples],sampleRate:48000}});
  p.media.push({id,name:`${id}.wav`,size:samples.length*2,modified:0,kind:'audio',duration:ticks(4),width:0,height:0,hasAudio:true,mime:'audio/wav'});
  return id;
 };
 const primero={...newEvent(voz.id,'audio',0,ticks(2)),mediaId:material(.6)};
 const segundo={...newEvent(voz.id,'audio',ticks(5),ticks(2)),mediaId:material(.1)};
 const fondo={...newEvent(musica.id,'audio',ticks(4),ticks(4)),mediaId:material(.5)};
 p.events.push(primero,segundo,fondo);
 return {p,voz,musica,library,primero,segundo,fondo};
}
const near=(value:number,expected:number,message?:string)=>assert.ok(Math.abs(value-expected)<1e-3,`${message??''} ${value} ≈ ${expected}`);
const peak=(samples:Float32Array)=>{let value=0;for(const sample of samples)value=Math.max(value,Math.abs(sample));return value;};

test('alcance de la selección: un clip suelto se transcribe solo, desde su segundo',()=>{
 const {p,voz,segundo}=fixture();
 const pick=speechSelection(p,[segundo.id],null);
 assert.equal(pick.ok,true);
 if(!pick.ok)return;
 assert.equal(pick.clips,1);
 assert.deepEqual([...pick.scope.events!],[segundo.id],'solo suena el clip elegido');
 near(pick.scope.from,5,'empieza donde empieza el clip');
 near(pick.scope.to,7,'acaba donde acaba el clip');
 assert.deepEqual(pick.tracks,[voz.name]);
 assert.equal(pick.scope.label,'1 clip de la pista «Audio»','se puede leer en el diálogo y en la barra de estado');
 assert.equal(pick.muted,false);
});

test('alcance de la selección: la cabecera de la pista trae todos sus clips y ninguno de otras pistas',()=>{
 const {p,voz,musica,primero,segundo}=fixture();
 const pick=speechSelection(p,[],voz.id);
 assert.equal(pick.ok,true);
 if(!pick.ok)return;
 assert.deepEqual([...pick.scope.events!].sort(),[primero.id,segundo.id].sort());
 assert.ok(!pick.scope.events!.has(p.events.find(event=>event.trackId===musica.id)!.id),'la música de la otra pista no entra');
 assert.equal(pick.clips,2);
 near(pick.scope.from,0);
 near(pick.scope.to,7);
 assert.deepEqual(pick.tracks,[voz.name]);
 assert.match(pick.scope.label,/la pista «Audio»/);
});

test('alcance de la selección: el audio enlazado de un vídeo entra con el vídeo',()=>{
 const p=newProject();
 const video=p.tracks[1],audio=p.tracks[2];
 const group=uid();
 p.events.push({...newEvent(video.id,'video',ticks(3),ticks(2)),name:'Plano',group});
 p.events.push({...newEvent(audio.id,'audio',ticks(3),ticks(2)),name:'Voz del plano',group});
 const pick=speechSelection(p,[p.events[0].id],null);
 assert.equal(pick.ok,true);
 if(!pick.ok)return;
 assert.deepEqual([...pick.scope.events!],[p.events[1].id],'se transcribe el audio enlazado del plano');
 near(pick.scope.from,3);
 near(pick.scope.to,5);
});

test('alcance de la selección: se explica qué falta cuando no hay audio que transcribir',()=>{
 const p=newProject();
 const vacío=speechSelection(p,[],null);
 assert.equal(vacío.ok,false);
 if(!vacío.ok)assert.match(vacío.reason,/No hay nada seleccionado/);
 const texto={...newEvent(p.tracks[0].id,'text',0,ticks(2))};
 p.events.push(texto);
 const soloTexto=speechSelection(p,[texto.id],null);
 assert.equal(soloTexto.ok,false);
 if(!soloTexto.ok)assert.match(soloTexto.reason,/no tiene audio/);
 const pistaVideo=speechSelection(p,[],p.tracks[1].id);
 assert.equal(pistaVideo.ok,false);
 if(!pistaVideo.ok)assert.match(pistaVideo.reason,/es de vídeo/);
 const pistaAudio=speechSelection(p,[],p.tracks[2].id);
 assert.equal(pistaAudio.ok,false);
 if(!pistaAudio.ok)assert.match(pistaAudio.reason,/no tiene clips de audio/);
});

test('audio de la selección: solo se mezcla lo elegido, en su tramo y con su desfase',()=>{
 const {p,voz,library,segundo}=fixture();
 const pick=speechSelection(p,[segundo.id],null);
 assert.equal(pick.ok,true);
 if(!pick.ok)return;
 const rendered=renderSpeechAudio(p,library,16000,2,pick.scope);
 near(rendered.duration,2,'el archivo dura lo que el clip');
 near(rendered.from,5,'empieza en el segundo 5 de la línea de tiempo');
 assert.equal(rendered.samples.length,32000);
 // La rampa de la música (.5) y el otro clip de la misma pista (.6) no están: solo queda el clip elegido (.1).
 near(peak(rendered.samples),.1,'solo suena el clip seleccionado');
 // Y los tiempos del servicio vuelven a su sitio sumando `from`.
 const words=shiftCues([{start:0,end:.4,text:'Hola'},{start:.4,end:.9,text:'mundo'}],rendered.from);
 assert.deepEqual(words.map(word=>[word.text,Number(word.start.toFixed(3))]),[['Hola',5],['mundo',5.4]]);
 const cues=groupWordCues(words,2);
 assert.equal(cues[0].text,'Hola mundo');
 near(cues[0].start,5);
 near(cues[0].end,5.9);
 // La pista silenciada se transcribe igual: lo que manda es la selección.
 voz.mute=true;
 const muted=renderSpeechAudio(p,library,16000,2,pick.scope);
 near(peak(muted.samples),.1,'silenciada para escuchar, pero transcrita');
 // Sin alcance, el proyecto entero sí respeta el silencio: la pista «Audio» calla y solo queda la música.
 const whole=renderSpeechAudio(p,library,16000,2);
 near(peak(whole.samples),.5,'la mezcla del proyecto respeta el mute');
 voz.mute=false;
});

test('audio de la selección: el tramo del proyecto se mide en segundos y no en tics',()=>{
 const {p,library}=fixture();
 const pick=speechSelection(p,[],p.tracks[2].id);
 assert.equal(pick.ok,true);
 if(!pick.ok)return;
 assert.ok(Number.isFinite(seconds(ticks(pick.scope.to)))&&pick.scope.to>6.9&&pick.scope.to<7.1,`to=${pick.scope.to}`);
 const rendered=renderSpeechAudio(p,library,16000,2,pick.scope);
 near(rendered.duration,pick.scope.to-pick.scope.from,'la duración es la del tramo');
 // Entre los dos clips de la pista hay 3 s de silencio: el archivo los incluye para que los tiempos cuadren.
 assert.equal(rendered.samples.length,Math.round(rendered.duration*16000));
 const middle=rendered.samples.slice(Math.round(2.4*16000),Math.round(4.4*16000));
 near(peak(middle),0,'el silencio entre clips del mismo tramo se conserva');
});
