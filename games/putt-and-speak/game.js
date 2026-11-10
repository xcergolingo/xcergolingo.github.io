import * as THREE from './three.module.js';

// GoLingo Putt & Speak — a self-contained mini-golf language game.
// Three.js is distributed with its original MIT license beside this file.
const $ = (id) => document.getElementById(id);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const rand = (a, b) => a + Math.random() * (b - a);
const LANGUAGE = {
  en: {name: 'English', speech: 'en-US'}, ja: {name: 'Japanese', speech: 'ja-JP'},
  es: {name: 'Spanish', speech: 'es-ES'}, fr: {name: 'French', speech: 'fr-FR'},
  zh: {name: 'Chinese', speech: 'zh-CN'}, ko: {name: 'Korean', speech: 'ko-KR'},
  vi: {name: 'Vietnamese', speech: 'vi-VN'}, de: {name: 'German', speech: 'de-DE'},
  it: {name: 'Italian', speech: 'it-IT'}, pt: {name: 'Portuguese', speech: 'pt-BR'},
  ru: {name: 'Russian', speech: 'ru-RU'}, ar: {name: 'Arabic', speech: 'ar-SA'},
  hi: {name: 'Hindi', speech: 'hi-IN'}, th: {name: 'Thai', speech: 'th-TH'}
};
const DEMO = {
  ja: [
    ['水','water','水を飲みます。','I drink water.'], ['木','tree','あの木は高いです。','That tree is tall.'],
    ['山','mountain','山が見えます。','I can see the mountain.'], ['花','flower','花が咲いています。','The flower is blooming.'],
    ['空','sky','空が青いです。','The sky is blue.'], ['猫','cat','猫が寝ています。','The cat is sleeping.'],
    ['鳥','bird','鳥が歌っています。','The bird is singing.'], ['海','sea','海に行きたいです。','I want to go to the sea.'],
    ['月','moon','今夜は月がきれいです。','The moon is beautiful tonight.'], ['風','wind','風が強いです。','The wind is strong.'],
    ['太陽','sun','太陽が昇ります。','The sun rises.'], ['家','house','家に帰ります。','I am going home.']
  ],
  es: [
    ['agua','water','Bebo agua.','I drink water.'], ['árbol','tree','El árbol es alto.','The tree is tall.'],
    ['montaña','mountain','Veo la montaña.','I see the mountain.'], ['flor','flower','La flor es bonita.','The flower is pretty.'],
    ['cielo','sky','El cielo es azul.','The sky is blue.'], ['gato','cat','El gato duerme.','The cat is sleeping.'],
    ['pájaro','bird','El pájaro canta.','The bird is singing.'], ['mar','sea','Vamos al mar.','Let’s go to the sea.'],
    ['luna','moon','La luna brilla.','The moon shines.'], ['viento','wind','Hace viento.','It is windy.'],
    ['sol','sun','El sol es cálido.','The sun is warm.'], ['casa','house','Estoy en casa.','I am at home.']
  ],
  fr: [
    ['eau','water','Je bois de l’eau.','I drink water.'], ['arbre','tree','L’arbre est grand.','The tree is tall.'],
    ['montagne','mountain','La montagne est belle.','The mountain is beautiful.'], ['fleur','flower','Voici une fleur.','Here is a flower.'],
    ['ciel','sky','Le ciel est bleu.','The sky is blue.'], ['chat','cat','Le chat dort.','The cat is sleeping.'],
    ['oiseau','bird','L’oiseau chante.','The bird sings.'], ['mer','sea','J’aime la mer.','I love the sea.'],
    ['lune','moon','La lune est claire.','The moon is bright.'], ['vent','wind','Le vent souffle.','The wind is blowing.'],
    ['soleil','sun','Le soleil brille.','The sun shines.'], ['maison','house','Je rentre à la maison.','I go home.']
  ],
  zh: [
    ['水','water','我喝水。','I drink water.'], ['树','tree','这棵树很高。','This tree is tall.'],
    ['山','mountain','我看见一座山。','I see a mountain.'], ['花','flower','花开了。','The flower has bloomed.'],
    ['天空','sky','天空是蓝色的。','The sky is blue.'], ['猫','cat','猫在睡觉。','The cat is sleeping.'],
    ['鸟','bird','鸟在唱歌。','The bird is singing.'], ['海','sea','我喜欢大海。','I like the sea.'],
    ['月亮','moon','月亮很亮。','The moon is bright.'], ['风','wind','风很大。','It is windy.'],
    ['太阳','sun','太阳出来了。','The sun has come out.'], ['家','house','我回家了。','I am going home.']
  ],
  ko: [
    ['물','water','물을 마셔요.','I drink water.'], ['나무','tree','나무가 커요.','The tree is tall.'],
    ['산','mountain','산이 보여요.','I see a mountain.'], ['꽃','flower','꽃이 피었어요.','The flower has bloomed.'],
    ['하늘','sky','하늘이 파래요.','The sky is blue.'], ['고양이','cat','고양이가 자요.','The cat is sleeping.'],
    ['새','bird','새가 노래해요.','The bird is singing.'], ['바다','sea','바다에 가요.','I go to the sea.'],
    ['달','moon','달이 밝아요.','The moon is bright.'], ['바람','wind','바람이 불어요.','The wind is blowing.'],
    ['태양','sun','태양이 떠요.','The sun rises.'], ['집','house','집에 가요.','I go home.']
  ]
};
const COURSES = [
  {name:'THE MEADOW',theme:'#83bb68'}, {name:'BREEZY RIDGE',theme:'#8bc56c'},
  {name:'PEBBLE CREEK',theme:'#6aab77'}, {name:'LILY POND',theme:'#7ebd77'},
  {name:'BAMBOO BEND',theme:'#77af62'}, {name:'THE WINDMILL',theme:'#82b571'},
  {name:'SUNLIT SANDS',theme:'#a4bb70'}, {name:'GARDEN MAZE',theme:'#78ba78'},
  {name:'GOLDEN GREEN',theme:'#9ec476'}
];

const S = {
  lang:'ja', primary:'en', words:[], imported:false, mode:'challenge',
  hole:0, total:9, target:null, options:[], targetIndex:0,
  learned:[], strokes:0, holeStrokes:0, active:false, aiming:false, rolling:false,
  busy:false, winning:false, power:0, aimX:0, aimZ:-1,
  speech:true, repeat:true, effects:true, translations:false,
  lastClue:0, lastInteraction:0, lastShot:0, hintUntil:0,
  ballX:0, ballZ:10.1, vx:0, vz:0, sink:0, sinkCup:-1,
  obstacleSpecs:[], terrain:[], movingWindmill:null, undoTee:{x:0,z:10.1}
};
function demoWords(lang) { return (DEMO[lang] || DEMO.ja).map((w,i) => ({id:String(i+1),word:w[0],translation:w[1],sentence:w[2],sentenceTranslation:w[3]})); }
S.words = demoWords(S.lang);

let renderer, scene, camera, mainLight, ball, ballShadow, flagGroups=[], courseDecor, environment,
    aimGroup, aimDots=[], ballGlow, cupWorld=[], frame=0, lastTime=0, animating=false;
let isCanvasFallback=false, canvas2D=null;
const BALL_RADIUS = .33, FIELD_X = 7.85, FIELD_Z = 11.87;
const clock = new THREE.Clock();
const plane = new THREE.Plane(new THREE.Vector3(0,1,0),-.29);
const raycaster = new THREE.Raycaster();
const pointerVec = new THREE.Vector2(), worldHit = new THREE.Vector3();
const ballPosition = new THREE.Vector3(), p2 = new THREE.Vector3();
const green = (hex, other={}) => new THREE.MeshStandardMaterial({color:hex,roughness:.88,...other});
const mats = {
  rail:green('#f3e8c4'), edge:green('#977d54'), dark:green('#234a35'),
  wood:green('#bd895c'), gold:green('#e8bb62',{metalness:.2}),
  sand:green('#e5d29e'), rock:green('#889d8d',{roughness:1}), water:green('#4db4aa',{metalness:.15,roughness:.32}),
  cup:green('#172c29',{roughness:.64}), white:green('#fff8ed'), trunk:green('#765743'),
  leaf1:green('#3e945c'), leaf2:green('#5cad74'), leaf3:green('#86bd79'),
  pink:green('#eaa69d'), lavender:green('#bea4dc'), yellow:green('#ffcd71')
};
let audioContext = null;
let activePronunciation = null;

