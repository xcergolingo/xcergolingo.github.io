import * as THREE from '../argon-airspace/three.module.js';
import {createSnowLearning} from './learning.js';

// SNOW KINGS — buildless Three.js r170 arcade game. All art is procedural.
// Gameplay uses a lightweight sphere/momentum simulation and a spatial hash.

const $ = id => document.getElementById(id);
const UI = {
  world: $('world'), intro: $('intro'), hud: $('hud'), end: $('end-screen'), pause: $('pause-screen'),
  clock: $('clock'), phase: $('phase-text'), mass: $('mass'), score: $('score'),
  ranks: $('rank-list'), growth: $('growth-fill'), growthPct: $('growth-percent'), tier: $('tier-text'),
  objective: $('objective-text'), distance: $('objective-distance'), arrow: $('objective-arrow'),
  avalanche: $('avalanche-pill'), avalancheCount: $('avalanche-count'),
  boost: $('boost-btn'), boostText: $('boost-text'), toasts: $('toasts'), study: $('study-word'), flash: $('screenflash'),
  joystick: $('joystick'), knob: $('joystick-knob'), sound: $('sound-btn'), introSound: $('intro-sound')
};
const isTouch = matchMedia('(pointer:coarse)').matches;
const rand = (a,b) => a + Math.random() * (b-a);
const clamp = (x,a,b) => Math.max(a, Math.min(b,x));
const smooth = (a,b,t) => a+(b-a)*t;
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const fmt = x => Math.floor(x).toLocaleString('en-US');
const PI2 = Math.PI*2;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071429);
scene.fog = new THREE.FogExp2(0x0e2540,0.0045);
const camera = new THREE.PerspectiveCamera(55,innerWidth/innerHeight,0.2,850);
let renderer,usingFallback=false;
try{
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',alpha:false});
}catch(error){
  // Cloud previews, older embedded browsers, and restricted devices can lack WebGL.
  // The same physics/game state runs in a detailed canvas renderer in that case.
  console.warn('WebGL unavailable; switching to the illustrated 2D arena.');
  usingFallback=true;
  renderer=createFallbackRenderer();
}
renderer.setPixelRatio(Math.min(devicePixelRatio,isTouch?1.45:1.8));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
UI.world.appendChild(renderer.domElement);

function createFallbackRenderer(){
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  let ratio=1,clockHandle=0,lastPaint=0;
  return {
    domElement:canvas,shadowMap:{enabled:false,type:0},
    setPixelRatio(x){ratio=Math.min(1,x);this.setSize(innerWidth,innerHeight);},
    setSize(w,h){canvas.width=Math.floor(w*ratio);canvas.height=Math.floor(h*ratio);canvas.style.width=`${w}px`;canvas.style.height=`${h}px`;},
    setAnimationLoop(callback){if(clockHandle)cancelAnimationFrame(clockHandle);const frame=()=>{callback();clockHandle=requestAnimationFrame(frame);};clockHandle=requestAnimationFrame(frame);},
    render(){const now=performance.now();if(now-lastPaint<44)return;lastPaint=now;ctx.setTransform(ratio,0,0,ratio,0,0);renderFallback(ctx,innerWidth,innerHeight);}
  };
}

scene.add(new THREE.HemisphereLight(0x93c5ff,0x45617b,2.15));
const moonLight = new THREE.DirectionalLight(0xc5e7ff,2.15);
moonLight.position.set(-75,115,-110);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(1024,1024);
moonLight.shadow.camera.left = -65;
moonLight.shadow.camera.right = 65;
moonLight.shadow.camera.top = 65;
moonLight.shadow.camera.bottom = -65;
moonLight.shadow.camera.near = 1;
moonLight.shadow.camera.far = 260;
moonLight.shadow.bias = -.00025;
scene.add(moonLight);
const mintLight = new THREE.DirectionalLight(0x52ffd5,0.5);
mintLight.position.set(75,60,-90);
scene.add(mintLight);

const materials = {
  snow:new THREE.MeshStandardMaterial({color:0xe8f8ff,roughness:0.91}),
  white:new THREE.MeshStandardMaterial({color:0xf3fdff,roughness:0.82}),
  dark:new THREE.MeshStandardMaterial({color:0x2d4c66,roughness:0.9}),
  blue:new THREE.MeshStandardMaterial({color:0x4da8a8,roughness:0.88}),
  pine:new THREE.MeshStandardMaterial({color:0x165a57,roughness:0.91,flatShading:true}),
  pine2:new THREE.MeshStandardMaterial({color:0x20836f,roughness:0.95,flatShading:true}),
  pineSnow:new THREE.MeshStandardMaterial({color:0xc9ebee,roughness:1,flatShading:true}),
  wood:new THREE.MeshStandardMaterial({color:0x825674,roughness:0.88}),
  warm:new THREE.MeshStandardMaterial({color:0xffd184,emissive:0xffb55a,emissiveIntensity:1.2,roughness:.5}),
  gold:new THREE.MeshStandardMaterial({color:0xffd995,metalness:.4,roughness:.3,emissive:0xa96b2c,emissiveIntensity:.4}),
  ice:new THREE.MeshPhysicalMaterial({color:0x88e4f6,metalness:.14,roughness:.22,transmission:.14,transparent:true,opacity:.95,flatShading:true}),
  iceLight:new THREE.MeshStandardMaterial({color:0xb4faff,emissive:0x4ac1f8,emissiveIntensity:.85,roughness:.3,metalness:.18}),
  lilac:new THREE.MeshStandardMaterial({color:0x9e8de0,roughness:.75}),
  pink:new THREE.MeshStandardMaterial({color:0xf9a1be,roughness:.7}),
  ribbon:new THREE.MeshStandardMaterial({color:0xff6689,roughness:.55,emissive:0x9e2143,emissiveIntensity:.12}),
  candy:new THREE.MeshStandardMaterial({color:0xfff3e3,roughness:.42,emissive:0xf8e5c8,emissiveIntensity:.12}),
  trail:new THREE.MeshBasicMaterial({color:0x91ecfa,transparent:true,opacity:.3,depthWrite:false}),
};

// One common sphere, cone, and cylinder geometry are shared by all scene items.
const sphere = new THREE.SphereGeometry(1,18,12);
const cone = new THREE.ConeGeometry(1,1,7);
const cube = new THREE.BoxGeometry(1,1,1);
const cylinder = new THREE.CylinderGeometry(1,1,1,8);
const circle = new THREE.CircleGeometry(1,28);
const transform = new THREE.Object3D();
const tmpVec = new THREE.Vector3();

function terrainHeight(x,z){
  const hill=6.9*Math.exp(-(x*x+z*z)/2100);
  return hill + .82*Math.sin(x*.043)*Math.cos(z*.051) + .45*Math.sin(x*.091+z*.043);
}
function makeMesh(geometry,material,parent,x=0,y=0,z=0,sx=1,sy=1,sz=1){
  const m=new THREE.Mesh(geometry,material);
  m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;
}
function makeGlowTexture(){
  const c=document.createElement('canvas');c.width=c.height=128;
  const ctx=c.getContext('2d');const g=ctx.createRadialGradient(64,64,2,64,64,64);
  g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.19,'rgba(226,253,255,.88)');g.addColorStop(.5,'rgba(155,226,255,.22)');g.addColorStop(1,'rgba(155,226,255,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);
}
const glowTexture=makeGlowTexture();
function glow(parent,x,y,z,color,scale){
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.63}));
  s.position.set(x,y,z);s.scale.set(scale,scale,1);parent.add(s);return s;
}

// A color-varied snowfield follows a smooth central hill.
function makeTerrain(){
  const geo=new THREE.PlaneGeometry(348,348,100,100);
  geo.rotateX(-Math.PI/2);
  const p=geo.getAttribute('position');const cols=[];
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i);p.setY(i,terrainHeight(x,z));
    const c=new THREE.Color().setHSL(.55+Math.sin(x*.11+z*.07)*.014,.26,.79+Math.sin(x*.067)*Math.cos(z*.044)*.042);
    cols.push(c.r,c.g,c.b);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));
  m.receiveShadow=true;scene.add(m);
  const ring=new THREE.Mesh(new THREE.RingGeometry(146,154,100),new THREE.MeshBasicMaterial({color:0x6ea6c1,side:THREE.DoubleSide,transparent:true,opacity:.5}));
  ring.rotation.x=-Math.PI/2;ring.position.y=-.55;scene.add(ring);
  for(let i=0;i<84;i++){
    const a=i/84*PI2,r=171+Math.sin(i*2.27)*11;
    const peak=makeMesh(cone,i%3?materials.dark:materials.blue,scene,Math.cos(a)*r,rand(2,8),Math.sin(a)*r,rand(10,21),rand(18,43),rand(10,21));
    peak.rotation.y=rand(0,PI2);
    makeMesh(cone,materials.pineSnow,scene,peak.position.x,peak.position.y+14,peak.position.z,peak.scale.x*.5,peak.scale.y*.28,peak.scale.z*.5);
  }
}

let skyGroup,auroraMeshes=[];
function makeSky(){
  skyGroup=new THREE.Group();scene.add(skyGroup);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(550,32,16),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,
    vertexShader:'varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec3 vPos;void main(){float h=normalize(vPos).y;vec3 low=vec3(.085,.20,.31);vec3 top=vec3(.014,.032,.12);gl_FragColor=vec4(mix(low,top,smoothstep(-.2,.66,h)),1.);}'
  }));skyGroup.add(sky);
  const starPoints=[];
  for(let i=0;i<620;i++){
    const phi=rand(0,PI2),h=rand(.05,.94),r=390*Math.sqrt(1-h*h);
    starPoints.push(Math.cos(phi)*r,h*390,Math.sin(phi)*r);
  }
  const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPoints,3));
  const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xc7edff,size:1.15,transparent:true,opacity:.85,sizeAttenuation:false,depthWrite:false}));skyGroup.add(stars);
  const moon=makeMesh(new THREE.SphereGeometry(15,32,22),new THREE.MeshBasicMaterial({color:0xfff8d9}),skyGroup,-92,91,-262,1,1,1);
  glow(skyGroup,-92,91,-263,0xb8dfff,92);
  moon.material.toneMapped=false;
  for(let i=0;i<4;i++){
    const ribbon=new THREE.Mesh(new THREE.PlaneGeometry(245,76,60,10),new THREE.ShaderMaterial({
      transparent:true,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending,
      uniforms:{uTime:{value:0},uShift:{value:i*.87},uTint:{value:new THREE.Color(i%2?0x56fbc7:0x58caff)}},
      vertexShader:'uniform float uTime;uniform float uShift;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;p.y+=sin(p.x*.027+uTime*.56+uShift)*17.*sin(uv.y*3.1416);p.z+=sin(p.x*.017+uTime*.4+uShift)*9.;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
      fragmentShader:'uniform vec3 uTint;uniform float uTime;uniform float uShift;varying vec2 vUv;void main(){float waves=.55+.45*sin(vUv.x*39.+uShift*7.+uTime*.7);float edge=pow(sin(vUv.y*3.14159),1.5);float left=smoothstep(0.,.12,vUv.x)*smoothstep(1.,.87,vUv.x);float alpha=edge*left*(.11+.18*waves);gl_FragColor=vec4(uTint,alpha);}'
    }));
    ribbon.position.set(i%2?50:-65,93+i*10,-280-i*8);ribbon.rotation.z=(i-1.5)*.14;skyGroup.add(ribbon);auroraMeshes.push(ribbon);
  }
}

