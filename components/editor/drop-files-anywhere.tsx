'use client';
// Soltar archivos en cualquier punto de la ventana.
//
// Los destinos con manejador propio (la línea de tiempo, la lista de medios) ya atienden el soltado. Este componente se
// ocupa del resto: diálogos, menús y la bienvenida se dibujan en portales fuera del editor, así que un archivo soltado
// encima no llegaba a ningún manejador y **no pasaba nada** (era el caso de la aplicación instalada). También se
// cancela el comportamiento del navegador, que si no abre el archivo y te saca de la aplicación.
import { useEffect, useRef } from 'react';

export type DropFilesAnywhereProps = {
  /** Se llama con los archivos soltados cuando ningún destino los atendió. */
  onArchivos: (archivos: File[]) => void;
  /** Avisa de que hay archivos arrastrándose sobre la ventana, para enseñar el aviso. */
  onArrastrando: (arrastrando: boolean) => void;
};

const conArchivos = (evento: DragEvent) => {
  const datos = evento.dataTransfer;
  return Boolean(datos && Array.from(datos.types).includes('Files'));
};

export function DropFilesAnywhere({ onArchivos, onArrastrando }: DropFilesAnywhereProps) {
  // Las llamadas se guardan en referencias: así los oyentes se registran una sola vez y no se quedan con el cierre de
  // un repintado viejo.
  const archivos = useRef(onArchivos);
  const arrastrando = useRef(onArrastrando);
  useEffect(() => {
    archivos.current = onArchivos;
    arrastrando.current = onArrastrando;
  });

  useEffect(() => {
    const alEntrar = (evento: DragEvent) => {
      if (!conArchivos(evento)) return;
      evento.preventDefault();
      arrastrando.current(true);
    };
    const alArrastrar = (evento: DragEvent) => {
      if (!conArchivos(evento)) return;
      evento.preventDefault();
      if (evento.dataTransfer) evento.dataTransfer.dropEffect = 'copy';
      arrastrando.current(true);
    };
    const alSalir = (evento: DragEvent) => {
      if (evento.relatedTarget === null) arrastrando.current(false);
    };
    const apagarAviso = () => arrastrando.current(false);
    const alSoltar = (evento: DragEvent) => {
      if (!conArchivos(evento)) return;
      // Si un destino con manejador propio ya lo atendió, no se importa dos veces.
      const loTratoOtro = evento.defaultPrevented;
      evento.preventDefault();
      arrastrando.current(false);
      if (loTratoOtro) return;
      const lista = evento.dataTransfer?.files;
      if (lista?.length) archivos.current(Array.from(lista));
    };
    window.addEventListener('dragenter', alEntrar);
    window.addEventListener('dragover', alArrastrar);
    window.addEventListener('dragleave', alSalir);
    window.addEventListener('drop', alSoltar);
    // El aviso se apaga también cuando un destino corta la propagación (la línea de tiempo lo hace) para que no se
    // quede pegado en pantalla.
    window.addEventListener('drop', apagarAviso, true);
    window.addEventListener('dragend', apagarAviso, true);
    return () => {
      window.removeEventListener('dragenter', alEntrar);
      window.removeEventListener('dragover', alArrastrar);
      window.removeEventListener('dragleave', alSalir);
      window.removeEventListener('drop', alSoltar);
      window.removeEventListener('drop', apagarAviso, true);
      window.removeEventListener('dragend', apagarAviso, true);
    };
  }, []);

  return null;
}
