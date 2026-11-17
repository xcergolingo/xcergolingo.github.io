/* 言出法随 · world: renderer, sky/light/weather, object store, placement, motion, player, aim, fx, persistence */
'use strict';
(function () {
  const YX = window.YX, G = YX.GEN, DEG = YX.DEG, clamp = YX.clamp, lerp = YX.lerp, smooth = YX.smooth, L = (c) => YX.lin(c);
  const W = (YX.world = {
    objs: new Map(), nextId: 1, shots: [], aim: null, aimPoint: [0, 0], focusId: null, grabbed: null, time: 0, group: [], people: [],
    env: { time: 15.6, weather: 'clear', flow: 0, ground: 'grass', light: 'normal', az: 0, look: 'none', gravity: 1 }, // gravity: a rule of the world kept as a setting (1 = as on Earth, 0 = none): saved, undone and spoken like the weather
    player: { x: 20, y: 1.7, z: -6.4, yaw: Math.PI, pitch: -0.02, vx: 0, vz: 0, fly: false, lens: 0 },
  });
  YX.custom = {};
  YX.input = { f: 0, b: 0, l: 0, r: 0, up: 0, down: 0, run: 0, tl: 0, tr: 0 };
  YX.sfx = YX.sfx || function () {};
  YX.onChange = YX.onChange || function () {};
  let renderer, scene, camera, sun, hemi, amb, sky, stars, moon, ground, hills, rain, snow, aimBox, clayMat, patches = null;
  const lightPool = [];
  const cur = { time: 15.6, cloud: 0, rain: 0, snow: 0, fog: 0, gcol: L('#6fa35a').slice(), night: 0 };
  let clay = false, quality = 'high', roadsCache = null, dirtyTimer = null;
  const sunDir = new THREE.Vector3(0, 1, 0);

  /* ================= init ================= */
  YX.initWorld = function (canvas) {
    YX.initCore();
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
    renderer.info.autoReset = false; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
    scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0xbcd6ee, 0.0022);
    camera = new THREE.PerspectiveCamera(62, 1, 0.25, 1700); camera.rotation.order = 'YXZ'; camera.layers.enableAll();
    YX.three = { renderer, scene, camera };
    // lights
    sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
    const sc = sun.shadow.camera; sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75; sc.near = 1; sc.far = 520;
    scene.add(sun); scene.add(sun.target);
    hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6); scene.add(hemi);
    amb = new THREE.AmbientLight(0xffffff, 0.1); scene.add(amb);
    for (let i = 0; i < 6; i++) { const pl = new THREE.PointLight(0xffd9a0, 0, 20, 2); pl.position.set(0, -50, 0); scene.add(pl); lightPool.push(pl); }
    for (const l of [sun, hemi, amb, ...lightPool]) l.layers.enableAll();
    // sky dome
    sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 bot; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vDir;\nvoid main(){ vec3 d = normalize(vDir); float h = d.y; vec3 c = mix(hor, top, pow(max(h,0.0), 0.5)); if (h < 0.0) c = mix(hor, bot, pow(min(-h*5.0,1.0), 0.7)); float s = max(dot(d, normalize(sunDir)), 0.0); c += sunCol * (pow(s, 900.0)*4.0 + pow(s, 40.0)*0.35 + pow(s, 5.0)*0.12); gl_FragColor = vec4(c, 1.0);\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}',
    }));
    sky.frustumCulled = false; sky.renderOrder = -10; sky.layers.set(1); scene.add(sky);
    { const n = 1400, p = new Float32Array(n * 3), R = YX.rng(77); for (let i = 0; i < n; i++) { const u = R() * 2 - 1, a = R() * 6.283, r = Math.sqrt(1 - u * u); p[i * 3] = Math.cos(a) * r * 1300; p[i * 3 + 1] = Math.abs(u) * 1300 + 20; p[i * 3 + 2] = Math.sin(a) * r * 1300; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); stars.frustumCulled = false; stars.layers.set(1); scene.add(stars); }
    moon = new THREE.Mesh(new THREE.SphereGeometry(26, 20, 14), new THREE.MeshBasicMaterial({ color: 0xf3f0df, fog: false, transparent: true, opacity: 0 })); moon.layers.set(1); scene.add(moon);
    // ground + hills
    const gt = YX.TEX.grass.clone(); gt.needsUpdate = true; gt.repeat.set(180, 180);
    const st = YX.TEX.sand.clone(); st.needsUpdate = true; st.repeat.set(240, 240);
    // The ground is a mesh of modest squares, never two triangles three kilometres long: across a triangle that large a renderer cannot keep depth exact, and whatever lies on the earth
    // (a path, a road, a rug, the foot of a wall) then flickers against it as the camera moves. Twelve metres a square where anyone lives, a hundred beyond.
    const groundGeom = () => { const xs = []; for (let x = -1600; x < -600; x += 100) xs.push(x); for (let x = -600; x < 600; x += 12) xs.push(x); for (let x = 600; x <= 1600; x += 100) xs.push(x);
      const n = xs.length, P = new Float32Array(n * n * 3), N = new Float32Array(n * n * 3), U = new Float32Array(n * n * 2), I = new Uint32Array((n - 1) * (n - 1) * 6); let k = 0;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const v = j * n + i; P[v * 3] = xs[i]; P[v * 3 + 2] = xs[j]; N[v * 3 + 1] = 1; U[v * 2] = xs[i] / 3200 + 0.5; U[v * 2 + 1] = 0.5 - xs[j] / 3200; }
      for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + 1, c = a + n, d = c + 1; I[k++] = a; I[k++] = c; I[k++] = b; I[k++] = b; I[k++] = c; I[k++] = d; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.setIndex(new THREE.BufferAttribute(I, 1)); return g; };
    ground = new THREE.Mesh(groundGeom(), new THREE.MeshStandardMaterial({ map: gt, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 4 })); // the ground yields in depth to whatever lies on it: a road, a path or a rug never flickers against the earth beneath, from any height
    ground.userData.gt = gt; ground.userData.st = st; ground.receiveShadow = true; scene.add(ground);
    { // the lawn is not one colour: broad patches of deeper and sunnier green are mixed into it, the way a meadow looks from a hill
      const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), R = YX.rng(77);
      for (let i = 0; i < 110; i++) { const x = R() * S, y = R() * S, r = 16 + R() * 74, dark = R() < 0.56, c = dark ? '52,108,60' : '138,178,82', gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, 'rgba(' + c + ',' + (dark ? 0.34 : 0.26) + ')'); gr.addColorStop(1, 'rgba(' + c + ',0)'); g.fillStyle = gr; for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { g.setTransform(1, 0, 0, 1, x + dx, y + dy); g.fillRect(-r, -r, r * 2, r * 2); } }
      g.setTransform(1, 0, 0, 1, 0, 0); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.premultiplyAlpha = false;
      patches = { value: 1 }; // how strongly the patches show: 0 under snow or on bare ground
      const lawnCam = { value: new THREE.Vector3() }, lawnNear = { value: 0 }; YX.lawn = { map: t, k: patches, ground, cam: lawnCam, near: lawnNear }; // the grass blades take their colour from the same map, so meadow and ground are one surface
      ground.material.onBeforeCompile = (sh) => { sh.uniforms.lawnMap = { value: t }; sh.uniforms.lawnK = patches; sh.uniforms.lawnCam = lawnCam; sh.uniforms.lawnNear = lawnNear;
        sh.fragmentShader = sh.fragmentShader.replace('uniform vec3 diffuse;', 'uniform vec3 diffuse;\nuniform sampler2D lawnMap;\nuniform float lawnK;\nuniform vec3 lawnCam;\nuniform float lawnNear;\nfloat lawnH( vec2 p ) { p = fract( p * vec2( 0.1031, 0.1030 ) ); p += dot( p, p.yx + 33.33 ); return fract( ( p.x + p.y ) * p.x ); }\nfloat lawnN( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f ); return mix( mix( lawnH( i ), lawnH( i + vec2( 1.0, 0.0 ) ), f.x ), mix( lawnH( i + vec2( 0.0, 1.0 ) ), lawnH( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }').replace('#include <map_fragment>', '#include <map_fragment>\n\tvec4 lawn = texture2D( lawnMap, vUv / 20.0 );\n\tdiffuseColor.rgb = mix( diffuseColor.rgb, pow( lawn.rgb, vec3( 2.2 ) ), clamp( lawn.a * 0.6 * lawnK, 0.0, 1.0 ) );\n\tvec2 gxz = vec2( vUv.x / 180.0 - 0.5, 0.5 - vUv.y / 180.0 ) * 3200.0;\n\tfloat gd = distance( gxz, lawnCam.xz );\n\tfloat gh = mix( 0.5, lawnN( gxz * 19.0 ) * 0.6 + lawnN( gxz * 47.0 + 7.3 ) * 0.4, 1.0 - smoothstep( 3.0, 11.0, gd ) );\n\tdiffuseColor.rgb *= mix( 1.0, 0.5 + 0.3 * gh, ( 1.0 - smoothstep( 9.0, 30.0, gd ) ) * lawnNear * lawnK );'); };
    }
    { const seg = 96, rings = 10, P = [], C = [], idx = [], R = YX.rng(5);
      const hN = []; for (let i = 0; i < seg; i++) hN.push(R());
      for (let r = 0; r <= rings; r++) for (let i = 0; i <= seg; i++) { const a = (i / seg) * 6.283, rad = 230 + r * 62, k = Math.sin((r / rings) * Math.PI); const j = i % seg; const h = k * (26 + 60 * (0.5 + 0.5 * Math.sin(j * 0.39 + 1.3)) * (0.6 + 0.4 * Math.sin(j * 0.11)) + hN[j] * 22 + (r % 2) * 6); P.push(Math.cos(a) * rad, r === 0 ? -1 : h, Math.sin(a) * rad); const t = clamp(h / 90, 0, 1); C.push(0.2 + t * 0.12, 0.34 + t * 0.06, 0.2 + t * 0.14); }
      for (let r = 0; r < rings; r++) for (let i = 0; i < seg; i++) { const a = r * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(idx); const ng = g.toNonIndexed(); ng.computeVertexNormals();
      hills = new THREE.Mesh(ng, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })); scene.add(hills); }
    // weather particles
    { const n = 1500, p = new Float32Array(n * 6); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xb8cde0, transparent: true, opacity: 0, fog: false, depthWrite: false })); rain.frustumCulled = false; rain.layers.set(2); rain.userData.seed = Array.from({ length: n }, () => [Math.random(), Math.random(), Math.random()]); scene.add(rain); }
    { const n = 2200, p = new Float32Array(n * 3); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
      snow = new THREE.Points(g, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(c), size: 0.22, transparent: true, opacity: 0, depthWrite: false, fog: false })); snow.frustumCulled = false; snow.layers.set(2); snow.userData.seed = Array.from({ length: n }, () => [Math.random(), Math.random(), Math.random()]); scene.add(snow); }
    // aim box
    { const e = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)); aimBox = new THREE.LineSegments(e, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthTest: false, fog: false })); aimBox.matrixAutoUpdate = false; aimBox.visible = false; aimBox.renderOrder = 50; aimBox.layers.set(2); scene.add(aimBox); YX.edgeGeom = e; }
    clayMat = new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.92, metalness: 0 });
    YX.setGlow(0); YX.resize(); applyEnv(0, true);
  };
  YX.resize = function () {
    if (!renderer) return;
    const c = renderer.domElement, w = c.clientWidth || window.innerWidth, h = c.clientHeight || window.innerHeight;
    if (YX.film) { renderer.setSize(YX.film[0], YX.film[1], false); camera.aspect = YX.film[0] / YX.film[1]; camera.updateProjectionMatrix(); return; }
    renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  };
  /* while a clip is recorded the picture is exactly 16:9 at a fixed size, whatever the window is (the canvas letterboxes itself) */
  let filmPR = 0;
  YX.filmFrame = function (size) {
    if (size && !YX.film) { filmPR = renderer.getPixelRatio(); renderer.setPixelRatio(1); } else if (!size && YX.film && filmPR) renderer.setPixelRatio(filmPR);
    YX.film = size || null; document.body.classList.toggle('filming', !!size); YX.resize();
  };
  YX.quality = () => quality;
  YX.setQuality = function (q) { quality = q; renderer.setPixelRatio(q === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 2)); sun.shadow.mapSize.set(q === 'low' ? 1024 : 2048, q === 'low' ? 1024 : 2048); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } YX.resize(); };
  YX.setClay = function (on) { clay = !!on; return clay; };
  YX.isClay = () => clay;

  /* ================= environment ================= */
  const PAL = { zen: { n: L('#050915'), g: L('#3d4f8f'), d: L('#2f74d0') }, hor: { n: L('#141c33'), g: L('#f6a66c'), d: L('#b9d6ee') }, sun: { n: L('#7f9cff'), g: L('#ffb070'), d: L('#fff4e0') }, hs: { n: L('#27345c'), g: L('#c9b0a8'), d: L('#d6e6ff') }, hg: { n: L('#0d1016'), g: L('#4b4336'), d: L('#5f6a48') } };
  const tri = (p, a, b, c) => [p.n[0] * a + p.g[0] * b + p.d[0] * c, p.n[1] * a + p.g[1] * b + p.d[1] * c, p.n[2] * a + p.g[2] * b + p.d[2] * c];
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const GROUNDS = { grass: '#6ba64f', sand: '#d9c79a', snow: '#eef2f6', dirt: '#8a6f52', stone: '#9a9a94', dark: '#3d4347' };
  const WEATHERS = { clear: [0, 0, 0, 0], cloudy: [0.75, 0, 0, 0.05], rain: [0.95, 1, 0, 0.2], snow: [0.85, 0, 1, 0.3], fog: [0.6, 0, 0, 1], storm: [1, 1.6, 0, 0.35] };
  const TIMES = { dawn: 6.2, sunrise: 6.4, morning: 9, noon: 12, afternoon: 15.5, golden: 17.3, sunset: 18.1, dusk: 18.9, evening: 19.6, night: 22, midnight: 0 };
  const LOOKS = { none: '', warm: 'sepia(0.22) saturate(1.2) contrast(1.03)', cool: 'saturate(0.85) hue-rotate(-8deg) brightness(0.97) contrast(1.05)', noir: 'grayscale(1) contrast(1.25) brightness(0.95)', vivid: 'saturate(1.45) contrast(1.08)', faded: 'saturate(0.6) contrast(0.92) brightness(1.06)', dream: 'saturate(1.2) brightness(1.06) contrast(0.95) blur(0.4px)' };
  YX.TIMES = TIMES; YX.LOOKS = LOOKS; YX.WEATHERS = WEATHERS;
  let envTw = null;
  YX.setEnv = function (patch, opt) {
    const E = W.env, out = [];
    if (patch.time != null) { let t = typeof patch.time === 'string' && TIMES[patch.time.toLowerCase()] != null ? TIMES[patch.time.toLowerCase()] : +patch.time; if (isFinite(t)) { t = ((t % 24) + 24) % 24; E.time = t; out.push(YX.T('时间 ', 'Time ') + YX.clock(t)); } }
    if (patch.weather != null && WEATHERS[String(patch.weather).toLowerCase()]) { E.weather = String(patch.weather).toLowerCase(); out.push(YX.T('天气 ', 'Weather: ') + YX.wxName(E.weather)); }
    if (patch.gravity != null) { const g = typeof patch.gravity === 'string' ? { none: 0, zero: 0, off: 0, moon: 0.17, low: 0.17, normal: 1, earth: 1, on: 1, heavy: 2 }[patch.gravity.toLowerCase()] : +patch.gravity; if (g != null && isFinite(g)) { E.gravity = clamp(g, 0, 3); out.push(E.gravity === 0 ? YX.T('重力关掉了：抬起来的东西会停在空中', 'Gravity is off: what you lift stays in the air') : E.gravity === 1 ? YX.T('重力恢复正常', 'Gravity is back to normal') : YX.T('重力 ×', 'Gravity ×') + E.gravity); } }
    if (patch.flow != null) { E.flow = clamp(+patch.flow || 0, 0, 60); out.push(E.flow ? YX.T('时间开始流动', 'Time is flowing') : YX.T('时间静止', 'Time stopped')); }
    if (patch.ground != null && GROUNDS[String(patch.ground).toLowerCase()]) { E.ground = String(patch.ground).toLowerCase(); out.push(YX.T('地面 ', 'Ground: ') + E.ground); }
    if (patch.light != null && ['soft', 'normal', 'hard'].includes(String(patch.light))) { E.light = String(patch.light); out.push(YX.T('光线 ' + ({ soft: '柔和', normal: '自然', hard: '硬朗' })[E.light], E.light.charAt(0).toUpperCase() + E.light.slice(1) + ' light')); }
    if (patch.look != null && LOOKS[String(patch.look).toLowerCase()] != null) { E.look = String(patch.look).toLowerCase(); renderer.domElement.style.filter = LOOKS[E.look]; out.push(YX.T('影调 ', 'Look: ') + E.look); }
    if (patch.az != null && isFinite(+patch.az)) { E.az = +patch.az; out.push(YX.T('调整光线方向', 'Light direction changed')); }
    if (patch.lightFrom) {
      const v = YX.viewNow(), side = String(patch.lightFrom).toLowerCase();
      let hx = v.fx, hz = v.fz; if (side === 'left') { hx = -v.rx; hz = -v.rz; } else if (side === 'right') { hx = v.rx; hz = v.rz; } else if (side === 'back' || side === 'behind') { hx = -v.fx; hz = -v.fz; }
      const a = ((cur.time - 6) / 12) * Math.PI, bx = Math.cos(a) * 0.85, bz = -0.42;
      E.az = (Math.atan2(hz, hx) - Math.atan2(bz, bx)) / DEG; out.push(YX.T('光从' + ({ left: '左侧', right: '右侧', front: '正前方（逆光）', back: '身后（顺光）', behind: '身后（顺光）' })[side] + '来', 'Light from ' + ({ left: 'the left', right: 'the right', front: 'ahead (backlit)', back: 'behind you', behind: 'behind you' })[side]));
    }
    const gTarget = L(E.weather === 'snow' ? YX.mixHex(GROUNDS[E.ground], '#f2f5f8', 0.7) : GROUNDS[E.ground]);
    if (opt && opt.instant) { if (envTw) envTw.kill(); cur.time = E.time; const w = WEATHERS[E.weather]; cur.cloud = w[0]; cur.rain = w[1]; cur.snow = w[2]; cur.fog = w[3]; cur.gcol = gTarget.slice(); cur.az = E.az; applyEnv(0, true); }
    else {
      if (envTw) envTw.kill();
      let t0 = cur.time, t1 = E.time; if (t1 < t0 - 0.01) t1 += 24; if (t1 - t0 > 23.5) t1 = t0;
      const w = WEATHERS[E.weather], s = { c: cur.cloud, r: cur.rain, s: cur.snow, f: cur.fog, g: cur.gcol.slice(), az: cur.az || 0 }, g1 = gTarget;
      envTw = YX.tween(2.4, (k) => { cur.time = (lerp(t0, t1, k) + 24) % 24; cur.cloud = lerp(s.c, w[0], k); cur.rain = lerp(s.r, w[1], k); cur.snow = lerp(s.s, w[2], k); cur.fog = lerp(s.f, w[3], k); cur.gcol = mix3(s.g, g1, k); cur.az = lerp(s.az, E.az, k); }, { ease: YX.ease.inOut });
    }
    YX.markDirty();
    return out.join(YX.T('，', ', '));
  };
  YX.wxName = (w) => YX.T(({ clear: '晴', cloudy: '多云', rain: '雨', snow: '雪', fog: '雾', storm: '暴雨' })[w] || w, ({ clear: 'clear', cloudy: 'cloudy', rain: 'rain', snow: 'snow', fog: 'fog', storm: 'storm' })[w] || w);
  YX.clock = (t) => { const h = Math.floor(t), m = Math.floor((t - h) * 60); return ('0' + h).slice(-2) + ':' + ('0' + m).slice(-2); };
  YX.envNow = () => ({ time: cur.time, night: cur.night });
  function applyEnv(dt) {
    const E = W.env;
    if (E.flow > 0 && dt > 0 && !(envTw && !envTw.dead && envTw.t < envTw.dur)) { cur.time = (cur.time + (dt * E.flow) / 60) % 24; E.time = cur.time; }
    const a = ((cur.time - 6) / 12) * Math.PI, az = (cur.az || 0) * DEG;
    let bx = Math.cos(a) * 0.85, by = Math.sin(a), bz = -0.42;
    sunDir.set(bx * Math.cos(az) - bz * Math.sin(az), by, bx * Math.sin(az) + bz * Math.cos(az)).normalize();
    const e = sunDir.y, wN = 1 - smooth(-0.25, 0.0, e), wD = smooth(0.08, 0.45, e), wG = Math.max(0, 1 - wN - wD), c = cur.cloud;
    let zen = tri(PAL.zen, wN, wG, wD), hor = tri(PAL.hor, wN, wG, wD), sc = tri(PAL.sun, wN, wG, wD), hs = tri(PAL.hs, wN, wG, wD), hg = tri(PAL.hg, wN, wG, wD);
    const greyZ = mix3(L('#161a22'), L('#8a94a3'), 1 - wN), greyH = mix3(L('#1b1f29'), L('#c5ccd4'), 1 - wN);
    zen = mix3(zen, greyZ, c * 0.85); hor = mix3(hor, greyH, Math.max(c * 0.8, cur.fog * 0.9));
    const soft = E.light === 'soft' ? 1 : E.light === 'hard' ? -1 : 0;
    let sunI = (0.3 * wN + 1.0 * wG + 1.25 * wD) * (1 - 0.68 * c) * (1 - 0.35 * soft), hemiI = (0.3 * wN + 0.5 * wG + 0.62 * wD) * (1 - 0.15 * c) * (1 + 0.38 * soft);
    const U = sky.material.uniforms;
    U.top.value.setRGB(zen[0], zen[1], zen[2]); U.hor.value.setRGB(hor[0], hor[1], hor[2]); U.bot.value.setRGB(hor[0] * 0.55, hor[1] * 0.55, hor[2] * 0.6);
    U.sunDir.value.copy(sunDir); const sv = (1 - c) * (1 - cur.fog) * smooth(-0.08, 0.05, e); U.sunCol.value.setRGB(sc[0] * sv, sc[1] * sv, sc[2] * sv);
    scene.fog.color.setRGB(hor[0], hor[1], hor[2]); scene.fog.density = 0.0021 + cur.fog * 0.024 + cur.rain * 0.003 + cur.snow * 0.005;
    const day = e > -0.05, ld = day ? sunDir : new THREE.Vector3(-sunDir.x * 0.6, Math.max(0.4, -sunDir.y), -sunDir.z * 0.6 + 0.3).normalize();
    sun.intensity = sunI * (day ? smooth(-0.05, 0.12, e) : smooth(0.05, 0.3, -e)); sun.color.setRGB(sc[0], sc[1], sc[2]);
    const P = W.player, tx = Math.round(P.x / 6) * 6, tz = Math.round(P.z / 6) * 6;
    sun.target.position.set(tx, 0, tz); sun.position.set(tx + ld.x * 260, ld.y * 260, tz + ld.z * 260); sun.target.updateMatrixWorld();
    hemi.intensity = hemiI; hemi.color.setRGB(hs[0], hs[1], hs[2]); hemi.groundColor.setRGB(hg[0], hg[1], hg[2]); amb.intensity = 0.1 + 0.05 * wN;
    cur.night = 1 - smooth(-0.14, 0.2, e);
    const glow = Math.max(cur.night, c * 0.35 * (1 - wN) + cur.fog * 0.3);
    if (Math.abs(glow - YX.glowLevel) > 0.01) YX.setGlow(glow);
    stars.material.opacity = wN * (1 - c) * 0.9; stars.position.copy(camera.position);
    sky.position.copy(camera.position);
    moon.position.set(camera.position.x - sunDir.x * 1100, camera.position.y + Math.max(120, -sunDir.y * 1100), camera.position.z - sunDir.z * 1100 + 300); moon.material.opacity = wN * (1 - c * 0.8);
    ground.material.color.setRGB(cur.gcol[0], cur.gcol[1], cur.gcol[2]); if (patches) patches.value = W.env.ground === 'grass' ? Math.max(0, 1 - cur.snow * 1.6) : 0;
    const wantSand = E.ground === 'sand' || E.ground === 'dirt'; if ((ground.material.map === ground.userData.st) !== wantSand) { ground.material.map = wantSand ? ground.userData.st : ground.userData.gt; ground.material.needsUpdate = true; }
    hills.material.color.setRGB(0.6 + cur.gcol[0] * 1.6, 0.6 + cur.gcol[1] * 1.2, 0.6 + cur.gcol[2] * 1.6);
    // particles
    const cp = camera.position, t = W.time;
    rain.material.opacity = clamp(cur.rain, 0, 1) * 0.5; rain.visible = cur.rain > 0.02;
    if (rain.visible) { const p = rain.geometry.attributes.position.array, sd = rain.userData.seed; for (let i = 0; i < sd.length; i++) { const s = sd[i], x = cp.x + (s[0] - 0.5) * 60, z = cp.z + (s[2] - 0.5) * 60, y = cp.y + 24 - ((s[1] * 30 + t * (30 + s[0] * 12)) % 30); p[i * 6] = x; p[i * 6 + 1] = y; p[i * 6 + 2] = z; p[i * 6 + 3] = x + 0.12; p[i * 6 + 4] = y - 0.75; p[i * 6 + 5] = z; } rain.geometry.attributes.position.needsUpdate = true; }
    snow.material.opacity = clamp(cur.snow, 0, 1) * 0.9; snow.visible = cur.snow > 0.02;
    if (snow.visible) { const p = snow.geometry.attributes.position.array, sd = snow.userData.seed; for (let i = 0; i < sd.length; i++) { const s = sd[i]; p[i * 3] = cp.x + (s[0] - 0.5) * 50 + Math.sin(t * 0.6 + s[1] * 30) * 0.8; p[i * 3 + 1] = cp.y + 16 - ((s[1] * 22 + t * (1.6 + s[2] * 1.4)) % 22); p[i * 3 + 2] = cp.z + (s[2] - 0.5) * 50 + Math.cos(t * 0.5 + s[0] * 30) * 0.8; } snow.geometry.attributes.position.needsUpdate = true; }
  }

  /* ================= objects ================= */
  const OPT_ALIAS = { 樱花: 'sakura', 松: 'pine', 桦: 'birch', 棕榈: 'palm', 椰: 'palm', 柳: 'willow', 枫: 'autumn', 秋: 'autumn', 橡: 'oak', 尖顶: 'gable', 人字: 'gable', 四坡: 'hip', 平顶: 'flat', 平: 'flat', 玻璃: 'glass', 砖: 'brick', 混凝土: 'concrete', 水泥: 'concrete', 站: 'stand', 坐: 'sit', 蹲: 'squat', 跪: 'kneel', 躺: 'lie', 走: 'walk', 挥手: 'wave', 飞: 'fly', 栖: 'perch', 停: 'perch', 出租: 'taxi', 红: 'red', 黄: 'yellow', 绿: 'green' };
  const PENDING = { label: '生成中', en: 'Generating', cls: 'prim', solid: false, face: 'me', params: {}, block: true };
  YX.defOf = function (o) { const t = typeof o === 'string' ? o : o.type; return t === '__pending' ? PENDING : G[t]; };
  function coerce(spec, v, base) {
    if (spec.bool) { if (typeof v === 'string') return !/^(false|0|no|off|否|没有|无)$/i.test(v.trim()); return !!v; }
    if (spec.opts) { let s = String(v).toLowerCase().trim(); if (spec.opts.includes(s)) return s; for (const k in OPT_ALIAS) if (s.includes(k) && spec.opts.includes(OPT_ALIAS[k])) return OPT_ALIAS[k]; const hit = spec.opts.find((o) => s.includes(o)); return hit || base; }
    if (spec.color) { if (v === '' && spec.opt) return ''; return YX.normColor(YX.colorWord ? YX.colorWord(v) || v : v, base); }
    if (spec.text) return String(v).replace(/[\r\n]+/g, ' ').trim().slice(0, 32);
    let n;
    if (typeof v === 'string') { const m = v.trim().match(/^([+\-*x×\/])\s*=?\s*(-?[\d.]+)$/i); if (m && base != null) { const k = +m[2]; n = m[1] === '+' ? base + k : m[1] === '-' ? base - k : m[1] === '/' ? base / (k || 1) : base * k; } else n = parseFloat(v); } else n = +v;
    if (!isFinite(n)) return base;
    n = clamp(n, spec.min != null ? spec.min : -1e9, spec.max != null ? spec.max : 1e9);
    return spec.int ? Math.round(n) : Math.round(n * 1000) / 1000;
  }
  YX.fillParams = function (def, given, rand, base) {
    const out = {}; given = given || {};
    for (const k in def.params) { const sp = def.params[k], b = base ? base[k] : undefined; if (given[k] !== undefined && given[k] !== null) out[k] = coerce(sp, given[k], b !== undefined ? b : sp.d); else if (b !== undefined) out[k] = b; else out[k] = sp.pick && rand ? sp.pick[Math.min(sp.pick.length - 1, Math.floor(rand() * sp.pick.length))] : sp.d; if (out[k] === undefined) out[k] = sp.d; }
    for (const k in given) if (k[0] === '_') out[k] = given[k];
    if (base) for (const k in base) if (k[0] === '_' && out[k] === undefined) out[k] = base[k];
    return out;
  };
  function pendingParts(o) {
    const B = YX.makeBuilder(1), b = B.b, s = o.psize || [3, 3, 3], w = s[0], h = s[1], d = s[2], c = '#e0533a';
    b.box(w, h, d, c, 0, 0, 0, { opacity: 0.07, emissive: c });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.06, h, 0.06, c, sx * w / 2, 0, sz * d / 2, { emissive: c, noShadow: true });
    for (const y of [0, h]) { for (const sz of [-1, 1]) b.box(w, 0.06, 0.06, c, 0, y, sz * d / 2, { emissive: c, noShadow: true }); for (const sx of [-1, 1]) b.box(0.06, 0.06, d, c, sx * w / 2, y, 0, { emissive: c, noShadow: true }); }
    b.group({ y: h / 2, anim: { bob: { amp: h / 2 - 0.05, freq: 0.45 } } }, () => b.box(w, 0.04, d, c, 0, 0, 0, { opacity: 0.35, emissive: c }));
    b.text((o.name || YX.T('新物体', 'New object')) + YX.T(' · 生成中', ' · generating'), Math.max(0.35, Math.min(1.2, w * 0.14)), '#ffffff', 0, h + 0.7, 0, { bg: '#b8371f' });
    return { root: B.root, anchors: {} };
  }
  function builtinParts(o, def) {
    const B = YX.makeBuilder(o.seed, 9000);
    def.build(B.b, o.params, B.rnd);
    if (o.name && def.cls === 'creature') { const top = B.anchors.top ? B.anchors.top[1] : 1.9; B.b.text(o.name, 0.2, '#ffffff', 0, top + 0.3, 0, { bg: '#1b1f24' }); }
    return { root: B.root, anchors: B.anchors };
  }
  function measure(o) {
    const def = YX.defOf(o), b = o.box, s = o.s;
    const w = Math.max(0.05, (b.max.x - b.min.x) * s[0]), h = Math.max(0.05, b.max.y * s[1]), d = Math.max(0.05, (b.max.z - b.min.z) * s[2]);
    o.size = [w, h, d];
    let f = def && def.foot ? def.foot(o.params) : null;
    o.foot = f ? [f[0] * s[0], f[1] * s[2]] : [w, d];
    o.fr = Math.max(0.2, Math.hypot(o.foot[0], o.foot[1]) * 0.42);
  }
  function applyBuilt(o, parts, opt) {
    opt = opt || {};
    const old = o.mesh, oldBox = o.box ? o.box.clone() : null;
    const cm = YX.custom && YX.custom[o.type] ? YX.custom[o.type].meta : null;
    const dcl = (YX.defOf(o) || {}).cls, bevel = quality === 'low' ? 0 : dcl === 'building' ? 0.03 : dcl === 'ground' || dcl === 'nature' || dcl === 'sky' ? 0 : dcl === 'creature' ? 0.018 : 0.045; // how much is taken off the edges: more on the things you stand next to
    const r = YX.realize(parts.root, { tint: o.tint, dark: o.lights === false, bevel, fat: cm ? clamp(Math.max(cm.size[0], cm.size[1], cm.size[2]) * 0.0006, 0.003, 0.02) : 0 });
    r.group.updateMatrixWorld(true);
    let box = new THREE.Box3(); const _tb = new THREE.Box3();
    r.group.traverse((c) => { if (c.isMesh && c.geometry) { if (!c.geometry.boundingBox) c.geometry.computeBoundingBox(); _tb.copy(c.geometry.boundingBox).applyMatrix4(c.matrixWorld); box.union(_tb); } });
    if (box.isEmpty() || !isFinite(box.min.x) || !isFinite(box.max.y)) box = new THREE.Box3(new THREE.Vector3(-0.3, 0, -0.3), new THREE.Vector3(0.3, 0.6, 0.3));
    r.group.traverse((c) => { if (c.isSprite || (c.isMesh && c.userData.ownMat)) c.layers.set(2); });
    o.mesh = r.group; o.anims = r.anims; o.glows = r.glows || 0; o.anchors = parts.anchors || {}; o.box = box;
    if (o.attach && o.attach.anchor === 'floor') r.group.traverse((c) => { if (c.isMesh) c.castShadow = false; });
    o.holder.add(r.group);
    if (old) { o.holder.remove(old); YX.disposeGroup(old); }
    measure(o);
    if (opt.grow && oldBox) {
      const sx = (oldBox.max.x - oldBox.min.x) / Math.max(0.01, box.max.x - box.min.x), sy = oldBox.max.y / Math.max(0.01, box.max.y), sz = (oldBox.max.z - oldBox.min.z) / Math.max(0.01, box.max.z - box.min.z);
      const f = [clamp(sx, 0.2, 5), clamp(sy, 0.2, 5), clamp(sz, 0.2, 5)], g = r.group;
      g.scale.set(f[0], f[1], f[2]);
      YX.tween(0.42, (k) => { if (o.mesh === g) g.scale.set(lerp(f[0], 1, k), lerp(f[1], 1, k), lerp(f[2], 1, k)); }, { ease: YX.ease.back });
    }
    updateKids(o);
    if (o.type === 'road') roadsCache = null;
  }
  YX.rebuild = function (o, opt) {
    const def = YX.defOf(o);
    if (o.type === '__pending') return applyBuilt(o, pendingParts(o), opt);
    if (!def) return;
    if (def.custom) return YX.customBuild(o, opt, applyBuilt);
    try { applyBuilt(o, builtinParts(o, def), opt); } catch (e) { console.warn('build failed', o.type, e); if (!o.mesh) applyBuilt(o, pendingParts(o), opt); }
  };
  YX.applyBuilt = applyBuilt;
  function syncHolder(o) { o.holder.position.set(o.x, o.y, o.z); o.holder.rotation.set(0, o.rot, o.bank || 0); o.holder.scale.set(o.s[0] * (o.pop == null ? 1 : o.pop), o.s[1] * (o.pop == null ? 1 : o.pop), o.s[2] * (o.pop == null ? 1 : o.pop)); }
  YX.syncHolder = syncHolder;
  YX.spawn = function (d, opt) {
    opt = opt || {};
    const def = YX.defOf(d.type);
    if (!def) return null;
    const o = { id: d.id || W.nextId++, type: d.type, x: +d.x || 0, y: +d.y || 0, z: +d.z || 0, rot: +d.rot || 0, s: Array.isArray(d.s) ? d.s.slice(0, 3) : [1, 1, 1], seed: d.seed || ((Math.random() * 4294967295) >>> 0) || 1, name: d.name || '', tint: d.tint || null, attach: d.attach || null, motion: d.motion || null, ms: d.ms || null, speed: d.speed || null, psize: d.psize || null, kids: new Set(), anims: [], vel: 0 };
    if (o.id >= W.nextId) W.nextId = o.id + 1;
    for (let i = 0; i < 3; i++) if (!isFinite(o.s[i]) || o.s[i] <= 0) o.s[i] = 1;
    o.params = YX.fillParams(def, d.params, YX.rng(o.seed ^ 0x9e3779b9));
    o.holder = new THREE.Group(); o.holder.rotation.order = 'YXZ'; scene.add(o.holder);
    W.objs.set(o.id, o);
    YX.rebuild(o);
    if (!o.box) { o.box = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5)); measure(o); }
    if (o.motion == null) o.motion = def.motion || 'none';
    if (o.attach) { const p = W.objs.get(o.attach.to); if (p) p.kids.add(o.id); else o.attach = null; }
    if (o.attach) placeOnParent(o);
    syncHolder(o);
    if (opt.animate) { o.pop = 0.001; syncHolder(o); YX.tween(0.5, (k) => { o.pop = Math.max(0.001, k); syncHolder(o); }, { ease: YX.ease.back, delay: opt.delay || 0, done: () => { o.pop = null; syncHolder(o); } }); if (o.y < 3 && !opt.quiet) YX.fx.ring(o.x, o.z, Math.max(1.2, o.fr * 1.5)); }
    if (o.type === 'road') roadsCache = null;
    YX.markDirty();
    return o;
  };
  YX.removeObj = function (o, opt) {
    if (!o || o.dead) return;
    o.dead = true; W.objs.delete(o.id);
    const rid = YX.roomOf(o), RB = rid != null ? W.objs.get(rid) : null;
    if (o.attach) { const p = W.objs.get(o.attach.to); if (p) p.kids.delete(o.id); }
    for (const kid of Array.from(o.kids)) { const k = W.objs.get(kid); if (k && k.attach && k.attach.anchor === 'floor') { YX.removeObj(k, opt); continue; }
      if (k && RB && !RB.dead && YX.floorOf) { const y0 = k.y, y1 = RB.y + YX.floorOf(RB) * RB.s[1]; o.kids.delete(k.id); k.attach = null; YX.attachFloor(k, RB); k.y = y0; YX.tween(0.45, (t) => { k.y = lerp(y0, y1, t); syncHolder(k); }, { ease: YX.ease.inOut }); if (k.type === 'person' && k.params.pose === 'sit') { k.params.pose = 'stand'; YX.rebuild(k); } continue; }
      if (k) { k.attach = null; const y0 = k.y; const def = YX.defOf(k); const fly = def && (def.motion === 'fly' || def.cls === 'sky'); if (!fly) YX.tween(0.5, (t) => { k.y = lerp(y0, 0, t); syncHolder(k); }, { ease: YX.ease.inOut }); if (k.type === 'bird') { k.params.pose = 'fly'; k.motion = 'fly'; k.ms = null; k.y = Math.max(y0, 6); YX.rebuild(k); } if (k.type === 'person' && k.params.pose === 'ride') { k.params.pose = 'stand'; YX.rebuild(k); } } }
    if (W.aim === o) W.aim = null; if (W.focusId === o.id) W.focusId = null; if (W.grabbed === o) W.grabbed = null;
    const kill = () => { scene.remove(o.holder); if (o.mesh) YX.disposeGroup(o.mesh); };
    if (opt && opt.animate) YX.tween(0.3, (k) => { o.pop = Math.max(0.001, 1 - k); syncHolder(o); }, { ease: YX.ease.inOut, done: kill }); else kill();
    if (o.type === 'road') roadsCache = null;
    YX.markDirty();
  };
  YX.clearWorld = function () { for (const o of Array.from(W.objs.values())) YX.removeObj(o); W.aim = null; W.focusId = null; roadsCache = null; };

  /* ---------- attach ---------- */
  function anchorLocal(p, name) {
    if (name === 'floor' || name === 'deck') return [0, YX.floorOf ? YX.floorOf(p) : 0, 0]; // the floor of the room inside a building, or the open floor of a gazebo
    if (name && p.anchors && p.anchors[name]) return p.anchors[name];
    if (p.anchors && p.anchors.roof && name !== 'top') return p.anchors.roof;
    if (p.anchors && p.anchors.top) return p.anchors.top;
    const dw = YX.defOf(p); if (dw && dw.wet) return [0, 0.14, 0]; // on water means on its surface, not level with the tops of the reeds around it
    const b = p.box; return [(b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2];
  }
  function placeOnParent(o) {
    const p = W.objs.get(o.attach.to); if (!p) return;
    const pd = YX.defOf(p); if (pd && pd.ride && o.type === 'person' && (o.params.pose !== 'ride' || o.attach.anchor !== 'seat') && !o.fixing) { o.fixing = true; o.attach.anchor = 'seat'; o.params.pose = 'ride'; setTimeout(() => { o.fixing = false; if (!o.dead) YX.rebuild(o); }, 0); } // whatever pose was asked for, on a bicycle a person rides, on the saddle
    const a = anchorLocal(p, o.attach.anchor), lx = (a[0] + (o.attach.ox || 0)) * p.s[0], lz = (a[2] + (o.attach.oz || 0)) * p.s[2], c = Math.cos(p.rot), s = Math.sin(p.rot);
    o.x = p.x + lx * c + lz * s; o.z = p.z - lx * s + lz * c; o.y = p.y + a[1] * p.s[1];
    if (o.attach.anchor && /^seat/.test(o.attach.anchor)) o.rot = p.rot + (a[3] || 0);
    if (o.attach.rr != null) o.rot = p.rot + o.attach.rr; // furniture keeps its place and its facing when the building turns
  }
  function updateKids(p) { for (const id of p.kids) { const k = W.objs.get(id); if (k && k.attach) { placeOnParent(k); syncHolder(k); if (k.kids.size) updateKids(k); } } }
  YX.updateKids = updateKids;
  /* which building's room an object is in: it stands on that room's floor, or on something that does */
  YX.roomOf = function (o) { for (let k = 0; o && o.attach && k < 6; k++) { if (o.attach.anchor === 'floor') return o.attach.to; o = W.objs.get(o.attach.to); } return null; };
  YX.attachFloor = function (o, B, x, z, rot) { // stand on the floor of B's room at world (x, z): from then on it belongs to the room and moves with the building
    x = x == null ? o.x : x; z = z == null ? o.z : z; if (o.motion === 'follow') YX.unfollow(o); YX.detach(o, true);
    const c = Math.cos(B.rot), s = Math.sin(B.rot), dx = x - B.x, dz = z - B.z;
    const sp0 = YX.spaceOf ? YX.spaceOf(B) : null, an = sp0 ? sp0.anchor : 'floor';
    o.attach = { to: B.id, anchor: an, ox: (dx * c - dz * s) / B.s[0], oz: (dx * s + dz * c) / B.s[2], rr: (rot == null ? o.rot : rot) - B.rot }; B.kids.add(o.id);
    if (o.motion !== 'none') { o.motion = 'none'; o.ms = null; }
    if (o.mesh && an === 'floor') o.mesh.traverse((m) => { if (m.isMesh) m.castShadow = false; });
    YX.markDirty();
  };
  YX.seatsOf = (p) => (p && p.anchors ? Object.keys(p.anchors).filter((k) => /^seat\d*$/.test(k)).sort((a, b) => (+a.slice(4) || 1) - (+b.slice(4) || 1)) : []); // the places to sit that an object offers
  YX.attachTo = function (o, p, anchor) {
    if (o.motion === 'follow') YX.unfollow(o);
    YX.detach(o);
    const def = YX.defOf(o), pd = YX.defOf(p) || {}, riding = !!pd.ride && o.type === 'person'; let name = anchor || null;
    if (!name && def && def.sits && p.anchors) { const used = Array.from(p.kids).map((id) => W.objs.get(id)).filter((k) => k && k.attach).map((k) => k.attach.anchor); name = YX.seatsOf(p).find((k) => !used.includes(k)) || null; } // the first free seat
    const n = p.kids.size, seat = name && /^seat/.test(name);
    const spread = seat ? 0 : Math.min(1.2, Math.max(0.35, o.fr * 1.6));
    o.attach = { to: p.id, anchor: name, ox: seat || n === 0 ? 0 : (n % 2 ? 1 : -1) * Math.ceil(n / 2) * spread, oz: 0 };
    p.kids.add(o.id); placeOnParent(o); syncHolder(o);
    if (seat && o.type === 'person' && (riding ? o.params.pose !== 'ride' : !['sit', 'lie'].includes(o.params.pose))) { o.params.pose = riding ? 'ride' : 'sit'; YX.rebuild(o); }
    o.motion = 'none'; o.ms = null;
    if (riding && seat) { // size the bicycle to its rider, then set off along the nearest road
      const kid = o.params.age === 'child', h = kid && o.params.height >= 1.6 ? 1.15 : o.params.height, f = clamp((h / (kid ? 1.5 : 1.72)) * (kid ? 0.68 / 0.9 : 1) * o.s[1], 0.45, 1.8);
      p.s = [f, f, f]; syncHolder(p); measure(p); placeOnParent(o); syncHolder(o);
      p.motion = 'drive'; p.ms = null; YX.initMotion(p);
    }
  };
  YX.detach = function (o, quiet) {
    if (!o.attach) return; const p = W.objs.get(o.attach.to); if (o.attach.anchor === 'floor' && o.mesh) o.mesh.traverse((m) => { if (m.isMesh && !(m.material && m.material.transparent)) m.castShadow = true; }); o.attach = null;
    if (p) { p.kids.delete(o.id); const pd = YX.defOf(p); if (!quiet && pd && pd.ride && p.motion === 'drive' && !Array.from(p.kids).some((id) => (W.objs.get(id) || {}).type === 'person')) { p.motion = 'none'; p.ms = null; p.vel = 0; } }
    if (!quiet && o.type === 'person' && o.params.pose === 'ride') { o.params.pose = 'stand'; YX.rebuild(o); }
  };

  /* ---------- transforms ---------- */
  function killTw(o, k) { if (!o.tw) o.tw = {}; if (k) { if (o.tw[k]) o.tw[k].kill(); o.tw[k] = null; } else for (const j in o.tw) { if (o.tw[j]) o.tw[j].kill(); o.tw[j] = null; } }
  YX.moveTo = function (o, x, z, y, opt) {
    const x0 = o.x, z0 = o.z, y0 = o.y; y = y == null ? o.y : y;
    const set = (k) => { o.x = lerp(x0, x, k); o.z = lerp(z0, z, k); o.y = lerp(y0, y, k); syncHolder(o); if (o.kids.size) updateKids(o); };
    killTw(o, 'm'); if (opt && opt.instant) set(1); else { const tw = (o.tw.m = YX.tween(0.38, set, { ease: YX.ease.out, done: () => { if (o.tw.m === tw) o.tw.m = null; if (o.type === 'road') { roadsCache = null; YX.recomputeRoads(); } } })); }
    if (o.ms) { if (o.ms.cx != null) { o.ms.cx += x - x0; o.ms.cz += z - z0; } if (o.ms.hx != null) { o.ms.hx = x; o.ms.hz = z; o.ms.tx = null; } if (o.ms.H != null) o.ms.H = y; }
    if (o.type === 'road') roadsCache = null;
    YX.markDirty();
  };
  YX.rotateTo = function (o, rot, opt) { if (o.attach && o.attach.rr != null) { const p = W.objs.get(o.attach.to); if (p) o.attach.rr = rot - p.rot; } const r0 = o.rot; let d = rot - r0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; const set = (k) => { o.rot = r0 + d * k; syncHolder(o); if (o.kids.size) updateKids(o); }; killTw(o, 'r'); if (opt && opt.instant) set(1); else o.tw.r = YX.tween(0.4, set, { ease: YX.ease.out, done: () => { if (o.type === 'road') { roadsCache = null; YX.recomputeRoads(); } } }); if (o.type === 'road') roadsCache = null; YX.markDirty(); };
  YX.scaleTo = function (o, s, opt) { const s0 = o.s.slice(); s = s.map((v) => clamp(v, 0.02, 400)); const set = (k) => { o.s = [lerp(s0[0], s[0], k), lerp(s0[1], s[1], k), lerp(s0[2], s[2], k)]; syncHolder(o); measure(o); if (o.kids.size) updateKids(o); }; killTw(o, 's'); if (opt && opt.instant) set(1); else o.tw.s = YX.tween(0.4, set, { ease: YX.ease.back }); YX.markDirty(); };

  /* ================= roads + placement ================= */
  YX.roads = function () {
    if (roadsCache) return roadsCache;
    roadsCache = [];
    for (const o of W.objs.values()) if (o.type === 'road' && !o.dead) { const dx = Math.cos(o.rot), dz = -Math.sin(o.rot); roadsCache.push({ o, x: o.x, z: o.z, dx, dz, hl: (o.params.length * o.s[0]) / 2, w: o.params.width * o.s[2] }); }
    return roadsCache;
  };
  YX.recomputeRoads = function () {
    roadsCache = null; const R = YX.roads(), cuts = new Map();
    for (const r of R) cuts.set(r.o.id, []);
    for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
      const A = R[i], B = R[j], den = A.dx * B.dz - A.dz * B.dx;
      if (Math.abs(den) < 0.25) continue;
      const ex = B.x - A.x, ez = B.z - A.z, t = (ex * B.dz - ez * B.dx) / den, u = (ex * A.dz - ez * A.dx) / den;
      if (Math.abs(t) > A.hl + B.w / 2 || Math.abs(u) > B.hl + A.w / 2) continue;
      const ownA = A.o.id < B.o.id;
      cuts.get(A.o.id).push({ t: Math.round((t / A.o.s[0]) * 100) / 100, he: Math.round((B.w / 2 / Math.abs(den) / A.o.s[0]) * 100) / 100, own: ownA });
      cuts.get(B.o.id).push({ t: Math.round((u / B.o.s[0]) * 100) / 100, he: Math.round((A.w / 2 / Math.abs(den) / B.o.s[0]) * 100) / 100, own: !ownA });
    }
    for (const r of R) { const c = cuts.get(r.o.id), prev = JSON.stringify(r.o.params._cuts || []); if (JSON.stringify(c) !== prev) { r.o.params._cuts = c; YX.rebuild(r.o); } }
    roadsCache = null;
  };
  YX.roadAt = function (x, z) { for (const r of YX.roads()) { const ex = x - r.x, ez = z - r.z, t = ex * r.dx + ez * r.dz, lat = ex * -r.dz + ez * r.dx; if (Math.abs(t) <= r.hl && Math.abs(lat) <= r.w / 2) return r.o; } return null; };
  YX.nearestRoad = function (x, z, maxD) {
    let best = null;
    for (const r of YX.roads()) { const ex = x - r.x, ez = z - r.z; let t = ex * r.dx + ez * r.dz; const tc = clamp(t, -r.hl, r.hl), px = r.x + r.dx * tc, pz = r.z + r.dz * tc, lat = ex * -r.dz + ez * r.dx, dist = Math.hypot(x - px, z - pz); if (!best || dist < best.dist) best = { r, t: tc, px, pz, lat, dist, side: lat >= 0 ? 1 : -1, nx: -r.dz, nz: r.dx }; }
    return best && (maxD == null || best.dist <= maxD) ? best : null;
  };
  /* ---------- crossings (where two roads meet) ---------- */
  let xCache = null;
  function crossings() {
    const R = YX.roads(); if (xCache && xCache.src === R) return xCache.list;
    const list = [];
    for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
      const A = R[i], B = R[j], den = A.dx * B.dz - A.dz * B.dx; if (Math.abs(den) < 0.25) continue;
      const ex = B.x - A.x, ez = B.z - A.z, t = (ex * B.dz - ez * B.dx) / den, u = (ex * A.dz - ez * A.dx) / den;
      if (Math.abs(t) > A.hl + B.w / 2 || Math.abs(u) > B.hl + A.w / 2) continue;
      list.push({ a: A, b: B, ta: t, tb: u, ha: B.w / 2 / Math.abs(den), hb: A.w / 2 / Math.abs(den), key: A.o.id + ':' + B.o.id });
    }
    xCache = { src: R, list }; return list;
  }
  const roadFrame = (rd, x, z) => { const ex = x - rd.x, ez = z - rd.z; return [ex * rd.dx + ez * rd.dz, ex * -rd.dz + ez * rd.dx]; };
  const laneOff = (rd) => Math.min(rd.w / 4, 2.4);
  const carLen = (o) => Math.max(o.foot[0], o.foot[1]) / 2, carWid = (o) => Math.min(o.foot[0], o.foot[1]) / 2;
  YX.roadFrame = roadFrame;
  /* the road the player means by "the road in front of me": under the crosshair, else where the view ray meets one, else the nearest */
  YX.roadAhead = function (v) {
    const R = YX.roads(); if (!R.length) return null;
    const at = (r, x, z, m) => { const f = roadFrame(r, x, z); return Math.abs(f[0]) <= r.hl + m && Math.abs(f[1]) <= r.w / 2 + m ? f : null; };
    const mk = (r, t, lat, how, d) => { t = clamp(t, -r.hl, r.hl); return { r, t, lat, px: r.x + r.dx * t, pz: r.z + r.dz * t, nx: -r.dz, nz: r.dx, how, d }; };
    const ap = v.aimPoint, ad = ap ? Math.hypot(ap[0] - v.x, ap[1] - v.z) : 1e9;
    if (ad < 68) for (const r of R) { const f = at(r, ap[0], ap[1], 0.4); if (f) return mk(r, f[0], f[1], 'aim', ad); }
    let on = null; for (const r of R) { const f = at(r, v.x, v.z, 0.3); if (f) { on = mk(r, f[0] + (v.fx * r.dx + v.fz * r.dz) * 12, f[1], 'on', 0); break; } }
    if (on && Math.abs(v.fx * on.r.dx + v.fz * on.r.dz) > 0.6) return on;
    for (let d = 1.5; d <= 80; d += 1) { const x = v.x + v.fx * d, z = v.z + v.fz * d; for (const r of R) { if (on && r === on.r) continue; const f = at(r, x, z, 0); if (!f) continue;
      const den = v.fx * -r.dz + v.fz * r.dx; let t = f[0], dd = d; if (Math.abs(den) > 0.2) { const k = -f[1] / den; if (k > -1 && k < r.w) { dd = d + k; t = f[0] + (v.fx * r.dx + v.fz * r.dz) * k; } }
      return mk(r, t, roadFrame(r, v.x, v.z)[1], 'ray', dd); } }
    if (on) return on;
    const nr = YX.nearestRoad(v.x + v.fx * 8, v.z + v.fz * 8); return nr ? mk(nr.r, nr.t, roadFrame(nr.r, v.x, v.z)[1], 'near', nr.dist) : null;
  };
  function blocked(x, z, r, opt) {
    if (Math.abs(x) > 600 || Math.abs(z) > 600) return true;
    for (const o of W.objs.values()) {
      if (o.dead || o === opt.self || o.attach || o.y > 2.5) continue;
      const def = YX.defOf(o); if (!def || def.block === false) continue;
      if (def.flat && r < 1.2 && o.type !== 'pond') continue;
      const dx = x - o.x, dz = z - o.z;
      if (def.cls === 'building' && def.solid) { const c = Math.cos(o.rot), s = Math.sin(o.rot), lx = dx * c - dz * s, lz = dx * s + dz * c, m = r * 0.9; if (Math.abs(lx) < o.foot[0] / 2 + m + 0.32 && lz > -(o.foot[1] / 2 + m + 0.32) && lz < o.foot[1] / 2 + m + 0.85) return true; } // a building is its whole rectangle, corners included, plus plinth and doorstep
      else if (o.foot[0] > o.foot[1] * 2.2 || o.foot[1] > o.foot[0] * 2.2) { const c = Math.cos(o.rot), s = Math.sin(o.rot), lx = dx * c - dz * s, lz = dx * s + dz * c; if (Math.abs(lx) < o.foot[0] / 2 + r * 0.8 && Math.abs(lz) < o.foot[1] / 2 + r * 0.8) return true; }
      else if (dx * dx + dz * dz < Math.pow(o.fr * 0.88 + r * 0.88 + 0.25, 2)) return true;
    }
    if (opt.roads !== false) for (const rd of YX.roads()) { const ex = x - rd.x, ez = z - rd.z, t = ex * rd.dx + ez * rd.dz, lat = Math.abs(ex * -rd.dz + ez * rd.dx); if (Math.abs(t) < rd.hl + r && lat < rd.w / 2 + (r > 1.5 ? 2.6 + Math.min(r, opt.depth != null ? opt.depth / 2 : r) * 0.92 : r * 0.9 + 0.1)) return true; }
    return false;
  }
  YX.isBlocked = (x, z, r, opt) => blocked(x, z, r, opt || {});
  YX.findFree = function (x, z, r, opt) {
    opt = opt || {};
    if (!blocked(x, z, r, opt)) return [x, z];
    const step = Math.max(0.7, r * 0.5), max = opt.max || 60;
    const ah = opt.ahead; // [x, z, fx, fz]: only spots at least a step in front of the one looking, never behind them
    for (let k = 1; k < (opt.strict ? 6000 : 900); k++) { const rad = step * Math.sqrt(k); if (rad > max) break; const a = k * 2.39996; const cx = x + Math.cos(a) * rad, cz = z + Math.sin(a) * rad; if (ah && (cx - ah[0]) * ah[2] + (cz - ah[1]) * ah[3] < 1.5) continue; if (!blocked(cx, cz, r, opt)) return [cx, cz]; }
    return opt.strict ? null : [x, z]; // strict: no free ground means no, never "then right here on the road"
  };
  /* the road a solid thing is standing on, if any: buildings, trees and street furniture belong beside roads, not on them */
  YX.onRoad = function (o) {
    const def = YX.defOf(o); if (!def || o.dead || o.attach || o.type === 'road' || o.type === '__pending' || def.flat || def.block === false || def.cls === 'ground' || def.cls === 'vehicle' || def.cls === 'creature' || def.cls === 'sky' || o.y > 2.5 || !o.foot) return null;
    const c = Math.cos(o.rot), s = Math.sin(o.rot), fr = footRect(o), hx = fr[0], hz = fr[1];
    for (const rd of YX.roads()) { const ex = o.x - rd.x, ez = o.z - rd.z, t = ex * rd.dx + ez * rd.dz, lat = Math.abs(ex * -rd.dz + ez * rd.dx), al = Math.abs(rd.dx * c - rd.dz * s) * hx + Math.abs(rd.dx * s + rd.dz * c) * hz, ac = Math.abs(-rd.dz * c - rd.dx * s) * hx + Math.abs(-rd.dz * s + rd.dx * c) * hz; if (Math.abs(t) < rd.hl + al - 0.1 && lat < rd.w / 2 + ac - 0.3) return rd.o.id; }
    return null;
  };
  /* a street got wider or narrower: everything that stands along it keeps its distance from the kerb */
  YX.roadWidened = function (ro, w0, w1) {
    const d = (w1 - w0) / 2; if (!(Math.abs(d) >= 0.01)) return 0; roadsCache = null; const rd = YX.roads().find((q) => q.o === ro); if (!rd) return 0; let n = 0;
    for (const o of Array.from(W.objs.values())) {
      if (o === ro || o.dead || o.attach || o.type === 'road' || o.type === '__pending' || o.y > 2.5) continue; const def = YX.defOf(o); if (!def || def.cls === 'sky') continue;
      if (o.motion === 'drive' && o.ms && o.ms.road === ro.id) continue; // traffic on it finds its lane again by itself
      const ex = o.x - rd.x, ez = o.z - rd.z, t = ex * rd.dx + ez * rd.dz, lat = ex * -rd.dz + ez * rd.dx; if (Math.abs(t) > rd.hl + 1 || Math.abs(lat) > w0 / 2 + 60 || Math.abs(lat) < 0.2) continue;
      const nr = YX.nearestRoad(o.x, o.z); if (nr && nr.r.o !== ro && Math.abs(nr.lat) < Math.abs(lat)) continue; // it belongs to another street
      const sd = lat >= 0 ? 1 : -1; YX.moveTo(o, o.x - rd.dz * sd * d, o.z + rd.dx * sd * d, o.y); n++;
    }
    setTimeout(() => { for (const o of Array.from(W.objs.values())) if (!o.dead && YX.onRoad(o) === ro.id) { const f = YX.clearSpot(o); if (f) YX.moveTo(o, f[0], f[1], o.y); } }, 450); // whatever still ends up on the carriageway steps off it
    return n;
  };
  YX.clearSpot = function (o) { return YX.findFree(o.x, o.z, o.fr, { self: o, depth: o.foot[1], roads: true, max: 240, strict: true }); }; // the nearest free lot for something that stands where it should not

  /* ---------- footprint overlap: things do not sit inside each other ---------- */
  function footRect(o) { const def = YX.defOf(o); if (def && def.solid === 'trunk') { const r = 0.35 * Math.max(o.s[0], 0.6); return [r, r]; } return [o.foot[0] / 2, o.foot[1] / 2]; }
  function rectHit(a, ax, az, b, k) {
    const ha = footRect(a), hb = footRect(b), ca = Math.cos(a.rot), sa = Math.sin(a.rot), cb = Math.cos(b.rot), sb = Math.sin(b.rot), dx = b.x - ax, dz = b.z - az;
    const axes = [[ca, -sa], [sa, ca], [cb, -sb], [sb, cb]];
    for (let i = 0; i < 4; i++) { const ux = axes[i][0], uz = axes[i][1];
      const ra = (ha[0] * Math.abs(ca * ux - sa * uz) + ha[1] * Math.abs(sa * ux + ca * uz)) * k, rb = (hb[0] * Math.abs(cb * ux - sb * uz) + hb[1] * Math.abs(sb * ux + cb * uz)) * k;
      if (Math.abs(dx * ux + dz * uz) > ra + rb) return false; }
    return true;
  }
  const onGround = (o, def) => !(o.attach || o.y > 2.5 || !def || def.flat || def.cls === 'sky' || def.cls === 'ground' || o.type === '__pending');
  YX.overlapAt = function (o, x, z, k) {
    for (const b of W.objs.values()) {
      if (b === o || b.dead || b.attach || b === W.grabbed || (o.attach && o.attach.to === b.id)) continue;
      const def = YX.defOf(b); if (!onGround(b, def) || def.block === false) continue;
      if (Math.abs(b.x - x) > 70 || Math.abs(b.z - z) > 70) continue;
      if (rectHit(o, x, z, b, k || 0.9)) return b;
    }
    return null;
  };
  YX.freeNear = function (o, x, z, max) {
    if (!YX.overlapAt(o, x, z)) return [x, z];
    const step = Math.max(0.45, o.fr * 0.3);
    for (let k = 1; k < 700; k++) { const rad = step * Math.sqrt(k); if (rad > (max || 40)) break; const a = k * 2.39996, cx = x + Math.cos(a) * rad, cz = z + Math.sin(a) * rad; if (!YX.overlapAt(o, cx, cz)) return [cx, cz]; }
    return [x, z];
  };
  YX.settle = function (o) { if (!o || o.dead || !onGround(o, YX.defOf(o))) return false; const f = YX.freeNear(o, o.x, o.z); if (f[0] === o.x && f[1] === o.z) return false; YX.moveTo(o, f[0], f[1], o.y); return true; };
  YX.shove = function (o) { // o grew or changed: push lighter things out of its footprint
    if (!o || o.dead || !onGround(o, YX.defOf(o))) return 0; let n = 0;
    for (const b of Array.from(W.objs.values())) {
      if (b === o || b.dead || b.motion === 'drive' || b.fr > o.fr) continue; const def = YX.defOf(b); if (!onGround(b, def) || def.cls === 'building') continue;
      if (Math.abs(b.x - o.x) > 90 || Math.abs(b.z - o.z) > 90 || !rectHit(b, b.x, b.z, o, 0.92)) continue;
      const step = Math.max(0.45, b.fr * 0.3);
      for (let k = 1; k < 600; k++) { const rad = step * Math.sqrt(k), a = k * 2.39996, cx = b.x + Math.cos(a) * rad, cz = b.z + Math.sin(a) * rad; if (!rectHit(b, cx, cz, o, 0.92) && !YX.overlapAt(b, cx, cz)) { YX.moveTo(b, cx, cz, b.y); n++; break; } }
      if (n > 16) break;
    }
    return n;
  };
  YX.viewNow = function () {
    const P = W.player, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    return { x: P.x, y: P.y, z: P.z, yaw: P.yaw, pitch: P.pitch, fx, fz, rx: Math.cos(P.yaw), rz: -Math.sin(P.yaw), aimId: W.aim ? W.aim.id : null, aimPoint: W.aimPoint.slice(), aimOk: !!W.aimOk, focusId: W.focusId, inside: YX.insideOf && YX.insideOf() ? YX.insideOf().id : null };
  };
  function faceRot(def, x, z, v) {
    if (!def || def.face === 'none') return 0;
    if (def.face === 'random') return Math.random() * 6.283;
    if (def.face === 'road') { const nr = YX.nearestRoad(x, z, 34); if (nr) { if (def.cls === 'vehicle') return Math.atan2(nr.r.dx, nr.r.dz); return Math.atan2(-nr.nx * nr.side, -nr.nz * nr.side); } }
    return Math.atan2(v.x - x, v.z - z);
  }
  YX.faceRot = faceRot;
  /* resolve a place spec into {x,z,y,rot,attach} */
  YX.resolvePlace = function (P, ctx, info) {
    const v = ctx.view, def = info.def, r = info.fr || 1, sky = def && (def.cls === 'sky' || (def.motion === 'fly' && !(info.params && info.params.pose === 'perch')));
    const alt = def && def.alt ? def.alt : 12;
    let fail = false; // nothing free anywhere near: better to say so than to stand a building on a road or inside another one
    const big = !!def && (def.cls === 'building' || r > 1.6) && def.cls !== 'vehicle' && def.cls !== 'ground' && def.cls !== 'sky' && def.cls !== 'creature';
    const res = (x, z, o) => Object.assign({ x, z, y: 0 }, fail ? { fail: true } : null, o || {});
    const free = (x, z, o) => { if (info.noFree) return [x, z]; const q = Object.assign({ depth: info.fd, self: info.self, roads: def && (def.cls === 'vehicle' || def.cls === 'ground' || def.cls === 'creature' || r < 0.8) ? false : true }, o || {}); if (q.roads === false) { if (q.near) { const f = YX.findFree(x, z, r, Object.assign({}, q, { strict: true })); if (!f) { fail = true; return [x, z]; } return f; } return YX.findFree(x, z, r, q); } if (!q.near) q.max = Math.max(q.max || 60, big ? 240 : 90); q.strict = true; const f = YX.findFree(x, z, r, q); if (!f) { fail = true; return [x, z]; } return f; };
    if (typeof P === 'string') { const s = P.toLowerCase(); P = s === 'aim' || s === 'here' ? { aim: true } : s === 'across' ? { across: true } : s === 'sky' ? { above: 'me' } : { front: 9 }; }
    if ((!P || typeof P !== 'object') && v && v.aimOk && !sky) P = { aim: true }; // no place said: where the crosshair rests, if it rests on something within reach
    if (!P || typeof P !== 'object') {
      if (sky) return res(v.x + v.fx * 16 + (Math.random() - 0.5) * 8, v.z + v.fz * 16 + (Math.random() - 0.5) * 8, { y: alt + Math.random() * 3 });
      const d = Math.max(6, r * 1.6 + 5), f = free(v.x + v.fx * d, v.z + v.fz * d, { max: Math.max(20, r * 4 + 12), near: true, ahead: [v.x, v.z, v.fx, v.fz] }); // ahead of the player, and if that is taken somewhere close by, still ahead: never behind them
      return res(f[0], f[1]);
    }
    { // onto / beside a road: vehicles join a lane and line up with it
      let rs = P.road != null ? P.road : null, rdO = null;
      if (rs == null && typeof P.on === 'string' && /^(?:the )?(?:road|street|lane|马路上?|路上?|街上?)$/i.test(P.on.trim())) rs = 'ahead';
      if (rs == null && P.on != null) { const t = ctx.one(P.on); if (t && t.type === 'road') rdO = t; }
      if (rs != null && rs !== true && !/^(?:ahead|front|aim|near|nearest|here|this|that|true)$/i.test(String(rs))) { const t = ctx.one(rs); if (t && t.type === 'road') rdO = t; }
      if (rs != null || rdO) {
        let h = null;
        if (rdO) { const rr = YX.roads().find((q) => q.o === rdO); if (rr) { const ap = v.aimPoint, fa = roadFrame(rr, ap[0], ap[1]), useAim = Math.abs(fa[1]) <= rr.w / 2 + 3 && Math.abs(fa[0]) <= rr.hl + 3 && Math.hypot(ap[0] - v.x, ap[1] - v.z) < 68, f = useAim ? fa : roadFrame(rr, v.x + v.fx * 8, v.z + v.fz * 8), t = clamp(f[0], -rr.hl, rr.hl); h = { r: rr, t, lat: useAim ? fa[1] : roadFrame(rr, v.x, v.z)[1], px: rr.x + rr.dx * t, pz: rr.z + rr.dz * t, nx: -rr.dz, nz: rr.dx, how: useAim ? 'aim' : 'near' }; } }
        else if (/^near/i.test(String(rs))) { const nr = YX.nearestRoad(v.x, v.z); if (nr) h = { r: nr.r, t: nr.t, lat: nr.lat, px: nr.px, pz: nr.pz, nx: nr.nx, nz: nr.nz, how: 'near' }; }
        else h = YX.roadAhead(v);
        if (h) {
          const rd = h.r, sd = h.lat >= 0 ? 1 : -1, where = String(P.side || P.where || 'on').toLowerCase();
          if (/beside|side|edge|curb|kerb|by|next|near/.test(where)) { const offs = rd.w / 2 + 1.1 + Math.min(r, 3) * 0.9, f = free(h.px + h.nx * sd * offs, h.pz + h.nz * sd * offs, { max: 20, roads: false }); return res(f[0], f[1], { rot: def && def.face === 'road' ? (def.cls === 'vehicle' ? Math.atan2(rd.dx, rd.dz) : Math.atan2(-h.nx * sd, -h.nz * sd)) : undefined }); }
          if (def && def.cls === 'vehicle' && (def.motion === 'drive' || def.face === 'road' || (info.self && info.self.motion === 'drive'))) {
            const ln = /far|other|opposite/.test(String(P.lane || '')) ? -sd : sd, off = ln * (def.ride ? Math.max(0.6, rd.w / 2 - 0.45) : laneOff(rd)), L = (info.fd || r * 2) / 2, lim = Math.max(0, rd.hl - L - 1);
            const busy = (tt) => { for (const c of W.objs.values()) { if (c === info.self || c.dead || c.attach || c.y > 2.5 || !c.foot) continue; const cd = YX.defOf(c); if (!cd || cd.flat || cd.cls === 'ground' || cd.cls === 'sky') continue; const f = roadFrame(rd, c.x, c.z); if (Math.abs(f[1] - off) < carWid(c) + 1.4 && Math.abs(f[0] - tt) < L + carLen(c) + 1.5) return true; } return false; };
            let t = clamp(h.t, -lim, lim);
            for (let k = 0; k < 40 && busy(t); k++) { const tt = clamp(h.t + (k % 2 ? 1 : -1) * Math.ceil((k + 1) / 2) * 3, -lim, lim); if (!busy(tt)) { t = tt; break; } }
            return res(rd.x + rd.dx * t - rd.dz * off, rd.z + rd.dz * t + rd.dx * off, { rot: Math.atan2(rd.dx * ln, rd.dz * ln), lane: { road: rd.o.id, lane: ln, t } });
          }
          const lat = clamp(h.how === 'aim' ? h.lat : 0, -rd.w / 2 + 0.5, rd.w / 2 - 0.5), f = free(h.px + h.nx * lat, h.pz + h.nz * lat, { max: 12, roads: false });
          return res(f[0], f[1]);
        }
      }
    }
    if (P.on != null) { const t = ctx.one(P.on); if (t) return res(t.x, t.z, { attach: { to: t.id, anchor: P.anchor ? String(P.anchor) : null } }); }
    if (P.above != null) { const t = P.above === 'me' || P.above === true ? null : ctx.one(P.above), h = isFinite(+P.height) ? +P.height : alt; return res(t ? t.x : v.x + v.fx * 10, t ? t.z : v.z + v.fz * 10, { y: (t ? t.size[1] + t.y : 0) + h }); }
    if (Array.isArray(P.at) && isFinite(+P.at[0]) && isFinite(+P.at[1])) { const f = P.exact && !(big && blocked(+P.at[0], +P.at[1], r, { self: info.self, depth: info.fd })) ? [+P.at[0], +P.at[1]] : free(+P.at[0], +P.at[1], { max: 30 }); /* coordinates are a wish: a building asked for on a road or on top of another one goes to the nearest free lot */ return res(f[0], f[1], { y: sky ? (isFinite(+P.height) ? +P.height : alt) : isFinite(+P.height) ? +P.height : 0 }); }
    if (P.across != null) {
      const t = P.across === true || P.across === 'me' ? null : ctx.one(P.across), rx = t ? t.x : v.x, rz = t ? t.z : v.z, nr = YX.nearestRoad(rx, rz);
      if (nr) {
        const side = -nr.side, set = nr.r.w / 2 + 2.6 + 1.1 + (info.fd || r * 1.4) / 2, big = r > 1.5;
        const off = big ? set : nr.r.w / 2 + 1.2 + r;
        for (let k = 0; k < 80; k++) { const d = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.max(1.5, r * 0.6), t2 = clamp(nr.t + d, -nr.r.hl + r, nr.r.hl - r), x = nr.r.x + nr.r.dx * t2 + nr.nx * side * off, z = nr.r.z + nr.r.dz * t2 + nr.nz * side * off; if (!blocked(x, z, r, { self: info.self, depth: info.fd })) return res(x, z, { rot: def && def.face === 'road' && def.cls !== 'vehicle' ? Math.atan2(-nr.nx * side, -nr.nz * side) : undefined }); }
        const f = free(nr.px + nr.nx * side * (off + 4), nr.pz + nr.nz * side * (off + 4)); return res(f[0], f[1]);
      }
      const f = free(v.x + v.fx * 22, v.z + v.fz * 22); return res(f[0], f[1]);
    }
    if (P.near != null) {
      const me = P.near === 'me', t = me ? null : ctx.one(P.near);
      if (t || me) {
        const tx = t ? t.x : v.x, tz = t ? t.z : v.z, tr = t ? Math.max(t.foot[0], t.foot[1]) / 2 : 0.4;
        let fx = tx - v.x, fz = tz - v.z; const l = Math.hypot(fx, fz); if (l < 0.5 || me) { fx = v.fx; fz = v.fz; } else { fx /= l; fz /= l; }
        const rxx = -fz, rzz = fx, gap = (isFinite(+P.gap) ? +P.gap : 0.8) + tr + r * 0.9, side = String(P.side || 'any').toLowerCase();
        const dirs = { left: [-rxx, -rzz], right: [rxx, rzz], front: [-fx, -fz], behind: [fx, fz], back: [fx, fz] };
        const order = dirs[side] ? [dirs[side]] : [dirs.right, dirs.left, dirs.front, dirs.behind];
        for (const d of order) { const x = tx + d[0] * gap, z = tz + d[1] * gap; if (!blocked(x, z, r, { self: info.self, depth: info.fd, roads: r > 0.8 })) return res(x, z); }
        const d = order[0], f = free(tx + d[0] * gap, tz + d[1] * gap, { max: 25 }); return res(f[0], f[1]);
      }
    }
    if (Array.isArray(P.between) && P.between.length >= 2) { const a = ctx.one(P.between[0]), b = ctx.one(P.between[1]); if (a && b) { const f = free((a.x + b.x) / 2, (a.z + b.z) / 2, { max: 20 }); return res(f[0], f[1]); } }
    if (P.aim) { // at the crosshair: if that spot is taken, the nearest free one close by, and the command says how far it had to go and why. Never somewhere far away without a word
      const ax = v.aimPoint[0], az = v.aimPoint[1]; if (sky) return res(ax, az, { y: alt });
      const f = free(ax, az, { max: Math.max(12, r * 4 + 8), near: true, ahead: [v.x, v.z, v.fx, v.fz] }), moved = Math.hypot(f[0] - ax, f[1] - az);
      if (ctx) ctx.aimPlace = { x: ax, z: az, moved: fail ? null : moved, fail, road: !!(YX.roadAt && YX.roadAt(ax, az)) };
      return res(f[0], f[1], { y: 0 }); }
    if (P.front != null || P.right != null) { const d = isFinite(+P.front) ? +P.front : 8, rr = isFinite(+P.right) ? +P.right : 0; const f = free(v.x + v.fx * d + v.rx * rr, v.z + v.fz * d + v.rz * rr, d > 0 ? { max: Math.max(20, r * 4 + 12), near: true, ahead: [v.x, v.z, v.fx, v.fz] } : { max: 40 }); return res(f[0], f[1], { y: sky ? (isFinite(+P.height) ? +P.height : alt) : isFinite(+P.height) ? +P.height : 0 }); }
    return YX.resolvePlace(null, ctx, info);
  };
  /* ---------- indoors: places are on the floor of the room the player is standing in ---------- */
  const INDOOR_CLS = { furniture: 1, creature: 1, prim: 1, street: 1 }, INDOOR_TYPE = { bush: 1, flowers: 1, rock: 1 };
  function roomFree(B, x, z, r, self) { // a spot near (x, z) inside the room that does not overlap what already stands there
    const m = Math.min(r, 0.8) * 0.6 + 0.15, hit = (px, pz) => { for (const id of B.kids) { const k = W.objs.get(id); if (!k || k === self || k.dead || !k.attach || (k.attach.anchor !== 'floor' && k.attach.anchor !== 'deck')) continue; const kd = YX.defOf(k); if (!kd || kd.flat || kd.solid === false) continue; if (Math.hypot(k.x - px, k.z - pz) < (r + k.fr) * 0.72) return true; } return false; };
    const p = YX.roomClamp(B, x, z, m); if (!hit(p[0], p[1])) return p;
    for (let k = 1; k < 80; k++) { const a = k * 2.39996, rad = 0.26 * Math.sqrt(k) * Math.max(1, r), q = YX.roomClamp(B, x + Math.cos(a) * rad, z + Math.sin(a) * rad, m); if (!hit(q[0], q[1])) return q; }
    return p;
  }
  const resolveOut = YX.resolvePlace;
  YX.resolvePlace = function (P, ctx, info) {
    if (P && typeof P === 'object' && P.in != null && YX.spaceOf) { const t = ctx.one(P.in), sp = t ? YX.spaceOf(t) : null;
      if (t && sp && sp.water && !(info.def && info.def.floats)) { P = { near: P.in, side: 'front' }; return YX.resolvePlace(P, ctx, info); } // only what floats goes on water: the rest is put on the bank
      if (t && sp && t !== info.self) { const c0 = sp.water ? [t.x + (Math.random() - 0.5) * sp.hx, t.z + (Math.random() - 0.5) * sp.hz] : sp.enclosed ? YX.spaceSpot(t, sp.doorX, Math.max(0, sp.hz - 1.7)) : [t.x, t.z], f = roomFree(t, c0[0], c0[1], Math.min(info.fr || 0.4, 0.9), info.self); return { x: f[0], z: f[1], y: t.y + sp.floor * t.s[1], floor: t.id }; }
      if (t) P = { near: P.in, side: 'front' }; }
    const v = ctx.view, B = v && v.inside != null ? W.objs.get(v.inside) : null, def = info.def;
    if (!B || B.dead || !def || !YX.roomClamp || !(INDOOR_CLS[def.cls] || (info.self && YX.roomOf(info.self) === B.id)) && !INDOOR_TYPE[Object.keys(YX.GEN).find((k) => YX.GEN[k] === def)]) return resolveOut(P, ctx, info);
    if ((def.motion === 'fly' && !(info.params && info.params.pose === 'perch')) || def.motion === 'drive' || def.cls === 'sky') return resolveOut(P, ctx, info); // these belong outside
    if (typeof P === 'string') { const s = P.toLowerCase(); if (s === 'across' || s === 'sky') return resolveOut(P, ctx, info); P = s === 'aim' || s === 'here' ? { aim: true } : { front: 3 }; }
    if (P && typeof P === 'object' && (P.road != null || P.on != null || P.above != null || P.across != null)) return resolveOut(P, ctx, info);
    const r = info.fr || 0.6, fy = B.y + YX.floorOf(B) * B.s[1], here = (o) => !!o && YX.roomOf(o) === B.id, out = (x, z) => { const f = info.noFree ? YX.roomClamp(B, x, z, 0.1) : roomFree(B, x, z, r, info.self), fit = !info.noFree && def.cls === 'furniture' && info.type && YX.roomFit ? YX.roomFit(B, info.type, info, x, z, f[0], f[1], info.self, v) : null; return fit ? { x: fit[0], z: fit[1], y: fy, floor: B.id, rot: fit[2] } : { x: f[0], z: f[1], y: fy, floor: B.id }; }; // furniture is put where that kind of furniture goes in a room
    if (P && typeof P === 'object' && P.wall != null && YX.wallSpot) { const w = YX.wallSpot(B, P.wall, v.aimPoint[0], v.aimPoint[1]); if (w) return out(w[0], w[1]); }
    if (P && P.near != null) {
      const me = P.near === 'me', t = me ? null : ctx.one(P.near); if (!me && !here(t)) return resolveOut(P, ctx, info);
      const tx = t ? t.x : v.x, tz = t ? t.z : v.z, tr = t ? Math.max(t.foot[0], t.foot[1]) / 2 : 0.3; let fx = tx - v.x, fz = tz - v.z; const l = Math.hypot(fx, fz); if (l < 0.5 || me) { fx = v.fx; fz = v.fz; } else { fx /= l; fz /= l; }
      const rxx = -fz, rzz = fx, gap = (isFinite(+P.gap) ? +P.gap : 0.25) + tr + r * 0.7, side = String(P.side || 'any').toLowerCase(), dirs = { left: [-rxx, -rzz], right: [rxx, rzz], front: [-fx, -fz], behind: [fx, fz], back: [fx, fz] }, d = dirs[side] || dirs.right;
      const want = [tx + d[0] * gap, tz + d[1] * gap], alt = [tx - d[0] * gap, tz - d[1] * gap]; return YX.roomHas(B, want[0], want[1]) || dirs[side] ? out(want[0], want[1]) : out(alt[0], alt[1]);
    }
    if (P && Array.isArray(P.at) && isFinite(+P.at[0]) && isFinite(+P.at[1])) return YX.roomHas(B, +P.at[0], +P.at[1]) ? out(+P.at[0], +P.at[1]) : resolveOut(P, ctx, info);
    if (P && Array.isArray(P.between) && P.between.length >= 2) { const a = ctx.one(P.between[0]), b = ctx.one(P.between[1]); return here(a) && here(b) ? out((a.x + b.x) / 2, (a.z + b.z) / 2) : resolveOut(P, ctx, info); }
    if (P && !P.aim && (P.front != null || P.right != null)) { const d = isFinite(+P.front) ? +P.front : 2.5, rr = isFinite(+P.right) ? +P.right : 0; return out(v.x + v.fx * d + v.rx * rr, v.z + v.fz * d + v.rz * rr); }
    return out(v.aimPoint[0], v.aimPoint[1]); // by default: where the crosshair meets the floor
  };

  /* ================= motion ================= */
  YX.initMotion = function (o) {
    const def = YX.defOf(o), m = o.motion;
    if (m === 'fly') { if (!o.ms || o.ms.cx == null) { const R = 7 + Math.random() * 12; o.ms = { cx: o.x - R, cz: o.z, R, H: o.y > 2 ? o.y : (def && def.alt) || 12, a: 0, dir: Math.random() < 0.5 ? 1 : -1, ph: Math.random() * 6 }; } }
    else if (m === 'drive') { const nr = YX.nearestRoad(o.x, o.z, 14); if (!nr) { o.motion = 'none'; o.ms = null; return; } if (!o.ms || o.ms.road == null || !W.objs.get(o.ms.road)) o.ms = { road: nr.r.o.id, lane: nr.side >= 0 ? 1 : -1, t: nr.t, o: nr.lat, v: 0 }; }
    else if (m === 'wander') { if (!o.ms || o.ms.hx == null) o.ms = { hx: o.x, hz: o.z, tx: null, tz: null, wait: Math.random() * 2 }; }
    else if (m === 'drift') { if (!o.ms || o.ms.H == null) o.ms = { H: o.y > 2 ? o.y : (def && def.alt) || 60 }; }
    else if (m === 'hover') { if (!o.ms || o.ms.H == null) o.ms = { H: o.y > 1 ? o.y : (def && def.alt) || 20, ph: Math.random() * 6 }; }
    else if (m === 'route') { const R = o.route; if (!R || !Array.isArray(R.pts) || R.pts.length < 2) { o.motion = 'none'; o.ms = null; o.route = null; return; } const cum = [0]; for (let i = 1; i < R.pts.length; i++) cum.push(cum[i - 1] + Math.hypot(R.pts[i][0] - R.pts[i - 1][0], R.pts[i][1] - R.pts[i - 1][1], R.pts[i][2] - R.pts[i - 1][2])); const d0 = o.ms && typeof o.ms.d === 'number' ? o.ms.d : 0; o.ms = { d: d0, k: 0, cum, air: R.pts.some((p) => p[1] > 1.2) }; }
    else if (m === 'goto') { /* ms set by caller */ }
    else if (m === 'follow') { if (!o.ms || !W.objs.get(o.ms.lead)) { o.motion = o.type === 'person' && o.params.pose === 'walk' ? 'wander' : 'none'; o.ms = null; if (o.motion === 'wander') o.ms = { hx: o.x, hz: o.z, tx: null, tz: null, wait: 1 }; } }
    else o.ms = null;
  };
  /* per-frame traffic snapshot: who is on which road, what stands in the lanes, who owns each crossing */
  const xState = new Map(); let TR = null, trFrame = -1, frameNo = 0;
  function traffic() {
    if (TR && trFrame === frameNo) return TR;
    trFrame = frameNo; const by = (TR = new Map()), P = W.player;
    for (const r of YX.roads()) by.set(r.o.id, { r, cars: [], obst: [], x: [] });
    if (!by.size) return by;
    for (const o of W.objs.values()) {
      if (o.dead || o.attach || o === W.grabbed || !o.foot) continue;
      if (o.motion === 'drive' && o.ms && by.has(o.ms.road)) { by.get(o.ms.road).cars.push(o); continue; }
      const def = YX.defOf(o); if (!def || def.flat || def.cls === 'sky' || def.cls === 'ground' || o.y > 2.5 || o.type === '__pending') continue;
      for (const e of by.values()) { const r = e.r, f = roadFrame(r, o.x, o.z); if (Math.abs(f[0]) > r.hl + o.fr + 1 || Math.abs(f[1]) > r.w / 2 + o.fr) continue;
        if (def.solid === 'trunk' || def.cls === 'creature') { const q = def.cls === 'creature' ? Math.max(0.3, Math.min(o.foot[0], o.foot[1]) / 2) : 0.4; e.obst.push({ t: f[0], lat: f[1], ha: q, hl: q }); continue; }
        const al = Math.abs(Math.sin(o.rot) * r.dx + Math.cos(o.rot) * r.dz), ac = Math.sqrt(Math.max(0, 1 - al * al)), fx = o.foot[0] / 2, fz = o.foot[1] / 2;
        e.obst.push({ t: f[0], lat: f[1], ha: al * fz + ac * fx, hl: ac * fz + al * fx }); }
    }
    if (!P.fly && P.y < 2.6 && !cine.active) for (const e of by.values()) { const f = roadFrame(e.r, P.x, P.z); if (Math.abs(f[0]) < e.r.hl + 1 && Math.abs(f[1]) < e.r.w / 2 + 0.5) e.obst.push({ t: f[0], lat: f[1], ha: 0.45, hl: 0.45 }); }
    for (const x of crossings()) {
      const ea = by.get(x.a.o.id), eb = by.get(x.b.o.id); if (!ea || !eb) continue;
      let st = xState.get(x.key); if (!st) xState.set(x.key, (st = { own: 0, t0: 0, close: false }));
      const hold = (e, tc, h) => { let n = 0, inside = 0, best = 1e9; for (const c of e.cars) { const L = carLen(c), s = (tc - c.ms.t) * c.ms.lane; if (s > -(h + L) && s < h + L + 9) { n++; if (s < h + L + 0.2) inside++; if (s < best) best = s; } } return { n, inside, best }; };
      const A = hold(ea, x.ta, x.ha), B = hold(eb, x.tb, x.hb), ida = x.a.o.id, idb = x.b.o.id;
      let own = st.own; st.close = false;
      if ((own === ida && !A.n) || (own === idb && !B.n) || (own !== ida && own !== idb)) own = 0;
      if (!own) { if (A.n && (!B.n || A.inside > B.inside || (A.inside === B.inside && A.best <= B.best))) own = ida; else if (B.n) own = idb; if (own) st.t0 = W.time; }
      else if (W.time - st.t0 > 9) { const me = own === ida ? A : B, ot = own === ida ? B : A; if (ot.n) { if (!me.inside) { own = own === ida ? idb : ida; st.t0 = W.time; } else st.close = true; } }
      st.own = own;
      ea.x.push({ t: x.ta, h: x.ha, st, other: B.inside }); eb.x.push({ t: x.tb, h: x.hb, st, other: A.inside });
    }
    return by;
  }
  YX.traffic = traffic;
  /* push a point out of solid things; returns [x, z, whatWasHit] */
  const SKIRT = 0.32, SKIRT_F = 0.85; // how far a building's plinth (all round) and its doorstep, sill and planters (front) reach past its walls
  function solidPush(nx, nz, pr, self, eye) {
    let hit = null;
    for (const o of W.objs.values()) {
      const def = YX.defOf(o); if (!def || o.attach || o.dead || o === self || o === W.grabbed || o.y > 2.2) continue;
      const kind = def.solid || (self && def.wet); if (!kind) continue;
      const dx = nx - o.x, dz = nz - o.z, far = 40 + Math.max(o.foot[0], o.foot[1]) / 2; if (Math.abs(dx) > far || Math.abs(dz) > far) continue;
      if (eye != null && eye - 1.7 > o.size[1]) continue;
      if (kind === 'round') { const r = o.foot[0] / 2 * 0.96 + pr * 0.3, d = Math.hypot(dx, dz); if (d < r && d > 0.0001) { nx = o.x + (dx / d) * r; nz = o.z + (dz / d) * r; hit = o; } }
      else if (kind === 'trunk') { const r = 0.35 * Math.max(o.s[0], 0.6) + pr, d = Math.hypot(dx, dz); if (d < r && d > 0.0001) { nx = o.x + (dx / d) * r; nz = o.z + (dz / d) * r; hit = o; } }
      else { const c = Math.cos(o.rot), s = Math.sin(o.rot); let lx = dx * c - dz * s, lz = dx * s + dz * c; const bld = def.cls === 'building' && self, hx = o.foot[0] / 2 + pr + (bld ? SKIRT : 0), hzB = o.foot[1] / 2 + pr + (bld ? SKIRT : 0), hzF = o.foot[1] / 2 + pr + (bld ? SKIRT_F : 0);
        if (Math.abs(lx) < hx && lz > -hzB && lz < hzF) { const px = hx - Math.abs(lx), pf = hzF - lz, pb = lz + hzB; if (px <= pf && px <= pb) lx = (lx >= 0 ? 1 : -1) * hx; else if (pf <= pb) lz = hzF; else lz = -hzB; nx = o.x + lx * c + lz * s; nz = o.z - lx * s + lz * c; hit = o; } }
    }
    return [nx, nz, hit];
  }
  YX.reDrive = function (o, x, z, lane) { // a vehicle was put somewhere: join the lane there, or park
    if (!o || o.attach) return;
    const nr = YX.nearestRoad(x, z);
    if (nr && Math.abs(nr.lat) <= nr.r.w / 2 + 0.4 && nr.dist <= Math.abs(nr.lat) + 0.6) { o.motion = 'drive'; o.ms = { road: nr.r.o.id, lane: lane || (nr.lat >= 0 ? 1 : -1), t: nr.t, o: nr.lat, v: 0 }; }
    else { o.motion = 'none'; o.ms = null; }
  };
  YX.joinRoad = function (o) { // a vehicle standing away from every road is asked to drive: it starts from the nearest lane
    const nr = YX.nearestRoad(o.x, o.z); if (!nr || o.attach) return false;
    const ln = nr.side, off = laneOff(nr.r), x = nr.px + nr.nx * ln * off, z = nr.pz + nr.nz * ln * off;
    YX.moveTo(o, x, z, 0); YX.rotateTo(o, Math.atan2(ln * nr.r.dx, ln * nr.r.dz)); o.motion = 'drive'; o.ms = { road: nr.r.o.id, lane: ln, t: nr.t, v: 0 };
    return true;
  };
  /* walking about inside a room or on a deck: the path is kept in the parent's own frame, so it holds when the building is moved or turned */
  function roam(o, dt, speed) {
    const B = W.objs.get(o.attach.to), sp = B && YX.spaceOf ? YX.spaceOf(B) : null; if (!sp) return; const a = o.attach, ms = o.ms || (o.ms = {}), rad = Math.max(0.25, o.fr * 0.8) / B.s[0];
    const taken = (lx, lz) => { for (const id of B.kids) { const k = W.objs.get(id); if (!k || k === o || k.dead || !k.attach || k.attach.anchor !== a.anchor) continue; const kd = YX.defOf(k); if (!kd || kd.flat || kd.solid === false) continue; if (Math.hypot(lx - k.attach.ox, lz - k.attach.oz) < rad + (k.fr * 0.75) / B.s[0]) return true; } return false; };
    const pose = (p) => { if (o.type === 'person' && o.params.pose !== p) { o.params.pose = p; YX.rebuild(o); } };
    if (ms.rx == null) { ms.rw = (ms.rw == null ? 0.6 : ms.rw) - dt; if (ms.rw > 0) return; for (let i = 0; i < 10 && ms.rx == null; i++) { const x = (Math.random() * 2 - 1) * Math.max(0, sp.hx - rad - 0.15), z = (Math.random() * 2 - 1) * Math.max(0, sp.hz - rad - 0.15); if (!taken(x, z)) { ms.rx = x; ms.rz = z; } } if (ms.rx == null) { ms.rw = 1; return; } pose('walk'); }
    const dx = ms.rx - a.ox, dz = ms.rz - a.oz, d = Math.hypot(dx, dz), v = Math.min(1.25, speed || 1.2) / B.s[0];
    if (d < 0.1) { ms.rx = null; ms.rw = 1.5 + Math.random() * 4; pose('stand'); return; }
    const st = Math.min(d, v * dt), nx = a.ox + (dx / d) * st, nz = a.oz + (dz / d) * st; if (taken(nx, nz)) { ms.rx = null; ms.rw = 0.3; return; } // something in the way: think again
    a.ox = nx; a.oz = nz; a.rr = Math.atan2(dx, dz); placeOnParent(o); o.vel = v * B.s[0]; syncHolder(o); if (o.kids.size) updateKids(o);
  }
  function updateMotion(o, dt, t) {
    const def = YX.defOf(o), ms = o.ms, sp = o.speed || (def && def.speed) || 2;
    o.vel = 0;
    if (o.attach && o.motion === 'wander' && (o.attach.anchor === 'floor' || o.attach.anchor === 'deck') && o !== W.grabbed && !o.hold) return roam(o, dt, sp);
    if (!ms || o.attach || o === W.grabbed || o.hold || (o.tw && o.tw.m)) return;
    if (!YX.canDo(o, o.motion)) { o.motion = 'none'; o.ms = null; o.bank = 0; syncHolder(o); return; } // e.g. a bicycle whose rider left, or something told to fly that cannot
    if (o.motion === 'route') { // a path laid out point by point (by the model, from the player's words): travelled at the thing's own speed, round and round or once to the end
      const R = o.route, P = R.pts, cum = ms.cum, total = cum[cum.length - 1], v = Math.max(0.05, +R.speed || sp);
      ms.d += v * dt;
      if (ms.d >= total) { if (R.loop) { ms.d %= total; ms.k = 0; } else { const e = P[P.length - 1]; o.x = e[0]; o.y = ms.air ? e[1] : 0; o.z = e[2]; o.bank = 0; o.route = null; if (e[1] > 1.2) { // the path ends in the air: over a roof or a treetop it has landed there; over nothing it stays aloft
            let sup = null, st = -1e9; for (const b of W.objs.values()) { if (b === o || b.dead || !b.box || b.attach) continue; const bd = YX.defOf(b); if (!bd || bd.flat || bd.cls === 'creature' || bd.cls === 'sky' || bd.cls === 'ground') continue; const top = b.y + b.box.max.y * b.s[1]; if (Math.abs(top - e[1]) > 3.5 || top < st) continue; const dx = e[0] - b.x, dz = e[2] - b.z, c = Math.cos(b.rot), sn = Math.sin(b.rot), lx = (dx * c - dz * sn) / b.s[0], lz = (dx * sn + dz * c) / b.s[2]; if (lx > b.box.min.x - 0.5 && lx < b.box.max.x + 0.5 && lz > b.box.min.z - 0.5 && lz < b.box.max.z + 0.5) { sup = b; st = top; } }
            if (sup) { o.motion = 'none'; o.ms = null; if (o.type === 'bird' && o.params.pose !== 'perch') { o.params.pose = 'perch'; YX.rebuild(o); } YX.attachTo(o, sup, sup.anchors && sup.anchors.roof ? 'roof' : null); if (o.kids && o.kids.size) updateKids(o); return; }
            o.motion = YX.canDo(o, 'hover') && def && def.motion === 'hover' ? 'hover' : 'fly'; o.ms = null; o.flight = null; YX.initMotion(o); } else { o.motion = 'none'; o.ms = null; if (o.type === 'person' && o.params.pose === 'walk') { o.params.pose = 'stand'; YX.rebuild(o); } } syncHolder(o); return; } }
      while (ms.k < cum.length - 2 && cum[ms.k + 1] <= ms.d) ms.k++; while (ms.k > 0 && cum[ms.k] > ms.d) ms.k--;
      const at = (dd) => { if (R.loop) dd = ((dd % total) + total) % total; else dd = clamp(dd, 0, total); let k = ms.k; while (k < cum.length - 2 && cum[k + 1] <= dd) k++; while (k > 0 && cum[k] > dd) k--; const a = P[k], b = P[k + 1], u = clamp((dd - cum[k]) / Math.max(1e-4, cum[k + 1] - cum[k]), 0, 1); return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; };
      const p = at(ms.d), q = at(ms.d + Math.max(0.6, v * 0.35)); if (ms.join) { const J = ms.join; J.t += dt; const u = Math.min(1, J.t / J.dur), e = u * u * (3 - 2 * u); for (let j = 0; j < 3; j++) { p[j] = J.from[j] + (p[j] - J.from[j]) * e; q[j] = J.from[j] + (q[j] - J.from[j]) * Math.min(1, e + 0.12); } if (u >= 1) ms.join = null; }
      o.x = p[0]; o.z = p[2]; o.y = ms.air || ms.join ? p[1] : 0; o.vy = 0;
      if (Math.hypot(q[0] - p[0], q[2] - p[2]) > 0.02) { let dr = Math.atan2(q[0] - p[0], q[2] - p[2]) - o.rot; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); const turn = dr * Math.min(1, dt * (ms.air ? 3.2 : 7)); o.rot += turn; o.bank = ms.air ? lerp(o.bank || 0, clamp((turn / Math.max(dt, 0.001)) * 0.35, -0.5, 0.5), 1 - Math.exp(-3 * dt)) : 0; }
      o.vel = v;
    } else if (o.motion === 'fly') {
      ms.nc = (ms.nc || 0) - dt;
      if (ms.nc <= 0) { ms.nc = 1.2; let need = 0; for (const b of W.objs.values()) { const bd = YX.defOf(b); if (!bd || bd.solid !== 'box' || b.dead || b === o || b.attach) continue; const up = b.y + b.size[1] + 2 - ms.H; if (up <= need) continue; if (o.flight === 'roam' ? Math.hypot(b.x - o.x, b.z - o.z) < Math.hypot(b.foot[0], b.foot[1]) / 2 + 9 : Math.abs(Math.hypot(b.x - ms.cx, b.z - ms.cz) - ms.R) < Math.hypot(b.foot[0], b.foot[1]) / 2 + 2) need = up; } ms.need = need; }
      ms.lift = lerp(ms.lift || 0, ms.need || 0, 1 - Math.exp(-0.9 * dt));
      if (o.flight === 'roam') { // heads for one point after another, somewhere around where it started, turning no faster than something its size can
        if (ms.hd == null) ms.hd = o.rot || 0; ms.wt = (ms.wt || 0) - dt; const far = Math.max(30, ms.R * 3.2);
        if (ms.wx == null || ms.wt <= 0 || Math.hypot(ms.wx - o.x, ms.wz - o.z) < Math.max(4, sp)) { const a = Math.random() * 6.2832, r = far * Math.sqrt(Math.random()); ms.wx = ms.cx + Math.cos(a) * r; ms.wz = ms.cz + Math.sin(a) * r; ms.wy = (Math.random() - 0.4) * Math.min(9, ms.H * 0.5); ms.wt = 6 + Math.random() * 10; }
        let dh = Math.atan2(ms.wx - o.x, ms.wz - o.z) - ms.hd; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); const rate = clamp(sp / Math.max(5, ms.R * 0.6), 0.25, 1.6); ms.hd += clamp(dh, -rate * dt, rate * dt);
        o.x += Math.sin(ms.hd) * sp * dt; o.z += Math.cos(ms.hd) * sp * dt; ms.ry = lerp(ms.ry || 0, ms.wy, 1 - Math.exp(-0.3 * dt)); o.y = ms.H + ms.lift + ms.ry + Math.sin(t * 0.7 + ms.ph) * 0.7;
        o.rot = ms.hd; o.bank = lerp(o.bank || 0, clamp(dh, -1, 1) * 0.42, 1 - Math.exp(-3 * dt)); o.vel = sp;
      } else {
        ms.a += (ms.dir * sp * dt) / ms.R; o.x = ms.cx + Math.cos(ms.a) * ms.R; o.z = ms.cz + Math.sin(ms.a) * ms.R; o.y = ms.H + ms.lift + Math.sin(t * 0.7 + ms.ph) * 0.7;
        o.rot = Math.atan2(-Math.sin(ms.a) * ms.dir, Math.cos(ms.a) * ms.dir); o.bank = -ms.dir * 0.3; o.vel = sp;
      }
    } else if (o.motion === 'drive') {
      const e = traffic().get(ms.road); if (!e) { o.motion = 'none'; o.ms = null; return; }
      const rd = e.r, L = carLen(o), Wd = carWid(o), off = def && def.ride ? Math.max(0.6, rd.w / 2 - 0.45) : laneOff(rd), endT = Math.max(0, rd.hl - Math.max(2.5, L * 0.6 + off + 0.5)), ln = ms.lane;
      const beside = (c) => c.ms.u == null && Math.abs((c.ms.o != null ? c.ms.o : ms.o) - ms.o) > Wd + carWid(c) + 0.25; // side by side in the same direction: no need to queue
      if (ms.v == null) ms.v = 0; if (ms.o == null) ms.o = ln * off;
      if (ms.u != null) { // U-turn at the end of the road
        ms.u = Math.min(1, ms.u + (Math.min(sp, 4.5) * dt) / (Math.PI * off)); const th = Math.PI * ms.u, ct = Math.cos(th), sn = Math.sin(th), ub = ms.ub != null ? ms.ub : ln * endT, al = ub + ln * off * sn, lt = ln * off * ct;
        o.x = rd.x + rd.dx * al - rd.dz * lt; o.z = rd.z + rd.dz * al + rd.dx * lt; o.y = 0.05; o.rot = Math.atan2(ln * (rd.dx * ct + rd.dz * sn), ln * (rd.dz * ct - rd.dx * sn)); o.vel = Math.min(sp, 4.5);
        if (ms.u >= 1) { ms.lane = -ln; ms.t = ub; ms.o = -ln * off; ms.u = null; ms.ub = null; ms.v = Math.min(sp, 3); }
      } else {
        let gap = 1e9, hard = 1e9; const me = ms.t, toEnd = endT - me * ln;
        for (const c of e.cars) { if (c === o) continue; if (c.ms.u != null && c.ms.lane === -ln) { const s2 = ((c.ms.ub != null ? c.ms.ub : c.ms.t) - me) * ln; if (s2 > 0) gap = Math.min(gap, s2 - L - carLen(c)); continue; } if (c.ms.lane !== ln || beside(c)) continue; const s = (c.ms.t - me) * ln; if (c.ms.u != null) { gap = Math.min(gap, Math.max(0, s) - L - carLen(c)); continue; } if (s > 0 || (s === 0 && c.id < o.id)) gap = Math.min(gap, s - L - carLen(c)); }
        for (const b of e.obst) { const s = (b.t - me) * ln; if (s <= 0 || Math.abs(b.lat - ms.o) > b.hl + Wd + 0.3) continue; gap = Math.min(gap, s - L - b.ha); hard = Math.min(hard, s - L - b.ha); }
        for (const xr of e.x) { const s = (xr.t - me) * ln, edge = xr.h + L; if (s <= edge + 0.2 || s > edge + 40) continue;
          let room = true; const need = s + xr.h + 2 * L + 1.4; // do not enter a crossing you cannot leave
          for (const c of e.cars) { if (c === o || c.ms.lane !== ln || (c.ms.v || 0) > 1.5 || beside(c)) continue; const sc = (c.ms.t - me) * ln; if (sc > 0 && sc - carLen(c) < need) { room = false; break; } }
          if (room && hard < need - L) room = false;
          if (room && xr.st.own === rd.o.id && !xr.st.close && !xr.other) continue; gap = Math.min(gap, s - edge + 0.4); }
        // a lane blocked by something that is not traffic: wait a little, then turn back when the other lane is clear
        if (hard < 3 && (ms.v || 0) < 0.3) ms.blk = (ms.blk || 0) + dt; else if (ms.blk) ms.blk = Math.max(0, ms.blk - dt * 2);
        if (ms.blk > 6 && toEnd > 0.05) { let clear = true; for (const c of e.cars) { if (c === o) continue; const sc = (c.ms.t - me) * ln; if (c.ms.u != null ? Math.abs(sc) < 14 : c.ms.lane === -ln && sc > -(L + carLen(c) + 2) && sc < 16) { clear = false; break; } } if (clear) for (const b of e.obst) if (Math.abs(b.t - me) < L + b.ha + off + 0.6 && Math.abs(b.lat + ln * off) < b.hl + Wd + 0.3) { clear = false; break; } if (clear) for (const xr of e.x) if (Math.abs(xr.t - me) < xr.h + L + off + 1) { clear = false; break; } if (clear) { ms.u = 0; ms.ub = me; ms.v = 0; ms.blk = 0; } }
        if (ms.u != null) { /* turning starts next frame */ } else
        if (toEnd <= 0.05) {
          const te = ln * endT; let clear = true;
          for (const c of e.cars) { if (c === o) continue; if (c.ms.u != null ? Math.abs(c.ms.t - te) < 14 : c.ms.lane === -ln && Math.abs(c.ms.t - te) < L + carLen(c) + off + 1.5) { clear = false; break; } }
          if (clear) for (const b of e.obst) if (Math.abs(b.t - te) < L + b.ha + off + 0.6 && Math.abs(b.lat + ln * off) < b.hl + Wd + 0.3) { clear = false; break; }
          ms.v = 0; if (clear) { ms.u = 0; ms.ub = te; ms.t = te; }
        } else {
          let vt = gap > 80 ? sp : clamp((gap - 1.2) * 1.1, 0, sp); vt = Math.min(vt, 2.5 + toEnd * 0.9);
          ms.v += clamp(vt - ms.v, -16 * dt, 4.5 * dt);
          let st = Math.max(0, ms.v * dt); if (gap < 80) st = Math.min(st, Math.max(0, gap - 0.5)); st = Math.min(st, toEnd);
          if (st <= 0) ms.v = Math.min(ms.v, 0.2);
          ms.t += ln * st; ms.o = lerp(ms.o, ln * off, 1 - Math.exp(-3.5 * dt)); o.vel = dt > 0 ? st / dt : 0;
        }
        o.x = rd.x + rd.dx * ms.t - rd.dz * ms.o; o.z = rd.z + rd.dz * ms.t + rd.dx * ms.o; o.y = 0.05;
        let dr = Math.atan2(rd.dx * ln, rd.dz * ln) - o.rot; while (dr > Math.PI) dr -= 6.2832; while (dr < -Math.PI) dr += 6.2832; o.rot += dr * Math.min(1, dt * 7);
      }
    } else if (o.motion === 'wander' || o.motion === 'goto') {
      const go = o.motion === 'goto';
      if (go && ms.via && ms.via.length) { // a stretch walked exactly as it was laid out (through a doorway, across the floor inside): nothing pushes the walker off it, and the height follows the floor
        const w = ms.via[0], dx = w.x - o.x, dz = w.z - o.z, d = Math.hypot(dx, dz), v = (ms.run ? 3.4 : 1.5) * Math.max(0.4, Math.cbrt(o.s[1])), st = Math.min(d, v * dt);
        if (ms.door != null) { const B = W.objs.get(ms.door); if (B && Math.hypot(o.x - ms.doorAt[0], o.z - ms.doorAt[1]) < 2.4) YX.holdDoor(B, 0.7); }
        if (d < 0.06) { o.x = w.x; o.z = w.z; o.y = w.y; ms.via.shift(); syncHolder(o); return; }
        o.x += (dx / d) * st; o.z += (dz / d) * st; o.y += (w.y - o.y) * Math.min(1, st / Math.max(d, 0.4)); o.vel = v; o.vy = 0;
        let dr = Math.atan2(dx, dz) - o.rot; while (dr > Math.PI) dr -= 6.283; while (dr < -Math.PI) dr += 6.283; o.rot += dr * Math.min(1, dt * 8); syncHolder(o); return;
      }
      if (ms.tx == null) {
        if (go && ms.enter && !ms.entered) { const B = W.objs.get(ms.enter.id), en = ms.enter, sp = B && !B.dead && YX.spaceOf ? YX.spaceOf(B) : null; if (sp && sp.enclosed && YX.spaceSpot) { const fy = B.y + sp.floor * B.s[1], a = YX.spaceSpot(B, sp.doorX, sp.hz - 0.45); ms.entered = true; ms.via = [{ x: a[0], z: a[1], y: fy }, { x: en.x, z: en.z, y: fy }]; const dp = YX.spaceSpot(B, sp.doorX, sp.hz + 0.3); ms.door = B.id; ms.doorAt = dp; YX.holdDoor(B, 0.9); return; } } // a room is walked into: through the doorway, up onto its floor, over to the spot
        if (go && ms.enter) { const B = W.objs.get(ms.enter.id), en = ms.enter; if (B && !B.dead && YX.spaceOf && YX.spaceOf(B)) { const fy = B.y + YX.floorOf(B) * B.s[1]; o.motion = 'none'; o.ms = null; YX.moveTo(o, en.x, en.z, fy); YX.attachFloor(o, B, en.x, en.z); if (o.type === 'person') { o.params.pose = ms.pose && ms.pose !== 'walk' ? ms.pose : 'stand'; YX.rebuild(o); } return; } }
        if (go) { o.motion = ms.then || 'none'; if (o.motion === 'wander') o.ms = { hx: o.x, hz: o.z, tx: null, wait: 2 }; else o.ms = null; if (ms.pose && o.type === 'person') { o.params.pose = ms.pose; YX.rebuild(o); } if (ms.face != null) YX.rotateTo(o, ms.face); if (ms.sitOn != null) { const sp2 = W.objs.get(ms.sitOn); if (sp2) YX.attachTo(o, sp2); } return; }
        ms.wait -= dt; if (ms.wait > 0) return;
        for (let i = 0; i < 6; i++) { const a = Math.random() * 6.283, d = 2 + Math.random() * 9, x = ms.hx + Math.cos(a) * d, z = ms.hz + Math.sin(a) * d; if (!blocked(x, z, 0.4, { self: o })) { ms.tx = x; ms.tz = z; ms.stk = 0; ms.av = 0; break; } }
        if (ms.tx == null) { ms.wait = 1; return; }
      }
      const dx = ms.tx - o.x, dz = ms.tz - o.z, d = Math.hypot(dx, dz), v = (go ? (ms.run ? 3.4 : 1.5) : sp) * Math.max(0.4, Math.cbrt(o.s[1]));
      const arrive = () => { ms.tx = null; ms.wait = 1.5 + Math.random() * 4; ms.stk = 0; ms.av = 0; };
      if (d < 0.15) { arrive(); return; }
      const rad = clamp(o.fr * 0.8, 0.22, 0.6), st = Math.min(d, v * dt), ux0 = dx / d, uz0 = dz / d; let ux = ux0, uz = uz0;
      if (ms.av > 0) { ms.av -= dt; const a = 1.3 * (ms.as || 1), c = Math.cos(a), s = Math.sin(a); ux = ux0 * c - uz0 * s; uz = uz0 * c + ux0 * s; }
      if (ms.asT > 0) ms.asT -= dt;
      const pq = solidPush(o.x + ux * st, o.z + uz * st, rad, o, null), P = W.player; let nx = pq[0], nz = pq[1];
      for (const c of W.objs.values()) { if (c === o || c.dead || c.attach || c.y > 1.5) continue; const cd = YX.defOf(c); if (!cd || cd.cls !== 'creature') continue; const ex = nx - c.x, ez = nz - c.z, rr = rad + clamp(c.fr * 0.8, 0.22, 0.6), dd = ex * ex + ez * ez; if (dd < rr * rr && dd > 1e-6) { const l = Math.sqrt(dd), k = (rr - l) * 0.5; nx += (ex / l) * k; nz += (ez / l) * k; } }
      if (!P.fly && !cine.active) { const ex = nx - P.x, ez = nz - P.z, rr = rad + 0.45, dd = ex * ex + ez * ez; if (dd < rr * rr && dd > 1e-6) { const l = Math.sqrt(dd); nx = P.x + (ex / l) * rr; nz = P.z + (ez / l) * rr; } }
      const mv = Math.hypot(nx - o.x, nz - o.z), nd = Math.hypot(ms.tx - nx, ms.tz - nz);
      if (pq[2] && d - nd < st * 0.4) { // something solid in the way: arrive if close enough, else walk around it
        if (d < 0.8) { o.x = nx; o.z = nz; arrive(); syncHolder(o); return; }
        if (!(ms.av > 0) && !(ms.asT > 0)) { const h = pq[2], sg = (h.x - o.x) * -uz0 + (h.z - o.z) * ux0; ms.as = sg > 0.05 ? -1 : sg < -0.05 ? 1 : o.id % 2 ? 1 : -1; }
        ms.asT = 4; ms.av = 0.7;
      }
      if (mv < st * 0.25) ms.stk = (ms.stk || 0) + dt; else ms.stk = 0;
      if (ms.stk > (go ? 2.5 : 1.2)) { ms.stk = 0; if (!go) { ms.tx = null; ms.wait = 0.4; return; } ms.flip = (ms.flip || 0) + 1; if (d < 2.5 || ms.flip > 3) { arrive(); return; } ms.as = -(ms.as || 1); ms.asT = 5; ms.av = 1.4; }
      o.x = nx; o.z = nz; o.vel = dt > 0 ? Math.min(v, mv / dt) : 0;
      let dr = Math.atan2(ux, uz) - o.rot; while (dr > Math.PI) dr -= 6.283; while (dr < -Math.PI) dr += 6.283; o.rot += dr * Math.min(1, dt * 8);
    } else if (o.motion === 'follow') { // keep to someone's side, at their pace
      const Ld = W.objs.get(ms.lead);
      if (!Ld || Ld.dead || Ld === o) { YX.unfollow(o); if (o.type === 'person' && o.params.pose === 'walk') { o.motion = 'wander'; YX.initMotion(o); } return; }
      const fx = Math.sin(Ld.rot), fz = Math.cos(Ld.rot), bk = ms.back || 0, sg = ms.side * ms.gap * (bk ? 0.6 : 1);
      const tx = Ld.x - fz * sg - fx * bk * 0.85, tz = Ld.z + fx * sg - fz * bk * 0.85, dx = tx - o.x, dz = tz - o.z, d = Math.hypot(dx, dz), lv = Ld.attach ? (W.objs.get(Ld.attach.to) || {}).vel || 0 : Ld.vel || 0;
      if (d > 0.04) { const v = Math.min(d > 6 ? 4.2 : Math.max(lv * 1.5, 1.9), d * 5), st = Math.min(d, v * dt), pq = solidPush(o.x + (dx / d) * st, o.z + (dz / d) * st, clamp(o.fr * 0.8, 0.22, 0.6), o, null), mv = Math.hypot(pq[0] - o.x, pq[1] - o.z); o.x = pq[0]; o.z = pq[1]; o.vel = dt > 0 ? Math.min(v, mv / dt) : 0; }
      let dr = (d > 0.5 ? Math.atan2(dx, dz) : Ld.rot) - o.rot; while (dr > Math.PI) dr -= 6.283; while (dr < -Math.PI) dr += 6.283; o.rot += dr * Math.min(1, dt * 8);
    } else if (o.motion === 'drift') { o.x += sp * dt; if (o.x > 420) o.x = -420; o.y = ms.H; }
    else if (o.motion === 'hover') { o.y = ms.H + Math.sin(t * 0.4 + ms.ph) * 0.8; o.rot += dt * 0.05; o.x += Math.sin(t * 0.07 + ms.ph) * dt * sp; }
    else return;
    syncHolder(o); if (o.kids.size) updateKids(o);
  }

  /* ================= player + camera ================= */
  const cine = (YX.cine = { active: null });
  /* the player is a viewpoint, not a body: it passes through walls and objects, so any building can simply be walked into */
  YX.solidPush = solidPush;
  let fovNow = 62, bobT = 0;
  function updatePlayer(dt) {
    const P = W.player, I = YX.input;
    if (cine.active) { YX.updateCine(dt); }
    else {
      if (I.tl) P.yaw += 1.9 * dt; if (I.tr) P.yaw -= 1.9 * dt;
      let mx = (I.r ? 1 : 0) - (I.l ? 1 : 0), mz = (I.f ? 1 : 0) - (I.b ? 1 : 0); const ln = Math.hypot(mx, mz) || 1; mx /= ln; mz /= ln;
      if ((I.up || I.down) && !P.fly && I.up) P.fly = true;
      const sp = (P.fly ? 15 : 5.2) * (I.run ? 2.3 : 1), fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
      const k = 1 - Math.exp(-12 * dt); P.vx = lerp(P.vx, (fx * mz + rx * mx) * sp, k); P.vz = lerp(P.vz, (fz * mz + rz * mx) * sp, k);
      let nx = clamp(P.x + P.vx * dt, -520, 520), nz = clamp(P.z + P.vz * dt, -520, 520);
      P.x = nx; P.z = nz;
      if (P.fly) { P.y = clamp(P.y + ((I.up ? 1 : 0) - (I.down ? 1 : 0)) * sp * 0.7 * dt, 1.7, 400); if (P.y <= 1.701 && I.down) P.fly = false; }
      else P.y = lerp(P.y, 1.7, 1 - Math.exp(-9 * dt));
      const moving = Math.hypot(P.vx, P.vz); bobT += dt * moving * 1.5;
      if (YX.insideTick) YX.insideTick(dt);
      if ((W.tickNo = (W.tickNo || 0) + 1) % 50 === 0) for (const o of W.objs.values()) { const d = YX.defOf(o); if (!d || d.cls !== 'creature' || o.attach || o.dead || o.y > 0.5 || o === W.grabbed || (o.tw && o.tw.m) || (o.motion && o.motion !== 'none')) continue; const q = solidPush(o.x, o.z, clamp(o.fr * 0.8, 0.22, 0.6), o, null); if (q[2] && (YX.defOf(q[2]) || {}).cls === 'building' && Math.hypot(q[0] - o.x, q[1] - o.z) > 0.05) YX.moveTo(o, q[0], q[1], o.y); } // nobody is left standing inside a wall
      camera.position.set(P.x, P.y + (P.fly ? 0 : (YX.lift || 0) + Math.sin(bobT) * 0.035 * Math.min(1, moving / 4)), P.z);
      camera.rotation.set(P.pitch, P.yaw, 0);
    }
    const nearWant = P.y > 6 ? 0.8 : 0.25; if (camera.near !== nearWant) { camera.near = nearWant; camera.updateProjectionMatrix(); } // seen from the air, depth precision matters more than very close objects
    const want = P.lens ? (2 * Math.atan(12 / P.lens)) / DEG : 62;
    if (Math.abs(want - fovNow) > 0.02) { fovNow = lerp(fovNow, want, 1 - Math.exp(-7 * dt)); camera.fov = fovNow; camera.updateProjectionMatrix(); }
  }
  YX.snapFov = function () { const P = W.player; fovNow = P.lens ? (2 * Math.atan(12 / P.lens)) / DEG : 62; camera.fov = fovNow; camera.updateProjectionMatrix(); };
  YX.look = function (dx, dy) { if (cine.active) return; const P = W.player, k = P.lens ? clamp(24 / P.lens, 0.2, 1) : 1; P.yaw -= dx * 0.0023 * k; P.pitch = clamp(P.pitch - dy * 0.0023 * k, -1.5, 1.5); };

  /* ================= what the player can see =================
     A command about "the table" may only touch a table that is in the picture: inside the camera's frustum, not behind a building, not behind a wall.
     If there is none in sight the answer is "I can't see one", never "then the nearest one somewhere else". */
  const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _wb = new THREE.Box3();
  function rayBox(o, P, dir, maxT) { // where a ray enters o's box (in world metres), or -1
    const c = Math.cos(o.rot), s = Math.sin(o.rot), ox = P.x - o.x, oy = P.y - o.y, oz = P.z - o.z;
    const lo = [(ox * c - oz * s) / o.s[0], oy / o.s[1], (ox * s + oz * c) / o.s[2]], ld = [(dir.x * c - dir.z * s) / o.s[0], dir.y / o.s[1], (dir.x * s + dir.z * c) / o.s[2]], mn = [o.box.min.x, o.box.min.y, o.box.min.z], mx = [o.box.max.x, o.box.max.y, o.box.max.z];
    let t0 = 0, t1 = maxT; for (let i = 0; i < 3; i++) { if (Math.abs(ld[i]) < 1e-7) { if (lo[i] < mn[i] || lo[i] > mx[i]) return -1; } else { let a = (mn[i] - lo[i]) / ld[i], b = (mx[i] - lo[i]) / ld[i]; if (a > b) { const q = a; a = b; b = q; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return -1; } }
    return t0;
  }
  // What is solid of a building is its walls (its footprint), not everything inside its outline: a porch, a roof overhang and the steps are air
  // you can stand in and see through. -1: the ray only passes through that air. Used for what the crosshair is on and for what hides what.
  const walled = (o, def) => !!(def && def.cls === 'building' && def.foot && o.foot && o.box);
  function wallsT(o, P, dir, maxT) {
    const hx = o.foot[0] / (2 * o.s[0]), hz = o.foot[1] / (2 * o.s[2]), c = Math.cos(o.rot), s = Math.sin(o.rot), ox = P.x - o.x, oy = P.y - o.y, oz = P.z - o.z;
    const lo = [(ox * c - oz * s) / o.s[0], oy / o.s[1], (ox * s + oz * c) / o.s[2]], ld = [(dir.x * c - dir.z * s) / o.s[0], dir.y / o.s[1], (dir.x * s + dir.z * c) / o.s[2]], mn = [-hx, o.box.min.y, -hz], mx = [hx, o.box.max.y, hz];
    let t0 = 0, t1 = maxT; for (let i = 0; i < 3; i++) { if (Math.abs(ld[i]) < 1e-7) { if (lo[i] < mn[i] || lo[i] > mx[i]) return -1; } else { let a = (mn[i] - lo[i]) / ld[i], b = (mx[i] - lo[i]) / ld[i]; if (a > b) { const q = a; a = b; b = q; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return -1; } }
    return t0;
  }
  YX.seen = function (o) {
    if (!o || o.dead || !o.box || !o.holder) return false;
    const inB = YX.insideOf ? YX.insideOf() : null, ro = YX.roomOf(o);
    if (o === inB) return true; if (inB ? ro !== inB.id : ro != null) return false; // walls: indoors only this room, outdoors nothing that is inside a building
    camera.updateMatrixWorld(); _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _fr.setFromProjectionMatrix(_pm);
    o.holder.updateMatrixWorld(true); _wb.copy(o.box).applyMatrix4(o.holder.matrixWorld); if (!_fr.intersectsBox(_wb)) return false;
    if (inB) return true;
    const P = camera.position, cx = (_wb.min.x + _wb.max.x) / 2, cz = (_wb.min.z + _wb.max.z) / 2;
    for (const py of [(_wb.min.y + _wb.max.y) / 2, _wb.max.y - 0.05]) { // its middle or its top must have a clear line to the eye
      const dx = cx - P.x, dy = py - P.y, dz = cz - P.z, L = Math.hypot(dx, dy, dz) || 0.01, dir = { x: dx / L, y: dy / L, z: dz / L }; let hid = false;
      for (const b of W.objs.values()) { if (b === o || b.dead || !b.box || b.attach || (o.attach && o.attach.to === b.id)) continue; const bd = YX.defOf(b); if (!bd || bd.cls !== 'building' || bd.solid === false) continue; const t = walled(b, bd) ? wallsT(b, P, dir, L) : rayBox(b, P, dir, L); if (t >= 0 && t < L - 0.3) { hid = true; break; } }
      if (!hid) return true;
    }
    return false;
  };

  /* ================= aim ================= */
  const _dir = new THREE.Vector3(), _m4 = new THREE.Matrix4();
  /* where a line of sight really meets a thing: its own surfaces, not the box round it. A rover on a hillside stands inside the hill's box, a person on a porch inside the house's,
     and a box says nothing about the gaps between a rover's legs. So boxes only choose who is worth asking; the surfaces answer. */
  const _rc = new THREE.Raycaster(), _rh = [], _rd = new THREE.Vector3(), _rr = new THREE.Vector3(), _ru = new THREE.Vector3(); _rc.layers.enableAll();
  function meshT(o, P, dir) {
    if (!o.mesh) return -1; _rc.ray.origin.copy(P); _rc.ray.direction.copy(dir); _rc.near = 0.05; _rc.far = 175; _rc.camera = camera; _rh.length = 0;
    try { o.mesh.updateWorldMatrix(true, true); _rc.intersectObject(o.mesh, true, _rh); } catch (e) { return -1; } // (a thing moved this frame has not been drawn yet: its matrices are brought up to date here)
    for (const h of _rh) if (h.object.isMesh && h.object.visible) return h.distance; return -1;
  }
  const terrainLike = (o, def) => !!def && (def.flat || def.cls === 'ground' || o.type === 'hill' || (def.solid === false && Math.max(o.foot ? o.foot[0] : 0, o.foot ? o.foot[1] : 0) > 8)); // what things stand on: it is meant only when nothing else is
  function updateAim() {
    const P = camera.position; camera.getWorldDirection(_dir);
    let best = null, bt = 1e9, bestFlat = null, bft = 1e9, cone = null, cb = 0.9975, mag = null, magS = 1, magT = 0, soft = null, st = 1e9, who = null, wt = 1e9; const cands = [];
    const inB = YX.insideOf ? YX.insideOf() : null; // indoors: the room's contents, then the building itself; outdoors: nothing that is inside a building
    for (const o of W.objs.values()) {
      if (o.dead || o === W.grabbed || !o.box) continue;
      if (o === inB) continue; const ro = YX.roomOf(o); if (inB ? ro !== inB.id : ro != null) continue;
      const def = YX.defOf(o), ex = o.x - P.x, ez = o.z - P.z; if (ex * ex + ez * ez > 170 * 170) continue;
      const c = Math.cos(o.rot), s = Math.sin(o.rot), ox = P.x - o.x, oy = P.y - o.y, oz = P.z - o.z;
      const lo = [(ox * c - oz * s) / o.s[0], oy / o.s[1], (ox * s + oz * c) / o.s[2]], ld = [(_dir.x * c - _dir.z * s) / o.s[0], _dir.y / o.s[1], (_dir.x * s + _dir.z * c) / o.s[2]];
      const mn = [o.box.min.x, o.box.min.y, o.box.min.z], mx = [o.box.max.x, o.box.max.y, o.box.max.z];
      let t0 = 0, t1 = 1e9, hit = true;
      for (let i = 0; i < 3; i++) { if (Math.abs(ld[i]) < 1e-7) { if (lo[i] < mn[i] || lo[i] > mx[i]) { hit = false; break; } } else { let a = (mn[i] - lo[i]) / ld[i], b = (mx[i] - lo[i]) / ld[i]; if (a > b) { const q = a; a = b; b = q; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) { hit = false; break; } } }
      if (hit && t0 < 160) {
        if (def && def.flat) { if (t0 < bft) { bft = t0; bestFlat = o; } }
        else {
          cands.push({ o, def, t0, t1 });
          if (def && def.cls === 'creature' && t0 < wt && !(o.attach && (YX.defOf(W.objs.get(o.attach.to)) || {}).cls === 'vehicle')) { wt = t0; who = o; }
        }
      }
      if (!hit && def && def.cls === 'creature' && o.size) { // the living are small and do not stand still: the crosshair only has to pass close by one
        const cy0 = o.y + o.size[1] / 2 - P.y, tt = ex * _dir.x + cy0 * _dir.y + ez * _dir.z;
        if (tt > 0.6 && tt < 60) { const lat = Math.hypot(_dir.x * tt - ex, _dir.z * tt - ez), tol = Math.max(o.size[0], o.size[2]) / 2 + Math.max(0.3, tt * 0.022); if (lat < tol && Math.abs(_dir.y * tt - cy0) < o.size[1] / 2 + Math.max(0.3, tt * 0.02) && lat / tol < magS) { magS = lat / tol; mag = o; magT = tt; } } }
      if (!hit && !(def && def.flat)) { const cy = o.y + o.size[1] / 2 - P.y, d = Math.hypot(ex, cy, ez); if (d < 90 && d > 0.5) { const dot = (ex * _dir.x + cy * _dir.y + ez * _dir.z) / d; if (dot > cb) { cb = dot; cone = o; } } }
    }
    { // of everything whose box the line of sight passes through, nearest first: which one does it actually meet?
      cands.sort((a, b) => a.t0 - b.t0); let E = null, Et = 1e9; const miss = [];
      for (let i = 0; i < cands.length && i < 14; i++) { const c = cands[i]; if (c.t0 > Et) break; const t = meshT(c.o, P, _dir); if (t < 0) { if (!terrainLike(c.o, c.def)) miss.push(c); continue; } if (t < Et) { Et = t; E = c; } }
      // the crosshair is not a point: lines a little to each side of it are tried on the things it only just missed
      const ring = (list, radii, lim) => { if (!list.length) return null; _rr.crossVectors(_dir, camera.up).normalize(); _ru.crossVectors(_rr, _dir).normalize(); for (const rad of radii) for (const c of list) for (let k = 0; k < 8; k++) { const a = k * 0.7854 + (rad > 0.02 ? 0.39 : 0); _rd.copy(_dir).addScaledVector(_rr, Math.cos(a) * rad).addScaledVector(_ru, Math.sin(a) * rad).normalize(); const t = meshT(c.o, P, _rd); if (t >= 0 && t < lim) return { c, t }; } return null; };
      if (E && !terrainLike(E.o, E.def)) { best = E.o; bt = Et;
        if (E.def.cls !== 'creature') { const r = ring(miss.filter((c) => c.t1 + 3 < Et && !walled(c.o, c.def)).sort((a, b) => a.o.fr - b.o.fr).slice(0, 3), [0.016], Et - 3); if (r) { best = r.c.o; bt = r.t; } } } // a lamp post a hair's breadth from the crosshair, with a tower far behind it: the lamp post
      else { // it meets only the ground, a hillside or the sky: whatever outline the crosshair is inside is meant (between a rover's legs, in the middle of a bicycle frame)
        const near = miss.filter((c) => c.t0 < Et).sort((a, b) => a.o.fr - b.o.fr).slice(0, 4), r = ring(near, [0.016, 0.034], Et + 0.5), loose = r ? null : near.find((c) => !walled(c.o, c.def));
        if (r) { best = r.c.o; bt = r.t; } else if (loose) { best = loose.o; bt = loose.t0; } else if (E) { best = E.o; bt = Et; }
        if (!best) { const b = near.find((c) => walled(c.o, c.def)); if (b) { soft = b.o; st = b.t0; } } // under a porch or the eaves, looking at nothing: the building, if nothing else turns up
      }
    }
    if (who && best && best !== who && bt < wt) { // the crosshair is squarely on someone who sits on, stands in or stands under the thing that was met first (a bench, a tree, a bus stop): they are meant
      const bd = YX.defOf(best) || {}, c = Math.cos(best.rot), s = Math.sin(best.rot), dx = who.x - best.x, dz = who.z - best.z, lx = (dx * c - dz * s) / best.s[0], lz = (dx * s + dz * c) / best.s[2];
      if (bd.cls !== 'creature' && bd.cls !== 'building' && bd.cls !== 'vehicle' && lx > best.box.min.x - 0.4 && lx < best.box.max.x + 0.4 && lz > best.box.min.z - 0.4 && lz < best.box.max.z + 0.4) { best = who; bt = wt; }
    }
    if (!best && soft) { best = soft; bt = st; } // nothing solid there: the building whose porch or eaves the crosshair is under
    if (mag && (!best || (bt > magT - 0.4 && (YX.defOf(best) || {}).cls !== 'creature')) && YX.seen(mag)) best = mag; // unless something really is in front of them, or the crosshair is squarely on another
    W.aim = best || cone || (bestFlat && bft < 60 ? bestFlat : null) || inB;
    const fy = inB && YX.floorOf ? inB.y + YX.floorOf(inB) * inB.s[1] : 0;
    // where "here" is: the first thing the line of sight meets. The ground if it gets there first; the near side of a house, a tree or a car if one is in the way
    // (not the ground somewhere behind it). aimOk says the crosshair really rests on something within reach, so a command with no place can use it.
    const tg = _dir.y < -0.02 ? Math.max(0.2, P.y - fy) / -_dir.y : Infinity, hitT0 = best && best !== inB && !(YX.defOf(best) || {}).flat ? (best === mag ? magT : bt) : Infinity, hitT = hitT0 >= 1 ? hitT0 : Infinity; // standing inside a tree's crown is not pointing at it
    if (!inB && hitT < tg && hitT < 70) { const t = Math.max(0.3, hitT - 0.6), l = Math.hypot(_dir.x, _dir.z) || 1, back = hitT - t; W.aimPoint = [P.x + _dir.x * hitT - (_dir.x / l) * back, P.z + _dir.z * hitT - (_dir.z / l) * back]; W.aimOk = true; }
    else if (tg < Infinity) { const t = Math.min(70, tg); W.aimPoint = [P.x + _dir.x * t, P.z + _dir.z * t]; W.aimOk = tg <= 70; }
    else { const l = Math.hypot(_dir.x, _dir.z) || 1; W.aimPoint = [P.x + (_dir.x / l) * 14, P.z + (_dir.z / l) * 14]; W.aimOk = false; }
    if (inB) W.aimOk = true;
    if (inB && YX.roomClamp) W.aimPoint = YX.roomClamp(inB, W.aimPoint[0], W.aimPoint[1], 0.35); // indoors the crosshair lands on the room floor
    const a = W.grabbed || W.aim;
    if (a && !cine.active) { const b = a.box, sx = b.max.x - b.min.x, sy = b.max.y - b.min.y, sz = b.max.z - b.min.z; a.holder.updateMatrix(); _m4.makeScale(sx + 0.1, sy + 0.1, sz + 0.1).setPosition((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2); aimBox.matrix.multiplyMatrices(a.holder.matrix, _m4); aimBox.matrixWorldNeedsUpdate = true; aimBox.visible = true; aimBox.material.opacity = W.grabbed ? 0.9 : 0.32; aimBox.material.color.setHex(W.grabbed ? 0xe0533a : 0xffffff); }
    else aimBox.visible = false;
  }

  /* ================= become / hop / gravity ================= */
  YX.become = function (o, type, params, opt) { // turn an object into another type where it stands
    const def = G[type]; if (!o || o.dead || !def) return null; opt = opt || {};
    const old = YX.defOf(o) || {}, road = o.type === 'road' || type === 'road';
    killTw(o, 's'); if (o.pv) { o.holder.remove(o.pv); YX.disposeGroup(o.pv); o.pv = null; }
    o.type = type; o.params = YX.fillParams(def, params || {}, YX.rng(o.seed ^ 0x9e3779b9)); o.psize = null; o.tint = null; o.ghost = false;
    if (!opt.keepScale) o.s = [1, 1, 1]; if (opt.name != null) o.name = opt.name;
    YX.rebuild(o, { grow: true });
    if (!o.attach) {
      const m = def.motion || 'none';
      if ((old.motion || 'none') !== m || o.type === 'person' || o.type === 'bird') { o.motion = m; o.ms = null; if (o.type === 'bird') o.motion = o.params.pose === 'fly' ? 'fly' : 'none'; if (o.type === 'person') o.motion = o.params.pose === 'walk' ? 'wander' : 'none'; if ((def.cls === 'sky' || o.motion === 'fly') && o.y < 3) o.y = def.alt || 12; }
      YX.initMotion(o);
    }
    o.bank = 0; syncHolder(o); if (road) { roadsCache = null; YX.recomputeRoads(); } YX.markDirty();
    return o;
  };
  /* realistic physics: what each kind of thing is able to do. Enforced here, whatever an instruction says */
  YX.strict = true;
  const hasRider = (o) => Array.from(o.kids).some((id) => (W.objs.get(id) || {}).type === 'person');
  YX.holdDoor = function (B, secs) { if (B && B.anims) for (const a of B.anims) if (a.spec && a.spec.hinge) a.hold = Math.max(a.hold || 0, secs); }; // someone is at the door: its leaf swings open and stays so for a moment
  YX.canDo = function (o, m) {
    const d = YX.defOf(o) || {};
    if (m === 'drive' && d.ride) return hasRider(o); // a bicycle only moves with someone on it
    if (!YX.strict || !m || m === 'none') return true;
    if (m === 'fly' || m === 'hover' || m === 'drift') return d.cls === 'sky' || d.motion === 'fly' || d.motion === 'hover' || d.motion === 'drift';
    if (m === 'drive') return d.cls === 'vehicle';
    if (m === 'wander' || m === 'goto' || m === 'follow') return d.cls === 'creature';
    if (m === 'route') return o.route && o.route.pts && o.route.pts.some((p) => p[1] > 1.2) ? YX.canDo(o, 'fly') : d.cls === 'creature' || d.cls === 'vehicle' || YX.canDo(o, 'fly');
    return true;
  };
  YX.mount = function (o, bike) { // put a person on a bicycle (one appears if none is near) and ride
    if (!o || o.dead || o.type !== 'person') return null;
    const free = (b) => !!b && b.type === 'bicycle' && !b.dead && !Array.from(b.kids).some((id) => (W.objs.get(id) || {}).type === 'person');
    if (o.attach && (W.objs.get(o.attach.to) || {}).type === 'bicycle') return W.objs.get(o.attach.to);
    if (!free(bike)) { bike = null; let bd = 12; for (const b of W.objs.values()) if (free(b)) { const d = Math.hypot(b.x - o.x, b.z - o.z); if (d < bd) { bd = d; bike = b; } } }
    if (!bike) { let x = o.x, z = o.z, rot = o.rot; const nr = YX.nearestRoad(o.x, o.z, 16);
      if (nr) { const sd = nr.lat >= 0 ? 1 : -1, off = sd * Math.max(0.6, nr.r.w / 2 - 0.45); x = nr.r.x + nr.r.dx * nr.t - nr.r.dz * off; z = nr.r.z + nr.r.dz * nr.t + nr.r.dx * off; rot = Math.atan2(nr.r.dx * sd, nr.r.dz * sd); }
      bike = YX.spawn({ type: 'bicycle', x, z, rot }, { animate: true, quiet: true }); }
    if (!bike) return null;
    if (o.y > 0.01) o.y = 0; YX.attachTo(o, bike, 'seat'); YX.markDirty();
    return bike;
  };
  function leadHold(lead) { // which of the leader's hands are taken by people walking beside them
    if (!lead || lead.type !== 'person') return; let l = false, r = false;
    for (const f of W.objs.values()) if (f.motion === 'follow' && f.ms && f.ms.lead === lead.id && f.type === 'person' && !f.ms.back && f.ms.hold) { if (f.ms.side > 0) r = true; else l = true; }
    const want = l && r ? 'both' : r ? 'right' : l ? 'left' : 'none';
    if ((lead.params.hold || 'none') !== want) { lead.params.hold = want; YX.rebuild(lead); }
  }
  YX.follow = function (o, lead, opt) { // walk with someone: beside them, hand in hand when both are people
    opt = opt || {}; if (!o || !lead || o === lead || o.dead || lead.dead) return false;
    if (lead.motion === 'follow' && lead.ms && lead.ms.lead === o.id) { YX.unfollow(lead); if (lead.type === 'person') { lead.motion = lead.params.pose === 'walk' ? 'wander' : 'none'; YX.initMotion(lead); } }
    if (o.motion === 'follow') YX.unfollow(o);
    YX.detach(o); if (o.y > 0.01 && o.motion !== 'fly') o.y = 0;
    const taken = new Set(); for (const f of W.objs.values()) if (f !== o && f.motion === 'follow' && f.ms && f.ms.lead === lead.id) taken.add(f.ms.side + ':' + (f.ms.back || 0));
    let side = opt.side === 'left' ? -1 : opt.side === 'right' ? 1 : 0, back = /behind|back/.test(String(opt.side || '')) ? 1 : 0;
    if (!side) { if (!back && !taken.has('1:0')) side = 1; else if (!back && !taken.has('-1:0')) side = -1; else { let k = Math.max(1, back); while (taken.has('1:' + k) && taken.has('-1:' + k)) k++; back = k; side = taken.has('1:' + k) ? -1 : 1; } }
    const both = o.type === 'person' && lead.type === 'person', hold = both && !back && opt.hold !== false && !lead.attach;
    o.motion = 'follow'; o.ms = { lead: lead.id, side, gap: opt.gap != null && isFinite(+opt.gap) ? clamp(+opt.gap, 0.4, 6) : both ? 0.58 : 0.8, back, hold: hold ? 1 : 0 };
    if (o.type === 'person') { const b4 = JSON.stringify(o.params); o.params.pose = 'walk'; o.params.hold = hold ? (side > 0 ? 'left' : 'right') : 'none'; if (b4 !== JSON.stringify(o.params)) YX.rebuild(o); }
    leadHold(lead); syncHolder(o); YX.markDirty();
    return true;
  };
  YX.unfollow = function (o) {
    if (!o || o.motion !== 'follow') return; const lead = W.objs.get(o.ms && o.ms.lead);
    o.motion = 'none'; o.ms = null; o.vel = 0;
    if (o.type === 'person' && o.params.hold && o.params.hold !== 'none') { o.params.hold = 'none'; YX.rebuild(o); }
    leadHold(lead); YX.markDirty();
  };
  YX.hop = function (o, n, h) { // a real jump: up and back down
    if (!o || o.dead || o.attach || o.y > 0.6 || ['fly', 'hover', 'drift'].includes(o.motion)) return false;
    n = clamp(Math.round(n || 3), 1, 20); h = h || clamp(o.size[1] * 0.32, 0.25, 1.4); killTw(o, 'j');
    const tw = (o.tw.j = YX.tween(0.56 * n, (e, k) => { const u = k >= 1 ? 0 : (k * n) % 1; o.y = h * 4 * u * (1 - u); syncHolder(o); if (o.kids.size) updateKids(o); }, { ease: YX.ease.lin, done: () => { if (o.tw.j === tw) o.tw.j = null; o.y = 0; syncHolder(o); } }));
    return true;
  };
  const floats = (d) => d.cls === 'sky' || d.cls === 'ground' || !!d.float; // only the sky, the ground itself and hanging lights are exempt
  YX.isHeavy = (o) => { const d = YX.defOf(o); return !!(d && !floats(d) && o.type !== '__pending' && !o.attach && !['fly', 'hover', 'drift', 'route'].includes(o.motion)); };
  function gravity(o, dt) { // things that cannot fly do not stay in the air
    if (o.attach || o === W.grabbed || o.hold || (o.tw && (o.tw.m || o.tw.j))) return;
    const m = o.motion; if (m === 'fly' || m === 'hover' || m === 'drift' || m === 'drive' || m === 'route') return;
    if (m === 'goto' && o.ms && o.ms.via && o.ms.via.length) return; // on a floor above the ground, walking across it or down the step
    const def = YX.defOf(o); if (!def || floats(def) || o.type === '__pending') return;
    const g = W.env.gravity == null ? 1 : W.env.gravity; if (!g) { o.vy = 0; return; } // no gravity: things stay where they were put
    o.vy = (o.vy || 0) + 26 * g * dt; o.y -= o.vy * dt;
    if (o.y <= 0) { o.y = 0; if (o.vy > 6) YX.fx.ring(o.x, o.z, Math.max(0.8, o.fr), 0xffffff); o.vy = 0; }
    syncHolder(o); if (o.kids.size) updateKids(o);
  }

  /* ================= fx ================= */
  YX.fx = {
    ring(x, z, r, color) { const m = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 56).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: color || 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, fog: false })); m.position.set(x, 0.22, z); m.layers.set(2); scene.add(m); YX.tween(0.7, (k) => { const s = r * (0.3 + k * 1.1); m.scale.set(s, 1, s); m.material.opacity = 0.8 * (1 - k); }, { done: () => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); } }); },
    work(o, text) { // the object stays where it is, framed and scanned, while its replacement is being written
      if (!o || o.dead || !o.box) return null; if (o.wk) o.wk.stop();
      const c = '#e0533a', bx = o.box, w = bx.max.x - bx.min.x + 0.16, h = Math.max(0.3, bx.max.y) + 0.12, d = bx.max.z - bx.min.z + 0.16, e = clamp(Math.max(w, d) * 0.012, 0.035, 0.09);
      const B = YX.makeBuilder(1), b = B.b;
      b.group({ x: (bx.min.x + bx.max.x) / 2, z: (bx.min.z + bx.max.z) / 2 }, () => {
        b.box(w, h, d, c, 0, 0, 0, { opacity: 0.07, emissive: c, noShadow: true });
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(e, h, e, c, (sx * w) / 2, 0, (sz * d) / 2, { emissive: c, noShadow: true });
        for (const y of [0, h]) { for (const sz of [-1, 1]) b.box(w, e, e, c, 0, y, (sz * d) / 2, { emissive: c, noShadow: true }); for (const sx of [-1, 1]) b.box(e, e, d, c, (sx * w) / 2, y, 0, { emissive: c, noShadow: true }); }
        b.group({ y: h / 2, anim: { bob: { amp: h / 2 - 0.05, freq: 0.42 } } }, () => b.box(w, 0.04, d, c, 0, 0, 0, { opacity: 0.42, emissive: c, noShadow: true }));
      });
      const r = YX.realize(B.root); r.group.traverse((m) => m.layers.set(2)); o.holder.add(r.group);
      const mk = (txt) => { const LB = YX.makeBuilder(1); LB.b.text(txt, clamp(Math.max(o.size[0], o.size[2]) * 0.1, 0.32, 1.1), '#ffffff', 0, 0, 0, { bg: '#b8371f' }); const g = YX.realize(LB.root).group; g.traverse((m) => m.layers.set(2)); return g; };
      let lbl = mk(text); scene.add(lbl);
      const fx = { o, dead: false,
        set(t2) { if (fx.dead || t2 === text) return; text = t2; scene.remove(lbl); YX.disposeGroup(lbl); lbl = mk(text); scene.add(lbl); },
        stop() { if (fx.dead) return; fx.dead = true; tw.kill(); if (r.group.parent) r.group.parent.remove(r.group); YX.disposeGroup(r.group); scene.remove(lbl); YX.disposeGroup(lbl); if (o.wk === fx) o.wk = null; } };
      const tw = YX.tween(1e7, () => { if (o.dead) { fx.stop(); return; } YX.applyAnims(r.anims, W.time, 0.016, 0); lbl.position.set(o.x, o.y + o.size[1] + 0.75, o.z); lbl.rotation.y = Math.atan2(camera.position.x - o.x, camera.position.z - o.z); lbl.visible = !cine.active; }, { ease: YX.ease.lin });
      o.wk = fx; return fx;
    },
    flash(o, color, dur) { if (!o || !o.box) return; const ls = new THREE.LineSegments(YX.edgeGeom, new THREE.LineBasicMaterial({ color: color || 0xe0533a, transparent: true, opacity: 1, depthTest: false, fog: false })); ls.matrixAutoUpdate = false; ls.renderOrder = 60; ls.layers.set(2); scene.add(ls); const m = new THREE.Matrix4(); YX.tween(dur || 0.9, (k) => { if (o.dead) { ls.visible = false; return; } const b = o.box, g = 0.12 + k * 0.3; o.holder.updateMatrix(); m.makeScale(b.max.x - b.min.x + g, b.max.y - b.min.y + g, b.max.z - b.min.z + g).setPosition((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2); ls.matrix.multiplyMatrices(o.holder.matrix, m); ls.matrixWorldNeedsUpdate = true; ls.material.opacity = 1 - k; }, { ease: YX.ease.lin, done: () => { scene.remove(ls); ls.material.dispose(); } }); },
  };

  /* ================= frame ================= */
  let last = 0, lampT = 0, aimSkip = 0, fpsAcc = 0, fpsN = 0;
  YX.stats = { fps: 60, calls: 0, tris: 0 };
  YX.afterRender = null;
  YX.frame = function (now) {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now; W.time += dt; frameNo++;
    YX.updateTweens(dt);
    updatePlayer(dt);
    if (W.grabbed) { const g = W.grabbed, P = W.player, a = P.yaw + (W.grabA || 0), d = W.grabD || 8; g.x = P.x - Math.sin(a) * d; g.z = P.z - Math.cos(a) * d; syncHolder(g); if (g.kids.size) updateKids(g); }
    const t = W.time, P = W.player;
    for (const o of W.objs.values()) {
      if (o.motion && o.motion !== 'none') updateMotion(o, dt, t);
      if (o.y > 0.0005) gravity(o, dt); else if (o.vy) o.vy = 0;
      if (o.anims.length) { const dx = o.x - P.x, dz = o.z - P.z; if (dx * dx + dz * dz < 150 * 150) YX.applyAnims(o.anims, t + (o.seed % 97) * 0.1, dt, o.attach ? (W.objs.get(o.attach.to) || {}).vel || 0 : o.vel); }
    }
    if (YX.onFrame) YX.onFrame(dt);
    applyEnv(dt);
    if (++aimSkip % 2 === 0) updateAim();
    lampT -= dt; if (lampT <= 0) { lampT = 0.4; assignLights(); }
    renderer.shadowMap.needsUpdate = true; renderer.info.reset();
    if (YX.afterRender || YX.film) aimBox.visible = false;
    if (YX.rigFrame && YX.rigFrame(renderer, scene, camera)) { /* three cameras filming: they fill the frame side by side */ }
    else if (clay) {
      renderer.autoClear = true; camera.layers.set(1); renderer.render(scene, camera);
      renderer.autoClear = false; camera.layers.set(0); scene.overrideMaterial = clayMat; renderer.render(scene, camera); scene.overrideMaterial = null;
      renderer.shadowMap.needsUpdate = false; camera.layers.set(2); renderer.render(scene, camera); camera.layers.enableAll(); renderer.autoClear = true;
    } else if (!(YX.post && YX.post.render(renderer, scene, camera))) renderer.render(scene, camera); // the finished frame goes through the bloom and the grade when the machine can
    if (YX.rigAfter) YX.rigAfter(); // the monitors of the standing cameras
    if (YX.afterRender) { const f = YX.afterRender; YX.afterRender = null; try { f(renderer.domElement); } catch (e) { console.warn(e); } }
    fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { YX.stats.fps = Math.round(fpsN / fpsAcc); YX.stats.calls = renderer.info.render.calls; YX.stats.tris = renderer.info.render.triangles; fpsAcc = 0; fpsN = 0; }
  };
  function assignLights() {
    const P = W.player, list = [], night = cur.night;
    for (const o of W.objs.values()) { const def = YX.defOf(o); if (!def || !def.light || o.dead || o.lights === false) continue; const always = !!def.light.always; if (!always && night < 0.05) continue; const d = Math.hypot(o.x - P.x, o.z - P.z); if (d > 90) continue; list.push({ o, def, d: d - (always ? 30 : 0), always }); }
    list.sort((a, b) => a.d - b.d);
    for (let i = 0; i < lightPool.length; i++) {
      const pl = lightPool[i], e = list[i];
      if (!e) { pl.intensity = 0; continue; }
      const lp = e.def.light.pos, o = e.o, c = Math.cos(o.rot), s = Math.sin(o.rot), hk = e.def.light.always ? (o.params.height || 2.4) / 2.4 : (o.params.height || 4.4) / 4.4;
      const lx = lp[0] * o.s[0], ly = lp[1] * hk * o.s[1], lz = lp[2] * o.s[2];
      pl.position.set(o.x + lx * c + lz * s, o.y + ly, o.z - lx * s + lz * c);
      const col = L(e.always ? o.params.color || '#ffe6b0' : e.def.light.color || '#ffd9a0'); pl.color.setRGB(col[0], col[1], col[2]);
      pl.intensity = e.always ? (o.params.power || 1.5) * (0.5 + 0.9 * night) : 1.3 * night; pl.distance = e.always ? 14 + (o.params.power || 1.5) * 9 : 20;
    }
  }

  /* ================= persistence ================= */
  YX.serialize = function () {
    const objs = [];
    for (const o of W.objs.values()) { if (o.dead || o.type === '__pending') continue; const d = { id: o.id, type: o.type, params: o.params, x: +o.x.toFixed(3), y: +o.y.toFixed(3), z: +o.z.toFixed(3), rot: +o.rot.toFixed(4), seed: o.seed }; if (o.s[0] !== 1 || o.s[1] !== 1 || o.s[2] !== 1) d.s = o.s.map((v) => +v.toFixed(4)); if (o.name) d.name = o.name; if (o.tint) d.tint = o.tint; if (o.lights === false) d.lights = false; if (o.route && o.motion === 'route') d.route = o.route; if (o.attach) d.attach = o.attach; if (o.speed) d.speed = o.speed; if (o.flight) d.flight = o.flight; d.motion = o.motion === 'goto' ? 'none' : o.motion; if (o.ms && o.motion !== 'goto') d.ms = o.ms; objs.push(d); }
    const custom = {}; for (const k in YX.custom) custom[k] = { meta: YX.custom[k].meta, code: YX.custom[k].code };
    const P = W.player;
    return { v: 1, nextId: W.nextId, env: Object.assign({}, W.env), objs, custom, shots: W.shots, player: { x: P.x, y: P.y, z: P.z, yaw: P.yaw, pitch: P.pitch, fly: P.fly, lens: P.lens } };
  };
  YX.restore = function (data, opt) {
    opt = opt || {};
    if (!data || !Array.isArray(data.objs)) return false;
    if (data.custom) for (const k in data.custom) if (!YX.custom[k] || YX.custom[k].code !== data.custom[k].code) YX.registerCustom(data.custom[k].meta, data.custom[k].code, true);
    const keep = new Map();
    for (const d of data.objs) keep.set(d.id, d);
    for (const o of Array.from(W.objs.values())) { const d = keep.get(o.id); if (!d || d.type !== o.type || o.type === '__pending') YX.removeObj(o); }
    const order = data.objs.slice().sort((a, b) => (a.attach ? 1 : 0) - (b.attach ? 1 : 0));
    for (const d of order) {
      if (!YX.defOf(d.type)) continue;
      const o = W.objs.get(d.id);
      if (!o) { YX.spawn(JSON.parse(JSON.stringify(d)), { animate: !!opt.animate }); continue; }
      const pj = JSON.stringify(o.params), changed = pj !== JSON.stringify(d.params) || (o.tint || null) !== (d.tint || null) || (o.name || '') !== (d.name || '') || o.seed !== d.seed;
      YX.detach(o, true); killTw(o);
      o.params = JSON.parse(JSON.stringify(d.params)); o.tint = d.tint || null; o.lights = d.lights === false ? false : null; o.name = d.name || ''; o.seed = d.seed; o.x = d.x; o.y = d.y; o.z = d.z; o.rot = d.rot; o.s = d.s ? d.s.slice() : [1, 1, 1]; o.motion = d.motion || 'none'; o.ms = d.ms ? JSON.parse(JSON.stringify(d.ms)) : null; o.speed = d.speed || null; o.flight = d.flight || null; o.route = d.route ? JSON.parse(JSON.stringify(d.route)) : null; o.bank = 0;
      if (d.attach) { const p = W.objs.get(d.attach.to); if (p) { o.attach = Object.assign({}, d.attach); p.kids.add(o.id); } }
      if (changed) YX.rebuild(o, { grow: true }); else measure(o);
      syncHolder(o);
    }
    for (const o of W.objs.values()) { if (o.attach) { placeOnParent(o); syncHolder(o); } YX.initMotion(o); }
    W.nextId = Math.max(W.nextId, data.nextId || 1);
    if (data.env) { Object.assign(W.env, data.env); renderer.domElement.style.filter = LOOKS[W.env.look] || ''; YX.setEnv({}, { instant: !!opt.instant }); }
    if (Array.isArray(data.shots)) W.shots = JSON.parse(JSON.stringify(data.shots));
    if (data.player && opt.player) Object.assign(W.player, data.player, { vx: 0, vz: 0 });
    YX.recomputeRoads();
    return true;
  };
  YX.markDirty = function () { if (dirtyTimer) return; dirtyTimer = setTimeout(() => { dirtyTimer = null; try { YX.onChange(); } catch (e) {} }, 900); };
  YX.measure = measure;
})();
