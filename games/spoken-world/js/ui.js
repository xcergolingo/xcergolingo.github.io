/* Spoken World 言出法随 · ui: boot, input, voice, HUD, language */
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const T = (zh, en) => (window.YX && window.YX.lang === 'zh' ? zh : en);
  const MARK = '<svg viewBox="0 0 20 20" aria-hidden="true"><g fill="currentColor"><rect x="2.2" y="7" width="2.6" height="6" rx="1.3"/><rect x="6.5" y="3" width="2.6" height="14" rx="1.3"/><rect x="10.8" y="5.5" width="2.6" height="9" rx="1.3"/><rect x="15.1" y="8" width="2.6" height="4" rx="1.3"/></g></svg>';
  const fatal = (msg) => { const f = $('fatal'); f.style.display = 'grid'; f.textContent = msg; $('intro').classList.add('off'); };
  if (typeof THREE === 'undefined') return fatal(T('3D 引擎没有加载成功，刷新页面再试一次。', 'The 3D engine did not load. Refresh the page and try again.'));
  const YX = window.YX; if (!YX || !YX.initWorld || !YX.mind || !YX.host) return fatal(T('页面脚本没有加载完整，刷新页面再试一次。', 'The page did not load completely. Refresh and try again.'));
  const W = YX.world, M = YX.mind, hooks = YX.hooks, I = YX.input, canvas = $('stage'), cmd = $('cmd'), H = YX.host;
  const KEY = 'yanchu.world.v1', PKEY = 'yanchu.prefs.v2';
  const S = { ui: YX.lang === 'zh' ? 'zh' : 'en', lang: 'en', sys: false, sound: true, chips: true, quality: 'refine', gfx: 'high', letter: false, physics: true };
  try { const old = JSON.parse(localStorage.getItem('yanchu.prefs.v1') || '{}'); for (const k of ['sound', 'chips', 'quality', 'gfx', 'letter']) if (old[k] !== undefined) S[k] = old[k]; } catch (e) {}
  try { Object.assign(S, JSON.parse(localStorage.getItem(PKEY) || '{}')); } catch (e) {}
  S.ui = S.ui === 'zh' ? 'zh' : 'en'; YX.lang = S.ui; YX.strict = S.physics !== false; if (!['', 'zh', 'en'].includes(S.lang)) S.lang = '';
  const savePrefs = () => { try { localStorage.setItem(PKEY, JSON.stringify(S)); } catch (e) {} };
  if (!S.enDefault) { if (S.lang === '') S.lang = 'en'; S.enDefault = 1; savePrefs(); } // speech is heard as English unless the player chose otherwise: "Auto" followed the system language and kept hearing Chinese
  let started = false, locked = false, drag = null, sugg = '', dict = null, dl = null, aiState = 'check', voiceState = 'check', warmed = false;

  /* ---------- toasts, spell line, log ---------- */
  function toast(msg, ms) { const t = document.createElement('div'); t.className = 'toast glass'; t.textContent = msg; $('toasts').appendChild(t); while ($('toasts').children.length > 3) $('toasts').firstChild.remove(); setTimeout(() => t.remove(), ms || 3200); }
  hooks.toast = toast; hooks.caption = (t) => toast(t, 4200);
  let spellT = 0;
  function spell(text, state) { const el = $('spellText'); el.textContent = text; el.className = 'on ' + (state === 'done' ? 'done' : 'partial'); if (state === 'done') { const s = document.createElement('span'); s.className = 'seal'; s.innerHTML = MARK; el.appendChild(s); void s.offsetWidth; } clearTimeout(spellT); spellT = setTimeout(() => { el.className = ''; }, state === 'done' ? 2600 : 9000); }
  function spellHide() { clearTimeout(spellT); $('spellText').className = ''; }
  let liveT = 0; hooks.live = (msg) => { const el = $('liveMsg'); el.textContent = msg; el.classList.add('on'); clearTimeout(liveT); liveT = setTimeout(() => el.classList.remove('on'), 1800); };
  const rows = new Map(), GLYPH = { local: ['即', 'I'], quick: ['译', 'C'], invent: ['造', 'W'], plan: ['景', 'S'] }, TIER = { local: ['当场生效', 'Instant: handled on this device'], quick: ['AI 编译', 'Compiled by the AI'], invent: ['AI 现写', 'Written by the AI'], plan: ['AI 布景', 'Scene planned by the AI'] };
  const fmtMs = (ms) => (ms < 1000 ? ms + ' ms' : (ms / 1000).toFixed(1) + ' s');
  hooks.log = function (e) {
    let r = rows.get(e.id);
    if (!r) { r = { el: document.createElement('div') }; r.el.innerHTML = '<span class="seal"></span><div><div class="q"></div><div class="a"></div></div><div class="ms mono"></div>'; $('log').appendChild(r.el); rows.set(e.id, r); while ($('log').children.length > 5) { const first = $('log').firstChild; for (const [k, v] of rows) if (v.el === first) rows.delete(k); first.remove(); } }
    const el = r.el; el.className = 'entry glass ' + (e.status === 'run' ? 'run' : e.status === 'fail' ? 'fail' : 'ok');
    el.children[0].textContent = GLYPH[e.tier] ? T(GLYPH[e.tier][0], GLYPH[e.tier][1]) : '·'; el.children[0].title = TIER[e.tier] ? T(TIER[e.tier][0], TIER[e.tier][1]) : '';
    el.children[1].children[0].textContent = e.text; el.children[1].children[1].textContent = e.msgs.filter(Boolean).slice(-3).join(' · ') || (e.status === 'run' ? (e.tier === 'quick' ? T('正在编译…', 'Compiling…') : e.tier === 'plan' ? T('正在构思场景…', 'Planning the scene…') : e.tier === 'invent' ? T('正在写这个物体…', 'Writing this object…') : '…') : '');
    const ms = el.children[2]; ms.textContent = '';
    if (e.status === 'run' && e.abort) { const b = document.createElement('button'); b.type = 'button'; b.textContent = '×'; b.title = T('取消', 'Cancel'); b.onclick = () => { try { e.abort(); } catch (x) {} }; ms.appendChild(b); }
    else if (e.status !== 'run') { ms.textContent = fmtMs(e.tier === 'quick' && e.first ? e.first : e.ms); ms.title = e.model ? T('回答的模型档位：', 'Model tier that answered: ') + e.model : ''; }
    clearTimeout(r.t); if (e.status !== 'run') r.t = setTimeout(() => { el.classList.add('gone'); setTimeout(() => { el.remove(); rows.delete(e.id); }, 650); }, e.status === 'fail' ? 9000 : 6000);
  };

  /* ---------- sound ---------- */
  let actx = null;
  function initAudio() { if (actx || !S.sound) return; try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
  function tone(f, d, type, vol, when, to) { if (!actx) return; try { const t = actx.currentTime + (when || 0), o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d + 0.03); } catch (e) {} }
  let sfxLast = 0;
  YX.sfx = function (n) { if (!S.sound || !actx) return; const t = performance.now(); if (t - sfxLast < 45) return; sfxLast = t; if (n === 'add') { tone(520, 0.09, 'sine', 0.05); tone(780, 0.13, 'sine', 0.05, 0.07); } else if (n === 'edit') tone(680, 0.06, 'triangle', 0.045); else if (n === 'remove') tone(420, 0.14, 'sine', 0.05, 0, 200); else if (n === 'undo') { tone(520, 0.06, 'triangle', 0.04); tone(390, 0.09, 'triangle', 0.04, 0.06); } else if (n === 'env') tone(330, 0.35, 'sine', 0.03, 0, 440); else if (n === 'born') { tone(523, 0.1, 'sine', 0.05); tone(659, 0.1, 'sine', 0.05, 0.09); tone(784, 0.22, 'sine', 0.05, 0.18); } else if (n === 'shot') { tone(1500, 0.025, 'square', 0.02); tone(900, 0.04, 'square', 0.02, 0.05); } };

  /* ---------- persistence + boot ---------- */
  function loadSaved() { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  let townHint = false;
  const title = { on: false, home: null, env: null, timer: 0, t2: 0, envT: 0, i: -1 };
  const snap = () => { const d = YX.serialize(); if (title.on && title.home) { const h = title.home; d.player = { x: h.x, y: h.y, z: h.z, yaw: h.yaw, pitch: h.pitch, fly: h.fly, lens: h.lens || 0 }; Object.assign(d.env, title.env); } return d; }; // the title card borrows the camera and the sky: what is kept is the player's own
  YX.onChange = function () { if (title.on) return; try { localStorage.setItem(KEY, JSON.stringify(YX.serialize())); } catch (e) {} };
  function boot(hot) {
    try { YX.initWorld(canvas); } catch (e) { console.error(e); return fatal(T('这台设备没法启动 3D 渲染（WebGL 不可用）。', '3D rendering could not start on this device (WebGL is unavailable).')); }
    let ok = false; const saved = hot && hot.world ? hot.world : loadSaved();
    if (saved) { try { ok = YX.restore(saved, { instant: true, player: true }) && W.objs.size > 0; } catch (e) { console.warn(e); ok = false; } }
    if (!ok) { try { YX.clearWorld(); } catch (e) {} YX.buildTown(); }
    if (S.town !== 2) { townHint = ok; S.town = 2; savePrefs(); } // the starter town was redesigned: a world saved before that keeps its own town until it is reset
    YX.snapFov(); M.quality = S.quality; if (S.gfx === 'low') YX.setQuality('low'); document.body.classList.toggle('letter', !!S.letter);
    applyLang(); requestAnimationFrame(loop); titleStart();
  }
  let frameN = 0, loopErr = 0;
  function loop(t) { try { YX.frame(t); } catch (e) { if (loopErr++ < 3) console.error(e); } if (++frameN % 8 === 0) hud(); requestAnimationFrame(loop); }
  window.addEventListener('resize', () => YX.resize());

  /* ---------- HUD ---------- */
  function brief(o) { const p = o.params; if (o.type === 'person') { const w = p._who; return (w && w.r ? w.r + ' · ' : '') + T('点一下，他就过来和你说话', 'click and they come over to talk'); } if (YX.usable && YX.usable(o)) return T('人可以玩：说“让这个小孩玩滑梯”', 'people can use it: say “let the kid play on the slide”'); if (p.floors != null) return p.floors + T(' 层', p.floors === 1 ? ' floor' : ' floors') + ((o.type === 'house' || o.type === 'shop' || o.type === 'cafe' || o.type === 'tower') && !(YX.insideOf && YX.insideOf() === o) ? T(' · 可以直接走进去', ' · walk straight in') : ''); if (p.decks === 2) return T('双层', 'double decker'); if (p.kind) return String(p.kind); if (p.pose) { const z = { walk: '走动', stand: '站立', sit: '坐着', squat: '蹲着', kneel: '跪着', lie: '躺着', wave: '挥手', fly: '飞行', perch: '停栖', ride: '骑车' }, e = { walk: 'walking', stand: 'standing', sit: 'sitting', squat: 'squatting', kneel: 'kneeling', lie: 'lying down', wave: 'waving', fly: 'flying', perch: 'perched', ride: 'cycling' }, gz = { talk: '聊天', laugh: '笑', cheer: '欢呼', clap: '鼓掌', wave: '挥手' }, ge = { talk: 'talking', laugh: 'laughing', cheer: 'cheering', clap: 'clapping', wave: 'waving' }, g = p.gesture && p.gesture !== 'none' ? p.gesture : ''; const w = o.motion === 'follow' && o.ms ? T(' · 跟着 #' + o.ms.lead, ' · with #' + o.ms.lead) : '', k = p.age === 'child' ? T('小孩 · ', 'child · ') : ''; return k + T((z[p.pose] || p.pose) + (g ? ' · ' + (gz[g] || g) : ''), (e[p.pose] || p.pose) + (g ? ' · ' + (ge[g] || g) : '')) + w; } if (p.name) return String(p.name); return o.size[1] >= 1 ? o.size[1].toFixed(1) + T(' m 高', ' m tall') : ''; }
  function hud() {
    const o = W.grabbed || W.aim, al = $('aimLabel');
    if (o && !YX.cine.active && started) { al.children[0].textContent = (W.grabbed ? T('抓着 ', 'Holding ') : '') + YX.lab(o); al.children[1].textContent = W.grabbed ? T('滚轮旋转 · Alt+滚轮远近 · G 放下', 'Wheel turns · Alt+wheel distance · G drops') : o.wk ? T('重造中…', 'being rebuilt…') : brief(o); al.classList.add('on'); } else al.classList.remove('on');
    if (frameN % 32 === 0) {
      $('stat').textContent = W.objs.size + T(' 物体 · ', ' objects · ') + YX.stats.fps + ' fps' + (aiState === 'on' || aiState === 'ready' ? '' : aiState === 'wait' ? T(' · 等待授权', ' · waiting for permission') : aiState === 'check' ? '' : aiState === 'later' ? T(' · 预览，未接 AI', ' · preview, no AI') : T(' · AI 未连接', ' · AI not connected'));
      const en = YX.envNow(); $('timeText').textContent = YX.clock(en.time) + ' ' + YX.wxName(W.env.weather);
      if ($('popTime').classList.contains('on') && document.activeElement !== $('timeRange')) { $('timeRange').value = en.time; $('timeVal').textContent = YX.clock(en.time); }
      sugg = M.suggest(); if (document.activeElement !== cmd) cmd.placeholder = (dict ? T('按住空格说话，或打字：', 'Hold Space to talk, or type: ') : T('打字：', 'Type: ')) + sugg;
      if ($('outliner').classList.contains('on')) paintOutliner();
      $('sRec').setAttribute('aria-pressed', YX.recording() ? 'true' : 'false');
    }
  }
  function paintDirector() {
    const list = $('shotList'); list.textContent = ''; { const cap = list.previousElementSibling; if (cap && cap.classList.contains('fhint')) cap.style.display = W.shots.length ? '' : 'none'; }
    if (!W.shots.length) { const e = document.createElement('div'); e.className = 'empty'; e.textContent = T('还没有镜头。说一个运镜，或者走到喜欢的角度点下面的“存为机位”。', 'No shots yet. Say a camera move, or walk to an angle you like and save it below.'); list.appendChild(e); }
    W.shots.forEach((s, i) => {
      const d = document.createElement('div'); d.className = 'scard'; const moving = !!(s.move || (s.take && s.take.length > 1));
      d.innerHTML = '<button class="th" type="button"><span class="n"></span><span class="pl">▶</span><span class="d"></span></button><div class="meta"><span class="nm"></span><button class="mini rec" type="button">●</button><button class="mini" type="button">×</button></div>';
      const th = d.children[0], dur = th.children[2]; if (s.th) th.style.backgroundImage = 'url(' + s.th + ')';
      th.children[0].textContent = i + 1; if (moving) dur.textContent = YX.shotDur(s).toFixed(1) + 's'; else { dur.textContent = T('机位', 'View'); th.children[1].textContent = '◎'; } th.title = moving ? T('重放这个镜头', 'Replay this shot') : T('回到这个机位', 'Go to this view');
      if (s.move) { dur.classList.add('edit'); dur.title = T('点击改变时长', 'Click to change the length'); }
      th.onclick = (ev) => { if (ev.target === dur && s.move) { const L = [4, 6, 8, 10], x = YX.shotDur(s); s.move.dur = L[(L.findIndex((v) => v >= x - 0.01) + 1) % L.length]; YX.markDirty(); paintDirector(); return; } if (YX.filmBusy && YX.filmBusy()) return; if (moving) YX.playShot(i); else YX.goShot(i); };
      const meta = d.children[1]; meta.children[0].textContent = s.name + (s.lens ? ' · ' + s.lens + 'mm' : ''); meta.children[0].title = s.name;
      meta.children[1].title = T('把这个镜头拍成片子', 'Film this shot'); meta.children[1].onclick = () => { if (YX.filmShot && !YX.filmShot(i)) toast(T('现在没法开始录制', 'Recording cannot start right now')); };
      meta.children[2].title = T('删除', 'Delete'); meta.children[2].onclick = () => { W.shots.splice(i, 1); YX.markDirty(); paintDirector(); };
      list.appendChild(d);
    });
    for (const b of $('lensRow').children) b.setAttribute('aria-pressed', String(+b.dataset.lens === (W.player.lens || 0)));
    $('sBox').setAttribute('aria-pressed', String(!!S.letter)); $('sPlay').disabled = !W.shots.length; if (YX.filmPaint) YX.filmPaint();
  }
  function paintOutliner() {
    const by = new Map(); for (const o of W.objs.values()) { if (o.dead) continue; const d = YX.defOf(o); const k = o.type; if (!by.has(k)) by.set(k, { label: d ? YX.labelOf(d) : k, n: 0 }); by.get(k).n++; }
    const list = $('outList'), keys = Array.from(by.keys()).sort((a, b) => by.get(b).n - by.get(a).n); list.textContent = ''; $('outTotal').textContent = W.objs.size;
    for (const k of keys) { const b = document.createElement('button'); b.type = 'button'; b.className = 'orow'; b.innerHTML = '<span></span><span></span>'; b.children[0].textContent = by.get(k).label; b.children[1].textContent = '×' + by.get(k).n; b.title = T('看向最近的' + by.get(k).label, 'Go to the nearest ' + by.get(k).label); b.onclick = () => { const o = YX.nearestOfType(k, YX.viewNow(), null); if (o) { const c = YX.newCtx(); YX.exec({ op: 'goto', id: '#' + o.id }, c); YX.fx.flash(o, 0xffffff, 1.4); } }; list.appendChild(b); }
  }
  function paintSeg(id, attr, val) { for (const b of $(id).children) if (b.dataset[attr] !== undefined) b.setAttribute('aria-pressed', String(b.dataset[attr] === String(val))); }
  function paintAll() {
    $('bClay').setAttribute('aria-pressed', String(YX.isClay())); paintDirector();
    paintSeg('wxSeg', 'wx', W.env.weather); paintSeg('lookSeg', 'look', W.env.look); paintSeg('lightSeg', 'light', W.env.light); $('flowBtn').setAttribute('aria-pressed', String(W.env.flow > 0));
    paintSeg('uiSeg', 'ui', S.ui); paintSeg('langSeg', 'lang', S.lang); paintSeg('qSeg', 'q', S.quality); $('sndBtn').setAttribute('aria-pressed', String(S.sound)); $('gfxBtn').setAttribute('aria-pressed', String(S.gfx === 'high')); $('chipBtn').setAttribute('aria-pressed', String(S.chips)); $('physBtn').setAttribute('aria-pressed', String(S.physics !== false)); $('chips').style.display = S.chips ? '' : 'none';
  }
  hooks.ui = paintAll;
  hooks.cinema = (on) => { document.body.classList.toggle('cinema', !!on); document.body.classList.toggle('letter', !!on || !!S.letter); if (!on) $('cine').textContent = ''; };
  hooks.letterbox = (on) => { S.letter = !!on; savePrefs(); document.body.classList.toggle('letter', S.letter); paintDirector(); };
  hooks.shotStep = (i, s, n) => { $('cine').textContent = T('预演 ', 'Preview ') + (i + 1) + '/' + n + ' · ' + s.name + T(' · Esc 停止', ' · Esc to stop'); };

  /* ---------- panels ---------- */
  const filmOpen = () => $('director').classList.contains('on');
  const RIGHT = [['director', 'bDir'], ['outliner', 'bOut'], ['popSet', 'bSet'], ['popHelp', 'bHelp']]; // these share one place on the right of the screen: opening one closes the others
  function onlyRight(id) { for (const r of RIGHT) if (r[0] !== id && $(r[0]).classList.contains('on')) closePop(r[0], r[1]); }
  function togglePanel(id, btn, force) { const el = $(id), on = force != null ? force : !el.classList.contains('on'); if (on) onlyRight(id); el.classList.toggle('on', on); if (btn) $(btn).setAttribute('aria-pressed', String(on)); if (on && id === 'outliner') paintOutliner(); if (on && id === 'director') paintDirector(); }
  function closePop(id, btn) { $(id).classList.remove('on'); if (btn) $(btn).setAttribute('aria-pressed', 'false'); }
  function pop(id, btn) { const on = !$(id).classList.contains('on'); for (const p of [['popTime', null], ['popSet', 'bSet'], ['popHelp', 'bHelp']]) closePop(p[0], p[1]); if (on) { $(id).classList.add('on'); if (btn) $(btn).setAttribute('aria-pressed', 'true'); if (id !== 'popTime') onlyRight(id); if (id === 'popTime') { const en = YX.envNow(); $('timeRange').value = en.time; $('timeVal').textContent = YX.clock(en.time); } } }
  const closePops = () => { closePop('popTime'); closePop('popSet', 'bSet'); closePop('popHelp', 'bHelp'); };
  $('timepill').onclick = () => pop('popTime'); $('bSet').onclick = () => pop('popSet', 'bSet'); $('bHelp').onclick = () => pop('popHelp', 'bHelp');
  $('bOut').onclick = () => togglePanel('outliner', 'bOut'); $('bDir').onclick = () => togglePanel('director', 'bDir');
  $('bUndo').onclick = () => undo(); $('bClay').onclick = () => { YX.setClay(!YX.isClay()); paintAll(); };
  function undo() { if (W.grabbed) { W.grabbed = null; } if (YX.undo()) { hooks.live(T('已撤销', 'Undone')); paintAll(); } else toast(T('没有可撤销的操作', 'Nothing to undo')); }
  // time popover
  $('timeRange').addEventListener('pointerdown', () => YX.pushUndo());
  $('timeRange').addEventListener('input', (e) => { YX.setEnv({ time: +e.target.value }, { instant: true }); $('timeVal').textContent = YX.clock(+e.target.value); });
  $('wxSeg').onclick = (e) => { const v = e.target.dataset.wx; if (v) { YX.pushUndo(); YX.setEnv({ weather: v }); paintAll(); } };
  $('lookSeg').onclick = (e) => { const v = e.target.dataset.look; if (v) { YX.setEnv({ look: v }); paintAll(); } };
  $('lightSeg').onclick = (e) => { const v = e.target.dataset.light; if (v) { YX.setEnv({ light: v }); paintAll(); } };
  $('flowBtn').onclick = () => { YX.setEnv({ flow: W.env.flow > 0 ? 0 : 3 }); paintAll(); };
  // settings
  $('uiSeg').onclick = (e) => { const v = e.target.dataset.ui; if (v && v !== S.ui) { S.ui = v; YX.lang = v; S.sys = false; savePrefs(); applyLang(); } };
  $('langSeg').onclick = (e) => { if (e.target.dataset.lang !== undefined) { S.lang = e.target.dataset.lang; S.sys = false; savePrefs(); paintAll(); } };
  $('qSeg').onclick = (e) => { if (e.target.dataset.q) { S.quality = e.target.dataset.q; M.quality = S.quality; savePrefs(); paintAll(); } };
  $('sndBtn').onclick = () => { S.sound = !S.sound; savePrefs(); initAudio(); paintAll(); };
  $('gfxBtn').onclick = () => { S.gfx = S.gfx === 'high' ? 'low' : 'high'; YX.setQuality(S.gfx); savePrefs(); paintAll(); };
  $('chipBtn').onclick = () => { S.chips = !S.chips; savePrefs(); paintAll(); };
  $('physBtn').onclick = () => { S.physics = S.physics === false; YX.strict = S.physics; savePrefs(); paintAll(); toast(S.physics ? T('真实物理已开启：不会飞的东西不会悬空，自行车要有人骑才会走', 'Realistic physics on: nothing that cannot fly stays in the air, and a bicycle needs a rider') : T('真实物理已关闭：可以让任何东西飞起来或悬浮', 'Realistic physics off: you may make anything fly or float'), 4200); };
  $('copyBtn').onclick = () => { const txt = JSON.stringify(YX.serialize()); $('code').value = txt; const okMsg = () => toast(T('世界码已复制', 'World code copied')), boxMsg = () => { $('code').select(); toast(T('已填进文本框，全选复制即可', 'It is in the text box: select all and copy')); }; try { navigator.clipboard.writeText(txt).then(okMsg, boxMsg); } catch (e) { boxMsg(); } };
  $('importBtn').onclick = () => { let d = null; try { d = JSON.parse($('code').value.trim()); } catch (e) {} if (!d || !Array.isArray(d.objs)) return toast(T('这不是有效的世界码', 'That is not a valid world code')); YX.pushUndo(); YX.cineStop(); if (YX.restore(d, { player: true, animate: true })) { YX.snapFov(); paintAll(); toast(T('已导入，按 Z 可以撤销', 'Imported. Press Z to undo')); } else toast(T('导入没有成功', 'The import failed')); };
  $('saveBtn').onclick = () => { if (!dl) return toast(T('这个窗口不能保存文件，可以用“复制世界码”', 'This window cannot save files. Use “Copy world code” instead')); dl.save({ filename: 'spoken-world.json', data: JSON.stringify(YX.serialize()) }).then(() => toast(T('已保存', 'Saved')), saveFail); };
  const saveFail = (e) => { if (!e || e.code !== 'declined') toast(T('保存没有成功', 'Could not save')); };
  $('resetBtn').onclick = () => { YX.pushUndo(); YX.cineStop(); W.group = []; W.people = []; YX.buildTown(); YX.snapFov(); paintAll(); closePops(); toast(T('已回到初始小镇，按 Z 可以撤销', 'Back to the starter town. Press Z to undo')); };
  $('clearBtn').onclick = () => { YX.pushUndo(); YX.clearWorld(); W.shots = []; W.group = []; W.people = []; paintAll(); closePops(); toast(T('世界已清空，按 Z 可以撤销', 'World cleared. Press Z to undo')); };
  // director
  { const b = $('sClear'); let armed = 0; b.onclick = () => { if (!W.shots.length) return; if (!armed) { armed = setTimeout(() => { armed = 0; b.textContent = T('清空', 'Clear'); }, 2500); b.textContent = T('确定清空？', 'Clear them all?'); return; } clearTimeout(armed); armed = 0; b.textContent = T('清空', 'Clear'); W.shots.length = 0; YX.markDirty(); paintDirector(); }; } // two clicks: the first one asks
  $('sSave').onclick = () => { const s = YX.saveShot(); hooks.live(T('机位 ', 'Shot ') + W.shots.length + ' · ' + s.name); };
  $('sRec').onclick = () => rec(); $('sPlay').onclick = () => play();
  $('lensRow').onclick = (e) => { if (e.target.dataset.lens !== undefined) { W.player.lens = +e.target.dataset.lens; paintDirector(); } };
  $('sBox').onclick = () => hooks.letterbox(!S.letter);
  $('sShot').onclick = () => frameGrab();
  function rec() { const on = YX.recToggle(); toast(on ? T('正在录制手持镜头：现在怎么走，镜头就怎么动。再按 R 结束', 'Recording a handheld take: the camera moves the way you walk. Press R again to finish') : T('手持镜头已存成机位', 'Handheld take saved as a shot')); if (!on) togglePanel('director', 'bDir', true); }
  function play() { if (YX.playing) return YX.stopPlay(); if (!W.shots.length) return toast(T('还没有镜头。说一个运镜，或者在拍摄面板里存一个机位', 'No shots yet. Say a camera move, or save a view in the Film panel')); closePops(); if (document.pointerLockElement) document.exitPointerLock(); YX.playShots({}); }
  const noSave = () => toast(T('这个窗口不能保存文件', 'This window cannot save files'));
  function frameGrab() { if (!dl) return noSave(); YX.afterRender = (cv) => cv.toBlob((b) => { if (!b) return toast(T('截帧没有成功', 'Could not grab the frame')); dl.save({ filename: 'spoken-world-frame-' + Date.now() + '.png', data: b }).then(() => toast(T('已保存这一帧', 'Frame saved')), saveFail); }, 'image/png'); YX.sfx('shot'); }

  /* ---------- chips ---------- */
  const CHIPS = { zh: [['把眼前的这个房子变大一点，再高一点', '当场'], ['在这个房子的屋顶上加一只鸟', '当场'], ['在马路对面放一个咖啡馆', '当场'], ['变成黄昏', '当场'], ['来一群人在咖啡馆门口聊天', '当场'], ['环绕这个房子拍一圈', '运镜'], ['造一座会转的荷兰风车', '现写', 1], ['造一个海边渔村', '布景', 1]],
    en: [['Make this house a bit bigger, then taller', 'instant'], ['Add a bird on the roof of this house', 'instant'], ['Put a café across the street', 'instant'], ['Make it sunset', 'instant'], ['A crowd of people in front of the café', 'instant'], ['Orbit this house', 'camera'], ['Build a Dutch windmill that spins', 'written', 1], ['Build a seaside fishing village', 'scene', 1]] };
  function buildChips() { const box = $('chips'); box.textContent = ''; for (const c of CHIPS[S.ui] || CHIPS.en) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = c[0]; const em = document.createElement('em'), lock = !!c[2] && later(); em.textContent = lock && H.strings.needTag ? T(H.strings.needTag[0], H.strings.needTag[1]) : c[1]; if (lock) b.classList.add('lock'); b.appendChild(em); b.onclick = () => { initAudio(); run(c[0]); canvas.focus(); }; box.appendChild(b); } }
  function run(text) { text = String(text || '').trim(); if (!text) return; spell(text, 'done'); M.commit(text); }

  /* ---------- voice ---------- */
  let vMode = 'idle', vHeld = false, vAcc = '', vPartial = '', vState = 'idle';
  function paintVoice() { const mic = $('mic'), on = vState === 'listening' || vState === 'finishing'; mic.classList.toggle('on', on && vMode !== 'idle'); mic.classList.toggle('wait', vState === 'starting'); $('live').setAttribute('aria-pressed', String(vMode === 'live')); $('liveDot').className = 'dot' + (vMode === 'live' && on ? ' live' : voiceState === 'ready' ? ' on' : ''); }
  function noVoice() { if (later() && voiceState === 'check') { hooks.needAI({ what: 'voice', text: '' }); return; }
    toast(voiceState === 'check' ? T('语音还在准备，稍等一下', 'Voice is still getting ready. One moment') : T('这个窗口不支持语音输入，可以按 / 打字', 'Voice input is not available in this window. Press / to type')); cmd.focus(); }
  const voiceLang = () => (S.lang ? { language: S.lang } : undefined);
  function voiceErr(e) {
    const c = e && e.code; vMode = 'idle'; vHeld = false; vState = 'idle'; paintVoice(); if (c === 'stopped') return;
    if (c === 'not_granted') toast(T('没有拿到麦克风权限，可以按 / 打字', 'No microphone permission. Press / to type instead'));
    else if (c === 'unavailable') { if (S.lang) { S.lang = ''; savePrefs(); paintAll(); toast(T('这个语言的识别暂时用不了，已改成跟随系统，再试一次', 'Speech recognition for this language is unavailable, so it is now on Auto. Try again')); } else { dict = null; setVoice('none'); toast(T('这个账号或窗口不支持语音输入，可以按 / 打字', 'Voice input is not available for this account or window. Press / to type')); } }
    else if (c === 'dismissed') toast(T('允许语音之后才能说话', 'Allow voice input to talk'));
    else if (c === 'rate_limited') toast(T('语音服务正忙，稍后再试', 'The voice service is busy. Try again shortly'));
    else toast(T('语音没能启动，可以按 / 打字', 'Voice could not start. Press / to type'));
  }
  function wireDict() {
    dict.onPartial((e) => { vPartial = (e && e.text) || ''; const all = (vAcc + vPartial).trim(); if (all && vMode !== 'idle') { spell(all, 'partial'); M.partial(all); } });
    dict.onFinal((e) => { vAcc += (e && e.text) || ''; vPartial = ''; const all = vAcc.trim(); if (!all || vMode === 'idle') return; if (vMode === 'live') { vAcc = ''; spell(all, 'done'); M.commit(all); } else { spell(all, 'partial'); M.partial(all); } });
    dict.onState((e) => { vState = e.state; if (e.state === 'idle' && vMode === 'live' && e.reason && e.reason !== 'stopped') { vMode = 'idle'; toast(e.reason === 'hidden' ? T('页面被切走，Live 已停下', 'The page lost focus, so Live stopped') : e.reason === 'time_limit' ? T('Live 到时间上限了，再按 V 继续', 'Live reached its time limit. Press V to continue') : T('Live 已停下', 'Live stopped')); } paintVoice(); });
  }
  let vOpening = false;
  function talkStart(tap) { if (!dict) return tap ? null : noVoice(); if (vMode === 'live' || vHeld || vOpening) return; vHeld = !tap; vMode = 'ptt'; vAcc = ''; vPartial = ''; vOpening = true; paintVoice(); dict.start(voiceLang()).then(() => { vOpening = false; if (!vHeld && vMode === 'ptt') talkFinish(); }, (e) => { vOpening = false; voiceErr(e); }); }
  function talkEnd() { if (!vHeld) return; vHeld = false; if (vMode !== 'ptt' || !dict || vOpening) return; talkFinish(); }
  async function talkFinish() { try { await dict.stop(); } catch (e) {} const all = (vAcc + vPartial).trim(); vAcc = ''; vPartial = ''; vMode = 'idle'; paintVoice(); if (all) { spell(all, 'done'); M.commit(all); } else { M.cancelPhrase(); spellHide(); } }
  function liveToggle() { if (!dict) return noVoice(); if (vHeld || vOpening) return; if (vMode === 'live') { vMode = 'idle'; const all = (vAcc + vPartial).trim(); vAcc = ''; vPartial = ''; dict.stop().catch(() => {}); if (all) { spell(all, 'done'); M.commit(all); } } else { vMode = 'live'; vAcc = ''; vPartial = ''; dict.start(voiceLang()).catch(voiceErr); toast(T('Live 已打开：说完一句就执行一句', 'Live is on: each sentence runs as soon as you finish it')); } paintVoice(); }
  $('mic').addEventListener('pointerdown', (e) => { e.preventDefault(); initAudio(); talkStart(); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) $('mic').addEventListener(ev, () => talkEnd());
  $('live').onclick = () => { initAudio(); liveToggle(); };

  /* ---------- capabilities ---------- */
  function later() { return aiState === 'later' && !M.sample; } // the visitor came in without the AI, and the home of the page has a way to get it (host.access)
  function setAI(s) { aiState = s; $('capAI').className = 'dot' + (s === 'on' || s === 'ready' ? ' on' : s === 'wait' || s === 'later' ? ' warn' : ''); $('capAIT').textContent = T({ later: H.strings.aiLater ? H.strings.aiLater[0] : 'AI 还没有接上，只能用当场生效的指令', check: 'AI 检测中', ready: H.strings.aiReady ? H.strings.aiReady[0] : 'AI 可用（第一次会请你授权）', wait: '等待你授权…', on: 'AI 已就绪', denied: 'AI 未授权，只能用当场生效的指令', none: 'AI 未连接：登录 Claude 才能玩' }[s], { later: H.strings.aiLater ? H.strings.aiLater[1] : 'No AI yet: only instant commands work', check: 'Checking the AI', ready: H.strings.aiReady ? H.strings.aiReady[1] : 'AI available (it asks your permission the first time)', wait: 'Waiting for your permission…', on: 'AI ready', denied: 'AI not allowed: only instant commands work', none: 'AI not connected: sign in to Claude to play' }[s]); gateCheck(); }
  /* ---------- the sign-in gate ----------
     Everything said here is built by the host's AI on the viewer's own account. A viewer the page cannot reach that AI for (signed out, or a window
     that cannot use it) is told what to do, in the host's words (host.gate), and the world does not take input until then. An AI arriving later lifts it. */
  const gateKeys = (e) => { if (!document.body.classList.contains('gated')) return; const g = $('gate'); if (g && g.contains(e.target)) return; e.stopImmediatePropagation(); e.stopPropagation(); if (e.type !== 'keyup' && !(e.ctrlKey || e.metaKey)) e.preventDefault(); };
  ['keydown', 'keyup', 'keypress'].forEach((t) => window.addEventListener(t, gateKeys, true));
  function gateCheck() {
    const on = !!H.gate && aiState === 'none' && !M.sample; let g = $('gate');
    if (!on) { if (g) g.remove(); document.body.classList.remove('gated'); return; }
    if (!g) {
      const st = document.createElement('style'); st.textContent = '#gate{position:fixed;inset:0;z-index:60;display:grid;place-items:center;background:rgba(6,8,12,.5);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);cursor:default}#gate .gcard{width:min(440px,86vw);padding:26px 28px 22px;border-radius:14px;background:rgba(246,247,249,.97);color:#0a0d12;font:400 15px/1.55 var(--f-ui);box-shadow:0 18px 60px rgba(0,0,0,.35)}#gate h2{margin:0 0 10px;font:600 21px/1.25 var(--f-display);letter-spacing:.01em}#gate p{margin:0 0 18px}#gate a{display:inline-block;padding:11px 22px;border-radius:999px;background:var(--voice);color:var(--ink);font:600 13px/1 var(--f-display);letter-spacing:.12em;text-transform:uppercase;text-decoration:none}#gate small{display:block;margin-top:16px;color:#5b6270;font-size:12.5px;line-height:1.45}';
      document.head.appendChild(st);
      g = document.createElement('div'); g.id = 'gate'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'true');
      const c = document.createElement('div'); c.className = 'gcard'; const h = document.createElement('h2'), p = document.createElement('p'), a = document.createElement('a'), m = document.createElement('small');
      const G = H.gate; h.textContent = T(G.title[0], G.title[1]); p.textContent = T(G.body[0], G.body[1]); m.textContent = G.note ? T(G.note[0], G.note[1]) : '';
      if (G.action) { a.href = G.action.href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = T(G.action.label[0], G.action.label[1]); } else a.style.display = 'none';
      c.append(h, p, a, m); g.appendChild(c); g.addEventListener('click', (e) => e.stopPropagation()); document.body.appendChild(g);
    }
    document.body.classList.add('gated'); try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {} try { if (dict && typeof dict.stop === 'function') dict.stop().catch(() => {}); } catch (e) {} try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
  }
  { const set0 = M.setSample; M.setSample = function (fn) { set0(fn); if (fn && (aiState === 'none' || aiState === 'later')) { setAI('ready'); buildChips(); } }; }
  /* a home that lets visitors in before they have the AI says so (hooks.aiLater), and is asked for it when something said needs it (host.access.open) */
  hooks.aiLater = () => { if (!M.sample) { setAI('later'); buildChips(); } };
  hooks.needAI = (q) => { if (H.access && typeof H.access.open === 'function') try { H.access.open(q || {}); } catch (e) { console.warn(e); } };
  function setVoice(s) { voiceState = s; $('capVoice').className = 'dot' + (s === 'ready' ? ' on' : ''); $('capVoiceT').textContent = T({ check: '语音检测中', ready: '语音可用（第一次会请你授权）', none: '这个窗口不支持语音，可以打字' }[s], { check: 'Checking voice', ready: 'Voice available (it asks your permission the first time)', none: 'No voice input in this window: type instead' }[s]); paintVoice(); }
  function warm() {
    if (!M.sample || warmed) return; warmed = true; setAI('wait');
    M.sample(T('只回复两个字：就绪', 'Reply with just: ok'), { modelTier: 'quick' }).then(() => setAI('on'), (e) => { const c = e && e.code; if (c === 'not_granted') { setAI('denied'); M.setSample(null); } else if (['sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(c)) { setAI('none'); M.setSample(null); } else setAI('on'); });
  }
  // the AI, the voice and the saving of files come from wherever the page lives (host.js)
  H.ai.then((s) => { if (typeof s === 'function') { M.setSample(s); setAI('ready'); buildChips(); if (started) warm(); } else setAI('none'); });
  H.voice.then((d) => { if (d && typeof d.start === 'function') { dict = d; try { wireDict(); } catch (e) { console.warn(e); } setVoice('ready'); try { paintAll(); } catch (e) {} } else setVoice('none'); });
  H.save.then((d) => { dl = d && typeof d.save === 'function' ? d : null; });

  /* ---------- intro ---------- */
  function go() { if (started) return; started = true; initAudio(); titleEnd(); if (townHint) { townHint = false; setTimeout(() => toast(T('起始小镇重新设计过了（广场、集市、湖、农场、玻璃橱窗的商店）。你现在看到的是之前保存的世界：说“重置世界”或在设置里点“重置为初始小镇”就能看到新的。', 'The starter town has been redesigned (a square, a market, a lake, a farm, shops you can see into). You are in the world you saved earlier: say “reset the world”, or use Settings → Reset to the starter town, to see the new one.'), 11000), 6000); } warm(); if (dict) talkStart(true); paintAll(); toast(dict ? T('按住空格说话，松开执行。点一下画面用鼠标环顾。', 'Hold Space to talk, release to run. Click the view to look around with the mouse.') : T('按 / 打字下指令。点一下画面用鼠标环顾。', 'Press / to type a command. Click the view to look around with the mouse.'), 5200); }
  $('go').onclick = go;
  $('intro').addEventListener('click', (e) => { if (!e.target.closest('#tLang')) go(); }); // a title card: anywhere starts it
  $('tLang').onclick = (e) => { const v = e.target.dataset.tui; if (!v) return; e.stopPropagation(); const b = document.querySelector('#uiSeg [data-ui="' + v + '"]'); if (b) b.click(); };

  /* ---------- title card: the name over the town, and the town doing what a few spoken lines say ---------- */
  const ACT = { zh: ['变成黄昏', '下雪吧', '变成午夜', '放晴', '日出'], en: ['make it golden hour', 'let it snow', 'make it midnight', 'clear sky', 'sunrise'] };
  function titleLine(first) {
    const q = $('tryQ'), L = ACT[S.ui] || ACT.en; if (!q) return; if (!first) title.i = (title.i + 1) % L.length; const text = L[Math.max(0, title.i)];
    q.textContent = text; if (first) return; q.classList.remove('in'); void q.offsetWidth; q.classList.add('in'); $('intro').classList.add('say');
    clearTimeout(title.t2); title.t2 = setTimeout(() => { $('intro').classList.remove('say'); if (!title.on || started) return; let r = null; try { const v = YX.viewNow(); r = M.parseLocal(text, { view: v, ctx: YX.newCtx(v) }); } catch (e) {} if (r && r[0] && r[0].op === 'env') YX.setEnv(r[0]); }, 1050); // the same grammar the player's own words go through
  }
  function titleStart() {
    if (started || title.on) return; title.on = true; document.body.classList.add('title');
    const P = W.player, home = Object.assign(YX.poseNow(), { fly: P.fly, lens: P.lens || 0 }); title.home = home; title.env = { time: W.env.time, weather: W.env.weather };
    let cx = 0, cz = 0, n = 0, far = 0; const bs = []; for (const o of W.objs.values()) { const d = YX.defOf(o); if (d && d.cls === 'building' && !o.dead) { bs.push(o); cx += o.x; cz += o.z; n++; } }
    if (n) { cx /= n; cz /= n; for (const o of bs) far = Math.max(far, Math.hypot(o.x - cx, o.z - cz)); } else { cx = home.x; cz = home.z; far = 20; }
    const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches, R = Math.min(72, Math.max(34, far * 0.9 + 14)), H = R * 0.3 + 5, a0 = Math.atan2(home.z - cz, home.x - cx), w = still ? 0 : (2 * Math.PI) / 220;
    const pose = (t) => { const a = a0 + w * t, x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R, y = H + Math.sin(t * 0.13) * 1.1, dx = cx - x, dy = 3 - y, dz = cz - z; return { x, y, z, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) }; }; // a slow circle above the town, looking at its middle
    YX.setPose(pose(0)); YX.cineStart({ type: 'fn', dur: 1e9, fn: pose });
    const env = () => { const e = $('tEnv'); if (e) e.textContent = YX.clock(YX.envNow().time) + ' · ' + YX.wxName(W.env.weather); }; env(); title.envT = setInterval(env, 250);
    titleLine(true); if (!still) title.timer = setInterval(() => titleLine(false), 5400);
  }
  function titleEnd() {
    const I = $('intro'); clearInterval(title.timer); clearInterval(title.envT); clearTimeout(title.t2); document.body.classList.remove('title');
    if (!title.on) { I.classList.add('off'); return; }
    I.classList.add('out'); setTimeout(() => I.classList.add('off'), 820);
    const h = title.home, E = title.env; if (Math.abs(W.env.time - E.time) > 0.01 || W.env.weather !== E.weather) YX.setEnv({ time: E.time, weather: E.weather }); // back to the player's own sky, as a time-lapse
    YX.cineStop(); YX.cineStart({ type: 'pose', dur: 1.6, to: h, onDone: (fin) => { if (!fin) YX.setPose(h); W.player.fly = h.fly; title.on = false; YX.markDirty(); } });
  }

  /* ---------- grab ---------- */
  function drop() { const o = W.grabbed; if (!o) return; W.grabbed = null; const d = YX.defOf(o) || {};
    const inB = YX.insideOf && YX.insideOf(); // put down indoors: it stands on the room floor; carried outside: back on the ground
    if (inB && YX.roomHas(inB, o.x, o.z) && d.cls !== 'sky' && d.cls !== 'building' && d.cls !== 'ground' && !(d.cls === 'vehicle' && d.motion === 'drive')) { const q = YX.roomClamp(inB, o.x, o.z, Math.min(0.6, o.fr * 0.5)); o.x = q[0]; o.z = q[1]; o.y = inB.y + YX.floorOf(inB) * inB.s[1]; YX.attachFloor(o, inB); YX.syncHolder(o); YX.updateKids(o); YX.markDirty(); YX.sfx('edit'); W.focusId = o.id; return; }
    if (!inB && o.y > 0 && o.y < 0.6 && d.cls !== 'sky') { o.y = 0; YX.syncHolder(o); YX.updateKids(o); }
 if (d.cls === 'vehicle' && d.motion === 'drive') YX.reDrive(o, o.x, o.z); else { o.ms = null; YX.initMotion(o); } if (o.type === 'road') YX.recomputeRoads(); else if (o.motion !== 'drive') YX.settle(o); YX.markDirty(); if (o.y < 3) YX.fx.ring(o.x, o.z, Math.max(1.2, o.fr * 1.4)); YX.sfx('edit'); W.focusId = o.id; }
  function grab() { if (W.grabbed) return drop(); const o = W.aim; if (!o || o.type === '__pending') return toast(T('准星里没有可以抓的东西', 'Nothing under the crosshair to grab')); if (o.hold) return toast(T('它正在被重造，等一下', 'It is being rebuilt. One moment')); YX.pushUndo(); const inB = YX.insideOf && YX.insideOf(), wasIn = YX.roomOf(o) != null; YX.detach(o); if (inB && wasIn) o.y = inB.y + YX.floorOf(inB) * inB.s[1]; else if (o.y < 0.5) o.y = 0; const P = W.player, dx = o.x - P.x, dz = o.z - P.z; W.grabD = Math.max(1.5, Math.hypot(dx, dz)); W.grabA = Math.atan2(-dx, -dz) - P.yaw; W.grabbed = o; YX.sfx('edit'); }

  /* ---------- keyboard ---------- */
  const LENSES = [0, 24, 35, 50, 85, 135];
  function clearInput() { I.f = I.b = I.l = I.r = I.up = I.down = I.run = I.tl = I.tr = 0; }
  function moveKey(code, v) { switch (code) { case 'KeyW': case 'ArrowUp': I.f = v; return true; case 'KeyS': case 'ArrowDown': I.b = v; return true; case 'KeyA': I.l = v; return true; case 'KeyD': I.r = v; return true; case 'ArrowLeft': I.tl = v; return true; case 'ArrowRight': I.tr = v; return true; case 'KeyE': I.up = v; return true; case 'KeyQ': I.down = v; return true; case 'ShiftLeft': case 'ShiftRight': I.run = v; return true; } return false; }
  window.addEventListener('keydown', (e) => {
    initAudio();
    const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
    if (typing) {
      if (e.key === 'Escape') { t.blur(); canvas.focus(); }
      if (t === cmd) { if (e.key === 'Enter' && !e.isComposing) { const v = cmd.value.trim(); cmd.value = ''; cmd.blur(); if (v) run(v); } else if (e.key === 'Tab') { e.preventDefault(); if (!cmd.value) cmd.value = sugg; } }
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) { if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ') { e.preventDefault(); undo(); } return; }
    if (!started) { if (e.key === 'Enter' || e.code === 'Space') { e.preventDefault(); go(); } return; }
    if (document.body.classList.contains('cmp-on')) return; // the compare view has its own keys
    if (YX.filmLive && YX.filmLive() && (e.code === 'Escape' || e.code === 'KeyR' || e.code === 'Enter')) { e.preventDefault(); YX.filmStop(); return; }
    if (YX.playing) { if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); YX.stopPlay(); } return; }
    if (moveKey(e.code, 1)) { e.preventDefault(); if (YX.cine.active && e.code !== 'ShiftLeft' && e.code !== 'ShiftRight') YX.cineStop(); return; }
    if (e.repeat) { if (e.code === 'Space' || e.code === 'Tab') e.preventDefault(); return; }
    switch (e.code) {
      case 'Space': e.preventDefault(); talkStart(); break;
      case 'KeyV': liveToggle(); break;
      case 'Slash': case 'Enter': case 'NumpadEnter': e.preventDefault(); if (document.pointerLockElement) document.exitPointerLock(); cmd.focus(); break;
      case 'Tab': e.preventDefault(); if (document.pointerLockElement) document.exitPointerLock(); cmd.value = sugg; cmd.focus(); break;
      case 'KeyZ': undo(); break;
      case 'KeyG': grab(); break;
      case 'KeyF': W.player.fly = !W.player.fly; hooks.live(W.player.fly ? T('飞行', 'Flying') : T('落地', 'Walking')); break;
      case 'KeyC': togglePanel('director', 'bDir'); break; // opens and closes the Film panel: a key next to W A S D never creates anything
      case 'KeyP': if (filmOpen()) play(); break;
      case 'KeyR': if (filmOpen() || (YX.recording && YX.recording())) rec(); break;
      case 'KeyL': { if (!filmOpen()) break; const i = LENSES.indexOf(W.player.lens || 0); W.player.lens = LENSES[(i + 1) % LENSES.length]; hooks.live(W.player.lens ? W.player.lens + 'mm' : T('自由视角', 'Free view')); paintDirector(); break; }
      case 'KeyB': YX.setClay(!YX.isClay()); paintAll(); break;
      case 'KeyM': YX.startMove(W.player.y > 30 ? 'reset' : 'overview', null, {}); break;
      case 'KeyO': togglePanel('outliner', 'bOut'); break;
      case 'KeyH': pop('popHelp', 'bHelp'); break;
      case 'KeyK': if (filmOpen()) frameGrab(); break;
      case 'KeyX': if (document.body.classList.toggle('clean')) toast(T('界面已隐藏，再按 X 恢复', 'Interface hidden. Press X to bring it back')); break;
      case 'Escape': if (W.grabbed) { W.grabbed = null; YX.undo(); } else if (YX.cine.active) YX.cineStop(); else { closePops(); document.body.classList.remove('clean'); } break;
      default: if (filmOpen() && /^Digit[1-9]$/.test(e.code)) { const i = +e.code.slice(5) - 1; if (W.shots[i]) { YX.goShot(i); hooks.live(T('机位 ', 'Shot ') + (i + 1) + ' · ' + W.shots[i].name); } }
    }
  });
  window.addEventListener('keyup', (e) => { if (moveKey(e.code, 0)) return; if (e.code === 'Space') talkEnd(); });
  window.addEventListener('blur', () => { clearInput(); if (!vOpening) talkEnd(); else vHeld = false; });
  cmd.addEventListener('focus', () => { clearInput(); cmd.placeholder = sugg + T('　（Tab 填入）', '  (Tab to fill in)'); });

  /* ---------- pointer ---------- */
  canvas.tabIndex = 0;
  canvas.addEventListener('pointerdown', (e) => { initAudio(); closePops(); if (!started) return; if (W.grabbed) { drop(); return; } drag = { x: e.clientX, y: e.clientY, moved: 0, mouse: e.pointerType === 'mouse' }; try { canvas.setPointerCapture(e.pointerId); } catch (x) {} });
  canvas.addEventListener('pointermove', (e) => { if (locked) return; if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy); if (drag.moved > 3) YX.look(dx * 1.4, dy * 1.4); });
  let wantLock = false, tap = null;
  canvas.addEventListener('pointerup', (e) => { const still = !!(drag && drag.moved <= 3); wantLock = still && drag.mouse; tap = still ? { x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse' } : null; drag = null; }); canvas.addEventListener('pointercancel', () => { drag = null; wantLock = false; tap = null; });
  canvas.addEventListener('click', () => { const t = tap; tap = null; if (!started || YX.playing) return;
    if (t && YX.talk && YX.talk.click && YX.talk.click(locked ? null : t.x, locked ? null : t.y, t.touch)) { wantLock = false; return; } // a click on somebody is for them: they come over and talk (with the mouse captured, whoever the crosshair is on)
    if (!wantLock || locked) return; wantLock = false; try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (x) {} });
  document.addEventListener('click', (e) => { const b = e.target && e.target.closest ? e.target.closest('button') : null; if (b) b.blur(); });
  for (const b of document.querySelectorAll('#pad button')) { const k = b.dataset.k; b.addEventListener('pointerdown', (e) => { e.preventDefault(); I[k] = 1; }); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { I[k] = 0; }); }
  document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; if (!locked) clearInput(); });
  document.addEventListener('mousemove', (e) => { if (locked) YX.look(e.movementX || 0, e.movementY || 0); });
  canvas.addEventListener('wheel', (e) => { const o = W.grabbed; if (!o) return; e.preventDefault(); const s = e.deltaY > 0 ? 1 : -1; if (e.shiftKey) { const f = s > 0 ? 1 / 1.06 : 1.06; o.s = o.s.map((v) => Math.min(400, Math.max(0.02, v * f))); YX.measure(o); } else if (e.altKey || e.ctrlKey) W.grabD = Math.min(300, Math.max(1.2, (W.grabD || 8) * (s > 0 ? 1.08 : 1 / 1.08))); else o.rot += s * 0.2618; YX.syncHolder(o); }, { passive: false });

  /* ---------- language ---------- */
  const TXT = {
    brand: ['言出法随', 'Spoken World'], aStage: ['3D 世界', '3D world'], tTime: ['时间与天气', 'Time and weather'], aTools: ['工具', 'Tools'],
    bUndo: ['撤销 <kbd>Z</kbd>', 'Undo <kbd>Z</kbd>'], bClay: ['白模 <kbd>B</kbd>', 'Clay <kbd>B</kbd>'], bDir: ['拍摄 <kbd>C</kbd>', 'Film <kbd>C</kbd>'], bOut: ['清单 <kbd>O</kbd>', 'Outline <kbd>O</kbd>'], bSet: ['设置', 'Settings'], bHelp: ['按键 <kbd>H</kbd>', 'Keys <kbd>H</kbd>'],
    outTitle: ['场景清单', 'Scene outline'], aLog: ['指令记录', 'Command log'], aDir: ['拍摄：机位、录制、对比', 'Film: shots, recording, compare'], dirSeal: ['镜', '◎'], dirTitle: ['拍摄', 'Film'],
    tSrc: ['源代码，在 GitHub 上', 'The source code, on GitHub'], f1: ['定机位', 'Frame the shots'], f1s: ['说一个运镜（“环绕这个房子”）→ 说怎么改（“远一点”“从左边开始”）→ 说“录下来”。', 'Say a move (“orbit this house”) → say what to change (“farther”, “start from the left”) → say “record it”.'], fShots: ['镜头', 'Shots'], fClips: ['片子', 'Clips'], fMore: ['更多工具', 'More tools'], f2: ['录一段片子', 'Record the clip'], f3: ['转成实拍：在页面外完成', 'Make it real: outside this page'], f3s: ['这个页面只能录出 3D 预演，转成实拍要在页面外完成：录好的片子和场景描述会存到你的电脑，交给任意视频模型，再把转好的视频拖回来，和预演并排对比。示例就是这样做的。', 'This page records the 3D previz; turning it into real footage happens outside it. Your clip and its scene description are saved to your computer: give them to any video model, then drop the result back here to compare it with the previz. The examples were made this way.'],
    sLive: ['录下我看到的画面', 'Record what I see'], mvL: ['一键运镜：对着目标点一下', 'One-tap moves: aim at something, then tap'], mvOrbit: ['环绕', 'Orbit'], mvPush: ['推近', 'Push in'], mvPull: ['拉远', 'Pull out'], mvStreet: ['沿街', 'Street'], mvCrane: ['升起', 'Crane up'], mvReveal: ['拉升揭示', 'Reveal'], mvFly: ['飞越', 'Flyover'], mvFollow: ['跟拍', 'Follow'], mvRec: ['● 运镜时同时录制', '● Record the move too'], sPrompt: ['复制提示词', 'Copy the prompt'], sCmp: ['▶ 3D → 实拍 示例', '▶ 3D → real examples'], aPrompt: ['提示词', 'Prompt'], aCmp: ['对比', 'Compare'], aWipe: ['分割线位置', 'Wipe position'], aSeek: ['播放位置', 'Position'],
    cmpT: ['3D 预演 → 真实画面', '3D previz → real footage'], cmpMode: ['滑动对比', 'Wipe'], cmpSnd: ['声音', 'Sound'], cmpX: ['关闭 <kbd>Esc</kbd>', 'Close <kbd>Esc</kbd>'], cmpPlay: ['▶ 播放', '▶ Play'], cmpSwap: ['换一个', 'Change'],
    cmpA1: ['3D 预演', '3D previz'], cmpA2: ['把录好的片子拖到这里，或点击选择。', 'Drop the clip you recorded here, or click to choose it.'], cmpAT: ['3D 预演 · Spoken World', '3D previz · Spoken World'], cmpB1: ['真实画面', 'Real footage'], cmpB2: ['把视频模型转好的实拍视频拖到这里，或点击选择。', 'Drop the footage a video model made from your clip here, or click to choose it.'], cmpBT: ['视频模型 · 在页面外生成', 'Video model · made outside this page'],
    sSave: ['＋ 把现在的画面存为机位', '＋ Save this view as a shot'], sRec: ['● 手持 R', '● Handheld R'], sPlay: ['▶ 连放', '▶ Play all'], aLens: ['焦段', 'Lens'], lensFree: ['自由', 'Free'], sBox: ['2.39 画幅', '2.39 frame'], sShot: ['截帧 K', 'Grab frame K'], sVid: ['● 连拍', '● Film all'],
    aPad: ['移动', 'Move'], aFwd: ['前进', 'Forward'], aTl: ['左转', 'Turn left'], aBack: ['后退', 'Back'], aTr: ['右转', 'Turn right'], aChips: ['试试这些', 'Try these'],
    aMic: ['按住说话', 'Hold to talk'], tMic: ['按住空格说话', 'Hold Space to talk'], aCmd: ['指令', 'Command'], tLive: ['常开聆听：每说完一句就执行', 'Always listening: each sentence runs when you finish it'],
    hint: ['<span><kbd>空格</kbd> 按住说话</span><span><kbd>/</kbd> 打字</span><span><kbd>W A S D</kbd> 走动</span><span><kbd>E</kbd> <kbd>Q</kbd> 升降</span><span><kbd>G</kbd> 抓起眼前的物体</span><span><kbd>点击</kbd> 人物来对话</span><span><kbd>Tab</kbd> 用建议</span>', '<span><kbd>Space</kbd> hold to talk</span><span><kbd>/</kbd> type</span><span><kbd>W A S D</kbd> walk</span><span><kbd>E</kbd> <kbd>Q</kbd> up / down</span><span><kbd>G</kbd> grab what you are looking at</span><span><kbd>Click</kbd> a person to talk</span><span><kbd>Tab</kbd> use the suggestion</span>'],
    lTime: ['一天中的时间', 'Time of day'], aWx: ['天气', 'Weather'], wxClear: ['晴', 'Clear'], wxCloudy: ['多云', 'Cloudy'], wxRain: ['雨', 'Rain'], wxSnow: ['雪', 'Snow'], wxFog: ['雾', 'Fog'], wxStorm: ['暴雨', 'Storm'],
    aLook: ['影调', 'Look'], lkNone: ['原色', 'Natural'], lkWarm: ['暖', 'Warm'], lkCool: ['冷', 'Cool'], lkNoir: ['黑白', 'B&amp;W'], lkVivid: ['鲜艳', 'Vivid'], lkFaded: ['胶片', 'Film'],
    aLight: ['光线', 'Light'], ltSoft: ['柔光', 'Soft'], ltNormal: ['自然光', 'Natural'], ltHard: ['硬光', 'Hard'], flow: ['时间流动', 'Time flows'],
    lUi: ['界面语言 · Language', 'Language · 界面语言'], lVoice: ['语音识别语言', 'Speech recognition language'], vSame: ['自动', 'Auto'],
    lQ: ['新物体的生成方式', 'How new objects are generated'], qQuick: ['只要快', 'Fast only'], qRefine: ['先快后精', 'Fast, then refined'], qMax: ['极致精修', 'Maximum polish'],
    snd: ['音效', 'Sound'], gfx: ['高画质', 'High quality'], chipT: ['示例指令', 'Example commands'], phys: ['真实物理', 'Realistic physics'],
    lCode: ['世界码（复制出去保存或分享，粘贴进来导入）', 'World code (copy it out to keep or share; paste one in to import)'], pCode: ['点“复制世界码”，或把别人的世界码粘贴到这里再点“导入”', 'Press “Copy world code”, or paste someone else’s code here and press “Import”'],
    copy: ['复制世界码', 'Copy world code'], imp: ['导入', 'Import'], saveF: ['存为文件', 'Save as file'], reset: ['重置为初始小镇', 'Reset to the starter town'], clear: ['清空世界', 'Clear the world'], keysT: ['按键', 'Keys'],
    keys: ['<dt><kbd>空格</kbd> 按住</dt><dd>说话，松开就执行</dd><dt><kbd>V</kbd></dt><dd>Live：一直听，说完一句执行一句</dd><dt><kbd>/</kbd> 或 <kbd>Enter</kbd></dt><dd>打字输入；<kbd>Tab</kbd> 填入建议</dd><dt><kbd>W A S D</kbd></dt><dd>走动，<kbd>Shift</kbd> 加速；点画面后鼠标环顾，<kbd>Esc</kbd> 释放</dd><dt><kbd>E</kbd> <kbd>Q</kbd></dt><dd>升起 / 下降（自动进入飞行），<kbd>F</kbd> 落地</dd><dt><kbd>G</kbd></dt><dd>抓起准星里的物体跟着你走；滚轮旋转，<kbd>Shift</kbd>+滚轮缩放，<kbd>Alt</kbd>+滚轮远近；再按放下</dd><dt><kbd>Z</kbd></dt><dd>撤销</dd><dt><kbd>C</kbd></dt><dd>打开或关上拍摄面板。面板开着时才生效：<kbd>1</kbd>–<kbd>9</kbd> 切到第 N 个镜头，<kbd>R</kbd> 手持镜头，<kbd>P</kbd> 按顺序预演，<kbd>L</kbd> 换焦段，<kbd>K</kbd> 截一帧</dd><dt><kbd>M</kbd></dt><dd>鸟瞰</dd><dt><kbd>B</kbd> <kbd>X</kbd></dt><dd>白模 / 隐藏界面</dd>',
      '<dt><kbd>Space</kbd> hold</dt><dd>Talk; release to run it</dd><dt><kbd>V</kbd></dt><dd>Live: keeps listening and runs each sentence as you finish it</dd><dt><kbd>/</kbd> or <kbd>Enter</kbd></dt><dd>Type a command; <kbd>Tab</kbd> fills in the suggestion</dd><dt><kbd>W A S D</kbd></dt><dd>Walk, <kbd>Shift</kbd> to run; click the view to look around with the mouse, <kbd>Esc</kbd> to release</dd><dt><kbd>E</kbd> <kbd>Q</kbd></dt><dd>Rise / descend (starts flying), <kbd>F</kbd> to land</dd><dt><kbd>G</kbd></dt><dd>Grab the object under the crosshair and carry it; the wheel turns it, <kbd>Shift</kbd>+wheel resizes, <kbd>Alt</kbd>+wheel changes the distance; press again to drop</dd><dt><kbd>Z</kbd></dt><dd>Undo</dd><dt><kbd>C</kbd></dt><dd>Open or close the Film panel. These work only while it is open: <kbd>1</kbd>–<kbd>9</kbd> jump to a shot, <kbd>R</kbd> handheld take, <kbd>P</kbd> play the shots in order, <kbd>L</kbd> change lens, <kbd>K</kbd> grab a frame</dd><dt><kbd>M</kbd></dt><dd>Bird’s-eye view</dd><dt><kbd>B</kbd> <kbd>X</kbd></dt><dd>Clay mode / hide the interface</dd>'],
    examples: ['说法举例：把这个房子变高一点 · 在屋顶上加一只鸟 · 马路对面放一个咖啡馆 · 路两边种一排樱花树 · 来一群人在喷泉边聊天 · 让他们聊天、笑 · 让这个小孩跳两下 · 让他走到长椅那里 · 把巴士挪到眼前的马路上 · 把它变成双层巴士 · 光从左边打过来 · 85 毫米 · 环绕这个房子一圈 · 保存机位 · 和这个人说话 · 让这个小孩玩滑梯 · 加一个风车 · 加一片郁金香田 · 加三只鸭子 · 加一个水果摊 · 造一艘海盗船 · 造一个海边渔村',
      'Things to say: make this house a bit taller · put a bird on the roof · put a café across the street · plant a row of cherry trees along the road · a crowd of people in front of the café · have them chat and laugh · make the kid jump · have him walk to the bench · move the bus onto the road in front of me · turn this bus into a double decker bus · light from the left · 85mm · orbit this house · save shot · talk to this person · let the kid play on the slide · add a windmill · add a tulip field · add three ducks · add a fruit stall · build a pirate ship · build a seaside fishing village'],
    tagline: ['开口，世界就跟着变。', 'Say it, and the world changes.'], kSpace: ['空格', 'Space'],
    t1: ['按住说话', 'Hold to talk'], t1s: ['松开就执行', 'Let go and it happens'], t2: ['看着它', 'Look at something'], t2s: ['“这个”就是准星对着的东西', '“This” is whatever you aim at'], t3: ['四处走走', 'Walk around'], t3s: ['点一下画面，用鼠标环顾', 'Click the view to look with the mouse'], t4: ['升起、降下', 'Fly up and down'], t4s: ['从空中看你的世界', 'See your world from above'], tryL: ['试着说', 'Try saying'],
    start: ['开始', 'Start'], startOr: ['或者按住 <kbd>空格</kbd> 直接开口', 'or hold <kbd>Space</kbd> and start talking'], sClear: ['清空', 'Clear'], fShotsS: ['给相机的计划，还不是视频。点 ● 把它录成一段片子。', 'Plans for the camera, not video yet. ● records one as a clip.'], fClipsS: ['录好的视频。点开一段来看。实拍在页面外生成，再拖进来对比。', 'Recorded video. Click one to watch it. Real footage is made outside this page, then dropped in to compare.'],
  };
  for (const k in H.strings) if (TXT[k] && Array.isArray(H.strings[k])) TXT[k] = H.strings[k]; // wording that differs in this home
  { const bar = $('bar'), set = () => document.documentElement.style.setProperty('--bar-h', (bar.offsetHeight + 14) + 'px'); set(); if (window.ResizeObserver) new ResizeObserver(set).observe(bar); window.addEventListener('resize', set); } // what sits above the command bar (the Film panel, the log) follows its real height
  function applyLang() {
    const k = YX.lang === 'zh' ? 0 : 1; document.documentElement.lang = k ? 'en' : 'zh-CN';
    for (const el of document.querySelectorAll('[data-i]')) { const t = TXT[el.dataset.i]; if (t) el.innerHTML = t[k]; }
    for (const el of document.querySelectorAll('[data-ia]')) for (const pair of el.dataset.ia.split(';')) { const a = pair.split(':'), t = TXT[a[1]]; if (t) el.setAttribute(a[0], t[k].replace(/&amp;/g, '&')); }
    buildChips(); if (!started) titleLine(true); for (const b of $('tLang').children) if (b.dataset.tui) b.setAttribute('aria-pressed', String(b.dataset.tui === S.ui)); setAI(aiState); setVoice(voiceState); sugg = M.suggest(); cmd.placeholder = (dict ? T('按住空格说话，或打字：', 'Hold Space to talk, or type: ') : T('打字：', 'Type: ')) + sugg;
    paintAll(); if ($('outliner').classList.contains('on')) paintOutliner(); frameN = 31;
  }

  hooks.resetTown = () => $('resetBtn').onclick();
  /* what the film module needs from this one */
  function skipTitle() { if (!title.on) return; clearInterval(title.timer); clearInterval(title.envT); clearTimeout(title.t2); YX.cineStop(); YX.setPose(title.home); W.player.fly = title.home.fly; if (Math.abs(W.env.time - title.env.time) > 0.01 || W.env.weather !== title.env.weather) YX.setEnv({ time: title.env.time, weather: title.env.weather }, { instant: true }); title.on = false; document.body.classList.remove('title'); $('intro').classList.add('off'); } // straight to the world, no flight
  YX.ui = { skipTitle, toast, closePops, togglePanel, canSave: () => !!dl, save: (o) => (dl ? dl.save(o) : Promise.reject({ code: 'none' })), saveFail, started: () => started, lang: () => S.ui };
  /* ---------- go ---------- */
  const hot = window.claude && window.claude.hot;
  if (hot && typeof hot.snapshot === 'function') { try { hot.snapshot(() => ({ world: snap() })); } catch (e) {} }
  if (hot && typeof hot.ready === 'function') { try { hot.ready(boot); } catch (e) { boot({}); } } else boot((hot && hot.data) || {});
})();
