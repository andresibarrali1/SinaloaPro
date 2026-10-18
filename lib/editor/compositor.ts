import { applyCropFrame } from './crop-frame';
import { CompositeMode, CropMask, Event, Project, Transform, activeTracks, envelope, pose, seconds, sourceTime } from './project';
import { fillFrame } from './letterbox';
import { MediaLibrary } from './media';
import { contentBox, frameBox, maskAt, sourceRect } from './pancrop';
import { AnimationState, TextPlan, animationState, highlightedWords, layoutWords, planText, revealText, styleOf } from './titles';
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
export type ComposeOptions = { createCanvas?: CanvasFactory; notes?: string[] };
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
function drawText(ctx:CanvasRenderingContext2D,event:Event,plan:TextPlan,state:AnimationState,scale:number){
 const style=styleOf(event);
 const outline=style.outlineWidth*scale;
 const padding=style.background.padding*scale;
 if(state.opacity<1)ctx.globalAlpha*=Math.max(0,state.opacity);
 // La animación puede escalar y girar el bloque entero (las plantillas de redes): se hace alrededor de su
 // centro, así que el texto crece y gira sobre sí mismo sin moverse de sitio.
 const turning=state.scale!==1||state.rotation!==0;
 if(turning){
  const cx=plan.blockLeft+plan.blockWidth/2,cy=plan.blockTop+plan.blockHeight/2;
  ctx.save();ctx.translate(cx,cy);ctx.scale(state.scale,state.scale);ctx.rotate(state.rotation*Math.PI/180);ctx.translate(-cx,-cy);
 }
 if(style.background.opacity>0){
  ctx.save();ctx.globalAlpha*=style.background.opacity;ctx.shadowColor='transparent';ctx.shadowBlur=0;
  ctx.fillStyle=style.background.color;
  ctx.fillRect(plan.blockLeft-padding,plan.blockTop-padding,plan.blockWidth+padding*2,plan.blockHeight+padding*2);
  ctx.restore();
 }
 ctx.font=plan.font;ctx.textAlign=plan.align;ctx.textBaseline='middle';ctx.fillStyle=event.color;
 // Karaoke: las palabras ya «cantadas» se pintan con el color de resalte. Se pintan palabra a palabra para
 // poder cambiar de color a mitad de línea; sin karaoke se pinta la línea entera de una vez.
 const lit=highlightedWords(revealText(event.text,state.chars),state.highlight);
 const words=lit>=0?layoutWords(plan.lines,(value)=>ctx.measureText(value).width,plan.align,plan.x,ctx.measureText(' ').width):[];
 let word0=0;
 plan.lines.forEach((line,index)=>{
  const y=plan.top+plan.lineHeight*(index+.5);
  if(outline>0){applyShadow(ctx,event,scale);ctx.lineWidth=outline;ctx.lineJoin='round';ctx.miterLimit=2;ctx.strokeStyle=style.outlineColor;ctx.strokeText(line,plan.x,y);}
  if(!words.length){
   applyShadow(ctx,event,scale);
   ctx.fillStyle=event.color;
   ctx.fillText(line,plan.x,y);
   return;
  }
  const count=line.split(/\s+/).filter(Boolean).length;
  const slice=words.slice(word0,word0+count);
  let painted: boolean | null = null;
  slice.forEach((word,position)=>{
   const on=word0+position<lit;
   if(on!==painted){ctx.fillStyle=on?style.highlightColor:event.color;painted=on;}
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
  text:revealText(event.text,state.chars),
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
async function drawContent(ctx:CanvasRenderingContext2D,event:Event,project:Project,library:MediaLibrary,w:number,h:number,time:number,mask:CropMask,at:Transform){
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
 const ctx=canvas.getContext('2d',{alpha:false})!;const w=canvas.width,h=canvas.height;ctx.resetTransform();ctx.globalAlpha=1;ctx.filter='none';ctx.globalCompositeOperation='source-over';ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
 const createCanvas=options.createCanvas??browserCanvas??undefined;
 const note=(message:string)=>{if(options.notes&&!options.notes.includes(message))options.notes.push(message);};
 // Una sola capa de trabajo para todos los eventos del fotograma: se limpia antes de dibujar cada uno, así que
 // reaprovecharla da los mismos píxeles y evita crear una capa del tamaño del fotograma por evento.
 let sharedLayer:HTMLCanvasElement|null=null;
 const byTrack=new Map<string,typeof p.events>();
 for(const e of p.events)if(time>=e.start&&time<e.start+e.duration){const list=byTrack.get(e.trackId);list?list.push(e):byTrack.set(e.trackId,[e]);}
 for(const track of activeTracks(p,'video').reverse()){
  const events=byTrack.get(track.id);if(!events)continue;
  if(events.length>1)events.sort((a,b)=>a.start-b.start);
  ctx.globalCompositeOperation=compositeOperation(track.composite); // modo de fusión de la pista
  for(const e of events){const local=time-e.start; // A crossfade keeps the outgoing image fully opaque beneath the incoming layer.
   // «Extender para rellenar f.» del grupo «Origen» de la ventana de Panoramización y recorte: con la casilla
   // puesta, el material se escala hasta cubrir el fotograma del proyecto (sin deformar) y el recorte sigue
   // mandando. Es el mismo encaje que la acción «Encajar el contenido al fotograma».
   const mediaRecord=p.media.find(item=>item.id===e.mediaId);
   const at=e.maintainAspect!==false&&e.stretchFill&&mediaRecord&&mediaRecord.width>0&&mediaRecord.height>0
    ? fillFrame({project:{width:p.width,height:p.height},media:{width:mediaRecord.width,height:mediaRecord.height},pose:pose(e,time)})
    : pose(e,time);
   // La transición de un evento es su entrada: ocupa su `fadeIn` y sustituye a la rampa lineal.
   const transition=e.transition&&e.fadeIn>0?transitionProgress(local,e.fadeIn):null;
   let opacity=transition!==null?Math.max(0,Math.min(1,e.fadeOut?(e.duration-local)/e.fadeOut:1)):envelope(e,time);
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
    await drawContent(layerCtx,e,p,library,w,h,time,mask,at);
    layerCtx.filter='none';
    // «Reducir parpadeo de entrelazado»: mezcla vertical de tres tomas (la capa copiada un píxel arriba y un
    // píxel abajo) sobre la capa del evento, sin tocar el resto del fotograma.
    if(e.reduceFlicker&&createCanvas)reduceFlickerBlend(layer,createCanvas,w,h);
    if(effects.length)applyEffects(layer,effects,{scale:h/Math.max(1,p.height),createCanvas:createCanvas as NonNullable<typeof createCanvas>,note});
    // La máscara libre recorta la forma del evento; la transición, si la hay, lo revela después.
    if(masked&&e.maskPath)applyMaskPath(layer,e.maskPath,{width:w,height:h,scale:h/Math.max(1,p.height),createCanvas:createCanvas as NonNullable<typeof createCanvas>,note});
    ctx.filter='none';
    if(transition!==null&&e.transition)ctx.globalAlpha*=transitionAlpha(e.transition,transition);
    if(warped3D&&createCanvas){
     const projected=layerQuad(track.transform,at,{width:w,height:h});
     ctx.save();
     if(transition!==null&&e.transition){applyTransitionTransform(ctx,e.transition,transition,w,h);maskTransition(layer,e.transition,transition,w,h);}
     composeQuad(ctx,layer,projected,{createCanvas:createCanvas as NonNullable<typeof createCanvas>});
     ctx.restore();
    }else if(transition!==null&&e.transition){
     maskTransition(layer,e.transition,transition,w,h);
     ctx.save();applyTransitionTransform(ctx,e.transition,transition,w,h);ctx.drawImage(layer,0,0);ctx.restore();
    }else ctx.drawImage(layer,0,0);
   }else{
    ctx.filter=grade;
    await drawContent(ctx,e,p,library,w,h,time,mask,at);
    ctx.filter='none';
   }
   ctx.restore();
  }
  ctx.globalCompositeOperation='source-over';
 }
}
