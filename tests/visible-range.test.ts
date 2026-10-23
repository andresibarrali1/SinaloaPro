import {test} from 'node:test';
import assert from 'node:assert/strict';
import {visibleRange, observeVisibleRange} from '../lib/editor/visible-range';

test('visible range preserves clipping at both edges and offscreen clips',()=>{
 assert.deepEqual(visibleRange(200,-50,0,100),{left:50,width:100});
 assert.deepEqual(visibleRange(50,80,0,100),{left:0,width:20});
 assert.deepEqual(visibleRange(50,120,0,100),{left:0,width:0});
 assert.deepEqual(visibleRange(50,-60,0,100),{left:50,width:0});
 assert.deepEqual(visibleRange(0,0,0,100),{left:0,width:0});
});

test('100 waveforms share one frame, viewport read and listener; teardown cancels work',()=>{
 const original={raf:globalThis.requestAnimationFrame,cancel:globalThis.cancelAnimationFrame,resize:globalThis.ResizeObserver};
 let queued: FrameRequestCallback|undefined,frames=0,reads=0,observers=0,disconnected=0;
 const listeners=new Set<EventListener>();
 const viewport={getBoundingClientRect:()=>{reads++;return {left:0,right:100};},
  addEventListener:(_name:string,fn:EventListener)=>listeners.add(fn),
  removeEventListener:(_name:string,fn:EventListener)=>listeners.delete(fn)};
 globalThis.requestAnimationFrame=fn=>{queued=fn;return ++frames;};
 globalThis.cancelAnimationFrame=()=>{queued=undefined;};
 globalThis.ResizeObserver=class {constructor(){observers++;}observe(){}unobserve(){}disconnect(){disconnected++;}} as unknown as typeof ResizeObserver;
 try {
  let notifications=0;
  const disposers=Array.from({length:100},()=>observeVisibleRange({closest:()=>viewport,getBoundingClientRect:()=>({left:10})} as unknown as HTMLElement,200,range=>{notifications++;assert.deepEqual(range,{left:0,width:90});}));
  assert.equal(listeners.size,1);assert.equal(observers,1);
  reads=0;notifications=0;
  for(let i=0;i<20;i++)for(const listener of listeners)listener({} as Event);
  assert.equal(frames,1);queued!(0);queued=undefined;
  assert.equal(reads,1);assert.equal(notifications,100);
  disposers.pop()!();
  for(const listener of listeners)listener({} as Event);
  for(const dispose of disposers)dispose();
  assert.equal(listeners.size,0);assert.equal(disconnected,1);assert.equal(queued,undefined);
  const dispose=observeVisibleRange({closest:()=>viewport,getBoundingClientRect:()=>({left:10})} as unknown as HTMLElement,200,()=>{});
  assert.equal(observers,2);dispose();
  let full;
  observeVisibleRange({closest:()=>null} as unknown as HTMLElement,300,range=>{full=range;})();
  assert.deepEqual(full,{left:0,width:300});
 } finally {
  globalThis.requestAnimationFrame=original.raf;globalThis.cancelAnimationFrame=original.cancel;globalThis.ResizeObserver=original.resize;
 }
});
