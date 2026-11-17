/* Spoken World — the people talk.
   Every person is somebody: a name, a trade read from where they stand in the world, a home, a memory of what was said to them
   and of what they have seen the player's words do. Click somebody (or say "talk to this person") and they come over; from then on
   what you say goes to them, until you say goodbye or walk away. When you pass near people, some of them call out to you — a remark
   of their own, not the start of a conversation: what you say next still goes to the world unless you answer them or click them. */
(function () {
  'use strict';
  const YX = window.YX, W = YX.world, M = YX.mind, T = YX.T, hooks = YX.hooks, G = YX.GEN, $ = (id) => document.getElementById(id), now = () => performance.now();
  // what people say is read in a bubble; the browser's synthetic voice is off unless asked for (stored under a new name, so an old saved 'on' does not bring it back)
  const PKEY = 'yanchu.talk.v1'; let S = { speak: false, greet: true }; try { Object.assign(S, JSON.parse(localStorage.getItem(PKEY) || '{}')); } catch (e) {}
  const save = () => { try { localStorage.setItem(PKEY, JSON.stringify(S)); } catch (e) {} };
  const isPerson = (o) => !!o && !o.dead && o.type === 'person', zh = () => YX.lang === 'zh';

  /* ---------- who somebody is ---------- */
  const NAMES = { en: ['Maya', 'Tom', 'Rosa', 'Eli', 'Nora', 'Sam', 'Ivy', 'Hugo', 'Lena', 'Otis', 'Mina', 'Jack', 'Ada', 'Leo', 'Greta', 'Ben', 'Clara', 'Finn', 'June', 'Walt'], zh: ['小满', '阿杰', '春燕', '大刘', '晓雯', '老周', '一诺', '建国', '美玲', '阿福', '思雨', '志强', '秀兰', '小北', '婉清', '阿明', '晴晴', '国栋', '念念', '老陈'] };
  const KIDS = { en: ['Pip', 'Lulu', 'Milo', 'Zoe', 'Teddy', 'Nell', 'Max', 'Bea'], zh: ['豆豆', '乐乐', '朵朵', '小宝', '糖糖', '阳阳', '果果', '笑笑'] };
  const JOBS = { en: ['a teacher at the town school', 'the postman', 'a nurse', 'a carpenter', 'a painter who sells watercolours at the market', 'a bus driver on route 12', 'a retired sailor', 'a student home for the holidays', 'a musician who plays at the café', 'the town gardener', 'a doctor', 'the librarian', 'a clockmaker who looks after the clock tower', 'a beekeeper'], zh: ['镇上小学的老师', '邮递员', '护士', '木匠', '在集市卖水彩画的画家', '12 路公交司机', '退休的老水手', '放假回家的学生', '在咖啡馆演奏的乐手', '镇上的园丁', '医生', '图书管理员', '照看钟楼的钟表匠', '养蜂人'] };
  const QUIRKS = { en: ['loves talking about the weather', 'is proud of this town', 'is a little shy', 'jokes a lot', 'is always in a hurry', 'knows everybody\'s business', 'is curious about strangers', 'hums while thinking'], zh: ['爱聊天气', '很为这个小镇自豪', '有点腼腆', '爱开玩笑', '总是急匆匆的', '镇上的事没有不知道的', '对外来的人很好奇', '想事情时爱哼歌'] };
  const GOODS = { fruit: ['fruit', '水果'], flowers: ['flowers', '鲜花'], bread: ['bread and pastries', '面包和点心'], vegetables: ['vegetables', '蔬菜'], books: ['second-hand books', '旧书'], fish: ['fresh fish', '鲜鱼'] };
  const nearest = (o, pred, max) => { let best = null, bd = max; for (const k of W.objs.values()) { if (k === o || k.dead || !pred(k)) continue; const d = Math.hypot(k.x - o.x, k.z - o.z); if (d < bd) { bd = d; best = k; } } return best; };
  const lab = (o) => (o ? (o.name || (o.params && o.params.name) || YX.labelOf(YX.defOf(o)) || o.type) : '');
  function whoIs(o) {
    if (o.params._who && o.params._who.n) return o.params._who;
    const L = zh() ? 'zh' : 'en', k = L === 'zh' ? 1 : 0, R = YX.rng(((o.seed || o.id) ^ 0x51ed) >>> 0), pick = (a) => a[Math.floor(R() * a.length)], kid = o.params.age === 'child';
    const par = o.attach ? W.objs.get(o.attach.to) : null, room = YX.roomOf && YX.roomOf(o) != null ? W.objs.get(YX.roomOf(o)) : null;
    const stall = nearest(o, (x) => x.type === 'stall', 2.4), cart = nearest(o, (x) => x.type === 'cart', 2.6), home = nearest(o, (x) => x.type === 'house', 400);
    let role;
    if (kid) role = par && (par.type === 'slide' || par.type === 'swing') ? T('一个正在玩' + lab(par) + '的小孩', 'a kid playing on the ' + lab(par).toLowerCase()) : nearest(o, (x) => x.type === 'sandbox', 3) ? T('一个在沙坑里挖沙子的小孩', 'a kid digging in the sandbox') : T('镇上的小孩', 'a kid from the town');
    else if (stall && (o.z - stall.z) * Math.cos(stall.rot) + (o.x - stall.x) * Math.sin(stall.rot) < 0) role = T('在集市摆摊卖' + (GOODS[stall.params.goods] || GOODS.fruit)[1] + '的摊主', 'a stallholder who sells ' + (GOODS[stall.params.goods] || GOODS.fruit)[0] + ' at the market');
    else if (cart) role = T('卖冰淇淋的小贩', 'the ice-cream seller');
    else if (room && (room.type === 'shop' || room.type === 'cafe')) role = nearest(o, (x) => x.type === 'counter', 2.2) ? T('“' + lab(room) + '”的店主', 'the keeper of the ' + lab(room) + ' shop') : T('在“' + lab(room) + '”里逛的客人', 'a customer in the ' + lab(room) + ' shop');
    else if (nearest(o, (x) => x.type === 'pier', 7)) role = T('在栈桥上钓鱼的人', 'an angler fishing off the pier');
    else if (nearest(o, (x) => x.type === 'campfire', 5)) role = T('在林边露营的旅人', 'a traveller camping at the edge of the woods');
    else if (nearest(o, (x) => x.type === 'barn' || x.type === 'field', 16)) role = T('种这片地的农夫', 'the farmer who works these fields');
    else if (stall) role = T('来集市买东西的镇民', 'a townsperson shopping at the market');
    else role = pick(JOBS[L]);
    const who = { n: pick(kid ? KIDS[L] : NAMES[L]), r: role, h: home ? T('住在', 'lives in ') + T('', 'the ') + lab(home) + ' #' + home.id + T('', '') : '', q: pick(QUIRKS[L]), l: L };
    o.params._who = who; if (!o.name) o.name = who.n; YX.markDirty(); return who;
  }
  YX.whoIs = whoIs;

  /* ---------- what they have seen: every command the player gives is an event somewhere ---------- */
  const events = []; // { t, x, z, said, did, env }
  const finish0 = hooks.afterCommand;
  hooks.afterCommand = function (text, ops, msgs, view) { try { events.push({ t: Date.now(), x: view ? view.x : 0, z: view ? view.z : 0, said: String(text || '').slice(0, 90), did: (msgs || []).join('; ').slice(0, 140), env: (ops || []).some((o) => o && (o.op === 'env' || o.op === 'plan')) }); if (events.length > 40) events.shift(); } catch (e) {} if (finish0) finish0.apply(this, arguments); };
  const seenBy = (o) => events.filter((e) => e.env || Math.hypot(e.x - o.x, e.z - o.z) < 60).slice(-5);

  /* ---------- voice ---------- */
  function speak(text, o) {
    try { if (!S.speak || !window.speechSynthesis || !text) return; if ($('live') && $('live').getAttribute('aria-pressed') === 'true') return; // with the microphone always open they would hear themselves
      const u = new SpeechSynthesisUtterance(text), lang = /[一-鿿]/.test(text) ? 'zh' : 'en', vs = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith(lang)), R = YX.rng(((o.seed || o.id) ^ 0x7a11) >>> 0);
      if (vs.length) u.voice = vs[Math.floor(R() * vs.length)]; u.lang = lang === 'zh' ? 'zh-CN' : 'en-US'; u.pitch = o.params.age === 'child' ? 1.6 : 0.75 + R() * 0.6; u.rate = 1.03; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {}
  }
  const hush = () => { try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {} };

  /* ---------- on screen: a bubble over the head, a line at the bottom, a pill at the top ---------- */
  // what a person says is the thing to read in that moment, so the bubble is sized from the screen (about 20 px of text on a 1280-wide window, never under 15) and everything in it follows the text size
  const css = document.createElement('style'); css.textContent = '#npcBubble{position:fixed;left:0;top:0;z-index:4;width:max-content;max-width:min(24em,78vw);padding:.55em .85em .65em;border-radius:.8em;background:rgba(246,247,249,.96);color:#0a0d12;font:500 clamp(15px,1.56vw,22px)/1.35 var(--f-ui);box-shadow:0 6px 24px rgba(0,0,0,.3);pointer-events:none;opacity:0;transition:opacity .18s}#npcBubble.on{opacity:1}#npcBubble.loose::after{display:none}#npcBubble::after{content:"";position:absolute;left:var(--tx,50%);bottom:-10px;margin-left:-10px;border:10px solid transparent;border-bottom:0;border-top-color:rgba(246,247,249,.96)}#npcBubble b{display:block;font:600 .65em/1 var(--f-mono);letter-spacing:.12em;text-transform:uppercase;color:#5b6470;margin-bottom:.38em}#talkPill{position:fixed;left:50%;top:58px;transform:translateX(-50%);z-index:5;display:none;align-items:center;gap:10px;padding:7px 8px 7px 14px;font-size:12.5px;white-space:nowrap}#talkPill.on{display:flex}#talkPill i{width:7px;height:7px;border-radius:50%;background:var(--voice)}#talkPill b{font-weight:600}#talkPill span{color:var(--paper-dim)}#talkPill button{padding:4px 10px;border-radius:6px;border:1px solid var(--line);background:rgba(255,255,255,.06);font-size:11.5px}body.cinema #npcBubble,body.cinema #talkPill,body.title #npcBubble,body.title #talkPill{display:none}'; document.head.appendChild(css);
  const bubble = document.createElement('div'); bubble.id = 'npcBubble'; bubble.innerHTML = '<b></b><span></span>'; document.body.appendChild(bubble);
  const pill = document.createElement('div'); pill.id = 'talkPill'; pill.className = 'glass'; pill.innerHTML = '<i></i><b></b><span></span><button type="button"></button>'; document.body.appendChild(pill);
  let bub = null; // { o, until }
  function say(o, text, hold) { const who = whoIs(o); bubble.children[0].textContent = who.n; bubble.children[1].textContent = text; bub = { o, until: now() + (hold || Math.max(3200, 1200 + text.length * 70)) }; bubble.classList.add('on'); place(); }
  const _v = new THREE.Vector3();
  // a bubble belongs over the speaker's head, but never on top of the interface: it is fitted into what is left of the screen once every panel, pill, chip and label on it has been set aside
  const UI_SEL = '.glass, #chips > *, #bar .hint, #log > *, #spell, #aimLabel, #toasts > *'; let obs = [], obsT = -1e9;
  function panels() { const t = now(); if (t - obsT < 240) return obs; obsT = t; obs = [];
    for (const el of document.querySelectorAll(UI_SEL)) { if (el === bubble || el.id === 'hailTag' || el.closest('#intro')) continue; const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight || r.width > innerWidth * 0.96 && r.height > innerHeight * 0.8) continue; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.05) continue; obs.push(r); }
    return obs; }
  function fit(ax, ay, w, h) { const M = 10, G = 8, W0 = innerWidth, H0 = innerHeight, cl = (v, a, b) => Math.max(a, Math.min(Math.max(a, b), v)); let L = cl(ax - w / 2, M, W0 - w - M), T = cl(ay - h, M, H0 - h - M); const P = panels();
    for (let pass = 0; pass < 6; pass++) { let hit = null; for (const r of P) if (L < r.right + G && L + w > r.left - G && T < r.bottom + G && T + h > r.top - G) { hit = r; break; } if (!hit) break;
      const c = [[L, hit.bottom + G], [L, hit.top - G - h], [hit.left - G - w, T], [hit.right + G, T]].filter((q) => q[0] >= M && q[1] >= M && q[0] + w <= W0 - M && q[1] + h <= H0 - M).sort((p, q) => Math.abs(p[0] - L) + Math.abs(p[1] - T) - Math.abs(q[0] - L) - Math.abs(q[1] - T)); if (!c.length) break; L = c[0][0]; T = c[0][1]; }
    return [L, T]; }
  function place() { if (!bub) return; const o = bub.o, cam = YX.three.camera; if (!o || o.dead || now() > bub.until) { bub = null; bubble.classList.remove('on'); return; } _v.set(o.x, o.y + (o.size ? o.size[1] : 1.8) + 0.3, o.z).project(cam); if (_v.z > 1 || _v.z < -1) { bubble.style.opacity = 0; return; } bubble.style.opacity = '';
    const ax = (_v.x * 0.5 + 0.5) * innerWidth, ay = (-_v.y * 0.5 + 0.5) * innerHeight - 11, w = bubble.offsetWidth, h = bubble.offsetHeight, q = fit(ax, ay, w, h);
    bubble.style.left = Math.round(q[0]) + 'px'; bubble.style.top = Math.round(q[1]) + 'px'; bubble.style.setProperty('--tx', Math.round(Math.max(24, Math.min(w - 24, ax - q[0]))) + 'px'); bubble.classList.toggle('loose', Math.abs(q[1] + h - ay) > 26 || ax < q[0] + 6 || ax > q[0] + w - 6); } // the little tail points at the head only while the bubble really is above it

  /* ---------- a conversation ---------- */
  const talk = { id: null, last: 0, prev: null, ctl: null, n: 0, how: null }; // how it began: null (you walked up), 'hail' (you called them over)
  const BYE = /^(?:bye|goodbye|good bye|bye bye|see you|see ya|farewell|that'?s all|thanks,? bye|stop talking|never mind|拜拜|再见|回头见|回见|不聊了|先这样|就这样吧|走了|我走了)[\s,.!?。！？~]*(?:.{0,12})$/i;
  function face(o) { if (o.attach) return; const P = W.player; o.rot = Math.atan2(P.x - o.x, P.z - o.z); if (YX.syncHolder) YX.syncHolder(o); }
  function paintPill() { const o = talk.id != null ? W.objs.get(talk.id) : null; pill.classList.toggle('on', !!o); if (!o) return; const who = whoIs(o); pill.children[1].textContent = T('正在和 ' + who.n + ' 说话', 'Talking with ' + who.n); pill.children[2].textContent = who.r + T(' · 说“再见”结束；你对世界下的指令照常生效', ' · say goodbye to end; commands to the world still work'); pill.children[3].textContent = T('结束', 'End'); }
  pill.children[3].onclick = () => end();
  function start(o, first, how) {
    if (talk.id === o.id) { if (first) ask(o, first); return; }
    end(true); talk.id = o.id; talk.how = how || null; talk.last = now(); talk.prev = { motion: o.motion }; if (o.motion && o.motion !== 'none' && !o.attach) { o.motion = 'none'; o.ms = null; } face(o); paintPill(); YX.sfx && YX.sfx('env');
    ask(o, first || null);
  }
  function end(quiet) { const o = talk.id != null ? W.objs.get(talk.id) : null; if (talk.ctl) { try { talk.ctl.abort(); } catch (e) {} talk.ctl = null; } talk.id = null; talk.how = null; paintPill(); if (o && !o.dead && talk.prev && talk.prev.motion && talk.prev.motion !== 'none' && !o.attach && !followers.has(o.id)) { o.motion = talk.prev.motion; YX.initMotion(o); } talk.prev = null; if (!quiet) hush(); }
  const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
  function around(o) { const out = []; for (const k of W.objs.values()) { if (k === o || k.dead || k.type === 'cloud' || k.type === 'road' || (k.params && k.params._static)) continue; const d = Math.hypot(k.x - o.x, k.z - o.z); if (d < 16) out.push([d, k]); } out.sort((a, b) => a[0] - b[0]); return out.slice(0, 10).map((p) => lab(p[1]) + ' #' + p[1].id + (isPerson(p[1]) && p[1].params._who ? ' (' + p[1].params._who.n + ', ' + p[1].params._who.r + ')' : '') + ' ' + Math.round(p[0]) + 'm').join('; '); }
  // the things the stranger names, wherever they are in town: "go and wait at the bus stop" must not fail because the stop is beyond the few steps a person can see
  const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function farNamed(o, text) {
    if (!text) return ''; let s = ' ' + String(text).toLowerCase() + ' '; const near = new Set(); for (const k of W.objs.values()) if (!k.dead && Math.hypot(k.x - o.x, k.z - o.z) < 16) near.add(k.id);
    // the words for each kind of thing in town (and the names on signs), longest first: "bus stop" is a bus stop, not a bus
    const cands = []; const seenT = new Set();
    for (const k of W.objs.values()) { if (k.dead || k === o) continue; if (!seenT.has(k.type)) { seenT.add(k.type); const def = YX.defOf(k) || {}; for (const w of [YX.labelOf(def), k.type, ...(def.nouns || [])]) if (w && String(w).length > 1) cands.push([String(w).toLowerCase(), 'type', k.type]); }
      const nm = k.params && typeof k.params.name === 'string' && k.params.name.length > 2 ? k.params.name.toLowerCase() : null; if (nm) cands.push([nm, 'id', k.id]); }
    cands.sort((a, b) => b[0].length - a[0].length); const types = new Set(), ids = new Set();
    for (const [w, kind, v] of cands) { const re = /[一-鿿]/.test(w) ? new RegExp(esc(w)) : new RegExp('([^a-z])' + esc(w) + '(s?)(?=[^a-z])'); if (!re.test(s)) continue; (kind === 'type' ? types : ids).add(v); s = s.replace(re, (m0) => ' '.repeat(m0.length)); }
    const per = new Map();
    for (const k of W.objs.values()) {
      if (k.dead || k === o || near.has(k.id) || k.type === 'road' || k.type === 'cloud' || (k.params && k.params._static) || !(types.has(k.type) || ids.has(k.id))) continue;
      const d = Math.hypot(k.x - o.x, k.z - o.z), key = ids.has(k.id) ? 'id' + k.id : k.type, L = per.get(key) || []; L.push([d, k]); per.set(key, L);
    }
    const out = []; for (const L of per.values()) { L.sort((a, b) => a[0] - b[0]); for (const [d, k] of L.slice(0, 2)) out.push([d, k]); }
    out.sort((a, b) => a[0] - b[0]);
    const dir = (k) => { const a = Math.atan2(k.x - o.x, -(k.z - o.z)) * 180 / Math.PI, i = Math.round(((a + 360) % 360) / 45) % 8; return zh() ? ['北', '东北', '东', '东南', '南', '西南', '西', '西北'][i] : ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][i]; };
    const kind = (k) => { const L = YX.labelOf(YX.defOf(k)) || k.type, nm = k.params && typeof k.params.name === 'string' ? k.params.name : ''; return nm && nm.toLowerCase() !== String(L).toLowerCase() ? L + ' "' + nm + '"' : L; };
    return out.slice(0, 6).map(([d, k]) => kind(k) + ' #' + k.id + ' ' + Math.round(d) + 'm ' + dir(k)).join('; ');
  }
  // what the person is doing with their body right now, so "hands down" means something to them
  function bodyNow(o) {
    const p = o.params.pose, g = o.params.gesture, base = o.attach ? T('待在 ', 'at the ') + lab(W.objs.get(o.attach.to)) : p === 'sit' ? T('坐着', 'sitting') : p === 'walk' && o.motion !== 'none' ? T('在走路', 'walking') : T('站着', 'standing');
    const gest = p === 'wave' || g === 'wave' ? T('举着一只手在挥', 'waving one arm in the air') : g === 'cheer' ? T('两只手举过头顶在欢呼', 'cheering with both arms up') : g === 'clap' ? T('在拍手', 'clapping') : g === 'laugh' ? T('在笑', 'laughing') : g === 'talk' ? T('边说边比划', 'talking with your hands') : '';
    return base + (gest ? T('，' + gest + '（会一直这样，直到你选 {"do":"still"}）', ', ' + gest + ' (you keep doing it until you choose {"do":"still"})') : '') + ((o.params._when || []).length ? T('。你答应过：' + o.params._when.map((r) => r.what).join('；'), '. You promised: ' + o.params._when.map((r) => r.what).join('; ')) : '');
  }
  function prompt(o, text, saw) {
    const who = whoIs(o), E = W.env, mem = (o.params._mem || []).slice(-6), ev = seenBy(o), doing = bodyNow(o), en = !zh(), far = farNamed(o, text);
    if (en) return 'You are ' + who.n + ', ' + who.r + (o.params.age === 'child' ? ' (about seven years old)' : '') + ', in a small town. ' + (who.h ? who.n + ' ' + who.h + '. ' : '') + 'Personality: ' + who.q + '.\nA stranger has walked up to you. Strange things happen around this stranger: when they speak, the world changes (houses grow, weather turns, things appear). You have noticed, and you have feelings about it.\n'
      + 'Now: ' + YX.clock(E.time) + ', weather ' + E.weather + '. You are ' + doing + '. Around you: ' + (around(o) || 'open ground') + '.\n'
      + (far ? 'Further away in town, the things the stranger names: ' + far + '. You know the town well: you can walk to any of these.\n' : '')
      + (ev.length ? 'What you saw happen lately when the stranger spoke: ' + ev.map((e) => '"' + e.said + '" -> ' + (e.did || 'something changed')).join(' | ') + '\n' : '')
      + (mem.length ? 'What the two of you said before:\n' + mem.join('\n') + '\n' : 'You have not spoken with this stranger before.\n')
      + (saw ? 'Just now, in the middle of your conversation, the stranger turned and said to the air: "' + clip(saw.said, 200) + '" and it happened in front of you: ' + (saw.did || 'the world changed') + '. React to what you just saw, as ' + who.n + ' would.\n' : text ? 'The stranger says: "' + clip(text, 300) + '"\n' : (talk.how === 'hail' ? 'The stranger has just beckoned you over, and you are walking up to them. ' : 'The stranger has just walked up and is looking at you. ') + 'Greet them the way ' + who.n + ' would, and mention one concrete thing about your day or this place.\n')
      + (followers.has(o.id) ? 'Right now you are FOLLOWING the stranger around, because they asked you to earlier.\n' : '')
      + 'Answer in exactly two lines.\nLine 1: what ' + who.n + ' says out loud: one or two short spoken sentences, in the language the stranger used' + (text ? '' : ' (English)') + ', in character, no narration, no quotation marks, no emoji. Use what is really around you and what really happened; do not invent places that are not listed.\n'
      + 'Line 2: what ' + who.n + ' does now, as JSON, ALWAYS present: {"do":"none"} | {"do":"walk","to":"#ID of a listed thing"} | {"do":"come"} (walk up to the stranger) | {"do":"follow"} (keep walking along with the stranger) | {"do":"stay"} (stop following, stay where you are) | {"do":"sit"} | {"do":"stand"} | {"do":"wave"} | {"do":"cheer"} | {"do":"still"} (stop waving or cheering, arms down) | {"do":"when","near":"bus" or "#ID","within":12,"then":["wave",{"do":"walk","to":"it"}],"say":"There it is!"} (wait until that comes close to you, then do it; instead of near: "weather":"rain" or "time":"18:30") | {"do":"bye"} (the conversation is over).\nIf the stranger asks you to do something later or when something happens, line 2 is a when rule, and line 1 says you will.\n'
      + 'What you say and what you do must agree: if you say you will stop following or leave them alone, line 2 must be {"do":"stay"}; if you agree to come along, it must be {"do":"follow"}.';
    return '你是' + who.n + '，' + who.r + (o.params.age === 'child' ? '（大约七岁）' : '') + '，住在一个小镇上。' + (who.h ? who.n + who.h + '。' : '') + '性格：' + who.q + '。\n一个陌生人走到你面前。这个陌生人身边总有怪事：他一开口，世界就变（房子变高、天气突变、东西凭空出现）。你注意到了，也有自己的感受。\n'
      + '现在：' + YX.clock(E.time) + '，天气' + YX.wxName(E.weather) + '。你正' + doing + '。你周围有：' + (around(o) || '一片空地') + '。\n'
      + (far ? '镇上远一点的地方，陌生人说到的东西：' + far + '。你熟悉这个镇子，这些地方都走得过去。\n' : '')
      + (ev.length ? '最近陌生人开口时你看到的事：' + ev.map((e) => '“' + e.said + '”→' + (e.did || '有东西变了')).join(' | ') + '\n' : '')
      + (mem.length ? '你们之前说过的话：\n' + mem.join('\n') + '\n' : '你以前没和这个陌生人说过话。\n')
      + (saw ? '就在刚才，你们正说着话，陌生人转头对着空气说了一句：“' + clip(saw.said, 200) + '”，然后这件事就在你眼前发生了：' + (saw.did || '世界变了') + '。用' + who.n + '的口吻对刚看到的事做出反应。\n' : text ? '陌生人说：“' + clip(text, 300) + '”\n' : (talk.how === 'hail' ? '陌生人刚朝你招了招手，你正朝他走过去。' : '陌生人刚走过来，正看着你。') + '用' + who.n + '的口吻打个招呼，顺口提一件今天的事或这个地方的事。\n')
      + (followers.has(o.id) ? '你现在正跟着这个陌生人走，因为他之前让你跟着。\n' : '')
      + '严格输出两行。\n第一行：' + who.n + '说出口的话：一两句简短的口语，用陌生人使用的语言' + (text ? '' : '（中文）') + '，符合人设，不要旁白，不要引号，不要表情符号。只说周围真实存在的东西和真实发生过的事，不要编造没列出的地点。\n'
      + '第二行：' + who.n + '现在做什么，JSON，必须有：{"do":"none"} | {"do":"walk","to":"#列出的物体ID"} | {"do":"come"}（走到陌生人跟前）| {"do":"follow"}（一直跟着陌生人走）| {"do":"stay"}（不再跟着，留在原地）| {"do":"sit"} | {"do":"stand"} | {"do":"wave"} | {"do":"cheer"} | {"do":"still"}（不再挥手或欢呼，放下手）| {"do":"when","near":"公交车" 或 "#ID","within":12,"then":["wave",{"do":"walk","to":"it"}],"say":"车来了！"}（等那个东西来到你身边再做；也可以不用 near，用 "weather":"rain" 或 "time":"18:30"）| {"do":"bye"}（对话结束）。\n陌生人让你过一会儿或者等某件事发生时再做什么，第二行就用 when，第一行说你会照做。\n'
      + '说的和做的必须一致：嘴上说不跟了、不打扰了，第二行就必须是 {"do":"stay"}；答应一起走，就必须是 {"do":"follow"}。';
  }
  const DO = { none: null, still: () => ({ op: 'still' }), lower: () => ({ op: 'still' }), when: (q) => Object.assign({}, q, { op: 'when' }), walk: (q) => ({ op: 'walk', to: q.to }), come: () => ({ op: 'walk', to: 'player' }), follow: () => ({ op: 'follow' }), stay: () => ({ op: 'stay' }), stop: () => ({ op: 'stay' }), sit: () => ({ op: 'set', params: { pose: 'sit' } }), stand: () => ({ op: 'set', params: { pose: 'stand' } }), wave: () => ({ op: 'set', params: { gesture: 'wave' } }), cheer: () => ({ op: 'set', params: { gesture: 'cheer' } }), bye: () => ({ op: 'bye' }) };
  function parse(txt) { const ops = [], say = []; let stated = false;
    for (const line of String(txt || '').split(/\n+/)) { let s = line.trim().replace(/^(?:line\s*[12]|第[一二]行)\s*[:：]\s*/i, ''); if (!s) continue; const i = s.indexOf('{'), j = s.lastIndexOf('}');
      if (i >= 0 && j > i && /"(?:do|op)"/.test(s)) { try { const q = JSON.parse(s.slice(i, j + 1)); stated = true; if (q.do != null) { const f = DO[String(q.do).toLowerCase()]; if (f) ops.push(f(q)); } else if (q.op) ops.push(q); } catch (e) {} if (i > 0) say.push(s.slice(0, i).trim()); } else if (i === 0 && j < 0) continue; else say.push(s); } // a half-received JSON line is not speech
    return { say: clip(say.join(' ').replace(/^["“”']+|["“”']+$/g, ''), 280), ops, stated }; }
  function act(o, op) { // what they agreed to do, done by the same engine that runs the player's commands
    const k = String(op.op || '').toLowerCase(), ctx = YX.newCtx(YX.viewNow()), id = '#' + o.id;
    mine++; try {
      if (k === 'bye') return setTimeout(() => { if (talk.id === o.id) end(true); }, 2600);
      if (k === 'walk') { if (talk.prev) talk.prev.motion = 'none'; followers.delete(o.id); if (op.to === 'player' || op.to === 'me') return goNear(o, 1.8); if (typeof op.to === 'string' && /^#\d+$/.test(op.to) && W.objs.get(+op.to.slice(1))) return YX.exec({ op: 'walk', id, to: { near: op.to, side: 'front' } }, ctx); return; }
      if (k === 'set' && op.params && typeof op.params === 'object') { const pr = {}; for (const key of ['pose', 'gesture']) if (typeof op.params[key] === 'string') pr[key] = op.params[key]; if (Object.keys(pr).length) return YX.exec({ op: 'set', id, params: pr }, ctx); }
      if (k === 'follow') { if (talk.prev) talk.prev.motion = 'none'; followers.add(o.id); return goNear(o, 2.4); }
      if (k === 'stay') { if (talk.prev) talk.prev.motion = 'none'; followers.delete(o.id); if (!o.attach) { o.motion = 'none'; o.ms = null; } }
      if (k === 'still') { const pr = { gesture: 'none' }; if (o.params.pose === 'wave') pr.pose = 'stand'; return YX.exec({ op: 'set', id, params: pr }, ctx); }
      if (k === 'when') return addRule(o, op);
    } catch (e) { console.warn('npc act', e); } finally { mine--; }
  }
  // "when the bus comes, wave and walk to it": a promise kept on the person, looked at twice a second, kept once when the moment comes (or dropped after a quarter of an hour)
  function matchesKind(k, word, loose) { const def = YX.defOf(k) || {}, w = String(word || '').toLowerCase().replace(/^(?:the|a|an) /, '').trim(); if (!w) return false; const words = [YX.labelOf(def), k.name, k.type, ...(def.nouns || [])].filter(Boolean).map((x) => String(x).toLowerCase()); return words.some((x) => x === w || x === w.replace(/s$/, '') || (loose && w.length > 2 && x.includes(w))); } // a bus is a bus: the bus stop only counts if nothing in town is called exactly that
  function ruleTarget(o, r) { let best = null, bd = 1e9; if (/^#\d+$/.test(String(r.near))) { const k = W.objs.get(+String(r.near).slice(1)); return k && !k.dead ? [k, Math.hypot(k.x - o.x, k.z - o.z)] : null; }
    for (const loose of [false, true]) { for (const k of W.objs.values()) { if (k.dead || k === o || !matchesKind(k, r.near, loose)) continue; const d = Math.hypot(k.x - o.x, k.z - o.z); if (d < bd) { bd = d; best = k; } } if (best) break; } return best ? [best, bd] : null; }
  function ruleState(o, r) { if (r.near != null) { const t = ruleTarget(o, r); return { on: !!t && t[1] <= r.within, it: t && t[0] }; } if (r.weather) return { on: W.env.weather === r.weather }; if (r.time != null) { const m = /^(\d{1,2}):?(\d{2})?$/.exec(String(r.time)), h = m ? +m[1] + (+(m[2] || 0)) / 60 : NaN, now0 = YX.envNow ? YX.envNow().time : W.env.time; return { on: isFinite(h) && now0 >= h && now0 < h + 1 }; } return { on: false }; }
  function addRule(o, q) {
    const then = (Array.isArray(q.then) ? q.then : q.then != null ? [q.then] : []).slice(0, 4); if (!then.length || (q.near == null && !q.weather && q.time == null)) return;
    const r = { near: q.near != null ? String(q.near) : null, within: Math.max(3, Math.min(40, +q.within || 12)), weather: q.weather ? String(q.weather).toLowerCase() : null, time: q.time != null ? String(q.time) : null, then, say: q.say ? clip(q.say, 120) : '', t0: now() };
    r.what = (r.near ? T('等' + r.near + '来了', 'when the ' + r.near + ' comes') : r.weather ? T('等到' + r.weather, 'when it turns ' + r.weather) : T('到 ' + r.time, 'at ' + r.time)) + T('就', ', ') + then.map((x) => (typeof x === 'string' ? x : x.do || x.op)).join(T('、', ' and '));
    r.was = ruleState(o, r).on; // it has to arrive: a bus already standing here when the promise is made does not count
    const L = (o.params._when = (o.params._when || []).filter((x) => now() - x.t0 < 900000)); L.push(r); while (L.length > 3) L.shift(); YX.markDirty();
  }
  function keepPromises() {
    for (const o of W.objs.values()) {
      if (!isPerson(o) || !o.params._when || !o.params._when.length) continue;
      for (const r of o.params._when.slice()) {
        if (now() - r.t0 > 900000) { o.params._when = o.params._when.filter((x) => x !== r); continue; }
        const st = ruleState(o, r); if (!(st.on && !r.was)) { r.was = st.on; continue; }
        o.params._when = o.params._when.filter((x) => x !== r);
        if (r.say) say(o, r.say, 4200);
        for (const x of r.then) { const q = typeof x === 'string' ? { do: x } : x || {}; let name = String(q.do || q.op || '').toLowerCase(); if (name === 'walk' && (q.to === 'it' || q.to == null) && st.it) q.to = '#' + st.it.id; const f = DO[name]; const op = f ? f(q) : null; if (op) act(o, op); }
        const m = (o.params._mem = o.params._mem || []); m.push(T('（' + whoIs(o).n + '照约定做了：' + r.what + '）', '(' + whoIs(o).n + ' kept the promise: ' + r.what + ')')); while (m.length > 8) m.shift(); YX.markDirty();
      }
    }
  }
  const followers = new Set(); // people who agreed to come along: they keep a couple of steps behind the player
  function goNear(o, gap) { const P = W.player, d = Math.hypot(P.x - o.x, P.z - o.z); if (d < gap + 0.9 || o.dead) return; const k = (d - gap) / d; try { YX.detach(o); if (o.y > 0.01) { o.y = 0; YX.syncHolder(o); } if (o.params.pose !== 'walk') { o.params.pose = 'walk'; YX.rebuild(o); } o.motion = 'goto'; o.ms = { tx: o.x + (P.x - o.x) * k, tz: o.z + (P.z - o.z) * k, wait: 0, run: d > 9, then: 'none', pose: 'stand', sitOn: null, enter: null }; } catch (e) { console.warn('npc walk', e); } }
  let seq = 0;
  async function ask(o, text, saw) {
    const who = whoIs(o), my = ++talk.n, e = { id: 'npc' + (++seq), text: saw ? T(who.n + ' 看见了', who.n + ' saw that') : text ? who.n + ' ← ' + text : T('和 ' + who.n + ' 搭话', 'Walk up to ' + who.n), tier: 'talk', status: 'run', msgs: [], t0: now(), ms: 0 }; talk.last = now();
    if (talk.ctl) { try { talk.ctl.abort(); } catch (x) {} } const ctl = (talk.ctl = new AbortController()); hush(); face(o); say(o, '…', 20000); if (hooks.log) hooks.log(e);
    const done = (line, ops, status) => { if (my !== talk.n) return; say(o, line); speak(line, o); e.status = status || 'ok'; e.ms = Math.round(now() - e.t0); e.msgs = [who.n + ': ' + line]; if (hooks.log) hooks.log(e); if (status !== 'fail') { const mem = (o.params._mem = o.params._mem || []); mem.push((saw ? T('（陌生人说“', '(the stranger said "') + clip(saw.said, 80) + T('”，它就发生了）', '" and it happened)') + '\n' : text ? T('陌生人：', 'Stranger: ') + clip(text, 120) + '\n' : '') + who.n + T('：', ': ') + clip(line, 160)); while (mem.length > 8) mem.shift(); YX.markDirty(); } for (const op of ops || []) act(o, op); if (text && BYE.test(text) && !(ops || []).some((p) => p.op === 'bye')) act(o, { op: 'bye' }); };
    if (!M.sample && !saw && !(text && BYE.test(text))) YX.needAI('talk', text || '');
    if (!M.sample) return done(text && BYE.test(text) ? T('回头见！', 'See you around!') : T('（' + who.n + '朝你点点头。AI 没有连接，镇上的人现在只会打招呼。）', '(' + who.n + ' nods at you. The AI is not connected, so people can only greet you for now.)'), [], 'fail');
    try { const res = await M.sample(prompt(o, text, saw), { modelTier: 'quick', cache: false, signal: ctl.signal, onText: (u) => { if (my === talk.n) { const p = parse(u.text); if (p.say) say(o, p.say, 20000); } } }); const p = parse(res.text); if (text && followers.has(o.id) && !p.ops.some((q) => q.op === 'stay' || q.op === 'follow' || q.op === 'bye')) { try { const chk = await M.sample('A stranger asked ' + who.n + ' earlier to follow them, and ' + who.n + ' has been following.\nNow the stranger said: "' + clip(text, 200) + '"\n' + who.n + ' answered: "' + clip(p.say, 200) + '"\nAfter this exchange, should ' + who.n + ' keep following the stranger? Answer with one word: yes or no.', { modelTier: 'quick', cache: false, signal: ctl.signal }); if (/^\W*(no|不|否)/i.test(String(chk.text || '').trim())) p.ops.push({ op: 'stay' }); } catch (x) {} } done(p.say || T('嗯…', 'Hm…'), p.ops); }
    catch (x) { if (my === talk.n && !(x && x.name === 'AbortError')) done(T('（没听清，再说一遍？）', '(Sorry, say that again?)'), [], 'fail'); }
    finally { if (talk.ctl === ctl) talk.ctl = null; }
  }

  /* ---------- click somebody: they come over and talk ---------- */
  const _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3(), _pc = new THREE.Vector3(), cvEl = () => (YX.three && YX.three.renderer ? YX.three.renderer.domElement : null);
  const PAD = 28; // how far beside a figure still counts: people walk, and nobody should have to chase one with the cursor (the hover tag uses the same reach, so what is offered is what a click gets)
  function at(cx, cy, pad) { // the person whose figure on screen is under this point, give or take a little; the nearer one if two overlap
    const cam = YX.three && YX.three.camera, cv = cvEl(); if (!cam || !cv) return null; const r = cv.getBoundingClientRect(); let best = null, bd = 1e9; cam.updateMatrixWorld();
    for (const o of W.objs.values()) { if (!isPerson(o)) continue; const h = o.size ? o.size[1] : 1.8; _pc.set(o.x, o.y + h / 2, o.z).applyMatrix4(cam.matrixWorldInverse); const d = -_pc.z; if (d < 0.3 || d > 70) continue;
      _p1.set(o.x, o.y + h, o.z).project(cam); _p0.set(o.x, o.y, o.z).project(cam); const x1 = r.left + (_p1.x * 0.5 + 0.5) * r.width, y1 = r.top + (-_p1.y * 0.5 + 0.5) * r.height, x0 = r.left + (_p0.x * 0.5 + 0.5) * r.width, y0 = r.top + (-_p0.y * 0.5 + 0.5) * r.height;
      const half = Math.max(Math.abs(y0 - y1) * 0.2, 9), xm = (x0 + x1) / 2, ex = Math.max(0, Math.abs(cx - xm) - half), ey = Math.max(0, Math.min(y0, y1) - cy, cy - Math.max(y0, y1)), off = Math.hypot(ex, ey); if (off > pad) continue;
      const sc = off > 0 ? 1e4 + off : d; // on a figure: the nearer person; beside one: whoever the point is closest to
      if (sc < bd && (!YX.seen || YX.seen(o))) { bd = sc; best = o; } }
    return best; }
  function hail(o) { // call them over: they stop what they are doing, walk up to you and say hello
    if (!isPerson(o)) return false; const P = W.player, d = Math.hypot(o.x - P.x, o.z - P.z); if (talk.id !== o.id) start(o, null, 'hail');
    const inB = YX.insideOf ? YX.insideOf() : null, ro = YX.roomOf ? YX.roomOf(o) : null, same = inB ? ro === inB.id : ro == null; // through a wall they answer from where they are
    if (d > 3 && same && o.params.pose !== 'ride' && o.params._use == null) { if (talk.prev && talk.prev.motion === 'goto') talk.prev.motion = 'none'; goNear(o, 1.9); }
    return true; }
  function click(cx, cy, touch) { // cx == null: the mouse is captured, so it is whoever the crosshair is on or beside
    if (!YX.ui || !YX.ui.started() || YX.cine.active || YX.playing || (YX.filmBusy && YX.filmBusy()) || document.body.classList.contains('cmp-on')) return false; let o = null;
    if (cx == null) { o = isPerson(W.aim) ? W.aim : null; if (!o) { const cv = cvEl(), r = cv ? cv.getBoundingClientRect() : null; if (r) o = at(r.left + r.width / 2, r.top + r.height / 2, 34); } } else o = at(cx, cy, touch ? 40 : PAD);
    if (!o) return false; if (Math.hypot(o.x - W.player.x, o.z - W.player.z) > 70) return false; hail(o); return true; }
  // under a free mouse, whoever can be clicked says so
  const tag = document.createElement('div'); tag.id = 'hailTag'; tag.className = 'glass'; document.body.appendChild(tag);
  { const st = document.createElement('style'); st.textContent = '#hailTag{position:fixed;left:0;top:0;z-index:4;padding:5px 10px 6px;border-radius:9px;font:500 12px/1.2 var(--f-ui);color:var(--paper);pointer-events:none;opacity:0;transform:translate(14px,16px);transition:opacity .12s;white-space:nowrap}#hailTag.on{opacity:1}#hailTag b{color:var(--voice);font-weight:600;margin-right:6px}body.title #hailTag,body.clean #hailTag{display:none}'; document.head.appendChild(st); }
  let hovT = 0, hov = null;
  document.addEventListener('pointermove', (e) => { const cv = cvEl(); if (!cv) return; const t = now(); if (t - hovT < 90) { if (hov) { tag.style.left = e.clientX + 'px'; tag.style.top = e.clientY + 'px'; } return; } hovT = t;
    const free = e.target === cv && document.pointerLockElement !== cv && e.pointerType === 'mouse' && !e.buttons && YX.ui && YX.ui.started() && !YX.cine.active && !YX.playing; const o = free ? at(e.clientX, e.clientY, PAD) : null;
    if (o !== hov) { hov = o; cv.style.cursor = o ? 'pointer' : ''; tag.classList.toggle('on', !!o); if (o) { const who = whoIs(o); tag.innerHTML = ''; const b = document.createElement('b'); b.textContent = who.n; tag.appendChild(b); tag.appendChild(document.createTextNode(talk.id === o.id ? T('正在和你说话', 'talking with you') : T('点一下，叫他过来说话', 'click to call them over'))); } }
    if (o) { tag.style.left = e.clientX + 'px'; tag.style.top = e.clientY + 'px'; } });

  /* ---------- "talk to this person": an op like any other, so the quick model can ask for it too ---------- */
  function pickPerson(v) { const a = W.objs.get(v.aimId); if (isPerson(a) && (!YX.seen || YX.seen(a))) return a; let best = null, bd = 14; for (const o of W.objs.values()) { if (!isPerson(o)) continue; const dx = o.x - v.x, dz = o.z - v.z, d = Math.hypot(dx, dz); if (d > bd || d < 0.01) continue; if ((dx * v.fx + dz * v.fz) / d < 0.6) continue; if (YX.seen && !YX.seen(o)) continue; bd = d; best = o; } return best; } // the one under the crosshair, else the nearest one you are looking toward
  YX.OPS.talk = function (op, ctx) {
    if (op.end) { end(); return { ok: true, msg: T('对话结束', 'Conversation over') }; }
    let o = op.id != null && op.id !== 'aim' ? ctx.one(op.id) : null; if (!isPerson(o)) o = pickPerson(ctx.view);
    if (!isPerson(o)) return { ok: false, msg: T('眼前没有可以说话的人：看着一个人再说一次', 'There is nobody in view to talk to: look at someone and say that again') };
    if (YX.seen && !YX.seen(o)) return { ok: false, msg: T('看不到这个人', 'That person is not in view') };
    if (Math.hypot(o.x - ctx.view.x, o.z - ctx.view.z) > 22) return { ok: false, msg: T('离得太远了，走近一点再说', 'Too far away to talk: walk closer') };
    start(o, op.say ? clip(op.say, 300) : null); return { ok: true, msg: T('和 ' + whoIs(o).n + ' 说话', 'Talking with ' + whoIs(o).n) };
  };
  const EN_TALK = [/^(?:i (?:want|would like|wanna|need)(?: to)? |i'd like to |let me |can i |could i |may i |let's |lets |please )?(?:talk|speak|chat)(?: a bit| for a bit)? (?:to|with) (.+?)$/i, /^(?:say (?:hi|hello|hey) to|greet|go talk to|go say hi to) (.+?)$/i], EN_ASK = /^ask (him|her|them|this \S+|that \S+|the \S+(?: \S+)?) (.+)$/i, EN_HI = /^(?:hi|hello|hey|hiya|good (?:morning|afternoon|evening)|excuse me)(?: there| you| sir| madam| miss| friend)?[\s!.,?]*$/i;
  const ZH_TALK = /^(?:我想|我要|我想要|让我|能不能|可不可以|可以|去)?(?:和|跟|与|同|找)(.+?)(?:说说话|说句话|说话|聊聊天|聊聊|聊天|聊一聊|聊一下|谈谈|谈一谈|对话|打个招呼|打招呼)(?:吧|吗|好吗|可以吗)?$/, ZH_ASK = /^(?:问问|问一下|问)(他|她|他们|这个人|那个人|这位\S{0,4}|那位\S{0,4})[，, ]?(.+)$/, ZH_HI = /^(?:你好|您好|嗨|喂|哈喽|早上好|下午好|晚上好|打扰一下)[啊呀吗呢！!。.，, ]*$/;
  const REPLY = /^(?:(?:hi|hello|hey|morning|evening|thanks|thank you|you too|same to you|how are you|how's it going|what'?s up|nice to meet you|who are you|what are you doing)\b.{0,40}|(?:你好|您好|嗨|早啊?|早上好|下午好|晚上好|谢谢|你也是|是啊|对啊|哈哈|你是谁|你在干嘛|你在做什么|最近怎么样).{0,20})$/i;
  function localTalk(text, v) { // the common ways of saying it are understood on the spot; anything else goes to the model like every other sentence
    const s = text.trim().replace(/[.!?。！？]+$/, ''); let m;
    for (const re of EN_TALK) if ((m = s.match(re))) return { op: 'talk' };
    if ((m = s.match(EN_ASK))) return { op: 'talk', say: m[2] };
    if ((m = s.match(ZH_TALK))) return { op: 'talk' };
    if ((m = s.match(ZH_ASK))) return { op: 'talk', say: m[2] };
    if (EN_HI.test(s) || ZH_HI.test(s)) { const o = W.objs.get(v.aimId); if (isPerson(o) && Math.hypot(o.x - v.x, o.z - v.z) < 9) return { op: 'talk', say: text }; }
    return null;
  }
  const commit0 = M.commit;
  M.commit = function (text) {
    const t = String(text || '').trim();
    if (t && talk.id != null) { const o = W.objs.get(talk.id); if (!isPerson(o)) end(true); else {
      let ops = null; if (!BYE.test(t)) { try { const v = YX.viewNow(); ops = M.parseLocal(t, { view: v, ctx: YX.newCtx(v) }); } catch (e) {} }
      if (ops && ops.length) { // in a conversation, a sentence is for the world only if it plainly is: weather, time, camera, adding things, or something named or pointed at that is not this person
        const scene = /^(env|add|scatter|row|crowd|cam|shot|undo|clear|reset|plan|invent|clay|goto)$/, named = /\b(this|that|the|these|those|all|every|each)\b|这|那|所有|全部|每/i.test(t);
        const forWorld = ops.every((q) => { if (!q) return false; const k = String(q.op || '').toLowerCase(); if (scene.test(k)) return true; if (q.id == null || !named) return false; try { const tg = YX.newCtx(YX.viewNow()).many(q.id); return tg.length > 0 && !tg.some((x) => x.id === o.id); } catch (e) { return false; } });
        if (!forWorld) ops = null; }
      if (ops && ops.length && !ops.every((q) => q && q.op === 'say')) { const n = events.length; commit0.apply(this, arguments); talk.last = now(); setTimeout(() => { if (talk.id === o.id && events.length > n) ask(o, null, events[events.length - 1]); }, 1700); return; } // a command the world understands: it happens, and they saw it
      ask(o, t); return; } }
    if (t && lastHello && now() - lastHello.t < 15000 && (EN_HI.test(t.replace(/[.!?。！？]+$/, '')) || ZH_HI.test(t.replace(/[.!?。！？]+$/, '')) || REPLY.test(t))) { const o = W.objs.get(lastHello.id); lastHello = null; if (isPerson(o) && Math.hypot(o.x - W.player.x, o.z - W.player.z) < 10) { start(o, clip(t, 300)); return; } } // somebody just called out to you and you answered them
    if (t) { const v = YX.viewNow(), op = localTalk(t, v); if (op) { const ctx = YX.newCtx(v), res = YX.exec(op, ctx), e = { id: 'npc' + (++seq), text: t, tier: 'local', status: res && res.ok ? 'ok' : 'fail', msgs: [res ? res.msg : ''], t0: now(), ms: 0 }; if (hooks.log) hooks.log(e); if (res && !res.ok && hooks.toast) hooks.toast(res.msg); return; } }
    return commit0.apply(this, arguments);
  };
  const exec0 = YX.exec; let mine = 0; // an instruction to somebody who is following ends the following, wherever it comes from
  YX.exec = function (op, ctx) { if (!mine && followers.size && op && op.id != null && /^(walk|set|move|follow|accompany|act|jump|remove|delete|use|become)$/.test(String(op.op || '').toLowerCase())) { try { for (const o of ctx.many(op.id)) followers.delete(o.id); } catch (e) {} } return exec0.apply(this, arguments); };
  YX.talk = { start, end, click, hail, at, _pass: () => ({ greetAt, last: lastHello }), _remark: (o) => (M.sample ? remark(o) : greet(o)), active: () => talk.id, whoIs, say, following: (o) => followers.has(o.id), _state: talk, _prompt: prompt, _parse: parse, _local: localTalk };

  /* ---------- passing by ---------- */
  const HELLO = { en: { any: ['Morning!', 'Hello there.', 'Lovely day, isn\'t it?', 'Oh, hello!', 'Nice to see a new face.'], vend: ['Fresh today, have a look!', 'Best in town, come and see!', 'Can I interest you in something?'], kid: ['Hi! Watch this!', 'Wanna play?', 'Hello, mister stranger!'], night: ['Evening.', 'Out late, are we?'], snow: ['Brr, where did this snow come from?'], rain: ['Did you bring this rain with you?'] }, zh: { any: ['早啊！', '你好呀。', '今天天气真不错。', '哎，你好！', '生面孔啊，欢迎。'], vend: ['今天刚到的，来看看！', '镇上最好的，过来瞧瞧！', '要不要带点回去？'], kid: ['嗨！看我的！', '一起玩吗？', '陌生人你好！'], night: ['晚上好。', '这么晚还在外面呀？'], snow: ['嘶，这雪是哪儿来的？'], rain: ['这雨是你带来的吧？'] } };
  let greetAt = 0, acc = 0, lastHello = null; const greeted = new Map();
  function turnTo(o) { if (!o.attach) { const m = o.motion; if (m === 'wander') { o.motion = 'none'; o.ms = null; setTimeout(() => { if (!o.dead && talk.id !== o.id && o.motion === 'none' && !o.attach) { o.motion = m; YX.initMotion(o); } }, 5200); } face(o); } }
  function greet(o) { const who = whoIs(o), L = HELLO[zh() ? 'zh' : 'en'], E = W.env, t = E.time, pool = E.weather === 'snow' ? L.snow : E.weather === 'rain' || E.weather === 'storm' ? L.rain : o.params.age === 'child' ? L.kid : /stall|sell|seller|摊|卖/.test(who.r) ? L.vend : t > 19.5 || t < 5.5 ? L.night : L.any, line = pool[Math.floor(Math.random() * pool.length)];
    turnTo(o); say(o, line, 3600); speak(line, o); lastHello = { id: o.id, t: now() }; }
  // with the model connected, what they call out is their own: who they are, what they are doing, what they have seen you do
  async function remark(o) { const who = whoIs(o), E = W.env, ev = seenBy(o), mem = (o.params._mem || []).slice(-3), doing = o.attach ? T('待在 ', 'at the ') + lab(W.objs.get(o.attach.to)) : o.params.pose === 'sit' ? T('坐着', 'sitting') : o.motion === 'wander' ? T('在散步', 'out for a walk') : T('站着', 'standing');
    turnTo(o); say(o, '…', 7000); lastHello = { id: o.id, t: now() };
    const q = zh() ? '你是' + who.n + '，' + who.r + (o.params.age === 'child' ? '（大约七岁）' : '') + '，住在一个小镇上。性格：' + who.q + '。\n现在：' + YX.clock(E.time) + '，天气' + YX.wxName(E.weather) + '。你正' + doing + '。你周围有：' + (around(o) || '一片空地') + '。\n' + (ev.length ? '最近那个陌生人开口时你看到的事：' + ev.map((e) => '“' + e.said + '”→' + (e.did || '有东西变了')).join(' | ') + '\n' : '') + (mem.length ? '你们之前说过的话：\n' + mem.join('\n') + '\n' : '') + '那个一开口世界就会变的陌生人，此刻正从你身边走过。用' + who.n + '的口吻朝他喊一句：一句简短的口语——打个招呼，或者说说你正在做的事、周围的东西、你看到他做过的事。用中文。不要旁白，不要引号，不要表情符号。只输出这一句话。'
      : 'You are ' + who.n + ', ' + who.r + (o.params.age === 'child' ? ' (about seven years old)' : '') + ', in a small town. Personality: ' + who.q + '.\nNow: ' + YX.clock(E.time) + ', weather ' + E.weather + '. You are ' + doing + '. Around you: ' + (around(o) || 'open ground') + '.\n' + (ev.length ? 'What you saw happen lately when the stranger spoke: ' + ev.map((e) => '"' + e.said + '" -> ' + (e.did || 'something changed')).join(' | ') + '\n' : '') + (mem.length ? 'What the two of you said before:\n' + mem.join('\n') + '\n' : '') + 'The stranger around whom the world changes when they speak is walking past you right now. Call out to them as ' + who.n + ' would: one short spoken sentence — a greeting, or a remark about what you are doing, what is around you, or what you saw them do. In English. No narration, no quotation marks, no emoji. Output only that sentence.';
    try { const res = await M.sample(q, { modelTier: 'quick', cache: false }); if (o.dead || talk.id != null) return; const line = clip(String(res.text || '').split(/\n+/).map((x) => x.trim()).filter((x) => x && x[0] !== '{')[0] || '', 160).replace(/^["“”']+|["“”']+$/g, ''); if (!line) return greet(o);
      say(o, line, 5200); speak(line, o); lastHello = { id: o.id, t: now() }; const m = (o.params._mem = o.params._mem || []); m.push(T('（陌生人路过时，' + who.n + '喊了一句）', '(' + who.n + ' called out as the stranger walked past) ') + who.n + T('：', ': ') + line); while (m.length > 8) m.shift(); YX.markDirty();
    } catch (e) { if (!o.dead && talk.id == null) greet(o); } }
  const frame0 = YX.onFrame;
  YX.onFrame = function (dt) {
    if (frame0) frame0(dt); place(); acc += dt || 0.016; if (acc < 0.5) return; acc = 0; try { keepPromises(); } catch (e) { console.warn('promises', e); }
    const P = W.player, t = now();
    for (const id of Array.from(followers)) { const f = W.objs.get(id); if (!isPerson(f)) followers.delete(id); else if (f.motion !== 'goto') goNear(f, 2.4); }
    if (talk.id != null) { const o = W.objs.get(talk.id); if (!isPerson(o) || Math.hypot(o.x - P.x, o.z - P.z) > 11 || t - talk.last > 75000) end(); return; }
    if (!S.greet || !YX.ui || !YX.ui.started() || YX.cine.active || YX.playing || (YX.filmBusy && YX.filmBusy()) || document.body.classList.contains('cmp-on') || t < greetAt) return;
    // who notices you: the nearest person within a few steps who has not spoken to you lately. The closer you pass, the likelier they speak; looked at twice a second, so walking by at arm's length nearly always gets a word, and across the pavement often does.
    let cand = null, cd = 7; for (const o of W.objs.values()) { if (!isPerson(o) || o.params.pose === 'ride' || o.params.pose === 'lie') continue; const d = Math.hypot(o.x - P.x, o.z - P.z); if (d >= cd || d < 0.3 || Math.abs(o.y - (P.y - 1.7)) > 2.5) continue; if (t - (greeted.get(o.id) || -1e9) < 180000) continue; cd = d; cand = o; }
    if (cand && Math.random() < (cd < 3.2 ? 0.45 : 0.22) && (!YX.seen || YX.seen(cand))) { greeted.set(cand.id, t); greetAt = t + 16000; if (M.sample) remark(cand); else greet(cand); }
  };

  /* ---------- settings: two switches next to the others ---------- */
  try { const row = $('physBtn') && $('physBtn').parentNode; if (row) { const mk = (key, zhT, enT) => { const b = document.createElement('button'); b.className = 'sbtn'; b.type = 'button'; const paint = () => { b.setAttribute('aria-pressed', String(!!S[key])); b.textContent = T(zhT, enT); }; b.onclick = () => { S[key] = !S[key]; save(); paint(); if (!S.speak) hush(); }; paint(); row.appendChild(b); return paint; }; const p1 = mk('speak', '人物出声说话（合成语音）', 'People speak aloud (synthetic voice)'), p2 = mk('greet', '路过时打招呼', 'People greet you'); const ui0 = hooks.ui; hooks.ui = function () { if (ui0) ui0.apply(this, arguments); p1(); p2(); paintPill(); }; } } catch (e) {}
  window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && talk.id != null) end(); else if (e.code === 'Space' && !e.repeat) hush(); }); // when the player starts to speak, whoever was speaking stops, so the microphone hears only the player
})();
