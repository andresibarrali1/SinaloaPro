import {test,expect} from '@playwright/test';
test('native close asks for unsaved edits and respects cancel and discard',async({page})=>{
 await page.addInitScript(()=>{const w=window as any;w.closeCalls=0;w.__TAURI__={core:{invoke:async(cmd:string)=>{if(cmd==='close_editor')w.closeCalls++;}},event:{listen:async(name:string,cb:any)=>{if(name==='sinaloa-close-requested')w.requestClose=cb;return()=>{};}}};});
 await page.goto('/?bienvenida=no');
 await expect.poll(()=>page.evaluate(()=>typeof (window as any).requestClose)).toBe('function');
 await page.evaluate(async()=>{const m=await import('/lib/editor/storage.ts' as string);m.marcarPendiente(true);(window as any).requestClose({payload:null});});
 const title=page.getByRole('heading',{name:'¿Guardar los cambios antes de cerrar?'});await expect(title).toBeVisible();
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(title).not.toBeVisible();expect(await page.evaluate(()=>(window as any).closeCalls)).toBe(0);
 await page.evaluate(()=>(window as any).requestClose({payload:null}));await page.getByRole('button',{name:'Cerrar sin guardar',exact:true}).click();expect(await page.evaluate(()=>(window as any).closeCalls)).toBe(1);
});
test('clean project closes without a confirmation',async({page})=>{
 await page.addInitScript(()=>{const w=window as any;w.closeCalls=0;w.__TAURI__={core:{invoke:async(cmd:string)=>{if(cmd==='close_editor')w.closeCalls++;}},event:{listen:async(name:string,cb:any)=>{if(name==='sinaloa-close-requested')w.requestClose=cb;return()=>{};}}};});
 await page.goto('/?bienvenida=no');await expect.poll(()=>page.evaluate(()=>typeof (window as any).requestClose)).toBe('function');await page.evaluate(()=>(window as any).requestClose({payload:null}));await expect.poll(()=>page.evaluate(()=>(window as any).closeCalls)).toBe(1);await expect(page.getByRole('heading',{name:'¿Guardar los cambios antes de cerrar?'})).not.toBeVisible();
});


test('save and close waits for a successful write; failure keeps the project open',async({page})=>{
 const {newProject}=await import('../lib/editor/project');
 await page.addInitScript((project)=>{const w=window as any;w.closeCalls=0;w.failSave=true;w.sinaloaLaunchProject={contents:JSON.stringify(project),handle:{name:'Prueba.SNLPRO',requestPermission:async()=> 'granted',createWritable:async()=>({write:async()=>{if(w.failSave)throw new Error('Fallo simulado de escritura');},close:async()=>{},abort:async()=>{}})}};w.__TAURI__={core:{invoke:async(cmd:string)=>{if(cmd==='close_editor')w.closeCalls++;}},event:{listen:async(name:string,cb:any)=>{if(name==='sinaloa-close-requested')w.requestClose=cb;return()=>{};}}};},newProject());
 await page.goto('/?bienvenida=no');await expect.poll(()=>page.evaluate(()=>typeof (window as any).requestClose)).toBe('function');
 await page.evaluate(async()=>{const m=await import('/lib/editor/storage.ts' as string);m.marcarPendiente(true);(window as any).requestClose({payload:null});});
 await page.getByRole('button',{name:'Guardar y cerrar',exact:true}).click();
 await expect(page.getByRole('button',{name:'Guardar y cerrar',exact:true})).toBeEnabled();expect(await page.evaluate(()=>(window as any).closeCalls)).toBe(0);
 await expect(page.getByRole('heading',{name:'¿Guardar los cambios antes de cerrar?'})).toBeVisible();
 await page.evaluate(()=>(window as any).failSave=false);await page.getByRole('button',{name:'Guardar y cerrar',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).closeCalls)).toBe(1);
});
