import React from 'react';
import {createRoot} from 'react-dom/client';
import Editor from './components/editor/editor';
import './app/globals.css';
import './app/editor.css';
createRoot(document.getElementById('root')!).render(<Editor/>);
// La aplicación se instala en el escritorio y abre en su propia ventana (lo declara public/manifest.webmanifest).
// El service worker es lo que hace que el navegador la ofrezca como aplicación; va en red primero, así que nunca
// sirve una versión vieja del editor.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  });
}

