import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The entire garden, including all textures and audio, is generated here.
const $ = s => document.querySelector(s);
const mobile = matchMedia('(pointer:coarse)').matches;
const reducedMotion = matchMedia('(prefers-reduced-motion:reduce)').matches;
const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
const TAU = Math.PI*2;
let seed = 82917;
function rand(a=0,b=1){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return a+(b-a)*seed/4294967296;}
const pick = a => a[Math.floor(rand(0,a.length))];
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#a5bfc0',.008);
const camera = new THREE.PerspectiveCamera(mobile?55:47,innerWidth/innerHeight,.14,750);
camera.position.set(34,12,45);
const world = new THREE.Group();scene.add(world);
const staticBatches = new Map();
const dummy = new THREE.Object3D();
const lanterns = [], birds = [], ripples = [];
const blossomDrift = [], reeds = [];
const boxGeo = new THREE.BoxGeometry(1,1,1);
const rockGeo = new THREE.IcosahedronGeometry(1,2);
const twigGeo = new THREE.CylinderGeometry(1,1,1,7);
const leafGeo = new THREE.IcosahedronGeometry(1,1);
const palette = {stone:['#b6b6a2','#9eaa9b','#c6c1ab','#a4ae9b','#b9baa5'],wood:['#4e3829','#6a4a32','#805a3a']};
const std = (color,extra={}) => new THREE.MeshStandardMaterial({color,roughness:.88,...extra});

function canvasTexture(size,draw){const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
const stoneMap = canvasTexture(256,(c,n)=>{
 c.fillStyle='#bdbdae';c.fillRect(0,0,n,n);
 for(let i=0;i<12000;i++){const v=Math.floor(rand(90,235));c.fillStyle=`rgba(${v},${v},${v-12},${rand(.04,.28)})`;c.fillRect(rand(0,n),rand(0,n),rand(.5,3),rand(.5,2));}
 for(let i=0;i<30;i++){c.strokeStyle='rgba(70,80,61,.12)';c.lineWidth=rand(.3,1);c.beginPath();let x=rand(0,n),y=rand(0,n);c.moveTo(x,y);for(let j=0;j<4;j++){x+=rand(-10,10);y+=rand(2,15);c.lineTo(x,y);}c.stroke();}
});stoneMap.wrapS=stoneMap.wrapT=THREE.RepeatWrapping;
const stoneMats = palette.stone.map(color=>std(color,{map:stoneMap,bumpMap:stoneMap,bumpScale:.08}));
const mossMat=std('#526948'),grassMat=std('#5c7050'),earthMat=std('#62715a');
const barkMat=std('#574c3e'),darkBark=std('#3e4637'),woodMat=std('#654832'),trimMat=std('#392f25');
const foliageMats=['#173d31','#244d39','#31543b','#1c4536'].map(c=>std(c));
const flowerMat=std('#f4bac9',{roughness:.8});
const brassMat=std('#8b713d',{metalness:.62,roughness:.39});
const glowMat=new THREE.MeshStandardMaterial({color:'#fff1ce',emissive:'#ffbf62',emissiveIntensity:1.7,roughness:.4});
const flameMat=new THREE.MeshBasicMaterial({color:'#fff3bd',toneMapped:false});

function batch(geo,mat,x=0,y=0,z=0,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){
 dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(rx,ry,rz);dummy.updateMatrix();
 const g=(geo.index?geo.toNonIndexed():geo.clone()).applyMatrix4(dummy.matrix);
 if(!g.index){g.computeVertexNormals();} // All merged members retain the same standard attributes.
 if(!staticBatches.has(mat))staticBatches.set(mat,[]);staticBatches.get(mat).push(g);
}
function block(mat,x,y,z,w,h,d,ry=0){batch(boxGeo,mat,x,y,z,w,h,d,0,ry,0);}
function segment(a,b,r1,r2,mat,group=null){
 const delta=b.clone().sub(a),g=new THREE.CylinderGeometry(r2,r1,delta.length(),7);g.translate(0,delta.length()/2,0);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0,1,0),delta.normalize()));g.translate(a.x,a.y,a.z);
 if(group){const m=new THREE.Mesh(g,mat);m.castShadow=true;group.add(m);return m;}
 batch(g,mat);g.dispose();
}
function addMesh(geo,mat,group=world,x=0,y=0,z=0){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
function finishBatches(){
 for(const [mat,geos] of staticBatches){const merged=mergeGeometries(geos,false);if(!merged)throw Error('Unable to combine garden geometry');const m=new THREE.Mesh(merged,mat);m.castShadow=true;m.receiveShadow=true;m.name='Garden architecture and planting';world.add(m);for(const g of geos)g.dispose();}staticBatches.clear();
}

// Soft, irregular banks: stone foundations under moss, pebbles and grasses.
function island(x,z,rx,rz,height=1.5){
 const g=new THREE.SphereGeometry(1,36,18);const p=g.attributes.position;
 for(let i=0;i<p.count;i++){const a=p.getX(i),b=p.getY(i),c=p.getZ(i),w=1+.045*Math.sin(a*14+c*19)+.025*Math.cos(c*31-a*9);p.setXYZ(i,a*rx*w,b*height-.6,c*rz*w);}g.computeVertexNormals();batch(g,earthMat,x,0,z);g.dispose();
 for(let i=0;i<85;i++){const a=rand(0,TAU),r=rand(.81,1.03),xx=x+Math.cos(a)*rx*r,zz=z+Math.sin(a)*rz*r;batch(rockGeo,pick(stoneMats),xx,rand(-.05,.35),zz,rand(.35,1.2),rand(.3,.7),rand(.3,.85),rand(-.3,.3),rand(0,TAU),rand(-.3,.3));}
 for(let i=0;i<75;i++){const a=rand(0,TAU),r=Math.sqrt(rand(0,.82)),xx=x+Math.cos(a)*rx*r,zz=z+Math.sin(a)*rz*r;batch(leafGeo,mossMat,xx,rand(.55,.95),zz,rand(.4,1.4),rand(.12,.32),rand(.4,1.2));}
}
island(-29,4,11,33,2.2);island(31,-8,12,38,2.3);island(-4,-52,55,17,2.9);
island(-45,-28,18,16,3.2);island(48,25,15,27,2.8);

function archRing(cx,base,z,rx,ry,thickness,depth,theta0=0,theta1=Math.PI,count=22){
 for(let i=0;i<count;i++){
  const a=theta0+(theta1-theta0)*(i+.025)/count,b=theta0+(theta1-theta0)*(i+.975)/count;
  const sh=new THREE.Shape();sh.moveTo(Math.cos(a)*rx,Math.sin(a)*ry);sh.lineTo(Math.cos(b)*rx,Math.sin(b)*ry);sh.lineTo(Math.cos(b)*(rx-thickness),Math.sin(b)*(ry-thickness));sh.lineTo(Math.cos(a)*(rx-thickness),Math.sin(a)*(ry-thickness));sh.closePath();
  const g=new THREE.ExtrudeGeometry(sh,{depth,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:1,steps:1});batch(g,pick(stoneMats),cx,base,z);g.dispose();
 }
}
function bridge(){
 const z=-14,rx=21,ry=11,cut=.36,base=.33-ry*Math.sin(cut);
 archRing(0,base,z,rx,ry,1.85,4.1,cut,Math.PI-cut,36);
 // Individually laid coping and balustrades trace the humpback silhouette.
 for(let i=0;i<=40;i++){
  const a=cut+(Math.PI-cut*2)*i/40,x=rx*Math.cos(a),y=base+ry*Math.sin(a)+.12;
  for(const dz of [-.23,4.33]){
   const tangent=Math.atan2(ry*Math.cos(a),-rx*Math.sin(a));
   batch(boxGeo,stoneMats[(i+1)%5],x,y+.25,z+dz,.94,.48,.68,0,0,tangent);
   if(i%2===0){block(stoneMats[i%5],x,y+.81,z+dz,.38,1.06,.38);batch(rockGeo,stoneMats[2],x,y+1.43,z+dz,.26,.20,.26);}
  }
 }
 for(const side of [-1,1]){
  for(let row=0;row<4;row++)for(let col=0;col<4;col++)block(stoneMats[(col+row)%5],side*(19.1+col*.93),row*.64-.35,z+2, .9,.61,4.6);
  for(let k=0;k<10;k++){const x=side*(20+k*.7);block(stoneMats[k%5],x,.75-k*.055,z+2,.73,.45,4.1);}
 }
 // Ivy follows the damp arch bases and the outer stonework.
 for(let i=0;i<140;i++){const a=rand(cut,Math.PI-cut),xx=rx*Math.cos(a),yy=base+ry*Math.sin(a);if(rand()>.55||Math.abs(xx)>16)batch(leafGeo,mossMat,xx,yy-rand(.2,1.5),z-.06,rand(.1,.4),rand(.1,.36),.12);}
}
bridge();

function column(x,z,height=6.8,broken=false){
 block(stoneMats[1],x,.57,z,1.65,.47,1.65);block(stoneMats[2],x,.89,z,1.36,.22,1.36);
 const n=Math.floor(height/.55);
 for(let j=0;j<n;j++){const g=new THREE.CylinderGeometry(.45,.48,.53,16);batch(g,stoneMats[j%5],x,1.25+j*.54,z);g.dispose();}
 if(!broken){block(stoneMats[2],x,1.24+n*.54,z,1.23,.25,1.23);block(stoneMats[0],x,1.49+n*.54,z,1.5,.25,1.5);}
}
// Flooded Roman loggia and fragments of a forgotten garden pavilion.
for(let i=0;i<7;i++){
 const x=8+i*4.6;column(x,-37,6.1,i===6);
 if(i<5){archRing(x+2.3,6.4,-37.48,2.29,2.2,.45,.95,0,Math.PI,14);block(stoneMats[2],x+2.3,8.88,-37,4.65,.38,1.4);}
}
for(let i=0;i<9;i++)for(let j=0;j<3;j++)block(stoneMats[(i+j)%5],6+i*3.7,.12,-40+j*2.8,3.65,.32,2.75);
for(const [x,z,h] of [[-32,-20,7],[-37,-20,5],[-32,-25,8],[-37,-25,7],[-34.5,-29,3.6]])column(x,z,h,h<6);
archRing(-34.5,7.1,-20.5,2.5,2.7,.55,1,0,Math.PI,14);
for(let i=0;i<12;i++){batch(rockGeo,pick(stoneMats),rand(-38,-30),.9,rand(-28,-17),rand(.3,.9),rand(.2,.45),rand(.4,1),rand(0,1),rand(0,TAU),rand(0,1));}
// Water stairs, a stone landing and a small timber jetty.
for(let i=0;i<7;i++)block(stoneMats[i%5],-20+i*.72,.83-i*.19,17, .76,.38,4.5);
for(let i=0;i<11;i++)block(woodMat,23, .63,9+i*.53,4,.18,.49);
for(const x of [21.3,24.7])for(const z of [9,14.3]){batch(new THREE.CylinderGeometry(.13,.17,2.4,8),woodMat,x,.24,z);batch(rockGeo,trimMat,x,1.48,z,.2,.12,.2);}

// An open pavilion combines pale stone with the lightness of a tea house.
const pavilion=new THREE.Group();pavilion.position.set(31,1.05,7);world.add(pavilion);
addMesh(new THREE.CylinderGeometry(4.7,4.9,.46,6),stoneMats[2],pavilion,0,.15,0);
for(let i=0;i<6;i++){const a=i*TAU/6;const x=Math.cos(a)*3.8,z=Math.sin(a)*3.8;addMesh(new THREE.CylinderGeometry(.16,.23,4.5,12),woodMat,pavilion,x,2.4,z);}
const roofMat=std('#35504a',{metalness:.08});
for(let tier=0;tier<3;tier++){
 const r=5.6-tier*1.5,h=tier===2?1.9:1.3,g=new THREE.ConeGeometry(r,h,6,1,true);const m=addMesh(g,roofMat,pavilion,0,5.1+tier*.6,0);m.rotation.y=Math.PI/6;
}
addMesh(new THREE.SphereGeometry(.2,12,8),brassMat,pavilion,0,7.2,0);

const needles=[],blossoms=[],understory=[];
function instanceRecord(list,p,s,color,rot=0){list.push({p,s,color,rot});}
function plantInstances(list,geo,mat,name){
 const mesh=new THREE.InstancedMesh(geo,mat,list.length);mesh.name=name;
 for(let i=0;i<list.length;i++){const r=list[i];dummy.position.copy(r.p);dummy.scale.copy(r.s);dummy.rotation.set(0,r.rot,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new THREE.Color(r.color));}
 mesh.castShadow=true;mesh.receiveShadow=true;world.add(mesh);return mesh;
}
function cypress(x,z,h=15){
 const origin=V(x,.7,z);segment(origin,origin.clone().add(V(.1,h*.87,0)),.23,.07,darkBark);
 const layers=mobile?14:20,around=mobile?7:9;
 for(let k=0;k<layers;k++){
  const t=k/layers,r=Math.pow(Math.sin(t*Math.PI),.62)*(h*.095)+.08;
  for(let j=0;j<around;j++){
   const a=j*TAU/around+k*.67,rr=r*rand(.3,.85),p=V(x+Math.cos(a)*rr,.9+h*(.13+t*.83),z+Math.sin(a)*rr);
   instanceRecord(needles,p,V(rand(.32,.55)*r,rand(.6,1.1)*h*.075,rand(.4,.8)*r),pick(['#254a34','#234832','#1b3a2e','#35533b','#294b35']),rand(0,TAU));
  }
 }
}
for(const [x,z,h] of [[-26,21,18],[-29,16,15],[-33,9,21],[-30,-8,16],[-26,-13,20],[-28,-25,19],[-33,-35,22],[-20,-48,18],[-13,-50,14],[28,-22,19],[32,-17,23],[36,-24,20],[30,-30,17],[39,2,19],[35,24,17],[30,20,14],[40,28,22],[45,-29,18],[-42,-15,17],[-45,4,19],[-42,22,17],[13,-49,16],[21,-53,20],[29,-51,15]])cypress(x,z,h);

function pine(x,z,h){
 const top=V(x+rand(-1,1),h,z);segment(V(x,.5,z),top,.37,.14,barkMat);
 for(let i=0;i<9;i++){
  const a=i*2.4,p=top.clone().add(V(Math.cos(a)*rand(2,4),rand(-1.8,.2),Math.sin(a)*rand(2,4)));segment(top.clone().add(V(0,-2,0)),p,.13,.045,barkMat);
  for(let j=0;j<30;j++)instanceRecord(needles,p.clone().add(V(rand(-1.3,1.3),rand(-.2,.7),rand(-1.3,1.3))),V(rand(.6,1),rand(.3,.65),rand(.6,1)),pick(['#3c5d3b','#344e37','#42613d']),rand(0,TAU));
 }
}
pine(-42,-38,16);pine(42,-43,17);pine(-8,-55,18);pine(42,9,16);

function cherry(x,z,h=8,spread=1){
 const root=V(x,.8,z),knee=root.clone().add(V(.25,h*.43,0)),fork=root.clone().add(V(.1,h*.66,.25));
 segment(root,knee,.46*spread,.29*spread,barkMat);segment(knee,fork,.29*spread,.2*spread,barkMat);
 const tips=[];
 for(let a=0;a<6;a++){
  const angle=a*TAU/6+rand(-.25,.25),tip=fork.clone().add(V(Math.cos(angle)*rand(2.3,3.3)*spread,rand(.8,2.4),Math.sin(angle)*rand(2.3,3.3)*spread));
  segment(knee.clone().lerp(fork,rand(.3,.8)),tip,.19*spread,.065,barkMat);
  for(let b=0;b<3;b++){
   const aa=angle+rand(-.9,.9),q=tip.clone().add(V(Math.cos(aa)*rand(.8,1.8)*spread,rand(.2,1.4),Math.sin(aa)*rand(.8,1.8)*spread));segment(tip,q,.065,.017,barkMat);tips.push(q);
  }
 }
 for(const tip of tips)for(let i=0;i<(mobile?45:72);i++){
  const a=rand(0,TAU),v=rand(-1,1),r=Math.cbrt(rand()),rad=Math.sqrt(1-v*v),p=tip.clone().add(V(Math.cos(a)*rad*r*1.5*spread,v*r*.89,Math.sin(a)*rad*r*1.5*spread));
  const s=rand(.13,.29)*spread;
  instanceRecord(blossoms,p,V(s,rand(.65,1)*s,s),pick(['#edafb9','#f8ced3','#f1b8c5','#ffe0d9','#d997af','#ecc0c9']),rand(0,TAU));
 }
 blossomDrift.push({x,z,h:h+1,r:5*spread});
}
cherry(-21,9,7.3,1.2);cherry(23,-1,7.7,1.27);cherry(-23,-22,7.5,1.1);cherry(22,-26,8.3,1.15);cherry(-40,26,9,1.2);cherry(36,17,8,1.15);cherry(-15,-50,7,1.05);cherry(0,-52,8.5,1.3);
plantInstances(needles,mobile?new THREE.IcosahedronGeometry(1,0):leafGeo,std('#ffffff'), 'Cypress and umbrella pine foliage');
plantInstances(blossoms,new THREE.IcosahedronGeometry(1,0),std('#ffffff',{roughness:.82}), 'Individual cherry blossoms');

// Fine shoreline reeds, iris leaves and little wildflowers.
const reedMat=std('#5c7651',{side:THREE.DoubleSide}),irisMat=std('#cab2d7',{side:THREE.DoubleSide});
for(let i=0;i<430;i++){
 const side=rand()<.5?-1:1,x=side*rand(19.5,24),z=rand(-37,30),h=rand(.3,1.1),a=rand(0,TAU);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-.045,0,0,.045,0,0,.018,h*.6,.09, .045,0,0,.018,h*.6,.09,.09,h,.18],3));g.computeVertexNormals();g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,.6,1,0,0,.6,1,1],2));batch(g,reedMat,x,.2,z,1,1,1,0,a,0);g.dispose();
 if(i%13===0){batch(leafGeo,irisMat,x,.3+h,z,.14,.1,.14);}
}