function setupScene() {
  try {
    renderer = new THREE.WebGLRenderer({canvas:$('gameCanvas'),antialias:true,powerPreference:'high-performance'});
  } catch(error) {
    // Browser-embedded and low-power environments sometimes disable WebGL.
    // Keep the same putting physics, language features and controls playable.
    canvas2D=$('gameCanvas').getContext('2d');
    if(!canvas2D){showToast('This device cannot render the golf course.');console.error(error);return false;}
    isCanvasFallback=true;
    renderer={domElement:$('gameCanvas'),shadowMap:{},setPixelRatio:()=>{},
      setSize:(w,h)=>{const ratio=Math.min(devicePixelRatio||1,2);$('gameCanvas').width=Math.round(w*ratio);$('gameCanvas').height=Math.round(h*ratio);},
      render:()=>renderCanvasFallback()};
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.3;
  scene=new THREE.Scene();scene.background=new THREE.Color('#abd9bd');scene.fog=new THREE.Fog('#b2dec4',40,95);
  camera=new THREE.PerspectiveCamera(41,1,.1,140);
  scene.add(new THREE.HemisphereLight('#ebfff3','#608769',2.35));
  mainLight=new THREE.DirectionalLight('#ffefd1',3.0);mainLight.position.set(-16,36,13);mainLight.castShadow=true;
  mainLight.shadow.mapSize.set(2048,2048);mainLight.shadow.camera.left=-30;mainLight.shadow.camera.right=30;
  mainLight.shadow.camera.top=30;mainLight.shadow.camera.bottom=-30;mainLight.shadow.bias=-.00018;
  mainLight.shadow.normalBias=.02;scene.add(mainLight);

  const base=new THREE.Mesh(new THREE.PlaneGeometry(250,250),green('#538d65'));
  base.rotation.x=-Math.PI/2;base.position.y=-1.25;base.receiveShadow=true;scene.add(base);
  const land=new THREE.Mesh(new THREE.CylinderGeometry(29,35,1.6,72),green('#76a66a'));
  land.position.y=-1.21;land.receiveShadow=true;scene.add(land);
  const plate=new THREE.Mesh(new THREE.BoxGeometry(18.85,.98,27.8),mats.edge);
  plate.position.set(0,-.32,0);plate.castShadow=true;plate.receiveShadow=true;scene.add(plate);
  const underGreen=new THREE.Mesh(new THREE.BoxGeometry(18.2,.36,27.18),green('#336b43'));
  underGreen.position.set(0,.035,0);underGreen.castShadow=true;scene.add(underGreen);
  const grassTexture=makeGrassTexture();
  const turf=new THREE.Mesh(new THREE.PlaneGeometry(17.2,25.2),new THREE.MeshStandardMaterial({map:grassTexture,roughness:1}));
  turf.rotation.x=-Math.PI/2;turf.position.y=.245;turf.receiveShadow=true;scene.add(turf);
  const tee=new THREE.Mesh(new THREE.CircleGeometry(1.02,48),green('#b6d993'));
  tee.rotation.x=-Math.PI/2;tee.position.set(0,.256,10.1);scene.add(tee);
  const teeRing=new THREE.Mesh(new THREE.RingGeometry(.96,1.06,48),green('#eff4bf',{side:THREE.DoubleSide}));
  teeRing.rotation.x=-Math.PI/2;teeRing.position.set(0,.267,10.1);scene.add(teeRing);
  for(const x of [-8.7,8.7]){
    const leftRail=new THREE.Mesh(new THREE.BoxGeometry(.46,.54,26.4),mats.rail);
    leftRail.position.set(x,.3,0);leftRail.castShadow=true;leftRail.receiveShadow=true;scene.add(leftRail);
    const trim=new THREE.Mesh(new THREE.BoxGeometry(.50,.09,26.4),mats.wood);
    trim.position.set(x,.6,0);trim.receiveShadow=true;scene.add(trim);
  }
  for(const z of [-12.9,12.9]){
    const rail=new THREE.Mesh(new THREE.BoxGeometry(18.0,.54,.46),mats.rail);
    rail.position.set(0,.3,z);rail.castShadow=true;scene.add(rail);
    const trim=new THREE.Mesh(new THREE.BoxGeometry(18.0,.09,.5),mats.wood);
    trim.position.set(0,.6,z);scene.add(trim);
  }
  // Decorative brass studs along the surrounding teak rail.
  for(let z=-12;z<=12;z+=2){for(const x of [-8.7,8.7]){
    const stud=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),mats.gold);stud.position.set(x,.665,z);scene.add(stud);
  }}
  buildEnvironment();
  courseDecor=new THREE.Group();scene.add(courseDecor);
  const ballMat=new THREE.MeshPhysicalMaterial({color:'#fffdf9',roughness:.23,metalness:0,clearcoat:.88,clearcoatRoughness:.16});
  const ballSphere=new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS,32,24),ballMat);
  ballSphere.castShadow=true;ball=new THREE.Group();ball.add(ballSphere);scene.add(ball);
  // A tiny logo/dimple helps visually communicate rolling.
  for(let i=0;i<38;i++){
    const v=new THREE.Vector3().setFromSphericalCoords(BALL_RADIUS*1.006,Math.acos(1-2*(i+.5)/38),i*2.399963);
    const d=new THREE.Mesh(new THREE.SphereGeometry(.017,6,4),new THREE.MeshStandardMaterial({color:'#dae3d8',transparent:true,opacity:.52}));
    d.position.copy(v);ballSphere.add(d);
  }
  ballShadow=new THREE.Mesh(new THREE.CircleGeometry(.43,40),new THREE.MeshBasicMaterial({color:'#1e4939',transparent:true,opacity:.24,depthWrite:false}));
  ballShadow.rotation.x=-Math.PI/2;ballShadow.position.y=.263;scene.add(ballShadow);
  aimGroup=new THREE.Group();scene.add(aimGroup);
  for(let i=0;i<21;i++){
    const mat=new THREE.MeshBasicMaterial({color:i%3===0?'#fff5bc':'#ffffff',transparent:true,opacity:.75,depthWrite:false});
    const dot=new THREE.Mesh(new THREE.SphereGeometry(i%4===0?.105:.071,9,8),mat);
    dot.visible=false;aimGroup.add(dot);aimDots.push(dot);
  }
  ballGlow=new THREE.Mesh(new THREE.RingGeometry(.53,.61,45),new THREE.MeshBasicMaterial({color:'#fff8bd',transparent:true,opacity:.56,side:THREE.DoubleSide,depthWrite:false}));
  ballGlow.rotation.x=-Math.PI/2;ballGlow.position.y=.283;scene.add(ballGlow);
  const ambientDust=new THREE.Group();scene.add(ambientDust);
  for(let i=0;i<45;i++){
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(rand(.025,.065),6,4),new THREE.MeshBasicMaterial({color:i%2?'#ffedba':'#e6f9ad',transparent:true,opacity:rand(.18,.5),depthWrite:false}));
    mesh.position.set(rand(-15,15),rand(1.6,5.1),rand(-15,15));mesh.userData={phase:rand(0,6.28),height:mesh.position.y};ambientDust.add(mesh);
  }
  environment=ambientDust;
  resizeScene();window.addEventListener('resize',resizeScene);
  buildCourse(0);updateBallMesh();renderFrame(0);
  return true;
}

function makeGrassTexture(){
  const c=document.createElement('canvas');c.width=512;c.height=1024;const ctx=c.getContext('2d');
  ctx.fillStyle='#78b967';ctx.fillRect(0,0,512,1024);
  for(let x=0;x<512;x+=62){ctx.fillStyle=(x/62)%2===0?'#76b566':'#81bd71';ctx.fillRect(x,0,62,1024);}
  let seed=1729;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<15000;i++){
    const x=random()*512,y=random()*1024,w=1+random()*4;
    ctx.fillStyle=random()>.5?'#d0e6a5':'#3f9960';ctx.globalAlpha=.03+random()*.09;ctx.fillRect(x,y,w,1+random()*6);
  }ctx.globalAlpha=1;
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;return tex;
}

