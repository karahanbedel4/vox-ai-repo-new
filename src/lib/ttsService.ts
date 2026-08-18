import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Article } from '../types';
import { appStorage, isCapacitorNative } from './storage';
import { recordListeningTime } from './streakService';
import { getApiUrl } from './api';

export interface ChunkMeta {
  index: number;
  text: string;
  wordCount: number;
  startWordIndex: number;
  startTime: number;
  endTime: number;
}

export interface ResumePosition {
  articleId: string;
  articleTitle?: string;
  currentTime: number;
  duration: number;
  updatedAt: number;
  languageMode?: 'tr' | 'en';
}

export interface PlaybackState {
  isPlaying: boolean;
  isLoadingAudio?: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  currentWordIndex: number;
  currentArticle: Article | null;
  chunkMetas: ChunkMeta[];
  currentChunkIndex: number;
  languageMode: 'tr' | 'en';
  isMiniPlayerDismissed?: boolean;
  playbackError?: string | null;
}

type PlaybackListener = (state: PlaybackState) => void;

export class TTSService {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private preloadedAudioMap: Map<string, HTMLAudioElement> = new Map();
  private article: Article | null = null;
  
  private isPlaying: boolean = false;
  private isLoadingAudio: boolean = false;
  private playbackRate: number = 1.25;
  private currentTime: number = 0;
  private duration: number = 0;
  private currentWordIndex: number = 0;
  private playbackError: string | null = null;
  
  private words: string[] = [];
  private chunkMetas: ChunkMeta[] = [];
  private currentChunkIndex: number = 0;
  private languageMode: 'tr' | 'en' = 'tr';
  private userId: string | null = null;
  private isMiniPlayerDismissed: boolean = false;
  private listeners: Set<PlaybackListener> = new Set();
  private isAudioMode: boolean = true; // true: HTMLAudioElement stream, false: Web Speech API

  public setUserId(uid: string | null) {
    this.userId = uid;
  }

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioElement = new Audio();
      this.audioElement.preload = 'auto';

