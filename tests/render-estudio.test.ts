import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  RENDER_MEMORY_WARN,
  estimateRenderSeconds,
  estimatedRenderBytes,
  formatBytes,
  qualityComparison,
  renderDiagnostics,
  rememberRenderRate,
  sizePressure,
  type RenderDiagnosticsInput,
} from '../lib/editor/render-details';
import {
  MAX_SAVED_PRESETS,
  SAVED_PRESETS_KEY,
  loadSavedPresets,
  presetFromSettings,
  removeSavedPreset,
  sanitizePresetSettings,
  upsertSavedPreset,
  writeSavedPresets,
  type PresetStorage,
  type SavedRenderPreset,
} from '../lib/editor/render-presets';
import type { ExportSettings } from '../lib/editor/export';

const settings = (patch: Partial<ExportSettings> = {}): ExportSettings => ({
  width: 1920,
  height: 1080,
  fps: { num: 30, den: 1 },
  format: 'mp4',
  quality: 'high',
  scope: 'full',
  start: 0,
  end: 0,
  includeVideo: true,
  includeAudio: true,
  bitrateMbps: null,
  ...patch,
});

const caps = { mp4: true, webm: true, wav: true };

const input = (patch: Partial<RenderDiagnosticsInput> = {}): RenderDiagnosticsInput => ({
  settings: settings(),
  caps,
  audioSupport: true,
  duration: 3,
  frames: 90,
  sampleRate: 48000,
  projectWidth: 1920,
  projectHeight: 1080,
  projectFps: { num: 30, den: 1 },
  missingMedia: 0,
  hasRegion: true,
  name: 'Mi vídeo',
  ...patch,
});

const memory = (): PresetStorage & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return { map, getItem: key => map.get(key) ?? null, setItem: (key, value) => { map.set(key, value); } };
};

test('el peso estimado crece con la duración y con la calidad', () => {
  const base = estimatedRenderBytes(settings(), 10, 48000);
  assert.ok(estimatedRenderBytes(settings(), 20, 48000) > base);
  assert.ok(estimatedRenderBytes(settings({ quality: 'master' }), 10, 48000) > base);
  assert.ok(estimatedRenderBytes(settings({ quality: 'draft' }), 10, 48000) < base);
  assert.equal(estimatedRenderBytes(settings({ includeVideo: false, includeAudio: false }), 10, 48000), 0);
  assert.equal(estimatedRenderBytes(settings({ format: 'wav' }), 0, 48000), 0);
});

test('los tamaños se leen en español y el umbral de memoria no lleva decimales', () => {
  assert.equal(formatBytes(999), '999 B');
  assert.equal(formatBytes(2.5 * 1024 * 1024), '2,5 MB');
  assert.equal(formatBytes(RENDER_MEMORY_WARN), '256 MB');
});

test('la comparación de calidades va de menor a mayor y comparte escala', () => {
  const rows = qualityComparison(settings(), 10, 48000);
  assert.deepEqual(rows.map(row => row.quality), ['draft', 'medium', 'high', 'master']);
  assert.equal(rows.at(-1)!.share, 1);
  for (let index = 1; index < rows.length; index++) assert.ok(rows[index].bytes > rows[index - 1].bytes);
});

test('la presión de tamaño avisa al acercarse al umbral de memoria de 256 MB', () => {
  assert.equal(sizePressure(10 * 1024 * 1024), 'ok');
  assert.equal(sizePressure(RENDER_MEMORY_WARN * 0.8), 'near');
  assert.equal(sizePressure(RENDER_MEMORY_WARN), 'over');
});

test('un proyecto normal pasa el diagnóstico sin errores ni avisos', () => {
  const checks = renderDiagnostics(input());
  assert.equal(checks.filter(check => check.level === 'error').length, 0);
  assert.equal(checks.filter(check => check.level === 'warn').length, 0);
  assert.ok(checks.some(check => check.id === 'codec' && check.level === 'ok'));
  assert.ok(checks.some(check => check.id === 'limit' && check.level === 'ok'));
});

test('sin códec o sin salidas el diagnóstico bloquea la exportación', () => {
  const noCodec = renderDiagnostics(input({ caps: { mp4: false, webm: true, wav: true } }));
  assert.equal(noCodec.find(check => check.id === 'codec')?.level, 'error');
  const noOutputs = renderDiagnostics(input({ settings: settings({ includeVideo: false, includeAudio: false }) }));
  assert.equal(noOutputs.find(check => check.id === 'outputs')?.level, 'error');
  const noAudio = renderDiagnostics(input({ audioSupport: false }));
  assert.equal(noAudio.find(check => check.id === 'audio')?.level, 'error');
});

