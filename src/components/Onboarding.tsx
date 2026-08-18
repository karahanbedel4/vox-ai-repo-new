import React, { useState, useEffect } from 'react';
import { Headphones, ArrowRight, Play, Mail, Rss, Stars, LogIn, UserCheck, ShieldCheck, Sparkles, X, RefreshCw, AlertCircle } from 'lucide-react';
import { 
  auth, 
  googleProvider, 
  signInWithGoogle,
  signInAsGuest,
  signInWithPopup, 
  signInAnonymously, 
  robustEmailSignIn,
  robustEmailSignUp,
  syncUserProfile
} from '../lib/firebase';

interface OnboardingProps {
  onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [slide, setSlide] = useState<number>(0);

  // Auth form states
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Listen for global auth changes (e.g. from Safari redirect / OAuth callback)
  useEffect(() => {
    const handleAuthChanged = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (customEvt?.detail) {
        setAuthLoading(false);
        onComplete();
      }
    };
    window.addEventListener('vox_auth_changed', handleAuthChanged);
    return () => {
      window.removeEventListener('vox_auth_changed', handleAuthChanged);
    };
  }, [onComplete]);

  const nextSlide = () => {
    if (slide < 3) {
      setSlide(slide + 1);
    } else {
      onComplete();
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await signInWithGoogle();
      if (res?.user) {
        await syncUserProfile(res.user);
        onComplete();
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        setAuthLoading(false);
        return;
      }
      console.error('Google Auth Error:', err);
      setAuthError((err as Error)?.message || 'Google ile giriş yapılırken bir sorun oluştu. Lütfen tekrar deneyin.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInAsGuest();
      onComplete();
    } catch (err: any) {
      console.error('Guest Auth Error:', err);
      setAuthError((err as Error)?.message || 'Misafir girişi yapılırken bir hata oluştu.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent, isRegister: boolean) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) {
      setAuthError('Lütfen e-posta ve şifrenizi girin.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      if (isRegister) {
        await robustEmailSignUp(emailInput, passwordInput);
      } else {
        await robustEmailSignIn(emailInput, passwordInput);
      }
      onComplete();
    } catch (err: unknown) {
      setAuthError((err as Error).message || 'Giriş yapılamadı.');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-on-surface flex flex-col justify-between select-none overflow-y-auto font-sans">
      {/* Top Header */}
      <header className="flex justify-between items-center px-6 pt-10 z-50">
        <span className="font-display text-2xl font-bold tracking-tighter text-primary">
          VOX
        </span>
        {slide < 3 && (
          <button 
            onClick={() => setSlide(3)}
            className="text-sm font-semibold text-primary/80 hover:text-primary transition-colors bg-primary/10 border border-primary/20 px-3 py-1 rounded-full"
          >
            Giriş Yap
          </button>
        )}
      </header>

      {/* Main Slide Canvas */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 relative py-6">
        {/* Slide 1 */}
        {slide === 0 && (
          <div className="flex flex-col items-center text-center animate-fade-in w-full max-w-sm">
            {/* Background Glow */}
            <div className="absolute w-80 h-80 bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>

            {/* Glass Card Visual */}
            <div className="relative w-72 h-72 mb-10 flex items-center justify-center">
              <div className="absolute inset-0 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[48px] rotate-6 opacity-30"></div>
              <div className="absolute inset-0 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[48px] -rotate-3 opacity-50"></div>
              <div className="relative w-full h-full bg-surface-container/80 backdrop-blur-2xl border border-white/15 rounded-[48px] flex flex-col items-center justify-center shadow-[0_0_40px_rgba(111,251,190,0.15)] group transition-transform duration-500 hover:scale-105">
                <Headphones className="w-20 h-20 text-primary animate-bounce" />
                <div className="mt-4 flex gap-1.5 items-end h-8">
                  <div className="w-1.5 bg-primary rounded-full animate-pulse h-4"></div>
                  <div className="w-1.5 bg-primary rounded-full animate-pulse h-8 delay-100"></div>
                  <div className="w-1.5 bg-primary rounded-full animate-pulse h-6 delay-200"></div>
                  <div className="w-1.5 bg-primary rounded-full animate-pulse h-7 delay-300"></div>
                </div>
              </div>
            </div>

            <h1 className="font-display text-3xl font-bold text-on-surface leading-tight mb-3">
              Haberleri Oku veya Yapay Zeka ile Dinle
            </h1>
            <p className="text-sm text-on-surface-variant/80 px-4">
              Stüdyo kalitesinde seslendirme ve görsel canlılık.
            </p>
          </div>
        )}

        {/* Slide 2 */}
        {slide === 1 && (
          <div className="flex flex-col items-center text-center animate-fade-in w-full max-w-sm">
            {/* Background Glow */}
            <div className="absolute w-80 h-80 bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>

            {/* Floating Cards Stack */}
            <div className="relative w-72 h-72 mb-10 flex items-center justify-center">
              {/* Card 1 */}
              <div className="absolute -translate-x-10 -translate-y-12 -rotate-6 w-56 p-4 rounded-xl bg-surface-container/90 border border-white/10 backdrop-blur-xl shadow-lg z-10 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                    <Mail className="w-3 h-3" />
                  </div>
                  <span className="text-[10px] font-semibold text-on-surface-variant tracking-wider">THE DISPATCH</span>
                </div>
                <h4 className="font-display text-sm font-bold text-on-surface mb-2">Teknoloji Dünyasında Bu Hafta</h4>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="w-1/3 h-full bg-primary"></div>
                </div>
              </div>

              {/* Card 2 */}
              <div className="absolute translate-x-8 translate-y-4 rotate-3 w-56 p-4 rounded-xl bg-surface-container/90 border border-primary/30 backdrop-blur-xl shadow-[0_0_20px_rgba(78,222,163,0.15)] z-20 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-on-primary">
                    <Play className="w-3 h-3 fill-current" />
                  </div>
                  <span className="text-[10px] font-semibold text-primary tracking-wider">YOUTUBE</span>
                </div>
                <div className="aspect-video w-full rounded-lg mb-2 bg-surface-variant/80 relative overflow-hidden flex items-center justify-center">
                  <span className="text-[10px] font-mono text-primary bg-black/60 px-2 py-0.5 rounded">12:45</span>
                </div>
                <p className="text-xs font-medium text-on-surface truncate">Audio-First: Haberlerin Geleceği</p>
              </div>

              {/* Card 3 */}
              <div className="absolute translate-x-12 -translate-y-20 -rotate-3 w-48 p-3 rounded-xl bg-surface-container/50 border border-white/5 opacity-40 z-0 text-left">
                <div className="flex items-center gap-1.5 mb-1">
                  <Rss className="w-3 h-3 text-primary" />
                  <span className="text-[9px] font-semibold text-on-surface-variant">REUTERS</span>
                </div>
                <div className="h-1.5 w-full bg-white/10 rounded mb-1"></div>
                <div className="h-1.5 w-3/4 bg-white/10 rounded"></div>
              </div>
            </div>

            <h1 className="font-display text-3xl font-bold text-on-surface leading-tight mb-3">
              Kendi Kaynaklarınızı Bağlayın
            </h1>
            <p className="text-sm text-on-surface-variant/80 px-4">
              RSS, YouTube ve Bültenlerinizi tek bir akışta toplayın.
            </p>
          </div>
        )}

        {/* Slide 3 */}
        {slide === 2 && (
          <div className="flex flex-col items-center text-center animate-fade-in w-full max-w-sm">
            {/* Focus Score Ring Visual */}
            <div className="relative w-64 h-64 mb-10 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping"></div>
              <div className="relative w-56 h-56 rounded-full border-8 border-transparent border-t-primary border-r-primary flex flex-col items-center justify-center bg-surface-container/60 backdrop-blur-2xl shadow-[0_0_40px_rgba(78,222,163,0.25)]">
                <span className="font-display text-6xl font-bold text-primary drop-shadow-[0_0_15px_rgba(111,251,190,0.5)]">
                  98
                </span>
                <span className="text-[10px] font-bold text-primary tracking-[0.2em] uppercase mt-1">
                  FOCUS SCORE
                </span>
              </div>
            </div>

            {/* Achievement Pill */}
            <div className="bg-white/5 border border-white/10 rounded-full px-4 py-1.5 flex items-center gap-2 mb-6">
              <Stars className="w-4 h-4 text-primary fill-current" />
              <span className="text-xs font-medium text-on-surface-variant">Haftalık Hedef %112</span>
            </div>

            <h1 className="font-display text-3xl font-bold text-on-surface leading-tight mb-3">
              Odaklandıkça Kazanın
            </h1>
            <p className="text-sm text-on-surface-variant/80 px-4">
              Dinleme ve okuma alışkanlıklarınızı Focus Score ile takip edin ve gelişiminizi görün.
            </p>
          </div>
        )}

        {/* Slide 4 (AUTH LOGIN PAGE) */}
        {slide === 3 && (
          <div className="flex flex-col items-center text-center animate-fade-in w-full max-w-sm my-auto">
            {/* Icon Visual */}
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-primary/20 to-surface-container border border-primary/40 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(78,222,163,0.2)]">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>

            <h1 className="font-display text-2xl font-extrabold text-on-surface mb-2">
              VOX'a Hoş Geldiniz
            </h1>
            <p className="text-xs text-on-surface-variant mb-6 px-2">
              Kişiselleştirilmiş sesli bültenlerinizi dinlemek için giriş yöntemini seçin.
            </p>

            {authError && (
              <div className="w-full mb-4 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-2xl text-xs text-center font-medium">
                {authError}
              </div>
            )}

            {/* Auth Buttons Stack */}
            <div className="w-full space-y-3">
              {/* Google Sign-In Primary Button */}
              <button
                onClick={handleGoogleSignIn}
                disabled={authLoading}
                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold py-4 rounded-2xl text-xs flex items-center justify-center gap-2.5 shadow-[0_0_25px_rgba(220,38,38,0.35)] active:scale-95 transition-all relative overflow-hidden"
              >
                {authLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                <div className="text-left">
                  <div className="font-bold">{authLoading ? 'Giriş Yapılıyor...' : 'Google ile Giriş Yap'}</div>
                  <div className="text-[9px] opacity-80 font-normal">YouTube Abonelikleri & Profil Senkronizasyonu</div>
                </div>
              </button>

              {/* Guest Sign-In Secondary Button */}
              <button
                onClick={handleGuestSignIn}
                disabled={authLoading}
                className="w-full bg-surface-container/90 border border-white/15 hover:border-primary/50 disabled:opacity-60 text-on-surface font-bold py-4 rounded-2xl text-xs flex items-center justify-center gap-2.5 active:scale-95 transition-all"
              >
                {authLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <UserCheck className="w-4 h-4 text-primary" />
                )}
                <div className="text-left">
                  <div className="font-bold">{authLoading ? 'Giriş Yapılıyor...' : 'Misafir Kullanıcı Olarak Devam Et'}</div>
                  <div className="text-[9px] text-on-surface-variant font-normal">Kayıtsız, Anında Hızlı Başlangıç</div>
                </div>
              </button>

              {/* Email Sign-In Option Toggle */}
              <div className="pt-2">
                {!showEmailForm ? (
                  <button
                    onClick={() => setShowEmailForm(true)}
                    className="text-xs text-on-surface-variant hover:text-primary transition-colors underline"
                  >
                    E-Posta ile Giriş Yap veya Kayıt Ol
                  </button>
                ) : (
                  <form className="bg-surface-container/80 border border-white/10 rounded-2xl p-4 space-y-3 text-left animate-fade-in">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-primary">E-Posta Üyeliği</span>
                      <button 
                        type="button" 
                        onClick={() => setShowEmailForm(false)}
                        className="text-on-surface-variant hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <input
                      type="email"
                      placeholder="E-Posta Adresiniz"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    />

                    <input
                      type="password"
                      placeholder="Şifreniz"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    />

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={(e) => handleEmailAuthSubmit(e, false)}
                        disabled={authLoading}
                        className="bg-primary text-on-primary font-bold py-2 rounded-xl text-xs hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {authLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                        <span>{authLoading ? 'İşleniyor...' : 'Giriş Yap'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleEmailAuthSubmit(e, true)}
                        disabled={authLoading}
                        className="bg-white/10 border border-white/20 text-white font-bold py-2 rounded-xl text-xs hover:bg-white/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {authLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                        <span>{authLoading ? 'İşleniyor...' : 'Kayıt Ol'}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            <p className="text-[10px] text-on-surface-variant/60 mt-6 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-primary inline" /> Verileriniz Google Firebase ve SSL ile güvendedir.
            </p>
          </div>
        )}
      </main>

      {/* Bottom Controls */}
      <footer className="px-6 pb-10 pt-4 space-y-4 z-50 w-full max-w-md mx-auto">
        {/* Pager Indicators */}
        <div className="flex justify-center items-center gap-2">
          <div className={`h-1.5 rounded-full transition-all duration-300 ${slide === 0 ? 'w-6 bg-primary' : 'w-1.5 bg-white/20'}`}></div>
          <div className={`h-1.5 rounded-full transition-all duration-300 ${slide === 1 ? 'w-6 bg-primary' : 'w-1.5 bg-white/20'}`}></div>
          <div className={`h-1.5 rounded-full transition-all duration-300 ${slide === 2 ? 'w-6 bg-primary' : 'w-1.5 bg-white/20'}`}></div>
          <div className={`h-1.5 rounded-full transition-all duration-300 ${slide === 3 ? 'w-6 bg-primary' : 'w-1.5 bg-white/20'}`}></div>
        </div>

        {/* Action Button for Slides 0-2 */}
        {slide < 3 && (
          <button
            onClick={nextSlide}
            className="w-full bg-primary text-on-primary font-bold py-4 rounded-full flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-[0_0_25px_rgba(78,222,163,0.25)] hover:brightness-110"
          >
            <span className="text-sm">
              {slide === 2 ? 'Kullanıcı Girişine Geç' : 'Devam Et'}
            </span>
            <ArrowRight className="w-5 h-5" />
          </button>
        )}

        {slide === 1 && (
          <button 
            onClick={() => setSlide(3)}
            className="w-full text-center text-xs text-on-surface-variant hover:text-on-surface"
          >
            Zaten hesabın var mı? <span className="text-primary font-semibold">Giriş Yap</span>
          </button>
        )}
      </footer>
    </div>
  );
};

