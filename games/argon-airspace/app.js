import * as THREE from './three.module.js';
import {createLearningController} from './lesson.js';

// Argon Airspace — all geometry, textures, music and game systems are original.
const $ = (id) => document.getElementById(id);
const COLORS = {jet:0xda5b4b,prop:0xf0cb55,biplane:0x67c9e0,heli:0x78bb70};
const CSS_COLORS = {jet:'#e36a56',prop:'#f5d265',biplane:'#7bd4ec',heli:'#8dcf80'};
const TYPES = {
  jet:{name:'JETLINER',prefix:'ARG',speed:4.6,scale:1.05,collision:4.6},
  prop:{name:'TWIN-PROP',prefix:'DCA',speed:3.45,scale:1.0,collision:4.0},
  biplane:{name:'BIPLANE',prefix:'AIR',speed:3.05,scale:1.0,collision:3.6},
  heli:{name:'RESCUE',prefix:'MED',speed:2.7,scale:1.0,collision:3.4}
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);
const pick=(arr)=>arr[(Math.random()*arr.length)|0];
const v3=(x,y,z)=>new THREE.Vector3(x,y,z);
const up=v3(0,1,0);
const worldPlane=new THREE.Plane(up,0);
const raycaster=new THREE.Raycaster();
const ndc=new THREE.Vector2();
const scene=new THREE.Scene();
scene.background=new THREE.Color('#bd7955');
const camera=new THREE.OrthographicCamera(-80,80,50,-50,.1,700);
camera.up.set(0,0,-1);
camera.position.set(0,160,44);
camera.lookAt(0,0,0);
let renderer,canvasFallback=false,fallbackContext,fallbackBackground;
const renderCanvas=$('scene');
try{
  const probe=document.createElement('canvas');
  if(!probe.getContext('webgl2')&&!probe.getContext('webgl'))throw new Error('WebGL disabled');
  renderer=new THREE.WebGLRenderer({canvas:renderCanvas,antialias:true,powerPreference:'high-performance',alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.setSize(window.innerWidth,window.innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.48;
}catch(error){
  canvasFallback=true;
  fallbackContext=renderCanvas.getContext('2d');
  if(!fallbackContext)throw new Error('A canvas graphics context is required');
  renderer={capabilities:{getMaxAnisotropy:()=>1},setPixelRatio:()=>{},setSize:(w,h)=>{const d=Math.min(devicePixelRatio||1,2);renderCanvas.width=Math.round(w*d);renderCanvas.height=Math.round(h*d);renderCanvas.style.width=w+'px';renderCanvas.style.height=h+'px';fallbackContext.setTransform(d,0,0,d,0,0)},render:()=>renderFallback()};
  renderer.setSize(window.innerWidth,window.innerHeight);
}
scene.add(new THREE.HemisphereLight(0xffeec9,0x824c37,2.25));
const sun=new THREE.DirectionalLight(0xffe5b1,2.1);
sun.position.set(-35,90,55);scene.add(sun);
const mat=(color,options={})=>new THREE.MeshStandardMaterial({color,roughness:.78,metalness:0,...options});
const palette={dark:mat(0x45443c),dark2:mat(0x272d2f),silver:mat(0xd5d9ca,{metalness:.25}),cream:mat(0xf4dfb3),glass:mat(0x304c54,{metalness:.36,roughness:.19}),white:mat(0xf6eed2),earth:mat(0xc78159),tower:mat(0xd9bc8e),roof:mat(0xa34c3b),tree:mat(0x5e7c35)};
const geometryCache={box:new THREE.BoxGeometry(1,1,1), sphere:new THREE.SphereGeometry(1,10,7), cone:new THREE.ConeGeometry(1,1,8), cylinder:new THREE.CylinderGeometry(1,1,1,10)};
const destinations=[];
const activePlanes=[];
const drags=new Map();
const effects=[];
const airfield=new THREE.Group(); scene.add(airfield);
const aircraftGroup=new THREE.Group();scene.add(aircraftGroup);
const effectGroup=new THREE.Group();scene.add(effectGroup);

const game={mode:'ready',time:0,realTime:0,landed:0,high:loadHigh(),nextId:1,spawnTimer:2.5,speed:1,windKts:8,windAngle:Math.PI*1.4,windChange:25,warningCooldown:0,toastUntil:0,tutorialUntil:0,firstSpawn:true,landingsSinceCallout:0};
$('high').textContent=String(game.high).padStart(2,'0');
const learning=createLearningController({
  getMode:()=>game.mode,
  pauseGame:()=>{togglePause(true);$('pauseOverlay').hidden=true},
  resumeGame:()=>togglePause(false),
  notify:(message)=>showToast(message),
  paChime:()=>audio.paChime()
});

function loadHigh(){try{return Math.max(0,parseInt(localStorage.getItem('argon_airspace_high_v1')||'0',10)||0)}catch{return 0}}
function saveHigh(){try{localStorage.setItem('argon_airspace_high_v1',String(game.high))}catch{}}

function partBox(parent,color,x,y,z,w,h,d,ry=0){const mesh=new THREE.Mesh(geometryCache.box,typeof color==='number'?mat(color):color);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.rotation.y=ry;parent.add(mesh);return mesh}
function partSphere(parent,color,x,y,z,sx,sy,sz){const mesh=new THREE.Mesh(geometryCache.sphere,typeof color==='number'?mat(color):color);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);return mesh}
function cyl(parent,color,x,y,z,top,bottom,height,rx=0,rz=0){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,height,10),typeof color==='number'?mat(color):color);mesh.position.set(x,y,z);mesh.rotation.set(rx,0,rz);parent.add(mesh);return mesh}
function textCanvas(label,background='transparent',color='#fff2d5',size=70){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,512,256);if(background!=='transparent'){ctx.fillStyle=background;ctx.fillRect(0,0,512,256)}ctx.font=`900 ${size}px Georgia`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(label,256,129);const tx=new THREE.CanvasTexture(canvas);tx.colorSpace=THREE.SRGBColorSpace;return tx}
function groundText(label,x,z,w,h,color='#f9e8bc',angle=0){const material=new THREE.MeshBasicMaterial({map:textCanvas(label,'transparent',color,84),transparent:true,depthWrite:false,side:THREE.DoubleSide});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);mesh.rotation.x=-Math.PI/2;mesh.rotation.z=angle;mesh.position.set(x,.48,z);airfield.add(mesh);return mesh}

function desertTexture(){const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');ctx.fillStyle='#bb7652';ctx.fillRect(0,0,1024,1024);let seed=14982;const r=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};for(let i=0;i<11500;i++){const x=r()*1024,y=r()*1024,s=.4+r()*3.8;ctx.fillStyle=r()>.52?'rgba(255,216,147,.13)':'rgba(88,46,30,.10)';ctx.fillRect(x,y,s,s)}for(let i=0;i<260;i++){const x=r()*1024,y=r()*1024;ctx.beginPath();ctx.moveTo(x,y);let px=x,py=y;for(let j=0;j<4+(r()*5|0);j++){px+=(r()-.5)*40;py+=(r()-.5)*35;ctx.lineTo(px,py)}ctx.strokeStyle='rgba(91,48,34,.20)';ctx.lineWidth=.8+r()*1.5;ctx.stroke();if(r()>.62){ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+(r()-.5)*34,py+(r()-.5)*34);ctx.stroke()}}
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(2.3,2.3);texture.anisotropy=renderer.capabilities.getMaxAnisotropy();return texture}
function makeGrass(){const n=128;const positions=[],colors=[],indices=[];const center=new THREE.Color(0x749b45),edge=new THREE.Color(0x6d8c3c);positions.push(0,.08,0);colors.push(center.r,center.g,center.b);for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;const rr=1+Math.sin(a*7)*.025+Math.cos(a*13)*.017+Math.sin(a*31)*.007;const x=Math.cos(a)*50*rr,z=Math.sin(a)*41*rr;positions.push(x,.07,z);const color=edge.clone().lerp(new THREE.Color(0x8da84b),(.5+.5*Math.cos(a*9))*.25);colors.push(color.r,color.g,color.b);if(i<n)indices.push(0,i+1,i+2)}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();airfield.add(new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide})));const border=new THREE.Mesh(new THREE.TorusGeometry(1,.011,5,125),new THREE.MeshBasicMaterial({color:0xdbad75,transparent:true,opacity:.5}));border.rotation.x=Math.PI/2;border.scale.set(50,41,1);border.position.y=.08;airfield.add(border);
  for(let i=0;i<140;i++){const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*.94;const x=Math.cos(a)*48*r,z=Math.sin(a)*39*r;if(Math.abs(x)<35&&Math.abs(z)<32)continue;const g=partBox(airfield,i%3?0x7da04a:0x638743,x,.16,z,rand(.2,.7),.13,rand(.35,1.25),rand(-3,3));g.rotation.z=rand(-.12,.12)}}
