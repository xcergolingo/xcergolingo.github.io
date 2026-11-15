// Execute the real gallery with a parsed DOM, without network or browser processes.
// Dependency: npm install --prefix /tmp/golingo-gallery-dom-tests linkedom --ignore-scripts
// Run: GALLERY_TEST_DEPENDENCIES=/tmp/golingo-gallery-dom-tests node --test games/tests/gallery.test.mjs
// This validates behavior, not browser rendering. See gallery.browser.test.mjs for UI checks.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve, join} from 'node:path';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const dependencyRequire = process.env.GALLERY_TEST_DEPENDENCIES
  ? createRequire(join(resolve(process.env.GALLERY_TEST_DEPENDENCIES), 'package.json')) : require;
const {parseHTML} = dependencyRequire('linkedom');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const javascript = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const keys = {
  likes: 'golingo:liked-games:v1', favorites: 'golingo:favorite-games:v1',
  plays: 'golingo:game-plays:v1', view: 'golingo:gallery-view:v1'
};
const lesson = {
  primaryLanguage: 'en', learningLanguage: 'ja',
  words: [{id: '101', word: '水', translation: 'water', sentence: '水を飲みます。', sentenceTranslation: 'I drink water.', audioURL: 'https://example.invalid/water.mp3'}],
  sentences: [{id: '201', text: '空は青い。', translation: 'The sky is blue.'}]
};
function storage(initial = {}) {
  const data = new Map(Object.entries(initial).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]));
  return {data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key)};
}
function createHub({local = storage(), session = storage(), blockedLocal = false, failedWrites = false, blockedSession = false} = {}) {
  const {window, document} = parseHTML(html);
  const location = new URL('https://xcergolingo.github.io/games/');
  let clock = 2000000000000;
  class ClockDate extends Date { static now() { return clock; } }
  Object.defineProperty(document, 'activeElement', {value: null, writable: true, configurable: true});
  for (const node of document.querySelectorAll('button, input, select, a, textarea')) {
    node.focus = () => { document.activeElement = node; };
  }
  for (const anchor of document.querySelectorAll('a')) Object.defineProperty(anchor, 'href', {
    get() { return new URL(this.getAttribute('href') || '', location).href; },
    set(value) { this.setAttribute('href', String(value)); }, configurable: true
  });
  for (const select of document.querySelectorAll('select')) {
    let value = select.querySelector('option')?.value || '';
    Object.defineProperty(select, 'value', {get: () => value, set: next => { value = String(next); }, configurable: true});
  }
  for (const media of document.querySelectorAll('video')) {
    media.paused = true;
    media.pause = () => { media.paused = true; };
    media.play = () => { media.paused = false; return Promise.resolve(); };
    media.load = () => {};
  }
  const dialog = document.getElementById('preview-dialog');
  dialog.open = false;
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.dispatchEvent(new window.Event('close')); };
  window.matchMedia = () => ({matches: true, addEventListener() {}});
  const scope = {document, window, location, URL, URLSearchParams, Date: ClockDate,
    navigator: {}, history: {replaceState() {}}, fetch: () => Promise.resolve({ok: false}),
    localStorage: local, sessionStorage: session};
  if (blockedLocal) Object.defineProperty(scope, 'localStorage', {get() { throw Error('Storage blocked'); }});
  else if (failedWrites) scope.localStorage = {...local, setItem() { throw Error('Quota exceeded'); }};
  if (blockedSession) Object.defineProperty(scope, 'sessionStorage', {get() { throw Error('Session storage blocked'); }});
  vm.runInNewContext(javascript, scope, {filename: 'games/app.js'});
  const node = selector => { const result = document.querySelector(selector); assert(result, 'Missing element: ' + selector); return result; };
  const dispatch = (selector, type, properties = {}) => {
    const event = new window.Event(type, {bubbles: true, cancelable: true});
    Object.assign(event, {button: 0}, properties);
    node(selector).dispatchEvent(event);
    return event;
  };
  return {document, window, local, session, node, dispatch,
    click: (selector, properties) => dispatch(selector, 'click', properties),
    input: value => { node('#game-search').value = value; dispatch('#game-search', 'input'); },
    sort: value => { node('#game-sort').value = value; dispatch('#game-sort', 'change'); },
    visible: () => [...document.querySelectorAll('.game-card')].filter(card => !card.hidden).map(card => card.id),
    ids: () => [...document.querySelectorAll('.game-card')].map(card => card.id),
    count: id => Number(node('#' + id + ' .game-plays').textContent.replace(/[^\d]/g, '')),
    tick: (milliseconds = 2000) => { clock += milliseconds; },
    event: (type, properties = {}) => { const event = new window.Event(type); Object.assign(event, properties); window.dispatchEvent(event); }
  };
}

