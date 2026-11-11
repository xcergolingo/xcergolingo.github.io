import {SkyWorld} from './world.js';
import {CanvasWorld} from './fallback.js';
import {LANGUAGE_NAMES,VOICE_CODES,defaultDeck,normalizePayload,findInitialPayload} from './data.js';

const $=id=>document.getElementById(id);
const ui={
  hud:$('hud'),alt:$('altitude-number'),altBar:$('fall-progress'),mode:$('flight-mode'),speed:$('speed-number'),
  prompt:$('prompt-word'),hint:$('challenge-hint'),score:$('score-number'),round:$('round-count'),
  toast:$('toast'),status:$('status-bottom'),statusCopy:$('status-copy'),wind:$('wind-copy'),controls:$('touch-controls'),
  deploy:$('deploy-button'),chuteStatus:$('chute-status'),start:$('start-screen'),pause:$('pause-screen'),end:$('end-screen'),
  select:$('language-select'),importNote:$('import-note'),sound:$('sound-button'),camera:$('camera-button'),
  knob:$('joystick-knob'),joystick:$('joystick'),brake:$('brake-button'),studySwitch:$('study-switch'),studyLabel:$('study-switch-label'),challengeLabel:$('challenge-label')
};

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const rand=(a,b)=>a+Math.random()*(b-a);
let world;
try{
  const probe=document.createElement('canvas');
  if(!probe.getContext('webgl2')&&!probe.getContext('webgl'))throw new Error('WebGL is unavailable');
  world=new SkyWorld($('sky-scene'));
}catch(error){
  console.info('Using the compatible Canvas2D flight view:',error.message);
  $('sky-scene').replaceChildren();
  world=new CanvasWorld($('sky-scene'));
}
const fx=$('effects'),fxctx=fx.getContext('2d');
const state={phase:'ready',x:0,z:1500,alt:1750,vx:0,vy:0,vz:-30,elapsed:0,score:0,combo:0,index:0,attempts:0,misses:0,correct:0,wrong:0,
  collected:[],deck:[],rings:[],ringAltitude:-1,chuteReady:false,chuteScale:0,steerX:0,steerY:0,brake:false,
  language:'es',primaryLanguage:'en',landed:false,landingZone:{x:0,z:-650},wind:4,easy:true,glideTarget:0,currentWord:null,targetWord:null,studyMode:'learn'};
let imported=null,soundOn=true,lastFrame=performance.now(),toastTimer=0,repeatTimer=0,wordAudio=null;
let gameEnded=false,pointerState=null,scenePointer=null;
const keys=new Set();
let windContext=null,windGain=null,windFilter=null;

function setupWind(){
  if(windContext||!soundOn)return;
  try{
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context)return;
    windContext=new Context();
    const buffer=windContext.createBuffer(1,windContext.sampleRate*2,windContext.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.45;
    const noise=windContext.createBufferSource();noise.buffer=buffer;noise.loop=true;
    windFilter=windContext.createBiquadFilter();windFilter.type='lowpass';windFilter.frequency.value=1150;
    windGain=windContext.createGain();windGain.gain.value=0;
    noise.connect(windFilter).connect(windGain).connect(windContext.destination);
    noise.start();windContext.resume().catch(()=>{});
  }catch(error){console.info('Wind ambience unavailable:',error.message);windContext=null;}
}
function updateWind(){
  if(!windContext||!windGain||!windFilter)return;
  const volume=soundOn&&inFlight()?(state.phase==='chute'?.009:.028):0;
  windGain.gain.setTargetAtTime(volume,windContext.currentTime,.24);
  windFilter.frequency.setTargetAtTime(state.phase==='chute'?460:1150,windContext.currentTime,.7);
}

function resize(){
  const dpr=Math.min(window.devicePixelRatio||1,2);
  fx.width=Math.round(innerWidth*dpr);fx.height=Math.round(innerHeight*dpr);
  fx.style.width=innerWidth+'px';fx.style.height=innerHeight+'px';
  fxctx.setTransform(dpr,0,0,dpr,0,0);
  world.resize();
}
addEventListener('resize',resize,{passive:true});
resize();