function buildEnvironment(){
  // Low-poly garden landscape, pond, flower beds, lanterns and a distant clubhouse.
  const pool=new THREE.Mesh(new THREE.CylinderGeometry(5.2,5.4,.1,48),mats.water);
  pool.scale.z=.59;pool.position.set(-15,-.34,-3);scene.add(pool);
  const poolRim=new THREE.Mesh(new THREE.TorusGeometry(5.25,.24,8,64),green('#c2cc9b'));
  poolRim.scale.y=.61;poolRim.rotation.x=-Math.PI/2;poolRim.position.set(-15,-.26,-3);scene.add(poolRim);
  for(let i=0;i<13;i++){
    const angle=i/13*Math.PI*2;
    const lily=new THREE.Mesh(new THREE.CircleGeometry(rand(.25,.55),12),green(i%2?'#68b77c':'#83cc81',{side:THREE.DoubleSide}));
    lily.rotation.x=-Math.PI/2;lily.position.set(-15+Math.cos(angle)*rand(.6,4),-.265,-3+Math.sin(angle)*rand(.6,2.3));scene.add(lily);
  }
  const treeCoords=[];
  for(let i=0;i<49;i++){
    const theta=i*2.39996,r=17+rand(-3,5),x=Math.cos(theta)*r,z=Math.sin(theta)*r;
    if(Math.abs(x)<11 && Math.abs(z)<15)continue;
    treeCoords.push({x,z,scale:rand(.6,1.4),type:i%4});
  }
  treeCoords.forEach(t=>addTree(t.x,t.z,t.scale,t.type));
  for(let i=0;i<80;i++){
    const side=i%2===0?-1:1, x=side*rand(9.8,15.5),z=rand(-14,14);
    const colors=[mats.pink,mats.yellow,mats.lavender,mats.white];
    const blossom=new THREE.Mesh(new THREE.IcosahedronGeometry(rand(.11,.25),0),colors[i%4]);
    blossom.position.set(x,rand(-.1,.26),z);scene.add(blossom);
    if(i%4===0){const leaf=new THREE.Mesh(new THREE.SphereGeometry(rand(.3,.6),8,6),mats.leaf3);leaf.position.set(x,-.38,z);scene.add(leaf);}
  }
  for(let i=0;i<11;i++){
    const x=i%2===0?-11:11,z=-12+i*2.4;
    const pathBase=new THREE.Mesh(new THREE.CylinderGeometry(.32,.38,.6,8),mats.wood);
    pathBase.position.set(x,.05,z);pathBase.castShadow=true;scene.add(pathBase);
    const lantern=new THREE.Mesh(new THREE.CylinderGeometry(.24,.3,.5,6),new THREE.MeshStandardMaterial({color:'#ffdfa5',emissive:'#e4a85c',emissiveIntensity:.22}));
    lantern.position.set(x,.53,z);scene.add(lantern);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(.42,.27,6),mats.dark);roof.position.set(x,.91,z);scene.add(roof);
  }
  // Small clubhouse beyond the final cup.
  const house=new THREE.Group();house.position.set(0,-.7,-20);
  const walls=new THREE.Mesh(new THREE.BoxGeometry(8,3.6,4.8),green('#f4dcb4'));walls.position.y=2;walls.castShadow=true;house.add(walls);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(6.5,2.25,4),green('#655543'));roof.rotation.y=Math.PI/4;roof.scale.z=.6;roof.position.y=5.05;roof.castShadow=true;house.add(roof);
  for(let x of [-2.2,0,2.2]){
    const windowPane=new THREE.Mesh(new THREE.BoxGeometry(1.25,1.55,.1),green('#95c3ab',{metalness:.2}));windowPane.position.set(x,2.4,2.46);house.add(windowPane);
    const frame=new THREE.Mesh(new THREE.BoxGeometry(1.35,.11,.2),mats.wood);frame.position.set(x,2.4,2.53);house.add(frame);
  }
  scene.add(house);
  // Raked garden gravel and river stones outside the course.
  for(let i=0;i<60;i++){
    const x=(i%2?-1:1)*rand(10,25),z=rand(-20,20);
    const pebble=new THREE.Mesh(new THREE.IcosahedronGeometry(rand(.25,.7),0),i%2?mats.rock:mats.sand);
    pebble.position.set(x,-.38,z);pebble.scale.y=.32;scene.add(pebble);
  }
}

function addTree(x,z,s=1,type=0){
  const group=new THREE.Group();group.position.set(x,-.41,z);group.scale.setScalar(s);
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.19,.3,2.7,7),mats.trunk);
  trunk.position.y=1.2;trunk.castShadow=true;group.add(trunk);
  for(let j=0;j<3;j++){
    let canopy;
    if(type===0){canopy=new THREE.Mesh(new THREE.ConeGeometry(1.45-j*.24,2.9-j*.2,8),j%2?mats.leaf1:mats.leaf2);canopy.position.y=3+j*.72;}
    else {canopy=new THREE.Mesh(new THREE.IcosahedronGeometry(1.15+(j===1?.25:0),1),j%2?mats.leaf2:mats.leaf3);canopy.position.set((j-1)*.65,2.75+j*.52,(j-1)*.29);}
    canopy.castShadow=true;group.add(canopy);
  }
  scene.add(group);
}

function renderCanvasFallback(){
  const c=canvas2D,ratio=Math.min(devicePixelRatio||1,2),w=innerWidth,h=innerHeight;
  c.setTransform(ratio,0,0,ratio,0,0);c.clearRect(0,0,w,h);
  const bg=c.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#95c9ac');bg.addColorStop(.5,'#afd4a3');bg.addColorStop(1,'#396b51');
  c.fillStyle=bg;c.fillRect(0,0,w,h);
  function xy(x,y,z){const p=new THREE.Vector3(x,y,z).project(camera);return [(p.x*.5+.5)*w,(-p.y*.5+.5)*h];}
  function poly(points,fill,stroke,width=1){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.lineWidth=width;c.strokeStyle=stroke;c.stroke();}}
  function quad(x1,z1,x2,z2,y,fill,stroke){poly([xy(x1,y,z1),xy(x2,y,z1),xy(x2,y,z2),xy(x1,y,z2)],fill,stroke);}
  function disk(x,z,rx,rz,y,fill,stroke,width=1){const pts=[];for(let i=0;i<=44;i++){const a=i/44*Math.PI*2;pts.push(xy(x+Math.cos(a)*rx,y,z+Math.sin(a)*rz));}poly(pts,fill,stroke,width);}
  function line(a,b,color,width){c.beginPath();c.moveTo(...a);c.lineTo(...b);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
  // Soft environmental trees and garden flowers frame the course.
  for(let i=0;i<50;i++){
    const angle=i*2.39996,rr=18+(i%7)*.65,x=Math.cos(angle)*rr,z=Math.sin(angle)*rr;
    const [px,py]=xy(x,0,z),[tx,ty]=xy(x,2.9+(i%4),z);
    if(px< -80||px>w+80||py< -100||py>h+100)continue;
    c.globalAlpha=.34;c.fillStyle='#183f36';c.beginPath();c.ellipse(px+5,py+7,20,8,0,0,Math.PI*2);c.fill();c.globalAlpha=1;
    line([px,py],[tx,ty],'#8b7955',Math.max(2,4*(h/900)));
    poly([[tx-15,ty+15],[tx,ty-46],[tx+16,ty+15]],i%2?'#397b55':'#4b9561');
    poly([[tx-22,ty+27],[tx,ty-20],[tx+23,ty+27]],i%2?'#51a96b':'#64af72');
  }
  // Richly layered raised platform and alternating fairway mowing stripes.
  const boardTop=[xy(-9.35,-.15,-13.8),xy(9.35,-.15,-13.8),xy(9.35,-.15,13.8),xy(-9.35,-.15,13.8)];
  const boardBase=[xy(-9.35,-1,-13.8),xy(9.35,-1,-13.8),xy(9.35,-1,13.8),xy(-9.35,-1,13.8)];
  poly([boardTop[3],boardTop[2],boardBase[2],boardBase[3]],'#705c42');
  poly([boardTop[1],boardTop[2],boardBase[2],boardBase[1]],'#96805b');
  poly(boardTop,'#c9b48c','#f4e2b8',3);
  quad(-8.5,-12.5,8.5,12.5,.25,'#74b46a','#a9dc8b');
  for(let x=-8.48;x<8.45;x+=2.05)quad(x,-12.4,x+1.04,12.4,.257,'#79b96d');
  for(let z=-11;z<12;z+=3.5){
    line(xy(-8.45,.26,z),xy(8.45,.26,z),'#b0dca722',1.1);
  }
  // Rails.
  for(const x of [-8.7,8.7]){quad(x-.2,-13,x+.2,13,.44,'#f1e9cc','#c2a67b');}
  for(const z of [-12.75,12.75]){quad(-9.0,z-.23,9.0,z+.23,.44,'#f1e9cc','#c2a67b');}
  disk(0,10.1,1.08,1.08,.28,'#c5dfa0','#f2eeb7',2);
  disk(0,10.1,.7,.7,.282,'#93c477');
  // Surface hazards.
  for(const t of S.terrain){
    disk(t.x,t.z,t.rx,t.rz,.31,t.type==='water'?'#4ab7b0':'#e5d398',t.type==='water'?'#b9d9a1':'#efe2b4',3);
    if(t.type==='water')for(let k=0;k<3;k++)disk(t.x+(k-1)*t.rx*.34,t.z+(k-1)*t.rz*.16,.25,.25,.32,'#71bf80');
  }
  // Boulders, wooden barriers, windmill footprint.
  for(const obs of S.obstacleSpecs){
    if(obs.type==='circle'){
      disk(obs.x+.14,obs.z+.16,obs.r*1.04,obs.r*.98,.32,'#294c3a44');
      const p=xy(obs.x,obs.r*.75,obs.z),pr=xy(obs.x+obs.r,obs.r*.75,obs.z);
      const rad=Math.max(4,Math.abs(pr[0]-p[0]));
      c.fillStyle='#9baa91';c.beginPath();c.ellipse(p[0],p[1],rad,rad*.7,-.18,0,Math.PI*2);c.fill();
      c.fillStyle='#b7c1a7';c.beginPath();c.ellipse(p[0]-rad*.27,p[1]-rad*.25,rad*.37,rad*.19,-.18,0,Math.PI*2);c.fill();
    }else{
      line(xy(obs.x1,.52,obs.z1),xy(obs.x2,.52,obs.z2),'#8f663b',Math.max(5,obs.r*20));
      line(xy(obs.x1,.55,obs.z1),xy(obs.x2,.55,obs.z2),'#e2b982',Math.max(2,obs.r*10));
    }
  }
  // Ball targets and tiny fluttering flags.
  for(let i=0;i<cupWorld.length;i++){
    const {x,z}=cupWorld[i];
    disk(x,z,.67,.67,.29,'#f6f3e4','#d7d9ab',1.6);
    disk(x,z,.52,.52,.30,'#143c33');
    const base=xy(x+.47,.3,z),tip=xy(x+.47,2.48,z);
    line(base,tip,'#fff7ea',2.7);
    const other=xy(x+1.28,2.18,z);
    poly([tip,other,xy(x+.47,1.92,z)],['#ffc877','#fff4db','#f7a38d'][i%3],'#ffffff55',.5);
  }
  // The ball and its contact shadow.
  if(ball){
    const pt=xy(S.ballX,.65-S.sink*.5,S.ballZ);
    const rad=Math.max(4,Math.abs(xy(S.ballX+.34,.65,S.ballZ)[0]-pt[0]))*(S.sink>0?Math.max(0,1-S.sink/.6):1);
    const sh=xy(S.ballX,.30,S.ballZ);
    c.fillStyle='#234d3655';c.beginPath();c.ellipse(sh[0]+3,sh[1]+5,rad*1.24,rad*.46,0,0,Math.PI*2);c.fill();
    const grad=c.createRadialGradient(pt[0]-rad*.35,pt[1]-rad*.4,rad*.07,pt[0],pt[1],rad*1.2);
    grad.addColorStop(0,'#ffffff');grad.addColorStop(.68,'#f5f5ec');grad.addColorStop(1,'#9aaf9e');
    c.fillStyle=grad;c.beginPath();c.arc(pt[0],pt[1],rad,0,Math.PI*2);c.fill();c.strokeStyle='#ecf9e8';c.lineWidth=1;c.stroke();
    if(S.active&&!S.rolling&&!S.aiming&&!S.busy){c.strokeStyle='#fff1aa88';c.lineWidth=2;c.beginPath();c.arc(sh[0],sh[1],rad*1.85,0,Math.PI*2);c.stroke();}
  }
  if(S.aiming){
    for(let i=0;i<aimDots.length;i++){
      const dot=aimDots[i];if(!dot.visible)continue;const p=xy(dot.position.x,.42,dot.position.z);
      c.globalAlpha=dot.material.opacity;c.fillStyle=i%3===0?'#fff0ad':'#ffffff';c.beginPath();c.arc(p[0],p[1],i%4===0?4:2.5,0,Math.PI*2);c.fill();
    }c.globalAlpha=1;
  }
  // Corner vignette gives the flat fallback a softly lit, game-like finish.
  const vignette=c.createRadialGradient(w/2,h*.45,Math.min(w,h)*.12,w/2,h*.45,Math.max(w,h)*.75);
  vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#092a2848');c.fillStyle=vignette;c.fillRect(0,0,w,h);
}

