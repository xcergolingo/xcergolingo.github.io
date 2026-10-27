/*
 * 御剑飞仙 / SWORD RIDING IMMORTAL
 * Pure Three.js r186. All models, clouds, textures and sound are generated here.
 * The single-file build includes the engine, so it also runs from file:// offline.
 * World units are metres. +Y is up. Flight is camera-relative in the XZ plane.
 *
 * Music direction: a slow, sparse guqin / xiao duet in D pentatonic, soft wind,
 * long reverb and no percussion. The optional Web Audio score below uses quiet
 * plucked sine harmonics and a filtered wind bed as a self-contained substitute.
 */
'use strict';
const {THREE:T,EffectComposer,RenderPass,UnrealBloomPass,ShaderPass,BokehPass,OutputPass,mergeGeometries}=ImmortalEngine;
const $=id=>document.getElementById(id);
let fatal=false;
function fail(message){fatal=true;$('loading').style.display='none';$('errorText').textContent=message;$('error').style.display='block';}
window.addEventListener('error',e=>{console.error(e.error);if(!window.realmReady&&!fatal)fail(e.message||'WebGL is unavailable. Try a current browser with hardware acceleration enabled.');});

// A deterministic seed keeps the same hand-composed world on every visit.
let seed=72191;
function random(){seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;}
const rand=(a,b)=>a+(b-a)*random(), clamp=T.MathUtils.clamp, V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const scene=new T.Scene();scene.fog=new T.FogExp2(0xb6ccd1,.00105);
let renderer;
try{renderer=new T.WebGLRenderer({antialias:false,alpha:false,powerPreference:'high-performance'});}catch(e){fail('This browser could not create a WebGL 2 canvas. Open this file in a current Safari, Chrome, Firefox, or Edge browser.');throw e;}
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);renderer.domElement.setAttribute('aria-label','Sword flight through floating Chinese palaces');
const camera=new T.PerspectiveCamera(53,innerWidth/innerHeight,.5,3300);
const hemisphere=new T.HemisphereLight(0xc7eafa,0x7f8893,2.1);scene.add(hemisphere);
const sun=new T.DirectionalLight(0xffe2ad,3.6);sun.position.set(-240,330,-230);sun.target.position.set(0,100,-20);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-250,right:250,top:250,bottom:-250,near:5,far:800});sun.shadow.bias=-.00025;sun.shadow.normalBias=.3;scene.add(sun,sun.target);
const fill=new T.DirectionalLight(0x80d9ff,.75);fill.position.set(100,140,180);scene.add(fill);

