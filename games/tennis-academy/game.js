import * as THREE from './three.module.js';
import {drawBallMachine} from './kinematic-player.js';

// GoLingo Tennis Academy — browser-local, procedural 3D tennis and vocabulary drills.
const $ = (id) => document.getElementById(id);
const clamp = (v, low, high) => Math.min(high, Math.max(low, v));
const lerp = (a, b, t) => a + (b - a) * t;
const random = (a, b) => a + Math.random() * (b - a);
const smooth = (v) => v * v * (3 - 2 * v);
const WIDTH = 10.97, LENGTH = 23.77, SINGLES = 4.115;
const languageNames = {en:'English',ja:'Japanese',es:'Spanish',fr:'French',zh:'Chinese',ko:'Korean',vi:'Vietnamese',de:'German',pt:'Portuguese',it:'Italian',ar:'Arabic',hi:'Hindi',ru:'Russian',th:'Thai'};
const locales = {en:'en-US',ja:'ja-JP',es:'es-ES',fr:'fr-FR',zh:'zh-CN',ko:'ko-KR',vi:'vi-VN',de:'de-DE',pt:'pt-BR',it:'it-IT',ar:'ar-SA',hi:'hi-IN',ru:'ru-RU',th:'th-TH'};
const words = (entries) => entries.map(([word, translation, sentence = '', sentenceTranslation = ''], i) => ({id:String(i+1),word,translation,sentence,sentenceTranslation}));
const sampleDecks = {
  ja: words([
    ['水','water','水を飲みます。','I drink water.'],['友達','friend','彼は私の友達です。','He is my friend.'],['空','sky','空が青いです。','The sky is blue.'],['美しい','beautiful','この花は美しいです。','This flower is beautiful.'],
    ['ありがとう','thank you','どうもありがとう。','Thank you very much.'],['本','book','本を読みます。','I read a book.'],['食べる','to eat','一緒に食べましょう。','Let’s eat together.'],['朝','morning','おはようございます。','Good morning.'],
    ['電車','train','電車に乗ります。','I ride the train.'],['音楽','music','音楽が好きです。','I like music.'],['夢','dream','大きな夢があります。','I have a big dream.'],['旅行','travel','日本に旅行したいです。','I want to travel to Japan.']
  ]),
  es: words([
    ['agua','water','Quiero beber agua.','I want to drink water.'],['amigo','friend','Mi amigo está aquí.','My friend is here.'],['cielo','sky','El cielo es azul.','The sky is blue.'],['hermoso','beautiful','Qué lugar tan hermoso.','What a beautiful place.'],
    ['gracias','thank you','Muchas gracias.','Thank you very much.'],['libro','book','Leo un libro.','I read a book.'],['comer','to eat','Vamos a comer.','Let’s eat.'],['mañana','morning','Buenos días.','Good morning.'],
    ['tren','train','El tren llega pronto.','The train arrives soon.'],['música','music','Me gusta la música.','I like music.'],['sueño','dream','Tengo un sueño.','I have a dream.'],['viajar','travel','Quiero viajar.','I want to travel.']
  ]),
  fr: words([
    ['eau','water','Je bois de l’eau.','I drink water.'],['ami','friend','Voici mon ami.','This is my friend.'],['ciel','sky','Le ciel est bleu.','The sky is blue.'],['beau','beautiful','C’est très beau.','It is very beautiful.'],
    ['merci','thank you','Merci beaucoup.','Thank you very much.'],['livre','book','Je lis un livre.','I read a book.'],['manger','to eat','On va manger.','We are going to eat.'],['matin','morning','Bonjour ce matin.','Good morning.'],
    ['train','train','Je prends le train.','I take the train.'],['musique','music','J’aime la musique.','I love music.'],['rêve','dream','J’ai un rêve.','I have a dream.'],['voyager','travel','J’aime voyager.','I love to travel.']
  ]),
  zh: words([
    ['水','water','我想喝水。','I want to drink water.'],['朋友','friend','她是我的朋友。','She is my friend.'],['天空','sky','天空很蓝。','The sky is blue.'],['美丽','beautiful','这里很美丽。','This place is beautiful.'],
    ['谢谢','thank you','非常谢谢你。','Thank you very much.'],['书','book','我在读书。','I am reading a book.'],['吃饭','to eat','我们一起吃饭。','Let’s eat together.'],['早上','morning','早上好。','Good morning.'],
    ['火车','train','火车快到了。','The train is coming soon.'],['音乐','music','我喜欢音乐。','I like music.'],['梦想','dream','我有一个梦想。','I have a dream.'],['旅行','travel','我想去旅行。','I want to travel.']
  ]),
  ko: words([
    ['물','water','물을 마십니다.','I drink water.'],['친구','friend','내 친구예요.','This is my friend.'],['하늘','sky','하늘이 파래요.','The sky is blue.'],['아름답다','beautiful','정말 아름다워요.','It is very beautiful.'],
    ['감사합니다','thank you','정말 감사합니다.','Thank you very much.'],['책','book','책을 읽어요.','I read a book.'],['먹다','to eat','함께 먹어요.','Let’s eat together.'],['아침','morning','좋은 아침이에요.','Good morning.'],
    ['기차','train','기차를 타요.','I ride the train.'],['음악','music','음악을 좋아해요.','I like music.'],['꿈','dream','꿈이 있어요.','I have a dream.'],['여행','travel','여행하고 싶어요.','I want to travel.']
  ]),
  vi: words([
    ['nước','water','Tôi uống nước.','I drink water.'],['bạn','friend','Đây là bạn tôi.','This is my friend.'],['bầu trời','sky','Bầu trời xanh.','The sky is blue.'],['đẹp','beautiful','Nơi này rất đẹp.','This place is beautiful.'],
    ['cảm ơn','thank you','Cảm ơn rất nhiều.','Thank you very much.'],['sách','book','Tôi đọc sách.','I read a book.'],['ăn','to eat','Chúng ta cùng ăn.','Let’s eat together.'],['buổi sáng','morning','Chào buổi sáng.','Good morning.'],
    ['tàu hỏa','train','Tôi đi tàu hỏa.','I ride the train.'],['âm nhạc','music','Tôi thích âm nhạc.','I like music.'],['ước mơ','dream','Tôi có một ước mơ.','I have a dream.'],['du lịch','travel','Tôi thích du lịch.','I love to travel.']
  ])
};
const shotInfo = {
  serve:{name:'Serve',arc:1.65,time:.88,score:120,label:'FAST & PRECISE',targetZ:-4.7},
  forehand:{name:'Forehand',arc:1.20,time:1.06,score:100,label:'DRIVE IT DEEP',targetZ:-8.1},
  backhand:{name:'Backhand',arc:1.40,time:1.12,score:110,label:'CROSS COURT',targetZ:-8.3},
  drop:{name:'Drop shot',arc:.87,time:1.02,score:145,label:'SOFT TOUCH',targetZ:-2.7},
  lob:{name:'Lob',arc:4.20,time:1.52,score:150,label:'HIGH & DEEP',targetZ:-10.35}
};

let deck = sampleDecks.ja.slice(), learningLanguage='ja', primaryLanguage='en';
let selectedShot='serve', questionIndex=0, choices=[], selectedChoice=0, started=false, paused=false, phase='serve';
let points=0, hits=0, correctHits=0, streak=0, rallyCount=0, nextReturn=0, queuedSwing=false;
let drillHits=0, drillMisses=0, misses=0, aimX=0, firstAudioGesture=false, feedAnnouncement=false;
let aimZ=shotInfo.serve.targetZ, lastBouncePlayed=false;
let flight=null, shotToResolve=null, speechEnabled=true, soundEnabled=true, showWords=true, movementAssist=true;
let collected=new Map(), flashedAt=0, toastTimer=0, feedbackTimer=0, elapsed=0;
let swingAnimation=0, swingType='forehand', hitPower=.75, pressStarted=0;
let powerCharging=false,autoCharging=false,chargePointerId=null;
let customDeck=null, incomingTargetX=0, keyMovement={left:false,right:false,up:false,down:false};
const joystickMovement={x:0,z:0};
const playerVelocity={x:0,z:0};
const shootPositions=[-3.25,0,3.25];

let renderer, scene, camera, player, opponent, ball, ballShadow, returnMarker;
let fallbackContext=null, usesCanvasFallback=false;
let ballTrail=[], targetRings=[], targetButtons=[], courtMaterial, selectionBeam, particles=[];
let audioContext=null,activeWordAudio=null;
const worldClock=new THREE.Clock();
// Restore the realistic tennis player from the earlier version while retaining
// the stationary ball machine and improved mobile controls.
const courtPlate=new Image(),athleteActions=new Image(),athleteSpecial=new Image();
courtPlate.decoding='async';athleteActions.decoding='async';athleteSpecial.decoding='async';
courtPlate.src='./tennis-court.jpg';
athleteActions.src='./athlete-actions.png';
athleteSpecial.src='./athlete-special.png';
let pendingStroke=null;

function createMaterial(color, roughness=.85, metalness=0, options={}) {
  return new THREE.MeshStandardMaterial({color,roughness,metalness,...options});
}
function box(sceneParent,w,h,d,material,x=0,y=0,z=0) {
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  mesh.position.set(x,y,z);mesh.receiveShadow=true;mesh.castShadow=h>.35;sceneParent.add(mesh);return mesh;
}
function sphere(sceneParent,r,material,x=0,y=0,z=0,segments=16) {
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,segments,Math.max(8,Math.floor(segments*.75))),material);
  mesh.position.set(x,y,z);mesh.castShadow=true;sceneParent.add(mesh);return mesh;
}
function cyl(sceneParent,r1,r2,h,material,x=0,y=0,z=0,segments=12) {
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),material);
  mesh.position.set(x,y,z);mesh.castShadow=true;sceneParent.add(mesh);return mesh;
}
function tube(sceneParent,points,radius,material,segments=30) {
  const curve=new THREE.CatmullRomCurve3(points);
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,segments,radius,7,false),material);
  mesh.castShadow=true;sceneParent.add(mesh);return mesh;
}
function groundLine(w,d,x,z,material) { box(scene,w,.022,d,material,x,.036,z); }
function textPanel(text,width,height,background='#073839',ink='#e7ffb7') {
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
  const g=canvas.getContext('2d');g.fillStyle=background;g.fillRect(0,0,1024,256);
  g.fillStyle='rgba(213,255,223,.08)';for(let i=0;i<16;i++)g.fillRect(i*68,0,1,256);
  g.fillStyle=ink;g.textAlign='center';g.textBaseline='middle';g.font='900 93px Arial, sans-serif';g.fillText(text,512,124,950);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
}

function courtTexture() {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=512;
  const g=canvas.getContext('2d');g.fillStyle='#176b58';g.fillRect(0,0,256,512);
  for(let y=0;y<512;y+=14){g.fillStyle=(y/14)%2===0?'#ffffff09':'#001e1707';g.fillRect(0,y,256,7);}
  for(let i=0;i<5500;i++){const v=Math.floor(random(20,85));g.fillStyle=`rgba(${v},${v+55},${v+45},${random(.02,.08)})`;g.fillRect(random(0,256),random(0,512),random(.2,1.4),random(.2,1.5));}
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}

