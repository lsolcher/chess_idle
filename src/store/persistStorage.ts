/** Shared storage resolver for Pinia persist plugins (avoids persistConfig ↔ metaStore cycles). */

let memoryStorage: Storage | null = null

function createMemoryStorage(): Storage {
  const bag = new Map<string, string>()
  return {
    get length() {
      return bag.size
    },
    clear: () => bag.clear(),
    getItem: (key: string) => bag.get(key) ?? null,
    key: (index: number) => [...bag.keys()][index] ?? null,
    removeItem: (key: string) => {
      bag.delete(key)
    },
    setItem: (key: string, value: string) => {
      bag.set(key, value)
    },
  }
}

/** Resolves browser localStorage or a shared in-memory stub for tests. */
export function resolvePersistStorage(): Storage {
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage
  }
  if (!memoryStorage) {
    memoryStorage = createMemoryStorage()
  }
  return memoryStorage
}
