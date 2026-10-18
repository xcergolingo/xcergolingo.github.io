import * as THREE from 'three';
import dem from '../assets/matterhorn-dem.json';
import {center,groundHeight,smooth,mix,clamp,COURSE_GLSL,RAMPS} from './course.js';
const bytes=Uint8Array.from(atob(dem.values),v=>v.charCodeAt(0)),view=new DataView(bytes.buffer),heights=new Float32Array(dem.width*dem.height);
for(let i=0;i<heights.length;i++)heights[i]=view.getUint16(i*2,true)*.25;
let peakIndex=0;for(let i=1;i<heights.length;i++)if(heights[i]>heights[peakIndex])peakIndex=i;
const px=dem.xMin+(peakIndex%dem.width)/(dem.width-1)*(dem.xMax-dem.xMin),pz=dem.zMin+Math.floor(peakIndex/dem.width)/(dem.height-1)*(dem.zMax-dem.zMin);
const correction=4478-heights[peakIndex];
export const PEAK=new THREE.Vector3(px,4478,pz);
export function demHeight(x,z){
 const u=clamp((x-dem.xMin)/(dem.xMax-dem.xMin)*(dem.width-1),0,dem.width-1.001),v=clamp((z-dem.zMin)/(dem.zMax-dem.zMin)*(dem.height-1),0,dem.height-1.001);
 const a=Math.floor(u),b=Math.floor(v),fx=u-a,fy=v-b,w=dem.width;
 const raw=mix(mix(heights[b*w+a],heights[b*w+a+1],fx),mix(heights[(b+1)*w+a],heights[(b+1)*w+a+1],fx),fy);
 // Restore the sampled summit locally; the rest of the real DEM is unchanged.
 return raw+correction*Math.exp(-((x-px)**2+(z-pz)**2)/(2*145**2));
}
function grid(nx,nz,fn,reverse=false){
 const g=new THREE.BufferGeometry(),p=new Float32Array((nx+1)*(nz+1)*3),idx=[];
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++)p.set(fn(i/nx,j/nz),3*(j*(nx+1)+i));
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;if(reverse)idx.push(a,c,b,b,c,d);else idx.push(a,b,c,b,d,c);}
 g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
