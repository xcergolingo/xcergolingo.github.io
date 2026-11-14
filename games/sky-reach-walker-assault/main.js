import * as THREE from './vendor/three.module.js';
import {createFighter,createWalker,animateWalker,createCapital,createPilot} from './models.js';
import {createWorld} from './worlds.js';
import {createSky} from './sky.js';
import {GameAudio} from './audio.js';
import {Effects} from './effects.js';
import {learning} from './lesson.js';
import {createLearningUI} from './learning-ui.js';
import {WordSignals} from './word-signals.js';

// Every destination lives in this scene. Travel moves the ship and camera;
// surface, atmosphere, fleet and exploration never exchange scenes.
const $=id=>document.getElementById(id);
const clamp=THREE.MathUtils.clamp, lerp=THREE.MathUtils.lerp;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const damp=(a,b,k,dt)=>lerp(a,b,1-Math.exp(-k*dt));
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const UP=V(0,1,0),ZERO=V(),temp=V(),temp2=V(),temp3=V(),direction=V(),right=V(),q=new THREE.Quaternion();
const stage=$('stage'),canvas=$('view');
const isTouch=matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0;
document.body.classList.toggle('touch',isTouch);
stage.classList.toggle('rotated',isTouch&&innerHeight>innerWidth);
let state,lessonWasPaused=false;
const lessonUI=createLearningUI(learning,{
  stage,
  onOpen(){lessonWasPaused=!!state?.paused;if(state){state.paused=true;releaseAll();document.exitPointerLock?.();}learning.setRunning(false);},
  onClose(){if(state){state.paused=lessonWasPaused;releaseAll();learning.setRunning(state.started&&!state.paused);}},
  onToast(message){if(state)toast(message);}
});
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,isTouch?1.35:1.65));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.16;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0xb7d3be,.00016);
const camera=new THREE.PerspectiveCamera(65,1,.35,300000);
const hemi=new THREE.HemisphereLight(0xe0f2ed,0x635c43,2.2);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffefd2,3.5);sun.position.set(-400,700,250);sun.castShadow=true;
sun.shadow.mapSize.set(isTouch?1024:1536,isTouch?1024:1536);
sun.shadow.camera.left=-240;sun.shadow.camera.right=240;sun.shadow.camera.top=240;sun.shadow.camera.bottom=-240;
sun.shadow.camera.near=1;sun.shadow.camera.far=1800;sun.shadow.normalBias=1.3;sun.shadow.bias=-.0003;
scene.add(sun,sun.target);
const fill=new THREE.DirectionalLight(0xb5d8ff,.7);fill.position.set(400,200,-500);scene.add(fill);
const sky=createSky(scene), audio=new GameAudio(), effects=new Effects(scene);
const worlds=new Map();
const definitions=[
  {id:'elysia',name:'ELYSIA',climate:'Mild · 21°C',offset:V(),color:0x456a4b,atmosphere:0x94cfc0},
  {id:'vesper',name:'VESPER',climate:'Toxic spores · −34°C',offset:V(26000,0,-18000),color:0x754575,atmosphere:0xb4d6a2},
  {id:'sahra',name:'SAHRA',climate:'Dry winds · 46°C',offset:V(-29000,-1800,-28000),color:0xae7a4d,atmosphere:0xe7ba8b},
  {id:'nivalis',name:'NIVALIS',climate:'Ice storms · −68°C',offset:V(19000,-2600,-49000),color:0x91b2bd,atmosphere:0xc7e1ed}
];
for(const definition of definitions){
  const surface=createWorld(definition.id);surface.group.position.copy(definition.offset);scene.add(surface.group);
  const planet=new THREE.Mesh(new THREE.SphereGeometry(6470,64,40),new THREE.MeshStandardMaterial({color:definition.color,roughness:1,metalness:0}));
  planet.position.copy(definition.offset).add(V(0,-6500,0));scene.add(planet);
  const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(6620,40,28),new THREE.ShaderMaterial({transparent:true,side:THREE.BackSide,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{tint:{value:new THREE.Color(definition.atmosphere)},strength:{value:.18}},
    vertexShader:'varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
    fragmentShader:'uniform vec3 tint;uniform float strength;varying vec3 n;varying vec3 v;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),3.);gl_FragColor=vec4(tint,rim*strength);}'
  }));atmosphere.position.copy(planet.position);scene.add(atmosphere);
  worlds.set(definition.id,{...definition,...surface,planet,atmosphere,center:definition.offset.clone().add(V(0,-6500,0)),beaconWorld:surface.beacon.clone().add(definition.offset),mined:new Set()});
}
const elysia=worlds.get('elysia');
let stored={};try{stored=JSON.parse(localStorage.getItem('sky-reach-progress-v1')||'{}')}catch{}
state={started:false,paused:false,mode:'flight',world:'elysia',space:false,altitude:30,time:0,
  pos:V(9,elysia.height(9,92)+31,92),yaw:0,pitch:0,roll:0,speed:0,cruise:74,
  hull:100,shield:100,fuel:100,life:100,jetpack:100,crystals:Math.max(0,Number(stored.crystals)||0),cores:new Set((stored.cores||[]).filter(x=>worlds.has(x))),
  target:'vesper',assist:true,invert:true,muted:false,cable:null,travel:null,landing:null,verticalSpeed:0,fireCooldown:0,
  bannerUntil:0,toastUntil:0,damageFlash:0,criticalWarned:false,invincible:0,nearestWalker:null,nearestCrystal:null,
  lockedTarget:null,heldAction:false,flightTime:0,lastSafe:V(0,elysia.height(0,350)+120,350),lastSafeWorld:'elysia',context:'tow',mining:0,
  fleet:{active:false,entered:false,won:false,lostTimer:0,kills:0,halcyon:35,shield:100,dread:100,timer:0},down:0,
};
const ship=createFighter();ship.position.copy(state.pos);scene.add(ship);
const pilot=createPilot();pilot.visible=false;scene.add(pilot);
const parked=state.pos.clone();let footYaw=0,mouseX=0,mouseY=0,mouseActive=false,lookDrag=null;
const controls={keys:new Set(),steerX:0,steerY:0,boost:false,fire:false,climb:false,descend:false,brake:false,mine:false};
const walkers=[];
for(const [i,p] of [[0,[0,0]],[1,[-650,-620]],[2,[700,-1000]]]){
  const mesh=createWalker();mesh.position.set(p[0],elysia.height(...p),p[1]);mesh.rotation.y=[.05,-.38,.48][i];scene.add(mesh);
  walkers.push({mesh,index:i,base:mesh.position.clone(),down:false,fall:0,fireTimer:2+i*.9,footTimer:i*.8,phase:i*2.1});
}
const fleetCenter=V(0,5350,-5100),capitals={};
for(const [kind,position,angle] of [
  ['halcyon',V(-690,5240,-4700),.28],['dreadnought',V(850,5540,-6420),-.32],
  ['valiant',V(-1840,5660,-6650),.68],['ravager',V(2050,5310,-7180),-.48]
]){const mesh=createCapital(kind);mesh.position.copy(position);mesh.rotation.y=angle;scene.add(mesh);capitals[kind]={mesh,position,angle};}
const dreadShield=new THREE.Mesh(new THREE.SphereGeometry(1,40,24),new THREE.MeshBasicMaterial({color:0x79eb87,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
dreadShield.scale.set(395,250,700);dreadShield.position.copy(capitals.dreadnought.position);dreadShield.rotation.y=-.32;scene.add(dreadShield);
const shieldLines=new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(1,20,10)),new THREE.LineBasicMaterial({color:0x9efa9c,transparent:true,opacity:.065,depthWrite:false}));shieldLines.scale.copy(dreadShield.scale);shieldLines.position.copy(dreadShield.position);shieldLines.rotation.copy(dreadShield.rotation);scene.add(shieldLines);
const fighters=[];
for(let i=0;i<8;i++){const mesh=createFighter({enemy:true});mesh.scale.setScalar(1.35);scene.add(mesh);fighters.push({mesh,index:i,hp:3,alive:true,pos:V(),prev:V(),velocity:V(),phase:i*Math.PI/4,fireTimer:3+i*.4,hitFlash:0});}
const actorWordCache=new Map(),wrongWordTimes=new Map();
function liveActors(kind){
  if(kind==='walker')return walkers.filter(x=>!x.down).map(x=>({id:x.index,position:x.mesh.position}));
  if(kind==='fighter')return fighters.filter(x=>x.alive).map(x=>({id:x.index,position:x.pos}));
  const w=worlds.get(state.world);
  return w.crystals.map((x,i)=>({id:i,position:x.position.clone().add(w.offset)})).filter(x=>!w.mined.has(x.id));
}
function actorWord(kind,id){
  const snap=learning.getSnapshot(),choices=learning.getChoices();
  if(!snap.enabled||!choices.length)return null;
  if(snap.mode==='learn')return choices[0];
  const alive=liveActors(kind),key=`${kind}:${state.world}:${snap.question.id}:${alive.map(x=>x.id).join(',')}`;
  let cache=actorWordCache.get(kind);
  if(!cache||cache.key!==key){
    const ordered=alive.slice().sort((a,b)=>a.position.distanceToSquared(state.pos)-b.position.distanceToSquared(state.pos));
    const correct=choices.find(x=>learning.isCorrect(x.token))||choices[0],other=choices.filter(x=>x.token!==correct.token);
    let seed=0;for(const ch of String(snap.question.id))seed=((seed*31)+ch.charCodeAt(0))>>>0;
    const chosen=seed%Math.max(1,Math.min(3,ordered.length));
    const assignments=new Map();ordered.forEach((x,i)=>assignments.set(x.id,i===chosen||!other.length?correct:other[(i+seed)%other.length]));
    cache={key,assignments};actorWordCache.set(kind,cache);
  }
  return cache.assignments.get(id)||choices.find(x=>learning.isCorrect(x.token))||choices[0];
}
function actorTitle(kind,id,fallback){const snap=learning.getSnapshot();if(!snap.enabled||!snap.settings.showMarkers)return fallback;const choice=actorWord(kind,id);return choice?learning.textFor(choice.entry):fallback;}
function onLanguageAnswer(result,{position=state.pos,source='signal'}={}){
  if(!result||['stale','disabled','cooldown','invalid'].includes(result.reason))return;
  if(result.correct){
    if(source==='flight'||source==='cannon'){state.crystals+=2;saveProgress();}
    effects.burst(position.clone(),0x99fff0,12,source==='flight'||source==='cannon'?4:1.5);audio.play('crystal',.35);
    const text=learning.textFor(result.entry);toast(`Collected · ${text.length>46?text.slice(0,43)+'…':text}`);
  }else{effects.burst(position.clone(),0xff967b,5,1.3);audio.play('ui',.3);toast('Try again · replay the prompt and choose its word');}
}
function completeWord(choice,source,position){
  if(!choice||!learning.getSnapshot().enabled)return {correct:true,entry:null,reason:'disabled'};
  const result=learning.answer(choice.token,{source});onLanguageAnswer(result,{position,source});return result;
}
function allowWordAction(kind,id,source,position){
  const choice=actorWord(kind,id),snap=learning.getSnapshot();
  if(!choice||!snap.enabled||snap.mode==='learn'||learning.isCorrect(choice.token))return true;
  const key=`${kind}:${id}`;
  if(state.time-(wrongWordTimes.get(key)??-99)>1.2){wrongWordTimes.set(key,state.time);completeWord(choice,source,position);}
  return false;
}
const wordSignals=new WordSignals({scene,labels:$('labels'),camera,learning,onAnswer:onLanguageAnswer});
learning.subscribe((snapshot,event)=>{stage.classList.toggle('learning-active',snapshot.enabled);stage.dataset.learningMode=snapshot.mode;});
function resetFleet(){
  Object.assign(state.fleet,{active:false,entered:false,won:false,lostTimer:0,kills:0,halcyon:35,shield:100,dread:100,timer:0});
  for(const f of fighters){f.alive=true;f.hp=3;f.mesh.visible=true;f.fireTimer=3+f.index*.4;}
  capitals.dreadnought.mesh.visible=true;dreadShield.visible=true;shieldLines.visible=true;
}
// Pooled luminous projectile capsules; world-space motion also drives hit tests.
const shots=[],shotCount=240;
const shotMesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,5),new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),shotCount);
shotMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);shotMesh.frustumCulled=false;scene.add(shotMesh);
const shotDummy=new THREE.Object3D(),shotColor=new THREE.Color();
for(let i=0;i<shotCount;i++){shotDummy.scale.setScalar(0);shotDummy.updateMatrix();shotMesh.setMatrixAt(i,shotDummy.matrix);}
function projectile(from,dir,owner='player',speed=1500,damage=1){
  if(shots.length>=shotCount)shots.shift();
  shots.push({pos:from.clone(),last:from.clone(),dir:dir.clone().normalize(),vel:speed,life:owner==='player'?2.2:4,owner,damage,color:owner==='hostile'?0xff9050:owner==='friendly'?0xd5fff0:0x8bffff});
}
function segmentDistance(point,a,b){const ab=temp3.subVectors(b,a),d=ab.lengthSq();const t=d?clamp(temp2.subVectors(point,a).dot(ab)/d,0,1):0;return temp.copy(a).addScaledVector(ab,t).distanceTo(point);}
const cableGeometry=new THREE.BufferGeometry();const cablePositions=new Float32Array(192*3);cableGeometry.setAttribute('position',new THREE.BufferAttribute(cablePositions,3));cableGeometry.setDrawRange(0,0);
const cableLine=new THREE.Line(cableGeometry,new THREE.LineBasicMaterial({color:0xc6fff0,transparent:true,opacity:.95,depthTest:true}));cableLine.frustumCulled=false;cableLine.visible=false;scene.add(cableLine);
const cableGlow=new THREE.Line(cableGeometry,new THREE.LineBasicMaterial({color:0x6ceacb,transparent:true,opacity:.45,depthTest:false}));cableGlow.frustumCulled=false;cableGlow.visible=false;scene.add(cableGlow);
const jetMaterial=new THREE.MeshBasicMaterial({color:0x9efff5,transparent:true,opacity:.65,blending:THREE.AdditiveBlending,depthWrite:false});
const pilotJets=[];for(const x of [-.21,.21]){const jet=new THREE.Mesh(new THREE.ConeGeometry(.085,.9,7),jetMaterial);jet.position.set(x,.7,.38);jet.rotation.z=Math.PI;pilot.add(jet);pilotJets.push(jet);}
const labels=[];
function makeLabel(name,type,getPosition,getText,visible=()=>true){
  const element=document.createElement('div');element.className=`world-label ${type}`;element.innerHTML='<strong></strong><small></small><i class="marker"></i>';element.querySelector('strong').textContent=typeof name==='function'?name():name;$('labels').appendChild(element);
  labels.push({element,name,getPosition,getText,visible});return element;
}
function range(d){return d>=1000?`${(d/1000).toFixed(d>=10000?1:2)} km`:`${Math.max(0,Math.round(d))} m`;}
for(const w of walkers)makeLabel(()=>actorTitle('walker',w.index,'WALKER'),'hostile vocabulary',()=>w.mesh.position.clone().add(V(0,98,0)),d=>'WALKER · '+range(d),()=>state.world==='elysia'&&!state.space&&!w.down);
makeLabel('LEG','leg',()=>{if(!state.cable)return V();return getLeg(state.cable.walker,0)},d=>range(d),()=>!!state.cable);
for(const [id,c] of Object.entries(capitals))makeLabel(id.toUpperCase(),id==='dreadnought'||id==='ravager'?'hostile':'friendly',()=>c.mesh.position.clone().add(V(0,id==='dreadnought'?300:160,0)),d=>range(d),()=>state.space&&state.pos.distanceTo(c.position)<22000&&!(id==='dreadnought'&&state.fleet.won));
for(const f of fighters)makeLabel(()=>actorTitle('fighter',f.index,'HOSTILE'),'hostile vocabulary',()=>f.pos.clone().add(V(0,22,0)),d=>'HOSTILE · '+range(d),()=>state.space&&state.fleet.active&&f.alive&&f.pos.distanceTo(state.pos)<2600);
for(const w of worlds.values()){
  makeLabel(w.id==='elysia'?'ANCIENT SPIRE':'WARP CORE','core',()=>w.beaconWorld.clone().add(V(0,55,0)),d=>`${state.cores.has(w.id)?'RECOVERED · ':''}${range(d)}`,()=>state.world===w.id&&!state.space&&state.pos.distanceTo(w.beaconWorld)<15000);
  makeLabel(w.name,'planet',()=>w.offset.clone().add(V(0,100,0)),d=>range(d),()=>state.space&&state.target===w.id&&state.pos.distanceTo(w.offset)>3000);
}
makeLabel('SHIP','friendly',()=>parked.clone().add(V(0,8,0)),d=>range(d),()=>state.mode==='foot');
for(const world of worlds.values())world.crystals.forEach((crystal,index)=>makeLabel(()=>actorTitle('crystal',index,'CRYSTALS'),'core vocabulary',()=>crystal.position.clone().add(world.offset).add(V(0,8,0)),d=>'CRYSTALS · '+range(d),()=>state.mode==='foot'&&state.world===world.id&&!world.mined.has(index)&&state.pos.distanceTo(crystal.position.clone().add(world.offset))<250));

