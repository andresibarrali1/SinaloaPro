'use client';
// Pantalla de confirmación que aparece en cuanto termina un renderizado: dice qué archivo quedó, con
// qué tamaño y duración, deja volver a descargarlo y da la ruta de la carpeta de descargas para pegar
// en el Finder o el Explorador. Suena una campana corta, que se puede silenciar y queda recordada.
//
// No abre la carpeta: los navegadores no exponen esa capacidad a una página. En su lugar da la ruta
// exacta y el atajo de teclado del sistema para llegar a ella, que es lo que de verdad sirve.
import { useEffect, useMemo, useRef, useState } from 'react';
import { FOLDER_NOTE, downloadsFolder, fileLocation, renderDetails, renderTitle, type RenderOutcome } from '@/lib/editor/render-success';
import { confirmationSoundEnabled, playConfirmation, setConfirmationSoundEnabled } from '@/lib/editor/confirm-sound';

function platformName(): string {
  const scope = globalThis as { navigator?: { userAgentData?: { platform?: string }; platform?: string } };
  const raw = scope.navigator?.userAgentData?.platform ?? scope.navigator?.platform ?? '';
  const value = raw.toLowerCase();
  if (value.includes('win')) return 'win32';
  if (value.includes('mac')) return 'darwin';
  return 'linux';
}

export type RenderSuccessProps = {
  outcome: RenderOutcome;
  /** Vuelve a descargar el archivo que acaba de renderizarse. Sin él (un lote), no se ofrece el botón. */
  onDownloadAgain?: () => void;
  onClose: () => void;
};

export function RenderSuccess({ outcome, onDownloadAgain, onClose }: RenderSuccessProps) {
  const [sonido, setSonido] = useState(() => confirmationSoundEnabled());
  const [copiado, setCopiado] = useState<'listo' | 'error' | null>(null);
  const cerrar = useRef<HTMLButtonElement>(null);
  const platform = useMemo(platformName, []);
  const carpeta = useMemo(() => downloadsFolder(platform), [platform]);
  const ruta = useMemo(() => fileLocation(outcome, platform), [outcome, platform]);
  const detalles = useMemo(() => renderDetails(outcome), [outcome]);

  // La campana suena una sola vez por renderizado, y solo si el usuario no la silenció.
  useEffect(() => {
    if (confirmationSoundEnabled()) playConfirmation();
  }, []);

  useEffect(() => {
    cerrar.current?.focus();
    const escape = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape') return;
      evento.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
  }, [onClose]);

  async function copiarRuta() {
    try {
      await navigator.clipboard.writeText(ruta);
      setCopiado('listo');
    } catch {
      setCopiado('error');
    }
  }

  function alternarSonido(activo: boolean) {
    setSonido(activo);
    setConfirmationSoundEnabled(activo);
    if (activo) playConfirmation();
  }

  return (
    <div className="render-success" role="dialog" aria-modal="true" aria-labelledby="render-success-title" data-testid="render-completado">
      <div className="render-success-card">
        <div className="render-success-check" aria-hidden="true">✓</div>
        <h2 id="render-success-title" className="render-success-title">{renderTitle(outcome)}</h2>
        <p className="render-success-file"><code>{outcome.fileName}</code></p>
        <ul className="render-success-details">
          {detalles.map((linea) => <li key={linea}>{linea}</li>)}
        </ul>

        <section className="render-success-folder" aria-label="Carpeta de descargas">
          <p><strong>Está en tu carpeta {carpeta.label}</strong></p>
          <p className="render-success-path"><code>{ruta}</code></p>
          <p className="render-success-hint">{carpeta.hint}</p>
          <p className="render-success-note">{FOLDER_NOTE}</p>
          <button type="button" className="render-success-copy" onClick={() => void copiarRuta()}>
            {copiado === 'listo' ? 'Ruta copiada' : copiado === 'error' ? 'No se pudo copiar' : 'Copiar la ruta'}
          </button>
        </section>

        <label className="render-success-sound">
          <input type="checkbox" checked={sonido} onChange={(evento) => alternarSonido(evento.target.checked)} />
          Sonido de confirmación
        </label>

        <div className="render-success-actions">
          {onDownloadAgain && <button type="button" onClick={onDownloadAgain}>Descargar otra vez</button>}
          <button type="button" ref={cerrar} onClick={onClose}>Seguir editando</button>
        </div>
      </div>
    </div>
  );
}