function toast(message,bad=false){
  ui.toast.textContent=message;ui.toast.classList.toggle('wrong',bad);ui.toast.classList.add('on');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.classList.remove('on'),2050);
}

function speak(text,language='en',slow=false){
  if(!soundOn||!text||!('speechSynthesis'in window))return;
  try{
    speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(String(text).slice(0,170));
    utterance.lang=VOICE_CODES[language]||language||'en-US';
    utterance.rate=slow?.83:.94;utterance.pitch=1.02;utterance.volume=1;
    const voices=speechSynthesis.getVoices();
    const match=voices.find(v=>v.lang.toLowerCase()===utterance.lang.toLowerCase())||voices.find(v=>v.lang.toLowerCase().startsWith(utterance.lang.slice(0,2).toLowerCase()));
    if(match)utterance.voice=match;
    speechSynthesis.speak(utterance);
  }catch(err){console.warn('Speech unavailable',err);}
}
function unlockSpeech(){
  if(!soundOn||!('speechSynthesis'in window))return;
  try{
    const warmup=new SpeechSynthesisUtterance(' ');warmup.volume=0;
    speechSynthesis.speak(warmup);
  }catch{}
}

const inFlight=()=>state.phase==='freefall'||state.phase==='chute';
function stopRepeating(){
  clearTimeout(repeatTimer);repeatTimer=0;
  if(wordAudio){wordAudio.pause();wordAudio=null;}
  try{speechSynthesis.cancel();}catch{}
}
function voiceWord(){return state.studyMode==='learn'?state.currentWord:state.targetWord;}
function playCurrentWord(){
  const word=voiceWord();if(!word||!inFlight()||!soundOn)return;
  if(wordAudio){wordAudio.pause();wordAudio=null;}
  if(state.studyMode==='knowledge'){
    speak(word.translation||word.sentenceTranslation||word.word,state.primaryLanguage,false);return;
  }
  const url=word.audioUrl;
  if(url&&/^(https?:\/\/|\/|\.\/)/i.test(url)){
    try{
      const audio=new Audio(url);wordAudio=audio;
      audio.play().catch(()=>{if(wordAudio===audio){wordAudio=null;speak(word.word,state.language,true);}});
      return;
    }catch{}
  }
  speak(word.word,state.language,true);
}
function scheduleRepeat(){
  clearTimeout(repeatTimer);
  const active=voiceWord();if(!active||!inFlight()||!soundOn)return;
  const wordLength=[...(state.studyMode==='knowledge'?active.translation:active.word)].length;
  const delay=clamp(2300+wordLength*125,2900,6300);
  repeatTimer=setTimeout(()=>{playCurrentWord();scheduleRepeat();},delay);
}
function startRepeatingWord(word){
  stopRepeating();state.currentWord=word;
  playCurrentWord();scheduleRepeat();
}
function startQuestion(word){
  stopRepeating();state.targetWord=word;state.currentWord=null;
  playCurrentWord();scheduleRepeat();
}

const STUDY_LABELS={learn:'LEARN',listen:'LISTENING',knowledge:'KNOWLEDGE'};
function setStudyMode(mode){
  if(!STUDY_LABELS[mode])return;
  state.studyMode=mode;
  document.querySelectorAll('[data-study]').forEach(button=>{
    const selected=button.dataset.study===mode;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));
  });
  ui.studyLabel.textContent=STUDY_LABELS[mode];
  document.querySelector('.challenge').classList.toggle('quiz-mode',mode!=='learn');
  if(inFlight()){
    state.index++;state.glideTarget=-1;stopRepeating();state.currentWord=null;
    buildWordRings();updateHUD();toast(mode==='learn'?'LEARN · ONE WORD AT A TIME':mode==='listen'?'LISTEN · FIND THE SPOKEN WORD':'KNOWLEDGE · FIND THE TRANSLATION');
  }
}

