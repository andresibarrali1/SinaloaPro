// Pruebas del formato de timecode SMPTE: sin descarte, con descarte y segundos, más el analizador que se usa
// en el campo «Ir a timecode». Las comprobaciones son aritméticas y con los casos de la norma: los saltos de
// numeración al empezar cada minuto, la excepción de cada diez minutos y el cero exacto a la hora.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TICKS,ticks} from '../lib/editor/project';
import {
  TIMECODE_FORMATS,TIMECODE_LABEL,TimecodeFormat,driftSeconds,effectiveFormat,formatShortTimecode,formatTimecode,
  frameOfTime,isDropFrameRate,nominalRate,parseTimecode,timeOfFrame,
} from '../lib/editor/timecode';

const FPS2997={num:30000,den:1001};
const FPS5994={num:60000,den:1001};
const FPS30={num:30,den:1};
const FPS25={num:25,den:1};
const FPS24={num:24,den:1};
// Instante del fotograma número `frame` contado a la velocidad real.
const at=(frame:number,fps:{num:number;den:number})=>ticks(frame/(fps.num/fps.den));
const frameAt=(time:number,fps:{num:number;den:number})=>Math.round(time/TICKS*(fps.num/fps.den));

test('timecode: el formato es SMPTE, con dos puntos y no con punto decimal',()=>{
  assert.equal(formatTimecode(0,FPS30,'non-drop'),'00:00:00:00');
  assert.equal(formatTimecode(ticks(1),FPS30,'non-drop'),'00:00:01:00');
  assert.equal(formatTimecode(at(15,FPS30),FPS30,'non-drop'),'00:00:00:15');
  assert.equal(formatTimecode(ticks(3661.5),FPS30,'non-drop'),'01:01:01:15');
  assert.equal(formatTimecode(ticks(1),FPS25,'non-drop'),'00:00:01:00');
  assert.equal(formatTimecode(at(12,FPS24),FPS24,'non-drop'),'00:00:00:12');
  // El formato corto de la regla quita la hora.
  assert.equal(formatShortTimecode(ticks(65),FPS30,'non-drop'),'01:05:00');
  assert.equal(formatShortTimecode(ticks(0),FPS2997,'drop-frame'),'00:00;00');
  // Segundos con milisegundos.
  assert.equal(formatTimecode(ticks(3661.234),FPS30,'seconds'),'01:01:01.233');
  assert.equal(formatTimecode(ticks(0),FPS30,'seconds'),'00:00:00.000');
  // Los tres formatos están etiquetados.
  assert.equal(TIMECODE_FORMATS.length,3);
  for(const format of TIMECODE_FORMATS)assert.ok(TIMECODE_LABEL[format].length>0);
});

test('timecode: sin descarte la numeración es corrida a la frecuencia nominal',()=>{
  assert.equal(nominalRate(FPS2997),30);
  assert.equal(nominalRate(FPS5994),60);
  assert.equal(nominalRate(FPS25),25,'25 fps cuenta a 25: el fotograma 25 es un segundo');
  assert.equal(nominalRate(FPS24),24);
  assert.equal(nominalRate({num:24000,den:1001}),24000,'23,976 cuenta a 24000/1001, que es lo que permite la norma sin descarte');
  for(const [frame,expected] of [[0,'00:00:00:00'],[1,'00:00:00:01'],[29,'00:00:00:29'],[30,'00:00:01:00'],[1799,'00:00:59:29'],[1800,'00:01:00:00'],[107892,'00:59:56:12']] as [number,string][]){
    assert.equal(formatTimecode(at(frame,FPS2997),FPS2997,'non-drop'),expected,`fotograma ${frame}`);
  }
  // Sin descarte, una hora de timecode no es una hora real: el desfase es de unos 3,6 s.
  assert.ok(Math.abs(driftSeconds(ticks(3600),FPS2997,'non-drop'))>3.5);
  assert.equal(driftSeconds(ticks(3600),FPS30,'non-drop'),0,'a 30 fps exactos no hay desfase');
});

test('timecode: con descarte se saltan los números 00 y 01 al empezar cada minuto, menos cada diez',()=>{
  // El fotograma 1800 (un minuto real) es 00:01:00;02, no 00:01:00;00: los números 00 y 01 no existen.
  assert.equal(formatTimecode(at(1800,FPS2997),FPS2997,'drop-frame'),'00:01:00;02');
  assert.equal(formatTimecode(at(1798,FPS2997),FPS2997,'drop-frame'),'00:01:00;00');
  assert.equal(formatTimecode(at(1799,FPS2997),FPS2997,'drop-frame'),'00:01:00;01');
  // Al minuto 10 no se salta nada: vuelve a haber ;00.
  assert.equal(formatTimecode(at(17982,FPS2997),FPS2997,'drop-frame'),'00:10:00;00');
  assert.equal(formatTimecode(at(17981,FPS2997),FPS2997,'drop-frame'),'00:09:59;29');
  // Y el minuto 11 vuelve a saltar.
  assert.equal(formatTimecode(at(17982+1800,FPS2997),FPS2997,'drop-frame'),'00:11:00;02');
  // El descarte hace que una hora de timecode sea una hora real: aquí está el sentido del formato.
  assert.equal(formatTimecode(at(107892,FPS2997),FPS2997,'drop-frame'),'01:00:00;00');
  assert.equal(driftSeconds(ticks(3600),FPS2997,'drop-frame'),0);
  // Los segundos y los milisegundos del descarte no se tocan.
  assert.equal(formatTimecode(at(30,FPS2997),FPS2997,'drop-frame'),'00:00:01;00');
  assert.equal(formatTimecode(0,FPS2997,'drop-frame'),'00:00:00;00');
});

