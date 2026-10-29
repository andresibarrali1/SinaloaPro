// Pruebas de los atributos de evento: qué se copia, qué se pega y qué se queda fuera.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ALL_ATTRIBUTES,ATTRIBUTE_GROUPS,attributeCount,copyAttributes,describeAttributes,groupById,groupFits,groupsFor,pasteAttributes,pasteableGroups} from '../lib/editor/attributes';
import {newEvent,ticks} from '../lib/editor/project';

// Un evento de vídeo con casi todo puesto, para copiar.
function decorated(){
 const event=newEvent('t','video',ticks(2),ticks(4));
 event.name='Clip con efectos';
 event.effects=[{id:'e1',kind:'blur',enabled:true,amount:5,size:10,color:'#000000',softness:.5,horizontal:true,vertical:true}];
 event.transform={...event.transform,x:.25,y:-.1,scale:1.4,rotation:30,opacity:.8};
 event.keys=[{...event.transform,time:0}];
 event.mask={left:.2,right:.1,top:0,bottom:.05};
 event.maskPath={points:[{x:.1,y:.1},{x:.4,y:.1},{x:.1,y:.4}],feather:6,invert:true};
 event.brightness=1.2;event.contrast=.9;event.saturation=1.1;event.hue=20;
 event.fadeIn=ticks(.5);event.fadeOut=ticks(.25);
 event.transition='dissolve-linear';
 event.speed=2;
 return event;
}

test('los grupos cubren los atributos del evento y no su identidad ni sus tiempos',()=>{
 for(const group of ATTRIBUTE_GROUPS){
  assert.ok(group.label.length>3,`${group.id} no tiene etiqueta`);
  assert.ok(group.note.length>15,`${group.id} no explica qué copia`);
  assert.ok(group.keys.length>0,`${group.id} no copia nada`);
  // Nunca se copian la identidad, el material, los tiempos ni el nombre.
  for(const forbidden of ['id','trackId','mediaId','start','duration','offset','name','group','kind'] as const)assert.ok(!group.keys.includes(forbidden),`${group.id} copiaría ${forbidden}`);
 }
 assert.equal(ALL_ATTRIBUTES.length,ATTRIBUTE_GROUPS.length);
 assert.ok(groupById('effects'));
 assert.equal(groupById('nada' as never),null);
});

test('los grupos se aplican al tipo de evento que les toca',()=>{
 assert.ok(groupFits(groupById('text')!,'text'));
 assert.ok(!groupFits(groupById('text')!,'video'));
 assert.ok(groupFits(groupById('audio')!,'audio'));
 assert.ok(!groupFits(groupById('audio')!,'video'));
 assert.ok(groupFits(groupById('generator')!,'color'));
 assert.ok(groupFits(groupById('effects')!,'text'));
 assert.ok(groupFits(groupById('fades')!,'image'),'los fundidos valen para cualquier tipo');
 // En un evento de audio valen los atributos de audio y los fundidos: ni el encuadre ni la velocidad tienen
 // sentido ahí (VEGAS tampoco ofrece Pan/Crop en un evento de audio).
 assert.deepEqual(groupsFor('audio').map(group=>group.id).sort(),['audio','fades']);
 assert.deepEqual(groupsFor('video').map(group=>group.id).sort(),['colorCorrection','effects','fades','panCrop','speed','transition']);
});

test('copiar recoge solo lo que el evento tiene puesto y lo deja listo para pegar',()=>{
 const source=decorated();
 const copied=copyAttributes(source);
 assert.equal(copied.from,'Clip con efectos');
 // Los efectos, el encuadre, el recorte, la máscara, el color y los fundidos vienen.
 assert.deepEqual(copied.groups.sort(),['colorCorrection','effects','fades','panCrop','speed','transition']);
 assert.equal(copied.patch.effects?.length,1);
 assert.equal(copied.patch.transform?.scale,1.4);
 assert.equal(copied.patch.mask?.left,.2);
 assert.equal(copied.patch.maskPath?.feather,6);
 assert.equal(copied.patch.brightness,1.2);
 assert.equal(copied.patch.speed,2);
 assert.ok(attributeCount(copied)>10);
 // Lo copiado es una copia: cambiar el original no cambia el portapapeles.
 source.transform.scale=9;
 assert.equal(copied.patch.transform?.scale,1.4);
 assert.equal(source.transform.scale,9);
 // Un evento recién creado no tiene casi nada que copiar más allá del encuadre neutro.
 const plain=copyAttributes(newEvent('t','video'));
 assert.deepEqual(plain.groups,['panCrop','colorCorrection','fades','speed']);
});

