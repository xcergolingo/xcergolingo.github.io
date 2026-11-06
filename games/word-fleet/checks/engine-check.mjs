import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../engine.js');

function seeded(seed) {
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function verifyBoard(board, size) {
  const occupied = new Map();
  for (const ship of board.ships) {
    assert.equal(ship.length, ship.cells.length);
    assert.equal(ship.sunk, false);
    assert.deepEqual(ship.hits, []);
    const cells = ship.cells.slice().sort((a,b) => a-b);
    const step = cells.length > 1 ? cells[1] - cells[0] : 1;
    assert.ok(step === 1 || step === size);
    if (step === 1) assert.equal(Math.floor(cells[0]/size), Math.floor(cells.at(-1)/size));
    for (let n=0;n<cells.length;n++) {
      const cell = cells[n];
      assert.equal(cell, cells[0]+n*step);
      assert.ok(cell>=0 && cell<size*size);
      assert.ok(!occupied.has(cell));
      occupied.set(cell, ship.id);
    }
  }
  for (const [cell,id] of occupied) {
    const row = Math.floor(cell/size), col=cell%size;
    for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++) {
      if(row+dr<0||row+dr>=size||col+dc<0||col+dc>=size)continue;
      const other = occupied.get((row+dr)*size+col+dc);
      if(other)assert.equal(other,id,'Different ships must not touch');
    }
  }
  assert.equal(board.shots.length,size*size);
  assert.ok(board.shots.every(s=>s===null));
}

for(let n=1;n<=160;n++) {
  const s=E.createGame({rng:seeded(n)});
  verifyBoard(s.player,s.size); verifyBoard(s.enemy,s.size);
  assert.equal(s.rule,'one-shot'); assert.equal(s.mode,'solo');
  assert.equal(s.phase,'battle'); assert.equal(s.shotsRemaining,1);
}
const state=E.createGame({rng:seeded(519)});
const oldLayout=JSON.stringify(state.player.ships.map(s=>s.cells));
assert.equal(E.shufflePlayer(state),true);
assert.notEqual(JSON.stringify(state.player.ships.map(s=>s.cells)),oldLayout);
assert.equal(E.fire(state,'enemy',0).reason,'wrong-turn');
assert.equal(E.fire(state,'player',-1).reason,'invalid-cell');
assert.equal(E.fire(state,'player',64).reason,'invalid-cell');
assert.equal(E.fire(state,'player',0.5).reason,'invalid-cell');
const first=state.enemy.ships[0].cells[0];
assert.equal(E.fire(state,'player',first).hit,true);
assert.equal(state.turn,'enemy');
assert.equal(E.shufflePlayer(state),false);
assert.equal(E.fire(state,'player',first).reason,'wrong-turn');
assert.equal(E.aiMove(state).ok,true);
assert.equal(E.fire(state,'player',first).reason,'already-fired');
assert.equal(state.stats.playerShots,1);
assert.equal(state.stats.playerHits,1);
assert.equal(state.stats.enemyShots,1);

// A player targeting all known cells wins; hits mark complete ships consistently.
const win=E.createGame({rng:seeded(31)});
const enemyWater=Array.from({length:64},(_,i)=>i).filter(i=>!E.getShip(win.player,i));
let waterIndex=0;
for(const ship of win.enemy.ships) {
  for(const cell of ship.cells) {
    const result=E.fire(win,'player',cell);
    assert.equal(result.ok,true); assert.equal(result.hit,true);
    if(result.sunk)assert.ok(ship.cells.every(i=>win.enemy.shots[i]==='sunk'));
    if(!result.gameOver)E.fire(win,'enemy',enemyWater[waterIndex++]);
  }
}
assert.equal(win.winner,'player'); assert.equal(win.status,'finished');
assert.equal(E.remaining(win.enemy),0); assert.equal(win.stats.playerShots,12);
assert.equal(E.aiMove(win).reason,'game-over');
assert.equal(E.fire(win,'player',0).reason,'game-over');

// Enemy targeting must depend on observations, never hidden ship data.
const blind=E.createGame({rng:seeded(5)});
blind.turn='enemy'; blind.player.shots[27]='hit';
let accessed=0;
const actualShips=blind.player.ships;
Object.defineProperty(blind.player,'ships',{get(){accessed++;return actualShips;}});
const ai=E.aiMove(blind);
assert.ok([19,26,28,35].includes(ai.index),'AI must follow an observed hit');
// fire() reads ships to resolve the attack and to check victory, and nothing else should.
assert.equal(accessed,2);
const line=E.createGame({rng:seeded(7)});
line.player.shots[26]='hit';line.player.shots[27]='hit';line.turn='enemy';
assert.ok([25,28].includes(E.aiMove(line).index),'AI must extend a known ship direction');

