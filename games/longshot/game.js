import * as THREE from './vendor/three.module.js';
import { createWorld } from './world.js';
import { createWeapon } from './weapon.js';
import { createLearning } from './learning.js?v=2';
import { createTargetWords } from './target-words.js?v=3';
import { createPatrolTarget } from './patrols.js?v=3';

const $ = id => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const settings = { sensitivity: 1, sound: true, assist: true, hints: true, timed: false, difficulty: 'relaxed', showTargetWords: true, showTranslations: true, ...read('longshot.settings.v1', {}) };
settings.difficulty = settings.difficulty === 'hard' ? 'hard' : 'relaxed';
const rounds = [
  { name: 'SIGHTING IN', count: 6, seconds: 100, moving: false, pads: [0, 1, 2, 3, 4, 5] },
  { name: 'ON THE MOVE', count: 8, seconds: 110, moving: true, pads: [0, 1, 2, 3, 4, 5, 6, 7] },
  { name: 'THE LONG GAME', count: 10, seconds: 130, moving: true, pads: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
];
const hardRounds = [
  { name: 'WALKING PATROLS', count: 8, seconds: 85, moving: true, pads: [0, 1, 2, 3, 4, 5, 6, 7] },
  { name: 'QUICKER FOOTSTEPS', count: 10, seconds: 95, moving: true, pads: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { name: 'ROOFTOP PURSUIT', count: 12, seconds: 110, moving: true, pads: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
];
const bestKey = (difficulty = state.difficulty) => difficulty === 'hard' ? 'longshot.best.hard.v1' : 'longshot.best.v1';
const readBest = difficulty => Math.max(0, Number(read(bestKey(difficulty), 0)) || 0);
const state = {
  mode: 'menu', difficulty: settings.difficulty, round: 0, score: 0, kills: 0, totalKills: 0, shots: 0, precise: 0,
  ammo: 5, reserve: 25, time: 100, reloadTime: 0, cooldown: 0, recoil: 0,
  scoped: false, zoom: 4, yaw: 0, pitch: -.07, moveX: 0, moveY: 0,
  steady: false, breath: 1, transitioning: 0, elapsed: 0, guideTime: 0,
  best: readBest(settings.difficulty), lessonOffset: 0,
};
const isHard = () => state.difficulty === 'hard';
const activeRounds = () => isHard() ? hardRounds : rounds;
const isTimed = () => isHard() || settings.timed;
let renderer, scene, camera, world, weapon, targetWords, targets = [], effects = [], audioContext;
let currentWord = null, learning, aimTween = null, toastUntil = 0, hitUntil = 0, bannerUntil = 0;
let dialogResume = false, lastHud = 0, lastRange = 0, targetUnderAim = null;
const keys = new Set();
const raycaster = new THREE.Raycaster();
const rayDirection = new THREE.Vector3();
const v = new THREE.Vector3();
const targetPoint = new THREE.Vector3();
const center = new THREE.Vector2(0, 0);
const pointer = { id: null, x: 0, y: 0, total: 0, button: 0 };
const isTouch = matchMedia('(pointer: coarse)').matches;

function tone(freq, duration = .08, gain = .1, type = 'sine', end = freq) {
  if (!settings.sound || !audioContext || audioContext.state !== 'running') return;
  const osc = audioContext.createOscillator(), g = audioContext.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, audioContext.currentTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, end), audioContext.currentTime + duration);
  g.gain.setValueAtTime(gain, audioContext.currentTime);
  g.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + duration);
  osc.connect(g).connect(audioContext.destination); osc.start(); osc.stop(audioContext.currentTime + duration);
}
function unlockAudio() {
  try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); audioContext.resume().catch(() => {}); } catch {}
}
function shotSound() {
  if (!settings.sound || !audioContext || audioContext.state !== 'running') return;
  const length = Math.floor(audioContext.sampleRate * .38);
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * .13));
  const src = audioContext.createBufferSource(), filter = audioContext.createBiquadFilter(), g = audioContext.createGain();
  src.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = 2300; g.gain.value = .43;
  src.connect(filter).connect(g).connect(audioContext.destination); src.start();
  tone(125, .22, .24, 'triangle', 34);
  setTimeout(() => tone(170, .06, .055, 'square', 82), 320);
  setTimeout(() => tone(250, .04, .035, 'square', 120), 500);
}

function toast(message, seconds = 2.5) { $('toast').textContent = message; $('toast').style.opacity = '1'; toastUntil = performance.now() + seconds * 1000; }
function banner(eyebrow, title, seconds = 2.5) { $('bannerEyebrow').textContent = eyebrow; $('bannerTitle').textContent = title; $('roundBanner').style.opacity = '1'; bannerUntil = performance.now() + seconds * 1000; }
function formatTime(t) { t = Math.max(0, Math.ceil(t)); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; }

