import { woodRainSynth } from './audioSynth';

export interface FocusTrack {
  id: string;
  category: 'nature' | 'lofi' | 'soundtracks';
  categoryLabel: string;
  title: string;
  subtitle: string;
  coverImage: string;
  audioUrl?: string;
  synthType?: 'rain' | 'woodrain' | 'waves' | 'fireplace' | 'binaural';
  durationSeconds?: number;
}

export const FOCUS_CATEGORIES = [
  { id: 'nature', label: 'Doğa & Atmosfer', icon: 'CloudRain' },
  { id: 'lofi', label: 'Lo-Fi & Derin Odaklanma', icon: 'Music' },
  { id: 'soundtracks', label: 'Efsane Film & Sinema Müzikleri', icon: 'Film' },
] as const;

export const FOCUS_TRACKS: FocusTrack[] = [
  // 1. DOĞA & ATMOSFER
  {
    id: 'nature-rain',
    category: 'nature',
    categoryLabel: 'DOĞA & AMBİYANS',
    title: 'Sakin Yaz Yağmuru',
    subtitle: 'Doğal Yağmur Damlaları & Cam Sesi',
    coverImage: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=600&auto=format&fit=crop&q=80',
    synthType: 'rain',
    audioUrl: 'https://cdn.freesound.org/previews/531/531947_11861866-lq.mp3'
  },
  {
    id: 'nature-forest',
    category: 'nature',
    categoryLabel: 'DOĞA & AMBİYANS',
    title: 'Huzurlu Orman & Kuşlar',
    subtitle: 'Kuş Cıvıltıları & Çam Ağacı Esintisi',
    coverImage: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&auto=format&fit=crop&q=80',
    synthType: 'woodrain',
    audioUrl: 'https://cdn.freesound.org/previews/235/235428_4056007-lq.mp3'
  },
  {
    id: 'nature-ocean',
    category: 'nature',
    categoryLabel: 'DOĞA & AMBİYANS',
    title: 'Okyanus & Sakin Dalgalar',
    subtitle: 'Kıyıya Vuran Sakin Dalgalar ve Esinti',
    coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80',
    synthType: 'waves',
    audioUrl: 'https://cdn.freesound.org/previews/400/400632_5121236-lq.mp3'
  },
  {
    id: 'nature-fireplace',
    category: 'nature',
    categoryLabel: 'DOĞA & AMBİYANS',
    title: 'Gece Şöminesi & Odun Çatırtısı',
    subtitle: 'Sıcak Şömine Odun Çatırtısı & Huzur',
    coverImage: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80',
    synthType: 'fireplace',
    audioUrl: 'https://cdn.freesound.org/previews/435/435413_7614679-lq.mp3'
  },
  {
    id: 'nature-thunder',
    category: 'nature',
    categoryLabel: 'DOĞA & AMBİYANS',
    title: 'Fırtına & Sakin Yağmur',
    subtitle: 'Uzak Gök Gürültüleri & Yağmur',
    coverImage: 'https://images.unsplash.com/photo-1605721911519-3dfeb3be25e7?w=600&auto=format&fit=crop&q=80',
    synthType: 'rain',
    audioUrl: 'https://cdn.freesound.org/previews/517/517658_11234907-lq.mp3'
  },
  {
    id: 'nature-wind',
    category: 'nature',
    categoryLabel: 'DOĞA & AMBİYANS',
    title: 'Dağ Rüzgarı & Yüksek İrtifa',
    subtitle: 'Sakin Zirve Esintisi & Dinginlik',
    coverImage: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&auto=format&fit=crop&q=80',
    synthType: 'waves',
    audioUrl: 'https://cdn.freesound.org/previews/442/442943_9159316-lq.mp3'
  },

  // 2. LO-FI & DERİN ODAKLANMA
  {
    id: 'lofi-chill',
    category: 'lofi',
    categoryLabel: 'LO-FI & ODAKLANMA',
    title: 'Lo-Fi Chill Beats',
    subtitle: 'Lo-Fi Odak • Yumuşak Rhodes ve Vuruşlar',
    coverImage: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=600&auto=format&fit=crop&q=80',
    synthType: 'binaural',
    audioUrl: 'https://cdn.freesound.org/previews/608/608645_11861866-lq.mp3'
  },
  {
    id: 'lofi-binaural',
    category: 'lofi',
    categoryLabel: 'BİNAURAL ODAK',
    title: 'Binaural Alpha Waves (10Hz-40Hz)',
    subtitle: 'Binaural Focus • Meditatif ve Derin Akış',
    coverImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80',
    synthType: 'binaural',
    audioUrl: 'https://cdn.freesound.org/previews/665/665181_11861866-lq.mp3'
  },
  {
    id: 'lofi-piano',
    category: 'lofi',
    categoryLabel: 'KLASİK & PİYANO',
    title: 'Ambient Piyano & Erik Satie',
    subtitle: 'Gymnopédie No.1 • Sakinleştirici Tuşlar',
    coverImage: 'https://images.unsplash.com/photo-1520523839898-507127027c65?w=600&auto=format&fit=crop&q=80',
    synthType: 'binaural',
    audioUrl: 'https://ia800504.us.archive.org/11/items/GymnopedieNo.1_545/GymnopedieNo1.mp3'
  },
  {
    id: 'lofi-cafe',
    category: 'lofi',
    categoryLabel: 'KAFE AMBİYANSI',
    title: 'Gece Kahvesi & Yağmur',
    subtitle: 'Sıcak Kafe Mırıltısı & Sakin Caz',
    coverImage: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&auto=format&fit=crop&q=80',
    synthType: 'rain',
    audioUrl: 'https://cdn.freesound.org/previews/416/416529_5121236-lq.mp3'
  },
  {
    id: 'lofi-synthwave',
    category: 'lofi',
    categoryLabel: 'SYNTH & CHILLWAVE',
    title: 'Derin Kodlama & Synthwave',
    subtitle: 'Retro Chillwave • 80s Analog Gece',
    coverImage: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80',
    synthType: 'binaural',
    audioUrl: 'https://cdn.freesound.org/previews/615/615099_11861866-lq.mp3'
  },
  {
    id: 'lofi-space',
    category: 'lofi',
    categoryLabel: 'UZAY & DRONE',
    title: 'Uzay Boşluğu & Derin Dinginlik',
    subtitle: 'Deep Space Drone • Sonsuz Gece',
    coverImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80',
    synthType: 'binaural',
    audioUrl: 'https://cdn.freesound.org/previews/538/538982_11861866-lq.mp3'
  },

  // 3. EFSANE FİLM & SİNEMA MÜZİKLERİ
  {
    id: 'ost-interstellar',
    category: 'soundtracks',
    categoryLabel: 'SİNEMA & SOUNDTRACK',
    title: 'Interstellar (Cornfield Chase)',
    subtitle: 'Hans Zimmer • Sonsuzluk & Evren',
    coverImage: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=600&auto=format&fit=crop&q=80',
    synthType: 'binaural',
    audioUrl: 'https://ia600504.us.archive.org/11/items/InterstellarMainTheme/Interstellar.mp3'
  },
  {
    id: 'ost-inception',
    category: 'soundtracks',
    categoryLabel: 'SİNEMA & SOUNDTRACK',
    title: 'Inception (Time)',
    subtitle: 'Hans Zimmer • Derin Odak & Rüya Katmanları',
    coverImage: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=80',
    synthType: 'binaural',
    audioUrl: 'https://ia800504.us.archive.org/11/items/InceptionTimeTheme/Time.mp3'
  },
  {
    id: 'ost-lotr',
    category: 'soundtracks',
    categoryLabel: 'SİNEMA & SOUNDTRACK',
    title: 'Yüzüklerin Efendisi (The Shire)',
    subtitle: 'Howard Shore • Huzurlu Kır Yaşamı & Flüt',
    coverImage: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=600&auto=format&fit=crop&q=80',
    synthType: 'woodrain',
    audioUrl: 'https://ia800504.us.archive.org/11/items/LotrConcerningHobbits/Hobbits.mp3'
  },
  {
    id: 'ost-bladerunner',
    category: 'soundtracks',
    categoryLabel: 'SİNEMA & SOUNDTRACK',
    title: 'Blade Runner 2049 Synth',
    subtitle: 'Vangelis & Zimmer • Yağmurlu Neon Gece',
    coverImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
    synthType: 'binaural',
    audioUrl: 'https://cdn.freesound.org/previews/615/615099_11861866-lq.mp3'
  },
  {
    id: 'ost-amelie',
    category: 'soundtracks',
    categoryLabel: 'SİNEMA & SOUNDTRACK',
    title: "Amélie (Comptine d'un autre été)",
    subtitle: 'Yann Tiersen • Akordeon ve Zarif Piyano',
    coverImage: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&auto=format&fit=crop&q=80',
    synthType: 'binaural',
    audioUrl: 'https://ia800504.us.archive.org/11/items/GymnopedieNo.1_545/GymnopedieNo1.mp3'
  },
  {
    id: 'ost-gladiator',
    category: 'soundtracks',
    categoryLabel: 'SİNEMA & SOUNDTRACK',
    title: 'Gladiator (Now We Are Free)',
    subtitle: 'Hans Zimmer & Lisa Gerrard • Epik Huzur',
    coverImage: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&auto=format&fit=crop&q=80',
    synthType: 'binaural',
    audioUrl: 'https://ia800504.us.archive.org/11/items/InceptionTimeTheme/Time.mp3'
  }
];

