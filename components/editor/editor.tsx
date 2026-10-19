'use client';
import { LatestPreview } from '@/lib/editor/latest-preview';
import { useCallback,useEffect,useLayoutEffect,useRef,useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { FilePlus,FolderOpen,Save,Undo2,Redo2,Scissors,Copy,Clipboard,Trash2,Magnet,Repeat2,Play,Pause,Square,SkipBack,SkipForward,StepBack,StepForward,Film,Music,Type,Plus,Settings,Download,Link,ZoomIn,ZoomOut,HelpCircle,SlidersHorizontal,Folder,Search,Palette,Flag } from 'lucide-react';
import { Tabs,TabsList,TabsTrigger,TabsContent } from '@/components/ui/tabs';
import { Dialog,DialogContent,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem,DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { registerProjectTool } from '@/lib/editor/webmcp';
import { WorkspaceMenu,WorkspaceMenuItem } from './workspace-menu';
import { EventProperties } from './event-properties';
import { Progress } from '@/components/ui/progress';
import { Tool,Choice,Range,Field,Check } from './controls';
import { Project,Event,Media,Track,Transform,CropMask,History,newProject,newTrack,newEvent,clone,ticks,seconds,frameTicks,quantize,uid,endTime,pose,split,trim,removeEvents,linkedIds,autoCrossfade,parseProject,selectionRange,Ripple,slip,slide,rippleTrimToCursor,rippleMove,threePointEdit,generator as mediaGenerator,GeneratorKind,VideoEffectKind,TransitionKind,AudioBus,AudioPoint,MaskPath,newBus,normalizeRange,playbackSpan,RESAMPLE_LABEL,ResampleMode,syncEvents,toggleReverse,lockedIds } from '@/lib/editor/project';
import { MediaLibrary } from '@/lib/editor/media';
import { compose } from '@/lib/editor/compositor';
import { PlaybackAudio } from '@/lib/editor/audio';
import { TIMECODE_FORMATS, TIMECODE_LABEL, TIMECODE_NOTE, TimecodeFormat, driftSeconds, formatShortTimecode, formatTimecode, effectiveFormat, isDropFrameRate, parseTimecode } from '@/lib/editor/timecode';
import { capabilities,renderProject,suggestedBitrate,plannedFrames,resolveRange,QUALITY_LABEL,ExportSettings,ExportProgress,ExportQuality,ExportFormat } from '@/lib/editor/export';
import { BatchJob,BATCH_STATUS_LABEL,appendJobs,audioTrackJobs,fileNameFor,jobProject,settingsProblem,summarize,variantSettings } from '@/lib/editor/batch';
import { detectInterchange,parseInterchange,VEG_EXPLANATION,ImportReport } from '@/lib/editor/interchange';
import { analyzeVeg,VEG_LIMITS,VegAnalysis } from '@/lib/editor/veg';
import { readVegWithVegas,writeVegWithVegas,bridgeStatus,VEG_BRIDGE_HELP,VegTimelineReport,BridgeStatus } from '@/lib/editor/veg-bridge';
import { PanCropWindow } from './pan-crop';
import { TimelineEventRow,type TimelineActions } from './timeline-event-row';
import { PreviewOverlay } from './preview-overlay';
import { TitlesWindow } from './titles';
import {planTimelineZoom,minimumTimelineZoom,timelineTickStep} from '@/lib/editor/timeline-zoom';
import {frameThrottle} from '@/lib/editor/frame-throttle';
import {describeMediaDrop,planMediaDrop} from '@/lib/editor/drop-targets';
import {describeTransitionDrop,planTransitionDrop} from '@/lib/editor/transition-drop';
import {setEventOpacity} from '@/lib/editor/event-opacity';
import { Meters } from './meters';
import { createMeterStore, SILENT_READING } from '@/lib/editor/meter-store';
import { EffectsWindow } from './effects';
import { Mixer } from './mixer';
import { EnvelopeLane,EnvelopeMode } from './envelope';
import { Trimmer } from './trimmer';
import { EFFECT_DESCRIPTION,EFFECT_KINDS,EFFECT_LABEL,defaultEffect } from '@/lib/editor/effects';
import { TRANSITION_GROUP,TRANSITION_KINDS,TRANSITION_GROUPS,TRANSITION_LABEL,TRANSITION_NOTE } from '@/lib/editor/transitions';
import { transcribe,buildSrt,parseSrt,renderSpeechAudio,keywords,resourceTerms,planResourcePlacements,Cue } from '@/lib/editor/speech';
import { addSubtitles } from '@/lib/editor/subtitles';
import { searchVideos,pickFile,downloadFile,pexelsFileName,attribution } from '@/lib/editor/pexels';
import { saveLocal,recover,downloadProject,download,storeFile,readFile,storageHeadroom } from '@/lib/editor/storage';
import { applyProjectTemplate,describeFormat,detectTemplate,templateById,templateItems } from '@/lib/editor/templates';
import { AttributeGroupId,attributeCount,copyAttributes,describeAttributes,groupById,groupFits,groupsFor,pasteAttributes,pasteableGroups,CopiedAttributes } from '@/lib/editor/attributes';
import { upsertKey } from '@/lib/editor/pancrop';
import { barsToMask,describeBars,describeFit,detectBars,fillFrame,fitFrame } from '@/lib/editor/letterbox';
import { MARKER_FORMATS,buildMarkerExport,markerFormatById,type MarkerExportFormat } from '@/lib/editor/chapters';
const fpsOptions:[string,string][]=[['24/1','24'],['25/1','25'],['30/1','30'],['30000/1001','29.970 (30000/1001)'],['24000/1001','23.976 (24000/1001)'],['50/1','50'],['60/1','60'],['60000/1001','59.940 (60000/1001)']];
// Franja de la regla, en píxeles desde su borde de arriba, que mueve la aguja al arrastrar. La regla mide 46 px
// y la aguja se dibuja en esa franja: por debajo de esta altura se agarra la aguja, por encima se marca el tramo.
const RULER_SCRUB_BAND = 24;
// Límites del zoom de la vista previa (rueda del ratón o los botones del panel).
const PREVIEW_MIN_ZOOM = .25, PREVIEW_MAX_ZOOM = 8;
// Radio, en píxeles, alrededor de la aguja en la regla que la agarra para moverla en vez de marcar el tramo.
const PLAYHEAD_GRAB_PIXELS = 7;
// Cada cuánto se sincroniza el estado de React con la reproducción. El bucle actualiza la aguja, el timecode y el
// monitor en cada fotograma (por referencia, sin re-renderizar); el estado se pone al día cuatro veces por
// segundo, que es de sobra para los diálogos, la barra de estado y cualquier otra vista que lea el cursor.
const CURSOR_SYNC_TICKS = 176400000;      // 0,25 s en la base de tiempo del proyecto
// Icono del complemento de texto, como el que VEGAS pone en la barra del evento: una pantalla con la página de
// texto delante (la primera chapa de la imagen de referencia). Es el botón que abre el editor de texto.
// Los dos tipos de dato que se pueden soltar sobre la línea de tiempo.
const MEDIA_DRAG='application/corte15-media',TRANSITION_DRAG='application/corte15-transition';
const fpsValue=(p:{fps:{num:number;den:number}})=>`${p.fps.num}/${p.fps.den}`;
const readFps=(v:string)=>{const [num,den]=v.split('/').map(Number);return {num,den};};
// Aviso del formato de timecode elegido: si no admite descarte, o si el descarte no vale para esta velocidad.
const effectiveNote=(project:{fps:{num:number;den:number};timecodeFormat?:TimecodeFormat})=>{
  const chosen=project.timecodeFormat??'non-drop';
  if(chosen==='drop-frame'&&!isDropFrameRate(project.fps))return ' Esta velocidad no admite descarte (solo 29,97 y 59,94 fps), así que se muestra sin descarte.';
  if(effectiveFormat(chosen,project.fps)==='non-drop'&&isDropFrameRate(project.fps)){
    const drift=Math.abs(driftSeconds(ticks(3600),project.fps,'non-drop'));
    return ` A una hora de proyecto, este formato va ${drift.toFixed(2)} s por detrás del reloj real: el descarte existe para eso.`;
  }
  return '';
};
// Lectura de medidores en reposo: vive en `meter-store`, junto al almacén, porque la comparten el editor y el
// panel de medidores.
// Pose neutra, para cuando no hay nada seleccionado que redimensionar en la vista previa.
const NEUTRAL_POSE:Transform={x:0,y:0,scale:1,rotation:0,opacity:1,crop:0};
export default function Editor(){
 const [project,setProject]=useState<Project|null>(null),pRef=useRef<Project|null>(null),history=useRef(new History()),library=useRef(new MediaLibrary()),audio=useRef(new PlaybackAudio());
 const [cursor,setCursor]=useState(0),cursorRef=useRef(0),[selected,setSelected]=useState<string[]>([]),[mediaSelected,setMediaSelected]=useState<string|null>(null),[playing,setPlaying]=useState(false),[draggingPlayhead,setDraggingPlayhead]=useState(false),[trackDropIndex,setTrackDropIndex]=useState<number|null>(null),playingRef=useRef(false),startPosition=useRef(0);
 const [status,setStatus]=useState('Listo'),[busy,setBusy]=useState(false),[tab,setTab]=useState('media'),[filter,setFilter]=useState('all'),[search,setSearch]=useState(''),[zoom,setZoom]=useState(65),[snap,setSnap]=useState(true),[loop,setLoop]=useState(false),[ripple,setRipple]=useState<Ripple>('off');
 const [upperHeight,setUpperHeight]=useState(45),[leftWidth,setLeftWidth]=useState(48),[quality,setQuality]=useState('half'),[gotoText,setGotoText]=useState(''),[dialog,setDialog]=useState(''),[trackId,setTrackId]=useState<string|null>(null),[cap,setCap]=useState({mp4:false,webm:false,wav:false}),[exportSettings,setExportSettings]=useState<ExportSettings>({width:1280,height:720,fps:{num:30,den:1},format:'mp4',quality:'medium',scope:'full',start:0,end:0,includeVideo:true,includeAudio:true,bitrateMbps:null}),[preset,setPreset]=useState('mp4-720'),[progress,setProgress]=useState<ExportProgress|null>(null),[rendering,setRendering]=useState(false),[batch,setBatch]=useState<BatchJob[]>([]);
 const [cacheMedia,setCacheMedia]=useState(true),[relinkId,setRelinkId]=useState<string|null>(null),[storageInfo,setStorageInfo]=useState('');
 const [importReport,setImportReport]=useState<ImportReport|null>(null);
 const [vegAnalysis,setVegAnalysis]=useState<VegAnalysis|null>(null);
 const [vegFile,setVegFile]=useState<File|null>(null),[vegTimeline,setVegTimeline]=useState<VegTimelineReport|null>(null),[bridge,setBridge]=useState<BridgeStatus|null>(null);
 const [zoomWidthFloor,setZoomWidthFloor]=useState(0),[timelineViewport,setTimelineViewport]=useState(900),[fitTimeline,setFitTimeline]=useState(false);
 const timelineSpan=Math.max(30,seconds(project?endTime(project):0)+10);
 const opacityStart=useRef<{project:Project;id:string}|null>(null);
 const [envelopeMode,setEnvelopeMode]=useState<EnvelopeMode>('off'),envelopeStart=useRef<Project|null>(null),maskStart=useRef<Project|null>(null);
 // Ancho del panel de medidores del maestro: se ajusta arrastrando el divisor que lo separa de la vista previa
 // para poder leer sus notas. Empieza en 132 px y se queda donde lo dejes.
 const [metersWidth,setMetersWidth]=useState(132);
 // Carril sobre el que se está arrastrando algo, para resaltarlo mientras se suelta.
 const [dropLane,setDropLane]=useState<string|null>(null);
 // Zoom de la vista previa: 1 es «ajustado al panel». Se cambia con la rueda del ratón sobre el monitor y con
 // los botones del panel; el monitor se desplaza cuando la vista es más grande que el hueco.
 const [previewZoom,setPreviewZoom]=useState(1);
 const [monitorSize,setMonitorSize]=useState({width:0,height:0});
 const monitorRef=useRef<HTMLDivElement|null>(null);
 const monitorObserver=useRef<ResizeObserver|null>(null);
 const previewZoomRef=useRef(1);
 const pendingZoomAnchor=useRef<{x:number;y:number;offsetX:number;offsetY:number}|null>(null);
 // La rueda acerca y aleja la vista previa; el oyente es nativo (enganchado al montar el monitor) para poder
 // cancelar el desplazamiento de la página: React registra los suyos como pasivos y no deja llamar a
 // preventDefault. El zoom se ancla en el punto que hay bajo el puntero, así que se acerca a lo que miras.
 const onMonitorWheel=(event:WheelEvent)=>{
  const node=monitorRef.current;
  if(!node||!event.deltaY)return;
  const frameNode=node.querySelector('.monitor-frame');
  const monitorBox=node.getBoundingClientRect();
  const frameBox=frameNode?.getBoundingClientRect();
  if(frameBox&&frameBox.width>0&&frameBox.height>0){
   pendingZoomAnchor.current={
    x:(event.clientX-frameBox.left)/frameBox.width,
    y:(event.clientY-frameBox.top)/frameBox.height,
    offsetX:event.clientX-monitorBox.left,
    offsetY:event.clientY-monitorBox.top,
   };
  }
  event.preventDefault();
  const factor=Math.exp(-event.deltaY*(event.deltaMode===0?.0015:.02));
  const next=Math.max(PREVIEW_MIN_ZOOM,Math.min(PREVIEW_MAX_ZOOM,Number((previewZoomRef.current*factor).toFixed(4))));
  previewZoomRef.current=next;
  setPreviewZoom(next);
 };
 // Observador del monitor y oyente de la rueda: se montan con el nodo, así que sobreviven a que el proyecto
 // llegue después del primer dibujo (al principio se ve «Abriendo Corte 15» y todavía no hay monitor).
 const attachMonitor=useCallback((node:HTMLDivElement|null)=>{
  monitorObserver.current?.disconnect();monitorObserver.current=null;
  const previous=monitorRef.current;
  if(previous&&previous!==node)previous.removeEventListener('wheel',onMonitorWheel);
  monitorRef.current=node;
  if(!node)return;
  const measure=()=>setMonitorSize(current=>current.width===node.clientWidth&&current.height===node.clientHeight?current:{width:node.clientWidth,height:node.clientHeight});
  measure();
  if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(measure);observer.observe(node);monitorObserver.current=observer;}
  else window.addEventListener('resize',measure);
  node.addEventListener('wheel',onMonitorWheel,{passive:false});
 },[]);
 const [apiKeys,setApiKeys]=useState({groq:'',pexels:''});
 const [aiBusy,setAiBusy]=useState('');
 const [transcript,setTranscript]=useState<{text:string;cues:Cue[]}|null>(null);
 const [pexelsQuery,setPexelsQuery]=useState('');
 const [pexelsMode,setPexelsMode]=useState<'query'|'transcript'>('transcript');
 const [pexelsCount,setPexelsCount]=useState(4);
 const [pexelsOrientation,setPexelsOrientation]=useState<'landscape'|'portrait'|'any'>('landscape');
 // Capability probing by API presence, never by browser name.
 const [support,setSupport]=useState<{decode:boolean;encode:boolean;audio:boolean}|null>(null);
 const [contextMenu,setContextMenu]=useState<{x:number;y:number;title?:string;items:WorkspaceMenuItem[]}|null>(null);
 // Atributos copiados de un evento (efectos, plantilla, encuadre…) y el diálogo para elegir qué se pega.
 const [copiedAttributes,setCopiedAttributes]=useState<CopiedAttributes|null>(null);
 const [attributeTarget,setAttributeTarget]=useState<{id:string;groups:AttributeGroupId[]}|null>(null);
 // Formato elegido para exportar los marcadores (capítulos o subtítulos).
 const [markerFormat,setMarkerFormat]=useState<MarkerExportFormat>('txt');
 const canvas=useRef<HTMLCanvasElement>(null),fileInput=useRef<HTMLInputElement>(null),projectInput=useRef<HTMLInputElement>(null),relinkInput=useRef<HTMLInputElement>(null),timeline=useRef<HTMLDivElement>(null),clipboard=useRef<Event[]>([]),abort=useRef<AbortController|null>(null),previewQueue=useRef<LatestPreview|null>(null),previewBack=useRef<HTMLCanvasElement|null>(null),ready=useRef(false),zoomRef=useRef(zoom),trackIdRef=useRef<string|null>(null),trackDropRef=useRef<number|null>(null),pendingScroll=useRef<{time:number;pointerX:number}|null>(null),aiAbort=useRef<AbortController|null>(null);
 // La aguja y el timecode grande se actualizan por referencia durante la reproducción (ver el bucle de
 // reproducción); los medidores van por su propio almacén para que su lectura por fotograma no repinte el editor.
 const playheadRef=useRef<HTMLDivElement>(null),timecodeRef=useRef<HTMLDivElement>(null),meterStore=useRef(createMeterStore()),syncedCursor=useRef(0),dialogRef=useRef('');
 const p=project;
 // Estado del evento al abrir su ventana de Propiedades: «Cancelar» devuelve el evento a como estaba. Se copia
 // el evento y los que van enlazados con él, porque los interruptores se aplican a todo el grupo.
 const eventSnapshot=useRef<{ids:string[];events:Event[]}|null>(null);
 zoomRef.current=zoom;trackIdRef.current=trackId;previewZoomRef.current=previewZoom;dialogRef.current=dialog;
 useEffect(()=>registerProjectTool(()=>pRef.current),[]);
 // La rueda acerca y aleja la vista previa; el oyente es nativo (enganchado al montar el monitor) para poder
 // cancelar el desplazamiento de la página: React registra los suyos como pasivos y no deja llamar a
 // preventDefault. El zoom se ancla en el punto que hay bajo el puntero, así que se acerca a lo que miras.
 // Después de cambiar el zoom se coloca el desplazamiento para que el punto agarrado no se mueva de sitio.
 useLayoutEffect(()=>{
  const node=monitorRef.current;const anchor=pendingZoomAnchor.current;
  if(!node||!anchor)return;
  pendingZoomAnchor.current=null;
  const frameNode=node.querySelector('.monitor-frame') as HTMLElement|null;
  if(!frameNode)return;
  const frameBox=frameNode.getBoundingClientRect();
  node.scrollLeft=anchor.x*frameBox.width-anchor.offsetX;
  node.scrollTop=anchor.y*frameBox.height-anchor.offsetY;
 },[previewZoom,monitorSize]);
 // La ventana de Propiedades toma una copia del evento al abrirse: si se pulsa «Cancelar», el evento vuelve
 // exactamente a ese estado. Se vuelve a copiar solo cuando cambia el evento seleccionado.
 useEffect(()=>{
  if(dialog!=='event'){eventSnapshot.current=null;return;}
  const current=pRef.current,id=selected[0];
  if(!current||!id){return;}
  if(eventSnapshot.current?.ids.includes(id))return;
  const ids=linkedIds(current,[id]);
  const events=current.events.filter(item=>ids.includes(item.id)).map(item=>clone(item));
  eventSnapshot.current=events.length?{ids,events}:null;
 },[dialog,selected]);
 function report(e:unknown){setStatus(e instanceof Error?e.message:String(e));}
 function pause(){playingRef.current=false;setPlaying(false);audio.current.stop();meterStore.current.set(SILENT_READING);setCursor(cursorRef.current);}
 function seek(value:number){pause();const v=Math.max(0,value);if(v!==cursorRef.current)previewQueue.current?.cancel();cursorRef.current=v;paintCursor(v);setCursor(v);}
 // La aguja y el timecode grande, sin pasar por React: es lo que sigue al cursor en cada fotograma de la
 // reproducción (y también al mover la aguja con el ratón, para que no haya saltos entre fotogramas). Solo usa
 // referencias, así que no depende de nada del render y el bucle de reproducción no se reinicia.
 const paintCursor=useCallback((value:number)=>{
  const current=pRef.current;
  if(playheadRef.current)playheadRef.current.style.left=`${seconds(value)*zoomRef.current}px`;
  if(timecodeRef.current&&current)timecodeRef.current.textContent=formatTimecode(value,current.fps,current.timecodeFormat??'non-drop');
 },[]);
 function replace(next:Project){pRef.current=next;setProject(next);}
 // Timecode con el formato del proyecto (SMPTE sin descarte, con descarte o segundos). Es el que usa toda la
 // interfaz: regla, monitor, eventos, estado y diálogos. Fuera del render (avisos, mensajes) se usa `tcOf`.
 function tc(value:number){const current=pRef.current??p;return current?formatTimecode(value,current.fps,current.timecodeFormat??'non-drop'):'';}
 function tcShort(value:number){const current=pRef.current??p;return current?formatShortTimecode(value,current.fps,current.timecodeFormat??'non-drop'):'';}
 function edit(fn:(draft:Project)=>void){const current=pRef.current;if(!current||rendering)return;pause();history.current.push(current);const next=clone(current);fn(next);replace(next);}
 function undo(){if(!pRef.current)return;pause();replace(history.current.undo(pRef.current));setSelected([]);}
 function redo(){if(!pRef.current)return;pause();replace(history.current.redo(pRef.current));setSelected([]);}
 async function restoreMedia(next:Project){setBusy(true);let missing=0;for(const m of next.media){if(library.current.items.has(m.id))continue;try{const file=await readFile(m.id);if(file)await library.current.import(file,m.id);else missing++;}catch{missing++;}}setBusy(false);setStatus(missing?`${missing} medio(s) faltante(s). Selecciónalos y pulsa Revincular.`:next.media.length?'Proyecto restaurado. Medios disponibles localmente.':'Listo. Importa medios para comenzar.');setProject({...pRef.current!});}
 useEffect(()=>{setSupport({decode:typeof VideoDecoder!=='undefined'&&typeof AudioDecoder!=='undefined',encode:typeof VideoEncoder!=='undefined'&&typeof AudioEncoder!=='undefined',audio:typeof AudioContext!=='undefined'&&typeof AudioBuffer!=='undefined'});},[]);
 // El puente .veg es un proceso aparte (VEGAS): se comprueba si está en marcha en vez de suponerlo.
 useEffect(()=>{let alive=true;void bridgeStatus().then(value=>{if(alive)setBridge(value);});return()=>{alive=false;};},[]);
 // Las claves de las APIs se leen de este navegador o, si no hay nada guardado, del entorno de compilación.
 useEffect(()=>{const env=(import.meta as unknown as {env?:Record<string,string>}).env??{};try{setApiKeys({groq:localStorage.getItem('corte15-groq-key')??env.VITE_GROQ_API_KEY??'',pexels:localStorage.getItem('corte15-pexels-key')??env.VITE_PEXELS_API_KEY??''});}catch{setApiKeys({groq:env.VITE_GROQ_API_KEY??'',pexels:env.VITE_PEXELS_API_KEY??''});}},[]);
useEffect(()=>{let next:Project;try{next=recover()||newProject();const layout=JSON.parse(localStorage.getItem('corte15-layout')||'{}');if(layout.upper)setUpperHeight(layout.upper);if(layout.left)setLeftWidth(layout.left);}catch(e){report(e);next=newProject();}replace(next);ready.current=true;void restoreMedia(next);void capabilities().then(setCap).catch(()=>{});void storageHeadroom().then(h=>setStorageInfo(h.supported?`${Math.round(h.usage/1048576)} MB usados · ${Math.round(h.free/1048576)} MB libres de una cuota de ${Math.round(h.quota/1048576)} MB${h.quota&&h.free<h.quota*.1?' — queda poco espacio local: descarga el proyecto y conserva tus originales.':''}`:'Este navegador no informa del espacio de almacenamiento disponible.'));return()=>{audio.current.dispose();library.current.dispose();abort.current?.abort();};},[]);
 useEffect(()=>{if(!p||!ready.current)return;const timer=setTimeout(()=>{try{saveLocal(p);}catch{setStatus('No se pudo guardar automáticamente: almacenamiento lleno o bloqueado. Descarga el proyecto.');}},450);return()=>clearTimeout(timer);},[p]);
 useEffect(()=>{if(ready.current)try{localStorage.setItem('corte15-layout',JSON.stringify({upper:upperHeight,left:leftWidth}));}catch{}},[upperHeight,leftWidth]);
 // La rueda hace zoom en la línea de tiempo (el navegador no permite preventDefault en un listener pasivo,
 // así que se registra a mano). Mayús + rueda desplaza en horizontal y Alt + rueda en vertical.
  // La aguja conserva su posición antes de que el navegador pinte la nueva escala.
 useLayoutEffect(()=>{const pending=pendingScroll.current,element=timeline.current;if(!pending||!element)return;pendingScroll.current=null;element.scrollLeft=Math.max(0,pending.time*zoom-pending.pointerX);},[zoom]);
 // El monitor de la vista previa se pinta con la composición real, en un lienzo del tamaño del fotograma y con
 // la calidad elegida. Solo conserva un trabajo en curso y la última petición pendiente.
 // Al buscar se descarta el fotograma antiguo; reproduciendo se publica para no dejar el monitor congelado.
 if(!previewQueue.current)previewQueue.current=new LatestPreview(report);
 useEffect(()=>()=>previewQueue.current?.cancel(),[]);
 const paintPreview=useCallback((at:number)=>{
  const current=pRef.current,canvasNode=canvas.current;
  if(!current||!canvasNode)return;
  previewQueue.current!.request(async isCurrent=>{
   if(!canvas.current)return;
   const obsolete=()=>!isCurrent()&&!playingRef.current;
   const divisor=quality==='full'?1:quality==='half'?2:4;
   // El lienzo de trabajo se reutiliza entre fotogramas: crearlo y destruirlo en cada composición era la mayor
   // fuente de basura del editor (medio megapíxel por fotograma y por cada capa con efectos).
   const back=previewBack.current??(previewBack.current=document.createElement("canvas"));
   const backWidth=Math.max(16,Math.round(current.width/divisor)),backHeight=Math.max(16,Math.round(current.height/divisor));
   if(back.width!==backWidth)back.width=backWidth;
   if(back.height!==backHeight)back.height=backHeight;
   await compose(back,current,library.current,at,{cancelled:obsolete});
   if(!obsolete()&&canvas.current){
    if(canvas.current.width!==back.width)canvas.current.width=back.width;
    if(canvas.current.height!==back.height)canvas.current.height=back.height;
    canvas.current.getContext('2d')!.drawImage(back,0,0);
   }
  });
 },[quality]);
 useEffect(()=>{if(!p||!canvas.current)return;void paintPreview(cursor);},[p,cursor,quality,busy,paintPreview]);
 useEffect(()=>{if(!playing||!p)return;let id=0;const frame=()=>{if(!playingRef.current)return;const span=playbackSpan(p,loop);const end=span?span.end:endTime(p);const now=ticks(audio.current.clock());if(now>=end){if(span){void audio.current.start(seconds(span.start)).then(()=>{if(playingRef.current)id=requestAnimationFrame(frame);});}else pause();return;}audio.current.schedule(p,library.current,seconds(end));cursorRef.current=now;
   // Con un diálogo abierto (Panoramización, Títulos, Trimmer…) sí se sincroniza el estado de React cuatro veces
   // por segundo, porque esas ventanas leen el cursor; sin diálogo no hace falta ninguno: la aguja, el timecode y
   // el monitor ya van por referencia y el editor no se vuelve a renderizar hasta que se pare.
   paintCursor(now);void paintPreview(now);meterStore.current.set(audio.current.reading());
   if(dialogRef.current&&now-syncedCursor.current>=CURSOR_SYNC_TICKS){syncedCursor.current=now;setCursor(now);}
   id=requestAnimationFrame(frame);};id=requestAnimationFrame(frame);return()=>cancelAnimationFrame(id);},[playing,p,loop,paintCursor,paintPreview]);
 async function beginPlayback(at=cursorRef.current){if(!pRef.current||busy||rendering)return;const current=pRef.current;if(endTime(current)<=0)return;if(current.media.some(m=>current.events.some(e=>e.mediaId===m.id)&&!library.current.items.has(m.id))){setStatus('Revincula los medios faltantes antes de reproducir.');return;}pause();const span=playbackSpan(current,loop);const end=span?span.end:endTime(current);if(at>=end)at=span?span.start:0;startPosition.current=at;try{await audio.current.start(seconds(at));playingRef.current=true;setPlaying(true);audio.current.schedule(current,library.current,seconds(end));}catch(e){report(e);}}
 function transport(){if(playingRef.current){pause();seek(startPosition.current);}else void beginPlayback();}
 async function importFiles(files:FileList|File[]){if(rendering||busy)return;setBusy(true);pause();const added:Media[]=[];const errors:string[]=[];let cacheBlocked=false;for(const file of Array.from(files)){setStatus(`Analizando ${file.name}→`);try{const m=await library.current.import(file);added.push(m);if(cacheMedia){const room=await storageHeadroom(file.size);if(room.enough)try{await storeFile(m.id,file);}catch{errors.push(`${file.name}: importado, pero el cache local está lleno. Tendrás que revincularlo.`);}else{cacheBlocked=true;errors.push(`${file.name}: importado, pero no hay espacio local suficiente para copiarlo (${Math.round(room.free/1048576)} MB libres). Se usará solo mientras esta pestaña siga abierta.`);}}}catch(e){errors.push(e instanceof Error?e.message:String(e));}}if(cacheBlocked)void storageHeadroom().then(h=>setStorageInfo(h.supported?`${Math.round(h.usage/1048576)} MB usados · ${Math.round(h.free/1048576)} MB libres de una cuota de ${Math.round(h.quota/1048576)} MB — espacio insuficiente para cachear los medios nuevos.`:`Este navegador no informa del espacio de almacenamiento disponible.`));if(added.length){edit(d=>d.media.push(...added));setMediaSelected(added[0].id);setTab('media');}setBusy(false);setStatus(errors.length?errors.join(' | '):`${added.length} medio(s) importado(s). Arrastra a una pista o haz doble clic para insertar.`);}
 // Los subtítulos de un archivo .srt entran en la línea de tiempo como eventos de texto, en sus tiempos, con
 // contorno negro para que se lean sobre cualquier imagen.
 function insertSubtitles(media:Media){
  const cues=parseSrt(media.text??'');
  if(!cues.length){setStatus('El archivo de subtítulos no tiene frases con tiempos legibles.');return;}
  edit(d=>{setSelected(addSubtitles(d,cues));});
  setStatus(`${cues.length} línea(s) de subtítulos en la pista «Subtítulos», en sus tiempos. Puedes moverlas, recortarlas o cambiarles el estilo como a cualquier texto.`);
 }
 // ---------------------------------------------------------------- arrastrar y soltar sobre la línea de tiempo
 // Qué se está arrastrando: un medio del panel o una transición del catálogo.
 function dragging(e:ReactDragEvent){const types=e.dataTransfer.types;return types.includes(MEDIA_DRAG)?'media':types.includes(TRANSITION_DRAG)?'transition':null;}
 // Instante de la línea de tiempo bajo el puntero, medido desde el contenido (el origen de los tiempos).
 function timeAtPointer(e:ReactDragEvent){const content=(e.currentTarget as HTMLElement).closest('.timeline-content') as HTMLElement|null;const rect=(content??(e.currentTarget as HTMLElement)).getBoundingClientRect();return quantize(ticks(Math.max(0,(e.clientX-rect.left)/zoom)),p?.fps??{num:30,den:1});}
 function dragOverTimeline(e:ReactDragEvent,laneId:string|null){if(!dragging(e))return;e.preventDefault();e.dataTransfer.dropEffect='copy';if(dropLane!==laneId)setDropLane(laneId);}
 function dropOnTimeline(e:ReactDragEvent,laneId:string|null){
  const que=dragging(e);setDropLane(null);if(!que)return;
  e.preventDefault();e.stopPropagation();
  const current=pRef.current;if(!current)return;
  const lane=laneId??(e.target as HTMLElement|null)?.closest?.('[data-track]')?.getAttribute('data-track')??null;
  const at=timeAtPointer(e);
  if(que==='media'){
   const id=e.dataTransfer.getData(MEDIA_DRAG);const m=current.media.find(item=>item.id===id);if(!m)return;
   const plan=planMediaDrop({mediaKind:m.kind,tracks:current.tracks,preferred:lane});
   if(plan.kind==='none'){setStatus(plan.reason);return;}
   insertMedia(m,plan.trackId,at);
   setStatus(plan.createTrack?`Se creó una pista de ${plan.createTrack==='audio'?'audio':'vídeo'} para «${m.name}».`:describeMediaDrop(plan,current.tracks));
   return;
  }
  const kind=e.dataTransfer.getData(TRANSITION_DRAG) as TransitionKind;if(!kind)return;
  dropTransitionOn(kind,lane,at);
 }
 function dropTransitionOn(kind:TransitionKind,laneId:string|null,at:number){
  const current=pRef.current;if(!current)return;
  const lane=laneId?current.tracks.find(track=>track.id===laneId):undefined;
  if(lane&&lane.kind==='audio'){setStatus('Las transiciones son de vídeo: suéltala sobre un clip de una pista de vídeo.');return;}
  const events=current.events.filter(event=>event.kind!=='audio'&&(!lane||event.trackId===lane.id));
  const plan=planTransitionDrop({events,time:at,kind,fps:current.fps});
  if(plan.kind==='none'){setStatus(plan.reason);return;}
  const clip=current.events.find(event=>event.id===plan.eventId)?.name??'';
  applyTransition(kind,plan);
  setStatus(describeTransitionDrop(plan,TRANSITION_LABEL[kind],clip,seconds));
 }
function insertMedia(m:Media,target?:string|null,at=cursorRef.current){if(m.kind==='subtitle'){insertSubtitles(m);return;}const kind:'video'|'audio'|'image'=m.kind;edit(d=>{const plan=planMediaDrop({mediaKind:m.kind,tracks:d.tracks,preferred:target??null});const wanted=plan.kind==='track'?plan.trackId:null;let track=wanted?d.tracks.find(t=>t.id===wanted):undefined;if(!track){track=newTrack(kind==='audio'?'audio':'video');d.tracks.push(track);}const start=quantize(at,d.fps);const duration=kind==='image'?ticks(5):Math.max(frameTicks(d.fps),Math.floor(m.duration/frameTicks(d.fps))*frameTicks(d.fps));const e={...newEvent(track.id,kind,start,duration),name:m.name,mediaId:m.id};if(ripple!=='off')for(const old of d.events)if(old.start>=start&&(ripple==='all'||old.trackId===track.id))old.start+=duration;d.events.push(e);if(kind==='video'&&m.hasAudio){let a=d.tracks.find(t=>t.kind==='audio');if(!a){a=newTrack('audio');d.tracks.push(a);}const group=uid();e.group=group;d.events.push({...clone(e),id:uid(),trackId:a.id,kind:'audio',group});}autoCrossfade(d,[e.id]);setSelected([e.id]);});}
 function generator(kind:'text'|'color'){edit(d=>{let track=d.tracks.find(t=>t.kind==='video');if(!track){track=newTrack('video');d.tracks.unshift(track);}const e=newEvent(track.id,kind,quantize(cursorRef.current,d.fps));if(kind==='color'){e.name='Color sólido';e.color='#28688d';}d.events.push(e);setSelected([e.id]);});setDialog('event');}
 // Generadores de medios de VEGAS 15: el evento de color puede ser liso, degradado, tablero, barras o ruido.
 const GENERATOR_ITEMS:[string,string][]=[['solid','Color sólido'],['gradient','Degradado de color'],['checkerboard','Tablero cuadriculado'],['bars','Patrón de pruebas'],['noise','Textura de ruido']];
 function addGenerator(kind:GeneratorKind){const label=GENERATOR_ITEMS.find(([value])=>value===kind)?.[1]??'Generador';edit(d=>{let track=d.tracks.find(t=>t.kind==='video');if(!track){track=newTrack('video');d.tracks.unshift(track);}const e=newEvent(track.id,'color',quantize(cursorRef.current,d.fps));e.name=label;e.color=kind==='bars'?'#101010':'#28688d';e.generator=mediaGenerator(kind,e.color);d.events.push(e);setSelected([e.id]);});setDialog('event');}
 // Los efectos se añaden al evento seleccionado desde la pestaña «Efectos de video», como en VEGAS.
 function applyEffectToSelected(kind:VideoEffectKind){const id=selected[0];if(!id)return;edit(d=>{const e=d.events.find(e=>e.id===id);if(!e)return;e.effects=[...(e.effects??[]),defaultEffect(kind,uid())];});setDialog('effects');}
 // La transición de un evento es su entrada y dura lo que su fundido de entrada; si no tiene, se le pone uno.
 // Aplica una transición a un clip. Sin `target` es la acción del catálogo (entrada del clip seleccionado);
 // con `target` viene de soltarla en el borde de un clip: `in` es su entrada y `out` su salida.
 function applyTransition(kind:TransitionKind,target?:{eventId:string;edge:'in'|'out';fade:number;junction:boolean}){
  const id=target?.eventId??selected[0];if(!id)return;
  let aplicada=false;
  edit(d=>{const e=d.events.find(item=>item.id===id);if(!e||e.kind==='audio')return;aplicada=true;
   if(target?.edge==='out'){e.transitionOut=kind;if(!(e.fadeOut>0))e.fadeOut=target.fade;}
   else{e.transition=kind;if(!(e.fadeIn>0))e.fadeIn=target?target.fade:Math.min(ticks(1),e.duration/2);}});
  if(!aplicada&&!target)setStatus('Selecciona un clip de vídeo para aplicarle la transición, o arrástrala sobre el clip.');
 }
 // Mezclador: buses, maestro y envolventes. Al dibujar una envolvente no se apila historial en cada
 // movimiento: se guarda una instantánea al empezar y se apila al soltar.
 function updateEnvelope(trackId:string,change:Partial<Track>){const current=pRef.current;if(!current)return;replace({...current,tracks:current.tracks.map(t=>t.id===trackId?{...t,...change}:t)});}
 function beginEnvelope(){envelopeStart.current=pRef.current;}
 function commitEnvelope(){if(envelopeStart.current){history.current.push(envelopeStart.current);envelopeStart.current=null;}}
 function changeBus(busId:string,change:Partial<AudioBus>){edit(d=>{const bus=(d.buses??[]).find(b=>b.id===busId);if(bus)Object.assign(bus,change);});}
 function removeBus(busId:string){edit(d=>{d.buses=(d.buses??[]).filter(b=>b.id!==busId);for(const t of d.tracks)if(t.busId===busId)t.busId=undefined;});}
 function changeMaster(change:{gain?:number;pan?:number}){edit(d=>{d.master={gain:d.master?.gain??1,pan:d.master?.pan??0,...change};});}
 // Máscara libre: como al dibujar una envolvente, el arrastre no apila historial en cada movimiento; se guarda
 // una instantánea al empezar y se apila al confirmar.
 function beginOpacity(id:string){const current=pRef.current;if(!current||rendering||lockedIds(current).has(id))return;pause();setSelected([id]);setTrackId(null);opacityStart.current={project:current,id};}
 function previewOpacity(value:number){const start=opacityStart.current;if(!start)return;replace(setEventOpacity(start.project,start.id,value));setStatus(`Opacidad: ${Math.round(value*100)} %`);}
 function endOpacity(cancel:boolean){const start=opacityStart.current;opacityStart.current=null;if(!start)return;if(cancel){replace(start.project);return;}const before=start.project.events.find(e=>e.id===start.id)?.videoOpacity??1;const after=pRef.current?.events.find(e=>e.id===start.id)?.videoOpacity??1;if(before!==after)history.current.push(start.project);}
 function commitOpacity(id:string,value:number){const current=pRef.current;if(!current||rendering||lockedIds(current).has(id))return;const before=current.events.find(e=>e.id===id)?.videoOpacity??1;if(before===value)return;pause();history.current.push(current);replace(setEventOpacity(current,id,value));setStatus(`Opacidad: ${Math.round(value*100)} %`);}
 function beginMask(){maskStart.current=pRef.current;}
 function changeMaskPath(maskPath:MaskPath,commit:boolean){const current=pRef.current;const id=selected[0];if(!current||!id)return;if(commit&&maskStart.current){history.current.push(maskStart.current);maskStart.current=null;}replace({...current,events:current.events.map(e=>e.id===id?{...e,maskPath}:e)});}
 function splitAt(ids:string[]){
  if(!p||!ids.length)return;
  const locked=lockedIds(p);
  const usable=ids.filter(id=>!locked.has(id));
  if(!usable.length){setStatus('No se puede dividir: los eventos están bloqueados.');return;}
  edit(d=>split(d,usable,quantize(cursor,d.fps)));
 }
 function doSplit(){
  if(!p)return;
  splitAt(selected.length?selected:p.events.filter(e=>cursor>e.start&&cursor<e.start+e.duration).map(e=>e.id));
 }
 // Edición de precisión: deslizar el contenido (slip), desplazar el evento (slide) y recortar por rizo hasta
 // el cursor. Los tres trabajan sobre la selección y se cuantizan a un fotograma.
 function slipSelected(direction:number){if(!p||!selected.length)return;const ids=selected.filter(id=>!lockedIds(p).has(id));if(!ids.length){setStatus('Los eventos seleccionados están bloqueados.');return;}edit(d=>slip(d,ids,frameTicks(p.fps)*direction));}
 function slideSelected(direction:number){if(!p||!selected.length)return;const ids=selected.filter(id=>!lockedIds(p).has(id));if(!ids.length){setStatus('Los eventos seleccionados están bloqueados.');return;}edit(d=>slide(d,ids,frameTicks(p.fps)*direction));}
 function rippleTrimIds(ids:string[],edge:'left'|'right'){
  if(!p||!ids.length)return;
  const locked=lockedIds(p);
  const usable=linkedIds(p,ids).filter(id=>!locked.has(id));
  if(!usable.length){setStatus('Los eventos seleccionados están bloqueados.');return;}
  if(rippleTrimToCursor(p,usable,edge,cursorRef.current,ripple))edit(d=>rippleTrimToCursor(d,usable,edge,cursorRef.current,ripple));
  else setStatus('Coloca el cursor dentro del evento seleccionado para recortarlo por rizo.');
 }
 function rippleTrimSelected(edge:'left'|'right'){rippleTrimIds(selected,edge);}
 // Copiar/cortar un conjunto de eventos concreto. El menú del clic derecho llama a esta forma explícita: fijar
 // la selección con `setSelected` y copiar en el mismo clic leería la selección anterior, porque el estado de
 // React todavía no se ha actualizado.
 function copyIds(ids:string[],cut=false){
  if(!p||!ids.length)return;
  const list=linkedIds(p,ids);
  clipboard.current=clone(p.events.filter(e=>list.includes(e.id)));
  // Al copiar un evento, sus atributos quedan también en el portapapeles de atributos: así «Pegar atributos de
  // evento» funciona como en VEGAS, donde no hay una orden aparte para copiarlos (solo existe
  // Edit.PasteEventAttributes; el original se copia con «Copiar»).
  const source=p.events.find(event=>event.id===ids[0])??clipboard.current[0];
  if(source)setCopiedAttributes(copyAttributes(source));
  if(cut)edit(d=>removeEvents(d,ids,ripple));
  setStatus(cut?'Eventos cortados.':'Eventos copiados.');
 }
 function copy(cut=false){copyIds(selected,cut);}
 function paste(duplicate=false){if(!p)return;if(duplicate)copy();if(!clipboard.current.length)return;const first=Math.min(...clipboard.current.map(e=>e.start));const at=duplicate?Math.max(...clipboard.current.map(e=>e.start+e.duration)):quantize(cursor,p.fps);const groups=new Map<string,string>();const events=clone(clipboard.current).map(e=>{if(e.group&&!groups.has(e.group))groups.set(e.group,uid());return {...e,id:uid(),start:e.start-first+at,group:e.group?groups.get(e.group):undefined};});edit(d=>{for(const e of events)if(!d.tracks.some(t=>t.id===e.trackId)){const track=newTrack(e.kind==='audio'?'audio':'video');d.tracks.push(track);e.trackId=track.id;}d.events.push(...events);autoCrossfade(d,events.map(e=>e.id));if(!duplicate&&ripple!=='off')rippleMove(d,events.map(e=>e.id),Math.max(...events.map(e=>e.start+e.duration))-Math.min(...events.map(e=>e.start)),ripple,at);});setSelected(events.map(e=>e.id));}
 function group(ungroup=false){edit(d=>{const id=uid();const ids=linkedIds(d,selected);for(const e of d.events)if(ids.includes(e.id))e.group=ungroup?undefined:id;});}
 function marker(){edit(d=>d.markers.push({id:uid(),time:quantize(cursor,d.fps),name:`Marcador ${d.markers.length+1}`}));}
 function saveKeys(next:{groq:string;pexels:string}){setApiKeys(next);try{localStorage.setItem('corte15-groq-key',next.groq);localStorage.setItem('corte15-pexels-key',next.pexels);}catch{}setStatus('Claves guardadas en este navegador. No se escriben en el proyecto ni se envían a ningún otro sitio.');}
 // Subtítulos: mezcla el audio del proyecto en local, lo envía a Groq solo al pulsar el botón y reparte el
 // resultado en un archivo .srt dentro de Medios de proyecto y en eventos de texto sobre la línea de tiempo.
 async function generateSubtitles(){
  if(!p||aiBusy)return;
  pause();setAiBusy('Transcribiendo con Groq→');setStatus('Preparando el audio del proyecto→');
  aiAbort.current=new AbortController();
  try{
   const {samples,sampleRate,duration}=renderSpeechAudio(p,library.current);
   if(duration<=0.2||!samples.length)throw new Error('El proyecto no tiene audio que transcribir: añade algún evento de audio o de vídeo con sonido.');
   setStatus(`Enviando ${Math.round(duration)} s de audio (16 kHz mono) a Groq→`);
   const result=await transcribe(samples,sampleRate,apiKeys.groq,{signal:aiAbort.current.signal});
   const srt=buildSrt(result.cues);
   // eslint-disable-next-line react-hooks/purity -- la marca de tiempo se crea al generar el archivo, nunca durante el render.
   const media:Media={id:uid(),name:'subtitulos.srt',size:srt.length,modified:Date.now(),kind:'subtitle',duration:ticks(Math.max(duration,result.cues.at(-1)?.end??0)),width:0,height:0,hasAudio:false,mime:'text/plain',text:srt};
   edit(d=>{d.media.push(media);setSelected(addSubtitles(d,result.cues));});
   setTranscript({text:result.text,cues:result.cues});
   setTab('media');setFilter('subtitle');
   setStatus(`Subtítulos listos: ${result.cues.length} líneas en «${media.name}» (Medios de proyecto → Subtítulos, y también en Video y Todos los medios) y en la pista «Subtítulos».`);
  }catch(error){report(error);}finally{aiAbort.current=null;setAiBusy('');}
 }
 function openPexels(){if(!p)return;setPexelsQuery(keywords(transcript?.text??'').slice(0,4).join(' ')||'abstract background');setDialog('pexels');}
 // Frases de la transcripción: las de esta sesión o, si el proyecto ya trae un .srt, las suyas.
 function transcriptCues():Cue[]{const fromSession=transcript?.cues??[];if(fromSession.length)return fromSession;const srt=p?.media.find(m=>m.kind==='subtitle')?.text;return srt?parseSrt(srt):[];}
 // Recursos según lo que se dice: se busca cada palabra relevante en Pexels y el clip se coloca en el
 // instante exacto en que se menciona, recortado a la duración de la frase.
 async function runPexelsFromTranscript(){
  if(!p||aiBusy)return;
  const cues=transcriptCues();
  if(!cues.length){report(new Error('Primero genera los subtítulos: los recursos se colocan según lo que se dice en la transcripción.'));return;}
  pause();setAiBusy('Buscando recursos para la transcripción→');setStatus(`Analizando ${cues.length} frase(s) de la transcripción→`);aiAbort.current=new AbortController();
  try{
   const entries=resourceTerms(cues,3);
   const withTerms=entries.filter(entry=>entry.terms.length).length;
   if(!withTerms)throw new Error('La transcripción no tiene palabras aprovechables para buscar recursos.');
   const maxDownloads=Math.min(12,Math.max(2,pexelsCount*2));
   const clips=new Map<string,Media>();
   const durations:Record<string,number>={};
   const skipped:string[]=[];
   let downloads=0;
   for(const entry of entries){
    let found=false;
    for(const term of entry.terms){
     if(clips.has(term)){found=true;break;}
     if(downloads>=maxDownloads){skipped.push(entry.text.slice(0,42));break;}
     try{
      setStatus(`Buscando «${term}» en Pexels→`);
      const videos=await searchVideos(term,apiKeys.pexels,{perPage:1,orientation:pexelsOrientation,signal:aiAbort.current.signal});
      const video=videos[0],file=pickFile(video);
      setStatus(`Descargando «${term}» (${file.width}p)→`);
      const blob=await downloadFile(file.link,pexelsFileName(video,file));
      const meta=await library.current.import(blob);
      meta.sourcePath=attribution(video);
      if(cacheMedia)try{await storeFile(meta.id,blob);}catch{/* la caché es opcional */}
      clips.set(term,meta);durations[term]=seconds(meta.duration);downloads++;found=true;break;
     }catch{/* se intenta la siguiente palabra de la frase */}
    }
    if(!found&&!skipped.includes(entry.text.slice(0,42)))skipped.push(entry.text.slice(0,42));
   }
   if(!clips.size)throw new Error('Pexels no devolvió ningún recurso utilizable para lo que dice la transcripción.');
   const frameSeconds=seconds(frameTicks(p.fps));
   const plan=planResourcePlacements(cues,durations,frameSeconds);
   edit(d=>{
    let track=d.tracks.find(t=>t.name==='Pexels'&&t.kind==='video');
    if(!track){track=newTrack('video','Pexels');d.tracks.unshift(track);}
    for(const item of plan){
     const media=clips.get(item.term)!;
     if(!d.media.some(m=>m.id===media.id))d.media.push(media);
     const event=newEvent(track!.id,'video',ticks(item.start),ticks(item.duration));
     event.mediaId=media.id;event.name=`${item.term} · ${media.name}`;
     d.events.push(event);
    }
   });
   setTab('media');setFilter('video');setDialog('');
   const summary=[...clips.keys()].join(', ');
   setStatus(`Recursos por transcripción: ${plan.length} clip(s) colocados en la pista «Pexels» justo cuando se mencionan (${summary}).${skipped.length?` Sin recurso para ${skipped.length} frase(s).`:''}`);
  }catch(error){report(error);}finally{aiAbort.current=null;setAiBusy('');}
 }
 // Recursos de Pexels: se buscan, se descargan y se colocan en una pista nueva además de en Medios de proyecto.
 async function runPexels(){
  if(!p||aiBusy)return;
  pause();setAiBusy('Buscando en Pexels→');aiAbort.current=new AbortController();
  try{
   const videos=await searchVideos(pexelsQuery,apiKeys.pexels,{perPage:pexelsCount,orientation:pexelsOrientation,signal:aiAbort.current.signal});
   const chosen=videos.slice(0,pexelsCount),added:Media[]=[];
   for(const video of chosen){
    const file=pickFile(video);
    setStatus(`Descargando ${file.width}p de ${video.user||'Pexels'}→`);
    const blob=await downloadFile(file.link,pexelsFileName(video,file));
    const meta=await library.current.import(blob);
    meta.sourcePath=attribution(video);
    if(cacheMedia)try{await storeFile(meta.id,blob);}catch{/* la caché es opcional */}
    added.push(meta);
   }
   edit(d=>{
    let track=d.tracks.find(t=>t.name==='Pexels'&&t.kind==='video');
    if(!track){track=newTrack('video','Pexels');d.tracks.unshift(track);}
    let at=quantize(cursorRef.current,d.fps);
    for(const entry of added){
     const duration=Math.max(frameTicks(d.fps),Math.floor(entry.duration/frameTicks(d.fps))*frameTicks(d.fps));
     d.events.push({...newEvent(track!.id,'video',at,duration),name:entry.name,mediaId:entry.id});
     at+=duration;
    }
    d.media.push(...added);
   });
   setTab('media');setFilter('video');setDialog('');
   setStatus(`${added.length} recurso(s) de Pexels añadidos a la pista «Pexels» y a Medios de proyecto (también en la carpeta Video).`);
  }catch(error){report(error);}finally{aiAbort.current=null;setAiBusy('');}
 }
 function importVegReferences(){
  const analysis=vegAnalysis;if(!analysis)return;
  const audioExtensions=['.mp3','.wav','.aif','.aiff','.flac','.m4a','.aac','.ogg','.wma','.caf'];
  const imageExtensions=['.png','.jpg','.jpeg','.bmp','.gif','.tif','.tiff','.psd','.tga','.exr','.dpx'];
  edit(d=>{for(const ref of analysis.media)d.media.push({id:uid(),name:ref.name,size:0,modified:0,kind:audioExtensions.includes(ref.extension)?'audio':imageExtensions.includes(ref.extension)?'image':'video',duration:0,width:0,height:0,hasAudio:!imageExtensions.includes(ref.extension),mime:'',sourcePath:ref.path});});
  setTab('media');setFilter('missing');setDialog('');
  setStatus(`${analysis.media.length} medio(s) del .veg añadidos como referencias. Selecciona cada uno y pulsa Revincular para señalar el archivo.`);
 }
 // Con el puente en marcha, VEGAS entrega el montaje entero: pistas, eventos, recortes, fundidos y curvas.
 async function importVegTimeline(){
  const file=vegFile;if(!file)return;
  setBusy(true);
  try{
   const {project:next,report:summary}=await readVegWithVegas(new Uint8Array(await file.arrayBuffer()),file.name);
   await adoptProject(next);
   setVegTimeline(summary);setDialog('veg');
   setStatus(`Montaje importado de ${file.name}: ${summary.events} evento(s) en ${summary.tracks} pista(s) y ${summary.media} medio(s). Revincula los medios para reproducir.`);
  }catch(error){report(error);}finally{setBusy(false);}
 }
 async function saveAsVeg(){
  if(!p)return;setBusy(true);
  try{
   const {path,skipped}=await writeVegWithVegas(p,p.name);
   setStatus(`Guardado ${path}${skipped.length?` · ${skipped.length} elemento(s) sin escribir: ${skipped.slice(0,2).join(' ')}`:''}`);
  }catch(error){report(error);}finally{setBusy(false);}
 }
 async function openVeg(file:File){
  try{
   const analysis=analyzeVeg(new Uint8Array(await file.arrayBuffer()),file.name);
   setVegAnalysis(analysis);setVegFile(file);setVegTimeline(null);setDialog('veg');
   void bridgeStatus().then(setBridge);
  }catch(error){report(error);}
 }
 function downloadSubtitles(media:Media){
  if(!media.text)return;
  download(new Blob([media.text],{type:'text/plain;charset=utf-8'}),media.name.toLowerCase().endsWith('.srt')?media.name:`${media.name}.srt`);
  setStatus(`Descargado ${media.name}.`);}
 function markRangeStart(){if(!p)return;const at=quantize(cursorRef.current,p.fps);edit(d=>{const end=d.region&&d.region.end>at?d.region.end:Math.min(endTime(d),at+ticks(5));d.region={start:at,end:end>at?end:at+ticks(1)};});setStatus(`Inicio del tramo en ${tc(at)}.`);}
 function markRangeEnd(){if(!p)return;const at=quantize(cursorRef.current,p.fps);edit(d=>{const start=d.region?Math.min(d.region.start,at):0;d.region={start,end:at>start?at:start+ticks(1)};});setStatus(`Fin del tramo en ${tc(at)}.`);}
 function rangeFromSelection(){if(!p)return;const range=selectionRange(p,selected);if(!range){setStatus('Selecciona uno o más eventos para definir el tramo.');return;}edit(d=>{d.region={...range};});setStatus(`Tramo ajustado a la selección: ${tc(range.start)} — ${tc(range.end)}.`);}
 function clearRange(){if(!p?.region)return;edit(d=>{d.region=null;});setStatus('Tramo eliminado.');}
 // La región de bucle es independiente del tramo de renderizado: el tramo decide qué se graba y el bucle qué
 // se repite al reproducir. Se marcan sus extremos con L y Mayús+L (o «[» y «]» con Ctrl) y se borra con
 // Ctrl+Mayús+L.
 function markLoopStart(){if(!p)return;const at=quantize(cursorRef.current,p.fps);edit(d=>{const end=d.loopRegion&&d.loopRegion.end>at?d.loopRegion.end:Math.max(at+ticks(1),Math.min(endTime(d)||at+ticks(5),at+ticks(5)));d.loopRegion={start:at,end:end>at?end:at+ticks(1)};});setStatus(`Inicio del bucle en ${tc(at)}.`);}
 function markLoopEnd(){if(!p)return;const at=quantize(cursorRef.current,p.fps);edit(d=>{const start=d.loopRegion?Math.min(d.loopRegion.start,at):0;d.loopRegion={start,end:at>start?at:start+ticks(1)};});setStatus(`Fin del bucle en ${tc(at)}.`);}
 function clearLoop(){if(!p?.loopRegion)return;edit(d=>{d.loopRegion=null;});setStatus('Región de bucle eliminada. El tramo de renderizado no se toca.');}
 function loopFromRegion(){if(!p?.region){setStatus('No hay tramo que copiar: marca uno con «[» y «]» o arrastra sobre la regla.');return;}const {start,end}=p.region;edit(d=>{d.loopRegion={start,end};});setStatus(`Bucle ajustado al tramo: ${tc(start)} → ${tc(end)}.`);}
 function toggleLoop(){setLoop(!loop);setStatus(!loop?'Bucle activado: al llegar al final se vuelve al principio de la región de bucle.':'Bucle desactivado.');}
 // Todo el zoom (rueda, botones y deslizador) se ancla en la aguja: el fotograma que marca el cursor se queda
 // donde está en la pantalla, así que al acercar o alejar no se pierde de vista el punto de edición.
 function zoomTo(next:number){const element=timeline.current;if(!element)return;const plan=planTimelineZoom({next,zoom:zoomRef.current,playhead:seconds(cursorRef.current),scrollLeft:element.scrollLeft,viewport:element.clientWidth,span:Math.max(30,seconds(pRef.current?endTime(pRef.current):0)+10),pending:pendingScroll.current});if(Math.abs(plan.zoom-zoomRef.current)<1e-12&&!plan.fit)return;setFitTimeline(plan.fit);if(plan.fit)element.scrollLeft=0;pendingScroll.current=Math.abs(plan.zoom-zoomRef.current)<1e-12?null:plan.anchor;zoomRef.current=plan.zoom;setZoomWidthFloor(plan.minWidth);setZoom(plan.zoom);}
 function zoomAt(factor:number){zoomTo(zoomRef.current*factor);}
 function dragRegion(ev:ReactPointerEvent,edge:'start'|'end'){if(!p?.region||ev.button!==0)return;ev.stopPropagation();pause();const initial=clone(p);const ruler=ev.currentTarget.closest('.ruler') as HTMLElement|null;const rect=ruler?.getBoundingClientRect();const drag=frameThrottle<number>(clientX=>{const at=quantize(Math.max(0,ticks((clientX-(rect?.left??0))/zoom)),p.fps);const original=initial.region!;replace({...initial,region:{start:edge==='start'?Math.min(at,original.end-1):original.start,end:edge==='end'?Math.max(at,original.start+1):original.end}});});const move=(event:PointerEvent)=>drag.push(event.clientX);const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);drag.flush();history.current.push(initial);};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});}
 // Arrastrar los extremos de la región de bucle: mismo gesto que los del tramo, pero sobre el bucle.
 function dragLoopRegion(ev:ReactPointerEvent,edge:'start'|'end'){if(!p?.loopRegion||ev.button!==0)return;ev.stopPropagation();pause();const initial=clone(p);const ruler=ev.currentTarget.closest('.ruler') as HTMLElement|null;const rect=ruler?.getBoundingClientRect();const drag=frameThrottle<number>(clientX=>{const at=quantize(Math.max(0,ticks((clientX-(rect?.left??0))/zoom)),p.fps);const original=initial.loopRegion!;replace({...initial,loopRegion:{start:edge==='start'?Math.min(at,original.end-1):original.start,end:edge==='end'?Math.max(at,original.start+1):original.end}});});const move=(event:PointerEvent)=>drag.push(event.clientX);const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);drag.flush();history.current.push(initial);};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});}
 function wheelTimeline(event:WheelEvent){if(!pRef.current)return;const element=event.currentTarget as HTMLElement;const lines=event.deltaMode===1?16:event.deltaMode===2?element.clientHeight:1;
  // Ctrl/Cmd + rueda (y Alt + rueda) desplazan la línea de tiempo en vertical, de arriba abajo. Hay que
  // cancelar el evento para que el navegador no aplique su propio zoom de página.
  if(event.ctrlKey||event.metaKey||event.altKey){event.preventDefault();element.scrollTop+=event.deltaY*lines;return;}
  if(event.shiftKey)return; // El navegador desplaza en horizontal con Mayús + rueda.
  event.preventDefault();zoomAt(Math.exp(-event.deltaY*lines*.0015));}
 const hasProject=!!p;
 useEffect(()=>{const element=timeline.current;if(!element)return;const observer=new ResizeObserver(()=>setTimelineViewport(element.clientWidth));setTimelineViewport(element.clientWidth);observer.observe(element);return()=>observer.disconnect();},[hasProject]);
 useLayoutEffect(()=>{if(fitTimeline)zoomTo(0);},[timelineViewport,timelineSpan]);

 useEffect(()=>{const element=timeline.current;if(!element)return;const handler=(event:WheelEvent)=>wheelTimeline(event);element.addEventListener('wheel',handler,{passive:false});return()=>element.removeEventListener('wheel',handler);},[hasProject]);
 function save(){if(!p)return;try{saveLocal(p);downloadProject(p);setStatus('Proyecto descargado. El archivo .corte15 contiene ediciones y referencias; no contiene tus videos.');}catch(e){report(e);}}
 async function adoptProject(next:Project){library.current.dispose();history.current=new History();replace(next);setSelected([]);seek(0);await restoreMedia(next);}
 async function openProject(file:File){pause();try{const bytes=new Uint8Array(await file.arrayBuffer());const text=new TextDecoder().decode(bytes);const kind=detectInterchange(file.name,text);if(kind==='veg'){await openVeg(file);return;}if(kind==='corte15'){await adoptProject(parseProject(text));return;}const {project,report:summary}=parseInterchange(file.name,text);await adoptProject(project);setImportReport(summary);setDialog('import');}catch(e){report(e);}}
 async function relink(file:File){if(!p||!relinkId)return;setBusy(true);try{const old=p.media.find(m=>m.id===relinkId)!;const meta=await library.current.import(file);if(meta.kind!==old.kind||meta.duration<Math.max(0,...p.events.filter(e=>e.mediaId===old.id&&e.kind!=='image').map(e=>e.offset+e.duration*e.speed))){const r=library.current.items.get(meta.id);r?.input?.dispose();r?.image?.close();library.current.pcmBytes-=r?.pcm?.channels.reduce((s,c)=>s+c.byteLength,0)||0;library.current.items.delete(meta.id);throw new Error('El reemplazo tiene un tipo incompatible o no contiene toda la duración utilizada.');}const r=library.current.items.get(meta.id)!;library.current.items.delete(meta.id);library.current.pcmBytes-=r.pcm?.channels.reduce((s,c)=>s+c.byteLength,0)||0;library.current.replace(old.id,r);meta.id=old.id;edit(d=>{d.media=d.media.map(m=>m.id===old.id?meta:m);});if(cacheMedia)await storeFile(old.id,file);setStatus('Medio revinculado.');}catch(e){report(e);}finally{setBusy(false);}}
 function snapTime(value:number,exclude:string[]=[]){if(!p)return value;let v=quantize(value,p.fps);if(!snap)return v;const points=[0,cursor,...p.markers.map(m=>m.time),...p.events.filter(e=>!exclude.includes(e.id)).flatMap(e=>[e.start,e.start+e.duration])];const threshold=ticks(8/zoom);const target=points.sort((a,b)=>Math.abs(a-v)-Math.abs(b-v))[0];if(Math.abs(target-v)<threshold)v=target;return Math.max(0,v);}
 function dragEvent(ev:ReactPointerEvent,e:Event,mode:'move'|'left'|'right'|'fadeIn'|'fadeOut'){
  if(ev.button!==0||rendering)return;
  // Un evento bloqueado («Bloqueo» de sus Propiedades) no se mueve ni se recorta: se avisa y no se arrastra.
  if(lockedIds(p!).has(e.id)){ev.stopPropagation();setSelected([e.id]);setStatus(`«${e.name}» está bloqueado: desmarca «Bloqueo» en sus Propiedades para poder moverlo o recortarlo.`);return;}ev.stopPropagation();setTrackId(null);const lane=(ev.currentTarget as HTMLElement).closest('.track-lane');if(lane){const rect=lane.getBoundingClientRect();seek(quantize(Math.max(0,ticks((ev.clientX-rect.left)/zoom)),p!.fps));}else pause();const initial=p!;let ids=selected.includes(e.id)?selected:[e.id];if(ev.shiftKey||ev.ctrlKey||ev.metaKey)ids=selected.includes(e.id)?selected.filter(id=>id!==e.id):[...selected,e.id];setSelected(ids);if(ev.shiftKey||ev.ctrlKey||ev.metaKey)return;ids=linkedIds(initial,ids);const startX=ev.clientX;let changed=false;
  // Mover o recortar copia el proyecto y lo sustituye: se aglutina a un repintado por fotograma (el ratón emite
  // muchos más movimientos que fotogramas) y se fuerza el último al soltar, que es donde queda el evento.
  const apply=frameThrottle<PointerEvent>((event)=>{let d=ticks((event.clientX-startX)/zoom);if(Math.abs(event.clientX-startX)<2&&!changed)return;changed=true;const next=clone(initial);if(mode==='move'){d=snapTime(e.start+d,ids)-e.start;d=Math.max(d,-Math.min(...initial.events.filter(x=>ids.includes(x.id)).map(x=>x.start)));const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-track]')?.getAttribute('data-track');for(const x of next.events.filter(x=>ids.includes(x.id))){x.start+=d;if(target&&x.trackId===e.trackId&&next.tracks.find(t=>t.id===target)?.kind===(x.kind==='audio'?'audio':'video'))x.trackId=target;}if(ripple!=='off'){const blockEnd=Math.max(...initial.events.filter(x=>ids.includes(x.id)).map(x=>x.start+x.duration));const tracks=new Set(initial.events.filter(x=>ids.includes(x.id)).map(x=>x.trackId));for(const x of next.events){if(ids.includes(x.id))continue;if(x.start>=blockEnd-1&&(ripple==='all'||tracks.has(x.trackId)))x.start=Math.max(0,x.start+d);}}}
   else if(mode==='left'||mode==='right'){const edge=mode==='left'?e.start:e.start+e.duration;d=snapTime(edge+d,ids)-edge;trim(next,e.id,mode,d,ripple);}else{const x=next.events.find(x=>x.id===e.id)!;x.gainCurve=undefined;x[mode]=Math.min(x.duration,Math.max(0,quantize(e[mode]+(mode==='fadeOut'?-d:d),next.fps)));}replace(next);});
  const move=(event:PointerEvent)=>apply.push(event);
  const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);apply.flush();if(changed){history.current.push(initial);const next=clone(pRef.current!);if(mode==='move')autoCrossfade(next,ids);replace(next);}};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});
 }
 function resize(ev:ReactPointerEvent,kind:'upper'|'left'|'track'|'meters',id?:string){ev.preventDefault();const startX=ev.clientX,startY=ev.clientY,original=kind==='upper'?upperHeight:kind==='left'?leftWidth:kind==='meters'?metersWidth:p!.tracks.find(t=>t.id===id)!.height;const initial=clone(p!);const move=(event:PointerEvent)=>{if(kind==='upper')setUpperHeight(Math.max(25,Math.min(70,original+(event.clientY-startY)/window.innerHeight*100)));else if(kind==='left')setLeftWidth(Math.max(28,Math.min(68,original+(event.clientX-startX)/window.innerWidth*100)));else if(kind==='meters')setMetersWidth(Math.max(54,Math.min(420,original+(startX-event.clientX))));else{const next=clone(initial);next.tracks.find(t=>t.id===id)!.height=Math.max(60,Math.min(220,original+event.clientY-startY));replace(next);}};const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);if(kind==='track')history.current.push(initial);};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});}
 // Arrastrar sobre la regla o sobre un hueco de la línea de tiempo define el tramo de renderizado; un clic
 // suelto solo mueve la aguja. Con Ctrl o Cmd el mismo gesto define la región de bucle, que es independiente
 // del tramo: el tramo dice qué se renderiza y el bucle qué se repite al reproducir.
 function beginRegionDrag(ev:ReactPointerEvent,rect:{left:number}){
  if(!p||ev.button!==0)return;
  const which:'region'|'loopRegion'=(ev.ctrlKey||ev.metaKey)?'loopRegion':'region';
  const at=(clientX:number)=>quantize(Math.max(0,ticks((clientX-rect.left)/zoom)),p.fps);
  const origin=at(ev.clientX);seek(origin);
  const initial=p;let moved=false;
  // El tramo se recalcula a cada movimiento, pero cada recálculo sustituye el proyecto entero: se aglutina a un
  // repintado por fotograma y se fuerza el último al soltar para que el tramo acabe donde quedó el puntero.
  const drag=frameThrottle<number>(clientX=>{moved=true;const range=normalizeRange(origin,at(clientX),initial.fps);replace(which==='loopRegion'?{...initial,loopRegion:range}:{...initial,region:range});});
  const move=(event:PointerEvent)=>{if(!moved&&Math.abs(event.clientX-ev.clientX)<4)return;drag.push(event.clientX);};
  const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);drag.flush();if(!moved)return;history.current.push(initial);const current=pRef.current;if(!current)return;const range=which==='loopRegion'?current.loopRegion:current.region;if(!range)return;setStatus(which==='loopRegion'
    ?`Bucle: ${tc(range.start)} → ${tc(range.end)} · ${seconds(range.end-range.start).toFixed(2)} s. Actívalo con Alt+L: la reproducción se repetirá dentro de esta zona, sin tocar el tramo de renderizado.`
    :`Tramo: ${tc(range.start)} → ${tc(range.end)} · ${seconds(range.end-range.start).toFixed(2)} s. Elige «Tramo» en Renderizar como… para renderizar solo esta parte.`);};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});
 }
 function rulerPointer(ev:ReactPointerEvent){
  if(!p||ev.button!==0)return;
  const rect=ev.currentTarget.getBoundingClientRect();
  // La regla tiene tres formas de responder, como la de VEGAS: si el puntero cae sobre la aguja (a menos de
  // unos píxeles de ella) se la lleva; en la franja de abajo —donde se dibuja la cabeza— también se la mueve; y
  // en el resto se marca el tramo de renderizado (o la región de bucle, con Ctrl o Cmd), que es lo que ya hacía.
  const distance=Math.abs(ev.clientX-rect.left-seconds(cursorRef.current)*zoom);
  if(distance<=PLAYHEAD_GRAB_PIXELS)return scrubFromRuler(ev,rect,false);
  if(ev.clientY-rect.top>=RULER_SCRUB_BAND)return scrubFromRuler(ev,rect);
  beginRegionDrag(ev,rect);
 }
 // Arrastrar la aguja con el puntero: el cursor sigue al puntero, con el ajuste magnético de la línea de tiempo.
 // `jump` distingue el clic —que coloca la aguja donde se pulsa— del agarre de la aguja, que la mueve solo al
 // arrastrar: así agarrarla a unos píxeles de la línea no la hace saltar.
 function scrubFromRuler(ev:{clientX:number},rect:{left:number},jump=true){
  if(!p)return;
  pause();
  const at=(clientX:number)=>snapTime(ticks(Math.max(0,clientX-rect.left)/zoom));
  if(jump)seek(at(ev.clientX));
  // Un gesto de arrastre llega con muchos más `pointermove` que fotogramas hay: se aglutina a uno por fotograma
  // y se fuerza el último al soltar, así la aguja termina donde quedó el puntero sin encolar repintados.
  const drag=frameThrottle<number>(clientX=>seek(at(clientX)));
  const move=(event:PointerEvent)=>drag.push(event.clientX);
  const up=()=>{window.removeEventListener('pointermove',move);drag.flush();};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});
 }
 // La aguja también se agarra desde los carriles, no solo desde la regla: si el clic cae a menos de
 // `PLAYHEAD_GRAB_PIXELS` de la línea, el gesto es para moverla —igual que en la regla— y no para mover o
 // seleccionar el evento que hay debajo, ni para marcar el tramo en un hueco. Devuelve el rectángulo del
 // contenido (el origen de los tiempos) cuando el puntero está sobre la aguja.
 function playheadRect(ev:{clientX:number;currentTarget:EventTarget|null}){
  const content=(ev.currentTarget as HTMLElement|null)?.closest('.timeline-content') as HTMLElement|null;
  if(!content)return null;
  const rect=content.getBoundingClientRect();
  return Math.abs(ev.clientX-rect.left-seconds(cursorRef.current)*zoom)<=PLAYHEAD_GRAB_PIXELS?rect:null;
 }
 // El agarre desde un carril se hace en la **fase de captura**: así la aguja se lleva antes que el evento de
 // debajo, la envolvente o el hueco, y ninguno de ellos llega a empezar su gesto.
 function playheadGrab(ev:ReactPointerEvent){
  if(ev.button!==0)return;
  const rect=playheadRect(ev);
  if(!rect)return;
  ev.stopPropagation();
  scrubFromRuler(ev,rect,false);
 }
 // Para el «clic para añadir un punto» de la envolvente, que va por `onClick`: si el clic cayó sobre la aguja,
 // el gesto era para moverla y no se añade nada.
 function playheadPress(ev:{clientX:number;currentTarget:EventTarget|null}){
  const rect=playheadRect(ev);
  if(!rect)return false;
  scrubFromRuler(ev,rect,false);
  return true;
 }
 // Mantener el clic en la aguja la desplaza a izquierda o derecha, respetando el ajuste magnético.
 function dragPlayhead(ev:ReactPointerEvent){
  if(!p||ev.button!==0||rendering)return;
  ev.stopPropagation();ev.preventDefault();pause();setDraggingPlayhead(true);
  const content=ev.currentTarget.parentElement;if(!content)return;
  const rect=content.getBoundingClientRect();
  const at=(clientX:number)=>snapTime(ticks(Math.max(0,clientX-rect.left)/zoom));
  const drag=frameThrottle<number>(clientX=>seek(at(clientX)));
  const move=(event:PointerEvent)=>drag.push(event.clientX);
  const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);drag.flush();setDraggingPlayhead(false);};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});
 }