function saveProgress(){try{localStorage.setItem('sky-reach-progress-v1',JSON.stringify({cores:[...state.cores],crystals:state.crystals}))}catch{}}
function announce(text,sub='',seconds=4,kicker='TACTICAL UPDATE'){$('banner-text').textContent=text;$('banner-sub').textContent=sub;$('banner-kicker').textContent=kicker;$('banner').classList.remove('hidden');state.bannerUntil=state.time+seconds;}
function toast(text){$('toast').textContent=text;$('toast').classList.remove('hidden');state.toastUntil=state.time+3;}
function headingVector(yaw=state.yaw,pitch=state.pitch){return V(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));}
function groundAt(world,position){return world.offset.y+world.height(position.x-world.offset.x,position.z-world.offset.z);}
function updateRegion(){
  let nearest=null,min=Infinity;
  for(const w of worlds.values()){
    const r=state.pos.distanceTo(w.center)-6500;if(r<min){min=r;nearest=w;}
    const dist=state.pos.distanceTo(w.offset);w.group.visible=dist<20000;w.atmosphere.visible=dist>1800;
  }
  state.world=nearest.id;
  const localR=Math.hypot(state.pos.x-nearest.offset.x,state.pos.z-nearest.offset.z);
  state.altitude=localR<6300?Math.max(0,state.pos.y-groundAt(nearest,state.pos)):Math.max(0,min);
  const wasSpace=state.space;state.space=min>(state.space?2200:2700);
  if(state.space&&!wasSpace&&state.started){audio.play('horn',.55);if(state.world==='elysia'&&!state.fleet.won&&(!state.travel||state.travel.target==='fleet'))enterFleet();else if(!state.travel)announce('OPEN SPACE','Select a destination · M map · J pulse',3,'NAVIGATION');}
  if(!state.space&&wasSpace&&state.started){state.fleet.active=false;announce(nearest.name,nearest.climate,3,'ATMOSPHERIC ENTRY');}
  const atmospheric=1-smooth(1000,4600,Math.max(0,min));
  sky.update(camera,atmospheric,state.world,state.time);
  scene.fog.color.set(state.world==='vesper'?0xa2bca0:state.world==='sahra'?0xd8bd98:state.world==='nivalis'?0xbad3e1:0xbcd7c7);
  scene.fog.density=.00014*atmospheric;
  hemi.intensity=lerp(.9,2.05,atmospheric);sun.intensity=lerp(3.2,3.5,atmospheric);
  sun.position.copy(state.pos).add(V(-400,700,250));sun.target.position.copy(state.pos);
  sun.shadow.camera.far=1800;
  for(const c of Object.values(capitals))c.mesh.visible=state.pos.distanceTo(fleetCenter)<33000&&!(c===capitals.dreadnought&&state.fleet.won);
  return nearest;
}
function getLeg(w,index){w.mesh.updateMatrixWorld(true);return w.mesh.userData.legs[index%4].anchor.getWorldPosition(V());}
function nearestWalker(){let closest=null,d=Infinity;for(const w of walkers){if(w.down)continue;const distance=state.pos.distanceTo(w.mesh.position.clone().add(V(0,31,0)));if(distance<d){d=distance;closest=w}}return closest?{walker:closest,distance:d}:null;}
function attachCable(){
  if(!state.started||state.mode!=='flight'||state.travel||state.landing)return;
  if(state.cable){state.cable=null;cableLine.visible=false;cableGlow.visible=false;toast('Cable released');return;}
  const n=nearestWalker();
  if(state.world!=='elysia'||state.space||!n||n.distance>190){toast('Move closer to a walker leg');return;}
  if(!allowWordAction('walker',n.walker.index,'walker',n.walker.mesh.position.clone().add(V(0,45,0))))return;
  const w=n.walker,angle=Math.atan2(state.pos.x-w.mesh.position.x,state.pos.z-w.mesh.position.z);
  state.cable={walker:w,phase:'wrapping',elapsed:0,angle,wraps:0,tension:0,away:null,wordChoice:actorWord('walker',w.index)};
  state.pitch=0;state.speed=42;audio.play('cable');announce('CABLE ATTACHED','Threading the legs · stay close',2,'TOW SYSTEM');
}
function updateCable(dt){
  const c=state.cable;if(!c)return false;
  c.elapsed+=dt;const w=c.walker;
  if(c.phase==='wrapping'){
    state.fuel=Math.min(100,state.fuel+dt*5);
    c.angle+=dt*1.5;c.wraps=Math.min(3,c.elapsed/1.12);
    const p=w.mesh.position.clone().add(V(Math.sin(c.angle)*72,30,Math.cos(c.angle)*72));
    state.pos.lerp(p,1-Math.exp(-3.4*dt));state.yaw=-c.angle+Math.PI/2;state.pitch=0;state.roll=damp(state.roll,-.35,4,dt);
    state.speed=72;
    if(c.elapsed>3.35){c.phase='wrapped';c.away=state.pos.clone().sub(w.mesh.position);c.away.y=.1;c.away.normalize();state.yaw=Math.atan2(c.away.x,-c.away.z);state.pitch=.07;audio.play('wrap');announce('LEGS WRAPPED! BOOST AWAY [SHIFT] TO PULL IT TIGHT','Hold BOOST to bring the giant down',5,'TOW CABLE LOCKED');}
  }else{
    const boosting=(controls.boost||controls.keys.has('ShiftLeft')||controls.keys.has('ShiftRight'))&&state.fuel>1;
    state.speed=damp(state.speed,boosting?170:15,3,dt);
    state.pos.addScaledVector(c.away,state.speed*dt);state.pos.y+=boosting?dt*14:dt*1.5;
    c.tension=clamp(c.tension+(boosting?.57:-.04)*dt,0,1);
    state.fuel=clamp(state.fuel+(boosting?-8:5)*dt,0,100);
    if(c.tension>=1){topple(w);return false;}
  }
  const vertices=[];vertices.push(ship.localToWorld(V(0,0,-5.5)));
  const wrapCount=Math.max(1,Math.ceil(c.wraps));
  for(let i=0;i<wrapCount*22;i++){
    const t=i/21*Math.PI*2,a=c.angle+t;
    vertices.push(w.mesh.position.clone().add(V(Math.sin(a)*23,9+(i/22)*2,Math.cos(a)*19)));
  }
  vertices.push(getLeg(w,2));
  for(let i=0;i<vertices.length;i++)cablePositions.set(vertices[i].toArray(),i*3);
  cableGeometry.attributes.position.needsUpdate=true;cableGeometry.setDrawRange(0,vertices.length);cableLine.visible=true;cableGlow.visible=true;
  return true;
}
function topple(w){
  if(w.down)return;const wordChoice=state.cable?.wordChoice||actorWord('walker',w.index);w.down=true;w.fall=.001;state.down++;state.cable=null;cableLine.visible=false;cableGlow.visible=false;
  audio.play('topple');effects.burst(w.mesh.position.clone().add(V(0,48,-20)),0xffaf63,65,14);effects.dust(w.mesh.position.clone().add(V(0,4,0)),22);
  state.hull=Math.min(100,state.hull+14);state.fuel=Math.min(100,state.fuel+25);
  announce(`WALKER DOWN · ${state.down} / 3`,state.down===3?'The hills are clear. Climb to defend the Halcyon · H / ORBIT':'Turn toward the next walker',5,'ASSAULT PROGRESS');
  completeWord(wordChoice,'walker',w.mesh.position.clone().add(V(0,40,0)));
  if(state.down===3)toast('Assault complete · H to climb to the fleet');
}
function enterFleet(){
  if(state.fleet.won||state.fleet.lostTimer)return;
  state.fleet.active=true;
  if(!state.fleet.entered){state.fleet.entered=true;announce('WEAPONS FREE','Defend the Halcyon · Destroy enemy fighters',5,'FLEET BATTLE');audio.play('horn');state.shield=100;}
}
function pulseTo(target=state.target){
  if(!state.started||state.mode==='foot'){toast('Return to your ship to engage pulse');return;}
  if(state.travel)return;
  if(state.mode==='landed')state.mode='flight';
  state.cable=null;cableLine.visible=false;cableGlow.visible=false;state.landing=null;state.target=target;
  const start=state.pos.clone(),destination=target==='fleet'?V(0,5440,-3300):worlds.get(target).offset.clone().add(V(0,worlds.get(target).height(0,810)+135,810));
  const startWorld=worlds.get(state.world),endWorld=target==='fleet'?elysia:worlds.get(target);
  const departure=start.clone().lerp(startWorld.offset,.15);departure.y=Math.max(start.y+2300,startWorld.offset.y+6600);
  const approach=destination.clone();approach.y=Math.max(destination.y+3000,endWorld.offset.y+7000);approach.z+=1800;
  const points=target==='fleet'?[start,start.clone().add(V(0,1500,-800)),V(0,4800,-2200),destination]:[start,departure,departure.clone().lerp(approach,.5).add(V(0,3200,0)),approach,destination];
  state.travel={curve:new THREE.CatmullRomCurve3(points,false,'catmullrom',.25),elapsed:0,duration:target==='fleet'?7.2:10,target};
  state.mode='flight';state.fleet.active=false;audio.play('pulse');announce(target==='fleet'?'CLIMBING TO ORBIT':'PULSE DRIVE ENGAGED',target==='fleet'?'Hold the line. The Halcyon is calling.':`Course set for ${target.toUpperCase()} · continuous approach`,3,'NAVIGATION');
  closeOverlays();
}
function updateTravel(dt){
  const t=state.travel;if(!t)return false;t.elapsed+=dt;
  const progress=clamp(t.elapsed/t.duration,0,1),ease=progress*progress*(3-2*progress);
  const next=t.curve.getPoint(ease),tangent=t.curve.getTangent(Math.min(.997,ease));
  state.speed=next.distanceTo(state.pos)/Math.max(dt,.001);state.pos.copy(next);
  state.yaw=Math.atan2(tangent.x,-tangent.z);state.pitch=Math.asin(clamp(tangent.y,-.85,.85));state.roll=damp(state.roll,Math.sin(progress*Math.PI*3)*.12,3,dt);
  if(progress===1){state.travel=null;state.pitch=0;state.yaw=0;state.roll=0;state.speed=targetIsFleet(t.target)?260:65;state.invincible=3;
    if(t.target==='fleet'){enterFleet();announce('WEAPONS FREE','Eight hostiles. Keep the Halcyon alive.',4,'FLEET BATTLE');}
    else announce(`${t.target.toUpperCase()} APPROACH`,'Slow and low · L or LAND for a gentle landing',4,'NAVIGATION');
  }
  return true;
}
function targetIsFleet(t){return t==='fleet';}
function beginLanding(){
  if(state.mode==='foot')return;
  if(state.mode==='landed'){takeoff();return;}
  if(state.travel)return;
  if(state.space||state.altitude>900){toast('Descend below 900 m to land');return;}
  const w=worlds.get(state.world);state.cable=null;cableLine.visible=false;cableGlow.visible=false;
  const spot=state.pos.clone();
  if(Math.hypot(spot.x-w.offset.x,spot.z-w.offset.z)>3500){spot.x=lerp(spot.x,w.offset.x,.3);spot.z=lerp(spot.z,w.offset.z,.3);}
  // Assisted touchdown near the visible exploration route remains a continuous approach.
  if(w.id!=='elysia'&&state.pos.distanceTo(w.offset)<1500){spot.copy(w.offset).add(V(0,0,320));}
  spot.y=groundAt(w,spot)+3.15;
  state.landing={start:state.pos.clone(),end:spot,elapsed:0,duration:3};state.pitch=0;
  announce('LANDING ASSIST','Braking · aligning with the surface',2.5,'FLIGHT SYSTEMS');
}
function updateLanding(dt){const l=state.landing;if(!l)return false;l.elapsed+=dt;const t=clamp(l.elapsed/l.duration,0,1),e=t*t*(3-2*t);state.pos.lerpVectors(l.start,l.end,e);state.speed=lerp(70,0,e);state.pitch=damp(state.pitch,0,4,dt);state.roll=damp(state.roll,0,4,dt);if(t>=1){state.landing=null;state.mode='landed';parked.copy(state.pos);state.speed=0;audio.play('land');announce('TOUCHDOWN','E / EXIT to explore on foot',3,'ENGINES OFF');}return true;}
function takeoff(){if(state.mode!=='landed')return;state.mode='flight';state.pos.y+=7;state.pitch=.14;state.speed=50;state.fuel=Math.min(100,state.fuel+25);audio.play('boost');announce('ENGINES ONLINE','Space / ↑ to climb',2,'FLIGHT SYSTEMS');}
function exitShip(){
  if(state.mode==='flight'){if(state.altitude<180)beginLanding();else toast('Land first · L / LAND');return;}
  if(state.mode==='landed'){
    parked.copy(state.pos);const w=worlds.get(state.world);state.pos.add(V(10,-3,0));state.pos.y=groundAt(w,state.pos)+.1;state.mode='foot';state.speed=0;state.verticalSpeed=0;footYaw=state.yaw;pilot.visible=true;state.life=Math.max(state.life,85);audio.play('land',.4);
    announce('SURFACE EXCURSION',state.crystals===0?'No crystals — mine glowing deposits with the multitool':'Follow the beacon. Recover the warp core.',4,'EXPLORATION');
  }else if(state.mode==='foot'){
    if(state.nearestCrystal&&state.nearestCrystal.distance<17){controls.mine=true;}
    else if(state.pos.distanceTo(parked)<25){state.pos.copy(parked);state.mode='landed';pilot.visible=false;state.life=100;state.jetpack=100;audio.play('ui');toast('Back aboard · L / LAUNCH');}
    else toast('Find glowing crystals, or return to your ship');
  }
}
function nearestDeposit(){let result=null,d=Infinity;const w=worlds.get(state.world);w.crystals.forEach((c,i)=>{if(w.mined.has(i))return;const distance=state.pos.distanceTo(c.position.clone().add(w.offset));if(distance<d){d=distance;result={crystal:c,index:i,distance,world:w}}});return result;}
function mine(dt){const n=state.nearestCrystal;if(!n||n.distance>17){state.mining=0;return;}state.mining+=dt;effects.beam(state.pos.clone().add(V(.5,1.4,0)),n.crystal.position.clone().add(n.world.offset).add(V(0,2.4,0)),0x8ef8e7,.08,.07);
  if(state.mining>1.25){state.mining=0;const point=n.crystal.position.clone().add(n.world.offset);if(!allowWordAction('crystal',n.index,'mining',point))return;const wordChoice=actorWord('crystal',n.index);const amount=n.crystal.amount||8;state.crystals+=amount;n.world.mined.add(n.index);n.crystal.mesh.visible=false;audio.play('crystal');effects.burst(point.clone().add(V(0,3,0)),0x9ef9ee,18,1.2);const learned=completeWord(wordChoice,'mining',point);toast(`+${amount} crystals${learned.correct&&learned.entry?' · word collected':''}`);saveProgress();state.nearestCrystal=null;}
}
function recoverCore(world){if(state.cores.has(world.id))return;state.cores.add(world.id);state.life=100;state.fuel=100;state.hull=Math.min(100,state.hull+35);state.crystals+=12;saveProgress();audio.play('core');effects.burst(world.beaconWorld.clone().add(V(0,12,0)),0xccffe8,50,6);
  const next=['vesper','elysia','sahra','nivalis'].find(x=>!state.cores.has(x));if(next)state.target=next;
  announce(state.cores.size===4?'DRIVE ONLINE':`WARP CORE RECOVERED · ${state.cores.size} / 4`,state.cores.size===4?'You found a way home. The sky is still yours.':`+12 crystals · Next signal: ${(next||'complete').toUpperCase()}`,6,'EXPLORATION');
  if(learning.getSnapshot().enabled&&learning.getSnapshot().settings.speech)learning.speakSentence();
}
function hitPlayer(amount){if(state.invincible>0||!state.started||state.mode==='foot')return;if(state.space&&state.shield>0){const absorbed=Math.min(state.shield,amount);state.shield-=absorbed;amount-=absorbed}state.hull=Math.max(0,state.hull-amount);state.damageFlash=.55;audio.play('damage',.45);if(state.hull<25&&!state.criticalWarned){state.criticalWarned=true;announce('HULL CRITICAL','Break away · Pulse to safety with J',4,'DAMAGE ALERT');}if(state.hull<=0)restoreShip();}
function restoreShip(){state.pos.copy(state.lastSafe);state.world=state.lastSafeWorld;state.hull=40;state.shield=60;state.fuel=Math.max(state.fuel,60);state.mode='flight';state.cable=null;state.travel=null;state.landing=null;state.pitch=.1;state.roll=0;state.speed=60;state.invincible=6;state.criticalWarned=false;pilot.visible=false;cableLine.visible=false;cableGlow.visible=false;state.damageFlash=1;wordSignals.reset();camera.position.copy(state.pos).add(V(0,23,65));announce('EMERGENCY RECOVERY','Restored to your last safe altitude · hull 40%',4,'FLIGHT SYSTEMS');}
function fireCannons(){
  if(state.mode==='foot'||state.mode==='landed'||state.travel||state.fireCooldown>0)return;
  state.fireCooldown=.115;audio.play('cannon',.5);
  let aim=headingVector();
  if(mouseActive&&!isTouch&&!document.pointerLockElement){const point=V(mouseX,mouseY,.5).unproject(camera);aim.copy(point).sub(camera.position).normalize();}
  const lock=findTarget(aim);
  if(state.assist&&lock){const predicted=lock.pos.clone();if(lock.fighter)predicted.addScaledVector(lock.fighter.velocity,Math.min(1.65,lock.distance/(state.space?2300:1450)));aim.copy(predicted).sub(state.pos).normalize();}
  right.crossVectors(aim,UP).normalize();
  for(const side of [-1,1])projectile(state.pos.clone().addScaledVector(aim,7).addScaledVector(right,side*3.5),aim,'player',state.space?2300:1450,1);
}
function findTarget(aim=headingVector()){
  let best=null,bestScore=-1;
  const consider=(pos,type,obj,radius)=>{const v=pos.clone().sub(state.pos),distance=v.length(),dot=v.normalize().dot(aim),angle=state.assist?(isTouch?.83:.86):.985;if(distance>3700||dot<angle)return;const score=dot-distance*.000018;if(score>bestScore){bestScore=score;best={pos:pos.clone(),distance,type,[type]:obj,radius};}};
  if(state.space){for(const f of fighters)if(f.alive&&state.fleet.active)consider(f.pos,'fighter',f,23);if(!state.fleet.won)consider(capitals.dreadnought.position,'capital',capitals.dreadnought,230);}
  else if(state.world==='elysia')for(const w of walkers)if(!w.down)consider(w.mesh.position.clone().add(V(0,63,0)),'walker',w,35);
  for(const signal of wordSignals.getTargets())if(signal.enabled)consider(signal.position,'signal',signal,signal.radius);
  return best;
}
function destroyFighter(f){if(!f.alive)return;const wordChoice=actorWord('fighter',f.index);f.alive=false;f.mesh.visible=false;state.fleet.kills++;state.fleet.halcyon=Math.min(75,state.fleet.halcyon+3);state.fuel=Math.min(100,state.fuel+6);state.shield=Math.min(100,state.shield+10);effects.burst(f.pos,0xffb66d,24,6);audio.play('topple',.25);completeWord(wordChoice,'fighter',f.pos);toast(`Hostile destroyed · ${state.fleet.kills} / 8`);if(state.fleet.kills===8)announce('FIGHTERS CLEARED','Break the dreadnought shield. Finish the fight.',4,'FLEET BATTLE');}
function updateShots(dt){
  for(let i=shots.length-1;i>=0;i--){const s=shots[i];s.last.copy(s.pos);s.pos.addScaledVector(s.dir,s.vel*dt);s.life-=dt;let hit=false;
    if(s.owner==='player'){
      hit=wordSignals.hitTest(s.last,s.pos);
      if(!hit&&state.space&&state.fleet.active){for(const f of fighters){if(!f.alive)continue;if(segmentDistance(f.pos,s.last,s.pos)<(state.assist?28:17)){if(allowWordAction('fighter',f.index,'fighter',f.pos)){f.hp-=s.damage;effects.burst(f.pos,0x91f5ed,4,1.8);if(f.hp<=0)destroyFighter(f);}hit=true;break;}}
        if(!hit&&!state.fleet.won&&segmentDistance(capitals.dreadnought.position,s.last,s.pos)<(state.fleet.shield>0?480:260)){if(state.fleet.shield>0){state.fleet.shield=Math.max(0,state.fleet.shield-1.65);dreadShield.material.opacity=.25;}else state.fleet.dread=Math.max(0,state.fleet.dread-1.45);effects.burst(s.pos,state.fleet.shield>0?0xb6ff91:0xffaa66,4,6);hit=true;}
      }else if(!hit&&state.world==='elysia'){for(const w of walkers)if(!w.down&&segmentDistance(w.mesh.position.clone().add(V(0,63,0)),s.last,s.pos)<34){effects.burst(s.pos,0xffb876,5,3);hit=true;break;}}
    }else if(s.owner==='hostile'&&segmentDistance(state.pos,s.last,s.pos)<9){hitPlayer(s.damage);hit=true;}
    if(s.life<=0||hit)shots.splice(i,1);
  }
  for(let i=0;i<shotCount;i++){
    const s=shots[i];if(s){shotDummy.position.copy(s.pos);shotDummy.quaternion.setFromUnitVectors(UP,s.dir);shotDummy.scale.set(s.owner==='player'?1.1:1.6,s.owner==='player'?22:35,s.owner==='player'?1.1:1.6);shotColor.set(s.color);shotMesh.setColorAt(i,shotColor);}else shotDummy.scale.setScalar(0);
    shotDummy.updateMatrix();shotMesh.setMatrixAt(i,shotDummy.matrix);
  }
  shotMesh.instanceMatrix.needsUpdate=true;if(shotMesh.instanceColor)shotMesh.instanceColor.needsUpdate=true;
}
function updateWalkers(dt){
  for(const w of walkers){
    if(!w.down){w.mesh.position.x=w.base.x+Math.sin(state.time*.035+w.phase)*18;w.mesh.position.z=w.base.z+Math.sin(state.time*.026+w.phase)*20;w.mesh.position.y=elysia.height(w.mesh.position.x,w.mesh.position.z);}
    else if(w.fall<1){w.fall=Math.min(1,w.fall+dt*.48);if(w.fall>.7&&w.fall-dt*.48<=.7){effects.dust(w.mesh.position.clone().add(V(0,3,-45)),28);effects.burst(w.mesh.position.clone().add(V(0,14,-40)),0xff9347,40,10);}}
    animateWalker(w.mesh,state.time+w.phase,1,w.fall);
    w.mesh.visible=state.pos.distanceTo(w.mesh.position)<16500;
    if(!w.down&&state.world==='elysia'&&!state.space){w.footTimer-=dt;if(w.footTimer<0){const leg=getLeg(w,Math.floor(state.time*.8+w.index)%4);effects.dust(leg,3.5);w.footTimer=1.2;if(state.pos.distanceTo(w.mesh.position)<260)audio.play('footfall',.25);}
      if(state.started&&state.pos.distanceTo(w.mesh.position)<1300){w.fireTimer-=dt;if(w.fireTimer<=0){const origin=w.mesh.position.clone().add(V(0,67,-38)),aim=state.pos.clone().sub(origin).normalize();projectile(origin,aim,'hostile',180,7);w.fireTimer=3.3+Math.random()*1.5;}}
    }
  }
}
function updateFleet(dt){
  const fleet=state.fleet;
  for(const f of fighters){
    f.prev.copy(f.pos);const t=state.time*.075+f.phase;
    if(f.index===0&&fleet.kills===0){f.pos.set(Math.sin(state.time*.17)*170,5420+Math.sin(state.time*.23)*75,-4080+Math.cos(state.time*.12)*140);}
    else f.pos.set(Math.sin(t)*1400,5410+Math.sin(t*2+f.index)*350,-5300+Math.cos(t)*1270);
    f.mesh.position.copy(f.pos);const move=f.pos.clone().sub(f.prev);f.velocity.copy(move).multiplyScalar(1/Math.max(dt,.001));if(move.lengthSq()>.01)f.mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(f.pos,f.pos.clone().add(move),UP));
    f.mesh.visible=f.alive&&state.pos.distanceTo(fleetCenter)<30000;
    if(fleet.active&&f.alive){f.fireTimer-=dt;if(f.fireTimer<0&&f.pos.distanceTo(state.pos)<2300){projectile(f.pos,state.pos.clone().add(V((Math.random()-.5)*35,(Math.random()-.5)*20,0)).sub(f.pos),'hostile',470,5);f.fireTimer=3.5+Math.random()*2;}}
  }
  dreadShield.visible=state.pos.distanceTo(fleetCenter)<30000&&fleet.shield>0&&!fleet.won;shieldLines.visible=dreadShield.visible;
  dreadShield.material.opacity=damp(dreadShield.material.opacity,.105+Math.sin(state.time*1.5)*.025,5,dt);
  if(state.space&&state.world==='elysia'&&state.pos.distanceTo(fleetCenter)<10000&&!state.travel&&!fleet.active&&!fleet.won&&!fleet.lostTimer)enterFleet();
  if(fleet.active&&state.pos.distanceTo(fleetCenter)>15000)fleet.active=false;
  if(fleet.active){
    fleet.timer+=dt;
    if(Math.floor(fleet.timer*1.7)!==Math.floor((fleet.timer-dt)*1.7)){
      const from=capitals[Math.random()>.5?'halcyon':'valiant'].position.clone().add(V(Math.random()*100-50,30,Math.random()*300-150));
      const to=capitals.dreadnought.position.clone().add(V(Math.random()*210-105,20,Math.random()*300-150));effects.beam(from,to,0xd4fff5,.22,2.3);
      effects.beam(capitals.ravager.position.clone().add(V(0,20,-150)),capitals.halcyon.position.clone().add(V(Math.random()*160-80,0,Math.random()*400-200)),0xffad6e,.28,3);
    }
    fleet.halcyon=Math.max(0,fleet.halcyon-dt*(8-fleet.kills)*.017-dt*(fleet.dread>0?.045:0));
    if(fleet.shield>0)fleet.shield=Math.max(0,fleet.shield-dt*.1);else if(fleet.dread>0)fleet.dread=Math.max(0,fleet.dread-dt*.07);
    if(fleet.halcyon<=0){fleet.active=false;fleet.lostTimer=5;announce('HALCYON LOST','Fleet regrouping · your exploration progress is safe',5,'FLEET BATTLE');audio.play('topple');effects.burst(capitals.halcyon.position,0xffb063,70,45);}
    if(fleet.kills===8&&fleet.shield<=0&&fleet.dread<=0&&!fleet.won){fleet.won=true;fleet.active=false;effects.burst(capitals.dreadnought.position,0xffb562,100,70);audio.play('topple');announce('HALCYON HOLDS','The way is clear. Pulse to Vesper and recover the warp core.',7,'FLEET SECURED');state.hull=Math.min(100,state.hull+35);state.shield=100;state.target='vesper';saveProgress();if(learning.getSnapshot().enabled&&learning.getSnapshot().settings.speech)learning.speakSentence();}
  }
  if(fleet.lostTimer>0){fleet.lostTimer-=dt;if(fleet.lostTimer<=0){resetFleet();if(state.space&&state.pos.distanceTo(fleetCenter)<10000)enterFleet();}}
}
function updateFlight(dt){
  if(updateTravel(dt)||updateLanding(dt))return;
  if(state.mode==='landed'){state.speed=0;state.fuel=Math.min(100,state.fuel+dt*5);return;}
  if(updateCable(dt))return;
  const k=controls.keys;
  let turn=(k.has('KeyD')||k.has('ArrowRight')?1:0)-(k.has('KeyA')||k.has('ArrowLeft')?1:0)+controls.steerX;
  let pitchInput=(k.has('KeyW')||k.has('ArrowUp')?1:0)-(k.has('KeyS')||k.has('ArrowDown')?1:0)+controls.steerY*(state.invert?1:-1);
  const up=controls.climb||k.has('Space'),down=controls.descend||k.has('ControlLeft')||k.has('KeyC');
  const boost=(controls.boost||k.has('ShiftLeft')||k.has('ShiftRight'))&&state.fuel>1;
  const brake=controls.brake||k.has('KeyB');
  state.yaw+=turn*dt*(state.space?.65:.85);
  state.pitch=clamp(state.pitch+pitchInput*dt*.75,-1.22,1.22);
  if(state.assist&&Math.abs(pitchInput)<.08&&!lookDrag&&!document.pointerLockElement)state.pitch=damp(state.pitch,0,state.space?.35:.9,dt);
  state.roll=damp(state.roll,-turn*.55,4,dt);
  const near=state.nearestWalker?.distance||9999;
  let desired=state.space?340:near<210&&state.down<3?43:110;
  if(boost)desired=state.space?690:280;if(brake)desired=state.space?75:12;
  if(up||down){state.pitch=damp(state.pitch,up?.72:-.38,3,dt);desired=Math.max(desired,up?230:65);}
  state.speed=damp(state.speed,desired,1.8,dt);direction.copy(headingVector());state.pos.addScaledVector(direction,state.speed*dt);
  if(up)state.pos.y+=dt*180;if(down)state.pos.y-=dt*45;
  state.fuel=clamp(state.fuel+(boost?-10.5:5)*dt,0,100);
  const w=worlds.get(state.world),localR=Math.hypot(state.pos.x-w.offset.x,state.pos.z-w.offset.z);
  if(!state.space&&localR<6300){const floor=groundAt(w,state.pos)+4.2;
    if(state.assist&&!down&&pitchInput>=-.1&&state.pos.y<floor+23){state.pos.y=damp(state.pos.y,floor+28,3,dt);state.pitch=Math.max(state.pitch,0);}
    if(state.pos.y<floor){hitPlayer(clamp(state.speed*.09,5,25));state.pos.y=floor+5;state.pitch=.18;state.speed*=.5;state.invincible=.8;effects.dust(state.pos.clone().add(V(0,-8,0)),4);}
    if(state.altitude>65&&state.hull>40&&!state.cable&&state.time%3<dt){state.lastSafe.copy(state.pos);state.lastSafeWorld=state.world;}
  }
  else if(!state.space&&state.pos.distanceTo(w.center)<6508){
    const outward=state.pos.clone().sub(w.center).normalize();
    state.pos.copy(w.center).addScaledVector(outward,6516);hitPlayer(12);state.pitch=.25;state.speed*=.65;state.invincible=1;
  }
  if(state.space&&state.shield<100)state.shield=Math.min(100,state.shield+dt*1.8);
}
function updateOnFoot(dt){
  const w=worlds.get(state.world),k=controls.keys;
  const lateral=(k.has('KeyD')||k.has('ArrowRight')?1:0)-(k.has('KeyA')||k.has('ArrowLeft')?1:0)+controls.steerX;
  const forward=(k.has('KeyW')||k.has('ArrowUp')?1:0)-(k.has('KeyS')||k.has('ArrowDown')?1:0)-controls.steerY;
  const magnitude=Math.min(1,Math.hypot(lateral,forward)),run=controls.boost||k.has('ShiftLeft');
  direction.set(Math.sin(footYaw),0,-Math.cos(footYaw));right.crossVectors(direction,UP);
  temp.copy(direction).multiplyScalar(forward).addScaledVector(right,lateral);if(temp.lengthSq()>1)temp.normalize();state.speed=magnitude*(run?16:10);state.pos.addScaledVector(temp,(run?16:10)*dt);
  if(magnitude>.08){state.yaw=Math.atan2(temp.x,-temp.z);pilot.rotation.y=-state.yaw;}
  const jet=(controls.climb||k.has('Space'))&&state.jetpack>0;
  if(jet){state.verticalSpeed=damp(state.verticalSpeed,13,4,dt);state.jetpack=Math.max(0,state.jetpack-dt*24);}else{state.verticalSpeed-=dt*21;state.jetpack=Math.min(100,state.jetpack+dt*15);}
  state.pos.y+=state.verticalSpeed*dt;const floor=groundAt(w,state.pos)+.08;
  if(state.pos.y<floor){state.pos.y=floor;state.verticalSpeed=0;}
  pilot.position.copy(state.pos);pilotJets.forEach(j=>j.visible=jet);
  for(let i=0;i<2;i++){pilot.userData.legs[i].rotation.x=Math.sin(state.time*10+i*Math.PI)*magnitude*.65;pilot.userData.arms[i].rotation.x=-Math.sin(state.time*10+i*Math.PI)*magnitude*.42;}
  state.nearestCrystal=nearestDeposit();
  if(controls.mine||k.has('KeyE'))mine(dt);else state.mining=0;
  if(!state.cores.has(w.id)&&state.pos.distanceTo(w.beaconWorld)<18)recoverCore(w);
  state.life=Math.max(0,state.life-dt*(w.id==='vesper'?.28:w.id==='nivalis'?.16:.05));
  if(state.life<25&&state.time%10<dt)toast('Life support low · return to the ship');
  if(state.life<=0){state.pos.copy(parked);state.mode='landed';pilot.visible=false;state.life=100;state.jetpack=100;announce('SUIT RECOVERY','Returned to ship · crystals and cores secured',4,'LIFE SUPPORT');}
}
function updateCamera(dt){
  let desired,look;
  if(state.mode==='foot'){direction.set(Math.sin(footYaw),0,-Math.cos(footYaw));desired=state.pos.clone().addScaledVector(direction,-7.5).add(V(0,4.2,0));look=state.pos.clone().addScaledVector(direction,5).add(V(0,1.8,0));camera.near=.18;}
  else{direction.copy(headingVector());const behind=state.travel?90:state.mode==='landed'?48:state.cable?69:60;
    desired=state.pos.clone().addScaledVector(direction,-behind).add(V(0,state.travel?28:19,0));look=state.pos.clone().addScaledVector(direction,state.travel?110:90).add(V(0,8,0));camera.near=.6;
    if(!state.started){desired=state.pos.clone().add(V(-38,15,70));look=V(-1,58,-35);}
  }
  const w=worlds.get(state.world);if(!state.space&&Math.hypot(desired.x-w.offset.x,desired.z-w.offset.z)<6000)desired.y=Math.max(desired.y,groundAt(w,desired)+3);
  camera.position.lerp(desired,1-Math.exp(-(state.travel?7:state.mode==='foot'?7:4)*dt));
  camera.lookAt(look);const boost=(controls.boost||controls.keys.has('ShiftLeft'))&&state.fuel>0;
  camera.fov=damp(camera.fov,state.travel?81:boost?73:state.mode==='foot'?62:65,3,dt);camera.updateProjectionMatrix();
}
function updateShip(dt){
  if(state.mode!=='foot'){ship.position.copy(state.pos);ship.quaternion.setFromEuler(new THREE.Euler(state.pitch,-state.yaw,state.roll,'YXZ'));}
  const thrust=state.mode==='landed'||state.mode==='foot'?.03:clamp(state.speed/150,.4,3.7);
  for(const jet of ship.userData.engines){jet.scale.y=damp(jet.scale.y,thrust*(.95+Math.sin(state.time*43)*.05),8,dt);jet.visible=thrust>.05;}
}
function updateLabels(){
  const width=stage.clientWidth,height=stage.clientHeight;
  for(const l of labels){if(!state.started||!l.visible()){l.element.style.display='none';continue;}const p=l.getPosition(),d=state.pos.distanceTo(p);temp.copy(p).project(camera);if(temp.z>1||temp.z<0||Math.abs(temp.x)>1.14||Math.abs(temp.y)>1.12){l.element.style.display='none';continue;}l.element.style.display='';l.element.style.left=`${(temp.x*.5+.5)*width}px`;l.element.style.top=`${(-temp.y*.5+.5)*height}px`;const title=typeof l.name==='function'?l.name():l.name;l.element.querySelector('strong').textContent=title;l.element.title=title;l.element.querySelector('small').textContent=l.getText(d);}
  const lock=state.lockedTarget;
  if(lock&&state.started&&state.mode==='flight'){temp.copy(lock.pos).project(camera);$('aim-lock').classList.toggle('hidden',temp.z>1);$('aim-lock').style.left=`${(temp.x*.5+.5)*width}px`;$('aim-lock').style.top=`${(-temp.y*.5+.5)*height}px`;}else $('aim-lock').classList.add('hidden');
}
let hudTick=0,previousMission='';
function setMeter(id,value){$(id+'-bar').style.width=`${clamp(value,0,100)}%`;$(id+'-value').textContent=`${Math.ceil(value)}%`;}
function contextState(){
  if(state.mode==='foot'){
    if(state.nearestCrystal&&state.nearestCrystal.distance<17)return{action:'mine',key:'E',label:state.mining?`MINING · ${Math.round(state.mining/1.25*100)}%`:'HOLD TO MINE',touch:'MINE',hint:'Hold to extract glowing crystals'};
    if(state.pos.distanceTo(parked)<25)return{action:'enter',key:'E',label:'ENTER SHIP',touch:'ENTER',hint:'Walk to the glowing deposits · Space / ↑ jetpack'};
    return{action:'explore',key:'↑',label:'JETPACK',touch:'JETPACK',hint:state.nearestCrystal?`Crystal deposit · ${Math.round(state.nearestCrystal.distance)} m`:'Follow the warp-core beacon'};
  }
  if(state.mode==='landed')return{action:'exit',key:'E',label:'EXIT SHIP',touch:'EXIT',hint:'L / BOOST to launch again'};
  if(state.travel)return{action:'travel',key:'J',label:'PULSE IN PROGRESS',touch:'PULSE',hint:'One continuous flight · approaching '+state.target.toUpperCase()};
  if(state.landing)return{action:'landing',key:'L',label:'LANDING ASSIST',touch:'LAND',hint:'Engines slowing · aligning with the ground'};
  if(state.cable)return{action:'boost',key:'⇧',label:state.cable.phase==='wrapped'?'HOLD BOOST · PULL IT TIGHT':'THREADING THE LEGS',touch:'BOOST',hint:state.cable.phase==='wrapped'?'Boost away until tension reaches 100%':'Tow assist is circling the walker'};
  if(state.space)return{action:'pulse',key:'J',label:`PULSE TO ${state.target.toUpperCase()}`,touch:'PULSE',hint:'Fire to engage · M to choose another destination'};
  if(state.world==='elysia'&&state.down<3&&state.nearestWalker&&state.nearestWalker.distance<190)return{action:'tow',key:'F',label:'TOW CABLE',touch:'TOW',hint:'Attach the cable to the nearest walker leg'};
  if(state.world==='elysia'&&state.down<3)return{action:'tow',key:'F',label:'TOW CABLE',touch:'TOW',hint:`Approach a walker · ${Math.round(state.nearestWalker?.distance||0)} m`};
  if(state.world==='elysia'&&state.down===3)return{action:'orbit',key:'H',label:'CLIMB TO THE FLEET',touch:'ORBIT',hint:'Or keep exploring · M system map'};
  return{action:'land',key:'L',label:'LAND ON '+state.world.toUpperCase(),touch:'LAND',hint:state.altitude>900?'Descend below 900 m':'Land, exit and follow the warp-core beacon'};
}
function updateHUD(dt){
  hudTick+=dt;if(hudTick<.08)return;hudTick=0;
  const world=worlds.get(state.world),fleet=state.fleet;
  $('world-name').textContent=state.space?'OPEN SPACE':world.name;$('world-climate').textContent=state.space?'Deep orbit · Navigation online':world.climate;
  $('speed').textContent=Math.round(state.speed);$('altitude').innerHTML=state.altitude>=1000?`${(state.altitude/1000).toFixed(2)} <small>km</small>`:`${Math.round(state.altitude)} <small>m</small>`;
  $('heading').textContent=`${String(Math.round((state.yaw*180/Math.PI+360)%360)).padStart(3,'0')}°`;
  for(const id of ['hull','shield','fuel','life','jetpack'])setMeter(id,state[id]);
  $('shield-meter').classList.toggle('hidden',!state.space);$('hull-bar').parentElement.parentElement.classList.toggle('low',state.hull<25);
  $('flight-stack').classList.toggle('hidden',state.mode==='foot');$('foot-stack').classList.toggle('hidden',state.mode!=='foot');
  $('crystal-count').textContent=state.crystals;$('target-name').textContent=state.target==='fleet'?'HALCYON':state.target.toUpperCase();
  $('core-count').textContent=`${state.cores.size}/4`;document.querySelectorAll('.diamonds i').forEach((x,i)=>x.classList.toggle('filled',i<state.cores.size));
  $('boost-pill').classList.toggle('active',controls.boost||controls.keys.has('ShiftLeft'));$('pulse-pill').classList.toggle('active',!!state.travel);
  $('fleet-strip').classList.toggle('hidden',!fleet.active);$('halcyon-percent').textContent=`${Math.ceil(fleet.halcyon)}%`;$('halcyon-bar').style.width=fleet.halcyon+'%';$('dread-percent').textContent=`${Math.ceil(fleet.dread)}%`;$('dread-bar').style.width=fleet.dread+'%';
  let mission,helper,number='01';
  if(fleet.active){mission='FLEET BATTLE · DEFEND<br>THE HALCYON';helper=`Destroy enemy fighters · ${fleet.kills} / 8${fleet.shield>0?' · shield '+Math.ceil(fleet.shield)+'%':''}`;number='02';}
  else if(state.world==='elysia'&&!state.space){mission=`WALKER ASSAULT <span>· ${state.down} / 3</span><br>DOWN`;helper=state.cable?'Cable attached · hold Boost when wrapped':state.down===3?'The hills are clear · H / ORBIT to climb':`Get closer · ${Math.round(state.nearestWalker?.distance||0)} m`;}
  else if(state.cores.size===4){mission='DRIVE ONLINE';helper='Four warp cores secured. Keep exploring.';number='04';}
  else{const recovered=state.cores.has(world.id);mission=`RECOVER THE WARP<br>CORE · ${state.space||recovered?state.target.toUpperCase():world.name}`;helper=recovered&&!state.space?'Core secured · return to ship · pulse to next world':state.mode==='foot'?'Follow the beacon · mine glowing deposits':state.space?'J pulse · T target · M map':'Land · exit · follow the beacon';number='03';}
  if(mission!==previousMission){$('objective-title').innerHTML=mission;previousMission=mission;}$('objective-helper').textContent=helper;$('mission-number').textContent=number;
  const c=contextState(),lesson=learning.getSnapshot();state.context=c.action;$('context-key').textContent=c.key;$('context-label').textContent=c.label;$('context-hint').textContent=lesson.enabled&&lesson.mode!=='learn'&&['tow','mine'].includes(c.action)?'Replay the prompt · choose its word':c.hint;$('touch-action').textContent=c.touch;
  $('tow-panel').classList.toggle('hidden',!state.cable);if(state.cable){const pc=state.cable.phase==='wrapping'?state.cable.wraps/3:state.cable.tension;$('tension-value').textContent=Math.round(pc*100)+'%';$('tension-bar').style.width=pc*100+'%';$('tow-instruction').textContent=state.cable.phase==='wrapping'?'THREADING THE LEGS':'PULL IT TIGHT · TENSION';}
  $('fire-button').style.opacity=state.mode==='foot'?'.45':'1';$('boost-button').classList.toggle('pressed',controls.boost);$('climb-button').classList.toggle('pressed',controls.climb);$('descend-button').classList.toggle('pressed',controls.descend);$('land-button').textContent=state.mode==='landed'?'LAUNCH':'LAND';
  stage.classList.toggle('is-fleet',fleet.active);stage.classList.toggle('on-foot',state.mode==='foot');
  if(state.time>state.bannerUntil)$('banner').classList.add('hidden');if(state.time>state.toastUntil)$('toast').classList.add('hidden');
}
function performContext(held=false){
  const action=contextState().action;
  if(action==='tow')attachCable();else if(action==='boost')controls.boost=true;else if(action==='pulse')pulseTo();else if(action==='land')beginLanding();else if(action==='orbit')pulseTo('fleet');
  else if(action==='exit'||action==='enter')exitShip();else if(action==='mine')controls.mine=true;else if(action==='explore')controls.climb=true;
}
function releaseContext(){controls.mine=false;controls.boost=false;controls.climb=false;}
function closeOverlays(){for(const id of ['map-overlay','help-overlay','pause-overlay'])$(id).classList.add('hidden');state.paused=false;releaseAll();learning.setRunning(state.started);}
function openOverlay(id){for(const name of ['map-overlay','help-overlay','pause-overlay'])$(name).classList.toggle('hidden',name!==id);state.paused=true;releaseAll();learning.setRunning(false);document.exitPointerLock?.();if(id==='map-overlay')refreshMap();}
function refreshMap(){document.querySelectorAll('.map-planet').forEach(button=>{button.classList.toggle('selected',button.dataset.target===state.target);const em=button.querySelector('em');if(em)em.textContent=state.cores.has(button.dataset.target)?'◆ CORE RECOVERED':'◇ WARP CORE';});$('map-target').textContent=state.target==='fleet'?'HALCYON FLEET':state.target.toUpperCase();$('map-description').textContent={elysia:'Green hills, siege walkers, and the light of the Ancient Spire.',vesper:'A pale beacon is waiting beneath the blue mushrooms.',sahra:'Amber dunes conceal another fragment of your warp drive.',nivalis:'A cold signal beyond the frozen ridges.',fleet:'A fleet in distress. Eight fighters and a shielded dreadnought.'}[state.target];}
function cycleTarget(){const order=['vesper','elysia','sahra','nivalis','fleet'];state.target=order[(order.indexOf(state.target)+1)%order.length];toast(`Target · ${state.target.toUpperCase()}`);refreshMap();}
function launch(){if(state.started)return;audio.unlock();learning.unlock();state.started=true;learning.setRunning(true);lessonUI.setGameplayVisible(true);state.speed=43;state.flightTime=0;$('intro').classList.add('hidden');$('hud').classList.remove('hidden');announce('GOLINGO · WORD FLIGHT','Fly through word signals · tow walkers · collect vocabulary',4,'SKY REACH');if(isTouch){const el=document.documentElement;try{const promise=el.requestFullscreen?.();promise?.then(()=>screen.orientation?.lock?.('landscape').catch(()=>{})).catch(()=>{})}catch{}}}
$('launch').addEventListener('click',launch);
$('land-button').onclick=beginLanding;
$('map-button').onclick=()=>openOverlay('map-overlay');$('help-button').onclick=()=>openOverlay('help-overlay');$('pause-button').onclick=()=>openOverlay('pause-overlay');
for(const id of ['close-map','close-help','resume-help','resume'])$(id).onclick=closeOverlays;
$('pause-map').onclick=()=>openOverlay('map-overlay');
$('audio-button').onclick=()=>{state.muted=!state.muted;audio.setMuted(state.muted);audio.unlock();$('audio-button').textContent=state.muted?'∅':'♪';$('audio-button').setAttribute('aria-label',state.muted?'Unmute game sounds':'Mute game sounds');};
document.querySelectorAll('.map-planet').forEach(button=>button.onclick=()=>{state.target=button.dataset.target;refreshMap();audio.play('ui',.4)});
$('map-pulse').onclick=()=>{closeOverlays();pulseTo();};
$('assist-setting').onchange=e=>state.assist=e.target.checked;$('invert-setting').onchange=e=>state.invert=e.target.checked;
$('reset-assault').onclick=()=>{state.cable=null;state.down=0;walkers.forEach(w=>{w.down=false;w.fall=0;});closeOverlays();pulseTo('elysia');toast('Walker assault reset');};
function pointerLogical(e){if(stage.classList.contains('rotated'))return{x:e.clientY-innerHeight/2+stage.clientWidth/2,y:-(e.clientX-innerWidth/2)+stage.clientHeight/2};return{x:e.clientX,y:e.clientY};}
function bindHold(id,key){const button=$(id);button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(state.paused)return;button.setPointerCapture(e.pointerId);controls[key]=true;button.classList.add('pressed');audio.unlock();if(key==='boost'&&state.mode==='landed')takeoff();});const end=e=>{e.preventDefault();controls[key]=false;button.classList.remove('pressed');};button.addEventListener('pointerup',end);button.addEventListener('pointercancel',end);button.addEventListener('lostpointercapture',()=>{controls[key]=false;button.classList.remove('pressed')});}
bindHold('fire-button','fire');bindHold('boost-button','boost');bindHold('climb-button','climb');bindHold('descend-button','descend');bindHold('brake-button','brake');
for(const id of ['touch-action','context-button']){const b=$(id);b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();b.setPointerCapture(e.pointerId);audio.unlock();performContext(true);});b.addEventListener('pointerup',releaseContext);b.addEventListener('pointercancel',releaseContext);b.addEventListener('lostpointercapture',releaseContext);}
$('orbit-button').onclick=()=>pulseTo('fleet');
let stickPointer=null,stickOrigin=null;
$('joystick').addEventListener('pointerdown',e=>{e.preventDefault();stickPointer=e.pointerId;$('joystick').setPointerCapture(e.pointerId);const r=$('joystick').getBoundingClientRect();stickOrigin=pointerLogical({clientX:r.left+r.width/2,clientY:r.top+r.height/2});updateStick(e);audio.unlock();});
function updateStick(e){if(e.pointerId!==stickPointer)return;const p=pointerLogical(e),radius=$('joystick').clientWidth*.38,dx=p.x-stickOrigin.x,dy=p.y-stickOrigin.y,len=Math.max(radius,Math.hypot(dx,dy));controls.steerX=clamp(dx/len,-1,1);controls.steerY=clamp(dy/len,-1,1);$('stick-knob').style.transform=`translate(${controls.steerX*radius}px,${controls.steerY*radius}px)`;}
$('joystick').addEventListener('pointermove',updateStick);function endStick(){stickPointer=null;controls.steerX=controls.steerY=0;$('stick-knob').style.transform='';}
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('joystick').addEventListener(event,endStick);
canvas.addEventListener('pointerdown',e=>{if(!state.started||state.paused)return;audio.unlock();if(isTouch||e.button===2){lookDrag={id:e.pointerId,last:pointerLogical(e)};canvas.setPointerCapture(e.pointerId);}else{controls.fire=true;if(!document.pointerLockElement){try{const promise=canvas.requestPointerLock?.();promise?.catch?.(()=>{});}catch{}}}});
canvas.addEventListener('pointermove',e=>{if(!state.started||state.paused)return;const p=pointerLogical(e);if(lookDrag&&lookDrag.id===e.pointerId){const dx=p.x-lookDrag.last.x,dy=p.y-lookDrag.last.y;if(state.mode==='foot')footYaw+=dx*.005;else{state.yaw+=dx*.003;state.pitch=clamp(state.pitch-dy*.003,-1.22,1.22);}lookDrag.last=p;}else if(document.pointerLockElement===canvas){state.yaw+=e.movementX*.0019;state.pitch=clamp(state.pitch-e.movementY*.0019,-1.22,1.22);if(state.mode==='foot')footYaw+=e.movementX*.002;}else if(!isTouch){mouseX=p.x/stage.clientWidth*2-1;mouseY=1-p.y/stage.clientHeight*2;mouseActive=true;$('reticle').style.left=p.x+'px';$('reticle').style.top=p.y+'px';}});
canvas.addEventListener('pointerup',()=>{lookDrag=null;controls.fire=false});canvas.addEventListener('pointercancel',()=>{lookDrag=null;controls.fire=false});canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement){mouseActive=false;$('reticle').style.left='50%';$('reticle').style.top='50%';}});
addEventListener('keydown',e=>{
  if(stage.classList.contains('lingo-panel-open')){if(e.code==='Escape')lessonUI.close();return;}
  if(e.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
  if(e.code==='KeyG'&&!e.repeat){e.preventDefault();lessonUI.open('lesson');return;}
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();
  if(!state.started){if(e.code==='Enter'||e.code==='Space')launch();return;}
  if(['Escape','KeyP'].includes(e.code)&&!e.repeat){state.paused?closeOverlays():openOverlay('pause-overlay');return;}
  if(e.code==='KeyM'&&!e.repeat){$('map-overlay').classList.contains('hidden')?openOverlay('map-overlay'):closeOverlays();return;}
  if(state.paused)return;controls.keys.add(e.code);
  if(e.repeat)return;
  if(e.code==='KeyF')attachCable();if(e.code==='KeyJ')pulseTo();if(e.code==='KeyT')cycleTarget();if(e.code==='KeyH')pulseTo('fleet');if(e.code==='KeyL')beginLanding();if(e.code==='KeyE')exitShip();
});
addEventListener('keyup',e=>{controls.keys.delete(e.code);if(e.code==='KeyE')controls.mine=false;});
function releaseAll(){controls.keys.clear();for(const k of ['boost','fire','climb','descend','brake','mine'])controls[k]=false;endStick();lookDrag=null;}
addEventListener('blur',()=>{releaseAll();if(state.started&&!state.paused)openOverlay('pause-overlay');});
document.addEventListener('visibilitychange',()=>{if(document.hidden){releaseAll();if(state.started&&!state.paused)openOverlay('pause-overlay');}});
function resize(){stage.classList.toggle('rotated',isTouch&&innerHeight>innerWidth);const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();
camera.position.copy(state.pos).add(V(-38,15,70));camera.lookAt(0,58,-35);
window.__skyReady=true;
// Read-only diagnostic snapshots make support reproducible without altering play.
window.skyReach={getState:()=>({started:state.started,paused:state.paused,mode:state.mode,world:state.world,space:state.space,position:state.pos.toArray(),altitude:Math.round(state.altitude),speed:Math.round(state.speed),hull:Math.round(state.hull),fuel:Math.round(state.fuel),crystals:state.crystals,cores:[...state.cores],down:state.down,cable:state.cable?{phase:state.cable.phase,tension:state.cable.tension,wraps:state.cable.wraps}:null,fleet:{...state.fleet},target:state.target,travel:state.travel?.target||null,nearestCrystal:state.nearestCrystal?{distance:state.nearestCrystal.distance,position:state.nearestCrystal.crystal.position.toArray()}:null,context:state.context,learning:{...learning.getSnapshot(),signals:wordSignals.getTargets()},renderer:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles},errors:window.__skyErrors})};
let last=performance.now(),fpsAverage=60,adaptiveTime=0;
function frame(now){
  requestAnimationFrame(frame);const raw=Math.max(.001,(now-last)/1000);last=now;const dt=Math.min(raw,.05);
  if(state.paused){learning.tick(dt);audio.update({speed:0,boost:false,space:state.space,onFoot:true,jetpack:false,pulse:false},dt);return;}
  state.time+=dt;state.fireCooldown=Math.max(0,state.fireCooldown-dt);state.invincible=Math.max(0,state.invincible-dt);state.damageFlash=Math.max(0,state.damageFlash-dt*1.6);
  if(state.started){state.flightTime+=dt;state.nearestWalker=nearestWalker();if(state.mode==='foot')updateOnFoot(dt);else updateFlight(dt);if(controls.fire)fireCannons();}
  updateShip(dt);updateRegion();updateWalkers(dt);updateFleet(dt);updateCamera(dt);
  wordSignals.update(dt,{position:state.pos,yaw:state.yaw,pitch:state.pitch,speed:state.speed,onFoot:state.mode==='foot',space:state.space,worldId:state.world,groundAt:p=>groundAt(worlds.get(state.world),p),active:state.started&&state.mode==='flight',paused:state.paused,cable:!!state.cable,travel:!!state.travel,landing:!!state.landing,viewport:{width:stage.clientWidth,height:stage.clientHeight}});
  updateShots(dt);effects.update(dt,state.time);learning.tick(dt);
  if(state.mode!=='foot')state.nearestCrystal=null;
  for(const w of worlds.values())if(w.group.visible)w.update(state.time);
  state.lockedTarget=findTarget();updateLabels();updateHUD(dt);
  $('damage-flash').style.opacity=state.damageFlash;$('speed-lines').style.opacity=state.travel?.65:(controls.boost||controls.keys.has('ShiftLeft'))?.2:0;
  audio.update({speed:state.speed,boost:controls.boost||controls.keys.has('ShiftLeft'),space:state.space,onFoot:state.mode==='foot'||state.mode==='landed',jetpack:state.mode==='foot'&&(controls.climb||controls.keys.has('Space')),pulse:!!state.travel},dt);
  renderer.render(scene,camera);
  fpsAverage=lerp(fpsAverage,1/raw,.02);adaptiveTime+=dt;
  if(adaptiveTime>8&&fpsAverage<29&&renderer.getPixelRatio()>1){renderer.setPixelRatio(1);renderer.setSize(stage.clientWidth,stage.clientHeight,false);adaptiveTime=0;}
}
requestAnimationFrame(frame);
