/** LAST REWIND — rendering, input, combat, and UI integration.
 * Run with any static HTTP server. All assets and Three.js r170 are local.
 */
import * as THREE from './vendor/three.module.js';
import { PointerLockControls } from './vendor/PointerLockControls.js';
import { buildEnvironment } from './environment.js';
import { createWeapon } from './weapon.js';
import { createEnemySystem } from './enemies.js';
import { AudioEngine } from './audio.js';
import { SurvivalRules, MAGAZINE, MAX_HEALTH } from './rules.js';
import { createEffects } from './effects.js';
import { createLearningUI } from './learning-ui.js';

const $=id=>document.getElementById(id);
const ui=Object.fromEntries(['menu','help','pause','result','hud','wave-number','wave-total','enemies-left','score','integrity','integrity-meter','health','health-meter','shells','reserve','reload-label','wave-banner','banner-label','banner-title','banner-detail','crosshair','hitmarker','kill-note','damage-flash','interaction','toast'].map(id=>[id,$(id)]));
const touch=matchMedia('(pointer:coarse)').matches||(navigator.maxTouchPoints>0&&innerWidth<1100)||new URLSearchParams(location.search).get('controls')==='touch';
document.body.classList.toggle('touch',touch);
const canvas=$('scene'),rules=new SurvivalRules(),audio=new AudioEngine();
const keys=new Set(),joystick={x:0,y:0};
const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.05,100);
camera.rotation.order='YXZ';camera.position.set(0,1.68,6.3);
const scene=new THREE.Scene();scene.add(camera);
let renderer,environment,enemies,weapon,effects,controls;
let mode='menu',worldTime=0,lastFrame=performance.now(),sensitivity=1,lockBlocked=false,hadLock=false;
let firing=false,aiming=false,moving=false,sprinting=false,pumpClock=-1,hitClock=0,killClock=0,hurtClock=0,toastClock=0,announceClock=0;
let lookPointer=null,movePointer=null,lastLookX=0,lastLookY=0,lookMoved=0,lookStart=0,lastHud=-1,footClock=0;
let quality='auto',slowFrames=0,frames=0,frameSum=0;
const ray=new THREE.Raycaster(),direction=new THREE.Vector3(),shotDirection=new THREE.Vector3(),forward=new THREE.Vector3(),side=new THREE.Vector3(),center=new THREE.Vector2();
const intersections=[],euler=new THREE.Euler(0,0,0,'YXZ'),supplyPosition=new THREE.Vector3(-7,0,3.15);
const _move=new THREE.Vector3(),_target=new THREE.Vector3();
let supplyVisual;
let learningReturnMode='menu';
const learning=createLearningUI({
  onOpen(){learningReturnMode=mode;if(mode==='playing')pauseGame();if(mode==='paused')show(ui.pause,false);resetInput();},
  onClose({resume}){if(!resume)return;if(learningReturnMode==='playing'&&mode==='paused')resumeGame();else if(learningReturnMode==='paused')show(ui.pause,true);},
  onApply({reason}){if(mode==='playing'||mode==='paused'){show(ui.pause,false);startGame({requestInput:reason!=='native'});}}
});

// Rendering setup. Pixel ratio, light count and shadow quality are capped for phones.
try{
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  renderer.shadowMap.enabled=!touch;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  environment=buildEnvironment(scene,{mobile:touch});
  weapon=createWeapon(camera);weapon.group.visible=false;
  effects=createEffects(scene);
  enemies=createEnemySystem(scene,{
    colliders:environment.colliders,
    onPlayerDamage(amount){if(mode!=='playing')return;rules.damageHealth(amount*learning.damageFactor);hurtClock=.45;audio.hurt();if(rules.over)finish(false);},
    onStoreDamage(amount){if(mode==='playing'){rules.damageStore(amount*learning.storeDamageFactor);if(rules.over)finish(false);}},
    onKill(enemy){
      if(mode!=='playing')return;
      const points=enemy.points||({brute:250,runner:150,crawler:75,zombie:100}[enemy.type]||100);
      rules.addKill(points);audio.kill();killClock=1.05;ui['kill-note'].textContent=`+${points}  ${enemy.type==='brute'?'BRUTE DOWN':'ELIMINATED'}`;
      learning.collectWord();
      if(rules.kills%3===0)effects.drop(enemy.root.position,rules.kills%9===0?'health':'ammo');
    },
    onImpact(position,color){effects.burst(position,color||0xaaa17d,4);}
  });
  controls=new PointerLockControls(camera,canvas);controls.minPolarAngle=.30;controls.maxPolarAngle=Math.PI-.30;
  controls.addEventListener('lock',()=>{hadLock=true;lockBlocked=false;});
  controls.addEventListener('unlock',()=>{if(hadLock&&mode==='playing')pauseGame();hadLock=false;});
  controls.addEventListener('lockerror',()=>{lockBlocked=true;if(mode==='playing')toast('Drag to look · click to shoot · WASD to move',5);});
  supplyVisual=makeSupplyMarker();
  resize();
  // Let the opening frame render before activating the Start control.
  renderer.render(scene,camera);
  $('start-button').disabled=false;$('start-label').textContent='START & LEARN';
  $('loading-detail').textContent=touch?'Landscape recommended · tap a word to hear it again.':'Your lesson is ready · tap any learned word to hear it again.';
  requestAnimationFrame(frame);
}catch(error){fatal(error);}

