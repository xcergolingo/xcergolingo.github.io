import * as THREE from './vendor/three.module.js';

// Pinefall Reserve. All scenery and textures are generated locally.
const clamp = THREE.MathUtils.clamp;
const smoothstep = THREE.MathUtils.smoothstep;
const UP = new THREE.Vector3(0, 1, 0);

function randomGenerator(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function textureCanvas(size, draw, repeat = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 4;
  return texture;
}

function makeGroundTexture() {
  return textureCanvas(512, (ctx, size) => {
    const random = randomGenerator(1202);
    const pixels = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const p = (y * size + x) * 4;
        const wideNoise = Math.sin(x * .035) * Math.cos(y * .047) * 12;
        const n = 211 + wideNoise + random() * 25;
        pixels.data[p] = n;
        pixels.data[p + 1] = n - 3;
        pixels.data[p + 2] = n - 13;
        pixels.data[p + 3] = 255;
      }
    }
    ctx.putImageData(pixels, 0, 0);
    for (let i = 0; i < 6200; i++) {
      const x = random() * size, y = random() * size;
      ctx.strokeStyle = i % 4 ? 'rgba(84,92,65,.16)' : 'rgba(255,247,210,.32)';
      ctx.lineWidth = .6 + random() * .6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + random() * 3 - 1.5, y - 1 - random() * 4);
      ctx.stroke();
    }
  }, 74);
}

function makeBarkTexture() {
  return textureCanvas(256, (ctx, size) => {
    const random = randomGenerator(311);
    ctx.fillStyle = '#857464';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 850; i++) {
      const x = random() * size, y = random() * size;
      ctx.fillStyle = i % 3 ? `rgba(45,35,29,${.08 + random() * .25})` : 'rgba(217,201,167,.19)';
      ctx.fillRect(x, y, .5 + random() * 3, 3 + random() * 52);
    }
    for (let i = 0; i < 24; i++) {
      ctx.strokeStyle = 'rgba(32,29,23,.25)';
      ctx.lineWidth = .6;
      ctx.beginPath();
      const x = random() * size;
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x - 8, 80, x + 10, 160, x - 2, size);
      ctx.stroke();
    }
  });
}

function coloredGeometry(positions, colors) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function makePineCrown() {
  const random = randomGenerator(2451);
  const positions = [], colors = [];
  const dark = new THREE.Color('#274536');
  const light = new THREE.Color('#577451');
  const point = (x, y, z, lightness) => {
    positions.push(x, y, z);
    const color = dark.clone().lerp(light, lightness);
    colors.push(color.r, color.g, color.b);
  };
  for (let tier = 0; tier < 7; tier++) {
    const y = 2.45 + tier * 1.17;
    const radius = 2.95 * (1 - tier * .118);
    const height = 3.25 - tier * .12;
    const segments = 12;
    const ring = [];
    for (let k = 0; k < segments; k++) {
      const angle = k / segments * Math.PI * 2 + tier * .62;
      const r = radius * (.84 + random() * .29);
      ring.push([Math.cos(angle) * r, y + random() * .45, Math.sin(angle) * r]);
    }
    for (let k = 0; k < segments; k++) {
      const a = ring[k], b = ring[(k + 1) % segments];
      const ma = [a[0] * .57, y + height * .40, a[2] * .57];
      const mb = [b[0] * .57, y + height * .40, b[2] * .57];
      const shade = .22 + random() * .36 + tier * .025;
      point(0, y + height, 0, shade + .18);
      point(...ma, shade + .05);
      point(...mb, shade + .09);
      point(...ma, shade + .05);
      point(...a, shade * .7);
      point(...b, shade * .8);
      point(...ma, shade + .05);
      point(...b, shade * .8);
      point(...mb, shade + .09);
    }
  }
  return coloredGeometry(positions, colors);
}

