/* Skyfield RC requests landscape as soon as its page opens.
 * GoLingo's native WKWebView host must register the `golingoOrientation`
 * script-message handler and allow/request landscape on its window scene.
 * The browser lock remains a best-effort fallback for standalone browsers.
 */
(() => {
  const message = (action, orientation) => {
    try {
      window.webkit?.messageHandlers?.golingoOrientation?.postMessage({
        version: 1,
        game: 'skyfield-rc',
        action,
        orientation
      });
    } catch {
      // Browser and third-party embedded views can omit the native bridge.
    }
  };

  function request() {
    message('request', 'landscape');
    try {
      const result = window.screen?.orientation?.lock?.('landscape');
      result?.catch?.(() => {});
    } catch {
      // iOS WebKit generally requires the native host to rotate the scene.
    }
  }

  function release() {
    message('release', 'portrait');
    try { window.screen?.orientation?.unlock?.(); } catch {}
  }

  window.skyfieldOrientation = { request, release };
  window.addEventListener('pageshow', request);
  window.addEventListener('pagehide', release);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', request, { once: true });
  } else {
    request();
  }
})();
