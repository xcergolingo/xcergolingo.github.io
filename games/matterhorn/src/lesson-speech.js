/* Single-owner speech queue with generation guards. Cancelling a previous word
   cannot restart it through a late onend event. Browser APIs are injectable. */
export class LessonSpeech{
 constructor({engine=globalThis.speechSynthesis,Utterance=globalThis.SpeechSynthesisUtterance,setTimer=setTimeout,clearTimer=clearTimeout,onState=()=>{}}={}){
  Object.assign(this,{engine,Utterance,setTimer,clearTimer,onState});this.supported=!!(engine&&Utterance);this.generation=0;this.timer=null;this.watchdog=null;this.active=null;this.userPaused=false;this.suspended=false;this.voiceURI='';this.rate=.85;this.speaking=false;
 }
 cancel(){this.generation++;if(this.timer!==null)this.clearTimer(this.timer);if(this.watchdog!==null)this.clearTimer(this.watchdog);this.timer=this.watchdog=null;this.speaking=false;try{this.engine?.cancel();}catch{}}
 stop(){this.cancel();this.active=null;this.onState('stopped');}
 voice(language){const voices=this.engine?.getVoices?.()||[],exact=voices.filter(v=>v.lang?.toLowerCase()===language.toLowerCase()),base=voices.filter(v=>v.lang?.split('-')[0].toLowerCase()===language.split('-')[0].toLowerCase());return voices.find(v=>v.voiceURI===this.voiceURI&&v.lang?.split('-')[0].toLowerCase()===language.split('-')[0].toLowerCase())||exact.find(v=>v.localService)||exact[0]||base.find(v=>v.localService)||base[0]||null;}
 set(text,language,{loop=true,force=false}={}){
  this.cancel();this.active={text:String(text||'').trim(),language:String(language||''),loop,retries:0,stalls:0};if(force)this.userPaused=false;
  if(!this.active.text)return;if(!this.supported){this.onState('unsupported');return;}if(this.userPaused||this.suspended){this.onState('paused');return;}this.speak(this.generation);
 }
 speak(generation){
  if(generation!==this.generation||!this.active||this.userPaused||this.suspended)return;
  const a=this.active,u=new this.Utterance(a.text);this.utterance=u;u.lang=a.language;u.rate=this.rate;u.pitch=1;u.volume=1;const voice=this.voice(a.language);if(voice)u.voice=voice;
  const retry=()=>{if(generation!==this.generation||this.userPaused||this.suspended)return;this.onState('retrying');this.timer=this.setTimer(()=>{this.timer=null;this.speak(generation);},Math.min(5000,700*2**Math.min(3,a.retries++)));};
  let done=false,started=false;const complete=()=>{if(done||generation!==this.generation)return;done=true;a.retries=0;this.speaking=false;if(this.watchdog!==null)this.clearTimer(this.watchdog);this.watchdog=null;this.onState(a.loop?'waiting':'ended');if(a.loop&&!this.userPaused&&!this.suspended)this.timer=this.setTimer(()=>{this.timer=null;this.speak(generation);},700);};
  u.onstart=()=>{if(generation===this.generation){started=true;a.retries=a.stalls=0;this.speaking=true;this.onState('speaking');}};
  u.onend=complete;
  u.onerror=e=>{if(done||generation!==this.generation)return;done=true;this.speaking=false;if(this.watchdog!==null)this.clearTimer(this.watchdog);this.watchdog=null;
   // Our intentional cancels increment generation first. A cancellation of
   // the CURRENT utterance is a browser interruption: keep its loop alive.
   if(['not-allowed','language-unavailable','voice-unavailable','synthesis-unavailable'].includes(e.error)){this.onState('tap-to-hear');return;}
   if(a.loop||a.retries<2)retry();else this.onState('tap-to-hear');
  };
  try{this.engine.resume?.();this.engine.speak(u);this.onState('queued');
   const watch=()=>{if(generation!==this.generation||done)return;this.watchdog=null;
    if(started&&this.engine.speaking){this.engine.resume?.();this.watchdog=this.setTimer(watch,4500);return;}
    if(started)complete();else{done=true;this.speaking=false;try{this.engine.cancel();}catch{}if(a.loop&&a.stalls++<1)retry();else this.onState('tap-to-hear');}
   };
   this.watchdog=this.setTimer(watch,Math.max(4500,Math.min(30000,a.text.length*135+3000)));
  }catch{this.onState('tap-to-hear');}
 }
 pause(){this.userPaused=true;this.cancel();this.onState('paused');}
 resume(){this.userPaused=false;if(this.active&&!this.suspended){this.cancel();this.speak(this.generation);}}
 suspend(value){this.suspended=value;this.cancel();if(!value&&this.active&&!this.userPaused)this.speak(this.generation);else this.onState('paused');}
 preview(text,language){this.set(text,language,{loop:false,force:true});}
}
