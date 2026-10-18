import { lockedIds, type Project } from "./project";
export const clampOpacity = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
export const opacityFromDrag = (
  initial: number,
  deltaY: number,
  height: number,
) => clampOpacity(initial - deltaY / Math.max(1, height));
export function setEventOpacity(
  project: Project,
  id: string,
  value: number,
): Project {
  if (lockedIds(project).has(id)) return project;
  return {
    ...project,
    events: project.events.map((event) =>
      event.id === id && event.kind !== "audio"
        ? { ...event, videoOpacity: clampOpacity(value) }
        : event,
    ),
  };
}
