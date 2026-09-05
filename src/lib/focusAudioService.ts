import { woodRainSynth } from './audioSynth';

export interface FocusTrack {
  id: string;
  category: 'nature' | 'lofi' | 'soundtracks';
  categoryLabel: string;
  title: string;
  subtitle: string;
  coverImage: string;
  audioUrl?: string;
  youtubeId?: string;
  synthType?: 'rain' | 'woodrain' | 'waves' | 'fireplace' | 'binaural' | 'pad';
  durationSeconds?: number;
}

export const FOCUS_CATEGORIES = [
  { id: 'nature', label: 'Doğa & Ambiyans', icon: 'CloudRain' },
  { id: 'lofi', label: 'Lo-Fi & Odaklanma', icon: 'Music' },
  { id: 'soundtracks', label: 'Efsane Film Müzikleri', icon: 'Film' },
] as const;

export const FOCUS_TRACKS: FocusTrack[] = [
  // 1. DOĞA & ATMOSFER (Nature & Ambient Sleep)
  {
    id: 'nature-rain',
    category: 'nature',
    categoryLabel: 'DOĞA & AMBİYANS',
    title: 'Sakin Yaz Yağmuru',
    subtitle: 'Doğal Yağmur Damlaları & Cam Sesi • Kesintisiz',
    coverImage: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=600&auto=format&fit=crop&q=80',
    synthType: 'rain',
    youtubeId: 'mPZkdNFkNps'
  },
  {
    id: 'nature-forest',
    category: 'nature',
    categoryLabel: 'DOĞA & AMBİYANS',
    title: 'Huzurlu Orman & Kuşlar',
    subtitle: 'Kuş Cıvıltıları & Çam Ağacı Esintisi • Kesintisiz',
    coverImage: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&auto=format&fit=crop&q=80',
    synthType: 'woodrain',
    youtubeId: 'xNN7iTA57jM'
  },
  {
    id: 'nature-ocean',
    category: 'nature',
    categoryLabel: 'DOĞA & AMBİYANS',
    title: 'Okyanus & Sakin Dalgalar',
    subtitle: 'Kıyıya Vuran Sakin Dalgalar ve Esinti • Kesintisiz',
    coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80',
    synthType: 'waves',
    youtubeId: 'WHPEKLQID4U'
  },
  {
    id: 'nature-fireplace',
    category: 'nature',
    categoryLabel: 'DOĞA & AMBİYANS',
    title: 'Gece Şöminesi & Odun Çatırtısı',
    subtitle: 'Sıcak Şömine Odun Çatırtısı & Huzur • Kesintisiz',
    coverImage: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80',
    synthType: 'fireplace',
    youtubeId: 'L_LUpnjgPso'
  },
  {
    id: 'nature-thunder',
    category: 'nature',
    categoryLabel: 'DOĞA & AMBİYANS',
    title: 'Gece Fırtınası & Uzak Yağmur',
    subtitle: 'Uzak Gök Gürültüleri & Yağmur • Kesintisiz',
    coverImage: 'https://images.unsplash.com/photo-1605721911519-3dfeb3be25e7?w=600&auto=format&fit=crop&q=80',
    synthType: 'rain',
    youtubeId: 'sDoD21r8c5c'
  },
  {
    id: 'nature-binaural-sleep',
    category: 'nature',
    categoryLabel: 'UYKU & DİNGİNLİK',
    title: '432Hz Derin Uyku & Om Frekansı',
    subtitle: 'Binaural Theta / Delta Dalgaları • Meditatif',
    coverImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80',
    synthType: 'binaural',
    youtubeId: '1ZYbU82GVz4'
  },

  // 2. LO-FI & DERİN ODAKLANMA (Lo-Fi Beats & Flow)
  {
    id: 'lofi-chill',
    category: 'lofi',
    categoryLabel: 'LO-FI & ODAKLANMA',
    title: 'Lo-Fi Chill Study Beats',
    subtitle: 'Yumuşak Rhodes, Sakin Ritimler ve Akış',
    coverImage: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=600&auto=format&fit=crop&q=80',
    synthType: 'pad',
    youtubeId: 'jfKfPfyJRdk'
  },
  {
    id: 'lofi-piano',
    category: 'lofi',
    categoryLabel: 'KLASİK & PİYANO',
    title: 'Erik Satie - Gymnopédie No.1',
    subtitle: 'Sakinleştirici Akustik Piyano & Dinginlik',
    coverImage: 'https://images.unsplash.com/photo-1520523839898-507127027c65?w=600&auto=format&fit=crop&q=80',
    synthType: 'pad',
    audioUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e4/Gymnopedie_No._1_%28ISRC_USUAN1100787%29.mp3',
    youtubeId: 'S-Xm7s9eGxU'
  },
  {
    id: 'lofi-binaural',
    category: 'lofi',
    categoryLabel: 'BİNAURAL ODAK',
    title: 'Binaural Alpha Waves (10Hz-40Hz)',
    subtitle: 'Derin Çalışma, Kodlama ve Odak Dalgaları',
    coverImage: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&auto=format&fit=crop&q=80',
    synthType: 'binaural',
    youtubeId: 'WPni755-Krg'
  },
  {
    id: 'lofi-cafe',
    category: 'lofi',
    categoryLabel: 'KAFE AMBİYANSI',
    title: 'Gece Kahvesi & Yağmurlu Kafe',
    subtitle: 'Sıcak Kafe Mırıltısı & Akustik Caz Tınıları',
    coverImage: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&auto=format&fit=crop&q=80',
    synthType: 'rain',
    youtubeId: 'e3L1Ias45JU'
  },
  {
    id: 'lofi-space',
    category: 'lofi',
    categoryLabel: 'UZAY & DRONE',
    title: 'Deep Space Drone & Kozmik Huzur',
    subtitle: 'Ethereal Uzay Ambiyansı • Sonsuz Gece',
    coverImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80',
    synthType: 'pad',
    youtubeId: 'n4XW_Q9h6b0'
  },
  {
    id: 'lofi-synthwave',
    category: 'lofi',
    categoryLabel: 'SYNTH & CHILLWAVE',
    title: 'Retro Chillwave & Analog Gece',
    subtitle: '80s Analog Synthesizer • Akşam Dinletisi',
    coverImage: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80',
    synthType: 'pad',
    youtubeId: '4xDzrJKXOOY'
  },

  // 3. EFSANE FİLM & SİNEMA MÜZİKLERİ (Cinematic Masterpieces)
  {
    id: 'ost-interstellar',
    category: 'soundtracks',
    categoryLabel: 'SİNEMA & SOUNDTRACK',
    title: 'Interstellar (Cornfield Chase & Theme)',
    subtitle: 'Hans Zimmer • Sonsuzluk, Evren & Derin Duygu',
    coverImage: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=600&auto=format&fit=crop&q=80',
    synthType: 'pad',
    youtubeId: 'UDVtMYqUAyw'
  },
  {
    id: 'ost-inception',
    category: 'soundtracks',
    categoryLabel: 'SİNEMA & SOUNDTRACK',
    title: 'Inception (Time)',
    subtitle: 'Hans Zimmer • Derin Odak & Rüya Katmanları',
    coverImage: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=80',
    synthType: 'pad',
    youtubeId: 'RxabV9hPj7k'
  },
  {
    id: 'ost-lotr',
    category: 'soundtracks',
    categoryLabel: 'SİNEMA & SOUNDTRACK',
    title: 'Yüzüklerin Efendisi (Concerning Hobbits)',
    subtitle: 'Howard Shore • Huzurlu Kır Yaşamı & Flüt Melodisi',
    coverImage: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=600&auto=format&fit=crop&q=80',
    synthType: 'woodrain',
    youtubeId: '6i0a7RDPkM8'
  },
  {
    id: 'ost-amelie',
    category: 'soundtracks',
    categoryLabel: 'SİNEMA & SOUNDTRACK',
    title: "Amélie (Comptine d'un autre été)",
    subtitle: 'Yann Tiersen • Zarif Piyano & Nostalji',
    coverImage: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&auto=format&fit=crop&q=80',
    synthType: 'pad',
    youtubeId: 'H2-1u8xvk54'
  },
  {
    id: 'ost-bladerunner',
    category: 'soundtracks',
    categoryLabel: 'SİNEMA & SOUNDTRACK',
    title: 'Blade Runner 2049 (Tears in Rain)',
    subtitle: 'Vangelis & Hans Zimmer • Yağmurlu Neon Atmosfer',
    coverImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
    synthType: 'pad',
    youtubeId: 'sKkWV_rU694'
  },
  {
    id: 'ost-gladiator',
    category: 'soundtracks',
    categoryLabel: 'SİNEMA & SOUNDTRACK',
    title: 'Gladiator (Now We Are Free)',
    subtitle: 'Hans Zimmer & Lisa Gerrard • Epik Huzur ve Dinginlik',
    coverImage: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&auto=format&fit=crop&q=80',
    synthType: 'pad',
    youtubeId: 'NBE-uBgtINg'
  }
];