// Complete 120 games against both difficulty modes, without repeats or stalled turns.
for(let n=1;n<=120;n++) {
  const s=E.createGame({rng:seeded(n*100),difficulty:n%2?'relaxed':'standard'});
  const seen=new Set();let cursor=0,turns=0;
  while(s.status==='playing') {
    if(s.turn==='player') {
      while(s.enemy.shots[cursor]!==null)cursor++;
      assert.equal(E.fire(s,'player',cursor).ok,true);
    } else {
      const result=E.aiMove(s);
      assert.equal(result.ok,true);assert.ok(!seen.has(result.index));seen.add(result.index);
    }
    assert.ok(++turns<=128,'A finite board must finish');
  }
  assert.ok(['player','enemy'].includes(s.winner));
}
assert.throws(()=>E.createGame({size:3,lengths:[3,3,3]}),RangeError);

// The classic fleet has five named ships and fits a 10×10 board without touching.
const classicOptions = {size:10,lengths:[5,4,3,3,2]};
for(let n=1;n<=100;n++) {
  const s=E.createGame({...classicOptions,rng:seeded(n*19),deployment:true});
  verifyBoard(s.player,10); verifyBoard(s.enemy,10);
  assert.deepEqual(s.enemy.ships.map(ship=>ship.name),['Carrier','Battleship','Cruiser','Submarine','Patrol boat']);
  assert.equal(s.phase,'deployment'); assert.equal(s.stats.playerShots,0);
}

function water(board,size) {
  return Array.from({length:size*size},(_,i)=>i).filter(i=>!E.getShip(board,i));
}
function rowLayout(board,size) {
  board.ships.forEach((ship,index)=>{ship.cells=Array.from({length:ship.length},(_,n)=>index*size*2+n);});
}

// Deployment rejects firing. Preview and rejected manual moves are side-effect free.
const manual=E.createGame({...classicOptions,rng:seeded(606),deployment:true,mode:'local',rule:'salvo'});
rowLayout(manual.player,10); rowLayout(manual.enemy,10);
verifyBoard(manual.player,10); verifyBoard(manual.enemy,10);
assert.equal(manual.mode,'local'); assert.equal(manual.shotsRemaining,3);
const preDeployment=JSON.stringify(manual);
assert.equal(E.fire(manual,'player',0).reason,'not-started');
assert.equal(E.fire(manual,'enemy',0).reason,'not-started');
assert.equal(E.aiMove(manual).reason,'not-started');
assert.equal(JSON.stringify(manual),preDeployment);
assert.deepEqual(E.canPlace(manual,'player','ship-0',5,true),{ok:true,cells:[5,15,25,35,45]});
assert.equal(JSON.stringify(manual),preDeployment,'Previewing a placement must not move anything');
for(const [side,id,index,vertical,reason] of [
  ['both','ship-0',0,false,'invalid-side'],
  ['player','unknown',0,false,'unknown-ship'],
  ['player','ship-0',-1,false,'invalid-cell'],
  ['player','ship-0',100,false,'invalid-cell'],
  ['player','ship-0',0.5,false,'invalid-cell'],
  ['player','ship-0',9,false,'out-of-bounds'],
  ['player','ship-0',90,true,'out-of-bounds'],
  ['player','ship-0',20,false,'overlap'],
  ['player','ship-0',11,false,'ships-touch'],
]) {
  assert.equal(E.moveShip(manual,side,id,index,vertical).reason,reason);
  assert.equal(JSON.stringify(manual),preDeployment,'Invalid placement must be atomic');
}
const beforeEnemy=JSON.stringify(manual.enemy);
const moved=E.moveShip(manual,'player','ship-0',5,true);
assert.equal(moved.ok,true); assert.deepEqual(manual.player.ships[0].cells,[5,15,25,35,45]);
moved.cells[0]=99;
assert.equal(manual.player.ships[0].cells[0],5,'Results must not expose a mutable board-cell array');
assert.equal(JSON.stringify(manual.enemy),beforeEnemy);
assert.equal(E.rotateShip(manual,'player','ship-0').ok,true);
assert.deepEqual(manual.player.ships[0].cells,[5,6,7,8,9]);
assert.equal(E.rotateShip(manual,'player','ship-0').ok,true);
assert.deepEqual(manual.player.ships[0].cells,[5,15,25,35,45]);
const beforeInvalidRotation=JSON.stringify(manual);
assert.equal(E.rotateShip(manual,'player','ship-1').reason,'overlap');
assert.equal(JSON.stringify(manual),beforeInvalidRotation);
assert.equal(E.moveShip(manual,'enemy','ship-4',89,true).ok,true);
assert.deepEqual(manual.enemy.ships[4].cells,[89,99]);
verifyBoard(manual.player,10); verifyBoard(manual.enemy,10);
const ownBeforeShuffle=JSON.stringify(manual.player);
const enemyBeforeShuffle=JSON.stringify(manual.enemy);
assert.equal(E.shuffleFleet(manual,'invalid'),false);
assert.equal(E.shuffleFleet(manual,'enemy'),true);
assert.notEqual(JSON.stringify(manual.enemy),enemyBeforeShuffle);
assert.equal(JSON.stringify(manual.player),ownBeforeShuffle);
verifyBoard(manual.enemy,10);
assert.deepEqual(E.beginBattle(manual),{ok:true,nextTurn:'player',shotsRemaining:3});
assert.equal(manual.phase,'battle'); assert.equal(manual.turn,'player');
assert.equal(E.beginBattle(manual).reason,'already-started');
assert.equal(E.moveShip(manual,'player','ship-0',5,true).ok,true,'Arrangement remains allowed until the first shot');
assert.equal(E.fire(manual,'player',0).ok,true);
const inBattle=JSON.stringify(manual);
for(const side of ['player','enemy']) {
  assert.equal(E.canPlace(manual,side,'ship-0',0,false).reason,'battle-started');
  assert.equal(E.moveShip(manual,side,'ship-0',0,false).reason,'battle-started');
  assert.equal(E.rotateShip(manual,side,'ship-0').reason,'battle-started');
  assert.equal(E.shuffleFleet(manual,side),false);
}
assert.equal(E.beginBattle(manual).reason,'battle-started');
assert.equal(JSON.stringify(manual),inBattle,'Placement cannot reset an active match');

