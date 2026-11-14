// GoLingo's interface is independent of WebGL so lessons can arrive before
// the flight renderer is ready. All user-provided text stays textContent.
const LANGUAGE_OPTIONS = [
  ['en','English'],['es','Spanish'],['ja','Japanese'],['zh','Chinese'],
  ['fr','French'],['de','German'],['pt','Portuguese'],['it','Italian'],
  ['ko','Korean'],['vi','Vietnamese'],['ar','Arabic'],['hi','Hindi'],
  ['ru','Russian'],['th','Thai'],['uk','Ukrainian'],['id','Indonesian'],
];
const MODE_NAMES = {learn:'Learn',listen:'Listen',meaning:'Meaning'};
const MODE_DESCRIPTIONS = {
  learn:'Fly through a word signal, tow a walker, defeat a fighter or mine a crystal. Hear the collected word until the next one.',
  listen:'Listen to the spoken word, then choose the matching word in the world. Replay the prompt whenever you need it.',
  meaning:'Hear and read the meaning, then find its word in the learning language. A wrong choice repeats the same prompt.',
};

function element(tag,className,text){
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined)node.textContent=text;
  return node;
}
function languageName(code){
  const text=String(code||'');const base=text.toLowerCase().split('-')[0];
  return LANGUAGE_OPTIONS.find(([value])=>value===base)?.[1]||text||'Language';
}
function csvRows(text,separator){
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'){
      if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;
    }else if(ch===separator&&!quoted){row.push(field.trim());field='';}
    else if((ch==='\n'||ch==='\r')&&!quoted){
      if(ch==='\r'&&text[i+1]==='\n')i++;
      row.push(field.trim());if(row.some(Boolean))rows.push(row);row=[];field='';
    }else field+=ch;
  }
  if(quoted)throw new Error('A quoted CSV field is missing its closing quote.');
  row.push(field.trim());if(row.some(Boolean))rows.push(row);return rows;
}

export function parseLessonInput(raw,primaryLanguage='en',learningLanguage='es'){
  const text=String(raw||'').replace(/^\uFEFF/,'').trim();
  if(!text)throw new Error('Paste some words or choose a lesson file first.');
  if(text[0]==='{'||text[0]==='['){
    let parsed;try{parsed=JSON.parse(text);}catch{throw new Error('The JSON could not be read. Check its brackets and quotation marks.');}
    return Array.isArray(parsed)?{primaryLanguage,learningLanguage,words:parsed}:parsed;
  }
  const first=text.split(/\r?\n/).find(line=>line.trim())||'';
  const separator=first.includes('\t')?'\t':first.includes(',')&&!first.includes('=')?',':null;
  let words;
  if(separator){
    const rows=csvRows(text,separator);
    const names=rows[0]?.map(x=>x.toLowerCase().replace(/[\s_-]/g,''))||[];
    const wordColumn=names.findIndex(x=>['word','text','term','phrase','sentence'].includes(x));
    const translationColumn=names.findIndex(x=>['translation','meaning','definition','sentencetranslation','phrasetranslation'].includes(x));
    const hasHeader=wordColumn>=0&&(translationColumn>=0||names.length===1);
    const at=(row,key,fallback)=>{const i=hasHeader?names.indexOf(key):fallback;return i>=0?row[i]||'':'';};
    words=rows.slice(hasHeader?1:0).map(row=>{
      const item={word:row[hasHeader?wordColumn:0]||'',translation:row[hasHeader?translationColumn:1]||'',sentence:at(row,'sentence',2),sentenceTranslation:at(row,'sentencetranslation',3)};
      const fields={id:'id',language:'language',learninglanguage:'learningLanguage',primarylanguage:'primaryLanguage',audiourl:'audioUrl',sentenceaudiourl:'sentenceAudioUrl',translationaudiourl:'translationAudioUrl',sentencetranslationaudiourl:'sentenceTranslationAudioUrl'};
      if(hasHeader)for(const [key,field] of Object.entries(fields)){const value=at(row,key,-1);if(value)item[field]=value;}
      return item;
    });
  }else{
    words=text.split(/\r?\n/).filter(line=>line.trim()).map(line=>{
      const pair=line.split(/\s*=\s*|\s+\|\s+/);
      return{word:(pair.shift()||'').trim(),translation:pair.join(' = ').trim()};
    });
  }
  words=words.filter(item=>item.word);
  if(!words.length)throw new Error('No words were found in this list.');
  return{primaryLanguage,learningLanguage,words};
}