test('el tramo vacío y los medios sin vincular bloquean; el peso grande solo avisa', () => {
  const emptyRange = renderDiagnostics(input({ hasRegion: false, settings: settings({ scope: 'range', start: 0, end: 3 }) }));
  assert.equal(emptyRange.find(check => check.id === 'range')?.level, 'error');
  const missing = renderDiagnostics(input({ missingMedia: 2 }));
  assert.equal(missing.find(check => check.id === 'media')?.level, 'error');
  // Un proyecto de cuatro horas ya no se bloquea por peso: en memoria avisa, y con escritura directa en disco ni eso.
  const huge = renderDiagnostics(input({ duration: 4 * 60 * 60, frames: 432000 }));
  assert.equal(huge.find(check => check.id === 'limit')?.level, 'warn');
  const hugeToFile = renderDiagnostics(input({ duration: 4 * 60 * 60, frames: 432000, directToFile: true }));
  assert.equal(hugeToFile.find(check => check.id === 'limit')?.level, 'ok');
  assert.equal(hugeToFile.filter(check => check.level === 'error').length, 0);
});

test('ampliar el proyecto, cambiar la velocidad o ensuciar el nombre solo avisan', () => {
  const upscaled = renderDiagnostics(input({ settings: settings({ width: 3840, height: 2160 }) }));
  assert.equal(upscaled.find(check => check.id === 'scale')?.level, 'warn');
  const otherFps = renderDiagnostics(input({ settings: settings({ fps: { num: 24, den: 1 } }) }));
  assert.equal(otherFps.find(check => check.id === 'fps')?.level, 'warn');
  const dirtyName = renderDiagnostics(input({ name: 'mi/video' }));
  assert.equal(dirtyName.find(check => check.id === 'name')?.level, 'warn');
  assert.match(dirtyName.find(check => check.id === 'name')!.detail, /mi_video\.mp4/);
});

test('el tiempo se estima con el último render medido y se escala por megapíxeles', () => {
  const storage = memory();
  assert.equal(estimateRenderSeconds(90, 2, storage), null);
  rememberRenderRate({ frames: 90, elapsedMs: 9000, width: 1280, height: 720 }, storage);
  const same = estimateRenderSeconds(90, 1280 * 720 / 1e6, storage)!;
  assert.ok(Math.abs(same - 9) < 0.2, `se esperaba ~9 s y dio ${same}`);
  const bigger = estimateRenderSeconds(90, 3840 * 2160 / 1e6, storage)!;
  assert.ok(bigger > same);
});

test('una medición corrupta no inventa un tiempo', () => {
  const storage = memory();
  storage.setItem('sinaloa.render.rate.v1', '{no es json');
  assert.equal(estimateRenderSeconds(90, 2, storage), null);
  storage.setItem('sinaloa.render.rate.v1', JSON.stringify({ perFrameMs: 0, megapixels: 1 }));
  assert.equal(estimateRenderSeconds(90, 2, storage), null);
});

test('las plantillas propias se validan, se reemplazan por nombre y se limitan a ocho', () => {
  assert.deepEqual(sanitizePresetSettings({ scope: 'range' }), null);
  const patch = sanitizePresetSettings({ width: 1921, height: 1081, fps: { num: 30, den: 1 }, format: 'webm', quality: 'draft', bitrateMbps: null, includeVideo: true, includeAudio: false, scope: 'range' });
  assert.equal(patch?.width, 1922);
  assert.equal(patch?.height, 1082);
  assert.equal(patch?.format, 'webm');
  assert.equal('scope' in (patch ?? {}), false);

  let list: SavedRenderPreset[] = [];
  for (let index = 0; index < MAX_SAVED_PRESETS + 3; index++) {
    list = upsertSavedPreset(list, presetFromSettings(`Plantilla ${index}`, settings(), `p-${index}`, index));
  }
  assert.equal(list.length, MAX_SAVED_PRESETS);
  assert.equal(list[0].name, `Plantilla ${MAX_SAVED_PRESETS + 2}`);

  const repeated = upsertSavedPreset(list, presetFromSettings('Plantilla 9', settings({ width: 1280 }), 'otra', 99));
  assert.equal(repeated.filter(item => item.name === 'Plantilla 9').length, 1);
  assert.equal(repeated[0].settings.width, 1280);
  assert.equal(removeSavedPreset(repeated, 'otra').length, repeated.length - 1);
});

test('las plantillas guardadas sobreviven a la recarga y el almacén corrupto se ignora', () => {
  const storage = memory();
  const list = [presetFromSettings('Mi plantilla', settings({ format: 'webm' }), 'p-1', 1)];
  writeSavedPresets(list, storage);
  assert.equal(storage.map.has(SAVED_PRESETS_KEY), true);
  assert.deepEqual(loadSavedPresets(storage), list);

  storage.setItem(SAVED_PRESETS_KEY, 'no es una lista');
  assert.deepEqual(loadSavedPresets(storage), []);
  assert.deepEqual(loadSavedPresets(null), []);
});

test('una plantilla guarda los ajustes de salida, nunca el ámbito del proyecto', () => {
  const preset = presetFromSettings('Cine', settings({ scope: 'range', start: 4, end: 9 }));
  assert.equal(preset.settings.width, 1920);
  assert.equal('scope' in preset.settings, false);
  assert.equal('start' in preset.settings, false);
});
