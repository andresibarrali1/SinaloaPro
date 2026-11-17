import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateTracking} from '../lib/editor/tracking-native';
test('main window has only local event subscription permissions',()=>{
 const c=JSON.parse(readFileSync(new URL('../sinaloa-tauri/src-tauri/capabilities/tracking-events.json',import.meta.url),'utf8'));
 assert.deepEqual(c.windows,['main']);assert.deepEqual(c.permissions,['core:event:allow-listen','core:event:allow-unlisten']);assert.equal(c.remote,undefined);
});
test('failed event subscription cleans up upload and does not start CSRT',async()=>{
 const calls:string[]=[];const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
 Object.defineProperty(globalThis,'window',{configurable:true,value:{__TAURI__:{event:{listen:async()=>{throw new Error('listen not allowed by ACL');}},core:{invoke:async(command:string)=>{calls.push(command);}}}}});
 try{await assert.rejects(calculateTracking('job',0,{x:0,y:0,w:20,h:20},()=>{}),/ACL/);assert.deepEqual(calls,['cancel_tracking']);}
 finally{if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');}
});