export function createLearningUI(learning,{stage=document.getElementById('stage'),onOpen=()=>{},onClose=()=>{},onToast=()=>{}}={}){
  if(!stage)throw new Error('The learning interface needs a game stage.');
  let snapshot=learning.getSnapshot(),isOpen=false,activeTab='lesson',gameplayVisible=false;
  let reviewLimit=100,lastReviewCount=-1,lastVoiceKey='',previousFocus=null,destroyed=false,statusOverride='';
  let importBusy=false,clearArmed=false;
  const disposers=[];
  const byId=id=>overlay.querySelector('#lingo-'+id);
  const listen=(node,type,fn,options)=>{node.addEventListener(type,fn,options);disposers.push(()=>node.removeEventListener(type,fn,options));};
  const safe=async(fn,{notice=true}={})=>{try{return await fn();}catch(error){setNotice(error?.message||String(error),true);if(notice)onToast(error?.message||'Could not complete that action.');return null;}};
  const unlock=()=>{try{const result=learning.unlock();result?.catch?.(()=>{});}catch{}};

  const hud=element('section','lingo-hud glass hidden');hud.id='lingo-hud';hud.setAttribute('aria-label','Language practice');
  hud.innerHTML=`<div class="lingo-hud-head"><button id="lingo-hud-mode" class="lingo-mode-chip" aria-label="Choose learning mode">LEARN</button><button id="lingo-hud-count" class="lingo-hud-count" aria-label="Open collected words">0 words</button><button id="lingo-hud-audio" class="lingo-icon" aria-label="Turn word audio off" title="Word audio">♪</button><button id="lingo-hud-hide" class="lingo-icon" aria-label="Hide current word" title="Hide current word">−</button></div><div id="lingo-hud-content"><button id="lingo-hud-replay" aria-label="Replay pronunciation" title="Replay pronunciation">▷</button><div class="lingo-current"><strong id="lingo-current-word" dir="auto"></strong><span id="lingo-current-translation" dir="auto"></span></div></div><div id="lingo-hud-status" aria-live="polite"></div>`;
  stage.appendChild(hud);
  const hudEl=id=>hud.querySelector('#lingo-'+id);

  const menuButton=element('button','lingo-menu-button','WORDS');menuButton.id='lingo-open';menuButton.type='button';menuButton.setAttribute('aria-label','Open language lesson and review');
  const actions=stage.querySelector('.top-actions');
  if(actions)actions.insertBefore(menuButton,actions.firstChild);else stage.appendChild(menuButton);

  const introButton=element('button','lingo-intro-open');introButton.id='lingo-intro-open';introButton.type='button';
  introButton.innerHTML='<span>GoLingo <b>LANGUAGE FLIGHT</b></span><strong id="lingo-intro-pair">English → Spanish</strong><small id="lingo-intro-summary">Learn · choose your words ↗</small>';
  introButton.setAttribute('aria-label','Choose language lesson before launch');stage.appendChild(introButton);

  const overlay=element('div','lingo-overlay hidden');overlay.id='lingo-overlay';
  overlay.innerHTML=`<section id="lingo-panel" class="lingo-panel glass" role="dialog" aria-modal="true" aria-labelledby="lingo-title">
    <header class="lingo-panel-header"><div><div class="lingo-eyebrow">GOLINGO · SKY REACH</div><h2 id="lingo-title">Your words. A whole new world.</h2><p id="lingo-lesson-summary"></p></div><button id="lingo-close" class="lingo-close" aria-label="Close language lesson">×</button></header>
    <div class="lingo-tabs" role="tablist" aria-label="Language learning settings"><button id="lingo-tab-lesson" role="tab" aria-selected="true" aria-controls="lingo-lesson-pane">Lesson & modes</button><button id="lingo-tab-review" role="tab" aria-selected="false" aria-controls="lingo-review-pane">Collected words <span id="lingo-review-badge">0</span></button><label class="lingo-enable"><input id="lingo-enabled" type="checkbox" checked> Learning on</label></div>
    <div id="lingo-scroll" class="lingo-scroll">
      <div id="lingo-lesson-pane" role="tabpanel" aria-labelledby="lingo-tab-lesson">
        <div class="lingo-mode-grid" role="group" aria-label="Learning mode"><button id="lingo-mode-learn" data-mode="learn"><span>01</span><b>Learn</b><small>Explore & hear each word</small></button><button id="lingo-mode-listen" data-mode="listen"><span>02</span><b>Listen</b><small>Hear it · find its word</small></button><button id="lingo-mode-meaning" data-mode="meaning"><span>03</span><b>Meaning</b><small>Read the meaning · choose</small></button></div>
        <p id="lingo-mode-description" class="lingo-description"></p>
        <div class="lingo-settings-grid">
          <section class="lingo-section"><h3>Practice & display</h3><label class="lingo-field">Practice<select id="lingo-practice"><option value="words">Words & phrases</option><option value="sentences">Example sentences</option></select></label><div class="lingo-checks"><label><input id="lingo-show-word" type="checkbox"> Show current word / prompt</label><label><input id="lingo-show-translation" type="checkbox"> Show meaning in Learn</label><label><input id="lingo-show-markers" type="checkbox"> Show words in the world</label></div><p class="lingo-small">Listen and Meaning keep the correct answer out of the current-word display.</p></section>
          <section class="lingo-section"><h3>Speech</h3><div class="lingo-checks two"><label><input id="lingo-speech" type="checkbox"> Word audio</label><label><input id="lingo-repeat" type="checkbox"> Repeat until next word</label><label><input id="lingo-sentences" type="checkbox"> Example sentence</label><label><input id="lingo-speak-translation" type="checkbox"> Read meaning in Learn</label></div><div class="lingo-range-row"><label for="lingo-gap">Pause <output id="lingo-gap-value">4.5 s</output></label><input id="lingo-gap" type="range" min="2" max="12" step="0.5"></div><div class="lingo-range-row"><label for="lingo-rate">Speed <output id="lingo-rate-value">0.85×</output></label><input id="lingo-rate" type="range" min="0.6" max="1.3" step="0.05"></div><label class="lingo-field">Voice<select id="lingo-voice"><option value="">Device default</option></select></label><div class="lingo-audio-row"><button id="lingo-preview-audio" class="lingo-small-button">▷ Replay prompt</button><span id="lingo-audio-status"></span></div></section>
        </div>
        <section class="lingo-section lingo-import-section"><div class="lingo-section-heading"><h3>Your lesson</h3><span>JSON · TXT · CSV</span></div><div class="lingo-language-row"><label>Meaning language<select id="lingo-primary-language"></select></label><span>→</span><label>Learning language<select id="lingo-learning-language"></select></label></div><p class="lingo-small">Language choices apply to pasted pairs and lists. A GoLingo JSON lesson keeps the languages it supplies.</p><label class="lingo-text-label" for="lingo-input">Paste your words, sentences, or GoLingo JSON</label><textarea id="lingo-input" spellcheck="false" placeholder="agua = water&#10;cielo = sky&#10;volar = fly"></textarea><div class="lingo-import-tools"><label class="lingo-file-button">Choose file<input id="lingo-file" type="file" accept=".json,.txt,.csv,.tsv,application/json,text/plain,text/csv"></label><span id="lingo-file-name"></span><label class="lingo-append"><input id="lingo-append" type="checkbox"> Append to current lesson</label><button id="lingo-apply" class="lingo-primary">Use this lesson <span>↗</span></button></div><p class="lingo-small">Import replaces the current lesson and review basket unless Append is selected. Export collected words first to keep a copy.</p></section>
        <section class="lingo-section lingo-demo-section"><div><h3>Start with a ready-made lesson</h3><p class="lingo-small">Space, travel, and the world around you. Replaces the current lesson and review basket.</p></div><select id="lingo-demo-language" aria-label="Built-in lesson language"><option value="es">Spanish</option><option value="ja">Japanese</option><option value="zh">Chinese</option><option value="fr">French</option><option value="de">German</option></select><button id="lingo-load-demo" class="lingo-small-button">Use demo lesson</button></section>
      </div>
      <div id="lingo-review-pane" class="hidden" role="tabpanel" aria-labelledby="lingo-tab-review"><div class="lingo-review-heading"><div><h3>Your discoveries</h3><p id="lingo-review-summary" class="lingo-small"></p></div><div class="lingo-review-actions"><button id="lingo-export" class="lingo-primary">Export to GoLingo ↗</button><button id="lingo-copy" class="lingo-small-button">Copy JSON</button><button id="lingo-clear" class="lingo-small-button lingo-danger">Clear</button></div></div><div id="lingo-review-empty"><span>◇</span><h3>Your first discovery is waiting.</h3><p>Fly through a word signal, bring down a walker, defeat a fighter, or mine a glowing deposit to collect words.</p></div><div id="lingo-review-list"></div><button id="lingo-review-more" class="lingo-small-button hidden">Show 100 more</button><div id="lingo-copy-fallback" class="hidden"><label class="lingo-text-label" for="lingo-copy-text">Select and copy your collected-word JSON</label><textarea id="lingo-copy-text" readonly></textarea></div></div>
    </div>
    <footer class="lingo-panel-footer"><div><p id="lingo-notice" role="status" aria-live="polite"></p><a href="https://www.golingoapp.com" target="_self">GoLingoApp.com <span>· Practice in the real world ↗</span></a></div><button id="lingo-done" class="lingo-primary">Back to the sky <span>↗</span></button></footer>
  </section>`;
  stage.appendChild(overlay);

  for(const id of ['primary-language','learning-language']){
    const select=byId(id);for(const [value,label] of LANGUAGE_OPTIONS){const option=element('option','',label);option.value=value;select.appendChild(option);}
  }

  function setNotice(message='',error=false){
    const node=byId('notice');node.textContent=String(message||'');node.classList.toggle('is-error',error);
  }
  function selectLanguage(select,value){
    const code=String(value||'en');
    if(!Array.from(select.options).some(option=>option.value===code)){const option=element('option','',languageName(code)+' · '+code);option.value=code;select.appendChild(option);}
    select.value=code;
  }
  function updateLanguages(){
    const current=learning.getSnapshot();
    selectLanguage(byId('primary-language'),current.primaryLanguage||'en');
    selectLanguage(byId('learning-language'),current.learningLanguage||'es');
  }
  function updateVoices(force=false){
    const voices=learning.getVoices?.()||[];
    const target=(snapshot.learningLanguage||'es').split('-')[0].toLowerCase();
    const relevant=voices.filter(voice=>String(voice.lang||'').split('-')[0].toLowerCase()===target);
    const shown=relevant.length?relevant:voices;
    const key=shown.map(voice=>voice.voiceURI||voice.name).join('|')+'|'+snapshot.settings.voiceURI;
    if(!force&&key===lastVoiceKey)return;lastVoiceKey=key;
    const select=byId('voice');select.textContent='';
    const auto=element('option','','Device default');auto.value='';select.appendChild(auto);
    for(const voice of shown){const option=element('option','',`${voice.name} · ${voice.lang}`);option.value=voice.voiceURI||voice.name;select.appendChild(option);}
    if(snapshot.settings.voiceURI&&!Array.from(select.options).some(option=>option.value===snapshot.settings.voiceURI)){
      const saved=element('option','','Saved voice · unavailable here');saved.value=snapshot.settings.voiceURI;select.appendChild(saved);
    }
    select.value=snapshot.settings.voiceURI||'';
  }
  function renderReview(force=false){
    if(!isOpen||activeTab!=='review')return;
    if(!force&&lastReviewCount===snapshot.basketCount)return;
    lastReviewCount=snapshot.basketCount;
    const basket=learning.getBasket(),words=Array.isArray(basket.words)?basket.words:[];
    const list=byId('review-list');list.textContent='';
    byId('review-empty').classList.toggle('hidden',words.length>0);
    byId('review-summary').textContent=`${words.length.toLocaleString()} collected ${words.length===1?'word':'words'} · replay, keep, or export your discoveries.`;
    for(const [i,entry] of words.slice(0,reviewLimit).entries()){
      const row=element('div','lingo-review-row');
      const number=element('span','lingo-review-number',String(i+1).padStart(2,'0'));row.appendChild(number);
      const copy=element('div','lingo-review-copy');const word=element('strong','',entry.word||entry.text||entry.sentence||'');word.dir='auto';copy.appendChild(word);
      const meaning=element('span','',entry.translation||entry.meaning||entry.sentenceTranslation||'');meaning.dir='auto';copy.appendChild(meaning);
      if(entry.sentence&&entry.sentence!==entry.word){const sentence=element('small','',entry.sentence);sentence.dir='auto';sentence.title=entry.sentence;copy.appendChild(sentence);}
      row.appendChild(copy);
      const controls=element('div','lingo-review-play');
      const replay=element('button','lingo-small-button','▷ Word');replay.type='button';replay.setAttribute('aria-label',`Replay ${entry.word||entry.sentence||'word'}`);
      replay.addEventListener('click',()=>{unlock();safe(()=>learning.speakEntry(entry,{sentence:false}));});controls.appendChild(replay);
      if(entry.sentence){const sentence=element('button','lingo-small-button','▷ Sentence');sentence.type='button';sentence.addEventListener('click',()=>{unlock();safe(()=>learning.speakEntry(entry,{sentence:true}));});controls.appendChild(sentence);}
      row.appendChild(controls);list.appendChild(row);
    }
    byId('review-more').classList.toggle('hidden',words.length<=reviewLimit);
    for(const id of ['export','copy','clear'])byId(id).disabled=!words.length;
  }
  function render(snap=snapshot){
    if(destroyed)return;snapshot=snap;const settings=snapshot.settings||{};
    const mode=snapshot.mode||settings.mode||'learn',enabled=snapshot.enabled!==false;
    const entry=mode==='learn'?(snapshot.displayEntry||snapshot.question?.entry):snapshot.question?.entry;
    hud.classList.toggle('hidden',!gameplayVisible||!enabled);
    hud.classList.toggle('is-collapsed',settings.showWord===false);
    hud.dataset.mode=mode;
    hudEl('hud-mode').textContent=(MODE_NAMES[mode]||'Learn').toUpperCase();
    hudEl('hud-count').textContent=`${Number(snapshot.basketCount||0).toLocaleString()}/${Number(snapshot.total||0).toLocaleString()}`;
    hudEl('hud-count').title=`${Number(snapshot.basketCount||0).toLocaleString()} collected · ${Number(snapshot.stats?.correct||0).toLocaleString()} correct`;
    hudEl('hud-count').setAttribute('aria-label',`Review ${snapshot.basketCount||0} collected words from ${snapshot.total||0} lesson items`);
    hudEl('hud-audio').textContent=settings.speech===false?'∅':'♪';
    hudEl('hud-audio').setAttribute('aria-label',settings.speech===false?'Turn word audio on':'Turn word audio off');
    hudEl('hud-audio').classList.toggle('is-muted',settings.speech===false);
    hudEl('hud-hide').textContent=settings.showWord===false?'+':'−';hudEl('hud-hide').setAttribute('aria-label',settings.showWord===false?'Show current word':'Hide current word');hudEl('hud-hide').title=settings.showWord===false?'Show current word':'Hide current word';
    let word='',translation='';
    if(mode==='listen'){word='Listen and choose';translation='Replay the prompt · find its word';}
    else if(mode==='meaning'){const meaning=entry?learning.textFor(entry,true):'';word=meaning||'Meaning unavailable';translation=meaning?'Choose the word with this meaning':'Add a meaning or use Learn / Listen';}
    else if(entry){word=learning.textFor(entry,false);translation=settings.showTranslation===false?'':learning.textFor(entry,true);}
    hudEl('current-word').textContent=word||'Ready to explore';hudEl('current-word').title=word;
    hudEl('current-translation').textContent=translation;hudEl('current-translation').title=translation;
    hudEl('current-translation').classList.toggle('hidden',!translation);
    hudEl('hud-status').textContent=statusOverride;
    hudEl('hud-status').classList.toggle('hidden',!statusOverride||settings.showWord===false);
    menuButton.classList.toggle('is-off',!enabled);
    const primary=snapshot.primaryLanguage||'',target=snapshot.learningLanguage||'';
    if(primary&&target)introButton.querySelector('#lingo-intro-pair').textContent=`${languageName(primary)} → ${languageName(target)}`;
    introButton.querySelector('#lingo-intro-summary').textContent=`${enabled?MODE_NAMES[mode]:'Learning off'} · ${Number(snapshot.total||0).toLocaleString()} items · customize ↗`;
    byId('review-badge').textContent=String(snapshot.basketCount||0);
    if(!isOpen)return;
    byId('enabled').checked=enabled;
    byId('lesson-summary').textContent=`${Number(snapshot.total||0).toLocaleString()} items · ${languageName(primary||byId('primary-language').value)} → ${languageName(target||byId('learning-language').value)}${snapshot.lessonSource==='demo'?' · demo lesson':''}`;
    for(const key of ['learn','listen','meaning']){const button=byId('mode-'+key);button.classList.toggle('selected',key===mode);button.setAttribute('aria-pressed',String(key===mode));}
    byId('mode-description').textContent=MODE_DESCRIPTIONS[mode]||MODE_DESCRIPTIONS.learn;
    byId('practice').value=snapshot.practice||settings.practice||'words';
    for(const [id,key] of [['show-word','showWord'],['show-translation','showTranslation'],['show-markers','showMarkers'],['speech','speech'],['repeat','repeat'],['sentences','sentences'],['speak-translation','speakTranslation']])byId(id).checked=settings[key]!==false;
    byId('speak-translation').checked=!!settings.speakTranslation;
    byId('gap').value=String(settings.repeatGap??4.5);byId('gap-value').textContent=`${Number(settings.repeatGap??4.5).toFixed(1)} s`;
    byId('rate').value=String(settings.rate??.85);byId('rate-value').textContent=`${Number(settings.rate??.85).toFixed(2)}×`;
    byId('audio-status').textContent=String(snapshot.audioStatus||'Tap replay to hear the device voice.');
    updateVoices();renderReview();
  }
  function selectTab(tab){
    activeTab=tab==='review'?'review':'lesson';
    for(const name of ['lesson','review']){byId(name+'-pane').classList.toggle('hidden',name!==activeTab);byId('tab-'+name).setAttribute('aria-selected',String(name===activeTab));}
    clearArmed=false;byId('clear').textContent='Clear';byId('scroll').scrollTop=0;
    if(activeTab==='review')renderReview(true);
  }
  function open(tab='lesson'){
    if(destroyed)return;
    if(!isOpen){previousFocus=document.activeElement;onOpen();isOpen=true;overlay.classList.remove('hidden');stage.classList.add('lingo-panel-open');}
    snapshot=learning.getSnapshot();updateLanguages();selectTab(tab);render(snapshot);updateVoices(true);
    if(snapshot.notice&&!byId('notice').textContent)setNotice(snapshot.notice);
    byId('close').focus?.({preventScroll:true});
  }
  function close(){
    if(!isOpen)return;isOpen=false;overlay.classList.add('hidden');stage.classList.remove('lingo-panel-open');clearArmed=false;
    onClose();previousFocus?.focus?.({preventScroll:true});
  }
  function patch(settings){safe(()=>{learning.setSettings(settings);render(learning.getSnapshot());});}

  listen(menuButton,'click',()=>open('lesson'));listen(introButton,'click',()=>open('lesson'));
  listen(hudEl('hud-mode'),'click',()=>open('lesson'));listen(hudEl('hud-count'),'click',()=>open('review'));
  listen(hudEl('hud-hide'),'click',()=>patch({showWord:snapshot.settings.showWord===false}));
  listen(hudEl('hud-audio'),'click',()=>{unlock();patch({speech:snapshot.settings.speech===false});});
  listen(hudEl('hud-replay'),'click',()=>{unlock();safe(()=>learning.speakPrompt());});
  listen(byId('close'),'click',close);listen(byId('done'),'click',close);
  listen(byId('tab-lesson'),'click',()=>selectTab('lesson'));listen(byId('tab-review'),'click',()=>selectTab('review'));
  listen(byId('enabled'),'change',event=>patch({enabled:event.target.checked}));
  for(const mode of ['learn','listen','meaning'])listen(byId('mode-'+mode),'click',()=>{unlock();patch({mode,enabled:true});setNotice(MODE_NAMES[mode]+' mode selected.');});
  listen(byId('practice'),'change',event=>patch({practice:event.target.value}));
  for(const [id,key] of [['show-word','showWord'],['show-translation','showTranslation'],['show-markers','showMarkers'],['speech','speech'],['repeat','repeat'],['sentences','sentences'],['speak-translation','speakTranslation']])listen(byId(id),'change',event=>{if(key==='speech')unlock();patch({[key]:event.target.checked});});
  listen(byId('gap'),'input',event=>patch({repeatGap:Number(event.target.value)}));
  listen(byId('rate'),'input',event=>patch({rate:Number(event.target.value)}));
  listen(byId('voice'),'change',event=>patch({voiceURI:event.target.value}));
  listen(byId('preview-audio'),'click',()=>{unlock();safe(()=>learning.speakPrompt());});
  listen(byId('load-demo'),'click',()=>safe(()=>{learning.selectDemo(byId('demo-language').value);updateLanguages();render(learning.getSnapshot());setNotice('Demo lesson loaded. A new review basket is ready for your discoveries.');}));
  listen(byId('apply'),'click',()=>safe(async()=>{
    if(importBusy)return;importBusy=true;byId('apply').disabled=true;setNotice('Preparing your lesson…');
    try{
      const payload=parseLessonInput(byId('input').value,byId('primary-language').value,byId('learning-language').value);
      const result=await learning.importWords(payload,{append:byId('append').checked});
      updateLanguages();render(learning.getSnapshot());
      setNotice(`Lesson ready · ${Number(result?.count??snapshot.total).toLocaleString()} items. ${byId('append').checked?'Added to the previous lesson.':'The previous lesson has been replaced.'}`);
    }finally{importBusy=false;byId('apply').disabled=false;}
  }));
  listen(byId('file'),'change',()=>safe(async()=>{
    const file=byId('file').files?.[0];if(!file)return;
    if(file.size>32*1024*1024)throw new Error('Choose a lesson file smaller than 32 MB.');
    setNotice('Reading '+file.name+'…');const text=await file.text();byId('input').value=text;byId('file-name').textContent=file.name;setNotice('File ready. Use this lesson to import it.');
  }));
  listen(byId('review-more'),'click',()=>{reviewLimit+=100;renderReview(true);});
  listen(byId('export'),'click',()=>safe(async()=>{
    const result=await learning.exportBasket();
    const method=result?.method||result?.via||result?.destination;
    setNotice(method==='native'||result?.native?'Collected words sent to GoLingo.':'Collected-word JSON export prepared.');
  }));
  listen(byId('copy'),'click',()=>safe(async()=>{
    const text=JSON.stringify(learning.getBasket(),null,2);
    if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(text);byId('copy-fallback').classList.add('hidden');setNotice('Collected-word JSON copied.');return;}catch{}}
    byId('copy-text').value=text;byId('copy-fallback').classList.remove('hidden');byId('copy-text').focus();byId('copy-text').select();setNotice('Select and copy the JSON below.');
  }));
  listen(byId('clear'),'click',()=>{
    if(!clearArmed){clearArmed=true;byId('clear').textContent='Confirm clear';setNotice('Clear the collected-word list? Your lesson and game progress stay available.');return;}
    safe(()=>{learning.clearBasket();clearArmed=false;byId('clear').textContent='Clear';renderReview(true);setNotice('Collected-word list cleared.');});
  });

  for(const node of [hud,menuButton,introButton,overlay]){
    listen(node,'pointerdown',event=>event.stopPropagation());
    listen(node,'pointerup',event=>event.stopPropagation());
    listen(node,'click',event=>event.stopPropagation());
  }
  const stopControlKeys=event=>{if(['Enter',' ','Tab'].includes(event.key)||['Enter','NumpadEnter','Space','Tab'].includes(event.code))event.stopPropagation();};
  listen(hud,'keydown',stopControlKeys);listen(menuButton,'keydown',stopControlKeys);listen(introButton,'keydown',stopControlKeys);
  listen(overlay,'keydown',event=>{
    event.stopPropagation();
    if(event.key==='Escape'||event.code==='Escape'){event.preventDefault();close();}
    if(event.key==='Tab'){
      const focusable=Array.from(byId('panel').querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]')).filter(node=>!node.closest('.hidden'));
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  });
  listen(overlay,'pointerdown',event=>{if(event.target===overlay)close();});
  const unsubscribe=learning.subscribe((next,event)=>{
    const lessonChanged=next.total!==snapshot.total||next.primaryLanguage!==snapshot.primaryLanguage||next.learningLanguage!==snapshot.learningLanguage;
    render(next);
    if(isOpen&&lessonChanged)updateLanguages();
    if(event?.type==='error'){setNotice(event.message||next.notice||'The lesson could not be loaded.',true);if(!isOpen)onToast(event.message||next.notice||'The lesson could not be loaded.');}
  });
  render(snapshot);
  return {
    open,close,
    setGameplayVisible(value){gameplayVisible=!!value;introButton.classList.toggle('hidden',gameplayVisible);render();},
    setStatus(value){const text=String(value||'');if(text===statusOverride)return;statusOverride=text;render();},
    isOpen:()=>isOpen,
    destroy(){if(destroyed)return;destroyed=true;unsubscribe?.();disposers.forEach(dispose=>dispose());hud.remove();overlay.remove();menuButton.remove();introButton.remove();stage.classList.remove('lingo-panel-open');},
  };
}
