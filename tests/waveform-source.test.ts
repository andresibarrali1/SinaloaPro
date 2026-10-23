import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waveformSource } from '../lib/editor/waveform-source';
test('waveform reader preserves stereo peaks without exposing PCM in its properties', () => {
  const pcm = {sampleRate: 8, channels: [new Float32Array([0,1,0,0,0,0,0,0]),new Float32Array([0,0,0,0,0,.5,0,0])]};
  const read = waveformSource(pcm)!;
  assert.equal(waveformSource(pcm), read);
  assert.deepEqual(Object.keys(read), []);
  assert.deepEqual(read(0,1,2), [[1,0],[0,.5]]);
  assert.deepEqual(read(.5,1,1), [[0],[.5]]);
  assert.notEqual(waveformSource({...pcm}), read);
  assert.equal(waveformSource(), undefined);
});
