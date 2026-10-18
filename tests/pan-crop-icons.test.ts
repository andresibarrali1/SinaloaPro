import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import * as icons from "../components/editor/pan-crop-icons";
for (const [name, Icon] of Object.entries(icons))
  test(`Pan/Crop icon ${name}: visible vector at 16px`, async () => {
    const markup = renderToStaticMarkup(createElement(Icon, { size: 16 }));
    assert.match(markup, /viewBox="0 0 16 16"/);
    assert.match(markup, /min-width:16px/);
    const bitmap = await loadImage(Buffer.from(markup));
    const canvas = createCanvas(16, 16),
      ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    const pixels = ctx.getImageData(0, 0, 16, 16).data;
    let visible = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 40) visible++;
    assert.ok(
      visible > 12,
      `${name} must paint visible pixels, got ${visible}`,
    );
  });
