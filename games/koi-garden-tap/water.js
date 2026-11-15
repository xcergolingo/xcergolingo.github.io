import * as THREE from 'three';

const wavesGLSL = [
  'uniform float uTime; uniform vec4 uImpulses[12]; uniform float uCount; uniform vec3 uVortex;',
  'vec3 surfaceAt(vec2 p) {',
  ' float a=p.x*1.7+p.y*1.18+uTime*0.8; float b=p.x*-2.5+p.y*1.83-uTime*0.65;',
  ' float h=sin(a)*0.008+sin(b)*0.005;',
  ' vec2 grad=vec2(1.7,1.18)*cos(a)*0.008+vec2(-2.5,1.83)*cos(b)*0.005;',
  ' for(int i=0;i<12;i++){ if(float(i)>=uCount)break; vec4 w=uImpulses[i]; vec2 d=p-w.xy; float r=max(length(d),0.001); float front=r-w.z*1.4; float wave=r*13.0-w.z*12.5; float env=exp(-front*front*2.2-w.z*1.05); float dep=exp(-r*r*8.0-w.z*5.5);',
  '  h+=w.w*(sin(wave)*env*0.45-dep); grad+=d/r*w.w*((13.0*cos(wave)-4.4*front*sin(wave))*env*0.45+16.0*r*dep); }',
  ' if(uVortex.z>0.0){vec2 d=p-uVortex.xy; float r=max(length(d),0.02); float well=exp(-r*r*0.85); float theta=atan(d.y,d.x); float swirl=sin(theta*3.0+r*9.0-uTime*4.5)*exp(-r*1.6)*0.012;',
  ' h-=well*0.10*uVortex.z; h+=swirl*uVortex.z; grad+=d/r*(r*0.17*well+cos(theta*3.0+r*9.0-uTime*4.5)*0.10*exp(-r*1.6))*uVortex.z; }',
  ' return vec3(grad.x,grad.y,h);',
  '}'
].join('\n');
export function createWater(radius,y){
  const target=new THREE.WebGLRenderTarget(1,1,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true});
  target.texture.colorSpace=THREE.LinearSRGBColorSpace;
  target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedShortType);
  const uniforms={uTime:{value:0},uImpulses:{value:Array.from({length:12},()=>new THREE.Vector4())},uCount:{value:0},uVortex:{value:new THREE.Vector3()},uUnderwater:{value:target.texture},uDepth:{value:target.depthTexture},uRadius:{value:radius},uNear:{value:.1},uFar:{value:60},uClarity:{value:.6}};
  const vertex=[wavesGLSL,'varying vec3 vWorld; varying vec4 vScreen; varying float vDistance;',
    'void main(){vec3 p=position; p.y+=surfaceAt(p.xz).z; vec4 world=modelMatrix*vec4(p,1.0); vWorld=world.xyz; vec4 mv=viewMatrix*world; vDistance=-mv.z; vScreen=projectionMatrix*mv; gl_Position=vScreen;}'].join('\n');
  const fragment=[wavesGLSL,
    'uniform sampler2D uUnderwater; uniform sampler2D uDepth; uniform float uRadius; uniform float uNear; uniform float uFar; uniform float uClarity;',
    'varying vec3 vWorld; varying vec4 vScreen; varying float vDistance;',
    'void main(){if(length(vWorld.xz)>uRadius)discard;',
    ' vec2 uv=vScreen.xy/vScreen.w*0.5+0.5; vec3 s=surfaceAt(vWorld.xz); vec3 n=normalize(vec3(-s.x,1.0,-s.y));',
    ' float underDepth=mix(uNear,uFar,texture2D(uDepth,uv).x); float depth=clamp(underDepth-vDistance,0.0,2.2);',
    ' vec2 offset=vec2(n.x,-n.z)*(0.004+depth*0.008); vec2 refractUV=clamp(uv+offset,vec2(0.002),vec2(0.998));',
    ' vec3 col=texture2D(uUnderwater,refractUV).rgb;',
    ' float absorption=1.0-exp(-depth*mix(0.12,0.045,uClarity)); col=mix(col,vec3(0.055,0.45,0.39),absorption);',
    ' vec3 viewDir=normalize(cameraPosition-vWorld); vec3 sunDir=normalize(vec3(-0.45,1.0,-0.32)); vec3 halfDir=normalize(viewDir+sunDir);',
    ' float shine=pow(max(dot(n,halfDir),0.0),210.0); float fresnel=0.012+0.12*pow(1.0-max(dot(n,viewDir),0.0),5.0);',
    ' col=mix(col,vec3(0.76,0.9,0.84),fresnel); col+=vec3(0.85,0.96,0.80)*shine*0.6;',
    ' gl_FragColor=vec4(col,1.0);',
    '#include <tonemapping_fragment>',
    '#include <colorspace_fragment>',
    '}'
  ].join('\n');
  const material=new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment,side:THREE.DoubleSide,depthWrite:true,depthTest:true});
  const geo=new THREE.PlaneGeometry(radius*2,radius*2,72,72);geo.rotateX(-Math.PI/2);const mesh=new THREE.Mesh(geo,material);mesh.position.y=y;mesh.renderOrder=0;
  const impulses=[];
  return {mesh,material,uniforms,target,
    impulse(x,z,strength=.075){impulses.push({x,z,age:0,strength});if(impulses.length>12)impulses.shift();},
    tick(time,dt,vortex){uniforms.uTime.value=time;for(let i=impulses.length-1;i>=0;i--){impulses[i].age+=dt;if(impulses[i].age>4.4)impulses.splice(i,1);}uniforms.uCount.value=impulses.length;for(let i=0;i<impulses.length;i++){const p=impulses[i];uniforms.uImpulses.value[i].set(p.x,p.z,p.age,p.strength);}uniforms.uVortex.value.set(vortex?.x||0,vortex?.y||0,vortex?1:0);},
    resize(width,height){const ratio=Math.min(devicePixelRatio||1,1.35);target.setSize(Math.round(width*ratio),Math.round(height*ratio));},
    render(renderer,scene,camera,aboveWater=[]){const visible=aboveWater.map(o=>o.visible);aboveWater.forEach(o=>o.visible=false);mesh.visible=false;uniforms.uNear.value=camera.near;uniforms.uFar.value=camera.far;renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(null);mesh.visible=true;aboveWater.forEach((o,i)=>o.visible=visible[i]);renderer.render(scene,camera);},
    calm(){impulses.length=0;uniforms.uCount.value=0;}
  };
}