// Efficient particle pools: transient impact flakes and continuous world snow.
const impactMax=760,impactPool=[];
const impactGeom=new THREE.BufferGeometry();
const impactPositions=new Float32Array(impactMax*3),impactColors=new Float32Array(impactMax*3);
impactGeom.setAttribute('position',new THREE.BufferAttribute(impactPositions,3).setUsage(THREE.DynamicDrawUsage));
impactGeom.setAttribute('color',new THREE.BufferAttribute(impactColors,3).setUsage(THREE.DynamicDrawUsage));
const impactPoints=new THREE.Points(impactGeom,new THREE.PointsMaterial({size:.48,map:glowTexture,vertexColors:true,transparent:true,opacity:.88,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true}));
impactPoints.frustumCulled=false;scene.add(impactPoints);
function burst(x,y,z,color=0xd6f8ff,n=17,power=8){
  const col=new THREE.Color(color);
  for(let i=0;i<n;i++){
    if(impactPool.length>=impactMax)impactPool.shift();
    const a=rand(0,PI2),s=rand(2,power);
    impactPool.push({x,y,z,vx:Math.cos(a)*s,vy:rand(2,power*1.2),vz:Math.sin(a)*s,life:rand(.35,.95),max:1,color:col});
  }
}
function updateImpacts(dt){
  for(let i=impactPool.length-1;i>=0;i--){
    const p=impactPool[i];p.life-=dt;
    if(p.life<=0){impactPool.splice(i,1);continue;}
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=15*dt;p.vx*=.97;p.vz*=.97;
  }
  let i=0;
  for(const p of impactPool){const j=i*3;impactPositions[j]=p.x;impactPositions[j+1]=p.y;impactPositions[j+2]=p.z;impactColors[j]=p.color.r*p.life;impactColors[j+1]=p.color.g*p.life;impactColors[j+2]=p.color.b*p.life;i++;}
  for(;i<impactMax;i++)impactPositions[i*3+1]=-900;
  impactGeom.attributes.position.needsUpdate=true;impactGeom.attributes.color.needsUpdate=true;
}
const snowCount=usingFallback?260:isTouch?600:1250;
const snowPos=new Float32Array(snowCount*3);
for(let i=0;i<snowCount;i++){snowPos[i*3]=rand(-105,105);snowPos[i*3+1]=rand(4,85);snowPos[i*3+2]=rand(-105,105);}
const snowGeo=new THREE.BufferGeometry();snowGeo.setAttribute('position',new THREE.BufferAttribute(snowPos,3).setUsage(THREE.DynamicDrawUsage));
const fallingSnow=new THREE.Points(snowGeo,new THREE.PointsMaterial({color:0xe6faff,map:glowTexture,size:.76,transparent:true,opacity:.77,depthWrite:false,sizeAttenuation:true}));
fallingSnow.frustumCulled=false;scene.add(fallingSnow);
function updateSnow(dt,focus){
  for(let i=0;i<snowCount;i++){
    const j=i*3;
    snowPos[j]+=(.3+Math.sin(i*4.1)*.23)*dt;
    snowPos[j+1]-=(3.9+(i%13)*.18)*dt;
    snowPos[j+2]+=Math.sin(i*1.7)*.36*dt;
    if(snowPos[j+1]<terrainHeight(snowPos[j],snowPos[j+2])+.2||Math.abs(snowPos[j]-focus.x)>95||Math.abs(snowPos[j+2]-focus.z)>95){
      snowPos[j]=focus.x+rand(-90,90);snowPos[j+1]=rand(34,89);snowPos[j+2]=focus.z+rand(-90,90);
    }
  }
  snowGeo.attributes.position.needsUpdate=true;
}

// The grid accelerates collision lookups even with hundreds of destructibles.
const CELL=14,props=[],grid=new Map();
const key=(x,z)=>`${x}|${z}`;
function registerProp(p){
  p.alive=true;p.cellX=Math.floor(p.x/CELL);p.cellZ=Math.floor(p.z/CELL);
  const k=key(p.cellX,p.cellZ);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(p);props.push(p);return p;
}
function nearProps(x,z,r){
  const extent=Math.ceil((r+5)/CELL),ix=Math.floor(x/CELL),iz=Math.floor(z/CELL),found=[];
  for(let cx=ix-extent;cx<=ix+extent;cx++)for(let cz=iz-extent;cz<=iz+extent;cz++){
    const cell=grid.get(key(cx,cz));if(cell)for(const p of cell)if(p.alive)found.push(p);
  }
  return found;
}
function batch(geometry,material,count,cast=false){
  const mesh=new THREE.InstancedMesh(geometry,material,count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=cast;mesh.receiveShadow=false;mesh.frustumCulled=false;
  scene.add(mesh);return mesh;
}
function put(mesh,i,x,y,z,sx=1,sy=1,sz=1,ry=0){
  transform.position.set(x,y,z);transform.rotation.set(0,ry,0);transform.scale.set(sx,sy,sz);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);
}
function hideInstance(mesh,i){put(mesh,i,0,-900,0,.0001,.0001,.0001);mesh.instanceMatrix.needsUpdate=true;}
function finalize(...meshes){meshes.forEach(m=>m.instanceMatrix.needsUpdate=true);}
function placeRandom(minR=15,maxR=142){
  const angle=rand(0,PI2),r=Math.sqrt(rand(minR*minR,maxR*maxR));
  return {x:Math.cos(angle)*r,z:Math.sin(angle)*r};
}
const cottageSites=[];
function available(x,z,margin=6){return Math.hypot(x,z)>19&&cottageSites.every(c=>Math.hypot(x-c.x,z-c.z)>margin+4);}

function makeCottage(x,z,rotation=0){
  const group=new THREE.Group();group.position.set(x,terrainHeight(x,z),z);group.rotation.y=rotation;scene.add(group);
  const wall=makeMesh(cube,new THREE.MeshStandardMaterial({color:[0xb9b3cf,0xa6cad0,0xd3b6a9,0xb6b0d2][cottageSites.length%4],roughness:.88}),group,0,1.85,0,4.2,3.7,3.8);wall.castShadow=true;
  makeMesh(cube,materials.wood,group,0,.09,0,4.6,.3,4.25);
  const roof=makeMesh(new THREE.ConeGeometry(3.46,2.6,4),materials.lilac,group,0,5.0,0,1,1,1);
  roof.rotation.y=Math.PI/4;roof.castShadow=true;
  makeMesh(cube,materials.pineSnow,group,0,4.25,-1.65,4.15,.22,.52);
  makeMesh(cube,materials.wood,group,0,1.2,1.94,1.05,2.32,.12);
  makeMesh(cube,materials.gold,group,0,2.38,2.05,.17,.11,.11);
  for(const wx of [-1.25,1.25]){
    makeMesh(cube,materials.warm,group,wx,2.25,1.975,.66,.8,.14);
    makeMesh(cube,materials.wood,group,wx,2.25,2.06,.09,.86,.14);
    makeMesh(cube,materials.wood,group,wx,2.25,2.08,.68,.09,.14);
    makeMesh(cube,materials.warm,group,wx,2.25,-1.975,.7,.77,.1);
  }
  makeMesh(cube,materials.dark,group,-1.17,5.2,-.75,.58,1.7,.65);
  makeMesh(cube,materials.pineSnow,group,-1.17,6.08,-.75,.73,.22,.78);
  makeMesh(sphere,materials.pineSnow,group,0,3.65,0,2.15,.21,2.08);
  // A door wreath and friendly warm lantern make the village readable at night.
  const wreath=new THREE.Mesh(new THREE.TorusGeometry(.28,.09,6,16),materials.pine2);
  wreath.position.set(0,2,2.06);group.add(wreath);
  makeMesh(sphere,materials.ribbon,group,.03,1.77,2.08,.12,.13,.12);
  if(cottageSites.length%3===0){const l=new THREE.PointLight(0xffcb8d,10,19,2);l.position.set(x,terrainHeight(x,z)+4,z);scene.add(l);}
  const p=registerProp({x,z,r:2.75,type:'cottage',name:'a cottage',threshold:1250,gain:730,score:482,group,
    hide(){wrecks.push({group,time:0,base:group.position.y});}});
  cottageSites.push({x,z,group});return p;
}

const wrecks=[];
function buildVillage(){
  const clusters=[[-48,43],[-57,-39],[48,33],[62,-46],[2,87],[-12,-95]];
  for(const [cx,cz] of clusters){
    for(let i=0;i<4;i++){
      const theta=i*Math.PI/2+.12,rad=8.3+(i%2)*2.5;
      makeCottage(cx+Math.cos(theta)*rad,cz+Math.sin(theta)*rad,theta+Math.PI);
    }
  }
  // Fences have two rails and posts batched into four GPU draw calls.
  const fCount=125;
  const woodFence=new THREE.MeshStandardMaterial({color:0xb6d0d2,roughness:1});
  const posts=batch(cube,woodFence,fCount*2),rails=batch(cube,woodFence,fCount*2);
  for(let i=0;i<fCount;i++){
    let x,z,rot;
    if(i<96){
      const c=cottageSites[i%cottageSites.length],a=((Math.floor(i/cottageSites.length)%4)*Math.PI/2)+.15;
      x=c.x+Math.cos(a)*5.1;z=c.z+Math.sin(a)*5.1;rot=a+Math.PI/2;
    }else{const loc=placeRandom(32,139);x=loc.x;z=loc.z;rot=rand(0,PI2);}
    const y=terrainHeight(x,z),co=Math.cos(rot),si=Math.sin(rot);
    for(let j=0;j<2;j++){
      const dx=(j-.5)*2.9;
      put(posts,i*2+j,x+dx*co,y+.83,z+dx*si,.2,1.55,.22,rot);
      put(rails,i*2+j,x,y+(j===0?.55:1.23),z,3.25,.14,.16,rot);
    }
    registerProp({x,z,r:1.7,type:'fence',name:'a fence',threshold:115,gain:65,score:38,
      hide(){for(let j=0;j<2;j++){hideInstance(posts,i*2+j);hideInstance(rails,i*2+j);}}});
  }
  finalize(posts,rails);
  const nLamps=35,lamps=batch(cylinder,materials.dark,nLamps),bulbs=batch(sphere,materials.warm,nLamps),tops=batch(cone,materials.gold,nLamps);
  for(let i=0;i<nLamps;i++){
    const c=cottageSites[i%cottageSites.length],a=i*2.399;
    const x=c.x+Math.cos(a)*6.4,z=c.z+Math.sin(a)*6.4,y=terrainHeight(x,z);
    put(lamps,i,x,y+2.1,z,.12,4.1,.12);put(bulbs,i,x,y+4.18,z,.47,.51,.47);put(tops,i,x,y+4.79,z,.62,.7,.62);
    if(i%5===0){const l=new THREE.PointLight(0xffdc9a,5,19,2);l.position.set(x,y+4.2,z);scene.add(l);}
    registerProp({x,z,r:.75,type:'lamp',name:'a lamp post',threshold:530,gain:200,score:135,
      hide(){hideInstance(lamps,i);hideInstance(bulbs,i);hideInstance(tops,i);}});
  }
  finalize(lamps,bulbs,tops);
}

