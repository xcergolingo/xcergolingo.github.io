import * as THREE from './vendor/three.module.js';
import {createWorld, createAircraft} from './world.js?v=5';
import {AIRCRAFT, FlightModel} from './flight.js?v=8';
import {LearningEngine} from './learning.js';
import {CAMERA_VIEWS, CAMERA_IDS, ONBOARD_CAMERA_IDS, FlightCameraRig, createAirfieldEnvironment} from './cameras.js?v=7';
import {createGateWordLabel} from './gate-labels.js?v=8';
import {isVirtualLandscape, gameSize, pointerInElement, rectInGame} from './layout.js?v=1';

const $ = id => document.getElementById(id);
const shell = $('game-shell');
const size = () => gameSize(shell);
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const clockText = s => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
const safeLoad = (key,fallback) => {try{return JSON.parse(localStorage.getItem(key)) ?? fallback;}catch{return fallback;}};
const safeSave = (key,value) => {try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
const saved = safeLoad('skyfield-settings-v1',{});
const settings = {aircraft:'trainer',mode:'learn',assisted:true,launch:'air',wind:0,light:'golden',repeat:true,translation:true,sentence:true,muted:false,pitchControl:'pull',fullView:true,camera:'ground',groundZoom:'auto',onboardEnabled:true,onboardCamera:'cockpit',...saved};
// Language learning is the starting activity on every visit, including for
// returning players who previously chose another mode. They can still switch
// to Free flight or Ring run from the hangar during this session.
settings.mode='learn';
// Existing players get both requested perspectives on their first visit after
// this update. Keep their previous onboard choice in the new small window.
if(!Object.prototype.hasOwnProperty.call(saved,'onboardEnabled')){
  if(ONBOARD_CAMERA_IDS.includes(settings.camera))settings.onboardCamera=settings.camera;
  settings.camera='ground';
}
if(!AIRCRAFT[settings.aircraft]) settings.aircraft='trainer';
if(!['free','rings','learn'].includes(settings.mode)) settings.mode='learn';
settings.wind=clamp(Number(settings.wind)||0,0,5);
if(!['pull','push'].includes(settings.pitchControl))settings.pitchControl='pull';
settings.fullView=settings.fullView!==false;
if(!['air','runway'].includes(settings.launch))settings.launch='air';
if(!CAMERA_IDS.includes(settings.camera))settings.camera='ground';
settings.groundZoom=settings.groundZoom==='wide'?'wide':'auto';
settings.onboardEnabled=settings.onboardEnabled!==false;
if(!ONBOARD_CAMERA_IDS.includes(settings.onboardCamera))settings.onboardCamera='cockpit';
let screen='hangar', paused=false, activeMode=settings.mode;
let modalReturn='hangar', elapsed=0, gateCount=0, totalGates=12, sceneTime=0;
let toastTimeout, statusTimeout, hintTimeout, cameraSnap=true, hadLanding=0, resizePause=false;
let aircraft, world, scene, camera, cameraRig, onboardCamera, onboardRig, renderer, model, learning;
let onboardSnap=true,onboardViewportRect=null;
let brakeHeld=false,brakeKeyHeld=false,brakePointer=null;
let lastLearningWords=null,lastDataRevision=0;
let rings=[], ringGroup, lastPosition=new THREE.Vector3();
const keys=new Set(), stick={x:0,y:0,pointer:null}, input={roll:0,pitch:0,yaw:0,throttle:.44,brake:false,gear:1};
const AIRCRAFT_ORDER=['trainer','sport','glider','jet','f16','yak130','rare-bear','f15','falcon'];
const AIRCRAFT_COPY={
  trainer:['Steady, friendly, and ready for your first flight.','EASY TO FLY','01 / SCOUT','HIGH-WING TRAINER · ELECTRIC'],
  sport:['A little quicker. A little bolder. Yours to explore.','FEEL THE FREEDOM','02 / SWIFT','LOW-WING SPORT PLANE · ELECTRIC'],
  glider:['Long wings. Quiet moments. Follow the breeze.','TAKE IT SLOW','03 / DRIFT','LONG-WING SAILPLANE · MOTOR ASSIST'],
  jet:['Smooth turbine power, sweeping turns, and a detailed cockpit.','SILVER JET','04 / SILVER JET','TWIN-TAIL JET · FIXED GEAR'],
  f16:['A crisp roll, a rising turbine note, and a fast Viper pass.','VIPER DEMO','05 / F-16 VIPER','SINGLE-ENGINE JET · RETRACTABLE GEAR'],
  yak130:['A steadier twin-engine jet for learning the approach.','JET TRAINER','06 / YAK-130','TWIN-ENGINE TRAINER · RETRACTABLE GEAR'],
  'rare-bear':['Purple racing colors, lively banks, and long smooth lines.','SPORT RACER','07 / RARE BEAR 77','RC SPORT JET · RETRACTABLE GEAR'],
  f15:['Twin engines, broad wings, and a powerful climb.','TWIN-ENGINE POWER','08 / F-15 EAGLE','TWIN-TAIL JET · RETRACTABLE GEAR'],
  falcon:['Black and electric yellow. Quick, precise, and ready to fly.','SPORT JET','09 / FALCON','SWEPT-WING JET · RETRACTABLE GEAR']
};
const route=[
  [0,26,40],[0,29,-65],[25,33,-175],[105,39,-260],
  [225,43,-260],[325,46,-185],[355,43,-60],[310,37,65],
  [215,31,155],[90,27,175],[20,26,145],[0,26,95]
].map(v=>new THREE.Vector3(...v));
const vA=new THREE.Vector3(),vB=new THREE.Vector3(),vC=new THREE.Vector3();
const map=$('minimap').getContext('2d');
let audioContext,engineOsc,engineHarmonic,engineGain,windGain,jetNoiseGain,jetFilter,jetWhine,jetWhineGain,audioReady=false;
const smokeMax=80,smokeData=new Float32Array(smokeMax*3);let smokeLine, smokeTick=0,particles=[];

function toast(message){
  $('toast').textContent=message;$('toast').classList.add('visible');
  clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').classList.remove('visible'),3300);
}
function status(message){$('statusMessage').textContent=message;$('statusMessage').classList.remove('hidden');clearTimeout(statusTimeout);statusTimeout=setTimeout(()=>$('statusMessage').classList.add('hidden'),2300);}
function hint(message,seconds=10){$('hint').textContent=message;$('hint').style.opacity='1';clearTimeout(hintTimeout);hintTimeout=setTimeout(()=>$('hint').style.opacity='0',seconds*1000);}

function initAudio(){
  if(audioReady){audioContext?.resume().catch(()=>{});return;}
  try{
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    audioContext=new AC();engineGain=audioContext.createGain();engineGain.gain.value=0;engineGain.connect(audioContext.destination);
    engineOsc=audioContext.createOscillator();engineOsc.type='triangle';engineOsc.frequency.value=70;engineOsc.connect(engineGain);engineOsc.start();
    engineHarmonic=audioContext.createOscillator();engineHarmonic.type='sine';engineHarmonic.frequency.value=140;const overtone=audioContext.createGain();overtone.gain.value=.22;engineHarmonic.connect(overtone);overtone.connect(engineGain);engineHarmonic.start();
    const b=audioContext.createBuffer(1,audioContext.sampleRate*2,audioContext.sampleRate),data=b.getChannelData(0);let brown=0;
    for(let i=0;i<data.length;i++){brown=(brown+Math.random()*.04-.02)/1.02;data[i]=brown*3;}
    const noise=audioContext.createBufferSource();noise.buffer=b;noise.loop=true;windGain=audioContext.createGain();windGain.gain.value=0;noise.connect(windGain);windGain.connect(audioContext.destination);noise.start();
    // A separate filtered turbine rush and whine follow actual engine spool,
    // so the sound builds and winds down with thrust instead of jumping with the lever.
    const jetBuffer=audioContext.createBuffer(1,audioContext.sampleRate*2,audioContext.sampleRate),jetData=jetBuffer.getChannelData(0);
    for(let i=0;i<jetData.length;i++)jetData[i]=(Math.random()*2-1)*.65;
    const jetNoise=audioContext.createBufferSource();jetNoise.buffer=jetBuffer;jetNoise.loop=true;
    jetFilter=audioContext.createBiquadFilter();jetFilter.type='lowpass';jetFilter.frequency.value=480;jetFilter.Q.value=.55;
    jetNoiseGain=audioContext.createGain();jetNoiseGain.gain.value=0;jetNoise.connect(jetFilter);jetFilter.connect(jetNoiseGain);jetNoiseGain.connect(audioContext.destination);jetNoise.start();
    jetWhine=audioContext.createOscillator();jetWhine.type='sine';jetWhine.frequency.value=700;jetWhineGain=audioContext.createGain();jetWhineGain.gain.value=0;jetWhine.connect(jetWhineGain);jetWhineGain.connect(audioContext.destination);jetWhine.start();
    audioReady=true;audioContext.resume().catch(()=>{});
  }catch{/* Flying remains available if browser audio is unavailable. */}
}
function updateAudio(){
  if(!audioReady)return;
  const on=screen==='flight'&&!paused&&!resizePause&&!settings.muted;
  const t=audioContext.currentTime;
  const jet=model?.config.propulsion==='jet',power=jet?clamp(model.enginePower||0,0,1):input.throttle;
  const voice=({jet:.94,f16:1.08,yak130:.87,'rare-bear':1.13,f15:.79,falcon:1.18})[settings.aircraft]||1;
  let distanceMix=1,doppler=1;
  if(jet&&settings.camera==='ground'&&camera&&aircraft){
    const dx=aircraft.position.x-camera.position.x,dy=aircraft.position.y-camera.position.y,dz=aircraft.position.z-camera.position.z;
    const distance=Math.max(1,Math.hypot(dx,dy,dz));
    const radialSpeed=(model.velocity.x*dx+model.velocity.y*dy+model.velocity.z*dz)/distance;
    distanceMix=clamp(80/(distance+30),.15,1);
    doppler=clamp(343/(343+radialSpeed),.82,1.18);
  }
  // Keep engines quieter in Word flight, so the spoken vocabulary stays clear.
  const speechMix=activeMode==='learn' ? .55 : 1;
  const baseFrequency=jet?(65+power*105)*voice*doppler:44+power*115;
  engineGain.gain.setTargetAtTime(on?((jet ? .004 : .012)+power*(jet ? .014 : .024))*speechMix*distanceMix:0,t,.12);
  engineOsc.frequency.setTargetAtTime(baseFrequency,t,.18);
  engineHarmonic.frequency.setTargetAtTime(baseFrequency*(jet?1.5:2),t,.18);
  jetNoiseGain.gain.setTargetAtTime(on&&jet?(.009+power**1.5*.105)*speechMix*distanceMix:0,t,.2);
  jetFilter.frequency.setTargetAtTime((480+power*2800)*doppler,t,.24);
  jetWhine.frequency.setTargetAtTime((680+power*1850)*voice*doppler,t,.22);
  jetWhineGain.gain.setTargetAtTime(on&&jet?(.0015+power*.006)*speechMix*distanceMix:0,t,.18);
  const windLevel=jet&&settings.camera==='ground'?.006+settings.wind*.003:Math.min(.10,(model?.airspeed||0)*.0016);
  windGain.gain.setTargetAtTime(on?windLevel*speechMix:0,t,.2);
}
function chime(){
  if(!audioReady||settings.muted)return;
  const t=audioContext.currentTime;
  for(const [f,offset] of [[660,0],[880,.11]]){
    const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0,t+offset);g.gain.linearRampToValueAtTime(.045,t+offset+.014);g.gain.exponentialRampToValueAtTime(.001,t+offset+.35);o.connect(g);g.connect(audioContext.destination);o.start(t+offset);o.stop(t+offset+.4);
  }
}

