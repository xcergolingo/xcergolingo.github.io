(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FleetEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SHIP_NAMES = ['Carrier', 'Cruiser', 'Submarine', 'Patrol boat'];
  var CLASSIC_SHIP_NAMES = ['Carrier', 'Battleship', 'Cruiser', 'Submarine', 'Patrol boat'];

  function randomIndex(length, rng) {
    var value = Number(rng());
    if (!Number.isFinite(value)) value = 0.5;
    return Math.min(length - 1, Math.max(0, Math.floor(value * length)));
  }

  function shuffled(items, rng) {
    var result = items.slice();
    for (var i = result.length - 1; i > 0; i--) {
      var j = randomIndex(i + 1, rng);
      var temp = result[i]; result[i] = result[j]; result[j] = temp;
    }
    return result;
  }

  function neighbors(index, size, diagonals) {
    var row = Math.floor(index / size), col = index % size, result = [];
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        if ((!dr && !dc) || (!diagonals && dr && dc)) continue;
        var r = row + dr, c = col + dc;
        if (r >= 0 && r < size && c >= 0 && c < size) result.push(r * size + c);
      }
    }
    return result;
  }

  function placements(size, length) {
    var result = [];
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        if (c + length <= size) {
          result.push(Array.from({ length: length }, function (_, n) { return r * size + c + n; }));
        }
        if (length > 1 && r + length <= size) {
          result.push(Array.from({ length: length }, function (_, n) { return (r + n) * size + c; }));
        }
      }
    }
    return result;
  }

  function makeBoard(size, lengths, rng) {
    var occupied = new Set(), selected = [];
    var names = lengths.length === 5 ? CLASSIC_SHIP_NAMES : SHIP_NAMES;
    var candidates = lengths.map(function (length) { return shuffled(placements(size, length), rng); });
    var attempts = 0;
    function place(depth) {
      if (depth === lengths.length) return true;
      for (var i = 0; i < candidates[depth].length; i++) {
        if (++attempts > 150000) return false;
        var cells = candidates[depth][i];
        if (cells.some(function (cell) {
          return occupied.has(cell) || neighbors(cell, size, true).some(function (n) { return occupied.has(n); });
        })) continue;
        cells.forEach(function (cell) { occupied.add(cell); });
        selected[depth] = cells;
        if (place(depth + 1)) return true;
        cells.forEach(function (cell) { occupied.delete(cell); });
      }
      return false;
    }
    if (!place(0)) throw new RangeError('This fleet cannot fit with a clear cell between ships. Use a larger board or a smaller fleet.');
    return {
      ships: selected.map(function (cells, index) {
        return {
          id: 'ship-' + index,
          name: names[index] || 'Ship ' + (index + 1),
          length: lengths[index], cells: cells.slice(), hits: [], sunk: false
        };
      }),
      shots: Array(size * size).fill(null)
    };
  }

  function createGame(options) {
    options = options || {};
    var size = options.size === undefined ? 8 : options.size;
    var lengths = options.lengths === undefined ? [4, 3, 3, 2] : options.lengths.slice();
    var difficulty = options.difficulty === 'relaxed' ? 'relaxed' : 'standard';
    var rule = options.rule === 'streak' || options.rule === 'salvo' ? options.rule : 'one-shot';
    var mode = options.mode === 'local' ? 'local' : 'solo';
    var rng = typeof options.rng === 'function' ? options.rng : Math.random;
    if (!Number.isInteger(size) || size < 2 || size > 16) throw new RangeError('Board size must be an integer from 2 to 16.');
    if (!lengths.length || lengths.some(function (length) { return !Number.isInteger(length) || length < 1 || length > size; })) {
      throw new RangeError('Supply at least one ship, with integer lengths from 1 to the board size.');
    }
    var state = {
      size: size, lengths: lengths, difficulty: difficulty, rule: rule, mode: mode,
      player: makeBoard(size, lengths, rng), enemy: makeBoard(size, lengths, rng),
      turn: 'player', status: 'playing', winner: null,
      phase: options.deployment === true ? 'deployment' : 'battle',
      shotsRemaining: rule === 'salvo' ? 3 : 1,
      stats: { playerShots: 0, playerHits: 0, enemyShots: 0, enemyHits: 0 },
      lastMove: null
    };
    Object.defineProperty(state, '_rng', { value: rng, enumerable: false });
    return state;
  }

  function remaining(board) {
    return board.ships.filter(function (ship) { return !ship.sunk; }).length;
  }

  function getShip(board, index) {
    return board.ships.find(function (ship) { return ship.cells.indexOf(index) !== -1; }) || null;
  }

  function rejected(reason, index) {
    return { ok: false, reason: reason, index: index };
  }

  function turnQuota(state) {
    return state.rule === 'salvo' ? 3 : 1;
  }

  function beginBattle(state) {
    if (state.status !== 'playing') return { ok: false, reason: 'game-over' };
    if (state.stats.playerShots || state.stats.enemyShots) return { ok: false, reason: 'battle-started' };
    // Starting an already active battle must never reset a turn or its shot quota.
    if (state.phase !== 'deployment') return { ok: false, reason: 'already-started' };
    state.phase = 'battle'; state.turn = 'player'; state.shotsRemaining = turnQuota(state);
    return { ok: true, nextTurn: state.turn, shotsRemaining: state.shotsRemaining };
  }

  function fire(state, attacker, index) {
    if (attacker !== 'player' && attacker !== 'enemy') return rejected('invalid-attacker', index);
    if (state.status !== 'playing') return rejected('game-over', index);
    if (state.phase === 'deployment') return rejected('not-started', index);
    if (state.turn !== attacker) return rejected('wrong-turn', index);
    if (!Number.isInteger(index) || index < 0 || index >= state.size * state.size) return rejected('invalid-cell', index);
    var defender = attacker === 'player' ? 'enemy' : 'player';
    var board = state[defender];
    if (board.shots[index] !== null) return rejected('already-fired', index);
    var ship = getShip(board, index);
    var result = {
      ok: true, attacker: attacker, defender: defender, index: index,
      hit: !!ship, sunk: false,
      shipId: ship ? ship.id : null, shipName: ship ? ship.name : null,
      shipLength: ship ? ship.length : 0,
      shipCells: [], gameOver: false, winner: null,
      turnRetained: false, nextTurn: null, shotsRemaining: 0
    };
    state.stats[attacker + 'Shots']++;
    if (ship) {
      state.stats[attacker + 'Hits']++;
      ship.hits.push(index);
      ship.sunk = ship.hits.length === ship.length;
      board.shots[index] = ship.sunk ? 'sunk' : 'hit';
      if (ship.sunk) {
        ship.cells.forEach(function (cell) { board.shots[cell] = 'sunk'; });
        result.sunk = true;
        result.shipCells = ship.cells.slice();
      }
    } else {
      board.shots[index] = 'miss';
    }
    if (!remaining(board)) {
      state.status = 'finished'; state.phase = 'finished'; state.winner = attacker; state.turn = null;
      state.shotsRemaining = 0;
      result.gameOver = true; result.winner = attacker;
    } else {
      if (state.rule === 'streak' && result.hit) {
        state.turn = attacker;
        state.shotsRemaining = 1;
      } else if (state.rule === 'salvo' && state.shotsRemaining > 1) {
        state.turn = attacker;
        state.shotsRemaining--;
      } else {
        state.turn = defender;
        state.shotsRemaining = turnQuota(state);
      }
    }
    result.nextTurn = state.turn;
    result.turnRetained = state.turn === attacker;
    result.shotsRemaining = state.shotsRemaining;
    state.lastMove = result;
    return result;
  }

  function hitGroups(shots, size) {
    var seen = new Set(), groups = [];
    shots.forEach(function (shot, index) {
      if (shot !== 'hit' || seen.has(index)) return;
      var group = [], stack = [index]; seen.add(index);
      while (stack.length) {
        var current = stack.pop(); group.push(current);
        neighbors(current, size, false).forEach(function (n) {
          if (shots[n] === 'hit' && !seen.has(n)) { seen.add(n); stack.push(n); }
        });
      }
      groups.push(group);
    });
    return groups.sort(function (a, b) { return b.length - a.length; });
  }

  // This selector reads public shot outcomes only; ship coordinates are never consulted.
  function chooseAiTarget(state) {
    var shots = state.player.shots, size = state.size, rng = state._rng || Math.random;
    var available = [];
    shots.forEach(function (shot, index) { if (shot === null) available.push(index); });
    if (!available.length) return -1;
    if (state.difficulty === 'relaxed') return available[randomIndex(available.length, rng)];
    var groups = hitGroups(shots, size);
    for (var g = 0; g < groups.length; g++) {
      var group = groups[g], targets = [];
      if (group.length >= 2) {
        group.sort(function (a, b) { return a - b; });
        var horizontal = Math.floor(group[0] / size) === Math.floor(group[1] / size);
        var step = horizontal ? 1 : size;
        var first = group[0] - step, last = group[group.length - 1] + step;
        [first, last].forEach(function (target) {
          if (target < 0 || target >= shots.length || shots[target] !== null) return;
          if (horizontal && Math.floor(target / size) !== Math.floor(group[0] / size)) return;
          targets.push(target);
        });
      } else {
        targets = neighbors(group[0], size, false).filter(function (target) { return shots[target] === null; });
      }
      if (targets.length) return targets[randomIndex(targets.length, rng)];
    }
    // No-touch fleet placement lets the opponent infer that a sunk ship's halo is empty.
    var inferredWater = new Set();
    shots.forEach(function (shot, index) {
      if (shot === 'sunk') neighbors(index, size, true).forEach(function (n) { inferredWater.add(n); });
    });
    var useful = available.filter(function (index) { return !inferredWater.has(index); });
    if (!useful.length) useful = available;
    var hunt = state.lengths.every(function (length) { return length >= 2; })
      ? useful.filter(function (index) { return (Math.floor(index / size) + index % size) % 2 === 0; })
      : useful;
    var pool = hunt.length ? hunt : useful;
    return pool[randomIndex(pool.length, rng)];
  }

  function aiMove(state) {
    if (state.status !== 'playing') return rejected('game-over', -1);
    if (state.phase === 'deployment') return rejected('not-started', -1);
    if (state.turn !== 'enemy') return rejected('wrong-turn', -1);
    var target = chooseAiTarget(state);
    return target < 0 ? rejected('no-targets', target) : fire(state, 'enemy', target);
  }

  function canArrange(state) {
    return state.status === 'playing' && !state.stats.playerShots && !state.stats.enemyShots;
  }

  function invalidPlacement(reason, cells) {
    return { ok: false, reason: reason, cells: cells || [] };
  }

  // This is read-only so the interface can preview a placement before committing it.
  function canPlace(state, side, shipId, startIndex, vertical) {
    if (side !== 'player' && side !== 'enemy') return invalidPlacement('invalid-side');
    if (state.status !== 'playing') return invalidPlacement('game-over');
    if (!canArrange(state)) return invalidPlacement('battle-started');
    var board = state[side];
    var ship = board.ships.find(function (entry) { return entry.id === shipId; });
    if (!ship) return invalidPlacement('unknown-ship');
    if (!Number.isInteger(startIndex) || startIndex < 0 || startIndex >= state.size * state.size) return invalidPlacement('invalid-cell');
    var row = Math.floor(startIndex / state.size), col = startIndex % state.size;
    if (vertical ? row + ship.length > state.size : col + ship.length > state.size) return invalidPlacement('out-of-bounds');
    var step = vertical ? state.size : 1;
    var cells = Array.from({ length: ship.length }, function (_, n) { return startIndex + n * step; });
    var occupied = new Set();
    board.ships.forEach(function (entry) {
      if (entry.id !== shipId) entry.cells.forEach(function (cell) { occupied.add(cell); });
    });
    if (cells.some(function (cell) { return occupied.has(cell); })) return invalidPlacement('overlap', cells);
    if (cells.some(function (cell) {
      return neighbors(cell, state.size, true).some(function (neighbor) { return occupied.has(neighbor); });
    })) return invalidPlacement('ships-touch', cells);
    return { ok: true, cells: cells };
  }

  function moveShip(state, side, shipId, startIndex, vertical) {
    var result = canPlace(state, side, shipId, startIndex, vertical);
    if (!result.ok) return result;
    var ship = state[side].ships.find(function (entry) { return entry.id === shipId; });
    ship.cells = result.cells.slice();
    ship.hits = []; ship.sunk = false;
    return { ok: true, shipId: shipId, cells: ship.cells.slice(), vertical: !!vertical };
  }

  function rotateShip(state, side, shipId) {
    if (side !== 'player' && side !== 'enemy') return invalidPlacement('invalid-side');
    if (state.status !== 'playing') return invalidPlacement('game-over');
    if (!canArrange(state)) return invalidPlacement('battle-started');
    var ship = state[side].ships.find(function (entry) { return entry.id === shipId; });
    if (!ship) return invalidPlacement('unknown-ship');
    var cells = ship.cells.slice().sort(function (a, b) { return a - b; });
    var vertical = cells.length > 1 && cells[1] - cells[0] === state.size;
    return moveShip(state, side, shipId, cells[0], !vertical);
  }

  function shuffleFleet(state, side) {
    if ((side !== 'player' && side !== 'enemy') || !canArrange(state)) return false;
    state[side] = makeBoard(state.size, state.lengths, state._rng || Math.random);
    return true;
  }

  function shufflePlayer(state) { return shuffleFleet(state, 'player'); }

  return Object.freeze({
    createGame: createGame, beginBattle: beginBattle, fire: fire, aiMove: aiMove,
    canPlace: canPlace, moveShip: moveShip, rotateShip: rotateShip,
    shuffleFleet: shuffleFleet, shufflePlayer: shufflePlayer, remaining: remaining, getShip: getShip
  });
});
