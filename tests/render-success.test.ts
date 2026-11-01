import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  FOLDER_NOTE,
  downloadsFolder,
  fileLocation,
  formatBytes,
  formatDuration,
  makeOutcome,
  renderDetails,
  renderTitle,
} from '../lib/editor/render-success';
import {
  CONFIRMATION_NOTES,
  SOUND_KEY,
  confirmationSoundEnabled,
  playConfirmation,
  setConfirmationSoundEnabled,
  type ConfirmationAudio,
} from '../lib/editor/confirm-sound';

const base = { fileName: 'mi vídeo.mp4', format: 'mp4' as const, bytes: 13_000_000, frames: 300, elapsedMs: 5100 };

test('tamaños y duraciones se leen en español', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(999), '999 B');
  assert.equal(formatBytes(1024), '1,0 kB');
  assert.equal(formatBytes(2.5 * 1024 * 1024), '2,5 MB');
  assert.equal(formatBytes(13_000_000), '12,4 MB');
  assert.equal(formatDuration(7.3), '0:07,3');
  assert.equal(formatDuration(65.4), '1:05,4');
  assert.equal(formatDuration(0), '0:00,0');
});

test('el resumen de un render nombra el archivo, el tamaño, la duración y la velocidad', () => {
  const outcome = makeOutcome({ ...base, startSeconds: 2, endSeconds: 9.3 });
  assert.equal(outcome.durationSeconds, 7.3);
  assert.equal(renderTitle(outcome), 'Vídeo renderizado');
  const lines = renderDetails(outcome);
  assert.equal(lines[0], 'MP4 · 12,4 MB · 0:07,3 de vídeo');
  assert.equal(lines[1], '300 fotogramas en 0:05,1');
  assert.equal(lines[2], '58,8 fps de render');
});

test('un lote se resume como varios archivos, sin fotogramas inventados', () => {
  const outcome = makeOutcome({ ...base, startSeconds: 0, endSeconds: 4, files: 3 });
  assert.equal(renderTitle(outcome), '3 archivos renderizados');
  assert.deepEqual(renderDetails(outcome), ['12,4 MB en total', '3 archivos, uno por trabajo de la cola']);
});

test('la carpeta de descargas se nombra según el sistema, con su atajo', () => {
  const mac = downloadsFolder('darwin');
  assert.equal(mac.path, '~/Downloads');
  assert.match(mac.hint, /Mayús \+ Comando \+ G/);
  const win = downloadsFolder('win32');
  assert.equal(win.path, '%USERPROFILE%\\Downloads');
  assert.match(win.hint, /Win \+ E/);
  const linux = downloadsFolder('linux');
  assert.equal(linux.path, '~/Downloads');
  assert.match(linux.hint, /Ctrl \+ L/);
  assert.match(FOLDER_NOTE, /no puede abrir la carpeta/);
});

test('la ruta del archivo usa el separador de cada sistema', () => {
  const outcome = makeOutcome({ ...base, startSeconds: 0, endSeconds: 3 });
  assert.equal(fileLocation(outcome, 'darwin'), '~/Downloads/mi vídeo.mp4');
  assert.equal(fileLocation(outcome, 'win32'), '%USERPROFILE%\\Downloads\\mi vídeo.mp4');
});

test('el sonido está activo por defecto y se puede silenciar de forma persistente', () => {
  assert.equal(confirmationSoundEnabled(null), true);

  const guardado: Record<string, string> = {};
  const storage = {
    getItem: (key: string) => guardado[key] ?? null,
    setItem: (key: string, value: string) => { guardado[key] = value; },
  };
  setConfirmationSoundEnabled(false, storage);
  assert.equal(guardado[SOUND_KEY], '0');
  assert.equal(confirmationSoundEnabled(storage), false);
  setConfirmationSoundEnabled(true, storage);
  assert.equal(confirmationSoundEnabled(storage), true);
});

function fakeAudio() {
  const notes: { hertz: number; start: number | null }[] = [];
  const gains: number[] = [];
  let closed = 0;
  const audio: ConfirmationAudio = {
    currentTime: 5,
    destination: {},
    createGain: () => ({ gain: { setValueAtTime: (value) => gains.push(value), linearRampToValueAtTime: (value) => gains.push(value) }, connect: () => undefined }),
    createOscillator: () => {
      const oscillator = {
        type: '',
        frequency: { value: 0 },
        connect: () => undefined,
        start: (when?: number) => { notes.push({ hertz: oscillator.frequency.value, start: when ?? null }); },
        stop: () => undefined,
      };
      return oscillator;
    },
    close: async () => { closed++; },
  };
  return { audio, notes, gains, closed: () => closed };
}

test('la campana suena con las dos notas, escalonadas y con su envolvente', () => {
  const fake = fakeAudio();
  assert.equal(playConfirmation(() => fake.audio), true);
  assert.deepEqual(fake.notes.map((note) => note.hertz), [...CONFIRMATION_NOTES]);
  assert.deepEqual(fake.notes.map((note) => note.start), [5, 5.11]);
  assert.equal(fake.gains.length, 3);
  assert.equal(fake.gains.at(-1), 0.0001);
});

test('sin audio disponible la confirmación no falla: solo no suena', () => {
  assert.equal(playConfirmation(() => null), false);
  assert.equal(playConfirmation(() => { throw new Error('bloqueado'); }), false);
});
