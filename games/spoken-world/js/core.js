/* 言出法随 · core: utilities, part builder (recorder), mesh realization */
'use strict';
(function () {
  const YX = (window.YX = { GEN: {}, glowMats: [], haloMats: [], glowLevel: 0, lang: 'en' });
  try { const pr = JSON.parse(localStorage.getItem('yanchu.prefs.v2') || '{}'); if (pr.ui === 'zh' || pr.ui === 'en') YX.lang = pr.ui; } catch (e) {}
  YX.T = (zh, en) => (YX.lang === 'en' ? en : zh);
  const DEG = Math.PI / 180;
  YX.DEG = DEG;
  const clamp = (YX.clamp = (v, a, b) => Math.min(b, Math.max(a, v)));
  YX.lerp = (a, b, t) => a + (b - a) * t;
  YX.smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  YX.hash = function (str) { let h = 2166136261 >>> 0; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  YX.rng = function (seed) { let s = (seed >>> 0) || 1; return function () { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  YX.ease = {
    lin: (k) => k,
    out: (k) => 1 - Math.pow(1 - k, 3),
    inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    back: (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
  };

  /* ---------- tweens ---------- */
  const tweens = [];
  YX.tween = function (dur, fn, opt) {
    opt = opt || {};
    const tw = { t: -(opt.delay || 0), dur: Math.max(0.0001, dur), fn, ease: opt.ease || YX.ease.out, done: opt.done, dead: false, kill() { this.dead = true; } };
    tweens.push(tw);
    return tw;
  };
  YX.updateTweens = function (dt) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      if (tw.dead) { tweens.splice(i, 1); continue; }
      tw.t += dt;
      if (tw.t < 0) continue;
      const k = clamp(tw.t / tw.dur, 0, 1);
      try { tw.fn(tw.ease(k), k); } catch (e) { tw.dead = true; console.warn(e); }
      if (k >= 1) { tweens.splice(i, 1); if (tw.done && !tw.dead) try { tw.done(); } catch (e) { console.warn(e); } }
    }
  };

  /* ---------- colour ---------- */
  const _cc = document.createElement('canvas').getContext('2d');
  const colorCache = new Map();
  YX.normColor = function (c, fallback) {
    if (typeof c === 'number' && isFinite(c)) return '#' + ('000000' + ((c >>> 0) & 0xffffff).toString(16)).slice(-6);
    if (typeof c !== 'string') return fallback || null;
    const key = c.trim().toLowerCase();
    if (colorCache.has(key)) return colorCache.get(key) || fallback || null;
    let out = null;
    if (/^#[0-9a-f]{6}$/.test(key)) out = key;
    else if (/^#[0-9a-f]{3}$/.test(key)) out = '#' + key[1] + key[1] + key[2] + key[2] + key[3] + key[3];
    else if (/^[0-9a-f]{6}$/.test(key)) out = '#' + key;
    else if (key && _cc) {
      _cc.fillStyle = '#010203'; _cc.fillStyle = key; const v = _cc.fillStyle;
      if (typeof v === 'string' && /^#[0-9a-f]{6}$/.test(v) && v !== '#010203') out = v;
      else if (typeof v === 'string') { const m = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); if (m) out = '#' + [1, 2, 3].map((i) => ('0' + (+m[i]).toString(16)).slice(-2)).join(''); }
    }
    if (colorCache.size > 4000) colorCache.clear();
    colorCache.set(key, out);
    return out || fallback || null;
  };
  const s2l = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const linCache = new Map();
  YX.lin = function (c) {
    const hex = YX.normColor(c, '#cccccc');
    let v = linCache.get(hex);
    if (!v) { v = [s2l(parseInt(hex.slice(1, 3), 16) / 255), s2l(parseInt(hex.slice(3, 5), 16) / 255), s2l(parseInt(hex.slice(5, 7), 16) / 255)]; linCache.set(hex, v); }
    return v;
  };
  YX.color3 = function (c) { const l = YX.lin(c); return new THREE.Color(l[0], l[1], l[2]); };
  YX.mixHex = function (a, b, t) {
    const A = YX.normColor(a, '#888888'), B = YX.normColor(b, '#888888');
    const p = (h, i) => parseInt(h.slice(i, i + 2), 16);
    return '#' + [1, 3, 5].map((i) => ('0' + Math.round(p(A, i) + (p(B, i) - p(A, i)) * t).toString(16)).slice(-2)).join('');
  };

  /* ---------- the part builder (pure data recorder; also runs inside workers) ---------- */
  function makeBuilder(seed, maxParts) {
    var count = 0, MAX = maxParts || 6000;
    var s = (seed >>> 0) || 1;
    function rnd() { s |= 0; s = (s + 0x6d2b79f5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    function n(v, d) { v = +v; return isFinite(v) ? v : d; }
    var OKEYS = ['rx', 'ry', 'rz', 'sx', 'sy', 'sz', 's', 'emissive', 'glow', 'metal', 'rough', 'opacity', 'flat', 'tex', 'sides', 'seg', 'noShadow', 'unlit', 'bg', 'glowK', 'grad'];
    function opts(o) {
      if (!o || typeof o !== 'object') return undefined;
      var r = {}, any = false;
      for (var i = 0; i < OKEYS.length; i++) { var k = OKEYS[i], v = o[k]; if (v === undefined || v === null) continue; var t = typeof v; if (t === 'number' || t === 'string' || t === 'boolean') { r[k] = v; any = true; } }
      return any ? r : undefined;
    }
    function pairs(arr, dim) {
      var out = [];
      if (!arr || typeof arr.length !== 'number') return out;
      for (var i = 0; i < arr.length && i < 400; i++) { var p = arr[i]; if (!p) continue; var q = []; for (var j = 0; j < dim; j++) q.push(n(p[j], 0)); out.push(q); }
      return out;
    }
    var root = { k: 'g', ch: [] }, cur = root, anchors = {};
    function part(k, a, c, x, y, z, o) {
      if (++count > MAX) throw new Error('too many parts (>' + MAX + ')');
      var p = { k: k, a: a, c: c === undefined || c === null ? '#cccccc' : (typeof c === 'number' || typeof c === 'string' ? c : '#cccccc'), t: [n(x, 0), n(y, 0), n(z, 0)] };
      var oo = opts(o); if (oo) p.o = oo;
      cur.ch.push(p);
      return p;
    }
    var b = {
      box: function (w, h, d, c, x, y, z, o) { return part('box', [n(w, 1), n(h, 1), n(d, 1)], c, x, y, z, o); },
      cyl: function (rt, rb, h, c, x, y, z, o) { return part('cyl', [n(rt, 0.5), n(rb, 0.5), n(h, 1)], c, x, y, z, o); },
      cone: function (r, h, c, x, y, z, o) { return part('cone', [n(r, 0.5), n(h, 1)], c, x, y, z, o); },
      sphere: function (r, c, x, y, z, o) { return part('sph', [n(r, 0.5)], c, x, y, z, o); },
      foliage: function (r, c, x, y, z, o) { return part('fol', [n(r, 0.5)], c, x, y, z, o); },
      puff: function (r, c, x, y, z, o) { return part('puf', [n(r, 0.5)], c, x, y, z, o); }, // a soft billow: cloud, smoke, steam, snow drift — lit above, in shade beneath // a mass of leaves: a lumpy, soft-shaded crown, lighter above and darker beneath, with leaves breaking its outline
      roof: function (w, h, d, c, x, y, z, o) { return part('roof', [n(w, 1), n(h, 1), n(d, 1)], c, x, y, z, o); },
      pyramid: function (w, h, d, c, x, y, z, o) { return part('pyr', [n(w, 1), n(h, 1), n(d, 1)], c, x, y, z, o); },
      torus: function (R, r, c, x, y, z, o) { return part('tor', [n(R, 1), n(r, 0.2)], c, x, y, z, o); },
      lathe: function (pts, c, x, y, z, o) { return part('lathe', [pairs(pts, 2)], c, x, y, z, o); },
      extrude: function (pts, depth, c, x, y, z, o) { return part('ext', [pairs(pts, 2), n(depth, 1)], c, x, y, z, o); },
      tube: function (pts, r, c, o) { return part('tube', [pairs(pts, 3), n(r, 0.05)], c, 0, 0, 0, o); },
      text: function (str, size, c, x, y, z, o) { return part('text', [String(str === undefined ? '' : str).slice(0, 40), n(size, 0.5)], c, x, y, z, o); },
      halo: function (size, c, x, y, z) { return part('halo', [n(size, 2)], c, x, y, z); },
      group: function (tf, fn) {
        if (typeof tf === 'function') { fn = tf; tf = {}; }
        var t = {};
        if (tf && typeof tf === 'object') {
          var ks = ['x', 'y', 'z', 'rx', 'ry', 'rz', 'scale', 'sx', 'sy', 'sz'];
          for (var i = 0; i < ks.length; i++) if (tf[ks[i]] !== undefined) t[ks[i]] = n(tf[ks[i]], ks[i][0] === 's' ? 1 : 0);
          if (tf.anim && typeof tf.anim === 'object') { try { t.anim = JSON.parse(JSON.stringify(tf.anim)); } catch (e) {} }
        }
        var g = { k: 'g', tf: t, ch: [] };
        if (++count > MAX) throw new Error('too many parts');
        cur.ch.push(g);
        var prev = cur; cur = g;
        try { if (typeof fn === 'function') fn(); } finally { cur = prev; }
        return g;
      },
      anchor: function (name, x, y, z, ry) { anchors[String(name)] = ry == null ? [n(x, 0), n(y, 0), n(z, 0)] : [n(x, 0), n(y, 0), n(z, 0), (n(ry, 0) * Math.PI) / 180]; }, // ry (degrees): which way someone sitting there faces
      rand: rnd,
    };
    b.cylinder = b.cyl; b.cube = b.box; b.ball = b.sphere; b.ring = b.torus; b.prism = b.roof; b.label = b.text;
    b.capsule = function (r, h, c, x, y, z, o) { r = n(r, 0.3); h = Math.max(n(h, 1), r * 2); var g = b.group({ x: n(x, 0), y: n(y, 0), z: n(z, 0), rx: o && o.rx, ry: o && o.ry, rz: o && o.rz }, function () { var oo = {}; if (o) for (var k in o) if (k !== 'rx' && k !== 'ry' && k !== 'rz') oo[k] = o[k]; b.cyl(r, r, h - 2 * r, c, 0, r, 0, oo); b.sphere(r, c, 0, r, 0, oo); b.sphere(r, c, 0, h - r, 0, oo); }); return g; };
    return { b: b, root: root, anchors: anchors, rnd: rnd };
  }
  YX.makeBuilder = makeBuilder;

  /* ---------- procedural textures (near-white, multiplied by vertex colour) ---------- */
  YX.TEXM = { brick: 1.6, roof: 1.3, wood: 1.2, plaster: 3, stone: 2, stripes: 1, asphalt: 5, grass: 9, pave: 2, sand: 6 };
  YX.TEX = {};
  /* Surfaces are drawn twice: once as tone (near-white, multiplied by the part's colour) and once as height, from which a normal map is made —
     so brick has mortar you can see the depth of, tiles overlap, planks have grooves, and all of it answers to the sun. */
  YX.TEXN = {};
  const RELIEF = { brick: 2.2, roof: 2.6, wood: 1.5, plaster: 0.55, stone: 2.2, pave: 1.7, asphalt: 0.8 };
  function makeTex(name) {
    const S = RELIEF[name] ? 512 : 256, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'); const R = YX.rng(YX.hash('tex:' + name));
    const hc = document.createElement('canvas'); hc.width = hc.height = S; const hg = hc.getContext('2d'); hg.fillStyle = '#808080'; hg.fillRect(0, 0, S, S);
    const grey = (v) => { v = Math.round(clamp(v, 0, 255)); return 'rgb(' + v + ',' + v + ',' + v + ')'; };
    const speck = (n, lo, hi, sz, ctx) => { ctx = ctx || g; for (let i = 0; i < n; i++) { ctx.fillStyle = grey(lo + R() * (hi - lo)); const s = 1 + R() * sz; ctx.fillRect(R() * S, R() * S, s, s); } };
    const both = (x, y, w, h, tone, high) => { g.fillStyle = grey(tone); g.fillRect(x, y, w, h); hg.fillStyle = grey(high); hg.fillRect(x, y, w, h); };
    const blot = (ctx, n, r0, r1, lo, hi, al) => { for (let i = 0; i < n; i++) { const x = R() * S, y = R() * S, r = r0 + R() * (r1 - r0), v = Math.round(lo + R() * (hi - lo)); for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { const gr = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r); gr.addColorStop(0, 'rgba(' + v + ',' + v + ',' + v + ',' + al + ')'); gr.addColorStop(1, 'rgba(' + v + ',' + v + ',' + v + ',0)'); ctx.fillStyle = gr; ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2); } } };
    g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, S, S);
    if (name === 'brick') {
      both(0, 0, S, S, 172, 50);
      const rows = 12, per = 5, bh = S / rows, bw = S / per, m = 3;
      for (let r = 0; r < rows; r++) { const tones = [], highs = []; for (let i = 0; i < per; i++) { tones.push(R() < 0.14 ? 196 + R() * 14 : 222 + R() * 30); highs.push(185 + R() * 45); }
        for (let i = -1; i <= per; i++) { const x = i * bw + (r % 2) * bw / 2, q = ((i % per) + per) % per; both(x + m, r * bh + m, bw - 2 * m, bh - 2 * m, tones[q], highs[q]); g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x + m, r * bh + m, bw - 2 * m, 2); g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(x + m, (r + 1) * bh - m - 2, bw - 2 * m, 2); } }
      speck(1400, 196, 250, 2); speck(900, 150, 230, 2, hg);
    } else if (name === 'roof') {
      const rows = 6, per = 8, rh = S / rows, tw = S / per;
      for (let r = 0; r < rows; r++) { const tones = []; for (let i = 0; i < per; i++) tones.push(R() * 22 - 11);
        for (let i = -1; i <= per; i++) { const x = i * tw + (r % 2) * tw / 2, q = ((i % per) + per) % per, y = r * rh;
          const gr = g.createLinearGradient(0, y, 0, y + rh); gr.addColorStop(0, grey(206 + tones[q])); gr.addColorStop(0.2, grey(238 + tones[q])); gr.addColorStop(0.86, grey(246 + tones[q])); gr.addColorStop(0.93, grey(222 + tones[q])); gr.addColorStop(1, grey(120)); g.fillStyle = gr; g.fillRect(x + 1, y, tw - 2, rh);
          const hr = hg.createLinearGradient(0, y, 0, y + rh); hr.addColorStop(0, grey(70)); hr.addColorStop(0.9, grey(225)); hr.addColorStop(0.94, grey(235)); hr.addColorStop(1, grey(60)); hg.fillStyle = hr; hg.fillRect(x + 1, y, tw - 2, rh);
          g.fillStyle = grey(150); g.fillRect(x - 1, y, 2, rh - 4); hg.fillStyle = grey(40); hg.fillRect(x - 1, y, 3, rh - 4); } }
      speck(700, 205, 250, 2);
    } else if (name === 'wood') {
      const per = 6, pw = S / per;
      for (let i = 0; i < per; i++) { const tone = 226 + R() * 24; both(i * pw, 0, pw, S, tone, 190 + R() * 30); both(i * pw, 0, 3, S, 150, 30); g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(i * pw + 3, 0, 2, S);
        for (let k = 0; k < 26; k++) { const x = i * pw + 5 + R() * (pw - 10), y = R() * S, l = 40 + R() * 180, d = R() < 0.5; g.fillStyle = d ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.1)'; g.fillRect(x, y, 1 + R(), l); g.fillRect(x, y - S, 1 + R(), l); hg.fillStyle = d ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)'; hg.fillRect(x, y, 2, l); hg.fillRect(x, y - S, 2, l); }
        if (R() < 0.6) { const x = i * pw + pw * (0.3 + R() * 0.4), y = R() * S; g.fillStyle = 'rgba(0,0,0,0.16)'; g.beginPath(); g.ellipse(x, y, 5, 9, 0, 0, 6.283); g.fill(); } }
    } else if (name === 'plaster') {
      g.fillStyle = grey(243); g.fillRect(0, 0, S, S); blot(g, 26, 40, 150, 226, 255, 0.34); speck(1500, 232, 255, 2);
      blot(hg, 60, 14, 70, 60, 200, 0.5); speck(2600, 90, 170, 3, hg);
    } else if (name === 'stone') {
      both(0, 0, S, S, 150, 40);
      const rows = 5, bh = S / rows; for (let r = 0; r < rows; r++) { let x = 0; const w0 = 60 + R() * 60, cuts = [0]; while (x < S - 70) { x += 70 + R() * 90; cuts.push(Math.min(x, S)); } if (cuts[cuts.length - 1] < S) cuts.push(S); const sh = (r % 2) * w0 * 0.5;
        for (let k = 0; k + 1 < cuts.length; k++) { const a = cuts[k], w = cuts[k + 1] - a, tone = 206 + R() * 46, high = 175 + R() * 60; for (const dx of [-S, 0]) both(a + sh + dx + 3, r * bh + 3, w - 6, bh - 6, tone, high); } }
      speck(900, 190, 250, 3); blot(g, 30, 10, 40, 180, 255, 0.25); speck(1400, 120, 220, 3, hg);
    } else if (name === 'stripes') {
      for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? grey(255) : grey(150); g.fillRect(i * (S / 4), 0, S / 4, S); }
    } else if (name === 'asphalt') {
      g.fillStyle = grey(226); g.fillRect(0, 0, S, S); blot(g, 22, 30, 120, 205, 246, 0.3); speck(9000, 186, 255, 2); speck(9000, 40, 215, 2, hg);
      g.strokeStyle = 'rgba(0,0,0,0.13)'; g.lineWidth = 1.2; for (let i = 0; i < 4; i++) { let x = R() * S, y = R() * S; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (R() - 0.5) * 60; y += (R() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
    } else if (name === 'grass') {
      g.fillStyle = grey(232); g.fillRect(0, 0, S, S);
      for (let i = 0; i < 70; i++) { const x = R() * S, y = R() * S, r = 10 + R() * 34; const gr = g.createRadialGradient(x, y, 0, x, y, r); const v = 205 + R() * 50; gr.addColorStop(0, 'rgba(' + v + ',' + v + ',' + v + ',0.55)'); gr.addColorStop(1, 'rgba(' + v + ',' + v + ',' + v + ',0)'); g.fillStyle = gr; for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { g.setTransform(1, 0, 0, 1, dx, dy); g.fillRect(x - r, y - r, r * 2, r * 2); } g.setTransform(1, 0, 0, 1, 0, 0); }
      speck(1800, 200, 255, 2);
    } else if (name === 'pave') {
      both(0, 0, S, S, 166, 60);
      const n = 4, q = S / n; for (let r = 0; r < n; r++) { const tones = []; for (let i = 0; i < n; i++) tones.push(230 + R() * 20); for (let i = -1; i <= n; i++) { const x = i * q + (r % 2) * q / 2, k = ((i % n) + n) % n; both(x + 2, r * q + 2, q - 4, q - 4, tones[k], 200); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 2, r * q + 2, q - 4, 2); } }
      speck(2200, 214, 252, 2); speck(1500, 170, 225, 2, hg);
    } else if (name === 'sand') {
      g.fillStyle = grey(240); g.fillRect(0, 0, S, S); speck(2600, 215, 255, 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
    if (RELIEF[name]) { // height → normals (the canvas is drawn top-down, the texture is read bottom-up)
      const src = hg.getImageData(0, 0, S, S).data, H = new Float32Array(S * S), B = new Float32Array(S * S); for (let i = 0; i < S * S; i++) H[i] = src[i * 4] / 255;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const xm = (x + S - 1) % S, xp = (x + 1) % S, ym = ((y + S - 1) % S) * S, yp = ((y + 1) % S) * S, yy = y * S; B[yy + x] = (H[yy + x] * 4 + H[yy + xm] * 2 + H[yy + xp] * 2 + H[ym + x] * 2 + H[yp + x] * 2 + H[ym + xm] + H[ym + xp] + H[yp + xm] + H[yp + xp]) / 16; }
      const nc = document.createElement('canvas'); nc.width = nc.height = S; const ng = nc.getContext('2d'), im = ng.createImageData(S, S), D = im.data, k = RELIEF[name] * 1.6;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const xm = (x + S - 1) % S, xp = (x + 1) % S, ym = ((y + S - 1) % S) * S, yp = ((y + 1) % S) * S, yy = y * S; let nx = -(B[yy + xp] - B[yy + xm]) * k, ny = (B[yp + x] - B[ym + x]) * k; const l = Math.hypot(nx, ny, 1), o = (yy + x) * 4; D[o] = (nx / l * 0.5 + 0.5) * 255; D[o + 1] = (ny / l * 0.5 + 0.5) * 255; D[o + 2] = (1 / l * 0.5 + 0.5) * 255; D[o + 3] = 255; }
      ng.putImageData(im, 0, 0); const nt = new THREE.CanvasTexture(nc); nt.wrapS = nt.wrapT = THREE.RepeatWrapping; nt.anisotropy = 8; YX.TEXN[name] = nt;
    }
    return t;
  }
  YX.initTextures = function () { for (const k of Object.keys(YX.TEXM)) YX.TEX[k] = makeTex(k); };

  /* ---------- geometry templates ---------- */
  function nonIndexed(g) {
    let n = g;
    if (g.index) { n = g.toNonIndexed(); g.dispose(); }
    if (!n.attributes.normal) n.computeVertexNormals();
    if (!n.attributes.uv) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((n.attributes.position.count) * 2), 2));
    return n;
  }
  const tmplCache = new Map();
  function tmpl(key, make) { let g = tmplCache.get(key); if (!g) { g = nonIndexed(make()); tmplCache.set(key, g); } return g; }
  /* a mass of leaves. What reads as foliage is a soft lumpy volume that is light on top and dark underneath, and an outline broken by leaves —
     not a faceted ball. Built once per variant on a unit sphere; its vertex colours are multipliers on the part's own colour. */
  const fhash = (x, y, z) => { let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1440662683)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  function vnoise3(x, y, z) { const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), u = x - i, v = y - j, w = z - k, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v), c = w * w * (3 - 2 * w), L = (p, q, t) => p + (q - p) * t;
    return L(L(L(fhash(i, j, k), fhash(i + 1, j, k), a), L(fhash(i, j + 1, k), fhash(i + 1, j + 1, k), a), b), L(L(fhash(i, j, k + 1), fhash(i + 1, j, k + 1), a), L(fhash(i, j + 1, k + 1), fhash(i + 1, j + 1, k + 1), a), b), c); }
  YX.noise3 = vnoise3;
  function foliageGeom(variant, detail, fins, soft) {
    const src = new THREE.IcosahedronGeometry(1, detail), S0 = (src.index ? src.toNonIndexed() : src), P0 = S0.attributes.position.array, n = P0.length / 3, P = [], N = [], C = [], U = [], off = variant * 17.3 + 3.1;
    const Rf = (x, y, z) => 1 + 0.46 * (vnoise3(x * 1.9 + off, y * 1.9 + off * 0.7, z * 1.9 - off) - 0.5) + 0.16 * (vnoise3(x * 4.7 - off, y * 4.7, z * 4.7 + off) - 0.5);
    const pt = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l; const r = Rf(x, y, z); return [x * r, y * r, z * r, r]; };
    const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const shade = soft ? (dy, r) => { const s = sm(-0.9, 0.6, dy), k = (0.74 + 0.28 * s) * (0.9 + 0.1 * sm(0.82, 1.14, r)); return [k * (0.95 + 0.05 * s), k * (0.97 + 0.03 * s), k * (1.05 - 0.05 * s)]; }
      : (dy, r, x, y, z) => { const s = sm(-0.85, 0.9, dy), k = (0.66 + 0.5 * s) * (0.76 + 0.24 * sm(0.82, 1.14, r)) * (0.93 + 0.14 * vnoise3(x * 7 + off, y * 7, z * 7)); return [k * (1 + 0.16 * s), k * (1 + 0.07 * s), k * (1 - 0.16 * s)]; };
    for (let i = 0; i < n; i++) {
      const x = P0[i * 3], y = P0[i * 3 + 1], z = P0[i * 3 + 2], l = Math.hypot(x, y, z) || 1, dx = x / l, dy = y / l, dz = z / l, p = pt(dx, dy, dz), e = 0.08;
      let tx = -dz, tz = dx, tl = Math.hypot(tx, tz); if (tl < 1e-3) { tx = 1; tz = 0; tl = 1; } tx /= tl; tz /= tl; const bx = dy * tz, by = dz * tx - dx * tz, bz = -dy * tx;
      const p1 = pt(dx + tx * e, dy, dz + tz * e), p2 = pt(dx + bx * e, dy + by * e, dz + bz * e), ux = p1[0] - p[0], uy = p1[1] - p[1], uz = p1[2] - p[2], vx = p2[0] - p[0], vy = p2[1] - p[1], vz = p2[2] - p[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, nl = Math.hypot(nx, ny, nz) || 1; if (nx * dx + ny * dy + nz * dz < 0) nl = -nl; nx = (nx / nl) * 0.55 + dx * 0.45; ny = (ny / nl) * 0.55 + dy * 0.45; nz = (nz / nl) * 0.55 + dz * 0.45; nl = Math.hypot(nx, ny, nz) || 1;
      P.push(p[0], p[1], p[2]); N.push(nx / nl, ny / nl, nz / nl); const c = shade(dy, p[3], dx, dy, dz); C.push(c[0], c[1], c[2]); U.push(0, 0);
    }
    const R = YX.rng(977 + variant * 31);
    for (let i = 0; i < fins; i++) { // leaves standing out of the mass, so the outline is leafy from every side
      const y = Math.max(-0.82, 1 - ((i + 0.5) / fins) * 1.86), a = i * 2.39996 + R() * 0.5, rr = Math.sqrt(Math.max(0, 1 - y * y)), dx = Math.cos(a) * rr, dz = Math.sin(a) * rr, p = pt(dx, y, dz);
      let tx = -dz, tz = dx, tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl; const bx = y * tz, by = dz * tx - dx * tz, bz = -y * tx, ang = R() * 6.283, ca = Math.cos(ang), sa = Math.sin(ang), wx = tx * ca + bx * sa, wy = by * sa, wz = tz * ca + bz * sa;
      const w = 0.06 + R() * 0.07, len = 0.14 + R() * 0.17, k = 0.94, cx = p[0] * k, cy = p[1] * k, cz = p[2] * k, A = [cx - wx * w, cy - wy * w, cz - wz * w], B = [cx + wx * w, cy + wy * w, cz + wz * w], T = [cx + dx * len, cy + y * len - 0.12 * len, cz + dz * len];
      let nx = dx, ny = y + 0.35, nz = dz; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl; const c = shade(Math.min(1, y + 0.15), 1.12, dx, y, dz), kk = 0.9 + R() * 0.34;
      for (const tri of [[A, B, T], [B, A, T]]) for (const q of tri) { P.push(q[0], q[1], q[2]); N.push(nx, ny, nz); C.push(c[0] * kk, c[1] * kk, c[2] * kk); U.push(0, 0); }
    }
    if (S0 !== src) S0.dispose(); src.dispose();
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); return g;
  }
  function roofGeom(w, h, d, tile) {
    const hw = w / 2, hd = d / 2, sl = Math.hypot(hd, h);
    const A = [-hw, 0, -hd], B = [hw, 0, -hd], C = [hw, 0, hd], D = [-hw, 0, hd], E = [-hw, h, 0], F = [hw, h, 0];
    const u = tile ? w / tile : 1, v = tile ? sl / tile : 1, gu = tile ? d / tile : 1, gv = tile ? h / tile : 1;
    const P = [], U = [];
    const tri = (a, b, c, ua, ub, uc) => { P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); U.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]); };
    tri(D, C, F, [0, 0], [u, 0], [u, v]); tri(D, F, E, [0, 0], [u, v], [0, v]);
    tri(B, A, E, [0, 0], [u, 0], [u, v]); tri(B, E, F, [0, 0], [u, v], [0, v]);
    tri(A, D, E, [0, 0], [gu, 0], [gu / 2, gv]);
    tri(C, B, F, [0, 0], [gu, 0], [gu / 2, gv]);
    tri(A, B, C, [0, 0], [u, 0], [u, gu]); tri(A, C, D, [0, 0], [u, gu], [0, gu]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    g.computeVertexNormals();
    return g;
  }
  function texBox(w, h, d, tile) {
    const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0);
    const uv = g.attributes.uv.array;
    const mul = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = (f * 4 + i) * 2; uv[k] *= mul[f][0] / tile; uv[k + 1] *= mul[f][1] / tile; }
    return nonIndexed(g);
  }
  /* A box with its edges taken off. Nothing made by hand has a perfectly sharp edge, and a sharp edge is what makes a model look computed:
     here each edge is a narrow face whose shading runs from one side's light to the other's, so every box catches the light along its edges.
     c is the width taken off; the box is c narrower at each edge, never bigger than asked for. */
  function bevelBox(w, h, d, c, tile) {
    const hx = w / 2, hy = h / 2, hz = d / 2, P = [], N = [], U = [], S = [-1, 1];
    const px = (sx, sy, sz) => [sx * hx, sy * (hy - c), sz * (hz - c), sx, 0, 0], py = (sx, sy, sz) => [sx * (hx - c), sy * hy, sz * (hz - c), 0, sy, 0], pz = (sx, sy, sz) => [sx * (hx - c), sy * (hy - c), sz * hz, 0, 0, sz];
    const uv = (v) => (tile ? (v[3] ? [(v[2] + hz) / tile, (v[1] + hy) / tile] : v[4] ? [(v[0] + hx) / tile, (v[2] + hz) / tile] : [(v[0] + hx) / tile, (v[1] + hy) / tile]) : [0, 0]);
    const tri = (a, b, cc) => { // wound so that it faces the way its corners' normals point
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = cc[0] - a[0], vy = cc[1] - a[1], vz = cc[2] - a[2], nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const out = nx * (a[3] + b[3] + cc[3]) + ny * (a[4] + b[4] + cc[4]) + nz * (a[5] + b[5] + cc[5]) >= 0, L = out ? [a, b, cc] : [a, cc, b];
      for (const v of L) { P.push(v[0], v[1] + hy, v[2]); N.push(v[3], v[4], v[5]); const t = uv(v); U.push(t[0], t[1]); } };
    const quad = (a, b, cc, e) => { tri(a, b, cc); tri(a, cc, e); };
    for (const s of S) { quad(px(s, -1, -1), px(s, 1, -1), px(s, 1, 1), px(s, -1, 1)); quad(py(-1, s, -1), py(1, s, -1), py(1, s, 1), py(-1, s, 1)); quad(pz(-1, -1, s), pz(1, -1, s), pz(1, 1, s), pz(-1, 1, s)); }
    for (const a of S) for (const b of S) { quad(px(a, b, -1), px(a, b, 1), py(a, b, 1), py(a, b, -1)); quad(px(a, -1, b), px(a, 1, b), pz(a, 1, b), pz(a, -1, b)); quad(py(-1, a, b), py(1, a, b), pz(1, a, b), pz(-1, a, b)); }
    for (const a of S) for (const b of S) for (const cz of S) tri(px(a, b, cz), py(a, b, cz), pz(a, b, cz));
    return { attributes: { position: { array: P }, normal: { array: N }, uv: { array: U } }, boundingBox: { min: { x: -hx, y: 0, z: -hz }, max: { x: hx, y: h, z: hz } }, dispose() {} };
  }
  let T_BOX, T_ROOF, T_PYR;
  function initTemplates() {
    T_BOX = nonIndexed(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
    T_ROOF = roofGeom(1, 1, 1, 0);
    T_PYR = nonIndexed(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0));
    T_PYR.computeVertexNormals();
  }

  /* ---------- materials ---------- */
  /* Rain makes the ground a mirror. Anything paved or tarred — roads, pavements, squares, and whatever is invented later with those surfaces —
     darkens when wet and shows the world upside down in it: faintly everywhere, clearly where water stands in puddles, and more the flatter
     you look along it. The picture it shows (tRefl) is drawn once a frame from under the ground; here it is only looked up. */
  YX.wetUni = { uWet: { value: 0 }, uWetR: { value: 0 }, tRefl: { value: null }, uWetRes: { value: new THREE.Vector2(1, 1) }, uWetT: { value: 0 } }; // uWetR: is there a mirror picture this frame (none on low quality: then wet is only darker)
  const WET_PARS = 'uniform float uWet;\nuniform float uWetR;\nuniform sampler2D tRefl;\nuniform vec2 uWetRes;\nuniform float uWetT;\nvarying vec3 vWetP;\nvarying float vWetN;\nfloat wetH( vec2 p ) { p = fract( p * vec2( 0.1031, 0.1030 ) ); p += dot( p, p.yx + 33.33 ); return fract( ( p.x + p.y ) * p.x ); }\nfloat wetN( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f ); return mix( mix( wetH( i ), wetH( i + vec2( 1.0, 0.0 ) ), f.x ), mix( wetH( i + vec2( 0.0, 1.0 ) ), wetH( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }';
  const WET_CODE = '\tif ( uWet > 0.003 && vWetN > 0.75 ) {\n\t\tvec2 wp = vWetP.xz;\n\t\tfloat pud = smoothstep( 0.42, 0.66, wetN( wp * 0.38 ) * 0.7 + wetN( wp * 1.3 + 9.1 ) * 0.3 );\n\t\tfloat fres = pow( 1.0 - clamp( dot( normalize( vViewPosition ), normal ), 0.0, 1.0 ), 3.0 );\n\t\tvec2 rip = vec2( wetN( wp * 7.0 + uWetT * 2.3 ), wetN( wp * 7.0 - uWetT * 1.9 + 4.7 ) ) - 0.5;\n\t\tvec2 suv = gl_FragCoord.xy * uWetRes; suv.y = 1.0 - suv.y;\n\t\tsuv += ( normal.xy * 0.03 + rip * 0.014 ) * mix( 1.0, 0.3, pud );\n\t\tvec3 refl = texture2D( tRefl, suv ).rgb; refl *= refl;\n\t\tfloat wk = uWet * uWetR * mix( 0.2, 0.86, pud ) * ( 0.22 + 0.78 * fres );\n\t\tgl_FragColor.rgb = mix( gl_FragColor.rgb * ( 1.0 - 0.36 * uWet ), refl, wk );\n\t}\n';
  function wetPatch(sh) {
    Object.assign(sh.uniforms, YX.wetUni);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWetP;\nvarying float vWetN;').replace('#include <project_vertex>', '#include <project_vertex>\n\tvWetP = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;\n\tvWetN = normalize( mat3( modelMatrix ) * objectNormal ).y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + WET_PARS).replace('#include <tonemapping_fragment>', WET_CODE + '\t#include <tonemapping_fragment>');
  }
  const WETS = { asphalt: 1, pave: 1 };
  const matCache = new Map();
  function matKey(o) {
    if (!o) return 'p';
    const tex = o.tex && YX.TEX[o.tex] ? o.tex : '';
    const em = o.emissive ? YX.normColor(o.emissive, '') || '' : '';
    const gl = o.glow ? (o.glow === true ? '#ffd9a0' : YX.normColor(o.glow, '#ffd9a0')) : '';
    const metal = o.metal != null ? clamp(+o.metal || 0, 0, 1).toFixed(1) : '';
    const rough = o.rough != null ? clamp(+o.rough || 0, 0, 1).toFixed(1) : '';
    const op = o.opacity != null && +o.opacity < 1 ? clamp(+o.opacity || 0, 0.05, 1).toFixed(2) : '';
    const ns = o.noShadow ? 'n' : '', un = o.unlit ? 'u' : '', gk = gl && o.glowK ? (+o.glowK).toFixed(1) : '';
    if (!tex && !em && !gl && !metal && !rough && !op && !ns && !un) return 'p';
    return [tex, em, gl, metal, rough, op, ns, un, gk].join('|');
  }
  function getMat(key) {
    let m = matCache.get(key);
    if (m) return m;
    if (key === 'p') m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 });
    else {
      const [tex, em, gl, metal, rough, op, ns, un, gk] = key.split('|');
      if (un) m = new THREE.MeshBasicMaterial({ vertexColors: true });
      else m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough ? +rough : 0.86, metalness: metal ? +metal : 0 });
      if (tex) { m.map = YX.TEX[tex]; if (YX.TEXN[tex] && !un) m.normalMap = YX.TEXN[tex]; if (WETS[tex] && !un && !op) m.onBeforeCompile = wetPatch; }
      if (em && !un) { m.emissive = YX.color3(em); m.emissiveIntensity = 1; }
      if (gl && !un) { m.emissive = YX.color3(gl); m.userData.gk = gk ? +gk : 1; m.emissiveIntensity = glowI(m.userData.gk); YX.glowMats.push(m); }
      if (op) { m.transparent = true; m.opacity = +op; m.depthWrite = false; }
      m.userData.noShadow = !!ns || !!op || !!un;
    }
    matCache.set(key, m);
    return m;
  }
  function glowI(k) { return (0.03 + 1.25 * YX.glowLevel) * (k || 1); }
  YX.setGlow = function (level) {
    YX.glowLevel = level;
    for (const m of YX.glowMats) m.emissiveIntensity = glowI(m.userData.gk);
    for (const m of YX.haloMats) m.opacity = level * 0.75;
  };

  /* ---------- text + halo ---------- */
  const textCache = new Map();
  function textTexture(str, color, bg) {
    const key = str + '|' + color + '|' + (bg || '');
    let e = textCache.get(key);
    if (e) return e;
    const F = 72, font = "700 " + F + "px 'Noto Sans SC','PingFang SC','Hiragino Sans GB','Microsoft YaHei',system-ui,sans-serif";
    const c = document.createElement('canvas'); let g = c.getContext('2d'); g.font = font;
    const tw = Math.max(20, g.measureText(str || ' ').width), pad = bg ? 34 : 10;
    c.width = Math.min(2048, Math.ceil(tw + pad * 2)); c.height = F + (bg ? 52 : 26);
    g = c.getContext('2d'); g.font = font; g.textBaseline = 'middle'; g.textAlign = 'center';
    if (bg) { g.fillStyle = bg; const r = 18, w = c.width, h = c.height; g.beginPath(); g.moveTo(r, 0); g.arcTo(w, 0, w, h, r); g.arcTo(w, h, 0, h, r); g.arcTo(0, h, 0, 0, r); g.arcTo(0, 0, w, 0, r); g.closePath(); g.fill(); }
    g.fillStyle = color; g.fillText(str, c.width / 2, c.height / 2 + 3, c.width - 8);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
    e = { tex: t, aspect: c.width / c.height };
    if (textCache.size > 300) textCache.clear();
    textCache.set(key, e);
    return e;
  }
  let haloTex = null; const haloCache = new Map();
  function haloMat(color) {
    const hex = YX.normColor(color, '#ffe2a8');
    let m = haloCache.get(hex);
    if (m) return m;
    if (!haloTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); haloTex = new THREE.CanvasTexture(c); }
    m = new THREE.SpriteMaterial({ map: haloTex, color: new THREE.Color(hex), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: YX.glowLevel * 0.75, fog: false });
    haloCache.set(hex, m); YX.haloMats.push(m);
    return m;
  }

  /* ---------- realize: part tree -> THREE.Group ---------- */
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _n3 = new THREE.Matrix3();
  const fin = (v, d) => { v = +v; return isFinite(v) ? v : d; };
  const pos = (v, d) => { v = +v; return isFinite(v) && v > 0 ? Math.min(v, 5000) : d; };
  const ci = (v, lo, hi, d) => { v = Math.round(+v); return isFinite(v) ? clamp(v, lo, hi) : d; };
  function tfMatrix(tf) {
    _e.set(fin(tf.rx, 0) * DEG, fin(tf.ry, 0) * DEG, fin(tf.rz, 0) * DEG, 'XYZ'); _q.setFromEuler(_e);
    const u = Array.isArray(tf.scale) ? 1 : fin(tf.scale, 1);
    _s.set(fin(tf.sx, 1) * u, fin(tf.sy, 1) * u, fin(tf.sz, 1) * u);
    if (_s.x === 0) _s.x = 0.001; if (_s.y === 0) _s.y = 0.001; if (_s.z === 0) _s.z = 0.001;
    _p.set(fin(tf.x, 0), fin(tf.y, 0), fin(tf.z, 0));
    return new THREE.Matrix4().compose(_p, _q, _s);
  }
  function partMatrix(node, sc) {
    const o = node.o || {}, t = node.t || [0, 0, 0];
    _e.set(fin(o.rx, 0) * DEG, fin(o.ry, 0) * DEG, fin(o.rz, 0) * DEG, 'XYZ'); _q.setFromEuler(_e);
    const u = fin(o.s, 1);
    _s.set((fin(o.sx, 1) * u * sc[0]) || 0.001, (fin(o.sy, 1) * u * sc[1]) || 0.001, (fin(o.sz, 1) * u * sc[2]) || 0.001);
    _p.set(fin(t[0], 0), fin(t[1], 0), fin(t[2], 0));
    return new THREE.Matrix4().compose(_p, _q, _s);
  }
  /* Every part's colour is finished here, the same way for every thing in the world: a part may carry its own shading (foliage), may ask for a
     vertical gradient (grad), and anything standing on the ground is a little darker where it meets it — walls, posts, wheels, shoes alike. */
  function appendGeom(bk, g, m, col, flat, uvMul, fx) {
    const P0 = g.attributes.position.array, N0 = g.attributes.normal.array, U0 = g.attributes.uv ? g.attributes.uv.array : null, C0 = g.attributes.color ? g.attributes.color.array : null;
    const n = P0.length / 3, e = m.elements; _n3.getNormalMatrix(m); const ne = _n3.elements;
    const flip = m.determinant() < 0;
    const P = bk.pos, N = bk.nor, U = bk.uv, C = bk.col;
    const um = uvMul ? uvMul[0] : 1, vm = uvMul ? uvMul[1] : 1;
    const ord = flip ? [0, 2, 1] : [0, 1, 2];
    const tp = [0, 0, 0, 0, 0, 0, 0, 0, 0], tn = [0, 0, 0], kk = [1, 1, 1, 1, 1, 1, 1, 1, 1];
    const grad = fx ? fx.grad || 0 : 0, ao = !!(fx && fx.ao); let gy0 = 0, gh = 1;
    if (grad) { if (!g.boundingBox) g.computeBoundingBox(); gy0 = g.boundingBox.min.y; gh = g.boundingBox.max.y - gy0 || 1; }
    for (let t = 0; t + 2 < n; t += 3) {
      for (let j = 0; j < 3; j++) {
        const i = t + ord[j], x = P0[i * 3], y = P0[i * 3 + 1], z = P0[i * 3 + 2];
        tp[j * 3] = e[0] * x + e[4] * y + e[8] * z + e[12]; tp[j * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; tp[j * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
        P.push(tp[j * 3], tp[j * 3 + 1], tp[j * 3 + 2]);
        if (!flat) { const a = N0[i * 3], b = N0[i * 3 + 1], c = N0[i * 3 + 2]; let nx = ne[0] * a + ne[3] * b + ne[6] * c, ny = ne[1] * a + ne[4] * b + ne[7] * c, nz = ne[2] * a + ne[5] * b + ne[8] * c; const l = Math.hypot(nx, ny, nz) || 1; N.push(nx / l, ny / l, nz / l); tn[j] = ny / l; }
        U.push(U0 ? U0[i * 2] * um : 0, U0 ? U0[i * 2 + 1] * vm : 0);
        let k = 1; if (grad) { const u = (y - gy0) / gh; k = grad > 0 ? 1 - grad * (1 - u) + 0.2 * grad * u : 1 + grad * u - 0.2 * grad * (1 - u); }
        if (C0) { kk[j * 3] = k * C0[i * 3]; kk[j * 3 + 1] = k * C0[i * 3 + 1]; kk[j * 3 + 2] = k * C0[i * 3 + 2]; } else kk[j * 3] = kk[j * 3 + 1] = kk[j * 3 + 2] = k;
      }
      if (flat) {
        const ux = tp[3] - tp[0], uy = tp[4] - tp[1], uz = tp[5] - tp[2], vx = tp[6] - tp[0], vy = tp[7] - tp[1], vz = tp[8] - tp[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        N.push(nx, ny, nz, nx, ny, nz, nx, ny, nz); tn[0] = tn[1] = tn[2] = ny;
      }
      for (let j = 0; j < 3; j++) {
        let a = 1; if (ao && tn[j] < 0.7) { const y = tp[j * 3 + 1]; if (y < 2.6) { const u = y <= 0 ? 0 : y / 2.6; a = 0.74 + 0.26 * u * u * (3 - 2 * u); } }
        C.push(col[0] * kk[j * 3] * a, col[1] * kk[j * 3 + 1] * a, col[2] * kk[j * 3 + 2] * a);
      }
    }
  }
  YX.realize = function (root, opt) {
    opt = opt || {};
    const tint = opt.tint ? YX.lin(opt.tint) : null, fat = opt.fat > 0 ? +opt.fat : 0, bevel = opt.bevel > 0 ? +opt.bevel : 0; let partNo = 0, folNo = 0, glows = 0;
    const group = new THREE.Group(), anims = [], owners = [];
    const I = new THREE.Matrix4();
    const newOwner = (o3) => { const ow = { o3, buckets: new Map() }; owners.push(ow); return ow; };
    const rootOwner = newOwner(group);
    function leaf(owner, node, mat) {
      const o = node.o || {}, a = node.a || [], k = node.k;
      if (k === 'text') {
        const size = pos(a[1], 0.5), str = String(a[0] || ' ');
        const col = YX.normColor(node.c, '#ffffff'), bg = o.bg ? YX.normColor(o.bg, null) : null;
        const tt = textTexture(str, col, bg);
        const mat3 = new THREE.MeshStandardMaterial({ map: tt.tex, transparent: true, alphaTest: 0.3, roughness: 1 });
        if (o.glow) glows++;
        if (o.glow && !opt.dark) { mat3.emissive = new THREE.Color(1, 1, 1); mat3.emissiveMap = tt.tex; mat3.userData.gk = 0.8; mat3.emissiveIntensity = glowI(0.8); YX.glowMats.push(mat3); mat3.userData.own = true; }
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size * tt.aspect, size), mat3);
        mesh.applyMatrix4(new THREE.Matrix4().multiplyMatrices(mat, partMatrix(node, [1, 1, 1])));
        mesh.userData.ownMat = true;
        owner.o3.add(mesh);
        return;
      }
      if (k === 'halo') {
        glows++; if (opt.dark) return;
        const sp = new THREE.Sprite(haloMat(node.c)); const sz = pos(a[0], 2);
        const M = new THREE.Matrix4().multiplyMatrices(mat, partMatrix(node, [1, 1, 1]));
        sp.position.setFromMatrixPosition(M); sp.scale.set(sz, sz, 1);
        owner.o3.add(sp);
        return;
      }
      let geom, sc = [1, 1, 1], dispose = false, flat = !!o.flat, uvMul = null;
      const tex = o.tex && YX.TEX[o.tex] ? o.tex : null, tile = tex ? YX.TEXM[tex] : 0;
      if (k === 'box') {
        const w = pos(a[0], 1), h = pos(a[1], 1), d = pos(a[2], 1);
        const mn = Math.min(w, h, d);
        if (bevel && mn >= 0.07 && !o.flat && !o.unlit && !(o.opacity < 1)) geom = bevelBox(w, h, d, Math.min(bevel, Math.max(0.01, mn * 0.14)), tex ? tile : 0);
        else if (tex) { geom = texBox(w, h, d, tile); dispose = true; } else { geom = T_BOX; sc = [w, h, d]; }
      } else if (k === 'cyl' || k === 'cone') {
        let rt = k === 'cone' ? 0 : Math.max(0, fin(a[0], 0.5)), rb = k === 'cone' ? pos(a[0], 0.5) : Math.max(0, fin(a[1], 0.5));
        const h = pos(k === 'cone' ? a[1] : a[2], 1);
        const R = Math.max(rt, rb, 0.001);
        const sides = ci(o.sides, 3, 40, R < 0.12 ? 8 : R < 0.6 ? 12 : 20);
        const kt = Math.round((rt / R) * 50) / 50, kb = Math.round((rb / R) * 50) / 50;
        geom = tmpl('cyl' + kt + '_' + kb + '_' + sides, () => new THREE.CylinderGeometry(kt, kb, 1, sides).translate(0, 0.5, 0));
        sc = [R, h, R];
        if (tex) uvMul = [(2 * Math.PI * R) / tile, h / tile];
      } else if (k === 'sph') {
        const r = pos(a[0], 0.5), seg = ci(o.seg, 4, 36, r < 0.15 ? 8 : r < 0.7 ? 12 : 18);
        geom = tmpl('sph' + seg, () => new THREE.SphereGeometry(1, seg, Math.max(4, Math.round(seg * 0.7))));
        sc = [r, r, r];
      } else if (k === 'fol') {
        const r = pos(a[0], 0.5), small = r < 0.42, v = folNo++ % 4;
        geom = tmpl('fol' + v + (small ? 's' : ''), () => foliageGeom(v, small ? 1 : 2, small ? 20 : 72)); sc = [r, r, r]; flat = false;
      } else if (k === 'puf') {
        const r = pos(a[0], 0.5), v = folNo++ % 4; geom = tmpl('puf' + v, () => foliageGeom(v + 4, 2, 0, true)); sc = [r, r, r]; flat = false;
      } else if (k === 'roof') {
        const w = pos(a[0], 1), h = pos(a[1], 1), d = pos(a[2], 1);
        if (tex) { geom = roofGeom(w, h, d, tile); dispose = true; } else { geom = T_ROOF; sc = [w, h, d]; }
      } else if (k === 'pyr') {
        geom = T_PYR; sc = [pos(a[0], 1), pos(a[1], 1), pos(a[2], 1)]; flat = true;
      } else if (k === 'tor') {
        const R = pos(a[0], 1), r = pos(a[1], 0.2), ratio = clamp(Math.round((r / R) * 50) / 50, 0.02, 0.9);
        geom = tmpl('tor' + ratio, () => new THREE.TorusGeometry(1, ratio, 8, 28)); sc = [R, R, R];
      } else if (k === 'lathe') {
        let pts = (a[0] || []).map((p) => new THREE.Vector2(Math.max(0, fin(p[0], 0)), fin(p[1], 0)));
        if (pts.length < 2) return;
        if (pts[0].y > pts[pts.length - 1].y) pts.reverse();
        geom = nonIndexed(new THREE.LatheGeometry(pts, ci(o.sides, 3, 40, 18))); dispose = true;
      } else if (k === 'ext') {
        const pts = (a[0] || []).map((p) => new THREE.Vector2(fin(p[0], 0), fin(p[1], 0)));
        if (pts.length < 3) return;
        const depth = pos(a[1], 1);
        try { geom = nonIndexed(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth, bevelEnabled: false }).translate(0, 0, -depth / 2)); } catch (err) { return; }
        dispose = true; if (o.flat == null) flat = true;
      } else if (k === 'tube') {
        const pts = (a[0] || []).map((p) => new THREE.Vector3(fin(p[0], 0), fin(p[1], 0), fin(p[2], 0)));
        if (pts.length < 2) return;
        const r = pos(a[1], 0.05);
        try { geom = nonIndexed(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.min(80, pts.length * 6), r, ci(o.sides, 3, 16, 7), false)); } catch (err) { return; }
        dispose = true;
      } else return;
      let col = YX.lin(node.c); if (o.glow) glows++;
      if (opt.dark && o.glow) col = [col[0] * 0.05 + 0.008, col[1] * 0.06 + 0.012, col[2] * 0.08 + 0.02]; // its lights are switched off: what glowed is dark glass now
      if (tint && !o.glow && !o.emissive) col = [col[0] * 0.3 + tint[0] * 0.7, col[1] * 0.3 + tint[1] * 0.7, col[2] * 0.3 + tint[2] * 0.7];
      const M = new THREE.Matrix4().multiplyMatrices(mat, partMatrix(node, sc));
      if (fat) { // grow each part by its own hair's width so that faces of different parts never lie in exactly the same plane
        if (!geom.boundingBox) geom.computeBoundingBox(); const bb = geom.boundingBox, hx = Math.max(1e-4, ((bb.max.x - bb.min.x) / 2) * sc[0]), hy = Math.max(1e-4, ((bb.max.y - bb.min.y) / 2) * sc[1]), hz = Math.max(1e-4, ((bb.max.z - bb.min.z) / 2) * sc[2]);
        const d = Math.min(fat * (0.25 + ((++partNo * 0.61803398875) % 1)), 0.2 * Math.min(hx, hy, hz)), cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2, cz = (bb.min.z + bb.max.z) / 2;
        M.multiply(new THREE.Matrix4().makeTranslation(cx, cy, cz)).multiply(new THREE.Matrix4().makeScale(1 + d / hx, 1 + d / hy, 1 + d / hz)).multiply(new THREE.Matrix4().makeTranslation(-cx, -cy, -cz));
      }
      const key = matKey(opt.dark && o.glow ? Object.assign({}, node.o, { glow: null, glowK: null, rough: 0.2 }) : node.o);
      let bk = owner.buckets.get(key);
      if (!bk) { bk = { pos: [], nor: [], uv: [], col: [] }; owner.buckets.set(key, bk); }
      appendGeom(bk, geom, M, col, flat, uvMul, { grad: fin(o.grad, 0), ao: owner === rootOwner && opt.ao !== false && !o.glow && !o.emissive && !o.unlit && !(o.opacity < 1) });
      if (dispose) geom.dispose();
    }
    function walk(node, mat, owner, depth) {
      if (!node || depth > 14) return;
      if (node.k === 'g') {
        const tf = node.tf || {};
        const m = new THREE.Matrix4().multiplyMatrices(mat, tfMatrix(tf));
        const ch = node.ch || [];
        if (tf.anim && typeof tf.anim === 'object') {
          const outer = new THREE.Object3D(); m.decompose(outer.position, outer.quaternion, outer.scale);
          const inner = new THREE.Object3D(); outer.add(inner); owner.o3.add(outer);
          anims.push({ o: inner, spec: tf.anim, roll: 0 });
          const ow = newOwner(inner);
          for (let i = 0; i < ch.length; i++) walk(ch[i], I, ow, depth + 1);
        } else for (let i = 0; i < ch.length; i++) walk(ch[i], m, owner, depth + 1);
      } else { try { leaf(owner, node, mat); } catch (err) { /* skip a bad part */ } }
    }
    walk(root, I, rootOwner, 0);
    for (const ow of owners) for (const [key, bk] of ow.buckets) {
      if (!bk.pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(bk.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(bk.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(bk.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(bk.col, 3));
      const mat = getMat(key), mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = !mat.userData.noShadow; mesh.receiveShadow = !mat.userData.noShadow;
      ow.o3.add(mesh);
    }
    return { group, anims, glows };
  };
  YX.disposeGroup = function (group) {
    group.traverse((o) => {
      if (o.isMesh) { o.geometry.dispose(); if (o.userData.ownMat) { const i = YX.glowMats.indexOf(o.material); if (i >= 0) YX.glowMats.splice(i, 1); o.material.dispose(); } }
    });
  };
  const AX = (a) => (a === 'x' || a === 'z' ? a : 'y');
  YX.applyAnims = function (anims, t, dt, vel) {
    for (let i = 0; i < anims.length; i++) {
      const a = anims[i], sp = a.spec, o = a.o;
      if (sp.spin) o.rotation[AX(sp.spin.axis)] = fin(sp.spin.speed, 1) * t + fin(sp.spin.phase, 0);
      if (sp.swing) { let amp = fin(sp.swing.deg, 20) * DEG; if (sp.swing.byVel) amp *= clamp((vel || 0) / fin(sp.swing.byVel, 1.2), 0, 1.3); o.rotation[AX(sp.swing.axis)] = Math.sin(t * fin(sp.swing.freq, 1) * 6.2832 + fin(sp.swing.phase, 0)) * amp; }
      if (sp.bob) o.position.y = Math.sin(t * fin(sp.bob.freq, 1) * 6.2832 + fin(sp.bob.phase, 0)) * fin(sp.bob.amp, 0.2);
      if (sp.pulse) o.scale.setScalar(1 + Math.sin(t * fin(sp.pulse.freq, 1) * 6.2832 + fin(sp.pulse.phase, 0)) * fin(sp.pulse.amp, 0.1));
      if (sp.roll) { a.roll += ((vel || 0) / Math.max(0.05, fin(sp.roll.radius, 0.3))) * dt; o.rotation.x = a.roll; }
      if (sp.hinge) { a.hold = Math.max(0, (a.hold || 0) - dt); a.k = (a.k || 0) + ((a.hold > 0 ? 1 : 0) - (a.k || 0)) * Math.min(1, dt * 5.5); o.rotation[AX(sp.hinge.axis)] = a.k * fin(sp.hinge.deg, 95) * DEG; } // a door leaf: open while somebody holds it (YX.holdDoor), shut otherwise
      if (sp.orbit) { const r = fin(sp.orbit.radius, 1), w = t * fin(sp.orbit.speed, 1) + fin(sp.orbit.phase, 0); o.position.x = Math.cos(w) * r; o.position.z = Math.sin(w) * r; }
    }
  };
  YX.initCore = function () { YX.initTextures(); initTemplates(); };
})();
