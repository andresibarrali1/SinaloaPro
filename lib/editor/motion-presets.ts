import {ticks,type Event,type EaseKind} from './project';
type Stop={at:number;x?:number;y?:number;scale?:number;rotation?:number;opacity?:number};
export type MotionPreset={id:string;name:string;group:'Entradas'|'Salidas'|'Cinemáticas';stops:Stop[]};
export const MOTION_DRAG='application/sinaloa-motion';
export const MOTION_PRESETS:MotionPreset[]=[
 {id:'rise',name:'Ascenso elegante',group:'Entradas',stops:[{at:0,y:.16,opacity:0},{at:1}]},
 {id:'slide',name:'Deslizamiento lateral',group:'Entradas',stops:[{at:0,x:-.3,opacity:0},{at:1}]},
 {id:'focus',name:'Enfoque editorial',group:'Entradas',stops:[{at:0,scale:.88,opacity:0},{at:1}]},
 {id:'pop',name:'Rebote preciso',group:'Entradas',stops:[{at:0,scale:.6,opacity:0},{at:.65,scale:1.07},{at:1}]},
 {id:'tilt',name:'Giro de presentación',group:'Entradas',stops:[{at:0,rotation:-8,scale:.85,opacity:0},{at:1}]},
 {id:'drop',name:'Caída suave',group:'Entradas',stops:[{at:0,y:-.18,opacity:0},{at:1}]},
 {id:'fade-away',name:'Desvanecer y alejar',group:'Salidas',stops:[{at:0},{at:1,scale:.92,opacity:0}]},
 {id:'exit-up',name:'Salida ascendente',group:'Salidas',stops:[{at:0},{at:1,y:-.2,opacity:0}]},
 {id:'exit-side',name:'Salida lateral',group:'Salidas',stops:[{at:0},{at:1,x:.3,opacity:0}]},
 {id:'push',name:'Acercamiento de cine',group:'Cinemáticas',stops:[{at:0},{at:1,scale:1.18}]},
 {id:'pull',name:'Revelación de escena',group:'Cinemáticas',stops:[{at:0,scale:1.18},{at:1}]},
 {id:'drift',name:'Recorrido panorámico',group:'Cinemáticas',stops:[{at:0,x:-.06,scale:1.16},{at:1,x:.06,scale:1.16}]},
];
export function applyMotionPreset(event:Event,id:string,duration=1):Event {
 const preset=MOTION_PRESETS.find(p=>p.id===id);if(!preset||event.kind==='audio'||event.locked)return event;
 const end=Math.max(0,event.duration-1),span=preset.group==='Cinemáticas'?end:Math.min(end,ticks(Math.max(.1,duration)));
 const start=preset.group==='Salidas'?end-span:0,base=event.transform;
 const key=(s:Stop,time:number)=>({...base,x:base.x+(s.x??0),y:base.y+(s.y??0),scale:base.scale*(s.scale??1),rotation:base.rotation+(s.rotation??0),opacity:base.opacity*(s.opacity??1),time,curve:(preset.group==='Cinemáticas'?'linear':'smooth') as EaseKind});
 const keys=preset.stops.map(s=>key(s,Math.round(start+span*s.at)));
 if(start>0)keys.unshift(key({at:0},0));
 return {...event,keys:[...new Map(keys.map(k=>[k.time,k])).values()]};
}
