'use client';
// Diálogo «Propiedades» del evento, calcado del de VEGAS Pro 15.
//
// Sus dos pestañas y sus etiquetas salen de la tabla de cadenas en español del propio VEGAS 15 (recursos de
// idioma 1034 de vegas150.exe; ver ANALISIS-VEGAS-REA.md §5 y outputs/rea/vegas150-es-propiedades.txt):
//   Evento de vídeo:  Nombre de toma activa · Modificadores (Silencio, Bloqueo, Bucle, Mantener relación de
//                     aspecto, Reducir parpadeo de entrelazado) · Utilice el modo Re-muestreo de proyecto /
//                     Forzar re-muestreo / Deshabilitar re-muestreo · Velocidad de reproducción ·
//                     Ajustarse a la velocidad de fotogramas del proyecto · Veloc. de inframuestreo.
//   Medios:           Nombre de archivo · Nombre de cinta · Código de tiempo · Propiedades de reproducción
//                     (Corriente, Formato, Atributos, Velocidad de fotogramas, Orden de campos, Relación de
//                     aspecto del píxel, Canal Alfa, Color de fondo, Espacio de color).
//
// Los interruptores que este motor no aplica lo dicen en su propia línea (`EVENT_SWITCH_NOTE`): la ventana
// enseña lo que VEGAS enseña, y al lado, qué hace aquí. Los cambios se aplican en vivo, como el resto del
// editor; «Cancelar» devuelve el evento a como estaba al abrir la ventana.
import { useState, type ReactNode } from 'react';
import { Tabs,TabsContent,TabsList,TabsTrigger } from '@/components/ui/tabs';
import { Check,Field } from './controls';
import { EVENT_SWITCH_NOTE, Event, Media, Project, RESAMPLE_LABEL, RESAMPLE_MODES, ResampleMode, seconds } from '@/lib/editor/project';

