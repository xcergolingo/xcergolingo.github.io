// Snow Kings language layer. Runs without a build step; no lesson data is uploaded.
const DEMO_ROWS=[
  ['nieve','snow','La nieve es blanca.','The snow is white.'],
  ['muñeco de nieve','snowman','Construimos un muñeco de nieve.','We build a snowman.'],
  ['regalo','gift','Aquí tienes un regalo.','Here is a gift for you.'],
  ['árbol','tree','El árbol es muy alto.','The tree is very tall.'],
  ['castillo de hielo','ice palace','Veo un castillo de hielo.','I see an ice palace.'],
  ['estrella','star','La estrella brilla en el cielo.','The star shines in the sky.'],
  ['montaña','mountain','La montaña está cubierta de nieve.','The mountain is covered in snow.'],
  ['luna','moon','Mira la luna llena.','Look at the full moon.'],
  ['pueblo','village','El pueblo está tranquilo.','The village is peaceful.'],
  ['bosque','forest','Caminamos por el bosque.','We walk through the forest.'],
  ['rápido','fast','La bola de nieve va rápido.','The snowball moves fast.'],
  ['gigante','giant','¡La bola de nieve es gigante!','The snowball is gigantic!'],
  ['ventana','window','Hay luz en la ventana.','There is light in the window.'],
  ['frío','cold','Esta noche hace frío.','It is cold tonight.'],
  ['ganador','winner','¡Eres el ganador!','You are the winner!']
];
export const SNOW_DEMO={primaryLanguage:'en',learningLanguage:'es',words:DEMO_ROWS.map(([word,translation,sentence,sentenceTranslation],i)=>({id:String(i+1),word,translation,sentence,sentenceTranslation}))};

const langNames={en:'English',es:'Spanish',ja:'Japanese',zh:'Chinese',vi:'Vietnamese',fr:'French',de:'German',pt:'Portuguese',it:'Italian',ko:'Korean',ar:'Arabic',hi:'Hindi',ru:'Russian',th:'Thai',uk:'Ukrainian'};
const clean=(text,max=600)=>String(text??'').trim().slice(0,max);
const normLang=(value,fallback)=>clean(value||fallback,28).replace('_','-').toLowerCase()||fallback;
const shuffle=array=>{for(let i=array.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[array[i],array[j]]=[array[j],array[i]];}return array;};
function parseInput(input){
  if(typeof input==='string'){
    if(input.length>120000)throw Error('Lesson exceeds the 120 KB limit.');
    const value=input.trim();
    if(!value)throw Error('Paste words, sentences, or a GoLingo JSON lesson.');
    try{return JSON.parse(value);}catch{
      const lines=value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
      if(!lines.length)throw Error('No learning items found.');
      return {words:lines.map(line=>{
        const parts=line.split(/\s*(?:=|\t|\s+→\s+|\s+\|\s+)\s*/);
        return {word:parts[0],translation:parts.slice(1).join(' ')};
      })};
    }
  }
  if(Array.isArray(input))return {words:input};
  if(!input||typeof input!=='object')throw Error('Provide a GoLingo JSON object or a word list.');
  return input;
}
function tokenizeSentence(sentence,language){
  try{
    if(typeof Intl.Segmenter==='function')return Array.from(new Intl.Segmenter(language,{granularity:'word'}).segment(sentence)).filter(v=>v.isWordLike).map(v=>v.segment);
  }catch{}
  return sentence.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)||sentence.split(/\s+/).filter(Boolean);
}
function fromWord(v,i){
  if(typeof v==='string')v={word:v};
  if(!v||typeof v!=='object')return null;
  const word=clean(v.word??v.original??v.text??v.phrase??v.learningText??'');if(!word)return null;
  return {id:clean(v.id??i+1,64),kind:'word',word,translation:clean(v.translation??v.meaning??v.primaryText),
    sentence:clean(v.sentence),sentenceTranslation:clean(v.sentenceTranslation),audioURL:clean(v.audioURL??v.audioUrl??v.audio??'',1000)};
}
function fromSentence(v,i,language){
  if(typeof v==='string')v={sentence:v};
  if(!v||typeof v!=='object')return [];
  const sentence=clean(v.sentence??v.text??v.original??v.phrase??'');if(!sentence)return [];
  const translation=clean(v.translation??v.sentenceTranslation??v.meaning??'');
  const pieces=Array.isArray(v.words)&&v.words.length?
    v.words.map((word,index)=>{
      const item=fromWord(word,`${i}-${index}`);
      return item?{...item,sentence:item.sentence||sentence,sentenceTranslation:item.sentenceTranslation||translation}:null;
    }).filter(Boolean):
    tokenizeSentence(sentence,language).map((word,index)=>({id:`${i}-${index}`,kind:'word',word,translation:'',sentence,sentenceTranslation:translation,audioURL:''}));
  const end={id:clean(v.id??`sentence-${i}`,64),kind:'sentence',word:sentence,translation,sentence,sentenceTranslation:translation,
    audioURL:clean(v.audioURL??v.audioUrl??'',1000)};
  return [...pieces,end];
}
export function normalizeSnowLesson(input){
  const raw=parseInput(input);
  const primaryLanguage=normLang(raw.primaryLanguage||raw.translationLanguage||raw.baseLanguage,'en');
  const learningLanguage=normLang(raw.learningLanguage||raw.language||raw.targetLanguage,'es');
  const groups=[];
  const words=Array.isArray(raw.words)?raw.words:[];
  words.forEach((v,i)=>{const item=fromWord(v,i);if(item)groups.push([item]);});
  const sentenceMode=raw.type==='sentences'||raw.mode==='sentences';
  for(const key of ['sentences','phrases',...(sentenceMode?['items','entries']:[])]){
    if(!Array.isArray(raw[key]))continue;
    raw[key].forEach((v,i)=>{const group=fromSentence(v,i,learningLanguage);if(group.length)groups.push(group);});
  }
  if(!groups.length)for(const key of ['items','entries']){
    if(!Array.isArray(raw[key]))continue;
    raw[key].forEach((v,i)=>{const item=fromWord(v,i);if(item)groups.push([item]);});
  }
  if(groups.length===0)throw Error('No words or sentences found. Add a nonempty words or sentences array.');
  if(groups.length>500)throw Error('Please limit a lesson to 500 entries.');
  const entries=shuffle(groups).flat().slice(0,600);
  return {primaryLanguage,learningLanguage,entries,originalCount:groups.length};
}