function createTarget(pad, index, moving) {
  const group = new THREE.Group();
  group.position.set(pad.x, pad.y, pad.z);
  const orange = new THREE.MeshStandardMaterial({ color: 0xf07534, roughness: .65, metalness: .3, emissive: 0xa6320d, emissiveIntensity: .35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x263a39, roughness: .65, metalness: .5 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf5ead1, roughness: .5, emissive: 0xffd99b, emissiveIntensity: .45 });
  const trim = new THREE.MeshBasicMaterial({ color: 0x241c16 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffa060 });
  const hitMeshes = [];
  const target = { group, hitMeshes, pad, index, alive: true, moving, hitAge: 0, phase: index * 2.37, materials: [orange, dark, white, trim, glow] };
  function add(geo, mat, x, y, z, part) {
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); group.add(mesh);
    if (part) { mesh.userData.target = target; mesh.userData.part = part; hitMeshes.push(mesh); }
    return mesh;
  }
  add(new THREE.BoxGeometry(2.2, .22, 1.1), dark, 0, .11, 0);
  add(new THREE.BoxGeometry(.27, 1.0, .3), dark, -.38, .72, 0, 'body');
  add(new THREE.BoxGeometry(.27, 1.0, .3), dark, .38, .72, 0, 'body');
  add(new THREE.BoxGeometry(1.75, 1.65, .3), orange, 0, 1.92, 0, 'body');
  add(new THREE.BoxGeometry(2.25, .40, .3), orange, 0, 2.38, 0, 'body');
  add(new THREE.BoxGeometry(.67, .73, .34), orange, 0, 3.10, 0, 'precision');
  add(new THREE.BoxGeometry(.43, .29, .04), white, 0, 3.14, .20, 'precision');
  const rings = add(new THREE.RingGeometry(.42, .48, 32), trim, 0, 1.95, .164, 'body');
  rings.material.side = THREE.DoubleSide;
  add(new THREE.CircleGeometry(.18, 24), white, 0, 1.95, .181, 'precision');
  add(new THREE.RingGeometry(.23, .26, 24), trim, 0, 1.95, .18, 'body');
  const pole = add(new THREE.CylinderGeometry(.025, .025, 1.3, 5), dark, 0, 3.95, -.18);
  const marker = add(new THREE.OctahedronGeometry(.18), glow, 0, 4.70, -.18);
  target.marker = marker; target.pole = pole;
  group.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  scene.add(group); return target;
}

function clearTargets() {
  for (const target of targets) {
    targetWords?.remove(target);
    scene.remove(target.group); target.group.traverse(o => o.geometry?.dispose());
    if (target.coverGroup) { scene.remove(target.coverGroup); target.coverGroup.traverse(o => o.geometry?.dispose()); }
    target.materials.forEach(m => m.dispose());
  }
  targets = [];
}
function assignTargetLessons() {
  if (!learning || !targetWords) return;
  const words = learning.getItems();
  if (!words.length) return;
  const roundOffset = activeRounds().slice(0, state.round).reduce((total, round) => total + round.count, 0);
  targets.forEach((target, index) => {
    const item = words[(state.lessonOffset + roundOffset + index) % words.length];
    targetWords.assign(target, item, { showTranslation: settings.showTranslations });
    targetWords.update(target, { visible: learning.enabled && settings.showTargetWords && state.mode === 'playing', showTranslation: settings.showTranslations, camera });
  });
}
function loadTargets(moving = false, pads = activeRounds()[state.round].pads) {
  clearTargets(); pads.forEach((p, i) => targets.push(isHard()
    ? createPatrolTarget(scene, world.targetPads[p], i, state.round)
    : createTarget(world.targetPads[p], i, moving)));
  assignTargetLessons();
  scene.updateMatrixWorld(true);
}

function updateHud() {
  const r = activeRounds()[state.round];
  $('roundLabel').textContent = `ROUND ${String(state.round + 1).padStart(2, '0')} / 03`;
  $('difficultyLabel').textContent = isHard() ? 'HARD' : 'RELAXED';
  $('difficultyLabel').classList.toggle('hard', isHard());
  $('roundName').textContent = r.name;
  $('objective').textContent = learning?.enabled ? `Discover ${r.count}${isHard() ? ' walking' : ''} word targets` : `Hit all ${r.count} ${isHard() ? 'walking' : 'orange'} targets`;
  $('timerLabel').textContent = isTimed() ? 'TIME REMAINING' : 'LEARN AT YOUR PACE';
  $('timer').textContent = isTimed() ? formatTime(state.time) : '∞'; $('timer').parentElement.classList.toggle('urgent', isTimed() && state.time < 20);
  $('score').textContent = String(state.score).padStart(4, '0');
  $('kills').textContent = state.kills; $('goal').textContent = r.count;
  $('accuracy').textContent = `ACCURACY ${state.shots ? Math.round(state.totalKills / state.shots * 100) + '%' : '—'}`;
  $('ammo').textContent = state.ammo; $('reserve').textContent = state.reserve;
  $('weaponStatus').textContent = state.reloadTime > 0 ? 'RELOADING' : state.cooldown > 0 ? 'CYCLING BOLT' : state.ammo ? 'READY' : 'RELOAD · R';
  $('ammoPips').replaceChildren(...Array.from({ length: 5 }, (_, i) => { const el = document.createElement('i'); if (i >= state.ammo) el.className = 'empty'; return el; }));
  $('targetPips').replaceChildren(...Array.from({ length: r.count }, (_, i) => { const el = document.createElement('i'); if (i < state.kills) el.className = 'done'; return el; }));
  $('reloadIndicator').hidden = state.reloadTime <= 0;
  $('reloadProgress').style.width = `${100 * (1 - state.reloadTime / 2.1)}%`;
  const holdingSteady = (state.steady || keys.has('shift')) && state.breath > .02;
  $('scopeSteady').textContent = holdingSteady ? 'STEADY' : state.breath < .15 ? 'CATCH YOUR BREATH' : 'HOLD TO STEADY';
  $('scopeSteady').classList.toggle('active', holdingSteady);
  $('heading').textContent = `${Math.round(((-state.yaw * 180 / Math.PI) % 360 + 360) % 360)}°`;
}