function buildCourse(index){
  // Clean up only content regenerated for each hole; garden and putting platform stay intact.
  if(!courseDecor)return;
  for(const child of [...courseDecor.children]){courseDecor.remove(child);child.traverse(o=>{if(o.geometry)o.geometry.dispose();});}
  S.obstacleSpecs=[];S.terrain=[];S.movingWindmill=null;
  const level=index%COURSES.length;
  // Cup locations are independent of word identity; positions change a little each hole.
  const cupCount=S.active?(S.mode==='practice'?1:Math.min(3,S.options.length)):3;
  cupWorld=cupCount===1?[{x:0,z:-8.4}]:cupCount===2?[
    {x:-4.5,z:-8.4}, {x:4.5,z:-8.4}
  ]:[{x:-5.2,z:-8.4-(level%2)*.35}, {x:0,z:-8.5}, {x:5.2,z:-8.4-(level%2)*.35}];
  const flagColors=['#e7bc72','#fff7e6','#ec9987'];
  flagGroups=[];
  cupWorld.forEach((pos,i)=>{
    const group=new THREE.Group();group.position.set(pos.x,0,pos.z);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(.62,.065,9,45),mats.white);rim.rotation.x=-Math.PI/2;rim.position.y=.288;rim.receiveShadow=true;group.add(rim);
    const pit=new THREE.Mesh(new THREE.CircleGeometry(.55,48),mats.cup);pit.rotation.x=-Math.PI/2;pit.position.y=.265;group.add(pit);
    const inner=new THREE.Mesh(new THREE.RingGeometry(.4,.48,48),green('#48564b',{side:THREE.DoubleSide}));inner.rotation.x=-Math.PI/2;inner.position.y=.269;group.add(inner);
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,2.2,8),mats.white);post.position.set(.45,1.39,0);post.castShadow=true;group.add(post);
    const fin=new THREE.Shape();fin.moveTo(0,0);fin.lineTo(.78,.20);fin.lineTo(0,.45);fin.closePath();
    const cloth=new THREE.Mesh(new THREE.ShapeGeometry(fin),new THREE.MeshStandardMaterial({color:flagColors[i],side:THREE.DoubleSide,roughness:.86}));
    cloth.position.set(.45,2.22,.04);cloth.castShadow=true;group.add(cloth);
    const button=new THREE.Mesh(new THREE.SphereGeometry(.08,8,6),mats.gold);button.position.set(.45,2.48,0);group.add(button);
    const marker=new THREE.Mesh(new THREE.RingGeometry(.88,.92,48),new THREE.MeshBasicMaterial({color:flagColors[i],side:THREE.DoubleSide,transparent:true,opacity:.55}));
    marker.rotation.x=-Math.PI/2;marker.position.y=.273;group.add(marker);
    flagGroups.push(group);courseDecor.add(group);
  });
  // Variations introduce new miniature-golf challenges without overwhelming the first hole.
  if(level===1){addRock(-2.3,1.9,1.2);addRock(2.2,-1.5,1);addSand(0,4.4,2.2,1.65);}
  if(level===2){addRock(-3.3,2.0,1.5);addRock(3.3,-.5,1.2);addSand(0,-2.8,1.9,1.3);addLog(-1.4,-1.2,1.5,2.6,.27);}
  if(level===3){addWater(-.5,-.1,2.5,2.1);addRock(4.6,2,1.3);addRock(-4.7,-2,1.1);}
  if(level===4){addLog(-5,1.7,-1,-1.2,.34);addLog(1.3,3,4.9,-.5,.34);addSand(-4,-4.2,1.8,1.5);}
  if(level===5){addWindmill(0,.4);addRock(-4.1,-4,1.1);addRock(4.1,-4,1.1);}
  if(level===6){addSand(0,1.2,2.8,2.5);addSand(4,-4.0,2,1.5);addRock(-3.8,1.2,1.3);addRock(3.4,3,1.2);}
  if(level===7){addLog(-4.8,0,0,-3,.32);addLog(.6,3,5.2,0,.32);addWater(-3,-4.2,2.2,1.4);addRock(3.3,-3.5,1.0);}
  if(level===8){addRock(-3.5,2.1,1.1);addRock(2.9,.2,1.4);addSand(-2.5,-3.2,1.6,2);addWater(3.1,-3.9,1.65,1.4);addLog(-1.8,-.3,1.5,-1.6,.26);}
  // Decorative flowerbeds along the edge of each course.
  for(let i=0;i<26;i++){
    const side=i%2?-1:1, x=side*rand(7.3,7.8),z=rand(-11,11);
    const flower=new THREE.Mesh(new THREE.IcosahedronGeometry(rand(.13,.23),0),[mats.yellow,mats.pink,mats.white,mats.lavender][i%4]);
    flower.position.set(x,.4,z);courseDecor.add(flower);
  }
  updateBallMesh();syncCupLabels();
}

