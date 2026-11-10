/*
 * Skyfield's lightweight RC flight model. Distances are metres and time is seconds.
 * A deliberately forgiving game simulation, not a real-aircraft training model.
 * World: +Y up. Heading 0 looks down -Z; +yaw turns right, +pitch noses up,
 * +roll lowers the right wing. A Three.js mesh pointing -Z can use
 * rotation.set(model.pitch, -model.yaw, -model.roll, 'YXZ').
 */

const PI = Math.PI;
const TAU = PI * 2;
const G = 9.81;
const DENSITY = 1.225;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
const wrap = a => ((a + PI) % TAU + TAU) % TAU - PI;
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const length = v => Math.hypot(v.x, v.y, v.z);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

function jetAircraft(profile) {
  const c = {
    propulsion: 'jet', powered: true, retractableGear: true,
    engineSpoolUp: 1.4, engineSpoolDown: 1.7, enginePowerExponent: 1.45,
    gearTravelTime: 2.4, gearDrag: 0.016, bellyClearance: 0.25,
    brakeDeceleration: 4.5, brakeSpeedFactor: 0.18,
    liftZero: 0.045, liftSlope: 4.5, liftMax: 1.20, stallAngle: 0.26,
    assistedBank: 0.98, rollResponse: 7, pitchResponse: 6.5, yawResponse: 4.3,
    ...profile
  };
  // Start an air launch already trimmed, with a running turbine. Its cruise
  // setting is matched to the clean airframe rather than a sudden power boost.
  const q = 0.5 * DENSITY * c.wingArea * c.cruiseSpeed ** 2;
  const cl = c.mass * G / q;
  const alpha = clamp((cl - c.liftZero) / c.liftSlope, -0.12, 0.16);
  const drag = q * (c.drag + c.inducedDrag * cl * cl + Math.sin(alpha) ** 2 * 0.85);
  const thrustFactor = clamp(1 - 0.16 * (c.cruiseSpeed / c.maxSpeed) ** 2, 0.60, 1);
  c.startThrottle = clamp((drag / (Math.cos(alpha) * c.thrust * thrustFactor)) ** (1 / c.enginePowerExponent), 0.1, 0.85);
  return Object.freeze(c);
}