test('timecode: el descarte a 59,94 salta cuatro números por minuto',()=>{
  assert.equal(nominalRate(FPS5994),60);
  assert.equal(formatTimecode(at(3599,FPS5994),FPS5994,'drop-frame'),'00:01:00;03');
  assert.equal(formatTimecode(at(3600,FPS5994),FPS5994,'drop-frame'),'00:01:00;04');
  assert.equal(formatTimecode(at(35964,FPS5994),FPS5994,'drop-frame'),'00:10:00;00');
  assert.equal(formatTimecode(at(35963,FPS5994),FPS5994,'drop-frame'),'00:09:59;59');
});

test('timecode: el descarte solo vale para 29,97 y 59,94',()=>{
  assert.equal(isDropFrameRate(FPS2997),true);
  assert.equal(isDropFrameRate(FPS5994),true);
  assert.equal(isDropFrameRate(FPS30),false);
  assert.equal(isDropFrameRate(FPS25),false);
  assert.equal(isDropFrameRate({num:24000,den:1001}),false,'23,976 no admite descarte en SMPTE 12M');
  // Pedir descarte donde no vale cae a sin descarte, en vez de mostrar algo falso.
  assert.equal(effectiveFormat('drop-frame',FPS25),'non-drop');
  assert.equal(effectiveFormat('drop-frame',FPS2997),'drop-frame');
  assert.equal(formatTimecode(at(1500,FPS25),FPS25,'drop-frame'),'00:01:00:00','a 25 fps se cuenta a 25 aunque no haya descarte que hacer');
});

test('timecode: el analizador entiende lo que se escribe y rechaza lo que no',()=>{
  // Fotogramas, con dos puntos o con punto y coma.
  assert.equal(parseTimecode('00:00:01:15',FPS30),ticks(1.5));
  assert.equal(parseTimecode('00:01:00:00',FPS30),ticks(60));
  assert.equal(parseTimecode('1:02:03:04',FPS30),ticks(3723+4/30));
  // Sin horas también.
  assert.equal(parseTimecode('01:30:00',FPS30),ticks(90));
  // Segundos con milisegundos.
  assert.equal(parseTimecode('01:02:03.500',FPS30),ticks(3723.5));
  assert.equal(parseTimecode('12.5',FPS30),ticks(12.5));
  // Un número de fotograma imposible se rechaza (a 30 fps no existe el fotograma 30).
  assert.equal(parseTimecode('00:00:00:30',FPS30),null);
  assert.equal(parseTimecode('00:00:00:99',FPS30),null);
  assert.equal(parseTimecode('',FPS30),null);
  assert.equal(parseTimecode('mañana',FPS30),null);
  assert.equal(parseTimecode('-5',FPS30),null);
  // El descarte se deshace al analizar: `;` significa que el número salta.
  const dropped=parseTimecode('00:01:00;02',FPS2997);
  assert.equal(frameAt(dropped!,FPS2997),1800,'00:01:00;02 es el fotograma real 1800');
  const notDropped=parseTimecode('00:01:00:02',FPS2997);
  assert.equal(frameAt(notDropped!,FPS2997),1802,'sin descarte, 00:01:00:02 es el fotograma 1802');
});

test('timecode: ida y vuelta exacta en los tres formatos',()=>{
  for(const [fps,format] of [[FPS2997,'non-drop'],[FPS2997,'drop-frame'],[FPS5994,'drop-frame'],[FPS30,'non-drop'],[FPS25,'non-drop'],[FPS24,'non-drop']] as [{num:number;den:number},TimecodeFormat][]){
    for(const frame of [0,1,7,29,30,59,1798,1799,1800,17982,18000,107892]){
      const time=at(frame,fps);
      const text=formatTimecode(time,fps,format);
      const back=parseTimecode(text,fps);
      assert.notEqual(back,null,`${text} tiene que analizarse`);
      assert.equal(frameAt(back!,fps),frame,`${format} a ${fps.num}/${fps.den}: ${text} vuelve al fotograma ${frame}`);
    }
  }
  // La conversión entre fotograma e instante también es exacta.
  for(const frame of [0,1,29,30,1799,1800,107892])assert.equal(frameOfTime(timeOfFrame(frame,FPS2997),FPS2997),frame);
  assert.equal(timeOfFrame(0,FPS2997),0);
  assert.equal(frameOfTime(0,FPS2997),0);
});
