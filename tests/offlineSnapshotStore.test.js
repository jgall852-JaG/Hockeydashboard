import { loadAhlSnapshot, saveAhlSnapshot } from '../offlineSnapshotStore.js';

function createIndexedDbMock() {
  const records = new Map();
  let objectStoreCreated = false;
  const database = {
    objectStoreNames: { contains: () => objectStoreCreated },
    createObjectStore: () => {
      objectStoreCreated = true;
    },
    transaction: () => {
      const transaction = { oncomplete: null, onerror: null, onabort: null };
      transaction.objectStore = () => ({
        put: (value, key) => {
          records.set(key, value);
          queueMicrotask(() => transaction.oncomplete?.());
        },
        get: (key) => {
          const request = { result: undefined, onsuccess: null, onerror: null };
          queueMicrotask(() => {
            request.result = records.get(key);
            request.onsuccess?.();
            transaction.oncomplete?.();
          });
          return request;
        },
      });
      return transaction;
    },
    close: () => {},
  };
  return {
    open: () => {
      const request = { result: database, onupgradeneeded: null, onsuccess: null, onerror: null };
      queueMicrotask(() => {
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
}

describe('offline AHL snapshot storage', () => {
  const snapshot = {
    datasets: { roster: { players: {} } },
    metadata: { ahlSheets: { status: 'ok', importedAt: '2026-09-29T12:00:00.000Z' } },
    localEdits: {
      removedPlayers: ['player one'],
      manualAssignments: { 'player two': 'TEAM A' },
      manualUnassign: ['player three'],
    },
  };
  const draftIntelligence = Object.fromEntries(
    ['players', 'auction', 'tiers', 'keepers', 'prospects'].map((name) => [name, {}]),
  );

  test('persists the last valid AHL snapshot and all generated JSON views', async () => {
    const indexedDb = createIndexedDbMock();
    await saveAhlSnapshot(snapshot, draftIntelligence, indexedDb);

    const saved = await loadAhlSnapshot(indexedDb);
    expect(saved.snapshot).toEqual(snapshot);
    expect(saved.draftIntelligence).toEqual(draftIntelligence);
    expect(Number.isNaN(Date.parse(saved.savedAt))).toBe(false);
  });

  test('rejects incomplete data instead of caching a success-shaped fallback', async () => {
    await expect(saveAhlSnapshot(snapshot, { players: {} }, createIndexedDbMock()))
      .rejects.toThrow('Draft Intelligence outputs are incomplete');
    await expect(loadAhlSnapshot(undefined))
      .rejects.toThrow('IndexedDB is unavailable');
  });
});
