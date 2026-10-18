// Pruebas de las plantillas de proyecto: formatos verticales de redes, horizontales y de cine.
//
// Lo que se comprueba aquí es que cada plantilla es coherente (relación de aspecto, velocidad admitida por el
// editor, medidas pares), que aplicarla cambia solo el formato y no el montaje, y que el proyecto se reconoce
// como la plantilla que le corresponde.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PROJECT_TEMPLATES,applyProjectTemplate,aspectRatio,describeFormat,detectTemplate,isVertical,sameFps,templateById,templateItems,templateLabel} from '../lib/editor/templates';
import {newProject,newTrack,newEvent,ticks} from '../lib/editor/project';

// Las velocidades que ofrece el editor (misma lista que usa la interfaz).
const FPS_OPTIONS=[[24,1],[25,1],[30,1],[30000,1001],[24000,1001],[50,1],[60,1],[60000,1001]];

test('cada plantilla es coherente: identificador único, medidas pares y relación correcta',()=>{
 const ids=new Set(PROJECT_TEMPLATES.map(template=>template.id));
 assert.equal(ids.size,PROJECT_TEMPLATES.length,'hay identificadores repetidos');
 for(const template of PROJECT_TEMPLATES){
  assert.ok(template.width%2===0&&template.height%2===0,`${template.name} tiene medidas impares`);
  assert.ok(template.width>=16&&template.height>=16,`${template.name} es demasiado pequeño`);
  assert.ok(template.width<=7680&&template.height<=4320,`${template.name} pasa el máximo del editor`);
  assert.ok([48000,44100].includes(template.sampleRate),`${template.name} usa una frecuencia de audio no admitida`);
  assert.ok(FPS_OPTIONS.some(([num,den])=>sameFps({num,den},template.fps)),`${template.name} usa una velocidad que el editor no ofrece`);
  assert.ok(template.note.length>20,`${template.name} no explica sus medidas`);
  assert.equal(aspectRatio(template),template.id==='cuadrado'?'1:1':template.id.startsWith('vertical')||['tiktok','reels','shorts'].includes(template.id)?'9:16':template.id==='audio-441'?'16:9':'16:9');
 }
});

test('las plantillas de redes son verticales 1080×1920 y están las tres que se pidieron',()=>{
 for(const id of ['tiktok','reels','shorts']){
  const template=templateById(id);
  assert.ok(template,`falta la plantilla ${id}`);
  assert.equal(template!.width,1080);
  assert.equal(template!.height,1920);
  assert.ok(isVertical(template!),`${id} debería ser vertical`);
 }
 assert.equal(aspectRatio(templateById('tiktok')!),'9:16');
 assert.equal(aspectRatio(templateById('cuadrado')!),'1:1');
 assert.equal(aspectRatio(templateById('youtube-1080')!),'16:9');
});

test('la lista de la interfaz empieza por «Personalizada» y lleva todas las plantillas',()=>{
 const items=templateItems();
 assert.equal(items.length,PROJECT_TEMPLATES.length+1);
 assert.deepEqual(items[0],['custom','Personalizada']);
 for(const template of PROJECT_TEMPLATES){
  const found=items.find(([value])=>value===template.id);
  assert.ok(found,`la lista no ofrece ${template.id}`);
  assert.ok(found![1].includes(template.name),'la etiqueta no lleva el nombre');
  assert.ok(templateLabel(template).startsWith(template.group),'la etiqueta no lleva el grupo');
 }
});

test('aplicar una plantilla cambia el formato y deja intacto el montaje',()=>{
 const project=newProject();
 const track=newTrack('video','Video');
 const event=newEvent(track.id,'video',ticks(2),ticks(3));
 const montaje={...project,tracks:[track],events:[event],markers:[{id:'m1',time:ticks(1),name:'Marca'}],region:{start:ticks(1),end:ticks(4)}};
 const vertical=applyProjectTemplate(montaje,'tiktok');
 assert.equal(vertical.width,1080);
 assert.equal(vertical.height,1920);
 assert.equal(vertical.sampleRate,48000);
 assert.deepEqual(vertical.fps,{num:30,den:1});
 // El montaje no se toca: ni eventos, ni pistas, ni marcadores, ni tramo.
 assert.deepEqual(vertical.events,montaje.events);
 assert.deepEqual(vertical.tracks,montaje.tracks);
 assert.deepEqual(vertical.markers,montaje.markers);
 assert.deepEqual(vertical.region,montaje.region);
 assert.equal(vertical.name,montaje.name);
 // El proyecto original no se modifica (la función es pura).
 assert.equal(montaje.width,1920);
 // Y los 60 fps de Shorts y el audio a 44,1 kHz también entran.
 assert.deepEqual(applyProjectTemplate(montaje,'shorts').fps,{num:60,den:1});
 assert.equal(applyProjectTemplate(montaje,'audio-441').sampleRate,44100);
 // Una plantilla que no existe deja el proyecto como estaba.
 assert.deepEqual(applyProjectTemplate(montaje,'no-existe'),montaje);
});

test('el proyecto se reconoce como la plantilla que le corresponde',()=>{
 const project=newProject();
 assert.equal(detectTemplate(project),'youtube-1080','el proyecto nuevo es Full HD 30p');
 assert.equal(detectTemplate(applyProjectTemplate(project,'tiktok')),'tiktok');
 assert.equal(detectTemplate(applyProjectTemplate(project,'cine-24')),'cine-24');
 assert.equal(detectTemplate({...project,width:1000,height:1000}),'custom');
 // Cambiar solo los fps deja de coincidir con la plantilla de 30 y pasa a la de 25.
 assert.equal(detectTemplate({...project,fps:{num:25,den:1}}),'pal-25');
 // 29,97 tiene su propia plantilla.
 assert.equal(detectTemplate({...project,fps:{num:30000,den:1001}}),'ntsc-2997');
 // Y una velocidad sin plantilla propia (23,976) queda como personalizada.
 assert.equal(detectTemplate({...project,fps:{num:24000,den:1001}}),'custom');
});

test('el resumen del formato dice tamaño, relación, velocidad y audio',()=>{
 const text=describeFormat(applyProjectTemplate(newProject(),'reels'));
 assert.equal(text,'1080×1920 (9:16), 30 fps, 48000 Hz');
 assert.equal(describeFormat({width:3840,height:2160,fps:{num:24,den:1},sampleRate:48000}),'3840×2160 (16:9), 24 fps, 48000 Hz');
});
