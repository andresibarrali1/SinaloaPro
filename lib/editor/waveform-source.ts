import { indexedPeakColumns } from './waveform-index';
import type { PCM } from './media';

// React receives a stable callable, never the millions of enumerable PCM samples.
export type WaveformSourceReader = (from: number, to: number, columns: number) => number[][];
const readers = new WeakMap<PCM, WaveformSourceReader>();
export function waveformSource(pcm?: PCM): WaveformSourceReader | undefined {
  if (!pcm) return undefined;
  let reader = readers.get(pcm);
  if (!reader) {
    reader = (from, to, columns) => pcm.channels.slice(0, 2).map(channel =>
      indexedPeakColumns(channel, pcm.sampleRate, from, to, columns));
    readers.set(pcm, reader);
  }
  return reader;
}
