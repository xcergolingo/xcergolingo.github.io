/* Spoken World — what a change does to the things around it.
   After a command the engine looks at what now stands where it physically cannot (for a start: in water it does not float on) and
   measures it. It does not decide what to do about it: that goes to the model, with the facts, the way a set dresser would be asked.
   Without the model, the thing is simply put on the bank. Whatever is done joins the same undo step as the command. */
(function () {
  'use strict';
  const YX = window.YX, W = YX.world, M = YX.mind, T = YX.T, hooks = YX.hooks;
  const KEEP = { pier: 1, bridge: 1, pond: 1, water: 1, road: 1, path: 1, plaza: 1, field: 1, hill: 1 };
  const inWater = (o, w) => { if (w.type === 'pond') return Math.hypot(o.x - w.x, o.z - w.z) < w.params.size * w.s[0] - 0.3; const c = Math.cos(w.rot), s = Math.sin(w.rot), dx = o.x - w.x, dz = o.z - w.z, lx = dx * c - dz * s, lz = dx * s + dz * c; return Math.abs(lx) < (w.params.width * w.s[0]) / 2 - 0.3 && Math.abs(lz) < (w.params.depth * w.s[2]) / 2 - 0.3; };
  function oddities() { // [{ o, w, why }]
    const waters = []; for (const o of W.objs.values()) if (!o.dead && (o.type === 'pond' || o.type === 'water')) waters.push(o);
    const out = []; if (!waters.length) return out;
    for (const o of W.objs.values()) {
      if (o.dead || o.attach || KEEP[o.type] || o.type === '__pending' || o.y > 1.2 || o === W.grabbed) continue; const d = YX.defOf(o); if (!d || d.floats || d.cls === 'sky' || d.cls === 'ground' || d.motion === 'fly' || (o.params && o.params._static)) continue;
      for (const w of waters) if (inWater(o, w)) { out.push({ o, w, why: T('站在 #' + w.id + ' 的水里', 'standing in the water of #' + w.id) }); break; }
      if (out.length >= 8) break;
    }
    return out;
  }
  const bank = (q, ctx) => YX.exec({ op: 'move', id: '#' + q.o.id, place: { near: '#' + q.w.id, side: 'any', gap: 0.8 } }, ctx);
  let busy = false, seq = 0;
  async function tidy(text, msgs) {
    if (busy) return; const odd = oddities(); if (!odd.length) return; busy = true;
    const ctx = YX.newCtx(YX.viewNow()); ctx.undo = true; // part of the command that caused it
    const e = { id: 'after' + (++seq), text: T('整理：', 'Tidying up after: ') + String(text).slice(0, 60), tier: 'quick', status: 'run', msgs: [], t0: performance.now(), ms: 0 }, log = () => { if (hooks.log) hooks.log(e); }, done = (st) => { e.status = st; e.ms = Math.round(performance.now() - e.t0); log(); busy = false; };
    const ids = new Set(odd.map((q) => q.o.id)), fallback = () => { let n = 0; for (const q of odd) { const r = bank(q, ctx); if (r && r.ok) n++; } e.msgs = [T(n + ' 样东西从水里挪到了岸边', n + ' thing' + (n === 1 ? '' : 's') + ' moved out of the water onto the bank')]; done('ok'); };
    if (!M.sample) return fallback();
    log();
    const lab = (o) => (o.name || YX.labelOf(YX.defOf(o)) || o.type) + ' #' + o.id, en = YX.lang === 'en';
    const prompt = (en ? 'You look after continuity in a small 3D world that a player changes by speaking. The player just said: "' + String(text).slice(0, 160) + '"\nWhat the engine did: ' + (msgs || []).join('; ').slice(0, 240) + '\nAs a result these things now stand where they physically cannot:\n' : '你负责一个 3D 小世界的连贯性，玩家靠说话改变它。玩家刚才说：“' + String(text).slice(0, 160) + '”\n引擎做了：' + (msgs || []).join('；').slice(0, 240) + '\n结果下面这些东西现在待在了物理上不可能的地方：\n')
      + odd.map((q) => '- ' + lab(q.o) + ' (' + q.o.size.map((v) => v.toFixed(1)).join('x') + ' m): ' + q.why + ' (' + lab(q.w) + ', ' + (q.w.type === 'pond' ? T('半径 ', 'radius ') + (q.w.params.size * q.w.s[0]).toFixed(0) : (q.w.params.width * q.w.s[0]).toFixed(0) + 'x' + (q.w.params.depth * q.w.s[2]).toFixed(0)) + ' m)').join('\n')
      + (en ? '\nDecide, for each, what someone dressing this set with care would do, and output one JSON object per line, nothing else:\n{"op":"move","id":"#N","place":{"near":"#WATER","side":"front|behind|left|right|any","gap":1}}   put it on the bank, on the side that makes sense for what it is (a bench looks at the water; a tree stands back)\n{"op":"remove","id":"#N"}   only for something that makes no sense any more\n{"op":"leave","id":"#N"}   if it can perfectly well be there after all\nNever move the water or the thing the player just changed. Use only the ids listed.'
        : '\n像一个细心的布景师那样，为每一样东西做决定，每行输出一个 JSON，不要别的：\n{"op":"move","id":"#N","place":{"near":"#水面ID","side":"front|behind|left|right|any","gap":1}}   挪到岸上合适的一侧（长椅朝着水，树退后一点）\n{"op":"remove","id":"#N"}   只有它已经说不通时才删\n{"op":"leave","id":"#N"}   它其实可以留在那儿\n不要动水面本身，也不要动玩家刚改的那个东西。只用上面列出的 ID。');
    try {
      const res = await M.sample(prompt, { modelTier: 'quick', cache: false }), handled = new Set(); let n = 0;
      for (const line of String(res.text || '').split(/\n+/)) { const i = line.indexOf('{'), j = line.lastIndexOf('}'); if (i < 0 || j <= i) continue; let op; try { op = JSON.parse(line.slice(i, j + 1)); } catch (x) { continue; } const id = +String(op.id || '').replace('#', ''); if (!ids.has(id) || handled.has(id)) continue; handled.add(id); const k = String(op.op || '').toLowerCase();
        if (k === 'move' && op.place && typeof op.place === 'object') { const r = YX.exec({ op: 'move', id: '#' + id, place: op.place }, ctx); if (r && r.ok) { n++; e.msgs.push(r.msg); } } else if (k === 'remove') { const r = YX.exec({ op: 'remove', id: '#' + id }, ctx); if (r && r.ok) { n++; e.msgs.push(r.msg); } } }
      for (const q of odd) if (!handled.has(q.o.id) || (!q.o.dead && inWater(q.o, q.w) && !handled.has('x' + q.o.id))) { if (!q.o.dead && inWater(q.o, q.w) && !(handled.has(q.o.id) && /"leave"/.test(res.text || ''))) { const r = bank(q, ctx); if (r && r.ok) n++; } } // whatever the model did not settle is still taken out of the water
      e.msgs = [T(n + ' 样东西重新安排了位置', n + ' thing' + (n === 1 ? '' : 's') + ' found a new place')].concat(e.msgs.slice(0, 2)); done('ok');
    } catch (x) { fallback(); }
  }
  const prev = hooks.afterCommand;
  hooks.afterCommand = function (text, ops, msgs) {
    if (prev) { try { prev.apply(this, arguments); } catch (e) {} }
    if (!(ops || []).some((o) => o && /^(resize|scale|set|move|become|transform|replace|add|clone|scatter|row)$/.test(String(o.op || '').toLowerCase()))) return;
    setTimeout(() => { try { tidy(text, msgs); } catch (e) { busy = false; console.warn('after', e); } }, 1100); // once the change has settled
  };
  YX.after = { oddities, tidy };
})();
