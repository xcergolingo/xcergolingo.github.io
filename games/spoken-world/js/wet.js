/* Spoken World — what rain does to a place.
   When it rains the ground gets wet, and stays wet a while after; wet paving mirrors the world (core.js draws it, post.js supplies the picture).
   And people do what people do: whoever is out of doors puts an umbrella up, and takes it down when it stops. Nobody indoors does. */
(function () {
  'use strict';
  const YX = window.YX, W = YX.world; let wet = 0, was = null, t = 0;
  const raining = () => W.env.weather === 'rain' || W.env.weather === 'storm';
  const indoors = (o) => { const host = o.attach && W.objs.get(o.attach.to), sp = host && YX.spaceOf ? YX.spaceOf(host) : null; return !!(sp && sp.enclosed); };
  function dress(o, on) { const want = on && !indoors(o) && o.params.pose !== 'ride' && o.params.pose !== 'lie'; if (!!o.params._wet === want) return; if (want) o.params._wet = true; else delete o.params._wet; try { YX.rebuild(o); } catch (e) {} }
  const spawn0 = YX.spawn; YX.spawn = function () { const o = spawn0.apply(this, arguments); if (o && o.type === 'person' && raining()) dress(o, true); return o; }; // someone who arrives in the rain arrives with an umbrella
  const frame0 = YX.onFrame; YX.onFrame = function (dt) {
    if (frame0) frame0(dt); dt = dt || 0.016; t += dt;
    const on = raining(); wet += ((on ? 1 : 0) - wet) * Math.min(1, dt * (on ? 0.35 : 0.05)); if (wet < 0.002 && !on) wet = 0;
    if (YX.wetUni) { YX.wetUni.uWet.value = wet; YX.wetUni.uWetT.value = t; YX.wetUni.uWetR.value = 0; } // the mirror pass, if there is one this frame, says so after this
    if (on !== was) { was = on; for (const o of Array.from(W.objs.values())) if (o.type === 'person' && !o.dead) dress(o, on); }
  };
  YX.wet = () => wet; YX.wetSet = (v) => { wet = Math.max(0, Math.min(1, +v || 0)); }; // (for a recording that starts in the rain)
})();
