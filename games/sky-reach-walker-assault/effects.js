import * as THREE from './vendor/three.module.js';

const MAX_PARTICLES = 260;
const MAX_BEAMS = 100;
const UP = new THREE.Vector3(0, 1, 0);
const tmpDirection = new THREE.Vector3();
const tmpColor = new THREE.Color();
const particleVertex = /* glsl */`
  attribute float aSize;
  attribute float aAlpha;
  attribute float aKind;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vKind;
  #include <logdepthbuf_pars_vertex>
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vKind = aKind;
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = clamp(aSize * 650.0 / max(1.0, -view.z), 0.0, 180.0);
    #include <logdepthbuf_vertex>
  }
`;
const particleFragment = /* glsl */`
  varying vec3 vColor;
  varying float vAlpha;
  varying float vKind;
  #include <logdepthbuf_pars_fragment>
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0 || vAlpha < .002) discard;
    #include <logdepthbuf_fragment>
    float soft = max(0.0, 1.0 - r);
    float a;
    vec3 c;
    if (vKind < .5) {
      float core = pow(soft, 6.0);
      a = (pow(soft, 1.9) * .75 + core) * vAlpha;
      c = mix(vColor, vec3(1.0), core * .82);
    } else {
      float cloud = .86 + .14 * sin(p.x * 8.0 + sin(p.y * 6.0));
      a = pow(soft, 1.55) * vAlpha * cloud;
      c = vColor * (.82 + .18 * soft);
    }
    gl_FragColor = vec4(c, clamp(a, 0.0, 1.0));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Small fixed pools; particles and laser beams never allocate during update. */
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.cursor = 0;
    this.beamCursor = 0;
    this.ringCursor = 0;
    this.time = 0;
    this.particles = Array.from({length: MAX_PARTICLES}, () => ({
      active:false, age:0, life:1, x:0, y:0, z:0,
      vx:0, vy:0, vz:0, size:1, kind:0, alpha:1,
      r:1, g:1, b:1,
    }));
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.sizes = new Float32Array(MAX_PARTICLES);
    this.alphas = new Float32Array(MAX_PARTICLES);
    this.kinds = new Float32Array(MAX_PARTICLES);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aKind', new THREE.BufferAttribute(this.kinds, 1).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      vertexShader:particleVertex, fragmentShader:particleFragment,
      transparent:true, depthWrite:false, depthTest:true,
      blending:THREE.NormalBlending, toneMapped:false,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    this.points.name = 'Pooled impact sparks and dust';
    scene.add(this.points);

    this.beams = Array.from({length:MAX_BEAMS}, () => ({active:false, age:0, life:.22,
      x:0,y:0,z:0,length:0,width:1,r:1,g:1,b:1,quaternion:new THREE.Quaternion()}));
    const cylinder = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
    this.beamCore = new THREE.InstancedMesh(cylinder, new THREE.MeshBasicMaterial({
      color:0xffffff, transparent:true, opacity:.96, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false,
    }), MAX_BEAMS);
    this.beamGlow = new THREE.InstancedMesh(cylinder, new THREE.MeshBasicMaterial({
      color:0xffffff, transparent:true, opacity:.19, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false,
    }), MAX_BEAMS);
    this.beamCore.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.beamGlow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.beamCore.frustumCulled = false;this.beamGlow.frustumCulled = false;
    this.beamCore.name = 'Pooled laser cores';this.beamGlow.name = 'Pooled laser halos';
    this.beamCore.renderOrder = 3;this.beamGlow.renderOrder = 2;
    this.dummy = new THREE.Object3D();this.dummy.scale.set(0,0,0);this.dummy.updateMatrix();
    for(let i=0;i<MAX_BEAMS;i++) {
      this.beamCore.setMatrixAt(i,this.dummy.matrix);this.beamGlow.setMatrixAt(i,this.dummy.matrix);
      this.beamCore.setColorAt(i,new THREE.Color(0xffffff));this.beamGlow.setColorAt(i,new THREE.Color(0xffffff));
    }
    scene.add(this.beamCore,this.beamGlow);

    const ringGeometry = new THREE.RingGeometry(.86,1,48);
    this.rings = Array.from({length:8}, () => {
      const mat = new THREE.MeshBasicMaterial({color:0xe9c195,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
      const mesh = new THREE.Mesh(ringGeometry,mat);mesh.rotation.x=-Math.PI/2;mesh.visible=false;mesh.frustumCulled=false;scene.add(mesh);
      return {mesh,age:0,life:1.4,scale:1};
    });
  }

  _emit(position,color,size,life,vx,vy,vz,kind=0,alpha=1) {
    const p=this.particles[this.cursor];this.cursor=(this.cursor+1)%MAX_PARTICLES;
    tmpColor.set(color);
    p.active=true;p.age=0;p.life=life;p.x=position.x;p.y=position.y;p.z=position.z;
    p.vx=vx;p.vy=vy;p.vz=vz;p.size=size;p.kind=kind;p.alpha=alpha;
    p.r=tmpColor.r;p.g=tmpColor.g;p.b=tmpColor.b;
  }

  burst(position,color=0xffaa55,count=25,scale=1) {
    const amount=Math.min(MAX_PARTICLES,Math.max(1,Math.floor(count)));
    const s=Math.max(.1,scale);
    for(let i=0;i<amount;i++) {
      const angle=Math.random()*Math.PI*2,up=Math.random()*1.75-.45;
      const velocity=(5+Math.random()*23)*s,radial=Math.sqrt(Math.max(0,1-up*up*.45));
      const dust=i%4===0;
      this._emit(position,dust?0x9c8270:color,
        (dust?5+Math.random()*6:.9+Math.random()*2.5)*s,
        (dust?1.2: .35)+Math.random()*(dust?1.2:.65),
        Math.cos(angle)*velocity*radial,up*velocity+3*s,Math.sin(angle)*velocity*radial,
        dust?1:0,dust?.62:1);
    }
    if(s>=1.8 || amount>=35) {
      const r=this.rings[this.ringCursor];this.ringCursor=(this.ringCursor+1)%this.rings.length;
      r.age=0;r.scale=s;r.life=1.15+Math.min(s,8)*.08;
      r.mesh.position.copy(position);r.mesh.position.y+=.8;r.mesh.visible=true;
      r.mesh.material.color.set(color).lerp(new THREE.Color(0xe2c6ac),.7);
    }
  }

  dust(position,scale=1) {
    const s=Math.max(.1,scale);
    for(let i=0;i<7;i++) {
      const angle=Math.random()*Math.PI*2,velocity=(2+Math.random()*5)*s;
      this._emit(position,i%2?0xb99a73:0xa39b81,(3+Math.random()*5)*s,1.0+Math.random()*.9,
        Math.cos(angle)*velocity,(2+Math.random()*4)*s,Math.sin(angle)*velocity,1,.38+Math.random()*.18);
    }
  }

  beam(from,to,color=0x88f3ff,life=.22,width=1.2) {
    tmpDirection.subVectors(to,from);
    const length=tmpDirection.length();if(length<.01 || !Number.isFinite(length))return;
    const b=this.beams[this.beamCursor];this.beamCursor=(this.beamCursor+1)%MAX_BEAMS;
    b.active=true;b.age=0;b.life=Math.max(.035,life);b.width=Math.max(.025,width);
    b.x=(from.x+to.x)*.5;b.y=(from.y+to.y)*.5;b.z=(from.z+to.z)*.5;b.length=length;
    b.quaternion.setFromUnitVectors(UP,tmpDirection.multiplyScalar(1/length));
    tmpColor.set(color);b.r=tmpColor.r;b.g=tmpColor.g;b.b=tmpColor.b;
  }

  update(dt,time=0) {
    const delta=Math.min(.05,Math.max(0,dt));this.time=time;
    for(let i=0;i<MAX_PARTICLES;i++) {
      const p=this.particles[i];
      if(!p.active) {this.sizes[i]=0;this.alphas[i]=0;continue;}
      p.age+=delta;
      if(p.age>=p.life) {p.active=false;this.sizes[i]=0;this.alphas[i]=0;continue;}
      const t=p.age/p.life,drag=Math.exp(-delta*(p.kind?2.0:1.35));
      p.vx*=drag;p.vz*=drag;p.vy=p.vy*drag+(p.kind?.35:-7.5)*delta;
      p.x+=p.vx*delta;p.y+=p.vy*delta;p.z+=p.vz*delta;
      const n=i*3;this.positions[n]=p.x;this.positions[n+1]=p.y;this.positions[n+2]=p.z;
      this.colors[n]=p.r;this.colors[n+1]=p.g;this.colors[n+2]=p.b;
      this.sizes[i]=p.size*(p.kind?1+t*1.4:1-t*.65);
      this.alphas[i]=p.alpha*Math.pow(1-t,p.kind?1.1:.65);this.kinds[i]=p.kind;
    }
    for(const name of ['position','aColor','aSize','aAlpha','aKind'])this.geometry.attributes[name].needsUpdate=true;

    const d=this.dummy;
    for(let i=0;i<MAX_BEAMS;i++) {
      const b=this.beams[i];
      if(b.active) {
        b.age+=delta;if(b.age>=b.life)b.active=false;
      }
      if(!b.active) {
        d.scale.set(0,0,0);d.updateMatrix();this.beamCore.setMatrixAt(i,d.matrix);this.beamGlow.setMatrixAt(i,d.matrix);continue;
      }
      const fade=Math.pow(1-b.age/b.life,.45);
      d.position.set(b.x,b.y,b.z);d.quaternion.copy(b.quaternion);
      d.scale.set(b.width*.24*fade,b.length,b.width*.24*fade);d.updateMatrix();this.beamCore.setMatrixAt(i,d.matrix);
      d.scale.set(b.width*1.35*fade,b.length,b.width*1.35*fade);d.updateMatrix();this.beamGlow.setMatrixAt(i,d.matrix);
      tmpColor.setRGB((b.r*.55+.45)*fade,(b.g*.55+.45)*fade,(b.b*.55+.45)*fade);this.beamCore.setColorAt(i,tmpColor);
      tmpColor.setRGB(b.r*fade,b.g*fade,b.b*fade);this.beamGlow.setColorAt(i,tmpColor);
    }
    this.beamCore.instanceMatrix.needsUpdate=true;this.beamGlow.instanceMatrix.needsUpdate=true;
    this.beamCore.instanceColor.needsUpdate=true;this.beamGlow.instanceColor.needsUpdate=true;

    for(const r of this.rings) {
      if(!r.mesh.visible)continue;
      r.age+=delta;const t=r.age/r.life;
      if(t>=1){r.mesh.visible=false;continue;}
      const radius=(2+35*t)*r.scale;r.mesh.scale.set(radius,radius,1);
      r.mesh.material.opacity=.32*Math.pow(1-t,1.8);
    }
  }
}