function buildForest(){
  const n=158;
  const trunks=batch(cylinder,materials.wood,n),leaves=batch(cone,materials.pine,n*3),snowTips=batch(cone,materials.pineSnow,n*3);
  for(let i=0;i<n;i++){
    let l=placeRandom(26,145),tries=0;
    while(!available(l.x,l.z,4.2)&&tries++<20)l=placeRandom(26,145);
    const x=l.x,z=l.z,y=terrainHeight(x,z),scale=rand(.72,1.55);
    put(trunks,i,x,y+1.25*scale,z,.27*scale,2.5*scale,.27*scale);
    for(let j=0;j<3;j++){
      const yy=y+(2.1+j*1.22)*scale,sz=(2.4-j*.45)*scale;
      put(leaves,i*3+j,x,yy,z,sz,(3.3-j*.55)*scale,sz,i*.3);
      put(snowTips,i*3+j,x,yy+(.58-j*.05)*scale,z,sz*.77,.47*scale,sz*.77,i*.3);
    }
    registerProp({x,z,r:1.22*scale,type:'tree',name:'a snow pine',threshold:310,gain:155,score:92,
      hide(){hideInstance(trunks,i);for(let j=0;j<3;j++){hideInstance(leaves,i*3+j);hideInstance(snowTips,i*3+j);}}});
  }
  finalize(trunks,leaves,snowTips);
  // Scenic icy crystal clusters glint among the pines; these are decorative.
  const nCrystals=92,crystals=batch(new THREE.OctahedronGeometry(1,0),materials.iceLight,nCrystals);
  for(let i=0;i<nCrystals;i++){
    const l=placeRandom(20,142),y=terrainHeight(l.x,l.z),s=rand(.35,1.4);
    put(crystals,i,l.x,y+s*.52,l.z,s*.45,s*1.3,s*.45,rand(0,PI2));
  }
  finalize(crystals);
}

function buildPickups(){
  const gifts=108;
  const giftBody=batch(cube,materials.ribbon,gifts),giftCross=batch(cube,materials.gold,gifts*2),giftBow=batch(sphere,materials.gold,gifts);
  for(let i=0;i<gifts;i++){
    const l=placeRandom(20,145),x=l.x,z=l.z,y=terrainHeight(x,z),s=rand(.55,.95);
    put(giftBody,i,x,y+s*.53,z,s,s,s,rand(0,PI2));
    put(giftCross,i*2,x,y+s*.54,z,s*.2,s*1.06,s*1.04);
    put(giftCross,i*2+1,x,y+s*.54,z,s*1.04,s*1.06,s*.2);
    put(giftBow,i,x,y+s*1.16,z,s*.25,s*.13,s*.24);
    registerProp({x,z,r:s*.65,type:'gift',name:'a gift',threshold:0,gain:57,score:51,
      hide(){hideInstance(giftBody,i);hideInstance(giftCross,i*2);hideInstance(giftCross,i*2+1);hideInstance(giftBow,i);}});
  }
  finalize(giftBody,giftCross,giftBow);
  const candies=98,peppermints=batch(sphere,materials.candy,candies),pepStripes=batch(new THREE.TorusGeometry(.44,.12,6,16),materials.ribbon,candies);
  for(let i=0;i<candies;i++){
    const l=placeRandom(22,145),x=l.x,z=l.z,y=terrainHeight(x,z),s=rand(.48,.8);
    put(peppermints,i,x,y+s*.85,z,s,s,s);
    put(pepStripes,i,x,y+s*.85,z,s*1.1,s*1.1,s*1.1,i);
    registerProp({x,z,r:s*.6,type:'candy',name:'a peppermint',threshold:0,gain:38,score:32,
      hide(){hideInstance(peppermints,i);hideInstance(pepStripes,i);}});
  }
  finalize(peppermints,pepStripes);
  const snowmen=42,bottoms=batch(sphere,materials.snow,snowmen),heads=batch(sphere,materials.white,snowmen),hats=batch(cylinder,materials.dark,snowmen),noses=batch(cone,materials.ribbon,snowmen);
  for(let i=0;i<snowmen;i++){
    const l=placeRandom(25,140),x=l.x,z=l.z,y=terrainHeight(x,z),s=rand(.75,1.12);
    put(bottoms,i,x,y+.92*s,z,.87*s,.87*s,.87*s);
    put(heads,i,x,y+2.1*s,z,.57*s,.57*s,.57*s);
    put(hats,i,x,y+2.75*s,z,.5*s,.43*s,.5*s);
    put(noses,i,x,y+2.15*s,z+.61*s,.13*s,.29*s,.13*s);
    registerProp({x,z,r:.95*s,type:'snowman',name:'a snowman',threshold:125,gain:112,score:96,
      hide(){hideInstance(bottoms,i);hideInstance(heads,i);hideInstance(hats,i);hideInstance(noses,i);}});
  }
  finalize(bottoms,heads,hats,noses);
  const stars=32,starMesh=batch(new THREE.OctahedronGeometry(1,0),materials.gold,stars);
  for(let i=0;i<stars;i++){
    const l=placeRandom(23,138),x=l.x,z=l.z,y=terrainHeight(x,z);
    put(starMesh,i,x,y+1.5,z,.72,.98,.72,rand(0,PI2));
    registerProp({x,z,r:.8,type:'star',name:'a magic star',threshold:0,gain:175,score:150,
      hide(){hideInstance(starMesh,i);}});
  }
  finalize(starMesh);
}

let palace,castleAlive=true,castleParts=[];
function buildPalace(){
  palace=new THREE.Group();palace.position.y=terrainHeight(0,0);scene.add(palace);
  const base=makeMesh(new THREE.CylinderGeometry(15.4,18.5,3.8,12),materials.ice,palace,0,1.45,0);base.receiveShadow=true;base.castShadow=true;
  makeMesh(new THREE.CylinderGeometry(16.2,16.3,.48,12),materials.iceLight,palace,0,3.35,0);
  for(let i=0;i<8;i++){
    const a=i/8*PI2,x=Math.cos(a)*14,z=Math.sin(a)*14;
    const c=makeMesh(new THREE.ConeGeometry(2.3,5.8,5),materials.iceLight,palace,x,3.5,z);c.rotation.y=a;
  }
  const mainTower=makeMesh(cube,materials.ice,palace,0,10.1,0,12.3,13.9,11.3);mainTower.castShadow=true;castleParts.push(mainTower);
  makeMesh(new THREE.ConeGeometry(8.0,10.8,4),materials.iceLight,palace,0,23.1,0).rotation.y=Math.PI/4;
  makeMesh(new THREE.OctahedronGeometry(3.6),materials.gold,palace,0,30.4,0,.82,1.7,.82);
  for(const tx of [-9.4,9.4])for(const tz of [-9.4,9.4]){
    const tower=new THREE.Group();tower.position.set(tx,0,tz);palace.add(tower);castleParts.push(tower);
    const body=makeMesh(new THREE.CylinderGeometry(3.25,4.2,16.4,8),materials.ice,tower,0,10.6,0);body.castShadow=true;
    makeMesh(new THREE.CylinderGeometry(4.2,4.2,1,8),materials.iceLight,tower,0,19.3,0);
    makeMesh(new THREE.ConeGeometry(4.35,10.8,8),materials.iceLight,tower,0,25.0,0);
    makeMesh(new THREE.OctahedronGeometry(.95),materials.gold,tower,0,31.1,0);
    for(let h=7;h<=16;h+=4){
      makeMesh(cube,materials.warm,tower,0,h,3.35,.8,1.8,.15);
      makeMesh(cube,materials.warm,tower,3.35,h,0,.15,1.8,.8);
    }
  }
  for(const x of [-4.6,0,4.6]){
    for(let y=10;y<16;y+=3.5){
      makeMesh(cube,materials.warm,palace,x,y,5.85,1.45,2.35,.16);
      makeMesh(cube,materials.iceLight,palace,x,y+1.4,5.92,1.65,.15,.2);
    }
  }
  const gate=makeMesh(cube,materials.dark,palace,0,5.05,6.03,3.7,6.5,.38);
  const arch=makeMesh(new THREE.TorusGeometry(2.2,.37,7,20,Math.PI),materials.gold,palace,0,8.28,6.22);
  makeMesh(new THREE.OctahedronGeometry(1),materials.gold,palace,0,12.4,6.3,1.2,1.5,.6);
  for(let i=0;i<14;i++){
    const a=i/14*PI2,x=Math.cos(a)*20,z=Math.sin(a)*20;
    const spire=makeMesh(cone,materials.iceLight,palace,x,3.7,z,1.25,7.3,1.25);spire.rotation.y=a;
    glow(palace,x,7,z,0x69ecff,5);
  }
  const topLight=new THREE.PointLight(0x68deff,15,70,2);topLight.position.set(0,terrainHeight(0,0)+24,0);scene.add(topLight);
  const rings=new THREE.Mesh(new THREE.RingGeometry(18.6,19.15,80),new THREE.MeshBasicMaterial({color:0x79f3ed,transparent:true,opacity:.62,side:THREE.DoubleSide}));rings.rotation.x=-Math.PI/2;rings.position.y=.4;palace.add(rings);
}

function buildWatchtowers(){
  const sites=[[31,4],[-31,-3],[4,-34],[-5,35]];
  for(const [x,z] of sites){
    const group=new THREE.Group();group.position.set(x,terrainHeight(x,z),z);scene.add(group);
    const base=makeMesh(new THREE.CylinderGeometry(2.9,3.3,10.5,8),materials.ice,group,0,5.7,0);base.castShadow=true;
    makeMesh(new THREE.CylinderGeometry(3.4,3.4,.7,8),materials.iceLight,group,0,11.15,0);
    makeMesh(new THREE.ConeGeometry(3.8,7.4,8),materials.iceLight,group,0,15.0,0);
    makeMesh(new THREE.OctahedronGeometry(.72),materials.gold,group,0,19.0,0);
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2,wx=Math.cos(a)*2.96,wz=Math.sin(a)*2.96;
      const win=makeMesh(cube,materials.warm,group,wx,7,wz,.95,2,.12);win.rotation.y=-a;
    }
    registerProp({x,z,r:2.35,type:'tower',name:'an ice watchtower',threshold:4300,gain:1150,score:875,group,
      hide(){wrecks.push({group,time:0,base:group.position.y});}});
  }
}

makeTerrain();makeSky();buildPalace();buildWatchtowers();buildVillage();buildForest();buildPickups();

