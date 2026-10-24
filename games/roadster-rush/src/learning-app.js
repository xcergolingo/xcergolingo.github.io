import {normalizeLesson,parseLessonText,createLearningController} from './lesson-engine.js';
import {createWordGate} from './word-gates.js';
import {installGoLingoBridge} from './game-bridge.js';

export function createLearningApp({THREE,scene,lanes,getGameState,getPlayer,getSpeed,getTraffic=()=>[],onPause,onResume,onBonus=()=>{},onCollect=()=>{}}) {
  const markup=`
  <section id="gl-hud" class="gl-card" aria-label="Current lesson">
    <div class="gl-progress-row"><span id="gl-language-label">ES / EN</span><span id="gl-progress">0 / 6 gates</span></div>
    <div class="gl-word-row"><button id="gl-current-word" title="Tap to hear the word" dir="auto">Find the word gate</button><button id="gl-voice-pause" aria-pressed="false" title="Pause repeating pronunciation">Ⅱ Voice</button></div>
    <button id="gl-current-translation" dir="auto" hidden title="Hear the translation"></button>
    <div class="gl-status-row"><span id="gl-audio-status" role="status">Word audio begins at your first gate.</span><button id="gl-translation-toggle" aria-pressed="false">Translation</button></div>
    <div class="gl-progress-track"><i id="gl-progress-bar"></i></div>
  </section>
  <div id="gl-gate-direction" class="gl-card" hidden>Word gate ahead</div>
  <div id="gl-lesson-dialog" class="gl-overlay" role="dialog" aria-modal="true" aria-labelledby="gl-lesson-title" hidden>
    <section class="gl-dialog gl-card"><header><div><span class="gl-eyebrow">YOUR WORDS. YOUR ROAD.</span><h2 id="gl-lesson-title">Build your drive</h2></div><button id="gl-close-lesson" class="gl-close" aria-label="Close lesson settings">×</button></header>
      <div class="gl-dialog-body">
        <div class="gl-field-grid"><label>Learning language<input id="gl-learning-language" list="gl-languages" autocomplete="off" placeholder="es, ja, zh-CN…"></label><label>Translation language<input id="gl-primary-language" list="gl-languages" autocomplete="off" placeholder="en, zh-CN…"></label></div>
        <datalist id="gl-languages"><option value="en">English</option><option value="es">Spanish</option><option value="fr">French</option><option value="de">German</option><option value="it">Italian</option><option value="pt-BR">Portuguese</option><option value="ja">Japanese</option><option value="ko">Korean</option><option value="zh-CN">Chinese</option><option value="ar">Arabic</option><option value="hi">Hindi</option><option value="ru">Russian</option><option value="th">Thai</option><option value="uk">Ukrainian</option><option value="vi">Vietnamese</option></datalist>
        <div class="gl-field-grid"><label>Lesson format<select id="gl-lesson-mode"><option value="words">Word gates</option><option value="sentences">Words → full sentence</option></select></label><label>Driving mode<select id="gl-drive-mode"><option value="practice">Practice · forgiving traffic</option><option value="rush">Rush · score attack</option></select></label></div>
        <label for="gl-lesson-input">Words or sentences <small id="gl-input-hint">One word | translation per line, or paste GoLingo JSON.</small></label>
        <textarea id="gl-lesson-input" rows="7" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
        <div class="gl-input-tools"><button id="gl-import-file">Import JSON / text</button><input id="gl-file" type="file" accept=".json,.txt,.csv,.tsv,application/json,text/plain" hidden><button id="gl-demo">Spanish demo</button></div>
        <div class="gl-check-grid"><label><input id="gl-learning-enabled" type="checkbox"> Word gates enabled</label><label><input id="gl-show-word" type="checkbox"> Show words</label><label><input id="gl-show-translation" type="checkbox"> Show translations</label><label><input id="gl-repeat" type="checkbox"> Repeat word audio</label></div>
        <div class="gl-field-grid"><label>Time between gates<select id="gl-gate-gap"><option value="9">9 seconds</option><option value="12">12 seconds</option><option value="16">16 seconds · relaxed</option></select></label><label>Speaking speed<select id="gl-speech-rate"><option value="0.7">Slow · 0.7×</option><option value="0.85">Natural · 0.85×</option><option value="1">Normal · 1×</option></select></label></div>
        <label>Learning voice<select id="gl-voice"><option value="">Best matching voice</option></select></label>
        <p id="gl-voice-note" class="gl-note">Uses matching device voices or supplied lesson audio. Any valid language code is accepted.</p>
        <p class="gl-note">Sentence mode creates word gates followed by a gold finish gate that reads the whole sentence once. Supply per-word translations in JSON when you want those too.</p>
        <p id="gl-error" class="gl-error" role="alert"></p>
      </div>
      <footer><button id="gl-cancel" class="gl-secondary">Cancel</button><button id="gl-apply" class="gl-primary">Use this lesson</button></footer>
    </section>
  </div>
  <div id="gl-basket-dialog" class="gl-overlay" role="dialog" aria-modal="true" aria-labelledby="gl-basket-title" hidden>
    <section class="gl-dialog gl-card"><header><div><span class="gl-eyebrow">YOUR COLLECTED WORDS</span><h2 id="gl-basket-title">Review basket</h2></div><button id="gl-close-basket" class="gl-close" aria-label="Close review basket">×</button></header>
      <div class="gl-dialog-body"><p id="gl-basket-summary" class="gl-note"></p><div id="gl-basket-list"></div></div>
      <footer><button id="gl-clear-basket" class="gl-text-button">Clear basket</button><button id="gl-export" class="gl-primary">Export to GoLingo ↓</button></footer>
    </section>
  </div><div id="gl-toast" class="gl-card" role="status" hidden></div>`;
  const host=document.createElement('div');host.id='gl-interface';host.innerHTML=markup;document.body.appendChild(host);
  const $=id=>document.getElementById(id);
  const PREFS_KEY='roadster-rush:preferences:v1',LESSON_KEY='roadster-rush:lesson:v1',REVIEW_KEY='roadster-rush:review:v1';
  function readStore(key,fallback){try{const value=localStorage.getItem(key);return value?JSON.parse(value):fallback;}catch{return fallback;}}
  function writeStore(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}
  const defaults={learningEnabled:true,showWord:true,showTranslation:false,repeat:true,driveMode:'practice',gateGap:12,speechRate:.85,voiceURI:''};
  const saved=readStore(PREFS_KEY,{});let prefs={...defaults,...(saved&&typeof saved==='object'?saved:{})};
  prefs.driveMode=prefs.driveMode==='rush'?'rush':'practice';prefs.gateGap=[9,12,16].includes(Number(prefs.gateGap))?Number(prefs.gateGap):12;prefs.speechRate=[.7,.85,1].includes(Number(prefs.speechRate))?Number(prefs.speechRate):.85;
  for(const name of ['learningEnabled','showWord','showTranslation','repeat'])if(typeof prefs[name]!=='boolean')prefs[name]=defaults[name];
  const demo={primaryLanguage:'en',learningLanguage:'es',mode:'words',words:[
    {id:'road',word:'la carretera',translation:'the road',sentence:'La carretera es larga.',sentenceTranslation:'The road is long.'},
    {id:'car',word:'el coche',translation:'the car',sentence:'Conduzco un coche blanco.',sentenceTranslation:'I drive a white car.'},
    {id:'sun',word:'el sol',translation:'the sun',sentence:'El sol está bajando.',sentenceTranslation:'The sun is setting.'},
    {id:'left',word:'a la izquierda',translation:'to the left',sentence:'Gira a la izquierda.',sentenceTranslation:'Turn left.'},
    {id:'right',word:'a la derecha',translation:'to the right',sentence:'Gira a la derecha.',sentenceTranslation:'Turn right.'},
    {id:'fly',word:'volar',translation:'to fly',sentence:'Me gusta volar.',sentenceTranslation:'I like to fly.'}
  ]};
  const gate=createWordGate(THREE,scene,{lanes});
  let ready=false,stageIndex=0,runGateCount=0,completedLaps=0,lastLane=1,nextWait=.4,recentStage=null,activeDialog=null,returnState=null,toastTimer=null,editorText='',editorLesson=null;
  const visited=new Set();
  function toast(message){$('gl-toast').textContent=String(message);$('gl-toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('gl-toast').hidden=true,4200);}
  const controller=createLearningController({preferences:prefs,onChange(){if(ready)render();},onStatus(status){if(ready)$('gl-audio-status').textContent=status.message||'';}});
  function countLabel(lesson){return lesson.mode==='sentences'?`${lesson.sentences.length} sentences · ${lesson.stages.length} gates`:`${lesson.words.length} words`;}
  function languageName(code){try{return new Intl.DisplayNames(['en'],{type:'language'}).of(code)||code;}catch{return code;}}
  function syncPreview(){const lesson=controller.getLesson();if($('start-lesson-label'))$('start-lesson-label').textContent=`${languageName(lesson.learningLanguage)} → ${languageName(lesson.primaryLanguage)}`;if($('start-lesson-count'))$('start-lesson-count').textContent=countLabel(lesson);$('gl-language-label').textContent=`${lesson.learningLanguage} / ${lesson.primaryLanguage}`;}
  function render(){
    const state=controller.getState(),stages=controller.getStages(),current=state.currentStage||recentStage;
    $('gl-hud').hidden=!prefs.learningEnabled;
    $('gl-progress').textContent=`${stageIndex} / ${stages.length} gates${completedLaps?' · lap '+(completedLaps+1):''}`;
    $('gl-progress-bar').style.width=(stages.length?stageIndex/stages.length*100:0)+'%';
    $('gl-current-word').textContent=current?(prefs.showWord?current.text:'Tap to hear the word'):'Find the word gate';
    $('gl-current-translation').textContent=current?.translation||'';$('gl-current-translation').hidden=!prefs.showTranslation||!current?.translation;
    $('gl-translation-toggle').textContent=prefs.showTranslation?'Hide translation':'Translation';$('gl-translation-toggle').setAttribute('aria-pressed',String(prefs.showTranslation));
    $('gl-voice-pause').textContent=state.speechPaused?'▶ Voice':'Ⅱ Voice';$('gl-voice-pause').setAttribute('aria-pressed',String(state.speechPaused));$('gl-voice-pause').title=state.speechPaused?'Resume repeating pronunciation':'Pause repeating pronunciation';
    $('gl-audio-status').textContent=state.audioMessage||'Tap the word to hear it.';
    if($('basket-count'))$('basket-count').textContent=state.reviewCount;
  }
  function resetLearningRun(){stageIndex=0;runGateCount=0;completedLaps=0;recentStage=null;visited.clear();gate.reset();nextWait=.4;controller.resetRun();if(ready)render();}
  function importWords(payload,options={}){const checked=normalizeLesson(payload);controller.load(checked,options);if(!options.append)resetLearningRun();writeStore(LESSON_KEY,controller.getLesson());if(ready){syncPreview();render();toast(`Loaded ${countLabel(controller.getLesson())}.`);}return {ok:true,count:controller.getLesson().words.length,stageCount:controller.getStages().length};}
  const bridge=installGoLingoBridge({importWords,getLesson:()=>controller.getLesson(),getReview:()=>controller.getReview(),exportReview:()=>exportReview(),onError:error=>toast(error.message||String(error))});
  try{controller.load(bridge.initialPayload||readStore(LESSON_KEY,null)||demo);}catch(error){controller.load(demo);toast('Could not read the saved lesson. '+error.message);}
  const storedReview=readStore(REVIEW_KEY,[]);if(Array.isArray(storedReview)){try{controller.setReview(storedReview);}catch{}}
  controller.setPreferences(prefs);gate.setPreferences(prefs);ready=true;
  function chooseLane(){let choices=lanes.map((_,i)=>i).filter(i=>i!==lastLane);const clear=choices.filter(i=>!getTraffic().some(v=>v.userData?.active&&Math.abs(v.position.x-lanes[i])<1.8&&Math.abs(v.position.z+getSpeed()*(1-(v.userData.speedRatio||.65))*prefs.gateGap)<25));if(clear.length)choices=clear;lastLane=choices[Math.floor(Math.random()*choices.length)]??1;return lastLane;}
  function spawnNext(first=false){const stages=controller.getStages();if(!prefs.learningEnabled||!stages.length)return;const z=-Math.max(first?120:230,getSpeed()*(first?4:prefs.gateGap));nextWait=Math.max(0,(-z-340)/Math.max(getSpeed(),1));gate.spawn(stages[stageIndex],chooseLane(),Math.max(z,-340));if(nextWait>0)gate.group.visible=false;}
  function finishGate(){
    const stages=controller.getStages(),stage=stages[stageIndex];if(!stage||!prefs.learningEnabled)return;
    if(!controller.collect(stageIndex))return;
    recentStage=stage;runGateCount++;visited.add(stage.id);onCollect(gate.group.position,stage.kind==='sentence'?0xffd495:0x89ffdf);onBonus(stage.kind==='sentence'?240:150,stage.kind==='sentence'?'SENTENCE COMPLETE':'WORD COLLECTED','text-sky-300');
    writeStore(REVIEW_KEY,controller.getReview());stageIndex++;
    if(stageIndex>=stages.length){completedLaps++;stageIndex=0;controller.beginLap();toast('Lesson complete! Keep driving to practise again. Your words are in the basket.');bridge.sendEvent('lessonComplete',{stageCount:stages.length,lap:completedLaps});}
    gate.reset();nextWait=.25;render();
  }
  function update(dt,step,player,time){
    if(!prefs.learningEnabled){$('gl-gate-direction').hidden=true;return;}
    if(nextWait>0){nextWait-=dt;if(nextWait<=0){if(gate.getState().active)gate.group.visible=true;else spawnNext(runGateCount===0);}return;}
    if(!gate.getState().active)spawnNext(runGateCount===0);
    const event=gate.update(dt,step,player,time);if(event?.type==='collect')finishGate();else if(event?.type==='miss'){toast('Gate missed. The same word is coming again.');nextWait=.25;}
    const state=gate.getState();$('gl-gate-direction').hidden=!state.active||!gate.group.visible;
    if(state.active){const dx=lanes[state.lane]-player.position.x,arrow=Math.abs(dx)<1?'↑':dx<0?'←':'→';$('gl-gate-direction').textContent=`${arrow} ${state.kind==='sentence'?'Sentence finish':'Word gate'} · lane ${state.lane+1} · ${Math.max(0,Math.round(-state.z*.45))} m`;}
  }
  function startSession(){resetLearningRun();controller.setSuspended(!prefs.learningEnabled);controller.startFromGesture();render();}
  function setSuspended(value){controller.setSuspended(!!value||!prefs.learningEnabled);}
  function openDialog(id){if(activeDialog)$(activeDialog).hidden=true;else returnState=getGameState();activeDialog=id;if(getGameState()==='PLAYING')onPause?.();setSuspended(true);$(id).hidden=false;if(id==='gl-lesson-dialog')fillEditor();else renderBasket();setTimeout(()=>$(id).querySelector('button')?.focus({preventScroll:true}),0);}
  function closeDialog(){if(!activeDialog)return;$(activeDialog).hidden=true;activeDialog=null;const previous=returnState;returnState=null;if(previous==='PLAYING'&&getGameState()==='PAUSED'){controller.startFromGesture();onResume?.();}else setSuspended(getGameState()!=='PLAYING');}
  function quote(value){const s=String(value??'');return /[|\\"\t\r\n]/.test(s)?'"'+s.replace(/\\/g,'\\\\').replace(/"/g,'""')+'"':s;}
  function fillEditor(){
    const lesson=controller.getLesson();editorLesson=lesson;$('gl-learning-language').value=lesson.learningLanguage;$('gl-primary-language').value=lesson.primaryLanguage;$('gl-lesson-mode').value=lesson.mode;
    editorText=lesson.mode==='sentences'?lesson.sentences.map(s=>[s.sentence,s.translation].map(quote).join(' | ')).join('\n'):lesson.words.map(w=>[w.word,w.translation,w.sentence,w.sentenceTranslation].map(quote).join(' | ').replace(/(?: \| )+$/,'')).join('\n');$('gl-lesson-input').value=editorText;
    $('gl-drive-mode').value=prefs.driveMode;$('gl-gate-gap').value=prefs.gateGap;$('gl-speech-rate').value=prefs.speechRate;
    for(const [id,key] of [['gl-learning-enabled','learningEnabled'],['gl-show-word','showWord'],['gl-show-translation','showTranslation'],['gl-repeat','repeat']])$(id).checked=prefs[key];$('gl-error').textContent='';updateHint();refreshVoices();
  }
  function updateHint(){$('gl-input-hint').textContent=$('gl-lesson-mode').value==='sentences'?'One sentence | translation per line, or JSON with per-word translations.':'One word | translation | optional sentence | sentence translation per line.';}
  function refreshVoices(){
    const select=$('gl-voice'),lang=$('gl-learning-language').value||controller.getLesson().learningLanguage;let voices=[];try{voices=window.speechSynthesis?.getVoices()||[];}catch{}
    const matches=voices.filter(v=>v.lang?.toLowerCase().split('-')[0]===lang.toLowerCase().split('-')[0]);select.replaceChildren(new Option('Best matching voice',''));for(const v of matches)select.add(new Option(`${v.name} (${v.lang})`,v.voiceURI));if(matches.some(v=>v.voiceURI===prefs.voiceURI))select.value=prefs.voiceURI;
    $('gl-voice-note').textContent=matches.length?`${matches.length} matching device voice${matches.length===1?'':'s'}. Supplied recordings take priority.`:'No matching device voice is listed yet. Use supplied lesson audio or enable a voice for this language on your device.';
  }
  function applyEditor(){
    try{
      const value=$('gl-lesson-input').value.trim(),mode=$('gl-lesson-mode').value,learningLanguage=$('gl-learning-language').value.trim(),primaryLanguage=$('gl-primary-language').value.trim();
      if(!learningLanguage||!primaryLanguage)throw new Error('Enter both language codes, such as es and en.');Intl.getCanonicalLocales(learningLanguage);Intl.getCanonicalLocales(primaryLanguage);if(!value)throw new Error('Add at least one word or sentence.');
      let payload;
      if(value===editorText.trim()&&mode===editorLesson?.mode){
        payload=editorLesson;
        if(learningLanguage!==editorLesson.learningLanguage||primaryLanguage!==editorLesson.primaryLanguage){
          const relabel=row=>({...row,learningLanguage,primaryLanguage,translationLanguage:primaryLanguage});
          payload={...editorLesson,learningLanguage,primaryLanguage,translationLanguage:primaryLanguage,words:editorLesson.words.map(relabel),sentences:editorLesson.sentences.map(s=>({...relabel(s),words:s.words.map(relabel)}))};
        }
      }
      else payload=/^[\[{]/.test(value)?JSON.parse(value):parseLessonText(value,{mode,learningLanguage,primaryLanguage});
      const checked=normalizeLesson(payload),previous=controller.getLesson();
      const oldContent=JSON.stringify([previous.words,previous.sentences,previous.learningLanguage,previous.primaryLanguage,previous.mode]);
      const newContent=JSON.stringify([checked.words,checked.sentences,checked.learningLanguage,checked.primaryLanguage,checked.mode]);
      prefs={...prefs,driveMode:$('gl-drive-mode').value,gateGap:Number($('gl-gate-gap').value),speechRate:Number($('gl-speech-rate').value),learningEnabled:$('gl-learning-enabled').checked,showWord:$('gl-show-word').checked,showTranslation:$('gl-show-translation').checked,repeat:$('gl-repeat').checked,voiceURI:$('gl-voice').value};
      if(oldContent!==newContent)importWords(checked);controller.setPreferences(prefs);gate.setPreferences(prefs);writeStore(PREFS_KEY,prefs);if(!prefs.learningEnabled)gate.reset();syncPreview();render();closeDialog();toast(oldContent!==newContent?'Lesson ready. Find the turquoise gates.':'Learning settings updated.');
    }catch(error){$('gl-error').textContent=error.message||String(error);}
  }
  function renderBasket(){
    const review=controller.getReview(),list=$('gl-basket-list');list.replaceChildren();$('gl-basket-summary').textContent=`${review.length} collected item${review.length===1?'':'s'}. Tap a speaker to practise. Your basket stays saved between runs.`;$('gl-export').disabled=!review.length;$('gl-clear-basket').disabled=!review.length;
    if(!review.length){const p=document.createElement('p');p.className='gl-note';p.textContent='Drive through a word gate to collect your first word.';list.append(p);return;}
    for(const entry of review){const row=document.createElement('article');row.className='gl-review-row';const title=document.createElement('strong');title.textContent=entry.word||entry.text||entry.sentence;title.dir='auto';const translation=document.createElement('p');translation.textContent=entry.translation||entry.sentenceTranslation||'';translation.dir='auto';const detail=document.createElement('small');detail.textContent=[entry.sentence&&entry.sentence!==title.textContent?entry.sentence:'',entry.sentenceTranslation||'',`${entry.learningLanguage} · practised ${entry.occurrences||1}×`].filter(Boolean).join(' · ');detail.dir='auto';const button=document.createElement('button');button.textContent='▷';button.title='Hear '+title.textContent;button.setAttribute('aria-label',button.title);button.onclick=()=>controller.preview(entry);row.append(title,translation,detail,button);list.append(row);}
  }
  function exportReview(){
    const lesson=controller.getLesson(),words=controller.getReview().map(v=>({...v,word:v.word||v.text||v.sentence,translation:v.translation||v.sentenceTranslation||''}));if(!words.length){toast('Collect a word before exporting.');return {ok:false,error:'The basket is empty.'};}
    const payload={primaryLanguage:lesson.primaryLanguage,translationLanguage:lesson.primaryLanguage,learningLanguage:lesson.learningLanguage,source:'roadster-rush',exportedAt:new Date().toISOString(),words};let native=false;try{const handler=window.webkit?.messageHandlers?.golingoExport;if(handler){handler.postMessage(payload);native=true;}}catch{}
    if(!native){const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='Roadster-Rush-GoLingo-Review.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}toast(native?'Review sent to GoLingo.':'Review exported as GoLingo JSON.');return payload;
  }
  for(const id of ['lesson-btn','edit-lesson-btn','gameover-lesson'])if($(id))$(id).onclick=()=>openDialog('gl-lesson-dialog');
  for(const id of ['basket-btn','gameover-review'])if($(id))$(id).onclick=()=>openDialog('gl-basket-dialog');
  $('gl-close-lesson').onclick=closeDialog;$('gl-cancel').onclick=closeDialog;$('gl-close-basket').onclick=closeDialog;$('gl-apply').onclick=applyEditor;
  $('gl-lesson-mode').onchange=updateHint;$('gl-learning-language').onchange=refreshVoices;
  $('gl-voice-pause').onclick=()=>{controller.startFromGesture();controller.toggleSpeechPause();};$('gl-current-word').onclick=()=>controller.replayCurrent();$('gl-current-translation').onclick=()=>controller.speakTranslation();
  $('gl-translation-toggle').onclick=()=>{prefs.showTranslation=!prefs.showTranslation;controller.setPreferences(prefs);gate.setPreferences(prefs);writeStore(PREFS_KEY,prefs);render();if(prefs.showTranslation)controller.speakTranslation();};
  $('gl-demo').onclick=()=>{$('gl-lesson-mode').value='words';$('gl-learning-language').value='es';$('gl-primary-language').value='en';$('gl-lesson-input').value=demo.words.map(w=>[w.word,w.translation,w.sentence,w.sentenceTranslation].join(' | ')).join('\n');editorLesson=null;editorText='';updateHint();refreshVoices();};
  $('gl-import-file').onclick=()=>$('gl-file').click();$('gl-file').onchange=async()=>{const f=$('gl-file').files[0];if(!f)return;try{if(f.size>100000)throw new Error('Choose a file smaller than 100 KB.');$('gl-lesson-input').value=await f.text();$('gl-error').textContent='';}catch(error){$('gl-error').textContent=error.message;}$('gl-file').value='';};
  $('gl-clear-basket').onclick=()=>{controller.clearReview();writeStore(REVIEW_KEY,[]);renderBasket();toast('Basket cleared. Keep driving to collect more words.');};$('gl-export').onclick=exportReview;
  document.addEventListener('keydown',event=>{if(!activeDialog)return;if(event.code==='Escape'){event.preventDefault();closeDialog();}if(event.code==='Tab'){const controls=[...$(activeDialog).querySelectorAll('button:not(:disabled),input:not([hidden]),select,textarea')].filter(e=>e.offsetParent!==null),first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)setSuspended(true);else setSuspended(getGameState()!=='PLAYING'||!!activeDialog);});
  window.speechSynthesis?.addEventListener?.('voiceschanged',refreshVoices);
  syncPreview();render();bridge.activate();
  return {update,startSession,setSuspended,resetLearningRun,settings:()=>({...prefs}),reserveLane:()=>gate.getState().active?gate.getState().lane:-1,toast,exportReview,controller,hasDialog:()=>!!activeDialog,
    getState:()=>({stageCount:controller.getStages().length,progress:runGateCount,stageIndex,completedLaps,visitedCount:visited.size,gate:{...gate.getState(),stageIndex},speechPaused:controller.getState().speechPaused,showTranslation:prefs.showTranslation,reviewCount:controller.getReview().length}),
    debug:{collectGate:finishGate,missGate(){gate.reset();nextWait=.25;toast('Gate missed. The same word is coming again.');}}
  };
}
