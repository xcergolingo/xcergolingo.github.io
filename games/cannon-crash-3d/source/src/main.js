import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {LEVELS,THEMES,TOTAL_LEVELS} from './levels.js';
import {buildCannon,createStage,PLATFORM,TARGET_PHYSICS_MATERIAL} from './world.js';
import {Effects} from './effects.js';
import {LANGUAGES,DEMO_DATA,normalizeGameData,initialGameData,makeLessonDeck,exportBasket,escapeHtml,languageName} from './learning.js';
import {AudioGuide} from './audio-guide.js';
import {refreshTargetLabels,releaseTargetLabels} from './labels.js';
import './styles.css';
import './impact.css';
import './learning.css';

const $=id=>document.getElementById(id);
const app=$('app'),container=$('scene'),overlay=$('screenOverlay'),overlayContent=$('overlayContent');
const hud=$('hud'),pauseBtn=$('pauseBtn'),fireBtn=$('fireBtn'),comboText=$('comboText');
const guide=new AudioGuide();
let renderer;
try{
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
}catch(error){
  // Some remote preview browsers disable graphics hardware entirely. Real mobile
  // browsers with WebGL render the game; unsupported browsers get a useful state.
  $('scene').style.background='linear-gradient(155deg,#ec9b75,#9b567a 65%,#342e5b)';
  $('screenOverlay').classList.remove('hidden');
  $('overlayContent').innerHTML='<p class="eyebrow">CANNON CRASH 3D</p><div class="game-logo">CANNON<em>CRASH!</em></div><div class="overlay-card"><h2>3D REQUIRED</h2><p>This browser has WebGL turned off. Open the game in Safari or Chrome with WebGL enabled to play the full physics adventure.</p><div class="tutorial-chips"><span>THREE.JS</span><span>REAL PHYSICS</span><span>10 LEVELS</span></div></div>';
  throw new Error('Cannon Crash 3D requires a WebGL-enabled browser', {cause:error});
}
renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.48;
renderer.shadowMap.enabled=false; // stylized contact grounding without expensive mobile shadow passes
container.append(renderer.domElement);

const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(44,1,.1,240);
const lookAt=new THREE.Vector3(0,2.35,-3.5);
const cameraHome=new THREE.Vector3(0,8.7,20.5);
camera.position.copy(cameraHome);camera.lookAt(lookAt);
scene.add(new THREE.HemisphereLight('#fff5e0','#656589',2.45));
const sunlight=new THREE.DirectionalLight('#fff6e1',3.1);sunlight.position.set(-10,20,11);scene.add(sunlight);
const fillLight=new THREE.DirectionalLight('#a8d8fa',1.05);fillLight.position.set(14,12,-25);scene.add(fillLight);

const physics=new CANNON.World({gravity:new CANNON.Vec3(0,-14,0),allowSleep:true});
physics.broadphase=new CANNON.SAPBroadphase(physics);
physics.defaultContactMaterial.friction=.16;
physics.defaultContactMaterial.restitution=.2;
physics.solver.iterations=14;
const ballMat=new CANNON.Material('balls');
physics.addContactMaterial(new CANNON.ContactMaterial(ballMat,TARGET_PHYSICS_MATERIAL,{friction:.12,restitution:.43}));

const cannon=buildCannon(scene);
const effects=new Effects(scene,camera);
// The video shows a fast, beaded stream rather than a few oversized cannonballs.
const BALL_RADIUS=.235, BALL_MASS=2.05, BALLS_PER_SALVO=19;
// Unlimited salvos can run for minutes: cap old projectiles to protect phones.
const BALL_LIFETIME=6.5, MAX_ACTIVE_BALLS=110;
const ballGeometry=new THREE.SphereGeometry(BALL_RADIUS,16,12);
const ballMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.23,metalness:.06,emissive:'#a1c8e9',emissiveIntensity:.12});
const balls=[];

// Cannon trajectory preview uses the exact same ballistics as real shots.
const aimPositions=new Float32Array(31*3);
const aimGeo=new THREE.BufferGeometry();aimGeo.setAttribute('position',new THREE.BufferAttribute(aimPositions,3).setUsage(THREE.DynamicDrawUsage));
const aimDots=new THREE.Points(aimGeo,new THREE.PointsMaterial({color:'#fffad4',size:.13,transparent:true,opacity:.85,depthTest:false,depthWrite:false}));
aimDots.frustumCulled=false;scene.add(aimDots);
const reticle=new THREE.Group();
for(const [r,opacity] of [[.43,.95],[.66,.32]]){
  const m=new THREE.Mesh(new THREE.TorusGeometry(r,.026,7,40),new THREE.MeshBasicMaterial({color:'#fff6a7',transparent:true,opacity,depthTest:false}));reticle.add(m);
}
const cross=new THREE.Mesh(new THREE.SphereGeometry(.085,10,8),new THREE.MeshBasicMaterial({color:'#ffffff',depthTest:false}));reticle.add(cross);scene.add(reticle);

