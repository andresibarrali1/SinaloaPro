// Sonido de confirmación al terminar un renderizado.
//
// Dos notas cortas de campana con Web Audio, sin archivos de audio. La fábrica del contexto se puede
// inyectar para probarlo sin navegador; si el audio está bloqueado o el contexto falla, devuelve false
// y la pantalla de confirmación sigue funcionando igual.

export type ConfirmationOscillator = {
  type: string;
  frequency: { value: number };
  connect: (node: unknown) => void;
  start: (when?: number) => void;
  stop: (when?: number) => void;
};

export type ConfirmationGain = {
  gain: {
    setValueAtTime: (value: number, when: number) => void;
    linearRampToValueAtTime: (value: number, when: number) => void;
  };
  connect: (node: unknown) => void;
};

export type ConfirmationAudio = {
  currentTime: number;
  destination: unknown;
  createOscillator: () => ConfirmationOscillator;
  createGain: () => ConfirmationGain;
  close?: () => Promise<void>;
};

export type AudioFactory = () => ConfirmationAudio | null;

/** Preferencia del usuario, guardada en el navegador. */
export const SOUND_KEY = 'sinaloa-sonido-render';

type Readable = { getItem: (key: string) => string | null };
type Writable = { setItem: (key: string, value: string) => void };

function safeStorage(): (Readable & Writable) | null {
  try {
    const storage = (globalThis as { localStorage?: Readable & Writable }).localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

export function confirmationSoundEnabled(storage: Readable | null = safeStorage()): boolean {
  try {
    return storage?.getItem(SOUND_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setConfirmationSoundEnabled(value: boolean, storage: Writable | null = safeStorage()): void {
  try {
    storage?.setItem(SOUND_KEY, value ? '1' : '0');
  } catch {
    /* almacenamiento bloqueado: la preferencia dura lo que la sesión */
  }
}

function browserAudio(): () => ConfirmationAudio | null {
  return () => {
    const scope = globalThis as { AudioContext?: new () => ConfirmationAudio; webkitAudioContext?: new () => ConfirmationAudio };
    const Context = scope.AudioContext ?? scope.webkitAudioContext;
    return Context ? new Context() : null;
  };
}

/** Notas del acorde ascendente: la y la re, separadas 110 ms. */
export const CONFIRMATION_NOTES: readonly number[] = [880, 1174.66];

/**
 * Suena una vez y suelta el contexto. Devuelve si se pudo reproducir, que es lo que interesa probar.
 */
export function playConfirmation(factory: AudioFactory = browserAudio()): boolean {
  let audio: ConfirmationAudio | null = null;
  try {
    audio = factory();
    if (!audio) return false;
    const now = audio.currentTime;
    const master = audio.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.linearRampToValueAtTime(0.22, now + 0.02);
    master.gain.linearRampToValueAtTime(0.0001, now + 0.46);
    master.connect(audio.destination);
    CONFIRMATION_NOTES.forEach((hertz, index) => {
      const oscillator = audio!.createOscillator();
      const start = now + index * 0.11;
      oscillator.type = 'sine';
      oscillator.frequency.value = hertz;
      oscillator.connect(master);
      oscillator.start(start);
      oscillator.stop(start + 0.3);
    });
    const context = audio;
    const timer = setTimeout(() => {
      void context.close?.().catch(() => undefined);
    }, 900);
    // En Node (pruebas) el temporizador no debe mantener vivo el proceso.
    (timer as unknown as { unref?: () => void }).unref?.();
    return true;
  } catch {
    return false;
  }
}
