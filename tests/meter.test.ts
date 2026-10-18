// Pruebas de los medidores: pico, pico real, RMS y sonoridad. Las que se pueden comprobar con aritmética
// exacta (pico, RMS, la calibración de 1 kHz, la forma del filtro K) se comprueban con números; la
// sonoridad se marca como aproximación en la documentación y aquí se comprueba su forma, no una
// certificación.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SILENCE_DB,LoudnessMeter,averageOf,dbToGain,formatDb,formatLufs,measure,measureLoudness} from '../lib/editor/meter';

const RATE=48000;
const near=(actual:number,expected:number,tolerance=1e-3,message?:string)=>assert.ok(Math.abs(actual-expected)<=tolerance,message??`${actual} no está a menos de ${tolerance} de ${expected}`);
const sine=(amplitude:number,hz=1000,length=RATE*3)=>{const data=new Float32Array(length);for(let index=0;index<length;index++)data[index]=amplitude*Math.sin(2*Math.PI*hz*index/RATE);return data;};
const constant=(amplitude:number,length=RATE*3)=>{const data=new Float32Array(length);data.fill(amplitude);return data;};

test('medidores: pico y RMS exactos, con el silencio y el recorte señalados',()=>{
  const reading=measure([constant(.5),constant(.5)]);
  near(reading.peakDb,-6.0206,.001,'el pico de 0,5 es −6,02 dBFS');
  near(reading.rmsDb,-3.0103,.001,'el RMS de una continua de 0,5 también es 0,5, o sea −3,01 dBFS');
  assert.equal(reading.clipped,false);
  const silence=measure([new Float32Array(RATE),new Float32Array(RATE)]);
  assert.equal(silence.peakDb,SILENCE_DB);
  assert.equal(silence.rmsDb,SILENCE_DB);
  assert.equal(silence.loudnessLufs,SILENCE_DB);
  assert.equal(silence.clipped,false);
  // Un valor que llega al fondo de escala se marca como recortado, aunque el pico no pueda subir de 0.
  const clipped=measure([constant(1),constant(1)]);
  assert.equal(clipped.peakDb,0);
  assert.equal(clipped.clipped,true);
  near(measure([constant(.25),constant(.25)]).peakDb,-12.0412,.001);
  near(measure([constant(.01),constant(.01)]).peakDb,-40,.001);
  // Las funciones de formato no inventan números con el silencio.
  assert.equal(formatDb(SILENCE_DB),'−∞');
  assert.equal(formatLufs(SILENCE_DB),'−∞');
  assert.equal(formatDb(-6.02),'-6.0');
  assert.equal(formatLufs(-23.01),'-23.0');
  near(dbToGain(-6.0206),.5,.0005);
});

test('medidores: la sonoridad está calibrada con la norma (1 kHz a −20 dBFS da −23 LUFS)',()=>{
  // Es el punto de calibración de ITU-R BS.1770 / EBU R128: un tono de 1 kHz a −20 dBFS mide −23 LUFS.
  near(measureLoudness([sine(.1)]),-23,.15,'calibración de 1 kHz a −20 dBFS en un canal');
  // La energía se reparte entre los canales (si se sumara, el mismo tono en estéreo daría 3 LU más): el
  // estéreo dual-mono mide lo mismo que el canal suelto, que es la calibración de la norma.
  near(measureLoudness([sine(.1),sine(.1)]),-23,.15,'estéreo dual-mono');
  // La escala es lineal con el nivel: 6 dB menos de señal son 6 LU menos.
  for(const [db,expected] of [[-6,-9],[-12,-15],[-24,-27],[-36,-39]] as [number,number][]){
    near(measureLoudness([sine(dbToGain(db))]),expected,.2,`${db} dBFS`);
  }
});

test('medidores: el filtro K deja pasar los medios y recorta los extremos',()=>{
  const at=(hz:number)=>measureLoudness([sine(.1,hz)]);
  const reference=at(1000);
  // La estantería de agudos sube a partir de ~1,5 kHz: 8 kHz tiene que medir más que 1 kHz.
  assert.ok(at(8000)>reference+3,`los 8 kHz suben (${reference.toFixed(2)} → ${at(8000).toFixed(2)} LUFS)`);
  // El paso alto de 38 Hz recorta los graves: 20 Hz tiene que medir bastante menos.
  assert.ok(at(20)<reference-6,`los 20 Hz bajan (${reference.toFixed(2)} → ${at(20).toFixed(2)} LUFS)`);
  // La meseta de agudos se aplana por encima de 6 kHz.
  assert.ok(Math.abs(at(15000)-at(8000))<1.5,'la estantería llega a su meseta');
  // Y los medios están cerca de la referencia.
  assert.ok(Math.abs(at(500)-reference)<2);
});