function airportStructures(){
  // 1950s control tower, beacon and hangars.
  const tower=new THREE.Group();tower.position.set(48,0,12);airfield.add(tower);partBox(tower,palette.tower,0,4.0,0,5,8,5);partBox(tower,palette.dark,0,8.8,0,8,2.9,8);for(const side of [-1,1]){partBox(tower,palette.glass,side*3.91,8.9,0,.09,2.0,6.8);partBox(tower,palette.glass,0,8.9,side*3.91,6.8,2.0,.09)}partBox(tower,palette.roof,0,10.55,0,8.5,.6,8.5);cyl(tower,palette.dark2,0,11.7,0,.11,.11,2.1);partSphere(tower,0xf9e6a4,0,12.9,0,.65,.3,.65);
  for(const [x,z] of [[51,-19],[-52,5]]){const hangar=new THREE.Group();hangar.position.set(x,0,z);hangar.rotation.y=x>0?-.18:.42;airfield.add(hangar);partBox(hangar,palette.tower,0,2.3,0,12,4.6,8);partBox(hangar,0x895343,0,5.05,0,13,1.2,9);for(let i=-2;i<=2;i++)partBox(hangar,palette.dark2,i*2.1,1.7,4.04,1.75,3.1,.1);for(let i=0;i<5;i++)partBox(hangar,palette.silver,-4.8+i*2.4,4.25,-4,.13,.16,7.8)}
  for(const [x,z] of [[-53,-28],[49,38],[56,0],[-45,39]]){const group=new THREE.Group();group.position.set(x,0,z);airfield.add(group);cyl(group,0x8c6c4b,0,1.35,0,.65,.75,2.7);const leaves=new THREE.Mesh(new THREE.ConeGeometry(3.0,5,7),mat(0x6c823c));leaves.position.y=4.6;group.add(leaves)}
  for(let i=0;i<28;i++){const x=rand(-82,82),z=rand(-65,65);if(x*x/3000+z*z/1950<1.25)continue;const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(rand(.45,1.8),0),mat(pick([0xb0714d,0x9e6048,0xdb9665])));rock.position.set(x,.35,z);rock.scale.set(rand(.8,2),rand(.35,.7),rand(.7,1.7));rock.rotation.y=rand(0,3);airfield.add(rock)}
  const road=new THREE.Mesh(new THREE.PlaneGeometry(26,5),mat(0xc8a078));road.rotation.x=-Math.PI/2;road.rotation.z=-.12;road.position.set(48,.12,-4);airfield.add(road);
  // Weather sock, with a simple animated tail.
  const sock=new THREE.Group();sock.position.set(-44,0,-14);airfield.add(sock);cyl(sock,palette.silver,0,4,0,.13,.14,8);const pivot=new THREE.Group();pivot.position.y=7.65;sock.add(pivot);const sockPart=new THREE.Mesh(new THREE.ConeGeometry(.7,3.8,9,1,true),new THREE.MeshBasicMaterial({color:0xe4ead4,side:THREE.DoubleSide}));sockPart.rotation.z=-Math.PI/2;sockPart.position.set(1.7,0,0);pivot.add(sockPart);const stripe=new THREE.Mesh(new THREE.CylinderGeometry(.48,.68,.9,9,1,true),new THREE.MeshBasicMaterial({color:0xc94b37,side:THREE.DoubleSide}));stripe.rotation.z=Math.PI/2;stripe.position.x=1.0;pivot.add(stripe);game.sock=pivot;
  const radar=new THREE.Group();radar.position.set(-46,0,20);airfield.add(radar);cyl(radar,palette.dark2,0,3.1,0,.25,.35,6.2);const radarSpin=new THREE.Group();radarSpin.position.y=6.5;radar.add(radarSpin);partBox(radarSpin,palette.silver,0,0,0,5,.4,1.2);partBox(radarSpin,palette.dark2,0,.4,0,5,.8,.15);game.radar=radarSpin;
  groundText('ARGON  ·  1958',4,-39,22,4.8,'#e9d3a2');
  groundText('N ↑',-61,46,8,7,'#f9dfac');
}