class FocusAudioPlayerManager {
  private currentTrack: FocusTrack | null = null;
  private isPlaying: boolean = false;
  private volume: number = 80; // 0-100
  private isLooping: boolean = true; // Continuous loop for sleep / study
  private isSequential: boolean = false;
  private audioEl: HTMLAudioElement | null = null;
  private activeSynthChannel: string | null = null;
  private activeYouTubeId: string | null = null;
  private listeners: Set<() => void> = new Set();
  
  // Sleep Timer
  private sleepTimerMinutes: number | null = null;
  private sleepTimerEndTime: number | null = null;
  private sleepTimerInterval: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.audioEl = new Audio();
        this.audioEl.loop = true;
        this.audioEl.preload = 'auto';
        this.audioEl.setAttribute('playsinline', 'true');
        this.audioEl.setAttribute('webkit-playsinline', 'true');

        this.audioEl.addEventListener('ended', () => {
          if (this.isLooping) {
            if (this.audioEl) {
              this.audioEl.currentTime = 0;
              this.audioEl.play().catch(() => {});
            }
          } else if (this.isSequential) {
            this.playNext();
          } else {
            this.isPlaying = false;
            this.notify();
          }
        });

        this.audioEl.addEventListener('play', () => {
          this.isPlaying = true;
          this.notify();
        });

