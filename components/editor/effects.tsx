'use client';
import {useState,useRef,useEffect} from 'react';
import {compose} from '@/lib/editor/compositor';
import type {MediaLibrary} from '@/lib/editor/media';
import type {Project} from '@/lib/editor/project';
import {PresetPreview} from './preset-preview';
// Pila de efectos de vídeo de un evento: catálogo para añadir, orden, encendido/apagado y parámetros.
// Los efectos se aplican en este orden sobre el evento (sobre sus propios píxeles, en su capa) y el monitor
// del editor muestra el resultado al instante, igual que la exportación.
import type { Event, VideoEffect, VideoEffectKind } from '@/lib/editor/project';
import { uid } from '@/lib/editor/project';
import { EFFECT_DESCRIPTION, EFFECT_KINDS, EFFECT_LABEL, EFFECT_LOOKS, EFFECT_PARAMS, activeEffects, defaultEffect, type EffectLook } from '@/lib/editor/effects';
import { Choice, Field } from './controls';

export type EffectsWindowProps = { project?:Project;library?:MediaLibrary;time?:number;scope?: 'event'|'track'; event: Event; onChange: (patch: Partial<Event>) => void; onClose: () => void };

const AMOUNT_LABEL: Partial<Record<VideoEffectKind, string>> = {
  blur: 'Radio (px)', blackAndWhite: 'Cantidad de fusión', sepia: 'Cantidad de fusión',
  invert: 'Cantidad de inversión', chromaKey: 'Umbral inferior', vignette: 'Intensidad', glow: 'Cantidad',
  chromaticAberration: 'Separación de color', filmGrain: 'Intensidad', posterize: 'Mezcla', tealOrange: 'Intensidad',
  bleachBypass: 'Intensidad', vhs: 'Intensidad', lightLeak: 'Intensidad', halation: 'Intensidad',
};
const SIZE_LABEL: Partial<Record<VideoEffectKind, string>> = {
  pixelate: 'Tamaño del bloque (px)', border: 'Grosor (px)', glow: 'Radio (px)',
  chromaticAberration: 'Desplazamiento (px)', filmGrain: 'Tamaño del grano', posterize: 'Niveles',
  lightLeak: 'Ángulo (°)', halation: 'Radio (px)',
};
const HEX = /^#[0-9a-f]{6}$/i;

