// Pruebas de las plantillas de texto estilo CapCut: coherencia de la lista, aplicación al evento y detección.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PRESET_ANCHORS,TEXT_PRESETS,TEXT_PRESET_GROUPS,applyTextPreset,describeTextPreset,detectTextPreset,textPresetById} from '../lib/editor/text-presets';
import {ANIMATIONS} from '../lib/editor/titles';
import {newEvent,ticks} from '../lib/editor/project';

const HEX=/^#[0-9a-f]{6}$/i;

test('cada plantilla de texto es coherente: identificador único, animación conocida y colores válidos',()=>{
 const ids=new Set(TEXT_PRESETS.map(preset=>preset.id));
 assert.equal(ids.size,TEXT_PRESETS.length,'hay identificadores repetidos');
 const animations=new Set(ANIMATIONS.map(entry=>entry.value));
 for(const preset of TEXT_PRESETS){
  assert.ok(preset.name.length>3,`${preset.id} no tiene nombre`);
  assert.ok(preset.note.length>30,`${preset.id} no explica para qué sirve`);
  assert.ok(TEXT_PRESET_GROUPS.includes(preset.group),`${preset.id} usa un grupo que no está en la lista`);
  assert.ok(animations.has(preset.patch.animation as never),`${preset.id} usa una animación desconocida`);
  assert.ok(HEX.test(preset.patch.color??''),`${preset.id} no fija un color de texto válido`);
  if(preset.patch.outlineWidth)assert.ok(HEX.test(preset.patch.outlineColor??''),`${preset.id} no fija color de contorno`);
  if(preset.patch.shadow)assert.ok(HEX.test(preset.patch.shadow.color),`${preset.id} no fija color de sombra`);
  if(preset.patch.background)assert.ok(HEX.test(preset.patch.background.color),`${preset.id} no fija color de fondo`);
  if(preset.patch.highlightColor)assert.ok(HEX.test(preset.patch.highlightColor),`${preset.id} no fija un color de resalte válido`);
  const size=Number(preset.patch.fontSize);
  assert.ok(size>=8&&size<=500,`${preset.id} usa un tamaño imposible`);
 }
 // Hay plantillas de las tres familias y al menos una con contorno, una con sombra, una con caja y una karaoke.
 assert.deepEqual(TEXT_PRESET_GROUPS,['Nuevas animaciones','Subtítulos dinámicos','Títulos dinámicos','Redes (vertical)','Subtítulos','Títulos']);
 assert.ok(TEXT_PRESETS.some(preset=>(preset.patch.outlineWidth??0)>0));
 assert.ok(TEXT_PRESETS.some(preset=>preset.patch.shadow?.enabled));
 assert.ok(TEXT_PRESETS.some(preset=>(preset.patch.background?.opacity??0)>0));
 assert.equal(TEXT_PRESETS.filter(preset=>preset.patch.animation==='karaoke').length,1);
 assert.equal(TEXT_PRESETS.find(preset=>preset.patch.animation==='karaoke')!.patch.highlightColor,'#ffe600');
 // Todas las plantillas colocan el texto en un anclaje que existe.
 assert.ok(PRESET_ANCHORS.every(anchor=>typeof anchor==='string'&&anchor.includes('-')));
});

test('aplicar una plantilla cambia el aspecto y deja intactos el texto, los tiempos y las claves',()=>{
 const event=newEvent('t','text',ticks(2),ticks(4));
 event.text='Hola mundo';
 event.keys=[{x:0,y:0,scale:1,rotation:0,opacity:1,crop:0,time:0}];
 event.mask={left:.1,right:0,top:0,bottom:0};
 event.transform={...event.transform,x:.25};
 const applied=applyTextPreset(event,'tiktok-clasico');
 assert.equal(applied.animation,'pop');
 assert.equal(applied.bold,true);
 assert.equal(applied.anchor,'bottom-center');
 assert.equal(applied.outlineWidth,10);
 assert.equal(applied.fontSize,78);
 // Lo que no es aspecto se queda igual.
 assert.equal(applied.text,'Hola mundo');
 assert.equal(applied.start,event.start);
 assert.equal(applied.duration,event.duration);
 assert.deepEqual(applied.keys,event.keys);
 assert.deepEqual(applied.mask,event.mask);
 assert.deepEqual(applied.transform,event.transform);
 // El evento original no se toca.
 assert.equal(event.animation,undefined);
 // Y una plantilla que no existe deja el evento como estaba.
 assert.deepEqual(applyTextPreset(event,'no-existe'),event);
});

test('el estilo puesto se reconoce como su plantilla, y cualquier retoque lo deja como propio',()=>{
 const event=newEvent('t','text');
 assert.equal(detectTextPreset(event),'custom','un texto recién creado no es ninguna plantilla');
 for(const preset of TEXT_PRESETS){
  const applied=applyTextPreset(event,preset.id);
  assert.equal(detectTextPreset(applied),preset.id,`no se reconoce ${preset.id}`);
  // Cambiar el estilo a mano deja de coincidir con la plantilla.
  assert.equal(detectTextPreset({...applied,outlineWidth:(applied.outlineWidth??0)+1}),'custom');
  assert.equal(detectTextPreset({...applied,animation:'none'}),'custom');
 }
 assert.equal(describeTextPreset(applyTextPreset(event,'karaoke-amarillo')).startsWith('Karaoke amarillo:'),true);
 assert.equal(describeTextPreset(event),'Estilo propio: no coincide con ninguna plantilla.');
 assert.ok(textPresetById('neon'));
 assert.equal(textPresetById('nada'),null);
});

test('las plantillas de subtítulos dejan el texto abajo y las de títulos, arriba o en el centro',()=>{
 for(const preset of TEXT_PRESETS.filter(item=>item.group==='Subtítulos')){
  assert.equal(preset.patch.anchor,'bottom-center',`${preset.id} no coloca el subtítulo abajo`);
  assert.ok((preset.patch.wrap??1)<=.9,`${preset.id} deja el subtítulo demasiado ancho`);
 }
 for(const preset of TEXT_PRESETS.filter(item=>item.group==='Títulos')){
  assert.ok(['top-center','middle-center','bottom-center'].includes(preset.patch.anchor as string),`${preset.id} usa un anclaje raro`);
  assert.ok(Number(preset.patch.fontSize)>=56,`${preset.id} no es un título grande`);
 }
});
