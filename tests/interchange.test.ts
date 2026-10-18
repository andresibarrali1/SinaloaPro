// Pruebas del intercambio de proyectos. Los analizadores se comprueban contra las estructuras documentadas
// de xmeml v5 (Final Cut Pro 7 / DaVinci Resolve) y CMX 3600 (EDL), que son los formatos que VEGAS exporta.
// No se pudo contrastar con un archivo exportado por una instalación real de VEGAS Pro 15 en esta sesión.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {detectInterchange,parseEdl,parseFcpXml,parseInterchange,parseXml,VEG_EXPLANATION,framesToTicks,timecodeToFrames,frameRateFromTimebase} from '../lib/editor/interchange';
import {seconds,ticks,linkedIds} from '../lib/editor/project';
const edl=fs.readFileSync('tests/fixtures/vegas-montaje.edl','utf8');
const xml=fs.readFileSync('tests/fixtures/vegas-montaje.xml','utf8');
const at=(frames:number,fps=30)=>framesToTicks(frames,{num:fps,den:1});
test('detección de formato por contenido y por extensión',()=>{
 assert.equal(detectInterchange('proyecto.veg','riff.\u0000\u0001binary'),'veg');
 assert.equal(detectInterchange('proyecto.veg','cualquier cosa'),'veg');
 assert.equal(detectInterchange('montaje.xml',xml),'fcpxml');
 assert.equal(detectInterchange('sin-extension','<xmeml version="5"></xmeml>'),'fcpxml');
 assert.equal(detectInterchange('montaje.edl',edl),'edl');
 assert.equal(detectInterchange('proyecto.corte15','{"format":"corte15"}'),'corte15');
 assert.equal(detectInterchange('otra-cosa.bin','datos sueltos'),'unknown');
});
test('un .veg se rechaza con una explicación y una alternativa, sin simular que se lee',()=>{
 const error=(()=>{try{parseInterchange('proyecto.veg','riff.\u0000binary');return null;}catch(e){return e as Error;}})();
 assert.ok(error, 'debe lanzar');
 assert.equal(error!.message,VEG_EXPLANATION);
 assert.match(error!.message,/Exportar/);
 assert.match(error!.message,/EDL/);
});
test('EDL CMX 3600: pistas, eventos, origen, agrupación y duración estimada',()=>{
 const {project,report}=parseEdl(edl,'vegas-montaje.edl');
 assert.equal(report.format,'EDL (CMX 3600)');
 assert.equal(project.fps.num,30);
 assert.equal(project.fps.den,1);
 assert.equal(project.name,'MONTAJE VEGAS');
 assert.equal(project.tracks.filter(t=>t.kind==='video').length,1);
 assert.equal(project.tracks.filter(t=>t.kind==='audio').length,1);
 const video=project.events.filter(e=>e.kind==='video');
 const audio=project.events.filter(e=>e.kind==='audio');
 assert.equal(video.length,2);
 assert.equal(audio.length,2);
 const first=video.find(e=>e.name==='Video_A.mp4')!;
 assert.equal(first.start,0);
 assert.equal(first.duration,at(90));
 assert.equal(first.offset,0);
 const second=video.find(e=>e.name==='Video_B.mp4')!;
 assert.equal(second.start,at(150));
 assert.equal(second.duration,at(90));
 assert.equal(second.offset,at(30));
 // El par de video y audio con el mismo clip y el mismo tramo queda agrupado.
 const firstAudio=audio.find(e=>e.name==='Video_A.mp4')!;
 assert.ok(first.group,'el video debe pertenecer a un grupo');
 assert.equal(linkedIds(project,[first.id]).length,2);
 assert.equal(linkedIds(project,[firstAudio.id]).length,2);
 assert.equal(project.media.length,3);
 const mediaA=project.media.find(m=>m.name==='Video_A.mp4')!;
 assert.equal(mediaA.kind,'video');
 assert.equal(mediaA.sourcePath,'Video_A.mp4');
 assert.equal(mediaA.duration,at(90));
 assert.ok(report.warnings.some(w=>/velocidad de fotogramas/i.test(w)),'debe avisar de los fps asumidos');
});
test('EDL: drop frame se interpreta como 29.97 y se avisa de la limitación',()=>{
 const drop='TITLE: DROP\nFCM: DROP FRAME\n\n001  AX  V  C  00:00:00;00 00:00:10;00 00:00:00;00 00:00:10;00\n';
 const {project,report}=parseEdl(drop,'drop.edl');
 assert.deepEqual(project.fps,{num:30000,den:1001});
 assert.equal(project.events[0].duration,framesToTicks(300,{num:30000,den:1001}));
 assert.ok(report.warnings.some(w=>/drop frame/i.test(w)));
});
test('EDL sin eventos reconocibles falla con un mensaje claro',()=>{
 assert.throws(()=>parseEdl('TITLE: vacío\n\n',"vacio.edl"),/CMX 3600/);
});
test('XML de Final Cut Pro 7: secuencia, pistas, medios, generadores y vínculo A/V',()=>{
 const {project,report}=parseFcpXml(xml,'vegas-montaje.xml');
 assert.equal(project.name,'Montaje de prueba');
 assert.equal(project.width,1920);
 assert.equal(project.height,1080);
 assert.deepEqual(project.fps,{num:30,den:1});
 assert.equal(project.tracks.length,2);
 const video=project.events.filter(e=>e.kind==='video'&&e.mediaId);
 const audio=project.events.filter(e=>e.kind==='audio');
 const generators=project.events.filter(e=>e.kind==='color');
 assert.equal(video.length,2);
 assert.equal(audio.length,2);
 assert.equal(generators.length,1, 'el generador se importa como color');
 assert.equal(project.media.length,3);
 const clipA=video.find(e=>e.name==='Video_A.mp4')!;
 assert.equal(clipA.start,0);
 assert.equal(clipA.duration,at(90));
 assert.equal(clipA.offset,0);
 const clipB=video.find(e=>e.name==='Video_B.mp4')!;
 assert.equal(clipB.start,at(150));
 assert.equal(clipB.duration,at(90));
 assert.equal(clipB.offset,at(30));
 // El audio del mismo archivo y el mismo tramo queda vinculado al video.
 const audioA=audio.find(e=>e.name==='Video_A.mp4')!;
 assert.ok(clipA.group);
 assert.equal(clipA.group,audioA.group);
 assert.equal(linkedIds(project,[clipA.id]).length,2);
 const mediaB=project.media.find(m=>m.name==='Video_B.mp4')!;
 assert.equal(mediaB.sourcePath,'Video_B.mp4');
 assert.equal(mediaB.width,320);
 assert.equal(mediaB.height,180);
 assert.ok(report.warnings.some(w=>/generador/i.test(w)));
 assert.equal(report.events,5);
});
test('XML: tamaño en píxeles de la secuencia y no del archivo de origen',()=>{
 const {project}=parseFcpXml(xml,'vegas-montaje.xml');
 assert.equal(project.width,1920);
 assert.equal(project.height,1080);
});
test('XML inválido o ajeno se rechaza con mensajes comprensibles',()=>{
 assert.throws(()=>parseFcpXml('<xmeml version="5"><sequence></sequence></xmeml>','x.xml'),/<video> ni <audio>/);
 assert.throws(()=>parseFcpXml('<xmeml version="5"></xmeml>','x.xml'),/no contiene ningún elemento <sequence>/);
 assert.throws(()=>parseFcpXml('<a><b></a>','x.xml'),/no es un XML válido/);
 assert.throws(()=>parseInterchange('cualquiera.bin','datos'),/EDL CMX 3600/);
});
test('parser XML mínimo: atributos, entidades, CDATA, comentarios y errores',()=>{
 const tree=parseXml('<?xml version="1.0"?><!-- nota --><raíz a="1" b="x&amp;y"><hijo><![CDATA[<crudo>]]></hijo><vacio/></raíz>');
 const root=tree.children[0];
 assert.equal(root.name,'raíz');
 assert.equal(root.attrs.a,'1');
 assert.equal(root.attrs.b,'x&y');
 assert.equal(root.children[0].text,'<crudo>');
 assert.equal(root.children[1].name,'vacio');
 assert.throws(()=>parseXml('<a><b></c></a>'),/se esperaba/);
 assert.throws(()=>parseXml('<a>'),/queda abierta/);
});
test('utilidades de tiempo: fotogramas, timecode y frecuencias racionales',()=>{
 assert.equal(timecodeToFrames('00:00:03:15',30),105);
 assert.equal(timecodeToFrames('01:00:00:00',30),108000);
 assert.equal(timecodeToFrames('00:00:00;00',30),0);
 assert.equal(timecodeToFrames('texto',30),null);
 assert.equal(framesToTicks(30,{num:30,den:1}),ticks(1));
 assert.equal(seconds(framesToTicks(300,{num:30000,den:1001})),300*1001/30000);
 assert.deepEqual(frameRateFromTimebase(30,true),{num:30000,den:1001,label:'29.97'});
 assert.deepEqual(frameRateFromTimebase(25,false),{num:25,den:1,label:'25'});
});
