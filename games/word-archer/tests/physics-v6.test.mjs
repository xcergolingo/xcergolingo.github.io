import assert from 'node:assert/strict';
import {
  GRAVITY, FIXED_TIMESTEP, launchSpeed, launchVelocity, createArrow,
  scoreHit, stepArrow, predictTrajectory, solvePitchForDistance
} from '../physics-v6.js';

const approx = (actual, expected, epsilon = 1e-8) => assert.ok(Math.abs(actual-expected) < epsilon, `${actual} ≉ ${expected}`);
const target = {index:7, center:{x:0,y:1.7,z:-17}, radius:.95};
const origin = {x:0,y:1.45,z:0};
const speed = launchSpeed(1);
const pitch = solvePitchForDistance(17, .25, speed);
assert.ok(pitch > 0 && pitch < .3);
assert.equal(GRAVITY, 9.81);
assert.equal(launchSpeed(0),12);
assert.equal(launchSpeed(1),44);
assert.equal(launchSpeed(-1),12);
assert.equal(launchSpeed(2),44);
assert.equal(launchSpeed(NaN),12);

const velocity = launchVelocity(0,pitch,speed);
approx(velocity.x,0);
approx(Math.hypot(velocity.x,velocity.y,velocity.z),speed);
assert.ok(velocity.z<0 && velocity.y>0);
assert.ok(launchVelocity(.1,0,30).x>0,'positive yaw points right');
assert.ok(launchVelocity(0,.1,30).y>0,'positive pitch points up');

// A target under the sight is not preselected as a hit before the arrow arrives.
const inFlight = createArrow(origin,velocity);
assert.equal(stepArrow(inFlight,.1,[target]),null);
assert.equal(inFlight.active,true);
assert.ok(inFlight.position.z>-17);
assert.equal(inFlight.targetIndex,undefined);
const actualHit = stepArrow(inFlight,1,[target]);
assert.equal(actualHit.type,'target');
assert.equal(actualHit.targetIndex,7);
assert.equal(actualHit.points,10);
assert.equal(inFlight.active,false);
approx(actualHit.position.z,-17);
approx(actualHit.position.y,1.7);
assert.equal(stepArrow(inFlight,1,[target]),null,'a stuck arrow cannot score twice');

// Holding the same aim with a different draw must change the trajectory.
const full = predictTrajectory(origin,launchVelocity(0,pitch,launchSpeed(1)),[target]);
const weak = predictTrajectory(origin,launchVelocity(0,pitch,launchSpeed(.15)),[target]);
assert.equal(full.impact.type,'target');
assert.equal(weak.impact.type,'ground');
assert.ok(weak.impact.position.z>-17,'weak arrow lands short');
assert.ok(Math.abs(full.impact.position.y-weak.impact.position.y)>1);

// Wide shots stay wide rather than snapping to nearby target centres.
const wide = predictTrajectory(origin,launchVelocity(.15,pitch,speed),[target]);
assert.equal(wide.impact.type,'ground');
assert.ok(wide.points.some(p=>p.z<=-17),'wide arrow crosses the target plane without scoring');
assert.ok(wide.impact.position.x>2);

// Explicit target-circle scoring, including an outside-circle miss.
assert.equal(scoreHit(0,1),10);
assert.equal(scoreHit(.25,1),8);
assert.equal(scoreHit(.55,1),5);
assert.equal(scoreHit(.99,1),1);
assert.equal(scoreHit(1,1),1);
assert.equal(scoreHit(1.01,1),0);
assert.equal(scoreHit(NaN,1),0);
assert.equal(scoreHit(0,0),0);

// Tiny time steps and a large step must land at the same physical point.
const fireWithStep = (dt, wind={x:0,y:0,z:0}) => {
  const arrow=createArrow(origin,velocity);
  let collision;
  for(let i=0;i<2000&&arrow.active;i++)collision=stepArrow(arrow,dt,[target],wind)||collision;
  return collision;
};
const fine = fireWithStep(FIXED_TIMESTEP);
const coarse = fireWithStep(.8);
for(const axis of ['x','y','z'])approx(fine.position[axis],coarse.position[axis]);
approx(fine.age,coarse.age);
assert.equal(fine.points,coarse.points);
for(const axis of ['x','y','z'])approx(full.impact.position[axis],fine.position[axis]);
approx(full.flightTime,fine.age);

// Continuous crossings prevent arrows tunnelling through thin target faces.
const fast=createArrow(origin,launchVelocity(0,pitch,200));
const fastHit=stepArrow(fast,.5,[target]);
assert.equal(fastHit.type,'target');
approx(fastHit.position.z,-17);

// Wind is real acceleration and prediction remains equal to live simulation.
const wind={x:.9,y:0,z:.35};
const windPrediction=predictTrajectory(origin,velocity,[target],wind);
const windActual=fireWithStep(FIXED_TIMESTEP,wind);
assert.equal(windPrediction.impact.type,'target');
assert.ok(windPrediction.impact.position.x>0);
for(const axis of ['x','y','z'])approx(windPrediction.impact.position[axis],windActual.position[axis]);

// A target behind the shooter cannot intercept a forward arrow.
const behind={index:2,center:{x:0,y:1.7,z:2},radius:50};
assert.equal(predictTrajectory(origin,velocity,[behind]).impact.type,'ground');

// Earlier ground collisions take precedence over a farther target.
const low=createArrow({x:0,y:.1,z:0},{x:0,y:-4,z:-40});
assert.equal(stepArrow(low,1,[{center:{x:0,y:-1,z:-3},radius:2}]).type,'ground');
assert.equal(solvePitchForDistance(100,.2,12),null,'unreachable aim has no fake solution');
assert.equal(solvePitchForDistance(0,.2,44),null);

// Prediction is pure and expiration is deterministic.
const originalOrigin=structuredClone(origin),originalVelocity=structuredClone(velocity);
predictTrajectory(origin,velocity,[target]);
assert.deepEqual(origin,originalOrigin);
assert.deepEqual(velocity,originalVelocity);
const expired=createArrow({x:0,y:100,z:0},{x:0,y:0,z:-10},{maxAge:.2});
assert.equal(stepArrow(expired,1,[]).type,'expired');
approx(expired.age,.2);
approx(expired.position.y,100-.5*GRAVITY*.2*.2);

console.log('Word Archer v6: all physical trajectory, collision, power, wind and prediction tests passed.');
