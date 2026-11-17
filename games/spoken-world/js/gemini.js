/* Spoken World on the open web: the Gemini host.
   In the Claude artifact the page's AI, voice input and file saving come from Claude. Here they come from the viewer's own Gemini API key:
   the AI is Gemini 4 Hydrogen, voice input is Gemini 3.5 Transcribe Live, and a recorded clip can be turned into real footage with Gemini Omni.
   The key stays in this browser and is sent only to Google's Gemini API (generativelanguage.googleapis.com).
   This file registers a host (window.SW_HOST, see app/js/host.js for what a host is). It must load before host.js. */
(function () {
  'use strict';
  const API = 'https://generativelanguage.googleapis.com/v1beta';
  const WS = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
  // the page asks for one of three tiers; each is a model and a thinking level. Measured on the page's own prompts (Nov 2026): Hydrogen at low
  // thinking gives the same valid answers and equally good objects as at medium, three to four times faster (a shot plan in ~6 s instead of
  // ~22-30 s, past the 22 s the shot designer waits). Medium is kept for the highest quality setting only.
  const TEXT = { quick: ['gemini-4-hydrogen', 'low'], default: ['gemini-4-hydrogen', 'low'], complex: ['gemini-4-hydrogen', 'medium'] };
  // some jobs go to another model whatever the tier. A simple camera move: Hydrogen cannot answer without thinking first (6-10 s, against under 2 s on Claude),
  // Flash-Lite plans one familiar move in about a second. Takes with several beats stay on Hydrogen: there Flash-Lite lost the subject or mixed up axes.
  const TASK = { shot: ['gemini-3.5-flash-lite', 'low'] };
  const LIVE = 'gemini-3.5-transcribe-live';
  const OMNI = ['gemini-omni-1.2-flash', 'gemini-omni-1.1-flash']; // the newest the key can use
  const SK = 'sw.gemini.key';
  const zh = (() => { try { const p = JSON.parse(localStorage.getItem('yanchu.prefs.v2') || '{}'); if (p.ui === 'zh' || p.ui === 'en') return p.ui === 'zh'; } catch (e) {} return /^zh/i.test(navigator.language || ''); })();
  const T = (a, b) => (zh ? a : b);
  const COUNTED = location.hostname === 'spoken-world.vercel.app'; // the one place visits are counted (see countVisits)

  /* ---------- the key ---------- */
  let key = '';
  try { key = sessionStorage.getItem(SK) || localStorage.getItem(SK) || ''; } catch (e) {}
  let keyOk = null; const keyReady = new Promise((r) => { keyOk = r; });
  if (key) keyOk(key);
  function forget() { key = ''; try { sessionStorage.removeItem(SK); localStorage.removeItem(SK); } catch (e) {} }
  async function check(k) { // a call that costs nothing: is this key good for the model the world runs on?
    const r = await fetch(API + '/models/' + TEXT.default[0], { headers: { 'x-goog-api-key': k } });
    if (r.ok) return '';
    let m = ''; try { const j = await r.json(); m = (j.error && j.error.message) || ''; } catch (e) {}
    if (r.status === 400 || r.status === 401 || r.status === 403) return T('这个 key 用不了：', 'This key does not work: ') + (m || r.status);
    if (r.status === 404) return T('这个 key 还用不了 Gemini 4 Hydrogen。', 'This key cannot use Gemini 4 Hydrogen yet.');
    return T('暂时连不上 Gemini：', 'Gemini cannot be reached right now: ') + (m || r.status);
  }

  /* ---------- errors, in the shape the page expects ---------- */
  async function apiErr(r) {
    let j = null; try { j = await r.json(); } catch (e) {}
    const m = (j && j.error && j.error.message) || ('HTTP ' + r.status), st = (j && j.error && j.error.status) || '';
    const bad = r.status === 401 || r.status === 403 || (r.status === 400 && /api key|API_KEY/i.test(m + st));
    if (bad) { forget(); setTimeout(() => askKey(T('这个 key 不能用了，请换一个。', 'This key stopped working. Please enter another.')), 0); }
    return { code: r.status === 429 ? 'rate_limited' : bad ? 'not_granted' : r.status === 404 ? 'model_unavailable' : 'model_error', status: r.status, message: m };
  }

  /* ---------- the AI: the page's sample(input, opts) on Gemini, streamed ----------
     Every call's token counts (prompt, cached, answer, thinking) and timing are kept in SW_HOST.usage, so what a session costs can be read off. */
  const usage = [];
  async function sample(input, opts) {
    const t0 = performance.now(); try { return await sample1(input, opts, t0); } catch (e) { usage.push({ tier: (opts && opts.modelTier) || 'default', error: (e && (e.name === 'AbortError' ? 'aborted' : e.code || e.message)) || String(e), ms: Math.round(performance.now() - t0) }); throw e; }
  }
  async function sample1(input, opts, t0) {
    opts = opts || {}; await keyReady;
    const [model, level] = TASK[opts.task] || TEXT[opts.modelTier] || TEXT.default;
    const contents = typeof input === 'string' ? [{ role: 'user', parts: [{ text: input }] }] : (input || []).map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content) }] }));
    const body = { contents, generationConfig: { thinkingConfig: { thinkingLevel: level }, maxOutputTokens: 32768 } };
    const r = await fetch(API + '/models/' + model + ':streamGenerateContent?alt=sse', { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body), signal: opts.signal });
    if (!r.ok) throw await apiErr(r);
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', text = '', fin = '', blocked = '', um = null, ttft = 0;
    const take = (ev) => {
      for (const line of ev.split('\n')) {
        if (!line.startsWith('data:')) continue; let j; try { j = JSON.parse(line.slice(5).trim()); } catch (e) { continue; }
        if (j.promptFeedback && j.promptFeedback.blockReason) blocked = j.promptFeedback.blockReason; if (j.usageMetadata) um = j.usageMetadata;
        const c = j.candidates && j.candidates[0]; if (!c) continue; if (c.finishReason) fin = c.finishReason;
        let delta = ''; for (const p of (c.content && c.content.parts) || []) if (p.text && !p.thought) delta += p.text;
        if (delta) { if (!ttft) ttft = performance.now() - t0; text += delta; if (opts.onText) try { opts.onText({ text, delta }); } catch (e) { console.warn(e); } }
      }
    };
    for (;;) {
      const { value, done } = await rd.read(); if (done) break;
      buf += dec.decode(value, { stream: true }).replace(/\r\n/g, '\n'); let i;
      while ((i = buf.indexOf('\n\n')) >= 0) { take(buf.slice(0, i)); buf = buf.slice(i + 2); }
    }
    if (buf.trim()) take(buf);
    usage.push({ tier: opts.modelTier || 'default', model, level, in: (um && um.promptTokenCount) || 0, cached: (um && um.cachedContentTokenCount) || 0, out: (um && um.candidatesTokenCount) || 0, thoughts: (um && um.thoughtsTokenCount) || 0, ttft: Math.round(ttft), ms: Math.round(performance.now() - t0) });
    if (blocked && !text) throw { code: 'refused', message: blocked };
    return { text, truncated: fin === 'MAX_TOKENS', modelTierApplied: model + ' · ' + level };
  }

  /* ---------- voice: Gemini 3.5 Transcribe Live, behind the page's dictation interface ----------
     start() opens the microphone and a live session; audio goes out as 16 kHz PCM in 100 ms pieces. Partial hypotheses arrive while you speak,
     a final text when you pause. stop() closes the microphone, tells the session the audio has ended and waits for the last words. */
  function makeDict() {
    const L = { p: [], f: [], s: [] }, emit = (k, e) => { for (const fn of L[k]) try { fn(e); } catch (x) { console.warn(x); } };
    const PROC = 'class P extends AudioWorkletProcessor{process(i){const c=i[0]&&i[0][0];if(c)this.port.postMessage(c.slice(0));return true}}registerProcessor("sw-pcm",P);';
    let sess = null;
    const cjk = (s) => /^[⺀-鿿가-힯　-〿＀-￯]/.test(s);
    function b64(i16) { const u8 = new Uint8Array(i16.buffer); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
    function send(s, m) { if (s.closed) return; if (s.ready && s.ws && s.ws.readyState === 1) { try { s.ws.send(JSON.stringify(m)); } catch (e) {} } else if (!s.ready) s.queue.push(m); }
    function mic(s) { // 16 kHz mono PCM16, sent every 100 ms
      const rate = s.ac.sampleRate, step = rate / 16000; let acc = [], pos = 0;
      s.push = (f) => { // resample by linear interpolation when the device will not run at 16 kHz
        if (step === 1) { for (let i = 0; i < f.length; i++) acc.push(f[i]); }
        else { for (; pos < f.length - 1; pos += step) { const i = Math.floor(pos), t = pos - i; acc.push(f[i] * (1 - t) + f[i + 1] * t); } pos -= f.length; }
        while (acc.length >= 1600) { const part = acc.splice(0, 1600), o = new Int16Array(1600); for (let i = 0; i < 1600; i++) { const v = Math.max(-1, Math.min(1, part[i])); o[i] = v < 0 ? v * 0x8000 : v * 0x7fff; } send(s, { realtimeInput: { audio: { data: b64(o), mimeType: 'audio/pcm;rate=16000' } } }); }
      };
      s.flush = () => { if (!acc.length) return; const o = new Int16Array(acc.length); acc.forEach((v, i) => { v = Math.max(-1, Math.min(1, v)); o[i] = v < 0 ? v * 0x8000 : v * 0x7fff; }); acc = []; send(s, { realtimeInput: { audio: { data: b64(o), mimeType: 'audio/pcm;rate=16000' } } }); };
    }
    function open(s, lang) {
      s.ws = new WebSocket(WS + '?key=' + encodeURIComponent(key));
      s.ws.onopen = () => s.ws.send(JSON.stringify({ setup: { model: 'models/' + LIVE, generationConfig: { responseModalities: ['TEXT'] }, inputAudioTranscription: { languageCodes: lang ? [lang] : [] } } }));
      s.ws.onmessage = async (ev) => {
        let m; try { m = JSON.parse(typeof ev.data === 'string' ? ev.data : await ev.data.text()); } catch (e) { return; }
        s.lastMsg = performance.now();
        if (m.setupComplete) { s.ready = true; const q = s.queue; s.queue = []; for (const x of q) send(s, x); return; }
        const sc = m.serverContent; if (!sc || s !== sess) return;
        const it = sc.interimInputTranscription && sc.interimInputTranscription.text, ft = sc.inputTranscription && sc.inputTranscription.text;
        if (it != null && it !== '') { s.partial = it; emit('p', { text: (s.finals && !cjk(it) ? ' ' : '') + it }); }
        if (ft != null && ft.trim()) { s.partial = ''; emit('f', { text: (s.finals && !cjk(ft) ? ' ' : '') + ft.trim() }); s.finals++; }
      };
      s.ws.onclose = (ev) => { s.closed = true; if (s === sess && !s.stopping) { const long = performance.now() - s.t0 > 9.5 * 60e3; end(s); emit('s', { state: 'idle', reason: long ? 'time_limit' : 'error' }); if (ev.code !== 1000) console.warn('voice session closed', ev.code, ev.reason); } };
      s.ws.onerror = () => {};
    }
    function end(s) {
      try { if (s.flush) s.flush(); } catch (e) {}
      try { if (s.node) s.node.port.onmessage = null; } catch (e) {}
      try { if (s.stream) s.stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
      try { if (s.ac) s.ac.close(); } catch (e) {}
      if (sess === s) sess = null;
    }
    async function start(opt) {
      if (sess) await stop();
      if (!key) { askKey(); throw { code: 'unavailable', message: 'no key' }; }
      // the audio context is made before anything is awaited, while the click or key press that started this still counts
      let ac; try { ac = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 }); } catch (e) { ac = new (window.AudioContext || window.webkitAudioContext)(); }
      const s = (sess = { ac, queue: [], ready: false, finals: 0, partial: '', closed: false, stopping: false, lastMsg: 0, t0: performance.now() });
      emit('s', { state: 'starting' });
      try {
        try { await ac.resume(); } catch (e) {}
        s.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      } catch (e) { end(s); emit('s', { state: 'idle', reason: 'error' }); throw { code: e && e.name === 'NotAllowedError' ? 'not_granted' : 'unavailable', message: String((e && e.message) || e) }; }
      if (s !== sess) { end(s); return; }
      open(s, opt && opt.language);
      mic(s);
      try { await ac.audioWorklet.addModule(URL.createObjectURL(new Blob([PROC], { type: 'application/javascript' }))); } catch (e) { end(s); emit('s', { state: 'idle', reason: 'error' }); throw { code: 'unavailable', message: 'audio' }; }
      const src = ac.createMediaStreamSource(s.stream), node = (s.node = new AudioWorkletNode(ac, 'sw-pcm')), mute = ac.createGain(); mute.gain.value = 0;
      node.port.onmessage = (e) => { if (s === sess && !s.stopping) s.push(e.data); };
      src.connect(node); node.connect(mute); mute.connect(ac.destination);
      emit('s', { state: 'listening' });
    }
    async function stop() {
      const s = sess; if (!s) return; s.stopping = true; emit('s', { state: 'finishing' });
      end(s); sess = s; // the microphone is off; the session stays to hand over the last words
      send(s, { realtimeInput: { audioStreamEnd: true } });
      const n0 = s.finals, t0 = performance.now();
      await new Promise((res) => { const iv = setInterval(() => { const el = performance.now() - t0, quiet = performance.now() - s.lastMsg > 650; if (s.closed || el > 4000 || (quiet && (s.finals > n0 || (el > 1200 && !s.partial)))) { clearInterval(iv); res(); } }, 50); });
      if (s.partial && s.finals === n0) { emit('f', { text: (s.finals && !cjk(s.partial) ? ' ' : '') + s.partial }); s.partial = ''; } // the session never settled the last words: what it heard is kept
      sess = null; try { s.ws.close(1000); } catch (e) {}
      emit('s', { state: 'idle', reason: 'stopped' });
    }
    return { start, stop, onPartial: (f) => L.p.push(f), onFinal: (f) => L.f.push(f), onState: (f) => L.s.push(f) };
  }

  /* ---------- saving files: an ordinary download ---------- */
  const downloads = { save: ({ filename, data }) => { const b = data instanceof Blob ? data : new Blob([data == null ? '' : data], { type: 'text/plain;charset=utf-8' }); const u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = filename || 'download'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60e3); return Promise.resolve({ ok: true }); } };

  /* ---------- real footage: Gemini Omni turns a recorded clip into live action ---------- */
  const blobB64 = (b) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = () => rej(fr.error); fr.readAsDataURL(b); });
  const b64Blob = (s, type) => { const bin = atob(s), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new Blob([u8], { type }); };
  function findVideo(o, depth) { // the first {type:"video", data} anywhere in the answer
    if (!o || typeof o !== 'object' || depth > 8) return null;
    if (o.type === 'video' && typeof o.data === 'string' && o.data.length > 100) return o;
    for (const k of Object.keys(o)) { const r = findVideo(o[k], (depth || 0) + 1); if (r) return r; }
    return null;
  }
  const recMime = () => ['video/mp4;codecs=avc1.640028', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } });
  async function cropTile(blob, k, n, signal) { // one picture out of n side by side, played through once and recorded at 1280x720
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.src = URL.createObjectURL(blob);
    await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('the clip could not be read')); });
    const c = document.createElement('canvas'); c.width = 1280; c.height = 720; const g = c.getContext('2d'), w = v.videoWidth / n, h = v.videoHeight;
    const draw = () => { try { g.drawImage(v, k * w, 0, w, h, 0, 0, 1280, 720); } catch (e) {} };
    const mime = recMime(), mr = new MediaRecorder(c.captureStream(30), mime ? { mimeType: mime, videoBitsPerSecond: 16e6 } : undefined), chunks = [];
    mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise((res) => { mr.onstop = res; });
    draw(); mr.start(250);
    let on = true; const pump = () => { if (!on) return; draw(); if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(pump); else requestAnimationFrame(pump); }; pump();
    if (signal) signal.addEventListener('abort', () => { try { v.pause(); } catch (e) {} on = false; try { mr.stop(); } catch (e) {} });
    await v.play(); await new Promise((res) => { v.onended = res; if (signal) signal.addEventListener('abort', res); });
    on = false; draw(); mr.stop(); await done; URL.revokeObjectURL(v.src);
    if (signal && signal.aborted) throw new DOMException('aborted', 'AbortError');
    return new Blob(chunks, { type: (mr.mimeType || mime || 'video/webm').split(';')[0] });
  }
  async function makeReal(job) {
    if (!key) { needKey({ what: 'real', text: '' }); throw { code: 'not_granted', message: T('“转成实拍”需要 Gemini key', 'Make it real needs a Gemini key') }; }
    await keyReady; const say = job.onState || (() => {});
    let blob = job.blob, previz = null;
    if (job.tiles > 1 && job.tile >= 0) { say(T('正在剪出这个机位…', 'Cutting out this angle…')); previz = blob = await cropTile(blob, job.tile, job.tiles, job.signal); }
    say(T('Gemini Omni 生成中，通常一两分钟…', 'Gemini Omni is working, usually a minute or two…'));
    const data = await blobB64(blob), mime = (blob.type || job.type || 'video/mp4').split(';')[0];
    let last = null;
    for (const model of OMNI) {
      const body = { model, input: [{ type: 'user_input', content: [{ type: 'text', text: job.prompt }, { type: 'video', data, mime_type: mime }] }], generation_config: { video_config: { task: 'edit' } }, response_modalities: ['video'], response_format: { type: 'video' } };
      const r = await fetch(API + '/interactions', { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body), signal: job.signal });
      if (!r.ok) { last = await apiErr(r); if (last.code === 'model_unavailable' || (last.status === 400 && /model/i.test(last.message))) continue; throw new Error(last.message); }
      let j = await r.json();
      for (let i = 0; i < 120 && j && (j.status === 'in_progress' || j.status === 'queued') && j.id; i++) { // a job that runs in the background is asked again until it is done
        await new Promise((res) => setTimeout(res, 3000)); if (job.signal && job.signal.aborted) throw new DOMException('aborted', 'AbortError');
        const g = await fetch(API + '/interactions/' + encodeURIComponent(j.id), { headers: { 'x-goog-api-key': key }, signal: job.signal }); if (!g.ok) throw new Error((await apiErr(g)).message); j = await g.json();
      }
      const vid = findVideo(j, 0); if (!vid) throw new Error(T('模型没有返回视频', 'The model returned no video') + (j && j.status ? ' (' + j.status + ')' : ''));
      return { real: b64Blob(vid.data, vid.mime_type || vid.mimeType || 'video/mp4'), previz, model };
    }
    throw new Error((last && last.message) || T('这个 key 用不了 Gemini Omni', 'This key cannot use Gemini Omni'));
  }

  /* ---------- the host, as app/js/host.js expects it ---------- */
  const canVoice = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.WebSocket && window.AudioWorkletNode);
  const CLIPS = 'Recorded video. Click one to watch it, then press Make it real.', DROP = 'Press Make it real, or drop footage you made elsewhere.';
  window.SW_HOST = {
    name: 'gemini',
    ai: keyReady.then(() => sample),
    voice: canVoice ? keyReady.then(() => makeDict()) : null,
    save: downloads,
    video: { name: 'Gemini Omni', makeReal },
    gate: null, // access is the key dialog below
    access: { open: (q) => needKey(q) }, // a visitor looking around without a key said something that needs Gemini
    strings: {
      aiReady: ['AI 可用（Gemini）', 'AI available (Gemini)'],
      aiLater: ['预览：还没有填 Gemini key，只有当场生效的指令能用', 'Preview: no Gemini key yet, so only the instant commands work'],
      needTag: ['需要 key', 'needs key'],
      fClipsS: ['录好的视频。点开一段来看，再点“转成实拍”。', CLIPS],
      cmpB2: ['点“转成实拍”，或者把别处做好的实拍视频拖到这里。', DROP],
      cmpBT: ['Gemini Omni', 'Gemini Omni'],
    },
    usage, models: { text: TEXT, live: LIVE, omni: OMNI },
    secret: true, // this page holds an API key: code written by the model runs in a worker with no network, never in the page (app/js/ops.js)
  };

  /* ---------- asking for the key ---------- */
  /* Looking around without a key. A visitor who has no key yet can still walk in: the town, the sky, and the commands the page understands by
     itself (resize, recolour, add something it already knows, the weather, the time, a camera orbit) all work. What makes this Spoken World does
     not: building what was never made before, people who answer, voice, a designed shot, real footage. So the page never lets that pass as the
     whole thing: the dialog says what is missing before they go in, a bar says so the whole time they are in, the suggestions that need Gemini
     are marked, and saying anything that needs it brings the dialog back with their own sentence in it, which runs as soon as a key is there. */
  let demo = false, pending = '', lastNeed = 0;
  const NEED = {
    say: ['这句话要 Gemini 来理解', 'That one needs Gemini'], build: ['造没见过的东西要 Gemini', 'Building something new needs Gemini'], scene: ['造一整个场景要 Gemini', 'Building a whole scene needs Gemini'],
    shot: ['设计这个镜头要 Gemini', 'Designing that shot needs Gemini'], path: ['设计这条路线要 Gemini', 'Designing that path needs Gemini'], talk: ['镇上的人要靠 Gemini 才会回答', 'People here answer through Gemini'],
    voice: ['开口说话要 Gemini 来听', 'Talking to the world needs Gemini'], real: ['“转成实拍”要 Gemini Omni', 'Make it real needs Gemini Omni'],
  };
  function needKey(q) {
    if (key) return; q = q || {}; const now = performance.now(); if (now - lastNeed < 900 && document.getElementById('keyGate')) return; lastNeed = now;
    if (q.text && q.what !== 'talk' && q.what !== 'voice') pending = String(q.text).slice(0, 300);
    askKey('', { what: NEED[q.what] ? q.what : 'say', text: q.text || '' });
  }
  function demoBar(on) {
    let b = document.getElementById('demoBar'); if (!on) { if (b) b.remove(); return; } if (b) return;
    const st = document.createElement('style'); st.textContent = '#demoBar{position:fixed;left:50%;top:62px;transform:translateX(-50%);z-index:9;display:flex;align-items:center;gap:10px;max-width:min(760px,94vw);padding:7px 8px 7px 12px;border-radius:10px;border:1px solid rgba(255,216,74,.55);background:rgba(20,18,12,.9);color:#f4efe6;font:400 12.5px/1.35 var(--f-ui,system-ui);box-shadow:0 8px 28px rgba(0,0,0,.35)}#demoBar b{flex:none;padding:3px 7px;border-radius:5px;background:#ffd84a;color:#0a0d12;font:600 10.5px/1 var(--f-mono,monospace);letter-spacing:.08em}#demoBar span{min-width:0}#demoBar button{flex:none;padding:7px 12px;border:0;border-radius:7px;background:#ffd84a;color:#0a0d12;font:600 12px/1 var(--f-display,system-ui);letter-spacing:.06em;text-transform:uppercase;cursor:pointer}#intro:not(.off)~#demoBar{display:none}@media (max-width:640px){#demoBar{top:auto;bottom:calc(var(--bar-h,150px) + 12px);font-size:12px}}';
    document.head.appendChild(st);
    b = document.createElement('div'); b.id = 'demoBar'; b.setAttribute('role', 'status');
    const tag = document.createElement('b'), tx = document.createElement('span'), bt = document.createElement('button');
    tag.textContent = T('预览', 'PREVIEW'); tx.textContent = T('现在只有“当场”指令能用，这只是一个小角落。造任何你说得出的东西、会回答的居民、语音、设计镜头、转成实拍，都要填 Gemini key 才开始。', 'Only the instant commands work here, and that is a small corner of it. Building anything you can name, people who answer, voice, designed shots and real footage start with a Gemini key.');
    bt.type = 'button'; bt.textContent = T('填 key', 'Add key'); bt.onclick = (e) => { e.stopPropagation(); askKey(); };
    b.append(tag, tx, bt); document.body.appendChild(b);
  }
  function enterDemo() {
    demo = true; demoBar(true); keyChip();
    try { if (window.YX && YX.hooks && YX.hooks.aiLater) YX.hooks.aiLater(); } catch (e) {}
  }
  function askKey(err, need) {
    let g = document.getElementById('keyGate'); if (g) { if (!need) { const e = g.querySelector('.kerr'); if (e) e.textContent = err || ''; return; } g.remove(); }
    const st = document.createElement('style');
    st.textContent = '#keyGate{position:fixed;inset:0;z-index:70;display:grid;place-items:center;background:rgba(6,8,12,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);overflow:auto;padding:24px 0}'
      + '#keyGate .kc{color-scheme:light;width:min(440px,90vw);padding:28px 28px 20px;border-radius:16px;background:#f6f7f9;color:#0a0d12;font:400 14.5px/1.5 var(--f-ui,system-ui);box-shadow:0 18px 60px rgba(0,0,0,.35)}'
      + '#keyGate h2{margin:0 0 4px;font:600 22px/1.25 var(--f-display,system-ui)}#keyGate .sub{margin:0 0 18px;color:#4a505a}'
      + '#keyGate .row{display:flex;gap:8px;margin:0 0 6px}#keyGate input[type=password]{flex:1;min-width:0;padding:12px 14px;border:1.5px solid #cfd3d9;border-radius:10px;background:#fff;color:#0a0d12;font:500 14px/1.2 var(--f-mono,monospace);outline:none}#keyGate input[type=password]:focus{border-color:#0a0d12}'
      + '#keyGate button{align-self:stretch;height:auto;min-height:46px;padding:0 24px;border:0;border-radius:10px;background:var(--voice,#ffd84a);color:#0a0d12;font:600 13px/1 var(--f-display,system-ui);letter-spacing:.1em;text-transform:uppercase;cursor:pointer}#keyGate button:disabled{opacity:.5;cursor:default}'
      + '#keyGate .meta{display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:13px;color:#4a505a}#keyGate .meta label{display:flex;align-items:center;gap:6px;user-select:none;cursor:pointer}#keyGate .meta input{accent-color:#0a0d12;margin:0}#keyGate a{color:#0b57d0;text-decoration:none;white-space:nowrap}#keyGate a:hover{text-decoration:underline}'
      + '#keyGate .try{margin:0 0 14px;padding:12px 12px 11px;border-radius:10px;border:1.5px dashed #c9cdd4}#keyGate .try button{width:100%;min-height:40px;padding:0 14px;background:#fff;border:1.5px solid #0a0d12;letter-spacing:.06em}#keyGate .try p{margin:9px 0 0;font-size:12.5px;line-height:1.5;color:#4a505a}#keyGate .try p b{color:#0a0d12;font-weight:600}#keyGate .said{margin:-8px 0 16px;padding:10px 12px;border-radius:10px;background:#fff6cf;color:#0a0d12;font:500 14px/1.4 var(--f-ui,system-ui);overflow-wrap:anywhere}'
      + '#keyGate .kerr{min-height:1.1em;color:#b3261e;font-size:13px;margin:6px 0 10px}'
      + '#keyGate .uses{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 14px}#keyGate .use{padding:10px 10px 9px;border-radius:10px;background:#eceef1}#keyGate .use b{display:block;font:600 12.5px/1.2 var(--f-display,system-ui)}#keyGate .use span{display:block;margin-top:3px;font-size:11.5px;line-height:1.3;color:#5b6270}'
      + '#keyGate details{border-top:1px solid #e1e4e8;padding-top:10px;font-size:12.5px;line-height:1.5;color:#5b6270}#keyGate summary{cursor:pointer;color:#4a505a;font-weight:500;list-style:none}#keyGate summary::-webkit-details-marker{display:none}#keyGate summary:after{content:" ›"}#keyGate details[open] summary:after{content:" ⌄"}#keyGate details p{margin:8px 0 0}';
    document.head.appendChild(st);
    g = document.createElement('div'); g.id = 'keyGate'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'true');
    g.innerHTML = '<div class="kc"><h2></h2><p class="sub"></p><p class="said" hidden></p><form class="row"><input type="password" autocomplete="off" spellcheck="false"><button type="submit"></button></form><div class="meta"><label><input type="checkbox" class="rem"><span class="rl"></span></label><a target="_blank" rel="noopener" href="https://aistudio.google.com/apikey"></a></div><div class="kerr"></div><div class="uses"><div class="use"><b class="b1"></b><span class="m1"></span></div><div class="use"><b class="b2"></b><span class="m2"></span></div><div class="use"><b class="b3"></b><span class="m3"></span></div></div><div class="try"><button type="button" class="look"></button><p class="lk"></p></div><details><summary></summary><p class="d1"></p></details></div>';
    const $q = (s) => g.querySelector(s);
    $q('h2').textContent = need ? T(NEED[need.what][0], NEED[need.what][1]) : T('填入你的 Gemini API key', 'Add your Gemini API key');
    $q('.sub').textContent = need ? (need.text && pending ? T('填好 key，这句话马上就做：', 'Add your key and this runs right away:') : T('填好 key 就能用，用的是你自己的 key。', 'Add your key and it works, on your own key.')) : T('你说的每句话都由 Gemini 现场搭建，用的是你自己的 key。', 'Everything you say is built by Gemini, on your own key.');
    if (need && need.text && pending) { $q('.said').hidden = false; $q('.said').textContent = '“' + pending + '”'; }
    $q('.look').textContent = need || demo ? T('先不填，继续逛', 'Not now, keep looking around') : T('没有 key？先进去逛逛', 'No key yet? Look around first');
    $q('.lk').innerHTML = T('不填 key 也能进去走走，用“当场”指令：变大变小、换颜色、加一棵树、换天气。<b>这只是一个小角落。</b>造任何你说得出的东西、会回答的居民、语音、设计镜头、转成实拍，全都跑在 Gemini 上，填了 key 才开始。', 'Without a key you can walk the town and use the instant commands: resize, recolour, add a tree, change the weather. <b>That is a small corner of it.</b> Building anything you can name, people who answer, voice, designed shots and real footage all run on Gemini, and start when you add a key.');
    $q('.look').onclick = () => { g.remove(); pending = ''; enterDemo(); };
    $q('input[type=password]').placeholder = T('粘贴 key', 'Paste your key'); $q('button').textContent = T('开始', 'Start'); $q('.rl').textContent = T('在这台设备上记住', 'Remember on this device'); $q('.meta a').textContent = T('去拿一个 key ↗', 'Get a key ↗');
    $q('.b1').textContent = T('世界和居民', 'World & people'); $q('.m1').textContent = 'Gemini 4 Hydrogen';
    $q('.b2').textContent = T('语音', 'Voice'); $q('.m2').textContent = 'Gemini Transcribe Live';
    $q('.b3').textContent = T('转成实拍', 'Make it real'); $q('.m3').textContent = T('Gemini Omni · 点了才用', 'Gemini Omni · on request');
    $q('summary').textContent = T('这个 key 会怎么用', 'How your key is used');
    $q('.d1').textContent = T('key 只留在这个浏览器里，只发给 Google 的 Gemini API，不经过我们的服务器；费用由 Google 记在你的账号上，其中“转成实拍”最贵，只在你点它时才会用。建议专门建一个 key，并在 Google Cloud 里设好预算上限。代码是公开的（github.com/ryannli/spoken-world），你可以自己读、自己部署。' + (COUNTED ? '这个官方页面只统计访问次数（页面浏览、来源、国家、设备，不用 cookie），你说的话、你造的世界和你的 key 都不会被统计。' : ''), 'It stays in this browser and goes only to Google’s Gemini API, never to a server of ours. Google bills the usage to your account; Make it real is the costly part and runs only when you press it. Best to make a separate key for this and set a budget cap in Google Cloud. The code is public (github.com/ryannli/spoken-world): you can read it and run your own copy.' + (COUNTED ? ' This official page counts visits only (page views, referrer, country, device; no cookies): nothing you say, nothing you build and never your key.' : ''));
    $q('.kerr').textContent = err || '';
    const inp = $q('input[type=password]'), btn = $q('button'), rem = $q('.rem');
    $q('form').onsubmit = async (e) => {
      e.preventDefault(); const k = inp.value.trim(); if (!k) return; btn.disabled = true; $q('.kerr').textContent = T('正在检查…', 'Checking…');
      let bad = ''; try { bad = await check(k); } catch (x) { bad = T('暂时连不上 Gemini：', 'Gemini cannot be reached right now: ') + ((x && x.message) || x); }
      btn.disabled = false; if (bad) { $q('.kerr').textContent = bad; return; }
      key = k; try { sessionStorage.setItem(SK, k); if (rem.checked) localStorage.setItem(SK, k); else localStorage.removeItem(SK); } catch (x) {}
      g.remove(); keyOk(k); const run = pending, was = demo; pending = ''; demo = false; demoBar(false); keyChip();
      if (was) setTimeout(() => { try { if (YX.ui && YX.ui.toast) YX.ui.toast(T('Gemini 接上了：现在什么都可以说', 'Gemini is connected: now anything you say works')); if (run && YX.mind) YX.mind.commit(run); } catch (x) {} }, 700);
      try { if (window.YX && YX.mind && !YX.mind.sample) YX.mind.setSample(sample); } catch (x) {} // a key that replaced one that stopped working: the world gets its AI back
    };
    // nothing behind the dialog takes keys or clicks while it is open
    g.addEventListener('keydown', (e) => e.stopPropagation()); g.addEventListener('keyup', (e) => e.stopPropagation()); g.addEventListener('click', (e) => e.stopPropagation());
    document.body.appendChild(g); setTimeout(() => inp.focus(), 50);
  }
  window.addEventListener('keydown', (e) => { if (document.getElementById('keyGate') && !e.target.closest('#keyGate')) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  function keyChip() { // on the title card: which key is in use, and a way to change it
    const intro = document.getElementById('intro'); if (!intro) return; const b0 = document.getElementById('keyChip'); if (b0) { b0.textContent = key ? T('Gemini key · 更换', 'Gemini key · change') : T('填入 Gemini key', 'Add a Gemini key'); return; }
    const b = document.createElement('button'); b.id = 'keyChip'; b.type = 'button';
    b.style.cssText = 'position:absolute;left:16px;bottom:12px;z-index:3;padding:6px 10px;border:1px solid rgba(255,255,255,.25);border-radius:8px;background:rgba(10,12,18,.45);color:#f4efe6;font:500 12px/1 var(--f-ui,system-ui);cursor:pointer';
    b.textContent = key ? T('Gemini key · 更换', 'Gemini key · change') : T('填入 Gemini key', 'Add a Gemini key');
    b.onclick = (e) => { e.stopPropagation(); if (key) forget(); askKey(); };
    intro.appendChild(b);
  }
  // Run from your own computer (node site/serve.js), the key can come from an env file there instead of being typed: the local server hands it
  // to this page, and only to this page (same origin, localhost). It is kept in memory for this visit, not stored in the browser.
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  async function localKey() {
    try { const r = await fetch('/__key', { cache: 'no-store' }); if (!r.ok) return false; const j = await r.json(); if (!j || !j.key) return false; key = String(j.key); keyOk(key); return true; } catch (e) { return false; }
  }
  /* a tab left open keeps running the page it loaded. Every so often it asks the server which build is there now; when that is a newer one it says so,
     so nobody goes on testing yesterday's page. The build is also written small in the corner: a screenshot then shows which page it is of. */
  /* visits to the official hosted page are counted with Vercel Web Analytics: page views only, no cookies, nothing about what is said or built.
     A copy you run or deploy yourself does not load it. Said in the key dialog and in SECURITY.md. */
  function countVisits() {
    if (!COUNTED) return;
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
    const s = document.createElement('script'); s.defer = true; s.src = '/_vercel/insights/script.js'; document.head.appendChild(s);
  }
  function buildWatch() {
    const mine = window.SW_BUILD; if (!mine) return;
    const tag = document.createElement('div'); tag.id = 'swBuild'; tag.textContent = 'build ' + mine; tag.style.cssText = 'position:fixed;right:8px;bottom:4px;z-index:3;font:500 9.5px/1 ui-monospace,Menlo,monospace;letter-spacing:.04em;color:#fff;opacity:.34;pointer-events:none;text-shadow:0 1px 2px rgba(0,0,0,.6)'; document.body.appendChild(tag);
    let told = false; const ask = async () => { if (told || document.hidden) return; try { const r = await fetch('version.json?' + Date.now(), { cache: 'no-store' }); if (!r.ok) return; const j = await r.json(); if (!j || !j.build || j.build === mine) return; told = true;
        const b = document.createElement('button'); b.type = 'button'; b.id = 'swNew'; b.textContent = T('有新版本了 · 点这里刷新（世界会保留）', 'A newer version is ready · click to reload (your world is kept)'); b.style.cssText = 'position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:40;padding:9px 16px;border-radius:999px;border:1px solid rgba(255,211,77,.6);background:rgba(24,22,16,.92);color:#ffd34d;font:600 13px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 28px rgba(0,0,0,.4)'; b.onclick = () => { try { if (window.YX && YX.onChange) YX.onChange(); } catch (e) {} location.reload(); }; document.body.appendChild(b); } catch (e) {} };
    setInterval(ask, 40000); document.addEventListener('visibilitychange', ask); setTimeout(ask, 8000);
  }
  const boot = () => {
    if (!key) { if (local) localKey().then((ok) => { if (!ok) askKey(); }); else askKey(); }
    keyChip(); buildWatch(); countVisits();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
