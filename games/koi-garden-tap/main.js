import * as THREE from 'three';
import { createLesson } from './words.js?v=3';
import { createKoi, animateKoi, disposeKoi } from './koi.js?v=2';
import { createWater } from './water.js?v=2';

const canvas = document.querySelector('#pond');
const host = document.querySelector('#experience');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#b9d8cc');
scene.fog = new THREE.FogExp2('#b9d8cc', 0.012);
const camera = new THREE.OrthographicCamera(-10,10,10,-10,.1,60);
camera.position.set(0,23,2.8);camera.up.set(0,0,-1);camera.lookAt(0,0,-.25);
function fitView(){const aspect=innerWidth/innerHeight,height=Math.min(20.5,20.5/aspect);camera.top=height/2;camera.bottom=-height/2;camera.left=-height*aspect/2;camera.right=height*aspect/2;camera.updateProjectionMatrix();}
fitView();
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.autoUpdate=false;
const causticTime={value:0};

const hemi = new THREE.HemisphereLight(0xe8fff2, 0x527565, 1.2); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff5d7, 2.35); sun.position.set(-7, 14, -4); sun.castShadow = true; sun.shadow.mapSize.set(1024,1024); sun.shadow.camera.left = -12; sun.shadow.camera.right = 12; sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -12; sun.shadow.bias = -0.0003; scene.add(sun);
const fill = new THREE.PointLight(0x8ee5d1, 35, 22, 2); fill.position.set(4, 5, 5); scene.add(fill);

// Procedural skylight gives the wet skin and membranes broad, natural highlights.
const studio=new THREE.Scene();studio.background=new THREE.Color(0xbad7cf);
const softbox=new THREE.Mesh(new THREE.PlaneGeometry(7,10),new THREE.MeshBasicMaterial({color:new THREE.Color(2.3,2.1,1.75)}));softbox.position.set(-4,8,0);softbox.rotation.x=Math.PI/2;studio.add(softbox);
const reflection=new THREE.Mesh(new THREE.SphereGeometry(3,12,8),new THREE.MeshBasicMaterial({color:new THREE.Color(1.2,1.55,1.5)}));reflection.position.set(4,3,-6);studio.add(reflection);
const pmrem=new THREE.PMREMGenerator(renderer);const environment=pmrem.fromScene(studio,.04, .1,40);scene.environment=environment.texture;pmrem.dispose();

const pondRadius = 9.25;
const floorY = -1.38;
const waterY = 0.18;
const pond = new THREE.Group(); scene.add(pond);

function causticTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#69bbaa'; ctx.fillRect(0,0,512,512);
  for (let i=0;i<230;i++) {
    const x=Math.random()*512,y=Math.random()*512,r=4+Math.random()*19;
    const g=ctx.createRadialGradient(x,y,0,x,y,r); g.addColorStop(0,'rgba(225,255,210,.17)'); g.addColorStop(1,'rgba(215,255,235,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  }
  ctx.globalCompositeOperation='screen';
  for(let j=0;j<80;j++){
    const x=Math.random()*512,y=Math.random()*512;
    ctx.strokeStyle='rgba(221,255,229,.18)';ctx.lineWidth=1+Math.random()*2;ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+15,y-14,x+22,y+19,x+41,y+9);ctx.stroke();
  }
  const tex=new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(3,3); tex.colorSpace=THREE.SRGBColorSpace; return tex;
}
const caustics=causticTexture();
const bed = new THREE.Mesh(new THREE.CircleGeometry(pondRadius, 112), new THREE.MeshStandardMaterial({ color:0xd2dabc, map:caustics, roughness:.82, metalness:0 }));
bed.rotation.x=-Math.PI/2; bed.position.y=floorY; bed.receiveShadow=true; pond.add(bed);
bed.material.onBeforeCompile=shader=>{shader.uniforms.uCausticTime=causticTime;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vFloorWorld;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvFloorWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uCausticTime; varying vec3 vFloorWorld;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\nvec2 cp=vFloorWorld.xz*2.0; cp+=vec2(sin(cp.y*1.3+uCausticTime*0.32),cos(cp.x*1.1-uCausticTime*0.3))*0.8; float ca=pow(1.0-abs(sin(cp.x+cp.y*0.6+uCausticTime*0.42)*sin(cp.y*1.2-cp.x*0.7-uCausticTime*0.36)),15.0); totalEmissiveRadiance+=vec3(0.33,0.47,0.31)*ca;');};

const sand = new THREE.Mesh(new THREE.CircleGeometry(pondRadius*.99,112),new THREE.MeshStandardMaterial({color:0x91b8a1,roughness:1})); sand.rotation.x=-Math.PI/2; sand.position.y=floorY-.018; pond.add(sand);

// Fine pebbles break up the pond bed and make the shallow areas feel dimensional.
const pebbleGeo=new THREE.DodecahedronGeometry(.045,0);
const pebbleMats=[0x9dc4aa,0x739e8a,0xc2c7a4,0x6a9888].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.95}));
const pebbleCount=640, pebbleMesh=new THREE.InstancedMesh(pebbleGeo,pebbleMats[0],pebbleCount);
const dummy=new THREE.Object3D();
for(let i=0;i<pebbleCount;i++){
  const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*(pondRadius-.35);
  dummy.position.set(Math.cos(a)*r,floorY+.025,Math.sin(a)*r); dummy.scale.set(.45+Math.random()*1.2,.3+Math.random()*.65,.45+Math.random()*1.2); dummy.rotation.set(Math.random()*2,Math.random()*2,Math.random()*2); dummy.updateMatrix(); pebbleMesh.setMatrixAt(i,dummy.matrix); pebbleMesh.setColorAt(i,new THREE.Color(pebbleMats[Math.floor(Math.random()*pebbleMats.length)].color));
}
pebbleMesh.instanceMatrix.needsUpdate=true; pebbleMesh.castShadow=true; pebbleMesh.receiveShadow=true; pond.add(pebbleMesh);

