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

/** Apply one opacity value to the selected visual events, respecting locks. */
export function setEventsOpacity(project:Project,ids:string[],value:number):Project {
 const selected=new Set(ids),locked=lockedIds(project),opacity=clampOpacity(value);
 return {...project,events:project.events.map(e=>selected.has(e.id)&&!locked.has(e.id)&&e.kind!=='audio'?{...e,videoOpacity:opacity}:e)};
}
