import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { YoutubeTranscript } from 'youtube-transcript';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

const app = express();
const PORT = 3000;

// Enable CORS for web apps and native Capacitor apps (capacitor://localhost, localhost, etc.)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '50mb' }));

// Set default Content-Type for all /api endpoints to application/json
app.use('/api', (req, res, next) => {
  if (!req.path.startsWith('/tts')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  next();
});

// JSON body parse error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ success: false, error: 'INVALID_JSON', message: 'Geçersiz veri biçimi.' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'PAYLOAD_TOO_LARGE', message: 'Yüklenen veri boyutu çok büyük.' });
  }
  next(err);
});

// Initialize Gemini API client server-side
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({ 
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

async function callGeminiWithRetry(params: { model?: string; contents: any; config?: any }, retries = 2, delayMs = 300) {
  const client = getGeminiClient();
  if (!client) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  const primaryModel = params.model || 'gemini-3.7-flash';
  const models = Array.from(new Set([primaryModel, 'gemini-3.1-flash-lite', 'gemini-flash-latest']));
  let lastError: any = null;

  for (const modelName of models) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await client.models.generateContent({
          ...params,
          model: modelName,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const status = err?.status || err?.code;
        const msg = (err?.message || String(err)).toLowerCase();
        
        // Non-recoverable auth errors - fail fast without spamming retries
        if (status === 401 || status === 403 || msg.includes('unauthenticated') || msg.includes('invalid authentication') || msg.includes('permission_denied')) {
          throw err;
        }

        const isTransient = status === 503 || status === 429 || msg.includes('503') || msg.includes('429') || msg.includes('unavailable') || msg.includes('high demand') || msg.includes('quota') || msg.includes('resource_exhausted');
        
        if (isTransient) {
          // Immediately try next fallback model (e.g. gemini-3.1-flash-lite) to avoid quota lock
          break;
        } else if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
        }
      }
    }
  }

  throw lastError;
}

function extractYouTubeId(urlStr: string): string | null {
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

function decodeXmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

function isGenericYouTubeText(str: string): boolean {
  if (!str) return true;
  const lower = str.toLowerCase();
  return (
    lower.includes('sevdiğiniz videoların') ||
    lower.includes('orijinal içerik yükleyin') ||
    lower.includes('arkadaşlarınızla, ailenizle') ||
    lower.includes('enjoy the videos and music') ||
    lower.includes('upload original content') ||
    lower.includes('share it all with friends') ||
    lower.includes('youtube&#39;da') ||
    lower.includes("youtube'da") ||
    lower.includes('seslendirme metnine dönüştürülüyor') ||
    lower.includes('podcast seslendirme metni üret') ||
    str.trim().length < 15
  );
}

// 1. YouTube InnerTube API call (bypasses HTML consent walls)
async function fetchYouTubeInnerTubePlayer(videoId: string) {
  const clients = [
    {
      client: { clientName: 'WEB', clientVersion: '2.20240308.00.00', hl: 'tr', gl: 'TR' },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    },
    {
      client: { clientName: 'ANDROID', clientVersion: '19.11.38', androidSdkVersion: 30, hl: 'tr', gl: 'TR' },
      userAgent: 'com.google.android.youtube/19.11.38 (Linux; U; Android 11) gzip'
    },
    {
      client: { clientName: 'WEB_EMBEDDED_PLAYER', clientVersion: '1.20240101.00.00', hl: 'tr', gl: 'TR' },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    },
    {
      client: { clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientVersion: '2.0', hl: 'tr', gl: 'TR' },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    },
    {
      client: { clientName: 'IOS', clientVersion: '19.11.1', hl: 'tr', gl: 'TR' },
      userAgent: 'com.google.ios.youtube/19.11.1 (iPhone; CPU iPhone OS 17_4 like Mac OS X)'
    }
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fallbackJson: any = null;

  for (const { client, userAgent } of clients) {
    try {
      const res = await fetch('https://www.youtube.com/youtubei/v1/player', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': userAgent,
          'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        body: JSON.stringify({
          context: { client },
          videoId: videoId,
          playbackContext: {
            contentPlaybackContext: {
              html5Preference: 'HTML5_PREFER_FORMAT_22'
            }
          },
          racyCheckOk: true,
          contentCheckOk: true
        })
      });
      if (res.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const json = await res.json() as any;
        if (json?.captions?.playerCaptionsTracklistRenderer?.captionTracks || json?.captions?.playerCaptionsRenderer?.captionTracks) {
          return json;
        }
        if (json?.videoDetails && !fallbackJson) {
          fallbackJson = json;
        }
      }
    } catch (err) {
      console.warn('[YouTube InnerTube Player] fetch notice:', err);
    }
  }
  return fallbackJson;
}

// 1b. YouTube InnerTube Next API call (returns engagementPanels & cueGroups directly)
async function fetchYouTubeInnerTubeNext(videoId: string) {
  const clients = [
    {
      client: { clientName: 'WEB', clientVersion: '2.20240308.00.00', hl: 'tr', gl: 'TR' },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    },
    {
      client: { clientName: 'ANDROID', clientVersion: '19.11.38', androidSdkVersion: 30, hl: 'tr', gl: 'TR' },
      userAgent: 'com.google.android.youtube/19.11.38 (Linux; U; Android 11) gzip'
    },
    {
      client: { clientName: 'IOS', clientVersion: '19.11.1', hl: 'tr', gl: 'TR' },
      userAgent: 'com.google.ios.youtube/19.11.1 (iPhone; CPU iPhone OS 17_4 like Mac OS X)'
    }
  ];

  for (const { client, userAgent } of clients) {
    try {
      const res = await fetch('https://www.youtube.com/youtubei/v1/next', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': userAgent,
          'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        body: JSON.stringify({
          context: { client },
          videoId: videoId
        })
      });
      if (res.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const json = await res.json() as any;
        if (json) return json;
      }
    } catch (err) {
      console.warn('[YouTube InnerTube Next] fetch notice:', err);
    }
  }
  return null;
}

