import * as THREE from './vendor/three.module.js';
import {createRange} from './range-world-v6.js';
import {createArcher,createArrowMesh} from './archer-rig-v6.js?v=7';
import {createArrow,launchSpeed,stepArrow,predictTrajectory,solvePitchForDistance,FIXED_TIMESTEP} from './physics-v6.js';
import {SAMPLE_WORDS,normalizePayload,shuffledIndexes} from './lesson-data-v6.js';

const $=id=>document.getElementById(id);
const E={app:$('app'),viewport:$('viewport'),start:$('start-button'),startScreen:$('start-screen'),load:$('load-status'),retry:$('retry-button'),draw:$('draw-button'),drawLabel:$('draw-label'),drawPercent:$('draw-percent'),drawHint:$('draw-hint'),pad:$('aim-pad'),knob:$('aim-knob'),score:$('score'),streak:$('streak'),count:$('hit-count'),sight:$('sight'),sightCaption:$('sight-caption'),feedback:$('feedback'),lesson:$('lesson'),lessonShow:$('lesson-show'),clue:$('clue'),status:$('range-status'),audio:$('audio-button')};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const v3=(p)=>new THREE.Vector3(p.x,p.y,p.z);
const state={ready:false,started:false,paused:true,mode:'learn',audio:true,guide:true,labels:true,repeat:true,camera:'shoulder',yaw:0,pitch:.06,basePitch:.06,draw:0,drawing:false,drawStart:0,shotAt:-10,cooldown:0,score:0,streak:0,hits:0,shots:0,history:[],lastWord:null,wordHidden:false,lessonId:0,words:SAMPLE_WORDS.slice(),primary:'en',learning:'ja',deck:[],cursor:0,targetWords:[],goal:1,locked:[false,false,false],arrows:[],stuck:[],pulses:[],wind:{x:0,y:0,z:0}};
const input={padId:null,drawId:null,viewId:null,padX:0,padY:0,lastX:0,lastY:0,keys:new Set()};
let renderer,scene,camera,world,archer,guideLine,guideGeometry,guideMaterial;
let width=1,height=1,portrait=false,lastFrame=performance.now(),accumulator=0,elapsed=0,predicted=null,guideTick=0;
let feedbackTimer=null,voiceToken=0,voiceTimer=null,activeAudio=null,soundContext=null;
const muzzle=new THREE.Vector3(),direction=new THREE.Vector3(),cameraGoal=new THREE.Vector3(),lookGoal=new THREE.Vector3(),lookCurrent=new THREE.Vector3(0,1.7,-17),project=new THREE.Vector3();
const arrowForward=new THREE.Vector3(0,0,-1);
E.sight.hidden=E.sightCaption.hidden=true;
const targetLabels=Array.from({length:3},(_,i)=>{const node=document.createElement('div');node.className='target-label';const small=document.createElement('small');small.textContent=`TARGET ${i+1}`;const word=document.createElement('strong');node.append(small,word);$('target-labels').append(node);return {node,word};});
function lineGeometry(capacity){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(capacity*3),3).setUsage(THREE.DynamicDrawUsage));geometry.setDrawRange(0,0);return geometry;}
function writeLine(geometry,points){const a=geometry.attributes.position;const count=Math.min(a.count,points.length);for(let i=0;i<count;i++)a.setXYZ(i,points[i].x,points[i].y,points[i].z);a.needsUpdate=true;geometry.setDrawRange(0,count);}

