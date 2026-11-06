/**
 * GoLingo Koi Garden — an original, gently evolving Web Audio score.
 * No downloads. A single graph, a bounded lookahead queue, and cached instruments.
 * Call unlock() during a user gesture; setEnabled() controls playback independently.
 */

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const midiHz = note => 440 * 2 ** ((note - 69) / 12);
const THEMES = Object.freeze({
  jade: { tempo: 53, cutoff: 3400, room: 0.20, melody: 1, pad: 1 },
  dusk: { tempo: 47, cutoff: 2500, room: 0.23, melody: 0.90, pad: 1.08 },
  moon: { tempo: 45, cutoff: 2850, room: 0.27, melody: 0.82, pad: 0.92 },
});
const SCALE = [0, 2, 4, 7, 9]; // D major pentatonic: D, E, F-sharp, A, B.
const CHORDS = [
  [50, 57, 64], // D / A / E
  [47, 54, 62], // B / F-sharp / D
  [55, 62, 69], // G / D / A
  [52, 59, 66], // E / B / F-sharp
];
// Sixteen-beat phrases with space between gestures. Entries are beat, scale degree.
const MOTIFS = [
  [[0, 0], [2, 2], [3.5, 3], [6, 5], [9, 4], [11, 2], [13, 1]],
  [[0, 3], [2.5, 4], [4, 5], [7, 7], [9.5, 5], [12, 3]],
  [[0, 5], [3, 3], [5, 2], [6.5, 1], [10, 2], [12.5, 0]],
  [[0, 2], [2, 0], [5, 3], [7.5, 4], [10, 2], [13, 1]],
  [[0, 4], [2.5, 5], [4, 7], [7, 5], [9, 4], [11.5, 3], [14, 2]],
  [[0, 0], [3, 1], [5.5, 2], [8, 4], [10.5, 3], [13, 0]],
  [[0, 3], [1.5, 2], [4.5, 0], [8, 2], [10, 5], [12.5, 3]],
  [[0, 5], [2.5, 7], [5, 6], [7, 5], [10, 3], [13, 2]],
];

export class ZenMusic {
  constructor({ onStatus = () => {} } = {}) {
    this.onStatus = onStatus;
    this.enabled = false;
    this.volume = 0.35;
    this.ducked = false;
    this.theme = 'jade';
    this.context = null;
    this._destroyed = false;
    this._started = false;
    this._timer = null;
    this._suspendTimer = null;
    this._retireTimer = null;
    this._workTimer = null;
    this._work = [];
    this._queue = [];
    this._voices = new Set();
    this._graph = [];
    this._samples = Object.create(null);
    this._phrase = 0;
    this._lastMotif = -1;
    this._nextPhrase = 0;
    this._session = 0;
    this._resume = null;
    this._lastStatus = null;
  }

  _status(message, force = false) {
    if (!force && message === this._lastStatus) return;
    this._lastStatus = message;
    try { this.onStatus(message); } catch { /* UI feedback must never interrupt playback. */ }
  }

