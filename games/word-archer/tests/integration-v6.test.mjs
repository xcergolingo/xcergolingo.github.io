import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
import * as THREE from '../vendor/three.module.js';
import {createArrow, launchSpeed, launchVelocity, FIXED_TIMESTEP} from '../physics-v6.js';

// Execute the production functions and event registrations, not copied versions.
// This checks controls/state/geometry without pretending to render WebGL or iOS.
const source = readFileSync(new URL('../main-v6.js', import.meta.url), 'utf8');
function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Production function ${name} exists`);
  const firstLineEnd = source.indexOf('\n', start);
  const firstLine = source.slice(start, firstLineEnd);
  if (firstLine.endsWith('}')) return firstLine;
  const end = source.indexOf('\n}', firstLineEnd);
  assert.notEqual(end, -1, `Production function ${name} has a closing brace`);
  return source.slice(start, end + 2);
}
function compile(names, globals) {
  const context = vm.createContext(globals);
  vm.runInContext(names.map(functionSource).join('\n'), context, {filename: 'main-v6.selected.js'});
  return context;
}
function element() {
  const classes = new Set();
  const listeners = new Map();
  return {
    hidden: false, textContent: '', dataset: {}, captured: null,
    style: {setProperty(name, value) {this[name] = value;}},
    classList: {
      add(...names) {names.forEach(name => classes.add(name));},
      remove(...names) {names.forEach(name => classes.delete(name));},
      contains(name) {return classes.has(name);},
      toggle(name, force) {
        const add = force === undefined ? !classes.has(name) : force;
        if (add) classes.add(name); else classes.delete(name);
        return add;
      },
    },
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(callback);
    },
    dispatch(type, values = {}) {
      const event = {type, defaultPrevented: false, ...values,
        preventDefault() {this.defaultPrevented = true;}, stopPropagation() {}};
      for (const callback of listeners.get(type) || []) callback(event);
      return event;
    },
    setPointerCapture(id) {this.captured = id;},
    getBoundingClientRect() {return {left: 0, top: 0, width: 124, height: 124};},
  };
}
function elements() {
  return Object.fromEntries(['app', 'viewport', 'pad', 'knob', 'draw', 'drawLabel',
    'drawPercent', 'drawHint', 'status', 'sight', 'sightCaption'].map(key => [key, element()]));
}
function labels() {return Array.from({length: 3}, () => ({node: element(), word: element()}));}
const noop = () => {};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const v3 = point => new THREE.Vector3(point.x, point.y, point.z);
function near(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≈ ${expected}`);
}

test('new lesson clears visible hit classes as well as logical target locks', () => {
  const targetLabels = labels();
  targetLabels.forEach(label => label.node.classList.add('hit'));
  const state = {words: [{word: 'one'}, {word: 'two'}, {word: 'three'}], cursor: 9, locked: [true, true, true]};
  const c = compile(['fillWords'], {state, targetLabels,
    shuffledIndexes: () => [0, 1, 2], nextWord: () => state.words[state.deck[state.cursor++]],
    updateLabels: noop, chooseGoal: noop});
  c.fillWords();
  assert.deepEqual([...state.locked], [false, false, false]);
  assert.equal(state.targetWords.length, 3);
  assert.ok(targetLabels.every(label => !label.node.classList.contains('hit')));
});

