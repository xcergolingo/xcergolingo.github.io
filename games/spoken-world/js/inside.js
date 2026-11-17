/* Spoken World · interiors: houses, shops, cafés and towers have a furnished ground floor. The player is a viewpoint and walks straight in through any wall.
   A building's outside is a shell that only shows from outside, so each room brings its own floor, ceiling, inner walls, windows and ceiling lights:
   that shell is built when the player comes near and dropped when they leave.
   The furniture is different: every piece is a real object standing on the room's floor (attached to the building with the anchor "floor"),
   so it can be pointed at, named, moved, resized, recoloured and removed, and the model is told about it. A room is furnished once, the first time someone comes near. */
'use strict';
(function () {
  const YX = window.YX, W = YX.world, THREE = window.THREE;
  const ENTER = { house: 1, shop: 1, cafe: 1, tower: 1 }; // which buildings have a room inside
  const rooms = new Map(); let cur = null, tick = 0;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lamp = new THREE.PointLight(0xffe0b0, 0, 18, 1.4); YX.three.scene.add(lamp);
  const day = () => W.env.time > 6.3 && W.env.time < 18.6;
  const STOCK_OF = { BAKERY: 'bread', BOOKS: 'books', FLOWERS: 'flowers', MARKET: 'market', TEA: 'tea', RECORDS: 'records', CAFE: 'bread' }, DEG = Math.PI / 180;

  /* the room in the building's own frame: x across, z toward the front door */
  function spec(o) {
    const p = o.params, tower = o.type === 'tower', shop = o.type === 'shop' || o.type === 'cafe', w = +p.width || o.foot[0] / o.s[0], d = +p.depth || o.foot[1] / o.s[2];
    return { w, d, iw: w - 0.64, id: d - 0.64, doorX: shop || tower ? 0 : (o.anchors && o.anchors.door ? o.anchors.door[0] : 0), F: shop || tower ? 0.32 : 0.42, H: tower ? 4.36 : shop ? 3.62 : 3.16, shop, tower, name: o.type === 'cafe' ? 'CAFE' : String(p.name || '').toUpperCase() };
  }
  const local = (o, x, z) => { const dx = x - o.x, dz = z - o.z, c = Math.cos(o.rot), s = Math.sin(o.rot); return [(dx * c - dz * s) / o.s[0], (dx * s + dz * c) / o.s[2]]; };
  const world = (o, lx, lz) => { const c = Math.cos(o.rot), s = Math.sin(o.rot); lx *= o.s[0]; lz *= o.s[2]; return [o.x + lx * c + lz * s, o.z - lx * s + lz * c]; };
  const keyOf = (o) => [o.params.width, o.params.depth, o.params.name, o.params.wall, o.anchors && o.anchors.door ? o.anchors.door[0] : 0, day() ? 1 : 0].join('|');

  function build(o) {
    const S = spec(o), F = S.F, B = YX.makeBuilder((o.seed || 1) + 77, 1500), b = B.b;
    const hw = S.iw / 2, hd = S.id / 2, H = S.H, lit = day(), wallC = S.shop ? '#efe6d6' : '#ece3d2', glass = lit ? '#dcecf8' : '#1b2438', gl = lit ? { glow: '#eaf4ff', glowK: 0.85 } : { glow: '#101728', glowK: 0.2 };
    // shell: floor, ceiling, three walls, and a front wall that leaves the doorway open
    b.box(S.iw + 0.2, 0.05, S.id + 0.2, S.tower ? '#bdb7ab' : S.shop ? '#b9a07c' : '#a8774d', 0, F - 0.05, 0);
    for (let i = -4; i <= 4; i++) b.box(S.iw, 0.008, 0.025, S.tower ? '#a59f93' : S.shop ? '#a08a68' : '#8c6240', 0, F, (i / 4.5) * hd);
    if (S.tower) for (let i = -3; i <= 3; i++) b.box(0.025, 0.008, S.id, '#a59f93', (i / 3.5) * hw, F, 0);
    b.box(S.iw + 0.2, 0.08, S.id + 0.2, '#f4f0e8', 0, H, 0);
    b.box(S.iw + 0.2, H - F, 0.1, wallC, 0, F, -hd - 0.05); b.box(0.1, H - F, S.id, wallC, -hw - 0.05, F, 0); b.box(0.1, H - F, S.id, wallC, hw + 0.05, F, 0);
    const dl = S.doorX - 0.62, dr = S.doorX + 0.62, DH = 2.15;
    if (S.shop) { // the front is glass from a low sill up to the sign: the room only adds the sill, the piers and the wall above
      const x0 = S.w / 2 - 0.5, sill = 0.85, head = 2.95;
      for (const s of [-1, 1]) { b.box(hw + 0.1 - 0.62, sill - F, 0.1, wallC, s * (hw + 0.1 + 0.62) / 2, F, hd + 0.05); b.box(hw + 0.1 - x0, head - sill, 0.1, wallC, s * (hw + 0.1 + x0) / 2, sill, hd + 0.05); b.box(0.16, head - sill, 0.1, wallC, s * 0.7, sill, hd + 0.05); }
      b.box(S.iw + 0.2, H - head, 0.1, wallC, 0, head, hd + 0.05); b.box(1.24, head - F - DH, 0.1, wallC, 0, F + DH, hd + 0.05);
      for (const s of [-1, 1]) b.box(x0 - 0.78, 0.05, 0.3, '#8a6a48', s * (x0 + 0.78) / 2, sill, hd - 0.1); // a shelf in the window
    } else {
      if (dl > -hw + 0.05) b.box(dl + hw + 0.1, H - F, 0.1, wallC, (dl - hw - 0.1) / 2, F, hd + 0.05);
      if (dr < hw - 0.05) b.box(hw - dr + 0.1, H - F, 0.1, wallC, (dr + hw + 0.1) / 2, F, hd + 0.05);
      b.box(1.24, H - F - DH, 0.1, wallC, S.doorX, F + DH, hd + 0.05);
    }
    for (const x of [dl, dr]) b.box(0.09, DH, 0.18, '#5b4636', x, F, hd + 0.03); b.box(1.33, 0.09, 0.18, '#5b4636', S.doorX, F + DH, hd + 0.03);
    b.box(S.iw, 0.11, 0.025, '#d8cdb9', 0, F, -hd + 0.012); b.box(0.025, 0.11, S.id, '#d8cdb9', -hw + 0.012, F, 0); b.box(0.025, 0.11, S.id, '#d8cdb9', hw - 0.012, F, 0);
    b.cyl(0.015, 0.015, 0.45, '#3a3a3a', 0, H - 0.45, 0); b.sphere(0.17, '#fff1d0', 0, H - 0.62, 0, { glow: '#ffdfa0', glowK: 1 });
    const win = (x, z, ry, cur) => b.group({ x, z, ry }, () => { // a window seen from inside: bright by day, dark at night
      b.box(1.1, 1.25, 0.03, glass, 0, F + 0.95, 0, gl);
      for (const y of [0.9, 2.2]) b.box(1.24, 0.07, 0.07, '#f5f1e8', 0, F + y, 0); for (const xx of [-0.6, 0, 0.6]) b.box(xx ? 0.07 : 0.05, 1.3, 0.07, '#f5f1e8', xx, F + 0.92, 0);
      if (cur) for (const sx of [-1, 1]) b.box(0.24, 1.55, 0.05, cur, sx * 0.76, F + 0.82, 0.04);
    });
    if (S.tower) { // a lobby: a name panel behind the reception desk, lift doors, letterboxes, pendant lights, a glass front
      const cx = Math.min(hw - 2.0, 2.8);
      b.box(2.4, 0.72, 0.05, '#2c3138', cx, F + 2.0, -hd + 0.03); b.box(1.7, 0.16, 0.02, '#f1e6c8', cx, F + 2.3, -hd + 0.06, { glow: '#f1e6c8', glowK: 0.6 });
      for (const i of [0, 1]) { const lx = -hw + 1.5 + i * 1.95; if (lx > cx - 2.6) continue;
        b.box(1.5, 2.4, 0.06, '#9aa1a8', lx, F, -hd + 0.03, { metal: 0.6, rough: 0.35 }); b.box(0.03, 2.36, 0.08, '#3a3f47', lx, F, -hd + 0.04); b.box(1.72, 0.12, 0.12, '#3a3f47', lx, F + 2.4, -hd + 0.06); for (const sx of [-1, 1]) b.box(0.11, 2.4, 0.12, '#3a3f47', lx + sx * 0.8, F, -hd + 0.06);
        b.box(0.34, 0.14, 0.03, '#111418', lx, F + 2.64, -hd + 0.04, { glow: '#ffb24a', glowK: 0.9 }); b.box(0.08, 0.2, 0.03, '#d8d2c6', lx + 0.98, F + 1.15, -hd + 0.03); }
      const mz = Math.min(hd - 2.2, 1.2); for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) b.box(0.04, 0.26, 0.34, (r + c) % 2 ? '#aab2b9' : '#98a1a9', hw - 0.03, F + 1.0 + r * 0.3, mz - 0.95 + c * 0.38, { metal: 0.5, rough: 0.4 });
      for (const x of [-hw / 2, 0, hw / 2]) { b.cyl(0.012, 0.012, 1.0, '#3a3a3a', x, H - 1.0, 0.4); b.sphere(0.2, '#fff1d0', x, H - 1.16, 0.4, { glow: '#ffdfa0', glowK: 1 }); }
      for (const s of [-1, 1]) { const x0 = s < 0 ? -hw + 0.3 : dr + 0.3, x1 = s < 0 ? dl - 0.3 : hw - 0.3; if (x1 - x0 > 0.6) { b.box(x1 - x0, 2.7, 0.03, glass, (x0 + x1) / 2, F + 0.25, hd - 0.012, gl); const n = Math.max(1, Math.round((x1 - x0) / 1.6)); for (let i = 0; i <= n; i++) b.box(0.07, 2.8, 0.08, '#2c3138', x0 + ((x1 - x0) * i) / n, F + 0.2, hd - 0.03); b.box(x1 - x0 + 0.1, 0.08, 0.08, '#2c3138', (x0 + x1) / 2, F + 2.95, hd - 0.03); } }
    } else if (!S.shop) { // a living room: two windows with curtains
      win(-hw + 0.012, -hd / 2 - 0.2, 90, '#b9654a'); win(hw - 0.012, hd / 2 + 0.3, 270, '#b9654a');
    } else { // a shop or café: the menu board behind the counter, pendant lamps, display windows either side of the door, a side window
      const cx = hw - 1.55;
      b.box(2.4, 0.5, 0.05, '#2c2f34', cx, F + 2.2, -hd + 0.03); for (let i = 0; i < 3; i++) b.box(0.6, 0.06, 0.02, '#f1e6c8', cx - 0.75 + i * 0.75, F + 2.42, -hd + 0.06, { glow: '#f1e6c8', glowK: 0.4 });
      for (const x of [-hw / 2, hw / 2]) { b.cyl(0.012, 0.012, 0.7, '#3a3a3a', x, H - 0.7, 0.3); b.cone(0.22, 0.2, '#2f3e52', x, H - 0.9, 0.3); b.sphere(0.09, '#fff1d0', x, H - 0.86, 0.3, { glow: '#ffdfa0', glowK: 1 }); }
      win(hw - 0.012, -hd / 2 + 2.2, 270, null);
    }
    const r = YX.realize(B.root); r.group.traverse((m) => { m.castShadow = false; }); o.holder.add(r.group);
    return { o, S, group: r.group, key: keyOf(o) };
  }

  /* the furniture of a room, as objects: [type, x, z, facing in degrees, params], in the room's own frame */
  function plan(o) {
    const S = spec(o), hw = S.iw / 2, hd = S.id / 2, it = [], put = (type, x, z, ry, params) => it.push([type, x, z, ry || 0, params || null]);
    if (S.tower) { // lobby: reception at the back, a waiting corner by the glass front
      const cx = Math.min(hw - 2.0, 2.8), cz = -hd + 2.3, wx = -hw + 2.1, wz = hd - 2.7;
      put('counter', cx, cz, 0, { width: 2.8, color: '#4a3a2e', case: false }); put('chair', cx, cz - 0.8, 0, { color: '#2f3e52' });
      put('rug', wx, wz, 0, { width: 3.3, depth: 3.2, color: '#566579', border: '#3e4a5c' });
      put('sofa', wx, wz + 1.15, 180, { width: 2.0, color: '#6f7f8f' }); put('sofa', wx, wz - 1.15, 0, { width: 2.0, color: '#6f7f8f' });
      put('ftable', wx, wz, 0, { width: 1.1, depth: 0.6, height: 0.4, color: '#3a2e27', top: 'books' });
      put('plant', hw - 0.55, hd - 0.6); put('plant', -hw + 0.55, hd - 0.6); put('plant', hw - 0.55, -hd + 0.6);
      put('picture', -hw + 0.02, -hd / 2, 90, { color: '#7fa3b5' }); put('picture', -hw + 0.02, -hd / 2 + 1.1, 90, { color: '#d9a441' });
    } else if (!S.shop) { // living room: sofa, rug and coffee table on the left, television on the right, bookshelf, kitchen and dining table at the back
      const sx0 = -hw + 0.56, sz0 = Math.min(0.4, hd - 2.6), dx0 = Math.min(hw - 1.6, 1.9), dz0 = -hd + 2.25;
      put('rug', sx0 + 1.55, sz0, 0, { width: 2.7, depth: 3.3 });
      put('sofa', sx0, sz0, 90, { width: 2.2 }); put('ftable', sx0 + 1.6, sz0, 90, { width: 1.1, depth: 0.6, height: 0.42, color: '#7a5a3c', top: 'books' });
      put('tv', hw - 0.3, sz0, 270); put('floorlamp', sx0 - 0.2, sz0 + 1.5);
      put('shelf', -hw / 2, -hd + 0.19, 0, { width: Math.max(0.8, Math.min(1.8, hw - 0.6)), height: 2.0, stock: 'books' });
      put('kitchen', hw - 1.45, -hd + 0.34, 0, { width: 2.5 });
      put('ftable', dx0, dz0, 0, { width: 1.5, depth: 0.9, height: 0.74, color: '#8a6a48', top: 'vase' });
      put('chair', dx0 - 0.42, dz0 - 0.72, 0); put('chair', dx0 + 0.42, dz0 - 0.72, 0); put('chair', dx0 - 0.42, dz0 + 0.72, 180); put('chair', dx0 + 0.42, dz0 + 0.72, 180);
      put('plant', hw - 0.5, hd - 0.5); put('picture', -hw + 0.02, sz0, 90, { color: '#7fa3b5' }); put('picture', Math.min(hw - 0.8, S.doorX + 1.9), hd - 0.02, 180, { color: '#d9a441' });
    } else { // shop or café: counter and till at the back, shelves of its own goods, a display table, tables by the window where it serves food
      const stock = STOCK_OF[S.name] || 'mixed', food = S.name === 'BAKERY' || S.name === 'TEA' || S.name === 'CAFE', bw = Math.min(3.4, S.iw - 3.4), sw = Math.max(1, Math.min(3.6, S.id - 3.0));
      put('counter', hw - 1.55, -hd + 1.5, 0, { width: 2.4, case: food, stock });
      if (bw > 1) put('shelf', -hw + 0.3 + bw / 2, -hd + 0.19, 0, { width: bw, height: 2.3, stock });
      put('shelf', -hw + 0.19, -hd + 1.4 + sw / 2, 90, { width: sw, height: 2.3, stock });
      put('ftable', -0.4, 0.3, 0, { width: 1.7, depth: 0.95, height: 0.8, color: '#8a6a48', top: S.name === 'FLOWERS' || S.name === 'MARKET' ? 'plants' : 'goods', stock });
      if (food) for (const sx of [-1, 1]) put('table', sx * (hw - 1.35), hd - 1.3, sx > 0 ? 30 : 200, { umbrella: false, color: '#3e6b4f' });
      else put('plant', hw - 0.5, hd - 0.55);
    }
    return it;
  }
  function furnish(o) {
    const S = spec(o), fy = o.y + S.F * o.s[1];
    for (const [type, lx, lz, ry, params] of plan(o)) {
      if (!YX.defOf(type) || Math.abs(lx) > S.iw / 2 + 0.05 || Math.abs(lz) > S.id / 2 + 0.05) continue;
      const w = world(o, lx, lz);
      try { YX.spawn({ type, params: params || {}, x: w[0], z: w[1], y: fy, rot: o.rot + ry * DEG, motion: 'none', attach: { to: o.id, anchor: 'floor', ox: lx, oz: lz, rr: ry * DEG } }); } catch (e) { console.warn('furnish', type, e); }
    }
    o.params._furn = 1; YX.markDirty();
  }
  function showKids(o, on) { const walk = (p) => { for (const id of p.kids) { const k = W.objs.get(id); if (k && k.holder) { k.holder.visible = on; if (k.kids.size) walk(k); } } }; for (const id of o.kids) { const k = W.objs.get(id); if (k && k.attach && k.attach.anchor === 'floor' && k.holder) { k.holder.visible = on; if (k.kids.size) walk(k); } } }

  /* what the rest of the engine asks about rooms */
  /* Some objects have room inside them: a building has a room behind its walls, a gazebo has an open floor under its roof.
     spaceOf says where that room is, in the object's own frame; whatever stands in it is attached to the object (anchor "floor" for a closed room,
     "deck" for an open one) and can walk about within those bounds. */
  YX.spaceOf = (o) => { if (!o || o.dead) return null; if (ENTER[o.type]) { const S = spec(o); return { anchor: 'floor', floor: S.F, hx: S.iw / 2, hz: S.id / 2, enclosed: true, doorX: S.doorX }; } const d = YX.defOf(o), q = d && d.inside ? d.inside(o.params) : null; return q ? { anchor: 'deck', floor: q.floor, hx: q.hx, hz: q.hz, enclosed: false, doorX: 0, water: !!q.water } : null; };
  YX.floorOf = (o) => { const sp = YX.spaceOf(o); return sp ? sp.floor : 0; }; // height of that floor above the object's base, in the object's own units
  YX.roomHas = (o, x, z, m) => { const sp = YX.spaceOf(o); if (!sp) return false; const l = local(o, x, z); return Math.abs(l[0]) <= sp.hx - (m || 0) && Math.abs(l[1]) <= sp.hz - (m || 0); };
  YX.roomClamp = (o, x, z, m) => { const sp = YX.spaceOf(o); if (!sp) return [x, z]; const l = local(o, x, z), mx = Math.max(0, sp.hx - (m || 0)), mz = Math.max(0, sp.hz - (m || 0)); return world(o, clamp(l[0], -mx, mx), clamp(l[1], -mz, mz)); };
  /* Furniture knows where it belongs in a room. Everything stands square to the walls. What lives against a wall (a sofa, a shelf, a television,
     a kitchen unit, a picture) backs onto the nearest free stretch of wall and looks into the room; a chair turns to the table beside it; the rest
     turns to the side of the room the player is on. (x, z) is where the player pointed; fx, fz is the free spot already found near it. */
  const HABIT = { sofa: 'wall', shelf: 'wall', tv: 'wall', kitchen: 'wall', picture: 'wall' }, DEG90 = Math.PI / 2;
  YX.roomFit = function (B, type, info, x, z, fx, fz, self, view) {
    const sp = YX.spaceOf(B); if (!sp || !sp.enclosed) return null;
    const W = YX.world, l = local(B, x, z), hw = sp.hx, hd = sp.hz, wd = Math.max(0.3, (info.fw || 1) / B.s[0]), dp = Math.max(0.04, (info.fd || 0.5) / B.s[2]), others = [];
    for (const id of B.kids) { const k = W.objs.get(id); if (!k || k === self || k.dead || !k.attach || k.attach.anchor !== 'floor') continue; const kd = YX.defOf(k); if (!kd || kd.flat) continue; const q = local(B, k.x, k.z); others.push({ x: q[0], z: q[1], r: Math.max(0.25, (k.fr || 0.5) * 0.8), type: k.type }); }
    if (HABIT[type] === 'wall') {
      const pic = type === 'picture', off = pic ? 0.02 : dp / 2 + 0.06, half = wd / 2, r = Math.min(1.1, Math.max(half, dp / 2)) * 0.8, rivals = others.filter((q) => (pic ? q.type === 'picture' : q.type !== 'picture')), free = (px, pz) => !rivals.some((q) => Math.hypot(q.x - px, q.z - pz) < q.r + r);
      const walls = [{ d: l[1] + hd, ry: 0, at: (t) => [t, -hd + off], t: l[0], span: hw }, { d: l[0] + hw, ry: 1, at: (t) => [-hw + off, t], t: l[1], span: hd }, { d: hw - l[0], ry: 3, at: (t) => [hw - off, t], t: l[1], span: hd }, { d: hd - l[1], ry: 2, at: (t) => [t, hd - off], t: l[0], span: hw, door: true }].sort((a, b) => a.d - b.d);
      for (const w of walls) { const max = w.span - half - 0.08; if (max < 0) continue;
        for (let k = 0; k < 44; k++) { const t = clamp(w.t + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.28, -max, max); if (w.door && Math.abs(t - sp.doorX) < half + 0.75) continue; const q = w.at(t); if (free(q[0], q[1])) { const g = world(B, q[0], q[1]); return [g[0], g[1], B.rot + w.ry * DEG90]; } } }
      return null;
    }
    const f = local(B, fx, fz); let tx = null, tz = null;
    if (type === 'chair') { let best = 1.7; for (const q of others) if ((q.type === 'ftable' || q.type === 'table' || q.type === 'counter') && Math.hypot(q.x - f[0], q.z - f[1]) < best) { best = Math.hypot(q.x - f[0], q.z - f[1]); tx = q.x; tz = q.z; } }
    if (tx == null && view) { const pv = local(B, view.x, view.z); tx = pv[0]; tz = pv[1]; }
    const ry = tx == null ? 0 : Math.round(Math.atan2(tx - f[0], tz - f[1]) / DEG90);
    return [fx, fz, B.rot + ry * DEG90];
  };
  YX.wallSpot = (B, name, x, z) => { const sp = YX.spaceOf(B); if (!sp) return null; const l = local(B, x, z), n = String(name || '').toLowerCase(); return n === 'back' ? world(B, l[0], -sp.hz) : n === 'left' ? world(B, -sp.hx, l[1]) : n === 'right' ? world(B, sp.hx, l[1]) : n === 'front' ? world(B, l[0], sp.hz) : null; };
  YX.spaceSpot = (o, lx, lz) => world(o, lx, lz); // a point of the space, given in the object's own frame
  function drop(id) { const r = rooms.get(id); if (!r) return; if (r.group.parent) r.group.parent.remove(r.group); r.group.traverse((m) => { if (m.geometry && m.geometry.dispose) m.geometry.dispose(); }); rooms.delete(id); if (cur === r) cur = null; }

  YX.insideOf = () => (cur ? cur.o : null);
  YX.insideTick = function (dt) {
    const P = W.player;
    if (++tick % 10 === 0) {
      let want = null, wantD = 1e9; // one room is furnished per pass, the nearest first, so walking down a street never stutters
      const eyes = YX.eyes ? YX.eyes() : []; // standing cameras look at the world too: the room one of them is in stays built
      for (const o of Array.from(W.objs.values())) {
        if (!ENTER[o.type] || o.dead || o.attach || !o.holder) continue;
        let d = Math.hypot(o.x - P.x, o.z - P.z) - Math.max(o.foot[0], o.foot[1]) / 2; const r = rooms.get(o.id); for (const e of eyes) d = Math.min(d, Math.hypot(o.x - e.x, o.z - e.z) - Math.max(o.foot[0], o.foot[1]) / 2);
        const glassy = o.type === 'shop' || o.type === 'cafe', seeIn = glassy && d < 46; // a shop's room exists as soon as you could look through its window
        if ((d < 15 || seeIn) && (!r || r.key !== keyOf(o))) { drop(o.id); try { rooms.set(o.id, build(o)); } catch (e) { console.warn('interior', e); } }
        else if (d > (glassy ? 60 : 28) && r && r !== cur) drop(o.id);
        if (rooms.has(o.id) && !o.params._furn && d < wantD) { want = o; wantD = d; }
        const on = rooms.has(o.id); if (o._kidsOn !== on || on) { o._kidsOn = on; showKids(o, on); } // furniture is drawn only while its room is
      }
      if (want) furnish(want);
      for (const id of Array.from(rooms.keys())) { const o = W.objs.get(id); if (!o || o.dead) drop(id); }
    }
    for (const r of rooms.values()) { const l = local(r.o, P.x, P.z); if (Math.abs(l[0] - r.S.doorX) < 1.0 && Math.abs(l[1] - r.S.d / 2) < 1.7 && P.y < r.o.y + 3.2 && YX.holdDoor) YX.holdDoor(r.o, 0.5); } // the door opens for the player as it does for anyone
    cur = null; for (const r of rooms.values()) { const l = local(r.o, P.x, P.z); if (Math.abs(l[0]) < r.S.w / 2 && Math.abs(l[1]) < r.S.d / 2 && P.y < r.o.y + r.S.H * r.o.s[1] + 0.6) { cur = r; break; } } // inside = within the walls and under the ceiling
    let near = cur, step = 0;
    if (!near) for (const r of rooms.values()) { const l = local(r.o, P.x, P.z); if (Math.abs(l[0]) < r.S.w / 2 + 1.2 && Math.abs(l[1]) < r.S.d / 2 + 1.2 && P.y < r.S.H + 2) { near = r; break; } }
    if (YX.eyes && (!near || (YX.rig && YX.rig.rec))) for (const e of YX.eyes()) { let hit = null; for (const r of rooms.values()) { const l = local(r.o, e.x, e.z); if (Math.abs(l[0]) < r.S.w / 2 && Math.abs(l[1]) < r.S.d / 2 && e.y < r.o.y + r.S.H * r.o.s[1] + 0.6) { hit = r; break; } } if (hit) { near = hit; break; } } // the room's lamp is lit for a camera standing in it, as it is for the player
    if (cur && !P.fly) step = cur.S.F * cur.o.s[1]; // stand on the room's floor, which sits on the building's plinth
    YX.lift = (YX.lift || 0) + (step - (YX.lift || 0)) * Math.min(1, (dt || 0.016) * 9);
    lamp.intensity += ((near ? (day() ? 0.7 : 1.1) : 0) - lamp.intensity) * Math.min(1, (dt || 0.016) * 6);
    if (near) lamp.position.set(near.o.x, near.o.y + (near.S.H - 0.55) * near.o.s[1], near.o.z);
  };
})();