function addRock(x,z,r){
  const stone=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),mats.rock);
  stone.position.set(x,.5,z);stone.scale.y=.75;stone.rotation.y=rand(-Math.PI,Math.PI);stone.castShadow=true;stone.receiveShadow=true;courseDecor.add(stone);
  S.obstacleSpecs.push({type:'circle',x,z,r:r*.86+.1});
  for(let i=0;i<3;i++){const moss=new THREE.Mesh(new THREE.SphereGeometry(r*.25,9,7),mats.leaf3);moss.scale.y=.26;moss.position.set(x+Math.cos(i*2.4)*r*.5,.8,z+Math.sin(i*2.4)*r*.5);courseDecor.add(moss);}
}
function addSand(x,z,rx,rz){
  const sand=new THREE.Mesh(new THREE.CircleGeometry(1,56),mats.sand);sand.rotation.x=-Math.PI/2;sand.scale.set(rx,rz,1);sand.position.set(x,.268,z);sand.receiveShadow=true;courseDecor.add(sand);S.terrain.push({type:'sand',x,z,rx,rz});
  for(let j=0;j<5;j++){const ripple=new THREE.Mesh(new THREE.RingGeometry(.2+j*.22,.22+j*.22,54),new THREE.MeshBasicMaterial({color:'#f2e5bc',transparent:true,opacity:.29,side:THREE.DoubleSide}));ripple.rotation.x=-Math.PI/2;ripple.scale.set(rx*.66,rz*.67,1);ripple.position.set(x,.272+j*.0002,z);courseDecor.add(ripple);}
}
function addWater(x,z,rx,rz){
  const water=new THREE.Mesh(new THREE.CircleGeometry(1,64),new THREE.MeshPhysicalMaterial({color:'#56beb3',roughness:.22,metalness:.08,transparent:true,opacity:.92}));
  water.rotation.x=-Math.PI/2;water.scale.set(rx,rz,1);water.position.set(x,.276,z);courseDecor.add(water);
  const edge=new THREE.Mesh(new THREE.RingGeometry(.95,1.12,64),green('#c1cf9b',{side:THREE.DoubleSide}));
  edge.rotation.x=-Math.PI/2;edge.scale.set(rx,rz,1);edge.position.set(x,.272,z);courseDecor.add(edge);
  S.terrain.push({type:'water',x,z,rx:rx*.93,rz:rz*.93,mesh:water});
  for(let j=0;j<4;j++){
    const pad=new THREE.Mesh(new THREE.CircleGeometry(.24,14),mats.leaf3);
    pad.rotation.x=-Math.PI/2;pad.position.set(x+Math.cos(j*1.7)*rx*.48,.282,z+Math.sin(j*1.7)*rz*.48);courseDecor.add(pad);
  }
}
function addLog(x1,z1,x2,z2,r){
  const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz);
  const log=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,12),mats.wood);
  log.rotation.z=Math.PI/2;log.rotation.y=-Math.atan2(dz,dx);
  log.position.set((x1+x2)/2,.42,(z1+z2)/2);log.castShadow=true;courseDecor.add(log);
  for(const p of [[x1,z1],[x2,z2]]){const cap=new THREE.Mesh(new THREE.SphereGeometry(r,10,8),mats.gold);cap.position.set(p[0],.42,p[1]);courseDecor.add(cap);}
  S.obstacleSpecs.push({type:'segment',x1,z1,x2,z2,r:r+BALL_RADIUS*.55});
}
function addWindmill(x,z){
  const tower=new THREE.Mesh(new THREE.CylinderGeometry(.55,.85,2.3,7),green('#e9d9b1'));
  tower.position.set(x,1.18,z);tower.castShadow=true;courseDecor.add(tower);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(1.0,1.2,7),mats.wood);roof.position.set(x,2.95,z);courseDecor.add(roof);
  const vanes=new THREE.Group();vanes.position.set(x,1.8,z+1.0);courseDecor.add(vanes);
  for(let i=0;i<4;i++){
    const vane=new THREE.Mesh(new THREE.BoxGeometry(.36,2.5,.13),mats.white);vane.position.y=1.08;vane.rotation.z=-.16;
    const pivot=new THREE.Group();pivot.rotation.z=i*Math.PI/2;pivot.add(vane);vanes.add(pivot);
  }
  const dot=new THREE.Mesh(new THREE.SphereGeometry(.22,12,8),mats.gold);vanes.add(dot);
  S.movingWindmill=vanes;
  S.obstacleSpecs.push({type:'circle',x,z,r:1.12});
}

function resizeScene(){
  if(!renderer)return;
  const width=window.innerWidth,height=window.innerHeight,aspect=width/height;
  renderer.setSize(width,height,false);camera.aspect=aspect;
  const portrait=aspect<.8;
  camera.fov=portrait?46:aspect>1.8?40:42;
  camera.position.set(0,portrait?40:aspect>1.8?27:33,portrait?31:aspect>1.8?22:25);
  camera.lookAt(0,.1,portrait?-1:0);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);syncCupLabels();
}

function updateBallMesh(){
  if(!ball)return;
  ball.position.set(S.ballX,.29+BALL_RADIUS,S.ballZ);
  ballShadow.position.set(S.ballX,.278,S.ballZ);
  ballGlow.position.set(S.ballX,.281,S.ballZ);
  ballGlow.visible=S.active&&!S.rolling&&!S.aiming&&!S.busy;
}
function currentBallScreen(){
  if(!camera)return {x:0,y:0};
  p2.set(S.ballX,.29+BALL_RADIUS,S.ballZ).project(camera);
  return {x:(p2.x*.5+.5)*window.innerWidth,y:(-.5*p2.y+.5)*window.innerHeight};
}
function getGroundAtPointer(e){
  const rect=renderer.domElement.getBoundingClientRect();
  pointerVec.set(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);
  raycaster.setFromCamera(pointerVec,camera);
  return raycaster.ray.intersectPlane(plane,worldHit)?worldHit:null;
}
function syncCupLabels(){
  if(!camera||!cupWorld.length)return;
  const labels=[...document.querySelectorAll('.cup-label')];
  labels.forEach((el,i)=>{
    if(!S.options[i]||!cupWorld[i]||!S.active){el.hidden=true;return;}
    el.hidden=false;
    const p=new THREE.Vector3(cupWorld[i].x,3.18,cupWorld[i].z).project(camera);
    el.style.left=(p.x*.5+.5)*innerWidth+'px';el.style.top=(-p.y*.5+.5)*innerHeight+'px';
    el.classList.toggle('hinted',S.hintUntil>performance.now()&&i===S.targetIndex);
  });
}
function updateAimGuide(){
  const show=S.aiming&&S.power>1;
  $('powerControl').classList.toggle('visible',show);
  $('powerControl').setAttribute('aria-hidden',show?'false':'true');
  $('powerFill').style.height=S.power+'%';$('powerValue').textContent=Math.round(S.power)+'%';
  const speed=3+S.power*.2,estimate=clamp(speed*speed/(2*9.0),0,30);
  for(let i=0;i<aimDots.length;i++){
    const t=(i+1)/aimDots.length,dist=t*estimate;
    const d=aimDots[i];d.visible=show;
    d.position.set(S.ballX+S.aimX*dist,.40,S.ballZ+S.aimZ*dist);
    d.material.opacity=.85-t*.58;
  }
}

