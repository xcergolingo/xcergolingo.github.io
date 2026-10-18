/* Single-owner native speech queue. Generation AND attempt guards ignore late
   iOS cancellation events. A bounded watchdog also recovers lost end events. */
export class LessonSpeech{
 constructor({engine=globalThis.speechSynthesis,Utterance=globalThis.SpeechSynthesisUtterance,setTimer=setTimeout,clearTimer=clearTimeout,now=()=>Date.now(),onState=()=>{}}={}){
  Object.assign(this,{engine,Utterance,setTimer,clearTimer,now,onState});this.supported=!!(engine&&Utterance);this.generation=0;this.attempt=0;this.timer=null;this.watchdog=null;this.active=null;this.utterance=null;this.userPaused=false;this.suspended=false;this.needsGesture=false;this.voiceURI='';this.rate=.85;this.speaking=false;
 }
 state(value){this.status=value;this.onState(value);}
 clearTimers(){if(this.timer!==null)this.clearTimer(this.timer);if(this.watchdog!==null)this.clearTimer(this.watchdog);this.timer=this.watchdog=null;}
 cancel(){this.generation++;this.attempt++;this.clearTimers();this.speaking=false;this.utterance=null;try{this.engine?.cancel();}catch{}}
 stop(){this.cancel();this.active=null;this.needsGesture=false;this.state('stopped');}
 voice(language){const voices=this.engine?.getVoices?.()||[],exact=voices.filter(v=>v.lang?.toLowerCase()===language.toLowerCase()),base=voices.filter(v=>v.lang?.split('-')[0].toLowerCase()===language.split('-')[0].toLowerCase());return voices.find(v=>v.voiceURI===this.voiceURI&&v.lang?.split('-')[0].toLowerCase()===language.split('-')[0].toLowerCase())||exact.find(v=>v.localService)||exact[0]||base.find(v=>v.localService)||base[0]||null;}
 set(text,language,{loop=true,force=false}={}){
  text=String(text||'').trim();language=String(language||'');
  // Starting a lesson already repeats its first word. Passing that first ring
  // must not cancel the same native utterance and accidentally silence iOS.
  if(!force&&this.active?.text===text&&this.active.language===language&&this.active.loop===loop)return;
  const replacing=!!this.utterance;this.cancel();this.active={text,language,loop,retries:0};if(force)this.userPaused=false;
  if(!text)return;if(!this.supported){this.state('unsupported');return;}if(this.userPaused||this.suspended){this.state('paused');return;}
  // Let native cancellation settle before replacing a word. The initial Start
  // and explicit Resume stay synchronous to unlock audio with the user's tap.
  if(replacing&&!force)this.schedule(this.generation,90);else this.speak(this.generation);
 }
 schedule(generation,delay){this.timer=this.setTimer(()=>{this.timer=null;this.speak(generation);},delay);}
 speak(generation){
  if(generation!==this.generation||!this.active||this.userPaused||this.suspended)return;
  const a=this.active,u=new this.Utterance(a.text),attempt=++this.attempt;this.utterance=u;
  u.lang=a.language;u.rate=this.rate;u.pitch=1;u.volume=1;const voice=this.voice(a.language);if(voice)u.voice=voice;
  let done=false,started=false,lastProgress=this.now();
  const current=()=>!done&&generation===this.generation&&attempt===this.attempt;
  const clearWatch=()=>{if(this.watchdog!==null)this.clearTimer(this.watchdog);this.watchdog=null;};
  const retire=()=>{done=true;clearWatch();this.speaking=false;this.utterance=null;};
  const retry=()=>{
   if(!current())return;if(!started)this.needsGesture=true;retire();this.attempt++;
   // Mark the attempt stale BEFORE cancel: some engines dispatch synchronously.
   try{this.engine.cancel();}catch{}
   this.state('retrying');this.schedule(generation,Math.min(5000,700*2**Math.min(3,a.retries++)));
  };
  const complete=()=>{
   if(!current())return;retire();a.retries=0;this.needsGesture=false;this.state(a.loop?'waiting':'ended');
   if(a.loop&&!this.userPaused&&!this.suspended)this.schedule(generation,700);
  };
  u.onstart=()=>{if(current()){started=true;lastProgress=this.now();a.retries=0;this.needsGesture=false;this.speaking=true;this.state('speaking');}};
  u.onboundary=()=>{if(current()){started=true;lastProgress=this.now();}};
  u.onend=complete;
  u.onerror=e=>{
   if(!current())return;
   if(['not-allowed','language-unavailable','voice-unavailable','synthesis-unavailable'].includes(e.error)){retire();this.needsGesture=true;this.state('tap-to-hear');return;}
   if(a.loop||a.retries<2)retry();else{retire();this.needsGesture=true;this.state('tap-to-hear');}
  };
  // A short word cannot stay 'speaking' forever if Safari loses its onend.
  // Sentence budgets grow with length; real boundary progress extends them.
  const budget=Math.max(4500,a.text.length*170/Math.max(.5,this.rate)+3000);
  const watch=()=>{
   if(!current())return;this.watchdog=null;
   if(started&&!this.engine.speaking){complete();return;}
   const remaining=budget-(this.now()-lastProgress);
   if(remaining>0){this.watchdog=this.setTimer(watch,remaining);return;}
   if(a.loop||a.retries<2)retry();else{retire();this.needsGesture=true;this.state('tap-to-hear');}
  };
  try{
   this.state('queued');this.engine.resume?.();this.engine.speak(u);
   if(current())this.watchdog=this.setTimer(watch,budget);
  }catch{retire();this.needsGesture=true;this.state('tap-to-hear');}
 }
 // A normal steering touch can restore a blocked native queue. Never override
 // the learner's Pause Repeat choice or restart a healthy utterance mid-word.
 gesture(){
  if(!this.supported||!this.active||this.userPaused||this.suspended)return;
  try{if(this.engine.paused)this.engine.resume?.();}catch{}
  if(this.needsGesture||this.status==='retrying'){this.cancel();this.needsGesture=false;this.speak(this.generation);}
 }
 recover(){if(!this.userPaused&&!this.suspended&&this.active&&this.supported&&this.engine.paused)try{this.engine.resume?.();}catch{}}
 pause(){this.userPaused=true;this.cancel();this.state('paused');}
 resume(){this.userPaused=false;if(this.active&&!this.suspended){this.cancel();this.needsGesture=false;this.speak(this.generation);}}
 suspend(value){this.suspended=value;this.cancel();if(!value&&this.active&&!this.userPaused)this.speak(this.generation);else this.state('paused');}
 preview(text,language){this.set(text,language,{loop:false,force:true});}
}
