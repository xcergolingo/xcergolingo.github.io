import { LANGUAGES, getStarterLesson, normalizeLesson, shuffleEntries, lessonFingerprint, buildExport } from './lesson-data.js';

const STORAGE = 'golingo:ink-iron:';
const LESSON_KEY = STORAGE + 'lesson:v1';
const SETTINGS_KEY = STORAGE + 'settings:v1';
const SESSION_KEY = 'golingo:active-lesson:v1';
const DEFAULTS = Object.freeze({ showWord: true, showTranslation: true, repeat: true, relaxed: true });
const $ = id => document.getElementById(id);
const text = (el, value) => { if (el) el.textContent = value == null ? '' : String(value); };
const readStorage = (storage, key) => { try { return storage.getItem(key); } catch { return null; } };
const writeStorage = (storage, key, value) => { try { storage.setItem(key, value); return true; } catch { return false; } };
const json = value => { try { return JSON.parse(value); } catch { return null; } };
const entryList = lesson => Array.isArray(lesson?.entries) ? lesson.entries : Array.isArray(lesson?.words) ? lesson.words : [];
const entryKey = entry => JSON.stringify([String(entry?.word || ''), String(entry?.translation || ''), String(entry?.sentence || '')]);
const langCode = value => String(value || '').trim().replace('_', '-');
const baseLanguage = value => langCode(value).toLowerCase().split('-')[0];
const languageOptions = Array.isArray(LANGUAGES) ? LANGUAGES : Object.entries(LANGUAGES).map(([code, value]) => typeof value === 'string' ? { code, name: value } : { code, ...value });
function languageName(code) {
  const match = languageOptions.find(item => baseLanguage(item.code || item.id || item.value) === baseLanguage(code));
  return match?.name || match?.label || match?.englishName || code || 'Language';
}
function canonical(payload, defaults = {}) {
  const result = normalizeLesson(payload, defaults);
  if (result?.ok === false || result?.error && !result?.words && !result?.entries) throw new Error(result.error || 'This lesson could not be read.');
  const lesson = result?.lesson || result;
  if (!entryList(lesson).length) throw new Error('Add at least one word with a translation.');
  return lesson;
}
function transportValue(value) {
  if (typeof value !== 'string') return value;
  if (value.length > 1500000) throw new Error('This lesson is too large. Try a smaller group of words.');
  const candidate = value.trim();
  // URLSearchParams has already decoded the transport once. Never decode percent
  // sequences inside real lesson text or JSON; only unwrap outer encoded JSON.
  if (/^[\[{"]/.test(candidate)) return candidate;
  let outer = candidate;
  for (let i = 0; i < 3 && /%[0-9a-f]{2}/i.test(outer); i++) {
    try {
      const next = decodeURIComponent(outer).trim();
      if (/^[\[{"]/.test(next)) return next;
      if (next === outer) break;
      outer = next;
    } catch { break; }
  }
  if (candidate.length > 12 && /^[A-Za-z0-9+/_=-]+$/.test(candidate)) {
    try {
      const binary = atob(candidate.replace(/-/g, '+').replace(/_/g, '/'));
      const decoded = new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
      if (/^[\[{]/.test(decoded.trim())) return decoded;
    } catch { /* A plain-text lesson is still valid input. */ }
  }
  return candidate;
}
function recordingURL(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 4096) return null;
  try {
    const url = new URL(value, location.href);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

/** The learning layer owns lesson data, speech and review; the arena owns combat. */
export function createLearning({ onLessonChange = () => {}, onPanel = () => {}, onHunt = () => {}, onSettingsChange = () => {} } = {}) {
  const localStore = (() => { try { return window.localStorage; } catch { return null; } })();
  const sessionStore = (() => { try { return window.sessionStorage; } catch { return null; } })();
  const host = $('game') || document.body;
  const shell = document.createElement('div'); shell.id = 'golingoLearning';
  shell.innerHTML = `
    <section id="glWordCard" class="glWordCard glHidden" aria-label="Current learning word">
      <div class="glCardEyebrow"><span id="glTargetLabel">TARGET WORD</span><span id="glRunProgress">0 collected</span></div>
      <button type="button" id="glReplayWord" class="glReplayWord" aria-label="Listen to the current word"><span id="glWordText" lang="es"></span><span id="glWordHidden" class="glHidden">••• <small>TAP TO LISTEN</small></span></button>
      <div id="glTranslation" class="glTranslation" lang="en"></div>
      <details id="glExample" class="glExample glHidden"><summary>Example sentence</summary><p id="glSentence"></p><p id="glSentenceTranslation"></p><button type="button" id="glReplaySentence">▶ LISTEN TO SENTENCE</button></details>
      <div class="glCardActions"><button type="button" id="glListen">◖)) LISTEN</button><button type="button" id="glHunt">HUNT ↗</button><button type="button" id="glWordToggle" aria-pressed="true" title="Show or hide words">Aa</button><button type="button" id="glTranslationToggle" aria-pressed="true" title="Show or hide translations">文</button></div>
      <div id="glSpeechHint" class="glSpeechHint" role="status" aria-live="polite">Tap the word to hear it.</div>
    </section>
    <section id="glPanel" class="glPanel glHidden" role="dialog" aria-modal="true" aria-labelledby="glPanelTitle">
      <div class="glPanelPaper">
        <header class="glPanelHeader"><div><span class="glEyebrow">GOLINGO / FIELD NOTES</span><h2 id="glPanelTitle">YOUR WORDS.<br>YOUR MISSION.</h2></div><button type="button" id="glClose" class="glClose" aria-label="Close lesson panel">×</button></header>
        <nav class="glTabs" role="tablist" aria-label="Lesson and review"><button type="button" id="glLessonTab" role="tab" aria-controls="glLessonPane" aria-selected="true">LESSON</button><button type="button" id="glBasketTab" role="tab" aria-controls="glBasketPane" aria-selected="false">BASKET <span id="glBasketTabCount">0</span></button></nav>
        <div class="glPanelScroll">
          <section id="glLessonPane" role="tabpanel" aria-labelledby="glLessonTab">
            <p class="glIntro">Hunt a word. Hear it. Collect it. Every new run deals your words in a fresh order.</p>
            <div class="glLanguagePair"><label>I'M LEARNING<select id="glLearningLanguage" aria-label="Learning language"></select></label><span aria-hidden="true">→</span><label>TRANSLATE INTO<select id="glPrimaryLanguage" aria-label="Translation language"></select></label></div>
            <p id="glLanguageHint" class="glFine">Language choices apply when you import or load starter words.</p>
            <div class="glSettings"><label><input id="glShowWord" type="checkbox" checked> Show words</label><label><input id="glShowTranslation" type="checkbox" checked> Show translations</label><label><input id="glRepeat" type="checkbox" checked> Repeat until next word</label><label><input id="glRelaxed" type="checkbox" checked> Relaxed learning mode</label></div>
            <p class="glFine">Relaxed mode gives you more time to listen and explore. Hiding words and translations works independently.</p>
            <div class="glImportHeading"><label for="glImport">PASTE YOUR WORDS OR GOLINGO JSON</label><button type="button" id="glUseStarter" class="glTextButton">USE STARTER WORDS ↗</button></div>
            <textarea id="glImport" rows="6" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder='hola | hello\nagua | water\n\nOr paste GoLingo JSON with words and sentences.'></textarea>
            <p class="glFine">One word and translation per line, separated by | or a tab. Your supplied example sentences and recordings stay with each word.</p>
            <div class="glApplyRow"><button type="button" id="glApply" class="glPrimary">LOAD LESSON <span>↗</span></button><span id="glLessonCount" class="glFine"></span></div>
            <div id="glImportStatus" class="glStatus" role="status" aria-live="polite"></div>
            <div class="glVoiceInfo"><b>PRONUNCIATION</b><span id="glVoiceStatus"></span><small>Provided recordings play first. Otherwise, an installed voice for your learning language reads the word.</small></div>
          </section>
          <section id="glBasketPane" class="glHidden" role="tabpanel" aria-labelledby="glBasketTab">
            <div class="glBasketSummary"><div><strong id="glBasketTotal">0</strong><span>WORDS COLLECTED</span></div><p id="glBasketHelp">Tap a word to hear it again. Your review basket is saved for this lesson.</p></div>
            <div id="glBasketList" class="glBasketList"></div>
            <div class="glBasketTools"><button type="button" id="glExport" class="glPrimary">EXPORT TO GOLINGO <span>↗</span></button><button type="button" id="glClearBasket" class="glTextButton">CLEAR BASKET</button></div>
            <div id="glBasketStatus" class="glStatus" role="status" aria-live="polite"></div>
            <div id="glExportFallback" class="glExportFallback glHidden"><label for="glExportText">COPYABLE GOLINGO JSON</label><textarea id="glExportText" rows="6" readonly spellcheck="false"></textarea><button type="button" id="glCopyExport" class="glSecondary">COPY JSON</button><p class="glFine">If your browser does not save the file, copy this text into GoLingo's import screen.</p></div>
          </section>
        </div>
        <footer class="glPanelFooter"><a href="https://www.golingoapp.com/">GoLingoApp.com — practice in the real world ↗</a><a href="https://xcergolingo.github.io/games/">ALL GOLINGO GAMES →</a></footer>
      </div>
    </section>`;
  host.append(shell);
  const header = document.querySelector('.topActions');
  const lessonButton = document.createElement('button'); lessonButton.type = 'button'; lessonButton.id = 'glOpenLesson'; lessonButton.className = 'glHeaderButton'; lessonButton.textContent = 'LESSON'; lessonButton.title = 'Choose words and learning settings';
  const basketButton = document.createElement('button'); basketButton.type = 'button'; basketButton.id = 'glOpenBasket'; basketButton.className = 'glHeaderButton'; basketButton.innerHTML = 'BASKET <span id="glHeaderCount">0</span>'; basketButton.title = 'Review collected words';
  if (header) { header.prepend(basketButton); header.prepend(lessonButton); }
  const cover = document.querySelector('.coverContent');
  const coverLesson = document.createElement('div'); coverLesson.className = 'glCoverLesson'; coverLesson.innerHTML = '<span id="glCoverSummary"></span><button type="button" id="glCoverLessonButton">LESSON ↗</button><small id="glCoverImportHint"></small>';
  if (cover) cover.insertBefore(coverLesson, $('startBtn') || null);

  const storedSettings = json(readStorage(localStore, SETTINGS_KEY)) || {};
  const settings = { ...DEFAULTS };
  for (const key of Object.keys(settings)) if (typeof storedSettings[key] === 'boolean') settings[key] = storedSettings[key];
  let lesson, initialError = '', activeEntry = null, playing = false, muted = false, unlocked = false;
  let panelOpen = false, panelTab = 'lesson', previousFocus = null;
  let deck = [], deckPosition = 0, lastDeckEnd = '', runCollected = 0, runNumber = 0;
  let runUnique = new Set(), basket = new Map(), listenCounts = new Map(), basketKey = '';
  let audioGeneration = 0, repeatTimer = 0, watchdog = 0, recording = null, utterance = null;
  let voices = [], speaking = false, voiceWaiters = [], cardNoticeTimer = 0;

  function compactLesson() {
    return {
      learningLanguage: lesson.learningLanguage, primaryLanguage: lesson.primaryLanguage,
      words: entryList(lesson).map(entry => {
        const isSentence = entry.word === entry.sentence;
        const row = { id: entry.id, [isSentence ? 'sentence' : 'word']: entry.word };
        if (entry.translation) row.translation = entry.translation;
        if (!isSentence && entry.sentence) row.sentence = entry.sentence;
        if (entry.sentenceTranslation && (!isSentence || entry.sentenceTranslation !== entry.translation)) row.sentenceTranslation = entry.sentenceTranslation;
        if (entry.audioUrl) row.audioUrl = entry.audioUrl;
        if (entry.sentenceAudioUrl && (!isSentence || entry.sentenceAudioUrl !== entry.audioUrl)) row.sentenceAudioUrl = entry.sentenceAudioUrl;
        return row;
      })
    };
  }
  function persistLesson(input, defaults) {
    const retained = { format: 'ink-iron-lesson-v1', input, defaults };
    writeStorage(localStore, LESSON_KEY, JSON.stringify(retained));
    const compact = compactLesson();
    try {
      // Shared session data stays a normal, importable GoLingo payload.
      normalizeLesson(compact);
      writeStorage(sessionStore, SESSION_KEY, JSON.stringify(compact));
    } catch {
      // The original is retained locally when canonical metadata alone pushes
      // an otherwise valid maximum-size import past the transport limit.
      try { sessionStore?.removeItem(SESSION_KEY); } catch {}
    }
  }
  function retainedInput(value) {
    if (typeof value !== 'string' || value.length > 350000) return { input: value, defaults: { learningLanguage: 'es', primaryLanguage: 'en' } };
    const record = json(value);
    if (record?.format !== 'ink-iron-lesson-v1') return { input: transportValue(value), defaults: { learningLanguage: 'es', primaryLanguage: 'en' } };
    const defaults = { learningLanguage: String(record.defaults?.learningLanguage || 'es'), primaryLanguage: String(record.defaults?.primaryLanguage || 'en') };
    // Still passes through the public normalizer and its size/entry validation.
    return { input: record.input, defaults };
  }

  function selectedPair() { return { learningLanguage: $('glLearningLanguage').value || 'es', primaryLanguage: $('glPrimaryLanguage').value || 'en' }; }
  function setStatus(message = '', error = false, basketStatus = false) {
    const el = $(basketStatus ? 'glBasketStatus' : 'glImportStatus'); text(el, message); el.classList.toggle('glError', error);
  }
  function speechHint(message) { text($('glSpeechHint'), message); if (panelOpen && panelTab === 'basket') text($('glBasketStatus'), message); }
  function setSpeaking(value) { speaking = value; $('glWordCard').classList.toggle('glIsSpeaking', value); $('glListen').setAttribute('aria-label', value ? 'Replay current word' : 'Listen to current word'); }
  function cancelSpeech() {
    audioGeneration++;
    clearTimeout(repeatTimer); clearTimeout(watchdog); repeatTimer = watchdog = 0;
    if (recording) { recording.onended = recording.onerror = recording.onplaying = null; recording.pause(); recording.removeAttribute('src'); try { recording.load(); } catch {} recording = null; }
    if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch {} }
    utterance = null; setSpeaking(false);
  }
  function stop() { cancelSpeech(); }
  function chooseVoice() {
    const tag = langCode(lesson?.learningLanguage || 'es');
    const matching = voices.filter(voice => baseLanguage(voice.lang) === baseLanguage(tag));
    return matching.find(voice => voice.lang.toLowerCase() === tag.toLowerCase() && voice.localService) || matching.find(voice => voice.lang.toLowerCase() === tag.toLowerCase()) || matching.find(voice => voice.localService) || matching[0] || null;
  }
  function updateVoiceLabel() {
    const name = languageName(lesson?.learningLanguage);
    const voice = chooseVoice();
    text($('glVoiceStatus'), voice ? `${name}: ${voice.name}` : window.speechSynthesis ? `No ${name} voice is available yet. Provided recordings still work.` : 'Speech synthesis is unavailable in this browser. Provided recordings still work.');
  }
  function refreshVoices() {
    voices = window.speechSynthesis?.getVoices?.() || [];
    updateVoiceLabel();
    if (voices.length) { const listeners = voiceWaiters; voiceWaiters = []; listeners.forEach(resolve => resolve()); }
  }
  async function waitForVoice(token) {
    refreshVoices();
    if (chooseVoice() || !window.speechSynthesis) return chooseVoice();
    if (!voices.length) await new Promise(resolve => {
      let done = false;
      const finish = () => { if (!done) { done = true; voiceWaiters = voiceWaiters.filter(callback => callback !== finish); resolve(); } };
      voiceWaiters.push(finish); setTimeout(finish, 650);
    });
    return token === audioGeneration ? chooseVoice() : null;
  }
  function saveBasket() {
    const rows = [...basket.values()].map(row => ({ entry: row.entry, collections: row.collections, listens: row.listens, firstCollected: row.firstCollected, lastCollected: row.lastCollected }));
    writeStorage(localStore, basketKey, JSON.stringify({ version: 1, rows, listens: [...listenCounts.entries()].slice(-1200) }));
  }
  function loadBasket() {
    basket = new Map(); listenCounts = new Map();
    basketKey = STORAGE + 'basket:v1:' + lessonFingerprint(lesson);
    const data = json(readStorage(localStore, basketKey));
    const allowed = new Map(entryList(lesson).map(entry => [entryKey(entry), entry]));
    if (Array.isArray(data?.listens)) for (const pair of data.listens.slice(0, 1200)) if (Array.isArray(pair) && typeof pair[0] === 'string' && allowed.has(pair[0])) listenCounts.set(pair[0], Math.max(0, Number(pair[1]) || 0));
    if (Array.isArray(data?.rows)) for (const row of data.rows.slice(0, 1200)) {
      const key = entryKey(row?.entry); const entry = allowed.get(key); if (!entry || basket.has(key)) continue;
      basket.set(key, { entry, collections: Math.max(1, Number(row.collections) || 1), listens: Math.max(0, Number(row.listens) || 0), firstCollected: Number(row.firstCollected) || Date.now(), lastCollected: Number(row.lastCollected) || Date.now() });
    }
  }
  function recordListen(entry) {
    const key = entryKey(entry), count = (listenCounts.get(key) || 0) + 1;
    listenCounts.set(key, count);
    const row = basket.get(key); if (row) row.listens = count;
    saveBasket(); updateStats();
    if (panelOpen && panelTab === 'basket') {
      for (const item of $('glBasketList').children) {
        if (item.dataset.entryKey === key) text(item.querySelector('.glBasketMeta'), `${row?.collections || 0} collected · ${count} listens`);
      }
    }
  }
  function scheduleRepeat(entry, token, repeat) {
    setSpeaking(false);
    if (token !== audioGeneration || !repeat || !playing || muted || panelOpen || !settings.repeat) return;
    repeatTimer = setTimeout(() => { if (token === audioGeneration && playing && !muted) performSpeech(entry, 'word', token, true); }, 1200);
  }
  async function speakFallback(entry, kind, token, repeat) {
    if (token !== audioGeneration || muted) return false;
    const voice = await waitForVoice(token);
    if (token !== audioGeneration || muted) return false;
    if (!voice || !window.SpeechSynthesisUtterance || !window.speechSynthesis) {
      speechHint(`No ${languageName(lesson.learningLanguage)} voice is installed. Add that voice in your device settings or provide a recording.`); setSpeaking(false); return false;
    }
    const phrase = kind === 'sentence' ? entry.sentence : entry.word;
    if (!phrase) return false;
    const speech = new SpeechSynthesisUtterance(phrase);
    utterance = speech; speech.lang = langCode(lesson.learningLanguage); speech.voice = voice; speech.rate = kind === 'sentence' ? 0.88 : 0.86; speech.pitch = 1; speech.volume = 1;
    let counted = false;
    speech.onstart = () => { if (token !== audioGeneration) return; setSpeaking(true); speechHint(kind === 'sentence' ? 'Listening to the example sentence.' : 'Listen, repeat, then find your next word.'); if (!counted) { counted = true; recordListen(entry); } };
    speech.onend = () => { if (token !== audioGeneration) return; clearTimeout(watchdog); utterance = null; scheduleRepeat(entry, token, repeat); };
    speech.onerror = () => { if (token !== audioGeneration) return; clearTimeout(watchdog); utterance = null; setSpeaking(false); speechHint('Tap the word to hear it. Your browser may need another tap to start audio.'); };
    try {
      window.speechSynthesis.speak(speech);
      watchdog = setTimeout(() => { if (token === audioGeneration) { cancelSpeech(); speechHint('Tap the word to hear it.'); } }, Math.max(16000, Math.min(90000, phrase.length * 260 + 4000)));
      return true;
    } catch { setSpeaking(false); speechHint('Tap the word to hear it.'); return false; }
  }
  function performSpeech(entry, kind, token, repeat) {
    if (token !== audioGeneration || muted || !unlocked) return Promise.resolve(false);
    const url = recordingURL(kind === 'sentence' ? (entry.sentenceAudioUrl || entry.sentenceAudioURL) : (entry.audioUrl || entry.audioURL || entry.audio));
    if (!url) return speakFallback(entry, kind, token, repeat);
    return new Promise(resolve => {
      let settled = false, started = false;
      let audio;
      const fallback = () => {
        if (settled || token !== audioGeneration) { resolve(false); return; }
        settled = true; clearTimeout(watchdog);
        if (audio) { audio.onended = audio.onerror = audio.onplaying = null; audio.pause(); }
        if (recording === audio) recording = null;
        speakFallback(entry, kind, token, repeat).then(resolve);
      };
      try { audio = new Audio(); audio.preload = 'auto'; audio.playsInline = true; recording = audio; }
      catch { fallback(); return; }
      audio.onplaying = () => { if (token !== audioGeneration) return; clearTimeout(watchdog); setSpeaking(true); speechHint(kind === 'sentence' ? 'Listening to the example sentence.' : 'Listen, repeat, then find your next word.'); if (!started) { started = true; recordListen(entry); resolve(true); } };
      audio.onended = () => { if (token !== audioGeneration || settled) return; settled = true; clearTimeout(watchdog); if (recording === audio) recording = null; scheduleRepeat(entry, token, repeat); resolve(true); };
      audio.onerror = fallback;
      audio.src = url;
      watchdog = setTimeout(fallback, 9000);
      try { const result = audio.play(); result?.catch?.(fallback); } catch { fallback(); }
    });
  }
  function speak(entry, kind = 'word', { manual = false, repeat = false, allowStopped = false } = {}) {
    if (!entry || !(kind === 'sentence' ? entry.sentence : entry.word)) return Promise.resolve(false);
    cancelSpeech();
    if (manual) unlocked = true;
    if (muted) { speechHint('Sound is muted. Use the sound button to listen.'); return Promise.resolve(false); }
    if (!unlocked || (!manual && !playing && !allowStopped)) return Promise.resolve(false);
    return performSpeech(entry, kind, audioGeneration, repeat);
  }
  function updateCard() {
    const entry = activeEntry;
    $('glWordCard').classList.toggle('glHidden', !playing || !entry || panelOpen);
    if (!entry) return;
    const learningTag = langCode(lesson.learningLanguage), primaryTag = langCode(lesson.primaryLanguage);
    text($('glWordText'), entry.word); $('glWordText').lang = learningTag; $('glReplayWord').classList.toggle('glLongWord', entry.word.length > 36); $('glReplayWord').title = settings.showWord ? entry.word : 'Listen to the hidden word';
    $('glWordText').classList.toggle('glHidden', !settings.showWord); $('glWordHidden').classList.toggle('glHidden', settings.showWord);
    $('glReplayWord').setAttribute('aria-label', settings.showWord ? `Listen to ${entry.word}` : 'Listen to the hidden word');
    text($('glTranslation'), entry.translation); $('glTranslation').lang = primaryTag; $('glTranslation').classList.toggle('glHidden', !settings.showTranslation || !entry.translation);
    $('glExample').classList.toggle('glHidden', !entry.sentence);
    text($('glSentence'), settings.showWord ? entry.sentence : 'Example hidden. Turn on words to read it.'); $('glSentence').lang = learningTag;
    text($('glSentenceTranslation'), entry.sentenceTranslation); $('glSentenceTranslation').lang = primaryTag;
    $('glSentenceTranslation').classList.toggle('glHidden', !settings.showTranslation || !entry.sentenceTranslation);
    $('glWordToggle').setAttribute('aria-pressed', String(settings.showWord)); $('glTranslationToggle').setAttribute('aria-pressed', String(settings.showTranslation));
    $('glWordToggle').title = settings.showWord ? 'Hide words' : 'Show words'; $('glTranslationToggle').title = settings.showTranslation ? 'Hide translations' : 'Show translations';
  }
  function statsSnapshot() {
    const listens = [...listenCounts.values()].reduce((sum, value) => sum + value, 0);
    return { runCollected, collected: runCollected, runUnique: runUnique.size, uniqueCollected: basket.size, basketCount: basket.size, totalWords: entryList(lesson).length, listens, totalListens: listens, runNumber };
  }
  function updateStats() {
    const state = statsSnapshot();
    text($('glHeaderCount'), state.basketCount); text($('glBasketTabCount'), state.basketCount); text($('glBasketTotal'), state.basketCount);
    text($('glRunProgress'), `${state.runUnique}/${state.totalWords} found`);
    $('glExport').disabled = !state.basketCount; $('glClearBasket').disabled = !state.basketCount;
    return state;
  }
  function syncLessonUI() {
    $('glLearningLanguage').value = lesson.learningLanguage;
    $('glPrimaryLanguage').value = lesson.primaryLanguage;
    if (!$('glLearningLanguage').value) $('glLearningLanguage').value = baseLanguage(lesson.learningLanguage);
    if (!$('glPrimaryLanguage').value) $('glPrimaryLanguage').value = baseLanguage(lesson.primaryLanguage);
    text($('glCoverSummary'), `GoLingo · ${languageName(lesson.learningLanguage).split(' · ')[0]} → ${languageName(lesson.primaryLanguage).split(' · ')[0]} · ${entryList(lesson).length} words`);
    text($('glLessonCount'), `${entryList(lesson).length} words loaded`);
    updateVoiceLabel(); updateStats(); updateCard();
  }
  function applySettings() {
    for (const [id, key] of [['glShowWord','showWord'],['glShowTranslation','showTranslation'],['glRepeat','repeat'],['glRelaxed','relaxed']]) $(id).checked = settings[key];
    writeStorage(localStore, SETTINGS_KEY, JSON.stringify(settings)); updateCard();
  }
  function changeSetting(key, value) {
    settings[key] = Boolean(value); applySettings(); onSettingsChange({ ...settings });
    if (key === 'repeat') { cancelSpeech(); if (playing && activeEntry && !muted && !panelOpen) speak(activeEntry, 'word', { repeat: settings.repeat }); }
  }
  function acceptLesson(payload, { source = 'import', defaults = selectedPair(), notify = true } = {}) {
    let next, original;
    try { original = transportValue(payload); next = canonical(original, defaults); }
    catch (error) { setStatus(error?.message || 'Could not read that lesson. Paste GoLingo JSON or one word | translation per line.', true); return { ok: false, error: error?.message || 'Invalid lesson' }; }
    cancelSpeech(); lesson = next; activeEntry = null; deck = []; deckPosition = 0; runCollected = 0; runUnique = new Set(); lastDeckEnd = '';
    loadBasket(); persistLesson(original, defaults);
    $('glExportFallback').classList.add('glHidden'); text($('glCoverImportHint'), '');
    syncLessonUI(); renderBasket();
    setStatus(`Loaded ${entryList(lesson).length} ${languageName(lesson.learningLanguage)} words. Start a new run to explore them.`);
    if (notify) onLessonChange(lesson, { source });
    return { ok: true, count: entryList(lesson).length, learningLanguage: lesson.learningLanguage, primaryLanguage: lesson.primaryLanguage };
  }
  function shuffleDeck(avoidFirst = '') {
    const input = [...entryList(lesson)];
    const result = shuffleEntries(input); deck = Array.isArray(result) ? result : input;
    if (deck.length > 1 && entryKey(deck[0]) === avoidFirst) {
      const different = deck.findIndex(item => entryKey(item) !== avoidFirst);
      if (different > 0) [deck[0], deck[different]] = [deck[different], deck[0]];
    }
    deckPosition = 0;
  }
  function beginRun() {
    cancelSpeech(); activeEntry = null; runCollected = 0; runUnique = new Set(); runNumber++;
    const firstKey = STORAGE + 'first:v1:' + lessonFingerprint(lesson);
    shuffleDeck(readStorage(localStore, firstKey) || lastDeckEnd);
    if (deck[0]) writeStorage(localStore, firstKey, entryKey(deck[0]));
    text($('glTargetLabel'), 'TARGET WORD'); $('glExample').open = false; updateCard(); updateStats();
    return { ...statsSnapshot(), entries: [...deck] };
  }
  function nextEntry() {
    if (deckPosition >= deck.length) shuffleDeck(lastDeckEnd);
    const entry = deck[deckPosition++] || entryList(lesson)[0] || null;
    if (entry) lastDeckEnd = entryKey(entry);
    return entry;
  }
  function focus(entry, { speak: shouldSpeak = true } = {}) {
    if (!entry?.word) return;
    const changed = !activeEntry || entryKey(activeEntry) !== entryKey(entry);
    activeEntry = entry;
    if (changed) { cancelSpeech(); $('glExample').open = false; text($('glTargetLabel'), 'TARGET WORD'); speechHint('Tap the word to hear it.'); }
    updateCard();
    if (changed && shouldSpeak && playing && !panelOpen) speak(entry, 'word', { repeat: settings.repeat });
  }
  function collect(entry) {
    if (!entry?.word) return;
    const key = entryKey(entry), now = Date.now();
    let row = basket.get(key);
    if (!row) { row = { entry, collections: 0, listens: listenCounts.get(key) || 0, firstCollected: now, lastCollected: now }; basket.set(key, row); }
    row.collections++; row.lastCollected = now; runCollected++; runUnique.add(key);
    saveBasket(); focus(entry); text($('glTargetLabel'), 'COLLECTED +1');
    clearTimeout(cardNoticeTimer); cardNoticeTimer = setTimeout(() => text($('glTargetLabel'), 'TARGET WORD'), 2400);
    updateStats(); if (panelOpen && panelTab === 'basket') renderBasket();
  }
  function playSentence(entry = activeEntry, { allowStopped = false } = {}) {
    cancelSpeech();
    if (!entry?.sentence) return Promise.resolve(false);
    focus(entry, { speak: false }); speechHint('Listen to the example sentence.');
    return speak(entry, 'sentence', { repeat: false, allowStopped });
  }
  function replayWord(entry = activeEntry) {
    return speak(entry, 'word', { manual: true, repeat: playing && settings.repeat && !panelOpen });
  }
  function setPlaying(value) {
    const changed = playing !== Boolean(value); playing = Boolean(value);
    if (!playing) cancelSpeech(); else { unlocked = true; if (changed && activeEntry && !panelOpen && !muted) speak(activeEntry, 'word', { repeat: settings.repeat }); }
    updateCard();
  }
  function setMuted(value) {
    const changed = muted !== Boolean(value); muted = Boolean(value);
    if (muted) { cancelSpeech(); speechHint('Sound is muted.'); }
    else if (changed && playing && activeEntry && !panelOpen) speak(activeEntry, 'word', { repeat: settings.repeat });
  }
  function renderBasket() {
    const list = $('glBasketList'); list.replaceChildren();
    if (!basket.size) {
      const empty = document.createElement('p'); empty.className = 'glBasketEmpty'; empty.textContent = 'Your basket is ready. Collect a word in the street to keep it here for review.'; list.append(empty); return;
    }
    for (const row of [...basket.values()].sort((a, b) => b.lastCollected - a.lastCollected)) {
      const item = document.createElement('article'); item.className = 'glBasketItem'; item.dataset.entryKey = entryKey(row.entry);
      const wordButton = document.createElement('button'); wordButton.type = 'button'; wordButton.className = 'glBasketWord'; wordButton.lang = langCode(lesson.learningLanguage); wordButton.textContent = row.entry.word; wordButton.setAttribute('aria-label', `Listen to ${row.entry.word}`); wordButton.addEventListener('click', () => speak(row.entry, 'word', { manual: true }));
      const translation = document.createElement('p'); translation.className = 'glBasketTranslation'; translation.lang = langCode(lesson.primaryLanguage); translation.textContent = row.entry.translation || '';
      const meta = document.createElement('small'); meta.className = 'glBasketMeta'; meta.textContent = `${row.collections} collected · ${row.listens} listens`;
      item.append(wordButton, translation, meta);
      if (row.entry.sentence) {
        const details = document.createElement('details'); details.className = 'glBasketExample';
        const summary = document.createElement('summary'); summary.textContent = 'Example sentence';
        const sentence = document.createElement('p'); sentence.lang = langCode(lesson.learningLanguage); sentence.textContent = row.entry.sentence;
        const translated = document.createElement('p'); translated.lang = langCode(lesson.primaryLanguage); translated.textContent = row.entry.sentenceTranslation || '';
        const listen = document.createElement('button'); listen.type = 'button'; listen.className = 'glTextButton'; listen.textContent = '▶ LISTEN TO SENTENCE'; listen.addEventListener('click', () => speak(row.entry, 'sentence', { manual: true }));
        details.append(summary, sentence, translated, listen); item.append(details);
      }
      list.append(item);
    }
  }
  function chooseTab(tab) {
    panelTab = tab === 'basket' ? 'basket' : 'lesson';
    $('glLessonTab').setAttribute('aria-selected', String(panelTab === 'lesson')); $('glBasketTab').setAttribute('aria-selected', String(panelTab === 'basket'));
    $('glLessonPane').classList.toggle('glHidden', panelTab !== 'lesson'); $('glBasketPane').classList.toggle('glHidden', panelTab !== 'basket');
    if (panelTab === 'basket') renderBasket();
    $('glPanel').querySelector('.glPanelScroll').scrollTop = 0;
  }
  function openPanel(tab = 'lesson') {
    cancelSpeech(); if (!panelOpen) previousFocus = document.activeElement;
    const wasOpen = panelOpen; panelOpen = true; chooseTab(tab); $('glPanel').classList.remove('glHidden'); document.body.classList.add('glPanelOpen'); updateCard();
    if (!wasOpen) onPanel(true);
    $('glClose').focus({ preventScroll: true });
  }
  function closePanel() {
    if (!panelOpen) return; cancelSpeech(); panelOpen = false; $('glPanel').classList.add('glHidden'); document.body.classList.remove('glPanelOpen');
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    onPanel(false); updateCard();
  }
  async function exportBasket() {
    if (!basket.size) { setStatus('Collect at least one word before exporting.', true, true); return; }
    let payload;
    try { payload = buildExport(lesson, [...basket.values()].map(row => row.entry)); }
    catch { setStatus('This basket could not be exported. Please try again.', true, true); return; }
    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
    text($('glExportText'), serialized); $('glExportText').value = serialized; $('glExportFallback').classList.remove('glHidden');
    const native = window.webkit?.messageHandlers?.golingoExport || window.webkit?.messageHandlers?.GoLingoExport || window.webkit?.messageHandlers?.exportWords;
    if (native?.postMessage) {
      try { await native.postMessage(typeof payload === 'string' ? JSON.parse(payload) : payload); setStatus('Sent the basket to GoLingo. A copy is also available below.', false, true); return; } catch { /* The normal download and copy routes remain available. */ }
    }
    try {
      const blob = new Blob([serialized], { type: 'application/json;charset=utf-8' }); const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `Ink-and-Iron-GoLingo-${lesson.learningLanguage}-${lesson.primaryLanguage}.json`; anchor.hidden = true; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      setStatus('Your JSON download is ready. If it does not save on your phone, use Copy JSON below.', false, true);
    } catch { setStatus('Use Copy JSON below to take your words into GoLingo.', false, true); }
  }
  async function copyExport() {
    const textarea = $('glExportText'), value = textarea.value;
    try { if (!navigator.clipboard?.writeText) throw new Error(); await navigator.clipboard.writeText(value); setStatus('Copied. Paste this JSON into GoLingo.', false, true); }
    catch { textarea.focus(); textarea.select(); textarea.setSelectionRange(0, value.length); let copied = false; try { copied = document.execCommand('copy'); } catch {} setStatus(copied ? 'Copied. Paste this JSON into GoLingo.' : 'The JSON is selected. Choose Copy, then paste it into GoLingo.', false, true); }
  }

  for (const item of languageOptions) {
    const code = item.code || item.id || item.value; if (!code) continue;
    for (const id of ['glLearningLanguage', 'glPrimaryLanguage']) { const option = document.createElement('option'); option.value = code; option.textContent = item.name || item.label || item.englishName || code; $(id).append(option); }
  }
  $('glLearningLanguage').value = 'es'; $('glPrimaryLanguage').value = 'en';
  const sources = [];
  try {
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    const query = new URLSearchParams(location.search);
    const explicit = hash.get('golingoLesson') || query.get('lesson') || query.get('data') || query.get('payload');
    if (explicit) sources.push({ value: explicit, label: 'Incoming lesson' });
  } catch {}
  for (const name of ['GoLingoData', 'golingoData', 'lessonData']) if (window[name] && ['string','object'].includes(typeof window[name])) sources.push({ value: window[name], label: 'App lesson' });
  const session = readStorage(sessionStore, SESSION_KEY), saved = readStorage(localStore, LESSON_KEY);
  if (session) sources.push({ value: session, label: 'Session lesson' }); if (saved) sources.push({ value: saved, label: 'Saved lesson', retained: true });
  let initialInput, initialDefaults;
  for (const source of sources) {
    try {
      const retained = source.retained ? retainedInput(source.value) : { input: transportValue(source.value), defaults: { learningLanguage: 'es', primaryLanguage: 'en' } };
      lesson = canonical(retained.input, retained.defaults); initialInput = retained.input; initialDefaults = retained.defaults; break;
    }
    catch (error) { if (!initialError) initialError = `${source.label} could not be loaded: ${error.message || 'check the word format'}`; }
  }
  if (!lesson) lesson = canonical(getStarterLesson('es', 'en'), { learningLanguage: 'es', primaryLanguage: 'en' });
  loadBasket(); applySettings(); syncLessonUI(); renderBasket();
  if (initialError) { setStatus(initialError + ' Your available lesson is still ready to play.', true); text($('glCoverImportHint'), 'Using your available words. Open Lesson to check the incoming data.'); }
  persistLesson(initialInput || lesson, initialDefaults || { learningLanguage: lesson.learningLanguage, primaryLanguage: lesson.primaryLanguage });
  window.speechSynthesis?.addEventListener?.('voiceschanged', refreshVoices); refreshVoices();

  lessonButton.addEventListener('click', () => openPanel('lesson')); basketButton.addEventListener('click', () => openPanel('basket'));
  $('glCoverLessonButton')?.addEventListener('click', () => openPanel('lesson'));
  $('glClose').addEventListener('click', closePanel); $('glPanel').addEventListener('click', event => { if (event.target === $('glPanel')) closePanel(); });
  $('glLessonTab').addEventListener('click', () => { cancelSpeech(); chooseTab('lesson'); }); $('glBasketTab').addEventListener('click', () => { cancelSpeech(); chooseTab('basket'); });
  $('glReplayWord').addEventListener('click', () => replayWord());
  $('glListen').addEventListener('click', () => replayWord());
  $('glReplaySentence').addEventListener('click', () => speak(activeEntry, 'sentence', { manual: true }));
  $('glHunt').addEventListener('click', () => onHunt(activeEntry));
  $('glWordToggle').addEventListener('click', () => changeSetting('showWord', !settings.showWord)); $('glTranslationToggle').addEventListener('click', () => changeSetting('showTranslation', !settings.showTranslation));
  for (const [id, key] of [['glShowWord','showWord'],['glShowTranslation','showTranslation'],['glRepeat','repeat'],['glRelaxed','relaxed']]) $(id).addEventListener('change', event => changeSetting(key, event.target.checked));
  for (const id of ['glLearningLanguage','glPrimaryLanguage']) $(id).addEventListener('change', () => text($('glLanguageHint'), 'These language choices will apply to your next import or starter lesson. Your current words are unchanged.'));
  $('glApply').addEventListener('click', () => { const value = $('glImport').value.trim(); if (!value) { setStatus('Paste your words first, or choose Use starter words.', true); return; } acceptLesson(value); });
  $('glUseStarter').addEventListener('click', () => { const pair = selectedPair(); try { const starter = getStarterLesson(pair.learningLanguage, pair.primaryLanguage); const result = acceptLesson(starter, { source: 'starter', defaults: pair }); if (result.ok) $('glImport').value = ''; } catch (error) { setStatus(error.message || 'No starter lesson is available for that language pair.', true); } });
  $('glExport').addEventListener('click', exportBasket); $('glCopyExport').addEventListener('click', copyExport);
  $('glClearBasket').addEventListener('click', () => { cancelSpeech(); basket.clear(); listenCounts.clear(); saveBasket(); updateStats(); renderBasket(); $('glExportFallback').classList.add('glHidden'); setStatus('The review basket for this lesson is now empty.', false, true); });
  for (const element of [shell, lessonButton, basketButton, coverLesson]) for (const type of ['pointerdown','pointerup','touchstart','touchend']) element.addEventListener(type, event => event.stopPropagation(), { passive: true });
  document.addEventListener('keydown', event => {
    if (!panelOpen) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closePanel(); return; }
    if (event.key === 'Tab') {
      const focusable = [...$('glPanel').querySelectorAll('button:not([disabled]), select, textarea, input, a[href], summary')].filter(element => element.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    event.stopPropagation();
  }, true);

  const receive = payload => acceptLesson(payload, { source: 'app', defaults: { learningLanguage: lesson.learningLanguage, primaryLanguage: lesson.primaryLanguage } });
  window.setGoLingoData = receive; window.receiveGoLingoData = receive; window.loadGoLingoLesson = receive;
  if (!window.GoLingo || typeof window.GoLingo !== 'object') window.GoLingo = {};
  Object.assign(window.GoLingo, { receiveWords: receive, onPayload: receive, loadLesson: receive });
  window.addEventListener('message', event => {
    const sameOrigin = event.origin === location.origin && event.origin !== 'null';
    const gallery = event.origin === 'https://xcergolingo.github.io';
    const nativeSource = event.origin === 'null' && (event.source === window || event.source === window.parent);
    if (!sameOrigin && !gallery && !nativeSource) return;
    let payload = event.data;
    if (!payload || typeof payload !== 'object') return;
    const known = ['golingo-data','GOLINGO_DATA','golingo:lesson','golingoLesson','GOLINGO_LESSON','loadLesson','GoLingoData','GOLINGO_PAYLOAD'];
    if (payload.type && !known.includes(payload.type)) return;
    payload = payload.payload || payload.lesson || payload.data || payload;
    if (typeof payload === 'string' || Array.isArray(payload) || Array.isArray(payload?.words) || Array.isArray(payload?.entries) || Array.isArray(payload?.sentences)) receive(payload);
  });
  window.addEventListener('pagehide', stop);
  return {
    get lesson() { return lesson; }, get settings() { return { ...settings }; }, get stats() { return statsSnapshot(); }, get activeEntry() { return activeEntry; }, get isSpeaking() { return speaking || Boolean(recording) || Boolean(utterance); },
    beginRun, nextEntry, focus, collect, playSentence, replayWord, setPlaying, setMuted, stop, openPanel, closePanel, updateStats,
  };
}