function buildCourt() {
  const gravel=createMaterial('#47513c',1);
  box(scene,150,.6,150,createMaterial('#132d30',1),0,-.38,0);
  box(scene,38,.035,51,gravel,0,-.03,0);
  const under=createMaterial('#164b48',.95);
  box(scene,20,.085,33,under,0,.015,0);
  courtMaterial=createMaterial('#e3fff0',.95,0,{map:courtTexture(),color:'#ffffff'});
  box(scene,WIDTH,.045,LENGTH,courtMaterial,0,.073,0);
  const ink=createMaterial('#ecf9e7',.91);
  groundLine(WIDTH,.075,0,-LENGTH/2,ink);groundLine(WIDTH,.075,0,LENGTH/2,ink);
  for(const x of [-WIDTH/2,WIDTH/2,-SINGLES,SINGLES])groundLine(.067,LENGTH,x,0,ink);
  for(const z of [-6.40,6.40])groundLine(SINGLES*2,.064,0,z,ink);
  groundLine(.064,12.8,0,0,ink);
  groundLine(.065,.24,0,11.8,ink);groundLine(.065,.24,0,-11.8,ink);
  // Real net geometry, taut white tape and black grid.
  const netMat=new THREE.MeshBasicMaterial({color:'#101d22',transparent:true,opacity:.38,side:THREE.DoubleSide,depthWrite:false});
  const net=new THREE.Mesh(new THREE.PlaneGeometry(12.4,1.02),netMat);net.position.set(0,.58,0);scene.add(net);
  const meshLines=new THREE.LineBasicMaterial({color:'#d2e7d5',transparent:true,opacity:.25});
  const vertices=[];
  for(let x=-6.15;x<=6.2;x+=.22)vertices.push(x,.11,0,x,1.06,0);
  for(let y=.13;y<=1.09;y+=.12)vertices.push(-6.2,y,0,6.2,y,0);
  const grid=new THREE.BufferGeometry();grid.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));scene.add(new THREE.LineSegments(grid,meshLines));
  box(scene,12.45,.065,.07,createMaterial('#e8f1e7'),0,1.095,0);
  for(const x of [-6.3,6.3]){cyl(scene,.07,.07,1.55,createMaterial('#f4f5df',.5),x,.78,0);sphere(scene,.08,createMaterial('#ffffff'),x,1.56,0);}
  // Impact markers for the three word choices.
  for(let i=0;i<3;i++){
    const target=new THREE.Group();
    const glow=new THREE.Mesh(new THREE.CircleGeometry(.88,48),new THREE.MeshBasicMaterial({color:'#58f6bc',transparent:true,opacity:.10,side:THREE.DoubleSide,depthWrite:false}));glow.rotation.x=-Math.PI/2;glow.position.y=.126;target.add(glow);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.73,.045,8,64),new THREE.MeshBasicMaterial({color:'#a8ffe0',transparent:true,opacity:.85,depthWrite:false}));ring.rotation.x=Math.PI/2;ring.position.y=.145;target.add(ring);
    const inner=new THREE.Mesh(new THREE.TorusGeometry(.46,.018,6,48),new THREE.MeshBasicMaterial({color:'#a3fad4',transparent:true,opacity:.35,depthWrite:false}));inner.rotation.x=Math.PI/2;inner.position.y=.147;target.add(inner);
    const point=sphere(target,.065,new THREE.MeshBasicMaterial({color:'#ffffce'}),0,.24,0);point.castShadow=false;
    scene.add(target);target.userData={ring,glow,inner};targetRings.push(target);
  }
  returnMarker=new THREE.Group();
  const marker=new THREE.Mesh(new THREE.RingGeometry(.58,.68,48),new THREE.MeshBasicMaterial({color:'#faff92',transparent:true,opacity:.72,side:THREE.DoubleSide,depthWrite:false}));
  marker.rotation.x=-Math.PI/2;returnMarker.add(marker);
  const marker2=new THREE.Mesh(new THREE.CircleGeometry(.61,48),new THREE.MeshBasicMaterial({color:'#eaff8b',transparent:true,opacity:.13,side:THREE.DoubleSide,depthWrite:false}));marker2.rotation.x=-Math.PI/2;marker2.position.y=-.002;returnMarker.add(marker2);returnMarker.position.y=.15;returnMarker.visible=false;scene.add(returnMarker);
}

function buildArena() {
  const wall=createMaterial('#243a39',1),stone=createMaterial('#51534a',1),bench=createMaterial('#8e6b4c',.95),edge=createMaterial('#cbad7d',.92),seat=createMaterial('#244f49',1);
  for(const side of [-1,1]) {
    box(scene,.65,2.4,46,wall,side*20.2,1.05,0);
    for(let row=0;row<10;row++){
      const x=side*(10.65+row*.93),y=.18+row*.46;
      box(scene,.92,.41,42,stone,x,y-.12,-.4);
      box(scene,.85,.14,41.5,bench,x,y+.15,-.4);
      box(scene,.07,.045,41.5,edge,x-side*.38,y+.24,-.4);
      if(row%2===0)for(let z=-19;z<18;z+=5.4)box(scene,.6,.09,.65,seat,x,y+.30,z);
    }
  }
  for(let row=0;row<11;row++){
    const z=-17-row*.95,y=.30+row*.47;
    box(scene,39,.47,.91,stone,0,y-.13,z);
    box(scene,38.5,.13,.85,bench,0,y+.17,z);
    box(scene,38.5,.05,.075,edge,0,y+.25,z+.37);
  }
  box(scene,40,7,.7,wall,0,3.0,-29.1);
  box(scene,40,.8,1,createMaterial('#0e302e'),0,6.48,-28.9);
  const crowdGeo=new THREE.IcosahedronGeometry(.12,0);
  const crowdMat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1,vertexColors:false});
  const instanceCount=1500;const crowd=new THREE.InstancedMesh(crowdGeo,crowdMat,instanceCount);
  const dummy=new THREE.Object3D();const colors=['#e4a36d','#8fd9ce','#e4d1a2','#8a9c96','#e9d56d','#668987','#e5e7df','#bf7e62','#a5c8b4'];
  let c=0;
  for(const side of [-1,1])for(let row=1;row<10;row++)for(let z=-20;z<19;z+=.82){
    if(Math.random()<.25)continue;
    const y=.63+row*.46;
    dummy.position.set(side*(10.65+row*.93),y+random(-.07,.12),z+random(-.15,.15));dummy.scale.set(random(.75,1.1),random(1.4,2.1),random(.85,1.2));dummy.updateMatrix();crowd.setMatrixAt(c,dummy.matrix);crowd.setColorAt(c,new THREE.Color(colors[Math.floor(Math.random()*colors.length)]));c++;
  }
  for(let row=2;row<11;row++)for(let x=-18;x<18;x+=.77){
    if(Math.random()<.18)continue;
    dummy.position.set(x+random(-.14,.14),.78+row*.47,-17-row*.95);
    dummy.scale.set(random(.8,1.1),random(1.3,1.95),random(.75,1.2));dummy.updateMatrix();crowd.setMatrixAt(c,dummy.matrix);crowd.setColorAt(c,new THREE.Color(colors[Math.floor(Math.random()*colors.length)]));c++;
  }
  crowd.count=c;crowd.instanceMatrix.needsUpdate=true;if(crowd.instanceColor)crowd.instanceColor.needsUpdate=true;scene.add(crowd);
  const banner=textPanel('GOLINGO  •  LEARN BY PLAYING',20,2.15,'#062a31','#ddfaab');banner.position.set(0,5.45,-28.42);scene.add(banner);
  for(const [message,x,z,rot] of [['GOLINGOAPP.COM',-9.95,-2,Math.PI/2],['SPEAK • PLAY • REPEAT',9.95,-2,-Math.PI/2]]){
    const b=textPanel(message,16,.95,'#0c5352','#dcffe5');b.position.set(x,.67,z);b.rotation.y=rot;scene.add(b);
  }
  const backAd=textPanel('TENNIS ACADEMY   ·   LANGUAGE DRILLS',12,.73,'#0d474a','#bfe5ce');backAd.position.set(0,.73,-15.45);scene.add(backAd);
  for(const x of [-19,19])for(const z of [-15,13]){
    cyl(scene,.16,.21,12.3,createMaterial('#1d383c',.7,.2),x,6.14,z);
    const lamp=box(scene,3.25,.36,.88,new THREE.MeshBasicMaterial({color:'#edffde'}),x,12.44,z);
    const light=new THREE.PointLight('#d8ffeb',75,36,2);light.position.set(x,12.2,z);scene.add(light);
    lamp.castShadow=false;
  }
  // Ball cart and cones anchor the reference video’s training-ground feel.
  const basket=new THREE.Group();basket.position.set(-7.6,0,-12.6);
  const basketMat=createMaterial('#0e3e40',.55,.45);box(basket,1.18,.75,.75,basketMat,0,.69,0);
  for(const x of [-.45,.45])for(const z of [-.3,.3])sphere(basket,.13,createMaterial('#171f25'),x,.18,z);
  for(let i=0;i<13;i++)sphere(basket,.12,createMaterial('#ddf95b',.65),random(-.46,.46),1.12+random(-.08,.1),random(-.22,.22),10);
  scene.add(basket);
  for(let i=0;i<7;i++){
    const cone=new THREE.Mesh(new THREE.ConeGeometry(.23,.64,9),createMaterial('#efc54e',.9));cone.position.set(-4.55+i*1.48,.36,-8.0);cone.castShadow=true;scene.add(cone);
    cyl(scene,.16,.18,.065,createMaterial('#faf9e0'),cone.position.x,.26,cone.position.z,9);
  }
}

function makeRacket() {
  const g=new THREE.Group();const frame=createMaterial('#f9ffda',.4,.55),grip=createMaterial('#192b34',.95),strings=new THREE.LineBasicMaterial({color:'#d8f9e1',transparent:true,opacity:.72});
  cyl(g,.045,.052,.48,grip,0,-.24,0,10);
  const oval=[];for(let i=0;i<=40;i++){const a=i/40*Math.PI*2;oval.push(new THREE.Vector3(Math.cos(a)*.285,-.89+Math.sin(a)*.42,0));}
  tube(g,oval,.029,frame,80);
  const linePts=[];
  for(let x=-.225;x<=.226;x+=.075){const k=Math.sqrt(Math.max(0,1-x*x/(.285*.285)));linePts.push(x,-.89-.42*k,0,x,-.89+.42*k,0);}
  for(let y=-1.22;y<=-.56;y+=.095){const yy=(y+.89)/.42,span=.282*Math.sqrt(Math.max(0,1-yy*yy));linePts.push(-span,y,0,span,y,0);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(linePts,3));g.add(new THREE.LineSegments(geo,strings));g.rotation.x=-.38;g.rotation.z=-.25;return g;
}

