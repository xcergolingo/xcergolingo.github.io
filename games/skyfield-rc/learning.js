// Optional GoLingo practice. No network service is required for speech synthesis.
const LIMIT = 100 * 1024;
const STORAGE_KEY = 'skyfield-rc-learning-v1';
const LANG = { es: 'es-ES', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN', fr: 'fr-FR', de: 'de-DE', ko: 'ko-KR', pt: 'pt-BR', it: 'it-IT', ru: 'ru-RU', vi: 'vi-VN', ar: 'ar-SA', hi: 'hi-IN', th: 'th-TH', uk: 'uk-UA' };
const BASE = [
  ['sky', 'The sky is blue.'], ['airplane', 'The airplane is flying.'],
  ['wing', 'The wing is white.'], ['wind', 'The wind is gentle.'],
  ['cloud', 'The cloud is above us.'], ['tree', 'The tree is tall.'],
  ['lake', 'The lake is beautiful.'], ['mountain', 'The mountain is far away.'],
  ['left', 'Turn left.'], ['right', 'Turn right.'],
  ['fly', 'I like to fly.'], ['land', 'Land gently.']
];
const PACKS = {
  es: [
    ['cielo', 'El cielo es azul.'], ['avión', 'El avión está volando.'],
    ['ala', 'El ala es blanca.'], ['viento', 'El viento es suave.'],
    ['nube', 'La nube está sobre nosotros.'], ['árbol', 'El árbol es alto.'],
    ['lago', 'El lago es hermoso.'], ['montaña', 'La montaña está lejos.'],
    ['izquierda', 'Gira a la izquierda.'], ['derecha', 'Gira a la derecha.'],
    ['volar', 'Me gusta volar.'], ['aterrizar', 'Aterriza suavemente.']
  ],
  ja: [
    ['空', '空は青いです。'], ['飛行機', '飛行機が飛んでいます。'],
    ['翼', '翼は白いです。'], ['風', '風は穏やかです。'],
    ['雲', '雲は私たちの上にあります。'], ['木', '木は高いです。'],
    ['湖', '湖は美しいです。'], ['山', '山は遠くにあります。'],
    ['左', '左に曲がってください。'], ['右', '右に曲がってください。'],
    ['飛ぶ', '飛ぶのが好きです。'], ['着陸する', 'ゆっくり着陸してください。']
  ],
  zh: [
    ['天空', '天空是蓝色的。'], ['飞机', '飞机正在飞行。'],
    ['机翼', '机翼是白色的。'], ['风', '风很轻柔。'],
    ['云', '云在我们上方。'], ['树', '树很高。'],
    ['湖', '湖很美。'], ['山', '山在远处。'],
    ['左边', '向左转。'], ['右边', '向右转。'],
    ['飞行', '我喜欢飞行。'], ['着陆', '轻轻地着陆。']
  ],
  fr: [
    ['ciel', 'Le ciel est bleu.'], ['avion', "L’avion vole."],
    ['aile', "L’aile est blanche."], ['vent', 'Le vent est doux.'],
    ['nuage', 'Le nuage est au-dessus de nous.'], ['arbre', "L’arbre est grand."],
    ['lac', 'Le lac est beau.'], ['montagne', 'La montagne est loin.'],
    ['gauche', 'Tournez à gauche.'], ['droite', 'Tournez à droite.'],
    ['voler', "J’aime voler."], ['atterrir', 'Atterrissez doucement.']
  ],
  en: BASE
};

function text(value, max = 400) {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max) : '';
}
function language(value, fallback = 'es') {
  const clean = text(value, 20);
  return /^[a-z]{2,3}(?:[-_][a-zA-Z0-9]{2,8})*$/.test(clean) ? clean.replaceAll('_', '-') : fallback;
}
function byteLength(value) {
  return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(value).length : value.length * 2;
}
function safeAudio(value) {
  const src = text(value, 2000);
  if (!src || /^(?:javascript|data|blob|file):/i.test(src)) return '';
  try {
    const url = new URL(src, typeof location === 'undefined' ? 'https://localhost/' : location.href);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}
function normalize(payload, fallback = {}) {
  if (typeof payload === 'string') {
    if (byteLength(payload) > LIMIT) throw new Error('Please keep a word list under 100 KB.');
    payload = JSON.parse(payload);
  }
  if (!payload || typeof payload !== 'object') throw new Error('Please provide a word list.');
  let serialized;
  try { serialized = JSON.stringify(payload); } catch { throw new Error('The word list could not be read.'); }
  if (byteLength(serialized) > LIMIT) throw new Error('Please keep a word list under 100 KB.');
  const src = Array.isArray(payload) ? payload : (Array.isArray(payload.words) && payload.words.length ? payload.words : payload.sentences);
  if (!Array.isArray(src) || !src.length) throw new Error('Add at least one word or sentence.');
  const words = src.slice(0, 400).map((item, i) => {
    if (typeof item === 'string') item = { word: item };
    if (!item || typeof item !== 'object') return null;
    const word = text(item.word ?? item.text ?? item.sentence, 600);
    if (!word) return null;
    const translation = text(item.translation ?? item.sentenceTranslation, 600);
    return {
      id: text(item.id, 100) || `word-${i + 1}`,
      word, translation,
      sentence: text(item.sentence ?? item.text ?? word, 1200),
      sentenceTranslation: text(item.sentenceTranslation ?? translation, 1200),
      audio: safeAudio(item.audio ?? item.audioUrl ?? item.audioURL),
      sentenceAudio: safeAudio(item.sentenceAudio ?? item.sentenceAudioUrl ?? item.sentenceAudioURL)
    };
  }).filter(Boolean);
  if (!words.length) throw new Error('No readable words were found.');
  return {
    words,
    learningLanguage: language(payload.learningLanguage ?? payload.currentLearningLanguage ?? payload.targetLanguage, fallback.learningLanguage || 'es'),
    primaryLanguage: language(payload.primaryLanguage ?? payload.sourceLanguage, fallback.primaryLanguage || 'en')
  };
}
function defaultData(code) {
  const full = language(code);
  const base = full.split('-')[0];
  const pack = PACKS[base] || PACKS.es;
  return {
    primaryLanguage: 'en', learningLanguage: PACKS[base] ? full : 'es',
    words: pack.map(([word, sentence], i) => ({
      id: `${base}-${i + 1}`, word, sentence,
      translation: BASE[i][0], sentenceTranslation: BASE[i][1], audio: ''
    }))
  };
}
function shuffle(values) {
  const list = values.slice();
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
function parseURLData() {
  if (typeof location === 'undefined') return null;
  const search = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  // The GoLingo gallery sends the lesson in #golingoLesson=... so it stays
  // inside the WebView and does not need a server-side upload. Older hosts
  // still send ?data=... or #data=...; accept all three formats.
  let raw = search.get('data') || hash.get('data') || hash.get('golingoLesson');
  if (!raw) return null;
  if (raw.length > LIMIT * 1.5) throw new Error('The shared word list is too large.');
  const candidates = [raw];
  try { candidates.push(decodeURIComponent(raw)); } catch { /* Already decoded. */ }
  try {
    const binary = atob(raw.replace(/ /g, '+').replace(/-/g, '+').replace(/_/g, '/'));
    candidates.push(new TextDecoder().decode(Uint8Array.from(binary, ch => ch.charCodeAt(0))));
  } catch { /* Plain JSON is supported too. */ }
  for (const candidate of candidates) {
    try { return normalize(candidate); } catch { /* Try the next supported encoding. */ }
  }
  throw new Error('The shared word list could not be read. You can paste it in Practice settings.');
}

export class LearningEngine {
  constructor({ onChange = () => {}, onToast = () => {} } = {}) {
    this.onChange = onChange;
    this.onToast = onToast;
    this.active = false;
    this.repeat = true;
    this.muted = false;
    this.index = 0;
    this.dataRevision = 0;
    this.collected = [];
    this._generation = 0;
    this._timer = null;
    this._audio = null;
    this._utterance = null;
    this._destroyed = false;
    this._warningShown = false;
    let initial = defaultData('es');
    try {
      const stored = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const saved = JSON.parse(stored);
        initial = normalize(saved);
        if (typeof saved.repeat === 'boolean') this.repeat = saved.repeat;
      }
    } catch { /* Storage is optional, including in private web views. */ }
    let loadError = '';
    try { initial = parseURLData() || initial; } catch (err) { loadError = err.message; }
    Object.assign(this, initial);
    this._onMessage = event => {
      const message = event.data;
      if (!message || typeof message !== 'object' || !['golingo-data', 'GOLINGO_DATA'].includes(message.type)) return;
      try { this.setData(message.payload ?? message.data); this._toast('Your GoLingo words are ready.'); }
      catch (error) { this._toast(error.message); }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('message', this._onMessage);
      this._previousLoader = window.loadGoLingoData;
      this._loader = payload => this.setData(payload);
      window.loadGoLingoData = this._loader;
    }
    queueMicrotask(() => {
      if (this._destroyed) return;
      this._emit();
      if (loadError) this._toast(loadError);
    });
  }
  get current() { return this.words[this.index] || null; }
  get currentLearningLanguage() { return this.learningLanguage; }
  get state() {
    return {
      current: this.current, words: this.words, index: this.index,
      learningLanguage: this.learningLanguage, currentLearningLanguage: this.learningLanguage, primaryLanguage: this.primaryLanguage,
      dataRevision: this.dataRevision,
      collected: this.collected, active: this.active, repeat: this.repeat, muted: this.muted
    };
  }
  _emit() { if (!this._destroyed) this.onChange(this.state); }
  _toast(message) { if (!this._destroyed) this.onToast(message); }
  _persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        words: this.words, learningLanguage: this.learningLanguage,
        primaryLanguage: this.primaryLanguage, repeat: this.repeat
      }));
    } catch { /* A full or unavailable store must never interrupt a flight. */ }
  }
  setLanguage(code) {
    this.setData(defaultData(code));
    return this.state;
  }
  setData(payload) {
    const data = normalize(payload, this);
    this._stopSpeech();
    Object.assign(this, data);
    this.dataRevision++;
    this.index = 0;
    this.collected = [];
    this._persist();
    this._emit();
    if (this.active && !this.muted) this.speakCurrent();
    return this.state;
  }
  importText(value, options = {}) {
    const raw = String(value || '').trim();
    if (byteLength(raw) > LIMIT) throw new Error('Please keep a word list under 100 KB.');
    if (!raw) throw new Error('Paste words using word | translation, or a GoLingo JSON list.');
    const selectedLearningLanguage = language(options.learningLanguage, this.learningLanguage);
    const selectedPrimaryLanguage = language(options.primaryLanguage, this.primaryLanguage);
    if (/^[\[{]/.test(raw)) {
      const parsed = JSON.parse(raw);
      const payload = Array.isArray(parsed) ? { words: parsed } : parsed;
      if (!payload || typeof payload !== 'object') throw new Error('Please provide a word list.');
      return this.setData({
        ...payload,
        learningLanguage: language(payload.learningLanguage ?? payload.currentLearningLanguage ?? payload.targetLanguage, selectedLearningLanguage),
        primaryLanguage: language(payload.primaryLanguage ?? payload.sourceLanguage, selectedPrimaryLanguage)
      });
    }
    const words = raw.split(/\r?\n/).filter(line => line.trim()).map((line, i) => {
      const separator = line.includes('|') ? '|' : '\t';
      const [word, translation = '', sentence = '', sentenceTranslation = ''] = line.split(separator).map(part => part.trim());
      return { id: `custom-${i + 1}`, word, translation, sentence: sentence || word, sentenceTranslation: sentenceTranslation || translation };
    });
    return this.setData({ primaryLanguage: selectedPrimaryLanguage, learningLanguage: selectedLearningLanguage, words });
  }
  next({ collect = true, speakSentence = false } = {}) {
    if (!this.words.length) return null;
    const previous = this.current;
    if (collect && previous && !this.collected.some(item => item.id === previous.id && item.word === previous.word)) {
      this.collected.push({ ...previous });
    }
    this.index = (this.index + 1) % this.words.length;
    this._stopSpeech();
    this._emit();
    if (this.active && !this.muted) {
      if (speakSentence && previous?.sentence) {
        this._playSpeech(previous, { sentence: true, after: () => this.speakCurrent() });
      } else this.speakCurrent();
    }
    return this.current;
  }
  setActive(value) {
    const next = Boolean(value);
    if (next === this.active) {
      // Explicit one-shot playback may run while paused; another pause must cancel it.
      if (!next) this._stopSpeech();
      return;
    }
    this.active = next;
    this._stopSpeech();
    this._emit();
    if (next && !this.muted) this.speakCurrent();
  }
  setRepeat(value) {
    this.repeat = Boolean(value);
    if (!this.repeat) clearTimeout(this._timer);
    this._persist();
    this._emit();
    if (this.repeat && this.active && !this.muted && !this._audio && !this._utterance) this.speakCurrent();
  }
  setMuted(value) {
    this.muted = Boolean(value);
    this._stopSpeech();
    this._emit();
    if (!this.muted && this.active) this.speakCurrent();
  }
  reset({ shuffle: shouldShuffle = true } = {}) {
    this._stopSpeech();
    if (shouldShuffle) this.words = shuffle(this.words);
    this.index = 0;
    this.collected = [];
    this._emit();
    if (this.active && !this.muted) this.speakCurrent();
    return this.state;
  }
  _stopSpeech() {
    this._generation++;
    clearTimeout(this._timer);
    this._timer = null;
    if (this._audio) {
      this._audio.onended = null;
      this._audio.onerror = null;
      this._audio.pause();
      this._audio.removeAttribute?.('src');
      this._audio = null;
    }
    if (this._utterance) {
      this._utterance.onend = null;
      this._utterance.onerror = null;
      this._utterance = null;
      try { globalThis.speechSynthesis?.cancel(); } catch { /* No speech engine. */ }
    }
  }
  speakCurrent() {
    return this._playSpeech(this.current);
  }
  speakSentence(item = this.current) {
    return this._playSpeech(item, { sentence: true, once: true });
  }
  _playSpeech(item, { sentence = false, after = null, once = false } = {}) {
    this._stopSpeech();
    if (this._destroyed || this.muted || !item) return false;
    const generation = this._generation;
    const speechText = sentence ? item.sentence : item.word;
    const audioURL = sentence ? item.sentenceAudio : item.audio;
    const languageCode = this.learningLanguage;
    const valid = () => !this._destroyed && this._generation === generation;
    let completed = false;
    const finished = (failed = false) => {
      if (!valid() || completed) return;
      completed = true;
      this._audio = null;
      this._utterance = null;
      if (!this.active || this.muted) return;
      if (after) {
        // The example belongs to the collected item; state already points at the next word.
        after();
      } else if (!failed && !once && this.repeat) {
        this._timer = setTimeout(() => { if (valid()) this.speakCurrent(); }, 2200);
      }
    };
    const speak = () => {
      if (!valid()) return false;
      const synth = globalThis.speechSynthesis;
      if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
        if (!this._warningShown) {
          this._warningShown = true;
          this._toast('Voice playback is unavailable in this browser. Your words still work.');
        }
        finished(true);
        return false;
      }
      const utterance = new SpeechSynthesisUtterance(speechText);
      const base = languageCode.split('-')[0];
      // Preserve imported regional voices such as en-GB, pt-PT, and zh-TW.
      utterance.lang = languageCode.includes('-') ? languageCode : (LANG[base] || languageCode);
      utterance.rate = 0.83;
      utterance.volume = 0.9;
      const voices = synth.getVoices();
      const exact = voices.find(voice => voice.lang.toLowerCase() === utterance.lang.toLowerCase());
      const match = exact || voices.find(voice => voice.lang.toLowerCase().startsWith(base.toLowerCase()));
      if (match) utterance.voice = match;
      utterance.onend = () => finished();
      utterance.onerror = event => {
        if (!valid() || event.error === 'canceled' || event.error === 'interrupted') return;
        if (event.error === 'not-allowed') this._toast('Tap the word card to enable its voice.');
        // An unavailable example can fall through to the new word's recorded audio.
        // Failed words do not retry continuously; the word card gives a fresh gesture.
        finished(true);
      };
      this._utterance = utterance;
      try { synth.resume(); synth.speak(utterance); return true; }
      catch { finished(true); return false; }
    };
    if (audioURL && typeof Audio !== 'undefined') {
      const audio = new Audio(audioURL);
      this._audio = audio;
      audio.volume = 0.9;
      audio.onended = () => finished();
      let fellBack = false;
      const fallback = () => {
        if (!valid() || fellBack) return;
        fellBack = true;
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
        this._audio = null;
        speak();
      };
      audio.onerror = fallback;
      try { const promise = audio.play(); promise?.catch(fallback); } catch { fallback(); }
      return true;
    }
    return speak();
  }
  exportData() {
    return {
      primaryLanguage: this.primaryLanguage,
      learningLanguage: this.learningLanguage,
      words: this.collected.map(item => ({ ...item }))
    };
  }
  destroy() {
    this._stopSpeech();
    this._destroyed = true;
    if (typeof window !== 'undefined') {
      window.removeEventListener('message', this._onMessage);
      if (window.loadGoLingoData === this._loader) {
        if (this._previousLoader) window.loadGoLingoData = this._previousLoader;
        else delete window.loadGoLingoData;
      }
    }
  }
}
