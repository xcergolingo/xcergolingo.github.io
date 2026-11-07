import * as THREE from './vendor/three.module.js';

// Code-sculpted animal and camera-space sporting rifle. All materials and
// geometry are local; no models, textures, fonts, or network calls are needed.
const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const UNIT_SPHERE = new THREE.SphereGeometry(1, 16, 10);
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const WHITE = new THREE.Color();
const tmpV = new THREE.Vector3();
const tmpN = new THREE.Vector3();

function clamp(v, a = 0, b = 1) { return Math.max(a, Math.min(b, v)); }
function smooth(v) { v = clamp(v); return v * v * (3 - 2 * v); }

// Bake immobile details into a small number of vertex-colored meshes. Keeping
// each limb separate gives genuine articulation without dozens of draw calls.
class Sculpt {
  constructor() { this.parts = []; }
  add(geometry, color, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], grain = 0) {
    const q = rotation.isQuaternion ? rotation : new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
    this.parts.push({geometry, color: new THREE.Color(color), grain,
      matrix: new THREE.Matrix4().compose(new THREE.Vector3(...position), q, new THREE.Vector3(...scale))});
    return this;
  }
  ellipsoid(color, position, scale, rotation, grain = 0) {
    return this.add(UNIT_SPHERE, color, position, scale, rotation, grain);
  }
  box(color, position, scale, rotation, grain = 0) {
    return this.add(UNIT_BOX, color, position, scale, rotation, grain);
  }
  rod(color, from, to, baseRadius, tipRadius = baseRadius, sides = 9) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const d = b.clone().sub(a);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
    return this.add(new THREE.CylinderGeometry(tipRadius, baseRadius, d.length(), sides, 1), color,
      a.add(b).multiplyScalar(0.5).toArray(), [1, 1, 1], q);
  }
  mesh(material, part = '') {
    let count = 0;
    for (const p of this.parts) count += p.geometry.index ? p.geometry.index.count : p.geometry.attributes.position.count;
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    let offset = 0;
    for (const p of this.parts) {
      const src = p.geometry.attributes.position;
      const nrm = p.geometry.attributes.normal;
      const ix = p.geometry.index;
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(p.matrix);
      const n = ix ? ix.count : src.count;
      for (let j = 0; j < n; j++) {
        const k = ix ? ix.getX(j) : j;
        tmpV.fromBufferAttribute(src, k).applyMatrix4(p.matrix);
        tmpN.fromBufferAttribute(nrm, k).applyMatrix3(normalMatrix).normalize();
        positions.set(tmpV.toArray(), offset);
        normals.set(tmpN.toArray(), offset);
        // Restrained organic variation follows the model rather than lighting.
        const variation = p.grain ? 1 + p.grain * (Math.sin(tmpV.z * 47 + Math.sin(tmpV.y * 91) * 1.8) * .44 + Math.sin(tmpV.x * 39 + tmpV.z * 14) * .2) : 1;
        WHITE.copy(p.color).multiplyScalar(variation);
        colors.set(WHITE.toArray(), offset);
        offset += 3;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.part = part;
    for (const p of this.parts) if (p.geometry !== UNIT_SPHERE && p.geometry !== UNIT_BOX) p.geometry.dispose();
    this.parts.length = 0;
    return mesh;
  }
}

export function createDeer({buck = true, seed = 1} = {}) {
  const group = new THREE.Group();
  group.name = buck ? 'Woodland buck' : 'Woodland doe';
  const fallRig = new THREE.Group();
  fallRig.position.y = 1.15;
  group.add(fallRig);
  const anatomy = new THREE.Group();
  anatomy.position.y = -1.15;
  fallRig.add(anatomy);
  const material = new THREE.MeshStandardMaterial({vertexColors: true, roughness: .91, metalness: 0});
  const hitMeshes = [];
  const addHit = (mesh, parent = anatomy) => { parent.add(mesh); hitMeshes.push(mesh); return mesh; };
  const phase = seed * 2.39996;
  const warm = ((Math.sin(seed * 15.31) + 1) / 2);
  const fur = new THREE.Color('#98623b').lerp(new THREE.Color('#b28251'), warm * .45);
  const dark = new THREE.Color('#775033').lerp(fur, .23);
  const light = '#c7a477';
  const cream = '#e4d3ab';
  const hoof = '#39332a';

  const torso = new Sculpt();
  torso.ellipsoid(fur, [0, 1.30, -.09], [.295, .345, .83], undefined, .07);
  torso.ellipsoid(fur, [0, 1.36, .50], [.31, .405, .34], undefined, .06);
  torso.ellipsoid(fur, [0, 1.34, -.63], [.31, .36, .34], undefined, .06);
  torso.ellipsoid(light, [0, 1.066, -.12], [.248, .16, .60], undefined, .025);
  torso.ellipsoid(dark, [0, 1.59, -.13], [.13, .10, .65], undefined, .05);
  torso.ellipsoid(cream, [0, 1.35, -.909], [.173, .215, .043]);
  // Shoulder and haunch planes give a lean animal silhouette.
  for (const side of [-1, 1]) {
    torso.ellipsoid(fur, [side * .225, 1.25, .48], [.105, .285, .195], [.10, 0, side * .09], .05);
    torso.ellipsoid(fur, [side * .208, 1.26, -.64], [.134, .27, .235], [-.16, 0, side * -.08], .05);
  }
  addHit(torso.mesh(material, 'body'));

  const neckRig = new THREE.Group();
  neckRig.position.set(0, 1.25, .55);
  anatomy.add(neckRig);
  const neck = new Sculpt();
  neck.rod(fur, [0, -.055, -.10], [0, .61, .31], .197, .119, 14);
  neck.ellipsoid(fur, [0, .25, .10], [.175, .40, .165], [.31, 0, 0], .055);
  neck.ellipsoid(cream, [0, .29, .247], [.091, .29, .047], [.40, 0, 0], .03);
  neck.ellipsoid(dark, [0, .32, -.028], [.075, .34, .045], [.40, 0, 0]);
  addHit(neck.mesh(material, 'neck'), neckRig);

  const headRig = new THREE.Group();
  neckRig.add(headRig);
  const head = new Sculpt();
  head.ellipsoid(fur, [0, .699, .493], [.143, .217, .244], [.16, 0, 0], .06);
  head.ellipsoid(fur, [0, .657, .714], [.108, .123, .248], [.04, 0, 0], .05);
  head.ellipsoid(light, [0, .577, .753], [.081, .051, .193]);
  head.ellipsoid('#4c3325', [0, .618, .899], [.089, .036, .096]);
  head.ellipsoid('#25231e', [0, .669, .938], [.091, .073, .060]);
  head.ellipsoid('#767063', [-.026, .706, .964], [.020, .010, .007]);
  for (const side of [-1, 1]) {
    head.ellipsoid(dark, [side * .125, .762, .613], [.028, .060, .068], [0, 0, side * .14]);
    head.ellipsoid('#151611', [side * .144, .767, .619], [.021, .030, .038]);
    head.ellipsoid('#f6e8ce', [side * .159, .779, .631], [.006, .008, .008]);
    head.ellipsoid(fur, [side * .224, .928, .410], [.074, .215, .043], [.12, 0, side * -.92], .045);
    head.ellipsoid('#d0ac87', [side * .230, .932, .445], [.050, .171, .011], [.12, 0, side * -.92]);
    head.ellipsoid('#a87955', [side * .229, .931, .451], [.024, .133, .007], [.12, 0, side * -.92]);
  }

  if (buck) {
    for (const s of [-1, 1]) {
      const nodes = [[s * .106, .869, .395], [s * .193, 1.085, .289], [s * .326, 1.253, .223],
        [s * .430, 1.383, .329], [s * .465, 1.435, .549], [s * .410, 1.466, .764]];
      const radius = [.046, .039, .033, .026, .018, .004];
      for (let i = 0; i < nodes.length - 1; i++) {
        const color = new THREE.Color('#a28a60').lerp(new THREE.Color('#d7c7a2'), i / 6);
        head.rod(color, nodes[i], nodes[i + 1], radius[i], radius[i + 1], 8);
        head.ellipsoid(color, nodes[i], [radius[i] * 1.08, radius[i] * 1.08, radius[i] * 1.08]);
      }
      const tines = [
        {from: nodes[1], mid: [s * .223, 1.265, .425], end: [s * .249, 1.388, .451], r: .027},
        {from: nodes[2], mid: [s * .350, 1.486, .214], end: [s * .351, 1.619, .248], r: .027},
        {from: nodes[3], mid: [s * .489, 1.605, .380], end: [s * .482, 1.722, .413], r: .023},
        {from: nodes[4], mid: [s * .529, 1.590, .601], end: [s * .517, 1.693, .629], r: .018}
      ];
      for (const tine of tines) {
        head.rod('#c2ad83', tine.from, tine.mid, tine.r, tine.r * .49, 7);
        head.rod('#dfcdaa', tine.mid, tine.end, tine.r * .49, .002, 7);
      }
    }
  }
  addHit(head.mesh(material, 'head'), headRig);

  const legs = [];
  for (const front of [true, false]) {
    for (const side of [-1, 1]) {
      const upper = new THREE.Group();
      upper.position.set(side * .223, front ? 1.28 : 1.26, front ? .535 : -.636);
      anatomy.add(upper);
      const thigh = new Sculpt();
      const upperLength = front ? .555 : .485;
      const kneeZ = front ? -.022 : -.114;
      thigh.ellipsoid(fur, [0, -.172, front ? -.015 : -.045], [front ? .073 : .094, .233, front ? .085 : .142], [front ? -.035 : .24, 0, 0], .04);
      thigh.rod(fur, [0, -.155, -.018], [0, -upperLength, kneeZ], front ? .052 : .064, .031, 9);
      thigh.ellipsoid(dark, [0, -upperLength, kneeZ], [.040, .054, .047]);
      addHit(thigh.mesh(material, 'leg'), upper);
      const lower = new THREE.Group();
      lower.position.set(0, -upperLength, kneeZ);
      upper.add(lower);
      const shin = new Sculpt();
      const lowLength = front ? .655 : .71;
      const toeZ = front ? .008 : .117;
      shin.rod(light, [0, -.01, 0], [0, -lowLength + .09, toeZ], .028, .020, 8);
      shin.rod(fur, [side * .012, -.022, -.006], [side * .009, -lowLength + .09, toeZ -.005], .020, .014, 7);
      shin.ellipsoid(dark, [0, -lowLength + .085, toeZ], [.030, .049, .037]);
      shin.ellipsoid(hoof, [0, -lowLength + .025, toeZ + .029], [.044, .052, .077]);
      shin.box('#282620', [0, -lowLength + .014, toeZ + .091], [.004, .054, .005]);
      addHit(shin.mesh(material, 'leg'), lower);
      legs.push({upper, lower, front, side});
    }
  }

  const tailRig = new THREE.Group();
  tailRig.position.set(0, 1.43, -.915);
  anatomy.add(tailRig);
  const tail = new Sculpt();
  tail.ellipsoid(dark, [0, -.114, -.054], [.089, .185, .063], [.34, 0, 0], .03);
  tail.ellipsoid(cream, [0, -.123, -.094], [.064, .15, .025], [.34, 0, 0]);
  tailRig.add(tail.mesh(material));

  let falling = false;
  function animate(time = 0, speed = 0, alert = 0, graze = 0) {
    if (falling) return;
    speed = clamp(speed); alert = clamp(alert); graze = clamp(graze);
    const stride = time * (5.4 + speed * 4.2) + phase;
    const strideAmp = speed * (.36 + alert * .27);
    for (const leg of legs) {
      const gaitPhase = stride + (leg.side === 1 ? Math.PI : 0) + (leg.front ? 0 : Math.PI);
      const swing = Math.sin(gaitPhase);
      leg.upper.rotation.x = swing * strideAmp;
      leg.lower.rotation.x = Math.max(0, -swing) * speed * .51 * (leg.front ? 1 : -.67);
    }
    anatomy.position.y = -1.15 + Math.abs(Math.sin(stride)) * .035 * speed;
    neckRig.rotation.x = graze * (1.56 + Math.sin(time * 1.8 + phase) * .055) - alert * .10 + Math.sin(time * 1.6 + phase) * .018;
    neckRig.rotation.y = graze * Math.sin(time * .55 + phase) * .10 + (1 - graze) * Math.sin(time * .31 + phase) * .09;
    neckRig.position.y = 1.25 - graze * .085;
    headRig.rotation.z = Math.sin(time * .8 + phase) * .014;
    tailRig.rotation.x = alert * 1.24 + Math.sin(time * 1.7 + phase) * .045;
    tailRig.rotation.z = Math.sin(time * 2.1 + phase) * .065;
  }
  function fall(progress = 0) {
    const p = clamp(progress);
    falling = p > 0;
    const collapse = smooth(Math.min(1, p / .64));
    fallRig.rotation.z = collapse * 1.48;
    fallRig.position.y = 1.15 - collapse * .82;
    fallRig.rotation.x = collapse * -.11;
    for (const leg of legs) {
      leg.upper.rotation.x = collapse * (leg.front ? -.38 : .61);
      leg.lower.rotation.x = collapse * .5;
    }
    neckRig.rotation.x = collapse * .48;
    const fade = smooth((p - .80) / .2);
    fallRig.scale.setScalar(1 - fade * .16);
    group.visible = p < 1;
    if (!falling) { fallRig.scale.setScalar(1); group.visible = true; }
  }
  animate(0, 0, 0, 0);
  return {group, hitMeshes, animate, fall};
}

export function createRifle() {
  const group = new THREE.Group();
  group.name = 'Pinefall sporting rifle';
  const woodMaterial = new THREE.MeshStandardMaterial({vertexColors: true, roughness: .53, metalness: .02});
  const metalMaterial = new THREE.MeshStandardMaterial({vertexColors: true, roughness: .31, metalness: .78});
  const fabricMaterial = new THREE.MeshStandardMaterial({vertexColors: true, roughness: .94, metalness: 0});
  const wood = new Sculpt();

  // A continuous bevelled walnut profile: fore-end, comb, grip and shoulder.
  const outline = [[.78,.015],[.38,.078],[.19,.055],[-.03,-.023],[-.65,-.040],[-.73,-.077],[-.72,-.139],[-.18,-.15],
    [.052,-.128],[.16,-.22],[.25,-.245],[.305,-.198],[.29,-.105],[.40,-.103],[.76,-.22]];
  const shape = new THREE.Shape();
  outline.forEach(([z,y], i) => i ? shape.lineTo(-z, y) : shape.moveTo(-z, y));
  shape.closePath();
  const stockGeometry = new THREE.ExtrudeGeometry(shape, {depth:.079, bevelEnabled:true, bevelSegments:2, steps:1, bevelSize:.013, bevelThickness:.012, curveSegments:2});
  stockGeometry.rotateY(Math.PI / 2);
  stockGeometry.translate(-.0395, 0, 0);
  wood.add(stockGeometry, '#6b3c22', [0,0,0], [1,1,1], [0,0,0], .32);
  wood.ellipsoid('#875332', [.003,-.038,.47], [.047,.045,.235], [0,0,0], .22);
  // Fine checkering on the grip and fore-end, baked into the walnut mesh.
  for (const side of [-1,1]) {
    for (let i=0;i<10;i++) {
      wood.rod('#4b2d1c', [side*.053,-.072,-.17-i*.027],[side*.053,-.12,-.19-i*.027],.0015,.0015,4);
      wood.rod('#4b2d1c', [side*.053,-.073,-.19-i*.027],[side*.053,-.12,-.17-i*.027],.0015,.0015,4);
    }
    for(let i=0;i<6;i++) wood.rod('#4a2d1c',[side*.054,-.135-i*.011,.16],[side*.054,-.145-i*.011,.255],.0015,.0015,4);
  }
  group.add(wood.mesh(woodMaterial));

  const metal = new Sculpt();
  metal.rod('#323c3b', [0,.015,.32], [0,.015,-.36], .045,.043,16);
  metal.rod('#2a3433', [0,.016,-.24], [0,.016,-1.205], .030,.019,16);
  metal.rod('#5b6863', [0,.016,-1.195], [0,.016,-1.224], .022,.022,16);
  metal.rod('#111a19', [0,.016,-1.225], [0,.016,-1.229], .014,.014,12);
  metal.box('#25312e',[0,.052,-.015],[.082,.022,.43]);
  metal.box('#727c6e',[.043,.023,.125],[.006,.022,.115]);
  metal.box('#1c2421',[0,-.019,.765],[.109,.247,.034],[.06,0,0]);
  for(let i=0;i<5;i++) metal.box('#303c35',[0,-.015-i*.036,.787],[.100,.006,.004]);
  metal.add(new THREE.TorusGeometry(.059,.008,7,22), '#26302b',[0,-.126,.125],[1,.83,1],[0,Math.PI/2,0]);
  metal.rod('#59625c',[0,-.064,.147],[0,-.127,.116],.007,.005,6);
  metal.rod('#242d29',[0,-.127,.116],[0,-.145,.137],.005,.004,6);
  // Scope mounts and matte steel optic.
  for(const z of [-.265,.115]) {
    metal.box('#26332e',[0,.088,z],[.064,.075,.041]);
    metal.rod('#37423a',[0,.150,z-.018],[0,.150,z+.018],.052,.052,16);
  }
  metal.rod('#27322e',[0,.15,.247],[0,.15,-.435],.041,.042,18);
  metal.rod('#334039',[0,.15,-.35],[0,.15,-.51],.043,.070,18);
  metal.rod('#1e2925',[0,.15,-.51],[0,.15,-.57],.072,.072,18);
  metal.rod('#334039',[0,.15,.192],[0,.15,.295],.058,.058,18);
  metal.rod('#1d2722',[0,.15,.28],[0,.15,.316],.061,.061,18);
  metal.rod('#28342d',[0,.191,-.07],[0,.228,-.07],.028,.031,14);
  metal.rod('#344137',[.032,.15,-.07],[.070,.15,-.07],.028,.031,14);
  for(let i=0;i<12;i++) {
    const a=i/12*TAU;
    metal.rod('#465045',[Math.cos(a)*.029,.203,-.07+Math.sin(a)*.029],[Math.cos(a)*.029,.224,-.07+Math.sin(a)*.029],.0017,.0017,4);
  }
  group.add(metal.mesh(metalMaterial));

  const lensMaterial = new THREE.MeshStandardMaterial({color:'#294f48',roughness:.13,metalness:.55,emissive:'#0f2327',emissiveIntensity:.3});
  const lensGeometry = new THREE.CircleGeometry(.050,24);
  const rearLens = new THREE.Mesh(lensGeometry, lensMaterial);
  rearLens.position.set(0,.15,.318);
  group.add(rearLens);
  const frontLens = new THREE.Mesh(new THREE.CircleGeometry(.062,24),lensMaterial);
  frontLens.position.set(0,.15,-.571);
  frontLens.rotation.y=Math.PI;
  group.add(frontLens);

  const boltRig = new THREE.Group();
  boltRig.position.set(0,.016,.202);
  const bolt = new Sculpt();
  bolt.rod('#69746b',[.028,0,0],[.086,-.009,.012],.011,.009,8);
  bolt.rod('#465248',[.086,-.009,.012],[.092,-.058,.034],.009,.009,8);
  bolt.ellipsoid('#27362d',[.092,-.061,.034],[.019,.021,.021]);
  boltRig.add(bolt.mesh(metalMaterial));
  group.add(boltRig);

  const hands = new Sculpt();
  const glove = '#525a3c', cuff = '#354330', sleeve = '#44533c';
  // Support hand and jacket forearm, and a right hand curled around the grip.
  hands.rod(sleeve,[-.28,-.43,.13],[-.095,-.17,-.37],.091,.069,11);
  hands.rod(cuff,[-.111,-.205,-.321],[-.083,-.148,-.405],.073,.069,10);
  hands.ellipsoid(glove,[-.063,-.133,-.43],[.073,.070,.110],[.22,.10,0],.07);
  for(let i=0;i<4;i++) hands.ellipsoid('#616548',[-.004,-.113,-.37-i*.038],[.075,.027,.025],[0,0,-.26],.04);
  hands.ellipsoid('#73775a',[-.091,-.074,-.405],[.030,.037,.068],[.23,0,.3]);
  hands.rod(sleeve,[.235,-.41,.62],[.067,-.183,.268],.09,.061,11);
  hands.rod(cuff,[.092,-.228,.342],[.053,-.167,.244],.065,.062,10);
  hands.ellipsoid(glove,[.054,-.155,.219],[.061,.079,.087],[.3,0,-.19],.06);
  for(let i=0;i<3;i++) hands.ellipsoid('#64694b',[.006,-.133-i*.025,.215-i*.008],[.061,.020,.036],[0,0,-.07],.04);
  hands.ellipsoid(glove,[.035,-.085,.118],[.022,.021,.065],[.3,.08,0]);
  hands.ellipsoid('#73775a',[.068,-.081,.225],[.030,.052,.035],[.12,0,-.24]);
  group.add(hands.mesh(fabricMaterial));

  const muzzle = new THREE.Object3D();
  muzzle.name = 'Rifle muzzle';
  muzzle.position.set(0,.016,-1.238);
  group.add(muzzle);
  group.traverse(o => { if(o.isMesh) {o.castShadow=false;o.receiveShadow=false;} });

  function animate({time=0,recoil=0,reload=0,moving=0,scoped=false}={}) {
    recoil=clamp(recoil); reload=clamp(reload); moving=clamp(moving);
    const dip=Math.sin(reload*Math.PI);
    const bob=Math.sin(time*7.4)*.006*moving;
    group.position.set(.31+Math.sin(time*3.7)*.005*moving+dip*.065,-.28+bob-dip*.15,-.70+recoil*.12+dip*.05);
    group.rotation.set(.015+recoil*.09+dip*.17,.035-dip*.15,-.02-dip*.34);
    boltRig.position.z=.202+Math.sin(clamp(reload*1.65-.15)*Math.PI)*.105+Math.max(0,recoil-.2)*.09;
    boltRig.rotation.z=Math.sin(reload*Math.PI)*.95;
  }
  animate();
  return {group,muzzle,animate};
}
