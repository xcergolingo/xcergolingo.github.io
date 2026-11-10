// Meaningful deterministic checks for the game model, with no browser dependency.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from './dist/vendor/three.module.js';
import { createWorld } from './dist/world.js';

const file = new URL('./dist/flight.js', import.meta.url);
const source = fs.readFileSync(file, 'utf8');
const { FlightModel, AIRCRAFT } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

function run(model, seconds, input = {}, options = {}, fps = 60) {
  for (let i = 0; i < Math.round(seconds * fps); i++) model.update(1 / fps, input, options);
  return model;
}

const landingResults = [];
for (const aircraft of Object.keys(AIRCRAFT)) {
  const steady = run(new FlightModel({ aircraft }), 60);
  assert.equal(steady.crashed, false, aircraft + ': neutral assisted flight must survive');
  assert.ok(Math.abs(steady.position.y - 26) < 1, aircraft + ': neutral control should hold roughly level');
  assert.ok(steady.airspeed > AIRCRAFT[aircraft].stallSpeed, aircraft + ': cruising must remain above stall speed');

  const launch = new FlightModel({ aircraft });
  launch.reset({ airborne: false });
  assert.equal(launch.position.y, AIRCRAFT[aircraft].groundClearance, aircraft + ': reset must use the rendered landing-gear height');
  launch.update(1 / 60, {}, { heightAt: () => 4 });
  assert.equal(launch.position.y, 4 + AIRCRAFT[aircraft].groundClearance, aircraft + ': ground handling must respect terrain and landing-gear height');

  const turn = run(new FlightModel({ aircraft }), 10, { roll: 0.5, throttle: 0.65 });
  assert.equal(turn.crashed, false, aircraft + ': a moderate bank must be sustainable');
  assert.ok(Math.abs(turn.position.x) > 5, aircraft + ': bank must change the path');
  assert.ok(Math.abs(turn.position.y - 26) < 2, aircraft + ': assisted turning should compensate lift');

  const windy = run(new FlightModel({ aircraft, wind: 7 }), 20, { throttle: 0.7 });
  assert.ok(Object.values(windy.position).every(Number.isFinite), aircraft + ': gusts must remain numerically stable');
  assert.equal(windy.crashed, false, aircraft + ': moderate wind must remain flyable');

  const gentle = new FlightModel({ aircraft });
  gentle.reset({ airborne: true, gear: 1 });
  gentle.position.y = gentle.config.groundClearance + 0.005;
  gentle.velocity = { x: 0, y: -0.65, z: -(gentle.config.approachSpeed || gentle.config.takeoffSpeed) };
  gentle.pitch = 0.08;
  gentle.update(1 / 60, { throttle: 0 });
  assert.equal(gentle.crashed, false, aircraft + ': gentle touchdown must be accepted');
  assert.equal(gentle.grounded, true, aircraft + ': gentle touchdown must transition to ground handling');
  assert.equal(gentle.landings, 1, aircraft + ': touchdown must be counted once');
  assert.equal(gentle.lastLanding.onRunway, true, aircraft + ': touchdown location must be classified');
  const touchdownZ = gentle.position.z, touchdownTime = gentle.time;
  for (let frame = 0; frame < 8 * 60 && gentle.speed >= 0.05; frame++) {
    gentle.update(1 / 60, { throttle: 0, brake: true });
  }
  assert.ok(gentle.speed < 0.05, aircraft + ': wheel brakes must bring a landed aircraft to rest');
  assert.ok(touchdownZ - gentle.position.z < 80, aircraft + ': a normal approach must leave enough runway to stop');
  assert.equal(gentle.landings, 1, aircraft + ': rolling on the ground must not keep adding landings');
  landingResults.push({ aircraft, approach: gentle.config.approachSpeed || gentle.config.takeoffSpeed, stoppingMetres: +(touchdownZ - gentle.position.z).toFixed(1), stoppingSeconds: +(gentle.time - touchdownTime).toFixed(2) });
}