test('Real card collection is preserved and controls are created once', () => {
  const h = createHub();
  const sourceIDs = [...html.matchAll(/<article class="game-card" id="([^"]+)"/g)].map(match => match[1]);
  assert(sourceIDs.length > 0);
  assert.deepEqual(h.ids(), sourceIDs);
  assert.equal(new Set(h.ids()).size, sourceIDs.length);
  assert.equal(h.document.querySelectorAll('.game-favorite').length, sourceIDs.length);
  assert.equal(h.document.querySelectorAll('.game-like').length, sourceIDs.length);
  assert.equal(h.document.querySelectorAll('.game-plays').length, sourceIDs.length);
  assert.equal(h.node('#hub-count').textContent, sourceIDs.length + ' games');
  assert(h.ids().every(id => h.count(id) === 0));
});

test('Search matches titles, descriptions and tags; case, accents and whitespace are normalized', () => {
  const h = createHub();
  h.input('SÁKURAGAOKA'); assert.deepEqual(h.visible(), ['sakuragaoka']);
  h.input('  MATTERHÓRN   finish  '); assert.deepEqual(h.visible(), ['matterhorn']);
  h.input('teacher classroom'); assert(h.visible().includes('panda-lingo'));
  h.input('moonlit snow'); assert(h.visible().includes('snow-kings'));
  h.input('not-a-real-game-854693'); assert.deepEqual(h.visible(), []);
  assert.equal(h.node('#hub-empty').hidden, false);
  assert.match(h.node('#hub-count').textContent, /^0 of /);
  h.click('#search-clear'); assert.equal(h.node('#game-search').value, '');
  assert.equal(h.visible().length, h.ids().length);
  h.input('ski'); h.dispatch('#game-search', 'keydown', {key: 'Escape'});
  assert.equal(h.node('#game-search').value, '');
});

test('Category, favorite and search filters compose, with useful empty/reset behavior', () => {
  const h = createHub();
  h.click('#favorites-toggle'); assert.deepEqual(h.visible(), []);
  assert.equal(h.node('#hub-empty-title').textContent, 'No favorites yet');
  h.click('#favorites-toggle');
  h.click('#matterhorn .game-favorite'); h.click('#lagoon .game-favorite');
  assert.equal(h.node('#favorites-count').textContent, '2');
  assert.equal(h.node('#matterhorn .game-like').getAttribute('aria-pressed'), 'false');
  h.click('#favorites-toggle'); assert.deepEqual(h.visible().sort(), ['lagoon', 'matterhorn']);
  h.click('[data-filter="sports"]'); assert.deepEqual(h.visible(), ['matterhorn']);
  h.input('ski'); assert.deepEqual(h.visible(), ['matterhorn']);
  h.input('tropical'); assert.deepEqual(h.visible(), []);
  assert.equal(h.node('#hub-empty-title').textContent, 'No games found');
  h.click('#search-clear');
  h.click('#matterhorn .game-favorite'); assert.deepEqual(h.visible(), []);
  assert.equal(h.node('#favorites-count').textContent, '1');
  h.click('#filters-reset'); assert.equal(h.visible().length, h.ids().length);
  assert.equal(h.node('#lagoon .game-favorite').getAttribute('aria-pressed'), 'true');
});