function runway(id,type,x,z,length,width,angle,label){const color=COLORS[type];const group=new THREE.Group();group.position.set(x,0,z);group.rotation.y=angle;airfield.add(group);partBox(group,0x373d3c,0,.28,0,width,.32,length);for(const side of [-1,1]){partBox(group,color,side*(width/2+.22),.51,0,.28,.10,length+1.7);for(let p=-length/2+2;p<length/2-1;p+=5.3){partSphere(group,0xffe9a9,side*(width/2+.45),.55,p,.24,.18,.24)}}
  for(let z0=-length/2+3;z0<length/2-3;z0+=6.8)partBox(group,0xf0e2bd,0,.49,z0,.42,.07,3.3);
  for(const ez of [-1,1])for(let i=-2;i<=2;i++)partBox(group,0xf8ebd1,i*(width*.15),.5,ez*(length/2-1.7),width*.08,.06,1.65);
  partBox(group,color,0,.52,length/2-3,width*.55,.07,.28);
  const chevron=new THREE.Mesh(new THREE.ConeGeometry(1.8,3.5,3),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));chevron.rotation.x=-Math.PI/2;chevron.position.set(0,.55,length/2+3);group.add(chevron);
  const tag=groundText(label,x,z,Math.min(length*.50,24),Math.max(3.7,width*.65),'#fff3d1');tag.rotation.z=angle;
  const approach=group.localToWorld(v3(0,3,length/2+10));const touchdown=group.localToWorld(v3(0,3,-length*.20));const position=group.localToWorld(v3(0,0,0));
  const halo=new THREE.Mesh(new THREE.RingGeometry(width/2+1,width/2+2,50),new THREE.MeshBasicMaterial({color,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));halo.rotation.x=-Math.PI/2;halo.position.set(x,.46,z);halo.scale.set(1,length/(width+4),1);airfield.add(halo);
  destinations.push({id,type,kind:'runway',label,position,approach,touchdown,length,width,halo,group});
}
function helipad(id,x,z){const group=new THREE.Group();group.position.set(x,0,z);airfield.add(group);const pad=new THREE.Mesh(new THREE.CylinderGeometry(7.1,7.4,.33,48),mat(0x45534c));pad.position.y=.29;group.add(pad);const ring=new THREE.Mesh(new THREE.RingGeometry(5.7,6.0,48),new THREE.MeshBasicMaterial({color:0x9ddd82,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.51;group.add(ring);for(let i=0;i<12;i++){const a=i/12*Math.PI*2;partSphere(group,0xfff1b4,Math.cos(a)*6.5,.58,Math.sin(a)*6.5,.27,.18,.27)}const h=new THREE.Mesh(new THREE.PlaneGeometry(7,7),new THREE.MeshBasicMaterial({map:textCanvas('H','transparent','#e1f5d0',196),transparent:true,depthWrite:false}));h.rotation.x=-Math.PI/2;h.position.y=.54;group.add(h);const halo=new THREE.Mesh(new THREE.RingGeometry(7.6,8.8,64),new THREE.MeshBasicMaterial({color:COLORS.heli,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));halo.rotation.x=-Math.PI/2;halo.position.set(x,.6,z);airfield.add(halo);destinations.push({id,type:'heli',kind:'helipad',label:'H',position:v3(x,0,z),touchdown:v3(x,3,z),length:0,width:13,halo,group})}
function buildWorld(){const desert=new THREE.Mesh(new THREE.PlaneGeometry(900,900),new THREE.MeshStandardMaterial({map:desertTexture(),roughness:1}));desert.rotation.x=-Math.PI/2;desert.position.y=-.4;airfield.add(desert);makeGrass();airportStructures();runway('r1','jet',-17,-11,52,8,-.31,'01  RED');runway('r2','biplane',22,-13,39,6,.37,'03  BLUE');runway('r3','prop',-5,25,32,6,Math.PI/2,'02  GOLD');helipad('h1',32,26);helipad('h2',-35,22)}
buildWorld();

function makePlaneModel(type){const root=new THREE.Group();const body=new THREE.Group();root.add(body);const color=mat(COLORS[type],{metalness:.12});const pale=palette.cream,metal=palette.silver;let spin=[];
  if(type==='jet'){
    const fuse=cyl(body,color,0,.15,0,.60,.71,7.5,Math.PI/2);fuse.rotation.y=0;
    const nose=new THREE.Mesh(new THREE.ConeGeometry(.61,1.55,12),color);nose.rotation.x=-Math.PI/2;nose.position.set(0,.15,-4.45);body.add(nose);
    partBox(body,color,0,.16,.2,9,.16,1.25,-.055);partBox(body,color,-3.9,.1,1.0,2.3,.12,1.2,-.17);partBox(body,color,3.9,.1,1.0,2.3,.12,1.2,.17);
    partBox(body,color,0,.1,3.1,3.5,.16,1.05);partBox(body,pale,0,.65,3.4,.16,1.35,.92);
    for(const side of [-1,1]){const engine=cyl(body,metal,side*2.6,-.35,.25,.38,.42,2.4,Math.PI/2);engine.rotation.z=0;partSphere(body,palette.dark2,side*2.6,-.36,-1.0,.37,.34,.17)}
    partBox(body,palette.glass,0,.72,-2.72,.75,.22,1.5);for(let i=0;i<7;i++){partBox(body,0xf4e1b3,-.65,.42,-2+i*.7,.08,.12,.2);partBox(body,0xf4e1b3,.65,.42,-2+i*.7,.08,.12,.2)}
  }else if(type==='prop'){
    cyl(body,color,0,.15,0,.53,.58,6.1,Math.PI/2);partSphere(body,color,0,.1,-3.12,.52,.53,.78);partBox(body,color,0,.19,-.4,8.3,.17,1.15);partBox(body,color,0,.2,2.55,3.3,.15,.94);partBox(body,color,0,.6,2.7,.16,1.0,1.1);partBox(body,palette.glass,0,.68,-1.4,.8,.3,1.45);
    for(const s of [-1,1]){partSphere(body,metal,s*2.8,.11,-.4,.58,.52,1.3);const rotor=new THREE.Group();rotor.position.set(s*2.8,.10,-1.8);partBox(rotor,palette.dark2,0,0,0,.23,3.25,.15);partBox(rotor,palette.cream,0,1.2,0,.24,.48,.16);partBox(rotor,palette.cream,0,-1.2,0,.24,.48,.16);body.add(rotor);spin.push(rotor)}
  }else if(type==='biplane'){
    cyl(body,color,0,.08,0,.45,.47,5.2,Math.PI/2);partSphere(body,color,0,.07,-2.6,.46,.44,.7);partBox(body,color,0,.19,-.25,7.3,.22,1.18);partBox(body,pale,0,1.14,-.35,7.0,.21,1.14);for(const s of [-1,1])for(const z of [-.8,.1])partBox(body,metal,s*2.4,.67,z,.10,1.0,.10);partBox(body,color,0,.12,2.1,2.9,.14,.85);partBox(body,color,0,.63,2.4,.12,1.2,.9);partBox(body,palette.glass,0,.58,-1,.7,.28,.9);const rotor=new THREE.Group();rotor.position.set(0,.1,-3.25);partBox(rotor,palette.dark2,0,0,0,.21,3.1,.15);body.add(rotor);spin.push(rotor);
  }else{
    partSphere(body,color,0,.45,0,1.12,.84,2.5);partSphere(body,palette.glass,0,.68,-1.25,.9,.56,1.05);partBox(body,color,0,.23,2.6,.42,.4,4.1);partBox(body,color,0,.34,4.3,2.2,.22,.56);partBox(body,palette.dark2,0,1.41,0,.27,.8,.25);const rotor=new THREE.Group();rotor.position.set(0,1.9,0);partBox(rotor,palette.dark2,0,0,0,9.1,.12,.24);partBox(rotor,palette.dark2,0,0,0,.24,.12,9.1);body.add(rotor);spin.push(rotor);for(const side of [-1,1]){partBox(body,metal,side*1.25,-.56,.3,.14,.18,4.2);partBox(body,metal,side*1.25,-.2,-.9,.1,.7,.1);partBox(body,metal,side*1.25,-.2,1.5,.1,.7,.1)}
    const tail=new THREE.Group();tail.position.set(0,.35,4.4);partBox(tail,palette.dark2,0,0,0,1.2,.15,.15);body.add(tail);spin.push(tail)
  }
  const halo=new THREE.Mesh(new THREE.RingGeometry(type==='jet'?4.7:3.8,type==='jet'?5.0:4.1,50),new THREE.MeshBasicMaterial({color:0xffa54f,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));halo.rotation.x=-Math.PI/2;halo.position.y=-1.9;root.add(halo);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(type==='jet'?4.8:3.6,28),new THREE.MeshBasicMaterial({color:0x342e25,transparent:true,opacity:.18,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-2.8;shadow.scale.y=.78;root.add(shadow);
  return {root,body,spin,halo,shadow};
}

function worldToScreen(pos){const p=pos.clone().project(camera);return{x:(p.x+1)*.5*innerWidth,y:(1-p.y)*.5*innerHeight,ndcX:p.x,ndcY:p.y}}
function screenToWorld(x,y,height=0){ndc.set(x/innerWidth*2-1,-y/innerHeight*2+1);raycaster.setFromCamera(ndc,camera);const p=v3(0,0,0);if(raycaster.ray.intersectPlane(worldPlane,p))return p.setY(height);return v3(0,height,0)}
function safeRect(){const w=innerWidth,h=innerHeight;return {l:Math.max(34,w*.057),r:w-Math.max(34,w*.057),t:Math.min(132,Math.max(95,h*.14)),b:h-Math.min(132,Math.max(100,h*.14))}}
function layoutLearningHUD(){
  // WKWebView safe-area insets can raise the score/control strip by far more
  // than a normal mobile browser. Measure its actual top edge instead of
  // relying on a fixed CSS bottom offset for the word/translation panel.
  const controls=document.querySelector('.bottom'),ribbon=$('lessonRibbon'),hint=$('instruction');
  if(!controls||!ribbon)return;
  const bottomOfControls=Math.max(0,innerHeight-controls.getBoundingClientRect().top);
  const ribbonBottom=Math.ceil(bottomOfControls+12);
  ribbon.style.bottom=`${ribbonBottom}px`;
  if(hint)hint.style.bottom=`${Math.ceil(ribbonBottom+ribbon.getBoundingClientRect().height+11)}px`;
}
function resize(){const w=innerWidth,h=innerHeight,aspect=w/Math.max(1,h);const worldWidth=Math.max(106,aspect*105);const worldHeight=worldWidth/aspect;camera.left=-worldWidth/2;camera.right=worldWidth/2;camera.top=worldHeight/2;camera.bottom=-worldHeight/2;camera.updateProjectionMatrix();camera.updateMatrixWorld();renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(w,h);fallbackBackground=null;layoutLearningHUD()}
addEventListener('resize',resize,{passive:true});
if(window.visualViewport)window.visualViewport.addEventListener('resize',layoutLearningHUD,{passive:true});
if('ResizeObserver'in window)new ResizeObserver(layoutLearningHUD).observe(document.querySelector('.bottom'));
resize();

function makeAircraft(type,position,direction){const data=makePlaneModel(type),id=game.nextId++,code=TYPES[type].prefix+'-'+String(100+id).slice(-3);const heading=Math.atan2(-direction.x,-direction.z);
  const label=document.createElement('div');label.className='plane-label';label.innerHTML=`<em style="background:${CSS_COLORS[type]}"></em><b>${code}</b>`;document.body.appendChild(label);
  data.root.position.set(position.x,3.2,position.z);data.root.rotation.y=heading;aircraftGroup.add(data.root);
  const plane={id,code,type,position:position.clone().setY(3.2),heading,velocity:direction.clone().normalize(),speed:TYPES[type].speed,route:null,model:data,label,history:[],trailTime:0,warning:false,age:0,engine:null};activePlanes.push(plane);learning.assignPlane(plane);plane.engine=audio.addEngine(plane);return plane;
}
function spawnAircraft(forceType){if(activePlanes.length>=Math.min(9,4+Math.floor(game.landed/6)))return false;const rect=safeRect();let type=forceType||pick(Object.keys(TYPES));let position,direction,valid=false;
  for(let tries=0;tries<22;tries++){const side=(Math.random()*4)|0;let x,y;const pad=28;const unobstructedTop=Math.min(rect.b-40,rect.t+135);const topLeftClear=Math.max(rect.l+pad,Math.min(innerWidth*.48,215));
    if(side===0){x=rand(topLeftClear,rect.r-pad);y=rect.t}
    else if(side===1){x=rect.r;y=rand(unobstructedTop,rect.b-pad)}
    else if(side===2){x=rand(rect.l+pad,rect.r-pad);y=rect.b}
    else{x=rect.l;y=rand(unobstructedTop,rect.b-pad)}
    position=screenToWorld(x,y,3.2);const target=v3(rand(-22,22),3.2,rand(-22,22));direction=target.sub(position).normalize();if(activePlanes.every(p=>p.position.distanceTo(position)>24)&&destinations.every(d=>d.position.distanceTo(position)>9)){valid=true;break}}
  if(!valid)return false;const plane=makeAircraft(type,position,direction);if(activePlanes.length===1&&game.landed===0)showToast('INBOUND TRAFFIC · DRAW A FLIGHT PATH');return plane;
}

function disposeRoute(plane){if(!plane.route)return;effectGroup.remove(plane.route.mesh);plane.route.mesh.geometry.dispose();plane.route.mesh.material.dispose();plane.route=null}
function buildPathMesh(points,color,opacity=.85,radius=.23){const curve=new THREE.CatmullRomCurve3(points,false,'centripetal',.46);const tube=new THREE.TubeGeometry(curve,Math.max(16,Math.min(260,points.length*7)),radius,5,false);const mesh=new THREE.Mesh(tube,new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide}));effectGroup.add(mesh);return mesh}
function assignRoute(plane,drag,dest){disposeRoute(plane);
  // Planes keep moving while a controller is drawing. Start from the nearest
  // forward segment of the gesture, not its now-obsolete pointer-down point.
  const drawn=drag.points.map(p=>p.clone().setY(3.2));let nearest=-1,nearestDist=Infinity;
  for(let i=0;i<drawn.length;i++){const dist=drawn[i].distanceTo(plane.position);if(dist<nearestDist){nearestDist=dist;nearest=i}}
  let points=[plane.position.clone()];for(const q of drawn.slice(Math.max(0,nearest+1))){if(q.distanceTo(points[points.length-1])>2.8)points.push(q)}
  if(dest.kind==='runway'){
    // Honor the pilot's drawn approach. A forced threshold from the far side
    // can turn a perfectly good line into an unwanted 180-degree loop.
    while(points.length>1&&points[points.length-1].distanceTo(dest.position)<7.5)points.pop();
    points.push(dest.position.clone().setY(3.2),dest.touchdown.clone().setY(3.2));
  }else{while(points.length>1&&points[points.length-1].distanceTo(dest.position)<8)points.pop();points.push(dest.touchdown.clone().setY(3.2))}
  if(points.length<2)points=[plane.position.clone(),dest.touchdown.clone().setY(3.2)];
  const curve=new THREE.CatmullRomCurve3(points,false,'centripetal',.45),length=curve.getLength();
  if(length<4)return;
  const pathPoints=curve.getPoints(Math.max(28,Math.min(220,Math.ceil(length*1.2)))).map(v=>v3(v.x,.63,v.z));const mesh=buildPathMesh(pathPoints,COLORS[plane.type],.82,.19);
  plane.route={dest,curve,length,distance:0,mesh};
  if(game.landed===0&&activePlanes.length===1)game.spawnTimer=Math.max(game.spawnTimer,18);
  playBeep(typeFrequency(plane.type),.09,.035);showToast(`${plane.code}  ·  APPROACH CLEARED`);
}
function typeFrequency(type){return {jet:340,prop:550,biplane:660,heli:430}[type]}

function showToast(message,alert=false,duration=2.6){const toast=$('toast');toast.textContent=message;toast.classList.toggle('alert',alert);toast.classList.add('show');game.toastUntil=performance.now()/1000+duration}
function clearToast(){if(performance.now()/1000>game.toastUntil)$('toast').classList.remove('show')}
function findDestination(x,y,onlyMatching=false,type=''){let best=null,bestDist=Infinity;for(const dest of destinations){if(onlyMatching&&dest.type!==type)continue;const p=worldToScreen(dest.position);const dist=Math.hypot(p.x-x,p.y-y);const threshold=dest.kind==='helipad'?Math.max(39,innerWidth*.045):Math.max(48,innerWidth*.05);if(dist<threshold&&dist<bestDist){best=dest;bestDist=dist}}return best}
function findPlane(x,y){let best=null,bestDist=Infinity;for(const plane of activePlanes){const p=worldToScreen(plane.position);const dist=Math.hypot(p.x-x,p.y-y);if(dist<Math.max(37,Math.min(54,innerWidth*.065))&&dist<bestDist){best=plane;bestDist=dist}}return best}
function updatePreview(drag){if(drag.preview){effectGroup.remove(drag.preview);drag.preview.geometry.dispose();drag.preview.material.dispose();drag.preview=null}const points=[drag.plane.position.clone(),...drag.points.map(v=>v.clone().setY(3.2))];if(drag.snapped){points.push(drag.snapped.touchdown.clone().setY(3.2))}if(points.length<2||points[0].distanceTo(points[points.length-1])<.6)return;const curve=new THREE.CatmullRomCurve3(points,false,'centripetal',.5);const samples=curve.getPoints(Math.max(12,Math.min(100,points.length*4))).map(p=>v3(p.x,.89,p.z));drag.preview=buildPathMesh(samples,drag.snapped?COLORS[drag.plane.type]:0xfceac8,.94,drag.snapped?.35:.20)}
function updateDestGlows(){for(const d of destinations)d.halo.material.opacity=0;for(const drag of drags.values())if(drag.snapped)drag.snapped.halo.material.opacity=.66}
function pointerDown(e){if(game.mode!=='playing')return;const target=findPlane(e.clientX,e.clientY);if(!target||[...drags.values()].some(d=>d.plane===target))return;e.preventDefault();try{$('scene').setPointerCapture(e.pointerId)}catch{}const drag={plane:target,points:[],snapped:null,preview:null,lastX:e.clientX,lastY:e.clientY};drags.set(e.pointerId,drag);target.model.halo.material.opacity=.6;playBeep(typeFrequency(target.type),.05,.02);}
function pointerMove(e){const drag=drags.get(e.pointerId);if(!drag)return;e.preventDefault();const delta=Math.hypot(e.clientX-drag.lastX,e.clientY-drag.lastY);if(delta<4)return;drag.lastX=e.clientX;drag.lastY=e.clientY;const point=screenToWorld(e.clientX,e.clientY,3.2);if(drag.points.length===0||point.distanceTo(drag.points[drag.points.length-1])>1.2){drag.points.push(point);if(drag.points.length>90)drag.points.splice(0,drag.points.length-90)}const nearest=findDestination(e.clientX,e.clientY,false,drag.plane.type);drag.snapped=nearest&&nearest.type===drag.plane.type?nearest:null;updatePreview(drag);updateDestGlows()}
function endDrag(e,cancel=false){const drag=drags.get(e.pointerId);if(!drag)return;e.preventDefault();drags.delete(e.pointerId);if(drag.preview){effectGroup.remove(drag.preview);drag.preview.geometry.dispose();drag.preview.material.dispose()}drag.plane.model.halo.material.opacity=0;const near=findDestination(e.clientX,e.clientY,false,drag.plane.type);if(!cancel&&near&&near.type===drag.plane.type&&drag.points.length){assignRoute(drag.plane,drag,near)}else if(!cancel&&drag.points.length){if(near)showToast('WRONG FREQUENCY · MATCH YOUR AIRCRAFT COLOR',true);else showToast('CONTINUE YOUR PATH TO A RUNWAY OR HELIPAD',true)}updateDestGlows()}
$('scene').addEventListener('pointerdown',pointerDown);
$('scene').addEventListener('pointermove',pointerMove);
$('scene').addEventListener('pointerup',(e)=>endDrag(e));
$('scene').addEventListener('pointercancel',(e)=>endDrag(e,true));
$('scene').addEventListener('lostpointercapture',(e)=>{if(drags.has(e.pointerId))endDrag(e,true)});
$('scene').addEventListener('contextmenu',e=>e.preventDefault());

function particle(position,color,count=9){for(let i=0;i<count;i++){const mesh=new THREE.Mesh(new THREE.SphereGeometry(rand(.25,.8),6,4),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.6,depthWrite:false}));mesh.position.copy(position).setY(rand(.5,2));effectGroup.add(mesh);effects.push({mesh,v:v3(rand(-3,3),rand(1,4),rand(-3,3)),age:0,life:rand(.7,1.7),kind:'particle'})}}
function expandingRing(position,color){const mesh=new THREE.Mesh(new THREE.RingGeometry(3,3.5,45),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.85,depthWrite:false,side:THREE.DoubleSide}));mesh.rotation.x=-Math.PI/2;mesh.position.copy(position).setY(.7);effectGroup.add(mesh);effects.push({mesh,age:0,life:1.2,kind:'ring'})}
function trail(plane){const mesh=new THREE.Mesh(new THREE.SphereGeometry(.32,5,4),new THREE.MeshBasicMaterial({color:COLORS[plane.type],transparent:true,opacity:.35,depthWrite:false}));mesh.position.copy(plane.position).setY(1.65);effectGroup.add(mesh);effects.push({mesh,age:0,life:2.0,kind:'trail'})}

function landPlane(plane){game.landed++;game.landingsSinceCallout++;$('landed').textContent=String(game.landed).padStart(2,'0');if(game.landed>game.high){game.high=game.landed;saveHigh();$('high').textContent=String(game.high).padStart(2,'0')}expandingRing(plane.position,0xacf7a1);particle(plane.position,0xe9d3a7,10);playLandingChord();audio.paChime();learning.onLanding(plane);showToast(`${plane.code} · SAFE LANDING +1 · WORD COLLECTED`);removePlane(plane);updateStats()}
function removePlane(plane){disposeRoute(plane);aircraftGroup.remove(plane.model.root);learning.removePlane(plane);plane.label.remove();audio.removeEngine(plane.engine);const idx=activePlanes.indexOf(plane);if(idx>=0)activePlanes.splice(idx,1);for(const [key,drag] of drags)if(drag.plane===plane){if(drag.preview){effectGroup.remove(drag.preview);drag.preview.geometry.dispose();drag.preview.material.dispose()}drags.delete(key)}}
function updateStats(){$('inbound').textContent=String(activePlanes.length).padStart(2,'0')}

function gameOver(reason){if(game.mode!=='playing')return;game.mode='gameover';learning.pause();audio.stopEngines();audio.announce('Attention all aircraft. The airfield is now closed.');playCrash();$('finalScore').textContent=game.landed;$('finalHigh').textContent=game.high;$('endReason').textContent=reason;$('recordText').textContent=game.landed===game.high&&game.landed>0?'★ NEW CAREER RECORD ★':game.landed>=10?'A FINE SHIFT IN THE TOWER.':'EVERY GREAT CONTROLLER LEARNS FROM THE SKY.';$('gameoverOverlay').hidden=false;$('pauseOverlay').hidden=true;$('status').textContent='AIRSPACE CLOSED';}
function resetGame(){for(const p of [...activePlanes])removePlane(p);for(const drag of drags.values())if(drag.preview){effectGroup.remove(drag.preview);drag.preview.geometry.dispose();drag.preview.material.dispose()}drags.clear();for(const e of effects){effectGroup.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose()}effects.length=0;learning.reset();game.mode='playing';game.time=0;game.landed=0;game.speed=1;game.spawnTimer=12.5;game.firstSpawn=true;game.windKts=8;game.windAngle=Math.PI*1.4;game.windChange=25;game.warningCooldown=0;game.landingsSinceCallout=0;$('landed').textContent='00';$('inbound').textContent='00';$('status').textContent='ALL SECTORS CLEAR';$('speedBtn').querySelector('b').textContent='×1';$('speedBtn').classList.remove('active');$('speedBtn').setAttribute('aria-pressed','false');$('startOverlay').hidden=true;$('gameoverOverlay').hidden=true;$('pauseOverlay').hidden=true;$('instruction').style.display='block';game.tutorialUntil=performance.now()/1000+22;audio.start();spawnAircraft('biplane');audio.announce('Good morning, Argon tower. Your shift begins. Good luck, controller.');updateStats()}
function togglePause(force){if(game.mode==='ready'||game.mode==='gameover')return;const pause=typeof force==='boolean'?force:game.mode==='playing';game.mode=pause?'paused':'playing';$('pauseOverlay').hidden=!pause;if(pause){audio.suspendEngines();learning.pause()}else{audio.resumeEngines();learning.resume()}$('pauseBtn').querySelector('b').textContent=pause?'▶':'Ⅱ';}
$('startBtn').addEventListener('click',resetGame);$('restartBtn').addEventListener('click',resetGame);$('pauseBtn').addEventListener('click',()=>togglePause());$('resumeBtn').addEventListener('click',()=>togglePause(false));
$('speedBtn').addEventListener('click',()=>{game.speed=game.speed===1?2:1;const active=game.speed===2;$('speedBtn').classList.toggle('active',active);$('speedBtn').setAttribute('aria-pressed',String(active));$('speedBtn').querySelector('b').textContent=active?'×2':'×1';playBeep(490,.08,.05)});
$('musicBtn').addEventListener('click',()=>{audio.toggleMusic();const on=audio.musicEnabled;$('musicBtn').classList.toggle('active',on);$('musicBtn').setAttribute('aria-pressed',String(on));});
$('voiceBtn').addEventListener('click',()=>{audio.voiceEnabled=!audio.voiceEnabled;const on=audio.voiceEnabled;$('voiceBtn').classList.toggle('active',on);$('voiceBtn').setAttribute('aria-pressed',String(on));if(!on&&'speechSynthesis'in window)speechSynthesis.cancel();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.mode==='playing')togglePause(true)});
document.addEventListener('keydown',e=>{if(!$('lessonOverlay').hidden)return;if(e.code==='Escape'&&game.mode!=='ready'&&game.mode!=='gameover')togglePause();if(e.code==='Space'&&game.mode==='playing'){e.preventDefault();$('speedBtn').click()}});

