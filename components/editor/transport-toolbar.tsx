'use client';
// Barra de herramientas de transporte y edición, copiada de la de Vegas Pro 15 (manual del programa, páginas 28-30):
// los botones de reproducción, grabación y colocación del cursor, las cuatro herramientas de edición y los
// interruptores que documenta el manual (ajuste magnético, fundidos automáticos, rizo, bloqueo de envolventes e
// ignórate la agrupación), más el marcador y la región de la barra de marcadores. Los rótulos traen el atajo real,
// así que la barra y el mapa de teclas no se pueden contradecir.
import { Pause, Play, Repeat2, SkipBack, SkipForward, Square, Magnet, Lock, Flag } from 'lucide-react';
import type { Ripple } from '@/lib/editor/project';
import { TIMELINE_TOOLS, TOOL_LABEL, TOOL_NOTE, type TimelineTool } from '@/lib/editor/timeline-tools';
import { shortcutLabel } from '@/lib/editor/shortcuts';
import { Choice } from './controls';

const trazo = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

// Iconos con las formas de Vegas: los dos fotogramas son el triángulo con las barras, el fundido automático son dos
// triángulos solapados y el rizo es la barra que se lleva lo de delante.
const IconoFotograma = ({ atras }: { atras: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
    <g {...trazo} transform={atras ? undefined : 'translate(16 0) scale(-1 1)'}>
      <path d="M3 3v10M6 8l5-5v10z" />
      <path d="M13 3v10M8 4.5v7" opacity="0.55" />
    </g>
  </svg>
);
const IconoPlayDesdeInicio = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
    <g {...trazo}><path d="M4 3v10" /><path d="M6.5 8 13 3.5v9z" fill="currentColor" stroke="none" /></g>
  </svg>
);
const IconoHerramienta = ({ tool }: { tool: TimelineTool }) => {
  if (tool === 'normal')
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 2.2 12.4 8.1 8.6 9.3l1.6 4.4-1.8.7-1.7-4.5-2.9 2.6z" fill="currentColor" />
      </svg>
    );
  if (tool === 'envelope')
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <g {...trazo}><path d="M2 12 6 4l4 8 4-6" /><circle cx="6" cy="4" r="1.4" fill="currentColor" /><circle cx="10" cy="12" r="1.4" fill="currentColor" /></g>
      </svg>
    );
  if (tool === 'selection')
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <g {...trazo} strokeDasharray="2 1.6"><rect x="1.6" y="1.6" width="9" height="7.2" rx="0.6" /></g>
        <path d="M8 8.4 14.2 12l-2.6.8 1 2.2-1.5.7-1-2.3-1.7 1.7z" fill="currentColor" />
      </svg>
    );
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <g {...trazo} strokeDasharray="2 1.6"><rect x="1.6" y="2.2" width="8" height="6.4" rx="0.6" /></g>
      <g {...trazo}><circle cx="10" cy="10" r="3.2" /><path d="m12.4 12.4 2.4 2.4" /></g>
    </svg>
  );
};
const IconoFundidos = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <rect x="1" y="1.6" width="14" height="12.8" rx="0.8" fill="#2f6f9a" />
    <path d="M2 12.6 7.4 3.4v9.2z" fill="#e8f4fb" />
    <path d="M14 3.4 8.6 12.6V3.4z" fill="#9fd0ea" />
    <path d="M2 12.6 7.4 3.4M8.6 12.6 14 3.4" fill="none" stroke="#173245" strokeWidth="0.8" />
  </svg>
);
const IconoRizo = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <g {...trazo}><path d="M2 1.8v12.4" /><path d="M6 5h6" /><path d="m10 2.6 3 2.4-3 2.4" /><path d="M6 11h6" opacity="0.5" /></g>
  </svg>
);
const IconoIgnorarGrupos = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <rect x="1.6" y="3" width="7" height="10" rx="0.7" {...trazo} />
    <path d="M9.6 6.4h3.6M9.6 9.6h3.6" stroke="#e2564a" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M12 4.6 14.6 6.4 12 8.2M12 7.8l2.6 1.8L12 11.4" fill="none" stroke="#e2564a" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);
const IconoCuantizar = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <g {...trazo}><rect x="1.6" y="1.6" width="12.8" height="12.8" rx="0.8" /><path d="M1.6 5.6h12.8M1.6 10.4h12.8M5.6 1.6v12.8M10.4 1.6v12.8" opacity="0.8" /><path d="M6.6 8.6 9.4 6v5z" fill="currentColor" stroke="none" /></g>
  </svg>
);

