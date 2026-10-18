'use client';
// Consola de mezcla (el «Mezclador» de VEGAS): una tira por bus y por pista de audio, más el maestro.
// El orden de la señal es pista → tomas de la pista → bus → tomas del bus → maestro, y el solo de una pista
// o de un bus deja fuera a lo demás. Cada tira lleva su rack de tomas de efectos de audio.
import { useState } from 'react';
import type { AudioBus, AudioEffect, AudioEffectKind, Project, Track } from '@/lib/editor/project';
import { newBus } from '@/lib/editor/project';
import { AUDIO_EFFECT_KINDS, AUDIO_EFFECT_LABEL, AUDIO_EFFECT_NOTE, AUDIO_EFFECT_PARAMS, defaultAudioEffect, describeAudioEffect } from '@/lib/editor/audio-effects';
import { Field, Range } from './controls';

export type MixerProps = {
  project: Project;
  onTrack: (trackId: string, change: Partial<Track>) => void;
  onBus: (busId: string, change: Partial<AudioBus>) => void;
  onAddBus: () => void;
  onRemoveBus: (busId: string) => void;
  onMaster: (change: { gain?: number; pan?: number }) => void;
  onClose: () => void;
};

const percent = (value: number) => `${Math.round(value * 100)} %`;

// Un campo por parámetro de la toma, con su etiqueta y su rango. Solo se muestran los que usa el efecto.
const PARAM_FIELD: Record<string, { label: string; min: number; max: number; step: number; unit?: string }> = {
  amount: { label: 'Cantidad', min: 0, max: 1, step: .01 },
  threshold: { label: 'Umbral', min: -60, max: 0, step: .5, unit: 'dB' },
  ratio: { label: 'Relación', min: 1, max: 20, step: .5, unit: ':1' },
  attack: { label: 'Ataque', min: 0, max: 200, step: 1, unit: 'ms' },
  release: { label: 'Relajación', min: 0, max: 2000, step: 5, unit: 'ms' },
  makeup: { label: 'Salida', min: 0, max: 24, step: .5, unit: 'dB' },
  time: { label: 'Tiempo', min: 20, max: 2000, step: 5, unit: 'ms' },
  feedback: { label: 'Realimentación', min: 0, max: .95, step: .01 },
  damping: { label: 'Amortiguación', min: 0, max: 1, step: .01 },
  low: { label: 'Graves', min: -24, max: 24, step: .5, unit: 'dB' },
  mid: { label: 'Medios', min: -24, max: 24, step: .5, unit: 'dB' },
  high: { label: 'Agudos', min: -24, max: 24, step: .5, unit: 'dB' },
};

// Rack de tomas: se añade, se ordena, se apaga y se quita. El cambio lo aplica quien lo use (el editor),
// que es quien guarda el historial.
function InsertRack({ inserts, name, onChange }: { inserts: AudioEffect[]; name: string; onChange: (next: AudioEffect[]) => void }) {
  const [kind, setKind] = useState<AudioEffectKind>('eq');
  const edit = (id: string, patch: Partial<AudioEffect>) => onChange(inserts.map(effect => effect.id === id ? { ...effect, ...patch } : effect));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= inserts.length) return;
    const next = [...inserts];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  return (
    <details className="insert-rack">
      <summary>{inserts.length ? `Tomas (${inserts.length})` : 'Tomas'}</summary>
      <div className="button-row">
        <select aria-label={`Toma nueva para ${name}`} value={kind} onChange={event => setKind(event.target.value as AudioEffectKind)}>
          {AUDIO_EFFECT_KINDS.map(candidate => <option key={candidate} value={candidate}>{AUDIO_EFFECT_LABEL[candidate]}</option>)}
        </select>
        <button aria-label={`Añadir toma a ${name}`} onClick={() => onChange([...inserts, defaultAudioEffect(kind, `fx-${kind}-${Date.now().toString(36)}`)])}>Añadir</button>
      </div>
      {!inserts.length && <p><small>{AUDIO_EFFECT_NOTE[kind]}</small></p>}
      {inserts.map((effect, index) => (
        <article key={effect.id} className={`insert-card ${effect.enabled ? '' : 'off'}`}>
          <header>
            <strong>{index + 1}. {AUDIO_EFFECT_LABEL[effect.kind]}</strong>
            <span className="button-row">
              <button aria-label={`Apagar ${AUDIO_EFFECT_LABEL[effect.kind]} de ${name}`} className={effect.enabled ? 'active' : ''} aria-pressed={effect.enabled} onClick={() => edit(effect.id, { enabled: !effect.enabled })}>⏻</button>
              <button aria-label={`Subir ${AUDIO_EFFECT_LABEL[effect.kind]} de ${name}`} onClick={() => move(index, -1)} disabled={index === 0}>↑</button>
              <button aria-label={`Bajar ${AUDIO_EFFECT_LABEL[effect.kind]} de ${name}`} onClick={() => move(index, 1)} disabled={index === inserts.length - 1}>↓</button>
              <button aria-label={`Quitar ${AUDIO_EFFECT_LABEL[effect.kind]} de ${name}`} onClick={() => onChange(inserts.filter(candidate => candidate.id !== effect.id))}>✕</button>
            </span>
          </header>
          <small>{describeAudioEffect(effect)}</small>
          <div className="insert-params">
            {AUDIO_EFFECT_PARAMS[effect.kind].map(key => {
              const field = PARAM_FIELD[key as string];
              if (!field) return null;
              return <Field key={String(key)} label={`${field.label}${field.unit ? ` (${field.unit})` : ''} de ${AUDIO_EFFECT_LABEL[effect.kind]} en ${name}`} value={Number(effect[key] ?? 0)} min={field.min} max={field.max} step={field.step} onChange={value => edit(effect.id, { [key]: value } as Partial<AudioEffect>)} />;
            })}
          </div>
        </article>
      ))}
    </details>
  );
}

