// Controller-level DOM double; this does not replace browser/voice playback QA.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LearningUI} from '../src/learning-ui.js';
class Element{
 constructor(){this.value='';this.hidden=false;this.textContent='';this.dataset={};this.firstChild={textContent:''};this.classList={toggle(){}};this.children=[];this.events={};}
 addEventListener(name,fn){this.events[name]=fn;}setAttribute(name,value){this[name]=value;}
 replaceChildren(...nodes){this.children=nodes;}append(node){this.children.push(node);}focus(options){this.focusOptions=options;}querySelector(){return this.panel??=(Object.assign(new Element(),{scrollTop:300}));}
}
const html=readFileSync(new URL('../src/shell.html',import.meta.url),'utf8'),nodes=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,new Element()]));
assert(!nodes.has('word-card'),'word card is absent from the game');
const buttons=['sentences','phrases'].map(mode=>{const b=new Element();b.dataset.lessonMode=mode;return b;});
globalThis.document={getElementById(id){assert(nodes.has(id),'DOM id exists: '+id);return nodes.get(id);},createElement:()=>new Element(),body:{classList:{toggle(){}}},documentElement:{style:{setProperty(){}}},querySelector:()=>new Element(),querySelectorAll:()=>buttons};
globalThis.innerHeight=900;globalThis.visualViewport={height:900,addEventListener(){}};
globalThis.localStorage={getItem(){return null;},setItem(){}};
class Utterance{constructor(text){this.text=text;}}
const queue=[];globalThis.SpeechSynthesisUtterance=Utterance;
globalThis.speechSynthesis={cancel(){},resume(){},getVoices:()=>[],addEventListener(){},speak(u){queue.push(u);}};
let mode='playing';const ui=new LearningUI({mode:()=>mode,pause(){mode='paused';},apply(){}});
try{
 const r=ui.prepare();ui.startGesture();assert.equal(ui.speech.active.loop,true,'first word repeats immediately');assert.equal(queue.at(-1).text,r.units[0].text);
 assert.equal(nodes.get('repeat-controls').hidden,false);assert.equal(nodes.get('voice-pause').textContent,'Ⅱ PAUSE REPEAT');
 ui.toggleRepeat();assert(ui.speech.userPaused);const count=queue.length;
 ui.pass(r.gates[1]);assert.equal(queue.length,count,'next word does not override manual pause');assert.equal(ui.speech.active.text,r.units[1].text);
 ui.toggleRepeat();assert.equal(queue.at(-1).text,r.units[1].text,'resume repeats the latest word');assert.equal(ui.speech.active.loop,true);
 ui.suspend(true);assert(ui.speech.suspended);ui.suspend(false);assert.equal(queue.at(-1).text,r.units[1].text);
 ui.pass(r.gates[2]);assert.equal(queue.at(-1).text,r.units[2].text,'next ring replaces the looping word');
 mode='finish';ui.finish();assert.equal(ui.speech.active.text,r.text);assert.equal(ui.speech.active.loop,false,'whole sentence is spoken once');
 assert.equal(nodes.get('finish-source').textContent,r.text);
 assert.deepEqual(nodes.get('finish-source').focusOptions,{preventScroll:true});assert.equal(nodes.get('finish-menu').querySelector().scrollTop,0,'sentence stays visible at the top on narrow screens');
}finally{ui.stop();}
console.log(JSON.stringify({learningUI:'passed',wordCard:'removed',continuousRepeat:'passed',pauseAcrossRings:'passed',resumeLatestWord:'passed',sentenceFinish:'passed',realBrowser:'not tested'}));