function makeSupplyMarker(){
  const group=new THREE.Group();group.position.copy(supplyPosition);
  const box=new THREE.Mesh(new THREE.BoxGeometry(.65,.38,.43),new THREE.MeshStandardMaterial({color:0x314439,roughness:.7,metalness:.12}));box.position.y=.45;group.add(box);
  const band=new THREE.Mesh(new THREE.BoxGeometry(.1,.405,.45),new THREE.MeshStandardMaterial({color:0xb7c49a,emissive:0x455c37,emissiveIntensity:.6}));band.position.y=.45;group.add(band);
  const panel=document.createElement('canvas');panel.width=256;panel.height=128;const c=panel.getContext('2d');c.fillStyle='#152922';c.fillRect(0,0,256,128);c.strokeStyle='#abc88e';c.lineWidth=4;c.strokeRect(5,5,246,118);c.fillStyle='#c8e3ad';c.textAlign='center';c.font='bold 25px monospace';c.fillText('STAFF SUPPLIES',128,51);c.font='17px monospace';c.fillText('TAKE WHAT YOU NEED',128,82);
  const tex=new THREE.CanvasTexture(panel);tex.colorSpace=THREE.SRGBColorSpace;
  const label=new THREE.Mesh(new THREE.PlaneGeometry(.94,.47),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));label.position.set(0,1.15,0);group.add(label);
  const light=new THREE.PointLight(0xa7d78a,.5,3,2);light.position.y=1;group.add(light);scene.add(group);return {group,label,light};
}

function resize(){
  if(!renderer)return;
  const cap=quality==='low'?1:quality==='high'?2:touch?1.25:1.5;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,cap));renderer.setSize(innerWidth,innerHeight,false);
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
}
addEventListener('resize',resize);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pauseGame();fatal(new Error('The graphics context was interrupted. Reload the game to start a fresh shift.'));});
function fatal(error){console.error(error);$('fatal-error').classList.remove('hidden');$('error-message').textContent=`${error.message||'WebGL is unavailable.'} Try a current browser with hardware acceleration enabled.`;}
function show(el,visible){el.classList.toggle('hidden',!visible);}
function toast(text,seconds=3){ui.toast.textContent=text;toastClock=seconds;}

