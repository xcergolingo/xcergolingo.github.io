/* GoLingo vocabulary, target-linked pronunciation, and reviewed-word export. */
const STORAGE_KEY = 'longshot.golingo.v2';
const LEGACY_STORAGE_KEY = 'longshot.golingo.v1';
const HUB_STORAGE_KEY = 'golingo:active-lesson:v1';
const MAX_ITEMS = 500;
const MAX_INPUT = 1000000;
const REPEAT_GAP = 1500;
const LIST_KEYS = ['words', 'sentences', 'phrases', 'items', 'entries'];
const MESSAGE_TYPES = new Set(['golingo-data', 'golingo_data', 'golingodata', 'golingo:lesson', 'golingo:payload', 'golingo', 'setgolingodata', 'receivegolingodata', 'loadgolingodata']);
const LANGUAGE_NAMES = {
  english: 'en', spanish: 'es', japanese: 'ja', chinese: 'zh-CN', mandarin: 'zh-CN',
  'simplified chinese': 'zh-CN', 'traditional chinese': 'zh-TW', french: 'fr',
  german: 'de', italian: 'it', portuguese: 'pt', korean: 'ko', vietnamese: 'vi',
  russian: 'ru', arabic: 'ar', hindi: 'hi', thai: 'th', ukrainian: 'uk',
};

const DEFAULT_ITEMS = [
  ['la azotea', 'the rooftop', 'Estoy en la azotea.', 'I am on the rooftop.'],
  ['la ventana', 'the window', 'La ventana está abierta.', 'The window is open.'],
  ['el puente', 'the bridge', 'El puente cruza el río.', 'The bridge crosses the river.'],
  ['la torre', 'the tower', 'La torre es muy alta.', 'The tower is very tall.'],
  ['el puerto', 'the harbor', 'Hay barcos en el puerto.', 'There are boats in the harbor.'],
  ['el edificio', 'the building', 'El edificio tiene muchas ventanas.', 'The building has many windows.'],
  ['la calle', 'the street', 'La calle está tranquila.', 'The street is quiet.'],
  ['la grúa', 'the crane', 'La grúa está junto al puerto.', 'The crane is beside the harbor.'],
  ['la luz', 'the light', 'Veo una luz en la ventana.', 'I see a light in the window.'],
  ['la sombra', 'the shadow', 'La sombra es larga.', 'The shadow is long.'],
  ['la puerta', 'the door', 'La puerta está cerrada.', 'The door is closed.'],
  ['el cielo', 'the sky', 'El cielo está despejado.', 'The sky is clear.'],
  ['la ciudad', 'the city', 'La ciudad brilla de noche.', 'The city shines at night.'],
  ['la distancia', 'the distance', 'Mira a lo lejos.', 'Look into the distance.'],
  ['a la derecha', 'to the right', 'El puente está a la derecha.', 'The bridge is to the right.'],
  ['a la izquierda', 'to the left', 'La torre está a la izquierda.', 'The tower is to the left.'],
].map(([word, translation, sentence, sentenceTranslation], index) => ({
  id: `longshot-es-${index + 1}`, word, translation, sentence, sentenceTranslation,
}));

function text(value, max = 2000) {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim().slice(0, max) : '';
}

function language(value, fallback) {
  if (value && typeof value === 'object') value = value.code || value.languageCode || value.value || value.name;
  let code = text(value, 64).replace(/_/g, '-');
  code = LANGUAGE_NAMES[code.toLowerCase()] || code;
  if (!/^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/i.test(code)) return fallback;
  try { return Intl.getCanonicalLocales(code)[0] || fallback; } catch { return fallback; }
}

