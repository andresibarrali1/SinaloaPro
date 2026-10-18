import { Project, parseProject } from './project';
const KEY='corte15-autosave-v1';
export function saveLocal(p:Project){localStorage.setItem(KEY,JSON.stringify(p));}
export function recover():Project|null{const raw=localStorage.getItem(KEY);return raw?parseProject(raw):null;}
export function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
export function downloadProject(p:Project){download(new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),`${p.name}.corte15`);}
async function db(){return new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('corte15-media',1);req.onupgradeneeded=()=>req.result.createObjectStore('files');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
export type Headroom = {quota:number;usage:number;free:number;enough:boolean;supported:boolean};
// Browsers may evict IndexedDB data under pressure, so the editor warns before filling the
// local cache instead of only reacting when a write already failed.
export async function storageHeadroom(needed=0):Promise<Headroom>{const estimate=navigator.storage?.estimate;if(typeof estimate!=='function')return {quota:0,usage:0,free:0,enough:true,supported:false};try{const e=await estimate.call(navigator.storage);const quota=e.quota??0,usage=e.usage??0,free=Math.max(0,quota-usage);return {quota,usage,free,enough:!quota||free>needed*1.2,supported:true};}catch{return {quota:0,usage:0,free:0,enough:true,supported:false};}}
export async function storeFile(id:string,file:File){const database=await db();try{await new Promise<void>((resolve,reject)=>{const tx=database.transaction('files','readwrite');tx.objectStore('files').put(file,id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{database.close();}}
export async function readFile(id:string){const database=await db();try{return await new Promise<File|undefined>((resolve,reject)=>{const req=database.transaction('files').objectStore('files').get(id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}finally{database.close();}}
