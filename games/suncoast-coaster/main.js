import * as THREE from './vendor/three.module.js';
import {createTrack} from './track.js';
import {createPark} from './park.js';
import {RideAudio} from './audio.js';
import {createLearning} from './learning.js';

const $ = id => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const damp = (a,b,k,dt) => lerp(a,b,1-Math.exp(-k*dt));
const v3 = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
const isSmall = () => innerWidth < 760 || matchMedia('(pointer:coarse)').matches;
const state = {
  phase:'loading',mode:'free',camera:'front',distance:18,traveled:0,speed:6,
  elapsed:0,score:0,perfect:0,lap:1,fuel:100,maxSpeed:0,brake:false,boost:false,
  sound:false,lookX:0,lookY:0,dragging:false,toastTime:0,ready:false,helpFrom:'menu',
  cameraSnap:true,frameCount:0,lastRenderMs:0,practiced:0
};
let learning=null,learningSignature='',lessonWasRiding=false;
const inputResetters=[];
const renderer = new THREE.WebGLRenderer({canvas:$('world'),antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,isSmall()?1.4:1.7));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.17;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbddedb);
scene.fog = new THREE.Fog(0xc5dcd1,220,640);
const camera = new THREE.PerspectiveCamera(53,innerWidth/innerHeight,.12,1400);
camera.position.set(176,135,195);
const sun = new THREE.DirectionalLight(0xffe1af,3.15);
sun.position.set(-105,185,80);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-170,right:170,top:170,bottom:-170,near:10,far:450});
sun.shadow.bias=-.00025;sun.shadow.normalBias=.15;sun.shadow.radius=2;
scene.add(sun,new THREE.HemisphereLight(0xdaf3ed,0xb8a16a,2.3));
const sky = new THREE.Mesh(new THREE.SphereGeometry(900,32,16),new THREE.ShaderMaterial({
  side:THREE.BackSide,depthWrite:false,
  uniforms:{top:{value:new THREE.Color('#9bcfd7')},bottom:{value:new THREE.Color('#fff1cd')}},
  vertexShader:'varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'varying vec3 vPos;uniform vec3 top;uniform vec3 bottom;void main(){float h=clamp(normalize(vPos).y*.9+.05,0.,1.);gl_FragColor=vec4(mix(bottom,top,pow(h,.65)),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'
}));scene.add(sky);

$('loading-text').textContent='Laying out a little adventure…';
const track = createTrack(scene);
const park = createPark(scene,{trackSamples:track.samples});
const audio = new RideAudio();
const trackLength=track.length;
const startDistance=18;
const getSection = d => track.sections.find(s=>{const a=((d%trackLength)+trackLength)%trackLength;return a>=s.start&&a<s.end;})||track.sections[0];
$('track-length').textContent=Math.round(trackLength).toLocaleString();
$('track-height').textContent=Math.round(Math.max(...track.samples.map(p=>p.y)));

function mat(color, extras={}) {return new THREE.MeshStandardMaterial({color,roughness:.5,metalness:.08,...extras});}
const trainMaterials={orange:mat(0xed6b48),cream:mat(0xffeac5),dark:mat(0x284d43),seat:mat(0x407468),metal:mat(0xd9d7bd,{metalness:.7,roughness:.25}),rubber:mat(0x263c37),skin:mat(0xb97852),skinLight:mat(0xf0bd8e),shirt:mat(0xf0cc72),blue:mat(0x91bbc1)};
function part(group,geo,material,pos=[0,0,0],rotation=null){const mesh=new THREE.Mesh(geo,material);mesh.position.set(...pos);if(rotation)mesh.rotation.set(...rotation);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;}
function box(group,size,material,pos,rotation){return part(group,new THREE.BoxGeometry(...size),material,pos,rotation);}
function tubeBetween(group,a,b,r,material){const av=v3(...a),bv=v3(...b);const m=part(group,new THREE.CylinderGeometry(r,r,av.distanceTo(bv),8),material,av.clone().add(bv).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(v3(0,1,0),bv.sub(av).normalize());return m;}
function makeCar(index){
  const group=new THREE.Group();group.name=`Coaster car ${index+1}`;
  box(group,[2.35,.28,3.65],trainMaterials.dark,[0,.42,0]);
  box(group,[2.2,.2,3.55],trainMaterials.cream,[0,.62,0]);
  const profile=new THREE.Shape();profile.moveTo(-1.83,.55);profile.lineTo(-1.83,1.38);profile.quadraticCurveTo(-1.2,1.55,-.7,1.36);profile.lineTo(.75,1.12);profile.quadraticCurveTo(1.9,1.1,1.9,.75);profile.lineTo(1.9,.55);profile.closePath();
  const sideGeo=new THREE.ExtrudeGeometry(profile,{depth:.17,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.05,bevelThickness:.04});sideGeo.rotateY(-Math.PI/2);
  for(const x of [-1.12,1.28]){part(group,sideGeo,trainMaterials.orange,[x,0,0]);box(group,[.11,.09,3.1],trainMaterials.cream,[x-.08,1.3,-.18],[.06,0,0]);}
  box(group,[2.34,.55,.35],trainMaterials.orange,[0,.98,1.71],[-.17,0,0]);
  box(group,[2.29,.12,.4],trainMaterials.cream,[0,1.26,1.68],[-.17,0,0]);
  box(group,[2.25,.6,.2],trainMaterials.orange,[0,.98,-1.73]);
  for(const x of [-.56,.56]){
    box(group,[.86,.22,.91],trainMaterials.seat,[x,.91,-.37]);
    box(group,[.86,.98,.2],trainMaterials.seat,[x,1.48,-.89],[-.1,0,0]);
    box(group,[.68,.23,.24],trainMaterials.cream,[x,2,-.96],[-.1,0,0]);
    for(const z of [-1.2,1.2]){part(group,new THREE.CylinderGeometry(.25,.25,.23,12),trainMaterials.rubber,[Math.sign(x)*1.25,.385,z],[0,0,Math.PI/2]);part(group,new THREE.CylinderGeometry(.11,.11,.25,10),trainMaterials.metal,[Math.sign(x)*1.25,.385,z],[0,0,Math.PI/2]);}
  }
  const barCurve=new THREE.CatmullRomCurve3([v3(-1.05,1.12,.95),v3(-.93,1.68,1.04),v3(-.6,1.76,1.06),v3(.6,1.76,1.06),v3(.93,1.68,1.04),v3(1.05,1.12,.95)]);
  part(group,new THREE.TubeGeometry(barCurve,24,.055,8,false),trainMaterials.metal);
  box(group,[2.4,.07,.3],trainMaterials.dark,[0,.8,-1.95]);
  if(index>0)for(const [j,x] of [-.55,.55].entries()){
    const skin=(index+j)%2?trainMaterials.skin:trainMaterials.skinLight;
    const shirt=(index+j)%2?trainMaterials.shirt:trainMaterials.blue;
    part(group,new THREE.CapsuleGeometry(.23,.35,4,8),shirt,[x,1.4,-.3]);
    part(group,new THREE.SphereGeometry(.22,10,8),skin,[x,1.98,-.34]);
    part(group,new THREE.SphereGeometry(.23,10,8,0,Math.PI*2,0,1.7),trainMaterials.dark,[x,2.03,-.37]);
    for(const side of [-1,1]){tubeBetween(group,[x+side*.21,1.6,-.3],[x+side*.28,1.42,.46],.075,skin);part(group,new THREE.SphereGeometry(.085,8,6),skin,[x+side*.28,1.42,.46]);}
  }
  const emblem=part(group,new THREE.CircleGeometry(.23,16),trainMaterials.cream,[0,.98,1.93]);emblem.rotation.x=-.1;
  scene.add(group);return group;
}
const cars=[makeCar(0),makeCar(1),makeCar(2)];
function updateTrain(){for(let i=0;i<cars.length;i++){const frame=track.getFrame(state.distance-i*4.23);cars[i].position.copy(frame.position);cars[i].quaternion.copy(frame.quaternion);}}
updateTrain();

// Arcade physics: gravity on descents, a mechanical first lift, and low-speed hill assistance.
function nextSpeed(speed,distance,dt,brake=false,boost=false){
  const section=getSection(distance);
  const tangent=track.curve.getTangentAt((((distance%trackLength)+trackLength)%trackLength)/trackLength);
  if(section.type==='lift')return damp(speed,brake?4.2:9.4,1.65,dt);
  let acceleration=-9.81*tangent.y*.85-.0043*speed*speed-.12;
  if(speed<7&&!brake)acceleration+=Math.max(0,7-speed)*2.5+Math.max(0,9.81*tangent.y*.85);
  if(boost)acceleration+=12.5*(typeof boost==='number'?clamp(boost,0,1):1);
  if(brake)acceleration-=19;
  if(section.type==='station'&&speed>10&&!boost)acceleration-=8;
  return clamp(speed+acceleration*dt,brake?.65:3.2,43);
}

const gateFractions=[.22,.31,.43,.53,.63,.73,.83,.93];
const gateNames=['Sunshine drop','Canyon crest','Palm ridge','Lagoon flyby','Ocean breeze','Coastal sweep','The home stretch','Last little rush'];
const gates=gateFractions.map((fraction,i)=>({baseDistance:startDistance+trackLength*fraction,distance:startDistance+trackLength*fraction,name:gateNames[i],index:i,done:false,perfect:false,min:0,max:0,group:null,entry:null}));
// Set achievable ranges from a simulated unassisted lap, then vary the ideal pace.
{
  let d=startDistance,v=6,index=0;const offsets=[-22,20,-18,20,-22,22,-18,20];
  for(let step=0;step<30000&&index<gates.length;step++){
    v=nextSpeed(v,d,1/45);d+=v/45;
    if(d>=gates[index].distance){const center=Math.round(clamp(v*3.6+offsets[index],20,140)/5)*5;gates[index].min=Math.max(12,center-8);gates[index].max=center+8;index++;}
  }
}
function fitCanvasText(ctx,text,y,maxLines=2,size=62,color='#315b48'){
  const chars=Array.from(String(text||''));let lines=[''];ctx.font=`600 ${size}px Arial, sans-serif`;
  for(const char of chars){let i=lines.length-1;if(ctx.measureText(lines[i]+char).width>900&&lines[i]){if(lines.length===maxLines){lines[i]=lines[i].slice(0,-2)+'…';break;}lines.push(char);}else lines[i]+=char;}
  ctx.fillStyle=color;lines.forEach((line,i)=>ctx.fillText(line.trim(),512,y+i*size*1.1));return lines.length;
}
function gateLabel(gate){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=384;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff5db';ctx.beginPath();ctx.roundRect(5,5,1014,374,28);ctx.fill();ctx.strokeStyle='#da7850';ctx.lineWidth=5;ctx.stroke();ctx.textAlign='center';
  ctx.fillStyle='#71826f';ctx.font='500 24px Arial';ctx.fillText(`${gate.entry?.kind==='sentence'?'SENTENCE':'WORD'} GATE ${String(gate.index+1).padStart(2,'0')}`,512,47);
  const sentence=gate.entry?.kind==='sentence';fitCanvasText(ctx,gate.entry?.text||'Your next discovery',sentence?113:135,sentence?3:2,sentence?48:70);
  if(learning?.settings.showTranslation&&gate.entry?.translation)fitCanvasText(ctx,gate.entry.translation,288,1,34,'#7b8970');
  ctx.fillStyle='#c7774d';ctx.font='500 24px Arial';ctx.fillText(state.mode==='thrill'?`BONUS PACE · ${gate.min}–${gate.max} km/h`:'LISTEN · REPEAT · COLLECT',512,350);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return new THREE.SpriteMaterial({map:texture,depthTest:true,transparent:true});
}
for(const gate of gates){
  const f=track.getFrame(gate.distance);const group=new THREE.Group();group.position.copy(f.position);group.quaternion.copy(f.quaternion);scene.add(group);
  const ringMaterial=mat(0xf4bf69,{emissive:0xd28e29,emissiveIntensity:.35,metalness:.35,roughness:.3});
  const ring=part(group,new THREE.TorusGeometry(3.7,.12,8,52),ringMaterial,[0,3.35,0]);ring.castShadow=false;
  const outer=part(group,new THREE.TorusGeometry(3.88,.025,5,52),trainMaterials.cream,[0,3.35,0]);outer.castShadow=false;
  const sign=new THREE.Sprite(gateLabel(gate));sign.scale.set(7.8,2.925,1);sign.position.set(0,9,0);group.add(sign);
  gate.group=group;gate.ring=ring;gate.sign=sign;gate.material=ringMaterial;
}
function repaintGateLabels(){for(const gate of gates){gate.sign.material.map?.dispose();gate.sign.material.dispose();gate.sign.material=gateLabel(gate);}}
function assignGateWords(){
  if(!learning)return;const entries=learning.nextBatch(gates.length);gates.forEach((gate,i)=>{gate.entry=entries[i%entries.length]||null;});repaintGateLabels();
}
function refreshLearning(){
  if(!learning)return;
  const signature=JSON.stringify([learning.lesson,learning.settings.practice]);
  if(signature!==learningSignature){learningSignature=signature;learning.beginRide();assignGateWords();const next=gates.find(g=>!g.done)||gates[0];if(next.entry)learning.present(next.entry,{collect:false});}
  else repaintGateLabels();
  if(state.ready)updateHUD();
}
learning=createLearning({
  mount:$('learning-menu'),onChange:refreshLearning,onToast:(message,detail)=>toast(String(message||''),detail?String(detail):''),
  onPause:()=>{lessonWasRiding=state.phase==='riding';if(lessonWasRiding){clearInput();setPhase('paused');audio.suspend();}return lessonWasRiding;},
  onResume:()=>{if(lessonWasRiding&&state.phase==='paused'){setPhase('riding');clearInput();audio.resume();unlockSound();}lessonWasRiding=false;}
});
refreshLearning();

// A single reusable burst keeps checkpoint feedback light on mobile GPUs.
const particleCount=100,particlePositions=new Float32Array(particleCount*3),particleVel=[];
const particleGeometry=new THREE.BufferGeometry();particleGeometry.setAttribute('position',new THREE.BufferAttribute(particlePositions,3));
const particleMaterial=new THREE.PointsMaterial({size:.2,color:0xffcd6f,transparent:true,opacity:0,depthWrite:false});
const particles=new THREE.Points(particleGeometry,particleMaterial);particles.frustumCulled=false;scene.add(particles);let particleLife=0;
function burst(position,perfect){particleLife=1.3;particleMaterial.color.set(perfect?0xffcf62:0xffe5c2);for(let i=0;i<particleCount;i++){particlePositions.set(position.toArray(),i*3);particleVel[i]=v3((Math.random()-.5)*11,Math.random()*8+1,(Math.random()-.5)*11);}particleGeometry.attributes.position.needsUpdate=true;}
function updateParticles(dt){if(particleLife<=0)return;particleLife-=dt;particleMaterial.opacity=Math.max(0,particleLife/1.3);for(let i=0;i<particleCount;i++){particleVel[i].y-=dt*5;particlePositions[i*3]+=particleVel[i].x*dt;particlePositions[i*3+1]+=particleVel[i].y*dt;particlePositions[i*3+2]+=particleVel[i].z*dt;}particleGeometry.attributes.position.needsUpdate=true;}

function setPhase(phase){state.phase=phase;document.body.dataset.phase=phase;learning?.setVisible(phase==='riding'||phase==='paused');learning?.setRunning(phase==='riding');}
function clearInput(){state.brake=false;state.boost=false;state.dragging=false;for(const reset of inputResetters)reset();$('brake').classList.remove('pressed');$('boost').classList.remove('pressed');}
function toast(text,sub='',seconds=2.8){$('toast').textContent=text;if(sub){const detail=document.createElement('small');detail.textContent=sub;$('toast').appendChild(detail);}$('toast').classList.add('show');state.toastTime=seconds;}
function modal(which){$('modal-backdrop').hidden=!which;for(const id of ['pause','help','results'])$(id+'-dialog').hidden=id!==which;}
function syncSoundUI(){document.body.classList.toggle('sound-enabled',state.sound);$('sound').setAttribute('aria-pressed',String(state.sound));$('sound').setAttribute('aria-label',state.sound?'Mute ride sounds':'Turn ride sounds on');$('sound').title=state.sound?'Mute ride sounds':'Turn ride sounds on';}
async function unlockSound(){
  if(!state.sound)return;
  const ready=await audio.unlock();
  if(!state.sound){audio.setEnabled(false);return;}
  if(!ready){state.sound=false;audio.setEnabled(false);syncSoundUI();toast('Sound is unavailable in this browser.','You can still enjoy the ride.');return;}
  audio.setEnabled(true);
  if(state.phase==='riding')audio.resume();else audio.suspend();
}
function startRide(){
  if(!state.ready||learning?.isOpen)return;clearInput();Object.assign(state,{distance:startDistance,traveled:0,speed:6,elapsed:0,score:0,perfect:0,lap:1,fuel:100,maxSpeed:0,lookX:0,lookY:0,cameraSnap:true,practiced:0});
  learning.beginRide();assignGateWords();
  gates.forEach(g=>{g.distance=g.baseDistance;g.done=false;g.perfect=false;g.group.visible=true;g.material.color.set(0xf4bf69);g.material.emissive.set(0xd28e29);g.sign.visible=true;});
  particleLife=0;particleMaterial.opacity=0;setPhase('riding');modal(null);setCamera('front');updateTrain();updateHUD();unlockSound();
  learning.unlock();if(gates[0].entry)learning.present(gates[0].entry,{collect:false});
  toast('A new word around every turn.',state.mode==='thrill'?'Collect words. Match the speed for a bonus.':'Listen, repeat, and enjoy the coast.',3.2);
}
function home(){clearInput();setPhase('menu');modal(null);state.distance=startDistance;state.cameraSnap=true;state.lookX=0;state.lookY=0;state.toastTime=0;$('toast').classList.remove('show');gates.forEach(g=>g.group.visible=false);updateTrain();updateHUD();audio.suspend();}
function pauseRide(){if(state.phase!=='riding')return;clearInput();setPhase('paused');modal('pause');audio.suspend();setTimeout(()=>$('resume').focus(),50);}
function resumeRide(){if(state.phase!=='paused')return;modal(null);setPhase('riding');clearInput();audio.resume();unlockSound();}
function showHelp(){state.helpFrom=state.phase;if(state.phase==='riding'){clearInput();setPhase('paused');audio.suspend();}modal('help');setTimeout(()=>$('close-help').focus(),40);}
function closeHelp(){if(state.helpFrom==='riding'){modal(null);setPhase('riding');audio.resume();unlockSound();}else if(state.helpFrom==='paused'){modal('pause');}else if(state.helpFrom==='results'){modal('results');}else modal(null);}
function setCamera(type){state.camera=type;state.cameraSnap=true;state.lookX=0;state.lookY=0;for(const el of document.querySelectorAll('.camera')){const selected=el.dataset.camera===type;el.classList.toggle('active',selected);el.setAttribute('aria-pressed',String(selected));}}
function formatTime(seconds){return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;}
function finishRide(){
  clearInput();setPhase('results');modal('results');audio.finish();state.cameraSnap=true;
  $('result-score').textContent=state.score.toLocaleString();$('result-perfect').textContent=`${state.perfect}/8`;$('result-max').textContent=Math.round(state.maxSpeed*3.6);$('result-time').textContent=formatTime(state.elapsed);
  $('result-title').textContent=state.perfect===8?'Pure sunshine.':state.perfect>=5?'What a ride.':'Chasing sunshine.';
  $('result-message').textContent=`${state.practiced} learning gates collected · ${state.perfect} perfect speed ${state.perfect===1?'bonus':'bonuses'}. Replay your discoveries in the word basket.`;
  try{const best=Number(localStorage.getItem('suncoast-best')||0);const newBest=Math.max(best,state.score);localStorage.setItem('suncoast-best',String(newBest));$('personal-best').textContent=state.score>best?'✦ A NEW PERSONAL BEST':`PERSONAL BEST · ${newBest.toLocaleString()} POINTS`;}catch{$('personal-best').textContent='A LITTLE ADVENTURE, WELL EARNED';}
}
function crossGate(gate){gate.done=true;gate.perfect=state.mode==='thrill'&&state.speed*3.6>=gate.min&&state.speed*3.6<=gate.max;state.score+=gate.perfect?300:100;if(gate.perfect)state.perfect++;state.practiced++;gate.material.color.set(0x75c390);gate.material.emissive.set(0x4d9367);gate.sign.visible=false;burst(track.getFrame(gate.distance).position.add(v3(0,3,0)),true);audio.chime(gate.perfect);if(gate.entry)learning.present(gate.entry,{collect:true});toast(gate.perfect?'+300 · Perfect pace and a new discovery!':gate.entry?.kind==='sentence'?'Sentence collected.':'Word collected.',gate.entry?.text||gate.name,2.1);}

function simulate(dt){
  let remaining=dt;
  while(remaining>0){const h=Math.min(remaining,1/90);const lift=getSection(state.distance).type==='lift';const boostPower=state.boost&&state.fuel>0&&!state.brake&&!lift?Math.min(1,state.fuel/(27*h)):0;state.speed=nextSpeed(state.speed,state.distance,h,state.brake,boostPower);state.fuel=clamp(state.fuel-27*h*boostPower+(!state.boost?13*h:0),0,100);const travel=state.speed*h;state.distance+=travel;state.traveled+=travel;state.elapsed+=h;state.maxSpeed=Math.max(state.maxSpeed,state.speed);
    for(const gate of gates)if(!gate.done&&state.distance>=gate.distance)crossGate(gate);
    if(state.traveled>=trackLength*state.lap){if(state.mode==='thrill'){finishRide();break;}state.lap++;assignGateWords();gates.forEach(g=>{g.distance=g.baseDistance+(state.lap-1)*trackLength;g.done=false;g.perfect=false;g.sign.visible=true;g.material.color.set(0xf4bf69);g.material.emissive.set(0xd28e29);});if(gates[0].entry)learning.present(gates[0].entry,{collect:false});toast('New lap. New words.',`Lap ${state.lap} · Your lesson keeps rolling.`,3);}
    remaining-=h;
  }
}

const cameraTarget=v3(),cameraPosition=v3(),lookDirection=v3(),targetUp=v3(0,1,0),smoothedUp=v3(0,1,0);
let orbitTime=0;
function updateCamera(dt,time){
  if(state.phase==='menu'||state.phase==='loading'||state.phase==='results'){
    orbitTime+=dt*.022;const a=.62+Math.sin(orbitTime)*.15;const portrait=innerHeight>innerWidth;
    cameraPosition.set(Math.cos(a)*(portrait?240:215),portrait?173:146,Math.sin(a)*(portrait?265:245));
    cameraTarget.set(portrait?0:-9,portrait?18:15,portrait?0:-5);
    targetUp.set(0,1,0);
  }else{
    const frame=track.getFrame(state.distance);
    if(state.camera==='front'){
      cameraPosition.copy(frame.position).addScaledVector(frame.up,2.28).addScaledVector(frame.tangent,.1);
      lookDirection.copy(frame.tangent).applyAxisAngle(frame.up,state.lookX).applyAxisAngle(frame.right,state.lookY);
      cameraTarget.copy(cameraPosition).addScaledVector(lookDirection,30);
      targetUp.copy(frame.up).lerp(v3(0,1,0),.1).normalize();
      const shake=state.speed>25?Math.sin(time*32)*.006*(state.speed/30):0;cameraPosition.addScaledVector(frame.up,shake);
    }else if(state.camera==='chase'){
      const angle=state.lookX;cameraPosition.copy(frame.position).addScaledVector(frame.tangent,-13*Math.cos(angle)).addScaledVector(frame.right,-13*Math.sin(angle)).addScaledVector(frame.up,6+state.lookY*5);
      cameraTarget.copy(frame.position).addScaledVector(frame.tangent,6).addScaledVector(frame.up,1.5);targetUp.set(0,1,0);
    }else{
      const a=.6+time*.012+state.lookX;cameraPosition.set(Math.cos(a)*225,142+state.lookY*30,Math.sin(a)*240);cameraTarget.set(-2,15,-4);targetUp.set(0,1,0);
    }
  }
  if(state.cameraSnap){camera.position.copy(cameraPosition);smoothedUp.copy(targetUp);state.cameraSnap=false;}else{
    const k=state.camera==='front'&&state.phase!=='menu'?28:state.camera==='chase'?8:3;camera.position.lerp(cameraPosition,1-Math.exp(-k*dt));smoothedUp.lerp(targetUp,1-Math.exp(-12*dt)).normalize();
  }
  camera.up.copy(smoothedUp);camera.lookAt(cameraTarget);
  const desiredFov=state.phase==='riding'&&state.camera==='front'?58+clamp(state.speed/43,0,1)*9:innerHeight>innerWidth?52:53;camera.fov=damp(camera.fov,desiredFov,3,dt);camera.updateProjectionMatrix();
  if(!state.dragging){state.lookX=damp(state.lookX,0,1.6,dt);state.lookY=damp(state.lookY,0,1.6,dt);}
}

let hudAccumulator=0;
function updateHUD(){
  const frame=track.getFrame(state.distance),section=getSection(state.distance);
  $('speed').textContent=Math.round(state.speed*3.6);$('speed-meter').style.width=`${Math.min(state.speed/43,1)*100}%`;$('altitude').textContent=Math.round(frame.position.y);
  $('score-label').textContent=state.mode==='thrill'?'THRILL SCORE':'PRACTICED';$('score').textContent=state.mode==='thrill'?state.score.toLocaleString():state.practiced;$('gate-count').textContent=`${gates.filter(g=>g.done).length} / 8 GATES`;
  $('ride-time').textContent=formatTime(state.elapsed);$('stage').textContent=section.type==='lift'?'THE SKY CLIMB · CHAIN LIFT':section.name.toUpperCase();$('boost-meter').style.width=state.fuel+'%';$('map-lap').textContent=state.phase==='menu'?'PARK MAP':`LAP ${String(state.lap).padStart(2,'0')}`;
  $('map-progress').textContent=state.phase==='menu'?'READY WHEN YOU ARE':`${Math.floor(((state.traveled%trackLength)/trackLength)*100)}% OF THE CIRCUIT`;
  const nextGate=gates.find(g=>!g.done);
  const showTarget=state.mode==='thrill'&&!!nextGate&&state.phase==='riding';$('gate-target').hidden=!showTarget;
  if(showTarget){$('gate-name').textContent=`GATE ${String(nextGate.index+1).padStart(2,'0')} · ${Math.ceil(Math.max(0,nextGate.distance-state.distance))} M AHEAD`;$('target-speed').innerHTML=`${nextGate.min}–${nextGate.max} <small>KM/H</small>`;
    const kmh=state.speed*3.6,inRange=kmh>=nextGate.min&&kmh<=nextGate.max;$('gate-target').classList.toggle('in-range',inRange);$('target-hint').textContent=section.type==='lift'?'Enjoy the climb. A drop is coming.':inRange?'Perfect pace. Hold it here.':kmh>nextGate.max?'Ease on the brake.':'A little boost will do it.';
  }
}
const map=$('minimap'),mapCtx=map.getContext('2d');
const mx=x=>200+(x+1)*1.78,mz=z=>120+(z+7)*1.29;
function drawMap(){
  const ctx=mapCtx;ctx.clearRect(0,0,400,240);
  ctx.fillStyle='#d8e9df';ctx.beginPath();ctx.ellipse(mx(34),mz(-36),50,30,-.2,0,Math.PI*2);ctx.fill();
  ctx.lineWidth=5;ctx.strokeStyle='#e6d7bc';ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();track.samples.forEach((p,i)=>{if(i===0)ctx.moveTo(mx(p.x),mz(p.z));else ctx.lineTo(mx(p.x),mz(p.z));});ctx.closePath();ctx.stroke();
  ctx.lineWidth=2.2;ctx.strokeStyle='#dc7653';ctx.stroke();
  if(state.phase!=='menu')for(const g of gates){const p=track.getFrame(g.distance).position;ctx.beginPath();ctx.arc(mx(p.x),mz(p.z),g.done?3:4.5,0,Math.PI*2);ctx.fillStyle=g.done?'#639e77':'#e2b962';ctx.fill();}
  const p=track.getFrame(state.distance).position;
  ctx.beginPath();ctx.arc(mx(p.x),mz(p.z),8,0,Math.PI*2);ctx.fillStyle='#fffaf0';ctx.fill();ctx.beginPath();ctx.arc(mx(p.x),mz(p.z),4.8,0,Math.PI*2);ctx.fillStyle='#2b5c48';ctx.fill();
}

for(const button of document.querySelectorAll('.mode'))button.addEventListener('click',()=>{state.mode=button.dataset.mode;for(const b of document.querySelectorAll('.mode')){const on=b===button;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));}});
$('start').addEventListener('click',startRide);$('home').addEventListener('click',e=>{e.preventDefault();home();});$('pause').addEventListener('click',pauseRide);$('resume').addEventListener('click',resumeRide);
$('restart').addEventListener('click',startRide);$('back-home').addEventListener('click',home);$('ride-again').addEventListener('click',startRide);$('results-home').addEventListener('click',home);
$('review-words').addEventListener('click',()=>learning.openBasket());
$('help').addEventListener('click',showHelp);$('close-help').addEventListener('click',closeHelp);$('help-done').addEventListener('click',closeHelp);
for(const button of document.querySelectorAll('.camera'))button.addEventListener('click',()=>setCamera(button.dataset.camera));
$('sound').addEventListener('click',()=>{state.sound=!state.sound;syncSoundUI();if(state.sound)unlockSound();else audio.setEnabled(false);});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('You already have the best view.','Rotate your phone for a wider ride.');}catch{toast('Full screen is unavailable here.','The ride works in this view.');}});
document.addEventListener('fullscreenchange',()=>{$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit full screen':'Full screen');});

function bindHold(element,property){
  const pointers=new Set();
  inputResetters.push(()=>{const captured=[...pointers];pointers.clear();for(const id of captured)if(element.hasPointerCapture(id))element.releasePointerCapture(id);});
  element.addEventListener('pointerdown',e=>{if(state.phase!=='riding')return;e.preventDefault();e.stopPropagation();pointers.add(e.pointerId);element.setPointerCapture(e.pointerId);state[property]=true;element.classList.add('pressed');unlockSound();});
  const release=e=>{pointers.delete(e.pointerId);if(!pointers.size){state[property]=false;element.classList.remove('pressed');}if(element.hasPointerCapture(e.pointerId))element.releasePointerCapture(e.pointerId);};
  element.addEventListener('pointerup',release);element.addEventListener('pointercancel',release);element.addEventListener('lostpointercapture',release);
  element.addEventListener('contextmenu',e=>e.preventDefault());
}
bindHold($('brake'),'brake');bindHold($('boost'),'boost');
let lookPointer=null,lastX=0,lastY=0;
inputResetters.push(()=>{const id=lookPointer;lookPointer=null;if(id!==null&&$('world').hasPointerCapture(id))$('world').releasePointerCapture(id);});
$('world').addEventListener('pointerdown',e=>{if(state.phase!=='riding'||lookPointer!==null)return;e.preventDefault();lookPointer=e.pointerId;state.dragging=true;lastX=e.clientX;lastY=e.clientY;$('world').setPointerCapture(e.pointerId);});
$('world').addEventListener('pointermove',e=>{if(e.pointerId!==lookPointer)return;state.lookX=clamp(state.lookX-(e.clientX-lastX)*.0045,-1.35,1.35);state.lookY=clamp(state.lookY+(e.clientY-lastY)*.0035,-.65,.65);lastX=e.clientX;lastY=e.clientY;});
const endLook=e=>{if(e.pointerId===lookPointer){lookPointer=null;state.dragging=false;}};
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('world').addEventListener(type,endLook);
$('world').addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('keydown',e=>{
  if(learning?.isOpen||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName||'')||e.target?.isContentEditable)return;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  if(e.repeat)return;
  if(e.code==='Escape'){if(!$('help-dialog').hidden)closeHelp();else if(state.phase==='riding')pauseRide();else if(state.phase==='paused')resumeRide();return;}
  if(e.code==='KeyP'){if(state.phase==='riding')pauseRide();else if(state.phase==='paused'&&$('help-dialog').hidden)resumeRide();return;}
  if(state.phase==='menu'&&e.code==='Enter'&&$('modal-backdrop').hidden){startRide();return;}
  if(state.phase!=='riding')return;
  if(e.code==='Space'||e.code==='ArrowDown'){state.brake=true;$('brake').classList.add('pressed');}
  if(e.code==='KeyW'||e.code==='ArrowUp'){state.boost=true;$('boost').classList.add('pressed');}
  if(e.code==='KeyC')setCamera(['front','chase','park'][(['front','chase','park'].indexOf(state.camera)+1)%3]);
  if(e.code==='KeyR')startRide();
});
window.addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='ArrowDown'){state.brake=false;$('brake').classList.remove('pressed');}if(e.code==='KeyW'||e.code==='ArrowUp'){state.boost=false;$('boost').classList.remove('pressed');}});
// Releasing a drag or changing focus never opens a pause overlay. Only explicit pause or a hidden tab does.
window.addEventListener('blur',clearInput);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.phase==='riding')pauseRide();});
window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();state.cameraSnap=true;});
$('world').addEventListener('webglcontextlost',e=>{e.preventDefault();audio.suspend();$('fatal').hidden=false;$('fatal-message').textContent='Your browser paused the 3D graphics. Reload the park to take another ride.';});

