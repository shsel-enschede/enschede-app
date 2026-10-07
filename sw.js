// Service worker: zorgt dat de app offline werkt.
// BELANGRIJK: verhoog VERSIE bij elke wijziging aan de bestanden hieronder,
// anders blijven gebruikers de oude versie zien.

const VERSIE = 'v23';
const CACHE = `enschede-app-${VERSIE}`;
const FOTO_CACHE = 'enschede-fotos-v1'; // los van VERSIE: foto's blijven bewaard na een update

const APP_SCHIL = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'js/inhoud.js',
  'js/voortgang.js',
  'js/kaart.js',
  'js/gebouwen.js',
  'js/afstand.js',
  'js/locatie.js',
  'js/hulp.js',
  'vendor/leaflet/leaflet.js',
  'vendor/leaflet/leaflet.css',
  'content/locaties.json',
  'content/fotos.json',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-192.png',
  'icons/icon-maskable-512.png',
  'icons/shsel-logo.svg',
  'icons/favicon.ico',
  'icons/apple-touch-icon.png',
  'fonts/sorts-mill-goudy.woff2',
  'img/vesting-motief.svg',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' = altijd vers van de server, niet uit de browsercache (GitHub Pages bewaart bestanden
  // daar 10 minuten). Anders kan een nieuwe versie oude bestanden opslaan.
  const vers = APP_SCHIL.map((pad) => new Request(pad, { cache: 'reload' }));
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(vers)).then(() => self.skipWaiting()));
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
  // Foto's: eerst uit de cache, anders ophalen en bewaren (dan zijn ze offline te zien).
  if (url.pathname.includes('/fotos/')) {
    event.respondWith(
      caches.open(FOTO_CACHE).then(async (cache) => {
        const bewaard = await cache.match(verzoek);
        if (bewaard) return bewaard;
        try {
          const antwoord = await fetch(verzoek);
          if (antwoord.ok) cache.put(verzoek, antwoord.clone());
          return antwoord;
        } catch {
          return Response.error(); // offline: de app verbergt een foto die niet laadt
        }
      }),
    );
    return;
  }

  if (url.pathname.endsWith('/content/locaties.json') || url.pathname.endsWith('/content/fotos.json')) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const bewaard = await cache.match(verzoek, { ignoreSearch: true });
        const vers = fetch(verzoek).then((antwoord) => {
          if (antwoord.ok) cache.put(verzoek, antwoord.clone());
          return antwoord;
        }).catch(() => bewaard || Response.error()); // offline én nog nooit geladen: nette fout i.p.v. een crash
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
