import { test } from "node:test";
import assert from "node:assert/strict";
import { createCanvas } from "@napi-rs/canvas";
import {
  defaultCropFrame,
  cropFrameSpace,
  matchCropAspect,
  setCropMargin,
  cropMargins,
  applyCropFrame,
} from "../lib/editor/crop-frame";
const close = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
test("source pixel coordinates round trip without altering saved project camera", () => {
  for (const source of [
    { width: 1080, height: 1920 },
    { width: 4000, height: 3000 },
    { width: 1920, height: 1080 },
  ]) {
    const output = { width: 1920, height: 1080 },
      old = {
        ...defaultCropFrame(),
        x: 0.6,
        width: 0.7,
        angle: 17,
        pivotY: 0.3,
      };
    const result = cropFrameSpace(
      cropFrameSpace(old, source, output, true),
      source,
      output,
    );
    for (const key of [
      "x",
      "y",
      "width",
      "height",
      "angle",
      "pivotX",
      "pivotY",
    ] as const)
      close(result[key], old[key]);
  }
});
test("matching output aspect crops inside source instead of extending to black bars", () => {
  const c = matchCropAspect(
    defaultCropFrame(),
    { width: 1080, height: 1920 },
    16 / 9,
  );
  close(c.width, 1);
  close(c.height, 1080 / (16 / 9) / 1920);
  close(c.x, 0.5);
  const mapped = cropFrameSpace(
    c,
    { width: 1080, height: 1920 },
    { width: 1920, height: 1080 },
  );
  close(mapped.width, mapped.height);
});
test("independent margins anchor opposite edge and prevent zero dimensions", () => {
  const c = setCropMargin(defaultCropFrame(), "left", 0.2);
  close(c.width, 0.8);
  close(c.x, 0.6);
  close(cropMargins(c).right, 0);
  const clipped = setCropMargin(c, "right", 1);
  assert.ok(clipped.width >= 0.00099999);
});
test("crop without fill leaves underlying pixels visible; fill enlarges chosen content", () => {
  const output = createCanvas(160, 90),
    ctx = output.getContext("2d");
  const draw = (fill: boolean) => {
    ctx.resetTransform();
    ctx.fillStyle = "#0000ff";
    ctx.fillRect(0, 0, 160, 90);
    ctx.save();
    applyCropFrame(
      ctx as unknown as CanvasRenderingContext2D,
      { ...defaultCropFrame(), width: 0.5, height: 0.5, fill },
      160,
      90,
    );
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(0, 0, 160, 90);
    ctx.restore();
  };
  draw(false);
  assert.deepEqual([...ctx.getImageData(2, 2, 1, 1).data], [0, 0, 255, 255]);
  assert.deepEqual([...ctx.getImageData(80, 45, 1, 1).data], [255, 0, 0, 255]);
  draw(true);
  assert.deepEqual([...ctx.getImageData(2, 2, 1, 1).data], [255, 0, 0, 255]);
});
