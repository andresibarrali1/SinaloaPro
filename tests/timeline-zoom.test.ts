import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planTimelineZoom,minimumTimelineZoom,timelineTickStep} from '../lib/editor/timeline-zoom';
test('maximum zoom out fits projects of any duration and removes the old scroll anchor',()=>{
 for(const span of [30,600,7200,86400])for(const viewport of [480,1000,1800]){
  const plan=planTimelineZoom({next:0,zoom:65,playhead:span*.8,scrollLeft:span*40,viewport,span,pending:{time:span*.8,pointerX:100}});
  assert.equal(plan.scrollLeft,0);assert.equal(plan.fit,true);assert.ok(span*plan.zoom<=viewport+1e-8);assert.equal(plan.minWidth,viewport);
 }
});
test('zooming back in from fit preserves the playhead position',()=>{
 const span=7200,viewport=1000,zoom=minimumTimelineZoom(span,viewport),playhead=3600;
 const plan=planTimelineZoom({next:zoom*2,zoom,playhead,scrollLeft:0,viewport,span});
 assert.equal(plan.fit,false);assert.ok(Math.abs(playhead*plan.zoom-plan.scrollLeft-500)<1e-8);
});
test('fitted zoom responds to a smaller viewport and longer project',()=>{
 const fit=(span:number,viewport:number)=>planTimelineZoom({next:0,zoom:1,playhead:300,scrollLeft:200,viewport,span});
 assert.ok(fit(7200,600).zoom<fit(3600,1200).zoom);
 for(const zoom of [.001,.01,.1,1,10,65,400])assert.ok(timelineTickStep(zoom)*zoom>=79.999);
});
test('zoom in and out keep the playhead at its screen coordinate',()=>{
 const input={zoom:65,playhead:175,scrollLeft:11000,viewport:1000};
 for(const next of [20,40,120,400]){const plan=planTimelineZoom({...input,next});assert.equal(input.playhead*next-plan.scrollLeft,375);assert.ok(plan.minWidth-plan.scrollLeft>=1000);}
});
test('wheel bursts preserve a pending anchor before DOM scroll has caught up',()=>{
 const first=planTimelineZoom({next:100,zoom:65,playhead:175,scrollLeft:11000,viewport:1000});
 const second=planTimelineZoom({next:140,zoom:first.zoom,playhead:175,scrollLeft:11000,viewport:1000,pending:first.anchor});
 assert.equal(175*second.zoom-second.scrollLeft,375);
});
test('zoom supplies trailing room so browser clamping cannot shift the anchor',()=>{
 const plan=planTimelineZoom({next:10,zoom:100,playhead:200,scrollLeft:19900,viewport:1200});
 assert.equal(plan.scrollLeft,1900);assert.equal(plan.minWidth,3100);assert.equal(200*plan.zoom-plan.scrollLeft,100);
});
test('limits, timeline start and offscreen cursor are handled',()=>{
 const base={zoom:65,playhead:1,scrollLeft:0,viewport:1000};
 assert.equal(planTimelineZoom({...base,next:1}).scrollLeft,0);
 assert.equal(planTimelineZoom({...base,next:999}).zoom,400);
 const plan=planTimelineZoom({...base,playhead:175,next:80});assert.equal(175*80-plan.scrollLeft,500);
});
