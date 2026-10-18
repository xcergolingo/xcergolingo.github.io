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
const document={hidden:false,body:{style:{}},getElementById(id){assert(ids.has(id),id);return ids.get(id);},addEventListener(){},querySelector(){return {href:'https://apps.apple.com/app/id1194977025'};},querySelectorAll(q){if(q==='.game-card')return cards;if(q==='[data-filter]')return filters;if(q.includes('.demo-link'))return [skiLink];return [];}};
const data=new Map(),sessionStorage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
const context={document,sessionStorage,location:{search:'',hash:'',pathname:'/games/',protocol:'https:'},history:{replaceState(){}},navigator:{},window:{matchMedia:()=>({matches:true,addEventListener(){}})},URL,URLSearchParams,Date,fetch:()=>Promise.resolve({ok:false})};
vm.runInNewContext(js,context);assert.equal(cards.length,6);assert.equal(ids.get('hub-count').textContent,'6 games');
filters.find(b=>b.dataset.filter==='sports').events.click();assert.deepEqual(cards.filter(c=>!c.hidden).map(c=>c.id),['matterhorn']);assert.equal(ids.get('hub-count').textContent,'1 game');
filters.find(b=>b.dataset.filter==='water').events.click();assert(cards.find(c=>c.id==='flooded-garden').hidden===false);
filters.find(b=>b.dataset.filter==='all').events.click();assert(cards.every(c=>!c.hidden));
const lesson={type:'sentences',learningLanguage:'es',primaryLanguage:'en',items:[{text:'Me gusta esquiar.',translation:'I like skiing.'}]};
ids.get('lesson-input').value=JSON.stringify(lesson);ids.get('lesson-save').events.click();skiLink.events.click();
const parsed=lessonFromURL(new URL(skiLink.href));assert.equal(parsed.mode,'sentences');assert.equal(parsed.items[0].text,'Me gusta esquiar.');assert.equal(parsed.translationLanguage,'en');
ids.get('lesson-clear').events.click();skiLink.events.click();assert.equal(new URL(skiLink.href).hash,'','clearing a lesson removes stale launch data');
console.log(JSON.stringify({gallery:'passed',cards:6,sportsFilter:'passed',sharedLessonLaunch:'passed',clearLesson:'passed',browser:'not tested'}));