export function Mixer({ project, onTrack, onBus, onAddBus, onRemoveBus, onMaster, onClose }: MixerProps) {
  const buses = project.buses ?? [];
  const audioTracks = project.tracks.filter(track => track.kind === 'audio');
  const master = project.master ?? { gain: 1, pan: 0 };
  const insertCount = audioTracks.reduce((total, track) => total + (track.inserts?.length ?? 0), 0) + buses.reduce((total, bus) => total + (bus.inserts?.length ?? 0), 0);
  return (
    <div className="mixer">
      <p className="export-plan">{audioTracks.length} pista(s) de audio, {buses.length} bus(es) y {insertCount} toma(s) de efectos. El solo de una pista o de un bus silencia lo demás; el maestro cierra la cadena antes del limitador.</p>
      <div className="mixer-console">
        <section className="mixer-strip master">
          <header>Maestro</header>
          <Range label="Nivel del maestro" value={master.gain} min={0} max={2} step={.01} onChange={v => onMaster({ gain: v })} />
          <small>{percent(master.gain)}</small>
          <Range label="Panorámica del maestro" value={master.pan} min={-1} max={1} step={.05} onChange={v => onMaster({ pan: v })} />
          <small>{master.pan === 0 ? 'centro' : master.pan < 0 ? `izq ${percent(-master.pan)}` : `der ${percent(master.pan)}`}</small>
          <button onClick={onAddBus}>Añadir bus</button>
        </section>
        {buses.map(bus => (
          <section key={bus.id} className={`mixer-strip bus ${bus.mute ? 'muted' : ''} ${bus.solo ? 'soloed' : ''}`}>
            <header>{bus.name}</header>
            <Range label={`Nivel de ${bus.name}`} value={bus.gain} min={0} max={2} step={.01} onChange={v => onBus(bus.id, { gain: v })} />
            <small>{percent(bus.gain)}</small>
            <Range label={`Panorámica de ${bus.name}`} value={bus.pan} min={-1} max={1} step={.05} onChange={v => onBus(bus.id, { pan: v })} />
            <small>{bus.pan === 0 ? 'centro' : bus.pan < 0 ? `izq ${percent(-bus.pan)}` : `der ${percent(bus.pan)}`}</small>
            <div className="button-row">
              <button className={bus.mute ? 'active' : ''} aria-pressed={bus.mute} aria-label={`Silenciar ${bus.name}`} onClick={() => onBus(bus.id, { mute: !bus.mute })}>M</button>
              <button className={bus.solo ? 'active' : ''} aria-pressed={bus.solo} aria-label={`Solo de ${bus.name}`} onClick={() => onBus(bus.id, { solo: !bus.solo })}>S</button>
              <button aria-label={`Quitar ${bus.name}`} onClick={() => onRemoveBus(bus.id)}>✕</button>
            </div>
            <InsertRack inserts={bus.inserts ?? []} name={bus.name} onChange={inserts => onBus(bus.id, { inserts })} />
          </section>
        ))}
        {audioTracks.map(track => (
          <section key={track.id} className={`mixer-strip track ${track.mute ? 'muted' : ''} ${track.solo ? 'soloed' : ''}`}>
            <header>{track.name}</header>
            <Range label={`Nivel de ${track.name}`} value={track.gain} min={0} max={2} step={.01} onChange={v => onTrack(track.id, { gain: v })} />
            <small>{percent(track.gain)}</small>
            <Range label={`Panorámica de ${track.name}`} value={track.pan} min={-1} max={1} step={.05} onChange={v => onTrack(track.id, { pan: v })} />
            <small>{track.pan === 0 ? 'centro' : track.pan < 0 ? `izq ${percent(-track.pan)}` : `der ${percent(track.pan)}`}</small>
            <div className="button-row">
              <button className={track.mute ? 'active' : ''} aria-pressed={track.mute} aria-label={`Silenciar ${track.name}`} onClick={() => onTrack(track.id, { mute: !track.mute })}>M</button>
              <button className={track.solo ? 'active' : ''} aria-pressed={track.solo} aria-label={`Solo de ${track.name}`} onClick={() => onTrack(track.id, { solo: !track.solo })}>S</button>
            </div>
            <div className="field"><span>Bus</span>
              <select aria-label={`Bus de ${track.name}`} value={track.busId ?? ''} onChange={e => onTrack(track.id, { busId: e.target.value || undefined })}>
                <option value="">Maestro</option>
                {buses.map(bus => <option key={bus.id} value={bus.id}>{bus.name}</option>)}
              </select>
            </div>
            <InsertRack inserts={track.inserts ?? []} name={track.name} onChange={inserts => onTrack(track.id, { inserts })} />
          </section>
        ))}
      </div>
      <div className="dialog-actions"><button onClick={onClose}>Cerrar</button></div>
      <p><small>Las tomas se procesan en orden: en la pista, sobre lo que suman sus eventos y antes del nivel; en el bus, sobre lo que le llega antes de su nivel. Las envolventes de volumen y panorámica se dibujan sobre la pista: elige arriba qué envolvente se muestra, haz clic en la línea para añadir un punto, arrástralo para moverlo y usa el clic derecho para quitarlo.</small></p>
    </div>
  );
}
export const addBus = (project: Project): AudioBus[] => [...(project.buses ?? []), newBus(`Bus ${String.fromCharCode(65 + (project.buses?.length ?? 0))}`)];