// ---------------------------------------------------------------- redimensionar desde la vista previa
// El tamaño del medio del evento, para que la caja de la vista previa sea la del contenido y no la del
// fotograma (los títulos y los generadores ocupan el fotograma entero).
 function previewSource(event:Event){const media=pRef.current?.media.find(item=>item.id===event.mediaId);return media&&media.width&&media.height?{width:media.width,height:media.height}:null;}
 // Lo que se arrastra en la vista previa se guarda donde corresponde: con fotogramas clave, en la clave del
 // cursor; sin ellos, en la pose del evento. Si lo seleccionado es una pista, en la transformación de la pista.
 function updatePreviewPose(next:Transform){
  const current=pRef.current;if(!current)return;
  const event=selected.length?current.events.find(item=>item.id===selected[0]):undefined;
  if(event){
   if(event.keys.length){const local=cursor-event.start;edit(d=>{const target=d.events.find(item=>item.id===event.id);if(target)target.keys=upsertKey(target.keys,local,{...next,time:local});});}
   else updateEvent({transform:next});
   return;
  }
  if(trackId)updateTrack({transform:next});
 }
// ---------------------------------------------------------------- quitar bandas negras
// Lo que hace el script «Remove Letterboxing.cs» de VEGAS Pro 15 (encajar el contenido a la relación del
// proyecto) y, además, lo que ese script no mira: la banda negra incrustada en el propio archivo, detectada
// analizando los píxeles del medio. Sin selección se aplica a todos los eventos de vídeo, como el script.
 function letterboxTargets():Event[]{
  const current=pRef.current;if(!current)return[];
  const visual=(event:Event)=>event.kind==='video'||event.kind==='image';
  const chosen=current.events.filter(event=>selected.includes(event.id)&&visual(event));
  if(chosen.length)return chosen;
  return current.events.filter(visual);
 }
 // Los píxeles del fotograma del medio, para buscar la banda negra de verdad. Se lee de la imagen ya decodificada
 // (fotos) o del primer fotograma del vídeo; nunca se ejecuta nada del archivo, solo se miran sus píxeles.
 async function mediaPixels(media:Media):Promise<{data:Uint8ClampedArray;width:number;height:number}|null>{
  const runtime=library.current.items.get(media.id);if(!runtime)return null;
  const draw=(source:CanvasImageSource,width:number,height:number)=>{
   try{
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,width);canvas.height=Math.max(1,height);
    const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return null;
    ctx.drawImage(source,0,0,canvas.width,canvas.height);
    return {data:ctx.getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height};
   }catch{return null;}
  };
  if(runtime.image)return draw(runtime.image,runtime.image.width,runtime.image.height);
  if(runtime.canvas)try{
   const frame=await runtime.canvas.getCanvas(runtime.firstVideo);
   if(frame)return draw(frame.canvas,frame.canvas.width,frame.canvas.height);
  }catch{return null;}
  return null;
 }
 async function removeLetterboxing(mode:'detect'|'cover'|'fit'){
  const current=pRef.current;if(!current)return;
  const targets=letterboxTargets();
  if(!targets.length){setStatus('No hay eventos de vídeo a los que quitar las bandas.');return;}
  setBusy(true);
  try{
   const project={width:current.width,height:current.height};
   const notes:string[]=[];let changed=0;
   if(mode==='cover'||mode==='fit'){
    const patches=new Map<string,Transform>();
    for(const event of targets){
     const media=current.media.find(item=>item.id===event.mediaId);
     if(!media||!media.width||!media.height){notes.push(`«${event.name}»: sin medio del que sacar la relación`);continue;}
     const currentPose=pose(event,cursor);
     const size={width:media.width,height:media.height};
     const next=mode==='cover'?fillFrame({project,media:size,pose:currentPose}):fitFrame({project,media:size,pose:currentPose});
     if(Math.abs(next.scale-currentPose.scale)>1e-6){patches.set(event.id,next);changed+=1;}
     notes.push(`«${event.name}»: ${describeFit(project,size)}`);
    }
    if(patches.size)edit(d=>{for(const [id,next] of patches){const target=d.events.find(item=>item.id===id);if(target)target.transform=next;}});
    setStatus(patches.size
     ? (mode==='cover'
      ? `Contenido encajado al fotograma en ${patches.size} evento(s): ahora cubre el fotograma sin deformarse (lo que sobra se sale del encuadre). ${notes[0]??''}`
      : `Contenido ajustado al fotograma en ${patches.size} evento(s): entra entero, con bandas si su relación no es la del proyecto. ${notes[0]??''}`)
     : `Ningún evento necesitaba ${mode==='cover'?'encaje':'ajuste'}: ya estaba así.`);
    void changed;
    return;
   }
   const masks=new Map<string,CropMask>();
   for(const event of targets){
    const media=current.media.find(item=>item.id===event.mediaId);
    if(!media){notes.push(`«${event.name}»: sin medio que analizar`);continue;}
    const pixels=await mediaPixels(media);
    if(!pixels){notes.push(`«${event.name}»: no se pudieron leer los píxeles`);continue;}
    const bars=detectBars(pixels.data,pixels.width,pixels.height);
    if(!bars){notes.push(`«${event.name}»: sin bandas`);continue;}
    masks.set(event.id,barsToMask(bars));changed+=1;
    notes.push(`«${event.name}»: ${describeBars(bars)}`);
   }
   if(masks.size)edit(d=>{for(const [id,mask] of masks){const target=d.events.find(item=>item.id===id);if(target)target.mask=mask;}});
   setStatus(masks.size?`Bandas negras recortadas en ${masks.size} evento(s): ${notes.filter(note=>!note.endsWith('sin bandas')).join(' · ')}`:`No se encontraron bandas negras en ${targets.length} evento(s) de vídeo.`);
  }finally{setBusy(false);}
 }
 // ---------------------------------------------------------------- exportar los marcadores
 function openMarkerExport(){setDialog('markers');}
 function downloadMarkers(){
  const current=pRef.current;if(!current)return;
  const format=markerFormatById(markerFormat);
  const text=buildMarkerExport(current.markers,format.value,current.fps,current.timecodeFormat??'non-drop',endTime(current));
  const base=current.name.replace(/[\\/:*?"<>|]/g,'-').trim()||'proyecto';
  download(new Blob([text],{type:'text/plain;charset=utf-8'}),`${base}-${format.value==='srt'?'subtitulos':'capitulos'}.${format.extension}`);
  setStatus(`Exportados ${current.markers.length} marcador(es) como «${format.label}».`);
 }
 function updateEvent(change:Partial<Event>){edit(d=>{const e=d.events.find(e=>e.id===selected[0]);if(e){if(change.fadeIn!==undefined||change.fadeOut!==undefined)e.gainCurve=undefined;Object.assign(e,change);}});}
 function updateTrack(change:Partial<Track>){edit(d=>{const t=d.tracks.find(t=>t.id===trackId);if(t)Object.assign(t,change);});}
 // Plantillas de proyecto (TikTok, Reels, Shorts, cine…): cambian el tamaño del fotograma, la velocidad y la
 // frecuencia de audio. No mueven lo que ya está montado; para reencuadrar está la ventana de recorte.
 function applyTemplate(id:string){
  const template=templateById(id);if(!template)return;
  edit(d=>{const next=applyProjectTemplate(d,id);d.width=next.width;d.height=next.height;d.fps=next.fps;d.sampleRate=next.sampleRate;});
  setStatus(`Plantilla «${template.name}»: ${describeFormat(applyProjectTemplate(pRef.current??newProject(),id))}. Los eventos no se han movido.`);
 }
 function moveTrack(id:string,direction:-1|1){
  const current=pRef.current;if(!current)return;
  const index=current.tracks.findIndex(t=>t.id===id);if(index<0)return;
  const track=current.tracks[index];
  let target=index+direction;
  while(target>=0&&target<current.tracks.length&&current.tracks[target].kind!==track.kind)target+=direction;
  if(target<0||target>=current.tracks.length){setStatus(`La pista «${track.name}» ya está en el extremo de su grupo (${track.kind==='video'?'vídeo':'audio'}).`);return;}
  pause();
  edit(d=>{[d.tracks[index],d.tracks[target]]=[d.tracks[target],d.tracks[index]];});
  setStatus(`Pista «${track.name}» movida a la posición ${target+1} de ${current.tracks.length}. Puedes deshacerlo con Ctrl/Cmd+Z.`);
 }
 // Reordenar arrastrando: la pista se coloca en la posición de la cabecera sobre la que se suelta, sin salir
 // de su grupo (las de vídeo entre las de vídeo y las de audio entre las de audio).
 function dragTrackOrder(ev:ReactPointerEvent,id:string){
  const startY=ev.clientY;let moved=false;
  const headers=()=>Array.from(document.querySelectorAll<HTMLElement>('#track-headers .track-header'));
  const move=(event:PointerEvent)=>{
   if(!moved&&Math.abs(event.clientY-startY)<6)return;
   moved=true;
   const list=headers();if(!list.length)return;
   let index=list.findIndex(node=>{const rect=node.getBoundingClientRect();return event.clientY>=rect.top&&event.clientY<=rect.bottom;});
   if(index<0)index=event.clientY<list[0].getBoundingClientRect().top?0:list.length-1;
   trackDropRef.current=index;setTrackDropIndex(index);
  };
  const up=()=>{
   window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);
   const target=trackDropRef.current;trackDropRef.current=null;setTrackDropIndex(null);
   if(moved&&target!==null)reorderTrack(id,target);
  };
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});
 }
 function reorderTrack(id:string,index:number){
  const current=pRef.current;if(!current)return;
  const from=current.tracks.findIndex(t=>t.id===id);if(from<0)return;
  const track=current.tracks[from];
  const remaining=current.tracks.filter((_,position)=>position!==from);
  const sameKind=remaining.map((item,position)=>({kind:item.kind,position})).filter(entry=>entry.kind===track.kind);
  // El rango admite el hueco justo después del último hermano del mismo grupo, para poder bajar una pista.
  const first=sameKind.length?sameKind[0].position:from;
  const last=sameKind.length?sameKind[sameKind.length-1].position:from;
  const to=Math.max(first,Math.min(last+1,index));
  if(to===from)return;
  pause();
  edit(d=>{const [moved]=d.tracks.splice(from,1);d.tracks.splice(to,0,moved);});
  setStatus(`Pista «${track.name}» movida a la posición ${to+1} de ${current.tracks.length}. Puedes deshacerlo con Ctrl/Cmd+Z.`);
 }
 // Eliminar una pista se lleva sus eventos. Queda en el historial, así que Ctrl/Cmd+Z lo restaura.
 function removeTrack(id:string){const current=pRef.current;if(!current)return;const track=current.tracks.find(t=>t.id===id);if(!track)return;const count=current.events.filter(e=>e.trackId===id).length;pause();edit(d=>{d.events=d.events.filter(e=>e.trackId!==id);d.tracks=d.tracks.filter(t=>t.id!==id);});setSelected([]);setTrackId(null);setStatus(`Pista «${track.name}» eliminada${count?` con sus ${count} evento(s)`:''}. Puedes deshacerlo con Ctrl/Cmd+Z.`);}
 // ------------------------------------------------------------------ clic derecho del editor
 // El menú del navegador no sabe nada del proyecto, así que dentro del editor el clic derecho abre el menú que
 // corresponde a la zona donde está el puntero: un evento, la cabecera de una pista, su carril, la regla, un
 // hueco de la línea de tiempo, un medio del panel o el monitor. Las zonas que ya atienden el clic derecho por
 // su cuenta (marcador, tramo, región de bucle) lo marcan con `defaultPrevented` y aquí no se toca nada.
 function openContextMenu(event:React.MouseEvent,items:WorkspaceMenuItem[],title?:string){
  event.preventDefault();event.stopPropagation();
  setContextMenu({x:event.clientX,y:event.clientY,title,items:items.filter((item,index)=>item.separator?index>0&&index<items.length-1:true)});
 }
 function workspaceContextMenu(event:React.MouseEvent){
  if(event.defaultPrevented)return;                       // ya lo atendió la zona (marcador, tramo, bucle)
  const target=event.target as HTMLElement;
  const current=pRef.current;if(!current)return;
  const clip=target.closest('.timeline-event') as HTMLElement|null;
  if(clip){
   const id=clip.dataset.eventId;const e=current.events.find(item=>item.id===id);
   if(e){
    setSelected(ids=>ids.includes(e.id)?ids:[e.id]);
    openContextMenu(event,eventMenuItems(current,e),e.name);
    return;
   }
  }
  const header=target.closest('.track-header') as HTMLElement|null;
  if(header){const id=header.dataset.track;if(id){openContextMenu(event,trackMenuItems(id),`Pista ${current.tracks.find(t=>t.id===id)?.name??''}`);return;}}
  const lane=target.closest('.track-lane') as HTMLElement|null;
  if(lane){const id=lane.dataset.track;if(id){setTrackId(id);openContextMenu(event,[
   {label:'Propiedades de la pista…',hint:'Pan/Crop de la pista',onSelect:()=>{setTrackId(id);setDialog('track');}},
   {label:'Movimiento de pista…',onSelect:()=>{setTrackId(id);setDialog('trackmotion');}},
   ...trackMenuItems(id),
   {separator:true},
   {label:'Marcador en el cursor',hint:'M',onSelect:marker},
   {label:'Pegar aquí',disabled:!clipboard.current.length,onSelect:()=>paste()},
  ],`Carril de ${current.tracks.find(t=>t.id===id)?.name??''}`);return;}}
  const ruler=target.closest('.ruler');
  if(ruler){openContextMenu(event,[
   {label:'Marcar el inicio del tramo aquí',hint:'[',onSelect:markRangeStart},
   {label:'Marcar el fin del tramo aquí',hint:']',onSelect:markRangeEnd},
   {label:'Quitar el tramo',disabled:!current.region,onSelect:clearRange},
   {separator:true},
   {label:'Marcar el inicio del bucle aquí',hint:'L',onSelect:markLoopStart},
   {label:'Marcar el fin del bucle aquí',hint:'Mayús+L',onSelect:markLoopEnd},
   {label:'Bucle desde el tramo',disabled:!current.region,onSelect:loopFromRegion},
   {label:'Repetir la región de bucle',checked:loop,onSelect:toggleLoop,disabled:!current.loopRegion},
   {label:'Quitar la región de bucle',disabled:!current.loopRegion,onSelect:clearLoop},
   {separator:true},
   {label:'Marcador en el cursor',hint:'M',onSelect:marker},
   {label:'Exportar los marcadores…',disabled:!current.markers.length,onSelect:openMarkerExport},
   {label:'Ir al inicio',hint:'Inicio',onSelect:()=>seek(0)},
  ],'Regla de la línea de tiempo');return;}
  const media=target.closest('.media-item') as HTMLElement|null;
  if(media){const id=media.dataset.mediaId;const m=current.media.find(item=>item.id===id);if(m){setMediaSelected(m.id);openContextMenu(event,[
   {label:'Insertar en el cursor',hint:'doble clic',onSelect:()=>insertMedia(m)},
   {label:'Abrir en el trimmer…',onSelect:()=>{setMediaSelected(m.id);setDialog('trimmer');}},
   {label:'Revincular con un archivo…',onSelect:()=>{setRelinkId(m.id);relinkInput.current?.click();}},
   {separator:true},
   {label:m.sourcePath?`Origen: ${m.sourcePath}`:'Sin ruta de origen',disabled:true},
  ],m.name);return;}}
  if(target.closest('.monitor')){openContextMenu(event,[
   {label:'Propiedades del proyecto…',onSelect:()=>setDialog('project')},
   {label:'Reproducir o pausar',hint:'Espacio',onSelect:transport},
   {label:'Ir al inicio',onSelect:()=>seek(0)},
   {label:'Ir al final',onSelect:()=>seek(endTime(current))},
   {separator:true},
   {label:'Renderizar como…',onSelect:openExport},
  ],'Vista previa de vídeo');return;}
  // Cualquier otro punto del editor (hueco de la línea de tiempo, paneles, barras): menú del proyecto.
  openContextMenu(event,[
   {label:'Pegar en el cursor',hint:'Ctrl/Cmd+V',disabled:!clipboard.current.length,onSelect:()=>paste()},
   {label:'Dividir en el cursor',hint:'S',onSelect:doSplit},
   {separator:true},
   {label:'Pista de vídeo nueva',onSelect:()=>edit(d=>d.tracks.unshift(newTrack('video')))},
   {label:'Pista de audio nueva',onSelect:()=>edit(d=>d.tracks.push(newTrack('audio')))},
   {label:'Marcador en el cursor',hint:'M',onSelect:marker},
   {separator:true},
   {label:'Ajuste magnético',checked:snap,onSelect:()=>setSnap(!snap)},
   {label:'Propiedades del proyecto…',onSelect:()=>setDialog('project')},
   {label:'Funciones y atajos…',onSelect:()=>setDialog('help')},
  ],'Corte 15');
 }
 // ------------------------------------------------ atributos del evento: copiar y pegar
 // Es el «Copiar/Pegar atributos de evento» de VEGAS: se copian el aspecto y los ajustes (efectos, plantilla
 // de texto, encuadre y recorte, generador, color, fundidos, transición, velocidad y audio), nunca el material
 // ni los tiempos. Al pegar se pueden elegir los grupos.
 function copyEventAttributes(id:string,groups?:AttributeGroupId[]){
  const current=pRef.current;if(!current)return;
  const event=current.events.find(item=>item.id===id);if(!event)return;
  const copied=copyAttributes(event,groups);
  setCopiedAttributes(copied);
  if(!attributeCount(copied)){setStatus(`«${event.name}» no tiene efectos ni estilo que copiar.`);return;}
  setStatus(`Atributos copiados de «${event.name}»: ${describeAttributes(copied)}.`);
 }
 function pasteEventAttributes(id:string,groups:AttributeGroupId[]){
  const current=pRef.current;if(!current||!copiedAttributes||!groups.length)return;
  const event=current.events.find(item=>item.id===id);if(!event)return;
  edit(d=>{const index=d.events.findIndex(item=>item.id===id);if(index<0)return;d.events[index]=pasteAttributes(d.events[index],copiedAttributes!,groups);});
  setStatus(`Atributos pegados en «${event.name}»: ${groups.map(group=>groupById(group)?.label??group).join(', ')}.`);
 }
 function openAttributeDialog(id:string){
  const current=pRef.current;if(!current||!copiedAttributes)return;
  const event=current.events.find(item=>item.id===id);if(!event)return;
  const groups=pasteableGroups(copiedAttributes,event.kind);
  if(!groups.length){setStatus(`Lo copiado de «${copiedAttributes.from}» no se puede pegar en «${event.name}».`);return;}
  setSelected([id]);setAttributeTarget({id,groups});setDialog('attributes');
 }
 // Con las teclas: Ctrl/Cmd+Mayús+C copia de lo seleccionado y Ctrl/Cmd+Mayús+V pega en lo seleccionado.
 function copySelectedAttributes(){const id=selected[0];if(id)copyEventAttributes(id);else setStatus('Selecciona un evento para copiar sus efectos y su estilo.');}
 function pasteSelectedAttributes(){
  const id=selected[0];if(!id)return;
  if(!copiedAttributes){setStatus('No hay atributos copiados: usa «Copiar los efectos y el estilo» en el menú del clic derecho.');return;}
  const event=pRef.current?.events.find(item=>item.id===id);
  if(!event)return;
  pasteEventAttributes(id,pasteableGroups(copiedAttributes,event.kind));
 }
 // ------------------------------------------- menú del evento (réplica del de VEGAS Pro 15)
 // La lista, el orden y los separadores son los de los recursos POPUP_IDX_VIDEO_SURFACE (evento de vídeo) y
 // POPUP_IDX_AUDIO_EVENT (evento de audio) de vegas150.exe en español; ver outputs/rea/vegas150-es-evento.txt.
 // Las entradas cuyo equivalente no existe en este motor salen desactivadas y lo dicen en su pista, en lugar de
 // aparentar que hacen algo.
 function openEventDialog(id:string){setSelected([id]);setDialog('event');}
 // «Cancelar» de la ventana de Propiedades: el evento vuelve a como estaba al abrirla.
 function cancelEventDialog(){
  const snapshot=eventSnapshot.current;eventSnapshot.current=null;
  if(snapshot)edit(d=>{for(const saved of snapshot.events){const index=d.events.findIndex(item=>item.id===saved.id);if(index>=0)d.events[index]=clone(saved);}});
  setDialog('');
  setStatus(snapshot?`Cambios descartados: ${snapshot.events.length} evento(s) vuelven a como estaban al abrir la ventana.`:'Ventana cerrada.');
 }
 function selectEventMedia(e:Event){
  if(!e.mediaId)return;
  setTab('media');setFilter('all');setMediaSelected(e.mediaId);
  setStatus(`«${e.name}» seleccionado en la lista de medios del proyecto.`);
 }
 function selectToEnd(e:Event){
  const current=pRef.current;if(!current)return;
  const ids=current.events.filter(item=>item.trackId===e.trackId&&item.start>=e.start).map(item=>item.id);
  setSelected(ids);
  setStatus(`Seleccionados ${ids.length} evento(s) de la pista desde «${e.name}» hasta el final.`);
 }
 // Interruptores del evento («Modificadores»). Se aplican a los eventos enlazados del mismo grupo.
 function setSwitch(e:Event,key:'muted'|'locked'|'loop'|'maintainAspect'|'reduceFlicker'|'conform'|'reversed'|'invertPhase',value:boolean){
  const ids=linkedIds(pRef.current??newProject(),[e.id]);
  edit(d=>{for(const event of d.events)if(ids.includes(event.id))event[key]=value;});
  const labels:Record<string,string>={muted:'Silencio',locked:'Bloqueo',loop:'Bucle',maintainAspect:'Mantener relación de aspecto',reduceFlicker:'Reducir parpadeo de entrelazado',conform:'Ajustarse a la velocidad de fotogramas del proyecto',reversed:'Invertir',invertPhase:'Invertir fase'};
  setStatus(`«${e.name}»: ${labels[key]} ${value?'activado':'desactivado'}.${value&&key==='locked'?' El evento queda bloqueado: no se moverá ni se recortará hasta desmarcarlo.':''}`);
 }
 function setResample(e:Event,mode:ResampleMode){
  const ids=linkedIds(pRef.current??newProject(),[e.id]);
  edit(d=>{for(const event of d.events)if(ids.includes(event.id))event.resample=mode;});
  setStatus(`«${e.name}»: ${RESAMPLE_LABEL[mode]}.`);
 }
 // «Normalizar» de un evento de audio: sube su ganancia hasta que el pico del material llegue a 0 dBFS.
 function normalizeEventAudio(e:Event){
  const current=pRef.current;if(!current)return;
  const media=current.media.find(item=>item.id===e.mediaId);
  const peak=Math.max(0,...(media?.peaks??[]));
  if(!peak){setStatus(`«${e.name}»: todavía no hay picos calculados para normalizar.`);return;}
  const gain=Math.min(2,1/peak);
  edit(d=>{const event=d.events.find(item=>item.id===e.id);if(event)event.gain=gain;});
  setStatus(`«${e.name}» normalizado: ganancia ${gain.toFixed(3)} (pico del material ${(20*Math.log10(Math.max(1e-6,peak))).toFixed(1)} dBFS → 0 dBFS).`);
 }
 // «Congelar fotograma en el cursor» de VEGAS: crea un evento nuevo con la imagen del fotograma actual. Aquí el
 // fotograma se copia del monitor compuesto a un PNG y entra en la lista de medios como imagen fija de 10 s
 // (la duración predeterminada de imagen fija de VEGAS).
 async function freezeFrame(){
  const current=pRef.current;const surface=canvas.current;
  if(!current||!surface)return;
  try{
   setBusy(true);
   const blob=await new Promise<Blob|null>(resolve=>surface.toBlob(value=>resolve(value),'image/png'));
   if(!blob){setStatus('No se pudo copiar el fotograma: el lienzo de la vista previa está vacío.');return;}
   const name=`Fotograma ${tc(cursor)}.png`;
   const media=await library.current.import(new File([blob],name,{type:'image/png'}));
   const at=quantize(cursor,current.fps);
   edit(d=>{
    d.media.push(media);
    const id=d.events.find(item=>item.id===selected[0])?.trackId;
    let track=d.tracks.find(item=>item.id===id&&item.kind==='video')??d.tracks.find(item=>item.kind==='video');
    if(!track){track=newTrack('video');d.tracks.push(track);}
    const event={...newEvent(track.id,'image',at,ticks(10)),name,mediaId:media.id};
    d.events.push(event);setSelected([event.id]);
   });
   setStatus(`Fotograma congelado en ${tc(at)}: «${name}» (10 s) añadido a la línea de tiempo y a los medios del proyecto.`);
  }catch(e){report(e);}finally{setBusy(false);}
 }
 function setChannels(e:Event,channel:'both'|'left'|'right'|'combine'|'swap'){
  edit(d=>{const event=d.events.find(item=>item.id===e.id);if(event)event.channel=channel;});
  const labels:Record<string,string>={both:'Ambos',left:'Sólo izquierdo',right:'Sólo derecho',combine:'Combinar',swap:'Intercambiar'};
  setStatus(`«${e.name}» · canales: ${labels[channel]}.`);
 }
 // «Sincronizar ▸» : empareja los eventos seleccionados que comparten material con el del ancla.
 function applySync(e:Event,mode:'move'|'slip'){
  const current=pRef.current;if(!current)return;
  const ids=linkedIds(current,selected.includes(e.id)?selected:[e.id]);
  const changed=syncEvents(current,ids,e.id,mode);
  if(!changed.length){setStatus('No hay otros eventos seleccionados con el mismo material que sincronizar.');return;}
  edit(()=>{});
  setStatus(`${changed.length} evento(s) sincronizado(s) por ${mode==='move'?'desplazamiento':'deslizamiento'} con «${e.name}».`);
 }
 // «Recortar» (Ctrl+T) de VEGAS: recorta los eventos seleccionados a los bordes del tramo.
 function trimToRange(){
  const current=pRef.current;if(!current)return;
  if(!current.region){setStatus('«Recortar» (Ctrl+T) recorta los eventos al tramo: marca antes un tramo en la regla de la línea de tiempo.');return;}
  const locked=lockedIds(current);
  const targets=linkedIds(current,selected).filter(id=>!locked.has(id));
  if(!targets.length){setStatus('Los eventos seleccionados están bloqueados: desmarca «Bloqueo» para recortarlos.');return;}
  const region=current.region;
  edit(d=>{for(const id of targets){const before=d.events.find(item=>item.id===id);if(!before)continue;
   const left=region.start-before.start;if(left>0)trim(d,id,'left',left,'off');
   const now=d.events.find(item=>item.id===id);if(!now)continue;
   const tail=region.end-(now.start+now.duration);if(tail<0)trim(d,id,'right',tail,'off');}});
  setStatus(`Eventos recortados al tramo ${tc(region.start)} → ${tc(region.end)}: ${targets.length} evento(s).`);
 }
 // Submenú «Modificadores»: los mismos interruptores que VEGAS, con marca los que están activos.
 function switchItems(e:Event):WorkspaceMenuItem[]{
  const item=(key:'muted'|'locked'|'loop'|'maintainAspect'|'reduceFlicker'|'conform'|'invertPhase',label:string):WorkspaceMenuItem=>({label,checked:key==='maintainAspect'?(e.maintainAspect??true):Boolean(e[key]),onSelect:()=>setSwitch(e,key,!(key==='maintainAspect'?(e.maintainAspect??true):Boolean(e[key])))});
  const mode=(value:ResampleMode):WorkspaceMenuItem=>({label:RESAMPLE_LABEL[value],checked:(e.resample??'project')===value,onSelect:()=>setResample(e,value)});
  return e.kind==='audio'
   ?[item('muted','Silencio'),item('locked','Bloqueo'),item('loop','Bucle'),item('invertPhase','Invertir fase')]
   :[item('muted','Silencio'),item('locked','Bloqueo'),item('loop','Bucle'),item('maintainAspect','Mantener relación de aspecto'),item('reduceFlicker','Reducir parpadeo de entrelazado'),{separator:true},mode('project'),mode('force'),mode('off')];
 }
 function envelopeItems(e:Event):WorkspaceMenuItem[]{
  const sensitivity:WorkspaceMenuItem={label:'Sensibilidad',disabled:true,hint:'Este motor no ajusta la sensibilidad de la envolvente'};
  return e.kind==='audio'
   ?[{label:'Volumen',checked:envelopeMode==='volume',onSelect:()=>{setEnvelopeMode('volume');setStatus('Envolvente de volumen: se dibuja sobre el carril. En esta versión la envolvente es de la pista, no del evento.');}},
     {label:'Panoramización',checked:envelopeMode==='pan',onSelect:()=>{setEnvelopeMode('pan');setStatus('Envolvente de panoramización: se dibuja sobre el carril (de la pista, no del evento).');}},
     {label:'Envolventes de automatización de efectos',disabled:true,hint:'Cada efecto se ajusta en su propia ventana'},
     sensitivity]
   :[{label:'Nivel compuesto',disabled:true,hint:'Este motor solo tiene envolventes en las pistas de audio'},
     {label:'Desvanecimiento a color',disabled:true,hint:'Se ajusta con los fundidos de entrada y salida'},
     sensitivity];
 }
 function groupItems(e:Event):WorkspaceMenuItem[]{
  const current=pRef.current;if(!current)return[];
  const ids=linkedIds(current,[e.id]);
  return [
   {label:'Crear nuevo',disabled:!!e.group,onSelect:()=>group()},
   {label:'Eliminar de',items:[
    {label:'Borrar',disabled:!e.group,onSelect:()=>group(true)},
    {label:'Seleccionar todo',disabled:ids.length<2,onSelect:()=>{setSelected(ids);setStatus(`Grupo de «${e.name}»: ${ids.length} eventos seleccionados.`);}},
    {label:'Cortar todo',disabled:ids.length<2,onSelect:()=>{setSelected(ids);copyIds(ids,true);}},
    {label:'Copiar todo',disabled:ids.length<2,onSelect:()=>{setSelected(ids);copyIds(ids);}},
    {label:'Eliminar todo',disabled:ids.length<2,onSelect:()=>{edit(d=>removeEvents(d,ids,ripple));setSelected([]);}},
   ]},
  ];
 }
 function eventMenuItems(current:Project,e:Event):WorkspaceMenuItem[]{
  const pasteable=pasteableGroups(copiedAttributes,e.kind);
  const isLocked=lockedIds(current).has(e.id);
  const media=current.media.find(item=>item.id===e.mediaId);
  return [
   {label:'Abrir en recortadora',disabled:!media,hint:media?'':'El evento no tiene medio',onSelect:()=>{setSelected([e.id]);setDialog('trimmer');}},
   {label:'Seleccionar en lista de medios del proyecto',disabled:!media,onSelect:()=>selectEventMedia(e)},
   ...(e.kind==='audio'
    ?[{label:'Abrir medios principales en recortadora',disabled:!media,onSelect:()=>{setSelected([e.id]);setDialog('trimmer');}} as WorkspaceMenuItem,
      {label:'Abrir en editor de audio',disabled:true,hint:'Este editor no abre programas externos'},
      {label:'Abrir copia en editor de audio',disabled:true,hint:'Este editor no abre programas externos'},
      {label:'Editar proyecto de origen',disabled:true,hint:'Este editor no abre programas externos'},
      {label:'Efectos de evento de audio...',onSelect:()=>{setSelected([e.id]);setDialog('effects');}},
      {label:'Aplicar efectos de evento de tiempo no real...',disabled:true,hint:'Este motor procesa en tiempo real'},
     ]
    :[{label:'Editar medios generados...',disabled:!(e.kind==='text'||e.kind==='color'),hint:e.kind==='text'||e.kind==='color'?'':'El evento no es un medio generado',onSelect:()=>{setSelected([e.id]);setDialog(e.kind==='text'?'titles':'event');}},
      {label:'Efectos de medios...',onSelect:()=>{setSelected([e.id]);setDialog('effects');}},
      {label:'Panoramización/recorte de evento de vídeo...',onSelect:()=>{setSelected([e.id]);setDialog('pancrop');}},
      {label:'Efectos de evento de vídeo...',onSelect:()=>{setSelected([e.id]);setDialog('effects');}},
     ]),
   {separator:true},
   {label:'Cortar',hint:'Ctrl/Cmd+X',disabled:isLocked,onSelect:()=>{setSelected([e.id]);copyIds([e.id],true);}},
   {label:'Copiar',hint:'Ctrl/Cmd+C',onSelect:()=>{setSelected([e.id]);copyIds([e.id]);}},
   {label:'Pegar atributos de evento',hint:'Ctrl/Cmd+Mayús+V',disabled:!pasteable.length,onSelect:()=>pasteEventAttributes(e.id,pasteable)},
   {label:'Pegado selectivo de atributos de evento',disabled:!pasteable.length,onSelect:()=>openAttributeDialog(e.id)},
   {separator:true},
   {label:'Eliminar',hint:'Supr',disabled:isLocked,onSelect:()=>{edit(d=>removeEvents(d,[e.id],ripple));setSelected([]);}},
   {label:'Recortar',hint:'Ctrl/Cmd+T',disabled:isLocked||!current.region,onSelect:trimToRange},
   {label:'Recortar principio',hint:'Alt+[',disabled:isLocked,onSelect:()=>rippleTrimIds([e.id],'left')},
   {label:'Recortar final',hint:'Alt+]',disabled:isLocked,onSelect:()=>rippleTrimIds([e.id],'right')},
   {label:'Dividir',hint:'S',disabled:isLocked,onSelect:()=>splitAt([e.id])},
   {separator:true},
   {label:'Crear subclip',disabled:true,hint:'Esta versión no tiene subclips: duplica el evento con «Copiar» y «Pegar»'},
   {label:'Invertir',onSelect:()=>{edit(d=>toggleReverse(d,linkedIds(d,[e.id])));setStatus(`«${e.name}»: material ${e.reversed?'hacia delante':'al revés'}.`);}},
   {separator:true},
   {label:'Seleccionar eventos hasta el final',hint:'Z',onSelect:()=>selectToEnd(e)},
   {separator:true},
   {label:'Insertar/eliminar envolvente',items:envelopeItems(e)},
   {label:'Congelar fotograma en el cursor',hint:'Freeze Frame at Cursor',onSelect:()=>{setSelected([e.id]);void freezeFrame();}},
   {label:'Progreso de transición',items:[
    {label:'Suave',disabled:true,hint:'La transición dura lo que su fundido de entrada'},
    {label:'Lineal',disabled:true,hint:'La transición dura lo que su fundido de entrada'},
    {label:'Brusco',disabled:true,hint:'La transición dura lo que su fundido de entrada'},
   ]},
   {label:'Modificadores',items:switchItems(e)},
   {label:'Toma',items:[
    {label:'Cambiar nombre de elemento activo',disabled:true,hint:'Esta versión no tiene varias tomas por evento'},
    {label:'Seleccionar elemento activo...',disabled:true,hint:'Esta versión no tiene varias tomas por evento'},
    {label:'Toma siguiente',disabled:true,hint:'Esta versión no tiene varias tomas por evento'},
    {label:'Toma anterior',disabled:true,hint:'Esta versión no tiene varias tomas por evento'},
    {label:'Eliminar elemento activo',disabled:true,hint:'Esta versión no tiene varias tomas por evento'},
   ]},
   {label:'Grupo',items:groupItems(e)},
   ...(e.kind==='audio'
    ?[{label:'Corriente',items:[{label:'Corriente 1',checked:true,onSelect:()=>setStatus(`«${e.name}»: el material tiene una sola corriente en esta versión.`)}]} as WorkspaceMenuItem,
      {label:'Canales',hint:'H',items:[
       {label:'Ambos',checked:(e.channel??'both')==='both',onSelect:()=>setChannels(e,'both')},
       {label:'Sólo izquierdo',checked:e.channel==='left',onSelect:()=>setChannels(e,'left')},
       {label:'Sólo derecho',checked:e.channel==='right',onSelect:()=>setChannels(e,'right')},
       {label:'Combinar',checked:e.channel==='combine',onSelect:()=>setChannels(e,'combine')},
       {label:'Intercambiar',checked:e.channel==='swap',onSelect:()=>setChannels(e,'swap')},
      ]},
      {label:'Normalizar',onSelect:()=>normalizeEventAudio(e)},
     ]
    :[]),
   {label:'Sincronizar',items:[
    {label:'Por desplazamiento',onSelect:()=>applySync(e,'move')},
    {label:'Por deslizamiento',onSelect:()=>applySync(e,'slip')},
    {label:'Crear enlace sinc con eventos seleccionados',disabled:true,hint:'Esta versión no guarda enlaces sinc'},
    {label:'Eliminar enlace sinc desde eventos seleccionados',disabled:true,hint:'Esta versión no guarda enlaces sinc'},
   ]},
   {label:'Enlace sinc',items:[
    {label:'Eliminar enlace',disabled:true,hint:'Esta versión no guarda enlaces sinc'},
    {label:'Seleccionar todo',disabled:true,hint:'Esta versión no guarda enlaces sinc'},
   ]},
   {separator:true},
   {label:'Propiedades...',onSelect:()=>openEventDialog(e.id)},
  ];
 }
 function trackMenuItems(id:string):WorkspaceMenuItem[]{
  const current=pRef.current;if(!current)return[];
  const index=current.tracks.findIndex(t=>t.id===id);const track=current.tracks[index];if(!track)return[];
  const toggle=(key:'mute'|'solo')=>edit(d=>{const t=d.tracks.find(t=>t.id===id);if(t)t[key]=!t[key];});
  return [
   {label:'Propiedades de la pista…',onSelect:()=>{setTrackId(id);setDialog('track');}},
   {label:track.mute?'Activar el sonido de la pista':'Silenciar la pista',checked:track.mute,onSelect:()=>toggle('mute')},
   {label:track.solo?'Quitar solo de la pista':'Solo de la pista',checked:track.solo,onSelect:()=>toggle('solo')},
   {separator:true},
   {label:'Subir pista',hint:'Alt+↑',disabled:index<=0,onSelect:()=>moveTrack(id,-1)},
   {label:'Bajar pista',hint:'Alt+↓',disabled:index>=current.tracks.length-1,onSelect:()=>moveTrack(id,1)},
   {separator:true},
   {label:'Eliminar pista y sus eventos',hint:'Supr',onSelect:()=>removeTrack(id)},
  ];
 }
 function openExport(){if(!p)return;pause();const format:ExportFormat=cap.mp4?'mp4':cap.webm?'webm':'wav';setExportSettings(s=>({...s,width:p.width,height:p.height,fps:p.fps,format,scope:p.region?'range':'full',start:p.region?p.region.start:0,end:p.region?p.region.end:endTime(p),includeVideo:format!=='wav',includeAudio:true}));setPreset('custom');setProgress(null);setDialog('export');}
 function applyPreset(id:string){setPreset(id);if(!p)return;const table:Record<string,Partial<ExportSettings>>={'proyecto':{width:p.width,height:p.height,fps:p.fps,bitrateMbps:null},'mp4-1080':{width:1920,height:1080,fps:{num:30,den:1},format:'mp4',quality:'high',bitrateMbps:null,includeVideo:true,includeAudio:true},'mp4-720':{width:1280,height:720,fps:{num:30,den:1},format:'mp4',quality:'medium',bitrateMbps:null,includeVideo:true,includeAudio:true},'mp4-480':{width:854,height:480,fps:{num:30,den:1},format:'mp4',quality:'draft',bitrateMbps:null,includeVideo:true,includeAudio:true},'webm-720':{width:1280,height:720,fps:{num:30,den:1},format:'webm',quality:'medium',bitrateMbps:null,includeVideo:true,includeAudio:true},'wav':{format:'wav',quality:'high',bitrateMbps:null,includeVideo:false,includeAudio:true}};const patch=table[id];if(patch)setExportSettings(s=>({...s,...patch}));}
 const exportRange=()=>p?resolveRange(p,exportSettings):{start:0,end:0};
 const exportPlan=()=>plannedFrames(exportSettings.fps,exportRange());
 const exportFormatReady=(f:ExportFormat)=>{const codecOk=f==='mp4'?cap.mp4:f==='webm'?cap.webm:cap.wav;return codecOk&&(exportSettings.includeAudio?!!(support?.audio??true):true);};
 async function exportNow(){if(!p||rendering)return;setRendering(true);pause();abort.current=new AbortController();setStatus('Renderizando localmente→');setProgress({done:0,total:0,rate:0,elapsedMs:0,etaMs:0,stage:'preparando',bytes:0});try{const result=await renderProject(clone(p),library.current,exportSettings,abort.current.signal,setProgress);const range=exportRange();download(result.blob,`${p.name}${exportSettings.scope==='range'?' (tramo)':''}.${exportSettings.format}`);setStatus(`Renderizado ${exportSettings.format.toUpperCase()}: ${result.frames} fotogramas · ${(result.blob.size/1048576).toFixed(2)} MB · ${tc(range.end-range.start)} de salida · ${(result.elapsedMs/1000).toFixed(1)} s (${(result.frames/Math.max(.001,result.elapsedMs/1000)).toFixed(1)} fps de render).`);}catch(e){setStatus(abort.current.signal.aborted?'Renderización cancelada. Recursos liberados.':e instanceof Error?e.message:String(e));}finally{setRendering(false);abort.current=null;}}
 // Lote de renderizado: la cola del script «Batch Render» de VEGAS. Los trabajos se preparan con los ajustes
 // que hay en el diálogo y se renderizan en serie sobre una copia del proyecto tomada al empezar, para que lo
 // que se edite mientras corre la cola no cambie lo que ya está en marcha. Un trabajo que falla queda marcado
 // con su error y la cola sigue con el siguiente; cancelar detiene la cola y lo que quedaba pasa a cancelado.
 function addToBatch(){if(!p)return;const problem=settingsProblem(p,exportSettings,cap);if(problem){setStatus(problem);return;}setBatch(list=>appendJobs(list,p,[exportSettings],cap));setStatus(`Añadido al lote: ${fileNameFor(p.name,exportSettings)}.`);}
