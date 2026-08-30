import React from 'react';
import { CloudRain, Square, X, Play, Pause, SkipBack, SkipForward, Check, Volume2 } from 'lucide-react';
import { triggerHapticImpact } from '../lib/haptics';
import { FocusTrack } from '../lib/focusAudioService';

// Top Notification Toast Banner
interface AmbientNotificationBannerProps {
  notificationText: string | null;
  onDismiss: () => void;
  onOpenMixer?: () => void;
}

export const AmbientNotificationBanner: React.FC<AmbientNotificationBannerProps> = ({
  notificationText,
  onDismiss,
  onOpenMixer
}) => {
  if (!notificationText) return null;

  return (
    <div className="fixed top-3 left-3 right-3 z-50 animate-in slide-in-from-top-4 duration-300 pointer-events-auto">
      <div className="bg-surface-container/95 border border-primary/40 shadow-2xl backdrop-blur-xl rounded-2xl p-3.5 flex items-center justify-between text-on-surface">
        <div 
          className="flex items-center gap-3 cursor-pointer flex-1 min-w-0 pr-2"
          onClick={onOpenMixer}
        >
          <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shrink-0">
            <CloudRain className="w-4 h-4 animate-pulse" />
          </div>
          <div className="truncate">
            <span className="text-[10px] font-extrabold text-primary uppercase tracking-wider block">
              SİSTEM BİLDİRİMİ
            </span>
            <p className="font-display text-xs font-bold truncate text-on-surface">
              Devam eden ses: <span className="text-primary">{notificationText}</span>
            </p>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="w-7 h-7 rounded-full bg-surface-variant flex items-center justify-center hover:bg-card-border text-on-surface-variant hover:text-on-surface shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

// Bottom Ambient / Focus Audio Floating Mini Player Bar (Exact to Screenshot)
interface AmbientMiniPlayerBarProps {
  isAmbientActive: boolean;
  activeAmbientName: string;
  categoryLabel?: string;
  trackIndex?: string; // e.g. "1/6"
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  onPlayNext?: () => void;
  onPlayPrevious?: () => void;
  onStopAll?: () => void;
  onOpenListenTab?: () => void;
  hasArticleMiniPlayer?: boolean;
}

export const AmbientMiniPlayerBar: React.FC<AmbientMiniPlayerBarProps> = ({
  isAmbientActive,
  activeAmbientName,
  categoryLabel = 'DOĞA & AMBİYANS',
  trackIndex = '1/6',
  isPlaying = true,
  onTogglePlay,
  onPlayNext,
  onPlayPrevious,
  onStopAll,
  onOpenListenTab,
  hasArticleMiniPlayer = false
}) => {
  if (!isAmbientActive) return null;

  const triggerHaptic = () => {
    triggerHapticImpact('light').catch(() => {});
  };

  // Stack cleanly above BottomNav
  const bottomPositionClass = hasArticleMiniPlayer 
    ? 'bottom-[calc(8.75rem+env(safe-area-inset-bottom,16px))]' 
    : 'bottom-[calc(5.25rem+env(safe-area-inset-bottom,16px))]';

  return (
    <div className={`fixed ${bottomPositionClass} left-3 right-3 z-40 max-w-md mx-auto animate-in slide-in-from-bottom-3 duration-300 pointer-events-auto`}>
      <div 
        onClick={() => {
          triggerHaptic();
          if (onOpenListenTab) onOpenListenTab();
        }}
        className="bg-neutral-950/90 dark:bg-[#0c1015]/95 border border-white/15 dark:border-emerald-500/25 shadow-[0_12px_32px_rgba(0,0,0,0.55)] backdrop-blur-2xl rounded-2xl p-2.5 px-3.5 flex items-center justify-between text-white transition-all cursor-pointer group hover:border-emerald-400/40"
      >
        {/* Left: Equalizer Visualizer Inside Dark Box */}
        <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
          <div className="w-10 h-10 rounded-xl bg-black/70 border border-emerald-500/40 flex items-center justify-center gap-[3px] shrink-0 shadow-inner px-2">
            <span className={`w-[2.5px] bg-emerald-400 rounded-full transition-all duration-150 ${isPlaying ? 'h-5 animate-bounce [animation-delay:-0.3s]' : 'h-2'}`} />
            <span className={`w-[2.5px] bg-emerald-400 rounded-full transition-all duration-150 ${isPlaying ? 'h-6 animate-bounce [animation-delay:-0.15s]' : 'h-4'}`} />
            <span className={`w-[2.5px] bg-emerald-400 rounded-full transition-all duration-150 ${isPlaying ? 'h-3 animate-bounce' : 'h-1.5'}`} />
            <span className={`w-[2.5px] bg-emerald-400 rounded-full transition-all duration-150 ${isPlaying ? 'h-5 animate-bounce [animation-delay:-0.4s]' : 'h-3'}`} />
          </div>

          {/* Center Title & Tags */}
          <div className="truncate">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-[10px] font-black text-emerald-400 tracking-wider uppercase truncate">
                {categoryLabel}
              </span>
              {trackIndex && (
                <span className="text-[9px] font-bold text-emerald-300/80 bg-emerald-500/20 px-1.5 py-0.2 rounded-full font-mono shrink-0">
                  {trackIndex}
                </span>
              )}
            </div>
            <p className="font-display text-xs font-bold truncate text-white group-hover:text-emerald-300 transition-colors mt-0.5">
              {activeAmbientName}
            </p>
          </div>
        </div>

        {/* Right: Media Controls (SkipBack, Play/Pause Green Circle, SkipForward) - NO MIXER BUTTON AS REQUESTED */}
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {onPlayPrevious && (
            <button
              onClick={() => {
                triggerHaptic();
                onPlayPrevious();
              }}
              title="Önceki"
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>
          )}

          {onTogglePlay && (
            <button
              onClick={() => {
                triggerHaptic();
                onTogglePlay();
              }}
              title={isPlaying ? 'Duraklat' : 'Oynat'}
              className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>
          )}

          {onPlayNext && (
            <button
              onClick={() => {
                triggerHaptic();
                onPlayNext();
              }}
              title="Sonraki"
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Conflict Question Modal when user plays Converted Content (Podcast/Article)
interface AmbientConflictModalProps {
  isOpen: boolean;
  activeAmbientName: string;
  pendingArticleTitle?: string;
  onConfirmKeepAmbient: () => void;
  onStopAmbientAndPlay: () => void;
}

export const AmbientConflictModal: React.FC<AmbientConflictModalProps> = ({
  isOpen,
  activeAmbientName,
  pendingArticleTitle,
  onConfirmKeepAmbient,
  onStopAmbientAndPlay
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="w-full max-w-sm bg-surface-container border border-card-border rounded-3xl p-6 space-y-5 shadow-2xl text-on-surface text-center">
        {/* Header Icon */}
        <div className="mx-auto w-14 h-14 rounded-3xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shadow-lg">
          <CloudRain className="w-7 h-7 animate-pulse" />
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h3 className="font-display font-extrabold text-base text-on-surface">
            Arka Plan Sesi Çalmaya Devam Etsin mi?
          </h3>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            <strong className="text-primary">{activeAmbientName}</strong> arka planda çalmaya devam etsin mi?
          </p>
          {pendingArticleTitle && (
            <div className="bg-surface-variant/60 border border-card-border rounded-xl p-2.5 text-[11px] font-medium text-on-surface-variant truncate mt-1">
              🎵 İçerik: <span className="text-on-surface font-semibold">{pendingArticleTitle}</span>
            </div>
          )}
        </div>

        {/* Info Note */}
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-2.5 text-[10px] text-primary font-semibold flex items-center gap-2 text-left">
          <Volume2 className="w-4 h-4 shrink-0" />
          <span>Dönüştürülen içerik haber sesinizle, odak sesleri ise bağımsız arka planda çalışacaktır.</span>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-1">
          <button
            onClick={onConfirmKeepAmbient}
            className="w-full bg-primary text-on-primary py-3 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-md active:scale-95 transition-transform"
          >
            <Check className="w-4 h-4" />
            <span>Evet, Birlikte Çalsın</span>
          </button>

          <button
            onClick={onStopAmbientAndPlay}
            className="w-full bg-surface-variant hover:bg-card-border text-red-400 border border-red-500/20 py-2.5 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Hayır, Arka Plan Sesini Durdur</span>
          </button>
        </div>
      </div>
    </div>
  );
};
