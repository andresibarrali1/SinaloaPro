import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LatestPreview } from '../lib/editor/latest-preview';

const tick = () => new Promise(resolve => setImmediate(resolve));
test('1000 seeks keep one decoder active and only the latest pending frame', async () => {
  const started: number[] = [], published: number[] = [];
  let release!: () => void, active = 0, maximum = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const queue = new LatestPreview(error => { throw error; });
  for (let i = 0; i < 1000; i++) queue.request(async current => {
    started.push(i); maximum = Math.max(maximum, ++active);
    if (i === 0) await gate;
    if (current()) published.push(i);
    active--;
  });
  assert.deepEqual(started, [0]);
  release(); await tick();
  assert.deepEqual(started, [0, 999]);
  assert.deepEqual(published, [999]);
  assert.equal(maximum, 1);
});
test('cancel drops pending work, invalidates active work and permits a new request', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const published: number[] = [];
  const queue = new LatestPreview(error => { throw error; });
  queue.request(async current => { await gate; if (current()) published.push(1); });
  queue.request(async () => { published.push(2); });
  queue.cancel(); release(); await tick();
  assert.equal(published.length, 0);
  queue.request(async current => { if (current()) published.push(3); });
  await tick(); assert.deepEqual(published, [3]);
});
test('decoder errors are reported without blocking subsequent seeks', async () => {
  const errors: unknown[] = [];
  const queue = new LatestPreview(error => errors.push(error));
  queue.request(async () => { throw new Error('decode'); });
  await tick(); assert.equal(errors.length, 1);
  let painted = false;
  queue.request(async () => { painted = true; });
  await tick(); assert.equal(painted, true);
});
