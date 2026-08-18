import React, { useState, useEffect, useRef } from 'react';
import { 
  Timer, 
  Play, 
  Pause, 
  RotateCcw, 
  X, 
  CheckCircle2, 
  Bell, 
  Sparkles, 
  Coffee, 
  Flame, 
  CloudRain,
  Volume2
} from 'lucide-react';
import { Haptics, ImpactStyle, NotificationType, triggerHapticImpact, triggerHapticNotification } from '../lib/haptics';
import { woodRainSynth } from '../lib/audioSynth';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export interface PomodoroModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartAmbientWithFocus?: () => void;
  isAmbientActive?: boolean;
}

type PomodoroMode = 'focus' | 'shortBreak' | 'longBreak';

const MODE_DURATIONS: Record<PomodoroMode, number> = {
  focus: 25 * 60, // 25 minutes (1500 sec)
  shortBreak: 5 * 60, // 5 minutes (300 sec)
  longBreak: 15 * 60 // 15 minutes (900 sec)
};

export const PomodoroModal: React.FC<PomodoroModalProps> = ({
  isOpen,
  onClose,
  onStartAmbientWithFocus,
  isAmbientActive = false
}) => {
  const [mode, setMode] = useState<PomodoroMode>('focus');
  const [timeLeft, setTimeLeft] = useState<number>(MODE_DURATIONS.focus);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [completedSessions, setCompletedSessions] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  const totalDuration = MODE_DURATIONS[mode];
  const progressPercent = Math.min(100, Math.max(0, ((totalDuration - timeLeft) / totalDuration) * 100));

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Switch modes
  const handleSelectMode = (newMode: PomodoroMode) => {
    triggerHapticImpact('light');
    setMode(newMode);
    setIsActive(false);
    setIsFinished(false);
    setTimeLeft(MODE_DURATIONS[newMode]);
  };

  // Start / Pause
  const handleToggleTimer = () => {
    try {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    } catch {
      triggerHapticImpact('light');
    }

    if (!isActive && isFinished) {
      setIsFinished(false);
      setTimeLeft(totalDuration);
    }
    setIsActive(!isActive);

    // If starting focus mode and ambient is not active, offer/start ambient
    if (!isActive && mode === 'focus' && onStartAmbientWithFocus && !isAmbientActive) {
      onStartAmbientWithFocus();
    }
  };

  // Reset
  const handleReset = () => {
    triggerHapticImpact('light');
    setIsActive(false);
    setIsFinished(false);
    setTimeLeft(MODE_DURATIONS[mode]);
  };

  // Countdown effect
  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current as NodeJS.Timeout);
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeLeft]);

  // When timer reaches 0
  const handleTimerComplete = async () => {
    setIsActive(false);
    setIsFinished(true);

    if (mode === 'focus') {
      setCompletedSessions((prev) => prev + 1);
    }

    // 1. Play soothing crystal bell chime sound
    woodRainSynth.playBellChime();

    // 2. Trigger Haptics Notification Success
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch (e) {
      await triggerHapticNotification('success');
    }

    // 3. Local Push Notification
    try {
      if (Capacitor.isNativePlatform()) {
        const hasPerm = await LocalNotifications.checkPermissions();
        if (hasPerm.display === 'granted') {
          await LocalNotifications.schedule({
            notifications: [
              {
                id: Date.now() % 100000,
                title: mode === 'focus' ? '🎉 Odaklanma Seansı Tamamlandı!' : '☕ Mola Süresi Bitti!',
                body: mode === 'focus' 
                  ? 'Harika bir 25 dakikalık odaklanma tamamladın. Şimdi 5 dakikalık bir mola verebilirsin.' 
                  : 'Mola bitti! Yeni bir odaklanma seansına hazır mısın?',
                schedule: { at: new Date(Date.now() + 100) },
                sound: 'default'
              }
            ]
          });
        }
      } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(mode === 'focus' ? '🎉 Odaklanma Seansı Tamamlandı!' : '☕ Mola Bitti!', {
          body: mode === 'focus' ? '25 dakikalık odak seansın bitti. Harika iş çıkardın!' : 'Mola süresi tamamlandı.'
        });
      }
    } catch (e) {
      console.warn('Pomodoro notification error:', e);
    }
  };

  // Format MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Circular progress SVG constants (radius 76, circumference 2 * PI * 76 = 477.52)
  const radius = 76;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-surface-container border border-card-border rounded-t-3xl sm:rounded-3xl p-6 space-y-6 shadow-2xl text-on-surface cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-card-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shadow-sm">
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-on-surface">
                Pomodoro Odaklanma Zamanlayıcısı
              </h3>
              <p className="text-xs text-on-surface-variant font-medium">
                {completedSessions > 0 ? `${completedSessions} Seans Tamamlandı` : '25 Dk Odaklanma & 5 Dk Mola'}
              </p>
            </div>
          </div>
          <button 
            onClick={() => { triggerHapticImpact('light'); onClose(); }}
            className="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center hover:bg-card-border text-on-surface transition-colors active:scale-90"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-3 gap-2 bg-surface-container-high p-1.5 rounded-2xl border border-white/5 shadow-inner">
          <button
            onClick={() => handleSelectMode('focus')}
            className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              mode === 'focus'
                ? 'bg-primary text-on-primary shadow-md'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>25 Dk Odak</span>
          </button>

          <button
            onClick={() => handleSelectMode('shortBreak')}
            className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              mode === 'shortBreak'
                ? 'bg-teal-400 text-slate-950 shadow-md'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>5 Dk Mola</span>
          </button>

          <button
            onClick={() => handleSelectMode('longBreak')}
            className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              mode === 'longBreak'
                ? 'bg-indigo-400 text-slate-950 shadow-md'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>15 Dk Mola</span>
          </button>
        </div>

        {/* Circular Countdown Display */}
        <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
          <svg className="w-48 h-48 -rotate-90 transform" viewBox="0 0 180 180">
            {/* Track */}
            <circle
              cx="90"
              cy="90"
              r={radius}
              className="text-white/10 stroke-current"
              strokeWidth="8"
              fill="transparent"
            />
            {/* Progress */}
            <circle
              cx="90"
              cy="90"
              r={radius}
              className={`transition-all duration-500 ease-out stroke-current ${
                isFinished 
                  ? 'text-amber-400' 
                  : (mode === 'focus' ? 'text-primary' : 'text-teal-400')
              }`}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>

          {/* Center Timer Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {isFinished ? (
              <div className="animate-bounce flex flex-col items-center">
                <CheckCircle2 className="w-8 h-8 text-amber-400 mb-1" />
                <span className="font-display font-extrabold text-sm text-amber-400">
                  TAMAMLANDI!
                </span>
              </div>
            ) : (
              <>
                <span className="font-display text-4xl font-black tracking-tight tabular-nums text-on-surface">
                  {formatTime(timeLeft)}
                </span>
                <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mt-1">
                  {mode === 'focus' ? 'ODAKLANMA' : 'MOLA ZAMANI'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Control Buttons (Oynat / Durdur / Sıfırla) */}
        <div className="flex items-center justify-center gap-4 pt-1">
          <button
            onClick={handleReset}
            className="w-12 h-12 rounded-2xl bg-surface-variant border border-white/10 text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-all active:scale-90"
            title="Sıfırla"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={handleToggleTimer}
            className={`px-8 py-3.5 rounded-2xl font-display font-bold text-sm flex items-center gap-2.5 shadow-xl transition-all active:scale-95 ${
              isActive
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                : 'bg-primary text-on-primary hover:brightness-110 shadow-[0_0_20px_rgba(78,222,163,0.3)]'
            }`}
          >
            {isActive ? (
              <>
                <Pause className="w-5 h-5 fill-current" />
                <span>Duraklat</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current ml-0.5" />
                <span>{isFinished ? 'Yeniden Başlat' : 'Odaklanmayı Başlat'}</span>
              </>
            )}
          </button>
        </div>

        {/* Completion Info Note */}
        <div className="bg-surface-variant/40 border border-white/5 p-3 rounded-2xl flex items-center justify-between text-xs text-on-surface-variant">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary shrink-0" />
            <span>Süre bitince titreşim ve kristal zil sesi çalar.</span>
          </div>
          <span className="text-[10px] font-bold bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full">
            HAPTICS
          </span>
        </div>
      </div>
    </div>
  );
};