// An analytic sky gradient, warm solar aureole and wispy high-altitude streaks.
const skyUniforms={sunDir:{value:V(-.63,.24,-.74).normalize()}};
const sky=new T.Mesh(new T.SphereGeometry(2800,40,24),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:skyUniforms,
vertexShader:`varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
fragmentShader:`varying vec3 vD;uniform vec3 sunDir;void main(){vec3 d=normalize(vD);float h=max(d.y,0.);vec3 c=mix(vec3(.84,.88,.83),vec3(.23,.53,.68),pow(h,.58));float s=max(dot(d,sunDir),0.);c+=vec3(.75,.43,.16)*pow(s,9.)*.46;c+=vec3(1.,.77,.39)*pow(s,190.)*.65;c+=vec3(1.,.91,.68)*smoothstep(.9995,.99985,s)*2.;float w=sin(d.x*29.+d.z*36.+sin(d.z*15.)*2.)*.5+.5;c=mix(c,vec3(.88,.9,.86),pow(w,18.)*smoothstep(.15,.6,h)*.09);gl_FragColor=vec4(c,1.);}`
}));scene.add(sky);

// Procedural soft textures: cloudy billboards have irregular, layered silhouettes.
function softTexture(kind){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');
 if(kind==='cloud'){for(let i=0;i<36;i++){const x=128+rand(-70,70),y=128+rand(-48,48),r=rand(28,62);const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,255,255,.15)');g.addColorStop(.42,'rgba(255,255,255,.11)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}}
 else{const g=ctx.createRadialGradient(128,128,0,128,128,128);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.15,'rgba(255,255,255,.8)');g.addColorStop(.45,'rgba(255,255,255,.2)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,256,256);}
 const texture=new T.CanvasTexture(c);return texture;}
const cloudMap=softTexture('cloud'),glowMap=softTexture('glow');
const clouds=new T.Group();scene.add(clouds);
const cloudGeo=new T.PlaneGeometry(1,1);
const cloudMat=new T.MeshBasicMaterial({map:cloudMap,color:0xf5f4e7,transparent:true,opacity:.75,depthWrite:false,side:T.DoubleSide});
// Instancing avoids hundreds of separate cloud draw calls. Billboards face camera.
const cloudCount=650,cloudMesh=new T.InstancedMesh(cloudGeo,cloudMat,cloudCount);cloudMesh.frustumCulled=false;clouds.add(cloudMesh);
const cloudSeeds=[];for(let i=0;i<cloudCount;i++){const a=rand(0,Math.PI*2),r=Math.sqrt(random())*1900;cloudSeeds.push({x:Math.cos(a)*r,y:rand(-26,24),z:Math.sin(a)*r,s:rand(100,240),a:rand(-.25,.25)});const tint=new T.Color().setRGB(rand(.86,1),rand(.89,.98),rand(.92,1));cloudMesh.setColorAt(i,tint);}
const cloudDummy=new T.Object3D();
// Broad horizontal translucent layers fill the gaps beneath the billowing clouds.
for(let i=0;i<5;i++){const plane=new T.Mesh(new T.PlaneGeometry(7000,7000),new T.MeshBasicMaterial({color:0xc4d5d6,transparent:true,opacity:.16,depthWrite:false,side:T.DoubleSide}));plane.rotation.x=-Math.PI/2;plane.position.y=-30-i*14;scene.add(plane);}

const mats={};
function material(name,color,roughness=.75,metalness=0,emissive=0,intensity=0){return mats[name]=new T.MeshStandardMaterial({color,roughness,metalness,emissive,emissiveIntensity:intensity});}
const stone=material('stone',0xe9ede4),stoneEdge=material('stoneEdge',0xf6f2dc),stoneShade=material('stoneShade',0x9ab7bd),rock=material('rock',0x758e98),rockLight=material('rockLight',0xa2b9bc),roofMat=material('roof',0x175bd2,.32,.22,0x1d7db1,.12),roofDark=material('roofDark',0x195779,.42,.15),gold=material('gold',0xffcc53,.3,.55,0x896120,.07),wood=material('wood',0x6a4e3b),pillar=material('pillar',0x4a818e,.45,.12),door=material('door',0x194b60),leaf=material('leaf',0x53817b),leafLight=material('leafLight',0x91aaa0),pink=material('pink',0xf4cfbd),pink2=material('pink2',0xd9a8a1),lanternMat=material('lantern',0xffdf9b,.4,.05,0xffc267,1.1),robeMat=material('robe',0xecf5f3,.7),blueSilk=material('blueSilk',0x76bdcf,.55),hairMat=material('hair',0x18313e),skin=material('skin',0xeac7ae),swordMetal=material('swordMetal',0xc4f5ff,.2,.65,0x45bcff,1.3);
const lineMat=new T.MeshBasicMaterial({color:0x8deaff,transparent:true,opacity:.9});
const unitBox=new T.BoxGeometry(1,1,1),unitSphere=new T.SphereGeometry(1,8,6),unitCylinder=new T.CylinderGeometry(1,1,1,10);
const wordPlaces=[];
const staticRoots=[],landings=[],obstacles=[],banners=[],lanterns=[],cranes=[],flowing=[];
function mesh(g,m,parent,x=0,y=0,z=0,sx=1,sy=sx,sz=sx){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function box(p,x,y,z,w,h,d,m=stone){return mesh(unitBox,m,p,x,y,z,w,h,d);}
function sphere(p,x,y,z,s,m,sx=1,sy=1,sz=1){return mesh(unitSphere,m,p,x,y,z,s*sx,s*sy,s*sz);}
function cylinder(p,x,y,z,r,h,m=stone){return mesh(unitCylinder,m,p,x,y,z,r,h,r);}
function line(p,a,b,r,m){const d=b.clone().sub(a),o=cylinder(p,...a.clone().add(b).multiplyScalar(.5).toArray(),r,d.length(),m);o.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());return o;}
function curveTube(p,pts,r,m){return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),Math.max(10,pts.length*2),r,4,false),m,p);}
function torus(p,x,y,z,r,t,m,rotation=Math.PI/2){const o=mesh(new T.TorusGeometry(r,t,6,64),m,p,x,y,z);o.rotation.x=rotation;return o;}
function addLanding(x,y,z,r){landings.push({type:'circle',x,y,z,r});}
function addBuildingBlock(x,z,w,d,y,h){obstacles.push({x,z,w,d,y,top:y+h});}

// Curved hipped roofs, with lifted corners, gold eaves and individual glazed ribs.
function roof(parent,y,w,d,h){const group=new T.Group();group.position.y=y;parent.add(group);
 for(let side=0;side<4;side++){
  const half=side%2?d:w,depth=side%2?w:d,local=new T.Group();local.rotation.y=side*Math.PI/2;group.add(local);
  function point(u,t){return V(u*half*t,h*Math.pow(1-t,1.65)+.6*Math.pow(t,7)+.65*Math.pow(Math.abs(u),6)*Math.pow(t,4),depth*t);}
  const pos=[],uv=[],indices=[],cols=[],nu=14,nt=10;
  for(let j=0;j<=nt;j++)for(let i=0;i<=nu;i++){const u=i/nu*2-1,t=j/nt,p=point(u,t);pos.push(...p.toArray());uv.push(i/nu,t);const v=(i%2?.88:1.03)*(j%2?.97:1);cols.push(v,v,v);}
  for(let j=0;j<nt;j++)for(let i=0;i<nu;i++){let a=j*(nu+1)+i,b=a+nu+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();mesh(geometry,roofMat,local);
  // Fine rows and channels catch the low sun without expensive texture maps.
  for(let i=0;i<=nu;i++){const pts=[];for(let j=2;j<=10;j++)pts.push(point(i/nu*2-1,j/10).add(V(0,.045,0)));curveTube(local,pts,.055,side%2?roofDark:roofMat);}
  const edge=[];for(let i=0;i<=16;i++)edge.push(point(i/8-1,1));curveTube(local,edge,.13,gold);
  for(let u of [-1,1]){const pts=[];for(let j=0;j<=10;j++)pts.push(point(u,j/10).add(V(0,.07,0)));curveTube(local,pts,.10,gold);const tip=point(u,1);sphere(local,tip.x,tip.y+.22,tip.z,.19,gold);}
 }
 cylinder(group,0,h+.35,0,.14,.9,gold);sphere(group,0,h+.85,0,.28,gold);
 return group;}
function railing(parent,x1,z1,x2,z2,y,spacing=3){const a=V(x1,y,z1),b=V(x2,y,z2),len=a.distanceTo(b),n=Math.max(1,Math.round(len/spacing));
 for(let i=0;i<=n;i++){const p=a.clone().lerp(b,i/n);box(parent,p.x,y+.7,p.z,.35,1.4,.35,stoneEdge);sphere(parent,p.x,y+1.48,p.z,.26,stoneEdge);}
 line(parent,V(x1,y+.4,z1),V(x2,y+.4,z2),.10,stoneShade);line(parent,V(x1,y+1.15,z1),V(x2,y+1.15,z2),.12,stoneEdge);
}
function lantern(parent,x,y,z,scale=1,dynamic=false){const g=new T.Group();g.position.set(x,y,z);g.scale.setScalar(scale);parent.add(g);
 cylinder(g,0,.4,0,.12,1.5,gold);const shade=mesh(new T.SphereGeometry(.65,10,8),lanternMat,g,0,0,0,1,1.35,1);cylinder(g,0,.75,0,.46,.14,gold);cylinder(g,0,-.75,0,.42,.14,gold);line(g,V(0,-.8,0),V(0,-1.65,0),.045,gold);sphere(g,0,-1.65,0,.1,gold);
 for(let a=0;a<6;a++){const th=a/6*Math.PI*2;line(g,V(Math.cos(th)*.54,-.55,Math.sin(th)*.54),V(Math.cos(th)*.54,.55,Math.sin(th)*.54),.025,gold);}
 if(dynamic){batchStatic(g);g.userData.dynamic=true;lanterns.push({g,y,phase:rand(0,6.28)});}return g;}
function flag(parent,x,y,z,angle=0){const g=new T.Group();g.position.set(x,y,z);g.rotation.y=angle;parent.add(g);cylinder(g,0,3.7,0,.10,7.4,gold);sphere(g,0,7.5,0,.22,gold);line(g,V(0,7,0),V(2.7,7,0),.08,gold);
 const geom=new T.PlaneGeometry(2.3,4,9,14);geom.translate(1.25,4.8,0);const m=new T.MeshStandardMaterial({color:0x367d9b,metalness:.15,roughness:.55,side:T.DoubleSide});const cloth=new T.Mesh(geom,m);cloth.userData.dynamic=true;cloth.castShadow=true;g.add(cloth);banners.push({mesh:cloth,base:geom.attributes.position.array.slice(),phase:rand(0,9)});
 // Gold tassels and emblem are attached to the same moving flag group.
 const emblem=torus(g,1.25,4.7,.06,.55,.035,gold,0);box(g,1.25,4.7,.065,.07,1.4,.02,gold);line(g,V(.15,2.75,0),V(2.4,2.75,0),.045,gold);}

function tree(parent,x,y,z,s=1,blossom=false){const g=new T.Group();g.position.set(x,y,z);g.scale.setScalar(s);parent.add(g);
 const trunk=V(.4,5,0);line(g,V(0,0,0),trunk,.32,wood);line(g,trunk,V(-1,8,.3),.2,wood);
 for(let i=0;i<7;i++){const a=i*2.4,h=3+i*.7,end=V(Math.cos(a)*(2.2+(i%2)),h+1.6,Math.sin(a)*2);line(g,V(.3,h,0),end,.12,wood);sphere(g,end.x,end.y+.7,end.z,2.1,blossom?(i%2?pink:pink2):(i%2?leaf:leafLight),1.5,.48,1.05);}
 sphere(g,-1,8.6,.3,2,blossom?pink:leaf,1.3,.55,1);}
function temple(parent,x,z,w=14,d=11,tiers=3){const root=new T.Group();root.position.set(x,0,z);parent.add(root);
 box(root,0,.5,0,w+5,1,d+5,stoneShade);box(root,0,1.15,0,w+4,.3,d+4,stoneEdge);
 for(let i=0;i<5;i++){box(root,0,.12+i*.19,d/2+5-i*.55,w*.62,.24+i*.38,1.2,stoneEdge);}
 let y=1.3;
 for(let t=0;t<tiers;t++){
 const tw=w*Math.pow(.71,t),td=d*Math.pow(.71,t),h=t===0?7:4.8;
 box(root,0,y+h*.46,0,tw-2,h*.9,td-1.5,stone);box(root,0,y+.25,0,tw+1,.5,td+1,stoneShade);
 for(const sx of [-1,1])for(const sz of [-1,1]){cylinder(root,sx*tw/2,y+h*.48,sz*td/2,.3,h,pillar);cylinder(root,sx*tw/2,y+.25,sz*td/2,.46,.45,gold);cylinder(root,sx*tw/2,y+h-.35,sz*td/2,.47,.25,gold);}
 for(let j=-1;j<=1;j++){const xx=j*tw*.28;box(root,xx,y+h*.45,td/2-.6,tw*.2,h*.67,.25,door);for(let k=-1;k<=1;k++)box(root,xx+k*tw*.06,y+h*.45,td/2-.43,.06,h*.65,.06,gold);for(let k=0;k<4;k++)box(root,xx,y+.8+k*h*.17,td/2-.4,tw*.19,.06,.07,gold);}
 box(root,0,y+h-.3,0,tw+.7,.45,td+.7,gold);roof(root,y+h,tw*.68,td*.72,3.4-(t*.3));
 if(t===0){for(let sx of [-1,1]){lantern(root,sx*(tw/2+.5),y+h-1.6,td/2+.4,.75);railing(root,sx*(tw/2+1.3),-td/2,sx*(tw/2+1.3),td/2,y+.2,2.2);}}
 y+=h+1.9;
 }
 return {root,height:y+4,width:w+5,depth:d+6};}
function pavilion(parent,x,z,s=1){wordPlaces.push(V(parent.position.x+x,parent.position.y+3,parent.position.z+z));const root=new T.Group();root.position.set(x,0,z);root.scale.setScalar(s);parent.add(root);
 cylinder(root,0,.25,0,5.4,.5,stoneEdge);cylinder(root,0,.6,0,4.7,.25,stoneShade);
 for(let a=0;a<4;a++){const xx=a%2?3.2:-3.2,zz=a<2?-3.2:3.2;cylinder(root,xx,3.8,zz,.2,6.4,pillar);cylinder(root,xx,.9,zz,.34,.25,gold);lantern(root,xx,5.6,zz,.5);}
 roof(root,6.8,5.3,5.3,2.6);cylinder(root,0,1.35,0,1.4,.3,stoneEdge);cylinder(root,0,1,0,.4,.7,stone);return root;}

const sanctuaries=[
 {name:'玉虚宫',en:'Jade Heaven Palace',sub:'THE HEART OF THE CELESTIAL REALM',x:0,y:108,z:-110,r:49},
 {name:'听风台',en:'Whispering Wind Terrace',sub:'WHERE THE CRANES GATHER',x:-160,y:118,z:25,r:27},
 {name:'揽月阁',en:'Moon Embrace Pavilion',sub:'A STILLNESS ABOVE THE WORLD',x:145,y:144,z:-200,r:27},
 {name:'桃花境',en:'Peach Blossom Sanctuary',sub:'TEN THOUSAND PETALS IN THE WIND',x:165,y:94,z:90,r:31},
 {name:'归云峰',en:'Returning Cloud Summit',sub:'THE LAST STEP BEFORE THE SKY',x:-205,y:171,z:-280,r:29}
];
function island(x,y,z,r,idx=-1){const g=new T.Group();g.position.set(x,y,z);scene.add(g);staticRoots.push(g);
 cylinder(g,0,-1.1,0,r,2.2,stone);cylinder(g,0,-2.5,0,r*1.02,.65,stoneShade);cylinder(g,0,-3,0,r*.98,.35,gold);cylinder(g,0,.06,0,r*.985,.16,stoneEdge);
 const cone=mesh(new T.ConeGeometry(r*.91,r*1.7,9,3),rock,g,0,-r*.85-3,0);cone.rotation.z=Math.PI;cone.rotation.y=rand(0,2);
 for(let i=0;i<15;i++){const a=i*2.4,rad=r*rand(.45,.78);const sh=rand(r*.25,r*.8);const crag=mesh(new T.ConeGeometry(rand(3,8),sh,5),i%3?rockLight:rock,g,Math.cos(a)*rad,-sh*.4-4,Math.sin(a)*rad);crag.rotation.z=Math.PI+rand(-.22,.22);}
 // Concentric courtyard inlays and twelve radial stones.
 torus(g,0,.18,0,r*.84,.055,gold);torus(g,0,.18,0,r*.55,.06,stoneShade);
 for(let i=0;i<12;i++){const a=i*Math.PI/6;line(g,V(Math.sin(a)*r*.5,.15,Math.cos(a)*r*.5),V(Math.sin(a)*r*.94,.15,Math.cos(a)*r*.94),.025,stoneShade);}
 for(let i=0;i<24;i++){const a=i*Math.PI*2/24,b=(i+1)*Math.PI*2/24;if(i%6===0)continue;railing(g,Math.sin(a)*(r-1),Math.cos(a)*(r-1),Math.sin(b)*(r-1),Math.cos(b)*(r-1),.12,3);}
 // Small hanging gardens break up the hard floating silhouette.
 for(let i=0;i<10;i++){const a=rand(0,6.28),rr=r*.95;const len=rand(3,12);curveTube(g,[V(Math.sin(a)*rr,-2,Math.cos(a)*rr),V(Math.sin(a)*(rr+1),-len*.5,Math.cos(a)*(rr+1)),V(Math.sin(a)*rr,-len,Math.cos(a)*rr)],.14,leaf);for(let j=0;j<4;j++)sphere(g,Math.sin(a)*rr,-2-j*len/4,Math.cos(a)*rr,1.3,leaf,1,.55,1);}
 addLanding(x,y+.15,z,r-1);return g;}

// Central axial palace, flanking pavilions, grand entrance stairs and banners.
for(let i=0;i<sanctuaries.length;i++){const s=sanctuaries[i],g=island(s.x,s.y,s.z,s.r,i);
 if(i===0){const main=temple(g,0,-9,23,17,3);addBuildingBlock(s.x,s.z-9,28,23,s.y,main.height);
  pavilion(g,-30,2,1.05);pavilion(g,30,2,1.05);for(let side of [-1,1]){tree(g,side*29,0,-25,1.4);tree(g,side*31,0,24,.95,true);flag(g,side*12,0,29,side<0?0:Math.PI);flag(g,side*32,0,14,side<0?0:Math.PI);}
  for(let j=0;j<7;j++)box(g,0,.06,17+j*3.7,12,.14,3.3,j%2?stone:stoneShade);
  torus(g,0,.22,22,5,.12,gold);const emblem=torus(g,0,.23,22,3.2,.08,gold);for(let a=0;a<8;a++){const theta=a*Math.PI/4;line(g,V(Math.sin(theta)*3.6,.25,22+Math.cos(theta)*3.6),V(Math.sin(theta)*4.8,.25,22+Math.cos(theta)*4.8),.1,gold);}
 }else if(i===3){pavilion(g,0,-5,1.5);for(let j=0;j<8;j++){const a=j*2.4;tree(g,Math.sin(a)*s.r*.7,0,Math.cos(a)*s.r*.7,rand(.8,1.3),true);}cylinder(g,0,.2,9,4,.2,stoneShade);torus(g,0,.35,9,4,.1,gold);
 }else{if(i===4){const building=temple(g,0,-5,13,11,3);addBuildingBlock(s.x,s.z-5,18,17,s.y,building.height);}else pavilion(g,0,-4,1.8);for(let side of [-1,1]){tree(g,side*(s.r-9),0,-6,1.2,i===2);flag(g,side*9,0,12,side<0?0:Math.PI);}}
 for(let j=0;j<5;j++){const a=j*1.25;lantern(g,Math.sin(a)*s.r*.8,rand(5,10),Math.cos(a)*s.r*.8,rand(.6,.9),true);}
}
// Smaller islands lead the eye toward the horizon, with distinctly readable roofs.
for(const spec of [[-78,92,132,17],[70,103,190,13],[-290,102,-90,16],[290,129,-90,17],[85,182,-405,20],[-340,208,-460,18],[355,183,-370,23],[-60,140,-375,14]]){const[x,y,z,r]=spec,g=island(x,y,z,r);pavilion(g,0,0,r/17);tree(g,-r*.6,0,3,.7);}

function bridge(a,b,width=7){const p0=V(a.x,a.y,a.z),p1=V(b.x,b.y,b.z),dir=p1.clone().sub(p0),len=Math.hypot(dir.x,dir.z),yaw=Math.atan2(dir.x,dir.z),g=new T.Group();g.position.copy(p0);g.rotation.y=yaw;scene.add(g);staticRoots.push(g);const n=Math.ceil(len/5);
 function height(t){return (b.y-a.y)*t+Math.sin(t*Math.PI)*4;}
 for(let i=0;i<n;i++){const t=(i+.5)/n,zz=t*len,yy=height(t);const slab=box(g,0,yy-.4,zz,width,.8,len/n+.08,stoneEdge);slab.rotation.x=-Math.atan2(height((i+1)/n)-height(i/n),len/n);if(i%2===0){for(let side of [-1,1]){box(g,side*(width/2-.2),yy+.7,zz,.3,1.4,.3,stone);sphere(g,side*(width/2-.2),yy+1.45,zz,.22,gold);}}}
 for(let side of [-1,1]){const pts=[];for(let i=0;i<=n;i++)pts.push(V(side*(width/2-.2),height(i/n)+1.12,i/n*len));curveTube(g,pts,.105,stoneEdge);const low=pts.map(p=>p.clone().add(V(0,-.65,0)));curveTube(g,low,.065,gold);}
 for(let i=1;i<4;i++){const t=i/4;
// Reference-inspired white bridge piers, gilded capitals and suspended blue banners.
box(g,0,height(t)-5,len*t,width+1,10,2.4,stone);box(g,0,height(t)-9.5,len*t,width+1.8,.6,3,gold);
for(const side of [-1,1]){const tower=new T.Group();tower.position.set(side*(width/2+2),height(t),len*t);g.add(tower);box(tower,0,2.5,0,2.6,5,2.6,stone);box(tower,0,3,1.34,1.3,2.8,.08,roofMat);roof(tower,5.2,2.3,2.3,1.7);lantern(tower,0,4.3,2,.45);}
flag(g,(i%2?1:-1)*(width/2+.5),height(t),len*t,i%2?0:Math.PI);}
 // Collision shares the exact parabolic bridge height profile used above.
 landings.push({type:'bridge',a:p0,b:p1,width:width/2,len,dir:V(dir.x,0,dir.z).normalize()});}
bridge({x:-42,y:108,z:-88},{x:-140,y:118,z:8});
bridge({x:40,y:108,z:-126},{x:124,y:144,z:-190},6);
bridge({x:17,y:108,z:-68},{x:145,y:94,z:76},7);
bridge({x:-175,y:118,z:5},{x:-203,y:171,z:-252},6);

// Layered snow-capped mountain silhouettes have real 3-D depth and atmospheric haze.
for(let ring=0;ring<2;ring++){const mountains=new T.Group();scene.add(mountains);staticRoots.push(mountains);const mountainMaterial=new T.MeshStandardMaterial({color:ring?0x9bb3be:0x7e9eaf,roughness:1});for(let i=0;i<27;i++){const a=i/27*Math.PI*2+ring*.15,rr=1100+ring*500,hh=rand(100,290),radius=rand(90,200),g=new T.Group();g.position.set(Math.sin(a)*rr,-60,Math.cos(a)*rr);mountains.add(g);const m=mountainMaterial;const peak=mesh(new T.ConeGeometry(radius,hh,9,3),m,g,0,hh/2,0);peak.rotation.y=rand(0,6);const snow=mesh(new T.ConeGeometry(radius*.32,hh*.32,9,2),stone,g,0,hh*.865,0);snow.rotation.y=peak.rotation.y;}}

// Merge each spatial island into a small number of material batches. This keeps
// detailed rails, tiles and lattice windows affordable without external models.
function batchStatic(root){root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),bins=new Map(),remove=[];
 root.traverse(o=>{if(!o.isMesh)return;let p=o;while(p&&p!==root){if(p.userData.dynamic)return;p=p.parent;}
  if(Array.isArray(o.material))return;let g=o.geometry.clone();if(g.index)g=g.toNonIndexed();g.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld));for(const key of Object.keys(g.attributes))if(!['position','normal','uv'].includes(key))g.deleteAttribute(key);if(!g.attributes.uv)g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));const key=o.material.uuid;if(!bins.has(key))bins.set(key,{mat:o.material,geos:[]});bins.get(key).geos.push(g);remove.push(o);});
 remove.forEach(o=>o.parent.remove(o));for(const {mat,geos} of bins.values()){const merged=mergeGeometries(geos,false);if(merged){const m=new T.Mesh(merged,mat);m.castShadow=true;m.receiveShadow=true;root.add(m);}geos.forEach(g=>g.dispose());}}
// Southern Heavenly Gate: three open bays, stepped white terrace and gold plaque.
const heavenlyGate=new T.Group();heavenlyGate.position.set(0,108,-65);scene.add(heavenlyGate);staticRoots.push(heavenlyGate);
for(let step=0;step<7;step++)box(heavenlyGate,0,.12+step*.16,5-step*.62,23,.24+step*.32,.9,stoneEdge);
for(const x of [-11,-5.4,5.4,11]){cylinder(heavenlyGate,x,5.5,0,.48,11,gold);cylinder(heavenlyGate,x,.6,0,.8,1.2,stoneEdge);box(heavenlyGate,x,10,0,1.5,.6,1.5,gold);}
box(heavenlyGate,0,10.5,0,24,.65,2.2,pillar);roof(heavenlyGate,11,7.2,3.3,3.0);
for(const x of [-9,9]){const wing=new T.Group();wing.position.set(x,0,0);heavenlyGate.add(wing);roof(wing,9,4.1,2.8,2.0);lantern(wing,0,7,0,.8);}
const plaqueTexture=labelTexture('南 天 门');const plaque=mesh(new T.PlaneGeometry(7,1.8),new T.MeshBasicMaterial({map:plaqueTexture}),heavenlyGate,0,9.7,1.2);
// Open circular moon gate on the side courtyard, with a low blue-tiled canopy.
const moonGate=new T.Group();moonGate.position.set(31,108,-125);scene.add(moonGate);staticRoots.push(moonGate);
torus(moonGate,0,4.5,0,4.5,.52,stoneEdge,0);torus(moonGate,0,4.5,.32,4.5,.09,gold,0);
for(const x of [-6,6])box(moonGate,x,3,0,3.3,6,1.3,stone);roof(moonGate,8.5,8.5,2.2,2.5);
for(const x of [-6,6])lantern(moonGate,x,6.6,1,.8);
// Golden palace doors and a broader ceremonial stairway.
const palaceDetail=new T.Group();palaceDetail.position.set(0,108,-110);scene.add(palaceDetail);staticRoots.push(palaceDetail);
for(let i=0;i<8;i++)box(palaceDetail,0,.12+i*.15,6-i*.65,15,.24+i*.30,.8,stoneEdge);
for(const x of [-1.7,1.7]){box(palaceDetail,x,4.3,-.95,3.2,5.5,.12,gold);for(let row=0;row<5;row++)for(let col=0;col<3;col++)sphere(palaceDetail,x+(col-1)*.85,2.3+row*.9,-.82,.09,gold);}
staticRoots.forEach(batchStatic);

// Immortal rider: a fitted upper robe, layered flowing skirt, open sleeves,
// flowing black hair, floral gold ornaments, layered embroidered silk and an ornate cyan sword.
const player=new T.Group();scene.add(player);player.userData.dynamic=true;
const rider=new T.Group();player.add(rider);
function flowingStrip(parent,color,width,length,x,y,z){const geo=new T.PlaneGeometry(width,length,3,18);geo.rotateX(-Math.PI/2);geo.translate(x,y,z+length/2);const m=new T.MeshStandardMaterial({color,roughness:.58,side:T.DoubleSide});const strip=new T.Mesh(geo,m);strip.castShadow=true;strip.userData.dynamic=true;parent.add(strip);flowing.push({mesh:strip,base:geo.attributes.position.array.slice(),length,z,phase:rand(0,6)});return strip;}
// Reference-inspired black-haired immortal. Smooth tailored forms, layered silk,
// fine hair locks and a luminous filigree sword are built without model downloads.
const bladeShape=new T.Shape();bladeShape.moveTo(0,-4.1);bladeShape.quadraticCurveTo(.35,-2.4,.24,1.65);bladeShape.lineTo(-.24,1.65);bladeShape.quadraticCurveTo(-.35,-2.4,0,-4.1);
const sword=mesh(new T.ExtrudeGeometry(bladeShape,{depth:.09,bevelEnabled:true,bevelThickness:.035,bevelSize:.035,bevelSegments:3}),swordMetal,rider);sword.rotation.x=Math.PI/2;sword.position.y=.16;
const silkWhite=new T.MeshPhysicalMaterial({color:0xfff8ed,roughness:.57,metalness:.03,sheen:.65,sheenColor:new T.Color(0xc2e8ff),side:T.DoubleSide});
const silkIce=new T.MeshPhysicalMaterial({color:0xb3d3e7,roughness:.5,sheen:.7,sheenColor:new T.Color(0xe9faff),side:T.DoubleSide});
const hairBlack=new T.MeshStandardMaterial({color:0x191d24,roughness:.3,metalness:.12});
const silver=new T.MeshStandardMaterial({color:0xdce6e2,roughness:.26,metalness:.7});
const fineGold=new T.MeshStandardMaterial({color:0xd8bf83,roughness:.29,metalness:.65});
const porcelain=new T.MeshStandardMaterial({color:0xf7ddd1,roughness:.72});
const ink=new T.MeshStandardMaterial({color:0x244552,roughness:.5});
const rose=new T.MeshStandardMaterial({color:0xbc7373,roughness:.6});
const iris=new T.MeshStandardMaterial({color:0x59473f,roughness:.26});
const characterCloth=[];
function oval(parent,x,y,z,rx,ry,rz,mat){return mesh(new T.SphereGeometry(1,24,16),mat,parent,x,y,z,rx,ry,rz);}
function curve(parent,points,r,mat){return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),36,r,6,false),mat,parent);}
function animateFabric(o,phase=0,type='silk',top=2.65,bottom=.4){o.userData.dynamic=true;characterCloth.push({mesh:o,base:o.geometry.attributes.position.array.slice(),phase,type,top,bottom});return o;}
// Procedural silk embroidery: fine winding gold vines and five-petal blossoms.
// This is a garment texture on true 3-D geometry, not the supplied image on a plane.
function embroideryTexture(){
 const c=document.createElement('canvas');c.width=512;c.height=1024;const g=c.getContext('2d');g.fillStyle='#faf6ed';g.fillRect(0,0,512,1024);
 g.strokeStyle='rgba(139,170,185,.12)';g.lineWidth=.8;for(let i=-1000;i<1500;i+=14){g.beginPath();g.moveTo(0,i);g.lineTo(512,i+600);g.stroke();}
 for(const edge of [55,457]){
  g.strokeStyle='#c1a46c';g.lineWidth=2;g.beginPath();g.moveTo(edge,0);for(let i=0;i<8;i++)g.bezierCurveTo(edge+36,i*128+32,edge-36,i*128+95,edge,(i+1)*128);g.stroke();
  for(let i=0;i<8;i++){const y=65+i*128;g.strokeStyle='#c7b17c';g.lineWidth=1.5;for(let k=0;k<5;k++){const a=k*Math.PI*2/5;g.beginPath();g.ellipse(edge+Math.cos(a)*9,y+Math.sin(a)*9,5,10,a-Math.PI/2,0,Math.PI*2);g.stroke();}g.fillStyle='#d5c092';g.beginPath();g.arc(edge,y,3,0,Math.PI*2);g.fill();}
 }
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;
}
const embroideredSilk=silkWhite.clone();embroideredSilk.map=embroideryTexture();
function chiffonRibbon(parent,x,y,z,length,width,spread,mat){
 const pos=[],uv=[],idx=[],rows=30,cols=6,phase=spread*3;
 function point(u,t){const w=width*(.25+.75*Math.sin(Math.PI*t))*(1-.80*Math.pow(t,8));return V(x+spread*Math.pow(t,1.3)+Math.sin(t*6+phase)*t*.24+(u-.5)*w,y-.7*t+Math.sin(t*6+phase)*t*.30,z+t*length);}
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){pos.push(...point(i/cols,j/rows).toArray());uv.push(i/cols,j/rows);if(j<rows&&i<cols){const k=j*(cols+1)+i;idx.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1);}}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();const material=mat.clone();material.transparent=true;material.opacity=.87;material.depthWrite=false;
 function register(o){animateFabric(o,phase,'ribbon');Object.assign(characterCloth.at(-1),{originZ:z,length});return o;}
 const result=register(mesh(geo,material,parent));
 for(const u of [0,1]){const pts=[];for(let j=0;j<=rows;j++)pts.push(point(u,j/rows));register(curve(parent,pts,.008,fineGold));}
 return result;
}

// A sculpted narrow-waisted bodice. Lathe profiles avoid the old blocky cylinders.
const bodiceProfile=[[.31,2.43],[.34,2.58],[.32,2.74],[.36,2.92],[.42,3.17],[.44,3.35],[.36,3.48],[.15,3.65]].map(([r,y])=>new T.Vector2(r,y));
const bodice=mesh(new T.LatheGeometry(bodiceProfile,36),silkWhite,rider);bodice.scale.z=.66;
mesh(new T.CylinderGeometry(.135,.15,.32,24),porcelain,rider,0,3.71,0);
// The head has a tapered chin, eyes with irises, lashes, brows, nose and lips.
const faceGeo=new T.SphereGeometry(1,32,24);const facePos=faceGeo.attributes.position;for(let i=0;i<facePos.count;i++){const y=facePos.getY(i),t=1-.20*Math.max(0,-y);facePos.setX(i,facePos.getX(i)*t);}faceGeo.computeVertexNormals();
mesh(faceGeo,porcelain,rider,0,4.08,-.015,.245,.345,.225);
for(const side of [-1,1]){
 oval(rider,side*.104,4.12,-.216,.073,.026,.024,robeMat);
 oval(rider,side*.104,4.12,-.240,.025,.024,.009,iris);
 oval(rider,side*.104,4.12,-.247,.012,.020,.004,ink);
 oval(rider,side*.097,4.13,-.252,.006,.008,.003,robeMat);
 curve(rider,[V(side*.028,4.126,-.225),V(side*.105,4.154,-.242),V(side*.185,4.138,-.199)],.007,ink);
 curve(rider,[V(side*.038,4.22,-.208),V(side*.11,4.243,-.213),V(side*.185,4.217,-.173)],.009,ink);
 oval(rider,side*.239,4.06,.005,.036,.074,.035,porcelain);
 curve(rider,[V(side*.245,4.03,0),V(side*.256,3.9,-.015),V(side*.24,3.84,-.01)],.011,fineGold);
 oval(rider,side*.24,3.82,-.01,.028,.05,.022,swordMetal);
}
oval(rider,0,4.043,-.243,.024,.06,.032,porcelain);
curve(rider,[V(-.05,3.967,-.211),V(0,3.958,-.23),V(.05,3.967,-.211)],.006,rose);
// Dark center-parted hair sweeps away from the face into individually curved locks.
mesh(new T.SphereGeometry(1,32,20,0,Math.PI*2,0,1.68),hairBlack,rider,0,4.16,.035,.26,.28,.245);
oval(rider,0,4.18,.14,.255,.28,.17,hairBlack);
const hairHighlight=new T.MeshStandardMaterial({color:0x35353b,roughness:.34,metalness:.16});
for(let i=0;i<19;i++){
 const q=(i-9)/9,phase=i*.31;
 const points=[V(q*.17,4.35,.09),V(q*.25,4.13,.24),V(q*.35,3.72,.48),V(q*.55+Math.sin(i)*.10,3.2,1.05),V(q*.70+Math.sin(i*.7)*.12,2.72+(i%4)*.10,1.75),V(q*.77,2.45+(i%3)*.14,2.2+(i%4)*.13)];
 animateFabric(curve(rider,points,.026+(1-Math.abs(q))*.027,i%5?hairBlack:hairHighlight),phase,'hair',4.22,2.1);
}
for(const side of [-1,1]){
 // Soft center part and face-framing tendrils rather than a helmet-like front edge.
 animateFabric(curve(rider,[V(side*.03,4.37,-.08),V(side*.16,4.29,-.18),V(side*.23,4.08,-.18),V(side*.25,3.79,-.1),V(side*.29,3.46,.05)],.029,hairBlack),side,'hair',4.25,2.1);
 curve(rider,[V(side*.02,4.4,-.015),V(side*.16,4.43,.02),V(side*.24,4.31,.15)],.013,hairHighlight);
}
// Floral hairpin with small gold leaves, pearl centers and dangling chains.
function goldFlower(parent,x,y,z,size){
 for(let k=0;k<5;k++){const a=k*Math.PI*2/5,p=oval(parent,x+Math.cos(a)*size*.60,y+Math.sin(a)*size*.60,z,size*.24,size*.48,size*.08,fineGold);p.rotation.z=a-Math.PI/2;}
 oval(parent,x,y,z-.015,size*.20,size*.20,size*.14,silkWhite);
}
for(const [x,y,z,size] of [[.22,4.30,-.04,.13],[.27,4.16,-.035,.095],[.17,4.39,.025,.085]])goldFlower(rider,x,y,z,size);
curve(rider,[V(.17,4.4,.03),V(.32,4.32,.08),V(.34,4.08,.1)],.012,fineGold);
for(let i=0;i<3;i++){
 const pts=[V(.27+i*.025,4.2,.06),V(.29+i*.035,3.95,.08),V(.27+i*.04,3.69-i*.09,.11)];curve(rider,pts,.007,fineGold);oval(rider,pts[2].x,pts[2].y-.035,pts[2].z,.018,.035,.018,silkWhite);
}
// Small forehead ornament and fine warm-colored lips.
curve(rider,[V(-.018,4.26,-.196),V(0,4.292,-.187),V(.018,4.26,-.196),V(0,4.248,-.203),V(-.018,4.26,-.196)],.004,fineGold);
oval(rider,0,3.955,-.229,.031,.011,.008,rose);
// Soft V collar, a narrow gilded belt and a hanging jade waist ornament.
for(const side of [-1,1]){
 curve(rider,[V(side*.15,3.61,-.1),V(side*.31,3.4,-.23),V(side*.18,3.13,-.28),V(0,2.8,-.24)],.028,silkIce);
 curve(rider,[V(side*.18,3.6,-.13),V(side*.34,3.4,-.245),V(side*.2,3.12,-.3),V(0,2.8,-.26)],.013,fineGold);
}
for(let row=0;row<3;row++){
 const sash=torus(rider,0,2.59+row*.065,0,.35+row*.005,.043,silkIce);sash.scale.z=.74;sash.rotation.z=(row-1)*.1;
}
for(const side of [-1,1]){curve(rider,[V(side*.02,2.67,-.29),V(side*.27,2.49,-.29),V(side*.43,2.26,-.12)],.009,fineGold);goldFlower(rider,side*.27,2.51,-.3,.075);}
const belt=torus(rider,0,2.65,0,.34,.045,fineGold);belt.scale.z=.73;
oval(rider,0,2.65,-.27,.11,.08,.035,fineGold);oval(rider,0,2.65,-.306,.046,.056,.015,swordMetal);
curve(rider,[V(0,2.61,-.31),V(.04,2.38,-.34),V(0,2.21,-.37)],.013,fineGold);oval(rider,0,2.18,-.37,.05,.10,.025,swordMetal);
// Full-length pleated underdress plus individually shaped split outer panels.
function skirtPanel(angle,span,length,mat,phase,flare=.74){
 const positions=[],indices=[],uv=[],nu=12,nv=24;
 function point(u,t){const a=angle+(u-.5)*span,rad=.34+(flare-.34)*Math.pow(t,.8)+.025*Math.sin(u*Math.PI*8)*t;return V(Math.sin(a)*rad,2.57-length*t+.07*Math.sin(u*Math.PI*3+phase)*t*t,Math.cos(a)*rad*.66+.80*t*t*(.5+.5*Math.cos(a)));}
 for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){positions.push(...point(i/nu,j/nv).toArray());uv.push(i/nu,j/nv);}
 for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const k=j*(nu+1)+i;indices.push(k,k+1,k+nu+1,k+1,k+nu+2,k+nu+1);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();animateFabric(mesh(geo,mat,rider),phase,'silk');
 for(const u of [0,1]){const pts=[];for(let j=0;j<=24;j++)pts.push(point(u,j/24));animateFabric(curve(rider,pts,.012,fineGold),phase,'silk');}
}
skirtPanel(0,Math.PI*2,2.18,silkWhite,0,.66);
skirtPanel(Math.PI,.95,2.17,silkIce,0,.68);
for(let i=0;i<6;i++)skirtPanel((i-2.5)*.88,.73,2.12+(i%2)*.11,embroideredSilk,i*.5,.93);
// Balanced arms: one gently extended, the other curved inward, with loose sleeves.
const armGroups=[];
for(const side of [-1,1]){
 const arm=new T.Group();arm.position.set(side*.37,3.38,0);arm.rotation.z=side*.12;arm.userData.dynamic=true;rider.add(arm);armGroups.push(arm);
 const elbow=V(side*.27,-.48,side<0?-.12:.03),hand=V(side*(side<0?.70:.43),side<0?-.62:-.84,-.17);
 curve(arm,[V(),elbow,hand],.105,porcelain);
 const sleevePath=new T.CatmullRomCurve3([V(),elbow.clone().multiplyScalar(.8),hand.clone().multiplyScalar(.78)]),sleevePositions=[],sleeveUV=[],sleeveIndices=[],rings=18,segments=28;
 for(let j=0;j<=rings;j++){
  const u=j/rings,center=sleevePath.getPoint(u),tangent=sleevePath.getTangent(u).normalize(),right=V(0,0,1),up=new T.Vector3().crossVectors(tangent,right).normalize(),radius=.16+.27*Math.pow(u,1.4);
  for(let k=0;k<=segments;k++){const a=k/segments*Math.PI*2,point=center.clone().addScaledVector(right,Math.cos(a)*radius*.65).addScaledVector(up,Math.sin(a)*radius);point.y-=.09*u*u;sleevePositions.push(...point.toArray());sleeveUV.push(k/segments,u);if(j<rings&&k<segments){const n=j*(segments+1)+k;sleeveIndices.push(n,n+1,n+segments+1,n+1,n+segments+2,n+segments+1);}}
 }
 const sleeveGeo=new T.BufferGeometry();sleeveGeo.setAttribute('position',new T.Float32BufferAttribute(sleevePositions,3));sleeveGeo.setAttribute('uv',new T.Float32BufferAttribute(sleeveUV,2));sleeveGeo.setIndex(sleeveIndices);sleeveGeo.computeVertexNormals();mesh(sleeveGeo,embroideredSilk,arm);
 const cuffPoints=[];for(let k=0;k<=segments;k++){const n=(rings*(segments+1)+k)*3;cuffPoints.push(V(...sleevePositions.slice(n,n+3)));}curve(arm,cuffPoints,.014,fineGold);
 oval(arm,hand.x,hand.y,hand.z,.075,.12,.055,porcelain);
 for(let finger=0;finger<4;finger++)curve(arm,[V(hand.x+(finger-1.5)*.026,hand.y-.05,hand.z),V(hand.x+(finger-1.5)*.03,hand.y-.16,hand.z-.025)],.012,porcelain);
 // Sleeve streamers curve downward at rest and lift behind the rider at speed.
 const ribbon=chiffonRibbon(arm,side*.20,-.42,.08,3.5,.56,side*.5,silkWhite); 
}
for(const side of [-1,1]){oval(rider,side*.18,.31,side*.12-.18,.10,.12,.30,silkWhite);mesh(new T.CylinderGeometry(.085,.10,.56,20),silkWhite,rider,side*.18,.64,side*.12-.08);}
// Two trailing silk sashes, restrained in width so they do not hide the face/body.
chiffonRibbon(rider,-.31,2.58,.12,4.8,.40,-.8,silkIce);chiffonRibbon(rider,.31,2.58,.12,4.5,.58,.9,embroideredSilk);chiffonRibbon(rider,-.26,1.3,.38,3.1,.50,-.4,silkWhite);
// Gold filigree guard and cyan blade, matching the new image's sword silhouette.
for(const side of [-1,1]){
 curve(rider,[V(0,.17,1.5),V(side*.35,.21,1.26),V(side*.71,.19,1.08),V(side*.6,.19,1.48),V(side*.26,.2,1.7)],.035,fineGold);
 curve(rider,[V(side*.18,.17,1.7),V(side*.42,.2,1.88),V(side*.59,.18,1.72),V(side*.36,.18,1.53)],.019,fineGold);
 for(let i=0;i<3;i++){const gem=oval(rider,side*(.23+i*.12),.23,1.4-i*.12,.055,.025,.12,fineGold);gem.rotation.y=side*.7;}
}
box(rider,0,.14,2.15,.13,.12,1.05,silkIce);oval(rider,0,.14,2.7,.12,.09,.16,fineGold);oval(rider,0,.23,1.56,.10,.06,.16,swordMetal);
for(let i=0;i<3;i++){
 const pts=[];for(let j=0;j<=40;j++){const u=j/40,a=u*Math.PI*2.2+i*2.1;pts.push(V(Math.cos(a)*(.55+u*.30),-.13+Math.sin(a)*.09,2.8-u*6.7));}curve(rider,pts,.012+i*.003,lineMat);
}
const swordGlow=new T.Sprite(new T.SpriteMaterial({map:glowMap,color:0x6ccaff,transparent:true,opacity:.45,depthWrite:false,blending:T.AdditiveBlending}));swordGlow.scale.set(5.0,2,1);swordGlow.position.y=.03;rider.add(swordGlow);
const auraLight=new T.PointLight(0x65caff,7,9,2);auraLight.position.set(0,.8,0);player.add(auraLight);
torus(rider,0,.02,.1,1.04,.024,lineMat);torus(rider,0,.01,.1,1.28,.012,lineMat);
box(rider,0,.06,-.75,.045,.045,5.9,lineMat);
batchStatic(rider);
function updateCharacterCloth(t){
 const speed=state.landed?0:clamp(state.speed/48,0,1);
 for(const f of characterCloth){const p=f.mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){const k=i*3,x=f.base[k],y=f.base[k+1],z=f.base[k+2],w=f.type==='ribbon'?clamp((z-f.originZ)/f.length,0,1):clamp((f.top-y)/(f.top-f.bottom),0,1);p.array[k]=x+Math.sin(t*1.7+f.phase-w*4)*w*(f.type==='hair'?.11:.07)*(1+speed);p.array[k+1]=y+Math.sin(t*2-w*5+f.phase)*w*(f.type==='ribbon'?.15:.035)+speed*w*w*.18;p.array[k+2]=z+w*w*speed*(f.type==='hair'?.9:.65);}p.needsUpdate=true;if(frame%5===0)f.mesh.geometry.computeVertexNormals();}
 for(let i=0;i<armGroups.length;i++)armGroups[i].rotation.x=Math.sin(t*1.4+i)*.035-speed*.10;
}

// A world-space, fading ribbon follows the sword rather than the camera.
const trailCount=62,trailHistory=Array.from({length:trailCount},()=>V()),trailPos=new Float32Array(trailCount*6),trailAlpha=new Float32Array(trailCount*2),trailIndex=[];
for(let i=0;i<trailCount;i++){trailAlpha[i*2]=trailAlpha[i*2+1]=Math.pow(1-i/trailCount,1.6);if(i<trailCount-1){let k=i*2;trailIndex.push(k,k+1,k+2,k+1,k+3,k+2);}}
const trailGeo=new T.BufferGeometry();trailGeo.setAttribute('position',new T.BufferAttribute(trailPos,3));trailGeo.setAttribute('aAlpha',new T.BufferAttribute(trailAlpha,1));trailGeo.setIndex(trailIndex);
const trail=new T.Mesh(trailGeo,new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,vertexShader:'attribute float aAlpha;varying float vA;void main(){vA=aAlpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying float vA;void main(){gl_FragColor=vec4(.16,.65,1.,vA*.8);}'}));trail.frustumCulled=false;scene.add(trail);

// White cranes glide around the sanctuaries; their ribbons share the wind field.
for(let i=0;i<13;i++){const g=new T.Group();scene.add(g);sphere(g,0,0,0,.7,robeMat,.65,.75,1.4);curveTube(g,[V(0,.3,-.45),V(0,.8,-.9),V(0,1.4,-1.0),V(0,1.5,-1.5)],.11,robeMat);sphere(g,0,1.5,-1.55,.2,robeMat);line(g,V(0,1.5,-1.65),V(0,1.48,-2.15),.055,gold);
 const wings=[];for(let side of [-1,1]){const wing=new T.Group();wing.position.set(side*.25,.2,0);wing.userData.dynamic=true;g.add(wing);const shape=new T.Shape();shape.moveTo(0,0);shape.lineTo(side*3,-.5);shape.lineTo(side*2.4,1);shape.lineTo(side*1.4,1.2);shape.lineTo(0,.6);shape.closePath();const w=mesh(new T.ShapeGeometry(shape),new T.MeshStandardMaterial({color:0xf4f5ed,side:T.DoubleSide,roughness:.8}),wing);w.rotation.x=-Math.PI/2;wings.push(wing);}
 flowingStrip(g,0x4d9fb9,.12,4.2,.18,.05,.7);batchStatic(g);cranes.push({g,wings,r:rand(45,140),height:rand(120,178),phase:rand(0,6.28),speed:rand(.035,.085),center:V(rand(-80,80),0,rand(-180,40))});}
// Gold motes and airborne petal-like wind streaks, all in one point draw call.
const windCount=450,windPos=new Float32Array(windCount*3);for(let i=0;i<windCount;i++){windPos[i*3]=rand(-400,400);windPos[i*3+1]=rand(65,240);windPos[i*3+2]=rand(-400,300);}const windGeo=new T.BufferGeometry();windGeo.setAttribute('position',new T.BufferAttribute(windPos,3));const wind=new T.Points(windGeo,new T.PointsMaterial({color:0xffedba,size:.7,map:glowMap,transparent:true,opacity:.65,depthWrite:false,blending:T.AdditiveBlending}));scene.add(wind);
// Soft translucent solar shafts. Subtle enough not to obstruct architecture.
const rays=new T.Group();scene.add(rays);for(let i=0;i<7;i++){const g=new T.PlaneGeometry(rand(25,65),650),m=new T.MeshBasicMaterial({color:0xffe5b1,transparent:true,opacity:.018,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending});const r=mesh(g,m,rays,-250+i*55,230,-390-i*35);r.rotation.z=-.55;r.rotation.y=.2;}

// Post processing: real bloom, restrained depth-of-field, tone mapping and vignette.
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
const bokeh=new BokehPass(scene,camera,{focus:135,aperture:.000025,maxblur:.0022});composer.addPass(bokeh);
const bloom=new UnrealBloomPass(new T.Vector2(innerWidth,innerHeight),.26,.55,1.1);composer.addPass(bloom);
composer.addPass(new OutputPass());
const finish=new ShaderPass({uniforms:{tDiffuse:{value:null},time:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform sampler2D tDiffuse;uniform float time;varying vec2 vUv;void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;vec2 q=vUv-.5;float vignette=1.-.29*smoothstep(.15,.72,length(q));c*=vignette;float grain=fract(sin(dot(vUv+fract(time*.01),vec2(12.9898,78.233)))*43758.5453)-.5;c+=grain*.005;gl_FragColor=vec4(c,1.);}`});composer.addPass(finish);