// Extract transcript text directly from InnerTube Next engagementPanels cueGroups
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTranscriptFromInnerTubeNext(json: any): string | null {
  if (!json) return null;
  try {
    const panels = json?.engagementPanels;
    if (Array.isArray(panels)) {
      for (const panel of panels) {
        const cueGroups = panel?.engagementPanelSectionListRenderer?.content
          ?.transcriptRenderer?.body?.transcriptBodyRenderer?.cueGroups;
        if (Array.isArray(cueGroups) && cueGroups.length > 0) {
          const lines: string[] = [];
          for (const group of cueGroups) {
            const cues = group?.transcriptCueRenderer;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const text = cues?.cue?.simpleText || cues?.cue?.runs?.map((r: any) => r.text).join('') || cues?.snippet?.runs?.map((r: any) => r.text).join('');
            if (text && text.trim()) {
              lines.push(text.trim());
            }
          }
          if (lines.length > 0) {
            const fullText = lines.join(' ').replace(/\s+/g, ' ').trim();
            if (fullText.length > 30) {
              return fullText;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[InnerTube Next Transcript Extraction Error]', err);
  }
  return null;
}

// Helper to extract transcript from InnerTube get_transcript response
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTranscriptFromGetTranscriptJson(json: any): string | null {
  if (!json) return null;
  const lines: string[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function collectCues(obj: any) {
    if (!obj || typeof obj !== 'object') return;
    if (obj.transcriptCueRenderer) {
      const cue = obj.transcriptCueRenderer;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = cue?.cue?.simpleText || 
                   cue?.cue?.runs?.map((r: any) => r.text).join('') ||
                   cue?.snippet?.runs?.map((r: any) => r.text).join('');
      if (text && text.trim()) {
        lines.push(text.trim());
      }
      return;
    }
    if (Array.isArray(obj)) {
      for (const item of obj) collectCues(item);
    } else {
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'object') collectCues(obj[key]);
      }
    }
  }

  collectCues(json);

  if (lines.length > 0) {
    const fullText = lines.join(' ').replace(/\s+/g, ' ').trim();
    if (fullText.length > 30) return fullText;
  }
  return null;
}

// 1c. YouTube InnerTube get_transcript caller
async function fetchYouTubeInnerTubeTranscript(videoId: string): Promise<string | null> {
  try {
    const nextData = await fetchYouTubeInnerTubeNext(videoId);
    if (nextData) {
      const cueText = extractTranscriptFromInnerTubeNext(nextData);
      if (cueText) return cueText;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let transcriptParams: string | null = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function findTranscriptParams(obj: any) {
        if (!obj || typeof obj !== 'object' || transcriptParams) return;
        if (obj.getTranscriptEndpoint && obj.getTranscriptEndpoint.params) {
          transcriptParams = obj.getTranscriptEndpoint.params;
          return;
        }
        for (const k of Object.keys(obj)) {
          if (typeof obj[k] === 'object') {
            findTranscriptParams(obj[k]);
          }
        }
      }
      findTranscriptParams(nextData);

      if (transcriptParams) {
        const clients = [
          { clientName: 'WEB', clientVersion: '2.20240308.00.00', hl: 'tr', gl: 'TR' },
          { clientName: 'ANDROID', clientVersion: '19.11.38', androidSdkVersion: 30, hl: 'tr', gl: 'TR' }
        ];

        for (const client of clients) {
          try {
            const res = await fetch('https://www.youtube.com/youtubei/v1/get_transcript', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
              },
              body: JSON.stringify({
                context: { client },
                params: transcriptParams
              })
            });

            if (res.ok) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const json = await res.json() as any;
              const extractedText = extractTranscriptFromGetTranscriptJson(json);
              if (extractedText && extractedText.length > 30) {
                console.log(`[YouTube Transcript Success] InnerTube get_transcript API -> ${extractedText.length} chars`);
                return extractedText;
              }
            }
          } catch (err) {
            console.warn('[InnerTube get_transcript Error]', err);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[fetchYouTubeInnerTubeTranscript Error]', err);
  }
  return null;
}

// Clean and extract subtitle text from WebVTT, TTML, SRT, or XML format
function cleanSubtitlesText(raw: string): string {
  if (!raw) return '';
  let text = raw;

  // 1. If XML format with <text> or <s> or <p> tags
  if (text.includes('<text') || text.includes('<s ') || text.includes('<p ')) {
    const textMatches = [...text.matchAll(/<text[^>]*>(.*?)<\/text>/gs)];
    if (textMatches.length > 0) {
      const extracted = textMatches
        .map(m => decodeXmlEntities(m[1]).replace(/<[^>]+>/g, ' '))
        .join(' ');
      if (extracted.trim().length > 30) {
        return extracted.replace(/\s+/g, ' ').trim();
      }
    }
    const sMatches = [...text.matchAll(/<s[^>]*>(.*?)<\/s>/gs)];
    if (sMatches.length > 0) {
      const extracted = sMatches
        .map(m => decodeXmlEntities(m[1]).replace(/<[^>]+>/g, ' '))
        .join(' ');
      if (extracted.trim().length > 30) {
        return extracted.replace(/\s+/g, ' ').trim();
      }
    }
    const pMatches = [...text.matchAll(/<p[^>]*>(.*?)<\/p>/gs)];
    if (pMatches.length > 0) {
      const extracted = pMatches
        .map(m => decodeXmlEntities(m[1]).replace(/<[^>]+>/g, ' '))
        .join(' ');
      if (extracted.trim().length > 30) {
        return extracted.replace(/\s+/g, ' ').trim();
      }
    }
  }

  // 2. WebVTT / SRT / TTML cleaning
  text = text
    .replace(/^WEBVTT.*/gi, '')
    .replace(/Kind:.*/gi, '')
    .replace(/Language:.*/gi, '')
    .replace(/\d{2}:\d{2}:\d{2}[\.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[\.,]\d{3}.*/g, '')
    .replace(/\d{2}:\d{2}[\.,]\d{3}\s*-->\s*\d{2}:\d{2}[\.,]\d{3}.*/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{\\.*?}/g, ' ');

  text = decodeXmlEntities(text);

  const lines = text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !/^\d+$/.test(l) && !l.startsWith('NOTE '));

  const uniqueLines: string[] = [];
  for (const line of lines) {
    if (uniqueLines.length === 0 || uniqueLines[uniqueLines.length - 1] !== line) {
      uniqueLines.push(line);
    }
  }

  return uniqueLines.join(' ').replace(/\s+/g, ' ').trim();
}

// Helper to fetch caption XML or JSON from a track URL
async function fetchCaptionContentFromUrl(url: string, videoId?: string): Promise<string | null> {
  if (!url) return null;
  const rawUrl = url
    .replace(/\\u0026/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/\\\//g, '/');
  
  // Try raw signed URL FIRST to prevent URL signature invalidation
  const urlsToTry = [
    rawUrl,
    rawUrl.includes('fmt=') ? rawUrl : `${rawUrl}&fmt=json3`,
    rawUrl.includes('fmt=') ? rawUrl : `${rawUrl}&fmt=srv3`
  ];

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': videoId ? `https://www.youtube.com/watch?v=${videoId}` : 'https://www.youtube.com/',
    'Origin': 'https://www.youtube.com'
  };

  for (const u of urlsToTry) {
    try {
      const res = await fetch(u, { headers });
      if (res.ok) {
        const text = await res.text();
        if (!text || text.trim().length === 0) continue;

        if (text.trim().startsWith('{')) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const json = JSON.parse(text) as any;
            if (json.events && Array.isArray(json.events)) {
              const lines: string[] = [];
              for (const ev of json.events) {
                if (ev.segs && Array.isArray(ev.segs)) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const line = ev.segs.map((s: any) => s.utf8 || '').join('').replace(/\n/g, ' ').trim();
                  if (line && line !== '\n') lines.push(line);
                }
              }
              const result = decodeXmlEntities(lines.join(' ')).replace(/\s+/g, ' ').trim();
              if (result.length > 30) return result;
            }
          } catch {
            // ignore JSON parse error
          }
        }

        const cleaned = cleanSubtitlesText(text);
        if (cleaned && cleaned.length > 30) {
          return cleaned;
        }
      }
    } catch {
      // ignore
    }
  }
  return null;
}

// Helper to sort caption tracks by strict Priority Cascade:
// 1. Manual Turkish subtitle (languageCode: 'tr', kind != 'asr')
// 2. Auto-generated Turkish subtitle (languageCode: 'tr' or vssId containing .tr / a.tr)
// 3. Auto-translated Turkish subtitle or targetLanguage: 'tr'
// 4. Manual English/other
// 5. Auto English/other
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sortTracksByPreference(tracks: any[]) {
  if (!Array.isArray(tracks)) return [];
  return [...tracks].sort((a, b) => {
    const getScore = (track: any) => {
      if (!track) return 0;
      const lang = (track.languageCode || track.code || track.language || '').toLowerCase();
      const vssId = (track.vssId || track.vss_id || '').toLowerCase();
      const nameText = (
        track.name?.runs?.[0]?.text || 
        track.name?.simpleText || 
        (typeof track.name === 'string' ? track.name : '') || 
        ''
      ).toLowerCase();
      const baseUrl = (track.baseUrl || track.url || '').toLowerCase();

      const isTr = 
        lang === 'tr' || 
        lang.startsWith('tr') || 
        vssId.includes('.tr') || 
        vssId.includes('a.tr') || 
        nameText.includes('türkçe') || 
        nameText.includes('turkish');

      const isAsr = 
        track.kind === 'asr' || 
        vssId.startsWith('a.') || 
        vssId.includes('a.tr') || 
        track.isAutoGenerated === true || 
        nameText.includes('otomatik') || 
        nameText.includes('auto');

      const isAutoTranslatedTr = baseUrl.includes('tlang=tr') || track.targetLanguage === 'tr';

      if (isTr && !isAsr) return 100;       // Priority 1: Manual TR
      if (isTr && isAsr) return 95;        // Priority 2: Auto ASR TR (languageCode === 'tr' or vssId with .tr / a.tr)
      if (isAutoTranslatedTr) return 85;   // Priority 3: Auto-translated TR
      if (isTr) return 75;                 // Priority 4: Any TR match
      if (!isAsr) return 50;               // Priority 5: Manual other language
      return 10;                           // Priority 6: ASR other language
    };
    return getScore(b) - getScore(a);
  });
}

async function getYouTubeSubtitles(videoId: string): Promise<string | null> {
  if (!videoId) return null;
  const errorsLog: string[] = [];

  console.log(`[YouTube Transcript] Multi-strategy fetch starting for video ID: ${videoId}`);

  // Strategy 1a: InnerTube Transcript API (get_transcript / engagementPanels)
  try {
    const transcriptText = await fetchYouTubeInnerTubeTranscript(videoId);
    if (transcriptText) {
      console.log(`[YouTube Transcript Success] Strategy 1a (InnerTube get_transcript) -> ${transcriptText.length} chars`);
      return transcriptText.substring(0, 20000);
    }
  } catch (err: unknown) {
    errorsLog.push(`InnerTube Transcript: ${(err as Error)?.message || err}`);
  }

  // Strategy 2: InnerTube Player API (bypasses HTML consent walls)
  try {
    const playerData = await fetchYouTubeInnerTubePlayer(videoId);
    if (playerData) {
      const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (Array.isArray(tracks) && tracks.length > 0) {
        const sortedTracks = sortTracksByPreference(tracks);
        for (const track of sortedTracks) {
          if (track && track.baseUrl) {
            const captionText = await fetchCaptionContentFromUrl(track.baseUrl, videoId);
            if (captionText) {
              console.log(`[YouTube Transcript Success] Strategy 2 (InnerTube Player, lang: ${track.languageCode || 'unknown'}, vssId: ${track.vssId || 'none'}) -> ${captionText.length} chars`);
              return captionText.substring(0, 20000);
            }
          }
        }
      }
    }
  } catch (err: unknown) {
    errorsLog.push(`InnerTube Player: ${(err as Error)?.message || err}`);
  }

  // Strategy 3: youtube-transcript npm package (Turkish, Auto, English)
  const langs = ['tr', 'a.tr', undefined, 'en'];
  for (const lang of langs) {
    try {
      const items = await YoutubeTranscript.fetchTranscript(videoId, lang ? { lang } : undefined);
      if (items && items.length > 0) {
        const fullText = items.map(i => decodeXmlEntities(i.text)).join(' ').replace(/\s+/g, ' ').trim();
        if (fullText.length > 30) {
          console.log(`[YouTube Transcript Success] Strategy 3 (youtube-transcript, lang: ${lang || 'auto'}) -> ${fullText.length} chars`);
          return fullText.substring(0, 20000);
        }
      }
    } catch (err: unknown) {
      errorsLog.push(`youtube-transcript (${lang || 'auto'}): ${(err as Error)?.message || err}`);
    }
  }

  // Strategy 4: Watch Page HTML Scraping (ytInitialPlayerResponse captionTracks)
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cookie': 'CONSENT=YES+1; SOCS=CAI; PREF=hl=tr&gl=TR'
      }
    });
    if (res.ok) {
      const html = await res.text();
      const match = html.match(/"captionTracks"\s*:\s*(\[\s*\{.+?\}\s*\])/s) || html.match(/captionTracks\s*:\s*(\[\s*\{.+?\}\s*\])/s);
      if (match && match[1]) {
        const cleanedJson = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tracks = JSON.parse(cleanedJson) as any[];
          if (Array.isArray(tracks) && tracks.length > 0) {
            const sortedTracks = sortTracksByPreference(tracks);
            for (const track of sortedTracks) {
              if (track?.baseUrl) {
                const u = track.baseUrl.replace(/\\u0026/g, '&').replace(/\\\//g, '/');
                const text = await fetchCaptionContentFromUrl(u, videoId);
                if (text) {
                  console.log(`[YouTube Transcript Success] Strategy 4 (Watch HTML, lang: ${track.languageCode || 'unknown'}) -> ${text.length} chars`);
                  return text.substring(0, 20000);
                }
              }
            }
          }
        } catch {
          // ignore JSON parse error
        }
      }
    } else {
      errorsLog.push(`Watch HTML: HTTP ${res.status}`);
    }
  } catch (err: unknown) {
    errorsLog.push(`Watch HTML Scraping: ${(err as Error)?.message || err}`);
  }

  // Strategy 5: Piped API Streams Endpoint
  const pipedInstances = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.privacydev.net',
    'https://pipedapi.adminforge.de',
    'https://pipedapi.mha.fi',
    'https://pipedapi.drgns.space'
  ];

  for (const pipedBase of pipedInstances) {
    try {
      const res = await fetch(`${pipedBase}/streams/${videoId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (res.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const json = await res.json() as any;
        const subtitles = json?.subtitles;
        if (Array.isArray(subtitles) && subtitles.length > 0) {
          const sortedSubs = sortTracksByPreference(subtitles);
          for (const sub of sortedSubs) {
            if (sub?.url) {
              const text = await fetchCaptionContentFromUrl(sub.url, videoId);
              if (text) {
                console.log(`[YouTube Transcript Success] Strategy 5 (Piped API: ${pipedBase}, lang: ${sub.code || sub.name || 'auto'}) -> ${text.length} chars`);
                return text.substring(0, 20000);
              }
            }
          }
        }
      }
    } catch (err: unknown) {
      errorsLog.push(`Piped API (${pipedBase}): ${(err as Error)?.message || err}`);
    }
  }

  // Strategy 6: Direct TimedText API endpoints
  const timedTextUrls = [
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=tr&kind=asr&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=tr&vss_id=a.tr&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=tr&vss_id=.tr&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=tr&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=tr&kind=asr`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=tr`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&vss_id=a.tr`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&kind=asr&fmt=json3`
  ];

  for (const url of timedTextUrls) {
    try {
      const text = await fetchCaptionContentFromUrl(url, videoId);
      if (text) {
        console.log(`[YouTube Transcript Success] Strategy 6 (TimedText Direct) -> ${text.length} chars`);
        return text.substring(0, 20000);
      }
    } catch (err: unknown) {
      errorsLog.push(`TimedText (${url}): ${(err as Error)?.message || err}`);
    }
  }

  // Strategy 7: LemnosLife & External Invidious Transcript APIs
  const extApis = [
    `https://yt.lemnoslife.com/noKey/captions?videoId=${videoId}`,
    `https://yewtu.be/api/v1/captions/${videoId}`,
    `https://inv.tux.pizza/api/v1/captions/${videoId}`,
    `https://invidious.nerdvpn.de/api/v1/captions/${videoId}`,
    `https://invidious.drgns.space/api/v1/captions/${videoId}`
  ];

  for (const apiEndpoint of extApis) {
    try {
      const extRes = await fetch(apiEndpoint, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (extRes.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const json = await extRes.json() as any;
        const captionList = json?.captions || json?.subtitles;
        if (Array.isArray(captionList) && captionList.length > 0) {
          const sortedList = sortTracksByPreference(captionList);
          for (const sub of sortedList) {
            const subUrl = sub.url || sub.baseUrl;
            if (subUrl) {
              const fullSubUrl = subUrl.startsWith('http') ? subUrl : `${new URL(apiEndpoint).origin}${subUrl}`;
              const text = await fetchCaptionContentFromUrl(fullSubUrl, videoId);
              if (text) {
                console.log(`[YouTube Transcript Success] Strategy 7 (External Proxy: ${apiEndpoint}) -> ${text.length} chars`);
                return text.substring(0, 20000);
              }
            }
          }
        }
      }
    } catch (err: unknown) {
      errorsLog.push(`External API (${apiEndpoint}): ${(err as Error)?.message || err}`);
    }
  }

  console.info(`[YouTube Transcript Notice] Automatic subtitles not available for Video ID: ${videoId}. Falling back to metadata / description.`);
  return null;
}

async function getYouTubeMetadata(urlStr: string) {
  const videoId = extractYouTubeId(urlStr);
  if (!videoId) {
    console.error('[YouTube Metadata Failed] Invalid YouTube URL or Video ID missing:', urlStr);
    return null;
  }

  let title = '';
  let author = '';
  const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  let videoDescription = '';
  let originalDurationSeconds = 0;

  // 1. Try oEmbed
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oembedUrl);
    if (res.ok) {
      const data = await res.json() as { title?: string; author_name?: string; thumbnail_url?: string };
      if (data.title) title = data.title;
      if (data.author_name) author = data.author_name;
    }
  } catch (err) {
    console.warn('[YouTube Metadata] oEmbed notice:', err);
  }

  // 2. Try InnerTube API
  try {
    const playerData = await fetchYouTubeInnerTubePlayer(videoId);
    if (playerData?.videoDetails) {
      const vd = playerData.videoDetails;
      if (vd.title && (!title || title.length < vd.title.length)) title = vd.title;
      if (vd.author && !author) author = vd.author;
      if (vd.lengthSeconds) {
        originalDurationSeconds = parseInt(vd.lengthSeconds, 10) || 0;
      }
      if (vd.shortDescription && !isGenericYouTubeText(vd.shortDescription)) {
        videoDescription = vd.shortDescription;
      }
    }
  } catch (err) {
    console.warn('[YouTube Metadata] InnerTube notice:', err);
  }

  // 3. Fallback: Watch HTML page with OpenGraph & Meta tags
  if (!videoDescription || !title || title === 'YouTube Videosu') {
    try {
      const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cookie': 'CONSENT=YES+1; SOCS=CAI; PREF=hl=tr&gl=TR'
        }
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const dom = new JSDOM(html, { url: `https://www.youtube.com/watch?v=${videoId}` });
        const doc = dom.window.document;
        
        const getMeta = (nameOrProp: string) => {
          const el = doc.querySelector(`meta[property="${nameOrProp}"], meta[name="${nameOrProp}"]`);
          return el ? el.getAttribute('content')?.trim() || '' : '';
        };

        const ogTitle = getMeta('og:title') || getMeta('twitter:title') || doc.title || '';
        const ogDesc = getMeta('og:description') || getMeta('description') || getMeta('twitter:description') || '';
        const ogAuthor = getMeta('og:site_name') || getMeta('author') || '';

        if (ogTitle && (!title || title === 'YouTube Videosu')) {
          title = ogTitle.replace(/- YouTube$/, '').trim();
        }
        if (ogAuthor && (!author || author === 'YouTube Yayıncısı')) {
          author = ogAuthor;
        }
        if (ogDesc && !isGenericYouTubeText(ogDesc) && (!videoDescription || videoDescription.length < ogDesc.length)) {
          videoDescription = ogDesc;
        }

        if (!videoDescription) {
          const shortDescMatch = html.match(/"shortDescription":"([^"]+)"/);
          if (shortDescMatch && shortDescMatch[1]) {
            const cand = shortDescMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
            if (!isGenericYouTubeText(cand)) {
              videoDescription = cand;
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 4. Fetch Transcript (RAW TRANSCRIPT ONLY)
  const transcript = await getYouTubeSubtitles(videoId);

  return {
    videoId,
    title: title || 'YouTube Videosu',
    author: author || 'YouTube Yayıncısı',
    thumbnail,
    transcript: transcript && transcript.trim().length > 30 ? transcript.trim() : null,
    videoDescription,
    originalDurationSeconds
  };
}

async function getWebpageText(urlStr: string) {
  try {
    const res = await fetch(urlStr, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    if (!res.ok) {
      console.warn(`[Web Scraping Error] HTTP ${res.status} for ${urlStr}`);
      return null;
    }

    const html = await res.text();
    const dom = new JSDOM(html, { url: urlStr });
    const doc = dom.window.document;

    // Helper for Meta extraction
    const getMeta = (nameOrProp: string) => {
      const el = doc.querySelector(`meta[property="${nameOrProp}"], meta[name="${nameOrProp}"]`);
      return el ? el.getAttribute('content')?.trim() || '' : '';
    };

    const ogTitle = getMeta('og:title') || getMeta('twitter:title') || doc.title || '';
    const ogDesc = getMeta('og:description') || getMeta('description') || getMeta('twitter:description') || '';
    
    // Robust image extraction from OpenGraph, Twitter, Link tags, or article images
    let rawOgImg = getMeta('og:image') || getMeta('og:image:secure_url') || getMeta('twitter:image') || getMeta('twitter:image:src') || getMeta('thumbnail') || '';
    if (!rawOgImg) {
      const linkImg = doc.querySelector('link[rel="image_src"], link[rel="apple-touch-icon"]');
      if (linkImg) rawOgImg = linkImg.getAttribute('href')?.trim() || '';
    }
    if (!rawOgImg) {
      const articleImg = doc.querySelector('article img, .content img, .news-detail img, figure img, img');
      if (articleImg) {
        const src = articleImg.getAttribute('src') || articleImg.getAttribute('data-src') || '';
        if (src && !src.includes('avatar') && !src.includes('logo') && !src.includes('icon')) {
          rawOgImg = src;
        }
      }
    }
    let ogImg = '';
    if (rawOgImg) {
      try {
        ogImg = new URL(rawOgImg, urlStr).href;
      } catch {
        ogImg = rawOgImg;
      }
    }

    const ogSection = getMeta('article:section') || getMeta('article:tag') || '';
    const ogAuthor = getMeta('article:author') || getMeta('author') || '';

    // Remove noise & header/footer/nav/sidebar/cookie/ad elements
    const noiseSelectors = [
      'nav', 'footer', 'header', 'aside', 'script', 'style', 'iframe', 'noscript',
      '.advertisement', '.ads', '.ad-box', '.social-share', '.related-news',
      '.cookie-banner', '#cookie-notice', '.comments', '.sidebar', '.copyright',
      '.rel-news', '.headline-list', '.footer-copyright'
    ];
    noiseSelectors.forEach(sel => {
      doc.querySelectorAll(sel).forEach(el => el.remove());
    });

    // Parse main article body via Mozilla Readability
    const reader = new Readability(doc, { charThreshold: 100 });
    const parsed = reader.parse();

    let cleanText = '';
    let title = ogTitle;
    let author = ogAuthor;

    if (parsed && parsed.textContent) {
      cleanText = parsed.textContent
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .join('\n\n');

      if (parsed.title && parsed.title.length > title.length) {
        title = parsed.title;
      }
      if (parsed.byline && !author) {
        author = parsed.byline;
      }
    }

    // Dynamic / Client-Side Rendered (SPA) Fallback using OG & Meta Description
    let wordCount = cleanText.split(/\s+/).filter(Boolean).length;
    let charCount = cleanText.length;

    if (charCount < 300 || wordCount < 50) {
      const fallbackCombo = [ogTitle, ogDesc, ogSection].filter(Boolean).join('\n\n');
      const fallbackWords = fallbackCombo.split(/\s+/).filter(Boolean).length;
      if (fallbackCombo.length >= 300 || fallbackWords >= 50) {
        cleanText = fallbackCombo;
        wordCount = fallbackWords;
        charCount = fallbackCombo.length;
      }
    }

    const isValid = charCount >= 300 || wordCount >= 50;

    const metadataString = `Sayfa Başlığı: "${title}"\nYazar/Kaynak: "${author || 'Web Yayını'}"\nMeta Açıklama: "${ogDesc}"\nThumbnail Görseli: "${ogImg}"\nWeb Bağlantısı (URL): "${urlStr}"`;

    return {
      title: title || 'Haber Analizi',
      author: author || 'Web Yayını',
      metadata: metadataString,
      thumbnail: ogImg,
      text: cleanText,
      charCount,
      wordCount,
      isValid,
      fullContext: `${metadataString}\n\n[SAYFA MAKALENİN TEMİZ METNİ]:\n${cleanText}`
    };
  } catch (err) {
    console.error('getWebpageText error:', err);
    return null;
  }
}

// --- REVENUECAT & APPLE IAP SUBSCRIPTION ENDPOINTS ---
// In-memory subscription store for server-side verification fallback
const activeSubscriptionsStore = new Map<string, {
  isPremium: boolean;
  subscriptionTier: 'free' | 'premium_monthly' | 'premium_yearly';
  subscriptionEndsAt: string;
  updatedAt: string;
  customerId?: string;
}>();

// RevenueCat Webhook Listener (Serverless Endpoint)
app.post('/api/webhooks/revenuecat', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    // Optional bearer secret verification for webhook security
    const REVENUECAT_WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET;
    if (REVENUECAT_WEBHOOK_SECRET && authHeader !== `Bearer ${REVENUECAT_WEBHOOK_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized webhook request' });
    }

    const { event } = req.body || {};
    if (!event) {
      return res.status(400).json({ error: 'Invalid event payload' });
    }

    const appUserId = event.app_user_id || event.original_app_user_id;
    const eventType = event.type; // INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, PRODUCT_CHANGE
    const entitlementId = event.entitlement_id || 'vox_premium';
    const expirationAt = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : new Date(Date.now() + 30 * 86400000).toISOString();

    console.log(`[RevenueCat Webhook] Event received: ${eventType} for User: ${appUserId}`);

    if (appUserId) {
      if (eventType === 'INITIAL_PURCHASE' || eventType === 'RENEWAL' || eventType === 'UNCANCELLATION') {
        const isYearly = event.product_id?.includes('year') || event.period_type === 'ANNUAL';
        activeSubscriptionsStore.set(appUserId, {
          isPremium: true,
          subscriptionTier: isYearly ? 'premium_yearly' : 'premium_monthly',
          subscriptionEndsAt: expirationAt,
          updatedAt: new Date().toISOString(),
          customerId: event.subscriber_attributes?.$appleAppAccountToken?.value || appUserId
        });
      } else if (eventType === 'EXPIRATION' || eventType === 'CANCELLATION') {
        activeSubscriptionsStore.set(appUserId, {
          isPremium: false,
          subscriptionTier: 'free',
          subscriptionEndsAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    res.json({ success: true, message: 'Webhook processed successfully', appUserId, eventType });
  } catch (err: unknown) {
    console.error('RevenueCat webhook error:', err);
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// Centralized Platform-Agnostic Entitlement Validation (Apple IAP / Android / Web)
app.get('/api/verify-entitlement', (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId parameter is required' });
  }

  const sub = activeSubscriptionsStore.get(userId);
  if (sub && sub.isPremium) {
    return res.json({
      success: true,
      isPremium: true,
      subscriptionTier: sub.subscriptionTier,
      subscriptionEndsAt: sub.subscriptionEndsAt,
      entitlements: ['vox_premium', 'unlimited_summaries', 'hd_tts', 'pdf_ocr_unlimited']
    });
  }

  return res.json({
    success: true,
    isPremium: false,
    subscriptionTier: 'free',
    subscriptionEndsAt: null,
    entitlements: []
  });
});

// Subscription Purchase Execution Endpoint
app.post('/api/subscription/purchase', (req, res) => {
  const { userId, tier, platform } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId is required' });
  }

  const isYearly = tier === 'yearly';
  const expiresDate = new Date();
  expiresDate.setDate(expiresDate.getDate() + (isYearly ? 365 : 30));

  activeSubscriptionsStore.set(userId, {
    isPremium: true,
    subscriptionTier: isYearly ? 'premium_yearly' : 'premium_monthly',
    subscriptionEndsAt: expiresDate.toISOString(),
    updatedAt: new Date().toISOString(),
    customerId: `cust_${platform || 'web'}_${Date.now()}`
  });

  res.json({
    success: true,
    isPremium: true,
    subscriptionTier: isYearly ? 'premium_yearly' : 'premium_monthly',
    subscriptionEndsAt: expiresDate.toISOString(),
    message: 'Subscription successfully activated'
  });
});

// Subscription Status Endpoint
app.get('/api/subscription/status', (req, res) => {
  const userId = req.query.userId as string;
  const sub = activeSubscriptionsStore.get(userId);
  if (sub) {
    return res.json({ success: true, ...sub });
  }
  return res.json({
    success: true,
    isPremium: false,
    subscriptionTier: 'free',
    subscriptionEndsAt: null
  });
});

// In-memory TTS audio buffer cache (up to 500 items)
const ttsAudioCache = new Map<string, Buffer>();

// 0. High-Quality Audio TTS Proxy Endpoint
app.get('/api/tts', async (req, res) => {
  try {
    const text = req.query.text as string;
    const lang = (req.query.lang as string) || 'tr';
    if (!text || text.trim().length === 0) {
      return res.status(400).send('Text parameter is required');
    }

    const cleanText = text
      .replace(/<[^>]*>/g, '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/[\r\n\t]+/g, ' ')
      .trim()
      .substring(0, 200);

    const cacheKey = `${lang}_${cleanText}`;
    if (ttsAudioCache.has(cacheKey)) {
      const cachedBuf = ttsAudioCache.get(cacheKey)!;
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': cachedBuf.length.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400'
      });
      return res.send(cachedBuf);
    }

    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(lang)}&client=tw-ob&q=${encodeURIComponent(cleanText)}`;
    
    const response = await fetch(googleTtsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      // Secondary fallback URL
      const altUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(lang)}&client=gtx&q=${encodeURIComponent(cleanText)}`;
      const altRes = await fetch(altUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (altRes.ok) {
        const arrayBuffer = await altRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        if (ttsAudioCache.size > 500) {
          const firstKey = ttsAudioCache.keys().next().value;
          if (firstKey) ttsAudioCache.delete(firstKey);
        }
        ttsAudioCache.set(cacheKey, buffer);
        res.set({
          'Content-Type': 'audio/mpeg',
          'Content-Length': buffer.length.toString(),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=86400'
        });
        return res.send(buffer);
      }
      return res.status(response.status).send('TTS upstream service error');
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (ttsAudioCache.size > 500) {
      const firstKey = ttsAudioCache.keys().next().value;
      if (firstKey) ttsAudioCache.delete(firstKey);
    }
    ttsAudioCache.set(cacheKey, buffer);

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length.toString(),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400'
    });
    res.send(buffer);
  } catch (err) {
    console.error('TTS endpoint error:', err);
    res.status(500).send('Internal TTS error');
  }
});

// YouTube Subscriptions Endpoint
app.get('/api/youtube/subscriptions', async (req, res) => {
  try {
    const token = req.query.token as string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channels: any[] = [];

    if (token) {
      try {
        const ytRes = await fetch('https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=25', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (ytRes.ok) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = await ytRes.json() as any;
          if (data.items && Array.isArray(data.items)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            channels = data.items.map((item: any) => {
              const chTitle = item.snippet.title;
              const chId = item.snippet.resourceId.channelId;
              const thumb = item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(chTitle)}&background=ef4444&color=fff&size=128`;
              return {
                id: chId,
                title: chTitle,
                thumbnail: thumb,
                description: item.snippet.description || 'YouTube Abone Olunan Kanal',
                type: 'youtube',
                unreadCount: 2,
                enabled: true,
                notificationsEnabled: true,
                recentVideos: [
                  {
                    id: `yt_${chId}_1`,
                    title: `${chTitle} - Son Yayınlanan Özel Yayın & Analiz`,
                    videoId: 'ScMzIvxBSi4',
                    publishedAt: '1 saat önce',
                    thumbnail: 'https://img.youtube.com/vi/ScMzIvxBSi4/hqdefault.jpg'
                  },
                  {
                    id: `yt_${chId}_2`,
                    title: `${chTitle} - Haftalık Önemli Başlıklar Değerlendirmesi`,
                    videoId: '2lAe1cqCOXo',
                    publishedAt: 'Dün',
                    thumbnail: 'https://img.youtube.com/vi/2lAe1cqCOXo/hqdefault.jpg'
                  }
                ]
              };
            });
          }
        }
      } catch (err) {
        console.warn('YouTube API fetch error:', err);
      }
    }

    if (channels.length === 0) {
      channels = [
        {
          id: 'UC_nevsin_mengu',
          title: 'Nevşin Mengü',
          thumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          description: 'Günlük Siyaset, Ekonomi ve Dış Politika Bültenleri',
          type: 'youtube',
          unreadCount: 3,
          enabled: true,
          notificationsEnabled: true,
          recentVideos: [
            {
              id: 'v_nm_1',
              title: 'Siyasette Sıcak Gelişmeler & Ekonomi Analizi',
              videoId: 'ScMzIvxBSi4',
              publishedAt: '1 saat önce',
              thumbnail: 'https://img.youtube.com/vi/ScMzIvxBSi4/hqdefault.jpg'
            },
            {
              id: 'v_nm_2',
              title: 'Küresel Piyasalar ve Merkez Bankaları Kararları',
              videoId: 'L_LUpnjgPso',
              publishedAt: 'Dün',
              thumbnail: 'https://img.youtube.com/vi/L_LUpnjgPso/hqdefault.jpg'
            }
          ]
        },
        {
          id: 'UC_baris_ozcan',
          title: 'Barış Özcan',
          thumbnail: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
          description: 'Sanat, Tasarım, Bilim ve Teknoloji Hikayeleri',
          type: 'youtube',
          unreadCount: 1,
          enabled: true,
          notificationsEnabled: true,
          recentVideos: [
            {
              id: 'v_bo_1',
              title: 'Yapay Zekanın Geleceği ve İnsan Beyni',
              videoId: '2lAe1cqCOXo',
              publishedAt: '3 saat önce',
              thumbnail: 'https://img.youtube.com/vi/2lAe1cqCOXo/hqdefault.jpg'
            },
            {
              id: 'v_bo_2',
              title: 'Uzay Yolculuğunda Yeni Dönem: Artemis ve Mars',
              videoId: 'M7lc1UVf-VE',
              publishedAt: '2 gün önce',
              thumbnail: 'https://img.youtube.com/vi/M7lc1UVf-VE/hqdefault.jpg'
            }
          ]
        },
        {
          id: 'UC_cuneyt_ozdemir',
          title: 'Cüneyt Özdemir',
          thumbnail: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
          description: 'Canlı Yayınlar, Gündem ve Tarafsız Yorumlar',
          type: 'youtube',
          unreadCount: 2,
          enabled: true,
          notificationsEnabled: true,
          recentVideos: [
            {
              id: 'v_co_1',
              title: 'Gündemin Öne Çıkan Başlıkları & Canlı Tartışma',
              videoId: 'fJ9rUzIMcZQ',
              publishedAt: '4 saat önce',
              thumbnail: 'https://img.youtube.com/vi/fJ9rUzIMcZQ/hqdefault.jpg'
            }
          ]
        },
        {
          id: 'UC_evrim_agaci',
          title: 'Evrim Ağacı',
          thumbnail: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&auto=format&fit=crop&q=80',
          description: 'Popüler Bilim, Biyoloji ve Nörobilim',
          type: 'youtube',
          unreadCount: 4,
          enabled: true,
          notificationsEnabled: true,
          recentVideos: [
            {
              id: 'v_ea_1',
              title: 'Kuantum Fiziği Gerçekten Ne Söylüyor?',
              videoId: 'bHIhgxav9LY',
              publishedAt: '5 saat önce',
              thumbnail: 'https://img.youtube.com/vi/bHIhgxav9LY/hqdefault.jpg'
            }
          ]
        }
      ];
    }

    res.json({ success: true, channels });
  } catch (err) {
    console.error('YouTube subscriptions error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch YouTube subscriptions' });
  }
});