// A hand-built rowboat, with a planked open hull and a stretched linen canopy.
const boat=new THREE.Group();boat.position.set(3,.07,10);boat.rotation.y=-.52;world.add(boat);
const hullGeo=new THREE.BufferGeometry(),hullPos=[],hullUV=[],hullIdx=[];
const hullN=40,hullM=16;
function hullPoint(t,a){const fullness=Math.pow(Math.sin(Math.PI*t),.62),w=1.16*fullness;return V(w*Math.sin(a),.5-.85*Math.cos(a)*Math.pow(fullness,.5)+.18*Math.pow(Math.abs(t-.5)*2,3), (t-.5)*6.1);}
for(let i=0;i<=hullN;i++)for(let j=0;j<=hullM;j++){const p=hullPoint(.004+.992*i/hullN,-Math.PI/2+Math.PI*j/hullM);hullPos.push(p.x,p.y,p.z);hullUV.push(i/hullN*5,j/hullM);if(i<hullN&&j<hullM){const k=i*(hullM+1)+j;hullIdx.push(k,k+1,k+hullM+2,k,k+hullM+2,k+hullM+1);}}
hullGeo.setAttribute('position',new THREE.Float32BufferAttribute(hullPos,3));hullGeo.setAttribute('uv',new THREE.Float32BufferAttribute(hullUV,2));hullGeo.setIndex(hullIdx);hullGeo.computeVertexNormals();
const woodTexture=canvasTexture(256,(c,n)=>{c.fillStyle='#8b6541';c.fillRect(0,0,n,n);for(let i=0;i<400;i++){c.strokeStyle=`rgba(45,30,17,${rand(.04,.2)})`;c.lineWidth=rand(.3,1);c.beginPath();const y=rand(0,n);c.moveTo(0,y);c.bezierCurveTo(60,y+rand(-3,3),190,y+rand(-3,3),256,y+rand(-2,2));c.stroke();}for(let i=0;i<8;i++){c.fillStyle='#453523';c.fillRect(0,i*32,n,1);}});
const hullMat=std('#b38c62',{map:woodTexture,side:THREE.DoubleSide,roughness:.68});addMesh(hullGeo,hullMat,boat);
for(let i=0;i<2;i++){
 const points=[];for(let j=0;j<=50;j++)points.push(hullPoint(.005+.99*j/50,i===0?-Math.PI/2:Math.PI/2));addMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),60,.055,6,false),trimMat,boat);
}
for(let j=0;j<8;j++){
 const a=-1.4+j*.4,pts=[];for(let i=0;i<=40;i++)pts.push(hullPoint(.015+.97*i/40,a));addMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),40,.012,3,false),trimMat,boat);
}
for(let i=0;i<9;i++){const z=(i-4)*.5,w=1.5*Math.pow(1-Math.pow(z/2.7,2),.6);const m=addMesh(new THREE.BoxGeometry(w,.09,.47),woodMat,boat,0,-.02,z);}
for(const z of [-1.9,.05,1.8])addMesh(new THREE.BoxGeometry(z===.05?1.94:1.48,.15,.41),hullMat,boat,0,.42,z);
const canopyTexture=canvasTexture(128,(c,n)=>{c.fillStyle='#ddaf55';c.fillRect(0,0,n,n);for(let i=0;i<8;i++){c.fillStyle=i%2?'#deb25c':'#e9c779';c.fillRect(i*16,0,16,n);}for(let i=0;i<1500;i++){c.fillStyle=`rgba(85,60,30,${rand(.02,.1)})`;c.fillRect(rand(0,n),rand(0,n),1,1);}});
const canopyMat=std('#f0c264',{map:canopyTexture,side:THREE.DoubleSide,roughness:.95});
const cp=[],cu=[],ci=[];
for(let i=0;i<=24;i++)for(let j=0;j<2;j++){const a=Math.PI*i/24,x=Math.cos(a)*1.03,y=2.04+Math.sin(a)*.56,z=j===0?-1.46:1.46;cp.push(x,y,z);cu.push(i/24,j);if(i<24&&j===0){const k=i*2;ci.push(k,k+1,k+3,k,k+3,k+2);}}
const cg=new THREE.BufferGeometry();cg.setAttribute('position',new THREE.Float32BufferAttribute(cp,3));cg.setAttribute('uv',new THREE.Float32BufferAttribute(cu,2));cg.setIndex(ci);cg.computeVertexNormals();addMesh(cg,canopyMat,boat);
for(const z of [-1.46,1.46]){
 for(const x of [-.91,.91])segment(V(x,.48,z),V(x,2.13,z),.037,.037,trimMat,boat);
 const pts=[];for(let i=0;i<=24;i++){const a=i*Math.PI/24;pts.push(V(Math.cos(a)*1.03,2.04+Math.sin(a)*.56,z));}
 addMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),24,.034,6,false),brassMat,boat);
 for(let i=0;i<12;i++){const a=(i+.5)*Math.PI/12,m=addMesh(new THREE.SphereGeometry(.13,8,6,0,TAU,0,Math.PI/2),canopyMat,boat,Math.cos(a)*1.03,2.025+Math.sin(a)*.56,z);m.scale.set(.95,.72,.2);m.rotation.z=Math.PI;}
}
const boatOars=[];
for(const side of [-1,1]){
 const shaft=segment(V(side*.95,.55,-.2),V(side*2.1,.08,1.45),.035,.045,hullMat,boat);
 const oar=addMesh(new THREE.SphereGeometry(1,12,8),hullMat,boat,side*2.1,.06,1.45);oar.scale.set(.15,.035,.45);oar.rotation.y=side*-.5;
 const pivot=new THREE.Group();pivot.position.set(side*.95,.55,-.2);shaft.geometry.translate(-pivot.position.x,-pivot.position.y,-pivot.position.z);oar.position.sub(pivot.position);boat.remove(shaft,oar);pivot.add(shaft,oar);boat.add(pivot);boatOars.push({pivot,side});
}
const cushion=addMesh(new THREE.SphereGeometry(1,16,10),std('#d4c7a2'),boat,0,.62,-.2);cushion.scale.set(.55,.12,.3);

