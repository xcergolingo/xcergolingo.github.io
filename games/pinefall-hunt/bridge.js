/* GoLingo bootstrap: loaded before the game so native lesson delivery is never lost. */
(function (window) {
  'use strict';
  if (window.PinefallBridge && window.PinefallBridge.version === 1) return;
  var queue = [], receiver = null, exporter = null, stateReader = null;
  var diagnostic = { ready: false, queued: 0, imports: 0, lastSource: null, lastError: null, count: 0 };
  var acceptedTypes = new Set(['golingo:lesson', 'golingo:importWords', 'golingoLesson', 'GoLingoData', 'GOLINGO_DATA', 'loadLesson', 'golingo:loadLesson']);
  function emit(type, detail) {
    var message = Object.assign({ type: type, event: type, game: 'pinefall-hunt', version: 1 }, detail || {});
    try {
      var handler = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.golingo;
      if (handler && typeof handler.postMessage === 'function') handler.postMessage(message);
    } catch (_) { /* The learning game also works without a native host. */ }
    try { window.dispatchEvent(new CustomEvent('golingo:' + type, { detail: message })); } catch (_) {}
    return message;
  }
  function fail(error, source) {
    var message = error && error.message ? error.message : String(error);
    diagnostic.lastError = message;
    emit('error', { message: message, source: source || 'native-import' });
    return { ok: false, error: message };
  }
  function deliver(payload, options, source) {
    options = options && typeof options === 'object' ? { append: options.append === true } : { append: false };
    diagnostic.lastSource = source || 'native';
    if (!receiver) {
      if (queue.length >= 20) return fail(new Error('Too many queued lessons. Wait for the game to finish loading.'), source);
      if (typeof payload === 'string' && payload.length > 100000) return fail(new Error('Lesson is too large. Use at most 100,000 characters.'), source);
      queue.push({ payload: payload, options: options, source: source || 'native' });
      diagnostic.queued = queue.length;
      return { ok: true, queued: true, pending: queue.length };
    }
    try {
      var result = receiver(payload, options);
      diagnostic.imports++;
      diagnostic.lastError = null;
      diagnostic.count = result && (result.total || result.count) || 0;
      return result;
    } catch (error) { return fail(error, source); }
  }
  var bridge = {
    version: 1,
    emit: emit,
    takePending: function () { var pending = queue.splice(0); diagnostic.queued = 0; return pending; },
    connect: function (handlers) {
      receiver = handlers.importLesson;
      exporter = handlers.exportLesson;
      stateReader = handlers.getState;
      diagnostic.ready = true;
      var pending = bridge.takePending();
      pending.forEach(function (item) { deliver(item.payload, item.options, item.source); });
    },
    disconnect: function () { receiver = null; exporter = null; stateReader = null; diagnostic.ready = false; },
    report: function (value) { Object.assign(diagnostic, value || {}); },
    load: function (payload, options) { return deliver(payload, options, 'native'); },
    getImportDiagnostic: function () {
      var current = stateReader ? stateReader() : null;
      return Object.assign({}, diagnostic, { queued: queue.length, count: current ? current.total : diagnostic.count });
    }
  };
  function exportWords(options) {
    if (!exporter) return { ok: false, error: 'The game is still loading.' };
    return exporter(options && typeof options === 'object' ? options : {});
  }
  window.PinefallBridge = bridge;
  window.GoLingoGame = Object.assign(window.GoLingoGame || {}, {
    importWords: bridge.load, loadLesson: bridge.load,
    getImportDiagnostic: bridge.getImportDiagnostic, exportWords: exportWords
  });
  window.GoLingoBridge = Object.assign(window.GoLingoBridge || {}, { load: bridge.load, loadLesson: bridge.load });
  window.loadGoLingoData = bridge.load;
  window.receiveGoLingoData = bridge.load;
  window.setLearningData = bridge.load;
  window.addEventListener('message', function (event) {
    var trustedSource = event.source === window || event.source === window.parent || event.source === window.opener;
    var trustedOrigin = event.origin === window.location.origin || event.origin === 'https://xcergolingo.github.io';
    if (!trustedSource || !trustedOrigin) return;
    var data = event.data;
    if (!data || typeof data !== 'object' || !acceptedTypes.has(data.type || data.event)) return;
    var payload = data.lesson !== undefined ? data.lesson : data.payload !== undefined ? data.payload : data.data !== undefined ? data.data : data;
    deliver(payload, { append: data.append === true || !!(data.options && data.options.append === true) }, 'postMessage');
  });
})(window);
