import * as THREE from './vendor/three.module.js';
import { createEnvironment } from './environment.js';
import { createDeer, createRifle } from './models.js';
import { HuntAudio } from './audio.js';
import { PinefallLearning } from './learning.js';
import { LearningUI } from './learning-ui.js';

const $ = id => document.getElementById(id);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const mix = (a,b,t) => a+(b-a)*t;
const angleDiff = (a,b) => Math.atan2(Math.sin(a-b),Math.cos(a-b));
const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const settings = {sensitivity:1,volume:.65,assist:true,invert:false,graphics:'auto',muted:false};
try { Object.assign(settings,JSON.parse(localStorage.getItem('pinefall-settings')||'{}')); } catch {}
function saveSettings(){try{localStorage.setItem('pinefall-settings',JSON.stringify(settings));}catch{}}

const state = {phase:'intro',mode:'calm',scoped:false,zoom:4,crouched:false,steady:false,breath:1,
  ammo:5,reserve:30,reload:0,recoil:0,shots:0,hits:0,score:0,bestShot:0,elapsed:0,
  cooldown:0,freeRoam:false,toast:0,hint:0,tutorial:0,scan:0,step:0,move:0,alert:0,
  trackTurn:null,finishDelay:0,finishWait:0,autoQuality:1,shotFlash:0};
const keys = new Set();
const input = {x:0,y:0,lookPointer:null,joyPointer:null,lastX:0,lastY:0,startX:0,startY:0,dragged:false};
const player = {x:0,z:18,y:1.75,yaw:0,pitch:-.022,stance:1.75};
const animals = [];
const raycaster = new THREE.Raycaster();
const pointerZero = new THREE.Vector2(0,0);
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
let renderer,scene,camera,environment,rifle,audio,muzzleFlash,tracer,clock;
let learning,learningUI,learningModalWasPlaying=false,learningModalOpen=false;
let worldTime=0,previousTime=performance.now(),frameCounter=0,qualityElapsed=0,hudElapsed=0;
let returnFromSettings='intro';
const spawnPoints = [[0,-30],[-17,-45],[19,-52],[-8,-64],[30,-36],[9,-81],[-32,-70]];
const tracerMaterial=new THREE.LineBasicMaterial({color:0xe5c590,transparent:true,opacity:.6,depthWrite:false});

function init(){
  try {
    setupLearning();
    renderer=new THREE.WebGLRenderer({canvas:$('world'),antialias:true,alpha:false,powerPreference:'high-performance'});
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.0;
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    scene=new THREE.Scene();
    camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.04,1100);
    camera.rotation.order='YXZ';
    scene.add(camera);
    environment=createEnvironment(scene);
    if(touch)scene.traverse(object=>{if(object.isDirectionalLight&&object.shadow)object.shadow.mapSize.set(1024,1024);});
    rifle=createRifle();
    camera.add(rifle.group);
    rifle.group.visible=false;
    makeMuzzle();
    tracer=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),tracerMaterial);
    tracer.frustumCulled=false;tracer.visible=false;scene.add(tracer);
    audio=new HuntAudio();
    audio.setVolume(settings.volume);audio.setMuted(settings.muted);
    for(let i=0;i<spawnPoints.length;i++) addAnimal(i);
    assignLearningTargets();
    applySettings();resize();bindControls();
    $('start-label').textContent='BEGIN WORD HUNT';$('start').disabled=false;
    if(touch) $('start-hint').textContent='Left wheel to walk · drag the forest to look';
    else $('controls').classList.add('desktop');
    $('world').addEventListener('webglcontextlost',e=>{e.preventDefault();pauseGame();fatal('The 3D scene was interrupted. Tap Try again to reload the forest.');});
    renderer.compile(scene,camera);
    requestAnimationFrame(frame);
  } catch(error){console.error('Pinefall initialization:',error);fatal('This browser could not start the 3D forest. Try opening the game in an updated Safari, Chrome, or Edge browser.');}
}
function fatal(message){$('fatal-text').textContent=message;$('fatal').classList.remove('hidden');}
$('retry').addEventListener('click',()=>location.reload());

function setupLearning(){
  learning=new PinefallLearning({
    onChange:()=>{
      if(!learning)return;
      learningUI?.render();
      if(animals.length){
        assignLearningTargets();
        // A replacement lesson begins a new word trail without resetting the forest.
        if(state.hits>0&&learning.learnedCount===0&&state.mode==='calm'&&!state.freeRoam){Object.assign(state,{hits:0,shots:0,score:0,bestShot:0,finishDelay:0,finishWait:0});state.reserve=Math.max(state.reserve,learning.total*3);}
        updateHUD();
      }
      const count=learning.entries.length;
      $('mode-calm').querySelector('span').textContent=count+' words / phrases · your own pace';
    },
    onMessage:message=>{if(state.phase==='playing')hint(message,4);}
  });
  learningUI=new LearningUI(learning,{
    onOpen:()=>{
      if(!learningModalOpen){learningModalWasPlaying=state.phase==='playing';learningModalOpen=true;}
      if(state.phase==='playing')pauseGame();
      $('pause-screen').classList.add('hidden');
    },
    onClose:()=>{
      learningModalOpen=false;
      if(learningModalWasPlaying&&state.phase==='paused')resumeGame();
      else if(state.phase==='paused')$('pause-screen').classList.remove('hidden');
      learningModalWasPlaying=false;
    },
    onTrack:trackDeer
  });
  learningUI.setPlaying(false);
  $('mode-calm').querySelector('span').textContent=learning.entries.length+' words / phrases · your own pace';
}