export const AIRCRAFT = Object.freeze({
  trainer: Object.freeze({
    id: 'trainer', name: 'Scout Trainer', label: 'Trainer',
    propulsion: 'prop', retractableGear: false,
    description: 'Stable, forgiving and easy to land.',
    color: '#ed7643', accent: '#f7efe1', wingspan: 2.4,
    mass: 1.65, wingArea: 0.48, thrust: 10.8, groundClearance: 0.61,
    cruiseSpeed: 17, stallSpeed: 7.6, takeoffSpeed: 9.5, maxSpeed: 33,
    startThrottle: 0.44, drag: 0.044, inducedDrag: 0.065,
    liftZero: 0.17, liftSlope: 4.5, liftMax: 1.18, stallAngle: 0.26,
    maxRollRate: 2.55, maxPitchRate: 1.35, assistedPitch: 0.44,
    stability: 0.65, landingSpeed: 20, landingSink: 3.2, powered: true
  }),
  sport: Object.freeze({
    id: 'sport', name: 'Swift Sport', label: 'Sport',
    propulsion: 'prop', retractableGear: false,
    description: 'Fast passes, crisp rolls and full aerobatics.',
    color: '#407cc5', accent: '#f5e8ca', wingspan: 1.9,
    mass: 1.8, wingArea: 0.33, thrust: 17, groundClearance: 0.61,
    cruiseSpeed: 24, stallSpeed: 10.2, takeoffSpeed: 12.6, maxSpeed: 47,
    startThrottle: 0.38, drag: 0.041, inducedDrag: 0.058,
    liftZero: 0.08, liftSlope: 4.7, liftMax: 1.12, stallAngle: 0.24,
    maxRollRate: 4.2, maxPitchRate: 2.25, assistedPitch: 0.60,
    stability: 0.25, landingSpeed: 27, landingSink: 3.1, powered: true
  }),
  glider: Object.freeze({
    id: 'glider', name: 'Albatross Glider', label: 'Glider',
    propulsion: 'prop', retractableGear: false,
    description: 'Long wings, quiet glides and a small recovery motor.',
    color: '#e5c94d', accent: '#f5f0dc', wingspan: 3.5,
    mass: 1.2, wingArea: 0.65, thrust: 4.5, groundClearance: 0.21,
    cruiseSpeed: 13, stallSpeed: 5.6, takeoffSpeed: 7.4, maxSpeed: 30,
    startThrottle: 0.34, drag: 0.022, inducedDrag: 0.035,
    liftZero: 0.22, liftSlope: 4.8, liftMax: 1.28, stallAngle: 0.29,
    maxRollRate: 1.65, maxPitchRate: 1.0, assistedPitch: 0.37,
    stability: 0.85, landingSpeed: 17, landingSink: 2.8, powered: true
  }),
  jet: jetAircraft({
    id: 'jet', name: 'Silver Jet', label: 'Jet',
    description: 'Smooth turbine power, steady turns and fixed landing gear.',
    color: '#b6c6d4', accent: '#384f66', wingspan: 3.7668,
    mass: 3.0, wingArea: 0.40, thrust: 29, groundClearance: 0.75,
    cruiseSpeed: 28, stallSpeed: 11.3, takeoffSpeed: 14.8, approachSpeed: 16, maxSpeed: 52,
    drag: 0.032, inducedDrag: 0.12,
    maxRollRate: 3.1, maxPitchRate: 1.6, assistedPitch: 0.49, assistedBank: 0.94,
    stability: 0.50, landingSpeed: 23.5, landingSink: 2.8,
    engineSpoolUp: 1.25, engineSpoolDown: 1.5, retractableGear: false, gearDrag: 0
  }),
  f16: jetAircraft({
    id: 'f16', name: 'F-16 Viper', label: 'F-16',
    description: 'Crisp rolls, quick direction changes and a fast clean cruise.',
    color: '#8b979c', accent: '#e8ba43', wingspan: 2.9754,
    mass: 3.2, wingArea: 0.34, thrust: 34, groundClearance: 0.5938,
    bellyClearance: 0.39030695945,
    cruiseSpeed: 33, stallSpeed: 12.2, takeoffSpeed: 16.2, approachSpeed: 17.5, maxSpeed: 62,
    drag: 0.029, inducedDrag: 0.14,
    maxRollRate: 4.5, maxPitchRate: 2.2, assistedPitch: 0.57, assistedBank: 1.05,
    stability: 0.30, landingSpeed: 25.5, landingSink: 2.8,
    engineSpoolUp: 1.45, engineSpoolDown: 1.8, rollResponse: 8.2, pitchResponse: 7.5
  }),
  yak130: jetAircraft({
    id: 'yak130', name: 'Yak-130 Trainer', label: 'Yak-130',
    description: 'A steady twin-seat jet with gentle controls and a wider speed margin.',
    color: '#8e9897', accent: '#bf3435', wingspan: 3.60144,
    mass: 3.6, wingArea: 0.47, thrust: 32, groundClearance: 0.673,
    bellyClearance: 0.45497501373,
    cruiseSpeed: 27, stallSpeed: 11.3, takeoffSpeed: 15.2, approachSpeed: 16.5, maxSpeed: 50,
    drag: 0.035, inducedDrag: 0.12,
    maxRollRate: 2.7, maxPitchRate: 1.45, assistedPitch: 0.46, assistedBank: 0.92,
    stability: 0.78, landingSpeed: 24, landingSink: 3.0,
    engineSpoolUp: 1.6, engineSpoolDown: 1.9, gearTravelTime: 2.7, gearDrag: 0.018,
    rollResponse: 6.2, pitchResponse: 6.0
  }),
  'rare-bear': jetAircraft({
    id: 'rare-bear', name: 'Rare Bear 77', label: 'Rare Bear',
    description: 'A lively purple racer with a responsive turbine and energetic rolls.',
    color: '#64328a', accent: '#ed8b35', wingspan: 2.9376,
    mass: 2.65, wingArea: 0.32, thrust: 28, groundClearance: 0.5622,
    bellyClearance: 0.29671821117,
    cruiseSpeed: 29.5, stallSpeed: 11.5, takeoffSpeed: 15.5, approachSpeed: 16.5, maxSpeed: 58,
    drag: 0.026, inducedDrag: 0.16,
    maxRollRate: 4.4, maxPitchRate: 2.15, assistedPitch: 0.56, assistedBank: 1.03,
    stability: 0.33, landingSpeed: 24, landingSink: 2.7,
    engineSpoolUp: 1.1, engineSpoolDown: 1.35, gearTravelTime: 2.0, gearDrag: 0.014,
    rollResponse: 8.5, pitchResponse: 7.6
  }),
  f15: jetAircraft({
    id: 'f15', name: 'F-15 Eagle', label: 'F-15',
    description: 'Twin-turbine climb power with a heavier, composed response.',
    color: '#87969e', accent: '#bf473b', wingspan: 3.3584,
    mass: 4.1, wingArea: 0.43, thrust: 44, groundClearance: 0.725,
    bellyClearance: 0.30099999905,
    cruiseSpeed: 31.5, stallSpeed: 12.5, takeoffSpeed: 16.5, approachSpeed: 18, maxSpeed: 60,
    drag: 0.031, inducedDrag: 0.145,
    maxRollRate: 3.0, maxPitchRate: 1.8, assistedPitch: 0.50, assistedBank: 0.97,
    stability: 0.62, landingSpeed: 26, landingSink: 3.0,
    engineSpoolUp: 1.7, engineSpoolDown: 2.0, gearTravelTime: 2.8, gearDrag: 0.020,
    rollResponse: 5.8, pitchResponse: 5.8, yawResponse: 3.8
  }),
  falcon: jetAircraft({
    id: 'falcon', name: 'Falcon Sport', label: 'Falcon',
    description: 'A clean swept-wing sport jet with precise, quick handling.',
    color: '#22272c', accent: '#e9d62e', wingspan: 2.6037,
    mass: 2.85, wingArea: 0.31, thrust: 29, groundClearance: 0.5035,
    bellyClearance: 0.25505153120,
    cruiseSpeed: 30.5, stallSpeed: 12.0, takeoffSpeed: 15.8, approachSpeed: 17, maxSpeed: 58,
    drag: 0.027, inducedDrag: 0.155,
    maxRollRate: 3.8, maxPitchRate: 1.9, assistedPitch: 0.53, assistedBank: 1.0,
    stability: 0.45, landingSpeed: 24.8, landingSink: 2.8,
    engineSpoolUp: 1.25, engineSpoolDown: 1.55, gearTravelTime: 2.2, gearDrag: 0.015,
    rollResponse: 7.8, pitchResponse: 7.0
  })
});