function updateScope() {
  $('scope').hidden = !state.scoped;
  $('crosshair').hidden = state.scoped;
  $('scopeBtn').classList.toggle('active', state.scoped);
  $('scopeBtn').setAttribute('aria-pressed', String(state.scoped));
  $('scopeZoom').textContent = state.zoom + '×'; $('zoomBtn').textContent = state.zoom + '×';
}
function toggleScope() { if (state.mode !== 'playing') return; state.scoped = !state.scoped; tone(250, .04, .025, 'sine', 180); updateScope(); }
function zoomScope() { state.zoom = state.zoom === 2 ? 4 : state.zoom === 4 ? 8 : 2; if (!state.scoped) state.scoped = true; updateScope(); }

function startRound() {
  const r = activeRounds()[state.round]; state.kills = 0; state.time = r.seconds; state.ammo = 5; state.reserve = 25;
  state.reloadTime = 0; state.cooldown = 0; state.transitioning = 0; state.breath = 1; state.guideTime = 7;
  loadTargets(r.moving, r.pads); banner(`${isHard() ? 'HARD · ' : ''}ROUND ${String(state.round + 1).padStart(2, '0')} / 03`, r.name, 2.5);
  if (learning.enabled && targets[0]?.lessonItem) learning.preview(targets[0].lessonItem);
  updateHud();
}
function startGame() {
  unlockAudio(); learning.stop();
  state.difficulty = settings.difficulty; state.best = readBest(state.difficulty);
  state.mode = 'playing'; state.round = 0; state.score = 0; state.totalKills = 0; state.shots = 0; state.precise = 0;
  state.elapsed = 0; state.scoped = false; state.yaw = 0; state.pitch = -.08; state.recoil = 0; state.steady = false;
  const lessonSize = learning.getItems().length || 1;
  state.lessonOffset = Math.max(0, Number(read('longshot.nextWord.v2', 0)) || 0) % lessonSize;
  save('longshot.nextWord.v2', (state.lessonOffset + 1) % lessonSize);
  camera.position.copy(world.spawn); resetInput();
  $('intro').hidden = true; $('hud').hidden = false; $('pausePanel').hidden = true; $('resultPanel').hidden = true;
  document.body.classList.add('playing'); updateScope(); startRound(); syncLearning();
  toast(isHard() ? 'Hard: track the walking patrols · Watch for cover · Beat the clock' : isTouch ? 'Drag to aim · Scope to zoom · Fire to shoot' : 'Drag to aim · Space to scope · Click or F to fire', 4);
}
function pauseGame(showPanel = true) {
  if (state.mode !== 'playing') return;
  state.mode = 'paused'; resetInput(); learning.stop(); $('pausePanel').hidden = !showPanel;
  if (document.pointerLockElement) document.exitPointerLock();
}
function resumeGame() { state.mode = 'playing'; $('pausePanel').hidden = true; resetInput(); unlockAudio(); if (learning.enabled) learning.resume(); }
function resetInput() { keys.clear(); state.moveX = 0; state.moveY = 0; state.steady = false; $('steadyBtn').classList.remove('active'); $('joystickThumb').style.transform = ''; pointer.id = null; aimTween = null; }
function mainMenu() {
  state.mode = 'menu'; state.difficulty = settings.difficulty; state.best = readBest(state.difficulty); state.round = 0;
  state.scoped = false; state.recoil = 0; resetInput(); learning.stop();
  $('intro').hidden = false; $('hud').hidden = true; $('pausePanel').hidden = true; $('resultPanel').hidden = true;
  document.body.classList.remove('playing'); camera.position.copy(world.spawn); loadTargets(isHard(), isHard() ? hardRounds[0].pads : [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  syncDifficultyUI(); updateScope();
}
function finishGame(won) {
  state.mode = 'results'; state.scoped = false; resetInput(); learning.stop(); updateScope();
  const newRecord = state.score > state.best;
  if (newRecord) { state.best = state.score; save(bestKey(), state.best); }
  $('resultEyebrow').textContent = won ? isHard() ? 'HARD PATROLS COMPLETE' : 'ALL THREE ROUNDS COMPLETE' : 'THE CLOCK RAN OUT';
  $('resultTitle').replaceChildren(...(won ? ['NICE', 'SHOOTING.'] : ['KEEP', 'YOUR FOCUS.']).flatMap((txt, i) => i ? [document.createElement('br'), document.createTextNode(txt)] : [document.createTextNode(txt)]));
  $('resultSubtitle').textContent = won ? isHard() ? '30 walking targets cleared. You mastered the patrols.' : 'Every target cleared. The rooftop is yours.' : `${state.totalKills} targets hit. ${isHard() ? 'Watch the walking rhythm and wait for an opening past cover.' : 'Try using Find to face a target, then Scope for a closer look.'}`;
  $('resultScore').textContent = state.score.toLocaleString(); $('resultAccuracy').textContent = (state.shots ? Math.round(state.totalKills / state.shots * 100) : 0) + '%';
  $('resultPrecision').textContent = state.precise; $('recordLine').textContent = newRecord ? `NEW ${isHard() ? 'HARD' : 'RELAXED'} PERSONAL BEST.` : `${isHard() ? 'HARD' : 'RELAXED'} BEST: ${state.best.toLocaleString()}`;
  $('exportBtn').hidden = !learning.enabled; $('resultPanel').hidden = false;
  if (won) { tone(440, .25, .08); setTimeout(() => tone(660, .4, .08), 130); }
}

function reload() {
  if (state.mode !== 'playing' || state.reloadTime > 0 || state.ammo === 5 || state.transitioning) return;
  if (state.reserve <= 0) { toast('A fresh box of rounds has arrived.'); state.reserve = 25; }
  state.reloadTime = 2.1; state.scoped = false; updateScope(); tone(140, .08, .045, 'square', 75); updateHud();
}

function effectAt(point, hit, from) {
  const lineGeometry = new THREE.BufferGeometry().setFromPoints([from, point]);
  const line = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: 0xffd09a, transparent: true, opacity: .75, depthWrite: false }));
  scene.add(line); effects.push({ mesh: line, age: 0, life: .17, kind: 'line' });
  const n = hit ? 22 : 9, positions = new Float32Array(n * 3), velocities = [];
  for (let i = 0; i < n; i++) { positions.set([point.x, point.y, point.z], i * 3); velocities.push(new THREE.Vector3((Math.random() - .5) * 12, Math.random() * 8, (Math.random() - .5) * 12)); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mesh = new THREE.Points(geo, new THREE.PointsMaterial({ color: hit ? 0xffb969 : 0xc9ccbd, size: hit ? .13 : .09, transparent: true, opacity: 1, depthWrite: false }));
  scene.add(mesh); effects.push({ mesh, age: 0, life: .65, velocities, kind: 'particles' });
}

