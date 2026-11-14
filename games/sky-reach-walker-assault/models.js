import * as THREE from './vendor/three.module.js';

// Original, entirely procedural models. All long axes point down local -Z.
const geometryCache = new Map();
const materialCache = new Map();
const TAU = Math.PI * 2;

function material(color, metalness=.25, roughness=.55, emissive=0, intensity=0) {
  const key = `${color}/${metalness}/${roughness}/${emissive}/${intensity}`;
  if (!materialCache.has(key)) materialCache.set(key, new THREE.MeshStandardMaterial({color, metalness, roughness, emissive, emissiveIntensity:intensity}));
  return materialCache.get(key);
}
const M = {
  ivory:material(0xdcded4,.4,.48), white:material(0xf1ecdc,.32,.52),
  edge:material(0xb4b9b5,.5,.52), shade:material(0x646d6a,.6,.6),
  orange:material(0xd76e39,.35,.52), rust:material(0xb75531,.4,.58),
  dark:material(0x202c31,.65,.4), black:material(0x182227,.55,.47),
  glass:material(0x12313e,.9,.14,0x22677b,.28),
  cyan:material(0xb6f8ff,.1,.22,0x36d7ff,2.4),
  red:material(0xa33328,.5,.42,0xff341b,.2),
  amber:material(0xffb34d,.1,.25,0xff7027,1.8),
  walker:material(0x9b9a87,.38,.7), plate:material(0xb5b4a0,.35,.61),
  olive:material(0x686b5c,.45,.7), worn:material(0x777f77,.42,.72),
};

function boxGeometry(w,h,d,bevel=0) {
  const key=`b/${w}/${h}/${d}/${bevel}`;
  if(geometryCache.has(key)) return geometryCache.get(key);
  let geo;
  if(bevel>0) {
    const c=Math.min(w,h)*bevel, x=w/2, y=h/2;
    const s=new THREE.Shape();
    s.moveTo(-x+c,-y); s.lineTo(x-c,-y); s.lineTo(x,-y+c); s.lineTo(x,y-c);
    s.lineTo(x-c,y); s.lineTo(-x+c,y); s.lineTo(-x,y-c); s.lineTo(-x,-y+c); s.closePath();
    geo=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:false,steps:1,curveSegments:1});
    geo.translate(0,0,-d/2);
  } else geo=new THREE.BoxGeometry(w,h,d);
  geometryCache.set(key,geo); return geo;
}
function mesh(parent,geo,mat,x=0,y=0,z=0,rx=0,ry=0,rz=0) {
  const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); m.rotation.set(rx,ry,rz);
  m.castShadow=true; m.receiveShadow=true; parent.add(m); return m;
}
function box(parent,w,h,d,mat,x=0,y=0,z=0,bevel=.08,rx=0,ry=0,rz=0) {
  return mesh(parent,boxGeometry(w,h,d,bevel),mat,x,y,z,rx,ry,rz);
}
function cylinder(parent,r1,r2,length,mat,x=0,y=0,z=0,rx=0,ry=0,rz=0,sides=12) {
  const key=`c/${r1}/${r2}/${length}/${sides}`;
  if(!geometryCache.has(key)) geometryCache.set(key,new THREE.CylinderGeometry(r1,r2,length,sides,1));
  return mesh(parent,geometryCache.get(key),mat,x,y,z,rx,ry,rz);
}
function ring(parent,r,t,mat,x,y,z,rx=0,ry=0,rz=0) {
  const key=`r/${r}/${t}`;
  if(!geometryCache.has(key)) geometryCache.set(key,new THREE.TorusGeometry(r,t,6,16));
  return mesh(parent,geometryCache.get(key),mat,x,y,z,rx,ry,rz);
}
function panelXZ(parent,points,thickness,mat,y=0) {
  const s=new THREE.Shape(); points.forEach(([x,z],i)=>i?s.lineTo(x,-z):s.moveTo(x,-z));s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:thickness,steps:1,bevelEnabled:false});
  return mesh(parent,g,mat,0,y,0,-Math.PI/2);
}
function hullGeometry(sections) {
  // Beveled octagonal cross sections keep broad armor planes and a shaped nose.
  const positions=[], indices=[];
  for(const [z,w,h,y=0] of sections) {
    const ring=[[-w*.65,h],[w*.65,h],[w,h*.4],[w,-h*.45],[w*.64,-h],[-w*.64,-h],[-w,-h*.45],[-w,h*.4]];
    for(const [x,dy] of ring)positions.push(x,y+dy,z);
  }
  for(let k=0;k<sections.length-1;k++) for(let j=0;j<8;j++) {
    const a=k*8+j,b=k*8+(j+1)%8,c=(k+1)*8+(j+1)%8,d=(k+1)*8+j;
    indices.push(a,d,b,b,d,c);
  }
  for(let j=1;j<7;j++) indices.push(0,j,j+1);
  const last=(sections.length-1)*8;
  for(let j=1;j<7;j++)indices.push(last,last+j+1,last+j);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}

