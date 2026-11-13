import { createWorld } from './scene.js';
import { createFallbackWorld } from './fallback.js';
import { createLearning } from './learning.js';
import { LEVELS, getLevel } from './levels.js';
import { createProgress } from './progress.js';
import { GOAL_Z, GOAL_HEIGHT, BALL_RADIUS, BALL_START_Y, shotPoint, shotProfile, segmentHitsDefender, segmentHitsObstacle, goalOutcome, fitSwipe, unprojectShotRay } from './physics.js';

const $ = id => document.getElementById(id);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const names = { es: 'Spanish', ja: 'Japanese', zh: 'Mandarin Chinese', fr: 'French', ko: 'Korean', de: 'German', en: 'English', pt: 'Portuguese', it: 'Italian', vi: 'Vietnamese', ar: 'Arabic', hi: 'Hindi', ru: 'Russian', th: 'Thai', uk: 'Ukrainian' };
const modes = { learn: 'LEARN & PLAY', listen: 'LISTEN & SCORE', meaning: 'MATCH THE MEANING' };
const descriptions = {
  learn: 'Learn a word while solving a real shooting puzzle. Three balls per level.',
  listen: 'Listen carefully. Aim at the word you hear and put it in the net.',
  meaning: 'See and hear the meaning. Score through the matching word.'
};
let preferences = { mode: 'learn', repeat: true, translation: true, easy: false, muted: false, hidden: false, auto: true, difficulty: 'challenge', shotStyle: 'curl', power: .72, version: 0 };
try { preferences = { ...preferences, ...JSON.parse(localStorage.getItem('goal-club.preferences') || '{}') }; } catch {}
if (!Number.isFinite(preferences.version) || preferences.version < 3) { preferences.difficulty = preferences.easy ? 'practice' : 'challenge'; preferences.shotStyle = 'curl'; preferences.power = .72; }
preferences.version = 4;
if (!['practice','challenge','pro'].includes(preferences.difficulty)) preferences.difficulty='challenge';
preferences.easy=preferences.difficulty==='practice';
if (!['drive','curl','chip'].includes(preferences.shotStyle)) preferences.shotStyle='curl';
preferences.power=clamp(Number(preferences.power)||.72,.35,1);
if (!modes[preferences.mode]) preferences.mode = 'learn';
let world, learning, started = false, state = 'menu', mode = preferences.mode;
let wordIndex = 0, level = 0, goals = 0, score = 0, streak = 0, tries = 0;
let challenge = getLevel(0), ballsLeft = 3, roundStartedAt = 0, autoNextAt = Infinity, gesture = null;
let lessonPlayback = 0, lessonFinished = false;
let shotStyle=preferences.shotStyle, power=preferences.power, aimClock=18, ballMotion=null;
let charge=null, shootPointerConsumed=false, replayData=null, replayState=null;
let progress; try { progress=createProgress(localStorage,LEVELS.length); } catch { progress=createProgress(null,LEVELS.length); }
let bonusTargets=[];
let currentWord, choices = [], labels = [], targetX = 0, bend = 0;
let elapsed = 0, lastFrame = performance.now(), kickClock = 0, flightClock = 0, resultClock = 0;
let shot = null, toastTimer = 0, floatingTimer = 0, lastGuideCheck = -1, customData = false;
const dialogs = ['settingsDialog', 'importDialog', 'reviewDialog', 'pauseDialog', 'challengeDialog'].map($);
const paused = () => !started || document.hidden || dialogs.some(dialog => dialog.open);
const persist = () => { try { localStorage.setItem('goal-club.preferences', JSON.stringify(preferences)); } catch {} };
function toast(message) {
  $('toast').textContent = String(message); $('toast').classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3600);
}
function announceResult(title, detail, miss = false) {
  const element = $('scoreFloat'); element.replaceChildren(document.createTextNode(title));
  const small = document.createElement('small'); small.textContent = detail; element.append(small);
  element.classList.toggle('miss', miss); element.classList.add('show');
  clearTimeout(floatingTimer); floatingTimer = setTimeout(() => element.classList.remove('show'), miss ? 1700 : 2600);
}
function saveStats() {
  try {
    const previous = JSON.parse(localStorage.getItem('goal-club.best') || '{}');
    localStorage.setItem('goal-club.best', JSON.stringify({ score: Math.max(score, previous.score || 0), goals: Math.max(goals, previous.goals || 0) }));
  } catch {}
}

function updateProgressUI() {
  const summary=progress.summary(preferences.difficulty,mode),best=progress.get(level%LEVELS.length,preferences.difficulty,mode);
  $('challengeCount').textContent=`${summary.completed} / ${summary.total}`;
  $('puzzleBest').textContent=best.stars ? '★'.repeat(best.stars)+'☆'.repeat(3-best.stars) : '☆☆☆';
  $('puzzleBest').setAttribute('aria-label',`Best for this puzzle: ${best.stars} of 3 stars`);
}
function drawChallenges() {
  const summary=progress.summary(preferences.difficulty,mode);
  $('challengeSummary').textContent=`${summary.completed} / ${summary.total} completed · ${summary.stars} / ${summary.maxStars} stars`;
  $('challengeMode').textContent=`${preferences.difficulty.toUpperCase()} · ${mode==='learn'?'LEARN':mode==='listen'?'LISTEN':'MATCH'}`;
  $('challengeGrid').replaceChildren();
  LEVELS.forEach((stage,index)=>{
    const best=progress.get(index,preferences.difficulty,mode),card=document.createElement('button');
    card.className=`challenge-card venue-${stage.theme}${index===level%LEVELS.length?' selected':''}${best.stars?' completed':''}`;
    card.type='button';card.setAttribute('aria-label',`${index+1}. ${stage.name}, ${best.stars} of 3 stars`);
    const number=document.createElement('b'),name=document.createElement('span'),venue=document.createElement('small'),stars=document.createElement('span');
    number.className='challenge-number';number.textContent=String(index+1).padStart(2,'0');
    name.className='challenge-title';name.textContent=stage.name;venue.textContent=['STADIUM','FOREST','STREET'][stage.theme];
    stars.className='challenge-stars';stars.textContent='★'.repeat(best.stars)+'☆'.repeat(3-best.stars);
    card.append(number,venue,name,stars);card.addEventListener('click',()=>{closeDialogs(false);selectChallenge(index);if(!started)startGame();});
    $('challengeGrid').append(card);
  });
}
function selectChallenge(index) {
  cancelCharge();if(replayState)finishReplay(false);
  level=clamp(Math.floor(Number(index)||0),0,LEVELS.length-1);
  if(started)newRound(false);
  else {challenge=getLevel(level,{practice:preferences.easy,difficulty:preferences.difficulty});world.setTheme(challenge.theme);world.setChallenge(challenge);world.setDefenders(challenge.defenders);updateHUD();}
}

function cancelCharge(restore=true) {
  if(!charge)return;
  const held=charge;charge=null;
  if(restore)power=held.originalPower;
  document.body.classList.remove('charging');world?.setCharge?.(null);
  if($('shootBtn').hasPointerCapture?.(held.id))$('shootBtn').releasePointerCapture(held.id);
  $('chargeHint').textContent='TAP KICK · HOLD FOR POWER';
  if(state==='aim')$('shootLabel').textContent='KICK';
  updateShotControls();if(state==='aim')updateGuide();
}
function updateCharge(now=performance.now()) {
  if(!charge||state!=='aim'||paused())return;
  const held=(now-charge.startedAt)/1000-.18;
  if(held<0)return;
  charge.active=true;
  const cycle=held/1.05%2;power=.35+.65*(cycle<=1?cycle:2-cycle);
  document.body.classList.add('charging');world.setCharge?.(power);
  $('shootLabel').textContent='RELEASE';$('chargeHint').textContent=`RELEASE TO KICK · ${Math.round(power*100)}%`;
  updateShotControls();lastGuideCheck=-1;updateGuide();
}

