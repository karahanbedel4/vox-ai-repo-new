import React, { useState } from 'react';
import { 
  Clipboard, 
  Link2, 
  FileText, 
  Youtube, 
  Sparkles, 
  CheckCircle, 
  Loader2, 
  UploadCloud, 
  Trash2, 
  HardDrive, 
  Play, 
  FileCheck,
  ChevronDown,
  Layers,
  Twitter,
  Globe,
  Plus
} from 'lucide-react';
import { SourceType, Article, SharedLinkItem } from '../types';
import { appStorage } from '../lib/storage';
import { safeApiFetch } from '../lib/api';
import { auth, incrementUserQuota } from '../lib/firebase';
import { ConversionProgressModal } from './ConversionProgressModal';
import { MAX_QUEUE_LIMIT } from '../lib/shareService';

interface AddModalProps {
  onImportSuccess: (article: Article) => void;
  recentArticles: Article[];
  onIncrementQuota?: () => Promise<boolean>;
  isPremium?: boolean;
  isGuest?: boolean;
  dailyQuotaUsed?: number;
  dailyQuotaLimit?: number;
  onOpenPaywall?: () => void;
  onOpenAuthModal?: () => void;
  sharedQueue?: SharedLinkItem[];
  onOpenQueueModal?: () => void;
  onConvertQueueItem?: (item: SharedLinkItem) => Promise<void>;
  onDeleteQueueItem?: (id: string) => void;
  onBatchConvertQueue?: () => Promise<void>;
}