// Bake static subassemblies into a handful of meshes, one per material.
const paintedArmor=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,metalness:.38,roughness:.62});
function bake(group,mergeColors=false) {
  group.updateMatrixWorld(true);
  const inv=new THREE.Matrix4().copy(group.matrixWorld).invert(), buckets=new Map();
  const p=new THREE.Vector3(),n=new THREE.Vector3();
  group.traverse(o=>{
    if(!o.isMesh || o.isInstancedMesh || Array.isArray(o.material))return;
    const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry;
    const a=g.attributes.position, normals=g.attributes.normal;
    const transform=new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld),normalMatrix=new THREE.Matrix3().getNormalMatrix(transform);
    const bucketMaterial=mergeColors?paintedArmor:o.material;
    if(!buckets.has(bucketMaterial))buckets.set(bucketMaterial,{p:[],n:[],c:[]});
    const out=buckets.get(bucketMaterial);
    for(let i=0;i<a.count;i++) {
      p.fromBufferAttribute(a,i).applyMatrix4(transform);out.p.push(p.x,p.y,p.z);
      n.fromBufferAttribute(normals,i).applyMatrix3(normalMatrix).normalize();out.n.push(n.x,n.y,n.z);
      if(mergeColors)out.c.push(o.material.color.r,o.material.color.g,o.material.color.b);
    }
    if(g!==o.geometry)g.dispose();
  });
  group.clear();
  for(const [mat,data] of buckets) {
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(data.n,3));
    if(mergeColors)g.setAttribute('color',new THREE.Float32BufferAttribute(data.c,3));
    g.computeBoundingSphere();const m=new THREE.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;group.add(m);
  }
  return group;
}