// Render the pond below the surface, then refract it through moving waves.
const surface=createWater(pondRadius,waterY);pond.add(surface.mesh);surface.resize(innerWidth,innerHeight);

// Natural stone edge, with mossy inner lip and tiny reed groups.
const rim = new THREE.Mesh(new THREE.TorusGeometry(pondRadius-.03,.34,10,160),new THREE.MeshStandardMaterial({color:0x8c9e85,roughness:.92})); rim.rotation.x=Math.PI/2; rim.position.y=-.22; rim.castShadow=true;rim.receiveShadow=true;pond.add(rim);
const innerLip=new THREE.Mesh(new THREE.TorusGeometry(pondRadius-.34,.105,8,160),new THREE.MeshStandardMaterial({color:0x587f6e,roughness:.8})); innerLip.rotation.x=Math.PI/2;innerLip.position.y=.04;pond.add(innerLip);
const rockGeo=new THREE.DodecahedronGeometry(.34,1);
const rockMats=[0x8a9a81,0x748e7d,0xa6a78c,0x6d8276].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:1}));
for(let i=0;i<48;i++){const a=i/48*Math.PI*2+(Math.random()-.5)*.06;const r=pondRadius-.05+(Math.random()-.5)*.18;const m=new THREE.Mesh(rockGeo,rockMats[i%rockMats.length]);m.position.set(Math.cos(a)*r,-.19+Math.random()*.07,Math.sin(a)*r);m.scale.set(.75+Math.random()*.65,.5+Math.random()*.55,.65+Math.random()*.7);m.rotation.set(Math.random()*.6,Math.random()*6,Math.random()*.6);m.castShadow=true;m.receiveShadow=true;pond.add(m);}

// Lily pads and delicate blossoms form a still garden edge.
const lilyMat=new THREE.MeshStandardMaterial({color:0x477d62,roughness:.72,side:THREE.DoubleSide});
const lilyGeo=new THREE.CircleGeometry(.44,36);
for(let i=0;i<9;i++){
  const a=i*2.27+.7,r=pondRadius*(.54+Math.random()*.27),g=new THREE.Group();g.position.set(Math.cos(a)*r,waterY-.11,Math.sin(a)*r);g.rotation.x=-Math.PI/2;g.rotation.z=Math.random()*6;
  const pad=new THREE.Mesh(lilyGeo,lilyMat);pad.scale.set(1,.78,1);pad.rotation.z=.15;g.add(pad);
  const notch=new THREE.Mesh(new THREE.ConeGeometry(.16,.2,1),new THREE.MeshBasicMaterial({color:0x6aa581}));notch.position.set(.18,.01,0);notch.rotation.z=Math.PI/2;g.add(notch);
  if(i%3===0){const flower=new THREE.Group();flower.position.set(-.08,.06,.04);for(let p=0;p<6;p++){const petal=new THREE.Mesh(new THREE.SphereGeometry(.075,8,6),new THREE.MeshStandardMaterial({color:p%2?0xfff7eb:0xf0b4ad,roughness:.55}));const aa=p/6*Math.PI*2;petal.position.set(Math.cos(aa)*.11,0,Math.sin(aa)*.11);petal.scale.set(.75,.35,1.1);flower.add(petal);}g.add(flower);}
  pond.add(g);
}

