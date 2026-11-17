/* Spoken World · guide: the first five minutes.
   Somebody who has just arrived does not know that "this" is whatever they look at, that some sentences happen at once and others take the AI
   a moment, that the people answer, or that there is a film set in here. Five steps say so, one at a time; each lights up when the world shows
   it has been done (not when a button is pressed). It can be closed, comes back from the Keys panel, and is remembered on this device.
   It never opens by itself in an automated browser, so tests and recordings are not disturbed. */
'use strict';
(function () {
  const YX = window.YX; if (!YX || !YX.ui || !YX.world) return;
  const W = YX.world, T = YX.T, $ = (id) => document.getElementById(id), KEY = 'yanchu.guide.v1';
  let S = { done: [], closed: false }; try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  // what has been seen to happen since the page opened
  const seen = { local: false, ai: false, talk: false, clip: false, moved: 0 }; let origin = null;
  { const prev = YX.hooks.log; YX.hooks.log = function (e) { try { if (e && e.status === 'ok') { if (e.tier === 'local') seen.local = true; else if (e.tier === 'talk') seen.talk = true; else if (e.tier === 'quick' || e.tier === 'default' || e.tier === 'complex' || e.tier === 'invent' || e.tier === 'plan') seen.ai = true; } } catch (x) {} if (prev) return prev.apply(this, arguments); }; }
  const voice = () => { const d = $('capVoice'); return !!d && /\bon\b/.test(d.className); };
  const how = () => (voice() ? T('按住空格说：', 'Hold Space and say: ') : T('按 / 输入：', 'Press / and type: '));
  const STEPS = [
    { id: 'move', t: ['四处走走', 'Look around'], d: () => T('点一下画面用鼠标环顾，W A S D 走动，E / Q 升降。', 'Click the view to look with the mouse. W A S D to walk, E / Q to fly up and down.'), ok: () => seen.moved > 8 },
    { id: 'local', t: ['对着东西说一句', 'Say it to something'], d: () => T('“这个”就是准星对着的东西。看着一栋房子，', '“This” is whatever the crosshair is on. Look at a house. ') + how(), say: ['把这栋房子加高', 'make this house taller'], ok: () => seen.local },
    { id: 'ai', t: ['要一个这里没有的东西', 'Ask for something that is not here'], d: () => T('新东西由 AI 现场搭建，要等几秒到半分钟。', 'New things are built by the AI on the spot. That takes a few seconds, up to half a minute. ') + how(), say: ['在湖上加一条飞着的红龙', 'add a red dragon flying over the lake'], ok: () => seen.ai },
    { id: 'talk', t: ['和镇上的人说话', 'Talk to someone'], d: () => T('点一个人，他会走过来；之后你说的话是对他说的，说“再见”结束。', 'Click a person and they come over. What you say then goes to them, until you say goodbye.'), ok: () => seen.talk },
    { id: 'film', t: ['拍一段', 'Film it'], d: () => T('看着一个东西，', 'Look at something. ') + how(), say: ['慢慢环绕它并拍下来', 'circle it slowly and record it'], ok: () => seen.clip },
  ];
  const css = document.createElement('style');
  css.textContent = '#guide{position:fixed;right:16px;top:64px;z-index:4;width:min(300px,calc(100vw - 32px));padding:12px 12px 10px;display:none;flex-direction:column;gap:6px;font:400 13px/1.45 var(--f-ui);color:var(--paper)}#guide.on{display:flex}body.title #guide,body.gated #guide,body.cinema #guide,body.cmp-on #guide,body.clean #guide,body.multicam #guide{display:none}#guide h4{margin:0 0 2px;display:flex;align-items:center;gap:8px;font:600 11px/1 var(--f-display);letter-spacing:.16em;text-transform:uppercase;color:var(--paper-dim)}#guide h4 span{flex:1}#guide h4 button{border:0;background:none;color:var(--paper-dim);font:400 16px/1 var(--f-ui);cursor:pointer;padding:2px 4px}#guide ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px}#guide li{display:grid;grid-template-columns:18px 1fr;gap:8px;align-items:start;color:var(--paper-dim)}#guide li i{width:18px;height:18px;border-radius:50%;border:1.5px solid var(--line);display:grid;place-items:center;font:600 10px/1 var(--f-mono);font-style:normal}#guide li.done i{background:var(--voice);border-color:var(--voice);color:var(--ink)}#guide li.now{color:var(--paper)}#guide li.now i{border-color:var(--voice);color:var(--voice)}#guide li b{font-weight:600}#guide li p{margin:3px 0 0;display:none;color:var(--paper-dim)}#guide li.now p{display:block}#guide li q{display:inline-block;margin-top:5px;padding:4px 8px;border-radius:7px;background:rgba(255,216,77,.14);color:var(--voice);quotes:none;cursor:pointer}#guide.small li:not(.now){display:none}#guide .fin{color:var(--paper)}';
  document.head.appendChild(css);
  const box = document.createElement('div'); box.id = 'guide'; box.className = 'glass'; box.setAttribute('role', 'complementary'); document.body.appendChild(box);
  let shown = false, sig = '';
  function paint() {
    const done = (s) => S.done.includes(s.id), now = STEPS.find((s) => !done(s)), lang = YX.lang, small = (() => { const d = $('director'); return !!d && getComputedStyle(d).display !== 'none'; })();
    const k = [lang, S.done.join(','), now ? now.id : '-', voice(), small].join('|'); box.classList.toggle('small', small && !!now); if (k === sig) return; sig = k;
    box.textContent = '';
    const h = document.createElement('h4'), hs = document.createElement('span'), x = document.createElement('button'); hs.textContent = T('最初五分钟', 'Your first five minutes') + ' · ' + S.done.length + '/' + STEPS.length; x.type = 'button'; x.textContent = '×'; x.title = T('关闭（在“按键”里可以再打开）', 'Close (it comes back from Keys)'); x.onclick = () => { S.closed = true; save(); hide(); }; h.append(hs, x); box.appendChild(h);
    if (!now) { const p = document.createElement('div'); p.className = 'fin'; p.textContent = T('都会了。接下来随便说：换天气、加一条街、让巴士停下、三机位拍它。', 'That is all of it. From here, say anything: change the weather, add a street, stop the bus, film it with three cameras.'); box.appendChild(p); return; }
    const ol = document.createElement('ol');
    STEPS.forEach((s, i) => { const li = document.createElement('li'), n = document.createElement('i'), c = document.createElement('div'), b = document.createElement('b'); li.className = done(s) ? 'done' : s === now ? 'now' : ''; n.textContent = done(s) ? '✓' : String(i + 1); b.textContent = T(s.t[0], s.t[1]); c.appendChild(b);
      if (s === now) { const p = document.createElement('p'); p.textContent = s.d(); if (s.say) { const q = document.createElement('q'); q.textContent = '“' + T(s.say[0], s.say[1]) + '”'; q.title = T('点一下放进输入框', 'Click to put it in the command box'); q.onclick = () => { const cmd = $('cmd'); if (cmd) { cmd.value = T(s.say[0], s.say[1]); cmd.focus(); } }; p.appendChild(document.createElement('br')); p.appendChild(q); } c.appendChild(p); }
      li.append(n, c); ol.appendChild(li); });
    box.appendChild(ol);
  }
  function tick() {
    if (!shown) return; const P = W.player;
    if (YX.ui.started()) { if (!origin) origin = { x: P.x, y: P.y, z: P.z }; seen.moved = Math.max(seen.moved, Math.hypot(P.x - origin.x, P.y - origin.y, P.z - origin.z)); }
    if (!seen.clip) { const L = $('clipList'); seen.clip = !!L && !!L.querySelector('.scard'); }
    let changed = false; for (const s of STEPS) { if (S.done.includes(s.id)) continue; if (s.ok()) { S.done.push(s.id); changed = true; if (YX.sfx) YX.sfx('born'); } else break; } // in order: a later step does not tick before the one in front of it
    if (changed) { save(); if (S.done.length === STEPS.length) setTimeout(() => { if (S.done.length === STEPS.length) { S.closed = true; save(); hide(); } }, 9000); }
    paint();
  }
  function show(again) { if (again) { S = { done: [], closed: false }; save(); origin = null; seen.local = seen.ai = seen.talk = seen.clip = false; seen.moved = 0; } shown = true; sig = ''; box.classList.add('on'); paint(); }
  function hide() { shown = false; box.classList.remove('on'); }
  setInterval(tick, 400);
  YX.guide = { show: () => show(true), hide, state: () => ({ shown, done: S.done.slice(), closed: S.closed }) };
  // a way back, in the Keys panel
  { const dl = document.querySelector('[data-i="keys"]'), pop = dl && dl.parentElement; if (pop) { const b = document.createElement('button'); b.type = 'button'; b.className = 'sbtn wide'; b.id = 'guideAgain'; const lab = () => { b.textContent = T('再看一遍“最初五分钟”', 'Show “Your first five minutes” again'); }; lab(); setInterval(lab, 1500); b.onclick = () => { if (YX.ui.closePops) YX.ui.closePops(); show(true); }; pop.appendChild(b); } }
  if (!navigator.webdriver && !S.closed && S.done.length < STEPS.length) show(false);
})();
