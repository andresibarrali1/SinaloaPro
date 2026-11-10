import {descendants,trackPose,videoTracks} from './track-controls';
import { transitionJunctions } from './transition-drop';
import { applyCropFrame } from './crop-frame';
import { CompositeMode, CropMask, Event, Project, Transform, frameTicks, transform, envelope, pose, seconds, sourceTime } from './project';
import { fillFrame } from './letterbox';
import { MediaLibrary } from './media';
import { contentBox, frameBox, maskAt, sourceRect } from './pancrop';
import { AnimationState, TextPlan, animationState, layoutWords, planText, revealText, styleOf, textCase } from './titles';
import { CanvasFactory, activeEffects, applyEffects } from './effects';
import { applyMaskPath, maskActive } from './mask';
import { Quad, composeQuad, is3D, pose3D, projectQuadAt } from './threed';
import { applyTransitionTransform, maskTransition, transitionAlpha, transitionProgress } from './transitions';

// Modos de fusión de pista de VEGAS 15 con su equivalente exacto en Canvas 2D.
export const COMPOSITE_LABEL: Record<CompositeMode, string> = {
  normal: 'Normal (predeterminado)', add: 'Añadir', screen: 'Trama', multiply: 'Multiplicar',
  overlay: 'Superponer', darken: 'Oscurecer', lighten: 'Aclarar', difference: 'Diferencia',
};
const COMPOSITE_OPERATION: Record<CompositeMode, GlobalCompositeOperation> = {
  normal: 'source-over', add: 'lighter', screen: 'screen', multiply: 'multiply',
  overlay: 'overlay', darken: 'darken', lighten: 'lighten', difference: 'difference',
};
export const compositeOperation = (mode?: CompositeMode): GlobalCompositeOperation => COMPOSITE_OPERATION[mode ?? 'normal'] ?? 'source-over';