function recordReplayPoint(time,fieldTime) {
  if(!replayData||replayData.end)return;
  const p=world.ball.position,r=world.ball.rotation;
  replayData.samples.push({time,fieldTime,x:p.x,y:p.y,z:p.z,rx:r.x,ry:r.y,rz:r.z});
}
function completeReplay(outcome,blocker=null) {
  if(!replayData||replayData.samples.length<3)return;
  const sample=replayData.samples.at(-1);
  replayData.end={outcome,time:sample.time,fieldTime:sample.fieldTime,x:sample.x,y:sample.y,z:sample.z,defender:world.defenders.indexOf(blocker),obstacle:(world.obstacles||[]).indexOf(blocker)};
  $('replayBtn').hidden=false;
}
function startReplay() {
  if(paused()||!replayData?.end||!['goal','miss','failed'].includes(state))return;
  cancelCharge();
  const original={state,ball:world.ball.position.clone(),rotation:world.ball.rotation.clone(),ballMotion:ballMotion?{...ballMotion}:null,resultClock,kickClock,flightClock,hits:world.defenders.map(d=>d.hit),obstacleHits:(world.obstacles||[]).map(o=>o.hit)};
  lessonPlayback++;autoNextAt=Infinity;state='replay';learning.setPaused(true);
  replayState={time:0,index:0,impact:false,fieldTime:replayData.startTime,original};
  world.clearShotEffects?.();world.resetPlayer();world.defenders.forEach(d=>d.hit=false);(world.obstacles||[]).forEach(o=>o.hit=false);
  ballMotion=null;confetti.visible=false;guide.visible=false;targetRing.visible=false;targetZone.visible=false;trail.visible=false;trailPoints.length=0;
  $('scoreFloat').classList.remove('show');$('aimHint').style.opacity=0;$('replayBtn').hidden=true;$('replayRibbon').hidden=false;
  $('shootBtn').disabled=false;$('shootLabel').textContent='BACK';document.body.classList.add('replaying');updateShotControls();
}
function finishReplay(resumeAudio=true) {
  if(!replayState)return;
  const original=replayState.original;replayState=null;state=original.state;
  world.clearShotEffects?.();world.resetPlayer();world.ball.position.copy(original.ball);world.ball.rotation.copy(original.rotation);
  world.defenders.forEach((d,i)=>d.hit=original.hits[i]);(world.obstacles||[]).forEach((o,i)=>o.hit=original.obstacleHits[i]);
  ballMotion=original.ballMotion;resultClock=original.resultClock;kickClock=original.kickClock;flightClock=original.flightClock;
  if(state==='goal')world.celebrate(Math.min(resultClock/2,1));else world.kick(Math.min(kickClock/.65,1));
  trail.visible=false;confetti.visible=false;targetZone.visible=true;$('replayRibbon').hidden=true;$('replayBtn').hidden=false;
  $('shootLabel').textContent=state==='goal'?'NEXT':state==='failed'?'RESTART':'RETRY';document.body.classList.remove('replaying');
  updateShotControls();updateWordCard(state==='goal');world.update(0,elapsed-roundStartedAt,{paused:false});
  if(resumeAudio){learning.setPaused(paused());if(!paused())speakPrompt();}
}
function updateReplay(dt) {
  if(!replayState)return;
  const playback=replayState,data=replayData;playback.time+=dt*.45;
  const t=Math.min(playback.time,data.end.time),samples=data.samples;
  while(playback.index<samples.length-2&&samples[playback.index+1].time<t)playback.index++;
  const a=samples[playback.index],b=samples[Math.min(playback.index+1,samples.length-1)];
  const f=clamp((t-a.time)/Math.max(.00001,b.time-a.time),0,1),lerp=(key)=>a[key]+(b[key]-a[key])*f;
  world.ball.position.set(lerp('x'),lerp('y'),lerp('z'));world.ball.rotation.set(lerp('rx'),lerp('ry'),lerp('rz'));
  playback.fieldTime=lerp('fieldTime')+Math.max(0,playback.time-data.end.time);world.kick(Math.min(t/.65,1));
  if(t>.34){
    trailPoints.push(world.ball.position.clone());if(trailPoints.length>24)trailPoints.shift();
    trailPoints.forEach((p,i)=>trail.geometry.attributes.position.setXYZ(i,p.x,p.y,p.z));
    trail.geometry.attributes.position.needsUpdate=true;trail.geometry.setDrawRange(0,trailPoints.length);trail.visible=true;trail.material.opacity=.8;
  }
  if(playback.time>=data.end.time&&!playback.impact){
    playback.impact=true;
    if(data.end.outcome==='goal')world.scoreGoal?.(data.end);
    else {const blocker=world.defenders[data.end.defender]||(world.obstacles||[])[data.end.obstacle];if(blocker?.keeper)world.saveBall?.(blocker,data.end);else if(blocker)blocker.hit=true;}
  }
  if(playback.time>data.end.time+.55)finishReplay();
}