// One shot always passes the turn, even after a successful hit.
const single=E.createGame({...classicOptions,rng:seeded(21),rule:'one-shot'});
const singleHit=E.fire(single,'player',single.enemy.ships[0].cells[0]);
assert.equal(singleHit.hit,true); assert.equal(singleHit.turnRetained,false);
assert.equal(singleHit.nextTurn,'enemy'); assert.equal(singleHit.shotsRemaining,1);
assert.deepEqual(singleHit.shipCells,[],'An unsunk enemy ship must not disclose its other coordinates');

// The larger board preserves observation-only targeting, including edge boundaries.
const edgeAi=E.createGame({...classicOptions,rng:seeded(120),rule:'salvo'});
edgeAi.turn='enemy'; edgeAi.player.shots[8]='hit'; edgeAi.player.shots[9]='hit';
let edgeAccesses=0;
const edgeShips=edgeAi.player.ships;
Object.defineProperty(edgeAi.player,'ships',{get(){edgeAccesses++;return edgeShips;}});
const edgeResult=E.aiMove(edgeAi);
assert.equal(edgeResult.index,7,'A horizontal hit group must not wrap from column 10 to column 1');
assert.equal(edgeAccesses,2,'Only resolving the shot and checking victory may read the hidden fleet');

// Hitting Streak applies symmetrically, including to the shot that sinks a ship.
const streak=E.createGame({...classicOptions,rng:seeded(22),rule:'streak'});
for(const attacker of ['player','enemy']) {
  const defender=attacker==='player'?'enemy':'player';
  const ship=streak[defender].ships[0];
  for(const cell of ship.cells) {
    const hit=E.fire(streak,attacker,cell);
    assert.equal(hit.ok,true); assert.equal(hit.hit,true);
    assert.equal(hit.turnRetained,true); assert.equal(hit.nextTurn,attacker);
    assert.equal(hit.shotsRemaining,1);
  }
  assert.equal(streak.lastMove.sunk,true); assert.equal(streak.turn,attacker);
  const miss=E.fire(streak,attacker,water(streak[defender],10)[0]);
  assert.equal(miss.hit,false); assert.equal(miss.turnRetained,false);
  assert.equal(miss.nextTurn,defender); assert.equal(streak.turn,defender);
}

