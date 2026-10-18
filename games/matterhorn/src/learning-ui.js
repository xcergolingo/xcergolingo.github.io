import {parseLesson,DEMO_TEXT,PHRASE_DEMO,SENTENCE_EXAMPLE,PHRASE_EXAMPLE,lessonRunCount,lessonJSON,lessonRun,lessonFromURL} from './lessons.js';
import {makeLessonRun} from './lesson-run.js';
import {LessonSpeech} from './lesson-speech.js';
import {bindGameTap} from './game-interaction.js';
const $=id=>document.getElementById(id),read=(k,d=null)=>{try{return localStorage.getItem('neon-stream:'+k)??d;}catch{return d;}},write=(k,v)=>{try{localStorage.setItem('neon-stream:'+k,v);}catch{}};
export class LearningUI{
 constructor(callbacks){
  this.cb=callbacks;this.enabled=read('lesson-enabled','1')!=='0';this.index=0;this.run=null;this.current=null;this.visited=new Set();this.showTranslations=read('translations','1')!=='0';this.editorOpen=false;
  try{this.lesson=parseLesson(JSON.parse(read('lesson','null')));}catch{this.lesson=parseLesson(DEMO_TEXT);}
  this.shared=false;try{const incoming=lessonFromURL(globalThis.location);if(incoming){this.lesson=incoming;this.enabled=this.shared=true;this.index=0;write('lesson',JSON.stringify(lessonJSON(incoming)));write('lesson-enabled','1');}}catch(e){this.importError=e.message;}
  this.speech=new LessonSpeech({onState:s=>this.speechState(s)});this.speech.voiceURI=read('voice','');this.speech.rate=Number(read('speech-rate','.85'));
  $('lesson-source').value=this.shared?JSON.stringify(lessonJSON(this.lesson),null,2):read('lesson-draft',JSON.stringify(lessonJSON(this.lesson),null,2));$('lesson-language').value=this.lesson.language;$('translation-language').value=this.lesson.translationLanguage;
  $('show-translations').checked=this.showTranslations;$('speech-rate').value=this.speech.rate;$('speech-rate-value').textContent=this.speech.rate.toFixed(2)+'×';
  this.formMode=this.lesson.mode;this.bind();this.voices();this.preview();this.updateMenu();
  globalThis.speechSynthesis?.addEventListener?.('voiceschanged',()=>this.voices());
 }
 prepare(){this.speech.stop();this.speech.suspended=false;this.visited.clear();this.current=null;this.run=this.enabled?makeLessonRun(this.lesson,this.index):null;document.body.classList.toggle('learning',!!this.run);$('repeat-controls').hidden=!this.run;$('lesson-progress').hidden=!this.run;$('finish-learning').hidden=!this.run;return this.run;}
 startGesture(){if(!this.run)return;this.current=this.run.units[0];this.speech.set(this.current.text,this.run.language,{loop:true});this.updateProgress();}
 pass(g){if(!this.run||!g.learning)return;this.current=g.unit;this.visited.add(g.index);this.speech.set(g.unit.text,this.run.language,{loop:true});this.updateProgress();}
 updateProgress(){if(!this.run)return;const r=this.run;$('lesson-progress').textContent=`${r.mode==='sentences'?'SENTENCE':'VOCABULARY RUN'} ${r.index+1} / ${r.count}  ·  ${this.visited.size} / ${r.units.length} ${r.mode==='sentences'?'WORDS':'ITEMS'}`;}
 speechState(state){
  this.lastSpeechState=state;const b=$('voice-pause'),paused=!!this.speech?.userPaused,fallback=state==='tap-to-hear';
  b.textContent=state==='unsupported'?'AUDIO UNAVAILABLE':fallback?'▶ ENABLE REPEAT':paused?'▶ RESUME REPEAT':state==='retrying'?'RETRYING AUDIO · PAUSE':'Ⅱ PAUSE REPEAT';b.disabled=state==='unsupported';b.setAttribute('aria-pressed',String(!paused&&!fallback));
  $('repeat-status').textContent=state==='unsupported'?'Text-to-speech is unavailable in this browser.':fallback?'Tap Enable Repeat to start pronunciation.':paused?'Word repetition paused':state==='speaking'?'Speaking':state==='waiting'?'Repeating':'';
 }
 toggleRepeat(){if(this.lastSpeechState==='tap-to-hear'){this.speech.userPaused=false;this.hear();}else if(this.speech.userPaused)this.speech.resume();else this.speech.pause();}
 hear(text=this.current?.text,language=this.run?.language||this.lesson.language){if(!text)return;this.speech.suspended=false;this.speech.set(text,language,{loop:!!this.run&&this.cb.mode()==='playing',force:true});}
 suspend(value){this.speech.suspend(value);}
 stop(){this.speech.stop();}
 finish(){
  if(!this.run){$('finish-learning').hidden=true;return;}const r=this.run;$('finish-learning').hidden=false;
  $('finish-location').textContent=r.mode==='sentences'?`SENTENCE ${r.index+1} / ${r.count} COMPLETE`:`VOCABULARY RUN ${r.index+1} / ${r.count}`;
  $('finish-title').textContent=r.mode==='sentences'?'Your whole sentence.':'Your words, collected.';
  $('finish-source').textContent=r.text;$('finish-translation').textContent=r.translation;$('finish-translation').hidden=!this.showTranslations||!r.translation;
  $('finish-learning-caption').textContent=r.mode==='sentences'?'WHOLE SENTENCE':'WORDS & PHRASES';
  $('finish-note').textContent=`${this.visited.size} / ${r.units.length} ${r.mode==='sentences'?'words':'items'} collected. Tap any word below to hear it.`;
  $('finish-words').replaceChildren();for(const [i,u]of r.units.entries()){const b=document.createElement('button');b.type='button';b.textContent=u.text;b.className=this.visited.has(i)?'learned':'missed';b.title=u.translation||u.text;b.addEventListener('click',()=>this.hear(u.text,r.language));$('finish-words').append(b);}
  $('again').firstChild.textContent=r.index+1<r.count?(r.mode==='sentences'?'NEXT SENTENCE ':'NEXT VOCABULARY RUN '):'PRACTICE LESSON AGAIN ';
  $('repeat-run').hidden=false;$('finish-hear-translation').hidden=!r.translation;
  const text=r.mode==='sentences'?r.text:r.units.map(u=>u.text).join('. ');this.speech.set(text,r.language,{loop:false});
  // Focusing the bottom action used to scroll the sentence off-screen on
  // phones. Start at the sentence and keep the result panel at its top.
  const panel=$('finish-menu').querySelector('.modal');if(panel)panel.scrollTop=0;
  $('finish-source').setAttribute('lang',r.language);$('finish-source').focus({preventScroll:true});
 }
 next(){if(this.run)this.index=(this.index+1)%lessonRunCount(this.lesson);}
 setEnabled(enabled){this.enabled=enabled;write('lesson-enabled',enabled?'1':'0');this.updateMenu();}
 updateMenu(){const n=this.lesson.items.length;$('lesson-summary').textContent=`${this.lesson.mode==='sentences'?`${n} sentences`:`${n} words / phrases`} · ${this.lesson.language}`;$('start').firstChild.textContent=this.enabled?'START LESSON ':'DROP IN ';$('open-lesson').firstChild.textContent=this.enabled?'EDIT YOUR LESSON ':'LEARN LANGUAGES ';$('free-ski').textContent=this.enabled?'FREE SKI':'SAVED LESSON';document.querySelector('.course-facts').hidden=this.enabled;}
 open(){if(this.cb.mode()==='playing')this.cb.pause();this.editorOpen=true;$('lesson-editor').hidden=false;this.voices();this.preview();$('lesson-source').focus({preventScroll:true});}
 close(){this.editorOpen=false;$('lesson-editor').hidden=true;if(this.cb.mode()==='paused'){this.speech.suspend(true);if(this.run&&this.current)this.speech.set(this.current.text,this.run.language,{loop:true});}}
 formOptions(){return {mode:this.formMode,language:$('lesson-language').value,translationLanguage:$('translation-language').value};}
 preview(){
  try{const lesson=parseLesson($('lesson-source').value,this.formOptions());this.formMode=lesson.mode;
   const changed=$('lesson-language').value!==lesson.language;$('lesson-language').value=lesson.language;$('translation-language').value=lesson.translationLanguage;if(changed)this.voices();
   const first=lessonRun(lesson,0);$('lesson-preview').textContent=`${lesson.mode==='sentences'?lesson.items.length+' sentences, one descent per sentence':lesson.items.length+' words / phrases'} · ${lesson.language} → ${lesson.translationLanguage}. First run: ${first.units.length} rings.`;$('lesson-error').textContent='';$('save-lesson').disabled=false;this.formLesson=lesson;
  }catch(e){$('lesson-error').textContent=e.message;$('lesson-preview').textContent='';$('save-lesson').disabled=true;this.formLesson=null;}
  document.querySelectorAll('[data-lesson-mode]').forEach(b=>{const on=b.dataset.lessonMode===this.formMode;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on);});
 }
 setFormMode(mode){
  this.formMode=mode;const t=$('lesson-source').value.trim();try{const a=JSON.parse(t);if(a&&!Array.isArray(a)){a.type=mode;delete a.mode;$('lesson-source').value=JSON.stringify(a,null,2);}}catch{const rows=t.split(/\r?\n/);if(/^(#\s*)?(sentences?|phrases?|words|words\/phrases|vocabulary)\s*:?$/i.test(rows[0]))rows[0]=mode;else rows.unshift(mode);$('lesson-source').value=rows.join('\n');}this.preview();
 }
 voices(){
  const select=$('lesson-voice'),saved=select.value||this.speech.voiceURI;select.replaceChildren();const a=document.createElement('option');a.value='';a.textContent='Automatic voice for learning language';select.append(a);
  const lang=$('lesson-language').value.toLowerCase().split('-')[0],voices=this.speech.engine?.getVoices?.()||[];
  for(const v of voices.filter(v=>v.lang?.toLowerCase().split('-')[0]===lang)){const o=document.createElement('option');o.value=v.voiceURI;o.textContent=`${v.name} · ${v.lang}`;select.append(o);}select.value=saved;if(select.selectedIndex<0)select.value='';
  const list=$('language-tags');list.replaceChildren();for(const tag of new Set(voices.map(v=>v.lang).filter(Boolean))){const o=document.createElement('option');o.value=tag;list.append(o);}
 }
 importText(text){$('lesson-source').value=text;try{const a=parseLesson(text,this.formOptions());$('lesson-language').value=a.language;$('translation-language').value=a.translationLanguage;this.formMode=a.mode;}catch{}this.voices();this.preview();}
 download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 bind(){
  $('open-lesson').addEventListener('click',()=>this.open());$('pause-edit-lesson').addEventListener('click',()=>this.open());$('finish-edit-lesson').addEventListener('click',()=>this.open());$('close-lesson').addEventListener('click',()=>this.close());
  $('lesson-source').addEventListener('input',()=>this.preview());document.querySelectorAll('[data-lesson-mode]').forEach(b=>b.addEventListener('click',()=>this.setFormMode(b.dataset.lessonMode)));
  for(const id of ['lesson-language','translation-language'])$(id).addEventListener('change',()=>{
   const type=id==='lesson-language'?'language':'translationLanguage',value=$(id).value;try{const a=JSON.parse($('lesson-source').value);if(a&&!Array.isArray(a)){a[type]=value;$('lesson-source').value=JSON.stringify(a,null,2);}}catch{$('lesson-source').value=$('lesson-source').value.replace(new RegExp('^'+type+'\\s*[:=].*$','gmi'),type+': '+value);}
   this.voices();this.preview();
  });
  $('save-lesson').addEventListener('click',()=>{
   try{const lesson=parseLesson($('lesson-source').value,this.formOptions());this.lesson=lesson;this.index=0;this.enabled=true;this.speech.voiceURI=$('lesson-voice').value;this.speech.rate=Number($('speech-rate').value);write('voice',this.speech.voiceURI);write('speech-rate',this.speech.rate);write('lesson',JSON.stringify(lessonJSON(lesson)));write('lesson-draft',$('lesson-source').value);write('lesson-enabled','1');this.updateMenu();this.close();this.cb.apply();}catch(e){$('lesson-error').textContent=e.message;}
  });
  $('speech-rate').addEventListener('input',()=>{$('speech-rate-value').textContent=Number($('speech-rate').value).toFixed(2)+'×';this.speech.rate=Number($('speech-rate').value);});
  $('test-voice').addEventListener('click',()=>{this.preview();if(!this.formLesson)return;const r=lessonRun(this.formLesson,0);this.speech.voiceURI=$('lesson-voice').value;this.speech.suspended=false;this.speech.preview(r.units[0].text,r.language);});
  $('show-translations').addEventListener('change',()=>{this.showTranslations=$('show-translations').checked;write('translations',this.showTranslations?'1':'0');$('finish-translation').hidden=!this.showTranslations||!this.run?.translation;});
  $('load-sentence-sample').addEventListener('click',()=>this.importText(DEMO_TEXT));$('load-phrase-sample').addEventListener('click',()=>this.importText(PHRASE_DEMO));
  $('import-lesson').addEventListener('click',()=>$('lesson-file').click());$('lesson-file').addEventListener('change',async()=>{const f=$('lesson-file').files?.[0];if(!f)return;if(f.size>2000000){$('lesson-error').textContent='Use a JSON or text file smaller than 2 MB.';return;}try{this.importText(await f.text());}catch{$('lesson-error').textContent='This file could not be read.';}$('lesson-file').value='';});
  $('example-json').addEventListener('click',()=>this.download(this.formMode==='sentences'?SENTENCE_EXAMPLE:PHRASE_EXAMPLE,`GoLingo-Ski-${this.formMode}.json`));$('export-lesson').addEventListener('click',()=>{this.preview();if(this.formLesson)this.download(lessonJSON(this.formLesson),'GoLingo-Ski-Lesson.json');});
  bindGameTap($('voice-pause'),()=>this.toggleRepeat(),{canTap:()=>this.cb.canControl?.()??true});
  $('finish-hear').addEventListener('click',()=>{if(!this.run)return;this.speech.suspended=false;this.speech.preview(this.run.mode==='sentences'?this.run.text:this.run.units.map(u=>u.text).join('. '),this.run.language);});
  $('finish-hear-translation').addEventListener('click',()=>{if(!this.run?.translation)return;this.speech.suspended=false;this.speech.preview(this.run.translation,this.run.translationLanguage);});
  const resize=()=>document.documentElement.style.setProperty('--editor-height',(globalThis.visualViewport?.height||innerHeight)+'px');globalThis.visualViewport?.addEventListener('resize',resize);resize();
 }
}
