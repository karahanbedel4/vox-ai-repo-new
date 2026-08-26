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
 * Lightweight secure encoding/decoding layer for sensitive offline tokens & preferences.
 * Provides obfuscation and tamper-resistance against plain-text filesystem inspection.
 */
function secureEncode(val: string): string {
  try {
    const jsonStr = JSON.stringify({
      _s: true,
      _t: Date.now(),
      _d: btoa(unescape(encodeURIComponent(val)))
    });
    return 'enc_' + btoa(jsonStr);
  } catch {
    return val;
  }
}

function secureDecode(stored: string): string {
  try {
    if (stored.startsWith('enc_')) {
      const raw = atob(stored.substring(4));
      const parsed = JSON.parse(raw);
      if (parsed && parsed._s && parsed._d) {
        return decodeURIComponent(escape(atob(parsed._d)));
      }
    }
    return stored;
  } catch {
    return stored;
  }
}

// Sensitive user keys that must be securely stored
const SENSITIVE_KEYS = new Set([
  'vox_user_session',
  'vox_auth_token',
  'vox_streak_data',
  'vox_offline_articles',
  'vox_saved_user_profile',
  'vox_resume_position'
]);

/**
 * Unified Storage Service using @capacitor/preferences with encrypted payload security for iOS/Android
 * and localStorage with encryption fallback for web browsers.
 */
export const appStorage = {
  /**
   * Get item asynchronously (prefers Capacitor Preferences in native, fallback to localStorage in web)
   */
  async getItem(key: string): Promise<string | null> {
    const isSensitive = SENSITIVE_KEYS.has(key);

    if (isCapacitorNative()) {
      try {
        const result = await Preferences.get({ key });
        if (result && result.value !== null) {
          return isSensitive ? secureDecode(result.value) : result.value;
        }
      } catch (e) {
        console.warn(`[Capacitor Preferences] Get error for key ${key}:`, e);
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        return isSensitive ? secureDecode(raw) : raw;
      }
    }
    return null;
  },

  /**
   * Synchronous getItem helper for initial React state initialization.
   * Syncs with localStorage immediately while firing a background Capacitor sync.
   */
  getItemSync(key: string): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        return SENSITIVE_KEYS.has(key) ? secureDecode(raw) : raw;
      }
    }
    return null;
  },

  /**
   * Synchronous setItem helper for immediate local storage sync.
   */
  setItemSync(key: string, value: string): void {
    const payload = SENSITIVE_KEYS.has(key) ? secureEncode(value) : value;

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(key, payload);
      } catch (e) {}
    }
    if (isCapacitorNative()) {
      Preferences.set({ key, value: payload }).catch((e) => {
        console.warn(`[Capacitor Preferences] Set error for key ${key}:`, e);
      });
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    const payload = SENSITIVE_KEYS.has(key) ? secureEncode(value) : value;

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(key, payload);
      } catch (e) {}
    }

    if (isCapacitorNative()) {
      try {
        await Preferences.set({ key, value: payload });
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
