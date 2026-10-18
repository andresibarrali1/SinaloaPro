// Forma de onda de los eventos de audio: de las muestras (o de los picos guardados) a las columnas que se
// dibujan en la línea de tiempo.
//
// Por qué existe este módulo: antes la onda se dibujaba siempre con **240 columnas fijas** y leyendo el pico
// **más cercano** de una copia de 240 picos por archivo. Con un archivo largo, un evento que enseña dos segundos
// de diez minutos solo tenía un pico para todo el ancho (una raya plana), y al acercar el zoom las 240 columnas
// se estiraban en bloques anchos: la onda dejaba de decir nada. Aquí:
//
//   · si el material está decodificado se leen **las muestras** (Float32Array) y cada columna se queda con el
//     mayor valor absoluto de las que caen dentro, así que el detalle es el real a cualquier zoom;
//   · si no (un proyecto abierto sin el archivo), se recurre a los **picos guardados** en el medio, que también
//     viajan dentro del `.corte15`, tomando el mayor de los que cubre cada columna;
//   · y el número de columnas sale del **ancho que ocupa el evento en pantalla**, no de una constante.
//
// El máximo por columna (en vez de la muestra más cercana) es lo que evita los dos defectos clásicos: al alejar
// no se pierden los picos, y al acercar no aparecen escalones ni huecos.

export type WaveformSource = 'pcm' | 'guardado';
export type Waveform = { values: number[]; source: WaveformSource };

// Tope de columnas: más que píxeles no aporta y multiplica los puntos del trazado (el trazado se construye como
// una cadena de texto, así que 4 000 columnas por evento se notan al hacer zoom con muchos eventos en pantalla).
export const MAX_WAVEFORM_COLUMNS = 1500;
export const MIN_WAVEFORM_COLUMNS = 24;
// Picos que se guardan con el medio (y viajan en el `.corte15`). Antes eran 240 para todo el archivo: un evento
// que enseñaba dos segundos de diez minutos no tenía más que un pico. Con 1 024 y el valor redondeado a tres
// decimales, el detalle es mucho mayor y el archivo no engorda de más (unos 7 kB por medio).
export const STORED_PEAKS = 1024;
// Hasta cuántos segundos de material se mira con las **muestras** decodificadas. Por encima se usan los picos
// guardados: a esa escala el detalle de las muestras no se ve (la copia tiene 1 024 picos por medio) y el barrido
// crecería con la duración del proyecto en cada paso del zoom de la línea de tiempo, que es lo que la hacía
// pesada. Con este tope, mirar un evento nunca cuesta más de un millón de muestras por columna en total.
export const PCM_WAVEFORM_SECONDS = 20;

// La copia de picos de un material, de 0 a 1, para guardarla en el medio.
export function peakBuckets(samples: Float32Array, buckets = STORED_PEAKS): number[] {
  const count = Math.max(1, Math.floor(buckets));
  const out = new Array<number>(count).fill(0);
  if (samples.length === 0) return out;
  for (let index = 0; index < count; index++) {
    const from = Math.floor(index * samples.length / count);
    const to = Math.max(from + 1, Math.floor((index + 1) * samples.length / count));
    let peak = 0;
    for (let sample = from; sample < to && sample < samples.length; sample++) {
      const value = Math.abs(samples[sample]);
      if (value > peak) peak = value;
    }
    out[index] = Math.round(Math.min(1, peak) * 1000) / 1000;
  }
  return out;
}

// Picos de un tramo de muestras, en `columns` columnas. `from` y `to` van en segundos y se ordenan si llegan al
// revés; el tramo se recorta a lo que hay en el array, así que un evento que se sale del material se dibuja
// hasta donde llega en vez de romperse.
export function peakColumns(samples: Float32Array, sampleRate: number, from: number, to: number, columns: number): number[] {
  const count = Math.max(1, Math.floor(columns));
  if (!(sampleRate > 0) || samples.length === 0) return new Array(count).fill(0);
  const start = Math.min(from, to), end = Math.max(from, to);
  const span = Math.max(1e-9, end - start);
  const out = new Array<number>(count).fill(0);
  for (let index = 0; index < count; index++) {
    const fromSample = Math.max(0, Math.min(samples.length, Math.floor((start + span * index / count) * sampleRate)));
    const toSample = Math.max(fromSample + 1, Math.min(samples.length, Math.ceil((start + span * (index + 1) / count) * sampleRate)));
    if (toSample <= 0 || fromSample >= samples.length) { out[index] = 0; continue; }
    let peak = 0;
    for (let sample = fromSample; sample < toSample; sample++) {
      const value = Math.abs(samples[sample]);
      if (value > peak) peak = value;
    }
    out[index] = peak;
  }
  return out;
}