function fire() {
  if (state.mode !== 'playing' || state.transitioning || state.reloadTime > 0 || state.cooldown > 0) return;
  unlockAudio();
  if (state.ammo <= 0) { tone(120, .025, .045, 'square'); reload(); return; }
  state.ammo--; state.shots++; state.cooldown = .88; shotSound(); weapon.flash();
  scene.updateMatrixWorld(true); raycaster.setFromCamera(center, camera);
  const hitMeshes = targets.filter(t => t.alive).flatMap(t => t.hitMeshes);
  const intersections = raycaster.intersectObjects([...hitMeshes, ...world.colliders, ...targets.flatMap(t => t.coverMeshes || [])], false);
  const nearest = intersections[0];
  const point = nearest ? nearest.point.clone() : raycaster.ray.at(320, new THREE.Vector3());
  const from = new THREE.Vector3(.26, -.20, -.95).applyMatrix4(camera.matrixWorld);
  let target = nearest?.object.userData.target;
  if (target?.alive) {
    target.alive = false; target.hitAge = .001;
    const precise = nearest.object.userData.part === 'precision';
    const distance = Math.round(camera.position.distanceTo(point));
    const points = 100 + (precise ? 100 : 0) + Math.floor(distance / 10) * 5;
    state.score += points; state.kills++; state.totalKills++; if (precise) state.precise++;
    $('hitNotice').textContent = `${precise ? 'PRECISE HIT' : 'TARGET DOWN'}  +${points}  /  ${distance} M`;
    $('hitNotice').style.opacity = '1'; $('hitmark').style.opacity = '1'; hitUntil = performance.now() + 1000;
    setTimeout(() => tone(precise ? 1160 : 820, .13, .055, 'sine', precise ? 1500 : 1000), 65);
    if (learning.enabled) learning.onHit(target.lessonItem);
    state.guideTime = 1.5;
    if (state.kills >= activeRounds()[state.round].count) {
      const bonus = isTimed() ? Math.ceil(state.time) * 10 : 0; state.score += bonus; state.transitioning = 3.2;
      banner(learning.enabled ? 'WORDS COLLECTED' : 'ROUND CLEAR', bonus ? `+${bonus} TIME BONUS` : state.round === 2 ? 'LESSON COMPLETE' : 'NEXT ROOFTOP TRIAL', 2.8); tone(520, .2, .07);
    }
  } else {
    $('hitNotice').textContent = nearest?.object.userData.isPatrolCover ? 'COVER BLOCKED · WAIT FOR AN OPENING' : nearest ? 'ADJUST YOUR AIM' : 'SHOT WIDE';
    $('hitNotice').style.opacity = '.8'; hitUntil = performance.now() + 800;
  }
  effectAt(point, !!target, from); state.recoil = 1; updateHud();
}

function nearestTarget() {
  camera.getWorldDirection(rayDirection);
  let nearest = null, angle = -Infinity;
  for (const t of targets) { if (!t.alive) continue; v.copy(t.group.position); v.y += t.aimHeight ?? 1.95; v.sub(camera.position).normalize(); const dot = v.dot(rayDirection); if (dot > angle) { angle = dot; nearest = t; } }
  return nearest;
}
function hunt() {
  if (state.mode !== 'playing' || state.transitioning) return;
  const t = nearestTarget(); if (!t) return;
  aimTween = { target: t, time: .65 }; state.guideTime = 4;
  if (learning.enabled && t.lessonItem) learning.preview(t.lessonItem);
  toast(isHard() ? 'Patrol located. Track their movement and watch the cover.' : 'Target located. Scope in and take the shot.', 2.1);
}
function aim(dx, dy) {
  if (state.mode !== 'playing') return;
  aimTween = null;
  let sensitivity = .0025 * settings.sensitivity * (state.scoped ? 1 / state.zoom : 1);
  if (!isHard() && settings.assist && targetUnderAim && state.scoped) sensitivity *= .65;
  state.yaw -= dx * sensitivity; state.pitch = clamp(state.pitch - dy * sensitivity, -.92, 1.1);
}

