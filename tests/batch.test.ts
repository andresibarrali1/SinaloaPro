// Pruebas del lote de renderizado (la cola de trabajos, equivalente al script «Batch Render» de VEGAS 15).
// Son casos concretos de la lógica pura: nombres de archivo, etiquetas, resolución del ámbito y de los
// fotogramas, duplicados, problemas y resumen. El renderizado real se comprueba en el flujo de navegador.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newEvent,newProject,ticks} from '../lib/editor/project';
import {ExportSettings} from '../lib/editor/export';
import {
  BATCH_VARIANTS,appendJobs,audioTrackJobs,fileNameFor,jobLabel,jobProject,nextJob,planBatch,safeFileName,settingsProblem,summarize,uniqueFileName,
  variantSettings,
} from '../lib/editor/batch';

const FPS30={num:30,den:1};
const settings=(patch:Partial<ExportSettings>={}):ExportSettings=>({width:1280,height:720,fps:FPS30,format:'mp4',quality:'medium',scope:'full',start:0,end:0,includeVideo:true,includeAudio:true,bitrateMbps:null,...patch});
// Proyecto con un clip de `duration` segundos y nombre conocido, para poder comprobar los nombres de archivo.
function scene(duration=3){const p=newProject();p.name='Mi proyecto';p.events.push(newEvent(p.tracks[1].id,'color',0,ticks(duration)));return p;}

test('lote: los nombres de archivo limpian lo que Windows no admite y llevan formato y ámbito',()=>{
  assert.equal(safeFileName('a/b:c*d?e"f<g>h|i'),'a-b-c-d-e-f-g-h-i');
  assert.equal(safeFileName('  ...  '),'sin-nombre');
  assert.equal(safeFileName('Vacaciones  2026'),'Vacaciones 2026');
  // La etiqueta del trabajo acaba en el nombre, con el formato como extensión.
  assert.equal(fileNameFor('Mi proyecto',settings()),'Mi proyecto--MP4 1280x720 30 fps.mp4');
  // El «·» de la etiqueta se cambia por un guion: no es portable en un nombre de archivo.
  assert.equal(fileNameFor('Mi proyecto',settings({scope:'range'})),'Mi proyecto--MP4 1280x720 30 fps - tramo.mp4');
  assert.equal(fileNameFor('Mi/proyecto',settings({format:'wav',includeVideo:false})),'Mi-proyecto--WAV solo audio.wav');
});

test('lote: la etiqueta dice formato, tamaño, velocidad y ámbito (y el audio no finge vídeo)',()=>{
  assert.equal(jobLabel(settings()),'MP4 1280x720 30 fps');
  assert.equal(jobLabel(settings({format:'webm',width:1920,height:1080,quality:'high'})),'WebM 1920x1080 30 fps');
  assert.equal(jobLabel(settings({fps:{num:30000,den:1001}})),'MP4 1280x720 29,97 fps');
  assert.equal(jobLabel(settings({format:'wav',includeVideo:false,scope:'range'})),'WAV solo audio · tramo');
});

test('lote: dos trabajos iguales no comparten nombre de archivo',()=>{
  const base='proyecto--MP4 1280x720 30 fps.mp4';
  assert.equal(uniqueFileName(base,[]),base);
  assert.equal(uniqueFileName(base,[base]),'proyecto--MP4 1280x720 30 fps[2].mp4');
  assert.equal(uniqueFileName(base,[base,'proyecto--MP4 1280x720 30 fps[2].mp4']),'proyecto--MP4 1280x720 30 fps[3].mp4');
  const p=scene();
  const twice=appendJobs([],p,[settings(),settings()]);
  assert.equal(twice.length,2);
  assert.equal(twice[0].fileName,'Mi proyecto--MP4 1280x720 30 fps.mp4');
  assert.equal(twice[1].fileName,'Mi proyecto--MP4 1280x720 30 fps[2].mp4');
});

test('lote: los fotogramas de cada trabajo salen del proyecto y de su ámbito',()=>{
  const p=scene(3);
  const whole=appendJobs([],p,[settings()])[0];
  assert.equal(whole.frames,90);
  assert.equal(whole.status,'pendiente');
  assert.equal(whole.done,0);
  p.region={start:ticks(1),end:ticks(2)};
  const ranged=appendJobs([],p,[settings({scope:'range',start:p.region.start,end:p.region.end})])[0];
  assert.equal(ranged.frames,30);
  assert.match(ranged.fileName,/tramo\.mp4$/);
});