function notice(title,detail='',duration=1600){clearTimeout(feedbackTimer);E.feedback.querySelector('strong').textContent=title;E.feedback.querySelector('span').textContent=detail;E.feedback.classList.add('visible');feedbackTimer=setTimeout(()=>E.feedback.classList.remove('visible'),duration);}
function updateStats(){E.score.textContent=state.score;E.streak.textContent=state.streak;E.count.textContent=`${state.hits} WORD${state.hits===1?'':'S'}`;E.app.dataset.shots=String(state.shots);E.app.dataset.hits=String(state.hits);}
function nextWord(){if(state.cursor>=state.deck.length){state.deck=shuffledIndexes(state.words.length);state.cursor=0;}return state.words[state.deck[state.cursor++]];}
function fillWords(){state.deck=shuffledIndexes(state.words.length);state.cursor=0;state.targetWords=[nextWord(),nextWord(),nextWord()];state.locked=[false,false,false];targetLabels.forEach(label=>label.node.classList.remove('hit'));updateLabels();chooseGoal(false);}
function updateLabels(){targetLabels.forEach((l,i)=>{l.word.textContent=state.targetWords[i]?.word||'';l.node.hidden=!state.labels;});}
function chooseGoal(speak=true){const available=[0,1,2].filter(i=>i!==state.goal);state.goal=available[Math.floor(Math.random()*available.length)];updateClue();if(speak&&state.started&&!state.paused&&state.mode!=='learn')playClue();}
function updateClue(){E.clue.hidden=state.mode==='learn';if(state.mode==='learn')return;const word=state.targetWords[state.goal];$('clue-heading').textContent=state.mode==='listen'?'LISTEN & FIND':'MEANING CHALLENGE';$('clue-text').textContent=state.mode==='listen'?'Listen. Find the word.':word?.translation||word?.word||'Find the word';}
function showLesson(word){state.lastWord=word;$('lesson-word').textContent=word.word;$('lesson-translation').textContent=word.translation||'';$('lesson-sentence').textContent=word.sentenceTranslation||word.sentence||'';E.lesson.hidden=state.wordHidden;E.lessonShow.hidden=!state.wordHidden;}
function setMode(mode){if(!['learn','listen','meaning'].includes(mode))return;state.mode=mode;document.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode===mode;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});stopVoice();updateClue();if(state.started&&!state.paused){if(mode==='learn'&&state.lastWord)speak(state.lastWord,{loop:true});else if(mode!=='learn')chooseGoal();}}
function loadLesson(inputData){const lesson=normalizePayload(inputData);if(!lesson)return false;stopVoice();state.lessonId++;state.words=lesson.words;state.primary=lesson.primaryLanguage;state.learning=lesson.learningLanguage;state.history=[];state.score=state.hits=state.streak=state.shots=0;state.lastWord=null;E.lesson.hidden=E.lessonShow.hidden=true;fillWords();updateStats();clearArrows();notice(`${lesson.words.length} words loaded`,'YOUR RANGE IS READY');if(state.started&&!state.paused&&state.mode!=='learn')playClue();return true;}

