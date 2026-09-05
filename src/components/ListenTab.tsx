import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Volume2, 
  VolumeX,
  Sparkles, 
  CloudRain, 
  Music, 
  Film,
  Repeat, 
  Repeat1,
  ChevronUp, 
  ChevronDown, 
  X, 
  Languages, 
  Loader2, 
  AlertTriangle, 
  Youtube, 
  ArrowRight, 
  Bookmark,
  History,
  HardDrive,
  FileText,
  CheckCircle,
  Timer,
  Sliders,
  Radio,
  Headphones
} from 'lucide-react';
import { Article } from '../types';
import { PlaybackState } from '../lib/ttsService';
import { Haptics, ImpactStyle, triggerHapticImpact } from '../lib/haptics';
import { PomodoroModal } from './PomodoroModal';
import { safeApiFetch } from '../lib/api';
import { focusAudioService, FOCUS_TRACKS, FocusTrack } from '../lib/focusAudioService';
import { appStorage } from '../lib/storage';

interface ListenTabProps {
  playbackState: PlaybackState;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (seconds: number) => void;
  onSetRate: (rate: number) => void;
  isAmbientActive: boolean;
  activeAmbientName?: string;
  onToggleAmbient?: () => void;
  onStopAmbient?: () => void;
  onToggleLanguage?: (lang: 'tr' | 'en') => void;
  isTranslating?: boolean;
  onImportSuccess?: (article: Article) => void;
  articles?: Article[];
  bookmarkedIds?: string[];
  onPlayArticle?: (article: Article) => void;
  onToggleBookmark?: (articleId: string) => void;
}

