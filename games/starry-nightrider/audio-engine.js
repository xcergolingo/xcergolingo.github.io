/*
 * Starry Nightrider — original, lightweight ride soundscape.
 *
 * Call unlock() directly from a trusted Play / Enable Sound / Resume tap,
 * BEFORE awaiting anything else. Merely finishing the muted intro video is
 * not an audio gesture. A locked context is reported instead of being hidden.
 * Speech is deliberately separate: muting pronunciation must not mute music.
 */
export function createRideAudio({ onStatus = () => {} } = {}) {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  const doc = globalThis.document;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  let context = null, master = null, ambientBus = null;
  let windGain = null, rollingGain = null, windFilter = null;
  let enabled = true, paused = false, disposed = false;
  let hidden = Boolean(doc?.hidden), unlockedOnce = false;
  let unavailable = !AC, status = unavailable ? 'unavailable' : 'locked';
  let nextBell = 0, noteIndex = 0, bellCursor = 0, lastChime = -Infinity;
  let lastAudioUpdate = -Infinity;
  let silenceMask = 0;
  const nodes = [], sources = [], bellPool = [], pendingUnlocks = new Set();
  // A newly composed, spacious set of notes. No music from the reference video
  // is sampled, fetched or imitated. The pattern is quieter than vocabulary.
  const notes = [293.665, 440, 659.255, 523.251, 349.228, 587.33, 440, 783.991];
  const noteGaps = [4.8, 6.1, 5.4, 7.3, 5.7, 6.4, 4.9, 7.9];

  function emit(next) {
    if (status === next) return;
    status = next;
    try { onStatus(next); } catch { /* UI failure cannot break the game. */ }
  }
  function currentStatus() {
    if (disposed) return 'disposed';
    if (unavailable) return 'unavailable';
    if (!enabled) return 'muted';
    if (hidden) return 'paused';
    if (!context || context.state !== 'running') return 'locked';
    if (paused) return 'paused';
    return 'ready';
  }
  function refreshStatus() { emit(currentStatus()); }
  const active = () => !disposed && enabled && !paused && !hidden && context?.state === 'running';
  function own(node) { nodes.push(node); return node; }
  function source(node) { sources.push(node); return own(node); }
  function target(param, value, seconds = .12) {
    if (!param || !context || context.state === 'closed') return;
    const now = context.currentTime;
    param.cancelScheduledValues(now);
    param.setTargetAtTime(value, now, seconds);
  }
  function silenceBells() {
    if (!context) return;
    for (const voice of bellPool) target(voice.envelope.gain, 0, .025);
  }
  function syncGains() {
    if (master) target(master.gain, enabled && !hidden ? .62 : 0, .07);
    if (ambientBus) target(ambientBus.gain, enabled && !paused && !hidden ? 1 : 0, .18);
    const nextMask = (!enabled ? 1 : 0) | (paused ? 2 : 0) | (hidden ? 4 : 0);
    // Silence on a real pause/mute transition, not on a later statechange
    // callback that could otherwise cancel a deliberate test in a pause menu.
    if (nextMask && nextMask !== silenceMask) silenceBells();
    silenceMask = nextMask;
    refreshStatus();
  }

  function makeGraph() {
    if (context || unavailable || disposed) return Boolean(context);
    try {
      // Construction and resume happen only within unlock(), not an RAF,
      // timer, load event, or the intro video's ended event.
      context = new AC({ latencyHint: 'interactive' });
      master = own(context.createGain()); master.gain.value = 0;
      master.connect(context.destination);
      ambientBus = own(context.createGain()); ambientBus.gain.value = 0;
      ambientBus.connect(master);

      // Reusable filtered noise creates wind and a soft tyre-on-stone sound.
      // Its samples are computed once; no audio buffers are made in update().
      const noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      let seed = 194431, brown = 0;
      for (let i = 0; i < data.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const white = seed / 2147483648 - 1;
        brown = .975 * brown + .025 * white;
        data[i] = brown * 3.2 + white * .055;
      }
      // Avoid a click at the two-second noise loop boundary.
      const fade = Math.min(256, Math.floor(data.length / 4));
      for (let i = 0; i < fade; i++) {
        const mix = i / fade;
        data[i] *= mix;
        data[data.length - 1 - i] *= mix;
      }
      const noise = source(context.createBufferSource());
      noise.buffer = noiseBuffer; noise.loop = true;
      windFilter = own(context.createBiquadFilter());
      windFilter.type = 'lowpass'; windFilter.frequency.value = 650; windFilter.Q.value = .4;
      windGain = own(context.createGain()); windGain.gain.value = .012;
      noise.connect(windFilter); windFilter.connect(windGain); windGain.connect(ambientBus);
      const rollFilter = own(context.createBiquadFilter());
      rollFilter.type = 'bandpass'; rollFilter.frequency.value = 210; rollFilter.Q.value = .65;
      rollingGain = own(context.createGain()); rollingGain.gain.value = 0;
      noise.connect(rollFilter); rollFilter.connect(rollingGain); rollingGain.connect(ambientBus);
      noise.start();

      // Three very quiet harmonics give the scene warmth without obscuring
      // spoken words. These oscillators are permanent rather than recreated.
      for (const [hz, level] of [[146.832, .024], [220, .016], [293.665, .008]]) {
        const osc = source(context.createOscillator()), gain = own(context.createGain());
        osc.type = 'sine'; osc.frequency.value = hz; gain.gain.value = level;
        osc.connect(gain); gain.connect(ambientBus); osc.start();
      }

      // A bounded pool of four two-part bells handles both rewards and the
      // sparse ambience. Repeated pickups cannot accumulate audio nodes.
      const bellBus = own(context.createGain()); bellBus.gain.value = 1; bellBus.connect(master);
      const echo = own(context.createDelay(.8)), echoGain = own(context.createGain());
      echo.delayTime.value = .29; echoGain.gain.value = .12;
      bellBus.connect(echo); echo.connect(echoGain); echoGain.connect(master);
      for (let i = 0; i < 4; i++) {
        const fundamental = source(context.createOscillator());
        const harmonic = source(context.createOscillator());
        const harmonicGain = own(context.createGain()), envelope = own(context.createGain());
        fundamental.type = harmonic.type = 'sine';
        fundamental.frequency.value = 660; harmonic.frequency.value = 660 * 2.76;
        harmonicGain.gain.value = .16; envelope.gain.value = 0;
        fundamental.connect(envelope); harmonic.connect(harmonicGain); harmonicGain.connect(envelope);
        envelope.connect(bellBus); fundamental.start(); harmonic.start();
        bellPool.push({ fundamental, harmonic, envelope });
      }
      context.onstatechange = () => {
        if (disposed) return;
        if (context.state === 'running') unlockedOnce = true;
        syncGains();
      };
      nextBell = context.currentTime + 4.8;
      syncGains();
      return true;
    } catch {
      unavailable = true;
      for (const node of sources) { try { node.stop(); } catch {} }
      for (const node of nodes) { try { node.disconnect(); } catch {} }
      try { context?.close()?.catch?.(() => {}); } catch {}
      refreshStatus();
      return false;
    }
  }

  function unlock() {
    if (disposed || unavailable || !makeGraph()) return Promise.resolve(false);
    // resume() MUST be invoked synchronously in this function, while the
    // caller's trusted event is still active. Do not place it after an await.
    let resumption;
    try { resumption = context.resume(); }
    catch { refreshStatus(); return Promise.resolve(false); }
    refreshStatus();
    // Some autoplay-blocked resume promises wait indefinitely for a gesture.
    // Return false promptly so callers can show a real Enable Sound button.
    return new Promise(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer); pendingUnlocks.delete(finish);
        const running = !disposed && context?.state === 'running';
        if (running) unlockedOnce = true;
        if (!disposed) syncGains(); else refreshStatus();
        resolve(running);
      };
      const timer = setTimeout(finish, 1100); pendingUnlocks.add(finish);
      Promise.resolve(resumption).then(finish, finish);
    });
  }

  function ring(hz, level = .12, duration = .9, delay = 0, allowPaused = false) {
    if (disposed || !enabled || hidden || !context || context.state !== 'running' ||
        (!allowPaused && paused) || !bellPool.length) { refreshStatus(); return false; }
    const voice = bellPool[bellCursor++ % bellPool.length];
    const now = context.currentTime, when = now + delay;
    const pitch = clamp(Number(hz) || 660, 110, 1600);
    voice.fundamental.frequency.cancelScheduledValues(now);
    voice.harmonic.frequency.cancelScheduledValues(now);
    voice.fundamental.frequency.setValueAtTime(pitch, when);
    voice.harmonic.frequency.setValueAtTime(pitch * 2.76, when);
    const gain = voice.envelope.gain;
    gain.cancelScheduledValues(now); gain.setValueAtTime(0, now);
    gain.setValueAtTime(.0001, when);
    gain.linearRampToValueAtTime(clamp(level, .001, .2), when + .018);
    gain.exponentialRampToValueAtTime(.0001, when + duration);
    gain.setValueAtTime(0, when + duration + .03);
    return true;
  }
  function chime(hz = 720) {
    if (!active()) { refreshStatus(); return false; }
    // Keep accidental repeated callbacks from becoming a loud stack.
    if (context.currentTime - lastChime < .075) return false;
    lastChime = context.currentTime;
    return ring(hz, .115, .85);
  }
  function update(speed = 0, timeMs = 0) {
    if (!active()) { refreshStatus(); return; }
    const now = context.currentTime;
    // Parameter updates at 10 Hz are ample for a soft wind ramp. Nothing is
    // allocated or connected by this function, even when called each frame.
    if (now - lastAudioUpdate >= .1) {
      lastAudioUpdate = now;
      const velocity = clamp(Math.abs(Number(speed) || 0) / 20, 0, 1);
      target(windGain.gain, .012 + velocity * .055, .18);
      target(rollingGain.gain, velocity * .07, .12);
      target(windFilter.frequency, 600 + velocity * 1450, .2);
    }
    if (now >= nextBell) {
      const index = noteIndex++ % notes.length;
      ring(notes[index], .028, 2.25);
      // Schedule from NOW, never catch up missed notes after backgrounding.
      nextBell = now + noteGaps[index];
    }
  }
  function setEnabled(value) {
    enabled = Boolean(value);
    // Turning it on alone does not claim playback. The click handler must
    // also call unlock(), leaving the status locked if the browser says so.
    syncGains();
    return enabled;
  }
  function setPaused(value) {
    const next = Boolean(value);
    if (paused === next) { refreshStatus(); return; }
    paused = next;
    if (context) nextBell = context.currentTime + 4.8;
    syncGains();
  }
  function test() {
    // A sound-test action visibly enables effects, and works in pause menus
    // without starting the ambient track or resuming gameplay.
    setEnabled(true);
    const result = unlock();
    return result.then(ok => {
      if (!ok || disposed || hidden) return false;
      ring(659.255, .17, .85, 0, true);
      ring(987.767, .12, 1.05, .23, true);
      return true;
    });
  }
  function onVisibility() {
    hidden = Boolean(doc?.hidden);
    syncGains();
    if (!context || context.state === 'closed') return;
    if (hidden) {
      try { context.suspend()?.catch?.(() => {}); } catch {}
    } else if (unlockedOnce && enabled && !paused) {
      // Resuming an already activated session is permitted on many browsers.
      // If iOS still needs a tap, state remains locked and the UI can say so.
      try { context.resume()?.then?.(syncGains, refreshStatus); } catch { refreshStatus(); }
      nextBell = context.currentTime + 4.8;
    }
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    doc?.removeEventListener?.('visibilitychange', onVisibility);
    for (const finish of pendingUnlocks) finish();
    pendingUnlocks.clear();
    for (const node of sources) { try { node.stop(); } catch {} }
    for (const node of nodes) { try { node.disconnect(); } catch {} }
    if (context) context.onstatechange = null;
    try { context?.close()?.catch?.(() => {}); } catch {}
    refreshStatus();
  }
  doc?.addEventListener?.('visibilitychange', onVisibility);
  // Expose the initial state immediately; the page must not display Sound On
  // merely because the preference is enabled while the audio is still locked.
  try { onStatus(status); } catch {}
  return {
    unlock, setEnabled, setPaused, update, chime, test, dispose,
    get enabled() { return enabled; },
    get status() { return currentStatus(); }
  };
}
