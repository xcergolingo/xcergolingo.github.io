/* GoLingo F-16 Afterburner — flight, route, UI, native bridge. No network dependencies. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); }, T = window.THREE, L = window.F16Learning;
  var boot = $('boot');
  function fatal(message) { boot.hidden = false; boot.className = 'error'; boot.textContent = message; $('launchBtn').disabled = true; }
  if (!T || !L || !window.F16Visuals) { fatal('The game is incomplete. Open the full F-16 HTML file, or keep all source files together.'); return; }
  var renderer;
  try { renderer = new T.WebGLRenderer({ canvas: $('view'), antialias: true, powerPreference: 'high-performance', alpha: false }); }
  catch (e) { fatal('This browser could not start 3D graphics. Open the file in Safari, Chrome, Edge or Firefox with WebGL enabled, then reload.\n' + e.message); return; }
  var clamp = T.MathUtils.clamp, damp = T.MathUtils.damp, TAU = Math.PI * 2;
  var STORE = 'golingo.f16.v2.', defaultSettings = { showWords: false, showTranslation: true, examples: false, sound: false, rate: .85, gap: 1.6, voice: '', quality: 'balanced', camera: 0 };
  var storageFailed = false;
  function readStored(key, fallback) { try { var v = localStorage.getItem(STORE + key); return v ? JSON.parse(v) : fallback; } catch (_) { return fallback; } }
  function saveStored(key, value) { try { localStorage.setItem(STORE + key, JSON.stringify(value)); } catch (_) { if (!storageFailed) { storageFailed = true; toast('Local saving is unavailable in this browser. Export your basket before closing.'); } } }
  var settings = Object.assign({}, defaultSettings, readStored('settings', {}));
  var lesson;
  try { lesson = L.parseInput(readStored('lesson', L.defaultLesson())); } catch (_) { lesson = L.defaultLesson(); }
  var review = readStored('review', []); if (!Array.isArray(review)) review = []; review = review.filter(function (r) { return r && typeof r.word === 'string'; }).slice(-1500);
  var scene = new T.Scene(), camera = new T.PerspectiveCamera(60, 1, .25, 42000), world = F16Visuals.createWorld(T, scene), jet = F16Visuals.createJet(T, {});
  scene.add(jet, camera); renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.04;
  var state = { phase: 'hangar', mode: 'learn', paused: false, time: 0, score: 0, kills: 0, gates: 0, missed: 0, damage: 0, throttle: .5, speed: 185, yaw: 0, pitch: 0, roll: 0, pos: new T.Vector3(-700, 300, -300), prev: new T.Vector3(), autopilot: false, boost: false, grace: 6, missileCd: 0, gunCd: 0, flareCd: 0, flareT: 0, missiles: 24, cannon: 800, flares: 6, lock: null, hitT: 0, totalTime: 0 };
  var keys = Object.create(null), steer = { x: 0, y: 0 }, drag = null, stickPointer = null, action = { boost: false, fire: false, gun: false }, activeModal = null, modalFocus = null, clearArmed = false;
  var currentWord = null, currentWordLanguage = lesson.learningLanguage, practiced = new Set(), route = [], retryWords = [], cursor = 0, routeS = 700, courseSequence = 0;
  var enemies = [], projectiles = [], effects = [], flakes = [], fadeGates = [], spawnTimer = 0, hudTimer = 0, lastTs = 0, simTime = 0, toastTimer = 0, camReset = true;
  var vec = new T.Vector3(), vec2 = new T.Vector3(), fwd = new T.Vector3(), prevProjectile = new T.Vector3(), up = new T.Vector3(0, 1, 0), axisZ = new T.Vector3(0, 0, 1), axisY = new T.Vector3(0, 1, 0);
  var speech = L.createSpeech({ language: lesson.learningLanguage, primaryLanguage: lesson.primaryLanguage, onStatus: onVoiceStatus });
  var sound = createSound();
  var ringGeometry = new T.TorusGeometry(80, 1.25, 8, 80), ringOuterGeometry = new T.TorusGeometry(86, .26, 5, 80), markerGeometry = new T.BoxGeometry(6, 2.5, 2.2);
  var ringActiveMaterial = new T.MeshBasicMaterial({ color: 0xffd59b, transparent: true, opacity: .95 });
  var ringFutureMaterial = new T.MeshBasicMaterial({ color: 0x8ce5dc, transparent: true, opacity: .46 });
  var ringOuterMaterial = new T.MeshBasicMaterial({ color: 0xd3eee6, transparent: true, opacity: .24 });
  var projectileGeometry = new T.CylinderGeometry(.23, .29, 4.8, 7), bulletGeometry = new T.BoxGeometry(.32, .32, 8), particleGeometry = new T.SphereGeometry(1, 6, 5), explosionGeometry = new T.IcosahedronGeometry(1, 1);
  var friendlyMaterial = new T.MeshBasicMaterial({ color: 0xffe7ba }), hostileMaterial = new T.MeshBasicMaterial({ color: 0xff8564 }), bulletMaterial = new T.MeshBasicMaterial({ color: 0xf7f2b8 });
  var cockpit = createCockpit(); camera.add(cockpit.group);

  function toast(message, duration) { var t = $('toast'); t.textContent = message; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, duration || 3500); }
  function langName(code) { try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code; } catch (_) { return code; } }
  function nativeEvent(type, data) { try { var h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.golingo; if (h) h.postMessage(Object.assign({ type: type, game: 'f16-afterburner', version: 2 }, data || {})); } catch (_) {} }
  function cleanPayload(payload) { return JSON.parse(JSON.stringify(payload)); }
  function wordKey(w, learning, primary) { return [learning || lesson.learningLanguage, primary || lesson.primaryLanguage, String(w.id == null ? '' : w.id), w.word, w.translation || ''].join('\u001f'); }
  function timeLabel(n) { return Math.floor(n / 60) + ':' + String(Math.floor(n % 60)).padStart(2, '0'); }
  function angleDelta(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
  function forward(out) { return out.set(Math.sin(state.yaw) * Math.cos(state.pitch), Math.sin(state.pitch), Math.cos(state.yaw) * Math.cos(state.pitch)); }
  function onVoiceStatus(s) {
    if (!$('voiceBtn')) return;
    $('voiceBtn').textContent = s.paused ? 'Resume voice' : (s.blocked ? 'Enable voice' : 'Pause voice'); $('voiceBtn').setAttribute('aria-pressed', String(!!s.paused)); $('voiceBtn').classList.toggle('active', !!s.paused);
    var msg = s.message || (currentWord ? 'Repeating your word · M to pause' : 'Reach your first gate to hear a word.');
    if (!currentWord && !s.current && !s.paused && !s.blocked) msg = 'Reach your first gate to hear a word.';
    // The voice status must not reveal vocabulary when Show words is off.
    if (!settings.showWords && (s.status === 'speaking' || s.status === 'waiting' || s.speaking)) msg = 'Repeating your word · Pause voice to stop';
    $('voiceStatus').textContent = msg;
  }
  function applySpeechSettings() { speech.setLanguage(lesson.learningLanguage); speech.setPrimaryLanguage(lesson.primaryLanguage); speech.setRate(Number(settings.rate) || .85); speech.setGap(Number(settings.gap) || 1.6); speech.setSentenceEnabled(!!settings.examples); speech.setVoice(settings.voice || ''); }
  function applyQuality() { var pixel = settings.quality === 'high' ? 2 : settings.quality === 'low' ? 1 : 1.5; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, pixel)); resize(); }
  function resize() { var w = innerWidth, h = innerHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); camReset = true; }
  function updateHomeLesson() { $('homeLesson').textContent = langName(lesson.learningLanguage).toUpperCase() + ' → ' + langName(lesson.primaryLanguage).toUpperCase() + ' · ' + lesson.words.length + ' words ready'; $('lessonCount').textContent = lesson.words.length + ' words in your lesson'; $('basketCount').textContent = String(review.length); }
  function updateWordStrip() {
    $('wordsBtn').classList.toggle('active', !!settings.showWords); $('wordsBtn').setAttribute('aria-pressed', String(!!settings.showWords)); $('wordsBtn').textContent = settings.showWords ? 'Hide words' : 'Show words';
    $('wordStrip').hidden = !currentWord || !settings.showWords || state.mode === 'free';
    if (currentWord) {
      $('currentWord').textContent = currentWord.word; $('currentWord').lang = currentWordLanguage;
      $('currentTranslation').textContent = settings.showTranslation ? currentWord.translation || '' : ''; $('currentTranslation').lang = lesson.primaryLanguage;
      $('currentExample').replaceChildren();
      if (settings.examples && currentWord.sentence) {
        var example = document.createElement('span'); example.textContent = currentWord.sentence; example.lang = currentWordLanguage; $('currentExample').appendChild(example);
        if (settings.showTranslation && currentWord.sentenceTranslation) { var tr = document.createElement('span'); tr.className = 'translation-example'; tr.textContent = currentWord.sentenceTranslation; tr.lang = lesson.primaryLanguage; $('currentExample').appendChild(tr); }
      }
    }
    route.forEach(updateGateLabel); onVoiceStatus(speech.getState());
  }
  function persistSettings() { saveStored('settings', settings); }
  function releaseInputs() { keys = Object.create(null); steer.x = steer.y = 0; drag = null; stickPointer = null; action.boost = action.fire = action.gun = false; $('stick').style.transform = ''; }
  function setAuto(value, quiet) { state.autopilot = !!value && state.mode !== 'free'; $('autoBtn').classList.toggle('active', state.autopilot); $('autoBtn').setAttribute('aria-pressed', String(state.autopilot)); $('autoBtn').textContent = state.autopilot ? 'Autopilot on' : 'Autopilot'; if (!quiet) toast(state.autopilot ? 'Autopilot engaged. Move the stick to take control.' : 'You have control.'); }
  function setMode(mode) { state.mode = ['learn', 'combat', 'free'].indexOf(mode) >= 0 ? mode : 'learn'; document.querySelectorAll('[data-mode]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)); }); }

  // A continuous, wide racetrack keeps every lesson over the same scenic archipelago.
  function trackPoint(s) {
    var straight = 8600, radius = 700, arc = Math.PI * radius, length = 2 * straight + 2 * arc;
    s = ((s % length) + length) % length; var x, z;
    if (s < straight) { x = -radius; z = -1000 + s; }
    else if (s < straight + arc) { var a = (s - straight) / radius; x = -radius * Math.cos(a); z = 7600 + radius * Math.sin(a); }
    else if (s < 2 * straight + arc) { x = radius; z = 7600 - (s - straight - arc); }
    else { var b = (s - 2 * straight - arc) / radius; x = radius * Math.cos(b); z = -1000 - radius * Math.sin(b); }
    return new T.Vector3(x, Math.max(290 + Math.sin(s / 1900) * 70, world.heightAt(x, z) + 190), z);
  }
  function updateGateLabel(g) {
    var c = g.labelCanvas, ctx = c.getContext('2d'), w = lesson.words[g.index]; ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = 'rgba(6,31,42,.85)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(4, 4, 632, 144, 18); else ctx.rect(4, 4, 632, 144); ctx.fill();
    ctx.strokeStyle = g === route[0] ? '#ffd6a0' : '#95dad4'; ctx.lineWidth = 2; ctx.stroke(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var text = settings.showWords ? w.word : 'GATE ' + String(g.index + 1).padStart(2, '0'); var fontSize = 54; ctx.font = '600 ' + fontSize + 'px system-ui, sans-serif';
    while (ctx.measureText(text).width > 580 && fontSize > 18) { fontSize -= 2; ctx.font = '600 ' + fontSize + 'px system-ui, sans-serif'; }
    ctx.fillStyle = '#f5f5ec'; ctx.fillText(text, 320, settings.showWords && settings.showTranslation && w.translation ? 57 : 78, 582);
    if (settings.showWords && settings.showTranslation && w.translation) { ctx.font = '28px system-ui, sans-serif'; ctx.fillStyle = '#9de4dc'; ctx.fillText(w.translation, 320, 111, 570); }
    g.texture.needsUpdate = true;
  }
  function makeGate(index, s) {
    var group = new T.Group(), center = trackPoint(s), normal = trackPoint(s + 10).sub(trackPoint(s - 10)).normalize(); group.position.copy(center); group.quaternion.setFromUnitVectors(axisZ, normal);
    var main = new T.Mesh(ringGeometry, ringFutureMaterial), outer = new T.Mesh(ringOuterGeometry, ringOuterMaterial); group.add(main, outer);
    for (var i = 0; i < 4; i++) { var a = i * Math.PI / 2, marker = new T.Mesh(markerGeometry, ringFutureMaterial); marker.position.set(Math.cos(a) * 80, Math.sin(a) * 80, 0); marker.rotation.z = a; group.add(marker); }
    var c = document.createElement('canvas'); c.width = 640; c.height = 160; var texture = new T.CanvasTexture(c); texture.colorSpace = T.SRGBColorSpace; texture.minFilter = T.LinearFilter;
    var label = new T.Sprite(new T.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })); label.position.set(0, 107, 0); label.scale.set(118, 29.5, 1); group.add(label); scene.add(group);
    var gate = { group: group, main: main, outer: outer, index: index, s: s, center: center, normal: normal, labelCanvas: c, label: label, texture: texture, age: 0, sequence: ++courseSequence };
    updateGateLabel(gate); return gate;
  }
  function refreshGates() { route.forEach(function (g, i) { g.main.material = i === 0 ? ringActiveMaterial : ringFutureMaterial; for (var j = 2; j < 6; j++) g.group.children[j].material = i === 0 ? ringActiveMaterial : ringFutureMaterial; g.label.visible = i === 0; updateGateLabel(g); }); }
  function fillRoute() { if (state.mode === 'free') return; while (route.length < 5) { var idx = retryWords.length ? retryWords.shift() : cursor++ % lesson.words.length; routeS += 930; route.push(makeGate(idx, routeS)); } refreshGates(); }
  function removeGate(g) { scene.remove(g.group); g.texture.dispose(); g.label.material.dispose(); }
  function resetRoute() { route.forEach(removeGate); fadeGates.forEach(removeGate); route = []; fadeGates = []; retryWords = []; practiced.clear(); cursor = 0; routeS = 700; courseSequence = 0; currentWord = null; speech.stop(); fillRoute(); updateWordStrip(); }
  function addToReview(w) {
    var key = wordKey(w), existing = review.find(function (r) { return wordKey(r, r.learningLanguage, r.primaryLanguage) === key; }), now = new Date().toISOString();
    if (existing) { existing.practiced = (existing.practiced || 1) + 1; existing.lastPracticedAt = now; }
    else { review.push(Object.assign({}, cleanPayload(w), { learningLanguage: lesson.learningLanguage, primaryLanguage: lesson.primaryLanguage, collectedAt: now, lastPracticedAt: now, practiced: 1, learned: false })); if (review.length > 1500) review.shift(); }
    saveStored('review', review); $('basketCount').textContent = String(review.length);
  }
  function collectGate(gate, centered) {
    var w = lesson.words[gate.index]; state.gates++; state.score += centered ? 150 : 100; currentWord = w; currentWordLanguage = lesson.learningLanguage;
    var before = practiced.size; practiced.add(gate.index); addToReview(w); speech.play(w); sound.chime(); burst(gate.center, 0x92edd7, 26, 36);
    gate.age = 0; fadeGates.push(gate); route.shift(); fillRoute(); updateWordStrip();
    if (state.mode === 'combat' && state.gates % 4 === 0) { state.missiles = Math.min(30, state.missiles + 6); state.cannon = Math.min(1000, state.cannon + 180); state.flares = Math.min(8, state.flares + 2); toast('Resupplied · +6 missiles · +2 flares'); }
    else if (practiced.size === lesson.words.length && before < practiced.size) { toast('Lesson complete! All ' + lesson.words.length + ' words are in your basket. Keep flying to practice again.', 5200); nativeEvent('lessonComplete', { count: practiced.size }); }
    else toast((centered ? 'Perfect gate' : 'Word collected') + ' · ' + practiced.size + ' / ' + lesson.words.length + ' practiced', 2100);
    nativeEvent('wordCollected', { word: cleanPayload(w), learningLanguage: lesson.learningLanguage, primaryLanguage: lesson.primaryLanguage, collectedCount: practiced.size });
  }
  function checkGates() {
    if (!route.length) return;
    var g = route[0], before = vec.copy(state.prev).sub(g.center).dot(g.normal), after = vec2.copy(state.pos).sub(g.center).dot(g.normal);
    if (before <= 0 && after >= 0 && after !== before) {
      var t = -before / (after - before), crossing = state.prev.clone().lerp(state.pos, t), r = crossing.distanceTo(g.center);
      if (r < 79) { collectGate(g, r < 25); return; }
    }
    // Missed vocabulary is queued again. It never counts as learned without a gate crossing.
    if (after > 220) { retryWords.push(g.index); route.shift(); removeGate(g); state.missed++; fillRoute(); toast('Gate missed. That word is queued for another pass.', 2600); }
  }
  function segmentDistance(a, b, p) { var dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, l = dx * dx + dy * dy + dz * dz; var t = l ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy + (p.z - a.z) * dz) / l, 0, 1) : 0; return Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y, a.z + t * dz - p.z); }

  function disposeObject(obj) {
    var geometries = new Set(), materials = new Set(), textures = new Set(); obj.traverse(function (m) { if (m.geometry) geometries.add(m.geometry); if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(function (mat) { materials.add(mat); if (mat.map) textures.add(mat.map); }); });
    geometries.forEach(function (g) { g.dispose(); }); materials.forEach(function (m) { m.dispose(); }); textures.forEach(function (t) { t.dispose(); }); scene.remove(obj);
  }
  function clearCombat() {
    enemies.forEach(function (e) { disposeObject(e.mesh); e.label.remove(); }); enemies = [];
    projectiles.forEach(function (p) { scene.remove(p.mesh); }); projectiles = [];
    effects.forEach(function (e) { scene.remove(e.mesh); e.mesh.material.dispose(); }); effects = [];
    flakes.forEach(function (p) { scene.remove(p.mesh); p.mesh.material.dispose(); }); flakes = [];
    state.lock = null; $('targetLayer').replaceChildren();
  }
  function burst(pos, color, count, power) {
    if (flakes.length > 160) return;
    for (var i = 0; i < count; i++) { var mat = new T.MeshBasicMaterial({ color: color, transparent: true, opacity: .85 }), mesh = new T.Mesh(particleGeometry, mat); mesh.position.copy(pos); mesh.scale.setScalar(1.1 + Math.random() * 1.8); scene.add(mesh); flakes.push({ mesh: mesh, velocity: new T.Vector3((Math.random() - .5) * power, (Math.random() - .25) * power, (Math.random() - .5) * power), life: .6 + Math.random() * .8, max: 1.4 }); }
  }
  function explode(pos, size) { var mesh = new T.Mesh(explosionGeometry, new T.MeshBasicMaterial({ color: 0xffbd6e, transparent: true, opacity: .8 })); mesh.position.copy(pos); scene.add(mesh); effects.push({ mesh: mesh, life: .65, max: .65, size: size }); burst(pos, 0xffb86f, 16, 55); sound.boom(); }
  function spawnEnemy(kind) {
    var isShip = kind === 'ship', mesh = isShip ? F16Visuals.createShip(T) : F16Visuals.createJet(T, { enemy: true, body: 0x899b9f, wing: 0x617d83 });
    var pos = state.pos.clone().addScaledVector(forward(new T.Vector3()), 1400 + Math.random() * 600); pos.x += (Math.random() - .5) * 700;
    pos.y = isShip ? 5 : Math.max(world.heightAt(pos.x, pos.z) + 180, state.pos.y + 80 + Math.random() * 140);
    if (isShip && world.heightAt(pos.x, pos.z) > 0) { pos.x = 0; pos.z = 2500; }
    mesh.position.copy(pos); scene.add(mesh); var label = document.createElement('div'); label.className = 'target-box'; label.hidden = true; var text = document.createElement('span'); label.appendChild(text); $('targetLayer').appendChild(label);
    var e = { mesh: mesh, kind: kind || 'jet', hp: isShip ? 100 : 36, yaw: state.yaw + Math.PI * .8, pitch: 0, speed: isShip ? 10 : 150 + Math.random() * 30, fireTime: 9 + Math.random() * 8, age: 0, label: label, text: text }; enemies.push(e);
  }
  function killEnemy(e) { var i = enemies.indexOf(e); if (i < 0) return; explode(e.mesh.position, e.kind === 'ship' ? 45 : 22); state.score += e.kind === 'ship' ? 600 : 300; state.kills++; e.label.remove(); disposeObject(e.mesh); enemies.splice(i, 1); if (state.lock === e) state.lock = null; if (state.kills % 5 === 0) { state.missiles = Math.min(30, state.missiles + 8); toast('Five contacts cleared · missiles replenished'); } }
  function hurt(amount) { if (state.grace > 0 || state.phase !== 'flight') return; state.damage = Math.min(100, state.damage + amount); state.hitT = .45; if (state.damage >= 100) endFlight(); }
  function acquireTarget() { var best = null, bestDot = .86, f = forward(new T.Vector3()); enemies.forEach(function (e) { var v = e.mesh.position.clone().sub(state.pos), d = v.length(), dot = v.normalize().dot(f); if (d < 2300 && d > 35 && dot > bestDot) { best = e; bestDot = dot; } }); state.lock = best; }
  function launchProjectile(origin, dir, friendly, target, bullet) {
    var mesh = new T.Mesh(bullet ? bulletGeometry : projectileGeometry, bullet ? bulletMaterial : friendly ? friendlyMaterial : hostileMaterial); mesh.position.copy(origin);
    mesh.quaternion.setFromUnitVectors(bullet ? axisZ : axisY, dir); scene.add(mesh);
    projectiles.push({ mesh: mesh, velocity: dir.clone().multiplyScalar(bullet ? 1000 : friendly ? 680 : 360), friendly: friendly, target: target, bullet: !!bullet, life: bullet ? 1.7 : friendly ? 7 : 7.5 });
  }
  function fireMissile() { if (state.phase !== 'flight' || state.paused || state.mode !== 'combat' || state.missileCd > 0 || state.missiles <= 0) return; state.missiles--; state.missileCd = .8; var dir = forward(new T.Vector3()); launchProjectile(state.pos.clone().addScaledVector(dir, 12), dir, true, state.lock, false); sound.shot(); }
  function fireCannon() { if (state.cannon <= 0 || state.gunCd > 0) return; state.cannon--; state.gunCd = .075; var dir = forward(new T.Vector3()); launchProjectile(state.pos.clone().addScaledVector(dir, 10), dir, true, null, true); }
  function flare() { if (state.mode !== 'combat' || state.paused || state.phase !== 'flight' || state.flares <= 0 || state.flareCd > 0) return; state.flares--; state.flareCd = 2.5; state.flareT = 3.5; burst(state.pos.clone().addScaledVector(forward(new T.Vector3()), -20), 0xffe4a4, 22, 70); toast('Flares released', 1600); }
  function updateCombat(dt) {
    spawnTimer -= dt; if (spawnTimer <= 0 && enemies.length < 5) { spawnEnemy(state.kills > 3 && Math.random() < .22 ? 'ship' : 'jet'); spawnTimer = 9; }
    acquireTarget(); if (action.fire || keys.Space) fireMissile(); if (action.gun || keys.KeyC) fireCannon(); if (keys.KeyF) flare();
    for (var i = enemies.length - 1; i >= 0; i--) {
      var e = enemies[i], delta = state.pos.clone().sub(e.mesh.position), distance = delta.length(); e.age += dt;
      if (distance > 6500 || e.age > 150) { e.label.remove(); disposeObject(e.mesh); enemies.splice(i, 1); continue; }
      if (e.kind !== 'ship') {
        var desired = Math.atan2(delta.x, delta.z); if (distance < 330) desired += .8;
        var turn = clamp(angleDelta(desired, e.yaw) * .65, -.5, .5); e.yaw += turn * dt; e.pitch = damp(e.pitch, clamp(Math.asin(clamp(delta.y / Math.max(1, distance), -.5, .5)), -.36, .36), 1, dt);
        var dir = new T.Vector3(Math.sin(e.yaw) * Math.cos(e.pitch), Math.sin(e.pitch), Math.cos(e.yaw) * Math.cos(e.pitch)); e.mesh.position.addScaledVector(dir, e.speed * dt);
        e.mesh.position.y = Math.max(world.heightAt(e.mesh.position.x, e.mesh.position.z) + 80, e.mesh.position.y); e.mesh.rotation.set(-e.pitch, e.yaw, -turn, 'YXZ'); e.mesh.userData.update(dt, simTime, true);
        if (distance < 12 && state.grace <= 0) { hurt(20); state.grace = 1; }
      } else { e.mesh.position.z += Math.sin(e.age * .2) * 6 * dt; e.mesh.rotation.z = Math.sin(simTime * .6) * .013; }
      e.fireTime -= dt;
      if (e.fireTime < 0 && distance < 1600 && distance > 180 && state.grace <= 0) { e.fireTime = 7 + Math.random() * 7; launchProjectile(e.mesh.position.clone(), delta.normalize(), false, 'player', false); }
    }
  }
  function updateProjectiles(dt) {
    for (var i = projectiles.length - 1; i >= 0; i--) {
      var p = projectiles[i]; p.life -= dt; prevProjectile.copy(p.mesh.position);
      if (!p.friendly && state.flareT > 0) p.target = null;
      var targetPos = p.target === 'player' ? state.pos : p.target && enemies.indexOf(p.target) >= 0 ? p.target.mesh.position : null;
      if (targetPos) { var targetVelocity = vec.copy(targetPos).sub(p.mesh.position).normalize().multiplyScalar(p.friendly ? 680 : 360); p.velocity.lerp(targetVelocity, 1 - Math.exp(-(p.friendly ? 2.5 : .95) * dt)); }
      p.mesh.position.addScaledVector(p.velocity, dt); p.mesh.quaternion.setFromUnitVectors(p.bullet ? axisZ : axisY, vec.copy(p.velocity).normalize()); var hit = false;
      if (p.friendly) { for (var j = enemies.length - 1; j >= 0; j--) { var e = enemies[j]; if (segmentDistance(prevProjectile, p.mesh.position, e.mesh.position) < (e.kind === 'ship' ? 32 : p.bullet ? 10 : 15)) { e.hp -= p.bullet ? 9 : 40; hit = true; if (e.hp <= 0) killEnemy(e); else explode(p.mesh.position, 8); break; } } }
      else if (segmentDistance(prevProjectile, p.mesh.position, state.pos) < 12) { hit = true; hurt(17); explode(p.mesh.position, 10); }
      if (hit || p.life <= 0 || p.mesh.position.y < 0) { scene.remove(p.mesh); projectiles.splice(i, 1); }
    }
  }
  function updateEffects(dt) {
    for (var i = effects.length - 1; i >= 0; i--) { var e = effects[i]; e.life -= dt; var age = 1 - e.life / e.max; e.mesh.scale.setScalar(e.size * (.25 + age)); e.mesh.material.opacity = Math.max(0, 1 - age); if (e.life <= 0) { scene.remove(e.mesh); e.mesh.material.dispose(); effects.splice(i, 1); } }
    for (var k = flakes.length - 1; k >= 0; k--) { var p = flakes[k]; p.life -= dt; p.mesh.position.addScaledVector(p.velocity, dt); p.velocity.y -= dt * 6; p.mesh.material.opacity = clamp(p.life, 0, .8); if (p.life <= 0) { scene.remove(p.mesh); p.mesh.material.dispose(); flakes.splice(k, 1); } }
    for (var f = fadeGates.length - 1; f >= 0; f--) { var g = fadeGates[f]; g.age += dt; g.group.scale.setScalar(1 + g.age * .32); g.label.visible = false; if (g.age > .5) { removeGate(g); fadeGates.splice(f, 1); } }
  }

  function startFlight() {
    speech.unlock(); sound.unlock(); closeModal(false); clearCombat(); releaseInputs(); $('home').hidden = true; $('flightUI').hidden = false; $('resultModal').hidden = true; boot.hidden = true;
    state.phase = 'flight'; state.paused = false; state.time = 0; state.score = state.kills = state.gates = state.missed = state.damage = 0; state.speed = 185; state.throttle = .5; state.yaw = state.pitch = state.roll = 0;
    state.pos.copy(trackPoint(700)); state.prev.copy(state.pos); state.grace = 8; state.missileCd = .8; state.gunCd = state.flareCd = state.flareT = state.hitT = 0; state.missiles = 24; state.cannon = 800; state.flares = 6; state.lock = null; camReset = true; spawnTimer = 12;
    $('throttle').value = 50; $('combatControls').hidden = state.mode !== 'combat'; $('autoBtn').disabled = state.mode === 'free'; $('modeLabel').textContent = state.mode === 'combat' ? 'COMBAT + WORDS' : state.mode === 'free' ? 'FREE FLIGHT' : 'LANGUAGE FLIGHT';
    resetRoute(); setAuto(false, true); speech.setSuspended(false); applySpeechSettings(); if (state.mode === 'combat') { spawnEnemy('jet'); spawnEnemy('jet'); }
    updateHUD(); toast(state.mode === 'free' ? 'You have control. Explore the coast.' : 'Fly through the gold gate. Autopilot is here if you want a hand.', 4800); $('view').focus({ preventScroll: true });
  }
  function goHome() { closeModal(false); clearCombat(); state.phase = 'hangar'; state.paused = false; releaseInputs(); speech.stop(); speech.setSuspended(true); $('flightUI').hidden = true; $('home').hidden = false; cockpit.group.visible = false; jet.visible = true; route.forEach(removeGate); route = []; fadeGates.forEach(removeGate); fadeGates = []; updateHomeLesson(); }
  function endFlight() { state.phase = 'down'; state.paused = true; releaseInputs(); speech.setSuspended(true); $('resultScore').textContent = state.score; $('resultWords').textContent = state.gates; $('resultTime').textContent = timeLabel(state.time); openModal('resultModal'); }
  function updateFlight(dt) {
    state.prev.copy(state.pos); state.time += dt; state.grace = Math.max(0, state.grace - dt); state.missileCd = Math.max(0, state.missileCd - dt); state.gunCd = Math.max(0, state.gunCd - dt); state.flareCd = Math.max(0, state.flareCd - dt); state.flareT = Math.max(0, state.flareT - dt); state.hitT = Math.max(0, state.hitT - dt);
    if (keys.KeyQ || keys.Minus) state.throttle = Math.max(0, state.throttle - dt * .25); if (keys.KeyE || keys.Equal) state.throttle = Math.min(1, state.throttle + dt * .25);
    var inputX = clamp(steer.x + (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), -1, 1), inputY = clamp(-steer.y + (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), -1, 1);
    if ((Math.abs(inputX) > .09 || Math.abs(inputY) > .09) && state.autopilot) setAuto(false, true);
    var bank = inputX, turn = 0;
    if (state.autopilot && route.length) {
      var delta = vec.copy(route[0].center).sub(state.pos), distance = delta.length(), desiredYaw = Math.atan2(delta.x, delta.z), desiredPitch = Math.asin(clamp(delta.y / Math.max(distance, 1), -.58, .58));
      turn = clamp(angleDelta(desiredYaw, state.yaw) * 1.8, -.63, .63); state.yaw += turn * dt; state.pitch = damp(state.pitch, desiredPitch, 2.4, dt); bank = turn / .8;
    } else { state.yaw += inputX * .68 * dt * (.8 + state.speed / 500); state.pitch = damp(state.pitch, inputY * .48, 2.6, dt); }
    state.yaw = ((state.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI; state.roll = damp(state.roll, -bank * .68, 4.2, dt); state.boost = !!(action.boost || keys.ShiftLeft || keys.ShiftRight);
    var targetSpeed = 110 + state.throttle * 150 + (state.boost ? 125 : 0); if (state.autopilot) targetSpeed = Math.min(targetSpeed, Math.abs(turn) > .18 ? 148 : 185);
    state.speed = damp(state.speed, targetSpeed, 1.2, dt); state.pos.addScaledVector(forward(fwd), state.speed * dt);
    var floor = world.heightAt(state.pos.x, state.pos.z), clearance = state.pos.y - floor;
    if (clearance < 35) { if (state.mode === 'combat' && clearance < 15) hurt(24); state.pos.y = Math.max(state.pos.y, floor + 30); state.pitch = Math.max(state.pitch, .24); }
    state.pos.y = Math.min(3400, state.pos.y);
    if (Math.abs(state.pos.x) > 16000 || state.pos.z > 22000 || state.pos.z < -13000) { state.pos.copy(trackPoint(700)); state.yaw = state.pitch = 0; state.prev.copy(state.pos); resetCoursePosition(); camReset = true; toast('Back over the training coast. Your collected words are saved.'); }
    jet.position.copy(state.pos); jet.rotation.set(-state.pitch, state.yaw, state.roll, 'YXZ'); jet.userData.update(dt, simTime, state.boost);
    if (state.mode !== 'free') checkGates(); if (state.mode === 'combat') { updateCombat(dt); updateProjectiles(dt); } updateEffects(dt); updateCamera(dt); sound.update(state.speed, state.boost, speech.getState().speaking, false);
  }
  function resetCoursePosition() { route.forEach(removeGate); route = []; routeS = 700; fillRoute(); }
  function updateCamera(dt) {
    var mode = settings.camera % 3, offset = mode === 1 ? new T.Vector3(0, 9, -39) : mode === 2 ? new T.Vector3(0, 1.06, 3.9) : new T.Vector3(0, 4.25, -23);
    offset.applyEuler(new T.Euler(-state.pitch * .85, state.yaw, mode === 2 ? state.roll : state.roll * .12, 'YXZ')); var dest = state.pos.clone().add(offset);
    if (camReset || mode === 2) camera.position.copy(dest); else camera.position.lerp(dest, 1 - Math.exp(-dt * 9));
    camera.up.set(0, 1, 0); var aim = state.pos.clone().addScaledVector(forward(new T.Vector3()), mode === 2 ? 300 : 60); aim.y += mode === 2 ? .85 : 1.2; camera.lookAt(aim);
    // Apply bank locally AFTER lookAt. Writing Euler z here can flip the entire camera.
    camera.rotateZ(-state.roll * (mode === 2 ? .88 : .14)); camera.fov = mode === 2 ? 76 : damp(camera.fov, state.boost ? 68 : mode === 1 ? 62 : 58, 2, dt); camera.updateProjectionMatrix();
    cockpit.group.scale.x = Math.min(1, camera.aspect / 1.2);
    jet.visible = mode !== 2; cockpit.group.visible = mode === 2; camReset = false;
  }
  function updateHangar(dt) {
    jet.visible = true; cockpit.group.visible = false; var origin = new T.Vector3(0, 330, -300); jet.position.copy(origin); jet.position.y += Math.sin(simTime * .7) * .2; jet.rotation.set(.015, -.35 + Math.sin(simTime * .13) * .08, -.07, 'YXZ'); jet.userData.update(dt, simTime, false);
    var portrait = innerWidth < 620; camera.position.copy(origin).add(new T.Vector3(portrait ? 16 : 15, portrait ? 7.3 : 8, portrait ? -27 : -23));
    var look = origin.clone().add(new T.Vector3(portrait ? .5 : 9, portrait ? -5.5 : 0, portrait ? 0 : 1.8)); camera.up.set(0, 1, 0); camera.fov = portrait ? 51 : 46; camera.lookAt(look); camera.updateProjectionMatrix(); sound.update(0, false, false, true);
  }

  function drawRadar() {
    var c = $('radar'), ctx = c.getContext('2d'), size = 240, center = 120, radius = 106; ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(5,29,40,.57)'; ctx.beginPath(); ctx.arc(center, center, radius, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(167,227,214,.35)'; ctx.lineWidth = 1;
    [35, 70, 106].forEach(function (r) { ctx.beginPath(); ctx.arc(center, center, r, 0, TAU); ctx.stroke(); }); ctx.beginPath(); ctx.moveTo(14, 120); ctx.lineTo(226, 120); ctx.moveTo(120, 14); ctx.lineTo(120, 226); ctx.stroke();
    var cs = Math.cos(state.yaw), sn = Math.sin(state.yaw), scale = .047;
    function map(p) { var dx = p.x - state.pos.x, dz = p.z - state.pos.z, x = (dx * cs - dz * sn) * scale, y = -(dx * sn + dz * cs) * scale; return { x: center + x, y: center + y, visible: x * x + y * y < radius * radius }; }
    ctx.strokeStyle = 'rgba(140,229,220,.22)'; ctx.beginPath(); ctx.moveTo(center, center); route.forEach(function (g) { var p = map(g.center); if (p.visible) ctx.lineTo(p.x, p.y); }); ctx.stroke();
    route.forEach(function (g, i) { var p = map(g.center); if (!p.visible) return; ctx.strokeStyle = i === 0 ? '#ffd399' : '#8be1d7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, i === 0 ? 6 : 3, 0, TAU); ctx.stroke(); });
    enemies.forEach(function (e) { var p = map(e.mesh.position); if (p.visible) { ctx.fillStyle = '#ffa27d'; ctx.fillRect(p.x - 4, p.y - 4, 8, 8); } });
    ctx.fillStyle = '#d8f4e8'; ctx.beginPath(); ctx.moveTo(120, 111); ctx.lineTo(113, 128); ctx.lineTo(120, 124); ctx.lineTo(127, 128); ctx.closePath(); ctx.fill(); ctx.font = '16px monospace'; ctx.fillStyle = '#b7d6d1'; ctx.textAlign = 'center'; ctx.fillText('ROUTE', 120, 237);
  }
  function drawTargets() {
    enemies.forEach(function (e) { var d = e.mesh.position.distanceTo(state.pos), p = e.mesh.position.clone().project(camera), visible = d < 2400 && p.z > -1 && p.z < 1 && Math.abs(p.x) < .91 && Math.abs(p.y) < .85; e.label.hidden = !visible; if (!visible) return; e.label.style.left = (p.x * .5 + .5) * innerWidth + 'px'; e.label.style.top = (-p.y * .5 + .5) * innerHeight + 'px'; e.label.classList.toggle('locked', e === state.lock); e.text.textContent = (e === state.lock ? 'LOCK ' : '') + (e.kind === 'ship' ? 'SHIP' : 'BANDIT') + ' ' + Math.round(d) + 'm'; });
  }
  function updateHUD() {
    $('speed').textContent = Math.round(state.speed * 3.6); $('altitude').textContent = Math.round(state.pos.y); $('thrustLabel').textContent = state.boost ? 'AFTERBURNER' : 'THRUST ' + Math.round(state.throttle * 100) + '%'; $('throttle').value = Math.round(state.throttle * 100);
    $('score').textContent = state.score; $('gatesStat').textContent = state.gates; var degrees = ((state.yaw * 180 / Math.PI) + 360) % 360, headings = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']; $('heading').textContent = headings[Math.round(degrees / 45) % 8] + ' · ' + String(Math.round(degrees) % 360).padStart(3, '0') + '°';
    $('flightStatus').textContent = state.autopilot ? 'AUTO / ROUTE' : state.mode === 'combat' ? 'HULL ' + Math.max(0, Math.round(100 - state.damage)) + '%' : state.pitch > .08 ? 'CLIMBING' : state.pitch < -.08 ? 'DESCENDING' : 'LEVEL FLIGHT';
    $('combatStat').textContent = state.mode === 'combat' ? 'CONTACTS ' + state.kills + ' · HULL ' + Math.round(100 - state.damage) + '%' : 'FLIGHT ' + timeLabel(state.time);
    $('fireBtn').textContent = 'MISSILE ' + state.missiles; $('flareBtn').textContent = 'FLARES ' + state.flares; $('gunBtn').textContent = 'GUN ' + state.cannon;
    $('boostBtn').classList.toggle('active', state.boost); $('courseProgress').style.width = (practiced.size / lesson.words.length * 100) + '%';
    if (state.mode === 'free') { $('courseLabel').textContent = 'OPEN COAST'; $('routeTitle').textContent = 'Find your own horizon'; $('routeDistance').textContent = timeLabel(state.time); $('routeHint').textContent = 'Explore freely · Change camera with V'; $('directionCue').hidden = true; }
    else if (route.length) {
      var gate = route[0], distance = gate.center.distanceTo(state.pos); $('courseLabel').textContent = state.mode === 'combat' ? 'INTERCEPT / WORD RUN' : 'COASTAL WORD RUN'; $('routeDistance').textContent = distance >= 1000 ? (distance / 1000).toFixed(1) + ' KM' : Math.round(distance) + ' M';
      $('routeTitle').textContent = settings.showWords ? lesson.words[gate.index].word : 'Fly through the glowing gate'; $('routeTitle').dir = 'auto'; $('routeHint').textContent = 'Gate ' + String(gate.index + 1).padStart(2, '0') + ' / ' + String(lesson.words.length).padStart(2, '0') + ' · ' + practiced.size + ' practiced' + (state.autopilot ? ' · Autopilot' : '');
      var projected = gate.center.clone().project(camera), delta = gate.center.clone().sub(state.pos), a = angleDelta(Math.atan2(delta.x, delta.z), state.yaw); var offscreen = projected.z > 1 || Math.abs(projected.x) > .75 || Math.abs(projected.y) > .65;
      $('directionCue').hidden = !offscreen; $('directionCue').textContent = Math.abs(a) > .25 ? (a > 0 ? 'Turn right ↗' : '↖ Turn left') + ' · Next gate' : delta.y > 60 ? '↑ Climb to the gate' : delta.y < -60 ? '↓ Descend to the gate' : 'Next gate ahead';
    }
    var clearance = state.pos.y - world.heightAt(state.pos.x, state.pos.z), threat = projectiles.some(function (p) { return !p.friendly && p.target === 'player' && p.mesh.position.distanceTo(state.pos) < 900; });
    $('warning').hidden = clearance > 70 && !threat; $('warning').textContent = threat ? 'MISSILE INBOUND · F / FLARES' : 'TERRAIN ASSIST · CLIMB'; $('hitFlash').style.opacity = String(Math.min(.8, state.hitT * 1.6)); drawRadar(); drawTargets(); if (cockpit.group.visible) cockpit.update();
  }

  // Modal, editor, review and bridge code follows below.
  var previewSpeech = L.createSpeech({ language: lesson.learningLanguage, primaryLanguage: lesson.primaryLanguage, onStatus: function (s) { if (activeModal === 'lessonModal' && (s.blocked || s.status === 'speaking' || s.status === 'error')) $('voiceNote').textContent = s.message; } });
  var importDiagnostics = { importedAt: null, count: lesson.words.length, source: 'saved-or-sample', error: null };
  function openModal(id) {
    if (!activeModal) modalFocus = document.activeElement;
    if (activeModal) $(activeModal).hidden = true;
    activeModal = id; $(id).hidden = false; releaseInputs(); state.paused = state.phase === 'flight' || state.phase === 'down'; speech.setSuspended(true); previewSpeech.stop();
    if (id === 'lessonModal') fillEditor(); if (id === 'basketModal') renderBasket();
    var button = $(id).querySelector('button'); if (button) setTimeout(function () { button.focus({ preventScroll: true }); }, 20);
  }
  function closeModal(resume) {
    if (activeModal) $(activeModal).hidden = true; activeModal = null; previewSpeech.stop(); clearArmed = false; $('clearBasketBtn').textContent = 'Clear basket';
    if (resume !== false) { state.paused = state.phase === 'down'; speech.setSuspended(state.phase !== 'flight' || document.hidden); if (modalFocus && modalFocus.isConnected) modalFocus.focus({ preventScroll: true }); }
    releaseInputs();
  }
  function fillEditor() {
    $('learningLanguage').value = lesson.learningLanguage; $('primaryLanguage').value = lesson.primaryLanguage;
    $('lessonInput').value = JSON.stringify({ learningLanguage: lesson.learningLanguage, primaryLanguage: lesson.primaryLanguage, words: lesson.words }, null, 2);
    $('showWordsSetting').checked = settings.showWords; $('showTranslationSetting').checked = settings.showTranslation; $('sentenceSetting').checked = settings.examples; $('soundSetting').checked = settings.sound;
    $('speechRate').value = settings.rate; $('speechGap').value = settings.gap; $('rateValue').textContent = Number(settings.rate).toFixed(2) + '×'; $('gapValue').textContent = Number(settings.gap).toFixed(1) + ' s'; $('qualitySelect').value = settings.quality;
    $('lessonError').hidden = true; updateEditorCount(false); populateVoices();
  }
  function editorPayload() { var p = L.parseInput($('lessonInput').value, { learningLanguage: $('learningLanguage').value, primaryLanguage: $('primaryLanguage').value }); p.learningLanguage = L.normalizeLanguage($('learningLanguage').value); p.primaryLanguage = L.normalizeLanguage($('primaryLanguage').value); return p; }
  function updateEditorCount(readLanguages) {
    try { var p = L.parseInput($('lessonInput').value, { learningLanguage: $('learningLanguage').value, primaryLanguage: $('primaryLanguage').value });
      if (readLanguages) { $('learningLanguage').value = p.learningLanguage; $('primaryLanguage').value = p.primaryLanguage; populateVoices(); }
      $('lessonCount').textContent = p.words.length + ' words ready to fly'; $('lessonError').hidden = true;
    } catch (_) { $('lessonCount').textContent = 'Paste your words above'; }
  }
  function populateVoices() {
    var code; try { code = L.normalizeLanguage($('learningLanguage').value || lesson.learningLanguage); } catch (_) { return; }
    var all = speech.getVoices(), base = code.split('-')[0].toLowerCase(), matches = all.filter(function (v) { return v.lang && v.lang.toLowerCase().split(/[-_]/)[0] === base; });
    $('voiceSelect').replaceChildren(); var auto = document.createElement('option'); auto.value = ''; auto.textContent = 'Automatic matching voice'; $('voiceSelect').appendChild(auto);
    matches.forEach(function (v) { var option = document.createElement('option'); option.value = v.voiceURI; option.textContent = v.name + ' · ' + v.lang; $('voiceSelect').appendChild(option); });
    $('voiceSelect').value = matches.some(function (v) { return v.voiceURI === settings.voice; }) ? settings.voice : '';
    $('voiceNote').textContent = matches.length ? matches.length + ' matching device voice' + (matches.length === 1 ? '' : 's') + '. Test a word to hear your choice. Recordings in your lesson take priority.' : 'No matching device voice is listed yet. Add a voice for this language in your device settings, or supply audioUrl recordings. Tap Test voice to check.';
  }
  function commitLesson(input, opts) {
    opts = opts || {};
    try {
      var p = L.parseInput(input, { primaryLanguage: lesson.primaryLanguage, learningLanguage: lesson.learningLanguage });
      if (opts.append) { if (p.learningLanguage !== lesson.learningLanguage || p.primaryLanguage !== lesson.primaryLanguage) throw new Error('Append requires the same learning and translation languages. Import without append to replace the lesson.'); p.words = lesson.words.concat(p.words); p = L.parseInput(p); }
      lesson = p; saveStored('lesson', lesson); currentWord = null; speech.stop(); applySpeechSettings();
      if (state.phase === 'flight') { state.pos.copy(trackPoint(700)); state.prev.copy(state.pos); state.yaw = state.pitch = state.roll = 0; state.gates = state.missed = 0; camReset = true; clearCombat(); spawnTimer = 5; resetRoute(); }
      else { route.forEach(removeGate); route = []; practiced.clear(); cursor = 0; currentWord = null; }
      speech.setSuspended(state.phase !== 'flight' || !!activeModal || document.hidden); updateHomeLesson(); updateWordStrip();
      importDiagnostics = { importedAt: new Date().toISOString(), count: lesson.words.length, source: opts.source || 'api', error: null };
      nativeEvent('wordsImported', { count: lesson.words.length, learningLanguage: lesson.learningLanguage, primaryLanguage: lesson.primaryLanguage });
      return { success: true, count: lesson.words.length, learningLanguage: lesson.learningLanguage, primaryLanguage: lesson.primaryLanguage };
    } catch (e) { importDiagnostics.error = e.message; nativeEvent('error', { message: e.message }); throw e; }
  }
  function testVoice() {
    var p; try { p = editorPayload(); } catch (e) { $('lessonError').hidden = false; $('lessonError').textContent = e.message; return; }
    previewSpeech.unlock(); previewSpeech.setLanguage(p.learningLanguage); previewSpeech.setPrimaryLanguage(p.primaryLanguage); previewSpeech.setVoice($('voiceSelect').value); previewSpeech.setRate(Number($('speechRate').value)); previewSpeech.setSentenceEnabled($('sentenceSetting').checked); previewSpeech.setSuspended(false); previewSpeech.play(p.words[0], { once: true });
  }
  function previewEntry(entry, translation) {
    previewSpeech.unlock(); previewSpeech.setSuspended(false); previewSpeech.setLanguage(entry.learningLanguage || lesson.learningLanguage); previewSpeech.setPrimaryLanguage(entry.primaryLanguage || lesson.primaryLanguage); previewSpeech.setVoice(settings.voice || ''); previewSpeech.setRate(settings.rate); previewSpeech.setSentenceEnabled(false); previewSpeech.play(entry, { once: true, translation: !!translation });
  }
  function renderBasket() {
    var root = $('basketList'); root.replaceChildren(); $('reviewCount').textContent = review.length + ' words collected · ' + review.filter(function (r) { return r.learned; }).length + ' learned'; $('exportBtn').disabled = $('csvBtn').disabled = review.length === 0;
    if (!review.length) { var empty = document.createElement('div'); empty.className = 'basket-empty'; empty.textContent = 'Your next word is out there.\nFly through a glowing gate to start your collection.'; root.appendChild(empty); return; }
    review.slice().reverse().forEach(function (entry) {
      var row = document.createElement('div'); row.className = 'basket-item'; var play = document.createElement('button'); play.className = 'small'; play.textContent = '▷'; play.setAttribute('aria-label', 'Listen to ' + entry.word); play.addEventListener('click', function () { previewEntry(entry, false); }); row.appendChild(play);
      var content = document.createElement('div'); content.className = 'entry'; var word = document.createElement('strong'); word.dir = 'auto'; word.lang = entry.learningLanguage || ''; word.textContent = entry.word; content.appendChild(word);
      if (entry.translation) { var meaning = document.createElement('button'); meaning.className = 'small quiet meaning'; meaning.style.padding = '2px 0'; meaning.style.minHeight = '26px'; meaning.textContent = entry.translation + ' ▷'; meaning.dir = 'auto'; meaning.title = 'Listen to translation'; meaning.addEventListener('click', function () { previewEntry(entry, true); }); content.appendChild(document.createElement('br')); content.appendChild(meaning); }
      if (entry.sentence) { var sentence = document.createElement('p'); sentence.dir = 'auto'; sentence.textContent = entry.sentence; content.appendChild(sentence); if (entry.sentenceTranslation) { var tr = document.createElement('p'); tr.dir = 'auto'; tr.textContent = entry.sentenceTranslation; content.appendChild(tr); } }
      var meta = document.createElement('small'); meta.textContent = (entry.learningLanguage || lesson.learningLanguage).toUpperCase() + ' · practiced ' + (entry.practiced || 1) + '×'; content.appendChild(meta); row.appendChild(content);
      var known = document.createElement('button'); known.className = 'small review-status' + (entry.learned ? ' primary' : ''); known.textContent = entry.learned ? 'Learned ✓' : 'Mark learned'; known.setAttribute('aria-pressed', String(!!entry.learned)); known.addEventListener('click', function () { entry.learned = !entry.learned; saveStored('review', review); renderBasket(); }); row.appendChild(known); root.appendChild(row);
    });
  }
  function exportPayload() {
    var groups = new Map(); review.forEach(function (r) { var learning = r.learningLanguage || lesson.learningLanguage, primary = r.primaryLanguage || lesson.primaryLanguage, key = learning + '|' + primary; if (!groups.has(key)) groups.set(key, { learningLanguage: learning, primaryLanguage: primary, words: [] }); groups.get(key).words.push(cleanPayload(r)); });
    var current = groups.get(lesson.learningLanguage + '|' + lesson.primaryLanguage) || Array.from(groups.values())[0] || { primaryLanguage: lesson.primaryLanguage, learningLanguage: lesson.learningLanguage, words: [] };
    return Object.assign({ game: 'f16-afterburner', version: 2, exportedAt: new Date().toISOString() }, cleanPayload(current), { lessons: Array.from(groups.values()) });
  }
  function exportReview() {
    var payload = exportPayload(); if (!review.length) { toast('Fly through a word gate to start your basket.'); return payload; }
    try { var handler = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.golingoExport; if (handler) { handler.postMessage(payload); toast('Collection sent to GoLingo.'); return payload; } } catch (_) {}
    L.downloadJSON(payload, 'GoLingo-F16-Words.json'); toast('Exported ' + review.length + ' words' + (payload.lessons.length > 1 ? ' across ' + payload.lessons.length + ' language pairs.' : '.')); return payload;
  }
  function toggleVoice() { var s = speech.getState(); speech.unlock(); if (s.paused || s.blocked) speech.resume(); else speech.pause(); }
  function nextCamera() { settings.camera = (Number(settings.camera || 0) + 1) % 3; camReset = true; persistSettings(); toast(['Chase camera', 'Wide chase camera', 'Cockpit camera'][settings.camera], 1700); }
  function bindUI() {
    document.querySelectorAll('[data-mode]').forEach(function (b) { b.addEventListener('click', function () { setMode(b.dataset.mode); }); });
    $('launchBtn').addEventListener('click', startFlight); $('retryBtn').addEventListener('click', startFlight); $('restartBtn').addEventListener('click', startFlight); $('homeBtn').addEventListener('click', goHome); $('resultHomeBtn').addEventListener('click', goHome);
    $('homeLessonBtn').addEventListener('click', function () { openModal('lessonModal'); }); $('pauseLessonBtn').addEventListener('click', function () { openModal('lessonModal'); }); $('basketBtn').addEventListener('click', function () { openModal('basketModal'); }); $('pauseBasketBtn').addEventListener('click', function () { openModal('basketModal'); }); $('resultBasketBtn').addEventListener('click', function () { openModal('basketModal'); });
    $('menuBtn').addEventListener('click', function () { openModal('pauseModal'); }); $('helpBtn').addEventListener('click', function () { openModal('helpModal'); });
    document.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { if (state.phase === 'down') openModal('resultModal'); else closeModal(); }); });
    $('autoBtn').addEventListener('click', function () { setAuto(!state.autopilot); }); $('cameraBtn').addEventListener('click', nextCamera); $('voiceBtn').addEventListener('click', toggleVoice);
    $('wordsBtn').addEventListener('click', function () { settings.showWords = !settings.showWords; persistSettings(); updateWordStrip(); updateHUD(); });
    $('wordStrip').addEventListener('click', function () { if (currentWord) { speech.unlock(); speech.play(currentWord, { once: true }); } }); $('wordStrip').addEventListener('keydown', function (e) { if (e.key === 'Enter' && currentWord) { e.preventDefault(); speech.unlock(); speech.play(currentWord, { once: true }); } });
    $('throttle').addEventListener('input', function () { state.throttle = Number(this.value) / 100; });
    function hold(id, key, initial) { var el = $(id); el.addEventListener('pointerdown', function (e) { if (state.phase !== 'flight' || state.paused) return; e.preventDefault(); action[key] = true; el.setPointerCapture(e.pointerId); if (initial) initial(); }); function release() { action[key] = false; } el.addEventListener('pointerup', release); el.addEventListener('pointercancel', release); el.addEventListener('lostpointercapture', release); }
    hold('boostBtn', 'boost'); hold('fireBtn', 'fire', fireMissile); hold('gunBtn', 'gun', fireCannon); $('flareBtn').addEventListener('click', flare);
    var canvas = $('view'); canvas.addEventListener('pointerdown', function (e) { if (state.phase !== 'flight' || state.paused || e.button !== 0) return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); e.preventDefault(); });
    canvas.addEventListener('pointermove', function (e) { if (!drag || drag.id !== e.pointerId || state.paused) return; var scale = Math.min(innerWidth, innerHeight) * .2; steer.x = clamp((e.clientX - drag.x) / scale, -1, 1); steer.y = clamp((e.clientY - drag.y) / scale, -1, 1); });
    function endDrag(e) { if (drag && drag.id === e.pointerId) { drag = null; steer.x = steer.y = 0; } } canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag); canvas.addEventListener('lostpointercapture', endDrag);
    var stick = $('joystick'); function moveStick(e) { if (stickPointer !== e.pointerId) return; var r = stick.getBoundingClientRect(), x = (e.clientX - r.left - r.width / 2) / (r.width * .33), y = (e.clientY - r.top - r.height / 2) / (r.height * .33), length = Math.hypot(x, y); if (length > 1) { x /= length; y /= length; } steer.x = x; steer.y = y; $('stick').style.transform = 'translate(' + x * r.width * .33 + 'px,' + y * r.height * .33 + 'px)'; e.preventDefault(); }
    stick.addEventListener('pointerdown', function (e) { if (state.paused) return; stickPointer = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); }); stick.addEventListener('pointermove', moveStick);
    function releaseStick(e) { if (e.pointerId === stickPointer) { stickPointer = null; steer.x = steer.y = 0; $('stick').style.transform = ''; } } stick.addEventListener('pointerup', releaseStick); stick.addEventListener('pointercancel', releaseStick); stick.addEventListener('lostpointercapture', releaseStick);
    ['view', 'flightUI', 'joystick'].forEach(function (id) { $(id).addEventListener('contextmenu', function (e) { e.preventDefault(); }); });
    window.addEventListener('keydown', function (e) {
      var editable = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
      if (activeModal) { if (e.code === 'Escape' && activeModal !== 'resultModal') { e.preventDefault(); if (state.phase === 'down') openModal('resultModal'); else closeModal(); } if (e.code === 'Tab') { var focusable = Array.from($(activeModal).querySelectorAll('button:not([disabled]),input:not([hidden]),textarea,select,a[href]')).filter(function (n) { return n.offsetParent !== null; }); if (!focusable.length) return; var first = focusable[0], last = focusable[focusable.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } } return; }
      if (editable || state.phase !== 'flight') return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) e.preventDefault();
      if (!e.repeat && (e.code === 'KeyP' || e.code === 'Escape')) { openModal('pauseModal'); return; } if (!e.repeat && e.code === 'KeyM') { toggleVoice(); return; } if (!e.repeat && e.code === 'KeyV') { nextCamera(); return; } keys[e.code] = true;
    }); window.addEventListener('keyup', function (e) { delete keys[e.code]; });
    window.addEventListener('blur', function () { releaseInputs(); if (state.phase === 'flight' && !activeModal) openModal('pauseModal'); });
    document.addEventListener('visibilitychange', function () { releaseInputs(); if (document.hidden) { previewSpeech.setSuspended(true); speech.setSuspended(true); if (state.phase === 'flight' && !activeModal) openModal('pauseModal'); } });
    $('lessonInput').addEventListener('input', function () { updateEditorCount(true); }); $('learningLanguage').addEventListener('change', populateVoices);
    $('loadFileBtn').addEventListener('click', function () { $('lessonFile').click(); }); $('lessonFile').addEventListener('change', function () { var file = this.files && this.files[0]; if (!file) return; if (file.size > 1024 * 1024) { $('lessonError').hidden = false; $('lessonError').textContent = 'This file is too large. Use a lesson smaller than 1 MB.'; this.value = ''; return; } var reader = new FileReader(); reader.onload = function () { $('lessonInput').value = reader.result; updateEditorCount(true); }; reader.onerror = function () { $('lessonError').hidden = false; $('lessonError').textContent = 'This file could not be read. Paste its words instead.'; }; reader.readAsText(file); this.value = ''; });
    $('sampleBtn').addEventListener('click', function () { var p = L.defaultLesson(); $('learningLanguage').value = p.learningLanguage; $('primaryLanguage').value = p.primaryLanguage; $('lessonInput').value = p.words.map(function (w) { return [w.word, w.translation, w.sentence, w.sentenceTranslation].join(' | '); }).join('\n'); updateEditorCount(false); populateVoices(); });
    [['showWordsSetting', 'showWords'], ['showTranslationSetting', 'showTranslation'], ['sentenceSetting', 'examples'], ['soundSetting', 'sound']].forEach(function (pair) { $(pair[0]).addEventListener('change', function () { settings[pair[1]] = this.checked; persistSettings(); applySpeechSettings(); updateWordStrip(); if (pair[1] === 'sound' && this.checked) sound.unlock(); }); });
    $('speechRate').addEventListener('input', function () { settings.rate = Number(this.value); $('rateValue').textContent = settings.rate.toFixed(2) + '×'; persistSettings(); speech.setRate(settings.rate); });
    $('speechGap').addEventListener('input', function () { settings.gap = Number(this.value); $('gapValue').textContent = settings.gap.toFixed(1) + ' s'; persistSettings(); speech.setGap(settings.gap); });
    $('voiceSelect').addEventListener('change', function () { settings.voice = this.value; speech.setVoice(settings.voice); persistSettings(); }); $('qualitySelect').addEventListener('change', function () { settings.quality = this.value; persistSettings(); applyQuality(); });
    $('testVoiceBtn').addEventListener('click', testVoice); $('applyLessonBtn').addEventListener('click', function () { try { var p = editorPayload(); commitLesson(p, { source: 'editor' }); closeModal(); speech.unlock(); toast(p.words.length + ' words loaded. Your route is ready.'); } catch (e) { $('lessonError').hidden = false; $('lessonError').textContent = e.message; } });
    if (window.speechSynthesis && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', function () { if (activeModal === 'lessonModal') populateVoices(); });
    $('exportBtn').addEventListener('click', exportReview); $('csvBtn').addEventListener('click', function () { if (review.length) L.downloadCSV({ primaryLanguage: lesson.primaryLanguage, learningLanguage: lesson.learningLanguage, words: review }, 'GoLingo-F16-Words.csv'); });
    $('clearBasketBtn').addEventListener('click', function () { if (!review.length) return; if (!clearArmed) { clearArmed = true; this.textContent = 'Tap again to clear'; return; } review = []; saveStored('review', review); clearArmed = false; this.textContent = 'Clear basket'; $('basketCount').textContent = '0'; renderBasket(); });
  }
  function setupBridge() {
    var queued = window.__goLingoQueue || []; window.__goLingoQueue = [];
    window.GoLingoGame = {
      version: '2.0.0',
      importWords: function (payload, opts) { return commitLesson(payload, opts); },
      getLesson: function () { return cleanPayload(lesson); },
      getReview: function () { return cleanPayload(review); },
      exportWords: exportReview,
      getImportDiagnostics: function () { return cleanPayload(importDiagnostics); },
      getState: function () { var voice = speech.getState(); return { phase: state.phase, mode: state.mode, paused: state.paused, autopilot: state.autopilot, camera: ['chase', 'wide', 'cockpit'][settings.camera % 3], position: { x: state.pos.x, y: state.pos.y, z: state.pos.z }, yaw: state.yaw, pitch: state.pitch, roll: state.roll, speed: state.speed, throttle: state.throttle, lessonCount: lesson.words.length, collectedCount: practiced.size, basketCount: review.length, gates: state.gates, missed: state.missed, score: state.score, kills: state.kills, damage: state.damage, enemyCount: enemies.length, projectileCount: projectiles.length, ammo: { missiles: state.missiles, cannon: state.cannon, flares: state.flares }, elapsed: state.time, currentWord: currentWord ? cleanPayload(currentWord) : null, nextGate: route[0] ? { index: route[0].index, position: { x: route[0].center.x, y: route[0].center.y, z: route[0].center.z }, distance: route[0].center.distanceTo(state.pos) } : null, voice: { status: voice.status, paused: voice.paused, speaking: voice.speaking, suspended: voice.suspended, blocked: voice.blocked }, controls: { x: steer.x, y: steer.y, boost: action.boost }, render: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures } }; }
    };
    function allowedOrigin(origin) { if (origin === location.origin) return true; if (/^https:\/\/(www\.)?golingoapp\.com$/.test(origin) || origin === 'https://xcergolingo.github.io') return true; return Array.isArray(window.GoLingoAllowedOrigins) && window.GoLingoAllowedOrigins.indexOf(origin) >= 0; }
    window.addEventListener('message', function (event) {
      var data = event.data; if (!data || typeof data !== 'object' || ['golingo:importWords', 'golingo:loadLesson'].indexOf(data.type) < 0) return;
      var knownSource = event.source === window || event.source === window.parent || (window.opener && event.source === window.opener); if (!knownSource || !allowedOrigin(event.origin)) return;
      var result; try { result = commitLesson(data.payload || data.lesson || data.data, { append: !!data.append, source: 'postMessage' }); } catch (e) { result = { success: false, error: e.message }; }
      if (event.source) event.source.postMessage(Object.assign({ type: 'golingo:importResult', requestId: data.requestId || null }, result), event.origin === 'null' ? '*' : event.origin);
    });
    queued.forEach(function (args) { try { commitLesson(args[0], args[1]); } catch (e) { toast('Lesson import: ' + e.message, 5000); } });
    nativeEvent('ready', { capabilities: ['importWords', 'getLesson', 'getReview', 'exportWords', 'postMessage', 'recordedAudio', 'speechLoop'], wordCount: lesson.words.length });
    window.dispatchEvent(new CustomEvent('golingo:ready', { detail: { game: 'f16-afterburner', version: '2.0.0' } }));
  }

  function createCockpit() {
    var group = new T.Group(), dark = new T.MeshBasicMaterial({ color: 0x102028 }), rim = new T.MeshBasicMaterial({ color: 0x253a3f });
    var panel = new T.Mesh(new T.BoxGeometry(1.62, .4, .25), dark); panel.position.set(0, -.69, -1.02); panel.rotation.x = -.18; group.add(panel);
    var bow = new T.Mesh(new T.TorusGeometry(.84, .025, 5, 44, Math.PI), rim); bow.position.set(0, -.23, -.95); group.add(bow);
    var screenCanvas = document.createElement('canvas'); screenCanvas.width = 768; screenCanvas.height = 192; var tx = new T.CanvasTexture(screenCanvas); tx.colorSpace = T.SRGBColorSpace;
    var screen = new T.Mesh(new T.PlaneGeometry(1.34, .25), new T.MeshBasicMaterial({ map: tx })); screen.position.set(0, -.56, -.88); group.add(screen); group.visible = false;
    return { group: group, update: function () { var c = screenCanvas.getContext('2d'); c.fillStyle = '#071d20'; c.fillRect(0, 0, 768, 192); c.strokeStyle = '#4d9d88'; c.lineWidth = 3; for (var i = 0; i < 3; i++) c.strokeRect(i * 256 + 10, 10, 235, 172); c.fillStyle = '#94e6c5'; c.textAlign = 'center'; c.font = '24px monospace'; c.fillText('AIRSPEED', 128, 50); c.fillText(state.autopilot ? 'AUTOPILOT' : 'GHOST 01', 384, 50); c.fillText('ALTITUDE', 640, 50); c.font = '50px monospace'; c.fillText(String(Math.round(state.speed * 3.6)), 128, 119); c.fillText(String(state.gates).padStart(2, '0'), 384, 119); c.fillText(String(Math.round(state.pos.y)), 640, 119); c.font = '17px monospace'; c.fillText('KM / H', 128, 158); c.fillText('GATES PASSED', 384, 158); c.fillText('METERS', 640, 158); tx.needsUpdate = true; } };
  }
  function createSound() {
    var context, engine, filter, gain;
    function ensure() { if (context) { context.resume().catch(function () {}); return; } try { var C = window.AudioContext || window.webkitAudioContext; if (!C) return; context = new C(); var buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate), data = buffer.getChannelData(0), smooth = 0; for (var i = 0; i < data.length; i++) { smooth = (smooth + (Math.random() * 2 - 1) * .12) / 1.12; data[i] = smooth; } engine = context.createBufferSource(); engine.buffer = buffer; engine.loop = true; filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 280; gain = context.createGain(); gain.gain.value = 0; engine.connect(filter).connect(gain).connect(context.destination); engine.start(); context.resume().catch(function () {}); } catch (_) {} }
    function tone(hz, volume, duration, type) { if (!settings.sound || !context) return; var o = context.createOscillator(), g = context.createGain(); o.type = type || 'sine'; o.frequency.value = hz; g.gain.setValueAtTime(volume, context.currentTime); g.gain.exponentialRampToValueAtTime(.0001, context.currentTime + duration); o.connect(g).connect(context.destination); o.start(); o.stop(context.currentTime + duration); o.onended = function () { o.disconnect(); g.disconnect(); }; }
    return { unlock: ensure, update: function (speed, boost, talking, paused) { if (!context || !gain) return; gain.gain.setTargetAtTime(!settings.sound || paused ? 0 : (talking ? .022 : .085) * (boost ? 1.4 : 1), context.currentTime, .2); filter.frequency.setTargetAtTime(180 + speed * 1.7, context.currentTime, .2); }, chime: function () { tone(660, .05, .32); setTimeout(function () { tone(990, .045, .48); }, 100); }, shot: function () { tone(120, .025, .19, 'triangle'); }, boom: function () { tone(58, .055, .45, 'triangle'); } };
  }
  function frame(ts) {
    requestAnimationFrame(frame); var dt = lastTs ? Math.min(.05, (ts - lastTs) / 1000) : .016; lastTs = ts; if (document.hidden) return;
    if (state.phase === 'hangar') { simTime += dt; updateHangar(dt); world.update(dt, simTime, jet.position); }
    else if (state.phase === 'flight' && !state.paused) { simTime += dt; var steps = Math.max(1, Math.ceil(dt / .0167)); for (var i = 0; i < steps; i++) { if (state.phase !== 'flight') break; updateFlight(dt / steps); } world.update(dt, simTime, state.pos); hudTimer += dt; if (hudTimer > .08) { hudTimer = 0; updateHUD(); } }
    else sound.update(0, false, false, true);
    renderer.render(scene, camera);
  }
  applySpeechSettings(); applyQuality(); updateHomeLesson(); updateWordStrip(); bindUI(); setupBridge(); boot.hidden = true; requestAnimationFrame(frame);
  window.addEventListener('resize', resize);
  $('view').addEventListener('webglcontextlost', function (e) { e.preventDefault(); releaseInputs(); state.paused = true; speech.setSuspended(true); fatal('Graphics were interrupted. Reload this file to restart; your saved basket is kept.'); });
})();