function onPointerDown(e){
  if(!S.active||S.rolling||S.busy||S.aiming||e.button>0||overlayOpen())return;
  const pos=currentBallScreen(),distance=Math.hypot(e.clientX-pos.x,e.clientY-pos.y);
  const near=distance<(innerWidth<700?88:70);
  if(!near)return;
  S.aiming=true;S.lastInteraction=performance.now();
  $('shotInstructions').classList.add('hidden');
  try {renderer.domElement.setPointerCapture(e.pointerId);}catch(_){/* Safari fallback */}
  onPointerMove(e);
  e.preventDefault();
}
function onPointerMove(e){
  if(!S.aiming)return;
  const point=getGroundAtPointer(e);if(!point)return;
  const dx=S.ballX-point.x,dz=S.ballZ-point.z,len=Math.hypot(dx,dz);
  S.aimX=len>.05?dx/len:0;S.aimZ=len>.05?dz/len:-1;
  S.power=clamp(len*12.5,0,100);
  updateAimGuide();e.preventDefault();
}
function onPointerUp(e){
  if(!S.aiming)return;
  S.aiming=false;try {renderer.domElement.releasePointerCapture(e.pointerId);}catch(_){}
  if(S.power>=7)strikeBall();
  S.power=0;updateAimGuide();e.preventDefault();
}
function strikeBall(){
  S.rolling=true;S.vx=S.aimX*(3+S.power*.2);S.vz=S.aimZ*(3+S.power*.2);
  S.strokes++;S.holeStrokes++;S.lastShot=performance.now();S.lastInteraction=S.lastShot;
  $('strokesValue').textContent=S.strokes;
  if(S.effects)effect('putt');
  $('shotInstructions').classList.add('hidden');
}
function inEllipse(x,z,t){return ((x-t.x)/t.rx)**2+((z-t.z)/t.rz)**2<1;}
function resolveCollision(nx,nz,penetration){
  S.ballX+=nx*penetration;S.ballZ+=nz*penetration;
  const dot=S.vx*nx+S.vz*nz;
  if(dot<0){S.vx-=1.64*dot*nx;S.vz-=1.64*dot*nz;if(S.effects&&Math.abs(dot)>2.2&&performance.now()-S.lastImpact>105){effect('bump');S.lastImpact=performance.now();}}
}
function collideObstacle(o){
  if(o.type==='circle'){
    const dx=S.ballX-o.x,dz=S.ballZ-o.z,d=Math.hypot(dx,dz),min=o.r+BALL_RADIUS;
    if(d<min){const inv=d>.0001?1/d:1;resolveCollision(dx*inv,dz*inv,min-d+.003);}
  }else if(o.type==='segment'){
    const dx=o.x2-o.x1,dz=o.z2-o.z1,len2=dx*dx+dz*dz;
    const t=clamp(((S.ballX-o.x1)*dx+(S.ballZ-o.z1)*dz)/len2,0,1);
    const px=o.x1+dx*t,pz=o.z1+dz*t,cx=S.ballX-px,cz=S.ballZ-pz,d=Math.hypot(cx,cz);
    if(d<o.r+BALL_RADIUS){const n=d>.001?[cx/d,cz/d]:[-dz/Math.sqrt(len2),dx/Math.sqrt(len2)];resolveCollision(n[0],n[1],o.r+BALL_RADIUS-d+.002);}
  }
}
function moveBall(dt){
  if(S.sink>0){
    S.sink+=dt;const scale=Math.max(0,1-S.sink/.6);
    ball.scale.setScalar(scale);ball.position.y=.29+BALL_RADIUS-S.sink*.55;
    return;
  }
  if(!S.rolling)return;
  // Substeps prevent tunneling past golf cup rims and thin obstacles.
  const sub=Math.max(1,Math.ceil(dt/.013));
  for(let step=0;step<sub;step++){
    const h=dt/sub,oldX=S.ballX,oldZ=S.ballZ;
    S.ballX+=S.vx*h;S.ballZ+=S.vz*h;
    const speed=Math.hypot(S.vx,S.vz);
    let friction=8.8;
    for(const t of S.terrain){
      if(inEllipse(S.ballX,S.ballZ,t)){
        if(t.type==='water'){
          S.vx=S.vz=0;S.rolling=false;S.busy=true;
          showToast('Splash! Water hazard — back to the tee.');
          if(S.effects)effect('splash');
          setTimeout(()=>{resetBall(false);S.busy=false;},1000);return;
        }
        friction=19.5;
      }
    }
    if(speed>0){
      const next=Math.max(0,speed-friction*h),ratio=next/speed;
      S.vx*=ratio;S.vz*=ratio;
    }
    if(S.ballX < -FIELD_X+BALL_RADIUS)resolveCollision(1,0,(-FIELD_X+BALL_RADIUS)-S.ballX);
    if(S.ballX > FIELD_X-BALL_RADIUS)resolveCollision(-1,0,S.ballX-(FIELD_X-BALL_RADIUS));
    if(S.ballZ < -FIELD_Z+BALL_RADIUS)resolveCollision(0,1,(-FIELD_Z+BALL_RADIUS)-S.ballZ);
    if(S.ballZ > FIELD_Z-BALL_RADIUS)resolveCollision(0,-1,S.ballZ-(FIELD_Z-BALL_RADIUS));
    for(const o of S.obstacleSpecs)collideObstacle(o);
    for(let i=0;i<cupWorld.length;i++){
      const cup=cupWorld[i],dist=Math.hypot(S.ballX-cup.x,S.ballZ-cup.z),velocity=Math.hypot(S.vx,S.vz);
      // A slow approach is rewarded; a hard-hit ball skims past the cup.
      if(dist<.57&&velocity<11.2){onCupSunk(i);return;}
    }
    if(Math.hypot(S.vx,S.vz)<.14){S.vx=S.vz=0;S.rolling=false;S.lastInteraction=performance.now();$('shotInstructions').classList.remove('hidden');break;}
    const vx=S.ballX-oldX,vz=S.ballZ-oldZ;
    ball.rotation.x+=vz*1.4;ball.rotation.z-=vx*1.4;
  }
  updateBallMesh();
}

function onCupSunk(index){
  S.rolling=false;S.vx=S.vz=0;S.busy=true;S.sink=.001;S.sinkCup=index;
  S.ballX=cupWorld[index].x;S.ballZ=cupWorld[index].z;
  if(S.effects)effect('cup');
  if(index===S.targetIndex||S.mode==='practice'){
    S.winning=true;S.learned.push({...S.target,hole:S.hole+1,strokes:S.holeStrokes});
    updateHUD();
    setTimeout(()=>{showResult();},650);
  }else{
    const chosen=S.options[index];showToast(`That was “${chosen.translation}.” Find “${S.target.translation}”!`);
    setTimeout(()=>{resetBall(false);S.busy=false;playClue();},1650);
  }
}
function resetBall(penalty=false){
  if(penalty&&S.active&&!S.winning){S.strokes++;S.holeStrokes++;$('strokesValue').textContent=S.strokes;showToast('Re-tee: +1 stroke');}
  S.ballX=0;S.ballZ=10.1;S.vx=S.vz=0;S.rolling=false;S.sink=0;S.sinkCup=-1;S.aiming=false;S.power=0;
  S.busy=false;ball.scale.setScalar(1);ball.rotation.set(0,0,0);updateBallMesh();updateAimGuide();
  if(S.active)$('shotInstructions').classList.remove('hidden');
}

function renderFrame(timestamp){
  if(!renderer)return;
  const delta=lastTime?clamp((timestamp-lastTime)/1000,0,.045):.016;lastTime=timestamp;
  if(S.active||!S.winning){moveBall(delta);}
  const t=timestamp*.001;
  if(S.movingWindmill)S.movingWindmill.rotation.z+=delta*.68;
  if(environment)environment.children.forEach((d,i)=>{d.position.y=d.userData.height+Math.sin(t*.65+d.userData.phase)*.24;d.position.x+=Math.sin(t*.4+i)*.0008;});
  if(ballGlow&&ballGlow.visible){ballGlow.material.opacity=.36+Math.sin(t*2.2)*.16;ballGlow.scale.setScalar(1+Math.sin(t*2.2)*.03);}
  for(let i=0;i<flagGroups.length;i++){
    const cloth=flagGroups[i].children[4];if(cloth)cloth.rotation.y=Math.sin(t*1.25+i*.7)*.11;
  }
  if(frame++%5===0)syncCupLabels();
  renderer.render(scene,camera);
  requestAnimationFrame(renderFrame);
}