function labelLines(ctx,text,maxWidth,maxLines=3){
  const tokens=/\s/.test(text)?text.split(/\s+/):Array.from(text);
  const joiner=/\s/.test(text)?' ':'';const lines=[];let line='';
  for(const token of tokens){const test=line?line+joiner+token:token;
    if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=token;}else line=test;
  }
  if(line)lines.push(line);
  if(lines.length>maxLines){lines.length=maxLines;let last=lines[maxLines-1];while(last&&ctx.measureText(last+'…').width>maxWidth)last=last.slice(0,-1);lines[maxLines-1]=last+'…';}
  return lines;
}
function updateAnimalLabel(a){
  if(!a.lessonEntry){if(a.wordLabel)a.wordLabel.visible=false;return;}
  const entry=a.lessonEntry;
  const showTranslation=learning.preferences.showTranslation;
  const signature=entry.key+'|'+entry.word+'|'+entry.translation+'|'+showTranslation;
  if(a.labelSignature!==signature){
    const c=document.createElement('canvas');c.width=768;c.height=256;const ctx=c.getContext('2d');
    ctx.fillStyle='rgba(19,42,29,.87)';ctx.beginPath();
    if(ctx.roundRect)ctx.roundRect(6,6,756,244,26);else ctx.rect(6,6,756,244);ctx.fill();
    ctx.strokeStyle='rgba(231,221,178,.78)';ctx.lineWidth=3;ctx.stroke();
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f7edce';
    ctx.direction=/^(ar|fa|he|ur)(-|$)/i.test(learning.lesson.learningLanguage)?'rtl':'ltr';
    const text=entry.word||'';ctx.font='500 '+(text.length>48?35:46)+'px system-ui, sans-serif';
    const lines=labelLines(ctx,text,702,3);const spacing=text.length>48?40:50;
    const y=(showTranslation&&entry.translation?98:128)-(lines.length-1)*spacing/2;
    lines.forEach((line,i)=>ctx.fillText(line,384,y+i*spacing));
    if(showTranslation&&entry.translation){ctx.direction=/^(ar|fa|he|ur)(-|$)/i.test(learning.lesson.primaryLanguage)?'rtl':'ltr';ctx.font='29px system-ui, sans-serif';ctx.fillStyle='#d8c69b';let translation=entry.translation;while(translation.length&&ctx.measureText(translation).width>690)translation=translation.slice(0,-1);if(translation!==entry.translation)translation+='…';ctx.fillText(translation,384,211);}
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    if(!a.wordLabel){a.wordLabel=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,depthTest:true}));a.wordLabel.position.set(0,3.2,0);a.wordLabel.scale.set(6,2,1);a.group.add(a.wordLabel);}
    else{a.wordLabel.material.map?.dispose();a.wordLabel.material.map=texture;a.wordLabel.material.needsUpdate=true;}
    a.labelSignature=signature;
  }
  a.wordLabel.visible=a.alive&&!!learning.preferences.showLabels&&state.phase!=='intro';
}
function assignLearningTargets(){
  if(!learning||!animals.length)return;
  const choices=learning.candidates(animals.length);
  const alive=animals.filter(a=>a.alive).sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z));
  const current=learning.current;
  const distractors=choices.filter(entry=>entry.key!==current?.key);
  // Keep a word on the same deer until it is collected or the lesson changes.
  let target=alive.find(a=>a.lessonEntry?.key===current?.key);
  if(!target&&alive.length&&current){target=alive[0];target.lessonEntry=current;}
  let next=0;
  for(const a of alive){
    if(a!==target){const oldStillValid=distractors.some(entry=>entry.key===a.lessonEntry?.key);
      if(!oldStillValid||a.lessonEntry?.key===current?.key)a.lessonEntry=distractors[next++%Math.max(1,distractors.length)]||current;
    }
    updateAnimalLabel(a);
  }
  for(const a of animals)if(!a.alive&&a.wordLabel)a.wordLabel.visible=false;
}
function syncLearningAudio(){learning?.setVolume?.(settings.muted?0:settings.volume);learning?.setActive(state.phase==='playing'&&!settings.muted&&settings.volume>0);}

