import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const L = require('../learning.js');

for (const code of ['es', 'ja', 'fr', 'zh', 'de', 'ko']) {
  const pack = L.defaultPack(code);
  assert.equal(pack.learningLanguage, code);
  assert.equal(pack.words.length, 20);
  assert.equal(new Set(pack.words.map(word => word.id)).size, 20);
  assert.ok(pack.words.every(word => word.word && word.translation && word.sentence && word.sentenceTranslation));
  const copy = L.defaultPack(code);
  pack.words[0].word = 'changed';
  assert.notEqual(copy.words[0].word, pack.words[0].word);
}
assert.ok(L.languages.length >= 28);
assert.throws(() => L.defaultPack('vi'), /import your own/);
assert.equal(L.defaultPack('es-MX').learningLanguage, 'es-MX');

const original = {
  primaryLanguage: 'en', learningLanguage: 'ja', words: [
    { id: '101', word: '水', translation: 'water', sentence: '水を飲みます。', sentenceTranslation: 'I drink water.', audioURL: 'https://example.com/water.mp3' },
    { id: '102', word: '船', translation: 'boat', sentence: '船に乗ります。', sentenceTranslation: 'I ride the boat.' }
  ]
};
assert.deepEqual(L.exportPayload(L.normalizePayload(JSON.stringify(original))), original);
const wrapped = L.normalizePayload({ primaryLanguage: 'zh', learningLanguage: 'ja', data: { payload: original.words } });
assert.equal(wrapped.primaryLanguage, 'zh');
assert.equal(wrapped.learningLanguage, 'ja');
assert.equal(wrapped.words[0].word, '水');

// The public gallery uses translationLanguage and forwards wrapped lessons intact.
const translated = L.normalizePayload({ translationLanguage: 'zh', learningLanguage: 'ja', words: original.words });
assert.equal(translated.primaryLanguage, 'zh');
assert.equal(translated.learningLanguage, 'ja');
assert.equal(L.normalizePayload(original.words, { translationLanguage: 'ko' }).primaryLanguage, 'ko');
assert.equal(L.normalizePayload(original.words, { primaryLanguage: 'fr', translationLanguage: 'ko' }).primaryLanguage, 'fr');
assert.equal(L.normalizePayload({ primaryLanguage: 'de', translationLanguage: 'zh', words: original.words }).primaryLanguage, 'de');
assert.equal(L.normalizePayload({ translationLanguage: 'zh', words: original.words }, { primaryLanguage: 'en' }).primaryLanguage, 'zh');
for (const key of ['data', 'payload', 'content']) {
  const lesson = L.normalizePayload({ translationLanguage: 'zh', learningLanguage: 'ja', [key]: original.words });
  assert.equal(lesson.primaryLanguage, 'zh');
  assert.equal(lesson.learningLanguage, 'ja');
}
const wrappedAlias = L.normalizePayload({ translationLanguage: 'zh', data: { translationLanguage: 'fr', content: { words: original.words } } });
assert.equal(wrappedAlias.primaryLanguage, 'fr');
assert.equal(L.normalizePayload({ primaryLanguage: 'de', data: { translationLanguage: 'zh', words: original.words } }).primaryLanguage, 'de');
assert.equal(L.normalizePayload({ translationLanguage: 'zh', data: { primaryLanguage: 'de', words: original.words } }).primaryLanguage, 'de');

const sentencePack = L.normalizePayload({ learningLanguage: 'fr', sentences: [{ text: 'Je voudrais de l’eau.', translation: 'I would like some water.' }] });
assert.equal(sentencePack.words[0].word, 'Je voudrais de l’eau.');
assert.equal(sentencePack.words[0].sentenceTranslation, 'I would like some water.');
assert.equal(sentencePack.words[0].kind, 'sentence');
const sentenceAudioPack = L.normalizePayload({ learningLanguage: 'fr', sentences: [{ text: 'Je voudrais de l’eau.', translation: 'I would like some water.', audioURL: 'https://example.com/sentence.mp3' }] });
assert.equal(L.shipPhrase(sentenceAudioPack, 0).audioURL, 'https://example.com/sentence.mp3');
const wordAudioPack = L.normalizePayload({ words: [{ word: 'eau', translation: 'water', sentence: 'Je bois de l’eau.', sentenceTranslation: 'I drink water.', audioURL: 'https://example.com/word.mp3' }] });
assert.equal(L.shipPhrase(wordAudioPack, 0).audioURL, '');
sentenceAudioPack.words[0].sentenceAudioURL = 'https://example.com/preferred-sentence.mp3';
assert.equal(L.shipPhrase(sentenceAudioPack, 0).audioURL, 'https://example.com/preferred-sentence.mp3');
const combined = L.normalizePayload({ words: original.words, sentences: [{ sentence: 'こんにちは。', sentenceTranslation: 'Hello.' }] });
assert.equal(combined.words.length, 3);
assert.equal(combined.words[0].kind, undefined);
assert.equal(combined.words[0].sentence, original.words[0].sentence);
assert.equal(combined.words[2].kind, 'sentence');
assert.equal(combined.words[2].sentence, 'こんにちは。');

