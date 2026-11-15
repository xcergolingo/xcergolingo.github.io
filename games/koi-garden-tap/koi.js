import * as THREE from 'three';

// The silhouette follows a carp's broad shoulders, rounded snout and narrow caudal peduncle.
const profile = [
  [-.76,.023,.024],[-.60,.052,.044],[-.41,.100,.081],[-.18,.180,.135],
  [.06,.238,.158],[.27,.245,.155],[.43,.205,.134],[.57,.157,.104],
  [.68,.117,.078],[.75,.064,.053],[.778,.002,.012]
];
function profileAt(z,k) {
  let i=0; while(i<profile.length-2 && profile[i+1][0]<z)i++;
  const t=THREE.MathUtils.clamp((z-profile[i][0])/(profile[i+1][0]-profile[i][0]),0,1);
  const a=profile[Math.max(0,i-1)][k],b=profile[i][k],c=profile[i+1][k],d=profile[Math.min(profile.length-1,i+2)][k];
  return Math.max(.002,.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t));
}
function bodyGeometry() {
  const n=72,s=32,p=[],uv=[],ind=[];
  for(let i=0;i<=n;i++){
    const t=i/n,z=-.76+t*1.538,w=profileAt(z,1),h=profileAt(z,2);
    for(let j=0;j<=s;j++){const a=j/s*Math.PI*2; p.push(Math.cos(a)*w,Math.sin(a)*h-.018,z);uv.push(j/s,t);}
  }
  for(let i=0;i<n;i++)for(let j=0;j<s;j++){const a=i*(s+1)+j,b=a+s+1;ind.push(a,a+1,b,b,a+1,b+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();return g;
}
const bodyGeo=bodyGeometry();
function rand(seed){let a=seed>>>0;return ()=>{a=(a*1664525+1013904223)>>>0;return a/4294967296;};}
const skins=new Map();
function skin(type,variant){
  const key=type+variant;if(skins.has(key))return skins.get(key);
  const random=rand(931+variant*193+type.length*817),w=512,h=1024;
  const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');
  const base=type==='ogon'?'#e7bc56':type==='platinum'?'#eeeae1':'#efeee3';ctx.fillStyle=base;ctx.fillRect(0,0,w,h);
  // Belly and lateral shading live in the skin map, rather than floating on top as shapes.
  const g=ctx.createLinearGradient(0,0,w,0);g.addColorStop(0,'rgba(115,112,91,.07)');g.addColorStop(.25,'rgba(255,255,246,.16)');g.addColorStop(.5,'rgba(108,110,94,.09)');g.addColorStop(.75,'rgba(214,217,203,.17)');g.addColorStop(1,'rgba(115,112,91,.07)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  function patch(u,t,rx,ry,color){
    const x=u*w,y=(1-t)*h;ctx.fillStyle=color;ctx.beginPath();
    const points=24;for(let i=0;i<points;i++){const a=i/points*Math.PI*2,r=.8+random()*.33;const px=x+Math.cos(a)*rx*w*r,py=y+Math.sin(a)*ry*h*r;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.closePath();ctx.fill();

  }
  if(type==='kohaku'){
    patch(.25,.83,.205,.092,'#c53822');patch(.255,.56,.23,.10,'#d13d24');patch(.26,.29,.19,.087,'#ba311e');
    if(variant)patch(.39,.64,.10,.061,'#c63821');
  }else if(type==='showa'){
    patch(.25,.91,.12,.057,'#d64523');patch(.2,.63,.24,.10,'#ce4228');patch(.28,.32,.22,.09,'#c13625');
    patch(.38,.77,.19,.058,'#202521');patch(.13,.48,.16,.063,'#181f1d');patch(.31,.16,.25,.087,'#202625');patch(.43,.41,.12,.08,'#252b25');
    if(variant)patch(.12,.83,.14,.04,'#212723');
  }
  // Fine overlapping scales, following the body's UV rings. The head stays smooth.
  const bump=document.createElement('canvas');bump.width=w;bump.height=h;const b=bump.getContext('2d');b.fillStyle='#808080';b.fillRect(0,0,w,h);
  for(let row=0;row<29;row++)for(let col=0;col<30;col++){
    const x=(col+(row%2)*.5)/30*w,y=h*.22+row/29*h*.74;
    ctx.strokeStyle=type==='ogon'?'rgba(117,80,20,.12)':'rgba(59,65,57,.06)';ctx.lineWidth=.8;ctx.beginPath();ctx.ellipse(x,y,8.7,13.4,0,.04,Math.PI-.04);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,244,.095)';ctx.beginPath();ctx.ellipse(x,y-1.2,7.3,11.7,0,.15,Math.PI-.15);ctx.stroke();
    b.strokeStyle='#4d4d4d';b.lineWidth=1.6;b.beginPath();b.ellipse(x,y,8.7,13.4,0,.04,Math.PI-.04);b.stroke();b.strokeStyle='#b3b3b3';b.lineWidth=1;b.beginPath();b.ellipse(x,y-2,7.7,12,0,.12,Math.PI-.12);b.stroke();
  }
  // Operculum folds and the subtle seams behind both eyes.
  ctx.strokeStyle='rgba(86,85,72,.2)';ctx.lineWidth=2;
  for(const u of [.015,.48]){ctx.beginPath();ctx.ellipse(u*w,h*.225,31,43,0,-1.25,1.3);ctx.stroke();}
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
  const bumpMap=new THREE.CanvasTexture(bump);bumpMap.anisotropy=4;
  const result={map,bumpMap};skins.set(key,result);return result;
}
const finTextures=new Map();
function finTexture(type){if(finTextures.has(type))return finTextures.get(type);const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.fillStyle=type==='ogon'?'#f5d680':type==='platinum'?'#f3f0e5':'#efe6d5';ctx.fillRect(0,0,256,256);for(let i=0;i<24;i++){ctx.strokeStyle=i%2?'rgba(105,103,85,.17)':'rgba(255,255,245,.55)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(128,256);ctx.quadraticCurveTo(128+(i-12)*8,134,i/23*256,0);ctx.stroke();}const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;finTextures.set(type,map);return map;}

const deformDeclarations = [
  'uniform float uKoiPhase; uniform float uKoiAmplitude; uniform float uKoiTurn;',
  'float koiBend(float z){ float s=clamp((0.63-z)/1.42,0.0,1.38); return uKoiAmplitude*s*s*sin(uKoiPhase-s*5.1)+uKoiTurn*s*s*0.14; }'
].join('\n');
function attachDeformation(mat,uniforms,causticTime,caustics=true,finDeform=false){
  mat.onBeforeCompile=shader=>{
    shader.uniforms.uKoiPhase=uniforms.phase;shader.uniforms.uKoiAmplitude=uniforms.amplitude;shader.uniforms.uKoiTurn=uniforms.turn;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+deformDeclarations+'\nvarying vec3 vKoiWorld;'+(finDeform?'\nattribute vec4 aFin;':''));
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nfloat bendSlope=(koiBend(position.z+0.003)-koiBend(position.z-0.003))/0.006; objectNormal.z-=objectNormal.x*bendSlope; objectNormal=normalize(objectNormal);');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n'+(finDeform?'if(abs(aFin.z)>0.5){float d=abs(position.x-aFin.x);float flap=-0.18+sin(uKoiPhase*0.77+aFin.w*0.8)*0.13;transformed.y+=d*flap;transformed.z+=d*sin(uKoiPhase*0.77+0.5)*0.08;}\n':'')+'transformed.x+=koiBend(position.z);');
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvKoiWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
    if(caustics){shader.uniforms.uCausticTime=causticTime;shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uCausticTime; varying vec3 vKoiWorld;');shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\nvec2 cp=vKoiWorld.xz*3.4; cp+=vec2(sin(cp.y+uCausticTime*0.5),cos(cp.x-uCausticTime*0.4))*0.35; float cc=pow(1.0-abs(sin(cp.x+cp.y*0.7+uCausticTime*0.7)*sin(cp.y*1.2-cp.x*0.63-uCausticTime*0.6)),18.0); totalEmissiveRadiance+=diffuseColor.rgb*cc*0.15;');}
  };
  mat.customProgramCacheKey=()=>finDeform?'koi-fins-3':caustics?'koi-skin-3':'koi-depth-3';
}
function fanGeometry(side=1){
  const p=[0,0,0],uv=[.5,1],ind=[];const shape=new THREE.Shape();shape.moveTo(0,0);shape.bezierCurveTo(side*.14,.075,side*.29,.04,side*.315,-.075);shape.bezierCurveTo(side*.31,-.16,side*.18,-.255,side*.055,-.21);shape.quadraticCurveTo(side*.024,-.095,0,0);const pts=shape.getPoints(24);
  for(const point of pts){p.push(point.x,-.018,point.y);uv.push(.5+point.x*1.15,1+(point.y-.1)*2.5);}
  for(let i=1;i<pts.length;i++)ind.push(0,i,i+1);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();return g;
}
function tailGeometry(){
  const p=[0,-.02,-.72],uv=[.5,1],ind=[];const outline=[[-.12,.26,-1.145],[-.065,.12,-1.035],[0,0,-.94],[.055,-.13,-1.04],[.125,-.26,-1.15],[.07,-.18,-.98],[.02,-.05,-.75]];
  for(const [x,y,z]of outline){p.push(x,y,z);uv.push(.5+y*1.6,THREE.MathUtils.clamp((z+1.15)/.43,0,1));}
  for(let i=1;i<outline.length;i++)ind.push(0,i,i+1);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();return g;
}
const tailGeo=tailGeometry(),fanLeft=fanGeometry(-1),fanRight=fanGeometry(1);
const dorsalGeo=new THREE.BufferGeometry();dorsalGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,.12,.18,0,.29,-.02,0,.265,-.29,0,.15,-.55],3));dorsalGeo.setAttribute('uv',new THREE.Float32BufferAttribute([.5,1,.2,0,.8,.2,.5,1],2));dorsalGeo.setIndex([0,1,2,0,2,3]);dorsalGeo.computeVertexNormals();
const eyeMat=new THREE.MeshPhysicalMaterial({color:0x101713,roughness:.12,clearcoat:1});
const irisMat=new THREE.MeshStandardMaterial({color:0x86754f,roughness:.5});
const sphere=new THREE.SphereGeometry(1,16,10);