// Salvo grants exactly three sequential shots per side, regardless of hit/miss.
const salvo=E.createGame({...classicOptions,rng:seeded(23),rule:'salvo'});
assert.equal(salvo.shotsRemaining,3);
const salvoTargets=[salvo.enemy.ships[0].cells[0],water(salvo.enemy,10)[0],salvo.enemy.ships[0].cells[1]];
for(let shot=0;shot<3;shot++) {
  const result=E.fire(salvo,'player',salvoTargets[shot]);
  assert.equal(result.ok,true); assert.equal(result.turnRetained,shot<2);
  assert.equal(result.nextTurn,shot<2?'player':'enemy');
  assert.equal(result.shotsRemaining,shot<2?2-shot:3);
  if(shot===0) {
    const unchanged=JSON.stringify(salvo);
    assert.equal(E.fire(salvo,'player',salvoTargets[0]).reason,'already-fired');
    assert.equal(E.fire(salvo,'player',100).reason,'invalid-cell');
    assert.equal(E.fire(salvo,'enemy',0).reason,'wrong-turn');
    assert.equal(JSON.stringify(salvo),unchanged,'Rejected shots cannot consume the salvo quota');
  }
}
const aiSalvo=new Set();
for(let shot=0;shot<3;shot++) {
  const result=E.aiMove(salvo);
  assert.equal(result.ok,true); assert.ok(!aiSalvo.has(result.index)); aiSalvo.add(result.index);
  assert.equal(result.nextTurn,shot<2?'enemy':'player');
  assert.equal(result.shotsRemaining,shot<2?2-shot:3);
}

// Victory ends a salvo immediately; no remaining shot or beginBattle can revive it.
const quickWin=E.createGame({size:4,lengths:[1],rule:'salvo',rng:seeded(24)});
const finalShot=E.fire(quickWin,'player',quickWin.enemy.ships[0].cells[0]);
assert.equal(finalShot.gameOver,true); assert.equal(finalShot.turnRetained,false);
assert.equal(finalShot.nextTurn,null); assert.equal(finalShot.shotsRemaining,0);
assert.equal(quickWin.phase,'finished'); assert.equal(quickWin.turn,null);
assert.equal(E.aiMove(quickWin).reason,'game-over');
assert.equal(E.beginBattle(quickWin).reason,'game-over');
assert.equal(E.moveShip(quickWin,'player','ship-0',0,false).reason,'game-over');
assert.equal(E.shuffleFleet(quickWin,'player'),false);

// Finish 120 classic 10×10 games, exercising every rule and difficulty combination.
for(const rule of ['one-shot','streak','salvo']) {
  for(const difficulty of ['relaxed','standard']) {
    for(let n=1;n<=20;n++) {
      const s=E.createGame({...classicOptions,rule,difficulty,rng:seeded(8000+n*37),deployment:true});
      assert.equal(E.beginBattle(s).ok,true);
      const seen={player:new Set(),enemy:new Set()}; let cursor=0,turns=0;
      while(s.status==='playing') {
        const attacker=s.turn;
        let result;
        if(attacker==='player') {
          while(s.enemy.shots[cursor]!==null && cursor<100)cursor++;
          result=E.fire(s,attacker,cursor);
        } else result=E.aiMove(s);
        assert.equal(result.ok,true,`${rule}/${difficulty} must always progress`);
        assert.ok(!seen[attacker].has(result.index)); seen[attacker].add(result.index);
        assert.equal(result.nextTurn,s.turn); assert.equal(result.shotsRemaining,s.shotsRemaining);
        assert.ok(++turns<=200,'A finite board must finish under every shot rule');
      }
      assert.equal(s.phase,'finished'); assert.equal(s.shotsRemaining,0);
      assert.equal(s.stats.playerShots,seen.player.size); assert.equal(s.stats.enemyShots,seen.enemy.size);
      assert.equal(s.enemy.shots.filter(Boolean).length,s.stats.playerShots);
      assert.equal(s.player.shots.filter(Boolean).length,s.stats.enemyShots);
      assert.equal(E.remaining(s[s.winner==='player'?'enemy':'player']),0);
    }
  }
}
console.log('Engine passed: 520 generated boards; deployment and atomic placement; one-shot, streak, and 3-shot salvo rules; AI visibility; and 240 complete games.');
