export type ZoomAnchor={time:number;pointerX:number};
export const minimumTimelineZoom=(span:number,viewport:number)=>Math.min(10,Math.max(1,viewport)/Math.max(1,span));
export function timelineTickStep(zoom:number){const target=80/Math.max(Number.EPSILON,zoom),power=10**Math.floor(Math.log10(target));return ([1,2,5,10].find(n=>n*power>=target)??10)*power;}
export function planTimelineZoom(input:{next:number;zoom:number;playhead:number;scrollLeft:number;viewport:number;span?:number;pending?:ZoomAnchor|null}){
 const minimum=input.span===undefined?10:minimumTimelineZoom(input.span,input.viewport);
 const zoom=Math.max(minimum,Math.min(400,input.next));
 const fit=input.span!==undefined&&zoom<=minimum*(1+1e-9);
 if(fit)return {zoom,anchor:{time:input.playhead,pointerX:input.playhead*zoom},scrollLeft:0,minWidth:input.viewport,fit:true};
 const screenX=input.playhead*input.zoom-input.scrollLeft;
 // An offscreen cursor is brought back to the middle of the viewport.
 const anchor=input.pending??{time:input.playhead,pointerX:screenX>=0&&screenX<=input.viewport?screenX:input.viewport/2};
 const scrollLeft=Math.max(0,anchor.time*zoom-anchor.pointerX);
 return {zoom,anchor,scrollLeft,minWidth:Math.ceil(scrollLeft+input.viewport),fit:false};
}
