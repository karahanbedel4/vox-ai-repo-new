import React, { useState, useEffect } from 'react';
import { Onboarding } from './components/Onboarding';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { MiniPlayer } from './components/MiniPlayer';
import { ReadTab } from './components/ReadTab';
import { ListenTab } from './components/ListenTab';
import { AddModal } from './components/AddModal';
import { LibraryTab } from './components/LibraryTab';
import { ProfileTab } from './components/ProfileTab';
import { AmbientMixerSheet, AmbientChannel, extractYouTubeId } from './components/AmbientMixerSheet';
import { 
  AmbientNotificationBanner, 
  AmbientMiniPlayerBar, 
  AmbientConflictModal 
} from './components/AmbientControls';

import { Article, UserProfile, TabType } from './types';
import { useSubscription } from './hooks/useSubscription';
import { PaywallModal } from './components/PaywallModal';
import { AuthModal } from './components/AuthModal';
import { 
  auth, 
  ensureAuthUser, 
  syncUserProfile, 
  getArticles, 
  getArticlesPaginated,
  saveArticle, 
  clearCustomArticlesFromFirestore,
  toggleBookmark, 
  getUserBookmarks,
  addFocusMinutes
} from './lib/firebase';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import { ttsService, PlaybackState, ResumePosition } from './lib/ttsService';
import { calculateUserStreak, StreakInfo } from './lib/streakService';
import { subscribeNetworkStatus, cacheTop3Articles, getCachedOfflineArticles } from './lib/offlineService';
import { woodRainSynth } from './lib/audioSynth';
import { onAuthStateChanged } from 'firebase/auth';
import { appStorage } from './lib/storage';
import { safeApiFetch } from './lib/api';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { AppTrackingTransparency } from '@capgo/capacitor-app-tracking-transparency';
import { initPushNotifications } from './lib/pushNotifications';