const STORAGE_KEY='cannon-crash-3d-progress-v1';
let saved={unlocked:1,coins:0,current:0};
try{saved={...saved,...JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')};}catch{}
const save=()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(saved));}catch{}};
const LEARNING_KEY='cannon-crash-golingo-content-v1';
const PREFS_KEY='cannon-crash-golingo-prefs-v1';
const storageRead=key=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}};
const storageWrite=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
let learningData=initialGameData(window.location.search,storageRead(LEARNING_KEY),window.location.hash);
let learningPrefs={showWords:true,showTranslation:true,showFocus:true,autoSpeak:true,repeat:true,...storageRead(PREFS_KEY)};
let collected=[];
let activeTarget=null,lastCollected=null,panelReturnMode='menu';
const raycaster=new THREE.Raycaster(),pointerNdc=new THREE.Vector2();
guide.configure({enabled:learningPrefs.autoSpeak,repeat:learningPrefs.repeat,language:learningData.learningLanguage});
storageWrite(LEARNING_KEY,learningData);
let levelIndex=Math.max(0,Math.min(TOTAL_LEVELS-1,saved.current||0));
let stage=null,mode='menu',shotsUsed=0,score=0,earned=0,kos=0,streak=0,lastKo=-999;
let activeBurst=null,transitionStarted=0,comboTimeout=null;
let aimX=0,aimLift=.2,lastShotDirection=null,shake=0,clock=new THREE.Clock();
let pointer=null,aimTouched=false,muted=false,audioCtx=null,fireLock=false,holdFire=false,heldFirePointer=null;

function refreshLearningHud(){
  const word=activeTarget?.lesson;
  $('focusWord').textContent=word?.word||'✓';
  $('focusTranslation').textContent=learningPrefs.showTranslation?(word?.translation||''):'';
  $('languagePair').textContent=`${learningData.primaryLanguage.toUpperCase()} → ${learningData.learningLanguage.toUpperCase()}`;
  $('learningStrip').classList.toggle('focus-minimized',!learningPrefs.showFocus);
  $('labelsBtn').classList.toggle('active',learningPrefs.showWords);
  $('labelsBtn').setAttribute('aria-pressed',String(learningPrefs.showWords));
  $('voiceBtn').classList.toggle('active',learningPrefs.autoSpeak&&learningPrefs.repeat);
  $('voiceBtn').setAttribute('aria-pressed',String(learningPrefs.autoSpeak&&learningPrefs.repeat));
  $('voiceBtn').textContent=learningPrefs.autoSpeak?'🔊':'🔇';
  $('basketBadge').textContent=String(collected.length);
}

function selectFocus(target=stage?.targets.find(t=>!t.removed)){
  activeTarget=target||null;
  refreshLearningHud();
  if(stage)refreshTargetLabels(stage.targets,learningPrefs,activeTarget);
  guide.setCurrent(activeTarget?.lesson||null);
}

function assignLessons(){
  if(!stage)return;
  releaseTargetLabels(stage.targets);
  const deck=makeLessonDeck(learningData,stage.targets.length);
  stage.targets.forEach((target,i)=>{
    target.lesson=deck[i];target.mesh.userData.target=target;
    target.wordSprite=null;
  });
  guide.configure({enabled:learningPrefs.autoSpeak,repeat:learningPrefs.repeat,language:learningData.learningLanguage});
  selectFocus();
}

function applyLearningData(data){
  const next=normalizeGameData(data);
  if(!next)return false;
  guide.pause();learningData=next;collected=[];lastCollected=null;
  storageWrite(LEARNING_KEY,learningData);
  assignLessons();refreshLearningHud();
  return true;
}

function addWordToBasket(lesson){
  if(!lesson)return;
  const key=`${lesson.id}|${lesson.word}`;
  if(!collected.some(w=>`${w.id}|${w.word}`===key))collected.push({...lesson});
  lastCollected=lesson;
  refreshLearningHud();
}

function collectVocabulary(target){
  const lesson=target.lesson;if(!lesson)return;
  addWordToBasket(lesson);
  const correct=target===activeTarget;
  if(correct){
    score+=25;saved.coins+=3;earned+=3;
    effects.popup(target.body.position,'WORD BONUS +25','#b5ffad');
  }
  if(correct||!activeTarget||activeTarget.removed){
    selectFocus(stage.targets.find(t=>!t.removed&&t!==target));
  }else refreshLearningHud();
  guide.pronounceOnce(lesson,true);
}

function persist(){saved.current=levelIndex;save();}
function initAudio(){try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();}catch{}}
function sound(type){
  if(!audioCtx||muted)return;
  try{
    const now=audioCtx.currentTime,osc=audioCtx.createOscillator(),gain=audioCtx.createGain();
    osc.type=type==='fire'?'sawtooth':type==='win'?'sine':'triangle';
    const f=type==='fire'?118:type==='win'?570:240+Math.random()*180;
    osc.frequency.setValueAtTime(f,now);osc.frequency.exponentialRampToValueAtTime(type==='fire'?52:type==='win'?1050:f*.6,now+.17);
    gain.gain.setValueAtTime(type==='fire'?.12:.047,now);gain.gain.exponentialRampToValueAtTime(.0005,now+.22);
    osc.connect(gain);gain.connect(audioCtx.destination);osc.start(now);osc.stop(now+.23);
  }catch{}
}

