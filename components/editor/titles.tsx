'use client';
import {PresetPreview} from './preset-preview';
// Ventana de Títulos y texto, con los parámetros del plugin «Títulos & Texto de VEGAS» de VEGAS Pro 15:
// texto, fuente, tamaño, negrita y cursiva, color, alineación, punto de anclaje (9), interlineado,
// seguimiento, ancho máximo, fondo, contorno, sombra y animación. El monitor se repinta con la composición
// real, así que lo que se ve es exactamente lo que se exporta.
//
// La ventana se organiza en dos columnas —la vista previa a la izquierda y los ajustes a la derecha, con las
// acciones siempre a la vista— para que **quepa entera en la pantalla**: antes era una sola columna de 1 280 px
// y la mitad de los ajustes quedaba por debajo del borde del diálogo, obligando a desplazarse. La columna de
// ajustes es la única que se desplaza, y solo si la ventana es muy baja.
import { useEffect, useRef, useState } from 'react';
import { compose } from '@/lib/editor/compositor';
import type { MediaLibrary } from '@/lib/editor/media';
import type { Event, Project, TextAnchor } from '@/lib/editor/project';
import { ANCHORS, ANCHOR_LABEL, ANIMATIONS, FONTS, styleOf } from '@/lib/editor/titles';
import { TEXT_PRESETS, TEXT_PRESET_GROUPS, applyTextPreset, describeTextPreset, detectTextPreset } from '@/lib/editor/text-presets';
import { QUICK_POSITIONS, TEXT_POSITIONS, applyTextPosition, describeTextPosition, detectTextPosition, textPositionById } from '@/lib/editor/text-positions';
import { Choice, Field } from './controls';

export type TitlesWindowProps = {
  project: Project;
  library: MediaLibrary;
  event: Event;
  onChange: (patch: Partial<Event>) => void;
  onClose: () => void;
  onApplyPresetTrack?: (id:string) => void;
};

const PREVIEW_WIDTH = 640;
const HEX = /^#[0-9a-f]{6}$/i;

