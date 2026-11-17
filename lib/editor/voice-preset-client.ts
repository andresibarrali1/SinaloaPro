export async function renderVoicePreset(file:File,signal:AbortSignal,progress:(p:number)=>void):Promise<File>{
 const context=new OfflineAudioContext(2,1,48000);let decoded:AudioBuffer;
 if(file.size>512*1024*1024)throw new Error('Divide este audio antes de aplicar el preset: el archivo supera 512 MB.');
 try{decoded=await context.decodeAudioData(await file.arrayBuffer());}catch{throw new Error('No se pudo decodificar el audio original. Revincula un WAV, MP3 o vídeo compatible.');}
 if(signal.aborted)throw new DOMException('Cancelado','AbortError');
 if(decoded.numberOfChannels>2||decoded.length*decoded.numberOfChannels*4>384*1024*1024)throw new Error('Este preset admite mono/estéreo de hasta 384 MB decodificados. Divide el audio.');
 const channels=Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i).slice());
 return await new Promise((resolve,reject)=>{const worker=new Worker(new URL('./voice-preset.worker.ts',import.meta.url),{type:'module'});
 const cleanup=()=>{worker.terminate();signal.removeEventListener('abort',cancel);};const cancel=()=>{cleanup();reject(new DOMException('Cancelado','AbortError'));};signal.addEventListener('abort',cancel,{once:true});
 worker.onerror=()=>{cleanup();reject(new Error('No se pudo procesar el preset de voz.'));};worker.onmessage=({data})=>{if(data.error){cleanup();reject(new Error(data.error));}else if(data.wav){cleanup();resolve(new File([data.wav],file.name.replace(/\.[^.]+$/,'')+' — Voz Andrés.wav',{type:'audio/wav'}));}else progress(data.progress);};
 try{worker.postMessage({channels,rate:decoded.sampleRate},channels.map(c=>c.buffer));}catch(error){cleanup();reject(error);}});
}
