import { Article } from '../types';
import { safeApiFetch } from './api';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

/**
 * UTM Builder for News attribution and referrals
 * Generates tracked links like:
 * https://source.com/article?utm_source=voxozet&utm_medium=referral&utm_campaign=vox_news_detail&utm_content=[slug]
 */
export function buildUtmUrl(originalUrl: string, title?: string): string {
  if (!originalUrl) return '';
  try {
    const url = new URL(originalUrl);
    const slug = title
      ? title
          .toLowerCase()
          .replace(/[^a-z0-9ğüşıöç]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .substring(0, 45)
      : 'vox_article';
    url.searchParams.set('utm_source', 'voxozet');
    url.searchParams.set('utm_medium', 'referral');
    url.searchParams.set('utm_campaign', 'vox_news_detail');
    url.searchParams.set('utm_content', slug || 'haber-detay');
    return url.toString();
  } catch {
    const sep = originalUrl.includes('?') ? '&' : '?';
    const slug = title
      ? title
          .toLowerCase()
          .replace(/[^a-z0-9ğüşıöç]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .substring(0, 45)
      : 'vox_article';
    return `${originalUrl}${sep}utm_source=voxozet&utm_medium=referral&utm_campaign=vox_news_detail&utm_content=${slug || 'haber-detay'}`;
  }
}

// 1. Kategori Bazlı Google News, Sözcü, TRT Haber, AA, BBC ve Habertürk RSS Akışları Haritası
export const RSS_FEEDS_BY_CATEGORY: Record<string, Array<{ url: string; author: string }>> = {
  'Tümü': [
    { url: 'https://www.trthaber.com/manset_articles.rss', author: 'TRT Haber' },
    { url: 'https://www.sozcu.com.tr/feeds-son-dakika', author: 'Sözcü' },
    { url: 'https://news.google.com/rss?hl=tr&gl=TR&ceid=TR:tr', author: 'Google Haberler' },
    { url: 'https://www.aa.com.tr/tr/rss/default?cat=gundem', author: 'Anadolu Ajansı' },
    { url: 'https://feeds.bbci.co.uk/turkce/rss.xml', author: 'BBC Türkçe' },
    { url: 'https://www.haberturk.com/rss/manset.xml', author: 'Habertürk' }
  ],
  'Gündem': [
    { url: 'https://www.trthaber.com/gundem_articles.rss', author: 'TRT Haber' },
    { url: 'https://www.sozcu.com.tr/feeds-son-dakika', author: 'Sözcü' },
    { url: 'https://news.google.com/rss/headlines/section/topic/NATION?hl=tr&gl=TR&ceid=TR:tr', author: 'Google Gündem' },
    { url: 'https://www.aa.com.tr/tr/rss/default?cat=gundem', author: 'Anadolu Ajansı' },
    { url: 'https://feeds.bbci.co.uk/turkce/rss.xml', author: 'BBC Türkçe' },
    { url: 'https://www.haberturk.com/rss/manset.xml', author: 'Habertürk' }
  ],
  'Teknoloji': [
    { url: 'https://www.webtekno.com/rss.xml', author: 'Webtekno' },
    { url: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=tr&gl=TR&ceid=TR:tr', author: 'Google Teknoloji' },
    { url: 'https://www.trthaber.com/bilim_teknoloji_articles.rss', author: 'TRT Bilim Teknoloji' },
    { url: 'https://www.aa.com.tr/tr/rss/default?cat=bilim-teknoloji', author: 'AA Teknoloji' },
    { url: 'https://www.haberturk.com/rss/kategori/teknoloji.xml', author: 'Habertürk Teknoloji' }
  ],
  'Ekonomi': [
    { url: 'https://www.trthaber.com/ekonomi_articles.rss', author: 'TRT Ekonomi' },
    { url: 'https://www.sozcu.com.tr/feeds-ekonomi', author: 'Sözcü Ekonomi' },
    { url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=tr&gl=TR&ceid=TR:tr', author: 'Google Ekonomi' },
    { url: 'https://www.aa.com.tr/tr/rss/default?cat=ekonomi', author: 'AA Finans' },
    { url: 'https://www.haberturk.com/rss/kategori/ekonomi.xml', author: 'Habertürk Ekonomi' }
  ],
  'Dünya': [
    { url: 'https://feeds.bbci.co.uk/turkce/rss.xml', author: 'BBC Türkçe' },
    { url: 'https://www.trthaber.com/dunya_articles.rss', author: 'TRT Dünya' },
    { url: 'https://www.sozcu.com.tr/feeds-dunya', author: 'Sözcü Dünya' },
    { url: 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=tr&gl=TR&ceid=TR:tr', author: 'Google Dünya' },
    { url: 'https://www.aa.com.tr/tr/rss/default?cat=dunya', author: 'AA Dünya' }
  ],
  'Spor': [
    { url: 'https://www.trthaber.com/spor_articles.rss', author: 'TRT Spor' },
    { url: 'https://www.sozcu.com.tr/feeds-spor', author: 'Sözcü Spor' },
    { url: 'https://news.google.com/rss/headlines/section/topic/SPORTS?hl=tr&gl=TR&ceid=TR:tr', author: 'Google Spor' },
    { url: 'https://www.aa.com.tr/tr/rss/default?cat=spor', author: 'AA Spor' },
    { url: 'https://www.haberturk.com/rss/kategori/spor.xml', author: 'Habertürk Spor' }
  ],
  'Bilim': [
    { url: 'https://www.webtekno.com/rss.xml', author: 'Webtekno' },
    { url: 'https://www.trthaber.com/bilim_teknoloji_articles.rss', author: 'TRT Bilim' },
    { url: 'https://news.google.com/rss/headlines/section/topic/SCIENCE?hl=tr&gl=TR&ceid=TR:tr', author: 'Google Bilim' },
    { url: 'https://www.aa.com.tr/tr/rss/default?cat=bilim-teknoloji', author: 'AA Bilim' }
  ],
  'Kültür & Sanat': [
    { url: 'https://www.trthaber.com/kultur_sanat_articles.rss', author: 'TRT Kültür Sanat' },
    { url: 'https://www.aa.com.tr/tr/rss/default?cat=kultur', author: 'AA Kültür' },
    { url: 'https://www.haberturk.com/rss/kategori/kultur-sanat.xml', author: 'Habertürk Kültür' },
    { url: 'https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?hl=tr&gl=TR&ceid=TR:tr', author: 'Google Kültür' }
  ]
};

const CATEGORY_IMAGES: Record<string, string> = {
  'Teknoloji': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80',
  'Ekonomi': 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&auto=format&fit=crop&q=80',
  'Bilim': 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=600&auto=format&fit=crop&q=80',
  'Dünya': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80',
  'Spor': 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&auto=format&fit=crop&q=80',
  'Kültür & Sanat': 'https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?w=600&auto=format&fit=crop&q=80',
  'Gündem': 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&auto=format&fit=crop&q=80',
  'Tümü': 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=600&auto=format&fit=crop&q=80'
};

/**
 * XML Varlıklarını (HTML Entities) ve etiketlerini temizleyip okunabilir paragraflara dönüştürür
 */
export function cleanRssText(str: string): string {
  if (!str) return '';
  let text = str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');
  
  // HTML varlıklarını recursive olarak çöz
  for (let k = 0; k < 3; k++) {
    text = text
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&apos;/gi, "'")
      .replace(/&amp;/gi, '&')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&mdash;/gi, '—')
      .replace(/&ndash;/gi, '–')
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  // Script ve stil bloklarını kaldır
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');

  // Paragraf ve satır sonu etiketlerini çift satır boşluğuna dönüştür
  text = text.replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n\n');
  text = text.replace(/<br\s*[\/]?>/gi, '\n');

  // Kalan HTML etiketlerini ve bağlantı artıklarını temizle
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/https?:\/\/[^\s]+/gi, '');
  text = text.replace(/\b(a\s+href|href|target=|[a-z0-9_-]+\.html)\b[^\s]*/gi, '');

  // Fazla boşlukları düzenle ancak paragrafları koru
  const paragraphs = text
    .split(/\n\s*\n/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(p => p.length > 0);

  return paragraphs.join('\n\n');
}

/**
 * Ham metinden anlamlı 3 madde (Öne Çıkan Başlıklar) türetir
 */
export function extractKeyHighlights(title: string, text: string, author: string): string[] {
  const sentences = text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 25 && !s.toLowerCase().includes('tıklayınız') && !s.toLowerCase().includes('abone ol'));

  const highlights: string[] = [];
  if (title && title.length > 10) {
    highlights.push(title);
  }

  for (const s of sentences) {
    if (highlights.length >= 3) break;
    if (!highlights.includes(s) && !s.includes(title)) {
      highlights.push(s);
    }
  }

  if (highlights.length < 2 && author) {
    highlights.push(`Kaynak: ${author} resmi haber bülteni`);
  }
  if (highlights.length < 3) {
    highlights.push('VOX Akıllı Akış motoru ile anlık derlenen son dakika gelişmesi');
  }

  return highlights.slice(0, 3);
}

/**
 * Ham RSS XML metnini ayrıştırıp zengin içerikli Article nesneleri dizisine dönüştürür
 */
export function parseRssXmlToArticles(xmlText: string, category: string, defaultAuthor: string): Article[] {
  try {
    const itemMatches = xmlText.match(/<item[\s\S]*?<\/item>/gi) || [];
    const parsedArticles: Article[] = [];

    for (let i = 0; i < Math.min(itemMatches.length, 15); i++) {
      const itemStr = itemMatches[i];
      const titleMatch = itemStr.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const descMatch = itemStr.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
      const contentMatch = itemStr.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i);
      const authorMatch = itemStr.match(/<author[^>]*>([\s\S]*?)<\/author>/i) || 
                          itemStr.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i) ||
                          itemStr.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
      const linkMatch = itemStr.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || itemStr.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
      const pubDateMatch = itemStr.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);

      // Çoklu görsel deseni taraması (enclosure, media:content, thumbnail, img src)
      let extractedImg = '';
      const encUrlMatch = itemStr.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
      const mediaContent = itemStr.match(/<media:content[^>]+url=["']([^"']+)["']/i);
      const mediaThumb = itemStr.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
      const imgTagMatch = itemStr.match(/<img[^>]+src=["']([^"']+)["']/i);

      if (encUrlMatch && encUrlMatch[1] && !encUrlMatch[1].endsWith('.mp3')) {
        extractedImg = encUrlMatch[1].trim();
      } else if (mediaContent && mediaContent[1]) {
        extractedImg = mediaContent[1].trim();
      } else if (mediaThumb && mediaThumb[1]) {
        extractedImg = mediaThumb[1].trim();
      } else if (imgTagMatch && imgTagMatch[1]) {
        extractedImg = imgTagMatch[1].trim();
      }

      const rawTitle = titleMatch ? cleanRssText(titleMatch[1]) : '';
      let author = authorMatch ? cleanRssText(authorMatch[1]) : defaultAuthor;
      let title = rawTitle;

      // Başlıktaki yayıncı eklerini temizle (Örn: "Haber Başlığı - NTV" -> "Haber Başlığı")
      if (author && title.endsWith(' - ' + author)) {
        title = title.substring(0, title.length - (author.length + 3)).trim();
      } else {
        const lastDash = title.lastIndexOf(' - ');
        if (lastDash > 15) {
          const possibleAuthor = title.substring(lastDash + 3).trim();
          if (possibleAuthor.length < 30) {
            author = possibleAuthor;
            title = title.substring(0, lastDash).trim();
          }
        }
      }

      const parsedDescription = descMatch ? cleanRssText(descMatch[1]) : '';
      const parsedFullContent = contentMatch ? cleanRssText(contentMatch[1]) : '';
      const sourceUrl = linkMatch ? linkMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
      const pubDate = pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString();

      if (title && title.length > 8) {
        const cleanSlug = title.toLowerCase().replace(/[^a-z0-9ğüşıöç]/g, '').substring(0, 30);
        
        // Zengin ve uzun metin oluştur: Eğer content:encoded veya description varsa onları doğrudan tam makale içeriği olarak kullan
        let articleBody = parsedFullContent;
        if (!articleBody || articleBody.length < parsedDescription.length) {
          articleBody = parsedDescription;
        }

        // Eğer hala çok kısaysa veya sadece tek cümle ise temiz akış metni oluştur
        let finalContent = '';
        if (articleBody && articleBody.length > 80) {
          finalContent = articleBody;
        } else if (articleBody && articleBody.length > 20) {
          finalContent = `${articleBody}\n\n${author} tarafından aktarılan son dakika gelişmelerine göre olayla ilgili inceleme ve süreç yakından takip ediliyor. İlgili kurum ve yetkililerden yapılacak açıklamalar doğrultusunda detaylar aktarılacaktır.`;
        } else {
          finalContent = `${title}.\n\n${author} kaynaklı güncel haber akışında yer alan bilgilere göre ilgili konudaki gelişmeler kamuoyu ve sektör temsilcileri tarafından dikkatle izleniyor.`;
        }

        // Kısa özet oluştur (kart ve üst gösterim için)
        const summaryParagraph = articleBody ? articleBody.split('\n\n')[0] : '';
        const articleSummary = summaryParagraph && summaryParagraph.length > 30 && summaryParagraph.length < 240
          ? summaryParagraph
          : `${title} hakkında ${author} tarafından aktarılan en son gelişmeler.`;

        const keyPoints = extractKeyHighlights(title, finalContent, author);

        parsedArticles.push({
          id: `vox_${category.toLowerCase()}_${cleanSlug}_${i}`,
          title,
          summary: articleSummary,
          content: finalContent,
          category: category === 'Tümü' ? 'Gündem' : category,
          author: author || defaultAuthor,
          imageUrl: extractedImg || CATEGORY_IMAGES[category] || CATEGORY_IMAGES['Tümü'],
          durationSeconds: Math.max(120, Math.min(360, finalContent.split(' ').length * 2)),
          sourceType: 'rss',
          sourceUrl,
          createdAt: pubDate,
          keyPoints
        });
      }
    }

    return parsedArticles;
  } catch (err) {
    console.warn('parseRssXmlToArticles error:', err);
    return [];
  }
}

