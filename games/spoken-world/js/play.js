/* Spoken World — things people use.
   Some objects are not only stood next to: a slide is climbed and slid down, again and again. Such an object has a way through it,
   in its own frame; whoever uses it travels that way, in the pose each stretch calls for. The user is remembered in the person's
   own parameters, so it survives saving, and ends the moment the person is told to do anything else. */
(function () {
  'use strict';
  const YX = window.YX, W = YX.world, M = YX.mind, T = YX.T, hooks = YX.hooks;
  // [x, y, z, pose from here on, speed in m/s to the next point]
  const WAYS = { slide: [[1.3, 0, -1.2, 'walk', 1.3], [1.0, 0, -2.8, 'walk', 1.2], [0, 0, -2.8, 'walk', 1.0], [0, 0.2, -2.42, 'walk', 0.75], [0, 1.78, -2.0, 'walk', 0.7], [0, 1.78, -1.25, 'sit', 0.5], [0, 1.74, -0.95, 'sit', 3.4], [0, 0.22, 1.78, 'sit', 1.5], [0, 0.16, 2.45, 'walk', 0.8], [0, 0, 3.15, 'walk', 1.2], [1.3, 0, 3.0, 'walk', 1.3]] };
  YX.usable = (o) => !!o && !o.dead && !!WAYS[o.type];
  const isPerson = (o) => !!o && !o.dead && o.type === 'person';
  function stop(o) { if (!o || !o.params) return; delete o.params._use; o._way = null; o.hold = false; if (!o.dead && !o.attach && o.params.pose !== 'stand' && o.motion !== 'goto') { o.params.pose = 'stand'; try { YX.rebuild(o); } catch (e) {} } }
  function begin(o, tg) { YX.detach(o); if (o.motion === 'follow') YX.unfollow(o); o.motion = 'none'; o.ms = null; o.params._use = tg.id; o._way = null; YX.markDirty(); }
  let acc = 0, users = [];
  const frame0 = YX.onFrame;
  YX.onFrame = function (dt) {
    if (frame0) frame0(dt); dt = dt || 0.016; acc += dt; if (acc > 1) { acc = 0; users = []; for (const o of W.objs.values()) if (isPerson(o) && o.params._use != null) users.push(o); }
    for (const o of users) {
      const tg = W.objs.get(o.params._use), way = tg && !tg.dead ? WAYS[tg.type] : null;
      if (!way || o.dead || o.attach || (o.motion && o.motion !== 'none') || o === W.grabbed || (o._way && o._way.pose && o.params.pose !== o._way.pose)) { stop(o); continue; } // told to do something else
      const st = o._way || (o._way = { i: 0, u: 0, pose: null }), a = way[st.i], b = way[(st.i + 1) % way.length], len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 0.01;
      if (st.pose !== a[3]) { st.pose = a[3]; if (o.params.pose !== a[3]) { o.params.pose = a[3]; try { YX.rebuild(o); } catch (e) {} } }
      st.u += (a[4] * dt) / len; if (st.u >= 1) { st.u = 0; st.i = (st.i + 1) % way.length; continue; }
      const lx = a[0] + (b[0] - a[0]) * st.u, ly = a[1] + (b[1] - a[1]) * st.u, lz = a[2] + (b[2] - a[2]) * st.u, c = Math.cos(tg.rot), s = Math.sin(tg.rot), dx = b[0] - a[0], dz = b[2] - a[2];
      o.x = tg.x + (lx * c + lz * s) * tg.s[0]; o.z = tg.z + (-lx * s + lz * c) * tg.s[2]; o.y = tg.y + ly * tg.s[1]; o.hold = true; o.vel = a[4];
      if (Math.hypot(dx, dz) > 0.2) o.rot = tg.rot + Math.atan2(dx, dz); YX.syncHolder(o);
    }
  };
  YX.OPS.use = function (op, ctx) {
    const v = ctx.view, list = (op.id != null ? ctx.many ? ctx.many(op.id) : [ctx.one(op.id)] : [W.objs.get(v.aimId)]).filter(isPerson);
    if (op.stop) { list.forEach(stop); return { ok: true, msg: T('停下来了', 'Stopped') }; }
    let tg = op.target != null ? ctx.one(op.target) : null; if (!YX.usable(tg)) { tg = null; let bd = 40; for (const o of W.objs.values()) { if (!YX.usable(o) || (YX.seen && !YX.seen(o))) continue; const d = Math.hypot(o.x - v.x, o.z - v.z); if (d < bd) { bd = d; tg = o; } } }
    if (!tg) return { ok: false, msg: T('眼前没有能这样玩的东西（比如滑梯）', 'Nothing in view can be used like that (a slide can)') };
    let who = list; if (!who.length) { let best = null, bd = 12; for (const o of W.objs.values()) { if (!isPerson(o) || o.params._use != null) continue; const d = Math.hypot(o.x - tg.x, o.z - tg.z); if (d < bd && (!YX.seen || YX.seen(o))) { bd = d; best = o; } } if (best) who = [best]; } // nobody named: whoever is standing nearest to it
    if (!who.length) return { ok: false, msg: T('没有看到可以去玩的人', 'There is nobody in view to use it') };
    if (ctx && !ctx.undo && YX.pushUndo) { YX.pushUndo(); ctx.undo = true; }
    who.forEach((o, i) => { begin(o, tg); o._way = { i: (i * 3) % WAYS[tg.type].length, u: 0, pose: null }; }); users = users.concat(who);
    return { ok: true, msg: (who[0].name || YX.lab(who[0])) + T(' 去玩' + YX.labelOf(YX.defOf(tg)) + '了', ' is using the ' + (YX.labelOf(YX.defOf(tg)) || tg.type).toLowerCase()) };
  };
  // the common ways of saying it; anything else reaches the model, which has the same operation
  const EN = /^(?:let|make|have|get|tell|ask) (.+?) (?:to )?(?:play on|play with|use|go down|go on|ride|slide down|climb) (?:the |this |that |a )?(slide|playground slide)$/i, ZH = /^(?:让|叫|请)?(.*?)(?:去|来|上去|过去)?(?:玩|滑|溜|坐)(?:一下|一会儿|一会|会儿)?(?:这个|那个|一下)?(滑梯|滑滑梯|溜滑梯)(?:吧)?$/;
  const commit0 = M.commit;
  M.commit = function (text) {
    const t = String(text || '').trim().replace(/[.!?。！？]+$/, '');
    if (t && !(YX.talk && YX.talk.active() != null) && (EN.test(t) || ZH.test(t))) { const v = YX.viewNow(), a = W.objs.get(v.aimId), ctx = YX.newCtx(v), res = YX.OPS.use(isPerson(a) ? { id: '#' + a.id } : {}, ctx), e = { id: 'use' + Date.now(), text: t, tier: 'local', status: res.ok ? 'ok' : 'fail', msgs: [res.msg], t0: performance.now(), ms: 0 }; if (hooks.log) hooks.log(e); if (!res.ok && hooks.toast) hooks.toast(res.msg); return; }
    return commit0.apply(this, arguments);
  };
})();
