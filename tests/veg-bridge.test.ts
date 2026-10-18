// Pruebas del puente .veg: la traducción entre el documento que devuelve VEGAS y el modelo de Corte 15.
//
// Ninguna prueba lanza VEGAS: lo que se comprueba es el contrato (unidades, velocidades, encuadre,
// referencias de medios y el TSV que VEGAS vuelve a leer) y que lo que no se puede traer se dice en vez de
// inventarse. Las funciones probadas son puras: no tocan el DOM ni el sistema de archivos.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nanosToTicks,ticksToNanos,mapFrameRate,vegDocumentToProject,projectToVegTsv,bridgeUrl,BRIDGE_DEFAULT_URL,VEG_BRIDGE_HELP,VegDocument} from '../lib/editor/veg-bridge';
import {newProject,newEvent,ticks,uid,Media} from '../lib/editor/project';
import {validateProject} from '../lib/editor/validation';

test('unidades: los nanosegundos de VEGAS y los ticks de Corte 15 van y vuelven sin pérdida',()=>{
 assert.equal(nanosToTicks(0),0);
 assert.equal(nanosToTicks(1e9),705600000);
 assert.equal(ticksToNanos(705600000),1e9);
 const nanos=292767000000;                                  // el .veg real: 4 min 52,767 s
 assert.equal(nanosToTicks(nanos),206576395200);
 assert.equal(ticksToNanos(nanosToTicks(nanos)),nanos);
 assert.equal(ticksToNanos(nanosToTicks(1500000000)),1500000000);
});

test('velocidades: los dobles de VEGAS se reconocen como las fracciones que admite el modelo',()=>{
 assert.deepEqual(mapFrameRate(29.97002997002997),{fps:{num:30000,den:1001},exact:true});
 assert.deepEqual(mapFrameRate(23.976023976023978),{fps:{num:24000,den:1001},exact:true});
 assert.deepEqual(mapFrameRate(59.94005994005994),{fps:{num:60000,den:1001},exact:true});
 assert.deepEqual(mapFrameRate(25),{fps:{num:25,den:1},exact:true});
 const rara=mapFrameRate(31.5);
 assert.equal(rara.exact,false);
 assert.deepEqual(rara.fps,{num:30,den:1});
 assert.equal(mapFrameRate(Number.NaN).exact,false);
});

const documento:VegDocument={
 lengthNanos:292767000000,
 width:1920,height:1080,frameRate:29.97002997002997,sampleRate:48000,
 tracks:[
  {name:'Vídeo',type:'Video',mute:false,solo:false,events:[
   {startNanos:3000000000,lengthNanos:5000000000,name:'Plano A',mediaType:'Video',mediaPath:'C:\\Videos\\A.mp4',offsetNanos:1000000000,playbackRate:1,fadeInNanos:500000000,fadeOutNanos:0,gain:1,
    motion:[{nanos:3000000000,left:0,top:0,right:1920,bottom:1080,cx:960,cy:540,rotation:0}],opacityPoints:[]},
  ]},
  {name:'Audio',type:'Audio',mute:false,solo:false,volume:0.5,pan:-0.25,events:[
   {startNanos:3000000000,lengthNanos:5000000000,name:'Plano A',mediaType:'Audio',mediaPath:'c:\\videos\\a.mp4',fadeOutNanos:1000000000,gain:0.8},
   {startNanos:9000000000,lengthNanos:2000000000,name:'Título de VEGAS',mediaType:'Video',mediaPath:null},
  ]},
 ],
 markers:[{nanos:12000000000,label:'Corte'}],
 regions:[{startNanos:0,lengthNanos:10000000000,label:'Tramo'}],
};

test('lectura: el montaje de VEGAS se convierte en un proyecto válido de Corte 15',()=>{
 const {project,report}=vegDocumentToProject(documento,'adobe.veg');
 validateProject(project);                                   // no debe lanzar
 assert.equal(project.name,'adobe');
 assert.equal(project.width,1920);
 assert.equal(project.height,1080);
 assert.deepEqual(project.fps,{num:30000,den:1001});
 assert.equal(project.sampleRate,48000);
 assert.equal(project.tracks.length,2);
 assert.deepEqual(project.tracks.map(t=>t.kind),['video','audio']);
 assert.equal(project.tracks[1].gain,0.5);
 assert.equal(project.tracks[1].pan,-0.25);
 assert.equal(project.events.length,2);
 assert.equal(project.media.length,1);                       // la misma ruta en dos pistas es un solo medio
 assert.equal(project.media[0].sourcePath,'C:\\Videos\\A.mp4');
 assert.equal(project.media[0].kind,'video');
 assert.equal(report.events,2);
 assert.equal(report.media,1);
 assert.equal(report.frameRateExact,true);
 assert.match(report.ignored.join(' '),/Título de VEGAS/);    // el evento sin archivo se declara, no se inventa
});

test('lectura: cada evento conserva posición, recorte, velocidad, fundidos y ganancia',()=>{
 const {project}=vegDocumentToProject(documento,'adobe.veg');
 const video=project.events.find(e=>e.kind==='video')!;
 assert.equal(video.start,nanosToTicks(3000000000));
 assert.equal(video.duration,nanosToTicks(5000000000));
 assert.equal(video.offset,nanosToTicks(1000000000));
 assert.equal(video.fadeIn,nanosToTicks(500000000));
 assert.equal(video.fadeOut,0);
 assert.equal(video.gain,1);
 const audio=project.events.find(e=>e.kind==='audio')!;
 assert.equal(audio.trackId,project.tracks[1].id);
 assert.equal(audio.mediaId,video.mediaId);
 assert.equal(audio.fadeOut,nanosToTicks(1000000000));
 assert.equal(audio.gain,0.8);
 });