// Game lifecycle is separate from pointer lock: permission failures never block Start.
function requestControl(){
  learning.unlock();
  audio.start().then(()=>{if(audio.effects)audio.effects.gain.value=.40;if(audio.ambient)audio.ambient.gain.value=.035;});
  if(!touch&&!lockBlocked&&canvas.requestPointerLock){
    try{const pending=controls.lock();pending?.catch(()=>{lockBlocked=true;toast('Drag to look · click to shoot · WASD to move',5);});}
    catch{lockBlocked=true;}
  }
}
function resetInput(){keys.clear();firing=false;aiming=false;joystick.x=joystick.y=0;movePointer=lookPointer=null;$('move-knob').style.transform='';}
function startGame({requestInput=true}={}){
  rules.start();enemies.reset();effects.reset();weapon.reset();environment.reset();resetInput();
  learning.startRun();rules.campaignWaves=learning.campaignWaves;
  camera.position.set(0,1.68,6.3);camera.rotation.set(0,0,0,'YXZ');camera.fov=72;camera.updateProjectionMatrix();
  mode='playing';weapon.group.visible=true;worldTime=0;lastFrame=performance.now();pumpClock=-1;hitClock=killClock=hurtClock=0;
  for(const id of ['menu','pause','result','help'])show(ui[id],false);show(ui.hud,true);
  toast(touch?'Move left · aim right · defeat enemies to learn words':'Defeat an enemy to hear a word. Clear the wave to hear its sentence.',5);
  if(requestInput)requestControl();updateHud();
}
function pauseGame(){
  if(mode!=='playing')return;mode='paused';resetInput();learning.pause();show(ui.pause,true);if(controls.isLocked)controls.unlock();
}
function resumeGame(){
  if(mode!=='paused')return;mode='playing';show(ui.pause,false);lastFrame=performance.now();requestControl();learning.resume();
}
function finish(won){
  if(mode!=='playing')return;mode='result';resetInput();weapon.reload(false);show(ui.result,true);show(ui['wave-banner'],false);show(ui.interaction,false);
  if(!won)learning.pause();
  if(controls.isLocked)controls.unlock();
  $('result-kicker').textContent=won?'06:00 AM · THE SUN IS COMING UP':'SHIFT REPORT · SERVICE INTERRUPTED';
  $('result-title').textContent=won?'You made it to dawn.':'End of the tape.';
  $('result-message').textContent=won?`${rules.cleared} waves survived. Review the words you discovered or keep learning in endless mode.`:rules.health<=0?'Your collected words are safe. Review them, then try another shift.':'The store was overrun. Your vocabulary stays in the review basket.';
  $('result-score').textContent=rules.score.toLocaleString();$('result-wave').textContent=`${rules.cleared} / ${Math.max(rules.campaignWaves,rules.wave)}`;$('result-kills').textContent=rules.kills;
  let best=rules.score;try{best=Math.max(best,Number(localStorage.getItem('last-rewind-best')||0));localStorage.setItem('last-rewind-best',String(best));}catch{}
  $('best-score').textContent=`PERSONAL BEST  ${best.toLocaleString()}`;show($('endless-button'),won);audio.gameover();learning.update();updateHud();
}
$('start-button').addEventListener('click',startGame);$('retry-button').addEventListener('click',startGame);$('restart-button').addEventListener('click',startGame);
$('resume-button').addEventListener('click',resumeGame);$('pause-button').addEventListener('click',pauseGame);
$('how-button').addEventListener('click',()=>show(ui.help,true));$('close-help').addEventListener('click',()=>show(ui.help,false));
$('endless-button').addEventListener('click',()=>{if(rules.continueEndless()){mode='playing';show(ui.result,false);lastFrame=performance.now();requestControl();toast('Overtime. Every wave gets harder.');}});
$('sound-button').addEventListener('click',()=>{audio.setMuted(!audio.muted);learning.setMuted(audio.muted);$('sound-button').textContent=audio.muted?'♪̸':'♪';$('sound-button').setAttribute('aria-label',audio.muted?'Unmute sound':'Mute sound');});
$('sensitivity').addEventListener('input',e=>{sensitivity=Number(e.target.value);controls.pointerSpeed=sensitivity;});
$('quality').addEventListener('change',e=>{quality=e.target.value;renderer.shadowMap.enabled=quality==='high'||(quality==='auto'&&!touch);resize();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame();});