function impactHarness() {
  const word = {word: '水', translation: 'water'};
  const state = {mode: 'listen', goal: 1, words: [word], targetWords: [word, word, word],
    locked: [false, false, false], score: 0, hits: 0, streak: 0, lessonId: 2,
    history: [], stuck: [], pulses: [], paused: false};
  const notices = [], timers = [], lessons = [];
  const c = compile(['onImpact'], {THREE, state, E: elements(), targetLabels: labels(),
    scene: new THREE.Scene(), world: {targets: Array.from({length: 3}, (_, index) => ({center: new THREE.Vector3(index * 3, 1.6, -17)}))},
    direction: new THREE.Vector3(), arrowForward: new THREE.Vector3(0, 0, -1), v3,
    dropMesh: noop, tone: noop, updateStats: noop, speak: noop, playClue: noop,
    showLesson: item => lessons.push(item), updateLabels: noop, chooseGoal: noop,
    nextWord: () => ({word: '火', translation: 'fire'}),
    notice: (...args) => notices.push(args), setTimeout: (fn, ms) => {timers.push({fn, ms}); return timers.length;}});
  const shot = () => ({mesh: new THREE.Group(), trail: new THREE.Group(), power: 1, resolved: false});
  const event = {type: 'target', position: {x: 0, y: 1.6, z: -17}, velocity: {x: 0, y: -1, z: -43}, targetIndex: 0, points: 10};
  return {c, state, notices, timers, lessons, shot, event};
}
test('duplicate correct words on non-goal targets are accepted', () => {
  const {c, state, shot, event, lessons} = impactHarness();
  c.onImpact(shot(), event);
  assert.equal(state.goal, 1);
  assert.equal(event.targetIndex, 0);
  assert.equal(state.score, 10);
  assert.equal(state.hits, 1);
  assert.equal(state.history.length, 1);
  assert.equal(lessons[0].word, '水');
});
test('a repeated physical hit while a word is loading scores with explicit feedback', () => {
  const {c, state, notices, shot, event} = impactHarness();
  c.onImpact(shot(), event);
  c.onImpact(shot(), event);
  assert.equal(state.score, 20);
  assert.equal(state.streak, 2);
  assert.equal(state.hits, 1, 'Do not collect a loading word twice');
  assert.equal(state.history.length, 1);
  assert.match(notices.at(-1)[1], /NEXT WORD LOADING/);
});
test('targets refresh in 1.1 seconds, and stale lesson timers cannot alter a new lesson', () => {
  const {c, state, timers, shot, event} = impactHarness();
  c.onImpact(shot(), event);
  const replacement = timers.find(timer => timer.ms === 1100);
  assert.ok(replacement, 'Short loading interval must be scheduled');
  replacement.fn();
  assert.equal(state.targetWords[0].word, '火');
  assert.equal(state.locked[0], false);
  state.targetWords[0] = {word: 'new lesson'};
  state.lessonId++;
  replacement.fn();
  assert.equal(state.targetWords[0].word, 'new lesson');
});
test('the same resolved arrow cannot score twice; wrong targets and ground impacts do not score', () => {
  const {c, state, shot, event} = impactHarness();
  const first = shot();
  c.onImpact(first, event);
  c.onImpact(first, event);
  assert.equal(state.score, 10);
  state.targetWords[0] = {word: 'wrong'};
  c.onImpact(shot(), event);
  assert.equal(state.score, 10);
  assert.equal(state.streak, 0);
  c.onImpact(shot(), {...event, type: 'ground'});
  assert.equal(state.score, 10);
});