// Original, lightweight big-band-inspired swing arrangement using Web Audio.
// All tones are synthesized at runtime; no audio downloads or licensed tracks.
const audio={
  ctx:null,master:null,musicGain:null,fxGain:null,engineGain:null,musicEnabled:true,voiceEnabled:true,step:0,nextStepTime:0,timer:null,noise:null,engines:new Set(),
  init(){if(this.ctx)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;try{this.ctx=new AC();const ctx=this.ctx;
      this.master=ctx.createGain();this.master.gain.value=.6;this.master.connect(ctx.destination);
      this.musicGain=ctx.createGain();this.musicGain.gain.value=this.musicEnabled ? 0.21 : 0;this.musicGain.connect(this.master);
      this.fxGain=ctx.createGain();this.fxGain.gain.value=.65;this.fxGain.connect(this.master);
      this.engineGain=ctx.createGain();this.engineGain.gain.value=.6;this.engineGain.connect(this.master);
      this.noise=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const channel=this.noise.getChannelData(0);for(let i=0;i<channel.length;i++)channel[i]=Math.random()*2-1;
      const wind=ctx.createBufferSource();wind.buffer=this.noise;wind.loop=true;const windFilter=ctx.createBiquadFilter();windFilter.type='lowpass';windFilter.frequency.value=175;const windGain=ctx.createGain();windGain.gain.value=.035;wind.connect(windFilter).connect(windGain).connect(this.fxGain);wind.start();
      if(ctx.listener.positionX){ctx.listener.positionX.value=0;ctx.listener.positionY.value=0;ctx.listener.positionZ.value=8}
    }catch(e){console.warn('Sound unavailable',e);this.ctx=null}},
  start(){this.init();if(!this.ctx)return;this.ctx.resume().catch(()=>{});this.step=0;this.nextStepTime=this.ctx.currentTime+.15;if(!this.timer)this.timer=setInterval(()=>this.schedule(),115);this.engineGain.gain.setTargetAtTime(.6,this.ctx.currentTime,.05)},
  schedule(){if(!this.ctx||this.ctx.state!=='running')return;if(game.mode==='paused'||game.mode==='gameover'||game.mode==='ready'){this.nextStepTime=this.ctx.currentTime+.15;return}while(this.nextStepTime<this.ctx.currentTime+.28){const q=.60/132*1.0;this.scheduleStep(this.step,this.nextStepTime,q);this.nextStepTime+=this.step%2===0?q*.65:q*.35;this.step=(this.step+1)%128}},
  hz(midi){return 440*Math.pow(2,(midi-69)/12)},
  note(midi,when,duration,voice='bass',gain=.16){if(!this.ctx)return;const ctx=this.ctx,osc=ctx.createOscillator(),env=ctx.createGain(),filter=ctx.createBiquadFilter();osc.type=voice==='brass'?'sawtooth':voice==='bass'?'triangle':'sine';osc.frequency.setValueAtTime(this.hz(midi),when);if(voice==='brass'){osc.detune.value=rand(-7,7);filter.type='lowpass';filter.frequency.setValueAtTime(1050,when);filter.frequency.exponentialRampToValueAtTime(440,when+duration*.92)}else{filter.type='lowpass';filter.frequency.value=voice==='bass'?600:1600}
    env.gain.setValueAtTime(.0001,when);env.gain.exponentialRampToValueAtTime(Math.max(.001,gain),when+.018);env.gain.exponentialRampToValueAtTime(.0001,when+Math.max(.08,duration));osc.connect(filter).connect(env).connect(this.musicGain);osc.start(when);osc.stop(when+Math.max(.08,duration)+.02)},
  percussion(when,type='brush',amount=.08){if(!this.ctx||!this.noise)return;const ctx=this.ctx,src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),env=ctx.createGain();src.buffer=this.noise;filter.type=type==='kick'?'lowpass':'highpass';filter.frequency.value=type==='kick'?160:type==='snare'?1200:6500;env.gain.setValueAtTime(.0001,when);env.gain.exponentialRampToValueAtTime(amount,when+.006);env.gain.exponentialRampToValueAtTime(.0001,when+(type==='snare'?.12:.055));src.connect(filter).connect(env).connect(this.musicGain);src.start(when);src.stop(when+.18)},
  scheduleStep(step,t,q){const s=step%64,bar=(s/8)|0,beat=(s%8/2)|0,even=s%2===0;const roots=[48,45,53,55,48,57,50,55],root=roots[bar];
    this.percussion(t,even?'brush':'brush',even?.028:.05);if(even){this.note(root+[0,7,12,7][beat],t,q*.54,'bass',.13);if(beat===0||beat===2)this.percussion(t,'kick',.07);if(beat===1||beat===3)this.percussion(t,'snare',.053)}
    if(!even&&(beat===1||beat===3)){for(const interval of [0,4,7])this.note(root+12+interval,t,q*.27,'brass',.013)}
    const melody=[64,null,67,69,72,null,69,67,65,null,69,72,74,null,72,69,67,null,69,72,76,74,72,null,69,null,67,64,67,null,64,null,64,null,67,69,72,74,76,null,77,null,76,72,74,null,72,69,67,69,72,null,74,72,69,null,67,null,64,67,60,null,64,null];
    const m=melody[s];if(m!==null&&step%128<64)this.note(m,t,q*(even?.93:.61),'brass',.035);
  },
  toggleMusic(){this.musicEnabled=!this.musicEnabled;if(!this.ctx){this.init();this.ctx?.resume().catch(()=>{})}if(this.musicGain)this.musicGain.gain.setTargetAtTime(this.musicEnabled ? 0.21 : 0,this.ctx.currentTime,.04)},
  addEngine(plane){if(!this.ctx)return null;const ctx=this.ctx,osc=ctx.createOscillator(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),panner=ctx.createPanner();osc.type=plane.type==='heli'?'sawtooth':'triangle';osc.frequency.value={jet:115,prop:96,biplane:85,heli:67}[plane.type];filter.type='lowpass';filter.frequency.value=plane.type==='jet'?300:230;gain.gain.value=.017;panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=4;panner.maxDistance=90;panner.rolloffFactor=.65;osc.connect(filter).connect(gain).connect(panner).connect(this.engineGain);osc.start();const engine={osc,gain,panner,type:plane.type};this.engines.add(engine);this.updateEngine(plane);return engine},
  updateEngine(plane){if(!this.ctx||!plane.engine)return;const engine=plane.engine,p=worldToScreen(plane.position),x=(p.x/innerWidth-.5)*14,z=-1.5+(p.y/innerHeight-.5)*5;try{engine.panner.positionX.setTargetAtTime(x,this.ctx.currentTime,.16);engine.panner.positionZ.setTargetAtTime(z,this.ctx.currentTime,.16);engine.osc.frequency.setTargetAtTime(({jet:115,prop:96,biplane:85,heli:67}[plane.type])*(1+.04*Math.sin(game.time*2+plane.id)),this.ctx.currentTime,.2)}catch{}},
  removeEngine(engine){if(!engine)return;try{engine.osc.stop();engine.osc.disconnect();engine.gain.disconnect();engine.panner.disconnect()}catch{}this.engines.delete(engine)},
  stopEngines(){if(this.ctx)this.engineGain.gain.setTargetAtTime(0,this.ctx.currentTime,.1)},
  suspendEngines(){if(this.ctx)this.engineGain.gain.setTargetAtTime(0,this.ctx.currentTime,.1)},
  resumeEngines(){if(this.ctx)this.engineGain.gain.setTargetAtTime(.6,this.ctx.currentTime,.1)},
  announce(message){if(!this.voiceEnabled)return;this.paChime();if(!('speechSynthesis'in window))return;setTimeout(()=>{if(!this.voiceEnabled||!audio.ctx)return;try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(message);const voices=speechSynthesis.getVoices();u.voice=voices.find(v=>v.lang.startsWith('en')&&/male|Daniel|Alex|David|Fred|Google UK English Male|Aaron/i.test(v.name))||voices.find(v=>v.lang.startsWith('en'))||null;u.lang='en-US';u.rate=.89;u.pitch=.74;u.volume=.72;speechSynthesis.speak(u)}catch{}},230)},
  paChime(){if(!this.ctx)return;this.ping(620,.09,.12,0);this.ping(790,.15,.11,.16)},
  ping(freq,dur,vol=.08,delay=0){if(!this.ctx)return;const ctx=this.ctx,at=ctx.currentTime+delay,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(vol,at+.012);gain.gain.exponentialRampToValueAtTime(.0001,at+dur);osc.connect(gain).connect(this.fxGain);osc.start(at);osc.stop(at+dur+.03)}
};
function playBeep(freq,dur=.08,vol=.08){audio.ping(freq,dur,vol)}
function playLandingChord(){audio.ping(523,.22,.14);audio.ping(659,.26,.13,.08);audio.ping(784,.32,.12,.16)}
function playCrash(){audio.ping(240,.38,.19);audio.ping(183,.5,.17,.20);audio.ping(116,.65,.16,.35)}

