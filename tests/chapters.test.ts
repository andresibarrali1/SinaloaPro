// Pruebas de la exportación de marcadores: capítulos (como «Export Chapters.cs» de VEGAS) y subtítulos.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MARKER_FORMATS,LAST_CUE_SECONDS,buildMarkerExport,markerFormatById,markersToCues,sortedMarkers} from '../lib/editor/chapters';
import {ticks} from '../lib/editor/project';

const fps={num:30,den:1};
const markers=[
 {id:'m2',time:ticks(65),name:'Segunda parte'},
 {id:'m1',time:ticks(5),name:'Introducción'},
 {id:'m3',time:ticks(10),name:''},
];
const clean=(text:string)=>text.replace(/\r/g,'');

test('los marcadores se ordenan y no se repite el mismo instante',()=>{
 const sorted=sortedMarkers(markers);
 assert.deepEqual(sorted.map(marker=>marker.id),['m1','m3','m2']);
 const repeated=sortedMarkers([{id:'a',time:ticks(1),name:'A'},{id:'b',time:ticks(1),name:'B'}]);
 assert.equal(repeated.length,1,'el mismo instante dos veces solo cuenta una');
 assert.deepEqual(sortedMarkers([]),[]);
});

test('la lista de capítulos lleva timecode y nombre, como el script de VEGAS pero sin perder el nombre',()=>{
 const text=clean(buildMarkerExport(markers,'txt',fps));
 const lines=text.trim().split('\n');
 assert.equal(lines[0],'# Capítulos de Corte 15 · 3 marcador(es)');
 assert.equal(lines[1],'00:00:05:00\tIntroducción');
 // El marcador sin nombre se numera como en la línea de tiempo.
 assert.equal(lines[2],'00:00:10:00\tMarcador 2');
 assert.equal(lines[3],'00:01:05:00\tSegunda parte');
 // El timecode respeta el formato del proyecto: con descarte, a 29,97 cambia el separador.
 const drop=clean(buildMarkerExport([{id:'x',time:ticks(60),name:'Minuto'}],'txt',{num:30000,den:1001},'drop-frame'));
 assert.match(drop,/00:01:00;\d\d\tMinuto/,'con descarte el separador de fotogramas es «;»');
});

test('la lista de YouTube empieza siempre en 00:00 y usa minutos:segundos',()=>{
 const early=[{id:'a',time:ticks(3),name:'Arranque'},{id:'b',time:ticks(75),name:'Minuto y cuarto'},{id:'c',time:ticks(3661),name:'Una hora'}];
 const text=clean(buildMarkerExport(early,'youtube',fps));
 // El primer marcador está en 3 s, así que se añade la marca de 00:00 que exige YouTube.
 assert.deepEqual(text.trim().split('\n'),['0:00 Inicio','0:03 Arranque','1:15 Minuto y cuarto','1:01:01 Una hora']);
 // Si el primer marcador no está en cero, YouTube necesita la marca de 00:00: se añade.
 const late=[{id:'a',time:ticks(30),name:'Tarde'}];
 assert.equal(clean(buildMarkerExport(late,'youtube',fps)),'0:00 Inicio\n0:30 Tarde\n');
 // Sin marcadores queda una lista válida y vacía.
 assert.equal(clean(buildMarkerExport([],'youtube',fps)),'0:00 Inicio\n');
});

test('el CSV lleva cabecera y el XML la estructura del script, con nombre',()=>{
 const csv=clean(buildMarkerExport(markers,'csv',fps));
 const rows=csv.trim().split('\n');
 assert.equal(rows[0],'timecode,segundos,nombre');
 assert.equal(rows[1],'00:00:05:00,5.000,Introducción');
 assert.equal(rows.length,4);
 // Un nombre con coma o comillas se escapa.
 const tricky=clean(buildMarkerExport([{id:'a',time:ticks(1),name:'Hola, "mundo"'}],'csv',fps));
 assert.match(tricky,/"Hola, ""mundo"""/);
 const xml=clean(buildMarkerExport(markers,'xml',fps));
 assert.match(xml,/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
 assert.match(xml,/<chapter ID="0" Time-code="00:00:05:00" Label="Introducción" \/>/);
 assert.match(xml,/<chapter ID="2" Time-code="00:01:05:00" Label="Segunda parte" \/>/);
 assert.ok(xml.endsWith('</Chapters>\n'));
 const escaped=clean(buildMarkerExport([{id:'a',time:ticks(1),name:'A & B <c>'}],'xml',fps));
 assert.match(escaped,/Label="A &amp; B &lt;c&gt;"/);
});

test('los marcadores como subtítulos: cada uno dura hasta el siguiente',()=>{
 const cues=markersToCues(markers,ticks(70));
 assert.deepEqual(cues.map(cue=>[cue.start,cue.end]),[[5,10],[10,65],[65,70]]);
 // Sin duración conocida, el último dura cinco segundos.
 const alone=markersToCues([{id:'a',time:ticks(2),name:'Solo'}]);
 assert.equal(alone[0].start,2);
 assert.equal(alone[0].end,2+LAST_CUE_SECONDS);
 // Nunca un subtítulo de duración cero o negativa.
 const same=markersToCues([{id:'a',time:ticks(1),name:'A'},{id:'b',time:ticks(1),name:'B'}]);
 assert.ok(same.every(cue=>cue.end-cue.start>=.5));
 // El SRT sale con la numeración y el formato de siempre.
 const srt=clean(buildMarkerExport(markers,'srt',fps,undefined,ticks(70)));
 assert.match(srt,/^1\n00:00:05,000 --> 00:00:10,000\nIntroducción/);
 assert.match(srt,/3\n00:01:05,000 --> 00:01:10,000\nSegunda parte/);
});

test('el catálogo de formatos ofrece extensión y nota a cada uno',()=>{
 assert.equal(MARKER_FORMATS.length,5);
 for(const format of MARKER_FORMATS){
  assert.ok(format.label.length>5&&format.note.length>30,`${format.value} sin explicación`);
  assert.ok(['txt','csv','xml','srt'].includes(format.extension));
 }
 assert.equal(markerFormatById('srt').extension,'srt');
 assert.equal(markerFormatById('no-existe').value,'txt','un formato desconocido cae en la lista de capítulos');
});
