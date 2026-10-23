import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { compose } from '../lib/editor/compositor';
import { newProject, newEvent, ticks } from '../lib/editor/project';
import { MediaLibrary } from '../lib/editor/media';

test('obsolete composition stops decoding subsequent events and canvas remains reusable', async () => {
  const project = newProject();
  project.width = project.height = 16;
  const first = newEvent(project.tracks[0].id, 'video');
  const second = newEvent(project.tracks[0].id, 'video');
  first.mediaId = second.mediaId = 'source';
  project.events.push(first, second);
  const library = new MediaLibrary();
  let decoded = 0, cancelled = false;
  const source = createCanvas(16, 16);
  const sourceContext = source.getContext('2d');
  sourceContext.fillStyle = '#ff0000'; sourceContext.fillRect(0, 0, 16, 16);
  library.items.set('source', {
    firstVideo: 0,
    canvas: { getCanvas: async () => { decoded++; cancelled = true; return { canvas: source }; } },
  } as unknown as NonNullable<ReturnType<typeof library.items.get>>);
  const output = createCanvas(16, 16) as unknown as HTMLCanvasElement;
  await compose(output, project, library, ticks(1), { cancelled: () => cancelled });
  assert.equal(decoded, 1);
  await compose(output, project, library, ticks(1));
  assert.equal(decoded, 3);
  assert.deepEqual(Array.from(output.getContext('2d')!.getImageData(8, 8, 1, 1).data), [255, 0, 0, 255]);
});
