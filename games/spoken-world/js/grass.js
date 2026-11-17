/* Spoken World — grass as a meadow.
   What makes grass read as grass is not the triangle but the mass: thin curved blades growing in tufts, dark at the root and light at
   the tip, taking the colour of the ground they stand on, and moving together when a gust crosses them. So:
   · a tuft is five curved blades (three wide ones further off); tufts are planted cell by cell and a cell always grows the same tufts;
   · every blade is lit as the ground is lit and tinted from the same lawn map, so the meadow and the ground are one surface;
   · grass is short where people live (near anything built) and grows knee-high where nobody mows — the rule is the world's, not the town's;
   · wind is a wave travelling over the field, not each blade wagging by itself; flowers are flowers, on stems, in drifts of one kind.
   Nothing grows on roads, paving, fields, water, under buildings or under things lying flat on the ground. */
(function () {
  'use strict';
  const YX = window.YX, W = YX.world, THREE = window.THREE; let T3 = null, tick = null;
  if (!THREE || !THREE.InstancedBufferGeometry) return;
  const outer0 = YX.onFrame; YX.onFrame = function (dt) { if (outer0) outer0(dt); if (!tick && YX.three && YX.three.scene) { T3 = YX.three; try { tick = start(); } catch (e) { console.warn('grass', e); tick = () => {}; } } if (tick) tick(dt); }; // the scene may not exist yet when this file loads
  function start() {
  const CELL = 6, NEAR = 16, CLOSE = 8, XTRA = 2.6, REACH = 62, FAR0 = 0.5, MAXN = 30000, MAXFAR = 30000, MAXF = 7000;
  let DN = 20, low = false; // tufts per square metre close by
  const lawn = YX.lawn || {}, blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat); blank.needsUpdate = true;
  const uni = { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uGrow: { value: 1 }, uWind: { value: 1 }, uBase: { value: new THREE.Color(0.14, 0.33, 0.1) }, lawnMap: { value: lawn.map || blank }, lawnK: lawn.k || { value: 0 } };

  /* ---------- the shapes ---------- */
  // rows: [height along the blade 0…1, width there 1…0]; the last row is the tip
  function tuft(nb, rows, wid, seed, max) {
    const R = YX.rng(seed), P = [], N = [], L = [], I = [];
    for (let b = 0; b < nb; b++) {
      const a = (b / nb) * 6.283 + R() * 1.1, rr = 0.012 + R() * 0.05, rx = Math.cos(a) * rr, rz = Math.sin(a) * rr, la = a + (R() - 0.5) * 1.4, lean = b === 0 ? 0.08 : 0.14 + R() * 0.42, lx = Math.cos(la), lz = Math.sin(la), ax = -lz, az = lx, hb = b === 0 ? 1 : 0.55 + R() * 0.42, rnd = R(), base = P.length / 3;
      for (const row of rows) { const t = row[0], k = row[1]; for (const s of k === 0 ? [0] : [-1, 1]) { P.push(rx + ax * s * wid * 0.5 * k, t * hb, rz + az * s * wid * 0.5 * k); N.push(lx, 0, lz); L.push(lx * lean * t * t * hb, lz * lean * t * t * hb, t, rnd); } }
      for (let r = 0; r < rows.length - 2; r++) { const q = base + r * 2; I.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); } const q = base + (rows.length - 2) * 2; I.push(q, q + 1, q + 2);
    }
    const g = new THREE.InstancedBufferGeometry(); g.setIndex(I); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('aL', new THREE.Float32BufferAttribute(L, 4));
    g.setAttribute('aA', new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aB', new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage)); g.instanceCount = 0; return g;
  }
  const WIND = '\tfloat gust = sin( dot( gRoot, vec2( 0.115, 0.07 ) ) - uTime * 1.15 ) * 0.5 + 0.5;\n\tgust *= 0.55 + 0.45 * sin( dot( gRoot, vec2( -0.043, 0.061 ) ) + uTime * 0.33 );\n\tvec2 gw = ( vec2( 0.86, 0.5 ) * ( 0.07 + 0.36 * gust ) + vec2( sin( uTime * 2.7 + gRnd * 31.0 ), cos( uTime * 2.2 + gRnd * 17.0 ) ) * 0.035 ) * uWind;\n\tfloat gb = gT * gT * gH;\n\tgp.xz += gw * gb;\n\tgp.y -= dot( gw, gw ) * gb * 0.6;\n';
  const PARS_V = '#include <common>\nattribute vec4 aA;\nattribute vec4 aB;\nuniform float uTime;\nuniform float uGrow;\nuniform float uWind;\nuniform vec4 uFade;\nuniform vec3 uCam;\nvarying vec2 vLawnUv;\nvarying vec3 vK;', PARS_F = '#include <common>\nuniform sampler2D lawnMap;\nuniform float lawnK;\nuniform vec3 uBase;\nvarying vec2 vLawnUv;\nvarying vec3 vK;';
  const LAWN = '\tvec4 lawn = texture2D( lawnMap, vLawnUv );\n\tvec3 gBase = mix( uBase, pow( lawn.rgb, vec3( 2.2 ) ), clamp( lawn.a * 0.6 * lawnK, 0.0, 1.0 ) );\n';
  const oneSide = (f) => f.replace('( gl_FrontFacing ) ? vIndirectFront : vIndirectBack', 'vIndirectFront').replace('( gl_FrontFacing ) ? vLightFront : vLightBack', 'vLightFront'); // a blade is lit the same from both sides, as the ground under it is
  const bladeMat = (fade) => { const m = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }); m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, uni, { uFade: { value: fade } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', PARS_V + '\nattribute vec4 aL;').replace('#include <begin_vertex>',
      '\tfloat gT = aL.z, gRnd = aB.y + aL.w * 0.37;\n\tfloat gc = cos( aA.z ), gs = sin( aA.z );\n\tvec2 gRoot = aA.xy;\n\tfloat gD = distance( gRoot, uCam.xz );\n\tfloat gFade = smoothstep( uFade.x, uFade.y, gD ) * ( 1.0 - smoothstep( uFade.z, uFade.w, gD ) ) * mix( 1.0, 1.0 - smoothstep( ' + (CLOSE - 2.5).toFixed(1) + ', ' + CLOSE.toFixed(1) + ', gD ), step( aB.w, 0.0 ) );\n\tfloat gH = aA.w * uGrow * gFade;\n\tvec2 gl = position.xz * aB.x * abs( aB.w ) + aL.xy * gH;\n\tvec3 gp = vec3( gRoot.x + gl.x * gc + gl.y * gs, position.y * gH, gRoot.y - gl.x * gs + gl.y * gc );\n' + WIND +
      '\tvec3 transformed = gp;\n\ttransformedNormal = normalMatrix * normalize( vec3( ( normal.x * gc + normal.z * gs ) * 0.4, 1.0, ( -normal.x * gs + normal.z * gc ) * 0.4 ) );\n\tvLawnUv = vec2( gRoot.x / 3200.0 + 0.5, -gRoot.y / 3200.0 + 0.5 ) * 9.0;\n\tfloat gFar = smoothstep( 20.0, 52.0, gD );\n\tvK = vec3( mix( mix( 0.4, 1.32, gT ) * ( 0.9 + 0.2 * aL.w ) + gust * gT * 0.16 * uWind, 1.0, gFar ), gT * gT * ( 0.1 + 0.9 * aB.z ) * smoothstep( 0.3, 1.0, uGrow ) * ( 1.0 - gFar ), 0.0 );');
    sh.fragmentShader = oneSide(sh.fragmentShader.replace('#include <common>', PARS_F).replace('#include <color_fragment>', LAWN + '\tdiffuseColor.rgb = gBase * vK.x * mix( vec3( 1.0 ), vec3( 1.42, 1.16, 0.42 ), vK.y );')); }; return m; };
  const nearG = tuft(5, [[0, 1], [0.4, 0.86], [0.75, 0.56], [1, 0]], 0.024, 31, MAXN), farG = tuft(3, [[0, 1], [0.52, 0.8], [1, 0]], 0.05, 47, MAXFAR);
  const mesh = (g, m) => { const o = new THREE.Mesh(g, m); o.frustumCulled = false; o.receiveShadow = true; o.castShadow = false; o.matrixAutoUpdate = false; T3.scene.add(o); return o; };
  const blades = mesh(nearG, bladeMat(new THREE.Vector4(-2, -1, NEAR - 2, NEAR + 1))), far = mesh(farG, bladeMat(new THREE.Vector4(NEAR - 3, NEAR, REACH - 14, REACH - 1)));

  // a flower: a stem, six petals a little cupped and tipped to one side, and a heart
  const flowerG = new THREE.InstancedBufferGeometry();
  { const P = [-0.5, 0, 0, 0.5, 0, 0, -0.5, 1, 0, 0.5, 1, 0], K = [0, 0, 0, 0], I = [0, 1, 2, 1, 3, 2], ct = Math.cos(0.5), st = Math.sin(0.5), put = (x, y, z, k) => { P.push(x, y * ct - z * st, y * st + z * ct); K.push(k); return P.length / 3 - 1; };
    const c0 = put(0, 0.02, 0, 1); for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283, l = put(Math.cos(a - 0.44) * 0.6, 0.15, Math.sin(a - 0.44) * 0.6, 1), t = put(Math.cos(a), 0.3, Math.sin(a), 1), r = put(Math.cos(a + 0.44) * 0.6, 0.15, Math.sin(a + 0.44) * 0.6, 1); I.push(c0, l, t, c0, t, r); }
    const h0 = put(0, 0.2, 0, 2), ring = []; for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283 + 0.5; ring.push(put(Math.cos(a) * 0.3, 0.1, Math.sin(a) * 0.3, 2)); } for (let i = 0; i < 6; i++) I.push(h0, ring[i], ring[(i + 1) % 6]);
    flowerG.setIndex(I); flowerG.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); flowerG.setAttribute('aK', new THREE.Float32BufferAttribute(K, 1)); const N = []; for (let i = 0; i < K.length; i++) N.push(0, 1, 0); flowerG.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    for (const [n, k] of [['aA', 4], ['aB', 4], ['aC', 3]]) flowerG.setAttribute(n, new THREE.InstancedBufferAttribute(new Float32Array(MAXF * k), k).setUsage(THREE.DynamicDrawUsage)); flowerG.instanceCount = 0; }
  const flowerM = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }); flowerM.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, uni, { uFade: { value: new THREE.Vector4(0, 0, 30, 46) } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', PARS_V + '\nattribute vec3 aC;\nattribute float aK;\nvarying vec3 vFC;').replace('#include <begin_vertex>',
      '\tfloat head = step( 0.5, aK ), gRnd = aB.y;\n\tfloat gT = mix( position.y, 1.0, head );\n\tfloat gc = cos( aA.z ), gs = sin( aA.z );\n\tvec2 gRoot = aA.xy;\n\tfloat gD = distance( gRoot, uCam.xz );\n\tfloat gFade = ( 1.0 - smoothstep( uFade.z, uFade.w, gD ) ) * uGrow;\n\tfloat gH = aA.w * gFade, gS = aB.x * ( 1.0 + gD * 0.045 ) * gFade;\n\tvec2 gl = mix( vec2( position.x * 0.009, 0.0 ), position.xz * gS, head );\n\tvec3 gp = vec3( gRoot.x + gl.x * gc + gl.y * gs, mix( position.y * gH, gH + position.y * gS, head ), gRoot.y - gl.x * gs + gl.y * gc );\n' + WIND +
      '\tvec3 transformed = gp;\n\ttransformedNormal = normalMatrix * vec3( 0.0, 1.0, 0.0 );\n\tvLawnUv = vec2( gRoot.x / 3200.0 + 0.5, -gRoot.y / 3200.0 + 0.5 ) * 9.0;\n\tvK = vec3( head, 0.0, 0.0 );\n\tvFC = aK > 1.5 ? mix( vec3( 1.0, 0.72, 0.07 ), vec3( 0.07, 0.05, 0.04 ), aB.z ) : aC;');
    sh.fragmentShader = oneSide(sh.fragmentShader.replace('#include <common>', PARS_F + '\nvarying vec3 vFC;').replace('#include <color_fragment>', LAWN + '\tdiffuseColor.rgb = mix( gBase * 0.8, vFC, vK.x );')); };
  const flowerMesh = mesh(flowerG, flowerM);

  /* ---------- where nothing grows, and where nobody mows ---------- */
  let covers = [], tamers = []; const wildC = new Map();
  function readCovers() {
    covers = []; tamers = []; wildC.clear();
    for (const o of W.objs.values()) {
      if (o.dead || !o.foot) continue; const d = YX.defOf(o); if (!d || d.cls === 'sky' || d.cls === 'creature' || o.y > 0.6) continue;
      const fx = (o.foot[0] || 0) / 2, fz = (o.foot[1] || 0) / 2, c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0); let hx = fx, hz = fz, round = 0, cover = true;
      if (d.cls !== 'nature' && !(o.attach && o.attach.anchor && o.attach.anchor !== 'floor')) tamers.push({ x: o.x, z: o.z, c, s, hx: fx, hz: fz + (o.type === 'road' && o.params.sidewalk !== false ? 2.9 : 0) }); // whatever people put down, they keep the grass short round it
      if (o.type === 'road') hz += o.params.sidewalk === false ? 0.3 : 2.9; else if (o.type === 'pond') round = o.params.size * o.s[0] * 1.12; else if (o.type === 'hill') round = Math.max(hx, hz) * 0.94; else if (o.type === 'plaza' && o.params.shape !== 'square') round = o.params.size * o.s[0] + 0.3; else if (o.type === 'fountain' || o.type === 'well' || o.type === 'silo') round = Math.max(hx, hz) + 0.15;
      else if (d.cls === 'ground' || d.cls === 'building' || o.type === 'gazebo') { hx += 0.25; hz += 0.25; } else if (o.type === 'field' || o.type === 'sandbox') { hx += 0.2; hz += 0.2; }
      else if (!o.attach && o.size && o.size[1] < 0.3 && hx * hz > 0.08 && d.cls !== 'nature') { hx += 0.04; hz += 0.04; } // a rug, a blanket, a mat: lying on the grass, not in it
      else if (d.cls === 'furniture' || o.attach) cover = false; else if (d.solid === 'box' && hx * hz > 0.5) { hx += 0.05; hz += 0.05; } else cover = false;
      if (cover) covers.push({ x: o.x, z: o.z, c, s, hx, hz, round, R: round || Math.hypot(hx, hz) });
    }
    let sig = covers.length * 7919 + tamers.length; for (const L of [covers, tamers]) for (const k of L) sig = (Math.imul(sig, 31) + Math.round(k.x * 20) * 3 + Math.round(k.z * 20) * 5 + Math.round(k.hx * 20) * 7 + Math.round(k.hz * 20) * 11 + Math.round((k.round || 0) * 20) * 13 + Math.round(k.c * 100) * 17 + Math.round(k.s * 100) * 19) | 0;
    return sig; // what the lawn has to grow round, as one number: only when this changes is there anything to plant again
  }
  const hit = (list, x, z) => { for (const k of list) { const dx = x - k.x, dz = z - k.z; if (k.round) { if (dx * dx + dz * dz < k.round * k.round) return true; continue; } if (Math.abs(dx) > k.R || Math.abs(dz) > k.R) continue; const lx = dx * k.c - dz * k.s, lz = dx * k.s + dz * k.c; if (Math.abs(lx) < k.hx && Math.abs(lz) < k.hz) return true; } return false; };
  const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function wildCorner(i, j) { const key = i + ',' + j; let v = wildC.get(key); if (v !== undefined) return v; const x = i * CELL, z = j * CELL; let best = 1e9;
    for (const k of tamers) { const dx = x - k.x, dz = z - k.z, lx = Math.abs(dx * k.c - dz * k.s) - k.hx, lz = Math.abs(dx * k.s + dz * k.c) - k.hz, d = Math.hypot(Math.max(lx, 0), Math.max(lz, 0)); if (d < best) { best = d; if (d < 4) break; } }
    v = sstep(5, 30, best); wildC.set(key, v); return v; }
  const hsh = (i, j) => { let n = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const noise = (x, z) => { const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v); return (hsh(i, j) * (1 - a) + hsh(i + 1, j) * a) * (1 - b) + (hsh(i, j + 1) * (1 - a) + hsh(i + 1, j + 1) * a) * b; };

  /* ---------- planting ---------- */
  const cells = new Map(); // "i,j" -> { t: tufts [x, z, yaw, h, w, rnd, tint, rank]…, f: flowers [x, z, yaw, stem, size, rnd, heart, r, g, b]… }
  const KINDS = [[0.95, 0.95, 0.9, 0, 0.03], [1, 0.74, 0.08, 0, 0.026], [0.92, 0.36, 0.56, 0, 0.032], [0.45, 0.28, 0.78, 0, 0.028], [0.86, 0.07, 0.04, 1, 0.042], [0.2, 0.36, 0.9, 0, 0.026]]; // daisy, buttercup, pink, violet, poppy, cornflower: r g b, dark heart, size
  function plant(i, j) {
    const R = YX.rng(((i * 73856093) ^ (j * 19349663)) >>> 0 || 7), x0 = i * CELL, z0 = j * CELL, near = covers.filter((k) => Math.abs(k.x - x0 - CELL / 2) < k.R + CELL && Math.abs(k.z - z0 - CELL / 2) < k.R + CELL);
    const w00 = wildCorner(i, j), w10 = wildCorner(i + 1, j), w01 = wildCorner(i, j + 1), w11 = wildCorner(i + 1, j + 1), wild = (x, z) => { const u = (x - x0) / CELL, v = (z - z0) / CELL; return (w00 * (1 - u) + w10 * u) * (1 - v) + (w01 * (1 - u) + w11 * u) * v; }, f = [];
    const wl = wild(x0 + CELL / 2, z0 + CELL / 2), drift = R() < 0.14 + wl * 0.4, nf = drift ? Math.round((4 + R() * 9) * (1 + wl * 2.4)) : R() < 0.35 ? 1 + Math.floor(R() * 2) : 0, kind = KINDS[Math.floor(R() * (wl > 0.3 ? KINDS.length : 2))], cx = x0 + R() * CELL, cz = z0 + R() * CELL, spread = 2.4 + wl * 3;
    for (let k = 0; k < nf; k++) { const x = cx + (R() - 0.5) * spread, z = cz + (R() - 0.5) * spread, q = R() < 0.82 ? kind : KINDS[Math.floor(R() * KINDS.length)], w2 = wild(Math.max(x0, Math.min(x0 + CELL, x)), Math.max(z0, Math.min(z0 + CELL, z))), stem = (0.1 + R() * 0.05) * (1 - w2) + (0.3 + R() * 0.26) * w2, yaw = R() * 6.283, sz = q[4] * (0.8 + R() * 0.5), rnd = R(); if (near.length && hit(near, x, z)) continue;
      f.push(x, z, yaw, stem, sz, rnd, q[3], q[0], q[1], q[2]); }
    return { R, x0, z0, near, wild, k: 0, t: [], f: new Float32Array(f) };
  }
  // a cell grows its tufts in a fixed order and only as many as are asked for: a far cell needs a handful, the one under your feet all of them
  function grow(c, upto) { const R = c.R, N = Math.round(DN * CELL * CELL), t = c.t, near = c.near;
    for (; c.k < upto; c.k++) { const x = c.x0 + R() * CELL, z = c.z0 + R() * CELL, yaw = R() * 6.283, r1 = R(), r2 = R(), rnd = R(); if (near.length && hit(near, x, z)) continue;
      const wl = c.wild(x, z), clump = noise(x * 0.42, z * 0.42), h = ((0.075 + r1 * 0.075) * (1 - wl) + (0.2 + r1 * r2 * 0.34) * wl) * (0.72 + clump * 0.6);
      t.push(x, z, yaw, h, 0.85 + r2 * 0.5, rnd, noise(x * 0.09 + 31.7, z * 0.09 + 11.3) * 0.8 + rnd * 0.2, c.k / N); } }
  let fx = 1e9, fz = 1e9, fdx = 0, fdz = -1, dirty = true, wait = 0, snow = 0, shown = true, sig0 = null;
  const look = () => { const e = T3.camera.matrixWorld.elements; let x = -e[8], z = -e[10], l = Math.hypot(x, z); if (l < 0.3) { x = e[4]; z = e[6]; l = Math.hypot(x, z) || 1; } return [x / l, z / l]; }; // which way the camera faces over the ground; looking straight down, the top of the picture
  function fill() {
    const cam = T3.camera, C = cam.position, px = C.x, pz = C.z, i0 = Math.floor(px / CELL), j0 = Math.floor(pz / CELL), rc = Math.ceil(REACH / CELL) + 1, N = Math.round(DN * CELL * CELL), fw = look();
    const half = Math.min(3.1, Math.atan(Math.tan(((cam.fov || 60) * Math.PI) / 360) * (cam.aspect || 1.6)) + 0.5), cosH = Math.cos(half); // what is drawn is what the camera can see, and a turn's worth to either side
    const NA = nearG.attributes.aA.array, NB = nearG.attributes.aB.array, FA = farG.attributes.aA.array, FB = farG.attributes.aB.array, LA = flowerG.attributes.aA.array, LB = flowerG.attributes.aB.array, LC = flowerG.attributes.aC.array; let n = 0, m = 0, nf = 0;
    for (const key of Array.from(cells.keys())) { const q = key.split(','); if (Math.abs(+q[0] - i0) > rc + 2 || Math.abs(+q[1] - j0) > rc + 2) cells.delete(key); }
    const rn = (NEAR + 3.5) * (NEAR + 3.5), rx = (CLOSE + 2.5) * (CLOSE + 2.5), rf0 = (NEAR - 5.5) * (NEAR - 5.5);
    for (let i = i0 - rc; i <= i0 + rc; i++) for (let j = j0 - rc; j <= j0 + rc; j++) {
      const vx = (i + 0.5) * CELL - px, vz = (j + 0.5) * CELL - pz, d = Math.hypot(vx, vz); if (d - 4.3 > REACH || (d > 9 && vx * fw[0] + vz * fw[1] < d * cosH - 5)) continue;
      const key = i + ',' + j; let c = cells.get(key); if (!c) { c = plant(i, j); cells.set(key, c); } const T = c.t;
      if (d - 4.3 < NEAR + 3.5) { const close = !low && d - 4.3 < CLOSE + 2.5; grow(c, close ? Math.round(N * XTRA) : N);
        for (let o = 0; o < T.length && n < MAXN; o += 8) { const dx = T[o] - px, dz = T[o + 1] - pz, q = dx * dx + dz * dz, more = T[o + 7] >= 1; if (more) { if (!close) break; if (q > rx) continue; } else if (q > rn) continue;
          const a = n * 4; NA[a] = T[o]; NA[a + 1] = T[o + 1]; NA[a + 2] = T[o + 2]; NA[a + 3] = T[o + 3]; NB[a] = T[o + 4]; NB[a + 1] = T[o + 5]; NB[a + 2] = T[o + 6]; NB[a + 3] = more ? -1 : 1; n++; } }
      if (d + 4.3 > NEAR - 5.5) { const keep = FAR0 * (d <= NEAR ? 1 : Math.max(0.05, Math.pow(1 - (d - NEAR) / (REACH - NEAR), 1.7))), wide = Math.min(3.4, Math.sqrt(FAR0 / keep)), tall = 1 + (wide - 1) * 0.16; grow(c, Math.ceil(keep * N)); // further off: fewer tufts, each a little broader — the same green for far fewer triangles
        for (let o = 0; o < T.length && m < MAXFAR; o += 8) { if (T[o + 7] > keep) break; const dx = T[o] - px, dz = T[o + 1] - pz; if (dx * dx + dz * dz < rf0) continue; const a = m * 4; FA[a] = T[o]; FA[a + 1] = T[o + 1]; FA[a + 2] = T[o + 2]; FA[a + 3] = T[o + 3] * tall; FB[a] = T[o + 4]; FB[a + 1] = T[o + 5]; FB[a + 2] = T[o + 6]; FB[a + 3] = wide; m++; } }
      if (d - 4.3 < 48) { const F = c.f; for (let k = 0; k < F.length / 10 && nf < MAXF; k++) { const o = k * 10, a = nf * 4; LA[a] = F[o]; LA[a + 1] = F[o + 1]; LA[a + 2] = F[o + 2]; LA[a + 3] = F[o + 3]; LB[a] = F[o + 4]; LB[a + 1] = F[o + 5]; LB[a + 2] = F[o + 6]; LB[a + 3] = 0; LC[nf * 3] = F[o + 7]; LC[nf * 3 + 1] = F[o + 8]; LC[nf * 3 + 2] = F[o + 9]; nf++; } }
    }
    const up = (g, names, cnt) => { for (const nm of names) { const at = g.attributes[nm]; at.updateRange.offset = 0; at.updateRange.count = cnt * at.itemSize; at.needsUpdate = true; } g.instanceCount = cnt; };
    up(nearG, ['aA', 'aB'], n); up(farG, ['aA', 'aB'], m); up(flowerG, ['aA', 'aB', 'aC'], nf); fx = px; fz = pz; fdx = fw[0]; fdz = fw[1];
  }
  const dirty0 = YX.markDirty; YX.markDirty = function () { dirty = true; return dirty0.apply(this, arguments); };
  const q0 = YX.setQuality; if (q0) YX.setQuality = function (q) { low = q === 'low'; DN = low ? 8 : 20; cells.clear(); dirty = true; return q0.apply(this, arguments); };
  const WINDS = { clear: 1, cloudy: 1.25, rain: 1.7, storm: 2.5, snow: 0.6, fog: 0.5 };
  YX.grass = { detail(k) { low = k > 0 || (YX.quality && YX.quality() === 'low'); DN = low ? (k > 1 || k === 0 ? 8 : 12) : 20; cells.clear(); dirty = true; wait = 0; }, blades, far, flowerMesh, flowers: { get count() { return flowerG.instanceCount; } }, replant: () => { dirty = true; wait = 0; sig0 = null; }, count: () => nearG.instanceCount + farG.instanceCount, parts: () => [nearG.instanceCount, farG.instanceCount, flowerG.instanceCount] };
  return function (dt) {
    dt = dt || 0.016; uni.uTime.value += dt;
    const isLawn = W.env.ground === 'grass', sn = W.env.weather === 'snow' ? 1 : 0; snow += (sn - snow) * Math.min(1, dt * 0.7); uni.uGrow.value = 1 - snow * 0.82; uni.uWind.value += ((WINDS[W.env.weather] || 1) - uni.uWind.value) * Math.min(1, dt * 0.5);
    const on = isLawn && !(YX.isClay && YX.isClay()); if (on !== shown) { shown = on; blades.visible = far.visible = flowerMesh.visible = on; } if (lawn.near) lawn.near.value = on ? uni.uGrow.value : 0; if (!on) return;
    if (lawn.ground) uni.uBase.value.copy(lawn.ground.material.color).multiplyScalar(0.8); if (lawn.cam) lawn.cam.value.copy(T3.camera.position);
    wait -= dt; const C = T3.camera.position, dx = C.x - fx, dz = C.z - fz; uni.uCam.value.copy(C); // a Lambert material is not told where the camera is, so the grass is
    if (dirty && wait <= 0) { dirty = false; wait = 0.7; const sg = readCovers(); if (sg !== sig0 || !cells.size) { sig0 = sg; cells.clear(); fill(); } } // the world changed: plant again, but only if what stands on the lawn did (somebody stopping to talk, a car pulling away, a door opening change nothing here)
    else { const fw = look(); if (dx * dx + dz * dz > 5 || fw[0] * fdx + fw[1] * fdz < 0.955) fill(); }
  };
  }
})();
