import {pose, type Project, type Track, type TrackButton} from './project';
export const TRACK_BUTTONS: [TrackButton,string][] = [
 ['motion','Movimiento de pista'],['effects','Efectos de pista'],['composite','Modo de composición'],
 ['automation','Mostrar controles de automatización'],['blur','Ignorar desenfoque de movimiento'],
];
export const DEFAULT_TRACK_BUTTONS: TrackButton[] = ['motion','effects','composite'];
export function trackPose(track:Track,time:number){
 return track.automationMode==='off'?track.transform:pose({transform:track.transform,keys:track.keys??[],start:0},time);
}
export function descendants(tracks:Track[],id:string):Track[]{
 const ids=new Set([id]);let changed=true;
 while(changed){changed=false;for(const track of tracks)if(track.parentId&&ids.has(track.parentId)&&!ids.has(track.id)){ids.add(track.id);changed=true;}}
 return tracks.filter(track=>track.id!==id&&ids.has(track.id));
}
export function videoTracks(project:Project):Track[]{
 const tracks=project.tracks.filter(t=>t.kind==='video'),solo=new Set<string>();
 for(const t of tracks)if(t.solo){solo.add(t.id);for(const c of descendants(tracks,t.id))solo.add(c.id);
  let parent=tracks.find(p=>p.id===t.parentId);const seen=new Set<string>();
  while(parent&&!seen.has(parent.id)){seen.add(parent.id);solo.add(parent.id);parent=tracks.find(p=>p.id===parent!.parentId);}
 }
 return tracks.filter(track=>{
  let current:Track|undefined=track;const seen=new Set<string>();
  while(current&&!seen.has(current.id)){seen.add(current.id);if(current.mute)return false;current=tracks.find(t=>t.id===current!.parentId);}
  return !solo.size||solo.has(track.id);
 });
}
export function makeChild(project:Project,id:string):boolean{
 const i=project.tracks.findIndex(t=>t.id===id),track=project.tracks[i],parent=project.tracks[i-1];
 if(!track||track.kind!=='video'||!parent||parent.kind!=='video')return false;
 track.parentId=parent.id;return true;
}
export function makePrimary(project:Project,id:string){
 const track=project.tracks.find(t=>t.id===id);if(!track)return;
 const parent=project.tracks.find(t=>t.id===track.parentId);track.parentId=parent?.parentId;
}
