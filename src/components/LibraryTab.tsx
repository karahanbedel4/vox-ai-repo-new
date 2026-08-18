import React, { useState, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  Bookmark, 
  Play, 
  FileText, 
  History, 
  Archive, 
  HardDrive, 
  CheckCircle, 
  X, 
  Sparkles, 
  Youtube,
  Tv,
  Zap,
  Loader2,
  Newspaper
} from 'lucide-react';
import { Article } from '../types';
import { appStorage } from '../lib/storage';

interface LibraryTabProps {
  articles: Article[];
  bookmarkedIds: string[];
  onPlayArticle: (article: Article) => void;
  onToggleBookmark: (articleId: string) => void;
  onImportSuccess?: (article: Article) => void;
}

export const LibraryTab: React.FC<LibraryTabProps> = ({
  articles,
  bookmarkedIds,
  onPlayArticle,
  onToggleBookmark,
  onImportSuccess
}) => {
  // Collections drawer tab filter: 'saved' | 'history' | 'archive' | 'local'
  const [activeCollection, setActiveCollection] = useState<'saved' | 'history' | 'archive' | 'local'>('saved');
  
  // YouTube Video Player Modal State
  const [playingVideo, setPlayingVideo] = useState<{ videoId: string; title: string; channelTitle?: string; url: string } | null>(null);
  
  // AI Summarization Loading State
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [summarizeProgress, setSummarizeProgress] = useState<string>('');

  // Keyboard Escape key handler to dismiss open modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (playingVideo) setPlayingVideo(null);
        else if (isSummarizing) {
          setIsSummarizing(false);
          setSummarizeProgress('');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playingVideo, isSummarizing]);

  // Summarize video into podcast
  const handleSummarizeVideo = async (videoUrl: string, videoTitle: string) => {
    setIsSummarizing(true);
    setSummarizeProgress('YouTube videosu deşifre ediliyor...');
    try {
      setTimeout(() => setSummarizeProgress('Yapay zeka podcast özeti ve seslendirme metni oluşturuyor...'), 1200);

      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: videoUrl,
          sourceType: 'youtube',
          customTitle: videoTitle,
          summaryLength: 'Normal Özet'
        })
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any = null;
      const rawText = await res.text();
      try {
        data = JSON.parse(rawText);
      } catch {
        // Not JSON
      }

      const articleObj = data?.article || data?.data;
      if (res.ok && data?.success && articleObj) {
        if (onImportSuccess) {
          onImportSuccess(articleObj);
        } else {
          onPlayArticle(articleObj);
        }
        setPlayingVideo(null);
      } else {
        const serverError = data?.message || data?.error || (rawText.trim().startsWith('<') ? 'Sunucu geçici olarak yanıt veremedi. Lütfen tekrar deneyin.' : rawText) || 'Video özetlenirken bir hata oluştu.';
        throw new Error(serverError);
      }
    } catch (err: unknown) {
      console.error('Summarization error:', err);
      alert((err as Error)?.message || 'Video özetlenirken bir hata oluştu. Lütfen bağlantıyı kontrol edip tekrar deneyin.');
    } finally {
      setIsSummarizing(false);
      setSummarizeProgress('');
    }
  };

  // Local PDF/TXT documents from storage
  const localDocs = React.useMemo(() => {
    try {
      return JSON.parse(appStorage.getItemSync('vox_local_pdf_documents') || '[]');
    } catch {
      return [];
    }
  }, []);

  const savedArticles = articles.filter(a => bookmarkedIds.includes(a.id));
  const historyArticles = articles.slice(0, 3);
  const archiveArticles = articles.slice(2, 5);

  // Virtualization for Library articles list
  const listParentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: articles.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: () => 125,
    overscan: 3,
  });

  return (
    <div className="pt-20 pb-28 px-4 max-w-md mx-auto space-y-6 text-on-surface">
      {/* Header Title */}
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold">Kütüphanem & Arşiv</h1>
        <p className="text-xs text-on-surface-variant">
          Kaydedilen podcastleriniz, web makaleleri, YouTube özetleri ve yerel belgeleriniz.
        </p>
      </div>

      {/* Quick Stats Summary Banner */}
      <div className="bg-surface-container border border-card-border p-4 rounded-3xl grid grid-cols-3 gap-2 text-center shadow-sm">
        <div className="p-2 bg-subcard-bg rounded-2xl border border-card-border space-y-0.5">
          <span className="text-lg font-bold font-display text-primary">{savedArticles.length}</span>
          <p className="text-[10px] text-on-surface-variant font-medium">Favoriler</p>
        </div>
        <div className="p-2 bg-subcard-bg rounded-2xl border border-card-border space-y-0.5">
          <span className="text-lg font-bold font-display text-emerald-600 dark:text-emerald-400">{articles.length}</span>
          <p className="text-[10px] text-on-surface-variant font-medium">Toplam İçerik</p>
        </div>
        <div className="p-2 bg-subcard-bg rounded-2xl border border-card-border space-y-0.5">
          <span className="text-lg font-bold font-display text-primary">{localDocs.length}</span>
          <p className="text-[10px] text-on-surface-variant font-medium">Yerel Belge</p>
        </div>
      </div>

      {/* COLLECTIONS & FILTER DRAWER TABS */}
      <section className="space-y-3">
        <div className="grid grid-cols-4 gap-1.5 p-1 bg-pill-bg rounded-2xl border border-card-border">
          <button
            onClick={() => setActiveCollection('saved')}
            className={`py-2 px-1 text-[11px] font-bold rounded-xl flex flex-col items-center gap-1 transition-all ${
              activeCollection === 'saved'
                ? 'bg-primary text-on-primary shadow-md'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Favoriler</span>
          </button>

          <button
            onClick={() => setActiveCollection('history')}
            className={`py-2 px-1 text-[11px] font-bold rounded-xl flex flex-col items-center gap-1 transition-all ${
              activeCollection === 'history'
                ? 'bg-primary text-on-primary shadow-md'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Geçmiş</span>
          </button>

          <button
            onClick={() => setActiveCollection('archive')}
            className={`py-2 px-1 text-[11px] font-bold rounded-xl flex flex-col items-center gap-1 transition-all ${
              activeCollection === 'archive'
                ? 'bg-primary text-on-primary shadow-md'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Arşiv</span>
          </button>

          <button
            onClick={() => setActiveCollection('local')}
            className={`py-2 px-1 text-[11px] font-bold rounded-xl flex flex-col items-center gap-1 transition-all ${
              activeCollection === 'local'
                ? 'bg-primary text-on-primary shadow-md'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Yerel</span>
          </button>
        </div>

        {/* ACTIVE COLLECTION CONTENT */}
        <div className="bg-surface-container border border-card-border p-4 rounded-3xl space-y-3 shadow-sm">
          {activeCollection === 'saved' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-bold text-primary uppercase">
                <span>KAYDEDİLEN BÜLTENLER</span>
                <span>{savedArticles.length} Öğe</span>
              </div>
              {savedArticles.length === 0 ? (
                <div className="text-center py-6 space-y-2">
                  <Bookmark className="w-8 h-8 text-on-surface-variant/40 mx-auto" />
                  <p className="text-xs text-on-surface-variant">Henüz kaydedilmiş favori haber bulunmuyor.</p>
                </div>
              ) : (
                savedArticles.map(art => (
                  <div key={art.id} className="bg-subcard-bg border border-card-border p-3 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img src={art.imageUrl || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=120&auto=format&fit=crop&q=80'} alt={art.title} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-bold truncate">{art.title}</p>
                        <span className="text-[10px] text-on-surface-variant">{art.category} • {art.author || 'VOX AI'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => onToggleBookmark(art.id)}
                        className="p-2 rounded-xl bg-surface-variant hover:bg-card-border text-primary"
                        title="Favorilerden Çıkar"
                      >
                        <Bookmark className="w-3.5 h-3.5 fill-current" />
                      </button>
                      <button
                        onClick={() => onPlayArticle(art)}
                        className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center active:scale-95 transition-transform"
                      >
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeCollection === 'history' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-bold text-primary uppercase">
                <span>DİNLEME GEÇMİŞİ</span>
                <span>Son Oturumlar</span>
              </div>
              {historyArticles.map(art => (
                <div key={art.id} className="bg-subcard-bg border border-card-border p-3 rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold truncate">{art.title}</p>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">%100 Dinlendi</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => onPlayArticle(art)} 
                    className="text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-full shrink-0 active:scale-95 transition-transform"
                  >
                    Tekrar Dinle
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeCollection === 'archive' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-bold text-primary uppercase">
                <span>ARŞİVLENEN İÇERİKLER</span>
                <span>Eski Bültenler</span>
              </div>
              {archiveArticles.map(art => (
                <div key={art.id} className="bg-subcard-bg border border-card-border p-3 rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Archive className="w-5 h-5 text-on-surface-variant shrink-0" />
                    <div className="truncate">
                      <p className="text-xs font-bold truncate">{art.title}</p>
                      <span className="text-[10px] text-on-surface-variant">{art.category} • Arşivlendi</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => onPlayArticle(art)} 
                    className="text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-full shrink-0 active:scale-95 transition-transform"
                  >
                    Dinle
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeCollection === 'local' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-bold text-primary uppercase">
                <span>YEREL CİHAZ BELGELERİ</span>
                <span>{localDocs.length} Dosya</span>
              </div>
              {localDocs.length === 0 ? (
                <div className="text-center py-6 space-y-2">
                  <HardDrive className="w-8 h-8 text-on-surface-variant/40 mx-auto" />
                  <p className="text-xs text-on-surface-variant">
                    Cihazda saklanan çevrimdışı belge bulunmuyor. "Ekle" sekmesinden PDF veya TXT yükleyebilirsiniz.
                  </p>
                </div>
              ) : (
                localDocs.map((doc: { id: string; name: string; sizeKb: number; text: string }) => (
                  <div key={doc.id} className="bg-subcard-bg border border-card-border p-3 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-5 h-5 text-primary shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-bold truncate">{doc.name}</p>
                        <span className="text-[10px] text-on-surface-variant">{doc.sizeKb} KB • Yerel Bellek</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </section>

      {/* ALL ARTICLES LIST SECTION */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold flex items-center justify-between">
          <span>Tüm Bültenler & Podcaster</span>
          <span className="text-xs text-on-surface-variant font-normal">{articles.length} içerik</span>
        </h2>

        <div ref={listParentRef} className="max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const art = articles[virtualRow.index];
              if (!art) return null;
              const isBookmarked = bookmarkedIds.includes(art.id);
              return (
                <div
                  key={art.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="pb-3"
                >
                  <div className="bg-surface-container border border-card-border p-3.5 rounded-2xl space-y-2 hover:border-primary/40 transition-all shadow-sm">
                    <div className="flex items-start gap-3">
                      <img src={art.imageUrl || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=160&auto=format&fit=crop&q=80'} alt={art.title} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{art.category}</span>
                          <span className="text-[10px] text-on-surface-variant font-mono">
                            {Math.round(art.durationSeconds / 60)} dk
                          </span>
                        </div>
                        <h3 className="text-xs font-bold text-on-surface line-clamp-2 leading-snug">{art.title}</h3>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-card-border">
                      <button
                        onClick={() => onToggleBookmark(art.id)}
                        className="flex items-center gap-1 text-[11px] text-on-surface-variant hover:text-primary transition-colors"
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-primary text-primary' : ''}`} />
                        <span>{isBookmarked ? 'Favorilerde' : 'Favorilere Ekle'}</span>
                      </button>

                      <button
                        onClick={() => onPlayArticle(art)}
                        className="bg-primary text-on-primary text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shadow-md"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Dinle</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* EMBEDDED YOUTUBE IFRAME VIDEO PLAYER MODAL */}
      {playingVideo && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer touch-none"
          onClick={() => setPlayingVideo(null)}
          onTouchEnd={(e) => {
            if (e.target === e.currentTarget) setPlayingVideo(null);
          }}
        >
          <div 
            className="w-full max-w-md bg-surface-container border border-white/15 rounded-3xl p-5 space-y-4 shadow-2xl relative cursor-default max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <Youtube className="w-5 h-5 text-red-500" />
                <span className="text-xs font-bold text-red-400">{playingVideo.channelTitle || 'YouTube Video'}</span>
              </div>
              <button
                onClick={() => setPlayingVideo(null)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 text-on-surface"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Embedded iFrame */}
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 shadow-xl">
              <iframe
                src={`https://www.youtube.com/embed/${playingVideo.videoId}?autoplay=1`}
                title={playingVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-on-surface line-clamp-2">{playingVideo.title}</h3>
              <p className="text-xs text-on-surface-variant">
                YouTube üzerinden izliyorsunuz. Dilerseniz bu videoyu doğrudan sesli bültene dönüştürebilirsiniz.
              </p>
            </div>

            {/* Summarize Action Button inside Player */}
            <button
              onClick={() => handleSummarizeVideo(playingVideo.url, playingVideo.title)}
              disabled={isSummarizing}
              className="w-full py-3 px-4 bg-gradient-to-r from-primary to-emerald-400 text-on-primary rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg hover:opacity-90 transition-all disabled:opacity-50"
            >
              {isSummarizing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{summarizeProgress || 'İçerik İşleniyor...'}</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-current" />
                  <span>⚡ Bu Videoyu VOX AI ile Özetle & Podcaste Dönüştür</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* GLOBAL SUMMARIZING LOADING OVERLAY */}
      {isSummarizing && !playingVideo && (
        <div 
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer touch-none"
          onClick={() => { setIsSummarizing(false); setSummarizeProgress(''); }}
          onTouchEnd={(e) => {
            if (e.target === e.currentTarget) {
              setIsSummarizing(false);
              setSummarizeProgress('');
            }
          }}
        >
          <div 
            className="bg-surface-container border border-primary/40 p-6 rounded-3xl max-w-sm w-full space-y-4 text-center shadow-2xl relative cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setIsSummarizing(false); setSummarizeProgress(''); }}
              className="absolute top-3 right-3 text-on-surface-variant hover:text-white"
              title="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-primary/20 text-primary flex items-center justify-center mx-auto animate-bounce">
              <Zap className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-on-surface">YouTube İçeriği Podcaste Dönüştürülüyor</h3>
              <p className="text-xs text-primary font-medium animate-pulse">{summarizeProgress}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
