import {readFile} from 'node:fs/promises';
const port=Number(process.env.CORTE15_PUERTO)||5173;
// 0: exact current build; 1: no server; 2: occupied by a different build/application.
try {
 const response=await fetch(`http://127.0.0.1:${port}/`,{signal:AbortSignal.timeout(2000),cache:'no-store'});
 const html=await response.text();
 const expected=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
 process.exit(response.ok&&html.replace(/\r/g,'').trim()===expected.replace(/\r/g,'').trim()?0:2);
}catch{process.exit(1);}
