from pathlib import Path
r=Path(r'C:/Users/jesus/Downloads/DeepSeek Pruebas/Corte15')
p=r/'lib/editor/project.ts';s=p.read_text(encoding='utf-8').replace('peaks?: number[];','peaks?: number[]; channelPeaks?: number[][];',1);p.write_text(s,encoding='utf-8')
p=r/'lib/editor/validation.ts';s=p.read_text(encoding='utf-8').replace('peaks:z.array(finite.min(0).max(1)).optional(),','peaks:z.array(finite.min(0).max(1)).optional(),channelPeaks:z.array(z.array(finite.min(0).max(1))).min(1).max(2).optional(),',1);p.write_text(s,encoding='utf-8')
p=r/'lib/editor/media.ts';s=p.read_text(encoding='utf-8').replace('meta.peaks=peakBuckets(channels[0]);','meta.channelPeaks=channels.map(channel=>peakBuckets(channel));meta.peaks=meta.channelPeaks[0];',1);p.write_text(s,encoding='utf-8')
p=r/'components/editor/editor.tsx';s=p.read_text(encoding='utf-8').replace("e.kind==='audio'&&m?.peaks?", "e.kind==='audio'&&m?",1).replace('samples={library.current.items.get(m.id)?.pcm?.channels[0]}','channels={library.current.items.get(m.id)?.pcm?.channels}',1);p.write_text(s,encoding='utf-8')
p=r/'components/editor/audio-waveform.tsx';s=p.read_text(encoding='utf-8');s=s.replace("import { memo", "import {indexedPeakColumns} from '@/lib/editor/waveform-index';\nimport { memo",1);s=s.replace('  samples?: Float32Array;', '  channels?: Float32Array[];\n  samples?: Float32Array;',1);s=s.replace('width, samples, sampleRate,','width, channels, samples, sampleRate,',1)
a=s.index('  const waveform = useMemo(');b=s.index('\n});',a)
s=s[:a]+'''  const waveforms = useMemo(()=>{
    const countChannels=channels?.length??media.channelPeaks?.length??1;
    return Array.from({length:Math.min(2,countChannels)},(_,channel)=>{
      const pcm=channels?.[channel]??(channel===0?samples:undefined);
      if(pcm&&sampleRate){const values=indexedPeakColumns(pcm,sampleRate,range.from,range.to,count);return {values:reversedWave?values.reverse():values,source:'pcm' as const};}
      return waveformFor({peaks:media.channelPeaks?.[channel]??(channel===0?media.peaks:undefined),duration:seconds(media.duration),from:range.from,to:range.to,columns:count,reversed:reversedWave});
    }).filter((wave):wave is NonNullable<typeof wave>=>Boolean(wave));
  },[channels,samples,sampleRate,media.channelPeaks,media.peaks,media.duration,range.from,range.to,count,reversedWave]);
  if(!waveforms.length)return <span className="waveform-unavailable">Sin datos de onda</span>;
  return <svg className="audio-wave" viewBox={`0 0 ${waveforms[0].values.length} ${100*waveforms.length}`} preserveAspectRatio="none" role="img" aria-label={`${label} · ${waveforms.length===2?'estéreo':'mono'}`} data-waveform-columns={waveforms[0].values.length} data-waveform-source={waveforms[0].source} data-waveform-channels={waveforms.length}>
    {waveforms.map((wave,index)=><g key={index} transform={`translate(0 ${index*100})`} data-audio-channel={index}>
      <line className="audio-wave-center" x1="0" y1="50" x2={wave.values.length} y2="50" vectorEffect="non-scaling-stroke"/>
      <path className="audio-wave-body" d={waveformPath(wave.values)} vectorEffect="non-scaling-stroke"/>
    </g>)}
    {waveforms.length===2&&<line className="audio-wave-divider" x1="0" y1="100" x2={waveforms[0].values.length} y2="100" vectorEffect="non-scaling-stroke"/>}
  </svg>;
''' +s[b:];p.write_text(s,encoding='utf-8')
