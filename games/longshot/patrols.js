import * as THREE from './vendor/three.module.js';

// The hard-mode actors are small articulated rigs. Their root stays level so
// words, hit effects and the existing target-clear animation share one origin.
export function createPatrolTarget(scene, pad, index, roundIndex = 0) {
  const group = new THREE.Group();
  group.name = `Walking patrol ${pad.lane}`;
  group.position.set(pad.x, pad.y, pad.z);
  const rig = new THREE.Group();
  rig.name = 'Walking character rig';
  group.add(rig);

  let seed = (9137 + index * 104729 + roundIndex * 8191 + Math.round(pad.x * 97 + pad.z * 53)) >>> 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const materials = [];
  const material = (color, extra = {}) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness: .86, metalness: .04, ...extra });
    materials.push(value); return value;
  };
  const jackets = [0xdc723b, 0xdba751, 0x46939a, 0xc16951, 0x849a62, 0x608bb5];
  const skinTones = [0xcf9470, 0x8a563c, 0xe4b38b, 0xa46e4b, 0xbd8761];
  const hairColors = [0x302a26, 0x5b3b28, 0x1f2426, 0xb1a28b];
  const jacket = material(jackets[index % jackets.length], { emissive: jackets[index % jackets.length], emissiveIntensity: .10 });
  const trousers = material(index % 2 ? 0x334451 : 0x36413b);
  const skin = material(skinTones[index % skinTones.length]);
  const hair = material(hairColors[index % hairColors.length]);
  const boots = material(0x202b2f);
  const seam = material(0xe2cc99);
  const coverMaterial = material(0x657779, { metalness: .25 });
  const coverTrim = material(0x2b4047, { metalness: .35 });
  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xffb06a });
  const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x182629, transparent: true, opacity: .20, depthWrite: false });
  materials.push(markerMaterial, shadowMaterial);

  const hitMeshes = [];
  const target = {
    group, rig, hitMeshes, pad, index, alive: true, moving: true,
    hitAge: 0, phase: index * 2.37, materials, kind: 'patrol',
    aimHeight: 2.04, labelHeight: 3.85, guideHeight: 4.15,
  };
  function mesh(parent, geometry, mat, x, y, z, part = 'body', name = '') {
    const value = new THREE.Mesh(geometry, mat);
    value.position.set(x, y, z); value.name = name;
    value.castShadow = false; value.receiveShadow = true;
    parent.add(value);
    if (part) { value.userData.target = target; value.userData.part = part; hitMeshes.push(value); }
    return value;
  }
  const box = (parent, mat, x, y, z, w, h, d, part = 'body', name = '') =>
    mesh(parent, new THREE.BoxGeometry(w, h, d), mat, x, y, z, part, name);
  const joint = (parent, name, x, y, z) => {
    const value = new THREE.Group(); value.name = name; value.position.set(x, y, z); parent.add(value); return value;
  };
  const limb = (parent, mat, length, radius, name) =>
    mesh(parent, new THREE.CapsuleGeometry(radius, Math.max(.01, length - radius * 1.35), 3, 7), mat, 0, -length / 2, 0, 'body', name);

  // Rounded heads, a neck and separate hands/feet make the silhouette readable
  // from the side as the patrol turns. Clothing remains bright at long range.
  const torso = mesh(rig, new THREE.CylinderGeometry(.45, .36, .84, 8), jacket, 0, 1.98, 0, 'body', 'Jacket torso');
  torso.scale.z = .68;
  const zip = box(rig, seam, 0, 1.99, .286, .035, .65, .025, 'body', 'Jacket zip');
  zip.rotation.x = .073;
  box(rig, trousers, 0, 1.43, 0, .73, .32, .49, 'body', 'Hips');
  box(rig, boots, 0, 1.57, 0, .77, .09, .53, 'body', 'Belt');
  mesh(rig, new THREE.CylinderGeometry(.13, .14, .22, 8), skin, 0, 2.44, 0, 'body', 'Neck');
  const head = joint(rig, 'Head turn', 0, 2.76, 0);
  const face = mesh(head, new THREE.SphereGeometry(.292, 10, 8), skin, 0, 0, 0, 'precision', 'Head');
  face.scale.set(.96, 1.12, .92);
  const scalp = mesh(head, new THREE.SphereGeometry(.320, 10, 6, 0, Math.PI * 2, 0, Math.PI * .52), hair, 0, .015, -.005, 'precision', 'Hair');
  scalp.scale.set(.96, 1.12, .94);
  box(head, hair, 0, .035, .258, .39, .055, .025, 'precision', 'Eyes');
  box(head, skin, 0, -.04, .284, .10, .13, .105, 'precision', 'Nose');

  const joints = {};
  const feet = [];
  for (const [side, sign] of [['left', -1], ['right', 1]]) {
    const hip = joint(rig, `${side} hip`, sign * .215, 1.42, 0);
    limb(hip, trousers, .62, .155, `${side} thigh`);
    const knee = joint(hip, `${side} knee`, 0, -.62, 0);
    limb(knee, trousers, .61, .13, `${side} shin`);
    const foot = box(knee, boots, 0, -.66, .09, .32, .27, .52, 'body', `${side} boot`);
    const arm = joint(rig, `${side} arm`, sign * .55, 2.25, .015);
    limb(arm, jacket, .48, .14, `${side} sleeve`);
    const elbow = joint(arm, `${side} elbow`, 0, -.48, 0);
    limb(elbow, jacket, .43, .115, `${side} forearm`);
    mesh(elbow, new THREE.SphereGeometry(.135, 7, 5), skin, 0, -.48, .01, 'body', `${side} hand`);
    arm.rotation.z = sign * .065;
    Object.assign(joints, { [`${side}Hip`]: hip, [`${side}Knee`]: knee, [`${side}Arm`]: arm, [`${side}Elbow`]: elbow });
    feet.push({ hip, knee, foot });
  }
  target.joints = joints;
  const shadow = mesh(group, new THREE.CircleGeometry(.55, 18), shadowMaterial, 0, .012, 0, null, 'Foot shadow');
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.y = .75;
  const marker = mesh(group, new THREE.OctahedronGeometry(.13), markerMaterial, 0, 3.53, 0, null, 'Patrol marker');
  target.marker = marker;
  target.markerHeight = 3.53;

  // A fixed rooftop air-handling unit sits in front of the walking corridor.
  // It blocks real shot rays; the character has room to pass behind and emerge
  // on both sides, and never walks through the unit itself.
  const coverGroup = new THREE.Group();
  coverGroup.name = `Patrol cover ${pad.lane}`;
  coverGroup.position.set(pad.x + (random() - .5) * 1.2, pad.y, pad.z + 1.05);
  const coverMeshes = [];
  function coverBox(mat, x, y, z, w, h, d, solid = true) {
    const value = box(coverGroup, mat, x, y, z, w, h, d, null, 'Rooftop vent');
    value.userData.isPatrolCover = true;
    if (solid) coverMeshes.push(value);
    return value;
  }
  coverBox(coverMaterial, 0, 1.30, 0, 2.05, 2.60, .86);
  coverBox(coverTrim, 0, 2.65, 0, 2.23, .12, 1.02);
  coverBox(coverTrim, 0, 1.40, .444, 1.65, 1.75, .035, false);
  for (const y of [.88, 1.40, 1.92]) coverBox(coverMaterial, 0, y, .474, 1.65, .055, .035, false);
  coverBox(seam, -.87, 1.42, .445, .065, 2.20, .035, false);
  target.coverGroup = coverGroup;
  target.coverMeshes = coverMeshes;
  scene.add(coverGroup, group);

  const span = pad.width * .34;
  const startSide = index % 2 ? -1 : 1;
  group.position.x += startSide * span * (.72 + random() * .18);
  group.position.z -= .30 + random() * 1.25;
  const motion = {
    baseSpeed: 1.05 + roundIndex * .32 + random() * .15,
    speed: 0, pauseRemaining: 0, heading: startSide > 0 ? -Math.PI / 2 : Math.PI / 2,
    stepPhase: index * 1.71, walkAmount: 0, elapsed: index * .37,
    destination: new THREE.Vector3(), side: -startSide,
    decisionIn: 3 + random() * 3, segmentMultiplier: .86 + random() * .30,
    routeBounds: { minX: pad.x - span, maxX: pad.x + span, minZ: pad.z - 1.65, maxZ: pad.z - .25 },
  };
  target.motion = motion;
  function destination() {
    motion.destination.set(pad.x + motion.side * span * (.78 + random() * .22), pad.y, pad.z - .25 - random() * 1.4);
    motion.segmentMultiplier = .86 + random() * .30;
  }
  function pause(reverse = false) {
    motion.pauseRemaining = .32 + random() * Math.max(.35, 1.05 - roundIndex * .18);
    motion.speed = 0;
    if (reverse) { motion.side *= -1; destination(); }
    motion.decisionIn = 2.8 + random() * 3.6;
  }
  destination();
  rig.rotation.y = motion.heading;
  const direction = new THREE.Vector3();

  target.update = (dt) => {
    if (!target.alive) return;
    // A large background-tab delta cannot teleport an actor across its roof.
    dt = Math.min(.1, Math.max(0, dt));
    motion.elapsed += dt;
    let travelled = 0;
    if (motion.pauseRemaining > 0) {
      motion.pauseRemaining = Math.max(0, motion.pauseRemaining - dt);
      motion.speed = 0;
    } else {
      direction.subVectors(motion.destination, group.position); direction.y = 0;
      const distance = direction.length();
      motion.speed = motion.baseSpeed * motion.segmentMultiplier;
      travelled = Math.min(distance, motion.speed * dt);
      if (distance > .0001) {
        direction.multiplyScalar(1 / distance);
        group.position.addScaledVector(direction, travelled);
        const heading = Math.atan2(direction.x, direction.z);
        const turn = Math.atan2(Math.sin(heading - motion.heading), Math.cos(heading - motion.heading));
        motion.heading += turn * Math.min(1, dt * 8);
      }
      if (distance <= travelled + .005) {
        group.position.copy(motion.destination);
        motion.side *= -1; destination(); pause();
      } else {
        motion.decisionIn -= dt;
        if (motion.decisionIn <= 0) pause(random() < .28);
      }
    }
    // Root height is fixed; leg and boot transforms determine a small natural
    // rise/fall while the lower foot stays on the roof instead of sliding below it.
    group.position.y = pad.y;
    motion.walkAmount += ((travelled > 0 ? 1 : 0) - motion.walkAmount) * Math.min(1, dt * 10);
    motion.stepPhase += travelled * Math.PI * 2 / 1.65;
    const swing = Math.sin(motion.stepPhase);
    let lowestSole = Infinity;
    for (let i = 0; i < feet.length; i++) {
      const sign = i ? -1 : 1;
      const stride = swing * sign;
      const { hip, knee, foot } = feet[i];
      hip.rotation.x = stride * .48 * motion.walkAmount;
      knee.rotation.x = (.04 + Math.max(0, stride) * .52) * motion.walkAmount;
      const angle = hip.rotation.x + knee.rotation.x;
      foot.rotation.x = -angle;
      const sole = 1.42 - .62 * Math.cos(hip.rotation.x) - .66 * Math.cos(angle) - .09 * Math.sin(angle) - .135;
      lowestSole = Math.min(lowestSole, sole);
    }
    rig.position.y = .008 - lowestSole;
    rig.rotation.y = motion.heading;
    rig.rotation.z = Math.sin(motion.elapsed * 1.6) * .009 * (1 - motion.walkAmount);
    joints.leftArm.rotation.x = -swing * .35 * motion.walkAmount;
    joints.rightArm.rotation.x = swing * .35 * motion.walkAmount;
    joints.leftElbow.rotation.x = -.12 - Math.max(0, -swing) * .25 * motion.walkAmount;
    joints.rightElbow.rotation.x = -.12 - Math.max(0, swing) * .25 * motion.walkAmount;
    head.rotation.y = Math.sin(motion.elapsed * .75 + index) * .10;
    marker.position.y = target.markerHeight + Math.sin(motion.elapsed * 2.3 + target.phase) * .055;
    marker.rotation.y += dt * 1.4;
  };
  target.update(0);
  return target;
}