const config={kohaku:{label:'Kohaku'},showa:{label:'Showa'},ogon:{label:'Golden Ogon'},platinum:{label:'Platinum'}};
const fishMeshes=[],fish=[];let nextFishId=0;
function makeKoi(type,x,z,angle){
  const koi=createKoi(type,++nextFishId,causticTime);koi.root.position.set(x,-.28-Math.random()*.3,z);koi.root.rotation.y=angle;pond.add(koi.root);fishMeshes.push(koi.body);
  const speed=.34+Math.random()*.3;const f={...koi,id:nextFishId,type,heading:angle,desired:angle,speed,targetSpeed:speed,think:1+Math.random()*3,depth:koi.root.position.y,age:5,wake:Math.random()};fish.push(f);return f;
}

// Subtle bottom plants: ribbon-like leaves sway in the clear shallows.
const plantMat=new THREE.MeshStandardMaterial({color:0x397d6b,roughness:.72,side:THREE.DoubleSide});
for(let i=0;i<34;i++){const a=Math.random()*Math.PI*2,r=1.3+Math.random()*(pondRadius-2);const g=new THREE.Group();g.position.set(Math.cos(a)*r,floorY,Math.sin(a)*r);g.rotation.y=Math.random()*6;for(let j=0;j<3;j++){const blade=new THREE.Mesh(new THREE.ConeGeometry(.075,.68+Math.random()*.65,5,1),plantMat);blade.position.set((j-1)*.09,.37,0);blade.rotation.z=(j-1)*-.18;g.add(blade);}pond.add(g);}

// Ripples use soft, transparent torus rings and fade with age.
const ripples=[];
function addRipple(x,z,scale=1,life=2.3,color=0xe6fff3){
  surface.impulse(x,z,.025*scale);
  for(let i=0;i<2;i++){const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.52-i*.12,side:THREE.DoubleSide,depthWrite:false});const ring=new THREE.Mesh(new THREE.TorusGeometry(.3+i*.12,.012-i*.002,5,40),mat);ring.rotation.x=-Math.PI/2;ring.position.set(x,waterY+.018+i*.006,z);ring.scale.setScalar(.16);scene.add(ring);ripples.push({mesh:ring,life:0,duration:life+i*.2,max:scale*(1+i*.35),baseOpacity:mat.opacity});}
}
const splashes=[];
const dropGeo=new THREE.SphereGeometry(.055,8,6);
function splash(x,z){
  surface.impulse(x,z,.13);
  addRipple(x,z,2.35,3.3,0xf1fff3);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.45,.09,8,32),new THREE.MeshBasicMaterial({color:0xb4eee3,transparent:true,opacity:.55,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(x,waterY+.04,z);ring.scale.set(.25,.25,.25);scene.add(ring);splashes.push({mesh:ring,t:0,duration:.65,kind:'ring'});
  const mat=new THREE.MeshPhysicalMaterial({color:0xc9fff3,transparent:true,opacity:.8,roughness:.12,metalness:.05});
  for(let i=0;i<12;i++){const drop=new THREE.Mesh(dropGeo,mat.clone());drop.position.set(x,waterY+.05,z);drop.scale.setScalar(.5+Math.random()*.7);scene.add(drop);const a=Math.random()*Math.PI*2,v=.7+Math.random()*1.7;splashes.push({mesh:drop,t:0,duration:.7+Math.random()*.45,kind:'drop',vx:Math.cos(a)*v,vy:1.2+Math.random()*2,vz:Math.sin(a)*v,gravity:4.5});}
  playSplash();
}

let vortex=null;let vortexRing=null;
function setVortex(x,z){if(!vortex){vortex=new THREE.Vector2(x,z);vortexRing=new THREE.Group();for(let i=0;i<3;i++){const r=new THREE.Mesh(new THREE.TorusGeometry(.7+i*.27,.012,4,64),new THREE.MeshBasicMaterial({color:0xc9fff0,transparent:true,opacity:.29-i*.045,depthWrite:false}));r.rotation.x=-Math.PI/2;vortexRing.add(r);}scene.add(vortexRing);}else vortex.set(x,z);vortexRing.position.set(x,waterY+.025,z);document.querySelector('#vortexBtn').classList.add('active');updateStatus('A quiet current is turning');startVortexSound();}
function stopVortex(){if(vortexRing){scene.remove(vortexRing);vortexRing.traverse(o=>{if(o.material)o.material.dispose();});vortexRing=null;}vortex=null;document.querySelector('#vortexBtn').classList.remove('active');stopVortexSound();updateStatus('A gentle morning');}

const rainDrops=[];let raining=false;
const rainGeo=new THREE.BufferGeometry();const rainN=360;const rainPos=new Float32Array(rainN*3);for(let i=0;i<rainN;i++){rainPos[i*3]=(Math.random()-.5)*pondRadius*1.8;rainPos[i*3+1]=Math.random()*5;rainPos[i*3+2]=(Math.random()-.5)*pondRadius*1.8;}rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPos,3));const rainPoints=new THREE.Points(rainGeo,new THREE.PointsMaterial({color:0xdffff5,size:.035,transparent:true,opacity:.62,depthWrite:false}));rainPoints.visible=false;scene.add(rainPoints);
function setRain(on){raining=on;rainPoints.visible=on;document.querySelector('#rainBtn').classList.toggle('active',on);if(on){updateStatus('A soft rain is passing');startRainSound();}else{updateStatus('A gentle morning');stopRainSound();}}