test('pegar escribe los grupos elegidos y respeta la identidad y los tiempos del destino',()=>{
 const copied=copyAttributes(decorated());
 const target=newEvent('otra','video',ticks(7),ticks(2));
 target.name='Destino';
 const pasted=pasteAttributes(target,copied);
 assert.equal(pasted.id,target.id);
 assert.equal(pasted.trackId,'otra');
 assert.equal(pasted.start,ticks(7));
 assert.equal(pasted.duration,ticks(2));
 assert.equal(pasted.name,'Destino');
 assert.equal(pasted.effects?.length,1);
 assert.equal(pasted.transform.scale,1.4);
 assert.equal(pasted.transition,'dissolve-linear');
 assert.equal(pasted.speed,2);
 // El fundido de la fuente (0,5 s) no cabe en el destino de 0,5 s: se recorta al evento.
 assert.equal(pasted.fadeIn,ticks(.5));
 assert.equal(pasted.fadeOut,ticks(.25));
 const tight=pasteAttributes(newEvent('otra','video',0,ticks(.3)),copied,['fades']);
 assert.equal(tight.fadeIn,ticks(.3));
 assert.equal(tight.fadeOut,ticks(.25));
});

test('pegar solo los grupos pedidos, y nunca en un evento que no los admite',()=>{
 const copied=copyAttributes(decorated());
 const target=newEvent('t','video');
 const onlyEffects=pasteAttributes(target,copied,['effects']);
 assert.equal(onlyEffects.effects?.length,1);
 assert.equal(onlyEffects.transform.scale,1,'el encuadre no se toca');
 assert.equal(onlyEffects.brightness,1);
 assert.equal(onlyEffects.speed,1);
 // Lo propio del texto no se pega en un vídeo, aunque se pida (el encuadre, el color y los fundidos sí valen).
 const textSource=copyAttributes(Object.assign(newEvent('t','text'),{bold:true,outlineWidth:4,animation:'pop'}));
 assert.deepEqual(pasteableGroups(textSource,'video'),['panCrop','colorCorrection','fades']);
 const asVideo=pasteAttributes(target,textSource,['text']);
 assert.equal(asVideo.bold,undefined);
 // Y en un texto sí.
 const textTarget=newEvent('t','text');
 assert.deepEqual(pasteableGroups(textSource,'text'),['panCrop','text','colorCorrection','fades']);
 const asText=pasteAttributes(textTarget,textSource,['text']);
 assert.equal(asText.bold,true);
 assert.equal(asText.outlineWidth,4);
 assert.equal(asText.animation,'pop');
});

test('el resumen dice qué se va a pegar y avisa cuando no hay nada',()=>{
 const copied=copyAttributes(decorated());
 assert.equal(describeAttributes(null),'No hay atributos copiados.');
 assert.match(describeAttributes(copied),/Efectos de vídeo/);
 assert.match(describeAttributes(copied),/Clip con efectos/);
 // En un evento de audio solo se pueden pegar los fundidos (y sus propios atributos de audio).
 const forAudio=describeAttributes(copied,'audio');
 assert.match(forAudio,/Fundidos de entrada y salida/);
 assert.ok(!forAudio.includes('Títulos y texto'));
 assert.ok(!forAudio.includes('Panoramización'));
 // Copiar solo los atributos de audio de un evento de audio y querer pegarlos en un vídeo: no hay nada que pegar.
 const audioSource=copyAttributes(Object.assign(newEvent('t','audio'),{gain:.5}),['audio']);
 assert.deepEqual(pasteableGroups(audioSource,'video'),[]);
 assert.equal(describeAttributes(audioSource,'video'),'Lo copiado de «Color sólido» no se puede pegar en este evento.');
});

for(const maintainAspect of [true,false,undefined])for(const stretchFill of [true,false,undefined]){
 test(`encaje: copiar y pegar aspecto=${maintainAspect}, relleno=${stretchFill}`,()=>{
  const source=newEvent('source','video');source.maintainAspect=maintainAspect;source.stretchFill=stretchFill;
  source.transform.scale=1.5;
  const target=newEvent('target','image');target.maintainAspect=false;target.stretchFill=true;
  const copied=copyAttributes(source);
  for(const groups of [undefined,['panCrop'] as const]){
   const pasted=pasteAttributes(target,copied,groups?[...groups]:undefined);
   assert.equal(pasted.maintainAspect,maintainAspect!==false);
   assert.equal(pasted.stretchFill,stretchFill===true);
   assert.equal(pasted.transform.scale,1.5);
   assert.equal(pasted.id,target.id);
  }
  const effectsOnly=pasteAttributes(target,copied,['effects']);
  assert.equal(effectsOnly.maintainAspect,false);assert.equal(effectsOnly.stretchFill,true);
  const audio=pasteAttributes(newEvent('a','audio'),copied);
  assert.equal(audio.maintainAspect,undefined);assert.equal(audio.stretchFill,undefined);
 });
}