class FocusAudioPlayerManager {
  private currentTrack: FocusTrack | null = null;
  private isPlaying: boolean = false;
  private volume: number = 75; // 0-100
  private isSequential: boolean = true;
  private audioEl: HTMLAudioElement | null = null;
  private activeSynthChannel: string | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.audioEl = new Audio();
        this.audioEl.loop = false;
        this.audioEl.preload = 'auto';
        this.audioEl.setAttribute('playsinline', 'true');
        this.audioEl.setAttribute('webkit-playsinline', 'true');

        this.audioEl.addEventListener('ended', () => {
          if (this.isSequential) {
            this.playNext();
          } else {
            // Replay current track
            if (this.audioEl) {
              this.audioEl.currentTime = 0;
              this.audioEl.play().catch(() => {});
            }
          }
        });

        this.audioEl.addEventListener('play', () => {
          this.isPlaying = true;
          this.notify();
        });

        this.audioEl.addEventListener('pause', () => {
          // If paused manually and no synth is running
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
    return {
      currentTrack: this.currentTrack,
      isPlaying: this.isPlaying,
      volume: this.volume,
      isSequential: this.isSequential,
      trackList: FOCUS_TRACKS,
    };
  }

  public setSequential(val: boolean) {
    this.isSequential = val;
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
    const synthCh = track.synthType || 'binaural';
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
    // Unlock iOS Web Audio session synchronously inside user touch event
    woodRainSynth.unlockAudio();
    this.stopActiveSynth();
    this.currentTrack = track;
    this.isPlaying = true;

    // For nature category or when synthType is designated, prioritize instant zero-lag procedural synth
    if (track.category === 'nature' || (!track.audioUrl && track.synthType)) {
      this.activateSynthForTrack(track);
      this.notify();
      return;
    }

    if (this.audioEl && track.audioUrl) {
      try {
        this.audioEl.pause();
        this.audioEl.src = track.audioUrl;
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

    if (this.currentTrack.category === 'nature' || this.activeSynthChannel) {
      this.activateSynthForTrack(this.currentTrack);
    } else if (this.audioEl && this.audioEl.src) {
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
