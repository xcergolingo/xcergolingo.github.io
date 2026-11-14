import * as THREE from './vendor/three.module.js';

const UP = new THREE.Vector3(0, 1, 0);
const NEUTRAL = new THREE.Color(0x9ff8ef);
const WRONG = new THREE.Color(0xff866e);
const CORRECT = new THREE.Color(0xbaffb2);
const clamp = THREE.MathUtils.clamp;

function finiteVector(value) {
  return value && Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);
}

function segmentDistanceSquared(point, from, to, along, closest) {
  along.subVectors(to, from);
  const lengthSquared = along.lengthSq();
  const t = lengthSquared > 1e-8
    ? clamp(closest.subVectors(point, from).dot(along) / lengthSquared, 0, 1)
    : 0;
  closest.copy(from).addScaledVector(along, t);
  return closest.distanceToSquared(point);
}

/**
 * Three reusable word signals. This component never moves the player, chooses
 * the correct answer, pauses the game, or owns speech / score / lesson state.
 * The caller should update it before testing projectile segments each frame.
 */
export class WordSignals {
  constructor({ scene, labels, camera, learning, onAnswer = () => {} }) {
    if (!scene || !camera || !learning) throw new Error('WordSignals needs a scene, camera and lesson controller.');
    this.scene = scene;
    this.labels = labels;
    this.camera = camera;
    this.learning = learning;
    this.onAnswer = onAnswer;
    this.time = 0;
    this.active = false;
    this.disposed = false;
    this.pendingReset = true;
    this.questionId = null;
    this.worldId = null;
    this.space = false;
    this.lastPosition = new THREE.Vector3();
    this.hasLastPosition = false;
    this.center = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, -1);
    this.right = new THREE.Vector3(1, 0, 0);
    this.along = new THREE.Vector3();
    this.closest = new THREE.Vector3();
    this.relative = new THREE.Vector3();
    this.projected = new THREE.Vector3();
    this.labelPosition = new THREE.Vector3();
    this.armedAt = 0;
    this.viewport = { width: 1, height: 1 };
    this.snapshot = learning.getSnapshot();

