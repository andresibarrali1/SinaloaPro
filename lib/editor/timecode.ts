// Formato de timecode SMPTE. Hasta la ronda 9 el editor mostraba `HH:MM:SS.FF` con punto decimal, que no es
// SMPTE: el separador correcto es `:` (o `;` cuando el timecode descarta fotogramas).
//
// Los tres formatos que se ofrecen son los de VEGAS Pro 15:
//
//  - **No drop frame** (`HH:MM:SS:FF`): los fotogramas se cuentan seguidos a la frecuencia nominal (30 para
//    29,97; 60 para 59,94). Un minuto de timecode no dura un minuto real: con 29,97 fps el desfase es de unos
//    3,6 s por hora.
//  - **Drop frame** (`HH:MM:SS;FF`, con punto y coma): la numeración salta los fotogramas 00 y 01 al empezar
//    cada minuto, salvo cuando el minuto es múltiplo de 10. Así el timecode vuelve a seguir al reloj (el
//    error queda por debajo de un fotograma cada 10 minutos). Solo tiene sentido a 29,97 y 59,94 fps.
//  - **Segundos** (`SS.mmm` con separador de milisegundos): tiempo real con milisegundos, útil para trabajar
//    con audio.
import type { FPS } from './project';
import { TICKS, seconds, ticks } from './project';

export type TimecodeFormat = 'non-drop' | 'drop-frame' | 'seconds';
export const TIMECODE_FORMATS: TimecodeFormat[] = ['non-drop', 'drop-frame', 'seconds'];
export const TIMECODE_LABEL: Record<TimecodeFormat, string> = {
  'non-drop': 'SMPTE sin descarte (HH:MM:SS:FF)',
  'drop-frame': 'SMPTE con descarte (HH:MM:SS;FF)',
  seconds: 'Segundos y milisegundos (SS.mmm)',
};
export const TIMECODE_NOTE: Record<TimecodeFormat, string> = {
  'non-drop': 'Cuenta los fotogramas seguidos a la frecuencia nominal. Con 29,97 o 59,94 fps el timecode se va retrasando respecto del reloj real.',
  'drop-frame': 'Salta los fotogramas 00 y 01 al empezar cada minuto, menos cada 10 minutos, para que el timecode siga al reloj. Solo vale para 29,97 y 59,94 fps.',
  seconds: 'Tiempo real con milisegundos, sin fotogramas. Es el formato cómodo para audio.',
};

// Frecuencia nominal (la que se usa para contar fotogramas de timecode) y si esa velocidad necesita descarte.
//
// Con 29,97 y 59,94 la numeración es nominal 30 y 60 porque son las únicas velocidades que admiten descarte, y
// el descarte es justo lo que mantiene el timecode pegado al reloj. Con las demás velocidades se cuenta a la
// propia frecuencia del proyecto: a 25 fps el fotograma 25 es 00:00:01:00 (y no 00:00:00:25), a 24 fps el 24
// es 00:00:01:00, y a 23,976 se cuenta a 24 con un desfase de un fotograma cada 41 segundos, que es lo que
// hace la norma al no admitir descarte en esa velocidad.
export function nominalRate(fps: FPS): number {
  const rate = fps.num / fps.den;
  if (Math.abs(rate - 29.97) < .02) return 30;
  if (Math.abs(rate - 59.94) < .02) return 60;
  return fps.num;
}
export const isDropFrameRate = (fps: FPS): boolean => Math.abs(fps.num / fps.den - 29.97) < .02 || Math.abs(fps.num / fps.den - 59.94) < .02;
// El formato efectivo: si se pide descarte a una velocidad que no lo admite, se cae a sin descarte.
export const effectiveFormat = (format: TimecodeFormat, fps: FPS): TimecodeFormat => format === 'drop-frame' && !isDropFrameRate(fps) ? 'non-drop' : format;
// Cuántos fotogramas de timecode se saltan por minuto (2 a 29,97 y 4 a 59,94) y cada cuántos minutos no se
// salta ninguno (el minuto 0, el 10, el 20…).
const dropCount = (fps: FPS) => nominalRate(fps) === 60 ? 4 : 2;
const DROP_EVERY = 10;

// Fotograma de timecode que corresponde a un instante, en el formato pedido. Trabaja con enteros: el
// fotograma se calcula redondeando los ticks, no los segundos en coma flotante, para que no haya deriva.
export function frameOfTime(time: number, fps: FPS): number { return Math.max(0, Math.round(time / TICKS * (fps.num / fps.den))); }
export function timeOfFrame(frame: number, fps: FPS): number { return Math.round(frame / (fps.num / fps.den) * TICKS); }

