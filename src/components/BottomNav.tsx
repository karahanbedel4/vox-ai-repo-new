import React from 'react';
import { motion } from 'motion/react';
import { Newspaper, Headphones, Plus, Moon, Sun } from 'lucide-react';
import { TabType } from '../types';
import { triggerHapticImpact } from '../lib/haptics';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  isPlaying?: boolean;
  isHidden?: boolean;
  themeMode?: 'dark' | 'light' | 'system';
  onToggleTheme?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ 
  activeTab, 
  onChangeTab, 
  isPlaying, 
  isHidden = false,
  themeMode = 'dark',
  onToggleTheme
}) => {
  const handleTabClick = (tabId: TabType) => {
    triggerHapticImpact('light').catch(() => {});
    onChangeTab(tabId);
  };

  const handleThemeClick = () => {
    triggerHapticImpact('medium').catch(() => {});
    if (onToggleTheme) {
      onToggleTheme();
    }
  };

  const isLight = themeMode === 'light';

  return (
    <nav 
      className={`fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,12px))] left-3 right-3 z-40 max-w-[360px] sm:max-w-[380px] mx-auto transition-all duration-300 ease-out ${
        isHidden ? 'translate-y-24 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
      }`}
    >
      {/* iOS Liquid Glass Floating Capsule Dock */}
      <div className="relative bg-black/65 dark:bg-[#0c1015]/80 backdrop-blur-2xl border border-white/15 dark:border-white/10 rounded-full shadow-[0_16px_40px_rgba(0,0,0,0.55)] p-1.5 flex items-center justify-between gap-1 text-white">
        
        {/* 1. GÜNDEM (Haber Akışı) */}
        <button
          onClick={() => handleTabClick('read')}
          className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-full text-xs transition-all duration-200 ${
            activeTab === 'read' ? 'text-white font-bold' : 'text-white/60 hover:text-white/90'
          }`}
        >
          {activeTab === 'read' && (
            <motion.div
              layoutId="liquidGlassTabPill"
              className="absolute inset-0 bg-emerald-500/25 border border-emerald-400/40 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)] z-0"
              transition={{ type: "spring", stiffness: 480, damping: 32 }}
            />
          )}
          <div className="relative z-10 flex items-center gap-1.5">
            <Newspaper className={`w-4 h-4 transition-transform duration-200 ${activeTab === 'read' ? 'scale-110 text-emerald-400' : ''}`} />
            <span className="tracking-tight text-[11px]">Gündem</span>
          </div>
        </button>

        {/* 2. EKLE (İçerik Dönüştür FAB) */}
        <button
          onClick={() => handleTabClick('add')}
          className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-full text-xs transition-all duration-200 ${
            activeTab === 'add' ? 'text-white font-bold' : 'text-white/60 hover:text-white/90'
          }`}
        >
          {activeTab === 'add' && (
            <motion.div
              layoutId="liquidGlassTabPill"
              className="absolute inset-0 bg-emerald-500/25 border border-emerald-400/40 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)] z-0"
              transition={{ type: "spring", stiffness: 480, damping: 32 }}
            />
          )}
          <div className="relative z-10 flex items-center gap-1.5">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center ${activeTab === 'add' ? 'bg-emerald-400 text-black' : 'bg-white/20 text-white'}`}>
              <Plus className="w-3 h-3 stroke-[3]" />
            </div>
            <span className="tracking-tight text-[11px]">Ekle</span>
          </div>
        </button>

        {/* 3. DİNLE (Müzik & Kitaplık & Podcast) */}
        <button
          onClick={() => handleTabClick('listen')}
          className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-full text-xs transition-all duration-200 ${
            activeTab === 'listen' ? 'text-white font-bold' : 'text-white/60 hover:text-white/90'
          }`}
        >
          {activeTab === 'listen' && (
            <motion.div
              layoutId="liquidGlassTabPill"
              className="absolute inset-0 bg-emerald-500/25 border border-emerald-400/40 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)] z-0"
              transition={{ type: "spring", stiffness: 480, damping: 32 }}
            />
          )}
          <div className="relative z-10 flex items-center gap-1.5">
            <div className="relative">
              <Headphones className={`w-4 h-4 transition-transform duration-200 ${activeTab === 'listen' ? 'scale-110 text-emerald-400' : ''}`} />
              {isPlaying && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981] animate-ping" />
              )}
            </div>
            <span className="tracking-tight text-[11px]">Dinle</span>
          </div>
        </button>

        {/* 4. KARANLIK / AYDINLIK MOD GEÇİŞ BUTONU */}
        <button
          onClick={handleThemeClick}
          title={isLight ? 'Karanlık Moda Geç' : 'Aydınlık Moda Geç'}
          className="relative w-10 h-10 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all active:scale-90 shrink-0 border border-white/10"
        >
          <motion.div
            key={isLight ? 'sun' : 'moon'}
            initial={{ rotate: -90, scale: 0.6, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 90, scale: 0.6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
          >
            {isLight ? (
              <Sun className="w-4 h-4 text-amber-400 fill-amber-400/20" />
            ) : (
              <Moon className="w-4 h-4 text-emerald-300" />
            )}
          </motion.div>
        </button>

      </div>
    </nav>
  );
};
