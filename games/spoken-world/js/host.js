/* Spoken World · host: where the page lives.
   The world asks its home for a few things and does not care who provides them:

     ai      Promise<fn | null>    fn(input, { modelTier: 'quick'|'default'|'complex', task, onText({text}), signal }) -> Promise<{ text }>
                                   task (optional) says what the call is for ('shot': one simple camera move, 'shot-long': a take with several beats);
                                   a host may use it to pick a model, or ignore it
     voice   Promise<obj | null>   { start({language}), stop(), onPartial(fn), onFinal(fn), onState(fn) }: speech to text
     save    Promise<obj | null>   { save({ filename, data }) }: hand a file to the viewer
     video   null | { name, makeReal(job) -> Promise<{ real: Blob, previz?: Blob }> }: turn a recorded clip into real footage
     gate    null | { title, body, note, action: { label, href } }: what to say when the AI cannot be reached and the world should not start
                                   (each text is [中文, English]); null: the host looks after access itself
     access  null | { open({ what, text }) }: a home that lets visitors in before they have the AI (it calls YX.hooks.aiLater() when it does, and
                                   resolves `ai` and `voice` later) is asked for it here when something said needs it; `text` is what was said,
                                   `what` the kind of thing ('say', 'build', 'scene', 'shot', 'path', 'talk', 'voice')
     strings { key: [中文, English] }: wording of the page that differs in this home (keys of the text table in ui.js, plus aiReady, aiLater, needTag)

   A host is one object with those members. The Claude artifact is built in below (window.claude). Another home registers itself by setting
   window.SW_HOST before this file runs: the open-web build does so with site/gemini.js (the viewer's own Gemini API key).
   To add a home (a proxy of your own, another model, another speech service), write one such object. Nothing else in the page changes. */
'use strict';
(function () {
  const YX = window.YX; YX.hooks = YX.hooks || {};
  function claudeHost() {
    const C = window.claude && typeof window.claude.use === 'function' ? window.claude : null;
    const use = (name, ok) => (C ? Promise.resolve(C.use(name)).then((v) => (ok(v) ? v : null), () => null) : Promise.resolve(null));
    return {
      name: 'claude',
      ai: use('sample', (s) => typeof s === 'function').then((s) => s && ((input, o) => { if (o && o.task !== undefined) { o = Object.assign({}, o); delete o.task; } return s(input, o); })), // Claude chooses its own model per tier: the task hint is not passed on
      voice: use('dictation', (d) => !!d && typeof d.start === 'function'),
      save: use('downloads', (d) => !!d && typeof d.save === 'function'),
      video: null, // the artifact cannot call a video model: footage is made outside the page and dropped into the comparison
      gate: {
        title: ['登录 Claude 才能玩', 'Sign in to Claude to play'],
        body: ['你说的每句话都由 Claude 现场搭建，用的是你自己的 Claude 账号，玩的时候会消耗一些用量。请先登录 claude.ai，再重新打开这个链接。', 'Everything you say here is built by Claude, on your own Claude account, so playing uses some of your usage. Sign in at claude.ai, then open this link again.'],
        note: ['已经登录了还看到这条？说明这个窗口连不上 Claude 的 AI。', 'Already signed in and still seeing this? This window cannot reach Claude’s AI.'],
        action: { label: ['登录 Claude', 'Sign in to Claude'], href: 'https://claude.ai/login' },
      },
      strings: {},
    };
  }
  const given = window.SW_HOST && typeof window.SW_HOST === 'object' ? window.SW_HOST : null, base = given ? null : claudeHost();
  const H = (YX.host = given || base);
  H.name = H.name || 'custom'; H.strings = H.strings || {}; if (H.gate === undefined) H.gate = null; if (H.video === undefined) H.video = null; if (H.access === undefined) H.access = null;
  for (const k of ['ai', 'voice', 'save']) H[k] = Promise.resolve(H[k] == null ? null : H[k]).catch(() => null);
  if (H.video && typeof H.video.makeReal === 'function') YX.hooks.makeReal = H.video.makeReal;
})();
