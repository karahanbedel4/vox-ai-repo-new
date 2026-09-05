/**
 * WoodRainSynth - Ultra-Soothing Web Audio API Sound Generator
 * Generates warm, velvet-smooth natural acoustics and binaural sleep/focus drones.
 * ZERO harsh treble, ZERO white-noise hiss, 100% warm, relaxing, and sleep-friendly.
 */

export class WoodRainSynthEngine {
  private ctx: AudioContext | null = null;
  private isRunning: boolean = false;
  private masterGain: GainNode | null = null;

  // Sound channels
  private channelGains: Map<string, GainNode> = new Map();
  private channelAudios: Map<string, HTMLAudioElement> = new Map();

  // Active procedural generators
  private activeGenerators: { stop: () => void }[] = [];

  constructor() {
    // Lazy initialized on first user touch / interaction
  }

  /**
   * Unlock Web Audio API during user touch / click gesture (vital for iOS WKWebView)
   */
  public unlockAudio() {
    const ctx = this.initCtx();
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      try {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      } catch {}
    }
  }

  public suspend() {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private initCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.7;
        this.masterGain.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') {
        ctxResume(this.ctx);
      }
      return this.ctx;
    } catch (e) {
      console.warn('AudioContext init failed:', e);
      return null;
    }
  }

  public start() {
    const ctx = this.initCtx();
    if (!ctx) return;
    if (this.isRunning) return;
    this.isRunning = true;

    // Build ultra-warm, soft synthesized generators
    this.startVelvetRainSynth();
    this.startForestWoodRainSynth();
    this.startDeepOceanSynth();
    this.startWarmFireplaceSynth();
    this.startBinauralAlphaSynth();
    this.startWarmAmbientPadSynth();
  }

  public stop() {
    this.activeGenerators.forEach(gen => {
      try { gen.stop(); } catch (e) {}
    });
    this.activeGenerators = [];
    this.channelAudios.forEach(audio => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (e) {}
    });
    this.channelGains.forEach(gain => {
      if (this.ctx) {
        try {
          gain.gain.setValueAtTime(0, this.ctx.currentTime);
        } catch (e) {}
      }
    });
    this.isRunning = false;
  }

  public setWoodVolume(volume: number) {
    this.setChannelVolume('woodrain', volume);
  }

  public setRainVolume(volume: number) {
    this.setChannelVolume('rain', volume);
  }

  public setChannelVolume(channelId: string, volume: number) {
    const ctx = this.initCtx();
    if (!ctx || !this.masterGain) return;

    if (!this.isRunning) {
      this.start();
    }

    let gain = this.channelGains.get(channelId);
    if (!gain) {
      gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.connect(this.masterGain);
      this.channelGains.set(channelId, gain);
    }

    const targetVal = Math.max(0, Math.min(1, volume));
    try {
      gain.gain.setTargetAtTime(targetVal, ctx.currentTime, 0.08);
    } catch (e) {
      gain.gain.value = targetVal;
    }

    const customAudio = this.channelAudios.get(channelId);
    if (customAudio) {
      customAudio.volume = targetVal;
      if (targetVal > 0 && customAudio.paused) {
        customAudio.play().catch(() => {});
      } else if (targetVal === 0 && !customAudio.paused) {
        customAudio.pause();
      }
    }
  }

  // 1. Channel: Velvet Rain (Deep filtered warm rain texture, steep 400Hz lowpass, zero harsh treble)
  private startVelvetRainSynth() {
    if (!this.ctx || !this.masterGain) return;

    const sampleRate = this.ctx.sampleRate;
    const bufferSize = 2 * sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const output = noiseBuffer.getChannelData(0);

    // Warm deep brown noise algorithm (pure gentle rumble)
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.018 * white) / 1.018;
      lastOut = output[i];
      output[i] *= 2.2;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    // Dual cascade lowpass filters for ultra-soft texture
    const filter1 = this.ctx.createBiquadFilter();
    filter1.type = 'lowpass';
    filter1.frequency.value = 380;
    filter1.Q.value = 0.7;

    const filter2 = this.ctx.createBiquadFilter();
    filter2.type = 'lowpass';
    filter2.frequency.value = 420;
    filter2.Q.value = 0.5;

    const channelGain = this.ctx.createGain();
    channelGain.gain.value = 0.0;
    this.channelGains.set('rain', channelGain);

    source.connect(filter1);
    filter1.connect(filter2);
    filter2.connect(channelGain);
    channelGain.connect(this.masterGain);

    source.start();
    this.activeGenerators.push({
      stop: () => {
        try { source.stop(); } catch (e) {}
      }
    });
  }

  // 2. Channel: Forest Wood Rain (Soft organic marimba drops on moss & pine)
  private startForestWoodRainSynth() {
    if (!this.ctx || !this.masterGain) return;

    const channelGain = this.ctx.createGain();
    channelGain.gain.value = 0.0;
    this.channelGains.set('woodrain', channelGain);
    channelGain.connect(this.masterGain);

    let isTimerActive = true;

    const triggerDroplet = () => {
      if (!this.ctx || !isTimerActive) return;

      // Soft pentatonic frequencies (329Hz, 392Hz, 440Hz, 523Hz, 659Hz - E4, G4, A4, C5, E5)
      const pentatonic = [329.6, 392.0, 440.0, 523.2, 587.3, 659.2];
      const freq = pentatonic[Math.floor(Math.random() * pentatonic.length)];

      const osc = this.ctx.createOscillator();
      const dropGain = this.ctx.createGain();
      const dropFilter = this.ctx.createBiquadFilter();

      osc.type = 'sine';
      dropFilter.type = 'lowpass';
      dropFilter.frequency.value = 600;

      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.85, now + 0.08);

      dropGain.gain.setValueAtTime(0, now);
      dropGain.gain.linearRampToValueAtTime(0.045 + Math.random() * 0.035, now + 0.008);
      dropGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12 + Math.random() * 0.06);

      osc.connect(dropFilter);
      dropFilter.connect(dropGain);
      dropGain.connect(channelGain);

      osc.start(now);
      osc.stop(now + 0.22);

      const nextDelay = 120 + Math.random() * 260;
      setTimeout(triggerDroplet, nextDelay);
    };

    triggerDroplet();

    this.activeGenerators.push({
      stop: () => {
        isTimerActive = false;
      }
    });
  }

  // 3. Channel: Deep Ocean Waves (Gentle tidal swells modulated by slow 0.06Hz sine wave)
  private startDeepOceanSynth() {
    if (!this.ctx || !this.masterGain) return;

    const sampleRate = this.ctx.sampleRate;
    const bufferSize = 2 * sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.015 * white) / 1.015;
      lastOut = output[i];
      output[i] *= 3.0;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    filter.Q.value = 0.8;

    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.06; // 16-second organic wave swell cycle

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 140; // Modulate between 100Hz and 380Hz

    lfo.connect(filter.frequency);

    const channelGain = this.ctx.createGain();
    channelGain.gain.value = 0.0;
    this.channelGains.set('waves', channelGain);

    source.connect(filter);
    filter.connect(channelGain);
    channelGain.connect(this.masterGain);

    source.start();
    lfo.start();

    this.activeGenerators.push({
      stop: () => {
        try {
          source.stop();
          lfo.stop();
        } catch (e) {}
      }
    });
  }

  // 4. Channel: Cozy Fireplace & Warm Hearth (Deep sub-warmth + gentle soft embers)
  private startWarmFireplaceSynth() {
    if (!this.ctx || !this.masterGain) return;

    const channelGain = this.ctx.createGain();
    channelGain.gain.value = 0.0;
    this.channelGains.set('fireplace', channelGain);
    channelGain.connect(this.masterGain);

    let isTimerActive = true;

    // Soothing hearth drone (55Hz gentle sub tone)
    const humOsc = this.ctx.createOscillator();
    humOsc.type = 'sine';
    humOsc.frequency.value = 55;
    const humGain = this.ctx.createGain();
    humGain.gain.value = 0.035;
    humOsc.connect(humGain);
    humGain.connect(channelGain);
    humOsc.start();

    // Gentle soft ember pops (smooth triangle with fast lowpass decay)
    const triggerEmber = () => {
      if (!this.ctx || !isTimerActive) return;

      const osc = this.ctx.createOscillator();
      const popGain = this.ctx.createGain();
      const popFilter = this.ctx.createBiquadFilter();

      osc.type = 'triangle';
      popFilter.type = 'lowpass';
      popFilter.frequency.value = 350;

      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(80 + Math.random() * 90, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.035);

      popGain.gain.setValueAtTime(0, now);
      popGain.gain.linearRampToValueAtTime(0.025 + Math.random() * 0.02, now + 0.002);
      popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

      osc.connect(popFilter);
      popFilter.connect(popGain);
      popGain.connect(channelGain);

      osc.start(now);
      osc.stop(now + 0.045);

      const nextDelay = 220 + Math.random() * 550;
      setTimeout(triggerEmber, nextDelay);
    };

    triggerEmber();

    this.activeGenerators.push({
      stop: () => {
        isTimerActive = false;
        try { humOsc.stop(); } catch (e) {}
      }
    });
  }

  // 5. Channel: Binaural Alpha & Theta Sleep Frequency (136.1Hz Cosmic Om + 10Hz Alpha / 6Hz Theta Focus)
  private startBinauralAlphaSynth() {
    if (!this.ctx || !this.masterGain) return;

    const channelGain = this.ctx.createGain();
    channelGain.gain.value = 0.0;
    this.channelGains.set('binaural', channelGain);
    channelGain.connect(this.masterGain);

    const baseFreq = 136.1; // Soothing 136.1Hz Frequency (Om tone)
    const alphaFreq = 8.0;   // 8Hz Alpha / Theta bridge for deep sleep & focus

    const oscLeft = this.ctx.createOscillator();
    oscLeft.type = 'sine';
    oscLeft.frequency.value = baseFreq;

    const oscRight = this.ctx.createOscillator();
    oscRight.type = 'sine';
    oscRight.frequency.value = baseFreq + alphaFreq;

    const pannerLeft = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    const pannerRight = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

    const sineGain = this.ctx.createGain();
    sineGain.gain.value = 0.12;

    if (pannerLeft && pannerRight) {
      pannerLeft.pan.value = -0.7;
      pannerRight.pan.value = 0.7;
      oscLeft.connect(pannerLeft);
      pannerLeft.connect(sineGain);
      oscRight.connect(pannerRight);
      pannerRight.connect(sineGain);
    } else {
      oscLeft.connect(sineGain);
      oscRight.connect(sineGain);
    }
    sineGain.connect(channelGain);

    oscLeft.start();
    oscRight.start();

    this.activeGenerators.push({
      stop: () => {
        try {
          oscLeft.stop();
          oscRight.stop();
        } catch (e) {}
      }
    });
  }

  // 6. Channel: Warm Ambient Sleep Pad (432Hz Major 7th Ethereal Drone for Bedtime & Soundtracks)
  private startWarmAmbientPadSynth() {
    if (!this.ctx || !this.masterGain) return;

    const channelGain = this.ctx.createGain();
    channelGain.gain.value = 0.0;
    this.channelGains.set('pad', channelGain);
    channelGain.connect(this.masterGain);

    // Warm chords (A2 110Hz, E3 164.8Hz, A3 220Hz, C#4 277.2Hz)
    const freqs = [108.0, 162.0, 216.0, 270.0];
    const oscs: OscillatorNode[] = [];

    const padFilter = this.ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 350;

    const padGain = this.ctx.createGain();
    padGain.gain.value = 0.08;

    freqs.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      // Slight detune for analog shimmer
      osc.detune.value = (idx % 2 === 0 ? 3 : -3);
      osc.connect(padFilter);
      osc.start();
      oscs.push(osc);
    });

    padFilter.connect(padGain);
    padGain.connect(channelGain);

    this.activeGenerators.push({
      stop: () => {
        oscs.forEach(osc => {
          try { osc.stop(); } catch (e) {}
        });
      }
    });
  }

  // Add Custom Audio Stream
  public addCustomAudioStream(channelId: string, audioUrl: string) {
    if (this.channelAudios.has(channelId)) {
      const old = this.channelAudios.get(channelId);
      try { old?.pause(); } catch (e) {}
    }
    const audio = new Audio(audioUrl);
    audio.loop = true;
    audio.crossOrigin = 'anonymous';
    this.channelAudios.set(channelId, audio);
  }

  // Soothing Crystal Bell for Pomodoro Timer
  public playBellChime() {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;

      const baseFreqs = [528, 792, 1056];
      const now = ctx.currentTime;

      baseFreqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        const initialVol = 0.15 / (idx + 1);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(initialVol, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5 + idx * 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 3.0);
      });
    } catch (e) {
      console.warn('Bell chime error:', e);
    }
  }
}

function ctxResume(ctx: AudioContext) {
  try {
    ctx.resume().catch(() => {});
  } catch {}
}

export const woodRainSynth = new WoodRainSynthEngine();

