/**
 * Small-jet flight model, metres / seconds / radians.
 * Heading zero is north (-Z); positive heading and bank turn right.
 * Positive pitch input raises the nose (map a downward screen stick to it).
 * position is the cockpit reference, 2.2 m above the tyres on the runway.
 *
 * Environment: heightAt(x,z,terrainOnly=false), optional groundHeightAt(x,z),
 * isRunway(x,z), runway.heading, wind:{x,y,z}, onCrash(state), onLand(state).
 * heightAt must include buildings. groundHeightAt may override terrain with a
 * runway deck; landing is restricted to isRunway when that function is given.
 * All collision handling is here, including swept, sub-stepped wing checks.
 */

const PI2 = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const damp = (value, target, rate, dt) => value + (target - value) * (1 - Math.exp(-rate * dt));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const angleDelta = (to, from) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const headingWrap = (value) => (value % PI2 + PI2) % PI2;

export class FlightModel {
  constructor(THREE) {
    this.THREE = THREE;
    this.gearClearance = 2.2;
    this.wingHalfSpan = 4.8;
    this.state = {
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      velocity: new THREE.Vector3(),
      speed: 0,
      altitude: 0,
      agl: 0,
      heading: 0,
      pitch: 0,
      roll: 0,
      verticalSpeed: 0,
      throttle: 0,
      throttleTarget: 0,
      gear: true,
      flaps: 0,
      grounded: false,
      crashed: false,
      stall: false,
      stallAmount: 0,
      onRunway: false,
      gForce: 1,
      time: 0,
      distance: 0,
      landings: 0,
      lastLanding: null,
      crashReason: '',
      impactSpeed: 0,
      controls: { pitch: 0, roll: 0, yaw: 0, brakes: false },
    };
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._previous = new THREE.Vector3();
    this._pitchRate = 0;
    this._rollRate = 0;
    this._turnRate = 0;
    this._velocityHeading = 0;
    this._verticalVelocity = 0;
    this._levelHold = 0;
    this.reset();
  }

  reset(options = {}) {
    const s = this.state;
    const airborne = options.airborne !== false;
    const p = options.position || [0, airborne ? 250 : this.gearClearance, 0];
    if (Array.isArray(p)) s.position.fromArray(p);
    else s.position.copy(p);
    s.heading = headingWrap(finite(options.heading));
    s.pitch = clamp(finite(options.pitch), -45 * DEG, 45 * DEG);
    s.roll = 0;
    s.speed = Math.max(0, finite(options.speed, airborne ? 85 : 0));
    s.throttle = clamp(finite(options.throttle, airborne ? 0.62 : 0), 0, 1);
    s.throttleTarget = s.throttle;
    s.gear = typeof options.gear === 'boolean' ? options.gear : !airborne;
    s.flaps = clamp(finite(options.flaps, airborne ? 0 : 0.3), 0, 1);
    s.altitude = s.position.y;
    s.agl = s.position.y;
    s.verticalSpeed = airborne ? Math.sin(s.pitch) * s.speed : 0;
    s.grounded = !airborne;
    s.onRunway = !airborne;
    s.crashed = false;
    s.stall = false;
    s.stallAmount = 0;
    s.crashReason = '';
    s.impactSpeed = 0;
    s.gForce = 1;
    s.time = 0;
    s.distance = 0;
    s.landings = 0;
    s.lastLanding = null;
    Object.assign(s.controls, { pitch: 0, roll: 0, yaw: 0, brakes: false });
    this._pitchRate = this._rollRate = this._turnRate = 0;
    this._levelHold = 0;
    this._velocityHeading = s.heading;
    this._verticalVelocity = s.verticalSpeed;
    this._setOrientation();
    s.velocity.set(Math.sin(s.heading) * s.speed, s.verticalSpeed, -Math.cos(s.heading) * s.speed);
    return s;
  }

  /** Ease the wings and nose level; it never teleports the aircraft. */
  level() {
    this._levelHold = 2.5;
  }

