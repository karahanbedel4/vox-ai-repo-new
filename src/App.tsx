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

import { Article, UserProfile, TabType, SharedLinkItem, SourceType } from './types';
import { useSubscription } from './hooks/useSubscription';
import { PaywallModal } from './components/PaywallModal';
import { AuthModal } from './components/AuthModal';
import { ShareIncomingModal } from './components/ShareIncomingModal';
import { ShareQueueModal } from './components/ShareQueueModal';
import { 
  getSharedLinksQueue, 
  addSharedLinkToQueue, 
  removeSharedLinkFromQueue, 
  clearSharedLinksQueue, 
  convertItemToArticle, 
  parseSharedContent,
  MAX_QUEUE_LIMIT
} from './lib/shareService';
import { App as CapApp } from '@capacitor/app';
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
import { Bell, X } from 'lucide-react';
import { initPushNotifications } from './lib/pushNotifications';
import { initAdMob, showBannerAd, hideBannerAd } from './lib/admob';
import { LegalView } from './components/LegalView';
import { ThemeMode, getInitialTheme, applyTheme } from './lib/theme';
import { focusAudioService, FOCUS_TRACKS } from './lib/focusAudioService';

export default function App() {
  // Check if current URL is a legal page (/privacy, /terms, /gizlilik, /kullanim-sartlari, /eula)
  const currentPath = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
  const [legalRoute, setLegalRoute] = useState<'privacy' | 'terms' | null>(() => {
    if (currentPath.includes('privacy') || currentPath.includes('gizlilik')) return 'privacy';
    if (currentPath.includes('term') || currentPath.includes('kullanim') || currentPath.includes('eula') || currentPath.includes('sart')) return 'terms';
    return null;
  });

  if (legalRoute) {
    return (
      <LegalView
        type={legalRoute}
        onBack={() => {
          window.history.pushState({}, '', '/');
          setLegalRoute(null);
        }}
      />
    );
  }

  const [onboarded, setOnboarded] = useState<boolean>(() => {
    return appStorage.getItemSync('vox_onboarded') === 'true';
  });

  const [activeTab, setActiveTab] = useState<TabType>('read');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getInitialTheme());
  const [focusAudioState, setFocusAudioState] = useState(() => focusAudioService.getState());

  useEffect(() => {
    applyTheme(themeMode);
  }, [themeMode]);

  useEffect(() => {
    const unsub = focusAudioService.subscribe(() => {
      setFocusAudioState(focusAudioService.getState());
    });
    return unsub;
  }, []);

  const handleToggleTheme = () => {
    setThemeMode(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      applyTheme(next);
      return next;
    });
  };
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
  const [pushToast, setPushToast] = useState<{ title: string; body: string; data?: any } | null>(null);
  const [pendingPlayArticle, setPendingPlayArticle] = useState<Article | null>(null);
  const [isAmbientConflictModalOpen, setIsAmbientConflictModalOpen] = useState<boolean>(false);

  // Share & Content Conversion Queue State
  const [sharedQueue, setSharedQueue] = useState<SharedLinkItem[]>(() => getSharedLinksQueue());
  const [isShareQueueOpen, setIsShareQueueOpen] = useState<boolean>(false);
  const [incomingShareItem, setIncomingShareItem] = useState<{
    url: string;
    title?: string;
    sourceType: SourceType;
    platformName: SharedLinkItem['platformName'];
    thumbnail?: string;
  } | null>(null);
  const [isShareIncomingOpen, setIsShareIncomingOpen] = useState<boolean>(false);
  const [isConvertingQueue, setIsConvertingQueue] = useState<boolean>(false);

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

  // Request Apple App Tracking Transparency (ATT) permission & Initialize AdMob on native devices
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const promptTimer = setTimeout(async () => {
        let isAuthorized = true;

        try {
          if (Capacitor.getPlatform() === 'ios') {
            const statusRes = await AppTrackingTransparency.getStatus();
            console.log('[ATT] Initial status:', statusRes.status);
            
            if (statusRes.status === 'notDetermined') {
              const requestRes = await AppTrackingTransparency.requestPermission();
              console.log('[ATT] User response status:', requestRes.status);
              isAuthorized = requestRes.status === 'authorized';
            } else {
              isAuthorized = statusRes.status === 'authorized';
            }
          }
        } catch (err) {
          console.warn('[ATT] Permission flow warning:', err);
        } finally {
          // STRICT APPLE COMPLIANCE: Initialize AdMob SDK ONLY AFTER ATT flow completes
          console.log('[ATT -> AdMob] Initializing AdMob (Tracking Authorized:', isAuthorized, ')');
          await initAdMob();

          if (!user?.isPremium) {
            await showBannerAd(false);
          }
        }
      }, 700);

      return () => {
        clearTimeout(promptTimer);
        hideBannerAd();
      };
    }
  }, [user?.isPremium]);

  // Firebase Cloud Messaging (FCM) & Apple APNs Push Notifications Setup
  useEffect(() => {
    if (!user?.uid) return;

    let cleanupFn: (() => void) | null = null;

    initPushNotifications(
      user.uid,
      (notification) => {
        // Foreground push received - show rich in-app push toast
        const title = notification.title || 'VOX Bildirim';
        const body = notification.body || '';
        setPushToast({
          title,
          body,
          data: notification.data
        });
        setTimeout(() => setPushToast(null), 7000);
      },
      (action) => {
        // Notification action clicked (Background / Killed state)
        const data = action.notification?.data;
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

  // Share Sheet / URL Scheme Deep Link Integration (vox:// and web query params)
  useEffect(() => {
    // 1. Check initial query params on web/preview
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const incomingUrl = searchParams.get('share_url') || searchParams.get('shared_url') || searchParams.get('url') || searchParams.get('text');
      if (incomingUrl) {
        const parsed = parseSharedContent(incomingUrl);
        if (parsed) {
          setIncomingShareItem(parsed);
          setIsShareIncomingOpen(true);
        }
        // Clean URL to avoid duplicate triggers on reload
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }

    // 2. Capacitor App URL Listener for native iOS / Android share intents
    let appUrlListener: any = null;
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener('appUrlOpen', (data) => {
        try {
          if (!data?.url) return;
          let targetUrl = data.url;
          if (targetUrl.startsWith('vox://')) {
            const pathAndQuery = targetUrl.replace('vox://', '');
            if (pathAndQuery.includes('url=')) {
              const parsedQuery = new URLSearchParams(pathAndQuery.split('?')[1] || pathAndQuery);
              targetUrl = parsedQuery.get('url') || parsedQuery.get('text') || pathAndQuery;
            } else if (pathAndQuery.startsWith('http://') || pathAndQuery.startsWith('https://')) {
              targetUrl = pathAndQuery;
            }
          }

          const parsed = parseSharedContent(decodeURIComponent(targetUrl));
          if (parsed) {
            setIncomingShareItem(parsed);
            setIsShareIncomingOpen(true);
          }
        } catch (err) {
          console.warn('Error handling deep link share URL:', err);
        }
      }).then((listener) => {
        appUrlListener = listener;
      });
    }

    return () => {
      if (appUrlListener && typeof appUrlListener.remove === 'function') {
        appUrlListener.remove();
      }
    };
  }, []);

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
    // 1. Check local email session first
    const localEmailUserRaw = appStorage.getItemSync('vox_local_email_user');
    if (localEmailUserRaw) {
      try {
        const localProfile = JSON.parse(localEmailUserRaw);
        if (localProfile?.uid && localProfile?.authProvider === 'email') {
          setUser(localProfile);
          ttsService.setUserId(localProfile.uid);
          const bms = await getUserBookmarks(localProfile.uid);
          setBookmarkedIds(bms);
          return;
        }
      } catch (e) {}
    }

    if (auth.currentUser) {
      const p = await syncUserProfile(auth.currentUser);
      setUser(p);
      ttsService.setUserId(auth.currentUser.uid);
      const bms = await getUserBookmarks(auth.currentUser.uid);
      setBookmarkedIds(bms);
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
      setBookmarkedIds([]);
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

  // Share & Content Conversion Queue Handlers
  const handleConvertSharedNow = async (item: {
    url: string;
    title?: string;
    sourceType: SourceType;
    platformName: SharedLinkItem['platformName'];
    thumbnail?: string;
  }) => {
    setIsShareIncomingOpen(false);

    // Check Quota
    if (!subscription.isPremium) {
      if (subscription.isGuest && subscription.dailyQuotaUsed >= 1) {
        subscription.setIsAuthModalOpen(true);
        return;
      }
      if (!subscription.isGuest && subscription.dailyQuotaUsed >= subscription.dailyQuotaLimit) {
        subscription.setIsPaywallOpen(true);
        return;
      }
    }

    setTopNotificationText(`Yapay Zeka ${item.platformName} içeriğini podcaste dönüştürüyor...`);
    try {
      if (subscription.incrementQuota) {
        await subscription.incrementQuota();
      }

      const newArticle = await convertItemToArticle(item);
      await handleImportSuccess(newArticle);

      // Remove from queue if it was present
      setSharedQueue(prev => {
        const next = prev.filter(x => x.url !== item.url);
        try {
          appStorage.setItem('vox_shared_links_queue', JSON.stringify(next));
        } catch {}
        return next;
      });

      setPushToast({
        title: 'Podcast Hazır!',
        body: `"${newArticle.title}" sesli bülteni oluşturuldu ve dinlemeye hazır.`
      });
      setTimeout(() => setPushToast(null), 6000);

      // Instantly start playback and switch to Listen tab
      handlePlayArticle(newArticle);
      setActiveTab('listen');
    } catch (err: any) {
      console.error('Error converting shared item:', err);
      setPushToast({
        title: 'Dönüştürme Hatası',
        body: err?.message || 'İçerik podcaste dönüştürülürken bir hata oluştu.'
      });
      setTimeout(() => setPushToast(null), 6000);
    } finally {
      setTopNotificationText(null);
    }
  };

  const handleSaveIncomingToQueue = (item: {
    url: string;
    title?: string;
    sourceType: SourceType;
    platformName: SharedLinkItem['platformName'];
    thumbnail?: string;
  }) => {
    const res = addSharedLinkToQueue(item);
    setIsShareIncomingOpen(false);
    if (res.success) {
      setSharedQueue(res.queue);
      setPushToast({
        title: 'Havuzda Saklandı',
        body: `"${item.title || item.url}" dönüştürme havuzuna eklendi (${res.queue.length}/${MAX_QUEUE_LIMIT}).`
      });
      setTimeout(() => setPushToast(null), 5000);
    } else {
      setPushToast({
        title: 'Havuza Eklenemedi',
        body: res.error || 'Link kuyruğa eklenemedi.'
      });
      setTimeout(() => setPushToast(null), 5000);
    }
  };

  const handleDeleteQueueItem = (id: string) => {
    const updated = removeSharedLinkFromQueue(id);
    setSharedQueue(updated);
  };

  const handleClearQueue = () => {
    clearSharedLinksQueue();
    setSharedQueue([]);
  };

  const handleAddNewLinkToQueue = (item: {
    url: string;
    title?: string;
    sourceType: SourceType;
    platformName: SharedLinkItem['platformName'];
    thumbnail?: string;
  }) => {
    const res = addSharedLinkToQueue(item);
    if (res.success) {
      setSharedQueue(res.queue);
    }
    return res;
  };

  const handleBatchConvertQueue = async () => {
    if (sharedQueue.length === 0) return;
    setIsConvertingQueue(true);
    setTopNotificationText(`Kuyruktaki ${sharedQueue.length} içerik sırayla podcaste dönüştürülüyor...`);

    let firstConvertedArticle: Article | null = null;
    const remainingItems = [...sharedQueue];

    for (let i = 0; i < sharedQueue.length; i++) {
      const item = sharedQueue[i];
      try {
        if (!subscription.isPremium && subscription.incrementQuota) {
          await subscription.incrementQuota();
        }
        const converted = await convertItemToArticle(item);
        await handleImportSuccess(converted);
        if (!firstConvertedArticle) {
          firstConvertedArticle = converted;
        }

        const idx = remainingItems.findIndex(x => x.id === item.id);
        if (idx !== -1) {
          remainingItems.splice(idx, 1);
          setSharedQueue([...remainingItems]);
          try {
            appStorage.setItem('vox_shared_links_queue', JSON.stringify(remainingItems));
          } catch {}
        }
      } catch (err: any) {
        console.error(`Failed to convert queue item ${item.url}:`, err);
      }
    }

    setIsConvertingQueue(false);
    setTopNotificationText(null);
    setIsShareQueueOpen(false);

    if (firstConvertedArticle) {
      setPushToast({
        title: 'Toplu Dönüştürme Tamamlandı',
        body: 'Kuyruktaki içerikler başarıyla podcaste dönüştürüldü.'
      });
      setTimeout(() => setPushToast(null), 6000);
      handlePlayArticle(firstConvertedArticle);
      setActiveTab('listen');
    }
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
      {/* Foreground Push Notification Interactive Banner */}
      {pushToast && (
        <div 
          onClick={() => {
            if (pushToast.data?.articleId) {
              const target = articles.find(a => a.id === pushToast.data.articleId);
              if (target) {
                handlePlayArticle(target);
                setActiveTab('listen');
              }
            } else if (pushToast.data?.tab && ['read', 'listen', 'library', 'profile'].includes(pushToast.data.tab)) {
              setActiveTab(pushToast.data.tab as TabType);
            }
            setPushToast(null);
          }}
          className="fixed top-3 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-50 bg-[#161c24]/95 border border-primary/40 backdrop-blur-xl shadow-2xl rounded-2xl p-3.5 flex items-start gap-3 cursor-pointer animate-in fade-in slide-in-from-top-3 duration-300"
        >
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30">
            <Bell className="w-4 h-4 text-primary animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1.5">
              <h4 className="text-xs font-bold text-white truncate">{pushToast.title}</h4>
              <span className="text-[10px] text-neutral-400 font-medium">VOX</span>
            </div>
            <p className="text-xs text-neutral-300 mt-0.5 line-clamp-2 leading-relaxed">{pushToast.body}</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPushToast(null);
            }}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
        queueCount={sharedQueue.length}
        onOpenQueue={() => setIsShareQueueOpen(true)}
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
            isAmbientActive={isAmbientActive || focusAudioState.isPlaying}
            activeAmbientName={focusAudioState.currentTrack?.title || activeAmbientName}
            onToggleAmbient={() => setIsAmbientMixerOpen(true)}
            onStopAmbient={() => {
              focusAudioService.stop();
              handleStopAllAmbient();
            }}
            onToggleLanguage={handleToggleLanguage}
            isTranslating={isTranslating}
            onImportSuccess={handleImportSuccess}
            articles={articles}
            bookmarkedIds={bookmarkedIds}
            onPlayArticle={handlePlayArticle}
            onToggleBookmark={handleToggleBookmark}
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
            sharedQueue={sharedQueue}
            onOpenQueueModal={() => setIsShareQueueOpen(true)}
            onConvertQueueItem={handleConvertSharedNow}
            onDeleteQueueItem={handleDeleteQueueItem}
            onBatchConvertQueue={handleBatchConvertQueue}
          />
        )}

        {activeTab === 'library' && (
          <ListenTab
            playbackState={playbackState}
            onPlay={() => ttsService.play()}
            onPause={() => ttsService.pause()}
            onSeek={(secs) => ttsService.seek(secs)}
            onSetRate={(rate) => ttsService.setRate(rate)}
            isAmbientActive={isAmbientActive || focusAudioState.isPlaying}
            activeAmbientName={focusAudioState.currentTrack?.title || activeAmbientName}
            onToggleAmbient={() => setIsAmbientMixerOpen(true)}
            onStopAmbient={() => {
              focusAudioService.stop();
              handleStopAllAmbient();
            }}
            onToggleLanguage={handleToggleLanguage}
            isTranslating={isTranslating}
            onImportSuccess={handleImportSuccess}
            articles={articles}
            bookmarkedIds={bookmarkedIds}
            onPlayArticle={handlePlayArticle}
            onToggleBookmark={handleToggleBookmark}
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

      {/* Incoming Share Prompt Modal (VOX Share Extension / Deep Link) */}
      <ShareIncomingModal
        isOpen={isShareIncomingOpen}
        onClose={() => setIsShareIncomingOpen(false)}
        sharedItem={incomingShareItem}
        onConvertNow={handleConvertSharedNow}
        onSaveToQueue={handleSaveIncomingToQueue}
        queueCount={sharedQueue.length}
      />

      {/* Share & Content Conversion Queue Modal */}
      <ShareQueueModal
        isOpen={isShareQueueOpen}
        onClose={() => setIsShareQueueOpen(false)}
        queue={sharedQueue}
        onConvertItem={handleConvertSharedNow}
        onBatchConvertAll={handleBatchConvertQueue}
        onDeleteItem={handleDeleteQueueItem}
        onClearQueue={handleClearQueue}
        onAddNewLink={handleAddNewLinkToQueue}
        isConverting={isConvertingQueue}
      />

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

      {/* Ambient & Focus Sound Floating Mini Player Bar (Exact Screenshot Look) */}
      <AmbientMiniPlayerBar
        isAmbientActive={focusAudioState.isPlaying || isAmbientActive}
        activeAmbientName={focusAudioState.currentTrack?.title || activeAmbientName || 'Sakin Yaz Yağmuru'}
        categoryLabel={focusAudioState.currentTrack?.categoryLabel || 'DOĞA & AMBİYANS'}
        trackIndex={
          focusAudioState.currentTrack
            ? `${FOCUS_TRACKS.filter(t => t.category === focusAudioState.currentTrack?.category).findIndex(t => t.id === focusAudioState.currentTrack?.id) + 1}/${FOCUS_TRACKS.filter(t => t.category === focusAudioState.currentTrack?.category).length}`
            : '1/6'
        }
        isPlaying={focusAudioState.isPlaying || isAmbientActive}
        onTogglePlay={() => focusAudioService.togglePlay()}
        onPlayNext={() => focusAudioService.playNext()}
        onPlayPrevious={() => focusAudioService.playPrevious()}
        onStopAll={() => {
          focusAudioService.stop();
          handleStopAllAmbient();
        }}
        onOpenListenTab={() => handleTabChange('listen')}
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

      {/* Bottom Mobile Navigation (iOS Liquid Glass Floating Capsule) */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={handleTabChange}
        isPlaying={playbackState.isPlaying || focusAudioState.isPlaying}
        isHidden={isReaderNavHidden}
        themeMode={themeMode}
        onToggleTheme={handleToggleTheme}
      />
    </div>
  );
}