function onTargetImpact(target,position,other){
  if(mode!=='playing'&&mode!=='transition')return;
  const p=new THREE.Vector3(position.x,position.y,position.z);
  const col=stage.theme.id==='neon'?'#64fff1':stage.theme.id==='ice'?'#e4ffff':'#ffe19a';
  effects.emit(p,8,col,3.4);shake=Math.min(.25,shake+.04);sound('hit');
  const now=performance.now()/1000;
  if(other.isProjectile&&now-(target.lastWordSpoken||0)>2.2){
    target.lastWordSpoken=now;
    guide.pronounceOnce(target.lesson,true);
  }
}

function loadLevel(index){
  guide.pause();
  holdFire=false;heldFirePointer=null;
  if(stage){releaseTargetLabels(stage.targets);stage.dispose();}
  for(const ball of balls){physics.removeBody(ball.body);scene.remove(ball.mesh);}
  balls.length=0;effects.clear();
  levelIndex=index;const level=LEVELS[index];
  stage=createStage(scene,physics,level,index,onTargetImpact);
  scene.background=new THREE.Color(THEMES[level.theme].sky);
  sunlight.color.set(level.theme===1?'#dbccff':level.theme===2?'#e3faff':'#ffe2b5');
  sunlight.intensity=level.theme===1?2.1:3.1;
  app.dataset.theme=stage.theme.id;
  $('worldLabel').textContent=stage.theme.name;$('levelLabel').textContent=`LEVEL ${String(index+1).padStart(2,'0')}`;
  shotsUsed=0;score=0;earned=0;kos=0;streak=0;lastKo=-999;
  aimX=0;aimLift=.2;aimTouched=false;activeBurst=null;fireLock=false;shake=0;
  $('aimHint').style.opacity='';app.classList.remove('no-aim');
  persist();assignLessons();updateHud();updateAim();
}

function updateHud(){
  const total=LEVELS[levelIndex].targets.length;
  const left=Math.max(0,total-kos);
  $('shotsCount').textContent='∞';
  $('targetCount').textContent=`${left} TARGET${left===1?'':'S'} LEFT`;
  const percent=Math.round(kos/total*100);
  $('progressPercent').textContent=`${percent}%`;
  $('progressFill').style.width=`${percent}%`;
  $('coinCount').textContent=String(saved.coins).replace(/\B(?=(\d{3})+(?!\d))/g,',');
  // Keep the button enabled during a volley so mobile pointer capture and
  // press-and-hold autofire continue working. fire() handles the cooldown.
  fireBtn.disabled=mode!=='playing';
}

function getAimTarget(){
  const y=2.68+aimLift;
  // Dragging upward gradually moves the aim depth to the rear, taller shelves.
  // A smooth interpolation avoids a sudden jump in the trajectory preview.
  const anchors=[{y:2.68,z:PLATFORM.z+.22},...(stage?.platforms||[]).slice(1).map(p=>({y:p.y+.48,z:p.z}))]
    .sort((a,b)=>a.y-b.y);
  let z=anchors[0].z;
  for(let i=1;i<anchors.length;i++){
    const a=anchors[i-1],b=anchors[i];
    z=THREE.MathUtils.lerp(a.z,b.z,THREE.MathUtils.clamp((y-a.y)/(b.y-a.y),0,1));
    if(y<=b.y)break;
  }
  return new THREE.Vector3(aimX,y,z);
}
function calculateShot(){
  const target=getAimTarget(),flight=.94;
  let start=new THREE.Vector3();
  const grav=Math.abs(physics.gravity.y);
  let velocity=new THREE.Vector3();
  for(let iteration=0;iteration<3;iteration++){
    cannon.muzzlePoint.updateWorldMatrix(true,false);cannon.muzzlePoint.getWorldPosition(start);
    velocity.copy(target).sub(start).divideScalar(flight);
    velocity.y+=.5*grav*flight;
    const yaw=-Math.atan2(velocity.x,-velocity.z);
    const pitch=Math.atan2(velocity.y,Math.hypot(velocity.x,velocity.z));
    cannon.aim(yaw,pitch);
  }
  cannon.muzzlePoint.updateWorldMatrix(true,false);cannon.muzzlePoint.getWorldPosition(start);
  velocity.copy(target).sub(start).divideScalar(flight);velocity.y+=.5*grav*flight;
  return {start:start.clone(),velocity,target,flight};
}
function updateAim(){
  const {start,velocity,target}=calculateShot();
  for(let i=0;i<=30;i++){
    const t=i/30*1.12,ix=i*3;
    aimPositions[ix]=start.x+velocity.x*t;
    aimPositions[ix+1]=start.y+velocity.y*t+physics.gravity.y*t*t*.5;
    aimPositions[ix+2]=start.z+velocity.z*t;
  }
  aimGeo.attributes.position.needsUpdate=true;
  reticle.position.copy(target);reticle.quaternion.copy(camera.quaternion);
}