let learningStatusText = '';
function setLearningStatus(message) {
  learningStatusText = message;
  $('importStatus').textContent = message;
}
function syncDifficultyUI() {
  const hard = settings.difficulty === 'hard';
  $('difficultySelect').value = settings.difficulty; $('difficultySetting').value = settings.difficulty;
  $('difficultyHint').textContent = hard
    ? 'Walking people · changing directions · cover · timed · no aim assist'
    : 'Training targets · gentle aim assist · learn at your pace';
  const pending = state.mode !== 'menu' && settings.difficulty !== state.difficulty;
  $('difficultySettingHint').textContent = pending
    ? `Next run: ${hard ? 'Hard walking patrols' : 'Relaxed'}. Restart from the pause menu to switch.`
    : 'Hard uses walking patrols, a round timer and no aim assist. Difficulty changes apply to your next run.';
  $('paceLabel').textContent = hard ? 'HARD · TIMED PATROLS' : settings.timed ? 'TIMED CHALLENGE' : 'NO TIME LIMIT';
  const best = readBest(settings.difficulty);
  $('bestIntro').textContent = best ? best.toLocaleString() : '—';
}
function setDifficulty(value) {
  settings.difficulty = value === 'hard' ? 'hard' : 'relaxed';
  save('longshot.settings.v1', settings);
  if (state.mode === 'menu' && world) {
    state.difficulty = settings.difficulty; state.best = readBest(state.difficulty); state.round = 0;
    loadTargets(isHard(), isHard() ? hardRounds[0].pads : [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  }
  syncDifficultyUI();
}
function syncLearning() {
  if (!learning) return;
  $('classicMode').classList.toggle('active', !learning.enabled); $('classicMode').setAttribute('aria-pressed', String(!learning.enabled));
  $('learningMode').classList.toggle('active', learning.enabled); $('learningMode').setAttribute('aria-pressed', String(learning.enabled));
  $('learningSetting').checked = learning.enabled; $('learningBar').hidden = !learning.enabled; $('learningSettings').hidden = !learning.enabled;
  $('repeatSetting').checked = learning.repeatEnabled;
  $('wordTranslation').hidden = !settings.showTranslations;
  $('sentenceBtn').hidden = !currentWord?.sentence;
  $('startBtn').firstElementChild.textContent = learning.enabled ? 'PLAY & LEARN' : 'ENTER THE RANGE';
  syncDifficultyUI();
  const languageSelect = $('languageSelect'), code = learning.languages.learningLanguage;
  for (const option of languageSelect.querySelectorAll('option[data-imported]')) if (option.value !== code) option.remove();
  if (![...languageSelect.options].some(option => option.value === code)) {
    const option = document.createElement('option'); option.value = code; option.dataset.imported = 'true';
    let name = code;
    try { name = new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code; } catch {}
    option.textContent = name === code ? code : `${name} (${code})`;
    languageSelect.append(option);
  }
  languageSelect.value = code;
  const primarySelect = $('primaryLanguageSelect'), primary = learning.languages.primaryLanguage;
  if (![...primarySelect.options].some(option => option.value === primary)) { const option = document.createElement('option'); option.value = primary; option.textContent = primary; primarySelect.append(option); }
  primarySelect.value = primary;
  $('importStatus').textContent = learningStatusText || `${learning.getItems().length} words ready`;
  $('learnedCount').textContent = learning.reviewedCount;
  if (currentWord && learning.reviewedCount === 0) {
    currentWord = null; $('wordText').textContent = 'Hit a target to learn'; $('wordTranslation').textContent = '';
  }
}
function setLearning(enabled) { unlockAudio(); learning.setEnabled(enabled); syncLearning(); assignTargetLessons(); if (state.mode === 'playing' && enabled) learning.preview(nearestTarget()?.lessonItem || 0); }
function settingsChanged() {
  settings.sensitivity = Number($('sensitivity').value); settings.sound = $('soundSetting').checked;
  settings.assist = $('assistSetting').checked; settings.hints = $('hintsSetting').checked;
  settings.timed = $('timedSetting').checked; settings.showTargetWords = $('targetWordsSetting').checked; settings.showTranslations = $('translationSetting').checked;
  $('wordTranslation').hidden = !settings.showTranslations;
  syncDifficultyUI();
  document.body.classList.toggle('no-hints', !settings.hints); $('soundBtn').classList.toggle('off', !settings.sound);
  $('soundBtn').setAttribute('aria-label', settings.sound ? 'Mute game sound' : 'Unmute game sound'); save('longshot.settings.v1', settings);
}
function openDialog(id) {
  dialogResume = state.mode === 'playing'; if (dialogResume) pauseGame(false);
  $(id).showModal();
}

function bindUI() {
  $('startBtn').addEventListener('click', startGame);
  $('difficultySelect').addEventListener('change', e => setDifficulty(e.target.value));
  $('difficultySetting').addEventListener('change', e => setDifficulty(e.target.value));
  $('classicMode').addEventListener('click', () => setLearning(false)); $('learningMode').addEventListener('click', () => setLearning(true));
  $('settingsBtn').addEventListener('click', () => openDialog('settingsDialog'));
  $('pauseSettings').addEventListener('click', () => openDialog('settingsDialog'));
  $('howBtn').addEventListener('click', () => openDialog('helpDialog'));
  $('helpDone').addEventListener('click', () => $('helpDialog').close());
  for (const id of ['settingsDialog', 'helpDialog', 'wordsDialog', 'sentenceDialog']) $(id).addEventListener('close', () => { learning.stop(); if (dialogResume && state.mode === 'paused') resumeGame(); dialogResume = false; });
  $('soundBtn').addEventListener('click', () => { unlockAudio(); $('soundSetting').checked = !settings.sound; settingsChanged(); });
  $('sensitivity').value = settings.sensitivity; $('soundSetting').checked = settings.sound; $('assistSetting').checked = settings.assist; $('hintsSetting').checked = settings.hints;
  $('timedSetting').checked = settings.timed; $('targetWordsSetting').checked = settings.showTargetWords; $('translationSetting').checked = settings.showTranslations;
  for (const id of ['sensitivity', 'soundSetting', 'assistSetting', 'hintsSetting', 'timedSetting', 'targetWordsSetting', 'translationSetting']) $(id).addEventListener('input', settingsChanged);
  settingsChanged();
  $('learningSetting').addEventListener('change', e => setLearning(e.target.checked));
  $('repeatSetting').addEventListener('change', e => { learning.setRepeat(e.target.checked); syncLearning(); });
  $('primaryLanguageSelect').addEventListener('change', e => { learning.setLanguages(e.target.value, learning.languages.learningLanguage); syncLearning(); setLearningStatus('Translation language set. Load matching translations below.'); });
  $('languageSelect').addEventListener('change', e => { learning.setLanguages(learning.languages.primaryLanguage, e.target.value); syncLearning(); setLearningStatus('Voice language set. Load matching words below.'); });
  $('importBtn').addEventListener('click', () => { const result = learning.importText($('wordInput').value); syncLearning(); setLearningStatus(result.ok ? `${result.count} words loaded` : result.error || 'Check the word format'); });
  $('pauseBtn').addEventListener('click', () => pauseGame()); $('resumeBtn').addEventListener('click', resumeGame);
  $('restartBtn').addEventListener('click', startGame); $('againBtn').addEventListener('click', startGame);
  $('menuBtn').addEventListener('click', mainMenu); $('resultMenu').addEventListener('click', mainMenu);
  $('scopeBtn').addEventListener('click', toggleScope); $('zoomBtn').addEventListener('click', zoomScope);
  $('reloadBtn').addEventListener('click', reload); $('huntBtn').addEventListener('click', hunt);
  $('fireBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fire(); });
  $('steadyBtn').addEventListener('pointerdown', e => { e.preventDefault(); if (state.mode !== 'playing') return; e.currentTarget.setPointerCapture(e.pointerId); state.steady = true; e.currentTarget.classList.add('active'); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) $('steadyBtn').addEventListener(event, () => { state.steady = false; $('steadyBtn').classList.remove('active'); });
  $('wordToggle').addEventListener('click', () => { $('learningBar').classList.toggle('collapsed'); save('longshot.wordHidden', $('learningBar').classList.contains('collapsed')); });
  $('wordReplay').addEventListener('click', () => { unlockAudio(); learning.replay(); });
  $('sentenceBtn').addEventListener('click', () => {
    if (!currentWord?.sentence) return;
    $('sentenceWord').textContent = currentWord.word;
    $('sentenceText').textContent = currentWord.sentence;
    $('sentenceTranslation').textContent = currentWord.sentenceTranslation || '';
    $('sentenceTranslation').hidden = !settings.showTranslations;
    openDialog('sentenceDialog'); learning.speakSentence(currentWord);
  });
  $('sentenceSpeakBtn').addEventListener('click', () => learning.speakSentence(currentWord));
  $('learnedBtn').addEventListener('click', () => {
    const payload = learning.exportWords({ download: false }); $('wordsList').replaceChildren();
    if (!payload.words.length) { const p = document.createElement('p'); p.textContent = 'Hit a target to collect your first word.'; $('wordsList').append(p); }
    for (const item of payload.words) { const b = document.createElement('button'), s = document.createElement('span'); b.textContent = item.word; s.textContent = settings.showTranslations ? item.translation : ''; b.append(s); b.addEventListener('click', () => learning.replayItem(item)); $('wordsList').append(b); }
    openDialog('wordsDialog');
  });
  for (const id of ['exportBtn', 'wordsExportBtn']) $(id).addEventListener('click', () => learning.exportWords());
  if (read('longshot.wordHidden', false)) $('learningBar').classList.add('collapsed');

  const joystick = $('touchJoystick'); let joyId = null, origin = null;
  const moveJoy = e => {
    if (e.pointerId !== joyId) return; const radius = joystick.clientWidth * .34;
    let dx = e.clientX - origin.x, dy = e.clientY - origin.y; const length = Math.hypot(dx, dy);
    if (length > radius) { dx *= radius / length; dy *= radius / length; }
    state.moveX = dx / radius; state.moveY = -dy / radius; $('joystickThumb').style.transform = `translate(${dx}px,${dy}px)`;
  };
  joystick.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (state.mode !== 'playing') return; joyId = e.pointerId; joystick.setPointerCapture(e.pointerId); const r = joystick.getBoundingClientRect(); origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; moveJoy(e); });
  joystick.addEventListener('pointermove', moveJoy);
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) joystick.addEventListener(event, e => { if (e.pointerId === joyId) { joyId = null; state.moveX = state.moveY = 0; $('joystickThumb').style.transform = ''; } });

  const canvas = $('scene'); canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    if (state.mode !== 'playing') return; e.preventDefault();
    if (e.button === 2) { toggleScope(); return; }
    if (pointer.id !== null) return;
    pointer.id = e.pointerId; pointer.x = e.clientX; pointer.y = e.clientY; pointer.total = 0; pointer.button = e.button;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (pointer.id !== e.pointerId || state.mode !== 'playing') return;
    const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y; pointer.total += Math.hypot(dx, dy); aim(dx, dy); pointer.x = e.clientX; pointer.y = e.clientY;
  });
  canvas.addEventListener('pointerup', e => { if (pointer.id === e.pointerId) { if (e.pointerType === 'mouse' && pointer.total < 5 && pointer.button === 0) fire(); pointer.id = null; } });
  canvas.addEventListener('pointercancel', () => { pointer.id = null; });
  canvas.addEventListener('lostpointercapture', () => { pointer.id = null; });
  canvas.addEventListener('wheel', e => { if (state.mode === 'playing' && state.scoped) { e.preventDefault(); zoomScope(); } }, { passive: false });

  window.addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]')) return;
    const k = e.key.toLowerCase();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k) && state.mode === 'playing') e.preventDefault();
    if (k === 'escape') { e.preventDefault(); if (e.repeat) return; if (state.mode === 'playing') pauseGame(); else if (state.mode === 'paused') resumeGame(); return; }
    if (state.mode !== 'playing') return;
    keys.add(k); if (e.repeat) return;
    if (k === ' ' || k === 'q') toggleScope(); if (k === 'r') reload(); if (k === 'f') fire(); if (k === 'h') hunt(); if (k === 'z') zoomScope();
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', resetInput);
  document.addEventListener('visibilitychange', () => { if (document.hidden && state.mode === 'playing') pauseGame(); });
  window.addEventListener('resize', resize);
}

