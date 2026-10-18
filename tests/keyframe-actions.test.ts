import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newProject,
  newEvent,
  ticks,
  pose,
  History,
  type EaseKind,
} from "../lib/editor/project";
import { setKeyInterpolation } from "../lib/editor/keyframe-actions";
import { removeKey } from "../lib/editor/pancrop";
import { defaultCropFrame } from "../lib/editor/crop-frame";
import { validateProject } from "../lib/editor/validation";
function fixture() {
  const p = newProject(),
    e = newEvent(p.tracks[0].id, "color");
  p.events.push(e);
  e.keys = [
    { ...e.transform, time: 0, cropFrame: defaultCropFrame() },
    {
      ...e.transform,
      time: ticks(4),
      cropFrame: { ...defaultCropFrame(), width: 0.5, height: 0.5 },
    },
  ];
  return { p, e };
}
test("context curve changes only the targeted key without mutating originals", () => {
  const { e } = fixture();
  const before = structuredClone(e.keys);
  const result = setKeyInterpolation(e.keys, ticks(4), "slow");
  assert.equal(result[1].curve, "slow");
  assert.equal(result[0], e.keys[0]);
  assert.deepEqual(e.keys, before);
  assert.deepEqual(result[1].cropFrame, before[1].cropFrame);
});
for (const [curve, fraction] of Object.entries({
  linear: 0.25,
  smooth: 0.15625,
  slow: 0.0625,
  fast: 0.4375,
  sharp: 0.00390625,
  hold: 0,
}))
  test(`context ${curve} changes rendered camera interpolation`, () => {
    const { p, e } = fixture();
    e.keys = setKeyInterpolation(e.keys, 0, curve as EaseKind);
    const restored = validateProject(JSON.parse(JSON.stringify(p)));
    const actual = pose(restored.events[0], ticks(1)).cropFrame!.width;
    assert.ok(Math.abs(actual - (1 - 0.5 * fraction)) < 1e-9);
  });
test("context delete, undo and redo preserve the remaining key", () => {
  const { p, e } = fixture();
  const history = new History();
  history.push(p);
  e.keys = removeKey(e.keys, ticks(4));
  assert.equal(e.keys.length, 1);
  assert.equal(e.keys[0].time, 0);
  const restored = history.undo(p);
  assert.equal(restored.events[0].keys.length, 2);
  assert.equal(history.redo(restored).events[0].keys.length, 1);
});
