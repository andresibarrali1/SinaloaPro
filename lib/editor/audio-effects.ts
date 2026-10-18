// Tomas de efectos de audio por pista y por bus, con los nombres del catálogo de VEGAS Pro 15 y una
// implementación propia (aquí no se cargan VST ni OFX: el motor es el mismo que usa la vista previa y la
// exportación, así que lo que se oye es lo que se graba).
//
// Las tomas se procesan sobre la señal de la pista (o del bus) ya sumada y **antes** del nivel, la
// panorámica y el envío al bus siguiente, que es el orden de VEGAS: evento → pista → tomas → bus → tomas
// → maestro → limitador.
//
// El estado de cada toma (los filtros, el detector de envolvente, la línea de retardo) vive fuera de la
// función de proceso porque el audio se mezcla por bloques: sin memoria, el compresor reiniciaría en cada
// bloque y el retardo cortaría el eco. `createInsertChain` devuelve ese estado y `processInserts` lo usa.
import type { AudioEffect, AudioEffectKind } from './project';

export const AUDIO_EFFECT_KINDS: AudioEffectKind[] = ['eq', 'compressor', 'limiter', 'gate', 'distortion', 'delay', 'reverb', 'phone'];
export const AUDIO_EFFECT_LABEL: Record<AudioEffectKind, string> = {
  eq: 'Ecualizador de 3 bandas', compressor: 'Compresor', limiter: 'Limitador', gate: 'Puerta de ruido',
  distortion: 'Distorsión', delay: 'Retardo', reverb: 'Reverberación', phone: 'Teléfono / radio',
};
export const AUDIO_EFFECT_NOTE: Record<AudioEffectKind, string> = {
  eq: 'Graves y agudos en estantería y un filtro de pico en los medios, en decibelios.',
  compressor: 'Baja lo que pasa del umbral y compensa con ganancia de salida. La relación es cuántos dB de entrada hacen falta por cada dB de salida.',
  limiter: 'Compresor de relación infinita y ataque inmediato: nada pasa del techo. Es el limitador de la cadena.',
  gate: 'Silencia lo que queda por debajo del umbral y lo vuelve a abrir cuando la señal sube.',
  distortion: 'Saturación suave. Con la cantidad a cero no toca la señal.',
  delay: 'Eco con tiempo, realimentación y mezcla; el canal izquierdo y el derecho usan tiempos distintos para dar anchura.',
  reverb: 'Reverberación de sala con tamaño, amortiguación y mezcla.',
  phone: 'Deja la señal con el ancho de banda de un teléfono y satura un poco, como un efecto de radio.',
};
// Parámetros que usa cada toma, para que la interfaz muestre solo los que sirven.
export const AUDIO_EFFECT_PARAMS: Record<AudioEffectKind, (keyof AudioEffect)[]> = {
  eq: ['low', 'mid', 'high'],
  compressor: ['threshold', 'ratio', 'attack', 'release', 'makeup'],
  limiter: ['threshold', 'release'],
  gate: ['threshold', 'release'],
  distortion: ['amount', 'makeup'],
  delay: ['time', 'feedback', 'amount'],
  reverb: ['time', 'damping', 'amount'],
  phone: ['amount'],
};

const clamp = (value: number, min: number, max: number) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
const dbToGain = (db: number) => Math.pow(10, db / 20);
const gainToDb = (gain: number) => 20 * Math.log10(Math.max(1e-12, gain));

