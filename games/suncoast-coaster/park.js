import * as THREE from './vendor/three.module.js';

// Suncoast is deliberately asset-free. Repeated props are baked into a few
// vertex-colour meshes, while trees use instancing so the park stays light.
export function createPark(scene, { trackSamples = [] } = {}) {
  const root = new THREE.Group();
  root.name = 'Suncoast island';
  scene.add(root);
  const animated = [];
  const owned = new Set();
  const palette = {
    cream: 0xffedcd, white: 0xfff7e6, sand: 0xe8ce9d, path: 0xeedfc0,
    coral: 0xe96d4c, peach: 0xf6b282, teal: 0x337d76, dark: 0x245955,
    mustard: 0xeab54f, blue: 0xa9d9d7, wood: 0xac7b50, green: 0x729d65,
  };
  let seed = 23721;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  const rand = (a, b) => a + (b - a) * random();
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const axisY = v3(0, 1, 0);
  const identity = new THREE.Quaternion();
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  const normalMatrix = new THREE.Matrix3();
  const point = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const materials = [];
  const material = (options) => { const m = new THREE.MeshStandardMaterial(options); materials.push(m); return m; };
  const solidMaterial = material({ vertexColors: true, roughness: 0.88, metalness: 0.02 });
  const lightMaterial = material({ vertexColors: true, roughness: 0.6, emissive: 0xffd38d, emissiveIntensity: 0.14 });
  const prim = {
    box: new THREE.BoxGeometry(1, 1, 1).toNonIndexed(),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 10).toNonIndexed(),
    cone: new THREE.ConeGeometry(1, 1, 10).toNonIndexed(),
    sphere: new THREE.IcosahedronGeometry(1, 1),
    rock: new THREE.IcosahedronGeometry(1, 0),
    roof: new THREE.ConeGeometry(1, 1, 4).toNonIndexed(),
  };
  for (const g of Object.values(prim)) owned.add(g);

  class Batch {
    constructor() { this.positions = []; this.normals = []; this.colors = []; }
    add(geometry, tint, pos = v3(0, 0, 0), scale = v3(1, 1, 1), quaternion = identity) {
      matrix.compose(pos, quaternion, scale);
      normalMatrix.getNormalMatrix(matrix);
      const g = geometry.index ? geometry.toNonIndexed() : geometry;
      const ps = g.attributes.position;
      const ns = g.attributes.normal;
      color.set(tint);
      for (let i = 0; i < ps.count; i++) {
        point.fromBufferAttribute(ps, i).applyMatrix4(matrix);
        normal.fromBufferAttribute(ns, i).applyNormalMatrix(normalMatrix);
        this.positions.push(point.x, point.y, point.z);
        this.normals.push(normal.x, normal.y, normal.z);
        this.colors.push(color.r, color.g, color.b);
      }
      if (g !== geometry) g.dispose();
    }
    box(x, y, z, sx, sy, sz, tint, yaw = 0) {
      this.add(prim.box, tint, v3(x, y, z), v3(sx, sy, sz), new THREE.Quaternion().setFromAxisAngle(axisY, yaw));
    }
    cylinder(x, y, z, radius, height, tint) { this.add(prim.cyl, tint, v3(x, y, z), v3(radius, height, radius)); }
    sphere(x, y, z, sx, sy, sz, tint) { this.add(prim.sphere, tint, v3(x, y, z), v3(sx, sy, sz)); }
    beam(a, b, radius, tint) {
      const d = b.clone().sub(a);
      this.add(prim.cyl, tint, a.clone().add(b).multiplyScalar(0.5), v3(radius, d.length(), radius), new THREE.Quaternion().setFromUnitVectors(axisY, d.normalize()));
    }
    bake(parent = root, mat = solidMaterial, shadow = true) {
      if (!this.positions.length) return null;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      parent.add(mesh);
      owned.add(geometry);
      this.positions = this.normals = this.colors = null;
      return mesh;
    }
  }
  const ground = new Batch();
  const props = new Batch();
  const glowing = new Batch();
  const features = [];
  const lake = { x: 34, z: -36, rx: 29, rz: 22 };
  const samples = trackSamples.map(p => p.position || p.p || p).filter(p => Number.isFinite(p.x) && Number.isFinite(p.z));
  const nearTrack = (x, z, clearance = 6, height = 12) => samples.some(p => p.y < height + 5 && Math.hypot(p.x - x, p.z - z) < clearance);
  const inLake = (x, z, margin = 0) => ((x - lake.x) / (lake.rx + margin)) ** 2 + ((z - lake.z) / (lake.rz + margin)) ** 2 < 1;
  const shore = a => 149 + Math.sin(a * 3 + 0.7) * 6 + Math.sin(a * 5 - 0.3) * 4 + Math.cos(a * 7) * 2;
  const onPath = (x, z, margin = 0) => (Math.abs(x + 108) < 6 + margin && z > -108 && z < 100)
    || (Math.abs(z - 94) < 7 + margin && x > -116 && x < 53)
    || (Math.abs(z - 65) < 5 + margin && x > -113 && x < -60)
    || (Math.hypot(x + 108, z - 12) < 25 + margin)
    || (Math.hypot(x + 95, z + 55) < 18 + margin)
    || (Math.hypot(x + 18, z - 94) < 17 + margin);

  // A true hole in the grassy terrain exposes the lagoon below the coaster.
  const islandShape = new THREE.Shape();
  for (let i = 0; i <= 180; i++) {
    const a = i / 180 * Math.PI * 2;
    const r = shore(a);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!i) islandShape.moveTo(x, -z); else islandShape.lineTo(x, -z);
  }
  const hole = new THREE.Path();
  hole.absellipse(lake.x, -lake.z, lake.rx, lake.rz, 0, Math.PI * 2, true);
  islandShape.holes.push(hole);
  const landGeometry = new THREE.ShapeGeometry(islandShape, 100);
  landGeometry.rotateX(-Math.PI / 2);
  ground.add(landGeometry, 0xa5b77e, v3(0, 0.035, 0));
  landGeometry.dispose();

  function ribbon(pointsA, pointsB, tint, batch = ground) {
    const positions = [], colors = [];
    const c = new THREE.Color(tint);
    for (let i = 0; i < pointsA.length - 1; i++) {
      const a = pointsA[i], b = pointsA[i + 1], c1 = pointsB[i], d = pointsB[i + 1];
      for (const p of [a, b, c1, b, d, c1]) { positions.push(p.x, p.y, p.z); colors.push(c.r, c.g, c.b); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    batch.add(g, tint);
    g.dispose();
  }
  const innerShore = [], outerShore = [], bottomShore = [];
  for (let i = 0; i <= 180; i++) {
    const a = i / 180 * Math.PI * 2, r = shore(a);
    innerShore.push(v3(Math.cos(a) * r, 0.025, Math.sin(a) * r));
    outerShore.push(v3(Math.cos(a) * (r + 15), -2.1, Math.sin(a) * (r + 15)));
    bottomShore.push(v3(Math.cos(a) * (r + 16), -8, Math.sin(a) * (r + 16)));
  }
  ribbon(innerShore, outerShore, 0xe7cf9f);
  ribbon(outerShore, bottomShore, 0xc7b48c);
  const lakeOuter = [], lakeInner = [];
  for (let i = 0; i <= 100; i++) {
    const a = i / 100 * Math.PI * 2;
    lakeOuter.push(v3(lake.x + Math.cos(a) * lake.rx, 0.04, lake.z + Math.sin(a) * lake.rz));
    lakeInner.push(v3(lake.x + Math.cos(a) * (lake.rx - 2.7), -0.65, lake.z + Math.sin(a) * (lake.rz - 2.7)));
  }
  ribbon(lakeInner, lakeOuter, 0xe8d7b6);

  const waterUniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    { time: { value: 0 }, waveScale: { value: 1 }, waterColor: { value: new THREE.Color(0x51b6b7) }, lightColor: { value: new THREE.Color(0xb0e2d5) } },
  ]);
  const waterMaterial = new THREE.ShaderMaterial({
    uniforms: waterUniforms, fog: true,
    vertexShader: `
      uniform float time;
      uniform float waveScale;
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() {
        vec3 p = position;
        p.y += waveScale * (sin(p.x * .055 + time * .46) * .16 + sin(p.z * .087 - time * .32) * .13);
        vec4 world = modelMatrix * vec4(p,1.0);
        vWorld = world.xyz;
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float time;
      uniform vec3 waterColor;
      uniform vec3 lightColor;
      varying vec3 vWorld;
      #include <fog_pars_fragment>
      void main() {
        float a = sin(vWorld.x * .23 + vWorld.z * .14 + time * .55);
        float b = sin(vWorld.z * .38 - vWorld.x * .09 - time * .4);
        float ripples = smoothstep(.79, 1.0, a * b) * .15;
        float broad = sin(vWorld.x * .019 + vWorld.z * .025) * .055;
        vec3 n = normalize(vec3(-.06*cos(vWorld.x*.23 + time*.55),1.0,-.05*cos(vWorld.z*.38-time*.4)));
        vec3 viewDir = normalize(cameraPosition-vWorld);
        float fresnel = pow(1.0-max(dot(n,viewDir),0.0),3.0);
        vec3 col = mix(waterColor,lightColor,clamp(.12+broad+ripples+fresnel*.42,0.0,1.0));
        float glitter = pow(max(dot(reflect(-normalize(vec3(-.5,1.0,.3)),n),viewDir),0.0),96.0);
        gl_FragColor = vec4(col + vec3(1.0,.91,.69)*glitter*.26,1.0);
        #include <fog_fragment>
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  materials.push(waterMaterial);
  const oceanGeometry = new THREE.PlaneGeometry(2200, 2200, 75, 75);
  oceanGeometry.rotateX(-Math.PI / 2);
  owned.add(oceanGeometry);
  const ocean = new THREE.Mesh(oceanGeometry, waterMaterial);
  ocean.position.y = -2.15;
  ocean.name = 'Turquoise sea';
  root.add(ocean);
  const lagoonMaterial = waterMaterial.clone();
  lagoonMaterial.uniforms.waveScale.value = 0.18;
  lagoonMaterial.uniforms.waterColor.value.set(0x64bbb4);
  materials.push(lagoonMaterial);
  const lagoonGeometry = new THREE.CircleGeometry(1, 64);
  lagoonGeometry.rotateX(-Math.PI / 2);
  owned.add(lagoonGeometry);
  const lagoon = new THREE.Mesh(lagoonGeometry, lagoonMaterial);
  lagoon.position.set(lake.x, -0.35, lake.z);
  lagoon.scale.set(lake.rx, 1, lake.rz);
  root.add(lagoon);

  // Broad promenades and rounded plazas give the rides a coherent park layout.
  ground.box(-108, 0.075, -4, 8.5, 0.1, 206, palette.path);
  ground.box(-29, 0.085, 94, 164, 0.12, 11, palette.path);
  ground.box(-85, 0.07, 65, 48, 0.1, 6.5, palette.path);
  ground.cylinder(-108, 0.075, 12, 24, 0.13, palette.path);
  ground.cylinder(-95, 0.075, -55, 17.5, 0.13, palette.path);
  ground.cylinder(-18, 0.08, 94, 17, 0.15, palette.path);
  // Fine path borders, pavement joints and narrow timber boardwalk strips.
  for (const x of [-112.6, -103.4]) ground.box(x, 0.13, -4, 0.25, 0.1, 206, palette.cream);
  for (const z of [88.3, 99.7]) ground.box(-29, 0.14, z, 164, 0.1, 0.25, palette.cream);
  for (let z = -104; z < 98; z += 5) ground.box(-108, 0.145, z, 8.5, 0.018, 0.045, 0xd9c7a9);
  for (let x = -110; x < 52; x += 5) ground.box(x, 0.16, 94, 0.045, 0.018, 11, 0xd9c7a9);

  const signs = [];
  function sign(text, x, y, z, width, height, tint = palette.dark, yaw = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = 768; canvas.height = 192;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff1d4'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#d6b881'; ctx.lineWidth = 7; ctx.strokeRect(8, 8, 752, 176);
    ctx.fillStyle = '#' + new THREE.Color(tint).getHexString();
    ctx.font = '700 78px Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 384, 102, 710);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 });
    materials.push(mat); owned.add(texture);
    const geometry = new THREE.PlaneGeometry(width, height); owned.add(geometry);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z); mesh.rotation.y = yaw;
    root.add(mesh); signs.push(mesh);
  }

  function building(x, z, w, d, h, tint, title) {
    features.push({ x, z, radius: Math.max(w, d) * 0.8 + 4 });
    props.box(x, h / 2 + 0.2, z, w, h, d, tint);
    props.box(x, 0.35, z, w + 0.4, 0.6, d + 0.4, palette.cream);
    props.box(x, h + 0.2, z, w + 1.2, 0.45, d + 1.2, palette.cream);
    props.box(x, h + 0.55, z, w + 0.75, 0.35, d + 0.75, palette.teal);
    props.box(x, h + 1.4, z, w * 0.9, 1.35, d * 0.85, tint);
    props.box(x, h + 2.1, z, w + 0.5, 0.2, d + 0.5, palette.cream);
    const front = z + d / 2 + 0.035;
    const count = Math.max(2, Math.round(w / 3));
    for (let i = 0; i < count; i++) {
      const wx = x + (i - (count - 1) / 2) * (w / count);
      props.box(wx, h * 0.43, front, w / count - 0.45, h * 0.56, 0.1, palette.cream);
      props.box(wx, h * 0.43, front + 0.06, w / count - 0.75, h * 0.46, 0.08, palette.dark);
      props.box(wx + 0.15, h * 0.48, front + 0.11, w / count - 1.1, h * 0.29, 0.03, palette.blue);
      props.box(wx, h * 0.41, front + 0.15, 0.12, h * 0.47, 0.04, palette.cream);
    }
    // A real striped awning with a scalloped-looking lower valance.
    const awningQ = new THREE.Quaternion().setFromAxisAngle(v3(1, 0, 0), 0.13);
    const strips = Math.round(w / 0.72);
    for (let j = 0; j < strips; j++) {
      const ax = x - w / 2 + (j + 0.5) * w / strips;
      const stripe = j % 2 ? palette.cream : (tint === palette.peach ? palette.coral : palette.teal);
      props.add(prim.box, stripe, v3(ax, h * 0.81, front + 1.2), v3(w / strips + 0.008, 0.12, 2.5), awningQ);
      props.box(ax, h * 0.81 - 0.42, front + 2.4, w / strips, 0.45, 0.13, stripe);
    }
    props.cylinder(x - w / 2 + 0.2, h * 0.4, front + 2.25, 0.09, h * 0.8, palette.cream);
    props.cylinder(x + w / 2 - 0.2, h * 0.4, front + 2.25, 0.09, h * 0.8, palette.cream);
    if (title) sign(title, x, h + 1.35, front + 0.12, w * 0.82, 1.1, palette.dark);
  }
  building(-128, 54, 13, 9, 5.7, palette.peach, 'SCOOPS');
  building(-129, -19, 11, 8, 5.3, palette.mustard, 'ARCADE');
  building(-91, -104, 15, 9, 6.5, palette.coral, 'COASTAL BITES');
  building(30, 111, 12, 8, 4.8, palette.teal, 'SURF SHOP');
  building(-77, 109, 8, 6, 4.3, palette.peach, 'TICKETS');

  // Entrance towers, flags and a welcoming overhead sign.
  for (const x of [-59, -37]) {
    props.box(x, 3.7, 111, 2.9, 7.4, 2.8, palette.teal);
    props.box(x, 0.4, 111, 3.5, 0.8, 3.4, palette.cream);
    props.box(x, 7.5, 111, 3.8, 0.4, 3.8, palette.cream);
    props.add(prim.cone, palette.coral, v3(x, 8.8, 111), v3(2.4, 2.4, 2.4));
    props.cylinder(x, 10.7, 111, 0.07, 2, palette.cream);
    props.box(x + 0.7, 11.2, 111, 1.4, 0.7, 0.06, palette.mustard);
  }
  props.box(-48, 6.9, 111, 20.5, 2.4, 0.65, palette.teal);
  sign('SUNCOAST', -48, 6.95, 111.34, 16.8, 1.9);
  features.push({ x: -48, z: 111, radius: 14 });

  // Ferris wheel: both rims and spokes move; hanging cabins counter-rotate.
  const wheelCenter = v3(-108, 22, 12), wheelRadius = 18;
  features.push({ x: -108, z: 12, radius: 25 });
  for (const xoff of [-7.7, 7.7]) for (const zoff of [-5, 5]) {
    props.beam(v3(-108 + xoff, 0.6, 12 + zoff), wheelCenter.clone().add(v3(0, 0, zoff * 0.18)), 0.47, palette.cream);
    props.box(-108 + xoff, 0.35, 12 + zoff, 2.2, 0.65, 2.2, palette.teal);
  }
  props.beam(v3(-108, 22, 8.5), v3(-108, 22, 15.5), 0.65, palette.teal);
  const wheel = new THREE.Group(); wheel.position.copy(wheelCenter); root.add(wheel);
  const wheelBatch = new Batch();
  for (const z of [-1.1, 1.1]) {
    const rim = new THREE.TorusGeometry(wheelRadius, 0.23, 6, 80);
    wheelBatch.add(rim, palette.cream, v3(0, 0, z)); rim.dispose();
    const innerRim = new THREE.TorusGeometry(wheelRadius - 1.2, 0.12, 5, 80);
    wheelBatch.add(innerRim, palette.coral, v3(0, 0, z)); innerRim.dispose();
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2;
      wheelBatch.beam(v3(0, 0, z), v3(Math.cos(a) * wheelRadius, Math.sin(a) * wheelRadius, z), 0.085, palette.cream);
    }
  }
  wheelBatch.sphere(0, 0, 1.6, 1.6, 1.6, 0.5, palette.mustard);
  wheelBatch.sphere(0, 0, -1.6, 1.6, 1.6, 0.5, palette.mustard);
  const cabins = [];
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    const x = Math.cos(a) * wheelRadius, y = Math.sin(a) * wheelRadius;
    wheelBatch.beam(v3(x, y, -1.3), v3(x, y, 1.3), 0.09, palette.teal);
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0); wheel.add(pivot);
    const cabin = new Batch(), tint = [palette.coral, palette.teal, palette.mustard, palette.peach][i % 4];
    cabin.beam(v3(0, 0, 0), v3(0, -0.6, 0), 0.095, palette.cream);
    cabin.box(0, -0.7, 0, 2.6, 0.3, 2.3, palette.cream);
    cabin.box(0, -3.05, 0, 2.35, 0.38, 2.1, tint);
    cabin.box(0, -2.65, 0, 2.25, 0.5, 2.0, tint);
    cabin.box(0, -1.7, -0.98, 2.15, 1.45, 0.09, palette.blue);
    for (const cx of [-1.02, 1.02]) for (const cz of [-0.9, 0.9]) cabin.box(cx, -1.78, cz, 0.12, 2.15, 0.12, palette.cream);
    cabin.box(0, -2.17, 1.02, 2.13, 0.16, 0.12, palette.cream);
    cabin.bake(pivot, solidMaterial, false);
    cabins.push(pivot);
  }
  wheelBatch.bake(wheel, solidMaterial, false);
  animated.push(time => {
    const angle = time * 0.065;
    wheel.rotation.z = angle;
    for (const cabin of cabins) cabin.rotation.z = -angle;
  });
  sign('THE SUNNY WHEEL', -108, 4, 20, 13, 1.8);

  // An old-fashioned carousel, with alternating canopy panels and bobbing horses.
  features.push({ x: -95, z: -55, radius: 18 });
  const carousel = new THREE.Group(); carousel.position.set(-95, 0.3, -55); root.add(carousel);
  const carouselBatch = new Batch();
  carouselBatch.cylinder(0, 0.35, 0, 10.4, 0.7, palette.coral);
  carouselBatch.cylinder(0, 0.8, 0, 9.9, 0.3, palette.cream);
  carouselBatch.cylinder(0, 4.4, 0, 1.4, 7.2, palette.mustard);
  carouselBatch.cylinder(0, 7.9, 0, 10.2, 0.65, palette.cream);
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    const g = new THREE.BufferGeometry();
    const a2 = a + Math.PI * 2 / 16;
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 12, 0,
      Math.sin(a) * 10.8, 8.2, Math.cos(a) * 10.8,
      Math.sin(a2) * 10.8, 8.2, Math.cos(a2) * 10.8,
    ], 3));
    g.computeVertexNormals();
    carouselBatch.add(g, i % 2 ? palette.cream : palette.coral); g.dispose();
    const x = Math.cos(a) * 9.8, z = Math.sin(a) * 9.8;
    carouselBatch.sphere(x, 7.8, z, 0.26, 0.26, 0.26, palette.mustard);
    if (!(i % 2)) carouselBatch.cylinder(x, 4.35, z, 0.105, 7.15, palette.cream);
  }
  carouselBatch.cylinder(0, 12.8, 0, 0.075, 1.8, palette.cream);
  carouselBatch.box(0.65, 13.1, 0, 1.3, 0.65, 0.06, palette.mustard);
  carouselBatch.bake(carousel, solidMaterial, false);
  const horseGroup = new THREE.Group(); horseGroup.position.set(-95, 0.3, -55); root.add(horseGroup);
  const horses = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const horse = new THREE.Group();
    horse.position.set(Math.cos(a) * 6.9, 2.25, Math.sin(a) * 6.9); horse.rotation.y = -a;
    const b = new Batch(), tint = i % 2 ? palette.cream : palette.peach;
    b.sphere(0, 0, 0, 0.65, 0.65, 1.35, tint);
    b.sphere(0, 0.75, 0.92, 0.45, 0.9, 0.48, tint);
    b.sphere(0, 1.35, 1.28, 0.42, 0.4, 0.7, tint);
    b.box(0, 0.62, -0.15, 1.13, 0.15, 0.9, palette.teal);
    for (const side of [-0.38, 0.38]) for (const forward of [-0.8, 0.8]) b.beam(v3(side, -0.25, forward), v3(side, -1.1, forward + 0.25), 0.13, tint);
    b.beam(v3(0, 0.22, -1.0), v3(0, -0.3, -1.8), 0.15, palette.wood);
    b.cylinder(0, 1.5, 0, 0.065, 5.7, palette.mustard);
    b.bake(horse, solidMaterial, false);
    horseGroup.add(horse); horses.push(horse);
  }
  animated.push(time => {
    horseGroup.rotation.y = time * 0.13;
    horses.forEach((h, i) => h.position.y = 2.25 + Math.sin(time * 1.1 + i * 1.6) * 0.36);
  });

  // Fountain and seating on the open seaside promenade.
  features.push({ x: -18, z: 94, radius: 12 });
  props.cylinder(-18, 0.45, 94, 7, 0.8, palette.cream);
  props.cylinder(-18, 0.88, 94, 6.4, 0.16, 0x78bdb7);
  props.cylinder(-18, 1.4, 94, 1.2, 1.2, palette.cream);
  props.cylinder(-18, 2.15, 94, 3.1, 0.3, palette.cream);
  props.cylinder(-18, 2.36, 94, 2.8, 0.14, 0x8accc2);
  props.sphere(-18, 3.15, 94, 0.65, 0.95, 0.65, palette.mustard);
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2;
    const pts = [];
    for (let j = 0; j <= 12; j++) {
      const t = j / 12, r = 0.8 + t * 4.7;
      pts.push(v3(-18 + Math.cos(a) * r, 2.5 + Math.sin(t * Math.PI) * 1.6 - t * 1.4, 94 + Math.sin(a) * r));
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.045, 4, false);
    glowing.add(tube, 0xd3f6e3); tube.dispose();
  }

  function bench(x, z, yaw = 0) {
    // Baked coordinates avoid a new scene object for each seat.
    const local = (lx, ly, lz) => v3(x + lx * Math.cos(yaw) + lz * Math.sin(yaw), ly, z - lx * Math.sin(yaw) + lz * Math.cos(yaw));
    for (const y of [0.8, 1.05]) for (let s = 0; s < 3; s++) {
      const p = local(0, y === 0.8 ? 0.85 : 1.35 + s * 0.24, y === 0.8 ? -0.4 + s * 0.4 : -0.52);
      props.box(p.x, p.y, p.z, 3.8, 0.16, y === 0.8 ? 0.33 : 0.12, palette.wood, yaw);
    }
    for (const lx of [-1.4, 1.4]) for (const lz of [-0.45, 0.45]) { const p = local(lx, 0.4, lz); props.box(p.x, p.y, p.z, 0.15, 0.8, 0.15, palette.dark, yaw); }
  }
  function lamp(x, z) {
    props.cylinder(x, 0.18, z, 0.45, 0.35, palette.cream);
    props.cylinder(x, 2.6, z, 0.1, 5.0, palette.dark);
    props.sphere(x, 5.25, z, 0.5, 0.63, 0.5, palette.cream);
    glowing.sphere(x, 5.24, z, 0.44, 0.56, 0.44, 0xffe7b2);
    props.add(prim.cone, palette.teal, v3(x, 5.9, z), v3(0.65, 0.35, 0.65));
  }
  for (let z = -90; z <= 90; z += 22) {
    lamp(-114.5, z);
    if (Math.abs(z - 12) > 25 && Math.abs(z + 55) > 18) bench(-101, z, -Math.PI / 2);
  }
  for (let x = -93; x <= 47; x += 20) {
    lamp(x, 101.8);
    if (Math.abs(x + 18) > 16) bench(x, 86, Math.PI);
  }

  function umbrella(x, z, tint, scale = 1) {
    props.cylinder(x, 1.7 * scale, z, 0.07 * scale, 3.4 * scale, palette.wood);
    const cone = new THREE.ConeGeometry(2.4, 0.8, 12, 1, true);
    props.add(cone, tint, v3(x, 3.25 * scale, z), v3(scale, scale, scale)); cone.dispose();
    props.sphere(x, 3.72 * scale, z, 0.14, 0.14, 0.14, palette.cream);
    props.cylinder(x, 1.1 * scale, z, 1.05 * scale, 0.14, palette.cream);
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2;
      const sx = x + Math.cos(a) * 1.8 * scale, sz = z + Math.sin(a) * 1.8 * scale;
      props.cylinder(sx, 0.58 * scale, sz, 0.5 * scale, 0.15, palette.cream);
      props.cylinder(sx, 0.28 * scale, sz, 0.13, 0.55 * scale, palette.teal);
    }
  }
  for (const [x, z, tint] of [[-123,71,palette.coral],[-136,70,palette.mustard],[-119,83,palette.teal],[-87,-90,palette.teal],[-73,-94,palette.mustard],[17,106,palette.coral],[45,103,palette.mustard]]) umbrella(x, z, tint);

  // Beach lounge chairs and umbrellas are visible from the big drop.
  for (let i = 0; i < 10; i++) {
    const a = -0.45 + i * 0.15, r = shore(a) + 5;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const y = -0.65;
    props.cylinder(x, y + 1.55, z, 0.07, 3.1, palette.wood);
    const c = new THREE.ConeGeometry(2.8, 1.1, 12, 1, true);
    props.add(c, i % 2 ? palette.coral : palette.cream, v3(x, y + 3, z)); c.dispose();
    for (const offset of [-1.5, 1.5]) {
      const sx = x + Math.cos(a + Math.PI / 2) * offset, sz = z + Math.sin(a + Math.PI / 2) * offset;
      props.box(sx, y + 0.4, sz, 1.05, 0.2, 2.8, palette.cream, -a + Math.PI / 2);
    }
  }

  // A small wooden lake jetty; transparent paths and rails stay below the ride.
  props.box(59, 0.35, -37, 12, 0.42, 3.5, palette.wood);
  for (let x = 54; x < 65; x += 1) props.box(x, 0.58, -37, 0.06, 0.025, 3.5, 0xe0ba83);
  for (const x of [54, 64]) for (const z of [-38.5, -35.5]) props.cylinder(x, 0.2, z, 0.18, 3.2, palette.wood);
  for (const x of [54, 64]) props.beam(v3(x, 1.65, -38.5), v3(x, 1.65, -35.5), 0.06, palette.cream);

  // Decorative planting: no tall tree can encroach on the low coaster corridor.
  const treePositions = [];
  for (let i = 0, attempts = 0; i < 265 && attempts < 5000; attempts++) {
    const x = rand(-145, 145), z = rand(-145, 145), r = Math.hypot(x, z);
    const a = Math.atan2(z, x), height = rand(5.5, 12);
    if (r > shore(a) - 7 || inLake(x, z, 4) || onPath(x, z, 5) || nearTrack(x, z, 7.3, height)) continue;
    if (Math.hypot(x + 60, z - 65) < 21 || features.some(f => Math.hypot(x - f.x, z - f.z) < f.radius + 4)) continue;
    // Retain open views across the central lagoon and coaster.
    if (r < 85 && random() < 0.62) continue;
    if (treePositions.some(p => Math.hypot(x - p.x, z - p.z) < 5)) continue;
    treePositions.push({ x, z, height, pine: random() < 0.72 }); i++;
  }
  const trunks = [], pineBottom = [], pineTop = [], broadleaf = [];
  const temp = new THREE.Object3D();
  for (const tree of treePositions) {
    const { x, z, height: h } = tree;
    temp.position.set(x, h * 0.28, z); temp.rotation.set(0, rand(0, Math.PI * 2), 0); temp.scale.set(0.2 + h * 0.012, h * 0.56, 0.2 + h * 0.012); temp.updateMatrix();
    trunks.push({ m: temp.matrix.clone(), c: new THREE.Color(0x8f7350) });
    if (tree.pine) {
      temp.position.set(x, h * 0.51, z); temp.scale.set(h * 0.31, h * 0.73, h * 0.31); temp.updateMatrix();
      pineBottom.push({ m: temp.matrix.clone(), c: new THREE.Color().setHSL(rand(0.28, 0.35), rand(0.21, 0.33), rand(0.27, 0.4)) });
      temp.position.set(x, h * 0.8, z); temp.scale.set(h * 0.22, h * 0.54, h * 0.22); temp.updateMatrix();
      pineTop.push({ m: temp.matrix.clone(), c: new THREE.Color().setHSL(rand(0.29, 0.35), 0.26, rand(0.36, 0.46)) });
    } else {
      for (let i = 0; i < 3; i++) {
        temp.position.set(x + rand(-1, 1), h * (0.61 + i * 0.085), z + rand(-1, 1));
        temp.scale.set(h * 0.27, h * 0.28, h * 0.26); temp.updateMatrix();
        broadleaf.push({ m: temp.matrix.clone(), c: new THREE.Color().setHSL(rand(0.23, 0.29), 0.3, rand(0.38, 0.48)) });
      }
    }
  }
  const treeMaterial = material({ roughness: 1 });
  function instances(geometry, entries) {
    const mesh = new THREE.InstancedMesh(geometry, treeMaterial, entries.length);
    entries.forEach((e, i) => { mesh.setMatrixAt(i, e.m); mesh.setColorAt(i, e.c); });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.computeBoundingSphere(); root.add(mesh);
  }
  instances(prim.cyl, trunks); instances(prim.cone, pineBottom); instances(prim.cone, pineTop); instances(prim.sphere, broadleaf);

  // Shrubs, native grasses, flowers, rocks and planting islands break up the lawn.
  for (let i = 0; i < 220; i++) {
    const x = rand(-141, 141), z = rand(-141, 141), r = Math.hypot(x, z);
    if (r > shore(Math.atan2(z, x)) - 4 || inLake(x, z, 2) || onPath(x, z, 1.6) || nearTrack(x, z, 2.5, 2)
      || features.some(f => Math.hypot(x - f.x, z - f.z) < f.radius)) continue;
    const s = rand(0.6, 1.7);
    props.sphere(x, 0.5 * s, z, s, 0.75 * s, s * 0.8, random() < 0.5 ? 0x739160 : 0x829f65);
    if (random() < 0.25) for (let k = 0; k < 4; k++) props.sphere(x + rand(-s, s), 0.85 * s, z + rand(-s, s), 0.12, 0.12, 0.12, random() < 0.5 ? palette.peach : palette.cream);
  }
  for (let i = 0; i < 35; i++) {
    const a = random() * Math.PI * 2, r = shore(a) + rand(7, 16);
    const s = rand(0.7, 2.2);
    props.add(prim.rock, 0xb9b5a0, v3(Math.cos(a) * r, -1 + s * 0.35, Math.sin(a) * r), v3(s * 1.6, s * 0.8, s));
  }
  // Low dunes / coastal hills at the quiet northern end.
  for (let i = 0; i < 10; i++) {
    const x = -35 + i * 12, z = -125 + rand(-8, 8);
    if (nearTrack(x, z, 22, 18)) continue;
    props.sphere(x, -2.5, z, rand(12, 18), rand(6, 11), rand(13, 18), i % 2 ? 0x91a977 : 0x9eb27e);
  }

  // Flags, bunting and balloon clusters give the promenade little points of life.
  for (const [x, z] of [[-116,92],[-66,89],[8,103],[-113,-84]]) {
    props.cylinder(x, 3.4, z, 0.075, 6.8, palette.cream);
    for (let i = 0; i < 3; i++) {
      const dx = (i - 1) * 0.65, dy = 5.7 + i % 2 * 0.9;
      props.beam(v3(x, 3.1, z), v3(x + dx, dy, z + 0.2), 0.015, palette.cream);
      props.sphere(x + dx, dy + 0.45, z + 0.2, 0.45, 0.62, 0.45, [palette.coral, palette.mustard, palette.teal][i]);
    }
  }
  for (const z of [-93, -25, 72]) {
    const y = 6.7;
    for (const x of [-114, -102]) props.cylinder(x, y / 2, z, 0.07, y, palette.cream);
    const pts = [];
    for (let k = 0; k <= 12; k++) pts.push(v3(-114 + k, y - Math.sin(k / 12 * Math.PI) * 1.1, z));
    for (let k = 0; k < 12; k++) {
      props.beam(pts[k], pts[k + 1], 0.025, palette.cream);
      const p = pts[k].clone().lerp(pts[k + 1], 0.5);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([
        p.x-0.3,p.y,p.z,p.x,p.y-0.65,p.z,p.x+0.3,p.y,p.z,
        p.x-0.3,p.y,p.z,p.x+0.3,p.y,p.z,p.x,p.y-0.65,p.z,
      ],3));
      g.computeVertexNormals(); props.add(g, [palette.coral,palette.teal,palette.mustard][k % 3]); g.dispose();
    }
  }

  // Tiny visitors, batched just like furniture; they lend scale to the scenery.
  for (let i = 0; i < 44; i++) {
    const along = random() < 0.55;
    const x = along ? -108 + rand(-2.7, 2.7) : rand(-105, 48);
    const z = along ? rand(-96, 94) : 94 + rand(-3.5, 3.5);
    if (Math.hypot(x + 18, z - 94) < 8) continue;
    const h = rand(1.45, 1.8), tint = [palette.coral,palette.teal,palette.mustard,0xf1cfaf,0x577b8d][i % 5];
    props.box(x - 0.13, h * 0.24, z, 0.18, h * 0.46, 0.23, 0x435b5a);
    props.box(x + 0.13, h * 0.24, z + 0.07, 0.18, h * 0.46, 0.23, 0x435b5a);
    props.sphere(x, h * 0.63, z, 0.32, h * 0.26, 0.22, tint);
    props.sphere(x, h * 0.93, z, 0.22, 0.24, 0.22, [0xe9b78e,0xbf8e6f,0xf0cba6][i % 3]);
    if (i % 3 === 0) props.cylinder(x, h * 1.06, z, 0.29, 0.08, palette.cream);
  }

  ground.bake(root, solidMaterial, false);
  props.bake(root, solidMaterial, true);
  glowing.bake(root, lightMaterial, false);

  // Distant coastal headlands and soft stylized clouds complete the horizon.
  const distanceBatch = new Batch();
  for (let i = 0; i < 18; i++) {
    const x = -650 + i * 75, z = -570 - rand(0, 130), h = rand(45, 125);
    distanceBatch.add(prim.rock, i % 2 ? 0x9abdb6 : 0x9eb5ac, v3(x, h * 0.22 - 10, z), v3(rand(65, 100), h, rand(50, 90)));
  }
  distanceBatch.bake(root, solidMaterial, false);
  const clouds = new THREE.Group(); root.add(clouds);
  const cloudBatch = new Batch();
  for (let i = 0; i < 21; i++) {
    const a = i / 21 * Math.PI * 2 + rand(-0.1, 0.1), r = rand(300, 620), y = rand(95, 150);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const size = rand(8, 17);
    for (let j = 0; j < 4; j++) cloudBatch.sphere(x + (j - 1.5) * size, y + (j % 2) * size * 0.25, z + rand(-3, 3), size * 1.3, size * rand(0.35, 0.6), size * 0.68, 0xfff5df);
  }
  const cloudMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }); materials.push(cloudMaterial);
  cloudBatch.bake(clouds, cloudMaterial, false);

  let disposed = false;
  return {
    root,
    update(time, dt) {
      waterMaterial.uniforms.time.value = time;
      lagoonMaterial.uniforms.time.value = time;
      for (const fn of animated) fn(time);
      clouds.rotation.y = Math.sin(time * 0.001) * 0.02;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      root.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
      for (const resource of owned) resource.dispose();
      for (const mat of materials) mat.dispose();
    },
  };
}
