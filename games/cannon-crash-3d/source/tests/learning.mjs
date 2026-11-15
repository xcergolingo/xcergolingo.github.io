import assert from 'node:assert/strict';
import {DEMO_DATA,LANGUAGES,normalizeGameData,makeLessonDeck,initialGameData,exportBasket,escapeHtml,voiceFor} from '../src/learning.js';

const demo=normalizeGameData(DEMO_DATA);
assert.equal(demo.primaryLanguage,'en');
assert.equal(demo.learningLanguage,'ja');
assert.ok(demo.words.length>=30);
assert.equal(LANGUAGES.length,29);
assert.equal(voiceFor('ja'),'ja-JP');

const sample={primaryLanguage:'en',learningLanguage:'ja',words:[
  {id:'101',word:'水',translation:'water',sentence:'水を飲みます。',sentenceTranslation:'I drink water.'},
  {id:'102',word:'船',translation:'boat'}
]};
const raw=normalizeGameData(JSON.stringify(sample));
assert.equal(raw.words[0].word,'水');
assert.equal(raw.words[0].sentenceTranslation,'I drink water.');
assert.equal(initialGameData('?data='+encodeURIComponent(JSON.stringify(sample)),DEMO_DATA).words.length,2);
assert.equal(initialGameData('',DEMO_DATA,'#data='+encodeURIComponent(JSON.stringify(sample))).words[0].translation,'water');
assert.equal(initialGameData('',DEMO_DATA,'#golingoLesson='+encodeURIComponent(JSON.stringify(sample))).words[1].word,'船');
assert.equal(initialGameData('?primaryLanguage=en&learningLanguage=ja&words='+encodeURIComponent(JSON.stringify(sample.words)),DEMO_DATA).words.length,2);
assert.equal(normalizeGameData({type:'golingo:data',payload:sample}).words[1].word,'船');
assert.equal(normalizeGameData({sentences:[{id:1,sentence:'Bon voyage!',translation:'Have a good trip!'}]}).words[0].word,'Bon voyage!');
assert.equal(normalizeGameData({words:[]}),null);
assert.equal(normalizeGameData({words:[{word:'<script>alert(1)</script>'}]}).words.length,1);
assert.equal(escapeHtml('<script>'),'&lt;script&gt;');
const deck=makeLessonDeck(raw,12,()=>.15);
assert.equal(deck.length,12);
assert.ok(deck.every(item=>sample.words.some(word=>word.word===item.word)));
const exportData=exportBasket(raw,[raw.words[0]]);
assert.deepEqual(Object.keys(exportData),['primaryLanguage','learningLanguage','words']);
assert.equal(exportData.words.length,1);
assert.equal(exportData.words[0].word,'水');
assert.equal(exportData.words[0].sentence,'水を飲みます。');
console.log('GoLingo language data, URL import, sentence import, rotation and export tests passed.');