// Flight state is separate from pointer focus. Releasing a wheel or leaving the
// canvas never opens a pause menu. Only the explicit pause button / P pauses.
const state={started:false,paused:false,landed:false,quiet:false,quality:'high',yaw:.10,pitch:.24,speed:0,time:0,visited:new Set(),lastLocation:-1};
const spawn=V(18,132,91),velocity=V(),keys=new Set(),input={x:0,z:0,up:false,down:false,boost:false};
player.position.copy(spawn);player.rotation.y=state.yaw;
let toastTimer=0,frame=0,last=performance.now(),fpsSamples=0,fpsSeconds=0,adaptiveDone=false,lookPointer=null,lastLookX=0,lastLookY=0,joystickPointer=null;
let targetYaw=state.yaw,targetPitch=state.pitch,modalFocus=null;
let characterView=false,characterViewSaved=null;
function toast(message,duration=4){$('toast').textContent=message;$('toast').classList.add('show');toastTimer=duration;}
function resetTrail(){trailHistory.forEach(p=>p.copy(player.position));}
function resetFlight(){player.position.copy(spawn);velocity.set(0,0,0);state.speed=0;targetYaw=state.yaw=.10;targetPitch=state.pitch=.24;state.landed=false;resetTrail();updateCamera(1,true);}
function clearInputs(){keys.clear();input.x=input.z=0;input.up=input.down=input.boost=false;joystickPointer=null;lookPointer=null;$('stick').style.transform='';}
function start(){if(state.started)return;state.started=true;document.body.classList.add('started');toast(matchMedia('(pointer:coarse)').matches?'Use the left wheel to fly. Drag on the right to look around.':'WASD to fly · drag to look · Space to rise',6);}
$('startBtn').onclick=()=>{start();if(hubLessonNotice)toast(hubLessonNotice,6);};
function togglePause(){if(!state.started)start();state.paused=!state.paused;if(state.paused)stopSpeech();clearInputs();$('pauseBtn').textContent=state.paused?'▶':'Ⅱ';$('pauseBtn').setAttribute('aria-label',state.paused?'Resume flight':'Pause flight');toast(state.paused?'A moment of stillness · Press P or ▶ to continue':'Follow the wind',state.paused?999:2);}
$('pauseBtn').onclick=togglePause;
function toggleQuiet(){state.quiet=!state.quiet;document.body.classList.toggle('quiet',state.quiet);}
$('photoExit').onclick=toggleQuiet;
function closeModal(){document.querySelectorAll('.modal').forEach(e=>e.classList.remove('open'));clearInputs();if(modalFocus)modalFocus.focus();}
function openModal(id){if(document.pointerLockElement)document.exitPointerLock();clearInputs();modalFocus=document.activeElement;$(id).classList.add('open');$(id).querySelector('button').focus();}
$('mapBtn').onclick=()=>openModal('mapModal');$('helpBtn').onclick=()=>openModal('helpModal');$('helpClose').onclick=closeModal;
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
document.querySelectorAll('.modal').forEach(m=>m.addEventListener('pointerdown',e=>{if(e.target===m)closeModal();}));
function modalOpen(){return !!document.querySelector('.modal.open');}
window.addEventListener('keydown',e=>{
 if(e.key==='Tab'&&modalOpen()){const focusable=[...document.querySelector('.modal.open').querySelectorAll('button')],first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}return;}
 if(e.code==='Escape'){closeModal();if(state.quiet)toggleQuiet();return;}
 if(modalOpen()||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
 if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','ControlLeft','ControlRight','KeyE'].includes(e.code)){e.preventDefault();keys.add(e.code);if(!state.started)start();}
 if(e.repeat)return;if(e.code==='KeyP')togglePause();if(e.code==='KeyM')openModal('mapModal');if(e.code==='KeyH')toggleQuiet();if(e.code==='KeyR'){resetFlight();toast('Returned to the arrival winds.');}
});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',clearInputs);
document.addEventListener('visibilitychange',()=>{clearInputs();last=performance.now();if(document.hidden&&audioContext)audioContext.suspend();else if(soundEnabled&&audioContext)audioContext.resume().catch(()=>{});});