// La exportación y la vista previa piden el lienzo de trabajo de la misma forma; en las pruebas unitarias ese
// lienzo lo fabrica @napi-rs/canvas, así que la fábrica se puede inyectar.
export type ComposeOptions = { transparent?: boolean; adjustmentSource?: HTMLCanvasElement; createCanvas?: CanvasFactory; notes?: string[]; cancelled?: () => boolean };
const browserCanvas: CanvasFactory | null = typeof document === 'undefined' ? null : (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

type SpacedContext = CanvasRenderingContext2D & { letterSpacing?: string };

// La pose se aplica como matriz: giro y escala alrededor del centro de giro (el «Rotación → Centro X/Y» de
// la ventana de Panoramización y recorte) y después el desplazamiento. Sin centro de giro es el centro del
// fotograma, que es lo que hacía antes.
function applyPose(ctx:CanvasRenderingContext2D,p:Transform,w:number,h:number){
 const px=(p.pivot?.x??.5)*w,py=(p.pivot?.y??.5)*h;
 ctx.translate(px+p.x*w,py+p.y*h);ctx.rotate(p.rotation*Math.PI/180);ctx.scale(p.scale,p.scale);ctx.translate(-px,-py);
}

// Cuadrilátero proyectado de una capa que ya lleva su pose afín aplicada: el eje de giro pasa por el
// centro del plano, que es donde la matriz dejó el evento (o la pista). La pista y el evento tienen
// cada uno su giro 3D; para no proyectar dos veces la misma capa (que costaría el doble y acumularía
// error) se combinan los dos giros en una sola proyección. Es la aproximación que hace falta para
// mantener una única pasada por evento; en la práctica los dos giros casi nunca coinciden.
function layerQuad(track:Transform,pose:Transform,frame:{width:number;height:number}):Quad{
 const track3D=pose3D(track),event3D=pose3D(pose);
 // La capa lleva las dos matrices afines (pista y evento), así que su centro queda desplazado por las
 // dos posiciones; el eje de giro 3D pasa por ahí.
 const center={x:frame.width*(.5+track.x+pose.x),y:frame.height*(.5+track.y+pose.y)};
 return projectQuadAt({rotationX:track3D.rotationX+event3D.rotationX,rotationY:track3D.rotationY+event3D.rotationY,depth:Math.max(.1,Math.min(track3D.depth,event3D.depth))},frame,center);
}

// El recorte se aplica en la región de origen, conservando la proporción del medio y su sitio: con márgenes
// simétricos el resultado es idéntico al que producía el recorte uniforme anterior.
// El último parámetro es «Mantener relación de aspecto» **quitado**: el material se estira hasta llenar el
// fotograma (puede deformarse) en lugar de encajarse dentro dejando bandas.
function drawMedia(ctx:CanvasRenderingContext2D,image:CanvasImageSource,source:{width:number;height:number},frame:{width:number;height:number},mask:CropMask,stretch=false){
 const from=sourceRect(source,mask);
 // Estirar es llenar el fotograma entero (el recorte manda en los cuatro lados); encajar es la caja del contenido,
 // que conserva la proporción del material. `frameBox` devuelve fracciones del fotograma, así que aquí se
 // multiplica por su tamaño.
 const to=stretch
  ?{x:mask.left*frame.width,y:mask.top*frame.height,width:frame.width*(1-mask.left-mask.right),height:frame.height*(1-mask.top-mask.bottom)}
  :contentBox(frame,source,mask);
 if(from.width<=0||from.height<=0||to.width<=0||to.height<=0)return;
 ctx.drawImage(image,from.x,from.y,from.width,from.height,to.x,to.y,to.width,to.height);
}
function drawMissing(ctx:CanvasRenderingContext2D,name:string,w:number,h:number){
 ctx.filter='none';ctx.fillStyle='#35252a';ctx.fillRect(0,0,w,h);
 ctx.fillStyle='#efb4b4';ctx.font=`${Math.max(16,h/28)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.fillText(`Medio faltante: ${name}`,w/2,h/2);
}
// Generadores de medios: liso, degradado, tablero, barras de color y ruido (VEGAS los llama «Color sólido»,
// «Gradiente de color», «Tablero cuadriculado», «Patrón de pruebas» y «Textura de ruido»).
const BAR_COLORS=['#c0c0c0','#c0c000','#00c0c0','#00c000','#c000c0','#c00000','#0000c0','#101010'];
const noiseAt=(x:number,y:number)=>{let n=Math.imul(x,374761393)+Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
function paintGenerator(ctx:CanvasRenderingContext2D,event:Event,project:Project,w:number,h:number,mask:CropMask){
 const settings=event.generator??{kind:'solid' as const,color:event.color,color2:'#101010',angle:0,size:24,amount:.5};
 const scale=h/Math.max(1,project.height);
 const box=frameBox(mask);
 const x=box.x*w,y=box.y*h,width=box.width*w,height=box.height*h;
 if(width<=0||height<=0)return;
 ctx.save();
 ctx.beginPath();ctx.rect(x,y,width,height);ctx.clip();
 switch(settings.kind){
  case 'gradient':{
   const radians=(settings.angle??0)*Math.PI/180;
   const dx=Math.cos(radians)*width/2,dy=Math.sin(radians)*height/2;
   const gradient=ctx.createLinearGradient(x+width/2-dx,y+height/2-dy,x+width/2+dx,y+height/2+dy);
   gradient.addColorStop(0,settings.color);
   gradient.addColorStop(1,settings.color2);
   ctx.fillStyle=gradient;ctx.fillRect(x,y,width,height);
   break;
  }
  case 'checkerboard':{
   const cell=Math.max(2,(settings.size??24)*scale);
   ctx.fillStyle=settings.color;ctx.fillRect(x,y,width,height);
   ctx.fillStyle=settings.color2;
   for(let row=0;row*cell<height;row++)for(let col=row%2;col*cell<width;col+=2){
    ctx.fillRect(x+col*cell,y+row*cell,Math.min(cell,width-col*cell),Math.min(cell,height-row*cell));
   }
   break;
  }
  case 'bars':{
   const bar=width/BAR_COLORS.length;
   BAR_COLORS.forEach((color,index)=>{ctx.fillStyle=color;ctx.fillRect(x+index*bar,y,Math.ceil(bar),height);});
   break;
  }
  case 'noise':{
   const cell=Math.max(2,Math.round(6*scale));
   for(let row=0;row*cell<height;row++)for(let col=0;col*cell<width;col++){
    const value=Math.round(noiseAt(col,row)*255);
    ctx.fillStyle=`rgb(${value},${value},${value})`;
    ctx.fillRect(x+col*cell,y+row*cell,cell,cell);
   }
   break;
  }
  default:{ctx.fillStyle=event.color;ctx.fillRect(x,y,width,height);}
 }
 ctx.restore();
}
// El sombreado se gestiona en un solo sitio para que el contorno quede detrás del relleno, como en VEGAS.
function applyShadow(ctx:CanvasRenderingContext2D,event:Event,scale:number){
 const shadow=styleOf(event).shadow;
 if(!shadow.enabled){ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;return;}
 ctx.shadowColor=shadow.color;ctx.shadowBlur=shadow.blur*scale;ctx.shadowOffsetX=shadow.offsetX*scale;ctx.shadowOffsetY=shadow.offsetY*scale;
}
// Caja redondeada sin depender de `roundRect` (no está en todos los lienzos): cuatro tramos rectos y cuatro
// esquinas con curvas cuadráticas. El radio se recorta a la mitad del lado más corto.
function traceRoundedRect(ctx:CanvasRenderingContext2D,x:number,y:number,width:number,height:number,radius:number){
 const w=Math.max(0,width),h=Math.max(0,height),r=Math.max(0,Math.min(radius,Math.min(w,h)/2));
 ctx.beginPath();
 ctx.moveTo(x+r,y);
 ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
 ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
 ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
 ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
 ctx.closePath();
}
// Degradado del relleno del texto, medido sobre el bloque: el ángulo 0 va de izquierda a derecha y 90 de
// arriba abajo, como en las plantillas de diseño.
function textGradient(ctx:CanvasRenderingContext2D,plan:TextPlan,gradient:{from:string;to:string;angle:number}){
 const angle=(gradient.angle||0)*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
 const cx=plan.blockLeft+plan.blockWidth/2,cy=plan.blockTop+plan.blockHeight/2;
 const span=Math.abs(cos)*plan.blockWidth/2+Math.abs(sin)*plan.blockHeight/2;
 const fill=ctx.createLinearGradient(cx-cos*span,cy-sin*span,cx+cos*span,cy+sin*span);
 fill.addColorStop(0,gradient.from);fill.addColorStop(1,gradient.to);
 return fill;
}
const HEX_ALPHA=/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
function withAlpha(color:string,alpha:number){
 const match=HEX_ALPHA.exec(color);
 return match?`rgba(${parseInt(match[1],16)},${parseInt(match[2],16)},${parseInt(match[3],16)},${Math.max(0,Math.min(1,alpha))})`:color;
}
const easeGrow=(fraction:number)=>1-Math.pow(1-Math.max(0,Math.min(1,fraction)),3);
function drawText(ctx:CanvasRenderingContext2D,event:Event,plan:TextPlan,state:AnimationState,scale:number){
 const style=styleOf(event);
 const outline=style.outlineWidth*scale;
 const padding=style.background.padding*scale;
 const radius=(style.background.radius??0)*scale;
 if(state.opacity<1)ctx.globalAlpha*=Math.max(0,state.opacity);
 // La animación puede escalar y girar el bloque entero (las plantillas de redes): se hace alrededor de su
 // centro, así que el texto crece y gira sobre sí mismo sin moverse de sitio.
 const turning=state.scale!==1||state.rotation!==0;
 if(turning){
  const cx=plan.blockLeft+plan.blockWidth/2,cy=plan.blockTop+plan.blockHeight/2;
  ctx.save();ctx.translate(cx,cy);ctx.scale(state.scale,state.scale);ctx.rotate(state.rotation*Math.PI/180);ctx.translate(-cx,-cy);
 }
 ctx.font=plan.font;
 // Fondo: el bloque entero (como siempre) o una caja ajustada a cada línea, que es el look de «pastilla».
 if(style.background.opacity>0){
  ctx.save();ctx.globalAlpha*=style.background.opacity;ctx.shadowColor='transparent';ctx.shadowBlur=0;
  ctx.fillStyle=style.background.color;
  if(style.background.fit==='line'){
   plan.lines.forEach((line,index)=>{
    const lineWidth=ctx.measureText(line).width;
    const left=plan.align==='left'?plan.x:plan.align==='right'?plan.x-lineWidth:plan.x-lineWidth/2;
    const boxHeight=plan.lineHeight*.92;
    const top=plan.top+plan.lineHeight*(index+.5)-boxHeight/2;
    traceRoundedRect(ctx,left-padding,top,lineWidth+padding*2,boxHeight,radius);ctx.fill();
   });
  }else{
   traceRoundedRect(ctx,plan.blockLeft-padding,plan.blockTop-padding,plan.blockWidth+padding*2,plan.blockHeight+padding*2,radius);ctx.fill();
  }
  ctx.restore();
 }
 ctx.textAlign=plan.align;ctx.textBaseline='middle';
 const fill=style.gradient.enabled?textGradient(ctx,plan,style.gradient):event.color;
 const totalWords=plan.lines.reduce((total,line)=>total+line.split(/\s+/).filter(Boolean).length,0);
 const highlighted=state.highlight>=0?Math.floor(totalWords*Math.max(0,Math.min(1,state.highlight))):-1;
 const words=state.highlight>=0?layoutWords(plan.lines,(value)=>ctx.measureText(value).width,plan.align,plan.x,ctx.measureText(' ').width):[];
 let word0=0;
 plan.lines.forEach((line,index)=>{
  const y=plan.top+plan.lineHeight*(index+.5);
  if(outline>0){applyShadow(ctx,event,scale);ctx.lineWidth=outline;ctx.lineJoin='round';ctx.miterLimit=2;ctx.strokeStyle=style.outlineColor;ctx.strokeText(line,plan.x,y);}
  // El texto hueco solo deja ver el contorno: el relleno se salta.
  if(style.hollow){word0+=line.split(/\s+/).filter(Boolean).length;return;}
  if(!words.length){
   applyShadow(ctx,event,scale);
   ctx.fillStyle=fill;
   ctx.fillText(line,plan.x,y);
   return;
  }
  const count=line.split(/\s+/).filter(Boolean).length;
  const slice=words.slice(word0,word0+count);
  let paintedFill: string|CanvasGradient|null=null;
  slice.forEach((word,position)=>{
   const wordIndex=word0+position;
   const fraction=state.highlight>=0?Math.max(0,Math.min(1,state.highlight*totalWords-wordIndex)):0;
   // «Grow highlight»: la caja crece por detrás de la palabra activa y el texto pasa al color de acento.
   if(style.highlightBox&&fraction>0){
    const boxWidth=Math.max(2,(ctx.measureText(word.text).width+plan.size*.34)*easeGrow(fraction));
    const boxHeight=plan.size*1.42;
    ctx.save();ctx.shadowColor='transparent';ctx.shadowBlur=0;
    traceRoundedRect(ctx,word.left-plan.size*.17,y-boxHeight/2,boxWidth,boxHeight,Math.min(boxHeight*.32,plan.size*.3));
    ctx.fillStyle=withAlpha(style.highlightBoxColor,.92);ctx.fill();ctx.restore();
   }
   const color=style.highlightBox&&fraction>0?style.highlightTextColor:style.highlightBox?fill:wordIndex<highlighted?style.highlightColor:fill;
   if(color!==paintedFill){ctx.fillStyle=color;paintedFill=color;}
   applyShadow(ctx,event,scale);
   ctx.textAlign='left';
   ctx.fillText(word.text,word.left,y);
  });
  word0+=count;
  ctx.textAlign=plan.align;
 });
 ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
 if(turning)ctx.restore();
}
// El plan se calcula en coordenadas locales del fotograma: la posición, la escala y el giro del evento los
// aplica la matriz del contexto (igual que al medio), así que aquí solo entran los desplazamientos de la
// animación. Incluir aquí el `x`/`y` del evento los aplicaba dos veces y sacaba el texto del fotograma.
function textPlanFor(ctx:CanvasRenderingContext2D,event:Event,project:Project,at:Transform,state:AnimationState,w:number,h:number){
 const style=styleOf(event);
 const measure=(value:string,font:string)=>{ctx.font=font;return ctx.measureText(value).width;};
 return planText({
  text:revealText(textCase(event.text,style.uppercase),state.chars),
  font:event.font,fontSize:event.fontSize,align:event.align,bold:style.bold,italic:style.italic,
  lineSpacing:style.lineSpacing,wrap:style.wrap,anchor:event.anchor,
  x:state.dx/w,y:state.dy/h,
  project:{width:project.width,height:project.height},frame:{width:w,height:h},measure,
 });
}
// Duración del material del evento, en segundos: el bucle del evento la necesita para repetir el material.
function mediaSeconds(p:Project,event:Event):number{return seconds(p.media.find(item=>item.id===event.mediaId)?.duration??0);}
// Mezcla vertical de tres tomas sobre la capa del evento: la toma original al 50 % y las copias desplazadas un
// píxel arriba y abajo al 25 % cada una. Es la aproximación de este motor a «reducir parpadeo de entrelazado»:
// las líneas pares e impares de un material entrelazado dejan de saltar de una en una.
function reduceFlickerBlend(layer:HTMLCanvasElement,createCanvas:(w:number,h:number)=>HTMLCanvasElement,w:number,h:number){
 const copy=createCanvas(w,h),copyCtx=copy.getContext('2d');
 if(!copyCtx)return;
 copyCtx.globalAlpha=.5;copyCtx.drawImage(layer,0,0);
 copyCtx.globalAlpha=.25;copyCtx.drawImage(layer,0,1);copyCtx.drawImage(layer,0,-1);
 const ctx=layer.getContext('2d');
 if(!ctx)return;
 ctx.clearRect(0,0,w,h);ctx.globalAlpha=1;ctx.drawImage(copy,0,0);
}
// Dibuja el contenido del evento en coordenadas del fotograma: la posición, la escala y el giro los pone la
// matriz del contexto (y, cuando hay efectos, la capa se dibuja después dentro de esa misma matriz).
async function drawContent(ctx:CanvasRenderingContext2D,event:Event,project:Project,library:MediaLibrary,w:number,h:number,time:number,mask:CropMask,at:Transform,adjustmentSource?:HTMLCanvasElement){
 if(adjustmentSource){drawMedia(ctx,adjustmentSource,{width:w,height:h},{width:w,height:h},mask,false);return;}
 const scale=h/Math.max(1,project.height);
 if(event.kind==='text'){
  const spaced=ctx as SpacedContext;
  if('letterSpacing' in spaced)spaced.letterSpacing=`${styleOf(event).tracking*scale}px`;
  const state=animationState(styleOf(event).animation,time-event.start,event.duration,{width:w,height:h});
  drawText(ctx,event,textPlanFor(ctx,event,project,at,state,w,h),state,scale);
  if('letterSpacing' in spaced)spaced.letterSpacing='0px';
  return;
 }
 if(event.kind==='color'){paintGenerator(ctx,event,project,w,h,mask);return;}
 const runtime=library.items.get(event.mediaId||'');
 if(!runtime){drawMissing(ctx,event.name,w,h);return;}
 const image=runtime.image || (await runtime.canvas?.getCanvas(Math.max(runtime.firstVideo,sourceTime(event,time-event.start,mediaSeconds(project,event),project.fps))))?.canvas;
 if(image)drawMedia(ctx,image,{width:image.width,height:image.height},{width:w,height:h},mask,event.maintainAspect===false);
}

// One pass per frame: events are grouped by track once instead of filtering the whole list per track, and
// neutral color filters are skipped because setting ctx.filter forces a slow drawing path in every browser.
export async function compose(canvas:HTMLCanvasElement,p:Project,library:MediaLibrary,time:number,options:ComposeOptions={}){
 const ctx=canvas.getContext('2d',{alpha:options.transparent??false})!;const w=canvas.width,h=canvas.height;ctx.resetTransform();ctx.globalAlpha=1;ctx.filter='none';ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,w,h);if(!options.transparent){ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);}
 const createCanvas=options.createCanvas??browserCanvas??undefined;
 const note=(message:string)=>{if(options.notes&&!options.notes.includes(message))options.notes.push(message);};
 // Una sola capa de trabajo para todos los eventos del fotograma: se limpia antes de dibujar cada uno, así que
 // reaprovecharla da los mismos píxeles y evita crear una capa del tamaño del fotograma por evento.
 let sharedLayer:HTMLCanvasElement|null=null;
 const byTrack=new Map<string,typeof p.events>();
 for(const e of p.events)if(time>=e.start&&time<e.start+e.duration){const list=byTrack.get(e.trackId);list?list.push(e):byTrack.set(e.trackId,[e]);}
 const heldTimes=new Map<string,number>();
 for(const [trackId,active] of byTrack){
  for(const incoming of [...active]){
   if(!incoming.transition || incoming.fadeIn<=0 || time>=incoming.start+incoming.fadeIn)continue;
   const pair=transitionJunctions(p.events.filter(e=>e.trackId===trackId),p.fps,true).find(pair=>pair.next.id===incoming.id);
   if(!pair || active.some(e=>e.id===pair.previous.id) || pair.previous.muted)continue;
   const outgoing={...pair.previous,fadeIn:0,fadeOut:0,transition:undefined,transitionOut:undefined};
   heldTimes.set(outgoing.id,Math.max(outgoing.start,outgoing.start+outgoing.duration-1));active.push(outgoing);
  }
 }
 const visible=videoTracks(p);
 for(const storedTrack of [...visible].reverse()){
  if(storedTrack.parentId&&visible.some(t=>t.id===storedTrack.parentId))continue;
  const track={...storedTrack,transform:trackPose(storedTrack,time)};
  const children=descendants(visible,track.id);
  const trackEffects=activeEffects(track.effects);
  const blur=track.bypassMotionBlur?0:(track.motionBlurFrames??0);
  if((children.length||trackEffects.length||blur>0)&&createCanvas){
   // Isolate the track/group before applying its effects, motion and blend mode.
   const ids=new Set([track.id,...children.map(t=>t.id)]);
   const innerTracks=visible.filter(t=>ids.has(t.id)).map(t=>t.id===track.id
    ?{...t,parentId:undefined,transform:transform(),keys:[],effects:[],motionBlurFrames:0,composite:'normal' as const,solo:false}
    :{...t,parentId:t.parentId===track.id?undefined:t.parentId,solo:false});
   const inner={...p,tracks:innerTracks,events:p.events.filter(e=>ids.has(e.trackId))};
   const samples=blur>0?5:1,accumulated=createCanvas(w,h),acc=accumulated.getContext('2d')!;
   for(let sample=0;sample<samples;sample++){
    if(options.cancelled?.())return;
    const at=Math.max(0,time-(samples===1?0:blur*frameTicks(p.fps)*sample/(samples-1)));
    const layer=createCanvas(w,h);
    await compose(layer,inner,library,at,{...options,transparent:true});
    if(options.cancelled?.())return;
    if(trackEffects.length)applyEffects(layer,trackEffects,{scale:h/Math.max(1,p.height),createCanvas,note});
    const motion=trackPose(storedTrack,at);
    acc.save();acc.globalCompositeOperation='lighter';acc.globalAlpha=Math.max(0,Math.min(1,motion.opacity))/samples;
    if(is3D(motion)){composeQuad(acc,layer,layerQuad(motion,transform(),{width:w,height:h}),{createCanvas});}
    else{applyPose(acc,motion,w,h);if(motion.cropFrame)applyCropFrame(acc,motion.cropFrame,w,h);acc.drawImage(layer,0,0);}
    acc.restore();
   }
   ctx.save();ctx.globalCompositeOperation=compositeOperation(track.composite);ctx.drawImage(accumulated,0,0);ctx.restore();
   continue;
  }
  const events=byTrack.get(track.id);if(!events)continue;
  if(events.length>1)events.sort((a,b)=>Number(Boolean(b.adjustmentLayer))-Number(Boolean(a.adjustmentLayer))||a.start-b.start);
  ctx.globalCompositeOperation=compositeOperation(track.composite); // modo de fusión de la pista
  for(const e of events){if(options.cancelled?.())return;
   if(e.adjustmentLayer){
    if(e.muted)continue;
    if(!createCanvas)throw new Error('La capa de efectos necesita un lienzo de composición.');
    const strength=Math.max(0,Math.min(1,pose(e,time).opacity*track.transform.opacity*envelope(e,time)*(e.videoOpacity??1)));
    if(strength===0)continue;
    const source=createCanvas(w,h);source.getContext('2d')!.drawImage(canvas,0,0);
    const adjusted=createCanvas(w,h);
    const layerEvent={...e,adjustmentLayer:false,videoOpacity:1,fadeIn:0,fadeOut:0,gainCurve:undefined,transition:undefined,transitionOut:undefined,
     transform:{...e.transform,opacity:1},keys:e.keys.map(key=>({...key,opacity:1}))};
    await compose(adjusted,{...p,tracks:[{...track,keys:[],mute:false,solo:false,composite:'normal',transform:{...track.transform,opacity:1}}],events:[layerEvent]},library,time,{...options,adjustmentSource:source});
    if(options.cancelled?.())return;
    ctx.save();ctx.resetTransform();ctx.globalCompositeOperation='source-over';ctx.filter='none';ctx.globalAlpha=strength;ctx.drawImage(adjusted,0,0);ctx.restore();
    continue;
   }
const eventTime=heldTimes.get(e.id)??time;const local=eventTime-e.start; // A crossfade keeps the outgoing image fully opaque beneath the incoming layer.
   // «Extender para rellenar f.» del grupo «Origen» de la ventana de Panoramización y recorte: con la casilla
   // puesta, el material se escala hasta cubrir el fotograma del proyecto (sin deformar) y el recorte sigue
   // mandando. Es el mismo encaje que la acción «Encajar el contenido al fotograma».
   const mediaRecord=p.media.find(item=>item.id===e.mediaId);
   const at=e.maintainAspect!==false&&e.stretchFill&&mediaRecord&&mediaRecord.width>0&&mediaRecord.height>0
    ? fillFrame({project:{width:p.width,height:p.height},media:{width:mediaRecord.width,height:mediaRecord.height},pose:pose(e,eventTime)})
    : pose(e,eventTime);
   // La transición de un evento puede ser su **entrada** (ocupa su `fadeIn`) o su **salida** (ocupa su
   // `fadeOut`). La de salida se dibuja con el progreso espejado, así el mismo catálogo de transiciones sirve
   // para los dos bordes del clip y el corte se ve igual entrando por un lado que por el otro.
   const entrance=e.transition&&e.fadeIn>0?transitionProgress(local,e.fadeIn):null;
   const exit=e.transitionOut&&e.fadeOut>0?transitionProgress(e.duration-local,e.fadeOut):null;
   const transitionKind=entrance!==null?e.transition:exit!==null?e.transitionOut:undefined;
   const transition=entrance!==null?entrance:exit!==null?1-exit:null;
   let opacity=entrance!==null?Math.max(0,Math.min(1,e.fadeOut?(e.duration-local)/e.fadeOut:1)):exit!==null?1:envelope(e,eventTime);
   if(e.fadeOut&&events.some(other=>other.start>e.start&&other.fadeIn>0&&time<other.start+other.fadeIn))opacity=e.fadeIn?Math.min(1,(time-e.start)/e.fadeIn):1;
   const track3D=is3D(track.transform);
   const event3D=is3D(at);
   const warped3D=track3D||event3D;
   ctx.save();
   // En 3D el evento se pinta primero en su capa (ya con la matriz de su pose, que es afín) y la capa
   // se proyecta después con la rejilla de celdas: aquí no se aplica la pose como matriz porque la
   // proyección la sustituye.
   if(!warped3D){applyPose(ctx,track.transform,w,h);if(at.cropFrame)applyCropFrame(ctx,at.cropFrame,w,h);applyPose(ctx,at,w,h);}
   ctx.globalAlpha=Math.max(0,Math.min(1,at.opacity*track.transform.opacity*opacity*(e.videoOpacity??1)));
   const graded=e.brightness!==1||e.contrast!==1||e.saturation!==1||e.hue!==0;
   const grade=graded?`brightness(${e.brightness}) contrast(${e.contrast}) saturate(${e.saturation}) hue-rotate(${e.hue}deg)`:'none';
   const mask=maskAt(e,local);
   const effects=activeEffects(e.effects);
   const masked=maskActive(e.maskPath);
   const needsLayer=Boolean((effects.length||transition!==null||masked||warped3D||e.reduceFlicker)&&createCanvas);if(needsLayer&&!sharedLayer)sharedLayer=(createCanvas as NonNullable<typeof createCanvas>)(w,h);const layer=needsLayer?sharedLayer:null;
   const layerCtx=layer?layer.getContext('2d'):null;
   if(layer&&layerCtx){
    // Con efectos, transición o 3D, el evento se pinta primero en su propia capa transparente: así el
    // desenfoque, la clave cromática o el barrido trabajan sobre los píxeles del evento y no sobre el
    // fotograma compuesto, y el giro 3D deforma la capa entera con su transparencia.
    layerCtx.clearRect(0,0,w,h);layerCtx.filter=grade;
    if(warped3D){applyPose(layerCtx,track.transform,w,h);if(at.cropFrame)applyCropFrame(layerCtx,at.cropFrame,w,h);applyPose(layerCtx,at,w,h);}
    await drawContent(layerCtx,e,p,library,w,h,eventTime,mask,at,options.adjustmentSource);
    if(options.cancelled?.()){ctx.restore();return;}
    layerCtx.filter='none';
    // «Reducir parpadeo de entrelazado»: mezcla vertical de tres tomas (la capa copiada un píxel arriba y un
    // píxel abajo) sobre la capa del evento, sin tocar el resto del fotograma.
    if(e.reduceFlicker&&createCanvas)reduceFlickerBlend(layer,createCanvas,w,h);
    if(effects.length)applyEffects(layer,effects,{scale:h/Math.max(1,p.height),createCanvas:createCanvas as NonNullable<typeof createCanvas>,note,time:seconds(time)});
    // La máscara libre recorta la forma del evento; la transición, si la hay, lo revela después.
    if(masked&&e.maskPath)applyMaskPath(layer,e.maskPath,{width:w,height:h,scale:h/Math.max(1,p.height),createCanvas:createCanvas as NonNullable<typeof createCanvas>,note});
    ctx.filter='none';
    if(transition!==null&&transitionKind)ctx.globalAlpha*=transitionAlpha(transitionKind,transition);
    if(warped3D&&createCanvas){
     const projected=layerQuad(track.transform,at,{width:w,height:h});
     ctx.save();
     if(transition!==null&&transitionKind){applyTransitionTransform(ctx,transitionKind,transition,w,h);maskTransition(layer,transitionKind,transition,w,h);}
     composeQuad(ctx,layer,projected,{createCanvas:createCanvas as NonNullable<typeof createCanvas>});
     ctx.restore();
    }else if(transition!==null&&transitionKind){
     maskTransition(layer,transitionKind,transition,w,h);
     ctx.save();applyTransitionTransform(ctx,transitionKind,transition,w,h);ctx.drawImage(layer,0,0);ctx.restore();
    }else ctx.drawImage(layer,0,0);
   }else{
    ctx.filter=grade;
    await drawContent(ctx,e,p,library,w,h,eventTime,mask,at,options.adjustmentSource);
    if(options.cancelled?.()){ctx.restore();return;}
    ctx.filter='none';
   }
   ctx.restore();
  }
  ctx.globalCompositeOperation='source-over';
 }
}