function createTennisPlayer(colors,isOpponent=false) {
  const g=new THREE.Group();
  const shirt=createMaterial(colors.shirt,.91),shorts=createMaterial(colors.shorts,.93),skin=createMaterial(colors.skin,.93),hair=createMaterial(colors.hair,.95),shoes=createMaterial('#eaf8f5',.88),band=createMaterial(colors.band,.9);
  // Torso, shoulders, head, collar and trim.
  const chest=new THREE.Mesh(new THREE.CapsuleGeometry(.40,.62,6,12),shirt);chest.position.y=1.61;chest.scale.set(1.12,1.03,.75);chest.castShadow=true;g.add(chest);
  cyl(g,.21,.20,.1,skin,0,2.21,0);
  sphere(g,.32,skin,0,2.49,-.015,20);
  const hairTop=sphere(g,.32,hair,0,2.65,.055,18);hairTop.scale.set(1,.52,.90);
  const hairBack=sphere(g,.265,hair,0,2.53,.20,16);hairBack.scale.set(1.04,.7,.51);
  if(!isOpponent){const visor=box(g,.55,.065,.29,band,0,2.72,-.23);visor.castShadow=false;}
  for(const x of [-.115,.115])sphere(g,.027,createMaterial('#2e3d3c',1),x,2.50,-.298,8);
  const smile=new THREE.Mesh(new THREE.TorusGeometry(.07,.009,4,16,Math.PI),new THREE.MeshBasicMaterial({color:'#986b5d'}));smile.position.set(0,2.36,-.305);smile.rotation.z=Math.PI;g.add(smile);
  box(g,.13,.57,.045,band,0,1.65,-.338);
  box(g,.78,.12,.40,shorts,0,1.125,0);
  const legs=[];
  for(const side of [-1,1]){
    const pivot=new THREE.Group();pivot.position.set(side*.235,1.13,0);g.add(pivot);
    cyl(pivot,.16,.13,.60,skin,0,-.32,0);
    cyl(pivot,.095,.095,.38,shoes,0,-.77,-.02);
    const foot=box(pivot,.23,.17,.48,shoes,0,-.99,-.13);foot.castShadow=true;
    legs.push(pivot);
  }
  const arms=[];
  for(const side of [-1,1]){
    const pivot=new THREE.Group();pivot.position.set(side*.55,1.98,0);g.add(pivot);
    cyl(pivot,.135,.12,.58,shirt,0,-.28,0);
    sphere(pivot,.118,skin,0,-.59,0,10);
    cyl(pivot,.095,.09,.39,skin,0,-.82,0);
    sphere(pivot,.105,skin,0,-1.03,0,10);
    pivot.rotation.z=side*.13;
    arms.push(pivot);
  }
  const racket=makeRacket();racket.position.set(.035,-1.03,-.035);arms[1].add(racket);
  g.userData={legs,arms,racket,walkTime:0,hitTime:0,hitType:'forehand',initialZ:isOpponent?-8.5:9.05};
  g.position.set(0,0,isOpponent?-8.5:9.05);
  if(isOpponent)g.rotation.y=Math.PI;
  scene.add(g);return g;
}
function createBallMachine(){
  const machine=new THREE.Group();
  machine.position.set(0,0,-11.55);
  machine.userData={feedSpin:0,feedPulse:0};
  scene.add(machine);
  return machine;
}

function createBall() {
  ball=new THREE.Group();
  const fuzz=createMaterial('#dfff54',.88);
  sphere(ball,.172,fuzz,0,0,0,20);
  const seamMat=new THREE.MeshBasicMaterial({color:'#f7ffad'});
  for(const a of [-.53,.53]){
    const vertices=[];
    for(let k=0;k<=44;k++){
      const t=k/44*Math.PI*2;
      const x=.173*Math.cos(t)*Math.cos(a),y=.173*Math.sin(t),z=.173*Math.cos(t)*Math.sin(a);
      vertices.push(new THREE.Vector3(x,y,z));
    }
    tube(ball,vertices,.008,seamMat,56);
  }
  scene.add(ball);
  const sh=new THREE.Mesh(new THREE.CircleGeometry(.3,32),new THREE.MeshBasicMaterial({color:'#001a1b',transparent:true,opacity:.30,depthWrite:false}));
  sh.rotation.x=-Math.PI/2;sh.position.y=.13;scene.add(sh);ballShadow=sh;
  for(let i=0;i<10;i++){
    const trail=new THREE.Mesh(new THREE.SphereGeometry(.09*(1-i/12),8,6),new THREE.MeshBasicMaterial({color:i%2?'#b1ff6d':'#f0ff98',transparent:true,opacity:.40*(1-i/11),depthWrite:false}));
    trail.visible=false;scene.add(trail);ballTrail.push(trail);
  }
}

function buildWorld() {
  const canvas=$('scene');
  usesCanvasFallback=true;
  fallbackContext=canvas.getContext('2d',{alpha:false});
  if(!fallbackContext)throw new Error('Tennis canvas is not available');
  renderer={setSize(w,h){
    const dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));
    canvas.style.width=w+'px';canvas.style.height=h+'px';
  },render:renderCanvasFallback};
  scene=new THREE.Scene();
  scene.background=new THREE.Color('#152a31');
  scene.fog=new THREE.FogExp2('#193339',.014);
  camera=new THREE.PerspectiveCamera(45,1,.1,180);
  const ambient=new THREE.HemisphereLight('#cbf6ea','#42563e',2.55);scene.add(ambient);
  const sun=new THREE.DirectionalLight('#ffdfb4',3.3);sun.position.set(-10,22,13);
  sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-20;sun.shadow.camera.right=20;sun.shadow.camera.top=20;sun.shadow.camera.bottom=-20;
  sun.shadow.normalBias=.015;sun.shadow.bias=-.00012;scene.add(sun);
  const rim=new THREE.DirectionalLight('#99ebde',1.9);rim.position.set(12,13,-12);scene.add(rim);
  // Retain the Three.js ball/court coordinates and drill physics; the visual
  // arena comes from a much more detailed, perspective-correct court plate.
  buildCourt();
  player=createTennisPlayer({shirt:'#117fba',shorts:'#e5f2e8',skin:'#dba982',hair:'#262e35',band:'#f2ffda'});
  opponent=createBallMachine();
  player.position.z=12.55;
  createBall();
  resize();
  window.addEventListener('resize',resize);
  window.addEventListener('orientationchange',()=>setTimeout(resize,150));
}

function resize() {
  if(!renderer)return;
  const w=window.innerWidth,h=window.innerHeight,a=w/h;
  renderer.setSize(w,h,false);camera.aspect=a;
  if(a<.75){camera.fov=58;camera.position.set(0,28.5,39.8);}
  else if(a<1.2){camera.fov=50;camera.position.set(0,23.5,33.5);}
  else if(a>2.1){camera.fov=45;camera.position.set(0,24.7,32.5);}
  else{camera.fov=44;camera.position.set(0,21.5,30.7);}
  camera.lookAt(0,.1,-1.3);camera.updateProjectionMatrix();
  const c=$('confetti');c.width=Math.max(1,Math.floor(w*window.devicePixelRatio));c.height=Math.max(1,Math.floor(h*window.devicePixelRatio));
  c.style.width=w+'px';c.style.height=h+'px';
}

function pickDistinctIndices(total,excluded,count) {
  const pool=[];for(let i=0;i<total;i++)if(i!==excluded)pool.push(i);
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  return pool.slice(0,count);
}

function currentQuestion() {return deck[questionIndex%deck.length];}
function getTargetPoint(index,shot=selectedShot) {
  return new THREE.Vector3(aimX,.15,shotInfo[shot].targetZ);
}
function buildTargetButtons() {
  $('targetLayer').replaceChildren();
  for(let i=0;i<3;i++){
    const btn=document.createElement('button');btn.type='button';btn.className='word-target';
    const number=document.createElement('span');number.className='target-number';number.textContent=String(i+1);
    const targetWord=document.createElement('span');targetWord.className='target-word';
    const hint=document.createElement('span');hint.className='target-hint';hint.textContent='TAP TO AIM';
    btn.append(number,targetWord,hint);
    btn.addEventListener('click',()=>chooseTarget(i));
    $('targetLayer').append(btn);targetButtons.push(btn);
  }
}
function newQuestion(announce=true) {
  if(!deck.length)return;
  choices=[questionIndex%deck.length];selectedChoice=0;
  const question=currentQuestion();
  const target=showWords?question.word:'••••';
  $('question').textContent=`${question.translation}  →  ${target}`;
  updateDrillUI();
  updateTargets();
  if(announce && started && !paused)speakPrompt();
}
function updateTargets() {
  targetButtons.forEach((btn,i)=>btn.style.display='none');
  targetRings.forEach((ring,i)=>{
    ring.visible=i===0;
    if(i!==0)return;
    const center=getTargetPoint(0);ring.position.set(center.x,0,center.z);
    ring.userData.ring.material.color.set('#faff72');
    ring.userData.glow.material.color.set('#f7de5a');
  });
  $('aimIndicator').textContent='TAP FAR COURT TO AIM · SWING TO HIT';
}
function chooseTarget(i) {
  if(!started||paused)return;
  aimX=clamp(shootPositions[i]??0,-4.1,4.1);updateTargets();
  setStatus('Aim adjusted · tap SWING to hit the ball');
}
function selectShot(shot) {
  if(!shotInfo[shot])return;
  if(powerCharging||autoCharging)cancelPowerCharge();
  const changed=selectedShot!==shot;
  selectedShot=shot;
  setShotMenuOpen(false);
  document.querySelectorAll('.shot').forEach(el=>{
    const chosen=el.dataset.shot===shot;el.classList.toggle('selected',chosen);el.setAttribute('aria-pressed',String(chosen));
  });
  aimZ=shotInfo[shot].targetZ;
  if(changed && started){
    drillHits=0;drillMisses=0;queuedSwing=false;flight=null;pendingStroke=null;trailHistory.length=0;
    returnMarker.visible=false;
    if(shot==='serve')startNewServe(false);
    else{phase='between';nextReturn=.95;ball.visible=false;}
    speakPrompt();
  }
  updateTargets();
  if(!powerCharging&&!autoCharging)$('swingHint').textContent=shot==='serve'?'HOLD FOR POWER · RELEASE TO SERVE':'HOLD FOR POWER · RELEASE TO HIT';
  updateDrillUI();
  if(started && !paused)setStatus(shot==='serve'?'Serve drill · tap SWING to serve':`${shotInfo[shot].name} drill · ball machine starting…`);
}
function updateDrillUI(){
  const label=selectedShot==='drop'?'DROP SHOT':selectedShot.toUpperCase();
  $('nextDrillBtn').innerHTML='Next <span>›</span>';
  $('shotMenuLabel').textContent=shotInfo[selectedShot].name;
  $('shotMenuBtn').setAttribute('aria-label',`Choose tennis shot, currently ${shotInfo[selectedShot].name}`);
  $('questionSub').textContent=`${label} DRILL  ·  ${drillHits} / 5 SHOTS`;
}
function setShotMenuOpen(open) {
  const menu=$('shotPicker'),toggle=$('shotMenuBtn');
  if(!menu||!toggle)return;
  menu.classList.toggle('open',open);
  toggle.setAttribute('aria-expanded',String(open));
}
function updatePowerMeter(power,active=false) {
  const percent=Math.round(clamp(power,0,1)*100);
  $('powerText').textContent=`POWER ${percent}%`;
  $('swingBtn').style.setProperty('--charge-angle',`${Math.round(percent*3.6)}deg`);
  $('swingBtn').classList.toggle('charging',active);
  if(active)$('swingHint').textContent=`CHARGING · ${percent}%`;
  else $('swingHint').textContent=selectedShot==='serve'?'HOLD FOR POWER · RELEASE TO SERVE':'HOLD FOR POWER · RELEASE TO HIT';
}
function cancelPowerCharge() {
  powerCharging=false;autoCharging=false;chargePointerId=null;
  updatePowerMeter(hitPower,false);
}
function completePowerCharge() {
  if(!powerCharging&&!autoCharging)return;
  powerCharging=false;autoCharging=false;chargePointerId=null;
  updatePowerMeter(hitPower,false);
  hitNow();
}
function updatePowerCharge(now) {
  if(!powerCharging&&!autoCharging)return;
  const elapsed=Math.max(0,(now-pressStarted)/1000);
  hitPower=.30+.70*smooth(clamp(elapsed/1.38,0,1));
  updatePowerMeter(hitPower,true);
  if(autoCharging && elapsed>=.82)completePowerCharge();
}
function setStatus(message){$('statusText').textContent=message;}
function showFeedback(title,sub,isBad=false) {
  const box=$('feedback');$('feedbackTitle').textContent=title;$('feedbackSub').textContent=sub;
  box.classList.toggle('bad',isBad);box.classList.add('show');feedbackTimer=performance.now()+1700;
}
function toast(message) {
  const el=$('toast');el.textContent=message;el.classList.add('show');toastTimer=performance.now()+2300;
}
function updateScore() {
  $('points').textContent=String(points).padStart(3,'0');
  $('accuracy').textContent=((hits+misses)?Math.round(100*hits/(hits+misses)):0)+'%';
  $('streak').textContent=String(streak);
}