// Keyboard input. Holding a direction or dragging a joystick never opens the pause menu.
addEventListener('keydown',e=>{
  if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  if(e.code==='Escape'||e.code==='KeyP'){if(learning.isOpen){learning.close();return;}if(mode==='playing')pauseGame();else if(mode==='paused')resumeGame();return;}
  if(mode!=='playing')return;keys.add(e.code);
  if(!e.repeat){if(e.code==='KeyR')reload();if(e.code==='KeyE')useSupplies();if(e.code==='Space'||e.code==='KeyF')shoot();}
});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('contextmenu',e=>e.preventDefault());
function rotateLook(dx,dy){
  euler.setFromQuaternion(camera.quaternion);euler.y-=dx*.0024*sensitivity;euler.x=THREE.MathUtils.clamp(euler.x-dy*.0024*sensitivity,-1.26,1.26);camera.quaternion.setFromEuler(euler);
}
canvas.addEventListener('pointerdown',e=>{
  if(mode!=='playing'||touch)return;
  if(e.button===2){aiming=true;return;}
  if(e.button!==0)return;
  if(controls.isLocked){firing=true;shoot();}
  else{lookPointer=e.pointerId;lastLookX=e.clientX;lastLookY=e.clientY;lookMoved=0;lookStart=performance.now();canvas.setPointerCapture(e.pointerId);}
});
canvas.addEventListener('pointermove',e=>{
  if(mode!=='playing'||touch||controls.isLocked||lookPointer!==e.pointerId)return;
  const dx=e.clientX-lastLookX,dy=e.clientY-lastLookY;lookMoved+=Math.abs(dx)+Math.abs(dy);rotateLook(dx,dy);lastLookX=e.clientX;lastLookY=e.clientY;
});
canvas.addEventListener('pointerup',e=>{
  if(!touch&&lookPointer===e.pointerId){if(lookMoved<7&&performance.now()-lookStart<400)shoot();lookPointer=null;}
});
addEventListener('pointerup',e=>{if(!touch){if(e.button===0)firing=false;if(e.button===2)aiming=false;}});
canvas.addEventListener('pointercancel',()=>{firing=false;lookPointer=null;});

// Independent touch pointers allow movement, aiming and firing simultaneously.
const movePad=$('move-pad'),lookPad=$('look-pad'),fireButton=$('touch-fire');
function moveStick(e){const r=movePad.getBoundingClientRect();const x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;const length=Math.hypot(x,y),max=39;const k=length>max?max/length:1;joystick.x=x*k/max;joystick.y=y*k/max;$('move-knob').style.transform=`translate(${x*k}px,${y*k}px)`;}
movePad.addEventListener('pointerdown',e=>{if(mode!=='playing')return;e.preventDefault();movePointer=e.pointerId;movePad.setPointerCapture(e.pointerId);moveStick(e);});
movePad.addEventListener('pointermove',e=>{if(e.pointerId===movePointer){e.preventDefault();moveStick(e);}});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])movePad.addEventListener(ev,e=>{if(e.pointerId===movePointer){movePointer=null;joystick.x=joystick.y=0;$('move-knob').style.transform='';}});
lookPad.addEventListener('pointerdown',e=>{if(mode!=='playing')return;e.preventDefault();lookPointer=e.pointerId;lastLookX=e.clientX;lastLookY=e.clientY;lookPad.setPointerCapture(e.pointerId);});
lookPad.addEventListener('pointermove',e=>{if(mode==='playing'&&e.pointerId===lookPointer){e.preventDefault();rotateLook(e.clientX-lastLookX,e.clientY-lastLookY);lastLookX=e.clientX;lastLookY=e.clientY;}});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])lookPad.addEventListener(ev,e=>{if(e.pointerId===lookPointer)lookPointer=null;});
fireButton.addEventListener('pointerdown',e=>{e.preventDefault();if(mode!=='playing')return;fireButton.setPointerCapture(e.pointerId);firing=true;shoot();});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])fireButton.addEventListener(ev,()=>firing=false);
$('touch-reload').addEventListener('pointerdown',e=>{e.preventDefault();reload();});
$('interact-touch').addEventListener('click',useSupplies);

function reload(){if(mode==='playing'&&rules.beginReload()){weapon.reload(true);audio.reload();toast('Loading shells · fire to interrupt',1.5);}}
function useSupplies(){
  if(mode!=='playing')return;
  if(Math.hypot(camera.position.x-supplyPosition.x,camera.position.z-supplyPosition.z)>2.05){toast('Supplies are beside the checkout counter.');return;}
  if(rules.useSupplies()){audio.pickup();toast('+16 health · +20 store · +12 reserve shells',3);effects.burst(supplyPosition.clone().setY(1),0xb6d990,20);}
  else toast(rules.phase==='combat'?'Counter supplies unlock between waves.':'Supplies restock after the next wave.',2);
}

