'use client';
import {PresetPreview} from './preset-preview';
// Pila de efectos de vídeo de un evento: catálogo para añadir, orden, encendido/apagado y parámetros.
// Los efectos se aplican en este orden sobre el evento (sobre sus propios píxeles, en su capa) y el monitor
// del editor muestra el resultado al instante, igual que la exportación.
import type { Event, VideoEffect, VideoEffectKind } from '@/lib/editor/project';
import { uid } from '@/lib/editor/project';
import { EFFECT_DESCRIPTION, EFFECT_KINDS, EFFECT_LABEL, EFFECT_PARAMS, activeEffects, defaultEffect } from '@/lib/editor/effects';
import { Choice, Field } from './controls';

export type EffectsWindowProps = { scope?: 'event'|'track'; event: Event; onChange: (patch: Partial<Event>) => void; onClose: () => void };

const AMOUNT_LABEL: Partial<Record<VideoEffectKind, string>> = {
  blur: 'Radio (px)', blackAndWhite: 'Cantidad de fusión', sepia: 'Cantidad de fusión',
  invert: 'Cantidad de inversión', chromaKey: 'Umbral inferior', vignette: 'Intensidad', glow: 'Cantidad',
};
const SIZE_LABEL: Partial<Record<VideoEffectKind, string>> = { pixelate: 'Tamaño del bloque (px)', border: 'Grosor (px)', glow: 'Radio (px)' };
const HEX = /^#[0-9a-f]{6}$/i;

export function EffectsWindow({ scope='event', event, onChange, onClose }: EffectsWindowProps) {
  const effects = event.effects ?? [];
  const update = (id: string, change: Partial<VideoEffect>) => onChange({ effects: effects.map(effect => effect.id === id ? { ...effect, ...change } : effect) });
  const add = (kind: VideoEffectKind) => onChange({ effects: [...effects, defaultEffect(kind, uid())] });
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
    <div className="effects-window">
      <p className="export-plan">{effects.length
        ? `${activeEffects(effects).length} de ${effects.length} efecto(s) activos. Se aplican en este orden sobre ${scope==='track'?'la pista y su grupo':'el evento'}, antes de mezclarlo con lo que hay debajo.`
        : `«${event.name}» no tiene efectos. Añade uno desde el catálogo.`}</p>
      <div className="preset-list effects-catalog">
        {EFFECT_KINDS.map(kind => (
          <button key={kind} disabled={event.kind === 'audio'} title={EFFECT_DESCRIPTION[kind]} onClick={() => add(kind)}><PresetPreview kind="effect" id={kind}/><span>{EFFECT_LABEL[kind]}</span></button>
        ))}
      </div>
      {event.kind === 'audio' && <p className="export-warning" role="alert">Los efectos de vídeo no se aplican a los eventos de audio.</p>}
      {effects.map((effect, index) => (
        <section key={effect.id} className="effect-card">
          <header>
            <strong>{index + 1}. {EFFECT_LABEL[effect.kind]}</strong>
            <span className="button-row">
              <button aria-label={`Subir ${EFFECT_LABEL[effect.kind]}`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
              <button aria-label={`Bajar ${EFFECT_LABEL[effect.kind]}`} disabled={index === effects.length - 1} onClick={() => move(index, 1)}>↓</button>
              <button aria-label={`Quitar ${EFFECT_LABEL[effect.kind]}`} onClick={() => remove(effect.id)}>✕</button>
            </span>
          </header>
          <p><small>{EFFECT_DESCRIPTION[effect.kind]}</small></p>
          <div className="form-grid">
            <label className="field">Aplicado<Choice label={`Aplicado: ${EFFECT_LABEL[effect.kind]}`} value={effect.enabled ? 'si' : 'no'} items={[['si', 'Sí'], ['no', 'No']]} onChange={v => update(effect.id, { enabled: v === 'si' })} /></label>
            {EFFECT_PARAMS[effect.kind].includes('amount') && (
              <Field label={AMOUNT_LABEL[effect.kind] ?? 'Cantidad'} value={effect.amount} min={0} max={effect.kind === 'blur' ? 60 : 1} step={effect.kind === 'blur' ? 1 : .05} onChange={v => update(effect.id, { amount: v })} />
            )}
            {EFFECT_PARAMS[effect.kind].includes('size') && (
              <Field label={SIZE_LABEL[effect.kind] ?? 'Tamaño (px)'} value={effect.size} min={effect.kind === 'pixelate' ? 2 : 1} max={200} step={1} onChange={v => update(effect.id, { size: v })} />
            )}
            {EFFECT_PARAMS[effect.kind].includes('softness') && (
              <Field label="Suavidad del borde" value={effect.softness} min={0} max={1} step={.05} onChange={v => update(effect.id, { softness: v })} />
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
      <div className="dialog-actions">
        <button onClick={() => onChange({ effects: [] })} disabled={!effects.length}>Quitar todos</button>
        <button onClick={onClose}>Cerrar</button>
      </div>
      <p><small>El desenfoque y el centelleo usan los filtros del lienzo del navegador; el resto se calcula píxel a píxel. La clave cromática y el pixelado cuestan más en la exportación a resolución completa: si el render se hace lento, bájalos de orden o usa la vista previa a la mitad.</small></p>
    </div>
  );
}