function beep(freq=500,duration=.12,type='sine',gain=.1) {
  if(!soundEnabled || !started)return;
  try{
    if(!audioContext)audioContext=new (window.AudioContext||window.webkitAudioContext)();
    if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
    const o=audioContext.createOscillator(),amp=audioContext.createGain(),now=audioContext.currentTime;
    o.type=type;o.frequency.setValueAtTime(freq,now);o.frequency.exponentialRampToValueAtTime(Math.max(80,freq*.54),now+duration);
    amp.gain.setValueAtTime(.0001,now);amp.gain.exponentialRampToValueAtTime(gain,now+.013);
    amp.gain.exponentialRampToValueAtTime(.0001,now+duration);
    o.connect(amp);amp.connect(audioContext.destination);o.start(now);o.stop(now+duration+.02);
  }catch(error){/* sound is optional */}
}
function speak(value,language=learningLanguage,interrupt=false) {
  if(!speechEnabled || !('speechSynthesis' in window) || !value || !started)return;
  try{
    if(interrupt)window.speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(String(value).slice(0,280));
    utterance.lang=locales[language]||language||'en-US';utterance.rate=.84;utterance.pitch=1.03;utterance.volume=.94;
    window.speechSynthesis.speak(utterance);
  }catch(error){/* TTS may be disabled by the device */}
}
function speakWordItem(item,interrupt=true){
  if(!item||!speechEnabled)return;
  const supplied=typeof item.audioUrl==='string'?item.audioUrl:item.audioUrl?.url;
  if(supplied && /^(https?:\/\/|data:audio\/)/i.test(supplied)){
    try{
      if(interrupt){window.speechSynthesis?.cancel();activeWordAudio?.pause();}
      const audio=new Audio(supplied);activeWordAudio=audio;
      audio.onended=()=>{if(item.sentence)speak(item.sentence,learningLanguage,true);};
      audio.play().catch(()=>{speak(item.word,learningLanguage,true);if(item.sentence)speak(item.sentence,learningLanguage,false);});
      return;
    }catch(error){/* TTS fallback below */}
  }
  speak(item.word,learningLanguage,interrupt);
  if(item.sentence)speak(item.sentence,learningLanguage,false);
}
function speakPrompt() {
  const item=currentQuestion();if(item)speak(item.translation,primaryLanguage,true);
}
function speakAnswer(item,correct) {
  if(!item)return;
  if(correct){
    speakWordItem(item,true);
  }else{
    speak(`Try again. Find ${currentQuestion().translation}`,primaryLanguage,true);
  }
}

function resetBallToServer() {
  ball.visible=true;ball.position.set(player.position.x+.30,1.35,player.position.z-.4);
  ballShadow.position.set(ball.position.x,.13,ball.position.z);
  ballTrail.forEach(t=>t.visible=false);
}
function startNewServe(renewQuestion=false) {
  flight=null;pendingStroke=null;phase='serve';queuedSwing=false;rallyCount=0;nextReturn=0;
  playerVelocity.x=0;playerVelocity.z=0;
  player.position.z=12.55;opponent.position.z=-11.55;
  if(renewQuestion)newQuestion(false);
  resetBallToServer();returnMarker.visible=false;
  setStatus('READY TO SERVE · tap SWING to hit');
}
function makeFlight(from,to,arc,duration,kind,extra={}) {
  const f={from:from.clone(),to:to.clone(),arc,duration,kind,t:0,...extra};
  flight=f;phase=kind==='outgoing'?'outgoing':'incoming';ball.visible=true;
  return f;
}
function hitNow() {
  if(!started || paused)return;
  if(!firstAudioGesture){
    firstAudioGesture=true;
    try{if(!audioContext)audioContext=new (window.AudioContext||window.webkitAudioContext)();audioContext?.resume();}catch(error){}
    speakPrompt();
  }
  if(phase==='windup')return;
  if(phase==='serve'){
    launchPlayerShot();return;
  }
  if(phase==='incoming'){
    const t=flight?flight.t/flight.duration:0;
    if(t<.75){queuedSwing=true;setStatus('SWING READY · watching the bounce…');beep(640,.07);return;}
    if(t<1.04){
      const distance=Math.hypot(ball.position.x-player.position.x,ball.position.z-player.position.z);
      if(distance<5.1 || movementAssist){launchPlayerShot();return;}
      toast('Move closer to the ball with the joystick');return;
    }
  }
  if(phase==='between'){
    queuedSwing=true;setStatus('SWING READY · ball coming from the machine');return;
  }
  if(phase==='outgoing'){setStatus('Watch where your shot lands…');return;}
  toast('Tap SWING when the ball approaches your racket');
}
function launchPlayerShot() {
  if(!deck.length)return;
  const serving=phase==='serve',shot=selectedShot;
  pendingStroke={serving,shot,windup:serving?.52:shot==='lob'?.46:shot==='drop'?.43:.43,elapsed:0};
  phase='windup';flight=null;
  swingType=shot;
  player.userData.hitDuration=serving?1.17:shot==='lob'?1.13:shot==='backhand'?1.02:1.0;
  player.userData.hitTime=player.userData.hitDuration;
  player.userData.hitType=shot;
  queuedSwing=false;rallyCount++;returnMarker.visible=false;
  ball.visible=true;
  setStatus(serving?'TOSS THE BALL · LOAD THE SERVE':`${shotInfo[shot].name.toUpperCase()} · PREPARE THE RACKET`);
}
function commitPlayerShot(stroke) {
  const launch=new THREE.Vector3(player.position.x+(stroke.shot==='backhand'?-.19:.25),stroke.serving?2.70:1.58,player.position.z-.78);
  const target=getTargetPoint(0,selectedShot);
  const spec=shotInfo[stroke.shot];
  const p=hitPower;
  const powerFactor=lerp(1.25,.75,p);
  const to=new THREE.Vector3(target.x,.18,target.z);
  makeFlight(launch,to,spec.arc*(.9+.2*p),spec.time*powerFactor,'outgoing',{
    choice:0,correctIndex:questionIndex%deck.length,shot:stroke.shot,word:currentQuestion(),aimPosition:0
  });
  pendingStroke=null;trailHistory.length=0;
  beep(195,.13,'triangle',.15);setTimeout(()=>beep(390,.045,'sine',.028),70);
  setStatus(`${spec.name.toUpperCase()} · ball in flight…`);
  $('powerText').textContent=`POWER ${Math.round(p*100)}%`;
}
function updatePendingStroke(dt) {
  if(!pendingStroke)return;
  const s=pendingStroke;s.elapsed+=dt;
  const t=clamp(s.elapsed/s.windup,0,1),x=player.position.x+(s.shot==='backhand'?-0.25:.27);
  const z=player.position.z-.45;
  ball.visible=true;
  if(s.serving){
    // A visible left-hand ball toss before the overhead contact frame.
    ball.position.set(player.position.x+lerp(-.26,.17,t),1.34+1.65*smooth(t),z-.11);
  }else{
    // Keep the arriving ball beside the hitting zone while the player loads.
    ball.position.set(lerp(ball.position.x,x,t*.35),1.12+Math.sin(t*Math.PI)*.26,z-.8);
  }
  ballShadow.position.set(ball.position.x,.13,ball.position.z);
  if(t>=1)commitPlayerShot(s);
}
function resolvePlayerShot(endingFlight) {
  const selectedWord=endingFlight.word;
  hits++;correctHits++;streak++;drillHits++;
  const speed=Math.round((endingFlight.shot==='serve'?88:endingFlight.shot==='lob'?46:endingFlight.shot==='drop'?31:66)*(.77+hitPower*.44));
  const gained=shotInfo[endingFlight.shot].score+Math.min(150,(streak-1)*10);
  points+=gained;
  collected.set(selectedWord.word.toLowerCase(),{...selectedWord,learned:true,lastShot:endingFlight.shot});
  showFeedback(drillHits%5===0?'SET COMPLETE!':`GOOD ${shotInfo[endingFlight.shot].name.toUpperCase()}!`,`${speed} mph · ${selectedWord.word} · +${gained} POINTS`);
  speakAnswer(selectedWord,true);beep(810,.17,'sine',.13);setTimeout(()=>beep(1120,.22,'sine',.11),130);
  burstAtTarget(getTargetPoint(0,endingFlight.shot));
  questionIndex=(questionIndex+1)%deck.length;newQuestion(false);
  setStatus(drillHits%5===0?'Five shots completed · tap NEXT DRILL or keep practicing':`NICE HIT · ${selectedWord.translation} means ${selectedWord.word}`);
  updateScore();
  phase='between';flight=null;nextReturn=drillHits%5===0?2.3:1.3;
  ball.visible=false;
}
function startOpponentReturn() {
  if(selectedShot==='serve'){startNewServe(false);return;}
  incomingTargetX=selectedShot==='forehand'?random(.9,2.5):selectedShot==='backhand'?random(-2.5,-.9):random(-2.5,2.5);
  const from=new THREE.Vector3(opponent.position.x+random(-.10,.10),1.52,opponent.position.z+.52);
  const bounce=new THREE.Vector3(incomingTargetX,.18,6.25);
  const to=new THREE.Vector3(incomingTargetX,.88,8.5);
  opponent.userData.feedPulse=1;
  makeFlight(from,to,1.65,2.65,'incoming',{bounce,bounced:false});
  returnMarker.position.set(incomingTargetX,.17,6.25);returnMarker.visible=true;
  setStatus(`${shotInfo[selectedShot].name.toUpperCase()} FEED · move into position and SWING`);
  if(firstAudioGesture)speakPrompt();
  beep(310,.10,'triangle',.075);
}
function missReturn() {
  flight=null;phase='between';queuedSwing=false;streak=0;misses++;drillMisses++;updateScore();
  returnMarker.visible=false;
  showFeedback('MISSED THE BALL','The machine will feed another',true);
  setStatus('TRY AGAIN · a new ball is coming');beep(164,.28,'triangle',.07);
  nextReturn=1.2;ball.visible=false;
}

