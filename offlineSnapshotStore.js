const DATABASE_NAME = 'hockey-dashboard-offline';
const DATABASE_VERSION = 1;
const STORE_NAME = 'snapshots';
const SNAPSHOT_KEY = 'latest-ahl-sheets';

function openDatabase(indexedDb) {
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open offline snapshot storage.'));
    request.onblocked = () => reject(new Error('Offline snapshot storage upgrade is blocked by another tab.'));
  });
}

function validateSnapshot(snapshot) {
  if (
    !snapshot
    || typeof snapshot !== 'object'
    || snapshot.metadata?.ahlSheets?.status !== 'ok'
    || !snapshot.datasets?.roster
  ) {
    throw new Error('Saved offline AHL snapshot has an invalid format.');
  }
  return snapshot;
}

export async function saveAhlSnapshot(snapshot, draftIntelligence, indexedDb = globalThis.indexedDB) {
  if (!indexedDb) throw new Error('IndexedDB is unavailable in this browser.');
  validateSnapshot(snapshot);
  if (
    !draftIntelligence
    || !['players', 'auction', 'tiers', 'keepers', 'prospects']
      .every((name) => draftIntelligence[name] && typeof draftIntelligence[name] === 'object')
  ) {
    throw new Error('Draft Intelligence outputs are incomplete and cannot be saved for offline use.');
  }
  const database = await openDatabase(indexedDb);
  const savedAt = new Date().toISOString();

  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({ savedAt, snapshot, draftIntelligence }, SNAPSHOT_KEY);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Unable to save the offline AHL snapshot.'));
    transaction.onabort = () => reject(transaction.error || new Error('Offline AHL snapshot save was aborted.'));
  }).finally(() => database.close());

  return savedAt;
}

export async function loadAhlSnapshot(indexedDb = globalThis.indexedDB) {
  if (!indexedDb) throw new Error('IndexedDB is unavailable in this browser.');
  const database = await openDatabase(indexedDb);

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(SNAPSHOT_KEY);
    let result = null;
    request.onsuccess = () => {
      try {
        if (request.result) {
          const draftIntelligence = request.result.draftIntelligence;
          if (
            !draftIntelligence
            || !['players', 'auction', 'tiers', 'keepers', 'prospects']
              .every((name) => draftIntelligence[name] && typeof draftIntelligence[name] === 'object')
          ) {
            throw new Error('Saved offline Draft Intelligence outputs are incomplete.');
          }
          result = {
            ...request.result,
            snapshot: validateSnapshot(request.result.snapshot),
          };
        }
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = () => reject(request.error || new Error('Unable to read the offline AHL snapshot.'));
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error || new Error('Unable to read the offline AHL snapshot.'));
    transaction.onabort = () => reject(transaction.error || new Error('Offline AHL snapshot read was aborted.'));
  }).finally(() => database.close());
}
