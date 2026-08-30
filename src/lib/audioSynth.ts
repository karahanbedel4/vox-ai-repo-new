/**
 * WoodRainSynth - Web Audio API Client-Side Ambient Generator
 * Synthesizes organic, gentle natural sounds (rain, forest wood drops, ocean waves, fireplace, binaural alpha waves)
 * Zero harsh frequencies, zero ringing pitch, 100% warm and soothing.
 */

export class WoodRainSynthEngine {
  private ctx: AudioContext | null = null;
  private isRunning: boolean = false;
  private masterGain: GainNode | null = null;

  // Sound channels
  private channelGains: Map<string, GainNode> = new Map();
  private channelAudios: Map<string, HTMLAudioElement> = new Map();

  // Active generators
  private activeGenerators: { stop: () => void }[] = [];

  constructor() {
    // Lazy initialized on first user interaction
  }

  /**
   * Unlock Web Audio API during user touch / click gesture (crucial for iOS WKWebView)
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
        this.masterGain.gain.value = 0.75;
        this.masterGain.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
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

    // Build synthesized sound generators with warm, pleasant filters
    this.startRainSynth();
    this.startWoodRainSynth();
    this.startOceanSynth();
    this.startFireplaceSynth();
    this.startBinauralAlphaSynth();
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
      gain.gain.setTargetAtTime(targetVal, ctx.currentTime, 0.05);
    } catch (e) {
      gain.gain.value = targetVal;
    }

    // If custom audio stream element
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

  // Channel 1: Warm Organic Rain (Pink/Brown Noise + Dual Smooth Lowpass)
  private startRainSynth() {
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    // Warm pink noise generator (pleasant, no harsh high end)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5) * 0.12;
    }

    const whiteSource = this.ctx.createBufferSource();
    whiteSource.buffer = noiseBuffer;
    whiteSource.loop = true;

    // Soothing lowpass filter (removes any hiss/screech above 750Hz)
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 750;
    filter.Q.value = 1.0;

    const channelGain = this.ctx.createGain();
    channelGain.gain.value = 0.0;
    this.channelGains.set('rain', channelGain);

    whiteSource.connect(filter);
    filter.connect(channelGain);
    channelGain.connect(this.masterGain);

    whiteSource.start();
    this.activeGenerators.push({
      stop: () => {
        try { whiteSource.stop(); } catch (e) {}
      }
    });
  }

  // Channel 2: Organic Forest Wood Drops (Gentle Marimba Rain on Leaves & Wood)
  private startWoodRainSynth() {
    if (!this.ctx || !this.masterGain) return;

    const channelGain = this.ctx.createGain();
    channelGain.gain.value = 0.0;
    this.channelGains.set('woodrain', channelGain);
    channelGain.connect(this.masterGain);

    let isTimerActive = true;

    const triggerDroplet = () => {
      if (!this.ctx || !isTimerActive) return;

      // Soft marimba resonance: 380Hz to 620Hz (calm, warm wood tones)
      const freq = 380 + Math.random() * 240;
      const osc = this.ctx.createOscillator();
      const dropGain = this.ctx.createGain();

      osc.type = 'sine';
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + 0.05);

      // Smooth attack & organic wooden decay
      dropGain.gain.setValueAtTime(0, now);
      dropGain.gain.linearRampToValueAtTime(0.08 + Math.random() * 0.08, now + 0.005);
      dropGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06 + Math.random() * 0.04);

      osc.connect(dropGain);
      dropGain.connect(channelGain);

      osc.start(now);
      osc.stop(now + 0.12);

      // Variable natural droplet spacing (80ms to 240ms)
      const nextDelay = 80 + Math.random() * 160;
      setTimeout(triggerDroplet, nextDelay);
    };

    triggerDroplet();

    this.activeGenerators.push({
      stop: () => {
        isTimerActive = false;
      }
    });
  }

  // Channel 3: Ocean Waves (Brown Noise + Slow Tidal LFO Modulation)
  private startOceanSynth() {
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    // Brown noise generator (deep, warm rumble)
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 350;

    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.08; // 12-second wave surge cycle

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 200; // Modulate filter between 150Hz and 550Hz

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

  // Channel 4: Warm Fireplace & Gentle Crackles
  private startFireplaceSynth() {
    if (!this.ctx || !this.masterGain) return;

    const channelGain = this.ctx.createGain();
    channelGain.gain.value = 0.0;
    this.channelGains.set('fireplace', channelGain);
    channelGain.connect(this.masterGain);

    let isTimerActive = true;

    // Base warm hearth hum
    const humOsc = this.ctx.createOscillator();
    humOsc.type = 'sine';
    humOsc.frequency.value = 65;
    const humGain = this.ctx.createGain();
    humGain.gain.value = 0.06;
    humOsc.connect(humGain);
    humGain.connect(channelGain);
    humOsc.start();

    // Fireplace organic wood pops
    const triggerPop = () => {
      if (!this.ctx || !isTimerActive) return;

      const osc = this.ctx.createOscillator();
      const popGain = this.ctx.createGain();

      osc.type = 'triangle';
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(120 + Math.random() * 180, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.04);

      popGain.gain.setValueAtTime(0, now);
      popGain.gain.linearRampToValueAtTime(0.04 + Math.random() * 0.04, now + 0.002);
      popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      osc.connect(popGain);
      popGain.connect(channelGain);

      osc.start(now);
      osc.stop(now + 0.05);

      const nextDelay = 150 + Math.random() * 450;
      setTimeout(triggerPop, nextDelay);
    };

    triggerPop();

    this.activeGenerators.push({
      stop: () => {
        isTimerActive = false;
        try { humOsc.stop(); } catch (e) {}
      }
    });
  }

  // Channel 5: Binaural Alpha Waves (136.1Hz Cosmic Om + 10Hz Alpha Focus, Pure Harmonic Sines)
  private startBinauralAlphaSynth() {
    if (!this.ctx || !this.masterGain) return;

    const channelGain = this.ctx.createGain();
    channelGain.gain.value = 0.0;
    this.channelGains.set('binaural', channelGain);
    channelGain.connect(this.masterGain);

    const baseFreq = 136.1; // Soothing Om Frequency
    const alphaFreq = 10.0; // 10Hz Alpha Focus

    // Left Ear
    const oscLeft = this.ctx.createOscillator();
    oscLeft.type = 'sine';
    oscLeft.frequency.value = baseFreq;

    // Right Ear (+10Hz difference)
    const oscRight = this.ctx.createOscillator();
    oscRight.type = 'sine';
    oscRight.frequency.value = baseFreq + alphaFreq;

    const pannerLeft = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    const pannerRight = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

    if (pannerLeft && pannerRight) {
      pannerLeft.pan.value = -0.8;
      pannerRight.pan.value = 0.8;
      oscLeft.connect(pannerLeft);
      pannerLeft.connect(channelGain);
      oscRight.connect(pannerRight);
      pannerRight.connect(channelGain);
    } else {
      oscLeft.connect(channelGain);
      oscRight.connect(channelGain);
    }

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

        const initialVol = 0.2 / (idx + 1);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(initialVol, now + 0.05);
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

export const woodRainSynth = new WoodRainSynthEngine();