function lantern(x,y,z,parent=world,scale=1,pole=true){
 const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(scale);parent.add(g);
 if(pole){addMesh(new THREE.CylinderGeometry(.065,.11,3.5,8),trimMat,g,0,1.75,0);segment(V(0,3.48,0),V(.5,3.48,0),.06,.06,trimMat,g);}
 const yy=pole?3.1:0,xx=pole?.5:0;
 const lamp=addMesh(new THREE.SphereGeometry(.24,12,12),glowMat,g,xx,yy,0);lamp.scale.set(1,1.4,1);
 addMesh(new THREE.ConeGeometry(.37,.23,4),trimMat,g,xx,yy+.38,0).rotation.y=Math.PI/4;
 addMesh(new THREE.CylinderGeometry(.27,.27,.09,8),brassMat,g,xx,yy-.36,0);
 for(let i=0;i<4;i++){const a=i*TAU/4;segment(V(xx+Math.cos(a)*.2,yy-.31,Math.sin(a)*.2),V(xx+Math.cos(a)*.2,yy+.31,Math.sin(a)*.2),.014,.014,brassMat,g);}
 const light=new THREE.PointLight('#ffbc65',0,13,1.6);light.position.set(xx,yy,0);if(!mobile||lanterns.length<6)g.add(light);
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:haloTexture,color:'#ffcb79',transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0}));sprite.position.set(xx,yy,0);sprite.scale.setScalar(3);g.add(sprite);
 if(parent===world){
  g.updateMatrixWorld(true);
  for(const child of [...g.children])if(child.isMesh){const transformed=child.geometry.clone().applyMatrix4(child.matrixWorld);batch(transformed,child.material);transformed.dispose();child.geometry.dispose();g.remove(child);}
 }
 lanterns.push({g,light,lamp,sprite});return g;
}
const haloTexture=canvasTexture(64,(c,n)=>{const g=c.createRadialGradient(n/2,n/2,0,n/2,n/2,n/2);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.1,'rgba(255,240,190,.8)');g.addColorStop(.3,'rgba(255,220,170,.18)');g.addColorStop(1,'rgba(255,220,170,0)');c.fillStyle=g;c.fillRect(0,0,n,n);});
lantern(0,1.1,2.5,boat,.7,false);lantern(0,2.15,.5,pavilion,.9,false);
for(const [x,z] of [[-19.7,16],[21,13.7],[-21,-9],[21,-9],[-21,-32],[25,-38],[35,12],[37,-21]])lantern(x,.8,z,world,1,true);

// Lily pads have an actual notch and delicate radial veins.
const lilyShape=new THREE.Shape();lilyShape.moveTo(0,0);for(let i=0;i<=44;i++){const a=.18+(TAU-.36)*i/44;lilyShape.lineTo(Math.cos(a),Math.sin(a));}lilyShape.closePath();
const lilyGeo=new THREE.ShapeGeometry(lilyShape,12);lilyGeo.rotateX(-Math.PI/2);
const lilyMats=['#477750','#538658','#326d4b','#69935a'].map(c=>std(c,{side:THREE.DoubleSide}));
const veinMat=new THREE.LineBasicMaterial({color:'#a0b377',transparent:true,opacity:.3});
const lotusPetalGeo=new THREE.SphereGeometry(1,8,6),lotusPollenGeo=new THREE.SphereGeometry(.09,8,6),pollenMat=std('#edc36d');
function lotus(x,z,s=1){
 for(let layer=0;layer<3;layer++)for(let k=0;k<8;k++){
  const a=k*TAU/8+layer*.3;
  batch(lotusPetalGeo,flowerMat,x+Math.cos(a)*(.19-layer*.05)*s,.08+(.13+layer*.08)*s,z+Math.sin(a)*(.19-layer*.05)*s,.11*s,(.10+layer*.015)*s,(.27-layer*.06)*s,Math.cos(a)*-.4,a,Math.sin(a)*.4);
 }
 batch(lotusPollenGeo,pollenMat,x,.08+.34*s,z,s,s,s);
}
const lilyClusters=[[-10,26,6,4],[14,19,5,5],[-12,0,4,6],[13,-6,5,3],[-17,-24,3,3],[14,-29,6,5],[8,32,5,3],[-4,-43,5,3]];
for(const [x,z,rx,rz] of lilyClusters)for(let i=0;i<rand(12,21);i++){
 const a=rand(0,TAU),r=Math.sqrt(rand()),xx=x+Math.cos(a)*r*rx,zz=z+Math.sin(a)*r*rz,s=rand(.28,.69),rot=rand(0,TAU);
 batch(lilyGeo,pick(lilyMats),xx,.035+rand(0,.025),zz,s,1,s,0,rot,0);
 if(i%5===0)lotus(xx+.22,zz+.2,rand(.6,1));
}
finishBatches();

// The mountains are continuous, smooth terrain surfaces, fading into aerial perspective.
for(let layer=0;layer<4;layer++){
 const g=new THREE.PlaneGeometry(480,105,160,32);g.rotateX(-Math.PI/2);
 const p=g.attributes.position,colors=[];const col=new THREE.Color(['#476c65','#5b817c','#78938b','#8ca4a0'][layer]);
 const peaks=[[-150,34+layer*5,27],[-83,57+layer*6,30],[-28,39+layer*9,21],[43,64+layer*7,35],[114,49+layer*9,36],[177,30+layer*4,24]];
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),zz=p.getZ(i),t=(zz+52.5)/105;let y=0;
  for(const [c,h,w] of peaks)y+=h*Math.exp(-Math.pow((x-c-layer*12)/w,2));
  const ridged=1+.07*Math.sin(x*.22+zz*.08)+.035*Math.sin(x*.71-zz*.19);
  y=y*ridged*Math.pow(Math.sin(Math.PI*t),1.4)-7;
  p.setY(i,y);const c=col.clone().multiplyScalar(.8+Math.min(y/110,.25)+rand(0,.02));colors.push(c.r,c.g,c.b);
 }
 g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();const m=addMesh(g,std('#ffffff',{vertexColors:true}),scene,0,-2,-122-layer*75);m.castShadow=false;
}

