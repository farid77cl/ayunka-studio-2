/* Service worker de Ayünka Studio.
 *
 * Estrategia deliberada, distinta a la de la versión anterior:
 *
 *   - El CÓDIGO (html, js, css, json) va por RED PRIMERO. Si hay internet se sirve lo
 *     último y se guarda una copia; si no hay, se sirve la copia. Así un arreglo llega
 *     en la siguiente recarga, siempre, sin depender de que alguien se acuerde de subir
 *     un número. Esto es lo que falló el 1-sep-2026 y costó medio día.
 *   - Las IMÁGENES y fuentes van por CACHÉ primero: no cambian y son lo pesado.
 *
 * El nombre del caché sale de js/version.js, que es el único lugar donde vive la versión.
 */
importScripts('./js/version.js');

const CACHE = 'ayunka-' + self.AYUNKA_VERSION;
const BASE = [
  './', './index.html',
  './css/app.css',
  './js/version.js', './js/config.js', './js/db.js', './js/costos.js',
  './js/nube.js', './js/supabase.js', './js/lector3mf.js', './js/ui.js', './js/app.js',
  './js/d3d-formas.js', './js/d3d-fuentes.js', './js/d3d-build.js', './js/d3d-3mf.js',
  './js/catalogo.js',
  './js/impresora.js',
  './js/vistas/pendientes.js',
  './js/vistas/productos.js', './js/vistas/filamentos.js', './js/vistas/clientes.js',
  './js/vistas/pedidos.js', './js/vistas/finanzas.js', './js/vistas/cola.js', './js/vistas/cotizar.js',
  './js/vistas/disenos3d.js', './js/vistas/impresora.js', './js/vistas/ajustes.js',
  './datos/semilla.json',
  './manifest.webmanifest'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(BASE.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const ES_IMAGEN = /\.(png|jpe?g|gif|svg|webp|ico|woff2?|ttf)$/i;

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== location.origin) return;   // Firebase, Supabase y fuentes: directo

  if (ES_IMAGEN.test(url.pathname)) {
    // caché primero
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
        const copia = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
        return resp;
      }))
    );
    return;
  }

  // red primero, caché de respaldo
  e.respondWith(
    fetch(e.request)
      .then(resp => {
        const copia = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
        return resp;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