function updateHUD(){
  ui.alt.textContent=Math.ceil(Math.max(0,state.alt)).toLocaleString('en-US');
  ui.altBar.style.width=(100*(1-clamp(state.alt/1750,0,1))).toFixed(1)+'%';
  ui.mode.textContent=state.phase==='chute'?'PARACHUTE':'FREEFALL';
  const fallRate=state.phase==='chute'?18:(state.easy?38:48);
  ui.speed.textContent=Math.round(Math.hypot(fallRate,state.vx,state.vz)*3.6)+' KM/H';
  ui.score.textContent=String(state.score).padStart(4,'0');
  ui.round.textContent=String(state.collected.length).padStart(2,'0');
  const word=state.currentWord,quiz=state.targetWord;
  if(state.studyMode==='learn'){
    ui.challengeLabel.textContent='LEARN · ONE WORD AT A TIME';
    ui.prompt.textContent=word?word.word:'GLIDE TO THE WORD';
    ui.hint.textContent=word?`${word.translation} · pronunciation repeats`:'Fly into the single ring · no wrong answers';
  }else if(state.studyMode==='listen'){
    ui.challengeLabel.textContent='LISTENING · THREE CHOICES';
    ui.prompt.textContent='♫ LISTEN';
    ui.hint.textContent=`Hear the word, then fly to the match · ${state.combo} streak`;
  }else{
    ui.challengeLabel.textContent='KNOWLEDGE · THREE CHOICES';
    ui.prompt.textContent=quiz?.translation||'HEAR THE MEANING';
    ui.hint.textContent=`Find the matching word · ${state.combo} streak`;
  }
  $('replay-button').disabled=!voiceWord();
  ui.wind.textContent=`WIND ${String(Math.round(state.wind)).padStart(2,'0')} KM/H ↗`;
  if(state.phase==='chute'){
    ui.deploy.disabled=true;ui.chuteStatus.textContent='DEPLOYED';
  }else if(state.alt<=1100){
    ui.deploy.disabled=false;ui.chuteStatus.textContent='READY NOW';
  }else{
    ui.deploy.disabled=true;ui.chuteStatus.textContent='AT 1100 M';
  }
}

function buildWordRings(){
  if(!state.deck.length){state.rings=[];world.setRings([]);return;}
  const target=state.deck[state.index%state.deck.length];
  const learn=state.studyMode==='learn';
  const candidatePool=[...state.deck,...defaultDeck(state.language)];
  const distractors=[],used=new Set([target.word.trim().toLocaleLowerCase()]);
  for(let i=0;i<candidatePool.length&&distractors.length<2;i++){
    const word=candidatePool[(state.index*3+2+i)%candidatePool.length],key=word.word.trim().toLocaleLowerCase();
    if(!used.has(key)){used.add(key);distractors.push(word);}
  }
  const count=learn?1:1+distractors.length;
  const answerPosition=learn?0:(state.index*2+1)%count;
  const options=learn?[target]:Array.from({length:count},(_,i)=>i===answerPosition?target:distractors[i<answerPosition?i:i-1]);
  const lanes=count===1?[0]:count===2?[-130,130]:[-173,0,173];
  const zOffsets=count===1?[0]:count===2?[-44,44]:[53,-51,18];
  const drop=Math.min(state.phase==='chute'?175:270,state.alt-94);
  if(drop<48){state.rings=[];world.setRings([]);return;}
  const descent=state.phase==='chute'?18:(state.easy?38:48);
  const travel=state.phase==='chute'?17:(state.easy?28:34);
  const z=state.z-(drop/descent)*travel-8;
  state.ringAltitude=state.alt-drop;
  state.rings=options.map((w,i)=>({id:i,x:state.x+lanes[i]+(learn?Math.sin(state.index*1.7)*50:0),y:state.ringAltitude,z:z+zOffsets[i],word:w.word,translation:w.translation,record:w,correct:w===target}));
  state.glideTarget=learn?0:-1;
  world.setRings(state.rings);
  if(learn){state.targetWord=null;}
  else startQuestion(target);
  ui.statusCopy.textContent=learn?'ONE WORD · STEER ↑↓←→':state.easy?'TAP A RING TO GLIDE THERE · OR USE JOYSTICK':'THREE WORDS · STEER ↑↓←→ TO YOUR ANSWER';
}