  update(dt, input = {}, environment = {}) {
    const s = this.state;
    if (s.crashed) return s;
    dt = clamp(finite(dt), 0, 0.12);
    if (!dt) return s;

    s.controls.pitch = clamp(finite(input.pitch), -1, 1);
    s.controls.roll = clamp(finite(input.roll), -1, 1);
    s.controls.yaw = clamp(finite(input.yaw), -1, 1);
    s.controls.brakes = !!input.brakes;
    if (Number.isFinite(input.throttle)) s.throttleTarget = clamp(input.throttle, 0, 1);
    if (typeof input.gear === 'boolean') s.gear = s.grounded ? true : input.gear;
    if (Number.isFinite(input.flaps)) s.flaps = clamp(input.flaps, 0, 1);

    const steps = Math.max(1, Math.ceil(dt * 60), Math.ceil(s.speed * dt / 2.5));
    const step = dt / steps;
    for (let i = 0; i < steps && !s.crashed; i++) {
      this._step(step, input.assist !== false, environment);
    }
    s.altitude = s.position.y;
    s.agl = s.position.y - this._ground(environment, s.position.x, s.position.z);
    return s;
  }

  _setOrientation() {
    const s = this.state;
    // A camera looks along local -Z. Yaw and bank therefore have negative
    // Euler signs for compass-clockwise heading and right-wing-down bank.
    this._euler.set(s.pitch, -s.heading, -s.roll, 'YXZ');
    s.quaternion.setFromEuler(this._euler);
    this._forward.set(0, 0, -1).applyQuaternion(s.quaternion);
    this._right.set(1, 0, 0).applyQuaternion(s.quaternion);
  }

  _height(env, x, z, terrainOnly = false) {
    return typeof env.heightAt === 'function' ? finite(env.heightAt(x, z, terrainOnly)) : 0;
  }

  _ground(env, x, z) {
    if (typeof env.groundHeightAt === 'function') {
      const value = env.groundHeightAt(x, z);
      if (Number.isFinite(value)) return value;
    }
    return this._height(env, x, z, true);
  }

  _onRunway(env, x, z) {
    return typeof env.isRunway === 'function' ? !!env.isRunway(x, z) : true;
  }