/**
 * Gemini API ile Haberi İsteğe Bağlı Olarak 3-4 Cümlelik Akıcı Sesli Bültene Özetler
 */
export async function summarizeArticleWithGemini(article: Article): Promise<{
  aiSummary: string;
  aiKeyPoints: string[];
  aiContent: string;
}> {
  try {
    const payload = {
      sourceType: 'web',
      rawText: `${article.title}\n\n${article.summary}\n\n${article.content}`,
      focusArea: article.category || 'Gündem',
      summaryLength: 'Kısa',
      customTitle: article.title
    };

    const res = await safeApiFetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) {
        return {
          aiSummary: data.data.summary || article.summary,
          aiKeyPoints: data.data.keyPoints || article.keyPoints || [],
          aiContent: data.data.content || article.content
        };
      }
    }
  } catch (err) {
    console.warn('Gemini summarization error:', err);
  }

  // Fallback high-yield concise summary if network or quota issue occurs
  const sentences = article.content
    .replace(/\n+/g, ' ')
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20);

  const topSentences = sentences.slice(0, 3).join(' ');
  const fallbackSummary = `${article.author || 'Kaynak'} bildirdi: ${topSentences || article.title}.`;
  
  return {
    aiSummary: fallbackSummary,
    aiKeyPoints: article.keyPoints || [article.title, `Kaynak: ${article.author}`, 'Hızlı Sesli Özet'],
    aiContent: fallbackSummary
  };
}