      if ('speechSynthesis' in window) {
        this.synth = window.speechSynthesis;
        if (this.synth.onvoiceschanged !== undefined) {
          this.synth.onvoiceschanged = () => {
            this.synth?.getVoices();
          };
        }
      }

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (this.isPlaying) {
            // Keep playing or record state
            this.savePlaybackPosition();
          }
        }
      });

      window.addEventListener('beforeunload', () => {
        this.savePlaybackPosition();
      });
    }
  }

  private preloadChunkAudio(chunkIndex: number) {
    if (!this.article || chunkIndex < 0 || chunkIndex >= this.chunkMetas.length) return;
    const chunk = this.chunkMetas[chunkIndex];
    if (!chunk || !chunk.text) return;

    const targetLang = this.detectLanguage(chunk.text || (this.article.title + ' ' + this.article.summary));
    const langParam = this.languageMode === 'en' ? 'en' : (targetLang === 'en-US' ? 'en' : 'tr');
    const url = getApiUrl(`/api/tts?text=${encodeURIComponent(chunk.text)}&lang=${langParam}`);

    if (!this.preloadedAudioMap.has(url)) {
      const audio = new Audio(url);
      audio.preload = 'auto';
      this.preloadedAudioMap.set(url, audio);
    }
  }

  public savePlaybackPosition() {
    if (this.article && this.currentTime > 3 && this.duration > 0 && (this.duration - this.currentTime) > 5) {
      const data: ResumePosition = {
        articleId: this.article.id,
        articleTitle: this.article.title,
        currentTime: Math.floor(this.currentTime),
        duration: Math.floor(this.duration),
        updatedAt: Date.now(),
        languageMode: this.languageMode
      };
      appStorage.setItem('vox_resume_position', JSON.stringify(data));
    } else if (this.article && (this.duration - this.currentTime) <= 5) {
      this.clearSavedPosition();
    }
  }

  public clearSavedPosition() {
    appStorage.removeItem('vox_resume_position');
  }

  public subscribe(listener: PlaybackListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach(fn => fn(state));
  }

  public getState(): PlaybackState {
    return {
      isPlaying: this.isPlaying,
      isLoadingAudio: this.isLoadingAudio,
      currentTime: this.currentTime,
      duration: this.duration,
      playbackRate: this.playbackRate,
      currentWordIndex: this.currentWordIndex,
      currentArticle: this.article,
      chunkMetas: this.chunkMetas,
      currentChunkIndex: this.currentChunkIndex,
      languageMode: this.languageMode,
      isMiniPlayerDismissed: this.isMiniPlayerDismissed,
      playbackError: this.playbackError
    };
  }

  public setLanguageMode(langMode: 'tr' | 'en') {
    if (this.languageMode === langMode && this.article) return;
    this.languageMode = langMode;
    if (this.article) {
      const wasPlaying = this.isPlaying;
      const currentPosRatio = this.duration > 0 ? this.currentTime / this.duration : 0;
      this.loadArticle(this.article, langMode);
      if (currentPosRatio > 0 && this.duration > 0) {
        this.seek(currentPosRatio * this.duration);
      }
      if (wasPlaying) {
        this.play();
      }
    }
  }

  private detectLanguage(text: string): 'tr-TR' | 'en-US' {
    if (this.languageMode === 'en') return 'en-US';
    if (this.languageMode === 'tr') return 'tr-TR';
    if (!text) return 'tr-TR';
    if (/[çğışöüÇĞİŞÖÜ]/.test(text)) return 'tr-TR';

    const trWords = ['ve', 'bir', 'bu', 'da', 'de', 'için', 'ile', 'gibi', 'ama', 'çok', 'ne', 'en', 'o', 'daha', 'bülten', 'haber', 'özet', 'yeni', 'göre', 'sonra', 'olarak', 'olan', 'var', 'yok', 'ki', 'her', 'tüm', 'veya', 'kadar'];
    const enWords = ['the', 'and', 'is', 'in', 'to', 'of', 'that', 'you', 'it', 'he', 'was', 'for', 'on', 'are', 'as', 'with', 'his', 'they', 'at', 'be', 'this', 'from', 'or', 'by', 'an', 'not', 'we', 'can', 'has', 'about'];

    const words = text.toLowerCase().split(/\s+/);
    let trCount = 0;
    let enCount = 0;

    for (const w of words) {
      const clean = w.replace(/[^a-zçğışöü]/g, '');
      if (trWords.includes(clean)) trCount++;
      if (enWords.includes(clean)) enCount++;
    }

    if (enCount > trCount && enCount >= 2) return 'en-US';
    return 'tr-TR';
  }

  private getBestVoiceForLang(langCode: 'tr-TR' | 'en-US'): SpeechSynthesisVoice | null {
    if (!this.synth) return null;
    const voices = this.synth.getVoices();
    if (!voices || voices.length === 0) return null;

    const isTr = langCode === 'tr-TR';

    if (isTr) {
      const siriOrNatural = voices.find(v => 
        v.lang.toLowerCase().startsWith('tr') && 
        (v.name.includes('Siri') || v.name.includes('Yelda') || v.name.includes('Cem') || v.name.includes('Enhanced') || v.name.includes('Natural'))
      );
      if (siriOrNatural) return siriOrNatural;

      const googleVoice = voices.find(v => 
        v.lang.toLowerCase().startsWith('tr') && 
        (v.name.includes('Google') || v.name.includes('Türkçe') || v.name.includes('Turkish'))
      );
      if (googleVoice) return googleVoice;

      const anyTrVoice = voices.find(v => v.lang.toLowerCase().startsWith('tr') || v.lang.toLowerCase().includes('tr'));
      if (anyTrVoice) return anyTrVoice;

      return null;
    } else {
      const premiumEn = voices.find(v => 
        v.lang.toLowerCase().startsWith('en') && 
        (v.name.includes('Siri') || v.name.includes('Natural') || v.name.includes('Enhanced') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Google'))
      );
      if (premiumEn) return premiumEn;

      const anyEn = voices.find(v => v.lang.toLowerCase().startsWith('en'));
      if (anyEn) return anyEn;

      return null;
    }
  }

  public loadArticle(article: Article, langMode: 'tr' | 'en' = this.languageMode) {
    this.stop();
    this.article = article;
    this.languageMode = langMode;
    this.isMiniPlayerDismissed = false;
    this.playbackError = null;
    this.preloadedAudioMap.clear();

    const useEnglish = langMode === 'en' && Boolean(article.englishContent || article.englishTitle);
    const title = (useEnglish ? (article.englishTitle || article.title) : article.title) || '';
    const summary = (useEnglish ? (article.englishSummary || article.summary) : article.summary) || '';
    const content = (useEnglish ? (article.englishContent || article.content) : article.content) || '';

    // Smart deduplication: avoid repeating identical title & summary
    let textParts = [title];
    if (summary && !title.includes(summary.substring(0, 30)) && !content.includes(summary.substring(0, 30))) {
      textParts.push(summary);
    }
    if (content && !summary.includes(content.substring(0, 30)) && !title.includes(content.substring(0, 30))) {
      textParts.push(content);
    }

    const rawTextToSpeak = textParts.join('. ');
    const cleanTextToSpeak = rawTextToSpeak
      .replace(/\[[^\]]*\]/g, '') // Remove bracketed directions
      .replace(/\([^\)]*\)/g, '') // Remove parentheticals
      .replace(/[#*_~`]+/g, '')   // Remove markdown tags
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    this.words = cleanTextToSpeak.split(/\s+/).filter(w => w.length > 0);

    // Protect abbreviations so periods inside them don't split sentences
    const protectedText = cleanTextToSpeak
      .replace(/\b(Dr|Prof|Doç|Yrd|Av|Uz|St|Mr|Mrs|Ms|Inc|Ltd|vs|vb|bkz|ör|örneğin|sf|cad|sok|apt|Hz)\./gi, "$1__DOT__")
      .replace(/\b(\d+)\.(\d+)\b/g, "$1__DECIMAL__$2");

    // Split on sentence punctuation (. ? ! ; :)
    const candidateSentences = protectedText
      .replace(/([.?!;:])\s+/g, "$1|")
      .split("|")
      .map(s => s.replace(/__DOT__/g, '.').replace(/__DECIMAL__/g, '.').trim())
      .filter(s => s.length > 0);

    // Merge short fragments (< 25 chars or < 4 words)
    const rawSentences: string[] = [];
    for (let i = 0; i < candidateSentences.length; i++) {
      let current = candidateSentences[i];
      let wordCount = current.split(/\s+/).filter(w => w.length > 0).length;

      while (i < candidateSentences.length - 1 && (current.length < 25 || wordCount < 4)) {
        i++;
        current = current + ' ' + candidateSentences[i];
        wordCount = current.split(/\s+/).filter(w => w.length > 0).length;
      }
      rawSentences.push(current);
    }

    const totalWords = this.words.length || 1;
    // Calculate realistic natural duration (~140 words per minute => ~0.43s per word)
    const naturalDuration = Math.max(12, Math.round(totalWords * 0.45));
    // If article durationSeconds is within realistic range, use it; otherwise use naturalDuration
    this.duration = (article.durationSeconds && article.durationSeconds > 0 && Math.abs(article.durationSeconds - naturalDuration) < naturalDuration * 2)
      ? article.durationSeconds
      : naturalDuration;

    let accWords = 0;
    this.chunkMetas = rawSentences.map((text, idx) => {
      const wCount = text.split(/\s+/).filter(w => w.length > 0).length;
      const startWordIndex = accWords;
      const startTime = (accWords / totalWords) * this.duration;
      const endTime = Math.min(this.duration, ((accWords + wCount) / totalWords) * this.duration);
      accWords += wCount;

      return {
        index: idx,
        text,
        wordCount: wCount,
        startWordIndex,
        startTime,
        endTime
      };
    });

    this.currentTime = 0;
    this.currentWordIndex = 0;
    this.currentChunkIndex = 0;
    this.isPlaying = false;
    this.isLoadingAudio = false;
    this.notify();

    // Warm up audio buffer for instant zero-latency start
    this.preloadChunkAudio(0);
    this.preloadChunkAudio(1);

    if (this.synth) {
      this.synth.getVoices();
    }

    this.setupMediaSession(article);
  }

  public play() {
    if (!this.article || this.chunkMetas.length === 0) return;
    this.isMiniPlayerDismissed = false;
    this.playbackError = null;

    if (isCapacitorNative()) {
      this.playCapacitorSentenceSpeech();
      return;
    }

    // Start playback using primary High-Quality Audio Stream
    this.isAudioMode = true;
    this.playCurrentChunkAudio();

    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'playing';
    }
  }

  private playCurrentChunkAudio() {
    if (!this.article || this.chunkMetas.length === 0) return;

    if (this.currentChunkIndex < 0 || this.currentChunkIndex >= this.chunkMetas.length) {
      this.currentChunkIndex = 0;
    }

    const currentChunk = this.chunkMetas[this.currentChunkIndex];
    if (!currentChunk || !currentChunk.text) {
      this.pause();
      return;
    }

    const targetLang = this.detectLanguage(currentChunk.text || (this.article.title + ' ' + this.article.summary));
    const langParam = this.languageMode === 'en' ? 'en' : (targetLang === 'en-US' ? 'en' : 'tr');
    const audioUrl = getApiUrl(`/api/tts?text=${encodeURIComponent(currentChunk.text)}&lang=${langParam}`);

    if (!this.audioElement) {
      this.audioElement = new Audio();
    }

    this.isLoadingAudio = true;
    this.isPlaying = true;
    this.currentTime = Math.max(this.currentTime, currentChunk.startTime);
    this.currentWordIndex = currentChunk.startWordIndex;
    this.notify();

    // Setup event handlers on dedicated audio element
    this.audioElement.src = audioUrl;
    this.audioElement.playbackRate = this.playbackRate;

    this.audioElement.onplaying = () => {
      this.isLoadingAudio = false;
      this.isPlaying = true;
      this.notify();
      // Preload next chunk
      this.preloadChunkAudio(this.currentChunkIndex + 1);
    };

    this.audioElement.ontimeupdate = () => {
      if (!this.isPlaying || !this.audioElement) return;
      const chunkDuration = (currentChunk.endTime - currentChunk.startTime) || 3;
      const audioDuration = this.audioElement.duration && isFinite(this.audioElement.duration) && this.audioElement.duration > 0
        ? this.audioElement.duration
        : chunkDuration;
      
      const chunkProgress = Math.min(1, Math.max(0, this.audioElement.currentTime / audioDuration));
      this.currentTime = Math.min(this.duration, currentChunk.startTime + chunkProgress * (currentChunk.endTime - currentChunk.startTime));
      
      // Calculate active word index
      const wordsInChunk = currentChunk.wordCount || 1;
      const currentWordInChunk = Math.floor(chunkProgress * wordsInChunk);
      this.currentWordIndex = Math.min(this.words.length - 1, currentChunk.startWordIndex + currentWordInChunk);

      // Streak & focus update
      try {
        recordListeningTime(this.userId || '', 0.25).catch(() => {});
      } catch {}

      this.notify();
    };

    this.audioElement.onended = () => {
      this.currentChunkIndex++;
      if (this.currentChunkIndex < this.chunkMetas.length) {
        this.playCurrentChunkAudio();
      } else {
        this.isPlaying = false;
        this.isLoadingAudio = false;
        this.currentTime = this.duration;
        this.notify();
        this.savePlaybackPosition();
      }
    };

    this.audioElement.onerror = (err) => {
      console.warn('Audio stream error, switching to Web Speech fallback:', err);
      this.isLoadingAudio = false;
      this.isAudioMode = false;
      this.playNativeSentenceSpeech();
    };

    const playPromise = this.audioElement.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        this.isLoadingAudio = false;
        this.isPlaying = true;
        this.notify();
      }).catch((playErr) => {
        console.warn('Audio play was prevented or failed, trying Web Speech API:', playErr);
        this.isAudioMode = false;
        this.playNativeSentenceSpeech();
      });
    }
  }

  private playNativeSentenceSpeech() {
    if (!this.synth || !this.article || this.chunkMetas.length === 0) {
      this.isPlaying = false;
      this.notify();
      return;
    }

    this.synth.cancel();

    if (this.currentChunkIndex < 0 || this.currentChunkIndex >= this.chunkMetas.length) {
      this.currentChunkIndex = 0;
    }

    const currentChunk = this.chunkMetas[this.currentChunkIndex];
    if (!currentChunk) return;

    const targetLang = this.detectLanguage(currentChunk.text || (this.article.title + ' ' + this.article.summary));
    const bestVoice = this.getBestVoiceForLang(targetLang);

    const utterance = new SpeechSynthesisUtterance(currentChunk.text);
    utterance.lang = targetLang;
    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    utterance.rate = Math.min(2.0, Math.max(0.5, this.playbackRate));
    utterance.pitch = 1.0;

    this.currentTime = Math.max(this.currentTime, currentChunk.startTime);
    this.currentWordIndex = currentChunk.startWordIndex;
    this.isPlaying = true;
    this.notify();

    utterance.onstart = () => {
      this.isPlaying = true;
      this.notify();
    };

    utterance.onboundary = (e) => {
      if (e.name === 'word') {
        const textPassed = currentChunk.text.substring(0, e.charIndex);
        const wordsPassed = textPassed.split(/\s+/).filter(w => w.length > 0).length;
        this.currentWordIndex = Math.min(this.words.length - 1, currentChunk.startWordIndex + wordsPassed);
        const progress = currentChunk.text.length > 0 ? e.charIndex / currentChunk.text.length : 0;
        this.currentTime = Math.min(this.duration, currentChunk.startTime + progress * (currentChunk.endTime - currentChunk.startTime));
        this.notify();
      }
    };

    utterance.onend = () => {
      if (!this.isPlaying) return;
      this.currentChunkIndex++;
      if (this.currentChunkIndex < this.chunkMetas.length) {
        this.playNativeSentenceSpeech();
      } else {
        this.isPlaying = false;
        this.currentTime = this.duration;
        this.notify();
        this.savePlaybackPosition();
      }
    };

    utterance.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      console.warn('SpeechSynthesis error:', e);
      this.currentChunkIndex++;
      if (this.currentChunkIndex < this.chunkMetas.length && this.isPlaying) {
        this.playNativeSentenceSpeech();
      } else {
        this.isPlaying = false;
        this.notify();
      }
    };

    this.currentUtterance = utterance;
    try {
      this.synth.speak(utterance);
    } catch (err) {
      console.error('SpeechSynthesis.speak failed:', err);
      this.isPlaying = false;
      this.notify();
    }
  }

  private async playCapacitorSentenceSpeech() {
    if (!this.article || this.chunkMetas.length === 0) return;

    if (this.currentChunkIndex < 0 || this.currentChunkIndex >= this.chunkMetas.length) {
      this.currentChunkIndex = 0;
    }

    const currentChunk = this.chunkMetas[this.currentChunkIndex];
    const targetLang = this.detectLanguage(currentChunk.text || (this.article.title + ' ' + this.article.summary));

    this.currentTime = Math.max(this.currentTime, currentChunk.startTime);
    this.currentWordIndex = currentChunk.startWordIndex;
    this.isPlaying = true;
    this.notify();

    try {
      await TextToSpeech.stop().catch(() => {});
      await TextToSpeech.speak({
        text: currentChunk.text,
        lang: targetLang,
        rate: Math.min(2.0, Math.max(0.5, this.playbackRate)),
        pitch: 1.0,
      });

      if (!this.isPlaying) return;
      this.currentChunkIndex++;
      if (this.currentChunkIndex < this.chunkMetas.length) {
        this.playCapacitorSentenceSpeech();
      } else {
        this.isPlaying = false;
        this.currentTime = this.duration;
        this.notify();
      }
    } catch (err) {
      console.warn('Capacitor TextToSpeech error, falling back to audio stream:', err);
      this.playCurrentChunkAudio();
    }
  }

  public pause() {
    try {
      TextToSpeech.stop().catch(() => {});
    } catch {}

    if (this.audioElement) {
      this.audioElement.pause();
    }
    if (this.synth) {
      this.synth.cancel();
    }
    this.isPlaying = false;
    this.isLoadingAudio = false;
    this.savePlaybackPosition();
    this.notify();

    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
    }
  }

  public stop() {
    try {
      TextToSpeech.stop().catch(() => {});
    } catch {}

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
    }
    if (this.synth) {
      this.synth.cancel();
    }
    this.isPlaying = false;
    this.isLoadingAudio = false;
    this.savePlaybackPosition();
    this.currentTime = 0;
    this.currentWordIndex = 0;
    this.currentChunkIndex = 0;
    this.notify();
  }

  public closePlayer() {
    this.pause();
    this.isMiniPlayerDismissed = true;
    this.notify();
  }

  public seek(seconds: number) {
    if (!this.article) return;
    const targetTime = Math.max(0, Math.min(this.duration, seconds));
    this.currentTime = targetTime;
    this.savePlaybackPosition();

    try {
      TextToSpeech.stop().catch(() => {});
    } catch {}

    if (this.audioElement) {
      this.audioElement.pause();
    }
    if (this.synth) {
      this.synth.cancel();
    }

    // Find sentence chunk matching target time
    if (this.chunkMetas.length > 0) {
      let targetIndex = 0;
      for (let i = 0; i < this.chunkMetas.length; i++) {
        if (targetTime >= this.chunkMetas[i].startTime) {
          targetIndex = i;
        }
      }
      this.currentChunkIndex = targetIndex;
      this.currentWordIndex = this.chunkMetas[targetIndex].startWordIndex;
    }

    if (this.isPlaying) {
      if (this.isAudioMode) {
        this.playCurrentChunkAudio();
      } else {
        this.playNativeSentenceSpeech();
      }
    } else {
      this.notify();
    }
  }

  public setRate(rate: number) {
    this.playbackRate = rate;
    if (this.audioElement) {
      this.audioElement.playbackRate = rate;
    }
    if (this.isPlaying) {
      if (this.isAudioMode) {
        // Continue playing at new rate
      } else {
        this.playNativeSentenceSpeech();
      }
    }
    this.notify();
  }

  private setupMediaSession(article: Article) {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      const useEnglish = this.languageMode === 'en' && Boolean(article.englishContent || article.englishTitle);
      const displayTitle = useEnglish ? (article.englishTitle || article.title) : article.title;

      navigator.mediaSession.metadata = new MediaMetadata({
        title: displayTitle,
        artist: article.author || 'VOX AI Studio Podcast',
        album: 'VOX Sesli Haber Bültenleri',
        artwork: [
          { src: article.imageUrl || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&auto=format&fit=crop&q=80', sizes: '512x512', type: 'image/jpeg' }
        ]
      });

      try {
        navigator.mediaSession.setActionHandler('play', () => this.play());
        navigator.mediaSession.setActionHandler('pause', () => this.pause());
        navigator.mediaSession.setActionHandler('seekbackward', () => this.seek(this.currentTime - 10));
        navigator.mediaSession.setActionHandler('seekforward', () => this.seek(this.currentTime + 10));
        navigator.mediaSession.setActionHandler('previoustrack', () => this.seek(this.currentTime - 15));
        navigator.mediaSession.setActionHandler('nexttrack', () => this.seek(this.currentTime + 15));
      } catch {}
    }
  }
}

export const ttsService = new TTSService();
