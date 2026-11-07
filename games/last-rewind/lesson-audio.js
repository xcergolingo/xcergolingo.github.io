/** Sequential lesson playback: supplied audio, language-matched TTS, and cancellable repetition. */
import {safeAudioUrl} from './learning.js';
const SILENCE='data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
const textOf=value=>typeof value==='string'?value.trim():'';
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

export class LessonAudio {
  /** onStatus receives {state,kind,text,language,message}; dependencies are optional for tests. */
  constructor(options={}) {
    if(typeof options==='function')options={onStatus:options};
    this.onStatus=options.onStatus||null;
    this._Audio=options.Audio ?? globalThis.Audio;
    this._synth=options.speechSynthesis ?? globalThis.speechSynthesis;
    this._Utterance=options.SpeechSynthesisUtterance ?? globalThis.SpeechSynthesisUtterance;
    this._clock=options.timers||globalThis;
    this._repeatDelay=clamp(Number(options.repeatDelay)||850,100,10000);
    this._audio=null;this._utterance=null;this._timers=new Set();this._generation=0;
    this._last=null;this._unlocked=false;this._paused=false;this._stopped=true;
    this._pending=false;this._muted=false;this._repeat=true;this._rate=.88;
    this._cycle=0;this.status={state:'idle',kind:null,text:'',language:'',message:''};
  }
  get supported(){return Boolean(typeof this._Audio==='function'||(this._synth&&typeof this._Utterance==='function'));}
  get muted(){return this._muted;}
  get paused(){return this._paused;}
  get repeat(){return this._repeat;}
  get rate(){return this._rate;}
  get unlocked(){return this._unlocked;}
  _emit(state,message='') {
    this.status={state,kind:this._last?.kind||null,text:this._last?.text||'',language:this._last?.language||'',message};
    try{this.onStatus?.(this.status);}catch{}
  }
  _active(token){return token===this._generation&&!this._paused&&!this._stopped&&!this._muted&&this._unlocked;}
  _later(fn,delay,token=this._generation) {
    const id=this._clock.setTimeout(()=>{this._timers.delete(id);if(this._active(token))fn();},delay);
    this._timers.add(id);return id;
  }
  _clearTimer(id){if(id!==undefined&&id!==null){this._clock.clearTimeout(id);this._timers.delete(id);}}
  _clearPlayback() {
    for(const timer of this._timers)this._clock.clearTimeout(timer);
    this._timers.clear();
    if(this._audio){
      this._audio.onended=this._audio.onerror=this._audio.onplaying=this._audio.onloadedmetadata=null;
      try{this._audio.pause();}catch{}
    }
    if(this._utterance){this._utterance.onend=this._utterance.onerror=this._utterance.onstart=null;this._utterance=null;}
    try{this._synth?.cancel();}catch{}
  }
  _cancel(){this._generation++;this._cycle++;this._clearPlayback();return this._generation;}
  _ensureAudio(){
    if(!this._audio&&typeof this._Audio==='function'){
      try{this._audio=new this._Audio();this._audio.preload='auto';}catch{}
    }
    return this._audio;
  }
  /** Call from Start, Resume, Replay, or another direct user gesture. */
  unlock() {
    if(this._unlocked){try{this._synth?.resume();}catch{}return Promise.resolve(this.supported);}
    this._unlocked=true;
    try{this._synth?.resume();}catch{}
    const audio=this._ensureAudio(),token=this._generation;
    let warmup=Promise.resolve();
    if(audio){
      // Reuse this exact element for later clips, which matters on mobile Safari.
      try{
        audio.src=SILENCE;audio.volume=0;
        const promise=audio.play();
        warmup=Promise.resolve(promise).catch(()=>{}).then(()=>{
          if(this._generation===token&&audio.src===SILENCE){try{audio.pause();}catch{}audio.volume=1;}
        });
      }catch{}
    }
    if(this._pending&&this._last&&!this._muted){this._pending=false;this._runLast();}
    else if(!this._last)this._emit('ready');
    return warmup.then(()=>this.supported);
  }
  _newItem(item) {
    this._cancel();this._last=item;this._paused=false;this._stopped=false;this._pending=false;
    if(!item.text){this._stopped=true;this._emit('idle');return;}
    if(!this._unlocked){this._pending=true;this._emit('locked','Tap Start or Replay to enable pronunciation.');return;}
    if(this._muted){this._emit('muted');return;}
    this._playOne(this._generation);
  }
  playWord(word,language,{repeat=true}={}) {
    const value=typeof word==='string'?{word}:word||{};
    this._newItem({kind:'word',text:textOf(value.word||value.text),audioUrl:safeAudioUrl(value.audioUrl||value.audioURL||value.audio),language:textOf(language)||'en',repeatAllowed:repeat!==false});
  }
  playSentence(sentenceOrRound,language) {
    const value=typeof sentenceOrRound==='string'?{sentence:sentenceOrRound}:sentenceOrRound||{};
    const childAudio=Array.isArray(value.words)?value.words.find(word=>safeAudioUrl(word.sentenceAudioUrl))?.sentenceAudioUrl:'';
    this._newItem({kind:'sentence',text:textOf(value.sentence||value.text),audioUrl:safeAudioUrl(value.sentenceAudioUrl||value.audioUrl||value.audio||childAudio),language:textOf(language)||'en',repeatAllowed:false});
  }
  _runLast() {
    if(!this._last)return;
    this._cancel();this._paused=false;this._stopped=false;
    if(!this._unlocked){this._pending=true;this._emit('locked','Tap Start or Replay to enable pronunciation.');return;}
    if(this._muted){this._emit('muted');return;}
    this._playOne(this._generation);
  }
  replay({repeat}={}) {
    if(!this._last)return;
    if(repeat!==undefined)this._last={...this._last,repeatAllowed:!!repeat&&this._last.kind==='word'};
    this._runLast();
  }
  pause(){this._cancel();this._pending=false;this._paused=true;this._stopped=false;this._emit('paused');}
  resume(){if(this._last&&this._paused)this._runLast();}
  stop(){this._cancel();this._pending=false;this._paused=false;this._stopped=true;this._emit('stopped');}
  setRepeat(value){
    this._repeat=!!value;
    if(!this._repeat&&this.status.state==='waiting'){this._cancel();this._stopped=true;this._emit('ended');}
  }
  setMuted(value){
    const muted=!!value;if(muted===this._muted)return;
    this._muted=muted;
    if(muted){this._cancel();this._emit('muted');}
    else if(this._last&&!this._paused&&!this._stopped)this._runLast();
    else this._emit(this._paused?'paused':this._stopped?'stopped':'ready');
  }
  setRate(value){const number=Number(value);if(Number.isFinite(number))this._rate=clamp(number,.5,1.5);}