export const AddModal: React.FC<AddModalProps> = ({ 
  onImportSuccess, 
  recentArticles,
  onIncrementQuota,
  isPremium = false,
  isGuest = false,
  dailyQuotaUsed = 0,
  dailyQuotaLimit = 3,
  onOpenPaywall,
  onOpenAuthModal,
  sharedQueue = [],
  onOpenQueueModal,
  onConvertQueueItem,
  onDeleteQueueItem,
  onBatchConvertQueue
}) => {
  // Active drawer tab: 'paste' | 'web' | 'pdf' | 'youtube'
  const [activeDrawer, setActiveDrawer] = useState<'paste' | 'web' | 'pdf' | 'youtube'>('paste');

  // Drawer 1: Yapıştır
  const [pastedText, setPastedText] = useState('');

  // Drawer 2: Web Bağlantısı
  const [webUrl, setWebUrl] = useState('');

  // Drawer 3: PDF & Local Storage
  const [localFiles, setLocalFiles] = useState<{ id: string; name: string; sizeKb: number; text: string }[]>(() => {
    try {
      const saved = appStorage.getItemSync('vox_local_pdf_documents');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Drawer 4: YouTube Single Video Link Mode
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [manualTranscript, setManualTranscript] = useState('');
  const [focusArea, setFocusArea] = useState('Genel Özet & Detaylar');
  const [summaryLength, setSummaryLength] = useState('Normal Özet (Yarı Süreye Kadar / 3 Segment)');

  // Common UI states
  const [loading, setLoading] = useState(false);
  const [convertingMeta, setConvertingMeta] = useState<{ sourceType: SourceType; title?: string; url?: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  // Helper to extract YouTube Video ID
  const getYoutubeVideoId = (url: string) => {
    if (!url) return null;
    const trimmed = url.trim();
    const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/;
    const match = trimmed.match(regExp);
    if (match && match[1]) return match[1];
    if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
    return null;
  };

  // Paste from Clipboard helper
  const handlePasteFromClipboard = async () => {
    triggerHaptic();
    try {
      if (navigator.clipboard) {
        const text = await navigator.clipboard.readText();
        if (activeDrawer === 'youtube') {
          setYoutubeUrl(text);
        } else if (activeDrawer === 'web') {
          setWebUrl(text);
        } else {
          setPastedText(text);
        }
      }
    } catch {
      setErrorMsg('Pano okuma izni alınamadı. Lütfen elle yapıştırın.');
    }
  };

  // Handle PDF/TXT Upload via FileReader
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    triggerHaptic();
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg('Dosya boyutu 15MB sınırını aşamaz.');
      return;
    }

    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';

      let estimatedPages = 1;
      if (isPdf) {
        // Look for PDF page markers in structure or estimate from size (1 page ≈ 40KB of PDF structure)
        const pageMatches = content.match(/\/Type\s*\/Page\b/g);
        if (pageMatches && pageMatches.length > 0) {
          estimatedPages = pageMatches.length;
        } else {
          const sizeKb = file.size / 1024;
          estimatedPages = Math.max(1, Math.ceil(sizeKb / 45));
        }
      } else {
        const cleanLen = content.replace(/[^a-zA-Z0-9\sğüşıöçĞÜŞİÖÇ]/g, '').length;
        estimatedPages = Math.max(1, Math.ceil(cleanLen / 3000));
      }

      if (estimatedPages > 50) {
        setErrorMsg('Yüklediğiniz belge 50 sayfa sınırını aşıyor. Lütfen daha kısa bir belge yükleyin veya ilgili bölümü parçalar halinde taratın.');
        return;
      }

      const sizeKb = Math.round(file.size / 1024);
      const newFile = {
        id: 'file_' + Date.now(),
        name: file.name,
        sizeKb,
        text: content,
        pageCount: estimatedPages
      };

      const updated = [newFile, ...localFiles];
      setLocalFiles(updated);
      appStorage.setItem('vox_local_pdf_documents', JSON.stringify(updated));
    };

    if (isPdf) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  };

  // Clear On-Device Storage
  const handleClearLocalStorage = () => {
    triggerHaptic();
    setLocalFiles([]);
    appStorage.removeItem('vox_local_pdf_documents');
    appStorage.removeItem('vox_local_only_summaries');
  };

  // Calculate total KB used
  const totalKbUsed = localFiles.reduce((acc, f) => acc + f.sizeKb, 0);

  // Submit Handler for AI Summarization
  const handleGenerateSummary = async (sourceType: SourceType, rawText?: string, url?: string, pageCount?: number) => {
    triggerHaptic();

    // Check remaining daily quota before generating summary
    if (!isPremium) {
      const remainingQuota = dailyQuotaLimit - dailyQuotaUsed;
      if (remainingQuota <= 0) {
        if (isGuest && onOpenAuthModal) {
          onOpenAuthModal();
        } else if (onOpenPaywall) {
          onOpenPaywall();
        }
        return;
      }
    }

    // Deduct quota via onIncrementQuota callback or directly via incrementUserQuota
    if (onIncrementQuota) {
      const canProceed = await onIncrementQuota();
      if (!canProceed) {
        if (isGuest && onOpenAuthModal) {
          onOpenAuthModal();
        } else if (onOpenPaywall) {
          onOpenPaywall();
        }
        return;
      }
    } else if (auth.currentUser?.uid) {
      await incrementUserQuota(auth.currentUser.uid);
    }

    setLoading(true);
    setConvertingMeta({
      sourceType,
      title: customTitle || (sourceType === 'youtube' ? 'YouTube Podcast Dönüştürme' : sourceType === 'web' ? 'Web Makalesi Çözümleme' : sourceType === 'pdf' ? 'Yerel PDF Belgesi' : 'Metin & Pano Özeti'),
      url: url || webUrl || youtubeUrl
    });
    setErrorMsg(null);

    try {
      const bodyPayload = {
        sourceType,
        rawText: rawText || pastedText,
        url: url || webUrl || youtubeUrl,
        focusArea,
        summaryLength,
        manualTranscript,
        customTitle,
        pageCount
      };

      const res = await safeApiFetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let json: any = null;
      const rawResponseText = await res.text();
      try {
        json = JSON.parse(rawResponseText);
      } catch {
        // Response is not JSON (e.g. server HTML error page or fallback)
      }

      if (res.ok && json?.success && json?.data) {
        const youtubeId = sourceType === 'youtube' ? getYoutubeVideoId(url || youtubeUrl) : null;
        const thumbnail = youtubeId 
          ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
          : 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&auto=format&fit=crop&q=80';

        const article: Article = {
          id: 'vox_' + Date.now(),
          title: json.data.title || customTitle || 'VOX AI Sesli Bülten',
          summary: json.data.summary || 'Yapay zeka analiz özeti tamamlandı.',
          content: json.data.content || rawText || 'Özet metni.',
          category: json.data.category || 'Teknoloji',
          sourceUrl: url || webUrl || youtubeUrl,
          sourceType,
          durationSeconds: json.data.durationSeconds || 300,
          imageUrl: json.data.imageUrl || thumbnail,
          createdAt: new Date().toISOString(),
          author: json.data.author || 'VOX Studio AI',
          keyPoints: json.data.keyPoints
        };

        // Save to offline storage as fallback
        try {
          const offline = JSON.parse(appStorage.getItemSync('vox_local_only_summaries') || '[]');
          appStorage.setItem('vox_local_only_summaries', JSON.stringify([article, ...offline]));
        } catch {}

        onImportSuccess(article);

        // Reset inputs
        setPastedText('');
        setWebUrl('');
        setYoutubeUrl('');
        setCustomTitle('');
        setManualTranscript('');
      } else {
        const serverMsg = json?.message || json?.error || (rawResponseText.trim().startsWith('<') ? 'Sunucu geçici olarak yanıt veremedi. Lütfen tekrar deneyin.' : rawResponseText) || 'Yapay zeka bülteni oluşturulamadı.';
        throw new Error(serverMsg);
      }
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg((err as Error).message || 'İşlem sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const youtubeVideoId = getYoutubeVideoId(youtubeUrl);

  return (
    <div className="pt-20 pb-28 px-4 max-w-md mx-auto space-y-6 text-on-surface">
      {/* Live AI Conversion Progress Modal Animation */}
      <ConversionProgressModal
        isOpen={loading}
        sourceType={convertingMeta?.sourceType || 'text'}
        sourceTitle={convertingMeta?.title}
        sourceUrl={convertingMeta?.url}
      />

      {/* Recent Imports Horizontal List */}
      <section className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
            <FileCheck className="w-3.5 h-3.5 text-primary" />
            SON İÇE AKTARILANLAR
          </h3>
          <span className="text-[10px] font-bold text-primary cursor-pointer hover:underline">TÜMÜNÜ GÖR</span>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
          {recentArticles.slice(0, 4).map(art => (
            <div
              key={art.id}
              className="w-40 shrink-0 bg-surface-container border border-card-border p-3 rounded-2xl space-y-2 relative shadow-sm"
            >
              <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-surface-variant">
                <img src={art.imageUrl || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=300&auto=format&fit=crop&q=80'} alt={art.title} className="w-full h-full object-cover" />
                <div className="absolute top-1 right-1 bg-primary text-on-primary rounded-full p-0.5 shadow">
                  <CheckCircle className="w-3 h-3 fill-current" />
                </div>
              </div>
              <h4 className="font-display text-xs font-bold truncate text-on-surface">{art.title}</h4>
              <span className="text-[10px] text-on-surface-variant block">12 dk önce • {art.category}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Quota & Subscription Status Banner */}
      <div className="bg-surface-container border border-primary/40 p-3.5 rounded-2xl flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-on-surface">
                {isPremium 
                  ? 'VOX Premium Aktif' 
                  : (isGuest 
                      ? `Misafir Deneme: ${dailyQuotaUsed} / ${dailyQuotaLimit} Özet Hakkı` 
                      : `Ücretsiz Kota: ${dailyQuotaUsed} / ${dailyQuotaLimit} Özet`)}
              </span>
              {isPremium ? (
                <span className="bg-primary/20 text-primary border border-primary/30 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                  SINIRSIZ
                </span>
              ) : isGuest ? (
                <span className="bg-amber-500/20 text-amber-500 border border-amber-500/30 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                  MİSAFİR
                </span>
              ) : null}
            </div>
            <p className="text-[11px] text-on-surface-variant">
              {isPremium 
                ? 'Tüm yapay zeka özetleme ve HD seslendirme hakları sınırsız.' 
                : isGuest 
                  ? (dailyQuotaUsed >= 1 
                      ? '1/1 test hakkınızı kullandınız. Devam etmek için ücretsiz giriş yapın.' 
                      : 'Misafir modunda 1 adet ücretsiz özetleme (Video, Web, PDF) hakkınız var.')
                  : `Bugün kalan yapay zeka özet hakkınız: ${Math.max(0, dailyQuotaLimit - dailyQuotaUsed)}`}
            </p>
          </div>
        </div>
        {isGuest && onOpenAuthModal ? (
          <button
            onClick={onOpenAuthModal}
            className="px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold shrink-0 hover:opacity-90 active:scale-95 transition-all shadow-sm"
          >
            Giriş Yap
          </button>
        ) : !isPremium && onOpenPaywall ? (
          <button
            onClick={onOpenPaywall}
            className="px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold shrink-0 hover:opacity-90 active:scale-95 transition-all shadow-sm"
          >
            Yükselt
          </button>
        ) : null}
      </div>

      {/* Shared Links & Podcast Conversion Queue (Link Havuzu) */}
      <section className="bg-surface-container border border-card-border p-4 rounded-2xl space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                DÖNÜŞTÜRME KUYRUĞU
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white/10 text-primary border border-primary/30">
                  {sharedQueue.length} / {MAX_QUEUE_LIMIT}
                </span>
              </h3>
              <p className="text-[10px] text-on-surface-variant">
                YouTube, X veya Web'den paylaşılan kayıtlı bağlantılar
              </p>
            </div>
          </div>

          {onOpenQueueModal && (
            <button
              id="open-queue-manager-btn"
              onClick={onOpenQueueModal}
              className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
            >
              <span>Yönet</span>
            </button>
          )}
        </div>

        {sharedQueue.length === 0 ? (
          <div className="bg-surface-container-high/40 border border-white/5 rounded-xl p-3 text-center space-y-1">
            <p className="text-xs text-neutral-300 font-medium">Havuzda bekleyen link yok</p>
            <p className="text-[10px] text-neutral-500">
              Safari, YouTube veya X uygulamasında <strong>Paylaş &gt; VOX</strong> diyerek veya link yapıştırarak buraya kaydedebilirsiniz.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sharedQueue.slice(0, 3).map((item) => (
              <div 
                key={item.id}
                className="bg-[#18202b] border border-white/10 rounded-xl p-2.5 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {item.platformName === 'YouTube' ? (
                    <Youtube className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  ) : item.platformName === 'X / Twitter' ? (
                    <Twitter className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  ) : (
                    <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                  <span className="text-xs text-white font-medium truncate">
                    {item.title || item.url}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {onConvertQueueItem && (
                    <button
                      onClick={() => onConvertQueueItem(item)}
                      title="Dönüştür"
                      className="p-1.5 rounded-lg bg-primary text-black font-bold hover:bg-primary/90 text-xs flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-black" />
                      <span className="text-[10px]">Dönüştür</span>
                    </button>
                  )}
                  {onDeleteQueueItem && (
                    <button
                      onClick={() => onDeleteQueueItem(item.id)}
                      title="Sil"
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-white/5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Batch convert / View all button */}
            <div className="flex items-center justify-between pt-1 text-xs">
              {onBatchConvertQueue && sharedQueue.length > 1 && (
                <button
                  onClick={onBatchConvertQueue}
                  className="py-1.5 px-3 bg-gradient-to-r from-primary/20 to-amber-400/20 hover:from-primary/30 hover:to-amber-400/30 border border-primary/40 text-primary font-bold rounded-lg flex items-center gap-1.5 text-[11px] transition-all"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Tümünü Sırayla Dönüştür ({sharedQueue.length})</span>
                </button>
              )}
              {onOpenQueueModal && (
                <button
                  onClick={onOpenQueueModal}
                  className="text-[11px] text-neutral-400 hover:text-white font-medium ml-auto"
                >
                  Tüm Listeyi Gör ({sharedQueue.length}) →
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 4 Main Source Cards */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
          İÇERİK KAYNAĞI SEÇİN
        </h3>

        <div className="grid grid-cols-2 gap-3">
          {/* Card A: Yapıştır */}
          <button
            onClick={() => { triggerHaptic(); setActiveDrawer('paste'); }}
            className={`p-4 rounded-2xl border text-left flex flex-col items-center justify-center gap-2 transition-all ${
              activeDrawer === 'paste'
                ? 'bg-primary/10 border-2 border-primary text-primary shadow-md scale-[1.02]'
                : 'bg-card-bg border-card-border text-on-surface shadow-sm hover:border-primary/50'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center">
              <Clipboard className="w-5 h-5 text-primary" />
            </div>
            <span className="font-display font-bold text-sm">Yapıştır</span>
            <span className="text-[10px] text-on-surface-variant font-mono uppercase">METİN & PANO</span>
          </button>

          {/* Card B: Web Bağlantısı */}
          <button
            onClick={() => { triggerHaptic(); setActiveDrawer('web'); }}
            className={`p-4 rounded-2xl border text-left flex flex-col items-center justify-center gap-2 transition-all ${
              activeDrawer === 'web'
                ? 'bg-primary/10 border-2 border-primary text-primary shadow-md scale-[1.02]'
                : 'bg-card-bg border-card-border text-on-surface shadow-sm hover:border-primary/50'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center">
              <Link2 className="w-5 h-5 text-primary" />
            </div>
            <span className="font-display font-bold text-sm">Web Bağlantısı</span>
            <span className="text-[10px] text-on-surface-variant font-mono uppercase">URL AYIKLAMA</span>
          </button>

          {/* Card C: PDF / Yerel Depolama */}
          <button
            onClick={() => { triggerHaptic(); setActiveDrawer('pdf'); }}
            className={`p-4 rounded-2xl border text-left flex flex-col items-center justify-center gap-2 transition-all ${
              activeDrawer === 'pdf'
                ? 'bg-primary/10 border-2 border-primary text-primary shadow-md scale-[1.02]'
                : 'bg-card-bg border-card-border text-on-surface shadow-sm hover:border-primary/50'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <span className="font-display font-bold text-sm">PDF & Belge</span>
            <span className="text-[10px] text-on-surface-variant font-mono uppercase">ÇEVRİMDİŞİ HAFIZA</span>
          </button>

          {/* Card D: YouTube Videosu */}
          <button
            onClick={() => { triggerHaptic(); setActiveDrawer('youtube'); }}
            className={`p-4 rounded-2xl border text-left flex flex-col items-center justify-center gap-2 transition-all ${
              activeDrawer === 'youtube'
                ? 'bg-primary/10 border-2 border-primary text-primary shadow-md scale-[1.02]'
                : 'bg-card-bg border-card-border text-on-surface shadow-sm hover:border-primary/50'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center">
              <Youtube className="w-5 h-5 text-red-500" />
            </div>
            <span className="font-display font-bold text-sm">YouTube Videosu</span>
            <span className="text-[10px] text-on-surface-variant font-mono uppercase">VİDEO LİNKİ</span>
          </button>
        </div>
      </section>

      {/* DRAWER PANELS (Smooth slide-down animation) */}
      <section className="bg-surface-container border border-card-border p-5 rounded-2xl space-y-4 shadow-md">

        {/* 📋 DRAWER 1: YAPIŞTIR (Clipboard & Direct Text Paste) */}
        {activeDrawer === 'paste' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>PANO VE METİN YAPIŞTIRMA</span>
              </div>
              <button
                onClick={handlePasteFromClipboard}
                className="text-[11px] font-bold text-primary bg-primary/10 border border-primary/30 px-3 py-1 rounded-full flex items-center gap-1 hover:bg-primary/20"
              >
                <Clipboard className="w-3 h-3" />
                <span>Panodan Otomatik Çek</span>
              </button>
            </div>

            <textarea
              rows={5}
              placeholder="Panodan kopyaladığınız haber, makale, bülten metnini veya bağlantıyı doğrudan buraya yapıştırın..."
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              className="w-full bg-input-bg border border-input-border rounded-xl p-3.5 text-xs text-on-surface focus:border-primary focus:bg-surface-container focus:outline-none resize-none"
            />

            <div className="bg-surface-variant p-3 rounded-xl flex items-center justify-between text-[11px] text-on-surface-variant">
              <span>Otomatik Paragraf Ayrıştırma & Link Algılama</span>
              <span className="text-primary font-mono font-bold">AKTİF</span>
            </div>

            <button
              onClick={() => handleGenerateSummary('text', pastedText)}
              disabled={loading || !pastedText.trim()}
              className="w-full bg-primary text-on-primary font-bold py-3.5 rounded-full text-xs flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-transform shadow-md"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Bülten Akışı Oluştur</span>
            </button>
          </div>
        )}

        {/* 🌐 DRAWER 2: WEB BAĞLANTISI (URL & Article Extractor) */}
        {activeDrawer === 'web' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                <Link2 className="w-4 h-4" />
                <span>WEB MAKALE ÇÖZÜMLEME</span>
              </div>
              <button
                onClick={handlePasteFromClipboard}
                className="text-[11px] font-bold text-primary bg-primary/10 border border-primary/30 px-3 py-1 rounded-full flex items-center gap-1"
              >
                <Clipboard className="w-3 h-3" />
                <span>Yapıştır</span>
              </button>
            </div>

            <input
              type="url"
              placeholder="https://bbc.com/news/... veya Bloomberg, Evrim Ağacı linki"
              value={webUrl}
              onChange={(e) => setWebUrl(e.target.value)}
              className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3 text-xs text-on-surface focus:border-primary focus:bg-surface-container focus:outline-none"
            />

            <p className="text-[11px] text-on-surface-variant">
              Web sayfasındaki reklam ve çöp kodlar temizlenir, sadece ana içerik sesli bültene dönüştürülür.
            </p>

            <button
              onClick={() => handleGenerateSummary('web', undefined, webUrl)}
              disabled={loading || !webUrl.trim()}
              className="w-full bg-primary text-on-primary font-bold py-3.5 rounded-full text-xs flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-transform shadow-md"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Makale Çözümle & İçe Aktar</span>
            </button>
          </div>
        )}

        {/* 📄 DRAWER 3: PDF & ON-DEVICE LOCAL STORAGE */}
        {activeDrawer === 'pdf' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                <HardDrive className="w-4 h-4" />
                <span>YEREL BELGE DİNLENME MERKEZİ</span>
              </div>
              <span className="text-[10px] font-mono text-primary bg-primary/20 px-2 py-0.5 rounded-full">
                0 MB BULUT
              </span>
            </div>

            {/* Drag Drop Area */}
            <label className="border-2 border-dashed border-card-border hover:border-primary/50 bg-surface-variant rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors">
              <UploadCloud className="w-8 h-8 text-primary animate-bounce" />
              <span className="text-xs font-bold text-on-surface">Cihazdan PDF / TXT / EPUB Yükle</span>
              <span className="text-[10px] text-primary font-medium text-center">
                Maksimum 50 sayfa desteklenmektedir. İçerik ve seslendirme cihazınızda çevrimdışı depolanır.
              </span>
              <input type="file" accept=".pdf,.epub,.txt,.md" onChange={handleFileUpload} className="hidden" />
            </label>

            {/* Storage indicator */}
            <div className="bg-surface-variant border border-card-border p-3.5 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-on-surface-variant">Cihaz Bellek Kullanımı:</span>
                <span className="font-mono font-bold text-primary">{localFiles.length} Belge ({totalKbUsed} KB)</span>
              </div>
              <div className="w-full bg-input-bg h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all"
                  style={{ width: `${Math.min(100, (totalKbUsed / 1024) * 10)}%` }}
                />
              </div>

              {localFiles.length > 0 && (
                <button
                  onClick={handleClearLocalStorage}
                  className="mt-2 text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Cihaz Belleğini Boşalt ({localFiles.length} Dosya)</span>
                </button>
              )}
            </div>

            {/* Render saved local files */}
            {localFiles.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-on-surface-variant uppercase">YÜKLÜ BELGELER:</h4>
                {localFiles.map(file => (
                  <div key={file.id} className="bg-surface-variant border border-card-border p-3 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold truncate max-w-[200px] text-on-surface">{file.name}</p>
                      <span className="text-[10px] text-on-surface-variant">{file.sizeKb} KB • Yerel Okuma Hazır</span>
                    </div>
                    <button
                      onClick={() => handleGenerateSummary('pdf', file.text, file.name, (file as any).pageCount)}
                      className="bg-primary/20 text-primary border border-primary/30 px-3 py-1 rounded-lg text-xs font-bold hover:bg-primary/30"
                    >
                      Bülten Yap
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 📺 DRAWER 4: YOUTUBE SINGLE VIDEO LINK */}
        {activeDrawer === 'youtube' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <Youtube className="w-4 h-4 text-red-500" />
                  YouTube Video Bağlantısı
                </label>
                <button
                  onClick={handlePasteFromClipboard}
                  className="text-[11px] font-bold text-red-500 bg-red-500/10 border border-red-500/30 px-2.5 py-1 rounded-full hover:bg-red-500/20"
                >
                  📋 Panodan Otomatik Çek
                </button>
              </div>

              <input
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                className="w-full bg-input-bg border border-input-border rounded-xl px-3.5 py-2.5 text-xs text-on-surface focus:border-red-500 focus:outline-none"
              />

              {/* Live Thumbnail Preview */}
              {youtubeVideoId && (
                <div className="relative aspect-video rounded-xl overflow-hidden border border-red-500/30 group">
                  <img 
                    src={`https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`} 
                    alt="YouTube Thumbnail" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                      <Play className="w-6 h-6 text-white fill-current ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                    YouTube Video Algılandı
                  </div>
                </div>
              )}

              {/* Optional Custom Title */}
              <div>
                <label className="text-[11px] text-on-surface-variant block mb-1">Özelleştirilmiş Başlık (Opsiyonel):</label>
                <input
                  type="text"
                  placeholder="Örn: Nevşin Mengü - Günün Özeti"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full bg-input-bg border border-input-border rounded-xl px-3.5 py-2 text-xs text-on-surface focus:border-primary focus:outline-none"
                />
              </div>

              {/* Optional Manual Transcript */}
              <div>
                <label className="text-[11px] text-on-surface-variant block mb-1">Deşifre / Alt Yazı Dökümü (Opsiyonel):</label>
                <textarea
                  rows={2}
                  placeholder="YouTube'dan kopyalanan alt yazıları yapıştırın..."
                  value={manualTranscript}
                  onChange={(e) => setManualTranscript(e.target.value)}
                  className="w-full bg-input-bg border border-input-border rounded-xl px-3.5 py-2 text-xs text-on-surface focus:border-primary focus:outline-none resize-none"
                />
              </div>

              {/* Dropdowns for Focus Area & Summary Length */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-on-surface-variant block mb-1">Videonun Odak Noktası:</label>
                  <div className="relative">
                    <select
                      value={focusArea}
                      onChange={(e) => setFocusArea(e.target.value)}
                      className="w-full bg-input-bg border border-input-border rounded-xl px-3.5 py-2.5 text-xs text-on-surface appearance-none focus:border-red-500 focus:outline-none pr-8"
                    >
                      <option value="Genel Özet & Detaylar">Genel Özet & Detaylar</option>
                      <option value="Teknoloji & İnovasyon">Teknoloji & İnovasyon</option>
                      <option value="Siyaset & Gündem Analizi">Siyaset & Gündem Analizi</option>
                      <option value="Finans & Ekonomi">Finans & Ekonomi</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-on-surface-variant absolute right-2.5 top-3 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-on-surface-variant block mb-1">Özet Uzunluğu:</label>
                  <div className="relative">
                    <select
                      value={summaryLength}
                      onChange={(e) => setSummaryLength(e.target.value)}
                      className="w-full bg-input-bg border border-input-border rounded-xl px-3.5 py-2.5 text-xs text-on-surface appearance-none focus:border-red-500 focus:outline-none pr-8"
                    >
                      <option value="Çok Kısa Özet (Max 5 DK / 2 Segment)">Çok Kısa Özet (Max 5 DK / 2 Segment)</option>
                      <option value="Normal Özet (Yarı Süreye Kadar / 3 Segment)">Normal Özet (Yarı Süreye Kadar / 3 Segment)</option>
                      <option value="Detaylı Özet (Kapsamlı Analiz / 4 Segment)">Detaylı Özet (Kapsamlı Analiz / 4 Segment)</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-on-surface-variant absolute right-2.5 top-3 pointer-events-none" />
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleGenerateSummary('youtube', undefined, youtubeUrl)}
                disabled={loading || !youtubeUrl.trim()}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3.5 rounded-full text-xs flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-transform shadow-md"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>Özel YouTube Bülteni Oluştur</span>
              </button>
            </div>
          </div>
        )}

        {/* Error notification */}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded-xl text-xs">
            {errorMsg}
          </div>
        )}

      </section>
    </div>
  );
};
