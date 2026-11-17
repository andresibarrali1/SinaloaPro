import type {TrackingData,TrackPoint,VideoEffect} from './project';
export type Box={x:number;y:number;w:number;h:number};
export function screenBox(a:{x:number;y:number},b:{x:number;y:number},display:{width:number;height:number},video:{width:number;height:number}):Box{
 const x1=Math.max(0,Math.min(display.width,Math.min(a.x,b.x))),y1=Math.max(0,Math.min(display.height,Math.min(a.y,b.y)));
 const x2=Math.max(0,Math.min(display.width,Math.max(a.x,b.x))),y2=Math.max(0,Math.min(display.height,Math.max(a.y,b.y)));
 return {x:x1*video.width/display.width,y:y1*video.height/display.height,w:(x2-x1)*video.width/display.width,h:(y2-y1)*video.height/display.height};
}
const cache=new WeakMap<TrackingData,{smooth:number;points:TrackPoint[]}>();
function pointsOf(data:TrackingData,smooth:number){
 if(smooth<=0)return data.points;
 const prior=cache.get(data);if(prior?.smooth===smooth)return prior.points;
 const alpha=1-Math.min(.95,Math.max(0,smooth));let previous:TrackPoint|undefined;
 const points=data.points.map(point=>{const next=point.ok&&previous?.ok?{...point,x:previous.x+(point.x-previous.x)*alpha,y:previous.y+(point.y-previous.y)*alpha,w:previous.w+(point.w-previous.w)*alpha,h:previous.h+(point.h-previous.h)*alpha}:point;previous=next;return next;});
 cache.set(data,{smooth,points});return points;
}
export function trackingPoint(data:TrackingData,time:number,smooth=0):TrackPoint|null{
 const pts=pointsOf(data,smooth);if(!pts.length||time<pts[0].time||time>pts[pts.length-1].time+1/data.fps)return null;
 let lo=0,hi=pts.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(pts[mid].time<=time)lo=mid;else hi=mid-1;}
 const a=pts[lo],b=pts[lo+1];if(!a.ok)return null;
 if(!b?.ok)return a;
 const f=Math.max(0,Math.min(1,(time-a.time)/(b.time-a.time)));return {...a,x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,w:a.w+(b.w-a.w)*f,h:a.h+(b.h-a.h)*f};
}
export function drawTracking(ctx:CanvasRenderingContext2D,effects:VideoEffect[],time:number,width:number,height:number){
 for(const effect of effects){if(effect.kind!=='tracking'||effect.trackingMode==='camera'||!effect.enabled||!effect.trackingData)continue;
 const data=effect.trackingData,p=trackingPoint(data,time,effect.softness);if(!p)continue;
 ctx.save();ctx.strokeStyle=effect.color;ctx.lineWidth=Math.max(1,effect.size*height/data.height);ctx.strokeRect(p.x*width/data.width,p.y*height/data.height,p.w*width/data.width,p.h*height/data.height);ctx.restore();}
}

/** Source-space camera. Clamp at image edges to avoid introducing empty borders.
 * Lost detections hold the last valid camera, instead of jumping to the full shot. */
const goodPoints=new WeakMap<TrackingData,TrackingData>();
export function trackingCamera(effect:VideoEffect,time:number,aspect:number):Box|null{
 const data=effect.trackingData;if(!data||!effect.enabled||effect.trackingMode!=='camera')return null;
 let p=trackingPoint(data,time,effect.softness);
 if(!p){let good=goodPoints.get(data);if(!good){good={...data,points:data.points.filter(p=>p.ok)};goodPoints.set(data,good);}
  let lo=0,hi=good.points.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(good.points[mid].time<=time)lo=mid;else hi=mid-1;}
  const previous=good.points[lo];if(!previous||previous.time>time)return null;p=trackingPoint(data,previous.time,effect.softness);}
 if(!p)return null;
 const baseW=Math.min(data.width,data.height*aspect),baseH=baseW/aspect;
 // Zoom is a maximum: ease back enough to keep the selected box plus 20% margin visible.
 const zoom=Math.max(1,Math.min(8,effect.trackingZoom??1.5,baseW/(p.w*1.2),baseH/(p.h*1.2)));
 const w=baseW/zoom,h=baseH/zoom;
 return {x:Math.max(0,Math.min(data.width-w,p.x+p.w/2-w/2)),y:Math.max(0,Math.min(data.height-h,p.y+p.h/2-h/2)),w,h};
}