// Pointer capture retains a drag even if the finger leaves a control. Pointer IDs
// isolate the movement wheel from look/altitude fingers on multitouch screens.
const canvas=renderer.domElement;
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{if(modalOpen()||state.paused)return;if(!state.started)start();if(e.pointerType==='touch'&&e.clientX<innerWidth*.38)return;lookPointer=e.pointerId;lastLookX=e.clientX;lastLookY=e.clientY;canvas.setPointerCapture(e.pointerId);e.preventDefault();});
canvas.addEventListener('pointermove',e=>{if(document.pointerLockElement===canvas){targetYaw-=e.movementX*.0023;targetPitch=clamp(targetPitch+e.movementY*.0019,-.9,.95);}else if(e.pointerId===lookPointer){targetYaw-=(e.clientX-lastLookX)*.004;targetPitch=clamp(targetPitch+(e.clientY-lastLookY)*.003,-.9,.95);lastLookX=e.clientX;lastLookY=e.clientY;e.preventDefault();}});
function endLook(e){if(e.pointerId===lookPointer)lookPointer=null;}
canvas.addEventListener('pointerup',endLook);canvas.addEventListener('pointercancel',endLook);canvas.addEventListener('lostpointercapture',endLook);
canvas.addEventListener('dblclick',()=>{if(!matchMedia('(pointer:coarse)').matches&&!modalOpen())canvas.requestPointerLock?.()?.catch?.(()=>toast('Drag the scene to look around.'));});
const joy=$('joystick');
function updateStick(e){const b=joy.getBoundingClientRect(),r=b.width*.34,dx=e.clientX-b.left-b.width/2,dy=e.clientY-b.top-b.height/2,len=Math.hypot(dx,dy),scale=len>r?r/len:1;input.x=dx*scale/r;input.z=-dy*scale/r;$('stick').style.transform=`translate(${dx*scale}px,${dy*scale}px)`;}
joy.addEventListener('pointerdown',e=>{if(joystickPointer!==null)return;joystickPointer=e.pointerId;joy.setPointerCapture(e.pointerId);updateStick(e);start();e.preventDefault();e.stopPropagation();});
joy.addEventListener('pointermove',e=>{if(e.pointerId===joystickPointer){updateStick(e);e.preventDefault();e.stopPropagation();}});
function endStick(e){if(e.pointerId===joystickPointer){joystickPointer=null;input.x=input.z=0;$('stick').style.transform='';}e.stopPropagation();}
joy.addEventListener('pointerup',endStick);joy.addEventListener('pointercancel',endStick);joy.addEventListener('lostpointercapture',endStick);
function holdButton(id,key){const b=$(id);let pointer=null;b.addEventListener('pointerdown',e=>{pointer=e.pointerId;b.setPointerCapture(pointer);input[key]=true;start();e.preventDefault();e.stopPropagation();});for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,e=>{if(e.pointerId===pointer){input[key]=false;pointer=null;}e.preventDefault();e.stopPropagation();});}
holdButton('upBtn','up');holdButton('downBtn','down');holdButton('boostBtn','boost');$('homeBtn').onclick=()=>{resetFlight();toast('Returned to the arrival winds.');};