test('idle guide samples full-draw muzzle then restores visible follow-through pose', () => {
  const poses = [], predictions = [];
  let pose = {draw: 0};
  const archer = {group: {updateMatrixWorld: noop},
    update(next) {pose = next; poses.push(next);},
    getMuzzlePosition(target) {return target.set(pose.draw, 1.5, -.8);},
    getArrowDirection(target) {return target.set(0, 0, -1);}};
  const state = {drawing: false, draw: 0, yaw: .1, pitch: .2, shotAt: 4.84,
    started: true, paused: false, guide: true, wind: {x: 0, y: 0, z: 0}};
  const E = elements();
  const c = compile(['updateGuide'], {state, E, archer, elapsed: 5, launchSpeed,
    world: {targets: []}, muzzle: new THREE.Vector3(), direction: new THREE.Vector3(),
    predicted: null, width: 800, height: 450, clamp, v3, guideGeometry: {},
    guideLine: {computeLineDistances: noop}, guideMaterial: {color: {setHex: noop}},
    writeLine: noop, screenPoint: () => ({x: 400, y: 225, visible: true}),
    predictTrajectory(origin, velocity, targets, wind, options) {
      predictions.push({origin: origin.clone(), velocity: velocity.clone(), options});
      return {points: [{x: 0, y: 0, z: -10}], impact: {type: 'ground', position: {x: 0, y: 0, z: -10}}};
    }});
  c.updateGuide();
  assert.equal(poses[0].draw, 1);
  assert.equal(poses[0].release, 0);
  assert.equal(predictions[0].origin.x, 1, 'Use the full-draw pose, not idle muzzle');
  assert.equal(predictions[0].velocity.z, -44);
  assert.equal(predictions[0].options.maxTime, 4, 'Guide and live arrow lifetime must match');
  assert.equal(poses[1].draw, 0);
  near(poses[1].release, .5);
  assert.equal(pose.draw, 0, 'Sampling must not change the rendered pose');
  assert.equal(E.sightCaption.textContent, 'FULL DRAW SIGHT');
});
test('current draw guide uses current power and never substitutes a full draw', () => {
  let speed;
  const c = compile(['updateGuide'], {state: {drawing: true, draw: .3, started: true, paused: false, guide: true, wind: {}},
    E: elements(), archer: {getMuzzlePosition: target => target.set(0, 1.5, -.8), getArrowDirection: target => target.set(0, 0, -1)},
    muzzle: new THREE.Vector3(), direction: new THREE.Vector3(), launchSpeed,
    world: {targets: []}, predicted: null, width: 800, height: 450, clamp, v3,
    guideGeometry: {}, guideLine: {computeLineDistances: noop}, guideMaterial: {color: {setHex: noop}},
    writeLine: noop, screenPoint: () => ({x: 400, y: 225, visible: true}),
    predictTrajectory(origin, velocity) {speed = velocity.length(); return {points: [{x: 0, y: 0, z: -5}], impact: null};}});
  c.updateGuide();
  near(speed, launchSpeed(.3));
});
test('camera matrix is updated immediately after lookAt and before label projection', () => {
  const calls = [];
  const c = compile(['cameraUpdate'], {state: {camera: 'shoulder', yaw: .2, pitch: .1, basePitch: .06}, portrait: false,
    cameraGoal: new THREE.Vector3(), lookGoal: new THREE.Vector3(), lookCurrent: new THREE.Vector3(),
    camera: {position: new THREE.Vector3(), lookAt() {calls.push('lookAt');}, updateMatrixWorld(force) {calls.push(['matrix', force]);}}});
  c.cameraUpdate(1 / 60);
  assert.deepEqual(calls, ['lookAt', ['matrix', true]]);
});
test('dynamic guide and trail lines can grow without overflowing their position buffer', () => {
  const c = compile(['lineGeometry', 'writeLine'], {THREE, Float32Array});
  const geometry = c.lineGeometry(260), originalBuffer = geometry.attributes.position.array;
  const points = Array.from({length: 220}, (_, i) => ({x: i, y: i * .1, z: -i}));
  c.writeLine(geometry, points.slice(0, 2));
  c.writeLine(geometry, points);
  assert.equal(geometry.attributes.position.array, originalBuffer);
  assert.equal(geometry.drawRange.count, 220);
  near(geometry.attributes.position.getZ(219), -219);
  c.writeLine(geometry, Array(300).fill(points[0]));
  assert.equal(geometry.drawRange.count, 260, 'Writes beyond capacity are bounded');
  assert.match(source, /guideGeometry=lineGeometry\(260\)/, 'Four-second guide has enough preallocated vertices');
  geometry.dispose();
});

