import * as THREE from './vendor/three.module.js';
import { FlowField } from './nav.js';

/**
 * All enemies are procedural, articulated models built once and pooled.
 * Vertex-colored parts are merged by limb, keeping each actor to eight draws.
 * Their intentionally uneven silhouettes read clearly under the store lights.
 */
const POOL_SIZE = 36;
const TYPES = {
  zombie: { hp: 78, growth: 3, speed: 0.94, damage: 5, cooldown: 1.4, radius: 0.30, points: 100, wear: 0.055 },
  runner: { hp: 56, growth: 2, speed: 1.62, damage: 4, cooldown: 1.22, radius: 0.27, points: 140, wear: 0.045 },
  crawler: { hp: 40, growth: 2, speed: 1.9, damage: 3, cooldown: 1.14, radius: 0.27, points: 90, wear: 0.035 },
  brute: { hp: 168, growth: 9, speed: 0.73, damage: 9, cooldown: 1.9, radius: 0.43, points: 260, wear: 0.095 }
};

const sphere = new THREE.SphereGeometry(1, 12, 9);
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
const cone = new THREE.ConeGeometry(1, 1, 8);
const box = new THREE.BoxGeometry(1, 1, 1);
const q = new THREE.Quaternion();
const euler = new THREE.Euler();
const matrix = new THREE.Matrix4();
const temporaryColor = new THREE.Color();

