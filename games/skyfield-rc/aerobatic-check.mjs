// Aerobatic behavior checks against the actual flight model and rendered pose.
import assert from 'node:assert/strict';
import * as THREE from './dist/vendor/three.module.js';
import { AIRCRAFT, FlightModel } from './dist/flight.js';

const TAU = Math.PI * 2;
const wrap = value => Math.atan2(Math.sin(value), Math.cos(value));
const orientation = model => new THREE.Quaternion().setFromEuler(
  new THREE.Euler(model.pitch, -model.yaw, -model.roll, 'YXZ')
);
const direction = (model, axis) => new THREE.Vector3(...axis).applyQuaternion(orientation(model));
const up = model => direction(model, [0, 1, 0]);
const forward = model => direction(model, [0, 0, -1]);
const finiteState = model => [...Object.values(model.position), ...Object.values(model.velocity), model.pitch, model.roll, model.yaw].every(Number.isFinite);
function airframe(aircraft) {
  const model = new FlightModel({ aircraft, assisted: false });
  model.position.y = 160;
  return model;
}

const results = [];
for (const aircraft of Object.keys(AIRCRAFT)) {
  const times = { aircraft };
  for (const axis of ['roll', 'pitch']) for (const sign of [1, -1]) {
    const model = airframe(aircraft);
    const phase = () => axis === 'roll' ? model.roll : Math.atan2(model.forward.y, -model.forward.z);
    let previousPhase = phase(), previousPose = orientation(model), rotation = 0, inverted = false;
    for (let frame = 0; frame < 12 * 60 && rotation * sign < TAU; frame++) {
      model.update(1 / 60, { [axis]: sign, throttle: 1 });
      const pose = orientation(model), angle = phase();
      rotation += wrap(angle - previousPhase);
      previousPhase = angle;
      inverted ||= up(model).y < -0.9;
      assert.ok(finiteState(model), `${aircraft}: ${axis} ${sign} must stay finite`);
      assert.equal(model.crashed, false, `${aircraft}: a maneuver with room below it must remain flyable`);
      assert.ok(previousPose.angleTo(pose) < 0.18, `${aircraft}: the rendered pose must not jump through vertical/inverted flight`);
      assert.ok(forward(model).distanceTo(new THREE.Vector3(model.forward.x, model.forward.y, model.forward.z)) < 1e-9, `${aircraft}: physics and rendered forward axes must agree`);
      previousPose = pose;
    }
    assert.ok(rotation * sign >= TAU, `${aircraft}: full input must complete a 360-degree ${axis} in either direction`);
    assert.equal(inverted, true, `${aircraft}: the maneuver must pass fully inverted`);
    assert.ok(up(model).y > 0.85, `${aircraft}: completing the rotation must bring the wings back upright`);
    times[`${axis}${sign > 0 ? 'Positive' : 'Negative'}`] = +model.time.toFixed(2);
  }

  // A pull while knife-edge must turn toward the aircraft's roof, which points
  // sideways in the world. Euler-angle addition incorrectly pitches skyward.
  for (const bank of [Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const model = airframe(aircraft);
    model.pitch = 0; model.roll = bank;
    const roof = up(model), initialForward = forward(model);
    for (let frame = 0; frame < 12; frame++) model.update(1 / 60, { pitch: 1, throttle: 1 });
    const movement = forward(model).sub(initialForward);
    assert.ok(movement.dot(roof) > 0.05, `${aircraft}: pull must pitch toward the roof at bank ${bank}`);
    if (Math.abs(bank) < Math.PI) assert.ok(Math.abs(movement.y) < 0.025, `${aircraft}: knife-edge pull must not use world-up`);
    else assert.ok(movement.y < -0.05, `${aircraft}: pulling while inverted must lower the nose toward the ground`);
  }

  const inverted = airframe(aircraft);
  inverted.pitch = 0; inverted.roll = Math.PI;
  for (let frame = 0; frame < 6 * 60; frame++) {
    inverted.update(1 / 60, { throttle: inverted.config.startThrottle });
    assert.ok(up(inverted).y < -0.9, `${aircraft}: Acro must not automatically roll upright when the stick is released`);
    assert.equal(inverted.crashed, false, `${aircraft}: inverted flight with height must remain controllable`);
  }

  const recover = airframe(aircraft);
  recover.roll = 2.9; recover.pitch = -0.2;
  let previousPose = orientation(recover);
  for (let frame = 0; frame < 6 * 60; frame++) {
    recover.update(1 / 60, { throttle: 0.8 }, { assisted: true });
    const pose = orientation(recover);
    assert.ok(previousPose.angleTo(pose) < 0.18, `${aircraft}: switching to Easy must recover smoothly, without a pose snap`);
    assert.equal(recover.crashed, false, `${aircraft}: Easy recovery with height must remain flyable`);
    previousPose = pose;
  }
  assert.ok(Math.abs(recover.roll) < 0.02 && up(recover).y > 0.95, `${aircraft}: Easy must recover upright after an inverted maneuver`);

  // Exact vertical starting attitudes exercise the Euler representation's pole
  // while the physical body rotation remains continuous.
  for (const pitch of [Math.PI / 2, -Math.PI / 2]) {
    const model = airframe(aircraft);
    model.pitch = pitch; model.roll = 0.8; model.yaw = -0.6;
    const before = orientation(model);
    model.update(1 / 60, { roll: 0.7, pitch: 0.6, yaw: 0.4, throttle: 0.8 });
    assert.ok(finiteState(model), `${aircraft}: a vertical attitude must not cause a singular state`);
    assert.ok(before.angleTo(orientation(model)) < 0.18, `${aircraft}: body controls must cross either vertical pole continuously`);
  }
  results.push(times);
}

for (const aircraft of ['sport', 'f16', 'glider']) {
  const run = fps => {
    const model = airframe(aircraft);
    for (let frame = 0; frame < 5 * fps; frame++) model.update(1 / fps, { roll: 0.6, pitch: 0.45, yaw: -0.25, throttle: 0.85, gear: 1 }, { wind: 3 });
    return model;
  };
  const slow = run(30), fast = run(60);
  assert.equal(slow.crashed, false);
  assert.equal(fast.crashed, false);
  for (const axis of ['x', 'y', 'z']) assert.ok(Math.abs(slow.position[axis] - fast.position[axis]) < 0.001, `${aircraft}: mixed aerobatic controls must not depend on frame rate`);
  assert.ok(orientation(slow).angleTo(orientation(fast)) < 0.00001, `${aircraft}: aircraft attitude must not depend on frame rate`);
}

console.log('Aerobatic checks passed: all nine aircraft, both-direction 360-degree rolls/loops, body-axis pulls, inverted hold, continuous vertical poses, smooth Easy recovery and 30/60 FPS consistency.');
console.log(JSON.stringify(results));