test('lectura: el encuadre de VEGAS se traduce a desplazamiento, escala, giro y opacidad',()=>{
 const encuadre:VegDocument={width:1000,height:1000,frameRate:30,sampleRate:48000,tracks:[{name:'V',type:'Video',mute:false,solo:false,events:[
  {startNanos:0,lengthNanos:2000000000,name:'Clip',mediaPath:'C:\\a.mp4',
   motion:[{nanos:0,left:0,top:0,right:1000,bottom:1000,cx:500,cy:500,rotation:0},{nanos:1000000000,left:250,top:250,right:750,bottom:750,cx:600,cy:500,rotation:90}],
   opacityPoints:[{nanos:0,value:1},{nanos:2000000000,value:0}]},
 ]}]};
 const {project}=vegDocumentToProject(encuadre,'x.veg');
 const event=project.events[0];
 assert.equal(event.keys.length,3);                          // dos claves de movimiento y una de opacidad
 assert.equal(event.keys[0].scale,1);
 assert.equal(event.keys[0].x,0);
 assert.equal(event.keys[1].scale,0.5);                      // 500 px de 1000
 assert.equal(event.keys[1].x,0.1);                          // el centro se movió 100 px a la derecha
 assert.equal(event.keys[1].rotation,90);
 assert.equal(event.keys[2].opacity,0);
 assert.equal(event.keys[2].scale,0.5);                      // el valor anterior se arrastra
});

test('escritura: el montaje se convierte en el TSV que VEGAS lee y se informa de lo que no se puede escribir',()=>{
 const p=newProject();
 p.name='Prueba';
 const video=p.tracks[0];
 const medio:Media={id:uid(),name:'a.mp4',size:0,modified:0,kind:'video',duration:ticks(10),width:1920,height:1080,hasAudio:true,mime:'video/mp4',sourcePath:'C:\\Videos\\a.mp4'};
 p.media.push(medio);
 p.events.push({...newEvent(video.id,'video',ticks(1),ticks(4)),mediaId:medio.id,name:'Plano 1',fadeIn:ticks(0.5),fadeOut:ticks(0.25)});
 p.events.push({...newEvent(video.id,'text',0,ticks(2)),name:'Título'});
 p.markers.push({id:uid(),name:'Corte\tcon tabulador',time:ticks(3)});
 p.region={start:ticks(0),end:ticks(5)};
 const {tsv,skipped,stats}=projectToVegTsv(p);
 const lines=tsv.trim().split('\n');
 assert.equal(lines[0],'# corte15 -> vegas 15');
 assert.equal(lines[1],'project\t1920\t1080\t30\t48000');
 assert.equal(lines.filter(line=>line.startsWith('track\t')).length,p.tracks.length);
 assert.equal(stats.events,1);
 assert.equal(stats.markers,1);
 assert.equal(stats.regions,1);
 assert.equal(skipped.length,1);
 assert.match(skipped[0],/Título/);
 const cells=lines.find(line=>line.startsWith('event\t'))!.split('\t');
 assert.equal(cells[1],'0');
 assert.equal(cells[2],'C:\\Videos\\a.mp4');
 assert.equal(cells[3],'video');
 assert.equal(cells[4],'1.000000');
 assert.equal(cells[5],'4.000000');
 assert.equal(cells[6],'0.000000');
 assert.equal(cells[7],'0.500000');
 assert.equal(cells[8],'0.250000');
 assert.ok(lines.includes('marker\t3.000000\tCorte con tabulador'));
 assert.ok(lines.some(line=>line.startsWith('region\t0.000000\t5.000000\t')));
});

test('escritura: los eventos sin archivo no se pierden en silencio',()=>{
 const p=newProject();
 p.events.push({...newEvent(p.tracks[0].id,'color',0,ticks(2)),name:'Color sólido'});
 const {skipped,stats}=projectToVegTsv(p);
 assert.equal(stats.events,0);
 assert.match(skipped.join(' '),/Color sólido/);
 assert.match(skipped.join(' '),/ningún evento/i);
});

test('lectura: un documento vacío o ilegible se dice, no se rellena con datos falsos',()=>{
 const {project,report}=vegDocumentToProject({width:1920,height:1080,frameRate:30,sampleRate:48000},'vacio.veg');
 assert.equal(project.events.length,0);
 assert.equal(project.tracks.length,0);
 assert.match(report.warnings.join(' '),/vacío/);
 assert.throws(()=>vegDocumentToProject(null as unknown as VegDocument),/no devolvió un montaje/);
});

test('puente: sin VEGAS se explica qué hacer en lugar de simular que se puede',()=>{
 assert.match(VEG_BRIDGE_HELP,/Iniciar-con-VEGAS/);
 assert.equal(BRIDGE_DEFAULT_URL,'http://127.0.0.1:5174');
 assert.equal(bridgeUrl(),BRIDGE_DEFAULT_URL);               // en Node no hay localStorage ni entorno de Vite
});