function basis(yaw, pitch, roll) {
  const sy = Math.sin(yaw), cy = Math.cos(yaw);
  const sp = Math.sin(pitch), cp = Math.cos(pitch);
  const sr = Math.sin(roll), cr = Math.cos(roll);
  return {
    forward: { x: sy * cp, y: sp, z: -cy * cp },
    right: { x: cy * cr + sy * sp * sr, y: -cp * sr, z: sy * cr - cy * sp * sr },
    up: { x: cy * sr - sy * sp * cr, y: cp * cr, z: sy * sr + cy * sp * cr }
  };
}

// Integrate angular velocity about the airframe's own axes. Adding Euler pitch
// directly would pull toward world-up even with the aircraft on its side, and
// couples a roll to the wrong axis near the top of a loop. A normalized local
// quaternion step stays continuous through vertical and inverted attitudes.
// Convert back to the public YXZ angles so existing camera/render code keeps
// using rotation.set(pitch, -yaw, -roll, 'YXZ') without a second pose source.
function rotateBody(model, dt) {
  const sx = Math.sin(model.pitch * 0.5), cx = Math.cos(model.pitch * 0.5);
  const sy = Math.sin(-model.yaw * 0.5), cy = Math.cos(-model.yaw * 0.5);
  const sz = Math.sin(-model.roll * 0.5), cz = Math.cos(-model.roll * 0.5);
  const qx = sx * cy * cz + cx * sy * sz;
  const qy = cx * sy * cz - sx * cy * sz;
  const qz = cx * cy * sz - sx * sy * cz;
  const qw = cx * cy * cz + sx * sy * sz;
  const rate = Math.hypot(model.pitchRate, model.yawRate, model.rollRate);
  if (rate < 1e-12) return;
  const sine = Math.sin(rate * dt * 0.5) / rate;
  const dx = model.pitchRate * sine, dy = -model.yawRate * sine;
  const dz = -model.rollRate * sine, dw = Math.cos(rate * dt * 0.5);
  let x = qx * dw + qw * dx + qy * dz - qz * dy;
  let y = qy * dw + qw * dy + qz * dx - qx * dz;
  let z = qz * dw + qw * dz + qx * dy - qy * dx;
  let w = qw * dw - qx * dx - qy * dy - qz * dz;
  const norm = Math.hypot(x, y, z, w);
  x /= norm; y /= norm; z /= norm; w /= norm;
  const m23 = 2 * (y * z - x * w);
  model.pitch = Math.asin(clamp(-m23, -1, 1));
  if (Math.abs(m23) < 1 - 1e-12) {
    model.yaw = -Math.atan2(2 * (x * z + y * w), 1 - 2 * (x * x + y * y));
    model.roll = -Math.atan2(2 * (x * y + z * w), 1 - 2 * (x * x + z * z));
  } else {
    // Exactly vertical has no unique heading/bank pair. This equivalent pose
    // avoids divisions by cos(pitch); the next body step still uses the same axes.
    model.yaw = -Math.atan2(-2 * (x * z - y * w), 1 - 2 * (y * y + z * z));
    model.roll = 0;
  }
}