function resize() {
  if (!renderer) return;
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 1.6 : 1.8)); renderer.setSize(innerWidth, innerHeight, false);
}

function updateTargets(dt, time) {
  for (const t of targets) {
    if (t.alive) {
      if (t.kind === 'patrol') t.update(dt, time);
      else {
        if (t.moving) t.group.position.x = t.pad.x + Math.sin(time * (.35 + state.round * .08) + t.phase) * t.pad.width * .32;
        t.marker.position.y = 4.7 + Math.sin(time * 2.1 + t.phase) * .12;
        t.marker.rotation.y = time * .8;
      }
    } else if (t.hitAge > 0) {
      t.hitAge += dt; t.group.rotation.x = -Math.min(Math.PI / 2, t.hitAge * 4.5);
      t.group.position.y = t.pad.y - Math.min(.3, t.hitAge * .4);
      if (t.hitAge > .7) { t.group.visible = false; t.hitAge = 0; }
    }
    targetWords.update(t, { visible: learning.enabled && settings.showTargetWords && state.mode === 'playing', showTranslation: settings.showTranslations, camera });
  }
}
function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i]; e.age += dt; e.mesh.material.opacity = Math.max(0, 1 - e.age / e.life);
    if (e.kind === 'particles') { const a = e.mesh.geometry.attributes.position; for (let n = 0; n < e.velocities.length; n++) { const velocity = e.velocities[n]; velocity.y -= dt * 12; a.array[n * 3] += velocity.x * dt; a.array[n * 3 + 1] += velocity.y * dt; a.array[n * 3 + 2] += velocity.z * dt; } a.needsUpdate = true; }
    if (e.age > e.life) { scene.remove(e.mesh); e.mesh.geometry.dispose(); e.mesh.material.dispose(); effects.splice(i, 1); }
  }
}
function updateGuide(dt) {
  state.guideTime = Math.max(0, state.guideTime - dt);
  const t = nearestTarget();
  if (!t || state.guideTime <= 0 || state.scoped) { $('targetGuide').hidden = true; return; }
  targetPoint.copy(t.group.position); targetPoint.y += t.guideHeight ?? 5.3; targetPoint.project(camera);
  if (targetPoint.z > 1 || Math.abs(targetPoint.x) > .9 || Math.abs(targetPoint.y) > .8) { $('targetGuide').hidden = true; return; }
  $('targetGuide').hidden = false; $('targetGuide').style.left = `${(targetPoint.x * .5 + .5) * innerWidth}px`; $('targetGuide').style.top = `${(-targetPoint.y * .5 + .5) * innerHeight}px`;
}

