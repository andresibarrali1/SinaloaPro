/** Shared geometry for waveform views. All measurements precede React updates. */
export type VisibleRange = {left: number; width: number};
type Subscription = {element: HTMLElement; width: number; notify: (range: VisibleRange) => void};
export function visibleRange(width: number, left: number, viewportLeft: number, viewportRight: number): VisibleRange {
 const offset = Math.max(0, Math.min(width, viewportLeft - left));
 return {left: offset, width: Math.max(0, Math.min(width - offset, viewportRight - Math.max(viewportLeft, left)))};
}

// One scroll listener, ResizeObserver and animation frame per timeline, not per clip.
const groups = new WeakMap<Element, ViewportGroup>();
class ViewportGroup {
 private subscriptions = new Set<Subscription>();
 private frame = 0;
 private observer: ResizeObserver;
 constructor(private viewport: Element) {
  this.observer = new ResizeObserver(this.schedule);
  this.observer.observe(viewport);
  viewport.addEventListener('scroll', this.schedule, {passive: true});
 }
 private schedule = () => {
  if (!this.frame) this.frame = requestAnimationFrame(this.flush);
 };
 private flush = () => {
  this.frame = 0;
  const viewport = this.viewport.getBoundingClientRect();
  const updates = [...this.subscriptions].map(item => ({item,
   range: visibleRange(item.width, item.element.getBoundingClientRect().left, viewport.left, viewport.right)}));
  for (const {item, range} of updates) if (this.subscriptions.has(item)) item.notify(range);
 };
 subscribe(item: Subscription) {
  this.subscriptions.add(item);
  this.observer.observe(item.element);
  const viewport = this.viewport.getBoundingClientRect();
  item.notify(visibleRange(item.width, item.element.getBoundingClientRect().left, viewport.left, viewport.right));
  return () => {
   this.subscriptions.delete(item);
   this.observer.unobserve(item.element);
   if (!this.subscriptions.size) {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.viewport.removeEventListener('scroll', this.schedule);
    groups.delete(this.viewport);
   }
  };
 }
}
export function observeVisibleRange(element: HTMLElement, width: number, notify: (range: VisibleRange) => void) {
 const viewport = element.closest('.timeline-scroll');
 if (!viewport) {notify({left: 0, width}); return () => {};}
 let group = groups.get(viewport);
 if (!group) {group = new ViewportGroup(viewport); groups.set(viewport, group);}
 return group.subscribe({element, width, notify});
}
