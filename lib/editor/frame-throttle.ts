// Aglutinador de gestos de puntero: un arrastre dispara decenas de `pointermove` por segundo y cada uno de
// ellos puede acabar en un repintado completo del editor (y, mientras dure, en un fotograma perdido). Esto deja
// pasar **como mucho un valor por fotograma** —el último recibido— y permite forzar ese último al soltar el
// botón, de modo que el gesto termina exactamente donde quedó el puntero aunque el último movimiento no llegara
// a pintarse. Sin esto, mover la aguja sobre un montaje grande hace que el navegador atienda una cola de
// repintados que ya no sirven para nada.
export type FrameThrottle<T> = {
  push(value: T): void; // guarda el último valor y pide un fotograma si no hay uno pendiente
  flush(): T | undefined; // aplica ahora lo pendiente (al soltar) y dice si había algo
  cancel(): void; // descarta lo pendiente sin aplicarlo
};

export function frameThrottle<T>(apply: (value: T) => void): FrameThrottle<T> {
  let pending: { value: T } | undefined;
  let frame = 0;
  const run = () => {
    frame = 0;
    const next = pending;
    pending = undefined;
    if (next) apply(next.value);
  };
  return {
    push(value) {
      pending = { value };
      if (!frame) frame = requestAnimationFrame(run);
    },
    flush() {
      const next = pending;
      pending = undefined;
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      if (!next) return undefined;
      apply(next.value);
      return next.value;
    },
    cancel() {
      pending = undefined;
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    },
  };
}
