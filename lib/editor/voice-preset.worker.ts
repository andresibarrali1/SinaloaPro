import {processVoice,voiceWav} from './voice-preset';
self.onmessage=({data}:{data:{channels:Float32Array[];rate:number}})=>{try{const r=processVoice(data.channels,data.rate,p=>self.postMessage({progress:p}));const wav=voiceWav(r.channels,data.rate);self.postMessage({wav,gain:r.gain}, {transfer:[wav]});}catch(e){self.postMessage({error:e instanceof Error?e.message:String(e)});}};
