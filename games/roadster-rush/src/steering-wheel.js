/** Pointer-based wheel. Clockwise is positive; release immediately removes input. */
export function createSteeringWheel({ element, isEnabled = () => true, onChange = () => {} } = {}) {
  if (!element) throw new Error('The steering wheel control is missing.');
  const view = element.ownerDocument.defaultView;
  const rotor = element.querySelector('[data-wheel-rotor]');
  const modeLabel = element.ownerDocument.getElementById('steering-mode');
  const maxAngle = 110;
  let pointerId = null, pointerType = null, angle = 0, value = 0, airborne = false, disposed = false;
  let centerX = 0, centerY = 0, radius = 1, previousPointerAngle = 0;
  let horizontalDrag = false, startX = 0, throughCenter = false;
  const listeners = [];

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  }

  function setAngle(next) {
    const previous = value;
    angle = Math.max(-maxAngle, Math.min(maxAngle, next));
    value = angle / maxAngle;
    if (rotor) rotor.style.transform = `rotate(${angle}deg)`;
    element.dataset.value = value.toFixed(3);
    if (value !== previous) onChange(value, { active: pointerId !== null, pointerId, angle });
  }

  function reset() {
    const releasedId = pointerId;
    pointerId = null;
    pointerType = null;
    throughCenter = false;
    element.classList.remove('is-active');
    element.dataset.active = 'false';
    setAngle(0);
    // Clear the owner before releasing capture: lostpointercapture may fire now.
    if (releasedId !== null) {
      try {
        if (element.hasPointerCapture?.(releasedId)) element.releasePointerCapture(releasedId);
      } catch { /* A cancelled pointer may already have lost capture. */ }
    }
  }

  function consume(event) {
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
  }

  function press(event) {
    consume(event);
    if (disposed || pointerId !== null || !isEnabled()) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const bounds = element.getBoundingClientRect();
    centerX = bounds.left + bounds.width / 2;
    centerY = bounds.top + bounds.height / 2;
    radius = Math.max(1, Math.min(bounds.width, bounds.height) / 2);
    const x = event.clientX - centerX, y = event.clientY - centerY;
    horizontalDrag = Math.hypot(x, y) < radius * .28;
    previousPointerAngle = Math.atan2(y, x);
    startX = event.clientX;
    throughCenter = false;
    pointerId = event.pointerId;
    pointerType = event.pointerType || 'mouse';
    element.classList.add('is-active');
    element.dataset.active = 'true';
    // Grabbing any part of the rim starts at center, with no steering jump.
    setAngle(0);
    try { element.setPointerCapture(pointerId); } catch { /* Window handlers are the fallback. */ }
  }

  function move(event) {
    if (event.pointerId !== pointerId || pointerId === null) return;
    consume(event);
    if (!isEnabled()) { reset(); return; }
    if (horizontalDrag) {
      setAngle((event.clientX - startX) / (radius * .9) * maxAngle);
      return;
    }
    const x = event.clientX - centerX, y = event.clientY - centerY;
    // Crossing the hub must not produce a sudden 180-degree steering reversal.
    if (Math.hypot(x, y) < radius * .22) { throughCenter = true; return; }
    const nextPointerAngle = Math.atan2(y, x);
    if (throughCenter) {
      previousPointerAngle = nextPointerAngle;
      throughCenter = false;
      return;
    }
    let delta = nextPointerAngle - previousPointerAngle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    previousPointerAngle = nextPointerAngle;
    setAngle(angle + delta * 180 / Math.PI);
  }

  function release(event) {
    if (event.pointerId !== pointerId || pointerId === null) return;
    consume(event);
    reset();
  }

  function setMode(nextAirborne) {
    const next = Boolean(nextAirborne);
    if (next === airborne && element.dataset.mode) return;
    airborne = next;
    element.dataset.mode = airborne ? 'air' : 'road';
    element.classList.toggle('is-airborne', airborne);
    if (modeLabel) modeLabel.textContent = airborne ? 'AIR FLIP' : 'STEER';
    element.setAttribute('aria-label', airborne
      ? 'Steering wheel: turn left or right to flip in the air. You can also use the arrow keys.'
      : 'Steering wheel: drag to steer on the road. You can also use the arrow keys.');
  }

  listen(element, 'pointerdown', press, { passive: false });
  // Window listeners also cover browsers that refuse capture after a cancelled gesture.
  listen(view, 'pointermove', move, { passive: false });
  listen(view, 'pointerup', release, { passive: false });
  listen(view, 'pointercancel', release, { passive: false });
  listen(element, 'lostpointercapture', release);
  listen(element, 'click', consume);
  listen(element, 'contextmenu', consume);
  listen(element, 'dragstart', consume);
  // Embedded mobile browsers can blur while the game stays visible. Keep the
  // owning touch/pen alive; only a hidden page or lost mouse focus releases it.
  listen(view, 'blur', () => {
    if (element.ownerDocument.hidden || (pointerId !== null && pointerType !== 'touch' && pointerType !== 'pen')) reset();
  });
  listen(view, 'pagehide', reset);
  listen(view, 'resize', reset);
  listen(element.ownerDocument, 'visibilitychange', () => {
    if (element.ownerDocument.hidden) reset();
  });
  element.dataset.active = 'false';
  setAngle(0);
  setMode(false);

  return {
    getValue: () => value,
    getState: () => ({ value, active: pointerId !== null, pointerId, pointerType, angle, maxAngle, airborne }),
    reset,
    setMode,
    dispose() {
      if (disposed) return;
      reset();
      disposed = true;
      listeners.forEach(remove => remove());
    }
  };
}
