/** Cardinal swipe input shared by the wheel and unobstructed playfield. */
export function createSwipeControl({
  element, isEnabled = () => true, onLaneChange = () => {},
  onThrustChange = () => {}, onStateChange = () => {}
} = {}) {
  if (!element) throw new Error('The swipe control element is missing.');
  const doc = element.ownerDocument, view = doc.defaultView;
  const threshold = 36, neutralRadius = 12, dominance = 1.15;
  const listeners = [];
  let pointerId = null, pointerType = null, startX = 0, startY = 0;
  let anchorX = 0, anchorY = 0, dx = 0, dy = 0;
  let gesture = null, lastAction = null, thrusting = false, disposed = false;

  function state() {
    const value = gesture === 'left' ? -1 : gesture === 'right' ? 1 : 0;
    return { active: pointerId !== null, pointerId, pointerType, gesture,
      value, angle: value * 32, maxAngle: 32, thrusting, dx, dy, threshold };
  }
  function publish() { onStateChange(state()); }
  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  }
  function consume(event) {
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
  }
  function setThrust(next, cancelled = false) {
    const changed = thrusting !== next;
    thrusting = next;
    // Cancellation must also clear a launch burst that outlives normal release.
    if (changed || cancelled) onThrustChange(next, { cancelled });
  }
  function reset({ cancelled = true } = {}) {
    const releasedId = pointerId;
    // Clear the owner first: releasePointerCapture may dispatch lostcapture now.
    pointerId = null;
    pointerType = null;
    gesture = lastAction = null;
    dx = dy = 0;
    setThrust(false, cancelled);
    publish();
    if (releasedId !== null) {
      try {
        if (element.hasPointerCapture?.(releasedId)) element.releasePointerCapture(releasedId);
      } catch { /* The browser may already have cancelled pointer capture. */ }
    }
  }
  function update(clientX, clientY) {
    dx = clientX - startX;
    dy = clientY - startY;
    if (Math.hypot(dx, dy) <= neutralRadius) {
      gesture = lastAction = null;
      anchorX = startX;
      anchorY = startY;
      setThrust(false);
      publish();
      return;
    }

    // After a stroke, its tip becomes the origin for a change of direction.
    // This permits up -> side without requiring the player to lift their finger.
    const sx = clientX - anchorX, sy = clientY - anchorY;
    const ax = Math.abs(sx), ay = Math.abs(sy);
    let next = null;
    if (ax >= threshold && ax >= ay * dominance) next = sx < 0 ? 'left' : 'right';
    else if (sy <= -threshold && ay >= ax * dominance) next = 'up';
    else if (sy >= threshold && ay >= ax * dominance) next = 'down';
    if (!next) {
      // Follow an existing stroke's tip without repeating its action. Retain
      // ambiguous diagonals so horizontal steering cannot accidentally thrust.
      const extendsStroke =
        (lastAction === 'left' && sx < 0 && ax >= ay * dominance) ||
        (lastAction === 'right' && sx > 0 && ax >= ay * dominance) ||
        (lastAction === 'up' && sy < 0 && ay >= ax * dominance) ||
        (lastAction === 'down' && sy > 0 && ay >= ax * dominance);
      if (extendsStroke) { anchorX = clientX; anchorY = clientY; }
      publish();
      return;
    }
    const changed = next !== lastAction;
    gesture = next === 'down' ? null : next;
    lastAction = next;
    anchorX = clientX;
    anchorY = clientY;
    setThrust(next === 'up');
    publish();
    if (changed && (next === 'left' || next === 'right')) onLaneChange(next === 'left' ? -1 : 1);
  }
  function press(event) {
    // A disabled canvas belongs to garage orbit, and another finger belongs to
    // its own control. Neither event should be prevented or captured here.
    if (disposed || pointerId !== null || !isEnabled()) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    consume(event);
    pointerId = event.pointerId;
    pointerType = event.pointerType || 'mouse';
    startX = anchorX = event.clientX;
    startY = anchorY = event.clientY;
    dx = dy = 0;
    gesture = lastAction = null;
    publish();
    try { element.setPointerCapture(pointerId); } catch { /* Window listeners cover refused capture. */ }
  }
  function move(event) {
    if (pointerId === null || event.pointerId !== pointerId) return;
    consume(event);
    if (!isEnabled()) { reset(); return; }
    update(event.clientX, event.clientY);
  }
  function release(event) {
    if (pointerId === null || event.pointerId !== pointerId) return;
    consume(event);
    const enabled = isEnabled();
    // A quick flick may arrive at pointerup without an intermediate move event.
    if (enabled) update(event.clientX, event.clientY);
    reset({ cancelled: !enabled });
  }
  function cancel(event) {
    if (pointerId === null || event.pointerId !== pointerId) return;
    consume(event);
    reset();
  }
  function consumeIfEnabled(event) { if (!disposed && isEnabled()) consume(event); }

  listen(element, 'pointerdown', press, { passive: false });
  listen(view, 'pointermove', move, { passive: false });
  listen(view, 'pointerup', release, { passive: false });
  listen(view, 'pointercancel', cancel, { passive: false });
  listen(element, 'lostpointercapture', cancel);
  listen(element, 'click', consumeIfEnabled);
  listen(element, 'contextmenu', consumeIfEnabled);
  listen(element, 'dragstart', consumeIfEnabled);
  // Embedded mobile browsers can blur while visible. Keep touch/pen ownership
  // in that case; actual backgrounding and lost mouse focus cancel the gesture.
  listen(view, 'blur', () => {
    if (doc.hidden || (pointerId !== null && pointerType !== 'touch' && pointerType !== 'pen')) reset();
  });
  listen(view, 'pagehide', () => reset());
  listen(view, 'resize', () => { if (pointerId !== null) reset(); });
  listen(doc, 'visibilitychange', () => { if (doc.hidden) reset(); });

  return {
    getState: state,
    getValue: () => state().value,
    reset,
    dispose() {
      if (disposed) return;
      reset();
      disposed = true;
      listeners.forEach(remove => remove());
    }
  };
}

