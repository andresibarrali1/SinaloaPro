// Pruebas del mezclador: envolventes de pista, buses, maestro y la ley de panorama. Se mezcla una señal
// constante (todo unos) para que la salida sea exactamente la ganancia aplicada, muestra a muestra.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MediaLibrary} from '../lib/editor/media';
import {mix} from '../lib/editor/audio';
import {addEnvelopePoint,envelopeValue,newBus,newEvent,newProject,newTrack,removeEnvelopePoint,ticks} from '../lib/editor/project';
import {validateProject} from '../lib/editor/validation';

const RATE=48000;
const close=(actual:number,expected:number,message?:string)=>assert.ok(Math.abs(actual-expected)<1e-6,message??`${actual} ≠ ${expected}`);
function library(value=.5,length=RATE*3){
  const lib=new MediaLibrary();
  const channel=()=>{const data=new Float32Array(length);data.fill(value);return data;};
  lib.items.set('m',{file:{} as File,firstVideo:0,pcm:{sampleRate:RATE,channels:[channel(),channel()]}});
  return lib;
}
function project(){
  const p=newProject();
  p.media.push({id:'m',name:'m.wav',size:0,modified:0,kind:'audio',duration:ticks(3),width:0,height:0,hasAudio:true,mime:'audio/wav'});
  const track=p.tracks.find(t=>t.kind==='audio')!;
  const event=newEvent(track.id,'audio',0,ticks(3));
  event.mediaId='m';
  p.events.push(event);
  return {p,track,event};
}
const at=(frames:Float32Array[],second:number):[number,number]=>[frames[0][Math.round(second*RATE)],frames[1][Math.round(second*RATE)]];

test('envolvente: interpolación recta, extremos mantenidos y sin puntos el valor de reserva',()=>{
  assert.equal(envelopeValue(undefined,5,1),1);
  assert.equal(envelopeValue([],5,.25),.25);
  const points=[{time:100,value:1},{time:300,value:0}];
  assert.equal(envelopeValue(points,50),1,'antes del primer punto vale el primero');
  assert.equal(envelopeValue(points,200),.5,'a mitad, la mitad');
  assert.equal(envelopeValue(points,400),0,'después del último vale el último');
  assert.equal(envelopeValue([...points].reverse(),200),.5,'el orden de entrada da igual');
  const added=addEnvelopePoint(addEnvelopePoint([],200,.5),100,1);
  assert.deepEqual(added.map(point=>point.time),[100,200]);
  assert.deepEqual(addEnvelopePoint(added,200,.25).map(point=>point.value),[1,.25],'un punto nuevo en el mismo instante sustituye');
  assert.deepEqual(removeEnvelopePoint(added,200).map(point=>point.time),[100]);
});

test('sin buses ni envolventes, la mezcla es la de siempre',()=>{
  const {p,track}=project();
  let frames=mix(p,library(),0,RATE);
  close(at(frames,.5)[0],.5);close(at(frames,.5)[1],.5);
  track.gain=.5;
  frames=mix(p,library(),0,RATE);
  close(at(frames,.5)[0],.25);
  track.gain=1;track.pan=-1;
  frames=mix(p,library(),0,RATE);
  close(at(frames,.5)[0],.5*Math.SQRT2);
  close(at(frames,.5)[1],0);
});

test('envolvente de volumen: baja el nivel por el punto que toca',()=>{
  const {p,track}=project();
  track.volumeCurve=[{time:0,value:1},{time:1,value:0}];
  const frames=mix(p,library(),0,RATE*2);
  close(at(frames,.5)[0],.25,'a mitad de la envolvente, la mitad de señal');
  close(at(frames,1.5)[0],0,'y después del último punto, silencio');
});

test('envolvente de volumen: fuera de los puntos se mantiene el valor del extremo',()=>{
  const {p,track}=project();
  track.volumeCurve=[{time:.2,value:1},{time:.8,value:0}];
  const frames=mix(p,library(),0,RATE*2);
  close(at(frames,.1)[0],.5,'antes del primer punto no se atenúa');
  close(at(frames,.5)[0],.25);
  close(at(frames,1.9)[0],0);
});

test('envolvente de panorámica: se suma al fader de la pista y se limita',()=>{
  const {p,track}=project();
  track.panCurve=[{time:0,value:-1},{time:1,value:1}];
  let frames=mix(p,library(),0,RATE);
  close(at(frames,.5)[0],.5,'a mitad de recorrido queda centrada');
  close(at(frames,0)[1],0,'con la panorámica a tope a la izquierda, el canal derecho calla');
  assert.ok(at(frames,.9)[1]>at(frames,.9)[0],'y al final manda la derecha');
  track.pan=1;
  frames=mix(p,library(),0,RATE);
  close(at(frames,0)[1],.5,'fader a la derecha más envolvente a la izquierda queda centrado');
  close(at(frames,0)[0],.5);
});

test('buses: el nivel y el panorama del bus se aplican después de sumar las pistas',()=>{
  const {p,track}=project();
  const bus=newBus('A');
  p.buses=[bus];
  track.busId=bus.id;
  bus.gain=.5;
  let frames=mix(p,library(),0,RATE);
  close(at(frames,.5)[0],.25,'el bus a mitad de nivel');
  bus.pan=-1;bus.gain=1;
  frames=mix(p,library(),0,RATE);
  close(at(frames,.5)[0],.5*Math.SQRT2);
  close(at(frames,.5)[1],0);
  bus.pan=0;bus.mute=true;
  frames=mix(p,library(),0,RATE);
  close(at(frames,.5)[0],0,'un bus silenciado calla a sus pistas');
});

test('buses: el solo de un bus deja fuera a las pistas de los demás',()=>{
  const {p,track}=project();
  const second=newTrack('audio','Segunda');
  const twin=newEvent(second.id,'audio',0,ticks(3));
  twin.mediaId='m';
  p.tracks.push(second);
  p.events.push(twin);
  const busA=newBus('A'),busB=newBus('B');
  p.buses=[busA,busB];
  track.busId=busA.id;
  second.busId=busB.id;
  let frames=mix(p,library(.25),0,RATE);
  close(at(frames,.5)[0],.5,'las dos pistas suenan');
  busA.solo=true;
  frames=mix(p,library(.25),0,RATE);
  close(at(frames,.5)[0],.25,'con el bus A en solo, solo se oye A');
  busA.solo=false;
  second.mute=true;
  frames=mix(p,library(.25),0,RATE);
  close(at(frames,.5)[0],.25,'y silenciar una pista deja a la otra');
});

test('maestro: nivel y panorama finales, y el limitador sigue sujetando los picos',()=>{
  const {p}=project();
  p.master={gain:.5,pan:0};
  let frames=mix(p,library(),0,RATE);
  close(at(frames,.5)[0],.25);
  p.master={gain:1,pan:1};
  frames=mix(p,library(),0,RATE);
  close(at(frames,.5)[0],0);
  close(at(frames,.5)[1],.5*Math.SQRT2);
  p.master={gain:2,pan:0};
  frames=mix(p,library(.9),0,RATE);
  close(at(frames,.5)[0],1,'nada pasa de 1');
});

test('validación: una pista no puede apuntar a un bus que no existe',()=>{
  const {p,track}=project();
  track.busId='no-existe';
  assert.throws(()=>validateProject(p),/bus que no existe/);
  const bus=newBus('A');
  p.buses=[bus];
  track.busId=bus.id;
  assert.doesNotThrow(()=>validateProject(p));
  p.buses=[bus,{...newBus('B'),id:bus.id}];
  assert.throws(()=>validateProject(p),/buses duplicados/);
});
