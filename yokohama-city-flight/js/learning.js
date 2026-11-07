// A flight lesson can progress by listening or by reaching vocabulary gates.
const ENGLISH = ['sky', 'city', 'airplane', 'building', 'sea', 'bridge', 'airport', 'runway', 'wing', 'cloud', 'station', 'harbour'];
const DEFAULTS = {
  ja: ['空', '街', '飛行機', '建物', '海', '橋', '空港', '滑走路', '翼', '雲', '駅', '港'],
  es: ['el cielo', 'la ciudad', 'el avión', 'el edificio', 'el mar', 'el puente', 'el aeropuerto', 'la pista', 'el ala', 'la nube', 'la estación', 'el puerto'],
  fr: ['le ciel', 'la ville', 'l’avion', 'le bâtiment', 'la mer', 'le pont', 'l’aéroport', 'la piste', 'l’aile', 'le nuage', 'la gare', 'le port'],
  zh: ['天空', '城市', '飞机', '建筑', '大海', '桥', '机场', '跑道', '机翼', '云', '车站', '港口'],
  en: ENGLISH,
};
const EXAMPLES = {
  en: ['The sky is blue.', 'We are flying over the city.', 'The airplane is ready.', 'The building is tall.', 'The sea is calm.', 'We are crossing the bridge.', 'The airport is near the city.', 'The airplane is on the runway.', 'Look at the wing.', 'There is a cloud ahead.', 'The station is next to the bridge.', 'The harbour is on the right.'],
  ja: ['空は青いです。', '街の上を飛んでいます。', '飛行機の準備ができました。', 'あの建物は高いです。', '海は穏やかです。', '橋を渡っています。', '空港は街の近くにあります。', '飛行機は滑走路にあります。', '翼を見てください。', '前方に雲があります。', '駅は橋の隣にあります。', '港は右側にあります。'],
  es: ['El cielo es azul.', 'Volamos sobre la ciudad.', 'El avión está listo.', 'El edificio es alto.', 'El mar está en calma.', 'Estamos cruzando el puente.', 'El aeropuerto está cerca de la ciudad.', 'El avión está en la pista.', 'Mira el ala.', 'Hay una nube delante.', 'La estación está al lado del puente.', 'El puerto está a la derecha.'],
  fr: ['Le ciel est bleu.', 'Nous survolons la ville.', 'L’avion est prêt.', 'Le bâtiment est haut.', 'La mer est calme.', 'Nous traversons le pont.', 'L’aéroport est près de la ville.', 'L’avion est sur la piste.', 'Regardez l’aile.', 'Il y a un nuage devant nous.', 'La gare est à côté du pont.', 'Le port est à droite.'],
  zh: ['天空是蓝色的。', '我们正在城市上空飞行。', '飞机准备好了。', '这栋建筑很高。', '大海很平静。', '我们正在过桥。', '机场在城市附近。', '飞机在跑道上。', '看看机翼。', '前方有一朵云。', '车站在桥旁边。', '港口在右边。'],
};
const VOICE_TAGS = { ja: 'ja-JP', es: 'es-ES', fr: 'fr-FR', zh: 'zh-CN', en: 'en-US' };
const LESSON_ARRAYS = ['words', 'sentences', 'phrases', 'items', 'entries'];
const MAX_ITEMS = 500;
const LISTEN_SECONDS = 14;
const languageCode = value => String(value || 'ja').trim().replace(/_/g, '-').toLowerCase();
const textValue = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
const audioValue = value => textValue(value && typeof value === 'object' ? value.url : value);
const itemKey = item => JSON.stringify([item.word, item.translation, item.sentence === item.word ? '' : item.sentence].map(value => value.normalize('NFC')));

function normalizeItem(item, index, kind = 'words') {
  if (typeof item === 'string') item = { word: item };
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const word = textValue(item.word) || textValue(item.text) || textValue(item.term) || textValue(item.phrase) || textValue(item.sentence);
  if (!word) return null;
  const sentence = textValue(item.sentence) || textValue(item.exampleSentence) || (kind === 'sentences' ? word : '');
  const isSentence = sentence === word;
  const translation = textValue(item.translation) || textValue(item.wordTranslation) || textValue(item.meaning) || (isSentence ? textValue(item.sentenceTranslation) : '');
  const audio = audioValue(item.audioUrl ?? item.audioURL ?? item.audio_url ?? item.audio ?? item.wordAudioUrl ?? (isSentence ? item.sentenceAudioUrl : null));
  const sentenceAudio = audioValue(item.sentenceAudioUrl ?? item.sentenceAudioURL ?? item.sentenceAudio);
  const result = {
    id: textValue(item.id) || String(index + 1),
    word,
    translation,
    sentence,
    sentenceTranslation: textValue(item.sentenceTranslation) || textValue(item.exampleTranslation) || (isSentence ? translation : ''),
  };
  if (audio) result.audioUrl = audio;
  if (sentenceAudio) result.sentenceAudioUrl = sentenceAudio;
  return result;
}

