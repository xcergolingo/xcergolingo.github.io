/**
 * Word Archer ballistic model. Units are metres, seconds and radians.
 *
 * Targets face +Z; the archer shoots toward -Z. Wind is a constant acceleration
 * in m/s², not a positional correction. There is deliberately no target picking
 * or hit assignment at launch: only a real crossing of a target's circular face
 * produces a hit. Integration and swept collisions use the same exact parabola.
 */
export const GRAVITY = 9.81;
export const FIXED_TIMESTEP = 1 / 120;
export const MAX_FLIGHT_TIME = 8;
const EPSILON = 1e-9;
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const copy = p => ({x: finite(p?.x), y: finite(p?.y), z: finite(p?.z)});

/** Draw fraction 0…1 controls the arrow's actual launch velocity. */
export function launchSpeed(draw) {
  return 12 + 32 * clamp(finite(draw), 0, 1);
}

/** Positive yaw aims right (+X), positive pitch aims upward (+Y). */
export function launchVelocity(yaw, pitch, speed) {
  const horizontal = Math.cos(finite(pitch)) * Math.max(0, finite(speed));
  return {
    x: Math.sin(finite(yaw)) * horizontal,
    y: Math.sin(finite(pitch)) * Math.max(0, finite(speed)),
    z: -Math.cos(finite(yaw)) * horizontal
  };
}

export function createArrow(origin, velocity, options = {}) {
  return {
    position: copy(origin), velocity: copy(velocity), age: 0, active: true,
    groundY: finite(options.groundY),
    maxAge: Math.max(.01, finite(options.maxAge, MAX_FLIGHT_TIME))
  };
}

/** Standard ten-ring scoring. Outside the face is always zero. */
export function scoreHit(distance, radius) {
  if (!Number.isFinite(distance) || distance < 0 || !Number.isFinite(radius) || radius <= 0 || distance > radius + EPSILON) return 0;
  return Math.max(1, 10 - Math.floor(clamp(distance / radius, 0, 1) * 10));
}

/** Positive roots of p + v*t + (a/2)*t² = plane, within this time interval. */
function crossingTimes(position, velocity, acceleration, plane, interval) {
  const c = position - plane;
  if (Math.abs(acceleration) < EPSILON) {
    if (Math.abs(velocity) < EPSILON) return [];
    const t = -c / velocity;
    return t >= -EPSILON && t <= interval + EPSILON ? [clamp(t, 0, interval)] : [];
  }
  const discriminant = velocity * velocity - 2 * acceleration * c;
  if (discriminant < -EPSILON) return [];
  const root = Math.sqrt(Math.max(0, discriminant));
  const times = [(-velocity - root) / acceleration, (-velocity + root) / acceleration]
    .filter(t => t >= -EPSILON && t <= interval + EPSILON)
    .map(t => clamp(t, 0, interval))
    .sort((a, b) => a - b);
  return times.length === 2 && Math.abs(times[0] - times[1]) < EPSILON ? [times[0]] : times;
}

function positionAt(position, velocity, acceleration, t) {
  const halfT2 = .5 * t * t;
  return {
    x: position.x + velocity.x * t + acceleration.x * halfT2,
    y: position.y + velocity.y * t + acceleration.y * halfT2,
    z: position.z + velocity.z * t + acceleration.z * halfT2
  };
}

/**
 * Advance a mutable arrow, returning an impact only when it actually arrives.
 * Arrow: {position:{x,y,z}, velocity:{x,y,z}, age, active, groundY?, maxAge?}
 * Targets: [{center:{x,y,z}, radius, index?}]
 * Event: {type, position, velocity, age, targetIndex?, radialDistance?, points?}
 * If a step crosses both a target and the ground, the earliest collision wins.
 */
