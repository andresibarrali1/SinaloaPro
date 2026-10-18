// Pruebas de las tomas de efectos de audio por pista y por bus. Se mezcla una señal conocida (constante,
// un impulso, un tono) y se mide la salida muestra a muestra, así que cada comprobación es sobre el sonido
// que sale, no sobre la interfaz.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MediaLibrary} from '../lib/editor/media';
import {mix} from '../lib/editor/audio';
import {newEvent,newProject,ticks} from '../lib/editor/project';
import {validateProject} from '../lib/editor/validation';
import {
  AUDIO_EFFECT_KINDS,AUDIO_EFFECT_LABEL,AUDIO_EFFECT_PARAMS,createInsertChain,defaultAudioEffect,describeAudioEffect,
  insertReduction,normalizeAudioEffect,processInserts,
} from '../lib/editor/audio-effects';
import type {AudioEffect,AudioEffectKind} from '../lib/editor/project';

const RATE=48000;
const near=(actual:number,expected:number,tolerance=1e-3,message?:string)=>assert.ok(Math.abs(actual-expected)<=tolerance,message??`${actual} no está a menos de ${tolerance} de ${expected}`);
// Biblioteca con una forma de onda a elección: constante, impulso o tono.
function library(shape:(index:number)=>number,length=RATE){
  const lib=new MediaLibrary();
  const channel=()=>{const data=new Float32Array(length);for(let index=0;index<length;index++)data[index]=shape(index);return data;};
  lib.items.set('m',{file:{} as File,firstVideo:0,pcm:{sampleRate:RATE,channels:[channel(),channel()]}});
  return lib;
}
function project(){
  const p=newProject();
  p.media.push({id:'m',name:'m.wav',size:0,modified:0,kind:'audio',duration:ticks(2),width:0,height:0,hasAudio:true,mime:'audio/wav'});
  const track=p.tracks.find(t=>t.kind==='audio')!;
  const event=newEvent(track.id,'audio',0,ticks(1));
  event.mediaId='m';
  p.events.push(event);
  return {p,track};
}
const effect=(kind:AudioEffectKind,patch:Partial<AudioEffect>={})=>normalizeAudioEffect({kind,...patch},`fx-${kind}`);
const rms=(data:Float32Array,from=0,to=data.length)=>{let sum=0;for(let index=from;index<to;index++)sum+=data[index]*data[index];return Math.sqrt(sum/Math.max(1,to-from));};
const peak=(data:Float32Array)=>data.reduce((max,value)=>Math.max(max,Math.abs(value)),0);
// Valor absoluto máximo en una ventana de tiempo, en milisegundos.
const windowPeak=(data:Float32Array,fromMs:number,toMs:number)=>{let max=0;for(let index=Math.round(fromMs/1000*RATE);index<Math.min(data.length,Math.round(toMs/1000*RATE));index++)max=Math.max(max,Math.abs(data[index]));return max;};
// El limitador del maestro recorta en ±1, así que las pruebas que miden ganancia usan señales pequeñas.
const small=()=>library(()=>.1);
const constant=()=>library(()=>.5);

test('tomas: catálogo, valores por defecto y normalización',()=>{
  assert.equal(AUDIO_EFFECT_KINDS.length,8);
  // Todas las tomas del catálogo tienen etiqueta, nota y lista de parámetros.
  for(const kind of AUDIO_EFFECT_KINDS){
    assert.ok(AUDIO_EFFECT_LABEL[kind].length>0,`${kind} sin etiqueta`);
    assert.ok(AUDIO_EFFECT_PARAMS[kind].length>0,`${kind} sin parámetros`);
    const base=defaultAudioEffect(kind,`fx-${kind}`);
    assert.equal(base.kind,kind);
    assert.equal(base.enabled,true);
    // Los valores por defecto tienen que pasar la validación tal cual.
    assert.equal(normalizeAudioEffect(base).kind,kind);
  }
  // La normalización recorta lo imposible y rellena lo que falta.
  const fixed=normalizeAudioEffect({kind:'eq',low:900,mid:-900,high:3});
  assert.equal(fixed.low,24);
  assert.equal(fixed.mid,-24);
  assert.equal(fixed.high,3);
  assert.equal(fixed.kind,'eq');
  assert.equal(normalizeAudioEffect({kind:'compressor',threshold:-900}).threshold,-60);
  assert.equal(normalizeAudioEffect({kind:'compressor'}).ratio,4);
  // `NaN` no es un número utilizable, así que la normalización se queda con el valor por defecto de la toma.
  assert.equal(normalizeAudioEffect({kind:'delay',amount:Number.NaN}).amount,.25);
  assert.equal(normalizeAudioEffect({kind:'distortion',amount:Number.NaN}).amount,.3);
  assert.ok(describeAudioEffect(defaultAudioEffect('compressor','x')).includes('relación'));
  assert.ok(describeAudioEffect(defaultAudioEffect('delay','x')).includes('ms'));
});

