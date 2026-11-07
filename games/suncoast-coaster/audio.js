/** Quiet, entirely procedural coaster ambience. Nothing plays before unlock(). */
export class RideAudio {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.suspended = false;
    this.ready = false;
    this.state = { speed: 0, lift: false, riding: false, boost: false };
    this.clickClock = 0;
    this.controlClock = 0;
    this.transients = new Set();
  }

  async unlock() {
    try {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return false;
        this.ctx = new AudioContext();
        this._build();
      }
      if (this.ctx.state === 'closed') return false;
      this.enabled = true;
      this.suspended = false;
      if (this.ctx.state !== 'running') await this.ctx.resume();
      this._master();
      return this.ctx.state === 'running';
    } catch {
      this.enabled = false;
      return false;
    }
  }

  setEnabled(value) {
    this.enabled = Boolean(value);
    if (!this.enabled) this._clearTransients();
    this._master();
  }

  _build() {
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0;
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -17;
    limiter.knee.value = 12;
    limiter.ratio.value = 5;
    limiter.attack.value = 0.005;
    limiter.release.value = 0.22;
    this.master.connect(limiter);
    limiter.connect(c.destination);

    this.rideBus = c.createGain();
    this.rideBus.gain.value = 0;
    this.rideBus.connect(this.master);

    const noise = c.createBuffer(1, Math.ceil(c.sampleRate * 3), c.sampleRate);
    const data = noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + (Math.random() * 2 - 1) * 0.035) / 1.035;
      data[i] = last * 5;
    }
    this.noiseSource = c.createBufferSource();
    this.noiseSource.buffer = noise;
    this.noiseSource.loop = true;
    this.windFilter = c.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 180;
    this.windFilter.Q.value = 0.5;
    this.windGain = c.createGain();
    this.windGain.gain.value = 0;
    this.noiseSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.rideBus);
    this.noiseSource.start();

    this.rumble = c.createOscillator();
    this.rumble.type = 'triangle';
    this.rumble.frequency.value = 34;
    this.rumbleGain = c.createGain();
    this.rumbleGain.gain.value = 0;
    this.rumble.connect(this.rumbleGain);
    this.rumbleGain.connect(this.rideBus);
    this.rumble.start();

    this.boostTone = c.createOscillator();
    this.boostTone.type = 'sine';
    this.boostTone.frequency.value = 110;
    this.boostGain = c.createGain();
    this.boostGain.gain.value = 0;
    this.boostTone.connect(this.boostGain);
    this.boostGain.connect(this.rideBus);
    this.boostTone.start();

    this.padGain = c.createGain();
    this.padGain.gain.value = 0;
    this.padGain.connect(this.rideBus);
    this.pads = [130.8128, 196, 261.6256].map((frequency, i) => {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      osc.detune.value = i === 1 ? 2 : -1;
      const gain = c.createGain();
      gain.gain.value = i === 0 ? 0.5 : 0.25;
      osc.connect(gain);
      gain.connect(this.padGain);
      osc.start();
      return osc;
    });

    this.clickBuffer = c.createBuffer(1, Math.ceil(c.sampleRate * 0.045), c.sampleRate);
    const clicks = this.clickBuffer.getChannelData(0);
    for (let i = 0; i < clicks.length; i++) {
      const t = i / c.sampleRate;
      const fadeIn = Math.min(1, t / 0.0025);
      clicks[i] = (Math.random() * 2 - 1) * Math.exp(-t * 160) * fadeIn;
    }
    this.ready = true;
  }

  _target(param, value, time = 0.09) {
    if (!this.ctx || !param) return;
    const now = this.ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setTargetAtTime(value, now, time);
  }

  _master() {
    if (!this.ready) return;
    this._target(this.master.gain, this.enabled && !this.suspended ? 0.38 : 0, 0.045);
  }

  update(state, dt = 1 / 60) {
    this.state = {
      speed: Math.max(0, Number(state.speed) || 0),
      lift: Boolean(state.lift),
      riding: Boolean(state.riding),
      boost: Boolean(state.boost)
    };
    if (!this.ready || this.ctx.state !== 'running') return;
    dt = Math.min(0.1, Math.max(0, Number(dt) || 0));
    const active = this.enabled && !this.suspended && this.state.riding;
    this.controlClock += dt;
    if (this.controlClock >= 0.04) {
      this.controlClock = 0;
      const velocity = Math.min(this.state.speed, 50);
      const speedFactor = Math.min(1, velocity / 42);
      this._target(this.rideBus.gain, active ? 1 : 0, active ? 0.25 : 0.035);
      this._target(this.windGain.gain, 0.012 + speedFactor * speedFactor * 0.3, 0.14);
      this._target(this.windFilter.frequency, 180 + speedFactor * 2100, 0.15);
      this._target(this.rumble.frequency, 30 + velocity * 1.45, 0.12);
      this._target(this.rumbleGain.gain, velocity > 0.2 ? 0.012 + speedFactor * 0.035 : 0, 0.1);
      this._target(this.boostTone.frequency, 85 + velocity * 3.2, 0.2);
      this._target(this.boostGain.gain, this.state.boost ? 0.022 : 0, 0.12);
      this._target(this.padGain.gain, this.state.lift ? 0.018 : 0.009, 0.8);
    }
    if (!active || this.state.speed < 0.6) {
      this.clickClock = 0;
      return;
    }
    this.clickClock += dt;
    const interval = this.state.lift ? 0.18 : Math.max(0.13, 3.8 / this.state.speed);
    if (this.clickClock > interval) {
      this.clickClock %= interval;
      this._railClick(this.state.lift);
    }
  }

  _railClick(lift) {
    if (!this.ready || !this.enabled || this.suspended) return;
    const c = this.ctx;
    const source = c.createBufferSource();
    source.buffer = this.clickBuffer;
    source.playbackRate.value = lift ? 0.74 : 0.52 + Math.random() * 0.1;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lift ? 1050 : 550;
    const gain = c.createGain();
    gain.gain.value = lift ? 0.105 : 0.055;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.rideBus);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start();
  }

  _bell(frequency, offset, level = 0.12, duration = 0.65) {
    if (!this.ready || !this.enabled || this.suspended || this.ctx.state !== 'running') return;
    const c = this.ctx;
    const t = c.currentTime + offset;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(this.master);
    const item = { osc, gain };
    this.transients.add(item);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); this.transients.delete(item); };
    osc.start(t);
    osc.stop(t + duration + 0.025);
  }

  chime(perfect = false) {
    if (!this.state.riding) return;
    this._bell(523.25, 0, 0.12);
    this._bell(perfect ? 783.99 : 659.25, 0.11, 0.105);
    if (perfect) this._bell(1046.5, 0.23, 0.08, 0.8);
  }

  finish() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this._bell(f, i * 0.15, 0.11 - i * 0.01, 0.85));
  }

  _clearTransients() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const item of this.transients) {
      try {
        item.gain.gain.cancelScheduledValues(now);
        item.gain.gain.setTargetAtTime(0, now, 0.012);
        item.osc.stop(now + 0.06);
      } catch { /* Already-ended notes are safe to discard. */ }
    }
  }

  suspend() {
    this.suspended = true;
    this.clickClock = 0;
    this._clearTransients();
    if(this.ready)this._target(this.rideBus.gain,0,0.025);
    this._master();
  }

  resume() {
    this.suspended = false;
    if (this.ctx && this.enabled && this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => this._master()).catch(() => {});
    }
    this._master();
  }
}