export function TitlesWindow({ project, library, event, onChange, onClose, onApplyPresetTrack }: TitlesWindowProps) {
  const [section,setSection]=useState('text');
  const [search,setSearch]=useState('');
  const [category,setCategory]=useState('all');
  const tabs=[['text','Texto'],['style','Estilo'],['animation','Animación'],['presets','Plantillas']];
  const style = styleOf(event);
  const presetId = detectTextPreset(event);
  const positionId = detectTextPosition(event);
  const height = Math.max(2, Math.round(PREVIEW_WIDTH * project.height / Math.max(1, project.width)));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // A stable instant inside this event, independent of the timeline playhead.
  // Avoid the first/last instant where entrance/exit fades can hide the title.
  const previewTime=event.start+Math.floor(Math.max(0,event.duration-1)/2);
  const dependency = `${event.text}|${event.font}|${event.fontSize}|${event.color}|${event.align}|${event.anchor}|${event.animation}|${event.bold}|${event.italic}|${event.lineSpacing}|${event.tracking}|${event.wrap}|${event.outlineWidth}|${event.outlineColor}|${event.highlightColor}|${JSON.stringify(style.shadow)}|${JSON.stringify(style.background)}|${event.transform.x},${event.transform.y},${event.transform.scale}`;
  useEffect(() => {
    let cancelled = false;
    const paint = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const buffer=document.createElement('canvas');
      buffer.width=canvas.width;buffer.height=canvas.height;
      await compose(buffer, project, library, previewTime,{cancelled:()=>cancelled});
      if (cancelled) return;
      const ctx=canvas.getContext('2d');
      ctx?.clearRect(0,0,canvas.width,canvas.height);
      ctx?.drawImage(buffer,0,0);
    };
    void paint();
    return () => { cancelled = true; };
  }, [project, library, previewTime, event.id, dependency]);

  const patchShadow = (change: Partial<typeof style.shadow>) => onChange({ shadow: { ...style.shadow, ...change } });
  const patchBackground = (change: Partial<typeof style.background>) => onChange({ background: { ...style.background, ...change } });
  const safe = (value: string | undefined, fallback: string) => HEX.test(value ?? '') ? (value as string) : fallback;

  return (
    <div className="titles-window titles-modern">
      <div className="titles-preview-pane">
        <div className="titles-preview-heading"><span>Vista previa</span><small>{project.width} × {project.height}</small></div>
        <div className="titles-preview-stage">
        <canvas ref={canvasRef} className="titles-preview" width={PREVIEW_WIDTH} height={height} aria-label="Vista previa del texto compuesto" />
        </div><p className="titles-hint">Vista del texto seleccionado, independiente de la aguja.</p>
      </div>
      <div className="titles-fields">
        <div className="titles-nav" role="tablist" aria-label="Ajustes de texto">{tabs.map(([id,label],index)=><button key={id} id={`titles-tab-${id}`} type="button" role="tab" aria-selected={section===id} aria-controls={`titles-panel-${id}`} tabIndex={section===id?0:-1} onClick={()=>setSection(id)} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;setSection(tabs[next][0]);document.getElementById(`titles-tab-${tabs[next][0]}`)?.focus();}}>{label}</button>)}</div>
        <div className="titles-panel" role="tabpanel" id={`titles-panel-${section}`} aria-labelledby={`titles-tab-${section}`} key={section}>
        {section==='text'&&<>
        <h3>Escribe tu mensaje</h3>
        <label className="field wide"><span>Texto · Enter para otra línea</span>
          <textarea aria-label="Contenido del texto" placeholder="Escribe tu título o subtítulo…" rows={3} value={event.text} onChange={e => onChange({ text: e.target.value })} />
        </label>
        <div className="form-grid">
          <label className="field">Fuente<Choice label="Fuente" value={event.font} items={FONTS.map(font => [font, font])} onChange={v => onChange({ font: v })} /></label>
          <Field label="Tamaño" value={event.fontSize} min={8} max={500} step={1} onChange={v => onChange({ fontSize: v })} />
          <label className="field">Alineación<Choice label="Alineación" value={event.align} items={[['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']]} onChange={v => onChange({ align: v as Event['align'] })} /></label>
          <label className="field">Color<input type="color" value={safe(event.color, '#ffffff')} aria-label="Color del texto" onChange={e => onChange({ color: e.target.value })} /></label>
          <div className="field"><span>Estilo</span>
            <span className="button-row">
              <button className={style.bold ? 'active' : ''} aria-pressed={style.bold} aria-label="Negrita" onClick={() => onChange({ bold: !style.bold })}>N</button>
              <button className={style.italic ? 'active' : ''} aria-pressed={style.italic} aria-label="Cursiva" onClick={() => onChange({ italic: !style.italic })}>C</button>
            </span>
          </div>
        </div>
        <section>
          <details><summary>Ajustar punto de anclaje</summary>
          <div className="anchor-grid" role="group" aria-label="Punto de anclaje">
            {ANCHORS.map(anchor => (
              <button key={anchor} className={style.anchor === anchor ? 'active' : ''} aria-pressed={style.anchor === anchor} title={ANCHOR_LABEL[anchor]} aria-label={ANCHOR_LABEL[anchor]} onClick={() => onChange({ anchor: anchor as TextAnchor })} />
            ))}
          </div>
          <p><small>El punto de anclaje se coloca en el centro del fotograma más la posición del evento: se ajusta desde Panoramización y recorte.</small></p></details>
        </section>
        {/* Posiciones con nombre: eligen a la vez el anclaje y el desplazamiento, que es lo que deja el texto
            donde dice el nombre. Los cuatro botones son las de un clic y la lista las trae todas. */}
        <section>
          <h4>Posición</h4>
          {/* Los botones de un clic usan la misma fila que se envuelve de las plantillas: la de `.button-row`
              del editor fija 28 px por botón (es la de «N»/«C») y no cabe un rótulo. */}
          <div className="text-preset-buttons" role="group" aria-label="Posiciones del texto">
            {QUICK_POSITIONS.map(id => {
              const position = textPositionById(id);
              if (!position) return null;
              const active = positionId === id;
              return <button
                key={id}
                className={active ? 'active' : ''}
                aria-pressed={active}
                aria-label={position.name}
                title={position.note}
                onClick={() => onChange(applyTextPosition(event, id))}
              >{position.name}</button>;
            })}
          </div>
          <label className="field wide">Todas las posiciones
            <Choice
              label="Posición del texto"
              value={positionId}
              items={[['custom', 'Propia (la que está puesta)'] as [string, string], ...TEXT_POSITIONS.map(position => [position.id, `${position.group} · ${position.name}`] as [string, string])]}
              onChange={v => { if (v !== 'custom') onChange(applyTextPosition(event, v)); }}
            />
          </label>
          <p><small>{describeTextPosition(event)}</small></p>
        </section>
        </>}
        {section==='style'&&<>
        <h3>Personaliza el acabado</h3>
        <div className="form-grid">
          <Field label="Interlineado" value={style.lineSpacing} min={.5} max={4} step={.05} onChange={v => onChange({ lineSpacing: v })} />
          <Field label="Espaciado entre letras (px)" value={style.tracking} min={-50} max={200} step={1} onChange={v => onChange({ tracking: v })} />
          <Field label="Ancho del texto (0–1)" value={style.wrap} min={.1} max={1} step={.05} onChange={v => onChange({ wrap: v })} />
        </div>
        <section>
          <h4>Contorno</h4>
          <div className="form-grid">
            <Field label="Grosor" value={style.outlineWidth} min={0} max={60} step={1} onChange={v => onChange({ outlineWidth: v })} />
            <label className="field">Color<input type="color" value={safe(style.outlineColor, '#000000')} aria-label="Color del contorno" onChange={e => onChange({ outlineColor: e.target.value })} /></label>
          </div>
        </section>
        <section>
          <h4>Sombra</h4>
          <div className="form-grid">
            <label className="field">Activar<Choice label="Activar sombra" value={style.shadow.enabled ? 'si' : 'no'} items={[['no', 'No'], ['si', 'Sí']]} onChange={v => patchShadow({ enabled: v === 'si' })} /></label>
            <label className="field">Color<input type="color" value={safe(style.shadow.color, '#000000')} aria-label="Color de la sombra" onChange={e => patchShadow({ color: e.target.value })} /></label>
            <Field label="Desplazamiento X" value={style.shadow.offsetX} min={-400} max={400} step={1} onChange={v => patchShadow({ offsetX: v })} />
            <Field label="Desplazamiento Y" value={style.shadow.offsetY} min={-400} max={400} step={1} onChange={v => patchShadow({ offsetY: v })} />
            <Field label="Difuminado" value={style.shadow.blur} min={0} max={200} step={1} onChange={v => patchShadow({ blur: v })} />
          </div>
        </section>
        <section>
          <h4>Fondo</h4>
          <div className="form-grid">
            <label className="field">Color<input type="color" value={safe(style.background.color, '#000000')} aria-label="Color del fondo" onChange={e => patchBackground({ color: e.target.value })} /></label>
            <Field label="Opacidad" value={style.background.opacity} min={0} max={1} step={.05} onChange={v => patchBackground({ opacity: v })} />
            <Field label="Margen" value={style.background.padding} min={0} max={400} step={1} onChange={v => patchBackground({ padding: v })} />
          </div>
        </section>
        </>}
        {section==='animation'&&<>
          <h3>Dale movimiento</h3><p className="titles-hint">Elige una animación. Pasa el ratón sobre una muestra para verla.</p>
          <div className="titles-animation-grid">{ANIMATIONS.map(item=><button key={item.value} aria-pressed={style.animation===item.value} onClick={()=>onChange({animation:item.value})}><PresetPreview kind="text-animation" id={item.value}/><span>{item.label}</span></button>)}</div>
        </>}
        {section==='presets'&&<>        <section className="text-presets">
          {onApplyPresetTrack && <button disabled={presetId==='custom'} onClick={()=>onApplyPresetTrack(presetId)}>Aplicar plantilla a todos los textos de esta pista</button>}
          <h4>Un estilo para cada historia</h4>
          <p className="titles-hint">Elige una plantilla. Tu texto se conserva; cambia su apariencia y animación.</p>
          <input className="titles-search" type="search" aria-label="Buscar plantillas" placeholder="Buscar un estilo…" value={search} onChange={e=>setSearch(e.target.value)}/>
          <Choice label="Categoría de plantillas" value={category} onChange={setCategory} items={[["all","Todas las categorías"],...TEXT_PRESET_GROUPS.map(group=>[group,group] as [string,string])]}/>
          {!TEXT_PRESETS.some(p=>(category==='all'||p.group===category)&&p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))&&<p role="status">No hay plantillas con ese nombre.</p>}
          <div className="text-preset-groups" role="group" aria-label="Plantillas de texto y subtítulos">
            {TEXT_PRESET_GROUPS.filter(group=>(category==='all'||category===group)&&TEXT_PRESETS.some(p=>p.group===group&&p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))).map(group => (
              <div className="text-preset-group" key={group}>
                <span className="text-preset-group-name">{group}</span>
                <span className="text-preset-buttons">
                  {TEXT_PRESETS.filter(preset => preset.group === group && preset.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(preset => (
                    <button
                      key={preset.id}
                      className={presetId === preset.id ? 'active' : ''}
                      aria-pressed={presetId === preset.id}
                      aria-label={`Plantilla ${preset.name}`}
                      title={preset.note}
                      onClick={() => onChange(applyTextPreset(event, preset.id))}
                    ><PresetPreview kind="text" id={preset.id}/><span>{preset.name}</span></button>
                  ))}
                </span>
              </div>
            ))}
          </div>
          <p><small>{describeTextPreset(event)}</small></p>
        </section>
</>}
        </div>
      </div>
      <div className="dialog-actions titles-actions">
        <button onClick={() => onChange({ bold: false, italic: false, lineSpacing: undefined, tracking: undefined, wrap: undefined, outlineWidth: undefined, outlineColor: undefined, shadow: undefined, background: undefined, anchor: undefined, animation: undefined })}>Restablecer estilo</button>
        <span className="titles-save-note">Cambios aplicados al proyecto</span><button className="titles-done" onClick={onClose}>Listo</button>
      </div>
    </div>
  );
}