function syncLearning(state){
  const listChanged=lastLearningWords!==null&&lastLearningWords!==state.words;
  const imported=state.dataRevision>lastDataRevision;
  lastLearningWords=state.words;lastDataRevision=state.dataRevision||0;
  if(imported){settings.mode='learn';activeMode='learn';syncSetup();if(screen==='flight'&&!paused&&!resizePause)queueMicrotask(()=>learning?.setActive(true));}
  if(listChanged&&activeMode==='learn'&&screen==='flight'){gateCount=0;totalGates=state.words.length;updateGates();}
  const current=state.current;
  $('currentWord').textContent=current?.word||'Ready to learn';
  $('currentWord').title=current?.word||'';
  $('currentTranslation').textContent=current?.translation||'';
  $('currentTranslation').title=current?.translation||'';
  $('currentTranslation').classList.toggle('hidden',!settings.translation);
  const names={es:'ESPAÑOL',ja:'日本語',zh:'中文',fr:'FRANÇAIS',en:'ENGLISH'};
  const code=state.learningLanguage.split('-')[0];
  $('languageLabel').textContent=names[code]||state.learningLanguage.toUpperCase();
  $('wordProgress').textContent=`${state.collected.length} / ${state.words.length}`;
  [...$('languageSelect').options].filter(o=>o.dataset.imported&&o.value!==state.learningLanguage).forEach(o=>o.remove());
  if(![...$('languageSelect').options].some(o=>o.value===state.learningLanguage)){
    const option=document.createElement('option');option.value=state.learningLanguage;option.dataset.imported='true';option.textContent=`${state.learningLanguage} · Imported language`;$('languageSelect').append(option);
  }
  $('languageSelect').value=state.learningLanguage;
  if(activeMode==='learn')drawGateLabel();
}

function initialize(){
  scene=new THREE.Scene();
  const {width,height}=size();
  camera=new THREE.PerspectiveCamera(47,width/height,.12,6500);
  cameraRig=new FlightCameraRig(camera);
  onboardCamera=new THREE.PerspectiveCamera(70,16/9,.025,6500);
  onboardRig=new FlightCameraRig(onboardCamera);
  renderer=new THREE.WebGLRenderer({canvas:$('world'),antialias:true,powerPreference:'high-performance',alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,width<1000?1.6:1.8));
  renderer.setSize(width,height,false);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene.environment=createAirfieldEnvironment();
  world=createWorld(scene);world.setTimeOfDay?.(settings.light);
  model=new FlightModel({aircraft:settings.aircraft,assisted:settings.assisted,wind:settings.wind});
  makeAircraft(settings.aircraft);buildCourse();
  learning=new LearningEngine({onChange:syncLearning,onToast:toast});
  const incomingHash=new URLSearchParams(location.hash.slice(1));
  if(new URLSearchParams(location.search).has('data')||incomingHash.has('data')||incomingHash.has('golingoLesson')){settings.mode='learn';activeMode='learn';}
  learning.setRepeat(settings.repeat);learning.setMuted(settings.muted);syncLearning(learning.state);
  buildTrail();bindUI();syncSetup();updateMenuCamera(0);renderer.render(scene,camera);
  window.skyfieldReady=true;$('loading').classList.add('hidden');$('loadError').classList.add('hidden');$('flyButton').disabled=false;$('flyButton').innerHTML='Start flight <span>↗</span>';
  requestAnimationFrame(frame);
}

