var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_genai = require("@google/genai");
var import_vite = require("vite");
var import_youtube_transcript = require("youtube-transcript");
var import_readability = require("@mozilla/readability");
var import_jsdom = require("jsdom");
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json({ limit: "50mb" }));
app.use("/api", (req, res, next) => {
  if (!req.path.startsWith("/tts")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
  }
  next();
});
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ success: false, error: "INVALID_JSON", message: "Ge\xE7ersiz veri bi\xE7imi." });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ success: false, error: "PAYLOAD_TOO_LARGE", message: "Y\xFCklenen veri boyutu \xE7ok b\xFCy\xFCk." });
  }
  next(err);
});
var ai = new import_genai.GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
});
async function callGeminiWithRetry(params, retries = 2, delayMs = 300) {
  const primaryModel = params.model || "gemini-3.7-flash";
  const models = Array.from(/* @__PURE__ */ new Set([primaryModel, "gemini-3.1-flash-lite", "gemini-flash-latest"]));
  let lastError = null;
  for (const modelName of models) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await ai.models.generateContent({
          ...params,
          model: modelName
        });
        return response;
      } catch (err) {
        lastError = err;
        const status = err?.status || err?.code;
        const msg = (err?.message || String(err)).toLowerCase();
        const isTransient = status === 503 || status === 429 || msg.includes("503") || msg.includes("429") || msg.includes("unavailable") || msg.includes("high demand") || msg.includes("quota") || msg.includes("resource_exhausted");
        if (isTransient) {
          break;
        } else if (i < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
        }
      }
    }
  }
  throw lastError;
}
function extractYouTubeId(urlStr) {
  if (!urlStr) return null;
  const trimmed = urlStr.trim();
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/;
  const match = trimmed.match(regExp);
  if (match && match[1]) return match[1];
  try {
    const normUrl = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    const urlObj = new URL(normUrl);
    if (urlObj.hostname.includes("youtube.com") || urlObj.hostname.includes("youtu.be")) {
      const vParam = urlObj.searchParams.get("v");
      if (vParam && /^[\w-]{11}$/.test(vParam)) return vParam;
      const parts = urlObj.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && /^[\w-]{11}$/.test(last)) return last;
    }
  } catch {
  }
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  return null;
}
function decodeXmlEntities(str) {
  if (!str) return "";
  return str.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10))).replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/\s+/g, " ").trim();
}
function isGenericYouTubeText(str) {
  if (!str) return true;
  const lower = str.toLowerCase();
  return lower.includes("sevdi\u011Finiz videolar\u0131n") || lower.includes("orijinal i\xE7erik y\xFCkleyin") || lower.includes("arkada\u015Flar\u0131n\u0131zla, ailenizle") || lower.includes("enjoy the videos and music") || lower.includes("upload original content") || lower.includes("share it all with friends") || lower.includes("youtube&#39;da") || lower.includes("youtube'da") || lower.includes("seslendirme metnine d\xF6n\xFC\u015Ft\xFCr\xFCl\xFCyor") || lower.includes("podcast seslendirme metni \xFCret") || str.trim().length < 15;
}
async function fetchYouTubeInnerTubePlayer(videoId) {
  const clients = [
    {
      client: { clientName: "WEB", clientVersion: "2.20240308.00.00", hl: "tr", gl: "TR" },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    },
    {
      client: { clientName: "ANDROID", clientVersion: "19.11.38", androidSdkVersion: 30, hl: "tr", gl: "TR" },
      userAgent: "com.google.android.youtube/19.11.38 (Linux; U; Android 11) gzip"
    },
    {
      client: { clientName: "WEB_EMBEDDED_PLAYER", clientVersion: "1.20240101.00.00", hl: "tr", gl: "TR" },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    },
    {
      client: { clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER", clientVersion: "2.0", hl: "tr", gl: "TR" },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    },
    {
      client: { clientName: "IOS", clientVersion: "19.11.1", hl: "tr", gl: "TR" },
      userAgent: "com.google.ios.youtube/19.11.1 (iPhone; CPU iPhone OS 17_4 like Mac OS X)"
    }
  ];
  let fallbackJson = null;
  for (const { client, userAgent } of clients) {
    try {
      const res = await fetch("https://www.youtube.com/youtubei/v1/player", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": userAgent,
          "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7"
        },
        body: JSON.stringify({
          context: { client },
          videoId,
          playbackContext: {
            contentPlaybackContext: {
              html5Preference: "HTML5_PREFER_FORMAT_22"
            }
          },
          racyCheckOk: true,
          contentCheckOk: true
        })
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.captions?.playerCaptionsTracklistRenderer?.captionTracks || json?.captions?.playerCaptionsRenderer?.captionTracks) {
          return json;
        }
        if (json?.videoDetails && !fallbackJson) {
          fallbackJson = json;
        }
      }
    } catch (err) {
      console.warn("[YouTube InnerTube Player] fetch notice:", err);
    }
  }
  return fallbackJson;
}
async function fetchYouTubeInnerTubeNext(videoId) {
  const clients = [
    {
      client: { clientName: "WEB", clientVersion: "2.20240308.00.00", hl: "tr", gl: "TR" },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    },
    {
      client: { clientName: "ANDROID", clientVersion: "19.11.38", androidSdkVersion: 30, hl: "tr", gl: "TR" },
      userAgent: "com.google.android.youtube/19.11.38 (Linux; U; Android 11) gzip"
    },
    {
      client: { clientName: "IOS", clientVersion: "19.11.1", hl: "tr", gl: "TR" },
      userAgent: "com.google.ios.youtube/19.11.1 (iPhone; CPU iPhone OS 17_4 like Mac OS X)"
    }
  ];
  for (const { client, userAgent } of clients) {
    try {
      const res = await fetch("https://www.youtube.com/youtubei/v1/next", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": userAgent,
          "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7"
        },
        body: JSON.stringify({
          context: { client },
          videoId
        })
      });
      if (res.ok) {
        const json = await res.json();
        if (json) return json;
      }
    } catch (err) {
      console.warn("[YouTube InnerTube Next] fetch notice:", err);
    }
  }
  return null;
}
function extractTranscriptFromInnerTubeNext(json) {
  if (!json) return null;
  try {
    const panels = json?.engagementPanels;
    if (Array.isArray(panels)) {
      for (const panel of panels) {
        const cueGroups = panel?.engagementPanelSectionListRenderer?.content?.transcriptRenderer?.body?.transcriptBodyRenderer?.cueGroups;
        if (Array.isArray(cueGroups) && cueGroups.length > 0) {
          const lines = [];
          for (const group of cueGroups) {
            const cues = group?.transcriptCueRenderer;
            const text = cues?.cue?.simpleText || cues?.cue?.runs?.map((r) => r.text).join("") || cues?.snippet?.runs?.map((r) => r.text).join("");
            if (text && text.trim()) {
              lines.push(text.trim());
            }
          }
          if (lines.length > 0) {
            const fullText = lines.join(" ").replace(/\s+/g, " ").trim();
            if (fullText.length > 30) {
              return fullText;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("[InnerTube Next Transcript Extraction Error]", err);
  }
  return null;
}
function extractTranscriptFromGetTranscriptJson(json) {
  if (!json) return null;
  const lines = [];
  function collectCues(obj) {
    if (!obj || typeof obj !== "object") return;
    if (obj.transcriptCueRenderer) {
      const cue = obj.transcriptCueRenderer;
      const text = cue?.cue?.simpleText || cue?.cue?.runs?.map((r) => r.text).join("") || cue?.snippet?.runs?.map((r) => r.text).join("");
      if (text && text.trim()) {
        lines.push(text.trim());
      }
      return;
    }
    if (Array.isArray(obj)) {
      for (const item of obj) collectCues(item);
    } else {
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === "object") collectCues(obj[key]);
      }
    }
  }
  collectCues(json);
  if (lines.length > 0) {
    const fullText = lines.join(" ").replace(/\s+/g, " ").trim();
    if (fullText.length > 30) return fullText;
  }
  return null;
}
async function fetchYouTubeInnerTubeTranscript(videoId) {
  try {
    const nextData = await fetchYouTubeInnerTubeNext(videoId);
    if (nextData) {
      let findTranscriptParams = function(obj) {
        if (!obj || typeof obj !== "object" || transcriptParams) return;
        if (obj.getTranscriptEndpoint && obj.getTranscriptEndpoint.params) {
          transcriptParams = obj.getTranscriptEndpoint.params;
          return;
        }
        for (const k of Object.keys(obj)) {
          if (typeof obj[k] === "object") {
            findTranscriptParams(obj[k]);
          }
        }
      };
      const cueText = extractTranscriptFromInnerTubeNext(nextData);
      if (cueText) return cueText;
      let transcriptParams = null;
      findTranscriptParams(nextData);
      if (transcriptParams) {
        const clients = [
          { clientName: "WEB", clientVersion: "2.20240308.00.00", hl: "tr", gl: "TR" },
          { clientName: "ANDROID", clientVersion: "19.11.38", androidSdkVersion: 30, hl: "tr", gl: "TR" }
        ];
        for (const client of clients) {
          try {
            const res = await fetch("https://www.youtube.com/youtubei/v1/get_transcript", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7"
              },
              body: JSON.stringify({
                context: { client },
                params: transcriptParams
              })
            });
            if (res.ok) {
              const json = await res.json();
              const extractedText = extractTranscriptFromGetTranscriptJson(json);
              if (extractedText && extractedText.length > 30) {
                console.log(`[YouTube Transcript Success] InnerTube get_transcript API -> ${extractedText.length} chars`);
                return extractedText;
              }
            }
          } catch (err) {
            console.warn("[InnerTube get_transcript Error]", err);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[fetchYouTubeInnerTubeTranscript Error]", err);
  }
  return null;
}
function cleanSubtitlesText(raw) {
  if (!raw) return "";
  let text = raw;
  if (text.includes("<text") || text.includes("<s ") || text.includes("<p ")) {
    const textMatches = [...text.matchAll(/<text[^>]*>(.*?)<\/text>/gs)];
    if (textMatches.length > 0) {
      const extracted = textMatches.map((m) => decodeXmlEntities(m[1]).replace(/<[^>]+>/g, " ")).join(" ");
      if (extracted.trim().length > 30) {
        return extracted.replace(/\s+/g, " ").trim();
      }
    }
    const sMatches = [...text.matchAll(/<s[^>]*>(.*?)<\/s>/gs)];
    if (sMatches.length > 0) {
      const extracted = sMatches.map((m) => decodeXmlEntities(m[1]).replace(/<[^>]+>/g, " ")).join(" ");
      if (extracted.trim().length > 30) {
        return extracted.replace(/\s+/g, " ").trim();
      }
    }
    const pMatches = [...text.matchAll(/<p[^>]*>(.*?)<\/p>/gs)];
    if (pMatches.length > 0) {
      const extracted = pMatches.map((m) => decodeXmlEntities(m[1]).replace(/<[^>]+>/g, " ")).join(" ");
      if (extracted.trim().length > 30) {
        return extracted.replace(/\s+/g, " ").trim();
      }
    }
  }
  text = text.replace(/^WEBVTT.*/gi, "").replace(/Kind:.*/gi, "").replace(/Language:.*/gi, "").replace(/\d{2}:\d{2}:\d{2}[\.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[\.,]\d{3}.*/g, "").replace(/\d{2}:\d{2}[\.,]\d{3}\s*-->\s*\d{2}:\d{2}[\.,]\d{3}.*/g, "").replace(/<[^>]+>/g, " ").replace(/\{\\.*?}/g, " ");
  text = decodeXmlEntities(text);
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0 && !/^\d+$/.test(l) && !l.startsWith("NOTE "));
  const uniqueLines = [];
  for (const line of lines) {
    if (uniqueLines.length === 0 || uniqueLines[uniqueLines.length - 1] !== line) {
      uniqueLines.push(line);
    }
  }
  return uniqueLines.join(" ").replace(/\s+/g, " ").trim();
}
async function fetchCaptionContentFromUrl(url, videoId) {
  if (!url) return null;
  const rawUrl = url.replace(/\\u0026/g, "&").replace(/&amp;/g, "&").replace(/\\\//g, "/");
  const urlsToTry = [
    rawUrl,
    rawUrl.includes("fmt=") ? rawUrl : `${rawUrl}&fmt=json3`,
    rawUrl.includes("fmt=") ? rawUrl : `${rawUrl}&fmt=srv3`
  ];
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": videoId ? `https://www.youtube.com/watch?v=${videoId}` : "https://www.youtube.com/",
    "Origin": "https://www.youtube.com"
  };
  for (const u of urlsToTry) {
    try {
      const res = await fetch(u, { headers });
      if (res.ok) {
        const text = await res.text();
        if (!text || text.trim().length === 0) continue;
        if (text.trim().startsWith("{")) {
          try {
            const json = JSON.parse(text);
            if (json.events && Array.isArray(json.events)) {
              const lines = [];
              for (const ev of json.events) {
                if (ev.segs && Array.isArray(ev.segs)) {
                  const line = ev.segs.map((s) => s.utf8 || "").join("").replace(/\n/g, " ").trim();
                  if (line && line !== "\n") lines.push(line);
                }
              }
              const result = decodeXmlEntities(lines.join(" ")).replace(/\s+/g, " ").trim();
              if (result.length > 30) return result;
            }
          } catch {
          }
        }
        const cleaned = cleanSubtitlesText(text);
        if (cleaned && cleaned.length > 30) {
          return cleaned;
        }
      }
    } catch {
    }
  }
  return null;
}
function sortTracksByPreference(tracks) {
  if (!Array.isArray(tracks)) return [];
  return [...tracks].sort((a, b) => {
    const getScore = (track) => {
      if (!track) return 0;
      const lang = (track.languageCode || track.code || track.language || "").toLowerCase();
      const vssId = (track.vssId || track.vss_id || "").toLowerCase();
      const nameText = (track.name?.runs?.[0]?.text || track.name?.simpleText || (typeof track.name === "string" ? track.name : "") || "").toLowerCase();
      const baseUrl = (track.baseUrl || track.url || "").toLowerCase();
      const isTr = lang === "tr" || lang.startsWith("tr") || vssId.includes(".tr") || vssId.includes("a.tr") || nameText.includes("t\xFCrk\xE7e") || nameText.includes("turkish");
      const isAsr = track.kind === "asr" || vssId.startsWith("a.") || vssId.includes("a.tr") || track.isAutoGenerated === true || nameText.includes("otomatik") || nameText.includes("auto");
      const isAutoTranslatedTr = baseUrl.includes("tlang=tr") || track.targetLanguage === "tr";
      if (isTr && !isAsr) return 100;
      if (isTr && isAsr) return 95;
      if (isAutoTranslatedTr) return 85;
      if (isTr) return 75;
      if (!isAsr) return 50;
      return 10;
    };
    return getScore(b) - getScore(a);
  });
}
async function getYouTubeSubtitles(videoId) {
  if (!videoId) return null;
  const errorsLog = [];
  console.log(`[YouTube Transcript] Multi-strategy fetch starting for video ID: ${videoId}`);
  try {
    const transcriptText = await fetchYouTubeInnerTubeTranscript(videoId);
    if (transcriptText) {
      console.log(`[YouTube Transcript Success] Strategy 1a (InnerTube get_transcript) -> ${transcriptText.length} chars`);
      return transcriptText.substring(0, 2e4);
    }
  } catch (err) {
    errorsLog.push(`InnerTube Transcript: ${err?.message || err}`);
  }
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
              console.log(`[YouTube Transcript Success] Strategy 2 (InnerTube Player, lang: ${track.languageCode || "unknown"}, vssId: ${track.vssId || "none"}) -> ${captionText.length} chars`);
              return captionText.substring(0, 2e4);
            }
          }
        }
      }
    }
  } catch (err) {
    errorsLog.push(`InnerTube Player: ${err?.message || err}`);
  }
  const langs = ["tr", "a.tr", void 0, "en"];
  for (const lang of langs) {
    try {
      const items = await import_youtube_transcript.YoutubeTranscript.fetchTranscript(videoId, lang ? { lang } : void 0);
      if (items && items.length > 0) {
        const fullText = items.map((i) => decodeXmlEntities(i.text)).join(" ").replace(/\s+/g, " ").trim();
        if (fullText.length > 30) {
          console.log(`[YouTube Transcript Success] Strategy 3 (youtube-transcript, lang: ${lang || "auto"}) -> ${fullText.length} chars`);
          return fullText.substring(0, 2e4);
        }
      }
    } catch (err) {
      errorsLog.push(`youtube-transcript (${lang || "auto"}): ${err?.message || err}`);
    }
  }
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cookie": "CONSENT=YES+1; SOCS=CAI; PREF=hl=tr&gl=TR"
      }
    });
    if (res.ok) {
      const html = await res.text();
      const match = html.match(/"captionTracks"\s*:\s*(\[\s*\{.+?\}\s*\])/s) || html.match(/captionTracks\s*:\s*(\[\s*\{.+?\}\s*\])/s);
      if (match && match[1]) {
        const cleanedJson = match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
        try {
          const tracks = JSON.parse(cleanedJson);
          if (Array.isArray(tracks) && tracks.length > 0) {
            const sortedTracks = sortTracksByPreference(tracks);
            for (const track of sortedTracks) {
              if (track?.baseUrl) {
                const u = track.baseUrl.replace(/\\u0026/g, "&").replace(/\\\//g, "/");
                const text = await fetchCaptionContentFromUrl(u, videoId);
                if (text) {
                  console.log(`[YouTube Transcript Success] Strategy 4 (Watch HTML, lang: ${track.languageCode || "unknown"}) -> ${text.length} chars`);
                  return text.substring(0, 2e4);
                }
              }
            }
          }
        } catch {
        }
      }
    } else {
      errorsLog.push(`Watch HTML: HTTP ${res.status}`);
    }
  } catch (err) {
    errorsLog.push(`Watch HTML Scraping: ${err?.message || err}`);
  }
  const pipedInstances = [
    "https://pipedapi.kavin.rocks",
    "https://api.piped.privacydev.net",
    "https://pipedapi.adminforge.de",
    "https://pipedapi.mha.fi",
    "https://pipedapi.drgns.space"
  ];
  for (const pipedBase of pipedInstances) {
    try {
      const res = await fetch(`${pipedBase}/streams/${videoId}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
      });
      if (res.ok) {
        const json = await res.json();
        const subtitles = json?.subtitles;
        if (Array.isArray(subtitles) && subtitles.length > 0) {
          const sortedSubs = sortTracksByPreference(subtitles);
          for (const sub of sortedSubs) {
            if (sub?.url) {
              const text = await fetchCaptionContentFromUrl(sub.url, videoId);
              if (text) {
                console.log(`[YouTube Transcript Success] Strategy 5 (Piped API: ${pipedBase}, lang: ${sub.code || sub.name || "auto"}) -> ${text.length} chars`);
                return text.substring(0, 2e4);
              }
            }
          }
        }
      }
    } catch (err) {
      errorsLog.push(`Piped API (${pipedBase}): ${err?.message || err}`);
    }
  }
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
        return text.substring(0, 2e4);
      }
    } catch (err) {
      errorsLog.push(`TimedText (${url}): ${err?.message || err}`);
    }
  }
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
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
      });
      if (extRes.ok) {
        const json = await extRes.json();
        const captionList = json?.captions || json?.subtitles;
        if (Array.isArray(captionList) && captionList.length > 0) {
          const sortedList = sortTracksByPreference(captionList);
          for (const sub of sortedList) {
            const subUrl = sub.url || sub.baseUrl;
            if (subUrl) {
              const fullSubUrl = subUrl.startsWith("http") ? subUrl : `${new URL(apiEndpoint).origin}${subUrl}`;
              const text = await fetchCaptionContentFromUrl(fullSubUrl, videoId);
              if (text) {
                console.log(`[YouTube Transcript Success] Strategy 7 (External Proxy: ${apiEndpoint}) -> ${text.length} chars`);
                return text.substring(0, 2e4);
              }
            }
          }
        }
      }
    } catch (err) {
      errorsLog.push(`External API (${apiEndpoint}): ${err?.message || err}`);
    }
  }
  console.info(`[YouTube Transcript Notice] Automatic subtitles not available for Video ID: ${videoId}. Falling back to metadata / description.`);
  return null;
}
async function getYouTubeMetadata(urlStr) {
  const videoId = extractYouTubeId(urlStr);
  if (!videoId) {
    console.error("[YouTube Metadata Failed] Invalid YouTube URL or Video ID missing:", urlStr);
    return null;
  }
  let title = "";
  let author = "";
  const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  let videoDescription = "";
  let originalDurationSeconds = 0;
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oembedUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.title) title = data.title;
      if (data.author_name) author = data.author_name;
    }
  } catch (err) {
    console.warn("[YouTube Metadata] oEmbed notice:", err);
  }
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
    console.warn("[YouTube Metadata] InnerTube notice:", err);
  }
  if (!videoDescription || !title || title === "YouTube Videosu") {
    try {
      const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
          "Cookie": "CONSENT=YES+1; SOCS=CAI; PREF=hl=tr&gl=TR"
        }
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const dom = new import_jsdom.JSDOM(html, { url: `https://www.youtube.com/watch?v=${videoId}` });
        const doc = dom.window.document;
        const getMeta = (nameOrProp) => {
          const el = doc.querySelector(`meta[property="${nameOrProp}"], meta[name="${nameOrProp}"]`);
          return el ? el.getAttribute("content")?.trim() || "" : "";
        };
        const ogTitle = getMeta("og:title") || getMeta("twitter:title") || doc.title || "";
        const ogDesc = getMeta("og:description") || getMeta("description") || getMeta("twitter:description") || "";
        const ogAuthor = getMeta("og:site_name") || getMeta("author") || "";
        if (ogTitle && (!title || title === "YouTube Videosu")) {
          title = ogTitle.replace(/- YouTube$/, "").trim();
        }
        if (ogAuthor && (!author || author === "YouTube Yay\u0131nc\u0131s\u0131")) {
          author = ogAuthor;
        }
        if (ogDesc && !isGenericYouTubeText(ogDesc) && (!videoDescription || videoDescription.length < ogDesc.length)) {
          videoDescription = ogDesc;
        }
        if (!videoDescription) {
          const shortDescMatch = html.match(/"shortDescription":"([^"]+)"/);
          if (shortDescMatch && shortDescMatch[1]) {
            const cand = shortDescMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
            if (!isGenericYouTubeText(cand)) {
              videoDescription = cand;
            }
          }
        }
      }
    } catch {
    }
  }
  const transcript = await getYouTubeSubtitles(videoId);
  return {
    videoId,
    title: title || "YouTube Videosu",
    author: author || "YouTube Yay\u0131nc\u0131s\u0131",
    thumbnail,
    transcript: transcript && transcript.trim().length > 30 ? transcript.trim() : null,
    videoDescription,
    originalDurationSeconds
  };
}
async function getWebpageText(urlStr) {
  try {
    const res = await fetch(urlStr, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7"
      }
    });
    if (!res.ok) {
      console.warn(`[Web Scraping Error] HTTP ${res.status} for ${urlStr}`);
      return null;
    }
    const html = await res.text();
    const dom = new import_jsdom.JSDOM(html, { url: urlStr });
    const doc = dom.window.document;
    const getMeta = (nameOrProp) => {
      const el = doc.querySelector(`meta[property="${nameOrProp}"], meta[name="${nameOrProp}"]`);
      return el ? el.getAttribute("content")?.trim() || "" : "";
    };
    const ogTitle = getMeta("og:title") || getMeta("twitter:title") || doc.title || "";
    const ogDesc = getMeta("og:description") || getMeta("description") || getMeta("twitter:description") || "";
    let rawOgImg = getMeta("og:image") || getMeta("og:image:secure_url") || getMeta("twitter:image") || getMeta("twitter:image:src") || getMeta("thumbnail") || "";
    if (!rawOgImg) {
      const linkImg = doc.querySelector('link[rel="image_src"], link[rel="apple-touch-icon"]');
      if (linkImg) rawOgImg = linkImg.getAttribute("href")?.trim() || "";
    }
    if (!rawOgImg) {
      const articleImg = doc.querySelector("article img, .content img, .news-detail img, figure img, img");
      if (articleImg) {
        const src = articleImg.getAttribute("src") || articleImg.getAttribute("data-src") || "";
        if (src && !src.includes("avatar") && !src.includes("logo") && !src.includes("icon")) {
          rawOgImg = src;
        }
      }
    }
    let ogImg = "";
    if (rawOgImg) {
      try {
        ogImg = new URL(rawOgImg, urlStr).href;
      } catch {
        ogImg = rawOgImg;
      }
    }
    const ogSection = getMeta("article:section") || getMeta("article:tag") || "";
    const ogAuthor = getMeta("article:author") || getMeta("author") || "";
    const noiseSelectors = [
      "nav",
      "footer",
      "header",
      "aside",
      "script",
      "style",
      "iframe",
      "noscript",
      ".advertisement",
      ".ads",
      ".ad-box",
      ".social-share",
      ".related-news",
      ".cookie-banner",
      "#cookie-notice",
      ".comments",
      ".sidebar",
      ".copyright",
      ".rel-news",
      ".headline-list",
      ".footer-copyright"
    ];
    noiseSelectors.forEach((sel) => {
      doc.querySelectorAll(sel).forEach((el) => el.remove());
    });
    const reader = new import_readability.Readability(doc, { charThreshold: 100 });
    const parsed = reader.parse();
    let cleanText = "";
    let title = ogTitle;
    let author = ogAuthor;
    if (parsed && parsed.textContent) {
      cleanText = parsed.textContent.split("\n").map((l) => l.trim()).filter((l) => l.length > 0).join("\n\n");
      if (parsed.title && parsed.title.length > title.length) {
        title = parsed.title;
      }
      if (parsed.byline && !author) {
        author = parsed.byline;
      }
    }
    let wordCount = cleanText.split(/\s+/).filter(Boolean).length;
    let charCount = cleanText.length;
    if (charCount < 300 || wordCount < 50) {
      const fallbackCombo = [ogTitle, ogDesc, ogSection].filter(Boolean).join("\n\n");
      const fallbackWords = fallbackCombo.split(/\s+/).filter(Boolean).length;
      if (fallbackCombo.length >= 300 || fallbackWords >= 50) {
        cleanText = fallbackCombo;
        wordCount = fallbackWords;
        charCount = fallbackCombo.length;
      }
    }
    const isValid = charCount >= 300 || wordCount >= 50;
    const metadataString = `Sayfa Ba\u015Fl\u0131\u011F\u0131: "${title}"
Yazar/Kaynak: "${author || "Web Yay\u0131n\u0131"}"
Meta A\xE7\u0131klama: "${ogDesc}"
Thumbnail G\xF6rseli: "${ogImg}"
Web Ba\u011Flant\u0131s\u0131 (URL): "${urlStr}"`;
    return {
      title: title || "Haber Analizi",
      author: author || "Web Yay\u0131n\u0131",
      metadata: metadataString,
      thumbnail: ogImg,
      text: cleanText,
      charCount,
      wordCount,
      isValid,
      fullContext: `${metadataString}

[SAYFA MAKALEN\u0130N TEM\u0130Z METN\u0130]:
${cleanText}`
    };
  } catch (err) {
    console.error("getWebpageText error:", err);
    return null;
  }
}
var activeSubscriptionsStore = /* @__PURE__ */ new Map();
app.post("/api/webhooks/revenuecat", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const REVENUECAT_WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET;
    if (REVENUECAT_WEBHOOK_SECRET && authHeader !== `Bearer ${REVENUECAT_WEBHOOK_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized webhook request" });
    }
    const { event } = req.body || {};
    if (!event) {
      return res.status(400).json({ error: "Invalid event payload" });
    }
    const appUserId = event.app_user_id || event.original_app_user_id;
    const eventType = event.type;
    const entitlementId = event.entitlement_id || "vox_premium";
    const expirationAt = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : new Date(Date.now() + 30 * 864e5).toISOString();
    console.log(`[RevenueCat Webhook] Event received: ${eventType} for User: ${appUserId}`);
    if (appUserId) {
      if (eventType === "INITIAL_PURCHASE" || eventType === "RENEWAL" || eventType === "UNCANCELLATION") {
        const isYearly = event.product_id?.includes("year") || event.period_type === "ANNUAL";
        activeSubscriptionsStore.set(appUserId, {
          isPremium: true,
          subscriptionTier: isYearly ? "premium_yearly" : "premium_monthly",
          subscriptionEndsAt: expirationAt,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          customerId: event.subscriber_attributes?.$appleAppAccountToken?.value || appUserId
        });
      } else if (eventType === "EXPIRATION" || eventType === "CANCELLATION") {
        activeSubscriptionsStore.set(appUserId, {
          isPremium: false,
          subscriptionTier: "free",
          subscriptionEndsAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    }
    res.json({ success: true, message: "Webhook processed successfully", appUserId, eventType });
  } catch (err) {
    console.error("RevenueCat webhook error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/verify-entitlement", (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ success: false, error: "userId parameter is required" });
  }
  const sub = activeSubscriptionsStore.get(userId);
  if (sub && sub.isPremium) {
    return res.json({
      success: true,
      isPremium: true,
      subscriptionTier: sub.subscriptionTier,
      subscriptionEndsAt: sub.subscriptionEndsAt,
      entitlements: ["vox_premium", "unlimited_summaries", "hd_tts", "pdf_ocr_unlimited"]
    });
  }
  return res.json({
    success: true,
    isPremium: false,
    subscriptionTier: "free",
    subscriptionEndsAt: null,
    entitlements: []
  });
});
app.post("/api/subscription/purchase", (req, res) => {
  const { userId, tier, platform } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: "userId is required" });
  }
  const isYearly = tier === "yearly";
  const expiresDate = /* @__PURE__ */ new Date();
  expiresDate.setDate(expiresDate.getDate() + (isYearly ? 365 : 30));
  activeSubscriptionsStore.set(userId, {
    isPremium: true,
    subscriptionTier: isYearly ? "premium_yearly" : "premium_monthly",
    subscriptionEndsAt: expiresDate.toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    customerId: `cust_${platform || "web"}_${Date.now()}`
  });
  res.json({
    success: true,
    isPremium: true,
    subscriptionTier: isYearly ? "premium_yearly" : "premium_monthly",
    subscriptionEndsAt: expiresDate.toISOString(),
    message: "Subscription successfully activated"
  });
});
app.get("/api/subscription/status", (req, res) => {
  const userId = req.query.userId;
  const sub = activeSubscriptionsStore.get(userId);
  if (sub) {
    return res.json({ success: true, ...sub });
  }
  return res.json({
    success: true,
    isPremium: false,
    subscriptionTier: "free",
    subscriptionEndsAt: null
  });
});
var ttsAudioCache = /* @__PURE__ */ new Map();
app.get("/api/tts", async (req, res) => {
  try {
    const text = req.query.text;
    const lang = req.query.lang || "tr";
    if (!text || text.trim().length === 0) {
      return res.status(400).send("Text parameter is required");
    }
    const cleanText = text.replace(/<[^>]*>/g, "").replace(/\[[^\]]*\]/g, "").replace(/[\r\n\t]+/g, " ").trim().substring(0, 200);
    const cacheKey = `${lang}_${cleanText}`;
    if (ttsAudioCache.has(cacheKey)) {
      const cachedBuf = ttsAudioCache.get(cacheKey);
      res.set({
        "Content-Type": "audio/mpeg",
        "Content-Length": cachedBuf.length.toString(),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=86400"
      });
      return res.send(cachedBuf);
    }
    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(lang)}&client=tw-ob&q=${encodeURIComponent(cleanText)}`;
    const response = await fetch(googleTtsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!response.ok) {
      const altUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(lang)}&client=gtx&q=${encodeURIComponent(cleanText)}`;
      const altRes = await fetch(altUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      if (altRes.ok) {
        const arrayBuffer2 = await altRes.arrayBuffer();
        const buffer2 = Buffer.from(arrayBuffer2);
        if (ttsAudioCache.size > 500) {
          const firstKey = ttsAudioCache.keys().next().value;
          if (firstKey) ttsAudioCache.delete(firstKey);
        }
        ttsAudioCache.set(cacheKey, buffer2);
        res.set({
          "Content-Type": "audio/mpeg",
          "Content-Length": buffer2.length.toString(),
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=86400"
        });
        return res.send(buffer2);
      }
      return res.status(response.status).send("TTS upstream service error");
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (ttsAudioCache.size > 500) {
      const firstKey = ttsAudioCache.keys().next().value;
      if (firstKey) ttsAudioCache.delete(firstKey);
    }
    ttsAudioCache.set(cacheKey, buffer);
    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": buffer.length.toString(),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=86400"
    });
    res.send(buffer);
  } catch (err) {
    console.error("TTS endpoint error:", err);
    res.status(500).send("Internal TTS error");
  }
});
app.get("/api/youtube/subscriptions", async (req, res) => {
  try {
    const token = req.query.token;
    let channels = [];
    if (token) {
      try {
        const ytRes = await fetch("https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=25", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (ytRes.ok) {
          const data = await ytRes.json();
          if (data.items && Array.isArray(data.items)) {
            channels = data.items.map((item) => {
              const chTitle = item.snippet.title;
              const chId = item.snippet.resourceId.channelId;
              const thumb = item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(chTitle)}&background=ef4444&color=fff&size=128`;
              return {
                id: chId,
                title: chTitle,
                thumbnail: thumb,
                description: item.snippet.description || "YouTube Abone Olunan Kanal",
                type: "youtube",
                unreadCount: 2,
                enabled: true,
                notificationsEnabled: true,
                recentVideos: [
                  {
                    id: `yt_${chId}_1`,
                    title: `${chTitle} - Son Yay\u0131nlanan \xD6zel Yay\u0131n & Analiz`,
                    videoId: "ScMzIvxBSi4",
                    publishedAt: "1 saat \xF6nce",
                    thumbnail: "https://img.youtube.com/vi/ScMzIvxBSi4/hqdefault.jpg"
                  },
                  {
                    id: `yt_${chId}_2`,
                    title: `${chTitle} - Haftal\u0131k \xD6nemli Ba\u015Fl\u0131klar De\u011Ferlendirmesi`,
                    videoId: "2lAe1cqCOXo",
                    publishedAt: "D\xFCn",
                    thumbnail: "https://img.youtube.com/vi/2lAe1cqCOXo/hqdefault.jpg"
                  }
                ]
              };
            });
          }
        }
      } catch (err) {
        console.warn("YouTube API fetch error:", err);
      }
    }
    if (channels.length === 0) {
      channels = [
        {
          id: "UC_nevsin_mengu",
          title: "Nev\u015Fin Meng\xFC",
          thumbnail: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
          description: "G\xFCnl\xFCk Siyaset, Ekonomi ve D\u0131\u015F Politika B\xFCltenleri",
          type: "youtube",
          unreadCount: 3,
          enabled: true,
          notificationsEnabled: true,
          recentVideos: [
            {
              id: "v_nm_1",
              title: "Siyasette S\u0131cak Geli\u015Fmeler & Ekonomi Analizi",
              videoId: "ScMzIvxBSi4",
              publishedAt: "1 saat \xF6nce",
              thumbnail: "https://img.youtube.com/vi/ScMzIvxBSi4/hqdefault.jpg"
            },
            {
              id: "v_nm_2",
              title: "K\xFCresel Piyasalar ve Merkez Bankalar\u0131 Kararlar\u0131",
              videoId: "L_LUpnjgPso",
              publishedAt: "D\xFCn",
              thumbnail: "https://img.youtube.com/vi/L_LUpnjgPso/hqdefault.jpg"
            }
          ]
        },
        {
          id: "UC_baris_ozcan",
          title: "Bar\u0131\u015F \xD6zcan",
          thumbnail: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
          description: "Sanat, Tasar\u0131m, Bilim ve Teknoloji Hikayeleri",
          type: "youtube",
          unreadCount: 1,
          enabled: true,
          notificationsEnabled: true,
          recentVideos: [
            {
              id: "v_bo_1",
              title: "Yapay Zekan\u0131n Gelece\u011Fi ve \u0130nsan Beyni",
              videoId: "2lAe1cqCOXo",
              publishedAt: "3 saat \xF6nce",
              thumbnail: "https://img.youtube.com/vi/2lAe1cqCOXo/hqdefault.jpg"
            },
            {
              id: "v_bo_2",
              title: "Uzay Yolculu\u011Funda Yeni D\xF6nem: Artemis ve Mars",
              videoId: "M7lc1UVf-VE",
              publishedAt: "2 g\xFCn \xF6nce",
              thumbnail: "https://img.youtube.com/vi/M7lc1UVf-VE/hqdefault.jpg"
            }
          ]
        },
        {
          id: "UC_cuneyt_ozdemir",
          title: "C\xFCneyt \xD6zdemir",
          thumbnail: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
          description: "Canl\u0131 Yay\u0131nlar, G\xFCndem ve Tarafs\u0131z Yorumlar",
          type: "youtube",
          unreadCount: 2,
          enabled: true,
          notificationsEnabled: true,
          recentVideos: [
            {
              id: "v_co_1",
              title: "G\xFCndemin \xD6ne \xC7\u0131kan Ba\u015Fl\u0131klar\u0131 & Canl\u0131 Tart\u0131\u015Fma",
              videoId: "fJ9rUzIMcZQ",
              publishedAt: "4 saat \xF6nce",
              thumbnail: "https://img.youtube.com/vi/fJ9rUzIMcZQ/hqdefault.jpg"
            }
          ]
        },
        {
          id: "UC_evrim_agaci",
          title: "Evrim A\u011Fac\u0131",
          thumbnail: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&auto=format&fit=crop&q=80",
          description: "Pop\xFCler Bilim, Biyoloji ve N\xF6robilim",
          type: "youtube",
          unreadCount: 4,
          enabled: true,
          notificationsEnabled: true,
          recentVideos: [
            {
              id: "v_ea_1",
              title: "Kuantum Fizi\u011Fi Ger\xE7ekten Ne S\xF6yl\xFCyor?",
              videoId: "bHIhgxav9LY",
              publishedAt: "5 saat \xF6nce",
              thumbnail: "https://img.youtube.com/vi/bHIhgxav9LY/hqdefault.jpg"
            }
          ]
        }
      ];
    }
    res.json({ success: true, channels });
  } catch (err) {
    console.error("YouTube subscriptions error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch YouTube subscriptions" });
  }
});
async function translateWithGoogle(text, targetLang = "en") {
  if (!text || text.trim().length === 0) return "";
  try {
    const cleanText = text.replace(/[\r\n]+/g, " \n ").trim();
    const sentences = cleanText.split(/(?<=[.!?\n])\s+/).filter((s) => s.trim().length > 0);
    if (sentences.length === 0) return "";
    const translatedParts = [];
    for (let i = 0; i < sentences.length; i += 3) {
      const batch = sentences.slice(i, i + 3).join(" ");
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(batch)}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.[0])) {
          const trans = json[0].map((item) => item?.[0] || "").join("");
          translatedParts.push(trans);
        } else {
          translatedParts.push(batch);
        }
      } else {
        translatedParts.push(batch);
      }
    }
    return translatedParts.join(" ").replace(/\s+/g, " ").trim();
  } catch (err) {
    console.error("translateWithGoogle error:", err);
    return text;
  }
}
app.post("/api/summarize", async (req, res) => {
  try {
    const { url, rawText, sourceType, focusArea, summaryLength, manualTranscript, customTitle, pageCount } = req.body;
    const summaryLevelCode = (summaryLength || "").includes("K\u0131sa") ? "CokKisa" : (summaryLength || "").includes("Detayl\u0131") ? "Detayli" : "Normal";
    if (sourceType === "pdf") {
      let estimatedPageCount = pageCount;
      if (!estimatedPageCount) {
        if (rawText && rawText.includes("/Type") && rawText.includes("/Page")) {
          const pageMatches = rawText.match(/\/Type\s*\/Page\b/g);
          estimatedPageCount = pageMatches ? pageMatches.length : 1;
        } else if (rawText && rawText.includes("base64,")) {
          estimatedPageCount = Math.max(1, Math.ceil(rawText.length / 5e4));
        } else {
          const cleanLen = (rawText || "").replace(/[^a-zA-Z0-9\sğüşıöçĞÜŞİÖÇ]/g, "").length;
          estimatedPageCount = Math.max(1, Math.ceil(cleanLen / 3e3));
        }
      }
      if (estimatedPageCount > 50) {
        return res.status(400).json({
          success: false,
          error: "Y\xFCkledi\u011Finiz belge 50 sayfa s\u0131n\u0131r\u0131n\u0131 a\u015F\u0131yor. L\xFCtfen daha k\u0131sa bir belge y\xFCkleyin veya ilgili b\xF6l\xFCm\xFC par\xE7alar halinde tarat\u0131n."
        });
      }
    }
    let prompt = "";
    let fetchedTitle = customTitle || "";
    let fetchedAuthor = "VOX AI Studio";
    let fetchedThumbnail = "";
    let fetchedTextSource = manualTranscript || rawText || "";
    const ytId = url ? extractYouTubeId(url) : null;
    if (sourceType === "web" || url && !ytId && sourceType !== "youtube") {
      let webInfo = url ? await getWebpageText(url) : null;
      const combinedText = (webInfo?.text || "") + "\n" + (rawText || "") + "\n" + (customTitle || "");
      if (!combinedText.trim() || combinedText.trim().length < 20 && !customTitle) {
        console.warn(`[Web Scraping] Insufficient text for URL: ${url}`);
        return res.status(400).json({
          success: false,
          error: "URL_CONTENT_TOO_SHORT",
          message: "Web sayfas\u0131ndan veya girilen kaynaktan metin al\u0131namad\u0131. L\xFCtfen do\u011Frudan metin yap\u0131\u015Ft\u0131r\u0131n veya ba\u015Fka bir ba\u011Flant\u0131 deneyin."
        });
      }
      fetchedTitle = customTitle || webInfo?.title || "Haber Analizi";
      fetchedThumbnail = webInfo?.thumbnail || "";
      fetchedAuthor = webInfo?.author || "Haber Kayna\u011F\u0131";
      fetchedTextSource = (webInfo?.fullContext || webInfo?.text || rawText || customTitle || "").trim();
      const analysisText = webInfo?.text && webInfo.text.length > 50 ? webInfo.text : rawText || customTitle || "";
      prompt = `
[S\u0130STEM ROL\xDC VE B\u0130L\u0130NGUAL PODCAST \xDCRET\u0130C\u0130S\u0130]
Sen profesyonel bir gazeteci, podcast sunucusu ve haber edit\xF6r\xFCs\xFCn. G\xF6revin; verilen web makalesi i\xE7eri\u011Fini analiz ederek, dinleyiciye hem ak\u0131c\u0131 bir T\xFCrk\xE7e podcast b\xFClteni ('title', 'summary', 'content', 'keyPoints'), hem de profesyonel bir \u0130ngilizce podcast b\xFClteni ('englishTitle', 'englishSummary', 'englishContent', 'englishKeyPoints') haz\u0131rlamakt\u0131r.

[G\xD6REV PARAMETLER\u0130]
- Kaynak T\xFCr\xFC: Web Ba\u011Flant\u0131s\u0131 (URL) / Haber
- Haber Kayna\u011F\u0131 / Yay\u0131nc\u0131: "${fetchedAuthor}"
- Makale Metni:
"""
${analysisText}
"""
- \u0130stenen \xD6zet Seviyesi: ${summaryLevelCode} (\xC7okKisa / Normal / Detayli)

[ANAL\u0130Z VE MET\u0130N KURALLARI]
1. T\xFCrk\xE7e versiyon: Metni bir b\xFCt\xFCn olarak Giri\u015F, Geli\u015Fme ve Sonu\xE7 ak\u0131\u015F\u0131nda olu\u015Ftur. Haber kayna\u011F\u0131n\u0131n ad\u0131 ("${fetchedAuthor}") metin i\xE7inde do\u011Fal olarak ge\xE7meli.
2. \u0130ngilizce versiyon: Do\u011Fal telaffuzlu, do\u011Frudan seslendirmeye uygun ak\u0131c\u0131 bir \u0130ngilizce podcast metni yaz.
3. Her iki dilde de sahne y\xF6nergeleri ([Music], [Intro]) veya jenerik selamlama ("Welcome to...", "Bug\xFCn...") OLMADAN do\u011Frudan konunun \xF6z\xFCyle ba\u015Fla.
4. "Canl\u0131 Google Haberler Ak\u0131\u015F\u0131" gibi sistem i\xE7i teknik ifadeleri KES\u0130NL\u0130KLE yazma.

[\xC7IKTI FORMATI - GE\xC7ERL\u0130 JSON]
{
  "title": "${fetchedTitle.replace(/"/g, "'")}",
  "summary": "Haberin konusunu, arka plan\u0131n\u0131 ve sonucunu veren 2 c\xFCmlelik tarafs\u0131z T\xFCrk\xE7e \xF6zet.",
  "content": "Giri\u015F, geli\u015Fme ve sonu\xE7 k\u0131s\u0131mlar\u0131n\u0131 i\xE7eren, haber kayna\u011F\u0131n\u0131n ad\u0131n\u0131n belirtildi\u011Fi ak\u0131c\u0131 T\xFCrk\xE7e seslendirme metni.",
  "category": "${focusArea ? focusArea.split(" ")[0] : "Haber"}",
  "durationSeconds": ${summaryLevelCode === "CokKisa" ? 180 : summaryLevelCode === "Detayli" ? 480 : 300},
  "author": "${fetchedAuthor}",
  "imageUrl": "${fetchedThumbnail || ""}",
  "keyPoints": [
    "Kritik ayr\u0131nt\u0131 1",
    "Kritik ayr\u0131nt\u0131 2",
    "Kaynak: ${fetchedAuthor}"
  ],
  "englishTitle": "English Translated Title",
  "englishSummary": "English 2-3 sentence clear summary.",
  "englishContent": "English fluent podcast narration text.",
  "englishKeyPoints": ["English point 1", "English point 2", "Source: ${fetchedAuthor}"]
}
`;
    } else if (sourceType === "pdf") {
      const estimatedPageCount = pageCount || Math.max(1, Math.ceil((rawText || "").length / 1500));
      fetchedTitle = customTitle || "Dok\xFCman Analizi";
      fetchedAuthor = "VOX Akademik & Belge Analisti";
      prompt = `
[S\u0130STEM ROL\xDC VE B\u0130L\u0130NGUAL BELGE ANAL\u0130ST\u0130]
Y\xFCklenen PDF veya belgeyi analiz ederek HEM T\xDCRK\xC7E HEM DE \u0130NG\u0130L\u0130ZCE seslendirmeye haz\u0131r profesyonel podcast b\xFClteni haz\u0131rla.

[G\xD6REV PARAMETLER\u0130]
- Belge Sayfa Say\u0131s\u0131: ${estimatedPageCount}
- Belge \u0130\xE7eri\u011Fi:
"""
${rawText || "PDF ve Belge Metni"}
"""
- \u0130stenen Seviye: ${summaryLevelCode}

[\xC7IKTI FORMATI - GE\xC7ERL\u0130 JSON]
{
  "title": "${fetchedTitle.replace(/"/g, "'")}",
  "summary": "Dok\xFCman\u0131n genel T\xFCrk\xE7e y\xF6netici \xF6zeti.",
  "content": "Giri\u015F, \xF6nemli bulgular ve sonu\xE7lar\u0131 aktaran T\xFCrk\xE7e seslendirme metni.",
  "category": "Belge",
  "durationSeconds": ${summaryLevelCode === "CokKisa" ? 180 : summaryLevelCode === "Detayli" ? 480 : 300},
  "author": "${fetchedAuthor}",
  "imageUrl": "https://images.unsplash.com/photo-1568667256549-094345857637?w=600&auto=format&fit=crop&q=80",
  "keyPoints": ["\xD6nemli bulgu 1", "\xD6nemli bulgu 2", "Sonu\xE7 ve \xF6neri 3"],
  "englishTitle": "English Document Title",
  "englishSummary": "English executive summary.",
  "englishContent": "English document podcast narration script.",
  "englishKeyPoints": ["Key finding 1", "Key finding 2", "Conclusion 3"]
}
`;
    } else if (sourceType === "text") {
      fetchedTitle = customTitle || "Metin Analizi";
      fetchedAuthor = "VOX Metin D\xFCzenleme Uzman\u0131";
      prompt = `
[S\u0130STEM ROL\xDC VE B\u0130L\u0130NGUAL MET\u0130N UZMANI]
Kullan\u0131c\u0131n\u0131n payla\u015Ft\u0131\u011F\u0131 metni mant\u0131ksal s\u0131raya koyarak HEM T\xDCRK\xC7E HEM DE \u0130NG\u0130L\u0130ZCE podcast seslendirme metni olu\u015Ftur.

[G\xD6REV PARAMETLER\u0130]
- Ham Metin:
"""
${rawText || "Pano ham metin verisi"}
"""
- \u0130stenen Seviye: ${summaryLevelCode}

[\xC7IKTI FORMATI - GE\xC7ERL\u0130 JSON]
{
  "title": "${fetchedTitle.replace(/"/g, "'")}",
  "summary": "Metnin d\xFCzenlenmi\u015F ana T\xFCrk\xE7e \xF6zeti.",
  "content": "Giri\u015F - Geli\u015Fme - Sonu\xE7 ak\u0131\u015F\u0131nda haz\u0131rlanm\u0131\u015F T\xFCrk\xE7e podcast metni.",
  "category": "Metin",
  "durationSeconds": ${summaryLevelCode === "CokKisa" ? 180 : summaryLevelCode === "Detayli" ? 480 : 300},
  "author": "${fetchedAuthor}",
  "imageUrl": "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600&auto=format&fit=crop&q=80",
  "keyPoints": ["\xD6nemli vurgu 1", "\xD6nemli vurgu 2", "\xD6nemli vurgu 3"],
  "englishTitle": "English Text Title",
  "englishSummary": "English concise summary.",
  "englishContent": "English podcast narration script.",
  "englishKeyPoints": ["Key highlight 1", "Key highlight 2", "Key highlight 3"]
}
`;
    } else {
      const effectiveUrl = url || (ytId ? `https://www.youtube.com/watch?v=${ytId}` : "");
      const targetYtId = extractYouTubeId(effectiveUrl) || ytId;
      if (!targetYtId) {
        return res.status(400).json({
          success: false,
          error: "TRANSCRIPT_FETCH_FAILED",
          message: "Ge\xE7ersiz YouTube video ba\u011Flant\u0131s\u0131. L\xFCtfen ge\xE7erli bir YouTube URL adresi girin."
        });
      }
      const ytInfo = await getYouTubeMetadata(effectiveUrl);
      let rawTranscriptText = manualTranscript && manualTranscript.trim().length > 30 ? manualTranscript.trim() : ytInfo?.transcript && ytInfo.transcript.trim().length > 30 ? ytInfo.transcript.trim() : null;
      let isMetadataFallback = false;
      if (!rawTranscriptText) {
        const desc = ytInfo?.videoDescription && !isGenericYouTubeText(ytInfo.videoDescription) ? ytInfo.videoDescription.trim() : "";
        const title = ytInfo?.title || customTitle || "YouTube Videosu";
        const author = ytInfo?.author || "YouTube Yay\u0131nc\u0131s\u0131";
        isMetadataFallback = true;
        rawTranscriptText = `[V\u0130DEO B\u0130LG\u0130LER\u0130 VE A\xC7IKLAMA METN\u0130]
Video Ba\u015Fl\u0131\u011F\u0131: ${title}
Kanal / Yay\u0131nc\u0131: ${author}
Video ID: ${targetYtId}

Video A\xE7\u0131klamas\u0131:
${desc || "G\xFCndemdeki bu YouTube yay\u0131n\u0131nda \xF6ne \xE7\u0131kan temel fikirler ve b\xFClten detaylar\u0131 analiz edilerek VOX Ak\u0131ll\u0131 Seslendirme Metnine d\xF6n\xFC\u015Ft\xFCr\xFClm\xFC\u015Ft\xFCr."}`;
      }
      fetchedTitle = customTitle || ytInfo?.title || "YouTube Videosu";
      fetchedAuthor = ytInfo?.author || "YouTube Yay\u0131nc\u0131s\u0131";
      fetchedThumbnail = ytInfo?.thumbnail || `https://img.youtube.com/vi/${targetYtId}/hqdefault.jpg`;
      fetchedTextSource = rawTranscriptText;
      const origSecs = ytInfo?.originalDurationSeconds || 0;
      const textLen = rawTranscriptText.length;
      let targetDurationSeconds = 300;
      let durationInstruction = "";
      if (summaryLevelCode === "CokKisa") {
        targetDurationSeconds = 180;
        durationInstruction = "Metin Seviyesi: K\u0131sa B\xFClten (Yakla\u015F\u0131k 3 dakika seslendirme s\xFCresi, 300-450 kelime). \xD6z ve vurucu 2-3 paragraf olu\u015Ftur.";
      } else if (summaryLevelCode === "Detayli") {
        targetDurationSeconds = 480;
        durationInstruction = "Metin Seviyesi: Detayl\u0131 Analiz (Yakla\u015F\u0131k 8-10 dakika geni\u015F b\xFClten, 900-1300 kelime). Konudaki hi\xE7bir ana ba\u015Fl\u0131\u011F\u0131 atlalamadan 4-6 geni\u015F paragraf yaz.";
      } else {
        if (origSecs >= 1800 || textLen > 12e3) {
          targetDurationSeconds = 480;
          durationInstruction = `[UZUN V\u0130DEO ANAL\u0130Z\u0130] Orijinal YouTube videosu ${origSecs > 0 ? Math.round(origSecs / 60) + " dakika" : "uzun/detayl\u0131"} oldu\u011Fu i\xE7in yakla\u015F\u0131k 8 DAK\u0130KALIK (480 saniye / ~900-1200 kelime) zengin ve detayl\u0131 bir b\xFClten metni yaz.`;
        } else if (origSecs >= 900 || textLen > 6e3) {
          targetDurationSeconds = 360;
          durationInstruction = `[ORTA UZUNLUKTA V\u0130DEO] Orijinal video ${origSecs > 0 ? Math.round(origSecs / 60) + " dakika" : "orta uzunlukta"} oldu\u011Fu i\xE7in yakla\u015F\u0131k 6 DAK\u0130KALIK (360 saniye / ~700-900 kelime) dengeli bir podcast b\xFClteni metni yaz.`;
        } else {
          targetDurationSeconds = 240;
          durationInstruction = `[KISA V\u0130DEO] Orijinal video k\u0131sa oldu\u011Fu i\xE7in 4 DAK\u0130KALIK (240 saniye / ~450-600 kelime) net ve \xF6z bir b\xFClten metni yaz.`;
        }
      }
      prompt = `
[S\u0130STEM ROL\xDC VE \xC7\u0130FT D\u0130LL\u0130 PODCAST SUNUCUSU - KR\u0130T\u0130K G\xD6REV]
Sen VOX St\xFCdyo'nun k\u0131demli yay\u0131n direkt\xF6r\xFCs\xFCn. YouTube videosunun ${isMetadataFallback ? "ba\u015Fl\u0131k ve a\xE7\u0131klamas\u0131n\u0131" : "transkriptini/de\u015Fifresini"} inceleyeceksin.

D\u0130L D\xD6N\xDC\u015E\xDCM\xDC VE PODCAST KURALLARI:
1. KAYNAK D\u0130L\u0130 FARK ETMEKS\u0130Z\u0130N (V\u0130DEO T\xDCRK\xC7E, \u0130NG\u0130L\u0130ZCE VEYA BA\u015EKA B\u0130R D\u0130LDE OLSA DAH\u0130), HEM TAM VE KUSURSUZ B\u0130R T\xDCRK\xC7E PODCAST METN\u0130 ('title', 'summary', 'content', 'keyPoints'), HEM DE TAM VE KUSURSUZ B\u0130R \u0130NG\u0130L\u0130ZCE PODCAST METN\u0130 ('englishTitle', 'englishSummary', 'englishContent', 'englishKeyPoints') \xDCRETMEL\u0130S\u0130N.
2. E\u011Fer orijinal video \u0130NG\u0130L\u0130ZCE ise: \u0130ngilizce transkripti analiz et; dinleyici i\xE7in kusursuz, ak\u0131c\u0131 bir T\xFCrk\xE7e seslendirme metnine \xE7evirip uyarla ('content') ve ayr\u0131ca ana dili \u0130ngilizce olanlar i\xE7in ak\u0131c\u0131 bir \u0130ngilizce podcast metni olu\u015Ftur ('englishContent').
3. E\u011Fer orijinal video T\xDCRK\xC7E ise: T\xFCrk\xE7e podcast metnini ('content') haz\u0131rla ve bunun tam, profesyonel \u0130ngilizce podcast \xE7evirisini ('englishContent') olu\u015Ftur.
4. KOPUK S\xD6ZC\xDCKLER\u0130 B\u0130RLE\u015ET\u0130R: Ham altyaz\u0131lardaki kopuk s\xF6zc\xFCkleri ("Dr.", "25 vs", "1.", "Evet,") ak\u0131c\u0131 tam c\xFCmleler haline getir.
5. ${durationInstruction}
6. DO\u011ERUDAN ANLATIM: "[Music]", "[Giri\u015F]", "(G\xFCl\xFC\u015Fmeler)" veya "Welcome back to the channel" gibi jenerik laflar OLMADAN, do\u011Frudan konunun i\xE7eri\u011Fiyle ba\u015Fla.

[G\xD6REV PARAMETLER\u0130]
- Video Ba\u015Fl\u0131\u011F\u0131: "${fetchedTitle.replace(/"/g, "'")}"
- Kanal: "${fetchedAuthor.replace(/"/g, "'")}"
- Transkript / Veri:
"""
${rawTranscriptText}
"""
- Seviye: ${summaryLevelCode}
- Odak: ${focusArea || "Genel Konu"}

[\xC7IKTI FORMATI - GE\xC7ERL\u0130 JSON]
{
  "title": "Videonun T\xFCrk\xE7e Ba\u015Fl\u0131\u011F\u0131",
  "summary": "Videonun ana konusunu ve sonucunu aktaran 2-3 c\xFCmlelik net T\xFCrk\xE7e \xF6zet.",
  "content": "Jenerik selamlama i\xE7ermeyen, bilgileri do\u011Frudan ve ak\u0131c\u0131 paragraflar halinde aktaran T\xFCrk\xE7e podcast seslendirme metni.",
  "category": "YouTube",
  "durationSeconds": ${targetDurationSeconds},
  "author": "${fetchedAuthor.replace(/"/g, "'")}",
  "imageUrl": "${fetchedThumbnail}",
  "keyPoints": [
    "T\xFCrk\xE7e ana fikir 1",
    "T\xFCrk\xE7e ana fikir 2",
    "T\xFCrk\xE7e ana fikir 3"
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
    let geminiContents = prompt;
    if (sourceType === "pdf" && rawText && rawText.includes("base64,")) {
      const base64Data = rawText.split("base64,")[1];
      geminiContents = [
        {
          inlineData: {
            data: base64Data,
            mimeType: "application/pdf"
          }
        },
        prompt
      ];
    }
    let data;
    try {
      const response = await callGeminiWithRetry({
        model: "gemini-3.7-flash",
        contents: geminiContents,
        config: {
          responseMimeType: "application/json"
        }
      });
      const jsonText = response.text;
      if (!jsonText) {
        throw new Error("Empty response from Gemini");
      }
      data = JSON.parse(jsonText);
      if (data.error === "TRANSCRIPT_UNAVAILABLE" || data.content === "TRANSCRIPT_UNAVAILABLE") {
        if (sourceType === "youtube" && fetchedTitle) {
          data = {
            title: fetchedTitle,
            summary: `${fetchedTitle} konusundaki temel geli\u015Fmeler ve \xF6zet i\xE7erik.`,
            content: `${fetchedTitle} ba\u015Fl\u0131kl\u0131 video i\xE7erik analizi ile olu\u015Fturulmu\u015Ftur. ${fetchedTextSource || ""}`,
            category: "YouTube",
            durationSeconds: 300,
            author: fetchedAuthor || "YouTube Yay\u0131nc\u0131s\u0131",
            imageUrl: fetchedThumbnail || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=600&auto=format&fit=crop&q=80"),
            keyPoints: [fetchedTitle, "YouTube \u0130\xE7erik Analizi", "VOX Sesli B\xFClten"],
            englishTitle: fetchedTitle,
            englishSummary: `Key insights and developments regarding ${fetchedTitle}.`,
            englishContent: `Podcast briefing analyzed and adapted from ${fetchedTitle}.`,
            englishKeyPoints: [fetchedTitle, "YouTube Analysis", "VOX Audio Briefing"]
          };
        } else {
          return res.status(400).json({
            success: false,
            error: "TRANSCRIPT_UNAVAILABLE",
            message: "Bu YouTube videosunun alt yaz\u0131lar\u0131 (transkripti) bulunamad\u0131 veya \xE7ekilemedi. L\xFCtfen alt yaz\u0131lar\u0131 aktif olan bir video se\xE7in ya da transkript metnini manuel ekleyin."
          });
        }
      }
      if (data.error === "ERROR_INSUFFICIENT_TEXT" || data.content === "ERROR_INSUFFICIENT_TEXT") {
        return res.status(400).json({
          success: false,
          error: "URL_CONTENT_TOO_SHORT",
          message: "Bu web sayfas\u0131ndaki ana makale metni okunamad\u0131 veya \xE7ok k\u0131sa. L\xFCtfen do\u011Frudan metin yap\u0131\u015Ft\u0131r\u0131n."
        });
      }
    } catch (aiErr) {
      console.log("Gemini summarization fallback triggered:", aiErr?.message || aiErr);
      const textSource = (fetchedTextSource || manualTranscript || rawText || "").replace(/<[^>]+>/g, "").trim();
      const rawLines = textSource.split("\n").map((l) => l.trim()).filter(
        (l) => l.length > 0 && !l.startsWith("[V\u0130DEO SEZON") && !l.startsWith("[V\u0130DEO A\xC7IKLAMASI") && !isGenericYouTubeText(l) && !l.includes("seslendirme metnine d\xF6n\xFC\u015Ft\xFCr\xFCl\xFCyor")
      );
      const cleanBodyText = rawLines.join(" ");
      const sentences = cleanBodyText.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 10 && !isGenericYouTubeText(s) && !s.includes("seslendirme metnine d\xF6n\xFC\u015Ft\xFCr\xFCl\xFCyor"));
      const fallbackTitle = customTitle || (fetchedTitle && !fetchedTitle.includes("N/A") ? fetchedTitle : "VOX YouTube Sesli B\xFClteni");
      const fallbackSummary = sentences.slice(0, 3).join(" ") || `${fallbackTitle} konusundaki detaylar ve \xF6nemli geli\u015Fmeler.`;
      let fallbackContent = "";
      if (sentences.length >= 2) {
        const paragraphSize = Math.max(2, Math.ceil(sentences.length / 4));
        const paragraphs = [];
        for (let i = 0; i < sentences.length; i += paragraphSize) {
          paragraphs.push(sentences.slice(i, i + paragraphSize).join(" "));
        }
        fallbackContent = paragraphs.join("\n\n");
      } else {
        fallbackContent = `${fallbackTitle} konusundaki detaylar analiz edilmi\u015F olup VOX Ak\u0131ll\u0131 Seslendirme Modu ile dinlenmeye haz\u0131rd\u0131r.`;
      }
      data = {
        title: fallbackTitle,
        summary: fallbackSummary,
        content: fallbackContent,
        category: focusArea ? focusArea.split(" ")[0] : sourceType === "pdf" ? "Dok\xFCman" : sourceType === "youtube" ? "YouTube" : "Haber",
        durationSeconds: summaryLevelCode === "CokKisa" ? 180 : summaryLevelCode === "Detayli" ? 480 : 300,
        author: fetchedAuthor || "VOX Ak\u0131ll\u0131 \xD6zet",
        imageUrl: fetchedThumbnail || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&auto=format&fit=crop&q=80"),
        keyPoints: sentences.slice(0, 3).length > 0 ? sentences.slice(0, 3).map((s) => s.substring(0, 80)) : [fallbackTitle, "\u0130\xE7erik \xF6zeti haz\u0131rland\u0131", "VOX Ak\u0131ll\u0131 Mod"]
      };
    }
    if (!data.englishContent || data.englishContent.trim() === data.content?.trim() || data.englishContent.length < 15) {
      try {
        const [enTitle, enSummary, enContent] = await Promise.all([
          translateWithGoogle(data.title || fetchedTitle || "", "en"),
          translateWithGoogle(data.summary || "", "en"),
          translateWithGoogle(data.content || "", "en")
        ]);
        data.englishTitle = enTitle || data.title;
        data.englishSummary = enSummary || data.summary;
        data.englishContent = enContent || data.content;
        data.englishKeyPoints = Array.isArray(data.keyPoints) ? await Promise.all(data.keyPoints.map((kp) => translateWithGoogle(kp, "en"))) : [enTitle, "Podcast briefing ready", "VOX AI"];
      } catch (transErr) {
        console.warn("Google Translate auto-enrichment warning:", transErr);
      }
    }
    if (!data.imageUrl && ytId) {
      data.imageUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    }
    res.json({ success: true, data });
  } catch (err) {
    console.error("Summarize error:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to process summarization"
    });
  }
});
app.post("/api/translate", async (req, res) => {
  try {
    const { title, summary, content, keyPoints, targetLang = "en" } = req.body;
    if (!content && !summary) {
      return res.status(400).json({ success: false, error: "Content or summary required" });
    }
    const isTargetEn = targetLang === "en";
    let data;
    try {
      const prompt = isTargetEn ? `
You are a professional podcast translator and news anchor. Translate and adapt the following news bulletin / podcast content from Turkish into natural, engaging, clear spoken English suitable for TTS narration.

CRITICAL RULE FOR AUDIO: Do NOT include meta-intros (e.g., "Welcome to the podcast", "Here is the translation"), stage directions in brackets (e.g., "[Music]", "[Intro]", "(Pause)"), or filler greetings. Start the translated content directly with the actual news/podcast story so speech begins immediately.

Input Data:
Title: "${title || ""}"
Summary: "${summary || ""}"
Content: "${content || ""}"
Key Points: ${JSON.stringify(keyPoints || [])}

Respond ONLY with valid JSON in this exact structure:
{
  "title": "English translated title",
  "summary": "English translated summary (2-3 sentences)",
  "content": "English translated podcast narration content (engaging, direct natural phrasing)",
  "keyPoints": ["English point 1", "English point 2", "English point 3"]
}
` : `
Sen profesyonel bir podcast \xE7evirmeni ve seslendirme yazar\u0131s\u0131n. A\u015Fa\u011F\u0131daki \u0130ngilizce b\xFClten/podcast metnini ak\u0131c\u0131, do\u011Fal ve seslendirmeye uygun tam T\xFCrk\xE7e bir podcast metnine d\xF6n\xFC\u015Ft\xFCr.

SESLEND\u0130RME KR\u0130T\u0130K KURALI: Ba\u015Flang\u0131\xE7ta "Podcast'e ho\u015F geldiniz", "Bu bir \xE7eviridir", "[M\xFCzik]" veya parantez i\xE7i ses efektleri KES\u0130NL\u0130KLE yer almamal\u0131d\u0131r. Do\u011Frudan konunun i\xE7eri\u011Fiyle ba\u015Fla.

Girdi Verisi:
Ba\u015Fl\u0131k: "${title || ""}"
\xD6zet: "${summary || ""}"
\u0130\xE7erik: "${content || ""}"
\xD6nemli Maddeler: ${JSON.stringify(keyPoints || [])}

Yaln\u0131zca a\u015Fa\u011F\u0131daki JSON format\u0131nda yan\u0131t ver:
{
  "title": "T\xFCrk\xE7e \xE7evrilmi\u015F ba\u015Fl\u0131k",
  "summary": "T\xFCrk\xE7e 2-3 c\xFCmlelik net \xF6zet",
  "content": "T\xFCrk\xE7e ak\u0131c\u0131 podcast seslendirme metni",
  "keyPoints": ["T\xFCrk\xE7e madde 1", "T\xFCrk\xE7e madde 2", "T\xFCrk\xE7e madde 3"]
}
`;
      const response = await callGeminiWithRetry({
        model: "gemini-3.7-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      const jsonText = response.text || "{}";
      data = JSON.parse(jsonText);
    } catch (aiErr) {
      console.log("Gemini translate API fallback triggered, using Google Translate proxy:", aiErr?.message || aiErr);
      const targetCode = isTargetEn ? "en" : "tr";
      const [transTitle, transSummary, transContent] = await Promise.all([
        translateWithGoogle(title || "", targetCode),
        translateWithGoogle(summary || "", targetCode),
        translateWithGoogle(content || "", targetCode)
      ]);
      const transKeyPoints = Array.isArray(keyPoints) ? await Promise.all(keyPoints.map((kp) => translateWithGoogle(kp, targetCode))) : [transTitle, isTargetEn ? "Podcast briefing ready" : "Sesli b\xFClten haz\u0131r"];
      data = {
        title: transTitle || title,
        summary: transSummary || summary,
        content: transContent || content,
        keyPoints: transKeyPoints
      };
    }
    res.json({ success: true, data });
  } catch (err) {
    console.log("Translate request error:", err.message || err);
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/gemini", async (req, res) => {
  try {
    const { prompt, systemInstruction } = req.body;
    try {
      const response = await callGeminiWithRetry({
        model: "gemini-3.7-flash",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction || "You are VOX AI assistant for podcast audio processing."
        }
      });
      res.json({ success: true, text: response.text });
    } catch (aiErr) {
      const isQuotaError = aiErr?.status === 429 || aiErr?.message?.includes("429");
      console.log("Gemini proxy status notice:", isQuotaError ? "Quota limit reached" : "Processing fallback");
      res.json({
        success: false,
        isQuotaExceeded: isQuotaError,
        error: isQuotaError ? "Yapay zeka servis kotas\u0131 ge\xE7ici olarak doldu. L\xFCtfen 15 saniye sonra tekrar deneyin." : aiErr.message || "AI \u0130\u015Flem hatas\u0131"
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/youtube/channel-feed", async (req, res) => {
  try {
    const { handle } = req.query;
    const channels = [
      { name: "Nev\u015Fin Meng\xFC", handle: "@nevsinmengu", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80", lastVideo: "G\xFCn\xFCn \xD6nemli Geli\u015Fmeleri & Siyaset Analizi", bell: true },
      { name: "Bar\u0131\u015F \xD6zcan", handle: "@BarisOzcan", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80", lastVideo: "Yapay Zeka D\xFCnyas\u0131ndaki Devrim", bell: true },
      { name: "C\xFCneyt \xD6zdemir", handle: "@cuneytozdemir", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80", lastVideo: "G\xFCndeme Dair \xD6zel Yay\u0131n", bell: true },
      { name: "Fatih Altayl\u0131", handle: "@fatihaltayli", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80", lastVideo: "Teke Tek \xD6zel Yorumlar", bell: true },
      { name: "ShiftDelete.Net", handle: "@shiftdeletenet", avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80", lastVideo: "Yeni Nesil Mobil Teknolojiler", bell: false },
      { name: "Evrim A\u011Fac\u0131", handle: "@evrimagaci", avatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=120&auto=format&fit=crop&q=80", lastVideo: "Evrenin Derinliklerindeki Gizem", bell: true },
      { name: "Efe Aydal", handle: "@efeaydal", avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&auto=format&fit=crop&q=80", lastVideo: "Haftal\u0131k K\u0131rm\u0131z\u0131 Hap B\xFCltensel Bak\u0131\u015F", bell: false }
    ];
    let filtered = channels;
    if (handle) {
      filtered = channels.filter((c) => c.handle.toLowerCase().includes(handle.toLowerCase()) || c.name.toLowerCase().includes(handle.toLowerCase()));
    }
    res.json({ success: true, channels: filtered });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/youtube/sync-user-subscriptions", (req, res) => {
  res.json({
    success: true,
    email: "karahanbedel@gmail.com",
    status: "connected",
    activeBellsCount: 5,
    syncedChannels: [
      "Nev\u015Fin Meng\xFC",
      "Bar\u0131\u015F \xD6zcan",
      "C\xFCneyt \xD6zdemir",
      "Fatih Altayl\u0131",
      "Evrim A\u011Fac\u0131"
    ],
    lastSyncTime: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.post("/api/ocr", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: "imageBase64 required" });
    }
    const imagePart = {
      inlineData: {
        data: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
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
    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: [imagePart, prompt],
      config: {
        responseMimeType: "application/json"
      }
    });
    const jsonText = response.text || "{}";
    const data = JSON.parse(jsonText);
    res.json({ success: true, data });
  } catch (err) {
    console.error("OCR error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});
var newsFeedCache = /* @__PURE__ */ new Map();
var NEWS_CACHE_TTL = 15 * 60 * 1e3;
async function summarizeNewsItemWithGemini(item) {
  try {
    const prompt = `
[S\u0130STEM ROL\xDC]
Sen profesyonel bir haber edit\xF6r\xFC ve spikerisin.

[G\xD6REV VE KES\u0130N TAL\u0130MAT]
Websitesinden ald\u0131\u011F\u0131n metni anlaml\u0131 bir b\xFCt\xFCn halinde \xF6zetle. Giri\u015F geli\u015Fme ve sonu\xE7 olarak de\u011Ferlendir. Maksimum 7 c\xFCmle olmal\u0131. Anlams\u0131z ve kendini tekrar eden c\xFCmleler burada bulunmamal\u0131. Haber kayna\u011F\u0131n\u0131n ad\u0131 belirtilmeli ancak kaynak sistem (Canl\u0131 Google Haberler Ak\u0131\u015F\u0131) belirtilmemeli.

[HABER B\u0130LG\u0130LER\u0130]
Haber Ba\u015Fl\u0131\u011F\u0131: "${item.title}"
Haber Kayna\u011F\u0131: "${item.author}"
Kategori: "${item.category}"
Haber Metni:
"""
${(item.text || item.title).substring(0, 5e3)}
"""

[\xD6ZETLEME VE \xC7IKTI KURALLARI]
1. Metni Giri\u015F, Geli\u015Fme ve Sonu\xE7 b\xFCt\xFCnl\xFC\u011F\xFC i\xE7erisinde kurgula.
2. content (seslendirme metni) EN FAZLA 7 C\xDCMLEDEN olu\u015Fmal\u0131d\u0131r.
3. Anlams\u0131z, yar\u0131m kalm\u0131\u015F, kopuk veya kendini tekrar eden c\xFCmleler KES\u0130NL\u0130KLE yer almamal\u0131d\u0131r.
4. Haber kayna\u011F\u0131n\u0131n ad\u0131 ("${item.author}") metin i\xE7erisinde do\u011Fal ve profesyonel bir haber diliyle a\xE7\u0131k\xE7a belirtilmelidir.
5. "Canl\u0131 Google Haberler Ak\u0131\u015F\u0131", "Google Haberler" veya sistem i\xE7i teknik kaynak adlar\u0131 KES\u0130NL\u0130KLE belirtilmemeli ve metinde yer almamal\u0131d\u0131r.
6. keyPoints alan\u0131nda haberin 3 kritik ba\u015Fl\u0131\u011F\u0131 yer almal\u0131 ve son madde "Kaynak: ${item.author}" olmal\u0131d\u0131r.

[\xC7IKTI FORMATI]
Yaln\u0131zca a\u015Fa\u011F\u0131daki JSON format\u0131nda yan\u0131t ver:
{
  "title": "${item.title.replace(/"/g, "'")}",
  "summary": "Haberin konusunu ve sonucunu aktaran 2 c\xFCmlelik net \xF6zet.",
  "content": "Giri\u015F, geli\u015Fme ve sonu\xE7 ak\u0131\u015F\u0131yla, ${item.author} kayna\u011F\u0131 belirtilerek haz\u0131rlanm\u0131\u015F en fazla 7 c\xFCmlelik ak\u0131c\u0131 sesli haber metni.",
  "keyPoints": [
    "\xD6nemli geli\u015Fme 1",
    "\xD6nemli geli\u015Fme 2",
    "Kaynak: ${item.author}"
  ]
}
`;
    const response = await callGeminiWithRetry({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2
      }
    });
    const parsed = JSON.parse(response.text || "{}");
    if (parsed && parsed.content && parsed.content.length > 50) {
      return {
        title: parsed.title || item.title,
        summary: parsed.summary || item.title,
        content: parsed.content,
        keyPoints: parsed.keyPoints || [`Kaynak: ${item.author}`]
      };
    }
  } catch (err) {
    const msg = (err?.message || String(err)).toLowerCase();
    if (!msg.includes("quota") && !msg.includes("503") && !msg.includes("429")) {
      console.warn(`[News Summary fallback notice for "${item.title}"]:`, err?.message || err);
    }
  }
  return null;
}
app.get("/api/news", async (req, res) => {
  try {
    const category = req.query.category || "T\xFCm\xFC";
    const lang = req.query.lang || "tr";
    const cacheKey = `${category}_${lang}`;
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
    const feedMap = {
      "Teknoloji": [
        "https://www.webtekno.com/rss.xml",
        "https://www.haberturk.com/rss/kategori/teknoloji.xml",
        "https://www.aa.com.tr/tr/rss/default?cat=bilim-teknoloji",
        "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=tr&gl=TR&ceid=TR:tr"
      ],
      "Ekonomi": [
        "https://www.haberturk.com/rss/kategori/ekonomi.xml",
        "https://www.aa.com.tr/tr/rss/default?cat=ekonomi",
        "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=tr&gl=TR&ceid=TR:tr"
      ],
      "Finans": [
        "https://www.haberturk.com/rss/kategori/ekonomi.xml",
        "https://www.aa.com.tr/tr/rss/default?cat=ekonomi",
        "https://news.google.com/rss/search?q=finans+borsa+piyasalar&hl=tr&gl=TR&ceid=TR:tr"
      ],
      "D\xFCnya": [
        "https://www.haberturk.com/rss/kategori/dunya.xml",
        "https://feeds.bbci.co.uk/turkce/rss.xml",
        "https://news.google.com/rss/headlines/section/topic/WORLD?hl=tr&gl=TR&ceid=TR:tr"
      ],
      "K\xFClt\xFCr & Sanat": [
        "https://www.haberturk.com/rss/kategori/kultur-sanat.xml",
        "https://www.aa.com.tr/tr/rss/default?cat=kultur",
        "https://news.google.com/rss/search?q=kultur+sanat+sinema+tiyatro&hl=tr&gl=TR&ceid=TR:tr"
      ],
      "Etik & Bilim": [
        "https://www.aa.com.tr/tr/rss/default?cat=bilim-teknoloji",
        "https://www.webtekno.com/rss.xml",
        "https://news.google.com/rss/search?q=bilim+uzay+fizik+tip&hl=tr&gl=TR&ceid=TR:tr"
      ],
      "S\xFCrd\xFCr\xFClebilirlik": [
        "https://www.aa.com.tr/tr/rss/default?cat=cevre",
        "https://www.haberturk.com/rss/kategori/ekonomi.xml",
        "https://news.google.com/rss/search?q=surdurulebilirlik+iklim+cevre&hl=tr&gl=TR&ceid=TR:tr"
      ],
      "Felsefe": [
        "https://feeds.bbci.co.uk/turkce/rss.xml",
        "https://www.webtekno.com/rss.xml",
        "https://news.google.com/rss/search?q=felsefe+dusunce+analiz&hl=tr&gl=TR&ceid=TR:tr"
      ],
      "G\xFCndem": [
        "https://www.aa.com.tr/tr/rss/default?cat=gundem",
        "https://www.haberturk.com/rss/manset.xml",
        "https://feeds.bbci.co.uk/turkce/rss.xml",
        "https://news.google.com/rss/headlines/section/topic/NATION?hl=tr&gl=TR&ceid=TR:tr"
      ],
      "Spor": [
        "https://www.aa.com.tr/tr/rss/default?cat=spor",
        "https://www.haberturk.com/rss/kategori/spor.xml",
        "https://news.google.com/rss/headlines/section/topic/SPORTS?hl=tr&gl=TR&ceid=TR:tr"
      ],
      "T\xFCm\xFC": [
        "https://www.aa.com.tr/tr/rss/default?cat=gundem",
        "https://www.haberturk.com/rss/manset.xml",
        "https://www.webtekno.com/rss.xml",
        "https://feeds.bbci.co.uk/turkce/rss.xml",
        "https://www.haberturk.com/rss/kategori/ekonomi.xml",
        "https://www.haberturk.com/rss/kategori/teknoloji.xml"
      ]
    };
    const targetUrls = feedMap[category] || feedMap["T\xFCm\xFC"];
    const cleanText = (str) => {
      if (!str) return "";
      let text = str.replace(/<!\[CDATA\[|\]\]>/g, "");
      for (let k = 0; k < 2; k++) {
        text = text.replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&amp;/gi, "&").replace(/&nbsp;/gi, " ");
      }
      text = text.replace(/<[^>]+>/g, "");
      text = text.replace(/https?:\/\/[^\s]+/gi, "");
      text = text.replace(/\b(a\s+href|href|target=|[a-z0-9_-]+\.html)\b[^\s]*/gi, "");
      return text.trim();
    };
    const feedPromises = targetUrls.map(async (url) => {
      try {
        const fetchRes = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/rss+xml, application/xml, text/xml, */*"
          }
        });
        if (!fetchRes.ok) return [];
        const xmlText = await fetchRes.text();
        const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/gi) || [];
        let publisherName = "Haber B\xFClteni";
        if (url.includes("webtekno")) publisherName = "Webtekno";
        else if (url.includes("haberturk")) publisherName = "Habert\xFCrk";
        else if (url.includes("bbc")) publisherName = "BBC T\xFCrk\xE7e";
        else if (url.includes("aa.com.tr")) publisherName = "Anadolu Ajans\u0131";
        const parsedItems = [];
        for (let i = 0; i < Math.min(itemMatches.length, 6); i++) {
          const itemStr = itemMatches[i];
          const titleMatch = itemStr.match(/<title>([\s\S]*?)<\/title>/i);
          const descMatch = itemStr.match(/<description>([\s\S]*?)<\/description>/i);
          const contentMatch = itemStr.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i);
          const authorMatch = itemStr.match(/<author>([\s\S]*?)<\/author>/i) || itemStr.match(/<dc:creator>([\s\S]*?)<\/dc:creator>/i);
          const sourceMatch = itemStr.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
          const linkMatch = itemStr.match(/<link>([\s\S]*?)<\/link>/i);
          let extractedImg = "";
          const mediaContent = itemStr.match(/<media:content[^>]+url=["']([^"']+)["']/i);
          const mediaThumb = itemStr.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
          const enclosure = itemStr.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
          const imageTag = itemStr.match(/<image>([\s\S]*?)<\/image>/i);
          const imgTagMatch = itemStr.match(/<img[^>]+src=["']([^"']+)["']/i);
          if (mediaContent) extractedImg = mediaContent[1];
          else if (mediaThumb) extractedImg = mediaThumb[1];
          else if (enclosure) extractedImg = enclosure[1];
          else if (imageTag && imageTag[1].startsWith("http")) extractedImg = imageTag[1].trim();
          else if (imgTagMatch) extractedImg = imgTagMatch[1];
          let rawTitle = titleMatch ? cleanText(titleMatch[1]) : "";
          let author = authorMatch ? cleanText(authorMatch[1]) : publisherName;
          let sourcePublisher = sourceMatch ? cleanText(sourceMatch[1]) : "";
          if (sourcePublisher) {
            author = sourcePublisher;
          }
          if (author.includes("@") || author.includes("\n") || author.includes("http")) {
            if (url.includes("webtekno")) author = "Webtekno";
            else if (url.includes("haberturk")) author = "Habert\xFCrk";
            else if (url.includes("bbc")) author = "BBC T\xFCrk\xE7e";
            else if (url.includes("aa.com.tr")) author = "Anadolu Ajans\u0131";
            else {
              author = author.replace(/\([^)]*\)/g, "").replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "").replace(/\s+/g, " ").trim();
              if (!author) author = publisherName;
            }
          }
          let title = rawTitle;
          if (author && title.endsWith(" - " + author)) {
            title = title.substring(0, title.length - (author.length + 3)).trim();
          } else if (title.includes(" - ")) {
            const parts = title.split(" - ");
            if (parts.length > 1 && parts[parts.length - 1].length < 30) {
              const possibleAuthor = parts.pop().trim();
              if (!author || author === "Haber B\xFClteni" || author === "Google Haberler") {
                author = possibleAuthor;
              }
              title = parts.join(" - ").trim();
            }
          }
          let summary = descMatch ? cleanText(descMatch[1]) : "";
          let fullContent = contentMatch ? cleanText(contentMatch[1]) : "";
          const sourceUrl = linkMatch ? linkMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
          if (title && title.length > 4) {
            let itemCategory = "G\xFCndem";
            if (url.includes("webtekno") || url.includes("teknoloji") || url.includes("bilim-teknoloji")) {
              itemCategory = "Teknoloji";
            } else if (url.includes("ekonomi") || url.includes("BUSINESS")) {
              itemCategory = "Ekonomi";
            } else if (url.includes("dunya") || url.includes("WORLD") || url.includes("bbc")) {
              itemCategory = "D\xFCnya";
            } else if (url.includes("kultur-sanat") || url.includes("kultur")) {
              itemCategory = "K\xFClt\xFCr & Sanat";
            } else if (url.includes("cevre") || url.includes("surdurulebilirlik")) {
              itemCategory = "S\xFCrd\xFCr\xFClebilirlik";
            } else if (url.includes("SPORTS") || url.includes("spor")) {
              itemCategory = "Spor";
            } else if (category && category !== "T\xFCm\xFC" && !category.includes(" ")) {
              itemCategory = category;
            }
            parsedItems.push({
              title,
              rawSummary: summary,
              rawContent: fullContent,
              category: itemCategory,
              author: author || publisherName,
              imageUrl: extractedImg,
              sourceType: "rss",
              sourceUrl
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
    const seenTitles = /* @__PURE__ */ new Set();
    const uniqueRawArticles = [];
    rawArticles.forEach((item) => {
      const titleLower = item.title.toLowerCase();
      if (!seenTitles.has(titleLower)) {
        seenTitles.add(titleLower);
        uniqueRawArticles.push(item);
      }
    });
    const processedArticles = [];
    let aiQuotaAvailable = true;
    for (let i = 0; i < Math.min(uniqueRawArticles.length, 10); i++) {
      const item = uniqueRawArticles[i];
      let finalImg = item.imageUrl || "";
      let articleText = [item.title, item.rawSummary, item.rawContent].filter(Boolean).join("\n\n");
      if ((!finalImg || articleText.length < 200) && item.sourceUrl && item.sourceUrl.startsWith("http")) {
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
          imageUrl: finalImg || "",
          sourceType: "rss",
          sourceUrl: item.sourceUrl,
          durationSeconds: Math.max(120, Math.min(360, summarizedResult.content.split(" ").length * 2)),
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          keyPoints: summarizedResult.keyPoints
        });
      } else {
        const sentences = articleText.replace(/<[^>]+>/g, "").split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter((s) => s.length > 20 && !s.includes("http") && !s.includes("undefined"));
        const uniqueSentences = Array.from(new Set(sentences));
        const limitedSentences = uniqueSentences.slice(0, 6);
        let finalContent = "";
        if (limitedSentences.length > 0) {
          finalContent = `${item.author} taraf\u0131ndan aktar\u0131lan bilgilere g\xF6re, ${limitedSentences.join(" ")}`;
        } else {
          finalContent = `${item.author} taraf\u0131ndan payla\u015F\u0131lan son geli\u015Fmelere g\xF6re, ${item.title}. Konuya ili\u015Fkin geli\u015Fmeler ve ayr\u0131nt\u0131lar takip ediliyor.`;
        }
        const finalSummary = item.rawSummary && item.rawSummary.length > 20 ? item.rawSummary : `${item.title} hakk\u0131nda ${item.author} kayna\u011F\u0131ndan edinilen son geli\u015Fmeler.`;
        processedArticles.push({
          id: `news_${category.toLowerCase()}_${i}_${Date.now()}`,
          title: item.title,
          summary: finalSummary,
          content: finalContent,
          category: item.category,
          author: item.author,
          imageUrl: finalImg || "",
          sourceType: "rss",
          sourceUrl: item.sourceUrl,
          durationSeconds: Math.max(120, Math.min(300, finalContent.split(" ").length * 2)),
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          keyPoints: [
            item.title,
            "Geli\u015Fmelerin ayr\u0131nt\u0131lar\u0131",
            `Kaynak: ${item.author}`
          ]
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
  } catch (err) {
    console.error("News feed error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/rss-fetch", async (req, res) => {
  try {
    const feedUrl = req.query.url;
    if (!feedUrl) {
      return res.status(400).json({ success: false, error: "url parameter required" });
    }
    const fetchRes = await fetch(feedUrl);
    const xmlText = await fetchRes.text();
    const prompt = `
Extract up to 5 latest articles from this RSS XML feed.
Respond ONLY with valid JSON array:
[
  {
    "title": "Article Title",
    "summary": "Short snippet or description",
    "sourceUrl": "Link to original",
    "author": "Feed Publisher Name",
    "createdAt": "${(/* @__PURE__ */ new Date()).toISOString()}"
  }
]
XML:
${xmlText.substring(0, 15e3)}
`;
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const items = JSON.parse(response.text || "[]");
    res.json({ success: true, items });
  } catch (err) {
    console.error("RSS fetch error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});
app.all("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "API_NOT_FOUND",
    message: `\u0130stenen API adresi (${req.method} ${req.path}) bulunamad\u0131.`
  });
});
app.use((err, req, res, _next) => {
  console.error("[Global Error Handler]:", err);
  if (res.headersSent) {
    return _next(err);
  }
  const statusCode = typeof err?.status === "number" ? err.status : typeof err?.statusCode === "number" ? err.statusCode : 500;
  res.status(statusCode).json({
    success: false,
    error: err?.code || "SERVER_ERROR",
    message: err?.message || "Sunucu hatas\u0131 olu\u015Ftu. L\xFCtfen tekrar deneyin."
  });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`VOX Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