const trailHistory=[];
function updateBall(dt) {
  if(!flight){
    if(phase==='serve')resetBallToServer();
    else if(phase==='between')ball.visible=false;
    return;
  }
  const f=flight;f.t+=dt*(f.kind==='incoming'&&(powerCharging||autoCharging)?.36:1);
  const t=clamp(f.t/f.duration,0,1);
  if(f.kind==='incoming'&&f.bounce){
    // A genuine tennis feed: clear the net, bounce near the service line, then rise to the racket.
    if(t<=.76){
      const q=t/.76;ball.position.lerpVectors(f.from,f.bounce,q);
      ball.position.y=lerp(f.from.y,.18,q)+4*f.arc*q*(1-q);
    }else{
      if(!f.bounced){f.bounced=true;beep(165,.075,'triangle',.075);}
      const q=(t-.76)/.24;ball.position.lerpVectors(f.bounce,f.to,q);
      ball.position.y=.18+4*.46*q*(1-q)+.70*q;
    }
  }else{
    ball.position.lerpVectors(f.from,f.to,t);
    ball.position.y=lerp(f.from.y,f.to.y,t)+4*f.arc*t*(1-t);
  }
  ball.rotation.x+=dt*15;ball.rotation.y+=dt*11;
  ballShadow.position.set(ball.position.x,.13,ball.position.z);
  ballShadow.scale.setScalar(1+ball.position.y*.21);
  ballShadow.material.opacity=clamp(.36-ball.position.y*.043,.045,.32);
  trailHistory.unshift(ball.position.clone());if(trailHistory.length>15)trailHistory.length=15;
  ballTrail.forEach((s,i)=>{const prev=trailHistory[i+1];s.visible=!!prev;if(prev)s.position.copy(prev);});
  if(f.kind==='incoming'){
    if(queuedSwing && t>.77 && (movementAssist||Math.hypot(player.position.x-ball.position.x,player.position.z-ball.position.z)<5.1)){
      launchPlayerShot();return;
    }
    if(t>.71 && t<1) $('swingBtn').classList.add('ready');
    else $('swingBtn').classList.remove('ready');
  }
  if(t>=1){
    $('swingBtn').classList.remove('ready');
    if(f.kind==='outgoing'){beep(145,.065,'triangle',.06);resolvePlayerShot(f);}
    else missReturn();
  }
}
function updatePlayerMovement(dt) {
  const rawX=joystickMovement.x+(keyMovement.right?1:0)-(keyMovement.left?1:0);
  const rawZ=joystickMovement.z+(keyMovement.down?1:0)-(keyMovement.up?1:0);
  const mag=Math.hypot(rawX,rawZ);
  let mx=mag>.01?rawX/Math.max(1,mag):0,mz=mag>.01?rawZ/Math.max(1,mag):0;
  const manual=mag>.04;
  const assisted=!manual && movementAssist && phase==='incoming';
  const desiredX=manual?mx*6.65:assisted?clamp((incomingTargetX-player.position.x)*3,-4.5,4.5):0;
  const desiredZ=manual?mz*5.9:assisted?clamp((9.85-player.position.z)*2.8,-3.2,3.2):0;
  const easing=clamp(dt*(manual?8.5:5.5),0,1);
  playerVelocity.x=lerp(playerVelocity.x,desiredX,easing);
  playerVelocity.z=lerp(playerVelocity.z,desiredZ,easing);
  player.position.x=clamp(player.position.x+playerVelocity.x*dt,-4.52,4.52);
  player.position.z=clamp(player.position.z+playerVelocity.z*dt,7.0,14.6);
  const playerMotion=clamp(Math.hypot(playerVelocity.x/6.65,playerVelocity.z/5.9),0,1);
  animateAthlete(player,dt,playerMotion);
  opponent.userData.feedSpin+=dt*(4+opponent.userData.feedPulse*17);
  opponent.userData.feedPulse=Math.max(0,opponent.userData.feedPulse-dt*1.65);
}
function animateAthlete(actor,dt,walking) {
  const rig=actor.userData;
  rig.walkStrength=lerp(rig.walkStrength||0,walking,clamp(dt*7,0,1));
  rig.walkTime+=dt*(rig.walkStrength>.05?9.1:1.5);
  const stride=Math.sin(rig.walkTime)*rig.walkStrength;
  rig.legs[0].rotation.x=stride*.43;rig.legs[1].rotation.x=-stride*.43;
  rig.legs[0].rotation.z=-.05;rig.legs[1].rotation.z=.05;
  actor.position.y=rig.walkStrength*.032*Math.abs(Math.sin(rig.walkTime));
  rig.arms[0].rotation.x=-stride*.15;rig.arms[0].rotation.z=.18;
  rig.arms[1].rotation.x=stride*.14;rig.arms[1].rotation.z=-.19;
  rig.racket.rotation.z=-.22;rig.racket.rotation.x=-.39;
  if(rig.hitTime>0){
    rig.hitTime=Math.max(0,rig.hitTime-dt);
    const p=clamp(1-rig.hitTime/(rig.hitDuration||.55),0,1);
    const swing=Math.sin(p*Math.PI);
    const back=rig.hitType==='backhand';
    rig.arms[1].rotation.z=back?-.22+1.65*swing:-.18-1.4*swing;
    rig.arms[1].rotation.x=-.65-1.05*swing;
    rig.arms[0].rotation.x=-.15-.15*swing;
    rig.racket.rotation.z=(back?-.4:.45)*swing;
    if(rig.hitType==='serve')rig.arms[1].rotation.x=-2.65*swing;
    else if(rig.hitType==='lob')rig.arms[1].rotation.x=-1.1-1.35*swing;
    else if(rig.hitType==='drop')rig.arms[1].rotation.x=-.2-.55*swing;
  }
}
function positionTargetButtons() {
  if(!camera)return;
  const w=window.innerWidth,h=window.innerHeight;
  for(let i=0;i<targetButtons.length;i++){
    if(i>=choices.length)continue;
    const center=getTargetPoint(i);
    const anchor=usesCanvasFallback?projectFallback(center.x,center.z,1.85):new THREE.Vector3(center.x,1.55,center.z).project(camera);
    let x=usesCanvasFallback?anchor.x:(anchor.x*.5+.5)*w,y=usesCanvasFallback?anchor.y:(-anchor.y*.5+.5)*h;
    // Keep a target visible inside narrow portrait browser viewports.
    x=clamp(x,43,w-43);y=clamp(y,Math.min(h*.30,125),h*.69);
    targetButtons[i].style.left=`${x}px`;targetButtons[i].style.top=`${y}px`;
  }
}
function updateTargetRings(dt) {
  targetRings.forEach((ring,i)=>{
    if(i>=choices.length)return;
    const active=i===selectedChoice;
    const pulse=.5+.5*Math.sin(elapsed*(active?5.4:2.2)+i*1.7);
    ring.userData.glow.material.opacity=active?.23+pulse*.10:.08+pulse*.06;
    ring.userData.ring.material.opacity=active?.85+pulse*.15:.48+pulse*.20;
    const scl=active?1.13+.045*pulse:.99+.06*pulse;
    ring.scale.set(scl,1,scl);
  });
  if(returnMarker.visible){const pulse=1+.13*Math.sin(elapsed*7);returnMarker.scale.set(pulse,1,pulse);}
}
function burstAtTarget(p) {
  const point=usesCanvasFallback?projectFallback(p.x,p.z,1.15):p.clone().add(new THREE.Vector3(0,1.15,0)).project(camera);
  const x=usesCanvasFallback?point.x:(point.x*.5+.5)*window.innerWidth,y=usesCanvasFallback?point.y:(-point.y*.5+.5)*window.innerHeight;
  for(let i=0;i<45;i++)particles.push({x,y,vx:random(-180,180),vy:random(-210,-35),life:random(.65,1.25),maxLife:1.25,
    color:['#e4fd76','#48ffc6','#d8fff4','#ffdd7c','#76d5ff'][i%5],size:random(2,6),spin:random(-7,7),angle:random(0,6.28)});
}
function updateConfetti(dt) {
  const c=$('confetti');if(!c.width)return;
  const context=c.getContext('2d'),dpr=window.devicePixelRatio||1;
  context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,c.width,c.height);context.setTransform(dpr,0,0,dpr,0,0);
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue;}
    p.vy+=dt*215;p.x+=p.vx*dt;p.y+=p.vy*dt;p.angle+=p.spin*dt;
    context.globalAlpha=Math.min(1,p.life/.45);context.fillStyle=p.color;context.save();context.translate(p.x,p.y);context.rotate(p.angle);context.fillRect(-p.size/2,-p.size/3,p.size,p.size*.72);context.restore();
  }
  context.globalAlpha=1;
}
function updateUIClock(now) {
  if(feedbackTimer && now>feedbackTimer){$('feedback').classList.remove('show');feedbackTimer=0;}
  if(toastTimer && now>toastTimer){$('toast').classList.remove('show');toastTimer=0;}
}
function tick() {
  requestAnimationFrame(tick);
  const dt=Math.min(.04,worldClock.getDelta());
  elapsed+=dt;
  if(started&&!paused)updatePowerCharge(performance.now());
  if(started && !paused){
    updatePlayerMovement(dt);
    if(pendingStroke)updatePendingStroke(dt);
    else updateBall(dt);
    if(phase==='between' && nextReturn>0){nextReturn-=dt;if(nextReturn<=0){nextReturn=0;startOpponentReturn();}}
  }else{
    animateAthlete(player,dt*.4,0);
    if(!started && ball)resetBallToServer();
  }
  updateTargetRings(dt);
  positionTargetButtons();
  updateConfetti(dt);
  updateUIClock(performance.now());
  renderer.render(scene,camera);
}

