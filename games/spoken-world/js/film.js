/* Spoken World · film: record a 16:9 clip of the world, describe the scene for a video model, and compare the result side by side.
   The page cannot call outside APIs: turning the previz into real footage happens outside it, with whatever video model the viewer uses. */
'use strict';
(function () {
  const YX = window.YX, W = YX.world, T = YX.T, U = YX.ui, $ = (id) => document.getElementById(id);
  const LIMIT = 10, SIZE = [1280, 720]; // seconds an uploaded source video may run; the frame every clip is recorded at
  const canvas = YX.three.renderer.domElement, cine = $('cine');
  const BASE_PROMPT = 'Turn this rough 3D previsualization into photorealistic live-action footage. Use the animation only as a guide: keep the exact camera movement, framing and timing, and keep every building, vehicle, person and tree in the same position, doing the same thing. Real materials, natural light and shadows. Continuous, unbroken shot. Do not show the low-poly 3D look in the final video. No dialogue, only natural ambient sound.';
  let mr = null, chunks = [], t0 = 0, tick = 0, cap = 0, mode = '', clip = null, sceneAtRec = '';
  const fmt = (s) => { s = Math.max(0, s); return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') + '.' + Math.floor((s * 10) % 10); };

  /* ---------- the scene, in words ---------- */
  const PLURAL = { person: 'people', child: 'children', bus: 'buses', bench: 'benches', bush: 'bushes', box: 'boxes', taxi: 'taxis', 'bus stop': 'bus stops', 'flower bed': 'flower beds', café: 'cafés' };
  function nameOf(o, def) {
    const p = o.params || {};
    if (o.type === 'person') return p.pose === 'ride' ? 'cyclist' : p.age === 'child' ? 'child' : 'person';
    if (o.type === 'car') return p.kind === 'taxi' ? 'taxi' : p.kind === 'van' ? 'van' : p.kind === 'pickup' ? 'pickup truck' : 'car';
    if (o.type === 'bus') return +p.decks === 2 ? 'double-decker bus' : 'bus';
    if (o.type === 'tree') return ['cherry', 'pine', 'palm', 'birch', 'maple'].includes(p.kind) ? p.kind + ' tree' : 'tree';
    if (o.type === 'flowers') return 'flower bed';
    if (o.type === 'water') return 'open water';
    return String(def.en || def.label || o.type).toLowerCase();
  }
  YX.sceneText = function () {
    const E = W.env, h = +E.time || 12, P = W.player;
    const tod = h < 5 || h >= 21 ? 'night' : h < 7 ? 'dawn' : h < 10 ? 'morning' : h < 15 ? 'midday' : h < 17.3 ? 'late afternoon' : h < 19.5 ? 'golden hour, low warm sun' : 'dusk';
    const wx = { clear: 'clear sky', cloudy: 'overcast sky', rain: 'steady rain, wet streets', snow: 'snow falling', fog: 'thick fog', storm: 'a thunderstorm' }[E.weather] || String(E.weather || 'clear sky');
    const gnd = { grass: 'green grass', sand: 'sand', snow: 'snow on the ground', dirt: 'bare earth', stone: 'stone paving' }[E.ground] || '';
    const pts = W.shots.length ? W.shots : [P], n = {};
    // only what a camera sees: near it, or within about 50 degrees of where it points
    const sees = (p, o, reach) => { const dx = o.x - p.x, dz = o.z - p.z, d = Math.hypot(dx, dz); if (d > reach) return false; if (d < 6) return true; return (dx * -Math.sin(p.yaw || 0) + dz * -Math.cos(p.yaw || 0)) / d > 0.62; };
    for (const o of W.objs.values()) {
      if (o.dead || o.type === '__pending' || o.type === 'road' || o.type === 'cloud' || o.type === 'light') continue;
      const def = YX.defOf(o); if (!def) continue;
      const reach = def.cls === 'building' || o.type === 'hill' || o.type === 'water' ? 80 : 45;
      if (!pts.some((p) => sees(p, o, reach))) continue;
      const k = nameOf(o, def); n[k] = (n[k] || 0) + 1;
    }
    const road = Array.from(W.objs.values()).some((o) => o.type === 'road' && !o.dead);
    const items = Object.keys(n).sort((a, b) => n[b] - n[a]).slice(0, 8).map((k) => (n[k] === 1 ? (/^[aeiou]/.test(k) ? 'an ' : 'a ') + k : (n[k] > 12 ? 'many ' : n[k] > 4 ? 'several ' : ['two ', 'three ', 'four '][n[k] - 2]) + (PLURAL[k] || k + 's')));
    return (tod + ', ' + wx + (gnd ? ', ' + gnd : '') + '. ' + (road ? 'A small-town street. ' : '') + (items.length ? 'In view: ' + items.join(', ') + '.' : '')).replace(/^./, (c) => c.toUpperCase());
  };
  YX.filmPrompt = () => BASE_PROMPT + ' Scene: ' + (sceneAtRec || YX.sceneText());

  /* ---------- recording ---------- */
  const pickMime = () => ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } });
  const planned = () => W.shots.reduce((a, s) => a + YX.shotDur(s), 0);
  YX.filmLive = () => !!mr && (mode === 'live' || mode === 'move');
  function hud() { if (!mr) return; const s = (performance.now() - t0) / 1000; cine.textContent = 'REC ' + fmt(s) + ' / ' + fmt(cap) + (mode === 'live' ? T(' · 按 R 或 Esc 结束', ' · R or Esc to finish') : T(' · Esc 结束', ' · Esc to finish')); }
  let recTitle = null; // what the clip being recorded is a recording of: the name of the shot, or nothing for a take by hand
  function start(m, move) {
    if (mr) return stop();
    recTitle = m === 'shots' ? T('全部镜头', 'All shots') : (move && move.title) || null;
    if (!canvas.captureStream || typeof MediaRecorder === 'undefined') return U.toast(T('这个浏览器不支持录制', 'This browser cannot record'));
    if (m === 'shots' && !W.shots.length) return U.toast(T('还没有机位。先存一个，或者用“实时录制”', 'No shots yet. Save one first, or use “Record live”'));
    if (YX.playing) return;
    const mime = pickMime(); U.closePops(); YX.filmFrame(SIZE); mode = m; chunks = []; sceneAtRec = YX.sceneText();
    cap = m === 'shots' ? Math.min(LIMIT, planned() + 0.3) : m === 'move' ? Math.min(LIMIT, move.dur + 0.5) : LIMIT;
    // one frame later the canvas has its new size: only then is the stream the right shape
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try { mr = new MediaRecorder(canvas.captureStream(30), mime ? { mimeType: mime, videoBitsPerSecond: 12e6 } : undefined); } catch (e) { mr = null; YX.filmFrame(null); return U.toast(T('录制没能启动', 'Recording could not start')); }
      const type = (mr.mimeType || mime || 'video/webm').split(';')[0];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = () => finish(type);
      try { mr.start(250); } catch (e) { mr = null; YX.filmFrame(null); return U.toast(T('录制没能启动', 'Recording could not start')); }
      t0 = performance.now(); cine.classList.add('rec'); paint();
      if (m === 'shots') { if (!YX.playShots({ onDone: () => setTimeout(stop, 250) })) stop(); }
      else if (m === 'move') { document.body.classList.add('cinema'); if (!move.run(() => setTimeout(stop, 280))) stop(); } // the camera move itself decides when the clip ends
      else { document.body.classList.add('cinema'); U.toast(T('开始录了：现在怎么走，片子就怎么拍。最长 ' + LIMIT + ' 秒', 'Recording: the clip is whatever you do now, up to ' + LIMIT + ' s')); }
      tick = setInterval(() => { hud(); if ((performance.now() - t0) / 1000 >= cap) stop(); }, 100); hud();
    }));
    return true;
  }
  function stop() {
    if (!mr) return; clearInterval(tick); tick = 0;
    const r = mr; mr = null; r._secs = (performance.now() - t0) / 1000; lastSecs = r._secs;
    try { r.stop(); } catch (e) { finish('video/webm'); }
    if (YX.playing) YX.stopPlay();
    if (mode === 'move' && YX.cine && YX.cine.active) YX.cineStop();
  }
  let lastSecs = 0;
  YX.filmStop = stop;
  YX.filmRun = function (dur, run, title) { if (mr || YX.playing) return false; return start('move', { dur: Math.min(LIMIT, Math.max(1, +dur || 8)), run, title: title || null }) === true; }; // record while something flies the camera
  YX.filmLiveStart = function () { if (mr || YX.playing) return false; return start('live') === true; };
  YX.filmShot = function (i) { const s = W.shots[i]; if (!s || mr || YX.playing) return false; return YX.filmRun(YX.shotDur(s), (done) => YX.playShot(i, done), s.name); };
  YX.filmBusy = () => !!mr;
  /* a camera move and its recording as one action: "orbit this house and record it" */
  YX.filmMove = function (m, tg, op) { if (mr || YX.playing) return false; return start('move', { dur: +op.dur || 8, title: op.title || null, run: (done) => YX.startMove(m, tg, op, done) }) || YX.startMove(m, tg, op); };
  YX.filmLast = function () {
    let s = null; for (let i = W.shots.length - 1; i >= 0 && !s; i--) if (W.shots[i].move) s = W.shots[i];
    if (!s || mr || YX.playing) return false;
    YX.cineStop(); Object.assign(W.player, { x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: s.pitch, lens: s.lens || 0, fly: s.y > 1.95 }); YX.snapFov();
    const op = Object.assign({}, s.move); op.dur = Math.min(10, Math.max(2, +op.dur || 8)); if (s.move.type === 'orbit' && op.deg == null) op.deg = 150;
    return YX.filmMove(s.move.type, s.move.target != null ? W.objs.get(s.move.target) || null : null, op);
  };
  function finish(type) {
    cine.classList.remove('rec'); if (mode === 'live' || mode === 'move') { document.body.classList.remove('cinema'); cine.textContent = ''; }
    YX.filmFrame(null);
    const blob = new Blob(chunks, { type }); chunks = [];
    if (!blob.size) { paint(); return U.toast(T('没有录到画面', 'Nothing was recorded')); }
    const d = new Date(), p2 = (v) => String(v).padStart(2, '0'), stem = 'spoken-world-previz-' + p2(d.getHours()) + p2(d.getMinutes()) + p2(d.getSeconds()), ext = type === 'video/mp4' ? '.mp4' : '.webm';
    clip = { blob, url: URL.createObjectURL(blob), name: stem + ext, secs: lastSecs, scene: sceneAtRec, stem, type, tiles: 1, title: recTitle };
    clips.unshift(clip); while (clips.length > 8) { const old = clips.pop(); try { URL.revokeObjectURL(old.url); } catch (e) {} }
    U.togglePanel('director', 'bDir', true); paint(); showClip(clip); // the film is on screen the moment it exists
    if (U.canSave()) saveClip(clip);
  }
  const clips = []; // what was recorded in this session, newest first
  YX.filmTake = function (blob, type, secs, sceneTxt, stem, opt) { // a clip recorded by something else (the three-camera rig) joins the list, opens and is saved like any other; opt.tiles: pictures side by side, opt.scene: the scene alone, for a video model
    const ext = type === 'video/mp4' ? '.mp4' : '.webm', c = { blob, url: URL.createObjectURL(blob), name: stem + ext, secs: +secs || 0, scene: sceneTxt || '', stem, type, tiles: (opt && opt.tiles) || 1, angles: (opt && opt.angles) || null, sceneOnly: (opt && opt.scene) || '' };
    clip = c; clips.unshift(c); while (clips.length > 8) { const old = clips.pop(); try { URL.revokeObjectURL(old.url); } catch (e) {} }
    U.togglePanel('director', 'bDir', true); paint(); showClip(c); if (U.canSave()) saveClip(c);
  };
  function saveClip(c) { if (!U.canSave()) return U.toast(T('这个窗口不能保存文件', 'This window cannot save files')); U.save({ filename: c.name, data: c.blob }).then(() => U.save({ filename: c.stem + '.txt', data: c.scene })).then(() => U.toast(T('已保存 ' + c.name + ' 和同名的场景描述 .txt：交给视频模型就能转成实拍', 'Saved ' + c.name + ' and its scene description (.txt): give both to a video model to make it real')), U.saveFail); }
  function showClip(c) { clearPane(B); setPane(A, c.blob, c.name); aSrc = { clip: c, tile: -1 }; markEx(-1); note(YX.hooks && YX.hooks.makeReal ? T('你的片子 · ' + c.secs.toFixed(1) + ' 秒。在右边转成实拍，或者把别处做好的实拍视频拖进来', 'Your clip · ' + c.secs.toFixed(1) + ' s. Make it real on the right, or drop footage you made elsewhere') : T('你的片子 · ' + c.secs.toFixed(1) + ' 秒。在页面外用视频模型转成实拍后，把结果拖到右边，就能并排对比', 'Your clip · ' + c.secs.toFixed(1) + ' s. Once a video model outside this page has turned it into footage, drop the result on the right to compare')); paintMake(); open(); vA.addEventListener('loadeddata', () => { if (cmp.classList.contains('on')) play(); }, { once: true }); }
  function paintClips() {
    const L = $('clipList'); if (!L) return; L.textContent = ''; { const cap = L.previousElementSibling; if (cap && cap.classList.contains('fhint')) cap.style.display = clips.length ? '' : 'none'; }
    if (!clips.length) { const e = document.createElement('div'); e.className = 'empty'; e.textContent = T('录好的片子会出现在这里，并立刻打开播放。', 'What you record appears here and opens straight away.'); L.appendChild(e); return; }
    clips.forEach((c, i) => { const d = document.createElement('div'); d.className = 'scard'; d.innerHTML = '<button class="th" type="button"><video muted playsinline preload="metadata"></video><span class="pl">▶</span><span class="d"></span></button><div class="meta"><span class="nm"></span><button class="mini" type="button">⤓</button></div>';
      const th = d.children[0], v = th.children[0]; v.src = c.url + '#t=0.1'; th.children[2].textContent = c.secs.toFixed(1) + 's'; th.title = T('播放', 'Play'); th.onclick = () => showClip(c);
      { const nm = d.children[1].children[0]; nm.textContent = c.title || (c.tiles > 1 ? T(c.tiles + ' 个机位', c.tiles + ' cameras') : T('手持录制 ', 'By hand ') + (clips.length - i)); nm.title = c.title ? T('镜头“' + c.title + '”录成的视频', 'Video recorded from the shot “' + c.title + '”') : c.tiles > 1 ? T('固定机位同时录的视频', 'Video recorded by the standing cameras') : T('你自己走位时录的视频', 'Video recorded while you moved the camera yourself'); } const dl = d.children[1].children[1]; dl.title = T('再保存一次', 'Save again'); dl.onclick = () => saveClip(c); L.appendChild(d); });
  }
  function paint() {
    const rec = !!mr, sv = $('sVid'), sl = $('sLive'); if (!sv) return; paintClips();
    const rt = $('recT'); if (rt) rt.textContent = rec && mode !== 'shots' ? '' : T('最长 ' + LIMIT + ' 秒', 'up to ' + LIMIT + ' s'); const lb = sl.querySelector('span'); if (lb) lb.textContent = rec && (mode === 'live' || mode === 'move') ? T('停止录制', 'Stop recording') : T('录下我看到的画面', 'Record what I see');
    sv.setAttribute('aria-pressed', String(rec && mode === 'shots')); sl.setAttribute('aria-pressed', String(rec && (mode === 'live' || mode === 'move')));
    sv.disabled = !W.shots.length && !rec;
    const tot = planned(), n = W.shots.length;
    const fd = $('fDur'), over = n && tot > LIMIT, cap = T('连拍只录前 ' + LIMIT + ' 秒', '“Film all” records the first ' + LIMIT + ' s');
    fd.textContent = n ? tot.toFixed(1) + T(' 秒', ' s') : ''; fd.classList.toggle('over', !!over); fd.title = over ? cap : ''; sv.title = over ? cap : '';
  }
  YX.filmPaint = paint;
  $('sVid').onclick = () => start('shots'); $('sLive').onclick = () => start('live');
  for (const b of document.querySelectorAll('#moveRow [data-mv]')) b.onclick = () => { const rec = $('mvRec').getAttribute('aria-pressed') === 'true', r = YX.exec({ op: 'cam', move: b.dataset.mv, rec, instant: true }, YX.newCtx(YX.viewNow())); if (r && r.msg) U.toast(r.msg); };
  $('mvRec').onclick = () => $('mvRec').setAttribute('aria-pressed', String($('mvRec').getAttribute('aria-pressed') !== 'true'));
  $('sPrompt').onclick = () => {
    const text = YX.filmPrompt(), box = $('fPrompt'); box.value = text; box.classList.add('on');
    const ok = () => U.toast(T('提示词已复制', 'Prompt copied')), no = () => { box.focus(); box.select(); U.toast(T('没能自动复制，已选中，请按 Ctrl/⌘+C', 'Could not copy automatically. It is selected: press Ctrl/⌘+C')); };
    try { navigator.clipboard.writeText(text).then(ok, no); } catch (e) { no(); }
  };

  /* ---------- compare ---------- */
  const cmp = $('cmp'), A = $('cmpA'), B = $('cmpB'), vA = A.querySelector('video'), vB = B.querySelector('video'), seek = $('cmpSeek'), div = $('cmpDiv'), stage = $('cmpStage');
  let wipe = 0.5, raf = 0, seeking = false, aSrc = null, making = null;
  const has = (p) => p.classList.contains('has'), dur = (v) => (isFinite(v.duration) && v.duration > 0 ? v.duration : 0);
  const master = () => (has(A) ? vA : has(B) ? vB : null);
  function clearPane(pane) { if (pane === A) aSrc = null; const v = pane.querySelector('video'); try { v.pause(); } catch (e) {} if (v._url) { URL.revokeObjectURL(v._url); v._url = null; } v.removeAttribute('src'); try { v.load(); } catch (e) {} pane.classList.remove('has'); pane.title = ''; }
  function note(t) { const n = $('cmpNote'); if (n) n.textContent = t || ''; }
  function setPane(pane, file, name) {
    const v = pane.querySelector('video'); if (v._url) URL.revokeObjectURL(v._url);
    v._url = URL.createObjectURL(file); v.src = v._url; v.loop = false; if (pane === B) vA.loop = false; else if (!has(B)) v.loop = true; /* a clip on its own plays round and round */ v.muted = pane === A || $('cmpSnd').getAttribute('aria-pressed') !== 'true';
    pane.classList.add('has'); pane.title = name || file.name || ''; v.load(); pause(); applyWipe(); markEx(-1); if (pane === A) aSrc = null; if (typeof paintMake === 'function') setTimeout(paintMake, 0);
    // a clip straight from the recorder may not know its own length yet: seeking far past the end makes the browser work it out
    v.addEventListener('loadedmetadata', () => { if (!isFinite(v.duration)) { const back = () => { v.removeEventListener('timeupdate', back); try { v.currentTime = 0; } catch (e) {} }; v.addEventListener('timeupdate', back); try { v.currentTime = 1e101; } catch (e) {} } }, { once: true });
    if (pane === A && clip && file === clip.blob) { const own = clip; v.addEventListener('durationchange', () => { if (clip === own && isFinite(v.duration) && v.duration > 0) { own.secs = v.duration; paint(); } }); }
  }
  function applyWipe() { // the real footage lies over the previz and shows to the right of the divider
    const on = cmp.classList.contains('wipe'); vB.style.clipPath = on ? 'inset(0 0 0 ' + (wipe * 100).toFixed(2) + '%)' : ''; div.style.left = (wipe * 100).toFixed(2) + '%'; div.setAttribute('aria-valuenow', String(Math.round(wipe * 100)));
  }
  function paintTime() { const m = master(); if (!m) { $('cmpTime').textContent = '0:00.0 / 0:00.0'; return; } const d = dur(m); $('cmpTime').textContent = fmt(m.currentTime) + ' / ' + fmt(d); if (!seeking && d) seek.value = String(Math.round((m.currentTime / d) * 1000)); }
  function loop() {
    raf = requestAnimationFrame(loop); const m = master(); if (!m) return;
    const dA = dur(vA), dB = dur(vB);
    if (has(A) && has(B) && dA && dB && !vA.paused) { // both clips end together even if the model returned a slightly different length
      const k = dB / dA, err = vB.currentTime - vA.currentTime * k;
      if (vB.seeking) { /* let the last seek land */ }
      else if (Math.abs(err) > 0.3) vB.currentTime = Math.min(dB - 0.01, vA.currentTime * k + 0.03); // far off: jump
      else vB.playbackRate = Math.min(4, Math.max(0.25, k * (1 - Math.max(-0.2, Math.min(0.2, err))))); // a little off: drift back without a visible seek
    }
    if (m.ended || (dur(m) && m.currentTime >= dur(m) - 0.02 && !m.paused)) { for (const v of [vA, vB]) { try { v.currentTime = 0; } catch (e) {} } play(); }
    paintTime();
  }
  function play() { const dA = dur(vA), dB = dur(vB); if (has(A) && has(B) && dA && dB) { try { vB.currentTime = Math.min(dB - 0.01, vA.currentTime * (dB / dA)); } catch (e) {} } for (const [p, v] of [[A, vA], [B, vB]]) if (has(p)) { const r = v.play(); if (r && r.catch) r.catch(() => {}); } $('cmpPlay').textContent = T('❚❚ 暂停', '❚❚ Pause'); }
  function pause() { vA.pause(); vB.pause(); $('cmpPlay').textContent = T('▶ 播放', '▶ Play'); }
  const playing = () => { const m = master(); return !!m && !m.paused; };
  function seekTo(f) { const dA = dur(vA), dB = dur(vB); if (has(A) && dA) vA.currentTime = Math.min(dA - 0.01, f * dA); if (has(B) && dB) vB.currentTime = Math.min(dB - 0.01, f * dB); paintTime(); }
  function nudge(dt) { pause(); const m = master(); if (!m || !dur(m)) return; seekTo(Math.min(1, Math.max(0, (m.currentTime + dt) / dur(m)))); }
  /* ---------- make it real, where the page has a video model of its own ----------
     YX.hooks.makeReal({ blob, type, name, stem, secs, prompt, tile, tiles, signal, onState }) -> Promise<{ real: Blob, previz?: Blob }>.
     Only some hosts give the page one; without it nothing shows here and the footage is made outside and dropped in. A clip of three pictures
     side by side is turned one picture at a time: the host cuts that picture out (previz) and the comparison shows it beside its footage. */
  const mk = document.createElement('div'); mk.id = 'cmpMake'; B.appendChild(mk);
  const ANG = [['A', T('跟拍', 'chase')], ['B', T('侧拍', 'side')], ['C', T('低机位正面', 'low front')]];
  /* what the video model is told for a clip: a fixed instruction (keep the camera move and where everything is, make it look real) and a description of the scene,
     written from the world when the clip was recorded (time of day, weather, ground, what the camera saw). It can be read and rewritten before it is sent. */
  const promptOf = (c) => (c.prompt != null ? c.prompt : BASE_PROMPT + ' Scene: ' + (c.sceneOnly || c.scene || YX.sceneText()));
  let promptOpen = false;
  function promptUI(src) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sbtn sm'; b.textContent = T('提示词', 'Prompt') + (src.prompt != null ? T(' · 已改', ' · edited') : '') + (promptOpen ? ' ▴' : ' ▾'); b.title = T('看看、改改发给视频模型的提示词', 'Read and edit what the video model is told'); b.onclick = () => { promptOpen = !promptOpen; paintMake(); }; mk.appendChild(b);
    if (!promptOpen) return;
    const w = document.createElement('div'); w.className = 'mkprompt'; const ta = document.createElement('textarea'); ta.value = promptOf(src); ta.spellcheck = false; ta.setAttribute('aria-label', T('提示词', 'Prompt'));
    const foot = document.createElement('div'), tip = document.createElement('span'); tip.textContent = T('前半段是固定要求，“Scene:” 之后是录制时根据世界自动写的场景描述。改了就按你改的发。', 'The first part is a fixed instruction; after “Scene:” is a description written from the world when this clip was recorded. Your edits are what gets sent.');
    const rs = document.createElement('button'); rs.type = 'button'; rs.className = 'sbtn sm'; rs.textContent = T('恢复自动', 'Reset'); rs.style.display = src.prompt != null ? '' : 'none'; rs.onclick = () => { delete src.prompt; paintMake(); };
    ta.oninput = () => { src.prompt = ta.value; rs.style.display = ''; }; for (const ev of ['keydown', 'keyup', 'keypress']) ta.addEventListener(ev, (e) => e.stopPropagation()); // typing here is typing, not walking
    foot.append(tip, rs); w.append(ta, foot); mk.appendChild(w);
  }
  function paintMake() {
    mk.textContent = ''; const fn = YX.hooks && YX.hooks.makeReal, src = aSrc && aSrc.clip;
    if (making) { mk.style.display = ''; const s = document.createElement('span'); s.className = 'mkst'; s.textContent = making.text; const x = document.createElement('button'); x.type = 'button'; x.className = 'sbtn sm'; x.textContent = T('取消', 'Cancel'); x.onclick = () => { try { making.ctl.abort(); } catch (e) {} }; mk.append(s, x); return; }
    if (!fn || !src || has(B)) { mk.style.display = 'none'; return; }
    mk.style.display = ''; const go = (tile) => makeReal(src, tile);
    if (src.tiles > 1 && aSrc.tile < 0) { const l = document.createElement('span'); l.className = 'mkst'; l.textContent = T('选一个机位转成实拍：', 'Make one angle real:'); mk.appendChild(l); (src.angles || ANG).slice(0, src.tiles).forEach((a, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'sbtn'; b.textContent = a[0] + ' · ' + a[1]; b.onclick = () => go(i); mk.appendChild(b); }); }
    else { const b = document.createElement('button'); b.type = 'button'; b.className = 'sbtn'; b.textContent = T('转成实拍', 'Make it real'); b.onclick = () => go(src.tiles > 1 ? aSrc.tile : -1); mk.appendChild(b); }
    promptUI(src);
  }
  async function makeReal(c, tile) {
    if (making) return; const ctl = new AbortController(), t0 = performance.now(); making = { ctl, text: '' };
    const tickText = (what) => { making.text = what + ' ' + fmt((performance.now() - t0) / 1000); const s = mk.querySelector('.mkst'); if (s) s.textContent = making.text; else paintMake(); };
    let stage = T('准备中…', 'Getting ready…'); tickText(stage); const iv = setInterval(() => making && tickText(stage), 500);
    const prompt = promptOf(c);
    try {
      const r = await YX.hooks.makeReal({ blob: c.blob, type: c.type || c.blob.type, name: c.name, stem: c.stem, secs: c.secs, prompt, tile, tiles: c.tiles || 1, signal: ctl.signal, onState: (s) => { stage = s; } });
      if (!r || !r.real) throw new Error('no video');
      const tag = tile >= 0 ? '-' + ((c.angles || ANG)[tile] || ['X'])[0] : '';
      if (r.previz) { setPane(A, r.previz, c.stem + tag + '.previz'); aSrc = { clip: c, tile }; }
      setPane(B, r.real, c.stem + tag + '.real.mp4'); play();
      note(T('实拍 · 由视频模型生成', 'Real footage · made by the video model'));
      if (U.canSave()) U.save({ filename: c.stem + tag + '.real.mp4', data: r.real }).catch(() => {});
    } catch (e) {
      if (e && e.name === 'AbortError') U.toast(T('已取消', 'Cancelled')); else U.toast(T('没能转成实拍：', 'Could not make it real: ') + ((e && (e.message || e.code)) || e));
    } finally { clearInterval(iv); making = null; paintMake(); }
  }
  /* examples that ship with the page: the same shot as 3D previz and as generated footage */
  const EX = [['01-arrival', '升降落幅 · 黄昏主街', 'Crane down · main street at dusk'], ['02-bus-chase', '航拍跟车 · 双层巴士', 'Drone chase · double-decker'], ['04-morning-ride', '低机位跟拍 · 清晨骑行', 'Tracking shot · morning ride'], ['05-bakery', '室内推进 · 面包店', 'Push in · inside the bakery'], ['03-fountain-night', '环绕 · 夜晚的喷泉', 'Orbit · fountain at night']];
  let exNow = -1, autoEx = -1;
  function tryAuto() { if (autoEx >= 0 && autoEx === exNow && cmp.classList.contains('on') && vA.readyState >= 2 && vB.readyState >= 2) { autoEx = -1; play(); } } // an example starts by itself once both sides can play
  function markEx(i) { exNow = i; for (const b of $('cmpGal').querySelectorAll('button')) b.setAttribute('aria-pressed', String(+b.dataset.i === i)); }
  const exBlobs = new Map(); // what has been downloaded once is not downloaded again
  function setUrl(pane, url, name) { // a file of the page itself. The frame does not let a <video> load it by address, so it is downloaded and played from memory; if that will not play, as a data: address; only then by address
    const v = pane.querySelector('video'), job = (v._job = (v._job || 0) + 1), mine = () => v._job === job;
    const fail = (why) => { if (!mine()) return; note(T('示例没能加载', 'The example could not be loaded') + (why ? ' (' + why + ')' : '')); U.toast(T('示例没能加载', 'The example could not be loaded') + (why ? ': ' + why : '')); };
    const ready = () => { if (!mine()) return; v.onerror = null; if (vA.readyState >= 2 && vB.readyState >= 2) note(''); tryAuto(); };
    const direct = (why) => { if (!mine()) return; v.onerror = () => { v.onerror = null; fail(why); }; v.addEventListener('loadeddata', ready, { once: true }); v.src = url; v.load(); };
    const asData = (b, why) => { if (!mine()) return; const fr = new FileReader(); fr.onload = () => { if (!mine()) return; if (v._url) { URL.revokeObjectURL(v._url); v._url = null; } v.onerror = () => { v.onerror = null; direct(why); }; v.addEventListener('loadeddata', ready, { once: true }); v.src = fr.result; v.load(); }; fr.onerror = () => direct(why); fr.readAsDataURL(b); };
    const show = (b) => { if (!mine()) return; const keep = exNow; setPane(pane, b, name); markEx(keep); v.onerror = () => { v.onerror = null; asData(b, T('这个浏览器不播放内存里的视频', 'this browser will not play the downloaded copy')); }; v.addEventListener('loadeddata', ready, { once: true }); };
    if (v._url) { URL.revokeObjectURL(v._url); v._url = null; } try { v.pause(); } catch (e) {} v.removeAttribute('src'); v.onerror = null;
    v.muted = pane === A || $('cmpSnd').getAttribute('aria-pressed') !== 'true'; pane.classList.add('has'); pane.title = name; note(T('正在载入示例…', 'Loading the example…'));
    if (exBlobs.has(url)) return show(exBlobs.get(url));
    fetch(url).then((r) => (r.ok ? r.blob() : Promise.reject(new Error('HTTP ' + r.status)))).then((b) => { const mp4 = new Blob([b], { type: 'video/mp4' }); exBlobs.set(url, mp4); show(mp4); }).catch((e) => direct(String((e && e.message) || e || '').slice(0, 80)));
  }
  function showEx(i, auto) { aSrc = null; setTimeout(paintMake, 0); const e = EX[i]; if (!e) return; pause(); note(''); vA.loop = false; setUrl(A, 'media/' + e[0] + '.previz.mp4', e[0]); setUrl(B, 'media/' + e[0] + '.real.mp4', e[0] + ' real'); applyWipe(); markEx(i); autoEx = auto ? i : -1; }
  function paintGal() { const g = $('cmpGal'); g.textContent = ''; const l = document.createElement('span'); l.textContent = T('示例', 'Examples'); g.appendChild(l); EX.forEach((e, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'sbtn'; b.dataset.i = i; b.textContent = T(e[1], e[2]); b.setAttribute('aria-pressed', String(i === exNow)); b.onclick = () => showEx(i, true); g.appendChild(b); }); }
  function open() {
    if (mr) return; U.closePops(); if (document.pointerLockElement) document.exitPointerLock();
    cmp.classList.add('on'); document.body.classList.add('cmp-on'); paintGal(); if (clip && !has(A)) setPane(A, clip.blob, clip.name); else if (!has(A) && !has(B)) showEx(0, true); applyWipe(); if (!raf) loop(); $('cmpPlay').focus();
  }
  function close() { pause(); cmp.classList.remove('on'); document.body.classList.remove('cmp-on'); if (raf) cancelAnimationFrame(raf); raf = 0; canvas.focus(); }
  YX.compare = { open, close, set: (side, file, name) => setPane(side === 'b' ? B : A, file, name) };
  $('sCmp').onclick = () => { if (exNow < 0) showEx(0, true); open(); }; $('cmpX').onclick = close; // the Examples button always lands on an example
  $('cmpPlay').onclick = () => (playing() ? pause() : play());
  $('cmpMode').onclick = () => { const on = !cmp.classList.contains('wipe'); cmp.classList.toggle('wipe', on); $('cmpMode').setAttribute('aria-pressed', String(on)); applyWipe(); };
  $('cmpSnd').onclick = () => { const on = $('cmpSnd').getAttribute('aria-pressed') !== 'true'; $('cmpSnd').setAttribute('aria-pressed', String(on)); vB.muted = !on; };
  seek.addEventListener('input', () => { seeking = true; seekTo(+seek.value / 1000); }); seek.addEventListener('change', () => { seeking = false; });
  for (const pane of [A, B]) {
    const input = pane.querySelector('input'), pick = (f) => { if (f && /^video\//.test(f.type || 'video/')) setPane(pane, f, f.name); else if (f) U.toast(T('这不是视频文件', 'That is not a video file')); };
    input.addEventListener('change', () => { pick(input.files && input.files[0]); input.value = ''; });
    pane.querySelector('.cmpswap').onclick = () => input.click();
    pane.addEventListener('dragover', (e) => { e.preventDefault(); pane.classList.add('over'); });
    pane.addEventListener('dragleave', () => pane.classList.remove('over'));
    pane.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); pane.classList.remove('over'); pick(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); });
  }
  // in wipe mode the real footage covers the previz pane, so a file dropped anywhere goes to whichever side is still empty
  stage.addEventListener('dragover', (e) => e.preventDefault());
  stage.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) setPane(!has(A) ? A : B, f, f.name); });
  let dragW = false;
  const wipeAt = (e) => { const r = stage.getBoundingClientRect(); wipe = Math.min(0.98, Math.max(0.02, (e.clientX - r.left) / Math.max(1, r.width))); applyWipe(); };
  div.addEventListener('pointerdown', (e) => { dragW = true; div.setPointerCapture(e.pointerId); wipeAt(e); });
  div.addEventListener('pointermove', (e) => { if (dragW) wipeAt(e); });
  div.addEventListener('pointerup', () => { dragW = false; }); div.addEventListener('pointercancel', () => { dragW = false; });
  window.addEventListener('keydown', (e) => {
    if (!cmp.classList.contains('on')) return;
    const onDiv = document.activeElement === div;
    if (e.code === 'Escape') { e.preventDefault(); close(); }
    else if (e.code === 'Space' && !/^(BUTTON|INPUT)$/.test((e.target && e.target.tagName) || '')) { e.preventDefault(); playing() ? pause() : play(); }
    else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { if (e.target === seek) return; e.preventDefault(); const s = e.code === 'ArrowLeft' ? -1 : 1; if (onDiv) { wipe = Math.min(0.98, Math.max(0.02, wipe + s * 0.02)); applyWipe(); } else nudge(s / 24); }
  }, true);
  paint();
})();