function makeGrassClump() {
  const positions = [], colors = [];
  const root = new THREE.Color('#657246'), tip = new THREE.Color('#c8bf7c');
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI / 3 + .35;
    const dx = Math.cos(angle) * .035, dz = Math.sin(angle) * .035;
    const leanX = Math.sin(i * 4.3) * .15, leanZ = Math.cos(i * 7.2) * .15;
    const h = .7 + i * .13;
    const vertices = [
      [-dx, 0, -dz], [dx, 0, dz], [leanX + dx * .65, h * .58, leanZ + dz * .65],
      [-dx, 0, -dz], [leanX + dx * .65, h * .58, leanZ + dz * .65], [leanX * 1.7, h, leanZ * 1.7],
    ];
    for (const v of vertices) {
      positions.push(...v);
      const color = root.clone().lerp(tip, v[1] / h);
      colors.push(color.r, color.g, color.b);
    }
  }
  return coloredGeometry(positions, colors);
}

function makeFern() {
  const positions = [], colors = [];
  const shade = new THREE.Color('#536d3f'), light = new THREE.Color('#89915a');
  for (let f = 0; f < 7; f++) {
    const angle = f * Math.PI * 2 / 7;
    const dx = Math.cos(angle), dz = Math.sin(angle);
    for (let n = 1; n <= 5; n++) {
      const t = n / 6;
      const r = t * .85;
      const y = .10 + Math.sin(t * Math.PI * .88) * .42;
      const width = Math.sin(t * Math.PI) * .19;
      for (const side of [-1, 1]) {
        const p = [dx * r, y, dz * r];
        const q = [dx * (r - .14) - dz * width * side, y - .05, dz * (r - .14) + dx * width * side];
        const s = [dx * (r + .06), y + .015, dz * (r + .06)];
        for (const v of [p, q, s]) {
          positions.push(...v);
          const color = shade.clone().lerp(light, .12 + t * .45);
          colors.push(color.r, color.g, color.b);
        }
      }
    }
  }
  return coloredGeometry(positions, colors);
}

