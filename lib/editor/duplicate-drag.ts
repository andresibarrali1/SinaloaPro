import {clone,uid,seconds,type Project,type Event} from './project';
import {buildSrt} from './speech';
// Called once per gesture: stable identifiers while pointermove previews the same copy.
export function duplicateForDrag(project:Project,ids:string[]){
 const next=clone(project),groups=new Map<string,string>(),copies:Event[]=[];
 for(const original of project.events.filter(e=>ids.includes(e.id)&&!e.locked)){
  const copy=clone(original);copy.id=uid();
  if(copy.group){if(!groups.has(copy.group))groups.set(copy.group,uid());copy.group=groups.get(copy.group);}
  if(copy.kind==='text'){
   const mediaId=uid();copy.mediaId=mediaId;copy.name=`${original.name} (copia)`;
   const template=clone(copy);template.mediaId=undefined;template.group=undefined;
   const text=buildSrt([{start:0,end:seconds(copy.duration),text:copy.text}]);
   next.media.push({id:mediaId,name:copy.name,kind:'subtitle',mime:'application/x-sinaloapro-text',text,textTemplate:template,size:text.length,modified:Date.now(),duration:copy.duration,width:project.width,height:project.height,hasAudio:false});
  }
  copies.push(copy);
 }
 next.events.push(...copies);return {project:next,ids:copies.map(e=>e.id)};
}
