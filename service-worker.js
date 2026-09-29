const CACHE_NAME = 'hockey-dashboard-static-v3';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './pwa.js',
  './styles.css',
  './app.js',
  './draftAuctionUI.js',
  './draftIntelligence.js',
  './ahlSheetIngestion.js',
  './personalDraftList.js',
  './offlineSnapshotStore.js',
  './dobberIngestion.js',
  './liveNhlApi.js',
  './rosterParser.js',
  './prospectParser.js',
  './veteranParser.js',
  './icons/hockey-dashboard-192.png',
  './icons/hockey-dashboard-512.png',
  './vendor/xlsx.mini.min.js',
  './vendor/pdf.min.mjs',
  './vendor/pdf.worker.min.mjs',
  './data/players.json',
  './data/auction.json',
  './data/tiers.json',
  './data/keepers.json',
  './data/prospects.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith('hockey-dashboard-static-') && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);
  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) return;

  const networkResponse = fetch(request).then(async (response) => {
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  });
  event.waitUntil(networkResponse.then(() => undefined).catch(() => undefined));
  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      return await networkResponse;
    } catch (error) {
      if (request.mode === 'navigate') {
        const appShell = await caches.match('./index.html');
        if (appShell) return appShell;
      }
      throw new Error(`Offline resource is not cached: ${requestUrl.pathname}`, { cause: error });
    }
  })());
});