test('Favorites, likes and view preferences persist independently', () => {
  const h = createHub();
  h.click('#lagoon .game-like'); h.click('#matterhorn .game-favorite');
  h.click('#favorites-toggle'); h.click('[data-filter="sports"]'); h.input('ski'); h.sort('plays');
  const next = createHub({local: h.local, session: h.session});
  assert.equal(next.node('#lagoon .game-like').getAttribute('aria-pressed'), 'true');
  assert.equal(next.node('#lagoon .game-favorite').getAttribute('aria-pressed'), 'false');
  assert.equal(next.node('#matterhorn .game-favorite').getAttribute('aria-pressed'), 'true');
  assert.equal(next.node('#game-search').value, 'ski');
  assert.equal(next.node('#game-sort').value, 'plays');
  assert.equal(next.node('#favorites-toggle').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(next.visible(), ['matterhorn']);
  assert.equal(next.count('matterhorn'), 0);
});

test('All launch paths count; preview, download, like, favorite and reload do not', () => {
  const h = createHub();
  h.click('#lagoon .game-like'); h.click('#lagoon .game-favorite');
  h.click('#lagoon .download-link'); h.click('#lagoon [data-preview]');
  assert.equal(h.count('lagoon'), 0);
  h.click('#dialog-demo'); assert.equal(h.count('lagoon'), 1);
  h.click('#sakuragaoka a.game-cover'); assert.equal(h.count('sakuragaoka'), 1);
  h.click('#matterhorn .demo-link'); assert.equal(h.count('matterhorn'), 1);
  const next = createHub({local: h.local, session: h.session});
  assert.equal(next.count('matterhorn'), 1);
  assert.equal(next.count('lagoon'), 1);
  assert.equal(next.count('sakuragaoka'), 1);
});

test('Rapid duplicate taps are deduplicated; keyboard/modifier/middle clicks work; cancelled/right clicks do not count', () => {
  const h = createHub();
  h.click('#matterhorn .demo-link'); h.click('#matterhorn a.game-cover');
  assert.equal(h.count('matterhorn'), 1);
  h.tick(); h.click('#matterhorn .demo-link', {detail: 0}); assert.equal(h.count('matterhorn'), 2);
  h.tick(); h.click('#matterhorn .demo-link', {ctrlKey: true}); assert.equal(h.count('matterhorn'), 3);
  h.tick(); h.dispatch('#matterhorn .demo-link', 'auxclick', {button: 1}); assert.equal(h.count('matterhorn'), 4);
  h.tick(); h.click('#matterhorn .demo-link', {button: 2}); assert.equal(h.count('matterhorn'), 4);
  const cancelled = new h.window.Event('click', {bubbles: true, cancelable: true});
  cancelled.button = 0; cancelled.preventDefault(); h.node('#skybreaker .demo-link').dispatchEvent(cancelled);
  assert.equal(h.count('skybreaker'), 0);
});

test('Lesson data and original IDs survive every handoff format and preview-dialog launches', () => {
  const h = createHub();
  h.node('#lesson-input').value = JSON.stringify(lesson); h.click('#lesson-save');
  for (const [selector, transferKey] of [
    ['#matterhorn .demo-link', 'golingoLesson'], ['#sakuragaoka a.game-cover', 'golingo'], ['#panda-lingo .demo-link', 'data']
  ]) {
    h.click(selector);
    const url = new URL(h.node(selector).href);
    const payload = JSON.parse(new URLSearchParams(url.hash.slice(1)).get(transferKey));
    assert.deepEqual(payload.words[0], lesson.words[0]);
    if (transferKey === 'golingoLesson') assert.deepEqual(payload, lesson);
    else { assert.equal(payload.words[1].id, '201'); assert.equal(payload.words[1].word, lesson.sentences[0].text); }
    assert.equal(h.node(selector).target, '_self');
  }
  h.click('#lagoon [data-preview]'); h.click('#dialog-demo');
  const preview = JSON.parse(new URLSearchParams(new URL(h.node('#dialog-demo').href).hash.slice(1)).get('golingoLesson'));
  assert.deepEqual(preview, lesson);
  h.click('#lesson-clear'); h.tick();
  h.click('#matterhorn .demo-link'); assert.equal(new URL(h.node('#matterhorn .demo-link').href).hash, '');
  h.click('#dialog-demo'); assert.equal(new URL(h.node('#dialog-demo').href).hash, '');
});

test('Sort modes use counts/timestamps, preserve deterministic ties and restore original order', () => {
  const h = createHub({local: storage({
    [keys.plays]: {lagoon: {count: 12, lastPlayed: 100}, matterhorn: {count: 12, lastPlayed: 200}, skybreaker: {count: 4, lastPlayed: 300}},
    [keys.likes]: {'word-folio': true}
  })});
  const original = h.ids();
  h.sort('plays'); assert.deepEqual(h.ids().slice(0, 2), original.filter(id => ['lagoon', 'matterhorn'].includes(id)));
  assert.equal(h.ids()[2], 'skybreaker');
  h.sort('recent'); assert.deepEqual(h.ids().slice(0, 3), ['skybreaker', 'matterhorn', 'lagoon']);
  h.sort('likes'); assert.equal(h.ids()[0], 'word-folio');
  const nameOrder = [...h.document.querySelectorAll('.game-card')].sort((a, b) => a.querySelector('h3').textContent.trim().localeCompare(b.querySelector('h3').textContent.trim())).map(card => card.id);
  h.sort('name'); assert.deepEqual(h.ids(), nameOrder);
  h.sort('default'); assert.deepEqual(h.ids(), original);
});

test('Malformed JSON, arrays, unsafe/negative/nonfinite counts and prototype keys are ignored', () => {
  const h = createHub({local: storage({
    [keys.likes]: '[]',
    [keys.favorites]: '{"__proto__":{"polluted":true},"lagoon":"yes","matterhorn":true}',
    [keys.plays]: '{"lagoon":{"count":-20,"lastPlayed":"today"},"matterhorn":{"count":3,"lastPlayed":123},"skybreaker":{"count":1e309,"lastPlayed":0},"sakuragaoka":{"count":99999999999999999999999999,"lastPlayed":0}}'
  }), session: storage({[keys.view]: '{broken JSON'})});
  assert.equal(h.count('lagoon'), 0); assert.equal(h.count('matterhorn'), 3);
  assert.equal(h.count('skybreaker'), 0); assert.equal(h.count('sakuragaoka'), 0);
  assert.equal(h.node('#lagoon .game-favorite').getAttribute('aria-pressed'), 'false');
  assert.equal(h.node('#matterhorn .game-favorite').getAttribute('aria-pressed'), 'true');
  assert.equal(({}).polluted, undefined);
  h.local.setItem(keys.plays, 'false'); h.local.setItem(keys.favorites, '{not JSON');
  const next = createHub({local: h.local});
  assert.equal(next.count('matterhorn'), 0);
  assert.equal(next.node('#matterhorn .game-favorite').getAttribute('aria-pressed'), 'false');
});

test('Unavailable storage and quota failures retain functional in-memory controls', () => {
  for (const options of [{blockedLocal: true}, {failedWrites: true}, {blockedLocal: true, blockedSession: true}]) {
    const h = createHub(options);
    h.click('#matterhorn .game-favorite'); h.click('#favorites-toggle');
    assert.deepEqual(h.visible(), ['matterhorn']);
    h.click('#matterhorn .demo-link'); assert.equal(h.count('matterhorn'), 1);
    h.event('pageshow'); assert.equal(h.count('matterhorn'), 1);
    assert.equal(h.node('#matterhorn .game-favorite').getAttribute('aria-pressed'), 'true');
    assert.match(h.node('#hub-storage-status').textContent, /storage is unavailable/i);
    h.input('ski'); assert.deepEqual(h.visible(), ['matterhorn']);
  }
});

test('Storage events and pageshow refresh counts, favorites and sorted order', () => {
  const h = createHub();
  h.sort('plays');
  h.local.setItem(keys.plays, JSON.stringify({lagoon: {count: 6, lastPlayed: 500}}));
  h.event('pageshow', {persisted: true});
  assert.equal(h.count('lagoon'), 6); assert.equal(h.ids()[0], 'lagoon');
  h.local.setItem(keys.favorites, JSON.stringify({matterhorn: true}));
  h.event('storage', {key: keys.favorites});
  assert.equal(h.node('#matterhorn .game-favorite').getAttribute('aria-pressed'), 'true');
  h.click('#favorites-toggle'); assert.deepEqual(h.visible(), ['matterhorn']);
});

test('Aonami launches from Fishing and Language Learning with a GoLingo lesson payload', () => {
  const h = createHub();
  const card = h.node('#aonami-fishing');
  assert.match(card.dataset.tags, /fishing/);
  assert.match(card.dataset.tags, /language-learning/);
  const link = h.node('#aonami-fishing a.game-cover');
  assert.equal(link.getAttribute('href'), 'aonami-fishing/');
  assert.equal(link.dataset.lessonKey, 'data');
  assert.equal(link.dataset.lessonFormat, 'word-pack');
  h.input('aonami'); assert.deepEqual(h.visible(), ['aonami-fishing']);
  h.click('#aonami-fishing .demo-link');
  assert.equal(h.count('aonami-fishing'), 1);
});

test('Aonami public game includes the complete embedded Japanese voice pack and source download', async () => {
  const game = await readFile(new URL('../aonami-fishing/index.html', import.meta.url), 'utf8');
  const download = await readFile(new URL('../aonami-fishing/aonami-fishing.html', import.meta.url), 'utf8');
  assert.equal(game, download);
  assert.equal((game.match(/data:audio\/mpeg;base64,/g) || []).length, 30);
  assert.match(game, /id="voice-test"/);
  assert.match(game, /id="action"/);
  assert.match(game, /id="catch-translation"/);
});
