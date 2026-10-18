// Pruebas de la región de bucle. En VEGAS el bucle y el tramo de renderizado son dos cosas distintas: el
// tramo decide qué se graba y el bucle qué se repite al reproducir. Aquí se comprueba el modelo (normalizar,
// medir y mover rangos), que las dos regiones no se pisen entre sí, que las ediciones con rizo las arrastran y
// que el archivo guardado las conserva.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  History,clone,frameTicks,inRange,newEvent,newProject,normalizeRange,parseProject,playbackSpan,rangeDuration,
  removeEvents,rippleMove,rippleTrimToCursor,shiftRange,ticks,trim,
} from '../lib/editor/project';

const FPS30={num:30,den:1};
// Proyecto mínimo con un clip de 10 s en la pista de video y otro de 4 s más adelante, para poder rizar.
function scene(){
  const p=newProject();
  const e=newEvent(p.tracks[1].id,'color',0,ticks(10));
  p.events.push(e);
  return {p,e};
}

test('bucle: un rango se normaliza en cualquier orden, cuantizado y con un fotograma de mínimo',()=>{
  // Al revés se ordena solo.
  assert.deepEqual(normalizeRange(ticks(4),ticks(2),FPS30),{start:ticks(2),end:ticks(4)});
  // Nunca empieza antes de cero ni dura menos de un fotograma.
  assert.deepEqual(normalizeRange(ticks(-5),ticks(-2),FPS30),{start:0,end:frameTicks(FPS30)});
  assert.deepEqual(normalizeRange(ticks(3),ticks(3),FPS30),{start:ticks(3),end:ticks(3)+frameTicks(FPS30)});
  // Los extremos caen en fotogramas exactos.
  const odd=normalizeRange(ticks(1.017),ticks(2.999),FPS30);
  assert.equal(odd.start%frameTicks(FPS30),0);
  assert.equal(odd.end%frameTicks(FPS30),0);
  assert.ok(odd.start<=odd.end);
});

test('bucle: el rango es semiabierto y su duración es la resta de los extremos',()=>{
  const range={start:ticks(1),end:ticks(3)};
  assert.equal(inRange(range,ticks(1)),true);
  assert.equal(inRange(range,ticks(2.999)),true);
  // El extremo final queda fuera, como en el resto del modelo de tiempos.
  assert.equal(inRange(range,ticks(3)),false);
  assert.equal(inRange(range,ticks(.5)),false);
  assert.equal(inRange(null,ticks(2)),false);
  assert.equal(inRange(undefined,ticks(2)),false);
  assert.equal(rangeDuration(range),ticks(2));
  assert.equal(rangeDuration(null),0);
  assert.equal(rangeDuration(undefined),0);
});

test('bucle: mover un rango con el proyecto respeta el punto de corte y no baja de cero',()=>{
  const range={start:ticks(5),end:ticks(7)};
  // Un rango que empieza antes del corte no se toca: su contenido no se ha movido.
  assert.deepEqual(shiftRange(range,ticks(6),ticks(2)),range);
  // Si empieza justo en el corte o después, se desplaza entero.
  assert.deepEqual(shiftRange(range,ticks(5),ticks(2)),{start:ticks(7),end:ticks(9)});
  assert.deepEqual(shiftRange(range,ticks(5),-ticks(10)),{start:0,end:0});
  // Sin rango no hay nada que mover.
  assert.equal(shiftRange(null,ticks(5),ticks(2)),null);
  assert.equal(shiftRange(undefined,ticks(5),ticks(2)),undefined);
});

test('bucle: la región de bucle y el tramo de renderizado son independientes',()=>{
  const {p}=scene();
  // Un proyecto nuevo no trae bucle y su tramo está vacío.
  assert.equal(p.loopRegion??null,null);
  assert.equal(p.region,null);
  // Marcar el bucle no toca el tramo, ni al revés.
  p.loopRegion={start:ticks(1),end:ticks(3)};
  assert.equal(p.region,null);
  p.region={start:ticks(6),end:ticks(8)};
  assert.deepEqual(p.loopRegion,{start:ticks(1),end:ticks(3)});
});

test('bucle: al reproducir manda el bucle, después el tramo y, sin nada, el proyecto entero',()=>{
  const {p}=scene();
  // Con el bucle apagado no hay zona que repetir, aunque haya regiones marcadas.
  p.loopRegion={start:ticks(1),end:ticks(3)};
  p.region={start:ticks(6),end:ticks(8)};
  assert.equal(playbackSpan(p,false),null);
  // Encendido, manda la región de bucle.
  assert.deepEqual(playbackSpan(p,true),{start:ticks(1),end:ticks(3)});
  // Sin bucle se hereda el tramo de renderizado.
  p.loopRegion=null;
  assert.deepEqual(playbackSpan(p,true),{start:ticks(6),end:ticks(8)});
  // Sin ninguna de las dos, null significa «hasta el final del proyecto».
  p.region=null;
  assert.equal(playbackSpan(p,true),null);
  // Una región vacía o invertida tampoco sirve de zona de repetición.
  p.loopRegion={start:ticks(4),end:ticks(4)};
  assert.equal(playbackSpan(p,true),null);
});

