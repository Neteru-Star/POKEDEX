const DB_NAME = 'pokedex-recognition';
const STORE = 'embeddings';

export interface CachedDataset {
  key: string;
  dimension: number;
  classes: Record<string, Float32Array>;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readDataset(key: string): Promise<CachedDataset | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get('dataset');
      request.onsuccess = () => {
        const value = request.result as CachedDataset | undefined;
        resolve(value && value.key === key ? value : null);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function writeDataset(dataset: CachedDataset): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(dataset, 'dataset');
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // sin caché se vuelve a entrenar la próxima vez
  }
}
