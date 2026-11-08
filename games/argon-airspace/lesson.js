// GoLingo Lesson Radio for Argon Airspace. No account, server, or external lesson asset required.
// The host gallery passes its lesson through #golingoLesson=...; a native WKWebView
// can also post {type:'golingoLesson', payload:{...}} into this page.

const $ = id => document.getElementById(id);
const LANG_NAMES = {en:'English',es:'Spanish',fr:'French',ja:'Japanese',zh:'Chinese',ko:'Korean',vi:'Vietnamese',de:'German',it:'Italian',pt:'Portuguese',ar:'Arabic',hi:'Hindi',ru:'Russian',th:'Thai',uk:'Ukrainian'};
const LESSON_KEY = 'argon_golingo_lesson_v1';
const SETTINGS_KEY = 'argon_golingo_settings_v1';
const MAX_JSON_LENGTH = 120000;
const DEFAULT_WORDS = [
  ['avión','airplane','El avión está llegando.','The airplane is arriving.'],
  ['aterrizar','to land','Vamos a aterrizar.','We are going to land.'],
  ['cielo','sky','El cielo está despejado.','The sky is clear.'],
  ['pista','runway','La pista está libre.','The runway is clear.'],
  ['piloto','pilot','El piloto está listo.','The pilot is ready.'],
  ['aeropuerto','airport','Llegamos al aeropuerto.','We arrived at the airport.'],
  ['despegar','to take off','Vamos a despegar.','We are going to take off.'],
  ['vuelo','flight','Buen vuelo.','Have a good flight.'],
  ['torre de control','control tower','Llama a la torre de control.','Call the control tower.'],
  ['helicóptero','helicopter','Mira el helicóptero.','Look at the helicopter.'],
  ['viento','wind','El viento es fuerte.','The wind is strong.'],
  ['seguro','safe','El vuelo es seguro.','The flight is safe.'],
  ['nube','cloud','Hay una nube blanca.','There is a white cloud.'],
  ['izquierda','left','Gira a la izquierda.','Turn left.'],
  ['derecha','right','Gira a la derecha.','Turn right.'],
  ['bienvenido','welcome','Bienvenido a bordo.','Welcome aboard.']
];
const DEMO = {
  primaryLanguage:'en', learningLanguage:'es',
  words:DEFAULT_WORDS.map(([word,translation,sentence,sentenceTranslation],i)=>({id:String(i+1),word,translation,sentence,sentenceTranslation}))
};