let soundContext;
function unlockAudio() {
  learning.unlock();
  try { soundContext ||= new (window.AudioContext || window.webkitAudioContext)(); if (soundContext.state === 'suspended') soundContext.resume(); } catch {}
}
function sound(kind) {
  if(preferences.muted||!soundContext||soundContext.state!=='running')return;
  const now=soundContext.currentTime,goalSound=kind==='goal',duration=goalSound?1.2:kind==='kick'?.15:.23;
  const length=Math.ceil(soundContext.sampleRate*duration),buffer=soundContext.createBuffer(1,length,soundContext.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<length;i++){const t=i/length;data[i]=(Math.random()*2-1)*Math.pow(1-t,goalSound?.7:2.2);}
  const noise=soundContext.createBufferSource(),filter=soundContext.createBiquadFilter(),gain=soundContext.createGain();noise.buffer=buffer;
  filter.type=goalSound?'bandpass':'lowpass';filter.frequency.setValueAtTime(goalSound?1100:kind==='kick'?420:750,now);filter.Q.value=goalSound?.7:.4;
  gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(goalSound?.065:kind==='kick'?.23:.09,now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
  noise.connect(filter);filter.connect(gain);gain.connect(soundContext.destination);noise.start(now);noise.stop(now+duration+.02);
  if(kind==='kick'){
    const tone=soundContext.createOscillator(),impact=soundContext.createGain();tone.frequency.setValueAtTime(105,now);tone.frequency.exponentialRampToValueAtTime(42,now+.12);impact.gain.setValueAtTime(.12,now);impact.gain.exponentialRampToValueAtTime(.0001,now+.14);tone.connect(impact);impact.connect(soundContext.destination);tone.start(now);tone.stop(now+.15);
  }
}

function setMode(next) {
  mode = modes[next] ? next : 'learn'; preferences.mode = mode; persist();
  document.querySelectorAll('[data-mode]').forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
  $('modeDescription').textContent = descriptions[mode]; $('settingsMode').value = mode; $('modePill').textContent = modes[mode];
  if (started) newRound(false);
  updateProgressUI();
}
function displayData(dataset, { source } = {}) {
  customData = !['language', 'default'].includes(source || '') && !dataset.words.every(entry => /^(es|ja|zh|fr|ko|de)-\d+$/.test(entry.id || ''));
  const code = dataset.learningLanguage.split(/[-_]/)[0], languageName = names[code] || dataset.learningLanguage;
  for (const select of [$('startLanguage'), $('settingsLanguage')]) {
    const old = select.querySelector('[data-custom]'); if (old) old.remove();
    if (customData || !names[code] || !['es', 'ja', 'zh', 'fr', 'ko', 'de'].includes(code)) {
      const option = document.createElement('option'); option.value = '__custom'; option.dataset.custom = 'true'; option.textContent = `${languageName} · your ${dataset.words.length} words`; select.append(option); select.value = '__custom';
    } else select.value = code;
  }
  const indicator = document.createElement('span');
  $('dataStatus').replaceChildren(indicator, document.createTextNode(` ${dataset.words.length} ${languageName} words ready to play`));
  wordIndex = 0;
  if (world && learning) { updateReviewBadge(); if (started) newRound(false); else { currentWord = learning.current(0); makeChoices(); } }
}
function speakPrompt() {
  if (!currentWord || !started || state==='replay') return;
  if (state === 'goal') playGoalLesson();
  else if (mode === 'meaning') learning.speakMeaning(currentWord, { repeat: preferences.repeat });
  else learning.speakWord(currentWord, { repeat: preferences.repeat });
}
function playGoalLesson() {
  const playback=++lessonPlayback;lessonFinished=false;autoNextAt=Infinity;
  learning.speakSentence(currentWord,{repeat:false}).then(()=>{
    if(playback!==lessonPlayback||state!=='goal'||paused())return;
    lessonFinished=true;autoNextAt=preferences.auto?Math.max(2.5,resultClock+.6):Infinity;
  });
}
function updateWordCard(revealed = false) {
  if (!currentWord) return;
  $('wordEyebrow').textContent = revealed ? 'GOAL! WORD COLLECTED' : mode === 'listen' ? 'LISTEN. FIND. SCORE.' : mode === 'meaning' ? 'FIND THIS MEANING' : 'YOUR NEXT WORD';
  $('wordMain').textContent = !revealed && mode === 'listen' ? 'Listen…' : !revealed && mode === 'meaning' ? (currentWord.translation || currentWord.word) : currentWord.word;
  $('wordTranslation').textContent = !revealed && mode === 'listen' ? 'Tap ▶ to hear the word' : !revealed && mode === 'meaning' ? 'Choose a word, then shoot' : currentWord.translation;
  $('wordTranslation').hidden = !preferences.translation && (mode === 'learn' || revealed);
  $('wordSentence').hidden = !revealed || !currentWord.sentence;
  $('wordSentence').textContent = revealed ? currentWord.sentence + (preferences.translation && currentWord.sentenceTranslation ? ` — ${currentWord.sentenceTranslation}` : '') : '';
  const languageName = names[learning.dataset.learningLanguage.split(/[-_]/)[0]] || learning.dataset.learningLanguage;
  $('languageLabel').textContent = `${languageName.toUpperCase()} · ${String((wordIndex % learning.dataset.words.length) + 1).padStart(2, '0')} / ${learning.dataset.words.length}`;
  const dot = document.createElement('i'); $('repeatIndicator').replaceChildren(dot, document.createTextNode(preferences.repeat ? ' REPEAT ON' : ' REPEAT OFF'));
  dot.style.background = preferences.repeat ? '#3b9b65' : '#a5ad9d';
  $('speakBtn').setAttribute('aria-label', revealed ? 'Hear example sentence' : mode === 'meaning' ? 'Hear the meaning' : 'Hear the word again');
  positionSkillStrip();
}
function positionSkillStrip() {
  const card=$('wordCard').getBoundingClientRect();
  $('skillStrip').style.bottom=`${card.height?Math.max(14,innerHeight-card.top+8):18}px`;
}
function makeChoices() {
  if (!currentWord) return;
  choices = mode === 'learn' ? [currentWord] : learning.options(wordIndex, 3);
  $('goalLabels').replaceChildren();labels=[];
  $('goalLabels').hidden=mode==='learn';$('goalLabels').style.setProperty('--choice-count',choices.length);
  choices.forEach((entry, index) => {
    const x = challenge.goalX + (index - (choices.length - 1) / 2) * challenge.goalWidth / choices.length;
    const button = document.createElement('button'); button.className = `goal-label${choices.length > 1 ? ' quiz' : ''}`;
    button.setAttribute('aria-label', `Aim at ${entry.word}`);button.title=entry.word;button.type='button';
    const strong = document.createElement('b'); strong.textContent = entry.word;
    const small = document.createElement('small'); small.textContent = choices.length === 1 ? 'SCORE TO COLLECT' : choices.length === 2 ? ['LEFT SIDE', 'RIGHT SIDE'][index] : ['LEFT SIDE', 'CENTER', 'RIGHT SIDE'][index]; button.append(strong, small);
    button.addEventListener('click', () => { if (state !== 'aim') return; unlockAudio(); targetX = x; updateGuide(); });
    $('goalLabels').append(button); labels.push({ element: button, entry, x });
  });
  if (targetZone) {updateZones();updateBonusTargets();}
}
function updateHUD() {
  $('stageNumber').textContent = `SHOT ${level % 3 + 1} / 3`;
  $('goalsValue').textContent = goals; $('scoreValue').textContent = String(score).padStart(4, '0');
  $('streakValue').textContent = streak >= 2 ? `✦ ${streak} STREAK` : '';
  $('roundDots').replaceChildren();
  for (let i = 0; i < 3; i++) { const dot = document.createElement('i'); dot.className = i < level % 3 ? 'done' : i === level % 3 ? 'current' : ''; $('roundDots').append(dot); }
  $('venueName').textContent = `LEVEL ${Math.floor(level / 3) + 1}`;
  $('challengeName').textContent = challenge.name.toUpperCase();
  $('livesDisplay').textContent = preferences.easy ? 'PRACTICE ∞' : `${'● '.repeat(ballsLeft)}${'○ '.repeat(3-ballsLeft)} BALLS`;
  $('livesDisplay').classList.toggle('low', ballsLeft === 1 && !preferences.easy);
  $('stageSelect').value = String(level % LEVELS.length);
  $('difficultyBadge').textContent=preferences.difficulty.toUpperCase();
  try{$('bestScore').textContent='BEST '+String(JSON.parse(localStorage.getItem('goal-club.best')||'{}').score||0).padStart(4,'0');}catch{}
  updateClock();
  updateProgressUI();
}
function newRound(advance = true) {
  cancelCharge();if(replayState)finishReplay(false);replayData=null;$('replayBtn').hidden=true;$('replayRibbon').hidden=true;
  if (advance) { wordIndex++; level++; }
  if (!advance || level % 3 === 0) ballsLeft = 3;
  challenge = getLevel(level, { practice: preferences.easy, difficulty: preferences.difficulty });
  currentWord = learning.current(wordIndex); tries = 0; targetX = challenge.goalX; bend = 0; autoNextAt = Infinity;lessonPlayback++;lessonFinished=false;
  roundStartedAt = elapsed;aimClock=18;ballMotion=null;
  world.clearShotEffects?.();world.setTheme(challenge.theme); world.setChallenge(challenge); world.setDefenders(challenge.defenders); world.resetPlayer();
  $('bendRange').value = 0; $('scoreFloat').classList.remove('show');
  confetti.visible = false; trail.visible = false; trail.material.opacity = .85; $('aimHint').style.opacity = 1;
  world.ball.position.set(challenge.startX, BALL_START_Y, challenge.startZ); world.ball.rotation.set(0, 0, 0); world.ball.visible = true;
  state = 'aim'; shot = null; gesture = null; kickClock = flightClock = resultClock = 0;
  document.body.classList.remove('flying', 'round-failed','precision-hit'); document.body.classList.add('aiming');
  $('shootBtn').disabled = false; $('shootBtn').classList.remove('next'); $('shootLabel').textContent = 'KICK'; $('bendRange').disabled = false;
  $('controlNote').textContent = 'Swipe a curve from the ball. Release to kick.';
  makeChoices(); updateWordCard(); updateHUD();updateShotControls(); world.update(0,0,{paused:false}); updateGuide(); learning.setPaused(paused()); speakPrompt();
}
function startGame() {
  started = true; document.body.classList.add('playing'); $('playUI').hidden = false; $('startScreen').hidden = true;
  closeDialogs(false); unlockAudio(); newRound(false);
}
function menu() {
  cancelCharge();if(replayState)finishReplay(false);replayData=null;$('replayBtn').hidden=true;$('replayRibbon').hidden=true;
  closeDialogs(false); started = false; state = 'menu'; learning.stop();
  document.body.classList.remove('playing', 'flying', 'aiming'); $('playUI').hidden = true; $('startScreen').hidden = false;
  guide.visible = false; targetRing.visible = false; targetZone.visible = false;bonusGroup.visible=false; world.resetPlayer(); world.ball.position.set(challenge.startX, BALL_START_Y, challenge.startZ);
  confetti.visible = false; trail.visible = false; dividerGroup.visible = false; $('aimHint').style.opacity = 1;
  challenge = getLevel(0); world.setTheme(0); world.setChallenge(challenge); world.setDefenders(challenge.defenders);
}
function openDialog(id) {
  cancelCharge();if(replayState)finishReplay(false);
  gesture = null; closeDialogs(false); learning.setPaused(true); $(id).showModal();
  if (id === 'reviewDialog') drawReview();
  if (id === 'challengeDialog') drawChallenges();
}
function closeDialogs(resume = true) { dialogs.forEach(dialog => { if (dialog.open) dialog.close(); }); if (resume && learning) { learning.setPaused(!started || document.hidden || state==='replay'); if (started) speakPrompt(); } }
function updateReviewBadge() { $('reviewBadge').textContent = learning.getReview().length; }
function drawReview() {
  const collection = learning.getReview(); $('reviewList').replaceChildren();
  $('reviewCount').textContent = `${collection.length} ${collection.length === 1 ? 'word' : 'words'} collected. Tap any play button to listen again.`;
  $('exportBtn').disabled = collection.length === 0;
  if (!collection.length) { const empty = document.createElement('p'); empty.className = 'empty-collection'; empty.textContent = 'Your collection starts with your first goal. Head to the pitch and make a word yours.'; $('reviewList').append(empty); return; }
  collection.slice().reverse().forEach(entry => {
    const row = document.createElement('div'); row.className = 'review-row';
    const words = document.createElement('div'), main = document.createElement('b'), meaning = document.createElement('small'); main.textContent = entry.word; meaning.textContent = entry.translation; words.append(main, meaning);
    const count = document.createElement('span'); count.textContent = `×${entry.count}`;
    const play = document.createElement('button'); play.textContent = '▶'; play.setAttribute('aria-label', `Hear ${entry.word}`);
    play.addEventListener('click', () => { learning.setPaused(false); unlockAudio(); learning.speakWord(entry, { repeat: false }); }); row.append(words, count, play); $('reviewList').append(row);
  });
}

let guide, targetRing, targetZone, dividerGroup, trail, confetti, bonusGroup;
let matrices, reusablePoint, previousBall, collisionPoint, raycaster, plane, mouse, zoneMaterial;
const trailPoints = [], confettiParts = [], confettiCount = 70;
function createEffects() {
  const T = world.THREE;
  matrices = new T.Object3D(); reusablePoint = new T.Vector3(); previousBall = new T.Vector3(); collisionPoint = new T.Vector3();
  raycaster = new T.Raycaster(); plane = new T.Plane(new T.Vector3(0, 1, 0), 0); mouse = new T.Vector2();
  guide = new T.InstancedMesh(new T.SphereGeometry(.085, 8, 6), new T.MeshBasicMaterial({ color: 0xeaf0d5, depthTest: true }), 36); guide.frustumCulled = false; guide.visible = false; world.scene.add(guide);
  targetRing = new T.Mesh(new T.RingGeometry(.37, .45, 40), new T.MeshBasicMaterial({ color: 0xe2ff62, side: T.DoubleSide, transparent: true, opacity: .95 })); targetRing.rotation.x = -Math.PI / 2; targetRing.visible = false; world.scene.add(targetRing);
  zoneMaterial = new T.MeshBasicMaterial({ color: 0xe2ff62, transparent: true, opacity: .10, side: T.DoubleSide, depthWrite: false });
  targetZone = new T.Mesh(new T.PlaneGeometry(8.9, 2.95), zoneMaterial); targetZone.position.set(0, 1.52, -11.82); targetZone.visible = false; world.scene.add(targetZone);
  dividerGroup = new T.Group(); world.scene.add(dividerGroup);
  bonusGroup=new T.Group();bonusGroup.name='goalBonusTargets';bonusGroup.visible=false;world.scene.add(bonusGroup);
  const trailGeometry = new T.BufferGeometry(); trailGeometry.setAttribute('position', new T.BufferAttribute(new Float32Array(24 * 3), 3));
  trail = new T.Line(trailGeometry, new T.LineBasicMaterial({ color: 0xffe7b3, transparent: true, opacity: .85 })); trail.frustumCulled = false; trail.visible = false; world.scene.add(trail);
  confetti = new T.InstancedMesh(new T.PlaneGeometry(.14, .28), new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide, transparent: true, opacity: 1 }), confettiCount); confetti.frustumCulled = false; confetti.visible = false;
  const colors = [0xe2ff62, 0xf4f4db, 0xec8062, 0x6ab6a4, 0xb2d96f];
  for (let i = 0; i < confettiCount; i++) { confetti.setColorAt(i, new T.Color(colors[i % colors.length])); confettiParts.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, phase: i }); }
  world.particles.add(confetti);
  guide.name = 'goalGuide'; targetRing.name = 'goalTargetRing'; targetZone.name = 'goalTargetZone';
  trail.name = 'goalTrail'; dividerGroup.name = 'goalDividers'; confetti.name = 'goalConfetti';
}
function updateZones() {
  const T = world.THREE;
  for (const child of [...dividerGroup.children]) { child.geometry.dispose(); child.material.dispose(); dividerGroup.remove(child); }
  for (let i = 1; i < choices.length; i++) {
    const line = new T.Mesh(new T.CylinderGeometry(.02, .02, 2.9, 5), new T.MeshBasicMaterial({ color: 0xfaf8e8, transparent: true, opacity: .65 }));
    line.position.set(challenge.goalX - challenge.goalWidth/2 + i * (challenge.goalWidth / choices.length), 1.5, -11.76); dividerGroup.add(line);
  }
  dividerGroup.visible = started && choices.length > 1;
}
function aimShot() {return {x:targetX,bend,...shotProfile(shotStyle,power,preferences.easy)};}
function updateShotControls() {
  const locked=started&&(state!=='aim'||!!charge?.active);
  document.querySelectorAll('[data-shot]').forEach(button=>{button.classList.toggle('active',button.dataset.shot===shotStyle);button.setAttribute('aria-pressed',button.dataset.shot===shotStyle);button.disabled=locked;});
  $('powerRange').value=Math.round(power*100);$('powerRange').disabled=locked;
  $('powerFill').style.width=`${power*100}%`;$('powerValue').textContent=`${Math.round(power*100)}%`;
  $('chargeHint').hidden=started&&state!=='aim';
  world.setShotStyle?.(shotStyle);
}
function setShotStyle(value) {
  if(started&&state!=='aim')return;
  if(!['drive','curl','chip'].includes(value))return;
  cancelCharge();
  shotStyle=value;preferences.shotStyle=value;persist();updateShotControls();lastGuideCheck=-1;updateGuide();
}
function setDifficulty(value) {
  cancelCharge();if(replayState)finishReplay(false);
  preferences.difficulty=['practice','challenge','pro'].includes(value)?value:'challenge';
  preferences.easy=preferences.difficulty==='practice';applyPreferences();
  if(started)newRound(false);
  else {challenge=getLevel(level,{practice:preferences.easy,difficulty:preferences.difficulty});world.setChallenge(challenge);world.setDefenders(challenge.defenders);updateHUD();}
}
function updateClock() {
  $('shotClock').hidden=preferences.difficulty!=='pro';
  $('shotClock').textContent=`${Math.max(0,aimClock).toFixed(1)}s`;
  $('shotClock').classList.toggle('urgent',aimClock<5);
}
function updateBonusTargets() {
  const T=world.THREE;
  for(const mesh of [...bonusGroup.children]){mesh.geometry.dispose();mesh.material.dispose();bonusGroup.remove(mesh);}
  const source=challenge.bonus||{x:challenge.goalX+challenge.goalWidth*.31,y:1.72,radius:.42};
  bonusTargets=choices.length>1?labels.map(label=>({x:label.x,y:source.y,radius:Math.min(source.radius,.43)})):[{...source}];
  for(const target of bonusTargets){
    target.y=clamp(target.y,.45,GOAL_HEIGHT-.45);
    const mesh=new T.Mesh(new T.RingGeometry(target.radius-.045,target.radius,40),new T.MeshBasicMaterial({color:0xffd67e,side:T.DoubleSide,transparent:true,opacity:.8,depthWrite:false}));
    mesh.name='goalBonusTarget';mesh.position.set(target.x,target.y,GOAL_Z+.08);bonusGroup.add(mesh);
  }
  bonusGroup.visible=started;
}
function updateLooseBall(dt,inNet) {
  if(!ballMotion)return;
  const p=world.ball.position;ballMotion.vy-=9.8*dt;
  p.x+=ballMotion.vx*dt;p.y+=ballMotion.vy*dt;p.z+=ballMotion.vz*dt;
  if(p.y<BALL_START_Y){p.y=BALL_START_Y;ballMotion.vy=Math.abs(ballMotion.vy)>.8?-ballMotion.vy*.34:0;ballMotion.vx*=.84;ballMotion.vz*=.84;}
  if(inNet&&p.z<GOAL_Z-1.25){p.z=GOAL_Z-1.25;ballMotion.vz=Math.abs(ballMotion.vz)*.38;}
  if(inNet&&p.z>GOAL_Z-.1){p.z=GOAL_Z-.1;ballMotion.vz=-Math.abs(ballMotion.vz)*.25;}
  world.ball.rotation.x-=ballMotion.vz*dt*2;world.ball.rotation.z-=ballMotion.vx*dt*2;
}
function curve(t, out = reusablePoint, shotData = aimShot()) {
  const p=shotPoint(t,shotData,challenge); return out.set(p.x,p.y,p.z);
}
function aimedChoice(x = targetX) { return clamp(Math.floor((x-challenge.goalX+challenge.goalWidth/2)/(challenge.goalWidth/choices.length)),0,choices.length-1); }
function pathBlocked() {
  for (let i=1;i<70;i++) { const a=shotPoint((i-1)/70,aimShot(),challenge),b=shotPoint(i/70,aimShot(),challenge);if(collisionOnSegment(a,b))return true; }
  return false;
}
function updateGuide() {
  if (!guide) return;
  const aiming = started && state === 'aim'; guide.visible=aiming;targetRing.visible=aiming;targetZone.visible=started;bonusGroup.visible=started;
  if(!aiming)return;
  world.setAim?.({x:targetX,bend,power,style:shotStyle});
  guide.count=preferences.difficulty==='pro'?22:36;
  for(let i=0;i<guide.count;i++){const p=curve((i+1)/37);matrices.position.copy(p);matrices.rotation.set(0,0,0);matrices.scale.setScalar(1);matrices.updateMatrix();guide.setMatrixAt(i,matrices.matrix);}
  guide.instanceMatrix.needsUpdate=true;targetRing.position.set(targetX,.08,GOAL_Z);
  const profile=shotProfile(shotStyle,power,preferences.easy);
  const zone=aimedChoice(),inNet=goalOutcome(targetX,challenge,profile.aimY)==='goal';
  labels.forEach((label,i)=>label.element.classList.toggle('active',inNet&&(choices.length===1||i===zone)));
  targetZone.scale.x=challenge.goalWidth/8.9/choices.length;targetZone.position.x=challenge.goalX-challenge.goalWidth/2+(zone+.5)*challenge.goalWidth/choices.length;
  targetZone.material.opacity=inNet ? .10 : .02;
  guide.material.color.set(inNet?0xe9efc9:0xffa174);targetRing.material.color.set(inNet?0xf1d28c:0xff7d6d);
  bonusGroup.children.forEach(mesh=>mesh.material.opacity=.67+Math.sin(elapsed*3)*.13);
  if(elapsed-lastGuideCheck>.15||lastGuideCheck<0){
    lastGuideCheck=elapsed;
    $('hintText').textContent=!inNet?'Too much height or width. Adjust aim or power.':gesture?'Draw the route. Release to kick.':preferences.easy&&pathBlocked()?'Blocked: bend wider or try a different shot type.':challenge.tip;
  }
}
function shoot() {
  if(paused())return;unlockAudio();
  if(state==='replay'){finishReplay();return;}
  if(state==='goal'){newRound(true);return;}
  if(state==='failed'){const rewind=level%3;level-=rewind;wordIndex=Math.max(0,wordIndex-rewind);newRound(false);return;}
  if(state==='miss'){retry();return;}
  if(state!=='aim')return;
  cancelCharge(false);preferences.power=power;persist();
  tries++;state='kick';kickClock=0;flightClock=0;
  shot={...aimShot(),choice:aimedChoice()};ballMotion=null;
  replayData={shot:{...shot},startTime:elapsed-roundStartedAt,samples:[],end:null};
  recordReplayPoint(0,replayData.startTime);recordReplayPoint(.34,replayData.startTime+.34);$('replayBtn').hidden=true;
  world.setShotStyle?.(shotStyle);updateShotControls();
  $('shootBtn').disabled=true;$('shootLabel').textContent='…';$('bendRange').disabled=true;
  document.body.classList.remove('aiming');document.body.classList.add('flying');guide.visible=false;targetRing.visible=false;
  $('aimHint').style.opacity=0;trailPoints.length=0;
}
function retry() {
  cancelCharge();replayData=null;$('replayBtn').hidden=true;world.clearShotEffects?.();
  state='aim';shot=null;aimClock=18;ballMotion=null;world.resetPlayer();world.ball.position.set(challenge.startX,BALL_START_Y,challenge.startZ);world.ball.visible=true;
  world.defenders.forEach(d=>d.hit=false);(world.obstacles||[]).forEach(o=>o.hit=false);$('scoreFloat').classList.remove('show');
  $('shootBtn').disabled=false;$('shootLabel').textContent='KICK';$('shootBtn').classList.remove('next');$('bendRange').disabled=false;
  $('controlNote').textContent='Adjust the route and watch the moving defenders.';$('aimHint').style.opacity=1;
  document.body.classList.remove('flying');document.body.classList.add('aiming');trail.visible=false;updateWordCard();updateShotControls();updateClock();updateGuide();speakPrompt();
}
function miss(reason, blocker = null) {
  cancelCharge();completeReplay(reason,blocker);
  gesture=null;
  if(blocker && !blocker.keeper)blocker.hit=true;
  if(blocker?.keeper)world.saveBall?.(blocker,world.ball.position);
  ballMotion={vx:reason==='post'?-Math.sign(shot?.x-challenge.goalX)*2.8:0,vy:reason==='timeout'?0:1.2,vz:reason==='timeout'?0:2.5};
  if(!preferences.easy)ballsLeft=Math.max(0,ballsLeft-1);
  state=ballsLeft===0&&!preferences.easy?'failed':'miss';streak=0;resultClock=0;
  const out=state==='failed';
  $('shootBtn').disabled=false;$('shootLabel').textContent=out?'RESTART':'RETRY';$('shootBtn').classList.add('next');
  const messages={timeout:['TIME’S UP','Pro gives you 18 seconds to release the shot'],high:['OVER THE BAR','Lower the power or choose a driven shot'],crossbar:['CROSSBAR!','A little less power will bring it down'],low:['TOO LOW','Lift the shot a little'],word:['WRONG WORD',`${choices[shot.choice]?.word||''} = ${choices[shot.choice]?.translation||''}`],post:['OFF THE POST','Keep the whole ball inside the posts'],wide:['WIDE!','Your aim went outside the goal'],keeper:['SAVED!','Wait for the keeper to move'],obstacle:['BLOCKED','Find a route around the obstacle'],blocked:['BLOCKED','Curve around the red wall']};
  const [title,detail]=messages[reason]||messages.blocked;
  announceResult(out?'OUT OF BALLS':title,out?'RESTART THIS LEVEL — KEEP YOUR WORD COLLECTION':`${detail} · ${preferences.easy?'PRACTICE':ballsLeft+' '+(ballsLeft===1?'BALL':'BALLS')+' LEFT'}`,true);
  $('controlNote').textContent=out?'Three balls. Three shots. Try this level again.':detail;
  document.body.classList.toggle('round-failed',out);updateHUD();updateShotControls();sound('miss');speakPrompt();
}
function goal() {
  const outcome=goalOutcome(shot.x,challenge,world.ball.position.y);if(outcome!=='goal'){miss(outcome);return;}
  if(mode!=='learn'&&choices[shot.choice]?.word!==currentWord.word){miss('word');return;}
  state='goal';goals++;streak++;resultClock=0;
  const precise=bonusTargets.some(t=>Math.hypot(shot.x-t.x,world.ball.position.y-t.y)<=t.radius);
  const stars=tries===1?3:tries===2?2:1,bonus=150+Math.min(streak,10)*25+(Math.abs(shot.bend)>2?40:0)+(precise?150:0)+(preferences.difficulty==='pro'?100:0);
  completeReplay('goal');progress.record(level%LEVELS.length,{difficulty:preferences.difficulty,mode,stars,points:bonus,style:shot.style,precise});
  document.body.classList.toggle('precision-hit',precise);
  world.scoreGoal?.({x:shot.x,y:world.ball.position.y});
  ballMotion={vx:Math.sign(shot.bend)*.25,vy:-1.2,vz:-2.5};
  score+=bonus;learning.review(currentWord);updateReviewBadge();updateWordCard(true);saveStats();updateHUD();updateShotControls();
  $('shootBtn').disabled=false;$('shootLabel').textContent='NEXT';$('shootBtn').classList.add('next');
  $('controlNote').textContent='Word collected. Next challenge incoming.';
  announceResult(precise?'TOP CORNER!':level%3===2?'LEVEL CLEAR!':shot.style==='chip'?'WHAT A CHIP!':Math.abs(shot.bend)>3?'WHAT A CURVE!':'GOOOAL!',`${'★'.repeat(stars)}${'☆'.repeat(3-stars)}  +${bonus}${precise?'  ·  PRECISION +150':''}${streak>1?'  ·  '+streak+' IN A ROW':''}`);
  sound('goal');playGoalLesson();spawnConfetti();
  if(navigator.vibrate)navigator.vibrate([25,20,40]);
}
function spawnConfetti() {
  confetti.visible = true; confetti.material.opacity = 1;
  for (const part of confettiParts) { part.x = shot.x; part.y = 1.6; part.z = -10.9; part.vx = (Math.random() - .5) * 8; part.vy = 3 + Math.random() * 5; part.vz = (Math.random() - .5) * 5; }
}
function updateParticles(dt) {
  if (!confetti.visible) return;
  confetti.material.opacity = clamp(1 - (resultClock - 1.4) / 1.5, 0, 1);
  if (resultClock > 3) { confetti.visible = false; return; }
  for (let i = 0; i < confettiCount; i++) {
    const p = confettiParts[i]; p.vy -= 5 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < .08) { p.y = .08; p.vy = 0; p.vx *= .93; p.vz *= .93; }
    matrices.position.set(p.x, p.y, p.z); matrices.rotation.set(elapsed * 4 + i, elapsed * 2 + i, i); matrices.scale.setScalar(1); matrices.updateMatrix(); confetti.setMatrixAt(i, matrices.matrix);
  }
  confetti.instanceMatrix.needsUpdate = true;
}
function collisionOnSegment(a,b,timeStart=elapsed-roundStartedAt,timeEnd=timeStart) {
  for(const defender of world.defenders)if(segmentHitsDefender(a,b,defender,timeStart,timeEnd))return defender;
  for(const obstacle of world.obstacles||[])if(segmentHitsObstacle(a,b,obstacle,timeStart,timeEnd))return obstacle;
  return null;
}
function updateFlight(dt) {
  const steps = Math.max(1, Math.ceil(dt / (1 / 100)));
  const stepTime=dt/steps,frameStart=elapsed-roundStartedAt-dt;
  for (let step = 0; step < steps; step++) {
    previousBall.copy(world.ball.position); flightClock += stepTime;
    const t = clamp(flightClock / shot.duration, 0, 1); curve(t, collisionPoint, shot); world.ball.position.copy(collisionPoint);
    recordReplayPoint(.34+flightClock,frameStart+(step+1)*stepTime);
    const defender = collisionOnSegment(previousBall, collisionPoint,frameStart+step*stepTime,frameStart+(step+1)*stepTime);
    if (defender) { miss(defender.keeper ? 'keeper' : defender.width ? 'obstacle' : 'blocked', defender); return; }
    if (t >= 1) { goal(); return; }
  }
  world.ball.rotation.x -= dt * 19; world.ball.rotation.z -= dt * shot.bend * .9;
  trailPoints.push(world.ball.position.clone()); if (trailPoints.length > 24) trailPoints.shift();
  const positions = trail.geometry.attributes.position;
  trailPoints.forEach((point, index) => positions.setXYZ(index, point.x, point.y, point.z)); positions.needsUpdate = true;
  trail.geometry.setDrawRange(0, trailPoints.length); trail.visible = true;
}
function updateLabels() {
  const hidden=!started||mode==='learn';
  if($('goalLabels').hidden!==hidden){$('goalLabels').hidden=hidden;positionSkillStrip();}
}
function frame(now) {
  requestAnimationFrame(frame); const dt = Math.min((now - lastFrame) / 1000, .1); lastFrame = now;
  const isPaused = paused();
  if ((!isPaused || !started)&&state!=='replay') elapsed += dt;
  if (!isPaused) {
    if (state === 'aim') {
      updateCharge(now);
      if(preferences.difficulty==='pro'){aimClock=Math.max(0,aimClock-dt);updateClock();if(aimClock<=0){shot={...aimShot(),choice:aimedChoice()};tries++;miss('timeout');}}
      updateGuide();
    }
    if(state==='replay')updateReplay(dt);
    else if (state === 'kick') {
      kickClock += dt; world.kick(kickClock / .65);
      if (kickClock >= .34) { state = 'flight'; sound('kick'); updateFlight(kickClock-.34); }
    } else if (state === 'flight') {
      kickClock += dt; world.kick(Math.min(kickClock / .65, 1)); updateFlight(dt);
    } else if (state === 'goal') {
      resultClock += dt; world.celebrate(Math.min(resultClock / 2, 1));
      updateLooseBall(dt,true);
      updateParticles(dt); trail.material.opacity = Math.max(0, .85 - resultClock * 1.4);
      if(resultClock>=autoNextAt)newRound(true);
    } else if (state === 'miss' || state === 'failed') {
      resultClock += dt;
      updateLooseBall(dt,false);
      trail.material.opacity = Math.max(0, .85 - resultClock * 2);
    }
  }
  if (state === 'flight') trail.material.opacity = .85;
  world.update(replayState?dt*.45:dt, replayState?replayState.fieldTime:started?elapsed-roundStartedAt:elapsed, { paused: isPaused && started }); updateLabels();
}
function resize() { world.resize(window.innerWidth, window.innerHeight); updateLabels();positionSkillStrip(); }
function bindControls() {
  function screenToGround(clientX,clientY) {
    mouse.set(clientX/innerWidth*2-1,-clientY/innerHeight*2+1);raycaster.setFromCamera(mouse,world.camera);
    if(!raycaster.ray.intersectPlane(plane,reusablePoint))return null;
    return {x:reusablePoint.x,z:reusablePoint.z};
  }
  function adjustSwipe(event) {
    if(!gesture)return;
    gesture.lastX=event.clientX;gesture.lastY=event.clientY;
    if(gesture.kind==='draw') {
      mouse.set(event.clientX/innerWidth*2-1,-event.clientY/innerHeight*2+1);raycaster.setFromCamera(mouse,world.camera);
      const p=unprojectShotRay(raycaster.ray.origin,raycaster.ray.direction,challenge,aimShot(),gesture.lastT);if(!p)return;
      gesture.lastT=p.t;gesture.points.push({x:p.x,t:p.t});if(gesture.points.length>120)gesture.points.shift();
      const fit=fitSwipe(gesture.points,challenge.startX,gesture.aim,gesture.bend);
      targetX=clamp(fit.x,challenge.goalX-7.5,challenge.goalX+7.5);bend=clamp(fit.bend,-10,10);
    } else {
      targetX=clamp(gesture.aim+(event.clientX-gesture.x)*challenge.goalWidth/Math.max(100,gesture.goalPixels),challenge.goalX-7.5,challenge.goalX+7.5);
      bend=clamp(gesture.bend+(gesture.y-event.clientY)/Math.max(18,innerHeight*.04),-10,10);
    }
    $('bendRange').value=bend;lastGuideCheck=-1;updateGuide();
  }
  $('gameCanvas').addEventListener('pointerdown',event=>{
    if(!event.isPrimary||event.button!==0)return;
    if(state==='miss'){retry();return;}if(state!=='aim'||paused()||charge)return;
    const start=world.project([challenge.startX,BALL_START_Y,challenge.startZ]);
    const a=world.project([challenge.goalX-challenge.goalWidth/2,0,GOAL_Z]),b=world.project([challenge.goalX+challenge.goalWidth/2,0,GOAL_Z]);
    gesture={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,aim:targetX,bend,lastT:0,goalPixels:b.x-a.x,points:[],kind:Math.hypot(event.clientX-start.x,event.clientY-start.y)<Math.max(85,innerWidth*.18)?'draw':'adjust'};
    $('gameCanvas').setPointerCapture(event.pointerId);unlockAudio();updateGuide();
  });
  $('gameCanvas').addEventListener('pointermove',event=>{if(gesture?.id===event.pointerId&&state==='aim')adjustSwipe(event);});
  $('gameCanvas').addEventListener('pointerup',event=>{
    if(!gesture||gesture.id!==event.pointerId)return;
    if(state!=='aim'||paused()){gesture=null;return;}
    const distance=Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y),draw=gesture.kind==='draw';
    if(distance>8)adjustSwipe(event);
    else {const p=screenToGround(event.clientX,event.clientY);if(p)targetX=clamp(p.x,challenge.goalX-7.5,challenge.goalX+7.5);}
    gesture=null;lastGuideCheck=-1;updateGuide();if(draw&&distance>45)shoot();
  });
  $('gameCanvas').addEventListener('pointercancel',()=>{gesture=null;updateGuide();});
  $('gameCanvas').addEventListener('contextmenu', event => event.preventDefault());
  $('bendRange').addEventListener('input', event => { bend = Number(event.target.value); lastGuideCheck = -1; updateGuide(); });
  $('straightBtn').addEventListener('click', () => { if (state !== 'aim') return; bend = 0; targetX = challenge.goalX; $('bendRange').value = 0; lastGuideCheck = -1; updateGuide(); });
  $('shootBtn').addEventListener('pointerdown',event=>{
    if(!event.isPrimary||event.button!==0)return;
    shootPointerConsumed=false;
    if(state!=='aim'||paused())return;
    event.preventDefault();unlockAudio();gesture=null;shootPointerConsumed=true;
    charge={id:event.pointerId,startedAt:performance.now(),originalPower:power,active:false};
    $('shootBtn').setPointerCapture(event.pointerId);
  });
  $('shootBtn').addEventListener('pointerup',event=>{
    if(!charge||charge.id!==event.pointerId)return;
    event.preventDefault();
    if(state!=='aim'||paused()){cancelCharge();return;}
    updateCharge();cancelCharge(false);shoot();
  });
  $('shootBtn').addEventListener('pointercancel',()=>cancelCharge());
  $('shootBtn').addEventListener('lostpointercapture',()=>cancelCharge());
  $('shootBtn').addEventListener('contextmenu',event=>event.preventDefault());
  $('shootBtn').addEventListener('click',event=>{if(event.detail>0&&shootPointerConsumed){shootPointerConsumed=false;return;}shoot();});
  $('replayBtn').addEventListener('click',startReplay);
  $('startBtn').addEventListener('click', startGame);
  for(const id of ['challengeName','startChallengesBtn','openChallengesBtn'])$(id).addEventListener('click',()=>openDialog('challengeDialog'));
  $('homeBtn').addEventListener('click', () => { if (started) openDialog('pauseDialog'); });
  $('pauseBtn').addEventListener('click', () => openDialog('pauseDialog')); $('resumeBtn').addEventListener('click', () => { unlockAudio(); closeDialogs(); }); $('menuBtn').addEventListener('click', menu);
  $('settingsBtn').addEventListener('click', () => openDialog('settingsDialog')); $('reviewBtn').addEventListener('click', () => openDialog('reviewDialog'));
  $('startImportBtn').addEventListener('click', () => openDialog('importDialog')); $('openImportBtn').addEventListener('click', () => openDialog('importDialog'));
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeDialogs()));
  dialogs.forEach(dialog => { dialog.addEventListener('cancel', () => { setTimeout(() => closeDialogs(), 0); }); dialog.addEventListener('click', event => { if (event.target !== dialog) return; const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialogs(); }); });
  $('speakBtn').addEventListener('click', () => { unlockAudio(); speakPrompt(); });
  $('audioBtn').addEventListener('click', () => { preferences.muted = !preferences.muted; applyPreferences(); unlockAudio(); toast(preferences.muted ? 'Sound off' : 'Sound on'); });
  $('hideBtn').addEventListener('click', () => { preferences.hidden = !preferences.hidden; applyPreferences(); });
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
  $('settingsMode').addEventListener('change', event => setMode(event.target.value));
  for (const id of ['startLanguage', 'settingsLanguage']) $(id).addEventListener('change', event => { if (event.target.value !== '__custom') learning.useLanguage(event.target.value); });
  $('repeatToggle').addEventListener('change', event => { preferences.repeat = event.target.checked; applyPreferences(); speakPrompt(); });
  $('translationToggle').addEventListener('change', event => { preferences.translation = event.target.checked; applyPreferences(); });
  $('easyToggle').addEventListener('change',event=>setDifficulty(event.target.checked?'practice':'challenge'));
  for(const id of ['difficultySelect','startDifficulty'])$(id).addEventListener('change',e=>setDifficulty(e.target.value));
  $('difficultyBadge').addEventListener('click',()=>openDialog('settingsDialog'));
  document.querySelectorAll('[data-shot]').forEach(button=>button.addEventListener('click',()=>setShotStyle(button.dataset.shot)));
  $('powerRange').addEventListener('input',event=>{if(state!=='aim'&&started)return;cancelCharge();power=Number(event.target.value)/100;preferences.power=power;persist();updateShotControls();lastGuideCheck=-1;updateGuide();});
  $('tuneBtn').addEventListener('click',()=>{document.body.classList.toggle('tuning');$('tuneBtn').setAttribute('aria-expanded',document.body.classList.contains('tuning'));});
  $('autoToggle').addEventListener('change',event=>{preferences.auto=event.target.checked;applyPreferences();if(state==='goal')autoNextAt=preferences.auto&&lessonFinished?Math.max(2.5,resultClock+.6):Infinity;});
  $('stageSelect').addEventListener('change',event=>selectChallenge(event.target.value));
  $('soundToggle').addEventListener('change', event => { preferences.muted = !event.target.checked; applyPreferences(); unlockAudio(); });
  $('fullscreenBtn').addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else toast('This device already uses the full available game area.'); } catch { toast('Full screen is not available here. The game still fits your screen.'); } });
  $('importBtn').addEventListener('click', () => { try { learning.load($('jsonInput').value); $('importError').textContent = ''; closeDialogs(); toast(`${learning.dataset.words.length} words loaded. Ready to play!`); } catch (error) { $('importError').textContent = error.message; } });
  $('fileInput').addEventListener('change', async event => { const file = event.target.files?.[0]; if (!file) return; try { await learning.importFile(file); $('importError').textContent = ''; closeDialogs(); toast(`${learning.dataset.words.length} words loaded. Ready to play!`); } catch (error) { $('importError').textContent = error.message; } event.target.value = ''; });
  $('exportBtn').addEventListener('click', () => { learning.exportReview(); toast('Your learned words are ready to save.'); });
  addEventListener('keydown', event => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
    if (event.code === 'KeyP' || event.code === 'Escape') { if (started) { if (dialogs.some(d => d.open)) closeDialogs(); else openDialog('pauseDialog'); } return; }
    if (paused()) return;
    if (event.code === 'Space' || event.code === 'Enter') {
      if (event.target.tagName === 'BUTTON' && !['shootBtn', 'straightBtn'].includes(event.target.id) && !event.target.classList.contains('goal-label')) return;
      event.preventDefault(); if(!event.repeat)shoot(); return;
    }
    if (state !== 'aim') return;
    if(['Digit1','Digit2','Digit3'].includes(event.code)){setShotStyle(['drive','curl','chip'][Number(event.code.slice(-1))-1]);return;}
    if (event.code === 'ArrowLeft') { event.preventDefault(); targetX = clamp(targetX - .3, challenge.goalX-7.5, challenge.goalX+7.5); }
    if (event.code === 'ArrowRight') { event.preventDefault(); targetX = clamp(targetX + .3, challenge.goalX-7.5, challenge.goalX+7.5); }
    if (event.code === 'KeyA') bend = clamp(bend - .4, -10, 10);
    if (event.code === 'KeyD') bend = clamp(bend + .4, -10, 10);
    $('bendRange').value = bend; lastGuideCheck = -1; updateGuide();
  });
  addEventListener('resize', resize); window.visualViewport?.addEventListener('resize', resize);
  addEventListener('blur',()=>{cancelCharge();gesture=null;});
  document.addEventListener('visibilitychange', () => {cancelCharge();gesture=null;learning.setPaused(document.hidden || paused() || state==='replay'); if (document.hidden && started && !dialogs.some(d => d.open)) openDialog('pauseDialog'); });
  $('gameCanvas').addEventListener('webglcontextlost', event => { event.preventDefault(); learning.stop(); toast('The graphics paused. Reload to return to the pitch.'); });
}
function applyPreferences() {
  document.body.classList.toggle('muted', preferences.muted); document.body.classList.toggle('word-hidden', preferences.hidden);
  $('audioBtn').classList.toggle('active', preferences.muted); $('audioBtn').setAttribute('aria-label', preferences.muted ? 'Turn sound on' : 'Mute sound');
  $('hideBtn').classList.toggle('active', preferences.hidden); $('hideBtn').setAttribute('aria-label', preferences.hidden ? 'Show word card' : 'Hide word card');
  $('repeatToggle').checked = preferences.repeat; $('translationToggle').checked = preferences.translation; $('easyToggle').checked = preferences.easy;
  $('difficultySelect').value=preferences.difficulty;$('startDifficulty').value=preferences.difficulty;
  document.body.classList.toggle('pro-mode',preferences.difficulty==='pro');
  $('soundToggle').checked = !preferences.muted; $('autoToggle').checked = preferences.auto;
  learning.setMuted(preferences.muted); learning.setRepeat(preferences.repeat); if (currentWord) updateWordCard(state==='goal'||replayState?.original.state==='goal'); persist();
}
async function init() {
  try {
    try { world = createWorld($('gameCanvas')); }
    catch (graphicsError) { console.info('Using the lightweight soccer renderer: WebGL is unavailable.'); world = createFallbackWorld($('gameCanvas')); }
    createEffects();
    learning = createLearning({ onData: displayData, onStatus: toast }); await learning.ready();
    for(let i=0;i<LEVELS.length;i++){const option=document.createElement('option');option.value=i;option.textContent=`${i+1}. ${LEVELS[i].name}`;$('stageSelect').append(option);}
    challenge=getLevel(level,{practice:preferences.easy,difficulty:preferences.difficulty});world.setTheme(challenge.theme);world.setChallenge(challenge);
    currentWord = learning.current(0); setMode(mode); applyPreferences(); bindControls(); makeChoices(); updateHUD();updateShotControls();
    world.setDefenders(challenge.defenders);
    resize(); $('loading').hidden = true; requestAnimationFrame(frame);
  } catch (error) {
    console.error('Goal Club could not start:', error);
    $('loading').replaceChildren();
    const title = document.createElement('h2'); title.textContent = 'The pitch needs a restart.';
    const text = document.createElement('p'); text.textContent = 'Please reload the game in a browser with WebGL enabled.';
    const button = document.createElement('button'); button.className = 'primary-btn'; button.style.width = '200px'; button.textContent = 'RELOAD GAME ↗'; button.addEventListener('click', () => location.reload());
    $('loading').append(title, text, button);
  }
}
init();