export function EventProperties({project,event,media,onChange,onSpeed,onSwitch,onResample,onAccept,onCancel,timing,framing,color,selectionActions}:{timing?:ReactNode;framing?:ReactNode;color?:ReactNode;selectionActions?:ReactNode;project:Project;event:Event;media?:Media;onChange:(change:Partial<Event>)=>void;onSpeed?:(speed:number)=>void;onSwitch?:(key:'muted'|'locked'|'loop'|'maintainAspect'|'reduceFlicker'|'conform'|'reversed',value:boolean)=>void;onResample?:(mode:ResampleMode)=>void;onAccept:()=>void;onCancel:()=>void}){
 const [showNotes,setShowNotes]=useState(false);
 const fps=project.fps.num/project.fps.den;
 // «Nombre de toma activa»: en VEGAS es el nombre de la toma que suena en el evento. Aquí el evento tiene una
 // sola toma, que es el medio que muestra, así que el campo enseña ese nombre y renombrarlo renombra el evento.
 const takeName=event.name;
 const switches:(keyof typeof EVENT_SWITCH_NOTE)[]=['muted','locked','loop','maintainAspect'];
 const labels:Record<string,string>={muted:'Silenciar recurso',locked:'Bloquear en la línea del tiempo',loop:'Repetir en bucle',maintainAspect:'Mantener relación de aspecto',reduceFlicker:'Reducir parpadeo de entrelazado',conform:'Ajustarse a la velocidad de fotogramas del proyecto',reversed:'Invertir el material (reproducir al revés)',undersample:'Veloc. de inframuestreo'};
 // El estado del interruptor sale del evento. «Mantener relación de aspecto» es el único que viene **puesto**
 // cuando el campo no está: quitarlo es lo que estira el material hasta llenar el fotograma.
 const on=(key:string)=>key==='maintainAspect'?(event.maintainAspect??true):Boolean(event[key as keyof Event]);
 // Los interruptores que están activos ahora mismo, para poder explicar solo esos.
 const active:Record<string,string>={...labels};
 const activos=[...switches,'conform','undersample'].filter(key=>on(key)||(key==='undersample'&&(event.undersample??0)>0));
 return <div className="resource-inspector">
  <div className="resource-heading"><span className="resource-kind">{event.kind==='text'?'Texto / subtítulo':event.kind==='audio'?'Audio':event.kind==='color'?'Generador':'Vídeo / imagen'}</span><strong>{event.name}</strong><span>{seconds(event.duration).toFixed(2)} s</span></div>
  <Tabs defaultValue="video" className="resource-tabs">
   <TabsList className="resource-nav"><TabsTrigger value="video">General</TabsTrigger>{timing&&<TabsTrigger value="timing">Tiempo y efectos</TabsTrigger>}{event.kind!=='audio'&&framing&&<TabsTrigger value="framing">Encuadre</TabsTrigger>}{event.kind!=='audio'&&color&&<TabsTrigger value="color">Color y contenido</TabsTrigger>}<TabsTrigger value="media">Archivo</TabsTrigger></TabsList>
   <TabsContent value="video" className="property-tab">
    <label className="field"><span>Nombre del recurso</span><input value={takeName} aria-label="Nombre del recurso" onChange={e=>onChange({name:e.target.value})}/></label>
    <section className="property-group">
     <h3>Comportamiento del recurso</h3><p className="resource-hint">Controla cómo aparece y se reproduce en la línea del tiempo.</p>
     <div className="property-checks">
      {switches.map(key=><Check key={key} checked={on(key)} onChange={v=>onSwitch?onSwitch(key as 'muted',v):onChange({[key]:v} as Partial<Event>)}>{labels[key]}</Check>)}
     </div>
     <div className="form-grid">
      <Field label="Velocidad de reproducción" value={event.speed} min={.25} max={4} step={.05} onChange={v=>onSpeed?onSpeed(v):onChange({speed:v})}/>

     </div>
     <p className="property-note"><small>Velocidad efectiva: {(event.speed*fps).toFixed(3)} fps · inframuestreo {(event.undersample??0)>0?`${event.undersample} fps`:'desactivado'} · se conserva el tono</small></p>
     <Check checked={on('reversed')} onChange={v=>onSwitch?onSwitch('reversed',v):onChange({reversed:v})}>{labels.reversed}</Check>
     <details className="resource-advanced"><summary>Ajustes avanzados de fotogramas</summary>      <Field label="Veloc. de inframuestreo (fps)" value={event.undersample??0} min={0} max={240} step={1} onChange={v=>onChange({undersample:v||undefined})}/><Check checked={on('reduceFlicker')} onChange={v=>onSwitch?onSwitch('reduceFlicker',v):onChange({reduceFlicker:v})}>{labels.reduceFlicker}</Check>     <fieldset className="property-radios">
      {RESAMPLE_MODES.map(mode=><label key={mode} className="radio"><input type="radio" name="resample" value={mode} checked={(event.resample??'project')===mode} onChange={()=>onResample?onResample(mode):onChange({resample:mode as ResampleMode})}/>{RESAMPLE_LABEL[mode]}</label>)}
     </fieldset>
     <Check checked={on('conform')} onChange={v=>onSwitch?onSwitch('conform',v):onChange({conform:v})}>{labels.conform}</Check>
     <button type="button" className="wide-button" onClick={()=>setShowNotes(!showNotes)}>{showNotes?'Ocultar lo que aplica el motor':'¿Qué aplica el motor de cada interruptor?'}</button>
     {showNotes&&<>
      <p><small>Activados ahora mismo: {activos.length?activos.map(key=>active[key]??key).join(', '):'ninguno'}.</small></p>
      <ul className="property-notes">{switches.concat(['conform','undersample']).map(key=><li key={key}><strong>{labels[key]}:</strong> {EVENT_SWITCH_NOTE[key]}</li>)}</ul>
     </>}
     </details>
    </section>
   </TabsContent>
   {timing&&<TabsContent value="timing" className="property-tab resource-extra"><p className="resource-hint">Ajusta la duración, los fundidos y los efectos del recurso.</p>{timing}{selectionActions}</TabsContent>}
   {framing&&event.kind!=='audio'&&<TabsContent value="framing" className="property-tab resource-extra"><p className="resource-hint">Cambia el tamaño, la posición y la transparencia en el fotograma.</p>{framing}</TabsContent>}
   {color&&event.kind!=='audio'&&<TabsContent value="color" className="property-tab resource-extra">{color}</TabsContent>}
   <TabsContent value="media" className="property-tab property-media">
    {media?<>
     <section className="property-group">
      <h3>Medios</h3>
      <p className="property-value"><span>Nombre de archivo:</span> <strong>{media.name}</strong></p>
      <label className="field"><span>Nombre de cinta:</span><input value="" placeholder="—" aria-label="Nombre de cinta" disabled/></label>
      <p><small>Los metadatos de cinta no están disponibles para este archivo.</small></p>
     </section>
     <section className="property-group">
      <h3>Código de tiempo</h3>
      <label className="radio"><input type="radio" name="timecode" checked readOnly disabled/>Usar código de tiempo en archivo</label>
      <label className="radio"><input type="radio" name="timecode" checked={false} readOnly disabled/>Usar código de tiempo personalizado:</label>
      <p><small>El proyecto guarda el formato de código de tiempo (Propiedades del proyecto), pero no un desplazamiento por archivo: el desplegable se muestra desactivado en lugar de fingir que se aplica.</small></p>
     </section>
     <section className="property-group">
      <h3>Propiedades de reproducción</h3>
      <dl className="property-list">
       <div><dt>Corriente:</dt><dd>{media.kind==='image'?'Fotograma fijo':media.hasAudio?'Vídeo y audio':'Solo vídeo'}</dd></div>
       <div><dt>Formato:</dt><dd>{media.mime||'—'}</dd></div>
       <div><dt>Atributos:</dt><dd>{media.width&&media.height?`${media.width} × ${media.height} · ${media.kind}`:media.kind}</dd></div>
       <div><dt>Velocidad de fotogramas:</dt><dd>{fps.toFixed(3)} fps (la del proyecto)</dd></div>
       <div><dt>Orden de campos:</dt><dd>Progresivo</dd></div>
       <div><dt>Relación de aspecto del píxel:</dt><dd>1,000 (cuadrado)</dd></div>
       <div><dt>Canal Alfa:</dt><dd>Ninguno</dd></div>
       <div><dt>Color de fondo:</dt><dd>—</dd></div>
       <div><dt>Espacio de color:</dt><dd>sRGB (el que expone el decodificador del navegador)</dd></div>
       <div><dt>Duración:</dt><dd>{seconds(media.duration).toFixed(3)} s</dd></div>
      </dl>
     </section>
    </>:<p className="export-warning" role="alert">Creado dentro de Sinaloa Pro. Este recurso no tiene un archivo original. Puedes editarlo desde «Tiempo y efectos» o «Color y contenido».</p>}
   </TabsContent>
  </Tabs>
  <div className="dialog-actions resource-actions"><span>Los cambios se muestran en la vista previa.</span><button onClick={onCancel}>Cancelar cambios</button><button className="resource-done" onClick={onAccept}>Listo</button></div>
 </div>;
}
