import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PreviewOverlay} from '../components/editor/preview-overlay';
import {newProject,newEvent,newTrack,transform} from '../lib/editor/project';

test('text and subtitle selection has a full-size draggable preview box, not a 1-pixel box',()=>{
 const project=newProject();project.width=1920;project.height=1080;
 for(const kind of ['text','color'] as const){
  const event=newEvent(newTrack('video').id,kind,0);
  const html=renderToStaticMarkup(React.createElement(PreviewOverlay,{project,event,track:null,pose:transform(),source:null,onPose:()=>{},onStatus:()=>{}}));
  assert.match(html,/class="preview-box" style="left:0%;top:0%;width:100%;height:100%"/);
 }
});
test('locked and audio events do not expose move handles',()=>{
 const project=newProject();
 for(const kind of ['text','audio'] as const){
  const event=newEvent(newTrack('video').id,kind,0);event.locked=kind==='text';
  const html=renderToStaticMarkup(React.createElement(PreviewOverlay,{project,event,track:null,pose:transform(),source:null,onPose:()=>{},onStatus:()=>{}}));
  assert.equal(html,'');
 }
});