function setQuality(level,notify=true){state.quality=level;const high=level==='high';renderer.setPixelRatio(Math.min(devicePixelRatio,high?1.5:1));composer.setPixelRatio(renderer.getPixelRatio());bokeh.enabled=high;bloom.strength=high?.26:.18;renderer.shadowMap.enabled=high;$('qualityBtn').textContent=high?'High':'Soft';resize();if(notify)toast(high?'High detail · bloom, shadows and soft depth of field':'Soft mode · lighter rendering for smoother flight',3);}
$('qualityBtn').onclick=()=>{adaptiveDone=true;setQuality(state.quality==='high'?'soft':'high');};
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);}
addEventListener('resize',resize);
$('renderInfo').textContent='Three.js r'+T.REVISION+' · Procedural geometry · Offline-ready · High detail adds soft depth of field and shadows.';

// Atlas passages place the player outside architecture, ready for a gentle landing.
for(let i=0;i<sanctuaries.length;i++){const s=sanctuaries[i],pip=document.createElement('span');pip.id='pip'+i;$('pips').appendChild(pip);const b=document.createElement('button');b.className='destination';const title=document.createElement('strong');title.textContent=s.name;const sub=document.createElement('small');sub.textContent=s.en;b.append(title,sub);b.onclick=()=>{start();player.position.set(s.x,s.y+15,s.z+s.r+15);velocity.set(0,0,0);state.landed=false;targetYaw=state.yaw=0;targetPitch=state.pitch=.24;resetTrail();updateCamera(1,true);closeModal();toast('Following the wind to '+s.en);};$('destinations').appendChild(b);}

