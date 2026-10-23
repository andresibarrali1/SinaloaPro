import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {presetPreviewProject,type PreviewKind} from '../lib/editor/preset-preview';
import {compose} from '../lib/editor/compositor';
import {MediaLibrary} from '../lib/editor/media';
import {ticks} from '../lib/editor/project';
import {TRANSITION_KINDS} from '../lib/editor/transitions';
import {TEXT_PRESETS} from '../lib/editor/text-presets';
import {EFFECT_KINDS} from '../lib/editor/effects';
const factory=(w:number,h:number)=>createCanvas(w,h) as unknown as HTMLCanvasElement;
const catalog:[PreviewKind,string[]][]=[['transition',TRANSITION_KINDS],['text',TEXT_PRESETS.map(p=>p.id)],['effect',EFFECT_KINDS],['generator',['solid','gradient','checkerboard','bars','noise']]];
for(const [kind,ids] of catalog)test(`miniaturas ${kind}: todo el catálogo se compone sin modificar el proyecto`,async()=>{
 for(const id of ids){
  const p=presetPreviewProject(kind,id),before=JSON.stringify(p),canvas=factory(160,90);
  await compose(canvas,p,new MediaLibrary(),ticks(1.75),{createCanvas:factory});
  const pixels=canvas.getContext('2d')!.getImageData(0,0,160,90).data;
  assert.ok(pixels.some((v,i)=>i%4!==3&&v>30),id);
  assert.equal(JSON.stringify(p),before,id);
 }
});
test('miniatura de transición cambia al avanzar la reproducción',async()=>{
 const p=presetPreviewProject('transition','dissolve-linear'),canvas=factory(160,90),library=new MediaLibrary();
 await compose(canvas,p,library,ticks(.2),{createCanvas:factory});const a=canvas.getContext('2d')!.getImageData(0,0,160,90).data.slice();
 await compose(canvas,p,library,ticks(2.7),{createCanvas:factory});const b=canvas.getContext('2d')!.getImageData(0,0,160,90).data;
 assert.notDeepEqual(a,b);
});