function applyPayload(payload){
  imported=payload;state.language=payload.learningLanguage||'es';state.primaryLanguage=payload.primaryLanguage||'en';
  if([...ui.select.options].some(o=>o.value===state.language))ui.select.value=state.language;
  else{const opt=document.createElement('option');opt.value=state.language;opt.textContent=LANGUAGE_NAMES[state.language]||state.language.toUpperCase();ui.select.append(opt);ui.select.value=state.language;}
  ui.select.disabled=true;
  ui.importNote.textContent=`✓ ${payload.words.length} GoLingo words received • ${LANGUAGE_NAMES[state.language]||state.language} selected`;
  if(state.phase==='freefall'||state.phase==='chute'){
    resetFlight();toast('GOLINGO WORDS LOADED · READY TO GLIDE');
  }
}

const initialPayload=findInitialPayload();if(initialPayload)applyPayload(initialPayload);
window.receiveGoLingoData=raw=>{const p=normalizePayload(raw);if(p)applyPayload(p);return !!p;};
window.setGameData=window.receiveGoLingoData;
window.loadWords=window.receiveGoLingoData;
addEventListener('message',event=>{
  const raw=event.data;
  if(!raw||typeof raw!=='object')return;
  const normalized=normalizePayload(raw);
  if(normalized)applyPayload(normalized);
});
try{parent.postMessage({type:'GOLINGO_GAME_READY',game:'parachute-word-dive'},'*');}catch{}

function resetFlight(){
  stopRepeating();
  state.phase='freefall';state.x=0;state.z=1500;state.alt=1750;state.vx=0;state.vy=0;state.vz=-28;state.elapsed=0;state.score=0;
  state.combo=0;state.index=0;state.attempts=0;state.misses=0;state.correct=0;state.wrong=0;state.collected=[];state.landed=false;state.chuteReady=false;
  state.chuteScale=0;state.steerX=0;state.steerY=0;state.brake=false;state.wind=4;state.landingZone={x:0,z:-650};
  state.deck=imported?.words?.length?imported.words:defaultDeck(state.language);
  state.glideTarget=0;state.currentWord=null;state.targetWord=null;
  gameEnded=false;ui.start.classList.add('hidden');ui.pause.classList.add('hidden');ui.end.classList.add('hidden');
  ui.hud.classList.remove('hidden');ui.controls.classList.remove('hidden');ui.status.classList.remove('hidden');
  ui.statusCopy.textContent='CONTINUOUS FREEFALL · 4-WAY STEERING';
  ui.knob.style.left='50%';ui.knob.style.top='50%';
  buildWordRings();world.resetCamera();world.onNewFlight(state);updateHUD();
}

function start(){
  if(!imported){state.language=ui.select.value;state.primaryLanguage='en';}
  resetFlight();
  unlockSpeech();setupWind();
  if(state.studyMode!=='learn'){playCurrentWord();scheduleRepeat();}
  toast(state.studyMode==='learn'?'ONE WORD AT A TIME · KEEP GLIDING':'LISTEN TO THE PROMPT · PICK ONE OF THREE');
}

function openChute(manual=false){
  if(state.phase!=='freefall')return;
  if(state.alt>1100&&manual){toast('PARACHUTE OPENS BELOW 1100 M',true);return;}
  state.phase='chute';state.vx*=.65;state.chuteScale=.02;
  toast('PARACHUTE DEPLOYED!');
  ui.statusCopy.textContent='SLOW PARACHUTE GLIDE · KEEP LEARNING';
  updateHUD();
}

function wordCrossing(){
  if(!state.rings.length||state.alt>state.ringAltitude+5)return;
  state.attempts++;
  const landing=state.rings
    .map(r=>({ring:r,distance:Math.hypot((r.x-state.x)/102,(r.z-state.z)/132)}))
    .sort((a,b)=>a.distance-b.distance)[0];
  const reached=landing&&landing.distance<(state.easy?1.13:.94);
  state.index++;
  if(reached){
    const word=landing.ring.record;
    world.burst(landing.ring.x,landing.ring.y,landing.ring.z);
    if(state.studyMode==='learn'){
      state.score+=100;state.correct++;state.collected.push(word);
      toast(`♪ ${word.word} · ${word.translation}`);
      startRepeatingWord(word);
    }else if(landing.ring.correct){
      state.correct++;state.combo++;state.score+=150+Math.min(state.combo,8)*25;state.collected.push(word);
      toast(`✓ ${word.word} · ${word.translation} · ${state.combo} STREAK`);
    }else{
      state.wrong++;state.combo=0;
      toast(`TRY AGAIN NEXT ROUND · ${state.targetWord?.word||'LISTEN CAREFULLY'}`,true);
    }
  }else{
    state.misses++;state.combo=0;
    toast(state.studyMode==='learn'?'KEEP GLIDING · NEXT WORD AHEAD':'MISSED THE RINGS · NEXT QUESTION',true);
  }
  if(state.alt>190)buildWordRings();
  else{state.rings=[];world.setRings([]);ui.statusCopy.textContent='ENJOY THE VIEW · GLIDE TO LAND';}
  updateHUD();
}