// Player-circle / static-box collision, with axis sliding at aisle corners.
function resolvePlayer(x,z){
  const radius=.32;
  for(const box of environment.colliders){
    if(x+radius<box.minX||x-radius>box.maxX||z+radius<box.minZ||z-radius>box.maxZ)continue;
    const nx=THREE.MathUtils.clamp(x,box.minX,box.maxX),nz=THREE.MathUtils.clamp(z,box.minZ,box.maxZ);
    const dx=x-nx,dz=z-nz,dist=Math.hypot(dx,dz);
    if(dist>0&&dist<radius){x+=dx/dist*(radius-dist);z+=dz/dist*(radius-dist);}
    else if(dist===0){
      const options=[{d:Math.abs(x-box.minX),x:box.minX-radius,z},{d:Math.abs(x-box.maxX),x:box.maxX+radius,z},{d:Math.abs(z-box.minZ),x,z:box.minZ-radius},{d:Math.abs(z-box.maxZ),x,z:box.maxZ+radius}];options.sort((a,b)=>a.d-b.d);x=options[0].x;z=options[0].z;
    }
  }
  return {x:THREE.MathUtils.clamp(x,-15.5,15.5),z:THREE.MathUtils.clamp(z,-23.5,9.5)};
}
function updatePlayer(dt){
  let x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+joystick.x;
  let y=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-joystick.y;
  const length=Math.hypot(x,y);moving=length>.08;if(length>1){x/=length;y/=length;}
  sprinting=moving&&!aiming&&(keys.has('ShiftLeft')||keys.has('ShiftRight')||(touch&&length>.95));
  camera.getWorldDirection(forward);forward.y=0;forward.normalize();side.crossVectors(forward,camera.up).normalize();
  _move.copy(forward).multiplyScalar(y).addScaledVector(side,x).multiplyScalar((sprinting?4.5:3.15)*dt*(aiming?.65:1));
  const steps=Math.max(1,Math.ceil(_move.length()/.15));
  for(let i=0;i<steps;i++){
    let p=resolvePlayer(camera.position.x+_move.x/steps,camera.position.z+_move.z/steps);
    // Living actors also occupy space. Resolve both actors and nearby fixtures so
    // running backwards into a zombie cannot carry the player through its body.
    for(let pass=0;pass<2;pass++){
      for(const enemy of enemies.active){
        const dx=p.x-enemy.root.position.x,dz=p.z-enemy.root.position.z;
        const distance=Math.hypot(dx,dz),minimum=.32+enemy.radius;
        if(distance<minimum){
          const nx=distance>.0001?dx/distance:Math.sin(camera.rotation.y);
          const nz=distance>.0001?dz/distance:Math.cos(camera.rotation.y);
          p.x+=nx*(minimum-distance);p.z+=nz*(minimum-distance);
        }
      }
      p=resolvePlayer(p.x,p.z);
    }
    camera.position.x=p.x;camera.position.z=p.z;
  }
  footClock+=dt*(sprinting?12:8);camera.position.y=1.68+(moving?Math.sin(footClock)*.017:Math.sin(worldTime*1.5)*.002);
  const targetFov=aiming?58:sprinting?76:72;camera.fov=THREE.MathUtils.lerp(camera.fov,targetFov,Math.min(1,dt*9));camera.updateProjectionMatrix();
}

// Hitscan shotgun: each pellet stops at the nearest wall/shelf or enemy surface.
function shoot(){
  if(mode!=='playing')return;
  if(!rules.fire()){
    if(rules.shells===0&&!rules.reloading){if(rules.reserve>0)reload();else toast('Out of shells. Find a supply box or a dropped ammo pack.',2);}return;
  }
  weapon.reload(false);weapon.fire();audio.shot();pumpClock=.20;ui.crosshair.classList.add('firing');
  scene.updateMatrixWorld(true);camera.getWorldDirection(direction);
  // Subtle mobile assist within a tight on-screen cone, still respecting occlusion.
  if(touch){
    let best=null,bestDot=.992;
    for(const e of enemies.active){_target.copy(e.root.position);_target.y=e.type==='crawler'?.45:1.25;_target.sub(camera.position).normalize();const dot=direction.dot(_target);if(dot>bestDot){bestDot=dot;best=_target.clone();}}
    if(best)direction.lerp(best,.38).normalize();
  }
  const targets=[...environment.shootables,...enemies.targets];
  const damage=new Map();let anyHit=false;
  const right=side.copy(direction).cross(camera.up).normalize(),up=new THREE.Vector3().crossVectors(right,direction).normalize();
  const spread=aiming?.023:.043;
  for(let i=0;i<10;i++){
    const angle=i*2.39996323+Math.random()*.35,radius=i===0?0:Math.sqrt(i/9)*spread;
    shotDirection.copy(direction).addScaledVector(right,Math.cos(angle)*radius).addScaledVector(up,Math.sin(angle)*radius).normalize();
    ray.set(camera.position,shotDirection);ray.far=37;intersections.length=0;ray.intersectObjects(targets,false,intersections);
    const hit=intersections.find(h=>!h.object.userData.enemy||h.object.userData.enemy.alive!==false);if(!hit)continue;
    const enemy=hit.object.userData.enemy;
    if(enemy){
      anyHit=true;const head=hit.object.userData.head||/head|face/i.test(hit.object.name);const amount=Math.max(9,21-hit.distance*.35)*(head?1.5:1);
      const prior=damage.get(enemy);if(prior)prior.amount+=amount;else damage.set(enemy,{amount,point:hit.point.clone()});
      if(i%3===0)effects.burst(hit.point,0xc48f68,3);
    }else if(i%3===0)effects.burst(hit.point,0xd7c79a,4);
  }
  for(const [enemy,hit] of damage)enemies.damage(enemy,hit.amount,hit.point);
  if(anyHit){hitClock=.16;audio.hit();}
  camera.rotation.x=Math.min(1.26,camera.rotation.x+.016);
  if(rules.shells===0)toast(rules.reserve>0?'R to reload · 6-shell magazine':'Find ammo near the counter or collect a dropped pack.',2);
  updateHud();
}

