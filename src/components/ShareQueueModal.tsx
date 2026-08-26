import React, { useState } from 'react';
import { 
  Sparkles, 
  Trash2, 
  X, 
  Play, 
  Plus, 
  ExternalLink, 
  Youtube, 
  Twitter, 
  Globe, 
  Loader2, 
  ClipboardList,
  Layers,
  ArrowRight
} from 'lucide-react';
import { SharedLinkItem, SourceType } from '../types';
import { MAX_QUEUE_LIMIT, parseSharedContent } from '../lib/shareService';

interface ShareQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  queue: SharedLinkItem[];
  onConvertItem: (item: SharedLinkItem) => Promise<void>;
  onBatchConvertAll: () => Promise<void>;
  onDeleteItem: (id: string) => void;
  onClearQueue: () => void;
  onAddNewLink: (item: { url: string; title?: string; sourceType: SourceType; platformName: SharedLinkItem['platformName']; thumbnail?: string }) => { success: boolean; error?: string };
  isConverting?: boolean;
}

export const ShareQueueModal: React.FC<ShareQueueModalProps> = ({
  isOpen,
  onClose,
  queue,
  onConvertItem,
  onBatchConvertAll,
  onDeleteItem,
  onClearQueue,
  onAddNewLink,
  isConverting = false
}) => {
  const [manualInput, setManualInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [convertingItemId, setConvertingItemId] = useState<string | null>(null);

  if (!isOpen) return null;

  const isQueueFull = queue.length >= MAX_QUEUE_LIMIT;

  const handleAddManual = () => {
    if (!manualInput.trim()) return;
    const parsed = parseSharedContent(manualInput);
    if (!parsed) {
      setInputError('Geçerli bir web bağlantısı veya YouTube/X linki girin.');
      return;
    }

    const res = onAddNewLink(parsed);
    if (res.success) {
      setManualInput('');
      setInputError(null);
    } else {
      setInputError(res.error || 'Link eklenemedi.');
    }
  };

  const handleSingleConvert = async (item: SharedLinkItem) => {
    setConvertingItemId(item.id);
    try {
      await onConvertItem(item);
    } finally {
      setConvertingItemId(null);
    }
  };

  const renderPlatformIcon = (platform: SharedLinkItem['platformName']) => {
    switch (platform) {
      case 'YouTube':
        return <Youtube className="w-4 h-4 text-red-400" />;
      case 'X / Twitter':
        return <Twitter className="w-4 h-4 text-sky-400" />;
      default:
        return <Globe className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-[#121820] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with VOX branding */}
        <div className="p-5 pb-4 border-b border-white/10 bg-gradient-to-b from-primary/10 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-amber-300 flex items-center justify-center shadow-lg shadow-primary/25 border border-primary/40 font-black text-black text-sm tracking-wider">
              VOX
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Dönüştürme Havuzu & Kuyruk
              </h3>
              <p className="text-[11px] text-neutral-400 font-medium">
                Paylaşılan içerikleri sırayla veya topluca podcaste çevirin
              </p>
            </div>
          </div>

          <button
            id="close-queue-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Quick Input Bar to Add Link to Queue */}
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <input
                id="queue-add-link-input"
                type="url"
                placeholder={isQueueFull ? "Havuz dolu (En fazla 5 link)" : "YouTube, X veya Web linki yapıştırın..."}
                value={manualInput}
                disabled={isQueueFull}
                onChange={(e) => {
                  setManualInput(e.target.value);
                  setInputError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddManual();
                }}
                className="flex-1 bg-[#18202b] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
              />
              <button
                id="queue-add-link-btn"
                onClick={handleAddManual}
                disabled={isQueueFull || !manualInput.trim()}
                className="px-4 py-2.5 bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
                <span>Ekle</span>
              </button>
            </div>
            {inputError && (
              <p className="text-[11px] text-red-400 px-1 font-medium">{inputError}</p>
            )}
          </div>

          {/* Capacity Progress Bar */}
          <div className="bg-[#18202b] border border-white/10 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <span className="text-xs text-neutral-300 font-medium">Kapasite</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden flex">
                <div 
                  className={`h-full transition-all duration-300 ${
                    queue.length >= MAX_QUEUE_LIMIT ? 'bg-amber-400' : 'bg-primary'
                  }`}
                  style={{ width: `${(queue.length / MAX_QUEUE_LIMIT) * 100}%` }}
                />
              </div>
              <span className="text-xs font-bold text-white">
                {queue.length} / {MAX_QUEUE_LIMIT}
              </span>
            </div>
          </div>

          {/* Queue List */}
          {queue.length === 0 ? (
            <div className="py-10 text-center space-y-3 bg-white/5 border border-dashed border-white/10 rounded-2xl p-6">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-neutral-400">
                <ClipboardList className="w-6 h-6 text-neutral-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Dönüştürme Havuzunuz Boş</h4>
                <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto leading-relaxed">
                  Safari, YouTube veya X (Twitter)'da gezinirken <strong>Paylaş &gt; VOX</strong> seçeneğiyle linkleri buraya gönderebilir veya yukarıdan yapıştırabilirsiniz.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {queue.map((item) => (
                <div 
                  key={item.id}
                  className="bg-[#18202b] border border-white/10 rounded-2xl p-3 flex items-center gap-3 transition-all hover:border-white/20"
                >
                  {/* Thumbnail / Icon */}
                  {item.thumbnail ? (
                    <img 
                      src={item.thumbnail} 
                      alt="" 
                      className="w-12 h-12 rounded-xl object-cover shrink-0 border border-white/10 bg-black/40"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      {renderPlatformIcon(item.platformName)}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {renderPlatformIcon(item.platformName)}
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                        {item.platformName}
                      </span>
                    </div>
                    <h5 className="text-xs font-semibold text-white truncate">
                      {item.title || item.url}
                    </h5>
                    <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                      {item.url}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      id={`convert-queue-item-${item.id}`}
                      disabled={isConverting || convertingItemId === item.id}
                      onClick={() => handleSingleConvert(item)}
                      title="Podcaste Dönüştür"
                      className="p-2 rounded-xl bg-primary text-black font-bold hover:bg-primary/90 transition-all flex items-center justify-center disabled:opacity-50"
                    >
                      {convertingItemId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      id={`delete-queue-item-${item.id}`}
                      disabled={isConverting || convertingItemId === item.id}
                      onClick={() => onDeleteItem(item.id)}
                      title="Kuyruktan Sil"
                      className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {queue.length > 0 && (
          <div className="p-4 border-t border-white/10 bg-[#151c26] flex items-center justify-between gap-3">
            <button
              id="clear-all-queue-btn"
              onClick={onClearQueue}
              disabled={isConverting}
              className="text-xs text-neutral-400 hover:text-red-400 font-semibold px-2 py-1.5 transition-colors disabled:opacity-50"
            >
              Havuzu Temizle
            </button>

            <button
              id="batch-convert-all-btn"
              onClick={onBatchConvertAll}
              disabled={isConverting}
              className="py-2.5 px-5 bg-gradient-to-r from-primary to-amber-400 hover:from-primary/90 hover:to-amber-400/90 text-black font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isConverting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Dönüştürülüyor...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-black" />
                  <span>Tümünü Dönüştür ({queue.length})</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
