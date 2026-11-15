import {voiceFor} from './learning.js';

// Browser speech is unlocked by the same deliberate tap that starts the game.
// A provided audio URL takes precedence, then speechSynthesis is the fallback.
export class AudioGuide {
  constructor(){
    this.enabled=true;this.repeat=true;this.running=false;this.current=null;
    this.language='ja';this.timer=null;this.audio=null;this.generation=0;
  }
  configure({enabled=true,repeat=true,language='ja'}){
    this.enabled=enabled;this.repeat=repeat;this.language=language;
    if(!enabled)this.pause();
  }
  _stopPlayback(){
    ++this.generation;clearTimeout(this.timer);this.timer=null;
    if(this.audio){this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.audio=null;}
    try{window.speechSynthesis?.cancel();}catch{}
  }
  pause(){this.running=false;this._stopPlayback();}
  resume(){this.running=true;this._playCurrent();}
  setCurrent(item){this.current=item;this._stopPlayback();if(this.running)this._playCurrent();}
  _schedule(callback,delay){clearTimeout(this.timer);this.timer=setTimeout(callback,delay);}
  _play(text,item,finished){
    const token=this.generation;
    const done=()=>{if(token===this.generation)finished?.();};
    if(item?.audioUrl){
      try{
        const url=new URL(item.audioUrl,window.location.href);
        if(url.protocol==='https:'||url.protocol==='http:'){
          const audio=new Audio(url.href);this.audio=audio;audio.preload='auto';
          let fellBack=false;
          const fallBack=()=>{
            if(token!==this.generation||fellBack)return;
            fellBack=true;this.audio=null;this._speak(text,done);
          };
          audio.onended=done;audio.onerror=fallBack;
          const start=audio.play();start?.catch(fallBack);
          return;
        }
      }catch{}
    }
    this._speak(text,done);
  }
  _speak(text,done){
    if(!text||!('speechSynthesis' in window)){this._schedule(done,1400);return;}
    try{
      const utter=new SpeechSynthesisUtterance(text);
      utter.lang=voiceFor(this.language);utter.rate=.86;utter.pitch=1.04;
      const voices=window.speechSynthesis.getVoices();
      const selected=voices.find(v=>v.lang.toLowerCase()===utter.lang.toLowerCase())||voices.find(v=>v.lang.toLowerCase().startsWith(this.language.toLowerCase()));
      if(selected)utter.voice=selected;
      utter.onend=done;utter.onerror=()=>this._schedule(done,450);
      window.speechSynthesis.speak(utter);
    }catch{this._schedule(done,1200);}
  }
  _playCurrent(){
    if(!this.running||!this.enabled||!this.current)return;
    this._stopPlayback();
    const item=this.current;
    this._play(item.word,item,()=>{
      if(this.running&&this.repeat&&this.current===item)
        this._schedule(()=>this._playCurrent(),650);
    });
  }
  // A tapped or collected word is spoken once, then the focus word resumes.
  pronounceOnce(item,returnToFocus=true,force=false){
    if((!this.enabled&&!force)||!item?.word)return;
    const wasRunning=this.running;
    this._stopPlayback();
    this._play(item.word,item,()=>{
      if(returnToFocus&&wasRunning&&this.running)
        this._schedule(()=>this._playCurrent(),550);
    });
  }
  saySentence(sentence){
    if(!this.enabled||!sentence)return;
    this.running=false;this._stopPlayback();
    this._play(sentence,null,()=>{});
  }
}
