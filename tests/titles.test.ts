// Pruebas de títulos y texto: composición tipográfica pura, con una regla de medir de mentira.
//
// Lo que se comprueba: que los parámetros del plugin «Títulos & Texto de VEGAS» se traducen a un plan de
// dibujo, que sin punto de anclaje se reproduce exactamente la colocación anterior (márgenes del 8 % y
// interlineado 1,2) y que las animaciones progresan como deben.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ANCHORS,ANIMATIONS,DEFAULT_ANCHOR,DEFAULT_HIGHLIGHT,animationState,buildFont,highlightedWords,layoutWords,planText,revealText,styleOf,wrapLines} from '../lib/editor/titles';
import {newEvent,ticks} from '../lib/editor/project';

// Regla de medir de mentira: cada carácter mide la mitad del tamaño de letra que lleve la fuente.
const measure=(text:string,font:string)=>{
 const size=Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1]??10);
 return text.length*size*.5;
};
const frame={width:320,height:180};
const project={width:1920,height:1080};
const close=(actual:number,expected:number,tolerance=1e-6)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} no está cerca de ${expected}`);
const plan=(extra:Partial<Parameters<typeof planText>[0]>={})=>planText({text:'CORTE',font:'Arial',fontSize:40,align:'center',x:0,y:0,project,frame,measure,...extra});

test('fuente: se compone con negrita y cursiva, y el tamaño se escala del proyecto al render',()=>{
 assert.equal(buildFont('Arial',20),'20px Arial');
 assert.equal(buildFont('Arial',20,true),'700 20px Arial');
 assert.equal(buildFont('Arial',20,true,true),'italic 700 20px Arial');
 assert.equal(buildFont('',20),'20px Arial');
 assert.equal(buildFont('Arial',0),'1px Arial');
 const scaled=plan();
 close(scaled.size,40*180/1080);         // 6,666… px, como el pintado anterior
 assert.match(scaled.font,/^6\.66\d+px Arial$/);
});

test('colocación anterior: sin punto de anclaje se mantienen los márgenes del 8 % y el interlineado 1,2',()=>{
 const one=plan();
 close(one.lineHeight,one.size*1.2);
 close(one.x,160);
 close(one.top,90-one.lineHeight/2);      // una sola línea: se dibuja en el centro del fotograma
 close(one.top+one.lineHeight*.5,90);
 const three=plan({text:'A\nB\nC'});
 assert.equal(three.lines.length,3);
 close(three.blockHeight,three.lineHeight*3);
 close(three.top,90-three.lineHeight*1.5);
 const ys=three.lines.map((_,index)=>three.top+three.lineHeight*(index+.5));
 close(ys[0],90-three.lineHeight);close(ys[1],90);close(ys[2],90+three.lineHeight);
 assert.equal(plan({align:'left'}).x,320*.08);
 assert.equal(plan({align:'right'}).x,320*.92);
});

test('punto de anclaje: los nueve puntos del plugin de VEGAS colocan el bloque alrededor de su posición',()=>{
 assert.equal(ANCHORS.length,9);
 const middle=plan({anchor:'middle-center'});
 close(middle.x,160);close(middle.top,90-middle.blockHeight/2);
 assert.equal(middle.align,'center');
 const topLeft=plan({anchor:'top-left'});
 close(topLeft.x,160);close(topLeft.top,90);assert.equal(topLeft.align,'left');
 const bottomRight=plan({anchor:'bottom-right'});
 close(bottomRight.x,160);close(bottomRight.top,90-bottomRight.blockHeight);assert.equal(bottomRight.align,'right');
 const topCenter=plan({anchor:'top-center'});
 close(topCenter.x,160);close(topCenter.top,90);assert.equal(topCenter.align,'center');
 // El desplazamiento del evento mueve el punto de anclaje, no el bloque por separado.
 const moved=plan({anchor:'middle-center',x:.25,y:-.5});
 close(moved.x,160+320*.25);close(moved.top,90+180*(-.5)-moved.blockHeight/2);
});

test('ajuste de línea: se parte por palabras y se respetan los saltos y las líneas vacías',()=>{
 const long='uno dos tres cuatro';
 assert.deepEqual(wrapLines(long,1000,line=>measure(line,'20px Arial')),['uno dos tres cuatro']);
 assert.deepEqual(wrapLines(long,115,line=>measure(line,'20px Arial')),['uno dos','tres cuatro']);
 assert.deepEqual(wrapLines('a\n\nb',96,line=>measure(line,'20px Arial')),['a','','b']);
 const wrapped=plan({text:long,fontSize:100,wrap:.3});
 assert.equal(wrapped.lines.length,2);
 assert.ok(wrapped.blockWidth<=320*.3);
 assert.equal(plan({text:long,fontSize:100}).lines.length,1);   // sin ajuste, una sola línea
});

test('animaciones: fundido, desplazamientos y máquina de escribir progresan dentro del evento',()=>{
 const still=animationState('none',500,1000,frame);
 assert.deepEqual(still,{opacity:1,dx:0,dy:0,chars:-1,scale:1,rotation:0,highlight:-1});
 assert.equal(animationState('fade',0,1000,frame).opacity,0);
 assert.equal(animationState('fade',250,1000,frame).opacity,1);
 close(animationState('scroll-up',0,1000,frame).dy,180);
 close(animationState('scroll-up',1000,1000,frame).dy,0);
 close(animationState('scroll-left',500,1000,frame).dx,160);
 close(animationState('typewriter',500,1000,frame).chars,.5);
 assert.equal(animationState('none',0,0,frame).opacity,1);      // duración cero no divide por cero
 assert.equal(ANIMATIONS.length,12);
 assert.equal(revealText('abc\ndef',-1),'abc\ndef');
 assert.equal(revealText('abc\ndef',.5),'abc\n');
 assert.equal(revealText('abc\ndef',0),'');
 assert.equal(revealText('abc\ndef',1),'abc\ndef');
});

test('estilo: los valores por defecto son los del pintado anterior y se pueden sobrescribir',()=>{
 const plain=styleOf(newEvent('t','text'));
 assert.equal(plain.lineSpacing,1.2);
 assert.equal(plain.wrap,1);
 assert.equal(plain.tracking,0);
 assert.equal(plain.anchor,DEFAULT_ANCHOR);
 assert.equal(plain.animation,'none');
 assert.equal(plain.bold,false);
 assert.equal(plain.shadow.enabled,false);
 assert.equal(plain.background.opacity,0);
 const custom=styleOf({bold:true,italic:true,lineSpacing:2,tracking:8,wrap:.6,outlineWidth:4,outlineColor:'#ff0000',anchor:'bottom-center',animation:'typewriter',shadow:{enabled:true,color:'#00ff00',offsetX:10,offsetY:-6,blur:3},background:{color:'#0000ff',opacity:.5,padding:30}});
 assert.equal(custom.bold,true);
 assert.equal(custom.anchor,'bottom-center');
 assert.deepEqual(custom.shadow,{enabled:true,color:'#00ff00',offsetX:10,offsetY:-6,blur:3});
 assert.deepEqual(custom.background,{color:'#0000ff',opacity:.5,padding:30});
 assert.equal(styleOf({shadow:{enabled:true,color:'#000000',offsetX:1,offsetY:1,blur:1}}).shadow.offsetX,1);
 // El color de resalte del karaoke tiene su propio valor por defecto.
 assert.equal(plain.highlightColor,DEFAULT_HIGHLIGHT);
 assert.equal(styleOf({highlightColor:'#00ff00'}).highlightColor,'#00ff00');
});

test('animaciones de plantilla: aparecen con rebote, entran con zoom o deslizándose y laten después',()=>{
 // El evento dura 4 s: la entrada se reparte en los primeros 0,6 s.
 const duration=ticks(4), frame={width:320,height:180};
 // Pop: empieza pequeño, se pasa de largo y vuelve a 1.
 assert.ok(animationState('pop',0,duration,frame).scale<.5);
 const overshoot=Math.max(...Array.from({length:40},(_,index)=>animationState('pop',ticks(index/10),duration,frame).scale));
 assert.ok(overshoot>1.02,`el rebote debería pasarse de 1 (máximo ${overshoot})`);
 close(animationState('pop',ticks(1),duration,frame).scale,1,1e-6);
 // Zoom de entrada: de pequeño a 1.
 assert.ok(animationState('zoom-in',0,duration,frame).scale<.3);
 close(animationState('zoom-in',ticks(2),duration,frame).scale,1,1e-6);
 // Deslizamientos: entra desde abajo o desde arriba y acaba en su sitio.
 assert.ok(animationState('slide-up',0,duration,frame).dy>10);
 assert.ok(animationState('slide-down',0,duration,frame).dy<-10);
 close(animationState('slide-up',ticks(2),duration,frame).dy,0);
 close(animationState('slide-down',ticks(2),duration,frame).dy,0);
 // Rebote y sacudida no paran: siguen moviéndose al final del evento.
 const bounce=Array.from({length:20},(_,index)=>animationState('bounce',ticks(3+index/20),duration,frame).dy);
 assert.ok(Math.max(...bounce)-Math.min(...bounce)>.5,'el rebote debería seguir moviéndose');
 const shake=Array.from({length:20},(_,index)=>animationState('shake',ticks(3+index/20),duration,frame).dx);
 assert.ok(Math.max(...shake)-Math.min(...shake)>.5,'la sacudida debería seguir moviéndose');
 assert.ok(Math.max(...Array.from({length:20},(_,index)=>Math.abs(animationState('shake',ticks(index/10),duration,frame).rotation)))<=1.5);
 // Karaoke: el resaltado avanza con el tiempo y no toca la opacidad.
 assert.equal(animationState('karaoke',0,duration,frame).highlight,0);
 close(animationState('karaoke',ticks(2),duration,frame).highlight,.5);
 assert.equal(animationState('karaoke',ticks(2),duration,frame).opacity,1);
});

test('karaoke: las palabras se resaltan una a una y se reparten por la línea',()=>{
 assert.equal(highlightedWords('uno dos tres cuatro',-1),-1);      // sin karaoke
 assert.equal(highlightedWords('uno dos tres cuatro',0),0);
 assert.equal(highlightedWords('uno dos tres cuatro',.5),2);
 assert.equal(highlightedWords('uno dos tres cuatro',1),4);
 assert.equal(highlightedWords('uno dos tres cuatro',2),4);        // nunca pasa del total
 assert.equal(highlightedWords('',.5),0);
 // El reparto de palabras respeta la alineación: la primera empieza donde toca.
 const ruler=(text:string)=>text.length*10;
 const left=layoutWords(['uno dos'],ruler,'left',100,10);
 assert.deepEqual(left.map(word=>word.text),['uno','dos']);
 assert.equal(left[0].left,100);
 assert.equal(left[1].left,100+30+10);
 const centre=layoutWords(['uno dos'],ruler,'center',100,10);
 assert.equal(centre[0].left,100-(30+10+30)/2);
 const right=layoutWords(['uno dos'],ruler,'right',100,10);
 assert.equal(right[1].left,100-30);
 // Las líneas vacías no aportan palabras, y las de varias líneas se acumulan en orden.
 assert.deepEqual(layoutWords(['uno','','dos'],ruler,'left',0,10).map(word=>word.text),['uno','dos']);
});