test('bucle: guardar y reabrir conserva la región de bucle y su independencia del tramo',()=>{
  const {p,e}=scene();
  e.brightness=1.2;
  p.region={start:ticks(6),end:ticks(8)};
  p.loopRegion={start:ticks(1),end:ticks(3)};
  const reopened=parseProject(JSON.stringify(p));
  assert.deepEqual(reopened,p);
  assert.deepEqual(reopened.loopRegion,{start:ticks(1),end:ticks(3)});
  assert.deepEqual(reopened.region,{start:ticks(6),end:ticks(8)});
  // El bucle puede guardarse como null (existe la propiedad pero está vacía).
  p.loopRegion=null;
  assert.equal(parseProject(JSON.stringify(p)).loopRegion,null);
  // Y un bucle invertido se rechaza antes de tocar el editor.
  assert.throws(()=>parseProject(JSON.stringify({...p,loopRegion:{start:ticks(5),end:ticks(2)}})));
  assert.throws(()=>parseProject(JSON.stringify({...p,loopRegion:{start:-1,end:ticks(2)}})));
});

test('bucle: el rizo total arrastra la región de bucle y el de una pista no la toca',()=>{
  const {p,e}=scene();
  // Un segundo clip mucho más tarde, en la misma pista, para que el rizo tenga a quién empujar.
  p.events.push(newEvent(e.trackId,'color',ticks(20),ticks(2)));
  p.loopRegion={start:ticks(20),end:ticks(22)};
  p.region={start:ticks(20),end:ticks(22)};
  const onlyTrack=clone(p);
  trim(onlyTrack,e.id,'right',ticks(2),'track');
  // Con rizo de pista solo se mueven los eventos de esa pista.
  assert.deepEqual(onlyTrack.loopRegion,{start:ticks(20),end:ticks(22)});
  trim(p,e.id,'right',ticks(2),'all');
  // Con rizo total el material se retrasa 2 s y las dos regiones van con él.
  assert.deepEqual(p.events[1].start,ticks(22));
  assert.deepEqual(p.loopRegion,{start:ticks(22),end:ticks(24)});
  assert.deepEqual(p.region,{start:ticks(22),end:ticks(24)});
});

test('bucle: el borrado con rizo total acerca la región de bucle y el de pista la deja quieta',()=>{
  const {p,e}=scene();
  e.duration=ticks(3);
  p.events.push(newEvent(e.trackId,'color',ticks(8),ticks(2)));
  p.loopRegion={start:ticks(8),end:ticks(10)};
  const onlyTrack=clone(p);
  removeEvents(onlyTrack,[e.id],'track');
  assert.deepEqual(onlyTrack.loopRegion,{start:ticks(8),end:ticks(10)});
  removeEvents(p,[e.id],'all');
  // Los 3 s borrados desaparecen de la línea de tiempo: el bucle se acerca al principio.
  assert.equal(p.events[0].start,ticks(5));
  assert.deepEqual(p.loopRegion,{start:ticks(5),end:ticks(7)});
});

test('bucle: el rizo al mover un bloque desplaza la región de bucle que queda por delante',()=>{
  const {p,e}=scene();
  const later=newEvent(e.trackId,'color',ticks(12),ticks(2));
  p.events.push(later);
  p.loopRegion={start:ticks(12),end:ticks(14)};
  rippleMove(p,[e.id],ticks(2),'all',ticks(10));
  assert.equal(later.start,ticks(14));
  assert.deepEqual(p.loopRegion,{start:ticks(14),end:ticks(16)});
  // El rizo de pista no toca la región, igual que no toca los marcadores.
  const again=clone(p);
  again.loopRegion={start:ticks(20),end:ticks(22)};
  rippleMove(again,[e.id],ticks(1),'track',ticks(10));
  assert.deepEqual(again.loopRegion,{start:ticks(20),end:ticks(22)});
});

test('bucle: recortar hasta el cursor con rizo total también acerca el bucle',()=>{
  const {p,e}=scene();
  e.duration=ticks(10);
  p.events.push(newEvent(e.trackId,'color',ticks(14),ticks(2)));
  p.loopRegion={start:ticks(14),end:ticks(16)};
  assert.equal(rippleTrimToCursor(p,[e.id],'right',ticks(6),'all'),true);
  // El clip queda de 6 s y lo que venía después se adelanta 4 s.
  assert.equal(e.duration,ticks(6));
  assert.equal(p.events[1].start,ticks(10));
  assert.deepEqual(p.loopRegion,{start:ticks(10),end:ticks(12)});
});

test('bucle: deshacer devuelve la región de bucle anterior',()=>{
  const {p}=scene();
  const history=new History();
  history.push(p);
  p.loopRegion={start:ticks(1),end:ticks(3)};
  const edited=clone(p);
  const undone=history.undo(p);
  assert.equal(undone.loopRegion??null,null);
  const redone=history.redo(undone);
  assert.deepEqual(redone,edited);
  assert.deepEqual(redone.loopRegion,{start:ticks(1),end:ticks(3)});
});
