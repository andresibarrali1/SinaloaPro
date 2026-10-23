// Service worker de Corte 15. Su trabajo aquí es que el navegador ofrezca instalar la aplicación en el escritorio y
// que, sin conexión, la ventana abra al menos el armazón. Va **en red primero**: así nunca sirve una versión vieja del
// editor (esto también corre mientras se desarrolla) y la caché solo se usa cuando la red falla.
const CACHE = 'sinaloa-s-pro-v3';
const ARMAZON = ['/', '/index.html', '/manifest.webmanifest', '/favicon-s-pro-v3.svg', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ARMAZON))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((clave) => clave !== CACHE).map((clave) => caches.delete(clave))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  if (peticion.method !== 'GET') return;
  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return;
  evento.respondWith(
    (async () => {
      try {
        const respuesta = await fetch(peticion);
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(CACHE).then((cache) => cache.put(peticion, copia)).catch(() => undefined);
        }
        return respuesta;
      } catch (error) {
        const guardada = await caches.match(peticion, { ignoreSearch: true });
        if (guardada) return guardada;
        if (peticion.mode === 'navigate') {
          const armazon = await caches.match('/index.html');
          if (armazon) return armazon;
        }
        throw error;
      }
    })(),
  );
});
