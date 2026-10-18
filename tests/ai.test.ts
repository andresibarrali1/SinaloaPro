// Pruebas de las funciones que hablan con servicios externos y del lector de .veg.
// Ninguna prueba llama a la red: las respuestas de Groq y Pexels se simulan, así que lo que se comprueba aquí
// es el contrato (qué se envía y cómo se interpreta la respuesta), no la disponibilidad del servicio.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildSrt,parseSrt,formatSrtTime,encodeWav16,renderSpeechAudio,transcribe,keywords,resourceTerms,planResourcePlacements,GROQ_ENDPOINT,GROQ_MODEL} from '../lib/editor/speech';
import {parsePexelsResponse,pickFile,pexelsFileName,searchVideos,attribution} from '../lib/editor/pexels';
import {analyzeVeg,isVeg,VEG_LIMITS} from '../lib/editor/veg';
import {newProject,newEvent,ticks,seconds} from '../lib/editor/project';
import {MediaLibrary} from '../lib/editor/media';
test('SRT: se construye y se vuelve a leer sin perder tiempos ni texto',()=>{
 const cues=[{start:0,end:1.5,text:'Primera línea'},{start:1.5,end:4.25,text:'Segunda línea\ncon dos renglones'},{start:3661.5,end:3663,text:'Una hora después'}];
 const srt=buildSrt(cues);
 assert.match(srt,/^1\n00:00:00,000 --> 00:00:01,500\nPrimera línea/);
 assert.match(srt,/01:01:01,500 --> 01:01:03,000/);
 const round=parseSrt(srt);
 assert.equal(round.length,3);
 assert.equal(round[0].text,'Primera línea');
 assert.equal(round[1].text,'Segunda línea con dos renglones');
 assert.ok(Math.abs(round[1].end-4.25)<1e-9);
 assert.ok(Math.abs(round[2].start-3661.5)<1e-9);
 assert.equal(formatSrtTime(0),'00:00:00,000');
});
test('WAV: cabecera PCM de 16 bits y conversión de muestras',async()=>{
 const samples=Float32Array.from([0,1,-1,.5]);
 const blob=encodeWav16(samples,16000);
 assert.equal(blob.type,'audio/wav');
 assert.equal(blob.size,44+samples.length*2);
 const buffer=await blob.arrayBuffer(),view=new DataView(buffer);
 const text=(offset:number,length:number)=>String.fromCharCode(...new Uint8Array(buffer,offset,length));
 assert.equal(text(0,4),'RIFF');
 assert.equal(text(8,4),'WAVE');
 assert.equal(text(12,4),'fmt ');
 assert.equal(text(36,4),'data');
 assert.equal(view.getUint16(20,true),1,'PCM sin comprimir');
 assert.equal(view.getUint16(22,true),1,'mono');
 assert.equal(view.getUint32(24,true),16000);
 assert.equal(view.getUint16(34,true),16,'16 bits por muestra');
 assert.equal(view.getUint32(40,true),samples.length*2);
 assert.equal(view.getInt16(44,true),0);
 assert.equal(view.getInt16(46,true),32767);
 assert.equal(view.getInt16(48,true),-32768);
});
test('el audio para transcribir se mezcla a 16 kHz mono y respeta el contenido',async()=>{
 const p=newProject(),library=new MediaLibrary();
 // Señal variable en el tiempo: una rampa permite detectar un error de proporción al remuestrear,
 // que una señal constante ocultaría.
 const source=new Float32Array(48000);
 for(let index=0;index<source.length;index++)source[index]=index/(source.length-1);
 library.items.set('a',{file:{} as File,firstVideo:0,pcm:{channels:[source],sampleRate:48000}});
 p.events.push({...newEvent(p.tracks[2].id,'audio',0,ticks(1)),mediaId:'a'});
 const {samples,sampleRate,duration}=renderSpeechAudio(p,library);
 assert.equal(sampleRate,16000);
 assert.equal(duration,1);
 assert.equal(samples.length,16000);
 // La rampa debe llegar al mismo valor al final: si la proporción está invertida, se queda muy corta.
 assert.ok(Math.abs(samples[8000]-0.5)<0.01,`mitad=${samples[8000]}`);
 assert.ok(Math.abs(samples[15999]-1)<0.01,`final=${samples[15999]}`);
 assert.ok(Math.abs(samples[0])<0.01,`inicio=${samples[0]}`);
 // Y no debe cambiar el tono: un seno de 440 Hz sigue teniendo 440 cruces por segundo.
 const tone=new Float32Array(48000);
 for(let index=0;index<tone.length;index++)tone[index]=Math.sin(2*Math.PI*440*index/48000);
 const other=new MediaLibrary();
 other.items.set('b',{file:{} as File,firstVideo:0,pcm:{channels:[tone],sampleRate:48000}});
 const toneProject=newProject();
 toneProject.sampleRate=48000;
 toneProject.events.push({...newEvent(toneProject.tracks[2].id,'audio',0,ticks(1)),mediaId:'b'});
 const rendered=renderSpeechAudio(toneProject,other);
 let crossings=0;
 for(let index=1;index<rendered.samples.length;index++)if((rendered.samples[index-1]<0)!==(rendered.samples[index]<0))crossings++;
 assert.ok(Math.abs(crossings/2-440)<6,`cruces=${crossings/2} (se esperaban ~440)`);
});
test('transcripción: se envía el WAV con el modelo y se interpretan los segmentos',async()=>{
 const p=newProject(),library=new MediaLibrary();
 library.items.set('a',{file:{} as File,firstVideo:0,pcm:{channels:[new Float32Array(48000).fill(.2)],sampleRate:48000}});
 p.events.push({...newEvent(p.tracks[2].id,'audio',0,ticks(1)),mediaId:'a'});
 const {samples,sampleRate}=renderSpeechAudio(p,library);
 let seen:{url:string;init:RequestInit}|null=null;
 const fakeFetch=(async(url:RequestInfo|URL,init?:RequestInit)=>{seen={url:String(url),init:init??{}};return new Response(JSON.stringify({text:'hola mundo',language:'spanish',duration:1,segments:[{start:0,end:.8,text:' hola'},{start:.8,end:1.4,text:' mundo'}]}),{status:200,headers:{'Content-Type':'application/json'}});}) as unknown as typeof fetch;
 const result=await transcribe(samples,sampleRate,'gsk_prueba',{fetchImpl:fakeFetch});
 assert.equal(seen!.url,GROQ_ENDPOINT);
 const body=seen!.init.body as FormData;
 assert.equal(body.get('model'),GROQ_MODEL);
 assert.equal(body.get('response_format'),'verbose_json');
 assert.ok(body.get('file') instanceof Blob);
 assert.equal(result.cues.length,2);
 assert.equal(result.cues[1].text,'mundo');
 assert.equal(result.language,'spanish');
});
test('transcripción: un error de la API se explica con su código y su mensaje',async()=>{
 const fakeFetch=(async()=>new Response(JSON.stringify({error:{message:'Invalid API Key'}}),{status:401})) as unknown as typeof fetch;
 await assert.rejects(()=>transcribe(new Float32Array(1600),16000,'mala',{fetchImpl:fakeFetch}),/Groq respondió 401: Invalid API Key/);
 await assert.rejects(()=>transcribe(new Float32Array(1600),16000,'',{}),/Falta la clave/);
});
test('palabras clave: se descartan las vacías y se ordenan por frecuencia',()=>{
 const words=keywords('El océano profundo y el océano azul, con olas sobre el océano profundo',5);
 assert.equal(words[0],'océano');
 assert.ok(words.includes('profundo'));
 assert.ok(!words.includes('sobre'));
 assert.ok(!words.includes('con'));
});
test('recursos por transcripción: se elige la palabra de cada frase y se coloca cuando se dice',()=>{
 const cues=[{start:0,end:2,text:'Hola, esto es una prueba'},{start:5.3,end:6.7,text:'Aquí hablamos del dinero'},{start:8,end:9.5,text:'y del dinero otra vez'},{start:10,end:11,text:'de la y que'}];
 const entries=resourceTerms(cues,3);
 assert.deepEqual(entries[0].terms,['hola','prueba'],'las palabras vacías no cuentan');
 assert.equal(entries[1].terms[0],'dinero');
 assert.deepEqual(entries[3].terms,[],'una frase sin palabras útiles no propone nada');
 const placed=planResourcePlacements(cues,{dinero:12,prueba:4,hola:3},1/30);
 assert.equal(placed.length,3);
 assert.deepEqual(placed[0],{term:'hola',start:0,duration:2},'se recorta a la duración de la frase');
 assert.equal(placed[1].term,'dinero');
 assert.ok(Math.abs(placed[1].start-5.3)<1e-9,`inicio ${placed[1].start}`);
 assert.ok(Math.abs(placed[1].duration-1.4)<1e-9,`duración ${placed[1].duration}`);
 assert.equal(placed[2].term,'dinero','la palabra repetida reutiliza el clip');
 assert.ok(Math.abs(placed[2].start-8)<1e-9,`inicio repetido ${placed[2].start}`);
 assert.equal(planResourcePlacements(cues,{},1/30).length,0,'sin clips disponibles no se coloca nada');
});
const pexelsPayload={videos:[
 {id:1,url:'https://www.pexels.com/video/ciudad-1/',duration:12,width:3840,height:2160,image:'https://x/1.jpg',user:{name:'Ana'},video_files:[
  {id:11,quality:'uhd',file_type:'video/mp4',width:3840,height:2160,link:'https://v/1-4k.mp4'},
  {id:12,quality:'hd',file_type:'video/mp4',width:1920,height:1080,link:'https://v/1-1080.mp4'},
  {id:13,quality:'sd',file_type:'video/mp4',width:960,height:540,link:'https://v/1-540.mp4'}]},
 {id:2,url:'https://www.pexels.com/video/mar-2/',duration:8,width:1080,height:1920,user:{name:'Luis'},video_files:[
  {id:21,quality:'hd',file_type:'video/mp4',width:1080,height:1920,link:'https://v/2-1080.mp4'}]},
 {id:3,url:'https://www.pexels.com/video/sin-archivos-3/',duration:5,video_files:[]}]};