function lang(raw,fallback){return String(raw || fallback).trim().toLowerCase().replace('_','-').slice(0,24) || fallback}
function clean(value,max=400){return String(value??'').trim().slice(0,max)}
function shuffle(array){for(let i=array.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[array[i],array[j]]=[array[j],array[i]]}return array}
function parseJson(value){if(typeof value==='string'){
  if(value.length>MAX_JSON_LENGTH)throw new Error('Lesson is too large (120 KB maximum).');
  try{return JSON.parse(value)}catch{throw new Error('Please paste valid GoLingo JSON.')}}
  if(!value||typeof value!=='object')throw new Error('Lesson must be a JSON object.');
  return value;
}
function normalizedLesson(input){
  const source=parseJson(input);
  const primaryLanguage=lang(source.primaryLanguage||source.baseLanguage||source.translationLanguage,'en');
  const learningLanguage=lang(source.learningLanguage||source.targetLanguage||source.language,'es');
  let sourceItems=[];
  for(const key of ['words','sentences','phrases','items','entries'])if(Array.isArray(source[key]))sourceItems.push(...source[key]);
  if(Array.isArray(source))sourceItems=source;
  const words=sourceItems.slice(0,500).map((item,i)=>{
    if(typeof item==='string')return{id:String(i+1),word:clean(item),translation:'',sentence:'',sentenceTranslation:''};
    if(!item||typeof item!=='object')return null;
    const word=clean(item.word??item.text??item.phrase??item.sentence??item.learningText);
    const translation=clean(item.translation??item.meaning??item.sentenceTranslation??item.primaryText);
    const sentence=clean(item.sentence??'');
    const sentenceTranslation=clean(item.sentenceTranslation??'');
    const audioUrl=clean(item.audioUrl??item.audioURL??item.audio??'',1000);
    return{id:clean(item.id??i+1,80),word,translation,sentence,sentenceTranslation,audioUrl};
  }).filter(item=>item&&item.word);
  if(!words.length)throw new Error('No words or sentences found. Use a "words" or "sentences" array.');
  return {primaryLanguage,learningLanguage,words};
}
function fromIncomingUrl(){
  const hash=new URLSearchParams(location.hash.replace(/^#/,''));
  const query=new URLSearchParams(location.search);
  for(const params of [hash,query])for(const key of ['golingoLesson','lesson','golingo','data']){
    const value=params.get(key);
    if(value){try{return normalizedLesson(value)}catch(error){console.warn('Invalid GoLingo lesson URL:',error.message)}}
  }
  return null;
}
function readSettings(){try{return JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')||{}}catch{return {}}}
function saveSettings(value){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(value))}catch{}}
function saveSession(lesson){try{sessionStorage.setItem(LESSON_KEY,JSON.stringify(lesson))}catch{}}
function loadSession(){try{const raw=sessionStorage.getItem(LESSON_KEY);return raw?normalizedLesson(raw):null}catch{return null}}
function labelLanguage(code){return LANG_NAMES[code.split('-')[0]]||code.toUpperCase()}

export function createLearningController({getMode,pauseGame,resumeGame,notify,paChime}){
  const settings=Object.assign({showWords:true,showTranslation:true,repeat:true},readSettings());
  let lesson=fromIncomingUrl()||loadSession()||normalizedLesson(DEMO);
  let fromDemo=lesson.words.length===DEMO.words.length&&lesson.learningLanguage==='es';
  let nextIndex=0,deck=[],basket=[],selected=null,repeatTimer=null,currentAudio=null,speakingToken=0;
  let modalWasPlaying=false;
  const state={get lesson(){return lesson},get basket(){return basket}};

  function clearAudio(){
    speakingToken++;
    clearTimeout(repeatTimer);repeatTimer=null;
    if(currentAudio){currentAudio.pause();currentAudio.src='';currentAudio=null}
    try{if('speechSynthesis'in window)speechSynthesis.cancel()}catch{}
  }
  function createDeck(){deck=shuffle(lesson.words.map((_,i)=>i));nextIndex=0}
  function nextWord(){if(nextIndex>=deck.length)createDeck();return lesson.words[deck[nextIndex++]]}
  function updateRibbon(item=selected){
    $('lessonCaption').textContent=`GOLINGO · ${labelLanguage(lesson.learningLanguage).toUpperCase()} ${item?'· LANDED':'· APPROACH'}`;
    $('lessonWord').textContent=item&&settings.showWords?item.word:(settings.showWords?'AWAITING A LANDING':'WORDS HIDDEN');
    $('lessonTranslation').textContent=item&&settings.showTranslation?item.translation||item.sentenceTranslation:'';
    $('lessonRibbon').classList.toggle('is-muted',!settings.showWords);
    $('hideWordsBtn').textContent=settings.showWords?'◉':'◎';
    $('hideWordsBtn').setAttribute('aria-label',settings.showWords?'Hide word text':'Show word text');
    $('startLessonMeta').textContent=`GOLINGO · ${lesson.words.length} ${labelLanguage(lesson.learningLanguage).toUpperCase()} PRACTICE ${lesson.words.length===1?'ENTRY':'ENTRIES'}`;
  }
  function updatePlaneLabel(plane){
    if(!plane||!plane.label)return;
    let span=plane.label.querySelector('.plane-word');
    if(!span){span=document.createElement('small');span.className='plane-word';plane.label.appendChild(span)}
    span.dataset.word=plane.learningItem?.word||'';
    span.textContent=settings.showWords?span.dataset.word:'';
    span.hidden=!settings.showWords||!plane.learningItem;
  }
  function speak(item,force=false){
    if(!item||(!force&&getMode()!=='playing'))return;
    clearAudio();
    const token=speakingToken;
    const again=()=>{if(token!==speakingToken||getMode()!=='playing'||!settings.repeat)return;repeatTimer=setTimeout(()=>{if(token!==speakingToken)return;speak(item)},1100)};
    const url=item.audioUrl;
    if(url&&/^https:\/\//i.test(url)){
      try{
        const player=new Audio(url);currentAudio=player;player.volume=.77;
        player.onended=again;
        player.onerror=()=>{if(token===speakingToken){currentAudio=null;speakWithSpeech(item,token,again)}};
        player.play().catch(()=>{if(token===speakingToken){currentAudio=null;speakWithSpeech(item,token,again)}});
        return;
      }catch{}
    }
    speakWithSpeech(item,token,again);
  }
  function speakWithSpeech(item,token,again){
    if(token!==speakingToken)return;
    if(!('speechSynthesis'in window)){paChime();return}
    try{
      const utterance=new SpeechSynthesisUtterance(item.word);
      utterance.lang=lesson.learningLanguage;
      utterance.rate=.84;
      utterance.pitch=1;
      utterance.volume=.9;
      const voices=speechSynthesis.getVoices();
      utterance.voice=voices.find(v=>v.lang.toLowerCase()===lesson.learningLanguage)||voices.find(v=>v.lang.toLowerCase().startsWith(lesson.learningLanguage.split('-')[0]))||null;
      utterance.onend=again;
      utterance.onerror=again;
      speechSynthesis.speak(utterance);
    }catch{paChime()}
  }
  function refreshSettings(){
    $('showWordsCheck').checked=settings.showWords;
    $('showTranslationCheck').checked=settings.showTranslation;
    $('repeatCheck').checked=settings.repeat;
    saveSettings(settings);updateRibbon();
  }
  function reset(){clearAudio();basket=[];selected=null;createDeck();updateRibbon();$('lessonStatus').textContent=`Ready: ${lesson.words.length} ${labelLanguage(lesson.learningLanguage)} entries.`}
  function load(value,{demo=false}={}){
    const next=normalizedLesson(value);lesson=next;fromDemo=demo;saveSession(next);reset();
    $('lessonJson').value='';
    $('lessonStatus').textContent=`✓ Loaded ${next.words.length} ${labelLanguage(next.learningLanguage)} ${next.words.length===1?'entry':'entries'}. Future aircraft use this lesson.`;
    if(!demo)notify(`GOLINGO · ${next.words.length} NEW WORDS LOADED`);
    return next;
  }
  function openModal(){
    modalWasPlaying=getMode()==='playing';
    clearAudio();
    if(modalWasPlaying)pauseGame();
    $('lessonOverlay').hidden=false;
    $('lessonStatus').textContent=`${lesson.words.length} ${labelLanguage(lesson.learningLanguage)} entries active · ${basket.length} landed this shift.`;
  }
  function closeModal(){
    $('lessonOverlay').hidden=true;
    if(modalWasPlaying){resumeGame();if(selected)speak(selected)}
    modalWasPlaying=false;
  }
  function exportBasket(){
    if(!basket.length){$('lessonStatus').textContent='Land a plane to collect a word before exporting.';return}
    const payload={primaryLanguage:lesson.primaryLanguage,learningLanguage:lesson.learningLanguage,words:basket.map(item=>({...item}))};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const href=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=href;a.download=`golingo-argon-landings-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(href),3000);
    $('lessonStatus').textContent=`✓ Exported ${basket.length} landed entries for GoLingo.`;
  }

  $('startLessonBtn').addEventListener('click',openModal);
  $('lessonBtn').addEventListener('click',openModal);
  $('closeLessonBtn').addEventListener('click',closeModal);
  $('replayWordBtn').addEventListener('click',()=>{if(selected)speak(selected,true);else notify('LAND AN AIRCRAFT TO HEAR ITS WORD')});
  function refreshPlaneLabels(){document.querySelectorAll('.plane-label .plane-word').forEach(span=>{span.hidden=!settings.showWords;span.textContent=settings.showWords?span.dataset.word||'':''})}
  $('hideWordsBtn').addEventListener('click',()=>{$('showWordsCheck').checked=settings.showWords=!settings.showWords;refreshSettings();refreshPlaneLabels()});
  for(const [id,key] of [['showWordsCheck','showWords'],['showTranslationCheck','showTranslation'],['repeatCheck','repeat']]){
    $(id).addEventListener('change',event=>{settings[key]=event.target.checked;refreshSettings();if(key==='repeat'&&!settings.repeat)clearAudio();refreshPlaneLabels()})
  }
  $('loadLessonBtn').addEventListener('click',()=>{
    try{load($('lessonJson').value)}catch(error){$('lessonStatus').textContent=`⚠ ${error.message}`}
  });
  $('demoLessonBtn').addEventListener('click',()=>load(DEMO,{demo:true}));
  $('exportBasketBtn').addEventListener('click',exportBasket);
  $('endLessonBtn').addEventListener('click',openModal);

  // Unlike a top-level window postMessage broadcast, only direct parent/native
  // frames are accepted. The payload is validated before replacing the deck.
  addEventListener('message',event=>{
    if(event.source!==window.parent&&event.source!==window)return;
    const data=event.data;
    if(!data||!['golingoLesson','golingo:lesson','GOLINGO_LESSON'].includes(data.type))return;
    try{load(data.payload??data.lesson??data.data);if(getMode()==='playing')notify('NEW LESSON WILL APPLY TO INCOMING AIRCRAFT')}catch(error){$('lessonStatus').textContent=`⚠ ${error.message}`}
  });

  createDeck();refreshSettings();
  if(!fromDemo)saveSession(lesson);
  return Object.assign(state,{
    assignPlane(plane){plane.learningItem=nextWord();updatePlaneLabel(plane);return plane.learningItem},
    onLanding(plane){const item=plane.learningItem;if(!item)return;const entry={...item};basket.push(entry);selected=entry;updateRibbon(entry);speak(entry);},
    removePlane(plane){if(plane.label){const span=plane.label.querySelector('.plane-word');span?.remove()}},
    reset,clearAudio,
    pause(){clearAudio()},
    resume(){if(selected)speak(selected)},
    openModal
  });
}

export {normalizedLesson,DEMO};
