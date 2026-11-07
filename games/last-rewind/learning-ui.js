/** GoLingo lesson controls, safe app/hub handoff, review basket, and pronunciation. */
import { normalizeLesson, defaultLesson, LearningSession } from './learning.js';
import { LessonAudio } from './lesson-audio.js';

const LANGUAGES=[['en','English'],['es','Español'],['zh','中文'],['ja','日本語'],['fr','Français'],['de','Deutsch'],['it','Italiano'],['pt','Português'],['ko','한국어'],['vi','Tiếng Việt'],['ar','العربية'],['hi','हिन्दी'],['ru','Русский'],['uk','Українська'],['th','ไทย']];
const KEYS={settings:'golingo:last-rewind:settings:v2',lesson:'golingo:last-rewind:lesson:v2',basket:'golingo:last-rewind:basket:v2',hub:'golingo:active-lesson:v1'};
const DEFAULTS={primaryLanguage:'en',learningLanguage:'es',textMode:'word',translation:true,repeat:true,rate:.85,difficulty:'practice',autoReload:true,shuffle:true};
function getSaved(key,kind='local'){try{const storage=kind==='session'?globalThis.sessionStorage:globalThis.localStorage;return JSON.parse(storage?.getItem(key)||'null');}catch{return null;}}
function save(key,value){try{globalThis.localStorage?.setItem(key,JSON.stringify(value));}catch{}}
function langName(code){return LANGUAGES.find(([c])=>c===code)?.[1]||code;}
function reviewKey(lesson){return `${KEYS.basket}:${lesson.primaryLanguage}:${lesson.learningLanguage}`;}
function decodePayload(raw){
  if(typeof raw!=='string')return raw;
  const text=raw.trim();if(text.length>200000)throw Error('Keep lessons below 200 KB.');
  if(text.startsWith('{')||text.startsWith('['))return text;
  try{const decoded=decodeURIComponent(text);if(decoded.startsWith('{')||decoded.startsWith('['))return decoded;}catch{}
  // Some older native bridges encode their JSON in UTF-8 base64.
  if(/^[A-Za-z0-9+/_=-]+$/.test(text)&&text.length>12&&typeof atob==='function'){
    try{const bytes=Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));const decoded=new TextDecoder().decode(bytes);if(decoded.startsWith('{')||decoded.startsWith('['))return decoded;}catch{}
  }
  return text;
}