test('tomas: ecualizador, graves y agudos en estantería',()=>{
  const {p,track}=project();
  const lib=library(()=>.1);
  // Sin tomas, la señal pasa intacta.
  near(peak(mix(p,lib,0,RATE)[0]),.1);
  // Graves +6 dB: la constante (0 Hz) se multiplica por 10^(6/20) ≈ 1,995.
  track.inserts=[effect('eq',{low:6})];
  let output=mix(p,lib,0,RATE)[0];
  near(peak(output.slice(RATE/2)),.1995,.002,'estantería de graves a +6 dB');
  // Graves −6 dB: la mitad.
  track.inserts=[effect('eq',{low:-6})];
  output=mix(p,lib,0,RATE)[0];
  near(peak(output.slice(RATE/2)),.05,.002,'estantería de graves a −6 dB');
  // Medios +6 dB: una constante no tiene medios, así que no cambia el nivel.
  track.inserts=[effect('eq',{mid:6})];
  output=mix(p,lib,0,RATE)[0];
  near(peak(output.slice(RATE/2)),.1,.002,'el filtro de pico no toca la continua');
  // Y con una señal de 1 kHz sí la levanta.
  track.inserts=[];
  const dryTone=rms(mix(p,library(index=>Math.sin(2*Math.PI*1000*index/RATE)),0,RATE)[0],RATE/2);
  track.inserts=[effect('eq',{mid:6})];
  const boostedTone=rms(mix(p,library(index=>Math.sin(2*Math.PI*1000*index/RATE)),0,RATE)[0],RATE/2);
  assert.ok(boostedTone>dryTone*1.2,`los medios a +6 dB suben el tono de 1 kHz (${dryTone.toFixed(3)} → ${boostedTone.toFixed(3)})`);
});

test('tomas: el compresor baja lo que pasa del umbral y la ganancia de salida lo compensa',()=>{
  const {p,track}=project();
  const lib=constant();
  // 0,5 es −6,02 dB. Con umbral −30 dB y relación 4:1, la salida queda en −24 dB (0,0631).
  track.inserts=[effect('compressor',{threshold:-30,ratio:4,attack:1,release:50,makeup:0})];
  const compressed=mix(p,lib,0,RATE)[0];
  near(rms(compressed,RATE/2),.0631,.002,'compresión 4:1 de −6 dB contra un umbral de −30 dB');
  // La ganancia de salida de +6 dB la multiplica por 2.
  track.inserts=[effect('compressor',{threshold:-30,ratio:4,attack:1,release:50,makeup:6})];
  near(rms(mix(p,lib,0,RATE)[0],RATE/2),.1262,.003,'ganancia de salida del compresor');
  // Por debajo del umbral no toca nada (se comprueba contra el mismo proyecto sin tomas). Se pone la
  // ganancia de salida a cero para medir solo la compresión: la toma por defecto trae +3 dB de compensación.
  track.inserts=undefined;
  near(rms(mix(p,library(()=>.01),0,RATE)[0],RATE/2),.01,.001,'referencia sin tomas');
  track.inserts=[effect('compressor',{threshold:-30,ratio:4,attack:1,release:50,makeup:0})];
  near(rms(mix(p,library(()=>.01),0,RATE)[0],RATE/2),.01,.001,'por debajo del umbral el compresor no actúa');
  // La relación se nota en el régimen estable: con más relación, el exceso del umbral se comprime más y la
  // señal queda más baja. Se mide un valor concreto del final del bloque, no el promedio, porque el ataque
  // tarda unos milisegundos en enganchar y eso ensuciaría la media.
  const settled=(ratio:number)=>{track.inserts=[effect('compressor',{threshold:-30,ratio,attack:1,release:50,makeup:0})];return Math.abs(mix(p,lib,0,RATE)[0][Math.round(.4*RATE)]);};
  assert.ok(settled(20)<settled(2),`a más relación, más compresión: ${settled(2).toFixed(4)} (2:1) → ${settled(20).toFixed(4)} (20:1)`);
});