function mergePieces(pieces,withFinFlags=false){
  const positions=[],normals=[],uvs=[],indices=[],flags=[];let offset=0;
  for(const piece of pieces){const geo=piece.geo,p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv;const at=piece.at||[0,0,0],scale=piece.scale||1;
    for(let i=0;i<p.count;i++){positions.push(p.getX(i)*scale+at[0],p.getY(i)*scale+at[1],p.getZ(i)*scale+at[2]);normals.push(n.getX(i),n.getY(i),n.getZ(i));uvs.push(uv?.getX(i)||0,uv?.getY(i)||0);if(withFinFlags)flags.push(...(piece.flag||[0,0,0,0]));}
    if(geo.index)for(let i=0;i<geo.index.count;i++)indices.push(geo.index.getX(i)+offset);else for(let i=0;i<p.count;i++)indices.push(offset+i);offset+=p.count;
  }
  const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));out.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));out.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));if(withFinFlags)out.setAttribute('aFin',new THREE.Float32BufferAttribute(flags,4));out.setIndex(indices);return out;
}
const finPieces=[{geo:tailGeo},{geo:dorsalGeo}];
for(const side of [-1,1])for(const pelvic of [false,true]){
  const x=side*(pelvic?.116:.214),z=pelvic?-.32:.30;finPieces.push({geo:side<0?fanLeft:fanRight,at:[x,pelvic?-.071:-.047,z],scale:pelvic?.49:1,flag:[x,z,side,pelvic?1:0]});
}
const allFinsGeo=mergePieces(finPieces,true);
const mouthPieces=[];
for(const side of [-1,1]){const barbel=new THREE.CatmullRomCurve3([new THREE.Vector3(side*.079,-.057,.705),new THREE.Vector3(side*.118,-.06,.765),new THREE.Vector3(side*.164,-.063,.774)]);mouthPieces.push({geo:new THREE.TubeGeometry(barbel,10,.007,5,false)});}
const lipsGeo=new THREE.TorusGeometry(.042,.008,6,20);lipsGeo.scale(1,.57,1);mouthPieces.push({geo:lipsGeo,at:[0,-.035,.766]});const mouthGeo=mergePieces(mouthPieces);

