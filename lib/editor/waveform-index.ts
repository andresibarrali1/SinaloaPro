// Cached range maxima: scan PCM once, then query peaks without rescanning long clips.
const BLOCK = 128;
const indexes = new WeakMap<
  Float32Array,
  { tree: Float32Array; size: number }
>();
function indexFor(samples: Float32Array) {
  const cached = indexes.get(samples);
  if (cached) return cached;
  let size = 1;
  while (size < Math.ceil(samples.length / BLOCK)) size *= 2;
  const tree = new Float32Array(size * 2);
  for (let i = 0; i < samples.length; i++)
    tree[size + Math.floor(i / BLOCK)] = Math.max(
      tree[size + Math.floor(i / BLOCK)],
      Math.abs(samples[i]) || 0,
    );
  for (let i = size - 1; i > 0; i--)
    tree[i] = Math.max(tree[i * 2], tree[i * 2 + 1]);
  const result = { tree, size };
  indexes.set(samples, result);
  return result;
}
export function indexedPeakColumns(
  samples: Float32Array,
  rate: number,
  from: number,
  to: number,
  columns: number,
) {
  const count = Math.max(1, Math.floor(columns)),
    result = new Array<number>(count).fill(0);
  if (!samples.length || rate <= 0) return result;
  const { tree, size } = indexFor(samples),
    start = Math.min(from, to),
    span = Math.max(1e-9, Math.abs(to - from));
  for (let col = 0; col < count; col++) {
    let left = Math.max(0, Math.floor((start + (span * col) / count) * rate)),
      right = Math.min(
        samples.length,
        Math.ceil((start + (span * (col + 1)) / count) * rate),
      ),
      peak = 0;
    if (right <= left) continue;
    while (left < right && left % BLOCK)
      peak = Math.max(peak, Math.abs(samples[left++]) || 0);
    while (left < right && right % BLOCK)
      peak = Math.max(peak, Math.abs(samples[--right]) || 0);
    let a = left / BLOCK + size,
      b = right / BLOCK + size;
    while (a < b) {
      if (a % 2) peak = Math.max(peak, tree[a++]);
      if (b % 2) peak = Math.max(peak, tree[--b]);
      a = Math.floor(a / 2);
      b = Math.floor(b / 2);
    }
    result[col] = Math.min(1, peak);
  }
  return result;
}
