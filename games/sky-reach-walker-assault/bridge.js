/* Install before the module graph so native GoLingo imports cannot arrive too early. */
(function () {
  'use strict';
  if (window.__skyReachBridgeBooted) return;
  window.__skyReachBridgeBooted = true;
  const queue = window.__skyReachLessonQueue = window.__skyReachLessonQueue || [];
  const queuedImport = function (payload, options) {
    if (window.__skyReachLearningController) return window.__skyReachLearningController.importWords(payload, options);
    queue.push({ payload: payload, options: options || {} });
    return { ok: true, queued: true, ready: false };
  };
  const game = window.GoLingoGame = window.GoLingoGame || {};
  game.importWords = queuedImport;
  game.getLesson = function () { return { ready: false, primaryLanguage: 'en', learningLanguage: 'es', words: [] }; };
  game.getBasket = function () { return { ready: false, primaryLanguage: 'en', learningLanguage: 'es', words: [] }; };
  game.ready = false;
  const bridge = window.GoLingoBridge = window.GoLingoBridge || {};
  bridge.load = queuedImport;
  bridge.importWords = queuedImport;
  bridge.getLesson = game.getLesson;
  bridge.getBasket = game.getBasket;
  window.setGoLingoData = queuedImport;
  window.receiveGoLingoData = queuedImport;
  const types = new Set(['golingo_data', 'golingo-data', 'golingo.lesson', 'golingo:lesson', 'golingo:importwords', 'golingo_lesson', 'golingo-content', 'loadsentences', 'golingo_words', 'setgolingodata', 'receivegolingodata']);
  function earlyCustom(event) {
    if (!window.__skyReachLearningController) queue.push({ payload: event.detail, options: { source: 'event' } });
  }
  window.addEventListener('golingo:lesson', earlyCustom);
  window.addEventListener('golingo:importWords', earlyCustom);
  window.addEventListener('message', function (event) {
    if (window.__skyReachLearningController) return;
    if (event.source && event.source !== window && event.source !== window.parent && event.source !== window.opener) return;
    let value = event.data;
    if (typeof value === 'string') { try { value = JSON.parse(value); } catch (_) { return; } }
    if (!value || typeof value !== 'object' || !types.has(String(value.type || '').toLowerCase())) return;
    queue.push({ payload: value, options: { source: 'message' }, replyTo: event.source, origin: event.origin });
  });
})();
