import {newEvent,newTrack,quantize,generator,type Project,type GeneratorKind} from './project';
export const GENERATOR_DRAG='application/sinaloapro-generator';
const labels={text:'Títulos y texto',adjustment:'Capa de efectos',solid:'Color sólido',gradient:'Degradado de color',checkerboard:'Tablero cuadriculado',bars:'Patrón de pruebas',noise:'Textura de ruido'};
export type DroppedGenerator=keyof typeof labels;
export function isGenerator(value:string):value is DroppedGenerator{return Object.prototype.hasOwnProperty.call(labels,value);}
/** Mutate only inside an editor history command. A blank-area drop creates a video track. */
export function insertGenerator(project:Project,kind:DroppedGenerator,laneId:string|null,time:number){
 let track=laneId?project.tracks.find(t=>t.id===laneId):undefined;
 if(laneId&&!track)throw new Error('La pista de destino ya no existe.');
 if(track?.kind==='audio')throw new Error('Suelta el generador en una pista de vídeo o en un espacio vacío.');
 if(!Number.isFinite(time))throw new Error('Posición de inserción inválida.');
 if(!track){track=newTrack('video');if(kind==='adjustment')track.name=labels.adjustment;project.tracks.unshift(track);}
 const event=newEvent(track.id,kind==='text'?'text':'color',quantize(Math.max(0,time),project.fps));
 event.name=labels[kind];
 if(kind==='adjustment')event.adjustmentLayer=true;
 else if(kind!=='text'){event.color=kind==='bars'?'#101010':'#28688d';event.generator=generator(kind as GeneratorKind,event.color);}
 project.events.push(event);return event;
}
