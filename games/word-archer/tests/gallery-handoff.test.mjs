import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {normalizePayload} from '../lesson-data-v6.js';

const source = readFileSync(new URL('../main-v6.js', import.meta.url), 'utf8');
const start = source.indexOf('function incomingLesson(){');
const end = source.indexOf("\nwindow.addEventListener('message'", start);
assert(start >= 0 && end > start);
const production = source.slice(start, end);
const lesson = {primaryLanguage:'en', learningLanguage:'fr', words:[
  {id:'1', word:'R&D + 50% café', translation:'Research & development + fifty percent',
    sentence:'C++ & français = 100%', sentenceTranslation:'All punctuation stays exact.',
    audioUrl:'https://example.com/audio.mp3?a=1&b=2+c%25'},
  {id:'2', word:'你好', translation:'Hello'},
]};
const encoded = encodeURIComponent(JSON.stringify(lesson));
function receive({hash='', search='', saved=null}={}) {
  const sessionStorage = {getItem:key=>key==='golingoGameData' ? saved : null};
  const localStorage = {getItem:()=>null};
  const context = vm.createContext({location:{hash,search},URLSearchParams,normalizePayload,
    decodeURIComponent,window:{sessionStorage,localStorage},sessionStorage,localStorage});
  vm.runInContext(production,context);
  return context.incomingLesson();
}
function check(result){assert.deepEqual(result,normalizePayload(lesson));}

test('gallery #data preserves punctuation, Unicode, translations, sentences and audio URLs',()=>check(receive({hash:'#data='+encoded})));
test('gallery default #golingoLesson also loads the exact lesson',()=>check(receive({hash:'#golingoLesson='+encoded})));
test('legacy raw and encoded JSON fragments still load',()=>{
  check(receive({hash:'#'+JSON.stringify(lesson)}));
  check(receive({hash:'#'+encoded}));
});
test('query data and explicit language overrides still load',()=>{
  check(receive({search:'?data='+encoded}));
  assert.equal(receive({search:'?data='+encoded+'&learningLanguage=de'}).learningLanguage,'de');
});
test('malformed fragment does not prevent stored lesson fallback',()=>check(receive({hash:'#unrelated=%',saved:JSON.stringify(lesson)})));
test('500-entry gallery lesson reaches the game without a query-string payload',()=>{
  const large={...lesson,words:Array.from({length:500},(_,i)=>({...lesson.words[0],id:String(i),word:`${i}: ${lesson.words[0].word}`}))};
  const result=receive({hash:'#data='+encodeURIComponent(JSON.stringify(large))});
  assert.equal(result.words.length,500);
  assert.equal(result.words[499].word,large.words[499].word);
  assert.equal(result.words[499].audioUrl,large.words[499].audioUrl);
});
