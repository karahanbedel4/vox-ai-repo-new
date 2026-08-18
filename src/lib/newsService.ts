import { Article } from '../types';
import { safeApiFetch } from './api';

/**
 * Fetch dynamic Turkish news for a given category from /api/news
 */
export async function fetchNewsByCategory(category: string = 'Tümü', lang: string = 'tr'): Promise<Article[]> {
  try {
    const res = await safeApiFetch(`/api/news?category=${encodeURIComponent(category)}&lang=${lang}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.articles)) {
        return data.articles;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch news from /api/news, using local fallback:', err);
  }

  // Fallback data if API request fails
  return [
    {
      id: `fallback-${category}-1`,
      title: `${category === 'Tümü' ? 'Gündem' : category} Özel: Yapay Zeka Çağında Yeni Dönem`,
      summary: 'Gelişen teknolojik altyapılar ve veri odaklı analitik araçlar günlük iş akışlarını ve sektörel dinamikleri hızla dönüştürüyor.',
      content: `${category === 'Tümü' ? 'Gündem' : category} başlığı altındaki en son gelişmeler, yapay zeka entegrasyonu ve dijitalleşmenin iş dünyasında ve günlük hayatta yarattığı etkileri ortaya koyuyor. Sesli bülten ile tüm ayrıntıları dinleyebilirsiniz.`,
      category: category === 'Tümü' ? 'Gündem' : category,
      author: 'VOX Dijital Haber',
      imageUrl: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&auto=format&fit=crop&q=80',
      durationSeconds: 240,
      sourceType: 'rss',
      createdAt: new Date().toISOString(),
      keyPoints: ['Güncel sektörel analizler', 'Dijital dönüşüm hızı', 'Gelecek projeksiyonları']
    }
  ];
}
