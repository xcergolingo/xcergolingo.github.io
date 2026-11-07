/** Small, entirely synthesized soundscape. Audio begins only after unlock(). */
export class HuntAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.volume = 0.7;
    this.muted = false;
    this.nodes = new Set();
    this.ambient = null;
    this.noise = null;
    this.lastStep = -Infinity;
    this.nextBird = 5;
    this.elapsed = 0;
    this.disposed = false;
  }

  async unlock() {
    if (this.disposed) return false;
    try {
      if (!this.context) {
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AC) return false;
        const c = this.context = new AC();
        this.master = c.createGain();
        this.master.gain.value = this.muted ? 0 : this.volume * 0.27;
        const limiter = c.createDynamicsCompressor();
        limiter.threshold.value = -15;
        limiter.knee.value = 14;
        limiter.ratio.value = 5;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.18;
        this.master.connect(limiter);
        limiter.connect(c.destination);
        this.limiter = limiter;
        const length = Math.floor(c.sampleRate * 3);
        this.noise = c.createBuffer(1, length, c.sampleRate);
        const data = this.noise.getChannelData(0);
        let brown = 0;
        for (let i = 0; i < length; i++) {
          const white = Math.random() * 2 - 1;
          brown = (brown + white * 0.025) / 1.025;
          data[i] = white * 0.74 + brown * 1.4;
        }
      }
      if (this.context.state !== 'running' && this.context.state !== 'closed') await this.context.resume();
      if (!this.muted) this._startAmbient();
      return this.context.state === 'running';
    } catch (_) {
      // Audio is optional: browser autoplay restrictions never block play.
      return false;
    }
  }

  setMuted(value) {
    this.muted = !!value;
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.27, now, 0.03);
    if (this.muted) {
      this._stopAmbient();
      for (const item of [...this.nodes]) this._stop(item);
    } else if (this.context.state === 'running') {
      this.nextBird = this.elapsed + 3 + Math.random() * 5;
      this._startAmbient();
    }
  }

  setVolume(value) {
    if (!Number.isFinite(value)) return;
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master && !this.muted) {
      this.master.gain.setTargetAtTime(this.volume * 0.27, this.context.currentTime, 0.04);
    }
  }

  _ready() {
    return !this.disposed && !this.muted && this.volume > 0 &&
      this.context && this.context.state === 'running';
  }

  _track(source, chain = []) {
    const item = { source, chain };
    this.nodes.add(item);
    source.onended = () => {
      this.nodes.delete(item);
      try { source.disconnect(); } catch (_) {}
      for (const n of chain) { try { n.disconnect(); } catch (_) {} }
    };
    return item;
  }

  _stop(item) {
    try { item.source.stop(); } catch (_) {}
    try { item.source.disconnect(); } catch (_) {}
    for (const n of item.chain) { try { n.disconnect(); } catch (_) {} }
    this.nodes.delete(item);
  }

  _startAmbient() {
    if (!this._ready() || this.ambient) return;
    const c = this.context;
    const source = c.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.Q.value = 0.35;
    const gain = c.createGain();
    gain.gain.value = 0.052;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
    this.ambient = { source, filter, gain };
  }

  _stopAmbient() {
    if (!this.ambient) return;
    const { source, filter, gain } = this.ambient;
    try { source.stop(); } catch (_) {}
    for (const n of [source, filter, gain]) { try { n.disconnect(); } catch (_) {} }
    this.ambient = null;
  }

  _noise(at, duration, amplitude, frequency, type = 'lowpass', playbackRate = 1) {
    if (!this._ready()) return;
    const c = this.context;
    const source = c.createBufferSource();
    source.buffer = this.noise;
    source.playbackRate.value = playbackRate;
    const filter = c.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = 0.6;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, amplitude), at + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    this._track(source, [filter, gain]);
    source.start(at, Math.random() * 0.7);
    source.stop(at + duration + 0.03);
  }

  _tone(at, duration, f0, f1, amplitude, type = 'sine') {
    if (!this._ready()) return;
    const c = this.context;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), at + duration);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, amplitude), at + Math.min(0.018, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain);
    gain.connect(this.master);
    this._track(osc, [gain]);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }

  shot() {
    if (!this._ready()) return;
    const t = this.context.currentTime + 0.004;
    this._noise(t, 0.09, 1.1, 3500, 'lowpass');
    this._noise(t + 0.012, 0.38, 0.5, 600, 'lowpass');
    this._tone(t, 0.18, 145, 43, 0.8);
    // Quiet reflected reports place the shot in the surrounding valley.
    this._noise(t + 0.22, 0.22, 0.16, 950);
    this._noise(t + 0.43, 0.29, 0.065, 650);
    this.nextBird = this.elapsed + 6 + Math.random() * 4;
  }

  reload() {
    if (!this._ready()) return;
    const t = this.context.currentTime + 0.004;
    for (const [delay, amp, freq] of [[0, 0.21, 2400], [0.28, 0.12, 1900], [0.58, 0.14, 3100], [1.13, 0.25, 2000]]) {
      this._noise(t + delay, 0.055, amp, freq, 'bandpass');
      this._tone(t + delay, 0.042, 210, 130, amp * 0.28, 'triangle');
    }
  }

  hit() {
    if (!this._ready()) return;
    const t = this.context.currentTime;
    this._tone(t, 0.14, 620, 620, 0.08);
    this._tone(t + 0.08, 0.23, 930, 930, 0.06);
  }

  step(speed = 1) {
    if (!this._ready()) return;
    const t = this.context.currentTime;
    if (Number(speed) <= 0) return;
    const s = Math.max(0.1, Math.min(2, Number(speed) || 1));
    if (t - this.lastStep < 0.49 / Math.max(0.65, s)) return;
    this.lastStep = t;
    this._noise(t, 0.115, 0.12 * Math.min(1.3, s), 560);
    this._noise(t + 0.018, 0.13, 0.035 * Math.min(1.3, s), 1800, 'highpass');
  }

  update(dt, time) {
    if (!this._ready()) return;
    this.elapsed += Math.min(0.1, Math.max(0, Number(dt) || 0));
    if (this.ambient) {
      const t = this.context.currentTime;
      const wind = 0.046 + Math.sin(this.elapsed * 0.21) * 0.009 + Math.sin(this.elapsed * 0.53) * 0.004;
      this.ambient.gain.gain.setTargetAtTime(wind, t, 0.35);
    }
    if (this.elapsed < this.nextBird) return;
    this.nextBird = this.elapsed + 5 + Math.random() * 9;
    const t = this.context.currentTime + 0.02;
    const base = 1900 + Math.random() * 1000;
    const loud = 0.014 + Math.random() * 0.014;
    this._tone(t, 0.11, base, base * 1.32, loud);
    this._tone(t + 0.17, 0.12, base * 1.12, base * 0.88, loud * 0.8);
    if (Math.random() > 0.45) this._tone(t + 0.36, 0.16, base, base * 1.18, loud * 0.6);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this._stopAmbient();
    for (const item of [...this.nodes]) this._stop(item);
    if (this.master) { try { this.master.disconnect(); } catch (_) {} }
    if (this.limiter) { try { this.limiter.disconnect(); } catch (_) {} }
    if (this.context && this.context.state !== 'closed') {
      try { const closing = this.context.close(); if (closing?.catch) closing.catch(() => {}); } catch (_) {}
    }
    this.context = null;
    this.master = null;
    this.noise = null;
  }
}