function makeMuzzle(){
  const c=document.createElement('canvas');c.width=c.height=64;
  const ctx=c.getContext('2d');const g=ctx.createRadialGradient(32,32,1,32,32,32);
  g.addColorStop(0,'rgba(255,251,213,1)');g.addColorStop(.22,'rgba(255,217,115,.9)');g.addColorStop(.55,'rgba(236,146,55,.3)');g.addColorStop(1,'rgba(236,146,55,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
  const t=new THREE.CanvasTexture(c);
  muzzleFlash=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
  muzzleFlash.scale.set(.24,.24,.24);muzzleFlash.visible=false;rifle.muzzle.add(muzzleFlash);
}

function addAnimal(i){
  const asset=createDeer({buck:i%3!==1,seed:i+1});
  const [x,z]=spawnPoints[i%spawnPoints.length];
  const a={...asset,id:i,x,z,homeX:x,homeZ:z,yaw:i===0?Math.PI*.45:Math.random()*Math.PI*2,
    targetX:x,targetZ:z,wait:6+i*1.2,alert:0,alive:true,fallTime:0,respawn:0,pace:0,grazing:i===0?0:.6,
    name:i%3!==1?'Mountain stag':'Forest doe'};
  a.group.position.set(x,environment.heightAt(x,z),z);a.group.rotation.y=a.yaw;
  a.hitMeshes.forEach(m=>m.userData.animal=a);
  scene.add(a.group);animals.push(a);
}
function resetAnimals(){
  for(const a of animals){
    const [x,z]=spawnPoints[a.id%spawnPoints.length];
    Object.assign(a,{x,z,homeX:x,homeZ:z,targetX:x,targetZ:z,wait:7+a.id*1.3,alert:0,alive:true,fallTime:0,respawn:0,pace:0,grazing:a.id===0?0:.6,yaw:a.id===0?Math.PI*.45:Math.random()*Math.PI*2});
    a.fall(0);a.group.position.set(x,environment.heightAt(x,z),z);a.group.rotation.y=a.yaw;
  }
}
function startGame(){
  audio?.unlock();
  state.phase='playing';
  Object.assign(state,{scoped:false,zoom:4,crouched:false,steady:false,breath:1,ammo:5,reserve:30,reload:0,recoil:0,shots:0,hits:0,score:0,bestShot:0,elapsed:0,cooldown:0,freeRoam:false,toast:0,hint:0,tutorial:16,finishDelay:0,finishWait:0,trackTurn:null});
  Object.assign(player,{x:0,z:18,y:environment.heightAt(0,18)+1.75,yaw:0,pitch:-.018,stance:1.75});
  resetInputs();resetAnimals();
  learning.begin();learning.unlock();assignLearningTargets();learningUI.setPlaying(true);syncLearningAudio();
  state.reserve=Math.max(30,learning.total*3);
  $('welcome').classList.add('hidden');$('masthead').classList.add('hidden');
  $('results').classList.add('hidden');$('pause-screen').classList.add('hidden');$('settings').classList.add('hidden');
  $('hud').classList.remove('hidden');$('controls').classList.remove('hidden');
  $('tutorial').classList.remove('hidden');$('shot-toast').classList.add('hidden');$('hint-toast').classList.add('hidden');
  $('reload-progress').classList.add('hidden');$('target-tag').classList.add('hidden');$('hit-marker').classList.remove('show');
  $('mission-label').textContent=state.mode==='timed'?'TIMED WORD TRAIL':'WORD HUNT';
  $('goal').textContent=state.mode==='timed'?'∞':learning.total;$('timer').classList.toggle('hidden',state.mode!=='timed');
  $('tutorial-text').textContent='Listen to your word. Find the deer carrying it, then scope and fire. Track guides you to the current word. Tap Hide to clear the word card.';
  rifle.group.visible=true;applyScope();updateHUD();
}
function pauseGame(){
  if(state.phase!=='playing')return;
  state.phase='paused';resetInputs();state.steady=false;
  $('pause-screen').classList.remove('hidden');$('controls').classList.add('hidden');
  if(document.pointerLockElement) document.exitPointerLock?.();
  audio?.setMuted(true);
  learning?.setActive(false);learningUI?.setPlaying(false);
}
function resumeGame(){
  state.phase='playing';$('pause-screen').classList.add('hidden');$('controls').classList.remove('hidden');
  audio?.setMuted(settings.muted);audio?.unlock();
  learningUI?.setPlaying(true);learning?.unlock();syncLearningAudio();
}
function returnToIntro(){
  state.phase='intro';resetInputs();state.scoped=false;state.steady=false;applyScope();
  $('pause-screen').classList.add('hidden');$('results').classList.add('hidden');$('hud').classList.add('hidden');$('controls').classList.add('hidden');
  $('welcome').classList.remove('hidden');$('masthead').classList.remove('hidden');
  rifle.group.visible=false;audio?.setMuted(settings.muted);resetAnimals();
  learning?.setActive(false);learningUI?.setPlaying(false);assignLearningTargets();
}
function openSettings(){
  returnFromSettings=state.phase;
  if(state.phase==='playing'){pauseGame();returnFromSettings='paused';}
  $('pause-screen').classList.add('hidden');$('settings').classList.remove('hidden');
}
function closeSettings(){
  $('settings').classList.add('hidden');
  if(returnFromSettings==='paused')$('pause-screen').classList.remove('hidden');
}
function finishHunt(){
  if(state.phase!=='playing')return;
  state.phase='complete';resetInputs();state.steady=false;
  learning?.setActive(false);learningUI?.setPlaying(false);
  if(document.pointerLockElement)document.exitPointerLock?.();
  $('controls').classList.add('hidden');$('results').classList.remove('hidden');
  $('result-eyebrow').textContent=state.mode==='timed'?'WORD TRAIL COMPLETE':'LESSON COMPLETE';
  $('result-title').innerHTML=state.hits>0?'A morning<br>well spent.':'The forest<br>has more to give.';
  $('result-score').textContent=state.score.toLocaleString();$('result-count').textContent=state.hits;
  $('result-accuracy').textContent=(state.shots?Math.round(state.hits/state.shots*100):0)+'%';
  let best=0;try{best=Number(localStorage.getItem('pinefall-word-best-'+state.mode))||0;if(state.score>best)localStorage.setItem('pinefall-word-best-'+state.mode,String(state.score));}catch{}
  $('result-best').textContent=(state.bestShot?'Longest shot: '+Math.round(state.bestShot)+' m':'Every expedition is a new beginning.')+(state.score>best?' · New personal best':'');
}
function continueRoam(){
  state.freeRoam=true;state.finishDelay=0;state.phase='playing';
  state.reserve=Math.max(state.reserve,30);state.ammo=Math.max(state.ammo,5);
  $('results').classList.add('hidden');$('controls').classList.remove('hidden');$('timer').classList.add('hidden');
  $('mission-label').textContent='KEEP PRACTICING';$('goal').textContent='∞';
  if(learning.complete)learning.begin();assignLearningTargets();learningUI.setPlaying(true);learning.unlock();syncLearningAudio();
  audio?.unlock();hint('Keep exploring and collecting words for review.');
}

function toggleScope(){
  if(state.phase!=='playing'||state.reload>0)return;
  state.scoped=!state.scoped;state.steady=false;applyScope();
  if(state.scoped){state.tutorial=0;$('tutorial').classList.add('hidden');}
}
function applyScope(){
  $('scope-overlay').classList.toggle('hidden',!state.scoped);
  $('reticle').classList.toggle('hidden',state.scoped);
  $('breath-meter').classList.toggle('hidden',!state.scoped);
  $('zoom').classList.toggle('hidden',!state.scoped);
  $('scope').classList.toggle('active',state.scoped);$('scope').setAttribute('aria-pressed',String(state.scoped));
  $('scope-zoom-label').textContent=state.zoom+'×';$('zoom').textContent=state.zoom+'×';
  if(rifle)rifle.group.visible=state.phase!=='intro'&&!state.scoped;
}
function toggleCrouch(){
  if(state.phase!=='playing')return;
  state.crouched=!state.crouched;$('crouch').classList.toggle('active',state.crouched);$('crouch').setAttribute('aria-pressed',String(state.crouched));
}
function setSteady(on){
  if(state.phase!=='playing')return;
  if(!state.scoped&&on){hint('Open the scope first, then steady your aim.');return;}
  if(state.breath<.18&&on){hint('Catch your breath for a moment.');return;}
  state.steady=!!on;$('breath').classList.toggle('active',state.steady);$('breath').setAttribute('aria-pressed',String(state.steady));
}
function reload(){
  if(state.phase!=='playing'||state.reload>0||state.ammo===5)return;
  if(state.reserve<=0){hint('No spare rounds. Return to the trailhead for a fresh hunt.');return;}
  if(state.scoped){state.scoped=false;applyScope();}
  state.reload=.001;state.steady=false;audio?.reload();
  $('reload-progress').classList.remove('hidden');updateHUD();
}
function hint(message,duration=3){$('hint-toast').textContent=message;$('hint-toast').classList.remove('hidden');state.hint=duration;}

function getAnimalHits(ray=raycaster){
  const meshes=[];for(const a of animals)if(a.alive)meshes.push(...a.hitMeshes);
  return ray.intersectObjects(meshes,false);
}
function firstObstacle(ray,maxDistance=300){
  const oldFar=ray.far;ray.far=maxDistance;
  const h=ray.intersectObjects(environment.occluders||[],true)[0];ray.far=oldFar;
  return h;
}
function animalAimPoint(a,target=v1){return target.set(a.x,environment.heightAt(a.x,a.z)+1.12,a.z);}
function fire(){
  if(state.phase!=='playing'||state.reload>0||state.cooldown>0||state.finishDelay>0)return;
  audio?.unlock();
  if(state.ammo<=0){reload();if(state.reserve>0)hint('Reloading…',1.4);return;}
  camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);
  state.ammo--;state.shots++;state.cooldown=.9;state.shotFlash=.065;audio?.shot();
  raycaster.setFromCamera(pointerZero,camera);raycaster.far=230;
  let animalHit=getAnimalHits()[0],obstacle=firstObstacle(raycaster,230);
  if(animalHit&&obstacle&&obstacle.distance<animalHit.distance-.08)animalHit=null;
  if(!animalHit&&settings.assist){
    let candidate=null,best=.032;
    for(const a of animals){
      if(!a.alive)continue;
      const p=animalAimPoint(a,v1).clone().project(camera);
      const radius=Math.hypot(p.x,p.y);
      if(p.z<1&&p.z>-1&&radius<best){candidate=a;best=radius;}
    }
    if(candidate){
      const p=animalAimPoint(candidate,v1);
      raycaster.set(camera.position,v2.copy(p).sub(camera.position).normalize());
      const h=getAnimalHits()[0],wall=firstObstacle(raycaster,230);
      if(h&&(!wall||wall.distance>=h.distance-.08))animalHit=h;
    }
  }
  let end=camera.position.clone().addScaledVector(camera.getWorldDirection(v1),180);
  if(animalHit){
    const a=animalHit.object.userData.animal;
    const distance=camera.position.distanceTo(animalHit.point);
    end.copy(animalHit.point);
    if(a.lessonEntry?.key&&a.lessonEntry.key===learning.current?.key){
      const entry=learning.current;
      a.alive=false;a.fallTime=.001;a.respawn=5+Math.random()*3;a.alert=0;
      if(a.wordLabel)a.wordLabel.visible=false;
      state.hits++;state.bestShot=Math.max(state.bestShot,distance);
      const points=100+Math.round(distance)*2+(a.name==='Mountain stag'?40:0);
      state.score+=points;state.toast=3.1;audio?.hit();
      const result=learning.collect();
      $('toast-eyebrow').textContent=entry.kind==='sentence'?'PHRASE COLLECTED':'WORD COLLECTED';
      $('toast-score').textContent='+'+points;
      $('toast-detail').textContent=entry.word+(learning.preferences.showTranslation&&entry.translation?' · '+entry.translation:'');
      $('shot-toast').classList.remove('hidden');$('hit-marker').classList.add('show');
      setTimeout(()=>$('hit-marker').classList.remove('show'),200);
      if(result.complete&&state.mode==='calm'&&!state.freeRoam){state.finishDelay=4;state.finishWait=45;}
      else if(result.complete)learning.begin();
      assignLearningTargets();
    }else{
      hint('Find “'+(learning.current?.word||'your current word')+'”. Tap Track for a hint.',3);
      learning.replay();
    }
  }else{
    if(obstacle)end.copy(obstacle.point);
    hint(obstacle&&obstacle.distance<10?'The shot hit nearby cover. Move for a clear view.':'Missed. Take your time and steady your aim.',2);
  }
  state.recoil=1;
  rifle.muzzle.getWorldPosition(v1);
  tracer.geometry.attributes.position.setXYZ(0,v1.x,v1.y,v1.z);
  tracer.geometry.attributes.position.setXYZ(1,end.x,end.y,end.z);
  tracer.geometry.attributes.position.needsUpdate=true;tracer.visible=!state.scoped;
  for(const a of animals){if(a.alive&&Math.hypot(a.x-player.x,a.z-player.z)<65){a.alert=2.6;pickWanderTarget(a,true);}}
  updateHUD();
}
function pickWanderTarget(a,flee=false){
  let x,z;
  if(flee){const dir=Math.atan2(a.x-player.x,a.z-player.z)+(Math.random()-.5)*1.1;
    x=a.x+Math.sin(dir)*(17+Math.random()*16);z=a.z+Math.cos(dir)*(17+Math.random()*16);
  }else{x=a.homeX+(Math.random()-.5)*25;z=a.homeZ+(Math.random()-.5)*24;}
  a.targetX=clamp(x,-46,34);a.targetZ=clamp(z,-116,-9);a.wait=0;
}
function updateAnimals(dt){
  for(const a of animals){
    if(!a.alive){
      a.fallTime+=dt;a.fall(clamp(a.fallTime/2.2,0,1));
      a.respawn-=dt;
      if(a.respawn<=0&&(!learning.complete||state.mode==='timed'||state.freeRoam)){
        a.x=clamp(a.homeX+(Math.random()-.5)*18,-44,33);a.z=clamp(a.homeZ-12-Math.random()*20,-118,-24);
        a.targetX=a.x;a.targetZ=a.z;a.wait=3;a.alive=true;a.fallTime=0;a.fall(0);
        a.group.position.set(a.x,environment.heightAt(a.x,a.z),a.z);assignLearningTargets();
      }
      continue;
    }
    const dist=Math.hypot(a.x-player.x,a.z-player.z);
    const quiet=state.crouched?8:17;
    if(state.phase==='playing'&&dist<quiet&&state.move>.15&&a.alert<1){a.alert=4;pickWanderTarget(a,true);}
    a.alert=Math.max(0,a.alert-dt);
    let speed=0;
    if(a.wait>0){a.wait-=dt;if(a.wait<=0)pickWanderTarget(a);}
    else{
      const dx=a.targetX-a.x,dz=a.targetZ-a.z,d=Math.hypot(dx,dz);
      if(d<.8){if(a.alert>0)pickWanderTarget(a,true);else a.wait=3+Math.random()*9;}
      else{
        const desired=Math.atan2(dx,dz);a.yaw+=angleDiff(desired,a.yaw)*Math.min(1,dt*(a.alert>0?4:1.8));
        speed=a.alert>0?5.2:.63;
        const nx=a.x+Math.sin(a.yaw)*speed*dt,nz=a.z+Math.cos(a.yaw)*speed*dt;
        let blocked=false;
        for(const c of environment.colliders){if(Math.hypot(nx-c.x,nz-c.z)<c.r+.6){blocked=true;break;}}
        if(!blocked){a.x=nx;a.z=nz;}else {a.targetX=a.x+Math.cos(a.yaw)*9;a.targetZ=a.z-Math.sin(a.yaw)*9;}
      }
    }
    a.pace=mix(a.pace,speed/5.2,1-Math.exp(-dt*7));
    a.grazing=mix(a.grazing,a.wait>1&&a.alert===0?.8:0,1-Math.exp(-dt*2));
    a.group.position.set(a.x,environment.heightAt(a.x,a.z),a.z);a.group.rotation.y=a.yaw;
    a.animate(worldTime+a.id*1.7,a.pace,a.alert>0?1:0,a.grazing);
    if(a.wordLabel)a.wordLabel.visible=state.phase!=='intro'&&learning.preferences.showLabels&&a.alive;
  }
}
function nearestDeer(){
  let nearest=null,distance=Infinity;
  const current=learning?.current;
  for(const a of animals){if(a.alive&&(!current||a.lessonEntry?.key===current.key)){const d=Math.hypot(a.x-player.x,a.z-player.z);if(d<distance){nearest=a;distance=d;}}}
  return {animal:nearest,distance};
}
function trackDeer(){
  if(state.phase!=='playing')return;
  const {animal:a,distance}=nearestDeer();
  if(!a){hint('The clearing is quiet. More deer will return soon.');return;}
  const target=animalAimPoint(a,v1);
  state.trackTurn={yaw:Math.atan2(player.x-a.x,player.z-a.z),pitch:Math.atan2(target.y-player.y,distance),time:1.4};
  hint((a.lessonEntry?.word||a.name)+' · '+Math.round(distance)+' m ahead',2.5);
}