// Optional synthesized ambient audio. Starts only from an explicit button tap.
let audioContext=null,soundEnabled=false,masterGain=null,nextNote=0,noteIndex=0;
const notes=[146.83,220,293.66,329.63,440,587.33,440,329.63,293.66,220,164.81,220];
function setupAudio(){const AC=window.AudioContext||window.webkitAudioContext;if(!AC){toast('Ambient audio is not supported in this browser.');return false;}audioContext=new AC();masterGain=audioContext.createGain();masterGain.gain.value=.24;masterGain.connect(audioContext.destination);
 const buffer=audioContext.createBuffer(1,audioContext.sampleRate*3,audioContext.sampleRate);const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.05;const noise=audioContext.createBufferSource();noise.buffer=buffer;noise.loop=true;const filter=audioContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=480;noise.connect(filter);filter.connect(masterGain);noise.start();nextNote=audioContext.currentTime+.2;return true;}
function note(freq,t){for(let h=1;h<=3;h++){const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='sine';osc.frequency.value=freq*h;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.12/(h*h),t+.025);gain.gain.exponentialRampToValueAtTime(.0001,t+5);osc.connect(gain);gain.connect(masterGain);osc.start(t);osc.stop(t+5.1);}}
$('soundBtn').onclick=async()=>{try{if(!audioContext&&!setupAudio())return;soundEnabled=!soundEnabled;if(soundEnabled){await audioContext.resume();masterGain.gain.setTargetAtTime(.24,audioContext.currentTime,.3);nextNote=audioContext.currentTime+.1;}else masterGain.gain.setTargetAtTime(0,audioContext.currentTime,.2);$('soundBtn').setAttribute('aria-pressed',String(soundEnabled));$('soundBtn').setAttribute('aria-label',soundEnabled?'Mute ambient sound':'Enable ambient sound');$('soundMark').setAttribute('d',soundEnabled?'M17 8q5 4 0 8m2-11q8 7 0 14':'m17 9 5 6m0-6-5 6');}catch(e){soundEnabled=false;toast('Tap the sound button again to enable audio.');}};

