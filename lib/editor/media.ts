import { Input, ALL_FORMATS, BlobSource, CanvasSink, AudioBufferSink } from 'mediabunny';
import { Media, ticks, uid } from './project';
import { looksLikeSrt, srtDuration } from './subtitles';
import { peakBuckets } from './waveform';
export type PCM = { channels: Float32Array[]; sampleRate: number };
export type RuntimeMedia = { file: File; input?: Input; canvas?: CanvasSink; image?: ImageBitmap; pcm?: PCM; firstVideo: number };
export class MediaLibrary {
  items=new Map<string,RuntimeMedia>();
  pcmBytes=0;
  dispose(){for(const r of this.items.values()){r.input?.dispose();r.image?.close();}this.items.clear();this.pcmBytes=0;}
  async import(file:File,id=uid()):Promise<Media>{
    if(!file.size)throw new Error(`${file.name}: archivo vacío.`);
    const meta:Media={id,name:file.name,size:file.size,modified:file.lastModified,kind:'video',duration:0,width:0,height:0,hasAudio:false,mime:file.type};
    let image:ImageBitmap|undefined;
    // Los subtítulos no son un contenedor de audio/vídeo: se leen como texto y se guardan como medio de
    // subtítulos, para poder insertarlos en la línea de tiempo con doble clic.
    if(/\.(srt|vtt)$/i.test(file.name)||file.type==='text/plain'){
      const text=await file.text();
      if(!looksLikeSrt(file.name,text))throw new Error(`${file.name}: no parece un archivo de subtítulos (.srt).`);
      meta.kind='subtitle';meta.mime=file.type||'text/plain';meta.text=text;
      meta.duration=ticks(Math.max(1,srtDuration(text)));
      return meta;
    }
    if(file.type.startsWith('image/')){try{image=await createImageBitmap(file);}catch{throw new Error(`${file.name}: imagen dañada o formato no compatible.`);}meta.kind='image';meta.duration=ticks(5);meta.width=image.width;meta.height=image.height;const c=document.createElement('canvas');c.width=160;c.height=90;c.getContext('2d')!.drawImage(image,0,0,160,90);meta.thumbnail=c.toDataURL('image/jpeg',.65);this.replace(id,{file,image,firstVideo:0});return meta;}
    const input=new Input({formats:ALL_FORMATS,source:new BlobSource(file)});
    try{
      if(!await input.canRead())throw new Error('Contenedor desconocido');
      const video=await input.getPrimaryVideoTrack(),audio=await input.getPrimaryAudioTrack();
      if(!video&&!audio)throw new Error('No hay pistas de audio o video');
      meta.mime=await input.getMimeType();meta.duration=ticks(await input.computeDuration());
      if(!Number.isFinite(meta.duration)||meta.duration<=0)throw new Error('Duración inválida');
      const runtime:RuntimeMedia={file,input,firstVideo:0};
      if(video){if(!await video.canDecode())throw new Error(`El navegador no puede decodificar el video (${await video.getCodec()})`);runtime.canvas=new CanvasSink(video,{poolSize:3});runtime.firstVideo=await video.getFirstTimestamp();const frame=await runtime.canvas.getCanvas(runtime.firstVideo);if(!frame)throw new Error('No se pudo decodificar el primer fotograma');meta.width=video.displayWidth;meta.height=video.displayHeight;const c=document.createElement('canvas');c.width=160;c.height=90;c.getContext('2d')!.drawImage(frame.canvas,0,0,160,90);meta.thumbnail=c.toDataURL('image/jpeg',.7);}else meta.kind='audio';
      if(audio){if(!await audio.canDecode())throw new Error(`El navegador no puede decodificar el audio (${await audio.getCodec()})`);const rate=audio.sampleRate;const duration=await input.computeDuration();const length=Math.ceil(duration*rate);const count=Math.min(2,audio.numberOfChannels);const bytes=length*count*4;if(bytes+this.pcmBytes>256*1024*1024)throw new Error('El audio descomprimido excede el límite local de 256 MB. Usa archivos más cortos.');const channels=Array.from({length:count},()=>new Float32Array(length));let decoded=false;for await(const {buffer,timestamp} of new AudioBufferSink(audio).buffers()){decoded=true;const offset=Math.round(timestamp*rate);for(let ch=0;ch<count;ch++){const data=buffer.getChannelData(Math.min(ch,buffer.numberOfChannels-1));const from=Math.max(0,-offset),to=Math.min(data.length,length-offset);if(to>from)channels[ch].set(data.subarray(from,to),Math.max(0,offset));}}if(!decoded)throw new Error('No se pudo decodificar el audio');runtime.pcm={channels,sampleRate:rate};meta.hasAudio=true;meta.channelPeaks=channels.map(channel=>peakBuckets(channel));meta.peaks=meta.channelPeaks[0];}
      this.replace(id,runtime);return meta;
    }catch(error){input.dispose();throw new Error(`${file.name}: ${error instanceof Error?error.message:'no se pudo leer'}. Prueba convertirlo a MP4 H.264/AAC o WebM VP9/Opus.`);}
  }
  replace(id:string,value:RuntimeMedia){const old=this.items.get(id);if(old){old.input?.dispose();old.image?.close();this.pcmBytes-=old.pcm?.channels.reduce((n,c)=>n+c.byteLength,0)||0;}this.items.set(id,value);this.pcmBytes+=value.pcm?.channels.reduce((n,c)=>n+c.byteLength,0)||0;}
}