function makeSnowTexture(){
  const cv=document.createElement('canvas');cv.width=cv.height=256;
  const ctx=cv.getContext('2d');ctx.fillStyle='#f5fbff';ctx.fillRect(0,0,256,256);
  for(let i=0;i<1500;i++){
    const x=rand(0,256),y=rand(0,256),r=rand(.25,1.7);
    ctx.fillStyle=i%3===0?'rgba(77,138,169,.13)':'rgba(169,212,234,.3)';
    ctx.beginPath();ctx.arc(x,y,r,0,PI2);ctx.fill();
  }
  const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}
const snowTexture=makeSnowTexture();
function nameSprite(label,bg){
  const cv=document.createElement('canvas');cv.width=384;cv.height=92;
  const c=cv.getContext('2d');c.fillStyle='rgba(9,25,48,.76)';
  c.beginPath();c.roundRect(15,13,354,66,30);c.fill();
  c.strokeStyle=bg;c.lineWidth=3;c.stroke();
  c.font='900 36px Trebuchet MS,Arial';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#f4feff';
  c.fillText(label.toUpperCase(),192,47);
  const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false,depthTest:false}));
  s.scale.set(6,1.45,1);return s;
}
function makeBallDecor(parent,mainColor,starColor){
  // Two barber-pole light strings wrap around the rolling ball.
  for(let path=0;path<2;path++){
    const points=[];
    for(let i=0;i<=96;i++){
      const t=i/96,lat=-.83+1.66*t,a=t*PI2*3+path*Math.PI;
      const rr=Math.sqrt(1-lat*lat)*1.018;
      points.push(new THREE.Vector3(Math.cos(a)*rr,lat,Math.sin(a)*rr));
    }
    const curve=new THREE.CatmullRomCurve3(points);
    const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,128,.021,5,false),new THREE.MeshBasicMaterial({color:path===0?mainColor:0xffd5b0}));
    parent.add(tube);
  }
  const bulbs=[0x84f6f0,0xff9bba,0xffd879,0xa4b5ff,0xf3ffe5];
  for(let i=0;i<28;i++){
    const lat=1-2*(i+.5)/28,lon=i*2.399,r=Math.sqrt(1-lat*lat);
    const dot=makeMesh(sphere,new THREE.MeshBasicMaterial({color:bulbs[i%bulbs.length]}),parent,Math.cos(lon)*r*1.028,lat*1.028,Math.sin(lon)*r*1.028,.055,.055,.055);
    if(i%4===0)makeMesh(new THREE.OctahedronGeometry(.075),new THREE.MeshBasicMaterial({color:starColor}),parent,dot.position.x*1.055,dot.position.y*1.055,dot.position.z*1.055);
  }
}
const actors=[];
function radiusFor(mass){return clamp(.77+1.39*Math.cbrt(mass/195),1.3,12.8);}
function createActor(name,x,z,mass,accent,color,isPlayer=false){
  const group=new THREE.Group();scene.add(group);
  const ball=new THREE.Group();group.add(ball);
  const whiteMaterial=new THREE.MeshStandardMaterial({map:snowTexture,color:color||0xffffff,roughness:.76,metalness:0,emissive:accent,emissiveIntensity:.11});
  const core=makeMesh(new THREE.SphereGeometry(1,36,24),whiteMaterial,ball);core.castShadow=isPlayer;core.receiveShadow=true;
  makeBallDecor(ball,accent,0xffe3a6);
  const ring=new THREE.Mesh(new THREE.RingGeometry(1.08,1.25,40),new THREE.MeshBasicMaterial({color:accent,side:THREE.DoubleSide,transparent:true,opacity:isPlayer?.46:.24,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;group.add(ring);
  const halo=glow(group,0,1,0,accent,isPlayer?8.4:5.9);halo.material.opacity=isPlayer?.15:.07;
  const tag=nameSprite(isPlayer?'YOU ✦':name,`#${new THREE.Color(accent).getHexString()}`);group.add(tag);
  const crown=new THREE.Group();group.add(crown);
  const hat=makeMesh(new THREE.ConeGeometry(.85,1.9,7),materials.ribbon,crown,0,1,0);
  makeMesh(sphere,materials.gold,crown,0,2.04,0,.28,.28,.28);
  makeMesh(new THREE.TorusGeometry(.81,.11,6,22),materials.gold,crown,0,.15,0).rotation.x=Math.PI/2;
  crown.visible=false;
  if(isPlayer){const light=new THREE.PointLight(accent,4.5,22,2);light.position.y=2.4;group.add(light);}
  const a={name,x,z,vx:0,vz:0,mass,score:0,accent,isPlayer,group,ball,core,ring,halo,tag,crown,
    radius:radiusFor(mass),alive:true,respawn:0,target:{x:0,z:0},aiTime:0,boost:0,cooldown:0,stun:0,
    inputX:0,inputZ:0,kills:0,crushed:0,trailing:0};
  actors.push(a);syncActor(a);return a;
}
function syncActor(a){
  a.radius=radiusFor(a.mass);
  a.group.position.set(a.x,terrainHeight(a.x,a.z),a.z);
  a.ball.position.y=a.radius*.95;
  a.ball.scale.setScalar(a.radius);
  a.ring.position.y=.09;a.ring.scale.setScalar(a.radius);
  a.halo.position.y=a.radius*.9;a.halo.scale.set(a.radius*4,a.radius*4,1);
  a.tag.position.y=a.radius*2.05+2.1;
  a.tag.scale.set(Math.max(5,a.radius*1.25),Math.max(1.28,a.radius*.3),1);
  a.crown.position.y=a.radius*1.85;
  a.crown.scale.setScalar(Math.max(.5,a.radius*.36));
  a.crown.visible=a.mass>1700;
}
const player=createActor('You',8,102,180,0x74f4ff,0xffffff,true);
const botNames=[['Frosty Finn',0xffa7c4,0xffe7eb],['Lady Flurry',0xfbd47b,0xfff8e6],['Sir Slush',0x9ceeb1,0xefffeb],['Minty Max',0xb9b2ff,0xf7f5ff],['Chilly Belle',0xffb382,0xfff0e1]];
const bots=botNames.map(([name,color,tint],i)=>{
  const a=i/5*PI2+.9,r=rand(65,123);
  return createActor(name,Math.cos(a)*r,Math.sin(a)*r,rand(180,360),color,tint);
});

const state={mode:'intro',time:270,elapsed:0,phase:'MIDNIGHT RUN',avalanche:0,nextAvalanche:57,
  shakes:0,victory:false,uiTime:0,studyUntil:0,freeze:0};
// One reachable destructible object at a time carries the current GoLingo word.
// Other snow objects still add mass; the beacon is the vocabulary objective.
let learning,learningTarget=null,modalWasPlaying=false;
const beacon=new THREE.Group();scene.add(beacon);
const beaconRing=new THREE.Mesh(new THREE.RingGeometry(1.4,1.77,48),new THREE.MeshBasicMaterial({color:0xa0fff0,side:THREE.DoubleSide,transparent:true,opacity:.85,depthWrite:false}));
beaconRing.rotation.x=-Math.PI/2;beaconRing.position.y=.18;beacon.add(beaconRing);
const beaconFlare=glow(beacon,0,3.2,0,0x8afbea,6);
const beaconColumn=makeMesh(new THREE.CylinderGeometry(.17,.32,5.2,10),new THREE.MeshBasicMaterial({color:0x8ef9eb,transparent:true,opacity:.22,depthWrite:false}),beacon,0,2.7,0);
const markerCanvas=document.createElement('canvas');markerCanvas.width=640;markerCanvas.height=164;
const markerTexture=new THREE.CanvasTexture(markerCanvas);markerTexture.colorSpace=THREE.SRGBColorSpace;
const markerSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:markerTexture,transparent:true,depthWrite:false,depthTest:false}));
markerSprite.position.set(0,7.8,0);markerSprite.scale.set(13,3.35,1);beacon.add(markerSprite);
function paintLearningMarker(item){
  if(!item)return;
  const c=markerCanvas.getContext('2d');c.clearRect(0,0,640,164);
  const show=learning?.settings?.showWords??true;
  const text=show?item.word:'✦';
  c.shadowColor='#67f9df';c.shadowBlur=27;c.fillStyle='rgba(8,48,68,.90)';
  c.beginPath();c.roundRect(15,14,610,133,36);c.fill();c.shadowBlur=0;
  c.strokeStyle='#c8ffef';c.lineWidth=5;c.stroke();
  c.fillStyle='#ffe5a3';c.font='900 23px Trebuchet MS,Arial';c.textAlign='center';c.fillText('✧ GOLINGO WORD ✧',320,49);
  const size=Math.max(29,Math.min(62,Math.floor(840/(Array.from(text).length+5))));
  c.fillStyle='#f4fff9';c.font=`900 ${size}px Trebuchet MS,Arial`;
  c.fillText(text.slice(0,60),320,115,560);
  markerTexture.needsUpdate=true;
  markerSprite.scale.x=show?14:6.4;
}
function selectLearningTarget(){
  const candidates=nearProps(player.x,player.z,75).filter(p=>p.alive&&p.threshold<=player.mass);
  if(!candidates.length){
    const rest=props.filter(p=>p.alive&&p.threshold<=player.mass);
    if(!rest.length){beacon.visible=false;learningTarget=null;return;}
    candidates.push(...rest);
  }
  // Prefer collectibles in the near field, but make an interesting star or
  // snowman slightly more appealing than a routine fence.
  candidates.sort((a,b)=>{
    const score=p=>distance(player,p)+(p.type==='star'?-12:p.type==='snowman'?-6:0);
    return score(a)-score(b);
  });
  learningTarget=candidates[0];
  beacon.visible=!!learningTarget;
  if(learningTarget)beacon.position.set(learningTarget.x,terrainHeight(learningTarget.x,learningTarget.z)+.14,learningTarget.z);
}
function changeLearningItem(item){
  paintLearningMarker(item);
  selectLearningTarget();
  if(item)UI.study.textContent='GOLINGO · FOLLOW THE GLOWING WORD';
}
function pauseForLesson(open){
  if(open){
    modalWasPlaying=state.mode==='playing';
    if(modalWasPlaying)state.mode='lesson';
  }else if(modalWasPlaying&&state.mode==='lesson'){
    state.mode='playing';modalWasPlaying=false;
  }
}
learning=createSnowLearning({onChange:changeLearningItem,isPlaying:()=>state.mode==='playing',onModalPause:pauseForLesson,notify:toast});
changeLearningItem(learning.current);
const keys=new Set();
const pointerInput={active:false,x:0,z:0,id:null};
const stick={active:false,id:null,x:0,z:0};
let muted=false,audioCtx=null,nextMusic=0,musicStep=0,lastSoundAt=0;