/**
 * Tek bir RSS akışını çeker (Native iOS CapacitorHttp + Web Fetch Fallback)
 */
async function fetchRssUrl(url: string, category: string, author: string): Promise<Article[]> {
  // 1. Native iOS / Android CapacitorHttp (Zero CORS restriction)
  if (Capacitor.isNativePlatform()) {
    try {
      const nativeRes = await CapacitorHttp.get({
        url,
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        }
      });
      if (nativeRes.status === 200 && nativeRes.data) {
        const xmlText = typeof nativeRes.data === 'string' ? nativeRes.data : '';
        if (xmlText) {
          const articles = parseRssXmlToArticles(xmlText, category, author);
          if (articles.length > 0) return articles;
        }
      }
    } catch (nativeErr) {
      console.warn(`Native fetch error for ${url}:`, nativeErr);
    }
  }

  // 2. Direct Web fetch with abort controller
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      }
    });
    clearTimeout(timeout);
    if (res.ok) {
      const xmlText = await res.text();
      const articles = parseRssXmlToArticles(xmlText, category, author);
      if (articles.length > 0) return articles;
    }
  } catch {}

  // 3. Web Proxy Fallback (For browser testing)
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const proxyRes = await fetch(proxyUrl, { cache: 'no-cache' });
    if (proxyRes.ok) {
      const xmlText = await proxyRes.text();
      return parseRssXmlToArticles(xmlText, category, author);
    }
  } catch {}

  return [];
}

