import * as THREE from './vendor/three.module.js';

export const C={ink:'#191827',cream:'#fff1cd',yellow:'#ffc943',orange:'#fa7548',pink:'#e271a4',purple:'#51405e',teal:'#438f91'};
const ramp=new THREE.DataTexture(new Uint8Array([90,157,213,255]),4,1,THREE.RedFormat);
ramp.minFilter=ramp.magFilter=THREE.NearestFilter;ramp.needsUpdate=true;
const materials=new Map(),outlines=new Map();
export function mat(color,opts={}){
  const key=String(color)+JSON.stringify(opts);if(!materials.has(key))materials.set(key,new THREE.MeshToonMaterial({color,gradientMap:ramp,...opts}));return materials.get(key);
}
export function outlined(geometry,material,thickness=.028){
 const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;
 if(thickness>0){
  if(!outlines.has(thickness))outlines.set(thickness,new THREE.ShaderMaterial({uniforms:{thickness:{value:thickness},ink:{value:new THREE.Color(C.ink)}},vertexShader:'uniform float thickness; void main(){vec3 p=position+normal*thickness; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}',fragmentShader:'uniform vec3 ink; void main(){gl_FragColor=vec4(ink,1.0);}',side:THREE.BackSide}));
  const edge=new THREE.Mesh(geometry,outlines.get(thickness));edge.userData.outline=true;edge.raycast=()=>{};mesh.add(edge);
 }return mesh;
}
function locate(m,pos,parent){if(pos){if(Array.isArray(pos))m.position.set(...pos);else m.position.copy(pos);}if(parent)parent.add(m);return m;}
export function box(w,h,d,color,pos,parent,outline=true){return locate(outlined(new THREE.BoxGeometry(w,h,d),color?.isMaterial?color:mat(color),outline?.028:0),pos,parent);}
export function ball(radius,color,pos,scale,parent,outline=true){const m=outlined(new THREE.SphereGeometry(radius,16,12),color?.isMaterial?color:mat(color),outline?.024:0);if(scale)m.scale.set(...scale);return locate(m,pos,parent);}
export function tube(points,radius,color,parent){const pts=points.map(p=>p.isVector3?p:new THREE.Vector3(...p));const m=outlined(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),12,radius,7,false),mat(color),.018);if(parent)parent.add(m);return m;}
export function canvasTexture(w,h,drawFn){const c=document.createElement('canvas');c.width=w;c.height=h;drawFn(c.getContext('2d'),w,h);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;}
export function label(text,{width=4,height=1,color=C.cream,background=C.ink,fontSize=80,border=false}={}){const tex=canvasTexture(1024,Math.max(128,Math.round(1024*height/width)),(ctx,w,h)=>{ctx.fillStyle=background;ctx.fillRect(0,0,w,h);if(border){ctx.strokeStyle=color;ctx.lineWidth=12;ctx.strokeRect(12,12,w-24,h-24);}ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`900 ${fontSize}px Impact,Arial Black,sans-serif`;ctx.fillStyle=color;ctx.fillText(text,w/2,h/2,w*.92);});return new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));}