function unlockSound(){try{const C=window.AudioContext||window.webkitAudioContext;if(C&&!soundContext)soundContext=new C();if(soundContext?.state==='suspended')void soundContext.resume();}catch{}}
function tone(hz,duration=.15,gain=.035){if(!state.audio||!soundContext)return;try{const t=soundContext.currentTime,o=soundContext.createOscillator(),g=soundContext.createGain();o.type='triangle';o.frequency.setValueAtTime(hz,t);o.frequency.exponentialRampToValueAtTime(Math.max(60,hz*.55),t+duration);g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(gain,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(soundContext.destination);o.start(t);o.stop(t+duration+.02);}catch{}}
function stopVoice(){voiceToken++;clearTimeout(voiceTimer);voiceTimer=null;try{window.speechSynthesis?.cancel();}catch{}if(activeAudio){activeAudio.pause();activeAudio=null;}}
function speak(word,{meaning=false,loop=false,allowPaused=false}={}){
  stopVoice();if(!state.audio||!state.started||(!allowPaused&&state.paused)||!word)return;
  const token=voiceToken,text=meaning?(word.translation||word.word):word.word,lang=meaning?state.primary:state.learning;
  const again=()=>{if(token===voiceToken&&loop&&state.repeat&&!state.paused&&state.audio)voiceTimer=setTimeout(play,1500);};
  const tts=()=>{if(token!==voiceToken)return;try{if(!window.speechSynthesis||!window.SpeechSynthesisUtterance)return;const u=new SpeechSynthesisUtterance(text);u.lang=lang;u.rate=.84;const voices=window.speechSynthesis.getVoices();u.voice=voices.find(v=>v.lang.toLowerCase()===lang.toLowerCase())||voices.find(v=>v.lang.toLowerCase().startsWith(lang.toLowerCase().split('-')[0]))||null;u.onend=again;u.onerror=()=>{};window.speechSynthesis.speak(u);}catch{}};
  const play=()=>{if(token!==voiceToken)return;if(!meaning&&word.audioUrl){try{const url=new URL(word.audioUrl,location.href);if(['https:','http:'].includes(url.protocol)){activeAudio=new Audio(url.href);activeAudio.onended=again;activeAudio.onerror=tts;activeAudio.play().catch(tts);return;}}catch{}}tts();};play();
}
function playClue(){speak(state.targetWords[state.goal],{meaning:state.mode==='meaning',loop:true});}
function resumeVoice(){if(!state.audio)return;if(state.mode==='learn'){if(state.lastWord)speak(state.lastWord,{loop:true});}else playClue();}

function modal(id){cancelDraw();resetInput();state.paused=true;stopVoice();for(const el of document.querySelectorAll('.modal'))el.hidden=el.id!==id;if(id==='review-screen')populateReview();}
function closeModals(){for(const el of document.querySelectorAll('.modal'))el.hidden=true;state.paused=!state.started;resumeVoice();}
function populateReview(){const box=$('review-list');box.replaceChildren();if(!state.history.length){const p=document.createElement('p');p.textContent='Hit your first target to collect a word.';box.append(p);return;}for(const item of [...state.history].reverse()){const row=document.createElement('div');row.className='review-row';const b=document.createElement('b');b.textContent=item.word;const span=document.createElement('span');span.textContent=item.translation||'';const button=document.createElement('button');button.textContent='◖))';button.setAttribute('aria-label',`Play ${item.word}`);button.onclick=()=>{unlockSound();speak(item,{allowPaused:true});};row.append(b,span,button);box.append(row);}}

function resetInput(){input.padId=input.viewId=input.drawId=null;input.padX=input.padY=0;input.keys.clear();E.knob.style.transform='translate(-50%,-50%)';}
function beginDraw(){if(!state.ready||!state.started||state.paused||state.drawing||elapsed<state.cooldown)return false;unlockSound();state.drawing=true;state.drawStart=elapsed;state.draw=.03;E.draw.classList.add('drawing');E.drawLabel.textContent='RELEASE';return true;}
function cancelDraw(){state.drawing=false;state.draw=0;E.draw.classList.remove('drawing','ready');E.draw.style.setProperty('--charge','0deg');E.drawLabel.textContent='DRAW';E.drawPercent.textContent='0%';E.drawHint.textContent='HOLD TO DRAW';}
function fire(){
  if(!state.drawing||state.paused||!archer)return;
  const power=state.draw;
  // The physics starts at the actual visible nocked arrow tip, in the same direction.
  archer.update({yaw:state.yaw,pitch:state.pitch,draw:power,release:0,time:elapsed});archer.group.updateMatrixWorld(true);
  archer.getMuzzlePosition(muzzle);archer.getArrowDirection(direction).normalize();
  const speed=launchSpeed(power),velocity=direction.clone().multiplyScalar(speed);
  const flight=createArrow(muzzle,velocity,{groundY:.015,maxAge:4});
  const mesh=createArrowMesh(THREE);mesh.position.copy(muzzle);mesh.quaternion.setFromUnitVectors(arrowForward,direction);scene.add(mesh);
  const trailGeo=lineGeometry(12);writeLine(trailGeo,[muzzle,muzzle]);const trailMat=new THREE.LineBasicMaterial({color:0xffe4a3,transparent:true,opacity:.5});const trail=new THREE.Line(trailGeo,trailMat);trail.frustumCulled=false;scene.add(trail);
  state.arrows.push({flight,mesh,trail,history:[muzzle.clone()],power,resolved:false});state.shots++;state.shotAt=elapsed;state.cooldown=elapsed+.65;cancelDraw();updateStats();tone(185,.16,.06);E.status.textContent=`ARROW IN FLIGHT · ${Math.round(speed)} M/S`;
}
function dropMesh(mesh){if(!mesh)return;scene?.remove(mesh);mesh.traverse?.(object=>{if(object.geometry)object.geometry.dispose();if(object.material){for(const m of Array.isArray(object.material)?object.material:[object.material])m.dispose();}});}
function clearArrows(){if(!scene)return;for(const a of state.arrows){dropMesh(a.mesh);dropMesh(a.trail);}state.arrows=[];for(const item of state.stuck)dropMesh(item.mesh);state.stuck=[];}
function onImpact(a,event){
  if(a.resolved)return;a.resolved=true;dropMesh(a.trail);
  a.mesh.position.copy(v3(event.position));direction.copy(v3(event.velocity)).normalize();a.mesh.quaternion.setFromUnitVectors(arrowForward,direction);
  if(event.type!=='expired'){state.stuck.push({mesh:a.mesh,target:event.targetIndex??-1});if(state.stuck.length>16)dropMesh(state.stuck.shift().mesh);}else dropMesh(a.mesh);
  E.status.textContent='17 M · PRACTICE RANGE';
  if(event.type!=='target'){state.streak=0;updateStats();if(a.power<.65)notice('Draw a little longer','HOLD UNTIL THE SIGHT TURNS GREEN',1700);else notice('Adjust your aim','FOLLOW THE FLIGHT GUIDE TO THE TARGET',1600);tone(120,.09,.022);return;}
  const index=event.targetIndex,word=state.targetWords[index];tone(380,.11,.055);
  const pulse=new THREE.Mesh(new THREE.RingGeometry(.94,1.01,64),new THREE.MeshBasicMaterial({color:0xffe7a3,transparent:true,opacity:.9,depthWrite:false}));pulse.position.copy(world.targets[index].center);pulse.position.z+=.03;scene.add(pulse);state.pulses.push({mesh:pulse,life:.8});
  // Short imported lists can put the same answer on more than one target.
  const correct=state.mode==='learn'||index===state.goal||word.word===state.targetWords[state.goal]?.word;
  if(!correct){state.streak=0;updateStats();notice('Try the other word','LISTEN TO THE CLUE AGAIN');const id=state.lessonId;setTimeout(()=>{if(id===state.lessonId&&!state.paused)playClue();},1100);return;}
  if(state.locked[index]){state.score+=event.points;state.streak++;updateStats();notice(`${event.points} points.`,`TARGET HIT · NEXT WORD LOADING`);return;}
  state.locked[index]=true;targetLabels[index].node.classList.add('hit');state.score+=event.points;state.hits++;state.streak++;state.history.push({...word,points:event.points});if(state.history.length>250)state.history.shift();updateStats();showLesson(word);speak(word,{loop:state.mode==='learn'});
  notice(event.points===10?'Bullseye.':`${event.points} points.`,`${word.word}  ·  ${word.translation||'NICE SHOT'}`);if(event.points>=9)setTimeout(()=>tone(780,.14,.028),70);
  const lessonId=state.lessonId;
  setTimeout(()=>{if(lessonId!==state.lessonId)return;let candidate=nextWord();if(state.words.length>3){let tries=0;while(tries++<state.words.length&&state.targetWords.some((w,j)=>j!==index&&w.word===candidate.word))candidate=nextWord();}state.targetWords[index]=candidate;state.locked[index]=false;targetLabels[index].node.classList.remove('hit');updateLabels();if(state.mode!=='learn')chooseGoal();},1100);
}
function updatePhysics(dt){
  for(let i=state.arrows.length-1;i>=0;i--){const a=state.arrows[i];const impact=stepArrow(a.flight,dt,world.targets,state.wind);if(impact){onImpact(a,impact);state.arrows.splice(i,1);continue;}a.mesh.position.copy(v3(a.flight.position));direction.copy(v3(a.flight.velocity)).normalize();a.mesh.quaternion.setFromUnitVectors(arrowForward,direction);}
}
function updateTrails(){for(const a of state.arrows){a.history.push(a.mesh.position.clone());if(a.history.length>10)a.history.shift();writeLine(a.trail.geometry,a.history);a.trail.material.opacity=.34;}}
function screenPoint(point){project.copy(point).project(camera);return {x:(project.x*.5+.5)*width,y:(-.5*project.y+.5)*height,visible:project.z>-1&&project.z<1&&Math.abs(project.x)<1.13&&Math.abs(project.y)<1.13};}
function updateGuide(){
  if(!archer)return;
  // At rest show the full-draw sight. During drawing show the actual current power.
  const draw=state.drawing?state.draw:1;
  if(!state.drawing){archer.update({yaw:state.yaw,pitch:state.pitch,draw:1,release:0,time:elapsed});archer.group.updateMatrixWorld(true);}
  archer.getMuzzlePosition(muzzle);archer.getArrowDirection(direction).normalize();
  // Restore the visible idle/follow-through pose before the frame is rendered.
  if(!state.drawing){archer.update({yaw:state.yaw,pitch:state.pitch,draw:state.draw,release:Math.max(0,1-(elapsed-state.shotAt)/.32),time:elapsed});archer.group.updateMatrixWorld(true);}
  predicted=predictTrajectory(muzzle,direction.clone().multiplyScalar(launchSpeed(draw)),world.targets,state.wind,{dt:1/55,maxTime:4,groundY:.015});
  const points=predicted.points;
  writeLine(guideGeometry,points);guideLine.computeLineDistances();guideLine.visible=state.started&&state.guide&&state.drawing&&!state.paused;
  const ready=predicted.impact?.type==='target'&&draw>.45;
  guideMaterial.color.setHex(ready?0xb6ffca:0xf5ddb1);
  let aimPoint=predicted.impact?.position||points.at(-1);
  const p=screenPoint(v3(aimPoint));const show=state.started&&!state.paused&&p.visible;
  E.sight.hidden=!show;E.sightCaption.hidden=!show;
  if(show){const x=clamp(p.x,18,width-18),y=clamp(p.y,100,height-70);E.sight.style.left=`${x}px`;E.sight.style.top=`${y}px`;E.sightCaption.style.left=`${x}px`;E.sightCaption.style.top=`${y}px`;}
  E.sight.classList.toggle('ready',ready);E.sightCaption.classList.toggle('ready',ready);
  E.sightCaption.textContent=state.drawing?(ready?'RELEASE':draw<.65?'DRAW MORE':'ADJUST AIM'):'FULL DRAW SIGHT';
  E.draw.classList.toggle('ready',state.drawing&&ready);E.drawHint.textContent=state.drawing?(ready?'ON TARGET':draw<.8?'KEEP DRAWING':'ADJUST YOUR AIM'):'HOLD TO DRAW';
}

function resize(){if(!renderer)return;const box=E.viewport.getBoundingClientRect();width=Math.max(1,box.width);height=Math.max(1,box.height);portrait=height>width;renderer.setPixelRatio(Math.min(devicePixelRatio||1,portrait?1.5:1.6));renderer.setSize(width,height,false);camera.aspect=width/height;camera.fov=portrait?46:42;camera.updateProjectionMatrix();}
function cameraUpdate(dt,instant=false){
  const side=state.camera==='side';const x=portrait?(side?.9:.63):(side?2.6:1.1),z=portrait?(side?5.7:4.2):(side?5.6:3.9),y=portrait?2.08:2.0;
  const follow=state.yaw*.32;
  cameraGoal.set(x*Math.cos(follow)-z*Math.sin(follow),y,z*Math.cos(follow)+x*Math.sin(follow));
  lookGoal.set(Math.sin(state.yaw)*7,1.65+(state.pitch-state.basePitch)*7,-17);
  const blend=instant?1:1-Math.exp(-dt*6);camera.position.lerp(cameraGoal,blend);lookCurrent.lerp(lookGoal,blend);camera.lookAt(lookCurrent);camera.updateMatrixWorld(true);
}
function calibrate(){
  for(let i=0;i<5;i++){archer.update({yaw:state.yaw,pitch:state.pitch,draw:1,release:0,time:elapsed});archer.group.updateMatrixWorld(true);archer.getMuzzlePosition(muzzle);const target=world.targets[1].center;const dx=target.x-muzzle.x,dz=muzzle.z-target.z;state.yaw=Math.atan2(dx,dz);state.pitch=solvePitchForDistance(Math.hypot(dx,dz),target.y-muzzle.y,launchSpeed(1))??.06;}
  state.basePitch=state.pitch;
}
function frame(now){
  requestAnimationFrame(frame);const dt=clamp((now-lastFrame)/1000,0,.05);lastFrame=now;elapsed+=dt;if(!renderer||!scene||!camera)return;
  if(state.ready&&!state.paused){
    const right=(input.keys.has('ArrowRight')||input.keys.has('KeyD')?1:0)-(input.keys.has('ArrowLeft')||input.keys.has('KeyA')?1:0);
    const up=(input.keys.has('ArrowUp')||input.keys.has('KeyW')?1:0)-(input.keys.has('ArrowDown')||input.keys.has('KeyS')?1:0);
    state.yaw=clamp(state.yaw+(input.padX+right)*dt*.24,-.42,.42);state.pitch=clamp(state.pitch+(input.padY+up)*dt*.18,-.14,.37);
    if(state.drawing){state.draw=clamp((elapsed-state.drawStart)/1.08,.03,1);E.draw.style.setProperty('--charge',`${state.draw*360}deg`);E.drawPercent.textContent=`${Math.round(state.draw*100)}%`;}
    accumulator+=dt;let steps=0;while(accumulator>=FIXED_TIMESTEP&&steps++<8){updatePhysics(FIXED_TIMESTEP);accumulator-=FIXED_TIMESTEP;}updateTrails();
  }else accumulator=0;
  if(archer){archer.update({yaw:state.yaw,pitch:state.pitch,draw:state.draw,release:Math.max(0,1-(elapsed-state.shotAt)/.32),time:elapsed});archer.group.updateMatrixWorld(true);}
  world?.update(elapsed,dt);cameraUpdate(dt,!state.ready);
  if(world){for(let i=0;i<3;i++){const p=screenPoint(world.targets[i].wordAnchor);const l=targetLabels[i];l.node.hidden=!state.labels||!p.visible;l.node.style.left=p.x+'px';l.node.style.top=p.y+'px';}}
  if(state.ready&&(guideTick+=dt)>.025){guideTick=0;updateGuide();}
  for(let i=state.pulses.length-1;i>=0;i--){const p=state.pulses[i];p.life-=dt;p.mesh.scale.setScalar(1+(1-p.life/.8)*.13);p.mesh.material.opacity=Math.max(0,p.life/.8);if(p.life<=0){dropMesh(p.mesh);state.pulses.splice(i,1);}}
  renderer.render(scene,camera);
}
async function init(){
  try{
    const canvas=document.createElement('canvas');
    const context=canvas.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'default'})||canvas.getContext('webgl2',{alpha:false,antialias:false});
    if(!context)throw new Error('3D graphics are unavailable in this browser. Open the game in a browser with WebGL 2 enabled.');
    renderer=new THREE.WebGLRenderer({canvas,context,antialias:true,alpha:false});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;E.viewport.appendChild(renderer.domElement);
    scene=new THREE.Scene();scene.background=new THREE.Color(0xbad5df);scene.fog=new THREE.Fog(0xbad1cb,35,130);camera=new THREE.PerspectiveCamera(42,1,.08,240);
    scene.add(new THREE.HemisphereLight(0xd8eaf5,0x617944,2.15));const sun=new THREE.DirectionalLight(0xffe0a8,3.1);sun.position.set(-12,25,9);sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);sun.shadow.camera.left=-20;sun.shadow.camera.right=20;sun.shadow.camera.top=20;sun.shadow.camera.bottom=-20;sun.shadow.camera.near=1;sun.shadow.camera.far=80;sun.shadow.bias=-.0005;sun.shadow.normalBias=.028;sun.shadow.radius=2;sun.target.position.set(0,0,-9);scene.add(sun,sun.target);
    world=createRange(THREE,scene);guideGeometry=lineGeometry(260);guideMaterial=new THREE.LineDashedMaterial({color:0xf8e1ac,dashSize:.19,gapSize:.12,transparent:true,opacity:.48,depthTest:true,depthWrite:false});guideLine=new THREE.Line(guideGeometry,guideMaterial);guideLine.visible=false;guideLine.frustumCulled=false;scene.add(guideLine);
    resize();cameraUpdate(0,true);requestAnimationFrame(frame);E.load.textContent='Loading the 3D archer…';
    archer=await Promise.race([createArcher(THREE),new Promise((_,reject)=>setTimeout(()=>reject(new Error('The 3D archer took too long to load. Please retry.')),25000))]);scene.add(archer.group);calibrate();state.ready=true;E.app.dataset.ready='true';E.start.disabled=false;E.start.innerHTML='ENTER THE RANGE <span>→</span>';E.load.textContent='Ready. Aim with the thumb pad, then hold and release DRAW.';cameraUpdate(0,true);
  }catch(error){console.error('Archery initialization failed:',error);E.load.textContent=`3D loading failed: ${error.message||'This browser could not start WebGL.'}`;E.start.textContent='3D UNAVAILABLE';E.retry.hidden=false;}
}

