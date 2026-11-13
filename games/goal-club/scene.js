import * as THREE from './vendor/three.module.js';
import { configureCamera } from './camera.js';

// Original, procedural football park. No downloaded artwork or runtime assets.
const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;
const smooth = t => t * t * (3 - 2 * t);

export function createWorld(canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#b8ccd1');
  scene.fog = new THREE.Fog('#b8ccd1', 68, 145);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  const camera = new THREE.PerspectiveCamera(50,1,.1,160);
  let challenge={startX:0,startZ:8,goalX:0,goalWidth:7};
  const themeGroups=[new THREE.Group(),new THREE.Group(),new THREE.Group()];
  themeGroups.forEach(group=>scene.add(group));themeGroups[1].visible=false;themeGroups[2].visible=false;
  const hemi = new THREE.HemisphereLight(0xd8e8f4, 0x566044, 1.65);
  scene.add(hemi);
  const sunlight = new THREE.DirectionalLight(0xffe6ba, 2.65);
  sunlight.position.set(-18, 26, 13);
  sunlight.castShadow = true;
  const shadowSize = (canvas.clientWidth || window.innerWidth) < 740 ? 1024 : 2048;
  sunlight.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sunlight.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 80 });
  sunlight.shadow.bias = -.0006;
  sunlight.shadow.normalBias = .035;
  sunlight.shadow.radius = 3;
  sunlight.target.position.set(0, 0, -2);
  scene.add(sunlight, sunlight.target);

  const mats = {};
  const material = (key, color, extras = {}) => mats[key] ||= new THREE.MeshStandardMaterial({ color, roughness: .86, metalness: 0, ...extras });
  const grass = material('grass', '#4e7738');
  const grassLight = material('grassLight', '#527b3d');
  const grassDark = material('grassDark', '#456c34');
  const white = material('white', '#eeeee4');
  const sand = material('sand', '#8c9078');
  const dark = material('dark', '#162b39');
  const clay = material('clay', '#999f9c');
  const wood = material('wood', '#8c6847');
  const bark = material('bark', '#65503d');
  const leaf = material('leaf', '#355d3c');
  const leafLight = material('leafLight', '#527646');
  const leafGold = material('leafGold', '#718449');
  const coral = material('coral', '#bc5946');
  const cream = material('cream', '#c9cdc5');
  const yellow = material('yellow', '#d9b853');
  const metal = material('metal', '#586269',{roughness:.53,metalness:.3});
  const batches = new Map();
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const euler = new THREE.Euler();

  function addStatic(geometry, mat, pos = [0, 0, 0], rot = [0, 0, 0], size = [1, 1, 1]) {
    const transformed = geometry.clone();
    matrix.compose(position.fromArray(pos), quat.setFromEuler(euler.fromArray(rot)), scale.fromArray(size));
    transformed.applyMatrix4(matrix);
    const g = transformed.index ? transformed.toNonIndexed() : transformed;
    if (g !== transformed) transformed.dispose();
    if (!batches.has(mat)) batches.set(mat, []);
    batches.get(mat).push(g);
  }
  const boxG = new THREE.BoxGeometry(1, 1, 1);
  const cylinderG = new THREE.CylinderGeometry(1, 1, 1, 9);
  const sphereG = new THREE.IcosahedronGeometry(1, 2);
  const box = (mat, x, y, z, w, h, d, ry = 0) => addStatic(boxG, mat, [x, y, z], [0, ry, 0], [w, h, d]);
  const pole = (mat, x, y, z, radius, height) => addStatic(cylinderG, mat, [x, y, z], [0, 0, 0], [radius, height, radius]);
  const blob = (mat, x, y, z, sx, sy, sz) => addStatic(sphereG, mat, [x, y, z], [0, x * .61, .1], [sx, sy, sz]);

  function roundedBase(w, d, height, radius) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + radius, -d / 2);
    s.lineTo(w / 2 - radius, -d / 2);
    s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + radius);
    s.lineTo(w / 2, d / 2 - radius);
    s.quadraticCurveTo(w / 2, d / 2, w / 2 - radius, d / 2);
    s.lineTo(-w / 2 + radius, d / 2);
    s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - radius);
    s.lineTo(-w / 2, -d / 2 + radius);
    s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + radius, -d / 2);
    return new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: true, bevelThickness: .12, bevelSize: .12, bevelSegments: 2, steps: 1, curveSegments: 5 });
  }
  addStatic(roundedBase(29, 36, .6, 1.2), sand, [0, -.72, -.6], [-Math.PI / 2, 0, 0]);
  box(grass, 0, -.035, -.15, 22, .10, 29.4);
  for (let i = 0; i < 10; i++) box(i % 2 ? grassDark : grassLight, 0, .020, -13.38 + i * 2.94, 21.8, .018, 2.94);

  function line(x, z, w, d) { box(white, x, .045, z, w, .014, d); }
  line(-10.65, -.1, .075, 28.6); line(10.65, -.1, .075, 28.6);
  line(0, -14.4, 21.3, .075); line(0, 14.2, 21.3, .075);
  line(0, 7.5, 21.3, .075);
  line(-7, -9.4, .07, 10); line(7, -9.4, .07, 10); line(0, -4.4, 14, .07);
  line(-4.8, -12.4, .07, 4); line(4.8, -12.4, .07, 4); line(0, -10.4, 9.6, .07);
  addStatic(new THREE.RingGeometry(3.45, 3.52, 80), white, [0, .046, 7.5], [-Math.PI / 2, 0, 0]);
  addStatic(new THREE.RingGeometry(3.45, 3.52, 50, 1, 0, Math.PI), white, [0, .047, -4.4], [-Math.PI / 2, 0, 0]);
  addStatic(new THREE.CircleGeometry(.10, 20), white, [0, .05, -7.25], [-Math.PI / 2, 0, 0]);
  addStatic(new THREE.CircleGeometry(.10, 20), white, [0, .05, 7.5], [-Math.PI / 2, 0, 0]);
  // Walkways and striped advertising rails define the compact park.
  for (const side of [-1, 1]) {
    box(clay, side * 12.35, -.01, -.1, 2.15, .05, 29.2);
    box(cream, side * 11.32, .24, -3.3, .17, .48, 19.5);
    for (let j = 0; j < 7; j++) box(j % 2 ? dark : yellow, side * 11.20, .26, -11.65 + j * 2.6, .06, .36, 2.45);
  }
  box(dark, 0, .32, -15.15, 20.3, .65, .16);
  for (let j = 0; j < 9; j++) box(j % 2 ? coral : yellow, -9.1 + j * 2.28, .34, -15.05, 2.1, .34, .03);

  // Stadium seating is batched by material; every visible seat is real geometry.
  for (const side of [-1, 1]) {
    for (let row = 0; row < 3; row++) {
      const x = side * (12.7 + row * .38);
      box(cream, x, .20 + row * .35, 1.2, .45, .40 + row * .7, 13.2);
      for (let j = 0; j < 18; j++) {
        const z = -5 + j * .72;
        const m = (j + row) % 4 === 0 ? yellow : (j + row) % 3 === 0 ? coral : dark;
        box(m, x, .47 + row * .35, z, .40, .10, .48);
        box(m, x + side * .14, .64 + row * .35, z, .08, .31, .48);
        if ((j * 7 + row * 3 + side) % 5 === 0) {
          blob(cream, x, .95 + row * .35, z, .11, .13, .11);
          blob(m, x, .73 + row * .35, z, .17, .20, .15);
        }
      }
    }
  }
  function tree(x, z, h, variant = 0) {
    pole(bark, x, h * .31, z, .13, h * .62);
    const colors = [leaf, leafLight, leafGold];
    blob(colors[variant % 3], x, h * .76, z, h * .31, h * .42, h * .29);
    blob(colors[(variant + 1) % 3], x - h * .17, h * .72, z + .17, h * .23, h * .31, h * .25);
    blob(colors[variant % 3], x + h * .16, h * .65, z - .13, h * .24, h * .28, h * .25);
  }
  for (const [x, z, h, v] of [[-12.5,-14,3.9,0],[-14,-10,3.3,1],[12.7,-13.6,4.4,0],[14,-8.5,3.6,2],[-12.7,10.6,3.8,1],[12.9,11.9,4,0],[-8.8,-17,3.4,2],[8.3,-17,3.5,1]]) tree(x,z,h,v);
  for (const side of [-1, 1]) {
    for (let j=0;j<7;j++) blob(j%3?leaf:leafLight,side*12.1,.36,-14.3+j*.62,.5,.39,.45);
    for (const z of [-9.4, 9.1]) {
      pole(metal, side*13.8, 2.5, z, .065, 5);
      box(metal, side*13.8, 5.02, z, 1.28, .23, .35);
      for (let i=0;i<3;i++) box(cream,side*13.8+(i-1)*.35,4.99,z+.20,.26,.14,.06);
    }
    box(wood, side * 12.8, .49, 8.65, 1.05, .13, 2.5);
    box(wood, side * 13.16, .84, 8.65, .13, .63, 2.5);
    for (const dz of [-.88,.88]) box(metal,side*12.8,.23,8.65+dz,.76,.4,.12);
  }
  // Corner flags and bright cones offer scale without visual clutter.
  for(const x of [-10.5,10.5]) for(const z of [-14.2,14]) {
    pole(cream,x,.56,z,.025,1.12);
    const flag = new THREE.BufferGeometry();
    flag.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.48,-.14,0,0,-.30,0],3));
    flag.computeVertexNormals();
    addStatic(flag,coral,[x,1.1,z]);
  }
  for(const side of [-1,1]) for(let i=0;i<4;i++) {
    const x=side*9.1,z=4.4-i*3.2;
    addStatic(new THREE.ConeGeometry(.16,.39,12),coral,[x,.21,z]);
    box(white,x,.045,z,.35,.05,.35);
  }
  // A real seating bowl, covered terrace and mixed crowd give the pitch scale.
  const terrace=material('terrace','#adb1a9'),terraceLight=material('terraceLight','#c3c7bd');
  const seats=[material('seatNavy','#24404e'),material('seatTeal','#397f86'),material('seatGold','#bda46c')];
  const crowdClothes=[material('crowdBlue','#427991'),material('crowdCream','#d6ceb5'),material('crowdRed','#a34e42'),material('crowdSlate','#414a50')];
  const crowdSkin=[material('crowdSkin0','#b57e59'),material('crowdSkin1','#ddb391'),material('crowdSkin2','#79503b')];
  box(clay,0,.16,-14.9,32,.34,1.1);
  for(let row=0;row<7;row++){
    const z=-16.3-row*1.18,y=.25+row*.59;
    box(row%2?terrace:terraceLight,0,y,z,35,.63,1.15);
    for(let j=0;j<24;j++){
      const x=-16.3+j*1.42;
      const seat=seats[(j+Math.floor(row/3))%seats.length];
      box(seat,x,y+.44,z-.15,.86,.13,.66);
      box(seat,x,y+.70,z-.43,.86,.46,.12);
      if((j+row*3)%4!==0){
        const shirt=crowdClothes[(j*3+row)%crowdClothes.length];
        blob(crowdSkin[(j+row)%3],x,y+1.11,z,.12,.15,.12);
        blob(shirt,x,y+.80,z,.18,.22,.13);
        box(dark,x-.09,y+.55,z+.15,.11,.13,.30);box(dark,x+.09,y+.55,z+.15,.11,.13,.30);
      }
    }
  }
  for(const x of[-17.8,-10.7,-3.6,3.6,10.7,17.8]){
    pole(metal,x,4.15,-24.1,.12,8.3);
    box(metal,x,7.95,-21.0,.14,.24,6.5);
  }
  box(cream,0,8.2,-21.2,37.2,.17,7.0);
  box(dark,0,8.08,-17.75,37.2,.28,.22);
  for(const side of[-1,1]){
    pole(metal,side*14.5,5.0,-13.6,.115,10);
    box(metal,side*14.5,10.06,-13.6,2.7,.78,.32);
    for(let i=0;i<5;i++)for(let row=0;row<2;row++)box(white,side*14.5+(i-2)*.49,9.88+row*.34,-13.38,.39,.25,.075);
  }
  function flushBatches(parent){
  for (const [mat, geometries] of batches) {
    let count=0; for(const g of geometries) count+=g.attributes.position.count;
    const positions=new Float32Array(count*3), normals=new Float32Array(count*3);
    let offset=0;
    for(const g of geometries) {
      positions.set(g.attributes.position.array,offset);
      normals.set(g.attributes.normal.array,offset);
      offset+=g.attributes.position.array.length;
      g.dispose();
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
    geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,mat);
    mesh.castShadow = ![grass,grassLight,grassDark,white,sand,clay].includes(mat);
    mesh.receiveShadow=true;
    parent.add(mesh);
  }
  batches.clear();
  }
  flushBatches(themeGroups[0]);
  function surfaceTexture(kind){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');
    ctx.fillStyle=kind==='street'?'#777c78':kind==='forest'?'#637547':'#4d773c';ctx.fillRect(0,0,512,512);
    if(kind==='turf')for(let row=0;row<10;row++){ctx.fillStyle=row%2?'#4b7438':'#537d40';ctx.fillRect(0,row*51.2,512,51.2);}
    let seed=1471;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<23000;i++){
      ctx.fillStyle=kind==='street'?(i%2?'rgba(28,35,32,.10)':'rgba(231,227,209,.10)'):(i%3?'rgba(25,51,22,.12)':'rgba(202,191,116,.12)');
      ctx.fillRect(rand()*512,rand()*512,kind==='street'?1:1.2,kind==='street'?1:1+rand()*3.6);
    }
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    if(kind!=='turf'){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(12,12);}
    texture.anisotropy=Math.min(renderer.capabilities?.getMaxAnisotropy?.()||1,4);return texture;
  }
  const turf=new THREE.Mesh(new THREE.PlaneGeometry(21.8,29.4),new THREE.MeshStandardMaterial({map:surfaceTexture('turf'),roughness:1}));
  turf.rotation.x=-Math.PI/2;turf.position.set(0,.039,-.15);turf.receiveShadow=true;themeGroups[0].add(turf);
  // City: a continuous paved court with colorful facades and real window frames.
  const asphalt=material('asphalt','#7c817d'),roofMat=material('roof','#586773'),windowMat=material('window','#38525c',{roughness:.25,metalness:.12}),frameMat=material('frame','#c9c7b9');
  box(asphalt,0,-.06,0,100,.08,110);
  const facadeColors=['#a98064','#809498','#b6a487','#687b84','#967966','#8f9b91'];
  function building(x,z,w,h,d,i){
    const face=material('facade'+i,facadeColors[i%facadeColors.length]);
    box(face,x,h/2,z,w,h,d);box(roofMat,x,h+.08,z,w+.18,.21,d+.18);
    const cols=Math.max(2,Math.floor(w/1.05)),rows=Math.max(2,Math.floor(h/1.35));
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const wx=x-w/2+(col+.5)*w/cols,wy=.77+row*1.28;
      box(frameMat,wx,wy,z+d/2+.045,.70,.92,.09);box(windowMat,wx,wy+.015,z+d/2+.10,.53,.75,.035);
      box(roofMat,wx,wy,z+d/2+.13,.025,.77,.025);
      box(roofMat,wx,wy+.08,z+d/2+.135,.55,.025,.02);
      box(frameMat,wx,wy-.49,z+d/2+.13,.83,.075,.21);
      if(row===0&&col===0)box(roofMat,wx,1.43,z+d/2+.38,1.06,.17,.79);
    }
    box(frameMat,x,.17,z+d/2+.24,w+.16,.34,.55);
    for(let row=1;row<rows;row++)box(frameMat,x,row*1.28+.18,z+d/2+.08,w+.06,.07,.14);
    box(roofMat,x,h-.15,z+d/2+.09,w+.22,.15,.22);
    if(i%2===0){
      box(dark,x+.8,.75,z+d/2+.08,.88,1.43,.08);
      box(windowMat,x+.8,.93,z+d/2+.15,.68,.93,.035);
      box(cream,x+.8,1.69,z+d/2+.40,1.30,.16,.65);
    }
  }
  for(let i=0;i<8;i++)building(-17.7+i*5.1,-20.4+(i%3)*.9,4.9,5.4+(i%4)*1.1,4.2,i%6);
  for(const side of[-1,1])for(let i=0;i<4;i++)building(side*(12+i%2*.6),-10.7+i*7,4.2,4.9+(i%3)*1.4,5.9,(i+3)%6);
  for(const side of[-1,1]){
    box(frameMat,side*9.9,.02,-.4,.25,.14,33);
    for(let z=-12;z<13;z+=4.5)box(white,side*8.6,.02,z,.12,.025,1.8);
  }
  for(let z=-14;z<15;z+=3.3)box(white,0,.028,z,.085,.018,1.55);
  for(let i=0;i<13;i++)box(white,-7.2+i*1.2,.029,-15.3,.58,.018,1.95);
  for(const side of[-1,1])for(const z of[-10,4]){
    pole(metal,side*9.6,2.45,z,.055,4.9);box(metal,side*9.35,4.87,z,.55,.11,.16);
    box(white,side*9.35,4.80,z,.44,.035,.12);
  }
  flushBatches(themeGroups[1]);
  const streetFloor=new THREE.Mesh(new THREE.PlaneGeometry(100,110),new THREE.MeshStandardMaterial({map:surfaceTexture('street'),roughness:.97}));streetFloor.rotation.x=-Math.PI/2;streetFloor.position.y=-.015;streetFloor.receiveShadow=true;themeGroups[1].add(streetFloor);
  // Forest: bright pines, rounded broadleaf trees, rocks and grass clusters.
  const forestGround=material('forestGround','#657849'),pine=material('pine','#2e6141'),pineLight=material('pineLight','#426e43'),rock=material('rock','#9a9c88');
  box(forestGround,0,-.07,0,100,.1,110);
  function pineTree(x,z,h){
    pole(bark,x,h*.25,z,.23,h*.5);
    for(let layer=0;layer<4;layer++){
      const shape=new THREE.ConeGeometry(h*(.28-layer*.045),h*.44,10);
      addStatic(shape,layer%2?pine:pineLight,[x+Math.sin(x+layer)*.13,h*.40+layer*h*.16,z+Math.cos(z+layer)*.09],[0,x*.3+layer*.53,Math.sin(x)*.025],[1,.96,.90]);shape.dispose();
    }
  }
  for(const side of[-1,1])for(let i=0;i<8;i++){
    const x=side*(7.9+(i%3)*2.7),z=-18+i*4.8;
    if(i%3===1)tree(x,z,3.4+(i%2),i);else pineTree(x,z,4.4+(i%3)*.9);
    if(i%2===0)blob(rock,x-side*1.1,.45,z+.9,.82,.65,.74);
  }
  for(let i=0;i<74;i++){
    const x=((i*37)%181)/10-9,z=((i*53)%340)/10-16;
    if(Math.abs(x)<2.5)continue;
    const grassBlade=new THREE.BufferGeometry();grassBlade.setAttribute('position',new THREE.Float32BufferAttribute([-.11,0,0,0,.28,0,.04,0,0,.03,0,.03,.13,.23,.02,.12,0,.03],3));grassBlade.computeVertexNormals();
    addStatic(grassBlade,leaf,[x,.04,z]);grassBlade.dispose();
  }
  flushBatches(themeGroups[2]);boxG.dispose();cylinderG.dispose();sphereG.dispose();
  const forestFloor=new THREE.Mesh(new THREE.PlaneGeometry(100,110),new THREE.MeshStandardMaterial({map:surfaceTexture('forest'),roughness:1}));forestFloor.rotation.x=-Math.PI/2;forestFloor.position.y=-.015;forestFloor.receiveShadow=true;themeGroups[2].add(forestFloor);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(300,300),material('ground','#637b4c'));
  ground.rotation.x=-Math.PI/2;ground.position.y=-.87;ground.receiveShadow=true;scene.add(ground);

  function mesh(geometry, mat, parent, pos=[0,0,0], size=[1,1,1]) {
    const m=new THREE.Mesh(geometry,mat);m.position.fromArray(pos);m.scale.fromArray(size);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  const goal=new THREE.Group();scene.add(goal);
  for(const x of [-4.5,4.5]) mesh(new THREE.CylinderGeometry(.073,.073,3.12,12),white,goal,[x,1.56,-11.8]);
  const cross=mesh(new THREE.CylinderGeometry(.073,.073,9.15,12),white,goal,[0,3.11,-11.8]);cross.rotation.z=Math.PI/2;
  for(const x of [-4.5,4.5]) {
    const b=mesh(new THREE.CylinderGeometry(.043,.043,1.72,8),white,goal,[x,.06,-12.62]);b.rotation.x=Math.PI/2;
    const roof=mesh(new THREE.CylinderGeometry(.043,.043,1.70,8),white,goal,[x,3.00,-12.62]);roof.rotation.x=Math.PI/2+.13;
  }
  const netVertices=[];
  const netLine=(a,b)=>netVertices.push(...a,...b);
  for(let x=-4.5;x<=4.501;x+=.45) {
    netLine([x,3.1,-11.8],[x,2.9,-13.42]);
  }
  for(let b=-4.45;b<=7.4;b+=.5){
    const a1=Math.max(-4.5,.05-b),a2=Math.min(4.5,2.9-b);if(a2>a1)netLine([a1,a1+b,-13.42],[a2,a2+b,-13.42]);
    const b1=Math.max(-4.5,b-2.9),b2=Math.min(4.5,b-.05);if(b2>b1)netLine([b1,-b1+b,-13.42],[b2,-b2+b,-13.42]);
  }
  for(let y=.05;y<3;y+=.24) {
    for(const x of [-4.5,4.5]) netLine([x,y,-11.8],[x,y,-13.42]);
  }
  for(let z=-11.8;z>=-13.43;z-=.27) {
    const y=3.1+(z+11.8)*.123;
    netLine([-4.5,y,z],[4.5,y,z]);
    for(const x of [-4.5,4.5]) netLine([x,.05,z],[x,y,z]);
  }
  const netGeometry=new THREE.BufferGeometry();netGeometry.setAttribute('position',new THREE.Float32BufferAttribute(netVertices,3));
  const net=new THREE.LineSegments(netGeometry,new THREE.LineBasicMaterial({color:0xf8ffef,transparent:true,opacity:.85}));goal.add(net);

  function label(text, color='#f5f3dc', bg='transparent', w=512,h=96) {
    const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');
    if(bg!=='transparent'){ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);}
    ctx.fillStyle=color;ctx.font='900 64px Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,w/2,h/2+3);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
  }
  function kitPrint(number,isPlayer){
    const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');
    ctx.fillStyle='#f1ecd9';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font='700 24px Arial, sans-serif';ctx.fillText(isPlayer?'GOLINGO':'GOAL CLUB',128,28);
    ctx.font='900 166px Arial, sans-serif';ctx.fillText(number,128,150);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
  }
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(5.3,.9),new THREE.MeshBasicMaterial({map:label('GO LINGO','#f4f1dc','#1f3d4b'),transparent:false}));
  sign.position.set(0,.53,-14.96);themeGroups[0].add(sign);

  const sphereGeo = new THREE.SphereGeometry(1,16,12);
  const capsuleGeo = new THREE.CapsuleGeometry(1,1,4,10);
  const bodyRings=[[0,.18,.12],[.14,.195,.13],[.35,.235,.145],[.50,.275,.13],[.59,.24,.12],[.64,.16,.10]];
  const bodyPositions=[],bodyIndices=[],ringSegments=16;
  for(const [y,w,d] of bodyRings)for(let j=0;j<ringSegments;j++){const a=j/ringSegments*Math.PI*2;bodyPositions.push(Math.cos(a)*w,y,Math.sin(a)*d);}
  for(let i=0;i<bodyRings.length-1;i++)for(let j=0;j<ringSegments;j++){const a=i*ringSegments+j,b=i*ringSegments+(j+1)%ringSegments,c=a+ringSegments,d=b+ringSegments;bodyIndices.push(a,c,b,b,c,d);}
  for(const row of[0,bodyRings.length-1])for(let j=1;j<ringSegments-1;j++){
    const start=row*ringSegments;bodyIndices.push(start,start+j+(row?1:0),start+j+(row?0:1));
  }
  const torsoGeo=new THREE.BufferGeometry();torsoGeo.setAttribute('position',new THREE.Float32BufferAttribute(bodyPositions,3));torsoGeo.setIndex(bodyIndices);torsoGeo.computeVertexNormals();
  const headProfile=[new THREE.Vector2(.032,-.173),new THREE.Vector2(.086,-.153),new THREE.Vector2(.119,-.110),new THREE.Vector2(.139,-.043),new THREE.Vector2(.145,.045),new THREE.Vector2(.136,.108),new THREE.Vector2(.103,.154),new THREE.Vector2(.025,.176)];
  const headGeo=new THREE.LatheGeometry(headProfile,20);headGeo.scale(1,1,.92);
  const skins=['#bd8968','#d0a283','#8d6049','#ab7959'];
  function mergeRigidParts(group) {
    const groups=[];group.traverse(o=>{if(o.isGroup)groups.push(o);});
    for(const node of groups.reverse()){
      const sets=new Map();
      for(const child of node.children){if(!child.isMesh||child.material.map)continue;const key=child.material;if(!sets.has(key))sets.set(key,[]);sets.get(key).push(child);}
      for(const [mat,parts] of sets){
        if(parts.length<2)continue;
        const gs=parts.map(part=>{part.updateMatrix();let g=part.geometry.clone();g.applyMatrix4(part.matrix);if(g.index){const raw=g.toNonIndexed();g.dispose();g=raw;}return g;});
        const length=gs.reduce((n,g)=>n+g.attributes.position.array.length,0),p=new Float32Array(length),n=new Float32Array(length);let at=0;
        for(const g of gs){p.set(g.attributes.position.array,at);n.set(g.attributes.normal.array,at);at+=g.attributes.position.array.length;g.dispose();}
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('normal',new THREE.BufferAttribute(n,3));g.computeBoundingSphere();
        parts.forEach(part=>node.remove(part));mesh(g,mat,node);
      }
    }
  }
  function makeHuman(isPlayer,index=0,isKeeper=false) {
    const group=new THREE.Group();
    const skin=material('skin'+index,skins[index%skins.length],{roughness:.79});
    const jersey=isPlayer?material('playerJersey','#1e8caa'):isKeeper?material('keeperJersey','#546c3e'):material('defenderJersey','#ac433a');
    const jerseyShade=isPlayer?material('playerJerseyShade','#17677f'):isKeeper?material('keeperJerseyShade','#3e5230'):material('defenderJerseyShade','#85362f');
    const trim=isPlayer?material('playerTrim','#dedbc8'):isKeeper?material('keeperTrim','#e0d4a0'):material('defenderTrim','#e5d8c6');
    const shorts=isPlayer?material('playerShorts','#182f40'):isKeeper?material('keeperShorts','#24312a'):material('defenderShorts','#29323a');
    const bootMat=isPlayer?material('playerBoot','#ede0b8',{roughness:.52}):material('defenderBoot','#30383a',{roughness:.56});
    const hair=material('hair'+index,['#30261f','#292724','#382c23','#201f1c'][index%4],{roughness:.95});
    const rig=new THREE.Group();group.add(rig);rig.position.y=1.02;
    const torso=new THREE.Group();rig.add(torso);mesh(torsoGeo,jersey,torso,[0,0,0]);
    // Tailored side panels, a hem and collar give the kit a cloth silhouette.
    for(const side of[-1,1]){
      const panel=mesh(new THREE.CapsuleGeometry(.023,.37,3,8),jerseyShade,torso,[side*.210,.25,0],[1,1,2.4]);panel.rotation.z=-side*.09;
      mesh(new THREE.BoxGeometry(.027,.065,.22),trim,torso,[side*.245,.53,0]);
    }
    mesh(new THREE.CylinderGeometry(.184,.184,.036,16),jerseyShade,torso,[0,.018,0],[1,1,.66]);
    mesh(new THREE.CylinderGeometry(.072,.084,.14,12),skin,torso,[0,.68,0]);
    mesh(new THREE.TorusGeometry(.084,.013,6,16),trim,torso,[0,.626,0],[1,1,.75]).rotation.x=Math.PI/2;
    const head=new THREE.Group();head.position.set(0,.83,-.008);torso.add(head);
    mesh(headGeo,skin,head);
    const scalp=mesh(new THREE.SphereGeometry(1,18,10,0,Math.PI*2,0,1.82),hair,head,[0,.050,.007],[.150,.139,.143]);
    for(let i=0;i<5;i++){
      const clump=mesh(sphereGeo,hair,head,[-.096+i*.045,.130+Math.sin(i*.78)*.010,-.024-i*.007],[.053,.036,.082]);clump.rotation.set(-.10,-.10,-.24);
    }
    for(const side of[-1,1]){
      mesh(sphereGeo,skin,head,[side*.142,-.005,.006],[.026,.045,.022]);
      mesh(sphereGeo,hair,head,[side*.130,.024,.027],[.015,.077,.055]);
      // Eyes are inset, tiny dark marks under a brow, never protruding globes.
      mesh(sphereGeo,dark,head,[side*.054,.018,-.128],[.019,.009,.004]);
      const brow=mesh(new THREE.CapsuleGeometry(.006,.031,3,6),hair,head,[side*.055,.040,-.126]);brow.rotation.z=Math.PI/2-side*.07;
    }
    const noseShape=new THREE.Shape();noseShape.moveTo(-.016,.020);noseShape.quadraticCurveTo(0,.048,.016,.020);noseShape.lineTo(.025,-.038);noseShape.quadraticCurveTo(0,-.053,-.025,-.038);noseShape.closePath();
    const noseG=new THREE.ExtrudeGeometry(noseShape,{depth:.028,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:2,curveSegments:5,steps:1});
    mesh(noseG,skin,head,[0,-.016,-.166]);
    const mouth=mesh(new THREE.CapsuleGeometry(.0035,.044,3,8),material('mouth','#795747'),head,[0,-.084,-.112]);mouth.rotation.z=Math.PI/2;
    const arms=[];
    for(const side of[-1,1]){
      const shoulder=new THREE.Group();shoulder.position.set(side*.270,.520,0);torso.add(shoulder);shoulder.rotation.z=side*.10;
      mesh(new THREE.CapsuleGeometry(.078,.115,4,12),jersey,shoulder,[0,-.071,0],[1,1,.94]);
      mesh(new THREE.CylinderGeometry(.076,.070,.025,12),trim,shoulder,[0,-.155,0]);
      mesh(new THREE.CylinderGeometry(.064,.052,.205,12),skin,shoulder,[0,-.240,0]);
      const elbow=new THREE.Group();elbow.position.y=-.340;shoulder.add(elbow);mesh(sphereGeo,skin,elbow,[0,0,0],[.054,.057,.053]);
      mesh(new THREE.CylinderGeometry(.052,.036,.252,12),skin,elbow,[0,-.125,0]);
      const handMat=isKeeper?material('keeperGloves','#d7d4b7',{roughness:.65}):skin;
      mesh(sphereGeo,handMat,elbow,[0,-.280,-.007],isKeeper?[.066,.080,.041]:[.041,.060,.027]);
      for(let j=0;j<4;j++)mesh(new THREE.CapsuleGeometry(isKeeper?.014:.009,isKeeper?.050:.037,3,6),handMat,elbow,[-.029+j*.019,-.321,-.014]);
      const thumb=mesh(new THREE.CapsuleGeometry(isKeeper?.015:.010,.035,3,6),handMat,elbow,[side*.048,-.281,-.018]);thumb.rotation.z=side*.48;
      arms.push({shoulder,elbow});
    }
    const legs=[];
    for(const side of[-1,1]){
      const hip=new THREE.Group();hip.position.set(side*.135,0,0);rig.add(hip);
      mesh(new THREE.CylinderGeometry(.126,.105,.29,14),shorts,hip,[0,-.118,0],[1,1,.91]);
      mesh(new THREE.BoxGeometry(.018,.25,.10),trim,hip,[side*.117,-.115,0]);
      mesh(new THREE.CylinderGeometry(.091,.069,.22,12),skin,hip,[0,-.330,0],[1,1,1.03]);
      const knee=new THREE.Group();knee.position.y=-.440;hip.add(knee);mesh(sphereGeo,skin,knee,[0,0,-.008],[.071,.069,.068]);
      mesh(new THREE.CylinderGeometry(.070,.043,.435,14),isKeeper?jersey:trim,knee,[0,-.218,.003]);
      mesh(new THREE.CylinderGeometry(.074,.072,.045,14),jersey,knee,[0,-.048,0]);
      mesh(new THREE.CylinderGeometry(.073,.071,.014,14),shorts,knee,[0,-.077,0]);
      const foot=new THREE.Group();foot.position.set(0,-.495,0);knee.add(foot);
      mesh(sphereGeo,bootMat,foot,[0,.012,-.048],[.071,.059,.139]);
      mesh(new THREE.BoxGeometry(.125,.022,.230),dark,foot,[0,-.031,-.044]);
      for(const z of[-.113,-.04,.038])for(const x of[-.042,.042])mesh(new THREE.CylinderGeometry(.010,.013,.016,6),dark,foot,[x,-.049,z]);
      for(let j=0;j<3;j++)mesh(new THREE.BoxGeometry(.067,.005,.009),shorts,foot,[0,.065,-.074+j*.021]);
      if(isPlayer)for(const side of[-1,1])for(let j=0;j<2;j++){
        const stripe=mesh(new THREE.BoxGeometry(.005,.014,.050),shorts,foot,[side*.067,.024,-.066+j*.039]);stripe.rotation.x=-.45;
      }
      legs.push({hip,knee,foot});
    }
    const numberText=isPlayer?'10':isKeeper?'1':String(4+index);
    const number=new THREE.Mesh(new THREE.PlaneGeometry(.310,.430),new THREE.MeshBasicMaterial({map:kitPrint(numberText,isPlayer),transparent:true,depthWrite:false}));number.position.set(0,.340,.149);torso.add(number);
    const frontNumber=new THREE.Mesh(new THREE.PlaneGeometry(.090,.110),new THREE.MeshBasicMaterial({map:label(numberText,'#f1ecd9','transparent',128,128),transparent:true,depthWrite:false}));frontNumber.position.set(.105,.440,-.148);frontNumber.rotation.y=Math.PI;torso.add(frontNumber);
    const chestBadge=mesh(new THREE.BoxGeometry(.055,.070,.008),trim,torso,[-.110,.470,-.144]);
    group.userData.rig={root:rig,torso,head,arms,legs,baseZ:9.1};mergeRigidParts(group);return group;
  }
  const player=makeHuman(true,0);player.position.set(-.65,0,9);player.scale.setScalar(1.18);scene.add(player);
  const defenders=[],spareDefenders=[];
  function setDefenders(configs=[]) {
    while(defenders.length>configs.length) {const d=defenders.pop();scene.remove(d.group);spareDefenders.push(d);}
    configs.forEach((config,index)=>{
      let d=defenders[index];
      if(!d){const spare=spareDefenders.findIndex(s=>s.keeper===!!config.keeper);d=spare>=0?spareDefenders.splice(spare,1)[0]:{group:makeHuman(false,index+1,!!config.keeper),keeper:!!config.keeper};d.group.rotation.y=Math.PI;scene.add(d.group);defenders.push(d);}
      if(d.keeper!==!!config.keeper){scene.remove(d.group);spareDefenders.push({group:d.group,keeper:d.keeper});const spare=spareDefenders.findIndex(s=>s.keeper===!!config.keeper);d.group=spare>=0?spareDefenders.splice(spare,1)[0].group:makeHuman(false,index+1,!!config.keeper);d.group.rotation.y=Math.PI;scene.add(d.group);}
      Object.assign(d,{baseX:config.x||0,baseZ:config.z??-4,moving:!!config.moving,amplitude:config.amplitude??1.4,phase:config.phase??index*1.7,speed:config.speed??.75,radius:config.radius??.53,height:config.height??(config.keeper?2.8:2.17),keeper:!!config.keeper,hit:false,save:null});
      d.group.scale.setScalar(d.keeper?1.12:1.07);
      d.group.rotation.z=0;d.group.position.set(d.baseX,0,d.baseZ);d.group.visible=true;
    });
  }
  setDefenders([{x:-2.5,z:-4.8},{x:1.5,z:-1.8}]);

  const ball=new THREE.Group();ball.position.set(0,.29,8);ball.scale.setScalar(.9);scene.add(ball);
  mesh(new THREE.SphereGeometry(.27,26,20),material('ballWhite','#fffef3',{roughness:.61}),ball);
  const ico=new THREE.IcosahedronGeometry(1,0);const verts=ico.attributes.position;const centers=[];
  for(let i=0;i<verts.count;i++){const p=new THREE.Vector3().fromBufferAttribute(verts,i).normalize();if(!centers.some(v=>v.distanceToSquared(p)<.001))centers.push(p);}
  const patchPos=[],patchNormals=[];
  for(const n of centers){
    const u=new THREE.Vector3().crossVectors(n,new THREE.Vector3(0,Math.abs(n.y)>.9?0:1,Math.abs(n.y)>.9?1:0)).normalize();
    const v=new THREE.Vector3().crossVectors(n,u).normalize();
    for(let j=0;j<5;j++){
      const a=j*Math.PI*2/5,b=(j+1)*Math.PI*2/5;
      const p1=n.clone().addScaledVector(u,.29*Math.cos(a)).addScaledVector(v,.29*Math.sin(a)).normalize();
      const p2=n.clone().addScaledVector(u,.29*Math.cos(b)).addScaledVector(v,.29*Math.sin(b)).normalize();
      for(const p of [n,p1,p2]){patchPos.push(p.x*.272,p.y*.272,p.z*.272);patchNormals.push(p.x,p.y,p.z);}
    }
  }
  const patches=new THREE.BufferGeometry();patches.setAttribute('position',new THREE.Float32BufferAttribute(patchPos,3));patches.setAttribute('normal',new THREE.Float32BufferAttribute(patchNormals,3));
  mesh(patches,material('ballBlack','#253d3d',{roughness:.65,side:THREE.DoubleSide}),ball);ico.dispose();
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=64;shadowCanvas.height=64;const shadowCtx=shadowCanvas.getContext('2d');
  const gradient=shadowCtx.createRadialGradient(32,32,3,32,32,31);gradient.addColorStop(0,'rgba(19,42,32,.28)');gradient.addColorStop(1,'rgba(19,42,32,0)');shadowCtx.fillStyle=gradient;shadowCtx.fillRect(0,0,64,64);
  const ballShadow=new THREE.Mesh(new THREE.PlaneGeometry(1.05,1.05),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));ballShadow.rotation.x=-Math.PI/2;ballShadow.position.set(0,.07,8);scene.add(ballShadow);
  const particles=new THREE.Group();scene.add(particles);

  const obstacles=[];
  const obstacleYellow=material('obstacleYellow','#e6bc16'),obstacleDark=material('obstacleDark','#4b5354'),logBark=material('logBark','#924a28'),logEnd=material('logEnd','#bd7941'),coneOrange=material('coneOrange','#f68b1f');
  function makeObstacle(config){
    const g=new THREE.Group(),w=config.width??1.8,d=config.depth??.75,h=config.height??1.25,type=config.type||'wall';
    if(type==='log'){
      const radius=Math.min(h/2,d/2,.36);
      const count=Math.max(1,Math.ceil((d-2*radius)/(radius*1.65))+1);
      const spacing=count>1?(d-2*radius)/(count-1):0;
      for(let i=0;i<count;i++){
        const z=count>1?-d/2+radius+i*spacing:0;
        const log=mesh(new THREE.CylinderGeometry(radius*.91,radius,w,12),logBark,g,[0,radius,z]);log.rotation.z=Math.PI/2;
        for(const x of[-w/2-.012,w/2+.012]){const end=mesh(new THREE.CircleGeometry(radius*.90,12),logEnd,g,[x,radius,z]);end.rotation.y=x>0?Math.PI/2:-Math.PI/2;}
      }
      if(h>radius*2+.04){
        const upperRadius=radius*.92,upperCount=Math.max(1,count-1),y=h-upperRadius;
        for(let i=0;i<upperCount;i++){
          const z=count>1?-d/2+radius+(i+.5)*spacing:0;
          const log=mesh(new THREE.CylinderGeometry(upperRadius*.94,upperRadius,w*.94,12),logBark,g,[0,y,z]);log.rotation.z=Math.PI/2;
          for(const x of[-w*.47-.01,w*.47+.01]){const end=mesh(new THREE.CircleGeometry(upperRadius*.90,12),logEnd,g,[x,y,z]);end.rotation.y=x>0?Math.PI/2:-Math.PI/2;}
        }
      }
      mergeRigidParts(g);
    }else if(type==='cone'){
      mesh(new THREE.BoxGeometry(w,.13,d),coneOrange,g,[0,.065,0]);
      const r=Math.min(w,d)*.40;
      mesh(new THREE.ConeGeometry(r,h-.10,14),coneOrange,g,[0,h/2+.05,0]);
      mesh(new THREE.CylinderGeometry(r*.43,r*.63,h*.18,14),white,g,[0,h*.49,0]);
      mesh(new THREE.CylinderGeometry(r*.12,r*.28,h*.14,14),white,g,[0,h*.80,0]);
    }else{
      mesh(new THREE.BoxGeometry(w,.18,d),obstacleYellow,g,[0,.09,0]);
      const bodyShape=new THREE.Shape();bodyShape.moveTo(-d*.40,.12);bodyShape.lineTo(-d*.14,h-.025);bodyShape.lineTo(d*.14,h-.025);bodyShape.lineTo(d*.40,.12);bodyShape.closePath();
      const barrier=new THREE.ExtrudeGeometry(bodyShape,{depth:w*.90,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:1,steps:1});barrier.rotateY(Math.PI/2);barrier.translate(-w*.45,0,0);
      mesh(barrier,obstacleDark,g);
      for(const side of[-1,1])mesh(new THREE.BoxGeometry(w*.12,h*.67,d*.66),obstacleYellow,g,[side*w*.36,h*.40,0]);
      mesh(new THREE.BoxGeometry(w*.92,.09,d*.32),obstacleYellow,g,[0,h-.045,0]);
    }
    g.position.set(config.x||0,0,config.z||0);scene.add(g);
    return{group:g,type,baseX:config.x||0,baseZ:config.z||0,width:w,depth:d,height:h,moving:!!config.moving,amplitude:config.amplitude??1,speed:config.speed??.8,phase:config.phase??0,hit:false};
  }
  function setChallenge(config={}){
    challenge={startX:config.startX??0,startZ:config.startZ??8,goalX:config.goalX??0,goalWidth:config.goalWidth??7};
    goal.position.x=challenge.goalX;goal.scale.x=challenge.goalWidth/9;
    ball.position.set(challenge.startX,.29,challenge.startZ);ball.visible=true;
    for(const obstacle of obstacles){scene.remove(obstacle.group);obstacle.group.traverse(o=>o.geometry?.dispose());}
    obstacles.length=0;for(const obstacle of config.obstacles||[])obstacles.push(makeObstacle(obstacle));
    resetPlayer();configureCamera(camera,width,height,challenge);
  }

  let width=1,height=1,lastKick=-1,shotStyle='curl';
  let aiming={x:0,bend:0,power:.72,style:'curl'},aimYaw=0,charge=null,chargeBlend=0;
  const netBase=new Float32Array(netGeometry.attributes.position.array);
  let goalImpact={age:Infinity,x:0,y:1};
  function setShotStyle(style){shotStyle=['drive','curl','chip'].includes(style)?style:'curl';}
  function setAim({x=challenge.goalX,bend=0,power=.72,style=shotStyle}={}){
    aiming={x:Number.isFinite(x)?x:challenge.goalX,bend:Number.isFinite(bend)?bend:0,power:clamp(Number.isFinite(power)?power:.72,0,1),style};
    if(['drive','curl','chip'].includes(style))shotStyle=style;
  }
  function setCharge(value){charge=typeof value==='number'&&Number.isFinite(value)?clamp(value,0,1):null;}
  function scoreGoal({x=challenge.goalX,y=1}={}){goalImpact={age:0,x:(x-challenge.goalX)/(challenge.goalWidth/9),y};}
  function saveBall(blocker,position){if(blocker?.group?.userData?.rig)blocker.save={age:0,side:Math.sign((position?.x??0)-blocker.group.position.x)||1,high:(position?.y??0)>1.35};}
  function clearShotEffects(){
    goalImpact.age=Infinity;netGeometry.attributes.position.array.set(netBase);netGeometry.attributes.position.needsUpdate=true;
    for(const d of defenders){
      d.save=null;d.group.rotation.z=0;const r=d.group.userData.rig;
      r.root.position.set(0,1.02,0);r.root.rotation.set(0,0,0);r.torso.rotation.set(0,0,0);
      r.legs.forEach(({hip,knee,foot})=>{hip.rotation.set(0,0,0);knee.rotation.set(0,0,0);foot.rotation.set(0,0,0);});
    }
  }
  function resize(w,h) {
    width=Math.max(1,w);height=Math.max(1,h);
    configureCamera(camera,width,height,challenge);renderer.setSize(width,height,false);
  }
  const projection=new THREE.Vector3();
  function project(vec3) {
    if(Array.isArray(vec3)) projection.fromArray(vec3); else projection.copy(vec3);
    projection.project(camera);return{x:(projection.x*.5+.5)*width,y:(-.5*projection.y+.5)*height,visible:projection.z>-1&&projection.z<1&&Math.abs(projection.x)<1.2&&Math.abs(projection.y)<1.2};
  }
  function resetPlayer(){
    lastKick=-1;charge=null;chargeBlend=0;aimYaw=0;aiming={x:challenge.goalX,bend:0,power:.72,style:shotStyle};const r=player.userData.rig;player.position.set(challenge.startX-.65,0,challenge.startZ+1);player.rotation.set(0,Math.atan2(challenge.startX-challenge.goalX,challenge.startZ+11.8),0);r.root.position.set(0,1.02,0);r.root.rotation.set(0,0,0);r.torso.rotation.set(-.035,0,0);r.head.rotation.set(-.10,0,0);
    r.arms.forEach(({shoulder,elbow},i)=>{shoulder.rotation.set(-.06,0,(i?1:-1)*.12);elbow.rotation.x=-.18;});
    r.legs.forEach(({hip,knee,foot})=>{hip.rotation.set(0,0,0);knee.rotation.set(0,0,0);foot.rotation.set(0,0,0);});
  }
  function kick(progress){
    const p=clamp(progress,0,1);lastKick=p;charge=null;chargeBlend=0;const r=player.userData.rig;
    const wind=smooth(clamp(p/.30,0,1)),strike=smooth(clamp((p-.30)/(.34/.65-.30),0,1)),follow=smooth(clamp((p-.34/.65)/.24,0,1)),recover=smooth(clamp((p-.80)/.20,0,1));
    const approach=smooth(clamp(p/(.34/.65),0,1));
    player.position.set(challenge.startX-.65+.36*approach+.035*follow,0,challenge.startZ+1-.41*approach-.06*follow);
    player.rotation.y=Math.atan2(challenge.startX-challenge.goalX,challenge.startZ+11.8)-.055*strike;
    r.root.position.set(0,1.02-.010*wind+.028*follow,0);r.root.rotation.set(0,0,0);
    r.legs.forEach(({hip,knee,foot})=>{hip.rotation.y=hip.rotation.z=0;knee.rotation.y=knee.rotation.z=0;foot.rotation.set(0,0,0);});
    r.torso.rotation.set(-.09*wind-.05*strike+.13*follow, .21*wind-.35*strike+.10*recover,-.025*wind+.04*follow);
    r.legs[1].hip.rotation.x=-.62*wind+1.05*strike+(shotStyle==='chip'?.81:.65)*follow-.38*recover;
    r.legs[1].knee.rotation.x=-.80*wind+.76*strike-.22*follow+.10*recover;
    r.legs[1].foot.rotation.x=.12*wind-.18*strike+.16*follow;
    r.legs[1].foot.rotation.y=shotStyle==='drive'?0:-.12*strike;
    r.legs[0].hip.rotation.x=.09*wind-.11*strike+.13*follow;r.legs[0].knee.rotation.x=-.16*wind+.10*strike;
    r.arms[0].shoulder.rotation.set(-.14*wind+.38*strike,0,-.20-.58*wind+.23*recover);
    r.arms[1].shoulder.rotation.set(.42*wind-.65*strike,0,.15+.36*wind-.15*recover);
    r.arms[0].elbow.rotation.x=-.38;r.arms[1].elbow.rotation.x=-.52;
    r.head.rotation.set(-.14+.10*follow,-.07*strike,0);
  }
  function celebrate(progress){
    const p=clamp(progress,0,1),r=player.userData.rig;lastKick=2;charge=null;chargeBlend=0;
    player.position.y=Math.max(0,Math.sin(p*Math.PI*2))*.085;
    r.arms[0].shoulder.rotation.set(-.2,0,-1.85);r.arms[1].shoulder.rotation.set(.05,0,.48);
    r.arms[0].elbow.rotation.x=-1.15;r.arms[1].elbow.rotation.x=-.85;
    r.legs.forEach(({hip,knee,foot})=>{hip.rotation.x=0;knee.rotation.x=0;foot.rotation.set(0,0,0);});
    r.root.position.set(0,1.02,0);r.root.rotation.set(0,0,0);r.torso.rotation.set(-.035,Math.sin(p*5)*.10,-.045);r.head.rotation.set(-.04,Math.sin(p*4)*.04,0);
  }
  function setTheme(index=0){
    const selected=[0,2,1][((index%3)+3)%3];
    themeGroups.forEach((group,i)=>group.visible=i===selected);
    const colors=['#b8ccd1','#c4c9c4','#b4c4ae'];scene.background.set(colors[selected]);scene.fog.color.set(colors[selected]);mats.ground.color.set(selected===0?'#637b4c':selected===1?'#777c78':'#657849');
  }
  function update(dt,time,state={}){
    if(!state.paused){
      for(const d of defenders){
        const r=d.group.userData.rig,t=time*d.speed+d.phase;
        d.group.rotation.z=0;d.group.rotation.y=Math.PI;
        r.root.position.set(0,1.02+Math.sin(time*2+d.phase)*.009-(d.keeper?.035:0),0);r.root.rotation.set(0,0,0);
        r.legs.forEach(({hip,knee,foot})=>{hip.rotation.set(0,0,0);knee.rotation.set(d.keeper?-.12:0,0,0);foot.rotation.set(0,0,0);});
        if(d.moving&&!d.hit){
          d.group.position.x=d.baseX+Math.sin(t)*d.amplitude;
          const velocity=Math.abs(Math.cos(t)*d.amplitude*d.speed),step=Math.sin(time*(d.keeper?9:8.3)+d.phase)*clamp(velocity*.55,.20,1);
          if(d.keeper){
            r.legs[0].hip.rotation.z=step*.075;r.legs[1].hip.rotation.z=step*.075;
            r.legs[0].knee.rotation.x=-.12-Math.max(0,-step)*.08;r.legs[1].knee.rotation.x=-.12-Math.max(0,step)*.08;
            r.root.position.y+=Math.abs(step)*.006;
          }else{
            r.legs[0].hip.rotation.x=step*.22;r.legs[1].hip.rotation.x=-step*.22;
            r.legs[0].knee.rotation.x=-Math.max(0,-step)*.22;r.legs[1].knee.rotation.x=-Math.max(0,step)*.22;
          }
          d.group.rotation.y=Math.PI+Math.cos(t)*.13;
        }
        r.arms.forEach(({shoulder,elbow},i)=>{shoulder.rotation.set(d.keeper?-.22:-.04,0,(i?1:-1)*((d.keeper?.47:.11)+Math.sin(time*1.7+d.phase)*.025));elbow.rotation.x=d.keeper?-.80:-.17;});
        r.head.rotation.set(d.keeper?-.05:0,0,0);
        r.torso.rotation.set(d.keeper?-.10:0,0,0);
        if(d.keeper&&ball.visible){
          const near=clamp(1-(Math.abs(ball.position.z-d.baseZ)-2)/2,0,1),reach=near*clamp((ball.position.y-1.65)*1.8,0,1);
          r.head.rotation.y=clamp(Math.atan2(ball.position.x-d.group.position.x,Math.max(1,ball.position.z-d.baseZ))-(d.group.rotation.y-Math.PI),-.20,.20);
          r.root.position.y+=reach*.26;
          r.arms.forEach(({shoulder,elbow},i)=>{shoulder.rotation.z=(i?1:-1)*mix(.47,3.02,reach);elbow.rotation.x=mix(-.80,-.12,reach);});
        }
        if(d.hit){r.torso.rotation.x=-.16;r.head.rotation.x=-.09;r.arms[0].shoulder.rotation.z=-.55;r.arms[1].shoulder.rotation.z=.55;}
        if(d.save){
          d.save.age+=dt;const age=d.save.age,dive=smooth(clamp(age/.18,0,1))*(1-smooth(clamp((age-.27)/.55,0,1))),side=d.save.side;
          // The patrol root stays on the physical path; the articulated body reaches for the save.
          r.root.position.x=-side*dive*.08;r.root.position.y+=dive*(d.save.high?.10:-.035);
          r.torso.rotation.z=side*dive*.48;r.torso.rotation.x-=dive*.07;r.head.rotation.z=-side*dive*.16;
          const reaching=side>0?0:1;
          r.arms.forEach(({shoulder,elbow},i)=>{
            shoulder.rotation.x=mix(shoulder.rotation.x,d.save.high?-.55:-.25,dive);
            shoulder.rotation.z=mix(shoulder.rotation.z,-side*(i===reaching?1.65:.85),dive);
            elbow.rotation.x=mix(elbow.rotation.x,i===reaching?-.12:-.58,dive);
          });
          r.legs.forEach(({knee,foot})=>{knee.rotation.x-=dive*.12;foot.rotation.x=dive*.08;});
          if(age>=.82)d.save=null;
        }
      }
      if(goalImpact.age<1.5){
        goalImpact.age+=dt;const a=netGeometry.attributes.position,t=goalImpact.age;
        for(let i=0;i<a.count;i++){
          const x=netBase[i*3],y=netBase[i*3+1],z=netBase[i*3+2],distance=Math.hypot(x-goalImpact.x,(y-goalImpact.y)*1.35);
          const rear=clamp((-z-11.8)/1.62,0,1);
          const wave=t>=1.45?0:Math.sin(t*15-distance*1.3)*Math.exp(-t*3.1)*Math.exp(-distance*.48)*.45*rear;
          a.setXYZ(i,x,y,z-wave);
        }
        a.needsUpdate=true;
      }
      for(const obstacle of obstacles){if(obstacle.moving&&!obstacle.hit)obstacle.group.position.x=obstacle.baseX+Math.sin(time*obstacle.speed+obstacle.phase)*obstacle.amplitude;}
      if(lastKick<0){
        const r=player.userData.rig,blend=1-Math.exp(-Math.max(0,dt)*12);
        const desiredYaw=clamp(Math.atan2(challenge.startX-aiming.x-aiming.bend*.7,challenge.startZ+11.8)-player.rotation.y,-.16,.16);
        aimYaw=mix(aimYaw,desiredYaw,blend);chargeBlend=mix(chargeBlend,charge??0,blend);
        // Bend both knees while keeping the boots level and at the same turf height.
        const kneeAngle=.235*chargeBlend;
        r.root.position.set(0,1.02-(.440+.495)*(1-Math.cos(kneeAngle)),0);
        r.legs.forEach(({hip,knee,foot})=>{hip.rotation.set(kneeAngle,0,0);knee.rotation.set(-2*kneeAngle,0,0);foot.rotation.set(kneeAngle,0,0);});
        r.torso.rotation.set(-.035+Math.sin(time*1.8)*.006-.10*chargeBlend,aimYaw*.28,-.012*chargeBlend);
        r.head.rotation.set(-.10-.06*chargeBlend,aimYaw+Math.sin(time*.65)*.006,0);
        r.arms.forEach(({shoulder,elbow},i)=>{shoulder.rotation.set(-.06+(i?.08:-.07)*chargeBlend,0,(i?1:-1)*(.12+.11*chargeBlend));elbow.rotation.x=-.18-.16*chargeBlend;});
      }
    }
    ballShadow.position.x=ball.position.x;ballShadow.position.z=ball.position.z;ballShadow.visible=ball.visible;ballShadow.scale.setScalar(1+Math.max(0,ball.position.y-.28)*.12);ballShadow.material.opacity=clamp(1-ball.position.y*.12,.3,1);
    renderer.render(scene,camera);
  }
  function dispose(){renderer.dispose();scene.traverse(o=>{o.geometry?.dispose();if(o.material){const a=Array.isArray(o.material)?o.material:[o.material];a.forEach(m=>{m.map?.dispose();m.dispose();});}});}
  resetPlayer();resize(canvas.clientWidth||window.innerWidth,canvas.clientHeight||window.innerHeight);setChallenge({});
  return {THREE,scene,camera,renderer,ball,ballShadow,player,goal,defenders,obstacles,particles,resize,update,setDefenders,setChallenge,setTheme,kick,celebrate,resetPlayer,setShotStyle,setAim,setCharge,scoreGoal,saveBall,clearShotEffects,dispose,project,graphicsMode:'webgl'};
}
