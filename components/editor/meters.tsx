'use client';
// Panel de medidores del maestro, con su propio almacén.
//
// Está separado del editor por rendimiento: durante la reproducción la lectura cambia en cada fotograma y, si
// viviera en el estado del editor, cada fotograma volvería a renderizar la línea de tiempo entera. Aquí se
// suscribe al almacén (`useSyncExternalStore`), así que solo se repinta este panel.
import { useSyncExternalStore } from 'react';
import { Volume2 } from 'lucide-react';
import { formatDb, formatLufs } from '@/lib/editor/meter';
import type { MeterStore } from '@/lib/editor/meter-store';

export function Meters({ store, width }: { store: MeterStore; width: number }) {
  const meter = useSyncExternalStore(store.subscribe, store.get, store.get);
  return (
    <aside className="meters" style={{ width }} aria-label="Medidores de audio del maestro">
      <span>Master</span>
      <div className="meter-scale">
        {[0, 1].map(channel => (
          <div className="meter-bar" key={channel} title={channel === 0 ? 'Izquierda' : 'Derecha'}>
            <i style={{ height: `${Math.max(0, Math.min(100, (meter.peakDb + 60) / 60 * 100))}%` }} />
          </div>
        ))}
        <div className="db-labels"><span>0</span><span>−12</span><span>−24</span><span>−48</span></div>
      </div>
      <Volume2 size={14} />
      <small>Pico {formatDb(meter.peakDb)} dBFS · real {formatDb(meter.truePeakDb)}<br />RMS {formatDb(meter.rmsDb)} dBFS · sonoridad {formatLufs(meter.loudnessLufs)} LUFS</small>
      <span className={`clip-light ${meter.clipped ? 'lit' : ''}`} title="Señal al fondo de escala: el limitador la sujeta, pero conviene bajar el nivel">{meter.clipped ? 'RECORTE' : 'OK'}</span>
      <small className="meter-note">Sonoridad según ITU-R BS.1770 con las puertas de EBU R128 (aproximación: ver README §9).</small>
    </aside>
  );
}