E.pad.addEventListener('pointerdown',event=>{if(!state.started||state.paused||input.padId!==null)return;event.preventDefault();input.padId=event.pointerId;E.pad.setPointerCapture(event.pointerId);movePad(event);});
function movePad(event){const r=E.pad.getBoundingClientRect(),limit=r.width*.34;let x=event.clientX-r.left-r.width/2,y=event.clientY-r.top-r.height/2;const distance=Math.hypot(x,y);if(distance>limit){x*=limit/distance;y*=limit/distance;}input.padX=x/limit;input.padY=-y/limit;E.knob.style.transform=`translate(calc(-50% + ${x}px),calc(-50% + ${y}px))`;}
E.pad.addEventListener('pointermove',event=>{if(input.padId===event.pointerId){event.preventDefault();movePad(event);}});
function releasePad(event){if(input.padId!==event.pointerId)return;input.padId=null;input.padX=input.padY=0;E.knob.style.transform='translate(-50%,-50%)';}
E.pad.addEventListener('pointerup',releasePad);E.pad.addEventListener('pointercancel',releasePad);
E.draw.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();if(input.drawId!==null)return;if(beginDraw()){input.drawId=event.pointerId;E.draw.setPointerCapture(event.pointerId);}});
E.draw.addEventListener('pointerup',event=>{event.preventDefault();if(input.drawId!==event.pointerId)return;input.drawId=null;fire();});
E.draw.addEventListener('pointercancel',event=>{if(input.drawId===event.pointerId){input.drawId=null;cancelDraw();}});E.draw.addEventListener('contextmenu',event=>event.preventDefault());E.draw.addEventListener('click',event=>event.preventDefault());
E.viewport.addEventListener('pointerdown',event=>{if(!state.started||state.paused||input.viewId!==null)return;event.preventDefault();input.viewId=event.pointerId;input.lastX=event.clientX;input.lastY=event.clientY;E.viewport.setPointerCapture(event.pointerId);});
E.viewport.addEventListener('pointermove',event=>{if(input.viewId!==event.pointerId||state.paused)return;event.preventDefault();const dx=event.clientX-input.lastX,dy=event.clientY-input.lastY;state.yaw=clamp(state.yaw+dx/Math.max(300,width)*.5,-.42,.42);state.pitch=clamp(state.pitch-dy/Math.max(300,height)*.3,-.14,.37);input.lastX=event.clientX;input.lastY=event.clientY;});
for(const type of ['pointerup','pointercancel'])E.viewport.addEventListener(type,event=>{if(input.viewId===event.pointerId)input.viewId=null;});
window.addEventListener('keydown',event=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))event.preventDefault();if(input.keys.has(event.code))return;input.keys.add(event.code);if(event.code==='Space')beginDraw();if(event.code==='Escape'){if(state.paused&&state.started)closeModals();else if(state.started)modal('settings-screen');}});
window.addEventListener('keyup',event=>{input.keys.delete(event.code);if(event.code==='Space'&&input.drawId===null)fire();});window.addEventListener('blur',()=>{resetInput();cancelDraw();});
window.addEventListener('resize',resize,{passive:true});window.visualViewport?.addEventListener('resize',resize,{passive:true});document.addEventListener('visibilitychange',()=>{if(document.hidden){stopVoice();resetInput();cancelDraw();}else if(state.started&&!state.paused)resumeVoice();});
E.start.addEventListener('click',()=>{if(!state.ready)return;unlockSound();state.started=true;state.paused=false;E.startScreen.hidden=true;E.app.classList.add('playing');notice('Take your first shot','HOLD DRAW UNTIL THE SIGHT TURNS GREEN',2300);if(state.mode!=='learn')playClue();});E.retry.onclick=()=>location.reload();
document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{unlockSound();setMode(button.dataset.mode);});
$('camera-button').onclick=()=>{state.camera=state.camera==='shoulder'?'side':'shoulder';notice(state.camera==='shoulder'?'Shoulder view':'Side view','',900);};
E.audio.onclick=()=>{state.audio=!state.audio;E.audio.classList.toggle('muted',!state.audio);E.audio.setAttribute('aria-label',state.audio?'Mute pronunciation':'Enable pronunciation');if(!state.audio)stopVoice();else{unlockSound();resumeVoice();}};
$('pause-button').onclick=()=>modal('settings-screen');$('resume-button').onclick=closeModals;document.querySelectorAll('[data-close]').forEach(button=>button.onclick=closeModals);
$('guide-option').onchange=event=>state.guide=event.target.checked;$('labels-option').onchange=event=>{state.labels=event.target.checked;updateLabels();};$('repeat-option').onchange=event=>{state.repeat=event.target.checked;stopVoice();};
$('lesson-sound').onclick=()=>{unlockSound();speak(state.lastWord,{loop:true});};$('lesson-hide').onclick=()=>{state.wordHidden=true;E.lesson.hidden=true;E.lessonShow.hidden=false;};E.lessonShow.onclick=()=>{state.wordHidden=false;E.lesson.hidden=!state.lastWord;E.lessonShow.hidden=true;};$('clue-replay').onclick=()=>{unlockSound();playClue();};
$('import-open').onclick=()=>modal('import-screen');$('review-open').onclick=()=>modal('review-screen');$('import-apply').onclick=()=>{if(!loadLesson($('import-json').value)){$('import-error').textContent='Please paste valid JSON with a non-empty words or sentences list.';return;}$('import-error').textContent='';closeModals();};
$('reset-button').onclick=()=>{state.lessonId++;state.score=state.streak=state.hits=state.shots=0;state.history=[];state.lastWord=null;E.lesson.hidden=E.lessonShow.hidden=true;clearArrows();fillWords();updateStats();calibrate();closeModals();notice('Fresh start','TAKE YOUR TIME. FIND YOUR FOCUS.');};
$('export-button').onclick=async()=>{const data=JSON.stringify({primaryLanguage:state.primary,learningLanguage:state.learning,words:state.history.map(({word,translation,id,sentence,sentenceTranslation,audioUrl})=>({id,word,translation,sentence,sentenceTranslation,audioUrl}))},null,2);try{await navigator.clipboard.writeText(data);$('export-button').textContent='COPIED';}catch{$('import-json').value=data;modal('import-screen');$('import-json').select();$('import-error').textContent='Copy your collected word list from this field.';}};
function incomingLesson(){
  const keys=['data','golingoLesson','payload','gameData','golingoData','words','sentences','json'];
  const fromParams=params=>{for(const key of keys){const data=params.get(key);if(data){const p=normalizePayload(data);if(p)return p;}}return null;};
  try{const query=new URLSearchParams(location.search),p=fromParams(query);if(p){p.primaryLanguage=query.get('primaryLanguage')||p.primaryLanguage;p.learningLanguage=query.get('learningLanguage')||p.learningLanguage;return p;}}catch{}
  const hash=location.hash.slice(1);
  if(hash){
    // Parse encoded parameters before decoding so &, + and % inside a lesson stay intact.
    const p=fromParams(new URLSearchParams(hash))||normalizePayload(hash);if(p)return p;
    try{const raw=normalizePayload(decodeURIComponent(hash));if(raw)return raw;}catch{}
  }
  for(const name of ['sessionStorage','localStorage'])try{const storage=window[name];for(const key of ['golingoGameData','golingoWords','GoLingoGameData','gameData']){const p=normalizePayload(storage.getItem(key));if(p)return p;}}catch{}
  return null;
}
window.addEventListener('message',event=>{if(event.source!==parent&&event.source!==opener&&event.source!==window)return;let data=event.data;if(typeof data==='string')try{data=JSON.parse(data);}catch{return;}if(!data||typeof data!=='object')return;const lesson=normalizePayload(data);if(lesson&&loadLesson(lesson))try{event.source?.postMessage({type:'GOLINGO_WORDS_LOADED',count:lesson.words.length},event.origin==='null'?'*':event.origin);}catch{}});
window.GoLingoWordArcher={loadWords:loadLesson,setMode,setCamera:mode=>{state.camera=mode==='side'?'side':'shoulder';},getStats:()=>({score:state.score,hits:state.hits,shots:state.shots,streak:state.streak,words:state.words.length,mode:state.mode,version:7}),pause:()=>modal('settings-screen'),resume:closeModals,exportWords:()=>state.history.map(({word,translation,id})=>({id,word,translation}))};window.receiveGoLingoData=loadLesson;
fillWords();updateStats();const incoming=incomingLesson();if(incoming)loadLesson(incoming);for(const receiver of [parent,opener])if(receiver&&receiver!==window)try{receiver.postMessage({type:'GOLINGO_GAME_READY',game:'word-archer',supportsPostMessage:true},'*');receiver.postMessage({type:'GAME_READY',game:'word-archer'},'*');}catch{}
init();
