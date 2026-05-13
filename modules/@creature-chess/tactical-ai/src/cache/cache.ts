interface CacheEntry<T> {
  value: T;
  expiry: number;
}

export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}

class InMemoryCache implements CacheProvider {
  private store = new Map<string, CacheEntry<any>>();
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }
    this.store.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }
}

let cacheInstance: CacheProvider | null = null;

export const getCache = (): CacheProvider => {
  if (!cacheInstance) {
    cacheInstance = new InMemoryCache(500);
  }
  return cacheInstance;
};

export const hashKey = (parts: string[]): string => {
  return parts.join(":").slice(0, 250);
};