function land(){
  if(gameEnded)return;gameEnded=true;
  const safe=state.phase==='chute';const dx=state.x-state.landingZone.x,dz=state.z-state.landingZone.z;
  const nearLanding=state.easy||Math.hypot(dx,dz)<165;
  state.phase='landed';state.alt=0;stopRepeating();
  if(safe)state.score+=nearLanding?250:100;
  $('final-score').textContent=state.score.toLocaleString();
  $('final-words').textContent=state.collected.length;
  $('final-accuracy').textContent=state.studyMode==='learn'?'Practice makes perfect':`${Math.round(state.correct/Math.max(1,state.correct+state.wrong+state.misses)*100)}% accuracy · ${state.correct} correct`;
  $('end-title').textContent=!safe?'Hard landing!':nearLanding?'Perfect touchdown!':'You made it down!';
  $('end-summary').textContent=!safe?'Next time, open your parachute for a safe landing.':nearLanding?'Amazing precision. Your language skills are taking off.':'Another flight, another step closer to fluency.';
  const list=$('learned-list');list.replaceChildren();
  state.collected.forEach(w=>{const chip=document.createElement('span');chip.textContent=`${w.word} · ${w.translation}`;list.append(chip);});
  ui.controls.classList.add('hidden');ui.hud.classList.add('hidden');ui.status.classList.add('hidden');
  setTimeout(()=>{ui.end.classList.remove('hidden');ui.toast.classList.remove('on');},650);
}

function moveControls(dt){
  const keyX=(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0);
  const keyY=(keys.has('ArrowUp')||keys.has('KeyW')?1:0)-(keys.has('ArrowDown')||keys.has('KeyS')?1:0);
  let sx=clamp(state.steerX+keyX,-1,1),sy=clamp(state.steerY+keyY,-1,1);
  const manual=pointerState!==null||scenePointer!==null||keyX!==0||keyY!==0;
  const chute=state.phase==='chute';
  const baseForward=chute?17:state.easy?28:34;
  const foreAft=chute?45:79;
  if(state.easy&&!manual){
    const r=state.rings.find(r=>r.id===state.glideTarget);
    if(r){
      sx=clamp((r.x-state.x)/125,-1,1);
      const descent=chute?18:(state.easy?38:48);
      const timeToRing=Math.max(1.25,(state.alt-state.ringAltitude)/descent);
      const requiredForward=(state.z-r.z)/timeToRing;
      sy=clamp((requiredForward-baseForward)/foreAft,-1,1);
    }
    else{sx=0;sy=0;}
  }
  const glideSpeed=chute?55:(state.easy?62:72);
  state.vx+=(sx*glideSpeed-state.vx)*Math.min(1,dt*(state.easy?2.9:2.1));
  state.x=clamp(state.x+state.vx*dt+Math.sin(state.elapsed*.7)*dt*.45,-1100,1100);
  // Signed forward velocity: pressing down actually flies BACKWARDS through the world.
  // Air resistance eases the turn so joystick diagonals feel like banking a wingsuit.
  const requestedForward=clamp(baseForward*(state.brake?.6:1)+sy*foreAft,-62,118);
  state.vz+=(-requestedForward-state.vz)*Math.min(1,dt*(chute?2.45:3.2));
  const descent=(chute?18:(state.easy?38:48))*(state.brake&&chute?.91:1);
  state.z=clamp(state.z+state.vz*dt,-4500,4500);
  state.alt-=descent*dt;
  state.alt=Math.max(0,state.alt);
  state.elapsed+=dt;
  state.wind=4+Math.sin(state.elapsed*.13)*2+Math.sin(state.elapsed*.43);
  if(state.phase==='freefall'&&state.alt<=1100&&!state.chuteReady){state.chuteReady=true;toast('CHUTE READY · OPEN ANYTIME');}
  if(state.phase==='freefall'&&state.alt<=(state.easy?420:270))openChute(false);
  state.chuteScale+=(chute?1-state.chuteScale:-state.chuteScale)*Math.min(1,dt*2.7);
  wordCrossing();
  if(state.alt<=0)land();
}