export default function App() {
  const [onboarded, setOnboarded] = useState<boolean>(() => {
    return appStorage.getItemSync('vox_onboarded') === 'true';
  });

  const [activeTab, setActiveTab] = useState<TabType>('read');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [lastDocSnapshot, setLastDocSnapshot] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMoreArticles, setHasMoreArticles] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isReaderNavHidden, setIsReaderNavHidden] = useState<boolean>(false);

  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [isAmbientMixerOpen, setIsAmbientMixerOpen] = useState<boolean>(false);
  const [ambientChannels, setAmbientChannels] = useState<AmbientChannel[]>([
    {
      id: 'yt-thunder-rain',
      name: 'Şimşek ve Yağmur Sesi',
      type: 'youtube',
      url: 'https://www.youtube.com/watch?v=9JEL_n6egA8',
      youtubeId: '9JEL_n6egA8',
      volume: 70,
      active: false
    },
    {
      id: 'yt-nature-rain',
      name: 'Doğada Yağmur Sesi',
      type: 'youtube',
      url: 'https://www.youtube.com/watch?v=3mst47Uu3IU',
      youtubeId: '3mst47Uu3IU',
      volume: 60,
      active: false
    },
    {
      id: 'yt-car-rain',
      name: 'Araç İçinde Yağmur Sesi',
      type: 'youtube',
      url: 'https://www.youtube.com/watch?v=onDDFXSkIXw',
      youtubeId: 'onDDFXSkIXw',
      volume: 65,
      active: false
    },
    {
      id: 'yt-deep-work',
      name: 'Derin Çalışma Müziği',
      type: 'youtube',
      url: 'https://www.youtube.com/watch?v=czMO-L42nnc',
      youtubeId: 'czMO-L42nnc',
      volume: 50,
      active: false
    }
  ]);

  const [topNotificationText, setTopNotificationText] = useState<string | null>(null);
  const [pendingPlayArticle, setPendingPlayArticle] = useState<Article | null>(null);
  const [isAmbientConflictModalOpen, setIsAmbientConflictModalOpen] = useState<boolean>(false);

  const activeAmbientChannels = ambientChannels.filter(c => c.active && c.volume > 0);
  const isAmbientActive = activeAmbientChannels.length > 0;
  const activeAmbientName = activeAmbientChannels.map(c => c.name).join(', ');

  const handleToggleAmbientChannel = (id: string) => {
    setAmbientChannels(prev =>
      prev.map(ch => {
        if (ch.id === id) {
          const nextActive = !ch.active;
          const nextVol = nextActive ? (ch.volume === 0 ? 60 : ch.volume) : ch.volume;
          
          if (nextActive && ch.type === 'youtube') {
            setTimeout(() => {
              const iframe = document.getElementById(`yt-player-${id}`) as HTMLIFrameElement;
              if (iframe?.contentWindow) {
                try {
                  iframe.contentWindow.postMessage(JSON.stringify({
                    event: 'command',
                    func: 'setVolume',
                    args: [nextVol]
                  }), '*');
                } catch (e) {}
              }
            }, 500);
          }
          return { ...ch, active: nextActive, volume: nextVol };
        }
        return ch;
      })
    );
  };

  const handleVolumeChangeAmbient = (id: string, vol: number) => {
    const active = vol > 0;
    const targetChan = ambientChannels.find(c => c.id === id);
    if (targetChan?.type === 'youtube') {
      const iframe = document.getElementById(`yt-player-${id}`) as HTMLIFrameElement;
      if (iframe?.contentWindow) {
        try {
          iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: 'setVolume',
            args: [vol]
          }), '*');
        } catch (e) {}
      }
    }

    setAmbientChannels(prev =>
      prev.map(ch => {
        if (ch.id === id) {
          return { ...ch, volume: vol, active };
        }
        return ch;
      })
    );
  };

  const handleAddCustomAmbient = (name: string, url: string) => {
    const ytId = extractYouTubeId(url);
    const newChan: AmbientChannel = {
      id: 'custom_' + Date.now(),
      name: name || (ytId ? 'Özel YouTube Sesi' : 'Özel Ses Akışı'),
      type: ytId ? 'youtube' : 'stream',
      url: url,
      youtubeId: ytId || undefined,
      volume: 80,
      active: true
    };
    setAmbientChannels(prev => [...prev, newChan]);
  };

  const handleStopAllAmbient = () => {
    setAmbientChannels(prev => prev.map(c => ({ ...c, active: false })));
  };

  const handleCloseAmbientMixer = () => {
    setIsAmbientMixerOpen(false);
    if (isAmbientActive) {
      setTopNotificationText(activeAmbientName);
      setTimeout(() => {
        setTopNotificationText(null);
      }, 5000);
    }
  };

  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [resumeItem, setResumeItem] = useState<{ article: Article; position: ResumePosition } | null>(null);
  const [streakInfo, setStreakInfo] = useState<StreakInfo | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [offlineArticles, setOfflineArticles] = useState<Article[]>([]);

  // Subscribe to network connectivity status change (@capacitor/network)
  useEffect(() => {
    const unsubNetwork = subscribeNetworkStatus(async (offline) => {
      setIsOffline(offline);
      if (offline) {
        const cached = await getCachedOfflineArticles();
        setOfflineArticles(cached);
      }
    });

    // Load initial cached offline articles from Preferences
    getCachedOfflineArticles().then(cached => setOfflineArticles(cached));

    return () => unsubNetwork();
  }, []);

  // Check Capacitor Preferences / Storage for last saved playback position
  useEffect(() => {
    const loadResumePosition = async () => {
      try {
        const stored = await appStorage.getItem('vox_resume_position');
        if (stored) {
          const pos: ResumePosition = JSON.parse(stored);
          if (pos && pos.articleId && pos.currentTime > 3) {
            const foundArticle = articles.find(a => a.id === pos.articleId);
            if (foundArticle && (pos.duration - pos.currentTime) > 5) {
              setResumeItem({ article: foundArticle, position: pos });
            }
          }
        }
      } catch (err) {
        console.warn('Error reading resume position from storage:', err);
      }
    };

    if (articles.length > 0) {
      loadResumePosition();
    }
  }, [articles]);

  const handleResumePlayback = (resumeArticle: Article, pos: ResumePosition) => {
    ttsService.loadArticle(resumeArticle, pos.languageMode || 'tr');
    ttsService.seek(pos.currentTime);
    ttsService.play();
    setActiveTab('listen');
    setResumeItem(null);
  };

  const handleDismissResume = () => {
    ttsService.clearSavedPosition();
    setResumeItem(null);
  };

  // English / Turkish Translation Toggle Handler for Podcasts
  const handleToggleLanguage = async (targetLang: 'tr' | 'en') => {
    const currentArticle = playbackState.currentArticle;
    if (!currentArticle) return;

    if (targetLang === 'tr') {
      ttsService.setLanguageMode('tr');
      return;
    }

    // Target is English ('en')
    const hasValidEnglish = Boolean(
      currentArticle.englishContent && 
      currentArticle.englishContent.trim().length > 10 &&
      currentArticle.englishContent.trim() !== currentArticle.content?.trim()
    );

    if (hasValidEnglish) {
      ttsService.setLanguageMode('en');
      return;
    }

    // Fetch translation dynamically via /api/translate
    setIsTranslating(true);
    try {
      const res = await safeApiFetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: currentArticle.title,
          summary: currentArticle.summary,
          content: currentArticle.content,
          keyPoints: currentArticle.keyPoints,
          targetLang: 'en'
        })
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let json: any = null;
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        json = await res.json();
      }
      if (json?.success && json?.data) {
        const updatedArticle: Article = {
          ...currentArticle,
          englishTitle: json.data.title || currentArticle.title,
          englishSummary: json.data.summary || currentArticle.summary,
          englishContent: json.data.content || currentArticle.content,
          englishKeyPoints: json.data.keyPoints || currentArticle.keyPoints
        };

        setArticles(prev => prev.map(a => a.id === updatedArticle.id ? updatedArticle : a));
        const currentSaved = articles.map(a => a.id === updatedArticle.id ? updatedArticle : a);
        await appStorage.setItem('vox_articles', JSON.stringify(currentSaved));

        ttsService.setLanguageMode('en');
        ttsService.loadArticle(updatedArticle, 'en');
        ttsService.play();
      }
    } catch (err) {
      console.error('Translation error:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  const [playbackState, setPlaybackState] = useState<PlaybackState>(ttsService.getState());

  // Subscription & Entitlement Management Hook (RevenueCat / StoreKit 2 & Firebase)
  const subscription = useSubscription(user);

  // Listen to TTS Service
  useEffect(() => {
    const unsubscribe = ttsService.subscribe((state) => {
      setPlaybackState(state);
    });
    return () => unsubscribe();
  }, []);

  // Configure Native Status Bar for Dark / VOX theme & Safe Area styling
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      try {
        StatusBar.setStyle({ style: Style.Dark }).catch((err) => {
          console.warn('Status Bar setStyle error:', err);
        });
        if (Capacitor.getPlatform() === 'android') {
          StatusBar.setBackgroundColor({ color: '#0e1217' }).catch((err) => {
            console.warn('Status Bar setBackgroundColor error:', err);
          });
        }
      } catch (e) {
        console.warn('Status Bar setup error:', e);
      }
    }
  }, []);

  // Request Apple App Tracking Transparency (ATT) permission on iOS native devices
  useEffect(() => {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
      const promptTimer = setTimeout(async () => {
        try {
          const statusRes = await AppTrackingTransparency.getStatus();
          if (statusRes.status === 'notDetermined') {
            await AppTrackingTransparency.requestPermission();
          }
        } catch (err) {
          try {
            await AppTrackingTransparency.requestPermission();
          } catch (e) {
            console.warn('AppTrackingTransparency request error:', e);
          }
        }
      }, 700);

      return () => clearTimeout(promptTimer);
    }
  }, []);

  // Firebase Cloud Messaging (FCM) & Apple APNs Push Notifications Setup
  useEffect(() => {
    if (!user?.uid) return;

    let cleanupFn: (() => void) | null = null;

    initPushNotifications(
      user.uid,
      (notification) => {
        // Foreground push received - show in-app banner
        const title = notification.title || 'VOX Bildirim';
        const body = notification.body || '';
        setTopNotificationText(`${title}: ${body}`);
        setTimeout(() => setTopNotificationText(null), 6000);
      },
      (action) => {
        // Notification action clicked (Background / Killed state)
        const data = action.notification.data;
        if (data?.articleId) {
          const targetArticle = articles.find(a => a.id === data.articleId);
          if (targetArticle) {
            handlePlayArticle(targetArticle);
            setActiveTab('listen');
            return;
          }
        }
        if (data?.tab && ['read', 'listen', 'library', 'profile'].includes(data.tab)) {
          setActiveTab(data.tab as TabType);
        }
      }
    ).then((cleanup) => {
      cleanupFn = cleanup;
    }).catch((err) => {
      console.warn('Push Notification initialization warning:', err);
    });

    return () => {
      if (cleanupFn) {
        cleanupFn();
      }
    };
  }, [user?.uid, articles]);

  // Lock Screen & MediaSession API Integration for Focus / Ambient sounds
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && typeof MediaMetadata !== 'undefined') {
      if (isAmbientActive && !playbackState.isPlaying) {
        const activeNames = activeAmbientChannels.map(c => c.name).join(', ') || 'Doğa & Ambiyans';
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'VOX Odaklanma',
          artist: activeNames || 'Doğa & Ambiyans',
          album: 'VOX Odaklanma & Ambiyans',
          artwork: [
            { src: '/apple-touch-icon.png', sizes: '512x512', type: 'image/png' },
            { src: '/logo.png', sizes: '512x512', type: 'image/png' }
          ]
        });
        navigator.mediaSession.playbackState = 'playing';

        try {
          navigator.mediaSession.setActionHandler('pause', () => {
            handleStopAllAmbient();
          });
          navigator.mediaSession.setActionHandler('play', () => {
            setAmbientChannels(prev => prev.map(c => ({ ...c, active: true })));
          });
        } catch (e) {}
      } else if (!isAmbientActive && !playbackState.isPlaying) {
        navigator.mediaSession.playbackState = 'none';
      }
    }
  }, [isAmbientActive, activeAmbientName, playbackState.isPlaying]);

  // Sync Firebase Auth State
  useEffect(() => {
    const handleAuthEvent = (e: any) => {
      if (e?.detail) {
        setUser(e.detail);
        if (e.detail.uid) ttsService.setUserId(e.detail.uid);
      }
    };
    window.addEventListener('vox_auth_changed', handleAuthEvent);

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      const localEmailUserRaw = appStorage.getItemSync('vox_local_email_user');
      if (localEmailUserRaw) {
        try {
          const localProfile = JSON.parse(localEmailUserRaw);
          if (localProfile?.uid && localProfile?.authProvider === 'email') {
            setUser(localProfile);
            ttsService.setUserId(localProfile.uid);
            return;
          }
        } catch (e) {}
      }

      const u = firebaseUser || (await ensureAuthUser());
      if (u) {
        const profile = await syncUserProfile(u);
        setUser(profile);
        ttsService.setUserId(u.uid);
        const bms = await getUserBookmarks(u.uid);
        setBookmarkedIds(bms);
        calculateUserStreak(u.uid).then(st => setStreakInfo(st));
      } else {
        const guestId = appStorage.getItemSync('vox_guest_uid') || `guest_${Date.now()}`;
        appStorage.setItemSync('vox_guest_uid', guestId);
        const guestProfile: UserProfile = {
          uid: guestId,
          displayName: 'Misafir Kullanıcı',
          email: 'misafir@vox.app',
          photoURL: '',
          birthdate: '1998-05-14',
          authProvider: 'guest',
          isPremium: false,
          subscriptionTier: 'free',
          dailyQuotaUsed: 0,
          lastQuotaResetDate: new Date().toISOString().split('T')[0],
          focusScore: 85,
          streakCount: 0,
          weeklyMinutes: 0,
          totalArticlesRead: 0,
          totalListenedMinutes: 0,
          createdAt: new Date().toISOString()
        };
        setUser(guestProfile);
        ttsService.setUserId(guestId);
        calculateUserStreak(guestId).then(st => setStreakInfo(st));
      }
    });

    return () => {
      window.removeEventListener('vox_auth_changed', handleAuthEvent);
      unsubAuth();
    };
  }, []);

  // Periodically refresh streak info during active playback
  useEffect(() => {
    if (playbackState.isPlaying) {
      const interval = setInterval(() => {
        calculateUserStreak(user?.uid || '').then(st => setStreakInfo(st));
      }, 2000);
      return () => clearInterval(interval);
    } else {
      calculateUserStreak(user?.uid || '').then(st => setStreakInfo(st));
    }
  }, [playbackState.isPlaying, user?.uid]);

  // Fetch Initial Articles via Firestore Cursor Pagination & cache top 3 for offline access
  useEffect(() => {
    getArticlesPaginated(6, null).then(async res => {
      setArticles(res.articles);
      setLastDocSnapshot(res.lastDoc);
      setHasMoreArticles(res.hasMore);

      if (res.articles && res.articles.length > 0) {
        await cacheTop3Articles(res.articles);
        const cached = await getCachedOfflineArticles();
        setOfflineArticles(cached);
      }
    }).catch(async (e) => {
      console.warn('Network or Firestore offline fallback:', e);
      setIsOffline(true);
      const cached = await getCachedOfflineArticles();
      setOfflineArticles(cached);
    });
  }, []);

  // Load More Articles (Cursor Pagination)
  const handleLoadMoreArticles = async () => {
    if (isLoadingMore || !hasMoreArticles) return;
    setIsLoadingMore(true);
    try {
      const res = await getArticlesPaginated(6, lastDocSnapshot);
      setArticles(prev => {
        const existingIds = new Set(prev.map(a => a.id));
        const newUnique = res.articles.filter(a => !existingIds.has(a.id));
        return [...prev, ...newUnique];
      });
      setLastDocSnapshot(res.lastDoc);
      setHasMoreArticles(res.hasMore);
    } catch (e) {
      console.warn('Error fetching paginated articles:', e);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Direct playback execution
  const playArticleDirectly = async (article: Article) => {
    ttsService.loadArticle(article);
    ttsService.play();
    setActiveTab('listen');

    // Add dynamic focus score points synchronized with 5-minute Firestore update
    if (user) {
      const updatedMetrics = await addFocusMinutes(user.uid, 5);
      if (updatedMetrics) {
        setUser(prev => prev ? {
          ...prev,
          focusScore: updatedMetrics.focusScore,
          weeklyMinutes: updatedMetrics.weeklyMinutes
        } : null);
      } else {
        // Fallback calculation matching backend formula
        setUser(prev => {
          if (!prev) return null;
          const newWeekly = (prev.weeklyMinutes || 0) + 5;
          const newScore = Math.min(100, Math.round(85 + (newWeekly / 60) * 1.2));
          return { ...prev, focusScore: newScore, weeklyMinutes: newWeekly };
        });
      }
    }
  };

  // Handle Play Article (checks if nature sound is active first)
  const handlePlayArticle = async (article: Article) => {
    if (isAmbientActive) {
      setPendingPlayArticle(article);
      setIsAmbientConflictModalOpen(true);
    } else {
      await playArticleDirectly(article);
    }
  };

  const handleConfirmKeepAmbient = () => {
    setIsAmbientConflictModalOpen(false);
    if (pendingPlayArticle) {
      playArticleDirectly(pendingPlayArticle);
      setPendingPlayArticle(null);
    }
  };

  const handleStopAmbientAndPlay = () => {
    handleStopAllAmbient();
    setIsAmbientConflictModalOpen(false);
    if (pendingPlayArticle) {
      playArticleDirectly(pendingPlayArticle);
      setPendingPlayArticle(null);
    }
  };

  // Toggle Bookmark
  const handleToggleBookmark = async (articleId: string) => {
    const userId = user?.uid || 'guest';
    setBookmarkedIds(prev => {
      const isSaved = prev.includes(articleId);
      const next = isSaved ? prev.filter(id => id !== articleId) : [...prev, articleId];
      appStorage.setItem('vox_bookmarks', JSON.stringify(next));
      return next;
    });

    try {
      await toggleBookmark(userId, articleId);
    } catch (err) {
      console.warn('Bookmark sync error:', err);
    }
  };

  // Add Imported Article
  const handleImportSuccess = async (articleData: Article) => {
    const saved = await saveArticle(articleData);
    setArticles(prev => [saved, ...prev]);
    handlePlayArticle(saved);
  };

  // Ambient Sound Toggle & Mixer Sheet Handler
  const handleToggleAmbient = () => {
    setIsAmbientMixerOpen(prev => !prev);
  };

  const handleFinishOnboarding = () => {
    appStorage.setItem('vox_onboarded', 'true');
    setOnboarded(true);
  };

  const handleRefreshUser = async () => {
    if (auth.currentUser) {
      const p = await syncUserProfile(auth.currentUser);
      setUser(p);
    }
  };

  const handleClearAllCache = async () => {
    // 1. Stop active TTS playback and clear stored playback position
    ttsService.pause();
    ttsService.stop();
    ttsService.clearSavedPosition();

    // 2. Delete custom user-added articles from Firestore (YouTube summaries, PDFs, imported links)
    await clearCustomArticlesFromFirestore();

    // 3. Clear all app storage keys
    const keysToRemove = [
      'vox_articles',
      'vox_offline_articles',
      'vox_local_pdf_documents',
      'vox_local_only_summaries',
      'vox_favorite_categories',
      'vox_resume_position',
      'vox_user_stats',
      'vox_user_bookmarks',
      'vox_daily_quota',
      'vox_youtube_access_token'
    ];

    for (const key of keysToRemove) {
      await appStorage.removeItem(key);
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('vox_') && key !== 'vox_onboarded' && key !== 'vox_theme') {
          localStorage.removeItem(key);
        }
      });
    }

    // 3. Clear memory states
    setArticles([]);
    setOfflineArticles([]);
    setResumeItem(null);
    setBookmarkedIds([]);
    setLastDocSnapshot(null);
    setHasMoreArticles(true);

    // 4. Fetch clean initial articles from Firestore
    try {
      const res = await getArticlesPaginated(6, null);
      setArticles(res.articles);
      setLastDocSnapshot(res.lastDoc);
      setHasMoreArticles(res.hasMore);

      if (res.articles && res.articles.length > 0) {
        await cacheTop3Articles(res.articles);
        const cached = await getCachedOfflineArticles();
        setOfflineArticles(cached);
      }
    } catch (e) {
      console.warn('Error fetching fresh articles after cache clear:', e);
    }

    await handleRefreshUser();
  };

  const handleTabChange = (tab: TabType) => {
    setIsAmbientMixerOpen(false);
    setActiveTab(tab);
  };

  if (!onboarded) {
    return <Onboarding onComplete={handleFinishOnboarding} />;
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)] text-on-surface font-sans selection:bg-primary/30 antialiased overflow-x-hidden pt-safe pb-safe pl-safe pr-safe">
      {/* Top Notification Toast Banner when Ambient Popup Closes */}
      <AmbientNotificationBanner
        notificationText={topNotificationText}
        onDismiss={() => setTopNotificationText(null)}
        onOpenMixer={() => setIsAmbientMixerOpen(true)}
      />

      {/* Fixed Header */}
      <Header 
        user={user} 
        onOpenProfile={() => handleTabChange('profile')} 
        focusScore={user?.focusScore || 98}
        isHidden={isReaderNavHidden}
        isPremium={subscription.isPremium}
        isGuest={subscription.isGuest}
        onOpenPaywall={() => subscription.setIsPaywallOpen(true)}
        onOpenAuthModal={() => subscription.setIsAuthModalOpen(true)}
        streakInfo={streakInfo}
      />

      {/* Main Tab View */}
      <main className="min-h-screen">
        {activeTab === 'read' && (
          <ReadTab
            articles={articles}
            bookmarkedIds={bookmarkedIds}
            onPlayArticle={handlePlayArticle}
            onToggleBookmark={handleToggleBookmark}
            currentArticle={playbackState.currentArticle}
            isPlaying={playbackState.isPlaying}
            currentWordIndex={playbackState.currentWordIndex}
            hasMore={hasMoreArticles}
            isLoadingMore={isLoadingMore}
            onLoadMore={handleLoadMoreArticles}
            onScrollDirectionChange={(hidden) => setIsReaderNavHidden(hidden)}
            resumeItem={resumeItem}
            onResumePlayback={handleResumePlayback}
            onDismissResume={handleDismissResume}
            streakInfo={streakInfo}
            isOffline={isOffline}
            offlineArticles={offlineArticles}
          />
        )}

        {activeTab === 'listen' && (
          <ListenTab
            playbackState={playbackState}
            onPlay={() => ttsService.play()}
            onPause={() => ttsService.pause()}
            onSeek={(secs) => ttsService.seek(secs)}
            onSetRate={(rate) => ttsService.setRate(rate)}
            isAmbientActive={isAmbientActive}
            activeAmbientName={activeAmbientName}
            onToggleAmbient={() => setIsAmbientMixerOpen(true)}
            onStopAmbient={handleStopAllAmbient}
            onToggleLanguage={handleToggleLanguage}
            isTranslating={isTranslating}
            onImportSuccess={handleImportSuccess}
          />
        )}

        {activeTab === 'add' && (
          <AddModal
            onImportSuccess={handleImportSuccess}
            recentArticles={articles}
            onIncrementQuota={subscription.incrementQuota}
            isPremium={subscription.isPremium}
            isGuest={subscription.isGuest}
            dailyQuotaUsed={subscription.dailyQuotaUsed}
            dailyQuotaLimit={subscription.dailyQuotaLimit}
            onOpenPaywall={() => subscription.setIsPaywallOpen(true)}
            onOpenAuthModal={() => subscription.setIsAuthModalOpen(true)}
          />
        )}

        {activeTab === 'library' && (
          <LibraryTab
            articles={articles}
            bookmarkedIds={bookmarkedIds}
            onPlayArticle={handlePlayArticle}
            onToggleBookmark={handleToggleBookmark}
            onImportSuccess={handleImportSuccess}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileTab
            user={user}
            onRefreshUser={handleRefreshUser}
            isAmbientActive={isAmbientActive}
            activeAmbientName={activeAmbientName}
            onToggleAmbient={() => setIsAmbientMixerOpen(true)}
            onStopAmbient={handleStopAllAmbient}
            onOpenAmbientMixer={() => setIsAmbientMixerOpen(true)}
            onOpenPaywall={() => subscription.setIsPaywallOpen(true)}
            onClearAllCache={handleClearAllCache}
          />
        )}
      </main>

      {/* Auth Login / Register Modal for Guests */}
      <AuthModal
        isOpen={subscription.isAuthModalOpen}
        onClose={() => subscription.setIsAuthModalOpen(false)}
        onAuthSuccess={handleRefreshUser}
        reason="guest_limit"
      />

      {/* Apple IAP RevenueCat Paywall Modal */}
      <PaywallModal
        isOpen={subscription.isPaywallOpen}
        onClose={() => subscription.setIsPaywallOpen(false)}
        onPurchase={subscription.purchasePackage}
        onRestore={subscription.restorePurchases}
        onOpenNativePaywall={subscription.openNativePaywall}
        onOpenCustomerCenter={subscription.openCustomerCenter}
        isLoading={subscription.isLoading}
      />

      {/* Doğa Sesleri Mikseri Bottom Sheet Modal */}
      <AmbientMixerSheet
        isOpen={isAmbientMixerOpen}
        onClose={handleCloseAmbientMixer}
        channels={ambientChannels}
        onToggleChannel={handleToggleAmbientChannel}
        onVolumeChange={handleVolumeChangeAmbient}
        onAddCustomChannel={handleAddCustomAmbient}
      />

      {/* Ambient Sound Floating Mini Player Bar */}
      <AmbientMiniPlayerBar
        isAmbientActive={isAmbientActive}
        activeAmbientName={activeAmbientName}
        onStopAll={handleStopAllAmbient}
        onOpenMixer={() => setIsAmbientMixerOpen(true)}
        hasArticleMiniPlayer={activeTab !== 'listen' && !!playbackState.currentArticle && !playbackState.isMiniPlayerDismissed}
      />

      {/* Ambient Sound & Transformed Content Conflict Question Modal */}
      <AmbientConflictModal
        isOpen={isAmbientConflictModalOpen}
        activeAmbientName={activeAmbientName}
        pendingArticleTitle={pendingPlayArticle?.title}
        onConfirmKeepAmbient={handleConfirmKeepAmbient}
        onStopAmbientAndPlay={handleStopAmbientAndPlay}
      />

      {/* YouTube Music style Floating Mini Player */}
      {activeTab !== 'listen' && playbackState.currentArticle && !playbackState.isMiniPlayerDismissed && (
        <MiniPlayer
          playbackState={playbackState}
          onPlay={() => ttsService.play()}
          onPause={() => ttsService.pause()}
          onOpenFullPlayer={() => handleTabChange('listen')}
          onClose={() => ttsService.closePlayer()}
          onSeekForward={() => ttsService.seek(Math.min(playbackState.duration, playbackState.currentTime + 15))}
          isHidden={isReaderNavHidden}
        />
      )}

      {/* Bottom Mobile Navigation */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={handleTabChange}
        isPlaying={playbackState.isPlaying}
        isHidden={isReaderNavHidden}
      />
    </div>
  );
}