function disposeMesh(root){
  const geometries=new Set(),materials=new Set(),textures=new Set();
  root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>{for(const key of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','alphaMap','aoMap'])if(m[key])textures.add(m[key]);m.dispose();});
  textures.forEach(t=>t.dispose());
}
function makeAircraft(type){
  cameraRig?.restoreVisibility();onboardRig?.restoreVisibility();onboardSnap=true;
  if(aircraft){scene.remove(aircraft);disposeMesh(aircraft);}
  aircraft=createAircraft(type);scene.add(aircraft);aircraft.position.set(0,aircraft.userData.groundClearance||.61,100);aircraft.rotation.set(0,0,0);
}

function buildCourse(){
  ringGroup=new THREE.Group();scene.add(ringGroup);
  const geometry=new THREE.TorusGeometry(15,.26,8,72);
  const dashGeo=new THREE.TorusGeometry(15.7,.045,4,64);
  route.forEach((p,i)=>{
    const group=new THREE.Group();group.position.copy(p);
    const prev=i===0?new THREE.Vector3(0,26,120):route[i-1];
    const normal=p.clone().sub(prev).normalize();group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
    const mat=new THREE.MeshStandardMaterial({color:0xefc576,emissive:0x815020,emissiveIntensity:.28,roughness:.35,metalness:.3});
    group.add(new THREE.Mesh(geometry,mat));
    group.add(new THREE.Mesh(dashGeo,new THREE.MeshBasicMaterial({color:0xf9efc5,transparent:true,opacity:.6})));
    for(let k=0;k<4;k++){const peg=new THREE.Mesh(new THREE.BoxGeometry(.45,1.5,.7),new THREE.MeshStandardMaterial({color:0xf5f0d7,roughness:.7}));const a=k*Math.PI/2;peg.position.set(Math.cos(a)*15,Math.sin(a)*15,0);peg.rotation.z=a-Math.PI/2;group.add(peg);}
    const wordLabel=createGateWordLabel();wordLabel.sprite.position.copy(p);wordLabel.sprite.visible=false;scene.add(wordLabel.sprite);
    ringGroup.add(group);rings.push({group,normal,mat,position:p,wordLabel});
  });
  ringGroup.visible=false;
}
function drawGateLabel(){
  if(!learning)return;
  const enabled=screen==='flight'&&activeMode!=='free';
  const remaining=Math.max(0,totalGates-gateCount);
  rings.forEach((r,i)=>{
    const offset=(i-gateCount%rings.length+rings.length)%rings.length;
    const visible=enabled&&offset<3&&offset<remaining;
    r.wordLabel.sprite.visible=visible;
    if(!visible)return;
    const word=activeMode==='learn'?learning.words[(learning.index+offset)%learning.words.length]:null;
    r.wordLabel.update({word:word?.word||`GATE ${gateCount+offset+1}`,translation:word?.translation||'',showTranslation:activeMode==='learn'&&settings.translation,active:offset===0});
    r.wordLabel.sprite.position.copy(r.position);
  });
}
function updateGates(){
  const enabled=activeMode!=='free'&&screen==='flight';
  const remaining=Math.max(0,totalGates-gateCount);
  ringGroup.visible=enabled&&remaining>0;$('targetMarker').classList.toggle('hidden',!enabled||remaining===0);
  rings.forEach((r,i)=>{
    const offset=(i-gateCount%route.length+route.length)%route.length;
    r.group.visible=offset<3&&offset<remaining;r.mat.color.set(offset===0?0xefc576:0xe1ead7);r.mat.emissiveIntensity=offset===0?.32:.05;
    r.group.scale.setScalar(offset===0?1:.97);
  });
  drawGateLabel();
  $('missionLabel').textContent=activeMode==='free'?'THE SKY IS YOURS':activeMode==='rings'?'FIND YOUR LINE':'WORDS WITH WINGS';
  $('missionProgress').textContent=activeMode==='free'?'Enjoy the flight':`${gateCount} / ${totalGates} ${activeMode==='learn'?'words':'gates'}`;
  syncFlightModeLabel();
  $('wordCard').classList.toggle('hidden',activeMode!=='learn');
}
function buildTrail(){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(smokeData,3));
  smokeLine=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xfff4d5,transparent:true,opacity:.24,depthWrite:false}));
  smokeLine.frustumCulled=false;smokeLine.visible=false;scene.add(smokeLine);
}
function resetTrail(){for(let i=0;i<smokeMax;i++){smokeData[i*3]=model.position.x;smokeData[i*3+1]=model.position.y;smokeData[i*3+2]=model.position.z;}smokeLine.geometry.attributes.position.needsUpdate=true;}
function burst(point){
  const n=34,data=new Float32Array(n*3),velocities=[];
  for(let i=0;i<n;i++){data.set([point.x,point.y,point.z],i*3);velocities.push(new THREE.Vector3((Math.random()-.5)*10,(Math.random()-.5)*10,(Math.random()-.5)*10));}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(data,3));
  const m=new THREE.PointsMaterial({color:0xffefb3,size:.4,transparent:true,opacity:1,depthWrite:false});
  const mesh=new THREE.Points(g,m);scene.add(mesh);particles.push({mesh,velocities,age:0});
}

function revealSelectedAircraft(smooth=false){
  if(screen!=='hangar')return;
  const rail=document.querySelector('.aircraft-picker'),card=rail?.querySelector(`[data-plane="${settings.aircraft}"]`);
  if(!rail||!card||!rail.clientWidth)return;
  const railRect=rail.getBoundingClientRect(),cardRect=card.getBoundingClientRect();
  const start=isVirtualLandscape()?'top':'left',end=isVirtualLandscape()?'bottom':'right';
  let left=rail.scrollLeft;
  if(cardRect[start]<railRect[start]+2)left+=cardRect[start]-railRect[start]-2;
  else if(cardRect[end]>railRect[end]-2)left+=cardRect[end]-railRect[end]+2;
  if(Math.abs(left-rail.scrollLeft)>.5)rail.scrollTo({left,behavior:smooth?'smooth':'auto'});
}
function chooseAircraft(id){
  if(!AIRCRAFT[id]||screen!=='hangar')return;
  if(settings.aircraft!==id){settings.aircraft=id;model.setAircraft(id);makeAircraft(id);cameraSnap=true;}
  syncSetup();revealSelectedAircraft(true);
}
function stepAircraft(direction){
  chooseAircraft(AIRCRAFT_ORDER[(AIRCRAFT_ORDER.indexOf(settings.aircraft)+direction+AIRCRAFT_ORDER.length)%AIRCRAFT_ORDER.length]);
}
function syncSetup(){
  document.querySelectorAll('[data-plane]').forEach(b=>{const on=b.dataset.plane===settings.aircraft;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on);});
  document.querySelectorAll('[data-mode]').forEach(b=>{const on=b.dataset.mode===settings.mode;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on);});
  document.querySelectorAll('[data-launch]').forEach(b=>{const on=b.dataset.launch===settings.launch;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on);});
  const copy=AIRCRAFT_COPY[settings.aircraft];
  ['aircraftDescription','aircraftBadge','planeNumber','planeSpec'].forEach((id,i)=>$(id).textContent=copy[i]);
  $('aircraftPosition').textContent=`${AIRCRAFT_ORDER.indexOf(settings.aircraft)+1} / ${AIRCRAFT_ORDER.length}`;
  $('assistSelect').value=settings.assisted?'assisted':'manual';$('launchSelect').value=settings.launch;$('windSelect').value=String(settings.wind);$('lightSelect').value=settings.light;
  $('pitchSelect').value=settings.pitchControl;
  $('cameraSelect').value=settings.camera;
  $('repeatCheckbox').checked=settings.repeat;$('translationCheckbox').checked=settings.translation;$('sentenceCheckbox').checked=settings.sentence;
  $('launchNote').textContent=`${CAMERA_VIEWS.find(v=>v.id===settings.camera).label} view · ${settings.assisted?'Easy flying':'Acro flying'} · ${settings.launch==='air'?'Air launch':'Runway takeoff'}`;
  $('retryButton').innerHTML=settings.launch==='runway'?'Back to runway <span>↗</span>':'Back in the air <span>↗</span>';
  $('soundButton').textContent=settings.muted?'♪̸':'♫';$('soundButton').setAttribute('aria-label',settings.muted?'Enable sound':'Mute sound');
  syncPitchControls();syncFlightView();syncCameraUI();syncAerobaticUI();syncFullscreenUI();
  safeSave('skyfield-settings-v1',settings);
  revealSelectedAircraft();
}

function syncPitchControls(){
  const pull=settings.pitchControl==='pull';
  const up=pull?'lower':'raise',down=pull?'raise':'lower';
  $('stickPad').setAttribute('aria-label',`Flight stick. Pull down to ${down} the nose, push up to ${up} the nose, left or right to bank.`);
  $('pitchTouchHelp').textContent=pull?'Pull down to raise the nose; push up to lower it.':'Push up to raise the nose; pull down to lower it.';
  $('pitchKeyboardHelp').textContent=pull?'S / ↓ raise the nose · W / ↑ lower the nose':'W / ↑ raise the nose · S / ↓ lower the nose';
  $('pitchUpLabel').textContent=pull?'DESCEND':'CLIMB';
  $('pitchDownLabel').textContent=pull?'CLIMB':'DESCEND';
  $('hint').textContent=pull?'Pull the right control down gently to raise the nose.':'Push the right control up gently to raise the nose.';
}