        this.audioEl.addEventListener('pause', () => {
          if (!this.activeSynthChannel) {
            this.isPlaying = false;
            this.notify();
          }
        });

        this.audioEl.addEventListener('error', () => {
          console.warn('HTML5 audio stream fallback triggered for track:', this.currentTrack?.title);
          // Seamlessly activate warm procedural ambient synthesizer
          this.activateSynthForTrack(this.currentTrack);
        });
      } catch (e) {
        console.warn('Audio init error:', e);
      }
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => {
      try { l(); } catch (e) {}
    });
  }

  public getState() {
    let remainingSeconds = 0;
    if (this.sleepTimerEndTime) {
      remainingSeconds = Math.max(0, Math.ceil((this.sleepTimerEndTime - Date.now()) / 1000));
    }

    return {
      currentTrack: this.currentTrack,
      isPlaying: this.isPlaying,
      volume: this.volume,
      isLooping: this.isLooping,
      isSequential: this.isSequential,
      activeYouTubeId: this.activeYouTubeId,
      activeSynthChannel: this.activeSynthChannel,
      sleepTimerMinutes: this.sleepTimerMinutes,
      sleepTimerRemainingSeconds: remainingSeconds,
      trackList: FOCUS_TRACKS,
    };
  }

  public setLooping(val: boolean) {
    this.isLooping = val;
    if (this.audioEl) {
      this.audioEl.loop = val;
    }
    this.notify();
  }

  public setSequential(val: boolean) {
    this.isSequential = val;
    this.notify();
  }

  public setSleepTimer(minutes: number | null) {
    if (this.sleepTimerInterval) {
      clearInterval(this.sleepTimerInterval);
      this.sleepTimerInterval = null;
    }

    this.sleepTimerMinutes = minutes;
    if (minutes && minutes > 0) {
      this.sleepTimerEndTime = Date.now() + minutes * 60 * 1000;
      this.sleepTimerInterval = setInterval(() => {
        if (!this.sleepTimerEndTime || Date.now() >= this.sleepTimerEndTime) {
          this.onSleepTimerExpired();
        } else {
          this.notify();
        }
      }, 1000);
    } else {
      this.sleepTimerEndTime = null;
    }
    this.notify();
  }

  private onSleepTimerExpired() {
    if (this.sleepTimerInterval) {
      clearInterval(this.sleepTimerInterval);
      this.sleepTimerInterval = null;
    }
    this.sleepTimerMinutes = null;
    this.sleepTimerEndTime = null;
    
    // Gentle crystal bell chime before turning off
    try {
      woodRainSynth.playBellChime();
    } catch {}

    // Gentle fade out over 3 seconds
    let currentVol = this.volume;
    const fadeInterval = setInterval(() => {
      currentVol -= 10;
      if (currentVol <= 0) {
        clearInterval(fadeInterval);
        this.pause();
        this.setVolume(80); // Reset volume for next time
      } else {
        this.setVolume(currentVol);
      }
    }, 300);

    this.notify();
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(100, vol));
    const normalizedVol = this.volume / 100;

    if (this.audioEl) {
      this.audioEl.volume = normalizedVol;
    }

    if (this.activeSynthChannel) {
      woodRainSynth.setChannelVolume(this.activeSynthChannel, normalizedVol);
    }

    this.notify();
  }

  private activateSynthForTrack(track: FocusTrack | null) {
    if (!track) return;
    const synthCh = track.synthType || 'pad';
    this.activeSynthChannel = synthCh;
    woodRainSynth.unlockAudio();
    woodRainSynth.start();
    woodRainSynth.setChannelVolume(synthCh, this.volume / 100);
    this.isPlaying = true;
    this.notify();
  }

  private stopActiveSynth() {
    if (this.activeSynthChannel) {
      woodRainSynth.setChannelVolume(this.activeSynthChannel, 0);
      this.activeSynthChannel = null;
    }
  }

  public playTrack(track: FocusTrack) {
    woodRainSynth.unlockAudio();
    this.stopActiveSynth();
    this.currentTrack = track;
    this.activeYouTubeId = track.youtubeId || null;
    this.isPlaying = true;

    // 1. If audioUrl exists (e.g. Erik Satie Gymnopédie), play HTML5 Audio with loop
    if (this.audioEl && track.audioUrl) {
      try {
        this.audioEl.pause();
        this.audioEl.src = track.audioUrl;
        this.audioEl.loop = this.isLooping;
        this.audioEl.volume = this.volume / 100;
        const playPromise = this.audioEl.play();

        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('Audio play exception, switching to procedural synth:', err);
            this.activateSynthForTrack(track);
          });
        }
      } catch (err) {
        this.activateSynthForTrack(track);
      }
    } else {
      // 2. Pure acoustic ambient synthesis (Rain, Forest, Ocean, Fireplace, 432Hz Om, Pad)
      this.activateSynthForTrack(track);
    }

    this.notify();
  }

  public togglePlay() {
    woodRainSynth.unlockAudio();
    if (!this.currentTrack) {
      this.playTrack(FOCUS_TRACKS[0]);
      return;
    }

    if (this.isPlaying) {
      this.pause();
    } else {
      this.resume();
    }
  }

  public pause() {
    this.isPlaying = false;
    if (this.audioEl) {
      try { this.audioEl.pause(); } catch (e) {}
    }
    this.stopActiveSynth();
    woodRainSynth.suspend();
    this.notify();
  }

  public resume() {
    woodRainSynth.unlockAudio();
    if (!this.currentTrack) {
      this.playTrack(FOCUS_TRACKS[0]);
      return;
    }
    this.isPlaying = true;
    woodRainSynth.resume();

    if (this.currentTrack.audioUrl && this.audioEl && this.audioEl.src) {
      this.audioEl.play().catch(() => {
        this.activateSynthForTrack(this.currentTrack);
      });
    } else if (this.currentTrack) {
      this.activateSynthForTrack(this.currentTrack);
    }

    this.notify();
  }

  public stop() {
    this.isPlaying = false;
    this.currentTrack = null;
    this.activeYouTubeId = null;
    if (this.audioEl) {
      try {
        this.audioEl.pause();
        this.audioEl.currentTime = 0;
      } catch (e) {}
    }
    this.stopActiveSynth();
    woodRainSynth.stop();
    this.notify();
  }

  public playNext() {
    woodRainSynth.unlockAudio();
    const list = this.currentTrack 
      ? FOCUS_TRACKS.filter(t => t.category === this.currentTrack?.category) 
      : FOCUS_TRACKS;
    
    if (list.length === 0) return;
    
    const currentIndex = this.currentTrack ? list.findIndex(t => t.id === this.currentTrack?.id) : -1;
    const nextIndex = (currentIndex + 1) % list.length;
    this.playTrack(list[nextIndex]);
  }

  public playPrevious() {
    woodRainSynth.unlockAudio();
    const list = this.currentTrack 
      ? FOCUS_TRACKS.filter(t => t.category === this.currentTrack?.category) 
      : FOCUS_TRACKS;
    
    if (list.length === 0) return;
    
    const currentIndex = this.currentTrack ? list.findIndex(t => t.id === this.currentTrack?.id) : 0;
    const prevIndex = (currentIndex - 1 + list.length) % list.length;
    this.playTrack(list[prevIndex]);
  }

  public playCategoryAll(category: 'nature' | 'lofi' | 'soundtracks') {
    woodRainSynth.unlockAudio();
    const list = FOCUS_TRACKS.filter(t => t.category === category);
    if (list.length > 0) {
      this.isSequential = true;
      this.playTrack(list[0]);
    }
  }
}

export const focusAudioService = new FocusAudioPlayerManager();

