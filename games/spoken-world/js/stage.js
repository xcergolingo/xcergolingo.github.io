/* 言出法随 · stage: cinematic camera moves, shots (机位), handheld takes, and the starting town */
'use strict';
(function () {
  const YX = window.YX, W = YX.world, DEG = YX.DEG, clamp = YX.clamp, lerp = YX.lerp, cine = YX.cine;
  const num = (v, d) => { v = +v; return isFinite(v) ? v : d; };
  const poseNow = () => { const P = W.player; return { x: P.x, y: P.y, z: P.z, yaw: P.yaw, pitch: P.pitch }; };
  function setPose(p) { const P = W.player, c = YX.three.camera; P.x = p.x; P.y = Math.max(0.4, p.y); P.z = p.z; P.yaw = p.yaw; P.pitch = clamp(p.pitch, -1.5, 1.5); P.vx = P.vz = 0; c.position.set(P.x, P.y, P.z); c.rotation.set(P.pitch, P.yaw, 0); }
  const lookAt = (f, tx, ty, tz) => { const dx = tx - f.x, dy = ty - f.y, dz = tz - f.z; return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) }; };
  const angLerp = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * k; };
  YX.setPose = setPose; YX.poseNow = poseNow;

  YX.cineStart = function (spec) { cine.active = Object.assign({ t: 0, dur: 2, from: poseNow() }, spec); };
  function cineEnd(finished) { const a = cine.active; cine.active = null; const P = W.player; P.fly = P.y > 1.95; if (a && a.onDone) a.onDone(finished); }
  YX.cineStop = function () { if (cine.active) cineEnd(false); };
  YX.updateCine = function (dt) {
    const a = cine.active; if (!a) return;
    a.t += dt; const k0 = clamp(a.t / a.dur, 0, 1), k = (a.ease || YX.ease.inOut)(k0), f = a.from; let p = { x: f.x, y: f.y, z: f.z, yaw: f.yaw, pitch: f.pitch };
    if (a.type === 'pose') { const t = a.to; p = { x: lerp(f.x, t.x, k), y: lerp(f.y, t.y, k), z: lerp(f.z, t.z, k), yaw: angLerp(f.yaw, t.yaw, k), pitch: lerp(f.pitch, t.pitch, k) }; }
    else if (a.type === 'dolly') { p.x = f.x + a.dx * k; p.y = Math.max(0.5, f.y + a.dy * k); p.z = f.z + a.dz * k; if (a.look) { const l = lookAt(p, a.look[0], a.look[1], a.look[2]); p.yaw = angLerp(f.yaw, l.yaw, Math.min(1, k * 3)); p.pitch = lerp(f.pitch, l.pitch, Math.min(1, k * 3)); } }
    else if (a.type === 'pan') { p.yaw = f.yaw + a.dyaw * k; p.pitch = f.pitch + a.dpitch * k; }
    else if (a.type === 'orbit') { const ang = a.a0 + a.sweep * k; p.x = a.cx + Math.cos(ang) * a.R; p.z = a.cz + Math.sin(ang) * a.R; p.y = f.y + (a.dy || 0) * k; const l = lookAt(p, a.cx, a.cy, a.cz); p.yaw = angLerp(f.yaw, l.yaw, Math.min(1, k0 * 6)); p.pitch = lerp(f.pitch, l.pitch, Math.min(1, k0 * 6)); }
    else if (a.type === 'follow') { const o = a.target; if (!o || o.dead) return cineEnd(false); const hx = Math.sin(o.rot), hz = Math.cos(o.rot), d = a.dist, wx = o.x - hx * d, wz = o.z - hz * d, wy = o.y + a.h, s = 1 - Math.exp(-4 * dt), P = W.player; p.x = lerp(P.x, wx, s); p.y = lerp(P.y, wy, s); p.z = lerp(P.z, wz, s); const l = lookAt(p, o.x, o.y + o.size[1] * 0.6, o.z); p.yaw = angLerp(P.yaw, l.yaw, 1 - Math.exp(-8 * dt)); p.pitch = lerp(P.pitch, l.pitch, 1 - Math.exp(-8 * dt)); }
    else if (a.type === 'fn') p = a.fn(a.t); // a pose worked out from the time alone
    else if (a.type === 'take') { const S = a.samples, t = a.t; let i = a.i || 0; while (i < S.length - 2 && S[i + 1].t < t) i++; a.i = i; const s0 = S[i], s1 = S[Math.min(S.length - 1, i + 1)], u = clamp((t - s0.t) / Math.max(0.0001, s1.t - s0.t), 0, 1); p = { x: lerp(s0.x, s1.x, u), y: lerp(s0.y, s1.y, u), z: lerp(s0.z, s1.z, u), yaw: angLerp(s0.yaw, s1.yaw, u), pitch: lerp(s0.pitch, s1.pitch, u) }; }
    setPose(p);
    if (k0 >= 1) cineEnd(true);
  };
  const T = YX.T, MOVE_Z = { push: '推近', pull: '拉远', pan: '摇镜', tilt: '俯仰', truck: '横移', crane: '升降', orbit: '环绕', arc: '环绕', follow: '跟拍', overview: '鸟瞰', reset: '回到地面', street: '沿街平推', reveal: '拉升揭示', flyover: '飞越' }, MOVE_E = { push: 'Push in', pull: 'Pull out', pan: 'Pan', tilt: 'Tilt', truck: 'Truck', crane: 'Crane', orbit: 'Orbit', arc: 'Arc', follow: 'Follow', overview: "Bird's-eye view", reset: 'Back to ground', street: 'Street track', reveal: 'Reveal', flyover: 'Flyover' }, moveN = (m) => T(MOVE_Z[m] || m, MOVE_E[m] || m);
  YX.startMove = function (m, tg, op, onDone) {
    op = op || {}; const f = poseNow(), cp = Math.cos(f.pitch), fw = [-Math.sin(f.yaw) * cp, Math.sin(f.pitch), -Math.cos(f.yaw) * cp], rt = [Math.cos(f.yaw), 0, -Math.sin(f.yaw)];
    const tc = tg ? [tg.x, tg.y + tg.size[1] * 0.55, tg.z] : null, dist = tc ? Math.hypot(tc[0] - f.x, tc[1] - f.y, tc[2] - f.z) : 12;
    if (m === 'push' || m === 'pull' || m === 'dolly' || m === 'zoom') { let am = op.amount != null ? num(op.amount, 6) : m === 'pull' ? 8 : tc ? Math.max(1.5, dist - (Math.max(tg.foot[0], tg.foot[1]) / 2 + Math.max(2.5, tg.size[1] * 0.9))) : 6; if (m === 'pull') am = -Math.abs(am); YX.cineStart({ type: 'dolly', dur: clamp(num(op.dur, 3.5), 0.3, 60), dx: fw[0] * am, dy: fw[1] * am, dz: fw[2] * am, look: tc, onDone }); }
    else if (m === 'truck' || m === 'slide') { const am = num(op.amount, 6); YX.cineStart({ type: 'dolly', dur: clamp(num(op.dur, 3.5), 0.3, 60), dx: rt[0] * am, dy: 0, dz: rt[2] * am, look: tc, onDone }); }
    else if (m === 'crane' || m === 'rise') { const am = num(op.amount, 7); YX.cineStart({ type: 'dolly', dur: clamp(num(op.dur, 4), 0.3, 60), dx: 0, dy: am, dz: 0, look: tc, onDone }); }
    else if (m === 'pan') YX.cineStart({ type: 'pan', dur: clamp(num(op.dur, 3.5), 0.3, 60), dyaw: -num(op.deg, 45) * DEG, dpitch: 0, onDone });
    else if (m === 'tilt') YX.cineStart({ type: 'pan', dur: clamp(num(op.dur, 3), 0.3, 60), dyaw: 0, dpitch: num(op.deg, 15) * DEG, onDone });
    else if (m === 'orbit' || m === 'arc') { const c = tc || [f.x + fw[0] * 12, Math.max(1, f.y + fw[1] * 12), f.z + fw[2] * 12]; let R = Math.hypot(f.x - c[0], f.z - c[2]); const minR = tg ? Math.max(tg.foot[0], tg.foot[1]) * 0.7 + 3 : 3; let a0 = Math.atan2(f.z - c[2], f.x - c[0]); const sweep = num(op.deg, m === 'arc' ? 90 : 360) * DEG; if (R < minR) { cine.active = null; setPose(Object.assign({}, f, { x: c[0] + Math.cos(a0) * minR, z: c[2] + Math.sin(a0) * minR })); R = minR; }
      YX.cineStart({ type: 'orbit', dur: clamp(num(op.dur, Math.abs(sweep) > 4 ? 12 : 6), 0.5, 90), cx: c[0], cy: c[1], cz: c[2], R, a0, sweep, dy: num(op.amount, 0), ease: Math.abs(sweep) > 4 ? YX.ease.lin : YX.ease.inOut, onDone }); }
    else if (m === 'follow' || m === 'track') { if (!tg) return false; YX.cineStart({ type: 'follow', dur: clamp(num(op.dur, 10), 1, 120), target: tg, dist: Math.max(4, Math.max(tg.foot[0], tg.foot[1]) * 1.6 + 2.5), h: Math.max(1.6, tg.size[1] * 0.9 + 0.8), ease: YX.ease.lin, onDone }); }
    else if (m === 'overview' || m === 'top') YX.cineStart({ type: 'pose', dur: clamp(num(op.dur, 1.6), 0.3, 20), to: { x: f.x - fw[0] * 20, y: num(op.amount, 75), z: f.z - fw[2] * 20, yaw: f.yaw, pitch: -1.15 }, onDone });
    else if (m === 'reset' || m === 'ground') YX.cineStart({ type: 'pose', dur: 1.2, to: { x: f.x, y: 1.7, z: f.z, yaw: f.yaw, pitch: 0 }, onDone });
    else if (m === 'street' || m === 'travel' || m === 'along') { // glide along the nearest road in the direction the camera faces, or straight ahead when there is no road
      const hl = Math.hypot(fw[0], fw[2]) || 1; let ax = fw[0] / hl, az = fw[2] / hl, best = 26;
      for (const r of W.objs.values()) { if (r.type !== 'road' || r.dead) continue; const c = Math.cos(r.rot), s = Math.sin(r.rot), lon = r.foot[0] >= r.foot[1], ux = lon ? c : s, uz = lon ? -s : c, dx = f.x - r.x, dz = f.z - r.z, off = Math.abs(dx * -uz + dz * ux); if (Math.abs(dx * ux + dz * uz) < Math.max(r.foot[0], r.foot[1]) / 2 + 4 && off < best) { best = off; const sg = ux * fw[0] + uz * fw[2] >= 0 ? 1 : -1; ax = ux * sg; az = uz * sg; } }
      const dur = clamp(num(op.dur, 8), 0.5, 60), am = num(op.amount, dur * 2.6);
      YX.cineStart({ type: 'dolly', dur, dx: ax * am, dy: num(op.rise, 0), dz: az * am, look: [f.x + ax * 400, f.y - 6, f.z + az * 400], ease: YX.ease.lin, onDone }); }
    else if (m === 'reveal') { const hl = Math.hypot(fw[0], fw[2]) || 1, am = num(op.amount, 14); YX.cineStart({ type: 'dolly', dur: clamp(num(op.dur, 8), 0.5, 60), dx: (-fw[0] / hl) * am, dy: num(op.rise, 9), dz: (-fw[2] / hl) * am, look: tc || [f.x + fw[0] * 30, Math.max(1, f.y + fw[1] * 30), f.z + fw[2] * 30], onDone }); }
    else if (m === 'flyover' || m === 'drone' || m === 'aerial') { const hl = Math.hypot(fw[0], fw[2]) || 1, am = num(op.amount, 55); YX.cineStart({ type: 'pose', dur: clamp(num(op.dur, 8), 0.5, 60), to: { x: f.x + (fw[0] / hl) * am, y: Math.max(f.y, 2) + num(op.rise, 22), z: f.z + (fw[2] / hl) * am, yaw: f.yaw, pitch: -0.55 }, ease: YX.ease.lin, onDone }); }
    else return false;
    return true;
  };
  YX.camOp = function (op, ctx) {
    const P = W.player, msg = [];
    if (op.lens != null) { const l = op.lens === 0 || /^(free|reset|none|自由)$/i.test(String(op.lens)) ? 0 : clamp(num(parseFloat(op.lens), 35), 8, 600); P.lens = l; msg.push(l ? T(l + 'mm 镜头', l + 'mm lens') : T('自由视角', 'Free view')); }
    if (op.letterbox != null && YX.hooks.letterbox) { YX.hooks.letterbox(!!op.letterbox); msg.push(op.letterbox ? T('电影画幅', 'Cinema frame') : T('全屏画幅', 'Full frame')); }
    if (op.stop) { if (YX.filmLive && YX.filmLive()) { YX.filmStop(); return { ok: true, msg: T('停止录制', 'Recording stopped') }; } if (YX.cine.active) { YX.cineStop(); return { ok: true, msg: T('镜头停下了', 'Camera stopped') }; } return { ok: false, msg: T('现在没有在录制', 'Nothing is being recorded') }; }
    const D = YX.director, mv = op.move ? String(op.move).toLowerCase() : null;
    if (op.revise != null && D) { const r = D.revise({ text: String(op.revise), rec: !!op.rec }); if (YX.hooks.ui) YX.hooks.ui(); return r; } // a note on the shot just made changes that shot
    if (D && !YX.playing && ((mv && D.can(mv)) || (!mv && op.design))) { // a move with a path: designed for this place (by the model when it is there), checked against what stands around, then flown
      const tg = op.target != null ? ctx.one(op.target) : W.objs.get(ctx.view.aimId) || null, r = D.go({ text: op.design || '', move: mv, target: tg, rec: !!op.rec, dur: op.dur, deg: op.deg, amount: op.amount, rise: op.rise, instant: !!op.instant });
      if (msg.length) r.msg = msg.join(T('，', ', ')) + T('，', ', ') + r.msg; if (YX.hooks.ui) YX.hooks.ui(); return r; }
    if (op.move) { const m = String(op.move).toLowerCase(), tg = op.target != null ? ctx.one(op.target) : W.objs.get(ctx.view.aimId) || null; const keep = !['reset', 'ground', 'overview', 'top'].includes(m) && !YX.playing, rec = !!op.rec && !!YX.filmMove && keep, o2 = Object.assign({}, op);
      if (rec) { o2.dur = clamp(num(o2.dur, 8), 2, 10); if (m === 'orbit' && o2.deg == null) o2.deg = 150; } else if (m === 'orbit' && o2.deg == null && o2.dur == null) { o2.deg = 150; o2.dur = 8; }
      // every spoken move is kept as a shot: it can be replayed, adjusted and recorded from the Film panel
      const sh = keep ? YX.saveShot(moveN(m) + (tg ? ' · ' + (tg.name || YX.labelOf(YX.defOf(tg))) : ''), { type: m, target: tg ? tg.id : null, dur: o2.dur, amount: o2.amount, deg: o2.deg, rise: o2.rise }) : null;
      if (rec ? YX.filmMove(m, tg, o2) : YX.startMove(m, tg, o2)) { if (sh && sh.move && sh.move.dur == null && YX.cine.active && YX.cine.active.dur > 0) sh.move.dur = Math.round(YX.cine.active.dur * 10) / 10; msg.push(moveN(m) + (tg && ['orbit', 'follow', 'push', 'arc', 'reveal'].includes(m) ? ' ' + YX.lab(tg) : '') + (rec ? T('，正在录制', ', recording') : sh ? T('（已存为镜头 ' + W.shots.length + '：说“录下来”拍成片子，按 C 可以重看）', ' (kept as shot ' + W.shots.length + ': say “record it” to film it, press C to see it again)') : '')); }
      else { if (sh) { W.shots.pop(); if (YX.hooks.ui) YX.hooks.ui(); } return { ok: false, msg: m === 'follow' ? T('没找到要跟拍的对象', 'Nothing there to follow') : T('不认识的运镜 ', 'Unknown camera move ') + m }; }
      if (m === 'reset') P.lens = 0; }
    else if (op.rec) { // "record it": the move that was just made, flown again and filmed; with no recent move, simply what the player sees from now on
      const li = YX.lastMoveShot(), recent = !op.live && li >= 0 && YX.lastMoveAt && performance.now() - YX.lastMoveAt < 120000;
      if (recent && YX.filmShot && YX.filmShot(li)) msg.push(T('把刚才的镜头“' + W.shots[li].name + '”重走一遍并录下来', 'Flying “' + W.shots[li].name + '” again and recording it'));
      else if (YX.filmLiveStart && YX.filmLiveStart()) msg.push(T('开始录制你看到的画面，最长 10 秒。说“停”或按 R 结束', 'Recording what you see, up to 10 s. Say “stop” or press R to finish'));
      else return { ok: false, msg: T('现在没法开始录制', 'Recording cannot start right now') }; }
    if (YX.hooks.ui) YX.hooks.ui();
    return { ok: true, msg: msg.join(T('，', ', ')) || T('镜头已调整', 'Camera adjusted') };
  };

  /* ---------- shots ---------- */
  function autoName() {
    const P = W.player, o = W.aim, cam = YX.three.camera;
    let size = T('空镜', 'Empty frame');
    if (o) { const d = Math.hypot(o.x - P.x, o.y + o.size[1] / 2 - P.y, o.z - P.z), fr = o.size[1] / (2 * d * Math.tan((cam.fov * DEG) / 2)); size = fr > 1.3 ? T('特写', 'Close-up') : fr > 0.65 ? T('近景', 'Medium close') : fr > 0.3 ? T('中景', 'Medium') : fr > 0.12 ? T('全景', 'Full') : T('远景', 'Wide'); }
    const ang = P.pitch < -0.4 ? T('俯拍', 'High angle') : P.pitch > 0.28 ? T('仰拍', 'Low angle') : P.y > 9 ? T('高机位', 'High camera') : P.y < 1 ? T('低机位', 'Low camera') : '';
    return (ang ? ang + ' ' : '') + size + (o ? ' · ' + (o.name || YX.labelOf(YX.defOf(o))) : '');
  }
  const thumb = (s) => { YX.afterRender = (cv) => {try { const c = document.createElement('canvas'); c.width = 176; c.height = 99; const g = c.getContext('2d'), k = Math.max(176 / cv.width, 99 / cv.height), w = cv.width * k, h = cv.height * k; g.drawImage(cv, (176 - w) / 2, (99 - h) / 2, w, h); s.th = c.toDataURL('image/jpeg', 0.55); if (YX.hooks.ui) YX.hooks.ui(); } catch (e) {} }; }; // a picture of its first frame, for the Film panel
  YX.reShot = (s) => { thumb(s); if (YX.hooks.ui) YX.hooks.ui(); };
  YX.saveShot = function (name, move, take) {
    const P = W.player, s = { name: String(name || autoName()).slice(0, 28), x: +P.x.toFixed(2), y: +P.y.toFixed(2), z: +P.z.toFixed(2), yaw: +P.yaw.toFixed(4), pitch: +P.pitch.toFixed(4), lens: P.lens || 0 };
    if (move && move.type) s.move = move; if (take) s.take = take;
    thumb(s);
    if (W.shots.length >= 24) W.shots.shift();
    W.shots.push(s); YX.markDirty(); if (YX.hooks.ui) YX.hooks.ui(); YX.sfx('shot');
    return s;
  };
  YX.goShot = function (i, instant) { const s = W.shots[i]; if (!s) return false; W.player.lens = s.lens || 0; if (instant) { YX.cineStop(); setPose(s); YX.snapFov(); W.player.fly = s.y > 1.95; } else YX.cineStart({ type: 'pose', dur: 0.9, to: s }); if (YX.hooks.ui) YX.hooks.ui(); return true; };
  /* replay one shot from its own start: the move or path it holds, or just its framing */
  YX.playShot = function (i, onDone) {
    const s = W.shots[i]; if (!s || YX.playing) return false; YX.cineStop(); W.player.lens = s.lens || 0; setPose(s); YX.snapFov(); W.player.fly = s.y > 1.95; YX.lastMoveAt = performance.now();
    if (s.take && s.take.length > 1) YX.cineStart({ type: 'take', samples: s.take, dur: s.take[s.take.length - 1].t, ease: YX.ease.lin, onDone });
    else if (s.move && YX.startMove(s.move.type, s.move.target != null ? W.objs.get(s.move.target) || null : null, s.move, onDone)) { /* running */ }
    else if (onDone) YX.cineStart({ type: 'hold', dur: 2.4, onDone });
    if (YX.hooks.ui) YX.hooks.ui(); return true;
  };
  YX.lastMoveShot = () => { for (let i = W.shots.length - 1; i >= 0; i--) if (W.shots[i].move || (W.shots[i].take && W.shots[i].take.length > 1)) return i; return -1; };
  YX.shotDur = (s) => (s.take && s.take.length > 1 ? s.take[s.take.length - 1].t : s.move ? num(s.move.dur, s.move.type === 'orbit' ? 12 : 3.5) : 2.4);
  YX.playing = false;
  YX.playShots = function (opt) {
    opt = opt || {}; const list = W.shots.slice(); if (!list.length || YX.playing) return false;
    YX.cineStop(); const back = poseNow(), backLens = W.player.lens, backFly = W.player.fly; let i = -1; YX.playing = true;
    if (YX.hooks.cinema) YX.hooks.cinema(true);
    const end = () => { YX.playing = false; cine.active = null; W.player.lens = backLens; setPose(back); W.player.fly = backFly; YX.snapFov(); if (YX.hooks.cinema) YX.hooks.cinema(false); if (opt.onDone) opt.onDone(); };
    const next = (ok) => {
      if (ok === false) return end(); i++; if (i >= list.length) return end();
      const s = list[i]; W.player.lens = s.lens || 0; setPose(s); YX.snapFov(); if (YX.hooks.shotStep) YX.hooks.shotStep(i, s, list.length);
      if (s.take && s.take.length > 1) YX.cineStart({ type: 'take', samples: s.take, dur: s.take[s.take.length - 1].t, ease: YX.ease.lin, onDone: next });
      else if (s.move && YX.startMove(s.move.type, s.move.target != null ? W.objs.get(s.move.target) || null : null, s.move, next)) { /* running */ }
      else YX.cineStart({ type: 'hold', dur: 2.4, onDone: next });
    };
    next(true); return true;
  };
  YX.stopPlay = function () { if (YX.playing) YX.cineStop(); };
  let rec = null;
  YX.recording = () => !!rec;
  YX.recToggle = function () {
    if (rec) { const r = rec; rec = null; if (r.samples.length > 4) { const P0 = r.samples[0]; const keep = poseNow(); const s = YX.saveShot(T('手持 · ', 'Handheld · ') + Math.round(r.samples[r.samples.length - 1].t) + T(' 秒', 's'), null, r.samples); s.x = P0.x; s.y = P0.y; s.z = P0.z; s.yaw = P0.yaw; s.pitch = P0.pitch; setPose(keep); } if (YX.hooks.ui) YX.hooks.ui(); return false; }
    rec = { t: 0, last: -1, samples: [] }; if (YX.hooks.ui) YX.hooks.ui(); return true;
  };
  YX.onFrame = function (dt) { if (!rec) return; rec.t += dt; if (rec.t - rec.last >= 0.066) { rec.last = rec.t; const P = W.player; rec.samples.push({ t: +rec.t.toFixed(3), x: +P.x.toFixed(3), y: +P.y.toFixed(3), z: +P.z.toFixed(3), yaw: +P.yaw.toFixed(4), pitch: +P.pitch.toFixed(4) }); if (rec.t > 60) YX.recToggle(); } };
  YX.shotOp = function (op, ctx) {
    if (op.save) { const tg = op.target != null ? ctx.one(op.target) : W.objs.get(ctx.view.aimId) || null; const s = YX.saveShot(op.name, op.move ? { type: String(op.move).toLowerCase(), target: tg ? tg.id : null, dur: op.dur, amount: op.amount, deg: op.deg } : null); return { ok: true, msg: T('机位 ', 'Shot ') + W.shots.length + ' · ' + s.name }; }
    if (op.go != null) { const i = clamp(Math.round(num(op.go, 1)), 1, Math.max(1, W.shots.length)) - 1; if (!W.shots[i]) return { ok: false, msg: T('还没有保存机位', 'No shots saved yet') }; YX.goShot(i); return { ok: true, msg: T('切到机位 ', 'Shot ') + (i + 1) + ' · ' + W.shots[i].name }; }
    if (op.play) { if (!W.shots.length) return { ok: false, msg: T('还没有保存机位，先说“保存机位”', 'No shots yet. Say “save shot” first') }; YX.playShots({}); return { ok: true, msg: T('预演 ' + W.shots.length + ' 个机位', 'Previewing ' + W.shots.length + ' shots') }; }
    if (op.delete != null) { const i = Math.round(num(op.delete, W.shots.length)) - 1; if (W.shots[i]) { W.shots.splice(i, 1); YX.markDirty(); if (YX.hooks.ui) YX.hooks.ui(); return { ok: true, msg: T('删除机位 ', 'Deleted shot ') + (i + 1) }; } return { ok: false, msg: T('没有这个机位', 'No such shot') }; }
    if (op.clear) { W.shots = []; YX.markDirty(); if (YX.hooks.ui) YX.hooks.ui(); return { ok: true, msg: T('机位已清空', 'Shots cleared') }; }
    if (op.record != null) { // record: true toggles; 'start' and 'stop' only ever do what they say
      if (op.record === 'stop' && !rec) { if (YX.filmLive && YX.filmLive()) { YX.filmStop(); return { ok: true, msg: T('停止录制', 'Recording stopped') }; } return { ok: false, msg: T('现在没有在录制', 'Nothing is being recorded') }; }
      if (op.record === 'start' && rec) return { ok: false, msg: T('已经在录了', 'Already recording') };
      const on = YX.recToggle(); return { ok: true, msg: on ? T('开始录制手持镜头', 'Recording a handheld take') : T('手持镜头已保存', 'Handheld take saved') }; }
    return { ok: false, msg: '' };
  };

  /* ---------- the starting town ---------- */
  YX.buildTown = function () {
    YX.clearWorld(); W.nextId = 1; W.shots = []; W.focusId = null;
    const R = YX.rng(20261111), rr = (a, b) => a + R() * (b - a), pk = (arr) => arr[Math.floor(R() * arr.length)];
    const add = (type, x, z, deg, params, extra) => YX.spawn(Object.assign({ type, x, z, rot: (deg || 0) * DEG, params: params || {}, seed: Math.floor(R() * 4e9) + 1 }, extra || {}));
    add('road', 0, 0, 0, { length: 300, width: 9 });
    add('road', 0, 0, 90, { length: 240, width: 8 });
    const S = 180, N = 0, Wd = 90, Ed = 270; // facing directions
    // south side of Main St (the side you look at first)
    add('house', 20, 12.6, S, { floors: 2, width: 9.5, depth: 8, roof: 'gable', wall: '#efe3cf', roofColor: '#b5533c', door: '#2f5d62', chimney: true });
    add('shop', 54, 12.6, S, { name: 'BAKERY', width: 9, depth: 8, floors: 2, awning: '#d9a441', wall: '#e7d2bd' });
    add('house', 71, 13, S, { floors: 1, width: 10, depth: 9, roof: 'hip', wall: '#d9e2dc', roofColor: '#566573', door: '#8c3b2e' });
    add('tower', 90, 14.6, S, { floors: 5, width: 13, depth: 12, style: 'brick', color: '#b9765a' });
    add('house', 109, 12.6, S, { floors: 2, width: 9, depth: 8, roof: 'gable', wall: '#cfdbe6', roofColor: '#3f5a66' });
    add('shop', 126, 12.6, S, { name: 'RECORDS', width: 8.5, floors: 2 });
    add('shop', -13.5, 12.6, S, { name: 'BOOKS', width: 9, depth: 8, floors: 2, awning: '#2f6f73', wall: '#e9e1d3' });
    add('house', -30, 12.6, S, { floors: 2, width: 9, depth: 8, roof: 'gable', wall: '#f2d9c4', roofColor: '#3f5a66', door: '#34495e' });
    add('house', -47, 13, S, { floors: 1, width: 10, depth: 9, roof: 'gable', wall: '#dfe6cf', roofColor: '#7a5c48' });
    add('shop', -64, 12.6, S, { name: 'FLOWERS', width: 9, floors: 2, awning: '#a84a6a', wall: '#f0e6da' });
    add('tower', -84, 15.6, S, { floors: 8, width: 14, depth: 14, style: 'glass' });
    add('house', -104, 12.6, S, { floors: 2, roof: 'hip' }); add('house', -122, 12.6, S, { floors: 1 });
    // north side
    add('tower', -15, -14.2, N, { floors: 4, width: 11.5, depth: 11, style: 'concrete', color: '#c9c2b6' });
    add('house', -33, -12.6, N, { floors: 2, width: 9, depth: 8, roof: 'gable', wall: '#e3c9b1', roofColor: '#a8452f' });
    add('shop', -50, -12.6, N, { name: 'TEA', width: 8.5, floors: 2, awning: '#6b8f4e' });
    add('house', -67, -13, N, { floors: 1, width: 10, depth: 9, roof: 'hip' }); add('house', -85, -12.6, N, { floors: 2 }); add('shop', -103, -12.6, N, { name: 'MARKET', width: 10, floors: 1 }); add('house', -121, -12.6, N, { floors: 2 });
    add('house', 60, -12.6, N, { floors: 2, width: 9, depth: 8, roof: 'gable', wall: '#f0e6da', roofColor: '#4f6b57' });
    add('shop', 77, -12.6, N, { name: 'MARKET', width: 9.5, floors: 2, awning: '#4f6fa8' });
    add('house', 94, -13, N, { floors: 1, width: 10, depth: 9, roof: 'gable' }); add('tower', 113, -15.6, N, { floors: 10, width: 14, depth: 14, style: 'glass' }); add('house', 132, -12.6, N, { floors: 2 });
    // cross street
    [[-12.6, -36, Wd, 2], [-12.6, -55, Wd, 1], [-12.6, -76, Wd, 2], [-12.6, -98, Wd, 2], [12.6, -60, Ed, 2], [12.6, -80, Ed, 1], [12.6, -100, Ed, 2], [-12.6, 34, Wd, 2], [-12.6, 53, Wd, 1], [-12.6, 74, Wd, 2], [-12.6, 96, Wd, 2], [12.6, 34, Ed, 1], [12.6, 54, Ed, 2], [12.6, 76, Ed, 2], [12.6, 98, Ed, 1]].forEach((h) => add(R() < 0.2 ? 'shop' : 'house', h[0], h[1], h[2], { floors: h[3], width: 9, depth: 8, roof: pk(['gable', 'gable', 'hip']) }));
    // park behind the starting point
    add('fountain', 29, -26, 0, { size: 2.6 });
    add('gazebo', 43, -37, 0, { size: 3, color: '#8a4b3a' });
    add('pond', 16, -38, 0, { size: 5.5 });
    [[22, -19], [36, -19], [22, -33], [36, -33]].forEach((p, i) => add('flowers', p[0], p[1], 0, { size: 1.6, color: ['#e85d75', '#f2c14e', '#c084d6', '#ff8c5a'][i] }));
    const b1 = add('bench', 23, -10.4, N, {}); add('bench', 35, -10.4, N, {}); add('bench', 29, -20, 180, {}); add('bench', 22.5, -26, 90, {}); add('bench', 35.5, -26, 270, {});
    [[10.5, -12, 'oak', 8], [47, -12, 'oak', 7.5], [10.5, -26, 'sakura', 6.5], [47.5, -24, 'birch', 8], [26, -42, 'willow', 8.5], [36, -44, 'oak', 9], [47, -45, 'pine', 9], [10, -46, 'pine', 10], [41, -18, 'sakura', 5.5]].forEach((t) => add('tree', t[0], t[1], 0, { kind: t[2], height: t[3] }));
    add('lamp', 15, -9, 0, {}); add('lamp', 43, -9, 0, {}); add('lamp', 25.4, -34.2, 0, {}); add('table', 40, -27, 0, { color: '#c8553d' });
    const sitter = add('person', 23, -10.4, 0, { pose: 'sit', shirt: '#5a9367' }); YX.attachTo(sitter, b1); add('cat', 35.4, -10.2, 20, { color: '#d98b3a' }); add('dog', 30, -30, 0, {});
    // by the first house
    add('tree', 11.2, 13.4, 0, { kind: 'sakura', height: 6.5 }); add('bench', 11.4, 8.6, S, {}); add('bush', 27, 16, 0, { size: 1.3 }); add('flowers', 41, 20, 0, { size: 1.4 }); add('rock', 44.5, 17.5, 0, { size: 0.9 }); add('bush', 31, 19.5, 0, { size: 1 });
    // street furniture
    for (let x = -136; x <= 136; x += 16) { if (Math.abs(x) < 14) continue; if (!(x > 12 && x < 30)) add('tree', x, -5.9, 0, { kind: pk(['oak', 'oak', 'birch', 'sakura']), height: rr(5.5, 7.5) }); if (!(x > 6 && x < 50)) add('tree', x + 6, 5.9, 0, { kind: pk(['oak', 'oak', 'autumn', 'birch']), height: rr(5.5, 7.5) }); }
    for (let x = -128; x <= 128; x += 24) { if (Math.abs(x) < 10) continue; if (!(x + 3 > 6 && x + 3 < 50)) add('lamp', x + 3, 6.3, 0, {}); if (!(x - 9 > 13 && x - 9 < 27)) add('lamp', x - 9, -6.3, 0, {}); }
    for (let z = -100; z <= 100; z += 22) { if (Math.abs(z) < 14) continue; add('lamp', 5.8, z, 0, {}); add('tree', -5.5, z + 9, 0, { kind: pk(['oak', 'birch']), height: rr(5, 7) }); }
    add('lamp', 9.5, 6.3, 0, {}); add('lamp', 46.5, 6.3, 0, {});
    add('mailbox', -8.2, 7.6, S, {}); add('hydrant', 49.5, 5.6, S, {}); add('trashcan', 58.5, 6.4, S, {}); add('trashcan', -20, -6.4, N, {}); add('bicycle', 49.2, 8.2, 80, { color: '#2e6da4' });
    add('busstop', -27, -6.1, N, { name: 'BUS' }); add('trafficlight', 6.2, 6.2, Ed, { state: 'green' }); add('trafficlight', -6.2, -6.2, Wd, { state: 'red' });
    add('sign', 7.4, -8.6, 150, { text: 'MAIN ST', size: 0.8, color: '#2f5d62' }); add('bench', -40, 6.6, S, {}); add('bench', 66, -6.6, N, {}); add('fence', 71, 6.8, S, { length: 9, height: 0.9 }); add('flag', 97, 7.4, 0, { height: 8, color: '#2f6f73' });
    // traffic and people
    add('car', -40, 2.2, 90, { color: '#c0392b', kind: 'sedan' }); add('car', 62, -2.2, 270, { kind: 'taxi' }); add('car', -95, -2.2, 270, { color: '#2e6da4', kind: 'van' }); add('bus', 105, 2.2, 90, { color: '#2e8b6f', name: '12' }); add('car', -2, -50, 0, { color: '#ecf0f1', kind: 'pickup' }); add('car', 2, 60, 180, { color: '#34495e' });
    [[32, 6.1], [-22, -6.1], [64, -6.1], [-52, 6.1], [6.2, 30], [-6.2, -34], [84, 6.1], [38, -24]].forEach((p) => add('person', p[0], p[1], R() * 360, { pose: 'walk' }));
    add('person', 55.5, 8.2, 20, { pose: 'stand', shirt: '#e8b04a' }); add('person', 57, 8.6, 250, { pose: 'wave', shirt: '#8e6bbf' });
    for (let i = 0; i < 6; i++) add('bird', rr(-30, 60), rr(-30, 30), 0, { pose: 'fly' }, { y: rr(11, 22) });
    for (let i = 0; i < 10; i++) add('cloud', rr(-380, 380), rr(-300, 300), 0, { size: rr(0.8, 2.2) }, { y: rr(62, 105) });
    add('balloon', -70, 52, 0, { color: '#d9534f', size: 1 }, { y: 34 });
    add('hill', 150, 120, 0, { size: 46, height: 30 }); add('hill', -175, -140, 0, { size: 60, height: 44, snow: true }); add('hill', 190, -120, 0, { size: 40, height: 22 });
    // background greenery
    let made = 0, tries = 0;
    while (made < 95 && tries++ < 900) { const a = R() * 6.283, d = 26 + Math.sqrt(R()) * 185, x = Math.cos(a) * d + rr(-10, 10), z = Math.sin(a) * d; if (Math.abs(x) < 150 && Math.abs(z) < 24) continue; if (Math.abs(x) < 22 && Math.abs(z) < 118) continue; if (x > 26 && x < 47 && z > 7 && z < 24) continue; if (YX.isBlocked(x, z, 2.2, {})) continue; const k = R(); add('tree', x, z, 0, { kind: k < 0.45 ? 'pine' : k < 0.8 ? 'oak' : k < 0.9 ? 'birch' : 'autumn', height: rr(6, 13), _static: true }); made++; }
    for (let i = 0; i < 26; i++) { const a = R() * 6.283, d = 24 + R() * 120, x = Math.cos(a) * d, z = Math.sin(a) * d; if (Math.abs(z) < 22 || Math.abs(x) < 20 || YX.isBlocked(x, z, 1.5, {})) continue; add(pk(['bush', 'bush', 'rock', 'flowers']), x, z, 0, {}); }
    /* ---------- the designed layer: a square, a market, a playground, a lake, a farm, a church, things on the skyline ---------- */
    const clearTrees = (hit) => { for (const o of Array.from(W.objs.values())) if (o.params && o.params._static && hit(o.x, o.z)) YX.removeObj(o); }, disc = (cx, cz, r) => (x, z) => Math.hypot(x - cx, z - cz) < r, rect = (x0, z0, x1, z1) => (x, z) => x > x0 && x < x1 && z > z0 && z < z1;
    const stand = (x, z, deg, params) => { const o = add('person', x, z, deg, Object.assign({ pose: 'stand' }, params)); o.motion = 'none'; return o; };
    // the square in the park: paving under the fountain, paths to the street, the gazebo, the pond and the clock tower
    add('plaza', 29, -26, 0, { size: 7 });
    add('path', 29, -13.1, 90, { length: 11.8, width: 2.4 }); add('path', 39.4, -33.1, 45, { length: 8.6, width: 1.8 }); add('path', 21.9, -32.4, -45, { length: 4.6, width: 1.8 }); add('path', 29, -38.6, 90, { length: 11.4, width: 2.2 });
    add('clocktower', 29, -47.6, 0, {});
    add('planter', 27.1, -8.5, 0, { flowers: '#e85d75' }); add('planter', 30.9, -8.5, 0, { flowers: '#f2c14e' });
    add('hedge', 7.7, -24, 90, { length: 21 }); add('hedge', 51.6, -22, 90, { length: 24 }); add('hedge', 19, -49.6, 0, { length: 15 }); add('hedge', 39.5, -49.6, 0, { length: 15 });
    // market along the street side of the park, lights strung over it
    [[18.2, 'fruit', '#d1483a'], [23.6, 'flowers', '#2f6f73'], [34.4, 'bread', '#d9a441'], [39.8, 'vegetables', '#4f6fa8']].forEach((m, i) => { add('stall', m[0], -13.6, 0, { goods: m[1], color: m[2] }); stand(m[0] + 0.2, -15.0, 0, { shirt: ['#f4f1ea', '#6b8f4e', '#d9a441', '#4f6fa8'][i] }); });
    stand(18.6, -11.9, 180, { shirt: '#8e6bbf' }); stand(34.0, -11.8, 170, { gesture: 'talk', shirt: '#e8b04a' }); stand(35.1, -11.6, 200, { gesture: 'talk', shirt: '#5a9367' }); const kidM = stand(24.2, -11.9, 180, { age: 'child', height: 1.15 });
    add('stringlights', 21, -12.4, 0, { length: 9.6 }); add('stringlights', 37.1, -12.4, 0, { length: 9.6 });
    add('cart', 33.6, -21.2, 200, {}); stand(32.4, -20.3, 20, { shirt: '#f7c6d9' }); stand(34.9, -22.6, 200, { shirt: '#f4f1ea' });
    // playground
    const slide = add('slide', 13.4, -17.6, 90, {}), swing = add('swing', 14.6, -23.6, 0, {}); add('sandbox', 18.4, -29.2, 0, { size: 1.9 });
    const k1 = add('person', 14.9, -19.2, 0, { age: 'child', height: 1.1, pose: 'stand', shirt: '#e85d75' }); k1.motion = 'none'; k1.params._use = slide.id; // this one is on the slide, round and round const k2 = add('person', 14.6, -23.6, 0, { age: 'child', height: 1.15, pose: 'sit', shirt: '#4f6fa8' }); YX.attachTo(k2, swing, 'seat');
    add('person', 18.2, -29.0, 60, { age: 'child', height: 1.05, pose: 'squat', shirt: '#f2c14e' }).motion = 'none'; stand(17.2, -20.6, 250, { gesture: 'wave', shirt: '#b5533c' });
    const afloat = (k, water, x, z, deg) => { YX.attachFloor(k, water, x, z, deg * DEG); k.attach.anchor = 'deck'; if (k.type === 'duck') k.motion = 'wander'; }; // on the water: it floats there, and a duck paddles about
    // ducks on the pond
    const pondO = Array.from(W.objs.values()).find((o) => o.type === 'pond'); [[14.5, -37, 30], [17.4, -39.4, 200], [15.6, -40.2, 120]].forEach((d, i) => { const k = add('duck', d[0], d[1], d[2], { color: i === 2 ? '#8a6a48' : '#fbf8ef', size: i === 1 ? 0.8 : 1 }); if (pondO) afloat(k, pondO, d[0], d[1], d[2]); });
    // the lake beyond the park: a pier, boats, a lighthouse on the far shore
    clearTrees(disc(88, -62, 31)); const lake = add('pond', 88, -62, 0, { size: 24 });
    add('pier', 88, -40.2, 180, { length: 10 }); add('path', 88, -29.6, 90, { length: 11, width: 1.8, kind: 'gravel' }); add('path', 71.5, -24.3, 0, { length: 34, width: 1.8, kind: 'gravel' });
    [['boat', 80, -58, 40, { kind: 'sail', color: '#f4f1ea' }], ['boat', 97, -68, 250, { kind: 'sail', color: '#d1483a', size: 1.15 }], ['boat', 86.8, -47.2, 100, { kind: 'row', color: '#2f6f73' }], ['duck', 92, -52, 60, {}], ['duck', 93.2, -53.1, 80, { size: 0.8 }], ['duck', 78, -66, 200, { color: '#8a6a48' }]].forEach((q) => { const k = add(q[0], q[1], q[2], q[3], q[4]); afloat(k, lake, q[1], q[2], q[3]); });
    const pierO = Array.from(W.objs.values()).filter((o) => o.type === 'pier').pop(), fisher = add('person', 88, -44.2, 0, { pose: 'sit', shirt: '#3f6f73' }); YX.attachTo(fisher, pierO, 'top');
    clearTrees(disc(112, -84, 9)); const knoll = add('hill', 112, -84, 0, { size: 9, height: 3.2, color: '#7fa862' }); YX.attachTo(add('lighthouse', 112, -84, 200, { height: 17 }), knoll, 'top');
    add('bench', 80.5, -35.4, 0, {}); add('bench', 95.5, -35.4, 0, {}); add('tree', 76, -32, 0, { kind: 'willow', height: 8 }); add('tree', 101, -33, 0, { kind: 'willow', height: 9 }); add('field', 60, -40, 0, { crop: 'meadow', width: 9, depth: 22 });
    // the church south of Main St, seen through the gap between the bakery and the next house
    clearTrees(rect(48, 22, 78, 60)); add('church', 62, 42, 180, {}); add('path', 62, 20.3, 90, { length: 26.4, width: 2.2 }); add('plaza', 62, 29.6, 0, { size: 3.6, shape: 'square' }); add('statue', 62, 29.6, 180, {});
    add('hedge', 55.4, 41, 90, { length: 16, height: 0.9 }); add('hedge', 68.6, 41, 90, { length: 16, height: 0.9 }); add('tree', 54.5, 29, 0, { kind: 'oak', height: 8 }); add('tree', 69.5, 29, 0, { kind: 'autumn', height: 7.5 }); add('bench', 59.2, 26.4, 90, {}); add('planter', 60.4, 33.6, 0, {}); add('planter', 63.6, 33.6, 0, { flowers: '#c084d6' });
    // the farm in the south-west: a patchwork of fields, a barn, a windmill
    clearTrees(rect(-128, 22, -22, 112));
    [[-52, 60, 26, 18, 'wheat'], [-52, 81, 26, 16, 'tulip'], [-82, 60, 26, 18, 'lavender'], [-82, 81, 26, 16, 'sunflower'], [-112, 60, 26, 18, 'corn'], [-112, 81, 26, 16, 'vegetable'], [-67, 101, 56, 14, 'wheat']].forEach((f) => add('field', f[0], f[1], 0, { width: f[2], depth: f[3], crop: f[4] }));
    add('barn', -34, 33.5, 270, {}); add('silo', -42.5, 27.4, 0, {}); add('well', -44, 41, 0, {}); add('path', -20.4, 43.6, 0, { length: 27, width: 2.6, kind: 'dirt' }); add('windmill', -97, 38.5, 160, {});
    [[-28, 42.4, 'roll'], [-29.6, 44.2, 'roll'], [-48, 52.4, 'bale'], [-60, 98, 'roll'], [-74, 104, 'roll'], [-41, 47.8, 'stack']].forEach((h) => add('haystack', h[0], h[1], R() * 360, { kind: h[2] })); add('scarecrow', -52, 62, 20, {}); add('scarecrow', -110, 82, 340, { shirt: '#4f6fa8' });
    add('fence', -67, 49.6, 0, { length: 104, height: 0.9, color: '#8a6a48' }); stand(-39.5, 43.8, 120, { shirt: '#b5533c' }); add('dog', -37, 45, 0, { color: '#4a3a2a' });
    // a fairground on the eastern skyline, a camp at the edge of the woods
    clearTrees(disc(124, 62, 22)); add('ferriswheel', 124, 62, 290, { size: 11 }); add('tent', 110, 52, 30, { color: '#d1483a', size: 1.5 }); add('tent', 112, 70, 300, { color: '#d9a441', size: 1.5 }); add('stall', 108, 61, 270, { goods: 'bread', color: '#a84a6a' }); add('cart', 113, 46, 300, { canopy: '#4f6fa8' }); add('stringlights', 109, 57, 80, { length: 14 });
    clearTrees(disc(-62, -62, 9)); add('tent', -66, -64, 60, { color: '#6b8f4e' }); add('tent', -58.5, -66.5, 320, { color: '#e67e22' }); add('campfire', -62, -60.5, 0, {}); const camper = add('person', -63.9, -59.2, 120, { pose: 'sit', shirt: '#d9a441' }); camper.motion = 'none'; add('person', -60.2, -59, 240, { pose: 'squat', shirt: '#4f6fa8' }).motion = 'none';
    for (let i = 0; i < 46; i++) { const a = R() * 6.283, d = 12 + Math.sqrt(R()) * 34, x = -78 + Math.cos(a) * d, z = -78 + Math.sin(a) * d * 0.8; if (Math.hypot(x + 62, z + 62) < 9 || YX.isBlocked(x, z, 1.6, {})) continue; add('tree', x, z, 0, { kind: R() < 0.7 ? 'pine' : 'oak', height: rr(7, 14), _static: true }); }
    // doorsteps along Main St
    [[50.4, 8.0, '#e85d75'], [57.6, 8.0, '#f2c14e'], [-17.1, 8.0, '#c084d6'], [-9.9, 8.0, '#ffffff'], [-67.6, 8.0, '#e85d75'], [-60.4, 8.0, '#ff8c5a'], [73.4, -8.0, '#f2c14e'], [80.6, -8.0, '#e2495b'], [-53.4, -8.0, '#ffffff'], [-46.6, -8.0, '#e85d75']].forEach((q) => add('planter', q[0], q[1], q[1] > 0 ? 180 : 0, { width: 1.3, flowers: q[2] }));
    YX.recomputeRoads();
    for (const o of W.objs.values()) { if (o.type === 'person' && !o.attach) o.motion = o.params.pose === 'walk' ? 'wander' : 'none'; YX.initMotion(o); }
    Object.assign(W.player, { x: 20, y: 1.7, z: -6.2, yaw: Math.PI, pitch: 0.075, fly: false, lens: 0, vx: 0, vz: 0 });
    Object.assign(W.env, { time: 15.6, weather: 'clear', flow: 0, ground: 'grass', light: 'normal', az: 0, look: 'none' });
    YX.three.renderer.domElement.style.filter = '';
    YX.setEnv({}, { instant: true });
  };
})();