export class FlightModel {
  constructor({ aircraft = 'trainer', assisted = true, wind = 0 } = {}) {
    this.aircraft = AIRCRAFT[aircraft] ? aircraft : 'trainer';
    this.config = AIRCRAFT[this.aircraft];
    this.assisted = Boolean(assisted);
    this.wind = clamp(finite(wind), 0, 18);
    this.landings = 0;
    this.reset();
  }

  setAircraft(id) {
    if (!AIRCRAFT[id]) return false;
    this.aircraft = id;
    this.config = AIRCRAFT[id];
    this.reset();
    return true;
  }

  reset({ airborne = true, gear } = {}) {
    const c = this.config;
    // Runway starts are always gear-down. Air launches of retractable models
    // start clean unless a caller explicitly requests extended landing gear.
    this.gearTarget = c.retractableGear && airborne ? clamp(finite(gear, 0), 0, 1) : 1;
    this.gearPosition = this.gearTarget;
    this.position = { x: 0, y: airborne ? 26 : c.groundClearance, z: 120 };
    this.velocity = { x: 0, y: 0, z: airborne ? -c.cruiseSpeed : 0 };
    this.yaw = 0;
    this.roll = 0;
    this.pitch = airborne ? this._trim(c.cruiseSpeed, 0) : 0;
    this.rollRate = 0;
    this.pitchRate = 0;
    this.yawRate = 0;
    this.speed = airborne ? c.cruiseSpeed : 0;
    this.groundSpeed = this.speed;
    this.airspeed = this.speed;
    this.verticalSpeed = 0;
    this.altitude = this.position.y - this.contactClearance;
    this.throttle = airborne ? c.startThrottle : 0;
    this.enginePower = this.throttle;
    this.engineThrust = this._thrustAt(this.speed, !airborne);
    this.grounded = !airborne;
    this.crashed = false;
    this.crashReason = '';
    this.stalling = false;
    this.angleOfAttack = 0;
    this.loadFactor = airborne ? 1 : 0;
    this.windVector = { x: 0, y: 0, z: 0 };
    this.time = 0;
    this.distanceFlown = 0;
    this.lastLanding = null;
    this.lastImpact = null;
    this._airborneTime = airborne ? 5 : 0;
    this._landingCooldown = 0;
    return this;
  }

  respawn(options = {}) { return this.reset(options); }

  get heading() { return (this.yaw * 180 / PI + 360) % 360; }
  get forward() { return basis(this.yaw, this.pitch, this.roll).forward; }
  get contactClearance() {
    const c = this.config;
    return c.retractableGear
      ? c.bellyClearance + (c.groundClearance - c.bellyClearance) * this.gearPosition
      : c.groundClearance;
  }