function courtView() {
  const w=window.innerWidth,h=window.innerHeight,aspect=1672/941;
  if(w/h<1.25)return {x:0,y:0,w,h}; // Portrait remains playable; rotate for true court proportions.
  const width=Math.min(w,h*aspect),height=width/aspect;
  return {x:(w-width)/2,y:(h-height)/2,w:width,h:height};
}
function projectFallback(x,z,height=0) {
  // Calibrated against the recorded court: far baseline at 17.5%, near at 88%,
  // and the net at 43%. Quadratic perspective also tracks the court sidelines.
  const view=courtView(),depth=clamp((z+12)/25,0,1.1);
  const half=.235+.00755*z+.00049*z*z;
  const floorY=.43+.02974*z+.000697*z*z;
  const heightScale=.059+.028*depth;
  return {x:view.x+view.w*(.5+(x/5.485)*half),y:view.y+view.h*(floorY-height*heightScale),depth,scale:.50+.50*depth};
}
function imageIsReady(img) {return img.complete && img.naturalWidth>0;}
function drawAtlasFrame(c,actor,pose,alpha=1,opposing=false,motion=null) {
  const image=pose.special?athleteSpecial:athleteActions;
  if(!imageIsReady(image))return false;
  const p=projectFallback(actor.position.x,actor.position.z),view=courtView();
  const cols=pose.special?2:4,rows=2,cw=image.naturalWidth/cols,ch=image.naturalHeight/rows;
  const sx=(pose.index%cols)*cw,sy=Math.floor(pose.index/cols)*ch;
  const baseHeight=Math.min(view.h*.34*(opposing?.39+.23*p.depth:.54+.46*p.depth),view.w*.34);
  const width=baseHeight*cw/ch;
  const walking=actor.userData.walkStrength||0;
  const sway=Math.sin(actor.userData.walkTime)*walking;
  const m=motion||{x:0,y:0,tilt:0,scale:1};
  c.save();c.globalAlpha=alpha;
  c.translate(p.x+sway*view.w*.0025+view.h*m.x,p.y-(actor.position.y||0)*view.h*.045-view.h*m.y);
  c.rotate(sway*.017+m.tilt);
  c.scale(1,m.scale);
  c.shadowColor='#090e0b90';c.shadowBlur=opposing?3:5;c.shadowOffsetY=0;
  if(opposing)c.filter='hue-rotate(-78deg) saturate(.65) brightness(.76)';
  c.drawImage(image,sx,sy,cw,ch,-width*.5,-baseHeight*.958,width,baseHeight);
  c.restore();return true;
}
function drawPhotorealPlayer(c,actor,opposing=false) {
  const p=projectFallback(actor.position.x,actor.position.z),view=courtView();
  const width=view.h*(opposing?.032:.078)*(.62+.38*p.depth);
  c.fillStyle=opposing?'#10171170':'#080e0b8b';
  c.beginPath();c.ellipse(p.x,p.y+2,width,Math.max(2,width*.17),0,0,2*Math.PI);c.fill();
  const rig=actor.userData,progress=clamp(1-rig.hitTime/(rig.hitDuration||.72),0,1);
  const main=(index)=>({special:false,index}),special=(index)=>({special:true,index});
  const ready=opposing||selectedShot!=='serve'?special(3):main(0);
  let sequence;
  if(opposing)sequence=[ready,main(4),main(5),special(0),ready];
  else if(rig.hitType==='serve')sequence=[main(0),main(1),main(2),main(3),ready];
  else if(rig.hitType==='forehand')sequence=[ready,main(4),main(5),main(5),ready];
  else if(rig.hitType==='backhand')sequence=[ready,main(6),main(6),special(0),ready];
  else if(rig.hitType==='drop')sequence=[ready,main(4),special(1),special(1),ready];
  else if(rig.hitType==='lob')sequence=[ready,main(7),special(2),main(7),ready];
  else sequence=[ready];
  if(!rig.hitTime){
    if(!drawAtlasFrame(c,actor,ready,1,opposing))drawFallbackPerson(c,actor,opposing);
    return;
  }
  const time=[0,.22,.45,.72,1];
  let segment=0;while(segment<3 && progress>time[segment+1])segment++;
  const u=clamp((progress-time[segment])/(time[segment+1]-time[segment]),0,1);
  const t=smooth(clamp((u-.25)/.75,0,1));
  const impulse=Math.sin(Math.PI*progress),sign=rig.hitType==='backhand'?-1:1;
  const serve=rig.hitType==='serve';
  const motion={x:sign*.017*Math.sin(Math.PI*progress*1.6),y:(serve?.028:.010)*impulse*impulse,
    tilt:(serve?-.072:sign*.045)*Math.sin(progress*Math.PI*1.7),scale:1+(serve?.025:.014)*impulse};
  if(!drawAtlasFrame(c,actor,sequence[segment],1-t,opposing,motion))drawFallbackPerson(c,actor,opposing);
  if(t>.002)drawAtlasFrame(c,actor,sequence[segment+1],t,opposing,motion);
}
function drawPhotorealCourt(c,w,h) {
  const view=courtView();
  c.fillStyle='#110f0d';c.fillRect(0,0,w,h);
  c.drawImage(courtPlate,view.x,view.y,view.w,view.h);
  // The video has subtle animated target and player shadows on top of the
  // otherwise stationary architectural scene.
  drawFallbackRings(c);
  drawBallMachine(c,opponent,projectFallback,view,elapsed);
  drawPhotorealPlayer(c,player,false);
  if(ball.visible)drawFallbackBall(c);
  const rim=c.createLinearGradient(view.x,view.y,view.x,view.y+view.h);
  rim.addColorStop(0,'#01090817');rim.addColorStop(.48,'#ffffff00');rim.addColorStop(1,'#0207062b');
  c.fillStyle=rim;c.fillRect(view.x,view.y,view.w,view.h);
}
function drawFallbackPolygon(context,points,fill,stroke=null,lineWidth=1) {
  context.beginPath();points.forEach((p,i)=>{if(i===0)context.moveTo(p.x,p.y);else context.lineTo(p.x,p.y);});context.closePath();
  if(fill){context.fillStyle=fill;context.fill();}
  if(stroke){context.strokeStyle=stroke;context.lineWidth=lineWidth;context.stroke();}
}
function drawFallbackWorldRect(c,x1,x2,z1,z2,fill,stroke=null,width=1) {
  drawFallbackPolygon(c,[projectFallback(x1,z1),projectFallback(x2,z1),projectFallback(x2,z2),projectFallback(x1,z2)],fill,stroke,width);
}
function drawFallbackWorldLine(c,x1,z1,x2,z2,stroke='#dcf4dd',width=2) {
  const a=projectFallback(x1,z1),b=projectFallback(x2,z2);
  c.strokeStyle=stroke;c.lineWidth=width;c.lineCap='round';c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();
}
function drawFallbackRings(c) {
  for(let i=0;i<choices.length;i++){
    const v=getTargetPoint(i),p=projectFallback(v.x,v.z);
    const active=i===selectedChoice;
    const radius=clamp(10+19*p.scale,13,29)*(active?1.13:1);
    const glow=c.createRadialGradient(p.x,p.y,1,p.x,p.y,radius*1.8);
    glow.addColorStop(0,active?'#e9ff8280':'#8bfed342');glow.addColorStop(1,'#46f9b600');
    c.fillStyle=glow;c.beginPath();c.ellipse(p.x,p.y,radius*1.8,radius*.75,0,0,Math.PI*2);c.fill();
    c.strokeStyle=active?'#efff8f':'#91fbe0';c.lineWidth=active?3:2;c.setLineDash(active?[]:[5,4]);
    c.beginPath();c.ellipse(p.x,p.y,radius,radius*.29,0,0,Math.PI*2);c.stroke();c.setLineDash([]);
    c.strokeStyle=active?'#ffffd4':'#a3ffec';c.lineWidth=1.4;
    c.beginPath();c.moveTo(p.x-8,p.y);c.lineTo(p.x+8,p.y);c.moveTo(p.x,p.y-5);c.lineTo(p.x,p.y+5);c.stroke();
  }
  if(returnMarker.visible){
    const p=projectFallback(returnMarker.position.x,returnMarker.position.z),radius=25+4*Math.sin(elapsed*6);
    c.strokeStyle='#ebff7b';c.lineWidth=2;c.setLineDash([6,5]);
    c.beginPath();c.ellipse(p.x,p.y,radius,radius*.30,0,0,Math.PI*2);c.stroke();c.setLineDash([]);
  }
}
function drawFallbackPerson(c,actor,opposing=false) {
  const p=projectFallback(actor.position.x,actor.position.z),size=window.innerHeight*.112*p.scale;
  const jersey=opposing?'#e99a56':'#147cbb',skin=opposing?'#c49370':'#efbf9b';
  c.save();c.translate(p.x,p.y-actor.position.y*12);
  c.fillStyle='#001c21aa';c.beginPath();c.ellipse(0,0,size*.33,size*.08,0,0,2*Math.PI);c.fill();
  const walk=Math.sin(actor.userData.walkTime)*.06*size;
  c.lineCap='round';c.strokeStyle=opposing?'#303f4b':'#ecf4f4';c.lineWidth=size*.145;
  c.beginPath();c.moveTo(-size*.14,-size*.43);c.lineTo(-size*.15+walk,-size*.1);c.lineTo(-size*.18+walk,0);
  c.moveTo(size*.14,-size*.43);c.lineTo(size*.13-walk,-size*.12);c.lineTo(size*.17-walk,0);c.stroke();
  c.fillStyle='#ebf5e9';c.fillRect(-size*.26,-size*.45,size*.52,size*.22);
  c.fillStyle=jersey;c.beginPath();c.moveTo(-size*.34,-size*.94);c.lineTo(size*.32,-size*.94);c.lineTo(size*.25,-size*.46);c.lineTo(-size*.26,-size*.46);c.closePath();c.fill();
  c.fillStyle=opposing?'#fcce75':'#d4ff7c';c.fillRect(-size*.035,-size*.91,size*.07,size*.40);
  c.strokeStyle=skin;c.lineWidth=size*.13;
  c.beginPath();c.moveTo(-size*.32,-size*.9);c.lineTo(-size*.40,-size*.61);c.stroke();
  const hit=actor.userData.hitTime>0?Math.sin((1-actor.userData.hitTime/.55)*Math.PI):0;
  const rightX=size*(.40+.27*hit),rightY=-size*(.69+.25*hit);
  c.beginPath();c.moveTo(size*.30,-size*.91);c.lineTo(rightX,rightY);c.stroke();
  c.fillStyle=skin;c.beginPath();c.ellipse(0,-size*1.13,size*.20,size*.24,0,0,2*Math.PI);c.fill();
  c.fillStyle='#29353a';c.beginPath();c.ellipse(0,-size*1.29,size*.21,size*.11,0,Math.PI,Math.PI*2);c.fill();
  if(!opposing){c.fillStyle='#eaffed';c.fillRect(-size*.22,-size*1.31,size*.45,size*.055);}
  c.strokeStyle='#152e31';c.lineWidth=size*.052;
  c.beginPath();c.moveTo(rightX,rightY);c.lineTo(rightX+size*.13,rightY-size*.22);c.stroke();
  c.save();c.translate(rightX+size*.16,rightY-size*.38);c.rotate(.28+hit*.7);
  c.scale(.68,1);c.strokeStyle='#e9ffe1';c.lineWidth=size*.06;c.beginPath();c.ellipse(0,0,size*.22,size*.31,0,0,2*Math.PI);c.stroke();
  c.strokeStyle='#b6e8d1a9';c.lineWidth=.65;
  for(let k=-2;k<=2;k++){c.beginPath();c.moveTo(k*size*.071,-size*.25);c.lineTo(k*size*.071,size*.25);c.stroke();}
  for(let k=-2;k<=2;k++){c.beginPath();c.moveTo(-size*.18,k*size*.094);c.lineTo(size*.18,k*size*.094);c.stroke();}
  c.restore();c.restore();
}
function drawFallbackBall(c) {
  const shadow=projectFallback(ball.position.x,ball.position.z);
  c.fillStyle='#001a1b60';c.beginPath();c.ellipse(shadow.x,shadow.y,9,3,0,0,Math.PI*2);c.fill();
  for(let i=Math.min(5,trailHistory.length-1);i>=0;i--){
    const t=trailHistory[i];if(!t)continue;
    const pt=projectFallback(t.x,t.z,t.y);
    c.fillStyle=`rgba(221,253,104,${.08+(5-i)*.07})`;c.beginPath();c.arc(pt.x,pt.y,Math.max(1,3.3-i*.38),0,Math.PI*2);c.fill();
  }
  const p=projectFallback(ball.position.x,ball.position.z,ball.position.y),rad=clamp(4.5*p.scale,2.8,5.5);
  c.shadowColor='#d8ff7b';c.shadowBlur=12;c.fillStyle='#e9ff4a';c.beginPath();c.arc(p.x,p.y,rad,0,Math.PI*2);c.fill();c.shadowBlur=0;
  c.strokeStyle='#fbffd5';c.lineWidth=1;c.beginPath();c.arc(p.x,p.y,rad*.65,.3,Math.PI*1.26);c.stroke();
}
function renderCanvasFallback() {
  const c=fallbackContext,w=window.innerWidth,h=window.innerHeight;
  if(!c)return;
  const dpr=Math.min(window.devicePixelRatio||1,2);c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
  if(imageIsReady(courtPlate)){drawPhotorealCourt(c,w,h);return;}
  const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#091b27');sky.addColorStop(.38,'#213d3e');sky.addColorStop(1,'#513e32');
  c.fillStyle=sky;c.fillRect(0,0,w,h);
  // Stadium terraces from the reference: warm concrete steps and dark green seating.
  const bowl=c.createLinearGradient(0,h*.11,0,h);bowl.addColorStop(0,'#4e473d');bowl.addColorStop(.68,'#665442');bowl.addColorStop(1,'#382f2b');
  c.fillStyle=bowl;c.fillRect(0,h*.13,w,h*.87);
  for(let row=13;row>=0;row--){
    const y=h*(.115+row*.014);c.fillStyle=row%2?'#665944':'#7c6750';
    c.fillRect(w*.10-row*w*.007,y,w*(.80+row*.014),h*.010);
  }
  const signW=Math.min(w*.36,410),signH=clamp(h*.065,22,52);
  c.fillStyle='#092c31';c.strokeStyle='#b1ecc35e';c.lineWidth=1;
  c.beginPath();c.roundRect(w/2-signW/2,h*.063,signW,signH,6);c.fill();c.stroke();
  c.fillStyle='#cfff98';c.font=`900 ${clamp(signH*.38,11,19)}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText('GOLINGO  •  TENNIS LAB',w/2,h*.063+signH/2);
  for(const side of [-1,1]){
    const gx=side===-1?w*.13:w*.87;
    c.fillStyle='#071c24';c.fillRect(gx-4,h*.045,8,h*.13);
    c.shadowColor='#eeffcf';c.shadowBlur=24;c.fillStyle='#f4ffe1';c.beginPath();c.ellipse(gx,h*.047,clamp(w*.055,22,56),4,0,0,Math.PI*2);c.fill();c.shadowBlur=0;
  }
  for(const side of [-1,1]){
    // Each side of the playing court is framed by stepped spectator bleachers.
    for(let row=10;row>=0;row--){
      const start=side*(5.62+row*.79),end=side*(6.36+row*.79);
      drawFallbackWorldRect(c,Math.min(start,end),Math.max(start,end),-15.8,15.0,row%2?'#7c6650':'#624b3f');
      drawFallbackWorldLine(c,start,-15.8,start,15,'#bc9c72',2.1);
      for(let z=-14;z<13;z+=2.6){
        const pseudo=Math.abs(Math.sin(z*5.14+row*12.8+side*3.1));if(pseudo<.26)continue;
        const p=projectFallback((start+end)/2,z);
        const size=clamp(1.8*p.scale,1,3);
        c.fillStyle=['#98b0aa','#debfa0','#253f41','#e0d17f','#1b3334'][((row+Math.floor(z+25))%5+5)%5];
        c.beginPath();c.arc(p.x,p.y-size*1.5,size,0,Math.PI*2);c.fill();
      }
    }
  }
  // Runoff and green hardcourt, with subtle surface bands for depth.
  drawFallbackWorldRect(c,-9.5,9.5,-15,15,'#315e51','#193f3b',2);
  drawFallbackWorldRect(c,-5.485,5.485,-11.885,11.885,'#176b57','#c9f7dc',2.5);
  for(let j=0;j<16;j++)drawFallbackWorldRect(c,-5.48,5.48,-11.88+j*23.76/16,-11.88+(j+1)*23.76/16,j%2?'#0d46341d':'#d0ffe009');
  const line='#e3f8dc';
  for(const x of [-5.485,5.485,-SINGLES,SINGLES])drawFallbackWorldLine(c,x,-11.885,x,11.885,line,2.2);
  for(const z of [-11.885,11.885])drawFallbackWorldLine(c,-5.485,z,5.485,z,line,2.8);
  for(const z of [-6.4,6.4])drawFallbackWorldLine(c,-SINGLES,z,SINGLES,z,line,2.2);
  drawFallbackWorldLine(c,0,-6.4,0,6.4,line,2.2);
  for(const z of [-11.885,11.885])drawFallbackWorldLine(c,0,z,0,z+(z<0?.23:-.23),line,2);
  // Back wall sponsor cards and court lamps.
  const boardLeft=projectFallback(-8,-14.6),boardRight=projectFallback(8,-14.6);
  c.fillStyle='#07383e';c.fillRect(boardLeft.x,boardLeft.y-16,boardRight.x-boardLeft.x,16);
  c.fillStyle='#d4ffc3';c.font=`800 ${clamp(h*.016,9,13)}px system-ui`;c.fillText('SPEAK  •  PLAY  •  REPEAT',w/2,boardLeft.y-6);
  // Seven practice cones, like the training scene in the supplied recording.
  for(let i=0;i<7;i++){
    const p=projectFallback(-4.45+i*1.48,-8.0),size=8.2*p.scale;
    c.fillStyle='#11291f77';c.beginPath();c.ellipse(p.x,p.y+1,size*.9,size*.25,0,0,Math.PI*2);c.fill();
    drawFallbackPolygon(c,[{x:p.x-size*.55,y:p.y},{x:p.x+size*.55,y:p.y},{x:p.x,y:p.y-size*1.9}],'#f1c65c','#fff1c666',.7);
    c.strokeStyle='#f9f7d5';c.lineWidth=Math.max(.7,size*.28);c.beginPath();c.moveTo(p.x-size*.32,p.y-size*.56);c.lineTo(p.x+size*.32,p.y-size*.56);c.stroke();
  }
  drawFallbackRings(c);
  drawBallMachine(c,opponent,projectFallback,courtView(),elapsed);
  // Net is drawn after the far-side player and before the near-side player.
  const nl=projectFallback(-6.3,0),nr=projectFallback(6.3,0);
  const ntl=projectFallback(-6.3,0,1.1),ntr=projectFallback(6.3,0,1.1);
  drawFallbackPolygon(c,[ntl,ntr,nr,nl],'#0a1d2499','#d8f7d877',1);
  c.strokeStyle='#e7ffe0';c.lineWidth=3;c.beginPath();c.moveTo(ntl.x,ntl.y);c.lineTo(ntr.x,ntr.y);c.stroke();
  c.strokeStyle='#c0e5d360';c.lineWidth=.7;
  for(let i=0;i<=38;i++){const x=-6.3+i*12.6/38,a=projectFallback(x,0),b=projectFallback(x,0,1.1);c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();}
  for(let i=1;i<9;i++){const aa=projectFallback(-6.3,0,i*.12),bb=projectFallback(6.3,0,i*.12);c.beginPath();c.moveTo(aa.x,aa.y);c.lineTo(bb.x,bb.y);c.stroke();}
  c.strokeStyle='#f5fff1';c.lineWidth=4;for(const pos of [ntl,ntr]){const bottom=projectFallback(pos===ntl?-6.3:6.3,0);c.beginPath();c.moveTo(bottom.x,bottom.y+4);c.lineTo(pos.x,pos.y-4);c.stroke();}
  drawPhotorealPlayer(c,player,false);
  drawFallbackBall(c);
  // Light shafts gently draw the eye towards the vocabulary targets.
  const grad=c.createRadialGradient(w*.5,h*.36,10,w*.5,h*.36,Math.max(w,h)*.62);
  grad.addColorStop(0,'#f9ffda03');grad.addColorStop(1,'#00171d33');c.fillStyle=grad;c.fillRect(0,0,w,h);
}

function normalizePayload(raw) {
  if(typeof raw==='string'){
    let input=raw.trim();if(input.length>180000)return null;
    try{raw=JSON.parse(input);}catch(error){return null;}
  }
  if(!raw || typeof raw!=='object')return null;
  let data=raw;
  for(let k=0;k<3;k++){
    if(data?.words || data?.sentences || Array.isArray(data))break;
    const next=data.payload||data.data||data.gameData||data.vocabulary;
    if(!next||next===data)break;
    data=next;
  }
  const entries=Array.isArray(data)?data:(data.words||data.sentences||data.items);
  if(!Array.isArray(entries))return null;
  const normalized=entries.slice(0,500).map((entry,i)=>{
    if(typeof entry==='string')return null;
    const term=entry.word||entry.phrase||entry.sentence||entry.text||entry.learningText||'';
    const translation=entry.translation||entry.meaning||entry.sentenceTranslation||entry.primaryText||entry.english||'';
    if(!String(term).trim()||!String(translation).trim())return null;
    return {id:String(entry.id??i),word:String(term).slice(0,150),translation:String(translation).slice(0,180),
      sentence:String(entry.sentence||'').slice(0,260),sentenceTranslation:String(entry.sentenceTranslation||'').slice(0,260),audioUrl:entry.audioUrl||entry.audio||null};
  }).filter(Boolean);
  if(!normalized.length)return null;
  const lang=String(data.learningLanguage||raw.learningLanguage||learningLanguage).slice(0,12).toLowerCase().split('-')[0];
  const primary=String(data.primaryLanguage||raw.primaryLanguage||'en').slice(0,12).toLowerCase().split('-')[0];
  return {words:normalized,learningLanguage:lang,primaryLanguage:primary};
}
function loadDeck(payload,label='Custom deck') {
  deck=payload.words.slice();learningLanguage=payload.learningLanguage||'ja';primaryLanguage=payload.primaryLanguage||'en';
  questionIndex=0;points=0;hits=0;correctHits=0;streak=0;misses=0;drillHits=0;drillMisses=0;collected.clear();updateScore();
  selectShot('serve');newQuestion(false);startNewServe(false);
  $('deckCount').textContent=`${deck.length} words loaded · ${languageNames[learningLanguage]||learningLanguage}`;
  $('questionSub').textContent=`${label} · tap SWING to start`;
  if(started && !paused)speakPrompt();
}
function importDeck(raw,source='Imported GoLingo deck') {
  const data=normalizePayload(raw);
  if(!data)return false;
  customDeck=data;$('languageSelect').querySelector('option[value="custom"]').disabled=false;
  $('languageSelect').value='custom';loadDeck(data,source);
  try{const json=JSON.stringify(data);if(json.length<170000)localStorage.setItem('golingo_tennis_custom_deck',json);}catch(error){}
  $('importMessage').textContent=`✓ ${data.words.length} words imported. Resume to play.`;
  return true;
}
function exportCollected() {
  if(!collected.size){toast('Hit some correct translations first to collect vocabulary');return;}
  const data={primaryLanguage,learningLanguage,words:Array.from(collected.values())};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='golingo-tennis-collected-words.json';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
  toast(`${collected.size} collected words exported`);
}
function loadExternalData() {
  let found=false;
  const params=new URLSearchParams(window.location.search);
  for(const key of ['data','golingo','words','vocab','payload','json']){
    const value=params.get(key);if(value && importDeck(value,'GoLingo app vocabulary')){found=true;break;}
  }
  if(!found && window.location.hash.startsWith('#data=')){
    try{found=importDeck(decodeURIComponent(window.location.hash.slice(6)),'GoLingo app vocabulary');}catch(error){}
  }
  if(!found){
    try{const saved=localStorage.getItem('golingo_tennis_custom_deck');if(saved){customDeck=normalizePayload(saved);if(customDeck)$('languageSelect').querySelector('option[value="custom"]').disabled=false;}}catch(error){}
  }
  window.addEventListener('message',event=>{
    const msg=event.data;if(!msg)return;
    const isRecognized=typeof msg==='object' && (msg.words||msg.data?.words||msg.payload?.words||/GOLINGO|VOCAB|GAME_DATA/i.test(String(msg.type||'')));
    if(isRecognized && importDeck(msg,'Vocabulary from GoLingo app'))toast(`${deck.length} GoLingo words ready to play`);
  });
  try{if(window.parent!==window)window.parent.postMessage({type:'GOLINGO_GAME_READY',game:'tennis'},'*');}catch(error){}
}

function togglePause() {
  if(!started)return;
  paused=!paused;$('pauseBtn').textContent=paused?'▶':'Ⅱ';
  if(paused){cancelPowerCharge();setShotMenuOpen(false);setStatus('PAUSED · tap ▶ to resume');window.speechSynthesis?.cancel();}
  else setStatus(phase==='incoming'?'BALL INCOMING · move and swing!':'READY · tap SWING to continue');
}
function openSettings() {
  cancelPowerCharge();setShotMenuOpen(false);
  if(started){paused=true;$('pauseBtn').textContent='▶';}
  $('settingsOverlay').hidden=false;
  $('deckCount').textContent=`${deck.length} words · ${languageNames[learningLanguage]||learningLanguage}`;
  window.speechSynthesis?.cancel();
}
function closeSettings() {
  $('settingsOverlay').hidden=true;if(started){paused=false;$('pauseBtn').textContent='Ⅱ';setStatus('BACK ON COURT · tap SWING to practice');}
}
function startGame() {
  if(started)return;
  started=true;paused=false;
  $('startOverlay').hidden=true;
  startNewServe(false);newQuestion(false);
  setStatus('TAP SWING TO SERVE · use the left joystick to move');
}
function bindControls() {
  document.querySelectorAll('.shot').forEach(btn=>btn.addEventListener('click',()=>selectShot(btn.dataset.shot)));
  $('shotMenuBtn').addEventListener('click',()=>setShotMenuOpen(!$('shotPicker').classList.contains('open')));
  document.addEventListener('pointerdown',event=>{
    if($('shotPicker').classList.contains('open')&&!event.target.closest('#shotPicker,#shotMenuBtn'))setShotMenuOpen(false);
  });
  $('nextDrillBtn').addEventListener('click',()=>{
    const list=Object.keys(shotInfo),next=list[(list.indexOf(selectedShot)+1)%list.length];
    selectShot(next);toast(`${shotInfo[next].name} drill · 5-ball practice`);
  });
  $('startBtn').addEventListener('click',startGame);
  $('settingsBtn').addEventListener('click',openSettings);
  $('closeSettings').addEventListener('click',closeSettings);
  $('resumeBtn').addEventListener('click',closeSettings);
  $('pauseBtn').addEventListener('click',togglePause);
  $('listenBtn').addEventListener('click',speakPrompt);
  $('replayAudio').addEventListener('click',speakPrompt);
  $('newServeBtn').addEventListener('click',()=>{selectShot('serve');startNewServe(false);closeSettings();});
  $('speechToggle').addEventListener('change',event=>{speechEnabled=event.target.checked;if(!speechEnabled)window.speechSynthesis?.cancel();});
  $('soundToggle').addEventListener('change',event=>{soundEnabled=event.target.checked;});
  $('assistToggle').addEventListener('change',event=>{movementAssist=event.target.checked;});
  $('wordToggle').addEventListener('change',event=>{showWords=event.target.checked;newQuestion(false);});
  $('languageSelect').addEventListener('change',event=>{
    const lang=event.target.value;
    if(lang==='custom'){
      if(customDeck)loadDeck(customDeck,'Custom vocabulary');else toast('Import GoLingo JSON to create a custom deck');
    }else loadDeck({words:sampleDecks[lang],learningLanguage:lang,primaryLanguage:'en'},'Built-in practice deck');
  });
  $('importBtn').addEventListener('click',()=>{if(!importDeck($('importJson').value))$('importMessage').textContent='Please paste valid GoLingo JSON containing words and translations.';});
  $('exportBtn').addEventListener('click',exportCollected);
  // Aim by touching the far court. The shot also works without ever aiming.
  $('scene').addEventListener('pointerdown',event=>{
    if(!started||paused)return;
    if(!firstAudioGesture){firstAudioGesture=true;speakPrompt();}
    if(usesCanvasFallback){
      const center=projectFallback(0,aimZ).x,edge=projectFallback(4.1,aimZ).x-center;
      aimX=clamp((event.clientX-center)/Math.max(1,edge)*4.1,-4.1,4.1);
    }else{
      const ray=new THREE.Raycaster(),mouse=new THREE.Vector2(event.clientX/window.innerWidth*2-1,-event.clientY/window.innerHeight*2+1);
      ray.setFromCamera(mouse,camera);
      const hitPoint=new THREE.Vector3();
      if(ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-.15),hitPoint))aimX=clamp(hitPoint.x,-4.1,4.1);
    }
    updateTargets();setStatus(`AIM SET · ${shotInfo[selectedShot].name.toUpperCase()} to the ${aimX>1?'RIGHT':aimX< -1?'LEFT':'CENTER'}`);
  });
  const swing=$('swingBtn');
  swing.addEventListener('pointerdown',event=>{
    if(event.button!==0||!started||paused||phase==='outgoing'||phase==='windup')return;
    event.preventDefault();
    if(autoCharging){completePowerCharge();return;}
    powerCharging=true;pressStarted=performance.now();chargePointerId=event.pointerId;hitPower=.30;
    updatePowerMeter(hitPower,true);swing.setPointerCapture?.(event.pointerId);
  });
  swing.addEventListener('pointerup',event=>{
    if(!powerCharging||chargePointerId!==event.pointerId)return;
    event.preventDefault();
    const held=(performance.now()-pressStarted)/1000;
    if(held<.16){powerCharging=false;autoCharging=true;updatePowerMeter(hitPower,true);}
    else completePowerCharge();
  });
  swing.addEventListener('pointercancel',cancelPowerCharge);
  const joystick=$('joystick'),stick=$('stick');let pointerId=null;
  function updateJoystick(event){
    const rect=joystick.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,limit=rect.width*.32;
    let x=event.clientX-cx,y=event.clientY-cy;const distance=Math.hypot(x,y);
    if(distance>limit){x*=limit/distance;y*=limit/distance;}
    joystickMovement.x=clamp(x/limit,-1,1);joystickMovement.z=clamp(y/limit,-1,1);
    stick.style.transform=`translate(-50%,-50%) translate(${x}px,${y}px)`;
  }
  joystick.addEventListener('pointerdown',e=>{e.preventDefault();pointerId=e.pointerId;joystick.setPointerCapture(e.pointerId);updateJoystick(e);});
  joystick.addEventListener('pointermove',e=>{if(pointerId===e.pointerId){e.preventDefault();updateJoystick(e);}});
  function release(e){if(pointerId!==e.pointerId)return;pointerId=null;joystickMovement.x=0;joystickMovement.z=0;stick.style.transform='translate(-50%,-50%)';}
  joystick.addEventListener('pointerup',release);joystick.addEventListener('pointercancel',release);
  document.addEventListener('keydown',e=>{
    const tag=document.activeElement?.tagName;if(tag==='TEXTAREA'||tag==='INPUT'||tag==='SELECT')return;
    const k=e.key.toLowerCase();
    if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
    if(k==='arrowleft'||k==='a')keyMovement.left=true;
    if(k==='arrowright'||k==='d')keyMovement.right=true;
    if(k==='arrowup'||k==='w')keyMovement.up=true;
    if(k==='arrowdown'||k==='s')keyMovement.down=true;
    if(k===' '&&!e.repeat)hitNow();
    if('12345'.includes(k)&&k.length===1)selectShot(Object.keys(shotInfo)[Number(k)-1]);
    if(k==='r'&&!e.repeat)speakPrompt();
    if(k==='q'&&!e.repeat){aimX=clamp(aimX-.7,-4.1,4.1);updateTargets();}
    if(k==='e'&&!e.repeat){aimX=clamp(aimX+.7,-4.1,4.1);updateTargets();}
    if(k==='escape'&&!e.repeat){if($('shotPicker').classList.contains('open'))setShotMenuOpen(false);else if(!$('settingsOverlay').hidden)closeSettings();else togglePause();}
  });
  document.addEventListener('keyup',e=>{
    const k=e.key.toLowerCase();
    if(k==='arrowleft'||k==='a')keyMovement.left=false;
    if(k==='arrowright'||k==='d')keyMovement.right=false;
    if(k==='arrowup'||k==='w')keyMovement.up=false;
    if(k==='arrowdown'||k==='s')keyMovement.down=false;
  });
  window.addEventListener('blur',()=>{keyMovement={left:false,right:false,up:false,down:false};joystickMovement.x=0;joystickMovement.z=0;cancelPowerCharge();});
}

function main() {
  try{
    buildWorld();buildTargetButtons();bindControls();
    updatePowerMeter(hitPower,false);
    $('languageSelect').querySelector('option[value="custom"]').disabled=true;
    newQuestion(false);selectShot('serve');resetBallToServer();
    loadExternalData();updateScore();startGame();tick();
  }catch(error){
    console.error('Tennis Academy error',error);
    $('startOverlay').hidden=false;
    $('startOverlay').querySelector('p').textContent='This device could not start the 3D court. Try a modern browser with WebGL enabled.';
  }
}
main();