function spawnBall(shot,i){
  if(balls.length>=MAX_ACTIVE_BALLS){
    const oldest=balls.shift();physics.removeBody(oldest.body);scene.remove(oldest.mesh);
  }
  const body=new CANNON.Body({mass:BALL_MASS,shape:new CANNON.Sphere(BALL_RADIUS),material:ballMat,linearDamping:.005,angularDamping:.02,collisionResponse:true});
  body.isProjectile=true;
  const spread=(i%5-2)*.095;
  const start=shot.start.clone();start.x+=(Math.random()-.5)*.06;
  body.position.set(start.x,start.y,start.z);
  const v=shot.velocity.clone();v.x+=spread+(Math.random()-.5)*.055;v.y+=(Math.random()-.5)*.14;
  body.velocity.set(v.x,v.y,v.z);body.angularVelocity.set(Math.random()*2,Math.random()*2,Math.random()*2);
  physics.addBody(body);
  const mesh=new THREE.Mesh(ballGeometry,ballMaterial);scene.add(mesh);mesh.position.copy(start);
  balls.push({body,mesh,born:performance.now()/1000});
  if(i%3===0){cannon.flash(.95);effects.emit(start,5,'#ffe6a0',2.5);}
}

function fire(){
  if(mode!=='playing'||fireLock)return;
  initAudio();sound('fire');
  shotsUsed++;fireLock=true;fireBtn.classList.add('firing');
  setTimeout(()=>fireBtn.classList.remove('firing'),230);
  const shot=calculateShot();activeBurst={shot,emitted:0,next:performance.now()/1000,interval:.053,count:BALLS_PER_SALVO};
  app.classList.add('no-aim');aimTouched=true;updateHud();
}

function removeTarget(target){
  target.removed=true;physics.removeBody(target.body);target.mesh.visible=false;
  kos++;
  const now=performance.now()/1000;
  streak=now-lastKo<1.85?streak+1:1;lastKo=now;
  const points=10*Math.min(4,streak),coins=2+Math.min(5,streak);
  score+=points;earned+=coins;saved.coins+=coins;save();
  const pos=new THREE.Vector3(target.body.position.x,target.body.position.y,target.body.position.z);
  effects.emit(pos,25,stage.theme.id==='neon'?'#55f9ff':stage.theme.id==='ice'?'#d9fdff':'#ffd78a',5.4);
  effects.impactBurst(pos,streak>2?'CRASH!':'BAM!',stage.theme.id==='neon'?'#ff75e5':'#ffc44c');
  effects.popup(pos,`+${points}`);
  shake=Math.min(.42,shake+.12);
  sound('hit');
  if(streak>=2){
    const label=streak>=9?'ULTRA!':streak>=7?'MEGA!':streak>=5?'SUPER!':streak>=3?'TRIPLE!':'DOUBLE!';
    showCombo(label);
    if(streak%3===0)effects.emit(pos,32,'#fff596',8,true);
  }
  collectVocabulary(target);
  updateHud();
  if(kos===LEVELS[levelIndex].targets.length)startClear();
}

function showCombo(text){
  comboText.textContent=text;comboText.classList.remove('visible');
  void comboText.offsetWidth;comboText.classList.add('visible');
  clearTimeout(comboTimeout);comboTimeout=setTimeout(()=>comboText.classList.remove('visible'),850);
}

function startClear(){
  if(mode!=='playing')return;
  mode='transition';transitionStarted=performance.now()/1000;
  holdFire=false;heldFirePointer=null;
  fireBtn.disabled=true;showCombo(starsForLevel()===3?'PERFECT!':'LEVEL CLEAR!');
  effects.confetti(new THREE.Vector3(0,7,PLATFORM.z));
  effects.confetti(new THREE.Vector3(-2,7,-3));
  sound('win');
  guide.saySentence(lastCollected?.sentence||lastCollected?.word);
  if(saved.unlocked<Math.min(TOTAL_LEVELS,levelIndex+2))saved.unlocked=Math.min(TOTAL_LEVELS,levelIndex+2);
  save();
}

function updateBodies(dt,time){
  if(activeBurst){
    while(activeBurst&&time>=activeBurst.next&&activeBurst.emitted<activeBurst.count){
      spawnBall(activeBurst.shot,activeBurst.emitted++);
      activeBurst.next+=activeBurst.interval;
    }
    if(activeBurst&&activeBurst.emitted>=activeBurst.count){activeBurst=null;setTimeout(()=>{fireLock=false;updateHud();},230);}
  }
  for(let i=balls.length-1;i>=0;i--){
    const b=balls[i];b.mesh.position.copy(b.body.position);b.mesh.quaternion.copy(b.body.quaternion);
    if(b.body.position.y<-11||time-b.born>BALL_LIFETIME){physics.removeBody(b.body);scene.remove(b.mesh);balls.splice(i,1);}
  }
  if(!stage)return;
  for(const target of stage.targets){
    if(target.removed)continue;
    const b=target.body,m=target.mesh;
    m.position.copy(b.position);m.quaternion.copy(b.quaternion);
    const p=b.position;
    const shelf=target.shelf;
    const outOfBounds=Math.abs(p.x-shelf.x)>shelf.width/2+.55||Math.abs(p.z-shelf.z)>shelf.depth/2+.65;
    if(mode==='playing'&&(p.y<shelf.y-.85||(outOfBounds&&p.y<shelf.y+1.15)))removeTarget(target);
  }
}