const jetResults = [];
for (const [aircraft, config] of Object.entries(AIRCRAFT)) {
  if (config.propulsion !== 'jet') {
    const prop = new FlightModel({ aircraft });
    prop.reset({ airborne: false });
    prop.update(1 / 60, { throttle: 0.75, gear: 0 });
    assert.equal(prop.enginePower, 0.75, aircraft + ': existing propeller throttle response must stay immediate');
    assert.equal(prop.gearPosition, 1, aircraft + ': fixed landing gear must stay down');
    continue;
  }

  const engine = new FlightModel({ aircraft });
  engine.reset({ airborne: false });
  const parked = { ...engine.position };
  run(engine, 0.25, { throttle: 1, brake: true, gear: 0 });
  assert.equal(engine.throttle, 1, aircraft + ': throttle command must be reflected immediately');
  assert.ok(engine.enginePower > 0 && engine.enginePower < 0.5, aircraft + ': a cold turbine must spool up before producing full power');
  const earlyThrust = engine.engineThrust;
  while (engine.time < 8 && engine.enginePower < 0.9) engine.update(1 / 60, { throttle: 1, brake: true, gear: 0 });
  const spoolTo90 = engine.time;
  assert.ok(engine.enginePower >= 0.9, aircraft + ': the turbine must reach useful power without an excessive delay');
  assert.ok(engine.engineThrust > earlyThrust * 4, aircraft + ': actual thrust must rise with the turbine spool');
  assert.deepEqual(engine.position, parked, aircraft + ': wheel brakes must hold a stationary jet at takeoff power');
  assert.equal(engine.gearTarget, 1, aircraft + ': a gear-up command must be rejected on the runway');
  assert.equal(engine.gearPosition, 1, aircraft + ': gear must not retract through the ground');
  const powerBeforeCut = engine.enginePower, thrustBeforeCut = engine.engineThrust;
  engine.update(1 / 60, { throttle: 0, brake: true });
  assert.equal(engine.throttle, 0, aircraft + ': a throttle cut must preserve the commanded value');
  assert.ok(engine.enginePower > powerBeforeCut * 0.9, aircraft + ': a throttle cut must not remove turbine inertia instantly');
  assert.ok(engine.engineThrust > thrustBeforeCut * 0.85, aircraft + ': residual thrust must follow actual spool after a throttle cut');
  const cutTime = engine.time;
  while (engine.time - cutTime < 8 && engine.enginePower > 0.1) engine.update(1 / 60, { throttle: 0, brake: true });
  const spoolDown = engine.time - cutTime;
  assert.ok(engine.enginePower <= 0.1, aircraft + ': the turbine must wind down after power is reduced');
  run(engine, 12, { throttle: 0, brake: true });
  assert.equal(engine.enginePower, 0, aircraft + ': an idled turbine must eventually settle to zero');
  assert.deepEqual(engine.position, parked, aircraft + ': holding the brake during spool changes must not creep');

  const straight = run(new FlightModel({ aircraft }), 15, { throttle: config.startThrottle });
  const banked = run(new FlightModel({ aircraft }), 15, { roll: 0.9, throttle: config.startThrottle });
  const climbing = run(new FlightModel({ aircraft }), 6, { pitch: 0.4, throttle: config.startThrottle });
  const specificEnergy = m => 0.5 * m.airspeed ** 2 + 9.81 * m.position.y;
  assert.equal(banked.crashed, false, aircraft + ': tight assisted turns must remain controllable');
  assert.ok(banked.airspeed < straight.airspeed - 1.5, aircraft + ': a tight turn must cost noticeable airspeed at cruise power');
  assert.ok(specificEnergy(banked) < specificEnergy(straight) - 10, aircraft + ': turning drag must cost energy, not merely exchange speed for height');
  assert.ok(climbing.position.y > 34 && climbing.airspeed < config.cruiseSpeed - 3, aircraft + ': a climb at cruise power must exchange airspeed for height');

  let gearSpeedLoss = null;
  if (config.retractableGear) {
    const gear = new FlightModel({ aircraft });
    assert.equal(gear.gearPosition, 0, aircraft + ': an air launch must start with retractable gear up');
    run(gear, 0.25, { gear: 1 });
    assert.ok(gear.gearPosition > 0 && gear.gearPosition < 1, aircraft + ': gear extension must travel instead of teleporting');
    run(gear, 4, {});
    assert.equal(gear.gearPosition, 1, aircraft + ': omitting a gear command must retain the selected target');
    run(gear, 0.25, { gear: 0 });
    assert.ok(gear.gearPosition > 0 && gear.gearPosition < 1, aircraft + ': gear retraction must travel smoothly');
    run(gear, 4, {});
    assert.equal(gear.gearPosition, 0, aircraft + ': the selected retract command must finish');

    const clean = run(new FlightModel({ aircraft }), 18);
    const dirty = run(new FlightModel({ aircraft }), 18, { gear: 1 });
    gearSpeedLoss = clean.airspeed - dirty.airspeed;
    assert.equal(dirty.crashed, false, aircraft + ': lowering the gear at cruise must remain controllable');
    assert.ok(gearSpeedLoss > 2, aircraft + ': extended gear must add useful approach drag');

    for (const extension of [0, 0.5]) {
      const belly = new FlightModel({ aircraft });
      belly.reset({ airborne: true, gear: extension });
      belly.position.y = belly.contactClearance + 0.005;
      belly.velocity = { x: 0, y: -0.65, z: -config.approachSpeed };
      belly.pitch = 0.08;
      belly.update(1 / 60, { throttle: 0 });
      assert.equal(belly.crashed, true, aircraft + ': touching down without extended gear must have a recoverable crash consequence');
      assert.match(belly.crashReason, /gear/i, aircraft + ': the landing consequence must explain how to fix the approach');
      assert.equal(belly.landings, 0, aircraft + ': a belly impact must not count as a safe landing');
      assert.ok(Math.abs(belly.position.y - belly.contactClearance) < 1e-6, aircraft + ': belly contact must use the actual retracted airframe clearance');
      belly.respawn({ airborne: false });
      assert.equal(belly.crashed, false, aircraft + ': a gear-up crash must be recoverable');
      assert.equal(belly.gearPosition, 1, aircraft + ': a runway recovery must restore the landing gear');
    }
  }

  const fastLanding = new FlightModel({ aircraft });
  fastLanding.reset({ airborne: true, gear: 1 });
  fastLanding.position.y = config.groundClearance + 0.005;
  fastLanding.velocity = { x: 0, y: -0.65, z: -(config.landingSpeed + 5) };
  fastLanding.pitch = 0.02;
  fastLanding.update(1 / 60, { throttle: 0 });
  assert.equal(fastLanding.crashed, true, aircraft + ': arriving too fast must require another, slower approach');
  assert.match(fastLanding.crashReason, /too fast/i);
  jetResults.push({ aircraft, cruise: +straight.airspeed.toFixed(1), cruiseThrottle: +config.startThrottle.toFixed(3), spoolTo90Seconds: +spoolTo90.toFixed(2), spoolDownTo10Seconds: +spoolDown.toFixed(2), bankSpeedLoss: +(straight.airspeed - banked.airspeed).toFixed(1), climbSpeedLoss: +(config.cruiseSpeed - climbing.airspeed).toFixed(1), gearSpeedLoss: gearSpeedLoss === null ? null : +gearSpeedLoss.toFixed(1) });
}