export function EffectsWindow({ scope='event', event, onChange, onClose,project,library,time=0 }: EffectsWindowProps) {
  const effects = event.effects ?? [];
  const [view,setView]=useState(effects.length?'adjust':'catalog');
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState(effects[0]?.id??'');
  const [before,setBefore]=useState(false);
  const selectedId=effects.some(fx=>fx.id===selected)?selected:effects[0]?.id;
  const preview=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    if(!project||!library||!preview.current)return;
    let cancelled=false;
    const canvas=preview.current,buffer=document.createElement('canvas');buffer.width=480;buffer.height=Math.max(2,Math.round(480*project.height/project.width));
    const sample=scope==='track'?time:event.start+Math.floor(Math.max(0,event.duration-1)/2);
    const scene=before?{...project,events:scope==='event'?project.events.map(e=>e.id===event.id?{...e,effects:[]}:e):project.events,tracks:scope==='track'?project.tracks.map(t=>t.id===event.trackId?{...t,effects:[]}:t):project.tracks}:project;
    void compose(buffer,scene,library,sample,{cancelled:()=>cancelled}).then(()=>{if(!cancelled){canvas.width=buffer.width;canvas.height=buffer.height;canvas.getContext('2d')?.drawImage(buffer,0,0);}}).catch(()=>{});
    return()=>{cancelled=true;};
  },[project,library,time,event.id,event.start,event.duration,event.trackId,scope,before]);
  const update = (id: string, change: Partial<VideoEffect>) => onChange({ effects: effects.map(effect => effect.id === id ? { ...effect, ...change } : effect) });
  const add = (kind: VideoEffectKind) => {if(effects.length>=24)return;const effect=defaultEffect(kind,uid());onChange({effects:[...effects,effect]});setSelected(effect.id);setView('adjust');setBefore(false);};
  // Un look es una pila preparada: se añade entera y luego se ajusta como cualquier otro efecto.
  const addLook = (look: EffectLook) => {
    if(event.kind==='audio'||effects.length>=24)return;
    const room=24-effects.length;
    const added:VideoEffect[]=look.effects.slice(0,room).map(part=>({...defaultEffect(part.kind,uid()),...part}));
    if(!added.length)return;
    onChange({effects:[...effects,...added]});
    setSelected(added[0].id);setView('adjust');setBefore(false);
  };
  const remove = (id: string) => onChange({ effects: effects.filter(effect => effect.id !== id) });
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= effects.length) return;
    const next = [...effects];
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ effects: next });
  };
  const safe = (value: string) => HEX.test(value) ? value : '#000000';

  return (
    <div className="effects-window effects-modern">
      <div className="fx-heading"><strong>{event.name}</strong><span>{activeEffects(effects).length} activos / {effects.length} efectos</span></div>
      <div className="fx-workspace">
      <aside className="fx-preview-pane">
        <div className="fx-preview-label"><span>{before?'Antes · sin esta pila':'Después · efectos aplicados'}</span><button aria-pressed={before} onClick={()=>setBefore(!before)} disabled={!project||!effects.length}>{before?'Ver después':'Ver antes'}</button></div>
        <div className="fx-preview-stage"><canvas ref={preview} aria-label="Vista previa de los efectos"/></div>
        <p>Compara el resultado sin modificar tus efectos.</p>
        <h3>Efectos aplicados</h3>
        <div className="fx-stack">{effects.map((fx,index)=><button key={fx.id} className={selectedId===fx.id?'active':''} aria-pressed={selectedId===fx.id} onClick={()=>{setSelected(fx.id);setView('adjust');}}><span>{index+1}</span><strong>{EFFECT_LABEL[fx.kind]}</strong><small>{fx.enabled?'Activo':'Desactivado'}</small></button>)}{!effects.length&&<p>Añade tu primer efecto desde la biblioteca.</p>}</div>
        <small>Se aplican de arriba abajo. Cambia el orden con las flechas.</small>
      </aside>
      <div className="fx-inspector">
      <div className="fx-navigation"><button aria-pressed={view==='adjust'} onClick={()=>setView('adjust')}>Ajustar efectos</button><button aria-pressed={view==='catalog'} onClick={()=>setView('catalog')}>＋ Añadir efecto</button></div>
      <div className="fx-scroll">
      {view==='catalog'&&<><h3>Biblioteca de efectos</h3><input className="fx-search" type="search" aria-label="Buscar efectos" placeholder="Buscar: desenfoque, color, espejo…" value={query} onChange={e=>setQuery(e.target.value)}/>
      {effects.length>=24&&<p role="status">Máximo de 24 efectos por recurso.</p>}
      <h3>Looks de un clic</h3>
      <p className="fx-looks-hint">Añaden una pila completa de efectos de tendencia; después puedes ajustar, reordenar o quitar cada uno.</p>
      <div className="fx-looks" role="group" aria-label="Looks premium">
        {EFFECT_LOOKS.map(look => (
          <button key={look.id} disabled={event.kind === 'audio' || effects.length >= 24} title={look.note} onClick={() => addLook(look)}>
            <PresetPreview kind="look" id={look.id} />
            <span><strong>{look.label}</strong><small>{look.note}</small></span>
          </button>
        ))}
      </div>
      <div className="preset-list effects-catalog">
        {EFFECT_KINDS.filter(kind=>(EFFECT_LABEL[kind]+' '+EFFECT_DESCRIPTION[kind]).toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(kind => (
          <button key={kind} disabled={event.kind === 'audio'||effects.length>=24} title={EFFECT_DESCRIPTION[kind]} onClick={() => add(kind)}><PresetPreview kind="effect" id={kind}/><span>{EFFECT_LABEL[kind]}</span></button>
        ))}
      </div>
      {!EFFECT_KINDS.some(kind=>(EFFECT_LABEL[kind]+' '+EFFECT_DESCRIPTION[kind]).toLocaleLowerCase().includes(query.toLocaleLowerCase()))&&<p role="status">No se encontraron efectos.</p>}</>}
      {event.kind === 'audio' && <p className="export-warning" role="alert">Los efectos de vídeo no se aplican a los eventos de audio.</p>}
      {view==='adjust'&&!effects.length&&<div className="fx-empty"><h3>Empieza con un efecto</h3><p>Explora las muestras y añade el acabado que buscas.</p><button onClick={()=>setView('catalog')}>Explorar efectos</button></div>}
      {view==='adjust'&&effects.map((effect, index) => selectedId===effect.id&&(
        <section key={effect.id} className="effect-card">
          <header>
            <strong>{EFFECT_LABEL[effect.kind]}</strong>
            <span className="button-row">
              <button aria-label={`Subir ${EFFECT_LABEL[effect.kind]}`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
              <button aria-label={`Bajar ${EFFECT_LABEL[effect.kind]}`} disabled={index === effects.length - 1} onClick={() => move(index, 1)}>↓</button>
              <button aria-label={`Quitar ${EFFECT_LABEL[effect.kind]}`} onClick={() => remove(effect.id)}>✕</button>
            </span>
          </header>
          <p><small>{EFFECT_DESCRIPTION[effect.kind]}</small></p>
          <div className="fx-quick-actions"><button onClick={()=>update(effect.id,defaultEffect(effect.kind,effect.id))}>Restablecer</button><button disabled={effects.length>=24} onClick={()=>{const copy={...effect,id:uid()};onChange({effects:[...effects.slice(0,index+1),copy,...effects.slice(index+1)]});setSelected(copy.id);}}>Duplicar efecto</button></div>
          <div className="form-grid">
            <label className="field">Activar efecto<Choice label={`Aplicado: ${EFFECT_LABEL[effect.kind]}`} value={effect.enabled ? 'si' : 'no'} items={[['si', 'Sí'], ['no', 'No']]} onChange={v => update(effect.id, { enabled: v === 'si' })} /></label>
            {EFFECT_PARAMS[effect.kind].includes('amount') && (
<div className="fx-parameter"><Field label={AMOUNT_LABEL[effect.kind] ?? 'Cantidad'} value={effect.amount} min={0} max={effect.kind === 'blur' ? 60 : 1} step={effect.kind === 'blur' ? 1 : .05} onChange={v => update(effect.id, { amount: v })} /><input type="range" aria-label="Ajustar intensidad" min={0} max={effect.kind === 'blur' ? 60 : 1} step={effect.kind === 'blur' ? 1 : .05} value={effect.amount} onChange={e=>update(effect.id,{amount:Number(e.target.value)})}/></div>
            )}
            {EFFECT_PARAMS[effect.kind].includes('size') && (
<div className="fx-parameter"><Field label={SIZE_LABEL[effect.kind] ?? 'Tamaño (px)'} value={effect.size} min={effect.kind === 'pixelate' ? 2 : 1} max={200} step={1} onChange={v => update(effect.id, { size: v })} /><input type="range" aria-label="Ajustar tamaño" min={effect.kind === 'pixelate' ? 2 : 1} max={200} step={1} value={effect.size} onChange={e=>update(effect.id,{size:Number(e.target.value)})}/></div>
            )}
            {EFFECT_PARAMS[effect.kind].includes('softness') && (
<div className="fx-parameter"><Field label="Suavidad del borde" value={effect.softness} min={0} max={1} step={.05} onChange={v => update(effect.id, { softness: v })} /><input type="range" aria-label="Ajustar suavidad" min={0} max={1} step={.05} value={effect.softness} onChange={e=>update(effect.id,{softness:Number(e.target.value)})}/></div>
            )}
            {EFFECT_PARAMS[effect.kind].includes('color') && (
              <label className="field">Color<input type="color" aria-label={`Color: ${EFFECT_LABEL[effect.kind]}`} value={safe(effect.color)} onChange={e => update(effect.id, { color: e.target.value })} /></label>
            )}
            {EFFECT_PARAMS[effect.kind].includes('horizontal') && (
              <label className="field">Eje horizontal<Choice label="Espejo horizontal" value={effect.horizontal ? 'si' : 'no'} items={[['si', 'Sí'], ['no', 'No']]} onChange={v => update(effect.id, { horizontal: v === 'si' })} /></label>
            )}
            {EFFECT_PARAMS[effect.kind].includes('vertical') && (
              <label className="field">Eje vertical<Choice label="Espejo vertical" value={effect.vertical ? 'si' : 'no'} items={[['si', 'Sí'], ['no', 'No']]} onChange={v => update(effect.id, { vertical: v === 'si' })} /></label>
            )}
          </div>
        </section>
      ))}
      </div></div></div>
      <div className="dialog-actions fx-actions">
        <button onClick={() => onChange({ effects: [] })} disabled={!effects.length}>Quitar todos</button>
        <span>Los cambios se aplican al proyecto.</span><button className="fx-done" onClick={onClose}>Listo</button>
      </div>

    </div>
  );
}
