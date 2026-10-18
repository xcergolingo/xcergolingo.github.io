import * as THREE from 'three';
const dark=new THREE.MeshStandardMaterial({color:0x121b2a,roughness:.84});
const rubber=new THREE.MeshStandardMaterial({color:0x352e28,roughness:.98});
const sleeve=new THREE.MeshStandardMaterial({color:0x1b2c3c,roughness:.96});
const orange=new THREE.MeshStandardMaterial({color:0xf5a63a,roughness:.55});
const shaft=new THREE.MeshStandardMaterial({color:0x66758a,metalness:.85,roughness:.3});
function ellipsoid(parent,pos,scale,mat){const m=new THREE.Mesh(new THREE.SphereGeometry(1,12,9),mat);m.position.set(...pos);m.scale.set(...scale);parent.add(m);return m;}
function rod(parent,a,b,r,mat){
 const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av);
 const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),10),mat);m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());parent.add(m);return m;
}
function skiTexture(){
 const c=document.createElement('canvas');c.width=256;c.height=2048;const g=c.getContext('2d');
 g.fillStyle='#121a25';g.fillRect(0,0,256,2048);g.fillStyle='#f3a02c';g.fillRect(0,0,256,570);
 g.fillStyle='#ffbf4b';g.beginPath();g.moveTo(0,0);g.lineTo(256,0);g.lineTo(256,95);g.lineTo(0,270);g.fill();
 for(let i=0;i<6;i++){g.fillStyle=i%2?'#ffb33e':'#b95f23';g.beginPath();g.moveTo(0,370+i*44);g.lineTo(256,245+i*44);g.lineTo(256,268+i*44);g.lineTo(0,393+i*44);g.fill();}
 g.fillStyle='#dbf0ff';g.fillRect(21,570,4,1340);g.fillRect(231,570,4,1340);
 g.save();g.translate(144,1090);g.rotate(Math.PI/2);g.fillStyle='#b8cbdd';g.font='700 64px sans-serif';g.fillText('S T R E A M',-170,0);g.restore();
 g.font='600 46px sans-serif';g.fillStyle='#dcecff';g.fillText('170',82,650);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
function gloveGrain(){
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),im=ctx.createImageData(128,128);let seed=71123;
 for(let i=0;i<128*128;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const n=106+(seed>>>24)*.23;im.data[i*4]=im.data[i*4+1]=im.data[i*4+2]=n;im.data[i*4+3]=255;}
 ctx.putImageData(im,0,0);const tex=new THREE.CanvasTexture(c);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(2,2);tex.anisotropy=4;
 for(const m of [dark,rubber,sleeve]){m.bumpMap=tex;m.bumpScale=m===sleeve?.0008:.0014;m.needsUpdate=true;}
}
export function createPOV(camera){
 gloveGrain();
 const rig=new THREE.Group();camera.add(rig);const skis=[],hands=[];
 const tex=skiTexture(),skiMat=new THREE.MeshStandardMaterial({map:tex,roughness:.38,metalness:.3});
 const stations=[[-.25,.092,-1.37],[-.6,.097,-1.36],[-1.3,.09,-1.35],[-1.8,.102,-1.32],[-2.15,.106,-1.26],[-2.35,.08,-1.17],[-2.44,.036,-1.12],[-2.46,0,-1.11]];
 for(const side of [-1,1]){
  const g=new THREE.Group();g.position.x=side*.205;rig.add(g);skis.push(g);
  const verts=[],uv=[],idx=[];
  for(let i=0;i<stations.length;i++){const [z,w,y]=stations[i];verts.push(-w,y,z,w,y,z);uv.push(0,i/(stations.length-1),1,i/(stations.length-1));if(i<stations.length-1){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
  const surface=new THREE.Mesh(geo,skiMat);surface.material.side=THREE.DoubleSide;g.add(surface);
  const bottom=new THREE.Mesh(geo,dark);bottom.position.y=-.025;bottom.material.side=THREE.DoubleSide;g.add(bottom);
  ellipsoid(g,[0,-1.26,-.47],[.095,.11,.27],rubber);
  const hand=new THREE.Group();hand.position.set(side*.67,-.48,-.87);hand.rotation.z=side*.35;hand.rotation.y=side*-.16;rig.add(hand);hands.push(hand);
  // Padded jacket forearm, wrist cuff, articulated glove fingers and thumb.
  rod(hand,[side*.5,-.48,.35],[side*.08,-.04,.06],.115,sleeve);
  rod(hand,[side*.09,-.07,.08],[0,0,0],.126,dark);
  rod(hand,[side*.04,-.04,.035],[side*.015,-.013,.015],.129,orange);
  ellipsoid(hand,[0,.025,-.04],[.113,.097,.15],rubber);
  ellipsoid(hand,[side*.005,.075,-.04],[.095,.035,.125],dark);
  for(let i=0;i<4;i++){
   const x=(i-1.5)*.043;ellipsoid(hand,[x,.005,-.145],[.025,.046,.063],dark);ellipsoid(hand,[x,-.035,-.156],[.024,.032,.042],rubber);
  }
  ellipsoid(hand,[-side*.105,-.025,-.055],[.053,.058,.094],dark);
  // Pole grip passes through the curled fingers. A real shaft, ferrule and basket.
  rod(hand,[0,.145,-.14],[0,-.17,-.14],.027,rubber);
  rod(hand,[0,-.17,-.14],[-side*.2,-1.23,-.8],.008,shaft);
  rod(hand,[-side*.1,-.7,-.47],[-side*.14,-.9,-.60],.009,orange);
  const basket=new THREE.Mesh(new THREE.TorusGeometry(.048,.007,5,12),dark);basket.position.set(-side*.19,-1.18,-.77);basket.rotation.x=Math.PI/2;hand.add(basket);
  const strap=new THREE.Mesh(new THREE.TorusGeometry(.12,.009,6,20,Math.PI*1.5),rubber);strap.rotation.x=.7;strap.rotation.z=.3;strap.position.set(.025,-.025,.055);hand.add(strap);
 }
 return {rig,update(p,time,aspect){
  const move=p.speed/35,carve=p.steer;
  rig.position.y=Math.sin(time*8)*.004*move+(p.grounded?0:.035);
  const compact=Math.min(1,Math.max(.36,aspect*.68));
  hands.forEach((h,i)=>{const side=i?1:-1;h.position.x=side*.67*compact;h.position.y=-.48+Math.sin(time*3.2+i)*.014*move+carve*side*.045+(p.grounded?0:.045);h.rotation.x=carve*side*.09+(p.grounded?0:-.16);});
  skis.forEach((s,i)=>{s.rotation.y=-carve*.1;s.rotation.z=carve*.07;s.position.y=p.grounded?0:.17;s.rotation.x=p.grounded?0:.11;s.position.x=(i?1:-1)*(.205+(p.grounded?0:.03));});
 }};
}
