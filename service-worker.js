// Bump CACHE_VERSION on every deploy that changes cached assets.
const CACHE_VERSION = 'v26';
const CACHE_PREFIX = 'hockeydashboard-';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
// Caches created by earlier releases of this dashboard before the prefix change.
const LEGACY_CACHE_PREFIX = 'hockey-dashboard-static-';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './pwa.js',
  './styles.css',
  './app.js',
  './draftAuctionUI.js',
  './draftIntelligence.js',
  './draftIqV2.js',
  './draftIqV3.js',
  './poolGames.js',
  './fairPrice.js',
  './ahlSheetIngestion.js',
  './teamMonies.js',
  './ahlHistoricalBids.js',
  './personalDraftList.js',
  './offlineSnapshotStore.js',
  './localDraftEdits.js',
  './dobberIngestion.js',
  './forecastedStats.js',
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
  './data/nhl-snapshot.json',
  './data/ahl-historical-bids.json',
  './data/dobberhockeydraftlist202627.xlsx',
  './data/dobberhockey202627fantasyguide.pdf',
  './data/dobberhockey202627fantasyprospectsreport.pdf',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // `reload` bypasses the HTTP cache so a new version never pre-caches stale files.
      .then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME && (
            cacheName.startsWith(CACHE_PREFIX) || cacheName.startsWith(LEGACY_CACHE_PREFIX)
          ))
          .map((cacheName) => caches.delete(cacheName)),
      ))
      .then(() => self.clients.claim()),
  );
});

async function cacheFreshResponse(request, response) {
  if (!response.ok || response.type === 'opaque') return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response);
  } catch (error) {
    console.warn('Dashboard cache update failed', error);
  }
}

async function networkFirst(event) {
  const { request } = event;
  try {
    // `no-cache` revalidates with the server so a reload always gets the deployed bundle.
    const response = await fetch(request, { cache: 'no-cache' });
    event.waitUntil(cacheFreshResponse(request, response.clone()));
    return response;
  } catch (error) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const appShell = await cache.match('./index.html');
      if (appShell) return appShell;
    }
    throw new Error(`Offline resource is not cached: ${new URL(request.url).pathname}`, { cause: error });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(networkFirst(event));
});