const hard = new FlightModel();
hard.position.y = hard.config.groundClearance + 0.12;
hard.velocity.y = -15;
hard.update(1 / 60);
assert.equal(hard.crashed, true, 'hard ground impact must crash');
assert.ok(hard.crashReason.length > 0, 'crash must have a useful reason');
hard.respawn();
assert.equal(hard.crashed, false, 'respawn must restore a playable flight');
assert.ok(hard.position.y >= 18, 'airborne respawn must provide recovery height');

const obstacle = new FlightModel();
obstacle.update(1 / 60, {}, { collisionAt: () => 'Tree collision' });
assert.equal(obstacle.crashed, true, 'obstacle callback must cause collision');
assert.equal(obstacle.crashReason, 'Tree collision', 'collision description must be retained');

const sixty = run(new FlightModel(), 15, { roll: 0.3, pitch: 0.1, throttle: 0.6 }, {}, 60);
const thirty = run(new FlightModel(), 15, { roll: 0.3, pitch: 0.1, throttle: 0.6 }, {}, 30);
for (const axis of ['x', 'y', 'z']) {
  assert.ok(Math.abs(sixty.position[axis] - thirty.position[axis]) < 0.01, 'flight should be independent of rendering frame rate');
}
const turbineSixty = run(new FlightModel({ aircraft: 'f16' }), 8, { roll: 0.3, pitch: 0.1, throttle: 0.75, gear: 1 }, {}, 60);
const turbineThirty = run(new FlightModel({ aircraft: 'f16' }), 8, { roll: 0.3, pitch: 0.1, throttle: 0.75, gear: 1 }, {}, 30);
for (const axis of ['x', 'y', 'z']) assert.ok(Math.abs(turbineSixty.position[axis] - turbineThirty.position[axis]) < 0.01, 'turbine inertia and gear travel must remain independent of rendering frame rate');
assert.ok(Math.abs(turbineSixty.enginePower - turbineThirty.enginePower) < 1e-6);
assert.ok(Math.abs(turbineSixty.gearPosition - turbineThirty.gearPosition) < 1e-6);

