#!/usr/bin/env node
// Puente local entre Sinaloa Pro (navegador) y VEGAS Pro 15.
//
// Por qué existe: el formato .veg es propietario y el único lector/escritor completo es VEGAS, por su API
// de scripting. El navegador no puede lanzar procesos, así que este servidor —que corre en tu equipo, solo
// en 127.0.0.1— recibe el .veg (o el montaje a guardar), ejecuta bridge/VegBridge.cs dentro de
// vegas150.exe y devuelve el resultado.
//
// Arranque:  node scripts/veg-bridge-server.mjs   (o «Iniciar-con-VEGAS.cmd», o «npm run bridge»)
//
// Variables de entorno:
//   CORTE15_VEGAS            ruta de vegas150.exe si no está en la de siempre
//   CORTE15_VEG_OUT          carpeta donde se guardan los .veg (por defecto Documentos\Corte15)
//   CORTE15_BRIDGE_PORT      puerto (por defecto 5174)
//   CORTE15_VEG_TIMEOUT      milisegundos de espera a VEGAS (por defecto 240000)
//   CORTE15_VEGAS_NOWINDOW=1 añade /NOWINDOW al arrancar VEGAS (la ayuda de la 15 no lo documenta)
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, writeFile, stat, rm, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const SCRIPT = process.env.CORTE15_VEG_SCRIPT || join(root, 'bridge', 'VegBridge.cs');
const HOST = '127.0.0.1';
const PORT = Number(process.env.CORTE15_BRIDGE_PORT || 5174);
const TIMEOUT_MS = Number(process.env.CORTE15_VEG_TIMEOUT || 240000);
const MAX_BODY = 64 * 1024 * 1024;
const OUTPUT_DIR = process.env.CORTE15_VEG_OUT || join(process.env.USERPROFILE || tmpdir(), 'Documents', 'Corte15');
const VEGAS_CANDIDATES = [
  process.env.CORTE15_VEGAS,
  'C:\\Program Files\\VEGAS\\VEGAS Pro 15.0\\vegas150.exe',
  'C:\\Program Files (x86)\\VEGAS\\VEGAS Pro 15.0\\vegas150.exe',
].filter(Boolean);

const started = new Date();
const findVegas = () => VEGAS_CANDIDATES.find(candidate => existsSync(candidate)) || null;
const sleep = ms => new Promise(done => setTimeout(done, ms));
const log = message => console.log(`[${new Date().toLocaleTimeString('es-ES')}] ${message}`);

// Solo un trabajo a la vez: VEGAS es de instancia única y no conviene encolarle dos scripts.
let pending = Promise.resolve();
function enqueue(work) {
  const run = pending.then(work, work);
  pending = run.then(() => undefined, () => undefined);
  return run;
}

// ---------------------------------------------------------------- ejecución de VEGAS

