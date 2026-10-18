// Medidores calibrados de audio: pico, pico real, RMS y sonoridad.
//
// Qué es exacto y qué es una aproximación, porque la diferencia importa cuando se dice «calibrado»:
//
//  - **Pico** y **pico real** son exactos: el pico es el máximo de las muestras y el pico real interpola
//    entre muestras para estimar lo que habría entre ellas (la norma ITU-R BS.1770 llama a esto *true
//    peak*). Se informan en dBFS, con 0 dBFS como fondo de escala.
//  - **RMS** es exacto: la raíz de la media de los cuadrados, en dBFS.
//  - **Sonoridad** sigue el método de ITU-R BS.1770 / EBU R128: filtro K de dos etapas, suma de canales,
//    ventanas de 400 ms con solape, puerta absoluta de −70 LUFS y puerta relativa de −10 LU respecto de la
//    media de las ventanas. **No está verificado contra un medidor homologado**: los coeficientes del filtro
//    K son los de 48 kHz y para otras frecuencias de muestreo se reescalan de forma aproximada, y el banco
//    de pruebas de EBU no se ha ejecutado. Se dice en la interfaz y en la documentación en lugar de
//    presentarlo como una medición certificada.
//
// El estado del filtro y de la puerta vive en la instancia, porque el audio se mide por bloques.
export const SILENCE_DB = -120;
// Los coeficientes del filtro K a 48 kHz son los de la norma: una estantería de +4 dB a partir de unos
// 1,5 kHz (etapa 1) y un paso alto de 38 Hz (etapa 2).
const SHELF_48 = { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [1, -1.69065929318241, .73248077421585] };
const HIGH_PASS_48 = { b: [1, -2, 1], a: [1, -1.99004745483398, .99007225036621] };

export type MeterReading = {
  peakDb: number;          // pico de las muestras, en dBFS
  truePeakDb: number;      // pico real estimado, en dBFS
  rmsDb: number;           // RMS, en dBFS
  loudnessLufs: number;    // sonoridad integrada, en LUFS (aproximación de BS.1770, ver arriba)
  clipped: boolean;        // alguna muestra llegó al fondo de escala
};

const gainToDb = (gain: number) => gain <= 0 ? SILENCE_DB : 20 * Math.log10(gain);
export const dbToGain = (db: number) => Math.pow(10, db / 20);
// Un valor de dB listo para mostrar: por debajo del umbral se dice «−∞» en vez de un número enorme.
export const formatDb = (db: number, digits = 1) => db <= SILENCE_DB + 1 ? '−∞' : `${db > 0 ? '+' : ''}${db.toFixed(digits)}`;
export const formatLufs = (lufs: number) => lufs <= SILENCE_DB + 1 ? '−∞' : lufs.toFixed(1);

// Coeficientes a la frecuencia de muestreo pedida. A 48 kHz son los de la norma; en otras frecuencias se
// reescala la posición relativa de polos y ceros, que es la parte aproximada del medidor.
function coefficientsAt(sampleRate: number, template: { b: number[]; a: number[] }, reference = 48000) {
  if (sampleRate === reference) return { b: [...template.b], a: [...template.a] };
  const factor = reference / sampleRate;
  const map = (value: number, index: number) => index === 0 ? value : value * Math.pow(factor, index);
  return { b: template.b.map(map), a: template.a.map(map) };
}
type FilterState = { x1: number; x2: number; y1: number; y2: number };
const newFilterState = (): FilterState => ({ x1: 0, x2: 0, y1: 0, y2: 0 });
const runFilter = (state: FilterState, coefficients: { b: number[]; a: number[] }, input: number) => {
  const output = coefficients.b[0] * input + coefficients.b[1] * state.x1 + coefficients.b[2] * state.x2
    - coefficients.a[1] * state.y1 - coefficients.a[2] * state.y2;
  state.x2 = state.x1; state.x1 = input;
  state.y2 = state.y1; state.y1 = output;
  return output;
};
// Estima el pico real: el máximo entre las muestras y el vértice de una parábola por los tres puntos que
// rodean a cada máximo local. Es la misma idea que el sobremuestreo de la norma, sin cambiar la frecuencia
// de muestreo.
function truePeakOf(channel: Float32Array): number {
  let peak = 0;
  for (let index = 0; index < channel.length; index++) {
    const value = Math.abs(channel[index]);
    if (value > peak) peak = value;
    if (index > 0 && index < channel.length - 1) {
      const left = channel[index - 1], center = channel[index], right = channel[index + 1];
      const denominator = left - 2 * center + right;
      if (Math.abs(denominator) > 1e-12) {
        const offset = (left - right) / (2 * denominator);
        if (offset > -1 && offset < 1) {
          const interpolated = center - (left - right) * offset / 4;
          if (Math.abs(interpolated) > peak) peak = Math.abs(interpolated);
        }
      }
    }
  }
  return peak;
}