function setupAudio(){
  if(muted)return;
  if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});
}
function tone(freq,duration=.16,kind='sine',volume=.07,delay=0){
  if(muted||!audioCtx||audioCtx.state!=='running')return;
  const t=audioCtx.currentTime+delay;
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.type=kind;o.frequency.setValueAtTime(freq,t);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(volume,t+.018);
  g.gain.exponentialRampToValueAtTime(.0001,t+duration);
  o.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+duration+.05);
}
function chime(kind='pickup'){
  if(muted)return;
  const now=performance.now();if(now-lastSoundAt<65&&kind==='pickup')return;lastSoundAt=now;
  if(kind==='pickup'){const f=[523.25,587.33,659.25,783.99][Math.floor(rand(0,4))];tone(f,.18,'sine',.05);tone(f*2,.09,'sine',.018,.055);}
  else if(kind==='crush'){tone(160,.22,'triangle',.15);tone(350,.12,'sawtooth',.027,.025);}
  else if(kind==='boost'){tone(310,.27,'sawtooth',.07);tone(620,.27,'sine',.09,.09);}
  else if(kind==='victory'){[392,493.88,587.33,784,987.76,1174.66].forEach((f,i)=>tone(f,.75,'sine',.10,i*.15));}
  else if(kind==='hit'){tone(105,.36,'sawtooth',.12);}
}
function updateMusic(){
  if(muted||!audioCtx||audioCtx.state!=='running'||state.mode!=='playing')return;
  if(audioCtx.currentTime<nextMusic)return;
  const melody=[523.25,659.25,783.99,659.25,587.33,698.46,880,698.46,523.25,659.25,783.99,1046.5,880,783.99,659.25,587.33];
  const step=musicStep++%melody.length;
  tone(melody[step],.55,'sine',.018);
  if(step%4===0)tone([261.63,293.66,349.23,261.63][Math.floor(step/4)%4],1.65,'sine',.018);
  if(step%2===0)tone(melody[step]*2,.1,'triangle',.008,.1);
  nextMusic=audioCtx.currentTime+.44;
}
function updateSoundButtons(){
  UI.sound.textContent=muted?'♩':'♫';UI.sound.title=muted?'Unmute winter music':'Mute winter music';
  UI.introSound.textContent=muted?'♩ SOUND OFF':'♫ SOUND ON';
}
function toggleSound(){muted=!muted;if(!muted)setupAudio();updateSoundButtons();}

function toast(text,big=false){
  const el=document.createElement('div');el.className=`toast ${big?'big':''}`;el.innerHTML=text;
  UI.toasts.prepend(el);
  while(UI.toasts.children.length>4)UI.toasts.lastElementChild.remove();
  setTimeout(()=>el.remove(),2380);
}
function studyText(text){UI.study.textContent=text.toUpperCase();state.studyUntil=state.elapsed+3;}
function flash(opacity=.3){UI.flash.style.opacity=String(opacity);setTimeout(()=>UI.flash.style.opacity='0',110);}
function steerPlayer(){
  let x=0,z=0;
  if(keys.has('KeyA')||keys.has('ArrowLeft'))x--;
  if(keys.has('KeyD')||keys.has('ArrowRight'))x++;
  if(keys.has('KeyW')||keys.has('ArrowUp'))z--;
  if(keys.has('KeyS')||keys.has('ArrowDown'))z++;
  if(stick.active){x+=stick.x;z+=stick.z;}
  else if(pointerInput.active){x+=pointerInput.x;z+=pointerInput.z;}
  const l=Math.hypot(x,z);
  player.inputX=l>1?x/l:x;player.inputZ=l>1?z/l:z;
}
function chooseBotTarget(bot){
  const danger=actors.find(a=>a!==bot&&a.alive&&a.mass>bot.mass*1.35&&distance(a,bot)<25);
  if(danger){
    const dx=bot.x-danger.x,dz=bot.z-danger.z,l=Math.hypot(dx,dz)||1;
    bot.target={x:clamp(bot.x+dx/l*44,-135,135),z:clamp(bot.z+dz/l*44,-135,135)};return;
  }
  const prey=actors.filter(a=>a!==bot&&a.alive&&bot.mass>a.mass*1.5&&distance(a,bot)<34).sort((a,b)=>distance(a,bot)-distance(b,bot))[0];
  if(prey){bot.target={x:prey.x,z:prey.z};return;}
  const candidates=nearProps(bot.x,bot.z,53);
  let best=null,bestScore=-Infinity;
  for(const p of candidates){
    if(p.threshold>bot.mass||!p.alive)continue;
    const d=distance(bot,p);
    const s=p.gain/(d+12)+Math.random()*1.1;
    if(s>bestScore){best=p;bestScore=s;}
  }
  bot.target=best?{x:best.x,z:best.z}:placeRandom(32,135);
}
function steerBot(bot,dt){
  bot.aiTime-=dt;
  if(bot.aiTime<=0||Math.hypot(bot.target.x-bot.x,bot.target.z-bot.z)<2.4){
    chooseBotTarget(bot);bot.aiTime=rand(.55,1.25);
  }
  const dx=bot.target.x-bot.x,dz=bot.target.z-bot.z,l=Math.hypot(dx,dz)||1;
  bot.inputX=dx/l;bot.inputZ=dz/l;
}
const rollAxis=new THREE.Vector3(),rollQuat=new THREE.Quaternion();
function updateActor(a,dt){
  if(!a.alive){
    a.respawn-=dt;
    if(a.respawn<=0){
      const p=placeRandom(80,130);a.x=p.x;a.z=p.z;a.mass=a.isPlayer?180:rand(180,300);
      a.vx=0;a.vz=0;a.alive=true;a.group.visible=true;syncActor(a);
      burst(a.x,terrainHeight(a.x,a.z)+1,a.z,a.accent,36,9);
      if(a.isPlayer){toast('❄ REFORMED! ROLL AGAIN',true);selectLearningTarget();}
    }
    return;
  }
  if(!a.isPlayer)steerBot(a,dt);
  a.boost=Math.max(0,a.boost-dt);a.cooldown=Math.max(0,a.cooldown-dt);a.stun=Math.max(0,a.stun-dt);
  const h=.75;
  const gx=(terrainHeight(a.x+h,a.z)-terrainHeight(a.x-h,a.z))/(2*h);
  const gz=(terrainHeight(a.x,a.z+h)-terrainHeight(a.x,a.z-h))/(2*h);
  const massEffect=Math.pow(Math.max(1,a.mass/180),.09);
  const acceleration=(a.isPlayer?44:37)/massEffect*(a.boost>0?1.8:1)*(a.stun>0?.4:1);
  const inputX=a.inputX,inputZ=a.inputZ;
  a.vx+=(inputX*acceleration-gx*7.2)*dt;
  a.vz+=(inputZ*acceleration-gz*7.2)*dt;
  const friction=Math.exp(-2.15*dt);a.vx*=friction;a.vz*=friction;
  const maxSpeed=clamp(18.4-Math.log2(Math.max(1,a.mass/180))*.95,9.5,18.4)*(a.boost>0?1.64:1)*(a.isPlayer?1:.81);
  const speed=Math.hypot(a.vx,a.vz);
  if(speed>maxSpeed){a.vx*=maxSpeed/speed;a.vz*=maxSpeed/speed;}
  const oldX=a.x,oldZ=a.z;
  a.x+=a.vx*dt;a.z+=a.vz*dt;
  const rr=Math.hypot(a.x,a.z),limit=147-a.radius*.4;
  if(rr>limit){
    const nx=a.x/rr,nz=a.z/rr;a.x=nx*limit;a.z=nz*limit;
    const outward=a.vx*nx+a.vz*nz;if(outward>0){a.vx-=outward*1.8*nx;a.vz-=outward*1.8*nz;}
    if(a.isPlayer&&Math.random()<.03)toast('❄ THE MOUNTAINS BLOCK YOUR WAY');
  }
  const dx=a.x-oldX,dz=a.z-oldZ,travel=Math.hypot(dx,dz);
  if(travel>.0001){
    rollAxis.set(dz,0,-dx).normalize();rollQuat.setFromAxisAngle(rollAxis,travel/(a.radius*.85));
    a.ball.quaternion.premultiply(rollQuat);
  }
  syncActor(a);
  a.ring.material.opacity=(a.isPlayer?.27:.14)+Math.min(1,speed/18)*.16;
  if(speed>2){
    a.trailing+=dt*speed;
    if(a.trailing>.52){
      a.trailing=0;
      const back=tmpVec.set(-a.vx,0,-a.vz).normalize();
      const bx=a.x+back.x*a.radius*.78,bz=a.z+back.z*a.radius*.78;
      burst(bx,terrainHeight(bx,bz)+.35,bz,0xdbfaff,a.boost>0?6:3,a.boost>0?6:2.8);
    }
  }
}
function absorbProp(a,p){
  const wasLearningTarget=p===learningTarget;
  p.alive=false;p.hide();
  a.mass+=p.gain;a.score+=p.score;a.crushed++;
  if(wasLearningTarget){
    if(a.isPlayer){
      const learned=learning.collect();
      if(learned){
        a.score+=150;
        toast('✧ GOLINGO WORD COLLECTED <strong>+150</strong>',true);
        UI.study.textContent=`LEARNED · ${learned.word.toUpperCase()}`;
        state.studyUntil=state.elapsed+3;
      }
    }else selectLearningTarget();
  }
  const impactColor=p.type==='cottage'?0xffe1ad:p.type==='tree'?0x82f8b8:p.type==='star'?0xffdf85:0xb7f5ff;
  burst(p.x,terrainHeight(p.x,p.z)+1.3,p.z,impactColor,p.type==='cottage'?44:16,p.type==='cottage'?12:6);
  if(a.isPlayer){
    if(p.type==='cottage'||p.type==='tower'||p.type==='lamp'||p.type==='tree'&&a.crushed%3===0){
      const verb=p.type==='tree'?'flattened':p.type==='cottage'?'flattened':'snapped';
      toast(`✦ You ${verb} ${p.name} <strong>+${p.score}</strong>`);
    }else if(p.type==='star'){toast('✦ MAGIC STAR! <strong>+150</strong>');}
    if(!wasLearningTarget)studyText(`YOU COLLECTED ${p.name.toUpperCase()}`);
    if(p.type==='cottage'||p.type==='tower'){state.shakes=Math.max(state.shakes,.7);chime('crush');}
    else chime('pickup');
  }
  syncActor(a);
}
function collideProps(a){
  for(const p of nearProps(a.x,a.z,a.radius)){
    const dx=a.x-p.x,dz=a.z-p.z,dist=Math.hypot(dx,dz)||.001;
    const minDist=a.radius*.71+p.r*.79;
    if(dist>=minDist)continue;
    if(a.mass>=p.threshold||state.avalanche>0){absorbProp(a,p);continue;}
    const nx=dx/dist,nz=dz/dist,overlap=(minDist-dist);
    a.x+=nx*overlap*.44;a.z+=nz*overlap*.44;
    const into=a.vx*nx+a.vz*nz;
    if(into<0){a.vx-=into*1.14*nx;a.vz-=into*1.14*nz;}
  }
  if(castleAlive){
    const d=Math.hypot(a.x,a.z)||.001,minD=12.8+a.radius*.68;
    if(d<minD){
      if(a.isPlayer&&a.mass>=12250){topplePalace();return;}
      const nx=a.x/d,nz=a.z/d;a.x=nx*minD;a.z=nz*minD;
      const into=a.vx*nx+a.vz*nz;if(into<0){a.vx-=into*1.5*nx;a.vz-=into*1.5*nz;}
      if(a.isPlayer&&state.elapsed-state.freeze>3){
        toast(`♛ THE PALACE NEEDS <strong>${fmt(12250)} kg</strong>`);
        state.freeze=state.elapsed;
      }
    }
  }
}
function absorbActor(winner,loser){
  if(!loser.alive||!winner.alive)return;
  const gained=Math.floor(loser.mass*.63);
  winner.mass+=gained;winner.score+=Math.floor(loser.mass*.8)+300;winner.kills++;
  loser.alive=false;loser.respawn=loser.isPlayer?2.3:rand(3,5.5);loser.group.visible=false;
  burst(loser.x,terrainHeight(loser.x,loser.z)+loser.radius,loser.z,loser.accent,65,15);
  chime(loser.isPlayer?'hit':'crush');
  if(winner.isPlayer){toast(`💥 POOF! ${loser.name.toUpperCase()} UNWRAPPED!`,true);state.shakes=1.1;flash(.22);}
  if(loser.isPlayer){toast(`💨 ${winner.name.toUpperCase()} ATE YOU!`,true);state.shakes=1.35;flash(.37);}
  syncActor(winner);
}
function collideActors(){
  for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++){
    const a=actors[i],b=actors[j];if(!a.alive||!b.alive)continue;
    const dx=a.x-b.x,dz=a.z-b.z,d=Math.hypot(dx,dz)||.001;
    const limit=(a.radius+b.radius)*.72;
    if(d>=limit)continue;
    if(a.mass>b.mass*1.25){absorbActor(a,b);continue;}
    if(b.mass>a.mass*1.25){absorbActor(b,a);continue;}
    const nx=dx/d,nz=dz/d,push=(limit-d)*.48;
    a.x+=nx*push;b.x-=nx*push;a.z+=nz*push;b.z-=nz*push;
    a.vx+=nx*2.1;b.vx-=nx*2.1;a.vz+=nz*2.1;b.vz-=nz*2.1;
  }
}
function boost(){
  if(state.mode!=='playing'||!player.alive||player.cooldown>0)return;
  player.boost=1.9;player.cooldown=7.3;
  state.shakes=.2;
  burst(player.x,terrainHeight(player.x,player.z)+player.radius,player.z,0xffdf9d,57,12);
  toast('✦ FLARE BOOST!',true);chime('boost');
}
function topplePalace(){
  if(!castleAlive||state.mode!=='playing')return;
  castleAlive=false;state.victory=true;state.mode='won';
  learning.end();
  player.score+=10000;state.shakes=3.5;chime('victory');flash(.65);
  toast('♛ YOU TOPPLED THE ICE PALACE!',true);
  wrecks.push({group:palace,time:0,base:palace.position.y,castle:true});
  for(let i=0;i<13;i++){
    const a=i/13*PI2,r=rand(4,13);
    burst(Math.cos(a)*r,terrainHeight(0,0)+rand(7,23),Math.sin(a)*r,i%2?0x87f4ff:0xffde91,52,17);
  }
  setTimeout(()=>showEnd(true),1950);
}
function updateWrecks(dt){
  for(let i=wrecks.length-1;i>=0;i--){
    const w=wrecks[i];w.time+=dt;
    w.group.rotation.z+=dt*(w.castle?.42:1.9);
    w.group.rotation.x+=dt*(w.castle?.12:.8);
    w.group.position.y=w.base-w.time*(w.castle?8:4.7);
    const scale=Math.max(.001,1-w.time*(w.castle?.35:1.15));w.group.scale.setScalar(scale);
    if(w.time>(w.castle?3:1.1)){scene.remove(w.group);wrecks.splice(i,1);}
  }
}