  /** Resolves true when the browser allows sound. Safe to call on every Play tap. */
  async unlock() {
    if (this._destroyed) return false;
    if (!this.context) {
      const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContextClass) {
        this._status('Background music is unavailable in this browser.');
        return false;
      }
      try {
        this.context = new AudioContextClass({ latencyHint: 'playback' });
        this._createGraph();
      } catch {
        for (const node of this._graph) { try { node.disconnect(); } catch { /* partial graph */ } }
        this._graph.length = 0;
        if (this.context && this.context.state !== 'closed') this.context.close().catch(() => {});
        this.context = null;
        this._status('Background music could not start on this device.');
        return false;
      }
    }
    this._clearSuspend();
    try {
      // Invoke resume now, inside the original user gesture; share a pending call.
      if (this.context.state !== 'running') {
        if (!this._resume) this._resume = Promise.resolve(this.context.resume()).finally(() => { this._resume = null; });
        await this._resume;
      }
      if (this._destroyed) return false;
      const ready = this.context.state === 'running';
      if (ready) {
        this._status('');
        if (this.enabled) this._start();
      } else this._status('Tap the music button to allow background music.');
      return ready;
    } catch {
      this._status('Tap the music button to allow background music.');
      return false;
    }
  }

  setEnabled(enabled) {
    if (this._destroyed) return;
    const desired = !!enabled;
    if (this.enabled === desired) {
      // Dialogs/settings may call this repeatedly. Never create a second scheduler.
      if (desired && !this._started) void this.unlock();
      return;
    }
    this.enabled = desired;
    if (desired) {
      this._clearSuspend();
      if (this.context?.state === 'running') this._start();
      else void this.unlock();
    } else this._stop();
  }

  setVolume(volume) {
    const number = Number(volume);
    if (!Number.isFinite(number)) return;
    this.volume = clamp(number, 0, 1);
    this._setMaster(this.enabled && this._started ? this.volume * 0.72 : 0, 0.15);
  }

  setDucked(ducked) {
    if (this._destroyed) return;
    this.ducked = !!ducked;
    if (this.context && this._duck) {
      // Speech stays prominent; a slower return avoids a pumping sound between words.
      this._smooth(this._duck.gain, this.ducked ? 0.30 : 1, this.ducked ? 0.055 : 0.48);
    }
  }

  setTheme(theme) {
    if (!THEMES[theme] || this._destroyed) return;
    this.theme = theme;
    if (this.context) {
      this._smooth(this._tone.frequency, THEMES[theme].cutoff, 1.6);
      this._smooth(this._roomLevel.gain, THEMES[theme].room, 1.2);
    }
    // Existing notes finish naturally. The next phrase adopts the new atmosphere.
  }

  getState() {
    return {
      enabled: this.enabled,
      playing: !!(this.enabled && this._started && this.context?.state === 'running'),
      volume: this.volume,
      ducked: this.ducked,
      contextState: this.context?.state || 'uninitialized',
    };
  }

  _createGraph() {
    const ctx = this.context;
    const track = node => { this._graph.push(node); return node; };
    this._mix = track(ctx.createGain());
    this._dry = track(ctx.createGain());
    this._dry.gain.value = 0.86;
    this._tone = track(ctx.createBiquadFilter());
    this._tone.type = 'lowpass';
    this._tone.frequency.value = THEMES[this.theme].cutoff;
    this._tone.Q.value = 0.35;
    this._duck = track(ctx.createGain());
    this._duck.gain.value = this.ducked ? 0.30 : 1;
    this._master = track(ctx.createGain());
    this._master.gain.value = 0;
    this._compressor = track(ctx.createDynamicsCompressor());
    this._compressor.threshold.value = -16;
    this._compressor.knee.value = 18;
    this._compressor.ratio.value = 2.2;
    this._compressor.attack.value = 0.015;
    this._compressor.release.value = 0.35;
    this._mix.connect(this._dry);
    this._dry.connect(this._tone);
    this._tone.connect(this._duck);
    this._duck.connect(this._compressor);
    this._compressor.connect(this._master);
    this._master.connect(ctx.destination);

    this._room = track(ctx.createConvolver());
    this._room.normalize = true;
    this._roomLevel = track(ctx.createGain());
    this._roomLevel.gain.value = THEMES[this.theme].room;
    this._mix.connect(this._room);
    this._room.connect(this._roomLevel);
    this._roomLevel.connect(this._tone);

    this._delay = track(ctx.createDelay(1.2));
    this._delay.delayTime.value = 0.79;
    const delayLevel = track(ctx.createGain());
    delayLevel.gain.value = 0.105;
    const feedbackFilter = track(ctx.createBiquadFilter());
    feedbackFilter.type = 'lowpass';
    feedbackFilter.frequency.value = 1400;
    const feedback = track(ctx.createGain());
    feedback.gain.value = 0.19;
    this._mix.connect(this._delay);
    this._delay.connect(delayLevel);
    delayLevel.connect(this._tone);
    this._delay.connect(feedbackFilter);
    feedbackFilter.connect(feedback);
    feedback.connect(this._delay);

    const real = new Float32Array(5);
    const imaginary = new Float32Array([0, 0.88, 0.085, 0.028, 0.008]);
    this._padWave = ctx.createPeriodicWave(real, imaginary, { disableNormalization: false });

    // Allocate once, then fill in small tasks. No long sample bake on a Start tap.
    const rate = 16000;
    const pluck = ctx.createBuffer(1, Math.ceil(rate * 4.2), rate);
    const bell = ctx.createBuffer(1, Math.ceil(rate * 4.8), rate);
    // Convolver impulses must match the context rate; sample players can resample.
    const room = ctx.createBuffer(2, Math.ceil(ctx.sampleRate * 1.9), ctx.sampleRate);
    this._work = [
      { kind: 'pluck', buffer: pluck, offset: 0 },
      { kind: 'room', buffer: room, offset: 0 },
      { kind: 'bell', buffer: bell, offset: 0 },
    ];
  }

  _continuePreparation() {
    if (!this.enabled || this._destroyed || this._workTimer !== null || !this._work.length) return;
    this._workTimer = setTimeout(() => {
      this._workTimer = null;
      if (!this.enabled || this._destroyed) return;
      const job = this._work[0];
      if (!job) return;
      const { buffer } = job;
      const end = Math.min(buffer.length, job.offset + 4096);
      const first = buffer.getChannelData(0);
      const second = job.kind === 'room' ? buffer.getChannelData(1) : null;
      const rate = buffer.sampleRate;
      const duration = buffer.duration;
      for (let i = job.offset; i < end; i++) {
        const t = i / rate;
        if (job.kind === 'room') {
          const envelope = t < 0.014 ? 0 : Math.pow(1 - t / duration, 2.4) * Math.exp(-t * 0.8);
          first[i] = (Math.random() * 2 - 1) * envelope;
          second[i] = (Math.random() * 2 - 1) * envelope;
        } else {
          const phase = Math.PI * 2 * 440 * t;
          const attack = Math.min(1, t / 0.014);
          const tail = Math.min(1, Math.max(0, (duration - t) / 0.22));
          let value;
          if (job.kind === 'pluck') {
            value = 0.73 * Math.sin(phase) * Math.exp(-t / 1.45)
              + 0.19 * Math.sin(phase * 2.0016) * Math.exp(-t / 0.65)
              + 0.065 * Math.sin(phase * 3.004) * Math.exp(-t / 0.37)
              + 0.02 * Math.sin(phase * 4.008) * Math.exp(-t / 0.18);
          } else {
            value = 0.72 * Math.sin(phase) * Math.exp(-t / 1.95)
              + 0.15 * Math.sin(phase * 2.002) * Math.exp(-t / 0.85)
              + 0.045 * Math.sin(phase * 3.994) * Math.exp(-t / 0.43);
          }
          first[i] = value * attack * attack * tail;
        }
      }
      job.offset = end;
      if (end >= buffer.length) {
        if (job.kind === 'room') {
          try { this._room.buffer = buffer; }
          catch { this._roomLevel.gain.value = 0; } // Dry music continues if a device rejects reverb.
        } else this._samples[job.kind] = buffer;
        this._work.shift();
      }
      this._continuePreparation();
    }, 4);
  }

  _start() {
    if (this._started || this._destroyed || !this.enabled || !this.context || this.context.state !== 'running') return;
    this._clearSuspend();
    this._started = true;
    this._session++;
    this._queue.length = 0;
    this._nextPhrase = this.context.currentTime + 0.36;
    // Even rapid on/off tapping cannot accumulate unbounded release tails.
    if (this._voices.size >= 20) {
      for (const voice of [...this._voices]) {
        if (!voice.retired) continue;
        for (const source of voice.sources) { try { source.stop(this.context.currentTime); } catch { /* ended */ } }
        this._cleanup(voice);
      }
    }
    this._continuePreparation();
    this._setMaster(this.volume * 0.72, 0.65);
    this._drone(this.context.currentTime + 0.02);
    this._tick();
    this._timer = setInterval(() => this._tick(), 200);
    this._status('', true); // The UI can now read playing=true after an asynchronous resume.
  }

  _tick() {
    if (!this._started || !this.enabled || this._destroyed || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    const horizon = now + 0.65;
    // Never catch up dozens of missed notes after an OS interruption.
    if (this._nextPhrase < now - 1) {
      this._queue.length = 0;
      this._nextPhrase = now + 0.12;
    }
    if (this._nextPhrase <= horizon) this._planPhrase(this._nextPhrase);
    while (this._queue.length && this._queue[0].time <= horizon) {
      const event = this._queue.shift();
      if (event.time < now - 0.15) continue;
      const at = Math.max(event.time, now + 0.008);
      if (event.kind === 'pad') this._pad(event.notes, at, event.duration);
      else this._note(event.note, at, event.level, event.pan, event.bell);
    }
  }

  _planPhrase(start) {
    const theme = THEMES[this.theme];
    const beat = 60 / theme.tempo;
    let choice = Math.floor(Math.random() * MOTIFS.length);
    if (choice === this._lastMotif) choice = (choice + 3) % MOTIFS.length;
    this._lastMotif = choice;
    const motif = MOTIFS[choice];
    const chordIndex = [0, 1, 2, 0, 3, 1, 2, 0][this._phrase % 8];
    this._queue.push({ kind: 'pad', time: start, notes: CHORDS[chordIndex], duration: 16 * beat + 3.4 });
    const reflection = this._phrase % 4 === 3;
    const offset = this._phrase % 7 === 5 ? 1 : 0;
    motif.forEach(([position, degree], index) => {
      // A few changed passing notes and rests keep phrases recognisable but varied.
      if (index > 0 && index < motif.length - 1 && Math.random() < 0.10) return;
      const selected = clamp(degree + offset + (reflection && index % 3 === 1 ? -1 : 0), 0, 8);
      const note = 62 + SCALE[selected % 5] + Math.floor(selected / 5) * 12;
      const human = index ? (Math.random() - 0.5) * 0.075 : 0;
      this._queue.push({
        kind: 'note',
        time: start + position * beat + human,
        note,
        level: (0.38 + Math.random() * 0.09) * theme.melody * (index === 0 ? 0.9 : 1),
        pan: (Math.random() - 0.5) * 0.44,
        bell: this.theme === 'moon' && index === motif.length - 1,
      });
    });
    // A distant, very soft answer occasionally floats above the final rest.
    if (this._phrase % 3 === 1) {
      this._queue.push({ kind: 'note', time: start + 14.5 * beat, note: 81, level: 0.16, pan: 0.28, bell: true });
    }
    this._queue.sort((a, b) => a.time - b.time);
    if (this._queue.length > 32) this._queue.length = 32;
    this._nextPhrase = start + 16 * beat;
    this._phrase++;
  }

  _note(note, at, level, pan, bell) {
    if (this._voices.size >= 24) return;
    const ctx = this.context;
    const buffer = this._samples[bell ? 'bell' : 'pluck'] || this._samples.pluck;
    // The first phrase can begin before preparation completes; pads cover the intro.
    if (!buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const rate = midiHz(note) / 440;
    source.playbackRate.value = rate;
    const envelope = ctx.createGain();
    envelope.gain.value = 0.0001;
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.linearRampToValueAtTime(level, at + 0.016);
    const length = Math.min(buffer.duration / rate, 7.5);
    envelope.gain.setValueAtTime(level, at + Math.max(0.03, length - 0.18));
    envelope.gain.linearRampToValueAtTime(0.0001, at + length);
    source.connect(envelope);
    const nodes = [source, envelope];
    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      envelope.connect(panner); panner.connect(this._mix); nodes.push(panner);
    } else envelope.connect(this._mix);
    const voice = this._track([source], envelope, nodes, at + length + 0.03);
    source.start(at);
    source.stop(voice.endAt);
  }

  _pad(notes, at, duration) {
    if (this._voices.size >= 22) return;
    const ctx = this.context;
    const envelope = ctx.createGain();
    const level = 0.030 * THEMES[this.theme].pad;
    envelope.gain.value = 0.0001;
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.linearRampToValueAtTime(level, at + 3.0);
    envelope.gain.setValueAtTime(level, at + Math.max(3.1, duration - 5.1));
    envelope.gain.linearRampToValueAtTime(0.0001, at + duration);
    envelope.connect(this._mix);
    const sources = notes.map((note, index) => {
      const oscillator = ctx.createOscillator();
      oscillator.setPeriodicWave(this._padWave);
      oscillator.frequency.value = midiHz(note);
      oscillator.detune.value = [-1.8, 1.5, -0.4][index];
      oscillator.connect(envelope);
      return oscillator;
    });
    const voice = this._track(sources, envelope, [...sources, envelope], at + duration + 0.03);
    for (const source of sources) { source.start(at); source.stop(voice.endAt); }
  }

  _drone(at) {
    if (this._voices.size >= 24) return;
    const ctx = this.context;
    const envelope = ctx.createGain();
    envelope.gain.value = 0.0001;
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.linearRampToValueAtTime(0.021, at + 4.5);
    envelope.connect(this._mix);
    const sources = [38, 45].map(note => {
      const oscillator = ctx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = midiHz(note);
      oscillator.connect(envelope);
      return oscillator;
    });
    this._track(sources, envelope, [...sources, envelope], Infinity);
    for (const source of sources) source.start(at);
  }

  _track(sources, envelope, nodes, endAt) {
    const voice = { sources, envelope, nodes, endAt, session: this._session, retired: false, finished: false };
    let remaining = sources.length;
    for (const source of sources) {
      source.onended = () => { if (--remaining <= 0) this._cleanup(voice); };
    }
    this._voices.add(voice);
    return voice;
  }

  _cleanup(voice) {
    if (voice.finished) return;
    voice.finished = true;
    for (const source of voice.sources) source.onended = null;
    for (const node of voice.nodes) { try { node.disconnect(); } catch { /* already disconnected */ } }
    this._voices.delete(voice);
  }

  _smooth(parameter, target, constant) {
    if (!this.context || !parameter) return;
    const now = this.context.currentTime;
    if (parameter.cancelAndHoldAtTime) parameter.cancelAndHoldAtTime(now);
    else { const current = parameter.value; parameter.cancelScheduledValues(now); parameter.setValueAtTime(current, now); }
    parameter.setTargetAtTime(target, now, constant);
  }

  _setMaster(value, constant) { if (this._master) this._smooth(this._master.gain, value, constant); }

  _clearSuspend() {
    if (this._suspendTimer !== null) clearTimeout(this._suspendTimer);
    this._suspendTimer = null;
  }

  _stop() {
    this._started = false;
    if (this._timer !== null) clearInterval(this._timer);
    this._timer = null;
    if (this._workTimer !== null) clearTimeout(this._workTimer);
    this._workTimer = null;
    this._queue.length = 0;
    if (!this.context) return;
    this._setMaster(0, 0.11);
    const now = this.context.currentTime;
    for (const voice of this._voices) {
      voice.retired = true;
      this._smooth(voice.envelope.gain, 0.0001, 0.065);
      for (const source of voice.sources) { try { source.stop(now + 0.32); } catch { /* source already ended */ } }
    }
    if (this._retireTimer !== null) clearTimeout(this._retireTimer);
    this._retireTimer = setTimeout(() => {
      this._retireTimer = null;
      for (const voice of [...this._voices]) if (voice.retired) this._cleanup(voice);
    }, 600);
    this._clearSuspend();
    this._suspendTimer = setTimeout(() => {
      this._suspendTimer = null;
      if (!this.enabled && !this._destroyed && this.context?.state === 'running') {
        this.context.suspend().catch(() => {});
      }
    }, 850);
  }

  destroy() {
    if (this._destroyed) return;
    this.enabled = false;
    this._stop();
    this._destroyed = true;
    this._clearSuspend();
    if (this._retireTimer !== null) clearTimeout(this._retireTimer);
    this._retireTimer = null;
    for (const voice of [...this._voices]) {
      for (const source of voice.sources) { try { source.stop(); } catch { /* already stopped */ } }
      this._cleanup(voice);
    }
    for (const node of this._graph) { try { node.disconnect(); } catch { /* already disconnected */ } }
    this._graph.length = 0;
    this._work.length = 0;
    this._samples = Object.create(null);
    if (this.context && this.context.state !== 'closed') this.context.close().catch(() => {});
  }
}