function defaultsFor(language) {
  const requested = language.split('-')[0];
  const base = DEFAULTS[requested] ? requested : 'ja';
  const source = DEFAULTS[base];
  return source.map((word, i) => normalizeItem({
    id: `city-${base}-${i + 1}`,
    word,
    translation: base === 'en' ? DEFAULTS.zh[i] : ENGLISH[i],
    sentence: EXAMPLES[base][i],
    sentenceTranslation: base === 'en' ? EXAMPLES.zh[i] : EXAMPLES.en[i],
  }, i));
}

function safeAudioUrl(value) {
  try {
    const url = new URL(value, document.baseURI);
    return /^(https?:|blob:)$/.test(url.protocol) || (url.protocol === 'data:' && /^data:audio\//i.test(value)) ? url.href : null;
  } catch { return null; }
}

class LearningGates {
  constructor(THREE, scene, { route = [], onWord = () => {}, onToast = () => {} } = {}) {
    this.THREE = THREE;
    this.scene = scene;
    this.route = route.filter(p => p && [p.x, p.y, p.z].every(Number.isFinite));
    this.onWord = onWord;
    this.onToast = onToast;
    this._enabled = false;
    this._paused = false;
    this._disposed = false;
    this._language = 'ja';
    this._mode = 'listen';
    this._listenRemaining = LISTEN_SECONDS;
    this.primaryLanguage = 'en';
    this._words = defaultsFor('ja');
    this._custom = false;
    this._step = 0;
    this._collected = [];
    this._collectedKeys = new Set();
    this._showTranslation = true;
    this._showWords = true;
    this._repeat = true;
    this._armed = true;
    this._cooldown = 0;
    this._clock = 0;
    this._countdown = Infinity;
    this._speaking = false;
    this._reviewing = false;
    this._speechToken = 0;
    this._watchdog = null;
    this._audio = null;
    this._utterance = null;
    this._voiceNoticeShown = false;
    this._failedAudio = new Set();
    this._group = null;
    this._gatePosition = new THREE.Vector3();
    this._samplePosition = new THREE.Vector3();
  }

  get enabled() { return this._enabled; }
  set enabled(value) { this.setEnabled(value); }
  get words() { return this._words; }
  get index() { return this._words.length ? this._step % this._words.length : 0; }
  get collected() { return this._collected; }
  get language() { return this._language; }
  set language(value) { this.setLanguage(value); }
  get mode() { return this._mode; }
  get source() { return this._custom ? 'custom' : 'starter'; }
  get showTranslation() { return this._showTranslation; }
  set showTranslation(value) { this._showTranslation = !!value; this._drawLabel(); this._emit(); }
  get showWords() { return this._showWords; }
  set showWords(value) {
    this._showWords = !!value;
    if (this._label) this._label.visible = this._showWords && this._enabled && this._mode === 'gates';
    if (this._showWords) this._drawLabel();
    this._emit();
  }
  get repeat() { return this._repeat; }
  set repeat(value) {
    this._repeat = !!value;
    if (!this._repeat) this._countdown = Infinity;
    else if (this._enabled && !this._paused && !this._speaking) this._countdown = 2.5;
  }

  setEnabled(value) {
    if (this._disposed) return;
    value = !!value;
    if (value === this._enabled) { this._emit(); return; }
    this._enabled = value;
    if (value) {
      if (this._mode === 'gates') { this._buildGate(); this._placeGate(); }
      this._armed = true;
      this._cooldown = 1;
      this._emit();
      // Called by the root's user-gesture toggle, allowing browser audio unlock.
      if (!this._paused) this.speak();
    } else {
      this._stopSpeech();
      this._destroyGate();
      this._emit();
    }
  }

  setLanguage(code) {
    if (this._disposed) return this._lessonInfo();
    this._language = languageCode(code);
    if (!this._custom) {
      if (!DEFAULTS[this._language.split('-')[0]]) this._language = 'ja';
      this._words = defaultsFor(this._language);
      this.primaryLanguage = this._language.split('-')[0] === 'en' ? 'zh' : 'en';
    }
    this.reset();
    return this._lessonInfo();
  }

  loadStarter(code = 'ja') {
    if (this._disposed) return this._lessonInfo();
    const language = languageCode(code);
    const base = language.split('-')[0];
    if (!DEFAULTS[base]) throw new Error('Starter lessons are available in Japanese, Spanish, French, Chinese, and English.');
    this._custom = false;
    this._language = language;
    this.primaryLanguage = base === 'en' ? 'zh' : 'en';
    this._words = defaultsFor(language);
    this.reset();
    return this._lessonInfo();
  }

  setMode(mode) {
    if (!['listen', 'gates'].includes(mode)) throw new Error('Choose listen or gates mode.');
    if (this._disposed || mode === this._mode) return this._mode;
    this._stopSpeech();
    this._mode = mode;
    this._listenRemaining = LISTEN_SECONDS;
    this._armed = true;
    this._cooldown = 1;
    if (mode === 'gates' && this._enabled) {
      this._buildGate();
      this._placeGate();
    } else this._destroyGate();
    this._emit();
    if (this._enabled && !this._paused) this.speak();
    return this._mode;
  }

  reviewItems() {
    return this._collected.map(item => ({ ...item }));
  }

  importText(text) {
    const source = textValue(text);
    if (!source) throw new Error('Paste words or a GoLingo JSON lesson first.');
    if (/^[\[{]/.test(source)) {
      let data;
      try { data = JSON.parse(source); }
      catch { throw new Error('The JSON is incomplete or invalid. You can also paste word | translation lines.'); }
      return this.receiveData(data);
    }
    const lines = source.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const words = lines.map((line, i) => {
      const delimiter = line.includes('|') ? '|' : '\t';
      const parts = line.split(delimiter);
      return { id: String(i + 1), word: parts.shift().trim(), translation: parts.join(delimiter).trim() };
    });
    if (words[0]?.word.toLowerCase() === 'word' && words[0]?.translation.toLowerCase() === 'translation') words.shift();
    return this.receiveData({ primaryLanguage: this.primaryLanguage, learningLanguage: this._language, words });
  }

  receiveData(payload) {
    if (typeof payload === 'string') return this.importText(payload);
    if (!payload || typeof payload !== 'object') throw new Error('No lesson data was found.');
    if (this._disposed) return this._lessonInfo();
    // Follow explicit app envelopes, preserving language metadata on either level.
    let language = this._language;
    let primaryLanguage = this.primaryLanguage;
    const seenPayloads = new Set();
    for (let depth = 0; depth < 5; depth++) {
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); }
        catch { throw new Error('The lesson envelope contains invalid JSON.'); }
      }
      if (!payload || typeof payload !== 'object' || seenPayloads.has(payload)) throw new Error('No lesson data was found.');
      seenPayloads.add(payload);
      const learning = textValue(payload.learningLanguage) || textValue(payload.targetLanguage);
      const primary = textValue(payload.primaryLanguage) || textValue(payload.translationLanguage);
      if (learning) language = languageCode(learning);
      if (primary) primaryLanguage = languageCode(primary);
      if (Array.isArray(payload) || LESSON_ARRAYS.some(key => Array.isArray(payload[key]) && payload[key].length)) break;
      const next = payload.payload ?? payload.data;
      if (!next) break;
      payload = next;
    }
    const sources = Array.isArray(payload) ? [['words', payload]] : LESSON_ARRAYS.map(key => [key, Array.isArray(payload[key]) ? payload[key] : []]);
    const unique = new Map();
    let position = 0;
    for (const [kind, entries] of sources) {
      for (const entry of entries) {
        const item = normalizeItem(entry, position++, kind);
        if (!item) continue;
        const key = itemKey(item);
        const previous = unique.get(key);
        if (previous) {
          for (const field of ['sentence', 'sentenceTranslation', 'audioUrl', 'sentenceAudioUrl']) {
            if (!previous[field] && item[field]) previous[field] = item[field];
          }
        } else unique.set(key, item);
        if (unique.size > MAX_ITEMS) throw new Error('Use at most 500 unique lesson items.');
      }
    }
    const words = [...unique.values()];
    if (!words.length) throw new Error('The lesson needs at least one word, sentence, phrase, item, or entry.');
    this._words = words;
    this._custom = true;
    this._language = language;
    this.primaryLanguage = primaryLanguage;
    this.reset();
    this.onToast(`${words.length} lesson ${words.length === 1 ? 'item' : 'items'} loaded`);
    return this._lessonInfo();
  }

  pause(value = true) {
    value = !!value;
    if (value === this._paused) { if (value && this._reviewing) this._stopSpeech(); return; }
    this._paused = value;
    if (this._group) this._group.visible = this._enabled && this._mode === 'gates' && !value;
    if (value) this._stopSpeech();
    else if (this._enabled) this.speak();
    this._emit();
  }

  update(dt, position) {
    if (!this._enabled || this._paused || this._disposed) return;
    dt = Math.min(0.2, Math.max(0, Number.isFinite(dt) ? dt : 0));
    this._clock += dt;
    this._cooldown = Math.max(0, this._cooldown - dt);
    if (this._mode === 'listen' && !this._reviewing) {
      this._listenRemaining -= dt;
      if (this._listenRemaining <= 0.000001) { this.advance(); return; }
    }
    if (this._mode === 'gates' && this._group && position) {
      this._halo.material.opacity = 0.055 + 0.025 * (1 + Math.sin(this._clock * 1.7));
      this._ring.material.opacity = 0.78 + 0.12 * Math.sin(this._clock * 1.2);
      if (Array.isArray(position)) this._samplePosition.fromArray(position);
      else this._samplePosition.copy(position);
      const distance = this._samplePosition.distanceTo(this._gatePosition);
      if (!this._armed && distance > 135) this._armed = true;
      if (this._armed && this._cooldown <= 0 && distance <= 100) { this._collect(); return; }
    }
    // An advancement above returns before repetition can start a second utterance.
    if (!this._speaking && Number.isFinite(this._countdown)) {
      this._countdown -= dt;
      if (this._countdown <= 0) this.speak();
    }
  }

  speak() {
    if (!this._enabled || this._paused || this._disposed || !this._words.length) return false;
    return this._speakItem(this._words[this.index]);
  }

  speakItem(item) {
    if (this._disposed) return false;
    const normalized = normalizeItem(item, 0);
    if (!normalized) return false;
    // A deliberate review replay may run while the flight/settings are paused.
    return this._speakItem(normalized, true);
  }

  speakSentence() {
    const item = this._words[this.index];
    if (!item?.sentence) return false;
    return this.speakItem({
      word: item.sentence,
      audioUrl: item.sentenceAudioUrl || (item.sentence === item.word ? item.audioUrl : undefined),
    });
  }

  _speakItem(item, reviewing = false) {
    this._stopSpeech();
    const token = this._speechToken;
    this._speaking = true;
    this._reviewing = reviewing;
    let finished = false;
    const finish = () => {
      if (finished || token !== this._speechToken) return;
      finished = true;
      clearTimeout(this._watchdog);
      this._watchdog = null;
      this._speaking = false;
      this._reviewing = false;
      this._utterance = null;
      this._countdown = this._repeat && this._enabled && !this._paused ? 2.5 : Infinity;
    };
    const fallback = () => {
      if (token !== this._speechToken) return;
      if (typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
        finish();
        this._countdown = Infinity;
        this._notice('Pronunciation is not available in this browser.');
        return;
      }
      const utterance = new window.SpeechSynthesisUtterance(item.word);
      const base = this._language.split('-')[0];
      const tag = VOICE_TAGS[this._language] || this._language || VOICE_TAGS[base];
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.lang.toLowerCase() === tag.toLowerCase())
        || voices.find(v => v.lang.toLowerCase().split('-')[0] === base);
      if (voice) utterance.voice = voice;
      utterance.lang = tag;
      utterance.rate = 0.86;
      utterance.volume = 0.85;
      utterance.onend = finish;
      utterance.onerror = event => {
        if (token !== this._speechToken) return;
        finish();
        if (event.error === 'not-allowed') this._notice('Tap the word caption to enable pronunciation.');
      };
      this._utterance = utterance;
      this._watchdog = setTimeout(() => {
        if (token !== this._speechToken) return;
        utterance.onend = utterance.onerror = null;
        window.speechSynthesis.cancel();
        finish();
      }, Math.min(60000, Math.max(9000, item.word.length * 160 + 5000)));
      try { window.speechSynthesis.speak(utterance); }
      catch { finish(); this._notice('Tap the word caption to enable pronunciation.'); }
    };
    const audioUrl = item.audioUrl && safeAudioUrl(item.audioUrl);
    if (audioUrl && !this._failedAudio.has(audioUrl) && typeof Audio !== 'undefined') {
      const audio = new Audio(audioUrl);
      this._audio = audio;
      audio.volume = 0.85;
      audio.onended = finish;
      let usedFallback = false;
      const audioFailed = () => {
        if (usedFallback || token !== this._speechToken) return;
        usedFallback = true;
        this._failedAudio.add(audioUrl);
        clearTimeout(this._watchdog);
        this._watchdog = null;
        audio.onended = audio.onerror = audio.onplaying = audio.onwaiting = null;
        audio.pause();
        fallback();
      };
      audio.onerror = audioFailed;
      audio.onplaying = () => {
        if (token !== this._speechToken || usedFallback) return;
        clearTimeout(this._watchdog);
        this._watchdog = null;
      };
      audio.onwaiting = () => {
        if (token !== this._speechToken || usedFallback) return;
        clearTimeout(this._watchdog);
        this._watchdog = setTimeout(audioFailed, 10000);
      };
      this._watchdog = setTimeout(audioFailed, 15000);
      try { Promise.resolve(audio.play()).catch(audioFailed); }
      catch { audioFailed(); }
    } else fallback();
    return true;
  }

  reset() {
    if (this._disposed) return;
    this._stopSpeech();
    this._step = 0;
    this._listenRemaining = LISTEN_SECONDS;
    this._collected = [];
    this._collectedKeys.clear();
    this._armed = true;
    this._cooldown = 1;
    this._voiceNoticeShown = false;
    this._failedAudio.clear();
    this._placeGate();
    this._emit();
    if (this._enabled && !this._paused) this.speak();
  }

  exportCollected() {
    const data = {
      primaryLanguage: this.primaryLanguage,
      learningLanguage: this._language,
      words: this.reviewItems(),
    };
    if (!data.words.length) { this.onToast(this._mode === 'gates' ? 'Fly through a learning gate or tap Next to collect your first word.' : 'Listen while flying or tap Next to collect your first word.'); return data; }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `golingo-yokohama-${this._language}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    this.onToast(`${data.words.length} collected ${data.words.length === 1 ? 'word' : 'words'} exported`);
    return data;
  }

  dispose() {
    this._enabled = false;
    this._stopSpeech();
    this._destroyGate();
    this._emit();
    this._disposed = true;
  }

  _collect() {
    return this.advance();
  }

  advance() {
    if (this._disposed || !this._words.length) return null;
    const item = this._words[this.index];
    const key = itemKey(item);
    if (!this._collectedKeys.has(key)) {
      this._collectedKeys.add(key);
      this._collected.push({ ...item });
    }
    const oldPosition = this._gatePosition.clone();
    this._step++;
    this._listenRemaining = LISTEN_SECONDS;
    this._cooldown = 2;
    this._placeGate();
    this._armed = this._mode !== 'gates' || oldPosition.distanceTo(this._gatePosition) > 150;
    this._emit();
    this.speak();
    return { ...item };
  }

  _emit() {
    const item = this._words[this.index] || { word: '', translation: '' };
    const event = {
      word: item.word,
      translation: this._showTranslation ? item.translation : '',
      sentence: item.sentence || '',
      sentenceTranslation: this._showTranslation ? item.sentenceTranslation || '' : '',
      index: this.index, // Zero-based; root may display index + 1.
      total: this._words.length,
      visible: this._enabled && !this._paused && this._showWords,
      collected: this._collected.length,
      mode: this._mode,
      source: this.source,
      target: this._enabled && this._mode === 'gates' && this._group
        ? { x: this._gatePosition.x, y: this._gatePosition.y, z: this._gatePosition.z } : null,
    };
    this.onWord(event);
    return event;
  }

  _lessonInfo() {
    return { count: this._words.length, language: this._language, primaryLanguage: this.primaryLanguage, source: this.source, mode: this._mode };
  }

  _notice(message) {
    if (this._voiceNoticeShown) return;
    this._voiceNoticeShown = true;
    this.onToast(message);
  }

  _stopSpeech() {
    this._speechToken++;
    this._countdown = Infinity;
    clearTimeout(this._watchdog);
    this._watchdog = null;
    if (this._audio) {
      this._audio.onended = this._audio.onerror = this._audio.onplaying = this._audio.onwaiting = null;
      this._audio.pause();
      this._audio.removeAttribute('src');
      this._audio = null;
    }
    if (this._utterance && typeof window !== 'undefined' && window.speechSynthesis) {
      this._utterance.onend = this._utterance.onerror = null;
      window.speechSynthesis.cancel();
    }
    this._utterance = null;
    this._speaking = false;
    this._reviewing = false;
  }

  _buildGate() {
    if (this._group || !this.route.length || !this._enabled || this._mode !== 'gates') return;
    const T = this.THREE;
    const group = new T.Group();
    group.name = 'golingo-vocabulary-gate';
    this._ring = new T.Mesh(
      new T.TorusGeometry(70, 0.95, 7, 96),
      new T.MeshBasicMaterial({ color: 0x90edff, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }),
    );
    this._halo = new T.Mesh(
      new T.TorusGeometry(70, 4, 7, 96),
      new T.MeshBasicMaterial({ color: 0x2ad7ff, transparent: true, opacity: 0.09, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false }),
    );
    group.add(this._ring, this._halo);
    this._canvas = document.createElement('canvas');
    this._canvas.width = 768;
    this._canvas.height = 160;
    this._texture = new T.CanvasTexture(this._canvas);
    this._texture.colorSpace = T.SRGBColorSpace;
    this._label = new T.Sprite(new T.SpriteMaterial({ map: this._texture, transparent: true, depthWrite: false, toneMapped: false }));
    this._label.scale.set(118, 24.58, 1);
    this._label.position.set(0, 91, 0);
    this._label.visible = this._showWords;
    group.add(this._label);
    group.visible = this._enabled && !this._paused;
    this._group = group;
    this.scene.add(group);
  }

  _placeGate() {
    if (!this._group || !this.route.length) return;
    const at = this._step % this.route.length;
    const point = this.route[at];
    const previous = this.route[(at + this.route.length - 1) % this.route.length];
    this._gatePosition.set(point.x, point.y, point.z);
    this._group.position.copy(this._gatePosition);
    const normal = new this.THREE.Vector3(point.x - previous.x, point.y - previous.y, point.z - previous.z);
    if (normal.lengthSq() < 0.001) normal.set(0, 0, 1);
    else normal.normalize();
    this._group.quaternion.setFromUnitVectors(new this.THREE.Vector3(0, 0, 1), normal);
    this._drawLabel();
  }

  _drawLabel() {
    if (!this._canvas || !this._texture || !this._enabled || this._mode !== 'gates' || !this._showWords) return;
    const ctx = this._canvas.getContext('2d');
    if (!ctx) return;
    const item = this._words[this.index];
    ctx.clearRect(0, 0, 768, 160);
    if (!item) return;
    ctx.fillStyle = 'rgba(6, 19, 29, .87)';
    ctx.beginPath();
    ctx.roundRect(2, 2, 764, 156, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(121, 224, 247, .55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#83d9ec';
    ctx.font = '500 16px Arial, sans-serif';
    ctx.fillText(`GOLINGO  ·  ${this.index + 1} / ${this._words.length}`, 384, 24);
    const mainText = item.word;
    let fontSize = 43;
    do { ctx.font = `600 ${fontSize}px Arial, sans-serif`; fontSize -= 2; }
    while (ctx.measureText(mainText).width > 700 && fontSize >= 27);
    ctx.fillStyle = '#f2fcff';
    ctx.fillText(this._fitText(ctx, mainText, 700), 384, this._showTranslation && item.translation ? 76 : 91);
    if (this._showTranslation && item.translation) {
      ctx.fillStyle = '#afc5cd';
      ctx.font = '400 24px Arial, sans-serif';
      ctx.fillText(this._fitText(ctx, item.translation, 700), 384, 125);
    }
    this._texture.needsUpdate = true;
  }

  _fitText(ctx, text, width) {
    const chars = Array.from(text);
    if (chars.length <= 256 && ctx.measureText(text).width <= width) return text;
    // Binary search avoids quadratic work on a long imported sentence.
    let low = 0, high = Math.min(chars.length, 256);
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (ctx.measureText(chars.slice(0, middle).join('') + '…').width <= width) low = middle;
      else high = middle - 1;
    }
    return chars.slice(0, low).join('') + '…';
  }

  _destroyGate() {
    if (!this._group) return;
    this.scene.remove(this._group);
    this._group.traverse(object => {
      object.geometry?.dispose();
      if (object.material) object.material.dispose();
    });
    this._texture?.dispose();
    this._group = this._ring = this._halo = this._label = this._texture = this._canvas = null;
  }
}

export function createLearning(THREE, scene, options = {}) {
  return new LearningGates(THREE, scene, options);
}

export default createLearning;