function updateEvents(dt){
  state.time-=dt;state.elapsed+=dt;
  if(state.avalanche>0){
    state.avalanche=Math.max(0,state.avalanche-dt);
    if(state.avalanche===0){UI.avalanche.classList.add('hidden');toast('❄ THE AVALANCHE HAS PASSED');}
  }else if(state.elapsed>=state.nextAvalanche){
    state.avalanche=13;state.nextAvalanche+=70;
    UI.avalanche.classList.remove('hidden');toast('☃ AVALANCHE FEVER! CRUSH EVERYTHING!',true);
    chime('boost');flash(.22);
  }
  if(state.time<=0){state.time=0;state.mode='lost';learning.end();showEnd(false);return;}
  state.phase=state.time>192?'MIDNIGHT RUN':state.time>116?'NORTHERN LIGHTS':state.time>57?'BLUE HOUR':'DAWN IS COMING';
}
function showEnd(won){
  UI.end.classList.remove('hidden');
  $('end-crown').textContent=won?'♛':'☾';
  $('end-eyebrow').textContent=won?'A WINTER LEGEND':'THE SUN HAS RISEN';
  $('end-title').textContent=won?'ROYAL VICTORY!':'DAWN HAS ARRIVED';
  $('end-description').textContent=won?'The Ice Palace has fallen. All hail the Snow King!':'The winter night is over. Your legend can grow even bigger.';
  $('end-mass').textContent=`${fmt(player.mass)} kg`;
  $('end-score').textContent=fmt(player.score);
  $('end-crushed').textContent=fmt(player.crushed);
}
function updateHUD(){
  const seconds=Math.ceil(state.time),mm=String(Math.floor(seconds/60)).padStart(2,'0'),ss=String(seconds%60).padStart(2,'0');
  UI.clock.innerHTML=`${mm}:${ss} <span>UNTIL DAWN</span>`;
  UI.phase.textContent=state.phase;
  UI.mass.textContent=fmt(player.mass);
  UI.score.textContent=fmt(player.score);
  const milestones=[{kg:350,t:'CRUSH SNOWMEN'},{kg:530,t:'FLATTEN PINE TREES'},{kg:1250,t:'KNOCK OVER COTTAGES'},{kg:4300,t:'SMASH ICE TOWERS'},{kg:12250,t:'TOPPLE THE PALACE'}];
  const tier=milestones.find(m=>player.mass<m.kg)||{kg:player.mass,t:'PALACE READY!'};
  const idx=milestones.indexOf(tier),prev=idx>0?milestones[idx-1].kg:180;
  const pct=tier.kg===player.mass?100:clamp((player.mass-prev)/(tier.kg-prev)*100,0,100);
  UI.growth.style.width=`${pct}%`;UI.growthPct.textContent=`${Math.floor(pct)}%`;UI.tier.textContent=tier.t;
  const dist=Math.round(Math.hypot(player.x,player.z));
  UI.distance.textContent=player.mass>=12250?`${dist}m AWAY · YOU'RE READY!`:`${dist}m AWAY · ${fmt(Math.max(0,12250-player.mass))} kg TO GO`;
  UI.objective.textContent=player.mass>=12250?'CRUSH THE ICE PALACE!':'TOPPLE THE ICE PALACE';
  UI.arrow.style.transform=`rotate(${-90+Math.atan2(-player.x,player.z)*180/Math.PI}deg)`;
  if(state.avalanche>0)UI.avalancheCount.textContent=`${Math.ceil(state.avalanche)}s`;
  const cool=player.cooldown>0;
  UI.boost.classList.toggle('cooling',cool);
  UI.boostText.textContent=cool?`${Math.ceil(player.cooldown)}s`:'READY';
  if(state.studyUntil<state.elapsed)UI.study.textContent='✧ FOLLOW THE GLOWING WORD';
  const sorted=actors.slice().sort((a,b)=>b.mass-a.mass);
  UI.ranks.innerHTML=sorted.map((a,i)=>`<li class="rank-item ${a.isPlayer?'me':''}"><span class="rank-num">${i+1}</span><span class="rank-dot" style="background:#${new THREE.Color(a.accent).getHexString()};color:#${new THREE.Color(a.accent).getHexString()}"></span><span class="rank-name">${a.isPlayer?'YOU':a.name}</span><span class="rank-mass">${fmt(a.mass)} kg</span></li>`).join('');
}

const camLook=new THREE.Vector3(0,7,0);
const camGoal=new THREE.Vector3();
const gameClock=new THREE.Clock();
let renderedAt=0;
function updateCamera(dt,now){
  if(state.mode==='intro'){
    const t=now*.00007;
    camGoal.set(49+Math.sin(t)*16,66,103+Math.cos(t)*9);
    camera.position.lerp(camGoal,Math.min(1,dt*.65));
    camLook.lerp(new THREE.Vector3(3,5,10),Math.min(1,dt*.65));
  }else{
    const r=player.radius,portrait=innerHeight>innerWidth;
    const elev=portrait?33:24,back=portrait?43:33;
    camGoal.set(player.x,terrainHeight(player.x,player.z)+elev+r*2.45,player.z+back+r*2.55);
    camera.position.lerp(camGoal,1-Math.exp(-2.8*dt));
    camLook.lerp(new THREE.Vector3(player.x,terrainHeight(player.x,player.z)+r*.5,player.z-(portrait?4:9)),1-Math.exp(-4*dt));
  }
  if(state.shakes>.002){
    camera.position.x+=rand(-1,1)*state.shakes*.4;
    camera.position.y+=rand(-1,1)*state.shakes*.23;
    camera.position.z+=rand(-1,1)*state.shakes*.4;
    state.shakes*=Math.exp(-4.3*dt);
  }
  camera.lookAt(camLook);
  skyGroup.position.copy(camera.position);
  moonLight.position.set(camLook.x-75,115,camLook.z-110);
  moonLight.target.position.set(camLook.x,0,camLook.z);
  moonLight.target.updateMatrixWorld();
}
function animate(){
  const dt=Math.min(.052,gameClock.getDelta()),now=performance.now();
  if(state.mode==='playing'){
    steerPlayer();
    for(const a of actors)updateActor(a,dt);
    for(const a of actors)if(a.alive)collideProps(a);
    collideActors();
    updateEvents(dt);
    updateMusic();
    if(now-renderedAt>130){updateHUD();renderedAt=now;}
  }
  if(beacon.visible&&learningTarget){
    beaconRing.scale.setScalar(1+.12*Math.sin(now*.003));
    beaconFlare.material.opacity=.46+.19*Math.sin(now*.004);
    beaconColumn.material.opacity=.16+.09*Math.sin(now*.004);
    if(state.mode==='playing'&&(!learningTarget.alive||distance(player,learningTarget)>90))selectLearningTarget();
  }
  // Keep the snow, aurora and collapsing palace moving on pause/end screens.
  updateSnow(dt,player);
  updateImpacts(dt);
  updateWrecks(dt);
  for(const ribbon of auroraMeshes)ribbon.material.uniforms.uTime.value=now*.001;
  for(const a of actors){
    a.halo.material.opacity=(a.isPlayer?.12:.06)+(Math.sin(now*.002+a.x)*.03);
    if(a.crown.visible)a.crown.rotation.y=now*.00035;
  }
  updateCamera(dt,now);
  renderer.render(scene,camera);
}
renderer.setAnimationLoop(animate);