function shuffle(items){
  const a=items.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;
}
function createRound(){
  S.active=true;S.winning=false;S.busy=false;S.holeStrokes=0;
  S.target=S.words[S.hole%S.words.length];
  const other=shuffle(S.words.filter(w=>w.word!==S.target.word&&w.translation.toLowerCase()!==S.target.translation.toLowerCase()));
  if(S.mode==='practice'||S.words.length===1) {S.options=[S.target];S.targetIndex=0;}
  else {S.options=shuffle([S.target,...other.slice(0,2)]);S.targetIndex=S.options.findIndex(x=>x===S.target);}
  S.hintUntil=0;
  buildCourse(S.hole);resetBall(false);updateHUD();syncCupLabels();
  setTimeout(()=>{if(S.active&&!S.winning)playClue();},650);
}
function startGame(){
  S.hole=0;S.strokes=0;S.learned=[];
  S.total=Math.min(9,S.words.length);
  $('welcomeOverlay').hidden=true;$('settingsOverlay').hidden=true;$('resultOverlay').hidden=true;
  S.lastInteraction=performance.now();createRound();
  try{window.speechSynthesis?.getVoices();}catch(_){}
}
function nextHole(){
  S.hole++;
  if(S.hole>=S.total){
    S.hole=0;S.strokes=0;S.learned=[];S.target=null;
    $('resultOverlay').hidden=true;
    $('welcomeOverlay').hidden=false;S.active=false;S.winning=false;S.busy=false;
    syncCupLabels();return;
  }
  $('resultOverlay').hidden=true;createRound();
}
function updateHUD(){
  $('courseTitle').textContent=COURSES[S.hole%9].name;
  $('holeCount').innerHTML=`HOLE ${S.hole+1} <span>/ ${S.total}</span>`;
  $('strokesValue').textContent=S.strokes;
  $('learnedValue').innerHTML=`${S.learned.length}<span class="stat-small"> / ${S.total}</span>`;
  $('missionMode').textContent=S.mode==='challenge'?'LISTEN & PUTT':'PUTT & LEARN';
  $('languageTag').textContent=`${S.primary.toUpperCase()} → ${S.lang.toUpperCase()}`;
  $('missionInstruction').textContent=S.mode==='challenge'?'Find the word for':'Learn to say';
  $('promptWord').textContent=S.target?.translation||'ready?';
  $('lessonHint').textContent=S.mode==='challenge'?`Putt into the cup with the matching ${LANGUAGE[S.lang]?.name||S.lang} word.`:'Sink your putt to hear the word and example sentence.';
  $('missionProgressBar').style.width=(S.learned.length/S.total*100)+'%';
  const labels=[...document.querySelectorAll('.cup-label')];
  labels.forEach((el,i)=>{
    const word=S.options[i];el.hidden=!word||!S.active;
    if(!word)return;
    el.querySelector('.cup-num').textContent=String(i+1).padStart(2,'0');
    el.querySelector('.cup-word').textContent=word.word;
    el.querySelectorAll('small').forEach(x=>x.remove());
    if(S.translations){const hint=document.createElement('small');hint.textContent=word.translation;el.append(hint);}
  });
  $('shotInstructions').classList.toggle('hidden',!S.active||S.rolling||S.busy);
}
function showResult(){
  if(!S.winning)return;
  const last=S.hole===S.total-1;
  $('resultOverline').textContent=last?'ROUND COMPLETE — WELL PLAYED!':'WORD COLLECTED · GREAT PUTT!';
  $('resultHeadline').textContent=last?'You mastered the green!':'That’s the right word!';
  $('resultWord').textContent=S.target.word;$('resultTranslation').textContent=S.target.translation;
  $('resultSentence').textContent=S.target.sentence||`Say it aloud: ${S.target.word}`;
  $('resultSentenceTranslation').textContent=S.target.sentenceTranslation||'';
  $('resultStrokes').textContent=`${S.holeStrokes} ${S.holeStrokes===1?'stroke':'strokes'}`;
  $('resultLearned').textContent=`${S.learned.length} / ${S.total}`;
  $('nextBtn').querySelector('span').textContent=last?'FINISH ROUND':'NEXT HOLE';
  $('nextBtn').querySelector('strong').textContent=last?'✓':'→';
  $('resultOverlay').hidden=false;
  speakWord(S.target);
}

function overlayOpen(){return !$('welcomeOverlay').hidden||!$('resultOverlay').hidden||!$('settingsOverlay').hidden;}
function showToast(text){
  const el=$('toast');el.textContent=text;el.classList.add('show');
  clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>el.classList.remove('show'),2300);
}
function speak(text,lang){
  if(!S.speech||!text)return;
  if(activePronunciation){activePronunciation.pause();activePronunciation=null;}
  const synth=window.speechSynthesis;
  if(!synth||typeof SpeechSynthesisUtterance==='undefined')return;
  try{
    synth.cancel();const u=new SpeechSynthesisUtterance(String(text));
    const preferred=LANGUAGE[lang]?.speech||lang;
    u.lang=preferred;u.rate=lang==='en'?.85:.77;u.pitch=1.02;u.volume=1;
    const voices=synth.getVoices();const matching=voices.find(v=>v.lang.toLowerCase()===preferred.toLowerCase())||voices.find(v=>v.lang.toLowerCase().startsWith(preferred.slice(0,2).toLowerCase()));
    if(matching)u.voice=matching;
    synth.speak(u);
  }catch(e){console.warn('Speech unavailable',e);}
}
function speakWord(entry){
  if(!entry||!S.speech)return;
  const url=entry.audioURL||'';
  if(url&&(/^(https?:\/\/|blob:|data:audio\/)/i).test(url)&&typeof Audio!=='undefined'){
    if(activePronunciation)activePronunciation.pause();
    window.speechSynthesis?.cancel();
    const recording=new Audio(url);activePronunciation=recording;
    recording.play().catch(()=>{if(activePronunciation===recording){activePronunciation=null;speak(entry.word,S.lang);}});
  }else speak(entry.word,S.lang);
}
function playClue(){
  if(!S.target||!S.active||S.winning||overlayOpen()||!S.speech)return;
  if(S.mode==='practice')speakWord(S.target);
  else speak(S.target.translation,S.primary);
  S.lastClue=performance.now();
}
function effect(kind){
  try{
    audioContext ||= new (window.AudioContext||window.webkitAudioContext)();
    if(audioContext.state==='suspended')audioContext.resume();
    const at=audioContext.currentTime;
    const sounds=kind==='putt'?[[275,.10,'sine',.13],[420,.08,'sine',.07]]:kind==='cup'?[[550,.12,'sine',.12],[770,.15,'sine',.12],[1020,.28,'sine',.09]]:kind==='splash'?[[165,.18,'triangle',.1]]:[[210,.06,'triangle',.07]];
    for(const [f,d,type,vol] of sounds){
      const o=audioContext.createOscillator(),g=audioContext.createGain();o.type=type;o.frequency.setValueAtTime(f,at);g.gain.setValueAtTime(vol,at);g.gain.exponentialRampToValueAtTime(.001,at+d);
      o.connect(g);g.connect(audioContext.destination);o.start(at);o.stop(at+d+.005);
    }
  }catch(_){/* Audio is optional. */}
}
function showHint(){
  if(!S.active||S.busy||S.rolling)return;
  S.hintUntil=performance.now()+4500;syncCupLabels();
  showToast('Gold glow marks the matching word.');
}