function groundAt(x,z){let best=-Infinity;for(const land of landings){if(land.type==='circle'){if(Math.hypot(x-land.x,z-land.z)<land.r)best=Math.max(best,land.y);}else{const delta=V(x-land.a.x,0,z-land.a.z),along=delta.dot(land.dir),side=Math.abs(delta.x*land.dir.z-delta.z*land.dir.x);if(along>=0&&along<=land.len&&side<land.width){const t=along/land.len;best=Math.max(best,land.a.y+(land.b.y-land.a.y)*t+Math.sin(t*Math.PI)*4+.02);}}}return best;}
function collideBuildings(old,next){for(const b of obstacles){if(next.y+4.7<b.y||next.y>b.top)continue;const hx=b.w/2+.9,hz=b.d/2+.9;if(Math.abs(next.x-b.x)<hx&&Math.abs(next.z-b.z)<hz){const dx=hx-Math.abs(next.x-b.x),dz=hz-Math.abs(next.z-b.z);if(dx<dz){next.x=b.x+Math.sign(old.x-b.x||1)*hx;velocity.x=0;}else{next.z=b.z+Math.sign(old.z-b.z||1)*hz;velocity.z=0;}}}}
const desiredCam=V(),lookTarget=V();let cameraInitialized=false;
function updateCamera(dt,instant=false){if(characterView){const angle=targetYaw,distance=7.6;desiredCam.copy(player.position).add(V(Math.sin(angle)*distance,2.7+Math.sin(targetPitch)*3,Math.cos(angle)*distance));camera.position.lerp(desiredCam,1-Math.exp(-6*dt));camera.lookAt(player.position.clone().add(V(0,2.3,0)));return;}const distance=innerWidth<700?21:17.5;const back=V(Math.sin(state.yaw)*Math.cos(state.pitch),Math.sin(state.pitch),Math.cos(state.yaw)*Math.cos(state.pitch));desiredCam.copy(player.position).add(V(0,3.8,0)).addScaledVector(back,distance);lookTarget.copy(player.position).add(V(0,2.1,0)).add(V(-Math.sin(state.yaw)*8,-Math.sin(state.pitch)*7,-Math.cos(state.yaw)*8));const ground=groundAt(desiredCam.x,desiredCam.z);desiredCam.y=Math.max(desiredCam.y,ground+3.5);if(instant||!cameraInitialized){camera.position.copy(desiredCam);cameraInitialized=true;}else camera.position.lerp(desiredCam,1-Math.exp(-5.2*dt));camera.lookAt(lookTarget);}
function updateFlight(dt){state.yaw+=(targetYaw-state.yaw)*(1-Math.exp(-12*dt));state.pitch+=(targetPitch-state.pitch)*(1-Math.exp(-12*dt));
 const mx=clamp((keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+input.x,-1,1),mz=clamp((keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)+input.z,-1,1);
 const up=input.up||keys.has('Space'),down=input.down||keys.has('ShiftLeft')||keys.has('ShiftRight')||keys.has('ControlLeft')||keys.has('ControlRight'),boost=input.boost||keys.has('KeyE'),max=boost?48:25;
 const forward=V(-Math.sin(state.yaw),0,-Math.cos(state.yaw)),right=V(Math.cos(state.yaw),0,-Math.sin(state.yaw));const desired=forward.multiplyScalar(mz).addScaledVector(right,mx);if(desired.lengthSq()>1)desired.normalize();desired.multiplyScalar(state.landed?10:max);desired.y=((up?1:0)-(down?1:0))*(boost?23:14);
 if(up&&state.landed){state.landed=false;toast('The sky is yours again.',2);}
 velocity.lerp(desired,1-Math.exp(-(desired.lengthSq()?2.8:3.6)*dt));const old=player.position.clone(),next=old.clone().addScaledVector(velocity,dt),ground=groundAt(next.x,next.z);
 if(Number.isFinite(ground)&&old.y>=ground-.8&&next.y<=ground+.5&&velocity.y<=0){next.y=ground+.5;velocity.y=0;if(!state.landed&&state.speed>1)toast('Landed · Space or ↑ to take flight',3);state.landed=true;}
 else if(state.landed){if(!Number.isFinite(ground)||next.y>ground+1.0)state.landed=false;else if(!up){next.y=ground+.5;velocity.y=0;}}
 collideBuildings(old,next);next.y=clamp(next.y,35,460);
 const bound=1150,rad=Math.hypot(next.x,next.z);if(rad>bound){next.x*=bound/rad;next.z*=bound/rad;velocity.x*=.9;velocity.z*=.9;if(frame%100===0)toast('The outer winds turn you gently toward the sanctuaries.',3);}
 player.position.copy(next);state.speed=velocity.length();if(Math.hypot(velocity.x,velocity.z)>.6){const yaw=Math.atan2(-velocity.x,-velocity.z),diff=Math.atan2(Math.sin(yaw-player.rotation.y),Math.cos(yaw-player.rotation.y));player.rotation.y+=diff*(1-Math.exp(-7*dt));}
 rider.rotation.z=T.MathUtils.lerp(rider.rotation.z,-mx*(boost?.15:.09),1-Math.exp(-4*dt));rider.rotation.x=T.MathUtils.lerp(rider.rotation.x,-mz*.045,1-Math.exp(-4*dt));
}
function updateDiscovery(){let nearest=-1,distance=Infinity;sanctuaries.forEach((s,i)=>{const d=player.position.distanceTo(V(s.x,s.y+7,s.z));if(d<distance){distance=d;nearest=i;}if(state.started&&d<s.r+10&&!state.visited.has(i)){state.visited.add(i);$('pip'+i).classList.add('visited');toast('Discovered · '+s.name+' — '+s.en,5);$('journeyText').textContent=state.visited.size===5?'ALL FIVE SANCTUARIES · THE SKY IS YOURS':state.visited.size+' / 5 SANCTUARIES DISCOVERED';if(soundEnabled)note(587.33,audioContext.currentTime);}});
 const current=distance<110?nearest:-1;if(current!==state.lastLocation){state.lastLocation=current;$('locationName').textContent=current<0?'THE CELESTIAL EXPANSE':sanctuaries[current].en.toUpperCase();$('locationSub').textContent=current<0?'云海无涯 · A SKY WITHOUT END':sanctuaries[current].name+' · '+sanctuaries[current].sub;}}
function updateVisuals(dt,t){updateCharacterCloth(t);rider.position.y=state.landed?0:Math.sin(t*1.7)*.13;
 for(const b of banners){const p=b.mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){const x=b.base[i*3],y=b.base[i*3+1];p.array[i*3+2]=Math.sin(t*1.8+x*2+y*.6+b.phase)*.16*(7-y)/4+Math.sin(t*2.5+y)*.07;}p.needsUpdate=true;}
 for(const f of flowing){const p=f.mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){const z=f.base[i*3+2],u=(z-f.z)/f.length;p.array[i*3]=f.base[i*3]+Math.sin(t*2.3+u*7+f.phase)*u*.20;p.array[i*3+1]=f.base[i*3+1]+Math.sin(t*(2+state.speed*.045)-u*7+f.phase)*u*(.16+state.speed*.006)-u*u*.35;}p.needsUpdate=true;}
 for(const l of lanterns){l.g.position.y=l.y+Math.sin(t*.65+l.phase)*.6;l.g.rotation.z=Math.sin(t*.7+l.phase)*.04;}
 for(const bird of cranes){const a=t*bird.speed+bird.phase;bird.g.position.set(bird.center.x+Math.cos(a)*bird.r,bird.height+Math.sin(a*3)*3,bird.center.z+Math.sin(a)*bird.r);bird.g.rotation.y=-a;bird.g.rotation.z=Math.sin(a)*.08;bird.wings[0].rotation.z=Math.sin(t*2.1+bird.phase)*.3;bird.wings[1].rotation.z=-Math.sin(t*2.1+bird.phase)*.3;}
 if(frame%2===0){for(let i=0;i<cloudCount;i++){const c=cloudSeeds[i];cloudDummy.position.set(c.x+Math.sin(t*.007+i)*12,c.y,c.z);cloudDummy.quaternion.copy(camera.quaternion);cloudDummy.rotateZ(c.a);cloudDummy.scale.set(c.s*1.5,c.s*.68,1);cloudDummy.updateMatrix();cloudMesh.setMatrixAt(i,cloudDummy.matrix);}cloudMesh.instanceMatrix.needsUpdate=true;}
 for(let i=0;i<windCount;i++){windPos[i*3]+=dt*2.7;windPos[i*3+1]+=Math.sin(t+i)*dt*.3;if(windPos[i*3]>450)windPos[i*3]=-450;}windGeo.attributes.position.needsUpdate=true;
 // Trail samples are kept in world space, so turns form real luminous arcs.
 trailHistory.pop();trailHistory.unshift(player.position.clone().add(V(0,.08,0)));
 const side=V(Math.cos(player.rotation.y),0,-Math.sin(player.rotation.y));for(let i=0;i<trailCount;i++){const p=trailHistory[i],width=.23*(1-i/trailCount)+.04;for(let s=0;s<2;s++){const index=i*6+s*3,sign=s?1:-1;trailPos[index]=p.x+side.x*width*sign;trailPos[index+1]=p.y-.04;trailPos[index+2]=p.z+side.z*width*sign;}}trailGeo.attributes.position.needsUpdate=true;
 swordGlow.material.opacity=.43+Math.sin(t*3)*.07;sky.position.copy(camera.position);finish.uniforms.time.value=t;
 bokeh.uniforms.focus.value=T.MathUtils.lerp(bokeh.uniforms.focus.value,80+state.speed*1.4,.03);
}
resetTrail();updateCamera(1,true);
// A small read-only diagnostic snapshot makes manual browser QA repeatable.
window.immortalDiagnostics=()=>({threeRevision:T.REVISION,started:state.started,paused:state.paused,position:player.position.toArray().map(v=>+v.toFixed(2)),speed:+state.speed.toFixed(2),landed:state.landed,quality:state.quality,visited:[...state.visited],drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometryCount:renderer.info.memory.geometries,frame});
function animate(now){if(fatal)return;requestAnimationFrame(animate);const raw=(now-last)/1000,dt=Math.min(Math.max(raw,.001),.05);last=now;frame++;
 const running=!state.paused&&!modalOpen()&&!document.hidden;if(running){state.time+=dt;if(state.started&&!characterView)updateFlight(dt);updateVisuals(dt,state.time);updateDiscovery();updateLearning(dt);}updateCamera(dt);
 if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('show');}
 if(soundEnabled&&audioContext?.state==='running'&&running){if(audioContext.currentTime>nextNote){note(notes[noteIndex++%notes.length],audioContext.currentTime+.02);nextNote=audioContext.currentTime+2.6+(noteIndex%3)*.35;}}
 if(frame%6===0){$('speed').textContent=String(Math.round(state.speed)).padStart(2,'0');$('altitude').textContent=String(Math.round(player.position.y));$('needle').style.transform=`rotate(${-state.yaw}rad)`;$('flightState').innerHTML=state.paused?'STILLNESS<br>静心':state.landed?'GROUNDED<br>落地':state.speed>30?'SWIFT FLIGHT<br>疾风':state.speed>1?'IN FLIGHT<br>御剑':'AT PEACE<br>乘风';}
 composer.render();
 if(frame===2){window.realmReady=true;$('loading').style.opacity='0';setTimeout(()=>$('loading').style.display='none',800);}
 // One conservative quality adjustment after the scene has warmed up; no loops
 // of resolution changes, and the user's explicit quality choice always wins.
 if(!adaptiveDone&&frame>50&&frame<240){fpsSamples++;fpsSeconds+=raw;if(fpsSamples===100){adaptiveDone=true;if(fpsSeconds>4.8)setQuality('soft',false);}}
}
requestAnimationFrame(animate);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('The graphics context was interrupted. Close other graphics-heavy tabs, then reload the realm.');});

