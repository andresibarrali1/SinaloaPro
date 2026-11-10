import {frameTicks,linkedIds,lockedIds,quantize,rippleMove,type Project,type Ripple} from './project';
/** Preserve the source interval while changing its duration, including linked audio. */
export function stretchEvent(p:Project,id:string,edge:'left'|'right',delta:number,ripple:Ripple='off'){
 const base=p.events.find(e=>e.id===id);
 if(!base||!['video','audio'].includes(base.kind)||base.duration<=0||!Number.isFinite(delta))return;
 const ids=linkedIds(p,[id]),targets=p.events.filter(e=>ids.includes(e.id));
 const locked=lockedIds(p);if(targets.some(e=>locked.has(e.id)))return;
 const oldEnd=base.start+base.duration,anchor=edge==='right'?base.start:oldEnd;
 let low=0,high=Infinity;
 for(const e of targets){
  low=Math.max(low,e.speed/4,frameTicks(p.fps)/e.duration);
  high=Math.min(high,e.speed/.25);
  if(e.start<anchor)high=Math.min(high,anchor/(anchor-e.start));
 }
 if(low>high)return;
 const duration=quantize(base.duration+(edge==='right'?delta:-delta),p.fps);
 const ratio=Math.max(low,Math.min(high,duration/base.duration));
 for(const e of targets){
  const oldDuration=e.duration,newDuration=Math.max(1,Math.round(oldDuration*ratio));
  e.start=Math.max(0,Math.round(anchor+(e.start-anchor)*ratio));
  e.duration=newDuration;e.speed=e.speed*oldDuration/newDuration;
  const scale=newDuration/oldDuration;
  e.fadeIn=Math.min(newDuration,Math.round(e.fadeIn*scale));
  e.fadeOut=Math.min(newDuration,Math.round(e.fadeOut*scale));
  e.keys=e.keys.map(key=>({...key,time:Math.round(key.time*scale)}));
  if(e.gainCurve)e.gainCurve=e.gainCurve.map(key=>({...key,time:Math.round(key.time*scale)}));
 }
 if(edge==='right')rippleMove(p,ids,base.start+base.duration-oldEnd,ripple,oldEnd);
}