function ensureLanguageOption(code){
  for(const id of ['startLanguage','settingsLanguage']){
    const select=$(id);
    if(![...select.options].some(o=>o.value===code)){
      const o=document.createElement('option');o.value=code;o.textContent=LANGUAGE[code]?.name||code.toUpperCase();select.append(o);
    }
  }
}
function normalizeWords(obj){
  let data=obj;
  for(let depth=0;depth<3;depth++){
    if(!data||typeof data!=='object'||Array.isArray(data))break;
    if(['words','sentences','phrases','items','entries'].some(k=>Array.isArray(data[k])))break;
    data=data.payload||data.data||data.lesson||data;
  }
  const source=Array.isArray(data)?[{entries:data,kind:'words'}]:
    ['words','sentences','phrases','items','entries'].filter(k=>Array.isArray(data?.[k])).map(k=>({entries:data[k],kind:k}));
  if(!source.length)throw new Error('Expected a GoLingo words, sentences, phrases, items or entries array.');
  const clean=source.flatMap(({entries,kind})=>entries.map(w=>({w,kind}))).map(({w,kind},i)=>{
    const item=typeof w==='string'?{word:w}:w;
    if(!item||typeof item!=='object')return null;
    const word=String(item.word||item.text||item.phrase||item.sentence||item.term||'').trim();
    const rawTranslation=item.translation||item.meaning||item.wordTranslation||item.sentenceTranslation||item.translatedText;
    const translation=String(rawTranslation||word).trim();
    const sentence=String(item.sentence||(kind!=='words'?word:'')).trim();
    const sentenceTranslation=String(item.sentenceTranslation||(kind!=='words'?translation:'')).trim();
    const audioURL=String(item.audioURL||item.audioUrl||item.audio_url||'').trim();
    return word?{id:String(item.id??i+1),word,translation,sentence,sentenceTranslation,audioURL}:null;
  }).filter(Boolean);
  const unique=[...new Map(clean.map(x=>[x.word.toLocaleLowerCase(),x])).values()];
  if(!unique.length)throw new Error('No usable GoLingo words or sentences were found.');
  return {words:unique,
    primary:String(data?.primaryLanguage||data?.translationLanguage||data?.nativeLanguage||'en').split('-')[0].toLowerCase(),
    language:String(data?.learningLanguage||data?.targetLanguage||data?.language||S.lang).split('-')[0].toLowerCase()};
}
function importData(obj){
  const imp=normalizeWords(obj);
  S.words=imp.words;S.lang=imp.language;S.primary=imp.primary;S.imported=true;S.total=Math.min(9,S.words.length);
  if(S.words.length===1||new Set(S.words.map(w=>w.translation.toLocaleLowerCase())).size===1){
    S.mode='practice';$('settingsMode').value='practice';
    $('challengeMode').classList.remove('active');$('practiceMode').classList.add('active');
    $('challengeMode').setAttribute('aria-pressed','false');$('practiceMode').setAttribute('aria-pressed','true');
  }
  ensureLanguageOption(S.lang);
  $('startLanguage').value=S.lang;$('settingsLanguage').value=S.lang;
  $('wordCountLabel').textContent=`${S.words.length} words imported`;
  try{localStorage.setItem('golingoPuttWords',JSON.stringify({primaryLanguage:S.primary,learningLanguage:S.lang,words:S.words}));}catch(_){}
  if(S.active){S.hole=0;S.strokes=0;S.learned=[];createRound();}
  showToast(`${S.words.length} GoLingo words loaded!`);
}
function decodePotentialJSON(raw){
  if(typeof raw!=='string')return raw;
  let str=raw;
  for(let i=0;i<2;i++){
    try{return JSON.parse(str);}catch(_){}
    try{str=decodeURIComponent(str);}catch(_){}
  }
  try{
    const binary=atob(str.replace(/-/g,'+').replace(/_/g,'/'));
    const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }catch(_){throw new Error('Please enter valid JSON or a supported encoded GoLingo payload.');}
}
function loadExternalData(){
  const hash=location.hash.replace(/^#/,'');
  if(hash.startsWith('golingoLesson=')){
    try{importData(decodePotentialJSON(hash.slice('golingoLesson='.length)));return;}
    catch(e){console.warn('Could not load GoLingo gallery lesson hash',e);}
  }
  const params=new URLSearchParams(location.search);
  for(const key of ['lesson','golingo','golingoData','data','payload','words','wordList','vocabulary','sentences']){
    if(!params.has(key))continue;
    try{importData(decodePotentialJSON(params.get(key)));return;}catch(e){console.warn('Could not load URL word list',e);}
  }
  try{
    const shared=sessionStorage.getItem('golingo:active-lesson:v1');
    if(shared){importData(JSON.parse(shared));return;}
  }catch(e){console.warn('Could not load same-tab GoLingo lesson',e);}
  try{
    const stored=localStorage.getItem('golingoPuttWords');if(stored)importData(JSON.parse(stored));
  }catch(e){console.warn('Could not restore saved words',e);}
}
function selectBuiltInLanguage(lang){
  if(S.imported&&lang!==S.lang){
    S.imported=false;S.primary='en';
    try{localStorage.removeItem('golingoPuttWords');}catch(_){}
    showToast(`Switched to built-in ${LANGUAGE[lang]?.name||lang} words.`);
  }
  S.lang=lang;
  if(!S.imported)S.words=demoWords(lang);
  S.total=Math.min(9,S.words.length);
}
function downloadCollected(){
  const payload={primaryLanguage:S.primary,learningLanguage:S.lang,words:S.learned.map(w=>({id:w.id,word:w.word,translation:w.translation,sentence:w.sentence,sentenceTranslation:w.sentenceTranslation,audioURL:w.audioURL||undefined,hole:w.hole,strokes:w.strokes}))};
  const data=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(data);
  const anchor=document.createElement('a');anchor.href=url;anchor.download='golingo-putt-learned-words.json';document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  showToast(`${S.learned.length} learned words exported.`);
}

function setupUI(){
  const canvas=$('gameCanvas');
  canvas.addEventListener('pointerdown',onPointerDown,{passive:false});
  canvas.addEventListener('pointermove',onPointerMove,{passive:false});
  canvas.addEventListener('pointerup',onPointerUp,{passive:false});
  canvas.addEventListener('pointercancel',onPointerUp,{passive:false});
  window.addEventListener('blur',()=>{if(S.aiming){S.aiming=false;S.power=0;updateAimGuide();}});
  document.querySelectorAll('.cup-label').forEach(el=>el.addEventListener('click',()=>{
    const i=Number(el.dataset.cup);if(S.options[i])speakWord(S.options[i]);
  }));
  const pickMode=(mode)=>{
    S.mode=mode;
    $('challengeMode').classList.toggle('active',mode==='challenge');$('practiceMode').classList.toggle('active',mode==='practice');
    $('challengeMode').setAttribute('aria-pressed',String(mode==='challenge'));
    $('practiceMode').setAttribute('aria-pressed',String(mode==='practice'));
    $('settingsMode').value=mode;
  };
  $('challengeMode').onclick=()=>pickMode('challenge');
  $('practiceMode').onclick=()=>pickMode('practice');
  $('startLanguage').onchange=e=>{
    const lang=e.target.value;selectBuiltInLanguage(lang);$('settingsLanguage').value=lang;
  };
  $('startBtn').onclick=()=>{if(!S.imported){S.words=demoWords(S.lang);}startGame();};
  $('repeatPrompt').onclick=()=>{S.lastInteraction=performance.now();playClue();};
  $('soundBtn').onclick=()=>{
    S.speech=!S.speech;$('soundBtn').textContent=S.speech?'🔊':'🔇';
    if(!S.speech)window.speechSynthesis?.cancel();else playClue();
  };
  $('restartBtn').onclick=()=>{if(S.active&&!S.busy)resetBall(true);};
  $('skipBtn').onclick=()=>{if(S.active&&!S.busy)resetBall(true);};
  $('hintBtn').onclick=showHint;
  $('menuBtn').onclick=showSettings;
  $('welcomeImport').onclick=()=>{showSettings();};
  $('closeSettings').onclick=()=>{$('settingsOverlay').hidden=true;};
  $('resultOverlay').addEventListener('click',e=>{if(e.target===$('resultOverlay')){/* Keep result until acknowledged. */}});
  $('nextBtn').onclick=nextHole;
  $('replayWord').onclick=()=>{if(S.target)speakWord(S.target);};
  $('downloadResults').onclick=downloadCollected;
  $('exportWords').onclick=downloadCollected;
  $('loadWords').onclick=()=>{
    try{importData(decodePotentialJSON($('wordInput').value.trim()));}catch(e){showToast(e.message);}
  };
  $('demoWords').onclick=()=>{
    S.imported=false;S.primary='en';S.lang=$('settingsLanguage').value;
    S.words=demoWords(S.lang);$('wordInput').value='';$('wordCountLabel').textContent='Demo words loaded';
    try{localStorage.removeItem('golingoPuttWords');}catch(_){}
    showToast('Demo vocabulary restored.');
  };
  $('wordFile').onchange=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{$('wordInput').value=await file.text();importData(JSON.parse($('wordInput').value));}catch(err){showToast(err.message);}
    e.target.value='';
  };
  $('settingsMode').onchange=e=>pickMode(e.target.value);
  $('settingsLanguage').onchange=e=>{
    selectBuiltInLanguage(e.target.value);$('startLanguage').value=S.lang;
  };
  $('repeatToggle').onchange=e=>S.repeat=e.target.checked;
  $('translationsToggle').onchange=e=>{S.translations=e.target.checked;updateHUD();};
  $('effectsToggle').onchange=e=>S.effects=e.target.checked;
  $('applySettings').onclick=()=>{
    S.mode=$('settingsMode').value;S.lang=$('settingsLanguage').value;
    if(!S.imported)S.words=demoWords(S.lang);
    S.total=Math.min(9,S.words.length);
    $('settingsOverlay').hidden=true;
    if(S.active){S.hole=0;S.strokes=0;S.learned=[];createRound();}
    else buildCourse(0);
  };
  window.addEventListener('keydown',e=>{
    if(e.key==='Escape'){if(!$('settingsOverlay').hidden)$('settingsOverlay').hidden=true;}
    if(e.code==='KeyR'&&!overlayOpen()&&S.active){resetBall(true);}
    if(e.code==='Space'&&!overlayOpen()&&S.active){e.preventDefault();playClue();}
  });
  // Accept word data passed from a GoLingo app webview or a parent game hub.
  window.addEventListener('message',event=>{
    const raw=event.data;
    if(!raw||typeof raw!=='object'&&typeof raw!=='string')return;
    const nested=raw?.payload||raw?.data||raw;
    if(!['words','sentences','phrases','items','entries'].some(k=>Array.isArray(nested?.[k]))&&!Array.isArray(nested)&&typeof nested!=='string')return;
    try{importData(decodePotentialJSON(nested));}catch(e){console.warn('Ignored incompatible vocabulary message:',e.message);}
  });
  setInterval(()=>{
    if(S.active&&!S.rolling&&!S.aiming&&!S.busy&&!S.winning&&!overlayOpen()&&S.repeat&&S.speech&&performance.now()-S.lastClue>7600){playClue();}
  },2100);
}

// Public webview integration: the GoLingo app/hub can supply a new lesson at any time.
window.GoLingoGame={
  importWords(data){importData(typeof data==='string'?decodePotentialJSON(data):data);return {count:S.words.length,learningLanguage:S.lang};},
  getCollectedWords(){return S.learned.map(w=>({...w}));},
  getStatus(){return {mode:S.mode,hole:S.hole+1,wordsLoaded:S.words.length,learned:S.learned.length};}
};
function showSettings(){
  $('settingsLanguage').value=S.lang;$('settingsMode').value=S.mode;
  $('repeatToggle').checked=S.repeat;$('translationsToggle').checked=S.translations;$('effectsToggle').checked=S.effects;
  $('wordCountLabel').textContent=S.imported?`${S.words.length} words imported`:`${S.words.length} demo words`;
  $('settingsOverlay').hidden=false;
}

setupUI();
const ready=setupScene();
if(ready){loadExternalData();requestAnimationFrame(renderFrame);}
