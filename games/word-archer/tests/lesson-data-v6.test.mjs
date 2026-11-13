import assert from 'node:assert/strict';
import {
  SAMPLE_WORDS,normalizedLanguage,normalizePayload,shuffledIndexes
} from '../lesson-data-v6.js';

assert.ok(SAMPLE_WORDS.length>=20,'the demo deck contains real vocabulary');
assert.equal(normalizedLanguage('Japanese','en'),'ja');
assert.equal(normalizedLanguage('es-MX','ja'),'es-MX');

const sample={
  primaryLanguage:'en',learningLanguage:'ja',
  words:[{id:'101',word:'水',translation:'water',sentence:'水を飲みます。',sentenceTranslation:'I drink water.'}]
};
const lesson=normalizePayload(sample);
assert.equal(lesson.words[0].word,'水');
assert.equal(lesson.words[0].translation,'water');
assert.equal(lesson.words[0].sentenceTranslation,'I drink water.');
assert.equal(lesson.learningLanguage,'ja');
assert.equal(normalizePayload(JSON.stringify(sample)).words.length,1);
assert.equal(normalizePayload({type:'GOLINGO_DATA',payload:sample}).words.length,1);
assert.equal(normalizePayload({sentences:[{sentence:'Bonjour!',sentenceTranslation:'Hello!'}],learningLanguage:'fr'}).words[0].word,'Bonjour!');
assert.equal(normalizePayload([{word:'hola',meaning:'hello'}]).words[0].translation,'hello');
assert.equal(normalizePayload({words:['hello','hello','world']}).words.length,2);
assert.equal(normalizePayload({words:[]}),null);
assert.equal(normalizePayload('not JSON'),null);

const shuffle=shuffledIndexes(100,()=>0);
assert.equal(new Set(shuffle).size,100);
assert.equal(Math.min(...shuffle),0);
assert.equal(Math.max(...shuffle),99);
console.log('Word Archer v6: all lesson parsing and GoLingo payload tests passed.');
