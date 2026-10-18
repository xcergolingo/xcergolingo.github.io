import assert from 'node:assert/strict';
import {LessonSpeech} from '../src/lesson-speech.js';
class Utterance{constructor(text){this.text=text;}}
const timers=new Map();let next=1;
const setTimer=(fn,ms)=>{const id=next++;timers.set(id,{fn,ms});return id;},clearTimer=id=>timers.delete(id);
const tick=ms=>{for(const [id,t]of [...timers])if(t.ms===ms){timers.delete(id);t.fn();}};
const voices=[{voiceURI:'en',lang:'en-US',localService:true},{voiceURI:'es-online',lang:'es-ES',localService:false},{voiceURI:'es-local',lang:'es-ES',localService:true}];
const engine={queue:[],speaking:false,cancel(){this.speaking=false;},resume(){},getVoices:()=>voices,speak(u){this.queue.push(u);this.speaking=true;}};
const states=[],s=new LessonSpeech({engine,Utterance,setTimer,clearTimer,onState:v=>states.push(v)});
const current=()=>engine.queue.at(-1),end=()=>{engine.speaking=false;current().onend();};
s.set('montaña','es-ES');assert.equal(current().voice.voiceURI,'es-local');current().onstart();assert(s.speaking);
end();assert.equal(timers.size,1);tick(700);assert.equal(engine.queue.length,2);assert.equal(current().text,'montaña');
const old=current();s.set('nieve','es-ES');old.onend();tick(700);assert.equal(current().text,'nieve');assert.equal(engine.queue.length,3,'cancelled word cannot requeue');
end();s.pause();const count=engine.queue.length;tick(700);assert.equal(engine.queue.length,count,'pause clears pending repeat');
s.set('esquiar','es-ES');assert.equal(engine.queue.length,count,'manual pause survives next ring');
s.resume();assert.equal(current().text,'esquiar');
s.suspend(true);const paused=engine.queue.length;tick(700);assert.equal(engine.queue.length,paused);s.suspend(false);assert.equal(engine.queue.length,paused+1);
s.set('Me gusta esquiar.','es-ES',{loop:false});end();tick(700);assert.equal(current().text,'Me gusta esquiar.');assert.equal(timers.size,0,'sentence is spoken once');
s.voiceURI='en';s.preview('hola','es-ES');assert.equal(current().voice.voiceURI,'es-local','wrong-language voice is never selected');
current().onerror({error:'not-allowed'});assert.equal(states.at(-1),'tap-to-hear');assert.equal(timers.size,0);
s.preview('hola','es-ES');const stale=current();s.stop();stale.onstart();stale.onend();tick(700);assert.equal(s.active,null);assert.equal(timers.size,0);
s.set('hola','es-ES');engine.speaking=false;tick(4500);assert.equal(states.at(-1),'retrying');tick(700);engine.speaking=false;tick(4500);assert.equal(states.at(-1),'tap-to-hear','silent stalls get one recovery attempt and then a user-gesture fallback');assert.equal(timers.size,0);s.stop();
s.set('nieve','es-ES');current().onstart();current().onerror({error:'canceled'});assert.equal(states.at(-1),'retrying');tick(700);assert.equal(current().text,'nieve','unexpected native cancellations do not silently end repetition');
for(let i=0;i<8;i++){current().onstart();end();tick(700);assert.equal(current().text,'nieve','repetition continues beyond several completions');}
const interrupted=current();current().onerror({error:'network'});s.set('montaña','es-ES');tick(700);interrupted.onend();assert.equal(current().text,'montaña','late error recovery cannot replace the next word');s.stop();
s.set('Una frase larga. '.repeat(30),'es-ES',{loop:false});current().onstart();tick(30000);assert.equal(timers.size,1,'long sentences are not cut off by the watchdog');assert(s.speaking);end();assert.equal(timers.size,0);s.stop();
let unsupported;new LessonSpeech({engine:null,Utterance:null,onState:v=>unsupported=v}).set('hola','es-ES');assert.equal(unsupported,'unsupported');
console.log(JSON.stringify({speech:'passed',repeat:'passed',cancellation:'passed',pauseResume:'passed',finishOnce:'passed',languageVoice:'passed',gestureFallback:'passed'}));
