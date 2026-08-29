import React from 'react';
import { Sparkles, BookmarkPlus, X, ExternalLink, Youtube, Twitter, Globe, ArrowRight } from 'lucide-react';
import { SharedLinkItem, SourceType } from '../types';
import { MAX_QUEUE_LIMIT } from '../lib/shareService';
import { VoxLogo } from './VoxLogo';

interface ShareIncomingModalProps {
  isOpen: boolean;
  onClose: () => void;
  sharedItem: {
    url: string;
    title?: string;
    sourceType: SourceType;
    platformName: SharedLinkItem['platformName'];
    thumbnail?: string;
  } | null;
  onConvertNow: (item: { url: string; title?: string; sourceType: SourceType; platformName: SharedLinkItem['platformName']; thumbnail?: string }) => void;
  onSaveToQueue: (item: { url: string; title?: string; sourceType: SourceType; platformName: SharedLinkItem['platformName']; thumbnail?: string }) => void;
  queueCount: number;
}

export const ShareIncomingModal: React.FC<ShareIncomingModalProps> = ({
  isOpen,
  onClose,
  sharedItem,
  onConvertNow,
  onSaveToQueue,
  queueCount
}) => {
  if (!isOpen || !sharedItem) return null;

  const isQueueFull = queueCount >= MAX_QUEUE_LIMIT;

  const renderPlatformBadge = () => {
    switch (sharedItem.platformName) {
      case 'YouTube':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
            <Youtube className="w-3.5 h-3.5" />
            <span>YouTube</span>
          </span>
        );
      case 'X / Twitter':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <Twitter className="w-3.5 h-3.5" />
            <span>X (Twitter)</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Globe className="w-3.5 h-3.5" />
            <span>Web Makale</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-[#121820] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with VOX Logo */}
        <div className="relative p-5 pb-4 border-b border-white/10 bg-gradient-to-b from-primary/10 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <VoxLogo className="h-8 w-auto" variant="dark" />
              <div>
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                  Paylaşılan İçerik Algılandı
                </h3>
                <p className="text-[11px] text-neutral-400 font-medium">
                  Bağlantıyı sese ve yapay zeka podcastine dönüştürün
                </p>
              </div>
            </div>

            <button
              id="close-share-modal-btn"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Preview */}
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="bg-[#18202b] border border-white/10 rounded-2xl p-3.5 flex gap-3.5 items-start">
            {sharedItem.thumbnail ? (
              <img 
                src={sharedItem.thumbnail} 
                alt="Önizleme" 
                className="w-16 h-16 rounded-xl object-cover shrink-0 border border-white/10 bg-black/40"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <Globe className="w-6 h-6 text-primary/70" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                {renderPlatformBadge()}
                <span className="text-[10px] text-neutral-400 font-medium truncate max-w-[120px]">
                  {sharedItem.url ? new URL(sharedItem.url.startsWith('http') ? sharedItem.url : `https://${sharedItem.url}`).hostname : ''}
                </span>
              </div>
              <h4 className="text-sm font-semibold text-white line-clamp-2 leading-snug">
                {sharedItem.title || sharedItem.url}
              </h4>
              {sharedItem.url && (
                <p className="text-[11px] text-neutral-400 truncate mt-1 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  <span className="truncate">{sharedItem.url}</span>
                </p>
              )}
            </div>
          </div>

          {/* Queue Capacity Indicator */}
          <div className="flex items-center justify-between text-xs px-1 text-neutral-400">
            <span>Dönüştürme Havuzu Durumu:</span>
            <span className={`font-semibold ${isQueueFull ? 'text-amber-400' : 'text-primary'}`}>
              {queueCount} / {MAX_QUEUE_LIMIT} Link Kayıtlı
            </span>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            {/* 1. Convert Now */}
            <button
              id="convert-now-btn"
              onClick={() => {
                onConvertNow(sharedItem);
                onClose();
              }}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-primary to-amber-400 hover:from-primary/90 hover:to-amber-400/90 text-black font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-[0.99] transition-all text-sm"
            >
              <Sparkles className="w-4 h-4 text-black" />
              <span>Hemen Podcaste Dönüştür</span>
              <ArrowRight className="w-4 h-4 text-black ml-auto" />
            </button>

            {/* 2. Save to Queue (Later) */}
            <button
              id="save-to-queue-btn"
              onClick={() => {
                onSaveToQueue(sharedItem);
                onClose();
              }}
              disabled={isQueueFull}
              className={`w-full py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all text-xs ${
                isQueueFull ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.99]'
              }`}
            >
              <BookmarkPlus className="w-4 h-4 text-primary" />
              <span>Kaydet, Daha Sonra Dönüştür</span>
            </button>

            {isQueueFull && (
              <p className="text-[11px] text-amber-400 text-center font-medium">
                ⚠️ Havuz dolu (5/5). Yeni link eklemek için mevcut linkleri dönüştürün veya silin.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