// Small stepping stones outside the water give the scene a garden boundary.
const ground=new THREE.Mesh(new THREE.RingGeometry(pondRadius-.06,28,128),new THREE.MeshStandardMaterial({color:0xb0c5a8,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.48;scene.add(ground);
for(let i=0;i<32;i++){const a=i/32*Math.PI*2;const r=pondRadius+1.1+(i%2)*.18;const stone=new THREE.Mesh(new THREE.DodecahedronGeometry(.39+Math.random()*.12,1),new THREE.MeshStandardMaterial({color:0xa1ab91,roughness:.97}));stone.position.set(Math.cos(a)*r,-.47,Math.sin(a)*r);stone.scale.set(1,.35,.78);stone.rotation.y=Math.random()*4;stone.receiveShadow=true;stone.castShadow=true;scene.add(stone);}

// Audio is synthesized locally; no files or network audio are needed.
let audioCtx=null, master=null, ambience=null, rainGain=null, vortexGain=null, ambienceSource=null, noiseBuffer=null, audioEnabled=false, audioTimer=null;
function initAudio(){if(audioCtx)return;audioCtx=new (window.AudioContext||window.webkitAudioContext)();master=audioCtx.createGain();master.gain.value=0;master.connect(audioCtx.destination);noiseBuffer=audioCtx.createBuffer(1,audioCtx.sampleRate*2,audioCtx.sampleRate);const d=noiseBuffer.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*.22;const src=audioCtx.createBufferSource();src.buffer=noiseBuffer;src.loop=true;const low=audioCtx.createBiquadFilter();low.type='lowpass';low.frequency.value=460;ambience=audioCtx.createGain();ambience.gain.value=.23;src.connect(low);low.connect(ambience);ambience.connect(master);src.start();ambienceSource=src;rainGain=audioCtx.createGain();rainGain.gain.value=0;const rainFilter=audioCtx.createBiquadFilter();rainFilter.type='lowpass';rainFilter.frequency.value=2100;const rsrc=audioCtx.createBufferSource();rsrc.buffer=noiseBuffer;rsrc.loop=true;rsrc.connect(rainFilter);rainFilter.connect(rainGain);rainGain.connect(master);rsrc.start();vortexGain=audioCtx.createGain();vortexGain.gain.value=0;const osc=audioCtx.createOscillator();osc.type='sine';osc.frequency.value=74;const vg=audioCtx.createBiquadFilter();vg.type='lowpass';vg.frequency.value=160;osc.connect(vg);vg.connect(vortexGain);vortexGain.connect(master);osc.start();}
function fade(param,value,duration=.45){if(!audioCtx||!param)return;param.cancelScheduledValues(audioCtx.currentTime);param.setTargetAtTime(value,audioCtx.currentTime,Math.max(.015,duration/3));}
async function toggleAudio(){initAudio();audioEnabled=!audioEnabled;if(audioEnabled){await audioCtx.resume();fade(master.gain,.78,.6);if(raining)fade(rainGain,.13,.6);if(vortex)fade(vortexGain,.05,.6);document.querySelector('#soundBtn').innerHTML='<span class="sound-icon">♫</span><span>Sound on</span>';document.querySelector('#soundBtn').setAttribute('aria-label','Mute sound');}else{fade(master.gain,0,.48);document.querySelector('#soundBtn').innerHTML='<span class="sound-icon">♪</span><span>Sound off</span>';document.querySelector('#soundBtn').setAttribute('aria-label','Enable sound');}}
function tone(freq,duration=.45,volume=.12,wave='sine'){if(!audioEnabled||!audioCtx)return;const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=wave;o.frequency.setValueAtTime(freq,audioCtx.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(50,freq*.72),audioCtx.currentTime+duration);g.gain.setValueAtTime(.0001,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(volume,audioCtx.currentTime+.025);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+duration);o.connect(g);g.connect(master);o.start();o.stop(audioCtx.currentTime+duration+.03);}
function playSplash(){if(!audioEnabled||!audioCtx)return;const src=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter(),g=audioCtx.createGain();src.buffer=noiseBuffer;filter.type='lowpass';filter.frequency.value=1400;g.gain.setValueAtTime(.0001,audioCtx.currentTime);g.gain.linearRampToValueAtTime(.2,audioCtx.currentTime+.025);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+.4);src.connect(filter);filter.connect(g);g.connect(master);src.start();src.stop(audioCtx.currentTime+.42);tone(620,.32,.055,'sine');}
function startRainSound(){if(audioEnabled&&rainGain)fade(rainGain,.13,1.2);}function stopRainSound(){if(rainGain)fade(rainGain,0,.8);}function startVortexSound(){if(audioEnabled&&vortexGain)fade(vortexGain,.05,.7);}function stopVortexSound(){if(vortexGain)fade(vortexGain,0,.4);}
function softDrop(){if(audioEnabled){tone([660,784,880,988][Math.floor(Math.random()*4)],.7,.035);}}
let ambienceTick=0;

function worldPoint(clientX,clientY){const rect=canvas.getBoundingClientRect();const n=new THREE.Vector2(((clientX-rect.left)/rect.width)*2-1,-((clientY-rect.top)/rect.height)*2+1);const ray=new THREE.Raycaster();ray.setFromCamera(n,camera);const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-waterY);const p=new THREE.Vector3();ray.ray.intersectPlane(plane,p);return p;}
function clampPoint(p,margin=.4){const r=Math.hypot(p.x,p.z),max=pondRadius-margin;if(r>max){p.x*=max/r;p.z*=max/r;}return p;}
function releaseFish(type,x,z){const p=clampPoint(new THREE.Vector3(x,0,z));const a=Math.random()*Math.PI*2;const f=makeKoi(type,p.x,p.z,a);f.age=0;if(lesson.isActive())refreshSchool();f.root.position.y=waterY+.18;splash(p.x,p.z);document.querySelector('#fishCount').textContent=fish.length;showToast(config[type].label+' has found a home');}
function showToast(text){const el=document.querySelector('#toast');el.textContent=text;el.classList.add('visible');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>el.classList.remove('visible'),1900);}
function updateStatus(t){document.querySelector('#sceneStatus').textContent=t;}

