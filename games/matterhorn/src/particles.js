import * as THREE from 'three';
import {groundHeight} from './course.js';
export function createSnow(scene){
 const count=1900,p=new Float32Array(count*3);let seed=96423;const rand=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
 for(let i=0;i<count;i++)p.set([(rand()-.5)*84,(rand()-.5)*40,(rand()-.5)*84],i*3);
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(p,3));
 const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:{value:0},uCam:{value:new THREE.Vector3()},uPixel:{value:1}},vertexShader:`
 uniform float uTime;uniform vec3 uCam;uniform float uPixel;varying float vAlpha;
 void main(){vec3 box=vec3(84.,40.,84.);vec3 p=mod(position+vec3(sin(uTime*.2)*2.,-uTime*1.1,-uTime*.36)-uCam+box*.5,box)-box*.5+uCam;
 vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(80.*uPixel/max(1.,-mv.z),.7,3.2*uPixel);vAlpha=.30*(1.-smoothstep(20.,47.,length(p-uCam)));}
 `,fragmentShader:`varying float vAlpha;void main(){float r=length(gl_PointCoord-.5);float a=(1.-smoothstep(.1,.5,r))*vAlpha;gl_FragColor=vec4(.75,.85,1.,a);}`});
 const obj=new THREE.Points(geo,mat);obj.frustumCulled=false;scene.add(obj);
 return {setQuality(low){geo.setDrawRange(0,low?650:count);},update(time,camera,pixel){mat.uniforms.uTime.value=time;mat.uniforms.uCam.value.copy(camera.position);mat.uniforms.uPixel.value=pixel;}};
}
export function createSpray(scene){
 const max=640,pos=new Float32Array(max*3),life=new Float32Array(max),vel=new Float32Array(max*3),size=new Float32Array(max);let cursor=0;
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));geo.setAttribute('life',new THREE.BufferAttribute(life,1).setUsage(THREE.DynamicDrawUsage));geo.setAttribute('psize',new THREE.BufferAttribute(size,1));
 const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uPixel:{value:1}},vertexShader:`attribute float life;attribute float psize;uniform float uPixel;varying float vLife;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(psize*230.*uPixel/max(1.,-mv.z),0.,13.*uPixel);vLife=life;}`,fragmentShader:`varying float vLife;void main(){float a=(1.-smoothstep(.1,.5,length(gl_PointCoord-.5)))*max(0.,vLife)*.43;gl_FragColor=vec4(.78,.89,1.,a);}`});
 const points=new THREE.Points(geo,mat);points.frustumCulled=false;scene.add(points);
 function burst(p,num,impact=0){
  const side=Math.sign(p.steer)||1;
  for(let j=0;j<num;j++){
   const i=cursor++%max,k=i*3;pos[k]=p.x+(Math.random()-.5)*.65;pos[k+1]=p.y+.1;pos[k+2]=-p.s-.9+Math.random();
   vel[k]=p.vx-side*(1+Math.random()*3);vel[k+1]=.8+Math.random()*2+impact*.09;vel[k+2]=-p.vs*.4+Math.random()*4;
   life[i]=.6+Math.random()*.5;size[i]=.10+Math.random()*.24;
  }geo.attributes.psize.needsUpdate=true;
 }
 return {burst,update(p,dt,pixel){
  if(p.grounded&&p.speed>5&&Math.abs(p.steer)>.12)burst(p,Math.ceil(Math.abs(p.steer)*p.speed*dt*25));
  for(let i=0;i<max;i++)if(life[i]>0){const k=i*3;life[i]-=dt*.95;vel[k+1]-=4.8*dt;for(let a=0;a<3;a++)pos[k+a]+=vel[k+a]*dt;}
  geo.attributes.position.needsUpdate=true;geo.attributes.life.needsUpdate=true;mat.uniforms.uPixel.value=pixel;
 },clear(){life.fill(0);geo.attributes.life.needsUpdate=true;}};
}
export function createTracks(scene){
 const max=2300,vertsPer=12,pos=new Float32Array(max*vertsPer*3),born=new Float32Array(max*vertsPer);let cursor=0,filled=0,prev=null;
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));geo.setAttribute('birth',new THREE.BufferAttribute(born,1).setUsage(THREE.DynamicDrawUsage));geo.setDrawRange(0,0);
 const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,uniforms:{uTime:{value:0}},vertexShader:`attribute float birth;varying float vBirth;void main(){vBirth=birth;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform float uTime;varying float vBirth;void main(){float fade=1.-smoothstep(8.,44.,uTime-vBirth);gl_FragColor=vec4(.12,.22,.40,fade*.37);}`});
 const mesh=new THREE.Mesh(geo,mat);mesh.frustumCulled=false;scene.add(mesh);
 function stamp(x,s,side,width){const xx=x+side*.23+width;return [xx,groundHeight(xx,s)+.032,-s];}
 return {update(p,time){
  mat.uniforms.uTime.value=time;
  if(!p.grounded){prev=null;return;}if(!prev){prev={x:p.x,s:p.s};return;}
  if(Math.hypot(p.x-prev.x,p.s-prev.s)<.7)return;
  let n=(cursor%max)*vertsPer*3,b=(cursor%max)*vertsPer;
  for(const side of [-1,1]){
   const a=stamp(prev.x,prev.s,side,-.045),c=stamp(prev.x,prev.s,side,.045),d=stamp(p.x,p.s,side,-.045),e=stamp(p.x,p.s,side,.045);
   for(const v of [a,c,d,c,e,d]){pos.set(v,n);n+=3;born[b++]=time;}
  }
  cursor++;filled=Math.min(max,filled+1);geo.setDrawRange(0,filled*vertsPer);geo.attributes.position.needsUpdate=true;geo.attributes.birth.needsUpdate=true;prev={x:p.x,s:p.s};
 },clear(){cursor=filled=0;prev=null;geo.setDrawRange(0,0);}};
}
