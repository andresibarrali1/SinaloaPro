import { test } from "node:test";
import assert from "node:assert/strict";
import { createCanvas } from "@napi-rs/canvas";
import {
  newProject,
  newEvent,
  ticks,
  split,
  History,
} from "../lib/editor/project";
import { setEventOpacity, opacityFromDrag } from "../lib/editor/event-opacity";
import { validateProject } from "../lib/editor/validation";
import { compose } from "../lib/editor/compositor";
import { MediaLibrary } from "../lib/editor/media";
test("opacity drag: downward reduces level and clamps both ends", () => {
  assert.equal(opacityFromDrag(1, 25, 50), 0.5);
  assert.equal(opacityFromDrag(0.5, -100, 50), 1);
  assert.equal(opacityFromDrag(0.5, 100, 50), 0);
});
test("event level preserves animation and linked audio, and respects locks", () => {
  const p = newProject(),
    v = newEvent(p.tracks[0].id, "color"),
    a = newEvent(p.tracks[2].id, "audio");
  v.group = a.group = "pair";
  v.keys = [{ ...v.transform, time: 0, opacity: 0.4 }];
  p.events.push(v, a);
  const next = setEventOpacity(p, v.id, 0.3);
  assert.equal(next.events[0].videoOpacity, 0.3);
  assert.deepEqual(next.events[0].keys, v.keys);
  assert.equal(next.events[1], a);
  assert.equal(p.events[0].videoOpacity, undefined);
  v.locked = true;
  assert.equal(setEventOpacity(p, v.id, 0.2), p);
});
test("event level survives save, split, undo and redo", () => {
  let p = newProject();
  const v = newEvent(p.tracks[0].id, "color");
  p.events.push(v);
  const history = new History();
  history.push(p);
  p = setEventOpacity(p, v.id, 0.35);
  const loaded = validateProject(JSON.parse(JSON.stringify(p)));
  split(loaded, [v.id], ticks(2));
  assert.ok(loaded.events.every((e) => e.videoOpacity === 0.35));
  const before = history.undo(p);
  assert.equal(before.events[0].videoOpacity, undefined);
  assert.equal(history.redo(before).events[0].videoOpacity, 0.35);
});
test("shared compositor multiplies event opacity with animated opacity", async () => {
  const p = newProject();
  p.width = 160;
  p.height = 90;
  const top = newEvent(p.tracks[0].id, "color"),
    bottom = newEvent(p.tracks[1].id, "color");
  top.color = "#ff0000";
  bottom.color = "#0000ff";
  top.videoOpacity = 0.5;
  top.keys = [{ ...top.transform, opacity: 0.5, time: 0 }];
  p.events.push(top, bottom);
  const canvas = createCanvas(160, 90);
  await compose(
    canvas as unknown as HTMLCanvasElement,
    p,
    new MediaLibrary(),
    ticks(1),
  );
  let px = canvas.getContext("2d").getImageData(80, 45, 1, 1).data;
  assert.ok(Math.abs(px[0] - 64) <= 1);
  assert.ok(Math.abs(px[2] - 191) <= 1);
  top.videoOpacity = 0;
  await compose(
    canvas as unknown as HTMLCanvasElement,
    p,
    new MediaLibrary(),
    ticks(1),
  );
  px = canvas.getContext("2d").getImageData(80, 45, 1, 1).data;
  assert.deepEqual(Array.from(px), [0, 0, 255, 255]);
});