export function defaultAudioEffect(kind: AudioEffectKind, id: string): AudioEffect {
  const base: AudioEffect = {
    id, kind, enabled: true, amount: 0, threshold: -18, ratio: 4, attack: 10, release: 150,
    makeup: 0, time: 250, feedback: .3, damping: .4, low: 0, mid: 0, high: 0,
  };
  switch (kind) {
    case 'eq': return { ...base, low: 0, mid: 0, high: 0 };
    case 'compressor': return { ...base, threshold: -18, ratio: 4, attack: 10, release: 150, makeup: 3 };
    case 'limiter': return { ...base, threshold: -1, release: 80 };
    case 'gate': return { ...base, threshold: -45, release: 200 };
    case 'distortion': return { ...base, amount: .3, makeup: 0 };
    case 'delay': return { ...base, time: 250, feedback: .3, amount: .25 };
    case 'reverb': return { ...base, time: 900, damping: .4, amount: .25 };
    case 'phone': return { ...base, amount: .8 };
  }
}
export function normalizeAudioEffect(effect: Partial<AudioEffect> & { kind: AudioEffectKind }, id?: string): AudioEffect {
  const base = defaultAudioEffect(effect.kind, id ?? effect.id ?? `fx-${effect.kind}`);
  const numeric = (value: number | undefined, fallback: number, min: number, max: number) => value === undefined || !Number.isFinite(value) ? fallback : clamp(value, min, max);
  return {
    ...base,
    id: id ?? effect.id ?? base.id,
    enabled: effect.enabled !== false,
    amount: numeric(effect.amount, base.amount, 0, 1),
    threshold: numeric(effect.threshold, base.threshold, -60, 0),
    ratio: numeric(effect.ratio, base.ratio, 1, 20),
    attack: numeric(effect.attack, base.attack, 0, 200),
    release: numeric(effect.release, base.release, 0, 2000),
    makeup: numeric(effect.makeup, base.makeup, 0, 24),
    time: numeric(effect.time, base.time, 20, 2000),
    feedback: numeric(effect.feedback, base.feedback, 0, .95),
    damping: numeric(effect.damping, base.damping, 0, 1),
    low: numeric(effect.low, base.low, -24, 24),
    mid: numeric(effect.mid, base.mid, -24, 24),
    high: numeric(effect.high, base.high, -24, 24),
  };
}
// Una descripción corta de lo que hace la toma, para la ficha del mezclador.
export function describeAudioEffect(effect: AudioEffect): string {
  switch (effect.kind) {
    case 'eq': return `graves ${effect.low > 0 ? '+' : ''}${effect.low.toFixed(1)} dB · medios ${effect.mid > 0 ? '+' : ''}${effect.mid.toFixed(1)} dB · agudos ${effect.high > 0 ? '+' : ''}${effect.high.toFixed(1)} dB`;
    case 'compressor': return `umbral ${effect.threshold.toFixed(1)} dB · relación ${effect.ratio.toFixed(1)}:1 · ${effect.attack.toFixed(0)}/${effect.release.toFixed(0)} ms · salida +${effect.makeup.toFixed(1)} dB`;
    case 'limiter': return `techo ${effect.threshold.toFixed(1)} dB · relajación ${effect.release.toFixed(0)} ms`;
    case 'gate': return `umbral ${effect.threshold.toFixed(1)} dB · relajación ${effect.release.toFixed(0)} ms`;
    case 'distortion': return `cantidad ${Math.round(effect.amount * 100)} %${effect.makeup ? ` · salida +${effect.makeup.toFixed(1)} dB` : ''}`;
    case 'delay': return `tiempo ${effect.time.toFixed(0)} ms · realimentación ${Math.round(effect.feedback * 100)} % · mezcla ${Math.round(effect.amount * 100)} %`;
    case 'reverb': return `tamaño ${effect.time.toFixed(0)} ms · amortiguación ${Math.round(effect.damping * 100)} % · mezcla ${Math.round(effect.amount * 100)} %`;
    case 'phone': return `cantidad ${Math.round(effect.amount * 100)} %`;
  }
}
// Tomas del catálogo que **no** se implementan, y por qué.
export const AUDIO_EFFECT_NOT_IMPLEMENTED = 'No hay tomas de complementos VST ni de OFX: son binarios de terceros y no se pueden cargar en un navegador. Las de esta lista son propias y suenan igual en la vista previa y en la exportación.';