function starsForLevel(){
  // Par shots affect only the optional star rating, never the ability to win.
  const par=LEVELS[levelIndex].shots;
  if(shotsUsed<=Math.ceil(par/2))return 3;
  if(shotsUsed<=par)return 2;
  return 1;
}
function openOverlay(html){overlayContent.innerHTML=html;overlay.classList.remove('hidden');}
function closeOverlay(){overlay.classList.add('hidden');}
const levelWorld=()=>THEMES[LEVELS[levelIndex].theme].name;

function openLearningPanel(kind){
  if(mode!=='settings'&&mode!=='basket')panelReturnMode=mode;
  holdFire=false;heldFirePointer=null;
  guide.pause();mode=kind;hud.classList.add('hidden');
  if(kind==='basket'){showBasket();return;}
  const languageOptions=selected=>LANGUAGES.map(l=>`<option value="${l.code}" ${l.code===selected?'selected':''}>${escapeHtml(l.name)}</option>`).join('');
  openOverlay(`<div class="overlay-card"><span class="world-pill">GOLINGO LEARNING STUDIO</span><h2>LEARN & PLAY</h2><p>${learningData.words.length} words/phrases loaded · ${escapeHtml(languageName(learningData.learningLanguage))}</p>
    <div class="language-panel"><div class="language-row">
      <div><label for="primaryLang">BASE LANGUAGE</label><select id="primaryLang">${languageOptions(learningData.primaryLanguage)}</select></div>
      <div><label for="learningLang">LEARNING LANGUAGE</label><select id="learningLang">${languageOptions(learningData.learningLanguage)}</select></div>
    </div><div class="toggle-list">
      <label><input id="prefWords" type="checkbox" ${learningPrefs.showWords?'checked':''}> Show target words</label>
      <label><input id="prefTranslation" type="checkbox" ${learningPrefs.showTranslation?'checked':''}> Show translations</label>
      <label><input id="prefFocus" type="checkbox" ${learningPrefs.showFocus?'checked':''}> Show word strip</label>
      <label><input id="prefSpeak" type="checkbox" ${learningPrefs.autoSpeak?'checked':''}> Pronunciation</label>
      <label><input id="prefRepeat" type="checkbox" ${learningPrefs.repeat?'checked':''}> Repeat until next word</label>
    </div><label for="jsonInput">PASTE GOLINGO WORD OR SENTENCE JSON (OPTIONAL)</label><textarea id="jsonInput" spellcheck="false" placeholder='{"primaryLanguage":"en","learningLanguage":"ja","words":[{"id":"101","word":"水","translation":"water"}]}'></textarea>
    <p class="footnote">Changing languages changes the pronunciation voice. Import matching content to change the words themselves.</p>
    <div id="panelMessage" class="panel-message" aria-live="polite"></div>
    </div><button class="big-cta" data-action="applyLearn">✓ APPLY SETTINGS</button>
    <div class="panel-button-row"><button class="secondary-cta" data-action="demoLearn">USE DEMO WORDS</button><button class="secondary-cta" data-action="closePanel">BACK</button></div></div>`);
}

function showBasket(){
  const entries=collected.length?collected.map((entry,i)=>`<div class="basket-entry"><div><strong>${escapeHtml(entry.word)}</strong><small>${escapeHtml(entry.translation||entry.sentenceTranslation)}</small></div><button data-action="speakEntry" data-index="${i}" aria-label="Speak ${escapeHtml(entry.word)}">🔊</button></div>`).join(''):'<p>No words collected yet. Knock targets off the platform to fill your vocabulary basket.</p>';
  openOverlay(`<div class="overlay-card"><span class="world-pill">GOLINGO VOCABULARY</span><h2>WORD BASKET</h2><p>${collected.length} unique word${collected.length===1?'':'s'} collected · ${escapeHtml(learningData.learningLanguage.toUpperCase())}</p>
    <div class="basket-list">${entries}</div><button class="big-cta" data-action="exportBasket" ${!collected.length?'disabled':''}>↓ EXPORT GOLINGO JSON</button>
    <div class="panel-button-row"><button class="secondary-cta" data-action="sendGoLingo" ${!collected.length?'disabled':''}>SEND TO GOLINGO</button><button class="secondary-cta" data-action="clearBasket" ${!collected.length?'disabled':''}>CLEAR LIST</button><button class="secondary-cta" data-action="closePanel">BACK</button></div>
    <div id="panelMessage" class="panel-message" aria-live="polite"></div></div>`);
}

function returnFromPanel(){
  if(panelReturnMode==='playing'){startPlay();return;}
  if(panelReturnMode==='pause'){mode='playing';pauseGame();return;}
  if(panelReturnMode==='clear'){showClear();return;}
  showMenu();
}