const stunts = new FlightModel({ aircraft: 'sport', assisted: false });
stunts.position.y = 160;
let rotation = 0, previous = stunts.roll;
for (let i = 0; i < 120; i++) {
  stunts.update(1 / 60, { roll: 0.85, throttle: 0.8 });
  let change = stunts.roll - previous;
  if (change < -Math.PI) change += Math.PI * 2;
  if (change > Math.PI) change -= Math.PI * 2;
  rotation += change;
  previous = stunts.roll;
}
assert.ok(rotation > Math.PI * 2, 'manual sport aircraft must be able to complete an aileron roll');
assert.equal(stunts.crashed, false, 'an aerobatic roll with height must remain controllable');

const lowSpeed = new FlightModel();
lowSpeed.position.y = 100;
lowSpeed.velocity = { x: 0, y: 0, z: -2 };
lowSpeed.update(1 / 60, { throttle: 0 });
assert.equal(lowSpeed.stalling, true, 'very low airspeed must expose a stall warning');

// Build scenery geometry and collision data without a renderer. This verifies course
// reachability; the no-op canvas text/texture context is not a visual browser test.
const context = { fillRect() {}, fillText() {}, createRadialGradient() { return { addColorStop() {} }; } };
const previousDocument = globalThis.document;
globalThis.document = { createElement() { return { width: 1, height: 1, getContext() { return context; } }; } };
const world = createWorld(new THREE.Scene());
if (previousDocument === undefined) delete globalThis.document;
else globalThis.document = previousDocument;

const takeoffResults = [];
for (const aircraft of Object.keys(AIRCRAFT)) for (const wind of [0, 5]) {
  const runway = new FlightModel({ aircraft, wind });
  runway.reset({ airborne: false });
  const options = { heightAt: world.heightAt, collisionAt: world.collisionAt };
  const parked = { ...runway.position };
  run(runway, 10, { throttle: 0 }, options);
  assert.equal(runway.grounded, true, aircraft + ': idle runway start must remain grounded at wind ' + wind);
  assert.equal(runway.crashed, false, aircraft + ': parked aircraft must clear the scenery');
  assert.deepEqual(runway.position, parked, aircraft + ': zero throttle must not move the parked aircraft');
  assert.equal(runway.groundSpeed, 0, aircraft + ': idle ground speed must be zero');
  assert.equal(runway.throttle, 0, aircraft + ': runway start must not apply power automatically');

  let liftoff = null, climb = null;
  const began = runway.time;
  for (let frame = 0; frame < 20 * 60 && !runway.crashed; frame++) {
    // Build speed with a centered elevator, then pull up with the same positive
    // model pitch input used by the default down/back transmitter control.
    const pitch = runway.grounded && runway.groundSpeed < runway.config.takeoffSpeed ? 0 : 0.55;
    runway.update(1 / 60, { throttle: 1, pitch }, options);
    if (!runway.grounded && !liftoff) {
      liftoff = { distance: 120 - runway.position.z, seconds: runway.time - began };
      assert.ok(Math.abs(runway.position.x) < 10, aircraft + ': liftoff must be within the runway width');
    }
    if (!runway.grounded && runway.altitude >= 10) {
      climb = { distance: 120 - runway.position.z, seconds: runway.time - began };
      break;
    }
  }
  assert.equal(runway.crashed, false, aircraft + ': runway takeoff must clear scenery at wind ' + wind);
  assert.ok(liftoff, aircraft + ': runway takeoff must lift off at wind ' + wind);
  assert.ok(liftoff.distance < 300, aircraft + ': liftoff must precede the far runway edge');
  assert.ok(climb, aircraft + ': takeoff must climb to a safe height at wind ' + wind);
  assert.ok(climb.distance < 300, aircraft + ': climb to 10 m must precede the far runway edge');
  takeoffResults.push({ aircraft, wind, liftoffMetres: +liftoff.distance.toFixed(1), liftoffSeconds: +liftoff.seconds.toFixed(2), tenMetresHighAt: +climb.distance.toFixed(1), climbSeconds: +climb.seconds.toFixed(2) });
}

