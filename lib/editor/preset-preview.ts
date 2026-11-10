import {newProject,newEvent,generator,ticks,type Event,type TransitionKind,type GeneratorKind,type VideoEffectKind} from './project';
import {applyTextPreset} from './text-presets';
import {EFFECT_LOOKS,defaultEffect} from './effects';
export type PreviewKind='transition'|'text'|'text-animation'|'effect'|'look'|'generator';
export function presetPreviewProject(kind:PreviewKind,id:string){
 const p=newProject();p.width=640;p.height=360;
 const track=p.tracks[1].id;
 const background=newEvent(track,'color',0,ticks(4));background.color='#18749b';background.generator={...generator('checkerboard',kind==='text'||kind==='text-animation'?'#263345':'#18749b'),color2:kind==='text'||kind==='text-animation'?'#202b39':'#153449',size:80};p.events.push(background);
 if(kind==='transition'){
  const incoming=newEvent(track,'color',ticks(1),ticks(3));incoming.color='#ed9850';incoming.generator={...generator('gradient','#ed9850'),color2:'#8c3065',angle:40};incoming.transition=id as TransitionKind;incoming.fadeIn=ticks(1.5);p.events.push(incoming);
 }else if(kind==='text'||kind==='text-animation'){
  let text=newEvent(p.tracks[0].id,'text',0,ticks(3));text.text='Tu texto';if(kind==='text')text=applyTextPreset(text,id);else text.animation=id as Event['animation'];text.fontSize=Math.min(text.fontSize,78);p.events.push(text);
 }else if(kind==='effect'){
  background.generator={...generator('bars','#18749b'),size:40};background.effects=[defaultEffect(id as VideoEffectKind,'preview-effect')];
 }else if(kind==='look'){
  // Un look es una pila: la miniatura enseña el resultado de todos sus efectos juntos, no el del primero.
  const look=EFFECT_LOOKS.find(item=>item.id===id);
  background.generator={...generator('gradient','#e8a15f'),color2:'#2f6f8f',angle:35};
  background.effects=(look?.effects??[]).map((part,index)=>({...defaultEffect(part.kind,`preview-${index}`),...part}));
 }else background.generator=generator(id as GeneratorKind,'#2597d3');
 return p;
}
