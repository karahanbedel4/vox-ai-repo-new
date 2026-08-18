import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Youtube, 
  Globe, 
  FileText, 
  Clipboard, 
  CheckCircle2, 
  Radio, 
  Mic2, 
  Languages,
  Headphones,
  Zap
} from 'lucide-react';
import { ProgressBar } from './ui/progress-bar';
import { SourceType } from '../types';

interface ConversionProgressModalProps {
  isOpen: boolean;
  sourceType: SourceType;
  sourceTitle?: string;
  sourceUrl?: string;
  onCancel?: () => void;
}

interface StepInfo {
  id: number;
  label: string;
  subLabel: string;
  minProgress: number;
  maxProgress: number;
  icon: React.ReactNode;
}

const STEPS: StepInfo[] = [
  {
    id: 1,
    label: 'Kaynak Doğrulanıyor & Bağlantı Alınıyor',
    subLabel: 'Meta veriler, başlık ve ortam taranıyor...',
    minProgress: 0,
    maxProgress: 22,
    icon: <Globe className="w-4 h-4 text-blue-400" />
  },
  {
    id: 2,
    label: 'Metin & Transkript Çözümleniyor',
    subLabel: 'Ham içerik, alt yazı ve paragraflar ayrıştırılıyor...',
    minProgress: 22,
    maxProgress: 48,
    icon: <FileText className="w-4 h-4 text-amber-400" />
  },
  {
    id: 3,
    label: 'Yapay Zeka Podcast Bülteni Oluşturuluyor',
    subLabel: 'Giriş, gelişme, sonuç ve ana noktalar yapılandırılıyor...',
    minProgress: 48,
    maxProgress: 76,
    icon: <Sparkles className="w-4 h-4 text-indigo-400" />
  },
  {
    id: 4,
    label: 'Çift Dilli (TR 🇹🇷 / EN 🇬🇧) Spiker Akışı',
    subLabel: 'Doğal telaffuz ve akıcı seslendirme metni uyarlanıyor...',
    minProgress: 76,
    maxProgress: 94,
    icon: <Languages className="w-4 h-4 text-emerald-400" />
  },
  {
    id: 5,
    label: 'VOX Stüdyo Dinlemeye Hazırlanıyor',
    subLabel: 'Ses motoru, zaman çizelgesi ve kütüphane senkronize ediliyor...',
    minProgress: 94,
    maxProgress: 100,
    icon: <Headphones className="w-4 h-4 text-primary" />
  }
];