function initialLesson(){
  const hash=new URLSearchParams(location.hash.replace(/^#/,''));
  const search=new URLSearchParams(location.search);
  for(const params of [hash,search])for(const key of ['golingoLesson','lesson','golingo','data','payload']){
    const value=params.get(key);if(!value)continue;
    try{return {lesson:normalizeSnowLesson(value),source:'game hub'};}catch(error){console.warn('Invalid incoming GoLingo lesson:',error.message);}
  }
  try{
    const saved=sessionStorage.getItem('golingo:active-lesson:v1');
    if(saved)return {lesson:normalizeSnowLesson(saved),source:'game hub session'};
  }catch{}
  try{
    const saved=sessionStorage.getItem('snow-kings:lesson');
    if(saved)return {lesson:normalizeSnowLesson(saved),source:'saved lesson'};
  }catch{}
  return {lesson:normalizeSnowLesson(SNOW_DEMO),source:'winter demo'};
}

function voiceFor(lang){
  const voices=window.speechSynthesis?.getVoices()||[];
  return voices.find(v=>v.lang.toLowerCase()===lang)||voices.find(v=>v.lang.toLowerCase().startsWith(lang.split('-')[0]))||null;
}

export function createSnowLearning({onChange=()=>{},isPlaying=()=>false,onModalPause=()=>{},notify=()=>{}}={}){
  const $=id=>document.getElementById(id);
  const setup=initialLesson();
  let lesson=setup.lesson,source=setup.source,basket=[],index=0,modalOpen=false;
  let settings={showWords:true,showTranslation:true,voice:true,repeat:true};
  try{settings={...settings,...JSON.parse(localStorage.getItem('snow-kings:learning-settings')||'{}')};}catch{}
  let audio=null,repeatTimer=0,token=0,active=false;
  const current=()=>lesson.entries[index%lesson.entries.length];
  const stopVoice=()=>{
    token++;clearTimeout(repeatTimer);repeatTimer=0;
    if(audio){audio.onended=audio.onerror=null;audio.pause();audio.removeAttribute('src');audio.load?.();audio=null;}
    try{window.speechSynthesis?.cancel();}catch{}
  };
  function scheduleRepeat(item,t){
    if(t!==token||!settings.repeat||!settings.voice||!active||!isPlaying()||modalOpen)return;
    repeatTimer=setTimeout(()=>{if(t===token)speak(item);},1050);
  }
  function speech(item,t){
    if(t!==token||!active||!settings.voice)return;
    if(!('speechSynthesis'in window)||!window.SpeechSynthesisUtterance)return;
    try{
      const say=new SpeechSynthesisUtterance(item.word);
      say.lang=lesson.learningLanguage;say.voice=voiceFor(lesson.learningLanguage);
      say.rate=.82;say.pitch=1;say.volume=.88;
      say.onend=()=>scheduleRepeat(item,t);
      say.onerror=()=>scheduleRepeat(item,t);
      speechSynthesis.speak(say);
    }catch{}
  }
  function speak(item=current(),force=false){
    if(!item||!active||!isPlaying()||modalOpen||!settings.voice&&!force)return;
    stopVoice();const t=token;
    if(/^https:\/\//i.test(item.audioURL)){
      try{
        audio=new Audio(item.audioURL);audio.volume=.8;
        audio.onended=()=>scheduleRepeat(item,t);
        audio.onerror=()=>{if(t===token){audio=null;speech(item,t);}};
        audio.play().catch(()=>{if(t===token){audio=null;speech(item,t);}});
        return;
      }catch{}
    }
    speech(item,t);
  }
  function persistSettings(){
    try{localStorage.setItem('snow-kings:learning-settings',JSON.stringify(settings));}catch{}
  }
  function renderRibbon(){
    const item=current();
    $('learn-word').textContent=settings.showWords?item.word:'WORDS HIDDEN';
    $('learn-translation').textContent=settings.showTranslation?item.translation:'';
    $('learn-translation').hidden=!settings.showTranslation||!item.translation;
    $('learn-language').textContent=(langNames[lesson.learningLanguage.split('-')[0]]||lesson.learningLanguage).toUpperCase();
    $('learn-progress').textContent=`${index%lesson.entries.length+1} / ${lesson.entries.length}`;
    $('learn-hide').textContent=settings.showWords?'Aa':'A̶a̶';
    $('learn-hide').setAttribute('aria-label',settings.showWords?'Hide learning words':'Show learning words');
    $('learn-voice').textContent=settings.voice?'◖))':'◖×';
    $('learn-voice').setAttribute('aria-label',settings.voice?'Pause speaking':'Resume speaking');
    $('learn-translate').classList.toggle('selected',settings.showTranslation);
    $('learn-word-count').textContent=String(basket.length);
    $('lesson-summary').textContent=`${lesson.entries.length} learning steps · ${source} · ${basket.length} collected`;
  }
  function renderBasket(){
    const el=$('review-list');el.replaceChildren();
    if(!basket.length){const note=document.createElement('p');note.className='review-empty';note.textContent='Roll over glowing vocabulary beacons to add words here.';el.appendChild(note);return;}
    basket.slice().reverse().forEach((item,i)=>{
      const row=document.createElement('div');row.className='review-item';
      const label=document.createElement('div');
      const word=document.createElement('strong');word.textContent=item.word;
      const translation=document.createElement('small');translation.textContent=item.translation||item.sentenceTranslation||'';
      label.append(word,translation);
      const replay=document.createElement('button');replay.className='review-speak';replay.textContent='▶';
      replay.setAttribute('aria-label',`Pronounce ${item.word}`);
      replay.addEventListener('click',()=>speakOnce(item));row.append(label,replay);el.appendChild(row);
    });
  }
  function speakOnce(item){
    stopVoice();
    if(!settings.voice)settings.voice=true;
    if(/^https:\/\//i.test(item.audioURL)){
      try{const one=new Audio(item.audioURL);one.play().catch(()=>ttsOnce(item));return;}catch{}
    }
    ttsOnce(item);
  }
  function ttsOnce(item){
    try{const utterance=new SpeechSynthesisUtterance(item.word);utterance.lang=lesson.learningLanguage;utterance.voice=voiceFor(lesson.learningLanguage);utterance.rate=.82;
      utterance.onend=()=>{if(active&&isPlaying()&&!modalOpen&&settings.repeat)speak(current());};speechSynthesis.speak(utterance);}catch{}
  }
  function exportPayload(){return {primaryLanguage:lesson.primaryLanguage,learningLanguage:lesson.learningLanguage,words:basket.map(item=>({
    id:item.id,word:item.word,translation:item.translation,sentence:item.sentence,sentenceTranslation:item.sentenceTranslation,
    ...(item.audioURL?{audioURL:item.audioURL}:{})
  }))};}
  function exportWords({download=false}={}){
    const payload=exportPayload();
    if(download){
      if(!basket.length){$('lesson-feedback').textContent='Collect a word first.';return {ok:false,count:0};}
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download='golingo-snow-kings-words.json';document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),3000);
      $('lesson-feedback').textContent=`Exported ${basket.length} items for GoLingo.`;
    }
    return {ok:true,count:basket.length,payload};
  }
  function load(raw,{append=false}={}){
    const normalized=normalizeSnowLesson(raw);
    stopVoice();
    if(append){lesson.entries.push(...normalized.entries);lesson.originalCount+=normalized.originalCount;}
    else{lesson=normalized;basket=[];index=0;}
    source='GoLingo import';
    try{sessionStorage.setItem('snow-kings:lesson',JSON.stringify(raw));}catch{}
    renderRibbon();renderBasket();onChange(current());
    $('lesson-feedback').textContent=`✓ Loaded ${normalized.entries.length} steps in ${langNames[lesson.learningLanguage]||lesson.learningLanguage}.`;
    notify(`✦ ${normalized.originalCount} GOLINGO ITEMS LOADED`);
    if(active&&isPlaying()&&!modalOpen)speak(current());
    return {count:lesson.entries.length,learningLanguage:lesson.learningLanguage,primaryLanguage:lesson.primaryLanguage};
  }
  function collect(){
    if(!active||!isPlaying())return;
    const found={...current()};basket.push(found);
    window.SnowKingsBridge?.emit('wordAddedToBasket',{word:found.word,translation:found.translation,count:basket.length});
    index++;
    if(index>=lesson.entries.length){index=0;notify('♛ LESSON COMPLETE! REPLAYING YOUR WORDS');}
    window.SnowKingsBridge?.emit('progressChanged',{collected:basket.length,index,total:lesson.entries.length});
    stopVoice();renderRibbon();renderBasket();onChange(current());speak(current());
    return found;
  }
  function openModal(section='lesson'){
    if(modalOpen)return;
    modalOpen=true;onModalPause(true);stopVoice();
    $('learning-modal').classList.remove('hidden');
    selectSection(section);renderRibbon();renderBasket();
  }
  function closeModal(){
    if(!modalOpen)return;modalOpen=false;$('learning-modal').classList.add('hidden');onModalPause(false);
    if(active&&isPlaying())speak(current());
  }
  function selectSection(section){
    for(const name of ['lesson','basket']){
      $(`tab-${name}`).classList.toggle('active',section===name);
      $(`panel-${name}`).classList.toggle('hidden',section!==name);
    }
  }

  $('learn-hide').addEventListener('click',()=>{settings.showWords=!settings.showWords;persistSettings();renderRibbon();onChange(current());});
  $('learn-translate').addEventListener('click',()=>{settings.showTranslation=!settings.showTranslation;persistSettings();renderRibbon();onChange(current());});
  $('learn-voice').addEventListener('click',()=>{settings.voice=!settings.voice;persistSettings();renderRibbon();if(settings.voice)speak(current());else stopVoice();});
  $('learn-replay').addEventListener('click',()=>speakOnce(current()));
  $('learn-settings').addEventListener('click',()=>openModal('lesson'));
  $('learn-basket').addEventListener('click',()=>openModal('basket'));
  $('intro-lesson').addEventListener('click',()=>openModal('lesson'));
  $('close-learning').addEventListener('click',closeModal);
  $('learning-modal').addEventListener('pointerdown',event=>{if(event.target===$('learning-modal'))closeModal();});
  $('tab-lesson').addEventListener('click',()=>selectSection('lesson'));
  $('tab-basket').addEventListener('click',()=>selectSection('basket'));
  $('load-lesson').addEventListener('click',()=>{
    try{const raw=$('lesson-json').value;load(raw);$('lesson-json').value='';}catch(error){$('lesson-feedback').textContent=`⚠ ${error.message}`;}
  });
  $('demo-lesson').addEventListener('click',()=>{load(SNOW_DEMO);source='winter demo';renderRibbon();});
  $('export-lesson').addEventListener('click',()=>exportWords({download:true}));
  $('copy-lesson').addEventListener('click',async()=>{
    if(!basket.length){$('lesson-feedback').textContent='Collect words before copying.';return;}
    try{await navigator.clipboard.writeText(JSON.stringify(exportPayload(),null,2));$('lesson-feedback').textContent='Copied GoLingo JSON.';}
    catch{$('lesson-feedback').textContent='Clipboard unavailable. Use Download JSON.';}
  });
  $('lesson-file').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;
    if(file.size>120000){$('lesson-feedback').textContent='Maximum file size: 120 KB.';return;}
    $('lesson-json').value=await file.text();$('lesson-feedback').textContent=`Ready to load ${file.name}`;
  });
  window.SnowKingsBridge?.connect({importLesson:load,exportWords,getBasket:()=>exportPayload()});
  renderRibbon();renderBasket();onChange(current());
  return {
    get current(){return current();},get lesson(){return lesson;},get basket(){return basket;},get settings(){return settings;},
    load,collect,exportWords,openModal,closeModal,
    start(){active=true;if(isPlaying())speak(current());},
    pause(){stopVoice();},
    resume(){if(active&&isPlaying()&&!modalOpen)speak(current());},
    end(){active=false;stopVoice();},
    speakCurrent(){speakOnce(current());},
    updateUI:renderRibbon
  };
}