function applyPanelSettings(){
  const raw=$('jsonInput')?.value.trim()||'';
  const parsed=raw?normalizeGameData(raw):{...learningData};
  if(!parsed){$('panelMessage').textContent='That JSON has no valid words or sentences. Please check the format.';return;}
  // Imported GoLingo JSON owns its language pair. Selectors only retag existing content.
  const next=raw?parsed:{...parsed,primaryLanguage:$('primaryLang').value,learningLanguage:$('learningLang').value};
  learningPrefs={
    showWords:$('prefWords').checked,
    showTranslation:$('prefTranslation').checked,
    showFocus:$('prefFocus').checked,
    autoSpeak:$('prefSpeak').checked,
    repeat:$('prefRepeat').checked
  };
  storageWrite(PREFS_KEY,learningPrefs);
  if(raw)applyLearningData(next);
  else{
    learningData=next;storageWrite(LEARNING_KEY,learningData);
    guide.configure({enabled:learningPrefs.autoSpeak,repeat:learningPrefs.repeat,language:learningData.learningLanguage});
    refreshTargetLabels(stage.targets,learningPrefs,activeTarget);refreshLearningHud();
  }
  returnFromPanel();
}

function basketPayload(){return exportBasket(learningData,collected);}
function downloadBasket(){
  const json=JSON.stringify(basketPayload(),null,2),blob=new Blob([json],{type:'application/json'}),url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');anchor.href=url;anchor.download='golingo-cannon-crash-words.json';document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
  if($('panelMessage'))$('panelMessage').textContent='Export created. Import this JSON into GoLingo.';
}
async function sendBasketToGoLingo(){
  const payload=basketPayload();
  const bridge=window.webkit?.messageHandlers?.golingo||window.webkit?.messageHandlers?.GoLingo;
  if(bridge?.postMessage){
    bridge.postMessage({type:'golingo:importWords',payload});
    $('panelMessage').textContent='Sent the word basket to the GoLingo app.';
    return;
  }
  try{
    await navigator.clipboard.writeText(JSON.stringify(payload,null,2));
    $('panelMessage').textContent='JSON copied. Paste it into GoLingo.';
  }catch{
    $('panelMessage').textContent='Use Export GoLingo JSON to save the word list.';
  }
}

function showMenu(){
  guide.pause();mode='menu';hud.classList.add('hidden');
  const levelSelect=saved.unlocked>1?`<div class="overlay-card"><span class="world-pill">LEVEL SELECT</span><div class="level-grid">${LEVELS.map((lev,i)=>`<button class="level-dot ${i===levelIndex?'current':''}" data-action="select" data-level="${i}" ${i>=saved.unlocked?'disabled':''} aria-label="Level ${i+1}${i>=saved.unlocked?', locked':''}">${i>=saved.unlocked?'🔒':i+1}</button>`).join('')}</div></div>`:'';
  openOverlay(`<p class="eyebrow">GOLINGO · LEARNING LANGUAGES THROUGH GAMES</p><div class="game-logo">CANNON<em>CRASH!</em></div><p class="tagline">LISTEN. AIM. FIRE. LEARN.</p><button class="big-cta" data-action="play">▶ &nbsp; PLAY LEVEL ${levelIndex+1}</button><div class="tutorial-chips"><span>🔊 TAP TARGET TO AIM & HEAR</span><span>↔ DRAG TO FINE-TUNE</span><span>∞ HOLD FIRE FOR UNLIMITED SHOTS</span></div><button class="secondary-cta" data-action="learn">⚙ LANGUAGES & WORDS (${learningData.words.length})</button>${levelSelect}<p class="footnote">10 LEVELS · 3 WORLDS · REAL PHYSICS · NO AMMO LIMIT</p><a class="golingo-brand" href="https://www.golingoapp.com" target="_blank" rel="noopener noreferrer">GoLingoApp.com</a>`);
}
function startPlay(){
  initAudio();mode='playing';hud.classList.remove('hidden');closeOverlay();
  // Resuming mid-volley should never overwrite cannonballs still being fired.
  fireLock=!!activeBurst;updateAim();updateHud();guide.resume();
}
function pauseGame(){
  if(mode!=='playing')return;
  holdFire=false;heldFirePointer=null;
  guide.pause();mode='pause';hud.classList.add('hidden');
  openOverlay(`<div class="overlay-card"><span class="world-pill">${levelWorld()} · LEVEL ${levelIndex+1}</span><h2 class="pause-title">PAUSED</h2><p>Take a breath. Your targets aren't going anywhere.</p><button class="big-cta" data-action="resume">▶ &nbsp; RESUME</button><button class="secondary-cta" data-action="learn">LANGUAGE SETTINGS</button><button class="secondary-cta" data-action="basket">WORD BASKET (${collected.length})</button><button class="secondary-cta" data-action="restart">↻ RESTART LEVEL</button><button class="secondary-cta" data-action="menu">LEVEL SELECT</button><button class="secondary-cta" data-action="sound">SOUND EFFECTS ${muted?'OFF':'ON'}</button></div>`);
}
function showClear(){
  mode='clear';hud.classList.add('hidden');
  const stars=starsForLevel();const last=levelIndex===TOTAL_LEVELS-1;
  openOverlay(`<p class="eyebrow">${levelWorld()}</p><div class="overlay-card"><span class="world-pill">LEVEL ${levelIndex+1} COMPLETE</span><h2>${last?'CHAMPION!':'LEVEL CLEAR!'}</h2><div class="stars">${[1,2,3].map(i=>`<span class="star ${i<=stars?'earned':''}">★</span>`).join('')}</div><div class="reward-pill"><span class="coin-icon">★</span> +${earned} COINS</div><div class="result-row"><div class="result-cell"><span class="tiny-label">SCORE</span><strong>${score}</strong></div><div class="result-cell"><span class="tiny-label">SALVOS USED</span><strong>${shotsUsed}</strong></div><div class="result-cell"><span class="tiny-label">WORDS SAVED</span><strong>${collected.length}</strong></div></div><p>${last?'You conquered all three worlds! Go for a cleaner sweep.':'Beautiful destruction! You also practiced new vocabulary.'}</p><button class="big-cta" data-action="next">${last?'↻ PLAY AGAIN':'CONTINUE →'}</button><button class="secondary-cta" data-action="basket">VIEW / EXPORT WORDS</button><button class="secondary-cta" data-action="retry">REPLAY LEVEL</button></div>`);
}