function updateGame(dt, now) {
  state.elapsed += dt; state.cooldown = Math.max(0, state.cooldown - dt); state.recoil *= Math.exp(-dt * 12);
  if (state.reloadTime > 0) { state.reloadTime = Math.max(0, state.reloadTime - dt); if (state.reloadTime === 0) { const amount = Math.min(5 - state.ammo, state.reserve); state.ammo += amount; state.reserve -= amount; tone(210, .07, .06, 'square', 110); } }
  if (state.transitioning > 0) {
    state.transitioning -= dt;
    if (state.transitioning <= 0) { if (state.round === activeRounds().length - 1) { finishGame(true); return; } state.round++; startRound(); state.scoped = false; updateScope(); }
  } else if (isTimed()) { state.time = Math.max(0, state.time - dt); if (state.time <= 0) { finishGame(false); return; } }

  const wantsSteady = state.steady || keys.has('shift');
  state.breath = clamp(state.breath + dt * (wantsSteady && state.scoped ? -.18 : .15), 0, 1);
  const steady = wantsSteady && state.breath > .02;
  if (aimTween) {
    const t = aimTween.target; v.copy(t.group.position); v.y += t.aimHeight ?? 1.95; v.sub(camera.position);
    const yaw = Math.atan2(-v.x, -v.z), pitch = Math.atan2(v.y, Math.hypot(v.x, v.z));
    let delta = yaw - state.yaw; delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    state.yaw += delta * Math.min(1, dt * 13); state.pitch = lerp(state.pitch, pitch, Math.min(1, dt * 13));
    aimTween.time -= dt; if (aimTween.time <= 0 || !t.alive) aimTween = null;
  }
  let mx = state.moveX + (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  let my = state.moveY + (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
  const length = Math.hypot(mx, my); if (length > 1) { mx /= length; my /= length; }
  const speed = (state.scoped ? 2.6 : 4.2) * dt;
  camera.position.x += (Math.cos(state.yaw) * mx - Math.sin(state.yaw) * my) * speed;
  camera.position.z += (-Math.sin(state.yaw) * mx - Math.cos(state.yaw) * my) * speed;
  camera.position.x = clamp(camera.position.x, world.bounds.minX, world.bounds.maxX);
  camera.position.z = clamp(camera.position.z, world.bounds.minZ, world.bounds.maxZ);
  camera.position.y = world.spawn.y + (length > .1 ? Math.sin(state.elapsed * 9) * .025 : 0);
  const sway = state.scoped ? (steady ? .0001 : .0007) : .00017;
  camera.rotation.set(state.pitch + Math.sin(state.elapsed * 1.7) * sway + state.recoil * .015, state.yaw + Math.sin(state.elapsed * 1.05) * sway, 0, 'YXZ');
  const fov = state.scoped ? 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(64) / 2) / state.zoom) * 180 / Math.PI : 64;
  camera.fov = lerp(camera.fov, fov, Math.min(1, dt * 15)); camera.updateProjectionMatrix();
  weapon.update(dt, { time: state.elapsed, scoped: state.scoped, recoil: state.recoil, reloading: state.reloadTime > 0, reloadProgress: 1 - state.reloadTime / 2.1, moving: length > .1 });
  updateTargets(dt, state.elapsed); updateGuide(dt); updateEffects(dt);
  if (now - lastHud > 100) { updateHud(); lastHud = now; }
  if (now - lastRange > 200) {
    lastRange = now; scene.updateMatrixWorld(true); raycaster.setFromCamera(center, camera);
    const hit = raycaster.intersectObjects([...targets.filter(t => t.alive).flatMap(t => t.hitMeshes), ...world.colliders, ...targets.flatMap(t => t.coverMeshes || [])], false)[0]; targetUnderAim = hit?.object.userData.target || null;
    const nearest = targetUnderAim || nearestTarget(); $('scopeRange').textContent = nearest ? Math.round(camera.position.distanceTo(nearest.group.position)) : '—';
  }
}