export const ListenTab: React.FC<ListenTabProps> = ({
  playbackState,
  onPlay,
  onPause,
  onSeek,
  onSetRate,
  isAmbientActive,
  activeAmbientName,
  onToggleLanguage,
  isTranslating = false,
  onImportSuccess,
  articles = [],
  bookmarkedIds = [],
  onPlayArticle,
  onToggleBookmark
}) => {
  const { isPlaying: isArticlePlaying, currentTime, duration, playbackRate, currentArticle, chunkMetas, currentChunkIndex, languageMode } = playbackState;

  // View Mode: 'focus_music' (Spotify style soundtracks & ambient) vs 'article_podcast' (active TTS speech & live transcript)
  const [viewMode, setViewMode] = useState<'focus_music' | 'article_podcast'>(() => {
    return isArticlePlaying ? 'article_podcast' : 'focus_music';
  });

  // Library / Converted content filter
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'saved' | 'history' | 'local'>('all');

  // Focus Audio State
  const [focusState, setFocusState] = useState(() => focusAudioService.getState());
  const [isPomodoroOpen, setIsPomodoroOpen] = useState(false);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [expandedTranscript, setExpandedTranscript] = useState(false);
  const [ytUrlInput, setYtUrlInput] = useState('');
  const [isProcessingYt, setIsProcessingYt] = useState(false);
  const [isEnrichingPodcast, setIsEnrichingPodcast] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeSentenceRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to Focus Audio Player events
  useEffect(() => {
    const unsub = focusAudioService.subscribe(() => {
      setFocusState(focusAudioService.getState());
    });
    return unsub;
  }, []);

  // When an article starts playing, automatically provide access to the article player
  useEffect(() => {
    if (isArticlePlaying && currentArticle) {
      setViewMode('article_podcast');
    }
  }, [isArticlePlaying, currentArticle]);

  const triggerHaptic = () => {
    try {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    } catch {
      triggerHapticImpact('light');
    }
  };

  const handleTrackClick = (track: FocusTrack) => {
    triggerHaptic();
    if (focusState.currentTrack?.id === track.id) {
      focusAudioService.togglePlay();
    } else {
      focusAudioService.playTrack(track);
    }
  };

  const handleVolumeChange = (vol: number) => {
    focusAudioService.setVolume(vol);
  };

  // Convert quick RSS/news into rich AI Podcast
  const handleEnrichToPodcast = async () => {
    if (!currentArticle) return;
    setIsEnrichingPodcast(true);
    setErrorMessage(null);

    try {
      const promptPayload = {
        sourceType: 'web',
        rawText: `${currentArticle.title}. ${currentArticle.summary || ''}. ${currentArticle.content || ''}`,
        focusArea: currentArticle.category || 'Gündem',
        summaryLength: 'Normal',
        customTitle: currentArticle.title
      };

      const response = await safeApiFetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(promptPayload)
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let json: any = null;
      const rawText = await response.text();
      try {
        json = JSON.parse(rawText);
      } catch {}

      if (!response.ok || !json?.success || !json?.data) {
        throw new Error(json?.message || 'Yapay zeka bülteni zenginleştirilirken bir sorun oluştu.');
      }

      const enrichedArticle: Article = {
        ...currentArticle,
        id: 'vox_podcast_' + Date.now(),
        title: json.data.title || currentArticle.title,
        summary: json.data.summary || currentArticle.summary,
        content: json.data.content || currentArticle.content,
        category: json.data.category || currentArticle.category || 'Haber',
        durationSeconds: json.data.durationSeconds || 180,
        author: currentArticle.author || json.data.author || 'VOX Studio AI',
        keyPoints: json.data.keyPoints || currentArticle.keyPoints
      };

      if (onImportSuccess) {
        onImportSuccess(enrichedArticle);
      }
    } catch (err: unknown) {
      console.error('[ListenTab Enrich Podcast Error]:', err);
      setErrorMessage((err as Error)?.message || 'Podcaste dönüştürme sırasında bir hata oluştu.');
    } finally {
      setIsEnrichingPodcast(false);
    }
  };

  // YouTube URL processing
  const handleProcessYouTubeUrl = async () => {
    const targetUrl = ytUrlInput.trim();
    if (!targetUrl) {
      setErrorMessage('Lütfen geçerli bir YouTube video bağlantısı (URL) girin.');
      return;
    }

    setIsProcessingYt(true);
    setErrorMessage(null);

    try {
      const response = await safeApiFetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: 'youtube',
          url: targetUrl,
          summaryLength: 'normal'
        })
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let json: any = null;
      const rawText = await response.text();
      try {
        json = JSON.parse(rawText);
      } catch {}

      if (!response.ok || !json?.success || !json?.data) {
        const serverError = json?.message || json?.error || 'YouTube videosu işlenirken bir sorun oluştu.';
        throw new Error(serverError);
      }

      const videoIdMatch = targetUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
      const videoId = videoIdMatch ? videoIdMatch[1] : null;

      const newArticle: Article = {
        id: 'vox_yt_' + Date.now(),
        title: json.data.title || 'YouTube Sesli Bülten',
        summary: json.data.summary || 'YouTube video özet metni.',
        content: json.data.content || '',
        category: json.data.category || 'Teknoloji',
        sourceUrl: targetUrl,
        sourceType: 'youtube',
        durationSeconds: json.data.durationSeconds || 300,
        imageUrl: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : (json.data.imageUrl || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=600&auto=format&fit=crop&q=80'),
        createdAt: new Date().toISOString(),
        author: json.data.author || 'YouTube Yayıncısı',
        keyPoints: json.data.keyPoints
      };

      setYtUrlInput('');
      if (onImportSuccess) {
        onImportSuccess(newArticle);
      }
      setViewMode('article_podcast');
    } catch (err: unknown) {
      console.error('[ListenTab YouTube Error]:', err);
      setErrorMessage((err as Error)?.message || 'YouTube URL işlenirken bir hata oluştu.');
    } finally {
      setIsProcessingYt(false);
    }
  };

  // Local storage documents
  const localDocs = React.useMemo(() => {
    try {
      return JSON.parse(appStorage.getItemSync('vox_local_pdf_documents') || '[]');
    } catch {
      return [];
    }
  }, []);

  const savedArticles = articles.filter(a => bookmarkedIds.includes(a.id));
  const historyArticles = articles.slice(0, 5);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Sentences for transcript
  const sentences = chunkMetas && chunkMetas.length > 0 ? chunkMetas : [];
  let safeActiveIndex = currentChunkIndex || 0;
  if (sentences.length > 0) {
    const foundIdx = sentences.findIndex(
      s => currentTime >= s.startTime && currentTime <= s.endTime
    );
    if (foundIdx >= 0) {
      safeActiveIndex = foundIdx;
    } else if (currentTime >= (sentences[sentences.length - 1]?.endTime || 0)) {
      safeActiveIndex = sentences.length - 1;
    }
  }

  const isEnglish = languageMode === 'en';
  const displayTitle = currentArticle ? (isEnglish && currentArticle.englishTitle ? currentArticle.englishTitle : currentArticle.title) : '';
  const remainingTime = Math.max(0, duration - currentTime);
  const currentSentence = sentences[safeActiveIndex] || {
    text: currentArticle ? `${displayTitle}. ${currentArticle.summary}. ${currentArticle.content}` : ''
  };

  return (
    <div className="pt-16 sm:pt-20 pb-32 sm:pb-36 px-3.5 sm:px-4 max-w-md mx-auto space-y-4 sm:space-y-5 text-on-surface select-none">
      
      {/* View Switcher Bar if an article is loaded/playing */}
      {currentArticle && (
        <div className="flex items-center justify-center gap-1.5 p-1 bg-surface-container-high/90 border border-white/10 rounded-2xl shadow-sm">
          <button
            onClick={() => {
              triggerHaptic();
              setViewMode('focus_music');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all ${
              viewMode === 'focus_music'
                ? 'bg-emerald-500 text-black shadow-md'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Odak & Müzikler</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic();
              setViewMode('article_podcast');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all ${
              viewMode === 'article_podcast'
                ? 'bg-emerald-500 text-black shadow-md'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Haber & Podcast</span>
          </button>
        </div>
      )}

      {/* Error banner if any */}
      {errorMessage && (
        <div className="p-3 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-200 text-xs flex items-start gap-2.5 shadow-lg animate-fade-in">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-0.5 min-w-0">
            <span className="font-bold text-red-300 block">İşlem Hatası</span>
            <p className="text-[11px]">{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-white/60 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. FOCUS MUSIC & SOUNDTRACKS VIEW (EXACT SCREENSHOT REDESIGN)             */}
      {/* ========================================================================= */}
      {viewMode === 'focus_music' && (
        <div className="space-y-4 sm:space-y-5 animate-fade-in">
          
          {/* Header Title Section (Matches Screenshot) */}
          <div className="space-y-2">
            <div className="flex items-start gap-2.5 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-sm mt-0.5">
                <Headphones className="w-5 h-5" />
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <h1 className="font-display text-base sm:text-lg font-extrabold text-on-surface leading-tight truncate">
                  Odaklanma Müzikleri & Soundtracks
                </h1>
                <p className="text-[10px] sm:text-xs text-on-surface-variant leading-normal">
                  Dizi, film müzikleri ve doğa sesleri • Biri bitince diğeri başlar
                </p>
              </div>
            </div>

            {/* Top Action Pills: Loop, Sleep Timer, Pomodoro */}
            <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => {
                  triggerHaptic();
                  focusAudioService.setLooping(!focusState.isLooping);
                }}
                className={`px-2.5 py-1 sm:py-1.5 rounded-full border text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 shadow-sm shrink-0 ${
                  focusState.isLooping
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-surface-variant text-on-surface-variant border-card-border'
                }`}
              >
                <Repeat1 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Döngü: {focusState.isLooping ? 'Açık' : 'Kapalı'}</span>
              </button>

              <button
                onClick={() => {
                  triggerHaptic();
                  focusAudioService.setSequential(!focusState.isSequential);
                }}
                className={`px-2.5 py-1 sm:py-1.5 rounded-full border text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 shadow-sm shrink-0 ${
                  focusState.isSequential
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-surface-variant text-on-surface-variant border-card-border'
                }`}
              >
                <Repeat className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sıralı: {focusState.isSequential ? 'Açık' : 'Kapalı'}</span>
              </button>

              {/* Sleep Timer Selector */}
              <div className="relative shrink-0">
                <select
                  value={focusState.sleepTimerMinutes || ''}
                  onChange={(e) => {
                    triggerHaptic();
                    const val = e.target.value ? Number(e.target.value) : null;
                    focusAudioService.setSleepTimer(val);
                  }}
                  className={`px-2.5 py-1 sm:py-1.5 rounded-full border text-[11px] font-bold appearance-none bg-surface-variant text-on-surface-variant border-card-border cursor-pointer focus:outline-none focus:border-emerald-400 ${
                    focusState.sleepTimerMinutes ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : ''
                  }`}
                >
                  <option value="" className="bg-surface-container text-on-surface">Uyku Zamanlayıcı: Kapalı</option>
                  <option value="15" className="bg-surface-container text-on-surface">🌙 15 Dk Sonra Kapat</option>
                  <option value="30" className="bg-surface-container text-on-surface">🌙 30 Dk Sonra Kapat</option>
                  <option value="45" className="bg-surface-container text-on-surface">🌙 45 Dk Sonra Kapat</option>
                  <option value="60" className="bg-surface-container text-on-surface">🌙 60 Dk Sonra Kapat</option>
                </select>
              </div>

              <button
                onClick={() => {
                  triggerHaptic();
                  setIsPomodoroOpen(true);
                }}
                className="px-2.5 py-1 sm:py-1.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-all shadow-sm shrink-0"
              >
                <Timer className="w-3.5 h-3.5 text-amber-400" />
                <span>Pomodoro</span>
              </button>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* SECTION 1: DOĞA & ATMOSFER (Horizontal Scroll Album Cards)    */}
          {/* ------------------------------------------------------------- */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-display text-xs sm:text-sm font-bold text-on-surface">
                <CloudRain className="w-4 h-4 text-emerald-400" />
                <span>Doğa & Atmosfer</span>
              </div>
              <button
                onClick={() => {
                  triggerHaptic();
                  focusAudioService.playCategoryAll('nature');
                }}
                className="text-[10px] sm:text-[11px] font-bold text-black bg-emerald-400 hover:bg-emerald-300 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full flex items-center gap-1 shadow-sm active:scale-95 transition-all"
              >
                <span className="w-2.5 h-2.5 flex items-center justify-center gap-[1px]">
                  <span className="w-[1.5px] h-2 bg-black rounded-full animate-bounce" />
                  <span className="w-[1.5px] h-3 bg-black rounded-full animate-bounce [animation-delay:-0.15s]" />
                </span>
                <span>Oynatılıyor ({FOCUS_TRACKS.filter(t => t.category === 'nature').length})</span>
              </button>
            </div>

            {/* Horizontal Scroll Album Cards (Matches Screenshot) */}
            <div className="flex gap-2.5 sm:gap-3 overflow-x-auto pb-2 pt-0.5 scrollbar-none snap-x -mx-3.5 px-3.5 sm:-mx-4 sm:px-4">
              {FOCUS_TRACKS.filter(t => t.category === 'nature').map((track, idx) => {
                const isThisPlaying = focusState.currentTrack?.id === track.id && focusState.isPlaying;
                const isThisActive = focusState.currentTrack?.id === track.id;

                return (
                  <div 
                    key={track.id} 
                    className="flex-shrink-0 w-32 sm:w-36 space-y-1.5 snap-start group"
                  >
                    {/* Album Art Card */}
                    <div 
                      onClick={() => handleTrackClick(track)}
                      className={`relative aspect-square rounded-2xl overflow-hidden border transition-all duration-300 cursor-pointer shadow-md ${
                        isThisActive
                          ? 'border-emerald-400 ring-2 ring-emerald-400/40 shadow-emerald-500/20'
                          : 'border-card-border hover:border-emerald-400/40'
                      }`}
                    >
                      <img 
                        src={track.coverImage} 
                        alt={track.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />

                      {/* Top Badges: #1 on left, "Çalıyor" on right when active - NO MP3 BADGE AS REQUESTED */}
                      <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
                        <span className="bg-black/60 backdrop-blur-md text-white/90 font-mono font-black text-[9px] px-1.5 py-0.5 rounded-md border border-white/10">
                          #{idx + 1}
                        </span>

                        {isThisPlaying && (
                          <span className="bg-emerald-500 text-black font-extrabold text-[8px] px-1.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm animate-pulse">
                            <span className="w-1 h-1 rounded-full bg-black" />
                            Çalıyor
                          </span>
                        )}
                      </div>

                      {/* Center / Bottom Play Button Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all ${
                          isThisPlaying 
                            ? 'bg-emerald-500 text-black scale-100 shadow-lg' 
                            : 'bg-black/60 backdrop-blur-md text-white border border-white/20 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-black'
                        }`}>
                          {isThisPlaying ? (
                            <Pause className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-current ml-0.5" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Title & Subtitle */}
                    <div className="space-y-0.5">
                      <h3 className={`font-display text-[11px] sm:text-xs font-bold truncate leading-tight ${isThisActive ? 'text-emerald-400' : 'text-on-surface'}`}>
                        {track.title}
                      </h3>
                      <p className="text-[9px] sm:text-[10px] text-on-surface-variant truncate">
                        {track.subtitle}
                      </p>
                    </div>

                    {/* Volume Slider if this card is currently playing */}
                    {isThisActive && (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <Volume2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={focusState.volume}
                          onChange={(e) => handleVolumeChange(Number(e.target.value))}
                          className="w-full h-1 bg-white/15 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                        />
                        <span className="text-[8px] sm:text-[9px] font-mono text-emerald-400 shrink-0">
                          %{focusState.volume}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ------------------------------------------------------------- */}
          {/* SECTION 2: LO-FI & DERİN ODAKLANMA                           */}
          {/* ------------------------------------------------------------- */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-display text-xs sm:text-sm font-bold text-on-surface">
                <Music className="w-4 h-4 text-emerald-400" />
                <span>Lo-Fi & Derin Odaklanma</span>
              </div>
              <button
                onClick={() => {
                  triggerHaptic();
                  focusAudioService.playCategoryAll('lofi');
                }}
                className="text-[10px] sm:text-[11px] font-bold text-on-surface-variant hover:text-white bg-surface-variant hover:bg-card-border border border-card-border px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full flex items-center gap-1 shadow-sm active:scale-95 transition-all"
              >
                <Play className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-current" />
                <span>Tümünü Çal ({FOCUS_TRACKS.filter(t => t.category === 'lofi').length})</span>
              </button>
            </div>

            <div className="flex gap-2.5 sm:gap-3 overflow-x-auto pb-2 pt-0.5 scrollbar-none snap-x -mx-3.5 px-3.5 sm:-mx-4 sm:px-4">
              {FOCUS_TRACKS.filter(t => t.category === 'lofi').map((track, idx) => {
                const isThisPlaying = focusState.currentTrack?.id === track.id && focusState.isPlaying;
                const isThisActive = focusState.currentTrack?.id === track.id;

                return (
                  <div 
                    key={track.id} 
                    className="flex-shrink-0 w-32 sm:w-36 space-y-1.5 snap-start group"
                  >
                    <div 
                      onClick={() => handleTrackClick(track)}
                      className={`relative aspect-square rounded-2xl overflow-hidden border transition-all duration-300 cursor-pointer shadow-md ${
                        isThisActive
                          ? 'border-emerald-400 ring-2 ring-emerald-400/40 shadow-emerald-500/20'
                          : 'border-card-border hover:border-emerald-400/40'
                      }`}
                    >
                      <img 
                        src={track.coverImage} 
                        alt={track.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />

                      <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
                        <span className="bg-black/60 backdrop-blur-md text-white/90 font-mono font-black text-[9px] px-1.5 py-0.5 rounded-md border border-white/10">
                          #{idx + 1}
                        </span>

                        {isThisPlaying && (
                          <span className="bg-emerald-500 text-black font-extrabold text-[8px] px-1.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm animate-pulse">
                            <span className="w-1 h-1 rounded-full bg-black" />
                            Çalıyor
                          </span>
                        )}
                      </div>

                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all ${
                          isThisPlaying 
                            ? 'bg-emerald-500 text-black scale-100 shadow-lg' 
                            : 'bg-black/60 backdrop-blur-md text-white border border-white/20 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-black'
                        }`}>
                          {isThisPlaying ? (
                            <Pause className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-current ml-0.5" />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <h3 className={`font-display text-[11px] sm:text-xs font-bold truncate leading-tight ${isThisActive ? 'text-emerald-400' : 'text-on-surface'}`}>
                        {track.title}
                      </h3>
                      <p className="text-[9px] sm:text-[10px] text-on-surface-variant truncate">
                        {track.subtitle}
                      </p>
                    </div>

                    {isThisActive && (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <Volume2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={focusState.volume}
                          onChange={(e) => handleVolumeChange(Number(e.target.value))}
                          className="w-full h-1 bg-white/15 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                        />
                        <span className="text-[8px] sm:text-[9px] font-mono text-emerald-400 shrink-0">
                          %{focusState.volume}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ------------------------------------------------------------- */}
          {/* SECTION 3: EFSANE FİLM & SİNEMA MÜZİKLERİ                    */}
          {/* ------------------------------------------------------------- */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-display text-xs sm:text-sm font-bold text-on-surface">
                <Film className="w-4 h-4 text-emerald-400" />
                <span>Efsane Film & Sinema Müzikleri</span>
              </div>
              <button
                onClick={() => {
                  triggerHaptic();
                  focusAudioService.playCategoryAll('soundtracks');
                }}
                className="text-[10px] sm:text-[11px] font-bold text-on-surface-variant hover:text-white bg-surface-variant hover:bg-card-border border border-card-border px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full flex items-center gap-1 shadow-sm active:scale-95 transition-all"
              >
                <Play className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-current" />
                <span>Tümünü Çal ({FOCUS_TRACKS.filter(t => t.category === 'soundtracks').length})</span>
              </button>
            </div>

            <div className="flex gap-2.5 sm:gap-3 overflow-x-auto pb-2 pt-0.5 scrollbar-none snap-x -mx-3.5 px-3.5 sm:-mx-4 sm:px-4">
              {FOCUS_TRACKS.filter(t => t.category === 'soundtracks').map((track, idx) => {
                const isThisPlaying = focusState.currentTrack?.id === track.id && focusState.isPlaying;
                const isThisActive = focusState.currentTrack?.id === track.id;

                return (
                  <div 
                    key={track.id} 
                    className="flex-shrink-0 w-32 sm:w-36 space-y-1.5 snap-start group"
                  >
                    <div 
                      onClick={() => handleTrackClick(track)}
                      className={`relative aspect-square rounded-2xl overflow-hidden border transition-all duration-300 cursor-pointer shadow-md ${
                        isThisActive
                          ? 'border-emerald-400 ring-2 ring-emerald-400/40 shadow-emerald-500/20'
                          : 'border-card-border hover:border-emerald-400/40'
                      }`}
                    >
                      <img 
                        src={track.coverImage} 
                        alt={track.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />

                      <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
                        <span className="bg-black/60 backdrop-blur-md text-white/90 font-mono font-black text-[9px] px-1.5 py-0.5 rounded-md border border-white/10">
                          #{idx + 1}
                        </span>

                        {isThisPlaying && (
                          <span className="bg-emerald-500 text-black font-extrabold text-[8px] px-1.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm animate-pulse">
                            <span className="w-1 h-1 rounded-full bg-black" />
                            Çalıyor
                          </span>
                        )}
                      </div>

                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all ${
                          isThisPlaying 
                            ? 'bg-emerald-500 text-black scale-100 shadow-lg' 
                            : 'bg-black/60 backdrop-blur-md text-white border border-white/20 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-black'
                        }`}>
                          {isThisPlaying ? (
                            <Pause className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-current ml-0.5" />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <h3 className={`font-display text-[11px] sm:text-xs font-bold truncate leading-tight ${isThisActive ? 'text-emerald-400' : 'text-on-surface'}`}>
                        {track.title}
                      </h3>
                      <p className="text-[9px] sm:text-[10px] text-on-surface-variant truncate">
                        {track.subtitle}
                      </p>
                    </div>

                    {isThisActive && (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <Volume2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={focusState.volume}
                          onChange={(e) => handleVolumeChange(Number(e.target.value))}
                          className="w-full h-1 bg-white/15 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                        />
                        <span className="text-[8px] sm:text-[9px] font-mono text-emerald-400 shrink-0">
                          %{focusState.volume}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ------------------------------------------------------------- */}
          {/* SECTION 4: DÖNÜŞTÜRÜLEN İÇERİKLER & KİTAPLIĞIM (MERGED HUB)   */}
          {/* ------------------------------------------------------------- */}
          <section className="space-y-3 pt-2">
            <div className="space-y-1">
              <h2 className="font-display text-base font-bold flex items-center justify-between text-on-surface">
                <span>Kitaplığım & Geçmiş İçerikler</span>
                <span className="text-xs text-on-surface-variant font-normal">{articles.length} kayıt</span>
              </h2>
              <p className="text-xs text-on-surface-variant">
                Geçmişte dönüştürdüğünüz web makaleleri, YouTube özetleri ve kaydedilen bültenleriniz.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-pill-bg rounded-2xl border border-card-border">
              <button
                onClick={() => setLibraryFilter('all')}
                className={`py-1.5 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 transition-all ${
                  libraryFilter === 'all'
                    ? 'bg-emerald-500 text-black shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span>Tümü</span>
              </button>

              <button
                onClick={() => setLibraryFilter('saved')}
                className={`py-1.5 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 transition-all ${
                  libraryFilter === 'saved'
                    ? 'bg-emerald-500 text-black shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <Bookmark className="w-3 h-3" />
                <span>Favori</span>
              </button>

              <button
                onClick={() => setLibraryFilter('history')}
                className={`py-1.5 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 transition-all ${
                  libraryFilter === 'history'
                    ? 'bg-emerald-500 text-black shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <History className="w-3 h-3" />
                <span>Geçmiş</span>
              </button>

              <button
                onClick={() => setLibraryFilter('local')}
                className={`py-1.5 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 transition-all ${
                  libraryFilter === 'local'
                    ? 'bg-emerald-500 text-black shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <HardDrive className="w-3 h-3" />
                <span>Yerel</span>
              </button>
            </div>

            {/* Content List */}
            <div className="space-y-2.5">
              {(libraryFilter === 'saved' ? savedArticles : libraryFilter === 'history' ? historyArticles : articles).slice(0, 8).map((art) => {
                const isBookmarked = bookmarkedIds.includes(art.id);
                return (
                  <div
                    key={art.id}
                    className="bg-surface-container border border-card-border p-3 rounded-2xl flex items-center justify-between gap-3 hover:border-emerald-400/40 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <img
                        src={art.imageUrl || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=120&auto=format&fit=crop&q=80'}
                        alt={art.title}
                        className="w-12 h-12 rounded-xl object-cover shrink-0 border border-white/10"
                      />
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                            {art.category}
                          </span>
                          <span className="text-[9px] text-on-surface-variant font-mono">
                            • {Math.round(art.durationSeconds / 60)} dk
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-on-surface truncate mt-0.5">
                          {art.title}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onToggleBookmark && (
                        <button
                          onClick={() => onToggleBookmark(art.id)}
                          className="p-2 rounded-xl bg-surface-variant hover:bg-card-border text-on-surface-variant hover:text-emerald-400"
                          title="Favori"
                        >
                          <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-emerald-400 text-emerald-400' : ''}`} />
                        </button>
                      )}

                      {onPlayArticle && (
                        <button
                          onClick={() => {
                            triggerHaptic();
                            onPlayArticle(art);
                            setViewMode('article_podcast');
                          }}
                          className="w-8 h-8 rounded-full bg-emerald-500 text-black flex items-center justify-center active:scale-95 shadow-md transition-transform"
                          title="Dinle"
                        >
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {libraryFilter === 'local' && localDocs.map((doc: { id: string; name: string; sizeKb: number; text: string }) => (
                <div key={doc.id} className="bg-surface-container border border-card-border p-3 rounded-2xl flex items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div className="truncate">
                      <p className="text-xs font-bold truncate">{doc.name}</p>
                      <span className="text-[10px] text-on-surface-variant">{doc.sizeKb} KB • Yerel Bellek</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Quick YouTube Video Summarizer Input Card */}
          <div className="bg-surface-container border border-card-border rounded-2xl p-4 text-left space-y-3 shadow-md">
            <label className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
              <Youtube className="w-4 h-4 text-red-500" /> YouTube Videosunu Sesli Podcaste Çevir
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={ytUrlInput}
                onChange={(e) => setYtUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleProcessYouTubeUrl()}
                className="flex-1 bg-surface-container-high border border-card-border rounded-xl px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-emerald-400"
              />
              <button
                onClick={handleProcessYouTubeUrl}
                disabled={isProcessingYt || !ytUrlInput.trim()}
                className="bg-emerald-500 text-black hover:brightness-110 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1 disabled:opacity-50 transition-all active:scale-95 shrink-0"
              >
                {isProcessingYt ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. NEWS & PODCAST TTS PLAYER VIEW (With Live Transcript & Speed Controls) */}
      {/* ========================================================================= */}
      {viewMode === 'article_podcast' && currentArticle && (
        <div className="flex flex-col justify-between min-h-[75vh] space-y-4 animate-fade-in">
          
          {/* Header Info */}
          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 tracking-widest uppercase">
              <Sparkles className="w-3 h-3" /> VOX PODCAST STÜDYO
            </div>
            <h1 className="font-display text-base sm:text-lg font-bold leading-snug pt-0.5 max-w-sm mx-auto line-clamp-2">
              {displayTitle}
            </h1>
            <p className="text-xs text-on-surface-variant">
              Kaynak: {currentArticle.author || 'VOX Studio AI'} • {formatTime(remainingTime)} kaldı
            </p>

            {/* Language Switcher Bar (TR / EN) */}
            {onToggleLanguage && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <div className="inline-flex p-1 rounded-full bg-surface-container-high/90 border border-white/10 shadow-sm">
                  <button
                    onClick={() => onToggleLanguage('tr')}
                    disabled={isTranslating}
                    className={`flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                      languageMode === 'tr'
                        ? 'bg-emerald-500 text-black font-bold shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span>🇹🇷</span>
                    <span>Türkçe</span>
                  </button>
                  <button
                    onClick={() => onToggleLanguage('en')}
                    disabled={isTranslating}
                    className={`flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                      languageMode === 'en'
                        ? 'bg-emerald-500 text-black font-bold shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {isTranslating ? (
                      <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                    ) : (
                      <span>🇬🇧</span>
                    )}
                    <span>English</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Thumbnail Image */}
          <div className="my-1.5 relative max-w-[120px] mx-auto aspect-square rounded-2xl overflow-hidden border border-white/10 shadow-md">
            <img
              src={currentArticle.imageUrl || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&auto=format&fit=crop&q=80'}
              alt={currentArticle.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white">
              <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-500 text-black px-1.5 py-0.5 rounded-full">
                {currentArticle.sourceType.toUpperCase()}
              </span>
              <span className="text-[9px] text-white/80 font-mono">
                {currentArticle.category}
              </span>
            </div>
          </div>

          {/* Media Player Controls */}
          <div className="space-y-3 bg-surface-container/80 border border-card-border p-3.5 rounded-2xl backdrop-blur-md shadow-md">
            {/* Seek Slider */}
            <div className="space-y-1">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={(e) => onSeek(Number(e.target.value))}
                className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
              <div className="flex justify-between text-[10px] font-mono text-on-surface-variant px-0.5">
                <span>{formatTime(currentTime)}</span>
                <span>-{formatTime(remainingTime)}</span>
              </div>
            </div>

            {/* Playback Buttons */}
            <div className="flex items-center justify-between px-1">
              {/* Speed Selector */}
              <div className="relative">
                <button
                  onClick={() => setSpeedMenuOpen(!speedMenuOpen)}
                  className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-emerald-400 hover:bg-white/10"
                >
                  {playbackRate}x
                </button>
                {speedMenuOpen && (
                  <div className="absolute bottom-9 left-0 bg-surface-container border border-card-border rounded-xl p-1.5 flex flex-col gap-1 z-50 shadow-xl">
                    {[0.75, 1.0, 1.25, 1.5, 2.0].map(r => (
                      <button
                        key={r}
                        onClick={() => {
                          onSetRate(r);
                          setSpeedMenuOpen(false);
                        }}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg ${playbackRate === r ? 'bg-emerald-500 text-black' : 'text-on-surface hover:bg-white/10'}`}
                      >
                        {r}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Rewind 10s */}
              <button
                onClick={() => onSeek(currentTime - 10)}
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-on-surface hover:text-emerald-400 active:scale-95 transition-transform"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Play / Pause Main Button */}
              <button
                onClick={() => {
                  triggerHaptic();
                  if (isArticlePlaying) {
                    onPause();
                  } else {
                    onPlay();
                  }
                }}
                className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-lg active:scale-95 transition-transform hover:brightness-110"
              >
                {isArticlePlaying ? (
                  <Pause className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 fill-current ml-0.5" />
                )}
              </button>

              {/* Forward 30s */}
              <button
                onClick={() => {
                  triggerHaptic();
                  onSeek(currentTime + 30);
                }}
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-on-surface hover:text-emerald-400 active:scale-95 transition-transform"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {/* Switch to Focus Music Mode */}
              <button
                onClick={() => {
                  triggerHaptic();
                  setViewMode('focus_music');
                }}
                title="Odak Müziklerine Geç"
                className="w-9 h-9 rounded-full bg-white/5 text-on-surface-variant hover:text-white border border-white/10 flex items-center justify-center"
              >
                <Music className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Transcript / Live Tracking Box */}
          <div className="relative rounded-2xl overflow-hidden border border-card-border bg-surface-container/80 p-3.5 text-left shadow-sm backdrop-blur-md space-y-2">
            <div className="flex items-center justify-between border-b border-card-border pb-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-emerald-400 tracking-widest uppercase">
                <Sparkles className="w-3 h-3" />
                <span>TRANSKRİPT</span>
              </div>
              <button
                onClick={() => setExpandedTranscript(true)}
                className="flex items-center gap-1 text-[10px] font-bold text-emerald-300 hover:text-white bg-white/5 border border-white/10 px-2 py-0.5 rounded-full"
              >
                <span>TÜMÜ</span>
                <ChevronUp className="w-3 h-3" />
              </button>
            </div>

            <p 
              onClick={() => setExpandedTranscript(true)}
              className="font-serif text-xs leading-relaxed text-on-surface/90 font-medium line-clamp-2 cursor-pointer"
            >
              {currentSentence?.text || currentArticle.summary || currentArticle.title}
            </p>
          </div>
        </div>
      )}

      {/* Expanded Transcript Modal */}
      {expandedTranscript && (
        <div className="fixed inset-0 z-50 bg-neutral-950/95 backdrop-blur-xl p-5 overflow-hidden flex flex-col justify-between max-w-md mx-auto animate-fade-in text-white">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
            <div>
              <span className="text-[10px] font-extrabold text-emerald-400 tracking-widest uppercase block">
                {currentArticle?.category} • TRANSKRİPT
              </span>
              <h3 className="font-display text-sm font-bold truncate max-w-[220px] text-white">
                {displayTitle}
              </h3>
            </div>
            <button
              onClick={() => setExpandedTranscript(false)}
              className="flex items-center gap-1 bg-white/10 hover:bg-white/15 text-white border border-white/15 px-3 py-1 rounded-full text-xs font-bold"
            >
              <span>DARALT</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="my-3 flex-1 overflow-y-auto space-y-3 pr-1 py-2">
            {sentences.map((st, idx) => {
              const isActive = idx === safeActiveIndex;
              return (
                <div
                  key={st.index ?? `chunk-${idx}-${st.startTime}`}
                  ref={isActive ? activeSentenceRef : null}
                  onClick={() => onSeek(st.startTime)}
                  className={`p-3 rounded-xl cursor-pointer transition-all ${
                    isActive
                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-white font-bold'
                      : 'hover:bg-white/5 text-white/70'
                  }`}
                >
                  <p className="text-xs leading-relaxed font-serif">{st.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pomodoro Timer Modal Popup */}
      <PomodoroModal
        isOpen={isPomodoroOpen}
        onClose={() => setIsPomodoroOpen(false)}
        onStartAmbientWithFocus={() => {
          if (!focusState.isPlaying) focusAudioService.resume();
        }}
        isAmbientActive={focusState.isPlaying}
      />

    </div>
  );
};