const raycaster=new THREE.Raycaster();const pointer=new THREE.Vector2();let pointerDown=null,lastTouch=0,dragFish=null,dragOffset=null;
function castFish(x,y){pointer.set(x/innerWidth*2-1,-y/innerHeight*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(fishMeshes,false);return hits[0]?.object||null;}
const projectedFish=new THREE.Vector3();
function pickLessonFish(x,y){
  // Give thin bodies a finger-sized hit area on mobile.
  const exact=castFish(x,y);if(exact)return fish.find(f=>f.body===exact);
  let best=null, distance=29;
  for(const f of fish){projectedFish.copy(f.root.position).project(camera);const d=Math.hypot(x-(projectedFish.x+1)*innerWidth/2,y-(1-projectedFish.y)*innerHeight/2);if(d<distance){best=f;distance=d;}}
  return best;
}
canvas.addEventListener('pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;canvas.setPointerCapture?.(e.pointerId);const p=worldPoint(e.clientX,e.clientY);if(p){clampPoint(p);pointerDown={x:e.clientX,y:e.clientY,last:performance.now()};if(lesson.isActive()){pointerDown.lessonFish=pickLessonFish(e.clientX,e.clientY);if(pointerDown.lessonFish)return;}if(vortex){pointerDown.vortexDrag=true;setVortex(p.x,p.z);return;}const hit=castFish(e.clientX,e.clientY);if(hit){dragFish=fish.find(f=>f.body===hit)||null;if(dragFish){dragOffset={x:dragFish.root.position.x-p.x,z:dragFish.root.position.z-p.z};}}addRipple(p.x,p.z,.85,2.2,0xe7fff5);lastTouch=performance.now();}});
canvas.addEventListener('pointermove',e=>{if(!pointerDown)return;const p=worldPoint(e.clientX,e.clientY);if(!p)return;clampPoint(p);if(pointerDown.lessonFish)return;if(pointerDown.vortexDrag&&vortex){setVortex(p.x,p.z);return;}if(dragFish){dragFish.root.position.x=p.x+(dragOffset?.x||0);dragFish.root.position.z=p.z+(dragOffset?.z||0);return;}if(performance.now()-lastTouch>100){addRipple(p.x,p.z,.68,1.8,0xe7fff5);lastTouch=performance.now();}});
canvas.addEventListener('pointerup',e=>{
  if(pointerDown?.lessonFish && lesson.isActive() && Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)<18){
    const f=pointerDown.lessonFish;lesson.show(f);const p=f.root.position;addRipple(p.x,p.z,1.12,1.6,0xe7fff5);refreshSchool(f);
  }
  pointerDown=null;dragFish=null;
});canvas.addEventListener('pointercancel',()=>{pointerDown=null;dragFish=null;});

let cardDrag=null,ghost=null;
function randomRelease(type){const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*pondRadius*.58;releaseFish(type,Math.cos(a)*r,Math.sin(a)*r);}
document.querySelectorAll('.fish-card').forEach(card=>{
  card.addEventListener('pointerdown',e=>{e.preventDefault();card.setPointerCapture(e.pointerId);cardDrag={type:card.dataset.fish,startX:e.clientX,startY:e.clientY,dragged:false};});
  card.addEventListener('click',e=>{e.preventDefault();if(e.detail===0)randomRelease(card.dataset.fish);});
});
window.addEventListener('pointermove',e=>{if(!cardDrag)return;const d=Math.hypot(e.clientX-cardDrag.startX,e.clientY-cardDrag.startY);if(d>8&&!cardDrag.dragged){cardDrag.dragged=true;ghost=document.createElement('div');ghost.className='drag-ghost';ghost.style.cssText='width:118px;height:67px;background-size:contain;background-repeat:no-repeat;background-position:center';ghost.style.backgroundImage=document.querySelector('[data-fish="'+cardDrag.type+'"] .fish-art').style.backgroundImage;document.body.appendChild(ghost);}if(ghost){ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';}});
window.addEventListener('pointerup',e=>{if(!cardDrag)return;if(cardDrag.dragged){const p=worldPoint(e.clientX,e.clientY);if(p)releaseFish(cardDrag.type,p.x,p.z);else randomRelease(cardDrag.type);}else randomRelease(cardDrag.type);if(ghost){ghost.remove();ghost=null;}cardDrag=null;});
window.addEventListener('pointercancel',()=>{cardDrag=null;ghost?.remove();ghost=null;});

document.querySelector('#soundBtn').addEventListener('click',toggleAudio);
document.querySelector('#hideBtn').addEventListener('click',()=>host.classList.add('interface-hidden'));
document.querySelector('#showBtn').addEventListener('click',()=>host.classList.remove('interface-hidden'));
document.querySelector('#calmBtn').addEventListener('click',()=>{if(raining)setRain(false);if(vortex)stopVortex();surface.calm();ripples.forEach(r=>{scene.remove(r.mesh);r.mesh.geometry.dispose();r.mesh.material.dispose();});ripples.length=0;document.querySelector('#calmBtn').classList.add('active');setTimeout(()=>document.querySelector('#calmBtn').classList.remove('active'),900);updateStatus('The pond is at rest');showToast('A little stillness');});
document.querySelector('#clearBtn').addEventListener('click',e=>{for(const f of fish)disposeKoi(f);fish.length=0;fishMeshes.length=0;dragFish=null;lesson.resetWord();refreshSchool();document.querySelector('#fishCount').textContent=fish.length;showToast(lesson.isActive()?'A new school is ready.':'The pond is clear. Invite another koi.');});
document.querySelector('#rainBtn').addEventListener('click',()=>setRain(!raining));
document.querySelector('#vortexBtn').addEventListener('click',()=>{if(vortex)stopVortex();else setVortex(1.3,-.5);});

document.addEventListener('visibilitychange',()=>{if(!audioCtx)return;if(document.hidden)audioCtx.suspend();else if(audioEnabled)audioCtx.resume();});
window.addEventListener('resize',()=>{fitView();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));surface.resize(innerWidth,innerHeight);});

[['kohaku',-2.7,-1.25,1.2],['ogon',2.45,1.15,-1.9],['showa',-.8,3.2,.5],['platinum',3.6,-2.4,-.5],['kohaku',-4,-3.5,2.8],['ogon',.7,-4.4,-1.2]].forEach(args=>makeKoi(...args));
document.querySelector('#fishCount').textContent=fish.length;
const hint=document.querySelector('#hint');
const lesson=createLesson(()=>refreshSchool(true));
function refreshSchool(focus){
  if(!lesson.isActive())return;
  const pending=lesson.nextWords(), all=lesson.words();
  const locations=[[-2.1,-1.25],[2.1,1.15],[-.7,2.4],[2.4,-2.5],[-2.5,-3.8],[.5,-4.2],[-2.4,3.8],[1.8,3.3]];
  const types=['kohaku','ogon','showa','platinum'];
  const minimum=Math.min(locations.length,Math.max(6,pending.length));
  while(fish.length<minimum){const [x,z]=locations[fish.length];makeKoi(types[fish.length%4],x,z,fish.length*.9);}
  const pool=fish.filter(f=>f!==focus);
  if(focus===true)for(const f of pool)f.lessonWord=null;
  const pendingIds=new Set(pending.map(w=>w.id));
  const claimed=new Set(pool.map(f=>f.lessonWord?.id).filter(id=>pendingIds.has(id)));
  const free=pending.filter(w=>!claimed.has(w.id));
  for(let i=0;i<pool.length;i++){const f=pool[i];if(!pendingIds.has(f.lessonWord?.id))f.lessonWord=free.shift()||f.lessonWord||all[i%all.length];}
  if(focus&&focus!==true&&free.length)focus.lessonWord=free.shift();
  document.querySelector('#fishCount').textContent=fish.length;
  hint.textContent=pending.length?'✦ Tap a koi to hear its word':'✦ All words found · Open Basket to hunt again';
}
refreshSchool(true);
document.querySelector('#modeBtn').addEventListener('click',()=>{if(!lesson.isActive())hint.textContent='✦ Drag across the water to make ripples';});
document.querySelector('#hideBtn').addEventListener('click',lesson.stop);

// The selection cards show the actual 3D model rather than a separate cartoon icon.
function renderCards(){const preview=new THREE.Scene();preview.environment=scene.environment;preview.add(new THREE.HemisphereLight(0xffffff,0x8e9f88,2));const lamp=new THREE.DirectionalLight(0xfff5dc,2);lamp.position.set(-3,6,2);preview.add(lamp);const cam=new THREE.OrthographicCamera(-1.35,1.35,.675,-.675,.1,20);cam.position.set(0,5,2);cam.up.set(0,0,-1);cam.lookAt(0,0,0);const rt=new THREE.WebGLRenderTarget(256,128);rt.texture.colorSpace=THREE.SRGBColorSpace;const pixels=new Uint8Array(256*128*4),flipped=new Uint8ClampedArray(pixels.length);const oldClear=renderer.getClearColor(new THREE.Color()),oldAlpha=renderer.getClearAlpha();renderer.setClearColor(0,0);for(const [type]of Object.entries(config)){const model=createKoi(type,2,causticTime);model.root.rotation.y=-Math.PI/2;preview.add(model.root);renderer.setRenderTarget(rt);renderer.render(preview,cam);renderer.readRenderTargetPixels(rt,0,0,256,128,pixels);for(let row=0;row<128;row++)flipped.set(pixels.subarray(row*256*4,(row+1)*256*4),(127-row)*256*4);const c=document.createElement('canvas');c.width=256;c.height=128;c.getContext('2d').putImageData(new ImageData(flipped,256,128),0,0);const art=document.querySelector('[data-fish="'+type+'"] .fish-art');art.classList.add('rendered');art.style.backgroundImage='url('+c.toDataURL()+')';preview.remove(model.root);disposeKoi(model);}renderer.setRenderTarget(null);renderer.setClearColor(oldClear,oldAlpha);rt.dispose();}
renderCards();
const clock=new THREE.Clock();let elapsed=0;
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.045);elapsed+=dt;causticTime.value=elapsed;surface.tick(elapsed,dt,vortex);caustics.offset.x=(elapsed*.012)%1;caustics.offset.y=(elapsed*.008)%1;
  // Smooth steering and a travelling spine wave are independent for every animal.
  for(let i=0;i<fish.length;i++){
    const f=fish[i],x=f.root.position.x,z=f.root.position.z;f.think-=dt;f.age+=dt;
    if(f.think<=0){f.think=2+Math.random()*3.4;f.desired+=(Math.random()-.5)*1.5;f.targetSpeed=.28+Math.random()*.45;}
    let target=f.desired;const dist=Math.hypot(x,z);if(dist>pondRadius-1.45)target=Math.atan2(-x,-z);
    if(lesson.isActive()){const bx=camera.right*.83,bz=camera.top*.71;if(Math.abs(x)>bx||Math.abs(z)>bz)target=Math.atan2(-x,-z);}
    let avoidX=0,avoidZ=0;for(let j=0;j<fish.length;j++){if(i===j)continue;const dx=x-fish[j].root.position.x,dz=z-fish[j].root.position.z,d2=dx*dx+dz*dz;if(d2<1.55&&d2>.001){const force=(1.55-d2)/Math.sqrt(d2)*.72;avoidX+=dx*force;avoidZ+=dz*force;}}
    target=Math.atan2(Math.sin(target)+avoidX,Math.cos(target)+avoidZ);
    const delta=Math.atan2(Math.sin(target-f.heading),Math.cos(target-f.heading));f.heading+=THREE.MathUtils.clamp(delta,-dt*.91,dt*.91);f.speed=THREE.MathUtils.lerp(f.speed,f.targetSpeed,Math.min(1,dt*.75));
    if(f!==dragFish){f.root.position.x+=Math.sin(f.heading)*f.speed*dt;f.root.position.z+=Math.cos(f.heading)*f.speed*dt;if(vortex){const dx=x-vortex.x,dz=z-vortex.y,r=Math.max(.25,Math.hypot(dx,dz));const power=Math.max(0,1-r/4.2)*.45;f.root.position.x+=(-dz/r-dx/r*.2)*power*dt;f.root.position.z+=(dx/r-dz/r*.2)*power*dt;}clampPoint(f.root.position,1.05);}
    f.root.rotation.y=f.heading;f.root.rotation.z=THREE.MathUtils.lerp(f.root.rotation.z,-delta*.045,dt*3);f.root.rotation.x=.17*Math.exp(-f.age*2.5);
    const dive=1-Math.exp(-f.age*4.0);f.root.position.y=THREE.MathUtils.lerp(waterY+.15,f.depth,dive)+Math.sin(f.phase*.29)*.022;animateKoi(f,dt,f.speed,THREE.MathUtils.clamp(delta,-1,1));
    f.wake+=dt;if(f.wake>1.3&&f.depth>-.36&&f.age>1){f.wake=0;surface.impulse(x-Math.sin(f.heading)*.8,z-Math.cos(f.heading)*.8,.008);}
  }
  for(let i=ripples.length-1;i>=0;i--){const r=ripples[i];r.life+=dt;const t=Math.min(1,r.life/r.duration);r.mesh.scale.setScalar(.16+t*r.max);r.mesh.material.opacity=r.baseOpacity*(1-t)*(1-t);if(t>=1){scene.remove(r.mesh);r.mesh.geometry.dispose();r.mesh.material.dispose();ripples.splice(i,1);}}
  for(let i=splashes.length-1;i>=0;i--){const s=splashes[i];s.t+=dt;const t=Math.min(1,s.t/s.duration);if(s.kind==='ring'){s.mesh.scale.setScalar(.25+t*1.65);s.mesh.material.opacity=(1-t)*.5;}else{s.mesh.position.x+=s.vx*dt;s.mesh.position.z+=s.vz*dt;s.mesh.position.y+=s.vy*dt;s.vy-=s.gravity*dt;s.mesh.scale.multiplyScalar(1-dt*.35);s.mesh.material.opacity=1-t;}if(t>=1){scene.remove(s.mesh);if(s.kind==='drop')s.mesh.material.dispose();else{s.mesh.geometry.dispose();s.mesh.material.dispose();}splashes.splice(i,1);}}
  if(vortexRing){vortexRing.rotation.y-=dt*.5;vortexRing.children.forEach((r,i)=>{r.scale.setScalar(1+.06*Math.sin(elapsed*1.4+i));});}
  if(raining){const a=rainGeo.attributes.position;for(let i=0;i<rainN;i++){a.array[i*3+1]-=dt*(5+(i%5));if(a.array[i*3+1]<waterY){a.array[i*3+1]=4+Math.random()*2;const x=a.array[i*3],z=a.array[i*3+2];if(Math.random()<.018)addRipple(x,z,.52,1.45,0xffffff);}}a.needsUpdate=true;}
  if(audioEnabled){ambienceTick+=dt;if(ambienceTick>1.6){ambienceTick=0;if(Math.random()<.4)softDrop();}}
  renderer.shadowMap.needsUpdate=true;
  const aboveWater=[rainPoints,...ripples.map(r=>r.mesh),...splashes.map(s=>s.mesh)];if(vortexRing)aboveWater.push(vortexRing);surface.render(renderer,scene,camera,aboveWater);
}
animate();