  _actuatorsStep(dt, input) {
    const c = this.config;
    this.throttle = input.throttle;
    if (c.propulsion === 'jet') {
      const seconds = input.throttle > this.enginePower ? c.engineSpoolUp : c.engineSpoolDown;
      this.enginePower = clamp(damp(this.enginePower, input.throttle, 1 / seconds, dt), 0, 1);
      if (input.throttle === 0 && this.enginePower < 0.0005) this.enginePower = 0;
      if (input.throttle === 1 && this.enginePower > 0.9995) this.enginePower = 1;
    } else this.enginePower = input.throttle;

    if (!c.retractableGear || this.grounded) {
      this.gearTarget = 1;
      this.gearPosition = 1;
    } else {
      this.gearTarget = input.gear;
      const travel = dt / c.gearTravelTime;
      this.gearPosition += clamp(this.gearTarget - this.gearPosition, -travel, travel);
      this.gearPosition = clamp(this.gearPosition, 0, 1);
    }
  }

  _thrustAt(speed, ground = false) {
    const c = this.config;
    if (c.propulsion === 'jet') {
      // Turbine RPM builds before useful thrust. Unlike a propeller, its thrust
      // falls only gently with forward speed; a throttle cut cannot erase spool.
      const available = clamp(1 - 0.16 * (speed / c.maxSpeed) ** 2, 0.60, 1);
      return c.thrust * this.enginePower ** c.enginePowerExponent * available;
    }
    return this.throttle * c.thrust * (ground ? 1 : clamp(1 - speed / (c.maxSpeed * 2.4), 0.48, 1));
  }

  _trim(speed, bank) {
    const c = this.config;
    const qArea = 0.5 * DENSITY * Math.max(speed * speed, 16) * c.wingArea;
    const neededCL = c.mass * G / (qArea * Math.max(0.48, Math.cos(bank)));
    return clamp((neededCL - c.liftZero) / c.liftSlope, -0.12, 0.16);
  }

  _windAt(x, z) {
    const w = this.wind;
    // Gentle crosswind and deterministic gusts; calm really means calm.
    return {
      x: w * (0.88 + 0.10 * Math.sin(this.time * 0.47) + 0.045 * Math.sin(z * 0.007 + this.time * 1.3)),
      y: w * 0.045 * Math.sin(x * 0.01 + this.time * 0.7),
      z: w * (0.34 + 0.09 * Math.sin(this.time * 0.31))
    };
  }

  update(dt, input = {}, options = {}) {
    if (typeof options.assisted === 'boolean') this.assisted = options.assisted;
    if (Number.isFinite(options.wind)) this.wind = clamp(options.wind, 0, 18);
    if (this.crashed) return this;
    dt = clamp(finite(dt), 0, 0.12);
    if (!dt) return this;
    const controls = {
      roll: clamp(finite(input.roll), -1, 1),
      pitch: clamp(finite(input.pitch), -1, 1),
      yaw: clamp(finite(input.yaw), -1, 1),
      throttle: clamp(finite(input.throttle, this.throttle), 0, 1),
      gear: this.grounded ? 1 : clamp(finite(input.gear, this.gearTarget), 0, 1),
      brake: Boolean(input.brake)
    };
    const heightAt = typeof options.heightAt === 'function' ? options.heightAt : () => 0;
    const collisionAt = typeof options.collisionAt === 'function' ? options.collisionAt : null;
    // Substeps keep touch controls, landing checks and aerodynamics stable at low FPS.
    const steps = Math.ceil(dt / (1 / 120));
    const h = dt / steps;
    for (let i = 0; i < steps && !this.crashed; i++) {
      this.time += h;
      this._landingCooldown = Math.max(0, this._landingCooldown - h);
      this._actuatorsStep(h, controls);
      this.windVector = this._windAt(this.position.x, this.position.z);
      if (this.grounded) this._groundStep(h, controls, heightAt);
      else this._airStep(h, controls);

      const ground = finite(heightAt(this.position.x, this.position.z));
      this.altitude = Math.max(0, this.position.y - ground - this.contactClearance);
      if (!this.grounded && this.position.y <= ground + this.contactClearance) {
        this._contact(ground, heightAt);
      }
      if (!this.crashed && collisionAt) {
        const collision = collisionAt(this.position);
        if (collision) this._crash(typeof collision === 'string' ? collision : 'Aircraft hit an obstacle.');
      }
      this.speed = length(this.velocity);
      this.groundSpeed = Math.hypot(this.velocity.x, this.velocity.z);
      this.verticalSpeed = this.velocity.y;
      this.airspeed = Math.hypot(
        this.velocity.x - this.windVector.x,
        this.velocity.y - this.windVector.y,
        this.velocity.z - this.windVector.z
      );
      if (!this.grounded) this.distanceFlown += this.speed * h;
    }
    return this;
  }