// ------------------------------------------------------------------ procesado
// Filtro bicuadrático (segundo orden), la forma estándar de los ecualizadores. `a0` se normaliza aquí.
type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number; x1: number; x2: number; y1: number; y2: number };
function biquad(b0: number, b1: number, b2: number, a0: number, a1: number, a2: number): Biquad {
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
}
function processBiquad(filter: Biquad, input: number): number {
  const output = filter.b0 * input + filter.b1 * filter.x1 + filter.b2 * filter.x2 - filter.a1 * filter.y1 - filter.a2 * filter.y2;
  filter.x2 = filter.x1; filter.x1 = input;
  filter.y2 = filter.y1; filter.y1 = output;
  return output;
}
// Banda de estantería (graves o agudos). `slope` es la pendiente en dB/octava.
function shelfFilter(sampleRate: number, frequency: number, gainDb: number, high: boolean): Biquad {
  const A = Math.pow(10, gainDb / 40);
  const omega = 2 * Math.PI * frequency / sampleRate;
  const cos = Math.cos(omega), sin = Math.sin(omega);
  const alpha = sin / 2 * Math.sqrt((A + 1 / A) * (1 / .9 - 1) + 2);
  const twoSqrtAAlpha = 2 * Math.sqrt(A) * alpha;
  if (high) return biquad(
    A * ((A + 1) + (A - 1) * cos + twoSqrtAAlpha), -2 * A * ((A - 1) + (A + 1) * cos), A * ((A + 1) + (A - 1) * cos - twoSqrtAAlpha),
    (A + 1) - (A - 1) * cos + twoSqrtAAlpha, 2 * ((A - 1) - (A + 1) * cos), (A + 1) - (A - 1) * cos - twoSqrtAAlpha,
  );
  return biquad(
    A * ((A + 1) - (A - 1) * cos + twoSqrtAAlpha), 2 * A * ((A - 1) - (A + 1) * cos), A * ((A + 1) - (A - 1) * cos - twoSqrtAAlpha),
    (A + 1) + (A - 1) * cos + twoSqrtAAlpha, -2 * ((A - 1) + (A + 1) * cos), (A + 1) + (A - 1) * cos - twoSqrtAAlpha,
  );
}
// Filtro de pico, para la banda de medios.
function peakFilter(sampleRate: number, frequency: number, gainDb: number, q = 1): Biquad {
  const A = Math.pow(10, gainDb / 40);
  const omega = 2 * Math.PI * frequency / sampleRate;
  const cos = Math.cos(omega), sin = Math.sin(omega);
  const alpha = sin / (2 * q);
  return biquad(1 + alpha * A, -2 * cos, 1 - alpha * A, 1 + alpha / A, -2 * cos, 1 - alpha / A);
}
// Paso alto y paso bajo de segundo orden (para el efecto de teléfono).
function highPass(sampleRate: number, frequency: number, q = .707): Biquad {
  const omega = 2 * Math.PI * frequency / sampleRate;
  const cos = Math.cos(omega), sin = Math.sin(omega);
  const alpha = sin / (2 * q);
  return biquad((1 + cos) / 2, -(1 + cos), (1 + cos) / 2, 1 + alpha, -2 * cos, 1 - alpha);
}
function lowPass(sampleRate: number, frequency: number, q = .707): Biquad {
  const omega = 2 * Math.PI * frequency / sampleRate;
  const cos = Math.cos(omega), sin = Math.sin(omega);
  const alpha = sin / (2 * q);
  return biquad((1 - cos) / 2, 1 - cos, (1 - cos) / 2, 1 + alpha, -2 * cos, 1 - alpha);
}
// Coeficiente de suavizado de un detector de envolvente a partir de un tiempo en milisegundos.
const timeCoefficient = (milliseconds: number, sampleRate: number) => milliseconds <= 0 ? 0 : Math.exp(-1 / (Math.max(1, milliseconds) / 1000 * sampleRate));

type InsertState = {
  effect: AudioEffect;
  channels: {
    lowShelf?: Biquad; highShelf?: Biquad; midPeak?: Biquad; bandPassHigh?: Biquad; bandPassLow?: Biquad; highPass?: Biquad; lowPass?: Biquad;
    delay?: Float32Array; delayPosition?: number;
    reverb?: Float32Array; reverbPosition?: number; reverbLow?: number;
  }[];
  envelope: number;
  gateEnvelope: number;
  hold: number;
  holdFrames: number;
  attackCoefficient: number;
  releaseCoefficient: number;
};
export type InsertChain = { states: InsertState[] };

