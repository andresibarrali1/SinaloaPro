// Source-space camera rectangle. Independent of the legacy event/track transform.
export type CropFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  pivotX: number;
  pivotY: number;
  fill: boolean;
  aspect: boolean;
  flipX: boolean;
  flipY: boolean;
};
export const defaultCropFrame = (): CropFrame => ({
  x: 0.5,
  y: 0.5,
  width: 1,
  height: 1,
  angle: 0,
  pivotX: 0.5,
  pivotY: 0.5,
  fill: true,
  aspect: true,
  flipX: false,
  flipY: false,
});
export function moveCropFrame(
  c: CropFrame,
  dx: number,
  dy: number,
  w: number,
  h: number,
  axis: "xy" | "x" | "y",
  grid = 0,
): CropFrame {
  const snap = (value: number) =>
    grid > 0 ? Math.round(value / grid) * grid : value;
  return {
    ...c,
    x: axis === "y" ? c.x : snap(c.x * w + dx) / w,
    y: axis === "x" ? c.y : snap(c.y * h + dy) / h,
  };
}
export function interpolateCropFrame(
  a: CropFrame,
  b: CropFrame,
  t: number,
): CropFrame {
  const result = { ...a };
  for (const key of [
    "x",
    "y",
    "width",
    "height",
    "angle",
    "pivotX",
    "pivotY",
  ] as const)
    result[key] = a[key] + (b[key] - a[key]) * t;
  return result;
}
export function rotateCropFrame(
  c: CropFrame,
  angle: number,
  w: number,
  h: number,
): CropFrame {
  const r = ((angle - c.angle) * Math.PI) / 180,
    dx = (c.x - c.pivotX) * w,
    dy = (c.y - c.pivotY) * h;
  return {
    ...c,
    angle,
    x: c.pivotX + (dx * Math.cos(r) - dy * Math.sin(r)) / w,
    y: c.pivotY + (dx * Math.sin(r) + dy * Math.cos(r)) / h,
  };
}
// Apply before the legacy event transform; this exact path serves preview and export.
export function applyCropFrame(
  ctx: CanvasRenderingContext2D,
  c: CropFrame,
  w: number,
  h: number,
) {
  let sx = c.fill ? 1 / c.width : 1,
    sy = c.fill ? 1 / c.height : 1;
  if (c.aspect) sx = sy = Math.min(sx, sy);
  ctx.translate(w / 2, h / 2);
  ctx.beginPath();
  ctx.rect(
    (-c.width * w * sx) / 2,
    (-c.height * h * sy) / 2,
    c.width * w * sx,
    c.height * h * sy,
  );
  ctx.clip();
  ctx.scale(c.flipX ? -sx : sx, c.flipY ? -sy : sy);
  ctx.rotate((-c.angle * Math.PI) / 180);
  ctx.translate(-c.x * w, -c.y * h);
}
export function resizeCropFrame(
  c: CropFrame,
  handle: string,
  dx: number,
  dy: number,
  w: number,
  h: number,
  lock: boolean,
  center: boolean,
): CropFrame {
  const r = (-c.angle * Math.PI) / 180;
  const ux = (dx * Math.cos(r) - dy * Math.sin(r)) / w,
    uy = (dx * Math.sin(r) + dy * Math.cos(r)) / h;
  const hx = handle.includes("e") ? 1 : handle.includes("w") ? -1 : 0,
    hy = handle.includes("s") ? 1 : handle.includes("n") ? -1 : 0;
  const factor = center ? 2 : 1;
  let width = Math.max(0.001, c.width + hx * ux * factor),
    height = Math.max(0.001, c.height + hy * uy * factor);
  if (lock) {
    const ratio = hx ? width / c.width : height / c.height;
    width = c.width * ratio;
    height = c.height * ratio;
  }
  const lx = center ? 0 : (hx * (width - c.width) * w) / 2,
    ly = center ? 0 : (hy * (height - c.height) * h) / 2;
  return {
    ...c,
    width: Math.min(100, width),
    height: Math.min(100, height),
    x: c.x + (lx * Math.cos(-r) - ly * Math.sin(-r)) / w,
    y: c.y + (lx * Math.sin(-r) + ly * Math.cos(-r)) / h,
  };
}
