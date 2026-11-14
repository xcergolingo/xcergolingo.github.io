import * as THREE from './vendor/three.module.js';

// Terrain is a tangent patch over a 6.5 km sphere. The same function is used
// by the mesh and by the flight / walking collision code.
const RADIUS=6500, EDGE=6380;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
function terrainRelief(x,z,kind){
  const r=Math.hypot(x,z);
  const broad=Math.sin(x*.0027+.4)*Math.cos(z*.0022)+.42*Math.sin(x*.0051-z*.0031)+.22*Math.cos(z*.008+x*.002);
  if(kind==='vesper') return 24+broad*20+9*Math.sin(x*.012)*Math.cos(z*.006)+smooth(1000,2400,r)*(70+95*Math.pow(Math.abs(Math.sin(x*.0033)+Math.cos(z*.0027))*.5,3));
  if(kind==='sahra') return 28+25*Math.sin(x*.0025+z*.0012)+13*Math.cos(x*.004-z*.0028)+smooth(900,2800,r)*90*Math.pow(Math.abs(Math.sin(x*.0023)*Math.cos(z*.002)),3);
  if(kind==='nivalis') return 22+broad*22+smooth(700,2300,r)*(55+130*Math.pow(Math.abs(Math.sin(x*.003)*Math.cos(z*.0035)),2));
  return 23+broad*17+5*Math.sin(x*.0105+z*.004)*Math.cos(z*.009)+smooth(1800,3500,r)*(30+64*Math.pow(Math.abs(Math.sin(x*.002)*Math.cos(z*.0025)),2));
}
export function terrainHeight(x,z,kind='elysia'){
  const r=Math.min(6499,Math.hypot(x,z));
  return terrainRelief(x,z,kind)+Math.sqrt(RADIUS*RADIUS-r*r)-RADIUS;
}
function seeded(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const dummy=new THREE.Object3D();
const p=new THREE.Vector3();
function material(color,roughness=.92,extra={}){return new THREE.MeshStandardMaterial({color,roughness,metalness:0,...extra})}
function instance(geo,mat,count,group,setup){
  const mesh=new THREE.InstancedMesh(geo,mat,count);
  mesh.receiveShadow=true;
  for(let i=0;i<count;i++){
    dummy.position.set(0,0,0);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);
    const color=setup(dummy,i);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    if(color!==undefined)mesh.setColorAt(i,new THREE.Color(color));
  }
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.computeBoundingSphere();group.add(mesh);return mesh;
}
function strataMaterial(color,kind='rock'){
  const m=material(color,1);
  m.onBeforeCompile=s=>{
    s.vertexShader='varying vec3 vTerrainLocal;\n'+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTerrainLocal = position;');
    s.fragmentShader='varying vec3 vTerrainLocal;\n'+s.fragmentShader;
    const band=kind==='vesper'?
      'float band = smoothstep(0.945,0.985,sin(vTerrainLocal.y * 0.20 + sin(vTerrainLocal.x * .007) * .7)); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.76,.55,.73),band*.6);':
      'float band = sin(vTerrainLocal.y * .17 + sin(vTerrainLocal.x * .018) * .7); diffuseColor.rgb *= .92 + .10 * band;';
    s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+band+'\nfloat grain = sin(vTerrainLocal.x*2.09+sin(vTerrainLocal.z*1.83))*sin(vTerrainLocal.z*2.31+vTerrainLocal.y*.7); diffuseColor.rgb *= .98 + .035 * grain;');
  };
  m.customProgramCacheKey=()=>`skyreach-strata-${kind}`;
  return m;
}
function terrainMesh(kind,group){
  // Finer center sampling preserves rolling hills at walking distance, while
  // the curved perimeter closes into the parent planet without a square edge.
  const n=200,positions=[],colors=[],indices=[];
  const palette={elysia:[0x50703a,0x95ac54,0xc3bd73],vesper:[0x41284e,0x855078,0xb17c9d],sahra:[0x985336,0xc88752,0xe4bb7b],nivalis:[0x759aaa,0xbdd6db,0xeff5f1]}[kind]||[0x50703a,0x95ac54,0xc3bd73];
  const low=new THREE.Color(palette[0]),high=new THREE.Color(palette[1]),rock=new THREE.Color(palette[2]),c=new THREE.Color();
  const coord=i=>{const a=i/n*2-1;return Math.sign(a)*Math.pow(Math.abs(a),1.38)*EDGE};
  for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
    const x=coord(i),z=coord(j),y=terrainHeight(x,z,kind),rel=terrainRelief(x,z,kind);
    positions.push(x,y,z);
    const variation=.46+.24*Math.sin(x*.004+z*.003)+.18*Math.cos(z*.009-x*.001)+.12*Math.sin(x*.021)*Math.cos(z*.017);
    c.copy(low).lerp(high,clamp(variation,0,1));
    if(kind==='elysia')c.lerp(rock,smooth(55,150,rel)*.56);
    if(kind==='vesper')c.lerp(rock,smooth(.9,.98,Math.sin(rel*.21+x*.002))* .28);
    if(kind==='nivalis')c.lerp(rock,smooth(30,100,rel));
    colors.push(c.r,c.g,c.b);
  }
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const a=j*(n+1)+i,b=a+1,c=a+n+1,d=c+1;
    const x=coord(i+.5),z=coord(j+.5);
    if(Math.hypot(x,z)>EDGE)continue;
    indices.push(a,c,b,b,c,d);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();
  const mat=strataMaterial(0xffffff,kind==='vesper'?'vesper':'terrain');mat.vertexColors=true;
  const mesh=new THREE.Mesh(g,mat);mesh.receiveShadow=true;mesh.name=`${kind}-curved-terrain`;group.add(mesh);
}
function roughRockGeometry(detail=0){
  const geo=new THREE.IcosahedronGeometry(1,detail);
  const pos=geo.getAttribute('position');
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
    const wave=1+.12*Math.sin(x*13.5+z*3.3)*Math.cos(y*8.1);
    pos.setXYZ(i,x*wave,y*wave,z*wave);
  }
  geo.computeVertexNormals();return geo;
}
function addRocks(group,kind,rng){
  const tones={elysia:[0x8b8c69,0xaaa57f,0x777b65],vesper:[0x655474,0x936483,0x4d4966],sahra:[0xa16c47,0xb78354,0x7f503e],nivalis:[0xb5c9cf,0x829ca9,0xdae6e6]}[kind];
  instance(roughRockGeometry(1),material(0xffffff),310,group,(o,i)=>{
    const a=rng()*Math.PI*2,r=180+rng()*3000,x=Math.cos(a)*r,z=Math.sin(a)*r;
    const s=3+rng()*15;o.position.set(x,terrainHeight(x,z,kind)+s*.28,z);o.scale.set(s*(.7+rng()),s*(.45+rng()*.7),s*(.65+rng()));o.rotation.set(rng()*.3,rng()*6.28,rng()*.25);return tones[i%tones.length];
  });
}
function grassGeometry(){
  const v=[],norm=[],col=[];
  for(let k=0;k<3;k++){
    const a=k*Math.PI/3,dx=Math.cos(a)*.45,dz=Math.sin(a)*.45;
    v.push(-dx,0,-dz,dx,0,dz,.13,1.7,0);
    for(let j=0;j<3;j++){norm.push(-Math.sin(a),.25,Math.cos(a));col.push(j===2?.79:.42,j===2?.93:.62,j===2?.42:.24)}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));return g;
}
function addElysiaPlants(group,rng){
  const shrubs=instance(roughRockGeometry(1),material(0xffffff),560,group,o=>{
    const a=rng()*6.283,r=110+Math.sqrt(rng())*2800,x=Math.cos(a)*r,z=Math.sin(a)*r,s=4+rng()*9;
    o.position.set(x,terrainHeight(x,z)+s*.5,z);o.scale.set(s,s*(.55+rng()*.4),s);o.rotation.y=rng()*6.28;return new THREE.Color().setHSL(.20+rng()*.055,.28+rng()*.15,.27+rng()*.14);
  });
  shrubs.castShadow=true;
  instance(grassGeometry(),new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1}),4800,group,o=>{
    const a=rng()*6.28,r=Math.sqrt(rng())*1700,x=Math.cos(a)*r,z=Math.sin(a)*r;
    o.position.set(x,terrainHeight(x,z)+.2,z);o.scale.setScalar(.7+rng()*1.5);o.rotation.y=rng()*6.28;
  });
  // Slender amber trees punctuate the soft brush.
  const locs=[];
  for(let i=0;i<80;i++){const a=rng()*6.28,r=400+rng()*2400,x=Math.cos(a)*r,z=Math.sin(a)*r;locs.push({x,z,y:terrainHeight(x,z),h:15+rng()*20})}
  instance(new THREE.CylinderGeometry(.45,.9,1,5),material(0x766648),locs.length,group,(o,i)=>{const q=locs[i];o.position.set(q.x,q.y+q.h*.5,q.z);o.scale.set(q.h*.14,q.h,q.h*.14)});
  instance(new THREE.IcosahedronGeometry(1,1),material(0xffffff),locs.length*3,group,(o,i)=>{const q=locs[Math.floor(i/3)],a=i*2.4;o.position.set(q.x+Math.sin(a)*q.h*.17,q.y+q.h*(.78+(i%3)*.12),q.z+Math.cos(a)*q.h*.17);o.scale.set(q.h*.35,q.h*.23,q.h*.35);return [0xa4ac52,0x7b8e44,0xc1b36a][i%3]});
}
function addArch(group,kind,x,z,width,height,angle){
  const a=new THREE.Group();a.position.set(x,terrainHeight(x,z,kind)-8,z);a.rotation.y=angle;
  const points=[];for(let i=0;i<=16;i++){const t=i/16*Math.PI;points.push(new THREE.Vector3(-Math.cos(t)*width*.5,Math.sin(t)*height,Math.sin(t*2.1)*10))}
  const curve=new THREE.CatmullRomCurve3(points);const geo=new THREE.TubeGeometry(curve,36,width*.075,7,false);
  const pos=geo.attributes.position;for(let i=0;i<pos.count;i++){const y=pos.getY(i);pos.setX(i,pos.getX(i)+Math.sin(y*.11)*2)}geo.computeVertexNormals();
  const m=strataMaterial(kind==='sahra'?0xbf8153:0xbb8258);const arch=new THREE.Mesh(geo,m);arch.castShadow=true;arch.receiveShadow=true;a.add(arch);
  for(const side of [-1,1]){const base=new THREE.Mesh(new THREE.CylinderGeometry(width*.08,width*.15,height*.45,7,4),m);base.position.set(side*width*.5,height*.16,0);base.rotation.z=-side*.08;base.castShadow=true;base.receiveShadow=true;a.add(base)}
  group.add(a);
}
function addHoodoos(group,kind,rng){
  const specs=[];
  for(let i=0;i<38;i++){
    const a=rng()*Math.PI*2,r=500+rng()*3100,x=Math.cos(a)*r,z=Math.sin(a)*r;
    specs.push({x,z,y:terrainHeight(x,z,kind),h:70+rng()*200,w:18+rng()*24,turn:rng()*6.28});
  }
  const mat=strataMaterial(kind==='sahra'?0xb87e51:0xb48763);
  instance(new THREE.CylinderGeometry(.48,.94,1,7,5),mat,specs.length,group,(o,i)=>{const q=specs[i];o.position.set(q.x,q.y+q.h*.4,q.z);o.scale.set(q.w,q.h*.8,q.w*.8);o.rotation.y=q.turn});
  instance(roughRockGeometry(1),mat,specs.length,group,(o,i)=>{const q=specs[i];o.position.set(q.x,q.y+q.h*.86,q.z);o.scale.set(q.w*.83,q.h*.19,q.w*.72);o.rotation.y=q.turn});
  instance(new THREE.CylinderGeometry(.65,.86,1,7,2),strataMaterial(0x9b6c50),specs.length,group,(o,i)=>{const q=specs[i];o.position.set(q.x,q.y+q.h*.58,q.z);o.scale.set(q.w,q.h*.07,q.w*.82);o.rotation.y=q.turn});
  addArch(group,kind,-340,-570,270,205,.18);
  addArch(group,kind,780,-1590,360,270,-.65);
  addArch(group,kind,-1700,-2200,460,330,.35);
}
function capGeometry(){
  const points=[new THREE.Vector2(0,.58),new THREE.Vector2(.10,.59),new THREE.Vector2(.35,.56),new THREE.Vector2(.64,.43),new THREE.Vector2(.87,.23),new THREE.Vector2(1,.08),new THREE.Vector2(1.015,0),new THREE.Vector2(.96,-.055),new THREE.Vector2(.7,-.09),new THREE.Vector2(.33,-.15),new THREE.Vector2(.10,-.11),new THREE.Vector2(0,-.09)];
  const g=new THREE.LatheGeometry(points.reverse(),24);const pos=g.attributes.position,col=[];
  const teal=new THREE.Color(0x279dad),rim=new THREE.Color(0x9ee7cf),dark=new THREE.Color(0x236e87),gill=new THREE.Color(0x85e5ce),c=new THREE.Color();
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),a=Math.atan2(x,z),r=Math.hypot(x,z);
    if(y<0)c.copy(gill).multiplyScalar(.76+.14*Math.sin(a*22));
    else c.copy(dark).lerp(teal,smooth(.06,.5,y)).lerp(rim,smooth(.84,1.02,r)*.7).multiplyScalar(.96+.08*Math.sin(a*11+r*17));
    col.push(c.r,c.g,c.b);
  }
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));return g;
}
function addMushrooms(group,kind,rng){
  const cap=capGeometry(),stem=new THREE.CylinderGeometry(.58,.9,1,9,3),spots=[];
  for(let i=0;i<460;i++){
    const a=rng()*6.283,r=50+Math.sqrt(rng())*2500,x=Math.cos(a)*r,z=Math.sin(a)*r,h=2.5+rng()*11;
    spots.push({x,z,y:terrainHeight(x,z,kind),h,r:h*(.55+rng()*.45),a:rng()*6.28});
  }
  const stemMat=material(0xb6b1c2,.78,{emissive:0x244d55,emissiveIntensity:.12});
  instance(stem,stemMat,spots.length,group,(o,i)=>{const q=spots[i];o.position.set(q.x,q.y+q.h*.5,q.z);o.scale.set(q.h*.13,q.h,q.h*.13);o.rotation.z=Math.sin(q.a)*.06});
  instance(cap,new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.58,metalness:.06,emissive:0x0d6069,emissiveIntensity:.16,side:THREE.DoubleSide}),spots.length,group,(o,i)=>{const q=spots[i];o.position.set(q.x,q.y+q.h,q.z);o.scale.set(q.r,q.r*.7,q.r);o.rotation.y=q.a});
  const giants=[{x:160,z:80,h:115,r:110},{x:-290,z:-450,h:170,r:145},{x:530,z:-850,h:210,r:185},{x:-850,z:-1400,h:240,r:210},{x:1250,z:600,h:180,r:160}];
  const giantStemMat=strataMaterial(0xaab1ba,'vesper');
  instance(stem,giantStemMat,giants.length,group,(o,i)=>{const q=giants[i];o.position.set(q.x,terrainHeight(q.x,q.z,kind)+q.h*.5,q.z);o.scale.set(q.h*.12,q.h,q.h*.12);o.rotation.z=(i%2?1:-1)*.035});
  const caps=instance(cap,new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.7,emissive:0x065d6b,emissiveIntensity:.18,side:THREE.DoubleSide}),giants.length,group,(o,i)=>{const q=giants[i];o.position.set(q.x,terrainHeight(q.x,q.z,kind)+q.h,q.z);o.scale.set(q.r,q.r*.64,q.r);o.rotation.y=i*1.9});caps.castShadow=true;
  // Pale radial ribs are visible on the enormous cap undersides.
  const ribGeo=new THREE.CylinderGeometry(.8,1.3,1,5);const ribMat=material(0x9ce4d2,.7,{emissive:0x166575,emissiveIntensity:.15});
  instance(ribGeo,ribMat,giants.length*24,group,(o,i)=>{
    const q=giants[Math.floor(i/24)],a=i/24*Math.PI*2;const r=q.r*.6;
    o.position.set(q.x+Math.cos(a)*r*.66,terrainHeight(q.x,q.z,kind)+q.h-q.r*.07,q.z+Math.sin(a)*r*.66);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(Math.cos(a),.04,Math.sin(a)).normalize());o.scale.set(1.1,r,1.1);
  });
  // Purple reed forests around cyan caps add a second scale of vegetation.
  instance(new THREE.ConeGeometry(1,1,5),material(0xb078a2,.9),900,group,o=>{const a=rng()*6.28,r=55+Math.sqrt(rng())*1600,x=Math.cos(a)*r,z=Math.sin(a)*r,h=2+rng()*8;o.position.set(x,terrainHeight(x,z,kind)+h*.45,z);o.scale.set(.4+rng(),h,.4+rng());o.rotation.z=(rng()-.5)*.4});
}
function addIce(group,rng){
  const mat=material(0x91ccd5,.26,{metalness:.08,emissive:0x2f7387,emissiveIntensity:.12,transparent:true,opacity:.95});
  instance(new THREE.ConeGeometry(1,1,5),mat,100,group,o=>{const a=rng()*6.28,r=280+rng()*2400,x=Math.cos(a)*r,z=Math.sin(a)*r,h=35+rng()*150;o.position.set(x,terrainHeight(x,z,'nivalis')+h*.45,z);o.scale.set(h*.19,h,h*.19);o.rotation.set((rng()-.5)*.2,rng()*6.28,(rng()-.5)*.18)});
}
function glowTexture(){
  const size=32,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,r=Math.hypot(x-(size-1)/2,y-(size-1)/2)/(size/2);data[i]=255;data[i+1]=255;data[i+2]=255;data[i+3]=Math.round(255*Math.pow(Math.max(0,1-r),2))}
  const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.needsUpdate=true;return t;
}
function makeBeacon(group,kind,position){
  const x=position.x,z=position.z,y=position.y;
  const base=new THREE.Group();base.position.copy(position);base.name=`${kind}-warp-core-beacon`;group.add(base);
  const stone=material(kind==='vesper'?0xb0a9b7:0xc9c7ac,.88);
  const plinth=new THREE.Mesh(new THREE.CylinderGeometry(12,16,6,8),stone);plinth.position.y=3;plinth.receiveShadow=true;base.add(plinth);
  const ringMat=material(0x79f2e4,.3,{emissive:0x49d9ed,emissiveIntensity:1.3,metalness:.3});
  const core=new THREE.Mesh(new THREE.OctahedronGeometry(3.6,0),ringMat);core.position.y=11;base.add(core);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(6,.3,6,36),ringMat);ring.position.y=11;ring.rotation.x=Math.PI*.23;base.add(ring);
  for(let i=0;i<4;i++){const a=i*Math.PI/2;const pillar=new THREE.Mesh(new THREE.CylinderGeometry(1.4,2.1,16,5),stone);pillar.position.set(Math.cos(a)*11,8,Math.sin(a)*11);pillar.castShadow=true;base.add(pillar)}
  const beamMat=new THREE.MeshBasicMaterial({color:0xacfaff,transparent:true,opacity:.18,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(1.8,3,800,12,1,true),beamMat);beam.position.y=410;base.add(beam);
  const outer=new THREE.Mesh(new THREE.CylinderGeometry(5,9,800,12,1,true),beamMat.clone());outer.material.opacity=.055;outer.position.y=410;base.add(outer);
  // Distinct ancient landmark around Elysia's more remote core.
  if(kind==='elysia'){
    const spireMat=strataMaterial(0xb7b7a2);
    for(let i=0;i<3;i++){const a=i*2.09+.5;const shard=new THREE.Mesh(new THREE.CylinderGeometry(3,17,130+i*26,5,2),spireMat);shard.position.set(Math.cos(a)*43,60+i*13,Math.sin(a)*43);shard.rotation.z=Math.cos(a)*.08;shard.castShadow=true;base.add(shard)}
    const gate=new THREE.Mesh(new THREE.TorusGeometry(30,4,5,28,Math.PI*1.55),stone);gate.position.set(0,51,30);gate.rotation.z=-.28;base.add(gate);
  }
  return {base,core,ring,beam};
}
function crystalCluster(kind,x,z,rng,index){
  const mesh=new THREE.Group();const y=terrainHeight(x,z,kind);mesh.position.set(x,y,z);mesh.name=`${kind}-crystal-${index}`;
  const colors=kind==='sahra'?[0xf6b95c,0xffdf91]:kind==='nivalis'?[0x8de1ff,0xc8f3ff]:[0x4de4d9,0xa1fff1];
  const mat=material(colors[0],.27,{metalness:.16,emissive:colors[0],emissiveIntensity:.42});
  const capmat=material(colors[1],.22,{emissive:colors[1],emissiveIntensity:.32});
  const count=5,specs=[];
  for(let j=0;j<count;j++){
    const a=j*2.4,h=3+(j===0?4:rng()*3),r=j===0?0:1+rng()*1.8;
    specs.push({x:Math.cos(a)*r,z:Math.sin(a)*r,h,tilt:j===0?0:(rng()-.5)*.5});
  }
  instance(new THREE.CylinderGeometry(.55,.75,1,5,1),mat,count,mesh,(o,j)=>{
    const q=specs[j];o.position.set(q.x-Math.sin(q.tilt)*q.h*.5,.3+Math.cos(q.tilt)*q.h*.5,q.z);o.rotation.z=q.tilt;o.scale.y=q.h;
  });
  instance(new THREE.ConeGeometry(.55,1.4,5),capmat,count,mesh,(o,j)=>{
    const q=specs[j];o.position.set(q.x-Math.sin(q.tilt)*(q.h+.65),.3+Math.cos(q.tilt)*(q.h+.65),q.z);o.rotation.z=q.tilt;
  });
  const bed=new THREE.Mesh(roughRockGeometry(0),material(kind==='vesper'?0x504054:0x6b7480));bed.scale.set(4,1,3);bed.position.y=.5;mesh.add(bed);
  return {mesh,position:mesh.position.clone(),amount:8+(index%3)*3};
}
export function createWorld(kind='elysia'){
  const group=new THREE.Group();group.name=`world-${kind}`;const rng=seeded({elysia:6781,vesper:8093,sahra:4221,nivalis:9501}[kind]||6781);
  terrainMesh(kind,group);addRocks(group,kind,rng);
  if(kind==='elysia'){addElysiaPlants(group,rng);addHoodoos(group,kind,rng)}
  else if(kind==='vesper')addMushrooms(group,kind,rng);
  else if(kind==='sahra')addHoodoos(group,kind,rng);
  else if(kind==='nivalis')addIce(group,rng);
  const beaconXZ=kind==='elysia'?[1200,-1300]:[0,-180];
  const beacon=new THREE.Vector3(beaconXZ[0],terrainHeight(beaconXZ[0],beaconXZ[1],kind),beaconXZ[1]);
  const animatedBeacon=makeBeacon(group,kind,beacon);
  const crystalLocs=[[30,300],[-30,200],[40,80],[-100,-80],[65,-145],[-170,380],[140,160],[-210,-230]];
  const crystals=crystalLocs.map(([x,z],i)=>crystalCluster(kind,x,z,rng,i));crystals.forEach(c=>group.add(c.mesh));
  let clouds=null,spores=null;
  if(kind==='elysia'||kind==='nivalis'){
    const white=material(kind==='elysia'?0xf7f6e9:0xdde9f4,.95,{transparent:true,opacity:.84,depthWrite:false});
    const skyGroup=new THREE.Group();group.add(skyGroup);clouds=skyGroup;
    const cells=[];for(let i=0;i<22;i++){const a=rng()*6.28,r=1800+rng()*2600;cells.push({x:Math.cos(a)*r,z:Math.sin(a)*r,y:500+rng()*450,s:90+rng()*90})}
    instance(new THREE.IcosahedronGeometry(1,2),white,cells.length*4,skyGroup,(o,i)=>{const c=cells[Math.floor(i/4)],j=i%4;o.position.set(c.x+(j-1.5)*c.s*.8,c.y+Math.sin(j*1.5)*c.s*.25,c.z);o.scale.set(c.s*(.6+rng()*.4),c.s*(.23+rng()*.2),c.s*.7)});
  }
  if(kind==='vesper'){
    const pos=[];for(let i=0;i<600;i++){const x=(rng()-.5)*3000,z=(rng()-.5)*3000;pos.push(x,terrainHeight(x,z,kind)+8+rng()*180,z)}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));spores=new THREE.Points(g,new THREE.PointsMaterial({color:0xccffd1,size:2.3,sizeAttenuation:true,map:glowTexture(),transparent:true,opacity:.65,depthWrite:false,blending:THREE.AdditiveBlending}));group.add(spores);
  }
  const spires=kind==='elysia'?[beacon.clone(),new THREE.Vector3(-340,terrainHeight(-340,-570,kind)+205,-570)]:[beacon.clone()];
  let lastTime=0;
  return {group,height:(x,z)=>terrainHeight(x,z,kind),spires,crystals,beacon,
    update(time){
      animatedBeacon.core.rotation.y=time*.55;animatedBeacon.core.position.y=11+Math.sin(time*1.6)*.65;
      animatedBeacon.ring.rotation.z=time*.22;animatedBeacon.beam.material.opacity=.15+Math.sin(time*1.2)*.025;
      if(clouds)clouds.position.x=Math.sin(time*.009)*70;
      if(spores){spores.position.y=Math.sin(time*.12)*2;spores.rotation.y=Math.sin(time*.015)*.015}
      lastTime=time;
    }
  };
}
