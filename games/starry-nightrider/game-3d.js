import * as THREE from './assets/three.module.js';

// Starry Nightrider — fully playable procedural Three.js village.
// Three.js r170 is bundled beside this file. No build step or server API needed.
// The earlier painterly canvas version is a WebGL-unavailable fallback.

const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const lerp = (a,b,t) => a+(b-a)*t;
const rand = seed => { const v=Math.sin(seed*127.17+93.7)*43758.545; return v-Math.floor(v); };
const choice = (items,seed) => items[Math.floor(rand(seed)*items.length)];
const v3 = (x,y,z) => new THREE.Vector3(x,y,z);
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth<730;

const DEMO = {
  es:{ name:'Spanish', locale:'es-ES', pairs:[['estrella','star','Las estrellas brillan esta noche.'],['luna','moon','La luna es preciosa.'],['bicicleta','bicycle','Voy en bicicleta.'],['pueblo','village','El pueblo es tranquilo.'],['cielo','sky','Mira el cielo.'],['camino','road','Sigue el camino.'],['luz','light','La luz está brillando.'],['noche','night','La noche es hermosa.'],['árbol','tree','Veo un árbol grande.'],['viento','wind','El viento sopla.'],['ventana','window','La ventana tiene luz.'],['sueño','dream','Es un sueño hermoso.']]},
  ja:{ name:'Japanese', locale:'ja-JP', pairs:[['星','star','星がきれいです。'],['月','moon','月がきれいです。'],['自転車','bicycle','自転車に乗ります。'],['村','village','静かな村です。'],['空','sky','空を見てください。'],['道','road','道を進みます。'],['光','light','光が見えます。'],['夜','night','美しい夜です。'],['木','tree','大きな木があります。'],['風','wind','風が吹きます。'],['窓','window','窓に光があります。'],['夢','dream','きれいな夢です。']]},
  fr:{ name:'French', locale:'fr-FR', pairs:[['étoile','star','Les étoiles brillent.'],['lune','moon','La lune est belle.'],['vélo','bicycle','Je fais du vélo.'],['village','village','Le village est calme.'],['ciel','sky','Regarde le ciel.'],['chemin','road','Suis le chemin.'],['lumière','light','Je vois une lumière.'],['nuit','night','La nuit est belle.'],['arbre','tree','Voici un grand arbre.'],['vent','wind','Le vent souffle.'],['fenêtre','window','La fenêtre est éclairée.'],['rêve','dream','C’est un joli rêve.']]},
  zh:{ name:'Chinese', locale:'zh-CN', pairs:[['星星','star','星星在闪烁。'],['月亮','moon','月亮很漂亮。'],['自行车','bicycle','我骑自行车。'],['村庄','village','村庄很安静。'],['天空','sky','抬头看看天空。'],['道路','road','沿着道路骑行。'],['光芒','light','我看到了光芒。'],['夜晚','night','夜晚很美丽。'],['树木','tree','有一棵大树。'],['微风','wind','微风吹过。'],['窗户','window','窗户亮着灯。'],['梦想','dream','追逐你的梦想。']]},
  vi:{ name:'Vietnamese', locale:'vi-VN', pairs:[['ngôi sao','star','Những ngôi sao đang sáng.'],['mặt trăng','moon','Mặt trăng rất đẹp.'],['xe đạp','bicycle','Tôi đi xe đạp.'],['ngôi làng','village','Ngôi làng yên bình.'],['bầu trời','sky','Hãy nhìn bầu trời.'],['con đường','road','Đi theo con đường.'],['ánh sáng','light','Tôi thấy ánh sáng.'],['ban đêm','night','Một đêm tuyệt đẹp.'],['cái cây','tree','Có một cây lớn.'],['gió','wind','Gió thổi nhẹ.'],['cửa sổ','window','Cửa sổ sáng đèn.'],['giấc mơ','dream','Một giấc mơ đẹp.']]},
  de:{ name:'German', locale:'de-DE', pairs:[['Stern','star','Die Sterne leuchten.'],['Mond','moon','Der Mond ist schön.'],['Fahrrad','bicycle','Ich fahre Fahrrad.'],['Dorf','village','Das Dorf ist ruhig.'],['Himmel','sky','Schau in den Himmel.'],['Weg','road','Folge dem Weg.'],['Licht','light','Ich sehe ein Licht.'],['Nacht','night','Die Nacht ist wunderschön.'],['Baum','tree','Ein großer Baum steht dort.'],['Wind','wind','Der Wind weht.'],['Fenster','window','Das Fenster leuchtet.'],['Traum','dream','Ein schöner Traum.']]}
};
const languageName = code => DEMO[code]?.name || code.toUpperCase();
const localeFor = code => DEMO[code]?.locale || code || 'en-US';
const demoPack = code => ({primaryLanguage:'en',learningLanguage:code,words:(DEMO[code]||DEMO.es).pairs.map((row,i)=>({id:String(i+1),word:row[0],translation:row[1],sentence:row[2],sentenceTranslation:''}))});

function normalizePack(value) {
  if(typeof value==='string'){
    try{value=JSON.parse(value);}catch{try{value=JSON.parse(decodeURIComponent(value));}catch{return null;}}
  }
  if(!value||typeof value!=='object')return null;
  const p=value.data?.words?value.data:value.payload?.words?value.payload:value;
  if(!Array.isArray(p.words)||!p.words.length)return null;
  const words=p.words.slice(0,2500).map((w,i)=>{
    if(typeof w==='string')return{id:String(i),word:w,translation:''};
    if(!w)return null;
    return {id:String(w.id??i),word:String(w.word??w.text??w.sentence??'').slice(0,120),
      translation:String(w.translation??w.meaning??w.sentenceTranslation??'').slice(0,170),
      sentence:String(w.sentence??'').slice(0,230),sentenceTranslation:String(w.sentenceTranslation??'').slice(0,230),
      audioURL:String(w.audioURL??w.audioUrl??'')};
  }).filter(w=>w?.word);
  if(!words.length)return null;
  return{primaryLanguage:String(p.primaryLanguage||'en'),learningLanguage:String(p.learningLanguage||'es'),words};
}