async function runJob(mode, prepare) {
  const dir = await mkdtemp(join(tmpdir(), 'c15-veg-'));
  const plan = await prepare(dir);
  const job = join(dir, 'job.txt');
  await writeFile(job, `${mode}\n${plan.input}\n${plan.output}\n${plan.report}\n`, 'utf8');

  const vegas = findVegas();
  if (!vegas) throw new Error('No se encontró vegas150.exe. Define CORTE15_VEGAS con la ruta completa del ejecutable.');
  if (!existsSync(SCRIPT)) throw new Error(`No se encontró el script del puente: ${SCRIPT}`);

  const args = ['/NOLOGO'];
  if (process.env.CORTE15_VEGAS_NOWINDOW === '1') args.push('/NOWINDOW');
  args.push('/SCRIPTARGS', `job=${job}`, '/SCRIPT', SCRIPT);
  log(`Ejecutando ${basename(vegas)} para «${mode}»…`);
  const child = spawn(vegas, args, { stdio: 'ignore' });
  child.on('error', () => { /* el error real se detecta por el archivo de salida o por el tiempo de espera */ });

  // No se espera al código de salida: si ya había una ventana de VEGAS abierta, el proceso devuelve el
  // control en seguida y el script corre en la instancia que ya estaba en marcha. Se espera al archivo.
  const errorFile = join(dir, 'error.txt');
  const deadline = Date.now() + TIMEOUT_MS;
  let lastSize = -1;
  let stable = 0;
  for (;;) {
    if (existsSync(errorFile)) {
      const detail = (await readFile(errorFile, 'utf8')).slice(0, 1200).trim();
      throw new Error(`VEGAS informó de un error:\n${detail}`);
    }
    if (existsSync(plan.output)) {
      const size = (await stat(plan.output)).size;
      if (size > 0 && size === lastSize) {
        stable += 1;
        if (stable >= 2) break;
      } else {
        stable = 0;
        lastSize = size;
      }
    }
    if (Date.now() > deadline) {
      try { child.kill(); } catch { /* ya había terminado */ }
      throw new Error(`VEGAS no terminó en ${Math.round(TIMEOUT_MS / 1000)} s. Suele ser un diálogo abierto en su ventana (aviso de prueba, medio perdido o «¿guardar?»): ciérralo y vuelve a intentarlo. Los archivos del intento quedan en ${dir}.`);
    }
    await sleep(250);
  }

  const report = existsSync(plan.report) ? (await readFile(plan.report, 'utf8')).trim().split(/\r?\n/).filter(Boolean) : [];
  log(`«${mode}» terminado (${report.length} línea(s) de informe).`);
  return { dir, output: plan.output, report };
}

// ---------------------------------------------------------------- utilidades HTTP

const ALLOWED_ORIGIN = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;
function applyCors(request, response) {
  const origin = request.headers.origin;
  if (origin && ALLOWED_ORIGIN.test(origin)) {
    response.setHeader('access-control-allow-origin', origin);
    response.setHeader('vary', 'origin');
  }
  response.setHeader('access-control-allow-headers', 'content-type,x-corte15-bridge');
  response.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
}
function send(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) });
  response.end(body);
}
async function readBody(request, limit = MAX_BODY) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error(`El cuerpo supera el límite de ${Math.round(limit / 1048576)} MB.`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
const safeName = value => String(value || 'proyecto').replace(/[\\/:*?"<>|\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'proyecto';
async function freePath(directory, name, extension) {
  for (let attempt = 1; attempt < 200; attempt += 1) {
    const candidate = join(directory, attempt === 1 ? `${name}${extension}` : `${name} (${attempt})${extension}`);
    if (!existsSync(candidate)) return candidate;
  }
  return join(directory, `${name}-${Date.now()}${extension}`);
}

// ---------------------------------------------------------------- rutas

async function handleHealth(request, response) {
  const vegas = findVegas();
  send(response, 200, {
    ok: true,
    vegas,
    script: existsSync(SCRIPT) ? SCRIPT : null,
    output: OUTPUT_DIR,
    port: PORT,
    since: started.toISOString(),
  });
}

// Recibe los bytes del .veg desde el navegador: así no hace falta que el usuario escriba ni elija rutas.
async function handleRead(request, response) {
  const body = await readBody(request);
  if (!body.length) { send(response, 400, { error: 'Llegó un .veg vacío.' }); return; }
  let workDir = null;
  try {
    const job = await runJob('read', async dir => {
      workDir = dir;
      const input = join(dir, 'entrada.veg');
      await writeFile(input, body);
      return { input, output: join(dir, 'montaje.json'), report: join(dir, 'informe.txt') };
    });
    const text = await readFile(job.output, 'utf8');
    send(response, 200, { document: JSON.parse(text), log: job.report });
  } finally {
    if (workDir && existsSync(join(workDir, 'montaje.json'))) await rm(workDir, { recursive: true, force: true });
  }
}

// Recibe el montaje ya convertido a TSV y devuelve la ruta del .veg escrito.
async function handleWrite(request, response) {
  const body = await readBody(request);
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); }
  catch { send(response, 400, { error: 'El cuerpo no es JSON válido.' }); return; }
  if (typeof payload?.tsv !== 'string' || !payload.tsv.trim()) { send(response, 400, { error: 'Falta el montaje (tsv) que hay que convertir.' }); return; }
  const name = safeName(payload.name);
  await mkdir(OUTPUT_DIR, { recursive: true });
  let workDir = null;
  try {
    const job = await runJob('write', async dir => {
      workDir = dir;
      const input = join(dir, 'montaje.tsv');
      await writeFile(input, payload.tsv, 'utf8');
      return { input, output: join(dir, 'salida.veg'), report: join(dir, 'informe.txt') };
    });
    const destination = await freePath(OUTPUT_DIR, name, '.veg');
    await copyFile(job.output, destination);
    log(`Guardado ${destination}`);
    send(response, 200, { path: destination, log: job.report });
  } finally {
    if (workDir && existsSync(join(workDir, 'salida.veg'))) await rm(workDir, { recursive: true, force: true });
  }
}

async function handleReveal(request, response) {
  const body = await readBody(request);
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); }
  catch { send(response, 400, { error: 'El cuerpo no es JSON válido.' }); return; }
  const target = typeof payload?.path === 'string' ? payload.path : '';
  if (!target || !existsSync(target)) { send(response, 404, { error: 'Esa ruta no existe.' }); return; }
  if (process.platform === 'win32') spawn('explorer.exe', [`/select,${target}`], { detached: true, stdio: 'ignore' }).unref();
  send(response, 200, { ok: true });
}