test('tomas: el limitador deja la señal por debajo del techo',()=>{
  const {p,track}=project();
  const lib=constant();
  track.inserts=[effect('limiter',{threshold:-6,release:20})];
  const output=mix(p,lib,0,RATE)[0];
  const ceiling=Math.pow(10,-6/20);
  assert.ok(peak(output)<=ceiling+1e-6,`el pico (${peak(output).toFixed(4)}) no pasa del techo (${ceiling.toFixed(4)})`);
  assert.ok(peak(output)>ceiling*.98,'y lo aprovecha: el limitador no silencia');
  // Con un techo más bajo, la señal sale más baja.
  track.inserts=[effect('limiter',{threshold:-20,release:20})];
  assert.ok(peak(mix(p,lib,0,RATE)[0])<.15,'un techo de −20 dB deja la señal por debajo de 0,15');
});

test('tomas: la puerta silencia lo que queda por debajo del umbral',()=>{
  const {p,track}=project();
  track.inserts=[effect('gate',{threshold:-20,release:10})];
  // 0,5 está muy por encima del umbral: pasa.
  near(rms(mix(p,constant(),0,RATE)[0],RATE/2),.5,.01,'por encima del umbral la puerta está abierta');
  // 0,01 (−40 dB) está por debajo: se queda en silencio.
  assert.ok(rms(mix(p,library(()=>.01),0,RATE)[0],RATE/2)<1e-6,'por debajo del umbral la puerta cierra');
});

test('tomas: la saturación crece con la cantidad y no toca la señal con la cantidad a cero',()=>{
  const {p,track}=project();
  const lib=small();
  track.inserts=[effect('distortion',{amount:0})];
  near(peak(mix(p,lib,0,RATE)[0]),.1,1e-6,'con la cantidad a cero no cambia nada');
  const levels=[0,.25,.5,.8,1].map(amount=>{
    track.inserts=[effect('distortion',{amount})];
    return peak(mix(p,lib,0,RATE)[0]);
  });
  for(let index=1;index<levels.length;index++)assert.ok(levels[index]>levels[index-1],`la saturación crece: ${levels.join(' → ')}`);
  assert.ok(levels[4]<1,'la saturación no llega a recortar');
});

test('tomas: el retardo devuelve el eco en su tiempo y con su realimentación',()=>{
  const {p,track}=project();
  const lib=library(index=>index<4?1:0);
  track.inserts=[effect('delay',{time:250,feedback:0,amount:.5})];
  const output=mix(p,lib,0,RATE)[0];
  near(Math.abs(output[0]),1,1e-3,'el sonido directo sigue');
  // El impulso seco dura cuatro muestras; a partir de ahí, hasta el eco, no puede haber nada.
  assert.ok(windowPeak(output,.3,240)<1e-3,'no hay eco antes de tiempo');
  near(windowPeak(output,245,255),.5,.02,'el eco llega a los 250 ms con la mitad de nivel');
  assert.ok(windowPeak(output,495,505)<1e-3,'sin realimentación no hay segundo eco');
  // Con realimentación al 50 % hay un segundo eco a la mitad del primero.
  track.inserts=[effect('delay',{time:250,feedback:.5,amount:.5})];
  const echoed=mix(p,lib,0,RATE)[0];
  const first=windowPeak(echoed,245,255), second=windowPeak(echoed,495,505);
  near(second,first*.5,.02,'el segundo eco vale la realimentación por el primero');
});

test('tomas: la reverberación deja una cola que se apaga',()=>{
  const {p,track}=project();
  const lib=library(index=>index<4?1:0);
  track.inserts=[effect('reverb',{time:400,damping:.3,amount:.5})];
  const output=mix(p,lib,0,RATE)[0];
  const first=windowPeak(output,350,450), second=windowPeak(output,750,850);
  assert.ok(first>.2,`la primera reflexión se oye (${first.toFixed(4)})`);
  assert.ok(second>0,`la cola sigue (${second.toFixed(4)})`);
  assert.ok(second<first,'y se va apagando');
  assert.ok(windowPeak(output,950,1000)<first*.5,'al final queda casi nada');
});