let lastFrame = performance.now(), renderTime = 0;
function frame(now) {
  requestAnimationFrame(frame); const dt = Math.min((now - lastFrame) / 1000, .05); lastFrame = now;
  if (state.mode === 'menu') {
    renderTime += dt; camera.position.copy(world.spawn);
    camera.rotation.set(.035 + Math.sin(renderTime * .12) * .008, -.15 + Math.sin(renderTime * .08) * .045, 0, 'YXZ');
    camera.fov = 64; camera.updateProjectionMatrix(); weapon.group.visible = false; updateTargets(dt, renderTime);
  } else if (state.mode === 'playing') { renderTime += dt; updateGame(dt, now); }
  world.update(dt, renderTime);
  if (now > toastUntil) $('toast').style.opacity = '0';
  if (now > hitUntil) { $('hitNotice').style.opacity = '0'; $('hitmark').style.opacity = '0'; }
  if (now > bannerUntil) $('roundBanner').style.opacity = '0';
  renderer.render(scene, camera);
}

async function init() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .9;
    renderer.shadowMap.enabled = !isTouch; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, .025, 1200); scene.add(camera);
    world = createWorld(scene); camera.position.copy(world.spawn); weapon = createWeapon(camera); weapon.group.visible = false; targetWords = createTargetWords();
    learning = createLearning({
      onWord: (item, meta) => { currentWord = item; $('wordText').textContent = item.word; $('wordReplay').title = item.word + (settings.showTranslations ? ' — ' + item.translation : ''); $('wordTranslation').textContent = item.translation; $('wordTranslation').hidden = !settings.showTranslations; $('learnedCount').textContent = meta.reviewedCount; $('sentenceBtn').hidden = !item.sentence; },
      onStatus: message => { setLearningStatus(message); queueMicrotask(syncLearning); },
      onChange: change => { queueMicrotask(() => { syncLearning(); if (['ready', 'import', 'languages'].includes(change.reason)) { if (change.reason !== 'ready') { currentWord = null; $('wordText').textContent = 'Hit a target to learn'; $('wordTranslation').textContent = ''; $('sentenceBtn').hidden = true; } assignTargetLessons(); } }); },
    });
    bindUI(); resize(); mainMenu(); syncLearning();
    $('scene').addEventListener('webglcontextlost', e => { e.preventDefault(); if (state.mode === 'playing') pauseGame(); $('fatal').hidden = false; $('fatalText').textContent = 'The graphics context was interrupted. Tap Try again to reload the range.'; });
    renderer.render(scene, camera);
    window.__gameReady = true; $('startBtn').disabled = false; $('loader').style.opacity = '0'; setTimeout(() => $('loader').hidden = true, 650);
    requestAnimationFrame(frame);
    // Read-only QA state keeps validation separate from gameplay controls.
    window.longshotStatus = () => ({ mode: state.mode, difficulty: state.difficulty, nextDifficulty: settings.difficulty, round: state.round + 1, score: state.score, shots: state.shots, hits: state.totalKills, ammo: state.ammo, reserve: state.reserve, scoped: state.scoped, reloadTime: state.reloadTime, time: Math.round(state.time), timed: isTimed(), learning: learning.enabled, words: learning.getItems().length, renderer: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }, targets: targets.filter(t => t.alive).map(t => ({ position: t.group.position.toArray(), moving: t.moving, kind: t.kind || 'training' })) });
  } catch (error) {
    console.error(error); $('loader').hidden = true; $('fatal').hidden = false;
    $('fatalText').textContent = 'This game needs WebGL graphics. Try reopening it in an up-to-date Safari or Chrome browser. ' + (error?.message || '');
  }
}
init();
