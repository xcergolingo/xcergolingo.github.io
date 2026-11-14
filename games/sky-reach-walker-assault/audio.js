/** Original procedural soundscape. No downloads, samples, music, or licensed cues. */
export class GameAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.ready = false;
    this.last = new Map();
    this.voices = new Set();
    this.maxVoices = 28;
    this.volume = 0.36;
    this.unlocking = null;
  }

  async unlock() {
    if (this.unlocking) return this.unlocking;
    const AudioCtx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AudioCtx) return false;
    try {
      if (!this.context) {
        // Construct synchronously in the Launch/touch handler, before the first await.
        const c = this.context = new AudioCtx({ latencyHint: 'interactive' });
        this.master = c.createGain();
        this.master.gain.value = this.muted ? 0 : this.volume;
        const compressor = c.createDynamicsCompressor();
        compressor.threshold.value = -19;
        compressor.knee.value = 18;
        compressor.ratio.value = 5;
        compressor.attack.value = 0.006;
        compressor.release.value = 0.24;
        this.master.connect(compressor);
        compressor.connect(c.destination);

        this.noiseBuffer = c.createBuffer(1, Math.ceil(c.sampleRate * 2), c.sampleRate);
        const samples = this.noiseBuffer.getChannelData(0);
        let smooth = 0;
        for (let i = 0; i < samples.length; i++) {
          smooth = smooth * 0.965 + (Math.random() * 2 - 1) * 0.18;
          samples[i] = smooth * 1.4 + (Math.random() * 2 - 1) * 0.17;
        }
        this.engineBus = c.createGain();
        this.engineBus.gain.value = 0;
        this.engineFilter = c.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 420;
        this.engineFilter.Q.value = 0.8;
        this.engineBus.connect(this.engineFilter).connect(this.master);
        this.engineA = c.createOscillator();
        this.engineA.type = 'triangle';
        this.engineA.frequency.value = 46;
        this.engineA.connect(this.engineBus);
        this.engineA.start();
        this.engineB = c.createOscillator();
        this.engineB.type = 'sawtooth';
        this.engineB.frequency.value = 69.3;
        const quieter = c.createGain();
        quieter.gain.value = 0.18;
        this.engineB.connect(quieter).connect(this.engineBus);
        this.engineB.start();

        this.airSource = c.createBufferSource();
        this.airSource.buffer = this.noiseBuffer;
        this.airSource.loop = true;
        this.windFilter = c.createBiquadFilter();
        this.windFilter.type = 'bandpass';
        this.windFilter.frequency.value = 550;
        this.windFilter.Q.value = 0.5;
        this.windBus = c.createGain();
        this.windBus.gain.value = 0;
        this.airSource.connect(this.windFilter).connect(this.windBus).connect(this.master);
        this.jetFilter = c.createBiquadFilter();
        this.jetFilter.type = 'highpass';
        this.jetFilter.frequency.value = 1400;
        this.jetBus = c.createGain();
        this.jetBus.gain.value = 0;
        this.airSource.connect(this.jetFilter).connect(this.jetBus).connect(this.master);
        this.airSource.start();

        this.pulseTone = c.createOscillator();
        this.pulseTone.type = 'sine';
        this.pulseTone.frequency.value = 110;
        this.pulseBus = c.createGain();
        this.pulseBus.gain.value = 0;
        this.pulseTone.connect(this.pulseBus).connect(this.master);
        this.pulseTone.start();

        // A silent source also unlocks older iOS WebKit audio output paths.
        const primer = c.createBufferSource();
        primer.buffer = c.createBuffer(1, 1, c.sampleRate);
        primer.connect(this.master);
        primer.start();
      }
      const c = this.context;
      this.unlocking = (async () => {
        if (c.state === 'suspended') await c.resume();
        this.ready = c.state === 'running';
        return this.ready;
      })();
      return await this.unlocking;
    } catch (_) {
      this.ready = false;
      return false;
    } finally {
      this.unlocking = null;
    }
  }

  setMuted(value) {
    this.muted = Boolean(value);
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, 0.04);
    }
  }

  update({ speed = 0, boost = false, space = false, onFoot = false, jetpack = false, pulse = false } = {}, dt = 0.016) {
    const c = this.context;
    if (!c || c.state !== 'running') return;
    const t = c.currentTime;
    const v = Math.min(1.6, Math.max(0, Number(speed) || 0) / 280);
    const boosting = Math.min(1, Number(boost) || 0);
    const pulsing = Math.min(1, Number(pulse) || 0);
    const flying = onFoot ? 0 : 1;
    const smoothing = Math.max(0.035, Math.min(0.1, dt * 4));
    this.engineA.frequency.setTargetAtTime(43 + v * 42 + boosting * 26 + pulsing * 65, t, smoothing);
    this.engineB.frequency.setTargetAtTime(65 + v * 62 + boosting * 39 + pulsing * 97, t, smoothing);
    this.engineBus.gain.setTargetAtTime(flying * (0.055 + v * 0.065 + boosting * 0.07), t, 0.12);
    this.engineFilter.frequency.setTargetAtTime(280 + v * 380 + boosting * 530 + pulsing * 1200, t, 0.1);
    this.windBus.gain.setTargetAtTime(onFoot ? 0.075 : (space ? 0.018 : 0.035 + v * 0.085) + boosting * 0.1 + pulsing * 0.28, t, 0.18);
    this.windFilter.frequency.setTargetAtTime(onFoot ? 370 : 500 + v * 420 + pulsing * 1700, t, 0.15);
    this.jetBus.gain.setTargetAtTime(jetpack ? 0.45 : 0, t, 0.055);
    this.pulseBus.gain.setTargetAtTime(pulsing * 0.1, t, 0.16);
    this.pulseTone.frequency.setTargetAtTime(100 + pulsing * 150 + v * 25, t, 0.2);
  }

  _tone(freq, endFreq, duration, volume, type = 'sine', delay = 0) {
    const c = this.context;
    if (!c || this.voices.size >= this.maxVoices) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    const start = c.currentTime + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(12, freq), start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(12, endFreq), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + Math.min(0.02, duration * 0.15));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(this.master);
    this.voices.add(osc);
    osc.onended = () => { this.voices.delete(osc); osc.disconnect(); gain.disconnect(); };
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  _noise(duration, volume, frequency = 800, type = 'lowpass', delay = 0) {
    const c = this.context;
    if (!c || this.voices.size >= this.maxVoices) return;
    const source = c.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = duration > 1.8;
    const filter = c.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = 0.65;
    const gain = c.createGain();
    const start = c.currentTime + delay;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + Math.min(0.035, duration * 0.15));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(this.master);
    this.voices.add(source);
    source.onended = () => { this.voices.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(start, Math.random() * 0.12);
    source.stop(start + duration + 0.02);
  }

  play(name, intensity = 1) {
    const c = this.context;
    if (!c || c.state !== 'running' || this.muted) return;
    const t = c.currentTime;
    const cooldown = { cannon: 0.052, damage: 0.15, footfall: 0.2, crystal: 0.14, cable: 0.22, topple: 0.4, horn: 2, jetpack: 0.2, wind: 0.3 }[name] ?? 0.08;
    if (t - (this.last.get(name) ?? -100) < cooldown) return;
    this.last.set(name, t);
    const v = Math.min(1.5, Math.max(0.05, Number(intensity) || 1));
    switch (name) {
      case 'cannon':
      case 'fire':
        this._tone(880, 145, 0.11, 0.21 * v, 'triangle');
        this._noise(0.05, 0.22 * v, 3200, 'highpass');
        break;
      case 'cable':
        this._tone(260, 2300, 0.23, 0.12 * v, 'sawtooth');
        this._noise(0.28, 0.2 * v, 1900, 'bandpass');
        this._tone(180, 55, 0.11, 0.25 * v, 'triangle', 0.2);
        break;
      case 'wrap':
        this._tone(460, 840, 0.17, 0.13 * v, 'triangle');
        this._tone(690, 1260, 0.24, 0.1 * v, 'sine', 0.08);
        break;
      case 'footfall':
        this._tone(72, 27, 0.28, 0.32 * v, 'sine');
        this._noise(0.32, 0.36 * v, 370);
        break;
      case 'topple':
      case 'explosion':
        this._noise(1.7, 0.95 * v, 1350);
        this._tone(130, 24, 1.1, 0.55 * v, 'triangle');
        this._tone(420, 65, 0.85, 0.13 * v, 'sawtooth', 0.08);
        this._noise(0.9, 0.6 * v, 550, 'lowpass', 0.32);
        break;
      case 'horn':
        this._tone(61.74, 59.8, 2.1, 0.15 * v, 'sawtooth');
        this._tone(92.5, 89.7, 2, 0.11 * v, 'triangle', 0.07);
        this._tone(123.47, 119.6, 1.8, 0.045 * v, 'sine', 0.13);
        break;
      case 'crystal':
      case 'mine':
        this._tone(1046.5, 1043, 0.42, 0.16 * v, 'sine');
        this._tone(1568, 1563, 0.6, 0.08 * v, 'sine', 0.06);
        this._tone(2093, 2086, 0.32, 0.035 * v, 'sine', 0.025);
        break;
      case 'core':
      case 'success':
        [392, 523.25, 659.25, 1046.5].forEach((f, i) => this._tone(f, f * 0.999, 0.85, 0.15 * v, 'sine', i * 0.13));
        this._tone(130.8, 130.8, 1.5, 0.1 * v, 'triangle');
        break;
      case 'damage':
        this._noise(0.2, 0.48 * v, 850);
        this._tone(130, 51, 0.25, 0.32 * v, 'triangle');
        break;
      case 'boost':
        this._noise(0.65, 0.35 * v, 1500, 'bandpass');
        this._tone(75, 185, 0.5, 0.1 * v, 'triangle');
        break;
      case 'pulse':
        this._tone(100, 1200, 1.15, 0.18 * v, 'triangle');
        this._noise(1.3, 0.4 * v, 2200, 'bandpass');
        break;
      case 'jetpack':
        this._noise(0.4, 0.4 * v, 1750, 'highpass');
        break;
      case 'wind':
        this._noise(1.5, 0.2 * v, 420, 'bandpass');
        break;
      case 'engine':
        this._tone(32, 110, 0.7, 0.15 * v, 'triangle');
        break;
      case 'land':
        this._tone(88, 32, 0.33, 0.22 * v, 'triangle');
        this._noise(0.4, 0.2 * v, 470);
        break;
      case 'ui':
        this._tone(710, 990, 0.08, 0.06 * v, 'sine');
        break;
    }
  }
}
