// Service worker: zorgt dat de app offline werkt.
// BELANGRIJK: verhoog VERSIE bij elke wijziging aan de bestanden hieronder,
// anders blijven gebruikers de oude versie zien.

const VERSIE = 'v2';
const CACHE = `enschede-app-${VERSIE}`;

const APP_SCHIL = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'js/inhoud.js',
  'js/voortgang.js',
  'js/kaart.js',
  'vendor/leaflet/leaflet.js',
  'vendor/leaflet/leaflet.css',
  'content/locaties.json',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/shsel-logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SCHIL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n.startsWith('enschede-app-') && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const verzoek = event.request;
  const url = new URL(verzoek.url);
  // Alleen eigen bestanden; al het andere gaat ongemoeid naar het netwerk.
  if (verzoek.method !== 'GET' || url.origin !== self.location.origin) return;

  // Inhoud: direct uit de cache tonen en op de achtergrond verversen.
  if (url.pathname.endsWith('/content/locaties.json')) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const bewaard = await cache.match(verzoek, { ignoreSearch: true });
        const vers = fetch(verzoek).then((antwoord) => {
          if (antwoord.ok) cache.put(verzoek, antwoord.clone());
          return antwoord;
        }).catch(() => bewaard);
        return bewaard || vers;
      }),
    );
    return;
  }

  // App-schil: eerst cache, anders netwerk; pagina's vallen terug op index.html.
  event.respondWith(
    caches.match(verzoek, { ignoreSearch: true }).then((bewaard) => bewaard || fetch(verzoek).catch(() => {
      if (verzoek.mode === 'navigate') return caches.match('index.html');
      return Response.error();
    })),
  );
});