function syncFlightView(){
  document.body.classList.toggle('full-view',settings.fullView);
  $('fullViewLabel').textContent='Info';
  $('fullViewButton').setAttribute('aria-pressed',String(settings.fullView));
  $('fullViewButton').setAttribute('aria-label',settings.fullView?'Show flight information. Words stay inside the rings.':'Hide flight information. Words stay inside the rings.');
  $('fullViewButton').title=settings.fullView?'Show instruments (H)':'Hide instruments (H)';
}

function toggleFullView(){
  settings.fullView=!settings.fullView;syncFlightView();safeSave('skyfield-settings-v1',settings);
}

function syncFlightModeLabel(){
  const view=CAMERA_VIEWS.find(v=>v.id===settings.camera);
  $('flightModeLabel').textContent={free:'FREE FLIGHT',rings:'RING RUN',learn:'WORD FLIGHT'}[activeMode]+` · ${view.short.toUpperCase()} VIEW`;
}
function syncCameraUI(){
  const view=CAMERA_VIEWS.find(v=>v.id===settings.camera);
  $('cameraLabel').textContent=view.short;
  $('cameraButton').setAttribute('aria-label',`Camera views. Main view: ${view.label}. Choose the main view or show the small onboard camera.`);
  $('cameraSelect').value=settings.camera;
  $('launchCameraSelect').value=settings.camera;
  document.querySelectorAll('[data-camera]').forEach(b=>{const on=b.dataset.camera===settings.camera;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});
  $('groundZoomButton').classList.toggle('hidden',settings.camera!=='ground');
  $('groundZoomLabel').textContent=settings.groundZoom==='wide'?'Wide view':'Auto zoom';
  $('groundZoomButton').setAttribute('aria-pressed',String(settings.groundZoom==='wide'));
  syncFlightModeLabel();syncOnboardUI();
}
function syncOnboardUI(){
  const visible=screen==='flight'&&settings.onboardEnabled&&!resizePause;
  const view=CAMERA_VIEWS.find(v=>v.id===settings.onboardCamera);
  $('onboardPreview').classList.toggle('hidden',!visible);
  $('onboardPreview').setAttribute('aria-label',`Small onboard camera: ${view.label}`);
  $('flightHUD').classList.toggle('has-onboard-view',visible);
  $('onboardCameraSelect').value=settings.onboardCamera;
  $('onboardSettingsSelect').value=settings.onboardEnabled?settings.onboardCamera:'off';
  $('onboardToggle').setAttribute('aria-pressed',String(settings.onboardEnabled));
  $('onboardToggle').setAttribute('aria-label',`${settings.onboardEnabled?'Hide':'Show'} small onboard camera`);
  $('onboardToggleLabel').textContent=settings.onboardEnabled?'On':'Off';
  onboardViewportRect=null;
}
function setOnboardEnabled(enabled){
  settings.onboardEnabled=Boolean(enabled);onboardSnap=true;
  syncOnboardUI();safeSave('skyfield-settings-v1',settings);
  if(screen==='flight')updateOnboardCamera(0);
}
function setOnboardCamera(id){
  if(!ONBOARD_CAMERA_IDS.includes(id))return;
  settings.onboardCamera=id;setOnboardEnabled(true);
}
function cycleOnboardCamera(direction){
  const index=(ONBOARD_CAMERA_IDS.indexOf(settings.onboardCamera)+direction+ONBOARD_CAMERA_IDS.length)%ONBOARD_CAMERA_IDS.length;
  setOnboardCamera(ONBOARD_CAMERA_IDS[index]);
}
function syncAerobaticUI(){
  $('aeroLabel').textContent=settings.assisted?'Easy':'Acro';
  $('aeroButton').setAttribute('aria-pressed',String(!settings.assisted));
  $('aeroButton').setAttribute('aria-label',settings.assisted?'Enable Acro flying for full rolls and loops':'Enable Easy flying with self-leveling');
  $('aeroButton').title=settings.assisted?'Easy flying · tap for full rolls and loops (M)':'Acro flying · tap for self-leveling (M)';
  $('assistSelect').value=settings.assisted?'assisted':'manual';
}
function toggleAerobatic(){
  settings.assisted=!settings.assisted;model.assisted=settings.assisted;
  syncAerobaticUI();safeSave('skyfield-settings-v1',settings);
  toast(settings.assisted?'Easy flying · self-leveling on':'Acro flying · hold left/right to roll; pull down to loop');
}
function isFullscreen(){return Boolean(document.fullscreenElement||document.webkitFullscreenElement);}
function isStandalone(){return Boolean(window.navigator?.standalone||window.matchMedia?.('(display-mode: fullscreen)')?.matches||window.matchMedia?.('(display-mode: standalone)')?.matches);}
function syncFullscreenUI(){
  const full=isFullscreen(),standalone=isStandalone();
  $('fullscreenLabel').textContent=full?'Exit screen':'Full screen';
  $('fullscreenButton').setAttribute('aria-pressed',String(full||standalone));
  $('fullscreenButton').setAttribute('aria-label',full?'Exit fullscreen':standalone?'Game already fills the app screen':'Enter fullscreen');
  $('fullscreenButton').title=full?'Exit fullscreen (F)':standalone?'Already using the full app screen':'Use the full screen (F)';
}
function showFullscreenNotice(){
  let embedded=false;try{embedded=window.self!==window.top;}catch{embedded=true;}
  $('fullscreenNoticeText').textContent=embedded?'This app frame blocks fullscreen. Open the game on its own.':'Fullscreen is unavailable in this browser. On iPhone, open in Safari, then use Share → Add to Home Screen and launch Skyfield.';
  $('fullscreenOpen').classList.toggle('hidden',!embedded);
  $('fullscreenNotice').classList.remove('hidden');
  $('flightHUD').classList.add('fullscreen-notice-open');
}
function closeFullscreenNotice(){
  $('fullscreenNotice').classList.add('hidden');
  $('flightHUD').classList.remove('fullscreen-notice-open');
}
async function toggleFullscreen(){
  closeCameraPanel();closeFullscreenNotice();
  try{
    if(!isFullscreen()&&isStandalone()){toast('Already using the full app screen.');return;}
    if(isFullscreen()){
      const exit=document.exitFullscreen||document.webkitExitFullscreen;
      if(exit)await exit.call(document);
    }else{
      const root=document.documentElement;
      if(root.requestFullscreen&&document.fullscreenEnabled!==false)await root.requestFullscreen({navigationUI:'hide'});
      else if(!root.requestFullscreen&&root.webkitRequestFullscreen&&document.webkitFullscreenEnabled!==false)await root.webkitRequestFullscreen();
      else{showFullscreenNotice();return;}
      if(screen==='flight')try{await screenOrientationLock();}catch{}
    }
  }catch{showFullscreenNotice();}
  finally{syncFullscreenUI();resize();}
}
function setFlightCamera(id){
  if(!CAMERA_IDS.includes(id))return;
  settings.camera=id;cameraSnap=true;syncCameraUI();safeSave('skyfield-settings-v1',settings);
  if(screen==='flight')updateCamera(0);
}
function cycleCamera(){setFlightCamera(CAMERA_IDS[(CAMERA_IDS.indexOf(settings.camera)+1)%CAMERA_IDS.length]);closeCameraPanel();}
function closeCameraPanel(){
  $('cameraPanel').classList.add('hidden');$('cameraButton').setAttribute('aria-expanded','false');
}
function toggleCameraPanel(){
  const open=$('cameraPanel').classList.contains('hidden');
  $('cameraPanel').classList.toggle('hidden',!open);$('cameraButton').setAttribute('aria-expanded',String(open));
  if(open)$('cameraPanel').querySelector(`[data-camera="${settings.camera}"]`)?.focus({preventScroll:true});
}
function syncJetControls(){
  const flying=screen==='flight',jet=model.config.propulsion==='jet';
  $('engineReadout').classList.toggle('hidden',!flying||!jet);
  $('engineValue').textContent=`${Math.round((model.enginePower||0)*100)}%`;
  const retractable=flying&&model.config.retractableGear&&!model.grounded&&!model.crashed;
  $('gearButton').classList.toggle('hidden',!retractable);
  $('gearButton').disabled=!retractable;
  const down=input.gear>.5,position=model.gearPosition??1;
  const moving=down?position<.99:position>.01;
  $('gearLabel').textContent=`${down?'DOWN':'UP'}${moving?'…':''}`;
  $('gearButton').setAttribute('aria-pressed',String(down));
  $('gearButton').setAttribute('aria-label',`${down?'Retract':'Lower'} landing gear. ${moving?'Gear moving':down?'Gear down':'Gear up'}`);
  $('gearButton').classList.toggle('moving',moving);
}
function toggleLandingGear(){
  if(screen!=='flight'||paused||resizePause||model.crashed||!model.config.retractableGear||model.grounded)return;
  input.gear=input.gear>.5?0:1;
  syncJetControls();
}
function syncGroundControls(){
  const grounded=screen==='flight'&&model.grounded&&!model.crashed;
  $('brakeButton').classList.toggle('hidden',!grounded);$('brakeButton').disabled=!grounded;
  $('brakeButton').setAttribute('aria-pressed',String(input.brake));
  const gearWarning=screen==='flight'&&!model.grounded&&!model.crashed&&model.config.retractableGear&&model.gearPosition<.99&&model.altitude<12&&model.verticalSpeed<-.35;
  $('takeoffCue').classList.toggle('hidden',!grounded&&!gearWarning);
  const rotation=settings.pitchControl==='pull'?'Pull down':'Push up';
  const spooling=model.config.propulsion==='jet'&&input.throttle>.2&&model.enginePower<input.throttle-.16;
  $('takeoffCue').textContent=gearWarning?'Lower gear to land':input.brake?'Brakes held':model.airspeed<model.config.takeoffSpeed*.9?(input.throttle<.1?'Add throttle to roll':spooling?'Turbine building power':'Build speed · keep straight'):`${rotation} to lift off`;
  syncJetControls();
}

