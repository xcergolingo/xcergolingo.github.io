import { Pond } from './pond.js?v=1.1.1';
import { ZenMusic } from './music.js?v=1.1.1';
import { LANGUAGES, makeDefaultDeck, normalizePayload, shuffle, deckKey, Speaker, Ambience } from './learning.js?v=1.1.1';

const $ = id => document.getElementById(id);
const SVG = (body, cls = '') => `<svg class="${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const icons = {
  globe: SVG('<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6.5h14M5 17.5h14"/>'),
  chevron: SVG('<path d="m7 10 5 5 5-5"/>'),
  arrow: SVG('<path d="M4 12h15m-5-5 5 5-5 5"/>'),
  volume: SVG('<path d="M10 5 5 9H2v6h3l5 4V5Z"/><path d="M14 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>'),
  music: SVG('<path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2.5"/><ellipse cx="17" cy="16" rx="3" ry="2.5"/>'),
  musicOff: SVG('<path d="m3 3 18 18M9 12v6m0-10V5l11-2v12M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2.5"/><path d="M20 16c0 1.4-1.3 2.5-3 2.5s-3-1.1-3-2.5 1.3-2.5 3-2.5"/>'),
  mute: SVG('<path d="M10 5 5 9H2v6h3l5 4V5Z"/><path d="m15 9 6 6m0-6-6 6"/>'),
  pause: SVG('<path d="M8 5v14M16 5v14" stroke-width="2.5"/>'),
  play: SVG('<path d="m8 5 11 7-11 7V5Z"/>'),
  leaf: SVG('<path d="M20 3C8 2 1 9 6 16s15 0 14-13Z"/><path d="M3 21 15 9m-7 8v-6m0 6h6"/>'),
  sparkles: SVG('<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM3 3v4M1 5h4"/>'),
  lotus: SVG('<path d="M12 18C5 13 9 7 12 3c3 4 7 10 0 15Z"/><path d="M12 20C2 20 1 12 3 9c4 0 7 3 9 9m0 2c10 0 11-8 9-11-4 0-7 3-9 9M3 20h18"/>'),
  hand: SVG('<path d="M9 11V5a2 2 0 0 1 4 0v7-4a1.8 1.8 0 0 1 3.6 0v4-2a1.7 1.7 0 0 1 3.4 0v5c0 4-2 6-6 6h-1c-3 0-4-2-6-5l-3-4c-1-2 1-4 3-2l2 2"/>'),
  chat: SVG('<path d="M20 15a3 3 0 0 1-3 3H9l-5 3V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8ZM8 9h8M8 13h5"/>'),
  repeat: SVG('<path d="m16 2 4 4-4 4M4 10V8a2 2 0 0 1 2-2h14M8 22l-4-4 4-4m12 0v2a2 2 0 0 1-2 2H4"/>'),
  eye: SVG('<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff: SVG('<path d="m3 3 18 18M9 5.5C15 3 20 8 22 12c-1 2-2 3-4 5M6 6C4 8 3 10 2 12c3 6 8 9 14 6m-7-9a4 4 0 0 0 6 6"/>'),
  compass: SVG('<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6 6-2Z"/>'),
  book: SVG('<path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v15M5 8h3M5 11h3m8-3h3m-3 3h3"/>'),
  fish: SVG('<path d="M3 12s5-8 11-7c4 1 6 7 6 7s-2 6-6 7c-6 1-11-7-11-7Zm0 0L1 7v10l2-5ZM11 5l2-3 4 4m-6 13 2 3 4-4"/><circle cx="16" cy="10" r=".7" fill="currentColor"/>'),
  settings: SVG('<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m9 3 1-1h4l1 3 2 1 3-.5 2 3-2 2v3l2 2-2 3-3-.5-2 1-1 3h-4l-1-3-2-1-3 .5-2-3 2-2v-3L2 9l2-3 3 .5 2-1V3Z"/>'),
  external: SVG('<path d="M14 3h7v7m0-7-11 11M10 3H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6"/>'),
  close: SVG('<path d="m6 6 12 12M6 18 18 6"/>'),
  download: SVG('<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>'),
  upload: SVG('<path d="M12 17V5m-5 5 5-5 5 5M4 17v4h16v-4"/>'),
  plus: SVG('<path d="M12 5v14M5 12h14"/>'),
  check: SVG('<path d="m5 12 5 5L20 7"/>'),
  lock: SVG('<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>'),
};
function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icons[el.dataset.icon] || ''; }); }
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function readStore(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
let storageNotice = false;
function saveStore(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { if (!storageNotice) { storageNotice = true; toast('This browser cannot save more progress. Export your word basket to keep a copy.'); } } }
const defaults = { learning:'ja', primary:'en', repeat:true, translation:true, sound:true, ambience:false, music:true, musicVolume:0.35, rate:0.82, theme:'jade', koi:'kohaku' };
const cachedSettings = readStore('golingo-koi-settings-v1', {});
const settings = {...defaults, ...(cachedSettings && typeof cachedSettings === 'object' ? cachedSettings : {})};
settings.music = settings.music !== false;
settings.musicVolume = Number.isFinite(Number(settings.musicVolume)) ? Math.max(0,Math.min(1,Number(settings.musicVolume))) : 0.35;
if (!['jade','dusk','moon'].includes(settings.theme)) settings.theme = 'jade';
if (!['kohaku','sanke','ogon','dragon'].includes(settings.koi)) settings.koi = 'kohaku';
let deck = makeDefaultDeck(settings.learning, settings.primary);
let customDeck = false;
try { const saved = readStore('golingo-koi-deck-v1', null); if (saved) { deck = normalizePayload(saved); customDeck = true; } } catch { /* A damaged saved deck should never block the pond. */ }
settings.learning = deck.learningLanguage;
settings.primary = deck.primaryLanguage;
let savedProgress = readStore('golingo-koi-progress-v1', {});
if (!savedProgress || Array.isArray(savedProgress) || typeof savedProgress !== 'object') savedProgress = {};
let progress, key;
let started = false, paused = false, mode = 'explore', currentItem = null, lastCollected = false;
let queue = [], activeItems = [], targetItem = null, assisted = false, challengeBusy = false;
let sceneRevision = 0, refillTimer, challengeTimer, toastTimer, hintTimer, deferredTransition = null;
let panelView = '', exportValue = '', importFormat = 'lines';
let statusLast = '', musicStatusLast = '', musicBlocked = false;
const music = new ZenMusic({onStatus: message => {
  musicBlocked=Boolean(message);
  if (message && message !== musicStatusLast) {musicStatusLast=message;toast(message,5500);}
  if (!message) musicStatusLast='';
  updateMusicButton();
}});
const speaker = new Speaker({onActivity: active => music.setDucked(active), onStatus: message => { if (message && message !== statusLast) { statusLast = message; toast(message, 6000); } }});
const ambience = new Ambience();
const pond = new Pond($('pond'), { onCollect: collectPearl, onMove: () => { if (started) { $('instruction').hidden = true; clearTimeout(hintTimer); } } });
hydrateIcons();
speaker.setEnabled(settings.sound);
speaker.setRepeat(settings.repeat);
speaker.setRate(settings.rate);
music.setVolume(settings.musicVolume);
music.setTheme(settings.theme);
pond.setTheme(settings.theme);
pond.setActive(false);
loadProgress();
fillSelect($('welcomeLanguage'), settings.learning);
updateLanguageLabels();
updateProgress();
updateAudioButton();
updateMusicButton();
updateSafeArea();

function saveSettings() { saveStore('golingo-koi-settings-v1', settings); }
function loadProgress() {
  key = deckKey(deck);
  const old = savedProgress[key] || {};
  const validIds = new Set(deck.words.map(w => w.id));
  const records = Object.create(null);
  if (old.words && typeof old.words === 'object') for (const [id, record] of Object.entries(old.words)) {
    if (validIds.has(id) && record && typeof record === 'object') records[id] = {count:Math.max(1, Number(record.count) || 1), correct:Math.max(0, Number(record.correct) || 0), lastAt:Number(record.lastAt)||Date.now()};
  }
  progress = {words:records, attempts:Math.max(0, Number(old.attempts)||0), visits:Math.max(0, Number(old.visits)||0)};
  savedProgress[key] = progress;
  if (unlockCount() < koiThreshold(settings.koi)) settings.koi = 'kohaku';
  pond.setKoi(settings.koi);
}
function persistProgress() { savedProgress[key] = progress; const entries = Object.entries(savedProgress); if (entries.length > 24) savedProgress = Object.fromEntries(entries.slice(-24)); saveStore('golingo-koi-progress-v1', savedProgress); }
function unlockCount() { return Object.keys(progress.words).length; }
function koiThreshold(kind) { return ({kohaku:0,sanke:4,ogon:8,dragon:12})[kind] ?? 0; }
function langInfo(code) { return LANGUAGES.find(l => l.code === String(code).split('-')[0]) || {code, name:code, nativeName:code}; }
function languageOptions(selected) { const known = LANGUAGES.some(l => l.code === selected); return `${known ? '' : `<option value="${esc(selected)}" selected>${esc(selected)}</option>`}${LANGUAGES.map(l => `<option value="${l.code}" ${l.code === selected ? 'selected' : ''}>${esc(l.name)} · ${esc(l.nativeName)}</option>`).join('')}`; }
function fillSelect(element, value) { element.innerHTML = languageOptions(value); }
function updateLanguageLabels() {
  $('languageLabel').innerHTML = `${esc(langInfo(deck.learningLanguage).nativeName)} <i>· ${esc(String(deck.primaryLanguage).toUpperCase())}</i>`;
  $('languageBtn').setAttribute('aria-label', `Learning ${langInfo(deck.learningLanguage).name}, translations in ${langInfo(deck.primaryLanguage).name}. Choose languages.`);
  fillSelect($('welcomeLanguage'), deck.learningLanguage);
}
function updateProgress() {
  const count = unlockCount();
  $('basketCount').textContent = count;
  $('growthNumber').textContent = `${Math.min(count,12)} / 12`;
  $('growthFill').style.width = `${Math.min(100,count / 12 * 100)}%`;
  $('growthTitle').textContent = count >= 12 ? 'Dragon form unlocked' : count >= 8 ? 'Your dragon is getting closer' : count >= 4 ? 'A growing little collection' : 'A little koi, a new beginning';
  pond.setGrowth(Math.min(1,count/12));
}
function toast(message, duration = 3400) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => { $('toast').hidden = true; }, duration); }
function updateSafeArea() {
  const mobile = innerWidth <= 700, short = innerHeight <= 560 && innerWidth >= 600;
  const visibleRect = id => { const el=$(id); return el && !el.hidden && el.getClientRects().length ? el.getBoundingClientRect() : null; };
  const upper = ['modeSwitch','growthPill','practiceCard'].map(visibleRect).filter(Boolean);
  const header = document.querySelector('.topbar').getBoundingClientRect();
  const top = Math.max(header.bottom, ...upper.map(r=>r.bottom)) + 34;
  const card = visibleRect('wordCard');
  const dock = document.querySelector('.bottom-controls').getBoundingClientRect();
  const bottom = innerHeight - Math.min(!short && card ? card.top : innerHeight, dock.top) + 58;
  const left = short && card ? card.right + 75 : mobile ? 80 : 95;
  pond.setSafeArea?.({top, bottom, left, right:mobile?80:95});
  if (mobile && !short) $('guideBtn').style.bottom=`${card ? dock.bottom-card.top+12 : dock.height+20}px`;
  else $('guideBtn').style.removeProperty('bottom');
}
function runWhenSwimming(action) {
  if (paused || $('panel').open || document.hidden) deferredTransition=action;
  else action();
}
function resetSceneTimers() { sceneRevision++; clearTimeout(refillTimer); clearTimeout(challengeTimer); clearTimeout(hintTimer); deferredTransition=null; challengeBusy = false; }
function setSuspended() {
  const suspended = paused || $('panel').open || document.hidden;
  pond.setPaused(suspended);
  if (suspended) speaker.stop();
  ambience.setEnabled(started && settings.ambience && !suspended);
  syncMusic();
  if (!suspended && deferredTransition) {const action=deferredTransition;deferredTransition=null;action();}
}
function startGame() {
  speaker.unlock();
  if (settings.ambience) ambience.unlock();
  if (settings.music) unlockMusic();
  started = true;
  paused = false;
  $('pausedOverlay').hidden = true;
  $('welcome').hidden = true;
  $('growthPill').hidden = false;
  $('modeSwitch').hidden = false;
  $('guideBtn').hidden = false;
  progress.visits++;
  persistProgress();
  pond.setActive(true);
  setMode('explore');
  setSuspended();
  $('pond').focus({preventScroll:true});
  $('instruction').hidden = false;
  hintTimer = setTimeout(() => { $('instruction').hidden = true; }, 12000);
}
function newQueue() { queue = [...shuffle(deck.words.filter(w => !Object.hasOwn(progress.words,w.id))), ...shuffle(deck.words.filter(w => Object.hasOwn(progress.words,w.id)))]; }
function nextItem() {
  for (let i = 0; i < deck.words.length * 3; i++) {
    if (!queue.length) queue = shuffle(deck.words);
    const item = queue.shift();
    if (!activeItems.some(w => w.id === item.id)) return item;
  }
  return null;
}
function renderPearls(keepPositions = true) {
  const positions = new Map((keepPositions ? pond.getPearls() : []).map(p => [p.id,p]));
  pond.setPearls(activeItems.map((w,i) => { const p=positions.get(w.id); return {id:w.id,label:w.word,color:['#f7e6a7','#ecedc7','#f4d2bf','#d8e6d0'][i%4],...(p ? {x:p.x,y:p.y} : {})}; }));
}
function fillExplore() {
  const count = Math.min(innerWidth <= 700 || innerHeight <= 560 ? 3 : 4, deck.words.length);
  while (activeItems.length < count) { const item=nextItem(); if (!item) break; activeItems.push(item); }
  renderPearls();
  if (!currentItem && activeItems[0]) showWord(activeItems[0], 'SWIM TO YOUR FIRST WORD', false);
}
function setMode(next) {
  if (!started) return;
  resetSceneTimers();
  speaker.stop();
  mode = next;
  activeItems = [];
  targetItem = null;
  pond.setPearls([]);
  $('exploreBtn').classList.toggle('active', mode === 'explore');
  $('practiceBtn').classList.toggle('active', mode === 'practice');
  $('exploreBtn').setAttribute('aria-pressed', String(mode === 'explore'));
  $('practiceBtn').setAttribute('aria-pressed', String(mode === 'practice'));
  $('practiceCard').hidden = mode !== 'practice';
  $('wordCard').hidden = mode === 'practice';
  $('guideBtn').innerHTML = `${icons.compass}<span>${mode === 'practice' ? 'Help me find it' : 'Find a word'}</span>`;
  $('instruction').hidden = true;
  updateSafeArea();
  if (mode === 'practice') newChallenge();
  else { newQueue(); fillExplore(); if (currentItem) showWord(currentItem, lastCollected ? 'YOUR LATEST DISCOVERY' : 'SWIM TO YOUR FIRST WORD', lastCollected); }
}
function collectPearl(id) {
  if (!started || paused || $('panel').open || challengeBusy) return;
  const item = activeItems.find(w => w.id === id);
  if (!item) return;
  activeItems = activeItems.filter(w => w.id !== id);
  if (mode === 'practice') {
    progress.attempts++;
    if (id !== targetItem?.id) {
      speaker.speak(item, deck.learningLanguage, {repeat:false});
      $('practiceFeedback').textContent = `${item.word} means ${item.translation}. Try another pearl.`;
      renderPearls();
      persistProgress();
      return;
    }
    challengeBusy = true;
    rememberWord(item, !assisted);
    $('practiceFeedback').textContent = assisted ? 'Found it. Listen, then try the next one.' : 'That’s right. A little more fluent.';
    $('practiceMeaning').textContent = `${item.word} · ${item.translation}`;
    speaker.speak(item,deck.learningLanguage,{repeat:false});
    pond.burst();
    renderPearls();
    const revision = sceneRevision;
    challengeTimer = setTimeout(() => runWhenSwimming(() => { if (revision === sceneRevision && mode === 'practice') newChallenge(); }), 1900);
  } else {
    const isNew = !Object.hasOwn(progress.words,item.id);
    rememberWord(item, false);
    showWord(item, isNew ? 'A NEW WORD IN YOUR GARDEN' : 'A LITTLE MORE PRACTICE', true);
    speaker.speak(item, deck.learningLanguage, {repeat:settings.repeat});
    renderPearls();
    const revision = sceneRevision;
    clearTimeout(refillTimer);
    refillTimer = setTimeout(() => runWhenSwimming(() => { if (revision === sceneRevision && mode === 'explore') fillExplore(); }), 750);
  }
}
function rememberWord(item, correct) {
  const before = unlockCount();
  const record = progress.words[item.id] || {count:0,correct:0,lastAt:0};
  record.count++; record.lastAt = Date.now(); if (correct) record.correct++;
  progress.words[item.id] = record;
  currentItem = item; lastCollected = true;
  persistProgress(); updateProgress(); ambience.ping(unlockCount());
  const after=unlockCount();
  if (after > before) {
    if (after === 4) toast('Sanke unlocked. A new koi is waiting in My koi.');
    else if (after === 8) toast('Golden Ogon unlocked. Your garden is growing.');
    else if (after === 12) toast('Your dragon is ready! Choose Dragon in My koi.', 5000);
    else if (after === 1) toast('Your first word! Listen again, or swim to the next pearl.');
  }
}
function showWord(item, label, collected) {
  currentItem = item; lastCollected = collected;
  $('wordEyebrow').textContent = label;
  $('wordBadge').textContent = String(unlockCount()).padStart(2,'0');
  $('currentWord').textContent = item.word;
  $('currentWord').lang = deck.learningLanguage;
  $('currentWord').dir = 'auto';
  $('currentWord').classList.toggle('long-word', item.word.length > 9);
  $('romanization').textContent = item.romanization || '';
  $('romanization').hidden = !item.romanization;
  $('translation').textContent = item.translation;
  $('translation').dir = 'auto';
  $('translation').lang = deck.primaryLanguage;
  $('translation').hidden = !settings.translation;
  $('sentenceText').textContent = item.sentence || '';
  $('sentenceText').dir = 'auto'; $('sentenceText').lang=deck.learningLanguage;
  $('sentenceTranslation').textContent = item.sentenceTranslation || '';
  $('sentenceTranslation').dir='auto'; $('sentenceTranslation').lang=deck.primaryLanguage;
  $('sentenceTranslation').hidden = !settings.translation;
  $('sentenceBlock').hidden = true;
  $('sentenceBtn').disabled = !item.sentence;
  $('sentenceBtn').classList.remove('selected');
  $('wordCard').hidden = mode !== 'explore';
  $('wordCard').classList.remove('flash');
  if (collected) { requestAnimationFrame(() => $('wordCard').classList.add('flash')); }
  updateToggles();
  updateSafeArea();
}
function updateToggles() {
  $('repeatBtn').innerHTML = `${icons.repeat}<span>Repeat ${settings.repeat?'on':'off'}</span>`;
  $('repeatBtn').classList.toggle('selected',settings.repeat);
  $('repeatBtn').setAttribute('aria-pressed',String(settings.repeat));
  $('translationBtn').innerHTML = settings.translation ? icons.eye : icons.eyeOff;
  $('translationBtn').classList.toggle('selected',settings.translation);
  $('translationBtn').setAttribute('aria-pressed',String(settings.translation));
  $('translationBtn').setAttribute('aria-label',`${settings.translation?'Hide':'Show'} translations`);
  $('translationBtn').title = `${settings.translation?'Hide':'Show'} translations`;
}
function newChallenge() {
  challengeBusy = false; assisted = false;
  speaker.stop();
  const uniq=[]; const meanings=new Set(),words=new Set();
  for (const w of shuffle(deck.words)) { const m=w.translation.trim().toLocaleLowerCase(),s=Array.from(w.word.trim().toLocaleLowerCase()).slice(0,8).join(''); if (!m || meanings.has(m) || words.has(s)) continue; meanings.add(m); words.add(s); uniq.push(w); }
  if (uniq.length < 2) { toast('Practice needs two words with distinct beginnings and meanings. You can keep learning this set in Explore.', 5000); setMode('explore'); return; }
  const discovered = uniq.filter(w => Object.hasOwn(progress.words,w.id));
  const choices = discovered.length >= 3 ? discovered : uniq;
  const pool = choices.filter(w => w.id !== targetItem?.id);
  targetItem = shuffle(pool.length ? pool : choices)[0];
  const others = shuffle(uniq.filter(w => w.id !== targetItem.id)).slice(0,Math.min(2,uniq.length-1));
  activeItems = shuffle([targetItem,...others]);
  $('wordCard').hidden = true;
  $('practiceMeaning').textContent = targetItem.translation;
  $('practiceMeaning').dir = 'auto';
  $('practiceMeaning').lang = deck.primaryLanguage;
  $('practiceFeedback').textContent = `${activeItems.length === 3?'Three':'Two'} pearls. One meaning. No rush.`;
  renderPearls(false);
  updateSafeArea();
}
function updateAudioButton() {
  $('soundBtn').innerHTML = settings.sound ? icons.volume : icons.mute;
  $('soundBtn').setAttribute('aria-label',`${settings.sound?'Mute':'Enable'} pronunciation`);
  $('soundBtn').title = `Pronunciation ${settings.sound?'on':'off'}`;
}
function musicDescription() {
  if (!settings.music) return 'Music is off';
  if (!started) return 'Starts when you enter the pond';
  if (paused || document.hidden) return 'Paused with your koi';
  if (musicBlocked) return 'Tap Zen music to enable audio';
  if (settings.musicVolume === 0) return 'Volume muted';
  return music.getState?.().playing ? 'Playing · softens while a word is spoken' : 'Music is starting';
}
function updateMusicButton() {
  const enabled=settings.music, button=$('musicBtn');
  button.innerHTML=`${enabled ? icons.music : icons.musicOff}<span>${musicBlocked && enabled ? 'Tap for music' : 'Zen music'}</span>`;
  button.classList.toggle('is-on',enabled);
  button.setAttribute('aria-pressed',String(enabled));
  button.setAttribute('aria-label',musicBlocked && enabled ? 'Enable zen background music' : `${enabled?'Turn off':'Turn on'} zen background music`);
  button.title=musicDescription();
  if ($('musicStatus')) $('musicStatus').textContent=musicDescription();
  if ($('musicSetting')) $('musicSetting').checked=enabled;
}
function syncMusic() {
  music.setEnabled(started && settings.music && !paused && !document.hidden);
  updateMusicButton();
}
function unlockMusic() {
  return music.unlock().then(ok=>{musicBlocked=!ok;if(ok)musicStatusLast='';syncMusic();return ok;});
}
function toggleMusic() {
  if (musicBlocked && settings.music) {unlockMusic();return;}
  settings.music=!settings.music;
  if(settings.music) unlockMusic();
  syncMusic();saveSettings();
}
function musicControls() {
  return `<label class="setting-row"><span>Zen background music<small id="musicStatus">${esc(musicDescription())}</small></span><input class="switch" id="musicSetting" type="checkbox" ${settings.music?'checked':''} aria-label="Zen background music"></label><div class="music-volume-row"><label for="musicVolume">Music volume</label><input id="musicVolume" type="range" min="0" max="100" step="1" value="${Math.round(settings.musicVolume*100)}" aria-label="Zen music volume"><output id="musicVolumeValue" for="musicVolume">${Math.round(settings.musicVolume*100)}%</output></div>`;
}
function playExplicit(item, options={repeat:false}) {
  speaker.unlock();
  if (!settings.sound) {settings.sound=true;updateAudioButton();saveSettings(); const input=$('soundSetting');if(input)input.checked=true;}
  speaker.setEnabled(true);
  speaker.speak(item,deck.learningLanguage,options);
}
function toggleAudio() { settings.sound = !settings.sound; speaker.unlock(); speaker.setEnabled(settings.sound); updateAudioButton(); saveSettings(); if (settings.sound && currentItem && mode==='explore' && started && !paused) speaker.speak(currentItem,deck.learningLanguage,{repeat:settings.repeat}); }
function pauseGame(value = !paused) {
  paused=value;
  if (!paused && settings.music) unlockMusic();
  $('pausedOverlay').hidden=!paused;
  $('pauseBtn').innerHTML=paused?icons.play:icons.pause;
  $('pauseBtn').setAttribute('aria-label',paused?'Resume game':'Pause game');
  setSuspended();
}
function setDeck(nextDeck, custom = false) {
  resetSceneTimers(); speaker.stop();
  deck=normalizePayload(nextDeck); customDeck=custom;
  settings.learning=deck.learningLanguage; settings.primary=deck.primaryLanguage;
  if (custom) saveStore('golingo-koi-deck-v1',deck);
  else { try {localStorage.removeItem('golingo-koi-deck-v1');} catch {} }
  currentItem=null; lastCollected=false; targetItem=null; activeItems=[];
  pond.setPearls([]);
  loadProgress(); saveSettings(); updateLanguageLabels(); updateProgress();
  if (started) setMode('explore');
}
function openPanel(view) {
  panelView=view;
  speaker.stop();
  renderPanel();
  if (!$('panel').open) $('panel').showModal();
  setSuspended();
}
function closePanel() { $('panel').close(); }
function panel(title, content, eyebrow='YOUR GARDEN') {
  $('panelTitle').textContent=title; $('panelEyebrow').textContent=eyebrow;
  $('panelContent').innerHTML=content; hydrateIcons($('panelContent'));
}
function wordRows(words, showAll=false) {
  return words.map(w => `<div class="word-row"><div class="word-item"><strong dir="auto" lang="${esc(deck.learningLanguage)}">${esc(w.word)}</strong>${w.romanization?`<span class="word-native">${esc(w.romanization)}</span>`:''}<p dir="auto" lang="${esc(deck.primaryLanguage)}">${esc(w.translation)}</p><small>${progress.words[w.id]?`${progress.words[w.id].count} discoveries${progress.words[w.id].correct?` · ${progress.words[w.id].correct} correct matches`:''}`:showAll?'Waiting in your pond':''}</small></div><button class="icon-button" data-action="speak-word" data-id="${esc(w.id)}" aria-label="Listen to ${esc(w.word)}">${icons.volume}</button></div>`).join('');
}
function renderPanel() {
  if (panelView==='words' || panelView==='allWords') {
    const all=panelView==='allWords';
    const found=deck.words.filter(w=>Object.hasOwn(progress.words,w.id)).sort((a,b)=>progress.words[b.id].lastAt-progress.words[a.id].lastAt);
    const correct=Object.values(progress.words).reduce((sum,r)=>sum+r.correct,0);
    panel(all?'Your word set':'Words collected',`<p class="panel-description">${all?'Your koi can discover every word in this set.':`A little collection of everything you’ve discovered. Tap a speaker to listen again.`}</p><div class="stat-grid"><div><strong>${found.length}</strong><span>discovered</span></div><div><strong>${correct}</strong><span>correct matches</span></div><div><strong>${deck.words.length}</strong><span>words in pond</span></div></div><div class="button-row"><button class="secondary-button panel-primary" data-action="import">${icons.plus} Add my words</button><button class="secondary-button" data-action="export" ${!found.length?'disabled':''}>${icons.download} Export basket</button></div><div class="row-between"><div class="section-label">${all?'CURRENT LESSON':'YOUR WORD BASKET'}</div><button class="link-button" data-action="${all?'words':'allWords'}">${all?'Collected only':'See all lesson words'}</button></div>${(all?deck.words:found).length?`<div class="word-list">${wordRows(all?deck.words:found,all)}</div>`:`<div class="empty-state">${icons.leaf}<br>Your collection starts with a single word.<br>Swim to a glowing pearl to discover it.</div>`}<p class="panel-note">${customDeck?'Your custom set':'Nature starter set'} · ${esc(langInfo(deck.learningLanguage).name)} → ${esc(langInfo(deck.primaryLanguage).name)}. Progress is saved in this browser.</p>`);
  } else if (panelView==='koi') {
    const count=unlockCount();
    const kinds=[['kohaku','Kohaku','Pearl white & vermilion'],['sanke','Sanke','Three colors, one quiet soul'],['ogon','Golden Ogon','A little shimmer in the water'],['dragon','River dragon','Let your curiosity take flight']];
    panel('A koi of your own',`<p class="panel-description">Every new word helps your koi grow. Discover 12 different words to unlock your river dragon.</p><div class="collection-grid">${kinds.map(([id,name,desc])=>{const unlocked=count>=koiThreshold(id);return `<button class="koi-choice ${settings.koi===id?'active':''}" data-action="choose-koi" data-koi="${id}" ${!unlocked?'disabled':''}><span class="koi-lock">${settings.koi===id?`${icons.check} Swimming`:!unlocked?`${icons.lock} ${count} / ${koiThreshold(id)}`:''}</span><div class="koi-preview">${koiPreview(id)}</div><strong>${name}</strong><small>${unlocked?desc:`Discover ${koiThreshold(id)} different words`}</small></button>`;}).join('')}</div><p class="panel-note">Your koi collection follows this word set. Explore at your own pace; there are no lives or timers.</p>`);
  } else if (panelView==='garden') {
    panel('Find your kind of calm',`<p class="panel-description">Choose the light for your pond. Your koi, words, and progress come with you.</p><div class="theme-grid">${[['jade','Lotus morning'],['dusk','Golden evening'],['moon','Moonlit water']].map(([id,name])=>`<button class="theme-choice ${settings.theme===id?'active':''}" data-action="theme" data-theme="${id}"><div class="theme-swatch ${id}"></div><strong>${name}</strong></button>`).join('')}</div>${musicControls()}<label class="setting-row"><span>Water & gentle chimes<small>A soft soundscape for your discoveries</small></span><input class="switch" id="ambienceSetting" type="checkbox" ${settings.ambience?'checked':''} aria-label="Water and gentle chimes"></label><div class="button-row"><button class="secondary-button" data-action="shuffle">${icons.repeat} A fresh swim</button><button class="secondary-button panel-primary" data-action="close">Return to pond</button></div><p class="panel-note">A fresh swim changes the order of words. Your collected words and koi stay with you.</p>`);
  } else if (panelView==='settings') {
    panel('Make yourself at home',`<div class="form-row"><label class="field">I’m learning<select id="settingLearning">${languageOptions(deck.learningLanguage)}</select></label><label class="field">Translate into<select id="settingPrimary">${languageOptions(deck.primaryLanguage)}</select></label></div><button class="secondary-button panel-primary" data-action="apply-languages" style="width:100%">Use these languages</button><p class="panel-note">Choosing languages loads the nature starter set. Add your own vocabulary from Words → Add my words.</p><div class="section-label">LISTEN & LEARN</div><label class="setting-row"><span>Pronunciation<small>Use supplied audio, or a voice on your device</small></span><input class="switch" id="soundSetting" type="checkbox" ${settings.sound?'checked':''}></label><label class="setting-row"><span>Repeat until the next word<small>Only in Explore. Examples play once.</small></span><input class="switch" id="repeatSetting" type="checkbox" ${settings.repeat?'checked':''}></label><label class="setting-row"><span>Show translations<small>Keep meanings visible on the word card</small></span><input class="switch" id="translationSetting" type="checkbox" ${settings.translation?'checked':''}></label><label class="setting-row"><span>Speaking speed</span><select class="select-small" id="rateSetting"><option value="0.65" ${settings.rate<0.75?'selected':''}>Slow</option><option value="0.82" ${settings.rate>=0.75&&settings.rate<0.95?'selected':''}>Gentle</option><option value="1" ${settings.rate>=0.95?'selected':''}>Normal</option></select></label><div class="section-label">SOUNDS OF THE GARDEN</div>${musicControls()}<label class="setting-row"><span>Water & gentle chimes</span><input class="switch" id="ambienceSetting" type="checkbox" ${settings.ambience?'checked':''}></label><div class="button-row"><button class="secondary-button" data-action="help">How to play</button><button class="secondary-button panel-primary" data-action="close">Back to the pond</button></div>`,'YOUR PREFERENCES');
  } else if (panelView==='import') {
    panel('Your words. Your pond.',`<p class="panel-description">Bring in words or whole sentences you want to practice. Up to 2,000 entries per pond.</p><div class="import-tabs"><button class="${importFormat==='lines'?'active':''}" data-action="format-lines">Paste words</button><button class="${importFormat==='json'?'active':''}" data-action="format-json">GoLingo JSON</button></div><div class="form-row"><label class="field">Learning language<select id="importLearning">${languageOptions(deck.learningLanguage)}</select></label><label class="field">Translation language<select id="importPrimary">${languageOptions(deck.primaryLanguage)}</select></label></div><label class="field" for="importText">${importFormat==='lines'?'One entry per line: word | translation':'Paste your GoLingo words or sentences'}</label><textarea id="importText" spellcheck="false" placeholder="${importFormat==='lines'?'水 | water\n魚 | fish\n花 | flower':'{&quot;primaryLanguage&quot;:&quot;en&quot;,&quot;learningLanguage&quot;:&quot;ja&quot;,&quot;words&quot;:[{&quot;word&quot;:&quot;水&quot;,&quot;translation&quot;:&quot;water&quot;}]}' }"></textarea><label class="file-label">${icons.upload} Or choose a .json / .txt file<input id="importFile" type="file" accept=".json,.txt,text/plain,application/json"></label><p class="panel-note">${importFormat==='lines'?'Optional: word | translation | example sentence | example translation.':'JSON language fields take priority. Audio URLs and example sentences are supported.'}</p><div id="importError" class="error-text" role="alert"></div><div class="button-row"><button class="secondary-button" data-action="words">Cancel</button><button class="secondary-button panel-primary" data-action="load-words">Bring words to life ${icons.arrow}</button></div>`,'MAKE IT PERSONAL');
  } else if (panelView==='export') {
    exportValue=JSON.stringify(exportBasket(),null,2);
    panel('Take your words with you',`<p class="panel-description">Your collected words and example sentences, ready to import into GoLingo.</p><textarea class="export-text" id="exportText" readonly aria-label="Exported GoLingo JSON">${esc(exportValue)}</textarea><div class="button-row"><button class="secondary-button" data-action="copy-export">Copy JSON</button><button class="secondary-button panel-primary" data-action="download-export">${icons.download} Download JSON</button></div><p class="panel-note">If your in-app browser does not download files, copy the JSON above.</p>`,'YOUR WORD BASKET');
  } else if (panelView==='help') {
    panel('A little time in the pond',`<p class="panel-description">A calm language game from GoLingo. There is no score to chase and no time to run out.</p><ol class="help-steps"><li><strong>Guide your koi.</strong> Tap a pearl, tap the water, or hold and drag. Your koi follows you.</li><li><strong>Discover a word.</strong> Swim close to a pearl to collect it. Listen to its pronunciation and see the meaning.</li><li><strong>Make it stick.</strong> Repeat a word, hear an example, or switch to Practice and swim to the matching meaning.</li><li><strong>Watch your garden grow.</strong> Find 4 words for Sanke, 8 for Golden Ogon, and 12 for a river dragon.</li></ol><p class="panel-note">Use Find a word whenever you want a gentle guide. Add your own lesson in Words → Add my words. Pronunciation depends on available device voices or supplied audio.</p><p class="keyboard-tip">On a keyboard: arrows or WASD to swim; Escape closes a panel.</p><div class="button-row"><button class="secondary-button panel-primary" data-action="close">${started?'Keep swimming':'I’m ready'}</button></div>`,'WELCOME TO KOI GARDEN');
  }
}
function koiPreview(kind) {
  const gold=kind==='ogon'||kind==='dragon'; const base=gold?'#d8b758':'#eeeee0';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 90" aria-hidden="true"><defs><linearGradient id="koi-${kind}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${gold?'#f6df8a':'#fffdf3'}"/><stop offset=".5" stop-color="${base}"/><stop offset="1" stop-color="${gold?'#ba9248':'#bdc5b4'}"/></linearGradient><clipPath id="body-${kind}"><path d="M140 45C130 18 85 20 50 39L30 45l20 6c35 19 80 21 90-6Z"/></clipPath></defs><path d="M49 43C30 24 20 30 14 22l5 23-5 23c14-8 18-8 35-21" fill="${base}" opacity=".7"/><path d="M104 30Q89 5 75 13l4 24m25 23Q89 85 75 77l4-24" fill="${base}" opacity=".55"/><path d="M140 45C130 18 85 20 50 39L30 45l20 6c35 19 80 21 90-6Z" fill="url(#koi-${kind})"/><g clip-path="url(#body-${kind})">${gold?'<path d="M54 42q34-13 67-6" stroke="#fff0ab" stroke-width="2" fill="none"/>':'<path d="M119 23q15 19-1 31l-12-15-14-2 7-18M69 26q22 15 9 27l-20 7 6-19Z" fill="#c66946"/>'}${kind==='sanke'?'<path d="m78 26 12 9-9 12-10-4m42 9-8 10-14-7 10-8" fill="#3e5045"/>':''}<path d="M50 45h78" stroke="#ffffeb" opacity=".3" stroke-width="2"/></g><circle cx="130" cy="37" r="2.2" fill="#334c44"/><circle cx="130" cy="53" r="2.2" fill="#334c44"/><path d="m139 43 6-4m-6 8 6 4" stroke="#abb69a" fill="none"/>${kind==='dragon'?'<path d="m119 31-7-14-8 2m15 40-7 14-8-2M57 38 49 24 36 20m21 32L49 66l-13 4" stroke="#cba35b" stroke-width="2" fill="none"/>':''}</svg>`;
}
function exportBasket() { return {primaryLanguage:deck.primaryLanguage,learningLanguage:deck.learningLanguage,words:deck.words.filter(w=>Object.hasOwn(progress.words,w.id)).map(w=>({...w}))}; }