const noiseGLSL=`
float snHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float snNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(snHash(i),snHash(i+vec2(1.,0.)),f.x),mix(snHash(i+vec2(0.,1.)),snHash(i+vec2(1.)),f.x),f.y);}
float snFbm(vec2 p){return snNoise(p)*.55+snNoise(p*2.03)*.26+snNoise(p*4.12)*.13+snNoise(p*8.27)*.06;}
${COURSE_GLSL}`;
export const terrainGlow={value:.35};
export function snowMaterial(piste=false){
 const m=new THREE.MeshStandardMaterial({color:piste?0xa5bdce:0xe0e4e9,roughness:.87,metalness:.025,vertexColors:!piste});
 m.onBeforeCompile=shader=>{
  shader.uniforms.uNeonLevel=terrainGlow;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vSnowWorld;\nvarying float vSnowUp;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSnowWorld=(modelMatrix*vec4(transformed,1.)).xyz;\nvSnowUp=normal.y;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uNeonLevel;\nvarying vec3 vSnowWorld;\nvarying float vSnowUp;\n'+noiseGLSL).replace('#include <color_fragment>',`#include <color_fragment>
   float sn=snFbm(vSnowWorld.xz*.07);
   float fine=snNoise(vSnowWorld.xz*2.4);
   diffuseColor.rgb*=.86+sn*.24+fine*.025;
   float snowView=length(vViewPosition);
   float cliff=(1.-smoothstep(.42,.79,vSnowUp))*smoothstep(2950.,3740.,vSnowWorld.y);
   float strata=smoothstep(.4,.65,sin(vSnowWorld.y*.11+vSnowWorld.x*.012+sn*8.)*.5+.5);
   diffuseColor.rgb*=1.-cliff*strata*.26;
   diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.38,.47,.60),cliff*strata*.4);
   float summit=smoothstep(3450.,4478.,vSnowWorld.y);
   diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.38,.88,.69),summit*.61);
   ${piste?`float s=-vSnowWorld.z;
   float u=vSnowWorld.x-skiCenter(s),w=skiWidth(s);
   float pisteMask=1.-smoothstep(w,w+6.,abs(u));
   float cord=sin((u+sin(s*.016)*.4)*31.)*.5+.5;
   diffuseColor.rgb*=1.-cord*.038*pisteMask*(1.-smoothstep(12.,90.,snowView));
   float windDune=snFbm(vSnowWorld.xz*vec2(.17,.021));
   diffuseColor.rgb*=.94+windDune*.12;`:''}
  `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   // Surface derivatives give the snow genuine micro-normal relief, without a
   // texture download. Fade it before distant features alias on phone screens.
   float powder=snNoise(vSnowWorld.xz*2.4)*.018*(1.-smoothstep(25.,130.,length(vViewPosition)));
   vec3 qp0=dFdx(-vViewPosition),qp1=dFdy(-vViewPosition);
   vec3 pp0=cross(qp1,normal),pp1=cross(normal,qp0);
   float determinant=dot(qp0,pp0);
   vec3 snowGradient=sign(determinant)*(dFdx(powder)*pp0+dFdy(powder)*pp1)/max(abs(determinant),.00001);
   normal=normalize(normal-snowGradient);
  `);
  if(piste)shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   float edgeGlow=exp(-abs(abs(u)-w)*.24)*.67;
   vec3 edgeColor=mix(vec3(.015,.75,.88),vec3(.85,.015,.50),step(0.,u));
   totalEmissiveRadiance+=edgeColor*edgeGlow*uNeonLevel;
   totalEmissiveRadiance+=vec3(.05,.09,.13)*pow(1.-pisteMask,2.)*.12;
  `);
 };
 m.customProgramCacheKey=()=>piste?'piste-v3-flow':'massif-v3-sunset';return m;
}
export function buildTerrain(scene){
 const geometry=grid(dem.width-1,dem.height-1,(u,v)=>{const x=mix(dem.xMin,dem.xMax,u),z=mix(dem.zMin,dem.zMax,v);return [x,demHeight(x,z),z];},true);
 const p=geometry.attributes.position,n=geometry.attributes.normal,c=new Float32Array(p.count*3),snow=new THREE.Color(0xd0dce4),rock=new THREE.Color(0x394a60),shadow=new THREE.Color(0x426581),col=new THREE.Color();
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),rugged=clamp((.72-n.getY(i))*2.9,0,.90)*smooth(2750,3550,y);
  col.copy(snow).lerp(rock,rugged);
  // Baked long-range cast shade preserves alpine ridge contrast even with the
  // economical near-player shadow camera or Performance graphics selected.
  let occluded=0;
  for(const d of [160,450,1000,1750])if(demHeight(x-d*.72,z+d*.69)>y+d*.25+15){occluded=1;break;}
  if(occluded)col.lerp(shadow,.52);
  col.multiplyScalar(.91+.09*Math.sin(x*.006+z*.011));c.set([col.r,col.g,col.b],i*3);
 }
 geometry.setAttribute('color',new THREE.BufferAttribute(c,3));
 const massif=new THREE.Mesh(geometry,snowMaterial());massif.frustumCulled=false;scene.add(massif);
 // Exact lip samples prevent a visual lip/physics mismatch at higher speeds.
 const rows=[];for(let s=-520;s<=4200;s+=6.5)rows.push(s);
 for(const r of RAMPS)for(const d of [-r.run,-12,-5,-2,0,2,5,12,25,40,58])rows.push(r.s+d);
 rows.sort((a,b)=>a-b);
 const pisteGeo=grid(176,rows.length-1,(u,v)=>{
  const q=u*2-1,a=Math.abs(q),lat=Math.sign(q)*(a<.6?a/.6*105:105+Math.pow((a-.6)/.4,1.35)*2695);
  const s=rows[Math.round(v*(rows.length-1))],x=center(s)+lat;
  let y=groundHeight(x,s);if(s>3250)y=mix(y,demHeight(x,-s),smooth(3250,4120,s));return [x,y,-s];
 });
 const piste=new THREE.Mesh(pisteGeo,snowMaterial(true));piste.receiveShadow=true;scene.add(piste);return {massif,piste};
}
