/* One serialized, cancellable pronunciation channel for clips and browser voices. */
const SILENCE = 'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
export const LANGUAGE_LOCALES = Object.freeze({ en:'en-US', es:'es-ES', ja:'ja-JP', zh:'zh-CN', fr:'fr-FR', de:'de-DE', ko:'ko-KR', vi:'vi-VN', pt:'pt-BR', it:'it-IT', ru:'ru-RU', ar:'ar-SA', hi:'hi-IN', th:'th-TH', uk:'uk-UA' });
export function safeAudioUrl(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 4096) return '';
  try {
    const url = new URL(value.trim(), globalThis.location?.href || 'https://pinefall.invalid/');
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

export class LessonAudio {
  constructor({onMessage = () => {}, AudioClass = globalThis.Audio, synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance} = {}) {
    this.onMessage = onMessage; this.AudioClass = AudioClass; this.synth = synth; this.Utterance = Utterance;
    this.audio = null; this.unlocked = false; this.active = false; this.disposed = false;
    this.generation = 0; this.timers = new Set(); this.pending = null; this.lastWarning = '';
    this.volume = 0.85; this.rate = 0.82; this.busy = false; this.sequence = null;
  }
  _later(fn, ms) { const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms); this.timers.add(t); return t; }
  _cancelTimer(t) { clearTimeout(t); this.timers.delete(t); }
  _valid(token) { return !this.disposed && token === this.generation; }
  _warn(message) { if (this.lastWarning === message) return; this.lastWarning = message; this.onMessage(message); }
  _getAudio() { if (!this.audio && this.AudioClass) { this.audio = new this.AudioClass(); this.audio.preload = 'auto'; this.audio.setAttribute?.('playsinline', ''); } return this.audio; }
  cancel({clearPending = true} = {}) {
    ++this.generation; this.busy = false; this.sequence = null;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    if (this.audio) { this.audio.onended = this.audio.onerror = this.audio.onloadedmetadata = null; try { this.audio.pause(); this.audio.currentTime = 0; } catch {} }
    try { this.synth?.cancel(); } catch {}
    this.utterance = null;
    if (clearPending) this.pending = null;
  }
  stop() { this.cancel(); }
  setActive(value) { this.active = !!value; if (!this.active) this.cancel(); }
  setVolume(value) { this.volume = Math.max(0, Math.min(1, Number(value) || 0)); if (this.audio) this.audio.volume = this.volume; if (!this.volume) this.cancel(); }
  unlock() {
    if (this.disposed) return;
    try { this.synth?.resume(); } catch {}
    if (!this.unlocked) {
      this.unlocked = true;
      const audio = this._getAudio();
      if (audio) {
        try { audio.src = SILENCE; audio.volume = 0; const promise = audio.play(); promise?.catch(() => {}); } catch {}
      }
    }
    if (this.pending) { const pending = this.pending; this.pending = null; this.playSequence(pending.items, pending.options); }
  }
  /** Each item: {text,audioUrl,language}; repeatLast only while active. */
  playSequence(items, {repeatLast = false, manual = false, onEnd = null} = {}) {
    this.cancel();
    const list = items.filter(item => item && (item.text || item.audioUrl));
    if (!list.length || this.disposed || this.volume === 0 || (!manual && !this.active)) return;
    if (!this.unlocked) { this.pending = { items: list, options: {repeatLast, manual, onEnd} }; return; }
    const token = this.generation;
    const sequence = this.sequence = {list, repeatLast, manual, token};
    const run = index => {
      if (!this._valid(token) || (!manual && !this.active)) return;
      this._playItem(list[index], token, () => {
        if (!this._valid(token)) return;
        if (index + 1 < list.length) this._later(() => run(index + 1), 260);
        else if (sequence.repeatLast && this.active) this._later(() => run(index), 2400);
        else { this.sequence = null; if (onEnd) onEnd(); }
      });
    };
    run(0);
  }
  appendToSequence(items, {repeatLast = false} = {}) {
    const sequence = this.sequence;
    if (!sequence || !this._valid(sequence.token)) return false;
    sequence.list.push(...items.filter(item => item && (item.text || item.audioUrl)));
    sequence.repeatLast = repeatLast;
    return true;
  }
  _playItem(item, token, callback) {
    this.busy = true;
    const done = () => { if (this._valid(token)) { this.busy = false; callback(); } };
    const url = safeAudioUrl(item.audioUrl);
    if (!url || !this.AudioClass) { this._speak(item, token, done); return; }
    const audio = this._getAudio();
    let settled = false;
    const watchdog = this._later(() => finish(false), 18000);
    const finish = success => {
      if (settled || !this._valid(token)) return;
      settled = true; this._cancelTimer(watchdog); audio.onended = audio.onerror = null;
      try { audio.pause(); } catch {}
      if (success) done(); else this._speak(item, token, done);
    };
    audio.onended = () => finish(true); audio.onerror = () => finish(false);
    try { audio.src = url; audio.volume = this.volume; audio.currentTime = 0; const promise = audio.play(); promise?.catch(() => finish(false)); }
    catch { finish(false); }
  }
  _speak(item, token, done) {
    if (!this._valid(token)) return;
    const text = String(item.text || '').trim();
    if (!text || !this.synth || !this.Utterance) {
      if (text) this._warn('Pronunciation is unavailable in this browser. You can keep learning with the word labels.');
      this._later(done, 400); return;
    }
    const raw = String(item.language || 'en').replace('_', '-');
    const base = raw.toLowerCase().split('-')[0];
    const locale = raw.includes('-') ? raw : LANGUAGE_LOCALES[base] || raw;
    let voices = [];
    try { voices = this.synth.getVoices() || []; } catch {}
    const voice = voices.find(v => v.lang.replace('_','-').toLowerCase() === locale.toLowerCase()) || voices.find(v => v.lang.toLowerCase().split(/[-_]/)[0] === base);
    // Never select an unrelated installed language. The engine may load a voice lazily from lang.
    if (voices.length && !voice) {
      this._warn('A pronunciation voice for this language is not installed. Add one in your device settings or import audio with your lesson.');
      this._later(done, 400); return;
    }
    let settled = false;
    const utterance = new this.Utterance(text);
    this.utterance = utterance;
    utterance.lang = locale; utterance.rate = this.rate; utterance.volume = this.volume;
    if (voice) utterance.voice = voice;
    const watchdog = this._later(() => {
      if (!this._valid(token) || settled) return;
      try { this.synth.cancel(); } catch {}
      finish();
    }, Math.min(25000, Math.max(6500, text.length * 180)));
    const finish = () => {
      if (settled || !this._valid(token)) return;
      settled = true; this._cancelTimer(watchdog); utterance.onend = utterance.onerror = null; this.utterance = null; done();
    };
    utterance.onend = finish;
    utterance.onerror = event => {
      if (!this._valid(token)) return;
      if (!['interrupted', 'canceled'].includes(event?.error)) this._warn('Pronunciation could not play. Tap the speaker to try again.');
      finish();
    };
    try { this.synth.resume(); this.synth.speak(utterance); } catch { finish(); }
  }
  dispose() { this.cancel(); this.disposed = true; this.audio = null; }
}