export const ConversionProgressModal: React.FC<ConversionProgressModalProps> = ({
  isOpen,
  sourceType,
  sourceTitle,
  sourceUrl,
}) => {
  const [progress, setProgress] = useState<number>(6);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  // Progressive progress bar simulation while waiting for async AI completion
  useEffect(() => {
    if (!isOpen) {
      setProgress(6);
      setCurrentStepIndex(0);
      return;
    }

    setProgress(8);
    setCurrentStepIndex(0);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 20) return prev + Math.floor(Math.random() * 4 + 3);
        if (prev < 45) return prev + Math.floor(Math.random() * 3 + 2);
        if (prev < 72) return prev + Math.floor(Math.random() * 2 + 1);
        if (prev < 92) return prev + (Math.random() > 0.4 ? 1 : 0);
        if (prev < 98) return prev + (Math.random() > 0.7 ? 1 : 0);
        return 98; // Hold near completion until backend responds
      });
    }, 450);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Determine current active step based on progress
  useEffect(() => {
    const idx = STEPS.findIndex(
      (s) => progress >= s.minProgress && progress <= s.maxProgress
    );
    if (idx !== -1) {
      setCurrentStepIndex(idx);
    }
  }, [progress]);

  if (!isOpen) return null;

  const currentStep = STEPS[currentStepIndex] || STEPS[0];

  const getSourceBadge = () => {
    switch (sourceType) {
      case 'youtube':
        return {
          icon: <Youtube className="w-4 h-4 text-red-500" />,
          title: 'YouTube Video & Podcast',
          color: 'border-red-500/30 bg-red-500/10 text-red-500'
        };
      case 'web':
        return {
          icon: <Globe className="w-4 h-4 text-blue-500" />,
          title: 'Web Makalesi & Haber',
          color: 'border-blue-500/30 bg-blue-500/10 text-blue-500'
        };
      case 'pdf':
        return {
          icon: <FileText className="w-4 h-4 text-amber-500" />,
          title: 'PDF & Akademik Belge',
          color: 'border-amber-500/30 bg-amber-500/10 text-amber-500'
        };
      default:
        return {
          icon: <Clipboard className="w-4 h-4 text-indigo-500" />,
          title: 'Metin & Pano İçeriği',
          color: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-500'
        };
    }
  };

  const badge = getSourceBadge();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-md bg-surface-container border border-card-border rounded-3xl p-6 shadow-2xl space-y-6 text-on-surface overflow-hidden relative"
        >
          {/* Background Ambient Glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header & Source Badge */}
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${badge.color}`}>
              {badge.icon}
              <span>{badge.title}</span>
            </div>

            <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full text-[11px] font-bold text-primary">
              <Radio className="w-3 h-3 animate-pulse" />
              <span>VOX Stüdyo AI</span>
            </div>
          </div>

          {/* Target Title / Info */}
          <div className="space-y-1">
            <h3 className="font-display font-bold text-base text-on-surface line-clamp-1">
              {sourceTitle || (sourceUrl ? sourceUrl.replace(/^https?:\/\/(www\.)?/, '') : 'İçerik Podcaste Dönüştürülüyor')}
            </h3>
            <p className="text-xs text-on-surface-variant line-clamp-1">
              {currentStep.subLabel}
            </p>
          </div>

          {/* Center Soundwave & AI Processing Indicator */}
          <div className="relative py-3 flex flex-col items-center justify-center bg-surface-variant/40 rounded-2xl border border-card-border p-4">
            <div className="flex items-center gap-1.5 h-10 mb-2">
              {[40, 75, 55, 90, 60, 100, 70, 85, 45, 95, 65, 80, 50].map((h, i) => (
                <motion.span
                  key={i}
                  animate={{
                    height: [
                      `${Math.max(15, h * 0.25)}%`,
                      `${h}%`,
                      `${Math.max(20, h * 0.35)}%`
                    ]
                  }}
                  transition={{
                    duration: 0.8 + (i % 4) * 0.2,
                    repeat: Infinity,
                    repeatType: 'reverse',
                    ease: 'easeInOut',
                    delay: (i * 0.06)
                  }}
                  className="w-1.5 bg-gradient-to-t from-primary/60 to-primary rounded-full origin-center"
                />
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Mic2 className="w-3.5 h-3.5 animate-bounce" />
              <span>Yapay zeka ses bülteni hazırlanıyor</span>
            </div>
          </div>

          {/* Progress Bar Component */}
          <div className="space-y-2">
            <ProgressBar
              value={progress}
              max={100}
              label={currentStep.label}
              pendingLabel="İşleniyor"
              completeLabel="Hazırlandı"
              className="w-full"
            />
          </div>

          {/* Visual Step Checklist */}
          <div className="space-y-2.5 pt-2 border-t border-card-border/60">
            {STEPS.map((step, idx) => {
              const isPassed = progress >= step.maxProgress;
              const isCurrent = currentStepIndex === idx;

              return (
                <motion.div
                  key={step.id}
                  initial={false}
                  animate={{
                    opacity: isPassed ? 0.7 : isCurrent ? 1 : 0.4,
                    x: isCurrent ? 4 : 0
                  }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-center justify-between text-xs py-1 px-2 rounded-lg transition-colors ${
                    isCurrent ? 'bg-primary/10 border border-primary/20' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 flex items-center justify-center shrink-0">
                      {isPassed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : isCurrent ? (
                        <Zap className="w-4 h-4 text-primary animate-spin" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-stone-500/40" />
                      )}
                    </div>
                    <span className={`font-medium ${isCurrent ? 'text-on-surface font-bold' : 'text-on-surface-variant'}`}>
                      {step.label}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono text-on-surface-variant shrink-0">
                    {isPassed ? '✓' : isCurrent ? `${progress}%` : ''}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {/* Footer Note */}
          <div className="text-center">
            <p className="text-[11px] text-on-surface-variant">
              İşlem bittiğinde bülteniniz doğrudan sesli oynatıcıda açılacaktır.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ConversionProgressModal;
