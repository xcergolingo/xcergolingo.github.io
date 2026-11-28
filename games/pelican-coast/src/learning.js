const sample={primaryLanguage:'en',learningLanguage:'ja',words:[{word:'海',translation:'sea'},{word:'鳥',translation:'bird'},{word:'自転車',translation:'bicycle'},{word:'空',translation:'sky'},{word:'水',translation:'water'},{word:'風',translation:'wind'},{word:'太陽',translation:'sun'},{word:'道',translation:'road'},{word:'魚',translation:'fish'}]};
function loadLesson(){
 const p=new URLSearchParams(location.hash.slice(1)),q=new URLSearchParams(location.search);
 for(const k of ['data','golingo','golingoLesson','lesson']){
  const raw=p.get(k)||q.get(k);if(!raw)continue;
  try{const j=JSON.parse(raw);if(j&&typeof j==='object'&&!Array.isArray(j))return j}catch{}
 }
 return sample;
}
export function createLearning(){
 const d=loadLesson(),list=['words','sentences','phrases','items','entries'].flatMap(k=>Array.isArray(d[k])?d[k]:[]);
 const entries=list.map((x,i)=>typeof x==='string'?{id:String(i),word:x,translation:''}:{id:String(x?.id??i),word:String(x?.word??x?.text??x?.sentence??x?.phrase??''),translation:String(x?.translation??x?.meaning??x?.sentenceTranslation??x?.phraseTranslation??''),sentence:String(x?.sentence??'')}).filter(x=>x.word.trim()).slice(0,500);
 if(!entries.length)entries.push(...sample.words);
 const learningLang=d.learningLanguage||d.language||'ja',primaryLang=d.primaryLanguage||'en';
 let mode='learn',index=0,started=false,paused=false,repeat=true,showWord=false,showMeaning=false,token=0,timer=null,steerValue=0;
 const collected=[],$=id=>document.getElementById(id);
 const word=$('learning-word'),meaning=$('learning-meaning'),prompt=$('learning-prompt');
 function stop(){token++;clearTimeout(timer);speechSynthesis?.cancel();}
 function speak(text,lang,t=token){
  if(!text||!started||paused||!('speechSynthesis'in window))return;
  const u=new SpeechSynthesisUtterance(text);u.lang=lang;u.rate=.9;
  const again=()=>{if(t===token&&repeat&&!paused)timer=setTimeout(()=>speak(text,lang,t),700)};
  u.onend=again;u.onerror=again;speechSynthesis.speak(u);
 }
 function play(){stop();const a=entries[index];if(started&&!paused)speak(mode==='meaning'?(a.translation||a.word):a.word,mode==='meaning'?primaryLang:learningLang)}
 function render(){
  const a=entries[index];
  word.textContent=showWord?a.word:'Aa to reveal word';
  meaning.textContent=showMeaning?a.translation:'';
  prompt.textContent=mode==='learn'?'Catch a fish to learn a word':mode==='listen'?'Listen and find the spoken word':'Find: '+(a.translation||a.word);
  $('learning-count').textContent=collected.length+' collected';
  document.querySelectorAll('[data-learn-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.learnMode===mode));
 }
 function setCurrent(n){index=(n+entries.length)%entries.length;render();play()}
 function collect(i){
  collected.push({...entries[i],collectedAt:new Date().toISOString()});
  if(mode==='learn')setCurrent(i);else setCurrent((i+1)%entries.length);
 }
 function canCollect(i){if(mode==='learn'||i===index)return true;prompt.textContent='Try another fish';return false}
 function setPaused(v){if(paused===v)return;paused=v;if(paused)stop();else play()}
 document.querySelectorAll('[data-learn-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.learnMode;setCurrent(index)}));
 $('learn-word').addEventListener('click',()=>{showWord=!showWord;render()});
 $('learn-meaning').addEventListener('click',()=>{showMeaning=!showMeaning;render()});
 $('learn-repeat').addEventListener('click',e=>{repeat=!repeat;e.currentTarget.classList.toggle('selected',repeat);if(repeat)play();else stop()});
 $('learn-next').addEventListener('click',()=>setCurrent(index+1));
 $('learn-prev').addEventListener('click',()=>setCurrent(index-1));
 $('learn-pause').addEventListener('click',()=>window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyP'})));
 $('learn-export').addEventListener('click',()=>{
  const b=new Blob([JSON.stringify({primaryLanguage:primaryLang,learningLanguage:learningLang,words:collected},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='pelican-coast-basket.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
 });
 const wheel=$('learn-wheel'),knob=$('learn-knob');
 function steer(e){const r=wheel.getBoundingClientRect();steerValue=Math.max(-1,Math.min(1,(e.clientX-r.left-r.width/2)/(r.width*.43)));knob.style.transform='rotate('+steerValue*70+'deg)'}
 wheel.addEventListener('pointerdown',e=>{wheel.setPointerCapture(e.pointerId);steer(e);e.preventDefault()});
 wheel.addEventListener('pointermove',e=>{if(wheel.hasPointerCapture(e.pointerId)){steer(e);e.preventDefault()}});
 const release=()=>{steerValue=0;knob.style.transform=''};
 wheel.addEventListener('pointerup',release);wheel.addEventListener('pointercancel',release);
 render();
 return {entries,get steerValue(){return steerValue},start(){started=true;$('learning-hud').hidden=false;setCurrent(0)},setPaused,collect,canCollect};
}