const skyUniforms={top:{value:new THREE.Color('#789eae')},bottom:{value:new THREE.Color('#e6cda3')},sunDir:{value:V(-.42,.32,-.7).normalize()},sunColor:{value:new THREE.Color('#ffe7af')},sunPower:{value:1},time:{value:0},night:{value:0},cloud:{value:.25}};
const skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:skyUniforms,
vertexShader:`varying vec3 vWorld;void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
fragmentShader:`varying vec3 vWorld;uniform vec3 top,bottom,sunDir,sunColor;uniform float sunPower,time,night,cloud;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
void main(){vec3 d=normalize(vWorld-cameraPosition);float h=max(d.y,0.);vec3 c=mix(bottom,top,pow(h,.5));float sd=max(0.,dot(d,sunDir));float glow=pow(sd,18.)*.16+pow(sd,90.)*.25;float disk=smoothstep(.99973,.9999,sd)*2.9;c+=sunColor*(glow+disk)*sunPower;
vec2 uv=d.xz/max(.12,d.y+.32)*2.5;uv.x+=time*.003;float n=noise(uv)*.5+noise(uv*2.1)*.3+noise(uv*4.3)*.2;float cl=smoothstep(.47,.82,n)*smoothstep(0.,.25,d.y)*cloud;c=mix(c,mix(bottom,vec3(.92),.28)*(1.-night*.75),cl*.38);gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`});
const sky=new THREE.Mesh(new THREE.SphereGeometry(500,32,20),skyMaterial);sky.renderOrder=-10;sky.frustumCulled=false;scene.add(sky);
const hemi=new THREE.HemisphereLight('#d6e9ed','#61745a',2);scene.add(hemi);
const ambient=new THREE.AmbientLight('#c3d1c3',.22);scene.add(ambient);
const sun=new THREE.DirectionalLight('#ffe5b6',3.5);sun.position.set(-40,58,-48);sun.castShadow=true;sun.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);sun.shadow.camera.left=-65;sun.shadow.camera.right=65;sun.shadow.camera.top=65;sun.shadow.camera.bottom=-65;sun.shadow.camera.near=.5;sun.shadow.camera.far=200;sun.shadow.bias=-.0003;sun.shadow.normalBias=.09;sun.shadow.radius=3;scene.add(sun);sun.target.position.set(0,0,-9);scene.add(sun.target);
const moonLight=new THREE.DirectionalLight('#9dbbdd',0);moonLight.position.set(18,40,-38);scene.add(moonLight);

const normalSize=256,normalData=new Uint8Array(normalSize*normalSize*4);
for(let y=0;y<normalSize;y++)for(let x=0;x<normalSize;x++){
 const a=TAU*x/normalSize,b=TAU*y/normalSize,nx=Math.sin(a*5+b*2)*4+Math.cos(a*3-b*7)*3+Math.sin(a*14+b*11)*1.5,ny=Math.cos(b*6+a*3)*4+Math.sin(b*3-a*8)*3+Math.cos(a*9+b*13)*1.5;
 const i=(y*normalSize+x)*4;normalData[i]=128+nx;normalData[i+1]=128+ny;normalData[i+2]=254;normalData[i+3]=255;
}
const normalMap=new THREE.DataTexture(normalData,normalSize,normalSize,THREE.RGBAFormat);normalMap.wrapS=normalMap.wrapT=THREE.RepeatWrapping;normalMap.magFilter=THREE.LinearFilter;normalMap.minFilter=THREE.LinearMipmapLinearFilter;normalMap.generateMipmaps=true;normalMap.needsUpdate=true;
const water=new Water(new THREE.PlaneGeometry(1600,1600),{textureWidth:mobile?768:1536,textureHeight:mobile?768:1536,waterNormals:normalMap,sunDirection:skyUniforms.sunDir.value.clone(),sunColor:'#ffe0a4',waterColor:'#378e85',distortionScale:1.15,fog:true});
water.rotation.x=-Math.PI/2;water.position.y=0;water.material.uniforms.size.value=5.6;
water.material.fragmentShader=water.material.fragmentShader.replace('float rf0 = 0.3;','float rf0 = 0.48;').replace('( vec3( 0.1 ) + reflectionSample * 0.9 + reflectionSample * specularLight )','( reflectionSample * 1.02 + reflectionSample * specularLight )');
scene.add(water);

// A few broad, low drifting veils make the water feel humid without hiding its mirror.
const mistUniforms=[];
for(let i=0;i<8;i++){
 const u={time:{value:0},opacity:{value:.1},tint:{value:new THREE.Color('#cfdbcb')},offset:{value:rand(0,100)}};mistUniforms.push(u);
 const m=new THREE.Mesh(new THREE.PlaneGeometry(80+rand(0,45),18+rand(0,15)),new THREE.ShaderMaterial({uniforms:u,transparent:true,depthWrite:false,side:THREE.DoubleSide,
 vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`varying vec2 vUv;uniform float time,opacity,offset;uniform vec3 tint;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}void main(){vec2 uv=vUv;float edge=pow(sin(uv.x*3.14159)*sin(uv.y*3.14159),2.);float n=noise(uv*vec2(8.,3.)+vec2(time*.017,offset));n=n*.65+noise(uv*vec2(17.,8.)-time*.01+offset)*.35;gl_FragColor=vec4(tint,edge*n*opacity);}`
 }));m.rotation.x=-Math.PI/2;m.position.set(rand(-12,12),.45+i*.53,-12-i*13);m.renderOrder=4;world.add(m);
}
const rayUniforms=[],shafts=[];
for(let i=0;i<7;i++){
 const u={time:{value:0},power:{value:.04},color:{value:new THREE.Color('#ffdc95')},phase:{value:rand(0,10)}};rayUniforms.push(u);
 const source=V(-43+rand(-4,4),65,-67),end=V(-6+i*6,0,-22+rand(-12,14)),dir=source.clone().sub(end),length=dir.length();
 const m=new THREE.Mesh(new THREE.PlaneGeometry(rand(2,5),length),new THREE.ShaderMaterial({uniforms:u,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
 vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`varying vec2 vUv;uniform float time,power,phase;uniform vec3 color;void main(){float a=pow(sin(vUv.x*3.141592),2.)*pow(sin(vUv.y*3.141592),.8);float n=.84+.16*sin(vUv.y*47.+time*.13+phase);gl_FragColor=vec4(color,a*power*n);}`
 }));m.position.copy(source.clone().add(end).multiplyScalar(.5));m.userData.axis=dir.normalize();world.add(m);shafts.push(m);
}

const starPos=[];for(let i=0;i<1300;i++){const a=rand(0,TAU),y=rand(.12,1),r=Math.sqrt(1-y*y);starPos.push(Math.cos(a)*r*330,y*330,Math.sin(a)*r*330);}
const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPos,3));
const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({size:.75,color:'#deeaff',transparent:true,opacity:0,sizeAttenuation:true,depthWrite:false,fog:false}));scene.add(stars);
const moon=addMesh(new THREE.SphereGeometry(3,24,16),new THREE.MeshBasicMaterial({color:'#dbe6d7',transparent:true,opacity:0}),scene,72,105,-228);moon.castShadow=false;

const petalCount=mobile?260:530,petalStates=[];
const petalMesh=new THREE.InstancedMesh(new THREE.SphereGeometry(1,5,4),std('#f7bdcc',{side:THREE.DoubleSide}),petalCount);petalMesh.castShadow=false;world.add(petalMesh);
for(let i=0;i<petalCount;i++){const tree=pick(blossomDrift);petalStates.push({tree,fall:rand(15,35),cycle:rand(38,65),offset:rand(0,65),a:rand(0,TAU),r:rand(.1,tree.r),speed:rand(.04,.1),s:rand(.035,.075)});}

const firePos=[];for(let i=0;i<(mobile?100:220);i++)firePos.push(rand(-25,28),rand(.3,6),rand(-40,27));
const fireGeo=new THREE.BufferGeometry();fireGeo.setAttribute('position',new THREE.Float32BufferAttribute(firePos,3));
const fireUniforms={time:{value:0},opacity:{value:0},pixelRatio:{value:Math.min(devicePixelRatio,2)}};
const fireflies=new THREE.Points(fireGeo,new THREE.ShaderMaterial({uniforms:fireUniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
 vertexShader:`uniform float time,pixelRatio;varying float vGlow;void main(){vec3 p=position;p.x+=sin(time*.22+p.z)*.8;p.y+=sin(time*.5+p.x)*.4;p.z+=cos(time*.25+p.x)*.6;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(85./-mv.z,1.2,5.)*pixelRatio;vGlow=.4+.6*pow(sin(time*1.3+position.x*2.)*.5+.5,2.);}`,
 fragmentShader:`uniform float opacity;varying float vGlow;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(1.,.88,.45,pow(1.-d,2.)*vGlow*opacity);}`
}));world.add(fireflies);

const rainCount=mobile?1700:3500,rainArray=new Float32Array(rainCount*6),rainSpeed=[];
for(let i=0;i<rainCount;i++){rainArray[i*6]=rand(-65,65);rainArray[i*6+1]=rand(0,50);rainArray[i*6+2]=rand(-65,50);rainSpeed.push(rand(13,22));}
const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(rainArray,3));
const rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:'#b9d0d3',transparent:true,opacity:0,depthWrite:false}));rain.visible=false;world.add(rain);
const rippleMat=new THREE.MeshBasicMaterial({color:'#abcfc4',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
for(let i=0;i<(mobile?28:55);i++){const m=new THREE.Mesh(new THREE.RingGeometry(.93,1,32),rippleMat.clone());m.rotation.x=-Math.PI/2;m.position.set(rand(-24,24),.025,rand(-35,32));world.add(m);ripples.push({m,offset:rand(0,5),period:rand(1.2,2.3)});}

const birdMat=std('#303f3a',{side:THREE.DoubleSide});
for(let i=0;i<9;i++){
 const g=new THREE.Group();world.add(g);const wings=[];
 for(const side of [-1,1]){
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,side*1.1,.06,-.12,side*.55,-.03,.25],3));geo.computeVertexNormals();const m=addMesh(geo,birdMat,g);wings.push(m);
 }
 birds.push({g,wings,phase:rand(0,TAU),speed:rand(.012,.022),radius:rand(22,50),height:rand(21,32)});
}

// Renderer-independent build checks may stop here, after inspecting the complete world.
if(globalThis.__GARDEN_QA__){globalThis.__gardenWorld={scene,world,camera,boat,water,lanterns,birds,petalMesh,petalStates,skyUniforms};}

function startExperience(){
 let renderer,composer,bloom,controls;
 try{
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.5:1.8));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;renderer.outputColorSpace=THREE.SRGBColorSpace;
  $('#world').appendChild(renderer.domElement);
  controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,3,-7);controls.enableDamping=true;controls.dampingFactor=.055;controls.minDistance=3;controls.maxDistance=175;controls.maxPolarAngle=Math.PI*.62;controls.minPolarAngle=.13;controls.panSpeed=.75;controls.rotateSpeed=.42;controls.zoomSpeed=.65;controls.enablePan=true;controls.screenSpacePanning=false;
  composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.32,.7,1.05);composer.addPass(bloom);
  const grade=new ShaderPass({uniforms:{tDiffuse:{value:null},time:{value:0}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D tDiffuse;uniform float time;varying vec2 vUv;void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;vec2 p=vUv-.5;float vig=1.-smoothstep(.18,.72,length(p))*.17;c*=vig;float grain=fract(sin(dot(vUv+time*.001,vec2(12.9898,78.233)))*43758.5453)-.5;c+=grain*.0015;gl_FragColor=vec4(c,1.);}`});composer.addPass(grade);composer.addPass(new OutputPass());
  initializeInteraction(renderer,composer,bloom,controls,grade);
 }catch(err){showError(err);}
}

function showError(err){console.error(err);$('.loading-emblem').style.display='none';$('#loading-note').textContent='This garden needs WebGL 2.';$('#error').style.display='block';$('#error').textContent='Please open this scene in an up-to-date Safari, Chrome, Firefox, or Edge with hardware acceleration enabled. '+(err?.message||'');}