// Medidor acumulativo: se le van pasando los bloques y mantiene pico, pico real, RMS y las ventanas de
// sonoridad. `reading` devuelve el estado actual sin dejar de acumular.
export class LoudnessMeter {
  private peak = 0;
  private truePeak = 0;
  private sumSquares = 0;
  private samples = 0;
  private clipped = false;
  private windowSquares = 0;
  private windowSamples = 0;
  private windowTarget: number;
  private blocks: number[] = [];
  private shelf: FilterState[];
  private highPass: FilterState[];
  private shelfCoefficients: { b: number[]; a: number[] };
  private highPassCoefficients: { b: number[]; a: number[] };
  constructor(private sampleRate = 48000, private channels = 2) {
    this.windowTarget = Math.max(1, Math.round(sampleRate * .4));
    this.shelfCoefficients = coefficientsAt(sampleRate, SHELF_48);
    this.highPassCoefficients = coefficientsAt(sampleRate, HIGH_PASS_48);
    this.shelf = Array.from({ length: channels }, newFilterState);
    this.highPass = Array.from({ length: channels }, newFilterState);
  }
  reset(): void {
    this.peak = 0; this.truePeak = 0; this.sumSquares = 0; this.samples = 0; this.clipped = false;
    this.windowSquares = 0; this.windowSamples = 0; this.blocks = [];
    this.shelf = this.shelf.map(newFilterState);
    this.highPass = this.highPass.map(newFilterState);
  }
  // Añade un bloque. Los canales que falten se tratan como silencio.
  push(channels: Float32Array[]): void {
    const frames = channels[0]?.length ?? 0;
    for (let frame = 0; frame < frames; frame++) {
      let sumSquares = 0;
      for (let index = 0; index < this.channels; index++) {
        const value = channels[index]?.[frame] ?? 0;
        const absolute = Math.abs(value);
        if (absolute > this.peak) this.peak = absolute;
        if (absolute >= 1) this.clipped = true;
        sumSquares += value * value;
        // Filtro K: estantería de agudos y después paso alto.
        const weighted = runFilter(this.highPass[index], this.highPassCoefficients, runFilter(this.shelf[index], this.shelfCoefficients, value));
        this.windowSquares += weighted * weighted;
      }
      this.sumSquares += sumSquares;
      this.samples++;
      this.windowSamples++;
      if (this.windowSamples >= this.windowTarget) {
        // Potencia media de la ventana de 400 ms, repartida entre los canales: la calibración de la norma
        // (un tono de 1 kHz a −20 dBFS **en estéreo** mide −23 LUFS) solo sale si la energía se promedia
        // entre los canales en vez de sumarse. Con un solo canal el resultado es el mismo número.
        this.blocks.push(this.windowSquares / (this.windowSamples * this.channels));
        this.windowSquares = 0; this.windowSamples = 0;
      }
    }
    for (const channel of channels) this.truePeak = Math.max(this.truePeak, truePeakOf(channel));
  }
  get peakDb(): number { return gainToDb(this.peak); }
  get truePeakDb(): number { return gainToDb(this.truePeak); }
  get rmsDb(): number { return gainToDb(Math.sqrt(this.samples ? this.sumSquares / this.samples : 0)); }
  get isClipped(): boolean { return this.clipped; }
  // Sonoridad integrada con las dos puertas de la norma. Devuelve el silencio si no hay ventanas.
  get loudnessLufs(): number {
    const energies = this.blocks.filter(energy => energy > 0);
    if (!energies.length) return SILENCE_DB;
    const absoluteGate = dbToGain(-70) ** 2;
    const above = energies.filter(energy => energy >= absoluteGate);
    if (!above.length) return SILENCE_DB;
    const average = above.reduce((total, energy) => total + energy, 0) / above.length;
    const relativeGate = average * dbToGain(-10) ** 2;
    const gated = above.filter(energy => energy >= relativeGate);
    const kept = gated.length ? gated : above;
    const finalAverage = kept.reduce((total, energy) => total + energy, 0) / kept.length;
    // −0,691 dB es la constante de calibración de la norma: un tono de 1 kHz a −20 dBFS da −23 LUFS.
    return -0.691 + 10 * Math.log10(Math.max(1e-20, finalAverage));
  }
  reading(): MeterReading {
    return { peakDb: this.peakDb, truePeakDb: this.truePeakDb, rmsDb: this.rmsDb, loudnessLufs: this.loudnessLufs, clipped: this.clipped };
  }
}

// Medición de un bloque completo, sin estado previo. Es lo que usan las pruebas y lo que se puede aplicar a
// lo que devuelve `mix`.
export function measure(channels: Float32Array[], sampleRate = 48000): MeterReading {
  const meter = new LoudnessMeter(sampleRate, channels.length);
  meter.push(channels);
  return meter.reading();
}
// Sonoridad integrada de un audio, en ventanas de 400 ms con las dos puertas.
export function measureLoudness(channels: Float32Array[], sampleRate = 48000): number {
  return measure(channels, sampleRate).loudnessLufs;
}
// Resume varias mediciones (por ejemplo, la de cada tramo de un proyecto).
export function averageOf(readings: MeterReading[]): MeterReading {
  if (!readings.length) return { peakDb: SILENCE_DB, truePeakDb: SILENCE_DB, rmsDb: SILENCE_DB, loudnessLufs: SILENCE_DB, clipped: false };
  const loudness = readings.map(reading => reading.loudnessLufs).filter(value => value > SILENCE_DB + 1);
  return {
    peakDb: Math.max(...readings.map(reading => reading.peakDb)),
    truePeakDb: Math.max(...readings.map(reading => reading.truePeakDb)),
    rmsDb: readings.reduce((total, reading) => total + reading.rmsDb, 0) / readings.length,
    loudnessLufs: loudness.length ? loudness.reduce((total, value) => total + value, 0) / loudness.length : SILENCE_DB,
    clipped: readings.some(reading => reading.clipped),
  };
}