// A small geometry combiner avoids a runtime dependency on BufferGeometryUtils.
class Parts {
  constructor() { this.parts = []; }
  add(shape, color, position, scale, rotation = [0, 0, 0]) {
    this.parts.push({ shape, color, position, scale, rotation });
    return this;
  }
  ball(color, p, s, r) { return this.add(sphere, color, p, s, r); }
  tube(color, p, s, r) { return this.add(cylinder, color, p, s, r); }
  cube(color, p, s, r) { return this.add(box, color, p, s, r); }
  spike(color, p, s, r) { return this.add(cone, color, p, s, r); }
  finish() {
    const positions = [], normals = [], colors = [];
    for (const part of this.parts) {
      const geometry = part.shape.toNonIndexed();
      q.setFromEuler(euler.set(...part.rotation));
      matrix.compose(new THREE.Vector3(...part.position), q, new THREE.Vector3(...part.scale));
      geometry.applyMatrix4(matrix);
      const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
      temporaryColor.setHex(part.color);
      for (let i = 0; i < p.count; i++) {
        positions.push(p.getX(i), p.getY(i), p.getZ(i));
        normals.push(n.getX(i), n.getY(i), n.getZ(i));
        colors.push(temporaryColor.r, temporaryColor.g, temporaryColor.b);
      }
      geometry.dispose();
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    result.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    result.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    result.computeBoundingSphere();
    return result;
  }
}

function humanoidTemplate(type, variant = 0) {
  const brute = type === 'brute', runner = type === 'runner';
  const skin = brute ? 0x8b8b72 : [0x9aa18c, 0x9c9e8f, 0x949d92][variant % 3];
  const shadow = 0x666b5a;
  const shirt = brute ? 0x303a32 : runner ? 0x663936 : [0xaaa58b, 0x394246, 0x716c5a][variant % 3];
  const trousers = variant === 1 ? 0x343d45 : 0x41433d;
  const dirt = 0x4c4738, stain = 0x54322d;
  const body = new Parts();
  body.ball(trousers, [0, 0.88, 0], [0.255, 0.15, 0.18]);
  body.tube(shirt, [0, 1.14, 0], [0.25, 0.52, 0.18]);
  body.ball(shirt, [0, 1.34, 0.01], [0.285, 0.17, 0.18]);
  body.ball(skin, [0, 1.43, 0.02], [0.205, 0.085, 0.145]);
  body.tube(skin, [0, 1.51, 0.01], [0.085, 0.18, 0.082]);
  // Thin tank-top straps and an uneven, torn hem.
  body.cube(shirt, [-0.185, 1.43, 0.04], [0.067, 0.12, 0.25], [0, 0, 0.12]);
  body.cube(shirt, [0.185, 1.43, 0.04], [0.067, 0.12, 0.25], [0, 0, -0.1]);
  for (let i = 0; i < 7; i++) {
    body.spike(shirt, [(i - 3) * 0.064, 0.885 + Math.sin(i * 2.7) * 0.022, 0.11], [0.047, 0.115, 0.036], [Math.PI, 0, 0.1]);
  }
  body.ball(dirt, [-0.13, 1.18, 0.172], [0.054, 0.132, 0.007], [0, 0, -0.3]);
  body.ball(stain, [0.07, 1.28, 0.181], [0.035, 0.08, 0.009], [0, 0, 0.23]);
  body.ball(dirt, [0.13, 1.01, 0.16], [0.055, 0.04, 0.014]);
  body.cube(0x252b27, [0, 0.91, 0.172], [0.44, 0.045, 0.012]);
  body.cube(0x726d58, [0.025, 0.91, 0.184], [0.049, 0.042, 0.016]);

  const head = new Parts();
  head.ball(skin, [0, 0.015, 0], [0.17, 0.212, 0.161]);
  head.ball(skin, [0, -0.125, 0.025], [0.13, 0.085, 0.141]);
  head.ball(shadow, [-0.103, -0.06, 0.119], [0.034, 0.045, 0.025]);
  head.ball(shadow, [0.103, -0.06, 0.119], [0.034, 0.045, 0.025]);
  head.ball(skin, [-0.173, -0.015, -0.004], [0.027, 0.06, 0.04]);
  head.ball(skin, [0.173, -0.015, -0.004], [0.027, 0.06, 0.04]);
  for (const side of [-1, 1]) {
    head.ball(0x3c4238, [side * 0.066, 0.018, 0.15], [0.048, 0.041, 0.021]);
    head.ball(0xd6d5ae, [side * 0.066, 0.018, 0.17], [0.026, 0.020, 0.014]);
    head.ball(0x4b4433, [side * 0.066, 0.016, 0.183], [0.006, 0.012, 0.004]);
    head.ball(shadow, [side * 0.066, 0.063, 0.139], [0.054, 0.015, 0.021], [0, 0, side * 0.2]);
  }
  head.ball(skin, [0, -0.025, 0.165], [0.032, 0.062, 0.04]);
  head.ball(0x302923, [0, -0.108, 0.145], [0.068, 0.036, 0.023]);
  for (let tooth = 0; tooth < 6; tooth++) {
    head.cube(0xbbb79a, [(tooth - 2.5) * 0.016, -0.093, 0.169], [0.011, 0.018, 0.008], [0, 0, (tooth % 2 ? 0.08 : -0.07)]);
  }
  head.ball(stain, [-0.052, -0.143, 0.137], [0.017, 0.028, 0.007]);
  head.ball(dirt, [0.09, 0.118, 0.115], [0.031, 0.022, 0.012]);
  const hair = variant === 2 ? 0x3b3027 : 0x252b2a;
  head.ball(hair, [0, 0.132, -0.023], [0.176, 0.115, 0.157]);
  const longHair = !brute && (variant !== 2 || runner);
  if (longHair) {
    for (let i = 0; i < 11; i++) {
      const angle = (i / 10) * Math.PI * 1.65 + Math.PI * 0.18;
      const x = Math.sin(angle) * 0.156;
      const z = Math.cos(angle) * 0.136 - 0.028;
      // Keep a clear central opening so the face is visible beneath the hair.
      if (z > 0.065 && Math.abs(x) < 0.095) continue;
      head.ball(hair, [x, -0.028, z], [0.038, 0.22 + (i % 3) * 0.018, 0.037], [0.12 * Math.cos(angle), 0, -0.10 * Math.sin(angle)]);
      head.spike(hair, [x * 1.06, -0.245 - (i % 3) * 0.017, z], [0.039, 0.14, 0.029], [Math.PI, 0, -0.12 * Math.sin(angle)]);
    }
    head.ball(hair, [-0.095, 0.09, 0.125], [0.033, 0.13, 0.027], [0, 0, -0.4]);
  }

  const upper = [], lower = [], legs = [];
  for (const side of [-1, 1]) {
    const arm = new Parts();
    arm.ball(skin, [0, -0.045, 0], [0.105, 0.125, 0.105]);
    arm.tube(skin, [0, -0.19, 0], [0.077, 0.30, 0.074], [0.05, 0, 0]);
    arm.ball(shadow, [side * 0.043, -0.24, 0.047], [0.03, 0.08, 0.024]);
    arm.ball(skin, [0, -0.345, 0], [0.073, 0.073, 0.068]);
    upper.push(arm.finish());
    const forearm = new Parts();
    forearm.tube(skin, [0, -0.145, 0], [0.058, 0.28, 0.061]);
    forearm.ball(shadow, [side * 0.041, -0.12, 0.03], [0.018, 0.073, 0.032]);
    forearm.ball(stain, [-0.014, -0.21, 0.058], [0.026, 0.046, 0.006]);
    forearm.ball(skin, [0, -0.32, 0.014], [0.07, 0.085, 0.038]);
    for (let f = 0; f < 4; f++) {
      const x = (f - 1.5) * 0.032;
      forearm.tube(skin, [x, -0.404 + Math.abs(f - 1.5) * 0.008, 0.03], [0.013, 0.1, 0.015], [-0.19, 0, (f - 1.5) * 0.05]);
      forearm.ball(dirt, [x, -0.45 + Math.abs(f - 1.5) * 0.008, 0.039], [0.012, 0.012, 0.013]);
    }
    forearm.tube(skin, [-side * 0.077, -0.34, 0.035], [0.02, 0.085, 0.021], [0, 0, -side * 0.55]);
    lower.push(forearm.finish());

    const leg = new Parts();
    leg.tube(trousers, [0, -0.20, 0], [0.11, 0.38, 0.115], [0.035, 0, 0]);
    leg.ball(trousers, [0, -0.40, 0.025], [0.105, 0.105, 0.11]);
    leg.tube(trousers, [0, -0.60, -0.002], [0.087, 0.37, 0.094], [-0.04, 0, 0]);
    if (side === 1 || runner) {
      leg.ball(skin, [0.02, -0.43, 0.112], [0.052, 0.063, 0.009]);
      leg.cube(0x606359, [0, -0.5, 0.095], [0.11, 0.021, 0.015], [0, 0, -0.18]);
    }
    leg.ball(0x242a28, [0, -0.79, 0.065], [0.11, 0.093, 0.19]);
    leg.cube(0x171d1b, [0, -0.86, 0.067], [0.21, 0.035, 0.32]);
    leg.cube(0x777363, [0, -0.76, 0.155], [0.095, 0.015, 0.025]);
    leg.cube(0x777363, [0, -0.79, 0.185], [0.095, 0.013, 0.021]);
    legs.push(leg.finish());
  }
  return {
    body: body.finish(), head: head.finish(), upper, lower, legs,
    headPosition: [0, 1.67, 0.035],
    shoulders: [[-0.305, 1.40, 0], [0.305, 1.40, 0]],
    elbows: [[0, -0.35, 0], [0, -0.35, 0]],
    hips: [[-0.135, 0.88, 0], [0.135, 0.88, 0]],
    scale: brute ? [1.37, 1.12, 1.3] : runner ? [0.88, 1.0, 0.90] : [1, 1, 1],
    type
  };
}

function crawlerTemplate() {
  const skin = 0x777f6f, dark = 0x404c44, claw = 0xb4b19a;
  const body = new Parts();
  body.ball(skin, [0, 0.46, -0.035], [0.245, 0.19, 0.43]);
  body.ball(dark, [0, 0.47, -0.28], [0.20, 0.13, 0.20]);
  body.ball(skin, [0, 0.53, 0.20], [0.27, 0.17, 0.25]);
  for (let i = 0; i < 7; i++) {
    body.ball(0x9b9b7f, [0, 0.64 - i * 0.007, 0.22 - i * 0.09], [0.036, 0.037, 0.043]);
    if (i > 1 && i < 5) {
      body.tube(dark, [0, 0.50, 0.24 - i * 0.10], [0.23, 0.015, 0.14], [0, 0, Math.PI / 2]);
    }
  }
  body.tube(skin, [0, 0.38, -0.54], [0.045, 0.30, 0.046], [Math.PI * 0.39, 0, 0]);
  body.spike(skin, [0, 0.29, -0.72], [0.038, 0.25, 0.04], [-Math.PI * 0.65, 0, 0]);
  const head = new Parts();
  head.ball(skin, [0, 0.02, 0.01], [0.17, 0.14, 0.21]);
  head.ball(dark, [0, -0.07, 0.14], [0.145, 0.065, 0.18]);
  head.ball(0x181f1b, [0, -0.055, 0.255], [0.12, 0.04, 0.05]);
  for (const side of [-1, 1]) {
    head.ball(0x2b342c, [side * 0.095, 0.045, 0.17], [0.055, 0.04, 0.04]);
    head.ball(0xd2bd88, [side * 0.098, 0.046, 0.203], [0.024, 0.023, 0.014]);
    head.ball(0x302c24, [side * 0.099, 0.045, 0.215], [0.006, 0.016, 0.003]);
    head.spike(skin, [side * 0.137, 0.15, -0.035], [0.061, 0.19, 0.05], [0.2, 0, -side * 0.25]);
    for (let i = 0; i < 3; i++) {
      head.spike(claw, [side * (0.044 + i * 0.027), -0.052, 0.269 - i * 0.018], [0.013, 0.047, 0.012], [Math.PI, 0, 0]);
    }
  }
  const upper = [], lower = [], legs = [];
  for (const side of [-1, 1]) {
    const a = new Parts();
    a.ball(skin, [0, -0.05, 0], [0.077, 0.105, 0.086]);
    a.tube(skin, [0, -0.135, 0], [0.052, 0.22, 0.051]);
    a.ball(dark, [0, -0.23, 0], [0.058, 0.058, 0.055]);
    upper.push(a.finish());
    const b = new Parts();
    b.tube(skin, [0, -0.10, 0], [0.034, 0.20, 0.037]);
    b.ball(dark, [0, -0.20, 0.045], [0.073, 0.032, 0.09]);
    for (let f = 0; f < 3; f++) {
      b.spike(claw, [(f - 1) * 0.047, -0.20, 0.132], [0.015, 0.12, 0.015], [Math.PI / 2, 0, 0]);
    }
    lower.push(b.finish());
    const leg = new Parts();
    leg.ball(skin, [0, -0.08, -0.02], [0.10, 0.14, 0.115]);
    leg.tube(skin, [0, -0.23, -0.045], [0.043, 0.28, 0.045], [0.22, 0, 0]);
    leg.ball(dark, [0, -0.365, 0.025], [0.077, 0.035, 0.10]);
    for (let f = 0; f < 3; f++) {
      leg.spike(claw, [(f - 1) * 0.046, -0.365, 0.125], [0.014, 0.10, 0.014], [Math.PI / 2, 0, 0]);
    }
    legs.push(leg.finish());
  }
  return {
    body: body.finish(), head: head.finish(), upper, lower, legs,
    headPosition: [0, 0.49, 0.43],
    shoulders: [[-0.24, 0.47, 0.22], [0.24, 0.47, 0.22]],
    elbows: [[0, -0.235, 0], [0, -0.235, 0]],
    hips: [[-0.23, 0.40, -0.31], [0.23, 0.40, -0.31]],
    scale: [1, 1, 1], type: 'crawler'
  };
}

function makeRig(material, template) {
  const root = new THREE.Group();
  const torso = new THREE.Group();
  root.add(torso);
  const body = new THREE.Mesh(template.body, material);
  const head = new THREE.Mesh(template.head, material);
  body.name = 'enemy-torso';
  head.name = 'enemy-head';
  head.userData.head = true;
  torso.add(body, head);
  const shoulders = [], uppers = [], elbows = [], lowers = [], hips = [], legs = [];
  const meshes = [body, head];
  for (let side = 0; side < 2; side++) {
    const shoulder = new THREE.Group(), elbow = new THREE.Group(), hip = new THREE.Group();
    const upper = new THREE.Mesh(template.upper[side], material);
    const lower = new THREE.Mesh(template.lower[side], material);
    const leg = new THREE.Mesh(template.legs[side], material);
    shoulder.add(upper, elbow); elbow.add(lower); hip.add(leg);
    torso.add(shoulder); root.add(hip);
    shoulders.push(shoulder); uppers.push(upper); elbows.push(elbow);
    lowers.push(lower); hips.push(hip); legs.push(leg);
    meshes.push(upper, lower, leg);
  }
  for (const mesh of meshes) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isEnemy = true;
  }
  return { root, torso, body, head, shoulders, uppers, elbows, lowers, hips, legs, meshes };
}