// Crea el estado de la cadena. `channels` es 2 para pista y bus.
export function createInsertChain(effects: AudioEffect[] | undefined, sampleRate: number, channels = 2): InsertChain {
  return {
    states: (effects ?? []).filter(effect => effect.enabled).map(effect => {
      const state: InsertState = {
        effect, channels: Array.from({ length: channels }, () => ({})),
        envelope: 0, gateEnvelope: 0, hold: 0,
        holdFrames: Math.max(1, Math.round(effect.release / 1000 * sampleRate)),
        attackCoefficient: timeCoefficient(effect.attack, sampleRate),
        releaseCoefficient: timeCoefficient(effect.release, sampleRate),
      };
      for (const channel of state.channels) {
        switch (effect.kind) {
          case 'eq':
            channel.lowShelf = shelfFilter(sampleRate, 200, effect.low, false);
            channel.midPeak = peakFilter(sampleRate, 1000, effect.mid, 1);
            channel.highShelf = shelfFilter(sampleRate, 4000, effect.high, true);
            break;
          case 'phone':
            channel.highPass = highPass(sampleRate, 400);
            channel.lowPass = lowPass(sampleRate, 3400);
            break;
          case 'delay':
            channel.delay = new Float32Array(Math.max(1, Math.round(effect.time / 1000 * sampleRate)));
            channel.delayPosition = 0;
            break;
          case 'reverb': {
            // Dos líneas de retardo por canal (una corta y otra larga) para que la cola no suene a eco
            // único, con un filtro de amortiguación en la realimentación. Es una reverberación de sala
            // sencilla, no un algoritmo de convolución.
            const length = Math.max(1, Math.round(effect.time / 1000 * sampleRate));
            channel.reverb = new Float32Array(length);
            channel.reverbPosition = 0;
            channel.reverbLow = 0;
            break;
          }
          default: break;
        }
      }
      return state;
    }),
  };
}

// Procesa las tomas de la cadena sobre los canales, en orden. Modifica `channels` en el sitio.
export function processInserts(chain: InsertChain, channels: Float32Array[]): void {
  for (const state of chain.states) processInsert(state, channels);
}

// El nivel de la toma, para la interfaz: cuánto está comprimiendo o abriendo ahora mismo (en dB).
export function insertReduction(chain: InsertChain, index: number): number {
  const state = chain.states[index];
  if (!state) return 0;
  switch (state.effect.kind) {
    case 'compressor': case 'limiter': return gainToDb(state.envelope);
    case 'gate': return gainToDb(state.gateEnvelope);
    default: return 0;
  }
}