function audioUrl(value) {
  const url = text(value, 16000);
  if (!url) return '';
  if (/^data:audio\//i.test(url) || /^blob:/i.test(url)) return url;
  try {
    const parsed = new URL(url, window.location.href);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch { return ''; }
}

function normalizeItem(value, index, sentenceOnly = false) {
  if (typeof value === 'string') value = { word: value };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const word = text(sentenceOnly
    ? value.sentence || value.phrase || value.text || value.word
    : value.word || value.phrase || value.text || value.term || value.sentence);
  if (!word) return null;
  const item = {
    id: text(value.id, 160) || `item-${index + 1}`,
    word,
    translation: text(sentenceOnly
      ? value.sentenceTranslation || value.translation || value.phraseTranslation
      : value.translation || value.wordTranslation || value.meaning || value.phraseTranslation),
  };
  const sentence = text(value.sentence || value.exampleSentence || (sentenceOnly ? word : ''), 4000);
  const sentenceTranslation = text(value.sentenceTranslation || value.exampleTranslation || (sentenceOnly ? item.translation : ''), 4000);
  const sentenceAudio = audioUrl(value.sentenceAudioUrl || value.sentenceAudioURL || value.sentenceAudio || value.exampleAudioUrl);
  const audio = audioUrl((sentenceOnly ? sentenceAudio : '') || value.audioUrl || value.audioURL || value.wordAudioUrl || value.wordAudioURL || value.audio);
  if (sentence) item.sentence = sentence;
  if (sentenceTranslation) item.sentenceTranslation = sentenceTranslation;
  if (audio) item.audioUrl = audio;
  if (sentenceAudio) item.sentenceAudioUrl = sentenceAudio;
  return item;
}

function parseStructured(value) {
  if (typeof value !== 'string') return value;
  if (value.length > MAX_INPUT) return null;
  const candidates = [value.trim()];
  try { const decoded = decodeURIComponent(value); if (decoded !== value) candidates.push(decoded); } catch {}
  for (const candidate of candidates) {
    try { return JSON.parse(candidate); } catch {}
    if (/^[A-Za-z0-9+/_=-]+$/.test(candidate) && candidate.length > 8) {
      try {
        const bytes = Uint8Array.from(atob(candidate.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes));
      } catch {}
    }
  }
  return null;
}

function hasLists(value) {
  return !!value && typeof value === 'object' && LIST_KEYS.some(key => Array.isArray(value[key]));
}

function recognizedMessage(value) {
  return !!value && typeof value === 'object' && MESSAGE_TYPES.has(text(value.type, 80).toLowerCase());
}

function unwrap(value) {
  let payload = parseStructured(value);
  for (let depth = 0; depth < 4; depth++) {
    if (Array.isArray(payload)) return { words: payload };
    if (!payload || typeof payload !== 'object' || hasLists(payload)) return payload;
    if (!recognizedMessage(payload) && payload.type) return payload;
    const nested = payload.payload ?? payload.data ?? payload.lesson ?? payload.golingoData;
    if (!nested || nested === payload) return payload;
    payload = parseStructured(nested);
  }
  return payload;
}

export function createLearning({ onWord = () => {}, onStatus = () => {}, onChange = () => {} } = {}) {
  let items = DEFAULT_ITEMS.map(item => ({ ...item }));
  let primaryLanguage = 'en', learningLanguage = 'es';
  let enabled = true, repeatEnabled = true, current = -1, selectedItem = null;
  let audio = null, utterance = null, repeatTimer = null, watchdogTimer = null;
  let speechRun = 0, active = false, destroyed = false, initialized = false, pendingStatus = '';
  const reviewed = new Map();
  const failedAudioUrls = new Set();
  const pair = () => ({ primaryLanguage, learningLanguage });
  const keyFor = item => `${item.word}\u0000${item.translation}`;
  const clone = item => item ? { ...item } : null;
  const validRun = run => run === speechRun && active && enabled && !destroyed;

  function status(message) {
    if (destroyed) return;
    if (!initialized) pendingStatus = message;
    else onStatus(message);
  }
  function changed(reason) {
    if (!initialized || destroyed) return;
    onChange({ reason, items: items.map(clone), languages: pair(), enabled, repeatEnabled, reviewedCount: reviewed.size });
  }
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 2, enabled, repeatEnabled, ...pair(),
        words: items.slice(0, MAX_ITEMS), reviewed: [...reviewed.values()].slice(-MAX_ITEMS),
      }));
    } catch { /* Blocked or full browser storage must not stop a game. */ }
  }
  function clearRepeat() { if (repeatTimer !== null) clearTimeout(repeatTimer); repeatTimer = null; }
  function clearWatchdog() { if (watchdogTimer !== null) clearTimeout(watchdogTimer); watchdogTimer = null; }
  function releaseAudio() {
    if (!audio) return;
    audio.onended = null; audio.onerror = null;
    try { audio.pause(); } catch {}
    audio = null;
  }
  function releaseUtterance() {
    if (utterance) { utterance.onend = null; utterance.onerror = null; utterance = null; }
  }
  function stop() {
    speechRun++; active = false; clearRepeat(); clearWatchdog(); releaseAudio(); releaseUtterance();
    try { window.speechSynthesis?.cancel(); } catch {}
  }
  function scheduleRepeat(run) {
    clearRepeat();
    if (!validRun(run) || !repeatEnabled || !selectedItem) { active = false; return; }
    repeatTimer = setTimeout(() => {
      repeatTimer = null;
      if (validRun(run) && repeatEnabled && selectedItem) playContent(selectedItem, 'word', run);
    }, REPEAT_GAP);
  }

  // One recording or utterance is active at a time. Failure ends this attempt;
  // another attempt requires a player action, so unsupported speech cannot loop.
  function playContent(item, kind, run) {
    if (!validRun(run)) return;
    const content = kind === 'sentence' ? item.sentence : item.word;
    const url = kind === 'sentence' ? item.sentenceAudioUrl : item.audioUrl;
    if (!content) { active = false; return; }
    let finished = false, fallbackUsed = false;
    const deadline = Math.min(180000, Math.max(20000, content.length * 140 + 12000));
    function finish(success, message) {
      if (finished || !validRun(run)) return;
      finished = true; clearWatchdog(); releaseAudio(); releaseUtterance();
      if (message) status(message);
      if (success && repeatEnabled) scheduleRepeat(run);
      else active = false;
    }
    function speakText() {
      if (fallbackUsed || finished || !validRun(run)) return;
      fallbackUsed = true; releaseAudio(); clearWatchdog();
      if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') {
        finish(false, 'Speech is unavailable here. Your words and translations are still ready to read.');
        return;
      }
      try {
        const u = new window.SpeechSynthesisUtterance(content); utterance = u;
        u.lang = learningLanguage; u.rate = .9;
        const wanted = learningLanguage.toLowerCase();
        const voices = window.speechSynthesis.getVoices() || [];
        const voice = voices.find(v => String(v.lang).toLowerCase() === wanted)
          || voices.find(v => String(v.lang).toLowerCase().split('-')[0] === wanted.split('-')[0]);
        if (voice) u.voice = voice;
        u.onend = () => finish(true);
        u.onerror = event => finish(false, ['canceled', 'interrupted'].includes(event.error) ? '' : 'Tap the word to try its pronunciation again.');
        watchdogTimer = setTimeout(() => {
          if (!validRun(run) || finished) return;
          releaseUtterance();
          try { window.speechSynthesis.cancel(); } catch {}
          finish(false, 'Pronunciation stopped. Tap the word to play it again.');
        }, deadline);
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(u);
      } catch { finish(false, 'Tap the word to try its pronunciation again.'); }
    }
    if (url && !failedAudioUrls.has(url) && typeof window.Audio === 'function') {
      try {
        const player = new window.Audio(url); audio = player; player.preload = 'auto';
        const fallback = () => {
          if (finished || !validRun(run) || fallbackUsed) return;
          failedAudioUrls.add(url); speakText();
        };
        player.onended = () => finish(true);
        player.onerror = fallback;
        watchdogTimer = setTimeout(fallback, deadline);
        const promise = player.play();
        if (promise?.catch) promise.catch(fallback);
      } catch { failedAudioUrls.add(url); speakText(); }
    } else speakText();
  }

  function begin(item, kind = 'word') {
    stop();
    if (!enabled || destroyed || !item) return;
    active = true;
    const url = kind === 'sentence' ? item.sentenceAudioUrl : item.audioUrl;
    if (url) failedAudioUrls.delete(url); // A fresh user action may now allow playback.
    playContent(item, kind, speechRun);
  }
  function getItem(index = 0) {
    if (!items.length) return null;
    const value = Number.isFinite(Number(index)) ? Math.trunc(Number(index)) : 0;
    return clone(items[((value % items.length) + items.length) % items.length]);
  }
  function resolveItem(value, next = false) {
    if (value === undefined || value === null) return next ? getItem(current + 1) : clone(selectedItem) || getItem(0);
    if (typeof value === 'number') return getItem(value);
    const normalized = normalizeItem(value, 0);
    if (!normalized) return null;
    return clone(items.find(item => item.id === normalized.id && item.word === normalized.word)
      || items.find(item => keyFor(item) === keyFor(normalized)) || normalized);
  }
  function select(item) {
    selectedItem = clone(item);
    current = items.findIndex(value => value.id === item.id && value.word === item.word && value.translation === item.translation);
    if (current < 0) current = items.findIndex(value => keyFor(value) === keyFor(item));
  }
  function emit(item) {
    onWord(clone(item), {
      index: current < 0 ? 0 : current + 1, total: items.length, reviewedCount: reviewed.size, ...pair(),
    });
  }

  function receivePayload(input) {
    if (destroyed) return { ok: false, error: 'The learning session has closed.' };
    const payload = unwrap(input);
    if (!payload || typeof payload !== 'object') {
      const error = 'Use GoLingo JSON containing words, sentences, phrases, items, or entries.';
      status(error); return { ok: false, error };
    }
    const normalized = [];
    for (const key of LIST_KEYS) {
      if (!Array.isArray(payload[key])) continue;
      for (const value of payload[key].slice(0, MAX_ITEMS - normalized.length)) {
        const item = normalizeItem(value, normalized.length, key === 'sentences');
        if (item) normalized.push(item);
      }
      if (normalized.length >= MAX_ITEMS) break;
    }
    if (!normalized.length) {
      const error = 'No words found. Add a word, phrase, or sentence to the list.';
      status(error); return { ok: false, error };
    }
    stop(); failedAudioUrls.clear(); items = normalized;
    primaryLanguage = language(payload.primaryLanguage || payload.translationLanguage || payload.baseLanguage || payload.sourceLanguage, primaryLanguage);
    learningLanguage = language(payload.learningLanguage || payload.targetLanguage || payload.language, learningLanguage);
    current = -1; selectedItem = null; reviewed.clear(); enabled = true;
    persist(); status(`Loaded ${items.length} learning ${items.length === 1 ? 'item' : 'items'}.`); changed('import');
    return { ok: true, count: items.length, ...pair() };
  }

  function importText(input) {
    if (typeof input !== 'string' || !input.trim()) {
      const error = 'Paste words such as: hola = hello'; status(error); return { ok: false, error };
    }
    if (input.length > MAX_INPUT) {
      const error = 'This list is too large. Import up to 500 items at a time.'; status(error); return { ok: false, error };
    }
    if (/^[\[{]/.test(input.trim())) return receivePayload(input);
    const words = input.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, MAX_ITEMS).map((line, index) => {
      const separator = line.search(/\t|\s*[=|]\s*/);
      const matched = separator >= 0 ? line.slice(separator).match(/^(?:\t|\s*[=|]\s*)/)[0] : '';
      return { id: `pasted-${index + 1}`, word: separator < 0 ? line : line.slice(0, separator).trim(), translation: separator < 0 ? '' : line.slice(separator + matched.length).trim() };
    });
    return receivePayload({ ...pair(), words });
  }

  function onHit(value) {
    if (!enabled || destroyed || !items.length) return null;
    const item = resolveItem(value, true); if (!item) return null;
    select(item); reviewed.set(keyFor(item), clone(item)); persist(); emit(item); begin(item);
    return clone(item);
  }
  function preview(value) {
    if (!enabled || destroyed) return null;
    const item = resolveItem(value); if (!item) return null;
    select(item); emit(item); begin(item); return clone(item);
  }
  function replay() { return selectedItem ? preview(selectedItem) : null; }
  function replayItem(item) { return preview(item); }
  function resume() { return selectedItem ? preview(selectedItem) : null; }
  function speakSentence(value) {
    if (!enabled || destroyed) return null;
    const item = resolveItem(value);
    if (!item?.sentence) { status('This word does not have an example sentence yet.'); return null; }
    select(item); emit(item); begin(item, 'sentence'); return clone(item);
  }
  function setEnabled(value) {
    enabled = Boolean(value); if (!enabled) stop(); persist(); changed('enabled'); return enabled;
  }
  function setRepeat(value) {
    repeatEnabled = Boolean(value);
    if (!repeatEnabled) { clearRepeat(); if (!audio && !utterance) active = false; }
    persist(); changed('repeat'); return repeatEnabled;
  }
  function setLanguages(primary, learning) {
    const nextPrimary = language(primary, primaryLanguage), nextLearning = language(learning, learningLanguage);
    if (nextPrimary === primaryLanguage && nextLearning === learningLanguage) return pair();
    stop(); current = -1; selectedItem = null; reviewed.clear();
    primaryLanguage = nextPrimary; learningLanguage = nextLearning;
    persist(); changed('languages'); return pair();
  }

  function exportWords({ download = true } = {}) {
    const payload = { ...pair(), words: [...reviewed.values()].map(clone) };
    if (!download) return payload;
    if (!payload.words.length) { status('Hit a word target first, then export your reviewed words.'); return payload; }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = `longshot-reviewed-${learningLanguage}.json`; anchor.style.display = 'none';
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    status(`Exported ${payload.words.length} reviewed ${payload.words.length === 1 ? 'word' : 'words'}.`);
    return payload;
  }

  // New installs and v1 migrations start in Learn mode. A v2 player's explicit
  // Classic preference survives future visits. Existing vocabulary is retained.
  for (const key of [STORAGE_KEY, LEGACY_STORAGE_KEY]) {
    try {
      const raw = localStorage.getItem(key), saved = raw && raw.length <= MAX_INPUT ? JSON.parse(raw) : null;
      if (!saved || ![1, 2].includes(saved.version) || !Array.isArray(saved.words)) continue;
      const restored = saved.words.slice(0, MAX_ITEMS).map((value, index) => normalizeItem(value, index)).filter(Boolean);
      if (!restored.length) continue;
      items = restored; primaryLanguage = language(saved.primaryLanguage || saved.translationLanguage, 'en'); learningLanguage = language(saved.learningLanguage, 'es');
      enabled = saved.version === 2 ? saved.enabled !== false : true;
      repeatEnabled = saved.version === 2 ? saved.repeatEnabled !== false : true;
      for (const [index, value] of (Array.isArray(saved.reviewed) ? saved.reviewed.slice(-MAX_ITEMS) : []).entries()) {
        const item = normalizeItem(value, index); if (item) reviewed.set(keyFor(item), item);
      }
      break;
    } catch { /* Corrupt saved data falls back to another source or the examples. */ }
  }

  function urlLesson() {
    const rawHash = window.location.hash.slice(1), hash = new URLSearchParams(rawHash), search = new URLSearchParams(window.location.search);
    // The gallery appends a fresh hash to its game link, so that lesson wins over
    // an older query string carried by a previously opened link.
    for (const params of [hash, search]) {
      for (const key of ['golingoLesson', 'lesson', 'golingo', 'golingoData', 'data', 'payload', 'content']) {
        if (!params.has(key)) continue;
        const lesson = unwrap(params.get(key)); if (hasLists(lesson)) return lesson;
      }
      for (const key of LIST_KEYS) {
        if (!params.has(key)) continue;
        const entries = parseStructured(params.get(key));
        if (Array.isArray(entries)) return { [key]: entries, primaryLanguage: params.get('primaryLanguage') || params.get('translationLanguage'), learningLanguage: params.get('learningLanguage') };
      }
    }
    const direct = unwrap(rawHash); return hasLists(direct) ? direct : null;
  }
  let incoming = null;
  try { incoming = urlLesson(); } catch {}
  if (!incoming) {
    try { const raw = sessionStorage.getItem(HUB_STORAGE_KEY); if (raw && raw.length <= MAX_INPUT) { const candidate = unwrap(raw); if (hasLists(candidate)) incoming = candidate; } } catch {}
  }
  if (incoming) receivePayload(incoming);
  else persist();

  const messageHandler = event => {
    const data = parseStructured(event.data);
    if (recognizedMessage(data) || hasLists(data)) receivePayload(data);
  };
  const previousHooks = new Map();
  const receiver = payload => receivePayload(payload);
  for (const name of ['setGoLingoData', 'receiveGoLingoData', 'loadGoLingoData']) { previousHooks.set(name, window[name]); window[name] = receiver; }
  window.addEventListener('message', messageHandler);
  initialized = true;
  queueMicrotask(() => { if (!destroyed) { if (pendingStatus) onStatus(pendingStatus); changed('ready'); } });

  return {
    get enabled() { return enabled; },
    get repeatEnabled() { return repeatEnabled; },
    get languages() { return pair(); },
    get pair() { return pair(); },
    get reviewedCount() { return reviewed.size; },
    get currentItem() { return clone(selectedItem); },
    getItems: () => items.map(clone), getItem,
    setEnabled, setRepeat, setLanguages, importText, receivePayload, onHit, preview, replay, replayItem, speakSentence, stop, resume, exportWords,
    dispose() {
      stop(); destroyed = true; window.removeEventListener('message', messageHandler);
      for (const [name, previous] of previousHooks) if (window[name] === receiver) { if (previous === undefined) delete window[name]; else window[name] = previous; }
    },
  };
}