// Lo mismo, pero desde los picos guardados del medio: cada columna se queda con el mayor de los picos que caen
// dentro de su tramo (y con el más cercano si el tramo es más corto que un pico, para no dejar huecos).
export function bucketColumns(peaks: number[] | undefined, duration: number, from: number, to: number, columns: number): number[] | null {
  if (!peaks?.length || !(duration > 0)) return null;
  const count = Math.max(1, Math.floor(columns));
  const start = Math.max(0, Math.min(from, to)), end = Math.max(from, to);
  const out = new Array<number>(count).fill(0);
  const buckets = peaks.length;
  for (let index = 0; index < count; index++) {
    const timeFrom = start + (end - start) * index / count;
    const timeTo = start + (end - start) * (index + 1) / count;
    // El tramo se recorta a los picos que existen: una columna a caballo del final del material enseña lo que
    // hay (y el resto queda en silencio, que es lo que suena).
    const first = Math.max(0, Math.min(buckets, Math.floor(timeFrom / duration * buckets)));
    const last = Math.max(0, Math.min(buckets, Math.ceil(timeTo / duration * buckets)));
    let peak = 0;
    if (last <= first) {
      // Fuera del material, o un tramo más corto que un pico: se toma el más cercano para no dejar huecos.
      const at = Math.max(0, Math.min(buckets - 1, Math.floor((timeFrom + timeTo) / 2 / duration * buckets)));
      peak = first >= buckets || timeFrom >= duration ? 0 : peaks[at] ?? 0;
    } else if (last - first === 1) {
      peak = peaks[first] ?? 0;
    } else {
      for (let bucket = first; bucket < last; bucket++) {
        const value = peaks[bucket] ?? 0;
        if (value > peak) peak = value;
      }
    }
    out[index] = peak;
  }
  return out;
}

// La onda de un evento: prefiere las muestras decodificadas y, si no las hay, los picos guardados. `reversed`
// da la vuelta al resultado, que es lo que hace el motor al reproducir al revés (el pico de cada columna es el
// mismo, pero cambia de sitio). Devuelve null si no hay con qué dibujar.
export function waveformFor(input: {
  samples?: Float32Array; sampleRate?: number;
  peaks?: number[]; duration: number;
  from: number; to: number; columns: number; reversed?: boolean;
}): Waveform | null {
  const columns = Math.max(MIN_WAVEFORM_COLUMNS, Math.min(MAX_WAVEFORM_COLUMNS, Math.round(input.columns)));
  const slice = Math.abs(input.to - input.from);
  // Las muestras se leen solo cuando aportan detalle de verdad: si los picos guardados que caen en el tramo ya
  // llegan a una columna por pico, con ellos basta y sale mucho más barato. Es decir, se usa **el más fino de los
  // dos**, que es lo que evita barrer el sonido entero en cada paso del zoom sin perder detalle al acercar.
  const covered = input.peaks?.length ? input.peaks.length * (slice / Math.max(1e-9, input.duration)) : 0;
  const wantsPcm = Boolean(input.samples && input.sampleRate) && slice <= PCM_WAVEFORM_SECONDS && columns > covered;
  let waveform: Waveform | null = null;
  if (wantsPcm && input.samples && input.sampleRate) waveform = { values: peakColumns(input.samples, input.sampleRate, input.from, input.to, columns), source: 'pcm' };
  const stored = waveform ? null : bucketColumns(input.peaks, input.duration, input.from, input.to, columns);
  if (!waveform && stored) waveform = { values: stored, source: 'guardado' };
  if (!waveform) return null;
  return input.reversed ? { ...waveform, values: [...waveform.values].reverse() } : waveform;
}

// Los segundos de material que abarca un evento, para saber qué tramo hay que mirar. Se usa el mismo criterio
// que el mezclador: la velocidad alarga o acorta el material consumido.
export const sourceRange = (offset: number, duration: number, speed: number) => ({ from: offset, to: offset + duration * Math.max(0, speed) });

// Escalera de resoluciones de la onda: el número de columnas baja al escalón que quepa en el ancho pedido. Así un
// gesto de zoom reconstruye el trazado tres o cuatro veces en vez de una por paso —el navegador estira el SVG al
// ancho exacto, así que la diferencia no se ve— y la línea de tiempo deja de trabarse al acercar y alejar.
const COLUMN_LADDER = [MIN_WAVEFORM_COLUMNS, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768, 1024, MAX_WAVEFORM_COLUMNS];

// Cuántas columnas dibujar para un ancho en píxeles: una por píxel como mucho, con el mínimo y el máximo del
// módulo, y bajando al escalón de la escalera.
export const columnsFor = (width: number): number => {
  const wanted = Math.max(MIN_WAVEFORM_COLUMNS, Math.min(MAX_WAVEFORM_COLUMNS, Math.round(width)));
  let chosen = COLUMN_LADDER[0];
  for (const step of COLUMN_LADDER) if (step <= wanted) chosen = step;
  return chosen;
};

// El trazado SVG de la silueta: sube por la envolvente de picos, baja por la misma vuelta y cierra. Se dibuja en
// un lienzo de `columns` × 100 con la línea central en 50 y cuatro unidades de margen arriba y abajo. Las
// coordenadas van en enteros: el trazado es la mitad de largo que con decimales y el navegador lo pinta igual.
export function waveformPath(values: number[]): string {
  const count = values.length;
  if (!count) return '';
  const half = 46;
  const up: string[] = [], down: string[] = [];
  values.forEach((value, index) => {
    const peak = Math.round(Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * half);
    up.push(`${index},${50 - peak}`);
    down.push(`${index},${50 + peak}`);
  });
  return `M0,50 L${up.join(' L')} L${count - 1},50 L${down.reverse().join(' L')} Z`;
}