export function createFighter({enemy=false}={}) {
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const skin=enemy?M.shade:M.white, accent=enemy?M.red:M.orange;
  mesh(body,hullGeometry([[-7,.42,.22],[-5,1.15,.48],[-2,1.8,.84],[1.7,1.9,1],[4.7,1.28,.65],[5.2,.9,.4]]),skin);
  // Low central canopy with an armored orange dorsal rail.
  const canopy=mesh(body,hullGeometry([[-3,.55,.13,.75],[-1.8,1.02,.65,.8],[.45,1.02,.83,.8],[1.5,.68,.22,.8]]),M.glass);
  box(body,.18,.18,4.2,accent,0,1.7,-.55,.1);
  box(body,.54,.2,4.1,accent,0,.82,3.1,.15);
  box(body,1.5,.16,1.4,M.shade,0,1.05,2.65,.1);
  for(let side of [-1,1]) {
    panelXZ(body,[[side*1.1,-1.1],[side*4.2,-.3],[side*7.3,3.4],[side*6.6,4.8],[side*2.3,3.2]],.32,skin,-.12);
    panelXZ(body,[[side*2.3,1.1],[side*5.7,2.4],[side*6.6,3.65],[side*4.1,3.02]],.045,accent,.23);
    panelXZ(body,[[side*1,3.3],[side*2.8,3.3],[side*4.5,5.8],[side*2.1,5.4]],.19,M.edge,.2);
    cylinder(body,.82,1.02,4.9,M.edge,side*3.3,.05,1.85,Math.PI/2);
    cylinder(body,.73,.67,1.25,M.dark,side*3.3,.05,4.7,Math.PI/2);
    cylinder(body,.55,.55,.18,enemy?M.amber:M.cyan,side*3.3,.05,5.37,Math.PI/2);
    ring(body,.71,.11,accent,side*3.3,.05,5.23);
    cylinder(body,.67,.82,.6,accent,side*3.3,.05,-.62,Math.PI/2);
    cylinder(body,.48,.48,.1,M.black,side*3.3,.05,-.98,Math.PI/2);
    box(body,.2,.23,2.5,M.dark,side*4.8,.13,-.2,.1);
    cylinder(body,.11,.14,1.9,M.edge,side*4.8,.13,-1.7,Math.PI/2,0,0,8);
    cylinder(body,.1,.1,.2,enemy?M.amber:M.cyan,side*4.8,.13,-2.72,Math.PI/2,0,0,8);
    // Canted tail keel, not a four-wing movie silhouette.
    const fin=panelXZ(body,[[side*1.25,2.8],[side*1.75,3.2],[side*2.4,5.2],[side*1.3,5.1]],.16,accent,1.1);
    fin.rotation.z=side*.32;
    for(let i=0;i<5;i++)box(body,.48,.06,.1,M.dark,side*1.15,.85,2+i*.27,0);
    for(let i=0;i<4;i++)box(body,.3,.024,.045,M.worn,side*(2.8+i*.62),.275,2.0+i*.25,0,0,side*.45);
    box(body,.35,.13,.55,M.shade,side*1.3,-.91,2.5,.1);
  }
  bake(body);
  const engines=[];
  for(const side of [-1,1]) {
    const glow=new THREE.MeshBasicMaterial({color:enemy?0xff7c35:0x45dfff,transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending});
    const inner=new THREE.MeshBasicMaterial({color:enemy?0xffdc9e:0xe4ffff,transparent:true,opacity:.84,depthWrite:false,blending:THREE.AdditiveBlending});
    const g1=new THREE.ConeGeometry(.68,9,10),g2=new THREE.ConeGeometry(.27,7.3,8);
    // Base lies at local z 5.4 and the point trails behind the ship.
    const outer=mesh(root,g1,glow,side*3.3,.05,9.9,Math.PI/2);
    const core=mesh(root,g2,inner,side*3.3,.05,9.05,Math.PI/2);
    outer.castShadow=false;core.castShadow=false;engines.push(outer,core);
    outer.userData.baseScale=1;core.userData.baseScale=1;
  }
  root.userData.engines=engines;root.userData.body=body;root.userData.length=12.5;
  root.name=enemy?'Hostile fighter':'Courier fighter';return root;
}