  _groundStep(dt, input, heightAt) {
    const c = this.config;
    const jet = c.propulsion === 'jet';
    let speed = Math.hypot(this.velocity.x, this.velocity.z);
    const steering = clamp(input.yaw + input.roll * 0.85, -1, 1);
    this.yawRate = jet
      ? steering * Math.min(0.85, speed * 0.10) / (1 + speed * speed / 400)
      : steering * Math.min(0.95, speed * 0.13);
    this.yaw = wrap(this.yaw + this.yawRate * dt);
    this.roll = damp(this.roll, 0, 12, dt);
    this.rollRate = 0;
    const rotation = Math.max(0, input.pitch) * clamp(speed / c.takeoffSpeed, 0, 1) * 0.26;
    this.pitch = damp(this.pitch, rotation, 7, dt);
    this.pitchRate = 0;
    const q = 0.5 * DENSITY * c.wingArea * speed * speed;
    const onRunway = Math.abs(this.position.x) < 11 && Math.abs(this.position.z) < 182;
    const rolling = (onRunway ? 0.025 : 0.085) * G;
    this.engineThrust = this._thrustAt(speed, true);
    const gearDrag = c.retractableGear ? c.gearDrag * this.gearPosition : 0;
    let acceleration = this.engineThrust / c.mass - q * (c.drag + 0.012 + gearDrag) / c.mass;
    if (speed > 0.01) acceleration -= rolling;
    if (input.brake) acceleration -= (c.brakeDeceleration ?? 5) + speed * (c.brakeSpeedFactor ?? 0.3);
    speed = Math.max(0, speed + acceleration * dt);
    // Static wheel brakes can hold a jet while the turbine spools. Once rolling,
    // power must be reduced early and the aircraft needs a real stopping distance.
    if (jet && input.brake && Math.hypot(this.velocity.x, this.velocity.z) < 0.35) speed = 0;
    this.velocity.x = Math.sin(this.yaw) * speed;
    this.velocity.z = -Math.cos(this.yaw) * speed;
    this.velocity.y = 0;
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y = finite(heightAt(this.position.x, this.position.z)) + c.groundClearance;
    this.stalling = false;
    this.loadFactor = 0;
    this.angleOfAttack = this.pitch;
    this._airborneTime = 0;
    if (speed >= c.takeoffSpeed && input.pitch > 0.10 && !input.brake) {
      this.grounded = false;
      this.position.y += 0.06;
      this.pitch = Math.max(this.pitch, 0.17);
      this.velocity.y = Math.max(0.65, speed * 0.045);
      this._airborneTime = 0;
    }
  }

