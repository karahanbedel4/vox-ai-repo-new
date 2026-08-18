import { Network, ConnectionStatus } from '@capacitor/network';
import { appStorage } from './storage';
import { Article } from '../types';

export const OFFLINE_ARTICLES_KEY = 'vox_offline_articles';

/**
 * Cache top 3 articles (text content, title, summary only - excluding cover images) into @capacitor/preferences
 */
export async function cacheTop3Articles(articles: Article[]): Promise<void> {
  if (!articles || articles.length === 0) return;

  const top3 = articles.slice(0, 3).map(article => ({
    id: article.id,
    title: article.title,
    summary: article.summary,
    content: article.content,
    category: article.category || 'Genel',
    sourceType: article.sourceType || 'text',
    durationSeconds: article.durationSeconds || 180,
    createdAt: article.createdAt || new Date().toISOString(),
    author: article.author || 'VOX Editör',
    keyPoints: article.keyPoints || [],
    imageUrl: '' // Exclude cover images as requested
  }));

  try {
    await appStorage.setItem(OFFLINE_ARTICLES_KEY, JSON.stringify(top3));
  } catch (err) {
    console.warn('[Offline Cache] Failed to save top 3 articles to Preferences:', err);
  }
}

/**
 * Get cached offline articles from @capacitor/preferences
 */
export async function getCachedOfflineArticles(): Promise<Article[]> {
  try {
    const raw = await appStorage.getItem(OFFLINE_ARTICLES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: Partial<Article>): Article => ({
          id: item.id || `offline-${Math.random()}`,
          title: item.title || 'Çevrimdışı Makale',
          summary: item.summary || '',
          content: item.content || '',
          category: item.category || 'Çevrimdışı',
          sourceType: item.sourceType || 'text',
          durationSeconds: item.durationSeconds || 180,
          createdAt: item.createdAt || new Date().toISOString(),
          imageUrl: '', // No image in offline mode
          author: item.author || 'VOX',
          keyPoints: item.keyPoints || []
        }));
      }
    }
  } catch (err) {
    console.warn('[Offline Cache] Failed to load offline articles:', err);
  }
  return [];
}

/**
 * Setup Capacitor Network status listener with browser fallback
 */
export function subscribeNetworkStatus(onChange: (isOffline: boolean) => void): () => void {
  let cleanupCapacitor: (() => void) | null = null;

  // Initial status check
  Network.getStatus().then((status: ConnectionStatus) => {
    onChange(!status.connected);
  }).catch(() => {
    onChange(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  });

  // Listener for Capacitor Network
  Network.addListener('networkStatusChange', (status: ConnectionStatus) => {
    onChange(!status.connected);
  }).then(handle => {
    cleanupCapacitor = () => {
      handle.remove();
    };
  }).catch(() => {});

  // Web Browser listeners
  const handleOnline = () => onChange(false);
  const handleOffline = () => onChange(true);

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  return () => {
    if (cleanupCapacitor) cleanupCapacitor();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
  };
}