function handleEvent(event){
  if(event.type==='spawn'){
    // Later waves occasionally breach behind the main shelves, with advance warning.
    let pos;
    if(rules.wave>=3&&event.index%7===6){pos=new THREE.Vector3(event.index%2?8:-8,0,-6.5);toast('SIDE WINDOW BREACHED',2);}
    else{const positions=[[-5,-17.5],[5,-18.5],[0,-20],[-7,-16],[7,-16]];const p=positions[event.index%positions.length];pos=new THREE.Vector3(p[0],0,p[1]);}
    const spawned=enemies.spawn(event.kind,rules.wave,pos);
    // A saturated pool defers the spawn instead of losing a wave member.
    if(!spawned){rules.spawned--;rules.spawnClock=.5;}
    else{spawned.speed*=learning.speedFactor;if(learning.settings.difficulty==='practice')rules.spawnClock*=1.2;}
  }else if(event.type==='shell'){audio.reload();}
  else if(event.type==='reloadDone'){weapon.reload(false);audio.pump();}
  else if(event.type==='wave'){
    const round=learning.startWave(event.wave);
    // Give every token in a longer sentence an encounter, while retaining each
    // wave's minimum combat variety and using the same bounded actor pool.
    const base=[...rules.queue];const minimum=Math.min(128,round?.words?.length||0);
    while(rules.queue.length<minimum)rules.queue.push(base[rules.queue.length%base.length]);
    announceClock=2.8;audio.wave();toast(event.wave===1?'Each enemy reveals a word.':event.wave===3?'Watch the windows. Keep listening.':'A new sentence. A new wave.',3);
  }
  else if(event.type==='clear'){const round=learning.completeWave();announceClock=0;if(learning.settings.difficulty==='practice')rules.countdown=18;audio.pickup();toast(`${round?.sentence?'Sentence':'Vocabulary'} complete · wave ${event.wave} cleared · reserve restocked`,4);}
  else if(event.type==='won'){learning.completeWave();finish(true);}
}

