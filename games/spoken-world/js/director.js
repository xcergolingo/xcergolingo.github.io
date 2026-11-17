/* Spoken World · director: a camera move is designed for the place it happens in.
   The model is given the request, the camera, the subject and a plan of what stands around (footprints and heights) and answers with a few keyframes.
   The engine turns them into a smooth path, checks it against every building, tree and parked car, bends it round or over whatever is in the way,
   draws the plan, and only then flies it. Without the model the same path machinery runs on a handful of classic moves, so those do not cut through houses either. */
'use strict';
(function () {
  const YX = window.YX, W = YX.world, T = YX.T, clamp = YX.clamp, lerp = YX.lerp, DEG = YX.DEG, hooks = YX.hooks, M = YX.mind;
  const num = (v, d) => { v = +v; return isFinite(v) ? v : d; }, r1 = (v) => Math.round(v * 10) / 10;
  const HZ = 15, CLEAR = 1.4; // samples per second of a finished path; how far the camera stays from anything solid
  const PATHABLE = { orbit: 1, arc: 1, push: 1, pull: 1, dolly: 1, zoom: 1, street: 1, travel: 1, along: 1, crane: 1, rise: 1, reveal: 1, flyover: 1, drone: 1, aerial: 1, truck: 1, slide: 1 };
  const NAME_Z = { orbit: '环绕', arc: '环绕', push: '推近', pull: '拉远', dolly: '推近', street: '沿街平推', crane: '升降', reveal: '拉升揭示', flyover: '飞越', truck: '横移' }, NAME_E = { orbit: 'Orbit', arc: 'Arc', push: 'Push in', pull: 'Pull out', dolly: 'Push in', street: 'Street track', crane: 'Crane', reveal: 'Reveal', flyover: 'Flyover', truck: 'Truck' };
  const moveName = (m) => (YX.lang === 'en' ? NAME_E[m] : NAME_Z[m]) || m;

  /* ---------- what is in the way: every solid thing as a box with a footprint, a turn and a height ---------- */
  function obstaclesNear(cx, cz, R, skip) {
    const out = [];
    for (const o of W.objs.values()) {
      if (o.dead || !o.box || o.attach || o.type === 'road' || o.type === '__pending' || (skip && skip.has(o.id))) continue;
      const def = YX.defOf(o); if (!def || def.flat || def.cls === 'sky' || def.cls === 'creature' || o.type === 'pond' || o.type === 'water') continue;
      if (def.cls === 'vehicle' && o.motion === 'drive') continue; // traffic moves out of the way by itself
      const b = o.box, hx = ((b.max.x - b.min.x) / 2) * o.s[0], hz = ((b.max.z - b.min.z) / 2) * o.s[2], top = o.y + b.max.y * o.s[1]; if (top < 0.5 || Math.max(hx, hz) < 0.15) continue;
      const c = Math.cos(o.rot), s = Math.sin(o.rot), lx = ((b.min.x + b.max.x) / 2) * o.s[0], lz = ((b.min.z + b.max.z) / 2) * o.s[2], x = o.x + lx * c + lz * s, z = o.z - lx * s + lz * c;
      if (Math.hypot(x - cx, z - cz) - Math.hypot(hx, hz) > R) continue;
      out.push({ o, x, z, hx, hz, top, c, s, m: clamp(Math.max(hx, hz) * 0.9, 0.45, CLEAR) }); // a lamp post needs less room than a house
    }
    return out;
  }
  const toLocal = (ob, p) => { const dx = p[0] - ob.x, dz = p[2] - ob.z; return [dx * ob.c - dz * ob.s, dx * ob.s + dz * ob.c]; };
  const insideOb = (ob, p, k) => { const m = ob.m * k; if (p[1] > ob.top + m) return false; const l = toLocal(ob, p); return Math.abs(l[0]) < ob.hx + m && Math.abs(l[1]) < ob.hz + m; }; // k: how much of its clearance counts

  /* ---------- keyframes -> a smooth run of samples ---------- */
  const cr = (p0, p1, p2, p3, u) => 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
  function sampleKeys(keys, dur, ease) {
    const N = Math.max(8, Math.round(dur * HZ)), K = keys.length, out = [];
    for (let i = 0; i <= N; i++) {
      let u = i / N; if (ease !== 'linear') u = lerp(u, u * u * (3 - 2 * u), 0.65); // gentle start and stop
      let k = 0; while (k < K - 2 && keys[k + 1].t <= u) k++;
      const a = keys[k], b = keys[k + 1], w = clamp((u - a.t) / Math.max(1e-4, b.t - a.t), 0, 1), p0 = keys[Math.max(0, k - 1)], p3 = keys[Math.min(K - 1, k + 2)];
      out.push({ pos: [0, 1, 2].map((j) => cr(p0.pos[j], a.pos[j], b.pos[j], p3.pos[j], w)), look: [0, 1, 2].map((j) => lerp(a.look[j], b.look[j], w * w * (3 - 2 * w))) });
    }
    return out;
  }
  /* ---------- the path must not cut through anything: each stretch that does is taken over the top or round the nearer side, as one decision ---------- */
  function fixPath(S, obs, opt) { // opt.flat: the path stays on the ground, so it goes round and never over; opt.minY: how low it may go
    const N = S.length, spread = Math.max(3, Math.round(0.9 * HZ)); let detours = 0;
    for (let it = 0; it < 6; it++) {
      let any = false;
      for (const ob of obs) {
        let i = 0;
        while (i < N) {
          if (!insideOb(ob, S[i].pos, 1)) { i++; continue; }
          let j = i; while (j + 1 < N && insideOb(ob, S[j + 1].pos, 1)) j++; const CL = ob.m + 0.05;
          const cost = [0, 0, 0, 0, 0]; // over, +x, -x, +z, -z in the obstacle's own frame
          for (let k = i; k <= j; k++) { const l = toLocal(ob, S[k].pos); cost[0] = Math.max(cost[0], ob.top + CL - S[k].pos[1]); cost[1] = Math.max(cost[1], ob.hx + CL - l[0]); cost[2] = Math.max(cost[2], ob.hx + CL + l[0]); cost[3] = Math.max(cost[3], ob.hz + CL - l[1]); cost[4] = Math.max(cost[4], ob.hz + CL + l[1]); }
          cost[0] *= 1.2; if (opt && opt.flat) cost[0] = 1e9; let best = 0; for (let q = 1; q < 5; q++) if (cost[q] < cost[best]) best = q; // going round keeps the shot's height, so it wins a tie
          const disp = (k) => { const p = S[k].pos, l = toLocal(ob, p); if (best === 0) return [0, Math.max(0, ob.top + CL - p[1]), 0]; const dl = best === 1 ? [ob.hx + CL - l[0], 0] : best === 2 ? [-(ob.hx + CL + l[0]), 0] : best === 3 ? [0, ob.hz + CL - l[1]] : [0, -(ob.hz + CL + l[1])]; return [dl[0] * ob.c + dl[1] * ob.s, 0, -dl[0] * ob.s + dl[1] * ob.c]; };
          const dI = disp(i), dJ = disp(j), run = []; for (let k = i; k <= j; k++) run.push(disp(k));
          for (let k = i; k <= j; k++) for (let a = 0; a < 3; a++) S[k].pos[a] += run[k - i][a];
          for (let n = 1; n <= spread; n++) { const f = 0.5 * (1 + Math.cos((Math.PI * n) / (spread + 1))); if (i - n >= 0) for (let a = 0; a < 3; a++) S[i - n].pos[a] += dI[a] * f; if (j + n < N) for (let a = 0; a < 3; a++) S[j + n].pos[a] += dJ[a] * f; } // the detour starts early and ends late
          any = true; detours++; i = j + 1;
        }
      }
      if (!any) break;
      for (let p = 0; p < 2; p++) for (let k = 1; k < N - 1; k++) for (let a = 0; a < 3; a++) S[k].pos[a] = S[k].pos[a] * 0.6 + (S[k - 1].pos[a] + S[k + 1].pos[a]) * 0.2;
    }
    const minY = opt && opt.minY != null ? opt.minY : 0.6; for (const s of S) { s.pos[1] = Math.max(minY, s.pos[1]); if (!(opt && opt.flat)) for (const ob of obs) if (insideOb(ob, s.pos, 0.25)) s.pos[1] = ob.top + 0.5; } // whatever the smoothing pulled back in goes over the top
    return detours;
  }
  function toTake(S, dur) { // samples the camera engine already knows how to fly: time, position, heading
    const out = [], dt = dur / (S.length - 1); let py = null;
    for (let i = 0; i < S.length; i++) { const p = S[i].pos, l = S[i].look, dx = l[0] - p[0], dy = l[1] - p[1], dz = l[2] - p[2]; let yaw = Math.atan2(-dx, -dz); if (Math.hypot(dx, dz) < 0.05 && py != null) yaw = py; if (py != null) { while (yaw - py > Math.PI) yaw -= 2 * Math.PI; while (yaw - py < -Math.PI) yaw += 2 * Math.PI; } py = yaw; out.push({ t: i * dt, x: p[0], y: p[1], z: p[2], yaw, pitch: clamp(Math.atan2(dy, Math.hypot(dx, dz)), -1.45, 1.45) }); }
    for (let p = 0; p < 2; p++) for (let k = 1; k < out.length - 1; k++) { out[k].yaw = out[k].yaw * 0.6 + (out[k - 1].yaw + out[k + 1].yaw) * 0.2; out[k].pitch = out[k].pitch * 0.6 + (out[k - 1].pitch + out[k + 1].pitch) * 0.2; }
    return out.map((s) => ({ t: +s.t.toFixed(3), x: +s.x.toFixed(2), y: +s.y.toFixed(2), z: +s.z.toFixed(2), yaw: +s.yaw.toFixed(4), pitch: +s.pitch.toFixed(4) }));
  }

  /* ---------- classic moves as keyframes, from where the camera is now: used without the model, and as the model's safety net ---------- */
  function classicKeys(m, tg, op, f) {
    const cp = Math.cos(f.pitch), fw = [-Math.sin(f.yaw) * cp, Math.sin(f.pitch), -Math.cos(f.yaw) * cp], hl = Math.hypot(fw[0], fw[2]) || 1, hx = fw[0] / hl, hz = fw[2] / hl, rt = [Math.cos(f.yaw), -Math.sin(f.yaw)];
    const tc = tg ? [tg.x, tg.y + tg.size[1] * 0.55, tg.z] : null, ahead = (d) => [f.x + fw[0] * d, Math.max(0.8, f.y + fw[1] * d), f.z + fw[2] * d], here = [f.x, f.y, f.z];
    let dur = num(op.dur, 0), keys = null, ease = 'inout';
    if (m === 'orbit' || m === 'arc') {
      const c = tc || ahead(12), minR = tg ? Math.max(tg.foot[0], tg.foot[1]) * 0.7 + 3 : 3, R = Math.max(minR, Math.hypot(f.x - c[0], f.z - c[2])), a0 = Math.atan2(f.z - c[2], f.x - c[0]), sweep = num(op.deg, 150) * DEG, n = Math.max(4, Math.ceil(Math.abs(sweep) / (30 * DEG)));
      keys = []; for (let i = 0; i <= n; i++) { const a = a0 + (sweep * i) / n; keys.push({ t: i / n, pos: [c[0] + Math.cos(a) * R, f.y + (num(op.amount, 0) * i) / n, c[2] + Math.sin(a) * R], look: c }); }
      dur = dur || (Math.abs(sweep) > 4 ? 10 : 8); ease = Math.abs(sweep) > 4 ? 'linear' : 'inout';
    } else if (m === 'push' || m === 'dolly' || m === 'zoom' || m === 'pull') {
      const dist = tc ? Math.hypot(tc[0] - f.x, tc[1] - f.y, tc[2] - f.z) : 12; let am = op.amount != null ? num(op.amount, 6) : m === 'pull' ? 8 : tc ? Math.max(1.5, dist - (Math.max(tg.foot[0], tg.foot[1]) / 2 + Math.max(2.5, tg.size[1] * 0.9))) : 6; if (m === 'pull') am = -Math.abs(am);
      const look = tc || ahead(40); keys = [{ t: 0, pos: here, look }, { t: 1, pos: [f.x + fw[0] * am, Math.max(0.8, f.y + fw[1] * am + (m === 'pull' ? 0.8 : 0)), f.z + fw[2] * am], look }]; dur = dur || 4;
    } else if (m === 'truck' || m === 'slide') { const am = num(op.amount, 6), look = tc || ahead(14); keys = [{ t: 0, pos: here, look }, { t: 1, pos: [f.x + rt[0] * am, f.y, f.z + rt[1] * am], look: tc || [look[0] + rt[0] * am, look[1], look[2] + rt[1] * am] }]; dur = dur || 4; }
    else if (m === 'crane' || m === 'rise') { const am = num(op.amount, 7), look = tc || ahead(16); keys = [{ t: 0, pos: here, look }, { t: 1, pos: [f.x, Math.max(0.8, f.y + am), f.z], look }]; dur = dur || 4.5; }
    else if (m === 'street' || m === 'travel' || m === 'along') { // along the nearest road, in the direction the camera faces
      let ax = hx, az = hz, best = 26; for (const r of YX.roads()) { const ex = f.x - r.x, ez = f.z - r.z, off = Math.abs(ex * -r.dz + ez * r.dx); if (Math.abs(ex * r.dx + ez * r.dz) < r.hl + 4 && off < best) { best = off; const sg = r.dx * fw[0] + r.dz * fw[2] >= 0 ? 1 : -1; ax = r.dx * sg; az = r.dz * sg; } }
      dur = dur || 8; const am = num(op.amount, dur * 2.6), look0 = [f.x + ax * 40, Math.max(1, f.y - 0.4), f.z + az * 40]; keys = [{ t: 0, pos: here, look: look0 }, { t: 1, pos: [f.x + ax * am, Math.max(0.8, f.y + num(op.rise, 0)), f.z + az * am], look: [look0[0] + ax * am, look0[1], look0[2] + az * am] }]; ease = 'linear';
    } else if (m === 'reveal') { const am = num(op.amount, 14), look = tc || ahead(30); keys = [{ t: 0, pos: here, look }, { t: 0.5, pos: [f.x - hx * am * 0.45, f.y + num(op.rise, 9) * 0.35, f.z - hz * am * 0.45], look }, { t: 1, pos: [f.x - hx * am, f.y + num(op.rise, 9), f.z - hz * am], look }]; dur = dur || 8; }
    else if (m === 'flyover' || m === 'drone' || m === 'aerial') { const am = num(op.amount, 55), up = num(op.rise, 22), y1 = Math.max(f.y, 2) + up; keys = [{ t: 0, pos: here, look: [f.x + hx * 30, Math.max(1, f.y - 2), f.z + hz * 30] }, { t: 0.35, pos: [f.x + hx * am * 0.3, f.y + up * 0.7, f.z + hz * am * 0.3], look: [f.x + hx * (am * 0.3 + 34), 2, f.z + hz * (am * 0.3 + 34)] }, { t: 1, pos: [f.x + hx * am, y1, f.z + hz * am], look: [f.x + hx * (am + 36), 0, f.z + hz * (am + 36)] }]; dur = dur || 8; ease = 'linear'; }
    return keys ? { keys, dur: clamp(dur, 0.5, 60), ease, name: moveName(m) + (tg ? ' · ' + (tg.name || YX.labelOf(YX.defOf(tg))) : '') } : null;
  }

  /* ---------- what the model is asked ---------- */
  function brief(text, hint, tg, f, obs, op) {
    const lens = W.player.lens || 35, cp = Math.cos(f.pitch), fw = [-Math.sin(f.yaw) * cp, Math.sin(f.pitch), -Math.cos(f.yaw) * cp], deg = (r) => Math.round((((r / DEG) % 360) + 360) % 360);
    const line = (ob) => '#' + ob.o.id + ' ' + ob.o.type + (ob.o.name ? ' "' + ob.o.name + '"' : '') + ': centre ' + r1(ob.x) + ',' + r1(ob.z) + '; footprint ' + r1(ob.hx * 2) + 'x' + r1(ob.hz * 2) + ', turned ' + deg(ob.o.rot) + '; height ' + r1(ob.top);
    const roads = YX.roads().map((r) => ({ r, d: Math.hypot(r.x - f.x, r.z - f.z) })).sort((a, b) => a.d - b.d).slice(0, 5).map((q) => { const r = q.r; return '#' + r.o.id + ': from (' + Math.round(r.x - r.dx * r.hl) + ',' + Math.round(r.z - r.dz * r.hl) + ') to (' + Math.round(r.x + r.dx * r.hl) + ',' + Math.round(r.z + r.dz * r.hl) + '), ' + r1(r.w) + ' m wide'; });
    const movers = []; for (const o of W.objs.values()) { if (o.dead || o.attach) continue; const d = YX.defOf(o); if (d && (d.cls === 'creature' || (d.cls === 'vehicle' && o.motion === 'drive')) && Math.hypot(o.x - f.x, o.z - f.z) < 60) movers.push('#' + o.id + ' ' + o.type + ' at ' + r1(o.x) + ',' + r1(o.z) + (o.motion && o.motion !== 'none' ? ' (' + o.motion + ')' : '')); }
    const E = W.env, inB = YX.insideOf && YX.insideOf();
    const fit = (mm) => { if (!tg) return 0; const tv = 12 / mm, th = tv * (16 / 9), wide = Math.hypot(tg.size[0], tg.size[2]); return Math.max(1.5, Math.max((tg.size[1] * 0.5) / tv, (wide * 0.5) / th) * 1.2 + wide * 0.25); }; // vertical field of view is 2*atan(12/mm), as the engine's camera has it
    return 'You are the director of photography of a small low-poly 3D town. Design ONE camera move for the request below, for this exact place and what stands in it.\n'
      + 'Answer with JSON only (no prose, no code fence):\n{"name":"short title","dur":8,"lens":35,"ease":"inout","enter":null,"keys":[{"t":0,"pos":[x,y,z],"look":[x,y,z]},{"t":0.5,"pos":[x,y,z],"look":"#12"},{"t":1,"pos":[x,y,z],"look":[x,y,z]}]}\n'
      + '- 3 to 7 keys. "t" runs from 0 to 1. "pos" is where the camera is; "look" is what it looks at: a point [x,y,z], or an object as "#id" (its middle).\n'
      + '- Metres. x grows east, z grows south, y is height above the ground (ground is y=0). Eye level is 1.7; never go below 0.6.\n'
      + '- "dur": 4 to 10 seconds (10 is the longest a clip can be). "lens" in mm: 18-24 wide, 35 normal, 50-85 tight. "ease": "inout", or "linear" for a steady glide.\n'
      + '- The first key may be the camera\'s present position (one continuous move) or somewhere else (a cut to a new set-up). Choose what makes the better shot.\n'
      + '- Stay at least 1.5 m clear of every obstacle listed below and never pass through one: go round it or over it. Only when the shot is meant to go INTO a building, name that building in "enter".\n'
      + '- Speeds an audience believes: a dolly or handheld move 1-3 m/s, a crane 1-4 m/s, a drone 4-12 m/s.\n'
      + '- Make it a real shot: one clear subject; a start frame and an end frame that are both composed; foreground that slides past when it helps; the street as a leading line; a height and distance that suit the subject (a house reads from 12-20 m, a person from 2-5 m, the whole street from above 15 m).\n'
      + '- If the request is to follow something that moves, answer {"follow":"#id","dur":10} instead.\n\n'
      + '## Request (the player\'s words)\n' + (text || '(no words: the player tapped a button)') + (hint ? '\nThe engine reads this as: ' + hint + (op.dur ? ', ' + op.dur + ' s' : '') + (op.deg ? ', ' + op.deg + ' degrees' : '') + '. Keep that kind of move, but design it for this place.' : '') + '\n\n'
      + '## Camera now\nat [' + r1(f.x) + ',' + r1(f.y) + ',' + r1(f.z) + '], looking along [' + fw.map((v) => v.toFixed(2)).join(',') + '], ' + lens + ' mm lens' + (inB ? '; it is INSIDE #' + inB.id + ' ' + inB.type + ' (interior about ' + r1(inB.foot[0]) + 'x' + r1(inB.foot[1]) + ' m, ceiling 3 m)' : '') + '. Time ' + YX.clock(E.time) + ', weather ' + E.weather + '.\n\n'
      + '## Subject\n' + (tg ? '#' + tg.id + ' ' + tg.type + (tg.name ? ' "' + tg.name + '"' : '') + ': middle [' + r1(tg.x) + ',' + r1(tg.y + tg.size[1] * 0.55) + ',' + r1(tg.z) + '], ' + r1(tg.size[0]) + ' wide, ' + r1(tg.size[1]) + ' tall, ' + r1(tg.size[2]) + ' deep, its front faces [' + Math.sin(tg.rot).toFixed(2) + ',' + Math.cos(tg.rot).toFixed(2) + '] (x,z)' + (tg.motion && tg.motion !== 'none' ? ', it is moving (' + tg.motion + ')' : '') + '\nFraming it: to have ALL of it in the picture with a little air round it, the camera must be at least ' + r1(fit(24)) + ' m from its middle with a 24 mm lens, ' + r1(fit(35)) + ' m at 35 mm, ' + r1(fit(50)) + ' m at 50 mm. Nearer than that, part of it is cut off: do that only for a deliberate detail shot. An orbit keeps one distance (not less than these) and one height all the way round unless the request says otherwise.\nThe camera is ' + r1(Math.hypot(f.x - tg.x, f.z - tg.z)) + ' m from its middle now.' : 'none named: the request is about the place itself') + '\n\n'
      + '## Obstacles nearby (id type: centre x,z; footprint w x d in metres, turned by degrees; height)\n' + (obs.length ? obs.slice(0, 46).map(line).join('\n') : '(open ground)') + '\n\n'
      + '## Roads\n' + (roads.join('\n') || '(none)') + (movers.length ? '\n\n## People, animals and traffic\n' + movers.slice(0, 14).join('\n') : '');
  }
  function readPlan(txt) {
    let s = String(txt || ''); const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a < 0 || b <= a) return null; s = s.slice(a, b + 1);
    let j = null; try { j = JSON.parse(s); } catch (e) { try { j = JSON.parse(s.replace(/,\s*([}\]])/g, '$1')); } catch (e2) { return null; } }
    if (!j || typeof j !== 'object') return null; if (j.follow != null) return { follow: String(j.follow), dur: clamp(num(j.dur, 10), 2, 10) };
    if (!Array.isArray(j.keys)) return null;
    const pt = (v) => { if (Array.isArray(v) && v.length >= 3 && v.every((q) => isFinite(+q))) return [+v[0], +v[1], +v[2]]; if (typeof v === 'string' || typeof v === 'number') { const o = W.objs.get(+String(v).replace('#', '')); if (o) return [o.x, o.y + o.size[1] * 0.55, o.z]; } return null; };
    const keys = []; let last = null;
    for (const k of j.keys) { const pos = pt(k && k.pos), look = pt(k && k.look) || last; if (!pos || !look) continue; if (pos[1] < -1 || look[1] < -6) return null; /* a camera or its subject well under the ground: the answer mixed up its axes, and a plan like that is not flown */ pos[1] = clamp(pos[1], 0.6, 260); pos[0] = clamp(pos[0], -700, 700); pos[2] = clamp(pos[2], -700, 700); keys.push({ t: num(k.t, NaN), pos, look }); last = look; }
    if (keys.length < 2) return null;
    keys.forEach((k, i) => { if (!isFinite(k.t)) k.t = i / (keys.length - 1); }); keys.sort((a, b) => a.t - b.t); const t0 = keys[0].t, t1 = keys[keys.length - 1].t; keys.forEach((k, i) => { k.t = t1 > t0 ? (k.t - t0) / (t1 - t0) : i / (keys.length - 1); });
    const ent = j.enter != null && j.enter !== '' ? +String(j.enter).replace('#', '') : null;
    return { keys, dur: clamp(num(j.dur, 8), 2, 10), lens: j.lens != null && isFinite(+j.lens) ? clamp(+j.lens, 12, 135) : null, ease: /lin/i.test(String(j.ease || '')) ? 'linear' : 'inout', name: String(j.name || '').slice(0, 26), enter: isFinite(ent) ? ent : null };
  }

  /* ---------- the plan, drawn from above ---------- */
  let card = null, cv = null, cap = null, tools = null, mapRaf = 0, mapData = null, hideT = 0;
  function ensureCard() {
    if (card) return; card = document.createElement('div'); card.id = 'shotPlan'; card.setAttribute('aria-live', 'polite');
    card.style.cssText = 'position:fixed;left:16px;top:118px;z-index:12;width:236px;padding:10px 10px 8px;border-radius:14px;background:rgba(18,22,28,.78);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.1);color:#f3efe6;font:500 12px/1.35 var(--f-ui, system-ui, sans-serif);box-shadow:0 10px 30px rgba(0,0,0,.28);opacity:0;transform:translateY(-6px);transition:opacity .25s, transform .25s;pointer-events:none';
    cap = document.createElement('div'); cap.style.cssText = 'display:flex;justify-content:space-between;gap:8px;margin:0 2px 7px;letter-spacing:.01em';
    cv = document.createElement('canvas'); cv.width = 432; cv.height = 432; cv.style.cssText = 'display:block;width:216px;height:216px;border-radius:9px;background:#161b22';
    card.appendChild(cap); card.appendChild(cv);
    // the shot can be corrected from here: each button says the same words the player could say
    tools = document.createElement('div'); tools.style.cssText = 'display:none;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;margin-top:8px';
    const B = [['远一点', 'Farther', 'camera farther', '大一点', 'Bigger', 'path bigger'], ['近一点', 'Closer', 'camera closer', '小一点', 'Smaller', 'path smaller'], ['高一点', 'Higher', 'camera higher', '高一点', 'Higher', 'path higher'], ['低一点', 'Lower', 'camera lower', '低一点', 'Lower', 'path lower'], ['慢一点', 'Slower', 'slower shot', '慢一点', 'Slower', 'path slower'], ['快一点', 'Faster', 'faster shot', '快一点', 'Faster', 'path faster'], ['反方向', 'Other way', 'shot the other way', '反方向', 'Other way', 'path the other way'], ['● 录下来', '● Record', 'record it', '停下', 'Stop', 'stop the path']];
    for (const b of B) { const el = document.createElement('button'); el.type = 'button'; el._b = b; el.style.cssText = 'all:unset;box-sizing:border-box;cursor:pointer;text-align:center;padding:6px 2px;border-radius:7px;border:1px solid rgba(255,255,255,.14);font:500 11px/1.1 var(--f-ui, system-ui, sans-serif);color:' + (b[2] === 'record it' ? '#ff9c92' : '#f3efe6') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis'; el.onmouseenter = () => { el.style.background = 'rgba(255,255,255,.1)'; }; el.onmouseleave = () => { el.style.background = 'none'; }; el.onclick = (e) => { e.stopPropagation(); el.blur(); if (!M.commit) return; if (toolsMode === 'route') M.commit(YX.lang === 'en' ? b[5] : b[5] === 'stop the path' ? '路线停下' : '路线' + b[3]); else M.commit(YX.lang === 'en' ? b[2] : b[2] === 'record it' ? '录下来' : '镜头' + b[0]); }; tools.appendChild(el); }
    tip = document.createElement('div'); tip.style.cssText = 'grid-column:1/-1;opacity:.6;font-size:10.5px;margin:2px 2px 0'; tools.appendChild(tip);
    card.appendChild(tools); card.onmouseenter = () => clearTimeout(hideT); card.onmouseleave = () => { if (tools.style.display !== 'none') hideCard(9000); };
    document.body.appendChild(card);
  }
  let toolsMode = 'shot', tip = null;
  function showTools(mode) { ensureCard(); toolsMode = mode || 'shot'; const rt = toolsMode === 'route', on = rt ? D.routeFresh() : D.fresh && D.fresh(); tools.style.display = on ? 'grid' : 'none'; card.style.pointerEvents = on ? 'auto' : 'none';
    for (const el of tools.querySelectorAll('button')) { const b = el._b; el.textContent = rt ? T(b[3], b[4]) : T(b[0], b[1]); el.title = T('也可以直接说：' + (rt ? b[3] : b[0]).replace('● ', ''), 'Or just say: ' + (rt ? b[4] : b[1]).replace('● ', '').toLowerCase()); el.style.color = !rt && b[2] === 'record it' ? '#ff9c92' : '#f3efe6'; }
    tip.textContent = rt ? T('或者直接说要怎么改：“绕到钟楼后面”“最后落在屋顶上”', 'Or say what to change: “go behind the clock tower”, “land on the roof at the end”') : T('或者直接说要怎么改：“从左边开始”“结尾升高一点”', 'Or say what to change: “start from the left”, “end higher”'); }
  function showCard(left, right) { ensureCard(); clearTimeout(hideT); cap.textContent = ''; const a = document.createElement('span'); a.textContent = left; a.style.cssText = 'font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'; const b = document.createElement('span'); b.textContent = right || ''; b.style.cssText = 'opacity:.7;font-variant-numeric:tabular-nums;white-space:nowrap'; cap.appendChild(a); cap.appendChild(b); card.style.opacity = '1'; card.style.transform = 'none'; }
  function hideCard(ms) { clearTimeout(hideT); hideT = setTimeout(() => { if (card) { card.style.opacity = '0'; card.style.transform = 'translateY(-6px)'; card.style.pointerEvents = 'none'; } cancelAnimationFrame(mapRaf); mapRaf = 0; mapData = null; }, ms || 0); }
  function drawMap() {
    const d = mapData; if (!d || !cv) return; const g = cv.getContext('2d'), S = cv.width; g.clearRect(0, 0, S, S);
    const X = (x) => S / 2 + (x - d.cx) * d.k, Z = (z) => S / 2 + (z - d.cz) * d.k;
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const r of YX.roads()) { g.strokeStyle = 'rgba(255,255,255,.085)'; g.lineWidth = Math.max(2, r.w * d.k); g.beginPath(); g.moveTo(X(r.x - r.dx * r.hl), Z(r.z - r.dz * r.hl)); g.lineTo(X(r.x + r.dx * r.hl), Z(r.z + r.dz * r.hl)); g.stroke(); }
    for (const ob of d.obs) { const sub = d.tg && ob.o === d.tg; g.save(); g.translate(X(ob.x), Z(ob.z)); g.rotate(-ob.o.rot); g.fillStyle = sub ? 'rgba(224,83,58,.9)' : ob.o.type === 'tree' || ob.o.type === 'bush' ? 'rgba(111,170,82,.5)' : 'rgba(214,205,188,.42)'; const w = ob.hx * 2 * d.k, h = ob.hz * 2 * d.k; if (ob.o.type === 'tree' || ob.o.type === 'bush') { g.beginPath(); g.arc(0, 0, Math.max(2, Math.min(w, h) / 2), 0, 6.283); g.fill(); } else g.fillRect(-w / 2, -h / 2, w, h); g.restore(); }
    if (d.raw) { g.setLineDash([5, 7]); g.strokeStyle = 'rgba(255,255,255,.34)'; g.lineWidth = 2; g.beginPath(); d.raw.forEach((p, i) => (i ? g.lineTo(X(p[0]), Z(p[2])) : g.moveTo(X(p[0]), Z(p[2])))); g.stroke(); g.setLineDash([]); } // what was asked for, before it was bent round things
    g.strokeStyle = '#ffd98a'; g.lineWidth = 4; g.beginPath(); d.take.forEach((s, i) => (i ? g.lineTo(X(s.x), Z(s.z)) : g.moveTo(X(s.x), Z(s.z)))); g.stroke();
    for (let i = Math.round(d.take.length * 0.3); i < d.take.length - 2; i += Math.max(4, Math.round(d.take.length * 0.3))) { const a = d.take[i], b = d.take[i + 2], ang = Math.atan2(Z(b.z) - Z(a.z), X(b.x) - X(a.x)); g.save(); g.translate(X(a.x), Z(a.z)); g.rotate(ang); g.fillStyle = '#ffd98a'; g.beginPath(); g.moveTo(9, 0); g.lineTo(-6, -7); g.lineTo(-6, 7); g.closePath(); g.fill(); g.restore(); }
    const s0 = d.take[0], s1 = d.take[d.take.length - 1]; g.fillStyle = '#161b22'; g.strokeStyle = '#ffd98a'; g.lineWidth = 3; g.beginPath(); g.arc(X(s0.x), Z(s0.z), 7, 0, 6.283); g.fill(); g.stroke(); g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(X(s1.x), Z(s1.z), 7, 0, 6.283); g.fill();
    const P = W.player, px = X(P.x), pz = Z(P.z); g.save(); g.translate(px, pz); g.rotate(-P.yaw); g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-22, -46); g.lineTo(22, -46); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 6, 0, 6.283); g.fill(); g.restore(); // the camera and what it sees
  }
  function mapLoop() { drawMap(); mapRaf = mapData ? requestAnimationFrame(mapLoop) : 0; }
  function showPlan(title, take, raw, obs, tg, dur) {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; const grow = (x, z) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); };
    take.forEach((s) => grow(s.x, s.z)); if (tg) grow(tg.x, tg.z); const span = Math.max(14, x1 - x0, z1 - z0) + 14;
    ensureCard(); mapData = { take, raw, obs, tg, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, k: cv.width / span }; showCard(title, dur.toFixed(1) + ' s'); if (!mapRaf) mapLoop();
  }

  /* ---------- fly it ---------- */
  function fly(plan, tg, rec, raw, obs, old) {
    const P = W.player, take = plan.take, dur = take[take.length - 1].t, first = take[0];
    if (plan.lens != null) { P.lens = plan.lens; if (YX.snapFov) YX.snapFov(); }
    YX.cineStop(); YX.setPose(first); P.fly = first.y > 1.95;
    const title = plan.name || T('运镜', 'Camera move'); let sh = null;
    if (old && W.shots.includes(old)) { sh = old; Object.assign(sh, { x: first.x, y: first.y, z: first.z, yaw: first.yaw, pitch: first.pitch, lens: P.lens || 0, take }); delete sh.move; if (YX.reShot) YX.reShot(sh); YX.markDirty(); } // a shot that was corrected stays the same shot: one card in the Film panel, not a pile of near-copies
    else if (!YX.playing) sh = YX.saveShot(title, null, take);
    showPlan(title, take, raw, obs, tg, dur);
    const run = (done) => { YX.setPose(first); YX.cineStart({ type: 'take', samples: take, dur, onDone: (fin) => { hideCard(D.last ? 16000 : 2600); if (done) done(fin); } }); return true; };
    YX.lastMoveAt = performance.now();
    if (rec && YX.filmRun && YX.filmRun(dur, run, title)) return { sh, rec: true };
    run(null); if (hooks.ui) hooks.ui(); return { sh, rec: false };
  }
  function build(keysPlan, tg, f) { // keyframes -> checked path -> samples
    const skip = new Set(); if (keysPlan.enter != null) skip.add(keysPlan.enter); const inB = YX.insideOf && YX.insideOf(); if (inB) skip.add(inB.id);
    let cx = f.x, cz = f.z, far = 30; for (const k of keysPlan.keys) far = Math.max(far, Math.hypot(k.pos[0] - cx, k.pos[2] - cz) + 20);
    const obs = obstaclesNear(cx, cz, Math.min(far, 260), skip), S = sampleKeys(keysPlan.keys, keysPlan.dur, keysPlan.ease), raw = S.map((s) => s.pos.slice());
    const detours = fixPath(S, obs), take = toTake(S, keysPlan.dur);
    return { take, raw: detours ? raw : null, obs, detours, name: keysPlan.name, lens: keysPlan.lens };
  }

  const D = (YX.director = {});
  D.can = (m) => !!PATHABLE[m];
  D.busy = false;
  /* one camera request: text is what the player said, move the engine's own reading of it (may be null), target the subject (may be null) */
  D.go = function (q) {
    const f = YX.poseNow(), tg = q.target || null, m = q.move ? String(q.move).toLowerCase() : null, op = { dur: q.dur, deg: q.deg, amount: q.amount, rise: q.rise }, say = (t) => { if (hooks.toast) hooks.toast(t); else if (hooks.live) hooks.live(t); };
    const keep = (kp, r, by) => { D.last = { kp: { keys: kp.keys.map((k) => ({ t: k.t, pos: k.pos.slice(), look: k.look.slice() })), dur: kp.dur, ease: kp.ease, lens: kp.lens != null ? kp.lens : null, name: kp.name, enter: kp.enter != null ? kp.enter : null }, tg: tg ? tg.id : null, f, text: q.text || '', move: m, sh: r.sh, by, at: performance.now() }; showTools(); };
    const classic = () => { const kp = m ? classicKeys(m, tg, op, f) : null; if (!kp) return null; if (q.rec) kp.dur = clamp(kp.dur, 2, 10); const plan = build(kp, tg, f), r = fly(plan, tg, q.rec, plan.raw, plan.obs); keep(kp, r, 'classic'); return { plan, r }; };
    if (!M.sample || q.instant || D.busy) { // no model to ask (or a one-tap button): the classic move, fitted to the place
      const c = classic(); if (!c) return M.sample || YX.needAI('shot'), { ok: false, msg: M.sample ? T('上一个镜头还在设计中', 'The previous shot is still being designed') : T('设计这个镜头需要 AI，目前没有连接', 'Designing that shot needs the AI, which is not connected') };
      return { ok: true, msg: (c.plan.name || moveName(m)) + (c.plan.detours ? T('（已绕开挡路的东西）', ' (bent round what was in the way)') : '') + (c.r.rec ? T('，正在录制', ', recording') : T('。说“录下来”就拍成片子', '. Say “record it” to film it')) };
    }
    D.busy = true; showCard(T('正在设计镜头…', 'Designing the shot…'), '');
    const mid = tg ? [(f.x + tg.x) / 2, (f.z + tg.z) / 2] : [f.x - Math.sin(f.yaw) * 14, f.z - Math.cos(f.yaw) * 14], obs0 = obstaclesNear(mid[0], mid[1], 70, null).sort((a, b) => Math.hypot(a.x - mid[0], a.z - mid[1]) - Math.hypot(b.x - mid[0], b.z - mid[1]));
    const t0 = performance.now(), ctl = typeof AbortController === 'function' ? new AbortController() : null, timer = setTimeout(() => { if (ctl) ctl.abort(); }, 22000);
    // one familiar move said in a few words ("crane shot of the clock tower") is a small job; a take with several beats ("start behind…, glide through…, then rise…") is not.
    // The host is told which, so a home whose stronger model is slow can give the small job to a quick one (host.js: opts.task).
    const words = String(q.text || '').trim().split(/\s+/).filter(Boolean).length, simple = words <= 14 && String(q.text || '').length <= 80 && !/\b(?:then|start|starts|begin|end|ends|finish|first|after|before|through|into|past|while)\b|然后|接着|之后|最后|先|再|穿过|经过|从.+到/i.test(q.text || '');
    Promise.resolve().then(() => M.sample(brief(q.text || '', m, tg, f, obs0, op), Object.assign({ modelTier: 'default', cache: false, task: simple ? 'shot' : 'shot-long' }, ctl ? { signal: ctl.signal } : null))).then((res) => {
      clearTimeout(timer); D.busy = false; const plan0 = readPlan(res && res.text);
      if (plan0 && plan0.follow) { const o = W.objs.get(+String(plan0.follow).replace('#', '')) || tg; hideCard(0); if (o && YX.startMove('follow', o, { dur: plan0.dur })) { YX.lastMoveAt = performance.now(); return say(T('跟拍 ', 'Following ') + YX.lab(o)); } }
      if (!plan0 || plan0.follow) throw new Error('no plan');
      if (q.dur) plan0.dur = clamp(num(q.dur, plan0.dur), 2, 10);
      const plan = build(plan0, tg, f), r = fly(plan, tg, q.rec, plan.raw, plan.obs); keep(plan0, r, 'ai');
      say((plan.name || T('镜头', 'Shot')) + T(' · 为这里设计，用时 ', ' · designed for this spot in ') + ((performance.now() - t0) / 1000).toFixed(1) + ' s' + (plan.detours ? T('，已绕开挡路的东西', ', bent round what was in the way') : '') + (r.rec ? T('，正在录制', ', recording') : T('。说“录下来”就拍成片子', '. Say “record it” to film it')));
    }).catch((e) => { // the model did not answer with a usable plan: the classic move, fitted to the place, rather than nothing
      clearTimeout(timer); D.busy = false; const c = classic(); if (!c) { hideCard(0); return say(T('这个镜头没设计出来，换个说法再试一次', 'That shot could not be designed. Try saying it another way')); }
      say((c.plan.name || moveName(m)) + T('（AI 没给出可用的方案，用了经典运镜）', ' (the AI gave no usable plan, so this is the classic move)') + (c.r.rec ? T('，正在录制', ', recording') : ''));
    });
    return { ok: true, msg: T('正在为这里设计镜头…', 'Designing the shot for this spot…') };
  };
  /* ---------- a note on the shot that was just made: "farther", "too low", "slower", "the other way", or anything else ----------
     The shot is kept as its keyframes, so a note changes that shot instead of asking for a new one from nothing.
     Distance, height, speed, direction and lens are plain arithmetic on the keys: done at once, and exactly what was asked.
     Any other note goes to the model together with the shot as it stands, with the instruction to change only what the note is about. */
  const FRESH = 300000;
  D.fresh = () => !!D.last && performance.now() - D.last.at < FRESH && (!D.last.sh || W.shots.includes(D.last.sh));
  function centreOf(L) { const tg = L.tg != null ? W.objs.get(L.tg) : null; if (tg && !tg.dead) return [tg.x, tg.y + tg.size[1] * 0.55, tg.z]; const c = [0, 0, 0]; for (const k of L.kp.keys) for (let j = 0; j < 3; j++) c[j] += k.look[j] / L.kp.keys.length; return c; }
  const meanR = (kp, c) => kp.keys.reduce((a, k) => a + Math.hypot(k.pos[0] - c[0], k.pos[2] - c[2]), 0) / kp.keys.length, meanY = (kp) => kp.keys.reduce((a, k) => a + k.pos[1], 0) / kp.keys.length;
  function readNote(note) { // what a note asks for, as numbers; null when it is not about distance, height, speed, direction or lens
    const s = String(note || '').toLowerCase(), en = !/[\u3400-\u9fff]/.test(s), ch = {}; let n = 0, m;
    const lot = en ? /\b(?:much|a lot|lots|way|far|twice|double)\b/.test(s) : /很多|好多|得多|多了|一倍|很远|很近|特别|非常|太多/.test(s), bit = en ? /\b(?:a bit|a little|a touch|slightly|bit|little)\b/.test(s) : /一点点|稍微|稍稍|略微|一丢丢/.test(s), amt = lot ? 2 : bit ? 1 / 1.45 : 1;
    const metres = (m = en ? s.match(/(\d+(?:\.\d+)?) ?(?:m|meters?|metres?)\b/) : s.match(/(\d+(?:\.\d+)?)\s*米/)) ? +m[1] : null;
    if (en ? /\b(?:farther|further|far away|back off|back up|backs? away|move back|step back|pull back|too close|too near|not so close|wider orbit|bigger (?:circle|orbit|radius))\b/.test(s) : /远一?点|远些|再远|离远|太近|别(?:那么|这么|太)近|往后退|退后|拉远|圈(?:再)?大/.test(s)) { ch.dist = metres != null && !/高|high|up\b/.test(s) ? { to: metres } : { k: 1 + 0.5 * amt }; n++; }
    else if (metres != null && (en ? /\b(?:away|from|distance|radius|back)\b/.test(s) : /远|距离|半径|离/.test(s))) { ch.dist = { to: metres }; n++; }
    else if (en ? /\b(?:closer|nearer|move in|get in|too far|not so far|tighter orbit|smaller (?:circle|orbit|radius))\b/.test(s) : /近一?点|近些|再近|靠近|太远|别(?:那么|这么|太)远|凑近|圈(?:再)?小/.test(s)) { ch.dist = metres != null ? { to: metres } : { k: 1 / (1 + 0.45 * amt) }; n++; }
    if (en ? /\b(?:higher|too low|raise (?:it|the camera)|go up|move up|from above|more overhead)\b/.test(s) : /高一?点|高些|再高|太低|升高|往上|抬高/.test(s)) { ch.up = metres != null && !ch.dist ? { to: metres } : { k: amt }; n++; }
    else if (en ? /\b(?:lower|too high|go down|move down|drop (?:it|the camera)|closer to the ground|eye level)\b/.test(s) : /低一?点|低些|再低|太高|降低|往下|压低|平视/.test(s)) { ch.up = /eye level|平视/.test(s) ? { to: 1.7 } : metres != null && !ch.dist ? { to: metres } : { k: -amt }; n++; }
    if (en ? /\b(?:slower|slow(?: it)? down|too fast|not so fast|longer|take (?:your|more) time)\b/.test(s) : /慢一?点|慢些|再慢|太快|别(?:那么|这么|太)快|放慢|久一?点|长一?点/.test(s)) { ch.dur = 1 + 0.4 * amt; n++; }
    else if (en ? /\b(?:faster|speed(?: it)? up|too slow|quicker|shorter)\b/.test(s) : /快一?点|快些|再快|太慢|加快|短一?点/.test(s)) { ch.dur = 1 / (1 + 0.4 * amt); n++; }
    if ((m = en ? s.match(/(\d+(?:\.\d+)?) ?(?:s|sec|secs|seconds?)\b/) : s.match(/(\d+(?:\.\d+)?)\s*秒/))) { ch.durTo = +m[1]; n++; }
    if (en ? /\b(?:other way|other direction|opposite (?:way|direction)|counter ?clockwise|anti ?clockwise|clockwise|go left instead|go right instead|other side)\b/.test(s) : /反方向|反过来|反着|换个?方向|另一边|另一个方向|逆时针|顺时针|往另一/.test(s)) { ch.mirror = true; n++; }
    else if (en ? /\b(?:backwards?|in reverse|reverse it|reverse the (?:shot|move)|start where it ends)\b/.test(s) : /倒着|倒放|倒过来|从终点/.test(s)) { ch.reverse = true; n++; }
    if (en ? /\b(?:wider lens|wide angle|wider shot|wider)\b/.test(s) && !ch.dist : /广角|广一?点|视野大/.test(s)) { ch.lens = 0.72; n++; }
    else if (en ? /\b(?:tighter|longer lens|zoom in|telephoto)\b/.test(s) && !ch.dist : /长焦|紧一?点|特写一?点/.test(s)) { ch.lens = 1.4; n++; }
    if ((m = s.match(/(\d{2,3}) ?(?:mm|毫米)/))) { ch.lensTo = +m[1]; n++; }
    return n ? ch : null;
  }
  D.readNote = readNote;
  /* is the note nothing but distance, height, speed, direction and lens ("a bit farther from the house", "too low", 再远一点)? Then it is arithmetic.
     "Start from the left and end higher" has the word "higher" in it and is not: that one is for the model, with the shot in front of it. */
  D.plain = function (note) {
    const t = String(note || '').toLowerCase().replace(/[^a-z0-9\u3400-\u9fff ]+/g, ' ').replace(/\s+/g, ' ').trim(); if (!t) return false;
    if (/[\u3400-\u9fff]/.test(t)) return t.length <= 14 && !/[把让给叫将使]|变|放|加|删|建|造|从|到|开始|开头|结尾|结束|最后|然后|同时|并且|对着|看着|别穿|不要穿|挡/.test(t);
    const rest = t.replace(/ (?:from|to|than|of|around) (?:the |this |that |a |an |it|them)?[a-z]*(?: [a-z]+)?$/, '').split(' ').filter((w) => !/^(?:please|now|ok|okay|no|nope|hmm|and|but|still|again|just|go|move|be|stay|keep|get|make|it|its|is|was|the|camera|shot|orbit|take|thats|that|this|you|are|youre|a|bit|little|lot|much|way|even|slightly|too|not|so|more|away|out|in|up|down|back|off|time|should|needs?|can|could|farther|further|closer|nearer|higher|lower|slower|faster|quicker|wider|tighter|longer|shorter|close|near|far|low|high|fast|slow|other|opposite|direction|reverse|backwards?|clockwise|counterclockwise|anticlockwise|instead|around|round|lens|angle|zoom|bigger|larger|smaller|path|route|loop|circuit|lap|\d+|m|mm|meters?|metres?|s|sec|seconds?)$/.test(w));
    return rest.length === 0;
  };
  function applyNote(L, ch) { // -> { kp, said: what changed, in the player's units }
    const kp = { keys: L.kp.keys.map((k) => ({ t: k.t, pos: k.pos.slice(), look: k.look.slice() })), dur: L.kp.dur, ease: L.kp.ease, lens: L.kp.lens, name: L.kp.name, enter: L.kp.enter }, c = centreOf(L), said = [];
    if (ch.dist) { const r0 = Math.max(0.5, meanR(kp, c)), k = clamp(ch.dist.to != null ? ch.dist.to / r0 : ch.dist.k, 0.25, 6); for (const q of kp.keys) { q.pos[0] = c[0] + (q.pos[0] - c[0]) * k; q.pos[2] = c[2] + (q.pos[2] - c[2]) * k; if (k > 1) q.pos[1] += (q.pos[1] - Math.min(q.pos[1], 1.7)) * (k - 1) * 0.5; } said.push(T('距离 ', 'distance ') + r1(r0) + ' → ' + r1(meanR(kp, c)) + ' m'); }
    if (ch.up) { const y0 = meanY(kp), dy = ch.up.to != null ? ch.up.to - y0 : ch.up.k * Math.max(1.5, y0 * 0.5); for (const q of kp.keys) q.pos[1] = clamp(q.pos[1] + dy, 0.6, 260); said.push(T('高度 ', 'height ') + r1(y0) + ' → ' + r1(meanY(kp)) + ' m'); }
    if (ch.durTo != null || ch.dur) { const d0 = kp.dur; kp.dur = clamp(ch.durTo != null ? ch.durTo : kp.dur * ch.dur, 2, 10); said.push(kp.dur === d0 && d0 >= 10 ? T('已经是 10 秒了，一个片段最长就这么长；想更慢，可以让它少转一点或者离近一点', 'it is already 10 s, the longest one clip can be; for a slower move, ask for a smaller arc or a closer path') : T('时长 ', 'length ') + r1(d0) + ' → ' + r1(kp.dur) + ' s'); }
    if (ch.mirror) { const a = kp.keys[0].pos, ax = a[0] - c[0], az = a[2] - c[2], l = Math.hypot(ax, az) || 1, ux = ax / l, uz = az / l; const flip = (p) => { const dx = p[0] - c[0], dz = p[2] - c[2], al = dx * ux + dz * uz, px = dx - al * ux, pz = dz - al * uz; p[0] = c[0] + al * ux - px; p[2] = c[2] + al * uz - pz; }; for (const q of kp.keys) { flip(q.pos); flip(q.look); } said.push(T('换了方向', 'the other way round')); } // the same first frame, the other way round
    if (ch.reverse) { kp.keys.reverse(); kp.keys.forEach((q) => { q.t = 1 - q.t; }); said.push(T('倒着走', 'run backwards')); }
    if (ch.lensTo != null || ch.lens) { const l0 = kp.lens != null ? kp.lens : W.player.lens || 35; kp.lens = clamp(ch.lensTo != null ? ch.lensTo : Math.round(l0 * ch.lens), 12, 135); said.push(T('镜头 ', 'lens ') + Math.round(l0) + ' → ' + Math.round(kp.lens) + ' mm'); }
    return { kp, said };
  }
  D.revise = function (q) {
    const L = D.last, say = (t) => { if (hooks.toast) hooks.toast(t); else if (hooks.live) hooks.live(t); };
    if (!L || (L.sh && !W.shots.includes(L.sh))) return { ok: false, msg: T('还没有可以修改的镜头。先说一个运镜，比如“环绕这栋房子”', 'There is no shot to change yet. Ask for a move first, such as “orbit this house”') };
    if (YX.playing || (YX.filmBusy && YX.filmBusy())) return { ok: false, msg: T('正在录制或播放，等它结束再改', 'Recording or playing right now. Change the shot when it is done') };
    const tg = L.tg != null ? W.objs.get(L.tg) || null : null, note = String(q.text || '').trim(), ch = q.change || (D.plain(note) || !M.sample ? readNote(note) : null);
    const land = (kp, by, said) => { const plan = build(kp, tg, L.f), r = fly(plan, tg, !!q.rec, plan.raw, plan.obs, L.sh); D.last = Object.assign({}, L, { kp, sh: r.sh || L.sh, at: performance.now(), notes: (L.notes || []).concat(note).slice(-6), by }); showTools(); return { plan, r, said }; };
    if (ch) { const a = applyNote(L, ch), c = land(a.kp, L.by, a.said); return { ok: true, msg: (L.kp.name || T('镜头', 'Shot')) + T('：', ': ') + a.said.join(T('，', ', ')) + (c.plan.detours ? T('（已绕开挡路的东西）', ' (bent round what was in the way)') : '') + (c.r.rec ? T('，正在录制', ', recording') : '') }; }
    if (!M.sample) return YX.needAI('shot'), { ok: false, msg: T('这个修改需要 AI 来重新设计，目前没有连接。可以直接说：远一点、高一点、慢一点、反方向', 'That change needs the AI, which is not connected. These work without it: farther, higher, slower, the other way') };
    if (D.busy) return { ok: false, msg: T('上一个镜头还在设计中', 'The previous shot is still being designed') };
    D.busy = true; showCard(T('正在修改镜头…', 'Changing the shot…'), '');
    const f = L.f, mid = tg ? [(f.x + tg.x) / 2, (f.z + tg.z) / 2] : [f.x - Math.sin(f.yaw) * 14, f.z - Math.cos(f.yaw) * 14], obs0 = obstaclesNear(mid[0], mid[1], 70, null).sort((a, b) => Math.hypot(a.x - mid[0], a.z - mid[1]) - Math.hypot(b.x - mid[0], b.z - mid[1]));
    const was = JSON.stringify({ name: L.kp.name, dur: r1(L.kp.dur), lens: L.kp.lens, ease: L.kp.ease, enter: L.kp.enter, keys: L.kp.keys.map((k) => ({ t: +k.t.toFixed(2), pos: k.pos.map(r1), look: k.look.map(r1) })) });
    const ask = brief(L.text, L.move, tg, f, obs0, {}) + '\n\n## The shot as it stands (your earlier answer, already flown and shown to the player)\n' + was + ((L.notes || []).length ? '\n\n## Notes the player already gave on it (already applied)\n- ' + L.notes.join('\n- ') : '') + '\n\n## The player\'s note on it now\n' + note + '\n\nThis is a correction, not a new request. Answer with the whole shot again in the same JSON form, changed ONLY in what the note is about: keep the subject, the start frame, the direction of travel, the length and the lens unless the note is about them. If the note says something was wrong (too close, wrong side, cut off, too shaky), fix that thing by a clearly visible amount, not a token one.';
    const t0 = performance.now(), ctl = typeof AbortController === 'function' ? new AbortController() : null, timer = setTimeout(() => { if (ctl) ctl.abort(); }, 26000);
    Promise.resolve().then(() => M.sample(ask, Object.assign({ modelTier: 'default', cache: false, task: 'shot-long' }, ctl ? { signal: ctl.signal } : null))).then((res) => {
      clearTimeout(timer); D.busy = false; const plan0 = readPlan(res && res.text); if (!plan0 || plan0.follow) throw new Error('no plan');
      const c = land(plan0, 'ai', []); say((plan0.name || L.kp.name || T('镜头', 'Shot')) + T(' · 按你的意见改了，用时 ', ' · changed as you said, in ') + ((performance.now() - t0) / 1000).toFixed(1) + ' s' + (c.plan.detours ? T('，已绕开挡路的东西', ', bent round what was in the way') : '') + (c.r.rec ? T('，正在录制', ', recording') : ''));
    }).catch(() => { clearTimeout(timer); D.busy = false; hideCard(0); say(T('这次没改成，镜头保持原样。可以直接说：远一点、高一点、慢一点、反方向', 'That change did not come through; the shot is as it was. These always work: farther, higher, slower, the other way')); });
    return { ok: true, msg: T('正在按你的意见修改镜头…', 'Changing the shot as you said…') };
  };
  /* ---------- a path for something that moves: "fly a figure of eight over the square", "walk round the fountain twice, then to the bench" ----------
     The model is given the same plan of the place the camera work gets, and writes the path as points; the engine draws a smooth curve through them,
     takes it round (or, for things that fly, over) whatever is in the way, and the thing then travels it at its own speed, once or round and round.
     A note afterwards changes that path, the same way a note changes a shot. */
  const kindOf = (o) => { const d = YX.defOf(o) || {}, fly = d.cls === 'sky' || ['fly', 'hover', 'drift'].includes(d.motion) || ['fly', 'hover', 'drift'].includes(o.motion) || (o.motion === 'route' && o.ms && o.ms.air) || !YX.strict, ground = d.cls === 'creature' || d.cls === 'vehicle' || !YX.strict; return { fly, ground, d }; };
  function routeBrief(text, o, obs, K) {
    const P = W.player, f = YX.poseNow(), cp = Math.cos(f.pitch), fw = [-Math.sin(f.yaw) * cp, Math.sin(f.pitch), -Math.cos(f.yaw) * cp], deg = (r) => Math.round((((r / DEG) % 360) + 360) % 360), sp = o.speed || K.d.speed || 2;
    const line = (ob) => '#' + ob.o.id + ' ' + ob.o.type + (ob.o.name ? ' "' + ob.o.name + '"' : '') + ': centre ' + r1(ob.x) + ',' + r1(ob.z) + '; footprint ' + r1(ob.hx * 2) + 'x' + r1(ob.hz * 2) + ', turned ' + deg(ob.o.rot) + '; height ' + r1(ob.top);
    const roads = YX.roads().map((r) => ({ r, d: Math.hypot(r.x - o.x, r.z - o.z) })).sort((a, b) => a.d - b.d).slice(0, 5).map((q) => { const r = q.r; return '#' + r.o.id + ': from (' + Math.round(r.x - r.dx * r.hl) + ',' + Math.round(r.z - r.dz * r.hl) + ') to (' + Math.round(r.x + r.dx * r.hl) + ',' + Math.round(r.z + r.dz * r.hl) + '), ' + r1(r.w) + ' m wide'; });
    const aim = W.aim && W.aim !== o ? '#' + W.aim.id + ' ' + W.aim.type + ' at ' + r1(W.aim.x) + ',' + r1(W.aim.z) : 'nothing else';
    return 'You plan how things move in a small low-poly 3D town. Design the PATH that one thing travels, for the request below, for this exact place and what stands in it.\n'
      + 'Answer with JSON only (no prose, no code fence):\n{"name":"short title","loop":true,"speed":' + r1(sp) + ',"keys":[[x,y,z],[x,y,z],[x,y,z],[x,y,z]]}\n'
      + '- "keys": 4 to 40 points in the order they are passed. The engine draws one smooth curve through them, so give enough points for the shape to be unmistakable: a circle at least 8, a figure of eight at least 10 (two lobes that cross in the middle), a spiral at least 6 per turn with the height changing steadily, a zigzag one per corner.\n'
      + '- "loop": true = after the last point it curves back to the first and goes round again (circling, a circuit, a figure of eight, patrolling); false = it travels the path once and stays at the last point (going somewhere, landing, arriving).\n'
      + '- Metres. x grows east, z grows south, y is height above the ground (ground is y=0).\n'
      + (K.fly && K.ground ? '- It can both fly and move on the ground: y = 0 for the parts on the ground, y above 2 for the parts in the air.\n' : K.fly ? '- It flies: y is free. Keep at least 2 m above the ground except where it takes off or lands, and pass at least 2 m above or beside every obstacle.\n' : '- It moves on the ground: every y is 0. Keep 1 m clear of every obstacle and go round them, never through.\n')
      + '- "speed" in metres per second. Its usual speed is ' + r1(sp) + '; change it only if the request is about speed.\n'
      + '- Start at or near where it is now, unless the request says otherwise. Size the path to the thing and the place: something ' + r1(Math.max(o.size[0], o.size[2])) + ' m long needs curves at least ' + r1(Math.max(3, Math.max(o.size[0], o.size[2]) * 1.5)) + ' m in radius to look right.\n'
      + '- Do what the words say, literally: "around the clock tower" circles that tower (its centre is in the list below), "over the square" stays above it, "random" or "wherever it likes" is an irregular wandering loop with points at different distances, directions and heights, not a circle.\n\n'
      + '## Request (the player\'s words)\n' + (text || '(no words)') + '\n\n'
      + '## The thing that moves\n#' + o.id + ' ' + o.type + (o.name ? ' "' + o.name + '"' : '') + ': at [' + r1(o.x) + ',' + r1(o.y) + ',' + r1(o.z) + '], ' + r1(o.size[0]) + ' wide, ' + r1(o.size[1]) + ' tall, ' + r1(o.size[2]) + ' long, heading [' + Math.sin(o.rot).toFixed(2) + ',' + Math.cos(o.rot).toFixed(2) + '] (x,z)' + (o.motion && o.motion !== 'none' ? ', now moving (' + o.motion + (o.motion === 'fly' && o.ms && o.ms.R ? ': a circle of radius ' + r1(o.ms.R) + ' round ' + r1(o.ms.cx) + ',' + r1(o.ms.cz) + ' at height ' + r1(o.ms.H) : '') + ')' : ', standing still') + '\n\n'
      + '## The player\nat [' + r1(P.x) + ',' + r1(P.y) + ',' + r1(P.z) + '], looking along [' + fw.map((v) => v.toFixed(2)).join(',') + ']; the crosshair is on ' + aim + '. "Here", "over there", "in front of me" are measured from the player.\n\n'
      + '## What stands nearby (id type: centre x,z; footprint w x d in metres, turned by degrees; height)\n' + (obs.length ? obs.slice(0, 60).map(line).join('\n') : '(open ground)') + '\n\n'
      + '## Roads\n' + (roads.join('\n') || '(none)');
  }
  function readRoute(txt) {
    let s = String(txt || ''); const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a < 0 || b <= a) return null; s = s.slice(a, b + 1);
    let j = null; try { j = JSON.parse(s); } catch (e) { try { j = JSON.parse(s.replace(/,\s*([}\]])/g, '$1')); } catch (e2) { return null; } }
    if (!j || !Array.isArray(j.keys)) return null; const keys = [];
    for (const k of j.keys) { const v = Array.isArray(k) ? k : k && Array.isArray(k.pos) ? k.pos : null; if (!v || v.length < 3 || !v.every((q) => isFinite(+q))) continue; keys.push([clamp(+v[0], -700, 700), clamp(+v[1], 0, 260), clamp(+v[2], -700, 700)]); }
    if (keys.length < 2) return null;
    return { keys: keys.slice(0, 60), loop: j.loop !== false && j.loop !== 'false', speed: isFinite(+j.speed) && +j.speed > 0 ? clamp(+j.speed, 0.2, 80) : null, name: String(j.name || '').slice(0, 26) };
  }
  function layRoute(o, R, K) { // keys -> a dense, checked run of points
    let keys = R.keys.map((k) => k.slice()); const air = K.fly && keys.some((k) => k[1] > 1.2); let flat = false;
    if (!air) keys.forEach((k) => { k[1] = 0; }); if (!K.fly && R.keys.some((k) => k[1] > 1.2)) flat = true;
    const n = keys.length, loop = !!R.loop && n >= 3, at = (i) => (loop ? keys[((i % n) + n) % n] : keys[clamp(i, 0, n - 1)]), S = [], segs = loop ? n : n - 1;
    let total = 0; for (let i = 0; i < segs; i++) total += Math.hypot(at(i + 1)[0] - at(i)[0], at(i + 1)[1] - at(i)[1], at(i + 1)[2] - at(i)[2]);
    const stepLen = Math.max(0.5, total / 420);
    for (let i = 0; i < segs; i++) { const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2), m = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]) / stepLen)); for (let q = 0; q < m; q++) { const u = q / m; S.push({ pos: [0, 1, 2].map((j) => cr(p0[j], p1[j], p2[j], p3[j], u)) }); } }
    S.push({ pos: (loop ? keys[0] : keys[n - 1]).slice() });
    let cx = 0, cz = 0, far = 0; for (const k of keys) { cx += k[0] / n; cz += k[2] / n; } for (const k of keys) far = Math.max(far, Math.hypot(k[0] - cx, k[2] - cz));
    const obs = obstaclesNear(cx, cz, Math.min(far + 25, 300), new Set([o.id])); for (const ob of obs) { const r = Math.max(o.size[0], o.size[2]) * 0.35; ob.m = clamp(ob.m + r, 0.6, 4); }
    const detours = fixPath(S, obs, { flat: !air, minY: air ? 0 : 0 }); if (!air) for (const s2 of S) s2.pos[1] = 0;
    return { pts: S.map((s2) => s2.pos.map((v) => +v.toFixed(2))), obs, detours, air, flat, loop };
  }
  function startRoute(o, R, L, K, note) {
    YX.pushUndo(); if (o.attach) YX.detach(o); if (o.motion === 'follow' && YX.unfollow) YX.unfollow(o);
    const sp = R.speed || (o.route && o.route.speed) || null;
    const was = o.motion === 'route' && o.ms && o.ms.cum ? o.ms.d / Math.max(1e-3, o.ms.cum[o.ms.cum.length - 1]) : null, from = [o.x, o.y, o.z];
    o.route = { pts: L.pts, loop: L.loop, name: R.name || '' }; if (sp) o.route.speed = sp; o.motion = 'route'; o.ms = null; o.flight = null; YX.initMotion(o);
    if (o.ms && o.ms.cum) { const tot = o.ms.cum[o.ms.cum.length - 1]; if (was != null && L.loop) o.ms.d = was * tot; const p0 = L.pts[0], gap = Math.hypot(from[0] - p0[0], from[1] - p0[1], from[2] - p0[2]); if (was != null || gap > 0.8) o.ms.join = { from, t: 0, dur: clamp(gap / Math.max(0.5, sp || o.speed || K.d.speed || 2), 0.6, 5) }; } // it is not snatched to the start of a new path: it eases over to it from where it is
    if (o.type === 'person' && o.params.pose !== 'walk') { o.params.pose = 'walk'; YX.rebuild(o); } if (o.type === 'bird' && L.air && o.params.pose !== 'fly') { o.params.pose = 'fly'; YX.rebuild(o); }
    YX.markDirty(); W.focusId = o.id;
    let len = 0; for (let i = 1; i < L.pts.length; i++) len += Math.hypot(L.pts[i][0] - L.pts[i - 1][0], L.pts[i][1] - L.pts[i - 1][1], L.pts[i][2] - L.pts[i - 1][2]);
    const v = sp || o.speed || K.d.speed || 2;
    D.lastRoute = { id: o.id, keys: R.keys.map((k) => k.slice()), loop: !!R.loop, speed: sp, name: R.name || '', text: note && note.note != null ? (D.lastRoute || {}).text || '' : (note || {}).text || '', notes: note && note.note ? ((D.lastRoute && D.lastRoute.id === o.id && D.lastRoute.notes) || []).concat(note.note).slice(-6) : [], at: performance.now() };
    showPlan(R.name || T('路线', 'Path'), L.pts.map((p) => ({ x: p[0], z: p[2] })), null, L.obs, o, len / v); showTools('route'); hideCard(16000);
    return { len, v };
  }
  D.routeFresh = () => { const L = D.lastRoute, o = L ? W.objs.get(L.id) : null; return !!L && !!o && !o.dead && o.motion === 'route' && performance.now() - L.at < FRESH; };
  const routeWord = (t) => String(t || '').toLowerCase().replace(/\b(?:bigger|larger|wider|more room)\b/g, 'farther').replace(/\b(?:smaller|tighter)\b/g, 'closer').replace(/大一?点|大些|再大|大一圈/g, '远一点').replace(/小一?点|小些|再小|小一圈/g, '近一点');
  D.routeNote = (t) => readNote(routeWord(t));
  D.route = function (q) {
    const say = (t) => { if (hooks.toast) hooks.toast(t); else if (hooks.live) hooks.live(t); };
    const rev = q.revise != null, Lr = D.lastRoute, o = q.obj || (rev && Lr ? W.objs.get(Lr.id) : null), lab = (x) => YX.lab(x);
    if (!o || o.dead) return { ok: false, msg: rev ? T('还没有可以修改的路线。先让一个会动的东西按路线走，比如“让它在广场上空飞 8 字”', 'There is no path to change yet. Give something a path first, such as “make it fly a figure of eight over the square”') : T('没找到要走这条路线的对象', 'Nothing there to send along a path') };
    const K = kindOf(o);
    if (!K.fly && !K.ground) return { ok: false, msg: lab(o) + T(' 自己不会动（真实物理已开启，可在设置里关闭）', ' does not move by itself (realistic physics is on; turn it off in Settings)') };
    if (q.stop) { if (o.motion !== 'route') return { ok: false, msg: lab(o) + T(' 现在没有在走路线', ' is not on a path') }; YX.pushUndo(); const air = o.y > 1.2; o.route = null; o.motion = air ? 'fly' : 'none'; o.ms = null; o.bank = 0; YX.initMotion(o); if (!air && o.type === 'person' && o.params.pose === 'walk') { o.params.pose = 'stand'; YX.rebuild(o); } YX.markDirty(); hideCard(0); return { ok: true, msg: lab(o) + (air ? T(' 不走路线了，回到原地盘旋', ' left its path and circles where it is') : T(' 停下了', ' stopped')) }; }
    const note = String(rev ? q.revise : q.text || '').trim();
    const land = (R, by, extra) => { const L = layRoute(o, R, K), r = startRoute(o, R, L, K, rev ? { note } : { text: note }); return (R.name || T('路线', 'Path')) + T('：', ': ') + (extra && extra.length ? extra.join(T('，', ', ')) + T('；', '; ') : '') + T('一圈 ', '') + Math.round(r.len) + ' m' + (L.loop ? T('，循环', ', round and round') : T('，走一遍', ', once')) + T('，', ', ') + r1(r.v) + ' m/s' + (L.detours ? T('（已绕开挡路的东西）', ' (taken round what was in the way)') : '') + (L.flat ? T('（它不会飞，路线落到了地面上）', ' (it does not fly, so the path is on the ground)') : ''); };
    if (rev) { if (!Lr || Lr.id !== o.id) return { ok: false, msg: T('还没有可以修改的路线', 'There is no path to change yet') };
      const ch = D.plain(routeWord(note)) || !M.sample ? D.routeNote(note) : null;
      if (ch) { const R = { keys: Lr.keys.map((k) => k.slice()), loop: Lr.loop, speed: Lr.speed, name: Lr.name }, n = R.keys.length, said = []; let cx = 0, cz = 0, r0 = 0, y0 = 0; for (const k of R.keys) { cx += k[0] / n; cz += k[2] / n; y0 += k[1] / n; } for (const k of R.keys) r0 += Math.hypot(k[0] - cx, k[2] - cz) / n;
        if (ch.dist) { const k = clamp(ch.dist.to != null ? ch.dist.to / Math.max(0.5, r0) : ch.dist.k, 0.2, 8); for (const p of R.keys) { p[0] = cx + (p[0] - cx) * k; p[2] = cz + (p[2] - cz) * k; } said.push(T('大小 ', 'size ') + r1(r0 * 2) + ' → ' + r1(r0 * 2 * k) + ' m'); }
        if (ch.up) { if (!K.fly) said.push(T('它在地面上走，没有高度可调', 'it travels on the ground, so there is no height to change')); else { const dy = ch.up.to != null ? ch.up.to - y0 : ch.up.k * Math.max(2, y0 * 0.45); for (const p of R.keys) p[1] = clamp(p[1] + dy, 0, 260); said.push(T('高度 ', 'height ') + r1(y0) + ' → ' + r1(Math.max(0, y0 + dy)) + ' m'); } }
        if (ch.dur) { const v0 = R.speed || o.speed || K.d.speed || 2; R.speed = clamp(v0 / ch.dur, 0.2, 80); said.push(T('速度 ', 'speed ') + r1(v0) + ' → ' + r1(R.speed) + ' m/s'); }
        if (ch.mirror || ch.reverse) { R.keys.reverse(); said.push(T('反方向', 'the other way round')); }
        if (!said.length) return { ok: false, msg: T('这条路线上没有这一项可改', 'That is not something this path has') };
        return { ok: true, msg: land(R, 'note', said) }; }
    }
    if (!M.sample) return YX.needAI('path'), { ok: false, msg: T('设计路线需要 AI，目前没有连接', 'Designing a path needs the AI, which is not connected') };
    if (D.busy) return { ok: false, msg: T('上一个设计还没完成', 'The previous design is still being made') };
    D.busy = true; showCard(rev ? T('正在修改路线…', 'Changing the path…') : T('正在设计路线…', 'Designing the path…'), '');
    const obs0 = obstaclesNear(o.x, o.z, 90, new Set([o.id])).sort((a, b) => Math.hypot(a.x - o.x, a.z - o.z) - Math.hypot(b.x - o.x, b.z - o.z));
    let ask = routeBrief(rev ? Lr.text : note, o, obs0, K);
    if (rev) ask += '\n\n## The path as it stands (your earlier answer; it is travelling it now)\n' + JSON.stringify({ name: Lr.name, loop: Lr.loop, speed: Lr.speed, keys: Lr.keys.map((k) => k.map(r1)) }) + ((Lr.notes || []).length ? '\n\n## Notes the player already gave on it (already applied)\n- ' + Lr.notes.join('\n- ') : '') + '\n\n## The player\'s note on it now\n' + note + '\n\nThis is a correction, not a new request. Answer with the whole path again in the same JSON form, changed ONLY in what the note is about, and by a clearly visible amount.';
    const t0 = performance.now(), ctl = typeof AbortController === 'function' ? new AbortController() : null, timer = setTimeout(() => { if (ctl) ctl.abort(); }, 30000);
    Promise.resolve().then(() => M.sample(ask, Object.assign({ modelTier: 'default', cache: false, task: 'shot-long' }, ctl ? { signal: ctl.signal } : null))).then((res) => {
      clearTimeout(timer); D.busy = false; const R = readRoute(res && res.text); if (!R || o.dead) throw new Error('no path');
      if (q.loop != null && !rev) R.loop = !!q.loop; if (q.speed != null && isFinite(+q.speed) && !rev) R.speed = clamp(+q.speed, 0.2, 80);
      say(lab(o) + T(' · ', ' · ') + land(R, 'ai') + T(' · 用时 ', ' · in ') + ((performance.now() - t0) / 1000).toFixed(1) + ' s');
    }).catch(() => { clearTimeout(timer); D.busy = false; hideCard(0); say(rev ? T('这次没改成，路线保持原样', 'That change did not come through; the path is as it was') : T('这条路线没设计出来，换个说法再试一次', 'That path could not be designed. Try saying it another way')); });
    return { ok: true, msg: rev ? T('正在按你的意见修改路线…', 'Changing the path as you said…') : T('正在为 ', 'Designing a path for ') + lab(o) + T(' 设计路线…', '…') };
  };
  YX.OPS.route = function (op, ctx) {
    const o = op.id != null || op.target != null ? ctx.one(op.id != null ? op.id : op.target) : null;
    if (op.revise != null) return D.route({ obj: o, revise: String(op.revise) });
    const t = o || (ctx.view.aimId != null ? W.objs.get(ctx.view.aimId) : null) || (ctx.view.focusId != null ? W.objs.get(ctx.view.focusId) : null);
    return D.route({ obj: t, text: String(op.design || op.text || ''), stop: !!op.stop, loop: op.loop, speed: op.speed });
  };
  D._test = { sampleKeys, fixPath, toTake, obstaclesNear, classicKeys, readPlan, brief, build, insideOb };
})();