  _step(dt, assist, env) {
    const s = this.state;
    const c = s.controls;
    this._previous.copy(s.position);
    s.time += dt;
    s.throttle = damp(s.throttle, s.throttleTarget, 1.8, dt);
    const levelling = this._levelHold > 0;
    this._levelHold = Math.max(0, this._levelHold - dt);
    const pitchInput = levelling ? 0 : c.pitch;
    const rollInput = levelling ? 0 : c.roll;
    const ground = this._ground(env, s.position.x, s.position.z);

    if (s.grounded) {
      // Brakes, rolling drag, steering and a deliberate rotation for takeoff.
      const thrust = 7.2 * s.throttle;
      const drag = 0.55 + 0.00038 * s.speed * s.speed;
      s.speed = Math.max(0, s.speed + (thrust - drag - (c.brakes ? 11 : 0)) * dt);
      const steerAuthority = Math.min(1, s.speed / 9) / (1 + s.speed / 85);
      s.heading = headingWrap(s.heading + (c.yaw * 0.42 + rollInput * 0.19) * steerAuthority * dt);
      this._velocityHeading = s.heading;
      s.roll = damp(s.roll, 0, 8, dt);
      const rotateAuthority = clamp((s.speed - 32) / 28, 0, 1);
      const targetPitch = clamp(pitchInput, -0.2, 1) * 14 * DEG * rotateAuthority;
      s.pitch = damp(s.pitch, targetPitch, 3.2, dt);
      s.verticalSpeed = this._verticalVelocity = 0;
      s.stall = false;
      s.stallAmount = 0;
      s.gForce = 1;
      s.position.y = ground + this.gearClearance;
      const rotateSpeed = 54 - 8 * s.flaps;
      if (s.speed > rotateSpeed && s.pitch > 2.6 * DEG && !c.brakes) {
        s.grounded = false;
        s.position.y += 0.3;
        this._verticalVelocity = Math.max(3, Math.sin(s.pitch) * s.speed);
        s.verticalSpeed = this._verticalVelocity;
      }
    } else {
      const authority = clamp(s.speed / 65, 0.25, 1);
      if (assist || levelling) {
        const targetBank = rollInput * 65 * DEG;
        const targetPitch = pitchInput * 25 * DEG;
        this._rollRate = damp(this._rollRate, clamp((targetBank - s.roll) * 3, -1.25, 1.25) * authority, 7, dt);
        this._pitchRate = damp(this._pitchRate, clamp((targetPitch - s.pitch) * 2.8, -0.55, 0.55) * authority, 6, dt);
      } else {
        this._rollRate = damp(this._rollRate, rollInput * 1.15 * authority, 7, dt);
        this._pitchRate = damp(this._pitchRate, pitchInput * 0.43 * authority, 7, dt);
      }
      s.roll = clamp(s.roll + this._rollRate * dt, -78 * DEG, 78 * DEG);
      s.pitch = clamp(s.pitch + this._pitchRate * dt, -55 * DEG, 60 * DEG);

      const bankLoad = 1 / Math.max(0.3, Math.cos(s.roll));
      const stallSpeed = (49 - 8 * s.flaps) * Math.sqrt(1 + 0.45 * (bankLoad - 1));
      const liftAuthority = clamp((s.speed / stallSpeed) ** 2, 0, 1);
      s.stallAmount = clamp((stallSpeed - s.speed) / (stallSpeed * 0.48), 0, 1);
      s.stall = s.speed < stallSpeed * 0.96;
      const stallSink = 20 * s.stallAmount ** 1.4;
      const bankSink = assist || levelling ? 0 : Math.max(0, bankLoad - 1) * 1.8;
      const desiredVertical = s.speed * Math.sin(s.pitch) * liftAuthority - stallSink - bankSink;
      this._verticalVelocity = damp(this._verticalVelocity, desiredVertical, 2.6, dt);

      const flightPath = Math.atan2(this._verticalVelocity, Math.max(s.speed, 10));
      const drag = (0.26 + 0.00033 * s.speed * s.speed) * (s.gear ? 1.22 : 1)
        + s.flaps * 0.00012 * s.speed * s.speed + 0.22 * (bankLoad - 1);
      const acceleration = 7.2 * s.throttle - drag - 9.81 * Math.sin(flightPath);
      s.speed = clamp(s.speed + acceleration * dt, 5, 175);

      const coordinatedTurn = 9.81 * Math.tan(clamp(s.roll, -70 * DEG, 70 * DEG)) / Math.max(s.speed, 38);
      const desiredTurn = coordinatedTurn * liftAuthority + c.yaw * 0.12 * authority;
      this._turnRate = damp(this._turnRate, desiredTurn, 3.8, dt);
      s.heading = headingWrap(s.heading + this._turnRate * dt);
      this._velocityHeading += angleDelta(s.heading, this._velocityHeading) * (1 - Math.exp(-3.5 * dt));
      s.gForce = damp(s.gForce, clamp(bankLoad + this._pitchRate * s.speed / 9.81, 0.2, 4), 3, dt);
    }

    this._setOrientation();
    const horizontalSpeed = s.speed * Math.cos(Math.atan2(this._verticalVelocity, Math.max(s.speed, 10)));
    const wind = env.wind || {};
    const windX = s.grounded ? 0 : finite(wind.x);
    const windY = s.grounded ? 0 : finite(wind.y);
    const windZ = s.grounded ? 0 : finite(wind.z);
    s.velocity.set(
      Math.sin(this._velocityHeading) * horizontalSpeed + windX,
      s.grounded ? 0 : this._verticalVelocity + windY,
      -Math.cos(this._velocityHeading) * horizontalSpeed + windZ,
    );
    s.position.addScaledVector(s.velocity, dt);
    s.verticalSpeed = s.velocity.y;
    s.distance += Math.hypot(s.velocity.x, s.velocity.z) * dt;
    const nextGround = this._ground(env, s.position.x, s.position.z);
    const runwayNow = this._onRunway(env, s.position.x, s.position.z);

    if (s.grounded) {
      if (s.onRunway && !runwayNow && s.speed > 6) {
        this._crash('Runway excursion', env);
        return;
      }
      s.position.y = nextGround + this.gearClearance;
      s.onRunway = runwayNow;
    } else {
      s.onRunway = runwayNow;
      const clearance = s.gear ? this.gearClearance : 1.1;
      if (s.position.y - clearance <= nextGround) {
        const runwayHeading = env.runway?.heading;
        const headingError = Number.isFinite(runwayHeading)
          ? Math.min(Math.abs(angleDelta(s.heading, runwayHeading)), Math.abs(angleDelta(s.heading, runwayHeading + Math.PI))) : 0;
        const safe = s.gear && runwayNow && Math.abs(s.roll) < 15 * DEG
          && s.pitch > -7 * DEG && s.pitch < 18 * DEG
          && s.verticalSpeed >= -6 && s.verticalSpeed <= 2
          && s.speed < 105 && headingError < 26 * DEG;
        if (safe) {
          s.lastLanding = { speed: s.speed, verticalSpeed: s.verticalSpeed, headingError, time: s.time };
          s.landings++;
          s.grounded = true;
          s.position.y = nextGround + this.gearClearance;
          s.verticalSpeed = this._verticalVelocity = 0;
          this._pitchRate = this._rollRate = this._turnRate = 0;
          s.velocity.y = 0;
          s.stall = false;
          s.stallAmount = 0;
          if (typeof env.onLand === 'function') env.onLand(s);
        } else {
          const reason = !s.gear ? 'Landing gear retracted' : !runwayNow ? 'Terrain contact'
            : s.verticalSpeed < -6 ? 'Hard landing' : Math.abs(s.roll) >= 15 * DEG ? 'Wing strike' : 'Unstable landing';
          this._crash(reason, env);
          return;
        }
      }
    }

    // A height-field sweep is sampled every <= 2.5 m, with wing and nose
    // clearance too. This catches narrow buildings at high jet speeds.
    const p = s.position;
    const r = this._right;
    const f = this._forward;
    const halfSpan = this.wingHalfSpan;
    const bodyHeight = this._height(env, p.x, p.z);
    let hit = p.y - 0.9 <= bodyHeight;
    let hitIsBuilding = hit && bodyHeight > nextGround + 4;
    if (!hit) {
      for (const side of [-1, 1]) {
        const x = p.x + r.x * halfSpan * side;
        const z = p.z + r.z * halfSpan * side;
        const y = p.y + r.y * halfSpan * side - 0.55;
        const obstacleHeight = this._height(env, x, z);
        if (y <= obstacleHeight) {
          hit = true;
          hitIsBuilding = obstacleHeight > this._ground(env, x, z) + 4;
          break;
        }
      }
    }
    if (!hit) {
      const noseY = p.y + f.y * 4.2 - 0.7;
      const noseX = p.x + f.x * 4.2;
      const noseZ = p.z + f.z * 4.2;
      const obstacleHeight = this._height(env, noseX, noseZ);
      hit = noseY <= obstacleHeight;
      hitIsBuilding = hit && obstacleHeight > this._ground(env, noseX, noseZ) + 4;
    }
    if (hit) this._crash(hitIsBuilding ? 'Building collision' : 'Ground or wing contact', env);
  }

  _crash(reason, env) {
    const s = this.state;
    if (s.crashed) return;
    s.impactSpeed = s.speed;
    s.crashReason = reason;
    s.crashed = true;
    // Stop at the last safe sampled position, rather than snapping to a roof.
    s.position.copy(this._previous);
    s.altitude = s.position.y;
    s.speed = 0;
    s.verticalSpeed = this._verticalVelocity = 0;
    s.velocity.set(0, 0, 0);
    if (typeof env.onCrash === 'function') env.onCrash(s);
  }
}

export default FlightModel;
