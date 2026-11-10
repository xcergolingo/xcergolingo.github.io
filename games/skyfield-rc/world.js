import * as THREE from './vendor/three.module.js';
import { createSilverJet } from './silver-jet.js';
import { ATELIER_JET_IDS, createAtelierJet } from './atelier-jets.js';

// All scenery and aircraft are original, procedural geometry. World units are metres.
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function random(seed = 19) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; }; }
function noise(x, z) { return Math.sin(x * .013 + Math.sin(z * .006) * 2) * .5 + Math.sin(z * .019 - x * .007) * .3 + Math.sin(x * .043 + z * .035) * .12; }
function standard(color, roughness = .85, metalness = 0) { return new THREE.MeshStandardMaterial({ color, roughness, metalness }); }
function mesh(geometry, material, parent, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; if (parent) parent.add(m); return m;
}
function box(parent, material, w, h, d, x, y, z) { return mesh(new THREE.BoxGeometry(w, h, d), material, parent, x, y, z); }
function rod(parent, material, a, b, radius = .04, segments = 6) {
  const p = new THREE.Vector3(...a), q = new THREE.Vector3(...b), delta = q.clone().sub(p);
  const m = mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), segments), material, parent);
  m.position.copy(p.add(q).multiplyScalar(.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return m;
}
function textTexture(text, foreground = '#eff2e7', background = '#263c31', width = 1024, height = 256, font = '700') {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d'); if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, width, height); }
  ctx.fillStyle = foreground; ctx.font = `${font} ${height * .48}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, width * .5, height * .53, width * .9);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
function sign(parent, text, w, h, x, y, z, colors = ['#f6f2de', '#284538']) {
  const mat = new THREE.MeshStandardMaterial({ map: textTexture(text, colors[0], colors[1]), roughness: .9 });
  return mesh(new THREE.PlaneGeometry(w, h), mat, parent, x, y, z, false);
}
function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const byMaterial = new Map(), multiMaterial = [];
  group.traverse(m => {
    if (!m.isMesh || m.isInstancedMesh) return;
    if (Array.isArray(m.material)) {
      const g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld);
      const copy = new THREE.Mesh(g, m.material); copy.castShadow = m.castShadow; copy.receiveShadow = m.receiveShadow;
      multiMaterial.push(copy); return;
    }
    const key = m.material.uuid;
    if (!byMaterial.has(key)) byMaterial.set(key, { material: m.material, geometries: [] });
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone());
    g.applyMatrix4(m.matrixWorld); byMaterial.get(key).geometries.push(g);
  });
  group.clear();
  group.add(...multiMaterial);
  for (const { material, geometries } of byMaterial.values()) {
    const merged = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'uv']) {
      if (!geometries.every(g => g.getAttribute(name))) continue;
      const total = geometries.reduce((s, g) => s + g.getAttribute(name).array.length, 0), data = new Float32Array(total);
      let offset = 0; for (const g of geometries) { const a = g.getAttribute(name).array; data.set(a, offset); offset += a.length; }
      merged.setAttribute(name, new THREE.BufferAttribute(data, name === 'uv' ? 2 : 3));
    }
    merged.computeBoundingSphere(); const m = mesh(merged, material, group); m.receiveShadow = true;
    for (const g of geometries) g.dispose();
  }
}
function airfoilWing({ span = 3.2, rootChord = .65, tipChord = .38, sweep = .12, dihedral = .04, y = .25, z = -.2, thickness = .12, primary, accent }) {
  const group = new THREE.Group(), sections = [0, .52, .64, .74, .83, 1], n = 16;
  for (const side of [-1, 1]) {
    const positions = [], indices = [];
    for (const f of sections) {
      const chord = mix(rootChord, tipChord, f), lead = z - rootChord * .5 + sweep * f;
      for (let j = 0; j <= n * 2; j++) {
        const upper = j <= n, t = upper ? j / n : (2 * n - j) / n;
        const yt = 5 * thickness * chord * (.2969 * Math.sqrt(t) - .126 * t - .3516 * t * t + .2843 * t ** 3 - .1036 * t ** 4);
        positions.push(side * f * span * .5, y + f * span * .5 * dihedral + .018 * chord * Math.sin(t * Math.PI) + (upper ? yt : -yt), lead + t * chord);
      }
    }
    const ring = n * 2 + 1, geometry = new THREE.BufferGeometry();
    for (let s = 0; s < sections.length - 1; s++) {
      const start = indices.length;
      for (let j = 0; j < ring - 1; j++) {
        const a = s * ring + j, b = a + ring;
        if (side > 0) indices.push(a, a + 1, b, a + 1, b + 1, b); else indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
      geometry.addGroup(start, indices.length - start, s === 2 || s === 4 ? 1 : 0);
    }
    const tipStart = (sections.length - 1) * ring, capStart = indices.length;
    for (let j = 1; j < ring - 2; j++) {
      if (side > 0) indices.push(tipStart, tipStart + j, tipStart + j + 1); else indices.push(tipStart, tipStart + j + 1, tipStart + j);
    }
    geometry.addGroup(capStart, indices.length - capStart, 1);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    mesh(geometry, [primary, accent], group);
  }
  return group;
}
function loft(sections, material, parent, radial = 20) {
  const positions = [], indices = [];
  for (const [z, rx, ry, cy = 0] of sections) for (let j = 0; j <= radial; j++) {
    const t = j / radial * TAU; positions.push(Math.cos(t) * rx, Math.sin(t) * ry + cy, z);
  }
  for (let s = 0; s < sections.length - 1; s++) for (let j = 0; j < radial; j++) {
    const a = s * (radial + 1) + j, b = a + radial + 1; indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals(); return mesh(g, material, parent);
}
function tailFin(parent, material, points, width = .035) {
  const positions = [], indices = [], n = points.length;
  for (const x of [-width / 2, width / 2]) for (const [z, y] of points) positions.push(x, y, z);
  for (let i = 1; i < n - 1; i++) { indices.push(0, i + 1, i); indices.push(n, n + i, n + i + 1); }
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; indices.push(i, j, n + i, j, n + j, n + i); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals(); return mesh(g, material, parent);
}

export function createAircraft(type = 'trainer') {
  if (type === 'jet') return createSilverJet();
  if (ATELIER_JET_IDS.includes(type)) return createAtelierJet(type);
  const group = new THREE.Group(); group.name = `RC ${type}`;
  const glider = type === 'glider', sport = type === 'sport';
  const cream = standard(sport ? '#253d4a' : '#f3f0dc', .32, .15), accent = standard(sport ? '#f29b42' : '#c94e39', .3, .12);
  const trim = standard(sport ? '#f1e6ce' : '#23434a', .4, .12), metal = standard('#a8b3aa', .3, .75), rubber = standard('#24282a', .9);
  const glass = standard('#355461', .13, .55); glass.envMapIntensity = 1.3;
  const len = glider ? 1.23 : 1;
  const bodySections = glider ? [[-1.48,.025,.025,0],[-1.3,.095,.105,0],[-.7,.12,.13,0],[-.1,.095,.11,0],[.7,.04,.05,.015],[1.7,.018,.028,.045]] : [[-1.24,.10,.10,0],[-1.12,.18,.19,0],[-.58,.205,.205,0],[.14,.17,.18,0],[.76,.077,.085,.015],[1.33,.023,.04,.04]];
  loft(bodySections, cream, group);
  if (!glider) loft([[-1.27,.08,.085,0],[-1.18,.178,.185,0],[-.91,.192,.2,0]], accent, group);
  loft(glider ? [[-1.19,.02,.02,.055],[-1.03,.091,.112,.085],[-.65,.1,.14,.08],[-.3,.06,.04,.085]] : [[-.72,.025,.025,.16],[-.5,.16,.18,.14],[-.13,.153,.2,.12],[.12,.085,.04,.15]], glass, group);
  const span = glider ? 6 : sport ? 3.05 : 3.45;
  const wingY = glider ? .085 : sport ? -.035 : .28;
  group.add(airfoilWing({ span, rootChord: glider ? .47 : .72, tipChord: glider ? .22 : .42, sweep: glider ? .24 : .11, dihedral: glider ? .045 : sport ? .01 : .055, y: wingY, z: glider ? -.17 : -.25, primary: cream, accent }));
  const tailZ = glider ? 1.35 : .99, tailY = glider ? .43 : .075;
  group.add(airfoilWing({ span: glider ? 1.12 : 1.15, rootChord: .34, tipChord: .21, sweep: .10, dihedral: 0, y: tailY, z: tailZ, thickness: .085, primary: cream, accent }));
  tailFin(group, accent, glider ? [[1.10,.035],[1.37,.58],[1.57,.61],[1.71,.05]] : [[.78,.035],[1.02,.65],[1.23,.66],[1.40,.05]], .035);
  tailFin(group, cream, glider ? [[1.40,.2],[1.49,.58],[1.56,.6],[1.67,.20]] : [[1.11,.13],[1.19,.60],[1.24,.60],[1.35,.13]], .038);
  // Painted fuselage coachlines and a small registration decal.
  for (const side of [-1, 1]) {
    const stripe = box(group, accent, .012, .045, .8, side * .154, -.025, .16); stripe.rotation.y = side * -.07;
    const labelMat = new THREE.MeshStandardMaterial({ map: textTexture(glider ? 'SF · 03' : sport ? 'SF · 02' : 'SF · 01', sport ? '#f4e8d4' : '#29413e', null, 512, 128), transparent: true, roughness: .7, side: THREE.DoubleSide });
    const label = mesh(new THREE.PlaneGeometry(.43, .105), labelMat, group, side * .14, .035, .32, false); label.rotation.y = side * Math.PI * .5;
  }
  if (!glider && !sport) {
    for (const s of [-1,1]) { rod(group, metal, [s*.15,-.03,-.27], [s*1.14,.33,-.24], .017); rod(group, metal, [s*.15,-.02,.05], [s*1.10,.34,-.16], .013); }
  }
  if (!glider) {
    for (const side of [-1,1]) {
      rod(group, metal, [side*.12,-.12,-.3], [side*.45,-.47,-.4], .025);
      const wheel = mesh(new THREE.CylinderGeometry(.145,.145,.09,20), rubber, group, side*.46,-.46,-.4); wheel.rotation.z = Math.PI / 2;
      const hub = mesh(new THREE.CylinderGeometry(.061,.061,.096,16), metal, group, side*.46,-.46,-.4); hub.rotation.z = Math.PI/2;
    }
    rod(group, metal, [0,-.02,1.07], [0,-.19,1.15], .016);
    const wheel = mesh(new THREE.CylinderGeometry(.067,.067,.046,12),rubber,group,0,-.21,1.15); wheel.rotation.z=Math.PI/2;
  } else {
    const wheel = mesh(new THREE.CylinderGeometry(.075,.075,.045,14), rubber, group, 0,-.13,-.10); wheel.rotation.z = Math.PI/2;
  }
  const propeller = new THREE.Group(); propeller.position.z = glider ? -1.52 : -1.31; group.add(propeller);
  const bladeMat = standard('#2f3435', .42, .25), radius = glider ? .18 : .56;
  for (let i=0;i<2;i++) {
    const shape=new THREE.Shape(); shape.moveTo(-.025,.07);shape.quadraticCurveTo(-.085,radius*.65,-.045,radius);shape.quadraticCurveTo(.015,radius*1.04,.04,radius*.94);shape.lineTo(.055,.13);shape.closePath();
    const blade=mesh(new THREE.ShapeGeometry(shape),bladeMat,propeller);blade.material.side=THREE.DoubleSide;blade.rotation.z=i*Math.PI;
    const tip=box(propeller,accent,.063,.08,.013,0,radius-.055,0);tip.rotation.z=i*Math.PI;if(i)tip.position.y=-(radius-.055);
  }
  const spinner=mesh(new THREE.ConeGeometry(glider?.06:.12,glider?.16:.25,20),accent,group,0,0,glider?-1.56:-1.37);spinner.rotation.x=-Math.PI/2;
  const blur = mesh(new THREE.CircleGeometry(radius,40),new THREE.MeshBasicMaterial({color:'#d8dcce',transparent:true,opacity:.07,depthWrite:false,side:THREE.DoubleSide}),propeller,0,0,.008,false);
  // Small hinged control surfaces can be animated by the caller.
  const controlSurfaces = {};
  for (const [name, side] of [['leftAileron',-1],['rightAileron',1]]) {
    const rootChord=glider?.47:.72, tipChord=glider?.22:.42, sweep=glider?.24:.11;
    const trailing=(glider?-.17:-.25)-rootChord*.5+sweep*.7+mix(rootChord,tipChord,.7);
    const pivot=new THREE.Group();pivot.position.set(side*span*.35,wingY+span*.35*(glider?.045:sport?.01:.055),trailing-.02);pivot.rotation.y=side*Math.atan((rootChord-tipChord-sweep)/(span*.5));group.add(pivot);
    box(pivot,accent,span*.20,.016,.09,0,0,.03);controlSurfaces[name]=pivot;
  }
  const elevator=new THREE.Group();elevator.position.set(0,tailY,tailZ+.14);group.add(elevator);box(elevator,accent,.86,.014,.09,0,0,.025);controlSurfaces.elevator=elevator;
  group.userData={propeller,propellerBlur:blur,controlSurfaces,span,type,length:2.7*len,groundClearance:glider?.21:.61};
  return group;
}

export function createWorld(scene) {
  const rng=random(5714), root=new THREE.Group();root.name='Skyfield scenery';scene.add(root);
  const staticDetails=new THREE.Group();root.add(staticDetails);
  const colliders=[], treeColliders=[];
  const palette={white:standard('#e9e7d9'),wood:standard('#897454'),darkWood:standard('#485647'),metal:standard('#626d62',.65,.35),roof:standard('#465c51',.8,.15),wall:standard('#c9c9ad'),glass:standard('#547379',.25,.35),black:standard('#263538'),yellow:standard('#e6b65d'),red:standard('#c8593d')};
  const peaks=[[-920,-830,125,310],[600,-1050,175,350],[1150,-580,185,340],[-1250,400,155,390],[970,830,140,320],[30,-1510,160,380],[-750,1310,125,330]];
  function heightAt(x,z) {
    const edge=smooth(1,2.5,Math.max(Math.abs(x)/230,Math.abs(z)/280));
    let h=edge*(7+noise(x,z)*7+Math.sin(x*.004+z*.002)*5);
    for(const [px,pz,ph,spread] of peaks) h+=ph*Math.exp(-((x-px)**2+(z-pz)**2)/(spread*spread))*edge;
    const lake=Math.hypot((x-550)/145,(z+175)/225);
    if(lake<1.22) h=mix(-5+noise(x*2,z*2)*.4,h,smooth(.81,1.22,lake));
    return h;
  }
  const sky=new THREE.Mesh(new THREE.SphereGeometry(5000,32,16),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,
    uniforms:{top:{value:new THREE.Color('#79acc9')},horizon:{value:new THREE.Color('#e3e8d2')},sunColor:{value:new THREE.Color('#fff1cb')},sunDirection:{value:new THREE.Vector3(-.56,.55,-.62).normalize()}},
    vertexShader:'varying vec3 vWorld;void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform vec3 top;uniform vec3 horizon;uniform vec3 sunColor;uniform vec3 sunDirection;varying vec3 vWorld;void main(){vec3 d=normalize(vWorld);float a=pow(max(0.,d.y),.52);vec3 c=mix(horizon,top,a);float s=max(0.,dot(d,sunDirection));c+=sunColor*(pow(s,20.)*.10+pow(s,300.)*.22+pow(s,3200.)*1.4);gl_FragColor=vec4(c,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')
  }));root.add(sky);sky.renderOrder=-10;sky.frustumCulled=false;
  scene.fog=new THREE.FogExp2('#c8d8c8',.00052);
  const ambient=new THREE.HemisphereLight('#e7f3fb','#64754a',2.1);scene.add(ambient);
  const sun=new THREE.DirectionalLight('#fff2d1',3.2);sun.position.set(-180,310,-160);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-180,right:180,top:180,bottom:-180,near:1,far:850});sun.shadow.bias=-.0004;sun.shadow.normalBias=.12;sun.target.position.set(0,0,10);scene.add(sun,sun.target);
  // Repeating fine grass texture, combined with much larger terrain colour variation.
  const grassCanvas=document.createElement('canvas');grassCanvas.width=grassCanvas.height=512;const gctx=grassCanvas.getContext('2d');
  gctx.fillStyle='#a6ad88';gctx.fillRect(0,0,512,512);
  for(let i=0;i<24000;i++){const grey=Math.floor(115+rng()*85);gctx.fillStyle=`rgba(${grey},${grey+8},${Math.max(0,grey-23)},${.09+rng()*.16})`;const x=rng()*512,y=rng()*512;gctx.fillRect(x,y,.5+rng()*1.8,1+rng()*5);}
  const grassTexture=new THREE.CanvasTexture(grassCanvas);grassTexture.colorSpace=THREE.SRGBColorSpace;grassTexture.wrapS=grassTexture.wrapT=THREE.RepeatWrapping;grassTexture.repeat.set(125,125);grassTexture.anisotropy=4;
  const terrain=new THREE.PlaneGeometry(3400,3400,190,190);terrain.rotateX(-Math.PI/2);
  const pos=terrain.attributes.position,colors=[];const green=new THREE.Color('#91a766'),dry=new THREE.Color('#b3b582'),hill=new THREE.Color('#899371'),rock=new THREE.Color('#a2a18c');
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),h=heightAt(x,z);pos.setY(i,h);const n=(noise(x*.65,z*.65)+1)*.5;const c=green.clone().lerp(dry,clamp(n*.55,0,1)).lerp(hill,smooth(20,110,h)).lerp(rock,smooth(100,190,h)*.7);colors.push(c.r,c.g,c.b);}
  terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();const ground=mesh(terrain,new THREE.MeshStandardMaterial({map:grassTexture,vertexColors:true,roughness:1}),root,0,0,0,false);ground.receiveShadow=true;
  const asphaltCanvas=document.createElement('canvas');asphaltCanvas.width=asphaltCanvas.height=256;const actx=asphaltCanvas.getContext('2d');actx.fillStyle='#555c55';actx.fillRect(0,0,256,256);
  for(let i=0;i<12000;i++){actx.fillStyle=rng()>.5?'#63685e':'#4f554e';actx.fillRect(rng()*256,rng()*256,1,1);}
  const asphaltTex=new THREE.CanvasTexture(asphaltCanvas);asphaltTex.colorSpace=THREE.SRGBColorSpace;asphaltTex.wrapS=asphaltTex.wrapT=THREE.RepeatWrapping;asphaltTex.repeat.set(3,40);asphaltTex.anisotropy=4;
  const asphalt=new THREE.MeshStandardMaterial({map:asphaltTex,color:'#d9dace',roughness:1}),line=standard('#e4e6d4');
  function flat(parent,material,w,d,x,z,y=.03){const p=mesh(new THREE.PlaneGeometry(w,d),material,parent,x,y,z,false);p.rotation.x=-Math.PI/2;return p;}
  flat(staticDetails,standard('#b6ad8c'),22,364,0,0,.015);flat(staticDetails,asphalt,20,360,0,0,.024);
  for(const x of [-9.3,9.3])flat(staticDetails,line,.19,353,x,0,.034);
  for(let z=-136;z<=136;z+=22)flat(staticDetails,line,.36,9,0,z,.037);
  for(const end of [-1,1]){
    for(const x of [-7.1,-4.7,-2.3,2.3,4.7,7.1])flat(staticDetails,line,1.2,12,x,end*164,.036);
    const numbers=new THREE.MeshStandardMaterial({map:textTexture(end<0?'18':'36','#f0eee0',null,256,256),transparent:true,roughness:1});const n=flat(staticDetails,numbers,7,9,0,end*145,.04);if(end>0)n.rotation.z=Math.PI;
  }
  flat(staticDetails,asphalt,64,9,-42,73,.025);flat(staticDetails,standard('#9b9d8d'),47,59,-62,61,.029);
  for(let x=-69;x<-10;x+=8)flat(staticDetails,palette.yellow,3,.15,x,73,.043);
  for(let x=-81;x<-41;x+=10){flat(staticDetails,line,.13,12,x,80,.045);flat(staticDetails,line,5,.13,x,85,.046);}
  const roofGeometry=(w,d,h,rise)=>{
    const p=[-w/2,h,-d/2,0,h+rise,-d/2,-w/2,h,d/2,0,h+rise,-d/2,0,h+rise,d/2,-w/2,h,d/2,0,h+rise,-d/2,w/2,h,-d/2,w/2,h,d/2,0,h+rise,-d/2,w/2,h,d/2,0,h+rise,d/2];
    for(let i=0;i<p.length;i+=9)for(let k=0;k<3;k++){const a=p[i+3+k];p[i+3+k]=p[i+6+k];p[i+6+k]=a;}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.computeVertexNormals();return g;
  };
  function gableWall(parent,material,w,h,rise,z){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-w/2,h,z,w/2,h,z,0,h+rise,z],3));g.computeVertexNormals();const m=mesh(g,material,parent);m.material.side=THREE.DoubleSide;return m;}
  // Open-front corrugated club hangar.
  const hangar=new THREE.Group();hangar.position.set(-74,0,14);staticDetails.add(hangar);
  box(hangar,palette.wall,.35,8,27,-17,4,0);box(hangar,palette.wall,.35,8,27,17,4,0);box(hangar,palette.wall,34,8,.35,0,4,-13.5);box(hangar,palette.darkWood,34,1.1,.4,0,7.5,13.5);
  mesh(roofGeometry(36,30,8,4.2),palette.roof,hangar);gableWall(hangar,palette.wall,34,8,4,13.51);gableWall(hangar,palette.wall,34,8,4,-13.51);
  box(hangar,standard('#8d9788'),34,.16,27,0,.08,0);
  for(const s of [-1,1]){box(hangar,palette.wall,5.7,7,.18,s*14.2,3.5,13.8);box(hangar,palette.metal,.23,8,.35,s*16.5,4,13.9);for(let j=0;j<9;j++)box(hangar,palette.metal,.035,6.8,.04,s*14.2-2.6+j*.65,3.5,13.91);}
  for(let z=-13;z<=13;z+=1.4){box(hangar,palette.metal,.04,7.9,.055,-17.21,4,z);box(hangar,palette.metal,.04,7.9,.055,17.21,4,z);}
  for(let x=-16;x<=16;x+=2){const y=8+(1-Math.abs(x)/18)*4.2;const seam=box(hangar,palette.darkWood,.035,.045,30,x,y+.025,0);seam.rotation.z=x<0?Math.atan(4.2/18):-Math.atan(4.2/18);}
  box(hangar,palette.metal,.16,.16,30,0,12.21,0);
  sign(hangar,'SKYFIELD',13,2,0,9.4,13.6);sign(hangar,'R / C  F L Y I N G  C L U B',10,.7,0,7.55,13.74,['#34483a','#dbddc7']);
  for(const x of [-13,13]){box(hangar,palette.darkWood,.5,.7,.3,x,5.7,13.95);box(hangar,palette.yellow,.34,.34,.31,x,5.7,14.04);}
  // Work benches and equipment visible through the open hangar.
  for(const x of [-11,11]){box(hangar,palette.wood,3.8,.15,1.5,x,1.25,-5);for(const sx of [-1,1])for(const sz of [-1,1])box(hangar,palette.darkWood,.13,1.2,.13,x+sx*1.6,.6,-5+sz*.55);}
  for(let i=0;i<4;i++)box(hangar,palette.wall,1.4,.8,1.2,-13+i*1.5,.4,-10);
  colliders.push({minX:-91.5,maxX:-56.5,minZ:.3,maxZ:27.8,minY:0,maxY:12.4});
  // Clubhouse with veranda, sash windows, roof battens and a shaded picnic terrace.
  const club=new THREE.Group();club.position.set(-77,0,61);staticDetails.add(club);
  box(club,palette.wall,20,4.9,10,0,2.45,0);mesh(roofGeometry(21.8,12,5,2.3),palette.roof,club);gableWall(club,palette.wall,20,4.9,2.3,5.01);
  for(const x of [-6,5.7]){box(club,palette.darkWood,3.3,2.1,.13,x,2.85,5.07);box(club,palette.glass,2.95,1.75,.15,x,2.85,5.15);box(club,palette.white,.08,1.8,.16,x,2.85,5.25);box(club,palette.white,3.05,.08,.16,x,2.85,5.25);box(club,palette.white,3.4,.15,.4,x,1.8,5.2);}
  box(club,palette.darkWood,1.85,3.35,.2,-.1,1.68,5.13);box(club,palette.glass,1.4,1.7,.22,-.1,2.25,5.24);box(club,palette.yellow,.08,.08,.25,.5,1.58,5.35);
  box(club,palette.wood,22,.25,4.8,0,.19,7.6);const awning=box(club,palette.roof,22,.15,4.7,0,3.95,7.6);awning.rotation.x=.05;
  for(const x of [-10,0,10]){box(club,palette.darkWood,.16,3.9,.16,x,1.95,9.5);box(club,palette.darkWood,.17,3.9,.17,x,1.95,5.6);}
  sign(club,'THE FLYING CLUB',9,.66,0,4.55,5.18,['#344638','#d6dac3']);
  colliders.push({minX:-88,maxX:-66,minZ:55,maxZ:71,minY:0,maxY:7.5});
  function picnic(x,z,angle=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=angle;staticDetails.add(g);box(g,palette.wood,2.1,.12,1,0,.87,0);for(const s of [-1,1]){box(g,palette.wood,2.2,.12,.32,0,.48,s*.72);for(const x of [-.7,.7])rod(g,palette.darkWood,[x,.08,s*.83],[x,.88,s*.32],.055);}}
  picnic(-52,53,.15);picnic(-53,60,-.1);picnic(-52,42,.08);
  // Several model aircraft in the pits make the setting recognisably an RC field.
  const parked1=createAircraft('sport');parked1.position.set(-52,1.55,53);parked1.rotation.y=.28;staticDetails.add(parked1);
  const parked2=createAircraft('glider');parked2.position.set(-71,.22,39);parked2.rotation.y=.7;staticDetails.add(parked2);
  function car(x,z,color,angle=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=angle;staticDetails.add(g);const paint=standard(color,.3,.25);box(g,paint,1.7,.60,3.9,0,.65,0);box(g,paint,1.55,.58,1.8,0,1.18,.16);box(g,palette.glass,1.58,.4,1.72,0,1.23,.15);box(g,paint,1.58,.12,1.85,0,1.5,.14);for(const s of [-1,1])for(const zz of [-1.2,1.2]){const w=mesh(new THREE.CylinderGeometry(.34,.34,.18,12),palette.black,g,s*.84,.35,zz);w.rotation.z=Math.PI/2;}for(const s of [-1,1]){box(g,palette.white,.45,.17,.03,s*.55,.68,-1.98);box(g,palette.red,.4,.18,.03,s*.55,.7,1.98);}box(g,palette.metal,1.6,.13,.06,0,.43,-2.01);}
  car(-80,87,'#c6cec4',.03);car(-70,87,'#526b76',-.02);car(-60,87,'#b8754e',0);
  // Farmhouses among the far meadows add a human scale to the landscape.
  for(const [x,z,w,d] of [[-340,-290,17,12],[-365,-280,10,8],[370,420,21,14],[399,431,13,9],[-470,545,15,10]]){
    const house=new THREE.Group(),y=heightAt(x,z);house.position.set(x,y-.3,z);house.rotation.y=.12;staticDetails.add(house);
    box(house,palette.wall,w,5,d,0,2.5,0);mesh(roofGeometry(w+1.5,d+1.5,5,3),palette.roof,house);gableWall(house,palette.wall,w,5,3,d/2+.02);
    for(let xx=-w/2+2.4;xx<w/2-1;xx+=4.5){box(house,palette.darkWood,1.7,1.9,.12,xx,2.7,d/2+.04);box(house,palette.glass,1.45,1.65,.14,xx,2.7,d/2+.12);}
    box(house,palette.red,.7,2,1,w*.25,7,0);colliders.push({minX:x-w*.6,maxX:x+w*.6,minZ:z-d*.6,maxZ:z+d*.6,minY:y-.3,maxY:y+8.5});
  }
  // Small club pilots, holding transmitters and looking toward the runway.
  function pilot(x,z,shirt){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=-Math.PI/2;staticDetails.add(g);const skin=standard('#c99169'),cloth=standard(shirt),trousers=standard('#3e514b');for(const s of [-1,1]){rod(g,trousers,[s*.12,.12,0],[s*.10,.84,0],.09,8);box(g,palette.black,.19,.12,.31,s*.12,.075,-.05);}mesh(new THREE.CylinderGeometry(.22,.18,.58,10),cloth,g,0,1.10,0);mesh(new THREE.SphereGeometry(.16,12,8),skin,g,0,1.55,0);mesh(new THREE.SphereGeometry(.168,12,8,0,TAU,0,Math.PI/2),cloth,g,0,1.60,0);box(g,cloth,.23,.04,.2,0,1.62,-.16);for(const s of [-1,1]){rod(g,cloth,[s*.2,1.32,0],[s*.25,1.03,-.16],.065);rod(g,skin,[s*.25,1.03,-.16],[s*.14,1.02,-.39],.052);}box(g,palette.black,.34,.13,.25,0,1.02,-.39);rod(g,palette.metal,[.10,1.08,-.4],[.10,1.29,-.5],.009);}
  pilot(-24,103,'#e4c58a');pilot(-27,105,'#6b8b96');
  // Safety fence: instanced posts and rails, positioned beyond the pits.
  const posts=[],rails=[];
  for(let z=-65;z<=133;z+=5){posts.push([-108,.65,z]);if(z<133)rails.push([-108,.82,z+2.5]);}
  const postMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.14,1.3,.14),palette.wood,posts.length),railMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.10,.13,5),palette.wood,rails.length*2);const dummy=new THREE.Object3D();
  posts.forEach((p,i)=>{dummy.position.set(...p);dummy.updateMatrix();postMesh.setMatrixAt(i,dummy.matrix);});rails.forEach((p,i)=>{for(let k=0;k<2;k++){dummy.position.set(p[0],p[1]-k*.42,p[2]);dummy.updateMatrix();railMesh.setMatrixAt(i*2+k,dummy.matrix);}});postMesh.castShadow=railMesh.castShadow=true;root.add(postMesh,railMesh);
  // A windsock that slackens in calm air and stretches out in wind.
  const sockPole=mesh(new THREE.CylinderGeometry(.045,.065,6.4,8),palette.white,root,27,3.2,141);sockPole.castShadow=true;
  const sock=new THREE.Group();sock.position.set(27,6.15,141);root.add(sock);
  const sockWhite=standard('#f1eee0'),sockRed=standard('#d86a43');
  for(let i=0;i<6;i++){const r1=mix(.36,.12,i/6),r2=mix(.36,.12,(i+1)/6);const part=mesh(new THREE.CylinderGeometry(r2,r1,.42,12,1,true),i%2?sockWhite:sockRed,sock,.21+i*.42,0,0);part.rotation.z=-Math.PI/2;}
  const ring=mesh(new THREE.TorusGeometry(.36,.025,5,16),palette.metal,sock);ring.rotation.y=Math.PI/2;
  // Tree placement leaves the entire central flight circuit unobstructed.
  const trees=[];
  for(let i=0;i<900;i++){
    const angle=rng()*TAU,r=270+Math.pow(rng(),.8)*1150,x=Math.cos(angle)*r,z=Math.sin(angle)*r;
    if(Math.abs(x)<150&&Math.abs(z)<530)continue;
    if(Math.hypot((x-550)/175,(z+175)/255)<1.12)continue;
    if(x<-90&&x>-135&&z>-90&&z<175)continue;
    const y=heightAt(x,z);if(y>145)continue;const size=(.65+rng()*.8)*(r>950?1.3:1);trees.push({x,y,z,size,pine:rng()>.73,shade:rng()});
  }
  const broad=trees.filter(t=>!t.pine),pines=trees.filter(t=>t.pine),trunkMat=standard('#766850'),leafMat=standard('#47664b'),pineMat=standard('#3e5c4b');
  const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.15,.27,5,6),trunkMat,trees.length);trunks.castShadow=true;trunks.receiveShadow=true;
  const leaves=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),leafMat,broad.length*3);leaves.castShadow=true;leaves.receiveShadow=true;
  const needles=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1,8),pineMat,pines.length*3);needles.castShadow=true;needles.receiveShadow=true;
  const c=new THREE.Color();trees.forEach((t,i)=>{dummy.position.set(t.x,t.y+2.3*t.size,t.z);dummy.rotation.set(0,t.shade*TAU,0);dummy.scale.set(t.size,t.size,t.size);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);if(Math.hypot(t.x,t.z)<750)treeColliders.push({x:t.x,y:t.y,z:t.z,r:3.2*t.size,h:9*t.size});});
  broad.forEach((t,i)=>{for(let j=0;j<3;j++){dummy.position.set(t.x+(j-1)*1.6*t.size,t.y+(5.4+(j===1?1.4:0))*t.size,t.z+Math.sin(j*2)*1.3*t.size);dummy.rotation.set(.13*j,t.shade*TAU,.07*j);dummy.scale.set((2.9-j*.12)*t.size,(3.0+j*.18)*t.size,2.6*t.size);dummy.updateMatrix();leaves.setMatrixAt(i*3+j,dummy.matrix);c.setHSL(.25+t.shade*.065,.19+t.shade*.12,.23+t.shade*.09);leaves.setColorAt(i*3+j,c);}});
  pines.forEach((t,i)=>{for(let j=0;j<3;j++){dummy.position.set(t.x,t.y+(4.0+j*2.2)*t.size,t.z);dummy.rotation.set(0,t.shade*TAU,0);const r=(3.2-j*.7)*t.size;dummy.scale.set(r,(5-j*.55)*t.size,r);dummy.updateMatrix();needles.setMatrixAt(i*3+j,dummy.matrix);c.setHSL(.29,.17,.24+t.shade*.07);needles.setColorAt(i*3+j,c);}});
  root.add(trunks,leaves,needles);
  // Low meadow tufts and pale seed heads; a single instanced draw call.
  const bladeGeom=new THREE.BufferGeometry();bladeGeom.setAttribute('position',new THREE.Float32BufferAttribute([-.08,0,0,.02,.65,0,.08,0,0,0,0,-.07,0,.48,.01,0,0,.08],3));bladeGeom.computeVertexNormals();
  const tuftMat=new THREE.MeshStandardMaterial({color:'#9eae75',roughness:1,side:THREE.DoubleSide});const tufts=new THREE.InstancedMesh(bladeGeom,tuftMat,2100);let tn=0;
  while(tn<2100){const x=(rng()-.5)*440,z=(rng()-.5)*530;if(Math.abs(x)<15)continue;if(x>-112&&x<-18&&z>-5&&z<115)continue;dummy.position.set(x,heightAt(x,z)+.02,z);dummy.rotation.set(0,rng()*TAU,0);const s=.4+rng()*1.2;dummy.scale.set(s,s,s);dummy.updateMatrix();tufts.setMatrixAt(tn,dummy.matrix);c.setHSL(.18+rng()*.08,.23,.43+rng()*.2);tufts.setColorAt(tn++,c);}root.add(tufts);
  // Lake: animated ripples and a view-dependent sky reflection, with a natural uneven shore.
  const lakeMat=new THREE.ShaderMaterial({uniforms:{time:{value:0},deep:{value:new THREE.Color('#428d86')},sky:{value:new THREE.Color('#aec8c2')}},vertexShader:`varying vec3 w;void main(){w=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);}`,fragmentShader:`uniform float time;uniform vec3 deep;uniform vec3 sky;varying vec3 w;void main(){vec3 n=normalize(vec3(sin(w.x*.19+w.z*.12+time*.8)*.035,1.,cos(w.z*.23-w.x*.06+time*.65)*.035));vec3 v=normalize(cameraPosition-w);float f=pow(1.-max(dot(n,v),0.),3.);float ripple=sin(w.x*.5+w.z*.18+time)*sin(w.z*.37-time*.6);vec3 c=mix(deep,sky,.25+f*.6)+ripple*.014;float spec=pow(max(0.,dot(reflect(-normalize(vec3(-.56,.55,-.62)),n),v)),90.);c+=vec3(1.,.92,.72)*spec*.5;gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`});
  const water=mesh(new THREE.CircleGeometry(1,96),lakeMat,root,550,-.65,-175,false);water.rotation.x=-Math.PI/2;water.scale.set(145,225,1);
  const rocks=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),standard('#9b9c89'),90);
  for(let i=0;i<90;i++){const a=rng()*TAU,x=550+Math.cos(a)*(145+rng()*10),z=-175+Math.sin(a)*(225+rng()*10);dummy.position.set(x,heightAt(x,z)+.3,z);dummy.rotation.set(rng(),rng()*TAU,rng());dummy.scale.set(1+rng()*2,.4+rng(),.8+rng()*1.4);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);}rocks.receiveShadow=true;root.add(rocks);
  // Wispy cloud sprites are soft, cheap to render, and are made locally in a canvas.
  const cloudCanvas=document.createElement('canvas');cloudCanvas.width=1024;cloudCanvas.height=512;const cc=cloudCanvas.getContext('2d');
  for(let i=0;i<48;i++){const x=140+rng()*740,y=220+rng()*110-(Math.sin((x-140)/740*Math.PI)*90),r=45+rng()*110;const grad=cc.createRadialGradient(x,y,r*.12,x,y,r);grad.addColorStop(0,'rgba(255,255,249,.42)');grad.addColorStop(.55,'rgba(255,255,249,.22)');grad.addColorStop(1,'rgba(255,255,249,0)');cc.fillStyle=grad;cc.fillRect(x-r,y-r,r*2,r*2);}
  const cloudTex=new THREE.CanvasTexture(cloudCanvas);cloudTex.colorSpace=THREE.SRGBColorSpace;const cloudMat=new THREE.SpriteMaterial({map:cloudTex,transparent:true,opacity:.8,depthWrite:false,color:'#fffdf0',fog:true});const clouds=[];
  for(let i=0;i<16;i++){const a=i/16*TAU+.1,r=650+rng()*800,s=new THREE.Sprite(cloudMat);s.position.set(Math.cos(a)*r,210+rng()*190,Math.sin(a)*r);s.scale.set(250+rng()*300,110+rng()*120,1);root.add(s);clouds.push(s);}
  // A distant lane threads between the fields toward the clubhouse.
  const roadCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-108,0,110),new THREE.Vector3(-145,0,240),new THREE.Vector3(-270,0,400),new THREE.Vector3(-420,0,650),new THREE.Vector3(-680,0,920)]);const roadPos=[],roadIdx=[];
  for(let i=0;i<=100;i++){const p=roadCurve.getPoint(i/100),t=roadCurve.getTangent(i/100),side=new THREE.Vector3(-t.z,0,t.x).multiplyScalar(3);for(const s of [-1,1]){const x=p.x+side.x*s,z=p.z+side.z*s;roadPos.push(x,heightAt(x,z)+.06,z);}if(i<100){const a=i*2;roadIdx.push(a,a+1,a+2,a+1,a+3,a+2);}}
  const roadGeom=new THREE.BufferGeometry();roadGeom.setAttribute('position',new THREE.Float32BufferAttribute(roadPos,3));roadGeom.setIndex(roadIdx);roadGeom.computeVertexNormals();mesh(roadGeom,standard('#8d927f'),root,0,0,0,false);
  // Static scenery is merged by material to keep the draw-call count small on phones.
  mergeStatic(staticDetails);
  function collisionAt(p) {
    const inLake=((p.x-water.position.x)/water.scale.x)**2+((p.z-water.position.z)/water.scale.y)**2<=1;
    if(inLake&&heightAt(p.x,p.z)<water.position.y&&p.y<=water.position.y+.25)return 'Aircraft hit the water.';
    for(const b of colliders)if(p.x>b.minX-.8&&p.x<b.maxX+.8&&p.z>b.minZ-.8&&p.z<b.maxZ+.8&&p.y>b.minY&&p.y<b.maxY+.35)return true;
    for(const t of treeColliders){if(p.y<t.y+.2||p.y>t.y+t.h)continue;const r=p.y<t.y+t.h*.32?.55:t.r;if((p.x-t.x)**2+(p.z-t.z)**2<(r+.4)**2)return true;}
    return false;
  }
  function setTimeOfDay(mode='day') {
    const warm=['sunset','golden','evening'].includes(mode);
    sky.material.uniforms.top.value.set(warm?'#7599bb':'#79acc9');sky.material.uniforms.horizon.value.set(warm?'#eed7b4':'#e3e8d2');sky.material.uniforms.sunDirection.value.set(warm?-.67:-.56,warm?.30:.55,-.62).normalize();
    sun.color.set(warm?'#ffdab0':'#fff2d1');sun.intensity=warm?2.7:3.2;sun.position.y=warm?190:310;ambient.intensity=warm?1.7:2.1;ambient.color.set(warm?'#d8e1f0':'#e7f3fb');scene.fog.color.set(warm?'#d4cbbb':'#c8d8c8');cloudMat.color.set(warm?'#ffe6cb':'#fffdf0');
  }
  return {
    heightAt,collisionAt,setTimeOfDay,bounds:{radius:1450},sun,root,
    update(dt,time,wind=0){const speed=typeof wind==='number'?Math.abs(wind):0;sock.rotation.y=.20+Math.sin(time*.7)*.08;sock.rotation.z=-.58*(1-smooth(0,4,speed))+Math.sin(time*4)*.025*(1+speed*.1);lakeMat.uniforms.time.value=time;for(let i=0;i<clouds.length;i++){clouds[i].position.x+=dt*(.45+speed*.1);if(clouds[i].position.x>1600)clouds[i].position.x=-1600;}},
    dispose(){root.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});scene.remove(root,ambient,sun,sun.target);}
  };
}