// Read-only diagnostics make it possible to verify the real running game without changing it.
Object.defineProperty(window,'suncoast',{value:{get status(){return {phase:state.phase,mode:state.mode,camera:state.camera,distance:state.distance,traveled:state.traveled,speed:state.speed,score:state.score,perfect:state.perfect,fuel:state.fuel,elapsed:state.elapsed,lap:state.lap,brake:state.brake,boost:state.boost,ready:state.ready,practiced:state.practiced,gateCount:gates.filter(g=>g.done).length,trackLength,learning:{learningLanguage:learning.lesson.learningLanguage,primaryLanguage:learning.lesson.primaryLanguage,settings:learning.settings,collectedCount:learning.collectedCount,isOpen:learning.isOpen},renderer:{drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles},gateTargets:gates.map(g=>({distance:g.distance,min:g.min,max:g.max,done:g.done,word:g.entry?.text}))};}},writable:false});

let previous=performance.now(),time=0;
function animate(now){requestAnimationFrame(animate);const dt=Math.min((now-previous)/1000,.05);previous=now;time+=dt;
  if(state.phase==='riding'){simulate(dt);updateTrain();}
  const onLift=getSection(state.distance).type==='lift';
  audio.update({speed:state.speed,lift:onLift,riding:state.phase==='riding',boost:state.boost&&state.fuel>0&&!state.brake&&!onLift},dt);
  if(state.phase!=='paused')park.update(time,dt);
  updateParticles(dt);updateCamera(dt,time);
  if(state.toastTime>0){state.toastTime-=dt;if(state.toastTime<=0)$('toast').classList.remove('show');}
  hudAccumulator+=dt;if(hudAccumulator>.08){hudAccumulator=0;if(state.phase==='riding')updateHUD();drawMap();}
  renderer.render(scene,camera);state.frameCount++;
}
state.ready=true;setPhase('menu');gates.forEach(g=>g.group.visible=false);$('start').disabled=false;drawMap();updateCamera(.1,0);renderer.render(scene,camera);$('loading').classList.add('fade');setTimeout(()=>$('loading').hidden=true,650);requestAnimationFrame(animate);