    this.group = new THREE.Group();
    this.group.name = 'GoLingo vocabulary flight signals';
    scene.add(this.group);
    this.geometries = {
      core: new THREE.TorusGeometry(1, .017, 5, 64),
      glow: new THREE.TorusGeometry(1, .039, 5, 48),
      outer: new THREE.TorusGeometry(1.09, .0045, 4, 48),
    };
    this.targets = Array.from({ length: 3 }, (_, slot) => this._makeTarget(slot));
    const unsubscribe = learning.subscribe?.((snapshot) => {
      this.snapshot = snapshot || learning.getSnapshot();
      const id = this.snapshot.question?.id ?? null;
      if (id !== this.questionId || this.snapshot.enabled === false) {
        this.pendingReset = true;
        this.active = false;
        this._hide();
      }
    });
    this.unsubscribe = typeof unsubscribe === 'function' ? unsubscribe : null;
  }

  _makeTarget(slot) {
    const root = new THREE.Group();
    root.name = `Vocabulary signal ${slot + 1}`;
    root.visible = false;
    this.group.add(root);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: NEUTRAL.clone(), transparent: true, opacity: .93,
      depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending,
    });
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: NEUTRAL.clone(), transparent: true, opacity: .15,
      depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending,
    });
    const outerMaterial = new THREE.MeshBasicMaterial({
      color: NEUTRAL.clone(), transparent: true, opacity: .29,
      depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending,
    });
    const core = new THREE.Mesh(this.geometries.core, coreMaterial);
    const glow = new THREE.Mesh(this.geometries.glow, glowMaterial);
    const outer = new THREE.Mesh(this.geometries.outer, outerMaterial);
    for (const mesh of [core, glow, outer]) {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      root.add(mesh);
    }

    let label = null, word = null, caption = null;
    const doc = labelsDocument(this.labels);
    if (this.labels && doc) {
      label = doc.createElement('div');
      label.className = 'word-signal-label';
      label.setAttribute('aria-hidden', 'true');
      Object.assign(label.style, {
        position: 'absolute', pointerEvents: 'none', display: 'none',
        transform: 'translate(-50%, -100%)', maxWidth: '180px',
        textAlign: 'center', color: '#d5fff5',
        textShadow: '0 2px 3px #051e28, 0 0 10px #051e28',
        fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '14px',
        fontWeight: '600', letterSpacing: '.015em', lineHeight: '1.3',
      });
      word = doc.createElement('span');
      word.className = 'word-signal-text';
      Object.assign(word.style, {
        display: '-webkit-box', WebkitLineClamp: '2',
        WebkitBoxOrient: 'vertical', overflow: 'hidden',
        overflowWrap: 'anywhere', maxWidth: '180px',
      });
      caption = doc.createElement('small');
      caption.className = 'word-signal-caption';
      Object.assign(caption.style, {
        display: 'block', marginTop: '5px', fontSize: '7px',
        letterSpacing: '.15em', fontWeight: '400', opacity: '.82',
      });
      label.appendChild(word);
      label.appendChild(caption);
      this.labels.appendChild(label);
    }
    return {
      slot, root, coreMaterial, glowMaterial, outerMaterial,
      position: new THREE.Vector3(), token: null, entry: null,
      label, word, caption, radius: 25, active: false,
      disabledUntil: 0, flashUntil: 0, needsExit: false, flashCorrect: false,
    };
  }

  _hide() {
    this.group.visible = false;
    for (const target of this.targets) {
      target.root.visible = false;
      target.active = false;
      if (target.label) target.label.style.display = 'none';
    }
  }

  reset() {
    this.pendingReset = true;
    this.active = false;
    this.hasLastPosition = false;
    this._hide();
  }

  _place(frame, snapshot) {
    const choices = (this.learning.getChoices?.() || snapshot.question?.choices || []).slice(0, 3);
    const count = snapshot.mode === 'learn' ? Math.min(1, choices.length) : choices.length;
    if (!count) {
      this.active = false;
      this._hide();
      return false;
    }
    const yaw = Number.isFinite(frame.yaw) ? frame.yaw : 0;
    const pitch = clamp(Number(frame.pitch) || 0, -.6, 1.1);
    this.forward.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).normalize();
    // Horizontal lateral spacing makes options easy to read even on a climb.
    this.right.set(Math.cos(yaw), 0, Math.sin(yaw));
    const lead = clamp(Math.max(250, Math.max(0, Number(frame.speed) || 0) * 6), 250, 1500);
    const spacing = frame.space ? 160 : 95;
    const radius = frame.space ? 50 : 25;
    this.center.copy(frame.position).addScaledVector(this.forward, lead);
    if (!frame.space) this.center.y += 6;
    this.questionId = snapshot.question?.id ?? null;
    this.worldId = frame.worldId;
    this.space = !!frame.space;
    this.pendingReset = false;
    this.active = true;
    this.group.visible = true;
    this.armedAt = this.time + .25;

    for (let i = 0; i < this.targets.length; i++) {
      const target = this.targets[i];
      target.active = i < count;
      target.root.visible = target.active;
      if (!target.active) {
        target.token = null;
        target.entry = null;
        if (target.label) target.label.style.display = 'none';
        continue;
      }
      const choice = choices[i];
      target.token = choice.token;
      target.entry = choice.entry;
      target.radius = radius;
      target.position.copy(this.center).addScaledVector(this.right, (i - (count - 1) / 2) * spacing);
      if (!frame.space && typeof frame.groundAt === 'function') {
        const floor = frame.groundAt(target.position);
        if (Number.isFinite(floor)) target.position.y = Math.max(target.position.y, floor + radius + 12);
      }
      target.root.position.copy(target.position);
      target.root.scale.setScalar(radius);
      target.disabledUntil = 0;
      target.flashUntil = 0;
      target.needsExit = false;
      target.flashCorrect = false;
      const text = String(this.learning.textFor(choice.entry, false) || '');
      if (target.word) target.word.textContent = text;
      if (target.label) target.label.title = text;
      if (target.caption) target.caption.textContent = count === 1 ? 'FLY THROUGH · OR FIRE' : `${i + 1} · FLY THROUGH OR FIRE`;
      this._applyColor(target, NEUTRAL);
    }
    return true;
  }

  _applyColor(target, color) {
    target.coreMaterial.color.copy(color);
    target.glowMaterial.color.copy(color);
    target.outerMaterial.color.copy(color);
    if (target.label) target.label.style.color = color === WRONG ? '#ffb1a0' : '#d5fff5';
  }

  _present(frame, snapshot) {
    this.viewport.width = Math.max(1, frame.viewport?.width || this.viewport.width || 1);
    this.viewport.height = Math.max(1, frame.viewport?.height || this.viewport.height || 1);
    const markerVisible = snapshot.settings?.showMarkers !== false;
    for (const target of this.targets) {
      if (!target.active) continue;
      target.root.lookAt(this.camera.position);
      target.root.scale.setScalar(target.radius * (1 + Math.sin(this.time * 2.5 + target.slot) * .012));
      const flashing = this.time < target.flashUntil;
      this._applyColor(target, flashing ? (target.flashCorrect ? CORRECT : WRONG) : NEUTRAL);
      target.coreMaterial.opacity = flashing ? .98 : .83 + Math.sin(this.time * 2 + target.slot) * .09;
      target.outerMaterial.opacity = .21 + Math.sin(this.time * 1.4 + target.slot) * .06;
      if (!target.label) continue;
      if (!markerVisible) { target.label.style.display = 'none'; continue; }
      this.labelPosition.copy(target.position).addScaledVector(UP, target.radius * 1.28);
      this.projected.copy(this.labelPosition).project(this.camera);
      const shown = this.projected.z > -1 && this.projected.z < 1 && Math.abs(this.projected.x) < 1.08 && Math.abs(this.projected.y) < 1.08;
      target.label.style.display = shown ? 'block' : 'none';
      if (shown) {
        target.label.style.left = `${(this.projected.x * .5 + .5) * this.viewport.width}px`;
        target.label.style.top = `${(-this.projected.y * .5 + .5) * this.viewport.height}px`;
      }
    }
  }

  update(dt, frame) {
    if (this.disposed || !frame || !finiteVector(frame.position)) return;
    const delta = clamp(Number(dt) || 0, 0, .1);
    this.time += delta;
    const snapshot = this.learning.getSnapshot();
    this.snapshot = snapshot;
    const allowed = snapshot.enabled !== false && snapshot.settings?.enabled !== false && frame.active !== false
      && !frame.paused && !frame.onFoot && !frame.cable && !frame.travel && !frame.landing
      && !!snapshot.question && (snapshot.question.choices?.length || this.learning.getChoices?.().length);
    if (!allowed) {
      this.active = false;
      this.pendingReset = true;
      this.lastPosition.copy(frame.position);
      this.hasLastPosition = false;
      this._hide();
      return;
    }

    if (snapshot.question.id !== this.questionId || frame.worldId !== this.worldId || !!frame.space !== this.space) this.pendingReset = true;
    const yaw = Number(frame.yaw) || 0, pitch = Number(frame.pitch) || 0;
    this.forward.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    this.relative.subVectors(this.center, frame.position);
    const recycle = this.active && (this.relative.dot(this.forward) < -250 || this.relative.lengthSq() > 3000 * 3000);

    if (this.pendingReset || !this.active) {
      this._place(frame, snapshot);
      this.lastPosition.copy(frame.position);
      this.hasLastPosition = true;
      this._present(frame, snapshot);
      return; // Never collect an object on the frame that placed it.
    }

    this._present(frame, snapshot);
    let answered = false;
    if (this.hasLastPosition && this.time >= this.armedAt) {
      for (const target of this.targets) {
        if (!target.active) continue;
        if (target.needsExit && target.position.distanceToSquared(frame.position) > (target.radius + 15) ** 2) target.needsExit = false;
        if (target.needsExit || this.time < target.disabledUntil) continue;
        const radius = target.radius + (frame.space ? 10 : 6);
        if (segmentDistanceSquared(target.position, this.lastPosition, frame.position, this.along, this.closest) <= radius * radius) {
          answered = this._answer(target, 'flight');
          break; // At most one answer per movement segment.
        }
      }
    }
    this.lastPosition.copy(frame.position);
    this.hasLastPosition = true;
    // A fast crossing gets a chance to collect before a missed signal is recycled.
    if (!answered && recycle) {
      this._place(frame, snapshot);
      this._present(frame, snapshot);
    }
  }

  _answer(target, source) {
    if (!target.active || !this.active || this.pendingReset || this.time < this.armedAt || this.time < target.disabledUntil) return false;
    const snapshot = this.learning.getSnapshot();
    if (snapshot.question?.id !== this.questionId) { this.reset(); return false; }
    const position = target.position.clone();
    const result = this.learning.answer(target.token, { source });
    if (result?.reason === 'cooldown') {
      target.disabledUntil = this.time + .2;
      return true; // Consume the impact without inventing a wrong answer.
    }
    if (!result || result.reason === 'stale' || result.reason === 'invalid' || result.reason === 'disabled') {
      this.pendingReset = true;
      this.active = false;
      this._hide();
      return true;
    }
    target.flashCorrect = !!result.correct;
    target.flashUntil = this.time + 1.1;
    target.disabledUntil = this.time + 1.25;
    target.needsExit = source === 'flight';
    this._applyColor(target, result.correct ? CORRECT : WRONG);
    if (result.correct) {
      this.active = false;
      this.pendingReset = true;
      this.hasLastPosition = false;
      this._hide(); // A second bolt from the same cannon volley cannot answer the next word.
    }
    this.onAnswer(result, { position, source });
    return true;
  }

  hitTest(from, to) {
    if (this.disposed || !this.active || this.pendingReset || this.time < this.armedAt || !finiteVector(from) || !finiteVector(to)) return false;
    // Choosing the nearest intersection keeps overlapping perspective options fair.
    let candidate = null, nearest = Infinity;
    for (const target of this.targets) {
      if (!target.active || this.time < target.disabledUntil) continue;
      const radius = target.radius + 4;
      if (segmentDistanceSquared(target.position, from, to, this.along, this.closest) <= radius * radius) {
        const distance = this.closest.distanceToSquared(from);
        if (distance < nearest) { nearest = distance; candidate = target; }
      }
    }
    return candidate ? this._answer(candidate, 'cannon') : false;
  }

  /** Read-only diagnostic positions; returned vectors do not expose live state. */
  getTargets() {
    return this.targets.filter(target => target.active && this.active).map(target => ({
      slot: target.slot, token: target.token, word: this.learning.textFor(target.entry, false),
      position: target.position.clone(), radius: target.radius,
      enabled: !this.pendingReset && this.time >= this.armedAt && this.time >= target.disabledUntil,
    }));
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe?.();
    this._hide();
    for (const target of this.targets) {
      target.coreMaterial.dispose(); target.glowMaterial.dispose(); target.outerMaterial.dispose();
      if (target.label?.parentNode) target.label.parentNode.removeChild(target.label);
      else if (target.label?.remove) target.label.remove();
    }
    for (const geometry of Object.values(this.geometries)) geometry.dispose();
    this.scene.remove(this.group);
  }
}

function labelsDocument(labels) {
  return labels?.ownerDocument || (typeof document !== 'undefined' ? document : null);
}