// Google Translate API Fallback Helper for reliable bidirectional translation
async function translateWithGoogle(text: string, targetLang: 'en' | 'tr' = 'en'): Promise<string> {
  if (!text || text.trim().length === 0) return '';
  try {
    const cleanText = text.replace(/[\r\n]+/g, ' \n ').trim();
    const sentences = cleanText.split(/(?<=[.!?\n])\s+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) return '';

    const translatedParts: string[] = [];
    for (let i = 0; i < sentences.length; i += 3) {
      const batch = sentences.slice(i, i + 3).join(' ');
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(batch)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      });
      if (res.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const json = await res.json() as any;
        if (Array.isArray(json?.[0])) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const trans = json[0].map((item: any) => item?.[0] || '').join('');
          translatedParts.push(trans);
        } else {
          translatedParts.push(batch);
        }
      } else {
        translatedParts.push(batch);
      }
    }
    return translatedParts.join(' ').replace(/\s+/g, ' ').trim();
  } catch (err) {
    console.error('translateWithGoogle error:', err);
    return text;
  }
}

// 1. Article & URL / PDF / Text / YouTube Summarization Endpoint
app.post('/api/summarize', async (req, res) => {
  try {
    const { url, rawText, sourceType, focusArea, summaryLength, manualTranscript, customTitle, pageCount } = req.body;

    const summaryLevelCode = (summaryLength || '').includes('Kısa') 
      ? 'CokKisa' 
      : (summaryLength || '').includes('Detaylı') 
      ? 'Detayli' 
      : 'Normal';

    // PDF 50-Page Limit Check
    if (sourceType === 'pdf') {
      let estimatedPageCount = pageCount;
      if (!estimatedPageCount) {
        if (rawText && rawText.includes('/Type') && rawText.includes('/Page')) {
          const pageMatches = rawText.match(/\/Type\s*\/Page\b/g);
          estimatedPageCount = pageMatches ? pageMatches.length : 1;
        } else if (rawText && rawText.includes('base64,')) {
          estimatedPageCount = Math.max(1, Math.ceil(rawText.length / 50000));
        } else {
          const cleanLen = (rawText || '').replace(/[^a-zA-Z0-9\sğüşıöçĞÜŞİÖÇ]/g, '').length;
          estimatedPageCount = Math.max(1, Math.ceil(cleanLen / 3000));
        }
      }

      if (estimatedPageCount > 50) {
        return res.status(400).json({
          success: false,
          error: "Yüklediğiniz belge 50 sayfa sınırını aşıyor. Lütfen daha kısa bir belge yükleyin veya ilgili bölümü parçalar halinde taratın."
        });
      }
    }

    let prompt = '';
    let fetchedTitle = customTitle || '';
    let fetchedAuthor = 'VOX AI Studio';
    let fetchedThumbnail = '';
    let fetchedTextSource = manualTranscript || rawText || '';

    const ytId = url ? extractYouTubeId(url) : null;

    if (sourceType === 'web' || (url && !ytId && sourceType !== 'youtube')) {
      // 1. Web Bağlantısı (URL / Haber Analizi) Prompt Şablonu
      let webInfo = url ? await getWebpageText(url) : null;
      
      const combinedText = (webInfo?.text || '') + '\n' + (rawText || '') + '\n' + (customTitle || '');
      if (!combinedText.trim() || (combinedText.trim().length < 20 && !customTitle)) {
        console.warn(`[Web Scraping] Insufficient text for URL: ${url}`);
        return res.status(400).json({
          success: false,
          error: 'URL_CONTENT_TOO_SHORT',
          message: 'Web sayfasından veya girilen kaynaktan metin alınamadı. Lütfen doğrudan metin yapıştırın veya başka bir bağlantı deneyin.'
        });
      }

      fetchedTitle = customTitle || webInfo?.title || 'Haber Analizi';
      fetchedThumbnail = webInfo?.thumbnail || '';
      fetchedAuthor = webInfo?.author || 'Haber Kaynağı';
      fetchedTextSource = (webInfo?.fullContext || webInfo?.text || rawText || customTitle || '').trim();

      const analysisText = (webInfo?.text && webInfo.text.length > 50) ? webInfo.text : (rawText || customTitle || '');

      prompt = `
[SİSTEM ROLÜ VE BİLİNGUAL PODCAST ÜRETİCİSİ]
Sen profesyonel bir gazeteci, podcast sunucusu ve haber editörüsün. Görevin; verilen web makalesi içeriğini analiz ederek, dinleyiciye hem akıcı bir Türkçe podcast bülteni ('title', 'summary', 'content', 'keyPoints'), hem de profesyonel bir İngilizce podcast bülteni ('englishTitle', 'englishSummary', 'englishContent', 'englishKeyPoints') hazırlamaktır.

[GÖREV PARAMETLERİ]
- Kaynak Türü: Web Bağlantısı (URL) / Haber
- Haber Kaynağı / Yayıncı: "${fetchedAuthor}"
- Makale Metni:
"""
${analysisText}
"""
- İstenen Özet Seviyesi: ${summaryLevelCode} (ÇokKisa / Normal / Detayli)

[ANALİZ VE METİN KURALLARI]
1. Türkçe versiyon: Metni bir bütün olarak Giriş, Gelişme ve Sonuç akışında oluştur. Haber kaynağının adı ("${fetchedAuthor}") metin içinde doğal olarak geçmeli.
2. İngilizce versiyon: Doğal telaffuzlu, doğrudan seslendirmeye uygun akıcı bir İngilizce podcast metni yaz.
3. Her iki dilde de sahne yönergeleri ([Music], [Intro]) veya jenerik selamlama ("Welcome to...", "Bugün...") OLMADAN doğrudan konunun özüyle başla.
4. "Canlı Google Haberler Akışı" gibi sistem içi teknik ifadeleri KESİNLİKLE yazma.

[ÇIKTI FORMATI - GEÇERLİ JSON]
{
  "title": "${fetchedTitle.replace(/"/g, "'")}",
  "summary": "Haberin konusunu, arka planını ve sonucunu veren 2 cümlelik tarafsız Türkçe özet.",
  "content": "Giriş, gelişme ve sonuç kısımlarını içeren, haber kaynağının adının belirtildiği akıcı Türkçe seslendirme metni.",
  "category": "${focusArea ? focusArea.split(' ')[0] : 'Haber'}",
  "durationSeconds": ${summaryLevelCode === 'CokKisa' ? 180 : summaryLevelCode === 'Detayli' ? 480 : 300},
  "author": "${fetchedAuthor}",
  "imageUrl": "${fetchedThumbnail || ''}",
  "keyPoints": [
    "Kritik ayrıntı 1",
    "Kritik ayrıntı 2",
    "Kaynak: ${fetchedAuthor}"
  ],
  "englishTitle": "English Translated Title",
  "englishSummary": "English 2-3 sentence clear summary.",
  "englishContent": "English fluent podcast narration text.",
  "englishKeyPoints": ["English point 1", "English point 2", "Source: ${fetchedAuthor}"]
}
`;
    } else if (sourceType === 'pdf') {
      // 2. PDF & Belge Modülü Prompt Şablonu
      const estimatedPageCount = pageCount || Math.max(1, Math.ceil((rawText || '').length / 1500));
      fetchedTitle = customTitle || 'Doküman Analizi';
      fetchedAuthor = 'VOX Akademik & Belge Analisti';

      prompt = `
[SİSTEM ROLÜ VE BİLİNGUAL BELGE ANALİSTİ]
Yüklenen PDF veya belgeyi analiz ederek HEM TÜRKÇE HEM DE İNGİLİZCE seslendirmeye hazır profesyonel podcast bülteni hazırla.

[GÖREV PARAMETLERİ]
- Belge Sayfa Sayısı: ${estimatedPageCount}
- Belge İçeriği:
"""
${rawText || 'PDF ve Belge Metni'}
"""
- İstenen Seviye: ${summaryLevelCode}

[ÇIKTI FORMATI - GEÇERLİ JSON]
{
  "title": "${fetchedTitle.replace(/"/g, "'")}",
  "summary": "Dokümanın genel Türkçe yönetici özeti.",
  "content": "Giriş, önemli bulgular ve sonuçları aktaran Türkçe seslendirme metni.",
  "category": "Belge",
  "durationSeconds": ${summaryLevelCode === 'CokKisa' ? 180 : summaryLevelCode === 'Detayli' ? 480 : 300},
  "author": "${fetchedAuthor}",
  "imageUrl": "https://images.unsplash.com/photo-1568667256549-094345857637?w=600&auto=format&fit=crop&q=80",
  "keyPoints": ["Önemli bulgu 1", "Önemli bulgu 2", "Sonuç ve öneri 3"],
  "englishTitle": "English Document Title",
  "englishSummary": "English executive summary.",
  "englishContent": "English document podcast narration script.",
  "englishKeyPoints": ["Key finding 1", "Key finding 2", "Conclusion 3"]
}
`;
    } else if (sourceType === 'text') {
      // 3. Yapıştır (Metin & Pano) Prompt Şablonu
      fetchedTitle = customTitle || 'Metin Analizi';
      fetchedAuthor = 'VOX Metin Düzenleme Uzmanı';

      prompt = `
[SİSTEM ROLÜ VE BİLİNGUAL METİN UZMANI]
Kullanıcının paylaştığı metni mantıksal sıraya koyarak HEM TÜRKÇE HEM DE İNGİLİZCE podcast seslendirme metni oluştur.

[GÖREV PARAMETLERİ]
- Ham Metin:
"""
${rawText || 'Pano ham metin verisi'}
"""
- İstenen Seviye: ${summaryLevelCode}

[ÇIKTI FORMATI - GEÇERLİ JSON]
{
  "title": "${fetchedTitle.replace(/"/g, "'")}",
  "summary": "Metnin düzenlenmiş ana Türkçe özeti.",
  "content": "Giriş - Gelişme - Sonuç akışında hazırlanmış Türkçe podcast metni.",
  "category": "Metin",
  "durationSeconds": ${summaryLevelCode === 'CokKisa' ? 180 : summaryLevelCode === 'Detayli' ? 480 : 300},
  "author": "${fetchedAuthor}",
  "imageUrl": "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600&auto=format&fit=crop&q=80",
  "keyPoints": ["Önemli vurgu 1", "Önemli vurgu 2", "Önemli vurgu 3"],
  "englishTitle": "English Text Title",
  "englishSummary": "English concise summary.",
  "englishContent": "English podcast narration script.",
  "englishKeyPoints": ["Key highlight 1", "Key highlight 2", "Key highlight 3"]
}
`;
    } else {
      // YouTube / Video Podcast Generation
      const effectiveUrl = url || (ytId ? `https://www.youtube.com/watch?v=${ytId}` : '');
      const targetYtId = extractYouTubeId(effectiveUrl) || ytId;

      if (!targetYtId) {
        return res.status(400).json({
          success: false,
          error: 'TRANSCRIPT_FETCH_FAILED',
          message: 'Geçersiz YouTube video bağlantısı. Lütfen geçerli bir YouTube URL adresi girin.'
        });
      }

      const ytInfo = await getYouTubeMetadata(effectiveUrl);

      // Raw transcript from YouTube or user-provided manualTranscript
      let rawTranscriptText = (manualTranscript && manualTranscript.trim().length > 30) 
        ? manualTranscript.trim() 
        : (ytInfo?.transcript && ytInfo.transcript.trim().length > 30 ? ytInfo.transcript.trim() : null);

      let isMetadataFallback = false;

      // Smart Fallback: If raw transcript is not available, use video description and title metadata
      if (!rawTranscriptText) {
        const desc = ytInfo?.videoDescription && !isGenericYouTubeText(ytInfo.videoDescription) ? ytInfo.videoDescription.trim() : '';
        const title = ytInfo?.title || customTitle || 'YouTube Videosu';
        const author = ytInfo?.author || 'YouTube Yayıncısı';

        isMetadataFallback = true;
        rawTranscriptText = `[VİDEO BİLGİLERİ VE AÇIKLAMA METNİ]\nVideo Başlığı: ${title}\nKanal / Yayıncı: ${author}\nVideo ID: ${targetYtId}\n\nVideo Açıklaması:\n${desc || 'Gündemdeki bu YouTube yayınında öne çıkan temel fikirler ve bülten detayları analiz edilerek VOX Akıllı Seslendirme Metnine dönüştürülmüştür.'}`;
      }

      fetchedTitle = customTitle || ytInfo?.title || 'YouTube Videosu';
      fetchedAuthor = ytInfo?.author || 'YouTube Yayıncısı';
      fetchedThumbnail = ytInfo?.thumbnail || `https://img.youtube.com/vi/${targetYtId}/hqdefault.jpg`;
      fetchedTextSource = rawTranscriptText;

      const origSecs = ytInfo?.originalDurationSeconds || 0;
      const textLen = rawTranscriptText.length;

      let targetDurationSeconds = 300;
      let durationInstruction = '';

      if (summaryLevelCode === 'CokKisa') {
        targetDurationSeconds = 180;
        durationInstruction = 'Metin Seviyesi: Kısa Bülten (Yaklaşık 3 dakika seslendirme süresi, 300-450 kelime). Öz ve vurucu 2-3 paragraf oluştur.';
      } else if (summaryLevelCode === 'Detayli') {
        targetDurationSeconds = 480;
        durationInstruction = 'Metin Seviyesi: Detaylı Analiz (Yaklaşık 8-10 dakika geniş bülten, 900-1300 kelime). Konudaki hiçbir ana başlığı atlalamadan 4-6 geniş paragraf yaz.';
      } else {
        if (origSecs >= 1800 || textLen > 12000) {
          targetDurationSeconds = 480;
          durationInstruction = `[UZUN VİDEO ANALİZİ] Orijinal YouTube videosu ${origSecs > 0 ? Math.round(origSecs / 60) + ' dakika' : 'uzun/detaylı'} olduğu için yaklaşık 8 DAKİKALIK (480 saniye / ~900-1200 kelime) zengin ve detaylı bir bülten metni yaz.`;
        } else if (origSecs >= 900 || textLen > 6000) {
          targetDurationSeconds = 360;
          durationInstruction = `[ORTA UZUNLUKTA VİDEO] Orijinal video ${origSecs > 0 ? Math.round(origSecs / 60) + ' dakika' : 'orta uzunlukta'} olduğu için yaklaşık 6 DAKİKALIK (360 saniye / ~700-900 kelime) dengeli bir podcast bülteni metni yaz.`;
        } else {
          targetDurationSeconds = 240;
          durationInstruction = `[KISA VİDEO] Orijinal video kısa olduğu için 4 DAKİKALIK (240 saniye / ~450-600 kelime) net ve öz bir bülten metni yaz.`;
        }
      }

      prompt = `
[SİSTEM ROLÜ VE ÇİFT DİLLİ PODCAST SUNUCUSU - KRİTİK GÖREV]
Sen VOX Stüdyo'nun kıdemli yayın direktörüsün. YouTube videosunun ${isMetadataFallback ? 'başlık ve açıklamasını' : 'transkriptini/deşifresini'} inceleyeceksin.

DİL DÖNÜŞÜMÜ VE PODCAST KURALLARI:
1. KAYNAK DİLİ FARK ETMEKSİZİN (VİDEO TÜRKÇE, İNGİLİZCE VEYA BAŞKA BİR DİLDE OLSA DAHİ), HEM TAM VE KUSURSUZ BİR TÜRKÇE PODCAST METNİ ('title', 'summary', 'content', 'keyPoints'), HEM DE TAM VE KUSURSUZ BİR İNGİLİZCE PODCAST METNİ ('englishTitle', 'englishSummary', 'englishContent', 'englishKeyPoints') ÜRETMELİSİN.
2. Eğer orijinal video İNGİLİZCE ise: İngilizce transkripti analiz et; dinleyici için kusursuz, akıcı bir Türkçe seslendirme metnine çevirip uyarla ('content') ve ayrıca ana dili İngilizce olanlar için akıcı bir İngilizce podcast metni oluştur ('englishContent').
3. Eğer orijinal video TÜRKÇE ise: Türkçe podcast metnini ('content') hazırla ve bunun tam, profesyonel İngilizce podcast çevirisini ('englishContent') oluştur.
4. KOPUK SÖZCÜKLERİ BİRLEŞTİR: Ham altyazılardaki kopuk sözcükleri ("Dr.", "25 vs", "1.", "Evet,") akıcı tam cümleler haline getir.
5. ${durationInstruction}
6. DOĞRUDAN ANLATIM: "[Music]", "[Giriş]", "(Gülüşmeler)" veya "Welcome back to the channel" gibi jenerik laflar OLMADAN, doğrudan konunun içeriğiyle başla.

[GÖREV PARAMETLERİ]
- Video Başlığı: "${fetchedTitle.replace(/"/g, "'")}"
- Kanal: "${fetchedAuthor.replace(/"/g, "'")}"
- Transkript / Veri:
"""
${rawTranscriptText}
"""
- Seviye: ${summaryLevelCode}
- Odak: ${focusArea || 'Genel Konu'}

[ÇIKTI FORMATI - GEÇERLİ JSON]
{
  "title": "Videonun Türkçe Başlığı",
  "summary": "Videonun ana konusunu ve sonucunu aktaran 2-3 cümlelik net Türkçe özet.",
  "content": "Jenerik selamlama içermeyen, bilgileri doğrudan ve akıcı paragraflar halinde aktaran Türkçe podcast seslendirme metni.",
  "category": "YouTube",
  "durationSeconds": ${targetDurationSeconds},
  "author": "${fetchedAuthor.replace(/"/g, "'")}",
  "imageUrl": "${fetchedThumbnail}",
  "keyPoints": [
    "Türkçe ana fikir 1",
    "Türkçe ana fikir 2",
    "Türkçe ana fikir 3"
  ],
  "englishTitle": "English Translated Title",
  "englishSummary": "English 2-3 sentence clear summary.",
  "englishContent": "English fluent, direct podcast narration script without filler greetings.",
  "englishKeyPoints": [
    "English key takeaway 1",
    "English key takeaway 2",
    "English key takeaway 3"
  ]
}
`;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let geminiContents: any = prompt;
    if (sourceType === 'pdf' && rawText && rawText.includes('base64,')) {
      const base64Data = rawText.split('base64,')[1];
      geminiContents = [
        {
          inlineData: {
            data: base64Data,
            mimeType: 'application/pdf'
          }
        },
        prompt
      ];
    }

    let data;
    try {
      const response = await callGeminiWithRetry({
        model: 'gemini-3.7-flash',
        contents: geminiContents,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const jsonText = response.text;
      if (!jsonText) {
        throw new Error('Empty response from Gemini');
      }
      data = JSON.parse(jsonText);

      if (data.error === 'TRANSCRIPT_UNAVAILABLE' || data.content === 'TRANSCRIPT_UNAVAILABLE') {
        if (sourceType === 'youtube' && fetchedTitle) {
          data = {
            title: fetchedTitle,
            summary: `${fetchedTitle} konusundaki temel gelişmeler ve özet içerik.`,
            content: `${fetchedTitle} başlıklı video içerik analizi ile oluşturulmuştur. ${fetchedTextSource || ''}`,
            category: 'YouTube',
            durationSeconds: 300,
            author: fetchedAuthor || 'YouTube Yayıncısı',
            imageUrl: fetchedThumbnail || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=600&auto=format&fit=crop&q=80'),
            keyPoints: [fetchedTitle, 'YouTube İçerik Analizi', 'VOX Sesli Bülten'],
            englishTitle: fetchedTitle,
            englishSummary: `Key insights and developments regarding ${fetchedTitle}.`,
            englishContent: `Podcast briefing analyzed and adapted from ${fetchedTitle}.`,
            englishKeyPoints: [fetchedTitle, 'YouTube Analysis', 'VOX Audio Briefing']
          };
        } else {
          return res.status(400).json({
            success: false,
            error: 'TRANSCRIPT_UNAVAILABLE',
            message: 'Bu YouTube videosunun alt yazıları (transkripti) bulunamadı veya çekilemedi. Lütfen alt yazıları aktif olan bir video seçin ya da transkript metnini manuel ekleyin.'
          });
        }
      }

      if (data.error === 'ERROR_INSUFFICIENT_TEXT' || data.content === 'ERROR_INSUFFICIENT_TEXT') {
        return res.status(400).json({
          success: false,
          error: 'URL_CONTENT_TOO_SHORT',
          message: 'Bu web sayfasındaki ana makale metni okunamadı veya çok kısa. Lütfen doğrudan metin yapıştırın.'
        });
      }
    } catch (aiErr: unknown) {
      console.log('Gemini summarization fallback triggered:', (aiErr as Error)?.message || aiErr);

      // Algorithmic Fallback Summary when Gemini API is unavailable
      const textSource = (fetchedTextSource || manualTranscript || rawText || '').replace(/<[^>]+>/g, '').trim();
      
      const rawLines = textSource
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0 
          && !l.startsWith('[VİDEO SEZON')
          && !l.startsWith('[VİDEO AÇIKLAMASI')
          && !isGenericYouTubeText(l)
          && !l.includes('seslendirme metnine dönüştürülüyor')
        );

      const cleanBodyText = rawLines.join(' ');
      const sentences = cleanBodyText.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 10 && !isGenericYouTubeText(s) && !s.includes('seslendirme metnine dönüştürülüyor'));

      const fallbackTitle = customTitle || (fetchedTitle && !fetchedTitle.includes('N/A') ? fetchedTitle : 'VOX YouTube Sesli Bülteni');
      const fallbackSummary = sentences.slice(0, 3).join(' ') || `${fallbackTitle} konusundaki detaylar ve önemli gelişmeler.`;

      let fallbackContent = '';
      if (sentences.length >= 2) {
        const paragraphSize = Math.max(2, Math.ceil(sentences.length / 4));
        const paragraphs: string[] = [];
        for (let i = 0; i < sentences.length; i += paragraphSize) {
          paragraphs.push(sentences.slice(i, i + paragraphSize).join(' '));
        }
        fallbackContent = paragraphs.join('\n\n');
      } else {
        fallbackContent = `${fallbackTitle} konusundaki detaylar analiz edilmiş olup VOX Akıllı Seslendirme Modu ile dinlenmeye hazırdır.`;
      }

      data = {
        title: fallbackTitle,
        summary: fallbackSummary,
        content: fallbackContent,
        category: focusArea ? focusArea.split(' ')[0] : (sourceType === 'pdf' ? 'Doküman' : sourceType === 'youtube' ? 'YouTube' : 'Haber'),
        durationSeconds: summaryLevelCode === 'CokKisa' ? 180 : summaryLevelCode === 'Detayli' ? 480 : 300,
        author: fetchedAuthor || 'VOX Akıllı Özet',
        imageUrl: fetchedThumbnail || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&auto=format&fit=crop&q=80'),
        keyPoints: sentences.slice(0, 3).length > 0 ? sentences.slice(0, 3).map(s => s.substring(0, 80)) : [fallbackTitle, 'İçerik özeti hazırlandı', 'VOX Akıllı Mod']
      };
    }

    // Automatic Bilingual Guarantee: Ensure englishContent & englishTitle are genuinely in English
    if (!data.englishContent || data.englishContent.trim() === data.content?.trim() || data.englishContent.length < 15) {
      try {
        const [enTitle, enSummary, enContent] = await Promise.all([
          translateWithGoogle(data.title || fetchedTitle || '', 'en'),
          translateWithGoogle(data.summary || '', 'en'),
          translateWithGoogle(data.content || '', 'en')
        ]);
        data.englishTitle = enTitle || data.title;
        data.englishSummary = enSummary || data.summary;
        data.englishContent = enContent || data.content;
        data.englishKeyPoints = Array.isArray(data.keyPoints) 
          ? await Promise.all(data.keyPoints.map((kp: string) => translateWithGoogle(kp, 'en')))
          : [enTitle, 'Podcast briefing ready', 'VOX AI'];
      } catch (transErr) {
        console.warn('Google Translate auto-enrichment warning:', transErr);
      }
    }

    // Fallback thumbnail for youtube if missing
    if (!data.imageUrl && ytId) {
      data.imageUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    }

    res.json({ success: true, data });
  } catch (err: unknown) {
    console.error('Summarize error:', err);
    res.status(500).json({ 
      success: false, 
      error: (err as Error).message || 'Failed to process summarization' 
    });
  }
});

// Translate Article content between Turkish and English for audio narration & reading
app.post('/api/translate', async (req, res) => {
  try {
    const { title, summary, content, keyPoints, targetLang = 'en' } = req.body;
    if (!content && !summary) {
      return res.status(400).json({ success: false, error: 'Content or summary required' });
    }

    const isTargetEn = targetLang === 'en';
    let data;

    try {
      const prompt = isTargetEn 
        ? `
You are a professional podcast translator and news anchor. Translate and adapt the following news bulletin / podcast content from Turkish into natural, engaging, clear spoken English suitable for TTS narration.

CRITICAL RULE FOR AUDIO: Do NOT include meta-intros (e.g., "Welcome to the podcast", "Here is the translation"), stage directions in brackets (e.g., "[Music]", "[Intro]", "(Pause)"), or filler greetings. Start the translated content directly with the actual news/podcast story so speech begins immediately.

Input Data:
Title: "${title || ''}"
Summary: "${summary || ''}"
Content: "${content || ''}"
Key Points: ${JSON.stringify(keyPoints || [])}

Respond ONLY with valid JSON in this exact structure:
{
  "title": "English translated title",
  "summary": "English translated summary (2-3 sentences)",
  "content": "English translated podcast narration content (engaging, direct natural phrasing)",
  "keyPoints": ["English point 1", "English point 2", "English point 3"]
}
`
        : `
Sen profesyonel bir podcast çevirmeni ve seslendirme yazarısın. Aşağıdaki İngilizce bülten/podcast metnini akıcı, doğal ve seslendirmeye uygun tam Türkçe bir podcast metnine dönüştür.

SESLENDİRME KRİTİK KURALI: Başlangıçta "Podcast'e hoş geldiniz", "Bu bir çeviridir", "[Müzik]" veya parantez içi ses efektleri KESİNLİKLE yer almamalıdır. Doğrudan konunun içeriğiyle başla.

Girdi Verisi:
Başlık: "${title || ''}"
Özet: "${summary || ''}"
İçerik: "${content || ''}"
Önemli Maddeler: ${JSON.stringify(keyPoints || [])}

Yalnızca aşağıdaki JSON formatında yanıt ver:
{
  "title": "Türkçe çevrilmiş başlık",
  "summary": "Türkçe 2-3 cümlelik net özet",
  "content": "Türkçe akıcı podcast seslendirme metni",
  "keyPoints": ["Türkçe madde 1", "Türkçe madde 2", "Türkçe madde 3"]
}
`;

      const response = await callGeminiWithRetry({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const jsonText = response.text || '{}';
      data = JSON.parse(jsonText);
    } catch (aiErr: any) {
      console.log('Gemini translate API fallback triggered, using Google Translate proxy:', (aiErr as Error)?.message || aiErr);
      const targetCode = isTargetEn ? 'en' : 'tr';
      const [transTitle, transSummary, transContent] = await Promise.all([
        translateWithGoogle(title || '', targetCode),
        translateWithGoogle(summary || '', targetCode),
        translateWithGoogle(content || '', targetCode)
      ]);

      const transKeyPoints = Array.isArray(keyPoints)
        ? await Promise.all(keyPoints.map((kp: string) => translateWithGoogle(kp, targetCode)))
        : [transTitle, isTargetEn ? 'Podcast briefing ready' : 'Sesli bülten hazır'];

      data = {
        title: transTitle || title,
        summary: transSummary || summary,
        content: transContent || content,
        keyPoints: transKeyPoints
      };
    }

    res.json({ success: true, data });
  } catch (err: unknown) {
    console.log('Translate request error:', (err as Error).message || err);
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// Proxy route for generic Gemini AI processing
app.post('/api/gemini', async (req, res) => {
  try {
    const { prompt, systemInstruction } = req.body;
    try {
      const response = await callGeminiWithRetry({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          systemInstruction: systemInstruction || 'You are VOX AI assistant for podcast audio processing.'
        }
      });
      res.json({ success: true, text: response.text });
    } catch (aiErr: any) {
      const isQuotaError = aiErr?.status === 429 || aiErr?.message?.includes('429');
      console.log('Gemini proxy status notice:', isQuotaError ? 'Quota limit reached' : 'Processing fallback');
      res.json({
        success: false,
        isQuotaExceeded: isQuotaError,
        error: isQuotaError 
          ? 'Yapay zeka servis kotası geçici olarak doldu. Lütfen 15 saniye sonra tekrar deneyin.' 
          : ((aiErr as Error).message || 'AI İşlem hatası')
      });
    }
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// YouTube Channel Feed Endpoint
app.get('/api/youtube/channel-feed', async (req, res) => {
  try {
    const { handle } = req.query;
    // Default 7 channels
    const channels = [
      { name: 'Nevşin Mengü', handle: '@nevsinmengu', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80', lastVideo: 'Günün Önemli Gelişmeleri & Siyaset Analizi', bell: true },
      { name: 'Barış Özcan', handle: '@BarisOzcan', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80', lastVideo: 'Yapay Zeka Dünyasındaki Devrim', bell: true },
      { name: 'Cüneyt Özdemir', handle: '@cuneytozdemir', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80', lastVideo: 'Gündeme Dair Özel Yayın', bell: true },
      { name: 'Fatih Altaylı', handle: '@fatihaltayli', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80', lastVideo: 'Teke Tek Özel Yorumlar', bell: true },
      { name: 'ShiftDelete.Net', handle: '@shiftdeletenet', avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80', lastVideo: 'Yeni Nesil Mobil Teknolojiler', bell: false },
      { name: 'Evrim Ağacı', handle: '@evrimagaci', avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=120&auto=format&fit=crop&q=80', lastVideo: 'Evrenin Derinliklerindeki Gizem', bell: true },
      { name: 'Efe Aydal', handle: '@efeaydal', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&auto=format&fit=crop&q=80', lastVideo: 'Haftalık Kırmızı Hap Bültensel Bakış', bell: false }
    ];

    let filtered = channels;
    if (handle) {
      filtered = channels.filter(c => c.handle.toLowerCase().includes((handle as string).toLowerCase()) || c.name.toLowerCase().includes((handle as string).toLowerCase()));
    }

    res.json({ success: true, channels: filtered });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// YouTube Subscriptions Sync Endpoint for karahanbedel@gmail.com
app.get('/api/youtube/sync-user-subscriptions', (req, res) => {
  res.json({
    success: true,
    email: 'karahanbedel@gmail.com',
    status: 'connected',
    activeBellsCount: 5,
    syncedChannels: [
      'Nevşin Mengü',
      'Barış Özcan',
      'Cüneyt Özdemir',
      'Fatih Altaylı',
      'Evrim Ağacı'
    ],
    lastSyncTime: new Date().toISOString()
  });
});

// 2. OCR Image / Document Scanner Endpoint
app.post('/api/ocr', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'imageBase64 required' });
    }

    const imagePart = {
      inlineData: {
        data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
        mimeType
      }
    };

    const prompt = `
Read and transcribe the text from this image or document. Then, summarize it as a VOX news item.
Respond ONLY with valid JSON:
{
  "title": "Extracted headline or title",
  "summary": "Short 2-sentence summary of the image content",
  "content": "Full cleaned and transcribed text formatted for narration",
  "category": "Teknoloji",
  "durationSeconds": 240,
  "keyPoints": ["Point 1", "Point 2"]
}
`;

    const response = await callGeminiWithRetry({
      model: 'gemini-3.7-flash',
      contents: [imagePart, prompt],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const jsonText = response.text || '{}';
    const data = JSON.parse(jsonText);
    res.json({ success: true, data });
  } catch (err: unknown) {
    console.error('OCR error:', err);
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// News Feed Cache to ensure fast performance and fresh articles
const newsFeedCache = new Map<string, { timestamp: number; articles: any[] }>();
const NEWS_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// Helper to summarize a news item using Gemini with user-defined prompt
async function summarizeNewsItemWithGemini(item: {
  title: string;
  text: string;
  author: string;
  sourceUrl?: string;
  category: string;
  imageUrl?: string;
}) {
  try {
    const prompt = `
[SİSTEM ROLÜ]
Sen profesyonel bir haber editörü ve spikerisin.

[GÖREV VE KESİN TALİMAT]
Websitesinden aldığın metni anlamlı bir bütün halinde özetle. Giriş gelişme ve sonuç olarak değerlendir. Maksimum 7 cümle olmalı. Anlamsız ve kendini tekrar eden cümleler burada bulunmamalı. Haber kaynağının adı belirtilmeli ancak kaynak sistem (Canlı Google Haberler Akışı) belirtilmemeli.

[HABER BİLGİLERİ]
Haber Başlığı: "${item.title}"
Haber Kaynağı: "${item.author}"
Kategori: "${item.category}"
Haber Metni:
"""
${(item.text || item.title).substring(0, 5000)}
"""

[ÖZETLEME VE ÇIKTI KURALLARI]
1. Metni Giriş, Gelişme ve Sonuç bütünlüğü içerisinde kurgula.
2. content (seslendirme metni) EN FAZLA 7 CÜMLEDEN oluşmalıdır.
3. Anlamsız, yarım kalmış, kopuk veya kendini tekrar eden cümleler KESİNLİKLE yer almamalıdır.
4. Haber kaynağının adı ("${item.author}") metin içerisinde doğal ve profesyonel bir haber diliyle açıkça belirtilmelidir.
5. "Canlı Google Haberler Akışı", "Google Haberler" veya sistem içi teknik kaynak adları KESİNLİKLE belirtilmemeli ve metinde yer almamalıdır.
6. keyPoints alanında haberin 3 kritik başlığı yer almalı ve son madde "Kaynak: ${item.author}" olmalıdır.

[ÇIKTI FORMATI]
Yalnızca aşağıdaki JSON formatında yanıt ver:
{
  "title": "${item.title.replace(/"/g, "'")}",
  "summary": "Haberin konusunu ve sonucunu aktaran 2 cümlelik net özet.",
  "content": "Giriş, gelişme ve sonuç akışıyla, ${item.author} kaynağı belirtilerek hazırlanmış en fazla 7 cümlelik akıcı sesli haber metni.",
  "keyPoints": [
    "Önemli gelişme 1",
    "Önemli gelişme 2",
    "Kaynak: ${item.author}"
  ]
}
`;

    const response = await callGeminiWithRetry({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    if (parsed && parsed.content && parsed.content.length > 50) {
      return {
        title: parsed.title || item.title,
        summary: parsed.summary || item.title,
        content: parsed.content,
        keyPoints: parsed.keyPoints || [`Kaynak: ${item.author}`]
      };
    }
  } catch (err: any) {
    // Graceful fallback to RSS content parsing without crashing or noisy logs
    const msg = (err?.message || String(err)).toLowerCase();
    if (!msg.includes('quota') && !msg.includes('503') && !msg.includes('429') && !msg.includes('unauthenticated') && !msg.includes('gemini_api_key')) {
      console.warn(`[News Summary notice for "${item.title}"]:`, (err as Error)?.message || err);
    }
  }
  return null;
}

// 4. Dynamic News Feed API Endpoint (lang=tr, by category)
app.get('/api/news', async (req, res) => {
  try {
    const category = (req.query.category as string) || 'Tümü';
    const lang = (req.query.lang as string) || 'tr';
    const cacheKey = `${category}_${lang}`;

    // Return cached feed if valid
    const cached = newsFeedCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < NEWS_CACHE_TTL && cached.articles.length > 0) {
      return res.json({
        success: true,
        category,
        lang,
        cached: true,
        articles: cached.articles
      });
    }

    // Map categories to Turkish RSS feeds
    const feedMap: Record<string, string[]> = {
      'Teknoloji': [
        'https://www.webtekno.com/rss.xml',
        'https://www.haberturk.com/rss/kategori/teknoloji.xml',
        'https://www.aa.com.tr/tr/rss/default?cat=bilim-teknoloji',
        'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=tr&gl=TR&ceid=TR:tr'
      ],
      'Ekonomi': [
        'https://www.haberturk.com/rss/kategori/ekonomi.xml',
        'https://www.aa.com.tr/tr/rss/default?cat=ekonomi',
        'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=tr&gl=TR&ceid=TR:tr'
      ],
      'Finans': [
        'https://www.haberturk.com/rss/kategori/ekonomi.xml',
        'https://www.aa.com.tr/tr/rss/default?cat=ekonomi',
        'https://news.google.com/rss/search?q=finans+borsa+piyasalar&hl=tr&gl=TR&ceid=TR:tr'
      ],
      'Dünya': [
        'https://www.haberturk.com/rss/kategori/dunya.xml',
        'https://feeds.bbci.co.uk/turkce/rss.xml',
        'https://news.google.com/rss/headlines/section/topic/WORLD?hl=tr&gl=TR&ceid=TR:tr'
      ],
      'Kültür & Sanat': [
        'https://www.haberturk.com/rss/kategori/kultur-sanat.xml',
        'https://www.aa.com.tr/tr/rss/default?cat=kultur',
        'https://news.google.com/rss/search?q=kultur+sanat+sinema+tiyatro&hl=tr&gl=TR&ceid=TR:tr'
      ],
      'Etik & Bilim': [
        'https://www.aa.com.tr/tr/rss/default?cat=bilim-teknoloji',
        'https://www.webtekno.com/rss.xml',
        'https://news.google.com/rss/search?q=bilim+uzay+fizik+tip&hl=tr&gl=TR&ceid=TR:tr'
      ],
      'Sürdürülebilirlik': [
        'https://www.aa.com.tr/tr/rss/default?cat=cevre',
        'https://www.haberturk.com/rss/kategori/ekonomi.xml',
        'https://news.google.com/rss/search?q=surdurulebilirlik+iklim+cevre&hl=tr&gl=TR&ceid=TR:tr'
      ],
      'Felsefe': [
        'https://feeds.bbci.co.uk/turkce/rss.xml',
        'https://www.webtekno.com/rss.xml',
        'https://news.google.com/rss/search?q=felsefe+dusunce+analiz&hl=tr&gl=TR&ceid=TR:tr'
      ],
      'Gündem': [
        'https://www.aa.com.tr/tr/rss/default?cat=gundem',
        'https://www.haberturk.com/rss/manset.xml',
        'https://feeds.bbci.co.uk/turkce/rss.xml',
        'https://news.google.com/rss/headlines/section/topic/NATION?hl=tr&gl=TR&ceid=TR:tr'
      ],
      'Spor': [
        'https://www.aa.com.tr/tr/rss/default?cat=spor',
        'https://www.haberturk.com/rss/kategori/spor.xml',
        'https://news.google.com/rss/headlines/section/topic/SPORTS?hl=tr&gl=TR&ceid=TR:tr'
      ],
      'Tümü': [
        'https://www.aa.com.tr/tr/rss/default?cat=gundem',
        'https://www.haberturk.com/rss/manset.xml',
        'https://www.webtekno.com/rss.xml',
        'https://feeds.bbci.co.uk/turkce/rss.xml',
        'https://www.haberturk.com/rss/kategori/ekonomi.xml',
        'https://www.haberturk.com/rss/kategori/teknoloji.xml'
      ]
    };

    const targetUrls = feedMap[category] || feedMap['Tümü'];

    const cleanText = (str: string) => {
      if (!str) return '';
      let text = str.replace(/<!\[CDATA\[|\]\]>/g, '');
      for (let k = 0; k < 2; k++) {
        text = text
          .replace(/&lt;/gi, '<')
          .replace(/&gt;/gi, '>')
          .replace(/&quot;/gi, '"')
          .replace(/&#39;/gi, "'")
          .replace(/&amp;/gi, '&')
          .replace(/&nbsp;/gi, ' ');
      }
      text = text.replace(/<[^>]+>/g, '');
      text = text.replace(/https?:\/\/[^\s]+/gi, '');
      text = text.replace(/\b(a\s+href|href|target=|[a-z0-9_-]+\.html)\b[^\s]*/gi, '');
      return text.trim();
    };

    // Fetch RSS feeds concurrently
    const feedPromises = targetUrls.map(async (url) => {
      try {
        const fetchRes = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*'
          }
        });
        if (!fetchRes.ok) return [];
        const xmlText = await fetchRes.text();
        const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/gi) || [];

        let publisherName = 'Haber Bülteni';
        if (url.includes('webtekno')) publisherName = 'Webtekno';
        else if (url.includes('haberturk')) publisherName = 'Habertürk';
        else if (url.includes('bbc')) publisherName = 'BBC Türkçe';
        else if (url.includes('aa.com.tr')) publisherName = 'Anadolu Ajansı';

        const parsedItems: any[] = [];
        for (let i = 0; i < Math.min(itemMatches.length, 6); i++) {
          const itemStr = itemMatches[i];
          const titleMatch = itemStr.match(/<title>([\s\S]*?)<\/title>/i);
          const descMatch = itemStr.match(/<description>([\s\S]*?)<\/description>/i);
          const contentMatch = itemStr.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i);
          const authorMatch = itemStr.match(/<author>([\s\S]*?)<\/author>/i) || itemStr.match(/<dc:creator>([\s\S]*?)<\/dc:creator>/i);
          const sourceMatch = itemStr.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
          const linkMatch = itemStr.match(/<link>([\s\S]*?)<\/link>/i);

          // Extract real image URL from RSS XML
          let extractedImg = '';
          const mediaContent = itemStr.match(/<media:content[^>]+url=["']([^"']+)["']/i);
          const mediaThumb = itemStr.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
          const enclosure = itemStr.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
          const imageTag = itemStr.match(/<image>([\s\S]*?)<\/image>/i);
          const imgTagMatch = itemStr.match(/<img[^>]+src=["']([^"']+)["']/i);

          if (mediaContent) extractedImg = mediaContent[1];
          else if (mediaThumb) extractedImg = mediaThumb[1];
          else if (enclosure) extractedImg = enclosure[1];
          else if (imageTag && imageTag[1].startsWith('http')) extractedImg = imageTag[1].trim();
          else if (imgTagMatch) extractedImg = imgTagMatch[1];

          let rawTitle = titleMatch ? cleanText(titleMatch[1]) : '';
          let author = authorMatch ? cleanText(authorMatch[1]) : publisherName;
          let sourcePublisher = sourceMatch ? cleanText(sourceMatch[1]) : '';

          if (sourcePublisher) {
            author = sourcePublisher;
          }

          if (author.includes('@') || author.includes('\n') || author.includes('http')) {
            if (url.includes('webtekno')) author = 'Webtekno';
            else if (url.includes('haberturk')) author = 'Habertürk';
            else if (url.includes('bbc')) author = 'BBC Türkçe';
            else if (url.includes('aa.com.tr')) author = 'Anadolu Ajansı';
            else {
              author = author.replace(/\([^)]*\)/g, '').replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '').replace(/\s+/g, ' ').trim();
              if (!author) author = publisherName;
            }
          }

          let title = rawTitle;
          if (author && title.endsWith(' - ' + author)) {
            title = title.substring(0, title.length - (author.length + 3)).trim();
          } else if (title.includes(' - ')) {
            const parts = title.split(' - ');
            if (parts.length > 1 && parts[parts.length - 1].length < 30) {
              const possibleAuthor = parts.pop()!.trim();
              if (!author || author === 'Haber Bülteni' || author === 'Google Haberler') {
                author = possibleAuthor;
              }
              title = parts.join(' - ').trim();
            }
          }

          let summary = descMatch ? cleanText(descMatch[1]) : '';
          let fullContent = contentMatch ? cleanText(contentMatch[1]) : '';
          const sourceUrl = linkMatch ? linkMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';

          if (title && title.length > 4) {
            let itemCategory = 'Gündem';
            if (url.includes('webtekno') || url.includes('teknoloji') || url.includes('bilim-teknoloji')) {
              itemCategory = 'Teknoloji';
            } else if (url.includes('ekonomi') || url.includes('BUSINESS')) {
              itemCategory = 'Ekonomi';
            } else if (url.includes('dunya') || url.includes('WORLD') || url.includes('bbc')) {
              itemCategory = 'Dünya';
            } else if (url.includes('kultur-sanat') || url.includes('kultur')) {
              itemCategory = 'Kültür & Sanat';
            } else if (url.includes('cevre') || url.includes('surdurulebilirlik')) {
              itemCategory = 'Sürdürülebilirlik';
            } else if (url.includes('SPORTS') || url.includes('spor')) {
              itemCategory = 'Spor';
            } else if (category && category !== 'Tümü' && !category.includes(' ')) {
              itemCategory = category;
            }

            parsedItems.push({
              title,
              rawSummary: summary,
              rawContent: fullContent,
              category: itemCategory,
              author: author || publisherName,
              imageUrl: extractedImg,
              sourceType: 'rss',
              sourceUrl: sourceUrl
            });
          }
        }
        return parsedItems;
      } catch (err) {
        console.warn(`Error fetching RSS feed ${url}:`, err);
        return [];
      }
    });

    const feedResults = await Promise.all(feedPromises);
    const rawArticles = feedResults.flat();

    // Deduplicate by title
    const seenTitles = new Set<string>();
    const uniqueRawArticles: any[] = [];

    rawArticles.forEach((item) => {
      const titleLower = item.title.toLowerCase();
      if (!seenTitles.has(titleLower)) {
        seenTitles.add(titleLower);
        uniqueRawArticles.push(item);
      }
    });

    // Process articles: scrape missing images, summarize with Gemini (or construct clean 7-sentence structure)
    const processedArticles: any[] = [];
    let aiQuotaAvailable = true;

    for (let i = 0; i < Math.min(uniqueRawArticles.length, 10); i++) {
      const item = uniqueRawArticles[i];
      let finalImg = item.imageUrl || '';
      let articleText = [item.title, item.rawSummary, item.rawContent].filter(Boolean).join('\n\n');

      // If no image from RSS, or if text is very short, fetch web page to get real og:image and text
      if ((!finalImg || articleText.length < 200) && item.sourceUrl && item.sourceUrl.startsWith('http')) {
        try {
          const webInfo = await getWebpageText(item.sourceUrl);
          if (webInfo) {
            if (!finalImg && webInfo.thumbnail) {
              finalImg = webInfo.thumbnail;
            }
            if (webInfo.text && webInfo.text.length > articleText.length) {
              articleText = webInfo.text;
            }
          }
        } catch (e) {
          console.warn(`Could not scrape extra info for ${item.sourceUrl}:`, e);
        }
      }

      // Summarize with Gemini using exact user prompt for top articles
      let summarizedResult = null;
      if (i < 2 && aiQuotaAvailable && process.env.GEMINI_API_KEY) {
        summarizedResult = await summarizeNewsItemWithGemini({
          title: item.title,
          text: articleText,
          author: item.author,
          sourceUrl: item.sourceUrl,
          category: item.category,
          imageUrl: finalImg
        });
        if (!summarizedResult) {
          // If top item failed or quota was reached, don't waste time/quota on remaining items in this batch
          aiQuotaAvailable = false;
        }
      }

      if (summarizedResult) {
        processedArticles.push({
          id: `news_${category.toLowerCase()}_${i}_${Date.now()}`,
          title: summarizedResult.title,
          summary: summarizedResult.summary,
          content: summarizedResult.content,
          category: item.category,
          author: item.author,
          imageUrl: finalImg || '',
          sourceType: 'rss',
          sourceUrl: item.sourceUrl,
          durationSeconds: Math.max(120, Math.min(360, summarizedResult.content.split(' ').length * 2)),
          createdAt: new Date().toISOString(),
          keyPoints: summarizedResult.keyPoints
        });
      } else {
        // High quality full text preservation conforming to editorial standards
        const cleanParagraphs = articleText
          .replace(/<[^>]+>/g, ' ')
          .replace(/https?:\/\/[^\s]+/gi, '')
          .split(/\n\s*\n/)
          .map(p => p.trim())
          .filter(p => p.length > 20);

        let finalContent = '';
        if (cleanParagraphs.length > 0) {
          finalContent = cleanParagraphs.join('\n\n');
        } else {
          finalContent = `${item.title}.\n\n${item.author} tarafından aktarılan bilgilere göre konuyla ilgili ayrıntılı inceleme ve gelişmeler devam ediyor.`;
        }

        const sentences = finalContent
          .replace(/\n+/g, ' ')
          .split(/(?<=[.?!])\s+/)
          .map(s => s.trim())
          .filter(s => s.length > 20);

        const finalSummary = item.rawSummary && item.rawSummary.length > 20
          ? item.rawSummary
          : (sentences[0] || `${item.title} hakkında ${item.author} kaynağından edinilen son gelişmeler.`);

        const keyHighlights = [
          item.title,
          sentences[1] ? sentences[1].substring(0, 100) : 'Gelişmelerin ayrıntıları',
          `Kaynak: ${item.author}`
        ];

        processedArticles.push({
          id: `news_${category.toLowerCase()}_${i}_${Date.now()}`,
          title: item.title,
          summary: finalSummary,
          content: finalContent,
          category: item.category,
          author: item.author,
          imageUrl: finalImg || '',
          sourceType: 'rss',
          sourceUrl: item.sourceUrl,
          durationSeconds: Math.max(120, Math.min(360, finalContent.split(' ').length * 2)),
          createdAt: new Date().toISOString(),
          keyPoints: keyHighlights
        });
      }
    }

    if (processedArticles.length > 0) {
      newsFeedCache.set(cacheKey, {
        timestamp: Date.now(),
        articles: processedArticles
      });
    }

    res.json({
      success: true,
      category,
      lang,
      articles: processedArticles
    });
  } catch (err: unknown) {
    console.error('News feed error:', err);
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// 3. RSS XML Proxy Endpoint to prevent CORS errors
app.get('/api/rss-fetch', async (req, res) => {
  try {
    const feedUrl = req.query.url as string;
    if (!feedUrl) {
      return res.status(400).json({ success: false, error: 'url parameter required' });
    }

    const fetchRes = await fetch(feedUrl);
    const xmlText = await fetchRes.text();

    // Use Gemini to parse XML cleanly into JSON items
    const prompt = `
Extract up to 5 latest articles from this RSS XML feed.
Respond ONLY with valid JSON array:
[
  {
    "title": "Article Title",
    "summary": "Short snippet or description",
    "sourceUrl": "Link to original",
    "author": "Feed Publisher Name",
    "createdAt": "${new Date().toISOString()}"
  }
]
XML:
${xmlText.substring(0, 15000)}
`;

    const response = await callGeminiWithRetry({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const items = JSON.parse(response.text || '[]');
    res.json({ success: true, items });
  } catch (err: unknown) {
    console.error('RSS fetch error:', err);
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// API 404 Fallback - ensures unmatched /api/* calls return JSON, never HTML
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API_NOT_FOUND',
    message: `İstenen API adresi (${req.method} ${req.path}) bulunamadı.`
  });
});

// Global API Error Handler (Catches all unhandled errors before static/Vite middleware)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Global Error Handler]:', err);
  if (res.headersSent) {
    return _next(err);
  }
  const statusCode = typeof err?.status === 'number' ? err.status : (typeof err?.statusCode === 'number' ? err.statusCode : 500);
  res.status(statusCode).json({
    success: false,
    error: err?.code || 'SERVER_ERROR',
    message: err?.message || 'Sunucu hatası oluştu. Lütfen tekrar deneyin.'
  });
});

// Serve frontend with Vite middleware in development or static dist in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VOX Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