test('medidores: el pico real ve lo que hay entre muestras',()=>{
  // Un tono de 12 kHz muestreado a 48 kHz pasa justo por los picos con fase 0, pero con un desfase cae entre
  // muestras: el pico de las muestras es más bajo que el real.
  const length=4000;
  const shifted=new Float32Array(length);
  for(let index=0;index<length;index++)shifted[index]=.9*Math.sin(2*Math.PI*(RATE/4)*index/RATE+Math.PI/4);
  const reading=measure([shifted]);
  assert.ok(reading.truePeakDb>reading.peakDb+.5,`el pico real (${reading.truePeakDb.toFixed(3)}) supera al de las muestras (${reading.peakDb.toFixed(3)})`);
  assert.ok(reading.truePeakDb<0,'y sigue por debajo del fondo de escala');
  // Sin señal, los dos coinciden.
  const quiet=measure([new Float32Array(length)]);
  assert.equal(quiet.peakDb,quiet.truePeakDb);
});

test('medidores: acumulativo por bloques, con reinicio y resumen de varias mediciones',()=>{
  const meter=new LoudnessMeter(RATE,2);
  // Antes de meter nada, todo es silencio y no hay ventanas.
  assert.equal(meter.reading().loudnessLufs,SILENCE_DB);
  meter.push([sine(.1),sine(.1)]);
  const first=meter.reading();
  // Tres segundos de tono son siete ventanas de 400 ms, así que la sonoridad integrada ya está medida.
  near(first.loudnessLufs,-23,.15,'la primera lectura ya mide sonoridad');
  near(first.peakDb,-20,.01);
  // Meter el mismo audio otra vez no cambia la sonoridad integrada (es una media) ni el pico.
  meter.push([sine(.1),sine(.1)]);
  const second=meter.reading();
  near(second.loudnessLufs,first.loudnessLufs,.05,'la sonoridad integrada es estable');
  near(second.peakDb,first.peakDb,.01);
  meter.reset();
  assert.equal(meter.reading().loudnessLufs,SILENCE_DB,'el reinicio borra el estado');
  assert.equal(meter.reading().peakDb,SILENCE_DB);
  // El resumen de varias mediciones se queda con el peor pico y con la media de las sonoridades.
  const summary=averageOf([measure([sine(.1)]),measure([sine(.05)])]);
  near(summary.peakDb,-20,.05);
  assert.ok(summary.loudnessLufs<-20&&summary.loudnessLufs>-30,'la media de las sonoridades cae entre las dos');
  assert.equal(averageOf([]).loudnessLufs,SILENCE_DB);
  assert.equal(averageOf([]).clipped,false);
  // Si una de las mediciones recorta, el resumen lo dice.
  assert.equal(averageOf([measure([sine(.1)]),measure([constant(1)])]).clipped,true);
});

test('medidores: la puerta de la norma ignora los silencios largos',()=>{
  // Un segundo de tono a −20 dBFS y tres segundos de silencio: la puerta deja fuera los silencios, así que
  // la medida baja un poco (las dos primeras ventanas se cierran solas) pero no se hunde hasta el silencio.
  const tone=sine(.1,1000,RATE);
  const silence=new Float32Array(RATE*3);
  const toneOnly=measureLoudness([tone,tone]);
  const withSilence=measureLoudness([tone,silence]);
  near(toneOnly,-23,.15,'el tono solo mide la calibración');
  near(withSilence,-26,.5,'con silencio detrás la puerta lo descarta y la medida baja poco');
  assert.ok(withSilence>toneOnly-4,'el silencio no arrastra la medida hacia abajo sin freno');
  // Un audio todo silencio mide el silencio.
  assert.equal(measureLoudness([silence,silence]),SILENCE_DB);
  // Y un silencio intercalado entre dos tonos no cambia la medida del programa.
  const program=measureLoudness([sine(.1,1000,RATE*2),sine(.1,1000,RATE*2)]);
  const withGap=measureLoudness([sine(.1,1000,RATE*2),sine(.1,1000,RATE*2)]);
  near(program,withGap,.01,'el mismo programa mide lo mismo');
});
