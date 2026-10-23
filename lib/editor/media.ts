import { Input, ALL_FORMATS, BlobSource, CanvasSink, AudioBufferSink } from 'mediabunny';
import { Media, ticks, uid } from './project';
import { looksLikeSrt, srtDuration } from './subtitles';
import { peakBuckets } from './waveform';
import { PCM_TOTAL_BUDGET, audioDecimationStep, effectiveSampleRate } from './pcm-budget';
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
      if(audio){if(!await audio.canDecode())throw new Error(`El navegador no puede decodificar el audio (${await audio.getCodec()})`);const pcm=await decodePcmAudio(audio,await input.computeDuration());const bytes=pcm.channels.reduce((n,c)=>n+c.byteLength,0);if(bytes+this.pcmBytes>PCM_TOTAL_BUDGET)throw new Error('El audio de este proyecto ya ocupa demasiada memoria (1 GB). Cierra otros proyectos o divide el trabajo.');runtime.pcm=pcm;meta.hasAudio=true;meta.channelPeaks=pcm.channels.map(canal=>peakBuckets(canal));meta.peaks=meta.channelPeaks[0];}
      this.replace(id,runtime);return meta;
    }catch(error){input.dispose();throw new Error(`${file.name}: ${error instanceof Error?error.message:'no se pudo leer'}. Prueba convertirlo a MP4 H.264/AAC o WebM VP9/Opus.`);}
  }
  replace(id:string,value:RuntimeMedia){const old=this.items.get(id);if(old){old.input?.dispose();old.image?.close();this.pcmBytes-=old.pcm?.channels.reduce((n,c)=>n+c.byteLength,0)||0;}this.items.set(id,value);this.pcmBytes+=value.pcm?.channels.reduce((n,c)=>n+c.byteLength,0)||0;}
}

/**
 * Decodifica el audio entero en memoria para que el mezclador pueda leer cualquier instante. Si el archivo es tan largo
 * que no cabe en el presupuesto, se reduce la frecuencia de muestreo promediando muestras (factor potencia de 2) en vez
 * de rechazarlo: antes un vídeo de más de ~11 minutos en estéreo 48 kHz no se podía importar.
 */
export async function decodePcmAudio(
  audio: NonNullable<Awaited<ReturnType<Input['getPrimaryAudioTrack']>>>,
  duration: number,
): Promise<PCM> {
  const rate = audio.sampleRate;
  const count = Math.min(2, audio.numberOfChannels);
  const step = audioDecimationStep(duration, rate, count);
  const outRate = effectiveSampleRate(rate, step);
  const length = Math.max(1, Math.ceil(duration * outRate));
  const channels = Array.from({ length: count }, () => new Float32Array(length));
  const acc = new Float64Array(count);
  let bucket = -1;
  let muestras = 0;
  let decoded = false;
  const volcar = () => {
    if (bucket >= 0 && muestras > 0 && bucket < length) {
      for (let ch = 0; ch < count; ch++) channels[ch][bucket] = acc[ch] / muestras;
    }
  };
  for await (const { buffer, timestamp } of new AudioBufferSink(audio).buffers()) {
    decoded = true;
    const base = Math.round(timestamp * rate);
    const fuente = Array.from({ length: count }, (_, ch) =>
      buffer.getChannelData(Math.min(ch, buffer.numberOfChannels - 1)),
    );
    for (let i = 0; i < buffer.length; i++) {
      const destino = Math.floor((base + i) / step);
      if (destino >= length) break;
      if (destino !== bucket) {
        volcar();
        bucket = destino;
        acc.fill(0);
        muestras = 0;
      }
      for (let ch = 0; ch < count; ch++) acc[ch] += fuente[ch][i];
      muestras++;
    }
    if (bucket >= length) break;
  }
  volcar();
  if (!decoded) throw new Error('No se pudo decodificar el audio');
  return { channels, sampleRate: outRate };
}