function inputHarness() {
  const E = elements(), targetLabels = labels();
  const state = {ready: true, started: true, paused: false, drawing: false, draw: 0, drawStart: 0,
    yaw: 0, pitch: 0, basePitch: 0, cooldown: 0, shotAt: -10, shots: 0, arrows: [], pulses: [], labels: true, wind: {x: 0, y: 0, z: 0}};
  const input = {padId: null, drawId: null, viewId: null, padX: 0, padY: 0, lastX: 0, lastY: 0, keys: new Set()};
  const window = element(); window.visualViewport = element();
  const document = element(); document.activeElement = {tagName: 'BODY'}; document.querySelectorAll = () => []; document.hidden = false;
  let pose = {draw: 0, yaw: 0, pitch: 0};
  const archer = {group: {updateMatrixWorld: noop}, update(next) {pose = next;},
    getMuzzlePosition(target) {return target.set(.04, 1.49, -.83 + pose.draw * .32);},
    getArrowDirection(target) {const direction = launchVelocity(pose.yaw, pose.pitch, 1); return target.set(direction.x, direction.y, direction.z);}};
  const c = compile(['lineGeometry', 'writeLine', 'resetInput', 'beginDraw', 'cancelDraw', 'fire', 'modal', 'closeModals', 'frame'], {
    THREE, Float32Array, state, input, E, window, document, archer,
    elapsed: 0, lastFrame: 0, accumulator: 0, guideTick: 0, width: 800, height: 450,
    renderer: {render: noop}, scene: new THREE.Scene(), camera: {}, targetLabels,
    world: {update: noop, targets: Array.from({length: 3}, () => ({wordAnchor: new THREE.Vector3()}))},
    muzzle: new THREE.Vector3(), direction: new THREE.Vector3(), arrowForward: new THREE.Vector3(0, 0, -1),
    launchSpeed, createArrow, createArrowMesh: () => new THREE.Group(), FIXED_TIMESTEP, clamp,
    unlockSound: noop, tone: noop, updateStats: noop, stopVoice: noop, resumeVoice: noop, populateReview: noop,
    updatePhysics: noop, updateTrails: noop, updateGuide: noop, cameraUpdate: noop, dropMesh: noop, resize: noop,
    screenPoint: () => ({x: 400, y: 225, visible: true}), requestAnimationFrame: noop,
  });
  const eventStart = source.indexOf("E.pad.addEventListener('pointerdown'");
  const eventEnd = source.indexOf("E.start.addEventListener('click'", eventStart);
  assert.ok(eventStart >= 0 && eventEnd > eventStart, 'Production input registrations can be located');
  vm.runInContext(source.slice(eventStart, eventEnd), c, {filename: 'main-v6.inputs.js'});
  function advance(seconds) {
    const frames = Math.ceil(seconds * 60);
    for (let i = 0; i < frames; i++) c.frame(c.lastFrame + seconds / frames * 1000);
  }
  return {c, state, input, E, window, document, advance};
}
test('thumb-pad right/up input moves yaw/pitch right/up, with pointer ownership and cancel reset', () => {
  const {state, input, E, advance} = inputHarness();
  E.pad.dispatch('pointerdown', {pointerId: 1, clientX: 82, clientY: 42});
  assert.ok(input.padX > 0 && input.padY > 0);
  advance(1 / 60);
  assert.ok(state.yaw > 0 && state.pitch > 0);
  const priorX = input.padX;
  E.pad.dispatch('pointermove', {pointerId: 2, clientX: 0, clientY: 124});
  assert.equal(input.padX, priorX, 'A second pointer cannot steal the pad');
  E.pad.dispatch('pointercancel', {pointerId: 1});
  assert.equal(input.padId, null);
  assert.equal(input.padX, 0);
  assert.equal(input.padY, 0);
});
test('dragging the scene right/up has correct signs and release ends drag', () => {
  const {state, input, E} = inputHarness();
  E.viewport.dispatch('pointerdown', {pointerId: 3, clientX: 100, clientY: 200});
  E.viewport.dispatch('pointermove', {pointerId: 3, clientX: 130, clientY: 170});
  assert.ok(state.yaw > 0 && state.pitch > 0);
  const yaw = state.yaw;
  E.viewport.dispatch('pointermove', {pointerId: 4, clientX: 0, clientY: 0});
  assert.equal(state.yaw, yaw);
  E.viewport.dispatch('pointerup', {pointerId: 3});
  assert.equal(input.viewId, null);
});
test('two-thumb aim and hold/release fires exactly one physical arrow at current draw power', () => {
  const {state, input, E, advance} = inputHarness();
  E.pad.dispatch('pointerdown', {pointerId: 1, clientX: 72, clientY: 52});
  E.draw.dispatch('pointerdown', {pointerId: 2});
  assert.equal(input.padId, 1);
  assert.equal(input.drawId, 2);
  advance(1.15);
  assert.equal(state.draw, 1);
  assert.equal(E.drawPercent.textContent, '100%');
  E.draw.dispatch('pointerup', {pointerId: 2});
  assert.equal(state.shots, 1);
  assert.equal(state.arrows.length, 1);
  const arrow = state.arrows[0];
  near(Math.hypot(arrow.flight.velocity.x, arrow.flight.velocity.y, arrow.flight.velocity.z), 44);
  assert.equal(arrow.flight.active, true);
  assert.equal(arrow.flight.age, 0);
  assert.equal(arrow.resolved, false);
  near(arrow.flight.position.z, -.51, 1e-8);
  assert.equal('targetIndex' in arrow.flight, false, 'Release does not preselect a hit');
  assert.equal(state.drawing, false);
  assert.equal(input.padId, 1, 'Shooting does not interrupt aiming');
  E.draw.dispatch('pointerup', {pointerId: 2});
  assert.equal(state.shots, 1, 'Duplicate release cannot double-fire');
});
test('shorter hold changes actual launch speed, and cooldown rejects premature draws', () => {
  const {state, E, advance} = inputHarness();
  E.draw.dispatch('pointerdown', {pointerId: 2});
  advance(.3);
  const power = state.draw;
  E.draw.dispatch('pointerup', {pointerId: 2});
  near(v3(state.arrows[0].flight.velocity).length(), launchSpeed(power));
  assert.ok(launchSpeed(power) < 25);
  E.draw.dispatch('pointerdown', {pointerId: 3});
  assert.equal(state.drawing, false);
  advance(.7);
  E.draw.dispatch('pointerdown', {pointerId: 3});
  assert.equal(state.drawing, true);
});
test('cancel, paused input, and opening a modal mid-draw never fire', () => {
  const {c, state, input, E, advance} = inputHarness();
  E.draw.dispatch('pointerdown', {pointerId: 1}); advance(.5);
  E.draw.dispatch('pointercancel', {pointerId: 1});
  E.draw.dispatch('pointerup', {pointerId: 1});
  assert.equal(state.shots, 0);
  assert.equal(state.draw, 0);
  state.paused = true;
  E.draw.dispatch('pointerdown', {pointerId: 2}); E.draw.dispatch('pointerup', {pointerId: 2});
  assert.equal(state.shots, 0);
  assert.equal(input.drawId, null);
  state.paused = false;
  E.draw.dispatch('pointerdown', {pointerId: 3}); advance(.4);
  c.modal('settings-screen');
  assert.equal(state.paused, true);
  assert.equal(state.drawing, false);
  assert.equal(input.drawId, null);
  E.draw.dispatch('pointerup', {pointerId: 3});
  assert.equal(state.shots, 0);
  c.closeModals();
  assert.equal(state.paused, false);
});
test('blur and hidden document cancel held input instead of firing when resumed', () => {
  const {state, input, E, window, document, advance} = inputHarness();
  E.draw.dispatch('pointerdown', {pointerId: 1}); advance(.5);
  window.dispatch('blur');
  E.draw.dispatch('pointerup', {pointerId: 1});
  assert.equal(state.shots, 0);
  assert.equal(state.drawing, false);
  E.draw.dispatch('pointerdown', {pointerId: 2}); advance(.5);
  document.hidden = true; document.dispatch('visibilitychange');
  assert.equal(input.drawId, null);
  document.hidden = false; document.dispatch('visibilitychange');
  E.draw.dispatch('pointerup', {pointerId: 2});
  assert.equal(state.shots, 0);
});
test('Space holds charge and releases once; repeated keydown does not restart draw', () => {
  const {state, window, advance} = inputHarness();
  window.dispatch('keydown', {code: 'Space'}); advance(.5);
  const start = state.drawStart;
  window.dispatch('keydown', {code: 'Space', repeat: true});
  assert.equal(state.drawStart, start);
  advance(.65);
  window.dispatch('keyup', {code: 'Space'});
  assert.equal(state.shots, 1);
  assert.equal(state.arrows[0].power, 1);
  window.dispatch('keyup', {code: 'Space'});
  assert.equal(state.shots, 1);
});
test('Space keyup cannot release a pointer-owned draw', () => {
  const {state, input, E, window, advance} = inputHarness();
  E.draw.dispatch('pointerdown', {pointerId: 2}); advance(.3);
  window.dispatch('keydown', {code: 'Space'});
  window.dispatch('keyup', {code: 'Space'});
  assert.equal(state.shots, 0, 'Keyboard must not release a different input source');
  assert.equal(state.drawing, true);
  assert.equal(input.drawId, 2);
  advance(.85);
  E.draw.dispatch('pointerup', {pointerId: 2});
  assert.equal(state.shots, 1);
  assert.equal(state.arrows[0].power, 1);
});