test('Pexels: se interpreta la respuesta, se elige un archivo razonable y se nombra el clip',()=>{
 const videos=parsePexelsResponse(pexelsPayload);
 assert.equal(videos.length,2,'se descarta el vídeo sin archivos');
 assert.equal(videos[0].user,'Ana');
 assert.equal(pickFile(videos[0]).width,1920,'se prefiere 1080p antes que 4K');
 assert.equal(pickFile(videos[1]).width,1080);
 assert.equal(pexelsFileName(videos[0],pickFile(videos[0])),'ciudad-1-1-1920p.mp4');
 assert.match(attribution(videos[0]),/Pexels · Ana/);
});
test('Pexels: se envía la consulta con la clave y se explica cualquier error',async()=>{
 let seen:{url:string;headers:Record<string,string>}|null=null;
 const fakeFetch=(async(url:RequestInfo|URL,init?:RequestInit)=>{seen={url:String(url),headers:(init?.headers??{}) as Record<string,string>};return new Response(JSON.stringify(pexelsPayload),{status:200});}) as unknown as typeof fetch;
 const videos=await searchVideos('ciudad nocturna','clave-pexels',{perPage:4,orientation:'landscape',fetchImpl:fakeFetch});
 assert.equal(videos.length,2);
 assert.match(seen!.url,/query=ciudad\+nocturna/);
 assert.match(seen!.url,/per_page=4/);
 assert.equal(seen!.headers.Authorization,'clave-pexels');
 await assert.rejects(()=>searchVideos('ciudad','',{fetchImpl:fakeFetch}),/Falta la clave/);
 await assert.rejects(()=>searchVideos('','clave',{fetchImpl:fakeFetch}),/Escribe qué recursos/);
 const failing=(async()=>new Response('límite alcanzado',{status:429})) as unknown as typeof fetch;
 await assert.rejects(()=>searchVideos('ciudad','clave',{fetchImpl:failing}),/Pexels respondió 429/);
});
test('lector de .veg: se reconocen los datos reales del proyecto del usuario',()=>{
 const bytes=new Uint8Array(fs.readFileSync('tests/fixtures/vegas-real.veg'));
 assert.equal(isVeg(bytes),true);
 const analysis=analyzeVeg(bytes,'adobe.veg');
 assert.equal(analysis.sizeMatches,true);
 assert.equal(analysis.declaredSize,bytes.length);
 assert.equal(analysis.duration,292.767);
 assert.equal(analysis.frameRate,29.97);
 assert.equal(analysis.frameRateConfidence,'alta');
 assert.equal(analysis.width,1920);
 assert.equal(analysis.height,1080);
 assert.equal(analysis.dimensionsConfirmed,true);
 assert.equal(analysis.modifyDate,'2026-10-08T09:48:10-07:00');
 assert.match(analysis.software??'',/Adobe Audition/);
 assert.equal(analysis.chunks.total,187);
 assert.equal(analysis.chunks.top.length,9);
 assert.equal(analysis.chunks.top[0].offset,0xBA0);
 const lastChunk=analysis.chunks.top.at(-1)!;
 assert.equal(lastChunk.size+lastChunk.offset,bytes.length,'la cadena de bloques cubre el archivo entero');
 assert.deepEqual(analysis.media.map(ref=>ref.name),['Apps.mp4','faaah.mp3','Sunlight_on_Still_Water.mp3','Apps.mp4_audio.wav']);
 assert.equal(analysis.titles.length,2);
 assert.equal(analysis.titles[0].text,'Texto de ejemplo');
 assert.equal(analysis.titles[1].text,'ADOBE GRATIS\n\nY OPEN SOURCE');
 assert.equal(analysis.titles[1].name,'Terremoto');
 assert.match(VEG_LIMITS,/línea de tiempo/);
 assert.ok(analysis.notes.some(note=>/no se reconstruye/i.test(note)));
});
test('lector de .veg: un archivo que solo imita la firma lo dice, sin inventar datos',()=>{
 const fake=new TextEncoder().encode('riff.archivo de prueba con la firma pero sin estructura');
 assert.equal(isVeg(fake),true);
 const analysis=analyzeVeg(fake,'proyecto-ejemplo.veg');
 assert.equal(analysis.sizeMatches,false);
 assert.equal(analysis.duration,null);
 assert.equal(analysis.frameRate,null);
 assert.equal(analysis.width,null);
 assert.equal(analysis.media.length,0);
 assert.equal(analysis.titles.length,0);
 assert.ok(analysis.warnings.some(warning=>/No se pudo recorrer/.test(warning)));
 assert.throws(()=>analyzeVeg(new TextEncoder().encode('no es un veg')),/riff/);
});
test('lector de .veg: los medios se convierten en referencias revinculables',()=>{
 const bytes=new Uint8Array(fs.readFileSync('tests/fixtures/vegas-real.veg'));
 const analysis=analyzeVeg(bytes,'adobe.veg');
 const audioExtensions=['.mp3','.wav','.flac','.m4a','.aac'];
 const kinds=analysis.media.map(ref=>audioExtensions.includes(ref.extension)?'audio':'video');
 assert.deepEqual(kinds,['video','audio','audio','audio']);
 assert.ok(analysis.media.every(ref=>ref.path.includes('\\')||ref.path.includes('/')));
 assert.ok(seconds(ticks(analysis.duration??0))===analysis.duration);
});
