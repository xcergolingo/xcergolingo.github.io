import * as THREE from 'three';
import {center,tangent,raceLine,halfWidth,groundHeight,LENGTH,mix,RAMPS,BOOSTS,SECTIONS} from './course.js';
export const CYAN=new THREE.Color(0x36eeff),PINK=new THREE.Color(0xff42d7);
const snow=new THREE.MeshStandardMaterial({color:0xbdd0e6,roughness:.95});
const carbon=new THREE.MeshStandardMaterial({color:0x111e34,roughness:.62,metalness:.4});
const neonMaterials=new Set();
export function neon(color,strength=3){const m=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:strength*.35,roughness:.3,metalness:.25});m.userData.baseGlow=strength;neonMaterials.add(m);return m;}
export function setNeonGlow(value){for(const m of neonMaterials)m.emissiveIntensity=m.userData.baseGlow*value;}

const glowC=neon(CYAN,6.3),glowP=neon(PINK,6.1),white=neon(0xd8f5ff,1.9);
const boxGeo=new THREE.BoxGeometry(1,1,1),v3=new THREE.Vector3(),dummy=new THREE.Object3D();
function box(parent,x,y,z,sx,sy,sz,mat,rot=0){const m=new THREE.Mesh(boxGeo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.z=rot;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function tube(parent,pts,r,mat,seg=80){const curve=new THREE.CatmullRomCurve3(pts);const m=new THREE.Mesh(new THREE.TubeGeometry(curve,seg,r,5,false),mat);parent.add(m);return m;}
function line(parent,pts,color,opacity=1){const g=new THREE.BufferGeometry().setFromPoints(pts),m=new THREE.Line(g,new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity}));parent.add(m);return m;}
export function label(text,color='#d7faff',w=512,h=128){
 const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');
 ctx.clearRect(0,0,w,h);ctx.font=`600 ${Math.round(h*.43)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.shadowColor=color;ctx.shadowBlur=12;ctx.fillStyle=color;ctx.fillText(text,w/2,h/2,w*.95);
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
 const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false,toneMapped:false}));sp.scale.set(w/h*1.8,1.8,1);return sp;
}
export function buildSky(scene){
 const sky=new THREE.Mesh(new THREE.SphereGeometry(33000,40,28),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{},vertexShader:`varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`
 varying vec3 vDir;
 float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float ns(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x),f.y);}
 void main(){vec3 d=normalize(vDir);float h=max(0.,d.y);vec3 c=mix(vec3(.032,.050,.065),vec3(.006,.016,.032),pow(h,.42));
 float glow=pow(max(0.,dot(d,normalize(vec3(.9,.06,-.7)))),7.);c+=vec3(.065,.042,.024)*glow*pow(1.-h,4.);
 vec2 uv=d.xz/(abs(d.y)+.22);float wisps=ns(uv*6.)*.6+ns(uv*15.)*.3+ns(uv*34.)*.1;
 float cloud=smoothstep(.59,.74,wisps)*smoothstep(.02,.1,h)*(1.-smoothstep(.25,.6,h));c=mix(c,vec3(.065,.085,.11),cloud*.035);
 gl_FragColor=vec4(c,1.);}` }));
 sky.frustumCulled=false;sky.renderOrder=-100;scene.add(sky);
 let seed=58213;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 const stars=[];for(let i=0;i<420;i++){const theta=rand()*Math.PI*2,y=.22+rand()*.75,r=Math.sqrt(1-y*y);stars.push(Math.cos(theta)*r*26000,y*26000,Math.sin(theta)*r*26000);}
 const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));
 const star=new THREE.Points(sg,new THREE.PointsMaterial({color:0xc4d6ff,size:13,sizeAttenuation:true,transparent:true,opacity:.55,depthWrite:false,fog:false}));scene.add(star);
 const moon=new THREE.Mesh(new THREE.SphereGeometry(73,20,16),new THREE.MeshBasicMaterial({color:0xd8e7ff,fog:false}));moon.position.set(-11000,9400,-19000);scene.add(moon);
 return {sky,star};
}
function buildFence(scene,side){
 const color=side<0?CYAN:PINK,mat=side<0?glowC:glowP,base=[],top=[],verts=[],idx=[];
 for(let i=0;i<=1100;i++){
  const s=-70+i/1100*(LENGTH+170),x=center(s)+side*halfWidth(s),y=groundHeight(x,s);
  base.push(new THREE.Vector3(x,y+.20,-s));top.push(new THREE.Vector3(x,y+1.28,-s));verts.push(x,y+.22,-s,x,y+1.25,-s);
  if(i<1100){let a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}
 }
 tube(scene,base,.09,mat,1500);tube(scene,top,.036,mat,1500);
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(idx);geo.computeVertexNormals();
 scene.add(new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.038,depthWrite:false,blending:THREE.AdditiveBlending})));
 const count=190,pole=new THREE.InstancedMesh(new THREE.CylinderGeometry(.055,.075,1.55,5),carbon,count);pole.castShadow=true;
 dummy.scale.set(1,1,1);dummy.rotation.set(0,0,0);
 for(let i=0;i<count;i++){const s=-65+i*16,x=center(s)+side*halfWidth(s);dummy.position.set(x,groundHeight(x,s)+.73,-s);dummy.updateMatrix();pole.setMatrixAt(i,dummy.matrix);}scene.add(pole);
}
let haloTexture;
function surfacePatch(scene,s,x,width,length,color,opacity=.24){
 if(!haloTexture){const c=document.createElement('canvas');c.width=c.height=128;const a=c.getContext('2d'),g=a.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.35,'rgba(255,255,255,.6)');g.addColorStop(1,'rgba(255,255,255,0)');a.fillStyle=g;a.fillRect(0,0,128,128);haloTexture=new THREE.CanvasTexture(c);}
 const vs=[],uv=[],idx=[],rows=12;
 for(let j=0;j<=rows;j++)for(let k=0;k<=4;k++){const ss=s+(j/rows-.5)*length,xx=x+(k/4-.5)*width+(center(ss)-center(s));vs.push(xx,groundHeight(xx,ss)+.065,-ss);uv.push(k/4,j/rows);if(j<rows&&k<4){const a=j*5+k;idx.push(a,a+1,a+5,a+1,a+6,a+5);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
 const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:haloTexture,color,transparent:true,opacity:opacity*.45,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-2}));scene.add(m);return m;
}
function arrowRibbon(scene,s,mat){
 const verts=[],idx=[];
 for(const side of [-1,1]){
  // A pair of broad, ground-conforming strokes points down the fall line.
  const points=[[raceLine(s)+side*8,s-2.8],[raceLine(s+3)+side*.12,s+3]];
  const a=new THREE.Vector2(...points[0]),b=new THREE.Vector2(...points[1]),d=b.clone().sub(a).normalize(),perp=new THREE.Vector2(-d.y,d.x).multiplyScalar(.19);
  const q=[a.clone().sub(perp),a.clone().add(perp),b.clone().sub(perp),b.clone().add(perp)],base=verts.length/3;
  for(const v of q)verts.push(v.x,groundHeight(v.x,v.y)+.058,-v.y);idx.push(base,base+1,base+2,base+1,base+3,base+2);
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(idx);geo.computeVertexNormals();scene.add(new THREE.Mesh(geo,mat));
}
export function buildCourse(scene,gates,{environment=true}={}){
 let boostMat=null;
 if(environment){
 buildFence(scene,-1);buildFence(scene,1);
 // Two flowing white ski lines replace the rigid single middle rail.
 for(const side of [-1,1]){const pts=[];for(let s=-15;s<LENGTH;s+=2.4){const x=raceLine(s)+side*.21;pts.push(new THREE.Vector3(x,groundHeight(x,s)+.046,-s));}tube(scene,pts,.022,white,2100);}
 boostMat=neon(0xb1fb45,2.1);
 for(const r of RAMPS)for(let s=r.s-102;s<r.s-11;s+=7)arrowRibbon(scene,s,boostMat);
 }
 const objects=[];
 for(const g of gates){
  const root=new THREE.Group();root.position.set(g.x,groundHeight(g.x,g.s),-g.s);root.rotation.y=-Math.atan(tangent(g.s));scene.add(root);
  const baseLeft=g.kind==='ring'?(g.ramp%2?PINK:CYAN):CYAN,baseRight=g.kind==='ring'?baseLeft:PINK;
  const left=neon(baseLeft,g.kind==='flag'?2.3:6),right=neon(baseRight,g.kind==='flag'?2.3:6),shell=new THREE.Group();root.add(shell);
  let orbit=null;
  if(g.kind==='arch'){
   const lp=[[-g.half,0],[-g.half,7.1],[-g.half+.5,8.5],[-g.half+1.6,9.0],[0,9.0]].map(v=>new THREE.Vector3(v[0],v[1],0));
   const rp=lp.map(v=>new THREE.Vector3(-v.x,v.y,v.z));
   tube(shell,lp,.26,carbon,32).position.z=-.22;tube(shell,rp,.26,carbon,32).position.z=-.22;tube(shell,lp,.13,left,32);tube(shell,rp,.13,right,32);
  }else if(g.kind==='ring'){
   for(let side=0;side<2;side++){
    const pts=[];for(let j=0;j<=44;j++){const a=Math.PI*j/44+side*Math.PI;pts.push(new THREE.Vector3(Math.cos(a)*g.half,Math.sin(a)*g.half+g.y,0));}
    tube(shell,pts,.23,carbon,64).position.z=-.20;tube(shell,pts,.13,side?right:left,64);
   }
   orbit=new THREE.Group();orbit.position.y=g.y;root.add(orbit);
   for(let i=0;i<7;i++){const a=i/7*Math.PI*2,arc=new THREE.Mesh(new THREE.TorusGeometry(g.half+.48,.032,4,8,.33),i%2?left:right);arc.rotation.z=a;orbit.add(arc);}
   if(!g.learning){const beacon=label('AIR RING',g.ramp%2?'#ff9ee5':'#9afaff');beacon.position.set(0,g.y+g.half+1.35,0);beacon.scale.set(4.8,1.2,1);root.add(beacon);}
  }else{
   // Slalom flags keep the mountain view open between the big aerial rings.
   for(const side of [-1,1]){
    const mat=side<0?left:right;
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.045,.065,3.6,6),carbon);pole.position.set(side*g.half,1.8,0);shell.add(pole);
    box(shell,side*(g.half+.85),2.6,0,1.75,1.25,.06,mat);box(shell,side*g.half,1.55,0,.075,3.1,.075,mat);
   }
  }
  if(g.kind!=='ring'){box(root,-g.half,.1,0,1.05,.2,1.35,carbon);box(root,g.half,.1,0,1.05,.2,1.35,carbon);}
  const footprint=surfacePatch(scene,g.s,g.x,24,20,g.kind==='ring'?baseLeft:CYAN,g.kind==='flag'?.09:.22);
  objects.push({root,left,right,shell,footprint,orbit,baseLeft:baseLeft.clone(),baseRight:baseRight.clone(),gate:g,hitTime:-100});
 }
 if(environment){
 // Tall, faceted crystal outcrops punctuate the jump lips instead of repeating
 // identical cones along every meter of course.
 const clusters=[];for(let s=90;s<LENGTH;s+=94)clusters.push({s,big:false});for(const r of RAMPS)clusters.push({s:r.s+6,big:true});
 const gemGeo=new THREE.OctahedronGeometry(1,0),gemC=neon(0x28cae2,1.35),gemP=neon(0xdc2bb6,1.45),gemsC=new THREE.InstancedMesh(gemGeo,gemC,clusters.length*2),gemsP=new THREE.InstancedMesh(gemGeo,gemP,clusters.length);gemsC.castShadow=gemsP.castShadow=true;
 let ic=0,ip=0;
 for(let i=0;i<clusters.length;i++){
  const {s,big}=clusters[i],side=i%2?1:-1,x=center(s)+side*(halfWidth(s)+4.8),y=groundHeight(x,s);
  for(let j=0;j<3;j++){const h=(j===1?4.9:2.7)*(big?1.7:1),xx=x+(j-1)*1.55;dummy.position.set(xx,y+h*.4,-s+Math.sin(j*3+i)*.7);dummy.scale.set(.65+(j===1?.35:0),h,.85);dummy.rotation.set((j-1)*.14,i*.7,(j-1)*.19);dummy.updateMatrix();if(j===1)gemsP.setMatrixAt(ip++,dummy.matrix);else gemsC.setMatrixAt(ic++,dummy.matrix);}
  if(big)surfacePatch(scene,s,x,19,26,side<0?CYAN:PINK,.46);
 }scene.add(gemsC,gemsP);
 for(let i=1;i<SECTIONS.length;i++){
  const sec=SECTIONS[i],s=sec.s-35,x=center(s)+(i%2?1:-1)*(halfWidth(s)+4),root=new THREE.Group();root.position.set(x,groundHeight(x,s),-s);scene.add(root);
  box(root,0,2.6,0,9,2.1,.3,carbon);box(root,0,1,0,.15,2,.2,carbon);const title=label(sec.name.toUpperCase(),i%2?'#ff96dd':'#9afaff');title.scale.set(8.2,2.05,1);title.position.set(0,2.6,.23);root.add(title);
 }
 }
 objects.update=(time,p,glow=.35,showTranslations=true)=>{
  if(boostMat)boostMat.emissiveIntensity=(2.1+Math.sin(time*4)*.25)*glow;
  const upcoming=objects.filter(o=>o.gate.learning&&!o.gate.hit&&!o.gate.missed&&o.gate.s>p.s-2).slice(0,2);

  for(const o of objects){
   const d=o.gate.s-p.s;o.root.visible=d>-90&&d<(o.gate.learning?400:920);o.footprint.visible=d>-50&&d<400;
   const showWord=o.gate.learning&&upcoming.includes(o)&&d>7&&d<230;
   if(showWord){
    const key=o.gate.unit.text+'|'+(showTranslations?o.gate.unit.translation:'');
    if(!o.wordSprite||o.wordKey!==key){if(o.wordSprite)disposeWord(o);o.wordSprite=ringWord(o.gate.unit,showTranslations);o.wordSprite.position.set(0,o.gate.y,.35);o.root.add(o.wordSprite);o.wordKey=key;}
    o.wordSprite.material.opacity=upcoming[0]===o?1:.46;
   }else if(o.wordSprite)disposeWord(o);
   if(o.orbit)o.orbit.rotation.z=Math.sin(time*.65+o.gate.index)*.13;
   const age=time-o.hitTime;
   if(age<.7){const k=1+Math.sin(age/.7*Math.PI)*.09;o.shell.scale.setScalar(k);o.left.emissiveIntensity=o.right.emissiveIntensity=(1.2+(1-age/.7)*2)*glow;}
   else{o.shell.scale.setScalar(1);if(!o.gate.hit)o.left.emissiveIntensity=o.right.emissiveIntensity=((o.gate.kind==='flag'?2.3:5.6)+Math.sin(time*2+o.gate.index)*.12)*glow;}
  }
 };
 objects.dispose=()=>{
  for(const o of objects){disposeWord(o);o.root.traverse(n=>{
   if(n.geometry&&n.geometry!==boxGeo&&!n.isSprite)n.geometry.dispose();
   const m=n.material;if(m&&m!==carbon){if(n.isSprite)m.map?.dispose();neonMaterials.delete(m);m.dispose();}
  });o.root.removeFromParent();o.footprint.geometry.dispose();o.footprint.material.dispose();o.footprint.removeFromParent();}
  objects.length=0;
 };
 return objects;
}
function disposeWord(o){if(!o.wordSprite)return;o.wordSprite.material.map.dispose();o.wordSprite.material.dispose();o.wordSprite.removeFromParent();o.wordSprite=null;}
function ringWord(unit,translations){
 const c=document.createElement('canvas');c.width=1024;c.height=512;const ctx=c.getContext('2d');
 const source=Array.from(unit.text).slice(0,150).join('')+(Array.from(unit.text).length>150?'…':'');
 function wrap(text,size){ctx.font=`600 ${size}px sans-serif`;const chunks=text.match(/\S+\s*|\s+/gu)||[text],lines=[];let line='';
  for(const chunk of chunks){for(const char of Array.from(chunk)){if(ctx.measureText(line+char).width>880&&line){lines.push(line.trim());line='';}line+=char;}}
  if(line.trim())lines.push(line.trim());return lines;
 }
 let size=84,lines=wrap(source,size);while(lines.length>3&&size>38){size-=6;lines=wrap(source,size);}
 const meaning=translations?String(unit.translation||''):'';const extra=meaning?70:0,h=Math.min(476,lines.length*(size+11)+extra+36),width=Math.min(980,Math.max(170,...lines.map(t=>{ctx.font=`600 ${size}px sans-serif`;return ctx.measureText(t).width+64;}),meaning?Math.min(900,Array.from(meaning).length*23+45):0));
 const y=(512-h)/2;ctx.fillStyle='rgba(5,17,29,.79)';ctx.beginPath();if(ctx.roundRect)ctx.roundRect((1024-width)/2,y,width,h,24);else ctx.rect((1024-width)/2,y,width,h);ctx.fill();
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`600 ${size}px sans-serif`;ctx.fillStyle='#f2f7ff';lines.forEach((t,i)=>ctx.fillText(t,512,y+30+size/2+i*(size+11),900));
 if(meaning){ctx.font='400 42px sans-serif';ctx.fillStyle='#b8cbd9';ctx.fillText(meaning,512,y+h-40,900);}
 const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false,depthTest:true,toneMapped:false,fog:false}));sprite.scale.set(13.6,6.8,1);return sprite;
}
function roof(parent,w,d,mat){
 box(parent,-w*.255,5.15,0,w*.61,.24,d+1.3,mat,.58);
 box(parent,w*.255,5.15,0,w*.61,.24,d+1.3,mat,-.58);
}
function chalet(scene,s,u,index){
 const x=center(s)+u,root=new THREE.Group();root.position.set(x,groundHeight(x,s)-.1,-s);root.rotation.y=(index%3-1)*.17;const k=.8+(index%3)*.17;root.scale.setScalar(k);scene.add(root);
 const timber=new THREE.MeshStandardMaterial({color:index%2?0x423448:0x4b3d40,roughness:.88});
 const stone=new THREE.MeshStandardMaterial({color:0x72778b,roughness:1});
 const window=neon(0xffc681,1.9),accent=index%2?glowP:glowC;
 box(root,0,.55,0,9,1.1,8,stone);box(root,0,2.65,0,8.8,3.5,7.8,timber);
 for(let j=0;j<7;j++)box(root,0,1.2+j*.45,3.94,8.8,.05,.1,carbon);
 roof(root,10,8,snow);
 box(root,0,1.7,4,1.35,2.7,.18,carbon);box(root,0,1.8,4.11,.78,1.7,.04,window);
 for(let side of [-1,1]){
  box(root,side*2.65,2.8,3.98,1.45,1.55,.11,carbon);box(root,side*2.65,2.8,4.05,1.2,1.3,.04,window);
  box(root,side*2.65,2.8,4.08,.055,1.3,.05,timber);box(root,side*2.65,2.8,4.08,1.2,.055,.05,timber);
  box(root,side*4.45,2.7,0,.04,1.2,1.7,window);
 }
 box(root,2.6,6.15,-1.3,.8,2,.9,stone);box(root,2.6,7.2,-1.3,1,.2,1.1,snow);
 const sign=label(index===0?'SCHWARZSEE':index===2?'ALPINE CLUB':index%2?'FONDUE':'REFUGE',index%2?'#ff9cde':'#8af7ff');sign.position.set(0,4.1,4.15);sign.scale.set(5.4,1.35,1);root.add(sign);
 // Two lean neon roof edges rather than an illuminated solid building.
 tube(root,[new THREE.Vector3(-5,3.65,4.7),new THREE.Vector3(0,6.9,4.7),new THREE.Vector3(5,3.65,4.7)],.055,accent,4);
 box(root,0,.08,5.2,10,.1,2.4,snow);
}
export function finishSentenceSign(text,translation=''){
 const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=768;const ctx=canvas.getContext('2d');
 function wrap(value,size){ctx.font=`600 ${size}px sans-serif`;const lines=[];let line='';for(const token of String(value).match(/\S+\s*|\s+/gu)||[]){if(ctx.measureText(line+token).width>1380&&line.trim()){lines.push(line.trim());line='';}if(ctx.measureText(token).width>1380){for(const char of Array.from(token)){if(ctx.measureText(line+char).width>1380&&line){lines.push(line.trim());line='';}line+=char;}}else line+=token;}if(line.trim())lines.push(line.trim());return lines;}
 let size=88,lines=wrap(text,size),meaning=wrap(translation,Math.max(14,size*.48));
 while(lines.length*size*1.2+meaning.length*Math.max(14,size*.48)*1.2>590&&size>14){size-=2;lines=wrap(text,size);meaning=wrap(translation,Math.max(14,size*.48));}
 ctx.fillStyle='rgba(5,18,31,.87)';ctx.fillRect(28,28,1480,712);ctx.strokeStyle='rgba(129,224,234,.42)';ctx.lineWidth=3;ctx.strokeRect(30,30,1476,708);
 ctx.textAlign='center';ctx.textBaseline='top';const height=lines.length*size*1.2+meaning.length*Math.max(14,size*.48)*1.2;let y=Math.max(58,(768-height)/2);
 ctx.fillStyle='#edf7ff';ctx.font=`600 ${size}px sans-serif`;for(const line of lines){ctx.fillText(line,768,y,1380);y+=size*1.2;}
 ctx.fillStyle='#bad4e0';ctx.font=`400 ${Math.max(14,size*.48)}px sans-serif`;for(const line of meaning){ctx.fillText(line,768,y+14,1380);y+=Math.max(14,size*.48)*1.2;}
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;const sign=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false,toneMapped:false,fog:false}));sign.scale.set(24,12,1);sign.userData.text=text;return sign;
}
export function buildDetails(scene){
 let seed=736201;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 const rocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),new THREE.MeshStandardMaterial({color:0x515c77,roughness:1}),170),caps=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),snow,170);
 rocks.castShadow=true;caps.castShadow=true;
 for(let i=0;i<170;i++){
  const s=-130+rand()*3400,side=rand()>.5?1:-1,u=side*(35+rand()*360),x=center(s)+u,y=groundHeight(x,s),sz=1+rand()*3.8;
  dummy.position.set(x,y-sz*.12,-s);dummy.scale.set(sz*1.4,sz*.63,sz);dummy.rotation.set(rand()*.5,rand()*6,rand()*.3);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);
  dummy.position.y+=sz*.26;dummy.scale.y*=.58;dummy.scale.x*=.96;dummy.updateMatrix();caps.setMatrixAt(i,dummy.matrix);
 }scene.add(rocks,caps);
 for(let i=0;i<12;i++)chalet(scene,2670+(i>>1)*55,(i%2?1:-1)*(39+(i%3)*18),i);
 const trees=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1,7),new THREE.MeshStandardMaterial({color:0x1d3a51,roughness:1}),240),snowTips=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1,7),snow,240);trees.castShadow=true;snowTips.castShadow=true;
 for(let i=0;i<80;i++){
  const s=2320+rand()*850,x=center(s)+(rand()>.5?1:-1)*(45+rand()*230),y=groundHeight(x,s),h=4+rand()*7;
  for(let tier=0;tier<3;tier++){
   const id=i*3+tier;dummy.rotation.set(0,rand()*6,0);dummy.position.set(x,y+h*(.32+tier*.22),-s);dummy.scale.set(h*(.27-tier*.055),h*.56,h*(.27-tier*.055));dummy.updateMatrix();trees.setMatrixAt(id,dummy.matrix);
   dummy.position.y+=h*.10;dummy.scale.multiplyScalar(.84);dummy.updateMatrix();snowTips.setMatrixAt(id,dummy.matrix);
  }
 }scene.add(trees,snowTips);
 // Finish portal and its small illuminated arrival plaza.
 const end=new THREE.Group(),s=LENGTH-6,x=center(s);end.position.set(x,groundHeight(x,s),-s);scene.add(end);end.userData.dynamicFinish=true;
 for(const side of [-1,1])box(end,side*11,5,0,.55,10,.7,carbon);
 box(end,0,9.8,0,23,1.9,.9,carbon);const banner=label('SCHWARZSEE  /  FINISH','#d5faff');banner.position.set(0,9.8,.55);banner.scale.set(18,4.5,1);end.add(banner);
 box(end,0,8.8,.55,22,.12,.16,glowC);box(end,0,10.8,.55,22,.12,.16,glowP);
 const flags=[];for(let i=0;i<=80;i++){const xx=-11+22*i/80;flags.push(new THREE.Vector3(xx,.04,0),new THREE.Vector3(xx,.04,4));}line(end,flags,0xd8edff,.6);
 // Cable lift silhouettes on the right shoulder.
 const cablePts=[];
 for(let i=0;i<10;i++){
  const s=100+i*295,x=center(s)+67,y=groundHeight(x,s);cablePts.push(new THREE.Vector3(x,y+14,-s));
  const root=new THREE.Group();root.position.set(x,y,-s);box(root,0,7,0,.55,14,.6,carbon);box(root,0,14,0,6,.35,.5,carbon);scene.add(root);
 }
 tube(scene,cablePts,.055,carbon,80);
 for(let i=0;i<19;i++){
  const s=160+i*139,x=center(s)+67,y=groundHeight(x,s),root=new THREE.Group();root.position.set(x,y+9,-s);scene.add(root);
  box(root,0,2.2,0,.1,4.2,.1,carbon);box(root,0,0,0,3,.15,1.1,carbon);box(root,0,.7,.45,3,1.2,.1,carbon);box(root,0,1.4,.45,3,.06,.12,glowC);
 }
 // Compact snowcat parked beyond the right barrier.
 const cat=new THREE.Group(),cs=375,cx=center(cs)+36;cat.position.set(cx,groundHeight(cx,cs)+.6,-cs);cat.rotation.y=.4;scene.add(cat);
 const yellow=new THREE.MeshStandardMaterial({color:0xf9b743,roughness:.45,metalness:.35});
 box(cat,-1.35,.3,0,1,1,4.6,carbon);box(cat,1.35,.3,0,1,1,4.6,carbon);box(cat,0,.85,0,2.8,.8,4,yellow);box(cat,0,1.8,.3,2.4,1.6,2.5,yellow);box(cat,0,2,.3+1.27,2.15,1.1,.06,carbon);box(cat,0,.3,3.1,5,.9,.2,yellow);
 let lessonBanner=false,sentenceSign=null,finishDistance=LENGTH;
 return {get sentenceText(){return sentenceSign?.userData.text||'';},setFinish(s,learning=false,summary=null){
  finishDistance=s;if(sentenceSign){sentenceSign.material.map.dispose();sentenceSign.material.dispose();sentenceSign.removeFromParent();sentenceSign=null;}
  end.position.set(center(s-6),groundHeight(center(s-6),s-6),-(s-6));end.visible=true;
  if(lessonBanner!==learning){const next=label(learning?'LESSON  /  FINISH':'SCHWARZSEE  /  FINISH','#d5faff');banner.material.map.dispose();banner.material.dispose();banner.material=next.material;lessonBanner=learning;}
  if(learning&&summary?.text){sentenceSign=finishSentenceSign(summary.text,summary.translation||'');sentenceSign.position.set(0,16.8,.8);sentenceSign.visible=false;end.add(sentenceSign);}
 },update(p,ready=false){if(sentenceSign)sentenceSign.visible=ready&&finishDistance-p.s<180;}};

}
export function addLights(scene){
 const hemi=new THREE.HemisphereLight(0x8bbdce,0x27374f,.85);scene.add(hemi);
 const sun=new THREE.DirectionalLight(0xffb77f,1.90);sun.position.set(-4200,7200,6200);scene.add(sun,sun.target);sun.castShadow=true;
 Object.assign(sun.shadow.camera,{left:-90,right:90,top:110,bottom:-110,near:1,far:800});sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.00015;sun.shadow.normalBias=.035;sun.shadow.radius=3;
 const fill=new THREE.DirectionalLight(0x739ace,.36);fill.position.set(3000,1000,-5000);scene.add(fill);
 const cyan=new THREE.PointLight(CYAN,145,44,1.65),pink=new THREE.PointLight(PINK,130,44,1.65);scene.add(cyan,pink);
 const gateLights=[new THREE.PointLight(CYAN,165,38,1.6),new THREE.PointLight(PINK,150,38,1.6)];scene.add(...gateLights);
 return {sun,cyan,pink,gateLights,update(p,next,glow=.35){
  cyan.intensity=145*glow;pink.intensity=130*glow;gateLights[0].intensity=165*glow;gateLights[1].intensity=150*glow;
  sun.target.position.set(p.x,p.y,-p.s-25);sun.position.copy(sun.target.position).add(new THREE.Vector3(-260,90,250));sun.target.updateMatrixWorld();
  const s=p.s+12,w=halfWidth(s);cyan.position.set(center(s)-w,groundHeight(center(s)-w,s)+1,-s);pink.position.set(center(s)+w,groundHeight(center(s)+w,s)+1,-s);
  if(next){gateLights[0].position.set(next.x-6,groundHeight(next.x,next.s)+4,-next.s);gateLights[1].position.set(next.x+6,groundHeight(next.x,next.s)+4,-next.s);}
 }};
}
