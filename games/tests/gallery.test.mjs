// Executes the actual gallery event handlers with a minimal DOM double.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
const {lessonFromURL}=await import(process.argv[2]?pathToFileURL(process.argv[2]+'/src/lessons.js').href:new URL('../matterhorn/src/lessons.js',import.meta.url).href);
const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),js=await readFile(new URL('../app.js',import.meta.url),'utf8');
class Node{
 constructor(){this.events={};this.dataset={};this.textContent='';this.value='';this.hidden=false;this.style={};this.paused=true;this.classList={toggle(){},add(){}};}
 addEventListener(name,fn){this.events[name]=fn;}setAttribute(name,v){this[name]=v;}removeAttribute(name){delete this[name];}getAttribute(name){return this[name]||'';}focus(){}load(){}pause(){this.paused=true;}play(){this.paused=false;return Promise.resolve();}
}
const ids=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,new Node()]));
const cards=[...html.matchAll(/<article class="game-card" id="([^"]+)"(?: data-tags="([^"]*)")?/g)].map(([,id,tags])=>{const c=new Node();c.id=id;c.dataset.tags=tags||'';return c;});
const filters=[...html.matchAll(/data-filter="([^"]+)"/g)].map(([,filter])=>{const c=new Node();c.dataset.filter=filter;return c;});
const skiLink=new Node();skiLink.href='https://xcergolingo.github.io/games/matterhorn/';
const skyLink=new Node();skyLink.href='https://xcergolingo.github.io/games/skybreaker/';
const document={hidden:false,body:{style:{}},getElementById(id){assert(ids.has(id),id);return ids.get(id);},addEventListener(){},querySelector(){return {href:'https://apps.apple.com/app/id1194977025'};},querySelectorAll(q){if(q==='.game-card')return cards;if(q==='[data-filter]')return filters;if(q.includes('.demo-link'))return [skiLink,skyLink];return [];}};
const data=new Map(),sessionStorage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
const context={document,sessionStorage,location:{search:'',hash:'',pathname:'/games/',protocol:'https:'},history:{replaceState(){}},navigator:{},window:{matchMedia:()=>({matches:true,addEventListener(){}})},URL,URLSearchParams,Date,fetch:()=>Promise.resolve({ok:false})};
vm.runInNewContext(js,context);assert.equal(cards.length,7);assert.equal(ids.get('hub-count').textContent,'7 games');
filters.find(b=>b.dataset.filter==='sports').events.click();assert.deepEqual(cards.filter(c=>!c.hidden).map(c=>c.id),['matterhorn']);assert.equal(ids.get('hub-count').textContent,'1 game');
for(const tag of ['2d-game','airplane']){filters.find(b=>b.dataset.filter===tag).events.click();assert.deepEqual(cards.filter(c=>!c.hidden).map(c=>c.id),['skybreaker']);}
filters.find(b=>b.dataset.filter==='action').events.click();assert.deepEqual(cards.filter(c=>!c.hidden).map(c=>c.id),['super-flying-man','dolphin-pursuit','matterhorn','skybreaker']);
filters.find(b=>b.dataset.filter==='water').events.click();assert(cards.find(c=>c.id==='flooded-garden').hidden===false);
filters.find(b=>b.dataset.filter==='all').events.click();assert(cards.every(c=>!c.hidden));
const lesson={type:'sentences',learningLanguage:'es',primaryLanguage:'en',items:[{text:'Me gusta esquiar.',translation:'I like skiing.'}]};
ids.get('lesson-input').value=JSON.stringify(lesson);ids.get('lesson-save').events.click();skiLink.events.click();
const parsed=lessonFromURL(new URL(skiLink.href));assert.equal(parsed.mode,'sentences');assert.equal(parsed.items[0].text,'Me gusta esquiar.');assert.equal(parsed.translationLanguage,'en');
// Execute Skybreaker's real normalizer and URL bridge, not a duplicate parser.
const sky=await readFile(new URL('../skybreaker/index.html',import.meta.url),'utf8');
const helpers=sky.slice(sky.indexOf('const EXAMPLE_LESSON ='),sky.indexOf('// ---------- Speech coach:'));
const bridge=sky.slice(sky.indexOf(' bindLessonBridge() {'),sky.indexOf('\n\n select(id)',sky.indexOf(' bindLessonBridge() {')));
skyLink.events.click();
const host={lesson:{language:'en-US'},loadLesson(payload){this.lesson=normalize(payload);},openLessonEditor(){throw new Error('Unexpected import error');}};
const skyContext=vm.createContext({window:{addEventListener(){}},location:new URL(skyLink.href),URLSearchParams,host});
const normalize=vm.runInContext(helpers+'\nnormalizeLesson',skyContext);
vm.runInContext('('+`{${bridge}}`+').bindLessonBridge.call(host)',skyContext);
assert.equal(host.lesson.language,'es');assert.equal(host.lesson.sentences[0].text,'Me gusta esquiar.');
assert.equal(normalize({learningLanguage:'ja',words:[{word:'空',sentence:'空は青い。'}]}).sentences[0].text,'空は青い。');
assert.equal(normalize({words:['airplane']}).sentences[0].text,'airplane');
assert.equal(normalize({language:'es',sentences:['Hola mundo.']}).sentences[0].words.length,2);
ids.get('lesson-clear').events.click();
for(const link of [skiLink,skyLink]){link.events.click();assert.equal(new URL(link.href).hash,'','clearing a lesson removes stale launch data');}
console.log(JSON.stringify({gallery:'passed',cards:7,categoryFilters:'passed',sharedLessonLaunch:'passed',skybreakerLessonBridge:'passed',clearLesson:'passed',browser:'not tested'}));

