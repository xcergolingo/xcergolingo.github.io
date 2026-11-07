/** All sound is synthesized locally. No samples, requests, or autoplay. */
export class AudioDirector {
  constructor() {
    this.context = null;
    this.master = null;
    this.sfx = null;
    this.music = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.intensity = 0.3;
    this._step = 0;
    this._nextStep = 0;
    this._last = new Map();
  }

  async start() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return false;
    try {
      if (!this.context || this.context.state === 'closed') {
        this.context = new Context({latencyHint: 'interactive'});
        const ctx = this.context;
        this.master = ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.6;
        this.sfx = ctx.createGain();
        this.sfx.gain.value = 0.38;
        this.music = ctx.createGain();
        this.music.gain.value = 0.045;
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -13;
        compressor.knee.value = 18;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.004;
        compressor.release.value = 0.16;
        this.sfx.connect(this.master);
        this.music.connect(this.master);
        this.master.connect(compressor);
        compressor.connect(ctx.destination);
        this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const samples = this.noiseBuffer.getChannelData(0);
        let seed = 1965;
        for (let i = 0; i < samples.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          samples[i] = (seed / 4294967296) * 2 - 1;
        }
        this._nextStep = ctx.currentTime + 0.06;
      }
      if (this.context.state === 'suspended') await this.context.resume();
      return this.context.state === 'running';
    } catch {
      return false;
    }
  }

  setMuted(value) {
    this.muted = Boolean(value);
    if (this.master && this.context?.state !== 'closed') {
      const now = this.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.6, now, 0.025);
    }
  }

  setIntensity(value) {
    this.intensity = Math.min(1, Math.max(0, Number(value) || 0));
    if (this.music && this.context?.state !== 'closed') {
      this.music.gain.setTargetAtTime(0.035 + this.intensity * 0.035, this.context.currentTime, 0.25);
    }
  }

  _tone(frequency, time, duration, gain, type = 'sine', endFrequency = frequency, bus = this.sfx) {
    const ctx = this.context;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), time);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), time + duration);
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), time + Math.min(0.008, duration * 0.15));
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(envelope);
    envelope.connect(bus);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.015);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }

  _noise(time, duration, gain, highpass = 200, lowpass = 7000, bus = this.sfx) {
    const ctx = this.context;
    const source = ctx.createBufferSource();
    const high = ctx.createBiquadFilter();
    const low = ctx.createBiquadFilter();
    const envelope = ctx.createGain();
    source.buffer = this.noiseBuffer;
    high.type = 'highpass';
    high.frequency.value = highpass;
    low.type = 'lowpass';
    low.frequency.value = lowpass;
    low.Q.value = 0.7;
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), time + Math.min(0.005, duration * 0.12));
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(high);
    high.connect(low);
    low.connect(envelope);
    envelope.connect(bus);
    source.start(time, Math.random() * 0.7);
    source.stop(time + duration + 0.015);
    source.onended = () => {
      source.disconnect(); high.disconnect(); low.disconnect(); envelope.disconnect();
    };
  }

  _note(midi, time, duration, level, type = 'triangle') {
    const frequency = 440 * Math.pow(2, (midi - 69) / 12);
    this._tone(frequency, time, duration, level, type, frequency, this.music);
  }

  play(name) {
    if (!this.context || this.context.state !== 'running' || this.muted) return;
    const t = this.context.currentTime + 0.003;
    const throttle = {hit: 0.026, kill: 0.04, pickup: 0.07, damage: 0.12, empty: 0.15}[name] || 0;
    if (t - (this._last.get(name) ?? -10) < throttle) return;
    this._last.set(name, t);
    switch (name) {
      case 'shotgun':
        this._noise(t, 0.21, 0.94, 100, 6500);
        this._tone(155, t, 0.24, 0.62, 'sine', 34);
        this._tone(450, t, 0.09, 0.12, 'triangle', 130);
        this._noise(t + 0.04, 0.07, 0.2, 1700, 8800);
        this._noise(t + 0.10, 0.04, 0.09, 2100, 6500);
        break;
      case 'pump':
        this._noise(t, 0.095, 0.32, 850, 4400);
        this._tone(340, t, 0.06, 0.1, 'square', 125);
        this._noise(t + 0.11, 0.055, 0.23, 1700, 5900);
        this._tone(610, t + 0.11, 0.045, 0.12, 'triangle', 290);
        break;
      case 'reload':
        this._tone(690, t, 0.045, 0.15, 'triangle', 430);
        this._noise(t + 0.035, 0.055, 0.2, 1400, 6000);
        this._tone(245, t + 0.055, 0.06, 0.12, 'triangle', 190);
        break;
      case 'empty':
        this._tone(330, t, 0.035, 0.12, 'square', 210);
        this._noise(t, 0.03, 0.09, 2600, 7600);
        break;
      case 'hit':
        this._tone(890 + Math.random() * 120, t, 0.13, 0.18, 'triangle', 240);
        this._tone(1580, t, 0.065, 0.06, 'sine', 780);
        this._noise(t, 0.055, 0.19, 800, 5400);
        break;
      case 'kill':
        this._tone(560, t, 0.38, 0.22, 'triangle', 72);
        this._tone(180, t + 0.02, 0.19, 0.21, 'sine', 48);
        this._noise(t, 0.23, 0.33, 500, 6300);
        for (let i = 0; i < 4; i++) {
          this._tone(1100 - i * 175, t + 0.075 * i, 0.07, 0.075, 'triangle', 350 - i * 45);
        }
        break;
      case 'punch':
        this._tone(145, t, 0.17, 0.55, 'sine', 38);
        this._noise(t, 0.085, 0.45, 220, 2700);
        this._tone(205, t + 0.04, 0.19, 0.16, 'triangle', 85);
        break;
      case 'damage':
        this._tone(84, t, 0.24, 0.3, 'sawtooth', 37);
        this._noise(t, 0.1, 0.25, 120, 1900);
        break;
      case 'dash':
        this._noise(t, 0.19, 0.34, 650, 3900);
        this._tone(180, t, 0.12, 0.1, 'sine', 590);
        break;
      case 'jump':
        this._tone(180, t, 0.18, 0.16, 'triangle', 470);
        break;
      case 'pickup':
        [76, 79, 84].forEach((n, i) => {
          const f = 440 * 2 ** ((n - 69) / 12);
          this._tone(f, t + i * 0.045, 0.13, 0.12, 'sine', f);
        });
        break;
      case 'wave':
        [50, 57, 62, 65].forEach((n, i) => {
          const f = 440 * 2 ** ((n - 69) / 12);
          this._tone(f, t + i * 0.10, 0.24, 0.11, 'triangle', f);
          this._tone(f * 1.004, t + i * 0.10, 0.22, 0.035, 'sawtooth', f * 1.004);
        });
        this._noise(t, 0.4, 0.12, 1800, 6000);
        break;
      case 'victory':
        [62, 65, 69, 74, 72, 69, 74].forEach((n, i) => {
          const f = 440 * 2 ** ((n - 69) / 12);
          this._tone(f, t + i * 0.12, i === 6 ? 0.7 : 0.2, 0.13, 'triangle', f);
        });
        break;
      case 'defeat':
        [57, 53, 50, 38].forEach((n, i) => {
          const f = 440 * 2 ** ((n - 69) / 12);
          this._tone(f, t + i * 0.2, 0.45, 0.13, 'triangle', f * 0.97);
        });
        break;
      default: break;
    }
  }

  _musicStep(step, time) {
    const i = step % 8;
    const bar = Math.floor(step / 8) % 4;
    // An original little minor-key, swung newsroom groove: Dm6 / Bb7 / Gm / A7.
    const roots = [38, 34, 31, 33];
    const chords = [[62, 65, 69, 71], [58, 62, 65, 68], [55, 58, 62, 65], [57, 61, 64, 67]];
    const root = roots[bar];
    if (!(i % 2)) {
      const bass = root + [0, 7, 12, 7][i / 2];
      this._note(bass, time, 0.26, 0.52, 'triangle');
      this._tone(85, time, 0.11, 0.34, 'sine', 34, this.music);
    }
    if (i === 2 || i === 6) {
      this._noise(time, 0.1, 0.26, 1900, 6500, this.music);
      for (const note of chords[bar].slice(0, 3)) this._note(note, time + 0.012, 0.13, 0.07);
    }
    this._noise(time, i % 2 ? 0.05 : 0.035, i % 2 ? 0.065 : 0.04, 5500, 10000, this.music);
    const melody = [
      [74, null, 77, 76, 74, null, 69, 72],
      [74, null, 77, null, 80, 77, 74, null],
      [70, null, 74, 77, 74, null, 70, 69],
      [73, null, 76, null, 79, 76, 73, 69]
    ];
    const note = melody[bar][i];
    if (note !== null && (step % 32 > 7 || this.intensity > 0.55)) {
      this._note(note, time, i % 2 ? 0.12 : 0.22, 0.075);
      this._note(note - 12, time, 0.15, 0.025, 'sine');
    }
    if (this.intensity > 0.72 && i === 7) this._noise(time + 0.08, 0.045, 0.1, 2200, 6800, this.music);
  }

  update() {
    if (!this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    if (this._nextStep < now - 0.25) this._nextStep = now + 0.025;
    let scheduled = 0;
    while (this._nextStep < now + 0.13 && scheduled++ < 8) {
      if (!this.muted) this._musicStep(this._step, this._nextStep);
      const beat = 60 / (112 + Math.round(this.intensity * 6));
      this._nextStep += beat * (this._step % 2 ? 0.38 : 0.62);
      this._step++;
    }
  }

  dispose() {
    if (this.context && this.context.state !== 'closed') this.context.close().catch(() => {});
    this.context = null;
    this.master = this.music = this.sfx = null;
    this.noiseBuffer = null;
    this._last.clear();
  }
}