// GoLingo-compatible lessons; language tags are editable BCP-47 codes, not a fixed list.
let lesson={primaryLanguage:'en',learningLanguage:'zh-CN',words:[{word:'天空',translation:'sky',sentence:'我在天空中飞翔。',sentenceTranslation:'I fly in the sky.'},{word:'云',translation:'cloud',sentence:'白云在山间飘动。',sentenceTranslation:'White clouds drift among the mountains.'},{word:'桥',translation:'bridge',sentence:'这座桥连接两座宫殿。',sentenceTranslation:'This bridge connects two palaces.'},{word:'山',translation:'mountain',sentence:'远处的山很美。',sentenceTranslation:'The distant mountains are beautiful.'},{word:'剑',translation:'sword',sentence:'我乘着飞剑旅行。',sentenceTranslation:'I travel on a flying sword.'}]},learned=new Set(),activeLesson=-1,repeatSpeech=true,speechTimer=0,speechGeneration=0,nearLesson=-1;
try{const saved=JSON.parse(localStorage.getItem('immortal-lesson'));if(saved?.words?.length)lesson=saved;}catch{}
// The game hub passes lessons in the URL fragment, which is never sent to a server.
// Validate before replacing a saved lesson; malformed launch data leaves it intact.
function normalizeHubLesson(data){
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Use a lesson object.');
 const list=data.words||data.sentences||data.phrases||data.items||data.entries;
 if(!Array.isArray(list)||!list.length||list.length>500)throw Error('A lesson needs 1–500 entries.');
 const text=value=>typeof value==='string'?value.trim():'';
 const words=list.map((entry,i)=>{
  const w=typeof entry==='string'?{word:entry}:entry;
  if(!w||typeof w!=='object')throw Error('Invalid lesson entry '+(i+1)+'.');
  const word=text(w.word)||text(w.text)||text(w.sentence)||text(w.phrase);
  if(!word)throw Error('Every lesson entry needs text.');
  return{id:String(w.id||''),word,translation:text(w.translation)||text(w.meaning),sentence:text(w.sentence)||word,sentenceTranslation:text(w.sentenceTranslation)||text(w.translation)||text(w.meaning)};
 });
 return{learningLanguage:text(data.learningLanguage)||'zh-CN',primaryLanguage:text(data.primaryLanguage)||text(data.translationLanguage)||'en',words};
}
function importHubLesson(hash){
 const raw=new URLSearchParams(hash.replace(/^#/, '')).get('golingoLesson');
 if(raw===null)return false;
 if(raw.length>100000)throw Error('The shared lesson is too large.');
 const incoming=normalizeHubLesson(JSON.parse(raw));
 lesson=incoming;
 try{localStorage.setItem('immortal-lesson',JSON.stringify(lesson));}catch{}
 return true;
}
let hubLessonNotice='';
try{if(importHubLesson(location.hash))hubLessonNotice='Shared lesson loaded · Fly into a pavilion to learn.';}
catch(e){hubLessonNotice='Shared lesson could not load. Open Learn to paste it again.';console.warn('Lesson import:',e.message);}

let showLearningText=false;try{showLearningText=localStorage.getItem('immortal-show-card-v2')==='true';}catch{}
let lessonPage=0;
const lessonSprites=[];
function stopSpeech(){speechGeneration++;clearTimeout(speechTimer);window.speechSynthesis?.cancel();}
function speakLesson(text,language,loop=false){stopSpeech();if(!window.speechSynthesis){toast('Speech is unavailable in this browser.');return;}const generation=speechGeneration;function play(){if(generation!==speechGeneration||document.hidden)return;const u=new SpeechSynthesisUtterance(text);u.lang=language;u.rate=.82;const voices=speechSynthesis.getVoices();u.voice=voices.find(v=>v.lang.toLowerCase()===language.toLowerCase())||voices.find(v=>v.lang.split('-')[0]===language.split('-')[0])||null;u.onend=()=>{if(loop&&repeatSpeech&&generation===speechGeneration)speechTimer=setTimeout(play,1800);};u.onerror=()=>{if(generation===speechGeneration)toast('Voice unavailable. Choose a language supported by your device.');};speechSynthesis.speak(u);}play();}
function labelTexture(text){const c=document.createElement('canvas');c.width=1024;c.height=256;const x=c.getContext('2d');x.fillStyle='rgba(15,44,66,.88)';x.fillRect(0,0,1024,256);x.strokeStyle='#efcf77';x.lineWidth=5;x.strokeRect(7,7,1010,242);x.fillStyle='#fff0c9';x.textAlign='center';x.textBaseline='middle';x.font='54px sans-serif';x.fillText(text,512,128,950);return new T.CanvasTexture(c);}
function rebuildLessons(){lessonSprites.forEach(o=>{scene.remove(o.sprite);o.sprite.material.map.dispose();o.sprite.material.dispose();});lessonSprites.length=0;wordPlaces.forEach((p,i)=>{const index=(i+lessonPage*wordPlaces.length)%lesson.words.length,w=lesson.words[index];const sprite=new T.Sprite(new T.SpriteMaterial({map:labelTexture(w.word),depthTest:true}));sprite.position.copy(p);sprite.scale.set(9,2.25,1);scene.add(sprite);lessonSprites.push({sprite,index,palace:false});});const w=lesson.words[0],sprite=new T.Sprite(new T.SpriteMaterial({map:labelTexture(w.sentence||w.word)}));sprite.position.set(0,114,-84);sprite.scale.set(23,5.75,1);scene.add(sprite);lessonSprites.push({sprite,index:0,palace:true});applyTextVisibility();}
function selectLesson(index,palace=false){activeLesson=index;const w=lesson.words[index];$('learnWord').textContent=palace?(w.sentence||w.word):w.word;$('learnTranslation').textContent=palace?(w.sentenceTranslation||w.translation):w.translation;$('learnCard').hidden=!showLearningText;$('learnCard').dataset.palace=String(palace);learned.add(index);$('basketCount').textContent=learned.size;speakLesson($('learnWord').textContent,lesson.learningLanguage,repeatSpeech);if(!palace){const center=lessonSprites.at(-1);center.index=index;center.sprite.material.map.dispose();center.sprite.material.map=labelTexture(w.sentence||w.word);}}
function updateLearning(){if(!state.started)return;let found=-1,best=13;lessonSprites.forEach((o,i)=>{const d=player.position.distanceTo(o.sprite.position);if(d<best){best=d;found=i;}});if(found!==nearLesson){nearLesson=found;if(found>=0){const o=lessonSprites[found];selectLesson(o.index,o.palace);}}}
$('lessonBtn').onclick=()=>{stopSpeech();$('lessonInput').value=JSON.stringify(lesson,null,2);$('learningLang').value=lesson.learningLanguage;$('primaryLang').value=lesson.primaryLanguage;openModal('lessonModal');};
$('applyLesson').onclick=()=>{try{const raw=$('lessonInput').value.trim();let data;if(raw.startsWith('{')||raw.startsWith('[')){data=JSON.parse(raw);if(Array.isArray(data))data={words:data};}else data={words:raw.split('\n').filter(Boolean).map(line=>{const [word,translation='',sentence='',sentenceTranslation='']=line.split('|').map(s=>s.trim());return{word,translation,sentence,sentenceTranslation};})};if(!Array.isArray(data.words)||!data.words.length)throw Error('Add at least one word.');data.words=data.words.map(w=>({id:String(w.id||''),word:String(w.word||'').trim(),translation:String(w.translation||''),sentence:String(w.sentence||''),sentenceTranslation:String(w.sentenceTranslation||'')}));if(data.words.some(w=>!w.word))throw Error('Every item needs a word.');lesson={...data,learningLanguage:$('learningLang').value.trim()||data.learningLanguage||'en',primaryLanguage:$('primaryLang').value.trim()||data.primaryLanguage||'en'};try{localStorage.setItem('immortal-lesson',JSON.stringify(lesson));}catch{}learned.clear();activeLesson=-1;nearLesson=-1;$('basketCount').textContent='0';$('learnCard').hidden=true;rebuildLessons();closeModal();toast('Lesson loaded · Fly into a pavilion to learn.');}catch(e){$('lessonError').textContent=e.message;}};
$('repeatBtn').onclick=()=>{repeatSpeech=!repeatSpeech;$('repeatBtn').textContent=repeatSpeech?'Pause repeat':'Resume repeat';stopSpeech();if(repeatSpeech&&activeLesson>=0)speakLesson($('learnWord').textContent,lesson.learningLanguage,true);};
$('learnWord').onclick=()=>speakLesson($('learnWord').textContent,lesson.learningLanguage,repeatSpeech);
$('translationToggle').onchange=()=>{$('learnTranslation').hidden=!$('translationToggle').checked;};$('learnTranslation').onclick=()=>speakLesson($('learnTranslation').textContent,lesson.primaryLanguage,false);
$('nextSentence').onclick=()=>{const i=(Math.max(activeLesson,0)+1)%lesson.words.length;selectLesson(i,true);const center=lessonSprites.at(-1);center.index=i;center.sprite.material.map.dispose();center.sprite.material.map=labelTexture(lesson.words[i].sentence||lesson.words[i].word);};
$('exportWords').onclick=()=>{const blob=new Blob([JSON.stringify({...lesson,words:[...learned].map(i=>lesson.words[i])},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='GoLingo-Sword-Review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('basketBtn').onclick=()=>{$('reviewList').textContent=[...learned].map(i=>lesson.words[i].word+' — '+lesson.words[i].translation).join('\n')||'Fly to a pavilion to collect your first word.';openModal('reviewModal');};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopSpeech();});
rebuildLessons();

$('nextPage').onclick=()=>{stopSpeech();lessonPage=(lessonPage+1)%Math.ceil(lesson.words.length/wordPlaces.length);nearLesson=-1;rebuildLessons();toast('Pavilion lesson page '+(lessonPage+1));};

// Visibility is independent of audio and survives lesson changes and reloads.
function applyTextVisibility(){lessonSprites.forEach(o=>o.sprite.visible=true);$('learnCard').hidden=!showLearningText||activeLesson<0;$('textToggle').textContent=showLearningText?'Hide card':'Show card';$('textToggle').setAttribute('aria-pressed',String(showLearningText));}
function setLearningTextVisible(visible){showLearningText=visible;try{localStorage.setItem('immortal-show-card-v2',String(visible));}catch{}applyTextVisibility();}
$('textToggle').onclick=()=>setLearningTextVisible(!showLearningText);
$('hideText').onclick=()=>setLearningTextVisible(false);
// Permit editing/pasting lesson content, but block selection/callouts on gameplay.
for(const type of ['selectstart','contextmenu','dragstart'])document.addEventListener(type,e=>{if(!e.target.closest?.('textarea,input:not([type="checkbox"])'))e.preventDefault();});
applyTextVisibility();

// Inspect the actual in-world character from any angle without a second renderer.
$('viewCharacter').onclick=()=>{closeModal();clearInputs();velocity.set(0,0,0);state.speed=0;characterViewSaved={yaw:targetYaw,pitch:targetPitch};characterView=true;targetYaw=player.rotation.y+Math.PI+.30;targetPitch=.07;$('characterExit').hidden=false;toast('Drag to orbit the immortal · Return to flight when ready',4);};
$('characterExit').onclick=()=>{characterView=false;clearInputs();targetYaw=characterViewSaved.yaw;targetPitch=characterViewSaved.pitch;$('characterExit').hidden=true;};