/** A wheel-shaped swipe pad. Tilt is feedback, never continuous steering. */
export function createSteeringWheel(options = {}) {
  const { element, onStateChange = () => {} } = options;
  if (!element) throw new Error('The steering wheel control is missing.');
  const rotor = element.querySelector('[data-wheel-rotor]');
  const modeLabel = element.ownerDocument.getElementById('steering-mode');
  let airborne = false;
  function render(state) {
    element.dataset.active = String(state.active);
    element.dataset.value = String(state.value);
    element.dataset.gesture = state.gesture || 'none';
    element.dataset.mode = airborne ? 'air' : 'road';
    element.classList.toggle('is-active', state.active);
    element.classList.toggle('is-airborne', airborne);
    element.classList.toggle('is-thrusting', state.thrusting);
    if (rotor) rotor.style.transform = `rotate(${state.angle}deg)`;
    if (modeLabel) modeLabel.textContent = state.thrusting ? 'THRUST' : airborne ? 'LANE + FLIP' : 'SWIPE LANES';
    element.setAttribute('aria-label', airborne
      ? 'Swipe left or right for one lane change and a flip. Swipe up to thrust; hold up to keep flying.'
      : 'Swipe left or right to move one lane. Swipe up to thrust; hold up to keep flying.');
    onStateChange({ ...state, airborne });
  }
  const control = createSwipeControl({ ...options, onStateChange: render });
  // Rendering has no gameplay callbacks, so construction is safe before the
  // game has initialized its input state. The generic canvas stays untouched.
  render(control.getState());
  return {
    ...control,
    getState: () => ({ ...control.getState(), airborne }),
    setMode(nextAirborne) {
      const next = Boolean(nextAirborne);
      if (next === airborne) return;
      airborne = next;
      render(control.getState());
    }
  };
}