  _playOne(token) {
    if(!this._active(token))return;
    const cycle=++this._cycle;
    if(this._last.audioUrl&&this._ensureAudio())this._playClip(token,cycle);
    else this._speak(token,cycle);
  }
  _finished(token,cycle) {
    if(!this._active(token)||cycle!==this._cycle)return;
    this._clearPlayback();
    if(this._last.kind==='word'&&this._last.repeatAllowed&&this._repeat){
      this._emit('waiting');this._later(()=>this._playOne(token),this._repeatDelay,token);
    }else{this._stopped=true;this._emit('ended');}
  }
  _failed(token,cycle,message) {
    if(!this._active(token)||cycle!==this._cycle)return;
    this._clearPlayback();this._stopped=true;this._emit('unavailable',message);
  }
  _playClip(token,cycle) {
    const audio=this._audio,item=this._last;let settled=false,startTimer,endTimer;
    const valid=()=>!settled&&this._active(token)&&cycle===this._cycle;
    const detach=()=>{
      this._clearTimer(startTimer);this._clearTimer(endTimer);
      audio.onended=audio.onerror=audio.onplaying=audio.onloadedmetadata=null;
    };
    const fallback=()=>{
      if(!valid())return;settled=true;detach();try{audio.pause();}catch{}
      this._speak(token,cycle);
    };
    const finish=()=>{if(!valid())return;settled=true;detach();this._finished(token,cycle);};
    const startEndTimer=()=>{
      this._clearTimer(endTimer);
      const duration=Number(audio.duration);
      const timeout=Number.isFinite(duration)&&duration>0?clamp(duration/this._rate*1000+5000,6000,180000):item.kind==='word'?14000:65000;
      endTimer=this._later(fallback,timeout,token);
    };
    audio.onended=finish;audio.onerror=fallback;
    audio.onloadedmetadata=()=>{if(valid())startEndTimer();};
    audio.onplaying=()=>{
      if(!valid())return;this._clearTimer(startTimer);this._emit('playing');startEndTimer();
    };
    try{
      audio.volume=1;audio.muted=false;audio.playbackRate=this._rate;audio.src=item.audioUrl;
      try{audio.currentTime=0;}catch{}
      this._emit('loading');startTimer=this._later(fallback,7000,token);
      const pending=audio.play();if(pending&&typeof pending.catch==='function')pending.catch(fallback);
    }catch{fallback();}
  }
  _speak(token,cycle,attempt=0) {
    if(!this._active(token)||cycle!==this._cycle)return;
    const synth=this._synth,Utterance=this._Utterance,item=this._last;
    if(!synth||typeof Utterance!=='function'){this._failed(token,cycle,'Pronunciation is unavailable on this browser.');return;}
    let voices=[];try{voices=Array.from(synth.getVoices?.()||[]);}catch{}
    const language=item.language.toLowerCase().replace(/_/g,'-'),base=language.split('-')[0];
    const exact=voices.filter(voice=>String(voice.lang).toLowerCase().replace(/_/g,'-')===language);
    const matching=exact.length?exact:voices.filter(voice=>String(voice.lang).toLowerCase().replace(/_/g,'-').split('-')[0]===base);
    const voice=matching.find(v=>v.localService)||matching[0];
    if(!voice){
      if(!voices.length&&attempt<5){this._emit('loading');this._later(()=>this._speak(token,cycle,attempt+1),240,token);return;}
      this._failed(token,cycle,`No ${item.language} voice is installed. Add a voice for this language or supply an audio URL.`);return;
    }
    let utterance;try{utterance=new Utterance(item.text);}catch{this._failed(token,cycle,'Speech synthesis could not start.');return;}
    this._utterance=utterance;utterance.lang=item.language;utterance.voice=voice;utterance.rate=this._rate;utterance.pitch=1;utterance.volume=1;
    let settled=false,watchdog;
    const valid=()=>!settled&&this._active(token)&&cycle===this._cycle;
    utterance.onstart=()=>{if(valid())this._emit('playing');};
    utterance.onend=()=>{if(!valid())return;settled=true;this._clearTimer(watchdog);this._finished(token,cycle);};
    utterance.onerror=event=>{
      if(!valid())return;settled=true;this._clearTimer(watchdog);
      this._failed(token,cycle,event?.error==='not-allowed'?'Tap Replay to allow pronunciation.':'The selected voice could not finish. Tap Replay to try again.');
    };
    this._emit('loading');
    watchdog=this._later(()=>{
      if(!valid())return;settled=true;this._failed(token,cycle,'The selected voice did not finish. Tap Replay to try again.');
    },clamp(item.text.length/8/this._rate*1000+7000,10000,180000),token);
    try{synth.speak(utterance);}catch{settled=true;this._clearTimer(watchdog);this._failed(token,cycle,'The selected voice could not start.');}
  }
}