// Overlay uses a single delegated handler so dynamically created buttons work.
overlay.addEventListener('click',e=>{
  const button=e.target.closest('button[data-action]');if(!button)return;
  const action=button.dataset.action;
  if(action==='learn'){openLearningPanel('settings');return;}
  if(action==='basket'){openLearningPanel('basket');return;}
  if(action==='closePanel'){returnFromPanel();return;}
  if(action==='applyLearn'){applyPanelSettings();return;}
  if(action==='demoLearn'){applyLearningData(DEMO_DATA);returnFromPanel();return;}
  if(action==='exportBasket'){downloadBasket();return;}
  if(action==='sendGoLingo'){sendBasketToGoLingo();return;}
  if(action==='clearBasket'){collected=[];refreshLearningHud();showBasket();return;}
  if(action==='speakEntry'){
    const word=collected[Number(button.dataset.index)];if(word){initAudio();guide.pronounceOnce(word,false,true);}return;
  }
  if(action==='play'||action==='resume'){startPlay();return;}
  if(action==='select'){
    const next=Number(button.dataset.level);if(Number.isInteger(next)&&next<saved.unlocked){loadLevel(next);showMenu();}return;
  }
  if(action==='next'){
    const next=levelIndex===TOTAL_LEVELS-1?0:levelIndex+1;loadLevel(next);startPlay();return;
  }
  if(action==='restart'||action==='retry'){loadLevel(levelIndex);startPlay();return;}
  if(action==='menu'){loadLevel(levelIndex);showMenu();return;}
  if(action==='sound'){muted=!muted;pauseGame();
    overlayContent.querySelector('[data-action="sound"]').textContent=`SOUND EFFECTS ${muted?'OFF':'ON'}`;
  }
});

pauseBtn.addEventListener('click',pauseGame);
// Press and hold for repeated 19-ball salvos. Unlike a disabled button, a
// captured pointer stays active across volleys on iOS/Android.
fireBtn.addEventListener('pointerdown',e=>{
  if(!e.isPrimary||mode!=='playing')return;
  holdFire=true;heldFirePointer=e.pointerId;
  fireBtn.setPointerCapture?.(e.pointerId);
  fire();e.preventDefault();
});
function stopHoldingFire(e){
  if(e?.pointerId!==undefined&&heldFirePointer!==e.pointerId)return;
  holdFire=false;heldFirePointer=null;
}
fireBtn.addEventListener('pointerup',stopHoldingFire);
fireBtn.addEventListener('pointercancel',stopHoldingFire);
fireBtn.addEventListener('lostpointercapture',stopHoldingFire);
window.addEventListener('blur',()=>stopHoldingFire());
// detail=0 covers keyboard/switch-control activation, but pointer clicks were
// already handled on pointerdown and must not cause an extra shot on release.
fireBtn.addEventListener('click',e=>{if(e.detail===0)fire();});
$('labelsBtn').addEventListener('click',()=>{
  learningPrefs.showWords=!learningPrefs.showWords;
  storageWrite(PREFS_KEY,learningPrefs);
  refreshTargetLabels(stage.targets,learningPrefs,activeTarget);refreshLearningHud();
});
$('voiceBtn').addEventListener('click',()=>{
  learningPrefs.autoSpeak=!learningPrefs.autoSpeak;
  storageWrite(PREFS_KEY,learningPrefs);
  guide.configure({enabled:learningPrefs.autoSpeak,repeat:learningPrefs.repeat,language:learningData.learningLanguage});
  if(mode==='playing'&&learningPrefs.autoSpeak)guide.resume();
  refreshLearningHud();
});
$('focusBtn').addEventListener('click',()=>{
  if(!learningPrefs.showFocus){learningPrefs.showFocus=true;storageWrite(PREFS_KEY,learningPrefs);refreshLearningHud();return;}
  initAudio();guide.pronounceOnce(activeTarget?.lesson,true,true);
});
$('basketBtn').addEventListener('click',()=>openLearningPanel('basket'));
$('learningBtn').addEventListener('click',()=>openLearningPanel('settings'));

