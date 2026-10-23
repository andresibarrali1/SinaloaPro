// Presupuesto de memoria del audio: comprueba el factor de reducción que se aplica a los archivos largos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PCM_MAX_DECIMATION,
  PCM_PER_FILE_BUDGET,
  audioDecimationStep,
  effectiveSampleRate,
  pcmBytes,
} from '../lib/editor/pcm-budget';

const RATE = 48000;

test('un archivo corto se decodifica tal cual', () => {
  assert.equal(audioDecimationStep(60, RATE, 2), 1, 'un minuto estéreo sobra de sobra');
  assert.equal(pcmBytes(60, RATE, 2), 60 * RATE * 2 * 4);
});

test('un audio de 11 minutos ya no se rechaza: se reduce', () => {
  // 11 min estéreo 48 kHz en float32 son ~253 MB, más que el presupuesto por archivo.
  const segundos = 11 * 60;
  const completo = pcmBytes(segundos, RATE, 2);
  assert.ok(completo > PCM_PER_FILE_BUDGET, `el caso de antes: ${completo} bytes`);
  const paso = audioDecimationStep(segundos, RATE, 2);
  assert.ok(paso > 1, `hay que reducir: paso ${paso}`);
  assert.ok(pcmBytes(segundos, RATE, 2, paso) <= PCM_PER_FILE_BUDGET, 'y cabe en el presupuesto');
});

test('un audio de una hora se reduce lo necesario, sin pasarse del tope', () => {
  const paso = audioDecimationStep(3600, RATE, 2);
  assert.ok(paso >= 4 && paso <= PCM_MAX_DECIMATION, `paso razonable: ${paso}`);
  assert.ok(pcmBytes(3600, RATE, 2, paso) <= PCM_PER_FILE_BUDGET);
  assert.ok(effectiveSampleRate(RATE, paso) >= 24000 / 8, 'la frecuencia resultante sigue siendo audible');
});

test('archivos gigantes se quedan en la reducción máxima', () => {
  const paso = audioDecimationStep(4 * 3600, RATE, 2);
  assert.equal(paso, PCM_MAX_DECIMATION);
});

test('la reducción es potencia de dos y la frecuencia resultante es coherente', () => {
  for (const segundos of [60, 600, 1200, 3600, 7200]) {
    const paso = audioDecimationStep(segundos, RATE, 2);
    assert.equal(Math.log2(paso) % 1, 0, `potencia de dos: ${paso}`);
    assert.equal(effectiveSampleRate(RATE, paso), RATE / paso);
  }
});
