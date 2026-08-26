import { appStorage } from './storage';
import { SharedLinkItem, SourceType, Article } from '../types';
import { safeApiFetch } from './api';

export const MAX_QUEUE_LIMIT = 5;
const STORAGE_KEY = 'vox_shared_links_queue';

export function extractYouTubeId(urlStr: string): string | null {
  if (!urlStr) return null;
  const trimmed = urlStr.trim();
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/;
  const match = trimmed.match(regExp);
  if (match && match[1]) return match[1];

  try {
    const normUrl = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    const urlObj = new URL(normUrl);
    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
      const vParam = urlObj.searchParams.get('v');
      if (vParam && /^[\w-]{11}$/.test(vParam)) return vParam;
      const parts = urlObj.pathname.split('/').filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && /^[\w-]{11}$/.test(last)) return last;
    }
  } catch {}

  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

export function parseSharedContent(rawInput: string): {
  url: string;
  title?: string;
  sourceType: SourceType;
  platformName: SharedLinkItem['platformName'];
  thumbnail?: string;
} | null {
  if (!rawInput || typeof rawInput !== 'string') return null;

  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  // Extract URL from text if user shared a whole message with URL inside
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urlMatch = trimmed.match(urlRegex);
  const detectedUrl = urlMatch ? urlMatch[0] : (trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : '');

  if (detectedUrl) {
    // 1. YouTube
    const ytId = extractYouTubeId(detectedUrl);
    if (ytId || detectedUrl.includes('youtube.com') || detectedUrl.includes('youtu.be')) {
      return {
        url: detectedUrl,
        title: 'YouTube Video & Podcast',
        sourceType: 'youtube',
        platformName: 'YouTube',
        thumbnail: ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : undefined
      };
    }

    // 2. Twitter / X
    if (detectedUrl.includes('twitter.com') || detectedUrl.includes('x.com')) {
      return {
        url: detectedUrl,
        title: 'X (Twitter) Gönderisi & Thread',
        sourceType: 'web',
        platformName: 'X / Twitter',
        thumbnail: 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=500&auto=format&fit=crop&q=80'
      };
    }

    // 3. General Web Article / Link
    try {
      const urlObj = new URL(detectedUrl);
      const hostname = urlObj.hostname.replace(/^www\./, '');
      return {
        url: detectedUrl,
        title: `${hostname} Makalesi`,
        sourceType: 'web',
        platformName: 'Web',
        thumbnail: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=500&auto=format&fit=crop&q=80'
      };
    } catch {
      return {
        url: detectedUrl,
        title: 'Web Bağlantısı',
        sourceType: 'web',
        platformName: 'Web'
      };
    }
  }

  // Raw text or snippet
  if (trimmed.length > 20) {
    return {
      url: '',
      title: trimmed.slice(0, 40) + '...',
      sourceType: 'text',
      platformName: 'Metin'
    };
  }

  return null;
}

export function getSharedLinksQueue(): SharedLinkItem[] {
  try {
    const raw = appStorage.getItemSync(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addSharedLinkToQueue(item: {
  url: string;
  title?: string;
  sourceType: SourceType;
  platformName: SharedLinkItem['platformName'];
  thumbnail?: string;
}): { success: boolean; queue: SharedLinkItem[]; error?: string } {
  const current = getSharedLinksQueue();

  // Check if link already in queue
  const exists = current.some(x => x.url === item.url && x.url !== '');
  if (exists) {
    return { success: false, queue: current, error: 'Bu bağlantı zaten dönüştürme havuzunuzda mevcut.' };
  }

  // Check limit (Max 5)
  if (current.length >= MAX_QUEUE_LIMIT) {
    return {
      success: false,
      queue: current,
      error: `Dönüştürme havuzu dolu (Maksimum ${MAX_QUEUE_LIMIT} link). Lütfen mevcut içerikleri dönüştürün veya kullanmadıklarınızı silin.`
    };
  }

  const newItem: SharedLinkItem = {
    id: 'queue_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    url: item.url,
    title: item.title,
    sourceType: item.sourceType,
    platformName: item.platformName,
    thumbnail: item.thumbnail,
    addedAt: new Date().toISOString()
  };

  const updated = [newItem, ...current];
  try {
    appStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save shared queue:', err);
  }

  return { success: true, queue: updated };
}

export function removeSharedLinkFromQueue(id: string): SharedLinkItem[] {
  const current = getSharedLinksQueue();
  const updated = current.filter(x => x.id !== id);
  try {
    appStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to update shared queue:', err);
  }
  return updated;
}

export function clearSharedLinksQueue(): void {
  try {
    appStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear shared queue:', err);
  }
}

export async function convertItemToArticle(item: {
  url: string;
  sourceType: SourceType;
  title?: string;
  rawText?: string;
  focusArea?: string;
  summaryLength?: string;
}): Promise<Article> {
  const res = await safeApiFetch('/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceType: item.sourceType,
      url: item.url,
      rawText: item.rawText || '',
      focusArea: item.focusArea || 'Genel Özet & Detaylar',
      summaryLength: item.summaryLength || 'Normal Özet (Yarı Süreye Kadar / 3 Segment)',
      customTitle: item.title || ''
    })
  });

  const rawResponseText = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(rawResponseText);
  } catch {}

  if (res.ok && json?.success && json?.data) {
    const youtubeId = item.sourceType === 'youtube' ? extractYouTubeId(item.url) : null;
    const thumbnail = youtubeId 
      ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
      : (json.data.imageUrl || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&auto=format&fit=crop&q=80');

    const article: Article = {
      id: 'vox_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      title: json.data.title || item.title || 'VOX AI Sesli Bülten',
      summary: json.data.summary || 'Yapay zeka analiz özeti tamamlandı.',
      content: json.data.content || item.rawText || 'Özet metni.',
      category: json.data.category || 'Teknoloji',
      sourceUrl: item.url,
      sourceType: item.sourceType,
      durationSeconds: json.data.durationSeconds || 300,
      imageUrl: thumbnail,
      createdAt: new Date().toISOString(),
      author: json.data.author || 'VOX Studio AI',
      keyPoints: json.data.keyPoints
    };

    return article;
  }

  const serverMsg = json?.message || json?.error || (rawResponseText.trim().startsWith('<') ? 'Sunucu geçici olarak yanıt veremedi. Lütfen tekrar deneyin.' : rawResponseText) || 'Yapay zeka bülteni oluşturulamadı.';
  throw new Error(serverMsg);
}
