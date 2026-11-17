/* 言出法随 · ops: the operation executor (the "bytecode" every tier compiles to), undo, scene description, custom generators */
'use strict';
(function () {
  const YX = window.YX, W = YX.world, G = YX.GEN, DEG = YX.DEG, clamp = YX.clamp;
  YX.hooks = YX.hooks || {};
  const COLORS = { 红: '#c0392b', 大红: '#d1281f', 朱红: '#d8452e', 酒红: '#7b1e2b', 橙: '#e67e22', 橘: '#e67e22', 橘红: '#e2572b', 黄: '#f1c40f', 柠檬黄: '#f6e04a', 绿: '#4caf50', 深绿: '#2f6b4a', 墨绿: '#24523b', 浅绿: '#9bd18a', 草绿: '#6faa52', 青: '#2bb5a6', 蓝: '#2e6da4', 天蓝: '#6fb7e8', 深蓝: '#1f3a5f', 藏青: '#1f3a5f', 浅蓝: '#a9d3f2', 紫: '#8e44ad', 浅紫: '#c7a6e0', 粉: '#f29fc0', 粉红: '#f29fc0', 玫红: '#d6336c', 白: '#f7f5ef', 黑: '#1e1e1e', 灰: '#8a8f96', 深灰: '#4a4f55', 浅灰: '#c9ccd1', 棕: '#7a5230', 褐: '#7a5230', 咖啡: '#6b4a33', 米: '#efe3cf', 米白: '#f3ecdf', 奶油: '#f5ead2', 金: '#d4a72c', 金黄: '#e0b030', 银: '#c0c5ca', 彩虹: '#e85d75' };
  YX.COLORS = COLORS;
  const EN_COLORS = { 'dark green': '#2f6b4a', 'forest green': '#2f6b4a', 'light green': '#9bd18a', 'dark blue': '#1f3a5f', 'navy blue': '#1f3a5f', navy: '#1f3a5f', 'light blue': '#a9d3f2', 'baby blue': '#a9d3f2', 'sky blue': '#6fb7e8', 'dark red': '#7b1e2b', 'bright red': '#d1281f', 'hot pink': '#d6336c', 'light pink': '#f7c6d9', 'light gray': '#c9ccd1', 'light grey': '#c9ccd1', 'dark gray': '#4a4f55', 'dark grey': '#4a4f55', 'off white': '#f3ecdf', 'dark brown': '#5b3a22', 'light brown': '#b08a5f', red: '#c0392b', orange: '#e67e22', yellow: '#f1c40f', green: '#4caf50', teal: '#2bb5a6', turquoise: '#2bb5a6', cyan: '#2bb5a6', blue: '#2e6da4', purple: '#8e44ad', violet: '#8e44ad', pink: '#f29fc0', magenta: '#d6336c', maroon: '#7b1e2b', white: '#f7f5ef', black: '#1e1e1e', gray: '#8a8f96', grey: '#8a8f96', brown: '#7a5230', beige: '#efe3cf', cream: '#f5ead2', gold: '#d4a72c', golden: '#d4a72c', silver: '#c0c5ca', lime: '#9bd18a' };
  YX.EN_COLORS = EN_COLORS;
  YX.colorWord = function (s) { if (typeof s !== 'string') return null; let k = s.trim().toLowerCase().replace(/的$/, ''); if (EN_COLORS[k]) return EN_COLORS[k]; if (COLORS[k]) return COLORS[k]; k = k.replace(/颜?色/g, ''); return COLORS[k] || null; };
  YX.findType = function (s) {
    if (!s) return null; const k = String(s).trim().toLowerCase();
    if (G[k]) return { type: k, params: null };
    const slug = k.replace(/[\s-]+/g, '_'); if (G[slug]) return { type: slug, params: null };
    for (const n of YX.NOUNS) if (n.w === k) return { type: YX.nounPick(n), params: n.params, fam: n.fam || null };
    return null;
  };
  const T = YX.T, LB = (d) => YX.labelOf(d);
  const lab = (YX.lab = (o) => (o.name || LB(YX.defOf(o)) || o.type) + ' #' + o.id);
  const num = (v, d) => { v = +v; return isFinite(v) ? v : d; };
  const fmt = (v) => (typeof v === 'number' ? (Math.round(v * 10) / 10).toString() : String(v));

  /* ---------- target resolution ---------- */
  function nearestOfType(type, v, params, fam, strict) { // strict: only what the player can see right now (the thing a command changes); otherwise what is in sight is preferred // fam: the other types the same word can mean ("桌子": the café set outside, the plain table indoors)
    let best = null, bs = 1e9; const room = v.inside != null ? v.inside : null;
    for (const o of W.objs.values()) {
      if (o.dead || !(o.type === type || (fam && fam.includes(o.type)))) continue;
      if (params && o.type === type && !Object.keys(params).every((k) => String(o.params[k]) === String(params[k]))) continue;
      const ro = YX.roomOf(o); if (ro != null && ro !== room) continue; // inside some other building: out of sight
      const seen = YX.seen(o); if (strict && !seen) continue;
      const dx = o.x - v.x, dz = o.z - v.z, d = Math.hypot(dx, dz) || 0.01, ang = Math.acos(clamp((dx * v.fx + dz * v.fz) / d, -1, 1)) / DEG, sc = ang + d * 0.45 + (room != null && ro == null ? 400 : 0) + (seen ? 0 : 500); // indoors, what is in the room comes first
      if (sc < bs) { bs = sc; best = o; }
    }
    return best;
  }
  YX.nearestOfType = nearestOfType;
  /* what a type name or noun stands for when it SELECTS objects: singular or plural, either language.
     Presets carry creation defaults (a kid is 1.15 m tall); only their either-or parameters tell kinds apart. */
  const CLS_WORDS = [[/^(?:buildings?|structures?|建筑物?|楼房|房屋)$/, 'building'], [/^(?:vehicles?|车辆)$/, 'vehicle']];
  YX.kindOf = function (name) {
    const k = String(name == null ? '' : name).trim().toLowerCase().replace(/们$/, ''); if (!k) return null;
    if (/^(?:all|everything|things?|objects?|东西|物体|物件|对象|一切)$/.test(k)) return { any: true };
    for (const [re, c] of CLS_WORDS) if (re.test(k)) return { cls: c }; // "buildings" is every kind of building, not one type
    let ft = YX.findType(k);
    if (!ft) { const IRR = { people: 'person', men: 'man', women: 'woman', children: 'child' }, c = []; if (IRR[k]) c.push(IRR[k]); if (/ies$/.test(k)) c.push(k.slice(0, -3) + 'y'); if (/(?:ch|sh|s|x|z)es$/.test(k)) c.push(k.slice(0, -2)); if (/s$/.test(k) && !/ss$/.test(k)) c.push(k.slice(0, -1)); for (const w of c) if ((ft = YX.findType(w))) break; }
    if (ft) { const def = G[ft.type], ps = {}; for (const p in ft.params || {}) { const sp = def.params && def.params[p]; if (sp && (sp.opts || sp.bool)) ps[p] = ft.params[p]; } return { type: ft.type, params: ps }; }
    return ['building', 'vehicle', 'creature', 'nature', 'street', 'sky', 'prim', 'ground'].includes(k) ? { cls: k } : null;
  };
  function many(spec, ctx) {
    if (spec == null) return [];
    if (Array.isArray(spec)) { const out = []; for (const s of spec) for (const o of many(s, ctx)) if (!out.includes(o)) out.push(o); return out; }
    if (typeof spec === 'number') { const o = W.objs.get(spec); return o ? [o] : []; }
    if (typeof spec === 'string') {
      const s = spec.trim(); if (ctx.alias.has(s)) { const a = ctx.alias.get(s); return (Array.isArray(a) ? a : [a]).map((id) => W.objs.get(id)).filter(Boolean); }
      const m = s.match(/^#?\s*(\d+)$/); if (m) { const o = W.objs.get(+m[1]); return o ? [o] : []; }
      const k = s.toLowerCase();
      if (/^(aim|this|that|target|这个?|那个?|准星|眼前)$/.test(k)) { const o = W.objs.get(ctx.view.aimId) || W.objs.get(ctx.view.focusId); return o ? [o] : []; }
      if (/^(focus|it|last|它|他|她|刚才|上一个)$/.test(k)) { const o = W.objs.get(ctx.view.focusId) || W.objs.get(ctx.view.aimId); return o ? [o] : []; }
      if (/^(them|they|those|these|group|both|everyone|他们|她们|它们|牠们|这些|那些|大家|他俩|她俩|它俩)$/.test(k)) { const ppl = /^(everyone|他们|她们|大家|他俩|她俩)$/.test(k), cur = ctx.group.map((id) => W.objs.get(id)).filter(Boolean), g = cur.length > 1 ? cur : YX.groupNow(ppl); if (g.length) return g; const o = W.objs.get(ctx.view.focusId) || W.objs.get(ctx.view.aimId); return o ? [o] : []; }
      if (k === 'all' || k === '全部' || k === '所有' || k === 'everything') return Array.from(W.objs.values()).filter((o) => !o.dead);
      const nm = Array.from(W.objs.values()).filter((o) => o.name && o.name.toLowerCase() === k); if (nm.length) return nm;
      const am = k.match(/^(?:all|every|each)(?: single)?(?: of)?(?: the)? (.+)$/) || k.match(/^(?:所有|全部|每一?个?)的?(.+)$/);
      if (am && YX.kindOf(am[1])) return many({ type: am[1] }, ctx); // "all hills", "所有的山"
      const ft = YX.findType(k); if (ft) { const o = nearestOfType(ft.type, ctx.view, ft.params, ft.fam, !!ctx.strict); return o ? [o] : []; }
      if (YX.kindOf(k)) return many({ type: k }, ctx); // a plural ("trees") or a class ("buildings") means all of them
      return [];
    }
    if (typeof spec === 'object') {
      if (spec.id != null) return many(spec.id, ctx);
      let list = Array.from(W.objs.values()).filter((o) => !o.dead && o.type !== '__pending');
      if (spec.type) { const kd = YX.kindOf(spec.type), c = String(spec.type).toLowerCase(); list = list.filter((o) => (kd ? kd.any || (kd.cls ? (YX.defOf(o) || {}).cls === kd.cls : o.type === kd.type && Object.keys(kd.params).every((k) => String(o.params[k]) === String(kd.params[k]))) : (YX.defOf(o) || {}).cls === c)); }
      if (spec.cls) list = list.filter((o) => (YX.defOf(o) || {}).cls === spec.cls);
      if (spec.name) list = list.filter((o) => o.name && o.name.includes(spec.name));
      if (spec.params && typeof spec.params === 'object') list = list.filter((o) => Object.keys(spec.params).every((k) => String(o.params[k]).toLowerCase() === String(spec.params[k]).toLowerCase()));
      if (spec.on != null && /road|street|路|街/i.test(String(spec.on))) list = list.filter((o) => YX.onRoad(o) != null); // "the buildings on the road": whatever stands on a carriageway and should not
      if (isFinite(+spec.within)) list = list.filter((o) => Math.hypot(o.x - ctx.view.x, o.z - ctx.view.z) <= +spec.within);
      if (spec.except != null) { const ex = many(spec.except, ctx); list = list.filter((o) => !ex.includes(o)); }
      return list;
    }
    return [];
  }
  YX.newCtx = function (view) {
    const ctx = { view: view || YX.viewNow(), alias: new Map(), changed: [], group: [], undo: false, msgs: [] };
    ctx.many = (s) => many(s, ctx); ctx.one = (s) => many(s, ctx)[0] || null;
    return ctx;
  };
  YX.groupNow = (people) => { const a = (people && W.people.length ? W.people : W.group).map((id) => W.objs.get(id)).filter((o) => o && !o.dead); return a.length || !people ? a : W.group.map((id) => W.objs.get(id)).filter((o) => o && !o.dead); };
  YX.setGroup = function (ids) { ids = (ids || []).filter((id) => W.objs.has(id)); if (!ids.length) return; W.group = ids.slice(0, 600); const ppl = ids.filter((id) => (YX.defOf(W.objs.get(id)) || {}).cls === 'creature'); if (ppl.length) W.people = ppl.slice(0, 600); };
  const mark = (ctx, o) => { if (o && !ctx.group.includes(o.id)) ctx.group.push(o.id); };
  const later = (fn) => YX.tween(0.48, () => {}, { done: fn });
  const targets = (op, ctx) => { ctx.strict = true; try { return many(op.id != null ? op.id : op.ids != null ? op.ids : op.sel != null ? op.sel : op.target != null ? op.target : 'aim', ctx); } finally { ctx.strict = false; } }; // what a command changes, named by a word ("table"), must be in sight

  /* ---------- undo ---------- */
  const undoStack = [];
  YX.pushUndo = function () { undoStack.push(JSON.stringify(YX.serialize())); if (undoStack.length > 40) undoStack.shift(); };
  YX.undo = function () { const s = undoStack.pop(); if (!s) return false; YX.restore(JSON.parse(s), {}); YX.sfx('undo'); return true; };
  YX.undoDepth = () => undoStack.length;
  YX.peekUndo = () => undoStack[undoStack.length - 1] || null;
  YX.dropUndo = () => { undoStack.pop(); };
  const touch = (ctx) => { if (!ctx.undo) { YX.pushUndo(); ctx.undo = true; } };
  const done = (ctx, o) => { if (o) { ctx.changed.push(o); mark(ctx, o); W.focusId = o.id; ctx.view.focusId = o.id; } };

  /* ---------- semantic resize ---------- */
  const DIMN = { size: ['大小', 'size'], height: ['高度', 'height'], width: ['宽度', 'width'], depth: ['进深', 'depth'], length: ['长度', 'length'] }, dimN = (d) => T(DIMN[d][0], DIMN[d][1]);
  YX.resizeObj = function (o, dim, f) {
    const def = YX.defOf(o); f = clamp(num(f, 1.18), 0.05, 20);
    if (!DIMN[dim]) dim = 'size';
    let key = def && def.dims && def.dims[dim];
    if (dim === 'length' && !key && def && def.dims) key = def.dims.size === 'length' || def.dims.width === 'length' ? 'length' : def.dims.depth;
    if (key && def.params[key]) {
      const sp = def.params[key], v0 = o.params[key]; let v;
      if (sp.int) v = f > 1 ? (f <= 1.4 ? v0 + 1 : Math.max(v0 + 1, Math.round(v0 * f))) : f >= 0.72 ? v0 - 1 : Math.min(v0 - 1, Math.round(v0 * f));
      else v = Math.round(v0 * f * 100) / 100;
      v = clamp(v, sp.min != null ? sp.min : -1e9, sp.max != null ? sp.max : 1e9);
      if (v !== v0) { o.params[key] = v; YX.rebuild(o, { grow: true }); YX.markDirty(); let along = 0; if (o.type === 'road' && key === 'width') { YX.recomputeRoads(); along = YX.roadWidened(o, v0, v); } return lab(o) + ' ' + dimN(dim) + ' ' + fmt(v0) + '→' + fmt(v) + (key === 'floors' ? T(' 层', ' floors') : '') + (along ? T('，沿街的 ' + along + ' 个物体跟着' + (v > v0 ? '退后' : '靠近') + '了', ', and the ' + along + ' things along it moved ' + (v > v0 ? 'back' : 'in') + ' with the kerb') : ''); }
    }
    const s = o.s.slice();
    if (dim === 'size') { s[0] *= f; s[1] *= f; s[2] *= f; } else if (dim === 'height') s[1] *= f; else if (dim === 'width') s[0] *= f; else s[2] *= f;
    YX.scaleTo(o, s);
    return lab(o) + ' ' + dimN(dim) + ' ×' + fmt(f);
  };

  /* ---------- helpers for add ---------- */
  const sizeHint = {};
  function footOf(type, def, p) {
    if (def.foot) { const f = def.foot(p); return [f[0], f[1]]; }
    if (sizeHint[type]) return sizeHint[type];
    for (const o of W.objs.values()) if (o.type === type) { sizeHint[type] = [o.foot[0] / o.s[0], o.foot[1] / o.s[2]]; return sizeHint[type]; }
    return def.cls === 'creature' ? [0.6, 0.6] : [1.4, 1.4];
  }
  /* A new thing is born from its context: what nobody specified is taken from what it belongs with, before chance gets a say.
     - family: a child added with or next to an adult (or the other way round) has that person's skin and hair;
     - series: street and room furniture is made in runs, so a new piece matches the nearest one of its kind (same room indoors, same stretch of street outdoors). */
  function takeAfter(type, def, params, place, ctx, extra) {
    const g = Object.assign({}, params || {}), need = (k) => g[k] == null && def.params && def.params[k];
    try {
      if (def.family) { let kin = extra && extra.kin; if (!kin && place && typeof place === 'object' && place.near != null && place.near !== 'me') kin = ctx.one(place.near);
        const kd = kin && YX.defOf(kin); if (kd && kd.family && kin.params && (g.age || (def.params.age && def.params.age.d)) !== kin.params.age) for (const k of def.family) if (need(k) && kin.params[k] != null) g[k] = kin.params[k]; }
      if ((def.cls === 'furniture' || def.cls === 'street') && !(extra && extra.exact)) { const v = ctx.view, room = v && v.inside != null ? v.inside : null, ax = v ? v.aimPoint[0] : 0, az = v ? v.aimPoint[1] : 0; let best = null, bd = room != null ? 1e9 : 40;
        for (const o of W.objs.values()) { if (o.dead || o.type !== type || !o.params) continue; if (room != null ? YX.roomOf(o) !== room : YX.roomOf(o) != null) continue; const d = Math.hypot(o.x - ax, o.z - az); if (d < bd) { bd = d; best = o; } }
        if (best) for (const k in def.params) if (def.params[k].pick && need(k) && best.params[k] != null) g[k] = best.params[k]; }
    } catch (e) {}
    return g;
  }
  function spawnAt(type, params, place, ctx, extra) {
    extra = extra || {};
    const def = G[type], seed = extra.seed || ((Math.random() * 4294967295) >>> 0) || 1; if (!def) return null; // a type that does not exist (yet): nothing is made, and nothing breaks
    const p = YX.fillParams(def, takeAfter(type, def, params, place, ctx, extra), YX.rng(seed ^ 0x9e3779b9));
    const sc = extra.scale ? clamp(num(extra.scale, 1), 0.05, 100) : 1, f = footOf(type, def, p);
    const info = { def, type, params: p, fw: f[0] * sc, fd: f[1] * sc, fr: Math.max(0.2, Math.hypot(f[0], f[1]) * 0.42 * sc), noFree: extra.exact };
    let place2 = place;
    if (def.motion === 'drive' && place == null && YX.roads().length) place2 = { road: 'ahead', lane: Math.random() < 0.5 ? 'far' : 'near' };
    if (def.floats && place == null && YX.spaceOf) { let best = null, bd = 90; for (const o of W.objs.values()) { if (o.dead) continue; const sp = YX.spaceOf(o); if (!sp || !sp.water) continue; const d = Math.hypot(o.x - ctx.view.x, o.z - ctx.view.z); if (d < bd && (!YX.seen || YX.seen(o))) { bd = d; best = o; } } if (best) place2 = { in: '#' + best.id }; } // what floats goes on the water the player can see
    const pl = YX.resolvePlace(place2, ctx, info); if (pl.fail) return null; // no free ground for it
    const parent = pl.attach ? W.objs.get(pl.attach.to) : null;
    if (type === 'bird' && (!params || params.pose == null)) p.pose = parent ? 'perch' : pl.y > 1.5 || place == null ? 'fly' : 'perch';
    const rot = extra.rot != null && isFinite(+extra.rot) ? +extra.rot * DEG : pl.rot != null ? pl.rot : YX.faceRot(def, pl.x, pl.z, ctx.view);
    let y = pl.y || 0; if (type === 'bird' && p.pose === 'fly' && y < 2) y = def.alt * (0.6 + Math.random() * 0.6);
    const o = YX.spawn({ type, params: p, x: pl.x, z: pl.z, y, rot, seed, name: extra.name || '', tint: extra.tint || null, s: [sc, sc, sc] }, { animate: true, delay: extra.delay || 0, quiet: extra.quiet });
    if (!o) return null;
    if (parent) YX.attachTo(o, parent, pl.attach.anchor);
    else if (pl.floor != null && W.objs.get(pl.floor)) { YX.attachFloor(o, W.objs.get(pl.floor)); if (def.cls === 'creature' && def.motion !== 'fly' && (type !== 'person' || o.params.pose === 'walk') && extra.motion !== 'none') { o.motion = 'wander'; o.ms = {}; } } // in a room or on a deck: it stands on that floor, and what walks walks about in there
    else {
      let m = def.motion || 'none';
      if (type === 'bird') m = p.pose === 'fly' ? 'fly' : 'none';
      if (type === 'person') m = p.pose === 'walk' ? 'wander' : 'none';
      if (m === 'drive') { const nr = YX.nearestRoad(o.x, o.z); if (!nr || Math.abs(nr.lat) > nr.r.w / 2 + 0.5 || nr.dist > Math.abs(nr.lat) + 0.6) m = 'none'; }
      if (m === 'none' && y > 2.5 && def.cls === 'prim' && !YX.strict) m = 'hover'; // with realistic physics off, a shape asked for in the sky floats
      if (extra.motion && ['none', 'fly', 'drive', 'wander', 'drift', 'hover'].includes(extra.motion) && YX.canDo(o, extra.motion)) m = extra.motion;
      o.motion = m; if (extra.speed) o.speed = clamp(num(extra.speed, 2), 0, 60);
      YX.initMotion(o);
    }
    if (o.type === 'road') YX.recomputeRoads();
    mark(ctx, o);
    return o;
  }
  YX.spawnAt = spawnAt;
  function setColor(o, col) {
    const def = YX.defOf(o), hex = YX.normColor(YX.colorWord(col) || col, null);
    if (!hex) return false;
    const key = def.params.color ? 'color' : def.mainColor && def.params[def.mainColor] ? def.mainColor : null;
    if (key) { o.params[key] = hex; o.tint = null; } else o.tint = hex;
    return true;
  }

  /* ================= the op table ================= */
  const OPS = {};
  OPS.add = function (op, ctx) {
    if (/^__/.test(String(op.type || ''))) return { ok: false, msg: T('这不是一个能添加的东西', 'That is not something that can be added') }; // the engine's own placeholder names are not things
    const ft = YX.findType(op.type);
    if (!ft) { if (YX.hooks.invent && op.type) return OPS.invent(Object.assign({}, op, { label: op.label || String(op.type), brief: op.brief || String(op.type) }), ctx); return { ok: false, msg: T('不认识 “' + op.type + '”', 'No such thing in the catalog: “' + op.type + '”') }; }
    touch(ctx);
    const n = clamp(Math.round(num(op.count, 1)), 1, 40), params = Object.assign({}, ft.params, op.params && typeof op.params === 'object' ? op.params : null), isC = (o) => !!o && (YX.defOf(o) || {}).cls === 'creature';
    // company: "a child for this adult", "a dog with him": the newcomer stays at that character's side instead of wandering off
    let lead = op.with != null ? ctx.one(op.with) : null, place = op.place; if (!isC(lead) || G[ft.type].cls !== 'creature') lead = null;
    if (!lead && place && typeof place === 'object' && place.near != null && place.near !== 'me' && G[ft.type].cls === 'creature' && n <= 3 && op.motion == null && !(params.pose && params.pose !== 'walk')) { const t = ctx.one(place.near); if (t && t.type === 'person') { if (!t.attach && ['wander', 'goto', 'follow'].includes(t.motion)) lead = t; else if (ft.type === 'person' && params.pose == null) params.pose = 'stand'; } }
    if (lead && place == null) place = { near: '#' + lead.id, side: 'right', gap: 0.2 };
    if (ctx) ctx.aimPlace = null; // filled in by resolvePlace when the place is the crosshair
    let prev = null, first = null, afloat = null; const made = [];
    for (let i = 0; i < n; i++) {
      const o = spawnAt(ft.type, params, i === 0 || !prev ? place : afloat || { near: prev.id, side: 'any', gap: 0.6 }, ctx, { kin: lead, rot: op.rot, name: i === 0 ? op.name : '', scale: op.scale, motion: op.motion, speed: op.speed, delay: i * 0.07, tint: null });
      if (!o) continue;
      if (i === 0 && n > 1 && o.attach && G[ft.type].floats && YX.spaceOf) { const host = W.objs.get(o.attach.to), sp = host ? YX.spaceOf(host) : null; if (sp && sp.water) afloat = { in: '#' + host.id }; } // several ducks for a pond: each finds its own spot on that water, instead of queueing up behind the first and out onto the bank
      if (lead && !o.attach) { YX.follow(o, lead, { side: op.side }); mark(ctx, lead); } // the pair is "they" from now on
      else if (o.type === 'person' && o.params.pose === 'ride' && !o.attach) YX.mount(o);
      if (op.color != null) { if (setColor(o, op.color)) YX.rebuild(o); }
      if (i === 0) first = o; made.push(o.id);
      prev = o;
    }
    const ap = ctx && ctx.aimPlace; // placed at the crosshair: if it could not go exactly there, say how far it went and why
    if (!first) return { ok: false, msg: ap && ap.fail ? T('准星附近没有能放' + G[ft.type].label + '的空地' + (ap.road ? '（准星落在马路上）' : '') + '，换个空的地方再说一次', 'No free ground near the crosshair for ' + LB(G[ft.type]) + (ap.road ? ' (the crosshair is on the road)' : '') + '. Aim at an open spot and say it again') : T('放不下', 'No room for it') };
    const movedNote = ap && ap.moved != null && ap.moved > Math.max(2, (first.fr || 1) * 1.2) ? T('，准星处' + (ap.road ? '是马路' : '已经有东西') + '，往旁边挪了 ' + ap.moved.toFixed(0) + ' 米', ' · ' + ap.moved.toFixed(0) + ' m from the crosshair: ' + (ap.road ? 'that spot is on the road' : 'that spot is taken')) : '';
    if (op.id != null && typeof op.id === 'string') ctx.alias.set(op.id.trim(), made.length > 1 ? made : made[0]); if (op.as != null) ctx.alias.set(String(op.as).trim(), made.length > 1 ? made : made[0]);
    done(ctx, first); YX.sfx('add');
    return { ok: true, msg: T('添加 ', 'Added ') + (n > 1 ? n + T(' 个', ' × ') : '') + lab(first) + (made.length > 1 ? ' … #' + made[made.length - 1] : '') + (lead ? T('，跟在 ' + lab(lead) + ' 身边', ', staying beside ' + lab(lead)) : '') + movedNote, objs: [first] };
  };
  OPS.set = function (op, ctx) {
    const list = targets(op, ctx); if (!list.length) return { ok: false, msg: T('没找到要修改的对象', 'Nothing there to change') };
    const src = Object.assign({}, op.params && typeof op.params === 'object' ? op.params : null);
    for (const k in op) if (!['op', 'id', 'ids', 'sel', 'target', 'params'].includes(k)) src[k] = op[k];
    touch(ctx); const msgs = [];
    for (const o of list) {
      const def = YX.defOf(o), before = JSON.stringify(o.params) + (o.tint || '') + (o.name || ''), diffs = [];
      const given = {}, unknown = [], textKey = Object.keys(def.params).find((q) => def.params[q].text) || null;
      for (let k in src) {
        const v = src[k];
        if (!def.params[k] && textKey && /^(?:text|sign|signtext|sign_text|title|caption|words|lettering|writing|name)$/i.test(k)) k = textKey; // "text", "sign", "title": whatever is written on it
        if (def.params[k]) { given[k] = v; continue; } // the object's own parameter always wins over anything else a key could mean
        if (k === 'label' || k === 'nickname') { o.name = String(v).slice(0, 28); diffs.push(T('称呼 ', 'label ') + o.name); continue; }
        if (k === 'color' && !def.params.color) { if (setColor(o, v)) diffs.push(T('颜色', 'color')); }
        else if (k === 'tint') { o.tint = v ? YX.normColor(YX.colorWord(v) || v, null) : null; diffs.push(T('颜色', 'color')); }
        else if (k === 'name') { o.name = String(v).slice(0, 28); diffs.push(T('称呼 ', 'label ') + o.name); }
        else if (k === 'scale') { const f = clamp(num(v, 1), 0.02, 200); YX.scaleTo(o, [f, f, f]); diffs.push(T('缩放 ', 'scale ') + fmt(f)); }
        else if (k === 'speed') { o.speed = clamp(num(v, 2), 0, 80); diffs.push(T('速度 ', 'speed ') + fmt(o.speed)); }
        else if (k === 'lights' || k === 'light' || k === 'lit' || k === 'lamps') { // anything that glows (windows, lamps, signs) can be switched off, and on again
          const off = v === false || v === 0 || /^(?:off|out|false|no|0|dark|关|灭|熄)/i.test(String(v));
          if (!o.glows) diffs.push(T('它身上没有会亮的东西', 'it has nothing that lights up'));
          else { if ((o.lights === false) !== off) { o.lights = off ? false : null; YX.rebuild(o); YX.markDirty(); } diffs.push(off ? T('灯关了', 'lights off') : T('灯开了', 'lights on')); } }
        else if (k === 'flight' || k === 'flight_path' || k === 'path' || k === 'pattern') { // how something that flies gets about: round and round, or wherever it likes
          const f = /roam|random|wander|free|乱|随机|自由|随意|随便/i.test(String(v)) ? 'roam' : /circle|loop|ring|orbit|round|圈/i.test(String(v)) ? 'circle' : null;
          if (!f) diffs.push(T('飞行方式有两种：circle（绕圈）和 roam（随意飞）', 'flight is either circle or roam'));
          else if (o.motion !== 'fly' && !YX.canDo(o, 'fly')) diffs.push(T('它不会飞', 'it does not fly'));
          else { o.flight = f === 'roam' ? 'roam' : null; if (o.motion !== 'fly') { YX.detach(o); o.motion = 'fly'; o.ms = null; if (o.y < 2) o.y = 8; YX.initMotion(o); } else if (!o.flight) { o.ms = null; YX.initMotion(o); } diffs.push(f === 'roam' ? T('想往哪飞就往哪飞', 'now flies wherever it likes') : T('绕圈飞', 'now flies in circles')); } }
        else if (k === 'motion') { const m = String(v).toLowerCase(); if (['none', 'fly', 'drive', 'wander', 'drift', 'hover'].includes(m) && !YX.canDo(o, m) && def.custom && !def.ride && YX.hooks.judge && !(def.cant && def.cant[m])) { YX.hooks.judge(o, m); diffs.push(T('先想一想它能不能' + ({ fly: '飞', hover: '悬浮', drift: '飘', drive: '开', wander: '自己走' }[m]) + '…', 'checking whether it can ' + ({ fly: 'fly', hover: 'float', drift: 'drift', drive: 'drive', wander: 'walk' }[m]) + '…')); } /* what an invented thing is able to do was a guess made when it was built: ask before refusing */
          else if (['none', 'fly', 'drive', 'wander', 'drift', 'hover'].includes(m) && !YX.canDo(o, m)) { diffs.push(def.ride && m === 'drive' ? T('要有人骑才会走', 'only moves with someone riding it') : T('做不到“' + ({ fly: '飞', hover: '悬浮', drift: '飘', drive: '行驶', wander: '走动' }[m]) + '”（真实物理已开启，可在设置里关闭）', 'cannot ' + ({ fly: 'fly', hover: 'float', drift: 'drift', drive: 'drive', wander: 'walk' }[m]) + ' (realistic physics is on; turn it off in Settings)')); } else if ((m === 'wander' || m === 'none') && o.attach && (o.attach.anchor === 'floor' || o.attach.anchor === 'deck') && def.cls === 'creature') { o.motion = m; o.ms = m === 'wander' ? {} : null; if (o.type === 'person') o.params.pose = m === 'wander' ? 'walk' : 'stand'; diffs.push(m === 'wander' ? T('在里面走动', 'walking about in there') : T('停下', 'stopped')); } /* someone inside a room or on a deck stays in it */ else if (['none', 'fly', 'drive', 'wander', 'drift', 'hover'].includes(m)) { YX.detach(o); o.motion = m; o.ms = null; if (m === 'fly' && o.y < 2) o.y = 8; if ((m === 'hover' || m === 'drift') && o.y < 1.2) o.y = Math.max(2, o.size[1] * 0.5 + 1.5); if (m === 'none' && o.y > 0 && (def.cls === 'creature' || def.cls === 'vehicle')) o.y = 0; if (o.type === 'bird') o.params.pose = m === 'fly' ? 'fly' : 'perch'; if (o.type === 'person') o.params.pose = m === 'wander' ? 'walk' : 'stand'; YX.initMotion(o); let far = false; if (m === 'drive' && o.motion !== 'drive') { far = YX.joinRoad(o); if (!far) { diffs.push(T('附近没有路可以开', 'there is no road to drive on')); continue; } } o.bank = 0; YX.syncHolder(o); diffs.push(m === 'none' ? T('停下', 'stopped') : far ? T('开到最近的路上，出发', 'pulled out onto the nearest road') : m === 'drive' ? T('开起来了', 'driving') : T('动起来', 'moving')); } }
        else if (def.params[k]) given[k] = v;
        else unknown.push(k);
      }
      if (unknown.length) { const has = Object.keys(def.params).filter((q) => q[0] !== '_').join(', '); diffs.push(T('它没有“' + unknown.join('、') + '”这个属性（它有：' + has + '）', 'it has no property “' + unknown.join(', ') + '” (it has: ' + has + ')')); } // said, never silently dropped
      const p0 = o.params; o.params = YX.fillParams(def, given, null, p0);
      for (const k in given) if (String(p0[k]) !== String(o.params[k])) diffs.push(k + ' ' + fmt(p0[k]) + '→' + fmt(o.params[k]));
      if (given.pose != null && o.params.pose !== p0.pose) { if (o.type === 'bird') { if (o.params.pose === 'fly') { YX.detach(o); o.motion = 'fly'; o.ms = null; if (o.y < 2) o.y = 10; } else { o.motion = 'none'; o.ms = null; o.bank = 0; if (!o.attach) o.y = 0; } YX.initMotion(o); YX.syncHolder(o); } if (o.type === 'person') { if (o.motion === 'follow' && o.params.pose !== 'walk') YX.unfollow(o); if (o.motion !== 'follow') { o.motion = o.params.pose === 'walk' && (!o.attach || o.attach.anchor === 'floor' || o.attach.anchor === 'deck') ? 'wander' : 'none'; o.ms = null; YX.initMotion(o); } if (o.params.pose === 'ride' && !o.attach) YX.mount(o); } }
      if (before !== JSON.stringify(o.params) + (o.tint || '') + (o.name || '')) { YX.rebuild(o, { grow: true }); if (o.type === 'road') { YX.recomputeRoads(); if (+p0.width !== +o.params.width) { const along = YX.roadWidened(o, +p0.width, +o.params.width); if (along) diffs.push(T('沿街的 ' + along + ' 个物体跟着挪了', along + ' things along it moved with the kerb')); } } }
      if (diffs.length) { msgs.push(lab(o) + ' ' + diffs.slice(0, 3).join(T('，', ', '))); done(ctx, o); YX.fx.flash(o); later(() => YX.shove(o)); }
    }
    YX.markDirty(); YX.sfx('edit');
    return msgs.length ? { ok: true, msg: msgs.length > 2 ? msgs.length + T(' 个对象已修改', ' objects changed') : msgs.join(T('；', '; ')) } : { ok: false, msg: T('没有可改的参数', 'Nothing to change there') };
  };
  OPS.resize = function (op, ctx) {
    const list = targets(op, ctx); if (!list.length) return { ok: false, msg: T('没找到要调整的对象', 'Nothing there to resize') };
    touch(ctx); const msgs = [];
    for (const o of list) { msgs.push(YX.resizeObj(o, String(op.dim || 'size').toLowerCase(), num(op.factor, 1.18))); done(ctx, o); later(() => YX.shove(o)); }
    YX.sfx('edit');
    return { ok: true, msg: msgs.length > 2 ? msgs.length + T(' 个对象已调整', ' objects resized') : msgs.join(T('；', '; ')) };
  };
  OPS.scale = function (op, ctx) {
    const list = targets(op, ctx); if (!list.length) return { ok: false, msg: T('没找到对象', 'Nothing found') };
    touch(ctx);
    for (const o of list) { const by = Array.isArray(op.by) ? op.by.map((v) => num(v, 1)) : [num(op.by, 1), num(op.by, 1), num(op.by, 1)]; YX.scaleTo(o, [o.s[0] * by[0], o.s[1] * by[1], o.s[2] * by[2]]); done(ctx, o); later(() => YX.shove(o)); }
    YX.sfx('edit'); return { ok: true, msg: lab(list[0]) + T(' 已缩放', ' scaled') };
  };
  OPS.move = function (op, ctx) {
    const list = targets(op, ctx); if (!list.length) return { ok: false, msg: T('没找到要移动的对象', 'Nothing there to move') };
    touch(ctx); const v = ctx.view, place = op.place != null ? op.place : op.to, taken = []; let queue = 0, fell = false, parked = 0, joined = 0, cleared = 0, stuck = 0;
    for (const o of list) {
      const def = YX.defOf(o), veh = def.cls === 'vehicle' && (def.motion === 'drive' || o.motion === 'drive');
      if (o.motion === 'goto') { o.motion = 'none'; o.ms = null; }
      if (place === 'clear' || (place && typeof place === 'object' && place.clear)) { // off the road, onto the nearest free lot
        const f = YX.clearSpot(o); if (f) { YX.detach(o); YX.moveTo(o, f[0], f[1], 0, { instant: true }); YX.fx.ring(f[0], f[1], Math.max(1.5, o.fr * 1.3)); /* in place at once, so the next one sees this lot as taken */ if (def.face === 'road') YX.rotateTo(o, YX.faceRot(def, f[0], f[1], v)); cleared++; } else stuck++; done(ctx, o); continue; }
      if (place != null) {
        const pl = YX.resolvePlace(place, ctx, { def, type: o.type, params: o.params, fr: o.fr, fw: o.foot[0], fd: o.foot[1], self: o }); // moved furniture is put down the way it would be put in if (pl.fail) { stuck++; continue; }
        if (pl.attach) { const p = W.objs.get(pl.attach.to); if (p && p !== o) YX.attachTo(o, p, pl.attach.anchor); }
        else {
          let x = pl.x, z = pl.z; const rot = pl.rot;
          if (pl.lane) { x -= Math.sin(rot) * queue; z -= Math.cos(rot) * queue; }
          else for (let k = 1; k < 60 && taken.some((t) => Math.hypot(t[0] - x, t[1] - z) < t[2] + o.fr * 0.9); k++) { const a = k * 2.39996, rad = (o.fr * 1.1 + 0.4) * Math.sqrt(k); x = pl.x + Math.cos(a) * rad; z = pl.z + Math.sin(a) * rad; }
          taken.push([x, z, o.fr * 0.9]);
          YX.detach(o); YX.moveTo(o, x, z, pl.y != null && (pl.y > 0 || o.y > 0) ? pl.y : o.y); if (rot != null) YX.rotateTo(o, rot);
          if (pl.floor != null && W.objs.get(pl.floor)) { YX.attachFloor(o, W.objs.get(pl.floor), x, z, rot); done(ctx, o); continue; }
          if (veh) { if (pl.lane) { o.motion = 'drive'; o.ms = { road: pl.lane.road, lane: pl.lane.lane, t: pl.lane.t - pl.lane.lane * queue, v: 0 }; queue += o.foot[1] + 2; joined++; } else { YX.reDrive(o, x, z); if (o.motion === 'drive') joined++; else parked++; } }
          if (pl.y > 0.6 && YX.isHeavy(o)) fell = true;
        }
      } else if (op.by && typeof op.by === 'object') {
        const f = num(op.by.forward, 0), r = num(op.by.right, 0), u = num(op.by.up, 0);
        let x = o.x + v.fx * f + v.rx * r + num(op.by.dx, 0), z = o.z + v.fz * f + v.rz * r + num(op.by.dz, 0);
        const rb = o.attach && o.attach.anchor === 'floor' ? W.objs.get(o.attach.to) : null;
        if (rb && YX.roomClamp) { const q = YX.roomClamp(rb, x, z, Math.min(0.6, o.fr * 0.5)); YX.moveTo(o, q[0], q[1], o.y); YX.attachFloor(o, rb, q[0], q[1]); done(ctx, o); continue; } // furniture slides across its room's floor and stops at the walls
        YX.detach(o);
        if (!veh && (f || r || op.by.dx || op.by.dz)) { const fr = YX.freeNear(o, x, z, 14); x = fr[0]; z = fr[1]; }
        YX.moveTo(o, x, z, Math.max(0, o.y + u));
        if (veh) YX.reDrive(o, x, z);
        if (u > 0 && YX.isHeavy(o)) fell = true;
      }
      done(ctx, o);
    }
    YX.sfx('edit');
    return { ok: true, msg: lab(list[0]) + (list.length > 1 ? T(' 等 ' + list.length + ' 个', ' + ' + (list.length - 1) + ' more') : '') + T(' 已移动', ' moved') + (cleared ? T('，挪到了最近的空地', ', onto the nearest free ground') : '') + (stuck ? T('（' + stuck + ' 个没找到空地，留在原处）', ' (' + stuck + ' found no free ground and stayed put)') : '') + (joined ? T('，已并入车道', ', now in the lane') : parked ? T('，停在路外', ', parked off the road') : '') + (fell && W.env.gravity !== 0 ? T('（它不会飞，会落回地面）', ' (it cannot fly, so it drops back to the ground)') : '') };
  };
  OPS.rotate = function (op, ctx) {
    const list = targets(op, ctx); if (!list.length) return { ok: false, msg: T('没找到要旋转的对象', 'Nothing there to rotate') };
    touch(ctx); const v = ctx.view;
    for (const o of list) {
      let r = o.rot;
      if (op.face != null) { const f = String(op.face).toLowerCase(); if (f === 'me' || f === 'player' || f === '我') r = Math.atan2(v.x - o.x, v.z - o.z); else if (f === 'away') r = Math.atan2(o.x - v.x, o.z - v.z); else if (f === 'road') r = YX.faceRot({ face: 'road', cls: YX.defOf(o).cls }, o.x, o.z, v); else { const t = ctx.one(op.face); if (t) r = Math.atan2(t.x - o.x, t.z - o.z); } }
      else if (op.to != null) r = num(op.to, 0) * DEG; else r = o.rot - num(op.deg, 90) * DEG;
      YX.rotateTo(o, r); done(ctx, o);
    }
    YX.sfx('edit'); return { ok: true, msg: lab(list[0]) + T(' 已旋转', ' rotated') };
  };
  OPS.remove = function (op, ctx) {
    const list = targets(op, ctx).filter((o) => o.type !== '__pending'); if (!list.length) return { ok: false, msg: T('没找到要删除的对象', 'Nothing there to delete') };
    touch(ctx); const name = lab(list[0]);
    for (const o of list) YX.removeObj(o, { animate: true });
    if (list.some((o) => o.type === 'road')) YX.recomputeRoads();
    YX.sfx('remove'); return { ok: true, msg: T('删除 ', 'Deleted ') + (list.length > 1 ? list.length + T(' 个对象', ' objects') : name) };
  };
  OPS.delete = OPS.remove;
  /* turn an existing object into something else where it stands (never remove + add) */
  OPS.become = function (op, ctx) {
    const list = targets(op, ctx).filter((o) => o.type !== '__pending'); if (!list.length) return { ok: false, msg: T('没找到要改造的对象', 'Nothing there to transform') };
    const want = op.type != null ? op.type : op.to, ft = YX.findType(want) || YX.findType(op.label || '');
    if (!ft) { if (YX.hooks.invent && (want || op.label)) return OPS.invent(Object.assign({}, op, { op: 'invent', replace: list.map((o) => '#' + o.id), type: String(want || op.label), label: op.label || String(want), brief: op.brief || String(op.label || want) }), ctx); return { ok: false, msg: T('不认识 “' + want + '”', 'No such thing in the catalog: “' + want + '”') }; }
    touch(ctx); const def = G[ft.type], params = Object.assign({}, ft.params, op.params && typeof op.params === 'object' ? op.params : null), was = lab(list[0]);
    for (const o of list) {
      if (o.type === ft.type) { o.params = YX.fillParams(def, params, null, o.params); YX.rebuild(o, { grow: true }); }
      else YX.become(o, ft.type, params, { name: op.name != null ? String(op.name).slice(0, 20) : undefined });
      if (op.color != null && setColor(o, op.color)) YX.rebuild(o);
      done(ctx, o); YX.fx.flash(o, 0xffffff, 1); if (o.y < 3) YX.fx.ring(o.x, o.z, Math.max(1.4, o.fr * 1.5), 0xe0533a); later(() => YX.shove(o));
    }
    YX.sfx('born'); YX.markDirty();
    return { ok: true, msg: T(was + (list.length > 1 ? ' 等 ' + list.length + ' 个' : '') + ' 变成了' + LB(def), was + (list.length > 1 ? ' + ' + (list.length - 1) + ' more' : '') + ' → ' + LB(def)) };
  };
  OPS.transform = OPS.become; OPS.replace = OPS.become;
  /* make characters that already exist do something */
  const ACTS = { chat: { g: 'talk', face: 1 }, talk: { g: 'talk', face: 1 }, laugh: { g: 'laugh' }, cheer: { g: 'cheer' }, clap: { g: 'clap' }, wave: { g: 'wave' }, jump: { hop: 1 }, hop: { hop: 1 }, dance: { g: 'cheer', hop: 1 }, sit: { pose: 'sit' }, stand: { pose: 'stand', g: 'none' }, squat: { pose: 'squat' }, kneel: { pose: 'kneel' }, lie: { pose: 'lie' }, walk: { pose: 'walk', g: 'none' }, stroll: { pose: 'walk', g: 'none' }, stop: { pose: 'stand', g: 'none' }, idle: { g: 'none' }, none: { g: 'none' }, ride: { ride: 1 }, cycle: { ride: 1 } };
  const ACT_ZH = { chat: '聊天', talk: '聊天', laugh: '笑', cheer: '欢呼', clap: '鼓掌', wave: '挥手', jump: '跳', hop: '跳', dance: '跳舞', sit: '坐下', stand: '站好', squat: '蹲下', kneel: '跪下', lie: '躺下', walk: '走动', stroll: '散步', stop: '停下', idle: '放松', none: '放松', ride: '骑车', cycle: '骑车' };
  YX.ACTS = ACTS;
  OPS.act = function (op, ctx) {
    const list = targets(op, ctx).filter((o) => (YX.defOf(o) || {}).cls === 'creature'); if (!list.length) return { ok: false, msg: T('没找到能做动作的角色', 'No character there to direct') };
    let acts = op.activity != null ? op.activity : op.act != null ? op.act : op.do;
    acts = (Array.isArray(acts) ? acts : String(acts == null ? '' : acts).split(/[\s,，、+&|/]+/)).map((a) => String(a).toLowerCase().trim()).filter((a) => ACTS[a]);
    if (!acts.length) return { ok: false, msg: T('不认识这个动作', 'Unknown activity') };
    touch(ctx);
    let gs = acts.map((a) => ACTS[a].g).filter((g) => g != null); const key = list.map((o) => o.id).join(',');
    if (gs.length && !gs.includes('none') && ctx.gest && ctx.gest.key === key) gs = ctx.gest.list.concat(gs.filter((g) => !ctx.gest.list.includes(g))); // "chat, laugh" said as two clauses: share the gestures out instead of overwriting
    if (gs.length) ctx.gest = { key, list: gs.filter((g) => g !== 'none') };
    const pose = acts.map((a) => ACTS[a].pose).filter(Boolean).pop() || null, hop = acts.some((a) => ACTS[a].hop), face = acts.some((a) => ACTS[a].face) && list.length > 1;
    let cx = 0, cz = 0; for (const o of list) { cx += o.x / list.length; cz += o.z / list.length; }
    list.forEach((o, i) => {
      if (o.motion === 'goto') { o.motion = 'none'; o.ms = null; }
      if (acts.some((a) => ACTS[a].ride)) { if (o.type === 'person') { if (o.motion === 'follow') YX.unfollow(o); YX.mount(o); } done(ctx, o); return; }
      if (o.type === 'person') {
        const before = JSON.stringify(o.params), fol = o.motion === 'follow';
        if (pose) { if (o.attach && pose !== 'sit' && pose !== 'lie') { YX.detach(o); o.y = 0; YX.syncHolder(o); later(() => YX.settle(o)); } o.params.pose = pose; }
        if (gs.length) { o.params.gesture = gs[i % gs.length]; if (o.params.gesture !== 'none' && o.params.pose === 'walk' && !fol) o.params.pose = 'stand'; }
        if (before !== JSON.stringify(o.params)) { if (fol && o.params.pose !== 'walk') YX.unfollow(o); YX.rebuild(o); if (!o.attach && o.motion !== 'follow') { o.motion = o.params.pose === 'walk' ? 'wander' : 'none'; o.ms = null; YX.initMotion(o); } }
      } else if (!o.attach && acts.some((a) => a === 'stop' || a === 'sit' || a === 'stand' || a === 'lie')) { if (o.motion === 'follow') YX.unfollow(o); o.motion = 'none'; o.ms = null; }
      else if (!o.attach && acts.some((a) => a === 'walk' || a === 'stroll') && o.motion !== 'fly' && o.motion !== 'follow') { o.motion = 'wander'; o.ms = null; YX.initMotion(o); }
      if (face && !o.attach) YX.rotateTo(o, Math.atan2(cx - o.x, cz - o.z));
      if (hop) YX.hop(o, clamp(Math.round(num(op.times != null ? op.times : op.count, 3)), 1, 20));
      done(ctx, o);
    });
    YX.sfx('edit'); YX.markDirty();
    const names = acts.filter((a, i) => acts.indexOf(a) === i);
    return { ok: true, msg: lab(list[0]) + (list.length > 1 ? T(' 等 ' + list.length + ' 个', ' + ' + (list.length - 1) + ' more') : '') + T('：' + names.map((a) => ACT_ZH[a]).join('、'), ': ' + names.join(', ')) };
  };
  OPS.jump = (op, ctx) => OPS.act(Object.assign({}, op, { activity: 'jump' }), ctx);
  /* existing characters walk together: the follower keeps to the other's side (hand in hand for two people) */
  OPS.follow = function (op, ctx) {
    const isC = (o) => !!o && (YX.defOf(o) || {}).cls === 'creature', list = targets(op, ctx).filter(isC); if (!list.length) return { ok: false, msg: T('没找到要跟随的角色', 'No character there to follow anyone') };
    const tg = op.target !== undefined ? op.target : op.lead !== undefined ? op.lead : op.with;
    touch(ctx);
    if (tg === null || tg === false || op.stop === true || /^(?:none|stop|off|nobody|null)$/i.test(String(tg))) { for (const o of list) { if (o.motion === 'follow') { YX.unfollow(o); if (o.type === 'person' && o.params.pose === 'walk') { o.motion = 'wander'; YX.initMotion(o); } } done(ctx, o); } return { ok: true, msg: lab(list[0]) + T(' 不再跟着了', ' is on their own again') }; }
    const lead = ctx.one(tg); if (!isC(lead)) return { ok: false, msg: T('没找到要跟着的对象', 'Nobody there to walk with') };
    let n = 0; for (const o of list) if (o !== lead && YX.follow(o, lead, { side: op.side, gap: op.gap, hold: op.hold })) { n++; done(ctx, o); }
    if (!n) return { ok: false, msg: T('没法跟着自己', 'A character cannot follow itself') };
    YX.sfx('edit');
    return { ok: true, msg: lab(list[0]) + (n > 1 ? T(' 等 ' + n + ' 个', ' + ' + (n - 1) + ' more') : '') + T(' 跟在 ' + lab(lead) + ' 身边', ' now walks with ' + lab(lead)) };
  };
  OPS.accompany = OPS.follow;
  OPS.clone = function (op, ctx) {
    const src = targets(op, ctx)[0]; if (!src) return { ok: false, msg: T('没找到要复制的对象', 'Nothing there to copy') };
    if (src.type === '__pending') return YX.hooks.invent ? YX.hooks.invent({ type: src.wantType || src.name, label: src.name, count: op.count, place: op.place != null ? op.place : { near: '#' + src.id, side: 'any', gap: 1 } }, ctx) : { ok: false, msg: T('它还在生成中', 'It is still being built') }; // more of something that is not finished: more places for it, filled when it is
    touch(ctx); const n = clamp(Math.round(num(op.count, 1)), 1, 40); let prev = src, last = null;
    for (let i = 0; i < n; i++) {
      const o = spawnAt(src.type, JSON.parse(JSON.stringify(src.params)), i === 0 && op.place != null ? op.place : { near: prev.id, side: 'any', gap: 0.8 }, ctx, { scale: src.s[0], delay: i * 0.07, seed: YX.defOf(src).cls === 'nature' ? 0 : src.seed, motion: src.motion });
      if (!o) continue; o.s = src.s.slice(); o.tint = src.tint; if (o.tint) YX.rebuild(o); YX.syncHolder(o); YX.measure(o); prev = o; last = o;
    }
    if (last) done(ctx, last); YX.sfx('add');
    return { ok: !!last, msg: T('复制 ', 'Cloned ') + lab(src) + ' ×' + n };
  };
  OPS.scatter = function (op, ctx) {
    const ft = YX.findType(op.type); if (!ft) return OPS.add(op, ctx);
    touch(ctx); const def = G[ft.type], n = clamp(Math.round(num(op.count, 10)), 1, 80), R = clamp(num(op.radius, 12), 1, 200);
    const c = YX.resolvePlace(op.place, ctx, { def, fr: 0.3, noFree: true }); let last = null, made = 0;
    const host = def.floats && op.place && typeof op.place === 'object' && op.place.in != null ? ctx.one(op.place.in) : null, pool = host && YX.spaceOf && (YX.spaceOf(host) || {}).water ? { in: '#' + host.id } : null; // a handful of ducks "in the pond" stay on that water
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * R;
      const o = spawnAt(ft.type, Object.assign({}, ft.params, op.params), pool || { at: [c.x + Math.cos(a) * d, c.z + Math.sin(a) * d], height: c.y > 1 ? c.y + (Math.random() - 0.5) * 6 : undefined }, ctx, { rot: Math.random() * 360, delay: i * 0.035, quiet: i > 6, scale: op.scale ? num(op.scale, 1) * (0.85 + Math.random() * 0.3) : def.cls === 'nature' ? 0.85 + Math.random() * 0.35 : 1 });
      if (o) { last = o; made++; }
    }
    if (last) done(ctx, last); YX.sfx('add');
    return { ok: made > 0, msg: T('撒下 ' + made + ' 个' + def.label, 'Scattered ' + made + ' × ' + LB(def)) };
  };
  OPS.row = function (op, ctx) {
    const ft = YX.findType(op.type); if (!ft) return OPS.add(op, ctx);
    touch(ctx); const def = G[ft.type], n = clamp(Math.round(num(op.count, 6)), 1, 80), sp = clamp(num(op.spacing, 8), 0.3, 80), v = ctx.view; let last = null, made = 0;
    const params = Object.assign({}, ft.params, op.params);
    if (String(op.along || '').toLowerCase() === 'road' || (op.place && op.place.along)) {
      const nr = YX.nearestRoad(v.x, v.z); if (!nr) return { ok: false, msg: T('附近没有路', 'No road nearby') };
      const side = String(op.side || 'both').toLowerCase(), sides = side === 'both' ? [1, -1] : side === 'far' || side === 'across' ? [-nr.side] : [nr.side];
      const off = nr.r.w / 2 + (def.cls === 'building' ? 2.6 + 1.2 + footOf(ft.type, def, YX.fillParams(def, params))[1] / 2 : 1.3);
      const per = Math.ceil(n / sides.length);
      for (const sd of sides) for (let i = 0; i < per && made < n; i++) {
        const t = clamp(nr.t + (i - (per - 1) / 2) * sp, -nr.r.hl + 1, nr.r.hl - 1), x = nr.r.x + nr.r.dx * t + nr.nx * sd * off, z = nr.r.z + nr.r.dz * t + nr.nz * sd * off;
        if (YX.isBlocked(x, z, 0.4, { roads: false })) continue;
        const o = spawnAt(ft.type, params, { at: [x, z], exact: true }, ctx, { delay: made * 0.05, quiet: made > 6, rot: def.face === 'road' ? (Math.atan2(-nr.nx * sd, -nr.nz * sd) / DEG) : undefined });
        if (o) { last = o; made++; }
      }
    } else {
      const c = YX.resolvePlace(op.place, ctx, { def, fr: 0.3, noFree: true }), dir = String(op.dir || 'right').toLowerCase(), dx = dir === 'forward' ? v.fx : v.rx, dz = dir === 'forward' ? v.fz : v.rz;
      for (let i = 0; i < n; i++) { const k = dir === 'forward' ? i : i - (n - 1) / 2; const o = spawnAt(ft.type, params, { at: [c.x + dx * k * sp, c.z + dz * k * sp] }, ctx, { delay: i * 0.05, quiet: i > 6 }); if (o) { last = o; made++; } }
    }
    if (last) done(ctx, last); YX.sfx('add');
    return { ok: made > 0, msg: T('排了 ' + made + ' 个' + def.label, 'Lined up ' + made + ' × ' + LB(def)) };
  };
  OPS.crowd = function (op, ctx) {
    touch(ctx); const n = clamp(Math.round(num(op.count, 8)), 1, 40), act = String(op.activity || 'chat').toLowerCase(), v = ctx.view, def = G.person;
    const c = YX.resolvePlace(op.place, ctx, { def, fr: Math.min(8, 1 + n * 0.25), fd: 3 }), tg = op.target != null ? ctx.one(op.target) : null;
    const tx = tg ? tg.x : c.x + v.fx * 6, tz = tg ? tg.z : c.z + v.fz * 6, pts = []; let last = null;
    const face = (x, z, fx, fz) => Math.atan2(fx - x, fz - z) / DEG;
    if (act === 'chat' || act === 'talk') { let i = 0, g = 0; while (i < n) { const k = Math.min(n - i, 2 + Math.floor(Math.random() * 3)), ga = g * 2.4, gr = g === 0 ? 0 : 2.2 + g * 0.9, gx = c.x + Math.cos(ga) * gr, gz = c.z + Math.sin(ga) * gr; for (let j = 0; j < k; j++) { const a = (j / k) * 6.283 + g, x = gx + Math.cos(a) * 0.75, z = gz + Math.sin(a) * 0.75; pts.push([x, z, face(x, z, gx, gz), j === 0 && Math.random() < 0.4 ? 'wave' : 'stand', 'none']); } i += k; g++; } }
    else if (act === 'watch' || act === 'audience') { const R0 = (tg ? Math.max(tg.foot[0], tg.foot[1]) / 2 : 0) + 3, base = Math.atan2(c.z - tz, c.x - tx); let i = 0, row = 0; while (i < n) { const R = R0 + row * 1.1, per = Math.max(3, Math.floor((R * 1.6) / 0.8)); for (let j = 0; j < per && i < n; j++, i++) { const a = base + (j - (per - 1) / 2) * (0.8 / R), x = tx + Math.cos(a) * R, z = tz + Math.sin(a) * R; pts.push([x, z, face(x, z, tx, tz), 'stand', 'none']); } row++; } }
    else if (act === 'queue' || act === 'line') { const dx = c.x - tx, dz = c.z - tz, l = Math.hypot(dx, dz) || 1; for (let i = 0; i < n; i++) { const x = c.x + (dx / l) * i * 0.85, z = c.z + (dz / l) * i * 0.85; pts.push([x, z, face(x, z, tx, tz), 'stand', 'none']); } }
    else for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * (1.5 + n * 0.35), x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d; pts.push([x, z, act === 'sit' || act === 'wave' ? face(x, z, tg ? tx : v.x, tg ? tz : v.z) : Math.random() * 360, act === 'sit' ? 'sit' : act === 'wave' ? 'wave' : act === 'squat' ? 'squat' : act === 'lie' ? 'lie' : act === 'stand' ? 'stand' : 'walk', act === 'play' || act === 'run' || act === 'walk' ? 'wander' : 'none']); }
    pts.forEach((p, i) => { const o = spawnAt('person', Object.assign({ pose: p[3], height: 1.55 + Math.random() * 0.3 }, op.params), { at: [p[0], p[1]], exact: true }, ctx, { rot: p[2], delay: i * 0.04, quiet: i > 5, motion: p[4], speed: act === 'play' || act === 'run' ? 3.4 : undefined }); if (o) last = o; });
    if (last) done(ctx, last); YX.sfx('add');
    return { ok: !!last, msg: T('群演 ' + n + ' 人 · ' + ({ chat: '聊天', talk: '聊天', watch: '围观', audience: '围观', queue: '排队', line: '排队', walk: '散步', play: '追逐', run: '奔跑', sit: '席地而坐', wave: '挥手', stand: '站立', squat: '蹲着', lie: '躺着' }[act] || act), 'Crowd of ' + n + ' · ' + ({ chat: 'chatting', talk: 'chatting', watch: 'watching', audience: 'watching', queue: 'queueing', line: 'queueing', walk: 'strolling', play: 'playing tag', run: 'running', sit: 'sitting', wave: 'waving', stand: 'standing', squat: 'squatting', lie: 'lying down' }[act] || act)) };
  };
  OPS.walk = function (op, ctx) {
    // "from": out of that building by its door. Whoever is named and is in there walks out; with nobody named, someone who is inside does, and if the house is empty a new person comes out of it
    const FB = op.from != null ? ctx.one(op.from) : null, fsp = FB && YX.spaceOf ? YX.spaceOf(FB) : null, inFB = (o) => !!o && !o.dead && YX.roomOf(o) === FB.id; let list, born = false;
    if (FB && fsp && fsp.enclosed) {
      list = (op.id != null ? targets(op, ctx) : []).filter((o) => (YX.defOf(o) || {}).cls === 'creature');
      if (!list.length || !list.some(inFB)) { const inside = Array.from(FB.kids).map((id) => W.objs.get(id)).filter((o) => inFB(o) && (YX.defOf(o) || {}).cls === 'creature' && o.attach && o.attach.anchor === 'floor');
        if (list.length) { /* the one named is already outside: an ordinary walk */ }
        else if (inside.length) list = [inside[0]];
        else { touch(ctx); const fy = FB.y + fsp.floor * FB.s[1], n = clamp(Math.round(num(op.count, 1)), 1, 4); for (let i = 0; i < n; i++) { const q = YX.spaceSpot(FB, clamp(fsp.doorX + (i - (n - 1) / 2) * 0.7, -fsp.hx + 0.4, fsp.hx - 0.4), fsp.hz - 1.1 - i * 0.5), o = spawnAt('person', Object.assign({ pose: 'stand' }, op.params), { at: [q[0], q[1]], exact: true }, ctx, { rot: FB.rot, quiet: true, motion: 'none' }); if (o) { YX.moveTo(o, q[0], q[1], fy); YX.attachFloor(o, FB, q[0], q[1], FB.rot); list.push(o); born = true; } } }
      }
    } else list = targets(op, ctx).filter((o) => (YX.defOf(o) || {}).cls === 'creature');
    if (!list.length) return { ok: false, msg: T('没找到能走动的角色', 'No character there to move') };
    touch(ctx); const place = op.to != null ? op.to : op.place;
    list.forEach((o, i) => {
      const def = YX.defOf(o), rid = YX.roomOf(o), RB = rid != null ? W.objs.get(rid) : null, rsp = RB && YX.spaceOf ? YX.spaceOf(RB) : null;
      const out = place == null && RB && rsp && rsp.enclosed ? YX.spaceSpot(RB, rsp.doorX + (i - (list.length - 1) / 2) * 1.1 + (o.seed % 7 - 3) * 0.12, rsp.hz + 5.5) : null; // told only to come out: a few steps into the open in front of the door
      const pl = out ? { x: out[0], z: out[1] } : YX.resolvePlace(place, ctx, { def, fr: 0.3, noFree: true, self: o });
      let tx = pl.x, tz = pl.z, sitOn = null, enter = null, via = null, y0 = 0;
      if (o.motion === 'goto' && o.ms && o.ms.via && o.ms.via.length && !o.ms.entered) { via = o.ms.via; y0 = o.y; if (o.ms.door != null) { via.door = o.ms.door; via.doorAt = o.ms.doorAt; } } // already on the way out through a door ("comes out and walks to the fountain"): the door first, then the new place
      else if (RB && rsp && rsp.enclosed) { const fy = RB.y + rsp.floor * RB.s[1]; y0 = fy; // indoors now: across the floor, and out by the door if the way leads outside
        if (pl.floor === RB.id && !pl.attach) via = [{ x: pl.x, z: pl.z, y: fy }];
        else { const a = YX.spaceSpot(RB, rsp.doorX, rsp.hz - 0.45), b = YX.spaceSpot(RB, rsp.doorX, rsp.hz + 1.5); via = [{ x: a[0], z: a[1], y: fy }, { x: b[0], z: b[1], y: 0 }]; via.door = RB.id; via.doorAt = YX.spaceSpot(RB, rsp.doorX, rsp.hz + 0.3); } }
      if (pl.floor != null) { const B = W.objs.get(pl.floor), sp = B ? YX.spaceOf(B) : null; if (B && sp) { enter = { id: B.id, x: pl.x, z: pl.z }; if (sp.enclosed) { const dp = YX.spaceSpot(B, sp.doorX, sp.hz + 1.6); tx = dp[0]; tz = dp[1]; } } } // a room is entered by its door; an open deck is simply walked onto
      if (pl.attach) { const p = W.objs.get(pl.attach.to); if (p) { sitOn = p.id; const a = p.anchors.door || null; if (a) { const c = Math.cos(p.rot), s = Math.sin(p.rot); tx = p.x + a[0] * c + a[2] * s; tz = p.z - a[0] * s + a[2] * c; sitOn = null; } else { const fr = Math.max(p.foot[0], p.foot[1]) / 2 + 0.5, dx = o.x - p.x, dz = o.z - p.z, l = Math.hypot(dx, dz) || 1; tx = p.x + (dx / l) * Math.min(fr, 1.2); tz = p.z + (dz / l) * Math.min(fr, 1.2); } } }
      else if (place && typeof place === 'object' && place.near != null) { const p = ctx.one(place.near); if (p && p.anchors && p.anchors.door) { const a = p.anchors.door, c = Math.cos(p.rot), s = Math.sin(p.rot); tx = p.x + a[0] * c + a[2] * s; tz = p.z - a[0] * s + a[2] * c; } }
      if (!enter) { tx += (i % 3 - 1) * 0.7 * (list.length > 1 ? 1 : 0); tz += Math.floor(i / 3) * 0.7; }
      YX.detach(o); if (via) { o.y = y0; YX.syncHolder(o); } else if (o.y > 0.01) { o.y = 0; YX.syncHolder(o); }
      if (o.type === 'person' && o.params.pose !== 'walk') { o.params.pose = 'walk'; YX.rebuild(o); }
      o.motion = 'goto'; o.ms = { tx, tz, wait: 0, run: !!op.run, then: 'none', pose: o.type === 'person' ? (op.pose && G.person.params.pose.opts.includes(op.pose) ? op.pose : 'stand') : null, sitOn, enter, via, entered: !!(via && via.length === 1 && enter) };
      if (via && via.door != null) { o.ms.door = via.door; o.ms.doorAt = via.doorAt; }
      if (via && via.length === 1 && enter) o.ms.tx = null; // staying in the same room: straight across the floor, then it belongs to the room again
      done(ctx, o);
    });
    if (FB && fsp && fsp.enclosed && list.some((o) => o.ms && o.ms.via && o.ms.via.length > 1)) return { ok: true, msg: (born ? T('一个新来的人', 'Someone new') : lab(list[0])) + T(' 从 ', ' is coming out of ') + lab(FB) + T(' 的门里走出来', ' by its door') };
    return { ok: true, msg: lab(list[0]) + (list.length > 1 ? T(' 等 ' + list.length + ' 个', ' + ' + (list.length - 1) + ' more') : '') + T(' 走过去', ' is walking over') };
  };
  OPS.env = function (op, ctx) { touch(ctx); const m = YX.setEnv(op); YX.sfx('env'); return m ? { ok: true, msg: m } : { ok: false, msg: T('没有可调整的环境参数', 'Nothing to change in the environment') }; };
  OPS.clay = function (op) { const on = op.on == null ? !YX.isClay() : !!op.on; YX.setClay(on); if (YX.hooks.ui) YX.hooks.ui(); return { ok: true, msg: on ? T('白模模式', 'Clay mode') : T('恢复材质', 'Materials restored') }; };
  OPS.clear = function (op, ctx) { touch(ctx); YX.clearWorld(); W.shots = []; YX.sfx('remove'); return { ok: true, msg: T('世界已清空', 'World cleared') }; };
  OPS.undo = function () { return YX.undo() ? { ok: true, msg: T('已撤销', 'Undone') } : { ok: false, msg: T('没有可撤销的操作', 'Nothing to undo') }; };
  OPS.say = function (op) { return { ok: true, say: String(op.text || '').slice(0, 120), msg: '' }; };
  OPS.goto = function (op, ctx) {
    const o = targets(op, ctx)[0]; if (!o) return { ok: false, msg: T('没找到要去的地方', 'Nowhere to go') };
    const P = W.player; let dx = P.x - o.x, dz = P.z - o.z; const l = Math.hypot(dx, dz) || 1, d = Math.max(o.foot[0], o.foot[1]) / 2 + Math.max(5, o.size[1] * 0.9); dx /= l; dz /= l;
    const nr = YX.defOf(o).face === 'road' ? { x: Math.sin(o.rot), z: Math.cos(o.rot) } : { x: dx, z: dz };
    const x = o.x + nr.x * d, z = o.z + nr.z * d, ty = o.y + o.size[1] * 0.5;
    YX.cineStart({ type: 'pose', dur: 1.3, to: { x, y: Math.max(1.7, o.y > 3 ? o.y : 1.7), z, yaw: Math.atan2(-(o.x - x), -(o.z - z)), pitch: Math.atan2(ty - Math.max(1.7, o.y > 3 ? o.y : 1.7), d) } });
    W.focusId = o.id; return { ok: true, msg: T('来到 ', 'At ') + lab(o) };
  };
  OPS.cam = function (op, ctx) { return YX.camOp ? YX.camOp(op, ctx) : { ok: false, msg: '' }; };
  OPS.reset = function () { if (!YX.hooks.resetTown) return { ok: false, msg: '' }; YX.hooks.resetTown(); return { ok: true, msg: T('已回到初始小镇', 'Back to the starter town') }; };
  OPS.shot = function (op, ctx) { return YX.shotOp ? YX.shotOp(op, ctx) : { ok: false, msg: '' }; };
  OPS.invent = function (op, ctx) { if (!YX.hooks.invent) return { ok: false, msg: T('当前无法生成新物体（AI 未连接）', 'Cannot build new objects: the AI is not connected') }; touch(ctx); return YX.hooks.invent(op, ctx); };
  OPS.plan = function (op, ctx) { if (!YX.hooks.plan) return { ok: false, msg: T('当前无法规划场景（AI 未连接）', 'Cannot plan a scene: the AI is not connected') }; return YX.hooks.plan(op, ctx); };
  YX.OPS = OPS;
  /* something that is still being built is not there yet to be changed. A command about it is not refused and must not break: it is kept, and carried out
     the moment the thing appears ("make it bigger", "turn it round", said while it is being written). "More of it" needs no waiting: see clone and invent. */
  const WAITS = { set: 1, resize: 1, move: 1, rotate: 1, walk: 1, act: 1, jump: 1, route: 1, follow: 1, accompany: 1, use: 1 }, NEEDS_AIM = { set: 1, resize: 1, move: 1, rotate: 1, act: 1, jump: 1, route: 1 };
  function notYet(op, ctx, name) {
    if (!WAITS[name]) return null; const spec = op.id != null ? op.id : op.ids != null ? op.ids : op.sel != null ? op.sel : op.target != null ? op.target : NEEDS_AIM[name] ? 'aim' : null; if (spec == null) return null;
    let list = []; try { list = many(spec, ctx).filter((x) => x && !x.dead); } catch (e) { return null; }
    return list.length && list.every((x) => x.type === '__pending') ? list : null;
  }
  YX.exec = function (op, ctx) {
    if (!op || typeof op !== 'object') return null;
    const name = String(op.op || '').toLowerCase(), fn = OPS[name];
    if (!fn) return { ok: false, msg: T('未知操作 ', 'Unknown operation ') + op.op };
    try {
      const wait = notYet(op, ctx, name);
      if (wait) { for (const p of wait) { const c = JSON.parse(JSON.stringify(op)); delete c.ids; delete c.sel; delete c.target; c.id = '#' + p.id; p.after = (p.after || []).concat([c]).slice(-8); } return { ok: true, pending: true, msg: T('「' + (wait[0].name || '它') + '」还在生成中，一出来就照做', '“' + (wait[0].name || 'It') + '” is still being built: this will be done the moment it appears') }; }
      return fn(op, ctx) || { ok: true, msg: '' };
    } catch (e) { console.warn('op failed', op, e); return { ok: false, msg: T('这一步没做成，什么都没有改动（内部错误：', 'That step did not work and nothing was changed (internal error: ') + String(e && e.message ? e.message : e).slice(0, 60) + T('）。换个说法再试一次', '). Try saying it another way') }; }
  };
  /* what was asked of a thing while it was being built, now that it is there */
  YX.afterBuilt = function (o) {
    if (!o || o.dead || !o.after || !o.after.length) return []; const q = o.after; o.after = null; const ctx = YX.newCtx(YX.viewNow()), msgs = [];
    for (const op of q) { const r = YX.exec(op, ctx); if (r && r.msg) msgs.push(r.msg); } return msgs;
  };

  /* ================= scene description + catalog (prompt context) ================= */
  function bearing(v, x, z) {
    const dx = x - v.x, dz = z - v.z, d = Math.hypot(dx, dz) || 0.01, f = (dx * v.fx + dz * v.fz) / d, r = (dx * v.rx + dz * v.rz) / d, a = Math.atan2(r, f) / DEG, aa = Math.abs(a), en = YX.lang === 'en', s = a >= 0 ? (en ? 'right' : '右') : (en ? 'left' : '左');
    return { d, a, txt: en ? (aa < 12 ? 'ahead ' : aa < 55 ? 'front-' + s + ' ' : aa < 125 ? s + ' ' : aa < 160 ? 'back-' + s + ' ' : 'behind ') : (aa < 12 ? '正前' : aa < 55 ? s + '前' : aa < 125 ? s + '侧' : aa < 160 ? s + '后' : '身后') };
  }
  YX.describe = function (v) {
    const rdObjs = []; for (const o of W.objs.values()) { const rid = YX.onRoad(o); if (rid != null) rdObjs.push([o, rid]); }
    const rdOf = new Map(rdObjs.map((q) => [q[0].id, q[1]]));
    const rows = [], grp = new Set(YX.groupNow(false).map((o) => o.id)), room = v.inside != null ? W.objs.get(v.inside) : null;
    for (const o of W.objs.values()) {
      if (o.dead) continue; const def = YX.defOf(o), b = bearing(v, o.x, o.z); if (b.d > 190) continue;
      const ro = YX.roomOf(o); if (ro != null && (!room || ro !== room.id)) continue; // what stands inside another building cannot be seen from here
      let sc = Math.abs(b.a) * 0.5 + b.d; if (o.id === v.aimId) sc = -1000; else if (o.id === v.focusId) sc = -900; else if (grp.has(o.id)) sc = -800 + b.d * 0.01; if (def.flat) sc += 60; if (def.cls === 'sky') sc += 40; if (room && sc > -700) sc += ro != null || o === room ? -500 : 300; // indoors the room and what is in it come first
      const seen = o.id === v.aimId || YX.seen(o); if (!seen && sc > -700) sc += 120; // what is in the picture comes first
      rows.push({ o, def, b, sc, ro, seen });
    }
    rows.sort((a, c) => a.sc - c.sc);
    const lines = [], rest = {};
    rows.forEach((r, i) => {
      const o = r.o, def = r.def;
      if (i >= 30) { rest[o.type] = (rest[o.type] || 0) + 1; return; }
      const ps = []; for (const k in def.params) if (k[0] !== '_' && def.params[k].text) ps.push(k + T('(上面的字)', '(text on it)') + '="' + o.params[k] + '"');
      const tn = ps.length; for (const k in def.params) { if (k[0] === '_') continue; const sp = def.params[k]; if (sp.text) continue; if (sp.color && k !== (def.mainColor || 'color')) continue; if (sp.color && !o.params[k]) continue; ps.push(k + '=' + fmt(o.params[k])); if (ps.length >= 5 + tn) break; }
      lines.push('#' + o.id + ' ' + o.type + (o.type === '__pending' ? T('(生成中:' + o.name + ')', '(being generated: ' + o.name + ')') : '') + (o.name ? ' "' + o.name + '"' : '') + ' ' + r.b.txt + Math.round(r.b.d) + 'm ' + o.size.map((s) => fmt(s)).join('x') + (r.ro != null ? T(' 室内', ' indoors') + (o.attach.anchor === 'floor' ? '' : T(' 在#' + o.attach.to + '上', ' on #' + o.attach.to)) : o.attach ? T(' 在#' + o.attach.to + '上', ' on #' + o.attach.to) : o.y > 2 ? T(' 空中' + Math.round(o.y) + 'm', ' in the air ' + Math.round(o.y) + 'm') : '') + (ps.length ? ' ' + ps.join(' ') : '') + (o.motion === 'follow' && o.ms ? T(' 跟着#', ' walks with #') + o.ms.lead : o.motion && o.motion !== 'none' && o.type !== 'road' ? ' ' + o.motion : '') + (() => { const sp = YX.spaceOf ? YX.spaceOf(o) : null; return sp ? (sp.enclosed ? T(' 可进入(有室内)', ' can be entered (room inside)') : sp.water ? T(' 水面(鸭子和船浮在上面,别的东西站不上去)', ' water (ducks and boats float on it; nothing else can stand on it)') : T(' 里面可站人', ' has standing room inside')) : '' + (o.type === 'person' && YX.talk && YX.talk.following && YX.talk.following(o) ? T(' 正跟着玩家走(让他停下: set motion none)', ' is following the player (to make them stop: set motion none)') : '') + (YX.usable && YX.usable(o) ? T(' 可以玩(人会爬上去再滑下来,用 use)', ' can be used (a person climbs it and slides down, over and over: op use)') : ''); })() + (() => { const st = YX.seatsOf(o); if (!st.length) return ''; const used = Array.from(o.kids).map((id) => W.objs.get(id)).filter((k) => k && k.attach && st.includes(k.attach.anchor)).length; return T(' 可坐' + st.length + '(空' + (st.length - used) + ')', ' seats ' + st.length + ' (' + (st.length - used) + ' free)'); })() + (r.seen ? '' : T(' (视野外)', ' (out of view)')) + (rdOf.has(o.id) ? T(' 占在路#' + rdOf.get(o.id) + '上', ' STANDING ON road #' + rdOf.get(o.id)) : '') + (o.id === v.aimId ? T(' ←准星', ' <-crosshair') : '') + (o.id === v.focusId ? T(' ←刚操作', ' <-last edited') : '') + (grp.has(o.id) ? T(' ←上一句', ' <-previous command') : ''));
    });
    const more = Object.keys(rest).map((k) => k + '×' + rest[k]).join(' ');
    const nr = YX.nearestRoad(v.x, v.z), E = W.env;
    const ci = ((Math.round(Math.atan2(v.fx, -v.fz) / (Math.PI / 4)) % 8) + 8) % 8;
    const head = YX.lang === 'en' ? 'Player: at (' + Math.round(v.x) + ',' + Math.round(v.z) + ') facing ' + ['north(-z)', 'north-east', 'east(+x)', 'south-east', 'south(+z)', 'south-west', 'west(-x)', 'north-west'][ci] + (nr ? '; nearest road #' + nr.r.o.id + ' is ' + Math.round(nr.dist) + 'm away, ' + fmt(nr.r.w) + 'm wide' : '; no road nearby') + '; time ' + YX.clock(E.time) + ', weather ' + E.weather + (W.shots.length ? '; ' + W.shots.length + ' saved shots' : '')
      : '玩家: 位置(' + Math.round(v.x) + ',' + Math.round(v.z) + ') 面朝' + ['北(-z)', '东北', '东(+x)', '东南', '南(+z)', '西南', '西(-x)', '西北'][ci] + (nr ? '；最近的路 #' + nr.r.o.id + ' 距离' + Math.round(nr.dist) + 'm 宽' + fmt(nr.r.w) + 'm' : '；附近没有路') + '；时间 ' + YX.clock(E.time) + ' 天气 ' + E.weather + (W.shots.length ? '；已存机位 ' + W.shots.length + ' 个' : '');
    const ap = v.aimPoint || [v.x, v.z], ra = YX.roadAhead(v), onRd = YX.roads().find((r) => { const f = YX.roadFrame(r, ap[0], ap[1]); return Math.abs(f[0]) <= r.hl && Math.abs(f[1]) <= r.w / 2; });
    const rds = YX.roads().map((r) => ({ r, d: (YX.nearestRoad(v.x, v.z) || {}).r === r ? 0 : Math.hypot(r.x - v.x, r.z - v.z) })).sort((a, c) => a.d - c.d).slice(0, 6).map((q) => { const r = q.r; return '#' + r.o.id + ' (' + Math.round(r.x - r.dx * r.hl) + ',' + Math.round(r.z - r.dz * r.hl) + ')→(' + Math.round(r.x + r.dx * r.hl) + ',' + Math.round(r.z + r.dz * r.hl) + ') ' + T('宽', 'w') + fmt(r.w); });
    const extra = T('准星落点 (' + Math.round(ap[0]) + ',' + Math.round(ap[1]) + ')' + (onRd ? ' 在路 #' + onRd.o.id + ' 上' : ' 不在路上') + (ra ? '；玩家眼前的路: #' + ra.r.o.id + (ra.d ? ' 约' + Math.round(ra.d) + 'm' : '') : '') + (rds.length ? '\n路: ' + rds.join('；') : '') + (grp.size ? '\n上一句涉及的对象（“他们/它们/这些”）: ' + Array.from(grp).slice(0, 24).map((i) => '#' + i).join(' ') : ''),
      'Crosshair meets the ground at (' + Math.round(ap[0]) + ',' + Math.round(ap[1]) + ')' + (onRd ? ', on road #' + onRd.o.id : ', not on a road') + (ra ? '; the road in front of the player: #' + ra.r.o.id + (ra.d ? ' about ' + Math.round(ra.d) + 'm away' : '') : '') + (rds.length ? '\nRoads: ' + rds.join('; ') : '') + (grp.size ? '\nObjects from the previous command ("they/them/those"): ' + Array.from(grp).slice(0, 24).map((i) => '#' + i).join(' ') : ''));
    const inTxt = room ? T('\n玩家在 #' + room.id + ' ' + room.type + ' 的室内。标“室内”的是这个房间里的东西：玩家说的桌子、沙发、椅子、架子、柜台等指的就是它们，用它们的 #ID。在这里新加的东西会放在房间地板上（默认在准星处，或用 near 指定挨着哪件）。', '\nThe player is INSIDE #' + room.id + ' ' + room.type + '. Objects marked "indoors" are in this room: when the player says table, sofa, chair, shelf, counter and so on they mean these, so use their #IDs. Anything added here is put on the room floor (at the crosshair by default, or next to a piece with "near").') : '';
    const rdTxt = rdObjs.length ? T('\n占在路上的物体（它们不该在路上；选中它们用 {"type":"building","on":"road"} 之类，或直接列 #ID）: ', '\nObjects standing on a road (they should not be; select them with {"type":"building","on":"road"} or list their #IDs): ') + rdObjs.slice(0, 24).map((q) => '#' + q[0].id + ' ' + q[0].type).join(', ') : '';
    return head + inTxt + rdTxt + '\n' + extra + '\n' + (lines.length ? lines.join('\n') : T('(周围没有物体)', '(nothing around)')) + (more ? T('\n更远处还有: ', '\nFarther away: ') + more : '');
  };
  YX.catalog = function () {
    const out = [];
    for (const t of Object.keys(G)) {
      const d = G[t], ps = [], cols = [];
      for (const k in d.params) { if (k[0] === '_') continue; const sp = d.params[k]; if (sp.color) { cols.push(k); continue; } if (sp.opts) ps.push(k + '=' + sp.opts.join('|')); else if (sp.bool) ps.push(k + '=' + sp.d); else if (sp.text) ps.push(k + '="' + sp.d + '"' + T('(写在它上面的字)', '(the words written on it)')); else ps.push(k + '=' + sp.d + '[' + sp.min + '-' + sp.max + ']'); }
      out.push(t + ' ' + LB(d) + (d.custom ? T('(自造)', '(custom)') : '') + ': ' + ps.join(' ') + (cols.length ? T(' 颜色:', ' colors:') + cols.join(',') : ''));
    }
    return out.join('\n');
  };

  /* ================= custom (model-written) generators, run in workers ================= */
  const BUILDER_SRC = YX.makeBuilder.toString();
  function workerSource(code) {
    return "'use strict';\ntry{self.fetch=undefined;self.XMLHttpRequest=undefined;self.WebSocket=undefined;self.importScripts=undefined;self.EventSource=undefined;}catch(e){}\nvar makeBuilder=" + BUILDER_SRC + ";\nfunction __gen(b,p,rand){\n" + code + "\n}\nself.onmessage=function(e){var d=e.data;try{var B=makeBuilder(d.seed,3200);__gen(B.b,d.params,B.rnd);self.postMessage({id:d.id,ok:true,root:B.root,anchors:B.anchors});}catch(err){self.postMessage({id:d.id,ok:false,err:String(err&&err.message||err)});}};\n";
  }
  let inlineSeq = 0; YX.__inl = {};
  function runInline(code, params, seed) { // fallback when workers are unavailable
    if (window.SW_HOST && window.SW_HOST.secret) return Promise.reject(new Error('this browser cannot start a Web Worker, and generated code is not run inside a page that holds an API key')); // in the page itself the code could reach the key: there it runs in a worker or not at all
    return new Promise((res, rej) => { const id = 'g' + ++inlineSeq, s = document.createElement('script'); s.textContent = 'YX.__inl["' + id + '"]=function(b,p,rand){"use strict";\n' + code + '\n};'; document.head.appendChild(s); s.remove(); const fn = YX.__inl[id]; delete YX.__inl[id]; if (!fn) return rej(new Error('syntax error')); try { const B = YX.makeBuilder(seed, 3200); fn(B.b, params, B.rnd); res({ root: B.root, anchors: B.anchors }); } catch (e) { rej(e); } });
  }
  let workersOk = typeof Worker !== 'undefined';
  /* one-shot evaluation (used for streaming previews and validation) */
  YX.tryCode = function (code, params, seed, timeout) {
    if (!workersOk) return runInline(code, params, seed);
    return new Promise((res, rej) => {
      let w, url, to;
      const fin = (f, v) => { clearTimeout(to); try { w && w.terminate(); } catch (e) {} if (url) URL.revokeObjectURL(url); f(v); };
      try { url = URL.createObjectURL(new Blob([workerSource(code)], { type: 'text/javascript' })); w = new Worker(url); } catch (e) { workersOk = false; return runInline(code, params, seed).then(res, rej); }
      to = setTimeout(() => fin(rej, new Error('timeout')), timeout || 2500);
      w.onmessage = (e) => (e.data.ok ? fin(res, { root: e.data.root, anchors: e.data.anchors }) : fin(rej, new Error(e.data.err)));
      w.onerror = (e) => { if (e && e.preventDefault) e.preventDefault(); fin(rej, new Error((e && e.message) || 'syntax error')); };
      w.postMessage({ id: 1, params, seed });
    });
  };
  function normMeta(meta) {
    const m = { name: String(meta.name || 'thing').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'thing', label: String(meta.label || meta.name || T('新物体', 'New object')).slice(0, 28), size: Array.isArray(meta.size) && meta.size.length >= 3 ? meta.size.slice(0, 3).map((v) => clamp(num(v, 2), 0.05, 400)) : [2, 2, 2], motion: ['none', 'fly', 'wander', 'drive', 'drift', 'hover'].includes(meta.motion) ? meta.motion : 'none', params: {}, dims: {} };
    const src = meta.params && typeof meta.params === 'object' ? meta.params : {};
    for (const k of Object.keys(src).slice(0, 10)) {
      if (!/^[a-zA-Z_]\w{0,20}$/.test(k) || k[0] === '_') continue; let sp = src[k]; if (sp === null || typeof sp !== 'object' || Array.isArray(sp)) sp = { d: sp }; const d = sp.d !== undefined ? sp.d : sp.default;
      if (typeof d === 'boolean') m.params[k] = { d, bool: 1 };
      else if (typeof d === 'number' && isFinite(d)) m.params[k] = { d, min: isFinite(+sp.min) ? +sp.min : d > 0 ? d / 8 : d - 10, max: isFinite(+sp.max) ? +sp.max : d > 0 ? d * 8 : d + 10, int: sp.int ? 1 : 0 };
      else if (typeof d === 'string' && Array.isArray(sp.opts) && sp.opts.length) m.params[k] = { d, opts: sp.opts.map(String).slice(0, 12) };
      else if (typeof d === 'string' && (YX.normColor(d, null) && /^#|^[a-z]+$/i.test(d))) m.params[k] = { d: YX.normColor(d, '#cccccc'), color: 1 };
      else if (typeof d === 'string') m.params[k] = { d: d.slice(0, 24), text: 1 };
    }
    const dm = meta.dims && typeof meta.dims === 'object' ? meta.dims : {};
    for (const k of ['size', 'height', 'width', 'depth']) if (typeof dm[k] === 'string' && m.params[dm[k]] && !m.params[dm[k]].color) m.dims[k] = dm[k];
    if (!m.dims.height && m.params.height && m.params.height.min != null) m.dims.height = 'height';
    if (!m.dims.size) for (const k of ['size', 'scale']) if (m.params[k] && m.params[k].min != null) { m.dims.size = k; break; }
    return m;
  }
  YX.normMeta = normMeta;
  YX.registerCustom = function (meta, code, silent) {
    const m = normMeta(meta), old = YX.custom[m.name];
    if (old && old.worker) try { old.worker.terminate(); } catch (e) {}
    if (G[m.name] && !G[m.name].custom) m.name = m.name + '_x';
    YX.custom[m.name] = { meta: m, code, cache: new Map(), worker: null, pend: new Map(), seq: 0, url: null };
    const sky = m.motion === 'fly' || m.motion === 'drift' || m.motion === 'hover';
    G[m.name] = { custom: true, label: m.label, cls: sky ? 'sky' : m.motion === 'wander' ? 'creature' : m.motion === 'drive' ? 'vehicle' : 'prim', solid: sky || m.motion === 'wander' || m.size[1] < 0.45 ? false : Math.max(m.size[0], m.size[2]) < 0.9 ? 'trunk' : 'box', /* a made-up object is as solid as a built-in one: nobody walks through a slide */ face: m.motion === 'drive' ? 'road' : 'me', motion: m.motion, alt: Math.max(8, m.size[1] * 2 + 6), speed: m.motion === 'fly' ? 6 : m.motion === 'drive' ? 6 : 1.4, block: !sky, params: m.params, dims: m.dims, mainColor: m.params.color ? 'color' : Object.keys(m.params).find((k) => m.params[k].color) || null, nouns: [m.label.toLowerCase(), m.name], foot: () => [m.size[0], m.size[2]] };
    YX.buildNouns();
    if (!silent) YX.markDirty();
    return m.name;
  };
  YX.reclass = function (name, motion) { // an invented type turns out to be a vehicle, a creature or a flyer after all
    const C = YX.custom[name]; if (!C || !['none', 'fly', 'wander', 'drive', 'drift', 'hover'].includes(motion)) return false;
    const cache = C.cache, worker = C.worker, url = C.url, pend = C.pend, seq = C.seq; C.worker = null; // the model itself does not change: keep its worker and its built shapes
    YX.registerCustom(Object.assign({}, C.meta, { motion }), C.code); Object.assign(YX.custom[name], { cache, worker, url, pend, seq });
    return true;
  };
  function getWorker(C) {
    if (C.worker) return C.worker;
    C.url = URL.createObjectURL(new Blob([workerSource(C.code)], { type: 'text/javascript' }));
    const w = (C.worker = new Worker(C.url));
    const failAll = (msg) => { for (const p of C.pend.values()) { clearTimeout(p.to); p.rej(new Error(msg)); } C.pend.clear(); try { w.terminate(); } catch (e) {} C.worker = null; };
    w.onmessage = (e) => { const p = C.pend.get(e.data.id); if (!p) return; C.pend.delete(e.data.id); clearTimeout(p.to); e.data.ok ? p.res({ root: e.data.root, anchors: e.data.anchors }) : p.rej(new Error(e.data.err)); };
    w.onerror = (e) => { if (e && e.preventDefault) e.preventDefault(); failAll((e && e.message) || 'worker error'); };
    C.failAll = failAll;
    return w;
  }
  function runCustom(C, params, seed, wait) {
    if (!workersOk) return runInline(C.code, params, seed);
    wait = wait || (C.worker ? 3000 : 8000); // a new worker first has to start up
    return new Promise((res, rej) => { let w; try { w = getWorker(C); } catch (e) { workersOk = false; return runInline(C.code, params, seed).then(res, rej); } const id = ++C.seq; const to = setTimeout(() => { if (C.pend.has(id)) C.failAll('timeout'); }, wait); C.pend.set(id, { res, rej, to }); w.postMessage({ id, params, seed }); })
      // a build that ran out of time while the page was busy (loading the world, rendering, other builds) gets one more go with much more time; one that still does not finish is given up, so code that never ends cannot hold up the world
      .catch((e) => { if (e && e.message === 'timeout' && wait < 15000) return runCustom(C, params, seed, 15000); throw e; });
  }
  YX.customBuild = function (o, opt, applyBuilt) {
    const C = YX.custom[o.type]; if (!C) return;
    const key = o.seed + '|' + JSON.stringify(o.params) + '|' + (o.name || ''), hit = C.cache.get(key);
    if (hit) return applyBuilt(o, hit, opt);
    if (!o.mesh) { const B = YX.makeBuilder(1), s = C.meta.size; B.b.box(s[0], s[1], s[2], '#e0533a', 0, 0, 0, { opacity: 0.1, emissive: '#e0533a' }); applyBuilt(o, { root: B.root, anchors: {} }, {}); o.ghost = true; }
    runCustom(C, o.params, o.seed).then((parts) => { if (C.cache.size > 80) C.cache.clear(); C.cache.set(key, parts); if (o.dead || YX.custom[o.type] !== C) return; if (key !== o.seed + '|' + JSON.stringify(o.params) + '|' + (o.name || '')) return; const g = o.ghost; o.ghost = false; applyBuilt(o, parts, g ? {} : opt); YX.syncHolder(o); })
      .catch((err) => { console.warn('custom build failed', o.type, err); if (YX.hooks.toast && !C.warned) { C.warned = true; YX.hooks.toast(T(C.meta.label + ' 重建失败：', 'Could not rebuild ' + C.meta.label + ': ') + err.message); } });
  };
})();
