import {test} from 'node:test';
import assert from 'node:assert/strict';
import {duplicateForDrag} from '../lib/editor/duplicate-drag';
import {newProject,newEvent,ticks,History,parseProject} from '../lib/editor/project';
test('imagen reutiliza el medio y texto crea un recurso independiente que persiste',()=>{
 const p=newProject(),track=p.tracks.find(t=>t.kind==='video')!;
 p.media.push({id:'image',name:'image',kind:'image',mime:'image/png',size:1,modified:0,duration:ticks(3),width:100,height:100,hasAudio:false});
 const image={...newEvent(track.id,'image',0,ticks(3)),mediaId:'image'};
 const text=newEvent(track.id,'text',ticks(4),ticks(2));text.text='Hola';text.animation='pop';text.outlineWidth=8;text.keys=[{...text.transform,time:0}];
 p.events.push(image,text);
 const result=duplicateForDrag(p,[image.id,text.id]);
 assert.equal(p.events.length,2);assert.equal(p.media.length,1);
 assert.equal(result.project.events.length,4);assert.equal(result.project.media.length,2);
 const [a,b]=result.project.events.slice(2);assert.equal(a.mediaId,'image');assert.notEqual(a.id,image.id);
 assert.notEqual(b.mediaId,text.mediaId);assert.equal(b.animation,'pop');assert.equal(b.outlineWidth,8);
 b.keys[0].scale=2;assert.equal(text.keys[0].scale,1);
 const reopened=parseProject(JSON.stringify(result.project));
 assert.equal(reopened.media[1].textTemplate?.text,'Hola');assert.equal(reopened.media[1].textTemplate?.animation,'pop');
 const history=new History();history.push(p);const undone=history.undo(result.project);assert.equal(undone.media.length,1);assert.equal(undone.events.length,2);assert.equal(history.redo(undone).events.length,4);
});
test('copias vinculadas tienen grupo nuevo y los bloqueados se omiten',()=>{
 const p=newProject(),track=p.tracks.find(t=>t.kind==='video')!;
 const a=newEvent(track.id,'color',0,ticks(2)),b=newEvent(track.id,'color',0,ticks(2)),c=newEvent(track.id,'text',0,ticks(2));
 a.group=b.group='old';c.locked=true;p.events.push(a,b,c);
 const result=duplicateForDrag(p,[a.id,b.id,c.id]);assert.equal(result.ids.length,2);assert.equal(result.project.media.length,0);
 const copies=result.project.events.slice(3);assert.equal(copies[0].group,copies[1].group);assert.notEqual(copies[0].group,'old');
});