/**
 * Fetch dynamic Turkish news for a given category
 */
export async function fetchNewsByCategory(category: string = 'Tümü', lang: string = 'tr'): Promise<Article[]> {
  // 1. Try Backend /api/news First (Render / Container In-Memory Caching)
  try {
    const res = await safeApiFetch(`/api/news?category=${encodeURIComponent(category)}&lang=${lang}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.articles) && data.articles.length > 0) {
        return data.articles;
      }
    }
  } catch (err) {
    console.warn('Backend news API check notice:', err);
  }

  // 2. Multi-Feed Parallel RSS Extraction
  const targetFeeds = RSS_FEEDS_BY_CATEGORY[category] || RSS_FEEDS_BY_CATEGORY['Tümü'];
  try {
    const feedResults = await Promise.allSettled(
      targetFeeds.map(feed => fetchRssUrl(feed.url, category, feed.author))
    );

    const aggregatedArticles: Article[] = [];
    const seenTitles = new Set<string>();

    for (const result of feedResults) {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        for (const item of result.value) {
          const simplifiedTitle = item.title.toLowerCase().replace(/[^a-z0-9ğüşıöç]/g, '').substring(0, 25);
          if (!seenTitles.has(simplifiedTitle)) {
            seenTitles.add(simplifiedTitle);
            aggregatedArticles.push(item);
          }
        }
      }
    }

    if (aggregatedArticles.length > 0) {
      return aggregatedArticles;
    }
  } catch (allFeedsErr) {
    console.warn('All RSS feeds fetch error:', allFeedsErr);
  }

  // 3. Fallback High-Quality Placeholder News
  return [
    {
      id: `fallback-${category.toLowerCase()}-1`,
      title: `${category === 'Tümü' ? 'Gündem' : category} Özel: Yapay Zeka ve Dijital Dönüşüm Çağı`,
      summary: 'Gelişen teknolojik altyapılar ve veri odaklı analitik araçlar günlük iş akışlarını ve sektörel dinamikleri hızla dönüştürüyor.',
      content: `${category === 'Tümü' ? 'Gündem' : category} başlığı altındaki en son gelişmeler, yapay zeka entegrasyonu ve dijitalleşmenin iş dünyasında ve günlük hayatta yarattığı etkileri ortaya koyuyor. VOX AI sesli bülten ile tüm ayrıntıları dinleyebilirsiniz.`,
      category: category === 'Tümü' ? 'Gündem' : category,
      author: 'VOX Dijital Haber',
      imageUrl: CATEGORY_IMAGES[category] || CATEGORY_IMAGES['Tümü'],
      durationSeconds: 240,
      sourceType: 'rss',
      createdAt: new Date().toISOString(),
      keyPoints: ['Güncel sektörel analizler', 'Dijital dönüşüm hızı', 'Gelecek projeksiyonları']
    }
  ];
}