function updateHud(){
  ui['wave-number'].textContent=String(Math.max(1,rules.wave)).padStart(2,'0');ui['wave-total'].textContent=rules.endless?' / ∞':` / ${String(rules.campaignWaves).padStart(2,'0')}`;
  ui.score.textContent=String(rules.score).padStart(6,'0');ui.health.textContent=Math.ceil(rules.health);ui.integrity.textContent=Math.ceil(rules.integrity);
  ui['health-meter'].style.width=`${rules.health/MAX_HEALTH*100}%`;ui['integrity-meter'].style.width=`${rules.integrity}%`;
  ui.shells.textContent=rules.shells;ui.reserve.textContent=rules.reserve;
  $('shell-row').querySelectorAll('i').forEach((el,i)=>el.classList.toggle('empty',i>=rules.shells));
  ui['reload-label'].textContent=rules.reloading?'RELOADING…':rules.shells===0?'EMPTY':'SHELLS';ui.crosshair.classList.toggle('reloading',rules.reloading);
  ui['enemies-left'].textContent=rules.phase==='combat'?`${enemies.activeCount+rules.enemiesRemaining} HOSTILES REMAINING`:rules.phase==='intermission'?'STORE SECURED · RESUPPLY':'SHIFT COMPLETE';
  const banner=mode==='playing'&&(rules.phase==='intermission'||announceClock>0);show(ui['wave-banner'],banner);
  if(banner){
    if(rules.phase==='intermission'){ui['banner-label'].textContent=rules.wave===0?'THE DOORS ARE STILL OPEN':'A MOMENT TO BREATHE';ui['banner-title'].innerHTML=`NEXT WAVE IN <b>${String(Math.ceil(rules.countdown)).padStart(2,'0')}</b>s`;ui['banner-detail'].textContent='Reload. Restock. Keep the lights on.';}
    else{ui['banner-label'].textContent=rules.wave===rules.campaignWaves?'THE LAST LESSON':'LISTEN & LEARN';ui['banner-title'].textContent=`WAVE ${String(rules.wave).padStart(2,'0')}`;ui['banner-detail'].textContent=rules.wave===rules.campaignWaves?'Make it to dawn.':'Defeat enemies to discover words.';}
  }
  const near=mode==='playing'&&Math.hypot(camera.position.x-supplyPosition.x,camera.position.z-supplyPosition.z)<2.05;
  show(ui.interaction,near&&rules.phase==='intermission'&&!rules.supplyUsed);
  supplyVisual.group.visible=rules.phase==='intermission'&&!rules.supplyUsed||mode==='menu';
}

function frame(now){
  requestAnimationFrame(frame);const raw=(now-lastFrame)/1000,dt=Math.min(.05,Math.max(0,raw));lastFrame=now;
  if(mode==='playing'){
    worldTime+=dt;updatePlayer(dt);
    for(const event of rules.tick(dt,enemies.activeCount))handleEvent(event);
    if(mode==='playing'){
      enemies.update(dt,worldTime,camera.position);environment.setIntegrity(rules.integrity);
      effects.update(dt,worldTime,camera.position,kind=>{rules.addPickup(kind);audio.pickup();toast(kind==='health'?'+10 HEALTH':'+6 RESERVE SHELLS',1.7);});
      if(firing&&rules.shotClock<=0)shoot();
      if(learning.settings.autoReload&&rules.shells===0&&rules.reserve>0&&rules.shotClock<=0&&!rules.reloading)reload();
      if(pumpClock>=0){pumpClock-=dt;if(pumpClock<0)audio.pump();}
      announceClock=Math.max(0,announceClock-dt);hitClock=Math.max(0,hitClock-dt);killClock=Math.max(0,killClock-dt);hurtClock=Math.max(0,hurtClock-dt);toastClock=Math.max(0,toastClock-dt);
      ui.hitmarker.style.opacity=hitClock>0?'1':'0';ui['kill-note'].style.opacity=killClock>0?'1':'0';ui['damage-flash'].style.opacity=String(hurtClock/.45);ui.toast.style.opacity=toastClock>0?'1':'0';
      if(rules.shotClock<.66)ui.crosshair.classList.remove('firing');
      weapon.update(dt,worldTime,{moving,sprinting,aiming,reloading:rules.reloading,reloadPhase:rules.reloadPhase});
      audio.update(dt,Math.min(1,enemies.activeCount/12));
      if(now-lastHud>90){updateHud();lastHud=now;}
      if(rules.over)finish(rules.phase==='won');
    }
  }else if(mode==='menu'){
    worldTime+=dt;camera.position.set(1.8+Math.sin(worldTime*.1)*.13,1.72,6.5);camera.rotation.set(.025,.115+Math.sin(worldTime*.11)*.014,0,'YXZ');
  }
  if(mode==='playing'||mode==='menu'){environment.update(dt,worldTime);supplyVisual.label.rotation.y=Math.atan2(camera.position.x-supplyPosition.x,camera.position.z-supplyPosition.z);supplyVisual.light.intensity=.5+Math.sin(worldTime*2)*.1;}
  renderer.render(scene,camera);
  // Automatic quality reduction only after sustained slow frames, never during boot.
  if(mode==='playing'&&quality==='auto'&&raw<.15){frameSum+=raw;frames++;if(frames>=150){if(frameSum/frames>.034)slowFrames++;else slowFrames=0;frameSum=frames=0;if(slowFrames>=2){quality='low';$('quality').value='low';renderer.shadowMap.enabled=false;resize();slowFrames=0;}}}
}
