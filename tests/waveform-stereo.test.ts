import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AudioWaveform } from "../components/editor/audio-waveform";
import { indexedPeakColumns } from "../lib/editor/waveform-index";
import { peakColumns } from "../lib/editor/waveform";
import { newProject, ticks, type Media } from "../lib/editor/project";
import { validateProject } from "../lib/editor/validation";
const media: Media = {
  id: "audio",
  name: "Estéreo",
  kind: "audio",
  size: 1,
  modified: 0,
  duration: ticks(60),
  width: 0,
  height: 0,
  hasAudio: true,
  mime: "audio/wav",
};
test("indexed waveform matches exact PCM maxima across multiple zoom levels", () => {
  const samples = Float32Array.from({ length: 60000 }, (_, i) =>
    i % 700 < 160 ? Math.sin(i * 0.12) * 0.7 : 0,
  );
  for (const [from, to, count] of [
    [0, 60, 700],
    [5.125, 23.21, 192],
    [12, 13, 1200],
    [0, 60, 24],
  ])
    assert.deepEqual(
      indexedPeakColumns(samples, 1000, from, to, count),
      peakColumns(samples, 1000, from, to, count),
    );
});
test("long audio retains isolated transients and pauses without coarse stored peaks", () => {
  const samples = new Float32Array(100000);
  samples[55000] = 0.9;
  const result = indexedPeakColumns(samples, 1000, 0, 100, 1000);
  assert.ok(result[550] > 0.89);
  assert.equal(result[500], 0);
  assert.equal(
    indexedPeakColumns(samples, 1000, 110, 120, 40).every((x) => x === 0),
    true,
  );
});
test("stereo uses distinct real channel paths and mono stays single", () => {
  const left = new Float32Array(6000),
    right = new Float32Array(6000);
  left.fill(0.8, 1000, 2000);
  right.fill(0.4, 4000, 5000);
  const markup = renderToStaticMarkup(
    createElement(AudioWaveform, {
      media,
      width: 600,
      channels: [left, right],
      sampleRate: 100,
    }),
  );
  assert.match(markup, /data-waveform-channels="2"/);
  assert.match(markup, /viewBox="0 0 512 200"/);
  const paths = Array.from(
    markup.matchAll(/<path[^>]* d="([^"]+)"/g),
    (m) => m[1],
  );
  assert.equal(paths.length, 2);
  assert.notEqual(paths[0], paths[1]);
  const mono = renderToStaticMarkup(
    createElement(AudioWaveform, {
      media,
      width: 600,
      channels: [left],
      sampleRate: 100,
    }),
  );
  assert.match(mono, /data-waveform-channels="1"/);
});
test("saved stereo peaks survive project reopening without duplicating legacy mono", () => {
  const p = newProject();
  p.media = [
    {
      ...media,
      peaks: [0.1, 0.8],
      channelPeaks: [
        [0.1, 0.8],
        [0.7, 0.2],
      ],
    },
  ];
  const restored = validateProject(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(restored.media[0].channelPeaks, p.media[0].channelPeaks);
  const markup = renderToStaticMarkup(
    createElement(AudioWaveform, { media: restored.media[0], width: 300 }),
  );
  assert.match(markup, /data-waveform-channels="2"/);
  assert.match(markup, /data-waveform-source="guardado"/);
});
