/** GoLingo lessons, speech and vocabulary collection. No remote dependencies. */
export const LANGUAGES = [
  ['en','English','en-US'],['zh','中文','zh-CN'],['ja','日本語','ja-JP'],['vi','Tiếng Việt','vi-VN'],['es','Español','es-ES'],['pt','Português','pt-BR'],['fr','Français','fr-FR'],['de','Deutsch','de-DE'],['it','Italiano','it-IT'],['ko','한국어','ko-KR'],['ar','العربية','ar-SA'],['hi','हिन्दी','hi-IN'],['ru','Русский','ru-RU'],['th','ไทย','th-TH'],['uk','Українська','uk-UA']
];
const SAMPLE_ROWS = {
 es:[['la montaña rusa','roller coaster','La montaña rusa es muy rápida.','The roller coaster is very fast.'],['el parque','park','Vamos al parque juntos.','Let’s go to the park together.'],['el cielo','sky','El cielo está azul.','The sky is blue.'],['el mar','sea','Puedo ver el mar.','I can see the sea.'],['el sol','sun','El sol brilla hoy.','The sun is shining today.'],['el boleto','ticket','Tengo mi boleto.','I have my ticket.'],['el asiento','seat','Este es mi asiento.','This is my seat.'],['el cinturón','seat belt','Abrocha el cinturón.','Fasten your seat belt.'],['la rueda de la fortuna','Ferris wheel','La rueda de la fortuna es alta.','The Ferris wheel is tall.'],['el árbol','tree','Hay un árbol junto al camino.','There is a tree beside the path.'],['la playa','beach','La playa está cerca.','The beach is nearby.'],['el agua','water','Quiero un poco de agua.','I want some water.'],['rápido','fast','Vamos muy rápido.','We are going very fast.'],['despacio','slowly','Vamos más despacio.','Let’s go more slowly.'],['arriba','up','Mira hacia arriba.','Look up.'],['abajo','down','Ahora vamos hacia abajo.','Now we are going down.'],['la sonrisa','smile','Tienes una gran sonrisa.','You have a big smile.'],['otra vez','again','Quiero subir otra vez.','I want to ride again.']],
 ja:[['ジェットコースター','roller coaster','ジェットコースターは速いです。','The roller coaster is fast.'],['公園','park','一緒に公園に行きましょう。','Let’s go to the park together.'],['空','sky','空は青いです。','The sky is blue.'],['海','sea','海が見えます。','I can see the sea.'],['太陽','sun','太陽が輝いています。','The sun is shining.'],['切符','ticket','切符を持っています。','I have my ticket.'],['席','seat','ここが私の席です。','This is my seat.'],['シートベルト','seat belt','シートベルトを締めてください。','Please fasten your seat belt.'],['観覧車','Ferris wheel','観覧車は高いです。','The Ferris wheel is tall.'],['木','tree','道のそばに木があります。','There is a tree beside the path.'],['浜辺','beach','浜辺は近くにあります。','The beach is nearby.'],['水','water','水を少しください。','Please give me some water.'],['速い','fast','とても速いです。','It is very fast.'],['ゆっくり','slowly','ゆっくり進みましょう。','Let’s go slowly.'],['上','up','上を見てください。','Please look up.'],['下','down','今から下に行きます。','Now we are going down.'],['笑顔','smile','すてきな笑顔ですね。','You have a lovely smile.'],['もう一度','again','もう一度乗りたいです。','I want to ride again.']],
 zh:[['过山车','roller coaster','过山车开得很快。','The roller coaster goes very fast.'],['公园','park','我们一起去公园吧。','Let’s go to the park together.'],['天空','sky','天空是蓝色的。','The sky is blue.'],['大海','sea','我能看到大海。','I can see the sea.'],['太阳','sun','今天阳光灿烂。','The sun is shining today.'],['门票','ticket','我有门票。','I have my ticket.'],['座位','seat','这是我的座位。','This is my seat.'],['安全带','seat belt','请系好安全带。','Please fasten your seat belt.'],['摩天轮','Ferris wheel','摩天轮很高。','The Ferris wheel is tall.'],['树','tree','路边有一棵树。','There is a tree beside the path.'],['海滩','beach','海滩就在附近。','The beach is nearby.'],['水','water','我想喝点水。','I want some water.'],['快','fast','我们开得很快。','We are going very fast.'],['慢','slow','请慢一点。','Please go a little more slowly.'],['上面','up','请往上看。','Please look up.'],['下面','down','我们现在往下走。','Now we are going down.'],['微笑','smile','你的微笑真好看。','You have a lovely smile.'],['再来一次','again','我想再坐一次。','I want to ride again.']],
 fr:[['les montagnes russes','roller coaster','Les montagnes russes vont très vite.','The roller coaster goes very fast.'],['le parc','park','Allons au parc ensemble.','Let’s go to the park together.'],['le ciel','sky','Le ciel est bleu.','The sky is blue.'],['la mer','sea','Je peux voir la mer.','I can see the sea.'],['le soleil','sun','Le soleil brille aujourd’hui.','The sun is shining today.'],['le billet','ticket','J’ai mon billet.','I have my ticket.'],['le siège','seat','Voici mon siège.','This is my seat.'],['la ceinture','seat belt','Attache ta ceinture.','Fasten your seat belt.'],['la grande roue','Ferris wheel','La grande roue est haute.','The Ferris wheel is tall.'],['l’arbre','tree','Il y a un arbre près du chemin.','There is a tree beside the path.'],['la plage','beach','La plage est tout près.','The beach is nearby.'],['l’eau','water','Je voudrais un peu d’eau.','I would like some water.'],['rapide','fast','Ce manège est rapide.','This ride is fast.'],['doucement','slowly','Allons plus doucement.','Let’s go more slowly.'],['en haut','up','Regarde en haut.','Look up.'],['en bas','down','Nous descendons maintenant.','We are going down now.'],['le sourire','smile','Tu as un grand sourire.','You have a big smile.'],['encore','again','Je veux refaire un tour.','I want to ride again.']]
};
const text = (v,max=2000) => typeof v==='string'||typeof v==='number' ? String(v).trim().slice(0,max) : '';
const pick = (o,keys) => keys.map(k=>text(o?.[k])).find(Boolean)||'';
const MAX_ITEMS=1000, MAX_PAYLOAD=1024*1024;
const STORAGE='suncoast-learning-v1', BASKET='suncoast-vocabulary-v1';
export function languageCode(value,fallback='en') {
  const name=text(value,60).toLowerCase();
  const aliases={english:'en',chinese:'zh',mandarin:'zh','zh-hans':'zh','zh-hant':'zh',japanese:'ja',vietnamese:'vi',spanish:'es',portuguese:'pt',french:'fr',german:'de',italian:'it',korean:'ko',arabic:'ar',hindi:'hi',russian:'ru',thai:'th',ukrainian:'uk'};
  const code=aliases[name]||LANGUAGES.find(l=>l[1].toLowerCase()===name)?.[0]||name.split(/[-_]/)[0];
  return /^[a-z]{2,3}$/.test(code)?code:fallback;
}
export function safeAudioUrl(value,base='https://example.invalid/') {
  const raw=text(value,3000);if(!raw)return '';
  try{const u=new URL(raw,base),b=new URL(base);if(u.username||u.password)return '';if(u.protocol==='https:'||(u.protocol==='http:'&&u.origin===b.origin))return u.href;}catch{}
  return '';
}
function audioValue(o,keys,base){for(const key of keys){const value=o?.[key];const url=safeAudioUrl(typeof value==='object'?(value?.url||value?.src):value,base);if(url)return url;}return '';}
export function normalizeLesson(input,defaults={}) {
  let data=input;let depth=0;const envelopes=[];
  while(depth++<5){
    if(typeof data==='string'){if(data.length>MAX_PAYLOAD)throw new Error('This lesson is too large. Please use a file under 1 MB.');try{data=JSON.parse(data);}catch{throw new Error('The lesson JSON is not valid. Check the brackets and quotation marks.');}continue;}
    if(Array.isArray(data))break;
    if(data&&typeof data==='object'&&!['words','sentences','phrases','items','entries'].some(k=>Array.isArray(data[k]))){const next=['payload','lesson','data','learningData','golingoData','content'].map(k=>data[k]).find(v=>typeof v==='string'||(v&&typeof v==='object'));if(next){envelopes.unshift(data);data=next;continue;}}
    break;
  }
  if(!data||typeof data!=='object')throw new Error('Please include a words or sentences array.');
  const metadata=[data,...envelopes],field=keys=>metadata.map(o=>pick(o,keys)).find(Boolean)||'';
  const learningLanguage=languageCode(field(['learningLanguage','targetLanguage','learningLang','language','lang']),languageCode(defaults.learningLanguage,'es'));
  const primaryLanguage=languageCode(field(['primaryLanguage','translationLanguage','sourceLanguage','primaryLang','baseLanguage']),languageCode(defaults.primaryLanguage,'en'));
  const base=defaults.baseUrl||'https://example.invalid/';
  const words=[],sentences=[],seen=new Set();
  const push=(item,kind)=>{
    if(words.length+sentences.length>=MAX_ITEMS)return;
    let o=typeof item==='string'?{text:item}:item;
    if(!o||typeof o!=='object')return;
    if(Array.isArray(o)){o={text:o[0],translation:o[1],sentence:o[2],sentenceTranslation:o[3]};}
    let value=pick(o,kind==='sentence'?['sentence','sentenceText','text','phrase','learningText','targetText','original','content','word']:['word','text','term','learningText','targetText','original','value','content']);
    if(!value&&kind==='word'&&o.sentence){kind='sentence';value=text(o.sentence);}
    if(!value)return;
    const unique=kind+'|'+value;if(seen.has(unique))return;seen.add(unique);
    const translation=pick(o,kind==='sentence'?['sentenceTranslation','translation','translatedText','primaryText','meaning','english','translationText']:['translation','wordTranslation','translatedText','primaryText','meaning','english','definition','translationText']);
    const id=pick(o,['id','wordId','sentenceId','uuid'])||String(words.length+sentences.length+1);
    const audioUrl=audioValue(o,kind==='sentence'?['sentenceAudioUrl','sentenceAudioURL','audioUrl','audioURL','audio','audioSrc','soundUrl']:['audioUrl','audioURL','wordAudioUrl','wordAudioURL','audio','audioSrc','soundUrl'],base);
    if(kind==='sentence')sentences.push({id,sentence:value,sentenceTranslation:translation,...(audioUrl?{audioUrl}: {})});
    else{const sentence=pick(o,['sentence','exampleSentence','example','sentenceText']);const sentenceTranslation=pick(o,['sentenceTranslation','exampleTranslation','translatedSentence']);const sentenceAudioUrl=audioValue(o,['sentenceAudioUrl','sentenceAudioURL','sentenceAudio','exampleAudioUrl'],base);words.push({id,word:value,translation,...(sentence?{sentence,sentenceTranslation}:{}),...(audioUrl?{audioUrl}:{}),...(sentenceAudioUrl?{sentenceAudioUrl}:{})});}
  };
  if(Array.isArray(data))data.slice(0,MAX_ITEMS).forEach(item=>push(item,item&&typeof item==='object'&&!item.word&&item.sentence?'sentence':'word'));
  else{(data.words||[]).slice?.(0,MAX_ITEMS).forEach?.(v=>push(v,'word'));(data.sentences||[]).slice?.(0,MAX_ITEMS).forEach?.(v=>push(v,'sentence'));for(const key of ['phrases','items','entries'])if(Array.isArray(data[key]))data[key].slice(0,MAX_ITEMS).forEach(v=>push(v,key==='phrases'||(v&&typeof v==='object'&&!v.word&&v.sentence)?'sentence':'word'));}
  if(!words.length&&!sentences.length)throw new Error('No words or sentences were found. Add text to at least one entry.');
  return {title:field(['title','name','lessonName'])||'My GoLingo lesson',learningLanguage,primaryLanguage,words,sentences,source:'import'};
}
export function parseLessonText(value,languages={}) {
  const source=text(value,MAX_PAYLOAD+1);if(source.length>MAX_PAYLOAD)throw new Error('Please use a lesson under 1 MB.');
  if(/^[\[{]/.test(source))return normalizeLesson(source,languages);
  const words=source.split(/\r?\n/).filter(line=>line.trim()).slice(0,MAX_ITEMS).map((line,i)=>{const [pair,sentence='',sentenceTranslation='']=line.split('|');const marker=pair.indexOf('=');return {id:String(i+1),word:(marker<0?pair:pair.slice(0,marker)).trim(),translation:marker<0?'':pair.slice(marker+1).trim(),sentence:sentence.trim(),sentenceTranslation:sentenceTranslation.trim()};});
  return normalizeLesson({words,learningLanguage:languages.learningLanguage,primaryLanguage:languages.primaryLanguage},languages);
}
export function sampleLesson(language='es') {
  const rows=SAMPLE_ROWS[language];if(!rows)return null;
  return {title:'A day at the theme park',learningLanguage:language,primaryLanguage:'en',source:'sample',words:rows.map((r,i)=>({id:'park-'+language+'-'+(i+1),word:r[0],translation:r[1],sentence:r[2],sentenceTranslation:r[3]})),sentences:[]};
}
function entriesFor(lesson,practice) {
  const entries=practice==='words'?lesson.words.map(w=>({...w,kind:'word',text:w.word})):lesson.sentences.map(s=>({...s,kind:'sentence',text:s.sentence,translation:s.sentenceTranslation})).concat(lesson.words.filter(w=>w.sentence).map(w=>({...w,kind:'sentence',text:w.sentence,translation:w.sentenceTranslation,audioUrl:w.sentenceAudioUrl})));
  const seen=new Set();return entries.filter(e=>{e.key=[lesson.learningLanguage,lesson.primaryLanguage,e.kind,e.text].join('|');if(seen.has(e.key))return false;seen.add(e.key);return true;});
}
const languageName=code=>LANGUAGES.find(l=>l[0]===code)?.[1]||code;
function shuffle(values){const out=[...values];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
function readSaved(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
function save(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}

export function createLearning({mount,onChange=()=>{},onPause=()=>{},onResume=()=>{},onToast=()=>{}}={}) {
  let lesson=sampleLesson('es');
  const saved=readSaved(STORAGE);
  let settings={showCard:true,showTranslation:true,repeat:true,voiceOn:true,practice:'words',volume:.85};
  if(saved?.settings){for(const k of ['showCard','showTranslation','repeat','voiceOn'])if(typeof saved.settings[k]==='boolean')settings[k]=saved.settings[k];if(['words','sentences'].includes(saved.settings.practice))settings.practice=saved.settings.practice;if(Number.isFinite(saved.settings.volume))settings.volume=Math.max(0,Math.min(1,saved.settings.volume));}
  if(saved?.lesson)try{lesson=normalizeLesson(saved.lesson,{baseUrl:location.href});lesson.source=saved.lesson.source==='sample'?'sample':'import';}catch{}
  let basket=Array.isArray(readSaved(BASKET))?readSaved(BASKET).slice(0,MAX_ITEMS).filter(e=>e&&typeof e.text==='string'&&typeof e.key==='string'):[];
  let running=false,unlocked=false,visible=false,current=null,deck=[],cursor=0,lastFirst='',speechToken=0,repeatTimer=0,player=null,utterance=null,modalOpen=false,modalResume=false,pausingInternally=false,previousFocus=null,voices=[];
  let selectedLearning=lesson.learningLanguage,selectedPrimary=lesson.primaryLanguage;
  const root=document.createElement('div');root.className='gl-root';root.innerHTML=`
    <aside id="gl-word-card" class="gl-card" hidden aria-label="Current GoLingo vocabulary">
      <div class="gl-card-top"><span class="gl-card-kicker">GOLINGO · WORD</span><div class="gl-card-actions"><button class="gl-translation-toggle" type="button" title="Show or hide translation" aria-label="Show or hide translation">Aa</button><button class="gl-card-hide" type="button" title="Hide word card (V)" aria-label="Hide word card" aria-controls="gl-word-card"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg><span>Hide</span></button></div></div>
      <button class="gl-word-button" type="button" aria-label="Replay this word"><span class="gl-current-text" dir="auto">Your next word is ahead.</span><span class="gl-current-translation" dir="auto"></span></button>
      <div class="gl-card-bottom"><span class="gl-speech-hint">TAP THE WORD TO HEAR IT</span><button class="gl-example" type="button">Example ↗</button><button class="gl-card-settings" type="button" aria-label="Lesson settings" title="Lesson settings">⚙</button><button class="gl-card-basket" type="button" aria-label="Collected vocabulary" title="Collected vocabulary">☷ <span>0</span></button></div>
    </aside>
    <div class="gl-dock" hidden role="group" aria-label="Vocabulary controls">
      <button class="gl-card-show" type="button" title="Show word card (V)" aria-label="Show word card" aria-controls="gl-word-card" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg><span>Show words</span></button>
      <button class="gl-dock-replay" type="button" title="Replay current word" aria-label="Replay current word"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m11 5-5 4H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg></button>
      <button class="gl-dock-settings" type="button" title="Lesson settings" aria-label="Lesson settings"><span>Lesson</span></button>
      <button class="gl-dock-basket" type="button" title="Collected vocabulary" aria-label="Collected vocabulary"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8Zm3 0V6a4 4 0 0 1 8 0v2"/></svg><span>0</span></button>
    </div>
    <div class="gl-backdrop" hidden>
      <section class="gl-dialog" role="dialog" aria-modal="true" aria-labelledby="gl-dialog-title" tabindex="-1">
        <button class="gl-close" type="button" aria-label="Close learning panel">×</button><div class="gl-eyebrow">GOLINGO · LEARN ON THE RIDE</div><h2 id="gl-dialog-title">Your words. Your adventure.</h2>
        <div class="gl-tabs" role="tablist"><button type="button" data-panel="settings" role="tab">Lesson</button><button type="button" data-panel="basket" role="tab">Collected <span class="gl-basket-count">0</span></button></div>
        <div class="gl-settings-panel">
          <div class="gl-current-lesson"><b></b><span></span></div>
          <fieldset class="gl-practice"><legend>Practice on this ride</legend><label><input type="radio" name="gl-practice" value="words"> Words</label><label><input type="radio" name="gl-practice" value="sentences"> Sentences</label></fieldset>
          <div class="gl-options"><label><span>Show word card</span><input type="checkbox" data-setting="showCard"></label><label><span>Show translations</span><input type="checkbox" data-setting="showTranslation"></label><label><span>Repeat until the next word</span><input type="checkbox" data-setting="repeat"></label><label><span>Speak learning words</span><input type="checkbox" data-setting="voiceOn"></label><label class="gl-volume"><span>Speech volume</span><input type="range" min="0" max="1" step="0.05" aria-label="Speech volume"></label></div>
          <h3>Choose or import a lesson</h3><p class="gl-note">These languages apply to your next import. Your current lesson keeps its own language labels.</p>
          <div class="gl-language-row"><label>Learning language<select class="gl-learning-language"></select></label><label>Translation language<select class="gl-primary-language"></select></label></div>
          <button class="gl-sample gl-secondary" type="button">Use theme-park sample</button><p class="gl-sample-note gl-note"></p>
          <label class="gl-import-label" for="gl-import">Paste GoLingo JSON or one entry per line</label><textarea id="gl-import" rows="4" spellcheck="false" placeholder="el cielo = sky | El cielo está azul. | The sky is blue."></textarea>
          <div class="gl-import-actions"><button class="gl-import-button gl-primary" type="button">Load my lesson ↗</button><label class="gl-file-label">Choose file<input class="gl-file" type="file" accept=".json,.txt,application/json,text/plain"></label></div>
          <p class="gl-feedback" role="status" aria-live="polite"></p>
        </div>
        <div class="gl-basket-panel" hidden><p class="gl-basket-intro"></p><div class="gl-basket-list"></div><div class="gl-basket-actions"><button class="gl-export gl-primary" type="button">Save JSON ↓</button><button class="gl-copy gl-secondary" type="button">Copy JSON</button><button class="gl-clear gl-secondary" type="button">Clear</button></div><div class="gl-export-fallback" hidden><label class="gl-import-label" for="gl-export-text">GoLingo JSON · tap to select and copy</label><textarea id="gl-export-text" rows="5" readonly spellcheck="false" aria-label="Collected GoLingo vocabulary JSON"></textarea></div><p class="gl-basket-feedback gl-feedback" role="status"></p></div>
        <a class="gl-cta" href="https://www.golingoapp.com" target="_self">GoLingoApp.com · Download to practice in the real world ↗</a>
      </section>
    </div>`;
  document.body.append(root);
  const $=sel=>root.querySelector(sel);
  const card=$('.gl-card'),dock=$('.gl-dock'),backdrop=$('.gl-backdrop'),dialog=$('.gl-dialog'),learningSelect=$('.gl-learning-language'),primarySelect=$('.gl-primary-language');
  for(const [code,name] of LANGUAGES)for(const select of [learningSelect,primarySelect]){const option=document.createElement('option');option.value=code;option.textContent=name;select.append(option);}
  const summary=document.createElement('div');summary.className='gl-menu-summary';summary.innerHTML='<button type="button" class="gl-menu-lesson"><span class="gl-menu-mark">✦</span><span><b></b><small></small></span><i>↗</i></button><button type="button" class="gl-menu-basket" aria-label="Collected vocabulary">☷ <span>0</span></button>';
  if(typeof mount==='string')mount=document.querySelector(mount);if(mount?.append)mount.append(summary);
  function persist(){save(STORAGE,{lesson,settings});}
  function filteredBasket(){return basket.filter(e=>e.learningLanguage===lesson.learningLanguage&&e.primaryLanguage===lesson.primaryLanguage);}
  function refreshVoices(){try{voices=window.speechSynthesis?.getVoices()||[];}catch{voices=[];}}
  refreshVoices();window.speechSynthesis?.addEventListener?.('voiceschanged',refreshVoices);
  function stopSpeech(){speechToken++;clearTimeout(repeatTimer);repeatTimer=0;if(player){player.pause();player.onended=null;player.onerror=null;player.removeAttribute('src');player.load();player=null;}if(utterance){utterance.onend=null;utterance.onerror=null;utterance=null;}try{window.speechSynthesis?.cancel();}catch{}}
  function hint(value){$('.gl-speech-hint').textContent=value;}
  function speak(entry,{example=false,manual=false,loop=false}={}) {
    stopSpeech();if(!entry||(!manual&&(!running||!unlocked||!settings.voiceOn)))return;
    if(manual)unlocked=true;
    const token=speechToken;
    const spoken=example?(entry.sentence||entry.text):entry.text;
    const url=example?(entry.sentenceAudioUrl|| (entry.kind==='sentence'?entry.audioUrl:'')):entry.audioUrl;
    const lang=entry.learningLanguage||lesson.learningLanguage;
    const repeat=()=>{if(token!==speechToken)return;hint(settings.repeat&&running?'REPEATING UNTIL THE NEXT GATE':'TAP THE WORD TO HEAR IT');if(loop&&settings.repeat&&running&&settings.voiceOn&&current?.key===entry.key)repeatTimer=setTimeout(()=>speak(entry,{loop:true}),entry.kind==='sentence'?1250:900);};
    const blocked=()=>{if(token===speechToken)hint('TAP THE WORD TO HEAR IT');};
    let usedTTS=false;const tts=()=>{
      if(token!==speechToken||usedTTS)return;usedTTS=true;if(player){player.onended=null;player.onerror=null;player.pause();player=null;}
      if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){blocked();return;}
      refreshVoices();const phrase=new SpeechSynthesisUtterance(spoken);utterance=phrase;const locale=LANGUAGES.find(l=>l[0]===lang)?.[2]||lang;phrase.lang=locale;phrase.rate=(entry.kind==='sentence'||example)? .86 : .82;phrase.volume=settings.volume;
      const voice=voices.find(v=>v.lang.toLowerCase()===locale.toLowerCase())||voices.find(v=>v.lang.toLowerCase().split('-')[0]===lang);if(voice)phrase.voice=voice;
      phrase.onend=repeat;phrase.onerror=blocked;hint(example?'LISTEN TO THE EXAMPLE':'LISTEN & REPEAT');try{window.speechSynthesis.resume();window.speechSynthesis.speak(phrase);}catch{blocked();}
    };
    if(url){const clean=safeAudioUrl(url,location.href);if(clean){player=new Audio(clean);const active=player;active.volume=settings.volume;active.onended=repeat;active.onerror=tts;hint(example?'LISTEN TO THE EXAMPLE':'LISTEN & REPEAT');active.play().catch(()=>{if(token===speechToken)tts();});return;}}
    tts();
  }
  function refreshCard(){
    card.hidden=!visible||!settings.showCard;dock.hidden=!visible||settings.showCard;
    $('.gl-card-show').setAttribute('aria-expanded',String(settings.showCard));$('.gl-card-hide').setAttribute('aria-expanded',String(settings.showCard));
    $('.gl-current-text').textContent=current?.text||'Your next word is ahead.';$('.gl-current-text').lang=lesson.learningLanguage;
    $('.gl-current-translation').textContent=current?.translation||'';$('.gl-current-translation').lang=lesson.primaryLanguage;$('.gl-current-translation').hidden=!settings.showTranslation||!current?.translation;
    $('.gl-card-kicker').textContent=`GOLINGO · ${languageName(lesson.learningLanguage)} · ${current?.kind==='sentence'?'SENTENCE':'WORD'}`;
    $('.gl-translation-toggle').setAttribute('aria-pressed',String(settings.showTranslation));$('.gl-example').hidden=!current?.sentence||current.kind==='sentence';
    $('.gl-word-button').disabled=!current;$('.gl-dock-replay').disabled=!current;
    const replayLabel=current?.kind==='sentence'?'Replay current sentence':'Replay current word';$('.gl-dock-replay').setAttribute('aria-label',replayLabel);$('.gl-dock-replay').title=replayLabel;
    const count=filteredBasket().length;$('.gl-card-basket span').textContent=count;$('.gl-dock-basket span').textContent=count;summary.querySelector('.gl-menu-basket span').textContent=count;$('.gl-basket-count').textContent=count;
  }
  function sync(){
    const count=entriesFor(lesson,settings.practice).length;summary.querySelector('b').textContent=`${languageName(lesson.learningLanguage)} → ${languageName(lesson.primaryLanguage)}`;summary.querySelector('small').textContent=`${count} ${settings.practice} · change lesson`;
    $('.gl-current-lesson b').textContent=lesson.title;$('.gl-current-lesson span').textContent=`${languageName(lesson.learningLanguage)} → ${languageName(lesson.primaryLanguage)} · ${lesson.words.length} words · ${entriesFor(lesson,'sentences').length} sentences`;
    for(const [select,code] of [[learningSelect,selectedLearning],[primarySelect,selectedPrimary]]){if(![...select.options].some(o=>o.value===code)){const option=document.createElement('option');option.value=code;option.textContent=code;select.append(option);}select.value=code;}
    for(const input of root.querySelectorAll('[data-setting]'))input.checked=settings[input.dataset.setting];for(const input of root.querySelectorAll('[name="gl-practice"]')){input.checked=input.value===settings.practice;input.disabled=!entriesFor(lesson,input.value).length;}
    $('.gl-volume input').value=settings.volume;const canSample=!!SAMPLE_ROWS[selectedLearning]&&selectedPrimary==='en';$('.gl-sample').disabled=!canSample;$('.gl-sample-note').textContent=canSample?'A fresh sample with theme-park words and example sentences.':'Samples are available in Spanish, Japanese, Chinese and French with English translations. Import your own lesson for this pair.';
    refreshCard();
  }
  function makeDeck(){let pool=entriesFor(lesson,settings.practice);if(!pool.length){settings.practice=lesson.words.length?'words':'sentences';pool=entriesFor(lesson,settings.practice);}deck=shuffle(pool);if(deck.length>1&&deck[0].key===lastFirst)[deck[0],deck[1]]=[deck[1],deck[0]];lastFirst=deck[0]?.key||'';cursor=0;}
  function beginRide(){stopSpeech();current=null;makeDeck();refreshCard();hint('TAP THE WORD TO HEAR IT');}
  function nextBatch(count){const result=[];const n=Math.max(0,Math.min(100,Math.floor(Number(count)||0)));for(let i=0;i<n;i++){if(cursor>=deck.length)makeDeck();if(!deck.length)break;result.push({...deck[cursor++]});}return result;}
  function collect(entry){const pair={learningLanguage:lesson.learningLanguage,primaryLanguage:lesson.primaryLanguage};if(!basket.some(e=>e.key===entry.key)){if(basket.length<MAX_ITEMS){basket.push({...entry,...pair});save(BASKET,basket);}else onToast('Your vocabulary basket is full.','Export and clear it to collect more.');}}
  function present(entry,{collect:shouldCollect=true}={}){if(!entry)return;current={...entry};if(shouldCollect)collect(current);refreshCard();if(running)speak(current,{loop:true});}
  function setRunning(value){running=!!value;if(!running){if(modalOpen&&!pausingInternally)modalResume=false;stopSpeech();}else if(current&&!modalOpen)speak(current,{loop:true});}
  function setVisible(value){visible=!!value;refreshCard();}
  // Card visibility is a display preference: never touch the speech loop or lesson deck.
  function setCardVisible(value){
    const show=!!value;if(show===settings.showCard)return show;
    const active=document.activeElement,oldControls=show?dock:card;
    const restoreFocus=[...oldControls.querySelectorAll('button')].includes(active);
    settings.showCard=show;persist();sync();notify('visibility');
    if(restoreFocus&&visible&&!modalOpen)(show?$('.gl-card-hide'):$('.gl-card-show')).focus();
    return show;
  }
  function toggleCard(){return setCardVisible(!settings.showCard);}
  function unlock(){unlocked=true;try{window.speechSynthesis?.resume();}catch{}if(current&&running)speak(current,{loop:true});return true;}
  function notify(reason){onChange({reason,lesson,settings:{...settings}});}
  function applyLesson(value,defaults={}){
    const next=normalizeLesson(value,{learningLanguage:selectedLearning,primaryLanguage:selectedPrimary,baseUrl:location.href,...defaults});stopSpeech();lesson=next;selectedLearning=next.learningLanguage;selectedPrimary=next.primaryLanguage;current=null;makeDeck();persist();sync();notify('lesson');return lesson;
  }
  function feedback(message,error=false){$('.gl-feedback').textContent=message;$('.gl-feedback').classList.toggle('gl-error',error);}
  function switchPanel(panel){$('.gl-settings-panel').hidden=panel!=='settings';$('.gl-basket-panel').hidden=panel!=='basket';for(const tab of root.querySelectorAll('[data-panel]'))tab.setAttribute('aria-selected',String(tab.dataset.panel===panel));if(panel==='basket')renderBasket();}
  function open(panel){
    if(!modalOpen){previousFocus=document.activeElement;modalResume=running;modalOpen=true;pausingInternally=true;onPause();setRunning(false);pausingInternally=false;backdrop.hidden=false;document.body.classList.add('gl-modal-open');}
    switchPanel(panel);sync();setTimeout(()=>$('.gl-close').focus(),0);
  }
  function close(){if(!modalOpen)return;const resume=modalResume;modalResume=false;modalOpen=false;backdrop.hidden=true;document.body.classList.remove('gl-modal-open');stopSpeech();if(previousFocus?.isConnected)previousFocus.focus();if(resume)onResume();}
  function renderBasket(){
    const items=filteredBasket();$('.gl-basket-intro').textContent=items.length?`${items.length} collected items · ${languageName(lesson.learningLanguage)} → ${languageName(lesson.primaryLanguage)}. Tap any item to replay.`:'Your collected words and sentences will appear here after you pass a learning gate.';const list=$('.gl-basket-list');list.replaceChildren();
    for(const entry of items){const button=document.createElement('button');button.type='button';button.className='gl-basket-entry';const word=document.createElement('b'),translation=document.createElement('span'),icon=document.createElement('i');word.textContent=entry.text;word.dir='auto';word.lang=entry.learningLanguage;translation.textContent=settings.showTranslation?entry.translation:'';translation.dir='auto';translation.lang=entry.primaryLanguage;icon.textContent='♪';button.append(word,translation,icon);button.addEventListener('click',()=>speak(entry,{manual:true}));list.append(button);}
    $('.gl-export').disabled=!items.length;$('.gl-copy').disabled=!items.length;$('.gl-clear').disabled=!items.length;$('.gl-export-fallback').hidden=true;$('#gl-export-text').value='';$('.gl-basket-feedback').textContent='';refreshCard();
  }
  function basketJSON(){
    const words=[],sentences=[];for(const entry of filteredBasket()){if(entry.kind==='sentence')sentences.push({sentence:entry.text,sentenceTranslation:entry.translation,...(entry.audioUrl?{audioUrl:entry.audioUrl}:{})});else words.push({word:entry.text,translation:entry.translation,...(entry.sentence?{sentence:entry.sentence,sentenceTranslation:entry.sentenceTranslation||''}:{}),...(entry.audioUrl?{audioUrl:entry.audioUrl}:{}),...(entry.sentenceAudioUrl?{sentenceAudioUrl:entry.sentenceAudioUrl}:{})});}
    return JSON.stringify({primaryLanguage:lesson.primaryLanguage,learningLanguage:lesson.learningLanguage,words,sentences},null,2);
  }
  function revealExport(){const value=basketJSON();$('.gl-export-fallback').hidden=false;$('#gl-export-text').value=value;return value;}
  function selectExport(){const field=$('#gl-export-text');field.focus();field.select();field.setSelectionRange(0,field.value.length);}
  function exportBasket(){
    const value=revealExport();$('.gl-basket-feedback').textContent='If the download does not open, use Copy JSON or select the text above.';
    try{const blob=new Blob([value],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`GoLingo-Suncoast-${lesson.learningLanguage}-${lesson.primaryLanguage}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);}catch{selectExport();}
  }
  async function copyBasket(){
    const value=revealExport();try{if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(value);$('.gl-basket-feedback').textContent='GoLingo JSON copied. Paste it into your lesson or save it as a JSON file.';}catch{selectExport();$('.gl-basket-feedback').textContent='The JSON is selected. Use your device’s Copy command to copy it.';}
  }
  $('.gl-card-settings').addEventListener('click',()=>open('settings'));$('.gl-card-basket').addEventListener('click',()=>open('basket'));summary.querySelector('.gl-menu-lesson').addEventListener('click',()=>open('settings'));summary.querySelector('.gl-menu-basket').addEventListener('click',()=>open('basket'));$('.gl-close').addEventListener('click',close);backdrop.addEventListener('click',e=>{if(e.target===backdrop)close();});
  $('.gl-card-hide').addEventListener('click',()=>setCardVisible(false));$('.gl-card-show').addEventListener('click',()=>setCardVisible(true));$('.gl-dock-settings').addEventListener('click',()=>open('settings'));$('.gl-dock-basket').addEventListener('click',()=>open('basket'));$('.gl-dock-replay').addEventListener('click',()=>{if(current)speak(current,{manual:true,loop:running});});
  $('.gl-word-button').addEventListener('click',()=>{if(current)speak(current,{manual:true,loop:running});});$('.gl-example').addEventListener('click',()=>{if(current)speak(current,{example:true,manual:true,loop:running});});
  function changeSetting(key,value){if(key==='showCard'){setCardVisible(value);return;}settings[key]=value;persist();sync();if(key==='practice'){beginRide();notify('practice');}else if(key==='voiceOn'||key==='repeat'){stopSpeech();if(running&&current)speak(current,{loop:true});}else if(key==='volume'&&player)player.volume=settings.volume;if(key!=='practice')notify('setting');}
  $('.gl-translation-toggle').addEventListener('click',()=>changeSetting('showTranslation',!settings.showTranslation));for(const input of root.querySelectorAll('[data-setting]'))input.addEventListener('change',()=>changeSetting(input.dataset.setting,input.checked));for(const input of root.querySelectorAll('[name="gl-practice"]'))input.addEventListener('change',()=>{if(input.checked)changeSetting('practice',input.value);});$('.gl-volume input').addEventListener('input',e=>changeSetting('volume',Number(e.target.value)));
  learningSelect.addEventListener('change',()=>{selectedLearning=learningSelect.value;sync();});primarySelect.addEventListener('change',()=>{selectedPrimary=primarySelect.value;sync();});
  $('.gl-sample').addEventListener('click',()=>{const sample=sampleLesson(selectedLearning);if(!sample||selectedPrimary!=='en')return;applyLesson(sample);lesson.source='sample';persist();feedback(`Loaded ${languageName(lesson.learningLanguage)} theme-park words. Close this panel when you’re ready.`);});
  $('.gl-import-button').addEventListener('click',()=>{try{const value=parseLessonText($('#gl-import').value,{learningLanguage:selectedLearning,primaryLanguage:selectedPrimary,baseUrl:location.href});applyLesson(value);feedback(`Loaded ${lesson.words.length} words and ${lesson.sentences.length} sentences.`);}catch(error){feedback(error.message,true);}});
  $('.gl-file').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>MAX_PAYLOAD){feedback('Please choose a file under 1 MB.',true);return;}try{const value=parseLessonText(await file.text(),{learningLanguage:selectedLearning,primaryLanguage:selectedPrimary,baseUrl:location.href});applyLesson(value);feedback(`Loaded ${lesson.words.length} words and ${lesson.sentences.length} sentences from your file.`);}catch(error){feedback(error.message||'This file could not be read.',true);}e.target.value='';});
  for(const tab of root.querySelectorAll('[data-panel]'))tab.addEventListener('click',()=>switchPanel(tab.dataset.panel));$('.gl-export').addEventListener('click',exportBasket);$('.gl-copy').addEventListener('click',copyBasket);$('#gl-export-text').addEventListener('click',selectExport);$('.gl-clear').addEventListener('click',()=>{const keys=new Set(filteredBasket().map(e=>e.key));basket=basket.filter(e=>!keys.has(e.key));save(BASKET,basket);renderBasket();$('.gl-basket-feedback').textContent='Collected vocabulary for this language pair was cleared.';});
  backdrop.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const all=[...dialog.querySelectorAll('button:not(:disabled),select,input,textarea,a[href]')].filter(el=>el.getClientRects().length);if(!all.length)return;const first=all[0],last=all.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  function load(value){try{const result=applyLesson(value);feedback(`Received ${result.words.length} words and ${result.sentences.length} sentences from GoLingo.`);onToast('Your GoLingo lesson is ready.',`${result.words.length} words · ${result.sentences.length} sentences`);return {ok:true,words:result.words.length,sentences:result.sentences.length};}catch(error){feedback(error.message,true);onToast('The lesson could not be loaded.',error.message);return {ok:false,error:error.message};}}
  window.GoLingo=Object.assign(window.GoLingo&&typeof window.GoLingo==='object'?window.GoLingo:{},{load});window.loadGoLingoData=load;window.setGoLingoData=load;
  const trusted=e=>e.origin===location.origin||(window.opener&&e.source===window.opener)||(e.source===window.parent&&window.parent!==window)||(!e.source&&(e.origin===''||e.origin==='null'));
  window.addEventListener('message',e=>{if(!trusted(e))return;let value=e.data;if(typeof value==='string'){if(value.length>MAX_PAYLOAD)return;try{value=JSON.parse(value);}catch{return;}}if(!value||typeof value!=='object')return;const type=text(value.type||value.action,70).toLowerCase();if(type&&!/golingo|lesson|learning|setdata|loaddata/.test(type))return;if(value.words||value.sentences||value.phrases||value.items||value.entries||value.payload||value.lesson||value.data||Array.isArray(value))load(value);});
  function fromLocation(){const query=new URLSearchParams(location.search),hash=new URLSearchParams(location.hash.slice(1));for(const key of ['golingoLesson','lesson','golingo','data','payload']){const raw=hash.get(key)||query.get(key);if(raw){load(raw);return true;}}return false;}
  window.addEventListener('hashchange',fromLocation);
  makeDeck();sync();
  queueMicrotask(()=>{if(fromLocation())return;try{const active=sessionStorage.getItem('golingo:active-lesson:v1');if(active)load(active);}catch{}});
  return {get lesson(){return lesson;},get settings(){return {...settings};},get current(){return current;},get collectedCount(){return filteredBasket().length;},get isOpen(){return modalOpen;},beginRide,nextBatch,present,setRunning,setVisible,setCardVisible,toggleCard,unlock,openSettings:()=>open('settings'),openBasket:()=>open('basket'),closePanel:close,close,load};
}
