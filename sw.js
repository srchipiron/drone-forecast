// Instalador: la app abre sin cobertura con la última previsión guardada.
// La cáscara se sirve de caché; data/*.json, red primero. Las APIs de fuera
// (Open-Meteo, NOAA) no se tocan aquí: su respaldo es la caché de almacen.js.

const VERSION = '0.14.0';
const CACHE = `drone-forecast-${VERSION}`;
const CASCARA = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'icons/icono.svg',
  'icons/icono-192.png',
  'icons/icono-512.png',
  'src/version.js',
  'src/app/almacen.js',
  'src/app/aviso.js',
  'src/app/datos.js',
  'src/app/main.js',
  'src/app/mapa.js',
  'src/app/ubicacion.js',
  'src/motor/astro.js',
  'src/motor/aviso.js',
  'src/motor/cielo.js',
  'src/motor/compartir.js',
  'src/motor/diagnostico.js',
  'src/motor/diario.js',
  'src/motor/drones.js',
  'src/motor/enaire.js',
  'src/motor/factores.js',
  'src/motor/mapa.js',
  'src/motor/grafica.js',
  'src/motor/kp.js',
  'src/motor/meteo.js',
  'src/motor/misiones.js',
  'src/motor/prevision.js',
  'src/motor/satelites.js',
  'src/motor/unidades.js',
  'src/motor/veredicto.js',
  'src/motor/ventanas.js',
  'src/motor/viento.js',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' salta la caché HTTP de Pages (10 min): si no, dos
  // despliegues seguidos podían mezclar ficheros de dos versiones.
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(CASCARA.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('drone-forecast-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.includes('/data/')) {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copia = r.clone();
          if (r.ok) caches.open(CACHE).then((c) => c.put(e.request, copia));
          return r;
        })
        .catch(() => caches.match(e.request)),
    );
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r ?? fetch(e.request)));
});