function processInsert(state: InsertState, channels: Float32Array[]): void {
  const { effect } = state;
  const frames = channels[0].length;
  switch (effect.kind) {
    case 'eq': {
      state.channels.forEach((channel, index) => {
        const { lowShelf, midPeak, highShelf } = channel;
        if (!lowShelf || !midPeak || !highShelf) return;
        const data = channels[index];
        for (let frame = 0; frame < frames; frame++) data[frame] = processBiquad(highShelf, processBiquad(midPeak, processBiquad(lowShelf, data[frame])));
      });
      break;
    }
    case 'phone': {
      state.channels.forEach((channel, index) => {
        const { highPass: high, lowPass: low } = channel;
        if (!high || !low) return;
        const data = channels[index];
        for (let frame = 0; frame < frames; frame++) {
          const dry = data[frame];
          // El filtro deja el ancho de banda telefónico y la saturación suave le da el color de radio.
          const filtered = processBiquad(low, processBiquad(high, dry));
          const saturated = Math.tanh(filtered * 2.5) / Math.tanh(2.5);
          data[frame] = dry + (saturated - dry) * effect.amount;
        }
      });
      break;
    }
    case 'distortion': {
      if (effect.amount <= 0) break;
      const drive = 1 + effect.amount * 24;
      const makeup = dbToGain(effect.makeup);
      for (const channel of channels) for (let index = 0; index < frames; index++) {
        channel[index] = Math.tanh(channel[index] * drive) / Math.tanh(drive) * makeup;
      }
      break;
    }
    case 'delay': {
      if (effect.amount <= 0) break;
      state.channels.forEach((stateChannel, index) => {
        const line = stateChannel.delay;
        if (!line) return;
        const data = channels[index];
        let position = stateChannel.delayPosition ?? 0;
        // El canal derecho usa 0,73 veces el tiempo del izquierdo: así el eco no queda centrado.
        const step = Math.max(1, Math.round(line.length * (index === 1 ? .73 : 1)));
        for (let frame = 0; frame < frames; frame++) {
          const read = (position - step + line.length * 2) % line.length;
          const echo = line[read];
          const dry = data[frame];
          line[position] = dry + echo * effect.feedback;
          position = (position + 1) % line.length;
          data[frame] = dry + echo * effect.amount;
        }
        stateChannel.delayPosition = position;
      });
      break;
    }
    case 'reverb': {
      if (effect.amount <= 0) break;
      const damping = clamp(effect.damping, 0, .99);
      state.channels.forEach((stateChannel, index) => {
        const line = stateChannel.reverb;
        if (!line) return;
        const data = channels[index];
        let position = stateChannel.reverbPosition ?? 0;
        // El canal derecho lee a la mitad de la línea: dos longitudes distintas dan sensación de sala.
        const step = index === 1 ? Math.max(1, Math.round(line.length * .5)) : line.length;
        let low = stateChannel.reverbLow ?? 0;
        for (let frame = 0; frame < frames; frame++) {
          const read = (position - step + line.length * 2) % line.length;
          const tail = line[read];
          low = tail * (1 - damping) + low * damping;
          const dry = data[frame];
          line[position] = dry + low * .7;
          position = (position + 1) % line.length;
          data[frame] = dry + low * effect.amount;
        }
        stateChannel.reverbPosition = position;
        stateChannel.reverbLow = low;
      });
      break;
    }
    case 'compressor': case 'limiter': case 'gate': {
      const threshold = dbToGain(effect.threshold);
      // Un solo detector para los dos canales: si cada canal comprimiera por su cuenta, la imagen estéreo
      // se movería al sonar fuerte en un lado.
      const makeup = dbToGain(effect.makeup);
      const ratio = effect.kind === 'limiter' ? 1000 : effect.ratio;
      for (let frame = 0; frame < frames; frame++) {
        const level = Math.max(Math.abs(channels[0][frame]), channels[1] ? Math.abs(channels[1][frame]) : 0);
        const coefficient = level > state.envelope ? state.attackCoefficient : state.releaseCoefficient;
        state.envelope = level + (state.envelope - level) * coefficient;
        let gain = 1;
        if (effect.kind === 'gate') {
          if (state.envelope > threshold) { state.hold = state.holdFrames; state.gateEnvelope = 1; }
          else if (state.hold > 0) state.hold--;
          else state.gateEnvelope = Math.max(0, state.gateEnvelope - .002);
          gain = state.gateEnvelope;
        } else if (state.envelope > threshold) {
          const overshoot = gainToDb(state.envelope) - effect.threshold;
          const reduced = effect.threshold + overshoot / ratio;
          gain = dbToGain(reduced) / Math.max(1e-12, state.envelope);
        }
        for (const channel of channels) channel[frame] *= gain * makeup;
      }
      // El limitador no puede dejar pasar nada por encima del techo, por muy rápido que suba la señal.
      if (effect.kind === 'limiter') {
        const ceiling = dbToGain(effect.threshold);
        for (const channel of channels) for (let index = 0; index < frames; index++) {
          channel[index] = Math.max(-ceiling, Math.min(ceiling, channel[index]));
        }
      }
      break;
    }
  }
}