const environmentPresets={
 Morning:{top:'#8bb1c5',bottom:'#d4ded4',fog:'#b5ccc6',water:'#40978e',sun:'#f7e9ca',hemi:'#d2e8ec',ground:'#697b5e',sunPower:1.8,hemiPower:1.8,moon:0,exposure:1.01,density:.0105,mist:.22,rays:.012,rain:0,night:0,cloud:.35,bloom:.24,sunDir:[-.48,.4,-.75],label:'Morning mist',roman:'I.',poem:'A quiet beginning.<br>The water remembers the sky.'},
 Day:{top:'#78b6d3',bottom:'#d0e4da',fog:'#b0cdc6',water:'#399e94',sun:'#fff5db',hemi:'#d1e9f0',ground:'#6c7959',sunPower:3.3,hemiPower:2.2,moon:0,exposure:1,density:.0058,mist:.045,rays:.004,rain:0,night:0,cloud:.18,bloom:.20,sunDir:[-.36,.83,-.48],label:'Clear daylight',roman:'II.',poem:'Old stones, new blossoms.<br>Nothing here is in a hurry.'},
 Rain:{top:'#627b89',bottom:'#9eb6b3',fog:'#8ba9a6',water:'#336e6c',sun:'#cad9d9',hemi:'#b8cdd3',ground:'#536c59',sunPower:.45,hemiPower:1.5,moon:0,exposure:.95,density:.012,mist:.27,rays:0,rain:1,night:0,cloud:1,bloom:.21,sunDir:[-.4,.8,-.4],label:'Passing rain',roman:'III.',poem:'A thousand small circles.<br>The garden listens to the rain.'},
 Golden:{top:'#7b9fae',bottom:'#e3c69d',fog:'#b9c6b5',water:'#3e9486',sun:'#ffd196',hemi:'#d5ddd0',ground:'#6d7653',sunPower:3.4,hemiPower:1.7,moon:0,exposure:.96,density:.007,mist:.14,rays:.037,rain:0,night:0,cloud:.26,bloom:.34,sunDir:[-.48,.37,-.75],label:'Golden hour',roman:'IV.',poem:'The last light lingers<br>where the garden meets the sky.'},
 Night:{top:'#040e1c',bottom:'#253a4b',fog:'#1d3343',water:'#173b42',sun:'#9cafcb',hemi:'#8daacb',ground:'#263a35',sunPower:.035,hemiPower:.32,moon:.8,exposure:1.05,density:.008,mist:.075,rays:0,rain:0,night:1,cloud:.15,bloom:.66,sunDir:[.32,.7,-.6],label:'Lantern light',roman:'V.',poem:'One lantern, then another.<br>A constellation on the water.'}
};

const exampleLakeWords='agua | water\nbarco | boat\nflor | flower\npuente | bridge\nárbol | tree\nlago | lake\nfarol | lantern\nmontaña | mountain\npájaro | bird\ncielo | sky\njardín | garden\nnoche | night';

function parseLakeWords(text,learningLanguage='es',primaryLanguage='en'){
 let data,rows;const clean=String(text).trim();if(!clean)throw Error('Add at least one word to the lake.');
 if(clean.startsWith('{')||clean.startsWith('[')){
  try{data=JSON.parse(clean);}catch{throw Error('The JSON could not be read. Check its commas and quotation marks.');}
  rows=Array.isArray(data)?data:data.words;
  if(!Array.isArray(rows))throw Error('The JSON needs a words array.');
  learningLanguage=data.learningLanguage||learningLanguage;primaryLanguage=data.primaryLanguage||primaryLanguage;
 }else rows=clean.split(/\r?\n/).filter(line=>line.trim()&&!/^\s*(words|phrases):?\s*$/i.test(line)).map(line=>{
  const [word,translation='',sentence='',sentenceTranslation='']=line.split(/\t|\s*\|\s*/);return {word,translation,sentence,sentenceTranslation};
 });
 if(rows.length>500)throw Error('Please use 500 words or fewer per voyage.');
 const words=rows.map((r,i)=>{if(typeof r==='string')r={word:r};if(!r||typeof r.word!=='string')throw Error(`Word ${i+1} needs a word field.`);const word=r.word.trim();if(!word||word.length>300)throw Error(`Word ${i+1} must contain 1–300 characters.`);return {id:String(r.id??i+1),word,translation:String(r.translation??'').trim().slice(0,500),sentence:String(r.sentence??'').trim().slice(0,1000),sentenceTranslation:String(r.sentenceTranslation??'').trim().slice(0,1000)};});
 if(!words.length)throw Error('Add at least one word to the lake.');
 try{learningLanguage=Intl.getCanonicalLocales(String(learningLanguage).trim())[0];primaryLanguage=Intl.getCanonicalLocales(String(primaryLanguage).trim())[0];if(!learningLanguage||!primaryLanguage)throw Error();}catch{throw Error('Use language codes such as es, ja, en, or zh-CN.');}
 return {words,learningLanguage,primaryLanguage};
}

// A conservative hull-sized corridor keeps the boat away from shore and low masonry.
function boatCanNavigate(x,z){return Number.isFinite(x)&&Number.isFinite(z)&&Math.abs(x)<=14.5&&z>=-30&&z<=35&&(!(z>-17.6&&z<-6.4)||Math.abs(x)<=12.2);}