test('lote: añadir trabajos no modifica la lista ni los ajustes anteriores',()=>{
  const p=scene();
  const original=appendJobs([],p,[settings()]);
  const copy=JSON.parse(JSON.stringify(original)) as typeof original;
  const next=appendJobs(original,p,[settings({format:'wav',includeVideo:false})]);
  assert.equal(original.length,1,'la lista original no cambia');
  assert.deepEqual(original,copy,'los trabajos ya preparados no se tocan');
  assert.equal(next.length,2);
  assert.notEqual(next,original);
  // Los ajustes se copian: cambiar el objeto de entrada no altera el trabajo ya encolado.
  const mutable=settings();
  const queued=appendJobs([],p,[mutable])[0];
  mutable.width=320;
  assert.equal(queued.settings.width,1280);
});

test('lote: se rechaza con un motivo lo que no se puede renderizar',()=>{
  const p=scene();
  assert.equal(settingsProblem(p,settings()),null);
  assert.match(settingsProblem(p,settings({includeVideo:false,includeAudio:false}))!,/al menos una salida/);
  assert.match(settingsProblem(p,settings({scope:'range'}))!,/no hay ninguno marcado/);
  p.region={start:ticks(1),end:ticks(1)};
  assert.match(settingsProblem(p,settings({scope:'range'}))!,/tramo del trabajo está vacío/);
  assert.match(settingsProblem(p,settings(),{mp4:false,webm:true,wav:true})!,/no puede codificar MP4/);
  const empty=newProject();
  assert.match(settingsProblem(empty,settings())!,/nada que renderizar/);
});

test('lote: el plan prepara los trabajos válidos y explica los que descarta',()=>{
  const p=scene();
  const plan=planBatch(p,[settings(),settings({includeVideo:false,includeAudio:false}),settings({format:'wav',includeVideo:false})],{mp4:true,webm:true,wav:true});
  assert.equal(plan.jobs.length,2);
  assert.equal(plan.problems.length,1);
  assert.match(plan.problems[0],/al menos una salida/);
  // Una cola sin nada válido no prepara ningún trabajo, pero dice por qué.
  const empty=planBatch(p,[],{mp4:true,webm:true,wav:true});
  assert.deepEqual(empty,{jobs:[],problems:[]});
});

test('lote: las plantillas disponibles son las que el motor puede codificar y respetan velocidad y ámbito',()=>{
  const base=settings({fps:{num:25,den:1},scope:'range',start:ticks(1),end:ticks(2)});
  const all=variantSettings(base,{mp4:true,webm:true,wav:true});
  assert.equal(all.length,BATCH_VARIANTS.length);
  assert.deepEqual(all.map(item=>item.format),['mp4','mp4','webm','wav']);
  for(const item of all){
    assert.deepEqual(item.fps,{num:25,den:1},'la velocidad del proyecto no se cambia');
    assert.equal(item.scope,'range');
  }
  assert.equal(all.at(-1)!.includeVideo,false);
  // Sin codificador de MP4 (por ejemplo Firefox) no se ofrecen trabajos MP4.
  const noMp4=variantSettings(base,{mp4:false,webm:true,wav:true});
  assert.deepEqual(noMp4.map(item=>item.format),['webm','wav']);
});

test('lote: el resumen cuenta estados, fotogramas y bytes',()=>{
  const p=scene(2);
  const jobs=appendJobs([],p,[settings(),settings({format:'wav',includeVideo:false})]);
  jobs[0]={...jobs[0],status:'hecho',bytes:1024,frames:60,done:60};
  jobs[1]={...jobs[1],status:'error',error:'falló'};
  const summary=summarize(jobs);
  // El trabajo de audio no suma fotogramas: un WAV no tiene imagen que renderizar.
  assert.deepEqual({total:summary.total,pending:summary.pending,done:summary.done,failed:summary.failed,frames:summary.frames,bytes:summary.bytes},{total:2,pending:0,done:1,failed:1,frames:60,bytes:1024});
  assert.equal(summarize([]).total,0);
  // Lo que se canceló no suma fotogramas: no se va a renderizar.
  const cancelled=[{...jobs[0],status:'cancelado' as const}];
  assert.equal(summarize(cancelled).frames,0);
});