  _airStep(dt, input) {
    const c = this.config;
    this._airborneTime += dt;
    const air = {
      x: this.velocity.x - this.windVector.x,
      y: this.velocity.y - this.windVector.y,
      z: this.velocity.z - this.windVector.z
    };
    const speed = Math.max(0.1, length(air));
    const trim = this._trim(speed, this.roll);
    const authority = clamp(speed / (c.stallSpeed * 1.4), 0.22, 1.35);
    let wantedRollRate, wantedPitchRate, wantedYawRate;
    if (this.assisted) {
      const targetBank = input.roll * (c.assistedBank ?? 0.93);
      wantedRollRate = clamp(wrap(targetBank - this.roll) * 3.8, -c.maxRollRate, c.maxRollRate);
      let targetPitch = input.pitch * c.assistedPitch + trim;
      const slow = 1 - smoothstep(c.stallSpeed * 0.8, c.stallSpeed * 1.45, speed);
      // Low-speed recovery lowers the nose instead of allowing a stuck nose-high stall.
      if (slow > 0.05) targetPitch = Math.min(targetPitch, 0.10 - slow * 0.35);
      wantedPitchRate = clamp(wrap(targetPitch - this.pitch) * 3.0, -c.maxPitchRate, c.maxPitchRate);
    } else {
      wantedRollRate = input.roll * c.maxRollRate * authority;
      const axes = basis(this.yaw, this.pitch, this.roll);
      const along = dot(air, axes.forward);
      const alpha = Math.atan2(-dot(air, axes.up), along);
      const qArea = 0.5 * DENSITY * Math.max(speed * speed, 16) * c.wingArea;
      // Longitudinal stability follows airflow in body coordinates, including
      // negative lift while inverted. It never rolls the aircraft upright.
      const neededCL = c.mass * G * axes.up.y / qArea;
      const bodyTrim = clamp((neededCL - c.liftZero) / c.liftSlope, -0.16, 0.16);
      const stability = c.stability * (1 - Math.min(1, Math.abs(input.pitch) * 2));
      wantedPitchRate = input.pitch * c.maxPitchRate * authority + clamp(wrap(bodyTrim - alpha), -0.4, 0.4) * stability;
      const sideAngle = Math.atan2(dot(air, axes.right), Math.max(0.1, along));
      const forwardFlow = clamp(along / speed, 0, 1);
      wantedYawRate = input.yaw * 0.8 * authority + sideAngle * forwardFlow * 0.45;
    }
    this.rollRate = damp(this.rollRate, wantedRollRate, c.rollResponse ?? 9, dt);
    this.pitchRate = damp(this.pitchRate, wantedPitchRate, c.pitchResponse ?? 8, dt);
    if (this.assisted) {
      this.roll = wrap(this.roll + this.rollRate * dt);
      this.pitch = wrap(this.pitch + this.pitchRate * dt);
      const cp = Math.cos(this.pitch);
      const actualHeading = this.yaw + (cp < 0 ? PI : 0);
      const flowHeading = Math.atan2(air.x, -air.z);
      const alignment = wrap(flowHeading - actualHeading) * Math.abs(cp) * 0.9;
      const bankTurn = G * Math.sin(this.roll) * cp / Math.max(7, speed)
        / Math.max(0.48, Math.abs(Math.cos(this.roll)));
      this.yawRate = damp(this.yawRate, bankTurn + input.yaw * 0.8 * authority + alignment, c.yawResponse ?? 5, dt);
      this.yaw = wrap(this.yaw + this.yawRate * dt);
    } else {
      this.yawRate = damp(this.yawRate, wantedYawRate, c.yawResponse ?? 5, dt);
      rotateBody(this, dt);
    }

    const axes = basis(this.yaw, this.pitch, this.roll);
    const along = dot(air, axes.forward);
    const vertical = dot(air, axes.up);
    const alpha = Math.atan2(-vertical, along);
    this.angleOfAttack = alpha;
    const stalled = smoothstep(c.stallAngle, c.stallAngle + 0.30, Math.abs(alpha));
    const attachedCL = clamp(c.liftZero + c.liftSlope * alpha, -c.liftMax, c.liftMax);
    const separatedCL = Math.sin(2 * alpha) * 1.08;
    const cl = attachedCL * (1 - stalled) + separatedCL * stalled;
    const qArea = 0.5 * DENSITY * speed * speed * c.wingArea;
    const airDirection = { x: air.x / speed, y: air.y / speed, z: air.z / speed };
    const sideSlip = dot(airDirection, axes.right);
    const upDot = dot(airDirection, axes.up);
    const liftDirection = {
      x: axes.up.x - airDirection.x * upDot,
      y: axes.up.y - airDirection.y * upDot,
      z: axes.up.z - airDirection.z * upDot
    };
    const liftNorm = length(liftDirection);
    const lift = qArea * cl;
    const gearDrag = c.retractableGear ? c.gearDrag * this.gearPosition : 0;
    const cd = c.drag + gearDrag + c.inducedDrag * cl * cl + Math.sin(alpha) ** 2 * 0.85 + sideSlip * sideSlip * 0.30;
    const drag = qArea * cd;
    const sideForce = -qArea * sideSlip * 0.82;
    const thrust = this.engineThrust = this._thrustAt(speed);
    let ax = (axes.forward.x * thrust - airDirection.x * drag + axes.right.x * sideForce) / c.mass;
    let ay = (axes.forward.y * thrust - airDirection.y * drag + axes.right.y * sideForce) / c.mass - G;
    let az = (axes.forward.z * thrust - airDirection.z * drag + axes.right.z * sideForce) / c.mass;
    if (liftNorm > 0.001) {
      const lf = lift / (c.mass * liftNorm);
      ax += liftDirection.x * lf;
      ay += liftDirection.y * lf;
      az += liftDirection.z * lf;
    }
    this.velocity.x += clamp(ax, -120, 120) * dt;
    this.velocity.y += clamp(ay, -120, 120) * dt;
    this.velocity.z += clamp(az, -120, 120) * dt;
    const trueSpeed = length(this.velocity);
    if (trueSpeed > c.maxSpeed * 1.8) {
      const scale = c.maxSpeed * 1.8 / trueSpeed;
      this.velocity.x *= scale;
      this.velocity.y *= scale;
      this.velocity.z *= scale;
    }
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;
    this.loadFactor = lift / (c.mass * G);
    this.stalling = speed < c.stallSpeed * 0.92 || Math.abs(alpha) > c.stallAngle + 0.06;
  }