const app = fs.readFileSync(new URL('./dist/app.js', import.meta.url), 'utf8');
const routeSource = app.match(/const route=(\[[\s\S]*?\])\.map/);
assert.ok(routeSource, 'the app flight course must be available for integration checks');
const route = JSON.parse(routeSource[1]).map(p => new THREE.Vector3(...p));
const gates = route.map((position, i) => ({
  position,
  normal: position.clone().sub(i ? route[i - 1] : new THREE.Vector3(0, 26, 120)).normalize()
}));
const crossingSource = app.match(/function crossedGate\([\s\S]*?\n}/);
assert.ok(crossingSource, 'the app gate-crossing implementation must be available');
const crossedGate = new Function('vA', 'vB', 'vC', crossingSource[0] + '; return crossedGate;')(
  new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()
);
const cap = (v, a, b) => Math.max(a, Math.min(b, v));
const courseResults = [];
for (const aircraft of Object.keys(AIRCRAFT)) for (const wind of [0, 5]) {
  const pilot = new FlightModel({ aircraft, wind });
  const before = new THREE.Vector3(), after = new THREE.Vector3();
  let count = 0, firstLap = 0;
  // Simple point-at-the-next-gate feedback, with ordinary player-equivalent inputs.
  // Passing two laps also verifies imported word lists longer than the 12-gate course.
  for (let frame = 0; frame < 600 * 60 && count < gates.length * 2 && !pilot.crashed; frame++) {
    const gate = gates[count % gates.length];
    const dx = gate.position.x - pilot.position.x;
    const dz = gate.position.z - pilot.position.z;
    const dy = gate.position.y - pilot.position.y;
    const headingError = Math.atan2(dx, -dz) - pilot.yaw;
    const roll = cap(Math.atan2(Math.sin(headingError), Math.cos(headingError)) * 1.8, -1, 1);
    const pitch = cap(Math.atan2(dy, Math.max(15, Math.hypot(dx, dz))) / pilot.config.assistedPitch * 1.15, -0.65, 0.65);
    before.set(pilot.position.x, pilot.position.y, pilot.position.z);
    pilot.update(1 / 60, { roll, pitch, throttle: pilot.config.startThrottle }, {
      heightAt: world.heightAt, collisionAt: world.collisionAt
    });
    after.set(pilot.position.x, pilot.position.y, pilot.position.z);
    if (crossedGate(before, after, gate)) {
      count++;
      if (count === gates.length) firstLap = pilot.time;
    }
  }
  assert.equal(pilot.crashed, false, aircraft + ': the actual course must clear scenery at wind ' + wind);
  assert.equal(count, gates.length * 2, aircraft + ': a basic pilot must be able to complete two actual course laps at wind ' + wind);
  courseResults.push({ aircraft, wind, firstLap: Math.round(firstLap), twoLaps: Math.round(pilot.time) });
}

console.log('Flight checks passed: nine-aircraft steady flight, runway starts, turbine inertia, brake-held spool-up, gear travel and drag, turn/climb energy, soft landings, braking, gear-up/overspeed consequences, crash recovery, timestep consistency and actual course reachability.');
console.log(JSON.stringify({ jets: jetResults, takeoffs: takeoffResults, landings: landingResults, courses: courseResults }));