function startGame(){
  if(state.mode!=='intro')return;
  state.mode='playing';UI.intro.classList.add('hidden');UI.hud.classList.remove('hidden');
  updateHUD();setupAudio();nextMusic=audioCtx?.currentTime||0;learning.start();selectLearningTarget();
  toast('❄ ROLL OVER SMALLER THINGS TO GROW!',true);
}
function pauseGame(){
  if(state.mode==='playing'){state.mode='paused';learning.pause();UI.pause.classList.remove('hidden');}
  else if(state.mode==='paused'){state.mode='playing';UI.pause.classList.add('hidden');learning.resume();}
}
function restartGame(){window.location.reload();}

$('start-btn').addEventListener('click',startGame);
$('replay-btn').addEventListener('click',restartGame);
$('restart-btn').addEventListener('click',restartGame);
$('resume-btn').addEventListener('click',pauseGame);
$('help-btn').addEventListener('click',pauseGame);
$('end-review').addEventListener('click',()=>learning.openModal('basket'));
UI.boost.addEventListener('click',boost);
UI.sound.addEventListener('click',toggleSound);
UI.introSound.addEventListener('click',toggleSound);

window.addEventListener('keydown',event=>{
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))event.preventDefault();
  if(event.code==='KeyP'||event.code==='Escape'){if(!event.repeat)pauseGame();return;}
  if(event.code==='Space'&&!event.repeat){if(state.mode==='intro')startGame();else boost();}
  keys.add(event.code);
});
window.addEventListener('keyup',event=>keys.delete(event.code));

// Drag anywhere on the scene to steer with mouse or touch. UI never navigates
// or pauses on a drag; joystick pointer capture is kept entirely separate.
renderer.domElement.addEventListener('pointerdown',event=>{
  if(state.mode!=='playing')return;
  renderer.domElement.setPointerCapture(event.pointerId);
  pointerInput.active=true;pointerInput.id=event.pointerId;
  updatePointer(event);
});
function updatePointer(event){
  const rect=renderer.domElement.getBoundingClientRect();
  const x=(event.clientX-rect.left-rect.width*.5)/(rect.width*.23);
  const z=(event.clientY-rect.top-rect.height*.52)/(rect.height*.24);
  const l=Math.hypot(x,z)||1;pointerInput.x=clamp(x/l*Math.min(1,l),-1,1);pointerInput.z=clamp(z/l*Math.min(1,l),-1,1);
}
renderer.domElement.addEventListener('pointermove',event=>{
  if(pointerInput.active&&event.pointerId===pointerInput.id)updatePointer(event);
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(type,event=>{
  if(event.pointerId===pointerInput.id){pointerInput.active=false;pointerInput.x=pointerInput.z=0;}
});

function updateStick(event){
  const rect=UI.joystick.querySelector('.joystick-ring').getBoundingClientRect();
  const dx=event.clientX-(rect.left+rect.width/2),dy=event.clientY-(rect.top+rect.height/2),max=rect.width*.32;
  const l=Math.hypot(dx,dy)||1,s=Math.min(l,max);
  stick.x=dx/l*s/max;stick.z=dy/l*s/max;
  UI.knob.style.transform=`translate(${stick.x*max}px,${stick.z*max}px)`;
}
UI.joystick.addEventListener('pointerdown',event=>{
  if(state.mode!=='playing')return;
  event.preventDefault();event.stopPropagation();
  stick.active=true;stick.id=event.pointerId;
  UI.joystick.setPointerCapture(event.pointerId);updateStick(event);
});
UI.joystick.addEventListener('pointermove',event=>{
  if(stick.active&&event.pointerId===stick.id){event.preventDefault();updateStick(event);}
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])UI.joystick.addEventListener(type,event=>{
  if(event.pointerId!==stick.id)return;
  stick.active=false;stick.x=stick.z=0;UI.knob.style.transform='translate(0px,0px)';
});

window.addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,isTouch?1.45:1.8));
});