function startFlight({forceAir=false}={}){
  hideModals();closeCameraPanel();closeFullscreenNotice();screen='flight';paused=false;activeMode=settings.mode;elapsed=0;gateCount=0;model.landings=0;hadLanding=0;
  window.scrollTo(0,0);
  if(model.aircraft!==settings.aircraft){model.setAircraft(settings.aircraft);makeAircraft(settings.aircraft);}
  model.assisted=settings.assisted;model.wind=settings.wind;
  model.reset({airborne:forceAir||settings.launch==='air'});
  input.throttle=model.throttle;input.gear=model.gearTarget??1;clearControls();setThrottle(input.throttle);
  document.body.classList.remove('in-hangar');document.body.classList.add('flying');$('hangar').classList.add('hidden');$('flightHUD').classList.remove('hidden');
  learning.setActive(false);learning.reset({shuffle:true});totalGates=activeMode==='learn'?learning.words.length:12;
  updateGates();initAudio();learning.setActive(activeMode==='learn');
  lastPosition.set(model.position.x,model.position.y,model.position.z);resetTrail();cameraSnap=true;onboardSnap=true;
  camera.clearViewOffset();resize();
  const help=model.grounded?(model.config.propulsion==='jet'?'Raise the throttle, let the turbine build power, then gently raise the nose.':'Add throttle, build speed, then gently raise the nose.'):activeMode==='free'?(model.config.retractableGear?'Use smooth banks. Lower the gear before landing.':model.config.propulsion==='jet'?'Use smooth banks and leave room for your approach.':'Steer gently. Choose a camera whenever you like.'):'Fly your plane through the gold ring to collect it.';
  $('statusMessage').classList.add('hidden');clearTimeout(statusTimeout);
  syncFlightView();syncCameraUI();syncAerobaticUI();hint(help,8);updateModelView();updateCamera(0);syncGroundControls();updateAudio();
  window.skyfieldOrientation?.request?.();
  try{const locked=screenOrientationLock();if(locked?.catch)locked.catch(()=>{});}catch{}
}
function screenOrientationLock(){return window.screen.orientation?.lock?.('landscape');}
function returnHangar(){
  screen='hangar';paused=false;hideModals();closeCameraPanel();closeFullscreenNotice();clearControls();cameraRig.restoreVisibility();onboardRig.restoreVisibility();learning.setActive(false);resizePause=false;
  window.scrollTo(0,0);
  document.body.classList.add('in-hangar');document.body.classList.remove('flying');$('hangar').classList.remove('hidden');$('flightHUD').classList.add('hidden');
  ringGroup.visible=false;rings.forEach(r=>r.wordLabel.sprite.visible=false);smokeLine.visible=false;aircraft.visible=true;aircraft.position.set(0,aircraft.userData.groundClearance||.61,100);aircraft.rotation.set(0,0,0);
  cameraSnap=true;onboardSnap=true;syncOnboardUI();resize();updateAudio();window.skyfieldOrientation?.request?.();
  revealSelectedAircraft();
  if(isFullscreen()){const exit=document.exitFullscreen||document.webkitExitFullscreen;try{Promise.resolve(exit?.call(document)).catch(()=>{});}catch{}}
}
function clearControls(){keys.clear();stick.x=0;stick.y=0;stick.pointer=null;brakeHeld=false;brakeKeyHeld=false;brakePointer=null;input.roll=0;input.pitch=0;input.yaw=0;input.brake=false;$('brakeButton').setAttribute('aria-pressed','false');$('stickKnob').style.transform='translate(0px,0px)';}
function setThrottle(v){input.throttle=clamp(v,0,1);const p=Math.round(input.throttle*100),t=1-input.throttle;$('throttleValue').textContent=p+'%';$('throttlePad').setAttribute('aria-valuenow',p);$('throttleKnob').style.top=`calc(${t*100}% + ${16-32*t}px)`;$('throttleFill').style.height=p+'%';}
function setPaused(value,show=true){
  if(screen!=='flight'||model.crashed)return;paused=value;clearControls();learning.setActive(!paused&&!resizePause&&activeMode==='learn');updateAudio();
  if(value&&show)showModal('pauseModal','flight');else if(!value)hideModals();
}
function hideModals(){$('modalLayer').classList.add('hidden');document.querySelectorAll('.modal').forEach(m=>m.classList.add('hidden'));}
function showModal(id,back){
  closeCameraPanel();
  modalReturn=back||(screen==='hangar'?'hangar':paused?'pause':'flight');
  if(screen==='flight'){paused=true;clearControls();learning.setActive(false);updateAudio();}
  hideModals();$('modalLayer').classList.remove('hidden');$(id).classList.remove('hidden');
  setTimeout(()=>$(id).querySelector('button,select')?.focus({preventScroll:true}),0);
}
function closeModal(){
  if(modalReturn==='pause'){showModal('pauseModal','flight');return;}
  hideModals();if(modalReturn==='flight')setPaused(false,false);
}

