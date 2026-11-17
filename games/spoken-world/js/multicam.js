/* Spoken World · multicam: three cameras on one moment.
   "Film the bus with three cameras" puts three cameras around what the crosshair is on: a wide one, one from the side at eye level, a low one close in.
   They stay where they are and turn to follow it. Three small monitors show what each one sees. "Action" films all three at once, for the same seconds,
   side by side in one clip (three 1280x720 pictures next to each other), so every angle shows exactly the same moment: the same bus, the same people,
   the same light. "Cut" ends it; "take down the cameras" removes them. */
'use strict';
(function () {
  const YX = window.YX, W = YX.world, T = YX.T, $ = (id) => document.getElementById(id);
  const { renderer, scene, camera } = YX.three;
  const MARK = 5, TILE = [1280, 720], LIMIT = 10;
  const rig = { on: false, cams: [], target: null, point: null, rec: null, k: 0 };
  YX.rig = rig;

  /* ---------- the cameras ---------- */
  function subject() {
    const o = rig.target != null ? W.objs.get(rig.target) : null;
    if (o && !o.dead) { const sz = o.size || [2, 2, 2]; return { x: o.x, y: o.y, z: o.z, h: sz[1], r: Math.max(sz[0], sz[2]) / 2, w: Math.min(sz[0], sz[2]), o }; }
    const p = rig.point || [W.player.x, W.player.z]; return { x: p[0], y: 0, z: p[1], h: 1.8, r: 1.5, w: 1, o: null };
  }
  function clearSpot(x, z) { // a camera may stand on a road or a lawn, not inside a house or a tree
    const f = YX.findFree ? YX.findFree(x, z, 0.45, { roads: false, max: 12 }) : null; return f || [x, z];
  }
  const ANGLES = [ // direction measured from the line between the player and the subject; distance and height grow with the size of the subject
    { key: 'A', en: 'WIDE', zh: '全景', turn: 35, d: (s) => Math.max(14, s.r * 4.2 + 8), y: (s) => Math.max(6, s.h * 1.4 + 3), fov: 46, at: 0.35 },
    { key: 'B', en: 'SIDE', zh: '侧面', turn: 100, d: (s) => Math.max(7, s.r * 2.4 + 4), y: () => 1.6, fov: 40, at: 0.5 },
    { key: 'C', en: 'LOW', zh: '低机位', turn: -55, d: (s) => Math.max(4.2, s.r * 1.5 + 2.2), y: () => 0.65, fov: 36, at: 0.62 },
  ];
  // more ways to look at something that stands still; "film this with three cameras: wide, close and from above" picks three of them
  const MORE = {
    close: { en: 'CLOSE', zh: '特写', turn: 18, d: (s) => Math.max(1.5, s.r * 1.3 + 1.1), y: (s) => Math.max(0.5, s.h * 0.86), fov: 26, at: 0.86 },
    front: { en: 'FRONT', zh: '正面', turn: 0, d: (s) => Math.max(5, s.r * 2.6 + 3), y: (s) => Math.max(1.4, Math.min(1.7, s.h * 0.8)), fov: 40, at: 0.5 },
    back: { en: 'BACK', zh: '背后', turn: 180, d: (s) => Math.max(5, s.r * 2.6 + 3), y: () => 1.6, fov: 40, at: 0.5 },
    top: { en: 'TOP', zh: '俯拍', turn: 8, d: (s) => Math.max(2.5, s.r * 0.9), y: (s) => s.h * 1.8 + Math.max(7, s.r * 3), fov: 48, at: 0.4 },
  };
  const NAMED = { wide: 0, side: 1, low: 2 }, ALIAS = { closeup: 'close', 'close-up': 'close', face: 'close', tight: 'close', detail: 'close', overhead: 'top', high: 'top', above: 'top', aerial: 'top', birdseye: 'top', behind: 'back', rear: 'back', profile: 'side', full: 'wide', establishing: 'wide', ground: 'low', 特写: 'close', 近景: 'close', 脸: 'close', 正面: 'front', 背面: 'back', 背后: 'back', 后面: 'back', 俯拍: 'top', 顶视: 'top', 高处: 'top', 上方: 'top', 全景: 'wide', 远景: 'wide', 侧面: 'side', 侧拍: 'side', 低机位: 'low', 低角度: 'low', 仰拍: 'low' };
  function anglesFor(list) { // three named ways of looking, in A B C order; anything not named falls back to wide, side, low
    const want = []; for (const w of Array.isArray(list) ? list : []) { let k = String(w || '').toLowerCase().replace(/[\s_]+/g, '').replace(/shot|angle|camera|机位|镜头|角度/g, ''); k = ALIAS[k] || k; if ((k in NAMED || MORE[k]) && !want.includes(k)) want.push(k); }
    for (const k of ['wide', 'side', 'low', 'close', 'front']) { if (want.length >= 3) break; if (!want.includes(k)) want.push(k); }
    return want.slice(0, 3).map((k, i) => Object.assign({}, k in NAMED ? ANGLES[NAMED[k]] : MORE[k], { key: KEYS3[i] }));
  }
  const KEYS3 = ['A', 'B', 'C'];
  /* a camera described by numbers instead of picked from a list: where it is round the subject (az: 0 = in front of it, 90 = its right, 180 = behind),
     how far and how high, the lens, what part of the subject it looks at, and whether it travels with the subject or stands and turns.
     The named angles are shorthand for these, so every one of them works on something that moves as well. */
  const SPEC = {
    wide: (q) => ({ az: 168, dist: Math.max(9, q.r * 1.6 + 6), height: Math.max(4.5, q.h * 1.2 + 2.5), lens: 27, look: 0.4 }),
    side: (q) => ({ az: 90, dist: Math.max(4.8, q.r * 1.15 + 2.2, q.w * 0.5 + 3.2), height: Math.max(1.3, Math.min(1.8, q.h * 0.45)), lens: 30 }),
    low: (q) => ({ az: 14, dist: q.r + Math.max(3.5, q.h * 1.5), height: 0.55, lens: 34 }),
    close: (q) => ({ az: 24, dist: Math.max(1.5, q.r * 1.3 + 1.1), height: Math.max(0.5, q.h * 0.86), lens: 58, look: 0.86 }),
    front: (q) => ({ az: 0, dist: Math.max(5, q.r * 2.6 + 3), height: Math.max(1.4, Math.min(1.7, q.h * 0.8)), lens: 35 }),
    back: (q) => ({ az: 180, dist: Math.max(5, q.r * 2.6 + 3), height: 1.6, lens: 35 }),
    top: (q) => ({ az: 180, dist: Math.max(2, q.r * 0.8), height: q.h * 1.8 + Math.max(7, q.r * 3), lens: 28, look: 0.4 }),
  };
  const ZHN = { wide: '全景', side: '侧面', low: '低机位', close: '特写', front: '正面', back: '背后', top: '俯拍' };
  const nameKey = (w) => { let k = String(w || '').toLowerCase().replace(/[\s_]+/g, '').replace(/shot|angle|camera|机位|镜头|角度/g, ''); return ALIAS[k] || k; };
  function specList(cams, angles, q, moving) { // -> up to three complete descriptions
    const out = [], fnum = (v, d) => (isFinite(+v) ? +v : d);
    for (const c of Array.isArray(cams) ? cams : []) { if (!c || typeof c !== 'object') continue; const base = SPEC[nameKey(c.kind || c.angle || c.name)], b = base ? base(q) : { az: 30, dist: Math.max(4, q.r * 2 + 3), height: 1.6, lens: 35 };
      const look = typeof c.look === 'string' ? ({ face: 0.88, head: 0.9, top: 0.95, chest: 0.7, middle: 0.5, centre: 0.5, center: 0.5, waist: 0.5, feet: 0.08, ground: 0.02, wheels: 0.15 }[c.look.toLowerCase()] || 0.5) : fnum(c.look, b.look != null ? b.look : 0.5);
      out.push({ name: String(c.name || c.kind || c.angle || '').slice(0, 16), az: fnum(c.az != null ? c.az : c.azimuth, b.az), dist: Math.min(200, Math.max(0.6, fnum(c.dist != null ? c.dist : c.distance, b.dist))), height: Math.min(150, Math.max(0.15, fnum(c.height != null ? c.height : c.y, b.height))), lens: Math.min(200, Math.max(10, fnum(c.lens, b.lens))), look: Math.min(1.2, Math.max(0, look)), travel: c.travel != null ? !!c.travel : moving }); }
    for (const w of Array.isArray(angles) ? angles : []) { const k = nameKey(w); if (SPEC[k] && out.length < 3) out.push(Object.assign({ name: k, zh: ZHN[k], travel: moving }, SPEC[k](q))); }
    return out.slice(0, 3);
  }
  // a subject on the move (a car, a bus that drives, someone walking) is filmed the way moving things are: the cameras travel with it
  const MOVING = [
    { key: 'A', en: 'CHASE', zh: '追拍', along: (s) => -Math.max(9, s.r * 1.6 + 6), side: () => 1.2, y: (s) => Math.max(4.5, s.h * 1.2 + 2.5), fov: 48, at: 0.4 },
    { key: 'B', en: 'SIDE', zh: '侧面', along: (s) => s.r * 0.15, side: (s) => Math.max(4.8, s.r * 1.15 + 2.2, s.w * 0.5 + 3.2), y: (s) => Math.max(1.3, Math.min(1.8, s.h * 0.45)), fov: 44, at: 0.5,
      lens: (s, side) => Math.atan((s.r * 1.18) / (Math.max(1, Math.abs(side) - s.w / 2) * (TILE[0] / TILE[1]))) * 2 * 57.3 }, // a long thing is filmed from the far side of the road with a wider lens, not from further away: beyond the kerb there are trees and walls

    { key: 'C', en: 'LOW FRONT', zh: '低机位前方', along: (s) => s.r + Math.max(3.5, s.h * 1.5), side: (s) => Math.max(0.9, s.w * 1.1), y: () => 0.55, fov: 38, at: 0.5,
      lens: (s) => Math.atan((s.h * 0.62) / Math.max(3.5, s.h * 1.5)) * 2 * 57.3 }, // something tall is seen three-quarters on, whole, from low down

  ];
  const speedOf = (o) => (o && o.ms && typeof o.ms.v === 'number' ? Math.abs(o.ms.v) : 0);
  const headOf = (o) => { const v = o.ms && o.ms.v < 0 ? -1 : 1; return [Math.sin(o.rot || 0) * v, Math.cos(o.rot || 0) * v]; }; // the way it is going
  function markerFor(key) {
    const g = new THREE.Group(), dark = new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.6, metalness: 0.2 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.62), dark); g.add(body);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.26, 16), dark); lens.rotation.x = Math.PI / 2; lens.position.set(0, 0, -0.42); g.add(lens);
    const tally = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: 0x5a1a14 })); tally.position.set(0.15, 0.2, -0.2); g.add(tally); g.userData.tally = tally;
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), dark); legs.position.y = -0.66; g.add(legs); g.userData.legs = legs;
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.fillStyle = 'rgba(14,16,22,.82)'; x.beginPath(); x.arc(32, 32, 28, 0, 6.283); x.fill(); x.fillStyle = '#ffd34d'; x.font = '600 34px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(key, 32, 34);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })); sp.scale.set(0.5, 0.5, 0.5); sp.position.y = 0.55; g.add(sp);
    g.traverse((m) => m.layers.set(MARK)); return g;
  }
  /* a camera has to see its subject: if a bench, a tree or a house stands in the line, it moves round a little (or steps in or back) until the line is clear */
  const _ray = new THREE.Ray(), _bx = new THREE.Box3(), _hit = new THREE.Vector3();
  function blocked(s, x, y, z) {
    let n = 0; const tgt = s.o;
    for (const ty of [s.y + s.h * 0.35, s.y + s.h * 0.7]) {
      const dx = s.x - x, dy = ty - y, dz = s.z - z, L = Math.hypot(dx, dy, dz) || 0.01, end = L - Math.max(0.3, s.r * 0.8); _ray.origin.set(x, y, z); _ray.direction.set(dx / L, dy / L, dz / L);
      for (const o of W.objs.values()) {
        if (o === tgt || o.dead || !o.box || !o.holder || (tgt && o.attach && o.attach.to === tgt.id) || (tgt && tgt.attach && tgt.attach.to === o.id)) continue;
        const d = YX.defOf(o) || {}; if (d.flat || d.cls === 'ground' || o.type === 'road') continue;
        _bx.copy(o.box).applyMatrix4(o.holder.matrixWorld); if (_bx.max.y - _bx.min.y < 0.35) continue; // flowers and kerbs do not hide anything
        if (_ray.intersectBox(_bx, _hit) && _hit.distanceTo(_ray.origin) < end) { n++; break; }
      }
    }
    return n;
  }
  function bestSpot(s, A, dx, dz, d) {
    let best = null, bn = 9;
    for (const turn of [0, 14, -14, 28, -28, 42, -42]) for (const k of [1, 0.8, 1.25]) {
      const a = (turn * Math.PI) / 180, ex = dx * Math.cos(a) - dz * Math.sin(a), ez = dx * Math.sin(a) + dz * Math.cos(a), p = clearSpot(s.x + ex * d * k, s.z + ez * d * k), n = blocked(s, p[0], A.y(s), p[1]);
      if (n < bn) { bn = n; best = p; } if (!n) return p;
    }
    return best;
  }
  function build(view, angles, cams) {
    takeDown(true); const s = subject();
    let fx = s.x - view.x, fz = s.z - view.z; const l = Math.hypot(fx, fz); if (l < 0.5) { fx = view.fx; fz = view.fz; } else { fx /= l; fz /= l; }
    const moving0 = !!(s.o && speedOf(s.o) > 0.3), list = (Array.isArray(cams) && cams.length) || (moving0 && Array.isArray(angles) && angles.length) ? specList(cams, angles, s, moving0) : [];
    if (list.length) { // cameras given as numbers (or named angles on something that moves)
      const hd = s.o ? headOf(s.o) : [-fx, -fz], hx = hd[0], hz = hd[1], rx = hz, rz = -hx;
      list.forEach((q, i) => { const a = (q.az * Math.PI) / 180, along = Math.cos(a) * q.dist, side = Math.sin(a) * q.dist, fov = Math.min(95, Math.max(6, (2 * Math.atan(12 / q.lens) * 180) / Math.PI));
        const A = { key: KEYS3[i], en: (q.name || 'CAM ' + KEYS3[i]).toUpperCase(), zh: q.zh || q.name || KEYS3[i] + ' 机位', at: q.look, fov }, cam = new THREE.PerspectiveCamera(fov, TILE[0] / TILE[1], camera.near, camera.far); cam.layers.disableAll(); for (const L of [0, 1, 2]) cam.layers.enable(L);
        const mk = markerFor(A.key), rt = new THREE.WebGLRenderTarget(384, 216, { depthBuffer: true }); scene.add(mk);
        if (q.travel && s.o) { mk.userData.legs.visible = false; rig.cams.push({ A, cam, mk, rt, track: { along, side, y: q.height } }); }
        else { let px = s.x + hx * along + rx * side, pz = s.z + hz * along + rz * side; if (q.height < 3.5) { const p = clearSpot(px, pz); px = p[0]; pz = p[1]; } cam.position.set(px, s.y + q.height, pz); rig.cams.push({ A, cam, mk, rt }); } });
      camera.layers.enable(MARK); rig.on = true; rig.fresh = true; rig.moving = rig.cams.some((c) => c.track); aim(); paintHud(); return;
    }
    if (s.o && speedOf(s.o) > 0.3) { // travelling: chase from behind and above, alongside on the side the road continues, low in front looking back
      const [hx, hz] = headOf(s.o), rx = hz, rz = -hx, pick = (sd) => { const px = s.x + rx * sd, pz = s.z + rz * sd; return (YX.roadAt && YX.roadAt(px, pz) ? 0 : 2) + blocked(s, px, 1.6, pz); };
      const sideSign = pick(MOVING[1].side(s)) <= pick(-MOVING[1].side(s)) ? 1 : -1;
      for (const A of MOVING) {
        const sd = A.side(s) * (A.key === 'B' ? sideSign : -sideSign), fov = A.lens ? Math.max(A.fov, Math.min(62, A.lens(s, sd))) : A.fov, cam = new THREE.PerspectiveCamera(fov, TILE[0] / TILE[1], camera.near, camera.far); cam.layers.disableAll(); for (const L of [0, 1, 2]) cam.layers.enable(L);
        const mk = markerFor(A.key); mk.userData.legs.visible = false; scene.add(mk);
        const rt = new THREE.WebGLRenderTarget(384, 216, { depthBuffer: true }); rig.cams.push({ A, cam, mk, rt, track: { along: A.along(s), side: sd, y: A.y(s) } });
      }
      camera.layers.enable(MARK); rig.on = true; rig.fresh = true; rig.moving = true; aim(); paintHud(); return;
    }
    rig.moving = false;
    for (const A of angles && angles.length ? anglesFor(angles) : ANGLES) {
      const a = (A.turn * Math.PI) / 180, bx = -fx, bz = -fz, dx = bx * Math.cos(a) - bz * Math.sin(a), dz = bx * Math.sin(a) + bz * Math.cos(a), d = A.d(s);
      const p = bestSpot(s, A, dx, dz, d), cam = new THREE.PerspectiveCamera(A.fov, TILE[0] / TILE[1], camera.near, camera.far);
      cam.layers.disableAll(); for (const L of [0, 1, 2]) cam.layers.enable(L);
      cam.position.set(p[0], A.y(s), p[1]); const mk = markerFor(A.key); scene.add(mk);
      const rt = new THREE.WebGLRenderTarget(384, 216, { depthBuffer: true }); rig.cams.push({ A, cam, mk, rt });
    }
    camera.layers.enable(MARK); rig.on = true; rig.fresh = true; aim(); paintHud();
  }
  function aim() { // the cameras stay put and turn to keep the subject in frame
    const s = subject();
    if (s.o) for (const c of rig.cams) if (c.track) { const [hx, hz] = speedOf(s.o) > 0.05 || !c.track.h ? (c.track.h = headOf(s.o)) : c.track.h, rx = hz, rz = -hx; c.cam.position.set(s.x + hx * c.track.along + rx * c.track.side, s.y + c.track.y, s.z + hz * c.track.along + rz * c.track.side); }
    for (const c of rig.cams) { if (!c.A.free) c.cam.lookAt(s.x, s.y + s.h * c.A.at, s.z); else if (c.A.pan != null) { const t = W.objs.get(c.A.pan); if (t && !t.dead) c.cam.lookAt(t.x, t.y + (t.size ? t.size[1] : 1.7) * 0.6, t.z); } c.cam.updateMatrixWorld(); c.mk.position.copy(c.cam.position); c.mk.quaternion.copy(c.cam.quaternion); c.mk.userData.legs.visible = !c.track; c.mk.userData.legs.scale.y = Math.max(0.2, c.cam.position.y - 0.3); c.mk.userData.legs.position.y = -(c.cam.position.y - 0.3) / 2 - 0.1; c.mk.userData.tally.material.color.setHex(rig.rec ? 0xff3b30 : 0x5a1a14); c.mk.visible = !rig.rec; }
  }
  /* a camera put down by hand: it films exactly what the player is looking at when they say "put a camera here", with the same lens, and stays that way.
     Up to three; they are filmed together like the others. This is how one camera goes inside a house and another outside its door. */
  const KEYS = ['A', 'B', 'C'];
  function dropCam(c) { scene.remove(c.mk); c.rt.dispose(); c.mk.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material) { if (m.material.map) m.material.map.dispose(); m.material.dispose(); } }); }
  function putHere(key, pan) {
    if (rig.rec) return { ok: false, msg: T('正在拍，先说“咔”', 'Rolling. Say “cut” first') };
    if (rig.on && rig.cams.some((c) => !c.A.free)) takeDown(true); // the three automatic cameras make way for the player's own
    key = key ? String(key).toUpperCase() : null; if (key && !KEYS.includes(key)) key = null;
    if (!key) key = KEYS.find((k) => !rig.cams.some((c) => c.A.key === k));
    if (!key) return { ok: false, msg: T('最多三个机位。说“把 B 机位放这里”换掉一个，或者“撤掉机位”', 'Three cameras is the most. Say “move camera B here” to re-place one, or “take down the cameras”') };
    const i = rig.cams.findIndex((c) => c.A.key === key); if (i >= 0) { dropCam(rig.cams[i]); rig.cams.splice(i, 1); }
    const inB = YX.insideOf && YX.insideOf(), A = { key, en: inB ? 'INSIDE' : 'YOUR FRAME', zh: inB ? '室内' : '定机位', at: 0.5, free: true }; if (pan && !pan.dead) { A.pan = pan.id; A.en = 'FOLLOWS'; A.zh = '摇镜跟拍'; }
    const cam = new THREE.PerspectiveCamera(camera.fov, TILE[0] / TILE[1], camera.near, camera.far); cam.layers.disableAll(); for (const L of [0, 1, 2]) cam.layers.enable(L);
    camera.updateMatrixWorld(); cam.position.copy(camera.position); cam.quaternion.copy(camera.quaternion);
    const mk = markerFor(key); scene.add(mk); const rt = new THREE.WebGLRenderTarget(384, 216, { depthBuffer: true });
    rig.cams.push({ A, cam, mk, rt }); rig.cams.sort((a, b) => a.A.key.localeCompare(b.A.key));
    rig.target = null; rig.point = null; rig.moving = false; camera.layers.enable(MARK); rig.on = true; rig.fresh = true; aim(); paintHud(); if (YX.hooks.ui) YX.hooks.ui();
    const n = rig.cams.length;
    return { ok: true, msg: T(key + ' 机位就放在这里，' + (A.pan != null ? '原地转动、一直对着 ' + YX.lab(pan) : '拍的就是你现在看到的画面') + '（共 ' + n + ' 个）。' + (n < 3 ? '走到下一个位置再说“在这里放一个机位”，或者' : '') + '说“开拍”一起拍', 'Camera ' + key + ' stands here and ' + (A.pan != null ? 'turns to keep ' + YX.lab(pan) + ' in frame' : 'films exactly this frame') + ' (' + n + ' in all). ' + (n < 3 ? 'Walk to the next spot and say “put a camera here”, or ' : '') + 'say “action” to film ' + (n > 1 ? 'them together' : 'it')) };
  }
  function removeCam(key) { key = String(key || '').toUpperCase(); const i = rig.cams.findIndex((c) => c.A.key === key); if (i < 0) return { ok: false, msg: T('没有 ' + key + ' 机位', 'There is no camera ' + key) }; if (rig.rec) stopRec(); dropCam(rig.cams[i]); rig.cams.splice(i, 1); if (!rig.cams.length) takeDown(); else { rig.fresh = true; paintHud(); } return { ok: true, msg: T(key + ' 机位撤掉了', 'Camera ' + key + ' taken down') }; }
  YX.eyes = () => (rig.on ? rig.cams.map((c) => c.cam.position) : []); // where else the world is being looked at from: a room with a camera in it has to stay built and lit
  function takeDown(quiet) {
    if (rig.rec) stopRec(); for (const c of rig.cams) dropCam(c);
    rig.cams = []; rig.on = false; paintHud(); if (!quiet && YX.hooks.ui) YX.hooks.ui();
  }

  /* ---------- the three monitors (while the cameras stand) ---------- */
  const ortho = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1), wall = new THREE.Scene(), quads = [];
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false })); m.frustumCulled = false; wall.add(m); quads.push(m); }
  const MON = { w: 208, h: 117, gap: 8, right: 16, top: 66 }; // CSS pixels, on the right edge under the tools
  function monRect(i) { return { x: window.innerWidth - MON.right - MON.w, y: MON.top + i * (MON.h + MON.gap + 18) + 18, w: MON.w, h: MON.h }; }
  const hud = document.createElement('div'); hud.id = 'rigHud';
  hud.innerHTML = '<div class="rigBtns"><button type="button" class="rigAct">● ' + T('开拍', 'Action') + '</button><button type="button" class="rigOff" title="">✕</button></div>';
  document.body.appendChild(hud);
  const css = document.createElement('style'); css.textContent = '#rigHud{position:fixed;inset:0;pointer-events:none;z-index:4;display:none}#rigHud.on{display:block}#rigHud .lab{position:absolute;font:600 10.5px/1 var(--f-mono,monospace);letter-spacing:.14em;color:#f4efe6;text-shadow:0 1px 3px rgba(0,0,0,.8)}#rigHud .lab b{color:var(--voice,#ffd34d);margin-right:6px}#rigHud .frame{position:absolute;border:1px solid rgba(255,255,255,.35);border-radius:3px;box-shadow:0 2px 14px rgba(0,0,0,.45)}#rigHud .rigBtns{position:absolute;display:flex;gap:6px;pointer-events:auto}#rigHud button{font:600 11px/1 var(--f-mono,monospace);letter-spacing:.08em;padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.2);background:rgba(14,16,22,.78);color:#f4efe6;cursor:pointer}#rigHud .rigAct{color:#ff8a80}#rigHud.rec .frame,#rigHud.rec .rigBtns,#rigHud.rec .lab{display:none}';
  document.head.appendChild(css);
  const labs = [], frames = [];
  for (let i = 0; i < 3; i++) { const f = document.createElement('div'); f.className = 'frame'; hud.appendChild(f); frames.push(f); const l = document.createElement('div'); l.className = 'lab'; hud.appendChild(l); labs.push(l); }
  hud.querySelector('.rigAct').onclick = () => { if (!rig.rec) startRec(); };
  hud.querySelector('.rigOff').onclick = () => { takeDown(); toast(T('机位撤掉了', 'Cameras taken down')); };
  function paintHud() {
    hud.classList.toggle('on', rig.on); hud.classList.toggle('rec', !!rig.rec); if (!rig.on) return;
    for (let i = 0; i < 3; i++) { frames[i].style.display = labs[i].style.display = i < rig.cams.length ? '' : 'none'; }
    rig.cams.forEach((c, i) => { const r = monRect(i); Object.assign(frames[i].style, { left: r.x - 1 + 'px', top: r.y - 1 + 'px', width: r.w + 'px', height: r.h + 'px' }); Object.assign(labs[i].style, { left: r.x + 'px', top: r.y - 14 + 'px' }); labs[i].innerHTML = '<b>' + c.A.key + '</b>' + T(c.A.zh, c.A.en); });
    const r = monRect(Math.max(0, rig.cams.length - 1)), b = hud.querySelector('.rigBtns'); b.style.left = r.x + 'px'; b.style.top = r.y + r.h + 8 + 'px';
    hud.querySelector('.rigOff').title = T('撤掉机位', 'Take the cameras down');
  }
  window.addEventListener('resize', paintHud);
  function drawMonitors() {
    const c = renderer.domElement, pr = c.width / Math.max(1, c.clientWidth || window.innerWidth), H = c.height, k = rig.k++ % rig.cams.length; // one monitor refreshed per frame, in turn
    { const U = YX.wetUni, wr = U ? U.uWetR.value : 0, rt0 = renderer.getRenderTarget(); if (U) U.uWetR.value = 0; for (const cc of rig.fresh ? rig.cams : [rig.cams[k]]) if (cc) { renderer.setRenderTarget(cc.rt); renderer.render(scene, cc.cam); } rig.fresh = false; renderer.setRenderTarget(rt0); if (U) U.uWetR.value = wr; } // the first time, all three: no monitor starts out black // the mirror picture of wet roads belongs to the player's camera, not this one
    ortho.left = 0; ortho.right = c.width; ortho.top = H; ortho.bottom = 0; ortho.updateProjectionMatrix();
    rig.cams.forEach((cm, i) => { const r = monRect(i), q = quads[i]; q.visible = true; q.material.map = cm.rt.texture; q.material.needsUpdate = q.material.map !== q.userData.map; q.userData.map = cm.rt.texture; q.scale.set(r.w * pr, r.h * pr, 1); q.position.set((r.x + r.w / 2) * pr, H - (r.y + r.h / 2) * pr, 0); });
    for (let i = rig.cams.length; i < 3; i++) quads[i].visible = false;
    const ac = renderer.autoClear; renderer.autoClear = false; renderer.clearDepth(); renderer.render(wall, ortho); renderer.autoClear = ac;
  }

  /* ---------- action: all three at once ---------- */
  const toast = (m) => { try { YX.ui.toast(m); } catch (e) {} };
  const pickMime = () => ['video/mp4;codecs=avc1.640033', 'video/mp4;codecs=avc1.640028', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } });
  function startRec() {
    if (!rig.on || rig.rec || (YX.filmBusy && YX.filmBusy())) return false;
    const c = renderer.domElement; rig.rec = { t0: performance.now(), chunks: [], mr: null, scene: YX.sceneText ? YX.sceneText() : '', names: rig.cams.map((c) => c.A), moving: !!rig.moving, free: rig.cams.some((c) => c.A.free) };
    YX.filmFrame([TILE[0] * rig.cams.length, TILE[1]]); document.body.classList.add('cinema', 'multicam'); paintHud(); aim();
    const cine = $('cine'); if (cine) cine.classList.add('rec');
    if (c.captureStream && typeof MediaRecorder !== 'undefined') {
      requestAnimationFrame(() => requestAnimationFrame(() => { if (!rig.rec) return; const mime = pickMime(); try { const mr = new MediaRecorder(c.captureStream(30), mime ? { mimeType: mime, videoBitsPerSecond: 30e6 } : undefined); rig.rec.mr = mr; rig.rec.type = (mr.mimeType || mime || 'video/webm').split(';')[0]; mr.ondataavailable = (e) => { if (e.data && e.data.size && rig.rec) rig.rec.chunks.push(e.data); }; const R = rig.rec; mr.onstop = () => finish(R); mr.start(250); } catch (e) { console.warn(e); } }));
    }
    return true;
  }
  function stopRec() {
    const R = rig.rec; if (!R) return; rig.rec = null; R.secs = (performance.now() - R.t0) / 1000;
    if (R.mr) { try { R.mr.stop(); } catch (e) { finish(R); } } else finish(R);
    document.body.classList.remove('cinema', 'multicam'); YX.filmFrame(null); /* the letterbox goes first, so the canvas is measured at its own size again */ const cine = $('cine'); if (cine) { cine.classList.remove('rec'); cine.textContent = ''; } rig.fresh = true; paintHud(); aim(); // back to standing by: the monitors show now, not what they showed before the take
  }
  function finish(R) {
    if (R.done) return; R.done = true; const blob = R.chunks.length ? new Blob(R.chunks, { type: R.type || 'video/webm' }) : null;
    const d = new Date(), p2 = (v) => String(v).padStart(2, '0'), stem = 'spoken-world-multicam-' + p2(d.getHours()) + p2(d.getMinutes()) + p2(d.getSeconds());
    const N = R.names || ANGLES, n = N.length, note = n === 1 ? T('一个定机位：' + N[0].zh + '。', 'One standing camera: ' + N[0].en.toLowerCase() + '.') : T(n + ' 个机位同一时刻，从左到右：' + N.map((a) => a.key + ' ' + a.zh).join('，') + (R.moving ? '（机位跟着它一起走）' : '') + '。每格 1280x720。', n + ' cameras, one moment, left to right: ' + N.map((a) => a.key + ' ' + a.en.toLowerCase()).join(', ') + (R.moving ? ' (the cameras travel with it)' : '') + '. Each picture is 1280x720.');
    if (blob && YX.filmTake) YX.filmTake(blob, R.type, R.secs, note + '\n\n' + R.scene, stem, { tiles: n, scene: R.scene, angles: N.map((a) => [a.key, T(a.zh, a.en.toLowerCase())]) });
    else if (!blob) toast(T('三机位片子没录到画面', 'Nothing was recorded'));
  }
  // the frame: while filming, the three pictures side by side and nothing else; while standing by, the player's view with the monitors on top
  YX.rigFrame = function (r, sc) {
    if (!rig.on) return false; aim();
    if (!rig.rec) return false;
    const cine = $('cine'); if (cine) cine.textContent = 'REC ×' + rig.cams.length + ' ' + ((performance.now() - rig.rec.t0) / 1000).toFixed(1) + 's / ' + LIMIT + 's' + T(' · 说“咔”结束', ' · say “cut” to finish');
    r.setScissorTest(true);
    rig.cams.forEach((c, i) => { r.setViewport(i * TILE[0], 0, TILE[0], TILE[1]); r.setScissor(i * TILE[0], 0, TILE[0], TILE[1]); if (!(YX.post && YX.post.render(r, sc, c.cam, { w: TILE[0], h: TILE[1] }))) r.render(sc, c.cam); }); // each third gets the same light and grade as the player's own picture
    r.setScissorTest(false); r.setViewport(0, 0, TILE[0] * rig.cams.length, TILE[1]);
    if ((performance.now() - rig.rec.t0) / 1000 >= LIMIT) stopRec();
    return true;
  };
  YX.rigAfter = function () { if (rig.on && !rig.rec) drawMonitors(); };

  /* ---------- what can be said ---------- */
  YX.OPS.rig = function (op, ctx) {
    if (op.off) { if (!rig.on) return { ok: false, msg: T('现在没有架机位', 'There are no cameras set up') }; takeDown(); return { ok: true, msg: T('机位撤掉了', 'Cameras taken down') }; }
    if (op.here) return putHere(op.key, op.follow != null ? ctx.one(op.follow) : null);
    if (op.drop != null) return removeCam(op.drop);
    if (op.action) { if (!rig.on) return { ok: false, msg: T('先架机位：说“用三个机位拍这个”，或者走到位置说“在这里放一个机位”', 'Set up the cameras first: say “film this with three cameras”, or stand where you want one and say “put a camera here”') }; const n = rig.cams.length; return startRec() ? { ok: true, msg: T(n + ' 个机位一起拍，最长 ' + LIMIT + ' 秒。说“咔”结束', 'Rolling on ' + (n === 1 ? 'the camera' : 'all ' + n + ' cameras') + ', up to ' + LIMIT + ' s. Say “cut” to finish') } : { ok: false, msg: T('现在没法开拍', 'Cannot roll right now') }; }
    if (op.cut) { if (!rig.rec) return { ok: false, msg: T('现在没有在拍', 'Not rolling') }; const n = rig.cams.length; stopRec(); return { ok: true, msg: T('咔。' + (n > 1 ? n + ' 个角度存成一个片子' : '片子存好了'), 'Cut. ' + (n > 1 ? 'All ' + n + ' angles saved in one clip' : 'Clip saved')) }; }
    const v = ctx.view, t = op.target != null ? ctx.one(op.target) : v.aimId != null ? W.objs.get(v.aimId) : null;
    rig.target = t && !t.dead && !(YX.defOf(t) || {}).flat ? t.id : null; rig.point = rig.target == null ? (v.aimPoint || [v.x + v.fx * 10, v.z + v.fz * 10]).slice() : null;
    build(v, op.angles, op.cams); const what = rig.target != null ? YX.labelOf(YX.defOf(W.objs.get(rig.target))) + ' #' + rig.target : T('准星这里', 'the crosshair spot');
    const nm = (z) => rig.cams.map((c) => c.A.key + ' ' + (z ? c.A.zh : c.A.en.toLowerCase())).join(z ? '、' : ', '); const n = rig.cams.length; return { ok: true, msg: T((n === 3 ? '三' : n === 2 ? '两' : '一') + '个机位对准 ' + what + (rig.moving ? '，跟着它走' : '') + '：' + nm(true) + '。说“开拍”' + (n > 1 ? '一起拍' : '就拍'), (n === 3 ? 'Three cameras' : n === 2 ? 'Two cameras' : 'One camera') + ' on ' + what + (rig.moving ? ', travelling with it' : '') + ': ' + nm(false) + '. Say “action” to film ' + (n === 3 ? 'all three at once' : n === 2 ? 'both at once' : 'it')) };
  };
  // "action" and "cut" mean the three cameras when they stand
  const cam0 = YX.camOp; YX.camOp = function (op, ctx) {
    if (rig.on && op.rec && op.live && !op.move && !op.design) return YX.OPS.rig({ action: true }, ctx);
    if (rig.rec && op.stop) return YX.OPS.rig({ cut: true }, ctx);
    return cam0 ? cam0(op, ctx) : { ok: false, msg: '' };
  };
  YX.rigStart = startRec; YX.rigStop = stopRec; YX.rigDown = takeDown;
})();
