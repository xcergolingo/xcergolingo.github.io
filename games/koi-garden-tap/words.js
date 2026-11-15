const vocabulary = {
  en:['fish','water','pond','flower','stone','rain','leaf','sun'],
  es:['pez','agua','estanque','flor','piedra','lluvia','hoja','sol'],
  ja:['魚','水','池','花','石','雨','葉','太陽'],
  fr:['poisson','eau','étang','fleur','pierre','pluie','feuille','soleil'],
  zh:['鱼','水','池塘','花','石头','雨','叶子','太阳'],
  pt:['peixe','água','lago','flor','pedra','chuva','folha','sol'],
  vi:['cá','nước','ao','hoa','đá','mưa','lá','mặt trời'],
  de:['Fisch','Wasser','Teich','Blume','Stein','Regen','Blatt','Sonne']
};
const names={en:'English',es:'Spanish',ja:'Japanese',fr:'French',zh:'Chinese',pt:'Portuguese',vi:'Vietnamese',de:'German'};
const locales={en:'en-US',es:'es-ES',ja:'ja-JP',fr:'fr-FR',zh:'zh-CN',pt:'pt-BR',vi:'vi-VN',de:'de-DE'};
export function starter(learning='es',primary='en'){
  return normalizeDeck({learningLanguage:locales[learning],primaryLanguage:locales[primary],words:vocabulary[learning].map((word,i)=>({id:`pond-${i+1}`,word,translation:vocabulary[primary][i]}))});
}
function lang(s){try{return Intl.getCanonicalLocales(s)[0]||null;}catch{return null;}}
export function normalizeDeck(value){
  if(!value||!Array.isArray(value.words)||!value.words.length||value.words.length>500)throw Error('Use a deck with 1 to 500 words.');
  const learningLanguage=lang(value.learningLanguage),primaryLanguage=lang(value.primaryLanguage);
  if(!learningLanguage||!primaryLanguage)throw Error('Use language codes such as ja, es-ES or en-US.');
  const get=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
  const used=new Set();
  const words=value.words.map((entry,i)=>{
    const word=get(entry?.word,250),translation=get(entry?.translation,350);
    if(!word||!translation)throw Error(`Entry ${i+1} needs a word and a translation.`);
    let id=get(String(entry.id??i+1),120);
    while(used.has(id))id+='-'+(i+1);
    used.add(id);
    const row={id,word,translation};
    for(const key of ['sentence','sentenceTranslation','audioURL','audioUrl','wordAudioUrl']){const v=get(entry[key],2000);if(v)row[key]=v;}
    return row;
  });
  return {learningLanguage,primaryLanguage,words};
}
export function parseDeck(input,learning,primary){
  const s=input.trim();
  if(s.startsWith('{')||s.startsWith('['))return normalizeDeck(JSON.parse(s));
  return normalizeDeck({learningLanguage:learning,primaryLanguage:primary,words:s.split(/\r?\n/).filter(l=>l.trim()).map(line=>{const at=line.indexOf('|');return at<0?{word:line}:{word:line.slice(0,at),translation:line.slice(at+1)};})});
}
export function createLesson(onDeckChange){
  const $=id=>document.getElementById(id), host=$('experience');let mode=true,repeat=true,active=null,timer=0,watchdog=0,serial=0,playing=false,audio=null;
  const synth=window.speechSynthesis;
  let deck=starter(),saved=null, basket=new Set();
  try{saved=JSON.parse(localStorage.getItem('koi-golingo-v1'));if(saved?.deck){deck=normalizeDeck(saved.deck);basket=new Set((saved.basket||[]).filter(id=>deck.words.some(w=>w.id===id)));}}catch{}
  function persist(){try{localStorage.setItem('koi-golingo-v1',JSON.stringify({deck,basket:[...basket]}));}catch{}}
  function progress(){
    $('lessonProgress').textContent=`${basket.size} / ${deck.words.length} collected`;
    $('basketBtn').textContent=`Basket · ${basket.size}`;
  }
  function stop(){serial++;clearTimeout(timer);clearTimeout(watchdog);synth?.cancel();if(audio){audio.pause();audio=null;}playing=false;$('voiceBtn').textContent='▶ Hear word';}
  function speak(){
    stop();if(!active||!mode)return;
    const current=serial, entry=active;
    playing=true;$('voiceBtn').textContent='Ⅱ Pause';$('wordMessage').textContent='';
    let clip=null;
    try{const url=new URL(entry.audioURL||entry.audioUrl||entry.wordAudioUrl);if(url.protocol==='https:')clip=url.href;}catch{}
    function finished(){if(serial!==current)return;clearTimeout(watchdog);if(repeat)timer=setTimeout(play,1800);else stop();}
    function play(){
      if(serial!==current||!playing||entry!==active||document.hidden)return;
      if(clip){
        const node=new Audio(clip);audio=node;node.onended=finished;
        const fallback=()=>{if(serial!==current||audio!==node||!clip)return;clearTimeout(watchdog);node.pause();audio=null;clip=null;play();};
        node.onerror=fallback;watchdog=setTimeout(fallback,12000);node.play().catch(fallback);return;
      }
      if(!synth||!window.SpeechSynthesisUtterance){stop();$('wordMessage').textContent='Speech is unavailable in this browser.';return;}
      const u=new SpeechSynthesisUtterance(entry.word);u.lang=deck.learningLanguage;u.rate=.82;
      const voice=synth.getVoices().find(v=>v.lang.toLowerCase()===u.lang.toLowerCase());if(voice)u.voice=voice;
      u.onend=finished;
      u.onerror=()=>{if(serial!==current)return;stop();$('wordMessage').textContent='Voice did not play. Tap Hear word to try again.';};
      watchdog=setTimeout(()=>{if(serial===current){stop();$('wordMessage').textContent='Voice did not play. Tap Hear word to try again.';}},12000);
      synth.speak(u);
    }
    play();
  }
  function resetWord(){stop();active=null;$('wordCard').hidden=true;}
  function loadDeck(next){deck=normalizeDeck(next);basket=new Set();resetWord();persist();progress();onDeckChange();}
  function show(fish){
    const entry=fish.lessonWord;if(!entry)return;
    active=entry;basket.add(entry.id);persist();progress();
    $('lessonWord').textContent=entry.word;$('lessonWord').lang=deck.learningLanguage;
    $('lessonTranslation').textContent=entry.translation;$('lessonTranslation').lang=deck.primaryLanguage;
    $('wordCard').hidden=false;$('wordMessage').textContent='';speak();
  }
  for(const [code,name] of Object.entries(names)){for(const id of ['learnPreset','primaryPreset'])$(id).add(new Option(name,code));}
  $('learnPreset').value='es';$('primaryPreset').value='en';
  $('presetBtn').onclick=()=>{loadDeck(starter($('learnPreset').value,$('primaryPreset').value));$('deckDialog').close();};
  $('importBtn').onclick=()=>{try{loadDeck(parseDeck($('deckInput').value,$('learnCode').value.trim(),$('primaryCode').value.trim()));$('deckDialog').close();}catch(e){$('deckError').textContent=e instanceof SyntaxError?'This JSON could not be read. Check its format.':e.message;}};
  $('deckBtn').onclick=()=>{stop();$('deckError').textContent='';$('learnCode').value=deck.learningLanguage;$('primaryCode').value=deck.primaryLanguage;$('deckDialog').showModal();};
  $('basketBtn').onclick=()=>{stop();const list=$('basketList');list.replaceChildren();for(const w of deck.words.filter(w=>basket.has(w.id))){const li=document.createElement('li'),label=document.createElement('strong');label.textContent=w.word;label.lang=deck.learningLanguage;li.append(label,document.createTextNode(' — '+w.translation));list.append(li);} $('emptyBasket').hidden=Boolean(basket.size);$('exportBtn').disabled=!basket.size;$('resetHunt').disabled=!basket.size;$('basketDialog').showModal();};
  $('exportBtn').onclick=()=>{const data={...deck,words:deck.words.filter(w=>basket.has(w.id))};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='GoLingo-Koi-Basket.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);};
  $('resetHunt').onclick=()=>{basket.clear();resetWord();persist();progress();onDeckChange();$('basketDialog').close();};
  $('voiceBtn').onclick=()=>playing?stop():speak();
  $('repeatBtn').onclick=()=>{repeat=!repeat;$('repeatBtn').setAttribute('aria-pressed',String(repeat));$('repeatBtn').textContent=repeat?'Repeat on':'Repeat off';if(active){if(repeat)speak();else stop();}};
  $('wordClose').onclick=resetWord;
  $('modeBtn').onclick=()=>{mode=!mode;host.classList.toggle('learning-mode',mode);$('modeBtn').textContent=mode?'Pond mode':'Word hunt';$('modeBtn').setAttribute('aria-pressed',String(mode));resetWord();if(mode)onDeckChange();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  window.addEventListener('pagehide',stop);
  window.GoLingoKoi={loadDeck(value){try{loadDeck(typeof value==='string'?JSON.parse(value):value);return true;}catch{return false;}}};
  try{const packed=new URLSearchParams(location.hash.slice(1)).get('data')||new URLSearchParams(location.search).get('data');if(packed){const linked=normalizeDeck(JSON.parse(packed));if(JSON.stringify(linked)!==JSON.stringify(deck)){deck=linked;basket=new Set();persist();}}}catch{$('lessonProgress').title='The linked deck could not be read.';}
  host.classList.add('learning-mode');progress();
  return {isActive:()=>mode, words:()=>deck.words, nextWords:()=>deck.words.filter(w=>!basket.has(w.id)), show, stop, resetWord};
}
