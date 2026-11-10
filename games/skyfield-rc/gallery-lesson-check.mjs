import assert from 'node:assert/strict';
import { LearningEngine } from './dist/learning.js';

const payload = {
  primaryLanguage: 'en',
  learningLanguage: 'ja',
  words: [
    { id: '101', word: '水', translation: 'water', sentence: '水を飲みます。', sentenceTranslation: 'I drink water.' },
    { id: '102', word: '空', translation: 'sky', sentence: '空は青い。', sentenceTranslation: 'The sky is blue.' }
  ]
};

const saved = { location: globalThis.location, window: globalThis.window, localStorage: globalThis.localStorage };
const backing = new Map();
globalThis.localStorage = { getItem: key => backing.get(key) ?? null, setItem: (key, value) => backing.set(key, value) };
globalThis.window = { addEventListener() {}, removeEventListener() {} };

try {
  const data = encodeURIComponent(JSON.stringify(payload));
  for (const url of [
    `https://xcergolingo.github.io/games/skyfield-rc/#golingoLesson=${data}`,
    `https://xcergolingo.github.io/games/skyfield-rc/#data=${data}`,
    `https://xcergolingo.github.io/games/skyfield-rc/?data=${data}`
  ]) {
    backing.clear();
    globalThis.location = new URL(url);
    const engine = new LearningEngine();
    assert.equal(engine.primaryLanguage, 'en');
    assert.equal(engine.learningLanguage, 'ja');
    assert.equal(engine.words.length, 2);
    assert.equal(engine.words[0].word, '水');
    assert.equal(engine.words[1].translation, 'sky');
    engine.destroy();
  }
  console.log('GoLingo gallery and legacy URL lesson imports passed.');
} finally {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete globalThis[name];
    else globalThis[name] = value;
  }
}