function bindUI(){
  document.querySelector('.wordmark').addEventListener('click',e=>{e.preventDefault();returnHangar();});
  document.querySelectorAll('[data-plane]').forEach(b=>b.addEventListener('click',()=>chooseAircraft(b.dataset.plane)));
  $('aircraftPrev').onclick=()=>stepAircraft(-1);$('aircraftNext').onclick=()=>stepAircraft(1);
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{settings.mode=b.dataset.mode;activeMode=settings.mode;syncSetup();}));
  document.querySelectorAll('[data-launch]').forEach(b=>b.addEventListener('click',()=>{settings.launch=b.dataset.launch;syncSetup();}));
  $('flyButton').addEventListener('click',()=>startFlight());
  $('launchCameraSelect').addEventListener('change',()=>{setFlightCamera($('launchCameraSelect').value);syncSetup();});
  $('setupButton').onclick=()=>showModal('settingsModal','hangar');$('pauseSettings').onclick=()=>showModal('settingsModal','pause');
  $('helpMenu').onclick=()=>showModal('helpModal','hangar');$('helpFlight').onclick=()=>showModal('helpModal',paused?'pause':'flight');
  $('helpDone').onclick=closeModal;document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
  $('pauseButton').onclick=()=>setPaused(true);$('resumeButton').onclick=()=>setPaused(false);
  $('pauseReset').onclick=()=>startFlight();
  $('backHangar').onclick=returnHangar;$('crashHangar').onclick=returnHangar;$('returnButton').onclick=returnHangar;
  $('retryButton').onclick=()=>startFlight();$('resetButton').onclick=()=>{startFlight();toast('A fresh start. The sky is yours.');};
  $('againButton').onclick=()=>startFlight();$('continueButton').onclick=()=>{activeMode='free';updateGates();setPaused(false);};
  $('cameraButton').onclick=toggleCameraPanel;
  $('onboardToggle').onclick=()=>setOnboardEnabled(!settings.onboardEnabled);
  $('onboardClose').onclick=()=>{setOnboardEnabled(false);$('cameraButton').focus({preventScroll:true});};
  $('onboardCameraSelect').addEventListener('change',()=>{setOnboardCamera($('onboardCameraSelect').value);$('cameraButton').focus({preventScroll:true});});
  $('onboardPrev').onclick=()=>cycleOnboardCamera(-1);
  $('onboardNext').onclick=()=>cycleOnboardCamera(1);
  $('aeroButton').onclick=toggleAerobatic;
  $('fullscreenButton').onclick=toggleFullscreen;
  $('fullscreenNoticeClose').onclick=()=>{closeFullscreenNotice();$('fullscreenButton').focus({preventScroll:true});};
  $('gearButton').onclick=toggleLandingGear;
  $('cameraClose').onclick=()=>{closeCameraPanel();$('cameraButton').focus({preventScroll:true});};
  $('groundZoomButton').onclick=toggleControllerZoom;
  document.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>{setFlightCamera(b.dataset.camera);closeCameraPanel();$('cameraButton').focus({preventScroll:true});}));
  document.addEventListener('pointerdown',e=>{if(!$('cameraPanel').contains(e.target)&&!$('cameraButton').contains(e.target))closeCameraPanel();},true);
  $('fullViewButton').onclick=toggleFullView;
  $('soundButton').onclick=()=>{settings.muted=!settings.muted;initAudio();learning.setMuted(settings.muted);syncSetup();updateAudio();toast(settings.muted?'Sound off':'Sound on');};
  $('repeatWord').onclick=()=>{initAudio();learning.speakCurrent();};
  $('currentWord').onclick=()=>learning.speakCurrent();
  $('centerView').onclick=()=>{const d=Math.round(Math.hypot(model.position.x,model.position.z));const bearing=Math.atan2(-model.position.x,model.position.z);const relative=Math.atan2(Math.sin(bearing-model.yaw),Math.cos(bearing-model.yaw));hint(`Runway ${d} m away · ${Math.abs(relative)<.25?'straight ahead':relative>0?'turn right':'turn left'} · line up with the white centerline.`,9);};
  $('saveSettings').onclick=()=>{
    settings.assisted=$('assistSelect').value==='assisted';settings.launch=$('launchSelect').value;settings.wind=Number($('windSelect').value);settings.light=$('lightSelect').value;
    settings.pitchControl=$('pitchSelect').value==='push'?'push':'pull';
    const selectedOnboard=$('onboardSettingsSelect').value;
    setFlightCamera($('cameraSelect').value);
    if(selectedOnboard==='off')setOnboardEnabled(false);else setOnboardCamera(selectedOnboard);
    settings.repeat=$('repeatCheckbox').checked;settings.translation=$('translationCheckbox').checked;settings.sentence=$('sentenceCheckbox').checked;
    if($('languageSelect').value!==learning.learningLanguage){learning.setLanguage($('languageSelect').value);if(screen==='flight'&&activeMode==='learn'){gateCount=0;totalGates=learning.words.length;updateGates();}}
    learning.setRepeat(settings.repeat);world.setTimeOfDay?.(settings.light);syncLearning(learning.state);syncSetup();closeModal();toast('Flight settings saved.');
  };
  $('importButton').onclick=()=>{try{const r=learning.importText($('importText').value,{learningLanguage:$('languageSelect').value});if(r===false)return;$('importStatus').textContent=`${learning.words.length} words loaded. Word flight is selected.`;settings.mode='learn';if(screen==='flight'){activeMode='learn';gateCount=0;totalGates=learning.words.length;updateGates();}syncSetup();}catch(e){$('importStatus').textContent=e.message||'Please check the word list.';}};
  $('exportButton').onclick=()=>{
    const data=learning.exportData();if(!data.words.length){toast('Collect a word by flying through a Word flight ring first.');return;}
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='skyfield-golingo-words.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast(`${data.words.length} collected words exported.`);
  };
  const stickPad=$('stickPad');
  function moveStick(e){
    if(stick.pointer!==e.pointerId)return;e.preventDefault();
    const r=pointerInElement(e,stickPad,isVirtualLandscape()),range=r.width*.35;
    let x=(r.x-r.width/2)/range,y=(r.y-r.height/2)/range;
    const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}stick.x=Math.abs(x)<.035?0:x;stick.y=Math.abs(y)<.035?0:y;
    $('stickKnob').style.transform=`translate(${x*range}px,${y*range}px)`;
  }
  stickPad.addEventListener('pointerdown',e=>{if(paused)return;e.preventDefault();e.stopPropagation();stick.pointer=e.pointerId;stickPad.setPointerCapture(e.pointerId);moveStick(e);});
  stickPad.addEventListener('pointermove',moveStick);
  const releaseStick=e=>{if(e.pointerId!==stick.pointer)return;stick.pointer=null;stick.x=0;stick.y=0;$('stickKnob').style.transform='translate(0px,0px)';};
  ['pointerup','pointercancel','lostpointercapture'].forEach(n=>stickPad.addEventListener(n,releaseStick));
  const throttle=$('throttlePad');let throttlePointer=null;
  function moveThrottle(e){if(e.pointerId!==throttlePointer)return;e.preventDefault();const r=pointerInElement(e,throttle,isVirtualLandscape());setThrottle(1-(r.y-16)/(r.height-32));}
  throttle.addEventListener('pointerdown',e=>{if(paused)return;e.preventDefault();e.stopPropagation();throttlePointer=e.pointerId;throttle.setPointerCapture(e.pointerId);moveThrottle(e);});
  throttle.addEventListener('pointermove',moveThrottle);['pointerup','pointercancel','lostpointercapture'].forEach(n=>throttle.addEventListener(n,e=>{if(e.pointerId===throttlePointer)throttlePointer=null;}));
  throttle.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();e.stopPropagation();setThrottle(input.throttle+(e.key==='ArrowUp'?.05:-.05));}});
  const brake=$('brakeButton');
  brake.addEventListener('pointerdown',e=>{if(paused||!model.grounded)return;e.preventDefault();e.stopPropagation();brakePointer=e.pointerId;brakeHeld=true;brake.setPointerCapture(e.pointerId);brake.setAttribute('aria-pressed','true');});
  const releaseBrake=e=>{if(e.pointerId!==brakePointer)return;brakePointer=null;brakeHeld=false;brake.setAttribute('aria-pressed',String(brakeKeyHeld||keys.has(' ')));};
  ['pointerup','pointercancel','lostpointercapture'].forEach(n=>brake.addEventListener(n,releaseBrake));
  brake.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!paused&&model.grounded){e.preventDefault();e.stopPropagation();brakeKeyHeld=true;brake.setAttribute('aria-pressed','true');}});
  brake.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();brakeKeyHeld=false;brake.setAttribute('aria-pressed',String(brakeHeld));}});
  $('controls').addEventListener('contextmenu',e=>e.preventDefault());$('world').addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('keydown',e=>{
    if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
    if(e.key==='Escape'){
      if(!$('cameraPanel').classList.contains('hidden')){e.preventDefault();closeCameraPanel();$('cameraButton').focus({preventScroll:true});return;}
      e.preventDefault();if(!$('modalLayer').classList.contains('hidden')){if(!$('pauseModal').classList.contains('hidden'))setPaused(false);else if($('crashModal').classList.contains('hidden')&&$('completeModal').classList.contains('hidden'))closeModal();}else if(screen==='flight')setPaused(true);return;
    }
    if(screen!=='flight'||paused)return;
    const key=e.key.toLowerCase();if(['w','a','s','d','q','e','arrowup','arrowdown','arrowleft','arrowright',' ','=','+','-','_','c','r','h','g','m','f','[',']'].includes(key))e.preventDefault();
    keys.add(key);if(!e.repeat){if(key==='c')cycleCamera();if(key==='r')startFlight();if(key==='h')toggleFullView();if(key==='g')toggleLandingGear();if(key==='m')toggleAerobatic();if(key==='f')toggleFullscreen();if(key==='[')cycleOnboardCamera(-1);if(key===']')cycleOnboardCamera(1);}
  });
  window.addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());if(e.key===' '||e.key==='Enter'){brakeKeyHeld=false;brake.setAttribute('aria-pressed',String(brakeHeld));}});
  window.addEventListener('blur',()=>{clearControls();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&screen==='flight'&&!paused&&!model.crashed)setPaused(true);});
  window.addEventListener('resize',resize);
  window.visualViewport?.addEventListener('resize',resize);
  for(const event of ['fullscreenchange','webkitfullscreenchange'])document.addEventListener(event,()=>{syncFullscreenUI();resize();});
  $('world').addEventListener('webglcontextlost',e=>{e.preventDefault();if(screen==='flight')setPaused(true);toast('Graphics paused. Reload the game to reconnect.');});
  document.addEventListener('keydown',e=>{
    if(e.key!=='Tab'||$('modalLayer').classList.contains('hidden'))return;
    const modal=document.querySelector('.modal:not(.hidden)'),focusables=[...modal.querySelectorAll('button,select,input,textarea,summary')].filter(el=>el.offsetParent!==null);
    if(!focusables.length)return;const first=focusables[0],last=focusables.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  });
}