export function createEnvironment(scene) {
  const random = randomGenerator(45688);
  const colliders = [], occluders = [];
  const dummy = new THREE.Object3D();
  const grove = new THREE.Group();
  grove.name = 'Pinefall Reserve';
  scene.add(grove);
  scene.background = new THREE.Color('#b5c2b3');
  scene.fog = new THREE.FogExp2('#b9c4b3', .0048);

  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      zenith: { value: new THREE.Color('#86a9b4') },
      horizon: { value: new THREE.Color('#d8d8bd') },
      lowSky: { value: new THREE.Color('#e9cda5') },
      sunDirection: { value: new THREE.Vector3(-.51, .37, -.78).normalize() },
    },
    vertexShader: `varying vec3 vDirection;
      void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w;
      }`,
    fragmentShader: `uniform vec3 zenith, horizon, lowSky, sunDirection;
      varying vec3 vDirection;
      void main() {
        vec3 direction = normalize(vDirection);
        float height = max(0.0, direction.y);
        vec3 color = mix(horizon, zenith, pow(height, .55));
        color = mix(color, lowSky, pow(1.0 - smoothstep(-.06, .29, direction.y), 2.0) * .66);
        float sun = max(0.0, dot(direction, sunDirection));
        color += vec3(1.0, .73, .38) * pow(sun, 17.0) * .19;
        color += vec3(1.0, .83, .54) * pow(sun, 150.0) * .26;
        color += vec3(2.5, 2.1, 1.55) * smoothstep(.99949, .99976, sun);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 40, 20), skyMaterial);
  sky.name = 'Morning sky';
  sky.renderOrder = -1000;
  scene.add(sky);

  const hemisphere = new THREE.HemisphereLight('#d1e1e5', '#7c7958', 2.25);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight('#ffe2b1', 3.3);
  sun.position.set(-63, 91, -76);
  sun.target.position.set(0, 0, -32);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -86;
  sun.shadow.camera.right = 86;
  sun.shadow.camera.top = 86;
  sun.shadow.camera.bottom = -86;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 250;
  sun.shadow.bias = -.0003;
  sun.shadow.normalBias = .09;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  function lakeDistance(x, z) {
    return Math.sqrt(((x - 77) / 32) ** 2 + ((z + 35) / 66) ** 2);
  }

  function heightAt(x, z) {
    const clearingDistance = Math.sqrt((x / 39) ** 2 + ((z + 29) / 94) ** 2);
    const edge = smoothstep(clearingDistance, .83, 1.65);
    const rolling = 1.7 + Math.sin(x * .031 + z * .016) * 1.35
      + Math.cos(z * .043 - x * .018) * 1.15 + Math.sin(x * .079) * .36;
    let height = Math.sin(z * .039) * .13 + Math.cos(x * .065) * .07 + edge * rolling;
    height += smoothstep(-z, 95, 190) * 6;
    const lake = lakeDistance(x, z);
    if (lake < 1.19) {
      const lakeBed = -2.1 + Math.cos(x * .15) * .13;
      height = THREE.MathUtils.lerp(lakeBed, height, smoothstep(lake, .88, 1.19));
    }
    return height;
  }

  function pathX(z) { return -5 + Math.sin((z + 18) * .041) * 5.8; }

  const groundGeometry = new THREE.PlaneGeometry(460, 460, 144, 144);
  groundGeometry.rotateX(-Math.PI / 2);
  const groundPositions = groundGeometry.getAttribute('position');
  const groundColors = new Float32Array(groundPositions.count * 3);
  const grassColor = new THREE.Color('#8c9869');
  const forestColor = new THREE.Color('#5e7554');
  const pathColor = new THREE.Color('#c1b38a');
  const shoreColor = new THREE.Color('#a59b77');
  const color = new THREE.Color();
  for (let i = 0; i < groundPositions.count; i++) {
    const x = groundPositions.getX(i), z = groundPositions.getZ(i);
    const y = heightAt(x, z);
    groundPositions.setY(i, y);
    const edge = smoothstep(Math.sqrt((x / 43) ** 2 + ((z + 29) / 101) ** 2), .8, 1.8);
    color.copy(grassColor).lerp(forestColor, edge * .85);
    const trail = (1 - smoothstep(Math.abs(x - pathX(z)), 1.4, 4.6)) * (1 - smoothstep(-z, 70, 105));
    color.lerp(pathColor, trail * .77);
    const shore = 1 - smoothstep(Math.abs(lakeDistance(x, z) - 1.05), .025, .16);
    color.lerp(shoreColor, shore * .85);
    const noise = Math.sin(x * .79 + z * .64) * .027 + Math.cos(x * .11 - z * .14) * .045;
    color.multiplyScalar(.95 + noise);
    color.toArray(groundColors, i * 3);
  }
  groundGeometry.setAttribute('color', new THREE.BufferAttribute(groundColors, 3));
  groundGeometry.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeometry, new THREE.MeshStandardMaterial({
    vertexColors: true, map: makeGroundTexture(), roughness: 1, metalness: 0,
  }));
  ground.name = 'Meadow and forest floor';
  ground.receiveShadow = true;
  grove.add(ground);
  occluders.push(ground);

  // Far ridges have their own silhouettes, so the reserve never ends at a wall of trees.
  const ridgeColors = ['#9ba69e', '#85968a', '#728773'];
  for (let layer = 0; layer < 3; layer++) {
    const positions = [], colors = [], indices = [];
    const cols = 90, rows = 13;
    const near = -315 + layer * 57;
    const baseColor = new THREE.Color(ridgeColors[layer]);
    for (let iz = 0; iz <= rows; iz++) {
      const t = iz / rows;
      for (let ix = 0; ix <= cols; ix++) {
        const x = (ix / cols - .5) * 1060;
        const z = near - t * 150;
        const summit = 46 + (2 - layer) * 17
          + 28 * Math.sin(x * .013 + layer * 1.9)
          + 21 * Math.cos(x * .027 - layer * .8)
          + 11 * Math.sin(x * .061 + layer)
          + 25 * Math.exp(-(((x + 190) / 75) ** 2));
        const height = -5 + Math.pow(Math.sin(t * Math.PI), .75) * summit
          + Math.sin(x * .093 + iz * 2.8) * Math.sin(t * Math.PI) * 4;
        positions.push(x, height, z);
        color.copy(baseColor).multiplyScalar(.85 + random() * .19 + t * .06);
        if (layer === 0 && height > 77) color.lerp(new THREE.Color('#deded0'), smoothstep(height, 77, 110) * .7);
        color.toArray(colors, colors.length);
      }
    }
    for (let iz = 0; iz < rows; iz++) {
      for (let ix = 0; ix < cols; ix++) {
        const a = iz * (cols + 1) + ix, b = a + cols + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const ridge = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide }));
    ridge.name = `Mountain ridge ${layer + 1}`;
    grove.add(ridge);
  }

  const protectedSpawns = [[0, -30], [-17, -45], [19, -52], [-8, -64], [30, -36], [9, -81], [-32, -70]];
  const nearAnimal = (x, z, radius = 9) => protectedSpawns.some(p => Math.hypot(x - p[0], z - p[1]) < radius);
  const treeSpots = [
    [-29, 10, 1.22], [-37, 23, 1.45], [-42, -6, 1.15], [-35, -29, 1.32],
    [-46, -49, 1.28], [-48, -79, 1.2], [31, 19, 1.4], [41, 7, 1.33],
    [39, -13, 1.1], [43, -56, 1.0], [-14, 45, 1.4], [13, 48, 1.3],
  ];
  for (let tries = 0; treeSpots.length < 262 && tries < 5000; tries++) {
    const x = (random() - .5) * 356;
    const z = (random() - .5) * 340 - 30;
    const clearing = (x / 37) ** 2 + ((z + 28) / 91) ** 2;
    if (clearing < 1 || lakeDistance(x, z) < 1.17 || nearAnimal(x, z)) continue;
    if (treeSpots.some(p => Math.hypot(x - p[0], z - p[1]) < 4)) continue;
    treeSpots.push([x, z, .65 + random() * .77]);
  }
  const barkTexture = makeBarkTexture();
  const barkMaterial = new THREE.MeshStandardMaterial({ color: '#ad9b80', map: barkTexture, roughness: 1 });
  const trunkGeometry = new THREE.CylinderGeometry(.135, .36, 11.7, 7, 1);
  trunkGeometry.translate(0, 5.85, 0);
  const trunks = new THREE.InstancedMesh(trunkGeometry, barkMaterial, treeSpots.length);
  trunks.name = 'Solid pine trunks';
  const crowns = new THREE.InstancedMesh(makePineCrown(), new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: .98, side: THREE.DoubleSide,
  }), treeSpots.length);
  crowns.name = 'Layered pine crowns';
  for (let i = 0; i < treeSpots.length; i++) {
    const [x, z, s] = treeSpots[i];
    const stretch = .83 + random() * .35;
    dummy.position.set(x, heightAt(x, z) - .06, z);
    dummy.rotation.set(0, random() * Math.PI * 2, (random() - .5) * .035);
    dummy.scale.set(s, s * stretch, s);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    crowns.setMatrixAt(i, dummy.matrix);
    crowns.setColorAt(i, new THREE.Color().setHSL(.26 + random() * .045, .11 + random() * .13, .74 + random() * .2));
    colliders.push({ x, z, r: s * .43 + .16 });
  }
  trunks.castShadow = trunks.receiveShadow = true;
  crowns.castShadow = crowns.receiveShadow = true;
  grove.add(trunks, crowns);
  occluders.push(trunks);

  // Grass is one instanced draw with a gentle, GPU-driven breeze.
  const grassSpots = [];
  for (let tries = 0; grassSpots.length < 6500 && tries < 14000; tries++) {
    const x = (random() - .5) * 190, z = (random() - .5) * 205 - 20;
    if (lakeDistance(x, z) < 1.1) continue;
    const pathDistance = Math.abs(x - pathX(z));
    if (pathDistance < 1.8 && z > -88 && random() < .94) continue;
    grassSpots.push([x, z]);
  }
  let grassShader;
  const grassMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });
  grassMaterial.onBeforeCompile = shader => {
    grassShader = shader;
    shader.uniforms.windTime = { value: 0 };
    shader.vertexShader = 'uniform float windTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      #ifdef USE_INSTANCING
        float gust = sin(windTime * 1.35 + instanceMatrix[3].x * .21 + instanceMatrix[3].z * .12);
        transformed.x += gust * position.y * position.y * .16;
        transformed.z += cos(windTime * .9 + instanceMatrix[3].z * .17) * position.y * position.y * .06;
      #endif
    `);
  };
  grassMaterial.customProgramCacheKey = () => 'pinefall-grass-1';
  const grass = new THREE.InstancedMesh(makeGrassClump(), grassMaterial, grassSpots.length);
  grass.name = 'Meadow grass';
  for (let i = 0; i < grassSpots.length; i++) {
    const [x, z] = grassSpots[i];
    const closeClearing = Math.abs(x) < 28 && z > -87;
    dummy.position.set(x, heightAt(x, z) + .008, z);
    dummy.rotation.set(0, random() * Math.PI * 2, 0);
    const s = .65 + random() * .65;
    dummy.scale.set(s, (closeClearing ? .22 : .40) + random() * .37, s);
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
    grass.setColorAt(i, new THREE.Color().setHSL(.11 + random() * .10, .12, .72 + random() * .25));
  }
  grass.receiveShadow = true;
  grove.add(grass);

  const rockGeometry = new THREE.IcosahedronGeometry(1, 1);
  const rockPositions = rockGeometry.getAttribute('position');
  const rockColors = [];
  for (let i = 0; i < rockPositions.count; i++) {
    const x = rockPositions.getX(i), y = rockPositions.getY(i), z = rockPositions.getZ(i);
    const variation = 1 + Math.sin(x * 13 + y * 17 + z * 11) * .1;
    rockPositions.setXYZ(i, x * variation, y * variation, z * variation);
    color.set('#7d8372').multiplyScalar(.88 + Math.max(0, y) * .25);
    color.toArray(rockColors, i * 3);
  }
  rockGeometry.setAttribute('color', new THREE.Float32BufferAttribute(rockColors, 3));
  rockGeometry.computeVertexNormals();
  const rockSpots = [[-15, 7, 1.8], [-17.4, 6, 1.1], [16, 1, .72], [-26, -15, 1.35], [29, -9, 1.15], [-30, -55, 1.2]];
  for (let tries = 0; rockSpots.length < 94 && tries < 1000; tries++) {
    const x = (random() - .5) * 230, z = (random() - .5) * 245 - 25;
    if (lakeDistance(x, z) < 1.03 || nearAnimal(x, z, 8)) continue;
    if (Math.abs(x) < 25 && z > -90 && z < 35) continue;
    rockSpots.push([x, z, .4 + random() * 1.7]);
  }
  for (let i = 0; i < 24; i++) {
    const angle = i / 24 * Math.PI * 2;
    rockSpots.push([77 + Math.cos(angle) * 34.5, -35 + Math.sin(angle) * 70, .5 + random() * .8]);
  }
  const rocks = new THREE.InstancedMesh(rockGeometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), rockSpots.length);
  rocks.name = 'Granite boulders';
  for (let i = 0; i < rockSpots.length; i++) {
    const [x, z, s] = rockSpots[i];
    dummy.position.set(x, heightAt(x, z) + s * .16, z);
    dummy.rotation.set(random() * .35, random() * Math.PI * 2, random() * .3);
    dummy.scale.set(s * (1 + random() * .45), s * (.55 + random() * .3), s);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
    rocks.setColorAt(i, new THREE.Color().setHSL(.11, .05, .8 + random() * .2));
    colliders.push({ x, z, r: s * .9 });
  }
  rocks.castShadow = rocks.receiveShadow = true;
  grove.add(rocks);
  occluders.push(rocks);

  const fernSpots = [];
  for (let tries = 0; fernSpots.length < 145 && tries < 2000; tries++) {
    const x = (random() - .5) * 118, z = (random() - .5) * 125 - 12;
    if (lakeDistance(x, z) < 1.12 || Math.abs(x - pathX(z)) < 4 || nearAnimal(x, z, 3.5)) continue;
    if (Math.abs(x) < 19 && z < -10 && random() < .8) continue;
    fernSpots.push([x, z]);
  }
  const ferns = new THREE.InstancedMesh(makeFern(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }), fernSpots.length);
  ferns.name = 'Forest ferns';
  for (let i = 0; i < fernSpots.length; i++) {
    const [x, z] = fernSpots[i], s = .65 + random() * .9;
    dummy.position.set(x, heightAt(x, z) + .015, z);
    dummy.rotation.set(0, random() * Math.PI * 2, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    ferns.setMatrixAt(i, dummy.matrix);
  }
  ferns.receiveShadow = true;
  grove.add(ferns);

  const logGeometry = new THREE.CylinderGeometry(.37, .43, 6.7, 11, 1);
  const endTexture = textureCanvas(128, (ctx, size) => {
    ctx.fillStyle = '#bba17b'; ctx.fillRect(0, 0, size, size);
    for (let r = 7; r < 64; r += 5) {
      ctx.beginPath(); ctx.ellipse(62, 62, r, r * .92, .2, 0, Math.PI * 2);
      ctx.strokeStyle = r % 3 ? 'rgba(86,62,37,.35)' : 'rgba(232,204,158,.4)';
      ctx.lineWidth = 1.2; ctx.stroke();
    }
  });
  const endMaterial = new THREE.MeshStandardMaterial({ map: endTexture, color: '#c6aa80', roughness: 1 });
  for (const [x, z, rotation] of [[-30, -8, .8], [38, -72, 1.8], [-47, -44, -.6]]) {
    const log = new THREE.Mesh(logGeometry, [barkMaterial, endMaterial, endMaterial]);
    log.position.set(x, heightAt(x, z) + .4, z);
    log.rotation.set(Math.PI / 2, 0, rotation);
    log.castShadow = log.receiveShadow = true;
    grove.add(log);
    occluders.push(log);
    for (let i = -2; i <= 2; i++) colliders.push({ x: x + Math.sin(rotation) * i, z: z + Math.cos(rotation) * i, r: .58 });
  }

  const waterGeometry = new THREE.CircleGeometry(1, 96, 0, Math.PI * 2);
  waterGeometry.rotateX(-Math.PI / 2);
  waterGeometry.scale(32.9, 1, 67.5);
  const waterUniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      time: { value: 0 },
      deepColor: { value: new THREE.Color('#526f68') },
      skyColor: { value: new THREE.Color('#b9c9b5') },
    },
  ]);
  const waterMaterial = new THREE.ShaderMaterial({
    uniforms: waterUniforms, fog: true,
    vertexShader: `varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float time;
      uniform vec3 deepColor, skyColor;
      varying vec3 vWorld;
      #include <fog_pars_fragment>
      void main() {
        float a = sin(vWorld.x * 1.1 + vWorld.z * .48 + time * .8);
        float b = cos(vWorld.z * 1.8 - vWorld.x * .31 - time * .63);
        vec3 normal = normalize(vec3(a * .045, 1.0, b * .035));
        vec3 view = normalize(cameraPosition - vWorld);
        float fresnel = pow(1.0 - max(0.0, dot(normal, view)), 2.8);
        vec3 color = mix(deepColor, skyColor, fresnel * .72);
        float glint = pow(max(0.0, dot(reflect(normalize(vec3(.51, -.67, .78)), normal), view)), 90.0);
        color += vec3(1.0, .84, .52) * glint * .8;
        color += (a + b) * .013;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.name = 'Pinefall lake';
  water.position.set(77, -.36, -35);
  grove.add(water);

  // These soft banks keep the walking route on dry land.
  colliders.push({ x: 77, z: -35, r: 27 }, { x: 77, z: -70, r: 23 }, { x: 77, z: 0, r: 23 });

  const mistTexture = textureCanvas(128, (ctx, size) => {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(236,235,206,.8)');
    gradient.addColorStop(.45, 'rgba(236,235,206,.28)');
    gradient.addColorStop(1, 'rgba(236,235,206,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
  });
  const mists = [];
  for (const [x, y, z, width] of [[-32, 4.4, -106, 70], [28, 3, -124, 80], [78, 1.2, -73, 62]]) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTexture, transparent: true, opacity: .16, depthWrite: false, color: '#e1dfbd' }));
    sprite.position.set(x, y + heightAt(x, z), z);
    sprite.scale.set(width, 7.5, 1);
    sprite.userData.originX = x;
    grove.add(sprite);
    mists.push(sprite);
  }

  const motePositions = new Float32Array(90 * 3), moteOrigins = [];
  for (let i = 0; i < 90; i++) {
    const x = (random() - .5) * 95, z = (random() - .5) * 120 - 20;
    const y = heightAt(x, z) + .7 + random() * 4.8;
    motePositions.set([x, y, z], i * 3);
    moteOrigins.push([x, y, z, random() * Math.PI * 2]);
  }
  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const motes = new THREE.Points(moteGeometry, new THREE.PointsMaterial({
    color: '#ffe0a1', size: .045, transparent: true, opacity: .62, depthWrite: false, sizeAttenuation: true,
  }));
  motes.name = 'Drifting pollen';
  grove.add(motes);

  const birdGeometry = new THREE.BufferGeometry();
  birdGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, -.2, -.7, .19, 0, -.17, -.01, .07,
    0, 0, -.2, .17, -.01, .07, .7, .19, 0,
    -.08, 0, -.25, .08, 0, -.25, 0, 0, .29,
  ], 3));
  birdGeometry.computeVertexNormals();
  const birds = new THREE.InstancedMesh(birdGeometry, new THREE.MeshBasicMaterial({ color: '#46564c', side: THREE.DoubleSide }), 7);
  birds.name = 'Distant birds';
  birds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  birds.frustumCulled = false;
  grove.add(birds);

  let elapsed = 0;
  function update(dt, time) {
    elapsed = Number.isFinite(time) ? time : elapsed + dt;
    waterUniforms.time.value = elapsed;
    if (grassShader) grassShader.uniforms.windTime.value = elapsed;
    for (let i = 0; i < mists.length; i++) mists[i].position.x = mists[i].userData.originX + Math.sin(elapsed * .025 + i) * 3;
    for (let i = 0; i < moteOrigins.length; i++) {
      const [x, y, z, phase] = moteOrigins[i];
      motePositions[i * 3] = x + Math.sin(elapsed * .15 + phase) * .8;
      motePositions[i * 3 + 1] = y + Math.sin(elapsed * .34 + phase) * .18;
      motePositions[i * 3 + 2] = z + Math.cos(elapsed * .11 + phase) * .6;
    }
    moteGeometry.getAttribute('position').needsUpdate = true;
    for (let i = 0; i < 7; i++) {
      const angle = elapsed * .017 + i * .12;
      dummy.position.set(-49 + Math.sin(angle) * 72 + i * 1.8, 39 + Math.sin(elapsed * .2 + i) * .7 + i * .5, -127 + Math.cos(angle) * 27 + i * 1.5);
      dummy.rotation.set(0, angle + Math.PI / 2, Math.sin(elapsed * 1.4 + i * .8) * .13);
      const s = .65 + i * .035;
      dummy.scale.set(s, .6 + Math.sin(elapsed * 2.9 + i) * .43, s);
      dummy.updateMatrix();
      birds.setMatrixAt(i, dummy.matrix);
    }
    birds.instanceMatrix.needsUpdate = true;
  }
  update(0, 0);

  return { heightAt, colliders, occluders, update, bounds: 140 };
}