function updatePlayer(dt){
  let ix=input.x+(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
  let iz=input.y+(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);
  const length=Math.hypot(ix,iz);if(length>1){ix/=length;iz/=length;}
  state.move=Math.min(1,length);
  let speed=state.crouched?1.6:(keys.has('ShiftLeft')||keys.has('ShiftRight')?5.3:3.3);
  if(state.scoped)speed*=.55;
  const dx=(Math.cos(player.yaw)*ix+Math.sin(player.yaw)*iz)*speed*dt;
  const dz=(-Math.sin(player.yaw)*ix+Math.cos(player.yaw)*iz)*speed*dt;
  const limit=(environment.bounds||140)-8;
  let nx=clamp(player.x+dx,-limit,Math.min(42,limit)),nz=clamp(player.z+dz,-limit,limit);
  for(const c of environment.colliders){
    const d=Math.hypot(nx-c.x,nz-c.z),min=c.r+.42;
    if(d<min){const a=Math.atan2(nx-c.x,nz-c.z);nx=c.x+Math.sin(a)*min;nz=c.z+Math.cos(a)*min;}
  }
  player.x=nx;player.z=nz;
  player.stance=mix(player.stance,state.crouched?1.07:1.75,1-Math.exp(-dt*8));
  player.y=mix(player.y,environment.heightAt(nx,nz)+player.stance,1-Math.exp(-dt*14));
  if(state.trackTurn){
    player.yaw+=angleDiff(state.trackTurn.yaw,player.yaw)*Math.min(1,dt*5.5);
    player.pitch=mix(player.pitch,state.trackTurn.pitch,1-Math.exp(-dt*5.5));
    state.trackTurn.time-=dt;if(state.trackTurn.time<=0)state.trackTurn=null;
  }
  if(state.steady){state.breath=Math.max(0,state.breath-dt*.25);if(state.breath<=0)setSteady(false);}
  else state.breath=Math.min(1,state.breath+dt*.15);
  const sway=state.scoped?(state.steady?.00018:state.crouched?.0008:.0015):.0003;
  const bob=reducedMotion?0:Math.sin(worldTime*8.5)*.018*state.move*(state.scoped?.15:1);
  camera.position.set(player.x,player.y+bob,player.z);
  camera.rotation.set(player.pitch+Math.sin(worldTime*1.65)*sway+(reducedMotion?0:state.recoil*.018),player.yaw+Math.cos(worldTime*1.15)*sway,0,'YXZ');
  const targetFov=state.scoped?62/state.zoom:62;
  const fov=mix(camera.fov,targetFov,1-Math.exp(-dt*16));
  if(Math.abs(fov-camera.fov)>.005){camera.fov=fov;camera.updateProjectionMatrix();}
  if(length>.1){state.step+=dt*speed;if(state.step>.95){audio?.step(speed/5.3);state.step=0;}}
}
function updateAim(){
  camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);
  raycaster.setFromCamera(pointerZero,camera);raycaster.far=210;
  const hit=getAnimalHits()[0];
  let valid=hit;
  if(hit){const wall=firstObstacle(raycaster,hit.distance);if(wall&&wall.distance<hit.distance-.08)valid=null;}
  $('target-tag').classList.toggle('hidden',!valid);
  if(valid){const a=valid.object.userData.animal;$('target-name').textContent=learning.preferences.showLabels?(a.lessonEntry?.word||a.name):a.name;$('target-range').textContent=Math.round(valid.distance)+' m';}
  $('reticle').style.opacity=valid?'1':'.65';
}
function updateHUD(){
  $('harvests').textContent=state.hits;$('score').textContent=String(state.score).padStart(4,'0');
  $('ammo').textContent=state.ammo;$('reserve').textContent=state.reserve;
  $('ammo-shells').replaceChildren(...Array.from({length:5},(_,i)=>{const el=document.createElement('i');if(i>=state.ammo)el.className='empty';return el;}));
  $('rifle-state').textContent=state.reload>0?'RELOADING':state.ammo===0?'RELOAD YOUR RIFLE':'BOLT-ACTION · READY';
  $('stance-label').textContent=state.crouched?'CROUCHING':state.move>.05?'WALKING':'STANDING';
  const {animal:a,distance}=nearestDeer();
  $('track-distance').textContent=a?Math.round(distance)+' m':'—';
  $('track-title').textContent=a?'CURRENT WORD':'WORD RETURNING';
  if(a){const bearing=Math.atan2(player.x-a.x,player.z-a.z);const relative=-angleDiff(bearing,player.yaw);$('track-direction').style.transform='rotate('+relative+'rad)';}
  $('awareness').textContent=a&&a.alert>0?'DEER ARE ALERT':state.crouched?'QUIET APPROACH':'MOVE QUIETLY';
  $('awareness').style.color=a&&a.alert>0?'#f0c18b':'';
  $('mission-sub').textContent=state.freeRoam?'Keep collecting words':state.mode==='calm'?Math.max(0,(learning?.total||0)-state.hits)+' words / phrases to collect':'Listen, find, and remember';
  if(state.mode==='calm'&&!state.freeRoam)$('goal').textContent=learning?.total||0;
  const degrees=((Math.round(-player.yaw*180/Math.PI)%360)+360)%360;
  const headings=['N','NE','E','SE','S','SW','W','NW'];const index=Math.round(degrees/45)%8;
  $('compass-main').textContent=headings[index];$('compass-left').textContent=headings[(index+7)%8];$('compass-right').textContent=headings[(index+1)%8];$('heading').textContent=String(degrees).padStart(3,'0')+'°';
  const remaining=Math.max(0,Math.ceil(240-state.elapsed));$('timer').textContent=String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0');
  $('timer').style.color=remaining<30?'#efbd87':'';
  $('breath-fill').style.width=(state.breath*100)+'%';$('breath-label').textContent=state.steady?'STEADY AIM':state.breath<.4?'CATCH YOUR BREATH':'BREATHE SLOWLY';
  $('breath').classList.toggle('active',state.steady);$('breath').setAttribute('aria-pressed',String(state.steady));
  $('crouch').classList.toggle('active',state.crouched);$('crouch').setAttribute('aria-pressed',String(state.crouched));
}
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(.05,(now-previousTime)/1000);previousTime=now;
  if(document.hidden)return;
  if(state.phase==='intro'){
    worldTime+=dt;environment.update?.(dt,worldTime);updateAnimals(dt);
    camera.fov=mix(camera.fov,59,1-Math.exp(-dt*4));camera.updateProjectionMatrix();
    camera.position.set(12+(reducedMotion?0:Math.sin(worldTime*.045)*1.5),environment.heightAt(12,30)+4.3,30);
    camera.lookAt(-1,2,-43);
  }else if(state.phase==='playing'){
    worldTime+=dt;state.elapsed+=dt;state.cooldown=Math.max(0,state.cooldown-dt);
    state.recoil=Math.max(0,state.recoil-dt*5.5);state.shotFlash=Math.max(0,state.shotFlash-dt);
    if(state.reload>0){
      state.reload+=dt;$('reload-fill').style.width=Math.min(100,state.reload/1.85*100)+'%';
      if(state.reload>=1.85){const fill=Math.min(5-state.ammo,state.reserve);state.ammo+=fill;state.reserve-=fill;state.reload=0;$('reload-progress').classList.add('hidden');updateHUD();}
    }
    if(state.finishDelay>0){state.finishDelay-=dt;state.finishWait-=dt;if(state.finishDelay<=0){if(learning.isSpeaking&&state.finishWait>0)state.finishDelay=.15;else finishHunt();}}
    if(state.mode==='timed'&&state.elapsed>=240&&!state.freeRoam)finishHunt();
    if(state.phase==='playing'){
      updatePlayer(dt);updateAnimals(dt);environment.update?.(dt,worldTime);audio?.update(dt,worldTime);
      rifle.animate({time:worldTime,recoil:state.recoil,reload:state.reload/1.85,moving:state.move,scoped:state.scoped});
      rifle.group.visible=!state.scoped;
      muzzleFlash.visible=state.shotFlash>0;tracer.visible=state.shotFlash>.01&&!state.scoped;
      state.scan+=dt;if(state.scan>.14){updateAim();state.scan=0;}
      hudElapsed+=dt;if(hudElapsed>.15){updateHUD();hudElapsed=0;}
      if(state.toast>0){state.toast-=dt;if(state.toast<=0)$('shot-toast').classList.add('hidden');}
      if(state.hint>0){state.hint-=dt;if(state.hint<=0)$('hint-toast').classList.add('hidden');}
      if(state.tutorial>0){state.tutorial-=dt;if(state.tutorial<=0)$('tutorial').classList.add('hidden');}
    }
  }
  renderer.render(scene,camera);
  frameCounter++;qualityElapsed+=dt;
  if(qualityElapsed>7&&settings.graphics==='auto'){
    const fps=frameCounter/qualityElapsed;
    if(fps<32&&state.autoQuality>.6){state.autoQuality=Math.max(.6,state.autoQuality-.15);resize();}
    frameCounter=0;qualityElapsed=0;
  }
}
function resize(){
  if(!renderer)return;
  const w=$('game').clientWidth,h=$('game').clientHeight;
  const quality=settings.graphics==='low'?.7:settings.graphics==='high'?1.65:(touch?1.2:1.5)*state.autoQuality;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,quality));renderer.setSize(w,h,false);
  camera.aspect=w/h;camera.updateProjectionMatrix();
  renderer.shadowMap.enabled=settings.graphics!=='low';
}
function applySettings(){
  $('sensitivity').value=settings.sensitivity;$('volume').value=settings.volume;$('aim-assist').checked=settings.assist;$('invert').checked=settings.invert;$('graphics').value=settings.graphics;
  $('sound').style.opacity=settings.muted?'.5':'1';$('sound').setAttribute('aria-label',settings.muted?'Unmute sound':'Mute sound');
  audio?.setVolume(settings.volume);audio?.setMuted(settings.muted);syncLearningAudio();resize();
}
function resetInputs(){keys.clear();input.x=input.y=0;input.lookPointer=input.joyPointer=null;$('joystick-knob').style.transform='translate(-50%,-50%)';}
function moveLook(dx,dy){
  if(state.phase!=='playing')return;
  const scale=.0026*settings.sensitivity*(state.scoped?1/state.zoom:.85);
  player.yaw-=dx*scale;player.pitch=clamp(player.pitch-dy*scale*(settings.invert?-1:1),-1.3,1.3);
  state.trackTurn=null;
}
function bindControls(){
  $('start').addEventListener('click',startGame);$('play-again').addEventListener('click',startGame);
  $('pause').addEventListener('click',pauseGame);$('resume').addEventListener('click',resumeGame);
  $('restart').addEventListener('click',returnToIntro);$('continue-roam').addEventListener('click',continueRoam);
  $('intro-settings').addEventListener('click',openSettings);$('pause-settings').addEventListener('click',openSettings);$('close-settings').addEventListener('click',closeSettings);
  $('scope').addEventListener('click',toggleScope);$('crouch').addEventListener('click',toggleCrouch);
  $('breath').addEventListener('click',()=>setSteady(!state.steady));$('find').addEventListener('click',trackDeer);
  $('reload').addEventListener('click',reload);$('fire').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();fire();});
  $('fire').addEventListener('click',e=>{if(e.detail===0)fire();});
  $('zoom').addEventListener('click',()=>{state.zoom=state.zoom===4?8:state.zoom===8?2:4;applyScope();});
  $('dismiss-tutorial').addEventListener('click',()=>{state.tutorial=0;$('tutorial').classList.add('hidden');});
  document.querySelectorAll('[data-mode]').forEach(el=>el.addEventListener('click',()=>{state.mode=el.dataset.mode;document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('selected',b===el);b.setAttribute('aria-pressed',String(b===el));});}));
  $('sound').addEventListener('click',()=>{settings.muted=!settings.muted;audio?.unlock();applySettings();saveSettings();});
  $('sensitivity').addEventListener('input',e=>{settings.sensitivity=Number(e.target.value);saveSettings();});
  $('volume').addEventListener('input',e=>{settings.volume=Number(e.target.value);audio?.unlock();audio?.setVolume(settings.volume);syncLearningAudio();saveSettings();});
  $('aim-assist').addEventListener('change',e=>{settings.assist=e.target.checked;saveSettings();});
  $('invert').addEventListener('change',e=>{settings.invert=e.target.checked;saveSettings();});
  $('graphics').addEventListener('change',e=>{settings.graphics=e.target.value;state.autoQuality=1;resize();saveSettings();});
  $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement){await document.exitFullscreen();}else if($('game').requestFullscreen){await $('game').requestFullscreen();}else{$('fullscreen').textContent='Use landscape for a wider view';}}catch{$('fullscreen').textContent='Fullscreen unavailable';}});
  $('lock-mouse').addEventListener('click',async()=>{
    if(touch){$('lock-mouse').textContent='Drag the forest to look';return;}
    try{closeSettings();if(state.phase==='paused')resumeGame();if(state.phase==='intro')startGame();await $('world').requestPointerLock?.();}catch{hint('Mouse lock is unavailable. Drag the forest to look instead.');}
  });
  const canvas=$('world');
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{
    if(state.phase!=='playing')return;
    e.preventDefault();audio?.unlock();
    if(e.button===2){toggleScope();return;}
    if(document.pointerLockElement===canvas){fire();return;}
    if(input.lookPointer!==null)return;
    input.lookPointer=e.pointerId;input.lastX=input.startX=e.clientX;input.lastY=input.startY=e.clientY;input.dragged=false;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(document.pointerLockElement===canvas){moveLook(e.movementX,e.movementY);return;}
    if(e.pointerId!==input.lookPointer)return;
    moveLook(e.clientX-input.lastX,e.clientY-input.lastY);input.lastX=e.clientX;input.lastY=e.clientY;
    if(Math.hypot(e.clientX-input.startX,e.clientY-input.startY)>4)input.dragged=true;
  });
  const endLook=e=>{if(e.pointerId!==input.lookPointer)return;if(!input.dragged&&e.pointerType==='mouse'&&e.type==='pointerup')fire();input.lookPointer=null;};
  canvas.addEventListener('pointerup',endLook);canvas.addEventListener('pointercancel',e=>{if(e.pointerId===input.lookPointer)input.lookPointer=null;});
  canvas.addEventListener('lostpointercapture',e=>{if(e.pointerId===input.lookPointer)input.lookPointer=null;});
  const joystick=$('joystick');
  const updateJoystick=e=>{
    const r=joystick.getBoundingClientRect(),radius=r.width*.36;
    let x=(e.clientX-r.left-r.width/2)/radius,y=(e.clientY-r.top-r.height/2)/radius;
    const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}
    input.x=Math.abs(x)<.08?0:x;input.y=Math.abs(y)<.08?0:y;
    $('joystick-knob').style.transform='translate(calc(-50% + '+x*radius+'px),calc(-50% + '+y*radius+'px))';
  };
  joystick.addEventListener('pointerdown',e=>{if(state.phase!=='playing'||input.joyPointer!==null)return;e.preventDefault();e.stopPropagation();input.joyPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);updateJoystick(e);});
  joystick.addEventListener('pointermove',e=>{if(e.pointerId!==input.joyPointer)return;e.preventDefault();updateJoystick(e);});
  const endJoy=e=>{if(e.pointerId!==input.joyPointer)return;e.preventDefault();e.stopPropagation();input.joyPointer=null;input.x=input.y=0;$('joystick-knob').style.transform='translate(-50%,-50%)';};
  joystick.addEventListener('pointerup',endJoy);joystick.addEventListener('pointercancel',endJoy);joystick.addEventListener('lostpointercapture',endJoy);
  window.addEventListener('keydown',e=>{
    if(learningModalOpen){if(e.code==='Escape')learningUI.close();return;}
    if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'].includes(e.code))e.preventDefault();
    if(e.repeat){if(state.phase==='playing')keys.add(e.code);return;}
    if(e.code==='Escape'){if(!$('settings').classList.contains('hidden'))closeSettings();else if(state.phase==='playing')pauseGame();else if(state.phase==='paused')resumeGame();return;}
    if(state.phase!=='playing')return;keys.add(e.code);
    if(e.code==='KeyF')toggleScope();if(e.code==='KeyR')reload();if(e.code==='KeyC')toggleCrouch();if(e.code==='KeyT')trackDeer();if(e.code==='Space')setSteady(true);
  });
  window.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Space')setSteady(false);});
  window.addEventListener('resize',resize);visualViewport?.addEventListener('resize',resize);
  window.addEventListener('blur',()=>{resetInputs();state.steady=false;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){pauseGame();audio?.setMuted(true);}else if(state.phase==='intro')audio?.setMuted(settings.muted);previousTime=performance.now();});
  document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement){input.lookPointer=null;keys.clear();}});
  document.addEventListener('selectstart',e=>{if(!['INPUT','TEXTAREA'].includes(e.target.tagName))e.preventDefault();});
}

init();
