import assert from 'node:assert/strict';
import {bindGameTap,bindRunLifecycle} from '../src/game-interaction.js';
import {LessonSpeech} from '../src/lesson-speech.js';
class Target{
 constructor(){this.events=new Map();}
 addEventListener(name,fn){if(!this.events.has(name))this.events.set(name,[]);this.events.get(name).push(fn);}
 setPointerCapture(id){this.captured=id;}
 emit(name,data={}){const e={type:name,pointerId:1,clientX:100,clientY:100,isPrimary:true,button:0,preventDefault(){this.prevented=true;},...data};for(const fn of this.events.get(name)||[])fn(e);return e;}
}
const button=new Target();let activations=0,steering=false;
bindGameTap(button,()=>activations++,{canTap:()=>!steering});
button.emit('pointerdown');button.emit('pointermove',{clientX:160});button.emit('pointermove');button.emit('pointerup');
assert.equal(activations,0,'a swipe returning to its start cannot open Pause');
button.emit('click',{detail:1,pointerType:'touch'});assert.equal(activations,0,'no synthetic click after the swipe');
button.emit('pointerdown');button.emit('pointerup');button.emit('click',{detail:1,pointerType:'touch'});
assert.equal(activations,1,'a deliberate tap activates exactly once');
button.emit('pointerdown');button.emit('pointercancel');button.emit('pointerup');assert.equal(activations,1);
button.emit('pointerdown');button.emit('lostpointercapture');button.emit('pointerup');assert.equal(activations,1);
button.emit('pointerdown',{isPrimary:false,pointerId:2});button.emit('pointerup',{pointerId:2});assert.equal(activations,1,'a second finger cannot trigger the menu');
steering=true;button.emit('pointerdown');button.emit('pointerup');assert.equal(activations,1,'steering owns its gesture');steering=false;
button.emit('click',{detail:0});assert.equal(activations,2,'keyboard and assistive activation still work');

// Exercise the actual speech controller through the focus/visibility lifecycle.
const timers=new Map();let id=0,current,time=0,spoken=0,cleared=0,mode='playing';
const speech=new LessonSpeech({engine:{speaking:false,cancel(){this.speaking=false;},resume(){},getVoices:()=>[],speak(u){current=u;this.speaking=true;spoken++;u.onstart();}},Utterance:class{constructor(text){this.text=text;}},setTimer(fn,ms){timers.set(++id,{fn,ms});return id;},clearTimer:id=>timers.delete(id),now:()=>time});
const win=new Target(),doc=new Target();doc.hidden=false;
bindRunLifecycle({windowTarget:win,documentTarget:doc,isPlaying:()=>mode==='playing',clearInput:()=>cleared++,suspendSpeech:()=>speech.suspend(true),resumeSpeech:()=>speech.suspend(false),recoverSpeech:()=>speech.recover()});
speech.set('nieve','es-ES');
try{
 win.emit('blur');assert.equal(mode,'playing');assert.equal(cleared,1);assert(!speech.suspended);
 speech.engine.speaking=false;current.onend();const repeat=[...timers].find(([,t])=>t.ms===700);assert(repeat);timers.delete(repeat[0]);time+=700;repeat[1].fn();
 assert.equal(spoken,2,'the word repeats after a visible-page blur');
 win.emit('focus');doc.emit('visibilitychange');assert.equal(mode,'playing','visible notifications do not open the menu');
 doc.hidden=true;doc.emit('visibilitychange');assert.equal(mode,'playing','backgrounding never opens a menu');assert(speech.suspended,'leaving the page suspends pronunciation while rendering is frozen');
 doc.hidden=false;doc.emit('visibilitychange');assert(!speech.suspended);assert.equal(spoken,3,'returning to the run restores the current word');
 speech.pause();doc.hidden=true;doc.emit('visibilitychange');doc.hidden=false;doc.emit('visibilitychange');assert(speech.userPaused);assert.equal(spoken,3,'background return preserves Pause Repeat');
 doc.hidden=true;doc.emit('visibilitychange');mode='paused';doc.hidden=false;doc.emit('visibilitychange');win.emit('focus');assert.equal(mode,'paused');assert(speech.suspended,'focus cannot override an intentional pause');
}finally{speech.stop();}
console.log(JSON.stringify({interaction:'passed',swipeToPause:'blocked',deliberateTap:'passed',multitouch:'passed',visibleBlurRepeats:'passed',backgroundReturnRepeats:'passed',intentionalPausePreserved:'passed'}));
