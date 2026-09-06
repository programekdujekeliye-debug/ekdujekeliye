/**
 * Safe Browser Storage Utility
 * 
 * Provides fail-safe wrappers around window.sessionStorage and window.localStorage.
 * In iOS Safari Private Browsing Mode (or when strict tracking protection / cookie blocking
 * is active), direct access to sessionStorage/localStorage throws a SecurityError or
 * QuotaExceededError.
 * 
 * This utility safely traps exceptions and falls back to an in-memory Map so that
 * the application never crashes into a blank white screen.
 */

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

const memorySession = new MemoryStorage();
const memoryLocal = new MemoryStorage();

export const safeSessionStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        return window.sessionStorage.getItem(key);
      }
    } catch (_) {
      // Fallback to memory storage in iOS Safari Private Browsing
    }
    return memorySession.getItem(key);
  },

  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(key, value);
      }
    } catch (_) {
      // Ignore quota/security errors in Safari
    }
    memorySession.setItem(key, value);
  },

  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(key);
      }
    } catch (_) {}
    memorySession.removeItem(key);
  },

  clear: (): void => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.clear();
      }
    } catch (_) {}
    memorySession.clear();
  }
};

export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (_) {
      // Fallback to memory storage in iOS Safari Private Browsing
    }
    return memoryLocal.getItem(key);
  },

  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (_) {
      // Ignore quota/security errors in Safari
    }
    memoryLocal.setItem(key, value);
  },

  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (_) {}
    memoryLocal.removeItem(key);
  },

  clear: (): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
      }
    } catch (_) {}
    memoryLocal.clear();
  }
};