  _contact(ground, heightAt) {
    const c = this.config;
    const sink = Math.max(0, -this.velocity.y);
    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const sx = finite(heightAt(this.position.x + 1, this.position.z)) - finite(heightAt(this.position.x - 1, this.position.z));
    const sz = finite(heightAt(this.position.x, this.position.z + 1)) - finite(heightAt(this.position.x, this.position.z - 1));
    const slope = Math.hypot(sx, sz) * 0.5;
    this.lastImpact = { sink, speed: horizontalSpeed, roll: this.roll, pitch: this.pitch, gear: this.gearPosition, time: this.time };
    this.position.y = ground + this.contactClearance;
    if (c.retractableGear && this.gearPosition < 0.95) {
      this._crash('Gear-up landing. Extend the landing gear fully before touchdown.');
      return;
    }
    if (sink > c.landingSink || horizontalSpeed > c.landingSpeed + 2
        || Math.abs(this.roll) > 0.52 || this.pitch < -0.20 || this.pitch > 0.48 || slope > 0.58) {
      let reason = 'Hard landing. Try a slower, level approach.';
      if (Math.abs(this.roll) > 0.52) reason = 'Wingtip touched down. Level the wings before landing.';
      else if (this.pitch < -0.20) reason = 'Nose-first landing. Pull up gently on the final approach.';
      else if (horizontalSpeed > c.landingSpeed + 2) reason = 'Landing too fast. Reduce power early for a slower approach.';
      else if (slope > 0.58) reason = 'The hillside is too steep. Aim for the runway or flat grass.';
      this._crash(reason);
      return;
    }
    this.grounded = true;
    this.gearTarget = 1;
    this.gearPosition = 1;
    this.position.y = ground + c.groundClearance;
    this.velocity.y = 0;
    this.rollRate = 0;
    this.pitchRate = 0;
    this.stalling = false;
    this.altitude = 0;
    if (this._airborneTime > 1.5 && this._landingCooldown <= 0) {
      this.landings++;
      this.lastLanding = {
        speed: horizontalSpeed, sink,
        onRunway: Math.abs(this.position.x) < 11 && Math.abs(this.position.z) < 182,
        quality: sink < 0.9 && Math.abs(this.roll) < 0.12 ? 'butter' : sink < 1.9 ? 'smooth' : 'firm',
        time: this.time
      };
      this._landingCooldown = 3;
    }
  }

  _crash(reason) {
    this.crashed = true;
    this.crashReason = reason;
    this.throttle = 0;
    this.enginePower = 0;
    this.engineThrust = 0;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.velocity.z = 0;
    this.speed = 0;
    this.groundSpeed = 0;
    this.verticalSpeed = 0;
    this.rollRate = 0;
    this.pitchRate = 0;
    this.yawRate = 0;
  }
}