test('lote: el siguiente trabajo es el primero en espera y también se reintentan los fallidos',()=>{
  const p=scene();
  const jobs=appendJobs([],p,[settings(),settings({format:'wav',includeVideo:false})]);
  assert.equal(nextJob(jobs)!.id,jobs[0].id);
  const failed=[{...jobs[0],status:'error' as const},{...jobs[1],status:'pendiente' as const}];
  assert.equal(nextJob(failed)!.id,jobs[0].id,'un trabajo fallido se puede reintentar');
  assert.equal(nextJob(jobs.map(job=>({...job,status:'hecho' as const}))),undefined);
  assert.equal(nextJob(jobs.map(job=>({...job,status:'cancelado' as const}))),undefined);
});

// «Render Audio Tracks.cs» de VEGAS: una salida por pista de audio.
test('una salida por pista de audio: un WAV por pista, con su nombre y sin repetir archivos',()=>{
  const p=scene();
  p.tracks[2].name='Voz';
  const music={...p.tracks[2],id:'pista-musica',name:'Música'};
  p.tracks.push(music);
  const jobs=audioTrackJobs(p,settings(),{mp4:true,webm:true,wav:true});
  assert.equal(jobs.length,2,'una por pista de audio (la pista de vídeo no cuenta)');
  assert.deepEqual(jobs.map(job=>job.trackName),['Voz','Música']);
  assert.deepEqual(jobs.map(job=>job.onlyTrackId),[p.tracks[2].id,'pista-musica']);
  for(const job of jobs){
    assert.equal(job.settings.format,'wav');
    assert.equal(job.settings.includeVideo,false);
    assert.equal(job.settings.includeAudio,true);
    assert.equal(job.status,'pendiente');
    assert.match(job.label,/WAV · solo la pista «/);
    assert.match(job.fileName,/^Mi proyecto--Audio /);
    assert.ok(job.fileName.endsWith('.wav'));
  }
  assert.notEqual(jobs[0].fileName,jobs[1].fileName,'los nombres no se pisan');
  // Dos pistas con el mismo nombre tampoco se pisan: se numera la segunda.
  const twins={...p,tracks:[{...p.tracks[2],id:'a',name:'Voz'},{...p.tracks[2],id:'b',name:'Voz'}]};
  const repeated=audioTrackJobs(twins,settings(),{mp4:true,webm:true,wav:true});
  assert.equal(repeated.length,2);
  assert.notEqual(repeated[0].fileName,repeated[1].fileName);
  assert.match(repeated[1].fileName,/\[2\]\.wav$/);
  // Sin pistas de audio, o sin WAV en el motor, no se añade nada.
  const silent={...p,tracks:p.tracks.filter(track=>track.kind!=='audio')};
  assert.deepEqual(audioTrackJobs(silent,settings(),{mp4:true,webm:true,wav:true}),[]);
  assert.deepEqual(audioTrackJobs(p,settings(),{mp4:true,webm:true,wav:false}),[]);
});

test('el proyecto de un trabajo por pista deja audible solo esa pista',()=>{
  const p=scene();
  p.tracks[2].name='Voz';
  p.tracks.push({...p.tracks[2],id:'pista-musica',name:'Música'});
  const [first]=audioTrackJobs(p,settings(),{mp4:true,webm:true,wav:true});
  // Un trabajo normal renderiza el proyecto tal cual.
  const plain=appendJobs([],p,[settings()])[0];
  assert.equal(jobProject(p,plain),p);
  const solo=jobProject(p,first);
  assert.notEqual(solo,p,'se devuelve una copia, no el mismo proyecto');
  const audio=solo.tracks.filter(track=>track.kind==='audio');
  assert.equal(audio.filter(track=>!track.mute).length,1,'solo una pista queda audible');
  assert.equal(audio.find(track=>!track.mute)!.id,first.onlyTrackId);
  assert.ok(audio.every(track=>!track.solo),'nadie queda en solo: el silencio es lo que aísla');
  // El proyecto original no se toca.
  assert.ok(p.tracks.filter(track=>track.kind==='audio').every(track=>!track.mute));
});
