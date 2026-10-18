// Pruebas de las posiciones del texto: son datos y aritmética pura, así que se comprueban sin navegador.
//
// Lo que se comprueba: que cada posición se reconoce después de aplicarla (ida y vuelta por las trece), que
// cada nombre deja el texto donde dice —arriba arriba y abajo abajo, medido con el mismo `planText` que pinta—,
// que el anclaje elegido aguanta cuando el texto crece, y que la posición «Subtítulo» es exactamente la que usa
// el generador de subtítulos.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TEXT_POSITIONS,TEXT_POSITION_GROUPS,applyTextPosition,describeTextPosition,detectTextPosition,textPositionById} from '../lib/editor/text-positions';
import {planText} from '../lib/editor/titles';
import {newEvent} from '../lib/editor/project';
import {SUBTITLE_STYLE} from '../lib/editor/subtitles';

const measure=(text:string,font:string)=>{
 const size=Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1]??10);
 return text.length*size*.5;
};
const frame={width:320,height:180};
const project={width:320,height:180};
const title=()=>{
 const event=newEvent('track','text');
 event.text='CORTE';
 event.fontSize=20;
 return event;
};
// El bloque de texto tal como lo pinta el motor con la posición puesta.
const blockOf=(id:string,text='CORTE')=>{
 const event=applyTextPosition(title(),id);
 event.text=text;
 return planText({text:event.text,font:event.font,fontSize:event.fontSize,align:event.align,x:event.transform.x,y:event.transform.y,anchor:event.anchor,project,frame,measure});
};

test('posiciones: cada una se reconoce después de aplicarla',()=>{
 for(const position of TEXT_POSITIONS){
  const event=applyTextPosition(title(),position.id);
  assert.equal(event.anchor,position.anchor,`${position.name} no pone el anclaje`);
  assert.equal(detectTextPosition(event),position.id,`${position.name} no se reconoce al volver a leerla`);
 }
 // Un evento recién creado (centro, sin desplazamiento) es «Texto centrado», y la lista no repite identificadores.
 const fresh=title();
 assert.equal(detectTextPosition(fresh),'center');
 assert.equal(new Set(TEXT_POSITIONS.map(position=>position.id)).size,TEXT_POSITIONS.length);
 assert.equal(TEXT_POSITIONS.length,TEXT_POSITION_GROUPS.reduce((total,group)=>total+TEXT_POSITIONS.filter(position=>position.group===group).length,0));
 assert.ok(TEXT_POSITIONS.every(position=>TEXT_POSITION_GROUPS.includes(position.group)),'todas las posiciones tienen grupo');
 assert.equal(textPositionById('no-existe'),null);
 assert.deepEqual(applyTextPosition(title(),'no-existe').transform,title().transform,'una posición que no existe no toca nada');
});

test('posiciones: el texto queda donde dice el nombre',()=>{
 // Centrado: el bloque, con su centro en el centro del fotograma.
 const center=blockOf('center');
 assert.equal(Math.round(center.blockTop+center.blockHeight/2),90);
 assert.equal(Math.round(center.blockLeft+center.blockWidth/2),160);
 // Arriba (centrado): el bloque empieza al 8 % del alto, y el anclaje elegido hace que crezca hacia abajo.
 const top=blockOf('top-center');
 assert.equal(Math.round(top.blockTop),Math.round(180*.08));
 assert.equal(Math.round(top.blockLeft+top.blockWidth/2),160);
 const topTall=blockOf('top-center','CORTE\n15\nPRUEBA');
 assert.equal(Math.round(topTall.blockTop),Math.round(180*.08),'al crecer, el texto de arriba se queda arriba');
 assert.ok(topTall.blockTop+topTall.blockHeight<=180);
 // Abajo (centrado): termina al 92 % del alto y al crecer sube, sin salirse.
 const bottom=blockOf('bottom-center');
 assert.equal(Math.round(bottom.blockTop+bottom.blockHeight),Math.round(180*.92));
 const bottomTall=blockOf('bottom-center','CORTE\n15\nPRUEBA');
 assert.equal(Math.round(bottomTall.blockTop+bottomTall.blockHeight),Math.round(180*.92));
 assert.ok(bottomTall.blockTop>=0);
 // A los lados: el bloque toca el 5 % por la izquierda y el 95 % por la derecha.
 const left=blockOf('middle-left');
 assert.equal(Math.round(left.blockLeft),Math.round(320*.05));
 assert.equal(Math.round(left.blockTop+left.blockHeight/2),90);
 const right=blockOf('middle-right');
 assert.equal(Math.round(right.blockLeft+right.blockWidth),Math.round(320*.95));
 // El tercio inferior termina alrededor del 64 % del alto: es el rótulo de la zona baja.
 const lower=blockOf('lower-third');
 assert.equal(Math.round(lower.blockTop+lower.blockHeight),Math.round(180*(.5+.14)));
 // Y las cuatro esquinas caen en su esquina.
 const corner=blockOf('top-left');
 assert.equal(Math.round(corner.blockLeft),Math.round(320*.05));
 assert.equal(Math.round(corner.blockTop),Math.round(180*.08));
 const opposite=blockOf('bottom-right');
 assert.equal(Math.round(opposite.blockLeft+opposite.blockWidth),Math.round(320*.95));
 assert.equal(Math.round(opposite.blockTop+opposite.blockHeight),Math.round(180*.92));
});

test('posiciones: los desplazamientos están dentro del fotograma y el anclaje concuerda con el nombre',()=>{
 for(const position of TEXT_POSITIONS){
  assert.ok(Math.abs(position.x)<=.5,`${position.name} se sale por los lados`);
  assert.ok(Math.abs(position.y)<=.5,`${position.name} se sale por arriba o por abajo`);
  assert.ok(/^(top|middle|bottom)-(left|center|right)$/.test(position.anchor),`${position.name} tiene un anclaje que no existe`);
  if(/^Arriba/.test(position.name))assert.ok(position.anchor.startsWith('top-'),`${position.name} debería anclarse arriba`);
  if(/^Abajo|^Tercio/.test(position.name))assert.ok(position.anchor.startsWith('bottom-'),`${position.name} debería anclarse abajo`);
  if(position.name==='Texto centrado')assert.equal(position.anchor,'middle-center');
  if(/izquierda/i.test(position.name))assert.ok(position.anchor.endsWith('-left'),`${position.name} debería anclarse a la izquierda`);
  if(/derecha/i.test(position.name))assert.ok(position.anchor.endsWith('-right'),`${position.name} debería anclarse a la derecha`);
  assert.ok(position.note.length>20,`${position.name} no explica nada en su pista`);
 }
});

test('posiciones: «Subtítulo» es la posición que usa el generador de subtítulos, y la ayuda describe lo que hay',()=>{
 const subtitle=applyTextPosition(title(),'subtitle');
 assert.equal(subtitle.transform.y,SUBTITLE_STYLE.offsetY);
 assert.equal(subtitle.anchor,'middle-center');
 assert.match(describeTextPosition(subtitle),/^Subtítulo \(centro abajo\): /);
 assert.match(describeTextPosition(title()),/^Texto centrado: /);
 // Una colocación que no es de la lista (por ejemplo, movida desde Panoramización y recorte) se describe con
 // sus números, y no se confunde con una posición con nombre.
 const moved=title();
 moved.transform={...moved.transform,x:.12,y:-.07};
 assert.equal(detectTextPosition(moved),'custom');
 assert.match(describeTextPosition(moved),/Posición propia: 12 % a la derecha y -7 % hacia abajo del centro/);
 assert.match(describeTextPosition(moved),/anclaje en «centro»/);
});