// GoLingo hub / Swift WKWebView can inject the normal portable JSON payload.
// This only changes in-memory game content; no remote service is contacted.
function receiveGoLingoData(payload){
  const wasPlaying=mode==='playing';
  const accepted=applyLearningData(payload);
  if(accepted&&wasPlaying)guide.resume();
  return accepted;
}
window.GoLingoGame={
  loadData:receiveGoLingoData,
  setData:receiveGoLingoData,
  getData:()=>structuredClone(learningData),
  getBasket:()=>basketPayload(),
  speak:()=>guide.pronounceOnce(activeTarget?.lesson,false,true)
};
window.receiveGoLingoData=receiveGoLingoData;
window.addEventListener('message',event=>{
  if(event.source!==window.parent&&event.source!==window)return;
  const data=event.data;
  if(data?.type==='golingo:requestBasket'){
    event.source?.postMessage({type:'golingo:basket',payload:basketPayload()},event.origin==='null'?'*':event.origin);
    return;
  }
  if(data?.type==='golingo:basket'||data?.type==='golingo:wordCollected')return;
  if(normalizeGameData(data))receiveGoLingoData(data);
});

// Dragging the 3D canvas only changes aim. It never opens or pauses an overlay.
renderer.domElement.addEventListener('pointerdown',e=>{
  if(mode!=='playing'||pointer)return;
  pointer={id:e.pointerId,x:e.clientX,y:e.clientY,aimX,aimLift,dragged:false};
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove',e=>{
  if(!pointer||e.pointerId!==pointer.id||mode!=='playing')return;
  const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
  if(Math.hypot(dx,dy)>11)pointer.dragged=true;
  aimX=THREE.MathUtils.clamp(pointer.aimX+dx*Math.max(.009,7/window.innerWidth),-3.35,3.35);
  aimLift=THREE.MathUtils.clamp(pointer.aimLift-dy*Math.max(.009,6/window.innerHeight),-.5,4.2);
  updateAim();app.classList.add('no-aim');aimTouched=true;
});
const endPointer=e=>{
  if(!pointer||e.pointerId!==pointer.id)return;
  const wasTap=!pointer.dragged&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)<12;
  pointer=null;
  if(wasTap&&mode==='playing'){
    pointerNdc.set(e.clientX/window.innerWidth*2-1,-e.clientY/window.innerHeight*2+1);
    raycaster.setFromCamera(pointerNdc,camera);
    const hit=raycaster.intersectObjects(stage.targets.filter(t=>!t.removed).map(t=>t.mesh),true)[0];
    let mesh=hit?.object;
    while(mesh&&!mesh.userData?.target)mesh=mesh.parent;
    if(mesh?.userData?.target){
      selectFocus(mesh.userData.target);
      addWordToBasket(activeTarget.lesson);
      initAudio();guide.pronounceOnce(activeTarget.lesson,true,true);
      // Optional tap assist: line up the selected word without opening a
      // panel. The player can still drag to fine-tune before firing.
      aimX=THREE.MathUtils.clamp(activeTarget.body.position.x,-3.35,3.35);
      aimLift=THREE.MathUtils.clamp(activeTarget.body.position.y-2.68,-.5,4.2);
      updateAim();app.classList.add('no-aim');
    }
  }
};
renderer.domElement.addEventListener('pointerup',endPointer);
renderer.domElement.addEventListener('pointercancel',endPointer);
window.addEventListener('keydown',e=>{
  if(e.code==='Escape'){if(mode==='playing')pauseGame();else if(mode==='pause')startPlay();return;}
  if(e.code==='Space'){e.preventDefault();fire();return;}
  if(mode!=='playing')return;
  const step=e.shiftKey?.38:.23;
  if(e.key==='ArrowLeft'||e.key==='a')aimX-=step;
  else if(e.key==='ArrowRight'||e.key==='d')aimX+=step;
  else if(e.key==='ArrowUp'||e.key==='w')aimLift+=step;
  else if(e.key==='ArrowDown'||e.key==='s')aimLift-=step;
  else return;
  e.preventDefault();aimX=THREE.MathUtils.clamp(aimX,-3.35,3.35);aimLift=THREE.MathUtils.clamp(aimLift,-.5,4.2);
  app.classList.add('no-aim');updateAim();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')pauseGame();});
function resize(){
  const w=window.innerWidth,h=window.innerHeight;
  camera.aspect=w/h;
  // On narrow devices use a slightly wider vertical field so cannon and targets fit together.
  camera.fov=w/h<.57?49:44;
  camera.updateProjectionMatrix();renderer.setSize(w,h);renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));
  updateAim();
}
window.addEventListener('resize',resize);

function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(.04,clock.getDelta()),time=performance.now()/1000;
  if(mode!=='pause'&&mode!=='settings'&&mode!=='basket'&&mode!=='clear'){
    if(mode==='playing'&&holdFire&&!fireLock)fire();
    stage?.beforeStep(dt,time);
    physics.step(1/60,dt,3);
    stage?.update(dt);
    updateBodies(dt,time);
    effects.update(dt);
    cannon.tick(dt);
    if(mode==='transition'&&time-transitionStarted>1.45)showClear();
  }
  reticle.visible=aimDots.visible=mode==='playing'&&!activeBurst;
  reticle.rotation.z+=dt*.45;
  shake=Math.max(0,shake-dt*1.15);
  camera.position.copy(cameraHome);
  if(shake>.001){camera.position.x+=(Math.random()-.5)*shake;camera.position.y+=(Math.random()-.5)*shake;}
  camera.lookAt(lookAt);
  renderer.render(scene,camera);
}

loadLevel(levelIndex);resize();showMenu();animate();