const server = createServer((request, response) => {
  applyCors(request, response);
  if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
  const url = new URL(request.url || '/', `http://${HOST}:${PORT}`);
  const route = async () => {
    if (request.method === 'GET' && url.pathname === '/health') { await handleHealth(request, response); return; }
    if (request.method !== 'POST') { send(response, 405, { error: 'Solo se admiten GET /health y POST /read, /write y /reveal.' }); return; }
    // Cabecera propia: obliga a un prefetch CORS y evita que una web cualquiera use este puente local.
    if (request.headers['x-corte15-bridge'] !== '1') { send(response, 403, { error: 'Falta la cabecera x-corte15-bridge.' }); return; }
    if (url.pathname === '/read') { await enqueue(() => handleRead(request, response)); return; }
    if (url.pathname === '/write') { await enqueue(() => handleWrite(request, response)); return; }
    if (url.pathname === '/reveal') { await handleReveal(request, response); return; }
    send(response, 404, { error: `Ruta desconocida: ${url.pathname}` });
  };
  route().catch(error => {
    log(`Error: ${error.message}`);
    if (!response.headersSent) send(response, 500, { error: error.message });
    else response.end();
  });
});

server.listen(PORT, HOST, () => {
  const vegas = findVegas();
  console.log('Sinaloa Pro · puente de proyectos .veg');
  console.log(`  Escuchando en       http://${HOST}:${PORT}`);
  console.log(`  Script del puente   ${existsSync(SCRIPT) ? SCRIPT : `${SCRIPT}  (NO ENCONTRADO)`}`);
  console.log(`  VEGAS               ${vegas || 'no encontrado: define CORTE15_VEGAS'}`);
  console.log(`  Los .veg se guardan ${OUTPUT_DIR}`);
  console.log('');
  console.log('Deja esta ventana abierta mientras trabajas con .veg. Ctrl+C lo detiene.');
  console.log('VEGAS se abrirá solo al leer o guardar; si muestra algún diálogo, ciérralo para que el script continúe.');
});
server.on('error', error => {
  if (error.code === 'EADDRINUSE') log(`El puerto ${PORT} ya está ocupado: ¿hay otro puente en marcha? Cámbialo con CORTE15_BRIDGE_PORT.`);
  else log(`No se pudo escuchar: ${error.message}`);
  process.exitCode = 1;
});