$('startBtn').addEventListener('click',startGame);
$('welcomeLanguage').addEventListener('change',e=>{setDeck(makeDefaultDeck(e.target.value,deck.primaryLanguage),false);});
$('languageBtn').addEventListener('click',()=>openPanel('settings'));
$('settingsBtn').addEventListener('click',()=>openPanel('settings'));
$('basketBtn').addEventListener('click',()=>openPanel('words'));
$('koiBtn').addEventListener('click',()=>openPanel('koi'));
$('gardenBtn').addEventListener('click',()=>openPanel('garden'));
$('homeBtn').addEventListener('click',e=>{e.preventDefault();openPanel('help');});
$('soundBtn').addEventListener('click',toggleAudio);
$('musicBtn').addEventListener('click',toggleMusic);
$('pauseBtn').addEventListener('click',()=>pauseGame());
$('resumeBtn').addEventListener('click',()=>{speaker.unlock();pauseGame(false);});
$('exploreBtn').addEventListener('click',()=>setMode('explore'));
$('practiceBtn').addEventListener('click',()=>setMode('practice'));
$('guideBtn').addEventListener('click',()=>{
  if (challengeBusy) return;
  speaker.unlock();
  const item=mode==='practice'?targetItem:activeItems.find(w=>!Object.hasOwn(progress.words,w.id))||activeItems[0];
  if (!item) return;
  if (mode==='practice') assisted=true;
  pond.guideTo(item.id);
  $('instruction').hidden=true;
});
$('listenBtn').addEventListener('click',()=>{if(currentItem)playExplicit(currentItem,{repeat:settings.repeat});});
$('practiceListen').addEventListener('click',()=>{if(targetItem)playExplicit(targetItem);});
$('sentenceBtn').addEventListener('click',()=>{if(!currentItem?.sentence)return; const show=$('sentenceBlock').hidden;$('sentenceBlock').hidden=!show;$('sentenceBtn').classList.toggle('selected',show);if(show)playExplicit(currentItem,{sentence:true,repeat:false});updateSafeArea();});
$('repeatBtn').addEventListener('click',()=>{settings.repeat=!settings.repeat;speaker.setRepeat(settings.repeat);updateToggles();saveSettings();});
$('translationBtn').addEventListener('click',()=>{settings.translation=!settings.translation;$('translation').hidden=!settings.translation;$('sentenceTranslation').hidden=!settings.translation;updateToggles();saveSettings();updateSafeArea();});
$('closePanel').addEventListener('click',closePanel);
$('panel').addEventListener('close',()=>{speaker.stop();setSuspended();});
$('panel').addEventListener('click',e=>{if(e.target===$('panel')){const r=$('panel').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closePanel();}});
$('panelContent').addEventListener('click',async e=>{
  const button=e.target.closest('[data-action]');if(!button||button.disabled)return;
  const action=button.dataset.action;
  if (['words','allWords','koi','garden','settings','import','export','help'].includes(action)) {openPanel(action);return;}
  if(action==='close'){closePanel();return;}
  if(action==='speak-word'){const item=deck.words.find(w=>w.id===button.dataset.id);if(item)playExplicit(item);return;}
  if(action==='choose-koi'){const kind=button.dataset.koi;if(unlockCount()>=koiThreshold(kind)){settings.koi=kind;pond.setKoi(kind);saveSettings();renderPanel();toast(`${kind==='dragon'?'Your river dragon':kind==='ogon'?'Golden Ogon':kind==='sanke'?'Sanke':'Kohaku'} is ready to swim.`);}return;}
  if(action==='theme'){settings.theme=button.dataset.theme;pond.setTheme(settings.theme);music.setTheme(settings.theme);$('pondName').textContent=({jade:'THE LOTUS POND',dusk:'THE EVENING POND',moon:'THE MOONLIT POND'})[settings.theme];saveSettings();renderPanel();return;}
  if(action==='shuffle'){closePanel();if(!started)startGame();else{setMode('explore');toast('A fresh swim. New words are waiting.');}return;}
  if(action==='apply-languages'){setDeck(makeDefaultDeck($('settingLearning').value,$('settingPrimary').value));closePanel();toast(`${langInfo(deck.learningLanguage).name} words are ready in your pond.`);return;}
  if(action==='format-lines'||action==='format-json'){const old=$('importText').value,learning=$('importLearning').value,primary=$('importPrimary').value;importFormat=action==='format-lines'?'lines':'json';renderPanel();$('importText').value=old;$('importLearning').value=learning;$('importPrimary').value=primary;return;}
  if(action==='load-words'){
    try{const input=$('importText').value;if(!input.trim())throw new Error('Paste at least one word and translation to begin.');const next=normalizePayload(input,{learningLanguage:$('importLearning').value,primaryLanguage:$('importPrimary').value});setDeck(next,true);closePanel();if(!started)startGame();toast(`${deck.words.length} ${deck.words.length===1?'word is':'words are'} waiting in your pond.`);}catch(err){$('importError').textContent=err.message||'Please check your words and try again.';}return;
  }
  if(action==='copy-export'){
    try{await navigator.clipboard.writeText(exportValue);button.textContent='Copied';}catch{$('exportText').focus();$('exportText').select();toast('Your JSON is selected. Use Copy to keep it.');}return;
  }
  if(action==='download-export'){
    const url=URL.createObjectURL(new Blob([exportValue],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='golingo-koi-words.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('Your word basket is ready. If needed, use Copy JSON.');
  }
});
$('panelContent').addEventListener('input',e=>{
  if (e.target.id!=='musicVolume') return;
  settings.musicVolume=Math.max(0,Math.min(1,Number(e.target.value)/100));
  music.setVolume(settings.musicVolume);
  $('musicVolumeValue').textContent=`${Math.round(settings.musicVolume*100)}%`;
  updateMusicButton();
});
$('panelContent').addEventListener('change',async e=>{
  const el=e.target;
  if(el.id==='importFile'){
    const file=el.files?.[0];if(!file)return;
    if(file.size>2_000_000){$('importError').textContent='Please choose a file smaller than 2 MB.';return;}
    try{$('importText').value=await file.text();$('importError').textContent='';}catch{$('importError').textContent='This file could not be read. Try pasting the text instead.';}return;
  }
  if(el.id==='musicSetting'){settings.music=el.checked;if(settings.music)unlockMusic();syncMusic();}
  if(el.id==='soundSetting'){settings.sound=el.checked;speaker.setEnabled(settings.sound);updateAudioButton();}
  if(el.id==='repeatSetting'){settings.repeat=el.checked;speaker.setRepeat(settings.repeat);updateToggles();}
  if(el.id==='translationSetting'){settings.translation=el.checked;$('translation').hidden=!settings.translation;$('sentenceTranslation').hidden=!settings.translation;updateToggles();}
  if(el.id==='ambienceSetting'){settings.ambience=el.checked;ambience.unlock();setSuspended();}
  if(el.id==='rateSetting'){settings.rate=Number(el.value);speaker.setRate(settings.rate);}
  saveSettings();updateSafeArea();
});
document.addEventListener('visibilitychange',setSuspended);
window.addEventListener('resize',()=>{updateSafeArea();});
window.addEventListener('pagehide',()=>{speaker.stop();ambience.setEnabled(false);music.setEnabled(false);persistProgress();});
window.addEventListener('pageshow',setSuspended);

// Public GoLingo bridge: call GoLingo.load(payload) after this page is ready.
function receivePayload(payload) { const normalized=normalizePayload(payload,{learningLanguage:deck.learningLanguage,primaryLanguage:deck.primaryLanguage});setDeck(normalized,true);toast(`${normalized.words.length} words received from GoLingo.`);return {ok:true,count:normalized.words.length,primaryLanguage:normalized.primaryLanguage,learningLanguage:normalized.learningLanguage}; }
window.GoLingo=Object.freeze({load:receivePayload,exportBasket,getDeck:()=>structuredClone(deck),version:'1.1.1'});
window.loadGoLingoData=receivePayload;
window.setGoLingoData=receivePayload;
window.addEventListener('golingo:data',event=>{try{receivePayload(event.detail);}catch(error){toast(`Could not load these words: ${error.message}`,5000);}});
window.addEventListener('message',event=>{
  let message=event.data;
  if(typeof message==='string'){try{message=JSON.parse(message);}catch{return;}}
  if(!message||!['golingo:data','golingo','GoLingoData','GOLINGO_DATA'].includes(message.type))return;
  try{receivePayload(message.payload??message.data??message);}catch(error){toast(`Could not load these words: ${error.message}`,5000);}
});
function readURLData() {
  const search=new URLSearchParams(location.search),hash=new URLSearchParams(location.hash.replace(/^#/,''));
  const raw=hash.get('golingoLesson')||search.get('golingoLesson')||search.get('lesson')||search.get('data')||search.get('payload')||search.get('golingo')||hash.get('data')||hash.get('golingo');
  if(!raw)return;
  try{let payload=raw;if(!/^\s*[\[{]/.test(raw)){const encoded=raw.replace(/-/g,'+').replace(/_/g,'/');const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));payload=new TextDecoder().decode(bytes);}receivePayload(payload);}catch(error){toast(`The link’s word set could not load: ${error.message}`,6000);}
}
readURLData();
$('pondName').textContent=({jade:'THE LOTUS POND',dusk:'THE EVENING POND',moon:'THE MOONLIT POND'})[settings.theme];
document.dispatchEvent(new CustomEvent('golingo:ready',{detail:{version:'1.1.1'}}));