function start3D() {
  const canvas=$('world');
  // Three r170 requires WebGL 2. Construction failure happens before any
  // controls bind, allowing the HTML loader to activate its canvas fallback.
  const renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});
  // Most phones are fill-rate limited. Begin with fewer physical pixels, then
  // adapt resolution from measured frame times without sacrificing input FPS.
  const maxPixelRatio=Math.min(window.devicePixelRatio||1,isMobile?1.06:1.36);
  const minPixelRatio=isMobile?.72:.88;
  let renderPixelRatio=maxPixelRatio;
  renderer.setPixelRatio(renderPixelRatio);
  renderer.setSize(innerWidth,innerHeight,false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.33;
  // The oil-paint contrast is supplied by emissive windows and painted
  // shadow colors. Dynamic shadow maps multiplied render cost without adding
  // enough to this deliberately painterly art direction.
  renderer.shadowMap.enabled=false;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x101a3d);
  scene.fog=new THREE.FogExp2(0x263b68,.0026);
  const camera=new THREE.PerspectiveCamera(64,innerWidth/innerHeight,.1,1100);
  camera.position.set(0,5,100);
  const chaseLook=v3(0,1,0);
  const clock=new THREE.Clock();
  const tempObject=new THREE.Object3D();
  const vectorUp=v3(0,1,0);
  const buildingColliders=[];
  const houseSlots=[];
  const roadPaths=[];
  const orbs=[];
  const effects=[];
  const staticBatchRoots=[];
  let importedPack=null;
  let lesson=demoPack('es');
  let nextWordIndex=0;
  let speechVersion=0,speechTimeout=0,currentAudio=null;
  let audioContext=null;
  let lastHudTime=0,lastHintTime=0,finishRequested=false;
  let lastOrbRespawn=0;
  const controls={forward:false,brake:false,left:false,right:false,space:false,joyX:0,joyY:0};
  const state={started:false,paused:false,finished:false,x:0,z:89,heading:0,speed:0,
    jumpY:0,jumpVel:0,jumps:0,boostUntil:0,lean:0,steerSmooth:0,trickStart:0,trickDuration:0,
    bag:[],history:[],delivered:0,best:0,distance:0,current:null,
    showCard:true,showMeaning:true,audioOn:true,fxOn:true,repeat:true,autoRide:true,
    speechGap:2200,deliveryCooldown:0,styleCount:0,streak:0,bonusPoints:0,
    rushUntil:0,steepleExitUntil:0,visited:new Set()};
  try{
    state.best=Number(localStorage.getItem('golingoStarryBest')||0);
    state.speechGap=Number(localStorage.getItem('golingoStarrySpeechGap')||2200);
    state.audioOn=localStorage.getItem('golingoStarryVoice')!=='off';
  }catch{}

  const MAT={
    frame:new THREE.MeshStandardMaterial({color:0xb88452,metalness:.67,roughness:.3}),
    rim:new THREE.MeshStandardMaterial({color:0xb7b7b3,metalness:.76,roughness:.25}),
    tire:new THREE.MeshStandardMaterial({color:0x101622,roughness:.96}),
    navy:new THREE.MeshStandardMaterial({color:0x1b3557,roughness:.89}),
    blue:new THREE.MeshStandardMaterial({color:0x255dc9,roughness:.83}),
    blueLight:new THREE.MeshStandardMaterial({color:0x4e89e2,roughness:.85}),
    pants:new THREE.MeshStandardMaterial({color:0x292f37,roughness:.95}),
    red:new THREE.MeshStandardMaterial({color:0xb52e35,side:THREE.DoubleSide,roughness:.81}),
    scarf:new THREE.MeshStandardMaterial({color:0xea5c43,side:THREE.DoubleSide,roughness:.78}),
    skin:new THREE.MeshStandardMaterial({color:0xd49c70,roughness:.83}),
    straw:new THREE.MeshStandardMaterial({color:0xebcb77,roughness:1}),
    strawDark:new THREE.MeshStandardMaterial({color:0xb5874e,roughness:1}),
    hair:new THREE.MeshStandardMaterial({color:0x9f4b31,roughness:.94}),
    leather:new THREE.MeshStandardMaterial({color:0x624234,roughness:.88}),
    leatherTrim:new THREE.MeshStandardMaterial({color:0xc49c70,roughness:.96}),
    gloves:new THREE.MeshStandardMaterial({color:0x352e2a,roughness:.88}),
    glass:new THREE.MeshStandardMaterial({color:0xffc875,emissive:0xffad46,emissiveIntensity:2.4,roughness:.58}),
    glassDim:new THREE.MeshStandardMaterial({color:0xffd99e,emissive:0xe18f42,emissiveIntensity:1.1}),
    gold:new THREE.MeshStandardMaterial({color:0xfad58d,emissive:0xb57927,emissiveIntensity:.6,metalness:.4,roughness:.35}),
    darkWood:new THREE.MeshStandardMaterial({color:0x253344,roughness:1})
  };

  function material(color,options={}){return new THREE.MeshStandardMaterial({color,roughness:.96,...options});}
  function mesh(geometry,mat,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);return m;}
  function box(w,h,d,mat,x=0,y=0,z=0){return mesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z);}
  function cylinderBetween(a,b,radius,mat,sides=7){
    const mid=a.clone().add(b).multiplyScalar(.5),distance=a.distanceTo(b);
    const tube=mesh(new THREE.CylinderGeometry(radius,radius,distance,sides),mat,mid.x,mid.y,mid.z);
    tube.quaternion.setFromUnitVectors(vectorUp,b.clone().sub(a).normalize());return tube;
  }
  function setSegment(seg,a,b){const difference=b.clone().sub(a);seg.position.copy(a).add(b).multiplyScalar(.5);seg.quaternion.setFromUnitVectors(vectorUp,difference.clone().normalize());seg.scale.y=difference.length();}

  // Thick brushstroke textures are drawn locally, without downloading models.
  function createCanvasTexture(painter,size=512){
    const c=document.createElement('canvas');c.width=c.height=size;
    const g=c.getContext('2d');painter(g,size);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
    t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
    return t;
  }
  // Startup used to paint 3,400 individual grass strokes onto a canvas.
  // A baked oil-painted meadow atlas has richer detail and avoids that work.
  const grassTexture=new THREE.TextureLoader().load('./assets/meadow-v9.webp');
  grassTexture.colorSpace=THREE.SRGBColorSpace;
  grassTexture.wrapS=grassTexture.wrapT=THREE.RepeatWrapping;
  grassTexture.repeat.set(18,18);grassTexture.anisotropy=isMobile?2:4;
  // Baked oil-paint textures replace thousands of startup canvas brush
  // operations and allow the stonework to be much richer at zero geometry cost.
  // Texture size is 1024²; phones sample a compressed mipmap rather than
  // computing tiny individual cobblestones or brick meshes every frame.
  function paintTexture(url,repeatX=1,repeatY=1){
    const t=new THREE.TextureLoader().load(url);
    t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.repeat.set(repeatX,repeatY);t.anisotropy=isMobile?2:4;
    return t;
  }
  // Scale the photographed-looking impasto stones to bicycle size. The old
  // UVs repeated a full tile every 5 metres, turning cobbles into static.
  const cobbleTexture=paintTexture('./assets/cobbles-v9.webp',.7,1);
  const wallBrushTexture=paintTexture('./assets/stonewall-refined.webp',1.25,1.5);
  const roofBrushTexture=paintTexture('./assets/roof-refined.webp');
  const ground=mesh(new THREE.PlaneGeometry(760,760,1,1),material(0xdfe9da,{map:grassTexture,roughness:1}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-.08;ground.receiveShadow=true;scene.add(ground);

  // Painterly illumination: cool moonlight + warm scattered windows.
  scene.add(new THREE.HemisphereLight(0xb4d3ff,0x253225,2.2));
  const moonlight=new THREE.DirectionalLight(0xa5c9ff,2.25);
  moonlight.position.set(-55,96,-55);moonlight.castShadow=false;
  moonlight.shadow.mapSize.set(1024,1024);
  moonlight.shadow.camera.left=-135;moonlight.shadow.camera.right=135;
  moonlight.shadow.camera.top=135;moonlight.shadow.camera.bottom=-135;
  moonlight.shadow.camera.far=280;moonlight.shadow.bias=-.0005;scene.add(moonlight);
  const lanternLight=new THREE.PointLight(0xffb45b,35,28,2);lanternLight.position.set(0,10,13);scene.add(lanternLight);

  // A panoramic sky from original impasto-style artwork, on the inside of a dome.
  const skyMat=new THREE.MeshBasicMaterial({color:0x23477f,side:THREE.BackSide,fog:false});
  const skySphere=mesh(new THREE.SphereGeometry(760,64,32),skyMat);
  skySphere.rotation.y=.27;scene.add(skySphere);
  new THREE.TextureLoader().load('./assets/starry-sky.webp',texture=>{
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.ClampToEdgeWrapping;
    skyMat.map=texture;skyMat.color.set(0xffffff);skyMat.needsUpdate=true;
  });
  const haloTexture=createCanvasTexture((g,s)=>{
    const grad=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
    grad.addColorStop(0,'rgba(255,248,194,1)');grad.addColorStop(.13,'rgba(255,223,129,.86)');
    grad.addColorStop(.34,'rgba(243,185,83,.3)');grad.addColorStop(1,'rgba(243,171,80,0)');
    g.fillStyle=grad;g.fillRect(0,0,s,s);
  },128);
  const starGroup=new THREE.Group();scene.add(starGroup);
  const starPositions=[],starColors=[];
  for(let i=0;i<48;i++){
    const angle=rand(i+22)*TAU,r=540,y=115+rand(i*17+8)*240;
    starPositions.push(Math.sin(angle)*r,y,Math.cos(angle)*r);
    const color=new THREE.Color(i%3?0xffdb83:0xcfe9f6);
    starColors.push(color.r,color.g,color.b);
  }
  const starGeometry=new THREE.BufferGeometry();
  starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
  starGeometry.setAttribute('color',new THREE.Float32BufferAttribute(starColors,3));
  const starMaterial=new THREE.PointsMaterial({map:haloTexture,color:0xffffff,vertexColors:true,
    size:27,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,
    sizeAttenuation:true,fog:false});
  const stars=new THREE.Points(starGeometry,starMaterial);stars.frustumCulled=false;starGroup.add(stars);
  // Animated sculptural spiral strokes floating high above the world.
  const spiralGroup=new THREE.Group();scene.add(spiralGroup);
  const spiralColors=[0x8bd5dd,0xf7cd6f,0x56a7c5,0xece2ab];
  for(let j=0;j<6;j++){
    const angle=(j/6)*TAU;
    const center=v3(Math.sin(angle)*475,175+rand(j+7)*100,Math.cos(angle)*475);
    const points=[];
    for(let i=0;i<100;i++){
      const t=i/99,theta=t*TAU*2.25,r=1+t*(7+rand(j+11)*8);
      points.push(v3(center.x+Math.cos(theta)*r,center.y+Math.sin(theta)*r*.7,center.z+Math.sin(theta*.38)*3));
    }
    const curve=new THREE.CatmullRomCurve3(points);
    const spiral=mesh(new THREE.TubeGeometry(curve,155,.21+rand(j+16)*.13,5,false),
      new THREE.MeshBasicMaterial({color:spiralColors[j%4],transparent:true,opacity:.66,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
    spiralGroup.add(spiral);
  }
  // Giant broken crescent, deliberately geometry rather than a flat overlay.
  const moonShape=new THREE.Shape();moonShape.absarc(0,0,9,0,TAU,false);
  const hole=new THREE.Path();hole.absarc(3.2,2.1,8.1,0,TAU,true);moonShape.holes.push(hole);
  const crescent=mesh(new THREE.ShapeGeometry(moonShape,40),
    new THREE.MeshBasicMaterial({color:0xffd97b,side:THREE.DoubleSide,fog:false}));
  crescent.position.set(350,255,-475);crescent.rotation.y=-.25;scene.add(crescent);
  const crescentGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:haloTexture,color:0xffc76c,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,fog:false}));
  crescentGlow.position.copy(crescent.position);crescentGlow.scale.set(43,43,1);scene.add(crescentGlow);

  // Forty-four scenic hills now render in ONE instanced draw instead of 44.
  const hills=new THREE.InstancedMesh(new THREE.SphereGeometry(1,13,8),
    material(0xffffff,{flatShading:true,roughness:1}),44);
  for(let i=0;i<44;i++){
    const a=i/44*TAU,r=310+rand(i+90)*42;
    tempObject.position.set(Math.cos(a)*r,3,Math.sin(a)*r);
    tempObject.rotation.set(0,0,0);
    tempObject.scale.set(58+rand(i+14)*38,29+rand(i+18)*28,59+rand(i+19)*33);
    tempObject.updateMatrix();hills.setMatrixAt(i,tempObject.matrix);
    hills.setColorAt(i,new THREE.Color(choice([0x294769,0x304c6c,0x263e61,0x354f66],i+4)));
  }
  hills.instanceMatrix.needsUpdate=true;hills.frustumCulled=false;scene.add(hills);

  // Painted diffuse lighting is baked into the street art. MeshBasic on
  // phones removes PBR shader cost while keeping the brighter oil-paint color.
  const streetMat=isMobile?
    new THREE.MeshBasicMaterial({map:cobbleTexture,color:0xe9d5ee,side:THREE.DoubleSide,toneMapped:false}):
    new THREE.MeshStandardMaterial({map:cobbleTexture,color:0xffedf3,roughness:.97,side:THREE.DoubleSide});
  const curbMat=new THREE.MeshStandardMaterial({color:0xc39c76,emissive:0x4d3060,emissiveIntensity:.22,roughness:.91});
  function makeRoad(points,width,closed=false){
    const segments=[],verts=[],uv=[],indices=[];let length=0;
    for(let i=0;i<points.length;i++){
      const prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)],p=points[i];
      const tangent=next.clone().sub(prev).normalize(),perp=v3(-tangent.z,0,tangent.x);
      const left=p.clone().addScaledVector(perp,width*.5),right=p.clone().addScaledVector(perp,-width*.5);
      if(i>0)length+=p.distanceTo(points[i-1]);
      verts.push(left.x,.047,left.z,right.x,.047,right.z);uv.push(0,length/20,1,length/20);
      if(i) {const n=i*2;indices.push(n-2,n-1,n,n-1,n+1,n);}
      segments.push({left,right});
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
    const pathMesh=mesh(geo,streetMat);pathMesh.receiveShadow=true;scene.add(pathMesh);
    for(const side of ['left','right']){
      const curve=new THREE.CatmullRomCurve3(segments.map(s=>s[side]));
      const line=mesh(new THREE.TubeGeometry(curve,Math.max(20,points.length*2),.075,4,false),curbMat);
      scene.add(line);
    }
    roadPaths.push(points);
  }
  const road1=Array.from({length:161},(_,i)=>{const z=-256+i*3.2;return v3(Math.sin(z*.024)*6,0,z);});
  const road2=Array.from({length:161},(_,i)=>{const x=-256+i*3.2;return v3(x,0,Math.cos(x*.024)*6);});
  const loop=Array.from({length:111},(_,i)=>{const a=i/110*TAU;return v3(Math.cos(a)*46,0,Math.sin(a)*44);});
  const diagonal=Array.from({length:131},(_,i)=>{const x=-214+i*3.3;return v3(x,0,x*.57+Math.sin(x*.038)*5);});
  const villageLane=Array.from({length:148},(_,i)=>{const z=-236+i*3.2;return v3(76+Math.sin(z*.045)*6,0,z);});
  makeRoad(road1,9.5);makeRoad(road2,9.2);makeRoad(loop,8.7,true);makeRoad(diagonal,7);makeRoad(villageLane,6.8);
  // A real connected miniature region: crescent alleys, two village squares,
  // vineyard lanes, the river trail and the long hillside switchback. These
  // lead into each other instead of being isolated stretches of scenery.
  const outerLoop=Array.from({length:173},(_,i)=>{const a=i/172*TAU;
    return v3(Math.cos(a)*(150+Math.sin(a*3)*11),0,Math.sin(a)*(139+Math.cos(a*4)*11));});
  makeRoad(outerLoop,7.8,true);
  const lanes=[
    {fixed:-111,vertical:true,amp:5,phase:.03,start:-224,end:219,width:7.1},
    {fixed:157,vertical:true,amp:6,phase:.027,start:-233,end:237,width:7.2},
    {fixed:-87,vertical:false,amp:7,phase:.029,start:-225,end:222,width:7.4},
    {fixed:109,vertical:false,amp:6,phase:.031,start:-239,end:239,width:7.0},
    {fixed:-191,vertical:false,amp:5,phase:.025,start:-244,end:242,width:6.7},
    {fixed:202,vertical:false,amp:6,phase:.022,start:-229,end:246,width:6.8},
    {fixed:-202,vertical:true,amp:7,phase:.024,start:-220,end:219,width:6.6}
  ];
  for(const lane of lanes){
    const points=Array.from({length:124},(_,i)=>{const t=i/123,p=lerp(lane.start,lane.end,t);
      const fixed=lane.fixed+Math.sin(p*lane.phase)*lane.amp;
      return lane.vertical?v3(fixed,0,p):v3(p,0,fixed);
    });
    makeRoad(points,lane.width);
  }
  const hillsideTrail=Array.from({length:121},(_,i)=>{const t=i/120;
    return v3(-245+490*t,0,178-47*Math.sin(t*TAU*1.7)+8*Math.sin(t*TAU*5));});
  const cypressTrail=Array.from({length:121},(_,i)=>{const t=i/120;
    return v3(-244+488*t,0,-176+38*Math.sin(t*TAU*1.5));});
  makeRoad(hillsideTrail,6.4);makeRoad(cypressTrail,6.5);
  const marketLoop=Array.from({length:89},(_,i)=>{const a=i/88*TAU;
    return v3(-118+Math.cos(a)*28,0,102+Math.sin(a)*25);});
  makeRoad(marketLoop,6.8,true);
  const squareTex=paintTexture('./assets/cobbles-v9.webp',3.2,3.2);
  const square=mesh(new THREE.CircleGeometry(21,64),isMobile?
    new THREE.MeshBasicMaterial({map:squareTex,color:0xffffff,toneMapped:false}):
    new THREE.MeshStandardMaterial({map:squareTex,color:0xf8e7ff,roughness:.96}));
  square.rotation.x=-Math.PI/2;square.position.y=.071;scene.add(square);

  // Shared UV-mapped roof geometry: previous individual roofs lacked UVs, so
  // their paint map could not actually appear. Every house now uses the same
  // textured gable, later merged into one GPU instance batch.
  const roofPrototype=(()=>{
    const pts=[[-.59,0,-.58],[0,1,-.58],[.59,0,-.58],
      [-.59,0,.58],[0,1,.58],[.59,0,.58]];
    const faces=[0,3,1,3,4,1,1,4,2,4,5,2,0,1,2,3,5,4];
    const data=[],uv=[];
    for(const idx of faces){
      const p=pts[idx];data.push(...p);
      uv.push((p[2]+.58)/1.16,1-Math.abs(p[0])/.59);
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(data,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geo.computeVertexNormals();return geo;
  })();
  function makePitchedRoof(width,depth,height,rise,roofColor){
    const mat=isMobile?
      new THREE.MeshBasicMaterial({color:roofColor,map:roofBrushTexture,side:THREE.DoubleSide,toneMapped:false}):
      material(roofColor,{side:THREE.DoubleSide,map:roofBrushTexture,roughness:1});
    const roof=mesh(roofPrototype,mat,0,height,0);
    roof.scale.set(width,rise,depth);roof.userData.staticPrototype='roof';return roof;
  }

  const timberBeamMat=material(0x364052,{roughness:1});
  function makeHouse(x,z,seed,rotation=0){
    const width=5.1+rand(seed+11)*4.6,depth=5.8+rand(seed+12)*3.1;
    const height=4.6+rand(seed+13)*4.5;
    const palette=[0xd5e9ff,0xc1c7f7,0xf6cdd2,0xf1d1b7,0xbde0d6,0xffdbb5,0xd8d0f6,0xdbe7ff];
    const roofs=[0xffc7bf,0xf5b7b1,0xbad4fa,0xffd5b9,0xdfc1f1,0xc7dfef];
    const wallTint=choice(palette,seed+1);
    const wallMat=isMobile?
      new THREE.MeshBasicMaterial({color:wallTint,map:wallBrushTexture,toneMapped:false}):
      material(wallTint,{map:wallBrushTexture,roughness:1});
    const roofMat=choice(roofs,seed+3);
    const house=new THREE.Group();house.position.set(x,0,z);house.rotation.y=rotation;
    const body=box(width,height,depth,wallMat,0,height*.5,0);body.receiveShadow=true;body.castShadow=!isMobile&&seed%4===0;house.add(body);
    house.add(makePitchedRoof(width,depth,height,1.6+rand(seed+5)*1.5,roofMat));
    house.add(box(width*1.11,.13,depth*1.12,MAT.darkWood,0,height+.07,0));
    const frames=material(0x1b2e42,{roughness:1});
    for(const face of [-1,1])for(let floor=0;floor<(height>7?2:1);floor++)for(let col=-1;col<=1;col+=2){
      const wy=1.85+floor*2.65,wx=col*width*.24,wz=face*(depth*.501+.02);
      const windowFrame=box(1.12,1.36,.18,frames,wx,wy,wz);house.add(windowFrame);
      const pane=box(.83,1.03,.19,(rand(seed+floor+col+face*5)>.18?MAT.glass:MAT.glassDim),wx,wy,wz+face*.08);house.add(pane);
      house.add(box(.08,1.1,.25,frames,wx,wy,wz+face*.16));
      house.add(box(.98,.08,.25,frames,wx,wy,wz+face*.16));
    }
    // Many houses in the filmed village are half-timbered. Those dark wooden
    // cross-braces transform a flat blue block into a recognizable old-world
    // facade; the batcher packs every brace into the same instanced mesh, so
    // adding this architectural silhouette costs no additional draw calls.
    if(seed%3!==2){
      for(const face of [-1,1]){
        const zFace=face*(depth*.501+.13);
        for(const xEdge of [-1,1])
          house.add(box(.19,height*.9,.13,timberBeamMat,xEdge*width*.47,height*.48,zFace));
        house.add(box(width*.96,.2,.13,timberBeamMat,0,height*.61,zFace));
        house.add(box(width*.96,.14,.13,timberBeamMat,0,.8,zFace));
        for(const side of [-1,1]){
          const dx=side*width*.34,dy=height*.3;
          const brace=box(.17,Math.hypot(dx,dy),.12,timberBeamMat,
            side*width*.22,height*.79,zFace+face*.075);
          brace.rotation.z=-Math.atan2(dx,dy);house.add(brace);
        }
      }
    }
    house.add(box(1.35,2.3,.14,MAT.darkWood,0,1.17,depth*.514));
    house.add(mesh(new THREE.SphereGeometry(.09,8,6),MAT.gold,.38,1.17,depth*.64));
    if(seed%3===0){
      const flowers=material(0xc34176,{emissive:0x662850,emissiveIntensity:.3});
      for(const side of [-1,1]){
        house.add(box(1.5,.29,.46,MAT.darkWood,side*width*.24,1.31,depth*.58));
        for(let p=-1;p<=1;p++)house.add(mesh(new THREE.SphereGeometry(.13,6,5),flowers,
          side*width*.24+p*.34,1.5,depth*.61));
      }
    }
    const chimney=box(.95,1.6,.9,material(0x6c5a6e),width*.25,height+1,depth*.16);house.add(chimney);
    // Rich, painterly trim lines on roof edges.
    house.add(box(width*.98,.1,.14,curbMat,0,height+.2,-depth*.55));
    house.add(box(width*.98,.1,.14,curbMat,0,height+.2,depth*.55));
    // Windows glow through emissive paint; individual dynamic lights per house
    // were a major GPU bottleneck and are deliberately omitted.
    scene.add(house);staticBatchRoots.push(house);
    houseSlots.push({x,z,height,width,depth,rotation});
    buildingColliders.push({x,z,rx:width*.56,rz:depth*.56});
  }

  // Keep the rideable lane genuinely open. Building placement is checked
  // against every cobblestone path (not merely the world axes).
  function clearOfRoad(x,z,margin){
    if(Math.hypot(x,z)<27)return false;
    for(const path of roadPaths){
      for(let i=0;i<path.length;i+=2){
        const p=path[i];
        if(Math.abs(x-p.x)<margin&&Math.abs(z-p.z)<margin&&Math.hypot(x-p.x,z-p.z)<margin)return false;
      }
    }
    return true;
  }

  // Four neighborhoods surround a broad, rideable church square.
  let houseSeed=1;
  const nearHouseCount=isMobile?29:38;
  for(let i=0;i<nearHouseCount;i++){
    const a=i/nearHouseCount*TAU+rand(i*19)*.13,r=61+rand(i+19)*24;
    const x=Math.cos(a)*r,z=Math.sin(a)*r;
    if(!clearOfRoad(x,z,11.6))continue;
    makeHouse(x,z,houseSeed++, -a+Math.PI*.5);
  }
  for(let i=0;i<(isMobile?19:32);i++){
    const x=(rand(i*17+190)-.5)*330,z=(rand(i*22+123)-.5)*328;
    if(Math.hypot(x,z)<80||!clearOfRoad(x,z,12))continue;
    makeHouse(x,z,houseSeed++,rand(i+17)*TAU);
  }

  // Densely painted outer neighborhoods. Instanced geometry lets a much
  // larger map have 150+ colorful townhouses without hundreds of draw calls.
  function addInstancedNeighborhoods(){
    const lots=[];
    // Distribute dense, but cheap, rowhouses across *all* winding streets.
    // The earlier loop filled its lot budget along the first few roads and
    // left entire outlying districts looking empty from the chase camera.
    const maxLots=isMobile?196:292;
    const pathQuota=Math.ceil(maxLots/roadPaths.length);
    const clearLot=(x,z,width,depth)=>{
      if(Math.max(Math.abs(x),Math.abs(z))>257)return false;
      if(!clearOfRoad(x,z,Math.max(width,depth)*.5+5.7))return false;
      return !buildingColliders.some(b=>Math.abs(x-b.x)<b.rx+width*.52+1.8&&
        Math.abs(z-b.z)<b.rz+depth*.53+1.8);
    };
    for(let sweep=0;sweep<2&&lots.length<maxLots;sweep++){
      for(let pathIndex=0;pathIndex<roadPaths.length&&lots.length<maxLots;pathIndex++){
        const path=roadPaths[pathIndex];
        const step=pathIndex<5?(sweep?5:7):(sweep?4:6);
        let addedOnPath=0;
        for(let i=sweep?11:8;i<path.length-7&&lots.length<maxLots;i+=step){
          if(sweep===0&&addedOnPath>=pathQuota)break;
        const p=path[i],prev=path[Math.max(0,i-2)],next=path[Math.min(path.length-1,i+2)];
        const dx=next.x-prev.x,dz=next.z-prev.z,len=Math.hypot(dx,dz)||1;
        const rightX=-dz/len,rightZ=dx/len;
        for(const side of [-1,1]){
          if(lots.length>=maxLots)break;
          const seed=pathIndex*107+i*11+side*3+sweep*1301;
          if(rand(seed+12)<.19)continue;
          const width=5.6+rand(seed+16)*3.4,depth=5.2+rand(seed+17)*3.5;
          const offset=11.4+rand(seed+29)*2.4;
          const x=p.x+rightX*side*offset,z=p.z+rightZ*side*offset;
          if(!clearLot(x,z,width,depth))continue;
          const height=5+rand(seed+19)*9;
          const rotation=Math.atan2(dx,dz)+Math.PI*(side<0?0:1);
          lots.push({x,z,width,depth,height,rotation,seed});
          addedOnPath++;
          buildingColliders.push({x,z,rx:width*.57,rz:depth*.57});
          houseSlots.push({x,z,height,width,depth,rotation});
        }
      }
      }
    }
    const bodyGeo=new THREE.BoxGeometry(1,1,1);
    const windowGeo=new THREE.BoxGeometry(1,1,.11);
    const roofGeometry=roofPrototype;
    const bodyPaint=isMobile?
      new THREE.MeshBasicMaterial({color:0xffffff,map:wallBrushTexture,toneMapped:false}):
      material(0xffffff,{map:wallBrushTexture,roughness:1});
    const roofPaint=isMobile?
      new THREE.MeshBasicMaterial({color:0xffffff,map:roofBrushTexture,side:THREE.DoubleSide,toneMapped:false}):
      material(0xffffff,{map:roofBrushTexture,side:THREE.DoubleSide,roughness:1});
    const bodies=new THREE.InstancedMesh(bodyGeo,bodyPaint,lots.length);
    const roofs=new THREE.InstancedMesh(roofGeometry,roofPaint,lots.length);
    const doors=new THREE.InstancedMesh(bodyGeo,MAT.darkWood,lots.length);
    const windows=new THREE.InstancedMesh(windowGeo,new THREE.MeshStandardMaterial({
      color:0xffd9a0,emissive:0xffb355,emissiveIntensity:1.9,roughness:.52}),lots.length*4);
    // Architectural detail stays in three additional draw calls for the
    // *whole map*: framed windows, colorful shutters and chimneys. These are
    // much easier to read than unbroken pastel boxes at bicycle height.
    const trims=new THREE.InstancedMesh(windowGeo,MAT.darkWood,lots.length*4);
    const shutters=new THREE.InstancedMesh(windowGeo,isMobile?
      new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}):
      material(0xffffff,{roughness:.91}),lots.length*8);
    const chimneys=new THREE.InstancedMesh(bodyGeo,material(0x745867,{roughness:1}),lots.length);
    const houseColors=[0xfde2cb,0xb1cfef,0xf7b3a8,0xe7b36f,0xb0d7cb,0xe59a9a,0xc4b5f1,0xa4b9e8,0xe9d5b5,0xcf8a8f,0x8eafd0];
    const roofColors=[0xffb8aa,0xffcfac,0xa2bfd8,0xe7c1c6,0xffc18a,0xadbacf];
    const shutterColors=[0xa84431,0x29577a,0x8c4846,0x49655e,0xd7a368,0x395171];
    const dummy=new THREE.Object3D();let windowIndex=0,shutterIndex=0;
    function place(instance,index,x,y,z,rx,ry,rz,scaleX,scaleY,scaleZ){
      dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,rz);dummy.scale.set(scaleX,scaleY,scaleZ);
      dummy.updateMatrix();instance.setMatrixAt(index,dummy.matrix);
    }
    for(let i=0;i<lots.length;i++){
      const l=lots[i];
      place(bodies,i,l.x,l.height*.5,l.z,0,l.rotation,0,l.width,l.height,l.depth);
      bodies.setColorAt(i,new THREE.Color(choice(houseColors,l.seed)));
      place(roofs,i,l.x,l.height,l.z,0,l.rotation,0,l.width,2.5+rand(l.seed+60)*2,l.depth);
      roofs.setColorAt(i,new THREE.Color(choice(roofColors,l.seed+41)));
      const c=Math.cos(l.rotation),s=Math.sin(l.rotation);
      place(doors,i,l.x+s*l.depth*.51,1.15,l.z+c*l.depth*.51,0,l.rotation,0,1.25,2.3,.13);
      const chimneyX=l.width*.25,chimneyZ=-l.depth*.17;
      place(chimneys,i,l.x+c*chimneyX+s*chimneyZ,l.height+1.1,l.z-s*chimneyX+c*chimneyZ,
        0,l.rotation,0,.84,2.1,.82);
      for(const face of [-1,1])for(const side of [-1,1]){
        const localX=side*l.width*.26,localZ=face*l.depth*.515;
        const x=l.x+c*localX+s*localZ,z=l.z-s*localX+c*localZ;
        const wy=2.8+(l.height>9?1.4:0);
        place(trims,windowIndex,x,wy,z,0,l.rotation,0,1.35,1.55,.17);
        place(windows,windowIndex,x+s*face*.13,wy,z+c*face*.13,0,l.rotation,0,.93,1.22,.16);
        windows.setColorAt(windowIndex,new THREE.Color(choice([0xffd9a1,0xffe5bd,0xf3b4aa,0xffc979],l.seed+windowIndex)));
        for(const direction of [-1,1]){
          const shutterX=localX+direction*.63;
          const sx=l.x+c*shutterX+s*(localZ+face*.12);
          const sz=l.z-s*shutterX+c*(localZ+face*.12);
          place(shutters,shutterIndex,sx,wy,sz,0,l.rotation,0,.26,1.39,.14);
          shutters.setColorAt(shutterIndex,new THREE.Color(choice(shutterColors,l.seed+side*7+face*3)));
          shutterIndex++;
        }
        windowIndex++;
      }
    }
    for(const item of [bodies,roofs,doors,trims,windows,shutters,chimneys]){
      item.instanceMatrix.needsUpdate=true;
      if(item.instanceColor)item.instanceColor.needsUpdate=true;
      item.frustumCulled=false;scene.add(item);
    }
  }
  addInstancedNeighborhoods();

  // All cypress branches are instanced (three draw calls for an entire forest).
  // This keeps the richer 600 m map smooth on mobile rather than creating one
  // expensive draw call per individual brushstroke.
  function addCypressForest(){
    const trees=[];
    for(let i=0;i<(isMobile?129:200);i++){
      const a=rand(i*4+7)*TAU,r=38+rand(i*2+88)*250;
      const x=Math.cos(a)*r,z=Math.sin(a)*r;
      if(buildingColliders.some(b=>Math.abs(b.x-x)<8&&Math.abs(b.z-z)<8))continue;
      if(!clearOfRoad(x,z,5.7))continue;
      trees.push({x,z,seed:i+11,h:9+rand(i+12)*11});
    }
    const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.25,.42,1,6),
      material(0x213545),trees.length);
    const foliage=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1,7,1),
      material(0xffffff,{flatShading:true}),trees.length*4);
    const strokeCount=isMobile?3:5;
    const strokes=new THREE.InstancedMesh(new THREE.CylinderGeometry(.035,.06,.7,4),
      material(0xffffff,{emissive:0x143c41,emissiveIntensity:.17}),trees.length*strokeCount);
    const foliageColors=[0x0a2931,0x11343a,0x183f3d,0x0a3038,0x174847];
    for(let i=0;i<trees.length;i++){
      const {x,z,seed,h}=trees[i];
      tempObject.position.set(x,h*.24,z);tempObject.rotation.set(0,0,0);
      tempObject.scale.set(1,h*.47,1);tempObject.updateMatrix();trunks.setMatrixAt(i,tempObject.matrix);
      for(let k=0;k<4;k++){
        const taper=1-k*.19,r=(2.25+rand(seed+4)*.8)*taper;
        tempObject.position.set(x+Math.sin(seed+k)*.15,h*(.38+k*.16),z);
        tempObject.rotation.set(0,0,Math.sin(seed+k)*.045);
        tempObject.scale.set(r,h*.45,r);tempObject.updateMatrix();
        const index=i*4+k;foliage.setMatrixAt(index,tempObject.matrix);
        foliage.setColorAt(index,new THREE.Color(choice(foliageColors,seed+k)));
      }
      for(let j=0;j<strokeCount;j++){
        const y=h*(.18+rand(seed+j*3)*.72),angle=rand(seed*7+j)*TAU;
        const r=1.2+(1-y/h)*.8,index=i*strokeCount+j;
        tempObject.position.set(x+Math.sin(angle)*r,y,z+Math.cos(angle)*r);
        tempObject.rotation.set(0,0,.5);tempObject.scale.set(1,1,1);tempObject.updateMatrix();
        strokes.setMatrixAt(index,tempObject.matrix);
        strokes.setColorAt(index,new THREE.Color(j%3?0x38746b:0x9a9b76));
      }
    }
    for(const item of [trunks,foliage,strokes]){
      item.instanceMatrix.needsUpdate=true;if(item.instanceColor)item.instanceColor.needsUpdate=true;
      item.frustumCulled=false;scene.add(item);
    }
  }
  addCypressForest();

  // Small flower meadows bring the painterly countryside right up to the
  // village lanes. Hundreds of blossoms cost only two instanced draw calls.
  function addBrushstrokeFlowers(){
    const meadows=[[-137,49,33],[99,107,39],[142,-148,44],[-217,209,40],
      [212,153,41],[-62,-202,42],[157,-25,31]];
    const flowers=[];
    for(let i=0;i<(isMobile?570:900);i++){
      const [cx,cz,r]=meadows[i%meadows.length];
      const a=rand(i*13+7)*TAU,rr=Math.sqrt(rand(i*19+11))*r;
      const x=cx+Math.cos(a)*rr,z=cz+Math.sin(a)*rr;
      if(!clearOfRoad(x,z,2.4)||buildingColliders.some(b=>
        Math.abs(x-b.x)<b.rx+1&&Math.abs(z-b.z)<b.rz+1))continue;
      flowers.push({x,z,h:.48+rand(i*5+15)*.49,seed:i});
    }
    const stems=new THREE.InstancedMesh(new THREE.CylinderGeometry(.032,.049,1,4),
      material(0x39765a,{roughness:1}),flowers.length);
    const petals=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.23,0),
      new THREE.MeshBasicMaterial({color:0xffffff}),flowers.length);
    const colors=[0xe9b75e,0xf7d593,0xd382aa,0xd9b0df,0x9ac7d4,0xf4e2b9];
    for(let i=0;i<flowers.length;i++){
      const {x,z,h,seed}=flowers[i];
      tempObject.position.set(x,h*.5,z);tempObject.rotation.set(0,0,0);
      tempObject.scale.set(1,h,1);tempObject.updateMatrix();stems.setMatrixAt(i,tempObject.matrix);
      tempObject.position.set(x,h+.035,z);
      tempObject.rotation.set(rand(seed+53)*TAU,0,rand(seed+61)*TAU);
      tempObject.scale.set(.72+rand(seed+28)*.8,.65+rand(seed+34)*.5,.75);tempObject.updateMatrix();
      petals.setMatrixAt(i,tempObject.matrix);
      petals.setColorAt(i,new THREE.Color(colors[seed%colors.length]));
    }
    for(const instance of [stems,petals]){
      instance.instanceMatrix.needsUpdate=true;
      if(instance.instanceColor)instance.instanceColor.needsUpdate=true;
      instance.frustumCulled=false;scene.add(instance);
    }
  }
  addBrushstrokeFlowers();

  // Impasto strokes as instances keep the ground lively with few draw calls.
  const strokeMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.24,.07,1.6),
    new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.39}),580);
  const strokeColors=[0x5d9ca2,0x315b74,0x8b92a2,0xb69b72,0x2b626c,0x5a7697];
  for(let i=0;i<580;i++){
    const x=(rand(i*17+9)-.5)*620,z=(rand(i*71+13)-.5)*620;
    tempObject.position.set(x,.02,z);tempObject.rotation.set(0,rand(i+7)*TAU,0);
    const length=.4+rand(i+23)*1.8;
    tempObject.scale.set(.5+rand(i+19),1,length);tempObject.updateMatrix();
    strokeMesh.setMatrixAt(i,tempObject.matrix);strokeMesh.setColorAt(i,new THREE.Color(strokeColors[i%strokeColors.length]));
  }
  strokeMesh.instanceMatrix.needsUpdate=true;scene.add(strokeMesh);

  // Discoverable landmarks make the larger region feel like a real place:
  // a moonlit canal, flower market, windmill ridge, orchard and vineyard.
  const districts=[
    {name:'VINCENT\'S VILLAGE',x:0,z:0,r:106},
    {name:'LANTERN MARKET',x:-118,z:102,r:54},
    {name:'WINDMILL RIDGE',x:-222,z:-210,r:51},
    {name:'MOONLIT CANAL',x:234,z:10,r:72},
    {name:'CYPRESS HILLS',x:50,z:-208,r:64},
    {name:'PAINTED VINEYARD',x:-180,z:188,r:64},
    {name:'GOLDEN ORCHARD',x:203,z:195,r:58}
  ];
  const landmarkMarkers=[];
  const waterMaterial=material(0x2f91ae,{emissive:0x115a86,emissiveIntensity:.35,roughness:.28,metalness:.22});
  const canalCurve=Array.from({length:70},(_,i)=>{
    const z=-274+i*7.9;return v3(260+Math.sin(z*.018)*11,0,z);
  });
  // Ground-water ribbon; the rocky rim forms the landscape's eastern edge.
  const waterVerts=[],waterUV=[],waterIndices=[];
  for(let i=0;i<canalCurve.length;i++){
    const p=canalCurve[i];waterVerts.push(p.x-9,.105,p.z,p.x+9,.105,p.z);
    waterUV.push(0,i*.3,1,i*.3);
    if(i){const v=i*2;waterIndices.push(v-2,v-1,v,v-1,v+1,v);}
  }
  const waterGeo=new THREE.BufferGeometry();
  waterGeo.setAttribute('position',new THREE.Float32BufferAttribute(waterVerts,3));
  waterGeo.setAttribute('uv',new THREE.Float32BufferAttribute(waterUV,2));
  waterGeo.setIndex(waterIndices);waterGeo.computeVertexNormals();
  scene.add(mesh(waterGeo,waterMaterial));
  const waterRipples=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.025,1),
    new THREE.MeshBasicMaterial({color:0x89ccdd,transparent:true,opacity:.34}),210);
  for(let i=0;i<210;i++){
    const z=-260+rand(i*9+11)*510,x=260+Math.sin(z*.018)*11+(rand(i*7+5)-.5)*14;
    tempObject.position.set(x,.14,z);tempObject.rotation.set(0,rand(i+5)*TAU,0);
    tempObject.scale.set(.3+rand(i+3)*2,1,.06+rand(i+7)*.13);tempObject.updateMatrix();
    waterRipples.setMatrixAt(i,tempObject.matrix);
  }
  waterRipples.instanceMatrix.needsUpdate=true;waterRipples.frustumCulled=false;scene.add(waterRipples);
  for(const [x,z] of [[253,-100],[260,0],[268,112],[251,206]]){
    const bridge=mesh(new THREE.BoxGeometry(24,.26,7.7),material(0xa69a9b,{map:cobbleTexture}),x,.26,z);
    bridge.receiveShadow=true;scene.add(bridge);
    for(const side of [-1,1]){
      const wall=box(24,1.1,.5,material(0x86869b),x,.85,z+side*4.1);scene.add(wall);
    }
  }
  landmarkMarkers.push({name:'Canal bridges',x:260,z:0});

  const marketPoint=v3(-118,0,102);
  const marketFlagMats=[material(0xcf6e83,{side:THREE.DoubleSide}),material(0xe3aa64,{side:THREE.DoubleSide}),material(0x5b92a1,{side:THREE.DoubleSide})];
  for(let i=0;i<8;i++){
    const a=i/8*TAU,x=marketPoint.x+Math.cos(a)*12,z=marketPoint.z+Math.sin(a)*12;
    const stand=new THREE.Group();stand.position.set(x,0,z);stand.rotation.y=-a;
    scene.add(stand);staticBatchRoots.push(stand);
    const timber=material(0x75607b,{roughness:1});
    stand.add(box(4,1.2,2.2,timber,0,1,0));
    stand.add(mesh(new THREE.ConeGeometry(3.0,2.3,4),marketFlagMats[i%3],0,3.7,0));
    stand.add(box(2.8,.22,.19,MAT.gold,0,2.07,1.2));
    for(const side of [-1,1])stand.add(box(.1,2.7,.1,timber,side*1.8,2.1,.9));
  }
  const fountainBase=mesh(new THREE.CylinderGeometry(4.6,4.9,1,14),material(0x687ca2),-118,.45,102);
  scene.add(fountainBase);
  scene.add(mesh(new THREE.CylinderGeometry(4,4,.11,14),material(0x78bfc2,{emissive:0x2c6c8b,emissiveIntensity:.36}),-118,1.02,102));
  scene.add(mesh(new THREE.CylinderGeometry(.46,.67,4,10),material(0xe5c4a1),-118,2.5,102));
  buildingColliders.push({x:-118,z:102,rx:4.2,rz:4.2});
  landmarkMarkers.push({name:'Lantern Market',x:-118,z:102});

  const windmill=new THREE.Group();windmill.position.set(-231,0,-226);scene.add(windmill);
  const windBody=mesh(new THREE.CylinderGeometry(3.8,5.5,18,12),material(0xd2ba9c,{map:wallBrushTexture}),0,9,0);
  windBody.castShadow=!isMobile;windmill.add(windBody);
  windmill.add(mesh(new THREE.ConeGeometry(5.5,6,12),material(0x9d5465,{map:roofBrushTexture}),0,21,0));
  for(let k=0;k<3;k++)windmill.add(box(.85,1.3,.3,MAT.glass,0,6+k*4,4.5-k*.2));
  const windmillRotor=new THREE.Group();windmillRotor.position.set(0,17,4.2);windmill.add(windmillRotor);
  windmillRotor.add(mesh(new THREE.CylinderGeometry(.4,.4,1.1,10),MAT.frame,0,0,.2));
  for(let i=0;i<4;i++){
    const blade=new THREE.Group();blade.rotation.z=i*Math.PI*.5;windmillRotor.add(blade);
    blade.add(box(.34,11,.38,MAT.darkWood,0,5.3,.5));
    blade.add(box(2.5,6,.15,material(0xcbbb9e,{side:THREE.DoubleSide}),0,7,.77));
    for(let j=0;j<5;j++)blade.add(box(2.5,.10,.19,MAT.darkWood,0,4.4+j*1.1,.9));
  }
  buildingColliders.push({x:-231,z:-226,rx:5.6,rz:5.6});
  landmarkMarkers.push({name:'Windmill Ridge',x:-231,z:-226});

  const vineyardRows=new THREE.InstancedMesh(new THREE.CylinderGeometry(.13,.2,1,5),
    material(0x4f6c48,{roughness:1}),168);
  let vineCount=0;
  for(let i=0;i<12;i++)for(let j=0;j<14;j++){
    const x=-223+i*6.1,z=166+j*5.2;
    if(!clearOfRoad(x,z,2.9)){
      tempObject.position.set(-340,0,-340);tempObject.scale.set(.01,.01,.01);
    }else{
      tempObject.position.set(x,.86,z);tempObject.scale.set(1,1.7+rand(i*19+j)*.8,1);
    }
    tempObject.rotation.set(0,0,0);tempObject.updateMatrix();vineyardRows.setMatrixAt(vineCount++,tempObject.matrix);
  }
  vineyardRows.instanceMatrix.needsUpdate=true;vineyardRows.frustumCulled=false;scene.add(vineyardRows);
  landmarkMarkers.push({name:'Painted Vineyard',x:-180,z:188});

  // Orchard trees have low foliage so players can see the route ahead.
  const orchardTreePositions=[];
  for(let i=0;i<23;i++){
    const x=185+(rand(i*14+7)-.5)*74,z=194+(rand(i*26+31)-.5)*87;
    if(!clearOfRoad(x,z,4.3))continue;
    orchardTreePositions.push({x,z,seed:i});
  }
  const orchardTrunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.25,.4,3.8,6),
    MAT.darkWood,orchardTreePositions.length);
  const orchardCanopies=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),
    material(0x57795a,{flatShading:true,roughness:1}),orchardTreePositions.length);
  const orchardFruit=new THREE.InstancedMesh(new THREE.SphereGeometry(.24,6,5),
    material(0xe6b65b,{emissive:0x8d6427,emissiveIntensity:.25}),orchardTreePositions.length*3);
  orchardTreePositions.forEach(({x,z,seed},i)=>{
    tempObject.rotation.set(0,0,0);
    tempObject.position.set(x,1.9,z);tempObject.scale.set(1,1,1);
    tempObject.updateMatrix();orchardTrunks.setMatrixAt(i,tempObject.matrix);
    const radius=2.9+rand(seed+11)*.75;
    tempObject.position.set(x,4.6,z);tempObject.scale.setScalar(radius);
    tempObject.updateMatrix();orchardCanopies.setMatrixAt(i,tempObject.matrix);
    for(let j=0;j<3;j++){
      tempObject.position.set(x+Math.sin(seed+j*2.7)*1.8,4.3+Math.cos(j+seed)*1.2,
        z+Math.cos(seed+j*2.7)*1.8);
      tempObject.scale.set(1,1,1);tempObject.updateMatrix();
      orchardFruit.setMatrixAt(i*3+j,tempObject.matrix);
    }
  });
  for(const instance of [orchardTrunks,orchardCanopies,orchardFruit]){
    instance.instanceMatrix.needsUpdate=true;instance.frustumCulled=false;scene.add(instance);
  }
  landmarkMarkers.push({name:'Golden Orchard',x:203,z:195});

  // Warm lamps along important streets give the player an inviting route.
  // An additive ground halo suggests golden light on the purple cobbles
  // without a real light or a dynamic shadow for each post.
  const lampLocations=[];
  for(let road=0;road<roadPaths.length;road+=2){
    const p=roadPaths[road];
    for(let i=9;i<p.length-8;i+=19){
      const point=p[i];if(Math.hypot(point.x,point.z)>257)continue;
      const side=i%2?1:-1,z=point.z+side*5.9,x=point.x+side*5.9;
      const lamp=new THREE.Group();lamp.position.set(x,0,z);
      lamp.add(box(.2,5.1,.2,MAT.darkWood,0,2.55,0));
      lamp.add(box(.74,.95,.74,MAT.glass,0,5.3,0));
      lamp.add(mesh(new THREE.ConeGeometry(.7,.55,4),MAT.darkWood,0,6.05,0));
      // Lamp geometry stays bright without adding another point light per post.
      scene.add(lamp);staticBatchRoots.push(lamp);
      lampLocations.push({x,z});
    }
  }
  const glowPool=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),
    new THREE.MeshBasicMaterial({map:haloTexture,color:0xffb86c,transparent:true,
      opacity:.37,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:true}),
    lampLocations.length);
  for(let i=0;i<lampLocations.length;i++){
    const {x,z}=lampLocations[i];
    tempObject.position.set(x,.092,z);tempObject.rotation.set(-Math.PI*.5,0,0);
    tempObject.scale.set(10.5,10.5,1);tempObject.updateMatrix();
    glowPool.setMatrixAt(i,tempObject.matrix);
  }
  glowPool.instanceMatrix.needsUpdate=true;glowPool.frustumCulled=false;scene.add(glowPool);

  // Suspended star-lantern garlands make the long lanes feel inhabited. A
  // single instanced mesh creates the illuminated bulbs; a single line mesh
  // draws every cable. No additional light calculations are introduced.
  const lightStrings=[
    {x:0,z:69,axis:'x'},{x:0,z:38,axis:'x'},{x:0,z:-31,axis:'x'},
    {x:-111,z:57,axis:'x'},{x:76,z:-88,axis:'x'},
    {x:138,z:109,axis:'z'},{x:-165,z:194,axis:'z'},
    {x:-205,z:-147,axis:'x'},{x:146,z:-190,axis:'z'}
  ];
  const festoonBulbs=new THREE.InstancedMesh(new THREE.SphereGeometry(.19,7,5),
    new THREE.MeshBasicMaterial({color:0xffe7ac}),lightStrings.length*9);
  const cablePoints=[];
  for(let i=0;i<lightStrings.length;i++){
    const line=lightStrings[i],bulbCount=9;
    const at=t=>v3(line.x+(line.axis==='x'?t:0),6.4-1.15*(1-t*t/144),
      line.z+(line.axis==='z'?t:0));
    let prev=at(-12);
    for(let j=1;j<=16;j++){
      const next=at(-12+j*1.5);cablePoints.push(prev.x,prev.y,prev.z,next.x,next.y,next.z);prev=next;
    }
    for(let b=0;b<bulbCount;b++){
      const pos=at(-10+b*2.5);
      tempObject.position.copy(pos);tempObject.rotation.set(0,0,0);
      tempObject.scale.setScalar(.82+(b%3)*.16);tempObject.updateMatrix();
      festoonBulbs.setMatrixAt(i*bulbCount+b,tempObject.matrix);
      festoonBulbs.setColorAt(i*bulbCount+b,new THREE.Color(b%3?0xffd68f:0xffffff));
    }
  }
  festoonBulbs.instanceMatrix.needsUpdate=true;
  if(festoonBulbs.instanceColor)festoonBulbs.instanceColor.needsUpdate=true;
  scene.add(festoonBulbs);
  const cableGeo=new THREE.BufferGeometry();
  cableGeo.setAttribute('position',new THREE.Float32BufferAttribute(cablePoints,3));
  scene.add(new THREE.LineSegments(cableGeo,new THREE.LineBasicMaterial({color:0x8b8292,transparent:true,opacity:.8})));

  // Church: hand-built village landmark, steep roof and a luminous delivery beam.
  const church=new THREE.Group();scene.add(church);
  const churchStone=material(0x66778c,{roughness:.98});
  const churchTrim=material(0x93a5ac,{roughness:.94});
  const churchRoof=material(0x314c77,{roughness:1,flatShading:true});
  const mainNave=box(12,10,20,churchStone,0,5,0);mainNave.receiveShadow=true;mainNave.castShadow=!isMobile;church.add(mainNave);
  church.add(makePitchedRoof(12.5,20.5,10,5,0x365477));
  const steeple=box(7,26,7,churchStone,0,13,10.2);steeple.castShadow=!isMobile;church.add(steeple);
  church.add(mesh(new THREE.ConeGeometry(5.65,15,4),churchRoof,0,33.4,10.2));
  church.add(box(.48,5,.48,MAT.gold,0,42.1,10.2));
  church.add(box(3.4,.48,.48,MAT.gold,0,42.9,10.2));
  for(const side of [-1,1])for(let i=0;i<3;i++){
    const wx=side*6.07,wz=-5+i*5.5;
    const frame=box(.3,4.2,2.2,churchTrim,wx,5.7,wz);church.add(frame);
    const pane=box(.32,3.6,1.6,MAT.glass,wx+side*.1,5.7,wz);church.add(pane);
  }
  church.add(box(3.6,5,.25,MAT.darkWood,0,2.5,13.85));
  church.add(mesh(new THREE.TorusGeometry(1.5,.31,8,24),churchTrim,0,13,13.85));
  church.add(mesh(new THREE.CircleGeometry(1.25,32),MAT.glass,0,13,14.04));
  buildingColliders.push({x:0,z:0,rx:7,rz:10});
  buildingColliders.push({x:0,z:10.2,rx:4.8,rz:4.0});
  const deliveryPoint=v3(0,0,20);
  const beamMaterial=new THREE.MeshBasicMaterial({color:0xffd77c,transparent:true,opacity:.13,
    depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
  const beam=mesh(new THREE.CylinderGeometry(4.0,5.5,70,24,1,true),beamMaterial,0,35,20);
  scene.add(beam);
  const beamCore=mesh(new THREE.CylinderGeometry(.55,1.4,70,14,1,true),
    new THREE.MeshBasicMaterial({color:0xffecaf,transparent:true,opacity:.16,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}),0,35,20);
  scene.add(beamCore);
  const deliveryRing=mesh(new THREE.TorusGeometry(5.7,.17,8,80),MAT.gold,0,.22,20);
  deliveryRing.rotation.x=-Math.PI/2;scene.add(deliveryRing);
  const deliveryLight=new THREE.PointLight(0xffd277,28,24,1.4);deliveryLight.position.set(0,5,20);scene.add(deliveryLight);
  const chapelSparkles=[];
  const chapelSparkleMesh=new THREE.InstancedMesh(new THREE.OctahedronGeometry(.15,0),
    new THREE.MeshBasicMaterial({color:0xffe4a4,transparent:true,opacity:.92,
      blending:THREE.AdditiveBlending,depthWrite:false}),32);
  chapelSparkleMesh.frustumCulled=false;scene.add(chapelSparkleMesh);
  for(let i=0;i<32;i++){
    const a=i/32*TAU,r=2+rand(i+91)*3.7,y=rand(i+43)*25;
    chapelSparkles.push({angle:a,r,offset:y,size:.8+rand(i*4)*1.2});
  }

  // Mobile GPUs suffer from 1,000+ tiny calls for doors, windows, roof trim
  // and lamp posts. These objects never move, so flatten their world matrices
  // into a handful of instanced unit cubes. Colors are per instance; canvas
  // impasto maps and emissive window materials are preserved. Moving bicycle,
  // windmill blades, word orbs, and effects remain separate and interactive.
  staticBatchRoots.push(church);
  function batchStaticBoxes(){
    const buckets=new Map(),matrixScale=new THREE.Matrix4();
    const chunkSize=128;
    const unitCube=new THREE.BoxGeometry(1,1,1);
    for(const root of staticBatchRoots){
      root.updateMatrixWorld(true);
      root.traverse(item=>{
        if(!item.isMesh||item.isInstancedMesh||
          (item.geometry?.type!=='BoxGeometry'&&item.userData.staticPrototype!=='roof')||
          !item.material||Array.isArray(item.material))return;
        const mat=item.material;
        const isRoof=item.userData.staticPrototype==='roof';
        const {width=1,height=1,depth=1}=item.geometry.parameters||{};
        matrixScale.makeScale(width,height,depth);
        const matrix=isRoof?item.matrixWorld.clone():
          new THREE.Matrix4().multiplyMatrices(item.matrixWorld,matrixScale);
        // Partition static architectural detail by village block. Large
        // unpartitioned batches were visible to the GPU even 300 m behind
        // the camera; each cluster can now be culled by Three.js.
        const chunkX=Math.floor(matrix.elements[12]/chunkSize);
        const chunkZ=Math.floor(matrix.elements[14]/chunkSize);
        const key=[isRoof?'roof':'box',mat.type,mat.map?.uuid||'',mat.bumpMap?.uuid||'',
          mat.emissive?.getHexString?.()||'',mat.emissiveIntensity||0,
          mat.metalness||0,mat.roughness||0,mat.transparent||false,
          mat.opacity??1,mat.side,mat.blending,chunkX,chunkZ].join('|');
        if(!buckets.has(key))buckets.set(key,{material:mat,isRoof,items:[]});
        buckets.get(key).items.push({item,matrix,color:mat.color?.clone()||new THREE.Color(0xffffff)});
      });
    }
    for(const bucket of buckets.values()){
      const mat=bucket.material.clone();
      if(mat.color)mat.color.set(0xffffff);
      const instance=new THREE.InstancedMesh(bucket.isRoof?roofPrototype:unitCube,mat,bucket.items.length);
      for(let i=0;i<bucket.items.length;i++){
        const rec=bucket.items[i];
        instance.setMatrixAt(i,rec.matrix);instance.setColorAt(i,rec.color);
        rec.item.parent?.remove(rec.item);
        if(!bucket.isRoof)rec.item.geometry.dispose();
      }
      instance.instanceMatrix.needsUpdate=true;
      if(instance.instanceColor)instance.instanceColor.needsUpdate=true;
      instance.computeBoundingSphere();
      instance.frustumCulled=true;
      scene.add(instance);
    }
  }
  batchStaticBoxes();

  // Bicycle geometry: real torus wheels, spokes, frame, lights and a rider
  // wearing a yellow straw hat, indigo jacket, and wind-reactive red scarf.
  const bike=new THREE.Group();bike.position.set(0,0,89);scene.add(bike);
  const bikeRig=new THREE.Group();bike.add(bikeRig);
  const wheelGroups=[];
  function makeWheel(z){
    const wheel=new THREE.Group();wheel.position.set(0,.62,z);bikeRig.add(wheel);
    const tire=mesh(new THREE.TorusGeometry(.57,.087,10,28),MAT.tire);tire.rotation.y=Math.PI*.5;wheel.add(tire);
    const metal=mesh(new THREE.TorusGeometry(.51,.025,6,28),MAT.rim);metal.rotation.y=Math.PI*.5;wheel.add(metal);
    const hub=mesh(new THREE.CylinderGeometry(.105,.105,.3,10),MAT.frame);hub.rotation.z=Math.PI*.5;wheel.add(hub);
    const spokes=new THREE.InstancedMesh(new THREE.CylinderGeometry(.012,.012,1,4),MAT.rim,12);
    for(let i=0;i<12;i++){
      const a=i/12*TAU;
      const end=v3(0,Math.sin(a)*.51,Math.cos(a)*.51);
      tempObject.position.copy(end).multiplyScalar(.5);
      tempObject.quaternion.setFromUnitVectors(vectorUp,end.clone().normalize());
      tempObject.scale.set(1,end.length(),1);tempObject.updateMatrix();
      spokes.setMatrixAt(i,tempObject.matrix);
    }
    spokes.instanceMatrix.needsUpdate=true;wheel.add(spokes);
    wheelGroups.push(wheel);
  }
  makeWheel(-1.08);makeWheel(1.06);
  const framePoints={front:v3(0,.64,-1.08),rear:v3(0,.64,1.06),crank:v3(0,1.0,.15),seat:v3(0,1.62,.52),neck:v3(0,1.65,-.72)};
  for(const [a,b] of [['rear','crank'],['crank','seat'],['seat','rear'],['seat','neck'],['neck','crank'],['front','neck']]){
    bikeRig.add(cylinderBetween(framePoints[a],framePoints[b],.055,MAT.frame));
  }
  bikeRig.add(cylinderBetween(v3(-.57,1.75,-.78),v3(.57,1.75,-.78),.06,MAT.rim));
  for(const side of [-1,1]){
    bikeRig.add(cylinderBetween(v3(side*.43,1.75,-.78),v3(side*.57,1.7,-.82),.07,MAT.tire));
  }
  const saddle=box(.42,.12,.68,MAT.tire,0,1.67,.43);bikeRig.add(saddle);
  bikeRig.add(cylinderBetween(v3(0,1.1,.15),v3(0,1.65,.43),.06,MAT.rim));
  const chainRing=mesh(new THREE.TorusGeometry(.24,.045,8,24),MAT.rim,0,1,.15);chainRing.rotation.y=Math.PI*.5;bikeRig.add(chainRing);
  // Twin wheel guards painted in blue-black.
  for(const z of [-1.08,1.06]){
    const arcPts=[];for(let i=0;i<24;i++){const a=Math.PI*.05+i/23*Math.PI*.9;
      arcPts.push(v3(0,.62+Math.sin(a)*.7,z+Math.cos(a)*.7));}
    bikeRig.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arcPts),30,.043,5,false),MAT.navy));
  }

  // Bike lights are visible at night and illuminate nearby stones.
  const headLamp=mesh(new THREE.SphereGeometry(.17,12,9),
    new THREE.MeshStandardMaterial({color:0xffedb4,emissive:0xffdb8a,emissiveIntensity:4}),0,1.42,-1.18);
  bikeRig.add(headLamp);
  const headlight=new THREE.SpotLight(0xffe4ac,18,23,.48,.9,1.6);
  headlight.position.set(0,1.42,-1.22);headlight.target.position.set(0,.35,-9);
  bikeRig.add(headlight,headlight.target);
  const tailLamp=box(.25,.18,.12,
    new THREE.MeshStandardMaterial({color:0xff3c40,emissive:0xff122b,emissiveIntensity:3.2}),0,1.12,1.4);
  bikeRig.add(tailLamp);
  // An emissive red tail lamp is sufficient without another moving light.

  // The video shows a slender human-shaped rider, not a pill-shaped mannequin.
  // A smooth, tapered coat and articulated sleeves make the silhouette read
  // clearly from the chase camera without downloading a heavyweight model.
  const coatProfile=[[-.61,.30],[-.53,.38],[-.25,.37],[-.04,.35],[.23,.43],[.40,.43],[.52,.27],[.56,.19]]
    .map(([y,r])=>new THREE.Vector2(r,y));
  const torso=mesh(new THREE.LatheGeometry(coatProfile,18),MAT.blue,0,2.19,.28);
  torso.rotation.x=-.14;bikeRig.add(torso);
  const hip=mesh(new THREE.SphereGeometry(.32,12,9),MAT.pants,0,1.65,.39);bikeRig.add(hip);
  for(const side of [-1,1]){
    const coatTail=box(.35,.42,.35,MAT.blue,side*.24,1.7,.42);
    coatTail.rotation.set(.14,0,side*.13);bikeRig.add(coatTail);
    const frontLapel=box(.115,.5,.06,MAT.blueLight,side*.16,2.27,-.075);
    frontLapel.rotation.z=side*-.12;bikeRig.add(frontLapel);
    bikeRig.add(box(.08,.12,.07,MAT.strawDark,side*.3,2.08,-.095));
  }

  // The square cream-and-leather satchel is the most recognizable detail of
  // the filmed cyclist when viewed from behind. Its straps attach to the coat.
  const satchel=box(.66,.72,.25,MAT.leather,0,2.15,.75);bikeRig.add(satchel);
  const satchelPanel=box(.54,.59,.045,MAT.leatherTrim,0,2.17,.9);bikeRig.add(satchelPanel);
  const satchelFlap=box(.58,.17,.065,MAT.leather,0,2.43,.934);bikeRig.add(satchelFlap);
  bikeRig.add(box(.11,.10,.07,MAT.gold,0,2.37,.974));
  for(const side of [-1,1]){
    bikeRig.add(cylinderBetween(v3(side*.28,2.6,.44),v3(side*.24,2.45,.76),.044,MAT.leatherTrim));
    bikeRig.add(box(.07,.55,.035,MAT.leather,side*.24,2.17,.926));
  }

  const collar=mesh(new THREE.CylinderGeometry(.22,.3,.19,16),MAT.red,0,2.63,.23);
  collar.rotation.x=-.14;bikeRig.add(collar);
  const neck=mesh(new THREE.CylinderGeometry(.15,.17,.23,12),MAT.skin,0,2.71,.19);bikeRig.add(neck);
  const head=mesh(new THREE.SphereGeometry(.274,20,16),MAT.skin,0,2.91,.18);
  head.scale.set(.93,1.12,.97);bikeRig.add(head);
  // Vincent's auburn hair and short beard are sculpted against the skull.
  const hair=mesh(new THREE.SphereGeometry(.281,20,12,0,TAU,0,Math.PI*.57),MAT.hair,0,3.02,.2);
  bikeRig.add(hair);
  for(const side of [-1,1]){
    const ear=mesh(new THREE.SphereGeometry(.077,9,7),MAT.skin,side*.265,2.88,.19);
    ear.scale.set(.6,1,.55);bikeRig.add(ear);
    const sideburn=mesh(new THREE.SphereGeometry(.075,8,7),MAT.hair,side*.23,2.85,.32);
    sideburn.scale.set(.65,1.8,.6);bikeRig.add(sideburn);
    bikeRig.add(mesh(new THREE.SphereGeometry(.025,7,5),MAT.darkWood,side*.112,2.936,-.075));
  }
  const nose=mesh(new THREE.SphereGeometry(.09,10,8),MAT.skin,0,2.86,-.085);
  nose.scale.set(.65,1.05,.85);bikeRig.add(nose);
  const beard=mesh(new THREE.SphereGeometry(.16,13,9),MAT.hair,0,2.77,-.065);
  beard.scale.set(.91,.64,.33);bikeRig.add(beard);
  // Smaller flat-brimmed straw hat, as in the reference; it lifts with speed.
  const brim=mesh(new THREE.CylinderGeometry(.45,.46,.06,24),MAT.straw,0,3.21,.18);bikeRig.add(brim);
  const crown=mesh(new THREE.CylinderGeometry(.29,.34,.33,20),MAT.straw,0,3.4,.18);bikeRig.add(crown);
  const band=mesh(new THREE.CylinderGeometry(.305,.34,.07,20),MAT.strawDark,0,3.31,.18);bikeRig.add(band);
  for(let i=0;i<3;i++){
    const ridge=mesh(new THREE.TorusGeometry(.39-i*.08,.012,4,28),MAT.strawDark,0,3.20+i*.13,.18);
    ridge.rotation.x=Math.PI*.5;bikeRig.add(ridge);
  }

  // A single flowing ribbon replaces four stiff scarf boxes. Each frame its
  // tapered mesh ripples gently in the wind and bends during turns and jumps.
  const scarfSegments=9,scarfPositions=new Float32Array((scarfSegments+1)*2*3),scarfIndices=[];
  for(let i=0;i<scarfSegments;i++){
    const n=i*2;scarfIndices.push(n,n+1,n+2,n+1,n+3,n+2);
  }
  const scarfGeometry=new THREE.BufferGeometry();
  scarfGeometry.setAttribute('position',new THREE.BufferAttribute(scarfPositions,3));
  scarfGeometry.setIndex(scarfIndices);
  const scarfRibbon=mesh(scarfGeometry,MAT.scarf);scarfRibbon.frustumCulled=false;bikeRig.add(scarfRibbon);

  // Rounded, elbowed sleeves follow a relaxed forward-cycling posture.
  for(const side of [-1,1]){
    const shoulder=v3(side*.39,2.50,.18),elbow=v3(side*.49,2.11,-.21),hand=v3(side*.51,1.75,-.78);
    bikeRig.add(mesh(new THREE.SphereGeometry(.2,11,9),MAT.blue,shoulder.x,shoulder.y,shoulder.z));
    bikeRig.add(cylinderBetween(shoulder,elbow,.145,MAT.blue));
    bikeRig.add(mesh(new THREE.SphereGeometry(.15,10,8),MAT.blue,elbow.x,elbow.y,elbow.z));
    bikeRig.add(cylinderBetween(elbow,hand,.112,MAT.blue));
    bikeRig.add(mesh(new THREE.SphereGeometry(.125,10,8),MAT.gloves,hand.x,hand.y,hand.z));
  }
  // Animated knees and pedals (geometry length is one, transformed each frame).
  const legSegments=[];
  for(const side of [-1,1]){
    const thigh=mesh(new THREE.CylinderGeometry(.15,.13,1,8),MAT.pants);
    const shin=mesh(new THREE.CylinderGeometry(.115,.1,1,8),MAT.pants);
    const foot=box(.25,.18,.42,MAT.tire);bikeRig.add(thigh,shin,foot);
    legSegments.push({side,thigh,shin,foot});
  }
  function animateRider(time,dt){
    const pedaling=time*.0009*(state.speed*2.8+1);
    for(const wheel of wheelGroups)wheel.rotation.x-=(state.speed*dt)/.57;
    for(const leg of legSegments){
      const angle=pedaling+(leg.side<0?0:Math.PI);
      const root=v3(leg.side*.23,1.65,.45);
      const ankle=v3(leg.side*.27,1+Math.sin(angle)*.27,.15+Math.cos(angle)*.3);
      const knee=v3(leg.side*.31,1.3+Math.sin(angle)*.16,-.01+Math.cos(angle)*.09);
      setSegment(leg.thigh,root,knee);setSegment(leg.shin,knee,ankle);
      leg.foot.position.copy(ankle);leg.foot.position.z-=.15;
    }
    const wind=clamp(state.speed/18,0,1);
    const positions=scarfGeometry.attributes.position;
    for(let i=0;i<=scarfSegments;i++){
      const t=i/scarfSegments,w=.29*(1-t*.54);
      const sway=Math.sin(time*.004-t*5.4)*(.025+t*(.07+wind*.18));
      const x=-.12-t*.2+sway-state.lean*t*.18;
      const y=2.61-t*(.12+wind*.21)+Math.sin(time*.005-t*4.6)*t*(.035+wind*.08);
      const z=.43+t*(.72+wind*.83);
      positions.setXYZ(i*2,x-w*.5,y,z);
      positions.setXYZ(i*2+1,x+w*.5,y+.018*Math.sin(time*.006+t*9),z);
    }
    positions.needsUpdate=true;
    scarfGeometry.computeVertexNormals();
    brim.rotation.z=Math.sin(time*.006)*wind*.045;
    let roll=state.lean*.18;
    if(state.trickDuration>0){
      const t=clamp((time-state.trickStart)/state.trickDuration,0,1);
      if(t<1)roll+=t*t*(3-2*t)*TAU;
      else state.trickDuration=0;
    }
    bikeRig.rotation.z=roll;
  }

  // Billboards with their words are visible in-world but stay subtle in the HUD.
  function makeWordSprite(text){
    const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');
    const label=String(text).slice(0,35);
    g.fillStyle='rgba(14,27,63,.85)';g.beginPath();g.roundRect(7,9,498,110,25);g.fill();
    g.strokeStyle='rgba(255,221,150,.8)';g.lineWidth=4;g.stroke();
    const fontSize=label.length>15?36:48;
    g.font=`${fontSize}px Georgia, serif`;g.textAlign='center';g.textBaseline='middle';
    g.fillStyle='#fff3cb';g.shadowColor='#f5c981';g.shadowBlur=11;g.fillText(label,256,66,470);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));
    sprite.scale.set(label.length>13?5.3:4.5,1.16,1);return sprite;
  }
  const orbSphere=new THREE.SphereGeometry(.5,12,9);
  const orbMaterial=new THREE.MeshStandardMaterial({color:0xfff3cc,emissive:0xffd16e,emissiveIntensity:3.1,
    metalness:.06,roughness:.19});
  // Each district has an easy-to-find word trail. The first four sit directly
  // in front of the starting cyclist so the learning begins effortlessly.
  const orbPositions=[v3(0,1.5,76),v3(1.4,1.5,62),v3(-1.8,1.5,43),v3(1.7,1.5,26),
    v3(-145,1.5,104),v3(-230,1.5,-191),v3(240,1.5,0),v3(-177,1.5,180),
    v3(207,1.5,201),v3(10,1.5,-204)];
  const roadCandidates=[];
  for(const path of roadPaths){
    for(let i=7;i<path.length-6;i+=9){
      const p=path[i];if(Math.hypot(p.x,p.z)<19||Math.hypot(p.x,p.z)>244)continue;
      const side=rand(i+path.length*13)>.5?1:-1;
      const candidate=v3(p.x+(rand(i+10)-.5)*2+side*1.2,1.5,p.z+(rand(i+20)-.5)*2);
      if(candidate.distanceTo(v3(0,1.5,89))<12)continue;
      if(buildingColliders.some(b=>Math.abs(candidate.x-b.x)<b.rx+1&&Math.abs(candidate.z-b.z)<b.rz+1))continue;
      roadCandidates.push(candidate);
    }
  }
  roadCandidates.sort((a,b)=>rand(a.x*13+a.z*5)-rand(b.x*13+b.z*5));
  for(let i=0;i<(isMobile?66:90)&&i<roadCandidates.length;i++){
    const p=roadCandidates[Math.floor(i*roadCandidates.length/(isMobile?66:90))];
    if(orbPositions.every(o=>Math.hypot(o.x-p.x,o.z-p.z)>7))orbPositions.push(p.clone());
  }
  for(let i=0;i<9;i++){
    const house=houseSlots[(i*5+2)%houseSlots.length];if(!house)continue;
    orbPositions.push(v3(house.x,house.height+3.8,house.z));
  }
  function makeOrb(position,index){
    const group=new THREE.Group();group.position.copy(position);scene.add(group);
    const wordIndex=index%lesson.words.length;
    // Word label remains a near-only Sprite, while all orb geometry and glow
    // will be submitted in THREE shared GPU instanced draws below.
    const obj={index,group,label:null,baseY:position.y,wordIndex,phase:rand(index+15)*TAU,
      collected:false,respawnAt:0,instanceHidden:true};
    orbs.push(obj);
  }
  orbPositions.forEach(makeOrb);
  // Previously 80+ moving word orbs created three meshes and three draw calls
  // each (sphere, glow, ring). A single instanced batch for each shape now
  // draws every orb across the entire map in just THREE draw calls. This is
  // especially helpful in iOS WKWebViews where draw submission is expensive.
  const orbSpheres=new THREE.InstancedMesh(orbSphere,orbMaterial,orbs.length);
  const orbRings=new THREE.InstancedMesh(new THREE.TorusGeometry(.83,.037,5,20),MAT.gold,orbs.length);
  const orbHalos=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),
    new THREE.MeshBasicMaterial({map:haloTexture,color:0xffce87,transparent:true,
      side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false}),orbs.length);
  for(const batch of [orbSpheres,orbRings,orbHalos]){
    batch.frustumCulled=false;scene.add(batch);
  }
  function hideOrbInstance(index){
    tempObject.position.set(0,-5000-index,0);tempObject.rotation.set(0,0,0);
    tempObject.scale.setScalar(.001);tempObject.updateMatrix();
    for(const batch of [orbSpheres,orbRings,orbHalos]){
      batch.setMatrixAt(index,tempObject.matrix);batch.instanceMatrix.needsUpdate=true;
    }
    orbs[index].instanceHidden=true;
  }
  for(let i=0;i<orbs.length;i++)hideOrbInstance(i);
  // Ride through levitating stardust rings to earn a short speed rush and
  // bonus score. They respawn, giving free roaming a second playful loop.
  const starGates=[];
  const gateLocations=[[-2,-120,0],[120,3,Math.PI*.5],[-180,-3,Math.PI*.5],
    [78,-146,0],[-112,137,0],[180,202,Math.PI*.5],[12,208,0]];
  const gateSparkles=new THREE.InstancedMesh(new THREE.OctahedronGeometry(.17,0),
    MAT.gold,gateLocations.length*8);
  for(let i=0;i<gateLocations.length;i++){
    const [x,z,rotation]=gateLocations[i],group=new THREE.Group();
    group.position.set(x,4.4,z);group.rotation.y=rotation;scene.add(group);
    const ring=mesh(new THREE.TorusGeometry(3.95,.17,9,56),
      new THREE.MeshBasicMaterial({color:i%2?0xb3e6ee:0xffdd8f,transparent:true,opacity:.9}));
    group.add(ring);
    const aura=mesh(new THREE.TorusGeometry(4.27,.18,8,48),new THREE.MeshBasicMaterial({
      color:i%2?0x58a6d2:0xffaa5f,transparent:true,opacity:.3,
      blending:THREE.AdditiveBlending,depthWrite:false}));group.add(aura);
    for(let p=0;p<8;p++){
      const a=p/8*TAU;
      const ringX=Math.cos(a)*4.1;
      tempObject.position.set(x+Math.cos(rotation)*ringX,4.4+Math.sin(a)*4.1,z-Math.sin(rotation)*ringX);
      tempObject.rotation.set(0,0,0);tempObject.scale.set(1,1,1);tempObject.updateMatrix();
      gateSparkles.setMatrixAt(i*8+p,tempObject.matrix);
    }
    starGates.push({x,z,group,ring,lastAt:0});
  }
  gateSparkles.instanceMatrix.needsUpdate=true;gateSparkles.frustumCulled=false;scene.add(gateSparkles);
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();

  function disposeOrbLabel(orb){
    if(!orb.label)return;
    orb.group.remove(orb.label);
    orb.label.material.map.dispose();orb.label.material.dispose();orb.label=null;
  }
  function setOrbWord(orb,index){
    orb.wordIndex=index%lesson.words.length;
    disposeOrbLabel(orb);
  }
  function animateOrbs(time){
    for(const orb of orbs){
      if(orb.collected)continue;
      const dx=orb.group.position.x-state.x,dz=orb.group.position.z-state.z;
      const distSq=dx*dx+dz*dz;
      const visibleRange=isMobile?138:185;
      orb.group.visible=distSq<visibleRange*visibleRange;
      if(!orb.group.visible){
        if(!orb.instanceHidden)hideOrbInstance(orb.index);
        if(distSq>110*110)disposeOrbLabel(orb);
        continue;
      }
      orb.group.position.y=orb.baseY+Math.sin(time*.00165+orb.phase)*.32;
      const scale=1+Math.sin(time*.002+orb.phase)*.13;
      tempObject.position.copy(orb.group.position);tempObject.rotation.set(0,0,0);
      tempObject.scale.setScalar(1);tempObject.updateMatrix();
      orbSpheres.setMatrixAt(orb.index,tempObject.matrix);
      tempObject.rotation.set(Math.PI*.25,time*.001+orb.phase,Math.sin(time*.0007+orb.phase)*.42);
      tempObject.scale.setScalar(1);tempObject.updateMatrix();
      orbRings.setMatrixAt(orb.index,tempObject.matrix);
      tempObject.quaternion.copy(camera.quaternion);
      tempObject.scale.set(4.8*scale,4.8*scale,1);tempObject.updateMatrix();
      orbHalos.setMatrixAt(orb.index,tempObject.matrix);
      orb.instanceHidden=false;
      if(state.showCard&&distSq<(isMobile?48*48:62*62)){
        if(!orb.label){orb.label=makeWordSprite(lesson.words[orb.wordIndex].word);
          orb.label.position.y=1.68;orb.group.add(orb.label);}
        orb.label.visible=true;
      }else if(orb.label){
        orb.label.visible=false;
        if(distSq>93*93)disposeOrbLabel(orb);
      }
    }
    orbSpheres.instanceMatrix.needsUpdate=true;
    orbRings.instanceMatrix.needsUpdate=true;
    orbHalos.instanceMatrix.needsUpdate=true;
  }
  function animateChapel(time){
    beamMaterial.opacity=.12+Math.sin(time*.0015)*.038;
    deliveryRing.rotation.z=time*.0004;
    chapelSparkles.forEach((p,i)=>{
      const a=p.angle+time*.00018;
      tempObject.position.set(Math.cos(a)*p.r,((p.offset+time*.003*(1+i%3))%25)+.5,20+Math.sin(a)*p.r);
      tempObject.rotation.set(0,a+time*.001,0);tempObject.scale.setScalar(p.size);
      tempObject.updateMatrix();chapelSparkleMesh.setMatrixAt(i,tempObject.matrix);
    });
    chapelSparkleMesh.instanceMatrix.needsUpdate=true;
    starMaterial.size=27+Math.sin(time*.0008)*2.1;
    spiralGroup.rotation.y=time*.000008;
    skySphere.rotation.y=.27+Math.sin(time*.000013)*.015;
  }

  function spawnParticles(position,count,color=0xffdfa0){
    for(let i=0;i<count;i++){
      const p=mesh(new THREE.OctahedronGeometry(.09+rand(i+state.distance)*.15,0),
        new THREE.MeshBasicMaterial({color,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false}));
      p.position.copy(position);scene.add(p);
      const angle=rand(i*9+state.distance)*TAU,velocity=v3(Math.cos(angle)*(2+rand(i+19)*5),2+rand(i+24)*6,Math.sin(angle)*(2+rand(i+23)*5));
      effects.push({mesh:p,velocity,life:1.3,age:0});
    }
  }
  function updateParticles(dt){
    for(let i=effects.length-1;i>=0;i--){
      const p=effects[i];p.age+=dt;
      p.mesh.position.addScaledVector(p.velocity,dt);p.velocity.y-=9*dt;
      p.mesh.material.opacity=clamp(1-p.age/p.life,0,1);
      p.mesh.scale.setScalar(1+p.age*.6);
      if(p.age>=p.life){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();effects.splice(i,1);}
    }
  }

  // From here forward the systems are gameplay: scoring, language speech,
  // jumping and aerial tricks, responsive controls, and camera animation.
  state.autoRide=true;
  $('autorideToggle').checked=true;
  function showMessage(title,description,duration=3000){
    clearTimeout(showMessage.timer);
    const node=$('deliveryToast');
    node.replaceChildren();
    const h=document.createElement('strong');h.textContent=title;
    const p=document.createElement('small');p.textContent=description;
    node.append(h,p);node.classList.add('show');
    showMessage.timer=setTimeout(()=>node.classList.remove('show'),duration);
  }
  function showJump(text){
    clearTimeout(showJump.timer);const node=$('jumpToast');
    node.textContent=text;node.classList.add('show');
    showJump.timer=setTimeout(()=>node.classList.remove('show'),1100);
  }
  function updateHud(){
    $('wordCount').textContent=String(state.bag.length);
    $('deliveredCount').textContent=String(state.delivered+state.bonusPoints);
    $('bookWordCount').textContent=String(state.history.length);
    $('bookDeliveredCount').textContent=String(state.delivered);
    const meters=Math.round(Math.hypot(state.x-deliveryPoint.x,state.z-deliveryPoint.z));
    $('chapelDistance').textContent=`${meters} m`;
    $('meterProgress').style.width=`${clamp((1-meters/120)*100,0,100)}%`;
    $('soundBtn').classList.toggle('is-off',!state.audioOn);
    $('soundBtn').setAttribute('aria-label',state.audioOn?'Turn off word pronunciation':'Turn on word pronunciation');
    $('soundBtn').title=state.audioOn?'Turn off word pronunciation':'Turn on word pronunciation';
    $('voiceState').textContent=state.audioOn?'VOICE ON':'VOICE OFF';
    $('voiceIcon').textContent=state.audioOn?'♫':'♪';
    $('hideBtn').classList.toggle('is-off',!state.showCard);
    $('pedalText').textContent=state.autoRide?'CRUISE ON':'CRUISE OFF';
    $('pedalBtn').classList.toggle('pressed',state.autoRide);
    $('bookDot').classList.toggle('show',state.history.length>0);
    $('speedReadout').textContent=`${Math.round(state.speed*3.6)} km/h`;
  }
  function updateWordCard(){
    const item=state.current;
    $('currentLanguage').textContent=languageName(lesson.learningLanguage).toUpperCase();
    $('currentWord').textContent=item?.word||'Follow the golden lights';
    $('currentTranslation').textContent=state.showMeaning ? (item?.translation||'Ride into an orb to learn its word.') : '••••••';
    $('wordExample').textContent=item?.sentence||'Every golden light is a word to remember.';
    $('translationBtn').textContent=state.showMeaning?'Hide meaning':'Show meaning';
    $('wordCard').classList.toggle('hidden-word',!state.showCard);
  }

  function stopSpeech(){
    speechVersion++;
    if(speechTimeout)clearTimeout(speechTimeout);
    speechTimeout=0;
    if(currentAudio){try{currentAudio.pause();currentAudio.currentTime=0;}catch{}currentAudio=null;}
    try{window.speechSynthesis?.cancel();}catch{}
  }
  function speak(text,audioURL='',onComplete=()=>{},force=false){
    if((!state.audioOn&&!force)||!text||(!state.started&&!force)||state.paused&&!force){onComplete();return;}
    if(audioURL){
      try{
        const url=new URL(audioURL,location.href);
        if(['https:','http:','blob:','data:'].includes(url.protocol)){
          const audio=new Audio(url.href);currentAudio=audio;
          audio.onended=()=>{currentAudio=null;onComplete();};
          audio.onerror=()=>{currentAudio=null;speak(text,'',onComplete,force);};
          audio.play().catch(()=>{currentAudio=null;speak(text,'',onComplete,force);});return;
        }
      }catch{}
    }
    if(!window.speechSynthesis){onComplete();return;}
    const u=new SpeechSynthesisUtterance(text);
    u.lang=localeFor(lesson.learningLanguage);u.rate=.84;u.pitch=1.02;
    const voices=window.speechSynthesis.getVoices();
    const found=voices.find(v=>v.lang.toLowerCase()===u.lang.toLowerCase())||
      voices.find(v=>v.lang.toLowerCase().startsWith(u.lang.split('-')[0].toLowerCase()));
    if(found)u.voice=found;
    u.onend=onComplete;u.onerror=onComplete;
    try{window.speechSynthesis.speak(u);}catch{onComplete();}
  }
  function repeatWord(item,initialDelay=0){
    stopSpeech();if(!item||!state.audioOn||!state.started||state.paused)return;
    const version=speechVersion;
    const next=()=>{
      if(version!==speechVersion||!state.started||state.paused||!state.audioOn)return;
      speak(item.word,item.audioURL||'',()=>{
        if(version===speechVersion&&state.repeat)speechTimeout=setTimeout(next,state.speechGap);
      });
    };
    if(initialDelay)speechTimeout=setTimeout(next,initialDelay);
    else next();
  }
  function playOne(item){if(!item)return;stopSpeech();speak(item.word,item.audioURL||'',()=>{
    if(!state.paused&&state.current&&state.repeat)repeatWord(state.current);
  },true);}
  function blip(hz=720){
    if(!state.fxOn)return;
    try{
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return;if(!audioContext)audioContext=new AC();
      const now=audioContext.currentTime,osc=audioContext.createOscillator(),gain=audioContext.createGain();
      osc.type='sine';osc.frequency.setValueAtTime(hz,now);osc.frequency.exponentialRampToValueAtTime(hz*1.5,now+.18);
      gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.06,now+.03);
      gain.gain.exponentialRampToValueAtTime(.0001,now+.5);
      osc.connect(gain);gain.connect(audioContext.destination);osc.start(now);osc.stop(now+.51);
    }catch{}
  }

  function collectOrb(orb){
    if(orb.collected)return;
    orb.collected=true;orb.group.visible=false;orb.respawnAt=performance.now()+13000;
    hideOrbInstance(orb.index);
    disposeOrbLabel(orb);
    const word=lesson.words[orb.wordIndex];
    state.bag.push(word);state.history.push(word);state.current=word;
    nextWordIndex++;spawnParticles(orb.group.position.clone(),17);
    blip(720+orb.index%4*110);updateHud();updateWordCard();repeatWord(word,650);
    $('missionNote').classList.add('faded');
    try{window.parent?.postMessage({type:'GOLINGO_GAME_EVENT',event:'wordCollected',game:'starry-nightrider',
      id:word.id,word:word.word,translation:word.translation},'*');}catch{}
  }
  function deliverOrbs(){
    if(!state.bag.length||state.deliveryCooldown>0)return;
    const count=state.bag.length,points=count*10;
    state.bag=[];state.delivered+=points;state.deliveryCooldown=3.5;
    state.best=Math.max(state.best,state.delivered+state.bonusPoints);
    try{localStorage.setItem('golingoStarryBest',String(state.best));}catch{}
    const message=`${count} glowing ${count===1?'word':'words'} returned · +${points} points`;
    showMessage('✦ Delivered to the steeple ✦',message,4500);
    spawnParticles(v3(0,3,20),42,0xffd47a);blip(460);updateHud();
    state.steepleExitUntil=performance.now()+3200;
    const sentence=state.current?.sentence;
    if(sentence){
      stopSpeech();const version=speechVersion;
      speak(sentence,'',()=>{
        if(version===speechVersion&&state.current&&state.repeat)
          speechTimeout=setTimeout(()=>repeatWord(state.current),Math.min(state.speechGap,1900));
      });
    }
    try{window.parent?.postMessage({type:'GOLINGO_GAME_EVENT',event:'wordsDelivered',game:'starry-nightrider',
      count,points,score:state.delivered},'*');}catch{}
  }
  function updateOrbs(time){
    for(const orb of orbs){
      if(orb.collected){
        if(time>orb.respawnAt){orb.collected=false;orb.group.visible=true;setOrbWord(orb,nextWordIndex++);}
        continue;
      }
      const dx=state.x-orb.group.position.x,dz=state.z-orb.group.position.z;
      const horizontal=dx*dx+dz*dz;
      if(horizontal<6.3&&Math.abs(orb.group.position.y-(state.jumpY+1.35))<2.2)collectOrb(orb);
    }
  }

  function tryJump(){
    if(!state.started||state.paused||state.finished||state.jumps>=3)return;
    state.jumps++;
    state.jumpVel=state.jumps===3?12.2:10.3;
    if(state.jumps===3){state.boostUntil=performance.now()+2350;showJump('✦ Star flight!');}
    else if(state.jumps===2)showJump('✧ Double leap');
    else showJump('✦ Leap!');
  }
  function tryTrick(){
    if(!state.started||state.paused||state.finished)return;
    if(state.jumpY<.6){showJump('Jump first, then style!');return;}
    if(performance.now()-state.trickStart<state.trickDuration)return;
    state.trickStart=performance.now();state.trickDuration=850;state.styleCount++;
    state.bonusPoints+=5;
    state.best=Math.max(state.best,state.delivered+state.bonusPoints);
    showJump('✶ Starry spin! +5');blip(920);updateHud();
  }
  function checkGates(time){
    for(const gate of starGates){
      gate.group.rotation.z=Math.sin(time*.001+gate.x)*.018;
      const distance=Math.hypot(state.x-gate.x,state.z-gate.z);
      if(distance>4.8||state.jumpY>7||time-gate.lastAt<19000)continue;
      gate.lastAt=time;state.rushUntil=time+3700;state.streak++;
      const points=15+Math.min(state.streak,5)*3;
      state.bonusPoints+=points;state.best=Math.max(state.best,state.delivered+state.bonusPoints);
      showMessage('✦ Stardust rush!',`Ride through the glowing rings · +${points} bonus points`,2400);
      spawnParticles(v3(gate.x,3.5,gate.z),24,0xffdc98);blip(970);updateHud();
    }
    for(const zone of districts){
      if(Math.hypot(state.x-zone.x,state.z-zone.z)>zone.r)continue;
      $('districtName').textContent=zone.name;
      if(state.visited.has(zone.name))break;
      state.visited.add(zone.name);
      if(state.distance>28){state.bonusPoints+=10;
        showMessage('✷ New place discovered',`${zone.name.toLowerCase()} · +10 exploration points`,2600);
        updateHud();}
      break;
    }
  }
  function collides(x,z){
    for(const b of buildingColliders){
      if(Math.abs(x-b.x)<b.rx+.66&&Math.abs(z-b.z)<b.rz+.66)return true;
    }
    return false;
  }
  function updatePhysics(dt,time){
    if(!state.started||state.paused||state.finished)return;
    const steering=clamp((controls.left?1:0)-(controls.right?1:0)-controls.joyX,-1,1);
    const braking=controls.brake||controls.joyY>.58;
    const boosting=controls.forward||controls.joyY<-.58||time<state.rushUntil;
    const desired=braking?0:boosting?19.5:state.autoRide?10.5:0;
    const rate=braking?3.8:desired>state.speed?1.55:1.2;
    state.speed=lerp(state.speed,desired,clamp(dt*rate,0,1));
    if(state.speed<.015)state.speed=0;
    state.steerSmooth=lerp(state.steerSmooth,steering,clamp(dt*6.5,0,1));
    const steerPower=.65+clamp(state.speed/15,0,1)*.66;
    state.heading+=state.steerSmooth*steerPower*dt;
    // The relaxed cruise line gently bends around the church after a
    // delivery so an unattended cyclist does not push against the steeple.
    if(state.autoRide&&time<state.steepleExitUntil&&!controls.left&&!controls.right&&
      Math.abs(controls.joyX)<.12&&Math.cos(state.heading)>.1)
      state.heading+=dt*1.48;
    state.lean=lerp(state.lean,state.steerSmooth,clamp(dt*4.4,0,1));
    const distance=state.speed*dt;
    const nextX=state.x-Math.sin(state.heading)*distance;
    const nextZ=state.z-Math.cos(state.heading)*distance;
    if(Math.max(Math.abs(nextX),Math.abs(nextZ))<268&&!collides(nextX,nextZ)){
      state.x=nextX;state.z=nextZ;state.distance+=distance;
    }else if(!collides(nextX,state.z)&&Math.abs(nextX)<268){
      state.x=nextX;state.distance+=distance*.5;state.speed*=.85;
    }else if(!collides(state.x,nextZ)&&Math.abs(nextZ)<268){
      state.z=nextZ;state.distance+=distance*.5;state.speed*=.85;
    }else{
      // Wall sliding and a gentle self-correcting turn are much kinder than
      // stopping the bike dead, especially on narrow mobile screens.
      state.speed*=.91;state.heading+=(state.steerSmooth||.4)*dt*.53;
    }
    // Simple arcadey flight: triple Space temporarily reduces gravity.
    if(state.jumpY>0||state.jumpVel>0){
      const gravity=state.boostUntil>time?10:20.5;
      state.jumpVel-=gravity*dt;state.jumpY+=state.jumpVel*dt;
      if(state.jumpY<=0){state.jumpY=0;state.jumpVel=0;state.jumps=0;state.boostUntil=0;}
    }
    if(state.deliveryCooldown>0)state.deliveryCooldown-=dt;
    bike.position.set(state.x,state.jumpY,state.z);
    bike.rotation.y=state.heading;
    if(Math.hypot(state.x-deliveryPoint.x,state.z-deliveryPoint.z)<6.8&&state.jumpY<5)deliverOrbs();
    checkGates(time);
    updateOrbs(time);
  }
  function updateCamera(dt){
    const yaw=bike.rotation.y;
    const behind=v3(0,3.9,8.6+state.speed*.12).applyAxisAngle(vectorUp,yaw);
    const ahead=v3(0,2.4,-6.3).applyAxisAngle(vectorUp,yaw);
    const desired=bike.position.clone().add(behind);
    desired.y+=Math.min(2.5,state.jumpY*.26);
    const target=bike.position.clone().add(ahead);
    camera.position.lerp(desired,1-Math.exp(-dt*4.7));
    chaseLook.lerp(target,1-Math.exp(-dt*4.8));
    camera.lookAt(chaseLook);
    camera.rotateZ(-state.lean*.015);
  }

  // Responsive, player-centered paper-chart minimap. It exposes the much
  // larger network without forcing players to memorize winding streets.
  const mapCanvas=$('minimap');
  const mapCtx=mapCanvas?.getContext('2d');
  function drawMinimap(){
    if(!mapCtx||typeof mapCtx.arc!=='function')return;
    const ctx=mapCtx,m=90,scale=.59;
    const px=x=>m+(x-state.x)*scale,pz=z=>m+(z-state.z)*scale;
    ctx.clearRect(0,0,180,180);ctx.save();ctx.beginPath();ctx.arc(m,m,87,0,TAU);ctx.clip();
    const grad=ctx.createRadialGradient(80,70,20,m,m,100);
    grad.addColorStop(0,'#355277');grad.addColorStop(1,'#0e2144');
    ctx.fillStyle=grad;ctx.fillRect(0,0,180,180);
    ctx.strokeStyle='#5d7792';ctx.lineWidth=13;ctx.lineJoin='round';ctx.lineCap='round';
    for(const path of roadPaths){
      ctx.beginPath();for(let i=0;i<path.length;i++){
        const x=px(path[i].x),y=pz(path[i].z);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }ctx.stroke();
    }
    ctx.strokeStyle='#d69cb1';ctx.lineWidth=8;
    for(const path of roadPaths){
      ctx.beginPath();for(let i=0;i<path.length;i+=2){
        const x=px(path[i].x),y=pz(path[i].z);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }ctx.stroke();
    }
    ctx.fillStyle='#1d2943';
    for(const house of houseSlots){
      const x=px(house.x),y=pz(house.z);
      if(x<-10||x>190||y<-10||y>190)continue;
      ctx.fillRect(x-house.width*.25,y-house.depth*.25,Math.max(2,house.width*.5),Math.max(2,house.depth*.5));
    }
    ctx.strokeStyle='#69bdc9';ctx.lineWidth=8;ctx.beginPath();
    for(let i=0;i<canalCurve.length;i++){
      const p=canalCurve[i];if(!i)ctx.moveTo(px(p.x),pz(p.z));else ctx.lineTo(px(p.x),pz(p.z));
    }ctx.stroke();
    for(const orb of orbs){
      if(orb.collected)continue;
      const x=px(orb.group.position.x),y=pz(orb.group.position.z);
      if(x<0||x>180||y<0||y>180)continue;
      ctx.fillStyle='#ffe48d';ctx.beginPath();ctx.arc(x,y,2,0,TAU);ctx.fill();
    }
    for(const gate of starGates){
      const x=px(gate.x),y=pz(gate.z);
      ctx.strokeStyle='#b6eced';ctx.lineWidth=1.8;ctx.beginPath();ctx.arc(x,y,3.5,0,TAU);ctx.stroke();
    }
    for(const landmark of landmarkMarkers){
      const x=px(landmark.x),y=pz(landmark.z);
      ctx.fillStyle='#f5c778';ctx.beginPath();ctx.arc(x,y,3.7,0,TAU);ctx.fill();
    }
    const chapelX=px(deliveryPoint.x),chapelY=pz(deliveryPoint.z);
    ctx.fillStyle='#ffe49a';ctx.shadowColor='#ffe28a';ctx.shadowBlur=7;
    ctx.beginPath();ctx.arc(chapelX,chapelY,5.5,0,TAU);ctx.fill();ctx.shadowBlur=0;
    ctx.save();ctx.translate(m,m);ctx.rotate(-state.heading);
    ctx.fillStyle='#fffdf2';ctx.strokeStyle='#0d2444';ctx.lineWidth=1.8;
    ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(7,7);ctx.lineTo(0,3);ctx.lineTo(-7,7);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.restore();ctx.restore();
    ctx.strokeStyle='rgba(255,232,164,.65)';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(m,m,87,0,TAU);ctx.stroke();
  }

  function chooseLesson(value,external=false){
    const parsed=normalizePack(value);if(!parsed)return false;
    lesson=parsed;if(external)importedPack=parsed;
    if(external){
      const sel=$('languageSelect');
      if(![...sel.options].some(o=>o.value===lesson.learningLanguage)){
        const option=document.createElement('option');option.value=lesson.learningLanguage;
        option.textContent=`${languageName(lesson.learningLanguage)} · GoLingo words`;sel.add(option);
      }
      sel.value=lesson.learningLanguage;
    }
    nextWordIndex=0;
    orbs.forEach((orb,i)=>setOrbWord(orb,i));
    resetRide();
    $('missionNote').querySelector('span:last-child').textContent=external?
      `${lesson.words.length} GoLingo words loaded · Ride into the glowing lights`:
      'Explore the village · Collect lights · Return to the golden steeple';
    $('missionNote').classList.remove('faded');
    return true;
  }
  function resetRide(){
    stopSpeech();state.x=0;state.z=89;state.heading=0;state.speed=0;
    state.jumpY=0;state.jumpVel=0;state.jumps=0;state.boostUntil=0;
    state.bag=[];state.history=[];state.delivered=0;state.current=null;
    state.distance=0;state.styleCount=0;state.bonusPoints=0;state.streak=0;
    state.rushUntil=0;state.steepleExitUntil=0;state.visited=new Set();
    state.steerSmooth=0;state.deliveryCooldown=0;
    controls.joyX=0;controls.joyY=0;
    bike.position.set(0,0,89);bike.rotation.set(0,0,0);
    for(const orb of orbs){orb.collected=false;orb.group.visible=true;orb.respawnAt=0;}
    updateHud();updateWordCard();
  }
  function loadInitialPack(){
    const params=new URLSearchParams(location.search);
    let pack=null;
    for(const key of ['data','golingo','payload','wordData','words']){
      if(params.has(key)){pack=normalizePack(params.get(key));if(pack)break;}
    }
    if(!pack&&location.hash){
      const h=new URLSearchParams(location.hash.substring(1));
      for(const key of ['data','golingo','payload']){if(h.has(key)){pack=normalizePack(h.get(key));if(pack)break;}}
    }
    if(!pack&&window.name&&window.name.length<2000000)pack=normalizePack(window.name);
    if(pack)chooseLesson(pack,true);
    else{lesson=demoPack('es');updateWordCard();}
  }

  // Import bridge for GoLingo's WKWebView. postMessage avoids URI-too-long.
  window.loadGoLingoWords=value=>chooseLesson(value,true);
  window.receiveGoLingoData=window.loadGoLingoWords;
  window.receiveGoLingoWords=window.loadGoLingoWords;
  window.addEventListener('message',event=>{
    const data=event.data;if(!data||typeof data!=='object')return;
    const type=String(data.type||'').toLowerCase();
    if(['golingowords','golingodata','setwords','golingo:words','golingo_game_data','worddata'].includes(type))
      chooseLesson(data.payload??data.data??(data.words?data:null),true);
    else if(data.words&&data.learningLanguage)chooseLesson(data,true);
  });

  function openModal(id){
    if(!state.started||state.finished)return;
    state.paused=true;stopSpeech();$(id).classList.remove('hidden');
    if(id==='bookModal')fillBook();
  }
  function closeModals(){
    for(const id of ['pauseModal','bookModal','finishModal'])$(id).classList.add('hidden');
    state.paused=false;state.finished=false;
    if(state.current)repeatWord(state.current);
  }
  function finishRide(){
    if(!state.started)return;
    stopSpeech();state.paused=true;state.finished=true;
    $('pauseModal').classList.add('hidden');$('bookModal').classList.add('hidden');
    $('finishSummary').textContent=`${state.delivered} points · ${state.history.length} words collected · ${Math.round(state.distance)} m ridden · best ${state.best} points`;
    $('finishModal').classList.remove('hidden');
  }
  function fillBook(){
    const list=$('wordList');list.replaceChildren();
    if(!state.history.length){const div=document.createElement('div');div.className='empty-collection';
      div.textContent='Your first star is somewhere in the village.';list.append(div);return;}
    const unique=[...new Map(state.history.map(w=>[String(w.id)+'|'+w.word,w])).values()].reverse();
    for(const word of unique){
      const button=document.createElement('button');button.type='button';button.className='word-item';
      const left=document.createElement('span'),title=document.createElement('strong'),caption=document.createElement('small');
      title.textContent=word.word;caption.textContent=word.translation;left.append(title,caption);
      const sound=document.createElement('span');sound.className='speaker';sound.textContent='↻';button.append(left,sound);
      button.addEventListener('click',()=>playOne(word));list.append(button);
    }
    $('bookDot').classList.remove('show');
  }
  const exportPayload=()=>({primaryLanguage:lesson.primaryLanguage,learningLanguage:lesson.learningLanguage,
    words:state.history.map(w=>({...w}))});

  function bindHold(id,name){
    const el=$(id);if(!el)return;
    const release=()=>{controls[name]=false;el.classList.remove('pressed');};
    el.addEventListener('pointerdown',e=>{e.preventDefault();controls[name]=true;
      el.classList.add('pressed');try{el.setPointerCapture(e.pointerId);}catch{}});
    el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);
    el.addEventListener('lostpointercapture',release);
  }
  function bindControls(){
    bindHold('leftBtn','left');bindHold('rightBtn','right');
    bindHold('brakeBtn','brake');
    // One-thumb analogue steering and optional push-up boost/down-to-brake.
    // The joystick owns the touch pointer; it does not scroll/select or open
    // the pause overlay on iPhone WKWebView.
    const joystick=$('joystickTrack'),joystickSurface=$('joystickWrap'),knob=$('joystickKnob');
    let joystickPointer=null;
    const moveJoystick=e=>{
      const r=joystick.getBoundingClientRect();
      const dx=e.clientX-(r.left+r.width*.5),dy=e.clientY-(r.top+r.height*.5);
      controls.joyX=clamp(dx/(r.width*.33),-1,1);
      controls.joyY=clamp(dy/(r.height*.33),-1,1);
      knob.style.transform=`translate(calc(-50% + ${controls.joyX*24}px),calc(-50% + ${controls.joyY*24}px))`;
    };
    const releaseJoystick=e=>{
      if(e&&joystickPointer!==e.pointerId)return;
      joystickPointer=null;controls.joyX=0;controls.joyY=0;
      joystickSurface.classList.remove('control-active');
      knob.style.transform='translate(-50%,-50%)';};
    // Capture from the whole thumb area, not just the inner circle. A CSS
    // pointer-events:none on the surrounding controls previously made the
    // joystick completely untouchable in iPhone WKWebView.
    joystickSurface.addEventListener('pointerdown',e=>{
      if(!state.started||state.paused||state.finished||joystickPointer!==null)return;
      e.preventDefault();joystickPointer=e.pointerId;
      joystickSurface.classList.add('control-active');
      try{joystickSurface.setPointerCapture(e.pointerId);}catch{}
      moveJoystick(e);
    },{passive:false});
    joystickSurface.addEventListener('pointermove',e=>{
      if(joystickPointer!==e.pointerId)return;
      e.preventDefault();moveJoystick(e);
    },{passive:false});
    joystickSurface.addEventListener('pointerup',releaseJoystick);
    joystickSurface.addEventListener('pointercancel',releaseJoystick);
    joystickSurface.addEventListener('lostpointercapture',releaseJoystick);
    // A tab switch or backgrounding should never leave the bike steering.
    window.addEventListener('blur',()=>releaseJoystick());
    $('pedalBtn').addEventListener('click',()=>{state.autoRide=!state.autoRide;
      $('autorideToggle').checked=state.autoRide;updateHud();});
    $('jumpBtn').addEventListener('pointerdown',e=>{e.preventDefault();tryJump();});
    $('trickBtn').addEventListener('pointerdown',e=>{e.preventDefault();tryTrick();});
    const introVideo=$('introVideo');
    const beginRide=()=>{
      if(state.started)return;
      state.started=true;state.paused=false;$('introBackdrop').classList.add('hidden');
      try{introVideo.pause();introVideo.currentTime=0;}catch{}
      updateHud();blip(520);
      try{window.parent?.postMessage({type:'GOLINGO_GAME_EVENT',event:'started',game:'starry-nightrider'},'*');}catch{}
    };
    $('startBtn').addEventListener('click',beginRide);
    $('skipIntroBtn').addEventListener('click',beginRide);
    introVideo.addEventListener('ended',beginRide);
    introVideo.addEventListener('timeupdate',()=>{
      $('introProgress').style.width=`${Math.min(100,(introVideo.currentTime/(introVideo.duration||8))*100)}%`;
    });
    try{introVideo.play?.()?.catch?.(()=>{});}catch{} // RIDE NOW works even if muted autoplay is blocked.
    $('languageSelect').addEventListener('change',e=>{
      if(importedPack&&e.target.value===importedPack.learningLanguage)chooseLesson(importedPack,true);
      else chooseLesson(demoPack(e.target.value),false);
    });
    $('soundBtn').addEventListener('click',()=>{
      state.audioOn=!state.audioOn;stopSpeech();
      $('voiceToggle').checked=state.audioOn;
      try{localStorage.setItem('golingoStarryVoice',state.audioOn?'on':'off');}catch{}
      if(state.audioOn&&state.current)repeatWord(state.current,600);updateHud();
    });
    $('hideBtn').addEventListener('click',()=>{state.showCard=!state.showCard;updateWordCard();updateHud();});
    $('translationBtn').addEventListener('click',()=>{
      state.showMeaning=!state.showMeaning;$('meaningToggle').checked=state.showMeaning;updateWordCard();
    });
    $('repeatBtn').addEventListener('click',()=>{if(state.current)playOne(state.current);});
    $('pauseBtn').addEventListener('click',()=>state.paused?closeModals():openModal('pauseModal'));
    $('bookBtn').addEventListener('click',()=>openModal('bookModal'));
    $('resumeBtn').addEventListener('click',closeModals);
    $('restartBtn').addEventListener('click',()=>{resetRide();closeModals();});
    $('finishBtn').addEventListener('click',finishRide);
    $('rideAgainBtn').addEventListener('click',()=>{resetRide();closeModals();});
    $('continueAfterFinishBtn').addEventListener('click',closeModals);
    document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',closeModals));
    $('repeatToggle').addEventListener('change',e=>{state.repeat=e.target.checked;
      stopSpeech();if(state.current)repeatWord(state.current);});
    $('voiceToggle').addEventListener('change',e=>{
      if(e.target.checked!==state.audioOn)$('soundBtn').click();
    });
    $('speechGapSelect').addEventListener('change',e=>{
      state.speechGap=clamp(Number(e.target.value)||2200,1000,6000);
      try{localStorage.setItem('golingoStarrySpeechGap',String(state.speechGap));}catch{}
      if(state.current)repeatWord(state.current,650);
    });
    $('autorideToggle').addEventListener('change',e=>{state.autoRide=e.target.checked;});
    $('meaningToggle').addEventListener('change',e=>{state.showMeaning=e.target.checked;updateWordCard();});
    $('fullscreenBtn').addEventListener('click',async()=>{
      try{if(!document.fullscreenElement)await $('game').requestFullscreen();else await document.exitFullscreen();}catch{}
      try{await screen.orientation?.lock?.('landscape');}catch{}
    });
    $('exportWordsBtn').addEventListener('click',()=>{
      const file=new Blob([JSON.stringify(exportPayload(),null,2)],{type:'application/json'});
      const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;
      a.download='golingo-starry-nightrider-words.json';document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1500);
    });
    $('copyWordsBtn').addEventListener('click',async()=>{
      const text=state.history.map(w=>`${w.word} — ${w.translation}`).join('\n');
      try{await navigator.clipboard.writeText(text||'No words collected yet.');
        $('copyWordsBtn').textContent='COPIED ✓';setTimeout(()=>$('copyWordsBtn').textContent='COPY WORDS',1400);
      }catch{$('copyWordsBtn').textContent='COPY UNAVAILABLE';}
    });
    window.addEventListener('keydown',e=>{
      const key=e.key.toLowerCase();
      if(['arrowup','arrowdown','arrowleft','arrowright',' ','w','s','a','d','e'].includes(key))e.preventDefault();
      if(key==='escape'&&state.started){if(state.paused)closeModals();else openModal('pauseModal');return;}
      if(key==='p'&&state.started){if(state.paused)closeModals();else openModal('pauseModal');return;}
      if(key==='enter'&&state.started&&!e.repeat){finishRide();return;}
      if(!state.started||state.paused)return;
      if(key==='w'||key==='arrowup')controls.forward=true;
      if(key==='s'||key==='arrowdown')controls.brake=true;
      if(key==='a'||key==='arrowleft')controls.left=true;
      if(key==='d'||key==='arrowright')controls.right=true;
      if((key===' '||key==='space')&&!e.repeat)tryJump();
      if(key==='e'&&!e.repeat)tryTrick();
      if(key==='r'&&!e.repeat)playOne(state.current);
      if(key==='m'&&!e.repeat)$('soundBtn').click();
    },{passive:false});
    window.addEventListener('keyup',e=>{
      const k=e.key.toLowerCase();
      if(k==='w'||k==='arrowup')controls.forward=false;
      if(k==='s'||k==='arrowdown')controls.brake=false;
      if(k==='a'||k==='arrowleft')controls.left=false;
      if(k==='d'||k==='arrowright')controls.right=false;
    });
    // Tap a floating word in 3D to hear it without collecting it.
    canvas.addEventListener('pointerdown',e=>{
      if(!state.started||state.paused)return;
      pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);
      raycaster.setFromCamera(pointer,camera);
      const hits=raycaster.intersectObject(orbSpheres,false);
      if(hits.length&&hits[0].distance<90){
        const orb=orbs[hits[0].instanceId];
        if(orb&&!orb.collected&&orb.group.visible)playOne(lesson.words[orb.wordIndex]);
      }
    });
    window.addEventListener('resize',()=>{
      camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
      renderer.setPixelRatio(renderPixelRatio);
      renderer.setSize(innerWidth,innerHeight,false);
    },{passive:true});
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden)stopSpeech();
      else if(state.started&&!state.paused&&state.current)repeatWord(state.current,650);
    });
    // Touch steering releases cleanly and never opens the pause menu.
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
  }

  // Speed readout is dynamically created so the same HTML works in fallback.
  const speedReadout=document.createElement('div');speedReadout.id='speedReadout';speedReadout.className='speed-readout';
  speedReadout.textContent='0 km/h';$('game').append(speedReadout);
  loadInitialPack();bindControls();
  document.body.classList.add('using-three');
  $('voiceToggle').checked=state.audioOn;
  $('speechGapSelect').value=String(state.speechGap);
  $('autorideToggle').checked=state.autoRide;
  updateHud();updateWordCard();
  bike.position.set(state.x,0,state.z);camera.position.set(0,5.1,100);
  chaseLook.set(0,2.3,81);

  let previousTime=performance.now(),lastMapTime=0,lastIntroFrame=-Infinity,lastPauseFrame=0;
  let resolutionSamples=0,resolutionWindow=previousTime,qualityLastChange=0;
  renderer.setAnimationLoop(()=>{
    const time=performance.now(),dt=clamp((time-previousTime)/1000,0,.05);previousTime=time;
    // The cinematic covers the whole world: rendering 3D at 60fps behind a
    // fullscreen video is wasted battery and can make the video itself stutter.
    // Likewise, a paused translucent menu only needs occasional redraws.
    if(!state.started){
      if(time-lastIntroFrame>1500){renderer.render(scene,camera);lastIntroFrame=time;}
      return;
    }
    if(state.paused||state.finished){
      if(time-lastPauseFrame>130){renderer.render(scene,camera);lastPauseFrame=time;}
      return;
    }
    updatePhysics(dt,time);
    animateRider(time,dt);
    animateOrbs(time);
    animateChapel(time);
    windmillRotor.rotation.z=time*.00023;
    skySphere.rotation.y=.27+Math.sin(time*.000045)*.03;
    updateParticles(dt);
    updateCamera(dt);
    if(time-lastHudTime>(isMobile?260:180)){lastHudTime=time;updateHud();}
    if(time-lastMapTime>(isMobile?320:200)){lastMapTime=time;drawMinimap();}
    if(!state.started&&time-lastHintTime>28000){lastHintTime=time;}
    renderer.render(scene,camera);
    // FPS-aware DPR takes a very small number of resize actions over a ride.
    // Lower resolution only when sustained performance is poor; never change
    // the simulation delta, steering sensitivity, or physics time step.
    if(state.started&&!state.paused){
      resolutionSamples++;
      const windowMs=time-resolutionWindow;
      if(windowMs>2800){
        const fps=resolutionSamples*1000/windowMs;
        if(time-qualityLastChange>4600){
          let next=renderPixelRatio;
          if(fps<38)next=Math.max(minPixelRatio,Math.round((next-.13)*100)/100);
          else if(fps>54)next=Math.min(maxPixelRatio,Math.round((next+.07)*100)/100);
          if(Math.abs(next-renderPixelRatio)>.03){
            renderPixelRatio=next;renderer.setPixelRatio(renderPixelRatio);
            renderer.setSize(innerWidth,innerHeight,false);qualityLastChange=time;
          }
        }
        resolutionSamples=0;resolutionWindow=time;
      }
    }else{resolutionSamples=0;resolutionWindow=time;}
  });
  window.__STARRY_NIGHTRIDER_READY=true;
}

// A failed WebGL context is recoverable: the page loads the existing 2D ride.
try{start3D();}
catch(error){
  console.error('Starry Nightrider WebGL initialization failed:',error);
  window.dispatchEvent(new Event('starry:webgl-unavailable'));
}