// Una salida por pista de audio: el «Render Audio Tracks.cs» de VEGAS, aquí como trabajos de la cola.
 function addAudioTracksToBatch(){
  if(!p)return;
  const jobs=audioTrackJobs(p,exportSettings,cap);
  if(!jobs.length){setStatus('No hay pistas de audio (o el motor no puede codificar WAV).');return;}
  setBatch(current=>[...current,...jobs]);
  setStatus(`${jobs.length} salida(s) de audio añadida(s) al lote: una por pista.`);
 }
 function addVariantsToBatch(){if(!p)return;const list=variantSettings(exportSettings,cap);if(!list.length){setStatus('Este navegador no puede codificar ninguno de los formatos del lote.');return;}setBatch(current=>appendJobs(current,p,list,cap));setStatus(`${list.length} plantilla(s) añadida(s) al lote.`);}
 async function runBatch(){
  if(!p||rendering)return;
  const queue=batch.filter(job=>job.status==='pendiente'||job.status==='error');
  if(!queue.length)return;
  const project=clone(p);
  setRendering(true);pause();abort.current=new AbortController();const signal=abort.current.signal;
  setStatus(`Lote: ${queue.length} trabajo(s) en cola.`);
  let finished=0;const failures:string[]=[];
  for(const job of queue){
   if(signal.aborted){setBatch(list=>list.map(item=>item.status==='pendiente'?{...item,status:'cancelado'}:item));break;}
   setBatch(list=>list.map(item=>item.id===job.id?{...item,status:'renderizando',done:0,error:undefined}:item));
   setProgress({done:0,total:job.frames,rate:0,elapsedMs:0,etaMs:0,stage:'preparando',bytes:0});
   try{
    const result=await renderProject(jobProject(project,job),library.current,job.settings,signal,progress=>{setProgress(progress);setBatch(list=>list.map(item=>item.id===job.id?{...item,done:progress.done,bytes:progress.bytes}:item));});
    download(result.blob,job.fileName);
    setBatch(list=>list.map(item=>item.id===job.id?{...item,status:'hecho',done:result.frames,bytes:result.blob.size,elapsedMs:result.elapsedMs}:item));
    finished++;
   }catch(e){
    const message=e instanceof Error?e.message:String(e);
    setBatch(list=>list.map(item=>item.id===job.id?{...item,status:signal.aborted?'cancelado':'error',error:message}:item));
    if(!signal.aborted)failures.push(job.fileName);
   }
  }
  setRendering(false);abort.current=null;setProgress(null);
  setStatus(signal.aborted?`Lote cancelado: ${finished} archivo(s) descargado(s) antes de parar.`:`Lote terminado: ${finished} archivo(s) descargado(s)${failures.length?`, ${failures.length} con error (${failures.join(', ')})`:''}.`);
 }
 useEffect(()=>{const key=(e:KeyboardEvent)=>{const target=e.target as HTMLElement;if(target.closest('input,textarea,[contenteditable=true],[role=dialog],[role=menu],[role=listbox]')||dialog||!p||busy||rendering)return;const mod=e.ctrlKey||e.metaKey;const k=e.key.toLowerCase();if(mod&&['s','z','y','a','c','x','v','o'].includes(k)){e.preventDefault();if(k==='s')save();if(k==='z')e.shiftKey?redo():undo();if(k==='y')redo();if(k==='a')setSelected(p.events.map(x=>x.id));if(k==='c')copy();if(k==='x')copy(true);if(k==='v')paste();if(k==='o')projectInput.current?.click();return;}if(e.altKey&&(k==='arrowup'||k==='arrowdown')&&trackId){e.preventDefault();moveTrack(trackId,k==='arrowup'?-1:1);return;}// Los atajos que anuncia el menú del clic derecho del evento: Alt+[ y Alt+] recortan por rizo hasta el cursor.
if(e.altKey&&(k==='['||k===']')){e.preventDefault();rippleTrimIds(selected,k==='['?'left':'right');return;}
if(e.altKey&&(k==='arrowleft'||k==='arrowright')){e.preventDefault();const direction=k==='arrowright'?1:-1;if(e.shiftKey)rippleTrimSelected(direction>0?'right':'left');else if(mod)slideSelected(direction);else slipSelected(direction);return;}if(mod&&k==='end'){e.preventDefault();seek(endTime(p));return;}// Ctrl+L no se captura nunca: el navegador lo reserva para la barra de direcciones. Con Mayús sí se puede.
if(mod&&e.shiftKey&&k==='l'){e.preventDefault();clearLoop();return;}if(mod&&e.shiftKey&&k==='c'){e.preventDefault();copySelectedAttributes();return;}if(mod&&e.shiftKey&&k==='v'){e.preventDefault();pasteSelectedAttributes();return;}if(mod&&k==='t'){e.preventDefault();trimToRange();return;}if(mod)return;if(k===' '){e.preventDefault();transport();}else if(k==='l'){e.preventDefault();if(e.altKey)toggleLoop();else if(e.shiftKey)markLoopEnd();else markLoopStart();}else if(k==='s')doSplit();else if(k==='m')marker();else if(k==='g')group();else if(k==='u')group(true);else if(k==='delete'||k==='backspace'){e.preventDefault();const locked=p?lockedIds(p):new Set<string>();const ids=selected.filter(id=>!locked.has(id));if(selected.length&&!ids.length){setStatus('Los eventos seleccionados están bloqueados: desmarca «Bloqueo» en sus Propiedades.');}else if(ids.length){edit(d=>removeEvents(d,ids,ripple));setSelected([]);}else if(trackId)removeTrack(trackId);}else if(k==='z'){e.preventDefault();const first=p.events.find(x=>x.id===selected[0]);if(first)selectToEnd(first);}else if(k==='arrowleft'||k==='arrowright'){e.preventDefault();seek(quantize(cursorRef.current+(k==='arrowright'?1:-1)*frameTicks(p.fps),p.fps));}else if(k==='home'){e.preventDefault();seek(0);}else if(k==='end'){e.preventDefault();seek(p.region?p.region.end:endTime(p));}else if(k==='w'){e.preventDefault();seek(0);}else if(k==='enter'){e.preventDefault();if(e.altKey)setDialog('project');else if(playingRef.current)pause();else void beginPlayback();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);});
 // Las acciones que usan las filas de la línea de tiempo, en un objeto estable: las filas son `memo` y no deben
 // repintarse porque cambie la identidad de una función, pero cada gesto tiene que ejecutar la versión actual.
 const timelineActionSet:TimelineActions={drag:dragEvent,select:setSelected,open:dialog=>setDialog(dialog),beginOpacity,previewOpacity,endOpacity,commitOpacity};
 const timelineActions=useRef<TimelineActions>(timelineActionSet);
 // El objeto se republica después de cada repintado para que los gestos usen siempre la versión actual: no es
 // una dependencia del efecto (que no se suscribe a nada), así que no lleva lista de claves.
 useEffect(()=>{timelineActions.current=timelineActionSet;});
 if(!p)return <div className="boot">Abriendo Corte 15→</div>;
 const missing=[support&&!support.decode&&'WebCodecs de decodificación (VideoDecoder/AudioDecoder)',support&&!support.audio&&'Web Audio (AudioContext/AudioBuffer)',support&&!support.encode&&'WebCodecs de codificación (VideoEncoder/AudioEncoder)'].filter(Boolean) as string[];
 const selectedEvent=p.events.find(e=>e.id===selected[0]),selectedTrack=p.tracks.find(t=>t.id===trackId),selectedMedia=p.media.find(m=>m.id===mediaSelected),length=timelineSpan,timelineWidth=fitTimeline?timelineViewport:Math.max(900,length*zoom,zoomWidthFloor),tickStep=timelineTickStep(zoom);
 // Tamaño real del medio del evento seleccionado, para que la caja de Pan/Crop tenga su proporción.
 const cropMedia=selectedEvent?.mediaId?p.media.find(m=>m.id===selectedEvent.mediaId):undefined;
 const cropRuntime=cropMedia?library.current.items.get(cropMedia.id):undefined;
 const cropSource=cropRuntime?.image?{width:cropRuntime.image.width,height:cropRuntime.image.height}:(cropMedia&&cropMedia.width&&cropMedia.height?{width:cropMedia.width,height:cropMedia.height}:null);
   // Tamaño del fotograma: el que cabe en el monitor («ajustado») multiplicado por el zoom de la vista.
  const previewFit = (()=>{
   const availableWidth=Math.max(40,monitorSize.width-12),availableHeight=Math.max(30,monitorSize.height-12);
   const fit=Math.min(availableWidth/Math.max(1,p.width),availableHeight/Math.max(1,p.height));
   return {width:Math.max(2,Math.round(p.width*fit)),height:Math.max(2,Math.round(p.height*fit))};
  })();
  const previewFrame={width:Math.max(2,Math.round(previewFit.width*previewZoom)),height:Math.max(2,Math.round(previewFit.height*previewZoom))};
  const plan=exportPlan(),formatReady=exportFormatReady(exportSettings.format),batchSummary=summarize(batch),batchReady=batch.some(job=>job.status==='pendiente'||job.status==='error'),batchProblem=settingsProblem(p,exportSettings,cap);
 // Los eventos del mismo grupo que la selección se sombrean: al pulsar G sobre un par de video y audio,
 // ambos quedan resaltados aunque solo uno esté seleccionado directamente.
 const highlighted=new Set(linkedIds(p,selected));
 // Resuelto una vez por repintado: dentro del recorrido de eventos, buscar el material uno a uno era
 // O(eventos × medios), y reconstruir el conjunto de bloqueos por cada evento, O(eventos²).
 const mediaById=new Map(p.media.map(item=>[item.id,item]));
 const selectedSet=new Set(selected);
 const lockedSet=lockedIds(p);
 const menu=(name:string,items:([string,()=>void]|null)[])=><DropdownMenu><DropdownMenuTrigger className="menu-label">{name}</DropdownMenuTrigger><DropdownMenuContent className="editor-menu">{items.map((item,i)=>item?<DropdownMenuItem key={i} onSelect={item[1]}>{item[0]}</DropdownMenuItem>:<DropdownMenuSeparator key={i}/>)}</DropdownMenuContent></DropdownMenu>;
 // Las ventanas de Panoramización y de Movimiento de pista son flotantes: el contenido del diálogo queda como un
 // lienzo transparente a pantalla completa y la ventana se mueve y se redimensiona dentro de él
 // (components/editor/pan-crop.tsx). Su título va oculto a la vista pero sigue disponible para lectores de
 // pantalla, porque la ventana lleva su propia barra.
 const floating=dialog==='pancrop'||dialog==='trackmotion';
 // WORKSPACE
 return <main className="editor" onContextMenu={workspaceContextMenu} onDragOver={e=>e.preventDefault()} onDrop={e=>{if(e.dataTransfer.files.length){e.preventDefault();void importFiles(e.dataTransfer.files);}}}>
  <input hidden type="file" multiple ref={fileInput} onChange={e=>{if(e.target.files)void importFiles(e.target.files);e.target.value='';}}/>
  <input hidden type="file" accept=".corte15,.xml,.fcpxml,.edl,.veg,application/json" ref={projectInput} onChange={e=>{if(e.target.files?.[0])void openProject(e.target.files[0]);e.target.value='';}}/>
  <input hidden type="file" ref={relinkInput} onChange={e=>{if(e.target.files?.[0])void relink(e.target.files[0]);e.target.value='';}}/>
  <div className="titlebar"><span className="brand">C</span><span>{p.name}.corte15 — Corte 15</span><span className="local-label">Procesamiento local · versión experimental</span></div>
  <nav className="menubar" aria-label="Menú principal">
   {menu('Archivo',[['Nuevo proyecto',()=>setDialog('new')],['Abrir o importar proyecto (corte15, XML, EDL, VEGAS .veg)→',()=>projectInput.current?.click()],['Guardar proyecto',save],['Importar medios→',()=>fileInput.current?.click()],null,['Propiedades del proyecto→',()=>setDialog('project')],['Exportar los marcadores (capítulos y subtítulos)…',openMarkerExport],['Renderizar como…',openExport],['Lote de renderizado…',openExport]])}
   {menu('Editar',[['Deshacer · Ctrl/Cmd+Z',undo],['Rehacer · Ctrl/Cmd+Y',redo],null,['Cortar',()=>copy(true)],['Copiar',()=>copy()],['Pegar',()=>paste()],['Duplicar',()=>paste(true)],['Dividir · S',doSplit],['Eliminar',()=>edit(d=>removeEvents(d,selected,ripple))],['Agrupar · G',()=>group()],['Desagrupar · U',()=>group(true)],null,['Deslizar el contenido · (slip)',()=>slipSelected(-1)],['Deslizar el contenido  (slip)',()=>slipSelected(1)],['Desplazar el evento · (slide)',()=>slideSelected(-1)],['Desplazar el evento  (slide)',()=>slideSelected(1)],['Recortar el inicio hasta el cursor (rizo)',()=>rippleTrimSelected('left')],['Recortar el final hasta el cursor (rizo)',()=>rippleTrimSelected('right')]])}
   {menu('Ver',[['Medios de proyecto',()=>setTab('media')],['Explorador local',()=>setTab('explorer')],['Transiciones',()=>setTab('transitions')],['Efectos de video',()=>setTab('effects')],['Generadores de medios',()=>setTab('generators')],['Mezclador→',()=>setDialog('mixer')],['Trimmer→',()=>selectedMedia&&setDialog('trimmer')],['Restablecer distribución',()=>{setUpperHeight(45);setLeftWidth(48);setFitTimeline(false);setZoomWidthFloor(0);setZoom(65);}]])}
   {menu('Insertar',[['Pista de video',()=>edit(d=>d.tracks.unshift(newTrack('video')))],['Pista de audio',()=>edit(d=>d.tracks.push(newTrack('audio')))],['Texto→',()=>generator('text')],['Color sólido→',()=>generator('color')],['Marcador · M',marker],['Región de 5 segundos',()=>edit(d=>{d.region={start:cursor,end:cursor+ticks(5)};})],['Región de bucle de 5 segundos',()=>edit(d=>{d.loopRegion={start:cursor,end:cursor+ticks(5)};})],['Bucle desde el tramo',loopFromRegion]])}
   {menu('Herramientas',[['Propiedades del evento→',()=>selectedEvent&&setDialog('event')],['Panoramización y recorte→',()=>selectedEvent&&setDialog('pancrop')],['Títulos y texto→',()=>selectedEvent&&selectedEvent.kind==='text'&&setDialog('titles')],['Movimiento de pista→',()=>selectedTrack&&setDialog('trackmotion')],['Efectos de vídeo→',()=>selectedEvent&&selectedEvent.kind!=='audio'&&setDialog('effects')],null,['Quitar bandas negras (analizar los píxeles)',()=>void removeLetterboxing('detect')],['Encajar el contenido al fotograma (cubrir)',()=>void removeLetterboxing('cover')],['Ajustar el contenido al fotograma (encajar)',()=>void removeLetterboxing('fit')],null,['Exportar los marcadores (capítulos y subtítulos)…',openMarkerExport],['Renderizar como…',openExport]])}
   {menu('Configuración',[['Claves de API (Groq y Pexels)→',()=>setDialog('keys')],['Proyecto y almacenamiento→',()=>setDialog('project')],['Activar/desactivar ajuste magnético',()=>setSnap(!snap)]])}
   {menu('Ayuda',[['Funciones y atajos',()=>setDialog('help')]])}
  </nav>
  <div className="toolbar"><Tool label="Nuevo proyecto" onClick={()=>setDialog('new')}><FilePlus/></Tool><Tool label="Abrir proyecto" onClick={()=>projectInput.current?.click()}><FolderOpen/></Tool><Tool label="Guardar proyecto" onClick={save}><Save/></Tool><span className="separator"/><Tool label="Importar medios" onClick={()=>fileInput.current?.click()} disabled={busy||rendering}><Film/></Tool><Tool label="Propiedades del proyecto" onClick={()=>setDialog('project')}><Settings/></Tool><span className="separator"/><Tool label="Deshacer" onClick={undo} disabled={!history.current.past.length}><Undo2/></Tool><Tool label="Rehacer" onClick={redo} disabled={!history.current.future.length}><Redo2/></Tool><span className="separator"/><Tool label="Dividir (S)" onClick={doSplit}><Scissors/></Tool><Tool label="Copiar" onClick={()=>copy()} disabled={!selected.length}><Copy/></Tool><Tool label="Pegar" onClick={()=>paste()}><Clipboard/></Tool><span className="grow"/><button className="render-button" onClick={openExport} disabled={!p.events.length||busy}><Download size={14}/> Renderizar como…</button></div>
  {missing.length>0&&<p className="capability-warning" role="alert">Este navegador no expone {missing.join(', ')}. Importar, reproducir o exportar pueden fallar por ello. El editor comprueba estas APIs al arrancar en lugar del nombre del navegador; para editar, usa una versión actual de Chrome, Edge o Firefox.</p>}
  <div className="upper" style={{height:`${upperHeight}vh`}}>
   <section className="media-panel" style={{width:`${leftWidth}%`}}>
    <div className="panel-toolbar"><Tool label="Importar medios" onClick={()=>fileInput.current?.click()} disabled={busy}><FolderOpen/></Tool><Tool label="Insertar medio seleccionado" onClick={()=>selectedMedia&&insertMedia(selectedMedia)} disabled={!selectedMedia}><Plus/></Tool><Tool label="Revincular medio seleccionado" onClick={()=>{setRelinkId(mediaSelected);relinkInput.current?.click();}} disabled={!selectedMedia}><Link/></Tool><Tool label="Abrir el trimmer del medio seleccionado" onClick={()=>setDialog('trimmer')} disabled={!selectedMedia}><Scissors/></Tool><span className="separator"/><Search size={13}/><input className="search" placeholder="Buscar medios" aria-label="Buscar medios" value={search} onChange={e=>setSearch(e.target.value)}/><button className="ai-button" onClick={()=>void generateSubtitles()} disabled={!!aiBusy||rendering||!p.events.length} title="Transcribe el audio del proyecto con Groq y crea el archivo .srt y los subtítulos en la línea de tiempo"><Type size={13}/>{aiBusy.startsWith('Transcribiendo')||aiBusy.startsWith('Preparando')?'Generando→':'Generar subtítulos'}</button><button className="ai-button" onClick={openPexels} disabled={!!aiBusy||rendering} title="Busca recursos en Pexels y colócalos en la línea de tiempo"><Film size={13}/>Recursos Pexels</button>{selectedMedia?.kind==='subtitle'&&<button className="ai-button" onClick={()=>downloadSubtitles(selectedMedia)} title="Descargar el archivo .srt de los subtítulos seleccionados"><Download size={13}/>Descargar .srt</button>}<span className="grow"/><span className="meta">{p.media.length} archivos</span></div>
    <Tabs value={tab} onValueChange={setTab} className="media-tabs">
     <TabsContent value="media" className="media-content"><aside className="media-tree">{[['all','Todos los medios'],['video','Videos'],['audio','Audio'],['image','Imágenes'],['subtitle','Subtítulos'],['missing','Medios faltantes']].map(([v,label])=><button key={v} className={filter===v?'selected':''} onClick={()=>setFilter(v)}><Folder size={14}/>{label}</button>)}</aside><div className="media-grid">{p.media.filter(m=>(filter==='all'||filter===m.kind||(filter==='video'&&m.kind==='subtitle')||(filter==='missing'&&!library.current.items.has(m.id)&&m.kind!=='subtitle'))&&m.name.toLowerCase().includes(search.toLowerCase())).map(m=><button key={m.id} className={`media-item ${mediaSelected===m.id?'selected':''} ${!library.current.items.has(m.id)&&m.kind!=='subtitle'?'missing':''}`} data-media-id={m.id} onClick={()=>setMediaSelected(m.id)} onDoubleClick={()=>insertMedia(m)} draggable onDragStart={e=>e.dataTransfer.setData('application/corte15-media',m.id)} title={`${m.name}\n${m.kind==='subtitle'?'Subtítulos · doble clic para llevarlos a la línea de tiempo':m.mime}\n${m.kind==='subtitle'?`${m.text?.split('\n\n').length??0} líneas`:`${m.width}×${m.height} · ${seconds(m.duration).toFixed(2)} s`}${m.sourcePath?`\nOrigen: ${m.sourcePath}`:''}`}><div className="thumb">{m.kind==='subtitle'?<Type size={36}/>:m.thumbnail?<img src={m.thumbnail} alt=""/>:m.kind==='video'?<Film size={36}/>:m.kind==='image'?<Palette size={36}/>:<Music size={36}/>}<small>{tc(m.duration)}</small></div><span>{m.name}</span>{!library.current.items.has(m.id)&&m.kind!=='subtitle'&&<em>Revincular</em>}{m.kind==='subtitle'&&<em className="subtitle-badge">Subtítulos</em>}</button>)}{!p.media.length&&<div className="empty-library"><Film size={27}/><p>Arrastra tus archivos aquí</p><button onClick={()=>fileInput.current?.click()}>Importar medios→</button><small>Video, audio e imágenes · archivos locales</small></div>}</div></TabsContent>
     <TabsContent value="explorer" className="catalog"><h3>Explorador local</h3><p>El navegador permite acceder a los archivos que selecciones.</p><button onClick={()=>fileInput.current?.click()}>Seleccionar archivos→</button><p>También puedes arrastrar archivos desde el explorador de tu sistema.</p></TabsContent>
     <TabsContent value="transitions" className="catalog"><h3>Transiciones</h3>{TRANSITION_GROUPS.map(group=><div key={group}><h4>{group}</h4><div className="preset-list">{TRANSITION_KINDS.filter(kind=>TRANSITION_GROUP[kind]===group).map(kind=><button key={kind} draggable title={`${TRANSITION_NOTE[kind]??''}\nArrástrala sobre un clip: su mitad izquierda la pone de entrada y su mitad derecha, en el corte con el siguiente o como salida.`} onDragStart={e=>{e.dataTransfer.setData(TRANSITION_DRAG,kind);e.dataTransfer.effectAllowed='copy';}} onClick={()=>applyTransition(kind)}>{TRANSITION_LABEL[kind]}</button>)}</div></div>)}<p>{selectedEvent&&selectedEvent.kind!=='audio'?`Clic: se aplica a «${selectedEvent.name}» como su entrada y dura lo que su fundido de entrada (${seconds(selectedEvent.fadeIn).toFixed(2)} s). Arrastre: suéltala sobre la mitad izquierda de un clip para su entrada, o sobre la mitad derecha para el corte con el siguiente (o su salida si no hay ninguno).`:'Arrastra una transición sobre un clip de la línea de tiempo, o selecciona un evento de vídeo, imagen, texto o color para aplicarla con un clic.'}</p><button disabled={!selectedEvent} onClick={()=>edit(d=>{const e=d.events.find(x=>x.id===selected[0]);if(e){e.fadeIn=Math.min(ticks(1),e.duration/2);e.fadeOut=Math.min(ticks(1),e.duration/2);}})}>Aplicar entrada y salida de 1 s (fundido cruzado)</button></TabsContent>
     <TabsContent value="effects" className="catalog"><h3>Efectos de video</h3><div className="preset-list">{EFFECT_KINDS.map(kind=><button key={kind} disabled={!selectedEvent||selectedEvent.kind==='audio'} title={EFFECT_DESCRIPTION[kind]} onClick={()=>applyEffectToSelected(kind)}><SlidersHorizontal size={18}/>{EFFECT_LABEL[kind]}</button>)}</div><p>{selectedEvent&&selectedEvent.kind!=='audio'?`Se añaden al evento «${selectedEvent.name}»; se ordenan y se ajustan en su ventana de efectos.`:'Selecciona un evento de vídeo, imagen, texto o color para añadirle efectos.'}</p></TabsContent>
     <TabsContent value="generators" className="catalog"><div className="preset-list"><button onClick={()=>generator('text')}><Type size={32}/>Títulos y texto</button>{GENERATOR_ITEMS.map(([kind,label])=><button key={kind} onClick={()=>addGenerator(kind as GeneratorKind)}><Palette size={32}/>{label}</button>)}</div></TabsContent>
     <div className="media-meta">{selectedMedia?`${selectedMedia.name} · ${selectedMedia.width?`${selectedMedia.width} × ${selectedMedia.height} · `:''}${selectedMedia.mime}`:'Selecciona o importa un medio para ver sus propiedades.'}</div>
     <TabsList className="panel-tabs">{[['transitions','Transiciones'],['generators','Generadores de medios'],['effects','Efectos de video'],['explorer','Explorador'],['media','Medios de proyecto']].map(([v,label])=><TabsTrigger key={v} value={v}>{label}</TabsTrigger>)}</TabsList>
    </Tabs>
   </section><div className="splitter vertical" onPointerDown={e=>resize(e,'left')}/>
   <section className="preview-panel"><div className="panel-toolbar"><Tool label="Propiedades del proyecto" onClick={()=>setDialog('project')}><Settings/></Tool><span>Vista previa de video</span><span className="grow"/><span className="preview-zoom" role="group" aria-label="Zoom de la vista previa"><Tool label="Alejar la vista previa" onClick={()=>setPreviewZoom(current=>Math.max(PREVIEW_MIN_ZOOM,Number((current/1.25).toFixed(4))))}><ZoomOut/></Tool><Tool label="Acercar la vista previa" onClick={()=>setPreviewZoom(current=>Math.min(PREVIEW_MAX_ZOOM,Number((current*1.25).toFixed(4))))}><ZoomIn/></Tool><button className="range-button" aria-label="Ajustar la vista previa al panel" title="Ajustar la vista previa al panel (vuelve al 100 %)" onClick={()=>setPreviewZoom(1)}>{Math.round(previewZoom*100)} %</button></span><Choice label="Calidad de vista previa" value={quality} onChange={setQuality} items={[["quarter","Borrador (cuarto)"],["half","Buena (mitad)"],["full","La mejor (total)"]]}/></div><div className="monitor" ref={attachMonitor} data-zoomed={previewZoom>1} data-monitor-width={monitorSize.width} data-monitor-height={monitorSize.height} title="Rueda del ratón: acerca o aleja la vista previa"><div className="monitor-frame" data-fit-width={previewFit.width} data-fit-height={previewFit.height} style={{width:previewFrame.width,height:previewFrame.height}}><canvas ref={canvas} aria-label="Composición del proyecto" style={{aspectRatio:`${p.width}/${p.height}`}}/><PreviewOverlay project={p} event={selectedEvent??null} track={selectedEvent?null:(selectedTrack??null)} pose={selectedEvent?pose(selectedEvent,cursor):(selectedTrack?.transform??NEUTRAL_POSE)} source={selectedEvent?previewSource(selectedEvent):null} onPose={updatePreviewPose} onMask={selectedEvent?value=>updateEvent({mask:value}):undefined} onStatus={setStatus}/></div></div><div className="preview-transport"><Tool label={playing?'Pausa':'Reproducir'} onClick={()=>playing?pause():void beginPlayback()}>{playing?<Pause/>:<Play/>}</Tool><Tool label="Detener" onClick={()=>{pause();seek(startPosition.current);}}><Square/></Tool><Tool label="Fotograma anterior" onClick={()=>seek(quantize(cursor-frameTicks(p.fps),p.fps))}><StepBack/></Tool><Tool label="Fotograma siguiente" onClick={()=>seek(quantize(cursor+frameTicks(p.fps),p.fps))}><StepForward/></Tool><span>{tc(cursor)}</span></div><div className="preview-meta"><span>Proyecto: {p.width}×{p.height}, {(p.fps.num/p.fps.den).toFixed(3)}p<br/>Audio: {p.sampleRate} Hz · estéreo</span><span>Fotograma: {Math.floor(cursor/frameTicks(p.fps))}<br/>Vista: {quality==='full'?'total':quality==='half'?'1/2':'1/4'}</span></div></section>
   <div className="splitter vertical meters-splitter" role="separator" aria-label="Ajustar el ancho de los medidores" title="Arrastra para ensanchar o estrechar los medidores" onPointerDown={e=>resize(e,'meters')}/>
   <Meters store={meterStore.current} width={metersWidth}/>
  </div><div className="splitter horizontal" onPointerDown={e=>resize(e,'upper')}/>
  <section className="timeline-section"><div className="timeline-side"><div className="big-timecode" ref={timecodeRef}>{tc(cursorRef.current)}</div><div className="track-header-scroll" id="track-headers">{p.tracks.map((track,i)=><div key={track.id} className={`track-header ${track.kind} ${trackId===track.id?'selected':''} ${trackDropIndex===i?'drop-target':''}`} data-track={track.id} style={{height:track.height}} onPointerDown={ev=>{if(trackIdRef.current!==track.id){setStatus(`Pista «${track.name}» seleccionada · arrastra para moverla de sitio, clic derecho o Supr para eliminarla.`);}trackIdRef.current=track.id;setTrackId(track.id);setSelected([]);dragTrackOrder(ev,track.id);}}><div className="track-label"><span>{i+1}</span>{track.kind==='video'?<Film size={14}/>:<Music size={14}/>}<button title={`Propiedades de ${track.name}`} onClick={()=>{setTrackId(track.id);setDialog('track');}}>{track.name}</button><span className="grow"/><button className={track.mute?'lit-mute':''} title="Silenciar pista" aria-label={`Silenciar ${track.name}`} onClick={()=>edit(d=>{d.tracks.find(t=>t.id===track.id)!.mute=!track.mute;})}>M</button><button className={track.solo?'lit-solo':''} title="Solo" aria-label={`Solo ${track.name}`} onClick={()=>edit(d=>{d.tracks.find(t=>t.id===track.id)!.solo=!track.solo;})}>S</button></div><div className="track-level"><span>{track.kind==='audio'?'Volumen':'Nivel'}</span><Range label={`Nivel ${track.name}`} value={track.kind==='audio'?track.gain:track.transform.opacity} max={track.kind==='audio'?2:1} onChange={v=>edit(d=>{const t=d.tracks.find(t=>t.id===track.id)!;if(t.kind==='audio')t.gain=v;else t.transform.opacity=v;})}/><small>{Math.round((track.kind==='audio'?track.gain:track.transform.opacity)*100)} %</small></div>{track.kind==='audio'&&<div className="pan-label">Panoramización: {track.pan===0?'Centro':track.pan.toFixed(2)}</div>}<div className="track-resize" onPointerDown={e=>resize(e,'track',track.id)}/></div>)}</div><div className="goto-timecode"><label className="field"><span>Ir a</span><input aria-label="Ir a timecode" placeholder={tc(0)} value={gotoText} onChange={e=>setGotoText(e.target.value)} onKeyDown={e=>{if(e.key!=='Enter')return;e.preventDefault();const value=parseTimecode(gotoText,p.fps);if(value===null){setStatus(`No se entiende «${gotoText}». Prueba con HH:MM:SS:FF, HH:MM:SS;FF o segundos (por ejemplo 12.5).`);return;}seek(quantize(value,p.fps));setStatus(`Cursor en ${tc(value)}.`);setGotoText('');}}/></label></div><div className="add-track"><button onClick={()=>edit(d=>d.tracks.push(newTrack('video')))}><Plus size={12}/> Video</button><button onClick={()=>edit(d=>d.tracks.push(newTrack('audio')))}><Plus size={12}/> Audio</button></div></div>
   <div className="timeline-scroll" ref={timeline} onScroll={e=>{const headers=document.getElementById('track-headers');if(headers)headers.scrollTop=e.currentTarget.scrollTop;}}><div className={`timeline-content ${fitTimeline?"fit-project":""}`} style={{width:timelineWidth,minHeight:'100%'}} onDragOver={e=>dragOverTimeline(e,null)} onDragLeave={()=>setDropLane(null)} onDrop={e=>dropOnTimeline(e,null)}><div className="ruler" onPointerDown={rulerPointer} title="Clic: cursor · arrastrar: tramo de renderizado · Ctrl y arrastrar: región de bucle">{Array.from({length:Math.ceil(length/tickStep)+1},(_,i)=><span key={i} className="ruler-tick" style={{left:i*tickStep*zoom}}>{tcShort(ticks(i*tickStep))}</span>)}{p.markers.map(m=><button className="marker" key={m.id} style={{left:seconds(m.time)*zoom}} title={`${m.name} · clic derecho para eliminar`} onPointerDown={e=>e.stopPropagation()} onClick={()=>seek(m.time)} onContextMenu={e=>{e.preventDefault();edit(d=>{d.markers=d.markers.filter(x=>x.id!==m.id);});}}><Flag size={12}/>{m.name}</button>)}{p.region&&<div className="region" title={`Tramo ${tc(p.region.start)} → ${tc(p.region.end)} · arrastra los bordes para ajustarlo · doble clic para quitarlo`} onPointerDown={e=>e.stopPropagation()} onDoubleClick={()=>clearRange()} onContextMenu={e=>{e.preventDefault();clearRange();}} style={{left:seconds(p.region.start)*zoom,width:Math.max(2,seconds(p.region.end-p.region.start)*zoom)}}><span>{seconds(p.region.end-p.region.start).toFixed(2)} s</span><i className="region-handle start" onPointerDown={e=>dragRegion(e,'start')} title="Ajustar el inicio del tramo"/><i className="region-handle end" onPointerDown={e=>dragRegion(e,'end')} title="Ajustar el fin del tramo"/></div>}{p.loopRegion&&<div className={`loop-region ${loop?'active':''}`} title={`Región de bucle ${tc(p.loopRegion.start)} → ${tc(p.loopRegion.end)} · doble clic para quitarla · Alt+L activa o desactiva la repetición`} onPointerDown={e=>e.stopPropagation()} onDoubleClick={()=>clearLoop()} onContextMenu={e=>{e.preventDefault();clearLoop();}} style={{left:seconds(p.loopRegion.start)*zoom,width:Math.max(2,seconds(p.loopRegion.end-p.loopRegion.start)*zoom)}}><span>{seconds(p.loopRegion.end-p.loopRegion.start).toFixed(2)} s</span><i className="loop-handle start" onPointerDown={e=>dragLoopRegion(e,'start')} title="Ajustar el inicio del bucle"/><i className="loop-handle end" onPointerDown={e=>dragLoopRegion(e,'end')} title="Ajustar el fin del bucle"/></div>}</div>
    {p.tracks.map(track=><div key={track.id} className={`track-lane ${track.kind} ${trackId===track.id?'selected':''} ${dropLane===track.id?'drop-target':''}`} data-track={track.id} style={{height:track.height,backgroundSize:`${tickStep*zoom}px 100%`}} onPointerDownCapture={playheadGrab} onPointerDown={e=>{if(e.target!==e.currentTarget)return;setTrackId(null);setSelected([]);beginRegionDrag(e,e.currentTarget.getBoundingClientRect());}} onDragOver={e=>dragOverTimeline(e,track.id)} onDrop={e=>dropOnTimeline(e,track.id)}>{track.kind==='audio'&&envelopeMode!=='off'&&<EnvelopeLane track={track} mode={envelopeMode} zoom={zoom} height={track.height} onStart={beginEnvelope} onPlayheadPress={playheadPress} onUpdate={(points:AudioPoint[])=>updateEnvelope(track.id,envelopeMode==='volume'?{volumeCurve:points}:{panCurve:points})} onCommit={commitEnvelope}/>}
     {p.events.filter(e=>e.trackId===track.id).map(e=>{const m=mediaById.get(e.mediaId??'');const pcm=m?library.current.items.get(m.id)?.pcm:undefined;return <TimelineEventRow key={e.id} event={e} media={m} pcm={undefined} zoom={zoom} trackKind={track.kind} selected={selectedSet.has(e.id)} groupMember={!selectedSet.has(e.id)&&highlighted.has(e.id)} locked={lockedSet.has(e.id)} rendering={rendering} label={`${e.name}, ${tc(e.start)}`} actions={timelineActions.current}/>;})}
    </div>)}<div ref={playheadRef} className={`playhead ${draggingPlayhead?'dragging':''}`} style={{left:seconds(cursorRef.current)*zoom}} onPointerDown={dragPlayhead} title="Arrastra la aguja para moverla manteniendo el clic: su cabeza, la franja de abajo de la regla, la propia aguja en la regla o la línea sobre los carriles (a menos de unos píxeles de ella)"><i/></div></div></div>
  </section>
  <div className="bottom-toolbar"><div className="transport"><Tool label="Ir al inicio" onClick={()=>seek(0)}><SkipBack/></Tool><Tool label="Reproducir / detener (Espacio)" onClick={transport}>{playing?<Pause/>:<Play/>}</Tool><Tool label="Pausa (Enter)" onClick={pause}><Pause/></Tool><Tool label="Detener" onClick={()=>seek(startPosition.current)}><Square/></Tool><Tool label="Ir al final" onClick={()=>seek(endTime(p))}><SkipForward/></Tool><Tool label="Bucle de reproducción (Alt+L)" onClick={toggleLoop} active={loop}><Repeat2/></Tool></div><span className="separator"/><Tool label="Dividir (S)" onClick={doSplit}><Scissors/></Tool><Tool label="Eliminar seleccionados" onClick={()=>{edit(d=>removeEvents(d,selected,ripple));setSelected([]);}} disabled={!selected.length}><Trash2/></Tool><Tool label="Ajuste magnético" onClick={()=>setSnap(!snap)} active={snap}><Magnet/></Tool><Tool label="Añadir marcador (M)" onClick={marker}><Flag/></Tool><span className="ripple-label">Ripple:</span><Choice label="Modo ripple" value={ripple} onChange={v=>setRipple(v as Ripple)} items={[["off","Desactivado"],["track","Pistas afectadas"],["all","Todas + marcadores"]]}/><span className="ripple-label">Envolvente:</span><span className="button-row">{[['off','Ninguna'],['volume','Volumen'],['pan','Panorámica']].map(([value,label])=><button key={value} className={envelopeMode===value?'active':''} aria-pressed={envelopeMode===value} title={`Mostrar la envolvente de ${label.toLowerCase()} en las pistas de audio`} onClick={()=>setEnvelopeMode(value as EnvelopeMode)}>{label}</button>)}</span><button className="range-button wide" title="Abrir el mezclador" onClick={()=>setDialog('mixer')}>Mezclador</button><span className="range-group" title="Tramo que se puede renderizar por separado"><span className="range-label">Tramo</span><button className="range-button" title="Marcar el inicio del tramo en el cursor" aria-label="Marcar inicio del tramo" onClick={markRangeStart}>[</button><button className="range-button" title="Marcar el fin del tramo en el cursor" aria-label="Marcar fin del tramo" onClick={markRangeEnd}>]</button><span className="range-value">{p.region?`${tc(p.region.start)} — ${tc(p.region.end)}`:'arrastra sobre la regla'}</span><button className="range-button wide" title="Ajustar el tramo al conjunto de eventos seleccionados" onClick={rangeFromSelection} disabled={!selected.length}>Desde selección</button><button className="range-button wide" title="Quitar el tramo" onClick={clearRange} disabled={!p.region}>Quitar</button></span><span className="range-group loop-group" title="Región de bucle: la parte que se repite al reproducir. Es independiente del tramo de renderizado."><span className="range-label">Bucle</span><button className="range-button" title="Marcar el inicio del bucle en el cursor (L)" aria-label="Marcar inicio del bucle" onClick={markLoopStart}>Inicio</button><button className="range-button" title="Marcar el fin del bucle en el cursor (Mayús+L)" aria-label="Marcar fin del bucle" onClick={markLoopEnd}>Fin</button><span className="range-value">{p.loopRegion?`${tc(p.loopRegion.start)} → ${tc(p.loopRegion.end)}`:'Ctrl y arrastrar'}</span><button className="range-button wide" title="Copiar el tramo de renderizado a la región de bucle (menú Insertar)" aria-label="Copiar el tramo al bucle" onClick={loopFromRegion} disabled={!p.region}>Desde tramo</button><button className={`range-button wide ${loop?'loop-live':''}`} title="Activar o desactivar la repetición (Alt+L)" aria-pressed={loop} aria-label="Activar el bucle" onClick={toggleLoop}>{loop?'Repitiendo':'Repetir'}</button><button className="range-button wide" title="Quitar la región de bucle (Ctrl+Mayús+L)" aria-label="Quitar el bucle" onClick={clearLoop} disabled={!p.loopRegion}>Quitar</button></span><span className="grow"/><Tool label="Alejar" onClick={()=>zoomAt(1/1.3)}><ZoomOut/></Tool><Range label="Zoom horizontal" value={zoom} min={minimumTimelineZoom(timelineSpan,timelineViewport)} max={400} step={minimumTimelineZoom(timelineSpan,timelineViewport)/100} onChange={zoomTo}/><Tool label="Acercar" onClick={()=>zoomAt(1.3)}><ZoomIn/></Tool><Tool label="Ayuda" onClick={()=>setDialog('help')}><HelpCircle/></Tool></div>
  <footer className="statusbar"><span role="status" title={status}>{busy?'\u2026 ':''}{status}</span><span>{p.events.length} eventos · {p.tracks.length} pistas · {tc(endTime(p))}</span><span className="range-status">{p.region?`Tramo ${tc(p.region.start)} → ${tc(p.region.end)}`:'Sin tramo'}</span><span className="loop-status">{p.loopRegion?`Bucle ${tc(p.loopRegion.start)} → ${tc(p.loopRegion.end)}${loop?' (activo)':''}`:loop?'Bucle activo sin zona: repite el proyecto entero':'Sin bucle'}</span></footer>
  <Dialog open={!!dialog} onOpenChange={v=>{if(!v&&!rendering)setDialog('');}}><DialogContent className={`editor-dialog ${dialog==='event'||dialog==='titles'?'wide-dialog':''} ${floating?'floating-dialog':''}`} showCloseButton={!rendering&&!floating} aria-describedby="dialog-description"><DialogTitle className={floating?'sr-only':undefined}>{({event:'Propiedades del evento · Pan/Crop',track:'Propiedades de pista',project:'Propiedades del proyecto',export:'Renderizar como',help:'Corte 15 · Funciones y atajos',new:'Nuevo proyecto',import:'Informe de importación',veg:'Análisis del proyecto .veg',pexels:'Recursos de Pexels',keys:'Claves de API (Groq y Pexels)',pancrop:'Panoramización y recorte · Pan/Crop',trackmotion:'Movimiento de pista',titles:'Títulos y texto',effects:'Efectos de vídeo',mixer:'Mezclador',trimmer:'Trimmer · edición de tres puntos',markers:'Exportar los marcadores · capítulos y subtítulos'} as Record<string,string>)[dialog]}</DialogTitle><DialogDescription id="dialog-description" className={floating?'sr-only':undefined}>{dialog==='export'?'Composición y mezcla local; tus archivos no se envían a un servidor.':dialog==='event'?'Los cambios se aplican a la vista previa y a la exportación.':dialog==='import'?'Resumen de lo que se pudo leer del proyecto y de lo que no.':'Editor independiente inspirado en el espacio de trabajo clásico.'}</DialogDescription>
   {dialog==='new'&&<><p>Descarga el proyecto actual si quieres conservarlo. El nuevo proyecto reemplazará la recuperación automática.</p><div className="dialog-actions"><button onClick={save}>Guardar actual</button><button onClick={()=>{pause();library.current.dispose();history.current=new History();replace(newProject());seek(0);setSelected([]);setDialog('');}}>Crear proyecto vacío</button></div></>}
   {dialog==='project'&&<><label className="field"><span>Nombre</span><input value={p.name} onChange={e=>edit(d=>{d.name=e.target.value;})}/></label><div className="template-row"><span className="range-label">Plantilla</span><Choice label="Plantilla de proyecto" value={detectTemplate(p)} items={templateItems()} onChange={applyTemplate}/></div>{templateById(detectTemplate(p))?<p className="export-plan"><strong>{templateById(detectTemplate(p))!.name}</strong> · {describeFormat(p)}. {templateById(detectTemplate(p))!.note}</p>:<p className="export-plan">Formato personalizado: {describeFormat(p)}. Elige una plantilla para empezar con las medidas de TikTok, Reels, Shorts, YouTube, cine o audio.</p>}<div className="form-grid"><Field label="Ancho" value={p.width} min={16} max={7680} step={2} onChange={v=>edit(d=>{d.width=Math.round(v/2)*2;})}/><Field label="Alto" value={p.height} min={16} max={4320} step={2} onChange={v=>edit(d=>{d.height=Math.round(v/2)*2;})}/><label className="field">Fotogramas por segundo<Choice label="FPS del proyecto" value={fpsValue(p)} items={fpsOptions} onChange={v=>edit(d=>{d.fps=readFps(v);})}/></label><label className="field">Audio<Choice label="Frecuencia de audio" value={String(p.sampleRate)} items={[["48000","48 000 Hz"],["44100","44 100 Hz"]]} onChange={v=>edit(d=>{d.sampleRate=Number(v);})}/></label><label className="field">Formato de timecode<Choice label="Formato de timecode" value={p.timecodeFormat??'non-drop'} items={TIMECODE_FORMATS.map(format=>[format,TIMECODE_LABEL[format]])} onChange={v=>edit(d=>{d.timecodeFormat=v as TimecodeFormat;})}/></label></div><p><small>{TIMECODE_NOTE[p.timecodeFormat??'non-drop']}{effectiveNote(p)}</small></p><hr/><Check checked={cacheMedia} onChange={setCacheMedia}>Conservar una copia de los medios importados en este navegador</Check><p>El archivo .corte15 guarda ediciones, efectos y referencias. No incluye los archivos multimedia. El cache del navegador puede ser borrado; conserva tus originales para revincular.</p><small>{storageInfo}</small><button onClick={save}>Descargar proyecto</button><button onClick={saveAsVeg} disabled={busy||!p||!bridge?.vegas}>Guardar como .veg (VEGAS 15)</button><small>{bridge?.vegas?'El .veg se escribe con VEGAS y guarda pistas, eventos, recortes, fundidos y marcadores.':'El puente de VEGAS no está en marcha.'}</small>{bridge&&!bridge.vegas&&<small>{VEG_BRIDGE_HELP}</small>}</>}
   {dialog==='event'&&selectedEvent&&<><EventProperties project={p} event={selectedEvent} media={selectedEvent.mediaId?p.media.find(m=>m.id===selectedEvent.mediaId):undefined} onChange={updateEvent} onSwitch={(key,value)=>setSwitch(selectedEvent,key,value)} onResample={mode=>setResample(selectedEvent,mode)} onSpeed={v=>edit(d=>{for(const e of d.events.filter(e=>linkedIds(d,[selectedEvent.id]).includes(e.id))){e.duration=Math.round(e.duration*e.speed/v);e.speed=v;e.fadeIn=Math.min(e.fadeIn,e.duration);e.fadeOut=Math.min(e.fadeOut,e.duration);}})} onAccept={()=>setDialog('')} onCancel={cancelEventDialog}/><details className="extras" open><summary className="extras-title">Extras de Corte 15 · se aplican al momento (pliega esta sección para ver la réplica sin desplazarte)</summary><div className="event-properties"><section><h3>Evento</h3>{selectedEvent.kind==='text'&&<button className="wide-button" onClick={()=>setDialog('titles')}>Abrir el editor de títulos y texto→</button>}{selectedEvent.kind!=='audio'&&<button className="wide-button" onClick={()=>setDialog('effects')}>Efectos de vídeo→ ({selectedEvent.effects?.length??0} en la pila)</button>}{selectedEvent.kind!=='audio'&&<><label className="field">Transición de entrada<Choice label="Transición de entrada" value={selectedEvent.transition??'none'} items={[['none','Ninguna'],...TRANSITION_KINDS.map(kind=>[kind,TRANSITION_LABEL[kind]] as [string,string])]} onChange={v=>updateEvent({transition:v==='none'?undefined:(v as TransitionKind)})}/></label>{selectedEvent.transition&&!(selectedEvent.fadeIn>0)&&<p className="export-warning" role="alert">La transición dura lo que el fundido de entrada: ponle entrada (más abajo) o se verá un corte seco.</p>}{selectedEvent.transition&&TRANSITION_NOTE[selectedEvent.transition]&&<p><small>{TRANSITION_NOTE[selectedEvent.transition]}</small></p>}</>}{selectedEvent.kind==='color'&&<div className="form-grid"><label className="field">Color<input type="color" aria-label="Color del generador" value={selectedEvent.color} onChange={e=>updateEvent({color:e.target.value})}/></label><label className="field">Generador<Choice label="Generador de medios" value={selectedEvent.generator?.kind??'solid'} items={GENERATOR_ITEMS} onChange={v=>updateEvent({generator:{...(selectedEvent.generator??mediaGenerator('solid',selectedEvent.color)),kind:v as GeneratorKind}})}/></label><label className="field">Segundo color<input type="color" aria-label="Segundo color del generador" value={selectedEvent.generator?.color2??'#101010'} onChange={e=>updateEvent({generator:{...(selectedEvent.generator??mediaGenerator('solid',selectedEvent.color)),color2:e.target.value}})}/></label><Field label="Ángulo del degradado (°)" value={selectedEvent.generator?.angle??0} min={-360} max={360} step={5} onChange={v=>updateEvent({generator:{...(selectedEvent.generator??mediaGenerator('solid',selectedEvent.color)),angle:v}})}/><Field label="Tamaño de celda (px)" value={selectedEvent.generator?.size??24} min={2} max={400} step={1} onChange={v=>updateEvent({generator:{...(selectedEvent.generator??mediaGenerator('solid',selectedEvent.color)),size:v}})}/></div>}<Field label="Inicio (s)" value={seconds(selectedEvent.start)} min={0} step={.01} onChange={v=>edit(d=>{const ids=linkedIds(d,[selectedEvent.id]);const delta=quantize(ticks(v),p.fps)-selectedEvent.start;const safe=Math.max(delta,-Math.min(...d.events.filter(e=>ids.includes(e.id)).map(e=>e.start)));for(const e of d.events)if(ids.includes(e.id))e.start+=safe;})}/><Field label="Duración (s)" value={seconds(selectedEvent.duration)} min={seconds(frameTicks(p.fps))} step={.01} onChange={v=>edit(d=>trim(d,selectedEvent.id,'right',quantize(ticks(v),p.fps)-selectedEvent.duration,ripple))}/><Field label="Entrada (s)" value={seconds(selectedEvent.fadeIn)} min={0} max={seconds(selectedEvent.duration)} step={.1} onChange={v=>updateEvent({fadeIn:ticks(v)})}/><Field label="Salida (s)" value={seconds(selectedEvent.fadeOut)} min={0} max={seconds(selectedEvent.duration)} step={.1} onChange={v=>updateEvent({fadeOut:ticks(v)})}/><Field label="Ganancia de audio" value={selectedEvent.gain} min={0} max={2} step={.05} onChange={v=>updateEvent({gain:v})}/></section><section><h3>Pan/Crop · transformación 2D</h3><button className="wide-button" onClick={()=>setDialog('pancrop')}>Abrir la ventana de Panoramización y recorte (con claves y asas)→</button>{(['x','y','scale','rotation','opacity','crop'] as const).map((key,i)=><Field key={key} label={['Posición X (fracción)','Posición Y (fracción)','Escala','Rotación °','Opacidad','Recorte uniforme'][i]} value={selectedEvent.transform[key]} min={key==='scale'?.05:key==='opacity'||key==='crop'?0:undefined} max={key==='opacity'?1:key==='crop'?.45:undefined} step={key==='rotation'?1:.01} onChange={v=>updateEvent({transform:{...selectedEvent.transform,[key]:v}})}/>)}<button onClick={()=>updateEvent({keys:[...selectedEvent.keys.filter(k=>k.time!==Math.max(0,cursor-selectedEvent.start)),{...selectedEvent.transform,time:Math.max(0,Math.min(selectedEvent.duration,cursor-selectedEvent.start))}]})}>Añadir clave en cursor</button><small>{selectedEvent.keys.length} claves · interpolación lineal</small>{selectedEvent.keys.map((k,i)=><button key={i} className="key-chip" title="Eliminar clave" onClick={()=>updateEvent({keys:selectedEvent.keys.filter((_,j)=>j!==i)})}>{seconds(k.time).toFixed(2)} s —</button>)}</section><section><h3>Color y contenido</h3><Field label="Brillo" value={selectedEvent.brightness} min={0} max={3} step={.05} onChange={v=>updateEvent({brightness:v})}/><Field label="Contraste" value={selectedEvent.contrast} min={0} max={3} step={.05} onChange={v=>updateEvent({contrast:v})}/><Field label="Saturación" value={selectedEvent.saturation} min={0} max={3} step={.05} onChange={v=>updateEvent({saturation:v})}/><Field label="Tono °" value={selectedEvent.hue} min={-180} max={180} onChange={v=>updateEvent({hue:v})}/>{(selectedEvent.kind==='text'||selectedEvent.kind==='color')&&<label className="field">Color<input type="color" value={selectedEvent.color} onChange={e=>updateEvent({color:e.target.value})}/></label>}{selectedEvent.kind==='text'&&<><textarea aria-label="Texto del título" rows={3} value={selectedEvent.text} onChange={e=>updateEvent({text:e.target.value})}/><label className="field">Fuente<Choice label="Fuente del texto" value={selectedEvent.font} items={[["Arial","Arial"],["Georgia","Georgia"],["Verdana","Verdana"],["Courier New","Courier New"]]} onChange={v=>updateEvent({font:v})}/></label><Field label="Tamaño" value={selectedEvent.fontSize} min={8} max={500} onChange={v=>updateEvent({fontSize:v})}/><Choice label="Alineación del texto" value={selectedEvent.align} items={[["left","Izquierda"],["center","Centro"],["right","Derecha"]]} onChange={v=>updateEvent({align:v as Event['align']})}/></>}</section></div></details><div className="dialog-actions"><button onClick={()=>group()}>Agrupar selección</button><button onClick={()=>group(true)}>Desagrupar vinculados</button><button onClick={()=>{doSplit();setDialog('');}}>Dividir en cursor</button><button onClick={()=>setDialog('')}>Cerrar</button></div></>}
   {dialog==='track'&&selectedTrack&&<><label className="field">Nombre<input value={selectedTrack.name} onChange={e=>updateTrack({name:e.target.value})}/></label>{selectedTrack.kind==='audio'?<><Field label="Volumen" value={selectedTrack.gain} min={0} max={2} step={.05} onChange={v=>updateTrack({gain:v})}/><Field label="Panorámica (−1 izquierda, +1 derecha)" value={selectedTrack.pan} min={-1} max={1} step={.1} onChange={v=>updateTrack({pan:v})}/></>:<>{(['x','y','scale','rotation','opacity'] as const).map(key=><Field key={key} label={key} value={selectedTrack.transform[key]} min={key==='scale'?.05:key==='opacity'?0:undefined} max={key==='opacity'?1:undefined} step={.05} onChange={v=>updateTrack({transform:{...selectedTrack.transform,[key]:v}})}/>)}</>}<button className="wide-button" onClick={()=>setDialog('trackmotion')}>Abrir la ventana de Movimiento de pista→</button><div className="dialog-actions"><button onClick={()=>trackId&&moveTrack(trackId,-1)}>Subir pista</button><button onClick={()=>trackId&&moveTrack(trackId,1)}>Bajar pista</button></div><button onClick={()=>{const id=trackId;if(!id)return;edit(d=>{d.events=d.events.filter(e=>e.trackId!==id);d.tracks=d.tracks.filter(t=>t.id!==id);});setTrackId(null);setDialog('');setStatus('Pista eliminada con sus eventos. Puedes deshacerlo con Ctrl/Cmd+Z.');}}>Eliminar pista y eventos (se puede deshacer)</button></>}
   {dialog==='pancrop'&&selectedEvent&&<PanCropWindow eventId={selectedEvent.id} project={p} library={library.current} time={cursor} duration={selectedEvent.duration} eventStart={selectedEvent.start} pose={pose(selectedEvent,cursor)} mask={selectedEvent.mask} keys={selectedEvent.keys} source={cropSource} label={`${selectedEvent.name} · ${tc(selectedEvent.start)}`} maskPath={selectedEvent.maskPath} presets={p.panCropPresets} onPresets={list=>edit(d=>{d.panCropPresets=list;})} stretchFill={selectedEvent.stretchFill} onStretchFill={v=>updateEvent({stretchFill:v})} maintainAspect={selectedEvent.maintainAspect} onMaintainAspect={v=>edit(d=>{for(const e of d.events)if(linkedIds(d,[selectedEvent.id]).includes(e.id))e.maintainAspect=v;})} smoothness={selectedEvent.keySmoothness??100} onSmoothness={v=>updateEvent({keySmoothness:v})} onBeginMask={beginMask} onMaskPath={changeMaskPath} onPose={next=>updateEvent({transform:next})} onMask={mask=>updateEvent({mask})} onKeys={keys=>updateEvent({keys})} onSeek={seek} onClose={()=>setDialog('event')}/>}
   {dialog==='trackmotion'&&selectedTrack&&<PanCropWindow project={p} library={library.current} time={cursor} duration={Math.max(1,endTime(p))} eventStart={0} pose={selectedTrack.transform} keys={[]} source={null} label={`Movimiento de pista · ${selectedTrack.name}`} allowCrop={false} onBeginMask={()=>{}} onMaskPath={()=>{}} onPose={next=>updateTrack({transform:next})} onMask={()=>{}} onKeys={()=>{}} onSeek={seek} onClose={()=>setDialog('track')}/>}
   {dialog==='titles'&&selectedEvent&&<TitlesWindow project={p} library={library.current} time={cursor} event={selectedEvent} onChange={updateEvent} onClose={()=>setDialog('event')}/>}
   {dialog==='effects'&&selectedEvent&&<EffectsWindow event={selectedEvent} onChange={updateEvent} onClose={()=>setDialog('event')}/>}
   {dialog==='mixer'&&<Mixer project={p} onTrack={(id,change)=>updateEnvelope(id,change)} onBus={changeBus} onAddBus={()=>edit(d=>{d.buses=[...(d.buses??[]),newBus(`Bus ${String.fromCharCode(65+(d.buses?.length??0))}`)];})} onRemoveBus={removeBus} onMaster={changeMaster} onClose={()=>setDialog('')}/>}
   {dialog==='trimmer'&&selectedMedia&&<Trimmer library={library.current} media={selectedMedia} at={cursor} onEdit={spec=>{const media=selectedMedia;const at=cursor;edit(d=>{const ids=threePointEdit(d,media,{inPoint:spec.inPoint,outPoint:spec.outPoint,at,mode:spec.mode,ripple,trackId:trackId??undefined});setSelected(ids);});setDialog('');setStatus(`${media.name}: ${spec.mode==='insert'?'insertado':'sobrescrito'} en ${tc(at)} (${seconds(spec.outPoint-spec.inPoint).toFixed(2)} s).`);}} onClose={()=>setDialog('')}/>}
   {dialog==='export'&&<><fieldset disabled={rendering}><div className="form-grid"><label className="field">Plantilla<Choice label="Plantilla de render" value={preset} onChange={applyPreset} items={[["custom","Personalizada"],["proyecto","Igual que el proyecto"],["mp4-1080","MP4 · 1080p 30 · Alta"],["mp4-720","MP4 · 720p 30 · Media"],["mp4-480","MP4 · 480p 30 · Borrador"],["webm-720","WebM · 720p 30 · Media"],["wav","Solo audio · WAV 48 kHz"]]}/></label><label className="field">Ámbito<Choice label="Ámbito de render" value={exportSettings.scope} onChange={v=>setExportSettings(s=>({...s,scope:v as ExportSettings['scope'],...(v==='range'&&p.region?{start:p.region.start,end:p.region.end}:{})}))} items={[["full","Proyecto completo"],["range",p.region?`Tramo ${tc(p.region.start)} → ${tc(p.region.end)}`:"Tramo (sin definir)"]]}/></label></div>{exportSettings.scope==='range'&&(p.region?<div className="form-grid"><Field label="Inicio del tramo (s)" value={seconds(exportSettings.start)} min={0} step={.01} onChange={v=>setExportSettings(s=>({...s,start:Math.max(0,Math.min(ticks(v),s.end-frameTicks(p.fps)))}))}/><Field label="Fin del tramo (s)" value={seconds(exportSettings.end)} min={0} step={.01} onChange={v=>setExportSettings(s=>({...s,end:Math.max(s.start+frameTicks(p.fps),ticks(v))}))}/></div>:<p className="export-warning" role="alert">No hay tramo definido. Arrastra sobre la regla de la línea de tiempo, o marca «[» y «]» con el cursor, para elegir qué parte se renderiza.</p>)}<div className="form-grid"><Field label="Ancho" value={exportSettings.width} min={16} max={3840} step={2} onChange={v=>setExportSettings(s=>({...s,width:Math.round(v/2)*2}))}/><Field label="Alto" value={exportSettings.height} min={16} max={2160} step={2} onChange={v=>setExportSettings(s=>({...s,height:Math.round(v/2)*2}))}/><label className="field">FPS<Choice label="FPS de exportación" value={fpsValue(exportSettings)} items={fpsOptions} onChange={v=>setExportSettings(s=>({...s,fps:readFps(v)}))}/></label><label className="field">Calidad<Choice label="Calidad de exportación" value={exportSettings.quality} items={[["draft","Borrador"],["medium","Media"],["high","Alta"],["master","Máxima"]]} onChange={v=>setExportSettings(s=>({...s,quality:v as ExportQuality}))}/></label></div><div className="form-grid"><label className="field">Formato<Choice label="Formato de exportación" value={exportSettings.format} items={[["mp4",`MP4 · H.264 / AAC${cap.mp4?'':' (no disponible)'}`],["webm",`WebM · VP9 / Opus${cap.webm?'':' (no disponible)'}`],["wav",`WAV · PCM 16 bits${cap.wav?'':' (no disponible)'}`]]} onChange={v=>setExportSettings(s=>({...s,format:v as ExportFormat,...(v==='wav'?{includeVideo:false}:{})}))}/></label>{exportSettings.format!=='wav'&&<label className="field">Bitrate de video<Choice label="Bitrate de video" value={exportSettings.bitrateMbps===null?'auto':String(exportSettings.bitrateMbps)} items={[["auto",`Automático (${suggestedBitrate(exportSettings.width,exportSettings.height,exportSettings.fps.num/exportSettings.fps.den,exportSettings.quality)} Mbps)`],["2","2 Mbps"],["4","4 Mbps"],["8","8 Mbps"],["12","12 Mbps"],["20","20 Mbps"],["30","30 Mbps"]]} onChange={v=>setExportSettings(s=>({...s,bitrateMbps:v==='auto'?null:Number(v)}))}/></label>}</div><div className="export-toggles"><Check checked={exportSettings.includeVideo} onChange={v=>setExportSettings(s=>({...s,includeVideo:v}))}>Incluir video</Check><Check checked={exportSettings.includeAudio} onChange={v=>setExportSettings(s=>({...s,includeAudio:v}))}>Incluir audio</Check></div><p className="export-plan">Salida prevista: <strong>{plan.frames}</strong> fotogramas · <strong>{tc(exportRange().end-exportRange().start)}</strong> · {exportSettings.includeVideo?`${exportSettings.width}×${exportSettings.height} a ${(exportSettings.fps.num/exportSettings.fps.den).toFixed(3)} fps`:'sin video'} · {exportSettings.includeAudio?`audio ${p.sampleRate} Hz estéreo`:'sin audio'}</p></fieldset>{!formatReady&&<p className="export-warning" role="alert">{support&&!support.audio?'Este navegador no expone Web Audio (AudioContext/AudioBuffer), necesario para componer y empaquetar el audio. Desmarca «Incluir audio» o abre el proyecto en una versión actual de Chrome, Edge o Firefox.':'El formato elegido no está disponible en este navegador. Prueba WebM o WAV, o abre el proyecto en una versión actual de Chrome, Edge o Firefox.'}</p>}<section className="batch-block"><h3>Lote de renderizado</h3><p className="batch-note">Prepara varios trabajos con los ajustes de arriba y renderízalos uno tras otro: es el «Batch Render» de VEGAS 15, aquí como una cola que descarga cada archivo al terminarlo. El navegador puede pedirte permiso para descargar varios archivos seguidos.</p><div className="dialog-actions"><button onClick={addToBatch} disabled={rendering||!p.events.length||batchProblem!==null}>Añadir a la cola</button><button onClick={addVariantsToBatch} disabled={rendering||!p.events.length}>Añadir las plantillas disponibles</button><button onClick={addAudioTracksToBatch} disabled={rendering||!p.tracks.some(track=>track.kind==='audio')||!cap.wav} title="Una salida WAV por cada pista de audio, como el script «Render Audio Tracks» de VEGAS 15">Añadir una salida por pista de audio</button><button onClick={()=>setBatch([])} disabled={rendering||!batch.length}>Vaciar la cola</button></div>{batchProblem&&<p className="export-warning" role="alert">{batchProblem}</p>}{batch.length>0&&<ol className="batch-list" aria-label="Trabajos del lote">{batch.map((job,index)=><li key={job.id} className={`batch-job ${job.status}`}><span className="batch-order">{index+1}</span><span className="batch-label">{job.label}<small>{job.fileName}{job.status==='hecho'?` · ${(job.bytes/1048576).toFixed(2)} MB en ${(job.elapsedMs/1000).toFixed(1)} s`:job.status==='renderizando'?` · ${job.done}/${job.frames} fotogramas`:job.status==='error'?` · ${job.error}`:''}</small></span><span className="batch-state">{BATCH_STATUS_LABEL[job.status]}</span><button className="range-button" aria-label={`Quitar ${job.label} de la cola`} title="Quitar este trabajo de la cola" onClick={()=>setBatch(list=>list.filter(item=>item.id!==job.id))} disabled={rendering}>Quitar</button></li>)}</ol>}{batch.length>0&&<p className="batch-summary">{batchSummary.total} trabajo(s): {batchSummary.pending} en espera, {batchSummary.done} hecho(s), {batchSummary.failed} con error · {batchSummary.frames} fotogramas en total{batchSummary.bytes?` · ${(batchSummary.bytes/1048576).toFixed(2)} MB descargados`:''}</p>}<div className="dialog-actions"><button onClick={()=>void runBatch()} disabled={rendering||!batchReady||!p.events.length}>Renderizar la cola</button></div></section><Progress className="export-progress" value={progress&&progress.total?progress.done/progress.total*100:0}/><div className="export-progress-detail"><span>{progress?`${progress.done} / ${progress.total} fotogramas`:'Sin empezar'}</span><span>{progress&&progress.rate>0?`${progress.rate.toFixed(1)} fps de render`:'—'}</span><span>{progress?`${(progress.elapsedMs/1000).toFixed(1)} s transcurridos`:'—'}</span><span>{progress&&progress.done>0&&progress.done<progress.total?`restante —0— ${(progress.etaMs/1000).toFixed(0)} s`:'—'}</span><span>{progress&&progress.bytes?`${(progress.bytes/1048576).toFixed(1)} MB`:'—'}</span></div><p role="status" className="export-status">{status}</p><div className="dialog-actions">{rendering?<button onClick={()=>abort.current?.abort()}>Cancelar renderización</button>:<button onClick={()=>void exportNow()} disabled={!p.events.length||!formatReady||!(exportSettings.includeVideo||exportSettings.includeAudio)||(exportSettings.scope==='range'&&!p.region)}>Renderizar y descargar</button>}</div></>}
    {dialog==='veg'&&vegAnalysis&&<div className="veg-report"><p>Archivo <code>{vegAnalysis.name}</code>: {vegAnalysis.bytes} bytes, {vegAnalysis.sizeMatches?'tamaño coherente con la cabecera':'tamaño incoherente con la cabecera'} y {vegAnalysis.chunks.total} bloques <code>list/</code>.</p><div className="veg-grid"><section><h4>Propiedades</h4><ul><li>Duración: {vegAnalysis.duration!==null?`${vegAnalysis.duration.toFixed(3)} s`:'no disponible'}</li><li>Velocidad de fotogramas: {vegAnalysis.frameRate?`${vegAnalysis.frameRate} fps (confianza ${vegAnalysis.frameRateConfidence})`:'no determinada'}</li><li>Resolución: {vegAnalysis.width?`${vegAnalysis.width}×${vegAnalysis.height}`:'no detectada'}</li><li>Creado: {vegAnalysis.createDate??'—'}</li><li>Modificado: {vegAnalysis.modifyDate??'—'}</li><li>—altimo programa: {vegAnalysis.software??'—'}</li></ul></section><section><h4>Medios referenciados ({vegAnalysis.media.length})</h4><ul>{vegAnalysis.media.map(ref=><li key={ref.path}><code>{ref.path}</code></li>)}</ul></section><section><h4>Títulos encontrados ({vegAnalysis.titles.length})</h4><ul>{vegAnalysis.titles.map((title,index)=><li key={index}><strong>{title.name}</strong>: {title.text.split('\n').filter(Boolean).join(' / ')}</li>)}</ul></section></div>{vegAnalysis.warnings.map((warning,index)=><p className="export-warning" key={index}>{warning}</p>)}<p className="export-plan">{VEG_LIMITS}</p>{vegAnalysis.notes.map((note,index)=><p key={index}><small>{note}</small></p>)}<div className="dialog-actions"><button onClick={importVegReferences} disabled={!vegAnalysis.media.length}>Importar los medios referenciados</button><button onClick={importVegTimeline} disabled={!vegFile||busy||!bridge?.vegas}>Importar el montaje completo con VEGAS</button><button onClick={()=>setDialog('')}>Cerrar</button></div>{bridge?<p className={bridge.vegas?'export-plan':'export-warning'}>{bridge.vegas?`Puente listo: VEGAS leerá pistas, eventos, recortes, fundidos, velocidad, movimiento y marcadores, y podrás guardar como .veg en ${bridge.output||'tu carpeta de documentos'}.`:`Puente no disponible: ${bridge.message}`}</p>:<p className="export-plan">Comprobando el puente de VEGAS→</p>}{vegTimeline&&<section><h4>Montaje importado</h4><ul><li>{vegTimeline.events} evento(s) en {vegTimeline.tracks} pista(s), {vegTimeline.media} medio(s) y {vegTimeline.markers} marcador(es).</li><li>Velocidad {vegTimeline.fps}{vegTimeline.frameRateExact?'':' (ajustada)'} · {vegTimeline.width}×{vegTimeline.height}</li></ul>{vegTimeline.warnings.map((warning,index)=><p className="export-warning" key={`w${index}`}>{warning}</p>)}{vegTimeline.ignored.slice(0,6).map((entry,index)=><p key={`i${index}`}><small>{entry}</small></p>)}{vegTimeline.log.map((entry,index)=><p key={`l${index}`}><small>{entry}</small></p>)}</section>}</div>}
    {dialog==='pexels'&&<><label className="field">Modo<Choice label="Modo de búsqueda en Pexels" value={pexelsMode} items={[["transcript","Según la transcripción"],["query","Buscar por texto"]]} onChange={v=>setPexelsMode(v as 'query'|'transcript')}/></label>{pexelsMode==='query'?<><label className="field">Búsqueda<input value={pexelsQuery} aria-label="Búsqueda en Pexels" placeholder="p. ej. ciudad nocturna" onChange={e=>setPexelsQuery(e.target.value)}/></label><p className="export-plan">Los clips se descargan a este equipo, se añaden a Medios de proyecto (carpetas Videos y Todos los medios) y se colocan uno tras otro en una pista «Pexels» a partir del cursor. Autoría: Pexels.</p></>:<><p className="export-plan">Se lee la transcripción frase a frase: de cada frase se sacan sus palabras clave y se busca un clip en Pexels que se coloca <strong>justo en el momento en que se dice</strong>, recortado a la duración de la frase. Si una palabra se repite, se reutiliza el mismo clip en lugar de descargarlo otra vez. Máximo {Math.min(12,Math.max(2,pexelsCount*2))} descargas por tanda. Autoría: Pexels.</p>{transcriptCues().length===0?<p className="export-warning" role="alert">Todavía no hay transcripción: pulsa «Generar subtítulos» o abre un proyecto que ya tenga su archivo .srt.</p>:<p>Frases disponibles: <strong>{transcriptCues().length}</strong> · palabras detectadas: {[...new Set(resourceTerms(transcriptCues(),3).flatMap(entry=>entry.terms))].slice(0,12).join(', ')||'ninguna'}.</p>}</>}<div className="form-grid"><label className="field">Cantidad<Choice label="Cantidad de recursos" value={String(pexelsCount)} items={[['2','2 clips'],['4','4 clips'],['6','6 clips'],['10','10 clips']]} onChange={v=>setPexelsCount(Number(v))}/></label><label className="field">Orientación<Choice label="Orientación de los recursos" value={pexelsOrientation} items={[['landscape','Horizontal'],['portrait','Vertical'],['any','Cualquiera']]} onChange={v=>setPexelsOrientation(v as 'landscape'|'portrait'|'any')}/></label></div><p role="status" className="export-status">{aiBusy||status}</p><div className="dialog-actions">{pexelsMode==='query'?<button onClick={()=>void runPexels()} disabled={!!aiBusy||!pexelsQuery.trim()}>{aiBusy?'Buscando y descargando→':'Buscar y colocar'}</button>:<button onClick={()=>void runPexelsFromTranscript()} disabled={!!aiBusy||!transcriptCues().length}>{aiBusy?'Buscando y descargando→':'Colocar recursos según la transcripción'}</button>}<button onClick={()=>setDialog('')} disabled={!!aiBusy}>Cancelar</button></div></>}{dialog==='keys'&&<><label className="field">Groq · transcripción<input type="password" aria-label="Clave de Groq" value={apiKeys.groq} onChange={e=>setApiKeys(keys=>({...keys,groq:e.target.value}))}/></label><label className="field">Pexels · recursos<input type="password" aria-label="Clave de Pexels" value={apiKeys.pexels} onChange={e=>setApiKeys(keys=>({...keys,pexels:e.target.value}))}/></label><p className="export-plan">Las claves se guardan solo en este navegador y nunca se escriben en el archivo de proyecto. El audio del proyecto sale de tu equipo únicamente cuando pulsas «Generar subtítulos».</p><div className="dialog-actions"><button onClick={()=>{saveKeys(apiKeys);setDialog('');}}>Guardar claves</button><button onClick={()=>setDialog('')}>Cancelar</button></div></>}
    {dialog==='import'&&importReport&&<div className="import-report"><p>Se importó <strong>{importReport.format}</strong> desde <code>{importReport.source}</code> a {importReport.fps} fps: {importReport.tracks} pistas, {importReport.events} eventos y {importReport.media} medios referenciados.</p><p className="export-plan">El proyecto exportado no contiene los archivos de video ni de audio: aparecen como medios faltantes hasta que los revincules desde el panel de medios.</p>{importReport.warnings.length>0&&<><h4>Avisos</h4><ul>{importReport.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul></>}{importReport.ignored.length>0&&<><h4>No importado</h4><ul>{importReport.ignored.map((warning,index)=><li key={index}>{warning}</li>)}</ul></>}<div className="dialog-actions"><button onClick={()=>setDialog('')}>Entendido</button></div></div>}
   {dialog==='markers'&&(()=>{const format=markerFormatById(markerFormat);const text=buildMarkerExport(p.markers,format.value,p.fps,p.timecodeFormat??'non-drop',endTime(p));const preview=text.split('\n').slice(0,8).join('\n');return <><p>Se exportan los <strong>{p.markers.length}</strong> marcador(es) de la línea de tiempo como <strong>{format.label.toLowerCase()}</strong>.</p><label className="field">Formato<Choice label="Formato de exportación" value={markerFormat} items={MARKER_FORMATS.map(item=>[item.value,item.label])} onChange={v=>setMarkerFormat(v as MarkerExportFormat)}/></label><p><small>{format.note}</small></p>{p.markers.length?<pre className="marker-preview" aria-label="Vista previa de la exportación">{preview}{(text.split('\n').length>8)?'\n…':''}</pre>:<p className="export-warning" role="alert">Todavía no hay marcadores: ponlos con «M» o desde el menú Insertar y vuelve a abrir esta ventana.</p>}<div className="dialog-actions"><button onClick={downloadMarkers} disabled={!p.markers.length}>Descargar {format.extension.toUpperCase()}</button><button onClick={()=>setDialog('')}>Cancelar</button></div></>;})()}
   {dialog==='attributes'&&copiedAttributes&&attributeTarget&&(()=>{const target=p.events.find(item=>item.id===attributeTarget.id);const kind=target?.kind??'video';const chosen=attributeTarget.groups;const toggle=(id:AttributeGroupId)=>setAttributeTarget(current=>current?{...current,groups:current.groups.includes(id)?current.groups.filter(other=>other!==id):[...current.groups,id]}:current);return <><p>Atributos copiados de <strong>{copiedAttributes.from}</strong>. Se pegarán en <strong>{target?.name??'el evento'}</strong>; destilda lo que no quieras llevar.</p><div className="attribute-groups">{groupsFor(kind).map(group=>{const copyable=group.keys.some(key=>key in copiedAttributes.patch);const fits=groupFits(group,kind);const available=copyable&&fits;return <label className={available?'check':'check disabled'} key={group.id}><input type="checkbox" aria-label={group.label} checked={chosen.includes(group.id)} disabled={!available} onChange={()=>toggle(group.id)}/>{group.label}<small>{available?group.note:!fits?'No se puede pegar en este tipo de evento.':'El evento copiado no tenía esto.'}</small></label>;})}</div><div className="dialog-actions"><button onClick={()=>{pasteEventAttributes(attributeTarget.id,chosen);setDialog('');}} disabled={!chosen.length}>Pegar {chosen.length} grupo(s)</button><button onClick={()=>setDialog('')}>Cancelar</button></div></>;})()}
   {dialog==='help'&&<div className="help-content"><p>Importa tus archivos, arrástralos a las pistas y haz doble clic en un evento para editarlo. Arrastra sus bordes para recortar y sus esquinas superiores para fundir.</p><dl><dt>Ctrl/Cmd + rueda</dt><dd>Desplaza la línea de tiempo de arriba abajo</dd><dt>Alt + arriba/abajo</dt><dd>Sube o baja la pista seleccionada</dd><dt>Arrastrar la cabecera de una pista</dt><dd>La cambia de sitio dentro de su grupo</dd><dt>Rueda</dt><dd>Zoom horizontal anclado en la aguja, para no perder de vista el punto de edición; Mayús + rueda desplaza en horizontal y Alt + rueda en vertical</dd><dt>Clic en un evento</dt><dd>Selecciona el evento y coloca la aguja en ese punto</dd><dt>Arrastrar en la regla</dt><dd>Define el tramo que se puede renderizar; doble clic lo quita</dd><dt>[ / ]</dt><dd>Marcar inicio y fin del tramo en el cursor</dd><dt>L / Mayús + L</dt><dd>Marcar el inicio y el fin de la región de bucle en el cursor; el bucle es independiente del tramo de renderizado</dd><dt>Alt + L</dt><dd>Activar o desactivar la repetición de la región de bucle (también el botón *Repetir* del pie)</dd><dt>Ctrl + Mayús + L</dt><dd>Quitar la región de bucle; *Desde tramo* o el menú *Insertar* la copian del tramo de renderizado</dd><dt>Ctrl + arrastrar en la regla o en un hueco</dt><dd>Define la región de bucle en lugar del tramo; doble clic sobre la barra verde la quita</dd><dt>Lote de renderizado</dt><dd>En «Renderizar como…» se preparan varios trabajos con los ajustes del diálogo y se renderizan en serie; cada archivo se descarga al terminarlo</dd><dt>S</dt><dd>Dividir eventos en el cursor</dd><dt>Espacio</dt><dd>Reproducir / detener y volver al inicio de reproducción</dd><dt>Enter</dt><dd>Reproducir / pausa</dd><dt>· / </dt><dd>Un fotograma</dd><dt>Alt + ←/→</dt><dd>Desliza el contenido del evento (slip): mueve el material sin mover el clip</dd><dt>Ctrl/Cmd + Alt + ←/→</dt><dd>Desplaza el evento (slide): lo mueve y los vecinos estiran o encogen su borde</dd><dt>Alt + Mayús + ←/→</dt><dd>Recorta el evento hasta el cursor y adelanta lo que venía después (rizo)</dd><dt>Ctrl/Cmd + clic</dt><dd>Selección múltiple (también Mayús)</dd><dt>Clic en la cabecera de una pista</dt><dd>Selecciona la pista, que queda resaltada; el clic derecho abre su menú</dd><dt>Supr con una pista seleccionada</dt><dd>Elimina esa pista con todos sus eventos (Ctrl/Cmd+Z lo deshace); si hay eventos seleccionados, borra solo esos eventos</dd><dt>G / U</dt><dd>Agrupar / desagrupar</dd><dt>M</dt><dd>Marcador; clic derecho lo elimina</dd><dt>Alt + Enter</dt><dd>Propiedades del proyecto</dd><dt>Inicio / W</dt><dd>Ir al principio</dd><dt>Fin / Ctrl+Fin</dt><dd>Final de la región (o del proyecto con Ctrl)</dd><dt>Ctrl/Cmd + Z, Y</dt><dd>Deshacer / rehacer</dd><dt>Ctrl/Cmd + C, X, V</dt><dd>Copiar, cortar, pegar</dd><dt>Ctrl/Cmd + S, O</dt><dd>Guardar / abrir proyecto</dd></dl><p className="help-note">Renderizado: elige plantilla, ámbito (proyecto completo o tramo), calidad y, si lo necesitas, un bitrate explícito. El progreso muestra fotogramas por segundo, tiempo transcurrido y tiempo restante, y el formato se detecta en el navegador: MP4 H.264/AAC, WebM VP9/Opus o WAV PCM.</p><p>Ctrl+L y F12 están reservados por muchos navegadores; usa los controles visibles. Atajos desactivados al escribir.</p><h3>Alcance de esta versión</h3><p>Composición 2D, texto, corrección básica, fundidos, mezcla estéreo y exportación mediante códecs detectados. Pan/Crop simplificado con recorte uniforme y claves lineales. La velocidad cambia el tono. Ripple cubre inserción, recorte final y borrado; mover y pegar no desplazan automáticamente otros eventos.</p><p>No incluye .veg: es un contenedor binario propietario sin especificación pública, así que no se interpreta ni se simula. Para traer un proyecto desde VEGAS Pro 15 usa Archivo → Exportar → «Final Cut Pro 7/DaVinci Resolve (*.xml)» o «Archivo de texto EDL (*.txt)» y ábrelo aquí con Abrir o importar proyecto. Tampoco hay plugins nativos, composición 3D, máscaras libres, curvas Bézier, time stretching con tono preservado, proxies ni exportación en segundo plano. Los códecs y límites de memoria dependen del navegador: en las pruebas, Chrome y Edge exportan MP4 H.264/AAC y Firefox WebM VP9/Opus; el WebKit de pruebas no expone WebCodecs ni Web Audio, así que allí solo se consulta la interfaz. Safari en macOS no está probado.</p><p>Medios y proyectos se procesan localmente. El JSON descargado no guarda los videos. Las copias locales pueden ser desalojadas por el navegador.</p></div>}
  </DialogContent></Dialog>
  <WorkspaceMenu menu={contextMenu} onClose={()=>setContextMenu(null)}/>
 </main>;
}

