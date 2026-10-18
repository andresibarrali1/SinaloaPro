// Almacén mínimo para el panel de medidores.
//
// Por qué existe: durante la reproducción el bucle publica una lectura nueva en cada fotograma (60 veces por
// segundo). Si esa lectura fuera estado de React del editor, cada fotograma volvería a renderizar la línea de
// tiempo entera —con sus eventos, sus ondas y sus cabeceras— y la reproducción se trababa. Con este almacén,
// solo se vuelve a pintar el panel de medidores, que es lo único que cambia.
import { SILENCE_DB, type MeterReading } from './meter';

export const SILENT_READING: MeterReading = { peakDb: SILENCE_DB, truePeakDb: SILENCE_DB, rmsDb: SILENCE_DB, loudnessLufs: SILENCE_DB, clipped: false };

export type MeterStore = {
  get: () => MeterReading;
  set: (reading: MeterReading) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createMeterStore(initial: MeterReading = SILENT_READING): MeterStore {
  let value = initial;
  const listeners = new Set<() => void>();
  const same = (a: MeterReading, b: MeterReading) => a.peakDb === b.peakDb && a.truePeakDb === b.truePeakDb && a.rmsDb === b.rmsDb && a.loudnessLufs === b.loudnessLufs && a.clipped === b.clipped;
  return {
    get: () => value,
    // Si la lectura no cambió no se avisa a nadie: en reposo no hay ningún repintado.
    set: (reading) => {
      if (same(reading, value)) return;
      value = reading;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
