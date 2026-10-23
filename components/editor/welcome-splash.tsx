'use client';
// Ventana de bienvenida de Sinaloa Pro: se abre al arrancar el editor y al crear un proyecto nuevo, y se quita sola a
// los 4 segundos o al pulsar la X (también con Escape). Es informativa: el fondo deja pasar los clics, así que no
// bloquea el trabajo si aparece.
import { useEffect } from 'react';

/** Cuánto tiempo se queda la bienvenida en pantalla antes de irse sola. */
export const BIENVENIDA_MS = 7000;

export function WelcomeSplash({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const temporizador = window.setTimeout(onClose, BIENVENIDA_MS);
    // Escape la cierra igual que la X. Se escucha en captura para que no lo consuma otro atajo del editor.
    const escape = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape') return;
      evento.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', escape, true);
    return () => {
      window.clearTimeout(temporizador);
      window.removeEventListener('keydown', escape, true);
    };
  }, [onClose]);

  return (
    <div className="welcome-splash" role="dialog" aria-modal="false" aria-label="Bienvenida a Sinaloa Pro" data-testid="bienvenida">
      <div className="welcome-card">
        <button type="button" className="welcome-close" aria-label="Cerrar la bienvenida" title="Cerrar la bienvenida (se cierra sola en 7 s)" onClick={onClose}>
          ✕
        </button>
        <img className="welcome-brand" src="/icons/icon-192.png?v=s-pro-3" width="72" height="72" alt="Sinaloa Pro" />
        <h2 className="welcome-title">Sinaloa Pro</h2>
        <p className="welcome-sub">
          Editor de vídeo <strong>gratuito</strong> y de <strong>código abierto</strong> · licencia <strong>GPL-3.0</strong>.
        </p>
        <p className="welcome-credit">
          Hecho con cariño de parte de <span className="welcome-handle">@andresibarrali</span>
        </p>
        <ul className="welcome-tips">
          <li>Arrastra tus vídeos y audios a la línea de tiempo, o suéltalos directamente desde el explorador.</li>
          <li><kbd>Espacio</kbd> reproduce · <kbd>S</kbd> divide · <kbd>Ctrl</kbd>+<kbd>S</kbd> guarda · <kbd>F8</kbd> ajuste.</li>
          <li>La ventana de bienvenida se cierra sola en 7 segundos; puedes seguir trabajando mientras tanto.</li>
        </ul>
        <div className="welcome-timer" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}
