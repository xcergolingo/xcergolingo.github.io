/* Spoken World — the light that spills, and the grade.
   The picture is drawn into a buffer first. What is bright in it (lamps, lit windows, signs, the sun on a white wall) is spread softly over
   its surroundings, a little by day and a lot by night, and the whole frame gets one consistent grade: a touch more contrast and colour,
   warm lights against cool shadows, the corners held back. It is one pass over the finished frame, so it serves everything in the world
   alike — what exists now and what gets invented later. Switched off on low quality and where the browser cannot do it. */
(function () {
  'use strict';
  const YX = window.YX, THREE = window.THREE;
  if (!THREE || !THREE.WebGLMultisampleRenderTarget) return;
  let off = false; try { off = localStorage.getItem('yanchu.post') === '0'; } catch (e) {}
  const LV = 5, VS = 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }';
  const mat = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, toneMapped: false });
  const TAPS = 'vec3 four( sampler2D m, vec2 uv, vec2 t ) { return 0.25 * ( texture2D( m, uv + t * vec2( -1.0, -1.0 ) ).rgb + texture2D( m, uv + t * vec2( 1.0, -1.0 ) ).rgb + texture2D( m, uv + t * vec2( -1.0, 1.0 ) ).rgb + texture2D( m, uv + t * vec2( 1.0, 1.0 ) ).rgb ); }\n';
  const mBright = mat('uniform sampler2D tMap;\nuniform vec2 uTexel;\nuniform float uThr;\nvarying vec2 vUv;\n' + TAPS + 'void main() { vec3 c = four( tMap, vUv, uTexel * 0.5 ); float l = max( c.r, max( c.g, c.b ) ); gl_FragColor = vec4( c * smoothstep( uThr, uThr + 0.2, l ), 1.0 ); }', { tMap: { value: null }, uTexel: { value: new THREE.Vector2() }, uThr: { value: 0.9 } });
  const mDown = mat('uniform sampler2D tMap;\nuniform vec2 uTexel;\nvarying vec2 vUv;\n' + TAPS + 'void main() { gl_FragColor = vec4( four( tMap, vUv, uTexel ), 1.0 ); }', { tMap: { value: null }, uTexel: { value: new THREE.Vector2() } });
  const mUp = mat('uniform sampler2D tMap;\nuniform sampler2D tAdd;\nuniform vec2 uTexel;\nvarying vec2 vUv;\nvoid main() { vec2 t = uTexel; vec3 s = texture2D( tMap, vUv ).rgb * 4.0;\n s += ( texture2D( tMap, vUv + vec2( t.x, 0.0 ) ).rgb + texture2D( tMap, vUv - vec2( t.x, 0.0 ) ).rgb + texture2D( tMap, vUv + vec2( 0.0, t.y ) ).rgb + texture2D( tMap, vUv - vec2( 0.0, t.y ) ).rgb ) * 2.0;\n s += texture2D( tMap, vUv + t ).rgb + texture2D( tMap, vUv - t ).rgb + texture2D( tMap, vUv + vec2( t.x, -t.y ) ).rgb + texture2D( tMap, vUv + vec2( -t.x, t.y ) ).rgb;\n gl_FragColor = vec4( s / 16.0 + texture2D( tAdd, vUv ).rgb, 1.0 ); }', { tMap: { value: null }, tAdd: { value: null }, uTexel: { value: new THREE.Vector2() } });
  const mOut = mat('uniform sampler2D tMap;\nuniform sampler2D tBloom;\nuniform float uBloom;\nuniform float uExp;\nuniform float uSat;\nuniform float uCon;\nuniform float uTone;\nuniform float uVig;\nvarying vec2 vUv;\nvoid main() {\n vec3 c = clamp( texture2D( tMap, vUv ).rgb, 0.0, 1.0 ), b = clamp( texture2D( tBloom, vUv ).rgb * uBloom, 0.0, 1.0 );\n c = 1.0 - ( 1.0 - c * uExp ) * ( 1.0 - b );\n c = clamp( c, 0.0, 1.0 );\n float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );\n c = mix( vec3( l ), c, uSat );\n c = clamp( c, 0.0, 1.0 );\n c = mix( c, c * c * ( 3.0 - 2.0 * c ), uCon );\n c += ( vec3( 0.03, 0.012, -0.03 ) * smoothstep( 0.5, 1.0, l ) + vec3( -0.014, 0.0, 0.022 ) * ( 1.0 - smoothstep( 0.0, 0.45, l ) ) ) * uTone;\n vec2 q = vUv - 0.5; c *= 1.0 - dot( q, q ) * uVig;\n c += ( fract( sin( dot( gl_FragCoord.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ) - 0.5 ) / 255.0;\n gl_FragColor = vec4( c, 1.0 );\n}', { tMap: { value: null }, tBloom: { value: null }, uBloom: { value: 0.3 }, uExp: { value: 1 }, uSat: { value: 1.1 }, uCon: { value: 0.16 }, uTone: { value: 1 }, uVig: { value: 0.22 } });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mOut), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), sc = new THREE.Scene(); quad.frustumCulled = false; sc.add(quad);
  let rt = null, down = [], up = [], W0 = 0, H0 = 0, bad = false; const size = new THREE.Vector2();
  const small = (w, h) => { const t = new THREE.WebGLRenderTarget(Math.max(2, w), Math.max(2, h), { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false }); t.texture.generateMipmaps = false; return t; };
  function build(w, h) {
    if (rt) rt.dispose(); for (const t of down) t.dispose(); for (const t of up) t.dispose(); down = []; up = [];
    // the frame is written exactly as it would be to the screen; with a stencil the depth is 24 bits (the default 16 makes a road flicker against the ground under it)
    rt = new THREE.WebGLMultisampleRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: true }); rt.samples = 4; rt.texture.encoding = THREE.sRGBEncoding; rt.texture.generateMipmaps = false;
    for (let i = 0; i < LV; i++) { const d = 2 << i; down.push(small(Math.round(w / d), Math.round(h / d))); up.push(small(Math.round(w / d), Math.round(h / d))); }
    W0 = w; H0 = h;
  }
  const pass = (R, m, target) => { quad.material = m; R.setRenderTarget(target); R.render(sc, cam); };
  /* the world seen from under the ground, for wet roads to show: the camera mirrored in the ground plane, everything that is itself ground left out */
  let refl = null, hidden = [], hideT = 0; const mcam = new THREE.PerspectiveCamera(), MH = 0.07; mcam.matrixAutoUpdate = false;
  function mirror(R, scene, camera, w, h) {
    const U = YX.wetUni, W = YX.world; if (!U || U.uWet.value < 0.01 || YX.post.mirrorOn === false) return;
    const rw = Math.max(2, w >> 1), rh = Math.max(2, h >> 1);
    if (!refl || refl.width !== rw || refl.height !== rh) { if (refl) refl.dispose(); refl = new THREE.WebGLRenderTarget(rw, rh, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: true }); refl.texture.encoding = THREE.sRGBEncoding; refl.texture.generateMipmaps = false; }
    const now = performance.now(); if (now - hideT > 900) { hideT = now; hidden = []; for (const o of W.objs.values()) { if (o.dead || !o.holder) continue; const d = YX.defOf(o); if (d && (d.cls === 'ground' || o.type === 'road')) hidden.push(o.holder); } if (YX.lawn && YX.lawn.ground) hidden.push(YX.lawn.ground); if (YX.grass) { hidden.push(YX.grass.blades, YX.grass.far); if (YX.grass.flowerMesh) hidden.push(YX.grass.flowerMesh); } }
    camera.updateMatrixWorld(); const e = camera.matrixWorld.elements, m = mcam.matrix;
    m.set(e[0], -e[4], e[8], e[12], -e[1], e[5], -e[9], 2 * MH - e[13], e[2], -e[6], e[10], e[14], 0, 0, 0, 1); // right and back mirrored, up mirrored and turned over again so the picture is only upside down
    mcam.matrixWorld.copy(m); mcam.matrixWorldInverse.copy(m).invert(); mcam.projectionMatrix.copy(camera.projectionMatrix); mcam.projectionMatrixInverse.copy(camera.projectionMatrixInverse); mcam.layers.mask = camera.layers.mask;
    const vis = hidden.map((o) => o.visible), wet = U.uWet.value; for (const o of hidden) o.visible = false; U.uWet.value = 0;
    try { R.setRenderTarget(refl); R.render(scene, mcam); } finally { for (let i = 0; i < hidden.length; i++) hidden[i].visible = vis[i]; U.uWet.value = wet; }
    U.tRefl.value = refl.texture; U.uWetRes.value.set(1 / w, 1 / h); U.uWetR.value = 1;
  }
  YX.post = {
    on: !off, strength: 1, grade: 1, rebuild() { W0 = 0; },
    render(R, scene, camera, tile) { // tile {w,h}: one picture of several side by side; the caller has set the viewport (and scissor) it lands in
      if (!this.on || bad || !R.capabilities.isWebGL2 || (YX.quality && YX.quality() === 'low')) return false;
      try {
        if (!tile) R.getDrawingBufferSize(size); const w = Math.round(tile ? tile.w : size.x), h = Math.round(tile ? tile.h : size.y); if (w < 8 || h < 8) return false; if (w !== W0 || h !== H0) build(w, h);
        const g = Math.max(0, Math.min(1, YX.glowLevel || 0)); // 0 by day, 1 at night
        mirror(R, scene, camera, w, h);
        R.setRenderTarget(rt); R.render(scene, camera);
        mBright.uniforms.tMap.value = rt.texture; mBright.uniforms.uTexel.value.set(1 / w, 1 / h); mBright.uniforms.uThr.value = 0.84 - 0.08 * g; pass(R, mBright, down[0]);
        for (let i = 1; i < LV; i++) { mDown.uniforms.tMap.value = down[i - 1].texture; mDown.uniforms.uTexel.value.set(1 / down[i - 1].width, 1 / down[i - 1].height); pass(R, mDown, down[i]); }
        let low = down[LV - 1]; for (let i = LV - 2; i >= 0; i--) { mUp.uniforms.tMap.value = low.texture; mUp.uniforms.tAdd.value = down[i].texture; mUp.uniforms.uTexel.value.set(1 / low.width, 1 / low.height); pass(R, mUp, up[i]); low = up[i]; }
        mOut.uniforms.tMap.value = rt.texture; mOut.uniforms.tBloom.value = low.texture; const k = this.grade; mOut.uniforms.uBloom.value = (0.12 + 0.3 * g) * this.strength; mOut.uniforms.uVig.value = (0.2 + 0.14 * g) * k; mOut.uniforms.uExp.value = 1 + 0.035 * k; mOut.uniforms.uCon.value = (0.14 + 0.1 * g) * k; mOut.uniforms.uSat.value = 1 + 0.1 * k; mOut.uniforms.uTone.value = k;
        pass(R, mOut, null);
        return true;
      } catch (e) { console.warn('post', e); bad = true; try { R.setRenderTarget(null); } catch (e2) {} return false; }
    },
  };
})();
