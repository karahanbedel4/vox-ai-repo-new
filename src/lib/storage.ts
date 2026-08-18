import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

/**
 * Checks if the application is currently running in a native Capacitor environment (iOS/Android).
 */
export function isCapacitorNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch (e) {
    return false;
  }
}

/**
 * Unified Storage Service using @capacitor/preferences for native mobile
 * and localStorage as fallbacks for web browsers.
 */
export const appStorage = {
  /**
   * Get item asynchronously (prefers Capacitor Preferences in native, fallback to localStorage in web)
   */
  async getItem(key: string): Promise<string | null> {
    if (isCapacitorNative()) {
      try {
        const result = await Preferences.get({ key });
        if (result && result.value !== null) {
          return result.value;
        }
      } catch (e) {
        console.warn(`[Capacitor Preferences] Get error for key ${key}:`, e);
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(key);
    }
    return null;
  },

  /**
   * Synchronous getItem helper for initial React state initialization.
   * Syncs with localStorage immediately while firing a background Capacitor sync.
   */
  getItemSync(key: string): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(key);
    }
    return null;
  },

  /**
   * Synchronous setItem helper for immediate local storage sync.
   */
  setItemSync(key: string, value: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {}
    }
    if (isCapacitorNative()) {
      Preferences.set({ key, value }).catch((e) => {
        console.warn(`[Capacitor Preferences] Set error for key ${key}:`, e);
      });
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {}
    }

    if (isCapacitorNative()) {
      try {
        await Preferences.set({ key, value });
      } catch (e) {
        console.warn(`[Capacitor Preferences] Set error for key ${key}:`, e);
      }
    }
  },

  /**
   * Remove item from storage
   */
  async removeItem(key: string): Promise<void> {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(key);
      } catch (e) {}
    }

    if (isCapacitorNative()) {
      try {
        await Preferences.remove({ key });
      } catch (e) {
        console.warn(`[Capacitor Preferences] Remove error for key ${key}:`, e);
      }
    }
  },

  /**
   * Clear all stored preferences
   */
  async clear(): Promise<void> {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.clear();
      } catch (e) {}
    }

    if (isCapacitorNative()) {
      try {
        await Preferences.clear();
      } catch (e) {
        console.warn(`[Capacitor Preferences] Clear error:`, e);
      }
    }
  }
};
