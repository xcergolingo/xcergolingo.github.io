// Word Archer 3D — a real, layered outdoor range. All artwork is procedural.
// No scene photograph, remote texture, model loader, or background image required.
export function createRange(THREE, scene) {
  const world = new THREE.Group();
  world.name = 'Alpine archery range';
  scene.add(world);
  const textures = [], materials = [], geometries = [];
  const windTime = { value: 0 };
  let seed = 937121;
  function rand(a = 0, b = 1) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return a + (seed / 4294967296) * (b - a); }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rgb = (r, g, b) => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
  const mat = options => { const m = new THREE.MeshStandardMaterial(options); materials.push(m); return m; };
  const geom = g => { geometries.push(g); return g; };
  function texture(size, draw, repeat = 1) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    draw(canvas.getContext('2d'), size);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(repeat, repeat); map.anisotropy = 4;
    textures.push(map); return map;
  }
  function mesh(g, m, x = 0, y = 0, z = 0, parent = world) {
    const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.receiveShadow = true; parent.add(o); return o;
  }
  function merge(parts) {
    const positions = [], normals = [], uvs = [], colors = [];
    let useColors = false;
    for (const source of parts) {
      const g = source.index ? source.toNonIndexed() : source;
      const p = g.getAttribute('position'), n = g.getAttribute('normal'), uv = g.getAttribute('uv'), c = g.getAttribute('color');
      useColors ||= !!c;
      for (let i = 0; i < p.count; i++) {
        positions.push(p.getX(i), p.getY(i), p.getZ(i)); normals.push(n?.getX(i) ?? 0, n?.getY(i) ?? 1, n?.getZ(i) ?? 0);
        uvs.push(uv?.getX(i) || 0, uv?.getY(i) || 0); colors.push(c?.getX(i) ?? 1, c?.getY(i) ?? 1, c?.getZ(i) ?? 1);
      }
      if (g !== source) g.dispose(); source.dispose();
    }
    const result = new THREE.BufferGeometry(); result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    result.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); result.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    if (useColors) result.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    result.computeBoundingSphere(); return geom(result);
  }
  function barGeometry(a, b, width = .1, depth = width) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), direction = end.clone().sub(start);
    const g = new THREE.BoxGeometry(width, direction.length(), depth);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
    g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); return g;
  }
  function instances(g, m, items, { shadow = false, color = null } = {}) {
    const o = new THREE.InstancedMesh(g, m, items.length), dummy = new THREE.Object3D();
    items.forEach((p, i) => {
      dummy.position.set(p.x || 0, p.y || 0, p.z || 0); dummy.rotation.set(p.rx || 0, p.ry || 0, p.rz || 0);
      const s = p.s || 1; dummy.scale.set(p.sx ?? s, p.sy ?? s, p.sz ?? s); dummy.updateMatrix(); o.setMatrixAt(i, dummy.matrix);
      if (color) o.setColorAt(i, color(p, i));
    });
    o.castShadow = shadow; o.receiveShadow = true; o.instanceMatrix.needsUpdate = true;
    if (o.instanceColor) o.instanceColor.needsUpdate = true;
    o.computeBoundingSphere(); world.add(o); return o;
  }

  // Fine-scale meadow variation and individual grass fibres, baked once.
  const meadow = texture(512, (c, s) => {
    c.fillStyle = '#808a4f'; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 11000; i++) {
      const x = rand(0, s), y = rand(0, s), v = rand(-34, 30);
      c.fillStyle = rgb(118 + v, 136 + v, 66 + v * .55); c.fillRect(x, y, rand(.6, 2.6), rand(1, 6));
    }
    for (let i = 0; i < 55; i++) {
      const x = rand(0, s), y = rand(0, s), r = rand(14, 55), shade = c.createRadialGradient(x, y, 0, x, y, r);
      shade.addColorStop(0, i % 2 ? '#d3c88b16' : '#304d291c'); shade.addColorStop(1, '#304d2900'); c.fillStyle = shade; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }, 32);
  const woodTexture = texture(256, (c, s) => {
    c.fillStyle = '#91704c'; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 650; i++) {
      const y = rand(0, s), v = rand(-26, 34); c.strokeStyle = rgb(126 + v, 94 + v * .75, 60 + v * .55); c.lineWidth = rand(.3, 1.8);
      c.beginPath(); c.moveTo(0, y); for (let x = 0; x <= s; x += 32) c.lineTo(x, y + Math.sin(x * .035 + y) * 1.5); c.stroke();
    }
    for (let i = 0; i < 3; i++) { c.strokeStyle = '#3b2c1966'; c.lineWidth = 1; c.beginPath(); c.ellipse(rand(0, s), rand(0, s), rand(9, 18), rand(2, 4), 0, 0, Math.PI * 2); c.stroke(); }
  });
  const barkTexture = texture(256, (c, s) => {
    c.fillStyle = '#615544'; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 300; i++) { const v = rand(30, 105); c.fillStyle = rgb(v, v * .83, v * .62); c.fillRect(rand(0, s), rand(0, s), rand(1, 6), rand(6, 90)); }
  });
  const wood = mat({ color: 0xa88a5d, map: woodTexture, roughness: .88 });
  const oldWood = mat({ color: 0x777763, map: woodTexture, roughness: 1 });
  const bark = mat({ color: 0x8d8372, map: barkTexture, roughness: 1 });
  const grassMaterial = mat({ color: 0xb5bf87, map: meadow, roughness: 1, vertexColors: true });
  const darkMetal = mat({ color: 0x354d43, metalness: .42, roughness: .58 });
  const stoneMaterial = mat({ color: 0xb4b1a0, roughness: .97 });

  // An actual rolling surface; the target lane itself remains perfectly level.
  function terrainHeight(x, z) {
    const outside = Math.max(0, Math.abs(x) - 9, -z - 24, z - 6);
    const blend = clamp(outside / 17, 0, 1);
    return blend * (Math.sin(x * .075 + z * .045) * 1.9 + Math.cos(z * .09) * 1.15 + Math.sin(x * .13 - z * .055) * .7 + 1.35);
  }
  const groundGeometry = geom(new THREE.PlaneGeometry(180, 180, 80, 80)); groundGeometry.rotateX(-Math.PI / 2); groundGeometry.translate(0, -.035, -28);
  const gp = groundGeometry.getAttribute('position'), groundColors = [], gc = new THREE.Color();
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i); gp.setY(i, terrainHeight(x, z) - .035);
    gc.setHSL(.18 + .014 * Math.sin(x * .13), .24, .66 + .065 * Math.sin(x * .16 + z * .09)); groundColors.push(gc.r, gc.g, gc.b);
  }
  groundGeometry.setAttribute('color', new THREE.Float32BufferAttribute(groundColors, 3)); groundGeometry.computeVertexNormals();
  mesh(groundGeometry, grassMaterial);

  const laneMap = texture(256, (c, s) => {
    c.fillStyle = '#99a964'; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 5500; i++) { const v = rand(-26, 30); c.fillStyle = rgb(121 + v, 150 + v, 76 + v * .7); c.fillRect(rand(0, s), rand(0, s), .7, rand(.8, 3.7)); }
    c.fillStyle = '#f6e3aa14'; c.fillRect(0, 0, s, s / 2);
  }, 9);
  const lane = mesh(geom(new THREE.PlaneGeometry(10.4, 23)), mat({ map: laneMap, roughness: 1 }), 0, .012, -10.7); lane.rotation.x = -Math.PI / 2;

  // Cedar shooting platform, individual planks, dark reveals and brass line.
  mesh(geom(new THREE.BoxGeometry(7.8, .15, 4.5)), mat({ color: 0x3e4034, roughness: 1 }), 0, -.14, 1.15);
  const boards = Array.from({ length: 22 }, (_, i) => ({ x: 0, y: -.048, z: -1.05 + i * .203, sy: 1, sx: 1, sz: 1 }));
  instances(geom(new THREE.BoxGeometry(7.72, .08, .192)), wood, boards, { color: (_, i) => new THREE.Color().setHSL(.105, .19, .77 + (i % 4) * .045) });
  mesh(geom(new THREE.BoxGeometry(7.7, .018, .075)), mat({ color: 0xe6c986, metalness: .33, roughness: .66 }), 0, .005, -1.0);
  const screws = []; for (let z = -1.04; z < 3.3; z += .406) for (const x of [-3.68, 3.68]) screws.push({ x, y: .003, z });
  const screwGeometry = geom(new THREE.CylinderGeometry(.018, .018, .012, 7)); instances(screwGeometry, darkMetal, screws);

  // Targets: paper fibres, score rings and fine concentric lines on thick straw.
  const targetMap = texture(768, (c, s) => {
    c.fillStyle = '#eae1c6'; c.fillRect(0, 0, s, s);
    const cx = s / 2, r = s * .487;
    for (const [scale, color] of [[1, '#eee7d2'], [.8, '#252f2c'], [.6, '#3a9cba'], [.4, '#d1483e'], [.2, '#efcc5b']]) {
      c.fillStyle = color; c.beginPath(); c.arc(cx, cx, r * scale, 0, Math.PI * 2); c.fill();
    }
    for (let i = 0; i < 14000; i++) { c.fillStyle = i % 2 ? '#fffde912' : '#172b2010'; c.fillRect(rand(0, s), rand(0, s), rand(.5, 2), rand(.5, 2)); }
    c.lineWidth = 1.5;
    for (let i = 1; i <= 10; i++) { c.strokeStyle = i > 6 ? '#ffffff55' : '#30372c88'; c.beginPath(); c.arc(cx, cx, r * i / 10, 0, Math.PI * 2); c.stroke(); }
    c.strokeStyle = '#574c25'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(cx - 6, cx); c.lineTo(cx + 6, cx); c.moveTo(cx, cx - 6); c.lineTo(cx, cx + 6); c.stroke();
  });
  targetMap.wrapS = targetMap.wrapT = THREE.ClampToEdgeWrapping;
  const targetPaper = mat({ map: targetMap, roughness: .9 });
  const strawMap = texture(256, (c, s) => {
    c.fillStyle = '#aa8950'; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 1500; i++) { const v = rand(-40, 35); c.strokeStyle = rgb(167 + v, 137 + v, 77 + v * .65); c.lineWidth = rand(.4, 1.5); const x = rand(0, s), y = rand(0, s); c.beginPath(); c.moveTo(x, y); c.lineTo(x + rand(-3, 3), y + rand(4, 40)); c.stroke(); }
  });
  const straw = mat({ color: 0xe3c795, map: strawMap, roughness: 1 });
  const faceGeometry = geom(new THREE.CircleGeometry(.95, 64));
  const backingGeometry = geom(new THREE.CylinderGeometry(.981, .981, .19, 64)); backingGeometry.rotateX(Math.PI / 2);
  const rimGeometry = geom(new THREE.TorusGeometry(.968, .023, 6, 64));
  const rimMaterial = mat({ color: 0xcbb276, roughness: .88 });
  const standGeometry = merge([
    barGeometry([-.42, -.28, -.11], [-.69, -1.68, .3], .11, .11),
    barGeometry([.42, -.28, -.11], [.69, -1.68, .3], .11, .11),
    barGeometry([0, -.24, -.2], [0, -1.68, -.77], .105, .12),
    barGeometry([-.58, -1.13, .15], [.58, -1.13, .15], .075, .075),
    barGeometry([-.52, -.4, -.15], [.52, -.4, -.15], .09, .11)
  ]);
  const targets = [-2.8, 0, 2.8].map((x, i) => {
    const group = new THREE.Group(); group.position.set(x, 1.7, -17); group.name = `Target ${i + 1}`; world.add(group);
    const stand = mesh(standGeometry, wood, 0, 0, 0, group); stand.castShadow = true;
    const backing = mesh(backingGeometry, straw, 0, 0, -.12, group); backing.castShadow = true;
    const face = mesh(faceGeometry, targetPaper, 0, 0, 0, group); face.receiveShadow = true;
    mesh(rimGeometry, rimMaterial, 0, 0, .006, group);
    const pinMaterial = mat({ color: 0x8d7e61, metalness: .55, roughness: .5 });
    const pins = new THREE.InstancedMesh(screwGeometry, pinMaterial, 4); const dummy = new THREE.Object3D();
    for (let n = 0; n < 4; n++) { const a = (n / 4) * Math.PI * 2 + Math.PI / 4; dummy.position.set(Math.cos(a) * .915, Math.sin(a) * .915, .016); dummy.rotation.x = Math.PI / 2; dummy.updateMatrix(); pins.setMatrixAt(n, dummy.matrix); }
    group.add(pins);
    return { group, center: new THREE.Vector3(x, 1.7, -17), radius: .95, wordAnchor: new THREE.Vector3(x, 2.95, -17), face };
  });

  // The safety net is really behind the target boards, with timber fence beyond it.
  const fenceParts = [];
  for (let x = -14; x <= 14; x += 2.8) {
    fenceParts.push(new THREE.BoxGeometry(.16, 1.55, .16).translate(x, .775, -21));
    if (x < 14) { fenceParts.push(new THREE.BoxGeometry(2.82, .12, .1).translate(x + 1.4, .58, -20.98)); fenceParts.push(new THREE.BoxGeometry(2.82, .12, .1).translate(x + 1.4, 1.2, -20.98)); }
  }
  const rearFence = mesh(merge(fenceParts), oldWood); rearFence.castShadow = true;
  const netMap = texture(128, (c, s) => {
    c.clearRect(0, 0, s, s); c.strokeStyle = '#355140bb'; c.lineWidth = 2;
    for (let i = 0; i <= s; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, s); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(s, i); c.stroke(); }
  }); netMap.repeat.set(10, 3);
  const netMaterial = mat({ map: netMap, color: 0x788b66, transparent: true, alphaTest: .18, side: THREE.DoubleSide, depthWrite: false, roughness: 1 });
  const net = mesh(geom(new THREE.PlaneGeometry(11.8, 3.6)), netMaterial, 0, 1.85, -19.2);
  const netFrame = merge([
    barGeometry([-6, 0, -19.25], [-6, 3.75, -19.25], .10), barGeometry([6, 0, -19.25], [6, 3.75, -19.25], .10),
    barGeometry([-6, 3.7, -19.25], [6, 3.7, -19.25], .1)
  ]); mesh(netFrame, darkMetal).castShadow = true;

  // Gentle lane edging and small path pebbles do not obstruct aiming.
  const rockGeometry = geom(new THREE.IcosahedronGeometry(1, 1));
  const rockPosition = rockGeometry.getAttribute('position');
  for (let i = 0; i < rockPosition.count; i++) { const x = rockPosition.getX(i), y = rockPosition.getY(i), z = rockPosition.getZ(i); const f = 1 + .11 * Math.sin(x * 11.13 + y * 5.87 + z * 9.31); rockPosition.setXYZ(i, x * f, y * f * .65, z * f); }
  rockGeometry.computeVertexNormals();
  const rocks = [];
  for (let i = 0; i < 90; i++) { const z = rand(-24, 5), x = (i % 2 ? -1 : 1) * rand(6.3, 17.5); const s = rand(.08, .33); rocks.push({ x, y: terrainHeight(x, z) + s * .2, z, s, ry: rand(0, Math.PI * 2) }); }
  for (const p of [[-9, -8, 1.1], [13, -15, 1.45], [-12, -24, 1.6], [8, -27, .9]]) rocks.push({ x: p[0], y: terrainHeight(p[0], p[1]) + p[2] * .22, z: p[1], sx: p[2], sy: p[2] * .8, sz: p[2] * .7, ry: rand(0, 6.28) });
  instances(rockGeometry, stoneMaterial, rocks, { shadow: true, color: () => new THREE.Color().setHSL(.1, .06, rand(.63, .98)) });

  // Pine crowns are multi-tiered, asymmetric meshes instanced over the terrain.
  const pineParts = [];
  for (let i = 0; i < 7; i++) {
    const r = 1.45 * (1 - i * .112), py = 1.3 + i * .58;
    const cone = new THREE.ConeGeometry(r, 1.8 - i * .1, 11, 2);
    const p = cone.getAttribute('position'); for (let n = 0; n < p.count; n++) { const x = p.getX(n), z = p.getZ(n); const j = 1 + .085 * Math.sin(Math.atan2(z, x) * 3 + i * 1.7) + .035 * Math.cos(p.getY(n) * 5 + i); p.setX(n, x * j); p.setZ(n, z * j); }
    cone.computeVertexNormals(); cone.rotateY(i * .71); cone.translate(Math.sin(i * 2.1) * .12, py, Math.cos(i) * .09); pineParts.push(cone);
  }
  const pineGeometry = merge(pineParts), pineMaterial = mat({ color: 0x5a7951, roughness: 1 });
  const trunkGeometry = geom(new THREE.CylinderGeometry(.09, .2, 4.8, 8)); trunkGeometry.translate(0, 2.4, 0);
  const trees = [];
  for (let i = 0; i < 110; i++) {
    let x, z;
    if (i < 60) { x = (i % 2 ? -1 : 1) * rand(11.5, 34); z = rand(-51, 8); }
    else { x = rand(-60, 60); z = rand(-76, -31); }
    const s = rand(1.05, 2.0); trees.push({ x, y: terrainHeight(x, z), z, s, ry: rand(0, 6.28) });
  }
  instances(pineGeometry, pineMaterial, trees, { shadow: true, color: () => new THREE.Color().setHSL(rand(.24, .30), rand(.13, .3), rand(.38, .64)) });
  instances(trunkGeometry, bark, trees, { shadow: true });

  // Round-canopied birches soften the foreground conifer silhouette.
  const leafParts = [], branchParts = [new THREE.CylinderGeometry(.075, .18, 4.5, 9).translate(0, 2.25, 0)];
  for (let i = 0; i < 13; i++) {
    const a = i * 2.399, ring = i < 9 ? 1 : .5, x = Math.cos(a) * ring, z = Math.sin(a) * ring, y = 3.4 + (i % 4) * .49;
    const crown = new THREE.IcosahedronGeometry(rand(.83, 1.15), 1); crown.scale(1, rand(.78, 1.15), .8); crown.translate(x, y, z); leafParts.push(crown);
    if (i < 9) branchParts.push(barGeometry([0, 2.3, 0], [x * .95, y, z * .95], .09));
  }
  const leaves = merge(leafParts), branches = merge(branchParts);
  const birchMat = mat({ color: 0xd0cbb3, map: barkTexture, roughness: 1 });
  const leafMat = mat({ color: 0xa4b067, roughness: 1, flatShading: false });
  const deciduous = [
    { x: -8.2, z: 3.2, s: 1.9 }, { x: 10.8, z: -6.1, s: 1.85 }, { x: -8.7, z: -15.6, s: 1.55 },
    { x: -14.6, z: -6, s: 1.8 }, { x: 16.3, z: -21.6, s: 2.0 }, { x: -16.8, z: -25, s: 1.65 },
    { x: 11, z: 8, s: 2.4 }, { x: -13, z: 12, s: 2.6 }
  ].map(p => ({ ...p, y: terrainHeight(p.x, p.z), ry: rand(0, 6.28) }));
  instances(leaves, leafMat, deciduous, { shadow: true, color: () => new THREE.Color().setHSL(.21, .32, rand(.57, .83)) });
  instances(branches, birchMat, deciduous, { shadow: true });

  // Wind moves actual grass vertices, not whole trees or a flat landscape image.
  const bladeParts = [];
  for (let i = 0; i < 5; i++) {
    const a = i * 2.399, width = rand(.025, .05), height = rand(.22, .47), x = Math.cos(a) * .09, z = Math.sin(a) * .09;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([x - width, 0, z, x + width, 0, z, x + .035, height * .58, z + .025, x + .035, height * .58, z + .025, x + width, 0, z, x + .09, height, z + .065], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0,0,1,0,.5,.6,.5,.6,1,0,.5,1], 2));
    g.computeVertexNormals(); g.rotateY(a); bladeParts.push(g);
  }
  const grassGeometry = merge(bladeParts);
  const bladeMat = mat({ color: 0x81995a, roughness: 1, side: THREE.DoubleSide });
  bladeMat.onBeforeCompile = shader => {
    shader.uniforms.uRangeWindTime = windTime;
    shader.vertexShader = 'uniform float uRangeWindTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\ntransformed.x += sin(uRangeWindTime*1.6 + instanceMatrix[3].x*.25 + instanceMatrix[3].z*.18) * position.y * position.y * .25;\n#endif');
  };
  const tufts = [];
  for (let i = 0; i < 2600; i++) {
    const z = rand(-31, 8), x = (i % 2 ? -1 : 1) * rand(5.9, 24);
    tufts.push({ x, z, y: terrainHeight(x, z) - .01, s: rand(.6, 1.55), ry: rand(0, 6.28) });
  }
  instances(grassGeometry, bladeMat, tufts, { color: () => new THREE.Color().setHSL(rand(.17, .23), .27, rand(.55, .87)) });

  // White and golden wildflowers along the range edges, fully geometric petals.
  const petalParts = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2; const p = new THREE.SphereGeometry(.06, 6, 3); p.scale(.75, .2, 1.25); p.rotateY(a); p.translate(Math.sin(a) * .065, .36, Math.cos(a) * .065); petalParts.push(p);
  }
  const flowerGeometry = merge(petalParts), yellowHead = geom(new THREE.SphereGeometry(.043, 7, 4)); yellowHead.scale(1, .45, 1); yellowHead.translate(0, .37, 0);
  const stemGeometry = geom(new THREE.CylinderGeometry(.006, .008, .35, 4)); stemGeometry.translate(0, .175, 0);
  const flowers = [];
  for (let i = 0; i < 220; i++) { const z = rand(-22, 5), x = (i % 2 ? -1 : 1) * rand(6.5, 11); flowers.push({ x, z, y: terrainHeight(x, z), s: rand(.7, 1.5), ry: rand(0, 6.28) }); }
  instances(flowerGeometry, mat({ color: 0xebe9c9, roughness: 1 }), flowers);
  instances(yellowHead, mat({ color: 0xd8ab39, roughness: 1 }), flowers);
  instances(stemGeometry, mat({ color: 0x506734, roughness: 1 }), flowers);

  // A modest timber equipment shelter on the left lends human scale and depth.
  const shelter = new THREE.Group(); shelter.position.set(-10.5, terrainHeight(-10.5, -7), -7); world.add(shelter);
  const shelterWood = [];
  for (const x of [-2.15, 2.15]) for (const z of [-1.4, 1.4]) shelterWood.push(new THREE.BoxGeometry(.18, 2.6, .18).translate(x, 1.3, z));
  shelterWood.push(new THREE.BoxGeometry(4.65, .18, .18).translate(0, 2.51, 1.4), new THREE.BoxGeometry(4.65, .18, .18).translate(0, 2.51, -1.4));
  shelterWood.push(new THREE.BoxGeometry(4.4, .12, .48).translate(0, .48, -.9));
  for (const x of [-1.55, 1.55]) shelterWood.push(new THREE.BoxGeometry(.13, .46, .36).translate(x, .23, -.9));
  mesh(merge(shelterWood), wood, 0, 0, 0, shelter).castShadow = true;
  const roofMaterial = mat({ color: 0x617968, metalness: .2, roughness: .78 });
  const roof = mesh(geom(new THREE.BoxGeometry(4.95, .1, 3.55)), roofMaterial, 0, 2.72, 0, shelter); roof.rotation.x = -.09; roof.castShadow = true;
  const roofRibs = []; for (let x = -2.35; x <= 2.35; x += .25) roofRibs.push(new THREE.BoxGeometry(.025, .04, 3.55).rotateX(-.09).translate(x, 2.79, 0));
  mesh(merge(roofRibs), darkMetal, 0, 0, 0, shelter);

  // Wooden trail sign at the pavilion (small environmental detail, not the HUD).
  const signMap = texture(512, (c, s) => {
    c.fillStyle = '#244237'; c.fillRect(0, 0, s, s); c.strokeStyle = '#c9bd8d'; c.lineWidth = 10; c.strokeRect(17, 17, s - 34, s - 34);
    c.textAlign = 'center'; c.fillStyle = '#f0dfae'; c.font = 'bold 61px system-ui'; c.fillText('GOLINGO', s / 2, 218); c.font = '29px system-ui'; c.fillText('FIELD RANGE', s / 2, 280); c.font = '20px system-ui'; c.fillText('TAKE A BREATH. TAKE AIM.', s / 2, 342);
  }); signMap.wrapS = signMap.wrapT = THREE.ClampToEdgeWrapping;
  const sign = mesh(geom(new THREE.BoxGeometry(1.5, .96, .08)), oldWood, 2.15, 1.82, 1.51, shelter);
  const signFront = mesh(geom(new THREE.PlaneGeometry(1.46, .92)), mat({ map: signMap, roughness: .8 }), 2.15, 1.82, 1.557, shelter);

  // Distant folded ridgelines, with separate limestone/snow caps at the summits.
  const mountainMaterial = mat({ color: 0x78928e, roughness: 1, flatShading: true });
  const farMountainMaterial = mat({ color: 0xa5b7b0, roughness: 1, flatShading: true });
  const snowMaterial = mat({ color: 0xe2e7d9, roughness: 1, flatShading: true });
  const mountainParts = [], farParts = [], capParts = [];
  for (let i = 0; i < 12; i++) {
    const x = -95 + i * 17.5, z = -95 - rand(0, 15), height = rand(17, 31), radius = rand(15, 23);
    const mountain = new THREE.ConeGeometry(radius, height, 6, 3); mountain.rotateY(rand(0, Math.PI)); mountain.scale(1.3, 1, .58); mountain.translate(x, height / 2 - 3, z); mountainParts.push(mountain);
    const capH = height * .28, cap = new THREE.ConeGeometry(radius * .28, capH, 6, 1); cap.rotateY(i * .42); cap.scale(1.3, 1, .58); cap.translate(x, height - capH / 2 - 2.95, z); capParts.push(cap);
    const far = new THREE.ConeGeometry(radius * 1.1, height + 8, 5, 2); far.rotateY(i); far.scale(1.35, 1, .65); far.translate(x + 9, (height + 8) / 2 - 4, z - 26); farParts.push(far);
  }
  mesh(merge(farParts), farMountainMaterial); mesh(merge(mountainParts), mountainMaterial); mesh(merge(capParts), snowMaterial);

  // Low-detail distant cloud puffs are real geometry, kept above the line of fire.
  const cloudParts = [];
  for (let i = 0; i < 6; i++) { const g = new THREE.IcosahedronGeometry(rand(1.8, 3.5), 1); g.scale(1.7, .45, 1); g.translate(i * 2.8 - 6, Math.sin(i * 1.7) * .4, Math.cos(i) * .8); cloudParts.push(g); }
  const cloudGeometry = merge(cloudParts), clouds = [];
  for (let i = 0; i < 7; i++) clouds.push({ x: -72 + i * 23, y: rand(25, 37), z: rand(-100, -62), s: rand(.9, 1.8), ry: rand(-.3, .3) });
  const cloudMaterial = mat({ color: 0xe9eddf, roughness: 1, flatShading: false });
  instances(cloudGeometry, cloudMaterial, clouds);

  if (!scene.fog) scene.fog = new THREE.Fog(0xc7d8c7, 38, 125);
  if (!scene.background) scene.background = new THREE.Color(0xc5d9df);

  return {
    group: world, targets,
    update(time) { windTime.value = time; },
    dispose() {
      world.removeFromParent();
      for (const g of new Set(geometries)) g.dispose();
      for (const m of new Set(materials)) m.dispose();
      for (const t of new Set(textures)) t.dispose();
    }
  };
}