test('tomas: el efecto de teléfono recorta los agudos y deja pasar los medios',()=>{
  const {p,track}=project();
  const tone=(hz:number)=>library(index=>Math.sin(2*Math.PI*hz*index/RATE));
  track.inserts=[];
  const dryHigh=rms(mix(p,tone(8000),0,RATE)[0],RATE/2);
  const dryMid=rms(mix(p,tone(1000),0,RATE)[0],RATE/2);
  track.inserts=[effect('phone',{amount:1})];
  const phoneHigh=rms(mix(p,tone(8000),0,RATE)[0],RATE/2);
  const phoneMid=rms(mix(p,tone(1000),0,RATE)[0],RATE/2);
  assert.ok(phoneHigh<dryHigh*.5,`los 8 kHz se apagan (${dryHigh.toFixed(3)} → ${phoneHigh.toFixed(3)})`);
  assert.ok(phoneMid>dryMid,'y los medios se mantienen o suben por la saturación');
});

test('tomas: una toma apagada no toca la señal',()=>{
  const {p,track}=project();
  const lib=small();
  track.inserts=[effect('eq',{low:12,enabled:false}),effect('distortion',{amount:1,enabled:false})];
  near(peak(mix(p,lib,0,RATE)[0]),.1,1e-6,'las tomas apagadas se saltan');
  // Y mezclar con `mix` (que crea su propia cadena) no cambia el resultado de la cadena suelta.
  const chain=createInsertChain(track.inserts,RATE);
  const channels=[new Float32Array([.1,.1,.1,.1]),new Float32Array([.1,.1,.1,.1])];
  processInserts(chain,channels);
  near(peak(channels[0]),.1,1e-6);
  assert.equal(insertReduction(chain,0),0,'una toma que no es de dinámica no informa reducción');
});

test('tomas: el orden es pista (tomas) y después bus (tomas), y el nivel va por medio',()=>{
  const {p,track}=project();
  const lib=small();
  // La toma de la pista baja los graves a la mitad y el fader de la pista los sube al doble: el resultado
  // tiene que ser la señal original, porque la toma va **antes** del fader.
  track.inserts=[effect('eq',{low:-6})];
  track.gain=2;
  const output=mix(p,lib,0,RATE)[0];
  near(peak(output.slice(RATE/2)),.1,.005,'la toma se aplica antes del nivel de la pista');
  track.gain=1;track.inserts=undefined;
  // Con un bus y una toma en el bus, la señal pasa por las dos cadenas.
  const bus={id:'b1',name:'Bus A',gain:1,pan:0,mute:false,solo:false,inserts:[effect('eq',{low:6})]};
  p.buses=[bus];
  track.busId='b1';
  near(peak(mix(p,lib,0,RATE)[0].slice(RATE/2)),.1995,.003,'la toma del bus se aplica a lo que llega por el bus');
  // Y si la pista va directa al maestro, la toma del bus no la toca.
  track.busId=undefined;
  near(peak(mix(p,lib,0,RATE)[0].slice(RATE/2)),.1,.003,'la toma del bus no afecta a las pistas que no pasan por él');
});

test('tomas: la validación rechaza tomas y parámetros imposibles',()=>{
  const {p,track}=project();
  track.inserts=[defaultAudioEffect('compressor','fx-1')];
  assert.doesNotThrow(()=>validateProject(p));
  // Una toma de tipo desconocido no pasa.
  track.inserts=[{...defaultAudioEffect('eq','fx-2'),kind:'reverbDeConvolución' as AudioEffectKind}];
  assert.throws(()=>validateProject(p),/Proyecto inválido/);
  // Parámetros fuera de rango, tampoco.
  for(const bad of [{ratio:0},{threshold:-100},{attack:900},{release:9000},{makeup:90},{time:1},{feedback:2},{damping:3},{low:60},{mid:-60},{high:60},{amount:-1}]){
    track.inserts=[{...defaultAudioEffect('compressor','fx-3'),...bad}];
    assert.throws(()=>validateProject(p),/Proyecto inválido/,'tiene que rechazar '+JSON.stringify(bad));
  }
  // Las tomas del bus se validan igual.
  track.inserts=undefined;
  p.buses=[{id:'b1',name:'Bus A',gain:1,pan:0,mute:false,solo:false,inserts:[{...defaultAudioEffect('eq','fx-4'),low:99}]}];
  track.busId='b1';
  assert.throws(()=>validateProject(p),/Proyecto inválido/);
  p.buses[0].inserts=[defaultAudioEffect('eq','fx-5')];
  assert.doesNotThrow(()=>validateProject(p));
});
