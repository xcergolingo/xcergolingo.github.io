(function () {
  'use strict';
  const E = window.FleetEngine;
  const L = window.FleetLearning;
  const N = window.NavalScene;
  const $ = (id) => document.getElementById(id);
  const STORAGE = 'golingo-word-fleet-v1';
  const SIZE = 10;
  const LENGTHS = [5, 4, 3, 3, 2];
  const TOTAL_HULL = 17;
  const readSaved = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem(STORAGE + ':' + key)); return value === null ? fallback : value; } catch (_) { return fallback; } };
  const save = (key, value) => { try { localStorage.setItem(STORAGE + ':' + key, JSON.stringify(value)); } catch (_) { if (key === 'wordbook') toast('Your wordbook is full on this device. Export it to keep a copy.'); } };
  const defaults = { audio: true, effects: true, repeat: true, translation: true, challenge: false, difficulty: 'relaxed', rate: 0.85, actionCamera: true, showWord: true, skin: 'navy', blueprint: false, mode: 'solo', rule: 'one-shot', designVersion: 2 };
  const savedSettings = readSaved('settings', {});
  const settings = Object.assign({}, defaults, savedSettings && typeof savedSettings === 'object' ? savedSettings : {});
  // The new design introduces learning on hits. Keep an explicit v2 preference thereafter.
  if (!savedSettings || savedSettings.designVersion !== 2) settings.challenge = false;
  settings.designVersion = 2;
  settings.rate = Math.max(0.5, Math.min(1.2, Number(settings.rate) || 0.85));
  if (!['navy', 'arctic', 'copper'].includes(settings.skin)) settings.skin = 'navy';
  if (!['one-shot', 'streak', 'salvo'].includes(settings.rule)) settings.rule = 'one-shot';
  if (!['solo', 'local'].includes(settings.mode)) settings.mode = 'solo';
  if (!['relaxed', 'standard'].includes(settings.difficulty)) settings.difficulty = 'relaxed';
  let pack;
  try { pack = L.normalizePayload(readSaved('pack', L.defaultPack('es'))); } catch (_) { pack = L.defaultPack('es'); }
  let wordbook = readSaved('wordbook', []);
  if (!Array.isArray(wordbook)) wordbook = [];
  wordbook = wordbook.filter((item) => item && typeof item.word === 'string' && typeof item.translation === 'string' && typeof item.learningLanguage === 'string' && typeof item.primaryLanguage === 'string').slice(-3000);
  const savedProfile = readSaved('profile', {});
  const profile = { xp: Math.max(0, Number(savedProfile && savedProfile.xp) || 0), missions: Math.max(0, Number(savedProfile && savedProfile.missions) || 0), wins: Math.max(0, Number(savedProfile && savedProfile.wins) || 0) };
  let game, scene, deck = [], cursor = 0, mission = 0, matchToken = 0;
  let practiced = new Set(), currentWord = null, currentTag = '', pendingShot = null, pendingSpeech = null;
  let paused = false, returnToPause = false, busy = false, privacyLocked = false, resetting = false, resultsShown = false;
  let viewer = 'player', deploymentSide = 'player', selectedShipId = 'ship-0', handoffAction = null;
  let aiTimer = 0, closeQuizTimer = 0, toastTimer = 0, announcementTimer = 0;
  let previousFirstWord = '', drag = null, suppressClickUntil = 0;
  const learningEmptyTitle = $('learning-empty').querySelector('h3').textContent;
  const learningEmptyCopy = $('learning-empty').querySelector('p').textContent;
  const icon = (name) => '<svg aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  const coordinate = (index) => String.fromCharCode(65 + Math.floor(index / SIZE)) + (index % SIZE + 1);
  const opposite = (side) => side === 'player' ? 'enemy' : 'player';
  const captain = (side) => side === 'player' ? 'Captain 1' : 'Captain 2';
  const wordKey = (item) => JSON.stringify([pack.primaryLanguage, pack.learningLanguage, item.word, item.translation]);
  const isDialogOpen = () => !!document.querySelector('dialog[open]');
  const voiceAllowed = () => !document.hidden && (!paused || (returnToPause && $('wordbook-dialog').open)) && !['settings-dialog', 'import-dialog', 'how-dialog', 'new-dialog', 'pause-dialog', 'handoff-dialog'].some((id) => $(id).open);
  const sound = window.FleetAudio.create({ getSettings: () => settings, canPlay: voiceAllowed, onStatus: (message) => { $('audio-status').textContent = message; } });

  function toast(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').classList.add('show');
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3300);
  }
  function saveSettings() { save('settings', settings); }
  function clearAI() { clearTimeout(aiTimer); aiTimer = 0; }
  function stopTimers() { clearAI(); clearTimeout(closeQuizTimer); clearTimeout(announcementTimer); closeQuizTimer = announcementTimer = 0; }
  function say(item, repeat) {
    if (!item) return;
    $('audio-status').textContent = '';
    sound.speak(item, { lang: item.learningLanguage || pack.learningLanguage, repeat: !!repeat });
  }
  function speakCurrent() { if (currentWord) say(currentWord, settings.repeat && currentWord.kind !== 'sentence'); }
  function deliverSpeech() {
    if (!pendingSpeech || pendingSpeech.token !== matchToken || busy || !voiceAllowed()) return;
    const speech = pendingSpeech; pendingSpeech = null;
    say(speech.item, speech.repeat);
  }
  function setMessage(message, hit) {
    const host = $('battle-message');
    host.classList.toggle('hit-message', !!hit);
    host.querySelector('span').textContent = message;
    host.querySelector('use').setAttribute('href', hit ? '#i-target' : '#i-anchor');
  }
  function announce(message) {
    clearTimeout(announcementTimer);
    $('action-announcement').textContent = message;
    $('action-announcement').classList.add('show');
    const token = matchToken;
    announcementTimer = setTimeout(() => { if (token === matchToken) $('action-announcement').classList.remove('show'); }, 2100);
  }
  function updateRank() {
    const ranks = [[0, 'Cadet'], [150, 'Ensign'], [500, 'Lieutenant'], [1200, 'Commander'], [2500, 'Captain'], [5000, 'Admiral']];
    $('rank-label').textContent = ranks.filter((rank) => profile.xp >= rank[0]).pop()[1];
    $('rank-xp').textContent = profile.xp.toLocaleString() + ' XP';
  }
  function awardXP(points) { profile.xp += points; save('profile', profile); updateRank(); }
  function selectedShip() { return game && game[deploymentSide].ships.find((ship) => ship.id === selectedShipId); }
  function isVertical(ship) { return ship.cells.length > 1 && Math.abs(ship.cells[1] - ship.cells[0]) === SIZE; }
  function canDeploy() { return !!game && game.phase === 'deployment' && !privacyLocked && !busy && !isDialogOpen(); }
  function canAttack() { return !!game && game.phase === 'battle' && game.status === 'playing' && !paused && !privacyLocked && !busy && !document.hidden && !isDialogOpen() && game.turn === viewer && (game.mode === 'local' || viewer === 'player'); }
  function syncScene() {
    if (!scene || !game) return;
    scene.setState({ phase: game.phase, selectedShip: selectedShipId, skin: settings.skin, blueprint: settings.blueprint, paused: paused || document.hidden || isDialogOpen(), turn: game.turn });
  }
  function openDialog(id) {
    sound.stop(); clearAI(); cancelDrag();
    const dialog = $(id);
    if (!dialog.open) dialog.showModal();
    updateTurn(); syncScene();
  }
  function closeDialog(id) { if ($(id).open) $(id).close(); }
  function closeAllDialogs() { document.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close()); }
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => closeDialog(button.dataset.close)));
  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('close', () => {
      if (resetting || dialog.open) return;
      if (dialog.id === 'quiz-dialog' && pendingShot) { pendingShot = null; sound.stop(); clearTimeout(closeQuizTimer); closeQuizTimer = 0; }
      if (dialog.id === 'pause-dialog' && !returnToPause) paused = false;
      if (dialog.id === 'wordbook-dialog') {
        sound.stop();
        if (returnToPause) { returnToPause = false; paused = true; openDialog('pause-dialog'); return; }
      }
      if (dialog.id === 'handoff-dialog' && privacyLocked) { dialog.showModal(); return; }
      updateTurn(); syncScene(); routeTurn();
    });
  });
  $('handoff-dialog').addEventListener('cancel', (event) => event.preventDefault());

  function makeGrid(id, enemy) {
    const grid = $(id); grid.replaceChildren();
    for (let index = 0; index < SIZE * SIZE; index++) {
      const cell = document.createElement('button');
      cell.type = 'button'; cell.className = 'sea-cell'; cell.dataset.index = String(index);
      cell.setAttribute('aria-label', coordinate(index) + ', uncharted');
      cell.addEventListener('click', () => enemy ? selectTarget(index) : selectPlacement(index));
      grid.appendChild(cell);
    }
  }
  document.querySelectorAll('.column-labels').forEach((host) => {
    host.replaceChildren(); for (let i = 1; i <= SIZE; i++) { const label = document.createElement('span'); label.textContent = i; host.appendChild(label); }
  });
  document.querySelectorAll('.row-labels').forEach((host) => {
    host.replaceChildren(); for (let i = 0; i < SIZE; i++) { const label = document.createElement('span'); label.textContent = String.fromCharCode(65 + i); host.appendChild(label); }
  });
  function shipArt(ship, hidden) {
    return N.shipSVG(ship.name, ship.length, { skin: settings.skin, damaged: hidden ? 0 : ship.hits.length / ship.length, sunk: ship.sunk, orientation: 'horizontal' });
  }
  function shipDrawing(ship) {
    const start = Math.min(...ship.cells), row = Math.floor(start / SIZE), col = start % SIZE;
    const transform = isVertical(ship) ? 'translate(' + ((col + 1) * 100) + ' ' + (row * 100) + ') rotate(90)' : 'translate(' + (col * 100) + ' ' + (row * 100) + ')';
    const svg = shipArt(ship, false).replace('<svg ', '<svg width="' + (ship.length * 100) + '" height="100" style="width:' + (ship.length * 100) + 'px;height:100px" ');
    return '<g' + (ship.sunk ? ' class="ship-sunk"' : '') + ' transform="' + transform + '">' + svg + '</g>';
  }
  function renderShips() {
    if (privacyLocked) { $('player-ships').replaceChildren(); $('enemy-ships').replaceChildren(); return; }
    $('player-ships').innerHTML = game[viewer].ships.map(shipDrawing).join('');
    // Unhit and partially hit opposing ships never expose their positions or identities in the DOM.
    $('enemy-ships').innerHTML = game[opposite(viewer)].ships.filter((ship) => ship.sunk || game.status === 'finished').map(shipDrawing).join('');
  }
  function renderRosters() {
    [['player-fleet-list', viewer, false], ['enemy-fleet-list', opposite(viewer), true]].forEach(([id, side, enemy]) => {
      const host = $(id); host.replaceChildren();
      game[side].ships.forEach((ship) => {
        const row = document.createElement(enemy ? 'div' : 'button');
        row.className = 'ship-token'; row.dataset.ship = ship.id;
        if (!enemy) { row.type = 'button'; row.disabled = privacyLocked; row.addEventListener('click', () => selectShip(ship.id)); }
        const damage = privacyLocked ? 0 : ship.hits.length;
        const status = privacyLocked ? 'hidden' : ship.sunk ? 'sunk' : damage ? damage + ' of ' + ship.length + ' squares hit' : 'unhit · size ' + ship.length;
        row.title = ship.name + ' · ' + ship.length + ' squares · ' + status;
        row.setAttribute('aria-label', row.title);
        if (!enemy) row.setAttribute('aria-pressed', String(game.phase === 'deployment' && selectedShipId === ship.id && !privacyLocked));
        row.classList.toggle('selected', !enemy && game.phase === 'deployment' && selectedShipId === ship.id && !privacyLocked);
        row.classList.toggle('is-sunk', ship.sunk);
        // Fleet composition and damage are visible; only exact enemy coordinates stay concealed.
        row.innerHTML = shipArt(ship, privacyLocked);
        const pips = document.createElement('span'); pips.className = 'ship-pips'; pips.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < ship.length; i++) { const pip = document.createElement('i'); pip.classList.toggle('damaged', i < damage); pips.appendChild(pip); }
        row.appendChild(pips); host.appendChild(row);
      });
    });
  }
  function renderStatusHUD() {
    const ownBoard = game[viewer], enemyBoard = game[opposite(viewer)];
    const summarize = (board, own) => {
      const hitShips = board.ships.filter((ship) => ship.hits.length > 0).length;
      const sunkShips = board.ships.filter((ship) => ship.sunk).length;
      const hullHits = board.ships.reduce((sum, ship) => sum + ship.hits.length, 0);
      if (privacyLocked) return 'Fleet hidden during handoff';
      if (!hullHits) return own ? 'All 5 ships intact · 0 / 17 hits' : '0 of 5 ships hit · 0 sunk · 0 / 17 hull';
      return hitShips + ' of ' + board.ships.length + ' ships hit · ' + sunkShips + ' sunk · ' + hullHits + ' / ' + TOTAL_HULL + ' hull';
    };
    $('own-damage-summary').textContent = summarize(ownBoard, true);
    $('enemy-damage-summary').textContent = summarize(enemyBoard, false);
    [['own-status-list', ownBoard], ['enemy-status-list', enemyBoard]].forEach(([id, board]) => {
      const host = $(id); host.replaceChildren();
      board.ships.forEach((ship) => {
        const damage = privacyLocked ? 0 : ship.hits.length;
        const state = privacyLocked ? 'HIDDEN' : ship.sunk ? 'SUNK' : damage ? 'HIT ' + damage + '/' + ship.length : 'UNHIT';
        const chip = document.createElement('div');
        chip.className = 'fleet-status-chip ' + (ship.sunk ? 'sunk' : damage ? 'hit' : 'unhit');
        chip.setAttribute('aria-label', ship.name + ', size ' + ship.length + ', ' + state.toLowerCase());
        const top = document.createElement('div'); top.className = 'fleet-status-chip-top';
        const name = document.createElement('strong'); name.textContent = privacyLocked ? 'Fleet hidden' : ship.name;
        const size = document.createElement('span'); size.textContent = privacyLocked ? '' : 'SIZE ' + ship.length;
        top.append(name, size);
        const pips = document.createElement('div'); pips.className = 'fleet-status-pips'; pips.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < ship.length; i++) { const pip = document.createElement('i'); pip.classList.toggle('hit', i < damage); pips.appendChild(pip); }
        const label = document.createElement('span'); label.className = 'fleet-status-state'; label.textContent = state;
        chip.append(top, pips, label); host.appendChild(chip);
      });
    });
  }
  function updateTurn() {
    if (!game) return;
    const deployment = game.phase === 'deployment', attacking = canAttack();
    let label;
    if (privacyLocked) label = 'Private orders';
    else if (game.status === 'finished') label = 'Battle complete';
    else if (deployment) label = game.mode === 'local' ? captain(deploymentSide) + ' · deploy' : 'Deployment';
    else if (paused) label = 'At anchor';
    else if (busy) label = 'Shot in flight';
    else if (game.mode === 'local') label = captain(game.turn) + '’s turn';
    else label = game.turn === 'enemy' ? 'Enemy turn' : 'Your move';
    if (!deployment && game.status === 'playing' && game.rule === 'salvo' && !privacyLocked) label += ' · ' + game.shotsRemaining + ' left';
    const turn = $('turn-pill'); turn.replaceChildren(document.createElement('i'), document.createTextNode(label));
    turn.classList.toggle('enemy-turn', game.turn === 'enemy' && !deployment && !privacyLocked && game.status === 'playing');
    turn.classList.toggle('busy', busy || paused || privacyLocked);
    $('enemy-grid').querySelectorAll('.sea-cell').forEach((cell, index) => { cell.disabled = !attacking || game[opposite(viewer)].shots[index] !== null; });
    $('player-grid').querySelectorAll('.sea-cell').forEach((cell) => { cell.disabled = !canDeploy(); });
    $('pause-button').disabled = deployment || game.status !== 'playing';
    $('shuffle-fleet').disabled = !canDeploy(); $('rotate-fleet').disabled = !canDeploy() || !selectedShip(); $('start-battle').disabled = !canDeploy();
    $('deployment-actions').hidden = !deployment; $('battle-actions').hidden = deployment;
    $('deployment-cover').hidden = !deployment && !privacyLocked;
    document.body.classList.toggle('deployment', deployment);
    document.body.classList.toggle('battle-phase', !deployment);
    document.body.classList.toggle('blueprint', !!settings.blueprint);
    $('phase-title').textContent = game.status === 'finished' ? 'Mission complete' : deployment ? (game.mode === 'local' ? captain(deploymentSide) + ' · deploy your fleet' : 'Deploy your fleet') : game.mode === 'local' ? 'Two captains. One ocean.' : 'Find the enemy fleet';
    $('rule-label').textContent = { 'one-shot': 'ONE SHOT', streak: 'HITTING STREAK', salvo: '3-SHOT SALVO' }[game.rule];
    if (privacyLocked) $('board-instruction').textContent = 'Pass the device. The next fleet stays hidden until Ready.';
    else if (deployment) $('board-instruction').textContent = 'Select a ship, then tap its starting square. Drag to move. R to rotate.';
    else if (busy) $('board-instruction').textContent = 'Watching the impact. Stand by, Captain.';
    else if (game.status === 'finished') $('board-instruction').textContent = 'Your discoveries are saved. Review them in your wordbook.';
    else if (game.mode === 'solo' && game.turn === 'enemy') $('board-instruction').textContent = 'The computer is choosing its next coordinate.';
    else if (settings.challenge) $('board-instruction').textContent = 'Choose a coordinate, decode its word, then fire.';
    else $('board-instruction').textContent = game.rule === 'streak' ? 'Tap enemy waters. Every hit earns another shot and a new word.' : game.rule === 'salvo' ? 'Fire three shots this turn. Every hit reveals a word.' : 'Tap enemy waters to fire. Every hit reveals a word.';
    const start = $('start-battle');
    start.innerHTML = (game.mode === 'local' && deploymentSide === 'player' ? 'Fleet ready' : 'Battle stations') + icon('chevron');
  }
  function render() {
    if (!game) return;
    [['player-grid', viewer, true], ['enemy-grid', opposite(viewer), false]].forEach(([id, side, own]) => {
      const board = game[side];
      $(id).childNodes.forEach((cell, index) => {
        const shot = privacyLocked ? null : board.shots[index];
        const ship = own && !privacyLocked ? E.getShip(board, index) : null;
        cell.className = 'sea-cell' + (shot ? ' ' + shot : '');
        if (ship) cell.classList.add('friendly-occupied');
        if (ship && game.phase === 'deployment' && ship.id === selectedShipId) cell.classList.add('selected');
        cell.setAttribute('aria-label', coordinate(index) + ', ' + (privacyLocked ? 'fleet hidden' : shot || (ship ? ship.name : 'uncharted')));
      });
    });
    renderShips(); renderRosters(); renderStatusHUD();
    const ownBoard = game[viewer], enemyBoard = game[opposite(viewer)];
    $('own-captain').textContent = game.mode === 'local' ? captain(viewer).toUpperCase() + ' / YOUR FLEET' : 'CAPTAIN 01 / YOU';
    $('enemy-captain').textContent = game.mode === 'local' ? 'OPPONENT / ' + captain(opposite(viewer)).toUpperCase() : 'OPPONENT / COMPUTER';
    $('own-title').textContent = game.phase === 'deployment' ? 'Your formation' : 'Your fleet';
    $('enemy-title').textContent = game.mode === 'local' ? captain(opposite(viewer)) + '’s waters' : 'Enemy waters';
    $('player-afloat').textContent = E.remaining(ownBoard);
    $('fleet-stat').textContent = E.remaining(enemyBoard);
    $('mobile-own-count').textContent = E.remaining(ownBoard); $('mobile-enemy-count').textContent = E.remaining(enemyBoard);
    const hits = viewer === 'player' ? game.stats.playerHits : game.stats.enemyHits;
    const damage = viewer === 'player' ? game.stats.enemyHits : game.stats.playerHits;
    $('hit-stat').textContent = hits;
    $('word-stat').textContent = practiced.size;
    $('hull-percent').textContent = Math.round((TOTAL_HULL - damage) / TOTAL_HULL * 100) + '%';
    $('sunk-count').textContent = (LENGTHS.length - E.remaining(enemyBoard)) + ' / ' + LENGTHS.length + ' SUNK';
    $('fleet-caption').textContent = privacyLocked ? 'FLEETS CONCEALED FOR HANDOFF' : game.phase === 'deployment' ? 'YOUR SHIPS ARE READY TO DEPLOY' : 'HOLD YOUR COURSE, CAPTAIN';
    $('mission-id').textContent = 'MISSION ' + String(mission).padStart(2, '0') + ' / NORTH ATLANTIC';
    $('tactical-area').setAttribute('aria-hidden', String(privacyLocked));
    updateTurn(); syncScene();
  }
  function setMobileBoard(value) {
    $('tactical-area').dataset.mobileBoard = value;
    $('own-board-tab').classList.toggle('active', value === 'own'); $('enemy-board-tab').classList.toggle('active', value === 'enemy');
    $('own-board-tab').setAttribute('aria-selected', String(value === 'own')); $('enemy-board-tab').setAttribute('aria-selected', String(value === 'enemy'));
    if (scene) scene.resize();
  }
  function animateShot(side, index) {
    const id = side === viewer ? 'player-grid' : 'enemy-grid';
    const cell = $(id).children[index];
    if (cell) { cell.classList.remove('just-fired'); void cell.offsetWidth; cell.classList.add('just-fired'); }
  }
  function describeSelection() {
    const ship = selectedShip(); if (!ship) return;
    $('scene-ship-name').textContent = ship.name;
    $('scene-caption').textContent = ship.length + ' squares · ' + (isVertical(ship) ? 'vertical' : 'horizontal') + '. Tap a clear starting square or drag to reposition.';
  }
  function selectShip(id) {
    if (!game || privacyLocked || busy || isDialogOpen()) return;
    const ship = game[viewer].ships.find((entry) => entry.id === id); if (!ship) return;
    selectedShipId = id;
    if (game.phase === 'deployment') describeSelection();
    else { $('scene-ship-name').textContent = ship.name; $('scene-caption').textContent = ship.sunk ? 'Lost at sea. Your remaining ships sail on.' : (ship.length - ship.hits.length) + ' of ' + ship.length + ' hull squares intact.'; }
    scene.focusShip(ship.name); render();
  }
  const placementReason = (reason) => ({ 'out-of-bounds': 'Keep every square of the ship inside the grid.', overlap: 'That position overlaps another ship.', 'ships-touch': 'Leave one clear square between ships, including diagonally.', 'battle-started': 'Ships hold their positions after the battle starts.' }[reason] || 'That ship cannot be placed there. Try another square.');
  function selectPlacement(index) {
    if (performance.now() < suppressClickUntil || !canDeploy()) return;
    sound.unlock();
    const occupied = E.getShip(game[deploymentSide], index);
    if (occupied) { selectShip(occupied.id); return; }
    const ship = selectedShip(); if (!ship) return;
    const result = E.moveShip(game, deploymentSide, ship.id, index, isVertical(ship));
    if (!result.ok) { toast(placementReason(result.reason)); return; }
    render(); describeSelection(); setMessage(ship.name + ' repositioned at ' + coordinate(index) + '.');
  }
  function rotateSelected() {
    if (!canDeploy()) return;
    const ship = selectedShip(); if (!ship) return;
    const result = E.rotateShip(game, deploymentSide, ship.id);
    if (!result.ok) { toast(placementReason(result.reason)); return; }
    sound.unlock(); render(); describeSelection(); setMessage(ship.name + ' rotated.');
  }
  function cancelDrag() {
    if (!drag) return;
    const active = drag; drag = null;
    try { if ($('player-grid').hasPointerCapture(active.pointerId)) $('player-grid').releasePointerCapture(active.pointerId); } catch (_) {}
    $('player-grid').querySelectorAll('.ghost-valid,.ghost-invalid').forEach((cell) => cell.classList.remove('ghost-valid', 'ghost-invalid'));
  }
  $('player-grid').addEventListener('pointerdown', (event) => {
    if (!canDeploy() || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const cell = event.target.closest('.sea-cell'); if (!cell) return;
    const index = Number(cell.dataset.index), ship = E.getShip(game[deploymentSide], index); if (!ship) return;
    selectShip(ship.id);
    const start = Math.min(...ship.cells);
    drag = { pointerId: event.pointerId, shipId: ship.id, startX: event.clientX, startY: event.clientY, vertical: isVertical(ship), rowOffset: Math.floor(index / SIZE) - Math.floor(start / SIZE), colOffset: index % SIZE - start % SIZE, active: false, candidate: null };
    $('player-grid').setPointerCapture(event.pointerId);
  });
  $('player-grid').addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
    drag.active = true; event.preventDefault();
    const grid = $('player-grid'), rect = grid.getBoundingClientRect();
    const row = Math.floor((event.clientY - rect.top) / rect.height * SIZE) - drag.rowOffset;
    const col = Math.floor((event.clientX - rect.left) / rect.width * SIZE) - drag.colOffset;
    drag.candidate = row >= 0 && row < SIZE && col >= 0 && col < SIZE ? row * SIZE + col : null;
    grid.querySelectorAll('.ghost-valid,.ghost-invalid').forEach((cell) => cell.classList.remove('ghost-valid', 'ghost-invalid'));
    if (drag.candidate === null) return;
    const result = E.canPlace(game, deploymentSide, drag.shipId, drag.candidate, drag.vertical);
    const ship = selectedShip();
    for (let offset = 0; offset < ship.length; offset++) {
      const r = row + (drag.vertical ? offset : 0), c = col + (drag.vertical ? 0 : offset);
      if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) grid.children[r * SIZE + c].classList.add(result.ok ? 'ghost-valid' : 'ghost-invalid');
    }
  });
  $('player-grid').addEventListener('pointerup', (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const action = drag; cancelDrag();
    if (!action.active) return;
    suppressClickUntil = performance.now() + 400; event.preventDefault();
    const result = action.candidate === null ? { ok: false, reason: 'out-of-bounds' } : E.moveShip(game, deploymentSide, action.shipId, action.candidate, action.vertical);
    if (!result.ok) toast(placementReason(result.reason));
    else setMessage(selectedShip().name + ' repositioned at ' + coordinate(action.candidate) + '.');
    render(); describeSelection();
  });
  $('player-grid').addEventListener('pointercancel', cancelDrag);
  $('player-grid').addEventListener('lostpointercapture', () => { if (drag) cancelDrag(); });

  function requestHandoff(side, stage) {
    if (!game || game.mode !== 'local' || privacyLocked) return;
    handoffAction = { side, stage, token: matchToken };
    privacyLocked = true; cancelDrag(); render();
    $('handoff-title').textContent = 'Over to ' + captain(side) + '.';
    $('handoff-copy').textContent = stage === 'deploy' ? 'Pass the device to ' + captain(side) + '. Tap Ready in private to arrange your five ships.' : stage === 'start' ? 'Both fleets are deployed. Pass to Captain 1 to fire the first shot. The fleet stays hidden until Ready.' : 'Pass the device to ' + captain(side) + '. Your fleet and firing chart stay hidden until you are ready.';
    openDialog('handoff-dialog');
  }
  $('handoff-ready').addEventListener('click', () => {
    const action = handoffAction;
    if (!action || action.token !== matchToken) return;
    handoffAction = null; privacyLocked = false; viewer = action.side; sound.stop();
    if (action.stage === 'deploy') { deploymentSide = action.side; selectedShipId = 'ship-0'; }
    if (action.stage === 'start') E.beginBattle(game);
    closeDialog('handoff-dialog');
    setMobileBoard(game.phase === 'deployment' ? 'own' : 'enemy');
    render();
    if (game.phase === 'deployment') { describeSelection(); setMessage(captain(viewer) + ', arrange your fleet in private.'); }
    else { $('scene-ship-name').textContent = 'Battle stations'; $('scene-caption').textContent = captain(viewer) + ', choose your next coordinate.'; setMessage(captain(viewer) + ', the sea is yours.'); }
    sound.unlock(); syncScene();
  });
  function startBattle() {
    if (!canDeploy()) return;
    sound.unlock();
    if (game.mode === 'local') { requestHandoff(deploymentSide === 'player' ? 'enemy' : 'player', deploymentSide === 'player' ? 'deploy' : 'start'); return; }
    const result = E.beginBattle(game); if (!result.ok) return;
    $('scene-ship-name').textContent = 'Battle stations';
    $('scene-caption').textContent = 'Find five hidden ships. Every hit brings a new word.';
    setMessage('Your fleet is deployed. Pick a coordinate in enemy waters.');
    setMobileBoard('enemy'); render(); sound.effect('sonar');
  }
  function newBattle(options) {
    options = options || {};
    ++matchToken; resetting = true; stopTimers(); sound.stop(); cancelDrag();
    paused = false; returnToPause = false; pendingShot = null; pendingSpeech = null; busy = false; privacyLocked = false; handoffAction = null; resultsShown = false;
    closeAllDialogs();
    const mode = ['solo', 'local'].includes(options.mode) ? options.mode : settings.mode;
    const rule = ['one-shot', 'streak', 'salvo'].includes(options.rule) ? options.rule : settings.rule;
    settings.mode = mode; settings.rule = rule; saveSettings();
    mission++;
    game = E.createGame({ size: SIZE, lengths: LENGTHS, difficulty: settings.difficulty, mode, rule, deployment: true });
    viewer = 'player'; deploymentSide = 'player'; selectedShipId = 'ship-0';
    deck = L.makeDeck(pack);
    if (deck.length > 1 && deck[0].word === previousFirstWord) [deck[0], deck[1]] = [deck[1], deck[0]];
    previousFirstWord = deck[0].word;
    cursor = 0; practiced = new Set(); currentWord = null; currentTag = '';
    $('learning-empty').hidden = false; $('learning-active').hidden = true;
    $('learning-empty').querySelector('h3').textContent = learningEmptyTitle; $('learning-empty').querySelector('p').textContent = learningEmptyCopy;
    $('audio-status').textContent = ''; $('action-announcement').classList.remove('show');
    makeGrid('player-grid', false); makeGrid('enemy-grid', true);
    if (scene) scene.destroy();
    scene = N.create($('fleet-scene'));
    resetting = false;
    setMobileBoard('own'); render(); updateCourse(); updateWordbookCount(); updateRank();
    $('scene-ship-name').textContent = 'Atlantic fleet'; $('scene-caption').textContent = 'Five ships. Seventeen squares. A sea of new words.';
    setMessage(mode === 'local' ? 'Captain 1, arrange your fleet. Captain 2, look away until the handoff.' : 'Arrange your five ships, then report to battle stations.');
    if (mode === 'local') requestHandoff('player', 'deploy');
  }
  function nextWord() {
    if (cursor >= deck.length) {
      const previous = deck[deck.length - 1]; deck = L.makeDeck(pack); cursor = 0;
      if (deck.length > 1 && deck[0].word === previous.word) [deck[0], deck[1]] = [deck[1], deck[0]];
    }
    return deck[cursor];
  }
  function addPracticed(item) {
    practiced.add(wordKey(item));
    let found = wordbook.find((entry) => entry.primaryLanguage === pack.primaryLanguage && entry.learningLanguage === pack.learningLanguage && entry.word === item.word && entry.translation === item.translation);
    if (found) { Object.assign(found, item); found.practiced = (Number(found.practiced) || 0) + 1; found.lastSeen = Date.now(); }
    else wordbook.push(Object.assign({}, item, { primaryLanguage: pack.primaryLanguage, learningLanguage: pack.learningLanguage, practiced: 1, lastSeen: Date.now() }));
    if (wordbook.length > 3000) wordbook = wordbook.slice(-3000);
    save('wordbook', wordbook); updateWordbookCount();
  }
  function showWord(item, tag) {
    currentWord = item; currentTag = tag || (item.kind === 'sentence' ? 'SENTENCE PRACTICED' : 'WORD PRACTICED');
    $('learning-empty').hidden = !!settings.showWord; $('learning-active').hidden = !settings.showWord;
    if (!settings.showWord) {
      $('learning-empty').querySelector('h3').textContent = 'Listen, remember, and keep sailing.';
      $('learning-empty').querySelector('p').textContent = 'Word cards are hidden. Your discoveries are saved in the wordbook.';
    }
    $('discovery-tag').textContent = currentTag;
    $('current-word').textContent = item.word; $('current-word').lang = pack.learningLanguage;
    $('current-romanization').textContent = item.romanization || '';
    $('current-translation').textContent = item.translation; $('current-translation').lang = pack.primaryLanguage; $('current-translation').hidden = !settings.translation;
    const hasSentence = !!item.sentence && item.sentence !== item.word;
    $('current-sentence').textContent = hasSentence ? item.sentence : ''; $('current-sentence').lang = pack.learningLanguage;
    $('current-sentence-translation').textContent = hasSentence ? item.sentenceTranslation || '' : ''; $('current-sentence-translation').lang = pack.primaryLanguage;
    $('current-sentence-translation').hidden = !settings.translation || !hasSentence;
    $('replay-sentence').hidden = !hasSentence && item.kind !== 'sentence';
  }
  function selectTarget(index) {
    if (!canAttack() || game[opposite(viewer)].shots[index] !== null) return;
    sound.unlock();
    if (!settings.challenge) { void commitShot(index, null); return; }
    const item = nextWord(), question = L.makeQuestion(item, pack.words);
    pendingShot = { index, item, question, token: matchToken, attacker: viewer, accepted: false };
    $('quiz-coordinate').textContent = 'TARGET LOCKED · ' + coordinate(index);
    $('quiz-title').textContent = item.kind === 'sentence' ? 'What does this sentence mean?' : 'What does this word mean?';
    $('quiz-word').textContent = question.prompt; $('quiz-word').lang = pack.learningLanguage;
    $('quiz-romanization').textContent = item.romanization || '';
    $('quiz-hint').textContent = question.choices.length === 1 ? 'Learn the meaning below, then tap to fire.' : 'Choose the matching translation to fire.';
    $('quiz-feedback').textContent = ''; $('quiz-feedback').classList.remove('wrong');
    $('quiz-learn').hidden = question.choices.length === 1; $('quiz-learn').disabled = false;
    $('quiz-choices').replaceChildren(); $('quiz-choices').classList.toggle('single-choice', question.choices.length === 1);
    question.choices.forEach((choice, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'quiz-choice';
      const number = document.createElement('span'); number.className = 'choice-number'; number.textContent = index + 1;
      const label = document.createElement('span'); label.textContent = choice.text; label.lang = pack.primaryLanguage;
      button.append(number, label); button.addEventListener('click', () => answerQuestion(button, choice)); $('quiz-choices').appendChild(button);
    });
    openDialog('quiz-dialog'); say(item, settings.repeat && item.kind !== 'sentence');
  }
  function answerQuestion(button, choice) {
    if (!pendingShot || pendingShot.accepted || pendingShot.token !== matchToken) return;
    if (!choice.correct) {
      button.classList.add('incorrect'); button.disabled = true; $('quiz-feedback').classList.add('wrong');
      $('quiz-feedback').textContent = 'Not quite. ' + pendingShot.item.word + ' means “' + pendingShot.question.answer + '”. Try that meaning.'; return;
    }
    pendingShot.accepted = true; button.classList.add('correct');
    $('quiz-choices').querySelectorAll('button').forEach((option) => { option.disabled = true; }); $('quiz-learn').disabled = true;
    $('quiz-feedback').classList.remove('wrong'); $('quiz-feedback').textContent = 'That’s it. Firing at ' + coordinate(pendingShot.index) + '!';
    const accepted = pendingShot, token = matchToken;
    closeQuizTimer = setTimeout(() => {
      closeQuizTimer = 0;
      if (token !== matchToken || pendingShot !== accepted || !$('quiz-dialog').open) return;
      pendingShot = null; closeDialog('quiz-dialog');
      void commitShot(accepted.index, accepted.item);
    }, 430);
  }
  async function commitShot(index, quizItem) {
    if (!canAttack()) return;
    busy = true;
    const result = E.fire(game, viewer, index);
    if (!result.ok) { busy = false; updateTurn(); return; }
    await resolveAttack(result, false, quizItem);
  }
  function learningForShot(result, quizItem) {
    if (!result.hit && !quizItem) return;
    const item = quizItem || nextWord(); cursor++; addPracticed(item);
    let spoken = item;
    let tag = result.hit ? 'DIRECT HIT · WORD DISCOVERED' : 'WORD PRACTICED';
    if (result.sunk) {
      const phrase = L.shipPhrase({ words: deck }, Number(result.shipId.split('-')[1]));
      if (phrase) {
        spoken = { id: 'sentence-' + phrase.sourceId, word: phrase.sentence, translation: phrase.sentenceTranslation, kind: 'sentence', audioURL: phrase.audioURL };
        if (spoken.word !== item.word || spoken.translation !== item.translation) addPracticed(spoken);
        tag = 'SHIP SUNK · SENTENCE UNLOCKED';
      } else tag = 'SHIP SUNK · WORD DISCOVERED';
    }
    sound.stop(); showWord(spoken, tag);
    pendingSpeech = { item: spoken, repeat: !result.sunk && settings.repeat && spoken.kind !== 'sentence', token: matchToken };
    awardXP((result.hit ? 10 : 0) + (result.sunk ? 25 : 0) + (quizItem ? 5 : 0));
  }
  async function resolveAttack(result, computer, quizItem) {
    const token = matchToken;
    busy = true;
    if (!computer) learningForShot(result, quizItem);
    render(); animateShot(result.defender, result.index);
    const actor = game.mode === 'local' ? captain(result.attacker) : computer ? 'Enemy' : 'You';
    const defenderBoard = game[result.defender];
    const defenderShip = result.shipId ? defenderBoard.ships.find((ship) => ship.id === result.shipId) : null;
    const damagedShips = defenderBoard.ships.filter((ship) => ship.hits.length > 0).length;
    const sunkShips = defenderBoard.ships.filter((ship) => ship.sunk).length;
    let message = coordinate(result.index) + ' · ';
    if (result.sunk) {
      message += actor + ' sank ' + (computer ? 'your ' : 'the enemy ') + result.shipName.toLowerCase() + '! ';
      message += damagedShips + ' of ' + defenderBoard.ships.length + ' ships hit · ' + sunkShips + ' sunk.';
    } else if (result.hit) {
      message += computer
        ? 'Enemy hit your ' + result.shipName.toLowerCase() + ' · ' + defenderShip.hits.length + '/' + defenderShip.length + ' hull. ' + damagedShips + ' of your ' + defenderBoard.ships.length + ' ships have been hit.'
        : 'Direct hit on enemy ' + result.shipName.toLowerCase() + ' · ' + defenderShip.hits.length + '/' + defenderShip.length + ' hull.';
    } else message += computer ? 'Enemy fire missed your fleet.' : 'Open water. Keep searching, Captain.';
    if (!computer && result.sunk && currentWord && currentWord.kind === 'sentence') message += ' A sentence is unlocked.';
    setMessage(message, !computer && result.hit);
    announce(result.sunk ? result.shipName.toUpperCase() + ' SUNK' : result.hit ? (computer ? 'YOUR ' + result.shipName.toUpperCase() + ' HIT' : result.shipName.toUpperCase() + ' HIT') : 'OPEN WATER');
    if (result.sunk) { $('scene-ship-name').textContent = result.shipName + ' sunk'; $('scene-caption').textContent = computer ? E.remaining(defenderBoard) + ' of your ships remain afloat.' : E.remaining(defenderBoard) + ' enemy ships remain afloat.'; }
    else if (result.hit) { $('scene-ship-name').textContent = result.shipName + ' hit'; $('scene-caption').textContent = defenderShip.hits.length + ' of ' + defenderShip.length + ' hull sections hit. ' + (computer ? damagedShips + ' of your ships have taken fire.' : 'Keep pressure on this ship.'); }
    else { $('scene-ship-name').textContent = 'Open water'; $('scene-caption').textContent = 'A splash, a bearing, and another chance.'; }
    sound.effect(result.sunk ? 'sunk' : result.hit ? 'hit' : 'miss');
    // Ship class is now part of the tactical status display; exact enemy coordinates remain concealed.
    await scene.attack({ hit: result.hit, sunk: result.sunk, shipName: result.shipName || 'Battleship', index: result.index, side: result.defender, actionCamera: settings.actionCamera });
    if (token !== matchToken) return;
    busy = false; render(); routeTurn();
  }
  function routeTurn() {
    if (!game || resetting || busy || document.hidden) return;
    if (game.status === 'finished') {
      if (!resultsShown && !isDialogOpen()) showResults();
      deliverSpeech(); return;
    }
    if (game.phase !== 'battle') { syncScene(); return; }
    if (paused || isDialogOpen()) { deliverSpeech(); return; }
    if (game.mode === 'local' && game.turn !== viewer) requestHandoff(game.turn, 'turn');
    else scheduleAI();
    deliverSpeech(); updateTurn(); syncScene();
  }
  function scheduleAI() {
    if (aiTimer || !game || game.mode !== 'solo' || game.phase !== 'battle' || game.status !== 'playing' || game.turn !== 'enemy' || busy || paused || document.hidden || isDialogOpen()) return;
    const token = matchToken;
    aiTimer = setTimeout(() => {
      aiTimer = 0;
      if (token !== matchToken || busy || paused || document.hidden || isDialogOpen() || game.status !== 'playing' || game.turn !== 'enemy' || game.mode !== 'solo') return;
      busy = true;
      const result = E.aiMove(game);
      if (!result.ok) { busy = false; updateTurn(); return; }
      void resolveAttack(result, true, null);
    }, 700);
  }
  function showResults() {
    if (game.status !== 'finished' || resultsShown) return;
    resultsShown = true; clearAI();
    const local = game.mode === 'local', won = game.winner === 'player';
    profile.missions++; if (won || local) profile.wins++;
    awardXP(local || won ? 100 : 30);
    $('result-eyebrow').textContent = local ? captain(game.winner).toUpperCase() + ' WINS' : won ? 'MISSION COMPLETE' : 'AN ADVENTURE WELL SPENT';
    $('result-title').textContent = local ? 'Well sailed, ' + captain(game.winner) + '.' : won ? 'Well sailed, Captain.' : 'More words. Wiser waters.';
    $('result-copy').textContent = local ? captain(game.winner) + ' found the whole opposing fleet. Both captains’ discoveries are safe in your shared wordbook.' : won ? 'You found all five ships and brought new words home. Your discoveries are ready to practice again.' : 'The computer found your fleet first. Your discoveries are safe in your wordbook. Set sail and try again.';
    const resultSide = local ? game.winner : 'player';
    const hits = resultSide === 'player' ? game.stats.playerHits : game.stats.enemyHits;
    const shots = resultSide === 'player' ? game.stats.playerShots : game.stats.enemyShots;
    $('result-words').textContent = practiced.size; $('result-accuracy').textContent = Math.round(hits / Math.max(1, shots) * 100) + '%';
    $('result-ships').textContent = LENGTHS.length - E.remaining(game[opposite(resultSide)]);
    $('result-recap').replaceChildren();
    filteredWordbook().filter((item) => practiced.has(wordKey(item))).slice(0, 6).forEach((item) => { const label = document.createElement('span'); label.textContent = item.word; label.lang = pack.learningLanguage; $('result-recap').appendChild(label); });
    openDialog('result-dialog'); sound.effect(local || won ? 'win' : 'loss'); render();
    // Pending final-sink speech is delivered once after the result dialog opens.
    deliverSpeech();
  }

  function filteredWordbook() { return wordbook.filter((item) => item.primaryLanguage === pack.primaryLanguage && item.learningLanguage === pack.learningLanguage).sort((a, b) => (Number(b.lastSeen) || 0) - (Number(a.lastSeen) || 0)); }
  function updateWordbookCount() { $('wordbook-count').textContent = filteredWordbook().length; }
  function renderWordbook() {
    const all = filteredWordbook(), query = $('wordbook-search').value.trim().toLocaleLowerCase();
    const items = all.filter((item) => (item.word + ' ' + item.translation).toLocaleLowerCase().includes(query));
    $('wordbook-description').textContent = L.languageLabel(pack.learningLanguage) + ' → ' + L.languageLabel(pack.primaryLanguage) + ' · ' + all.length + (all.length === 1 ? ' discovery' : ' discoveries') + ' saved on this device.';
    $('export-words').disabled = !all.length;
    const host = $('wordbook-list'); host.replaceChildren();
    if (!items.length) { const empty = document.createElement('div'); empty.className = 'wordbook-empty'; empty.innerHTML = icon('book'); const p = document.createElement('p'); p.textContent = query ? 'No matches yet. Try another word.' : 'Your next discovery is waiting at sea. Hit a ship to add your first word.'; empty.appendChild(p); host.appendChild(empty); return; }
    items.forEach((item) => {
      const entry = document.createElement('div'); entry.className = 'wordbook-entry';
      const text = document.createElement('div'), title = document.createElement('h3'), meaning = document.createElement('p'), meta = document.createElement('p');
      title.textContent = item.word; title.lang = pack.learningLanguage; meaning.textContent = item.translation; meaning.lang = pack.primaryLanguage;
      meta.className = 'wordbook-meta'; meta.textContent = (item.kind === 'sentence' ? 'SENTENCE' : 'WORD') + ' · Practiced ' + (Number(item.practiced) || 1) + '×';
      text.append(title, meaning, meta);
      const play = document.createElement('button'); play.type = 'button'; play.className = 'icon-button'; play.setAttribute('aria-label', 'Hear ' + item.word); play.innerHTML = icon('volume'); play.addEventListener('click', () => { sound.unlock(); say(item, false); });
      entry.append(text, play); host.appendChild(entry);
    });
  }
  function openWordbook() { $('wordbook-search').value = ''; renderWordbook(); openDialog('wordbook-dialog'); }
  function exportPayload() {
    return L.exportPayload(pack, filteredWordbook().map((entry) => { const item = Object.assign({}, entry); delete item.primaryLanguage; delete item.learningLanguage; delete item.practiced; delete item.lastSeen; return item; }));
  }
  function exportWords() {
    const payload = exportPayload(), blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'golingo-word-fleet-' + pack.learningLanguage + '.json'; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    const native = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.golingoExport;
    if (native) { try { native.postMessage(payload); } catch (_) {} }
    toast('Your wordbook export is ready.');
  }
  function updateCourse() {
    const select = $('course-select'); select.querySelectorAll('option[data-custom]').forEach((option) => option.remove());
    if (![...select.options].some((option) => option.value === pack.learningLanguage)) { const option = new Option(L.languageLabel(pack.learningLanguage), pack.learningLanguage); option.dataset.custom = 'true'; select.add(option); }
    select.value = pack.learningLanguage; $('course-flag').textContent = pack.learningLanguage.split('-')[0].toUpperCase();
    document.querySelector('.course-picker').setAttribute('title', pack.title || L.languageLabel(pack.learningLanguage));
    setSelectValue('primary-language', pack.primaryLanguage); setSelectValue('learning-language', pack.learningLanguage);
  }
  function setSelectValue(id, code) {
    const select = $(id); if (![...select.options].some((option) => option.value === code)) select.add(new Option(L.languageLabel(code), code)); select.value = code;
  }
  function loadContent(input, options) {
    const normalized = L.normalizePayload(input, options || { primaryLanguage: pack.primaryLanguage, learningLanguage: pack.learningLanguage });
    pack = normalized; save('pack', pack); newBattle();
    toast(pack.words.length + ' ' + L.languageLabel(pack.learningLanguage) + ' entries loaded. Your fleet is ready to deploy.');
    return { ok: true, count: pack.words.length, primaryLanguage: pack.primaryLanguage, learningLanguage: pack.learningLanguage };
  }
  function applyImport() {
    try { loadContent($('word-input').value, { primaryLanguage: $('primary-language').value, learningLanguage: $('learning-language').value }); $('import-error').textContent = ''; }
    catch (error) { $('import-error').textContent = error.message || 'Please check your word list and try again.'; }
  }
  function syncSettings() {
    [['translation-toggle', 'translation'], ['repeat-toggle', 'repeat'], ['challenge-setting', 'challenge'], ['audio-setting', 'audio'], ['effects-setting', 'effects'], ['action-camera-setting', 'actionCamera'], ['show-word-setting', 'showWord']].forEach(([id, key]) => { $(id).checked = !!settings[key]; });
    $('difficulty-select').value = settings.difficulty; $('skin-select').value = settings.skin;
    $('speech-rate').value = settings.rate; $('speech-rate-label').textContent = Number(settings.rate).toFixed(2) + '×';
    $('sound-toggle').innerHTML = icon(settings.audio ? 'volume' : 'mute');
    $('sound-toggle').setAttribute('aria-label', settings.audio ? 'Mute pronunciation' : 'Enable pronunciation');
    $('sound-toggle').title = settings.audio ? 'Pronunciation on' : 'Pronunciation off';
    $('blueprint-button').setAttribute('aria-pressed', String(settings.blueprint)); $('view-label').textContent = settings.blueprint ? 'Blueprint view' : 'Ocean view';
    document.body.classList.toggle('blueprint', !!settings.blueprint);
    if (currentWord) showWord(currentWord, currentTag);
    updateTurn(); syncScene();
  }

  L.languages.forEach((language) => { ['primary-language', 'learning-language'].forEach((id) => $(id).add(new Option(language.label + (language.nativeName && language.nativeName !== language.label ? ' · ' + language.nativeName : ''), language.code))); });
  $('wordbook-tab').addEventListener('click', openWordbook); $('dock-wordbook').addEventListener('click', openWordbook);
  $('how-button').addEventListener('click', () => openDialog('how-dialog'));
  $('settings-button').addEventListener('click', () => { syncSettings(); openDialog('settings-dialog'); });
  $('import-button').addEventListener('click', () => { $('import-error').textContent = ''; updateCourse(); openDialog('import-dialog'); });
  $('course-select').addEventListener('change', () => { try { loadContent(L.defaultPack($('course-select').value)); } catch (_) { updateCourse(); openDialog('import-dialog'); } });
  $('apply-import').addEventListener('click', applyImport);
  $('choose-file').addEventListener('click', () => $('file-input').click());
  $('file-input').addEventListener('change', async (event) => {
    const file = event.target.files[0], token = matchToken; if (!file) return;
    if (file.size > 1048576) { $('import-error').textContent = 'Choose a file smaller than 1 MB.'; event.target.value = ''; return; }
    try { const content = await file.text(); if (token !== matchToken) return; $('word-input').value = content; $('import-file-name').textContent = file.name; $('import-error').textContent = ''; }
    catch (_) { $('import-error').textContent = 'This file could not be read. Paste the text instead.'; }
    event.target.value = '';
  });
  $('cancel-shot').addEventListener('click', () => closeDialog('quiz-dialog'));
  $('quiz-listen').addEventListener('click', () => { if (pendingShot) { sound.unlock(); say(pendingShot.item, settings.repeat && pendingShot.item.kind !== 'sentence'); } });
  $('quiz-learn').addEventListener('click', () => { if (pendingShot) { $('quiz-feedback').classList.remove('wrong'); $('quiz-feedback').textContent = pendingShot.item.word + ' = ' + pendingShot.question.answer + '. Select its meaning to fire.'; } });
  $('quiz-dialog').addEventListener('keydown', (event) => {
    if (/^[1-4]$/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) { const option = $('quiz-choices').children[Number(event.key) - 1]; if (option && !option.disabled) { event.preventDefault(); option.click(); } }
  });
  ['player-grid', 'enemy-grid'].forEach((id) => $(id).addEventListener('keydown', (event) => {
    if (id === 'player-grid' && event.key.toLowerCase() === 'r' && canDeploy()) { event.preventDefault(); rotateSelected(); return; }
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) || !event.target.matches('button')) return;
    event.preventDefault();
    const original = Number(event.target.dataset.index), delta = { ArrowUp: -SIZE, ArrowDown: SIZE, ArrowLeft: -1, ArrowRight: 1 }[event.key];
    let index = original + delta;
    while (index >= 0 && index < SIZE * SIZE) {
      if (Math.abs(delta) === 1 && Math.floor(index / SIZE) !== Math.floor(original / SIZE)) break;
      const cell = $(id).children[index]; if (!cell.disabled) { cell.focus(); break; } index += delta;
    }
  }));
  $('rotate-fleet').addEventListener('click', rotateSelected);
  $('shuffle-fleet').addEventListener('click', () => { if (canDeploy() && E.shuffleFleet(game, deploymentSide)) { sound.unlock(); render(); describeSelection(); sound.effect('sonar'); toast('Fleet repositioned. Review your formation, Captain.'); } });
  $('start-battle').addEventListener('click', startBattle);
  $('own-board-tab').addEventListener('click', () => setMobileBoard('own')); $('enemy-board-tab').addEventListener('click', () => setMobileBoard('enemy'));
  $('blueprint-button').addEventListener('click', () => { settings.blueprint = !settings.blueprint; saveSettings(); syncSettings(); });
  $('new-game').addEventListener('click', () => { $('new-mode').value = game.mode; $('new-rule').value = game.rule; openDialog('new-dialog'); });
  $('confirm-new-game').addEventListener('click', () => newBattle({ mode: $('new-mode').value, rule: $('new-rule').value }));
  $('play-again').addEventListener('click', () => newBattle());
  $('result-wordbook').addEventListener('click', () => { closeDialog('result-dialog'); openWordbook(); });
  $('pause-button').addEventListener('click', () => { paused = true; openDialog('pause-dialog'); });
  $('resume-game').addEventListener('click', () => { const hadPendingSpeech = !!pendingSpeech; paused = false; closeDialog('pause-dialog'); sound.unlock(); updateTurn(); syncScene(); routeTurn(); if (!hadPendingSpeech && !privacyLocked && !isDialogOpen() && currentWord && currentWord.kind !== 'sentence') speakCurrent(); });
  $('pause-wordbook').addEventListener('click', () => { returnToPause = true; closeDialog('pause-dialog'); openWordbook(); });
  $('wordbook-search').addEventListener('input', renderWordbook); $('export-words').addEventListener('click', exportWords);
  $('replay-word').addEventListener('click', () => { sound.unlock(); speakCurrent(); });
  $('replay-sentence').addEventListener('click', () => {
    if (!currentWord) return;
    sound.unlock();
    if (currentWord.kind === 'sentence') say(currentWord, false);
    else if (currentWord.sentence) say({ word: currentWord.sentence, audioURL: currentWord.sentenceAudioURL || '', kind: 'sentence' }, false);
  });
  [['translation-toggle', 'translation'], ['repeat-toggle', 'repeat'], ['challenge-setting', 'challenge'], ['audio-setting', 'audio'], ['effects-setting', 'effects'], ['action-camera-setting', 'actionCamera'], ['show-word-setting', 'showWord']].forEach(([id, key]) => $(id).addEventListener('change', () => {
    settings[key] = $(id).checked;
    if (key === 'audio' || key === 'repeat') { sound.stop(); $('audio-status').textContent = ''; }
    saveSettings(); syncSettings();
  }));
  $('sound-toggle').addEventListener('click', () => { settings.audio = !settings.audio; sound.stop(); $('audio-status').textContent = ''; saveSettings(); syncSettings(); if (settings.audio) { sound.unlock(); speakCurrent(); } });
  $('difficulty-select').addEventListener('change', () => { settings.difficulty = $('difficulty-select').value; saveSettings(); });
  $('skin-select').addEventListener('change', () => { settings.skin = $('skin-select').value; saveSettings(); render(); });
  $('speech-rate').addEventListener('input', () => { settings.rate = Number($('speech-rate').value); $('speech-rate-label').textContent = settings.rate.toFixed(2) + '×'; sound.stop(); saveSettings(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { sound.stop(); clearAI(); cancelDrag(); syncScene(); }
    else if (game && game.phase === 'battle' && game.status === 'playing' && !isDialogOpen()) { paused = true; openDialog('pause-dialog'); }
    else { syncScene(); routeTurn(); }
  });
  window.addEventListener('pagehide', () => { sound.stop(); clearAI(); if (scene) scene.setState({ paused: true }); });
  window.addEventListener('pageshow', () => { syncScene(); routeTurn(); });

  // GoLingo integration: direct native calls, known hub messages, or URL JSON.
  const bridgeLoad = (payload) => { try { return loadContent(payload); } catch (error) { toast(error.message || 'This learning list could not be loaded.'); return { ok: false, error: error.message }; } };
  window.GoLingoGame = Object.freeze({ load: bridgeLoad, exportWords: exportPayload });
  window.loadGoLingoData = bridgeLoad; window.receiveGoLingoData = bridgeLoad; window.setLearningContent = bridgeLoad;
  window.addEventListener('message', (event) => {
    const allowed = [location.origin, 'https://xcergolingo.github.io', 'https://www.golingoapp.com', 'https://golingoapp.com'];
    const fromParent = event.source === window.parent && window.parent !== window;
    if (!allowed.includes(event.origin) && !(fromParent && (event.origin === 'null' || event.origin === ''))) return;
    const data = event.data;
    if (!data || typeof data !== 'object' || !['golingo-data', 'GOLINGO_DATA', 'golingo:content', 'loadWords'].includes(data.type)) return;
    const result = bridgeLoad(data.payload || data.data || data.content || data);
    if (event.source && event.origin !== 'null' && event.origin) { try { event.source.postMessage({ type: 'golingo:loaded', ...result }, event.origin); } catch (_) {} }
  });
  function readURLContent() {
    const params = new URLSearchParams(location.search), hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    const raw = params.get('data') || params.get('content') || params.get('lesson') || params.get('golingoLesson') || hash.get('golingoLesson') || hash.get('data') || hash.get('content') || hash.get('lesson');
    if (raw) {
      let input = raw;
      if (raw.length > 1500000) { toast('This URL contains too much content. Import a JSON file instead.'); return; }
      if (!/^[\s]*[\[{]/.test(raw)) { try { const encoded = raw.replace(/-/g, '+').replace(/_/g, '/'); input = new TextDecoder().decode(Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))); } catch (_) {} }
      bridgeLoad(input);
    } else {
      const language = params.get('learningLanguage') || params.get('lang');
      if (language) { try { loadContent(L.defaultPack(language)); } catch (_) { toast('Use “My own words” to load content for this language.'); } }
    }
  }
  syncSettings(); saveSettings(); newBattle(); readURLContent();
  try { if (window.webkit?.messageHandlers?.golingoReady) window.webkit.messageHandlers.golingoReady.postMessage({ game: 'word-fleet', ready: true }); } catch (_) {}
})();