function angleDifference(to,from){let a=(to-from+Math.PI)%(2*Math.PI);if(a<0)a+=2*Math.PI;return a-Math.PI}
function changeWind(){game.windKts=Math.round(rand(4,14));game.windAngle=rand(0,Math.PI*2);game.windChange=rand(25,42);showToast(`WIND SHIFT · ${game.windKts} KNOTS`)}
function windDirection(){const directions=['N','NE','E','SE','S','SW','W','NW'];return directions[(Math.round((game.windAngle/(Math.PI*2))*8)+8)%8]}
function updateEffects(dt){for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.age+=dt;const f=clamp(e.age/e.life,0,1);if(e.kind==='particle'){e.mesh.position.addScaledVector(e.v,dt);e.mesh.material.opacity=(1-f)*.6;e.mesh.scale.setScalar(1+f*.5)}else if(e.kind==='trail'){e.mesh.material.opacity=(1-f)*.35;e.mesh.scale.setScalar(1+f*1.5)}else if(e.kind==='ring'){e.mesh.scale.setScalar(1+f*2.9);e.mesh.material.opacity=(1-f)*.85}if(f>=1){effectGroup.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();effects.splice(i,1)}}}

function movePlane(plane,dt){plane.age+=dt;const before=plane.heading;
  if(plane.route){const route=plane.route;route.distance=Math.min(route.length,route.distance+plane.speed*dt);const fraction=clamp(route.distance/route.length,0,1);plane.position.copy(route.curve.getPointAt(fraction));const tangent=route.curve.getTangentAt(Math.max(.002,Math.min(.998,fraction)));const targetAngle=Math.atan2(-tangent.x,-tangent.z);plane.heading+=angleDifference(targetAngle,plane.heading)*Math.min(1,dt*3.6);
    // Gentle, readable crosswind movement; aircraft continue along the drawn spline.
    const gust=Math.sin(game.time*1.1+plane.id*2)*game.windKts*.025;plane.position.x+=Math.cos(game.windAngle)*gust;plane.position.z+=Math.sin(game.windAngle)*gust;
    if(fraction>=1){landPlane(plane);return false}
  }else{plane.position.addScaledVector(plane.velocity,plane.speed*dt);plane.position.x+=Math.cos(game.windAngle)*game.windKts*.013*dt;plane.position.z+=Math.sin(game.windAngle)*game.windKts*.013*dt;plane.heading=Math.atan2(-plane.velocity.x,-plane.velocity.z)}
  plane.model.root.position.copy(plane.position);plane.model.root.rotation.y=plane.heading;const turn=angleDifference(plane.heading,before)/Math.max(.016,dt);plane.model.body.rotation.z=lerp(plane.model.body.rotation.z,clamp(-turn*.065,-.32,.32),Math.min(1,dt*4));plane.model.body.rotation.x=Math.sin(game.time*2.3+plane.id)*.012;
  for(const rotor of plane.model.spin){if(plane.type==='heli')rotor.rotation.y+=dt*23;else rotor.rotation.z+=dt*19}
  plane.trailTime+=dt;if(plane.trailTime>.38){plane.trailTime=0;trail(plane)}audio.updateEngine(plane);
  const p=worldToScreen(plane.position);plane.label.style.left=p.x+'px';plane.label.style.top=(p.y-11)+'px';plane.label.classList.toggle('warn',plane.warning);plane.label.style.display=p.x<-40||p.x>innerWidth+40||p.y<-40||p.y>innerHeight+40?'none':'block';
  const rect=safeRect();if(p.x<rect.l-24||p.x>rect.r+24||p.y<rect.t-22||p.y>rect.b+24){gameOver(`MISSED APPROACH · ${plane.code} LEFT CONTROLLED AIRSPACE`);return false}return true;
}
function proximityCheck(){let anyone=false;let collision=null;for(const p of activePlanes)p.warning=false;
  for(let i=0;i<activePlanes.length;i++){const a=activePlanes[i];for(let j=i+1;j<activePlanes.length;j++){const b=activePlanes[j];const distance=Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z);const collisionDistance=(TYPES[a.type].collision+TYPES[b.type].collision)*.56;if(distance<collisionDistance){collision={a,b};break}if(distance<collisionDistance+8){a.warning=b.warning=true;anyone=true}}if(collision)break}
  for(const p of activePlanes){p.model.halo.material.opacity=p.warning?.55+.25*Math.sin(game.time*12):([...drags.values()].some(d=>d.plane===p)?.63:0);p.model.halo.scale.setScalar(p.warning?1+.12*Math.sin(game.time*9):1)}
  if(collision){const at=collision.a.position.clone().add(collision.b.position).multiplyScalar(.5);particle(at,0xffb24b,26);expandingRing(at,0xff664f);gameOver(`MID-AIR COLLISION · ${collision.a.code} & ${collision.b.code}`);return}
  if(anyone&&game.warningCooldown<=0){game.warningCooldown=6;showToast('⚠ TCAS TRAFFIC ALERT · SEPARATE AIRCRAFT',true,2.1);playBeep(890,.26,.18);$('status').textContent='TCAS PROXIMITY ALERT'}else if(!anyone){$('status').textContent='ALL SECTORS CLEAR'}
}
function updateGame(dt){game.time+=dt;game.warningCooldown-=dt;game.windChange-=dt;if(game.windChange<=0)changeWind();game.spawnTimer-=dt;
  if(game.spawnTimer<=0){const maxConcurrent=Math.min(9,2+Math.floor(game.landed/3));if(activePlanes.length<maxConcurrent){if(spawnAircraft())updateStats();game.spawnTimer=Math.max(3.6,11.5-game.landed*.25)*rand(.84,1.17)}else game.spawnTimer=2.0}
  for(const plane of [...activePlanes]){if(!movePlane(plane,dt))break}if(game.mode!=='playing')return;proximityCheck();updateEffects(dt);
  $('wind').textContent=`${windDirection()} ${String(game.windKts).padStart(2,'0')}`;
  const minute=30+Math.floor(game.time/7),hour=8+Math.floor(minute/60);$('clock').textContent=`${String(hour%24).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
  if(performance.now()/1000>game.tutorialUntil)$('instruction').style.display='none';
}
function updateIdle(dt){if(game.sock){game.sock.rotation.y=-game.windAngle;game.sock.rotation.z=Math.sin(performance.now()*.003)*.11}if(game.radar)game.radar.rotation.y+=dt*.40;
  // Runway snap halos remain unobtrusive until the matching flight path is drawn.
  for(const d of destinations)if(d.halo.material.opacity>0)d.halo.material.opacity=.56+.18*Math.sin(performance.now()*.010);
}

// Browser compatibility renderer: same traffic simulation and path controls,
// drawn as a 1950s illustrated chart when the device blocks WebGL entirely.
const fallbackRocks=Array.from({length:92},(_,i)=>({x:Math.sin(i*10.37)*rand(48,105),z:Math.cos(i*7.91)*rand(39,85),r:rand(.5,2.6)}));
function fallbackBackdrop(){const w=innerWidth,h=innerHeight;const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');let grad=ctx.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#b87352');grad.addColorStop(.55,'#c58257');grad.addColorStop(1,'#a95e45');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
  let seed=18498;const r=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};for(let i=0;i<Math.round(w*h/400);i++){ctx.fillStyle=r()>.55?'#e6aa7355':'#804e3655';ctx.fillRect(r()*w,r()*h,1+r()*2,1+r()*3)}
  ctx.lineWidth=1.0;for(let i=0;i<Math.round(w*h/3000);i++){let x=r()*w,y=r()*h;ctx.strokeStyle=r()>.5?'rgba(106,59,43,.17)':'rgba(255,208,144,.12)';ctx.beginPath();ctx.moveTo(x,y);for(let j=0;j<4;j++){x+=(r()-.5)*32;y+=(r()-.5)*31;ctx.lineTo(x,y)}ctx.stroke()}
  return c;
}
function fallbackPolyline(ctx,points,stroke,width=1,dash=[]){if(points.length<2)return;ctx.save();ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);ctx.stroke();ctx.restore()}
function fallbackPolygon(ctx,points,fill,stroke=null,width=1){ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke()}}
function fieldPoint(x,z){return worldToScreen(v3(x,.5,z))}
function fallbackDrawField(ctx,unit){const n=96,points=[];for(let i=0;i<=n;i++){const a=i/n*Math.PI*2,rr=1+Math.sin(a*7)*.025+Math.cos(a*13)*.017;points.push(fieldPoint(Math.cos(a)*50*rr,Math.sin(a)*41*rr))}const c=fieldPoint(0,0);const radius=50*unit;ctx.save();ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(const p of points)ctx.lineTo(p.x,p.y);ctx.closePath();const g=ctx.createRadialGradient(c.x-60,c.y-65,radius*.08,c.x,c.y,radius*1.2);g.addColorStop(0,'#98b659');g.addColorStop(.5,'#7da34d');g.addColorStop(1,'#668743');ctx.fillStyle=g;ctx.shadowBlur=15;ctx.shadowColor='#61392460';ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#d6ae78';ctx.lineWidth=2;ctx.stroke();ctx.clip();
  let seed=38157;const r=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};for(let i=0;i<400;i++){const x=c.x+(r()-.5)*radius*2.3,y=c.y+(r()-.5)*radius*1.8;ctx.fillStyle=r()>.5?'#a5be6b24':'#3a623c1f';ctx.fillRect(x,y,2+r()*8,1+r()*5)}ctx.restore();
  const windx=fieldPoint(-44,-14),radar=fieldPoint(-46,20);ctx.strokeStyle='#f4e5c7';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(windx.x,windx.y);ctx.lineTo(windx.x,windx.y-30*unit);ctx.stroke();ctx.fillStyle='#cb5a43';ctx.beginPath();ctx.moveTo(windx.x,windx.y-30*unit);ctx.lineTo(windx.x+12*unit,windx.y-27*unit);ctx.lineTo(windx.x,windx.y-23*unit);ctx.fill();ctx.fillStyle='#46544c';ctx.beginPath();ctx.arc(radar.x,radar.y,2.5*unit,0,7);ctx.fill();const ra=performance.now()*.001;fallbackPolyline(ctx,[{x:radar.x-Math.cos(ra)*5*unit,y:radar.y-Math.sin(ra)*5*unit},{x:radar.x+Math.cos(ra)*5*unit,y:radar.y+Math.sin(ra)*5*unit}],'#ecdfba',3);
  for(const [x,z,kind] of [[48,12,'TOWER'],[51,-19,'HANGAR'],[-52,5,'HANGAR']]){const p=fieldPoint(x,z),w=(kind==='TOWER'?9:13)*unit,h=(kind==='TOWER'?9:8)*unit;ctx.fillStyle='#59473f55';ctx.fillRect(p.x-w*.44+4,p.y-h*.44+5,w,h);ctx.fillStyle=kind==='TOWER'?'#d7b58b':'#bd956b';ctx.fillRect(p.x-w*.5,p.y-h*.5,w,h);ctx.fillStyle=kind==='TOWER'?'#4d5a59':'#925e4c';ctx.fillRect(p.x-w*.55,p.y-h*.55,w,h*.3);ctx.strokeStyle='#f2dcaa';ctx.lineWidth=1;ctx.strokeRect(p.x-w*.5,p.y-h*.5,w,h);if(kind==='TOWER'){ctx.fillStyle='#d9e7db';ctx.fillRect(p.x-w*.35,p.y-h*.55,w*.7,h*.24)}}
  for(const rock of fallbackRocks){if((rock.x*rock.x/2500+rock.z*rock.z/1600)<1.5)continue;const p=fieldPoint(rock.x,rock.z);ctx.fillStyle='#8b583f63';ctx.beginPath();ctx.ellipse(p.x,p.y,rock.r*unit,rock.r*.65*unit,.3,0,7);ctx.fill()}
  const north=fieldPoint(-60,44);ctx.fillStyle='#f2deae';ctx.font=`bold ${Math.max(10,2.7*unit)}px Georgia`;ctx.fillText('N ↑',north.x,north.y);
}
function fallbackDrawRunway(ctx,d,unit){const local=(x,z)=>worldToScreen(d.group.localToWorld(v3(x,.6,z))),w=d.width/2,len=d.length/2,col=CSS_COLORS[d.type];const corners=[local(-w,-len),local(w,-len),local(w,len),local(-w,len)];fallbackPolygon(ctx,corners,'#38413f','#dec99c',1.2);for(const s of [-1,1])fallbackPolyline(ctx,[local(s*(w+.4),-len),local(s*(w+.4),len)],col,Math.max(2,.24*unit));for(let z=-len+4;z<len-4;z+=6.5)fallbackPolyline(ctx,[local(0,z),local(0,z+3)],'#fff1cd',Math.max(1.5,.35*unit));for(const z of [-len+2,len-2])for(let j=-2;j<=2;j++)fallbackPolyline(ctx,[local(j*w*.24-.35,z-1.1),local(j*w*.24-.35,z+1.1)],'#fff0d2',Math.max(1,.23*unit));const arrow=local(0,len+3);const entry=local(0,len-2);fallbackPolyline(ctx,[arrow,entry],col,Math.max(2,.3*unit));const label=local(0,-2);ctx.save();ctx.translate(label.x,label.y);ctx.fillStyle='#fff4d7';ctx.textAlign='center';ctx.font=`bold ${Math.max(10,1.5*unit)}px Georgia`;ctx.shadowColor='#111';ctx.shadowBlur=3;ctx.fillText(d.label,label.x*0,label.y*0);ctx.restore();if(d.halo.material.opacity>0){ctx.strokeStyle=col;ctx.globalAlpha=d.halo.material.opacity;ctx.lineWidth=5;ctx.strokeRect(Math.min(...corners.map(p=>p.x))-4,Math.min(...corners.map(p=>p.y))-4,Math.max(...corners.map(p=>p.x))-Math.min(...corners.map(p=>p.x))+8,Math.max(...corners.map(p=>p.y))-Math.min(...corners.map(p=>p.y))+8);ctx.globalAlpha=1}}
function fallbackDrawPad(ctx,d,unit){const p=fieldPoint(d.position.x,d.position.z),r=7*unit;ctx.fillStyle='#46544c';ctx.strokeStyle='#8ed67d';ctx.lineWidth=Math.max(2,.35*unit);ctx.beginPath();ctx.arc(p.x,p.y,r,0,7);ctx.fill();ctx.stroke();ctx.fillStyle='#ecf5d7';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`900 ${Math.max(18,7*unit)}px Georgia`;ctx.fillText('H',p.x,p.y+1);ctx.textBaseline='alphabetic';if(d.halo.material.opacity>0){ctx.globalAlpha=d.halo.material.opacity;ctx.lineWidth=5;ctx.strokeStyle='#a8ef92';ctx.beginPath();ctx.arc(p.x,p.y,r+5,0,7);ctx.stroke();ctx.globalAlpha=1}}
function fallbackDrawRoutes(ctx,unit){for(const plane of activePlanes){if(!plane.route)continue;const path=plane.route.curve.getPoints(70).map(p=>worldToScreen(p));const c=CSS_COLORS[plane.type];ctx.globalAlpha=.35;fallbackPolyline(ctx,path,c,Math.max(4,.65*unit));ctx.globalAlpha=.95;fallbackPolyline(ctx,path,'#fff4d5',Math.max(1,.15*unit),[2,10]);ctx.globalAlpha=1}for(const d of drags.values()){const pts=[d.plane.position,...d.points,d.snapped?.touchdown].filter(Boolean).map(p=>worldToScreen(p));if(pts.length<2)continue;const c=d.snapped?CSS_COLORS[d.plane.type]:'#fff1cf';ctx.globalAlpha=.9;fallbackPolyline(ctx,pts,c,Math.max(2,.42*unit));ctx.globalAlpha=1}}
function fallbackDrawPlane(ctx,p,unit){const pos=worldToScreen(p.position),color=CSS_COLORS[p.type];ctx.save();ctx.translate(pos.x,pos.y);ctx.rotate(-p.heading);ctx.scale(unit,unit);ctx.translate(0,0);
  ctx.fillStyle='#3c2b2766';ctx.beginPath();ctx.ellipse(1.5,1.4,p.type==='jet'?5:4,2.2,0,0,7);ctx.fill();ctx.lineWidth=.2;ctx.strokeStyle='#fcf4d9';ctx.fillStyle=color;
  if(p.type==='jet'){ctx.beginPath();ctx.moveTo(0,-5.7);ctx.lineTo(.7,-3.4);ctx.lineTo(.8,-1);ctx.lineTo(5,1.1);ctx.lineTo(5,2.1);ctx.lineTo(.75,1.1);ctx.lineTo(.5,3.1);ctx.lineTo(2,3.9);ctx.lineTo(2,4.5);ctx.lineTo(0,4);ctx.lineTo(-2,4.5);ctx.lineTo(-2,3.9);ctx.lineTo(-.5,3.1);ctx.lineTo(-.75,1.1);ctx.lineTo(-5,2.1);ctx.lineTo(-5,1.1);ctx.lineTo(-.8,-1);ctx.lineTo(-.7,-3.4);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#d8e5dd';ctx.fillRect(-.32,-3.4,.64,1.35);ctx.fillStyle='#3b4f55';ctx.fillRect(-.25,-3.0,.5,.8)}
  if(p.type==='prop'){ctx.fillRect(-.55,-3,.95,6.1);ctx.fillRect(-4.4,-.8,8.8,1.5);ctx.fillRect(-1.6,2.2,3.2,.7);ctx.fillStyle='#f1e1b2';for(const x of [-2.7,2.7]){ctx.fillRect(x-.45,-1.2,.9,1.5);ctx.fillStyle='#465155';ctx.fillRect(x-.12,-2.2,.24,1.7);ctx.fillStyle='#f1e1b2'}ctx.fillStyle='#435359';ctx.fillRect(-.35,-2,.7,1)}
  if(p.type==='biplane'){ctx.fillRect(-.47,-3,.94,6);ctx.fillRect(-3.9,-1.2,7.8,.92);ctx.fillStyle='#f1ead0';ctx.fillRect(-3.7,.2,7.4,1);ctx.fillStyle=color;ctx.fillRect(-1.45,2.0,2.9,.7);ctx.fillStyle='#384a4c';ctx.fillRect(-.1,-4.0,.2,2.1);ctx.fillStyle='#eef0d6';ctx.fillRect(-.25,-1.9,.5,.7)}
  if(p.type==='heli'){ctx.fillStyle='#334f48';ctx.fillRect(-.3,-2.6,.6,7);ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(0,-.7,1.15,2.1,0,0,7);ctx.fill();ctx.fillStyle='#385957';ctx.beginPath();ctx.ellipse(0,-1.6,.85,.86,0,0,7);ctx.fill();ctx.strokeStyle='#dae6d9';ctx.lineWidth=.17;ctx.beginPath();ctx.moveTo(-1.4,-1);ctx.lineTo(-1.4,2.1);ctx.moveTo(1.4,-1);ctx.lineTo(1.4,2.1);ctx.stroke();ctx.strokeStyle='#394944';ctx.lineWidth=.28;const a=performance.now()*.016;ctx.rotate(a);ctx.beginPath();ctx.moveTo(-5.2,0);ctx.lineTo(5.2,0);ctx.moveTo(0,-5.2);ctx.lineTo(0,5.2);ctx.stroke()}
  ctx.restore();if(p.warning){ctx.strokeStyle='#ffda69';ctx.lineWidth=3;ctx.globalAlpha=.75+.2*Math.sin(game.time*12);ctx.beginPath();ctx.arc(pos.x,pos.y,7*unit,0,7);ctx.stroke();ctx.globalAlpha=1}if([...drags.values()].some(d=>d.plane===p)){ctx.strokeStyle='#fff6cd';ctx.lineWidth=3;ctx.beginPath();ctx.arc(pos.x,pos.y,6*unit,0,7);ctx.stroke()}}
function renderFallback(){const ctx=fallbackContext,w=innerWidth,h=innerHeight;const origin=fieldPoint(0,0),unit=Math.abs(fieldPoint(1,0).x-origin.x);if(!fallbackBackground)fallbackBackground=fallbackBackdrop();ctx.clearRect(0,0,w,h);ctx.drawImage(fallbackBackground,0,0,w,h);fallbackDrawField(ctx,unit);for(const d of destinations){if(d.kind==='runway')fallbackDrawRunway(ctx,d,unit);else fallbackDrawPad(ctx,d,unit)}fallbackDrawRoutes(ctx,unit);for(const e of effects){const p=worldToScreen(e.mesh.position),r=e.kind==='ring'?e.mesh.scale.x*4*unit:e.mesh.scale.x*.45*unit;ctx.globalAlpha=e.mesh.material.opacity??.4;ctx.strokeStyle=e.kind==='ring'?'#fff4be':'#e9d5ae';ctx.fillStyle=e.kind==='trail'?'#fff5df':'#e5ca9d';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(1,r),0,7);if(e.kind==='ring')ctx.stroke();else ctx.fill()}ctx.globalAlpha=1;for(const p of activePlanes)fallbackDrawPlane(ctx,p,unit);ctx.save();ctx.globalAlpha=.14;ctx.strokeStyle='#f8e2bb';ctx.lineWidth=1;ctx.strokeRect(12,12,w-24,h-24);ctx.restore()}

let lastFrame=performance.now();
function animate(now){requestAnimationFrame(animate);const elapsed=Math.max(0,Math.min((now-lastFrame)/1000,1.2));lastFrame=now;game.realTime+=elapsed;
  if(game.mode==='playing'){let remaining=elapsed*game.speed;while(remaining>0&&game.mode==='playing'){const step=Math.min(.05,remaining);updateGame(step);remaining-=step}}
  else if(game.mode==='ready')updateEffects(Math.min(elapsed,.1));
  updateIdle(elapsed);clearToast();renderer.render(scene,camera)}
requestAnimationFrame(animate);

// Useful for deterministic interaction tests without exposing controls in the interface.
window.__argonAirspace={game,activePlanes,destinations,spawnAircraft,worldToScreen,screenToWorld};