export type TransportToolbarProps = {
  playing: boolean;
  loop: boolean;
  canPlay: boolean;
  tool: TimelineTool;
  snap: boolean;
  crossfades: boolean;
  ripple: Ripple;
  lockEnvelopes: boolean;
  ignoreGrouping: boolean;
  quantize: boolean;
  hasLoopRegion: boolean;
  // El manual pide preparar las pistas para grabar; aquí la grabación todavía no existe y el botón se explica solo.
  recordNote: string | null;
  // Herramienta normal con su menú (la flecha de al lado, como en Vegas): se abre con el mismo patrón que la barra.
  toolMenuOpen: boolean;
  onToggleToolMenu: (open: boolean) => void;
  onRecord: () => void;
  onToggleLoop: () => void;
  onPlayFromStart: () => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onStart: () => void;
  onEnd: () => void;
  onPreviousFrame: () => void;
  onNextFrame: () => void;
  onTool: (tool: TimelineTool) => void;
  onToggleSnap: () => void;
  onToggleCrossfades: () => void;
  onRipple: (mode: Ripple) => void;
  onToggleLockEnvelopes: () => void;
  onToggleIgnoreGrouping: () => void;
  onToggleQuantize: () => void;
  onAddMarker: () => void;
  onAddRegion: () => void;
};

