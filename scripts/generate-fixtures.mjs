import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import {spawnSync} from 'node:child_process';const require=createRequire(import.meta.url);const ffmpeg=require('@ffmpeg-installer/ffmpeg').path;const out=path.resolve('tests/fixtures');fs.mkdirSync(out,{recursive:true});
function run(args){const r=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{stdio:'inherit'});if(r.status!==0)throw Error('No se pudieron generar los medios de prueba.');}
run(['-f','lavfi','-i','color=c=red:s=320x180:r=30:d=3','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=3','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',path.join(out,'Video_A.mp4')]);
run(['-f','lavfi','-i','color=c=blue:s=320x180:r=30:d=3','-c:v','libx264','-pix_fmt','yuv420p',path.join(out,'Video_B.mp4')]);
run(['-f','lavfi','-i','sine=frequency=880:sample_rate=48000:duration=6','-c:a','pcm_s16le',path.join(out,'Audio.wav')]);
fs.writeFileSync(path.join(out,'corrupto.mp4'),'Esto no es un video.');console.log('Generados dos MP4 H.264 (uno AAC), un WAV PCM y un archivo corrupto.');
