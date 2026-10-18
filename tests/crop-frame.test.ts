import { test } from "node:test";
import assert from "node:assert/strict";
import { createCanvas } from "@napi-rs/canvas";
import {
  defaultCropFrame,
  moveCropFrame,
  resizeCropFrame,
  rotateCropFrame,
} from "../lib/editor/crop-frame";
test("Pan/Crop: axis lock is respected with magnet enabled", () => {
  const c = { ...defaultCropFrame(), x: 0.513, y: 0.527 };
  const horizontal = moveCropFrame(c, 41, 87, 1920, 1080, "x", 32);
  close(horizontal.y, c.y);
  close(horizontal.x * 1920, 1024);
  const vertical = moveCropFrame(c, 80, 40, 1920, 1080, "y", 32);
  close(vertical.x, c.x);
  close(vertical.y * 1080, 608);
});
import {
  newProject,
  newEvent,
  pose,
  ticks,
  split,
  History,
} from "../lib/editor/project";
import { compose } from "../lib/editor/compositor";
import { MediaLibrary } from "../lib/editor/media";
import { validateProject } from "../lib/editor/validation";
const close = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
test("Pan/Crop: resize about center and opposite-anchor resize", () => {
  const c = defaultCropFrame();
  const centered = resizeCropFrame(c, "se", -480, -270, 1920, 1080, true, true);
  close(centered.width, 0.5);
  close(centered.height, 0.5);
  close(centered.x, 0.5);
  close(centered.y, 0.5);
  const anchored = resizeCropFrame(
    c,
    "se",
    -480,
    -270,
    1920,
    1080,
    true,
    false,
  );
  close(anchored.width, 0.75);
  close(anchored.x, 0.375);
  close(anchored.x - anchored.width / 2, 0);
});
test("Pan/Crop: independent dimensions and rotated handle axes", () => {
  const c = { ...defaultCropFrame(), angle: 90 };
  const next = resizeCropFrame(c, "e", 0, -480, 1920, 1080, false, true);
  close(next.width, 0.5);
  close(next.height, 1);
  const locked = resizeCropFrame(
    defaultCropFrame(),
    "n",
    0,
    270,
    1920,
    1080,
    true,
    true,
  );
  close(locked.width, 0.5);
  close(locked.height, 0.5);
});
test("Pan/Crop: off-center pivot rotates the camera center in pixel space", () => {
  const rotated = rotateCropFrame(
    { ...defaultCropFrame(), x: 0.75, pivotX: 0.5 },
    90,
    1920,
    1080,
  );
  close(rotated.x, 0.5);
  close(rotated.y, 0.5 + 480 / 1080);
  const original = rotateCropFrame(rotated, 0, 1920, 1080);
  close(original.x, 0.75);
  close(original.y, 0.5);
});
test("Pan/Crop: animated rectangle survives serialization and interpolates", () => {
  const p = newProject(),
    e = newEvent(p.tracks[0].id, "color");
  p.events.push(e);
  e.keys = [
    { ...e.transform, time: 0, cropFrame: defaultCropFrame() },
    {
      ...e.transform,
      time: ticks(4),
      cropFrame: { ...defaultCropFrame(), width: 0.5, height: 0.5, x: 0.75 },
    },
  ];
  const loaded = validateProject(JSON.parse(JSON.stringify(p)));
  const middle = pose(loaded.events[0], ticks(2)).cropFrame!;
  close(middle.width, 0.75);
  close(middle.x, 0.625);
});
test("Pan/Crop: old projects keep their original transform without camera migration", () => {
  const p = newProject(),
    e = newEvent(p.tracks[0].id, "color");
  p.events.push(e);
  e.transform.x = 0.2;
  e.transform.scale = 1.8;
  const loaded = validateProject(JSON.parse(JSON.stringify(p)));
  assert.equal(loaded.events[0].transform.cropFrame, undefined);
  close(pose(e, ticks(1)).scale, 1.8);
});
test("Pan/Crop: camera rectangle zooms source pixels and respects fill switch", async () => {
  const p = newProject();
  p.width = 320;
  p.height = 180;
  const e = newEvent(p.tracks[0].id, "color");
  e.generator = {
    kind: "bars",
    color: "#ffffff",
    color2: "#000000",
    angle: 0,
    size: 24,
    amount: 0.5,
  };
  p.events.push(e);
  const canvas = createCanvas(320, 180),
    pixel = (x: number, y: number) =>
      Array.from(canvas.getContext("2d").getImageData(x, y, 1, 1).data).slice(
        0,
        3,
      );
  const render = () =>
    compose(
      canvas as unknown as HTMLCanvasElement,
      p,
      new MediaLibrary(),
      ticks(1),
    );
  await render();
  const middle = pixel(120, 90);
  e.transform.cropFrame = { ...defaultCropFrame(), width: 0.5, height: 0.5 };
  await render();
  assert.deepEqual(pixel(80, 90), middle);
  e.transform.cropFrame.fill = false;
  await render();
  assert.deepEqual(pixel(5, 5), [0, 0, 0]);
  assert.notDeepEqual(pixel(160, 90), [0, 0, 0]);
});
test("Pan/Crop: composition preserves background track outside reduced camera content", async () => {
  const p = newProject();
  p.width = 160;
  p.height = 90;
  const front = newEvent(p.tracks[0].id, "color"),
    back = newEvent(p.tracks[1].id, "color");
  front.color = "#ff0000";
  back.color = "#0000ff";
  front.transform.cropFrame = { ...defaultCropFrame(), width: 2, height: 2 };
  p.events.push(front, back);
  const canvas = createCanvas(160, 90);
  await compose(
    canvas as unknown as HTMLCanvasElement,
    p,
    new MediaLibrary(),
    ticks(1),
  );
  const ctx = canvas.getContext("2d");
  assert.deepEqual(
    Array.from(ctx.getImageData(1, 1, 1, 1).data),
    [0, 0, 255, 255],
  );
  assert.deepEqual(
    Array.from(ctx.getImageData(80, 45, 1, 1).data),
    [255, 0, 0, 255],
  );
});
test("Pan/Crop: flip and non-uniform camera match pixel expectations", async () => {
  const p = newProject();
  p.width = 320;
  p.height = 180;
  const e = newEvent(p.tracks[0].id, "color");
  e.generator = {
    kind: "bars",
    color: "#fff000",
    color2: "#000000",
    angle: 0,
    size: 24,
    amount: 0.5,
  };
  p.events.push(e);
  const canvas = createCanvas(320, 180);
  const render = () =>
    compose(
      canvas as unknown as HTMLCanvasElement,
      p,
      new MediaLibrary(),
      ticks(1),
    );
  const px = (x: number) =>
    Array.from(canvas.getContext("2d").getImageData(x, 90, 1, 1).data);
  await render();
  const last = px(300);
  e.transform.cropFrame = {
    ...defaultCropFrame(),
    flipX: true,
    width: 1,
    height: 0.5,
    aspect: false,
  };
  await render();
  assert.deepEqual(px(19), last);
});
test("Pan/Crop: invalid zero dimensions rejected when reopening", () => {
  const p = newProject(),
    e = newEvent(p.tracks[0].id, "color");
  p.events.push(e);
  e.transform.cropFrame = { ...defaultCropFrame(), width: 0 };
  assert.throws(() => validateProject(p));
});

test("Pan/Crop: split, undo and redo preserve camera animation", () => {
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
  const history = new History();
  history.push(p);
  split(p, [e.id], ticks(2));
  close(pose(p.events[0], ticks(1)).cropFrame!.width, 0.875);
  close(pose(p.events[1], ticks(3)).cropFrame!.width, 0.625);
  const before = history.undo(p);
  assert.equal(before.events.length, 1);
  const after = history.redo(before);
  assert.equal(after.events.length, 2);
  close(pose(after.events[1], ticks(3)).cropFrame!.width, 0.625);
});