const windParticles=Array.from({length:48},()=>({x:Math.random(),y:Math.random(),length:rand(8,25),speed:rand(.15,.45),alpha:rand(.13,.45)}));
function renderEffects(dt){
  const w=innerWidth,h=innerHeight;fxctx.clearRect(0,0,w,h);
  if(state.phase==='ready'||state.phase==='landed')return;
  const chute=state.phase==='chute';
  fxctx.strokeStyle='#e8ffff';fxctx.lineCap='round';
  for(const p of windParticles){
    p.y+=dt*p.speed*(chute?.45:1.5);
    if(p.y>1.1){p.y=-.1;p.x=Math.random();}
    const edge=Math.abs(p.x-.5)*2;
    fxctx.globalAlpha=p.alpha*edge*(chute?.3:.8);fxctx.lineWidth=edge>0.6?1.5:.7;
    fxctx.beginPath();fxctx.moveTo(p.x*w,p.y*h);fxctx.lineTo(p.x*w+state.vx*.05,p.y*h+p.length*(chute?.35:1));fxctx.stroke();
  }
  fxctx.globalAlpha=1;
}

function frame(now){
  const dt=Math.min(.05,Math.max(0,(now-lastFrame)/1000));lastFrame=now;
  if(state.phase==='freefall'||state.phase==='chute'){
    moveControls(dt);updateHUD();
  }
  world.update(state,dt);
  renderEffects(dt);
  updateWind();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function pause(){
  if(state.phase==='freefall'||state.phase==='chute'){
    state.phase=state.phase==='chute'?'paused-chute':'paused-freefall';
    $('pause-score').textContent=state.score.toLocaleString();$('pause-words').textContent=state.collected.length;
    ui.pause.classList.remove('hidden');stopRepeating();
  }else if(state.phase.startsWith('paused'))resume();
}
function resume(){
  if(!state.phase.startsWith('paused'))return;
  state.phase=state.phase==='paused-chute'?'chute':'freefall';ui.pause.classList.add('hidden');lastFrame=performance.now();
  playCurrentWord();scheduleRepeat();
}

$('start-button').addEventListener('click',start);
document.querySelectorAll('[data-study]').forEach(button=>button.addEventListener('click',()=>setStudyMode(button.dataset.study)));
ui.studySwitch.addEventListener('click',()=>{
  const sequence=['learn','listen','knowledge'];setStudyMode(sequence[(sequence.indexOf(state.studyMode)+1)%sequence.length]);
});
$('easy-mode').addEventListener('click',()=>setDifficulty(true));
$('challenge-mode').addEventListener('click',()=>setDifficulty(false));
function setDifficulty(easy){
  state.easy=easy;
  $('easy-mode').classList.toggle('active',easy);$('challenge-mode').classList.toggle('active',!easy);
  $('easy-mode').setAttribute('aria-pressed',String(easy));$('challenge-mode').setAttribute('aria-pressed',String(!easy));
  if(!imported)ui.importNote.textContent=easy?'Steer freely · tap any ring to engage auto-glide':'Continuous descent · free four-direction steering';
}
$('replay-button').addEventListener('click',playCurrentWord);
$('resume-button').addEventListener('click',resume);
$('pause-button').addEventListener('click',pause);
$('restart-button').addEventListener('click',resetFlight);
$('play-again-button').addEventListener('click',resetFlight);
$('deploy-button').addEventListener('click',()=>openChute(true));
ui.sound.addEventListener('click',()=>{soundOn=!soundOn;ui.sound.classList.toggle('is-muted',!soundOn);ui.sound.setAttribute('aria-label',soundOn?'Mute speech and wind':'Unmute speech and wind');if(!soundOn)stopRepeating();else{setupWind();windContext?.resume?.();playCurrentWord();scheduleRepeat();}});
ui.camera.addEventListener('click',()=>{world.toggleCamera();toast(world.cameraMode==='overhead'?'TOP-DOWN CAMERA':'CHASE CAMERA');});
$('full-button').addEventListener('click',async()=>{
  try{if(!document.fullscreenElement){await document.documentElement.requestFullscreen?.();try{await screen.orientation?.lock?.('landscape');}catch{}}else await document.exitFullscreen?.();}catch{}
});
$('export-button').addEventListener('click',()=>{
  const payload={primaryLanguage:state.primaryLanguage,learningLanguage:state.language,words:state.collected};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download='golingo-parachute-words.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
});

const steerPoint=(point,origin)=>{
  const dx=point.clientX-origin.x,dy=point.clientY-origin.y;
  const d=Math.hypot(dx,dy),r=40;const scale=Math.min(1,r/(d||1));
  state.steerX=clamp(dx*scale/r,-1,1);state.steerY=clamp(-dy*scale/r,-1,1);
  ui.knob.style.left=`calc(50% + ${dx*scale}px)`;ui.knob.style.top=`calc(50% + ${dy*scale}px)`;
};
const releaseSteer=()=>{state.steerX=0;state.steerY=0;ui.knob.style.left='50%';ui.knob.style.top='50%';};
ui.joystick.addEventListener('pointerdown',e=>{
  if(!(state.phase==='chute'||state.phase==='freefall'))return;
  e.preventDefault();const rect=ui.joystick.getBoundingClientRect();pointerState={id:e.pointerId,x:rect.left+rect.width/2,y:rect.top+rect.height/2};
  ui.joystick.setPointerCapture(e.pointerId);steerPoint(e,pointerState);
});
ui.joystick.addEventListener('pointermove',e=>{if(pointerState?.id===e.pointerId)steerPoint(e,pointerState);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])ui.joystick.addEventListener(event,e=>{if(pointerState?.id===e.pointerId){pointerState=null;releaseSteer();}});
ui.brake.addEventListener('pointerdown',e=>{e.preventDefault();state.brake=true;ui.brake.classList.add('active');ui.brake.setPointerCapture(e.pointerId);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])ui.brake.addEventListener(event,()=>{state.brake=false;ui.brake.classList.remove('active');});

const sceneCanvas=world.renderer.domElement;
sceneCanvas.addEventListener('pointerdown',e=>{if(state.phase==='freefall'||state.phase==='chute'){scenePointer={id:e.pointerId,x:e.clientX,y:e.clientY};sceneCanvas.setPointerCapture(e.pointerId);}});
sceneCanvas.addEventListener('pointermove',e=>{
  if(scenePointer?.id!==e.pointerId)return;
  const dx=e.clientX-scenePointer.x,dy=e.clientY-scenePointer.y;
  state.steerX=clamp(dx/110,-1,1);state.steerY=clamp(-dy/140,-1,1);
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])sceneCanvas.addEventListener(event,e=>{
  if(scenePointer?.id===e.pointerId){
    if(event==='pointerup'&&Math.hypot(e.clientX-scenePointer.x,e.clientY-scenePointer.y)<15){
      const picked=world.pickRing?.(e.clientX,e.clientY);
      if(picked!==null&&picked!==undefined&&state.easy){state.glideTarget=picked;toast('AUTO-GLIDE TO '+(state.rings.find(r=>r.id===picked)?.word||'YOUR PICK'));}
    }
    scenePointer=null;releaseSteer();
  }
});

addEventListener('keydown',e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  keys.add(e.code);
  if(e.repeat)return;
  if(e.code==='Space')openChute(true);
  if(e.code==='KeyP'||e.code==='Escape')pause();
  if(e.code==='KeyR')playCurrentWord();
  if(e.code==='KeyC')world.toggleCamera();
});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>{keys.clear();releaseSteer();state.brake=false;});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&['freefall','chute'].includes(state.phase))pause();});

updateHUD();