function toggleControllerZoom(){
  settings.groundZoom=settings.groundZoom==='auto'?'wide':'auto';syncCameraUI();safeSave('skyfield-settings-v1',settings);
}
function resize(){
  const {width,height}=size();
  camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);
  const portrait=height>width&&screen==='flight';
  if(portrait!==resizePause){resizePause=portrait;clearControls();learning?.setActive(!paused&&!resizePause&&screen==='flight'&&activeMode==='learn');updateAudio();}
  if(screen==='hangar')updateMenuCamera(0);else camera.clearViewOffset();cameraSnap=true;onboardSnap=true;
  syncOnboardUI();
  revealSelectedAircraft();
}
function updateMenuCamera(dt){
  aircraft.visible=true;aircraft.position.set(0,aircraft.userData.groundClearance||.61,100);aircraft.rotation.set(0,.04*Math.sin(sceneTime*.12),0);
  const {width,height}=size(),portrait=height>width;
  camera.fov=portrait?44:42;camera.near=.12;camera.up.set(0,1,0);
  const fit=Math.max(1,(aircraft.userData.length||2.7)/2.7,(aircraft.userData.span||3.45)/(portrait?3.25:4.1));
  const focusY=(aircraft.userData.groundClearance||.61)+.12;
  if(portrait){camera.clearViewOffset();camera.position.set(5*fit,focusY+1.85*fit,100-6.6*fit);camera.lookAt(0,focusY,100);camera.setViewOffset(width,height,0,height*.29,width,height);}
  else{const widthBias=width<1000?.21:.19;camera.position.set((5.7+Math.sin(sceneTime*.11)*.28)*fit,focusY+1.8*fit,100-6.8*fit);camera.lookAt(0,focusY,100);camera.setViewOffset(width,height,-width*widthBias,0,width,height);}
  camera.updateProjectionMatrix();
  const prop=aircraft.userData.propeller;if(prop)prop.rotation.z+=dt*5;
  aircraft.userData.animate?.(dt,{throttle:0,enginePower:0,speed:0,grounded:true,yaw:0,gear:1});
}
function updateModelView(dt=0){
  aircraft.position.set(model.position.x,model.position.y,model.position.z);aircraft.rotation.set(model.pitch,-model.yaw,-model.roll,'YXZ');aircraft.visible=true;
  if(aircraft.userData.controlSurfaces){
    const surfaces=aircraft.userData.controlSurfaces;
    if(surfaces.elevator)surfaces.elevator.rotation.x=-input.pitch*.3;
    if(surfaces.rudder)surfaces.rudder.rotation.y=-input.yaw*.3;
    if(surfaces.leftAileron)surfaces.leftAileron.rotation.x=-input.roll*.3;
    if(surfaces.rightAileron)surfaces.rightAileron.rotation.x=input.roll*.3;
    if(surfaces.leftElevon)surfaces.leftElevon.rotation.x=-input.pitch*.26-input.roll*.2;
    if(surfaces.rightElevon)surfaces.rightElevon.rotation.x=-input.pitch*.26+input.roll*.2;
  }
  aircraft.userData.animate?.(dt,{throttle:model.config.propulsion==='jet'?(model.enginePower||0):input.throttle,enginePower:model.enginePower??input.throttle,speed:model.groundSpeed,grounded:model.grounded,yaw:input.yaw+input.roll*.85,gear:model.gearPosition??1});
}
function updateCamera(dt){
  cameraRig.update(settings.camera,aircraft,model,dt,{snap:cameraSnap,zoom:settings.groundZoom,heightAt:world.heightAt});cameraSnap=false;
  updateOnboardCamera(dt);
}
function getOnboardViewport(){
  if(screen!=='flight'||!settings.onboardEnabled||resizePause)return null;
  if(!onboardViewportRect){
    const rect=rectInGame($('onboardViewport'),shell,isVirtualLandscape());
    if(rect.width<2||rect.height<2)return null;
    onboardViewportRect={x:rect.x,y:size().height-rect.y-rect.height,width:rect.width,height:rect.height};
  }
  return onboardViewportRect;
}
function updateOnboardCamera(dt){
  const rect=getOnboardViewport();if(!rect)return;
  onboardCamera.aspect=rect.width/rect.height;
  onboardRig.update(settings.onboardCamera,aircraft,model,dt,{snap:onboardSnap,heightAt:world.heightAt});
  onboardSnap=false;
}
function renderViews(){
  // Viewport/scissor use CSS pixels; Three.js applies the renderer pixel ratio.
  // Always restore the full canvas, including the first frame back in the hangar.
  const {width,height}=size();
  renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);
  if(screen==='flight')cameraRig.render(renderer,scene);else renderer.render(scene,camera);
  const rect=getOnboardViewport();if(!rect)return;
  const shadowAutoUpdate=renderer.shadowMap.autoUpdate;
  try{
    renderer.setViewport(rect.x,rect.y,rect.width,rect.height);
    renderer.setScissor(rect.x,rect.y,rect.width,rect.height);renderer.setScissorTest(true);
    // Reuse the main pass's shadow map. The inset clears color/depth only inside
    // its scissor rectangle, and its cockpit visibility is scoped to this pass.
    renderer.shadowMap.autoUpdate=false;
    onboardRig.render(renderer,scene);
  }finally{
    renderer.shadowMap.autoUpdate=shadowAutoUpdate;
    renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);
  }
}

