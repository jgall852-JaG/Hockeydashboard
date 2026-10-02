import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
const ORIGIN = 'https://jgall852-jag.github.io';
const SCOPE = `${ORIGIN}/Hockeydashboard/`;

function createResponse(body, { ok = true, type = 'basic' } = {}) {
  return { body, ok, type, clone() { return createResponse(body, { ok, type }); } };
}

function loadServiceWorker({ fetchImpl, existingCaches = [] }) {
  const listeners = {};
  const stores = new Map(existingCaches.map((name) => [name, new Map()]));
  const keyOf = (request) => {
    const url = new URL(typeof request === 'string' ? request : request.url, SCOPE);
    return `${url.origin}${url.pathname}`;
  };
  const openStore = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return {
      put: async (request, response) => { store.set(keyOf(request), response); },
      match: async (request) => store.get(keyOf(request)),
      addAll: async (requests) => { requests.forEach((request) => store.set(keyOf(request), createResponse(`precached ${keyOf(request)}`))); },
    };
  };
  const self = {
    location: new URL(`${SCOPE}service-worker.js`),
    addEventListener: (type, handler) => { listeners[type] = handler; },
    skipWaiting: jest.fn(async () => {}),
    clients: { claim: jest.fn(async () => {}) },
  };
  const fetchMock = jest.fn(fetchImpl);
  vm.runInNewContext(source, {
    self,
    caches: {
      open: async (name) => openStore(name),
      keys: async () => [...stores.keys()],
      delete: async (name) => stores.delete(name),
    },
    fetch: fetchMock,
    Request: class { constructor(url, init = {}) { this.url = new URL(url, SCOPE).href; this.cache = init.cache; } },
    URL,
    Promise,
    Error,
    console,
  });
  const dispatch = async (type, extra = {}) => {
    const pending = [];
    let responded = null;
    const event = {
      ...extra,
      waitUntil: (promise) => pending.push(promise),
      respondWith: (promise) => { responded = promise; },
    };
    listeners[type](event);
    const response = responded ? await responded : undefined;
    await Promise.all(pending);
    return { response, responded: Boolean(responded) };
  };
  return { dispatch, stores, fetchMock };
}

const getRequest = (path, init = {}) => ({ url: new URL(path, SCOPE).href, method: 'GET', mode: 'cors', ...init });

describe('service worker caching', () => {
  test('serves fresh network JavaScript and refreshes the versioned cache', async () => {
    const sw = loadServiceWorker({ fetchImpl: async () => createResponse('new bundle') });
    await sw.dispatch('install');
    expect([...sw.stores.keys()]).toEqual(['hockeydashboard-v26']);
    expect(sw.stores.get('hockeydashboard-v26').has(`${SCOPE}app.js`)).toBe(true);

    const { response } = await sw.dispatch('fetch', { request: getRequest('./app.js') });
    expect(response.body).toBe('new bundle');
    expect(sw.fetchMock).toHaveBeenCalledWith(expect.objectContaining({ url: `${SCOPE}app.js` }), { cache: 'no-cache' });
    expect(sw.stores.get('hockeydashboard-v26').get(`${SCOPE}app.js`).body).toBe('new bundle');
  });

  test('pre-caches GitHub Pages relative paths without consulting the HTTP cache', async () => {
    const sw = loadServiceWorker({ fetchImpl: async () => createResponse('unused') });
    await sw.dispatch('install');
    const cachedUrls = [...sw.stores.get('hockeydashboard-v26').keys()];
    expect(cachedUrls).toContain(`${SCOPE}index.html`);
    expect(cachedUrls).toContain(`${SCOPE}draftIqV2.js`);
    expect(cachedUrls).toContain(`${SCOPE}draftIqV3.js`);
    expect(cachedUrls).toContain(`${SCOPE}poolGames.js`);
    expect(cachedUrls).toContain(`${SCOPE}fairPrice.js`);
    expect(cachedUrls.every((url) => url.startsWith(SCOPE))).toBe(true);
    expect(source).not.toMatch(/['"]\/(?:app|index)\b/);
    expect(source).toContain("cache: 'reload'");
  });

  test('falls back to the current cache offline and to index.html for navigation', async () => {
    const sw = loadServiceWorker({ fetchImpl: async () => { throw new TypeError('offline'); } });
    await sw.dispatch('install');

    const asset = await sw.dispatch('fetch', { request: getRequest('./draftAuctionUI.js') });
    expect(asset.response.body).toBe(`precached ${SCOPE}draftAuctionUI.js`);

    const navigation = await sw.dispatch('fetch', { request: getRequest('./owners/unknown', { mode: 'navigate' }) });
    expect(navigation.response.body).toBe(`precached ${SCOPE}index.html`);

    await expect(sw.dispatch('fetch', { request: getRequest('./missing.js') })).rejects.toThrow('Offline resource is not cached');
  });

  test('does not intercept non-GET or cross-origin requests', async () => {
    const sw = loadServiceWorker({ fetchImpl: async () => createResponse('network') });
    expect((await sw.dispatch('fetch', { request: getRequest('./app.js', { method: 'POST' }) })).responded).toBe(false);
    expect((await sw.dispatch('fetch', { request: { url: 'https://docs.google.com/spreadsheets/x', method: 'GET', mode: 'cors' } })).responded).toBe(false);
    expect(sw.fetchMock).not.toHaveBeenCalled();
  });

  test('activation deletes only stale dashboard caches', async () => {
    const sw = loadServiceWorker({
      fetchImpl: async () => createResponse('network'),
      existingCaches: ['hockeydashboard-v25', 'hockey-dashboard-static-v16', 'hockeydashboard-v26', 'other-app-v1'],
    });
    await sw.dispatch('activate');
    expect([...sw.stores.keys()].sort()).toEqual(['hockeydashboard-v26', 'other-app-v1']);
  });

  test('does not cache failed responses', async () => {
    const sw = loadServiceWorker({ fetchImpl: async () => createResponse('server error', { ok: false }) });
    const { response } = await sw.dispatch('fetch', { request: getRequest('./app.js') });
    expect(response.body).toBe('server error');
    expect(sw.stores.get('hockeydashboard-v26')?.has(`${SCOPE}app.js`) || false).toBe(false);
  });
});
