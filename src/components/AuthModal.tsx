import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Mail, Lock, X, CheckCircle2, AlertCircle, RefreshCw, LogIn, UserPlus, ShieldCheck } from 'lucide-react';
import { auth, googleProvider, signInWithGoogle, signInWithApple, signInAsGuest, robustEmailSignIn, robustEmailSignUp, syncUserProfile } from '../lib/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { appStorage } from '../lib/storage';
import { VoxLogo } from './VoxLogo';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess?: () => void;
  reason?: 'guest_limit' | 'general';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  reason = 'guest_limit'
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Check if Apple Sign In is applicable (iOS native or Apple platform)
  const isAppleSupported = Capacitor.isNativePlatform() || (typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent));

  // Listen for global auth changes (e.g. Safari redirect / OAuth callback)
  useEffect(() => {
    const handleAuthChanged = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (customEvt?.detail) {
        setLoading(false);
        if (onAuthSuccess) onAuthSuccess();
        onClose();
      }
    };
    window.addEventListener('vox_auth_changed', handleAuthChanged);
    return () => {
      window.removeEventListener('vox_auth_changed', handleAuthChanged);
    };
  }, [onAuthSuccess, onClose]);

  if (!isOpen) return null;

  const handleGoogleAuth = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await signInWithGoogle();
      if (res?.user) {
        await syncUserProfile(res.user);
        if (onAuthSuccess) onAuthSuccess();
        onClose();
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        setLoading(false);
        return;
      }
      setErrorMsg((err as Error)?.message || 'Google ile giriş yapılamadı. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleAuth = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await signInWithApple();
      if (res?.user) {
        await syncUserProfile(res.user);
        if (onAuthSuccess) onAuthSuccess();
        onClose();
      }
    } catch (err: any) {
      if (
        err?.code === 'auth/popup-closed-by-user' || 
        err?.code === 'auth/cancelled-popup-request' || 
        String(err?.message || '').includes('iptal') || 
        String(err?.message || '').includes('canceled')
      ) {
        setLoading(false);
        return;
      }
      setErrorMsg((err as Error)?.message || 'Apple ile giriş yapılamadı. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestAuth = async () => {
    if (reason === 'guest_limit') {
      setErrorMsg('1 ücretsiz misafir hakkınızı tamamladınız. Devam etmek için lütfen kaydolun veya giriş yapın.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await signInAsGuest();
      if (onAuthSuccess) onAuthSuccess();
      onClose();
    } catch (err: any) {
      console.error('Misafir girişi hatası:', err);
      setErrorMsg((err as Error)?.message || 'Misafir girişi başarısız oldu.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Lütfen e-posta ve şifrenizi girin.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Şifreniz en az 6 karakter olmalıdır.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (mode === 'register') {
        await robustEmailSignUp(email, password);
      } else {
        await robustEmailSignIn(email, password);
      }
      if (onAuthSuccess) onAuthSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Kimlik doğrulama hatası. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md bg-surface-container/95 border border-primary/30 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(78,222,163,0.15)] flex flex-col text-on-surface"
        >
          {/* Top Banner Header */}
          <div className="relative p-6 bg-gradient-to-b from-primary/20 via-surface-container to-surface-container text-center border-b border-white/10 space-y-2">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex justify-center mb-1">
              <VoxLogo className="h-8 w-auto" variant="dark" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 border border-primary/40 text-[11px] font-bold text-primary uppercase tracking-widest shadow-[0_0_15px_rgba(78,222,163,0.3)]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{reason === 'guest_limit' ? 'MİSAFİR DENEME LİMİTİ' : 'VOX ÜYELİK'}</span>
            </div>

            <h2 className="font-display text-2xl font-black tracking-tight text-white leading-tight">
              {reason === 'guest_limit' 
                ? 'Misafir Özetleme Limitine Ulaştınız' 
                : 'Devam Etmek İçin Giriş Yapın'}
            </h2>

            <p className="text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">
              {reason === 'guest_limit'
                ? 'Misafir modundaki 1 ücretsiz özetleme hakkınızı kullandınız. Web, YouTube ve PDF bültenlerini özetlemeye ücretsiz devam etmek için giriş yapın.'
                : 'Hesabınızla giriş yaparak tüm özet bültenlerinizi cihazlarınız arasında senkronize edin.'}
            </p>
          </div>

          {/* Form Content Body */}
          <div className="p-6 space-y-4 text-xs">
            {/* Success Banner */}
            {successMsg && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl flex items-center gap-2.5 text-emerald-200 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Error Banner */}
            {errorMsg && (
              <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-2xl flex items-center gap-2.5 text-rose-200 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Social Buttons Container */}
            <div className="space-y-2.5">
              {/* Apple Sign In (App Store Guideline 4.8 Compliance) */}
              {isAppleSupported && (
                <button
                  onClick={handleAppleAuth}
                  disabled={loading}
                  className="w-full py-3.5 px-4 bg-black hover:bg-neutral-900 text-white font-bold rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 border border-white/20 shadow-md disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <svg className="w-4 h-4 fill-white shrink-0" viewBox="0 0 170 170">
                      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.67-7.81-11.96-14.34-5.78-8.8-10.3-18.78-13.56-29.93-3.26-11.16-4.89-22.08-4.89-32.77 0-14.35 3.69-26.3 11.07-35.86 7.38-9.57 16.63-14.46 27.75-14.67 4.57 0 9.78 1.25 15.63 3.75 5.86 2.5 9.73 3.81 11.61 3.93 1.63-.12 5.72-1.5 12.28-4.14 6.57-2.63 12.16-3.84 16.78-3.63 12.83.65 23.04 5.38 30.63 14.19-11.09 6.74-16.52 16.08-16.3 28.03.22 9.57 3.8 17.59 10.76 24.07 6.96 6.47 15.11 10.16 24.45 11.07-2.17 6.52-4.78 13.04-7.82 19.57zM119.22 31.84c0-7.18 2.61-13.9 7.82-20.17 5.22-6.27 11.52-10.16 18.91-11.67 1.09 7.83-1.08 14.78-6.52 20.87-5.43 6.09-12.17 9.78-20.21 11.07z" />
                    </svg>
                  )}
                  <span>{loading ? 'İşleniyor...' : 'Apple ile Giriş Yap'}</span>
                </button>
              )}

              {/* Quick One-Click Google Auth */}
              <button
                onClick={handleGoogleAuth}
                disabled={loading}
                className="w-full py-3.5 px-4 bg-white hover:bg-neutral-100 text-neutral-900 font-bold rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-md disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-neutral-900" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                )}
                <span>{loading ? 'İşleniyor...' : 'Google ile Giriş Yap'}</span>
              </button>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <div className="h-[1px] bg-white/10 flex-1"></div>
              <span className="text-[10px] text-on-surface-variant font-mono uppercase">Veya E-posta İle</span>
              <div className="h-[1px] bg-white/10 flex-1"></div>
            </div>

            {/* Mode Switch Tabs */}
            <div className="flex bg-surface-container-high/60 p-1 rounded-2xl border border-white/5">
              <button
                onClick={() => { setMode('register'); setErrorMsg(null); }}
                className={`flex-1 py-2 text-center rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                  mode === 'register' 
                    ? 'bg-primary text-on-primary shadow-sm' 
                    : 'text-on-surface-variant hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Ücretsiz Kaydol</span>
              </button>
              <button
                onClick={() => { setMode('login'); setErrorMsg(null); }}
                className={`flex-1 py-2 text-center rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                  mode === 'login' 
                    ? 'bg-primary text-on-primary shadow-sm' 
                    : 'text-on-surface-variant hover:text-white'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Giriş Yap</span>
              </button>
            </div>

            {/* Email & Password Input Form */}
            <form onSubmit={handleEmailAuth} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-on-surface-variant block">E-posta Adresi</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3 text-on-surface-variant" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@email.com"
                    className="w-full bg-surface-container-high/80 border border-white/10 focus:border-primary/60 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-on-surface-variant/50 outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-on-surface-variant block">Şifre</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3 text-on-surface-variant" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-surface-container-high/80 border border-white/10 focus:border-primary/60 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-on-surface-variant/50 outline-none transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-primary text-on-primary font-bold text-xs rounded-2xl shadow-[0_0_20px_rgba(78,222,163,0.3)] hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>İşleniyor...</span>
                  </>
                ) : (
                  <span>{mode === 'register' ? 'Ücretsiz Hesabımı Oluştur' : 'Giriş Yap & Devam Et'}</span>
                )}
              </button>
            </form>

            <div className="flex flex-col items-center justify-center gap-2 pt-1 text-[10px] text-on-surface-variant/70">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                <span>%100 Ücretsiz Kayıt • Kredi kartı gerekmez</span>
              </div>
              <button
                type="button"
                onClick={handleGuestAuth}
                disabled={loading}
                className="text-primary hover:underline font-medium text-xs mt-1 transition-all"
              >
                Misafir Olarak Devam Et (Giriş Yapmadan)
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
