/* Spoken World — smooth before pretty.
   The world is drawn as richly as the machine allows, not more. If the picture stays under 26 frames a second for several seconds while someone
   is actually looking at it, detail is taken away one step at a time, the least noticeable first: the mirror in wet roads and the densest grass,
   then the bloom-and-grade pass. It never happens while a clip is being recorded or on the title card, it says so once when it does, and
   switching "High quality" off and on in Settings puts everything back. */
(function () {
  'use strict';
  const YX = window.YX; let level = 0, slow = 0, n = 0, t0 = 0, quiet = 8;
  const STEPS = [
    () => { if (YX.post) YX.post.mirrorOn = false; if (YX.grass && YX.grass.detail) YX.grass.detail(1); },
    () => { if (YX.post) YX.post.on = false; if (YX.grass && YX.grass.detail) YX.grass.detail(2); },
  ];
  function step() { if (level >= STEPS.length) return false; try { STEPS[level](); } catch (e) {} level++; slow = 0; quiet = 6;
    try { if (YX.ui && YX.ui.toast) YX.ui.toast(YX.T('为了保持流畅，已自动降低一档画面细节（设置里重新打开“高画质”可恢复）', 'Lowered detail one step to keep it smooth (switch “High quality” off and on in Settings to restore)')); } catch (e) {} return true; }
  function reset() { level = 0; slow = 0; quiet = 8; if (YX.post) { YX.post.mirrorOn = true; YX.post.on = true; } if (YX.grass && YX.grass.detail) YX.grass.detail(0); }
  const q0 = YX.setQuality; if (q0) YX.setQuality = function (q) { const r = q0.apply(this, arguments); if (q !== 'low') reset(); return r; };
  const frame0 = YX.onFrame; YX.onFrame = function (dt) {
    if (frame0) frame0(dt); const now = performance.now(); if (!t0) t0 = now; n++;
    if (now - t0 < 1000) return; const fps = (n * 1000) / (now - t0); n = 0; t0 = now;
    if (navigator.webdriver || document.hidden || !document.hasFocus() || document.body.classList.contains('title') || (YX.filmBusy && YX.filmBusy()) || (YX.quality && YX.quality() === 'low')) { slow = 0; return; } // only when someone is watching, and never in the middle of a take
    if (quiet > 0) { quiet--; return; } // loading and the first seconds do not count
    slow = fps < 26 ? slow + 1 : 0; if (slow >= 4) step(); // 26, not 30: a projector running at 30 Hz is not a slow machine
  };
  YX.perf = { level: () => level, step, reset };
})();
