/* MATTERHORN — NEON STREAM
   Entry point. Everything, including Three.js and the DEM, is bundled into the
   final HTML. This file owns input, the fixed-step simulation, UI and rendering. */
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {LENGTH,center,halfWidth,tangent,groundHeight,sectionAt,makeGates,clamp,mix} from './course.js';
import {createSkier,stepSkier,crossGates,flowSteer} from './physics.js';
import {buildTerrain,PEAK,terrainGlow} from './terrain.js';
import {buildSky,buildCourse,buildDetails,addLights,CYAN,PINK,setNeonGlow} from './world.js';
import {createPOV} from './pov.js';
import {createSnow,createSpray,createTracks} from './particles.js';
import {MountainAudio} from './audio.js';
import {LearningUI} from './learning-ui.js';
import {makeChallenge,crossChallenge,nextDanger} from './challenges.js';
import {buildObstacles} from './obstacles.js';
import {bindGameTap,bindRunLifecycle} from './game-interaction.js';

const $=id=>document.getElementById(id),storage={get(k){try{return localStorage.getItem('neon-stream:'+k);}catch{return null;}},set(k,v){try{localStorage.setItem('neon-stream:'+k,v);}catch{}}};
const ui={speed:$('speed'),alt:$('altitude'),air:$('airtime'),timer:$('timer'),gates:$('gates-made'),section:$('section'),stream:$('stream'),progress:$('progress'),score:$('score'),toast:$('toast'),airTag:$('air-tag')};
let mode='menu',skier=createSkier(),gates=makeGates(),hits=0,score=0,stream=1,bestStream=1,chain=0;
let simTime=0,visualTime=0,accumulator=0,lastFrame=0,toastUntil=0,shake=0,hudClock=0,sectionName='',nextGate=null,ready=false;
let quality=storage.get('quality')||((matchMedia('(pointer:coarse)').matches||navigator.deviceMemory<6)?'low':'high');
let reduced=storage.get('motion')==='1',rideAssist=storage.get('ride')!=='sport';
const audio=new MountainAudio();audio.enabled=storage.get('audio')!=='0';
const keys=new Set(),input={steer:0,brake:false,tuck:false,hop:false},touch={steer:0,brake:false,hop:false},drag={active:false,x:0,id:null},buttonSteer=new Map();
let renderer,composer,bloom,camera,scene,cinematic,lights,pov,snow,spray,tracks,gateObjects,sky;
let frameNumber=0,flash=0,learning=null,courseEnvironment=null,finishPortal=null;
let glow=clamp(Number(storage.get('glow')||.35),.15,1);
let difficulty=storage.get('challenge')==='expert'?'expert':'alpine',challenge={obstacles:[],shards:[]},hazardObjects=null;
let obstacleClears=0,obstacleHits=0,daring=0;
const map=$('map'),mctx=map.getContext('2d');
function setMode(next){mode=next;document.body.dataset.mode=next;clearInput();$('menu').hidden=next!=='menu';$('pause-menu').hidden=next!=='paused';$('finish-menu').hidden=next!=='finish';$('pause').ariaLabel=next==='paused'?'Resume skiing':'Pause skiing';}
function clearInput(){
 const pointer=drag.id;drag.active=false;drag.id=null;keys.clear();touch.steer=0;touch.brake=touch.hop=false;buttonSteer.clear();input.steer=0;input.brake=input.tuck=input.hop=false;
 if(pointer!=null)try{renderer?.domElement.releasePointerCapture(pointer);}catch{}
 $('steer-knob').style.transform='';for(const id of ['left','right','brake','hop'])$(id).classList.remove('held');
}
function toast(text,tone='cyan',seconds=1.6){ui.toast.textContent=text;ui.toast.dataset.tone=tone;ui.toast.classList.add('show');toastUntil=visualTime+seconds;}
function reset(){
 const run=learning?.prepare();
 gateObjects.dispose();gates=run?run.gates:makeGates(difficulty);gateObjects=buildCourse(scene,gates,{environment:false});setNeonGlow(glow);finishPortal?.setFinish(run?.finishAt??LENGTH,!!run,run?{text:run.text,translation:learning.showTranslations?run.translation:''}:null);
 hazardObjects?.dispose();challenge=makeChallenge(gates,{finishAt:run?.finishAt??LENGTH,learning:!!run,difficulty});hazardObjects=buildObstacles(scene,challenge);obstacleClears=obstacleHits=daring=0;
 skier=createSkier();if(run){skier.vs=Math.min(skier.vs,run.maxSpeed*.85);skier.vx=0;}
hits=score=chain=0;stream=bestStream=1;simTime=accumulator=0;sectionName='';shake=0;gates.forEach(g=>{g.hit=g.missed=false;});
 gateObjects.forEach(o=>{o.left.color.copy(o.baseLeft);o.left.emissive.copy(o.baseLeft);o.right.color.copy(o.baseRight);o.right.emissive.copy(o.baseRight);o.left.emissiveIntensity=o.right.emissiveIntensity=5.6*glow;o.root.visible=true;o.footprint.material.opacity=(o.gate.kind==='flag'?.09:.22)*.45;o.hitTime=-100;});
 spray.clear();tracks.clear();ui.airTag.classList.remove('show');ui.toast.classList.remove('show');nextGate=gates[0];flash=0;updateHUD();
}
async function startRun(){if(!ready)return;reset();setMode('playing');audio.start();learning?.startGesture();toast(learning?.run?'WORDS REPEAT  /  PAUSE REPEAT TO MUTE':'CARVE THE GATES  /  TAKE THE KICKERS', 'cyan',2.1);requestWake();}
function pause(){if(mode==='playing'){setMode('paused');learning?.suspend(true);$('resume').focus();}else if(mode==='paused'){setMode('playing');learning?.suspend(false);audio.start();requestWake();}}
function finish(){
 setMode('finish');$('result-time').textContent=formatTime(skier.elapsed);$('result-gates').textContent=`${hits} / ${gates.length}`;
 $('result-speed').textContent=`${Math.round(skier.topSpeed*3.6)}`;$('result-air').textContent=`${skier.bestAir.toFixed(2)} s`;
 $('result-score').textContent=score.toLocaleString();$('result-stream').textContent=`${bestStream.toFixed(2)}×`;
 $('challenge-result').textContent=`${obstacleClears} CLEAN CHICANES · ${obstacleHits} NET HITS · ${daring} CLOSE CARVES`;
 const old=Number(storage.get('best')||0);if(score>old){storage.set('best',score);$('finish-note').textContent='A NEW PERSONAL BEST';}else $('finish-note').textContent='THE MOUNTAIN WILL BE HERE. GO AGAIN.';
 if(learning?.run)learning.finish();else{audio.chime(6);$('finish-learning').hidden=true;$('finish-location').textContent='SCHWARZSEE / 2,583 M';$('finish-title').textContent='What a line.';$('again').firstChild.textContent='ANOTHER RUN ';$('repeat-run').hidden=true;$('again').focus({preventScroll:true});}
}
async function requestWake(){try{if(navigator.wakeLock)await navigator.wakeLock.request('screen');}catch{}}
function formatTime(t){const m=Math.floor(t/60),s=Math.floor(t%60),h=Math.floor((t%1)*100);return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(h).padStart(2,'0')}`;}
function updateHUD(){
 ui.speed.textContent=Math.round(mode==='menu'?0:skier.speed*3.6);ui.alt.textContent=Math.round(skier.y).toLocaleString('en-US');ui.air.textContent=(skier.grounded?skier.bestAir:skier.air).toFixed(2);
 ui.timer.textContent=formatTime(skier.elapsed);ui.gates.textContent=`${String(hits).padStart(2,'0')} / ${gates.length}`;ui.stream.textContent=stream.toFixed(2);ui.score.textContent=score.toLocaleString();ui.progress.style.width=`${Math.min(100,skier.s/(learning?.run?.finishAt??LENGTH)*100)}%`;
 const sec=sectionAt(skier.s);ui.section.textContent=sec.name;
 if(sec.name!==sectionName){if(sectionName&&mode==='playing')toast(`${sec.name.toUpperCase()}  /  ${sec.hint}`,'cyan',2.6);sectionName=sec.name;}
 ui.airTag.classList.toggle('show',!skier.grounded&&mode==='playing');$('air-live').textContent=skier.air.toFixed(2);$('air-caption').textContent=skier.grounded?'BEST AIR':'AIR TIME';
 $('next-distance').textContent=nextGate?`${Math.max(0,Math.round(nextGate.s-skier.s))} m`:'FINISH';
 const danger=mode==='playing'?nextDanger(challenge,skier,simTime):null;$('hazard-alert').hidden=!danger;
 if(danger)$('hazard-alert').textContent=`${danger.side<0?'→ CARVE RIGHT':'← CARVE LEFT'}  ·  ${Math.round(danger.s-skier.s)} M`;
 drawMap();
}
function drawMap(){
 const c=mctx,d=map.width,R=d*.46,cx=d/2,cy=d/2;c.clearRect(0,0,d,d);c.save();c.translate(cx,cy);
 c.strokeStyle='rgba(161,196,230,.15)';c.lineWidth=1;for(const r of [R*.43,R*.73,R]){c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();}
 for(let i=0;i<24;i++){const a=i/24*Math.PI*2;c.beginPath();c.moveTo(Math.sin(a)*(R-3),-Math.cos(a)*(R-3));c.lineTo(Math.sin(a)*(R-(i%6===0?10:5)),-Math.cos(a)*(R-(i%6===0?10:5)));c.stroke();}
 // Local route ahead, rotated with the skier. The summit arrow remains geographic.
 const heading=Math.atan2(skier.vx,Math.max(1,skier.vs));c.save();c.rotate(heading);c.beginPath();
 for(let i=0;i<28;i++){const s=skier.s+i*10,x=(center(s)-skier.x)*.45,y=-i*10*.18+R*.6;if(i===0)c.moveTo(x,y);else c.lineTo(x,y);}c.strokeStyle='rgba(59,231,246,.8)';c.lineWidth=2.2;c.stroke();
 for(const g of gates)if(!g.hit&&!g.missed&&g.s>skier.s&&g.s-skier.s<290){c.beginPath();c.arc((g.x-skier.x)*.45,-(g.s-skier.s)*.18+R*.6,2.8,0,Math.PI*2);c.fillStyle='#f485e4';c.fill();}c.restore();
 const bearing=Math.atan2(PEAK.x-skier.x,-PEAK.z-skier.s)-heading;c.save();c.rotate(bearing);c.beginPath();c.moveTo(0,-R+11);c.lineTo(-5,-R+21);c.lineTo(5,-R+21);c.closePath();c.fillStyle='#ffd2a0';c.fill();c.restore();
 c.beginPath();c.moveTo(0,-6);c.lineTo(-4,5);c.lineTo(0,3);c.lineTo(4,5);c.closePath();c.fillStyle='#eaf9ff';c.fill();c.restore();
 $('compass-bearing').textContent=`${Math.round((bearing*180/Math.PI+360)%360)}°`;
}
function events(list){for(const e of list){
 if(e.type==='boost'){toast('BOOST  /  TAKE THE KICKER','lime',1.15);flash=0;if(!learning?.run)audio.boost?.();}
 else if(e.type==='gate'){
  learning?.pass(e.gate);hits++;chain++;stream=Math.min(8,1+chain*.25);bestStream=Math.max(bestStream,stream);const earned=Math.round((e.gate.kind==='ring'?350:150)*stream);score+=earned;
  const o=gateObjects[e.gate.index];o.hitTime=visualTime;flash=0;o.left.color.set(0x78ffda);o.left.emissive.set(0x78ffda);o.right.color.set(0x78ffda);o.right.emissive.set(0x78ffda);o.left.emissiveIntensity=o.right.emissiveIntensity=1.2*glow;o.footprint.material.opacity=.05;
  toast(e.gate.kind==='ring'?`THROUGH THE RING   +${earned}`:`STREAM ×${stream.toFixed(2)}   +${earned}`);if(!learning?.run)audio.chime(stream);ui.stream.parentElement.classList.remove('pulse');void ui.stream.offsetWidth;ui.stream.parentElement.classList.add('pulse');
 }else if(e.type==='obstacle-hit'){obstacleHits++;chain=0;stream=1;shake=.14;score=Math.max(0,score-150);toast('OBSTACLE HIT  /  −150','pink');audio.impact();spray.burst(skier,65,8);}
 else if(e.type==='obstacle-clear'){obstacleClears++;}
 else if(e.type==='near-miss'||e.type==='obstacle-jump'){obstacleClears++;daring++;const bonus=Math.round((e.type==='obstacle-jump'?280:180)*stream);score+=bonus;toast(`${e.type==='obstacle-jump'?'CLEAN AIR':'CLOSE CARVE'}  +${bonus}`,'lime');}
 else if(e.type==='miss'){chain=0;stream=1;toast('GATE MISSED  /  FIND YOUR LINE','pink');}
 else if(e.type==='barrier'){chain=0;stream=1;shake=.11;toast('EDGE HIT  /  STREAM RESET','pink');audio.impact();}
 else if(e.type==='takeoff'){if(e.ramp)toast('TAKE FLIGHT','cyan',1.1);}
 else if(e.type==='land'){shake=Math.min(.07,e.impact*.003);spray.burst(skier,100,e.impact);if(e.air>.6){const bonus=Math.round(e.air*100*stream);score+=bonus;toast(`CLEAN LANDING  /  ${e.air.toFixed(2)} s AIR   +${bonus}`);}}
 else if(e.type==='finish')finish();
}}
function readInput(){
 const button=Array.from(buttonSteer.values()).reduce((a,b)=>a+b,0);
 input.steer=clamp((keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+touch.steer+button,-1,1);
 if(rideAssist&&Math.abs(input.steer)<.035)input.steer=flowSteer(skier,gates);
 input.maxSpeed=learning?.run?.maxSpeed;input.finishAt=learning?.run?.finishAt;input.learningPace=!!learning?.run;
 input.brake=touch.brake||keys.has('Space')||keys.has('ArrowDown')||keys.has('KeyS');input.tuck=keys.has('KeyW')||keys.has('ArrowUp')||keys.has('ShiftLeft');input.hop=touch.hop||keys.has('KeyJ');
}
function simulate(dt){
 readInput();accumulator+=dt;
 while(accumulator>=1/120&&mode==='playing'){
  const previous=skier.s;events(stepSkier(skier,input,1/120));simTime+=1/120;events(crossChallenge(challenge,skier,previous,simTime));events(crossGates(gates,skier,previous));accumulator-=1/120;
 }
 nextGate=gates.find(g=>!g.hit&&!g.missed&&g.s>=skier.s)||null;
 tracks.update(skier,simTime);
}
function updateCamera(dt){
 const active=mode==='playing',yaw=-Math.atan2(skier.vx,Math.max(4,skier.vs))*.60;
 const ahead=22,gy=groundHeight(skier.x+tangent(skier.s)*ahead,skier.s+ahead);
 let pitch=clamp(Math.atan2(gy-groundHeight(skier.x,skier.s),ahead)*.72-.012,-.27,.065);
 if(mode==='menu')pitch=-.135;
 if(!skier.grounded)pitch=mix(pitch,-.055-clamp(skier.vy/20,-1,1)*.035,.68);
 const motion=reduced?.25:1,lean=-skier.steer*.115*motion,bob=active&&skier.grounded?Math.sin(skier.s*2.9)*.012*skier.speed/30*motion:0;
 camera.position.set(skier.x+(Math.random()-.5)*shake*motion,skier.y+1.72+bob+(Math.random()-.5)*shake*motion,-skier.s);
 camera.rotation.order='YXZ';const damp=1-Math.exp(-dt*7);
 camera.rotation.x=mix(camera.rotation.x,pitch,damp);camera.rotation.y=mix(camera.rotation.y,yaw,damp);camera.rotation.z=mix(camera.rotation.z,lean,damp);
 const targetFov=mode==='menu'?72:72+(clamp((skier.speed-10)*.39,0,11)+(skier.boostTime>0?3.5:0))*motion;
 camera.fov=mix(camera.fov,targetFov,1-Math.exp(-dt*3));camera.updateProjectionMatrix();shake*=Math.exp(-dt*8);
 pov.update(skier,visualTime,camera.aspect);
 sky.sky.position.copy(camera.position);sky.star.position.copy(camera.position);
}
function animate(ms){
 requestAnimationFrame(animate);const dt=Math.min(.05,lastFrame?(ms-lastFrame)/1000:1/60);lastFrame=ms;
 if(document.hidden)return;visualTime+=dt;
 if(mode==='playing')simulate(dt);
 updateCamera(dt);snow.update(visualTime,camera,renderer.getPixelRatio());spray.update(skier,mode==='playing'?dt:0,renderer.getPixelRatio());
 lights.update(skier,nextGate,glow);audio.update(skier,mode==='playing',learning?.run&&!learning.speech.userPaused&&!!learning.speech.active);
 cinematic.uniforms.uTime.value=visualTime;cinematic.uniforms.uSpeed.value=mode==='playing'&&!reduced?clamp(skier.speed/42,0,1):0;
 cinematic.uniforms.uBoost.value=mode==='playing'&&!reduced?Math.min(1,skier.boostTime*1.5):0;cinematic.uniforms.uFlash.value=0;flash*=Math.exp(-dt*8);
 document.body.classList.toggle('boosting',skier.boostTime>0&&mode==='playing');
 if(visualTime>toastUntil)ui.toast.classList.remove('show');
 // Static course props are culled by distance, keeping phone draw calls bounded.
 courseEnvironment.update(visualTime,skier,glow);gateObjects.update(visualTime,skier,glow,learning?.showTranslations??true);
 hazardObjects?.update(simTime,skier,glow);
 finishPortal?.update(skier,!nextGate);
 frameNumber++;if(frameNumber%(quality==='low'?6:2)===0)renderer.shadowMap.needsUpdate=true;
 hudClock+=dt;if(hudClock>.075){updateHUD();hudClock=0;}
 composer.render(dt);
}
function resize(){if(!renderer)return;const w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();composer.setSize(w,h);cinematic.uniforms.uResolution.value.set(w*renderer.getPixelRatio(),h*renderer.getPixelRatio());}
function setQuality(q){
 quality=q;storage.set('quality',q);document.querySelectorAll('[data-quality]').forEach(b=>{const on=b.dataset.quality===q;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on);});
 if(!renderer)return;renderer.setPixelRatio(q==='low'?Math.min(devicePixelRatio,1):Math.min(devicePixelRatio,1.65));
 renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
 lights.sun.shadow.mapSize.set(q==='low'?1024:2048,q==='low'?1024:2048);
 if(lights.sun.shadow.map){lights.sun.shadow.map.dispose();lights.sun.shadow.map=null;}
 snow.setQuality(q==='low');applyGlow();
 composer.setPixelRatio(renderer.getPixelRatio());resize();
}
function applyGlow(){
 terrainGlow.value=glow;setNeonGlow(glow);
 if(bloom){bloom.strength=(quality==='low'?1.23:1.42)*glow;bloom.radius=.46;bloom.threshold=1.40;}
 document.querySelectorAll('[data-glow]').forEach(e=>e.value=Math.round(glow*100));document.querySelectorAll('[data-glow-value]').forEach(e=>e.textContent=Math.round(glow*100)+'%');
}
function bindControls(){
 $('start').addEventListener('click',startRun);$('again').addEventListener('click',()=>{learning?.next();startRun();});$('repeat-run').addEventListener('click',startRun);$('restart').addEventListener('click',startRun);$('resume').addEventListener('click',pause);
 bindGameTap($('pause'),pause,{canTap:()=>!drag.active});
 $('quit').addEventListener('click',()=>{reset();learning?.stop();setMode('menu');});
 $('free-ski').addEventListener('click',()=>{learning.setEnabled(!learning.enabled);startRun();});
 document.querySelectorAll('[data-glow]').forEach(e=>e.addEventListener('input',()=>{glow=clamp(Number(e.value)/100,.15,1);storage.set('glow',glow);applyGlow();}));
 bindGameTap($('sound'),()=>{audio.toggle();storage.set('audio',audio.enabled?'1':'0');updateSettings();},{canTap:()=>!drag.active});
 $('motion').addEventListener('click',()=>{reduced=!reduced;storage.set('motion',reduced?'1':'0');updateSettings();});
 document.querySelectorAll('[data-quality]').forEach(b=>b.addEventListener('click',()=>setQuality(b.dataset.quality)));
 document.querySelectorAll('[data-ride]').forEach(b=>b.addEventListener('click',()=>{rideAssist=b.dataset.ride==='flow';storage.set('ride',rideAssist?'flow':'sport');updateSettings();}));
 document.querySelectorAll('[data-challenge]').forEach(b=>b.addEventListener('click',()=>{difficulty=b.dataset.challenge;storage.set('challenge',difficulty);updateSettings();}));
 bindGameTap($('fullscreen'),async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('Use landscape for a wider view');}catch{toast('Use landscape for a wider view');}},{canTap:()=>!drag.active});
 const gameplayKeys=['KeyA','KeyD','ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Space','KeyW','KeyS','KeyJ','ShiftLeft'];
 addEventListener('keydown',e=>{
  if(learning?.editorOpen||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName||'')){if(e.code==='Escape'&&learning?.editorOpen)learning.close();return;}
  if(gameplayKeys.includes(e.code)&&mode==='playing'){e.preventDefault();keys.add(e.code);}
  if(!e.repeat&&(e.code==='Escape'||e.code==='KeyP'))pause();
  if(!e.repeat&&e.code==='Enter'&&(mode==='menu'||mode==='finish')&&e.target===document.body){if(mode==='finish')learning?.next();startRun();}
  if(!e.repeat&&e.code==='KeyR'&&mode!=='menu')startRun();
  if(!e.repeat&&e.code==='KeyV'&&mode==='playing'&&learning?.run)learning.toggleRepeat();
 });addEventListener('keyup',e=>keys.delete(e.code));
 renderer.domElement.addEventListener('pointerdown',e=>{if(mode!=='playing'||drag.active||(e.button!=null&&e.button!==0))return;e.preventDefault();learning?.speech.gesture();drag.active=true;drag.x=e.clientX;drag.id=e.pointerId;renderer.domElement.setPointerCapture(e.pointerId);});
 renderer.domElement.addEventListener('pointermove',e=>{if(drag.active&&e.pointerId===drag.id){touch.steer=clamp((e.clientX-drag.x)/Math.min(150,innerWidth*.25),-1,1);$('steer-knob').style.transform=`translateX(${touch.steer*35}px)`;}});
 const endDrag=e=>{if(e.pointerId===drag.id){drag.active=false;drag.id=null;touch.steer=0;$('steer-knob').style.transform='';if(e.type==='pointerup')learning?.speech.gesture();}};
 renderer.domElement.addEventListener('pointerup',endDrag);renderer.domElement.addEventListener('pointercancel',endDrag);renderer.domElement.addEventListener('lostpointercapture',endDrag);
 for(const id of ['left','right','brake','hop']){
  const b=$(id);b.addEventListener('pointerdown',e=>{if(mode!=='playing')return;e.preventDefault();b.setPointerCapture(e.pointerId);b.classList.add('held');if(id==='left'||id==='right')buttonSteer.set(e.pointerId,id==='left'?-1:1);else touch[id]=true;});
  const up=e=>{buttonSteer.delete(e.pointerId);if(id==='brake'||id==='hop')touch[id]=false;b.classList.remove('held');if(e.type==='pointerup')learning?.speech.gesture();};b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up);
 }
 bindRunLifecycle({isPlaying:()=>mode==='playing',clearInput,suspendSpeech:()=>learning?.suspend(true),resumeSpeech:()=>learning?.suspend(false),recoverSpeech:()=>learning?.speech.recover()});addEventListener('resize',resize);
 renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();if(mode==='playing')pause();$('error').hidden=false;$('error-text').textContent='The graphics context was interrupted. Reload this page to return to the mountain.';});
}
function updateSettings(){
 document.querySelectorAll('[data-challenge]').forEach(b=>{const on=b.dataset.challenge===difficulty;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on);});
 document.querySelectorAll('[data-ride]').forEach(b=>{const on=b.dataset.ride===(rideAssist?'flow':'sport');b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on);});
 $('sound').textContent=audio.enabled?'SFX ON':'SFX OFF';$('sound').setAttribute('aria-pressed',audio.enabled);$('motion').textContent=reduced?'CAMERA: CALM':'CAMERA: DYNAMIC';$('motion').setAttribute('aria-pressed',reduced);
}
// Batch stationary detail meshes by material. Moving gates and POV stay separate.
function batchDetails(group){
 group.updateMatrixWorld(true);const buckets=new Map();
 group.traverse(o=>{if(o.userData.dynamicFinish||o.parent?.userData.dynamicFinish)return;if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material))return;const k=o.material.uuid;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(o);});
 for(const objects of buckets.values()){
  if(objects.length<3)continue;
  // Spatial chunks preserve useful frustum culling and bounded shadow work.
  const chunks=new Map();for(const o of objects){const p=new THREE.Vector3().setFromMatrixPosition(o.matrixWorld),k=`${Math.floor(p.x/250)},${Math.floor(p.z/250)}`;if(!chunks.has(k))chunks.set(k,[]);chunks.get(k).push(o);}
  for(const chunk of chunks.values()){
   if(chunk.length<2)continue;const gs=chunk.map(o=>{const g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);if(g.index)g.setIndex(g.index.clone());return g;});
   let merged;try{merged=mergeGeometries(gs,false);}catch{merged=null;}if(!merged){gs.forEach(g=>g.dispose());continue;}
   const m=new THREE.Mesh(merged,chunk[0].material);m.castShadow=chunk.some(o=>o.castShadow);m.receiveShadow=true;group.add(m);chunk.forEach(o=>o.removeFromParent());gs.forEach(g=>g.dispose());
  }
 }
}
async function init(){
 try{
  renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance',alpha:false});renderer.domElement.id='world';renderer.domElement.setAttribute('aria-label','First-person neon ski run. Use A and D or drag to steer.');$('viewport').appendChild(renderer.domElement);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.86;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x355665,.000038);camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.065,45000);scene.add(camera);camera.rotation.order='YXZ';camera.rotation.x=-.135;
  $('load-status').textContent='SCULPTING THE SNOW';await new Promise(requestAnimationFrame);
  buildTerrain(scene);sky=buildSky(scene);courseEnvironment=buildCourse(scene,[]);gateObjects=buildCourse(scene,gates,{environment:false});
  const details=new THREE.Group();scene.add(details);finishPortal=buildDetails(details);batchDetails(details);
  lights=addLights(scene);pov=createPOV(camera);snow=createSnow(scene);spray=createSpray(scene);tracks=createTracks(scene);nextGate=gates[0];
  composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
  bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),1,.6,1.12);composer.addPass(bloom);
  cinematic=new ShaderPass({uniforms:{tDiffuse:{value:null},uTime:{value:0},uSpeed:{value:0},uBoost:{value:0},uFlash:{value:0},uResolution:{value:new THREE.Vector2(innerWidth,innerHeight)}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime;uniform float uSpeed;uniform float uBoost;uniform float uFlash;uniform vec2 uResolution;varying vec2 vUv;
 void main(){vec2 d=vUv-.5;float edge=smoothstep(.18,.69,length(d));vec2 shift=d*dot(d,d)*(uSpeed*.0012+uBoost*.0018);vec3 c=texture2D(tDiffuse,vUv).rgb;
 vec3 rush=(texture2D(tDiffuse,vUv-d*.0035*uBoost).rgb+texture2D(tDiffuse,vUv-d*.007*uBoost).rgb)*.5;c=mix(c,rush,edge*uBoost*.24);
 c.r=mix(c.r,texture2D(tDiffuse,vUv+shift).r,.7);c.b=mix(c.b,texture2D(tDiffuse,vUv-shift).b,.7);
 c*=1.-edge*.15;c+=mix(vec3(.01,.18,.22),vec3(.14,.01,.12),vUv.x)*edge*edge*uBoost*.16;
 c+=vec3(.14,.62,.67)*uFlash;float grain=fract(sin(dot(vUv*uResolution+uTime,vec2(12.9898,78.233)))*43758.5453)-.5;c+=grain*.0024;gl_FragColor=vec4(c,1.);}
`});composer.addPass(cinematic);composer.addPass(new OutputPass());
  learning=new LearningUI({mode:()=>mode,pause,apply:startRun,canControl:()=>!drag.active});setQuality(quality);bindControls();updateSettings();updateCamera(1);updateHUD();ready=true;setMode('menu');$('loader').hidden=true;$('start').disabled=false;
  // The source is fully inspectable; this read-only summary helps integrations.
  window.NeonStream={version:'6.0.0',getState:()=>({mode,section:sectionAt(skier.s).name,speedKmh:skier.speed*3.6,altitude:skier.y,distance:skier.s,gates:hits,totalGates:gates.length,stream,score,difficulty,obstacleClears,obstacleHits,repeatPaused:learning?.speech.userPaused,pronunciation:learning?.speech.status})};
  window.GoLingoSki={loadLesson(data){learning.importText(typeof data==='string'?data:JSON.stringify(data,null,2));learning.open();}};
  requestAnimationFrame(animate);
 }catch(e){$('loader').hidden=true;$('error').hidden=false;$('error-text').textContent=`The mountain could not start: ${e.message}. Use a current browser with WebGL 2 enabled.`;console.error(e);}
}
init();