export function createWalker() {
  const root=new THREE.Group(),rig=new THREE.Group(),body=new THREE.Group();
  root.add(rig);rig.add(body);root.userData.rig=rig;
  // A low armored wedge below a broader upper plate makes the walker substantial.
  box(body,38,18,45,M.walker,0,68,1,.15);
  box(body,33,7,47,M.plate,0,80,1,.13);
  box(body,30,5,35,M.olive,0,57,2,.12);
  box(body,35,2,43,M.shade,0,77,1,.06);
  box(body,8,3,17,M.olive,0,85,8,.1);
  for(const side of [-1,1]) {
    box(body,2.2,12,36,M.rust,side*20.2,68,3,.1);
    box(body,1.7,3,40,M.orange,side*20.7,73,3,.08);
    for(let i=0;i<6;i++) {
      box(body,1.2,8.5,4.5,M.plate,side*21.5,67,-13+i*6,.08);
      box(body,1.35,.45,3.5,M.olive,side*22.12,69.2,-13+i*6,0);
      box(body,.2,.4,.7,M.amber,side*22.8,63,-13+i*6,0);
    }
    for(let i=0;i<4;i++)box(body,5,.55,8,M.walker,side*9.8,83.8,-13+i*10,.06);
    box(body,5.5,4,6,M.shade,side*12,85,13,.12);
    for(let i=0;i<5;i++)box(body,3.6,.5,.3,M.black,side*12,87.1,11.3+i*.8,0);
    cylinder(body,2.6,3.1,8,M.dark,side*14,67,26,Math.PI/2,0,0,10);
    cylinder(body,1.9,1.9,.4,M.red,side*14,67,30.3,Math.PI/2);
  }
  for(let i=0;i<8;i++)box(body,3,.18,.35,M.worn,-13+i*3.5,83.6,-17.4,0,0,(i%3)*.2);
  bake(body);
  const neck=new THREE.Group();rig.add(neck);
  box(neck,15,10,13,M.dark,0,68,-26,.15);
  cylinder(neck,5.2,5.2,16,M.shade,0,68,-29,Math.PI/2,0,0,12);bake(neck);
  const head=new THREE.Group();head.position.set(0,69,-35);rig.add(head);
  mesh(head,hullGeometry([[-13,7,4],[-9,11,6],[4,10,7],[8,7,5]]),M.plate);
  box(head,17,1.9,1.1,M.black,0,3.3,-10.2,.08);
  box(head,11,.65,1.3,M.red,0,3.4,-10.9,.02);
  box(head,17,1.2,9,M.rust,0,6.9,-2,.08);
  for(const side of [-1,1]) {
    cylinder(head,1.05,1.4,15,M.shade,side*4.4,-2,-15,Math.PI/2);
    cylinder(head,1.5,1.5,2.5,M.dark,side*4.4,-2,-21.6,Math.PI/2);
    cylinder(head,.8,.8,.3,M.amber,side*4.4,-2,-22.95,Math.PI/2);
    box(head,2,4,6,M.walker,side*10,0,-3,.1);
  }
  bake(head);root.userData.head=head;
  const legs=[];
  for(let side of [-1,1])for(let front of [-1,1]) {
    const hip=new THREE.Group();hip.position.set(side*18.6,60,front*17);rig.add(hip);
    const upper=new THREE.Group();hip.add(upper);
    cylinder(upper,4.3,4.3,7,M.shade,0,0,0,0,0,Math.PI/2);
    ring(upper,3.9,.78,M.red,side*3.7,0,0,0,Math.PI/2);
    box(upper,7,25,8,M.walker,0,-13,0,.17,0,0,-side*.018);
    box(upper,7.6,19,2.3,M.plate,0,-11.5,-4.3,.12);
    box(upper,5.4,3,2.5,M.orange,0,-6.5,-4.6,.05);
    cylinder(upper,.8,.8,23,M.edge,side*4,-12.5,1.3,0,0,-side*.05,8);
    cylinder(upper,1.2,1.2,9,M.dark,side*4,-6,1.3,0,0,-side*.05,8);
    bake(upper,true);
    const knee=new THREE.Group();knee.position.y=-27;hip.add(knee);
    const lower=new THREE.Group();knee.add(lower);
    cylinder(lower,4.2,4.2,8,M.dark,0,0,0,0,0,Math.PI/2);
    ring(lower,3.8,.75,M.red,side*4.1,0,0,0,Math.PI/2);
    box(lower,5.8,25,6.5,M.olive,0,-13,0,.12);
    box(lower,6.5,21,2.6,M.plate,0,-13,-3.6,.1);
    box(lower,5.5,2.1,2.8,M.rust,0,-4.8,-3.8,.06);
    for(let j=0;j<3;j++)box(lower,5.6,.55,3,M.shade,0,-15-j*2.6,-3.8,0);
    cylinder(lower,.6,.6,24,M.edge,side*3.7,-13,1,0,0,0,8);
    bake(lower,true);
    const foot=new THREE.Group();foot.position.set(0,-30,-1);knee.add(foot);
    box(foot,11,3.7,16,M.shade,0,1,-1,.16);
    box(foot,10,2.8,14,M.walker,0,3,-.7,.12);
    for(let toe=-1;toe<=1;toe++)box(foot,2.8,2,5,M.plate,toe*3.3,1,-8.8,.09);
    box(foot,8,.8,1.2,M.orange,0,4.4,-5.8,0);
    bake(foot,true);
    const anchor=new THREE.Object3D();anchor.position.set(side*4.2,4,-3.3);foot.add(anchor);
    legs.push({hip,knee,foot,anchor,side,front,phase:side*front>0?0:Math.PI});
  }
  root.userData.legs=legs;root.userData.height=87;root.userData.phase=Math.random()*TAU;
  root.name='Siege walker';return root;
}