function crossedGate(a,b,gate){
  const da=vA.copy(a).sub(gate.position).dot(gate.normal),db=vB.copy(b).sub(gate.position).dot(gate.normal);
  if(da*db>0||Math.abs(da-db)<.0001)return false;
  const t=da/(da-db);vC.copy(a).lerp(b,t).sub(gate.position);
  return vC.length()<14.8;
}
function onGate(){
  const gate=rings[gateCount%rings.length],oldWord=learning.current;burst(gate.position);chime();gateCount++;
  if(activeMode==='learn'&&gateCount>=totalGates)learning.setActive(false);
  if(activeMode==='learn')learning.next({collect:true,speakSentence:settings.sentence&&gateCount<totalGates});
  updateGates();
  status(activeMode==='learn'?`✓ Word collected · ${gateCount} / ${totalGates}`:gateCount===totalGates?'✓ Circuit complete':`✓ Gate ${gateCount} / ${totalGates}`);
  if(gateCount>=totalGates){
    const key=`skyfield-best-${settings.aircraft}-${activeMode}-${settings.assisted?'easy':'manual'}-${settings.wind}`;
    const old=safeLoad(key,null),best=old===null?elapsed:Math.min(old,elapsed);safeSave(key,best);
    $('completeTime').textContent=clockText(elapsed);$('bestTime').textContent=clockText(best);
    $('completeTitle').textContent=activeMode==='learn'?'Words with wings.':'Nicely flown.';
    $('completeText').textContent=activeMode==='learn'?`You collected ${totalGates} words. Your practice list is ready to export from Flight settings.`:`All ${totalGates} rings, one beautiful circuit. Ready for another?`;
    showModal('completeModal','flight');
    if(activeMode==='learn'&&settings.sentence)learning.speakSentence(oldWord);
  }
}
function crash(){
  $('crashDescription').textContent=model.crashReason||'A bumpy landing. Reset and try a gentler approach.';$('summaryTime').textContent=clockText(elapsed);$('summaryGates').textContent=gateCount;
  showModal('crashModal','flight');
}
function updateHUD(){
  const {width,height}=size();
  syncGroundControls();
  $('speedValue').textContent=Math.round(model.airspeed*3.6);$('altitudeValue').textContent=Math.round(Math.max(0,model.altitude));$('timeValue').textContent=clockText(elapsed);
  $('windValue').textContent=settings.wind?`${settings.wind} M/S`:'CALM';
  if(activeMode!=='free'){
    const p=rings[gateCount%rings.length].position.clone(),distance=p.distanceTo(aircraft.position);
    const aheadOfAircraft=p.clone().sub(aircraft.position).dot(vB.set(Math.sin(model.yaw),0,-Math.cos(model.yaw)))>=0;
    const inFrontOfCamera=p.clone().sub(camera.position).dot(camera.getWorldDirection(vA))>0;
    p.project(camera);
    const onScreen=inFrontOfCamera&&Math.abs(p.x)<.9&&Math.abs(p.y)<.85;
    const x=onScreen?clamp((p.x*.5+.5)*width,width*.27,width*.78):width*.5;
    const y=onScreen?clamp((-p.y*.5+.5)*height-32,height*.31,height*.69):height*.65;
    $('targetMarker').style.left=`${x}px`;$('targetMarker').style.top=`${y}px`;
    $('targetMarker').querySelector('span').textContent=onScreen?'⌄':'◎';
    $('targetDistance').textContent=onScreen?`${Math.round(distance)} m`:`${aheadOfAircraft?'Gate ahead':'Gate behind plane'} · ${Math.round(distance)} m`;
  }
  drawMap();
}
function drawMap(){
  const c=map,s=256/1400,center=128;c.clearRect(0,0,256,256);c.fillStyle='#e7ebd3';c.fillRect(0,0,256,256);
  c.fillStyle='#b8c69b';for(const [x,z,rx,rz] of [[-420,-330,150,180],[-360,210,140,210],[320,-400,240,110],[430,300,200,180]]){c.beginPath();c.ellipse(center+x*s,center+z*s,rx*s,rz*s,0,0,Math.PI*2);c.fill();}
  c.fillStyle='#9fbdac';c.beginPath();c.ellipse(center+520*s,center+130*s,110*s,250*s,-.25,0,Math.PI*2);c.fill();
  c.fillStyle='#86917a';c.fillRect(center-2,center-180*s,4,360*s);c.fillStyle='#fbf7db';c.fillRect(center-.5,center-165*s,1,330*s);c.fillStyle='#697c5d';c.fillRect(center-90*s,center+25*s,30*s,30*s);
  if(activeMode!=='free'){c.beginPath();route.forEach((p,i)=>{if(i)c.lineTo(center+p.x*s,center+p.z*s);else c.moveTo(center+p.x*s,center+p.z*s);});c.strokeStyle='#a693675c';c.lineWidth=1.5;c.setLineDash([4,4]);c.stroke();c.setLineDash([]);const p=route[gateCount%route.length];c.fillStyle='#d07139';c.beginPath();c.arc(center+p.x*s,center+p.z*s,4,0,Math.PI*2);c.fill();}
  const x=clamp(center+model.position.x*s,10,246),y=clamp(center+model.position.z*s,10,246);c.save();c.translate(x,y);c.rotate(model.yaw);c.beginPath();c.moveTo(0,-7);c.lineTo(5,6);c.lineTo(0,3);c.lineTo(-5,6);c.closePath();c.fillStyle='#294637';c.fill();c.restore();
}

let lastFrame=performance.now(),hudAccum=0;
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;sceneTime+=dt;
  world.update?.(dt,sceneTime,settings.wind);
  if(screen==='hangar')updateMenuCamera(dt);
  else{
    if(!paused&&!resizePause){
      if(keys.has('+')||keys.has('='))setThrottle(input.throttle+dt*.35);
      if(keys.has('-')||keys.has('_'))setThrottle(input.throttle-dt*.35);
      input.roll=clamp(stick.x+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),-1,1);
      // Screen-space down is a pull back on the transmitter. Apply the same
      // convention to Down/S, with a saved option to reverse pitch only.
      const pitchAxis=stick.y+(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
      input.pitch=clamp(pitchAxis*(settings.pitchControl==='push'?-1:1),-1,1);
      input.yaw=(keys.has('e')?1:0)-(keys.has('q')?1:0);input.brake=brakeHeld||brakeKeyHeld||keys.has(' ');
      lastPosition.set(model.position.x,model.position.y,model.position.z);
      model.update(dt,input,{heightAt:world.heightAt,collisionAt:world.collisionAt,wind:settings.wind,assisted:settings.assisted});elapsed+=dt;
      if(model.grounded)input.gear=model.gearTarget??1;
      updateModelView(dt);
      const prop=aircraft.userData.propeller;if(prop)prop.rotation.z+=dt*(20+input.throttle*90);
      if(model.crashed)crash();
      else if(activeMode!=='free'&&crossedGate(lastPosition,aircraft.position,rings[gateCount%rings.length]))onGate();
      if(model.landings>hadLanding){hadLanding=model.landings;chime();status(model.lastLanding?.onRunway?'A lovely runway landing.':'A soft landing.');hint('Hold Brake or Space to stop, or add power for another takeoff.',8);}
      if(model.stalling&&Math.floor(elapsed*2)%2===0&&elapsed>3){$('missionLabel').textContent='LOW AIRSPEED · LOWER THE NOSE';}else $('missionLabel').textContent=activeMode==='free'?(model.grounded?'READY ON THE RUNWAY':'THE SKY IS YOURS'):activeMode==='rings'?'FIND YOUR LINE':'WORDS WITH WINGS';
      if(Math.hypot(model.position.x,model.position.z)>(world.bounds?.radius||1450)){startFlight({forceAir:true});toast('Back at the airfield. Try a gentle turn to stay nearby.');}
      smokeTick+=dt;if(smokeTick>.06){smokeTick=0;smokeData.copyWithin(0,3);smokeData.set([model.position.x,model.position.y,model.position.z],smokeData.length-3);smokeLine.geometry.attributes.position.needsUpdate=true;}
      updateAudio();
    }
    smokeLine.visible=!model.grounded&&settings.aircraft==='sport';
    updateCamera(dt);hudAccum+=dt;if(hudAccum>.1){hudAccum=0;updateHUD();}
  }
  particles=particles.filter(p=>{p.age+=dt;if(p.age>1.3){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();return false;}const a=p.mesh.geometry.attributes.position;for(let i=0;i<p.velocities.length;i++){a.setXYZ(i,a.getX(i)+p.velocities[i].x*dt,a.getY(i)+p.velocities[i].y*dt,a.getZ(i)+p.velocities[i].z*dt);}a.needsUpdate=true;p.mesh.material.opacity=1-p.age/1.3;return true;});
  renderViews();
}

try{initialize();}catch(error){
  window.skyfieldFailed=true;console.error('Skyfield could not initialize:',error);$('loading').classList.add('hidden');$('loadError').classList.remove('hidden');$('loadErrorText').textContent=`${error.message||'Your browser could not start 3D graphics.'} Please reload or try a browser with WebGL.`;
}