// Phrases stay whole; generic item collections retain word and sentence semantics.
const phrases = L.normalizePayload({ translationLanguage: 'zh', learningLanguage: 'ja', phrases: [
  { phrase: 'おはようございます。', phraseTranslation: '早上好。', audioURL: 'https://example.com/greeting.mp3' },
  { text: 'ありがとうございます。', translation: '谢谢。' },
  'こんばんは。 | 晚上好。'
] });
assert.equal(phrases.primaryLanguage, 'zh');
assert.equal(phrases.words.length, 3);
assert.ok(phrases.words.every(item => item.kind === 'sentence' && item.sentence === item.word && item.sentenceTranslation === item.translation));
assert.equal(phrases.words[0].word, 'おはようございます。');
assert.equal(L.shipPhrase(phrases, 0).audioURL, 'https://example.com/greeting.mp3');
for (const key of ['items', 'entries']) {
  const mixed = L.normalizePayload({ [key]: [
    original.words[0],
    { sentence: '船に乗ります。', sentenceTranslation: 'I ride the boat.', audioURL: 'https://example.com/boat.mp3' },
    { kind: 'sentence', text: 'こんにちは。', translation: 'Hello.' }
  ] });
  assert.equal(mixed.words.length, 3);
  assert.equal(mixed.words[0].kind, undefined);
  assert.equal(mixed.words[0].word, '水');
  assert.equal(mixed.words[0].sentence, original.words[0].sentence);
  assert.equal(mixed.words[1].kind, 'sentence');
  assert.equal(mixed.words[1].word, '船に乗ります。');
  assert.equal(mixed.words[1].audioURL, 'https://example.com/boat.mp3');
  assert.equal(mixed.words[2].kind, 'sentence');
}
const aliasDuplicates = L.normalizePayload({
  words: [original.words[0]],
  sentences: [{ id: 'greeting', sentence: 'こんにちは。', sentenceTranslation: 'Hello.' }],
  phrases: [{ phrase: 'こんにちは。', phraseTranslation: 'Hello.' }],
  items: [{ ...original.words[0], id: 'alias-copy' }],
  entries: [{ id: '101', word: '空', translation: 'sky' }]
});
assert.deepEqual(aliasDuplicates.words.map(item => item.word), ['水', 'こんにちは。', '空']);
assert.equal(aliasDuplicates.words[0].id, '101');
assert.equal(aliasDuplicates.words[0].sentence, original.words[0].sentence);
assert.equal(aliasDuplicates.words[1].kind, 'sentence');
assert.equal(new Set(aliasDuplicates.words.map(item => item.id)).size, 3);
assert.equal(L.normalizePayload({ words: [], entries: original.words }).words.length, 2);
for (const key of ['phrases', 'items', 'entries']) {
  assert.throws(() => L.normalizePayload({ [key]: [] }), /empty/);
  assert.throws(() => L.normalizePayload({ [key]: new Array(1001).fill(original.words[0]) }), /no more than 1000/);
}
assert.throws(() => L.normalizePayload({ words: new Array(600).fill(original.words[0]), entries: new Array(401).fill(original.words[0]) }), /no more than 1000/);
assert.equal(L.normalizePayload({ entries: Array.from({ length: 1000 }, (_, index) => ({ word: 'entry ' + index, translation: 'meaning ' + index })) }).words.length, 1000);

const manual = L.normalizePayload('船 | ship | 船は港にあります。 | The ship is in the harbor.\n水\twater\n島;island', {learningLanguage:'ja'});
assert.equal(manual.words.length, 3);
assert.equal(manual.learningLanguage, 'ja');
assert.equal(manual.words[0].sentence, '船は港にあります。');
assert.equal(L.normalizePayload([{text:'海', meaning:'sea'}, {learningText:'島', nativeText:'island'}]).words.length, 2);
assert.throws(() => L.normalizePayload('just a word'), /Line 1/);
assert.throws(() => L.normalizePayload('{bad json}'), /JSON is not valid/);
assert.throws(() => L.normalizePayload({words:[]}), /empty/);
assert.throws(() => L.normalizePayload({words:[{word:'hello'}]}), /translation/);
assert.throws(() => L.normalizePayload({words:new Array(1001).fill(original.words[0])}), /no more than 1000/);
const unsafe = L.normalizePayload([{word:'safe',translation:'safe', audioURL:'javascript:alert(1)',sentenceAudioURL:'data:text/html,hello'}]);
assert.ok(!unsafe.words[0].audioURL && !unsafe.words[0].sentenceAudioURL);
const duplicates = L.normalizePayload([{id:'x',word:'a',translation:'A'},{id:'x',word:'b',translation:'B'},{id:'x',word:'a',translation:'A'}]);
assert.equal(duplicates.words.length, 2);
assert.notEqual(duplicates.words[0].id, duplicates.words[1].id);

const pack = L.defaultPack();
const originalIds = pack.words.map(word => word.id);
const deck = L.makeDeck(pack, () => 0);
assert.notDeepEqual(deck.map(word => word.id), originalIds);
assert.deepEqual(pack.words.map(word => word.id), originalIds);
deck[0].translation = 'mutated';
assert.ok(pack.words.every(word => word.translation !== 'mutated'));
const question = L.makeQuestion(pack.words[0], pack.words.concat(pack.words), () => 0.3);
assert.equal(question.choices.length, 4);
assert.equal(question.choices.filter(choice => choice.correct).length, 1);
assert.equal(new Set(question.choices.map(choice => choice.text)).size, 4);
assert.equal(question.choices.find(choice => choice.correct).text, pack.words[0].translation);
assert.equal(L.makeQuestion(pack.words[0], [pack.words[0]]).choices.length, 1);
assert.equal(L.shipPhrase(pack, 0).sentence, pack.words[0].sentence);
assert.equal(L.shipPhrase(manual, -2).sentence, manual.words[0].sentence);
assert.equal(L.shipPhrase(unsafe, 0), null);
console.log('Learning checks passed: 6 starter packs, 32 language choices, GoLingo import/export and hub aliases, language precedence, mixed collections and limits, sentence preservation, manual input, guarded audio URLs, deck shuffle, and quiz options.');