// Convierte un número de fotograma real (contado desde el principio, a la velocidad real) al número de
// fotograma que muestra el timecode con descarte.
//
// El descarte no tira fotogramas de imagen: solo se saltan **números** de timecode al empezar cada minuto,
// salvo cada 10 minutos. Deshaciendo ese salto, el fotograma real del timecode `f` es
//   real = f − descarte·(minutos − minutos/10)
// donde `minutos` son los minutos del propio timecode. Se resuelve por búsqueda hacia atrás desde la
// estimación directa, que es exacta salvo por el redondeo de esa división.
function toDropFrameNumber(frame: number, fps: FPS): number {
  const rate = nominalRate(fps);
  const drop = dropCount(fps);
  const framesPerMinute = rate * 60;
  const reverse = (candidate: number) => {
    const minutes = Math.floor(candidate / framesPerMinute);
    return candidate - drop * (minutes - Math.floor(minutes / DROP_EVERY));
  };
  // Estimación: el descarte quita `drop` números por minuto, nueve de cada diez minutos.
  let candidate = frame + drop * Math.floor(frame / (framesPerMinute - drop));
  while (candidate > 0 && reverse(candidate) > frame) candidate--;
  while (reverse(candidate + 1) <= frame) candidate++;
  return candidate;
}
// Camino inverso: del número de fotograma de un timecode con descarte al fotograma real.
function fromDropFrameNumber(frameNumber: number, fps: FPS): number {
  const rate = nominalRate(fps);
  const drop = dropCount(fps);
  const framesPerMinute = rate * 60;
  const totalMinutes = Math.floor(frameNumber / framesPerMinute);
  return frameNumber - drop * (totalMinutes - Math.floor(totalMinutes / DROP_EVERY));
}

// Descompone un número de fotograma de timecode en horas, minutos, segundos y fotogramas.
export function splitFrames(frame: number, fps: FPS): { hours: number; minutes: number; seconds: number; frames: number } {
  const rate = nominalRate(fps);
  const frames = frame % rate;
  const totalSeconds = Math.floor(frame / rate);
  return { hours: Math.floor(totalSeconds / 3600), minutes: Math.floor(totalSeconds / 60) % 60, seconds: totalSeconds % 60, frames };
}
// Formatea un instante. Es la función que usa toda la interfaz.
export function formatTimecode(time: number, fps: FPS, format: TimecodeFormat = 'non-drop'): string {
  const chosen = effectiveFormat(format, fps);
  if (chosen === 'seconds') {
    const total = Math.max(0, seconds(time));
    return `${Math.floor(total / 3600).toString().padStart(2, '0')}:${Math.floor(total / 60 % 60).toString().padStart(2, '0')}:${Math.floor(total % 60).toString().padStart(2, '0')}.${Math.floor((total % 1) * 1000).toString().padStart(3, '0')}`;
  }
  const frame = frameOfTime(time, fps);
  const dropped = chosen === 'drop-frame' ? toDropFrameNumber(frame, fps) : frame;
  const { hours, minutes, seconds: secs, frames } = splitFrames(dropped, fps);
  const separator = chosen === 'drop-frame' ? ';' : ':';
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}${separator}${frames.toString().padStart(2, '0')}`;
}
// Formato corto, para la regla de la línea de tiempo: MM:SS:FF (o MM:SS.mmm en segundos).
export function formatShortTimecode(time: number, fps: FPS, format: TimecodeFormat = 'non-drop'): string {
  const full = formatTimecode(time, fps, format);
  return full.slice(3);
}
// Acepta lo que una persona escribe: `HH:MM:SS:FF`, `HH:MM:SS;FF`, `MM:SS:FF`, `SS.mmm` o segundos sueltos.
// Devuelve los ticks, o null si no se entiende.
export function parseTimecode(value: string, fps: FPS): number | null {
  const text = value.trim();
  if (!text) return null;
  const nominal = nominalRate(fps);
  // Con punto y coma, o con un cuarto campo, se interpreta como fotogramas.
  const frameMatch = /^(?:(\d{1,3}):)?(\d{1,3}):(\d{1,2})([:;])(\d{1,3})$/.exec(text);
  if (frameMatch) {
    const [, hours, minutes, secs, separator, framesText] = frameMatch;
    const frames = Number(framesText);
    if (frames >= nominal) return null;
    const total = (Number(hours ?? 0) * 3600 + Number(minutes) * 60 + Number(secs)) * nominal + frames;
    const real = separator === ';' ? fromDropFrameNumber(total, fps) : total;
    return timeOfFrame(real, fps);
  }
  // `HH:MM:SS.mmm`, `MM:SS.mmm` o `SS.mmm`: segundos con milisegundos. El punto decimal distingue este
  // caso del de fotogramas.
  const secondsMatch = /^(?:(\d{1,3}):)?(\d{1,3}):(\d{1,3})(?:\.(\d{1,3}))?$/.exec(text);
  if (secondsMatch) {
    const [, hours, minutes, secs, millis] = secondsMatch;
    const total = Number(hours ?? 0) * 3600 + Number(minutes) * 60 + Number(secs) + (millis ? Number(millis.padEnd(3, '0')) / 1000 : 0);
    return ticks(total);
  }
  const plain = Number(text);
  return Number.isFinite(plain) && plain >= 0 ? ticks(plain) : null;
}
// Cuánto se desvía el timecode del reloj real, en segundos, para un instante dado. Sirve para explicar en la
// interfaz por qué existe el descarte.
export function driftSeconds(time: number, fps: FPS, format: TimecodeFormat): number {
  const chosen = effectiveFormat(format, fps);
  if (chosen !== 'non-drop') return 0;
  const frame = frameOfTime(time, fps);
  return frame / nominalRate(fps) - seconds(time);
}