function assignTemplate(record, template) {
  const rig = record.rig;
  record.template = template;
  rig.root.scale.set(...template.scale);
  rig.torso.position.set(0, 0, 0);
  rig.torso.rotation.set(0, 0, 0);
  rig.body.geometry = template.body;
  rig.head.geometry = template.head;
  rig.head.position.set(...template.headPosition);
  rig.head.rotation.set(0, 0, 0);
  for (let side = 0; side < 2; side++) {
    rig.uppers[side].geometry = template.upper[side];
    rig.lowers[side].geometry = template.lower[side];
    rig.legs[side].geometry = template.legs[side];
    rig.shoulders[side].position.set(...template.shoulders[side]);
    rig.elbows[side].position.set(...template.elbows[side]);
    rig.hips[side].position.set(...template.hips[side]);
    rig.shoulders[side].rotation.set(0, 0, 0);
    rig.elbows[side].rotation.set(0, 0, 0);
    rig.hips[side].rotation.set(0, 0, 0);
  }
}

function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function createEnemySystem(scene, {
  colliders = [], onPlayerDamage = () => {}, onStoreDamage = () => {},
  onKill = () => {}, onImpact = () => {}
} = {}) {
  const navigation = new FlowField(colliders);
  const templates = {
    zombie: [humanoidTemplate('zombie', 0), humanoidTemplate('zombie', 1), humanoidTemplate('zombie', 2)],
    runner: [humanoidTemplate('runner', 0), humanoidTemplate('runner', 1)],
    brute: [humanoidTemplate('brute', 2)],
    crawler: [crawlerTemplate()]
  };
  const pool = [], live = [], rayTargets = [];
  let serial = 0, wearTimer = 0, accumulatedWear = 0;

  for (let i = 0; i < POOL_SIZE; i++) {
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.88, metalness: 0.025,
      emissive: 0x000000, emissiveIntensity: 0
    });
    const rig = makeRig(material, templates.zombie[i % 3]);
    const record = {
      id: i, root: rig.root, position: rig.root.position, rig, material,
      hp: 0, maxHp: 0, type: 'zombie', alive: false, dying: false,
      points: 0, radius: 0.3, phase: i * 2.31, hitFlash: 0, hurtSlow: 0,
      attackCooldown: 0, attackAnimation: 0, deathTime: 0, template: null
    };
    for (const mesh of rig.meshes) mesh.userData.enemy = record;
    rig.root.name = `pooled-enemy-${i}`;
    rig.root.visible = false;
    scene.add(rig.root);
    pool.push(record);
  }

  function removeTargets(enemy) {
    for (const mesh of enemy.rig.meshes) {
      const index = rayTargets.indexOf(mesh);
      if (index >= 0) rayTargets.splice(index, 1);
    }
  }

  function spawn(type = 'zombie', wave = 1, position = { x: 0, z: -18 }) {
    if (!TYPES[type]) type = 'zombie';
    let enemy = pool.find(e => !e.alive && !e.dying);
    // If a wave immediately needs a slot, reclaim its oldest falling corpse.
    if (!enemy) enemy = pool.filter(e => !e.alive).sort((a, b) => b.deathTime - a.deathTime)[0];
    if (!enemy) return null;
    const templateList = templates[type];
    assignTemplate(enemy, templateList[serial++ % templateList.length]);
    const stats = TYPES[type];
    enemy.type = type;
    enemy.stats = stats;
    enemy.maxHp = stats.hp + Math.max(0, wave - 1) * stats.growth;
    enemy.hp = enemy.maxHp;
    enemy.speed = stats.speed * (1 + Math.min(0.24, Math.max(0, wave - 1) * 0.042));
    enemy.radius = stats.radius;
    enemy.points = stats.points;
    enemy.phase = serial * 1.73;
    enemy.hitFlash = 0; enemy.hurtSlow = 0;
    enemy.attackCooldown = 0.45 + (serial % 4) * 0.12;
    enemy.attackAnimation = 0;
    enemy.deathTime = 0;
    enemy.alive = true; enemy.dying = false;
    enemy.root.position.set(Number(position.x) || 0, 0, Number(position.z) || 0);
    navigation.move(enemy.position, 0, 0, enemy.radius);
    enemy.root.rotation.set(0, Math.PI, 0);
    enemy.root.visible = true;
    enemy.material.emissive.setHex(0x000000);
    enemy.material.emissiveIntensity = 0;
    live.push(enemy);
    rayTargets.push(...enemy.rig.meshes);
    pose(enemy, 0, 0);
    enemy.root.updateMatrixWorld(true);
    return enemy;
  }

  function damage(enemy, amount, point) {
    if (!enemy?.alive || !Number.isFinite(amount) || amount <= 0) return false;
    enemy.hp = Math.max(0, enemy.hp - amount);
    enemy.hitFlash = 0.12;
    enemy.hurtSlow = 0.13;
    onImpact(point || enemy.position, 0x984a36);
    if (enemy.hp > 0) return false;
    enemy.alive = false;
    enemy.dying = true;
    enemy.deathTime = 0;
    enemy.deathRoll = (enemy.id % 2 ? 1 : -1) * 0.15;
    const index = live.indexOf(enemy);
    if (index >= 0) live.splice(index, 1);
    removeTargets(enemy);
    onKill(enemy);
    return true;
  }

  function pose(enemy, time, movement) {
    const rig = enemy.rig, crawler = enemy.type === 'crawler';
    const gait = time * enemy.speed * (crawler ? 8 : 5.3) + enemy.phase;
    const step = Math.sin(gait) * movement;
    const attack = Math.sin(Math.min(1, enemy.attackAnimation / 0.44) * Math.PI);
    if (crawler) {
      rig.torso.position.y = Math.abs(step) * 0.026;
      rig.torso.rotation.x = 0.035 + attack * 0.08;
      rig.torso.rotation.z = step * 0.02;
      for (let i = 0; i < 2; i++) {
        const side = i ? 1 : -1;
        rig.shoulders[i].rotation.set(side * step * 0.5 - attack * 0.30, 0, side * 0.22);
        rig.elbows[i].rotation.x = 0.2 + Math.max(0, side * step) * 0.38;
        rig.hips[i].rotation.set(-side * step * 0.5, 0, side * 0.18);
      }
      rig.head.rotation.x = -0.03 - attack * 0.13;
      rig.head.rotation.z = Math.sin(time * 1.7 + enemy.phase) * 0.05;
    } else {
      const runner = enemy.type === 'runner', brute = enemy.type === 'brute';
      rig.torso.position.y = Math.abs(step) * (runner ? 0.026 : 0.012);
      rig.torso.rotation.x = (runner ? 0.15 : 0.065) + attack * 0.09;
      rig.torso.rotation.z = Math.sin(gait * 0.5) * 0.022;
      rig.head.rotation.x = -0.065 + Math.sin(time * 2.2 + enemy.phase) * 0.035;
      rig.head.rotation.z = Math.sin(time * 1.55 + enemy.phase) * (brute ? 0.025 : 0.07);
      rig.head.rotation.y = Math.sin(time * 0.9 + enemy.phase) * 0.06;
      for (let i = 0; i < 2; i++) {
        const side = i ? 1 : -1;
        rig.hips[i].rotation.x = side * step * (runner ? 0.43 : 0.29);
        rig.hips[i].rotation.z = side * 0.025;
        rig.shoulders[i].rotation.x = -1.03 - (i ? 0.15 : 0) + side * step * 0.12 - attack * 0.38;
        rig.shoulders[i].rotation.z = side * (0.12 + Math.sin(time + enemy.phase) * 0.025);
        rig.elbows[i].rotation.x = -0.22 - (i ? 0 : 0.1) - attack * 0.18;
      }
    }
  }

  function update(dt, time, playerPosition) {
    if (!playerPosition || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.1);
    navigation.update(dt, playerPosition);
    wearTimer += dt;
    for (const enemy of pool) {
      if (!enemy.alive && !enemy.dying) continue;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      enemy.material.emissive.setHex(enemy.hitFlash > 0 ? 0x97432a : 0x000000);
      enemy.material.emissiveIntensity = enemy.hitFlash > 0 ? (enemy.hitFlash / 0.12) * 0.55 : 0;
      if (enemy.dying) {
        enemy.deathTime += dt;
        const fall = Math.min(1, enemy.deathTime / 0.48);
        const eased = 1 - (1 - fall) ** 3;
        enemy.root.rotation.x = -Math.PI * 0.47 * eased;
        enemy.root.rotation.z = enemy.deathRoll * eased;
        enemy.position.y = enemy.deathTime > 0.8 ? -(enemy.deathTime - 0.8) * 1.5 : 0.04 * Math.sin(fall * Math.PI);
        if (enemy.deathTime >= 1.45) {
          enemy.dying = false;
          enemy.root.visible = false;
        }
        continue;
      }
      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
      enemy.attackAnimation = Math.max(0, enemy.attackAnimation - dt);
      enemy.hurtSlow = Math.max(0, enemy.hurtSlow - dt);
      const distance = Math.hypot(playerPosition.x - enemy.position.x, playerPosition.z - enemy.position.z);
      const attackRange = enemy.radius + 0.49;
      const canAttack = distance < attackRange && !navigation.blockedSegment(
        enemy.position.x, enemy.position.z, playerPosition.x, playerPosition.z, 0.035
      );
      let movement = canAttack ? 0 : 1;
      let dx = 0, dz = 0;
      if (!canAttack) {
        const direction = navigation.steer(enemy.position, playerPosition);
        dx = direction.x; dz = direction.z;
        // Soft crowd separation lets a group enter through the same doorway.
        let separationX = 0, separationZ = 0;
        for (const other of live) {
          if (other === enemy) continue;
          const vx = enemy.position.x - other.position.x;
          const vz = enemy.position.z - other.position.z;
          const squared = vx * vx + vz * vz;
          const radius = enemy.radius + other.radius + 0.16;
          if (squared >= radius * radius) continue;
          if (squared < 0.000001) {
            separationX += Math.sin(enemy.phase) * 0.4;
            separationZ += Math.cos(enemy.phase) * 0.4;
          } else {
            const length = Math.sqrt(squared);
            const force = (radius - length) / radius;
            separationX += (vx / length) * force;
            separationZ += (vz / length) * force;
          }
        }
        dx += separationX * 1.25; dz += separationZ * 1.25;
        const length = Math.hypot(dx, dz);
        if (length > 0.01) {
          dx /= length; dz /= length;
          const speed = enemy.speed * (enemy.hurtSlow > 0 ? 0.40 : 1);
          navigation.move(enemy.position, dx * speed * dt, dz * speed * dt, enemy.radius);
        } else {
          movement = 0;
        }
      } else if (enemy.attackCooldown <= 0) {
        enemy.attackCooldown = enemy.stats.cooldown;
        enemy.attackAnimation = 0.44;
        onPlayerDamage(enemy.stats.damage, enemy);
      }
      // Face the target at contact, or the current path while moving around shelves.
      const yaw = canAttack
        ? Math.atan2(playerPosition.x - enemy.position.x, playerPosition.z - enemy.position.z)
        : Math.atan2(dx, dz);
      if (canAttack || movement) enemy.root.rotation.y += wrapAngle(yaw - enemy.root.rotation.y) * (1 - Math.exp(-dt * 6));
      pose(enemy, time, movement);
      if (enemy.position.z > -9.8 && Math.abs(enemy.position.x) < 10) {
        accumulatedWear += enemy.stats.wear * dt;
      }
    }
    if (wearTimer >= 0.5) {
      if (accumulatedWear > 0) onStoreDamage(accumulatedWear);
      wearTimer = 0; accumulatedWear = 0;
    }
  }

  function reset() {
    for (const enemy of pool) {
      enemy.alive = false; enemy.dying = false; enemy.hp = 0;
      enemy.root.visible = false;
      enemy.root.rotation.set(0, 0, 0);
      enemy.root.position.y = 0;
      enemy.material.emissiveIntensity = 0;
    }
    live.length = 0; rayTargets.length = 0;
    wearTimer = 0; accumulatedWear = 0;
    navigation.invalidate();
  }

  function findNearest(position, maxDistance = Infinity) {
    let result = null, best = maxDistance * maxDistance;
    for (const enemy of live) {
      const distance = (position.x - enemy.position.x) ** 2 + (position.z - enemy.position.z) ** 2;
      if (distance < best) { best = distance; result = enemy; }
    }
    return result;
  }

  return {
    spawn, update, damage, reset, findNearest, navigation,
    get activeCount() { return live.length; },
    get targets() { return rayTargets; },
    get active() { return live; },
    get capacity() { return POOL_SIZE; }
  };
}
