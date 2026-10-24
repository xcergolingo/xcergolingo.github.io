/** Offline GoLingo lesson normalization, cancellable pronunciation and review state. */
const MAX_TEXT = 100000, MAX_ENTRIES = 500;
const clone = value => JSON.parse(JSON.stringify(value));
const text = value => String(value ?? '').trim();
function hash(value) { let h=2166136261; for(const c of value){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(36); }
function language(value,fallback) { const raw=text(value)||fallback;try{return Intl.getCanonicalLocales(raw)[0];}catch{throw new Error('Use a valid language code, such as en, es, ja or zh-CN.');} }
function audioURL(value) { const s=text(value);if(!s)return '';if(/^(https?:|blob:|file:|data:audio\/)/i.test(s)||!/^\w[\w+.-]*:/.test(s))return s;return ''; }
function lines(textValue) {
  return textValue.split(/\r?\n/).filter(row=>row.trim()).map(row=>{
    const separator=row.includes('\t')?'\t':'|';let cells=[],cell='',quoted=false;
    for(let i=0;i<row.length;i++){
      const c=row[i];
      if(c==='\\'&&i+1<row.length&&[separator,'\\','"'].includes(row[i+1])){cell+=row[++i];continue;}
      if(c==='"'){if(quoted&&row[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;continue;}
      if(c===separator&&!quoted){cells.push(cell.trim());cell='';}else cell+=c;
    }
    cells.push(cell.trim());return cells;
  });
}
export function parseLessonText(input,options={}) {
  const raw=text(input);if(!raw)throw new Error('Add at least one word or sentence.');if(raw.length>MAX_TEXT)throw new Error('Keep lessons below 100,000 characters.');
  if(/^[\[{]/.test(raw)){try{return normalizeLesson(JSON.parse(raw));}catch(e){throw new Error('Could not read the lesson JSON. '+e.message);}}
  const mode=options.mode==='sentences'?'sentences':'words';
  const entries=lines(raw).map((c,i)=>mode==='sentences'?{id:'s'+i,sentence:c[0],translation:c[1]||''}:{id:'w'+i,word:c[0],translation:c[1]||'',sentence:c[2]||'',sentenceTranslation:c[3]||''});
  return normalizeLesson({...options,mode,[mode]:entries});
}
export function normalizeLesson(input) {
  let raw=input;
  if(typeof raw==='string'){if(raw.length>MAX_TEXT)throw new Error('Keep lessons below 100,000 characters.');raw=JSON.parse(raw);}
  if(Array.isArray(raw))raw={words:raw};
  if(!raw||typeof raw!=='object')throw new Error('Pass a lesson object or a list of words.');
  if(raw.lesson&&typeof raw.lesson==='object')raw=raw.lesson;
  if(raw.payload&&typeof raw.payload==='object'&&!raw.words&&!raw.sentences)raw=raw.payload;
  if(JSON.stringify(raw).length>MAX_TEXT*4)throw new Error('This lesson is too large.');
  const learningLanguage=language(raw.learningLanguage||raw.language||raw.targetLanguage,'es');
  const primaryLanguage=language(raw.primaryLanguage||raw.translationLanguage||raw.nativeLanguage,'en');
  const mode=raw.mode==='sentences'||(!raw.words&&Array.isArray(raw.sentences))?'sentences':'words';
  const source=mode==='sentences'?(raw.sentences||raw.phrases||raw.words):(raw.words||raw.vocabulary||raw.items||raw.entries||raw.phrases);
  if(!Array.isArray(source)||!source.length)throw new Error('Add at least one word or sentence.');
  if(source.length>MAX_ENTRIES)throw new Error('Use at most 500 source entries per lesson.');
  const id=text(raw.id)||'lesson-'+hash(JSON.stringify({learningLanguage,primaryLanguage,mode,source:source.map(v=>typeof v==='string'?v:[v.id,v.word||v.text||v.sentence,v.translation||v.sentenceTranslation])}));
  const lesson={format:'golingo-lesson',version:1,id,title:text(raw.title)||'Your learning drive',primaryLanguage,translationLanguage:primaryLanguage,learningLanguage,mode,words:[],sentences:[],stages:[]};
  const ids=new Set();
  function base(entry,index){
    let entryId=text(entry.id)||'entry-'+index;while(ids.has(entryId))entryId+='-'+index;ids.add(entryId);
    return {id:entryId,entryId,learningLanguage:language(entry.learningLanguage||entry.language,learningLanguage),primaryLanguage:language(entry.primaryLanguage||entry.translationLanguage,primaryLanguage)};
  }
  function word(entry,b,extra={}){
    const wordText=text(typeof entry==='string'?entry:entry.word||entry.text||entry.term);if(!wordText)return null;
    return {...b,word:wordText,text:wordText,translation:text(entry.translation||entry.meaning),sentence:text(entry.sentence),sentenceTranslation:text(entry.sentenceTranslation),wordAudioUrl:audioURL(entry.wordAudioUrl||entry.audioUrl),translationAudioUrl:audioURL(entry.translationAudioUrl),sentenceAudioUrl:audioURL(entry.sentenceAudioUrl),sentenceTranslationAudioUrl:audioURL(entry.sentenceTranslationAudioUrl),...extra};
  }
  source.forEach((item,i)=>{
    const entry=typeof item==='string'?{[mode==='sentences'?'sentence':'word']:item}:item;if(!entry||typeof entry!=='object')return;
    const b=base(entry,i);
    if(mode==='words'){
      const w=word(entry,b);if(!w)return;lesson.words.push(w);lesson.stages.push({...w,id:b.id+':word',kind:'word'});return;
    }
    const sentence=text(entry.sentence||entry.text||entry.word);if(!sentence)return;
    const translation=text(entry.sentenceTranslation||entry.translation);
    const s={...b,sentence,text:sentence,translation,sentenceTranslation:translation,sentenceAudioUrl:audioURL(entry.sentenceAudioUrl||entry.audioUrl),sentenceTranslationAudioUrl:audioURL(entry.sentenceTranslationAudioUrl||entry.translationAudioUrl),words:[]};
    let tokens=entry.words||entry.tokens;
    if(!Array.isArray(tokens)||!tokens.length){
      if(typeof Intl.Segmenter==='function')tokens=[...new Intl.Segmenter(b.learningLanguage,{granularity:'word'}).segment(sentence)].filter(v=>v.isWordLike).map(v=>({word:v.segment}));
      else tokens=(sentence.match(/[\p{L}\p{N}\p{M}]+(?:['’\-][\p{L}\p{N}\p{M}]+)*/gu)||[]).map(v=>({word:v}));
    }
    tokens.forEach((token,j)=>{
      const w=word(typeof token==='string'?{word:token}:token,{...b,id:b.id+':token-'+j},{sentence,sentenceTranslation:translation,sentenceAudioUrl:s.sentenceAudioUrl,sentenceTranslationAudioUrl:s.sentenceTranslationAudioUrl});
      if(w){s.words.push(w);lesson.words.push(w);lesson.stages.push({...w,id:b.id+':word-'+j,kind:'word'});}
    });
    lesson.sentences.push(s);lesson.stages.push({...s,id:b.id+':sentence',word:sentence,kind:'sentence',wordAudioUrl:s.sentenceAudioUrl,translationAudioUrl:s.sentenceTranslationAudioUrl});
  });
  if(!lesson.stages.length)throw new Error('No usable words or sentences were found.');
  if(lesson.stages.length>5000)throw new Error('Split this lesson into fewer than 5,000 gates.');
  return lesson;
}
export function createLearningController(options={}) {
  const win=options.window||(typeof window!=='undefined'?window:{});
  const synth=options.speechSynthesis||win.speechSynthesis;
  const Utterance=options.SpeechSynthesisUtterance||win.SpeechSynthesisUtterance;
  const AudioClass=options.Audio||win.Audio;
  const delay=options.setTimeout||setTimeout,clear=options.clearTimeout||clearTimeout;
  let prefs={repeat:true,speechRate:.85,voiceURI:'',...(options.preferences||{})};
  let lesson=null,stages=[],current=null,review=[],collected=new Set(),started=false,speechPaused=false,suspended=true,dead=false;
  let sequence=0,timer=null,media=null,reusableAudio=null,utterance=null,sentenceComplete=false,audioState='idle',audioMessage='Word audio begins at your first gate.';
  const notify=()=>{options.onChange?.(getState());};
  function status(state,message){audioState=state;audioMessage=message;options.onStatus?.({state,message});}
  function stop(){sequence++;if(timer!==null){clear(timer);timer=null;}if(media){try{media.onended=media.onerror=null;media.pause();}catch{}media=null;}if(utterance){utterance.onend=utterance.onerror=null;utterance=null;}try{synth?.cancel();}catch{}}
  function safeVoices(){try{return synth?.getVoices()||[];}catch{return [];}}
  function bestVoice(lang){const base=lang.toLowerCase().split('-')[0],voices=safeVoices().filter(v=>v.lang?.toLowerCase().split('-')[0]===base);return voices.find(v=>v.voiceURI===prefs.voiceURI)||voices.find(v=>v.lang.toLowerCase()===lang.toLowerCase())||voices.find(v=>v.localService)||voices[0];}
  function playback(spec,{repeat=false,manual=false,resumeWord=false,markSentence=false}={}){
    stop();if(dead||!spec?.text)return;
    if(!manual&&(!started||suspended||speechPaused))return;
    const ticket=sequence;
    let completed=false,fallbackStarted=false;
    const currentTicket=()=>!dead&&ticket===sequence;
    const done=()=>{if(!currentTicket()||completed)return;completed=true;if(markSentence)sentenceComplete=true;const resume=(repeat||resumeWord)&&prefs.repeat&&!speechPaused&&!suspended&&current?.kind==='word';status('idle',resume?'Listening pause…':'Tap the word to hear it again.');if(resume){timer=delay(()=>{timer=null;if(currentTicket())playCurrent();},1500);}notify();};
    const denied=(message)=>{if(!currentTicket())return;status('blocked',message||'Tap the word to start pronunciation.');notify();};
    function tts(){
      if(!currentTicket()||fallbackStarted)return;fallbackStarted=true;
      const voice=bestVoice(spec.lang);
      if(!synth||!Utterance||!voice){denied('No matching voice available. Add a voice for '+spec.lang+' or use lesson audio.');return;}
      try{
        const u=new Utterance(spec.text);utterance=u;u.lang=spec.lang;u.voice=voice;u.rate=Number(prefs.speechRate)||.85;u.pitch=1;u.volume=1;
        u.onend=done;u.onerror=event=>{if(!currentTicket())return;if(event?.error==='canceled'||event?.error==='interrupted')return;denied('Tap the word to retry pronunciation.');};
        status('speaking','Listen and repeat');synth.speak(u);
      }catch{denied('Tap the word to retry pronunciation.');}
    }
    if(spec.url&&AudioClass){
      try{
        const audio=reusableAudio||(reusableAudio=new AudioClass());media=audio;audio.preload='auto';audio.volume=1;audio.src=spec.url;audio.playbackRate=Number(prefs.speechRate)||.85;
        const recordingFailed=()=>{if(!currentTicket())return;try{audio.onended=audio.onerror=null;audio.pause();}catch{}media=null;tts();};
        audio.onended=done;audio.onerror=recordingFailed;
        status('speaking','Listen and repeat');const play=audio.play();
        if(play?.catch)play.catch(error=>{if(!currentTicket())return;if(error?.name==='NotAllowedError')denied();else recordingFailed();});
      }catch{tts();}
    }else tts();
  }
  function spec(entry,{translation=false,sentence=false}={}){
    const lang=translation?(entry.primaryLanguage||lesson?.primaryLanguage):(entry.learningLanguage||lesson?.learningLanguage);
    if(sentence)return {text:translation?(entry.sentenceTranslation||entry.translation):(entry.sentence||entry.text||entry.word),lang,url:translation?entry.sentenceTranslationAudioUrl:entry.sentenceAudioUrl};
    return {text:translation?entry.translation:(entry.text||entry.word||entry.sentence),lang,url:translation?entry.translationAudioUrl:(entry.wordAudioUrl||entry.audioUrl)};
  }
  function playCurrent(){if(current?.kind==='sentence'&&sentenceComplete){status('idle','Sentence complete. Tap it to hear it again.');return;}if(current)playback(spec(current),{repeat:current.kind==='word',markSentence:current.kind==='sentence'});}
  function getState(){return {currentStage:current?clone(current):null,current:current?clone(current):null,index:current?stages.findIndex(s=>s.id===current.id):-1,paused:speechPaused,speechPaused,suspended,started,audioState,audioMessage,collectedCount:collected.size,collectedIds:[...collected],stageCount:stages.length,reviewCount:review.length,review:clone(review),preferences:{...prefs}};}
  function load(payload,{append=false,clearReview=false}={}){
    const next=normalizeLesson(payload);
    if(append&&lesson){
      const previous=lesson;
      const existing=previous.mode==='sentences'?previous.sentences:previous.words;
      if(previous.mode!==next.mode)throw new Error('Append lessons using the same word or sentence format.');
      const incoming=next.mode==='sentences'?next.sentences:next.words;
      const all=[...existing,...incoming];
      const currentId=current?.id;
      lesson=normalizeLesson({...previous,[previous.mode]:all});stages=lesson.stages;
      if(currentId)current=stages.find(stage=>stage.id===currentId)||current;
    }else{stop();lesson=next;stages=next.stages;current=null;collected.clear();sentenceComplete=false;status('idle','Word audio begins at your first gate.');}
    if(clearReview)review=[];notify();return clone(lesson);
  }
  function collect(value){
    const stage=typeof value==='number'?stages[value]:value;if(!stage||!stages.some(s=>s.id===stage.id))return false;
    if(collected.has(stage.id))return false;
    collected.add(stage.id);current=stage;sentenceComplete=false;
    const key=lesson.id+':'+stage.entryId+':'+stage.kind+':'+stage.text;
    let entry=review.find(row=>row.reviewKey===key);
    if(entry){entry.occurrences=(entry.occurrences||1)+1;entry.count=entry.occurrences;entry.lastPractisedAt=new Date().toISOString();}
    else{entry={...clone(stage),reviewKey:key,lessonId:lesson.id,occurrences:1,count:1,lastPractisedAt:new Date().toISOString()};review.push(entry);}
    playCurrent();notify();return true;
  }
  function startFromGesture(){
    if(dead)return;started=true;
    if(AudioClass&&!reusableAudio){
      try{
        reusableAudio=new AudioClass();reusableAudio.volume=0;reusableAudio.src='data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
        const primeAudio=reusableAudio,primeTicket=sequence,play=primeAudio.play();
        if(play?.then)play.then(()=>{if(sequence===primeTicket)primeAudio.pause();},()=>{});
      }catch{}
    }
    // A silent utterance unlocks the speech session without advancing a lesson.
    if(synth&&Utterance){try{const prime=new Utterance('');prime.volume=0;prime.lang=lesson?.learningLanguage||'en';synth.speak(prime);synth.resume?.();}catch{}}
    if(current&&!speechPaused&&!suspended)playCurrent();notify();
  }
  function setSpeechPaused(value){speechPaused=!!value;stop();if(speechPaused)status('paused','Word voice paused');else if(!suspended)playCurrent();notify();}
  function setSuspended(value){const next=!!value;if(next===suspended)return;suspended=next;stop();if(next)status('paused','Drive paused');else if(current?.kind==='word'&&!speechPaused)playCurrent();else status('idle','Tap the word to hear it again.');notify();}
  function resetRun(){stop();current=null;sentenceComplete=false;collected.clear();status('idle','Word audio begins at your first gate.');notify();}
  function preview(entry,opts={}){started=true;playback(spec(entry,opts),{manual:true,repeat:false});}
  function replayCurrent(opts={}){if(!current)return;started=true;playback(spec(current,opts),{manual:true,repeat:!opts.translation&&!opts.sentence&&current.kind==='word'&&!speechPaused&&!suspended,resumeWord:!!opts.translation,markSentence:current.kind==='sentence'&&!opts.translation});}
  function setReview(items){if(!Array.isArray(items))throw new Error('The review basket must be a list.');review=items.filter(v=>v&&typeof v==='object'&&(v.word||v.text||v.sentence)).slice(0,10000).map(v=>({...clone(v),occurrences:Number(v.occurrences||v.count)||1}));notify();}
  function setPreferences(value){const wasRepeat=prefs.repeat;prefs={...prefs,...value};if(!prefs.repeat&&timer!==null){clear(timer);timer=null;}if(prefs.repeat&&!wasRepeat&&current?.kind==='word'&&!speechPaused&&!suspended)playCurrent();notify();}
  const onVoices=()=>{if(current&&audioState==='blocked'&&started&&!speechPaused&&!suspended&&bestVoice(current.learningLanguage))playCurrent();};
  synth?.addEventListener?.('voiceschanged',onVoices);
  if(options.lesson)load(options.lesson);if(options.review)setReview(options.review);
  return {load,collect,startFromGesture,setSpeechPaused,toggleSpeechPause(){setSpeechPaused(!speechPaused);},setSuspended,preview,replayCurrent,speakTranslation(){replayCurrent({translation:true});},setPreferences,getState,getLesson:()=>lesson?clone(lesson):null,getStages:()=>clone(stages),getReview:()=>clone(review),setReview,clearReview(){review=[];notify();},resetRun,beginLap(){collected.clear();notify();},dispose(){dead=true;stop();synth?.removeEventListener?.('voiceschanged',onVoices);},destroy(){this.dispose();}};
}