export function createKoi(type,seed=1,timeUniform={value:0}){
  const root=new THREE.Group(),random=rand(seed*709+41),uniforms={phase:{value:random()*6},amplitude:{value:.105},turn:{value:0}};
  const {map,bumpMap}=skin(type,seed%2);
  const bodyMat=new THREE.MeshPhysicalMaterial({map,bumpMap,bumpScale:.0035,roughness:type==='ogon'?.37:.4,metalness:type==='ogon'?.2:type==='platinum'?.07:.025,clearcoat:.85,clearcoatRoughness:.22,envMapIntensity:.75});
  attachDeformation(bodyMat,uniforms,timeUniform);
  const body=new THREE.Mesh(bodyGeo,bodyMat);body.castShadow=true;body.receiveShadow=true;root.add(body);
  const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});attachDeformation(depth,uniforms,timeUniform,false);body.customDepthMaterial=depth;
  const finMat=new THREE.MeshPhysicalMaterial({color:type==='ogon'?0xf7d788:0xfff9ed,map:finTexture(type),roughness:.44,clearcoat:.35,side:THREE.DoubleSide,transparent:true,opacity:.73,depthWrite:false,envMapIntensity:.5});
  attachDeformation(finMat,uniforms,timeUniform,true,true);const fins=new THREE.Mesh(allFinsGeo,finMat);root.add(fins);
  const iris=new THREE.InstancedMesh(sphere,irisMat,2),eyes=new THREE.InstancedMesh(sphere,eyeMat,2),d=new THREE.Object3D();
  [-1,1].forEach((side,i)=>{d.position.set(side*.155,.052,.55);d.scale.set(.023,.027,.032);d.updateMatrix();iris.setMatrixAt(i,d.matrix);d.position.set(side*.166,.070,.55);d.scale.set(.021,.026,.027);d.updateMatrix();eyes.setMatrixAt(i,d.matrix);});
  iris.instanceMatrix.needsUpdate=true;eyes.instanceMatrix.needsUpdate=true;root.add(iris,eyes);
  const mouth=new THREE.Mesh(mouthGeo,new THREE.MeshStandardMaterial({color:type==='ogon'?0xd8b66e:0xcfbfa8,roughness:.67}));root.add(mouth);
  root.scale.setScalar(.92+random()*.22);
  return {root,body,fins,uniforms,phase:uniforms.phase.value,amplitude:.105,skin:bodyMat,ownedMaterials:[bodyMat,depth,finMat,mouth.material]};
}
export function animateKoi(f,dt,speed,turn){
  f.phase+=dt*(4.9+speed*2.6);f.uniforms.phase.value=f.phase;f.uniforms.amplitude.value=.085+speed*.055;f.uniforms.turn.value=THREE.MathUtils.lerp(f.uniforms.turn.value,turn,dt*3);
}

export function disposeKoi(f){f.root.removeFromParent();f.root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});for(const m of f.ownedMaterials)m.dispose();}