export function animateWalker(group,time,speed=1,fall=0) {
  const {rig,legs,head}=group.userData;if(!rig||!legs)return;
  const f=THREE.MathUtils.clamp(fall,0,1),stride=time*.83*speed+(group.userData.phase||0);
  rig.rotation.x=-f*1.22;rig.rotation.z=Math.sin(f*Math.PI)*.055;
  rig.position.y=(1-f)*Math.sin(stride*2)*.65 + f*4;
  for(const leg of legs) {
    const s=Math.sin(stride+leg.phase);
    leg.hip.rotation.x=s*.17*(1-f)+f*(leg.front<0?-.36:.32);
    leg.hip.rotation.z=leg.side*(.055+Math.sin(f*Math.PI)*.24);
    leg.knee.rotation.x=Math.max(0,-s)*.22*(1-f)+f*(leg.front<0?.8:1.03);
    leg.foot.rotation.x=-leg.hip.rotation.x*.5-leg.knee.rotation.x*.35;
  }
  head.rotation.y=Math.sin(time*.21)*.09*(1-f);
  head.rotation.x=f*.23;
}

export function createCapital(kind='halcyon') {
  const root=new THREE.Group(),solid=new THREE.Group();root.add(solid);
  const enemy=kind==='dreadnought'||kind==='ravager';
  const skin=enemy?M.shade:M.ivory, top=enemy?M.worn:M.white,accent=enemy?M.red:M.rust;
  const light=enemy?M.amber:M.cyan;
  if(kind==='dreadnought') {
    mesh(solid,hullGeometry([[-415,32,18],[-340,72,30],[-140,168,42],[140,198,48],[290,167,39],[345,125,25]]),skin);
    panelXZ(solid,[[-30,-370],[-170,-45],[-216,210],[-161,311],[-57,270],[-49,-130]],11,top,29);
    panelXZ(solid,[[30,-370],[170,-45],[216,210],[161,311],[57,270],[49,-130]],11,top,29);
    box(solid,53,31,295,M.dark,0,52,97,.13);
    box(solid,61,14,135,accent,0,72,150,.12);
    box(solid,47,46,57,skin,0,99,202,.12);
    box(solid,85,19,58,top,0,129,202,.1);
    box(solid,78,3,2,light,0,131,171.5,0);
  } else {
    mesh(solid,hullGeometry([[-390,17,12],[-332,41,20],[-180,61,27],[120,64,30],[298,45,23],[345,32,17]]),skin);
    box(solid,65,13,450,top,0,27,-20,.08);
    box(solid,25,6,530,accent,0,38,-27,.08);
    for(const side of [-1,1]) {
      const pod=mesh(solid,hullGeometry([[-200,17,15],[-145,25,20],[200,31,26],[310,24,18]]),skin,side*94,-5,25);
      box(solid,73,17,44,M.shade,side*61,-2,-103,.12);
      box(solid,82,19,48,M.shade,side*65,-2,155,.12);
      box(solid,36,4,175,accent,side*94,21,100,.08);
      box(solid,34,3,71,top,side*94,21,-93,.1);
    }
    box(solid,46,35,102,skin,0,57,188,.13);
    box(solid,78,16,74,top,0,80,171,.12);
    box(solid,71,3,1.4,light,0,82,133.2,0);
    box(solid,5,45,5,M.dark,-18,106,192,.02);
    box(solid,3,29,3,M.edge,17,98,185,.02);
    cylinder(solid,8,11,25,M.shade,0,-43,83,0,0,0,8);
  }
  // Deck subdivisions: armor slabs, inset service channels, gun housings.
  const deckWidth=kind==='dreadnought'?151:41;
  for(let row=0;row<13;row++) {
    const z=-280+row*42;
    for(const side of [-1,1]) {
      const x=side*deckWidth*(.58+.13*Math.sin(row));
      const y=kind==='dreadnought'?46:35;
      box(solid,kind==='dreadnought'?51:21,2.8,30,top,x,y,z,.08);
      box(solid,kind==='dreadnought'?44:17,.7,2,M.dark,x,y+1.85,z+9,0);
      if(row%3===0) {
        const tx=side*(kind==='dreadnought'?142:50),ty=kind==='dreadnought'?51:35;
        cylinder(solid,9,12,5,M.shade,tx,ty,z,0,0,0,8);
        box(solid,15,7,16,skin,tx,ty+5,z,.13);
        for(const j of [-1,1])cylinder(solid,1.1,1.4,23,M.dark,tx+j*3,ty+7,z-15,Math.PI/2,0,0,6);
      }
    }
  }
  // Midline mechanical trench with cooling ribs.
  for(let i=0;i<22;i++) {
    const z=-290+i*25;
    box(solid,9,1.6,4,M.dark,0,kind==='dreadnought'?46:42,z,0);
  }
  const engineXs=kind==='dreadnought'?[-105,-53,0,53,105]:[-94,-30,30,94];
  for(const x of engineXs) {
    const z=kind==='dreadnought'?335:(Math.abs(x)>60?333:347);
    cylinder(solid,13,17,24,M.dark,x,-1,z,Math.PI/2,0,0,12);
    cylinder(solid,11,11,2.5,light,x,-1,z+13,Math.PI/2,0,0,12);
    ring(solid,14,2.4,accent,x,-1,z+11);
  }
  bake(solid);
  // A single instanced mesh for hundreds of hull windows.
  const windowGeo=boxGeometry(2.1,1.5,.6),rows=[];
  for(const side of [-1,1])for(let i=0;i<76;i++)for(let level=0;level<2;level++) {
    if((i+level*3)%7===0)continue;
    const z=-265+i*7.5;
    const x=side*(kind==='dreadnought'?Math.min(192,70+(z+340)*.2):61);
    rows.push([x,level*7-7,z,side]);
  }
  const windows=new THREE.InstancedMesh(windowGeo,light,rows.length),dummy=new THREE.Object3D();
  rows.forEach(([x,y,z,s],i)=>{dummy.position.set(x,y,z);dummy.rotation.set(0,s*Math.PI/2,0);dummy.updateMatrix();windows.setMatrixAt(i,dummy.matrix);});
  windows.instanceMatrix.needsUpdate=true;root.add(windows);
  const engines=[];
  for(const x of engineXs) {
    const z=kind==='dreadnought'?350:(Math.abs(x)>60?348:362);
    const mat=new THREE.MeshBasicMaterial({color:enemy?0xff743b:0x63e5ff,transparent:true,opacity:.34,blending:THREE.AdditiveBlending,depthWrite:false});
    const jet=mesh(root,new THREE.ConeGeometry(12,90,10),mat,x,-1,z+45,Math.PI/2);jet.castShadow=false;engines.push(jet);
  }
  root.userData.engines=engines;root.userData.length=760;root.userData.kind=kind;
  if(kind==='ravager')root.scale.setScalar(.65);
  if(kind==='valiant')root.scale.setScalar(.83);
  root.name=kind.toUpperCase();return root;
}

