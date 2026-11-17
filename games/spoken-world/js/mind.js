/* 言出法随 · mind: three tiers that all compile speech into the same ops
   tier 0  local grammar   – instant, also runs on partial transcripts
   tier 1  quick model     – JSONL ops streamed and executed line by line
   tier 2  invent / plan   – a model writes a new generator (or a whole scene) while a placeholder stands in */
'use strict';
(function () {
  const YX = window.YX, W = YX.world, G = YX.GEN, clamp = YX.clamp, COLORS = YX.COLORS, T = YX.T;
  const M = (YX.mind = { sample: null, quality: 'refine', history: [], lastInc: null, jobs: 0, active: new Set() });
  const hooks = YX.hooks;
  const now = () => performance.now();
  let logSeq = 0;
  function logStart(text, tier) { const e = { id: ++logSeq, text, tier, status: 'run', msgs: [], t0: now(), ms: 0 }; if (hooks.log) hooks.log(e); return e; }
  function logEnd(e, status, extra) { e.status = status; e.ms = Math.round(now() - e.t0); if (extra) e.msgs.push(extra); if (hooks.log) hooks.log(e); }
  const logUp = (e) => { if (hooks.log) hooks.log(e); };

  /* ================= tier 0 · local grammar ================= */
  const CL = '(?:个|棵|座|栋|幢|只|辆|条|盏|张|朵|片|间|家|把|块|颗|艘|架|位|名|头|匹|排|群|堆|些|扇|面|根|台|部|所|处|株|丛|簇)';
  const COLOR_KEYS = Object.keys(COLORS).sort((a, b) => b.length - a.length);
  const AMT = { 一点点: 1.08, 一丢丢: 1.08, 一点儿: 1.18, 一点: 1.18, 一些: 1.25, 点儿: 1.18, 点: 1.18, 些: 1.25, 很多: 1.6, 许多: 1.6, 好多: 1.6, 得多: 1.6, 多了: 1.6, 不少: 1.5, 一倍: 2, 两倍: 2, 三倍: 3, 四倍: 4, 五倍: 5, 十倍: 10, 一半: 0.5 };
  const ADJ = { 大: ['size', 1], 小: ['size', -1], 高: ['height', 1], 矮: ['height', -1], 低: ['height', -1], 宽: ['width', 1], 窄: ['width', -1], 长: ['length', 1], 短: ['length', -1], 胖: ['width', 1], 瘦: ['width', -1], 粗: ['width', 1], 细: ['width', -1], 厚: ['depth', 1], 薄: ['depth', -1] };
  const RE_RESIZE = /(?:再|在|又|还|更|要|稍微|稍稍|略微|稍|可以)*(?:变得?|放|调|弄|搞|加|拉|拔|升|降|缩|压|拓|延|增|减|长|修)?(大|小|高|矮|低|宽|窄|长|短|胖|瘦|粗|细|厚|薄)(一点点|一丢丢|一点儿|一点|一些|点儿|点|些|很多|许多|好多|得多|多了|不少|一倍|两倍|三倍|四倍|五倍|十倍|一半)?/g;
  const TIMES = { 天黑: 21.5, 晚上: 21, 夜晚: 22, 夜里: 23, 黑夜: 23, 深夜: 0, 半夜: 0, 午夜: 0, 入夜: 20, 天亮: 7, 白天: 12, 早上: 8, 早晨: 7.5, 清晨: 6.6, 凌晨: 5, 日出: 6.4, 上午: 10, 中午: 12, 正午: 12, 下午: 15.5, 黄昏: 18.2, 傍晚: 18.5, 日落: 18.1, 夕阳: 17.8, 黄金时刻: 17.4, 蓝调时刻: 19.2 };
  const WEATHER = { 暴风雨: 'storm', 雷阵雨: 'storm', 暴雨: 'storm', 雷雨: 'storm', 下大雨: 'storm', 下雨: 'rain', 雨天: 'rain', 小雨: 'rain', 下雪: 'snow', 雪天: 'snow', 飘雪: 'snow', 起雾: 'fog', 有雾: 'fog', 大雾: 'fog', 下雾: 'fog', 放晴: 'clear', 晴天: 'clear', 天晴: 'clear', 出太阳: 'clear', 雨停: 'clear', 雪停: 'clear', 别下了: 'clear', 不下了: 'clear', 晴朗: 'clear', 多云: 'cloudy', 阴天: 'cloudy', 阴沉: 'cloudy' };
  const norm = (s) => String(s || '').toLowerCase().replace(/[“”"'‘’「」『』《》]/g, '').replace(/\s+/g, ' ').trim();
  const squash = (s) => s.replace(/\s+(?=[一-龥])|(?<=[一-龥])\s+/g, '');
  const strip = (s) => squash(norm(s)).replace(/^(?:嗯+|呃+|啊+|哎|诶|那个|那么|那就|那|就|好的?|ok|okay|请|麻烦你?|帮我|帮忙|给我|我想要?|我要|我希望|能不能|可不可以|可以|你|现在)+/, '').replace(/(?:吧|呗|啊|呀|呢|哦|嘛|好吗|可以吗|行吗|好不好|试试|看看|谢谢)+$/, '').trim();
  /* a sentence that directs the camera is one request, however many commas it has: "orbit this house and record it", "从正面推过去，再升起来" */
  const CAMISH = /镜头|运镜|航拍|长镜头|一镜到底|电影感|环绕|平推|跟拍|飞越|拉升|揭示|\borbit|\bdolly|\bcrane|fly ?over|tracking shot|\bcamera\b|\bshot\b|\bdrone\b|cinematic|\breveal\b|push in|pull out|pull back/i, CAM_MORE = /^(?:(?:and |then )?(?:record|film|shoot|capture|rise|descend|push|pull|pan|tilt|fly|go|end|finish|start|circle|sweep|slowly|quickly|from|to|over|around|through|past|up|down|ending|starting)\b|拍|录|(?:再|最后|慢慢|缓缓)|从|到|向|往|绕|升|降|推|拉|飞|穿|越过|掠过|停在|落在|结束)/i;
  // the moves that need no camera word ("circle the fountain slowly and record it", "绕着喷泉转一圈，录下来") are camera sentences too: the same verbs parseFilm reads as a move when a sentence starts with them
  const CAM_START = /^(?:(?:please|now|then|and|slowly|gently|quickly|lets|let us|can you|could you) )*(?:circle|arc|go around|fly around|spin around|rotate around|move around|do a 360|360)\b/i, CAM_START_ZH = /^(?:请|帮我)?(?:镜头)?(?:绕着?|围着|围绕).{0,10}(?:转|拍|飞)(?:一圈|半圈|一周)?$/;
  const camish = (c) => CAMISH.test(c) || CAM_START.test(String(c).trim()) || CAM_START_ZH.test(String(c).trim());
  function splitClauses(text) { const cl = splitClauses0(text); if (cl.length < 2 || !camish(cl[0])) return cl; const out = [cl[0]]; let i = 1; for (; i < cl.length && CAM_MORE.test(cl[i]); i++) out[0] += (isEN(out[0]) ? ' and ' : '，') + cl[i]; return out.concat(cl.slice(i)); }
  function splitClauses0(text) {
    let t = squash(norm(text));
    if (isEN(t)) t = t.replace(/\bblack and white\b/g, 'monochrome').replace(/\bbetween ([a-z0-9# ]+?) and /g, 'between $1 & ').replace(/\bup and down\b/g, 'up&down').replace(/\bback and forth\b/g, 'back&forth');
    return t.split(/[，,。；;！!？?、\n]+|(?<![0-9])\.(?![0-9])|然后再?|接着再?|之后再|并且|同时|还有|另外| and then | then | and also | and (?=[a-z])/).map((x) => x.trim().replace(/up&down/g, 'up and down').replace(/back&forth/g, 'back and forth')).filter(Boolean);
  }
  function cnNum(s) { if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s); const d = { 零: 0, 一: 1, 二: 2, 两: 2, 俩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }; if (s === '十') return 10; if (s === '半') return 0.5; let m; if ((m = s.match(/^十([一二三四五六七八九])$/))) return 10 + d[m[1]]; if ((m = s.match(/^([一二两三四五六七八九])十([一二三四五六七八九])?$/))) return d[m[1]] * 10 + (m[2] ? d[m[2]] : 0); if ((m = s.match(/^([一二两三四五六七八九])百$/))) return d[m[1]] * 100; return d[s] != null ? d[s] : NaN; }
  const NUM = '(?:\\d+(?:\\.\\d+)?|[一二两俩三四五六七八九十百半]+)';
  function eatNoun(s) { for (const n of YX.NOUNS) if (s.startsWith(n.w)) return { type: YX.nounPick(n), params: n.params, len: n.w.length, fam: n.fam || null }; const m = s.match(/^(建筑物?|东西|物体|物件|对象|家伙|玩意儿?)/); return m ? { type: null, generic: m[1], len: m[0].length } : null; }
  function eatColor(s) { for (const k of COLOR_KEYS) if (s.startsWith(k)) { const m = s.slice(k.length).match(/^(?:颜?色)?的?/); return { hex: COLORS[k], len: k.length + m[0].length }; } return null; }
  /* a target phrase occupying the whole string */
  function parseTargetWhole(t) {
    if (!t) return null;
    if (/^(它|他|她|牠|这|那|这个|那个|这只|那只|这棵|那棵|这座|那座|这栋|那栋|这辆|那辆)$/.test(t)) return /^[它牠]$/.test(t) ? { pron: true } : /^[他她]$/.test(t) ? { pron: true, person: true } : { demo: true };
    let m = t.match(new RegExp('^(?:我)?(?:眼前|面前|前面|跟前|对面)?的?(这|那)?(?:一)?' + CL + '?(.*)$'));
    const demo = !!(m && m[1]) || /^(?:我)?(?:眼前|面前|前面|跟前)/.test(t), rest = m ? m[2] : t;
    if (!rest) return demo ? { demo: true } : null;
    const n = eatNoun(rest); if (!n || n.len !== rest.length) return null;
    return { demo, noun: n };
  }
  /* a target phrase at the start of the string (for 把…/这个… clauses) */
  function parseTargetPrefix(s) {
    let m = s.match(/^(?:把|将|让|给|对|使|叫)/); const ba = m ? m[0].length : 0, t = s.slice(ba);
    if ((m = t.match(/^(它|他|她|牠)(?!们)/))) return { rest: t.slice(1), spec: /[他她]/.test(m[1]) ? { pron: true, person: true } : { pron: true } };
    m = t.match(new RegExp('^(?:我)?(眼前|面前|前面|跟前)?的?(这|那)?(?:一)?(' + CL + ')?'));
    const pre = m[0].length, demo = !!(m[1] || m[2]), after = t.slice(pre), n = eatNoun(after);
    if (n) return { rest: after.slice(n.len), spec: { demo, noun: n } };
    if (demo) return { rest: after, spec: { demo: true } };
    return ba ? null : { rest: s, spec: null };
  }
  function resolveTarget(spec, ph) {
    const v = ph.view, aim = W.objs.get(v.aimId) || null, focus = W.objs.get(v.focusId) || null, isC = (o) => !!o && (YX.defOf(o) || {}).cls === 'creature';
    if (spec && spec.person) { const isP = (o) => !!o && o.type === 'person', g = YX.groupNow(true); if (isP(focus)) return focus; if (isP(aim)) return aim; const gp = g.filter(isP); if (gp.length) return gp[0]; if (isC(focus)) return focus; if (isC(aim)) return aim; const gc = g.filter(isC); if (gc.length) return gc[0]; return YX.nearestOfType('person', v, null) || focus || aim; }
    if (!spec) return focus || aim; if (spec.pron) return focus || aim;
    const n = spec.noun;
    if (n && n.type) {
      const cls = G[n.type].cls, same = (o) => !!o && (o.type === n.type || (n.fam && n.fam.includes(o.type)) || (cls === 'building' && (YX.defOf(o) || {}).cls === 'building' && (n.type === 'house' || (n.type === 'tower' && !n.params)))), ok = (o) => same(o) && (o.type !== n.type || !n.params || Object.keys(n.params).every((k) => String(o.params[k]) === String(n.params[k])));
      const fs = focus; // the thing the last command was about is still "the bus" in the next one, wherever it is by now
      if (aim && n.type && /^(?:bench|chair|sofa)$/.test(n.type) && YX.seatsOf(aim).length) return aim; // "this chair", said while pointing at a café table with chairs or a sofa: the thing pointed at
      if (ok(aim)) return aim; if (ok(fs)) return fs; const x = YX.nearestOfType(n.type, v, n.params, n.fam, !ph.far); if (x) return x;
      if (same(aim)) return aim; if (same(fs)) return fs; const y = YX.nearestOfType(n.type, v, null, n.fam, !ph.far); if (!y) ph.miss = YX.labelOf(G[n.type]) || n.type; return y || null;
    }
    if (n && n.generic && /建筑/.test(n.generic)) { if (aim && YX.defOf(aim).cls === 'building') return aim; if (focus && YX.defOf(focus).cls === 'building') return focus; let b = null, bd = 1e9; for (const o of W.objs.values()) if ((YX.defOf(o) || {}).cls === 'building') { const d = Math.hypot(o.x - v.x, o.z - v.z); if (d < bd) { bd = d; b = o; } } return b; }
    return aim || focus;
  }
  const FILL = /[的了吧啊呀呢哦嘛得把让给将使再还也又个]|一下|试试|看看|变成|变得|变/g;
  function parseResize(clause) {
    const s = strip(clause); if (!s) return null;
    if (/^(再来一次|再来一遍|再来|再一次|又一次|继续|再多一点|再来点|再多点|再来一点|还要|更多|again|more|keep going|one more time|once more)$/.test(s)) return { kind: 'repeat' };
    if (bulkFind(clause)) return null; // "all the trees": parseLocal reads it through one of them, then widens it
    if (isEN(s)) return enResize(clause);
    let m;
    const tg = parseTargetPrefix(s); if (!tg) return null;
    const rest = tg.rest.replace(/^的?(?:大小|尺寸|高度|宽度|长度|个头|体积|体型)/, '');
    const ops = []; let last = 0, left = ''; RE_RESIZE.lastIndex = 0;
    while ((m = RE_RESIZE.exec(rest))) { if (!m[0]) { RE_RESIZE.lastIndex++; continue; } left += rest.slice(last, m.index); last = m.index + m[0].length; const a = ADJ[m[1]]; let f = m[2] ? AMT[m[2]] : 1.18; if (f === 0.5) f = a[1] > 0 ? 1.5 : 0.5; else if (a[1] < 0) f = 1 / f; ops.push({ dim: a[0], factor: f }); }
    left = (left + rest.slice(last)).replace(FILL, '').replace(/\s+/g, '');
    if (!ops.length || left) return null;
    return { kind: 'resize', target: tg.spec, ops };
  }
  function parsePlace(str, ph) {
    let s = str.replace(/^(?:就|再|然后|并且?|还)/, '').replace(/的?(?:地方|位置|处)$/, '');
    if (!s) return { place: undefined };
    s = s.replace(/^(?:在|到|往|去|于|向|朝|靠|沿着?|顺着)/, '');
    if (!s) return null; let m;
    if (/^(?:这条|那条|这个|那个)?(?:马路|公路|道路|大街|街道|路|街|河)?的?对面$/.test(s)) return { place: { across: true } };
    if (/^(?:这里|这儿|这边|那里|那儿|那边|这个?|那个?|准星(?:这里|处)?|我(?:指|看)的(?:这里|这儿)?)$/.test(s)) return { place: { aim: true } };
    if (/^我?的?(?:眼前|面前|前面|前方|跟前|正前方)$/.test(s)) return { place: { front: 9 } };
    if (/^我的?(?:旁边|身边|边上|附近|这里|这儿|这边|脚边|脚下|身旁)$/.test(s)) return { place: { front: 3.5, right: 2.4 } };
    if (/^我的?(?:身后|后面|背后)$/.test(s)) return { place: { front: -6 } };
    if (/^我的?(?:左边|左侧|左手边)$/.test(s)) return { place: { front: 2, right: -5 } };
    if (/^我的?(?:右边|右侧|右手边)$/.test(s)) return { place: { front: 2, right: 5 } };
    if (/^(?:天上|空中|天空中?|半空中?|上空|头顶上?|我头上|我头顶上?|天空里?|天边|云里)$/.test(s)) return { place: { above: 'me' } };
    if (/^(?:远处|远方|远一点|远点儿?)$/.test(s)) return { place: { front: 45 } };
    if ((m = s.match(/^(?:我)?(?:眼前|面前|前面|前方|跟前|旁边|附近|这边|那边)?的?(?:这条|那条|这个|那个)?(?:马路|公路|道路|大街|街道|车道|路|街)的?(两边|两旁|两侧|边上|旁边|边|旁|沿线|中间|上面|上|中央|里)$/))) { if (/两|沿/.test(m[1])) return { place: undefined, row: { along: 'road', side: 'both' } }; if (/中|上|里/.test(m[1])) return { place: { road: 'ahead' } }; return { place: { road: 'ahead', side: 'beside' }, row: { along: 'road', side: 'near' }, roadside: true }; }
    if ((m = s.match(/^(?:牵着|拉着|跟着|陪着|跟在|挽着|带着)(.+?)(?:的手|身边|旁边|身后|后面)?$/))) { const sp = parseTargetWhole(m[1]), o = sp ? resolveTarget(sp, ph) : null; if (o && (YX.defOf(o) || {}).cls === 'creature') return { place: { near: '#' + o.id, side: 'right', gap: 0.2 }, with: '#' + o.id }; }
    m = s.match(/的?(上面|上边|上头|顶上|顶部|屋顶上?|房顶上?|楼顶上?|头顶上?|头上|身上|背上|上方|上空|上|旁边|边上|隔壁|附近|身边|身旁|左边|右边|左侧|右侧|前面|前边|前方|门口|门前|面前|后面|后边|背后|后方|周围|四周|里面|里边|里|中间|中央|下面|底下|对面)$/);
    if (!m) return null;
    const rel = m[1], tstr = s.slice(0, m.index); let spec;
    if (!tstr) { if (/^(?:旁边|边上|附近|前面|前边|前方|后面|后边|左边|右边|左侧|右侧|上|里|中间|下面|对面|周围|四周)$/.test(rel) && !/屋顶|房顶|楼顶/.test(rel)) { if (rel === '对面') return { place: { across: true } }; spec = { demo: true }; } else spec = /屋顶|房顶|楼顶/.test(rel) ? { demo: true, noun: { generic: '建筑' } } : { demo: true }; }
    else { spec = parseTargetWhole(tstr); if (!spec) return null; }
    const o = resolveTarget(spec, ph); if (!o) return null; const id = '#' + o.id;
    if (/上方|上空/.test(rel)) return { place: { above: id, height: 4 } };
    if (/^(?:上面|上边|上头|顶上|顶部|屋顶上?|房顶上?|楼顶上?|头顶上?|头上|身上|背上|上)$/.test(rel)) return { place: { on: id } };
    if (/左/.test(rel)) return { place: { near: id, side: 'left' } }; if (/右/.test(rel)) return { place: { near: id, side: 'right' } };
    if (/前|门口|门前/.test(rel)) return { place: { near: id, side: 'front' } }; if (/后|背后/.test(rel)) return { place: { near: id, side: 'behind' } };
    if (/周围|四周/.test(rel)) return { place: { near: id, side: 'any' }, around: o };
    if (/里|中间|中央/.test(rel)) return YX.spaceOf && YX.spaceOf(o) ? { place: { in: id } } : ['pond', 'water', 'fountain', 'bench', 'busstop'].includes(o.type) ? { place: { on: id } } : { place: { near: id, side: 'any' }, around: o }; // a building or a gazebo has room inside it
    if (rel === '对面') return { place: { across: id } };
    return { place: { near: id, side: 'any' } };
  }
  const RE_VERB = /(?:再|又|还|也|多|另外|顺便|给我|帮我|可以|请|想|我)*(添加|加上|加个|加|放上|放置|放个|放|来上|来个|来|造出|造个|造|建造|建个|建|盖个|盖|种上|种下|种个|种|生成|变出|弄个|摆上|摆个|摆|停上|停个|停|养|安装|安个|安|装上|立个|立|搭个|搭|修个|修|铺|开个|开|挂上|挂|画|做个|做|创建|创造|出现|想要|要个|要有|要|有)(?:一下|上|个|出|了|着)?/;
  const COUNTW = { 几: [3, 'add'], 好几: [4, 'add'], 一些: [5, 'scatter'], 更多: [5, 'scatter'], 多一些: [5, 'scatter'], 多几: [4, 'add'], 一排: [6, 'row'], 一行: [6, 'row'], 一列: [6, 'row'], 一片: [9, 'scatter'], 一群: [7, 'scatter'], 一堆: [6, 'scatter'], 一圈: [8, 'scatter'], 很多: [12, 'scatter'], 许多: [12, 'scatter'], 好多: [12, 'scatter'], 一大片: [16, 'scatter'], 一大群: [14, 'scatter'] };
  function parseAdd(clause, ph) {
    const s = strip(clause), m = RE_VERB.exec(s); if (!m) return null;
    const pre = s.slice(0, m.index); let post = s.slice(m.index + m[0].length);
    let count = 1, mode = 'add', mm;
    if ((mm = post.match(/^(一大片|一大群|好几|多一些|多几|更多|一些|一排|一行|一列|一片|一群|一堆|一圈|很多|许多|好多|几)/))) { count = COUNTW[mm[1]][0]; mode = COUNTW[mm[1]][1]; post = post.slice(mm[0].length); }
    else if ((mm = post.match(new RegExp('^(' + NUM + ')(?=' + CL + '|[\\u4e00-\\u9fa5a-z])')))) { const n = cnNum(mm[1]); if (isFinite(n) && n >= 1) { count = Math.round(n); post = post.slice(mm[0].length); } }
    post = post.replace(new RegExp('^' + CL), '').replace(/^的/, '');
    let color = null, scale = null, n = eatNoun(post);
    if (!n) { const c = eatColor(post); if (c) { color = c.hex; post = post.slice(c.len); n = eatNoun(post); } }
    if (!n) { const sz = post.match(/^(巨大|超大|很大|特别大|巨型|迷你|小小|很小|高大|大|小)的?/); if (sz) { const rest = post.slice(sz[0].length), n2 = eatNoun(rest); if (n2) { scale = { 巨大: 2.6, 超大: 2.6, 巨型: 2.6, 很大: 2, 特别大: 2.3, 高大: 1.6, 大: 1.5, 迷你: 0.45, 小小: 0.5, 很小: 0.5, 小: 0.65 }[sz[1]]; post = rest; n = n2; if (!color) { const c = eatColor(post); if (c) { color = c.hex; } } } } }
    if (!n || !n.type) return null;
    post = post.slice(n.len).replace(/^(?:吧|呗|啊|呀|哦|好了|就行|就好)+$/, '');
    const a = parsePlace(pre, ph); if (!a) return null;
    let b = { place: undefined }; if (post) { b = parsePlace(post, ph); if (!b) return null; }
    if (a.place !== undefined && b.place !== undefined) return null;
    return buildAdd(n, count, mode, color, scale, a.place !== undefined || a.row ? a : b, ph);
  }
  function buildAdd(n, count, mode, color, scale, pp, ph) {
    const def = G[n.type], params = Object.assign({}, n.params);
    if (def.mass && (mode === 'scatter' || mode === 'crowd')) { count = 1; mode = null; } // “一片麦田”、“一堆篝火”、“a patch of meadow”: the measure word belongs to the thing, it is one of them
    const base = { type: n.type }; if (Object.keys(params).length) base.params = params; if (color) base.color = color; if (scale) base.scale = scale;
    if (mode === 'crowd') { if (n.type === 'person') return [Object.assign({ op: 'crowd', count: Math.max(count, 3), activity: 'chat', place: pp.place }, Object.keys(params).length ? { params } : {})]; mode = 'scatter'; }
    if (pp.row && (count >= 3 || mode !== 'add')) return [Object.assign({ op: 'row', count: mode === 'add' ? count : Math.max(count, 8), spacing: def.cls === 'building' ? 16 : def.cls === 'nature' ? 9 : 10, along: 'road', side: pp.row.side }, base)];
    if (mode === 'row') return [Object.assign({ op: 'row', count, spacing: def.cls === 'building' ? 16 : def.cls === 'nature' ? 7 : 4, place: pp.place }, base)];
    if (mode === 'scatter' || (pp.around && count >= 3)) { const R = pp.around ? Math.max(pp.around.foot[0], pp.around.foot[1]) / 2 + 3 + count * 0.3 : def.cls === 'sky' ? 30 : def.cls === 'building' ? 30 : 6 + count * 0.6; return [Object.assign({ op: 'scatter', count, radius: R, place: pp.around ? { at: [pp.around.x, pp.around.z], exact: true } : pp.place }, base)]; }
    return [Object.assign({ op: 'add', count, place: pp.place }, base, pp.with ? { with: pp.with } : {})];
  }
  function withTarget(s, re, ph, need) { // "TARGET verb" or "verb TARGET" → {obj, m}
    const m = re.exec(s); if (!m) return null;
    const before = s.slice(0, m.index).replace(/^(?:把|将|让|给|对|使|叫)/, ''), after = s.slice(m.index + m[0].length).replace(/^(?:掉|了)/, '');
    if (before && after) return null;
    const t = before || after; let spec = null;
    if (t) { spec = parseTargetWhole(t); if (!spec) return null; }
    const o = resolveTarget(spec, ph); if (!o && need !== false) return null;
    return { o, m, explicit: !!t };
  }
  const ZH_ACT = { 聊聊天: 'chat', 聊起来: 'chat', 聊天: 'chat', 说话: 'chat', 交谈: 'chat', 谈话: 'chat', 笑起来: 'laugh', 笑一笑: 'laugh', 大笑: 'laugh', 笑: 'laugh', 欢呼: 'cheer', 鼓掌: 'clap', 拍手: 'clap', 挥手: 'wave', 招手: 'wave', 蹦蹦跳跳: 'jump', 跳起来: 'jump', 跳一跳: 'jump', 跳一下: 'jump', 跳几下: 'jump', 跳舞: 'dance', 跳: 'jump', 蹦: 'jump', 坐下: 'sit', 坐着: 'sit', 坐好: 'sit', 站起来: 'stand', 站着: 'stand', 站好: 'stand', 起立: 'stand', 蹲下: 'squat', 蹲着: 'squat', 跪下: 'kneel', 躺下: 'lie', 躺着: 'lie', 骑上自行车: 'ride', 骑自行车: 'ride', 骑上单车: 'ride', 骑单车: 'ride', 骑上车: 'ride', 骑车: 'ride', 停下来: 'stop', 停下: 'stop', 别动: 'stop', 散步: 'stroll', 走动: 'walk', 走起来: 'walk' }, ZH_ACT_KEYS = Object.keys(ZH_ACT).sort((a, b) => b.length - a.length);
  function parseOther(clause, ph) {
    const s = strip(clause); if (!s) return []; let m, r;
    if (isEN(s)) return enOther(clause, ph);
    // undo / clay
    { const g = /^(?:关掉|关闭|取消|去掉|没有)重力$|^(?:零|无)重力$|^失重$/.test(s) ? 0 : /^(?:低|弱|月球)重力$/.test(s) ? 0.17 : /^(?:恢复|打开|开启)重力$|^(?:正常|地球)重力$|^重力恢复(?:正常)?$/.test(s) ? 1 : /^(?:强|高|双倍)重力$/.test(s) ? 2 : null; if (g != null) return [{ op: 'env', gravity: g }]; }
    if (/^(?:撤销|撤回|回退|还原|取消刚才的?(?:操作)?|取消上一步|上一步|退一步|撤销上一步|不对撤销|undo|撤销一下|反悔)$/.test(s)) return [{ op: 'undo' }];
    if (/^(?:切到|切换到?|打开|开启|进入|用|来个|变成)?白模(?:模式)?$/.test(s)) return [{ op: 'clay', on: true }];
    if (/^(?:关闭|退出|取消|关掉)白模(?:模式)?$|^恢复(?:颜色|材质|彩色)$|^彩色(?:模式)?$/.test(s)) return [{ op: 'clay', on: false }];
    // shots + camera
    if (/^(?:保存|存|记住|记下|留下|记录|拍下|定下)(?:一下)?(?:这个|当前|这)?的?(?:机位|镜头|视角|画面|构图)$|^(?:机位|镜头)(?:保存|存)(?:一下)?$|^save (?:shot|camera)$/.test(s)) return [{ op: 'shot', save: true }];
    if ((m = s.match(new RegExp('^(?:切到|切换到?|去|回到|跳到|看)?第?(' + NUM + ')(?:个|号)?(?:机位|镜头)$'))) || (m = s.match(new RegExp('^(?:切到|切换到?|去|回到|跳到|看)?(?:机位|镜头)(' + NUM + ')$')))) { const n = cnNum(m[1]); if (isFinite(n)) return [{ op: 'shot', go: n }]; }
    if (/^(?:播放|开始|看看?|来)?(?:预演|回放|放一遍|播放镜头|播放机位|镜头预演)(?:一下|一遍)?$|^播放$|^play$/.test(s)) return [{ op: 'shot', play: true }];
    if (/^(?:停止|结束)(?:录制|录)(?:手持)?(?:镜头)?$|^咔$/.test(s)) return [{ op: 'shot', record: 'stop' }];
    if (/^开始(?:录制|录)(?:手持)?(?:镜头)?$|^手持(?:拍摄|镜头)$/.test(s)) return [{ op: 'shot', record: 'start' }];
    if (/^(?:录制|录)(?:手持)?(?:镜头)?$/.test(s)) return [{ op: 'shot', record: true }];
    if ((m = s.match(/^(?:换成?|切到|用|改成?|来个)?(\d{2,3})\s?(?:毫米|mm)(?:的?(?:镜头|焦段))?$/))) return [{ op: 'cam', lens: +m[1] }];
    if ((m = s.match(/^(?:换成?|切到|用|改成?|来个)?(超广角|广角|标准|标头|长焦|望远|人像)(?:镜头|焦段)?$/))) return [{ op: 'cam', lens: { 超广角: 16, 广角: 24, 标准: 50, 标头: 50, 长焦: 85, 望远: 135, 人像: 85 }[m[1]] }];
    if (/^(?:恢复|回到|切回)?(?:自由|正常|默认)(?:视角|镜头|焦段)$/.test(s)) return [{ op: 'cam', lens: 0 }];
    if (/^(?:鸟瞰|俯瞰|俯视|看全景|上帝视角|地图视角|全景|看看全貌)(?:一下|全景|视角)?$/.test(s)) return [{ op: 'cam', move: 'overview' }];
    if (/^(?:回到地面|落地|下来|回地面|降落)$/.test(s)) return [{ op: 'cam', move: 'reset' }];
    if ((r = withTarget(s, /(?:镜头)?(?:推近|推上去|推进|推过去|往前推|推镜头?)/, ph, false))) return [Object.assign({ op: 'cam', move: 'push' }, r.o && r.explicit ? { target: '#' + r.o.id } : {})];
    if (/^(?:镜头)?(?:拉远|拉开|拉出来|往后拉|拉镜头?)$/.test(s)) return [{ op: 'cam', move: 'pull' }];
    if ((m = s.match(/^(?:镜头)?(?:环绕|围绕|绕着?|围着)(.*?)(?:转|拍|飞|走)?(一圈|半圈|一周)?$/)) && (m[1] === '' || parseTargetWhole(m[1]))) { const o = m[1] ? resolveTarget(parseTargetWhole(m[1]), ph) : W.objs.get(ph.view.aimId) || W.objs.get(ph.view.focusId); if (o || !m[1]) return [Object.assign({ op: 'cam', move: 'orbit', deg: m[2] === '半圈' ? 180 : 360 }, o ? { target: '#' + o.id } : {})]; }
    if ((m = s.match(/^(?:镜头)?(?:跟拍|跟着|跟随|追着)(.*?)(?:拍|走|飞)?$/)) && (m[1] === '' || parseTargetWhole(m[1]))) { const o = m[1] ? resolveTarget(parseTargetWhole(m[1]), ph) : W.objs.get(ph.view.aimId); if (o) return [{ op: 'cam', move: 'follow', target: '#' + o.id }]; }
    if (/^(?:镜头)?(?:升起来|升高|升上去|往上升|摇臂升起?)$/.test(s)) return [{ op: 'cam', move: 'crane', amount: 7 }];
    if (/^(?:镜头)?(?:降下来|降低|往下降|摇臂降下?)$/.test(s)) return [{ op: 'cam', move: 'crane', amount: -5 }];
    if ((m = s.match(/^(?:镜头)?(?:向|往)?(左|右)(?:横移|平移)$|^(?:镜头)?(?:横移|平移)$/))) return [{ op: 'cam', move: 'truck', amount: m[1] === '左' ? -6 : 6 }];
    if ((m = s.match(/^(?:镜头)?(?:向|往)?(左|右)?摇(?:镜头?)?$/))) return [{ op: 'cam', move: 'pan', deg: m[1] === '左' ? -45 : 45 }];
    // environment
    { let t = s, env = {}, hit = false, mm2;
      if ((mm2 = t.match(new RegExp('(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜里)?(' + NUM + ')点(半|钟)?')))) { let h = cnNum(mm2[2]); if (isFinite(h) && h <= 24) { if (/下午|傍晚|晚上|夜里/.test(mm2[1] || '') && h < 12) h += 12; if (mm2[3] === '半') h += 0.5; env.time = h; hit = true; t = t.replace(mm2[0], ''); } }
      for (const k of Object.keys(WEATHER)) if (t.includes(k)) { env.weather = WEATHER[k]; hit = true; t = t.replace(k, ''); break; }
      for (const k of Object.keys(TIMES).sort((a, b) => b.length - a.length)) if (t.includes(k)) { env.time = TIMES[k]; hit = true; t = t.replace(k, ''); break; }
      if (/时间(?:开始)?(?:流动|流逝|动起来|走起来|加速)|让时间(?:流动|走)/.test(t)) { env.flow = 3; hit = true; t = t.replace(/让?时间(?:开始)?(?:流动|流逝|动起来|走起来|加速|走)/, ''); }
      else if (/时间(?:停止|暂停|静止|停下)|(?:停止|暂停|冻结)时间/.test(t)) { env.flow = 0; hit = true; t = t.replace(/时间(?:停止|暂停|静止|停下)|(?:停止|暂停|冻结)时间/, ''); }
      if ((mm2 = t.match(/(逆光|顺光|侧光)/))) { env.lightFrom = { 逆光: 'front', 顺光: 'back', 侧光: 'left' }[mm2[1]]; hit = true; t = t.replace(mm2[0], ''); }
      else if ((mm2 = t.match(/光(?:线)?从(左|右|前|后)(?:边|面|方|侧)?(?:打|照|射)?(?:过来|进来|下来)?/))) { env.lightFrom = { 左: 'left', 右: 'right', 前: 'front', 后: 'back' }[mm2[1]]; hit = true; t = t.replace(mm2[0], ''); }
      if ((mm2 = t.match(/(柔光|柔和的?光线?|硬光|光线?柔和|光线?硬朗)/))) { env.light = /硬/.test(mm2[1]) ? 'hard' : 'soft'; hit = true; t = t.replace(mm2[0], ''); }
      if ((mm2 = t.match(/(黑白|暖色调?|冷色调?|鲜艳|褪色|胶片感?|梦幻|正常色调|原色)/))) { env.look = { 黑白: 'noir', 暖色: 'warm', 暖色调: 'warm', 冷色: 'cool', 冷色调: 'cool', 鲜艳: 'vivid', 褪色: 'faded', 胶片: 'faded', 胶片感: 'faded', 梦幻: 'dream', 正常色调: 'none', 原色: 'none' }[mm2[1]]; hit = true; t = t.replace(mm2[0], ''); }
      if ((mm2 = t.match(/(?:地面|地上|地)(?:变成|换成|改成|是|铺上?)?(草地|沙地|沙漠|沙滩|雪地|泥地|土地|石板|石头)/))) { env.ground = { 草地: 'grass', 沙地: 'sand', 沙漠: 'sand', 沙滩: 'sand', 雪地: 'snow', 泥地: 'dirt', 土地: 'dirt', 石板: 'stone', 石头: 'stone' }[mm2[1]]; hit = true; t = t.replace(mm2[0], ''); }
      if (hit) { t = t.replace(/变成|变得?|改成|调成|调到|切到|换成|现在|时间|天气|天色|风格|电影|效果|画面|色调|开始|起来|下来|下去|一下|模式|把|让|到|是|了|天|要|来|个|点|吧|的|用|成|停|大/g, '').replace(/\s+/g, ''); if (!t) return [Object.assign({ op: 'env' }, env)]; }
    }
    // goto
    if ((m = s.match(/^(?:带我去|带我到|去|走到|飞到|传送到|我要去|我想去|送我去)(.+?)(?:那里|那儿|那边|旁边|面前|跟前|门口|看看)?$/))) { const sp = parseTargetWhole(m[1]); if (sp) { const o = resolveTarget(sp, ph); if (o) return [{ op: 'goto', id: '#' + o.id }]; } }
    // characters that already exist: "让他们聊天、笑" / "让这个小孩跳两下"
    { let t = s.replace(/^(?:让|叫|请|要)/, ''), times = null, mm; const acts = []; let guard = 0;
      if ((mm = t.match(new RegExp('跳(' + NUM + ')(?:下|次)$')))) { const k = cnNum(mm[1]); if (isFinite(k)) times = k; t = t.slice(0, mm.index) + '跳'; }
      outer: while (t && guard++ < 8) { for (const k of ZH_ACT_KEYS) if (t.endsWith(k)) { acts.unshift(ZH_ACT[k]); t = t.slice(0, t.length - k.length).replace(/(?:、|，|,|和|并且|并|又|且|一边|边|然后|还有|加上|再)$/, ''); continue outer; } break; }
      if (acts.length) {
        const subj = t.replace(/(?:都|也|一起|开始|正在|在|继续|给我|原地|就)+$/, ''), isC = (o) => !!o && (YX.defOf(o) || {}).cls === 'creature', ids = (l) => (l.length === 1 ? '#' + l[0].id : l.map((o) => '#' + o.id)), g = YX.groupNow(true).filter(isC), aim = W.objs.get(ph.view.aimId), foc = W.objs.get(ph.view.focusId);
        let id = null;
        if (!subj) { if (!acts.every((a) => a === 'stop' || a === 'walk')) { if (g.length > 1 && (!isC(aim) || g.includes(aim))) id = ids(g); else if (isC(aim)) id = '#' + aim.id; else if (isC(foc)) id = '#' + foc.id; else if (g.length) id = ids(g); } }
        else if (/^(?:他们|她们|它们|牠们|他俩|她俩|他们俩|她们俩|大家|所有人|这些人|那些人|这群人|那群人|这两个人|那两个人|两个人|这几个人|那几个人|你们)$/.test(subj)) { if (g.length) id = ids(g); }
        else { const sp = parseTargetWhole(subj), o = sp ? resolveTarget(sp, ph) : null; if (isC(o)) id = '#' + o.id; }
        if (id) return [Object.assign({ op: 'act', id, activity: acts.filter((a, i) => acts.indexOf(a) === i).join(',') }, times ? { times } : {})];
      }
    }
    // add
    r = parseAdd(clause, ph); if (r) return r;
    // company: "给这个大人加一个小孩" → the child stays at the adult's side
    if ((m = s.match(new RegExp('^给(.+?)(?:再|也)?(?:加上|添上|配上|带上|加|添|配|带|安排|来)(?:了)?(' + NUM + ')?' + CL + '?(.+)$')))) {
      const sp = parseTargetWhole(m[1]), o = sp ? resolveTarget(sp, ph) : null, n = eatNoun(m[3]), cnt = m[2] ? cnNum(m[2]) : 1;
      if (o && (YX.defOf(o) || {}).cls === 'creature' && n && n.type && n.len === m[3].length && G[n.type].cls === 'creature') return [Object.assign({ op: 'add', type: n.type, count: isFinite(cnt) && cnt >= 1 ? Math.round(cnt) : 1, with: '#' + o.id }, n.params ? { params: n.params } : {})];
    }
    // walk together: "让小孩牵着大人的手" / "让他跟着她"
    if ((m = s.match(/^(?:让|叫|请)(.+?)(?:跟着|跟随|跟在|跟上|牵着|拉着|陪着|挽着)(.+?)(?:的手|身后|后面|旁边|身边)?(?:走|一起走|散步|走路)?$/)) || (m = s.match(/^(?:让|叫|请)?(.+?)(?:和|跟|与)(.+?)(?:手牵手|手拉手|牵手|牵着手|一起走|一起散步|并排走)$/))) {
      const isC = (o) => !!o && (YX.defOf(o) || {}).cls === 'creature', sa = parseTargetWhole(m[1]), sb = parseTargetWhole(m[2]), a = sa ? resolveTarget(sa, ph) : null; let b2 = sb ? resolveTarget(sb, ph) : null;
      if (b2 && b2 === a && sb.noun && sb.noun.type) { let bd = 1e9; b2 = null; for (const o of W.objs.values()) if (o !== a && o.type === sb.noun.type && (!sb.noun.params || Object.keys(sb.noun.params).every((k) => String(o.params[k]) === String(sb.noun.params[k])))) { const d = Math.hypot(o.x - a.x, o.z - a.z); if (d < bd) { bd = d; b2 = o; } } }
      if (isC(a) && isC(b2) && a !== b2) return [{ op: 'follow', id: '#' + a.id, target: '#' + b2.id }];
    }
    // remove
    if ((r = withTarget(s, /(?:删掉|删除|删了|删|去掉|拿掉|拿走|移除|移走|去除|不要了?|消失|干掉|拆掉|拆了|拆除|砍掉|砍了|清除|清掉|弄走|搬走|delete|remove)/, ph))) return [{ op: 'remove', id: '#' + r.o.id }];
    // colour
    if ((m = s.match(/^(.*?)(?:变成|改成|换成|涂成|刷成|漆成|染成|弄成|调成|变为|改为|换|变|改|涂|刷|漆|染|是)(.+)$/))) { const c = eatColor(m[2]); if (c && c.len === m[2].length) { const t = m[1].replace(/^(?:把|将|让|给)/, '').replace(/的?颜色$/, ''), sp = t ? parseTargetWhole(t) : null; if (!t || sp) { const o = resolveTarget(sp, ph); if (o) return [{ op: 'set', id: '#' + o.id, params: { color: c.hex } }]; } } }
    // become: "把它变成双层巴士" / "把这个房子改成咖啡馆"
    if ((m = s.match(/^(.*?)(?:变成|换成|改成|变为|改为|替换成|替换为|改造成|升级成|升级为|换作|变作|做成|弄成)(.+)$/))) {
      const tstr = m[1].replace(/^(?:把|将|让|给)/, ''), sp = tstr ? parseTargetWhole(tstr) : null;
      if (!tstr || sp) { const o = resolveTarget(sp, ph); let x = m[2], n = eatNoun(x); if (!n || n.len !== x.length) { x = x.replace(new RegExp('^一?' + CL + '?'), ''); n = eatNoun(x); }
        if (o && n && n.type && n.len === x.length) { if (o.type === n.type) { if (n.params) return [{ op: 'set', id: '#' + o.id, params: n.params }]; } else return [Object.assign({ op: 'become', id: '#' + o.id, type: n.type }, n.params ? { params: n.params } : {})]; } }
    }
    // rotate
    if ((r = withTarget(s, /(?:向|往)?左转(?:一下)?|(?:向|往)?右转(?:一下)?|转(\d+|九十|四十五|一百八十)度|转一下|转个身|转过来|转过去|旋转(?:一下)?|转动(?:一下)?|掉头|调头|转身|转个方向|面向我|面对我|朝向我|朝着我|朝我|对着我|背对我|背对着我/, ph))) { const w = r.m[0]; if (/面|朝|对着我/.test(w) && !/背/.test(w)) return [{ op: 'rotate', id: '#' + r.o.id, face: 'me' }]; if (/背/.test(w)) return [{ op: 'rotate', id: '#' + r.o.id, face: 'away' }]; let deg = 90; if (/左转/.test(w)) deg = -90; else if (/掉头|调头|转身|转过去|转过来/.test(w)) deg = 180; else if (r.m[1]) deg = { 九十: 90, 四十五: 45, 一百八十: 180 }[r.m[1]] || +r.m[1]; return [{ op: 'rotate', id: '#' + r.o.id, deg }]; }
    // move / walk to a place: "把巴士挪到眼前的马路上" / "让他走到长椅那里"
    if ((m = s.match(/^(?:把|将|让|叫|请)?(.*?)(挪动|移动|挪|移|搬|放|弄|拿|开|停|拖|带|送|摆|走|跑|站|坐|躺|蹲|回|过)(到|去|在|回|进|上)(.+)$/))) {
      const tstr = m[1], verb = m[2], part = m[3], pstr = m[4].replace(/(?:去|来|吧)$/, ''); let id = null, o = null;
      if (/^(?:他们|她们|它们|牠们|他俩|她俩|大家|这些人|那些人|这些|那些)$/.test(tstr)) { id = 'them'; o = YX.groupNow(/人|他|她|大家/.test(tstr))[0] || null; }
      else { const sp = tstr ? parseTargetWhole(tstr) : null; if (!tstr || sp) { o = resolveTarget(sp, ph); if (o) id = '#' + o.id; } }
      { // "让一个人坐在这把椅子上": an indefinite someone is a new person, placed there in that pose, not whoever happens to stand nearest
        const ind = tstr.match(/^(?:再)?(?:来)?(一|两|二|三|四|五|几)?(?:个|位|名|只|条|头)(.+)$/), POSE = { 坐: 'sit', 躺: 'lie', 蹲: 'squat', 站: 'stand' };
        if (ind && POSE[verb] && !/^[这那]/.test(tstr)) { const nn = eatNoun(ind[2]); if (nn && nn.type && nn.len === ind[2].length) { const pl0 = parsePlace(pstr, ph); if (pl0 && pl0.place !== undefined) return [{ op: 'add', type: nn.type, params: Object.assign({}, nn.params || {}, G[nn.type].params && G[nn.type].params.pose ? { pose: POSE[verb] } : {}), count: { 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 几: 3 }[ind[1]] || 1, place: pl0.place }]; } }
      }
      if (id && part === '进') { // "走进凉亭" / "走进去": into the space that thing has inside it
        const t0 = pstr.replace(/的?(?:里面|里边|里头|里)$/, ''), sp0 = t0 ? parseTargetWhole(t0) : null, so = t0 ? (sp0 ? resolveTarget(sp0, ph) : null) : W.objs.get(ph.view.aimId) || null;
        if (so && so !== o && YX.spaceOf && YX.spaceOf(so)) return (YX.defOf(o) || {}).cls === 'creature' && o.motion !== 'fly' ? [Object.assign({ op: 'walk', id, to: { in: '#' + so.id } }, verb === '跑' ? { run: true } : {}, { 坐: { pose: 'sit' }, 蹲: { pose: 'squat' }, 躺: { pose: 'lie' } }[verb] || {})] : [{ op: 'move', id, place: { in: '#' + so.id } }];
      }
      if (id) {
        const dir = pstr.match(/^(?:我的?)?(左|右|前|后)(?:边|面|方|侧)?$/);
        if (dir && !/^我/.test(pstr)) return [{ op: 'move', id, by: { 左: { right: -2.5 }, 右: { right: 2.5 }, 前: { forward: 2.5 }, 后: { forward: -2.5 } }[dir[1]] }];
        let pl = null; const nr = pstr.match(/^(.+?)(?:那里|那儿|那边|这里|这儿|这边)$/);
        if (nr) { const tsp = parseTargetWhole(nr[1]), to = tsp ? resolveTarget(tsp, ph) : null; if (to && to !== o) pl = { place: ['bench', 'busstop', 'gazebo'].includes(to.type) && /坐|躺/.test(verb) ? { on: '#' + to.id } : { near: '#' + to.id, side: 'front' } }; }
        if (!pl) pl = parsePlace(pstr, ph);
        if (pl && pl.place !== undefined) {
          if (o && (YX.defOf(o) || {}).cls === 'creature' && o.motion !== 'fly' && /^(?:走|跑|站|坐|躺|蹲|回|过)$/.test(verb)) return [Object.assign({ op: 'walk', id, to: pl.place }, verb === '跑' ? { run: true } : {}, { 坐: { pose: 'sit' }, 蹲: { pose: 'squat' }, 躺: { pose: 'lie' } }[verb] || {})];
          return [{ op: 'move', id, place: pl.place }];
        }
      }
    }
    { // "再让一个人坐上去" / "让他也坐这儿": onto the seat being pointed at, or the one the last command used
      const sm = s.match(/^(?:再|又)?(?:让|叫|请|给)?(.*?)(?:也)?坐(?:上去|上来|过去|到?这儿|到?这里|在这儿|在这里|到?那儿|到?那里)$/);
      if (sm) { const ao = W.objs.get(ph.view.aimId), lo = M.lastSeat != null ? W.objs.get(M.lastSeat) : null, seat = ao && YX.seatsOf(ao).length ? ao : lo && !lo.dead && YX.seatsOf(lo).length ? lo : null;
        if (seat) { const t = sm[1]; if (!t || /^(?:再)?(?:来)?(?:(?:一|两|二|三|几)?(?:个|位|名))?人$/.test(t)) return [{ op: 'add', type: 'person', params: { pose: 'sit' }, place: { on: '#' + seat.id } }]; const sp = parseTargetWhole(t), o = sp ? resolveTarget(sp, ph) : null; if (o && o.type === 'person') return [{ op: 'walk', id: '#' + o.id, to: { on: '#' + seat.id }, pose: 'sit' }]; } }
    }
    // move
    { const dm = s.match(new RegExp('^(.*?)(往|向|朝)?(左|右|前|后|上|下)(?:边|面|方)?(移动|移|挪动|挪|推|拉|靠|平移|动|去|来|升|降)?(?:过去|过来)?(一点点|一点|一些|点|很多|(' + NUM + ')米)?$'));
      if (dm && (dm[2] || dm[4])) { const t = dm[1].replace(/^(?:把|将|让|给)/, ''), sp = t ? parseTargetWhole(t) : null; if (!t || sp) { const o = resolveTarget(sp, ph); if (o) { let a = dm[6] ? cnNum(dm[6]) : { 一点点: 0.5, 一点: 1.5, 点: 1.5, 一些: 2.5, 很多: 6 }[dm[5]] || 1.5; if (!isFinite(a)) a = 1.5; const by = { 左: { right: -a }, 右: { right: a }, 前: { forward: a }, 后: { forward: -a }, 上: { up: a }, 下: { up: -a } }[dm[3]]; return [{ op: 'move', id: '#' + o.id, by }]; } } }
      const nf = s.match(/^(.*?)(?:拉|移|靠|挪|放|走|弄)?(近|远)(一点点|一点|一些|点|很多)?$|^(.*?)(过来|过去)(一点点|一点|一些|点)?$/);
      if (nf) { const t = (nf[1] || nf[4] || '').replace(/^(?:把|将|让|给)/, ''), sp = t ? parseTargetWhole(t) : null; if (!t || sp) { const o = resolveTarget(sp, ph); if (o) { const a = { 一点点: 0.8, 一点: 2, 点: 2, 一些: 3.5, 很多: 8 }[nf[3] || nf[6]] || 2, far = nf[2] === '远' || nf[5] === '过去'; return [{ op: 'move', id: '#' + o.id, by: { forward: far ? a : -a } }]; } } }
    }
    return null;
  }
  /* ================= tier 0 · English grammar ================= */
  const isEN = (s) => !/[㐀-鿿]/.test(s);
  const EN_NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50 };
  const NUMW = '(?:\\d+(?:\\.\\d+)?|' + Object.keys(EN_NUM).join('|') + ')';
  const enNum = (w) => (w == null ? NaN : /^\d+(\.\d+)?$/.test(w) ? parseFloat(w) : EN_NUM[w] != null ? EN_NUM[w] : NaN);
  function enNorm(s) {
    let t = norm(s).replace(/[-–—_]/g, ' ').replace(/[éè]/g, 'e').replace(/[.!?,;:]+$/g, '').replace(/\s+/g, ' ').trim(), p;
    do { p = t; t = t.replace(/^(?:um+|uh+|er+|hmm+|okay|ok|alright|all right|please|hey|so|well|now|and|then|also|can you|could you|would you|will you|i want you to|i need you to|id like you to|i would like you to|go ahead and|lets|let us|just|claude|and then|next)[, ]+/, '').replace(/[, ]+(?:please|now|thanks|thank you|for me|right now|too|as well|if you can|okay|ok)$/, ''); } while (t !== p);
    return t;
  }
  function enNoun(str) {
    const N0 = YX.EN_NOUNS; if (!N0 || !str) return null; const pickN = (e) => (e && e.fam ? { type: YX.nounPick(e), params: e.params, fam: e.fam } : e), N = { has: (k) => N0.has(k), get: (k) => pickN(N0.get(k)) }; const s = str.trim(); if (N.has(s)) return N.get(s);
    const IRR = { people: 'person', men: 'man', women: 'woman', children: 'child', buses: 'bus', benches: 'bench', bushes: 'bush', boxes: 'box' };
    const words = s.split(' '), last = words[words.length - 1], head = words.slice(0, -1).join(' '), c = [];
    if (IRR[last]) c.push(IRR[last]); if (/ies$/.test(last)) c.push(last.slice(0, -3) + 'y'); if (/(?:ch|sh|s|x|z)es$/.test(last)) c.push(last.slice(0, -2)); if (/s$/.test(last) && !/ss$/.test(last)) c.push(last.slice(0, -1));
    for (const k of c) { const w = (head ? head + ' ' : '') + k; if (N.has(w)) return N.get(w); }
    return null;
  }
  const EN_COLOR_KEYS = Object.keys(YX.EN_COLORS).sort((a, b) => b.length - a.length);
  const enColor = (s) => YX.EN_COLORS[(s || '').trim().replace(/ ?(?:colou?red|colou?r)$/, '')] || null;
  /* a target phrase: null = none given, false = not understood */
  function enSpec(t) {
    t = (t || '').trim().replace(/ (?:in front of me|right here|over there|i am looking at|im looking at|i am pointing at|im pointing at|im aiming at|here|there)$/, '');
    if (!t) return null;
    if (/^(?:it|itself)$/.test(t)) return { pron: true };
    if (/^(?:him|her|he|she|himself|herself)$/.test(t)) return { pron: true, person: true };
    if (/^(?:this|that|this one|that one|the one|this thing|that thing|the thing|this object|that object|this guy|that guy)$/.test(t)) return { demo: true };
    if (/^(?:them|they|those|these|both|all of them|both of them|the two of them|everyone|everybody|those two|these two|those guys|these guys|them all|they all|they both)$/.test(t)) return { group: true };
    const m = t.match(/^(the|this|that|my|these|those|all the|both|a|an|his|her|their)? ?(.+)$/); if (!m) return false;
    if (/^(?:building|structure|place)s?$/.test(m[2])) return { demo: true, noun: { generic: '建筑' } };
    const n = enNoun(m[2]); if (!n) return false;
    return { demo: /^(?:this|that)$/.test(m[1] || ''), noun: Object.assign({ len: 0 }, n) };
  }
  const tid = (sp, ph) => { if (sp && sp.group) return 'them'; const o = resolveTarget(sp, ph); return o ? '#' + o.id : null; };
  const CMP = { bigger: ['size', 1], larger: ['size', 1], huger: ['size', 1], smaller: ['size', -1], tinier: ['size', -1], littler: ['size', -1], taller: ['height', 1], higher: ['height', 1], shorter: ['height', -1], lower: ['height', -1], wider: ['width', 1], broader: ['width', 1], fatter: ['width', 1], narrower: ['width', -1], thinner: ['width', -1], slimmer: ['width', -1], skinnier: ['width', -1], longer: ['length', 1], deeper: ['depth', 1], thicker: ['depth', 1], shallower: ['depth', -1] };
  const ADJ_EN = { big: ['size', 1], large: ['size', 1], small: ['size', -1], tall: ['height', 1], high: ['height', 1], short: ['height', -1], low: ['height', -1], wide: ['width', 1], narrow: ['width', -1], thin: ['width', -1], long: ['length', 1], deep: ['depth', 1], thick: ['depth', 1] };
  const RE_CMP = new RegExp('(?:^| )((?:(?:and|then|also|even|still|yet|the|bit|little|tiny|tad|touch|slightly|somewhat|much|lot|lots|way|far|really|significantly|considerably|super|very|twice|double|times|x|' + NUMW + ') )*)(' + Object.keys(CMP).join('|') + ')(?: again| too| as well)?$');
  function cmpFactor(mods, dir) {
    let f = 1.18, m;
    if (/\b(?:twice|double)\b/.test(mods)) f = 2; else if ((m = mods.match(new RegExp('(' + NUMW + ') ?(?:times|x)\\b')))) { const n = enNum(m[1]); if (isFinite(n) && n > 1) f = clamp(n, 1.01, 20); }
    else if (/\b(?:tiny|tad|touch|slightly)\b/.test(mods)) f = 1.08; else if (/\b(?:much|lot|lots|way|far|really|significantly|considerably|super|very)\b/.test(mods)) f = 1.6;
    return dir > 0 ? f : 1 / f;
  }
  function enResize(clause) {
    const s = enNorm(clause); if (!s) return null; let m;
    if (/^(?:again|more|keep going|keep it going|one more time|once more|one more|(?:a )?(?:little|bit|little bit|tiny bit) more|some more|even more|more more|go on|continue|more please|again again|do it again|do that again|same again|more and more|further|a bit further)$/.test(s)) return { kind: 'repeat' };
    if ((m = s.match(new RegExp('^(?:make |have |i want )?(.*?) ?(?:to be |be )?(twice|half|(' + NUMW + ') times) as (' + Object.keys(ADJ_EN).join('|') + ')(?: as (?:before|it is|now))?$')))) {
      const a = ADJ_EN[m[4]], sp = enSpec(m[1]); if (sp === false) return null; let f = m[2] === 'twice' ? 2 : m[2] === 'half' ? 0.5 : enNum(m[3]); if (!isFinite(f) || f <= 0) return null; if (a[1] < 0) f = 1 / f;
      return { kind: 'resize', target: sp, ops: [{ dim: a[0], factor: clamp(f, 0.05, 20) }] };
    }
    if ((m = s.match(/^(enlarge|grow|expand|shrink|scale up|scale down|size up|size down|widen|lengthen|shorten|heighten|double|halve|triple|quadruple)(?: (?:the|its) (size|height|width|length|depth)(?: of)?)? ?(.*?)(?: by (half|a third|\d+ ?(?:%|percent)))?( a (?:little )?bit| a little| slightly| a lot| a tad)?$/))) {
      const V = { enlarge: ['size', 1.25], grow: ['size', 1.25], expand: ['size', 1.25], 'scale up': ['size', 1.25], 'size up': ['size', 1.25], shrink: ['size', 0.8], 'scale down': ['size', 0.8], 'size down': ['size', 0.8], widen: ['width', 1.25], lengthen: ['length', 1.25], shorten: ['height', 0.8], heighten: ['height', 1.25], double: [null, 2], halve: [null, 0.5], triple: [null, 3], quadruple: [null, 4] }[m[1]];
      const sp = enSpec(m[3].replace(/^(?:of |the size of |in size)/, '').replace(/ in size$/, '')); if (sp === false) return null;
      let f = V[1]; if (m[4]) { const k = m[4] === 'half' ? 0.5 : m[4] === 'a third' ? 0.33 : parseFloat(m[4]) / 100; if (isFinite(k)) f = V[1] >= 1 ? 1 + k : 1 - Math.min(0.9, k); } else if (m[5]) { const big = / a lot/.test(m[5]); f = V[1] >= 1 ? (big ? 1.6 : 1.12) : big ? 0.6 : 0.9; }
      return { kind: 'resize', target: sp, ops: [{ dim: m[2] || V[0] || 'size', factor: f }] };
    }
    const ops = []; let rest = s;
    while ((m = rest.match(RE_CMP))) { const c = CMP[m[2]]; ops.unshift({ dim: c[0], factor: cmpFactor(m[1] || '', c[1]) }); rest = rest.slice(0, m.index).replace(/(?:,| and also| and then| and| then| but)$/, '').trim(); if (!rest) break; }
    if (!ops.length) return null;
    rest = rest.replace(/^(?:make|have|get|scale|resize|i want|id like|i need|we need|can we (?:make|have|get)|could we (?:make|have))\b ?/, '').replace(/(?:^| )(?:to be|be|should be|needs to be|could be|ought to be|must be|look|become|get|grow|go|a|an)$/, '').trim();
    const sp = enSpec(rest); if (sp === false) return null;
    return { kind: 'resize', target: sp, ops };
  }
  function enPlace(str, ph) {
    const s = (str || '').trim().replace(/^(?:just |right |somewhere |out |and |then )+/, '').replace(/ (?:please|now|too)$/, ''); let m;
    if (!s) return { place: undefined };
    const T1 = (t) => { const sp = enSpec(t); if (sp === false || (sp && sp.group)) return null; return resolveTarget(sp, ph) || null; };
    // a pond, a lake: "to / onto / on / at / in the pond" means the water itself. What floats goes on it, anything else is put on the bank (resolvePlace decides); "next to / by / near the pond" stays the bank
    const isWater = (o) => !!(o && YX.spaceOf && (YX.spaceOf(o) || {}).water);
    if (/^(?:over |right |up |down |back )?(?:here|there)$|^(?:where|wherever) (?:i am|im) (?:looking|pointing|aiming)(?: at)?$|^(?:at|on|in) (?:the|this|that|my) (?:crosshair|spot|point|place|location)$/.test(s)) return { place: { aim: true } };
    if (/^(?:in front of|before|ahead of|facing) me$|^(?:in front|ahead|up ahead|straight ahead)$/.test(s)) return { place: { front: 9 } };
    if (/^(?:next to|beside|by|near|close to|around|with|to|toward|towards|over to|back to) me$|^(?:by|at) my (?:side|feet)$|^nearby$|^close by$/.test(s)) return { place: { front: 3.5, right: 2.4 } };
    if (/^behind me$|^at my back$/.test(s)) return { place: { front: -6 } };
    if (/^(?:to|on|at) (?:my|the) left(?: of me)?$|^left of me$/.test(s)) return { place: { front: 2, right: -5 } };
    if (/^(?:to|on|at) (?:my|the) right(?: of me)?$|^right of me$/.test(s)) return { place: { front: 2, right: 5 } };
    if (/^(?:up )?(?:in|into|to) the (?:sky|air|clouds|heavens)$|^(?:above|over) (?:me|my head|us)$|^overhead$|^up (?:high|above|there)$|^high up$|^above$/.test(s)) return { place: { above: 'me' } };
    if (/^(?:in|into|off in|far in|way off in) the distance$|^far away$|^far off$|^on the horizon$|^way over there$|^far from here$/.test(s)) return { place: { front: 45 } };
    if (/^(?:across|over|on the other side of|on the opposite side of|on the far side of|opposite|to the other side of) (?:the|this|that) (?:road|street|way)$|^across the way$|^on the other side$|^across$/.test(s)) return { place: { across: true } };
    if ((m = s.match(/^(?:across from|opposite|across the (?:road|street) from) (.+)$/))) { const o = T1(m[1]); return o ? { place: { across: '#' + o.id } } : null; }
    if ((m = s.match(/^(?:walking |standing |strolling )?(?:with|alongside|following|accompanying|holding hands with|holding the hand of|hand in hand with) (.+)$/)) || (m = s.match(/^holding (.+?) hands?$/)) || (m = s.match(/^(?:to|for) (.+)$/))) { // company: the newcomer stays at that character's side
      const o = T1({ his: 'him', her: 'her', their: 'them', its: 'it', hers: 'her' }[m[1]] || m[1]); if (o && (YX.defOf(o) || {}).cls === 'creature') return { place: { near: '#' + o.id, side: 'right', gap: 0.2 }, with: '#' + o.id };
    }
    const RD = '(?:the |this |that |a |my )?(?:main |nearest |closest )?(?:road|street|lane|roadway|highway)(?: (?:in front of me|ahead of me|ahead|here|over there|there|i am looking at|im looking at))?';
    if (new RegExp('^(?:on both sides of|on either side of|on each side of|along both sides of|lining|along|down|up and down|all along) ' + RD + '$').test(s)) return { place: undefined, row: { along: 'road', side: 'both' } };
    if (new RegExp('^(?:by|beside|next to|near|alongside|at|on|to|along) (?:the |this )?(?:side of the (?:road|street)|roadside|edge of the (?:road|street)|curb|kerb|sidewalk|pavement|footpath)$|^(?:by|beside|next to|near|alongside|off) ' + RD + '$').test(s)) return { place: { road: 'ahead', side: 'beside' }, row: { along: 'road', side: 'near' }, roadside: true };
    if (new RegExp('^(?:back |out |over |down |up )?(?:on|onto|on to|in|into|to|in the middle of|on top of|at|upon) ' + RD + '$').test(s)) return { place: { road: 'ahead' } };
    if (/^(?:on|onto|on top of|up on|atop) (?:the|its|that|this) (?:roof|rooftop|top)$|^on top$|^on the top$|^up top$/.test(s)) { const o = resolveTarget({ demo: true, noun: { generic: '建筑' } }, ph) || resolveTarget(null, ph); return o ? { place: { on: '#' + o.id } } : null; }
    if ((m = s.match(/^(?:on|onto|on top of|up on|atop|upon) (?:the |a )?(?:roof|rooftop|top|back|head|seat) of (.+)$/)) || (m = s.match(/^(?:on top of|onto|on to|atop|upon|up on|on) (.+)$/))) { const o = T1(m[1].replace(/ (?:roof|rooftop)$/, '')); return o ? (isWater(o) ? { place: { in: '#' + o.id } } : { place: { on: '#' + o.id } }) : null; }
    if ((m = s.match(/^(?:in|into|inside|inside of|within|under the roof of|under) (.+)$/))) { const o = T1(m[1]); if (o && YX.spaceOf && YX.spaceOf(o)) return { place: { in: '#' + o.id } }; } // a building or a gazebo has room inside it
    if ((m = s.match(/^(?:above|over|up above|high above) (.+)$/))) { const o = T1(m[1]); return o ? { place: { above: '#' + o.id, height: 4 } } : null; }
    if ((m = s.match(/^(?:in )?between (.+?) (?:and|&) (.+)$/))) { const a = T1(m[1]), b = T1(m[2]); return a && b ? { place: { between: ['#' + a.id, '#' + b.id] } } : null; }
    const REL = [[/^(?:to the |on the |at the )?left(?: side| hand side)? of (.+)$/, 'left'], [/^(?:to the |on the |at the )?right(?: side| hand side)? of (.+)$/, 'right'], [/^(?:in front of|at the front of|out front of|before|outside(?: of)?|at the door of|by the door of|at the entrance (?:of|to)) (.+)$/, 'front'], [/^(?:behind|in back of|at the back of|round the back of|around the back of) (.+)$/, 'behind'], [/^(?:around|surrounding|all around|round|encircling) (.+)$/, 'around'], [/^(?:inside(?: of)?|in the middle of|in the center of|in the centre of|within|into|in) (.+)$/, 'in'], [/^(?:next to|beside|by|near|close to|alongside|at|under|underneath|beneath|below|against|with|over by|over at|up to|over to|back to|up against|toward|towards|to) (.+)$/, 'any']];
    for (const [re, rel] of REL) {
      if (!(m = s.match(re))) continue; const o = T1(m[1]); if (!o) return null; const id = '#' + o.id;
      if (rel === 'around') return { place: { near: id, side: 'any' }, around: o };
      if (isWater(o) && (rel === 'in' || (rel === 'any' && /^(?:to|at|onto|on to|over to|back to|up to|over at|out to|out on) /.test(s)))) return { place: { in: id } };
      if (rel === 'in') return ['pond', 'water', 'gazebo', 'fountain', 'bench', 'busstop'].includes(o.type) ? { place: { on: id } } : o.type === 'road' ? { place: { road: id } } : { place: { near: id, side: 'any' }, around: o };
      if (o.type === 'road') return { place: { road: id, side: 'beside' } };
      return { place: { near: id, side: rel } };
    }
    return null;
  }
  const EN_COUNT = [[/^(?:a field of|a forest of|a sea of|dozens of|a whole bunch of) /, 18, 'scatter'], [/^a crowd of /, 9, 'crowd'], [/^(?:a row of|a line of|a string of) /, 6, 'row'], [/^(?:a bunch of|a group of|a cluster of|a patch of|a clump of|a flock of|a herd of|a pack of) /, 7, 'scatter'], [/^(?:many|lots of|a lot of|plenty of|loads of|tons of|a ton of|a dozen) /, 12, 'scatter'], [/^(?:a couple of|a couple|a pair of) /, 2, 'add'], [/^(?:a few|few) /, 3, 'add'], [/^several /, 4, 'add'], [/^(?:some more|some|a handful of) /, 5, 'scatter'], [/^(?:a|an|one|another|one more|a single|1) /, 1, 'add'], [/^(?:more|extra|additional) /, 5, 'scatter']]; // "more trees" asks for several, not for one
  const EN_SIZE = { huge: 2.6, giant: 2.6, gigantic: 2.6, enormous: 2.6, massive: 2.6, big: 1.5, large: 1.5, tall: 1.4, small: 0.65, little: 0.65, tiny: 0.45, mini: 0.45, miniature: 0.45 };
  const RE_ENVERB = /^(?:add|put|place|plant|build|create|make|spawn|drop|insert|give me|get me|i want|i need|id like|i would like|we need|have|there should be|there is|theres|how about|what about|bring in|set up|install|park|grow|generate|draw|construct|erect|throw in|toss in|show me|give us)(?: in| down| up)? /;
  function enAdd(clause, ph) {
    let s = enNorm(clause), pre = '', m, verb = false, comp = null;
    if ((m = s.match(/^give (.+?) ((?:a|an|one|two|three|another|some|a couple of) .+)$/)) && !/^(?:me|us)$/.test(m[1])) { const sp = enSpec(m[1]), o = sp ? resolveTarget(sp, ph) : null; if (o && (YX.defOf(o) || {}).cls === 'creature') { comp = '#' + o.id; s = 'add ' + m[2]; } }
    if (!RE_ENVERB.test(s) && (m = s.match(/^(.+?),? (?:add|put|place|plant|build|create|make|spawn|i want|there should be|there is|theres|park|grow) (.+)$/))) { pre = m[1]; s = m[2]; verb = true; }
    else if ((m = s.match(RE_ENVERB))) { s = s.slice(m[0].length); verb = true; }
    if (/^(?:it|this|that|them|those|these|him|her|the|its|my|me|us) /.test(s) || /^(?:it|this|that|them)$/.test(s)) return null;
    let count = 1, mode = 'add', counted = false;
    for (const [re, n, md] of EN_COUNT) if ((m = s.match(re))) { count = n; mode = md; s = s.slice(m[0].length); counted = true; break; }
    if (!counted && (m = s.match(new RegExp('^(' + NUMW + ') (?:more |new |extra |other )?')))) { const n = enNum(m[1]); if (isFinite(n) && n >= 1) { count = Math.round(n); s = s.slice(m[0].length); counted = true; } }
    if (!verb && !counted) return null;
    s = s.replace(/^(?:more|new|extra|other|additional|nice|lovely|cute|pretty|beautiful|simple|old|modern) /, '');
    let color = null, scale = null;
    for (let g = 0; g < 4; g++) {
      let hit = false;
      for (const k of EN_COLOR_KEYS) if (s.startsWith(k + ' ')) { color = YX.EN_COLORS[k]; s = s.slice(k.length + 1); hit = true; break; }
      if (!hit && (m = s.match(/^(?:really |very |super )?(huge|giant|gigantic|enormous|massive|big|large|tall|small|little|tiny|mini|miniature) /))) { scale = EN_SIZE[m[1]]; s = s.slice(m[0].length); hit = true; }
      if (!hit) break;
    }
    const w = s.split(' '); let n = null, used = 0;
    for (let k = Math.min(4, w.length); k >= 1; k--) { n = enNoun(w.slice(0, k).join(' ')); if (n) { used = k; break; } }
    if (!n || !n.type) return null;
    const post = w.slice(used).join(' ').replace(/^(?:that is |which is |thats |standing |sitting |parked |growing |located |placed )/, '');
    const a = enPlace(pre, ph); if (!a) return null;
    let b = { place: undefined }; if (post) { b = enPlace(post, ph); if (!b) return null; }
    if (a.place !== undefined && b.place !== undefined) return null;
    const pp = a.place !== undefined || a.row ? a : b; if (comp && pp.place === undefined && !pp.row && G[n.type].cls === 'creature') return buildAdd(n, count, mode, color, scale, { place: undefined, with: comp }, ph);
    return buildAdd(n, count, mode, color, scale, pp, ph);
  }
  const EN_TIMES = [['late at night', 23], ['middle of the night', 0], ['early morning', 6.6], ['golden hour', 17.4], ['blue hour', 19.2], ['magic hour', 17.6], ['night time', 22], ['nighttime', 22], ['day time', 12], ['daytime', 12], ['midnight', 0], ['evening', 19], ['twilight', 19], ['sunset', 18.1], ['sundown', 18.1], ['sunrise', 6.4], ['afternoon', 15.5], ['midday', 12], ['morning', 8], ['night', 22], ['noon', 12], ['dusk', 18.6], ['dawn', 6], ['dark', 21.5]];
  const EN_WEATHER = [['thunderstorm', 'storm'], ['heavy rain', 'storm'], ['stormy', 'storm'], ['storm', 'storm'], ['stop the rain', 'clear'], ['stop raining', 'clear'], ['stop the snow', 'clear'], ['stop snowing', 'clear'], ['no more rain', 'clear'], ['no more snow', 'clear'], ['clear the fog', 'clear'], ['clear skies', 'clear'], ['clear sky', 'clear'], ['clear up', 'clear'], ['raining', 'rain'], ['rainy', 'rain'], ['drizzle', 'rain'], ['rain', 'rain'], ['snowing', 'snow'], ['snowy', 'snow'], ['snow', 'snow'], ['foggy', 'fog'], ['misty', 'fog'], ['fog', 'fog'], ['mist', 'fog'], ['sunny', 'clear'], ['sunshine', 'clear'], ['clear', 'clear'], ['cloudy', 'cloudy'], ['overcast', 'cloudy'], ['gloomy', 'cloudy']];
  const EN_LOOKS = [['black and white', 'noir'], ['monochrome', 'noir'], ['noir', 'noir'], ['warmer', 'warm'], ['warm', 'warm'], ['cooler', 'cool'], ['colder', 'cool'], ['cool', 'cool'], ['cold', 'cool'], ['vivid', 'vivid'], ['vibrant', 'vivid'], ['saturated', 'vivid'], ['faded', 'faded'], ['vintage', 'faded'], ['washed out', 'faded'], ['film look', 'faded'], ['filmic', 'faded'], ['dreamy', 'dream'], ['dreamlike', 'dream'], ['no filter', 'none'], ['normal colors', 'none'], ['natural colors', 'none'], ['natural look', 'none'], ['normal look', 'none']];
  function enEnv(s) {
    let t = ' ' + s + ' ', hit = false, m; const env = {};
    const eat = (w) => { const i = t.indexOf(' ' + w + ' '); if (i < 0) return false; t = t.slice(0, i) + ' ' + t.slice(i + w.length + 1); return true; };
    if ((m = t.match(/ (\d{1,2})(?::(\d{2}))? ?(am|pm|a m|p m|oclock|in the morning|in the afternoon|in the evening|at night)(?: (in the morning|in the afternoon|in the evening|at night))? /)) || (m = t.match(/ (\d{1,2}):(\d{2}) /))) {
      let h = +m[1]; const ap = (m[3] || '') + ' ' + (m[4] || ''); if (h <= 24) { if (/pm|p m|afternoon|evening|at night/.test(ap) && h < 12) h += 12; if (/am|a m|morning/.test(ap) && h === 12) h = 0; if (m[2]) h += +m[2] / 60; env.time = h; hit = true; t = t.replace(m[0], ' '); }
    }
    if (/ (?:let|make) time (?:flow|pass|run|move|go)| time (?:flows|passes|lapse)| timelapse | speed up time | fast forward(?: time)? /.test(t)) { env.flow = 3; hit = true; t = t.replace(/ (?:let|make) time (?:flow|pass|run|move|go)| time (?:flows|passes|lapse)| timelapse | speed up time | fast forward(?: time)? /, ' '); }
    else if (/ (?:stop|freeze|pause|hold) (?:the )?time | time (?:stops|stop|freeze|pause) /.test(t)) { env.flow = 0; hit = true; t = t.replace(/ (?:stop|freeze|pause|hold) (?:the )?time | time (?:stops|stop|freeze|pause) /, ' '); }
    if ((m = t.match(/ (?:the )?(?:ground|floor|terrain|land)(?: to| into| with| in| be| is)* (?:be )?(?:covered (?:in|with) )?(grass|grassy|sand|sandy|snow|snowy|dirt|mud|muddy|stone|cobblestone|cobblestones|desert|beach|pavement|rock|rocky) /)) || (m = t.match(/ (grass|grassy|sand|sandy|snow|snowy|dirt|mud|muddy|stone|cobblestone|desert|rocky) (?:ground|floor|terrain) /)) || (m = t.match(/ cover the (?:ground|floor) (?:in|with) (grass|sand|snow|dirt|mud|stone|cobblestones) /))) {
      env.ground = { grass: 'grass', grassy: 'grass', sand: 'sand', sandy: 'sand', desert: 'sand', beach: 'sand', snow: 'snow', snowy: 'snow', dirt: 'dirt', mud: 'dirt', muddy: 'dirt', stone: 'stone', cobblestone: 'stone', cobblestones: 'stone', pavement: 'stone', rock: 'stone', rocky: 'stone' }[m[1]]; hit = true; t = t.replace(m[0], ' ');
    }
    if ((m = t.match(/ (backlit|back lit|backlight|backlighting|front lit|frontlit|side lit|sidelit|side light|sidelight) /))) { env.lightFrom = /^back/.test(m[1]) ? 'front' : /^front/.test(m[1]) ? 'back' : 'left'; hit = true; t = t.replace(m[0], ' '); }
    else if ((m = t.match(/ (?:light|lighting|sun|sunlight)(?: coming)? from (?:the |my )?(left|right|front|back|behind) /))) { env.lightFrom = { left: 'left', right: 'right', front: 'front', back: 'back', behind: 'back' }[m[1]]; hit = true; t = t.replace(m[0], ' '); }
    if ((m = t.match(/ (soft|softer|diffuse|gentle|hard|harsh|harder) (?:light|lighting|shadows) /))) { env.light = /^(?:hard|harsh)/.test(m[1]) ? 'hard' : 'soft'; hit = true; t = t.replace(m[0], ' '); }
    for (const [w, v] of EN_LOOKS) if (eat(w)) { env.look = v; hit = true; break; }
    for (const [w, v] of EN_WEATHER) if (eat(w)) { env.weather = v; hit = true; break; }
    if (env.time == null) for (const [w, v] of EN_TIMES) if (eat(w)) { env.time = v; hit = true; break; }
    if (!hit) return null;
    t = t.replace(/\b(?:make|it|its|is|be|the|a|an|to|set|change|switch|turn|time|weather|sky|skies|look|looks|like|now|at|in|of|day|let|go|have|get|into|there|some|start|begin|starts|i|want|need|with|on|scene|world|everything|bit|little|more|feel|mood|lighting|light|color|colors|colour|grade|tone|tones|style|and|outside|up|down|out|should|would|could|can|we|give|me|us|this|that|for|all|become|becomes|turns|falling|fall|come|comes|filter|effect)\b/g, '').replace(/\s+/g, '');
    return t ? null : [Object.assign({ op: 'env' }, env)];
  }
  const EN_ACT = [['ride a bicycle', 'ride'], ['ride the bicycle', 'ride'], ['riding a bicycle', 'ride'], ['ride a bike', 'ride'], ['ride the bike', 'ride'], ['ride his bike', 'ride'], ['ride her bike', 'ride'], ['riding a bike', 'ride'], ['ride bikes', 'ride'], ['get on a bike', 'ride'], ['get on the bike', 'ride'], ['go cycling', 'ride'], ['cycling', 'ride'], ['cycle', 'ride'], ['ride', 'ride'], ['talk to each other', 'chat'], ['talking to each other', 'chat'], ['jump up and down', 'jump'], ['jumping up and down', 'jump'], ['start walking', 'walk'], ['walk around', 'walk'], ['walking around', 'walk'], ['stand still', 'stop'], ['stop moving', 'stop'], ['stop walking', 'stop'], ['stand up', 'stand'], ['standing up', 'stand'], ['sit down', 'sit'], ['sitting down', 'sit'], ['lie down', 'lie'], ['lay down', 'lie'], ['lying down', 'lie'], ['kneel down', 'kneel'], ['chatting', 'chat'], ['chat', 'chat'], ['talking', 'chat'], ['talk', 'chat'], ['converse', 'chat'], ['laughing', 'laugh'], ['laugh', 'laugh'], ['giggling', 'laugh'], ['giggle', 'laugh'], ['cheering', 'cheer'], ['cheer', 'cheer'], ['celebrate', 'cheer'], ['clapping', 'clap'], ['clap', 'clap'], ['applaud', 'clap'], ['waving', 'wave'], ['wave', 'wave'], ['jumping', 'jump'], ['jump', 'jump'], ['hopping', 'jump'], ['hop', 'jump'], ['dancing', 'dance'], ['dance', 'dance'], ['sitting', 'sit'], ['sit', 'sit'], ['standing', 'stand'], ['stand', 'stand'], ['squatting', 'squat'], ['squat', 'squat'], ['crouching', 'squat'], ['crouch', 'squat'], ['kneeling', 'kneel'], ['kneel', 'kneel'], ['strolling', 'stroll'], ['stroll', 'stroll'], ['wandering', 'walk'], ['wander', 'walk'], ['freeze', 'stop'], ['stop', 'stop']];
  function enAct(s, ph) {
    let t = s.replace(/^(?:make|have|let|get|tell|ask) /, ''), times = null, m;
    if ((m = t.match(new RegExp(' (once|twice|(' + NUMW + ') times|a few times|a couple of times)$')))) { times = m[1] === 'once' ? 1 : m[1] === 'twice' ? 2 : m[2] ? enNum(m[2]) : 3; t = t.slice(0, m.index); }
    t = t.replace(/ (?:together|with each other|to each other|at each other|out loud|loudly|happily|a bit|a little|again|for me)$/, '');
    const acts = []; let rest = t, guard = 0;
    outer: while (rest && guard++ < 8) {
      for (const [w, a] of EN_ACT) for (const f of [w, w + 's']) if (rest === f || rest.endsWith(' ' + f)) { acts.unshift(a); rest = rest.slice(0, rest.length - f.length).trim().replace(/(?:,| and then| and| then| while| or)$/, '').trim(); continue outer; }
      break;
    }
    if (!acts.length) return null;
    const subj = rest.replace(/ (?:to|should|can|could|start|starts|begin|begins|begins to|start to|starts to|are|is|all|both|just|keep|keeps|to start|will|now)$/, '').replace(/ (?:to|should|all|both|are|is)$/, '').trim();
    const isC = (o) => !!o && (YX.defOf(o) || {}).cls === 'creature', ids = (l) => (l.length === 1 ? '#' + l[0].id : l.map((o) => '#' + o.id)), g = YX.groupNow(true).filter(isC), aim = W.objs.get(ph.view.aimId), foc = W.objs.get(ph.view.focusId);
    let id;
    if (!subj) { if (acts.every((a) => a === 'stop' || a === 'walk')) return null; if (g.length > 1 && (!isC(aim) || g.includes(aim))) id = ids(g); else if (isC(aim)) id = '#' + aim.id; else if (isC(foc)) id = '#' + foc.id; else if (g.length) id = ids(g); else return null; }
    else { const sp = enSpec(subj); if (sp === false) return null; if (sp && sp.group) { if (!g.length) return null; id = ids(g); } else { const o = resolveTarget(sp, ph); if (!isC(o)) return null; id = '#' + o.id; } }
    const op = { op: 'act', id, activity: acts.filter((a, i) => acts.indexOf(a) === i).join(',') }; if (times) op.times = times;
    return [op];
  }
  function enOther(clause, ph) {
    const s = enNorm(clause); if (!s) return []; let m, r, sp;
    if (/^(?:make it |switch to |turn (?:it )?to |set (?:it )?to |change (?:it )?to )?(?:day|daylight|broad daylight|day ?time)$/.test(s)) return [{ op: 'env', time: 12 }];
    { const g = /^(?:turn off|switch off|remove|no|zero) (?:the )?gravity$|^gravity off$/.test(s) ? 0 : /^(?:low|moon|lunar|weak) gravity$/.test(s) ? 0.17 : /^(?:normal|earth|regular) gravity$|^(?:turn|switch|bring) (?:the )?gravity (?:back )?on$|^(?:bring|turn) (?:the )?gravity back(?: on)?$|^gravity (?:on|back on|back)$/.test(s) ? 1 : /^(?:heavy|strong|double) gravity$/.test(s) ? 2 : null; if (g != null) return [{ op: 'env', gravity: g }]; } // a rule of the world, said like the weather
    if (/^(?:undo|undo that|undo it|undo the last one|go back|revert|revert that|take that back|cancel that|never mind|nevermind|scratch that|oops|no undo|undo please)$/.test(s)) return [{ op: 'undo' }];
    if (/^(?:clay|clay mode|clay view|whitebox|white box|whitebox mode|switch to clay(?: mode)?|turn on clay(?: mode)?|clay(?: mode)? on|enable clay(?: mode)?|show (?:me )?(?:the )?clay|go clay)$/.test(s)) return [{ op: 'clay', on: true }];
    if (/^(?:clay(?: mode)? off|turn off clay(?: mode)?|exit clay(?: mode)?|disable clay(?: mode)?|leave clay(?: mode)?|back to colou?r|show (?:the )?(?:colou?rs|materials|textures)|restore (?:the )?(?:colou?rs|materials)|colou?r mode|no clay|full colou?r)$/.test(s)) return [{ op: 'clay', on: false }];
    if (/^(?:save|store|keep|remember|mark|bookmark|lock|capture|take|grab)(?: (?:this|that|the|a|current|as a))* (?:shot|camera|camera position|camera angle|angle|view|framing|frame|setup)$|^save$|^save it$|^(?:new|add a|add) shot$/.test(s)) return [{ op: 'shot', save: true }];
    if ((m = s.match(new RegExp('^(?:go to|cut to|switch to|jump to|show|show me|back to)? ?(?:shot|camera|angle|view) (?:number )?(' + NUMW + ')$'))) || (m = s.match(/^(?:go to |cut to |switch to |show me )?(?:the )?(first|second|third|fourth|fifth|sixth) (?:shot|camera|angle)$/))) { const n = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6 }[m[1]] || enNum(m[1]); if (isFinite(n)) return [{ op: 'shot', go: n }]; }
    if (/^(?:play|playback|play back|preview|run|roll|play it|roll it|action)(?: (?:the|all|my|all the))* ?(?:shots|sequence|preview|cameras|them|film|scene|back|it)?$/.test(s)) return [{ op: 'shot', play: true }];
    // words that only ever stop a take never start one (a late "cut" after the cameras stopped by themselves must not begin a new recording)
    if (/^(?:stop recording|end take|end the take|stop the take|cut)$/.test(s)) return [{ op: 'shot', record: 'stop' }];
    if (/^(?:start recording|record a take|record handheld|handheld take|start a take|record a handheld (?:take|shot))$/.test(s)) return [{ op: 'shot', record: 'start' }];
    if (/^(?:record|recording)$/.test(s)) return [{ op: 'shot', record: true }];
    if ((m = s.match(/^(?:switch to |change to |use |go |set (?:the )?lens to |put on |give me )?(?:an? |the )?(\d{2,3}) ?(?:mm|millimeters?|millimetres?|mil)(?: lens)?$/))) return [{ op: 'cam', lens: +m[1] }];
    if ((m = s.match(/^(?:switch to |change to |use |go |give me )?(?:an? |the )?(ultra wide|ultrawide|wide angle|wide|standard|normal|portrait|telephoto|long|tele) (?:lens|angle|shot)$/))) return [{ op: 'cam', lens: { 'ultra wide': 16, ultrawide: 16, 'wide angle': 24, wide: 24, standard: 50, normal: 50, portrait: 85, long: 85, telephoto: 135, tele: 135 }[m[1]] }];
    if (/^(?:free|default|no) (?:view|lens|camera)$|^reset (?:the )?lens$|^normal view$/.test(s)) return [{ op: 'cam', lens: 0 }];
    if (/^(?:birds eye(?: view)?|bird eye view|overview|aerial(?: view| shot)?|top(?: down)?(?: view)?|map view|show me (?:the )?(?:whole|entire) (?:town|scene|world|thing|map|place)|zoom (?:all the way |way )?out|gods eye(?: view)?|drone (?:view|shot)|from above)$/.test(s)) return [{ op: 'cam', move: 'overview' }];
    if (/^(?:back to (?:the )?ground|land|come (?:back )?down|ground level|return to (?:the )?ground|reset (?:the )?camera|eye level|back down|put me down)$/.test(s)) return [{ op: 'cam', move: 'reset' }];
    if ((m = s.match(/^(?:push in|dolly in|move in|zoom in|close ?up|get closer|go closer|push)(?: (?:on|to|toward|towards|into) (.+))?$/))) { sp = m[1] ? enSpec(m[1]) : null; if (sp !== false) { const id = m[1] ? tid(sp, ph) : null; return [Object.assign({ op: 'cam', move: 'push' }, id && id !== 'them' ? { target: id } : {})]; } }
    if (/^(?:pull out|pull back|dolly out|dolly back|zoom out|back up|move back|go wider|pull)$/.test(s)) return [{ op: 'cam', move: 'pull' }];
    if ((m = s.match(/^(?:do an? |do a full |give me an? )?(?:orbit|circle|arc|360|go around|fly around|move around|spin around|rotate around|pan around|orbit shot|orbit around|circle around)(?: (?:shot|the camera))?(?: (?:around|round|of|on))? ?(.*?)( halfway| half way| once| 180| 360| slowly)?$/))) { sp = m[1] ? enSpec(m[1]) : null; if (sp !== false) { const id = m[1] ? tid(sp, ph) : (W.objs.get(ph.view.aimId) || W.objs.get(ph.view.focusId) || {}).id; if (id || !m[1]) return [Object.assign({ op: 'cam', move: 'orbit', deg: /half|180/.test(m[2] || '') ? 180 : 360 }, id ? { target: typeof id === 'number' ? '#' + id : id } : {})]; } }
    if ((m = s.match(/^(?:follow|track|tracking shot (?:on|of)|chase|stay with|keep up with|tail|follow shot (?:on|of)) (.+)$/))) { sp = enSpec(m[1]); if (sp !== false) { const id = tid(sp, ph); if (id && id !== 'them') return [{ op: 'cam', move: 'follow', target: id }]; } }
    if (/^(?:crane up|rise up|go up|camera up|raise the camera|boom up|jib up|fly up|move up|ascend|rise)$/.test(s)) return [{ op: 'cam', move: 'crane', amount: 7 }];
    if (/^(?:crane down|go down|camera down|lower the camera|boom down|jib down|descend|fly down|move down)$/.test(s)) return [{ op: 'cam', move: 'crane', amount: -5 }];
    if ((m = s.match(/^(?:truck|track|slide|strafe|move the camera|camera|dolly)(?: to the)? (left|right)$/))) return [{ op: 'cam', move: 'truck', amount: m[1] === 'left' ? -6 : 6 }];
    if ((m = s.match(/^pan (?:to the )?(left|right)$|^look (?:to the )?(left|right)$/))) return [{ op: 'cam', move: 'pan', deg: (m[1] || m[2]) === 'left' ? -45 : 45 }];
    if ((m = s.match(/^tilt (up|down)$|^look (up|down)$/))) return [{ op: 'cam', move: 'tilt', deg: (m[1] || m[2]) === 'up' ? 20 : -20 }];
    if ((m = s.match(new RegExp('^(add|remove|take off|take away|delete) (' + NUMW + '|another|a few)? ?(?:more |extra )?(?:floors?|stor(?:y|ey|ies|eys)|levels?)(?: (?:to|on|on to|onto|from|off|of) (.+))?$')))) { sp = m[3] ? enSpec(m[3]) : { demo: true, noun: { generic: '建筑' } }; if (sp !== false) { const id = tid(sp, ph), n = m[2] === 'a few' ? 3 : m[2] && m[2] !== 'another' ? enNum(m[2]) : 1; if (id && isFinite(n)) return [{ op: 'set', id, params: { floors: (m[1] === 'add' ? '+' : '-') + Math.round(n) } }]; } }
    if ((r = enEnv(s))) return r;
    if ((m = s.match(/^(?:take me to|bring me to|go to|teleport(?: me)? to|walk me to|fly me to|go see|show me|head to|travel to|jump to|move me to|i want to go to|go over to|take me over to) (.+?)$/))) { sp = enSpec(m[1]); if (sp) { const id = tid(sp, ph); if (id && id !== 'them') return [{ op: 'goto', id }]; } }
    if ((m = s.match(/^(?:put|get|sit|set|place|seat) (.+?) on (?:a|the|his|her|their|that|this|its) (?:bike|bicycle)$/))) { sp = enSpec(m[1]); if (sp !== false) { const o = sp && sp.group ? null : resolveTarget(sp, ph); if (o && o.type === 'person') return [{ op: 'act', id: '#' + o.id, activity: 'ride' }]; } }
    if ((m = s.match(/^(?:make |have |let |get |tell |ask )?(.+?) (?:to )?(?:follow|follows|walk with|walks with|go with|goes with|stay with|stays with|accompany|accompanies|hold hands with|holds hands with|walk beside|walks beside|walk next to|walks next to|tag along with|stick with|sticks with) (.+)$/)) || (m = s.match(/^(?:make |have |let |get |tell |ask )?(.+?) (?:to )?holds? (.+?) hands?$/))) {
      const isC = (o) => !!o && (YX.defOf(o) || {}).cls === 'creature', sa = enSpec(m[1]), sb = enSpec({ his: 'him', her: 'her', their: 'them', its: 'it' }[m[2]] || m[2]);
      if (sa !== false && sb !== false && sb && !sb.group) { const a = sa && sa.group ? null : resolveTarget(sa, ph); let b2 = resolveTarget(sb, ph);
        if (a && b2 === a) { const g = YX.groupNow(true).filter((o) => isC(o) && o !== a); let bd = 1e9; b2 = null; for (const o of W.objs.values()) if (o !== a && isC(o) && (!sb.noun || !sb.noun.type || o.type === sb.noun.type) && (!sb.noun || !sb.noun.params || Object.keys(sb.noun.params).every((k) => String(o.params[k]) === String(sb.noun.params[k])))) { const d = Math.hypot(o.x - a.x, o.z - a.z) - (g.includes(o) ? 1000 : 0); if (d < bd) { bd = d; b2 = o; } } }
        if (isC(b2) && (sa && sa.group ? true : isC(a) && a !== b2)) return [{ op: 'follow', id: sa && sa.group ? 'them' : '#' + a.id, target: '#' + b2.id }]; }
    }
    if ((r = enAct(s, ph))) return r;
    if ((r = enAdd(clause, ph))) return r;
    if ((m = s.match(/^(?:remove|delete|erase|destroy|demolish|clear away|get rid of|take away|take out|lose|ditch|trash|scrap|knock down|tear down|cut down|chop down|bulldoze) (.+)$/))) { sp = enSpec(m[1]); if (sp !== false) { const id = tid(sp, ph); if (id) return [{ op: 'remove', id }]; } }
    if ((m = s.match(/^(?:take|get|clear|throw|move) (.+) (?:away|out|out of here|out of the way)$/)) && !/^(?:take|move) .+ (?:further|farther) away$/.test(s)) { sp = enSpec(m[1]); if (sp !== false && sp !== null) { const id = tid(sp, ph); if (id && m[0].indexOf('move ') !== 0) return [{ op: 'remove', id }]; } }
    // colour
    if ((m = s.match(/^(?:make|paint|colou?r|turn|change|dye|set|recolou?r) (.+?) (?:to |into |in |be )?([a-z]+(?: [a-z]+)?)$/)) || (m = s.match(/^(.+?) (?:should be|to be|in|is now) ([a-z]+(?: [a-z]+)?)$/))) {
      let c = enColor(m[2]), tstr = m[1]; if (!c) { const one = m[2].split(' '); if (one.length === 2 && enColor(one[1])) { c = enColor(one[1]); tstr = m[1] + ' ' + one[0]; } }
      if (c) { tstr = tstr.replace(/^the colou?r of /, '').replace(/ ?colou?r$/, '').replace(/ (?:to|into|in|be)$/, ''); sp = enSpec(tstr); if (sp !== false) { const id = tid(sp, ph); if (id) return [{ op: 'set', id, params: { color: c } }]; } }
    }
    // become: "turn it into a double decker bus"
    if ((m = s.match(/^(?:turn|change|make|convert|transform|morph|swap|upgrade|switch|replace|rebuild|remake) (.+?) (?:into|in to|to|with|for|as|to be) (?:a |an |the |some |one )?(.+)$/)) || (m = s.match(/^make (it|this|that|them|the .+?|this .+?|that .+?) (?:a|an) (.+)$/))) {
      sp = enSpec(m[1]); const n = enNoun(m[2]);
      if (sp !== false && n && n.type && !(sp && sp.group)) { const o = resolveTarget(sp, ph); if (o) { if (o.type === n.type) { if (n.params) return [{ op: 'set', id: '#' + o.id, params: n.params }]; } else return [Object.assign({ op: 'become', id: '#' + o.id, type: n.type }, n.params ? { params: n.params } : {})]; } }
    }
    // rotate / face
    if ((m = s.match(/^(?:make |have |turn |rotate )?(.*?) ?(?:to )?(?:face|facing|look at|looking at|point at|towards?|turn to(?:wards?)?) (me|the camera|us|away|the other way|the road|the street)$/))) { sp = enSpec(m[1]); if (sp !== false) { const id = tid(sp, ph); if (id) return [{ op: 'rotate', id, face: /road|street/.test(m[2]) ? 'road' : /away|other/.test(m[2]) ? 'away' : 'me' }]; } }
    if ((m = s.match(/^(?:rotate|turn|spin|flip) (.+?)(?: (?:by )?(\d+)(?: degrees?)?)?(?: (?:to the |to my )?(left|right|clockwise|counter ?clockwise|anticlockwise|around|round|over|a bit|a little))?$/))) { sp = enSpec(m[1]); if (sp !== false && sp !== null) { const id = tid(sp, ph); if (id) { let deg = m[2] ? +m[2] : /around|round|over/.test(m[3] || '') ? 180 : /bit|little/.test(m[3] || '') ? 30 : 90; if (/left|counter|anti/.test(m[3] || '')) deg = -deg; return [{ op: 'rotate', id, deg }]; } } }
    // move by direction
    { const UNIT = '(?:m|meters?|metres?|feet|foot|ft|steps?|yards?)', AMT = '(?:a (?:little |tiny )?bit|a little|slightly|a touch|a lot|way|far|much|(?:' + NUMW + ') ?' + UNIT + ')';
      const dm = s.match(new RegExp('^(?:move|shift|slide|push|pull|nudge|scoot|bring|drag|take|put|raise|lift|lower|drop) (.+?) (' + AMT + ' )?(?:to the |to my |toward the |towards the |further |farther |more to the |over to the )?(left|right|forward|forwards|back|backward|backwards|up|down|closer|nearer|away|further|farther|toward me|towards me|away from me|closer to me|higher|lower)( ' + AMT + '| by (?:' + NUMW + ') ?' + UNIT + ')?$'));
      if (dm) { sp = enSpec(dm[1]); if (sp !== false) { const id = tid(sp, ph); if (id) {
        const am = ((dm[2] || '') + ' ' + (dm[4] || '')).trim(), nm = am.match(new RegExp('(' + NUMW + ') ?(' + UNIT + ')')); let a = 1.5; const d = dm[3];
        if (nm) { a = enNum(nm[1]); if (/feet|foot|ft/.test(nm[2])) a *= 0.3; else if (/step/.test(nm[2])) a *= 0.7; else if (/yard/.test(nm[2])) a *= 0.9; } else if (/tiny|touch|slightly/.test(am)) a = 0.5; else if (/bit|little/.test(am)) a = 1; else if (/lot|way|far|much/.test(am)) a = 6;
        if (!isFinite(a)) a = 1.5;
        const by = d === 'left' ? { right: -a } : d === 'right' ? { right: a } : /^(?:up|higher)$/.test(d) ? { up: a } : /^(?:down|lower)$/.test(d) ? { up: -a } : /^(?:forward|forwards|closer|nearer|toward me|towards me|closer to me)$/.test(d) ? { forward: -a } : { forward: a };
        return [{ op: 'move', id, by }]; } } } }
    // move / walk to a place
    if ((m = s.replace(/ to (walk|run|go|move|drive|come|head|jog|stroll|sit|stand) /, ' $1 ').match(/^(move|put|place|set|drive|park|bring|take|send|drag|carry|drop|relocate|position|stick|get|pull|push|walk|run|march|teleport|have|make|let|tell|ask) (.+?) (?:(walk|run|go|move|drive|come|head|jog|stroll|sit|stand) )?((?:back |over |up |down |out |right )?(?:onto|on to|on top of|on|to|into|in front of|inside|in|at|by|beside|next to|near|across|behind|over|above|under|between|outside|around|along|toward|towards|here|there)\b.*)$/))) {
      const verb = m[3] || m[1]; sp = enSpec(m[2]);
      { const ind = m[2].match(/^(a|an|another|one|two|three|four|five|some|a few|a couple of) (.+)$/), n0 = ind ? enNoun(ind[2]) : null; // an indefinite someone is a new one, placed there, not whoever stands nearest
        if (n0 && n0.type && (/^(?:sit|stand)$/.test(verb) || /^(?:put|place|set|seat)$/.test(m[1]))) { const pl0 = enPlace(m[4], ph); if (pl0 && pl0.place !== undefined) return [{ op: 'add', type: n0.type, params: Object.assign({}, n0.params || {}, G[n0.type].params && G[n0.type].params.pose && /^(?:sit|stand)$/.test(verb) ? { pose: verb } : {}), count: { two: 2, three: 3, four: 4, five: 5, some: 3, 'a few': 3, 'a couple of': 2 }[ind[1]] || 1, place: pl0.place }]; } }
      if (sp !== false && !(/^(?:have|make|let|tell|ask)$/.test(m[1]) && !m[3])) { const id = tid(sp, ph), pl = enPlace(m[4], ph);
        if (id && pl && pl.place !== undefined) { const o = id === 'them' ? YX.groupNow(true)[0] : W.objs.get(+id.slice(1)), walker = o && (YX.defOf(o) || {}).cls === 'creature' && o.motion !== 'fly' && /^(?:walk|run|march|go|come|head|jog|stroll|sit|stand)$/.test(verb);
          if (walker) return [Object.assign({ op: 'walk', id, to: pl.place }, /run|jog/.test(verb) ? { run: true } : {}, verb === 'sit' ? { pose: 'sit' } : {})];
          if (!/^(?:walk|run|march|go|come|head|jog|stroll|sit|stand)$/.test(verb)) return [{ op: 'move', id, place: pl.place }]; } }
    }
    return null;
  }

  function incOps(r, ph, prev) { // resize clause → flat resize ops with a resolved target; prev = the last op of this same sentence
    if (r.kind === 'repeat') { if (prev) return [Object.assign({}, prev)]; const L = M.lastRep; return L && L.kind === 'resize' ? L.ops.map((o) => Object.assign({}, o)) : null; } // "more" after a resize; after anything else see parseRepeat
    let id; if (r.target && r.target.group) id = 'them'; else if (!r.target && prev) id = prev.id; else if (!r.target && ph.bulk) id = ph.bulk; else if (!r.target && M.lastBulk && YX.groupNow(false).length > 1) id = 'them'; else { const o = resolveTarget(r.target, ph); if (!o) return null; id = '#' + o.id; }
    return r.ops.map((x) => ({ op: 'resize', id, dim: x.dim, factor: x.factor }));
  }
  /* ---------- camera moves in plain words: "围绕这个房子环绕拍一段", "dolly down the street and record it" ---------- */
  const CAM_ZH = [[/环绕|围绕|绕着|围着|转一圈|绕一圈/, 'orbit'], [/平推|推轨|沿着?(?:这条|那条|整条)?(?:街道?|马路|大街|路)/, 'street'], [/拉升|揭示/, 'reveal'], [/飞越|航拍|无人机|鸟瞰|俯瞰/, 'flyover'], [/跟拍|跟随拍|跟着.*拍/, 'follow'], [/推近|推进|推上去|推镜|向前推|往前推|推向/, 'push'], [/拉远|拉开|后拉|拉镜|往后拉/, 'pull'], [/降下|下降|降低/, 'craneDown'], [/升起|升高|上升|摇臂/, 'crane'], [/横移|平移|侧移/, 'truck'], [/摇镜|摇摄/, 'pan']];
  const CAM_EN = [[/\b(?:orbit|circle|arc|go around|fly around|spin around|move around|rotate around|360)\b/, 'orbit'], [/\b(?:dolly|track|travel|glide|move|push|drive)\b.*\b(?:down|along|up|through)\b.*\b(?:street|road|avenue)\b|\balong the (?:street|road)\b|\bstreet track\b/, 'street'], [/\breveal\b/, 'reveal'], [/\b(?:fly ?over|drone|aerial|bird'?s[- ]eye)\b/, 'flyover'], [/\b(?:follow|chase|track)\b/, 'follow'], [/\b(?:push in|dolly in|move in|close in|zoom in)\b/, 'push'], [/\b(?:pull out|pull back|dolly out|dolly back|zoom out)\b/, 'pull'], [/\b(?:crane down|boom down|descend)\b/, 'craneDown'], [/\b(?:crane up|boom up|jib up|rise)\b/, 'crane'], [/\btruck\b|\bslide (?:left|right)\b/, 'truck'], [/\bpan\b/, 'pan']];
  const ZH_N = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  function parseFilm(clause, ph) {
    const s = strip(clause); if (!s) return null; const en = isEN(s), t = en ? enNorm(clause) : s;
    const REC = en ? /\b(?:record|film|shoot|capture)\b/ : /拍一段|录一段|拍下来|录下来|拍成|录成|录制|拍摄|出片|拍个|录个|拍一个|录一个/;
    // three cameras on one moment: set them up, roll, cut, take them down
    { const rg = YX.rig, tgt = (w) => { if (!w || /^(?:this|that|it|here|there|this one|that one|这个|那个|它|这里|那里)$/.test(w)) return null; const sp = en ? enSpec(w) : parseTargetWhole(w); const o = sp ? resolveTarget(sp, ph) : null; return o ? '#' + o.id : null; }; let m;
      // a camera of the player's own: it stands where they stand and films what they see ("put a camera here", "move camera B here", 在这里放一个机位)
      if (rg) { const HERE = '(?:right )?(?:here|there|at this spot|on this spot|where i am|where i stand|where im standing|in here|inside here|out here)';
        if (en ? (m = t.match(new RegExp('^(?:please )?(?:put|place|set up|setup|set|add|leave|drop|park|plant|mount|stand|i want|give me|keep) (?:a|an|another|one|one more|the|a second|a third|the next|my|the first|the second|the third|a fixed|a static) (?:fixed |static |still |second |third |other )?(?:camera|cam)(?: ([abc]))? ' + HERE + '$'))) || (m = t.match(new RegExp('^(?:please )?(?:put|place|set|move|bring|stand|leave) (?:camera|cam) ([abc]) ' + HERE + '$'))) || (m = t.match(new RegExp('^(?:another |one more |a |fixed |static )?(?:camera|cam)(?: ([abc]))? ' + HERE + '$')))
          : (m = t.match(/^(?:就)?(?:在)?(?:这里|这儿|这边|此处|我这里|我这儿|这个位置)(?:也|再|就)?(?:架|放|摆|加|安|装|设|立)(?:上|一|个|台)*([abc])?(?:号)?(?:机位|摄像机|相机|固定机位)$/i)) || (m = t.match(/^(?:再|也)?(?:架|放|摆|加|安|设|立)(?:上|一|个|台)*([abc])?(?:号)?(?:固定)?(?:机位|摄像机|相机)(?:放|架)?(?:在|到)?(?:这里|这儿|这边|这|这个位置)$/i)) || (m = t.match(/^(?:把)?([abc])\s*(?:号)?(?:机位|号机|摄像机|相机)?(?:放|挪|移|搬|架)(?:到|在)?(?:这里|这儿|这边|这)$/i)) || (m = t.match(/^(?:把)?(?:机位|摄像机|相机)\s*([abc])\s*(?:放|挪|移|搬|架)(?:到|在)?(?:这里|这儿|这边|这)$/i))) { const op = { op: 'rig', here: true }; if (m[1]) op.key = m[1].toUpperCase(); return [op]; }
        if ((m = en ? t.match(/^(?:take down|remove|delete|drop|get rid of|clear) (?:camera|cam) ([abc])$/) : t.match(/^(?:撤掉|去掉|拆掉|删掉|拿掉|收起)\s*([abc])\s*(?:号)?(?:机位|摄像机|相机|号机)$/i) || t.match(/^(?:撤掉|去掉|拆掉|删掉|拿掉|收起)(?:机位|摄像机|相机)\s*([abc])$/i))) return [{ op: 'rig', drop: m[1].toUpperCase() }]; }
      if (rg && rg.rec && (en ? /^(?:cut|stop|stop recording|stop rolling|thats a wrap|that is a wrap|done)$/.test(t) : /^(?:咔|停|停下|停止|停止录制|好了|收工)$/.test(t))) return [{ op: 'rig', cut: true }];
      if (en ? /^(?:take down|remove|clear|drop|put away|get rid of) (?:the |all )?(?:three )?(?:cameras|cams|camera rig|rig)$/.test(t) : /^(?:撤掉|收起|拆掉|去掉|撤)(?:三个)?(?:机位|摄像机|相机)$/.test(t)) return [{ op: 'rig', off: true }];
      if (en ? (m = t.match(/^(?:film|shoot|cover|record|capture) (.+?) (?:with|from|on|using) (?:three|3|multiple|several) (?:cameras|angles|cams)$/)) || (m = t.match(/^(?:set up|setup|place|put up|put|add|give me|use) (?:three|3) (?:cameras|cams|angles)(?: (?:on|around|for|at|pointed at|pointing at) (.+))?$/)) || (m = t.match(/^(?:multi ?cam|three cameras|3 cameras|three angles)(?: (?:on|around|for|at) (.+))?$/))
        : (m = t.match(/^(?:用)?(?:三|3)个?(?:机位|摄像机|相机|角度)(?:同时)?(?:拍|来拍|拍摄)?(.*)$/)) || (m = t.match(/^多机位(?:拍|拍摄)?(.*)$/)) || (m = t.match(/^(?:给|在|对着)?(.+?)(?:架|放|摆|架上|放上)(?:三|3)(?:个|台)?(?:机位|摄像机|相机)$/))) {
        const w = (m[1] || '').trim(), op = { op: 'rig' }, id = tgt(w); if (id) op.target = id; else if (w && !/^(?:this|that|it|here|there|this one|that one|这个|那个|它|这里|那里)$/.test(w)) return [{ op: 'say', text: T('视野里没有看到' + (ph.miss || w) + '。看向它再说一次。', 'I can’t see ' + (ph.miss ? 'a ' + String(ph.miss).toLowerCase() : w) + ' from here. Look at it and say that again.') }]; return [op]; } } // a subject named but not in sight is answered ("I can't see a bus"), not swapped for whatever the crosshair is on
    if (YX.filmLive && YX.filmLive() && (en ? /^(?:stop recording|stop|cut|end recording|finish recording|done|thats a wrap|that is a wrap)$/.test(t) : /^(?:停止?录制?|停止?拍摄?|停|停下|好了|可以了|结束录制|别录了|不录了|咔)$/.test(t))) return [{ op: 'cam', stop: true }];
    if (en ? /^(?:start recording|begin recording|record|record this|record now|record what i see|start filming|roll camera|action)$/.test(t) : /^(?:开始录制?|开始拍摄?|开拍|录像|录屏|开始录像|录我看到的)$/.test(t)) return [{ op: 'cam', rec: true, live: true }];
    if (en ? /^(?:record|film|shoot|capture) (?:it|that|this|the (?:shot|move))(?: again)?$/.test(t) : /^(?:把(?:它|这个|这段|刚才的)?)?(?:录下来|拍下来|录制|拍一段|录一段|拍成片子?|录成片子?)$/.test(t)) return [{ op: 'cam', rec: true }];
    let move = null; for (const [re, m] of en ? CAM_EN : CAM_ZH) if (re.test(t)) { move = m; break; }
    if (!move) { // not one of the classic moves, but plainly a request for a shot: the director designs it from the player's own words
      const shot = en ? /\b(?:camera|shot|drone|dolly|crane|tracking|fly ?through|cinematic|timelapse|close ?up|wide shot|establishing)\b/.test(t) && /\b(?:move|push|pull|pan|tilt|track|fly|rise|descend|sweep|circle|reveal|glide|start|end|go|give|do|make|shoot|film|from|to|through|over|around|past)\b/.test(t) : /镜头|运镜|航拍|特写|全景|长镜头|电影感|一镜到底/.test(t) && /推|拉|摇|移|升|降|绕|飞|跟|穿|掠|扫|俯|仰|从|到|来个|来一个|给|拍|做|设计/.test(t);
      if (!shot || !M.sample || (en ? /\b(?:save|lens|mm)\b/.test(t) : /保存|存为|存个|毫米|焦段|画幅|机位\s*\d|第.+个机位/.test(t))) return null;
      const aim0 = ph.view.aimId != null ? W.objs.get(ph.view.aimId) : null, op0 = { op: 'cam', design: clause.trim() }; if (aim0) op0.target = '#' + aim0.id; if (REC.test(t)) op0.rec = true; return [op0];
    }
    const rec = REC.test(t), camWord = en ? /\b(?:camera|shot|dolly|tracking|move)\b/.test(t) : /镜头|运镜|机位/.test(t);
    if (!rec && !camWord && !['orbit', 'street', 'flyover', 'reveal'].includes(move)) return null; // plain "push in" and the like keep their existing rules
    // without a camera word, the move has to be what the sentence does, not something inside a sentence about things: "circle the fountain" flies, "rearrange them in a circle" and "a row of houses along the road" do not
    if (!rec && !camWord) { if (en) { const t1 = t.replace(/^(?:(?:please|now|then|and|slowly|gently|quickly|lets|let us|can you|could you|i want to|i want an?|give me an?|do an?|take an?) )+/, '');
        if (!/^(?:orbit|circle|arc|go around|fly around|spin around|rotate around|move around|360|fly ?over|drone|aerial|birds?[- ]eye|reveal|(?:dolly|track|travel|glide|move|push|drive) (?:(?:slowly|gently|quickly|straight|all the way) )?(?:down|along|up|through))\b/.test(t1)) return null; }
      else if (/把|将|排|摆|挪|搬|改|换|删|拆|围成|站成|坐成/.test(t)) return null; }
    if (!rec && !camWord && (en ? /^(?:make|have|let|tell|add|put|place|plant|build|create)\b/.test(t) : /^(?:让|叫|请)|放|加|种|摆|造|建|添|来(?:一|两|几|些)/.test(t))) return null; // "plant flowers around the fountain" is not a camera move
    let tg = null; const aim = ph.view.aimId != null ? W.objs.get(ph.view.aimId) : null;
    if (en) { const w = t.split(' '); for (let i = 0; i < w.length && !tg; i++) for (let n = Math.min(3, w.length - i); n >= 1 && !tg; n--) { const ph2 = w.slice(i, i + n).join(' '); if (/^(?:street|road|avenue|camera|shot|move|it|this|that|the|a|an|around|orbit|circle|arc|track|follow|record|film)$/.test(ph2)) continue; const kd = YX.kindOf(ph2); if (kd && kd.type) tg = aim && aim.type === kd.type ? aim : YX.nearestOfType(kd.type, ph.view, null); } }
    else for (let i = 0; i < t.length && !tg; i++) { const n = eatNoun(t.slice(i)); if (n && n.type && !/^(?:road)$/.test(n.type)) tg = aim && aim.type === n.type ? aim : resolveTarget({ noun: n }, ph); }
    if (!tg && move !== 'street' && move !== 'flyover') tg = aim;
    if (move === 'follow' && !tg) return null;
    const op = { op: 'cam', move: move === 'craneDown' ? 'crane' : move, design: clause.trim() }; if (tg) op.target = '#' + tg.id; if (rec) op.rec = true; if (move === 'craneDown') op.amount = -5;
    let m = en ? t.match(/(\d+(?:\.\d+)?) ?(?:s|sec|secs|seconds?)\b/) : t.match(/(\d+(?:\.\d+)?|[一二两三四五六七八九十])\s*秒/); if (m) op.dur = ZH_N[m[1]] || parseFloat(m[1]);
    else if (en ? /\b(?:slow|slowly)\b/.test(t) : /慢慢|缓慢|缓缓/.test(t)) op.dur = 10; else if (en ? /\b(?:quick|quickly|fast)\b/.test(t) : /快速|很快|快一点/.test(t)) op.dur = 5;
    if (move === 'orbit') { if (en ? /\b(?:360|full circle|all the way)\b/.test(t) : /一圈|一周|整圈|360/.test(t)) op.deg = 360; else if (en ? /\bhalf\b/.test(t) : /半圈/.test(t)) op.deg = 180; else if ((m = en ? t.match(/(\d+) ?(?:deg|degrees?)\b/) : t.match(/(\d+)\s*度/))) op.deg = +m[1]; }
    if ((move === 'truck' || move === 'pan') && (en ? /\bleft\b/.test(t) : /向?左/.test(t))) { if (move === 'truck') op.amount = -6; else op.deg = -45; }
    return [op];
  }
  /* things that stand on a road and should not: remove them, or move them onto free ground */
  function parseOnRoad(clause) {
    const s = strip(clause), kind = (w) => { w = String(w || '').trim(); if (!w) return null; if (YX.kindOf(w)) return w; const last = w.split(' ').pop(); if (last !== w && YX.kindOf(last)) return last; const zn = w.replace(/^(?:那些|这些|那几个|这几个|几个|那个|这个|高|大|小|新|多余的?)+/, ''); return zn && YX.kindOf(zn) ? zn : null; };
    const RM = '删掉|删除|删了|移除|去掉|拆掉|拆了|拆除|清掉|清除|清理掉|清走|弄走|拿走|移走|搬走|挪走|干掉|不要了?', MV = '挪开|移开|搬开|让开|挪到路边|移到路边|搬到路边|挪到空地上?|移到空地上?|挪到旁边|移到旁边';
    let m = s.match(new RegExp('^(?:把|将)?(?:所有|全部)?(?:那些|这些)?(?:(?:挡|占|压|堵|建|盖|站|停|立|摆|放|长)在了?|在)?(?:马路|公路|道路|街道|路面|路|街)(?:上面?|中间|中央|当中)的(.+?)(?:都|全都|全部|统统)?(?:给我)?(' + RM + '|' + MV + ')$')) || s.match(new RegExp('^(?:把|将)?(?:所有|全部)?(?:那些|这些)?(?:挡路|占路|占道|挡道|堵路)的(.+?)(?:都|全都|全部|统统)?(?:给我)?(' + RM + '|' + MV + ')$'));
    if (m) { const k = kind(m[1]); if (!k) return null; const sel = { type: k, on: 'road' }; return new RegExp('^(?:' + MV + ')$').test(m[2]) ? [{ op: 'move', id: sel, place: { clear: true } }] : [{ op: 'remove', id: sel }]; }
    const t = s.toLowerCase();
    m = t.match(/^(?:please )?(?:remove|delete|clear away|clear|get rid of|demolish|take away|take out) (?:all |any |every |each )?(?:of )?(?:the |those |these )?(.+?) (?:that |which )?(?:are |is )?(?:standing |sitting |built |placed |stuck )?(?:on|in|blocking|occupying|occupy|occupies|block|blocks|in the middle of|in the way on) the (?:roads?|streets?)$/);
    if (m) { const k = kind(m[1]); return k ? [{ op: 'remove', id: { type: k, on: 'road' } }] : null; }
    m = t.match(/^(?:please )?(?:move|get|take|push|shift) (?:all |any |every )?(?:of )?(?:the |those |these )?(.+?) (?:off|out of|away from|off of) the (?:roads?|streets?)$/) || t.match(/^(?:please )?(?:move|shift) (?:all |any |every )?(?:of )?(?:the |those |these )?(.+?) (?:that |which )?(?:are |is )?(?:standing |sitting )?(?:on|blocking|occupying) the (?:roads?|streets?) (?:away|aside|out of the way|off it|to the side|to free ground)$/);
    if (m) { const k = kind(m[1]); return k ? [{ op: 'move', id: { type: k, on: 'road' }, place: { clear: true } }] : null; }
    return null;
  }
  /* said indoors, "房间里的这个桌子" / "the table in this room" names the room the player is already in: the words add nothing */
  const ZH_ROOM = '(?:这个?|那个?|这间|那间)?(?:房间|屋子|屋|室|客厅|店铺|店|大堂|大厅|房子|咖啡馆|面包店)(?:里面?|内|中)';
  function unRoom(c, ph) {
    if (!ph || !ph.view || ph.view.inside == null) return c;
    const s = c.trim().replace(new RegExp('^(把|将|给|让)?' + ZH_ROOM + '的'), '$1').replace(new RegExp('^在?' + ZH_ROOM + '(?=[加放摆添来再种建造多])'), '').replace(/^(把|将|给|让)?(?:室内|屋里|里面|这里面|这里)的/, '$1')
      .replace(/[ ,]+(?:in|inside|within) (?:the|this|that) (?:room|house|shop|store|cafe|café|lobby|building|place)$/i, '').replace(/[ ,]+in here$/i, '').replace(/^(?:in|inside) (?:the|this) (?:room|house|shop|store|cafe|café|lobby|building),? /i, '');
    return s || c;
  }
  /* what is written on a thing: "change the sign to X", "把招牌改成X", "change the text from books to X" */
  function parseWords(clause, ph) {
    const raw = clause.trim().replace(/[。.!！?？\s]+$/, ''); let val = null, from = null, m;
    if ((m = raw.match(/^(?:please )?(?:change|set|rename|update|edit|rewrite|make) (?:the |this |that |its )?(?:.*?)(?:sign|signboard|text|name|title|lettering|label|writing|words?)(?: (?:on|of|for) .+?)?(?: from (.+?))? (?:to|into|as|say|read) (?:say |read )?["“']?(.+?)["”']?$/i))) { from = m[1] || null; val = m[2]; }
    else if ((m = raw.match(/^(?:please )?(?:rename|call) (?:the |this |that )?(.+?) (?:to |as )?["“']?(.+?)["”']?$/i)) && (() => { const w = m[1].replace(/^(?:this|that|the) /i, '').toLowerCase(); if (/^(?:shop|store|cafe|café|bus stop|bus|sign|it|one|building|place|stall|stand)$/.test(w)) return true;
      const a0 = W.objs.get(ph.view.aimId), d0 = a0 && YX.defOf(a0), k0 = d0 ? Object.keys(d0.params).find((q) => d0.params[q].text) : null; if (!k0) return false; // otherwise the noun has to be what the thing under the crosshair is, or what it says ("this bakery" for the shop whose sign reads BAKERY)
      const kd = YX.kindOf ? YX.kindOf(w) : null; return String(a0.params[k0] || '').toLowerCase() === w || (kd && kd.type === a0.type) || String(YX.labelOf(d0) || '').toLowerCase() === w; })()) val = m[2];
    else if ((m = raw.match(/^(?:把|将)?(?:这个|那个|这家|那家)?(?:.*?)的?(?:招牌|牌子|店名|站名|名字|文字|字样|字)(?:从(.+?))?(?:改成|改为|换成|变成|写成|改叫|改)[“"'「]?(.+?)[”"'」]?$/))) { from = m[1] || null; val = m[2]; }
    else if ((m = raw.match(/^(?:把|将)[“"'「]?([A-Za-z0-9 &'\-]{2,32})[”"'」]?(?:改成|改为|换成|变成)[“"'「]?(.+?)[”"'」]?$/))) { from = m[1]; val = m[2]; }
    if (!val) return null; val = val.trim(); if (!val || val.length > 40) return null;
    if (ph.raw) { // as the player wrote or said it: capitals, and the apostrophes and marks that tidying a sentence takes out ("Maya's", not "mayas")
      const esc = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), body = Array.from(val).filter((c) => !/\s/.test(c)).map(esc).join("[^\\p{L}\\p{N}]*"); let mm = null; try { mm = body ? ph.raw.match(new RegExp(body, 'iu')) : null; } catch (e) {} if (mm && mm[0].length <= 48) val = mm[0].trim(); }
    const tk = (o) => { const d = o && YX.defOf(o); return d ? Object.keys(d.params).find((q) => d.params[q].text) || null : null; }, aim = W.objs.get(ph.view.aimId), foc = W.objs.get(ph.view.focusId); let o = tk(aim) ? aim : null;
    if (!o && from) { const f = from.trim().toLowerCase(); for (const c of W.objs.values()) { const k = tk(c); if (k && String(c.params[k]).toLowerCase() === f && YX.seen(c)) { o = c; break; } } } // the thing that says "books" and is in sight
    if (!o && tk(foc)) o = foc; if (!o) return null;
    return [{ op: 'set', id: '#' + o.id, params: { [tk(o)]: val } }];
  }
  function parseLocal1(clause, ph) {
    if (/^(?:重置世界|重置小镇|重置|回到(?:初始|默认|最初的?)(?:的)?(?:小镇|世界)|恢复(?:初始|默认)(?:的)?(?:小镇|世界)|reset the (?:world|town)|reset|start over|back to the starter town)$/i.test(strip(clause))) return [{ op: 'reset' }];
    clause = unRoom(clause, ph);
    const rn = parseRouteNote(clause); if (rn) return rn;
    const sn = parseShotNote(clause); if (sn) return sn;
    const po = parseOut(clause, ph); if (po) return po;
    const lt = parseLights(clause, ph); if (lt) return lt;
    const rp = parseRepeat(clause); if (rp) return rp;
    const wd = parseWords(clause, ph); if (wd) return wd;
    const rd = parseOnRoad(clause); if (rd) return rd;
    const fm = parseFilm(clause, ph); if (fm) return fm;
    const r = parseResize(clause); if (r) return incOps(r, ph);
    const ot = parseOther(clause, ph); if (ot) return ot;
    return parseGo(clause, ph);
  }
  /* ---------- "all the X" / "所有的X": one command for every object of a kind ---------- */
  const ZH_Q = '(?:所有|全部|全体|一切|每一?' + CL + '?)', ZH_ALLADV = /^(?:全都|全部都?|统统|通通|一起|都|全)/;
  const ZH_SCOPE = '(?:附近|周围|四周|身边|旁边|眼前|面前|这里|这儿|这边|这一带|这附近|那边|场景[里中]|世界[上里]|地图上|画面[里中]|视野[里中]|屏幕上|地上|街上|天上)';
  const ZH_NEAR = /^(?:附近|周围|四周|身边|旁边|眼前|面前|这里|这儿|这边|这一带|这附近)/;
  const selOf = (word, near) => (near ? { type: word, within: 45 } : { type: word });
  function zhBulkNoun(tail) { const n = eatNoun(tail); if (!n) return null; let len = n.len; if (tail[len] === '们') len++; return { word: n.type ? tail.slice(0, n.len) : /建筑/.test(n.generic) ? '建筑' : 'all', label: tail.slice(0, n.len), len }; }
  function bulkFind(clause) {
    const s = strip(clause); if (!s) return null;
    if (isEN(s)) return enBulk(clause);
    const re = new RegExp('(' + ZH_SCOPE + '的?)?' + ZH_Q + '的?', 'g'); let m;
    while ((m = re.exec(s))) { // 把所有的山都移走 / 删掉全部石头 / 每棵树都变高
      if (!m[0]) { re.lastIndex++; continue; }
      const at = m.index + m[0].length, n = zhBulkNoun(s.slice(at)); if (!n) continue;
      let end = at + n.len; const adv = s.slice(end).match(ZH_ALLADV); if (adv) end += adv[0].length;
      return { text: s.slice(0, m.index) + '它' + s.slice(end), sel: selOf(n.word, !!m[1] && ZH_NEAR.test(m[1])), label: n.label };
    }
    m = s.match(/^(把|将|让|给|叫|使)?/); const at = m[0].length, n = zhBulkNoun(s.slice(at)); // 把树都砍了
    if (n) { const adv = s.slice(at + n.len).match(/^(?:全都|统统|通通|都)/); if (adv && s.length > at + n.len + adv[0].length) return { text: s.slice(0, at) + '它' + s.slice(at + n.len + adv[0].length), sel: selOf(n.word, false), label: n.label }; }
    return null;
  }
  function enBulk(clause) {
    const w = enNorm(clause).split(' ').filter(Boolean);
    for (let i = 0; i < w.length; i++) {
      if (w[i] === 'everything') return { text: w.slice(0, i).concat('it', w.slice(i + 1)).join(' '), sel: selOf('all', false), label: 'things' };
      if (w[i] !== 'all' && w[i] !== 'every' && w[i] !== 'each') continue;
      let j = i + 1; if (w[i] === 'every' && w[j] === 'single') j++; if (w[j] === 'of') j++; if (/^(?:the|these|those|my)$/.test(w[j] || '')) j++;
      let near = false; if (/^(?:nearby|surrounding)$/.test(w[j] || '')) { near = true; j++; }
      for (let n = Math.min(4, w.length - j); n >= 1; n--) {
        const phrase = w.slice(j, j + n).join(' '); if (/^(?:it|them|this|that|these|those|us|you|me)$/.test(phrase) || !YX.kindOf(phrase)) continue;
        let rest = w.slice(j + n).join(' '); const sc = rest.match(/^(?:around here|round here|near me|near here|nearby|close by|around me|in the world|in the scene|in this scene|on the map|everywhere|in sight|here)(?= |$)/);
        if (sc) { if (/near|close|around|round|^here/.test(sc[0])) near = true; rest = rest.slice(sc[0].length).trim(); }
        return { text: w.slice(0, i).concat('it').join(' ') + (rest ? ' ' + rest : ''), sel: selOf(phrase, near), label: phrase };
      }
    }
    return null;
  }
  const BULK_OPS = ['remove', 'set', 'resize', 'rotate', 'act', 'become', 'move', 'walk'];
  /* stopping a thing that moves and setting it going again: "stop this bus", "start the bus", "make it drive again", "让公交车停下", "让它开起来".
     Only when the sentence names or points at one thing that exists; "stop the rain" and "stop recording" are not about a thing and are left alone. */
  /* lights: "turn off the lights in this building", "switch this lamp on", "lights off", 把这栋楼的灯关了, 关灯 */
  function parseLights(clause, ph) {
    const s = strip(clause); if (!s) return null; const en = isEN(s), t = en ? enNorm(clause) : s; let m, w = null, on = null;
    if (en) {
      if ((m = t.match(/^(?:please )?(?:turn|switch|shut|put) (off|on|out) (?:all )?(?:the |its |their )?(?:lights?|lamps?|lighting)(?: (?:of|in|on|inside|for|at) (.+))?$/))) { on = m[1] === 'on'; w = m[2] || 'this'; }
      else if ((m = t.match(/^(?:please )?(?:turn|switch|shut|put) (?:all )?(?:the |its |their )?(?:lights?|lamps?|lighting) (off|on|out)(?: (?:of|in|on|inside|for|at) (.+))?$/))) { on = m[1] === 'on'; w = m[2] || 'this'; }
      else if ((m = t.match(/^(?:please )?(?:turn|switch) (.+?)(?:'s)? (?:lights?|lamps?) (off|on|out)$/)) || (m = t.match(/^(?:please )?(?:turn|switch) (this .+?|that .+?|it|them|the (?:street ?)?(?:lamp|light|lantern|sign)s?) (off|on|out)$/))) { w = m[1]; on = m[2] === 'on'; }
      else if ((m = t.match(/^(?:lights?|lamps?) (off|on|out)$/))) { on = m[1] === 'on'; w = 'this'; }
    } else {
      if ((m = t.match(/^(?:请)?把(.+?)的?(?:灯光?|灯火|电灯)(?:都|全)?(关了|关掉|关上|关闭|关|熄了|熄掉|灭了|灭掉|打开|开了|开开|点亮|开)$/)) || (m = t.match(/^(?:请)?(?:让)?(.+?)的(?:灯光?|电灯)(?:都|全)?(关了|关掉|关上|熄了|灭了|打开|开了|点亮)$/))) { w = m[1]; on = /打开|开了|开开|点亮|^开$/.test(m[2]); }
      else if ((m = t.match(/^(?:请)?(关掉?|关了|关上|熄灭?|打开|开|点亮)(.+?)的(?:灯光?|电灯)$/))) { on = /打开|^开$|点亮/.test(m[1]); w = m[2]; }
      else if ((m = t.match(/^(?:请)?(?:把)?(?:灯光?)?(关灯|熄灯|开灯|灯关了|灯关掉|灯打开|灯开了|关了|打开)$/)) && /灯/.test(t)) { on = /开灯|打开|开了/.test(m[1]); w = '这个'; }
    }
    if (on == null || !w) return null;
    const sp = en ? enSpec(w.trim()) : parseTargetWhole(w.trim()); if (!sp) return null;
    if (sp.group) return YX.groupNow(true).length ? [{ op: 'set', id: 'them', params: { lights: on ? 'on' : 'off' } }] : null;
    const o = resolveTarget(sp, ph); return o ? [{ op: 'set', id: '#' + o.id, params: { lights: on ? 'on' : 'off' } }] : null;
  }
  /* a note on the shot that was just made ("too close", "farther from the house", "slower", "the other way", 太近了, 高一点):
     it changes that shot. Only right after a shot, or when the words name the camera: "higher" said about a house an hour later is still about the house. */
  /* a note on the path something was just given ("bigger", "higher", "the other way", 路线大一点): it changes that path. The same rule as for shots:
     right after the path was made, or when the words name it. */
  function parseRouteNote(clause) {
    const D = YX.director; if (!D || !D.routeFresh || !D.routeFresh()) return null;
    const s = strip(clause); if (!s) return null; const en = isEN(s), t = en ? enNorm(clause) : s;
    const named = en ? /\b(?:path|route|circuit)\b/.test(t) : /路线|轨迹|路径|航线/.test(t);
    if (named && (en ? /^(?:stop|end|cancel|clear|leave) (?:the |its |this |that )?(?:path|route|circuit)$|^(?:path|route) stop$/.test(t) : /^(?:路线|轨迹|路径|航线)?(?:停下|停止|取消|停)(?:路线|轨迹|路径|航线)?$/.test(t))) return [{ op: 'route', id: '#' + D.lastRoute.id, stop: true }];
    if (!D.routeNote(t)) return null;
    const h = M.history[M.history.length - 1], prev = !!h && h.ops.some((o) => /"op":"route"/.test(o));
    if (!(named || (D.plain(t) && prev))) return null;
    return [{ op: 'route', revise: clause.trim() }];
  }
  function parseShotNote(clause) {
    const D = YX.director; if (!D || !D.fresh || !D.fresh()) return null;
    const s = strip(clause); if (!s) return null; const en = isEN(s), t = en ? enNorm(clause) : s;
    if (!D.readNote(t)) return null;
    const h = M.history[M.history.length - 1], prevCam = !!h && h.ops.some((o) => /"op":"cam"/.test(o) && /"(?:move|design|revise)"/.test(o));
    const named = en ? /\b(?:camera|shot|orbit|take)\b/.test(t) : /镜头|运镜|机位|摄像机/.test(t);
    const bare = D.plain(t);
    if (!(named || (bare && prevCam))) return null;
    return [{ op: 'cam', revise: clause.trim() }];
  }
  /* coming out of a building by its door: "a person walks out of this house", "have her come out", 一个人从房子里走出来, 让他走出房子.
     Someone named who is inside walks out; "a person" is whoever is in there, or a new person if the house is empty. */
  function parseOut(clause, ph) {
    const s = strip(clause); if (!s) return null; const en = isEN(s), t = en ? enNorm(clause) : s; let m, who = null, bw = '', run = false;
    if (en) {
      const PRE = '^(?:(?:and|then|now|please) )*(?:(?:have|make|let|get|tell) )?', SUBJ = '(a person|someone|somebody|a man|a woman|a guy|a girl|a boy|a kid|a child|an old man|an old woman|another person|he|she|him|her|this person|that person|this man|this woman|this guy|that guy|the man|the woman|the person|the guy|the girl|the boy|the kid)';
      if ((m = t.match(new RegExp(PRE + SUBJ + ' (?:to )?(?:slowly |quickly )?(walk|come|step|go|run|head|stroll|wander|hurry|rush)(?:s|es|ing)? (?:back )?out(?:side)? (?:of|from) (.+?)$')))) { who = m[1]; run = /run|hurry|rush/.test(m[2]); bw = m[3]; }
      else if ((m = t.match(new RegExp(PRE + SUBJ + ' (?:to )?(leave|exit)s? (.+)$')))) { who = m[1]; bw = m[3]; }
      else if ((m = t.match(new RegExp(PRE + SUBJ + ' (?:to )?(?:slowly |quickly )?(walk|come|step|go|run|head)(?:s|es|ing)? (?:back )?out(?:side)?(?: (?:of|through) the (?:front )?door)?$')))) { who = m[1]; run = /run/.test(m[2]); }
      else return null;
      bw = bw.replace(/ (?:through|by|via) (?:the|its) (?:front )?door$/, '').replace(/^(?:the |its )?(?:front )?door(?: of )?/, '');
    } else {
      const PRE = '^(?:然后|接着|现在|请)*(?:让|叫|请)?', SUBJ = '(一个人|有个人|有一个人|有人|一个男人|一个女人|一个男的|一个女的|一个小孩|一个孩子|一位老人|一个老人|他|她|这个人|那个人|这个男人|这个女人|那个男人|那个女人)';
      if ((m = t.match(new RegExp(PRE + SUBJ + '?(?:慢慢|快步|快速|跑着)?从(.+?)(?:里面?|内|中)?(?:的)?(?:大门|门口|门)?(?:里|口)?(走|跑)?(?:了)?(?:出来|出去|出门)$')))) { who = m[1] || null; bw = m[2]; run = m[3] === '跑' || /跑着|快步|快速/.test(t); }
      else if ((m = t.match(new RegExp(PRE + SUBJ + '?(?:慢慢|快步|快速)?(走|跑)出(?:了)?(.+?)(?:的大门|的门|大门)?$')))) { who = m[1] || null; bw = m[3]; run = m[2] === '跑'; if (/^(?:来|去|来了|去了|门|门外|门口|屋外|外面)$/.test(bw)) { if (!who) return null; bw = ''; } }
      else if ((m = t.match(new RegExp(PRE + SUBJ + '(?:从里面|从屋里|从里边)?(?:走|跑)?出(?:来|去|门)$')))) { who = m[1]; }
      else return null;
    }
    const encl = (o) => !!o && !o.dead && !!YX.spaceOf && !!(YX.spaceOf(o) || {}).enclosed, aim = ph.view.aimId != null ? W.objs.get(ph.view.aimId) : null, inB = YX.insideOf ? YX.insideOf() : null;
    let P = null; if (who && (en ? !/^(?:a|an|another|someone|somebody)\b/.test(who) : !/^(?:一|有)/.test(who))) { P = resolveTarget({ person: true }, ph); if (!P || P.type !== 'person') return null; }
    let B = null; bw = (bw || '').trim();
    if (bw && !(en ? /^(?:it|there|here|inside|indoors|the building|this building|that building|the room|this room)$/.test(bw) : /^(?:里面|屋里|屋子里|房间|房间里|室内|这里|那里|里边|屋|屋内)$/.test(bw))) { const sp = en ? enSpec(bw) : parseTargetWhole(bw), o = sp ? resolveTarget(sp, ph) : null; if (encl(o)) B = o; else if (sp && sp.noun && sp.noun.type && !encl(o)) { const o2 = YX.nearestOfType(sp.noun.type, ph.view, null); if (encl(o2)) B = o2; } if (!B && !(encl(aim) || inB)) return null; }
    if (!B && P) { const rid = YX.roomOf(P); if (rid != null && encl(W.objs.get(rid))) B = W.objs.get(rid); }
    if (!B) B = inB || (encl(aim) ? aim : null);
    if (!B) { let bd = 45; for (const o of W.objs.values()) if (encl(o)) { const d = Math.hypot(o.x - ph.view.x, o.z - ph.view.z); if (d < bd) { bd = d; B = o; } } }
    if (!B) return null;
    const op = { op: 'walk', from: '#' + B.id }; if (P) op.id = '#' + P.id; if (run) op.run = true; return [op];
  }
  function parseGo(clause, ph) {
    const s = strip(clause); if (!s) return null; const en = isEN(s), t = en ? enNorm(clause) : s; let m, w = null, mo = null;
    if (en) {
      if ((m = t.match(/^(?:please )?(?:stop|halt|freeze|park) (.+?)(?: here| there| now| right there)?$/)) || (m = t.match(/^(?:please )?(?:make|have|let|tell) (.+?) (?:stop|halt|wait|stand still|stay still|stay put|stay there|stay here)(?: here| there| now)?$/))) { w = m[1]; mo = 'none'; }
      else if ((m = t.match(/^(?:please )?(?:start|restart|start up) (.+?)(?: up| again| moving| driving| going)*$/)) || (m = t.match(/^(?:please )?(?:make|have|let|get|tell|set) (.+?) (?:(?:to )?(go|move|drive|walk|fly|run)|(?:going|moving|driving|walking|flying|running))(?: on| off| away| again| along)*$/))) { w = m[1]; mo = { drive: 'drive', walk: 'wander', fly: 'fly' }[m[2]] || 'go'; }
      else if (/^(?:please )?(?:drive|go|move|carry|keep going|keep driving|keep moving) ?(?:on|again)?$/.test(t) && /^(?:drive on|go on|move on|carry on|drive again|go again|move again|keep going|keep driving|keep moving)$/.test(t.replace(/^please /, ''))) { w = 'it'; mo = 'go'; }
    } else {
      if ((m = t.match(/^(?:请)?(?:让|叫|把)?(.+?)(?:停下来?|停住|停车|停一下|别动了?|不要动|站住)$/))) { w = m[1]; mo = 'none'; }
      else if ((m = t.match(/^(?:请)?(?:让|叫)(.+?)(?:重新|继续|再)?(开起来|开走|开动|发动|出发|动起来|走起来|接着开|接着走|开|飞起来|飞)$/)) || (m = t.match(/^(?:请)?(?:让|叫)(.+?)(?:继续)(开|走|飞|前进)$/))) { w = m[1]; mo = /飞/.test(m[2]) ? 'fly' : 'go'; }
    }
    let fl = null; // how it flies: "make it fly more randomly", "let the dragon fly around freely", "have it fly in circles"
    if (en) { if ((m = t.match(/^(?:please )?(?:make|have|let|get|tell) (.+?) (?:fly|flying|move|go|wander|roam)(?: around| about)? (?:(?:a bit |a little |much |way )?more )?(?:random(?:ly)?|freely|free|erratically|unpredictably|naturally|all over(?: the (?:place|sky|town))?|wherever (?:it|they|he|she) (?:likes?|wants?|pleases?)|around(?: the (?:sky|town|place))?(?: freely| randomly)?)$/)) || (m = t.match(/^(?:please )?(?:make|have|let) (.+?) (?:stop circling|stop flying in circles|roam(?: around| about| free| freely)?|wander(?: around| about)? the sky)$/))) { w = m[1]; fl = 'roam'; } else if ((m = t.match(/^(?:please )?(?:make|have|let|get|tell) (.+?) (?:fly|flying|go|circle)(?: around)?(?: in (?:a )?circles?| round and round| in a loop| in loops)?$/)) && /circl|round and round|loop/.test(t)) { w = m[1]; fl = 'circle'; } }
    if (!en) { if ((m = t.match(/^(?:请)?(?:让|叫|把)(.+?)(?:飞得?|飞行得?)(?:更|再)?(?:随机|随意|随便|自由|自然|乱)(?:一点|一些|点|些)?(?:地?飞)?$/)) || (m = t.match(/^(?:请)?(?:让|叫)(.+?)(?:随机|随意|随便|自由自在地?|自由地?|到处|四处|满天)(?:乱)?飞$/)) || (m = t.match(/^(?:请)?(?:让|叫)(.+?)(?:不要|别)(?:再)?(?:绕圈圈?|转圈圈?)(?:了|飞)?$/))) { w = m[1]; fl = 'roam'; } else if ((m = t.match(/^(?:请)?(?:让|叫)(.+?)(?:绕圈圈?|转圈圈?|绕着圈)飞?$/))) { w = m[1]; fl = 'circle'; } }
    if (fl) { const spf = en ? enSpec(w.trim()) : parseTargetWhole(w.trim()); if (!spf) return null; if (spf.group) return YX.groupNow(true).length ? [{ op: 'set', id: 'them', params: { flight: fl } }] : null; const of = resolveTarget(spf, ph); return of ? [{ op: 'set', id: '#' + of.id, params: { flight: fl } }] : null; }
    if (!w || !mo) return null;
    w = w.trim(); if (!w || (en ? /^(?:recording|filming|rolling|talking|speaking|moving|the (?:camera|recording|shot|music|rain|snow|wind|time|clock)|raining|snowing|time)$/.test(w) : /录|拍|说话|下雨|下雪|时间|音乐|镜头/.test(w))) return null;
    const sp = en ? enSpec(w) : parseTargetWhole(w); if (!sp) return null;
    if (sp.group) { const g = YX.groupNow(true); if (!g.length) return null; const d0 = YX.defOf(g[0]) || {}; const mg = mo === 'go' ? d0.motion : mo; return mg && (mo === 'none' || mg !== 'none') ? [{ op: 'set', id: 'them', params: { motion: mg } }] : null; }
    const o = resolveTarget(sp, ph); if (!o) return null;
    const def = YX.defOf(o) || {}, own = def.motion && def.motion !== 'none' ? def.motion : def.cls === 'creature' ? 'wander' : null; // what this kind of thing does when it moves by itself
    const mm = mo === 'go' ? own : mo; if (!mm) return null; // "start the fountain": not something that travels; the model may know what is meant
    if (mm === 'none' && (!o.motion || o.motion === 'none') && !own) return null;
    return [{ op: 'set', id: '#' + o.id, params: { motion: mm } }];
  }
  function parseLocal0(clause, ph) {
    const rd0 = parseOnRoad(clause); if (rd0) return rd0; // "all the buildings on the road" is its own kind of group
    const b = bulkFind(clause); if (!b) return parseLocal1(clause, ph);
    const list = ph.ctx.many(b.sel).filter((o) => o.type !== '__pending');
    if (!list.length) return [{ op: 'say', text: T('这里没有' + b.label, 'There are no ' + b.label + ' here') }];
    // read the sentence as if it were about the nearest one of them, then widen the result to all of them
    const v = ph.view, keep = [v.aimId, v.focusId, ph.bulk]; let rep = list[0], bd = 1e9; for (const o of list) { const d = Math.hypot(o.x - v.x, o.z - v.z); if (d < bd) { bd = d; rep = o; } }
    let ops = null; v.aimId = rep.id; v.focusId = rep.id; ph.bulk = null;
    try { ops = parseLocal1(b.text, ph); } catch (e) { console.warn(e); ops = null; } finally { v.aimId = keep[0]; v.focusId = keep[1]; ph.bulk = keep[2]; }
    const tag = '#' + rep.id;
    if (!ops || !ops.length || ops.some((o) => !BULK_OPS.includes(o.op) || o.id !== tag)) return null; // anything else (adding things per object, etc.) goes to the model
    ph.bulk = b.sel;
    return ops.map((o) => Object.assign({}, o, { id: b.sel }));
  }
  function parseLocal(clause, ph) { // a command about something that is not in sight is answered, not guessed at
    ph.miss = null; ph.far = /^(?:请|帮我|麻烦)?(?:带我[去到]|送我去|我[要想]去|去|飞到|传送到)|[走跑飞游][到去向]|过去|(?:^|\b)(?:take|bring|walk|fly|move) me (?:over )?to\b|\b(?:go|head|travel|jump|teleport|walk|run|swim|fly)s? (?:over |back )?to\b|go see\b/i.test(clause); // where to go may be out of sight; what to change may not
    const r = parseLocal0(clause, ph);
    if ((!r || !r.length) && ph.miss) return [{ op: 'say', text: T('视野里没有看到' + ph.miss + '。看向它再说一次，或者说“所有的' + ph.miss + '”。', 'I can’t see a ' + String(ph.miss).toLowerCase() + ' from here. Look at it and say that again, or say “all the …”.') }];
    return r;
  }
  M.parseLocal = parseLocal; M.splitClauses = splitClauses;

  /* ---------- phrases: live application while the user is still speaking ---------- */
  function newPhrase() { const view = YX.viewNow(); return { view, ctx: YX.newCtx(view), t0: now(), applied: [], base: null, msgs: [] }; }
  let cur = null;
  function reconcile(ph, flat) {
    const same = (a, b) => a.id === b.id && a.dim === b.dim && Math.abs(a.factor - b.factor) < 1e-6;
    let prefix = ph.applied.length <= flat.length && ph.applied.every((a, i) => same(a, flat[i]));
    if (!prefix) { if (ph.base) YX.restore(JSON.parse(ph.base), {}); ph.applied = []; ph.msgs = []; }
    for (let i = ph.applied.length; i < flat.length; i++) {
      if (!ph.ctx.undo) { YX.pushUndo(); ph.ctx.undo = true; ph.base = YX.peekUndo(); }
      const res = YX.exec(flat[i], ph.ctx); ph.applied.push(flat[i]);
      if (res && res.ok) { ph.msgs.push(res.msg); const o = ph.ctx.one(flat[i].id); if (o) { M.lastInc = { id: o.id, sel: flat[i].id[0] === '#' ? null : flat[i].id, dim: flat[i].dim, factor: flat[i].factor }; YX.fx.flash(o, 0xe0533a, 0.5); } }
    }
  }
  function incPrefix(text, ph) { const cl = splitClauses(text), flat = []; let i = 0; for (; i < cl.length; i++) { const r = parseShotNote(cl[i]) || parseRouteNote(cl[i]) ? null : parseResize(cl[i]); if (!r) break; const ops = incOps(r, ph, flat[flat.length - 1]); if (!ops) break; for (const o of ops) flat.push(o); } return { flat, used: i, clauses: cl }; }
  M.partial = function (text) {
    if (!cur) cur = newPhrase();
    try { const p = incPrefix(text, cur); if (p.flat.length >= cur.applied.length || p.used === p.clauses.length) reconcile(cur, p.flat); } catch (e) { console.warn(e); }
    if (cur.msgs.length && hooks.live) hooks.live(cur.msgs[cur.msgs.length - 1]);
  };
  M.cancelPhrase = function () { if (cur && cur.ctx.undo && cur.base) { YX.restore(JSON.parse(cur.base), {}); YX.dropUndo(); } cur = null; };
  /* what was said, what it compiled to, and which objects it touched: this is the conversation the next command is read against */
  function remember(text, ops, msgs, ids, aim) {
    M.history.push({ text, aim: aim || '', ops: (ops || []).slice(0, 6).map((o) => { try { return JSON.stringify(o).slice(0, 190); } catch (e) { return ''; } }).filter(Boolean), msgs: (msgs || []).filter(Boolean).slice(0, 3), ids: (ids || []).slice(0, 16) });
    if (M.history.length > 12) M.history.shift(); // the model is given the last twelve commands
  }
  /* what "more" or "again" would mean right now: the last command once more, if it was a step that can be taken again (bigger, further, turned).
     Anything else (a colour, a new object, a placement by name) has no obvious "more", so that is left to the model, which reads the history. */
  function repOf(ops) {
    const L = (ops || []).filter(Boolean); if (!L.length || L.length > 6) return null;
    if (L.every((o) => o.op === 'resize' && isFinite(+o.factor))) return { kind: 'resize', ops: L };
    if (L.every((o) => o.op === 'move' && o.by && typeof o.by === 'object' && o.place == null && o.to == null)) return { kind: 'move', ops: L };
    if (L.every((o) => o.op === 'rotate' && isFinite(+(o.deg != null ? o.deg : o.by)) && o.face == null)) return { kind: 'rotate', ops: L };
    return null;
  }
  const REPEAT_RE = /^(?:再来一次|再来一遍|再来|再一次|又一次|继续|再多一点|再来点|再多点|再来一点|还要|更多|again|more|keep going|keep it going|one more time|once more|one more|(?:a )?(?:little|bit|little bit|tiny bit) more|some more|even more|more more|go on|continue|more please|again again|do it again|do that again|same again|more and more|further|a bit further)$/;
  function parseRepeat(clause) { const s = strip(clause); if (!s || !REPEAT_RE.test(isEN(s) ? enNorm(clause) : s)) return null; const L = M.lastRep; if (!L || L.kind === 'resize') return null; return L.ops.map((o) => JSON.parse(JSON.stringify(o))); }
  function finish(text, ops, msgs, ph) { if (hooks.afterCommand) { try { hooks.afterCommand(text, ops, msgs, ph.view); } catch (e) {} } YX.setGroup(ph.ctx.group); if (!(ops || []).every((o) => o && o.op === 'say')) M.lastRep = repOf(ops); M.lastBulk = (ops || []).some((o) => o && o.id && typeof o.id === 'object' && !Array.isArray(o.id)); for (const o of ops || []) { const on = o && ((o.place && o.place.on) || (o.to && o.to.on)); if (on != null) { const so = ph.ctx.one(on); if (so && YX.seatsOf(so).length) M.lastSeat = so.id; } } const ao = ph.view && ph.view.aimId != null ? W.objs.get(ph.view.aimId) : null; remember(text, ops, msgs, ph.ctx.group, ao ? '#' + ao.id + ' ' + ao.type : ''); }
  let chain = Promise.resolve(), routing = 0;
  function run(text, ph) {
    ph.raw = String(text || '');
    const entry = logStart(text, 'local'), ops = []; let rest = null; M.said = text;
    try {
      const p = incPrefix(text, ph); reconcile(ph, p.flat);
      for (const f of ph.applied) ops.push(f);
      for (const m of ph.msgs) entry.msgs.push(m);
      for (let i = p.used; i < p.clauses.length; i++) {
        const lops = parseLocal(p.clauses[i], ph);
        if (!lops) { rest = p.clauses.slice(i).join(isEN(text) ? ', ' : '，'); break; }
        for (const op of lops) { ops.push(op); const res = YX.exec(op, ph.ctx); if (res) { if (res.msg) entry.msgs.push(res.msg); if (res.say) entry.msgs.push(res.say); if (res.ok === false) entry.warn = true; if (op.op === 'resize' && res.ok) { const o = ph.ctx.one(op.id); if (o) M.lastInc = { id: o.id, sel: typeof op.id === 'string' && op.id[0] === '#' ? null : op.id, dim: op.dim, factor: op.factor }; } } }
      }
    } catch (e) { console.warn(e); rest = text; }
    if (rest == null) { finish(text, ops, entry.msgs, ph); logEnd(entry, entry.warn && entry.msgs.length <= 1 ? 'fail' : 'ok'); return null; }
    if (!M.sample) { YX.needAI('say', entry.msgs.length && typeof rest === 'string' && rest.trim() ? rest : text); finish(text, ops, entry.msgs, ph); logEnd(entry, 'fail', entry.msgs.length ? T('后半句需要 AI，目前没有连接', 'The rest of that needs the AI, which is not connected') : T('这句需要 AI 来理解，目前没有连接', 'That one needs the AI, which is not connected')); return null; }
    entry.tier = 'quick'; logUp(entry);
    return route(text, rest, ph, entry, entry.msgs.slice(), ops);
  }
  M.commit = function (text) {
    text = String(text || '').trim(); const ph = cur || newPhrase(); cur = null;
    if (!text) return;
    if (!routing) { const p = run(text, ph); if (p) { routing++; chain = p.catch((e) => console.warn(e)).then(() => { routing--; }); } return; }
    // an earlier command is still being compiled: wait for it, so "them" and "it" mean what that command made
    routing++;
    chain = chain.then(() => { ph.view.focusId = W.focusId; ph.ctx.view.focusId = W.focusId; return run(text, ph); }).catch((e) => console.warn(e)).then(() => { routing--; });
  };

  /* ================= tier 1 · the quick model ================= */
  const OPS_DOC_ZH = [
    '{"op":"add","type":T,"params":{…},"place":P,"count":1,"color":"#rrggbb","scale":1,"name":"","id":"别名","with":ID}   新放目录里有的物体；带 "with" 时新角色会一直陪在那个已有角色身边（两个人会牵着手）',
    '{"op":"set","id":ID,"params":{…}}   改已有物体的参数；数字可写 "+1" "*1.5"；通用键 color name scale speed motion(none|fly|drive|wander|drift|hover) flight(circle 绕圈 | roam 想往哪飞就往哪飞；只对会飞的) lights(on|off：窗户、路灯、招牌这些会亮的东西)',
    '{"op":"resize","id":ID,"dim":"size|height|width|depth","factor":1.2}   变大变小变高（自动映射到楼层数等语义参数）',
    '{"op":"move","id":ID,"place":P} 或 {"op":"move","id":ID,"by":{"forward":2,"right":-1,"up":0}}   by 以玩家视角为准，单位米',
    '{"op":"rotate","id":ID,"deg":90} 或 {"op":"rotate","id":ID,"face":"me|away|road|#id"}',
    '{"op":"remove","id":ID}   {"op":"clone","id":ID,"count":2,"place":P}',
    '{"op":"become","id":ID,"type":T,"params":{…}}   把已有物体原地变成目录里的另一种类型',
    '{"op":"act","id":ID 或 [ID…],"activity":"chat|laugh|cheer|clap|wave|jump|dance|sit|stand|squat|kneel|lie|walk|stop|ride","times":3}   让已有的角色做动作；多个动作写 "chat,laugh"；jump 是原地真的跳起再落下；ride 是骑上自行车（附近没有车会自动给一辆）',
    '{"op":"follow","id":ID,"target":ID,"side":"left|right|behind"}   让已有的角色跟在另一个角色身边一起走；"target":null 取消',
    '{"op":"walk","id":ID,"to":P,"run":false,"pose":"stand|sit|wave"}   让已有的角色走到某处（在屋里的角色被叫到屋外，会自己从门走出来；叫进屋也是从门走进去）。{"op":"walk","from":建筑ID,"id":ID,"to":P} = 从那栋建筑的门里走出来：不写 id 时，屋里有人就是他走出来，屋里没人就有一个新的人走出来；不写 to 就走到门前几步。“一个人从房子里走出来”用这个，不要在门外 add 一个人',
    '{"op":"route","id":ID,"design":"玩家的原话","loop":true}   让一个会动的东西（会飞的、会走的、会开的）按一条描述出来的路线走：“在广场上空飞 8 字”“绕着钟楼螺旋上升”“绕喷泉走两圈再去长椅”“飞得随意一点，到处逛”“沿着河边巡逻”。凡是玩家描述了怎么走、走什么形状、经过哪里，都用它，design 里放玩家的原话：一个懂现场坐标的设计器会把路线一个点一个点写出来并避开建筑。loop 可省（往返巡逻、盘旋=true；去某处、降落=false）。{"op":"route","revise":"玩家的原话"}=修改刚才那条路线（上一条指令是 route，玩家在评价或纠正它：“太小了”“绕到塔后面去”“最后落在屋顶上”）；{"op":"route","id":ID,"stop":true}=不走路线了。只是“飞起来/别飞了”仍用 set motion；只是“走到某处”仍用 walk',
    '{"op":"use","id":人的ID,"target":物体ID}   让人去“玩/用”行尾标着“可以玩”的东西（滑梯：爬上去滑下来，一遍又一遍）；{"op":"use","id":人的ID,"stop":true} 停下',
    '{"op":"talk","id":人的ID,"say":"玩家想对他说的话(可省略)"}   玩家想和镇上某个人说话/问他事情/打招呼时用：那个人会转过来，之后玩家说的话都交给他回答，直到道别。{"op":"talk","end":true} 结束对话',
    '{"op":"scatter","type":T,"params":{…},"count":12,"radius":15,"place":P}   新增一片/一群/很多',
    '{"op":"row","type":T,"params":{…},"count":8,"spacing":8,"along":"road","side":"both|near|far"}   新增沿路一排；或用 "place":P,"dir":"right|forward"',
    '{"op":"crowd","count":8,"activity":"chat|watch|queue|walk|play|sit|wave|stand","place":P,"target":ID}   新增一群正在做某事的人',
    '{"op":"env","time":0到24或"dawn|noon|sunset|dusk|night","weather":"clear|cloudy|rain|snow|fog|storm","ground":"grass|sand|snow|dirt|stone","light":"soft|normal|hard","lightFrom":"left|right|front|back","look":"none|warm|cool|noir|vivid|faded|dream","flow":0,"gravity":0到3（1 正常，0 没有重力，0.17 月球）}   只写要改的键',
    '{"op":"cam","lens":35,"move":"push|pull|pan|tilt|truck|crane|orbit|street|reveal|flyover|follow|overview|reset","target":ID,"dur":8,"amount":6,"deg":150,"rec":true}   运镜（street=沿街平推，reveal=后退升起，flyover=飞越；玩家说“拍/录一段”才加 rec:true，会边运镜边录成片子）。任何要设计的镜头（“从街口推到面包店门口再升起来”“给喷泉来个电影感的镜头”）都写成 {"op":"cam","design":"玩家的原话","target":ID,"rec":false}，可以同时带 move 作为提示：引擎会让摄影指导按现场设计轨迹并避开建筑。{"op":"cam","revise":"玩家的原话"}=修改刚才那个镜头：上一条指令是镜头，而玩家现在在评价或纠正它（“太近了”“从左边开始”“把整栋房子都拍进去”“不对，再低一点”“结尾停在门口”），就用它——改的是同一个镜头，不要重新 design；{"op":"cam","rec":true}=把刚才的镜头重走一遍并录下来（没有刚做的镜头就开始录玩家看到的画面）；{"op":"cam","stop":true}=停止录制',
    '{"op":"shot","save":true,"name":"","move":"orbit"} | {"op":"shot","go":2} | {"op":"shot","play":true}   机位',
    '{"op":"rig","target":ID,"angles":["wide","close","low"]} 在它周围架三个机位，同一时刻一起拍；angles 可省（默认 wide 全景、side 平视侧面、low 低机位），玩家点名要哪种就从 wide|side|low|close(特写/脸)|front|back|top(俯拍) 里选。玩家对机位有更具体的要求时（“一个贴着车轮的低机位”“从它右后方 3 米、和它一起走”“长焦拍脸”），不要硬套名字，改用 "cams" 逐个写参数，1 到 3 个：{"op":"rig","target":ID,"cams":[{"name":"wheel","az":100,"dist":2,"height":0.4,"lens":24,"look":"wheels","travel":true}]}——az 是绕主体的方位角（0=它的正前方，90=它的右侧，180=它的身后，270=左侧），dist 离它几米，height 离地几米，lens 焦距毫米（18-24 广，35 标准，50-85 紧），look 看它的哪里（face|chest|middle|feet|wheels 或 0 到 1 的高度比例），travel=true 跟着它一起移动、false 站着不动只转头；可以带 "kind":"close" 之类作为起点再改其中几项。静止和运动的主体都适用。只架机位，不要自己加 action，除非玩家说了开拍 | {"op":"rig","here":true,"follow":ID} 放在玩家脚下、但会转头一直对着那个对象 | {"op":"rig","here":true,"key":"B"} 在玩家现在站的位置放一个机位，拍的就是玩家此刻看到的画面（key 可省；最多三个）。要在指定位置放机位（屋里一个、门外一个），只能这样一个一个放：玩家走到哪、说“在这里放一个机位”，就放在哪；你不能替玩家把机位放到别处，这时用 say 告诉他走过去再说 | {"op":"rig","drop":"B"} 撤掉其中一个 | {"op":"rig","action":true} 已架好的机位一起开拍 | {"op":"rig","cut":true} 咔 | {"op":"rig","off":true} 撤掉机位',
    '{"op":"clay","on":true}   白模    {"op":"goto","id":ID}   带玩家过去    {"op":"undo"}',
    '{"op":"invent","type":"英文小写名","label":"中文名","brief":"外观与细节(40~100字)","size":[宽,高,深],"motion":"none|fly|wander|drive|drift|hover","place":P,"id":"别名","replace":ID}   目录里没有合适类型时才用：造一种全新的物体。带 "replace" 时是把那个已有物体原地重造（原物体留在原地，新模型好了再替换）。motion 写它天生怎么动，而不是现在动不动：汽车/卡车/火车=drive（停着的也是），飞机/无人机/鸟=fly，动物/机器人=wander，气球=hover，云=drift，建筑/家具/植物/游乐设施=none',
    '{"op":"plan","brief":"…","clear":false}   玩家要的是一个“地方”而不是几样东西时用：一整个新场景/新世界/一大片区域，或者任何由很多东西组成的地方（海港、集市、公园、游乐场、农场、营地、广场、小村子）。brief 写清这是什么地方、建在哪（“就在这里”“湖边”），并把玩家点名要的东西都列为必须有。只有玩家要重来或整个换掉时才写 clear=true。如果玩家只是点名要几样东西（一个码头和两条船），用 add，不用 plan',
    '{"op":"say","text":"一句很短的话"}   只在无法执行或必须澄清时',
  ].join('\n');
  const OPS_DOC_EN = [
    '{"op":"add","type":T,"params":{…},"place":P,"count":1,"color":"#rrggbb","scale":1,"name":"","id":"alias","with":ID}   put NEW catalog objects into the world; with "with" the new character keeps to that existing character\'s side (two people hold hands)',
    '{"op":"set","id":ID,"params":{…}}   change parameters of existing objects; numbers may be "+1" or "*1.5"; common keys: color name scale speed motion(none|fly|drive|wander|drift|hover) flight(circle | roam = wherever it likes; only for things that fly) lights(on|off: windows, lamps, signs, anything that glows)',
    '{"op":"resize","id":ID,"dim":"size|height|width|depth","factor":1.2}   bigger / smaller / taller (maps onto semantic parameters such as floors)',
    '{"op":"move","id":ID,"place":P} or {"op":"move","id":ID,"by":{"forward":2,"right":-1,"up":0}}   by is in metres from the player\'s point of view',
    '{"op":"rotate","id":ID,"deg":90} or {"op":"rotate","id":ID,"face":"me|away|road|#id"}',
    '{"op":"remove","id":ID}   {"op":"clone","id":ID,"count":2,"place":P}',
    '{"op":"become","id":ID,"type":T,"params":{…}}   turn an existing object into another catalog type, where it stands',
    '{"op":"act","id":ID or [IDs],"activity":"chat|laugh|cheer|clap|wave|jump|dance|sit|stand|squat|kneel|lie|walk|stop|ride","times":3}   make EXISTING characters do something; several activities as "chat,laugh"; jump is a real hop that lands again; ride gets them onto a bicycle (one appears if none is near)',
    '{"op":"follow","id":ID,"target":ID,"side":"left|right|behind"}   an existing character walks at another one\'s side; "target":null ends it',
    '{"op":"walk","id":ID,"to":P,"run":false,"pose":"stand|sit|wave"}   an existing character walks somewhere (one who is indoors and is sent outside leaves by the door; one sent indoors walks in by the door). {"op":"walk","from":BUILDING_ID,"id":ID,"to":P} = comes out of that building by its door: without id, whoever is inside comes out, and if nobody is inside a new person does; without to they stop a few steps in front of the door. "A person walks out of the house" is this, never an add outside the door',
    '{"op":"route","id":ID,"design":"the words the player said","loop":true}   something that can move (flies, walks or drives) travels a path that was described: "fly a figure of eight over the square", "spiral up around the clock tower", "walk round the fountain twice and then to the bench", "fly more randomly, all over the place", "patrol along the river". Whenever the player describes HOW it should travel, what shape, or what it should pass, use this with their own words in design: a designer that knows the coordinates of the place writes the path point by point and keeps it clear of buildings. loop is optional (patrolling, circling = true; going somewhere, landing = false). {"op":"route","revise":"the words the player said"} = change the path just made (the previous command was a route and the player comments on it or corrects it: "too small", "go behind the tower", "land on the roof at the end"); {"op":"route","id":ID,"stop":true} = leave the path. Plain "start flying / stop flying" is still set motion; plain "walk to X" is still walk',
    '{"op":"use","id":ID of a person,"target":ID of the thing}   a person starts using something whose line says "can be used" (a slide: up the ladder and down the chute, over and over); {"op":"use","id":ID,"stop":true} stops them',
    '{"op":"talk","id":ID of a person,"say":"what the player wants to say to them (optional)"}   when the player wants to talk to, ask or greet someone in the town: that person turns to the player and answers; from then on what the player says goes to them until they say goodbye. {"op":"talk","end":true} ends it',
    '{"op":"scatter","type":T,"params":{…},"count":12,"radius":15,"place":P}   a patch / a bunch / lots of NEW things',
    '{"op":"row","type":T,"params":{…},"count":8,"spacing":8,"along":"road","side":"both|near|far"}   a NEW row along the road; or "place":P,"dir":"right|forward"',
    '{"op":"crowd","count":8,"activity":"chat|watch|queue|walk|play|sit|wave|stand","place":P,"target":ID}   a NEW group of people doing something',
    '{"op":"env","time":0..24 or "dawn|noon|sunset|dusk|night","weather":"clear|cloudy|rain|snow|fog|storm","ground":"grass|sand|snow|dirt|stone","light":"soft|normal|hard","lightFrom":"left|right|front|back","look":"none|warm|cool|noir|vivid|faded|dream","flow":0,"gravity":0..3 (1 normal, 0 none, 0.17 the Moon)}   only the keys that change',
    '{"op":"cam","lens":35,"move":"push|pull|pan|tilt|truck|crane|orbit|street|reveal|flyover|follow|overview|reset","target":ID,"dur":8,"amount":6,"deg":150,"rec":true}   camera move (street = glide along the road, reveal = back away and rise, flyover; add rec:true only when the player asks to film or record it: the move is then recorded as a clip). Any shot that has to be designed ("push from the corner to the bakery door, then rise", "give the fountain a cinematic shot") is written {"op":"cam","design":"the words the player said","target":ID,"rec":false}, optionally with a move as a hint: a director of photography then designs the path for this place and keeps it clear of buildings. {"op":"cam","revise":"the words the player said"} = change the shot that was just made: when the previous command was a shot and the player now comments on it or corrects it ("too close", "start from the left", "keep the whole house in frame", "no, lower", "end on the door"), use this; the same shot is changed, never a new design; {"op":"cam","rec":true} = fly the move just made again and record it (with no recent move: start recording what the player sees); {"op":"cam","stop":true} = stop recording',
    '{"op":"shot","save":true,"name":"","move":"orbit"} | {"op":"shot","go":2} | {"op":"shot","play":true}   saved shots',
    '{"op":"rig","target":ID,"angles":["wide","close","low"]} three cameras around it that film one moment together; angles is optional (default wide, side at eye level, low) and, when the player names the kinds they want, pick from wide|side|low|close (a close-up, the face)|front|back|top (from above). When the player wants something more particular ("one low by the wheel", "from behind its right shoulder, 3 m back, moving with it", "a long lens on her face"), do not force a name on it: write each camera as numbers in "cams", one to three of them: {"op":"rig","target":ID,"cams":[{"name":"wheel","az":100,"dist":2,"height":0.4,"lens":24,"look":"wheels","travel":true}]} where az is the direction round the subject (0 = straight in front of it, 90 = its right, 180 = behind it, 270 = its left), dist metres from it, height metres above the ground, lens in mm (18-24 wide, 35 normal, 50-85 tight), look the part of it to look at (face|chest|middle|feet|wheels, or 0 to 1 up its height), travel true = moves along with it, false = stands still and turns; "kind":"close" and the like may be given as a starting point and then altered. Works for subjects that stand and that move. This only sets them up: do not add action unless the player said to roll | {"op":"rig","here":true,"follow":ID} stands where the player is but turns to keep that thing in frame | {"op":"rig","here":true,"key":"B"} a camera where the player stands now, filming exactly what they see at this moment (key optional; three at most). Cameras at chosen places (one inside the house, one outside the door) are placed only this way, one at a time: the player walks there and says "put a camera here"; you cannot put a camera somewhere the player is not, so tell them with say to walk there and say it | {"op":"rig","drop":"B"} take one down | {"op":"rig","action":true} roll all the cameras that stand | {"op":"rig","cut":true} | {"op":"rig","off":true} take them down',
    '{"op":"clay","on":true}   clay mode    {"op":"goto","id":ID}   take the player there    {"op":"undo"}',
    '{"op":"invent","type":"english_snake_case","label":"Short name","brief":"look and details, 15-40 words","size":[w,h,d],"motion":"none|fly|wander|drive|drift|hover","place":P,"id":"alias","replace":ID}   only when no catalog type fits: build a brand-new kind of object. With "replace" it rebuilds that existing object in place (the original stays where it is until the new model is ready). "motion" is how this kind of thing gets around by nature, not whether it is moving now: car / truck / train = drive (even when parked), plane / drone / bird = fly, animal / robot = wander, balloon = hover, cloud = drift, building / furniture / plant / playground equipment = none',
    '{"op":"plan","brief":"…","clear":false}   when the player asks for a PLACE rather than for a few objects: a whole new scene / world / district, or any place made of many things (a harbor, a market, a park, a playground, a farm, a campsite, a square, a little village). The brief says what the place is, where it goes ("right here", "by the lake") and lists everything the player named as must-haves. clear=true only when they ask to start over or to replace everything. If they only name the objects they want (a pier and two boats), use add, not plan',
    '{"op":"say","text":"one short sentence"}   only when you cannot act or must ask',
  ].join('\n');
  const PLACE_DOC_ZH = 'ID: "#12" 现有物体；本次回复里 add/invent 起的别名；"aim"=准星所指；"focus"=刚操作的；"them"=上一句涉及的那些；一整类用 {"type":"tree"}（世界里所有的树，包括下面没列出的远处的；只有说“附近的”才加 "within":40）；指定的几个用 ["#3","#5"]。\nP: {"front":8,"right":0} 玩家前方 | {"aim":true} 准星落点（地面，或准星所对物体朝玩家的一侧） | {"near":ID,"side":"left|right|front|behind|any"} | {"on":ID} 放在其上(屋顶/座位/顶部，会跟随) | {"road":"ahead"} 玩家眼前那条路上（"road":ID 指定某条路；加 "side":"beside" 是路边；车辆会进车道并顺着路的方向） | {"across":true} 玩家所在马路对面 | {"across":ID} | {"above":ID或"me","height":10} | {"at":[x,z]} | {"between":[ID,ID]} | {"wall":"back|left|right|front"} 室内：靠玩家所在房间的那面墙（front 是有门的那面）。{"in":ID} 进到它里面（行尾标“可进入”或“里面可站人”的物体：房间的地板上、亭子里）。省略=准星落点（准星没落在任何东西上时，玩家前方空地）。\n放建筑、树这类大件时不要自己用 at 挑坐标：引擎会在你给的位置附近找一块不占路、不压别的东西的空地（临街、退后、朝向马路）；想靠近某处就用 near/front/aim。只有玩家明说“放在路上”才用 road。占在路上的物体用 {"type":"building","on":"road"} 选中（type 可换成 tower、tree、all 等）；把物体挪到最近的空地：move 的 P 用 {"clear":true}。';
  const PLACE_DOC_EN = 'ID: "#12" an existing object; an alias given by add/invent in this reply; "aim" = under the crosshair; "focus" = last edited; "them" = the objects of the previous command; every object of a kind: {"type":"tree"} (all trees in the world, including far ones not listed below; add "within":40 only for "nearby"); a few specific ones: ["#3","#5"].\nP: {"front":8,"right":0} ahead of the player | {"aim":true} where the crosshair rests (the ground, or the near side of the thing it is on) | {"near":ID,"side":"left|right|front|behind|any"} | {"on":ID} on top of it (roof / seat; it follows) | {"road":"ahead"} on the road in front of the player ("road":ID for a specific road; add "side":"beside" for the roadside; vehicles join a lane and line up with it) | {"across":true} across the road from the player | {"across":ID} | {"above":ID or "me","height":10} | {"at":[x,z]} | {"between":[ID,ID]} | {"wall":"back|left|right|front"} indoors: against that wall of the room the player is in (front is the wall with the door). {"in":ID} inside it (for objects whose line says "can be entered" or "has standing room inside": on the floor of the room, under the roof of the gazebo). Omit to put it where the crosshair rests (open ground ahead if it rests on nothing).\nFor buildings, trees and other large things do not pick coordinates with "at": the engine finds free ground near the place you give, off the roads and clear of everything else (beside a street, set back, facing it); to be near something use near/front/aim. Use "road" only when the player says to put it on the road. Select what stands on a road with {"type":"building","on":"road"} (type may be tower, tree, all ...); to move things to the nearest free ground use move with P = {"clear":true}.';
  const RULES_ZH = '- 反复纠正：如果“最近的指令”显示玩家已经为同一件事说了两次以上、还在纠正（又是同一个物体或位置，出现“不对”“不是这样”“还是”“再来”，或者中间撤销过），再做一次小调整没有用。只输出 {"op":"rethink"}：会换更强的模型把这个东西连同周围一起重新安排。\n- 新东西从它的环境里来，环境能决定的就不要写：室内家具自己会和墙对齐，沙发、架子、电视、橱柜、挂画会靠到玩家看着的那面墙（place {"wall":…} 可以指定另一面墙）；给大人加的、或放在大人旁边的小孩会随这个大人（肤色、发色）；路边设施和家具会和最近的同类一致。只有玩家要求不一样时才写这些参数。\n- 指代：“这个/那个/眼前的”=准星物体(←准星)；没说对象的“它/再…一点”=刚操作的(←刚操作)；“他们/它们/这些/那几个/刚才那些”=上一句涉及的对象(←上一句，ID 也写在“最近的指令”里)。\n- 这是连续对话，先看“最近的指令”。玩家对已有对象提要求（做动作、改样子、移动、删除）时，只能用它们的 ID 去 set/act/walk/move/rotate/resize/become/remove，绝不能再 add 或 crowd 出新的。只有明确说“再来/加/放/多几个”才新增。\n- 改造已有物体：能改参数就 set；换成目录里的另一类用 become；目录里没有才 invent 并带 "replace"。绝不要先 remove 再 add。\n- 批量：“所有/全部/每个/都”指一整类时，用一条操作配 {"type":T} 一次改完，不要只改一个，也不要逐个列 ID。“移走/拿走/去掉/清掉/不要了”= remove。\n- 物理：不会飞的东西不能悬空，引擎会让它落回地面。“跳”= act jump，不要用 move 的 up，也不要把 motion 设成 fly/hover。只有玩家明确要“飞起来/飘着/悬浮”才 set motion；要一直待在空中的新物体（飞碟、月亮、悬浮岛）invent 时 motion 写 hover/drift/fly。人和车不会穿过建筑和彼此：引擎自己让它们绕行、跟车、停车，你不用处理。\n- 陪伴：说“给他加一个小孩/带一只狗/牵着手/跟着/一起走”时，新角色用 add 加 "with"，已有角色用 follow，否则他们会各走各的。小孩用 person 的 age=child。骑车用 act ride（或直接 add 一个 pose=ride 的 person），不要把人摆成 sit 放到车上。\n- 位置优先用关系（road/near/on/across/aim），少用绝对坐标。车放到路上用 {"road":…}。\n- 左右前后以玩家视角为准（by.forward 为正 = 离玩家更远）。颜色用 #rrggbb。一句话可以输出多行。目录里有的类型绝不用 invent。\n- 只动看得见的：场景里行尾标“(视野外)”的物体，玩家现在看不到。玩家说“这个/那个/那棵树/桌子/那辆车”这类指代时，只能选没有标“视野外”的；视野里没有符合的，就输出 {"op":"say","text":"…"} 告诉玩家没看到、请看向它再说，绝不要去改一个视野外的同类物体。只有玩家明说“身后的/远处的/所有的/刚才那个”，或用“它”接着上一句时，才可以动视野外的。\n- 坐：行尾有“可坐N(空M)”的物体能坐人。玩家指着它（←准星）说“椅子/座位/坐这儿/坐上去”，指的就是它，哪怕它的类型叫 table、bench、sofa：让新的人坐上去用 {"op":"add","type":"person","params":{"pose":"sit"},"place":{"on":ID}}，让已有的人坐上去用 {"op":"move","id":那个人,"place":{"on":ID}}。不要为了“坐”再新加一把椅子，除非玩家明说要新的。玩家说“已有的/原来的/刚才那把”，指的是历史里【当时准星指着】的那个物体；上一句多加出来的东西，这时要先 remove。\n- 进去：标“可进入”“里面可站人”的物体里面有空间。让人走进去用 {"op":"walk","id":人,"to":{"in":ID}}，在里面新加人或东西用 place {"in":ID}；在里面的人可以 {"op":"set","id":人,"params":{"motion":"wander"}} 在里面走动。场景里每个物体行尾写的就是它能做的事（可坐、可进入、里面可站人、drive 等）；玩家要的事如果那个物体做不了，用 say 说明，不要假装做了。\n- 改字：物体上写的字（招牌、站名、车身上的字）是场景行里标“(上面的字)”的那个参数，改它用 {"op":"set","id":ID,"params":{"text":"新文字"}}（text 会自动对应到那个参数）。"label" 只是给物体起个称呼，不会改变它上面写的字。上一条指令的结果里如果写着“它没有…这个属性”，说明那次没改成，按它列出的属性名重来。';
  const RULES_EN = '- Repeated corrections: if the recent commands show the player has already asked for this same thing two or more times and is still correcting it (the same object or spot again, words like "no", "not like that", "again", "still", or an undo in between), another small tweak will not help. Output only {"op":"rethink"}: a bigger model then rearranges that thing together with what surrounds it.\n- New things come from their context, so leave out what the context decides: indoors, furniture stands square to the walls by itself, and sofas, shelves, televisions, kitchen units and pictures go against the wall nearest to where the player is looking (place {"wall":…} picks another wall); a child added with or next to an adult takes after that adult (skin, hair); street and room furniture matches the nearest piece of its kind. Only give those params when the player asks for something different.\n- Reference: "this / that / the one in front of me" = the object under the crosshair (<-crosshair). A bare "it" or "a bit more" = the last edited object (<-last edited). "they / them / those / the two of them" = the objects of the previous command (<-previous command; their ids are also listed under Recent commands).\n- This is an ongoing conversation: read Recent commands first. When the player asks something of objects that already exist (do an action, change how they look, move, delete), operate on their ids with set / act / walk / move / rotate / resize / become / remove. Never add or crowd new ones for that. Only add when the player clearly asks for more.\n- To change what an existing object is: set if a parameter does it; become if the catalog has the target type; otherwise invent with "replace". Never remove and then add.\n- Bulk: "all / every / each" of a kind is ONE operation with {"type":T}; never just one of them and never a list of ids. "Take away / get rid of / clear out" = remove.\n- Physics: things that cannot fly do not stay in the air (the engine drops them back to the ground). "Jump" = act jump; never move up, never motion fly/hover for that. Use set motion fly/hover only when the player explicitly wants something to fly or float; a new object that must stay in the air (a UFO, a moon, a floating island) gets motion hover/drift/fly when you invent it. People and vehicles never pass through buildings or each other: the engine makes them walk around, queue and stop, so you do not handle that.\n- Company: for "give him a child / a dog with her / holding hands / follow / walk together" use add with "with" for a new character and follow for existing ones, otherwise they wander apart. A child is a person with age=child. Cycling is act ride (or add a person with pose=ride); never pose someone as sit on top of a bicycle.\n- Prefer relational places (road / near / on / across / aim) over raw coordinates. Vehicles go onto a road with {"road":…}.\n- Left / right / forward / back are from the player\'s point of view (by.forward > 0 means farther from the player). Colours are #rrggbb. One sentence may need several lines. Never invent a type the catalog already has.\n- Only touch what can be seen: objects whose scene line ends with "(out of view)" are not in the player\'s picture right now. When the player refers to "this / that / the tree / the table / that car", choose only among objects NOT marked out of view; if none of the right kind is in view, output {"op":"say","text":"…"} telling the player you cannot see one and to look at it and say it again. Never change a similar object that is out of view instead. Objects out of view may be changed only when the player says so ("behind me", "far away", "all of them", "the one from before") or continues the previous command with "it".\n- Sitting: an object whose line says "seats N (M free)" can be sat on. When the player points at it (<-crosshair) and says "the chair / the seat / sit here", that object is what they mean, even if its type is table, bench or sofa: seat a NEW person with {"op":"add","type":"person","params":{"pose":"sit"},"place":{"on":ID}}, an EXISTING person with {"op":"move","id":thatPerson,"place":{"on":ID}}. Never add another chair just so someone can sit, unless the player asks for a new one. "The existing one / the original one / that one from before" is the object named in the history as [crosshair was on ...]; whatever the previous command added by mistake is removed first.\n- Going inside: an object marked "can be entered" or "has standing room inside" has space in it. Send someone in with {"op":"walk","id":person,"to":{"in":ID}}; add a new person or thing in there with place {"in":ID}; someone inside can walk about in there with {"op":"set","id":person,"params":{"motion":"wander"}}. The end of each scene line says what that object can do (seats, can be entered, standing room inside, drive ...). If the player asks for something that object cannot do, say so with a say op; never pretend it was done.\n- Words on things: the text written on an object (a shop sign, a stop name, the lettering on a bus) is the parameter marked "(text on it)" in its scene line; change it with {"op":"set","id":ID,"params":{"text":"New words"}} ("text" maps to that parameter by itself). "label" only gives the object a nickname and never changes what is written on it. If the result of the previous command says "it has no property ...", that change did not happen: redo it with one of the property names it lists.';
  const SHOTS_ZH = '「在那棵树下放一张长椅，再来两只猫坐上面」→\n{"op":"add","type":"bench","place":{"near":"#71","side":"front"},"id":"b1"}\n{"op":"add","type":"cat","count":2,"place":{"on":"b1"}}\n「把所有路灯调高一倍，天色暗一点」→\n{"op":"resize","id":{"type":"lamp"},"dim":"height","factor":2}\n{"op":"env","time":"dusk"}\n「把所有的山都移走，附近的车都变成红色」→\n{"op":"remove","id":{"type":"hill"}}\n{"op":"set","id":{"type":"car","within":40},"params":{"color":"#c0392b"}}\n「给这个大人加一个小孩」→\n{"op":"add","type":"person","params":{"age":"child","height":1.15},"with":"aim"}\n（上一句新增了两个人 #45 #46）「让他们聊天，笑起来」→\n{"op":"act","id":["#45","#46"],"activity":"chat,laugh"}\n「把这辆巴士挪到眼前的马路上」→\n{"op":"move","id":"aim","place":{"road":"ahead"}}\n「让这个小孩跳两下」→\n{"op":"act","id":"aim","activity":"jump","times":2}\n「把它变成一艘海盗船」→\n{"op":"invent","replace":"aim","type":"pirate_ship","label":"海盗船","brief":"木质船身，三根桅杆，黑色骷髅帆，船尾楼和一排炮窗","size":[5,9,14],"motion":"none"}';
  const SHOTS_EN = '"put a bench under that tree and two cats sitting on it" ->\n{"op":"add","type":"bench","place":{"near":"#71","side":"front"},"id":"b1"}\n{"op":"add","type":"cat","count":2,"place":{"on":"b1"}}\n"make all the street lamps twice as tall and bring the light down a little" ->\n{"op":"resize","id":{"type":"lamp"},"dim":"height","factor":2}\n{"op":"env","time":"dusk"}\n"get rid of all the hills and make the cars near me red" ->\n{"op":"remove","id":{"type":"hill"}}\n{"op":"set","id":{"type":"car","within":40},"params":{"color":"#c0392b"}}\n"add a kid to this adult" ->\n{"op":"add","type":"person","params":{"age":"child","height":1.15},"with":"aim"}\n(the previous command added two people, #45 and #46) "have them chat and laugh" ->\n{"op":"act","id":["#45","#46"],"activity":"chat,laugh"}\n"move this bus onto the road in front of me" ->\n{"op":"move","id":"aim","place":{"road":"ahead"}}\n"make the kid jump twice" ->\n{"op":"act","id":"aim","activity":"jump","times":2}\n"turn it into a pirate ship" ->\n{"op":"invent","replace":"aim","type":"pirate_ship","label":"Pirate ship","brief":"wooden hull, three masts, black skull sails, a raised stern castle and a row of gun ports","size":[5,9,14],"motion":"none"}';
  function routePrompt(text, rest, v, doneMsgs, ids) {
    const en = YX.lang === 'en';
    const hist = M.history.map((h, hi) => (en ? '"' + h.text + '"' + (h.aim ? ' [crosshair was on ' + h.aim + ']' : '') + ' -> ' : '「' + h.text + '」' + (h.aim ? '【当时准星指着 ' + h.aim + '】' : '') + '→ ') + (h.ops.length ? (hi < M.history.length - 6 ? h.ops.slice(0, 3) : h.ops).join(' ') : en ? '(nothing)' : '(无)') + (h.ids.length ? (en ? '  => objects ' : '  ⇒ 涉及对象 ') + h.ids.map((i) => '#' + i).join(' ') : '') + (h.msgs.length ? (en ? '  (' : '（') + h.msgs.join(en ? '; ' : '；') + (en ? ')' : '）') : '')).join('\n') || (en ? '(none yet)' : '(无)');
    const idl = ids && ids.length ? ids.map((i) => '#' + i).join(' ') : '';
    if (en) return 'You compile spoken commands for a real-time 3D world engine. The player walks around and talks (speech-to-text may contain mis-hearings, filler words or mixed languages); you turn each command into operations.\nOutput JSONL only: one JSON object per line. No explanations, no code fences, nothing else. Shorter is faster.\n\n## Operations\n' + OPS_DOC_EN + '\n\n' + PLACE_DOC_EN + '\n\n## Rules\n' + RULES_EN + (YX.strict ? '\n- Realistic physics is ON: the engine refuses anything unphysical (a person, car or building flying or floating; a bicycle moving with nobody on it; a non-character walking). If the player asks for one of these, reply with say: it cannot be done while realistic physics is on, and it can be switched off in Settings.' : '\n- Realistic physics is OFF: the player may make things fly or float on request.') + '\n\n## Examples\n' + SHOTS_EN + '\n\n## Catalog (type Name: parameter=default[range])\n' + YX.catalog() + '\n\n## Current scene\n' + YX.describe(v) + '\n\n## Recent commands (oldest first)\n' + hist + (doneMsgs.length ? '\n\n## Already executed locally from this sentence (do not repeat)\n' + doneMsgs.join('; ') + (idl ? '\nObjects this sentence has touched so far: ' + idl : '') + '\nStill to do: "' + rest + '"' : '') + '\n\n## The player says\n"' + text + '"';
    return '你是一个实时 3D 世界引擎的指令编译器。玩家边走边用语音下指令（可能有同音错字、口语、中英混杂），你把指令编译成操作。\n只输出 JSONL：每行一个 JSON 对象，不要解释、不要代码块、不要多余文字。越短越快越好。\n\n## 操作\n' + OPS_DOC_ZH + '\n\n' + PLACE_DOC_ZH + '\n\n## 规则\n' + RULES_ZH + (YX.strict ? '\n- 当前开启了“真实物理”：引擎会拒绝不合物理的状态（人、车、房子飞起来或悬空；没人骑的自行车自己走；不是角色的东西走动）。玩家要这类效果时，用 say 说明真实物理开启时做不到，可以在设置里关闭。' : '\n- 当前关闭了“真实物理”：玩家明确要求时可以让东西飞起来或悬浮。') + '\n\n## 示例\n' + SHOTS_ZH + '\n\n## 物体目录（type 名称: 参数=默认[范围]）\n' + YX.catalog() + '\n\n## 当前场景\n' + YX.describe(v) + '\n\n## 最近的指令（从早到晚）\n' + hist + (doneMsgs.length ? '\n\n## 这句话里已经在本地执行完的部分（不要重复）\n' + doneMsgs.join('；') + (idl ? '\n这句话目前涉及的对象: ' + idl : '') + '\n还没处理的部分：「' + rest + '」' : '') + '\n\n## 玩家说\n「' + text + '」';
  }
  function parseLines(chunk) {
    const out = [];
    for (let line of chunk.split('\n')) {
      line = line.trim().replace(/^```\w*$/, '').replace(/^[-*]\s+/, '').replace(/^\d+[.)]\s+/, '').replace(/,\s*$/, '');
      if (!line || (line[0] !== '{' && line[0] !== '[')) continue;
      let v = null; try { v = JSON.parse(line); } catch (e) { try { v = JSON.parse(line.replace(/,\s*([}\]])/g, '$1').replace(/([{,]\s*)([a-zA-Z_]\w*)\s*:/g, '$1"$2":')); } catch (e2) { continue; } }
      if (Array.isArray(v)) { for (const x of v) if (x && typeof x === 'object') out.push(x); } else if (v && typeof v === 'object') out.push(v);
    }
    return out;
  }
  function streamer(onOp) { let eaten = 0; return (text, final) => { let end = final ? text.length : text.lastIndexOf('\n') + 1; if (end <= eaten) return; const chunk = text.slice(eaten, end); eaten = end; for (const op of parseLines(chunk)) onOp(op); }; }
  function failText(e) {
    const c = e && e.code;
    if (c === 'cancelled') return T('已取消', 'Cancelled');
    if (c === 'not_granted') { M.denied = true; return T('AI 没有获得授权，只能用本地指令', 'The AI was not allowed here, so only the built-in commands work'); }
    if (c === 'rate_limited') return T('请求太频繁或用量已到上限，稍后再试', 'Too many requests or the usage limit was reached. Try again shortly');
    if (c === 'session_expired') return T('登录已过期，请重新登录', 'Your session expired. Sign in again');
    if (c === 'sampling_disabled' || c === 'not_declared' || c === 'capability_disabled' || c === 'capability_removed') { M.sample = null; if (hooks.ui) hooks.ui(); return T('这个页面当前无法使用 AI', 'This page cannot use the AI right now'); }
    if (c === 'refused') return T('AI 拒绝了这句指令，换个说法试试', 'The AI declined that one. Try saying it another way');
    return T('连接 AI 时出了点问题，再说一遍试试', 'Could not reach the AI. Say it again');
  }
  const CARE_EN = '\n\n## Take your time with this one\nThe player has asked for this more than once and is still not satisfied (see the recent commands). Do not make another small tweak and do not output rethink. Work out what arrangement they actually want, look at the object and everything around it in the scene, and output the operations that put the thing AND its surroundings right (move, rotate, resize, set, remove, add as needed), then one short say line telling them what you rearranged.';
  const CARE_ZH = '\n\n## 这一次请仔细想\n玩家为这件事已经说了不止一次，仍然不满意（见“最近的指令”）。不要再做一次小调整，也不要输出 rethink。想清楚他到底要什么样的布置，看这个物体和它周围的一切，输出把这个东西“连同周围”一起摆对的操作（按需要 move、rotate、resize、set、remove、add），最后用一行 say 简短说明你重新安排了什么。';
  async function route(text, rest, ph, entry, doneMsgs, ops, big) {
    const ctl = new AbortController(); entry.abort = () => ctl.abort(); logUp(entry);
    let n = 0, first = 0, again = false;
    const onOp = (op) => { if (!big && String(op.op || '').toLowerCase() === 'rethink') { again = true; return; } if (again || String(op.op || '').toLowerCase() === 'rethink') return; if (!first) first = now(); n++; ops.push(op); const res = YX.exec(op, ph.ctx); if (res) { if (res.say) { entry.msgs.push(res.say); if (hooks.caption) hooks.caption(res.say); } else if (res.msg) entry.msgs.push(res.msg); if (res.ok === false) entry.warn = true; if (res.pending) entry.pending = true; } logUp(entry); };
    const feed = streamer(onOp);
    try {
      const tier = big ? (M.quality === 'max' ? 'complex' : 'default') : 'quick';
      const res = await M.sample(routePrompt(text, rest, ph.view, doneMsgs, ph.ctx.group) + (big ? (YX.lang === 'en' ? CARE_EN : CARE_ZH) : ''), { modelTier: tier, cache: false, signal: ctl.signal, onText: (u) => { try { feed(u.text, false); } catch (e) { console.warn(e); } } });
      feed(res.text, true); entry.model = res.modelTierApplied || tier;
      if (again && !n) { entry.msgs.push(T('这件事已经纠正过几次了：换更强的模型，连同周围一起重新安排…', 'This has been corrected a few times: handing it to the bigger model to rearrange it with its surroundings…')); logUp(entry); return route(text, rest, ph, entry, doneMsgs, ops, true); } // the small model judged that the player is struggling
      entry.abort = null; entry.first = first ? Math.round(first - entry.t0) : 0;
      if (!n) logEnd(entry, 'fail', T('没听懂这句，换个说法试试', 'Did not catch that. Try saying it another way')); else logEnd(entry, entry.warn && n === 1 ? 'fail' : 'ok');
    } catch (e) { entry.abort = null; if (e && e.text) { try { feed(e.text, true); } catch (x) {} } logEnd(entry, n ? 'ok' : 'fail', failText(e)); }
    finish(text, ops, entry.msgs, ph);
  }
  M.direct = function (text) { M.commit(text); };
  M.routePrompt = routePrompt;

  /* ================= tier 2 · inventing new generators ================= */
  const API_DOC_ZH = [
    '坐标：单位米，+Y 向上，物体正面朝 +Z，原点在物体底部中心（地面 y=0）。',
    'b.box(w,h,d,color,x,y,z,opt)        长方体，(x,y,z) 是底面中心',
    'b.cyl(rTop,rBottom,h,color,x,y,z,opt)  竖直圆柱/圆台，底面中心；opt.sides 控制棱数',
    'b.cone(r,h,color,x,y,z,opt)         圆锥，底面中心',
    'b.sphere(r,color,x,y,z,opt)         球，(x,y,z) 是球心；opt.sx/sy/sz 拉伸成椭球',
    'b.roof(w,h,d,color,x,y,z,opt)       人字屋顶（三棱柱），屋脊沿 x 方向，底面中心',
    'b.pyramid(w,h,d,color,x,y,z,opt)    四棱锥，底面中心',
    'b.torus(R,r,color,x,y,z,opt)        圆环，默认竖立（环面朝 z）；opt.rx:90 放平',
    'b.lathe([[r,y],…],color,x,y,z,opt)  绕 Y 轴的旋转体（花瓶、塔身、气球）',
    'b.extrude([[x,y],…],depth,color,x,y,z,opt)  XY 平面的多边形沿 z 挤出（居中）',
    'b.tube([[x,y,z],…],radius,color,opt) 沿曲线的管子（尾巴、藤蔓、扶手、缆绳）',
    'b.text(str,size,color,x,y,z,opt)    文字牌，朝 +Z；opt.bg 底色',
    'b.halo(size,color,x,y,z)            夜间光晕',
    'opt: {rx,ry,rz（度，绕自身底面中心）, sx,sy,sz, emissive:"#hex"（常亮）, glow:"#hex"（夜里才亮，窗和灯用它）, metal:0~1, rough:0~1, opacity:0~1, flat:true（低多边形棱面）, tex:"brick|wood|roof|stone|plaster|stripes"}',
    'b.group({x,y,z,rx,ry,rz,scale,anim}, () => { … })   子坐标系，可嵌套；带 anim 时整组绕这个原点运动',
    'anim: {spin:{axis:"y",speed:1.5}} | {swing:{axis:"z",deg:25,freq:2,phase:0}} | {bob:{amp:0.2,freq:1}} | {pulse:{amp:0.1,freq:1}} | {roll:{radius:0.3}}（车轮）。流水、喷泉、火焰这类东西形状要稳：不加 pulse，或最多 amp 0.03',
    'b.anchor("top",x,y,z)               别的东西可以放在这里',
    'rand() 返回 0~1 的确定性随机数；p 是参数对象；可以用 Math。',
  ].join('\n');
  const API_DOC_EN = [
    'Coordinates: metres, +Y up, the front of the object faces +Z, the origin is the centre of its base (ground is y=0).',
    'b.box(w,h,d,color,x,y,z,opt)        box; (x,y,z) is the centre of its bottom face',
    'b.cyl(rTop,rBottom,h,color,x,y,z,opt)  upright cylinder / frustum, bottom-centred; opt.sides sets the number of sides',
    'b.cone(r,h,color,x,y,z,opt)         cone, bottom-centred',
    'b.sphere(r,color,x,y,z,opt)         sphere; (x,y,z) is its centre; opt.sx/sy/sz stretch it into an ellipsoid',
    'b.roof(w,h,d,color,x,y,z,opt)       gable roof (triangular prism), ridge along x, bottom-centred',
    'b.pyramid(w,h,d,color,x,y,z,opt)    four-sided pyramid, bottom-centred',
    'b.torus(R,r,color,x,y,z,opt)        ring, upright by default (faces z); opt.rx:90 lays it flat',
    'b.lathe([[r,y],…],color,x,y,z,opt)  solid of revolution around Y (vase, tower body, balloon)',
    'b.extrude([[x,y],…],depth,color,x,y,z,opt)  polygon in the XY plane extruded along z (centred)',
    'b.tube([[x,y,z],…],radius,color,opt) tube along a curve (tail, vine, handrail, cable)',
    'b.text(str,size,color,x,y,z,opt)    text plate facing +Z; opt.bg background colour',
    'b.halo(size,color,x,y,z)            glow visible at night',
    'opt: {rx,ry,rz (degrees, about its own bottom centre), sx,sy,sz, emissive:"#hex" (always lit), glow:"#hex" (lit only at night: use for windows and lamps), metal:0..1, rough:0..1, opacity:0..1, flat:true (faceted low-poly), tex:"brick|wood|roof|stone|plaster|stripes"}',
    'b.group({x,y,z,rx,ry,rz,scale,anim}, () => { … })   child coordinate frame, nestable; with anim the whole group moves about this origin',
    'anim: {spin:{axis:"y",speed:1.5}} | {swing:{axis:"z",deg:25,freq:2,phase:0}} | {bob:{amp:0.2,freq:1}} | {pulse:{amp:0.1,freq:1}} | {roll:{radius:0.3}} (wheels). Running water, fountains and flames keep a steady shape: no pulse, or amp 0.03 at most',
    'b.anchor("top",x,y,z)               other things can be placed here',
    'rand() returns a deterministic random number in 0..1; p is the parameter object; Math is available.',
  ].join('\n');
  const EXAMPLE = (label) => '//@meta {"name":"lantern_tower","label":"' + label + '","size":[2.4,6,2.4],"motion":"none","params":{"height":{"d":6,"min":2,"max":30},"color":{"d":"#c8553d"},"lanterns":{"d":4,"min":1,"max":12,"int":true}},"dims":{"height":"height"}}\nconst H = p.height, k = H / 6;\nb.cyl(0.9*k, 1.1*k, 0.4*k, "#8f8a82", 0, 0, 0, {sides: 8, tex: "stone"});\nb.cyl(0.16*k, 0.22*k, H*0.86, "#5d4031", 0, 0.4*k, 0, {sides: 8});\nb.cone(1.2*k, 0.7*k, p.color, 0, H*0.9, 0, {sides: 8, flat: true});\nb.sphere(0.12*k, "#d9b45a", 0, H*0.9 + 0.78*k, 0, {metal: 0.7, rough: 0.3});\nfor (let i = 0; i < p.lanterns; i++) { const a = i / p.lanterns * Math.PI * 2, y = H*0.78 - (i % 2) * 0.5*k;\n  b.group({x: Math.cos(a)*0.85*k, y: y, z: Math.sin(a)*0.85*k, anim: {swing: {axis: "x", deg: 6, freq: 0.5, phase: i}}}, () => {\n    b.cyl(0.01, 0.01, 0.3*k, "#333333", 0, -0.02, 0);\n    b.sphere(0.2*k, p.color, 0, -0.5*k, 0, {sy: 1.2, glow: "#ffb060"});\n    b.cyl(0.08*k, 0.08*k, 0.05*k, "#d9b45a", 0, -0.3*k, 0); });\n}\nb.anchor("top", 0, H*0.9 + 0.9*k, 0);';
  function inventPrompt(job, draft, error) {
    const sz = job.size;
    if (YX.lang === 'en') return 'You are writing a procedural generator for a real-time 3D world engine: a piece of JavaScript that assembles an object from parts with the builder b.\n\nObject: ' + job.label + ' (identifier ' + job.name + ')\nDescription: ' + job.brief + '\nApproximate size in metres: width ' + sz[0] + ', height ' + sz[1] + ', depth ' + sz[2] + '; motion: ' + job.motion + (job.repNote ? '\n' + job.repNote : '') + '\n\n## Output format\nOutput code only: no explanation, no ``` fences. The first line must be a one-line metadata comment, followed by the function body (available variables: b, p, rand, Math):\n//@meta {"name":"' + job.name + '","label":"' + job.label + '","size":[w,h,d],"motion":"' + job.motion + '","params":{"paramName":{"d":default,"min":min,"max":max}, "color":{"d":"#hex"}},"dims":{"height":"the parameter that is the height","size":"the parameter that is the overall size"}}\n\n## Builder API\n' + API_DOC_EN + '\n\n## Requirements\n- Use 30 to 140 parts to make something recognisable at a glance, with detail: good proportions, a harmonious palette (3 to 5 main colours with lighter and darker shades) and small details (windows, doors, handles, rivets, stripes, trim). Not just a few boxes.\n- Derive every dimension from the parameters in p so the whole thing follows when a parameter changes; give 2 to 5 meaningful parameters, one of them the main colour "color".\n- Moving parts go in b.group({anim:…}) with the joint at the group origin. Animals and vehicles face +Z.\n- One statement per line; write the main masses first, then the details (the code is executed for preview while it is still being written).\n- Never let faces of different parts lie in the same plane (they flicker): windows, doors and trim stand at least 3 cm proud of the wall or are sunk into it; roofs and floor slabs overhang the walls or sit inside them, never flush with the wall tops.\n- No while loops; for loops must total fewer than 300 iterations; never touch window/document/self/fetch.\n- When motion is fly/hover/drift the origin is the centre of the object (it floats); otherwise the origin is on the ground at the base.\n\n## Example\n' + EXAMPLE('Lantern tower') + (draft ? '\n\n## This is a draft version\nWrite a clearly finer, better-looking version: keep the name and the parameter keys in //@meta (you may add parameters), fix proportions and anything unnatural, and add layers of detail.\n' + draft : '') + (error ? '\n\n## The previous code failed when it ran\nError: ' + error + '\nFix it and output the complete code again.' : '');
    return '你在为一个实时 3D 世界引擎写“程序化生成器”：一段 JavaScript，用构建器 b 把零件拼成物体。\n\n目标物体：' + job.label + '（英文名 ' + job.name + '）\n描述：' + job.brief + '\n大致尺寸（米）：宽 ' + sz[0] + '，高 ' + sz[1] + '，深 ' + sz[2] + '；运动方式：' + job.motion + (job.repNote ? '\n' + job.repNote : '') + '\n\n## 输出格式\n只输出代码，不要解释，不要 ``` 围栏。第一行必须是一行元数据注释，之后是函数体（可用变量 b, p, rand, Math）：\n//@meta {"name":"' + job.name + '","label":"' + job.label + '","size":[宽,高,深],"motion":"' + job.motion + '","params":{"参数名":{"d":默认值,"min":最小,"max":最大}, "color":{"d":"#hex"}},"dims":{"height":"对应高度的参数名","size":"对应整体大小的参数名"}}\n\n## 构建器 API\n' + API_DOC_ZH + '\n\n## 要求\n- 用 30~140 个零件拼出一眼能认出来、有细节的造型：比例协调，配色和谐（3~5 种主色加深浅变化），带小细节（窗、门、把手、铆钉、条纹、装饰）。不要只是几个方块。\n- 所有尺寸都从 p 的参数推导，改参数时整体会跟着变；给 2~5 个有意义的参数，其中一个主色 color。\n- 会动的部分用 b.group({anim:…})，关节放在 group 的原点。动物和车辆正面朝 +Z。\n- 每条语句写在一行内；先写主体大形，再加细节（代码是边写边执行预览的）。\n- 不同零件的面不要落在同一个平面上（会闪烁）：贴在墙上的窗、门、装饰要凸出或嵌入至少 3 厘米；屋顶和楼板要压过墙体或缩进去，不要和墙顶齐平。\n- 不要 while 循环，for 循环总次数 < 300；不要访问 window/document/self/fetch。\n- motion 为 fly/hover/drift 时原点是物体中心（悬空），否则原点在底部贴地。\n\n## 示例\n' + EXAMPLE('灯笼塔') + (draft ? '\n\n## 这是一个草稿版本\n请写一个明显更精细、更好看的版本：保持 //@meta 里的 name 和 params 键名不变（可以新增参数），修正比例和不自然的地方，增加细节层次。\n' + draft : '') + (error ? '\n\n## 上一次的代码运行出错\n错误：' + error + '\n请修正后重新输出完整代码。' : '');
  }
  function splitCode(text) {
    let t = String(text || '').replace(/^\s*```[a-zA-Z]*\s*\n?/, '').replace(/\n```[\s\S]*$/, '');
    let meta = null; const lines = t.split('\n'), body = [];
    for (const ln of lines) { const m = ln.match(/^\s*\/\/\s*@meta\s*(\{.*\})\s*$/); if (m && !meta) { try { meta = JSON.parse(m[1]); } catch (e) { try { meta = JSON.parse(m[1].replace(/,\s*([}\]])/g, '$1')); } catch (e2) {} } continue; } body.push(ln); }
    return { meta, code: body.join('\n').trim() };
  }
  function autoClose(code) {
    const cut = code.lastIndexOf('\n'); if (cut < 0) return null; const s = code.slice(0, cut), st = []; let i = 0, q = null;
    while (i < s.length) { const c = s[i], d = s[i + 1];
      if (q) { if (c === '\\') { i += 2; continue; } if (c === q) q = null; i++; continue; }
      if (c === '/' && d === '/') { const e = s.indexOf('\n', i); i = e < 0 ? s.length : e; continue; }
      if (c === '/' && d === '*') { const e = s.indexOf('*/', i + 2); i = e < 0 ? s.length : e + 2; continue; }
      if (c === '"' || c === "'" || c === '`') { q = c; i++; continue; }
      if (c === '(' || c === '[' || c === '{') st.push(c); else if (c === ')' || c === ']' || c === '}') st.pop();
      i++; }
    if (q) return null;
    return s + '\n' + st.reverse().map((c) => (c === '(' ? ')' : c === '[' ? ']' : '}')).join('');
  }
  function defaultsOf(meta) { const m = YX.normMeta(meta || {}), p = {}; for (const k in m.params) p[k] = m.params[k].d; return p; }
  const countParts = (n) => { let c = 0; const walk = (x) => { if (!x) return; if (x.ch) for (const k of x.ch) walk(k); else c++; }; walk(n); return c; };
  function showPreview(o, parts) {
    if (!o || o.dead || o.type !== '__pending') return;
    const r = YX.realize(parts.root); r.group.traverse((c) => { if (c.isSprite || (c.isMesh && c.userData.ownMat)) c.layers.set(2); });
    if (o.pv) { o.holder.remove(o.pv); YX.disposeGroup(o.pv); } else o.baseAnims = o.anims;
    o.pv = r.group; o.holder.add(r.group); o.anims = (o.baseAnims || []).concat(r.anims);
  }
  function morph(o, type, params) {
    if (!o || o.dead) return null;
    if (o.pv) { o.holder.remove(o.pv); YX.disposeGroup(o.pv); o.pv = null; }
    const def = G[type]; o.type = type; o.params = YX.fillParams(def, params || {}, YX.rng(o.seed)); o.psize = null; o.name = o.keepName || '';
    YX.rebuild(o); if (!o.attach) { o.motion = def.motion || 'none'; if (def.cls === 'sky' && o.y < 3) o.y = def.alt; o.ms = null; YX.initMotion(o); } YX.syncHolder(o);
    YX.fx.flash(o, 0xffffff, 1.1); if (o.y < 3) YX.fx.ring(o.x, o.z, Math.max(1.5, o.fr * 1.6), 0xe0533a); YX.sfx('born'); YX.markDirty();
    if (o.after && o.after.length) setTimeout(() => { try { const msgs = YX.afterBuilt(o); if (msgs.length && hooks.toast) hooks.toast(msgs.slice(0, 2).join(T('；', '; '))); if (hooks.ui) hooks.ui(); } catch (e) { console.warn(e); } }, 650); // what was asked of it while it was being built
    return o;
  }
  const workText = (job, n) => T('重造中 · ', 'Rebuilding · ') + job.label + (n ? T(' · 已写出 ' + n + ' 个零件', ' · ' + n + ' parts so far') : '');
  async function genCode(job, tier, opt) {
    opt = opt || {}; let lastTry = 0, busy = false, metaSeen = null;
    const onText = opt.preview ? (u) => {
      const t = now(); if (busy || t - lastTry < 420) return; const sc = splitCode(u.text); if (sc.meta && !metaSeen) { metaSeen = sc.meta; }
      const closed = autoClose(sc.code); if (!closed || closed.length < 30) return;
      lastTry = t; busy = true;
      YX.tryCode(closed, defaultsOf(metaSeen || { params: {} }), job.seed, 1200).then((parts) => { busy = false; if (job.repIds) { const n = countParts(parts.root); for (const id of job.repIds) { const x = W.objs.get(id); if (x && x.wk) x.wk.set(workText(job, n)); } } else showPreview(W.objs.get(job.phId), parts); }, () => { busy = false; });
    } : undefined;
    const res = await M.sample(inventPrompt(job, opt.draft, opt.error), { modelTier: tier, cache: false, signal: job.ctl.signal, onText });
    job.entry.model = (job.entry.model ? job.entry.model + ' + ' : '') + (res.modelTierApplied || tier);
    return splitCode(res.text);
  }
  async function validate(sc, job) { const meta = Object.assign({ name: job.name, label: job.label, size: job.size, motion: job.motion }, sc.meta || {}); meta.name = job.name; if (job.repIds) meta.motion = job.motion; if (!sc.code || sc.code.length < 20) throw new Error(T('没有生成代码', 'no code came back')); const parts = await YX.tryCode(sc.code, defaultsOf(meta), job.seed, 2500); if (!parts.root.ch.length) throw new Error(T('生成器没有产生任何零件', 'the generator made no parts')); return meta; }
  let inventRunning = 0; const waiters = [];
  function slot() { if (inventRunning < 2) { inventRunning++; return Promise.resolve(); } return new Promise((r) => waiters.push(r)); }
  function release() { const w = waiters.shift(); if (w) w(); else inventRunning--; }
  const endWork = (job) => { if (job.repIds) for (const id of job.repIds) { const x = W.objs.get(id); if (x) { if (x.wk) x.wk.stop(); x.hold = false; } } };
  async function inventRun(job) {
    const entry = job.entry; await slot();
    try {
      const q = M.quality, first = q === 'fine' ? 'default' : 'quick';
      let sc = await genCode(job, first, { preview: true }), meta;
      try { meta = await validate(sc, job); }
      catch (err) { entry.msgs = [T('修正中…', 'Fixing it…')]; logUp(entry); sc = await genCode(job, first, { preview: false, error: String(err.message || err).slice(0, 200), draft: sc.code.slice(0, 6000) }); meta = await validate(sc, job); }
      const type = YX.registerCustom(meta, sc.code); let o = null;
      if (job.repIds) {
        for (const id of job.repIds) { const x = W.objs.get(id); if (!x) continue; if (x.wk) x.wk.stop(); x.hold = false; YX.become(x, type, job.params, {}); YX.fx.flash(x, 0xffffff, 1.1); if (x.y < 3) YX.fx.ring(x.x, x.z, Math.max(1.5, x.fr * 1.6), 0xe0533a); o = o || x; }
        YX.sfx('born'); if (o) YX.tween(0.6, () => {}, { done: () => YX.shove(o) });
      } else {
        o = morph(W.objs.get(job.phId), type, job.params);
        for (const x of W.objs.values()) if (x.type === '__pending' && x.wantType === job.name && x.id !== job.phId) morph(x, type, job.params);
      }
      const made = () => (job.repIds ? T('重造完成 ', 'Rebuilt as ') : T('造好了 ', 'Built ')) + (o ? YX.lab(o) : job.label);
      entry.msgs = [made()]; entry.first = Math.round(now() - entry.t0); logUp(entry);
      if (q === 'refine' || q === 'max') {
        entry.msgs.push(T('正在精修…', 'Refining…')); logUp(entry);
        const marks = []; for (const x of W.objs.values()) if (x.type === type && !x.wk) { try { marks.push(YX.fx.work(x, T('精修中…', 'Refining…'))); } catch (e) {} } // the first version stands, visibly still being worked on
        try { const sc2 = await genCode(job, q === 'max' ? 'complex' : 'default', { preview: false, draft: sc.code.slice(0, 9000) }); const meta2 = await validate(sc2, job); const m2 = Object.assign({}, meta2, { name: type }); YX.registerCustom(m2, sc2.code); for (const x of W.objs.values()) if (x.type === type) { x.params = YX.fillParams(G[type], x.params, null, null); YX.rebuild(x, { grow: true }); YX.fx.flash(x, 0xffffff, 1); } YX.sfx('born'); entry.msgs = [made() + T('（已精修）', ' (refined)')]; }
        catch (err) { entry.msgs = [made() + (err && err.code === 'cancelled' ? '' : T('（精修没成功，保留初版）', ' (the refine pass failed, keeping the first version)'))]; }
        for (const mk of marks) { try { mk.stop(); } catch (e) {} }
      }
      logEnd(entry, 'ok');
    } catch (e) {
      endWork(job);
      const o = W.objs.get(job.phId); if (o && o.type === '__pending') YX.removeObj(o, { animate: true });
      logEnd(entry, 'fail', (e && e.code ? failText(e) : T('没能造出「' + job.label + '」：', 'Could not build “' + job.label + '”: ') + String((e && e.message) || e).slice(0, 80)) + (job.repIds ? T('；原来的保持不变', '. The original is unchanged') : ''));
    } finally { release(); M.active.delete(job); }
  }
  /* An invented object is asked to move in a way its declared nature does not allow (a hand-built car told to drive).
     What it can do was a guess made when it was built, so ask once, about the real thing, instead of refusing. */
  hooks.judge = async function (o, m) {
    const def = YX.defOf(o), C = YX.custom[o.type], say = (t) => { if (hooks.toast) hooks.toast(t); };
    const verbZ = { fly: '飞', hover: '悬浮', drift: '飘', drive: '行驶', wander: '走动' }[m], verbE = { fly: 'fly', hover: 'float', drift: 'drift', drive: 'drive', wander: 'walk' }[m];
    const no = () => say(T(def.label + ' 做不到“' + verbZ + '”（真实物理已开启，可在设置里关闭）', def.label + ' cannot ' + verbE + ' (realistic physics is on; turn it off in Settings)'));
    if (!M.sample || !C || !def) return no();
    const ask = { drive: 'drive along a road under its own power, the way a car, truck, bus, tram or motorbike does', fly: 'fly through the air under its own power', hover: 'float in the air by itself', drift: 'drift across the sky', wander: 'move around on the ground by itself, the way an animal, a person or a robot does' }[m];
    let mark = null; try { mark = YX.fx.work(o, T('想一想…', 'Thinking…')); } catch (e) {}
    let yes = false;
    try { const res = await M.sample('A player built an object in a 3D world and named it: "' + def.label + '" (identifier ' + o.type + ', about ' + o.size.map((v) => v.toFixed(1)).join(' x ') + ' m).\nThink of the real thing that name stands for. Can it ' + ask + '?\nAnswer with one word: yes or no.', { modelTier: 'quick', cache: false }); yes = /^\W*(yes|是|能|可以)/i.test(String((res && res.text) || '')); }
    catch (e) { if (mark && mark.stop) mark.stop(); return say(T('没能确认 ' + def.label + ' 能不能' + verbZ + '，再说一次试试', 'Could not check whether ' + def.label + ' can ' + verbE + '. Say it again to retry')); }
    if (mark && mark.stop) mark.stop();
    if (!W.objs.get(o.id) || o.dead) return;
    if (!yes) { (G[o.type].cant = G[o.type].cant || {})[m] = true; return no(); }
    YX.reclass(o.type, m);
    const r = YX.exec({ op: 'set', id: '#' + o.id, params: { motion: m } }, YX.newCtx(YX.viewNow()));
    say(r && r.msg ? r.msg : T(def.label + ' 动起来了', def.label + ' is moving')); if (hooks.ui) hooks.ui();
  };
  hooks.invent = function (op, ctx) {
    if (!M.sample) return YX.needAI('build'), { ok: false, msg: T('造新物体需要 AI，目前没有连接', 'Building something new needs the AI, which is not connected') };
    const reps = op.replace != null ? ctx.many(op.replace).filter((o) => o.type !== '__pending' && !o.hold) : [];
    const raw = String(op.type || op.label || 'thing'), ft = YX.findType(raw) || YX.findType(op.label || '');
    if (ft) return reps.length ? YX.OPS.become(Object.assign({}, op, { op: 'become', id: reps.map((o) => '#' + o.id), type: ft.type }), ctx) : YX.OPS.add(Object.assign({}, op, { op: 'add', type: ft.type }), ctx);
    let name = raw.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);
    const lbl0 = String(op.label || raw).replace(/_/g, ' ').trim().toLowerCase(), live = reps.length ? null : Array.from(M.active).find((j) => !j.repIds && j.phId != null && (j.name === name || String(j.label || '').trim().toLowerCase() === lbl0)) || null; // the very thing is being built right now: more of it are more places for it, not a second build
    if (!name || G[name]) name = 'thing_' + (Date.now() % 100000).toString(36);
    const label = live ? live.label : String(op.label || raw).replace(/_/g, ' ').slice(0, 28), valid = ['none', 'fly', 'wander', 'drive', 'drift', 'hover'];
    const given = Array.isArray(op.size) && op.size.length >= 3 ? op.size.slice(0, 3).map((v) => clamp(+v || 2, 0.1, 300)) : null;
    const params = op.params && typeof op.params === 'object' ? op.params : {}, brief = String(op.brief || label).slice(0, 400);
    if (reps.length) { // rebuild an existing object where it stands: it stays visible, framed and scanned, until the new model is ready
      const t0 = reps[0], d0 = YX.defOf(t0) || {}, r1 = (v) => Math.round(v * 10) / 10, size = given || [r1(t0.size[0]), r1(t0.size[1]), r1(t0.size[2])];
      const motion = valid.includes(op.motion) ? op.motion : t0.motion === 'goto' || !valid.includes(d0.motion) ? 'none' : d0.motion;
      const entry = logStart(T('重造：', 'Rebuild: ') + YX.lab(t0) + ' → ' + label, 'invent');
      const job = { name, label, brief, size, motion, phId: null, repIds: reps.map((o) => o.id), params, seed: t0.seed, ctl: new AbortController(), entry,
        repNote: T('它要原位替换场景里已有的一个「' + YX.labelOf(d0) + '」（约 ' + r1(t0.size[0]) + '×' + r1(t0.size[1]) + '×' + r1(t0.size[2]) + ' 米，宽×高×深）：保持相近的占地和朝向（正面朝 +Z），让人一眼看出是它变成的。', 'It replaces an existing ' + YX.labelOf(d0) + ' in the scene (about ' + r1(t0.size[0]) + ' x ' + r1(t0.size[1]) + ' x ' + r1(t0.size[2]) + ' m, width x height x depth): keep a similar footprint and the same orientation (front toward +Z) so it reads as that object transformed.') };
      for (const o of reps) { o.hold = true; YX.fx.work(o, workText(job, 0)); ctx.changed.push(o); if (!ctx.group.includes(o.id)) ctx.group.push(o.id); }
      W.focusId = t0.id; ctx.view.focusId = t0.id;
      entry.abort = () => job.ctl.abort(); logUp(entry); M.active.add(job); inventRun(job); YX.sfx('edit');
      return { ok: true, pending: true, msg: T('开始把 ' + YX.lab(t0) + ' 重造成「' + label + '」，原物体先留在原地', 'Rebuilding ' + YX.lab(t0) + ' as “' + label + '”. It stays in place until the new one is ready') };
    }
    const size = live ? live.size : given || [3, 3, 3], P0 = op.place && typeof op.place === 'object' ? op.place : null, inAir = op.place === 'sky' || (P0 && (P0.above != null || +P0.height > 2.5));
    const motion = live ? live.motion : valid.includes(op.motion) && !(op.motion === 'none' && inAir) ? op.motion : inAir ? 'hover' : 'none', sky = motion === 'fly' || motion === 'drift' || motion === 'hover'; // asked for in the air: it has to be something that floats
    const fake = { face: 'me', cls: sky ? 'sky' : motion === 'drive' ? 'vehicle' : 'prim', alt: Math.max(8, size[1] * 2 + 6), motion };
    const n = clamp(Math.round(+op.count || 1), 1, 6); let firstO = null, prev = null; const made = [];
    for (let i = 0; i < n; i++) {
      const pl = YX.resolvePlace(i === 0 ? (op.place == null && motion === 'drive' && YX.roads().length ? { road: 'ahead', lane: 'near' } : op.place) : { near: prev.id, side: 'any', gap: 1 }, ctx, { def: fake, fr: Math.max(0.3, Math.hypot(size[0], size[2]) * 0.42), fd: size[2] }); // something that drives is put in a lane of the road ahead, like any car
      const o = YX.spawn({ type: '__pending', x: pl.x, z: pl.z, y: pl.y || 0, rot: pl.rot != null ? pl.rot : Math.atan2(ctx.view.x - pl.x, ctx.view.z - pl.z), psize: size, name: label }, { animate: true });
      o.wantType = live ? live.name : name; o.keepName = op.name || ''; made.push(o.id); if (!ctx.group.includes(o.id)) ctx.group.push(o.id);
      if (pl.attach) { const p = W.objs.get(pl.attach.to); if (p) YX.attachTo(o, p, pl.attach.anchor); }
      if (i === 0) firstO = o; prev = o;
    }
    if (typeof op.id === 'string') ctx.alias.set(op.id.trim(), made.length > 1 ? made : made[0]);
    ctx.changed.push(firstO); W.focusId = firstO.id; ctx.view.focusId = firstO.id;
    if (live) { YX.sfx('add'); return { ok: true, pending: true, msg: T('再来 ' + made.length + ' 个「' + label + '」：它正在生成，造好后一起出现', made.length + ' more “' + label + '”: it is being built now, and they appear together when it is done') }; }
    const entry = logStart(T('造一个新物体：', 'Build something new: ') + label, 'invent');
    const job = { name, label, brief, size, motion, phId: firstO.id, params, seed: firstO.seed, ctl: new AbortController(), entry };
    entry.abort = () => job.ctl.abort(); logUp(entry);
    M.active.add(job); inventRun(job);
    YX.sfx('add');
    return { ok: true, pending: true, msg: T('开始造「' + label + '」', 'Building “' + label + '”') };
  };

  /* ================= tier 2 · planning a whole scene ================= */
  function planPrompt(brief, clear, v) {
    if (YX.lang === 'en') return 'You are the set designer of a 3D world. Design a complete, good-looking, layered scene from the description and output JSONL operations (one JSON object per line; no explanations, no code fences). The engine builds while it receives, so output the environment and the big pieces first, then the details.\n\n## Description\n' + brief + '\n\n## Coordinates and conventions\n- Metres. x points east, z points south. ' + (clear ? 'The world has been cleared; the player stands at (0, 18) facing north (toward -z). Lay the scene out within x in [-90,90] and z in [-110,10], with its visual centre near (0,-25); keep the ground under the player and the 12 m straight ahead clear.' : 'Keep the existing world and extend it on open ground in front of the player (see the scene below for the player position and facing).') + '\n- Positions are "place":{"at":[x,z]} (the engine avoids overlaps by itself). Only things that fly or float (cloud, balloon, bird, or an invent with motion fly/hover/drift) may also get "height"; everything else has weight and stands on the ground.\n- rot (degrees) is optional: 0 = front faces south (+z), 90 = east, 180 = north, 270 = west. Leave rot out for buildings along a road and the engine turns them toward the nearest road.\n- A road\'s length runs east-west; for a north-south road write "rot":90. Output roads before the buildings beside them.\n\n## Available operations\n{"op":"env","time":…,"weather":…,"ground":"grass|sand|snow|dirt|stone","light":…,"look":…}\n{"op":"add","type":T,"params":{…},"place":{"at":[x,z]},"rot":0,"scale":1,"name":""}\n{"op":"scatter","type":T,"params":{…},"count":12,"radius":15,"place":{"at":[x,z]}}\n{"op":"row","type":T,"count":8,"spacing":8,"place":{"at":[x,z]},"dir":"right"}\n{"op":"crowd","count":6,"activity":"chat|watch|queue|walk|play|sit|wave","place":{"at":[x,z]}}\n{"op":"invent","type":"english_snake_case","label":"Short name","brief":"look and details, 15-40 words","size":[w,h,d],"motion":"none|fly|wander|drive|drift|hover","place":{"at":[x,z]},"count":1}   signature objects the catalog lacks, at most 3 kinds\nDo not use {"op":"shot"}.\n\n## Catalog\n' + YX.catalog() + (clear ? '' : '\n\n## Current scene\n' + YX.describe(v)) + '\n\n## Requirements\n- Output 45 to 90 lines. Include: the environment (env), a skeleton of roads or water, buildings in groups, vegetation in patches (scatter), street furniture, things that move (people, cars, birds, clouds), and 1 to 3 landmarks that make the scene memorable.\n- Leave sensible gaps between things; a building sits about road width / 2 + 4 + building depth / 2 from the road centre line.\n- Use parameters and colours to carry the style (a seaside town: white walls, blue roofs, sand, palm trees, water).';
    return '你是 3D 世界的布景师。根据描述设计一个完整、好看、有层次的场景，输出 JSONL 操作（每行一个 JSON，不要解释，不要代码块）。引擎会边收边搭，所以先输出环境和大件，再输出细节。\n\n## 描述\n' + brief + '\n\n## 坐标与约定\n- 单位米。x 向东，z 向南。' + (clear ? '世界已清空，玩家站在 (0, 18)，面朝北（-z 方向）。把主体布置在 x∈[-90,90]、z∈[-110,10] 的范围内，视觉中心在 (0,-25) 附近；玩家脚下和正前方 12 米内保持空旷。' : '保留现有世界，在玩家前方的空地上扩建（玩家位置和朝向见下方场景）。') + '\n- 位置用 "place":{"at":[x,z]}（引擎会自动避让重叠）。只有会飞或悬浮的东西（cloud、balloon、bird，或 motion 为 fly/hover/drift 的 invent）才能加 "height"；其它东西有重力，都落在地面上。\n- rot（度）可选：0=正面朝南(+z)，90=朝东，180=朝北，270=朝西。建筑沿路摆放时省略 rot，引擎会让它朝向最近的路。\n- road 的 length 沿东西向；南北向的路写 "rot":90。路要先于路边建筑输出。\n\n## 可用操作\n{"op":"env","time":…,"weather":…,"ground":"grass|sand|snow|dirt|stone","light":…,"look":…}\n{"op":"add","type":T,"params":{…},"place":{"at":[x,z]},"rot":0,"scale":1,"name":""}\n{"op":"scatter","type":T,"params":{…},"count":12,"radius":15,"place":{"at":[x,z]}}\n{"op":"row","type":T,"count":8,"spacing":8,"place":{"at":[x,z]},"dir":"right"}\n{"op":"crowd","count":6,"activity":"chat|watch|queue|walk|play|sit|wave","place":{"at":[x,z]}}\n{"op":"invent","type":"英文小写名","label":"中文名","brief":"外观细节 40~100 字","size":[宽,高,深],"motion":"none|fly|wander|drive|drift|hover","place":{"at":[x,z]},"count":1}   目录里没有的标志性物体，最多 3 种\n{"op":"shot","save":true,"name":"…"} 不要用。\n\n## 物体目录\n' + YX.catalog() + (clear ? '' : '\n\n## 当前场景\n' + YX.describe(v)) + '\n\n## 要求\n- 输出 45~90 行。要有：环境(env)、道路或水面等骨架、成组的建筑、成片的植被(scatter)、街道小物、会动的东西（人、车、鸟、云）、1~3 个让人记住这个场景的标志物。\n- 物体之间留出合理间距；建筑离路中心线约 路宽/2 + 4 + 建筑进深/2。\n- 善用参数和颜色体现风格（比如海边小镇用白墙蓝顶、沙地、棕榈树、water）。';
  }
  hooks.plan = function (op, ctx) {
    if (!M.sample) return YX.needAI('scene'), { ok: false, msg: T('规划场景需要 AI，目前没有连接', 'Planning a scene needs the AI, which is not connected') };
    const brief = String(op.brief || '').slice(0, 600); if (!brief) return { ok: false, msg: T('没有场景描述', 'No scene description') };
    const clear = op.clear !== false, entry = logStart(T('造场景：', 'Build a scene: ') + brief, 'plan'), ctl = new AbortController(); entry.abort = () => ctl.abort(); logUp(entry);
    YX.pushUndo(); ctx.undo = true;
    if (clear) { YX.cineStop(); YX.clearWorld(); W.shots = []; W.group = []; W.people = []; Object.assign(W.player, { x: 0, y: 1.7, z: 18, yaw: 0, pitch: 0.02, fly: false, lens: 0, vx: 0, vz: 0 }); YX.setEnv({ time: 15.5, weather: 'clear', ground: 'grass', light: 'normal', look: 'none', az: 0, flow: 0 }); if (hooks.ui) hooks.ui(); }
    const pctx = YX.newCtx(YX.viewNow()); pctx.undo = true; let n = 0;
    const steps = (k) => T('已搭建 ' + k + ' 步', k + ' steps built');
    const feed = streamer((o) => { const k = String(o.op || '').toLowerCase(); if (['plan', 'clear', 'undo', 'shot', 'cam', 'goto', 'remove', 'delete'].includes(k)) return; if (o.place && Array.isArray(o.place.at) && o.type && G[String(o.type).toLowerCase()] && G[String(o.type).toLowerCase()].cls === 'ground') o.place.exact = true; const res = YX.exec(o, pctx); if (res && res.ok) { n++; entry.msgs = [steps(n)]; logUp(entry); } });
    (async () => {
      try { const res = await M.sample(planPrompt(brief, clear, pctx.view), { modelTier: M.quality === 'max' ? 'complex' : 'default', cache: false, signal: ctl.signal, onText: (u) => { try { feed(u.text, false); } catch (e) { console.warn(e); } } }); feed(res.text, true); entry.model = res.modelTierApplied || 'default'; YX.recomputeRoads(); entry.msgs = [T('场景搭好了，共 ' + n + ' 步', 'Scene built in ' + n + ' steps')]; logEnd(entry, n ? 'ok' : 'fail'); YX.sfx('born'); }
      catch (e) { if (e && e.text) { try { feed(e.text, true); } catch (x) {} } YX.recomputeRoads(); logEnd(entry, n ? 'ok' : 'fail', failText(e)); }
    })();
    return { ok: true, pending: true, msg: T('开始规划场景', 'Planning the scene') };
  };

  /* ---------- context-aware suggestion (placeholder + Tab) ---------- */
  M.suggest = function () {
    const o = W.aim, en = YX.lang === 'en';
    if (!o) return en ? 'Add a cherry tree here' : '在这里加一棵樱花树';
    const d = YX.defOf(o), n = en ? YX.labelOf(d).toLowerCase() : d.label;
    if (d.cls === 'building') return W.time % 9 < 4.5 ? (en ? 'Make this ' + n + ' a bit taller' : '把这个' + n + '变高一点') : en ? 'Put a bird on the roof of this ' + n : '在' + n + '顶上加一只鸟';
    if (o.type === 'road') return en ? 'Put a café across the street' : '在马路对面放一个咖啡馆';
    if (o.type === 'person') return W.time % 9 < 4.5 ? (en ? 'Make him jump' : '让他跳两下') : en ? 'Have him walk to the bench and sit' : '让他走到长椅那里坐下';
    if (o.type === 'tree') return en ? 'Turn this tree into a cherry tree' : '把这棵树变成樱花树';
    if (o.type === 'bus') return en ? 'Turn this bus into a double decker bus' : '把这辆巴士变成双层巴士';
    if (d.cls === 'vehicle') return en ? 'Make this ' + n + ' yellow' : '把这辆' + n + '变成黄色';
    if (o.type === 'bench') return en ? 'Put a cat on the bench' : '在长椅上放一只猫';
    return en ? 'Make this ' + n + ' a bit bigger' : '把这个' + n + '变大一点';
  };
  M.setSample = function (fn) { M.sample = fn || null; M.denied = false; };
  /* something that was said could not be done for want of the AI. The home of the page may have a way to get it (host.access): it is told what was said,
     so the sentence can run by itself once the AI is there. `what` names the kind of thing: 'say', 'build', 'scene', 'shot', 'path', 'talk'. */
  YX.needAI = function (what, text) { try { if (hooks.needAI) hooks.needAI({ what: what || 'say', text: String(text != null ? text : M.said || '') }); } catch (e) {} };
})();
