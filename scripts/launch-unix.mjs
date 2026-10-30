import {spawn} from 'node:child_process';
import {access,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const [major,minor]=process.versions.node.split('.').map(Number);
if(major<22||(major===22&&minor<13)){console.error(`Se requiere Node.js 22.13 o posterior (este equipo tiene ${process.versions.node}).`);process.exit(1);}
const port=Number(process.env.CORTE15_PUERTO||5173);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Puerto inválido (1024–65535).');
const url=`http://127.0.0.1:${port}/`;
const noWindow=process.argv.includes('--sin-ventana');
if(process.argv.includes('--comprobar')){console.log(JSON.stringify({root,platform:process.platform,port,url,noWindow}));process.exit(0);}

// npm que acompaña a este mismo Node: con doble clic, npm no siempre está en el PATH.
const npmCli=path.join(path.dirname(process.execPath),'..','lib','node_modules','npm','bin','npm-cli.js');
const hasBundledNpm=await access(npmCli).then(()=>true,()=>false);
const run=(command,args)=>new Promise((resolve,reject)=>{
 const child=spawn(command,args,{cwd:root,stdio:'inherit'});
 child.on('error',reject);child.on('exit',(code)=>code===0?resolve():reject(new Error(`${command} terminó con código ${code}`)));
});
const npmRun=(args)=>hasBundledNpm?run(process.execPath,[npmCli,...args]):run('npm',args);

// El editor necesita WebCodecs; Safari deja la página en blanco. Se prefiere Chrome, Edge o Brave si están.
const MAC_BROWSERS=[['Google Chrome','/Applications/Google Chrome.app'],['Microsoft Edge','/Applications/Microsoft Edge.app'],['Brave Browser','/Applications/Brave Browser.app']];
async function openBrowser(){
 if(noWindow)return;
 if(process.platform==='darwin'){
  if(process.env.CORTE15_NAVEGADOR!=='predeterminado'){
   for(const [name,app] of MAC_BROWSERS){
    if(!(await access(app).then(()=>true,()=>false)))continue;
    try{await run('open',['-a',name,url]);console.log(`Abriendo ${name}: ${url}`);return;}catch{}
   }
  }
  await run('open',[url]).catch(()=>console.log(`Abre manualmente ${url}`));
  return;
 }
 await run('xdg-open',[url]).catch(()=>console.log(`Abre manualmente ${url}`));
}
const stamp=path.join(root,'node_modules','.sinaloa-platform');
const platform=`${process.platform}-${process.arch}`;
if(await readFile(stamp,'utf8').catch(()=> '')!==platform){
 console.log('Instalando dependencias para este sistema (requiere Internet)…');
 try{await npmRun(['ci']);}
 catch{console.log('npm ci no pudo completarse; se reintenta con npm install…');await npmRun(['install']);}
 await writeFile(stamp,platform);
}
console.log('Compilando la versión actual…');await npmRun(['run','build']);
try{
 const response=await fetch(url,{signal:AbortSignal.timeout(1500)});
 if(response.ok){const html=await response.text();const expected=await readFile(path.join(root,'dist','index.html'),'utf8');if(html.replace(/\r/g,'').trim()!==expected.replace(/\r/g,'').trim())throw new Error('El puerto está ocupado por otra versión o aplicación. Cambia CORTE15_PUERTO.');console.log(`Servidor existente: ${url}`);await openBrowser();process.exit(0);}
}catch(error){if(error.message.includes('otra versión o aplicación'))throw error;}

const server=spawn(process.execPath,['scripts/start-production.mjs'],{cwd:root,stdio:'inherit',env:{...process.env,CORTE15_PUERTO:String(port)}});
let stopped=false;server.on('exit',code=>{stopped=true;process.exitCode=code??1;});server.on('error',error=>{stopped=true;console.error(error);process.exitCode=1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.kill(signal);});
let ready=false;
for(let attempt=0;attempt<50&&!stopped;attempt++){
 try{const response=await fetch(url,{signal:AbortSignal.timeout(1000)});if(response.ok){ready=true;break;}}catch{}
 await new Promise(resolve=>setTimeout(resolve,200));
}
if(ready){console.log(`Sinaloa Pro: ${url}. Ctrl+C detiene el servidor.`);await openBrowser();}
else {server.kill();throw new Error('El servidor no pudo iniciarse. Revisa el puerto y los errores anteriores.');}