function createBoatLearning(renderer,controls,hooks){
 let payload=parseLakeWords(exampleLakeWords),active=false,following=true,speed=0,heading=boat.rotation.y,progress=0,lastWord=null,voicePaused=false,dialogOpen=false;
 let voiceToken=0,voiceTimer=null,utterance=null,nearest=null,hudTick=0,pointerId=null;
 const input={steer:0,throttle:0},markers=[],collected=[],wordRoot=new THREE.Group();wordRoot.name='Floating lake vocabulary';world.add(wordRoot);
 const ringGeometry=new THREE.TorusGeometry(.86,.025,6,48),ringMaterial=new THREE.MeshBasicMaterial({color:'#efcd88',toneMapped:false,transparent:true,opacity:.83});
 const spotGeometry=new THREE.RingGeometry(.92,1.07,40),spotMaterial=new THREE.MeshBasicMaterial({color:'#c9bb80',transparent:true,opacity:.17,side:THREE.DoubleSide,depthWrite:false});
 const wakes=[],wakeGeo=new THREE.RingGeometry(.93,1,40);let wakeClock=0,wakeIndex=0;
 for(let i=0;i<10;i++){const mesh=new THREE.Mesh(wakeGeo,new THREE.MeshBasicMaterial({color:'#c2d9c3',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.y=.028;world.add(mesh);wakes.push({mesh,age:3,power:0});}
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let tapStart=null;
 try{const saved=localStorage.getItem('flooded-garden-words-v1');if(saved)payload=parseLakeWords(saved);}catch{}
 $('#word-input').value=payload.words.map(w=>[w.word,w.translation,w.sentence,w.sentenceTranslation].join(' | ').replace(/( \| )+$/,'')).join('\n');$('#learning-language').value=payload.learningLanguage;$('#primary-language').value=payload.primaryLanguage;

 function save(){try{localStorage.setItem('flooded-garden-words-v1',JSON.stringify(payload));}catch{}}
 function clearVoice(){voiceToken++;clearTimeout(voiceTimer);voiceTimer=null;if(window.speechSynthesis)window.speechSynthesis.cancel();utterance=null;}
 function speakWord(word,loop=true){
  clearVoice();if(!word||voicePaused||!active||document.hidden)return;
  const synth=window.speechSynthesis,Utterance=window.SpeechSynthesisUtterance;
  if(!synth||!Utterance){$('#voice-status').textContent='Pronunciation is unavailable in this browser.';return;}
  const token=voiceToken;
  function say(){
   if(token!==voiceToken||voicePaused||!active||dialogOpen||document.hidden)return;
   synth.resume();utterance=new Utterance(word.word);utterance.lang=payload.learningLanguage;utterance.rate=.86;
   const voices=synth.getVoices(),tag=payload.learningLanguage.toLowerCase(),base=tag.split('-')[0];const voice=voices.find(v=>v.lang.toLowerCase()===tag)||voices.find(v=>v.lang.toLowerCase().split('-')[0]===base);if(voice)utterance.voice=voice;
   utterance.onstart=()=>{if(token===voiceToken)$('#voice-status').textContent=loop?'Listening · repeats until the next word':'Listening…';};
   utterance.onend=()=>{if(token!==voiceToken)return;if(loop&&!voicePaused)voiceTimer=setTimeout(say,1400);else $('#voice-status').textContent='Tap Listen to hear it again.';};
   utterance.onerror=()=>{if(token===voiceToken)$('#voice-status').textContent='Tap Listen to hear this word.';};
   $('#voice-status').textContent='Tap Listen if automatic speech is quiet.';synth.speak(utterance);
  }say();
 }
 function updateCount(){ $('#voyage-count').textContent=`${collected.length} / ${payload.words.length} words collected`;$('#open-basket').textContent=`Basket · ${collected.length}`; }
 function disposeMarker(marker){wordRoot.remove(marker.root);marker.label.material.map.dispose();marker.label.material.dispose();}
 function clearMarkers(){for(const m of markers)disposeMarker(m);markers.length=0;nearest=null;}
 function pointForWord(){
  let candidate;
  for(let k=0;k<180;k++){
   candidate=V(rand(-14.7,14.7),.11,rand(-28.5,33.5));
   if(boatCanNavigate(candidate.x,candidate.z)&&!(candidate.z>-18.5&&candidate.z<-5.4)&&Math.hypot(candidate.x-boat.position.x,candidate.z-boat.position.z)>5&&markers.every(m=>Math.hypot(m.root.position.x-candidate.x,m.root.position.z-candidate.z)>5.1))return candidate;
  }
  // Deterministic open-water grid is a fallback for a dense word list.
  for(const z of [32,24,16,8,0,-23,-29])for(const x of [-14,-7,0,7,14])if(boatCanNavigate(x,z)&&markers.every(m=>Math.hypot(m.root.position.x-x,m.root.position.z-z)>4.2))return V(x,.11,z);
  return candidate;
 }
 function makeMarker(word,index){
  const root=new THREE.Group();root.position.copy(pointForWord());root.userData.wordIndex=index;
  const ring=new THREE.Mesh(ringGeometry,ringMaterial);ring.rotation.x=Math.PI/2;ring.position.y=.025;root.add(ring);
  const spot=new THREE.Mesh(spotGeometry,spotMaterial);spot.rotation.x=-Math.PI/2;spot.position.y=-.05;root.add(spot);
  const c=document.createElement('canvas');c.width=512;c.height=144;const ctx=c.getContext('2d');
  ctx.fillStyle='rgba(16,51,44,.9)';ctx.strokeStyle='rgba(234,205,148,.8)';ctx.lineWidth=2;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(5,12,502,116,25);else ctx.rect(5,12,502,116);ctx.fill();ctx.stroke();
  let fontSize=43;ctx.font=`${fontSize}px sans-serif`;while(ctx.measureText(word.word).width>460&&fontSize>11){fontSize--;ctx.font=`${fontSize}px sans-serif`;}
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f6e8c1';ctx.direction=/^(ar|he|fa|ur)(-|$)/.test(payload.learningLanguage)?'rtl':'ltr';ctx.fillText(word.word,256,72,460);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
  const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false}));label.position.y=1.13;label.scale.set(4.8,1.35,1);label.userData.wordIndex=index;root.add(label);wordRoot.add(root);markers.push({root,label,ring,word,index,phase:rand(0,TAU)});
 }
 function fillMarkers(){while(markers.length<Math.min(12,payload.words.length-collected.length)&&progress<payload.words.length){makeMarker(payload.words[progress],progress);progress++;}}
 function showWord(word){$('#learned-word').textContent=word.word;$('#learned-translation').textContent=$('#show-translations').checked?word.translation:'Translation hidden';}
 function collect(marker){
  const i=markers.indexOf(marker);if(i<0)return;markers.splice(i,1);disposeMarker(marker);collected.push(marker.word);lastWord=marker.word;showWord(lastWord);updateCount();speakWord(lastWord,true);fillMarkers();
  if(collected.length===payload.words.length){$('#target-distance').textContent='All words collected. Open the basket to review or explore again.';$('#nearest-word').textContent='A beautiful voyage!';}
 }
 function reset(){clearVoice();speed=0;input.steer=input.throttle=0;progress=0;collected.length=0;lastWord=null;clearMarkers();fillMarkers();updateCount();$('#learned-word').textContent='A lake full of words';$('#learned-translation').textContent='Reach a golden marker to collect its word.';}
 function start(){
  hooks.prepare();active=true;following=true;speed=0;wordRoot.visible=true;document.body.classList.add('boat-mode');$('#follow-boat').setAttribute('aria-pressed','true');if(!markers.length&&!collected.length)reset();
  $('#voice-status').textContent='Reach a word, or tap Listen to hear the nearest one.';if(markers.length)speakWord(markers[0].word,false);
 }
 function leave(){active=false;stop();clearVoice();wordRoot.visible=false;for(const w of wakes)w.mesh.material.opacity=0;for(const o of boatOars)o.pivot.rotation.set(0,0,0);document.body.classList.remove('boat-mode');hooks.leave();}
 function stop(){speed=0;input.steer=input.throttle=0;hooks.clearKeys();if(pointerId!==null){const id=pointerId;pointerId=null;if(stick.hasPointerCapture?.(id))stick.releasePointerCapture(id);}$('#joystick-thumb').style.transform='';}
 function openDialog(which){stop();clearVoice();dialogOpen=true;$('#'+which+'-dialog').hidden=false;if(which==='basket')renderBasket();else $('#word-input').focus();}
 function closeDialog(which){$('#'+which+'-dialog').hidden=true;dialogOpen=false;if(active&&lastWord&&!voicePaused)speakWord(lastWord,true);}
 function renderBasket(){
  $('#basket-summary').textContent=collected.length?`${collected.length} words collected. Tap a word to hear it again.`:'Your basket is empty. Row to a golden word marker to collect it.';$('#basket-list').replaceChildren();
  for(const word of collected){const li=document.createElement('li'),button=document.createElement('button'),translation=document.createElement('span');button.className='action';button.style.display='inline';button.textContent=word.word;button.dir='auto';button.addEventListener('click',()=>{const was=dialogOpen;dialogOpen=false;const paused=voicePaused;voicePaused=false;speakWord(word,false);voicePaused=paused;dialogOpen=was;});translation.textContent=word.translation;translation.dir='auto';li.append(button,translation);$('#basket-list').appendChild(li);}
 }
 function exportBasket(){
  const blob=new Blob([JSON.stringify({...payload,words:collected},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='GoLingo-Flooded-Garden-Words.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 $('#start-rowing').addEventListener('click',start);$('#edit-words').addEventListener('click',()=>openDialog('words'));$('#voyage-words').addEventListener('click',()=>openDialog('words'));$('#leave-rowing').addEventListener('click',leave);
 $('#close-words').addEventListener('click',()=>closeDialog('words'));$('#open-basket').addEventListener('click',()=>openDialog('basket'));$('#close-basket').addEventListener('click',()=>closeDialog('basket'));
 $('#apply-words').addEventListener('click',()=>{try{payload=parseLakeWords($('#word-input').value,$('#learning-language').value,$('#primary-language').value);$('#words-error').textContent='';$('#learning-language').value=payload.learningLanguage;$('#primary-language').value=payload.primaryLanguage;save();reset();$('#words-dialog').hidden=true;dialogOpen=false;start();}catch(err){$('#words-error').textContent=err.message;}});
 $('#sample-words').addEventListener('click',()=>{$('#word-input').value=exampleLakeWords;$('#learning-language').value='es';$('#primary-language').value='en';$('#words-error').textContent='';});
 $('#words-file').addEventListener('change',async ev=>{const file=ev.target.files[0];if(!file)return;if(file.size>64000){$('#words-error').textContent='Please choose a file smaller than 64 KB.';return;}try{$('#word-input').value=await file.text();$('#words-error').textContent='File ready. Start a new voyage to use these words.';}catch{$('#words-error').textContent='That file could not be read.';}ev.target.value='';});
 $('#restart-voyage').addEventListener('click',()=>{reset();closeDialog('basket');if(!active)start();});$('#export-basket').addEventListener('click',exportBasket);
 $('#stop-boat').addEventListener('click',stop);$('#follow-boat').addEventListener('click',()=>{following=true;$('#follow-boat').setAttribute('aria-pressed','true');});
 $('#listen-word').addEventListener('click',()=>{voicePaused=false;$('#pause-word').textContent='Pause voice';$('#pause-word').setAttribute('aria-pressed','false');speakWord(lastWord||nearest?.word||markers[0]?.word,!!lastWord);});
 $('#pause-word').addEventListener('click',()=>{voicePaused=!voicePaused;$('#pause-word').textContent=voicePaused?'Resume voice':'Pause voice';$('#pause-word').setAttribute('aria-pressed',String(voicePaused));if(voicePaused){clearVoice();$('#voice-status').textContent='Voice paused.';}else speakWord(lastWord||nearest?.word||markers[0]?.word,!!lastWord);});
 $('#show-translations').addEventListener('change',()=>{if(lastWord)showWord(lastWord);});
 const stick=$('#joystick');
 function stickMove(ev){if(ev.pointerId!==pointerId)return;const rect=stick.getBoundingClientRect(),r=rect.width*.37;let x=(ev.clientX-rect.left-rect.width/2)/r,y=(ev.clientY-rect.top-rect.height/2)/r;const length=Math.hypot(x,y);if(length>1){x/=length;y/=length;}input.steer=Math.abs(x)<.1?0:x;input.throttle=Math.abs(y)<.1?0:-y;$('#joystick-thumb').style.transform=`translate(${x*r}px,${y*r}px)`;ev.preventDefault();}
 stick.addEventListener('pointerdown',ev=>{pointerId=ev.pointerId;stick.setPointerCapture(pointerId);stickMove(ev);});stick.addEventListener('pointermove',stickMove);
 function releaseStick(ev){if(ev&&ev.pointerId!==pointerId)return;pointerId=null;input.steer=input.throttle=0;$('#joystick-thumb').style.transform='';}
 stick.addEventListener('pointerup',releaseStick);stick.addEventListener('pointercancel',releaseStick);stick.addEventListener('lostpointercapture',releaseStick);window.addEventListener('blur',()=>{releaseStick();speed=0;clearVoice();});
 renderer.domElement.addEventListener('pointerdown',ev=>{tapStart={x:ev.clientX,y:ev.clientY,t:performance.now()};});
 renderer.domElement.addEventListener('pointerup',ev=>{if(!active||!tapStart||Math.hypot(ev.clientX-tapStart.x,ev.clientY-tapStart.y)>8||performance.now()-tapStart.t>450)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((ev.clientX-rect.left)/rect.width*2-1,-(ev.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(markers.map(m=>m.label),false)[0];if(hit){const m=markers.find(m=>m.index===hit.object.userData.wordIndex);if(m){voicePaused=false;$('#pause-word').textContent='Pause voice';$('#pause-word').setAttribute('aria-pressed','false');speakWord(m.word,false);}}});
 function manualCamera(){if(active){following=false;$('#follow-boat').setAttribute('aria-pressed','false');}}
 function update(dt,t,keys){
  if(!active)return;
  const before=boat.position.clone();let steer=0,throttle=0;
  if(!dialogOpen){steer=input.steer+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);throttle=input.throttle+(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0);}
  const requested=THREE.MathUtils.clamp(throttle,-1,1)*(throttle<0?1.65:4.2);speed+=(requested-speed)*(1-Math.exp(-dt*(throttle?1.5:2.8)));heading-=THREE.MathUtils.clamp(steer,-1,1)*dt*(.72+Math.abs(speed)*.08);
  const dx=Math.sin(heading)*speed*dt,dz=Math.cos(heading)*speed*dt,nx=boat.position.x+dx,nz=boat.position.z+dz;
  if(boatCanNavigate(nx,nz)){boat.position.x=nx;boat.position.z=nz;}else {if(boatCanNavigate(nx,boat.position.z))boat.position.x=nx;if(boatCanNavigate(boat.position.x,nz))boat.position.z=nz;speed*=.5;}
  boat.rotation.y=heading;
  const power=Math.min(1,Math.abs(speed)/3.5);
  for(const oar of boatOars){oar.pivot.rotation.y=Math.sin(t*3.4)*.25*power*oar.side;oar.pivot.rotation.z=(Math.cos(t*3.4)*.08+.02)*power*oar.side;}
  wakeClock+=dt;if(Math.abs(speed)>.35&&wakeClock>.23){wakeClock=0;const w=wakes[wakeIndex++%wakes.length];w.age=0;w.power=power;w.mesh.position.set(boat.position.x-Math.sin(heading)*2.9,.028,boat.position.z-Math.cos(heading)*2.9);}
  for(const w of wakes){w.age+=dt;const s=.3+w.age*.8;w.mesh.scale.set(s*1.3,s*.6,1);w.mesh.material.opacity=Math.max(0,1-w.age/2.3)*w.power*.12;}
  if(following){const forward=V(Math.sin(heading),0,Math.cos(heading)),goal=boat.position.clone().addScaledVector(forward,-10);goal.y=5.2;camera.position.lerp(goal,1-Math.exp(-dt*2.6));const aim=boat.position.clone().addScaledVector(forward,3.5);aim.y=1.2;controls.target.lerp(aim,1-Math.exp(-dt*3));}else {const d=boat.position.clone().sub(before);camera.position.add(d);controls.target.add(d);}
  nearest=null;let distance=Infinity;
  for(const marker of [...markers]){marker.label.position.y=1.13+Math.sin(t*1.2+marker.phase)*.06;marker.ring.scale.setScalar(1+Math.sin(t+marker.phase)*.035);const d=Math.hypot(marker.root.position.x-boat.position.x,marker.root.position.z-boat.position.z);if(d<2.45&&!dialogOpen){collect(marker);continue;}if(d<distance){distance=d;nearest=marker;}}
  hudTick+=dt;if(hudTick>.12){hudTick=0;if(nearest){const diff=Math.atan2(Math.sin(Math.atan2(nearest.root.position.x-boat.position.x,nearest.root.position.z-boat.position.z)-heading),Math.cos(Math.atan2(nearest.root.position.x-boat.position.x,nearest.root.position.z-boat.position.z)-heading));$('#nearest-word').textContent=nearest.word.word;$('#target-distance').textContent=`${Math.round(distance)} m · ${Math.abs(diff)<.25?'↑ Ahead':Math.abs(diff)>2.65?'↶ Turn around':diff>0?'← Steer left':'→ Steer right'}`;}}
 }
 wordRoot.visible=false;
 const api={update,start,leave,manualCamera,isActive:()=>active,isDialogOpen:()=>dialogOpen,heading:()=>heading,closeDialog:()=>{if(!$('#words-dialog').hidden)closeDialog('words');if(!$('#basket-dialog').hidden)closeDialog('basket');},pause:()=>{stop();clearVoice();},resume:()=>{if(active&&lastWord&&!voicePaused)speakWord(lastWord,true);}};
 if(globalThis.__GARDEN_QA__)api.inspect=()=>({payload,markers,collected,speed,active,nearest,heading,wordRoot});
 return api;
}

function initializeInteraction(renderer,composer,bloom,controls,grade){
 const clock=new THREE.Clock();
 let currentEnvironment='Golden',environment=environmentPresets.Golden;
 const state={night:0,rain:0,mist:.14,rays:.037};
 let cameraName='Garden',cameraTransition=null,touring=false,tourTime=0,tourIndex=0,hiddenUI=false;
 let soundEnabled=false,audio=null,resizeTimer=null,firstFrame=true,qualityClock=0,slowFrames=0;
 const keys=new Set(),moving=V(),flatForward=V(),right=V(),previousBoat=boat.position.clone();
 const lesson=createBoatLearning(renderer,controls,{clearKeys:()=>keys.clear(),prepare:()=>{cameraTransition=null;stopTour();keys.clear();hiddenUI=false;document.querySelectorAll('.ui').forEach(el=>el.classList.remove('is-hidden'));$('#restore').style.display='none';cameraName='Boat';controls.autoRotate=false;},leave:()=>setCamera('Garden')});
 if(globalThis.__GARDEN_QA__)globalThis.__gardenWorld.lesson=lesson;
 const tourSequence=['Garden','Boat','Bridge','Waterline','Mountains','Aerial'];
 const iconPaths={
  sunrise:'<path d="M3 17h18M5 13h14M8 13a4 4 0 0 1 8 0M12 3v3M4.5 6.5l2 2m13-2-2 2M9 20h6"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  rain:'<path d="M6 14H5a4 4 0 0 1-.5-8 6 6 0 0 1 11.3-1A4.5 4.5 0 0 1 19 14h-1M8 15l-2 4m7-4-2 4m7-4-2 4"/>',sunset:'<path d="M3 17h18M5 13h14M8 13a4 4 0 0 1 8 0M12 2v4m-3-2 3 3 3-3M4 7l2 2m14-2-2 2M9 20h6"/>',moon:'<path d="M20.5 14.1A8.5 8.5 0 0 1 9.9 3.5 8.5 8.5 0 1 0 20.5 14.1Z"/>',
  play:'<path d="m8 5 10 7-10 7V5Z"/>',pause:'<path d="M8 5v14m8-14v14"/>',eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',sound:'<path d="M4 9h4l5-4v14l-5-4H4V9Zm12-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>'
 };
 const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]}</svg>`;
 document.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);});
 function toast(text){$('#sound-note').textContent=text;$('#sound-note').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#sound-note').classList.remove('visible'),3500);}
 function setEnvironment(name,instant=false){
  if(!environmentPresets[name])return;
  environment=environmentPresets[name];currentEnvironment=name;
  $('#weather-caption').textContent=environment.label;$('#chapter-number').textContent=environment.roman;$('#poem').innerHTML=environment.poem;
  document.querySelectorAll('[data-env]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.env===name)));
  if(instant)updateEnvironment(1,0);
  if(audio)updateAudio();
 }
 const cTemp=new THREE.Color(),dirTemp=V();
 function blendColor(value,target,a){value.lerp(cTemp.set(target),a);}
 function updateEnvironment(a,t){
  const e=environment;
  blendColor(skyUniforms.top.value,e.top,a);blendColor(skyUniforms.bottom.value,e.bottom,a);blendColor(skyUniforms.sunColor.value,e.sun,a);blendColor(scene.fog.color,e.fog,a);blendColor(water.material.uniforms.waterColor.value,e.water,a);blendColor(water.material.uniforms.sunColor.value,e.sun,a);blendColor(sun.color,e.sun,a);blendColor(hemi.color,e.hemi,a);blendColor(hemi.groundColor,e.ground,a);
  for(const k of ['night','rain','mist','rays'])state[k]+=(e[k]-state[k])*a;
  scene.fog.density+=(e.density-scene.fog.density)*a;sun.intensity+=(e.sunPower-sun.intensity)*a;hemi.intensity+=(e.hemiPower-hemi.intensity)*a;moonLight.intensity+=(e.moon-moonLight.intensity)*a;renderer.toneMappingExposure+=(e.exposure-renderer.toneMappingExposure)*a;bloom.strength+=(e.bloom-bloom.strength)*a;
  dirTemp.fromArray(e.sunDir).normalize();skyUniforms.sunDir.value.lerp(dirTemp,a).normalize();sun.position.copy(skyUniforms.sunDir.value).multiplyScalar(100);water.material.uniforms.sunDirection.value.copy(skyUniforms.sunDir.value);
  skyUniforms.sunPower.value+=( (1-state.night)*(1-state.rain*.9)-skyUniforms.sunPower.value)*a;
  skyUniforms.night.value=state.night;skyUniforms.cloud.value+=(e.cloud-skyUniforms.cloud.value)*a;skyUniforms.time.value=t;
  stars.material.opacity=state.night*.85;stars.rotation.y=t*.0005;moon.material.opacity=state.night;
  fireUniforms.opacity.value=state.night;fireUniforms.time.value=t;
  glowMat.emissiveIntensity=.12+state.night*3.7;
  lanterns.forEach((l,i)=>{l.light.intensity=state.night*(i===0?17:13)*(1+.04*Math.sin(t*1.4+i*3));l.sprite.material.opacity=state.night*.44;});
  rain.visible=state.rain>.003;rain.material.opacity=state.rain*.21;
  water.material.uniforms.distortionScale.value=1.15+state.rain*2;
  for(let i=0;i<mistUniforms.length;i++){const u=mistUniforms[i];u.time.value=t;u.opacity.value=state.mist*(.8+i*.07);u.tint.value.copy(scene.fog.color);}
  rayUniforms.forEach(u=>{u.time.value=t;u.power.value=state.rays;u.color.value.copy(skyUniforms.sunColor.value);});
 }
 function cameraPreset(name){
  const b=boat.position;
  switch(name){
   case 'Boat':return {p:V(b.x+8,4.3,b.z+10),t:b.clone().add(V(0,.8,0))};
   case 'Waterline':return {p:V(-3,.74,26),t:V(0,2.5,-14)};
   case 'Bridge':return {p:V(-7,8.6,2),t:V(0,3.1,-14)};
   case 'Mountains':return {p:V(-1,9,-1),t:V(-2,27,-136)};
   case 'Aerial':return {p:V(53,66,66),t:V(0,1,-13)};
   default:return {p:V(mobile?36:34,mobile?14:12,mobile?49:45),t:V(0,3,-7)};
  }
 }
 function setCamera(name,fromTour=false){
  if(!fromTour)stopTour();
  const end=cameraPreset(name);cameraName=name;
  cameraTransition={start:clock.getElapsedTime(),duration:reducedMotion?.3:4,fromP:camera.position.clone(),fromT:controls.target.clone(),toP:end.p,toT:end.t};
  controls.autoRotate=false;document.querySelectorAll('[data-camera]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.camera===name)));
  $('#status').textContent=name==='Boat'?'Adrift, with nowhere to arrive.':name==='Waterline'?'A whole world, just above the surface.':name==='Aerial'?'The garden unfolds beneath you.':'Take a breath. Stay a little.';
 }
 function stopTour(){touring=false;controls.autoRotate=false;$('#tour').setAttribute('aria-pressed','false');$('#tour').innerHTML=icon('play')+'<span>Auto Tour</span>';}
 function toggleTour(){if(touring){stopTour();return;}touring=true;tourIndex=0;tourTime=clock.getElapsedTime();$('#tour').setAttribute('aria-pressed','true');$('#tour').innerHTML=icon('pause')+'<span>Pause Tour</span>';setCamera('Garden',true);}
 function hideUI(){hiddenUI=!hiddenUI;document.querySelectorAll('.ui').forEach(el=>el.classList.toggle('is-hidden',hiddenUI));$('#restore').style.display=hiddenUI?'flex':'none';}
 controls.addEventListener('start',()=>{cameraTransition=null;stopTour();if(lesson.isActive()){lesson.manualCamera();return;}cameraName='Free';document.querySelectorAll('[data-camera]').forEach(b=>b.setAttribute('aria-pressed','false'));$('#status').textContent=mobile?'Pinch to glide. Two fingers to pan.':'W A S D to wander · Q E to rise & fall';});
 $('#environments').addEventListener('click',ev=>{const b=ev.target.closest('[data-env]');if(b)setEnvironment(b.dataset.env);});
 $('#cameras').addEventListener('click',ev=>{const b=ev.target.closest('[data-camera]');if(b)setCamera(b.dataset.camera);});
 $('#tour').addEventListener('click',toggleTour);$('#hide').addEventListener('click',hideUI);$('#restore').addEventListener('click',hideUI);
 $('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('This browser is already using the full available window.');}catch{toast('Fullscreen is unavailable in this browser.');}});
 document.addEventListener('keydown',ev=>{
  const k=ev.key.toLowerCase();if(k==='escape'&&lesson.isDialogOpen()){lesson.closeDialog();return;}if(lesson.isDialogOpen()||['INPUT','TEXTAREA','SELECT'].includes(ev.target?.tagName)||ev.target?.isContentEditable)return;
  if(['w','a','s','d','q','e','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(k)){keys.add(k);ev.preventDefault();if(cameraTransition||touring){cameraTransition=null;stopTour();}if(!lesson.isActive()){cameraName='Free';document.querySelectorAll('[data-camera]').forEach(b=>b.setAttribute('aria-pressed','false'));}}
  if(!ev.repeat&&k==='h')hideUI();if(!ev.repeat&&k==='m')toggleSound();
 });
 document.addEventListener('keyup',ev=>keys.delete(ev.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());
 $('#sound').addEventListener('click',toggleSound);

 function createAudio(){
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw Error('Audio unavailable');const ctx=new AC(),master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
  const length=ctx.sampleRate*7,buffer=ctx.createBuffer(2,length,ctx.sampleRate);
  for(let ch=0;ch<2;ch++){const d=buffer.getChannelData(ch);let brown=0;for(let i=0;i<length;i++){const w=Math.random()*2-1;brown=(brown+.025*w)/1.025;d[i]=brown*3.6;}}
  const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;
  const waterFilter=ctx.createBiquadFilter();waterFilter.type='lowpass';waterFilter.frequency.value=1050;const waterGain=ctx.createGain();waterGain.gain.value=.38;source.connect(waterFilter);waterFilter.connect(waterGain);waterGain.connect(master);
  const windFilter=ctx.createBiquadFilter();windFilter.type='bandpass';windFilter.frequency.value=360;windFilter.Q.value=.5;const windGain=ctx.createGain();windGain.gain.value=.11;source.connect(windFilter);windFilter.connect(windGain);windGain.connect(master);source.start();
  const breeze=ctx.createOscillator(),breezeGain=ctx.createGain();breeze.frequency.value=.09;breezeGain.gain.value=.035;breeze.connect(breezeGain);breezeGain.connect(windGain.gain);breeze.start();
  return {ctx,master,waterGain,waterFilter,windGain,birdTimer:null};
 }
 function updateAudio(){
  if(!audio)return;const t=audio.ctx.currentTime;
  audio.waterGain.gain.setTargetAtTime(currentEnvironment==='Rain'?.7:.36,t,1.5);audio.waterFilter.frequency.setTargetAtTime(currentEnvironment==='Rain'?2600:950,t,1.5);audio.windGain.gain.setTargetAtTime(currentEnvironment==='Rain'?.2:.1,t,1.5);
 }
 function birdSong(){
  if(!audio||!soundEnabled)return;
  if(currentEnvironment!=='Night'&&currentEnvironment!=='Rain'){
   const t=audio.ctx.currentTime+.1;
   for(let i=0;i<3;i++){const osc=audio.ctx.createOscillator(),g=audio.ctx.createGain();osc.type='sine';const start=t+i*.14;osc.frequency.setValueAtTime(1750+i*300,start);osc.frequency.exponentialRampToValueAtTime(2900+i*120,start+.055);osc.frequency.exponentialRampToValueAtTime(2100,start+.12);g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(.007,start+.025);g.gain.exponentialRampToValueAtTime(.0001,start+.14);osc.connect(g);g.connect(audio.master);osc.start(start);osc.stop(start+.16);}
  }
  audio.birdTimer=setTimeout(birdSong,5500+Math.random()*8500);
 }
 async function toggleSound(){
  try{
   if(!audio)audio=createAudio();await audio.ctx.resume();soundEnabled=!soundEnabled;
   audio.master.gain.setTargetAtTime(soundEnabled?.45:0,audio.ctx.currentTime,.8);$('#sound').setAttribute('aria-pressed',String(soundEnabled));$('#sound').innerHTML=icon('sound')+`<span>Sound ${soundEnabled?'on':'off'}</span>`;
   clearTimeout(audio.birdTimer);if(soundEnabled){updateAudio();birdSong();toast('Soft water, wind & birds.');}
  }catch{toast('Sound is unavailable in this browser.');}
 }

 function updateMovement(dt){
  if(lesson.isActive()||lesson.isDialogOpen()||!keys.size)return;
  camera.getWorldDirection(flatForward);flatForward.y=0;flatForward.normalize();right.crossVectors(flatForward,V(0,1,0)).normalize();moving.set(0,0,0);
  if(keys.has('w')||keys.has('arrowup'))moving.add(flatForward);if(keys.has('s')||keys.has('arrowdown'))moving.sub(flatForward);if(keys.has('d')||keys.has('arrowright'))moving.add(right);if(keys.has('a')||keys.has('arrowleft'))moving.sub(right);if(keys.has('e'))moving.y++;if(keys.has('q'))moving.y--;
  if(moving.lengthSq()>0){moving.normalize().multiplyScalar(dt*(keys.has('shift')?16:6));camera.position.add(moving);controls.target.add(moving);}
 }
 function updatePetals(t){
  for(let i=0;i<petalCount;i++){
   const s=petalStates[i],age=(t+s.offset)%s.cycle,air=Math.max(0,1-age/s.fall),tt=Math.min(age,s.fall),x=s.tree.x+Math.cos(s.a)*s.r+age*s.speed+Math.sin(age*.5+s.a)*.27,z=s.tree.z+Math.sin(s.a)*s.r+age*s.speed*.3;
   dummy.position.set(x,air>0?(.15+s.tree.h*air+Math.sin(age*1.5+s.a)*.1):.045,z);dummy.scale.set(s.s,s.s*.25,s.s*1.7);dummy.rotation.set(air>0?age*.5:0,s.a+age*.12,air>0?Math.sin(age+s.a)*.7:0);dummy.updateMatrix();petalMesh.setMatrixAt(i,dummy.matrix);
  }petalMesh.instanceMatrix.needsUpdate=true;
 }
 function updateRain(dt,t){
  if(state.rain>.003){
   for(let i=0;i<rainCount;i++){let k=i*6;rainArray[k]-=dt*1.5;rainArray[k+1]-=dt*rainSpeed[i];if(rainArray[k+1]<0){rainArray[k+1]=rand(25,50);rainArray[k]=rand(-65,65);rainArray[k+2]=rand(-65,50);}rainArray[k+3]=rainArray[k]-.09;rainArray[k+4]=rainArray[k+1]+.7;rainArray[k+5]=rainArray[k+2]+.035;}rainGeo.attributes.position.needsUpdate=true;
  }
  for(const r of ripples){const phase=((t+r.offset)%r.period)/r.period;r.m.scale.setScalar(.15+phase*.7);r.m.material.opacity=(1-phase)*(.016+state.rain*.11);}
 }
 function resize(){clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);},90);}
 window.addEventListener('resize',resize);window.addEventListener('orientationchange',resize);
 document.addEventListener('visibilitychange',()=>{keys.clear();if(document.hidden)lesson.pause();else lesson.resume();if(audio){if(document.hidden)audio.ctx.suspend();else if(soundEnabled)audio.ctx.resume().catch(()=>{});}});
 renderer.domElement.addEventListener('webglcontextlost',ev=>{ev.preventDefault();renderer.setAnimationLoop(null);$('#loader').classList.remove('loaded');$('#loading-note').textContent='The graphics connection paused. Reload this page to return to the garden.';$('.loading-emblem').style.display='none';});
 setEnvironment('Golden',true);const initial=cameraPreset('Garden');camera.position.copy(initial.p);controls.target.copy(initial.t);controls.update();updatePetals(0);
 renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{console.error('Garden shader:',gl.getProgramInfoLog(program),gl.getShaderInfoLog(vertex),gl.getShaderInfoLog(fragment));};
 renderer.setAnimationLoop(()=>{
  const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;if(document.hidden)return;
  try{
   const at=reducedMotion?t*.35:t;updateEnvironment(1-Math.exp(-dt*1.45),t);water.material.uniforms.time.value=at*.16;
   boat.position.y=.06+Math.sin(at*.71)*.055;boat.rotation.set(Math.sin(at*.62)*.012,lesson.heading(),Math.sin(at*.53)*.017);
   if(cameraName==='Boat'&&!cameraTransition&&!lesson.isActive()){const d=boat.position.clone().sub(previousBoat);camera.position.add(d);controls.target.add(d);}previousBoat.copy(boat.position);
   if(touring&&t-tourTime>15){tourTime=t;tourIndex=(tourIndex+1)%tourSequence.length;setCamera(tourSequence[tourIndex],true);}
   if(cameraTransition){const c=cameraTransition,p=Math.min(1,(t-c.start)/c.duration),f=p*p*(3-2*p);camera.position.lerpVectors(c.fromP,c.toP,f);controls.target.lerpVectors(c.fromT,c.toT,f);if(p===1){cameraTransition=null;controls.autoRotate=touring&&!reducedMotion;controls.autoRotateSpeed=.10;}}
   updateMovement(dt);lesson.update(dt,t,keys);controls.update(dt);camera.position.y=Math.max(.28,camera.position.y);camera.position.x=THREE.MathUtils.clamp(camera.position.x,-150,150);camera.position.z=THREE.MathUtils.clamp(camera.position.z,-165,150);
   updatePetals(at);updateRain(dt,at);
   for(const b of birds){const a=at*b.speed+b.phase;b.g.position.set(Math.cos(a)*b.radius,b.height+Math.sin(at*.17+b.phase),-65+Math.sin(a)*b.radius*.25);b.g.rotation.y=-a+Math.PI/2;b.wings[0].rotation.z=Math.sin(at*2.7+b.phase)*.42;b.wings[1].rotation.z=-Math.sin(at*2.7+b.phase)*.42;b.g.visible=state.night<.7;}
   for(const shaft of shafts){const y=shaft.userData.axis,view=camera.position.clone().sub(shaft.position),x=V().crossVectors(y,view).normalize(),z=V().crossVectors(x,y).normalize();const matrix=new THREE.Matrix4().makeBasis(x,y,z);shaft.quaternion.setFromRotationMatrix(matrix);}
   grade.uniforms.time.value=t;composer.render(dt);
   if(firstFrame){firstFrame=false;$('#loader').classList.add('loaded');setTimeout(()=>{$('#loader').style.display='none';},1400);}
   qualityClock+=dt;if(dt>.036)slowFrames++;if(qualityClock>8){if(slowFrames>145&&renderer.getPixelRatio()>1){renderer.setPixelRatio(Math.max(1,renderer.getPixelRatio()-.3));composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(innerWidth,innerHeight);}qualityClock=0;slowFrames=0;}
  }catch(err){renderer.setAnimationLoop(null);$('#loader').style.display='flex';$('#loader').classList.remove('loaded');showError(err);}
 });
}

if(globalThis.__GARDEN_QA__){globalThis.__gardenWorld.initializeInteraction=initializeInteraction;globalThis.__gardenWorld.parseLakeWords=parseLakeWords;globalThis.__gardenWorld.boatCanNavigate=boatCanNavigate;}
else startExperience();
