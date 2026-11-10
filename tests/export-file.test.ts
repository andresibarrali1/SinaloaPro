// Escritura directa del render en disco: qué se le pide al navegador y qué se hace cuando no puede.
// Todo con dobles: no se abre ningún diálogo del sistema ni se escribe ningún archivo real.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FILE_TYPES,canPickRenderFolder,canSaveRenderToFile,chooseRenderFile,chooseRenderFolder,folderFile} from '../lib/editor/export-file';

const fileHandle = (name = 'Mi vídeo.mp4') => ({name,createWritable:async()=>{throw new Error('no se usa en esta prueba');}});

test('sin File System Access no se promete escritura directa',()=>{
 assert.equal(canSaveRenderToFile({}),false);
 assert.equal(canPickRenderFolder({}),false);
 assert.equal(canSaveRenderToFile({showSaveFilePicker:()=>{}}),true);
 assert.equal(canPickRenderFolder({showDirectoryPicker:()=>{}}),true);
});

test('el archivo de salida se pide con el nombre sugerido y el tipo del formato',async()=>{
 let options:unknown=null;
 const scope={showSaveFilePicker:async(input:unknown)=>{options=input;return fileHandle();}};
 const handle=await chooseRenderFile('Mi vídeo.mp4','mp4',scope);
 assert.equal(handle?.name,'Mi vídeo.mp4');
 assert.deepEqual(options,{suggestedName:'Mi vídeo.mp4',types:[FILE_TYPES.mp4]});
 assert.deepEqual(FILE_TYPES.webm.accept,{'video/webm':['.webm']});
 assert.deepEqual(FILE_TYPES.wav.accept,{'audio/wav':['.wav']});
});

test('cancelar el diálogo del sistema no es un error: devuelve null',async()=>{
 const scope={showSaveFilePicker:async()=>{throw Object.assign(new Error('cancelado'),{name:'AbortError'});}};
 assert.equal(await chooseRenderFile('x.mp4','mp4',scope),null);
 // Un fallo de verdad (sin permisos, sin gesto de usuario) se explica en vez de tragárselo.
 const broken={showSaveFilePicker:async()=>{throw new Error('sin permisos');}};
 await assert.rejects(()=>chooseRenderFile('x.mp4','mp4',broken),/sin permisos/);
});

test('la carpeta del lote se pide para escritura y crea cada archivo dentro',async()=>{
 let options:unknown=null;
 const created:string[]=[];
 const folder={name:'Renders',getFileHandle:async(name:string,input?:{create?:boolean})=>{created.push(`${name}:${input?.create===true?'crear':'abrir'}`);return fileHandle(name);}};
 const scope={showDirectoryPicker:async(input:unknown)=>{options=input;return folder;}};
 const chosen=await chooseRenderFolder(scope);
 assert.equal(chosen?.name,'Renders');
 assert.deepEqual(options,{mode:'readwrite'});
 const file=await folderFile(chosen!,'Lote--Alta.mp4');
 assert.equal(file.name,'Lote--Alta.mp4');
 assert.deepEqual(created,['Lote--Alta.mp4:crear']);
});

test('si el usuario cierra la carpeta del lote, el lote no empieza',async()=>{
 const scope={showDirectoryPicker:async()=>{throw Object.assign(new Error('cancelado'),{name:'AbortError'});}};
 assert.equal(await chooseRenderFolder(scope),null);
});
