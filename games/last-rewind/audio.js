/* LAST REWIND — asset-free, gesture-unlocked Web Audio sound design. */
const limit = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export class AudioEngine {
  constructor() {
    this.context = null;
    this._muted = false;
    this._loops = [];
    this._voices = new Set();
    this._time = 0;
    this._threat = 0;
  }

  get muted() { return this._muted; }

  async start() {
    // Called directly by the Start/Resume gesture; no autoplay on page load.
    try {
      if (this.context) {
        if (this.context.state === 'suspended') await this.context.resume();
        return this.context.state === 'running';
      }
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Context) return false;
      const c = this.context = new Context();
      this.master = c.createGain();
      this.master.gain.value = this._muted ? 0 : .42;
      this.compressor = c.createDynamicsCompressor();
      this.compressor.threshold.value = -17;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 5;
      this.compressor.attack.value = .003;
      this.compressor.release.value = .2;
      this.compressor.connect(this.master).connect(c.destination);
      this.effects = c.createGain();
      this.effects.gain.value = .9;
      this.effects.connect(this.compressor);
      this.ambient = c.createGain();
      this.ambient.gain.value = .07;
      this.ambient.connect(this.compressor);

      const length = c.sampleRate * 2;
      this.noise = c.createBuffer(1, length, c.sampleRate);
      const values = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) values[i] = Math.random() * 2 - 1;

      // Fluorescent mains hum and a quiet, unresolved late-night drone.
      for (const [frequency, volume, type] of [[60, .30, 'sine'], [120, .10, 'sine'], [43.65, .21, 'triangle'], [65.40, .09, 'sine']]) {
        const source = c.createOscillator();
        const gain = c.createGain();
        source.type = type;
        source.frequency.value = frequency;
        gain.gain.value = volume;
        source.connect(gain).connect(this.ambient);
        source.start();
        this._loops.push({ source, gain, base: frequency });
      }
      const air = c.createBufferSource();
      air.buffer = this.noise; air.loop = true;
      const filter = c.createBiquadFilter();
      filter.type = 'bandpass'; filter.frequency.value = 360; filter.Q.value = .6;
      const gain = c.createGain(); gain.gain.value = .045;
      air.connect(filter).connect(gain).connect(this.ambient);
      air.start();
      this._loops.push({ source: air, gain, filter });
      if (c.state === 'suspended') await c.resume();
      return c.state === 'running';
    } catch {
      // Browsers without audio permission still get the full playable game.
      return false;
    }
  }

  setMuted(value) {
    this._muted = !!value;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this._muted ? 0 : .42, this.context.currentTime, .025);
    }
  }

  _tone(frequency, end, duration, volume, type = 'sine', delay = 0) {
    const c = this.context;
    if (!c || c.state !== 'running' || this._muted) return;
    const source = c.createOscillator();
    const gain = c.createGain();
    const t = c.currentTime + delay;
    source.type = type;
    source.frequency.setValueAtTime(Math.max(12, frequency), t);
    source.frequency.exponentialRampToValueAtTime(Math.max(12, end), t + duration);
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), t + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
    source.connect(gain).connect(this.effects);
    this._voices.add(source);
    source.onended = () => { source.disconnect(); gain.disconnect(); this._voices.delete(source); };
    source.start(t); source.stop(t + duration + .025);
  }

  _noise(duration, volume, type, frequency, delay = 0, q = .7) {
    const c = this.context;
    if (!c || c.state !== 'running' || this._muted) return;
    const source = c.createBufferSource(); source.buffer = this.noise;
    const filter = c.createBiquadFilter();
    filter.type = type; filter.frequency.value = frequency; filter.Q.value = q;
    const gain = c.createGain();
    const t = c.currentTime + delay;
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), t + .003);
    gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
    source.connect(filter).connect(gain).connect(this.effects);
    this._voices.add(source);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); this._voices.delete(source); };
    source.start(t, Math.random() * .9); source.stop(t + duration + .025);
  }

  shot() {
    this._noise(.22, 1.35, 'lowpass', 3700);
    this._noise(.045, .53, 'highpass', 2400);
    this._tone(155, 34, .24, .83, 'triangle');
    // A short room reflection gives the shot weight without a sound file.
    this._noise(.16, .17, 'lowpass', 1200, .075);
  }

  pump() {
    this._noise(.09, .34, 'bandpass', 1350, 0, 1.2);
    this._tone(210, 83, .08, .07, 'triangle');
    this._noise(.065, .25, 'highpass', 1900, .105);
    this._tone(330, 160, .045, .045, 'square', .105);
  }

  reload() {
    this._noise(.04, .21, 'bandpass', 2400, 0, 1.6);
    this._tone(820, 430, .035, .05, 'triangle');
    this._noise(.055, .14, 'highpass', 1600, .055);
  }

  hit() {
    this._noise(.085, .27, 'lowpass', 840);
    this._tone(107, 44, .075, .17, 'triangle');
  }

  kill() {
    this._noise(.21, .24, 'bandpass', 480, 0, .8);
    this._tone(92, 38, .24, .16, 'sawtooth');
  }

  hurt() {
    this._noise(.24, .37, 'bandpass', 550, 0, .6);
    this._tone(66, 40, .21, .27, 'sine');
  }

  wave() {
    this._tone(130.81, 128, .6, .15, 'triangle');
    this._tone(98, 96, .7, .14, 'triangle', .18);
    this._noise(.45, .13, 'lowpass', 550);
  }

  pickup() {
    this._tone(440, 440, .12, .11, 'sine');
    this._tone(660, 660, .18, .1, 'sine', .08);
  }

  gameover() {
    this._tone(130, 38, 1.2, .24, 'triangle');
    this._tone(97, 32, 1.5, .13, 'sine', .1);
    this._noise(.65, .13, 'lowpass', 780);
  }

  update(dt, threat = 0) {
    this._time += Math.min(dt, .1);
    this._threat += (limit(Number(threat) || 0, 0, 1) - this._threat) * Math.min(1, dt * 2);
    if (!this.context || this.context.state !== 'running') return;
    const t = this.context.currentTime;
    this.ambient.gain.setTargetAtTime(.065 + this._threat * .045, t, .2);
    for (const loop of this._loops) {
      if (loop.base && loop.base < 50) {
        loop.source.frequency.setTargetAtTime(loop.base + Math.sin(this._time * .19) * .16, t, .25);
      }
    }
  }

  dispose() {
    for (const voice of this._voices) { try { voice.stop(); } catch {} }
    this._voices.clear();
    for (const loop of this._loops) {
      try { loop.source.stop(); } catch {}
      loop.source.disconnect(); loop.gain.disconnect(); loop.filter?.disconnect();
    }
    this._loops = [];
    if (this.context && this.context.state !== 'closed') this.context.close().catch(() => {});
    this.context = null;
  }
}