export function createPilot() {
  const root=new THREE.Group(),torso=new THREE.Group();root.add(torso);
  const suit=material(0xd9ded9,.1,.72), fabric=material(0x4f5d61,.1,.87),strap=M.orange;
  box(torso,.58,.68,.34,suit,0,1.33,0,.18);
  box(torso,.5,.16,.37,fabric,0,.99,0,.12);
  box(torso,.48,.54,.24,M.shade,0,1.39,.28,.13);
  box(torso,.38,.37,.11,M.edge,0,1.47,.445,.09);
  for(const side of [-1,1]) {
    box(torso,.085,.62,.06,strap,side*.18,1.36,-.205,.04,0,0,side*.04);
    cylinder(torso,.085,.11,.38,M.dark,side*.21,1.18,.37,0,0,0,8);
    cylinder(torso,.065,.065,.045,M.cyan,side*.21,.975,.37,0,0,0,8);
  }
  box(torso,.25,.16,.06,M.dark,0,1.43,-.226,.06);
  box(torso,.15,.045,.015,M.cyan,0,1.46,-.264,0);
  bake(torso);
  const helmet=new THREE.Group();helmet.position.y=1.95;root.add(helmet);
  const sphere=new THREE.SphereGeometry(.3,16,10);const shell=mesh(helmet,sphere,suit,0,0,0);shell.scale.set(1,1.07,.95);
  const visor=mesh(helmet,new THREE.SphereGeometry(.282,16,8,Math.PI*1.08,Math.PI*.84,Math.PI*.25,Math.PI*.53),M.glass,0,.02,-.02);
  box(helmet,.43,.085,.15,M.dark,0,-.17,-.19,.14);
  box(helmet,.14,.035,.02,strap,0,.26,-.15,.04);
  for(const side of [-1,1])cylinder(helmet,.1,.1,.065,M.shade,side*.29,-.02,0,0,0,Math.PI/2,10);
  bake(helmet);
  const arms=[],legs=[];
  for(const side of [-1,1]) {
    const arm=new THREE.Group();arm.position.set(side*.39,1.62,0);root.add(arm);
    cylinder(arm,.115,.1,.36,suit,0,-.16,0,0,0,-side*.11,10);
    cylinder(arm,.105,.08,.32,suit,side*.025,-.47,-.015,0,0,side*.06,10);
    box(arm,.19,.15,.18,M.dark,side*.015,-.67,-.02,.15);
    box(arm,.18,.1,.205,strap,side*.02,-.51,-.01,.08);
    bake(arm);arms.push(arm);
    const leg=new THREE.Group();leg.position.set(side*.17,.98,0);root.add(leg);
    cylinder(leg,.14,.115,.39,suit,0,-.2,0,0,0,0,10);
    cylinder(leg,.115,.09,.37,suit,0,-.57,0,0,0,0,10);
    box(leg,.19,.16,.1,M.shade,0,-.41,-.105,.12);
    box(leg,.24,.22,.39,M.dark,0,-.85,-.07,.15);
    box(leg,.24,.05,.24,M.edge,0,-.81,-.18,.08);
    bake(leg);legs.push(leg);
  }
  root.userData.arms=arms;root.userData.legs=legs;root.userData.head=helmet;
  root.userData.height=2.28;root.name='Pilot';return root;
}
