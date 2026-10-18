import type { EaseKind, Keyframe } from "./project";
import { KEY_EPSILON } from "./pancrop";

// Context actions target the clicked key, independently of the timeline cursor.
export function setKeyInterpolation(
  keys: Keyframe[],
  time: number,
  curve: EaseKind,
): Keyframe[] {
  return keys.map((key) =>
    Math.abs(key.time - time) <= KEY_EPSILON ? { ...key, curve } : key,
  );
}