// The illustrated fallback uses the exact same live actors, destruction state,
// collision grid, physics, particles, leaderboard and win condition as WebGL.
// It is especially useful for WebViews that refuse to allocate a GPU context.
function renderFallback(c,w,h){
  const time=performance.now()*.001;
  const intro=state.mode==='intro';
  const focusX=intro?0:player.x,focusZ=intro?8:player.z-14;
  const zoom=clamp(1-Math.max(0,player.radius-3)*.035,.67,1);
  const scale=(intro?Math.min(w/225,h/161):Math.min(w/(innerWidth<650?91:118),h/123))*zoom;
  const groundY=h*.61;
  const p=(x,z,y=0)=>({x:w*.5+(x-focusX)*scale+(z-focusZ)*scale*.045,y:groundY+(z-focusZ)*scale*.65-y*scale*.78});
  c.save();c.clearRect(0,0,w,h);
  const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#050f25');sky.addColorStop(.44,'#173a57');sky.addColorStop(1,'#89b8c7');c.fillStyle=sky;c.fillRect(0,0,w,h);
  // Stars, moon glow, and slow-moving green aurora curtains.
  for(let i=0;i<150;i++){
    const x=(Math.sin(i*44.92)*41213.9%1+1)%1*w,y=(Math.sin(i*9.18)*812.1%1+1)%1*h*.49;
    const r=(i%5===0?1.35:.7)*(1+.22*Math.sin(time*1.5+i));
    c.fillStyle=i%7?'#d5effca8':'#fff4c4';c.beginPath();c.arc(x,y,r,0,PI2);c.fill();
  }
  c.save();c.globalCompositeOperation='screen';
  for(let j=0;j<4;j++){
    const xx=w*(.11+j*.21),yy=h*(.19+j*.025),gradient=c.createLinearGradient(xx,yy-80,xx+130,yy+190);
    gradient.addColorStop(0,'#55faac00');gradient.addColorStop(.46,j%2?'#24fac633':'#5ae8d633');gradient.addColorStop(.6,'#8affd435');gradient.addColorStop(1,'#45f5be00');
    c.fillStyle=gradient;c.beginPath();c.moveTo(xx-100,-20);
    for(let i=0;i<=20;i++){const x=xx-100+i*w*.023;c.lineTo(x,yy+Math.sin(i*.6+time*.4+j)*31+52);}
    c.lineTo(xx+w*.43,-20);c.closePath();c.fill();
  }
  c.restore();
  const mx=w*.18,my=h*.14,mr=Math.min(w,h)*.065;
  const mg=c.createRadialGradient(mx,my,3,mx,my,mr*3.2);mg.addColorStop(0,'#fff8d2bb');mg.addColorStop(.27,'#dbecdf4a');mg.addColorStop(1,'#a9d6ed00');
  c.fillStyle=mg;c.beginPath();c.arc(mx,my,mr*3.2,0,PI2);c.fill();
  c.fillStyle='#fff9df';c.beginPath();c.arc(mx,my,mr,0,PI2);c.fill();
  for(let i=0;i<6;i++){c.fillStyle='#e5dcb945';c.beginPath();c.arc(mx+Math.sin(i*5)*mr*.55,my+Math.cos(i*2)*mr*.53,mr*(.07+i*.018),0,PI2);c.fill();}
  // The front snowfield, moonlit hills, ridge shadows and drifting paths.
  const ground=c.createLinearGradient(0,h*.22,0,h);ground.addColorStop(0,'#b1d8e1');ground.addColorStop(.5,'#e1f3f5');ground.addColorStop(1,'#cadfe9');
  c.fillStyle=ground;c.beginPath();c.moveTo(0,h*.29);
  for(let i=0;i<=32;i++){const x=w*i/32;c.lineTo(x,h*(.30+.048*Math.sin(i*.43)+.013*Math.sin(i*1.8)));}
  c.lineTo(w,h);c.lineTo(0,h);c.closePath();c.fill();
  for(let i=0;i<24;i++){
    const x=(i*79.23%w),y=h*.34+(i*73.1%(h*.69)),r=18+(i*19%68);
    c.fillStyle=i%2?'#9dbdcb10':'#fffefd24';c.beginPath();c.ellipse(x,y,r,r*.18,-.1,0,PI2);c.fill();
  }
  const palacePoint=p(0,0,terrainHeight(0,0));
  const drawPalace=()=>{
    if(!castleAlive||palacePoint.x<-220||palacePoint.x>w+220)return;
    const {x,y}=palacePoint,s=scale*.85;
    c.save();c.shadowColor='#6ae7ff';c.shadowBlur=21;
    c.fillStyle='#4eafc36b';c.beginPath();c.ellipse(x,y+3*s,17*s,5*s,0,0,PI2);c.fill();
    c.shadowBlur=0;
    c.fillStyle='#7eddec';c.beginPath();c.ellipse(x,y,16*s,6*s,0,0,PI2);c.fill();
    c.fillStyle='#baf8fe';c.fillRect(x-7*s,y-23*s,14*s,23*s);
    c.fillStyle='#7fcbdf';c.fillRect(x-7*s,y-22*s,3*s,22*s);
    c.fillStyle='#93e8ef';c.beginPath();c.moveTo(x-9*s,y-23*s);c.lineTo(x,y-36*s);c.lineTo(x+9*s,y-23*s);c.closePath();c.fill();
    for(const side of [-1,1]){
      const tx=x+side*10*s;
      c.fillStyle='#8acdda';c.fillRect(tx-3.1*s,y-20*s,6.2*s,20*s);
      c.fillStyle='#bcfaff';c.beginPath();c.moveTo(tx-4*s,y-20*s);c.lineTo(tx,y-32*s);c.lineTo(tx+4*s,y-20*s);c.closePath();c.fill();
      c.fillStyle='#ffe8a5';for(let i=0;i<3;i++)c.fillRect(tx-.8*s,y-(15-i*5)*s,1.6*s,2*s);
    }
    c.fillStyle='#a3ebf5';c.beginPath();c.moveTo(x-3*s,y-36*s);c.lineTo(x,y-42*s);c.lineTo(x+3*s,y-36*s);c.closePath();c.fill();
    c.fillStyle='#f9dca0';for(let i=-1;i<=1;i++)c.fillRect(x+i*4*s-1*s,y-19*s,2*s,4*s);
    c.fillStyle='#355978';c.beginPath();c.roundRect(x-2*s,y-7*s,4*s,7*s,3*s);c.fill();
    c.font=`${Math.max(9,12*scale/5)}px Trebuchet MS`;c.textAlign='center';c.fillStyle='#fff6d2';
    c.shadowColor='#264c6c';c.shadowBlur=5;c.fillText('♛ ICE PALACE',x,y-44*s);c.restore();
  };
  const objects=props.filter(v=>v.alive).map(v=>({type:'prop',data:v,z:v.z}));
  objects.push({type:'castle',z:0});
  for(const a of actors)if(a.alive)objects.push({type:'actor',data:a,z:a.z});
  objects.sort((a,b)=>a.z-b.z);
  const ovalShadow=(x,y,r)=>{c.fillStyle='#4a8fa42a';c.beginPath();c.ellipse(x,y,r*1.18,r*.33,0,0,PI2);c.fill();};
  for(const item of objects){
    if(item.type==='castle'){drawPalace();continue;}
    if(item.type==='actor'){
      const a=item.data,at=p(a.x,a.z,terrainHeight(a.x,a.z)),r=a.radius*scale*1.18;
      if(at.x< -r*3||at.x>w+r*3||at.y<h*.26||at.y>h+r*3)continue;
      const x=at.x,y=at.y-r*.45;
      ovalShadow(x,at.y+2,r*1.07);
      c.save();c.shadowColor=`#${new THREE.Color(a.accent).getHexString()}`;c.shadowBlur=a.isPlayer?24:13;
      const grad=c.createRadialGradient(x-r*.37,y-r*.44,r*.1,x,y,r*1.08);
      grad.addColorStop(0,'#ffffff');grad.addColorStop(.5,a.isPlayer?'#f0fcff':'#fff4ed');grad.addColorStop(1,'#88bad0');
      c.fillStyle=grad;c.beginPath();c.arc(x,y,r,0,PI2);c.fill();
      c.shadowBlur=0;c.strokeStyle=`#${new THREE.Color(a.accent).getHexString()}`;c.lineWidth=Math.max(2,r*.075);
      c.beginPath();c.ellipse(x,y,r*.83,r*.36,-.35,0,PI2);c.stroke();
      for(let i=0;i<12;i++){
        const t=i/12*PI2+time*.2,yy=y+Math.sin(t)*r*.29;
        c.fillStyle=['#ff7ca9','#ffe29a','#84f9ed','#b1a8ff'][i%4];c.beginPath();c.arc(x+Math.cos(t)*r*.79,yy,Math.max(1.7,r*.07),0,PI2);c.fill();
      }
      c.fillStyle='#b4d8e6';for(let i=0;i<14;i++){const t=i*2.4;c.beginPath();c.arc(x+Math.cos(t)*r*.69,y+Math.sin(t)*r*.75,Math.max(.6,r*.014),0,PI2);c.fill();}
      if(a.crown.visible){c.fillStyle='#ffdd91';c.beginPath();c.moveTo(x-r*.29,y-r*1.02);c.lineTo(x-r*.38,y-r*1.47);c.lineTo(x,y-r*1.22);c.lineTo(x+r*.35,y-r*1.47);c.lineTo(x+r*.26,y-r*1.03);c.closePath();c.fill();}
      c.font=`900 ${clamp(10+r*.14,10,18)}px Trebuchet MS`;c.textAlign='center';c.lineWidth=3;c.strokeStyle='#0b2540';
      const label=a.isPlayer?'✦ YOU':a.name.toUpperCase();c.strokeText(label,x,y-r-12);c.fillStyle='#fff8db';c.fillText(label,x,y-r-12);
      c.restore();continue;
    }
    const d=item.data,at=p(d.x,d.z,terrainHeight(d.x,d.z)),x=at.x,y=at.y,s=scale;
    if(x< -50||x>w+50||y<h*.27||y>h+45)continue;
    c.save();ovalShadow(x,y,d.r*s*.9);
    if(d.type==='gift'){
      c.fillStyle='#e46f96';c.fillRect(x-s*.44,y-s*.87,s*.87,s*.84);c.fillStyle='#ffd790';c.fillRect(x-s*.11,y-s*.91,s*.22,s*.91);c.fillRect(x-s*.48,y-s*.58,s*.96,s*.16);
      c.strokeStyle='#fff1af';c.lineWidth=Math.max(1,s*.10);c.beginPath();c.arc(x-s*.16,y-s*.95,s*.19,0,PI2);c.arc(x+s*.16,y-s*.95,s*.19,0,PI2);c.stroke();
    }else if(d.type==='candy'){
      c.fillStyle='#fff8ec';c.beginPath();c.arc(x,y-s*.55,s*.49,0,PI2);c.fill();c.strokeStyle='#f17c9e';c.lineWidth=Math.max(1,s*.15);
      c.beginPath();c.arc(x,y-s*.55,s*.32,-1.1,1.8);c.stroke();
    }else if(d.type==='star'){
      c.fillStyle='#ffdb80';c.shadowColor='#ffcb62';c.shadowBlur=13;c.beginPath();
      for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?s*.32:s*.76;c.lineTo(x+Math.cos(a)*r,y-s+Math.sin(a)*r);}
      c.closePath();c.fill();
    }else if(d.type==='fence'){
      c.strokeStyle='#87a3b3';c.lineWidth=Math.max(2,s*.19);
      c.beginPath();c.moveTo(x-s*1.4,y-s*.8);c.lineTo(x+s*1.4,y-s*.8);c.moveTo(x-s*1.4,y-s*.35);c.lineTo(x+s*1.4,y-s*.35);c.stroke();
      for(const off of [-1.35,1.35]){c.fillStyle='#f5ffff';c.fillRect(x+off*s-s*.13,y-s*1.2,s*.26,s*1.35);}
    }else if(d.type==='snowman'){
      for(const [off,rr] of [[.67,.75],[1.65,.55],[2.35,.38]]){c.fillStyle='#f7feff';c.beginPath();c.arc(x,y-s*off,s*rr,0,PI2);c.fill();}
      c.fillStyle='#3c536b';c.fillRect(x-s*.41,y-s*2.9,s*.84,s*.28);c.fillRect(x-s*.25,y-s*3.35,s*.52,s*.5);
      c.fillStyle='#ffa46e';c.beginPath();c.moveTo(x,y-s*2.35);c.lineTo(x+s*.52,y-s*2.24);c.lineTo(x,y-s*2.2);c.closePath();c.fill();
    }else if(d.type==='tree'){
      const size=clamp(d.r,1,2.3),ss=s*size;
      c.fillStyle='#745c73';c.fillRect(x-ss*.1,y-ss*1.5,ss*.2,ss*1.7);
      for(let j=0;j<3;j++){
        const by=y-ss*(.3+j*.76),top=by-ss*1.9;
        c.fillStyle=j%2?'#2a7b72':'#286b70';c.beginPath();c.moveTo(x,top);c.lineTo(x-ss*(1.02-j*.14),by);c.lineTo(x+ss*(1.02-j*.14),by);c.closePath();c.fill();
        c.strokeStyle='#d6f7f4';c.lineWidth=Math.max(1,ss*.16);c.beginPath();c.moveTo(x,top);c.lineTo(x-ss*(.91-j*.13),by-ss*.09);c.stroke();
      }
    }else if(d.type==='lamp'){
      c.strokeStyle='#586d87';c.lineWidth=Math.max(2,s*.17);c.beginPath();c.moveTo(x,y);c.lineTo(x,y-s*4.1);c.stroke();
      const lg=c.createRadialGradient(x,y-s*4.2,1,x,y-s*4.2,s*2.3);lg.addColorStop(0,'#ffe59d99');lg.addColorStop(1,'#ffe6ac00');
      c.fillStyle=lg;c.beginPath();c.arc(x,y-s*4.2,s*2.3,0,PI2);c.fill();
      c.fillStyle='#ffe0a0';c.beginPath();c.arc(x,y-s*4.2,s*.39,0,PI2);c.fill();
    }else if(d.type==='tower'){
      c.fillStyle='#86cbdc';c.fillRect(x-s*2.8,y-s*10.6,s*5.6,s*10.6);
      c.fillStyle='#bcf8f9';c.beginPath();c.moveTo(x-s*3.7,y-s*10.6);c.lineTo(x,y-s*18.2);c.lineTo(x+s*3.7,y-s*10.6);c.closePath();c.fill();
      c.fillStyle='#ffe1a2';for(let i=0;i<3;i++)c.fillRect(x-s*.65,y-s*(3.3+i*3.1),s*1.3,s*1.8);
    }else if(d.type==='cottage'){
      c.fillStyle='#aac6ce';c.fillRect(x-s*2.1,y-s*3.9,s*4.2,s*3.9);
      c.fillStyle='#6a729c';c.beginPath();c.moveTo(x-s*2.7,y-s*3.9);c.lineTo(x,y-s*6.8);c.lineTo(x+s*2.7,y-s*3.9);c.closePath();c.fill();
      c.strokeStyle='#f5f5fa';c.lineWidth=Math.max(1,s*.21);c.beginPath();c.moveTo(x,y-s*6.8);c.lineTo(x+s*2.75,y-s*3.9);c.stroke();
      c.fillStyle='#63485f';c.fillRect(x-s*.49,y-s*2.1,s*.98,s*2.1);
      c.fillStyle='#ffe1a0';for(const side of [-1,1]){c.fillRect(x+side*s*1.29-s*.4,y-s*2.65,s*.8,s*.95);}
      c.fillStyle='#ffc980';c.beginPath();c.arc(x+s*.7,y-s*1,Math.max(1,s*.1),0,PI2);c.fill();
      c.fillStyle='#e6f6fb';c.fillRect(x-s*1.9,y-s*4.02,s*3.8,s*.16);
    }
    c.restore();
  }
  if(learningTarget?.alive&&beacon.visible){
    const q=p(learningTarget.x,learningTarget.z,terrainHeight(learningTarget.x,learningTarget.z));
    if(q.x>-110&&q.x<w+110&&q.y>h*.27&&q.y<h+50){
      const pulse=1+.18*Math.sin(time*4),r=Math.max(12,scale*2.45*pulse);
      c.save();c.shadowColor='#82ffe1';c.shadowBlur=22;
      c.strokeStyle='#a1ffe5';c.lineWidth=Math.max(2,scale*.23);
      c.beginPath();c.ellipse(q.x,q.y,r,r*.37,0,0,PI2);c.stroke();
      c.shadowBlur=0;c.strokeStyle='#9deeda9c';c.lineWidth=2;
      c.beginPath();c.moveTo(q.x,q.y-r*.35);c.lineTo(q.x,q.y-40);c.stroke();
      const title=learning.settings.showWords?learning.current.word:'✧';
      const labelWidth=Math.min(255,Math.max(75,title.length*11+24));
      c.fillStyle='#103c53ed';c.strokeStyle='#b2ffe8';c.lineWidth=1.5;
      c.beginPath();c.roundRect(q.x-labelWidth/2,q.y-77,labelWidth,37,12);c.fill();c.stroke();
      c.font='900 9px Trebuchet MS,Arial';c.textAlign='center';c.fillStyle='#ffe9ac';c.fillText('✧ GOLINGO',q.x,q.y-65);
      c.font='900 15px Trebuchet MS,Arial';c.fillStyle='#f9fffc';c.fillText(title,q.x,q.y-49,labelWidth-12);
      c.restore();
    }
  }
  // Spray and sparkles follow actual momentum/impact events.
  for(let i=0;i<impactPool.length;i++){
    const sp=impactPool[i],q=p(sp.x,sp.z,sp.y);
    if(q.x<0||q.x>w||q.y<0||q.y>h)continue;
    c.fillStyle=`rgba(${Math.floor(sp.color.r*255)},${Math.floor(sp.color.g*255)},${Math.floor(sp.color.b*255)},${clamp(sp.life,0,1)})`;
    c.beginPath();c.arc(q.x,q.y,Math.max(1.3,scale*.16),0,PI2);c.fill();
  }
  c.fillStyle='#fffaffaa';
  for(let i=0;i<160;i++){
    const x=(i*67.17+Math.sin(i*5.1)*30+time*(7+i%6))%w;
    const y=(i*71.13+time*(18+i%7*3))%h;
    c.beginPath();c.arc(x,y,i%9===0?2.2:1,0,PI2);c.fill();
  }
  c.restore();
}
