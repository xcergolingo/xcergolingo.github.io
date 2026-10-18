import assert from 'node:assert/strict';
import {LessonSpeech} from '../src/lesson-speech.js';
class Utterance{constructor(text){this.text=text;}}
function setup(){
 let time=0,next=0;const timers=new Map();
 const setTimer=(fn,ms)=>{const id=++next;timers.set(id,{fn,at:time+ms});return id;};
 const advance=ms=>{const until=time+ms;let guard=0;while(true){const due=[...timers].filter(([,t])=>t.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;if(++guard>1000)throw new Error('unbounded timer');time=due[1].at;timers.delete(due[0]);due[1].fn();}time=until;};
 const voices=[{voiceURI:'en',lang:'en-US',localService:true},{voiceURI:'es-online',lang:'es-ES',localService:false},{voiceURI:'es-local',lang:'es-ES',localService:true}];
 const engine={queue:[],speaking:false,paused:false,autoStart:true,cancels:0,lateCancel:false,
  cancel(){this.cancels++;this.speaking=false;const old=this.current;this.current=null;if(old&&this.lateCancel)setTimer(()=>old.onerror({error:'canceled'}),110);},
  resume(){this.paused=false;},getVoices:()=>voices,
  speak(u){this.current=u;this.queue.push(u);this.speaking=true;if(this.autoStart)u.onstart();}
 };
 const states=[],speech=new LessonSpeech({engine,Utterance,setTimer,clearTimer:id=>timers.delete(id),now:()=>time,onState:s=>states.push(s)});
 const current=()=>engine.queue.at(-1),end=()=>{engine.speaking=false;current().onend();};
 return {speech,engine,timers,states,current,end,advance};
}
{
 const {speech:s,engine,timers,current,end,advance}=setup();
 s.set('montaña','es-ES');assert.equal(current().voice.voiceURI,'es-local');
 const initial=current(),cancels=engine.cancels;s.set('montaña','es-ES');
 assert.equal(current(),initial);assert.equal(engine.cancels,cancels,'first ring keeps the healthy initial word playing');
 for(let i=0;i<24;i++){end();advance(700);assert.equal(current().text,'montaña');}
 assert.equal(engine.queue.length,25,'the same word keeps repeating without an arbitrary count limit');
 const old=current();engine.lateCancel=true;s.set('nieve','es-ES');assert.equal(s.active.text,'nieve');
 advance(90);const latest=current();assert.equal(latest.text,'nieve');advance(20);old.onstart();old.onend();
 assert.equal(current(),latest,'late iOS cancel/start/end events cannot replace the next word');
 end();advance(700);assert.equal(current().text,'nieve');
 s.pause();const count=engine.queue.length;advance(20000);assert.equal(engine.queue.length,count);
 s.set('esquiar','es-ES');s.gesture();assert.equal(engine.queue.length,count,'manual pause survives gates and steering touches');
 s.resume();assert.equal(current().text,'esquiar');assert(s.speaking);
 s.suspend(true);const paused=engine.queue.length;advance(20000);assert.equal(engine.queue.length,paused);
 s.suspend(false);assert.equal(current().text,'esquiar');assert.equal(engine.queue.length,paused+1);
 s.set('Me gusta esquiar.','es-ES',{loop:false});advance(90);end();advance(10000);
 assert.equal(current().text,'Me gusta esquiar.');assert.equal(s.status,'ended');s.stop();advance(110);assert.equal(timers.size,0);
}
{
 const {speech:s,engine,current,end,advance}=setup();
 s.set('nieve','es-ES');
 for(const error of ['canceled','interrupted','network','audio-busy']){
  current().onerror({error});assert.equal(s.status,'retrying');advance(700);assert.equal(current().text,'nieve');assert.equal(s.status,'speaking');
 }
 // Missing onend with both plausible and stuck native speaking flags.
 engine.speaking=false;advance(4500);assert.equal(s.status,'waiting');advance(700);
 const stuck=current();assert(engine.speaking);advance(4500);assert.equal(s.status,'retrying','stuck native speaking flag cannot wait forever');advance(700);
 assert.notEqual(current(),stuck);assert.equal(current().text,'nieve');
 stuck.onend();assert.equal(s.status,'speaking','late completion from a retired attempt is ignored');
 end();advance(700);s.stop();
}
{
 const {speech:s,engine,current,advance}=setup();
 engine.autoStart=false;s.set('hola','es-ES');advance(60000);
 assert(engine.queue.length>=8,'silent native stalls continue recovery instead of abandoning the loop');
 assert.equal(s.active.text,'hola');engine.autoStart=true;s.gesture();
 assert.equal(s.status,'speaking','a steering gesture immediately recovers a blocked/retrying queue');
 s.pause();const count=engine.queue.length;s.gesture();advance(20000);assert.equal(engine.queue.length,count);s.stop();
}
{
 const {speech:s,engine,current,advance}=setup();
 s.voiceURI='en';s.set('hola','es-ES');assert.equal(current().voice.voiceURI,'es-local');
 current().onerror({error:'not-allowed'});assert.equal(s.status,'tap-to-hear');assert(s.needsGesture);
 s.gesture();assert.equal(s.status,'speaking','next real touch unlocks the current word');
 const count=engine.queue.length;s.gesture();assert.equal(engine.queue.length,count,'healthy speech is not restarted on every steering touch');
 engine.paused=true;s.recover();assert.equal(engine.paused,false);
 const long='Una frase larga. '.repeat(30);s.set(long,'es-ES',{loop:false});advance(90);const sentence=current();advance(30000);sentence.onboundary();advance(65000);
 assert.equal(current(),sentence,'long, progressing sentences are not cut off at a fixed word timeout');
 engine.speaking=false;sentence.onend();assert.equal(s.status,'ended');s.stop();
}
{
 const {speech:s,current,advance}=setup();s.set('hola','es-ES');const stale=current();s.stop();stale.onstart();stale.onend();advance(20000);assert.equal(s.active,null);
 let state;new LessonSpeech({engine:null,Utterance:null,onState:v=>state=v}).set('hola','es-ES');assert.equal(state,'unsupported');
}
console.log(JSON.stringify({speech:'passed',continuousRepeat24Cycles:'passed',sameWordGate:'passed',lateNativeCancel:'passed',stuckEngineRecovery:'passed',silentStallRecovery:'passed',steeringGestureRecovery:'passed',manualPause:'passed',sentenceFinishOnce:'passed',realPhoneAudio:'not tested'}));