export function createLearningUI({onOpen=()=>{},onClose=()=>{},onApply=()=>{}}={}){
  const $=id=>document.getElementById(id);
  const settings={...DEFAULTS,...(getSaved(KEYS.settings)||{})};
  if(!['hidden','word','sentence'].includes(settings.textMode))settings.textMode='word';
  if(!['practice','survival'].includes(settings.difficulty))settings.difficulty='practice';
  settings.rate=Math.max(.5,Math.min(1.3,Number(settings.rate)||.85));
  const speaker=new LessonAudio({onStatus(message){$('learning-audio-status').textContent=typeof message==='string'?message:message?.message||'';}});
  speaker.setRepeat(settings.repeat);speaker.setRate(settings.rate);
  let initial,notice='Sample lesson ready. Bring your own words or start learning now.';
  const candidates=[];
  const hash=new URLSearchParams((globalThis.location?.hash||'').replace(/^#/,''));
  const query=new URLSearchParams(globalThis.location?.search||'');
  for(const key of ['golingoLesson','lesson','data','payload','golingoData']){
    const value=hash.get(key)||query.get(key);if(value)candidates.push({value,source:'GoLingo lesson received'});
  }
  if(globalThis.window?.__GOLINGO_LESSON__)candidates.push({value:window.__GOLINGO_LESSON__,source:'GoLingo lesson received'});
  const hub=getSaved(KEYS.hub,'session');if(hub)candidates.push({value:hub,source:'Lesson from your games gallery'});
  const saved=getSaved(KEYS.lesson);if(saved)candidates.push({value:saved,source:'Your saved lesson'});
  let incomingError='';
  for(const candidate of candidates){try{initial=normalizeLesson(decodePayload(candidate.value),settings);notice=candidate.source;break;}catch(error){incomingError=error.message;}}
  if(!initial){try{initial=defaultLesson(settings.primaryLanguage,settings.learningLanguage);}catch{initial=defaultLesson();notice='Spanish sample ready. Import a lesson to use another language.';}}
  if(incomingError)notice=`Could not load one lesson: ${incomingError}. ${notice}`;
  const session=new LearningSession(initial);
  const storedBasket=getSaved(reviewKey(initial))||getSaved(KEYS.basket);
  if(storedBasket?.learningLanguage===initial.learningLanguage&&storedBasket?.primaryLanguage===initial.primaryLanguage)session.restoreBasket?.(storedBasket.words||[]);
  let opened=false,runStarted=false,sentenceShowing=false,vocabularyComplete=false,muted=false;

  function persist(){settings.primaryLanguage=session.lesson.primaryLanguage;settings.learningLanguage=session.lesson.learningLanguage;save(KEYS.settings,settings);save(KEYS.lesson,session.lesson);const basket=session.exportPayload({includeReviewCounts:true});save(KEYS.basket,basket);save(reviewKey(session.lesson),basket);}
  function setNotice(message){$('learning-notice').textContent=message;}
  function fillLanguages(){
    for(const [id,selected] of [['learning-language',session.lesson.learningLanguage],['primary-language',session.lesson.primaryLanguage]]){
      const select=$(id);select.replaceChildren();const choices=[...LANGUAGES];if(!choices.some(([code])=>code===selected))choices.push([selected,selected]);
      for(const [code,name] of choices){const option=document.createElement('option');option.value=code;option.textContent=name;select.appendChild(option);}select.value=selected;
    }
  }
  function update(){
    const round=session.currentRound,word=session.currentWord,count=session.basket.length;
    const displaySentence=sentenceShowing||settings.textMode==='sentence';
    $('lesson-summary').textContent=`${langName(session.lesson.learningLanguage)} → ${langName(session.lesson.primaryLanguage)} · ${session.rounds.length} ${session.rounds.length===1?'lesson':'lessons'}`;
    $('learning-mode-summary').textContent=settings.difficulty==='practice'?'RELAXED PRACTICE':'SURVIVAL CHALLENGE';
    $('basket-count').textContent=count;$('review-count').textContent=count;
    $('learning-round').textContent=round?`GOLINGO · ${sentenceShowing?'SENTENCE COMPLETE':vocabularyComplete?'VOCABULARY COMPLETE':'LISTEN & LEARN'}`:`GOLINGO · ${session.lesson.learningLanguage.toUpperCase()} → ${session.lesson.primaryLanguage.toUpperCase()}`;
    $('learning-word').textContent=settings.textMode==='hidden'?'Tap to hear':displaySentence?(round?.sentence||(round?`${round.words.length} vocabulary words`:'Clear a wave. Hear a sentence.')):(word?.word||'Ready to learn');
    $('learning-word').lang=session.lesson.learningLanguage;$('learning-word').dir='auto';
    const translated=displaySentence?round?.translation:word?.translation;
    $('learning-translation').textContent=settings.textMode==='hidden'?'Text hidden · pronunciation stays on':translated||(!word?'Defeat an enemy to discover a word.':'');
    $('learning-translation').lang=session.lesson.primaryLanguage;$('learning-translation').dir='auto';
    $('learning-translation').classList.toggle('hidden',!settings.translation);
    $('learning-text-mode').textContent=settings.textMode.toUpperCase();
    $('learning-meaning').textContent=settings.translation?'MEANING ON':'MEANING OFF';$('learning-meaning').setAttribute('aria-pressed',String(settings.translation));
    $('learning-repeat').textContent=settings.repeat?'REPEAT ON':'REPEAT OFF';$('learning-repeat').setAttribute('aria-pressed',String(settings.repeat));
    $('learning-display').value=settings.textMode;$('learning-show-meaning').checked=settings.translation;$('learning-loop-word').checked=settings.repeat;
    $('learning-progress').textContent=`${count} collected`;
    $('result-learned').textContent=`${count} ${count===1?'word':'words'} in your review basket · replay or export to GoLingo.`;
    if(opened)renderReview();
  }
  function renderReview(){
    const list=$('learning-review');list.replaceChildren();
    if(!session.basket.length){const text=document.createElement('p');text.textContent='Words you discover will appear here. Your basket stays between shifts.';list.appendChild(text);return;}
    for(const item of session.basket){
      const button=document.createElement('button');button.type='button';button.className='review-word';button.setAttribute('aria-label',`Hear ${item.word}`);
      const word=document.createElement('strong');word.textContent=item.word;word.lang=session.lesson.learningLanguage;word.dir='auto';
      const meaning=document.createElement('span');meaning.textContent=settings.translation?item.translation||'':'';meaning.lang=session.lesson.primaryLanguage;meaning.dir='auto';
      const play=document.createElement('i');play.textContent='▶';button.appendChild(word);button.appendChild(meaning);button.appendChild(play);
      button.addEventListener('click',()=>{speaker.unlock();speaker.playWord(item,session.lesson.learningLanguage,{repeat:false});});list.appendChild(button);
    }
  }
  function open(){if(opened)return;opened=true;onOpen();speaker.pause();$('learning-panel').classList.remove('hidden');renderReview();update();}
  function close({resume=true}={}){if(!opened)return;opened=false;$('learning-panel').classList.add('hidden');speaker.pause();onClose({resume});}
  function replaceLesson(raw,{reason='user'}={}){
    try{
      const lesson=normalizeLesson(decodePayload(raw),{primaryLanguage:$('primary-language').value||settings.primaryLanguage,learningLanguage:$('learning-language').value||settings.learningLanguage});
      persist();speaker.stop();session.setLesson(lesson);session.restoreBasket?.(getSaved(reviewKey(lesson)));sentenceShowing=false;vocabularyComplete=false;runStarted=false;
      fillLanguages();$('learning-input').value=JSON.stringify(lesson,null,2);persist();update();
      setNotice(`Loaded ${lesson.words.length} words across ${session.rounds.length} lessons. No automatic translation is applied to imported text.`);
      close({resume:false});onApply({reason});return {ok:true,words:lesson.words.length,lessons:session.rounds.length};
    }catch(error){setNotice(`Lesson not changed: ${error.message}`);return {ok:false,error:error.message};}
  }
  function exportBasket(){
    const payload=session.exportPayload(),text=JSON.stringify(payload,null,2);
    const output=$('learning-export-text');output.value=text;output.classList.remove('hidden');
    // Downloads and native callbacks happen only after the explicit Export action.
    const bridge=globalThis.window?.webkit?.messageHandlers?.golingo;
    if(bridge?.postMessage){try{bridge.postMessage({type:'golingo:export',game:'last-rewind',payload});setNotice('Review sent to GoLingo. The JSON is also shown below.');return;}catch{}}
    if(typeof Blob!=='undefined'&&globalThis.URL?.createObjectURL){
      const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='Last-Rewind-GoLingo-Words.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
    }
    setNotice(`Exported ${payload.words.length} collected words. You can also copy the JSON below.`);
  }

  fillLanguages();$('learning-input').value=JSON.stringify(session.lesson,null,2);setNotice(notice);
  $('learning-difficulty').value=settings.difficulty;$('learning-rate').value=String(settings.rate);
  $('learning-auto-reload').checked=settings.autoReload;$('learning-shuffle').checked=settings.shuffle;
  for(const id of ['learning-open-menu','learning-open-hud','learning-open-pause','learning-open-result'])$(id).addEventListener('click',open);
  $('learning-close').addEventListener('click',()=>close());$('learning-done').addEventListener('click',()=>close());
  $('learning-apply').addEventListener('click',()=>replaceLesson($('learning-input').value));
  $('learning-samples').addEventListener('click',()=>{try{replaceLesson(defaultLesson($('primary-language').value,$('learning-language').value));}catch(error){setNotice(error.message);}});
  $('learning-file').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;if(file.size>200000){setNotice('Keep lesson files below 200 KB.');return;}
    try{$('learning-input').value=await file.text();setNotice('File ready. Choose USE THIS LESSON to apply it.');}catch{setNotice('Could not read that file. Paste the text instead.');}
  });
  $('learning-difficulty').addEventListener('change',event=>{settings.difficulty=event.target.value;persist();update();setNotice('Pace saved. New enemies use this pace; damage changes immediately.');});
  $('learning-rate').addEventListener('change',event=>{settings.rate=Number(event.target.value);speaker.setRate(settings.rate);persist();});
  $('learning-auto-reload').addEventListener('change',event=>{settings.autoReload=!!event.target.checked;persist();});
  $('learning-shuffle').addEventListener('change',event=>{settings.shuffle=!!event.target.checked;persist();});
  $('learning-display').addEventListener('change',event=>{settings.textMode=event.target.value;persist();update();});
  $('learning-show-meaning').addEventListener('change',event=>{settings.translation=!!event.target.checked;persist();update();});
  $('learning-loop-word').addEventListener('change',event=>{settings.repeat=!!event.target.checked;speaker.setRepeat(settings.repeat);persist();update();});
  $('learning-text-mode').addEventListener('click',()=>{const modes=['word','sentence','hidden'];settings.textMode=modes[(modes.indexOf(settings.textMode)+1)%3];persist();update();});
  $('learning-meaning').addEventListener('click',()=>{settings.translation=!settings.translation;persist();update();});
  $('learning-repeat').addEventListener('click',()=>{settings.repeat=!settings.repeat;speaker.setRepeat(settings.repeat);persist();update();});
  $('learning-replay').addEventListener('click',()=>{speaker.unlock();if((sentenceShowing||settings.textMode==='sentence')&&session.currentRound)speaker.playSentence(session.currentRound,session.lesson.learningLanguage);else if(session.currentWord)speaker.playWord(session.currentWord,session.lesson.learningLanguage,{repeat:settings.repeat});else if(session.currentRound)speaker.playSentence(session.currentRound,session.lesson.learningLanguage);});
  $('learning-clear').addEventListener('click',()=>{session.clearBasket?.();persist();update();setNotice('Review basket cleared. Your lesson is unchanged.');});
  $('learning-export').addEventListener('click',exportBasket);

  // Accept only known lesson messages from this page, its trusted host, or GoLingo.
  const trusted=new Set([globalThis.location?.origin,'https://xcergolingo.github.io','https://www.golingoapp.com','https://golingoapp.com']);
  const receive=raw=>replaceLesson(raw,{reason:'native'});
  if(globalThis.window){
    window.GoLingo=Object.assign(window.GoLingo||{},{load:receive,receive:receive,setLesson:receive,exportWords:()=>session.exportPayload()});
    window.loadGoLingoLesson=receive;window.receiveGoLingoData=receive;window.setGoLingoData=receive;
    // A gallery or native host can reuse this tab with a new fragment payload.
    // Route it through the same validation and basket-preserving replacement.
    window.addEventListener('hashchange',()=>{
      const params=new URLSearchParams((globalThis.location?.hash||'').replace(/^#/,''));
      for(const key of ['golingoLesson','lesson','data','payload','golingoData']){
        const value=params.get(key);if(value){receive(value);break;}
      }
    });
    window.addEventListener('message',event=>{
      if(!trusted.has(event.origin)&&!(event.origin==='null'&&globalThis.location?.protocol==='file:'))return;
      if(event.source&&event.source!==window&&event.source!==window.parent)return;
      const message=event.data;if(!message||typeof message!=='object'||!['golingo:lesson','golingoLesson','GOLINGO_DATA','golingo-data','setLesson','loadLesson'].includes(message.type))return;
      receive(message.payload||message.lesson||message.data);
    });
  }
  persist();update();
  return {
    session,speaker,settings,get isOpen(){return opened;},get campaignWaves(){return Math.max(5,session.rounds.length);},
    open,close,update,receive,exportBasket,
    unlock(){speaker.unlock();},
    startRun(){speaker.stop();session.reset({shuffle:settings.shuffle,clearBasket:false});sentenceShowing=false;vocabularyComplete=false;runStarted=true;update();},
    startWave(wave){sentenceShowing=false;vocabularyComplete=false;const round=session.startWave(wave);update();return round;},
    collectWord(){const word=session.collectNext();if(word){sentenceShowing=false;speaker.playWord(word,session.lesson.learningLanguage,{repeat:settings.repeat});persist();update();}return word;},
    completeWave(){const round=session.completeWave();sentenceShowing=!!round?.sentence;vocabularyComplete=!sentenceShowing;if(sentenceShowing)speaker.playSentence(round,session.lesson.learningLanguage);else speaker.stop();persist();update();return round;},
    pause(){speaker.pause();},
    resume(){if(!runStarted)return;if(sentenceShowing&&session.currentRound)speaker.playSentence(session.currentRound,session.lesson.learningLanguage);else if(session.currentWord)speaker.playWord(session.currentWord,session.lesson.learningLanguage,{repeat:settings.repeat});},
    setMuted(value){muted=!!value;speaker.setMuted(muted);},
    get damageFactor(){return settings.difficulty==='practice'?.5:1;},
    get storeDamageFactor(){return settings.difficulty==='practice'?.5:1;},
    get speedFactor(){return settings.difficulty==='practice'?.72:1;}
  };
}
