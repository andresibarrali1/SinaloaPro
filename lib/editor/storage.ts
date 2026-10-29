import { Project, parseProject } from './project';
const KEY='corte15-autosave-v1';
// La marca controla el aviso de cambios pendientes; la copia automática se restaura también si está guardada.
const KEY_PENDIENTE='corte15-pendiente-v1';
export function saveLocal(p:Project){localStorage.setItem(KEY,JSON.stringify(p));}
export function recover():Project|null{const raw=localStorage.getItem(KEY);return raw?parseProject(raw):null;}
/** Apunta si el proyecto tiene cambios sin guardar. Se pone a `true` con cada edición y a `false` al guardar. */
export function marcarPendiente(pendiente:boolean){try{localStorage.setItem(KEY_PENDIENTE,pendiente?'1':'0');}catch{/* sin almacenamiento, la copia automática no existe */}}
/**
 * Estado de la marca de guardado: `pendiente` (hay cambios sin guardar), `guardado` (el proyecto se guardó) o
 * `sin-marca` (proyectos abiertos antes de existir esta regla).
 */
export type EstadoGuardado='pendiente'|'guardado'|'sin-marca';
export function estadoDeGuardado():EstadoGuardado{try{const marca=localStorage.getItem(KEY_PENDIENTE);return marca==='1'?'pendiente':marca==='0'?'guardado':'sin-marca';}catch{return 'sin-marca';}}
/**
 * ¿Queda trabajo sin guardar? Solo cuando la marca dice «pendiente» de verdad. Para decidir al arrancar si se ofrece la
 * copia automática se usa `estadoDeGuardado()`, que además cuenta los proyectos sin marca (los de antes de esta regla)
 * como pendientes, para no perder trabajo.
 */
export function hayCambiosSinGuardar():boolean{return estadoDeGuardado()==='pendiente';}
/** Borra la copia automática y la marca: el próximo arranque será limpio. */
export function olvidarProyecto(){try{localStorage.removeItem(KEY);localStorage.removeItem(KEY_PENDIENTE);}catch{/* nada que borrar */}}
export function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
export function downloadProject(p:Project){download(new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),`${p.name.replace(/\.(sinaloapro|corte15)$/i,'')}.sinaloapro`);}
async function db(){return new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('corte15-media',1);req.onupgradeneeded=()=>req.result.createObjectStore('files');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
export type Headroom = {quota:number;usage:number;free:number;enough:boolean;supported:boolean};
// Browsers may evict IndexedDB data under pressure, so the editor warns before filling the
// local cache instead of only reacting when a write already failed.
export async function storageHeadroom(needed=0):Promise<Headroom>{const estimate=navigator.storage?.estimate;if(typeof estimate!=='function')return {quota:0,usage:0,free:0,enough:true,supported:false};try{const e=await estimate.call(navigator.storage);const quota=e.quota??0,usage=e.usage??0,free=Math.max(0,quota-usage);return {quota,usage,free,enough:!quota||free>needed*1.2,supported:true};}catch{return {quota:0,usage:0,free:0,enough:true,supported:false};}}
export async function storeFile(id:string,file:File){const database=await db();try{await new Promise<void>((resolve,reject)=>{const tx=database.transaction('files','readwrite');tx.objectStore('files').put(file,id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{database.close();}}
export async function readFile(id:string){const database=await db();try{return await new Promise<File|undefined>((resolve,reject)=>{const req=database.transaction('files').objectStore('files').get(id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}finally{database.close();}}
