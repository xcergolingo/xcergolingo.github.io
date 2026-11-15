import * as THREE from './vendor/three.module.js';

// The four new rides get their own lightweight scenery. Every object belongs to
// this root so changing rides also releases its GPU resources.
export function createRideEffects(scene, track) {
  const root = new THREE.Group();
  root.name = `Ride scenery — ${track.ride.name}`;
  root.userData.rideId = track.ride.id;
  root.userData.features = [];
  scene.add(root);
  const geometries = new Set(), materials = new Set(), animated = [];
  let disposed = false, seed = 71483;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const vec = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const matrix = new THREE.Matrix4(), object = new THREE.Object3D();
  const up = vec(0, 1, 0), normalMatrix = new THREE.Matrix3();
  const ownGeometry = geometry => { geometries.add(geometry); return geometry; };
  const standard = options => { const material = new THREE.MeshStandardMaterial({ roughness: .85, metalness: .03, ...options }); materials.add(material); return material; };
  const basic = options => { const material = new THREE.MeshBasicMaterial(options); materials.add(material); return material; };
  const shader = options => { const material = new THREE.ShaderMaterial(options); materials.add(material); return material; };
  function addMesh(geometry, material, position = vec(), quaternion = null, scale = null) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    if (quaternion) mesh.quaternion.copy(quaternion);
    if (scale) mesh.scale.copy(scale);
    root.add(mesh);
    return mesh;
  }
  function instance(geometry, material, entries, name) {
    if (!entries.length) return null;
    const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
    mesh.name = name;
    entries.forEach((entry, i) => {
      mesh.setMatrixAt(i, entry.matrix || entry);
      if (entry.color) mesh.setColorAt(i, entry.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    root.add(mesh);
    return mesh;
  }
  function boxMatrix(position, scale, quaternion = null) {
    object.position.copy(position);
    object.scale.copy(scale);
    if (quaternion) object.quaternion.copy(quaternion); else object.quaternion.identity();
    object.updateMatrix();
    return object.matrix.clone();
  }
  function beamMatrix(a, b, radius) {
    const delta = b.clone().sub(a);
    object.position.copy(a).add(b).multiplyScalar(.5);
    object.quaternion.setFromUnitVectors(up, delta.clone().normalize());
    object.scale.set(radius, delta.length(), radius);
    object.updateMatrix();
    return object.matrix.clone();
  }
  function range(kind) {
    const zones = (track.featureZones || []).filter(zone => zone.kind === kind);
    return zones.length ? zones : track.sections.filter(section => section.type === kind);
  }
  function distanceFromTrack(position) {
    let closest = Infinity;
    for (let i = 0; i < track.samples.length; i += 2) closest = Math.min(closest, position.distanceToSquared(track.samples[i]));
    return Math.sqrt(closest);
  }
  function clearOfTrack(position, radius, margin = 4.5) {
    return distanceFromTrack(position) > radius + margin;
  }
  function record(feature) { root.userData.features.push(feature); }

  // Bake many small rocks into one mesh, preserving distinct flat facets.
  function rockBatch(entries, material) {
    if (!entries.length) return;
    const primitive = new THREE.IcosahedronGeometry(1, 1);
    const nonIndexed = primitive.index ? primitive.toNonIndexed() : primitive;
    nonIndexed.computeVertexNormals();
    const positions = [], normals = [], colors = [], point = vec(), normal = vec();
    const p = nonIndexed.attributes.position, n = nonIndexed.attributes.normal;
    for (const entry of entries) {
      matrix.compose(entry.position, new THREE.Quaternion().setFromAxisAngle(up, entry.yaw), entry.scale);
      normalMatrix.getNormalMatrix(matrix);
      for (let i = 0; i < p.count; i++) {
        point.fromBufferAttribute(p, i).applyMatrix4(matrix);
        normal.fromBufferAttribute(n, i).applyNormalMatrix(normalMatrix);
        positions.push(point.x, point.y, point.z);
        normals.push(normal.x, normal.y, normal.z);
        colors.push(entry.color.r, entry.color.g, entry.color.b);
      }
    }
    if (nonIndexed !== primitive) nonIndexed.dispose();
    primitive.dispose();
    const geometry = ownGeometry(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();
    const mesh = addMesh(geometry, material);
    mesh.name = 'Layered canyon stone';
    mesh.castShadow = true; mesh.receiveShadow = true;
  }

  function buildComet() {
    const launch = range('launch')[0];
    if (!launch) return;
    const postMaterial = standard({ color: 0x294e5f, metalness: .38, roughness: .5 });
    const stripMaterial = basic({ color: 0x6ee3ff });
    const lampMaterial = basic({ color: 0xffffff, vertexColors: true });
    const footMaterial = standard({ color: 0xb2c8c6 });
    const posts = [], strips = [], feet = [], lamps = [];
    const cylinder = ownGeometry(new THREE.CylinderGeometry(1, 1, 1, 6));
    const box = ownGeometry(new THREE.BoxGeometry(1, 1, 1));
    const sphere = ownGeometry(new THREE.SphereGeometry(.27, 8, 6));
    const span = launch.end - launch.start;
    for (let d = launch.start + 4; d < launch.end - 3; d += 3) {
      const frame = track.getFrame(d);
      for (const side of [-1, 1]) {
        const p = frame.position.clone().addScaledVector(frame.right, side * 2.9).addScaledVector(frame.up, .12);
        strips.push(boxMatrix(p, vec(.18, .13, 1.35), frame.quaternion));
      }
    }
    const count = Math.max(3, Math.min(7, Math.floor(span / 16)));
    for (let i = 0; i < count; i++) {
      const d = launch.start + 6 + i / Math.max(1, count - 1) * Math.max(0, span - 12);
      const frame = track.getFrame(d);
      for (const side of [-1, 1]) {
        const base = frame.position.clone().addScaledVector(frame.right, side * 6.6).addScaledVector(frame.up, -1.0);
        const top = base.clone().addScaledVector(frame.up, 7.8);
        // Pylons never enter the train's 4.5 m corridor, including another pass.
        if ([0,.25,.5,.75,1].some(t => !clearOfTrack(base.clone().lerp(top,t), .6, 4.5))) continue;
        posts.push(beamMatrix(base, top, .18));
        feet.push(boxMatrix(base, vec(1.15, .3, 1.15), frame.quaternion));
        for (let lamp = 0; lamp < 3; lamp++) {
          const p = top.clone().addScaledVector(frame.up, -.65 - lamp * .74);
          lamps.push({ matrix: boxMatrix(p, vec(1, 1, 1)), color: new THREE.Color(0x5be5ff), band: lamp, group: i });
        }
      }
    }
    instance(cylinder, postMaterial, posts, 'Comet launch pylons');
    instance(box, footMaterial, feet, 'Comet launch pylon feet');
    instance(box, stripMaterial, strips, 'Comet launch strips');
    const lights = instance(sphere, lampMaterial, lamps, 'Comet countdown lights');
    const tint = new THREE.Color();
    let lastTick = -1;
    animated.push(time => {
      const tick = Math.floor(time * 6);
      if (!lights || tick === lastTick) return;
      lastTick = tick;
      lamps.forEach((lamp, i) => {
        const phase = ((tick - lamp.group) % 9 + 9) % 9;
        const lit = phase >= lamp.band * 2;
        tint.set(lamp.band === 2 ? 0xffd17a : 0x6eeaff).multiplyScalar(lit ? 1 : .2);
        lights.setColorAt(i, tint);
      });
      lights.instanceColor.needsUpdate = true;
    });
    record({ kind: 'launch-lights', start: launch.start, end: launch.end, pylons: posts.length });
  }

  function buildTidal() {
    // These basins sit in the existing central lagoon. A whole spray arc must
    // clear every track pass before it is admitted, including the lower helix.
    const candidates = [[34,-36],[21,-30],[47,-43],[23,-46],[47,-28],[34,-48],[35,-23]];
    const accepted = [];
    for (const [x, z] of candidates) {
      if (accepted.length >= 4 || accepted.some(p => Math.hypot(p.x-x, p.z-z) < 9)) continue;
      const base = vec(x, -.2, z);
      let safe = true;
      for (let a = 0; a < 8 && safe; a++) for (let j = 0; j <= 16; j++) {
        const t = j / 16, angle = a / 8 * Math.PI * 2;
        const p = base.clone().add(vec(Math.cos(angle) * 4.6 * t, Math.sin(Math.PI * t) * 8.1, Math.sin(angle) * 4.6 * t));
        if (!clearOfTrack(p, .6, 4.5)) { safe = false; break; }
      }
      if (safe) accepted.push(base);
    }
    if (!accepted.length) return;
    const basinMaterial = standard({ color: 0xb8e1d9, metalness: .2, roughness: .4 });
    const ringGeometry = ownGeometry(new THREE.TorusGeometry(1.55, .13, 6, 28));
    const rings = accepted.map(base => {
      const q = new THREE.Quaternion().setFromAxisAngle(vec(1,0,0), Math.PI / 2);
      return boxMatrix(base.clone().add(vec(0, .08, 0)), vec(1,1,1), q);
    });
    instance(ringGeometry, basinMaterial, rings, 'Lagoon fountain basins');
    const bases = [], directions = [], phases = [];
    accepted.forEach((base, index) => {
      for (let arm = 0; arm < 8; arm++) for (let drop = 0; drop < 18; drop++) {
        const angle = arm / 8 * Math.PI * 2;
        bases.push(base.x, base.y, base.z);
        directions.push(Math.cos(angle), 0, Math.sin(angle));
        phases.push((drop / 18 + index * .173) % 1);
      }
    });
    const geometry = ownGeometry(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(bases, 3));
    geometry.setAttribute('sprayDirection', new THREE.Float32BufferAttribute(directions, 3));
    geometry.setAttribute('phase', new THREE.Float32BufferAttribute(phases, 1));
    geometry.boundingSphere = new THREE.Sphere(vec(34, 4, -36), 35);
    const material = shader({
      transparent: true, depthWrite: false, uniforms: { time: { value: 0 } },
      vertexShader: `attribute vec3 sprayDirection; attribute float phase; uniform float time; varying float opacity;
        void main(){float t=fract(phase+time*.29);vec3 p=position+sprayDirection*(4.6*t);p.y+=sin(t*3.14159265)*8.1;
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp(3.8*170./max(1.,-mv.z),1.1,7.5);opacity=sin(t*3.14159265)*.58+.22;}`,
      fragmentShader: `varying float opacity;void main(){float r=length(gl_PointCoord-.5);if(r>.5)discard;
        gl_FragColor=vec4(.73,.98,1.,opacity*(1.-smoothstep(.25,.5,r)));}`
    });
    const spray = new THREE.Points(geometry, material);spray.name='Lagoon fountain spray';root.add(spray);
    animated.push(time => { material.uniforms.time.value = time; });
    record({ kind:'lagoon-fountains', count:accepted.length, particles:phases.length });
  }

  function buildCanyon() {
    const tunnels = range('tunnel');
    const rockMaterial = standard({ vertexColors:true, color:0xffffff, roughness:1 });
    const shellMaterial = standard({ color:0xa97550, roughness:1, vertexColors:true, side:THREE.DoubleSide });
    const rimMaterial = standard({ color:0xdba46b, roughness:.82 });
    const lightMaterial = basic({ color:0xffc982 });
    const rocks = [], portalEntries = [], lamps = [];
    const radius = 11.8, centerHeight = 1.5;
    const angleStart = -Math.PI / 10, angleSpan = Math.PI * 1.2;
    const ringGeometry = ownGeometry(new THREE.TorusGeometry(radius, .32, 6, 40, angleSpan));
    ringGeometry.rotateZ(angleStart);
    const bulb = ownGeometry(new THREE.SphereGeometry(.16, 7, 5));
    for (const tunnel of tunnels) {
      // Pull the shell back from both ends so the entrance remains open and bright.
      const start = tunnel.start + 2, end = tunnel.end - 2;
      if (end - start < 12) continue;
      const slices = Math.max(9, Math.ceil((end-start)/2.8)), sides = 24;
      const positions = [], colors = [], indices = [];
      for (let i=0;i<=slices;i++) {
        const frame=track.getFrame(start+(end-start)*i/slices);
        const center=frame.position.clone().addScaledVector(frame.up,centerHeight);
        for(let j=0;j<=sides;j++) {
          const a=angleStart+angleSpan*j/sides;
          const r=radius+.22*Math.sin(i*1.9+j*2.7);
          const p=center.clone().addScaledVector(frame.right,Math.cos(a)*r).addScaledVector(frame.up,Math.sin(a)*r);
          positions.push(p.x,p.y,p.z);
          const shade=.86+.14*Math.sin(i*.7+j*.83)**2;
          colors.push(shade,shade,shade);
          if(i<slices&&j<sides){const k=i*(sides+1)+j;indices.push(k,k+sides+1,k+1,k+1,k+sides+1,k+sides+2);}
        }
      }
      const geometry=ownGeometry(new THREE.BufferGeometry());
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);
      geometry.computeVertexNormals();geometry.computeBoundingSphere();
      const shell=addMesh(geometry,shellMaterial);shell.name='Open canyon tunnel';shell.castShadow=true;shell.receiveShadow=true;
      for(const d of [start,end]){const f=track.getFrame(d);portalEntries.push(boxMatrix(f.position.clone().addScaledVector(f.up,centerHeight),vec(1,1,1),f.quaternion));}
      for(let d=start+4;d<end-2;d+=9){const f=track.getFrame(d);for(const side of [-1,1])lamps.push(boxMatrix(f.position.clone().addScaledVector(f.right,side*10.5).addScaledVector(f.up,4.2),vec(1,1,1)));}
      record({kind:'tunnel',start,end,innerRadius:radius-.22,centerHeight});
    }
    instance(ringGeometry,rimMaterial,portalEntries,'Canyon tunnel portals');
    instance(bulb,lightMaterial,lamps,'Warm tunnel marker lights');
    // Sandstone outcrops flank only low portions of this particular route.
    for(let d=track.length*.19;d<track.length*.91;d+=8.3) {
      const f=track.getFrame(d);
      if(f.position.y>26)continue;
      const horizontal=vec(f.right.x,0,f.right.z).normalize();
      for(const side of [-1,1]) {
        const height=7+random()*6,scale=vec(3.7+random()*2,height*.5,4+random()*2);
        const p=f.position.clone().addScaledVector(horizontal,side*(14+random()*3));p.y=height*.36;
        if(Math.hypot(p.x,p.z)>140||!clearOfTrack(p,Math.max(scale.x,scale.y,scale.z),4.9))continue;
        rocks.push({position:p,scale,yaw:random()*Math.PI*2,color:new THREE.Color().setHSL(.065+random()*.035,.33+random()*.16,.42+random()*.13)});
      }
    }
    rockBatch(rocks,rockMaterial);
    record({kind:'canyon-outcrops',count:rocks.length});
  }

  function buildStarlight() {
    const positions=[],colors=[],phases=[];
    for(let i=0;i<620;i++) {
      const angle=random()*Math.PI*2,height=.12+random()*.86,radius=580+random()*90;
      const horizontal=Math.sqrt(1-height*height);
      positions.push(Math.cos(angle)*horizontal*radius,height*radius,Math.sin(angle)*horizontal*radius);
      const color=new THREE.Color(i%5===0?0xffd7ad:0xc6e1ff);colors.push(color.r,color.g,color.b);phases.push(random()*Math.PI*2);
    }
    const starGeometry=ownGeometry(new THREE.BufferGeometry());
    starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    starGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    starGeometry.setAttribute('phase',new THREE.Float32BufferAttribute(phases,1));starGeometry.computeBoundingSphere();
    const starMaterial=shader({
      transparent:true,depthWrite:false,vertexColors:true,uniforms:{time:{value:0}},
      vertexShader:`attribute float phase;uniform float time;varying vec3 tint;varying float strength;
        void main(){tint=color;strength=.67+.2*sin(time*.6+phase);vec4 mv=modelViewMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*mv;gl_PointSize=1.9+.8*sin(phase)*sin(phase);}`,
      fragmentShader:`varying vec3 tint;varying float strength;void main(){float r=length(gl_PointCoord-.5);if(r>.5)discard;
        gl_FragColor=vec4(tint,strength*(1.-smoothstep(.12,.5,r)));}`
    });
    const stars=new THREE.Points(starGeometry,starMaterial);stars.name='Starlight sky';root.add(stars);
    const archMaterial=basic({color:0x83e5ef});
    const archGeometry=ownGeometry(new THREE.TorusGeometry(11.5,.12,6,36,Math.PI));
    const arches=[];const zone=range('starlight')[0]||{start:track.length*.3,end:track.length*.8};
    const count=Math.min(9,Math.max(3,Math.floor((zone.end-zone.start)/42)));
    for(let i=0;i<count;i++){
      const f=track.getFrame(zone.start+(zone.end-zone.start)*(i+.5)/count);
      arches.push(boxMatrix(f.position.clone().addScaledVector(f.up,1.0),vec(1,1,1),f.quaternion));
    }
    instance(archGeometry,archMaterial,arches,'Luminous sky arches');
    const lightMaterial=basic({color:0xffd18b});
    const lightGeometry=ownGeometry(new THREE.SphereGeometry(.105,5,4));
    const lights=[];
    for(let d=0;d<track.length;d+=5.2){const f=track.getFrame(d);for(const side of [-1,1])lights.push(boxMatrix(f.position.clone().addScaledVector(f.right,side*2.8).addScaledVector(f.up,.24),vec(1,1,1)));}
    instance(lightGeometry,lightMaterial,lights,'Starlight track lanterns');

    const flyPositions=[],flyPhases=[];
    for(let i=0;i<115;i++){
      const f=track.getFrame(track.length*(.12+random()*.78)),side=i%2?1:-1;
      const p=f.position.clone().addScaledVector(f.right,side*(6+random()*10)).addScaledVector(f.up,random()*3+1);
      if(!clearOfTrack(p,1,3.5))continue;
      flyPositions.push(p.x,p.y,p.z);flyPhases.push(random()*Math.PI*2);
    }
    const flyGeometry=ownGeometry(new THREE.BufferGeometry());
    flyGeometry.setAttribute('position',new THREE.Float32BufferAttribute(flyPositions,3));
    flyGeometry.setAttribute('phase',new THREE.Float32BufferAttribute(flyPhases,1));flyGeometry.computeBoundingSphere();
    const flyMaterial=shader({
      transparent:true,depthWrite:false,uniforms:{time:{value:0}},
      vertexShader:`attribute float phase;uniform float time;varying float strength;void main(){vec3 p=position;
        p.y+=sin(time*.45+phase)*.65;p.x+=cos(time*.24+phase)*.4;float pulse=sin(time*.55+phase);strength=.28+.38*pulse*pulse;
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(250./max(1.,-mv.z),1.3,5.);}`,
      fragmentShader:`varying float strength;void main(){float r=length(gl_PointCoord-.5);if(r>.5)discard;
        gl_FragColor=vec4(.91,1.,.64,strength*(1.-smoothstep(.1,.5,r)));}`
    });
    const fireflies=new THREE.Points(flyGeometry,flyMaterial);fireflies.name='Sparse floating fireflies';root.add(fireflies);
    animated.push(time=>{starMaterial.uniforms.time.value=time;flyMaterial.uniforms.time.value=time;stars.rotation.y=time*.0008;});
    record({kind:'night-sky',stars:620,arches:arches.length,lanterns:lights.length,fireflies:flyPhases.length});
  }

  if(track.ride.id==='comet')buildComet();
  if(track.ride.id==='tidal')buildTidal();
  if(track.ride.id==='canyon')buildCanyon();
  if(track.ride.id==='starlight')buildStarlight();

  return {
    root,
    update(time, dt) { if(!disposed)for(const update of animated)update(time,dt); },
    dispose() {
      if(disposed)return;
      disposed=true;root.removeFromParent();
      root.traverse(object=>{if(object.isInstancedMesh)object.dispose();});
      for(const geometry of geometries)geometry.dispose();
      for(const material of materials)material.dispose();
      root.clear();animated.length=0;
    }
  };
}
