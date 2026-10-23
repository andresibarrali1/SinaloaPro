// Presupuesto de memoria del audio decodificado.
//
// El mezclador necesita las muestras completas para poder leer en cualquier instante de la línea de tiempo, así que el
// audio se decodifica entero. Antes había un tope fijo de 256 MB por proyecto y al pasarlo la importación fallaba: un
// vídeo de más de ~11 minutos en estéreo 48 kHz ya no entraba. Ahora el presupuesto es por archivo, es más alto y, si aun
// así no cabe, se reduce la frecuencia de muestreo lo justo (promediando muestras) para que el archivo entre. Se pierde
// agudeza en los agudos de los archivos muy largos, pero se pueden importar y suenan.
export const PCM_PER_FILE_BUDGET = 192 * 1024 * 1024;
export const PCM_TOTAL_BUDGET = 1024 * 1024 * 1024;
/** Máxima reducción: a 48 kHz deja 3 kHz, suficiente para voz y para música de fondo. */
export const PCM_MAX_DECIMATION = 16;

/** Bytes que ocuparían `durationSeconds` de audio estéreo (o `channels` canales) decodificado a `sampleRate / step`. */
export function pcmBytes(durationSeconds: number, sampleRate: number, channels: number, step = 1): number {
  const porCanal = Math.ceil((Math.max(0, durationSeconds) * sampleRate) / Math.max(1, step));
  return porCanal * Math.max(1, channels) * 4;
}

/** Factor de reducción (potencia de 2) necesario para que el archivo quepa en el presupuesto. */
export function audioDecimationStep(
  durationSeconds: number,
  sampleRate: number,
  channels: number,
  budgetBytes = PCM_PER_FILE_BUDGET,
): number {
  let step = 1;
  while (step < PCM_MAX_DECIMATION && pcmBytes(durationSeconds, sampleRate, channels, step) > budgetBytes) step *= 2;
  return step;
}

/** Frecuencia de muestreo resultante tras aplicar el factor. */
export function effectiveSampleRate(sampleRate: number, step: number): number {
  return sampleRate / Math.max(1, step);
}