export function TransportToolbar({
  playing,
  loop,
  canPlay,
  tool,
  snap,
  crossfades,
  ripple,
  lockEnvelopes,
  ignoreGrouping,
  quantize,
  hasLoopRegion,
  recordNote,
  toolMenuOpen,
  onToggleToolMenu,
  onRecord,
  onToggleLoop,
  onPlayFromStart,
  onPlay,
  onPause,
  onStop,
  onStart,
  onEnd,
  onPreviousFrame,
  onNextFrame,
  onTool,
  onToggleSnap,
  onToggleCrossfades,
  onRipple,
  onToggleLockEnvelopes,
  onToggleIgnoreGrouping,
  onToggleQuantize,
  onAddMarker,
  onAddRegion,
}: TransportToolbarProps) {
  const boton = (nombre: string, atajo: string, accion: () => void, contenido: React.ReactNode, opciones: { activo?: boolean; deshabilitado?: boolean; nota?: string } = {}) => (
    <button
      type="button"
      className={`tool ${opciones.activo ? 'active' : ''}`}
      title={[atajo ? `${nombre} (${atajo})` : nombre, opciones.nota].filter(Boolean).join(' · ')}
      aria-label={nombre}
      aria-pressed={opciones.activo || undefined}
      disabled={opciones.deshabilitado}
      onClick={accion}
    >
      {contenido}
    </button>
  );
  return (
    <div className="vegas-toolbar" role="toolbar" aria-label="Barra de transporte y edición">
      <div className="toolbar-group" aria-label="Reproducción y grabación">
        {boton('Grabar', '', onRecord, <Mic />, { deshabilitado: Boolean(recordNote), nota: `En Vegas es Ctrl+R; ${recordNote}` })}
        {boton('Reproducir en bucle', shortcutLabel('loop'), onToggleLoop, <Repeat2 />, { activo: loop })}
        {boton('Reproducir desde el inicio', shortcutLabel('playAll'), onPlayFromStart, <IconoPlayDesdeInicio />, { deshabilitado: !canPlay })}
        {boton('Reproducir', shortcutLabel('transport'), onPlay, <Play size={15} fill="currentColor" />, { deshabilitado: !canPlay, activo: playing })}
        {boton('Pausa', shortcutLabel('playPause'), onPause, <Pause size={15} />, { deshabilitado: !playing })}
        {boton('Detener', shortcutLabel('stop'), onStop, <Square size={14} fill="currentColor" />, { deshabilitado: !playing })}
        {boton('Ir al inicio', shortcutLabel('start'), onStart, <SkipBack size={15} />)}
        {boton('Ir al final', shortcutLabel('end'), onEnd, <SkipForward size={15} />)}
        {boton('Fotograma anterior', shortcutLabel('frameLeft'), onPreviousFrame, <IconoFotograma atras />)}
        {boton('Fotograma siguiente', shortcutLabel('frameRight'), onNextFrame, <IconoFotograma atras={false} />)}
      </div>
      <span className="toolbar-sep" />
      <div className="toolbar-group" aria-label="Herramientas de edición">
        <div className="tool-with-menu">
          {boton(TOOL_LABEL.normal, shortcutLabel('toolNormal'), () => onTool('normal'), <IconoHerramienta tool="normal" />, { activo: tool === 'normal' })}
          <button
            type="button"
            className="tool-caret"
            aria-label="Elegir herramienta de edición"
            aria-expanded={toolMenuOpen}
            title="Elegir herramienta de edición"
            onClick={() => onToggleToolMenu(!toolMenuOpen)}
          >
            ▾
          </button>
          {toolMenuOpen && (
            <div className="tool-menu" role="menu">
              {TIMELINE_TOOLS.map((opcion) => (
                <button key={opcion} type="button" role="menuitemradio" aria-checked={tool === opcion} className={tool === opcion ? 'active' : ''} title={TOOL_NOTE[opcion]} onClick={() => onTool(opcion)}>
                  <IconoHerramienta tool={opcion} />
                  <span>{TOOL_LABEL[opcion]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {boton(TOOL_LABEL.envelope, shortcutLabel('toolEnvelope'), () => onTool('envelope'), <IconoHerramienta tool="envelope" />, { activo: tool === 'envelope' })}
        {boton(TOOL_LABEL.selection, shortcutLabel('toolSelection'), () => onTool('selection'), <IconoHerramienta tool="selection" />, { activo: tool === 'selection' })}
        {boton(TOOL_LABEL.zoom, shortcutLabel('toolZoom'), () => onTool('zoom'), <IconoHerramienta tool="zoom" />, { activo: tool === 'zoom' })}
      </div>
      <span className="toolbar-sep" />
      <div className="toolbar-group" aria-label="Ajustes de edición">
        {boton('Ajuste magnético', shortcutLabel('snap'), onToggleSnap, <Magnet size={15} />, { activo: snap })}
        {boton('Fundidos automáticos', shortcutLabel('crossfades'), onToggleCrossfades, <IconoFundidos />, { activo: crossfades })}
        <div className="toolbar-choice" title={`Rizo posterior a la edición (${shortcutLabel('ripple')})`}>
          <IconoRizo />
          <Choice
            label="Modo de rizo"
            value={ripple}
            onChange={(valor) => onRipple(valor as Ripple)}
            items={[
              ['off', 'Rizo: desactivado'],
              ['track', 'Rizo: pistas afectadas'],
              ['all', 'Rizo: todas + marcadores'],
            ]}
          />
        </div>
        {boton('Bloquear envolventes a los eventos', shortcutLabel('lockEnvelopes'), onToggleLockEnvelopes, <Lock size={14} />, { activo: lockEnvelopes })}
        {boton('Ignorar la agrupación de eventos', shortcutLabel('ignoreGrouping'), onToggleIgnoreGrouping, <IconoIgnorarGrupos />, { activo: ignoreGrouping })}
        {boton('Cuantizar a fotogramas', shortcutLabel('quantize'), onToggleQuantize, <IconoCuantizar />, { activo: quantize })}
      </div>
      <span className="toolbar-sep" />
      <div className="toolbar-group" aria-label="Marcadores">
        {boton('Insertar marcador', shortcutLabel('marker'), onAddMarker, <Flag size={15} style={{ color: '#e7c14a' }} />)}
        {boton('Insertar región', shortcutLabel('region'), onAddRegion, <IconoRegion />, { deshabilitado: hasLoopRegion })}
      </div>
    </div>
  );
}

const IconoRegion = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
    <g fill="none" stroke="#4fbf74" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2.6 2v12M13.4 2v12" />
      <path d="M2.6 3.2h10.8" strokeWidth="1.2" />
      <path d="M4.6 3.4v9M11.4 3.4v9" strokeWidth="0.8" opacity="0.65" />
    </g>
  </svg>
);
// El icono del micrófono no está en lucide con esta forma, y el del micrófono es el que el manual llama «Grabar».
function Mic() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
      <g {...trazo}><rect x="6" y="1.6" width="4" height="7" rx="2" /><path d="M3.6 7.4a4.4 4.4 0 0 0 8.8 0M8 11.8v2.6M5.6 14.4h4.8" /></g>
    </svg>
  );
}