export function stepArrow(arrow, dt, targets = [], wind = {x:0,y:0,z:0}) {
  if (!arrow || arrow.active === false || !Number.isFinite(dt) || dt <= 0) return null;
  const p = arrow.position;
  const v = arrow.velocity;
  if (!p || !v) return null;
  const age = Math.max(0, finite(arrow.age));
  const maxAge = Math.max(.01, finite(arrow.maxAge, MAX_FLIGHT_TIME));
  const interval = Math.min(dt, Math.max(0, maxAge - age));
  const acceleration = {x:finite(wind?.x), y:-GRAVITY + finite(wind?.y), z:finite(wind?.z)};
  const groundY = finite(arrow.groundY);
  let collision = null;
  let collisionTime = interval + EPSILON;

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const c = target?.center;
    if (!c || !Number.isFinite(target.radius) || target.radius <= 0) continue;
    for (const t of crossingTimes(p.z, v.z, acceleration.z, c.z, interval)) {
      // A target can only be struck from its front-facing side.
      if (v.z + acceleration.z * t >= -EPSILON || t > collisionTime) continue;
      const point = positionAt(p, v, acceleration, t);
      const radialDistance = Math.hypot(point.x - c.x, point.y - c.y);
      if (radialDistance > target.radius + EPSILON) continue;
      collisionTime = t;
      collision = {
        type:'target', targetIndex:target.index ?? i, position:point,
        radialDistance, points:scoreHit(radialDistance, target.radius),
        normal:{x:0,y:0,z:1}
      };
      break;
    }
  }

  const groundTimes = p.y < groundY - EPSILON ? [0] : crossingTimes(p.y, v.y, acceleration.y, groundY, interval);
  for (const t of groundTimes) {
    if (v.y + acceleration.y * t > EPSILON || t > collisionTime) continue;
    const point = positionAt(p, v, acceleration, t);
    point.y = groundY;
    collisionTime = t;
    collision = {type:'ground', position:point, normal:{x:0,y:1,z:0}};
    break;
  }

  const elapsed = collision ? collisionTime : interval;
  const nextPosition = collision?.position ?? positionAt(p, v, acceleration, elapsed);
  p.x = nextPosition.x; p.y = nextPosition.y; p.z = nextPosition.z;
  v.x += acceleration.x * elapsed;
  v.y += acceleration.y * elapsed;
  v.z += acceleration.z * elapsed;
  arrow.age = age + elapsed;
  arrow.active = true;

  if (!collision && age + dt >= maxAge - EPSILON) collision = {type:'expired', position:copy(p)};
  if (collision) {
    arrow.active = false;
    collision.velocity = copy(v);
    collision.age = arrow.age;
    // The event remains stable even as the caller reuses or clears the arrow.
    collision.position = copy(collision.position);
    return collision;
  }
  return null;
}

/**
 * Predict using exactly the same motion and swept collisions as a fired arrow.
 * This never changes aim or chooses a target. A short or badly aimed draw will
 * visibly land short or wide. Inputs are copied and never mutated.
 */
export function predictTrajectory(origin, velocity, targets = [], wind = {x:0,y:0,z:0}, options = {}) {
  const maxTime = clamp(finite(options.maxTime, MAX_FLIGHT_TIME), .01, 20);
  const dt = clamp(finite(options.dt, 1 / 45), 1 / 240, .25);
  const maxSteps = Math.ceil(maxTime / dt) + 1;
  const arrow = createArrow(origin, velocity, {maxAge:maxTime, groundY:options.groundY});
  const points = [copy(arrow.position)];
  let impact = null;
  for (let step = 0; step < maxSteps && arrow.active; step++) {
    impact = stepArrow(arrow, dt, targets, wind);
    points.push(copy(arrow.position));
    if (impact) break;
  }
  return {points, impact, flightTime:arrow.age};
}

/** Ballistic low/high-arc pitch solution for stationary targets without wind. */
export function solvePitchForDistance(distance, heightDelta, speed, {highArc = false} = {}) {
  if (!Number.isFinite(distance) || distance <= EPSILON || !Number.isFinite(heightDelta) || !Number.isFinite(speed) || speed <= 0) return null;
  const speed2 = speed * speed;
  const discriminant = speed2 * speed2 - GRAVITY * (GRAVITY * distance * distance + 2 * heightDelta * speed2);
  if (discriminant < 0) return null;
  const tanPitch = (speed2 + (highArc ? 1 : -1) * Math.sqrt(discriminant)) / (GRAVITY * distance);
  return Math.atan(tanPitch);
}
