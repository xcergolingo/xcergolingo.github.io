/*
 * LAST REWIND — first-person pump-action shotgun.
 * Everything here is procedural. Gameplay/ammunition belong to main.js;
 * this module only renders the weapon and animates its moving parts.
 */
import * as THREE from './vendor/three.module.js';

const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;

// A deterministic canvas finish gives the small model real material variation.
function finish(kind) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d');
  let seed = 7432;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const bases = { wood: '#65412c', metal: '#4b5358', glove: '#726552', sleeve: '#48483b' };
  c.fillStyle = bases[kind];
  c.fillRect(0, 0, 256, 256);
  if (kind === 'wood') {
    for (let i = 0; i < 70; i++) {
      c.strokeStyle = `rgba(${random() > .5 ? '23,12,7' : '179,116,62'},${.06 + random() * .18})`;
      c.lineWidth = .5 + random() * 2;
      c.beginPath();
      const x = random() * 256;
      c.moveTo(x, 0);
      c.bezierCurveTo(x + 22, 80, x - 16, 150, x + random() * 12, 256);
      c.stroke();
    }
  }
  for (let i = 0; i < 5500; i++) {
    const shade = random() > .5 ? '255,242,220' : '7,8,10';
    c.fillStyle = `rgba(${shade},${random() * .11})`;
    const x = random() * 256, y = random() * 256;
    c.fillRect(x, y, kind === 'metal' ? random() * 18 : 1.5, .5 + random() * 2);
  }
  if (kind === 'glove' || kind === 'sleeve') {
    // Dried stains and grime, kept deliberately non-graphic.
    for (let i = 0; i < 27; i++) {
      const x = random() * 256, y = random() * 256;
      c.fillStyle = i % 3 ? 'rgba(59,16,13,.36)' : 'rgba(25,24,16,.3)';
      c.beginPath();
      c.ellipse(x, y, 2 + random() * 18, 2 + random() * 13, random() * 5, 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = 'rgba(203,182,139,.18)';
    c.lineWidth = 1;
    for (let i = 0; i < 256; i += 8) {
      c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 256); c.stroke();
      c.beginPath(); c.moveTo(0, i); c.lineTo(256, i); c.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 2;
  return texture;
}

function softTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const c = canvas.getContext('2d');
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(.23, 'rgba(255,227,151,.9)');
  g.addColorStop(.5, 'rgba(255,130,31,.4)');
  g.addColorStop(1, 'rgba(255,80,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function beveledBox(w, h, d, bevel = .008) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + bevel, -h / 2 + bevel);
  s.lineTo(w / 2 - bevel, -h / 2 + bevel);
  s.lineTo(w / 2 - bevel, h / 2 - bevel);
  s.lineTo(-w / 2 + bevel, h / 2 - bevel);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: d - bevel * 2, bevelEnabled: true,
    bevelSize: bevel, bevelThickness: bevel,
    bevelSegments: 1, steps: 1, curveSegments: 1,
  });
  g.translate(0, 0, -d / 2 + bevel);
  return g;
}

// Merge static pieces by material: a detailed weapon stays inexpensive to draw.
function batch(group) {
  group.updateMatrixWorld(true);
  const inverse = group.matrixWorld.clone().invert();
  const byMaterial = new Map();
  const parts = [];
  group.traverse(o => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    const transform = new THREE.Matrix4().multiplyMatrices(inverse, o.matrixWorld);
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(transform);
    const list = byMaterial.get(o.material) || [];
    list.push(g); byMaterial.set(o.material, list); parts.push(o);
  });
  for (const part of parts) part.removeFromParent();
  for (const [material, list] of byMaterial) {
    const g = new THREE.BufferGeometry();
    for (const key of ['position', 'normal', 'uv']) {
      if (!list.every(p => p.getAttribute(key))) continue;
      const size = list[0].getAttribute(key).itemSize;
      const total = list.reduce((sum, p) => sum + p.getAttribute(key).array.length, 0);
      const values = new Float32Array(total);
      let offset = 0;
      for (const p of list) { values.set(p.getAttribute(key).array, offset); offset += p.getAttribute(key).array.length; }
      g.setAttribute(key, new THREE.BufferAttribute(values, size));
    }
    for (const part of list) part.dispose();
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, material);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    group.add(mesh);
  }
}

export function createWeapon(camera) {
  const group = new THREE.Group();
  group.name = 'Shotgun — first person';
  camera.add(group);

  const metal = new THREE.MeshStandardMaterial({ color: 0x81909a, map: finish('metal'), metalness: .82, roughness: .37 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x70787d, metalness: .87, roughness: .3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x10151a, metalness: .55, roughness: .48 });
  const black = new THREE.MeshStandardMaterial({ color: 0x07090b, roughness: .96 });
  const wood = new THREE.MeshStandardMaterial({ color: 0xbe956b, map: finish('wood'), metalness: .02, roughness: .66 });
  const glove = new THREE.MeshStandardMaterial({ color: 0xd4c6ad, map: finish('glove'), roughness: .98 });
  const gloveDark = new THREE.MeshStandardMaterial({ color: 0x312d29, roughness: .95 });
  const cuff = new THREE.MeshStandardMaterial({ color: 0x776c59, map: finish('sleeve'), roughness: 1 });
  const dirtySkin = new THREE.MeshStandardMaterial({ color: 0x87654f, map: finish('glove'), roughness: .9 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xbfa568, metalness: .72, roughness: .37 });
  const red = new THREE.MeshStandardMaterial({ color: 0x9c2220, roughness: .66 });

  function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
    const o = new THREE.Mesh(geometry, material);
    o.position.set(x, y, z);
    o.frustumCulled = false;
    parent.add(o);
    return o;
  }
  function box(parent, w, h, d, material, x = 0, y = 0, z = 0, bevel = false) {
    return mesh(parent, bevel ? beveledBox(w, h, d) : new THREE.BoxGeometry(w, h, d), material, x, y, z);
  }
  function cylinder(parent, r1, r2, length, material, x, y, z, axis = 'z', segments = 12) {
    const o = mesh(parent, new THREE.CylinderGeometry(r1, r2, length, segments), material, x, y, z);
    if (axis === 'z') o.rotation.x = Math.PI / 2;
    if (axis === 'x') o.rotation.z = Math.PI / 2;
    return o;
  }
  function ellipsoid(parent, radius, scale, material, x, y, z) {
    const o = mesh(parent, new THREE.SphereGeometry(radius, 10, 7), material, x, y, z);
    o.scale.set(...scale);
    return o;
  }

  const fixed = new THREE.Group(); group.add(fixed);
  // Blued receiver, barrel, magazine, action bars, ejection port and sights.
  box(fixed, .126, .135, .34, metal, 0, 0, -.23, true);
  box(fixed, .10, .02, .33, steel, 0, .074, -.235, true);
  cylinder(fixed, .026, .029, .74, metal, 0, .043, -.755);
  cylinder(fixed, .023, .026, .72, metal, 0, -.032, -.72);
  cylinder(fixed, .028, .028, .024, steel, 0, -.032, -1.088);
  cylinder(fixed, .0305, .0305, .025, dark, 0, .043, -1.126);
  cylinder(fixed, .021, .021, .002, black, 0, .043, -1.14);
  cylinder(fixed, .016, .016, .003, dark, 0, .043, -1.141);
  box(fixed, .071, .10, .027, metal, 0, .008, -.94, true);
  box(fixed, .018, .022, .027, steel, 0, .079, -1.095);
  ellipsoid(fixed, .009, [1, 1, 1], brass, 0, .095, -1.095);
  box(fixed, .07, .015, .11, dark, 0, .087, -.15);
  box(fixed, .012, .026, .018, steel, -.027, .102, -.14);
  box(fixed, .012, .026, .018, steel, .027, .102, -.14);
  cylinder(fixed, .006, .006, .33, steel, -.041, -.025, -.45);
  cylinder(fixed, .006, .006, .33, steel, .041, -.025, -.45);
  box(fixed, .004, .047, .16, black, .065, .012, -.25);
  box(fixed, .005, .031, .081, steel, .068, .015, -.206);
  cylinder(fixed, .008, .008, .013, dark, .069, -.016, -.107, 'x');
  cylinder(fixed, .008, .008, .013, dark, -.069, -.016, -.107, 'x');
  // Trigger guard and curved black trigger.
  box(fixed, .035, .014, .112, dark, 0, -.15, -.16);
  box(fixed, .035, .078, .014, dark, 0, -.112, -.108);
  box(fixed, .035, .078, .014, dark, 0, -.112, -.212);
  const trigger = box(fixed, .012, .052, .014, steel, 0, -.101, -.16);
  trigger.rotation.x = -.25;

  // Walnut stock tapers naturally from the receiver to a rubber recoil pad.
  const stock = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    -.044,-.018,-.06, .044,-.018,-.06, .044,-.105,-.06, -.044,-.105,-.06,
    -.067,-.08,.36, .067,-.08,.36, .067,-.27,.36, -.067,-.27,.36,
  ]);
  stock.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  stock.setIndex([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,1,2,6,1,6,5,0,4,7,0,7,3]);
  stock.setAttribute('uv', new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1,0,0,1,0,1,1,0,1], 2));
  stock.computeVertexNormals();
  mesh(fixed, stock, wood);
  box(fixed, .145, .199, .035, gloveDark, 0, -.175, .374, true);
  const grip = box(fixed, .095, .17, .095, wood, 0, -.095, -.01, true);
  grip.rotation.x = -.42;
  // Small rubbed metal fasteners and stock checkering.
  for (let i = 0; i < 6; i++) {
    const cut = box(fixed, .003, .0017, .16, dark, -.029 + i * .011, -.065, .15);
    cut.rotation.x = -.15;
  }
  batch(fixed);

  const pump = new THREE.Group(); group.add(pump);
  const foregrip = cylinder(pump, .057, .055, .255, wood, 0, -.029, -.70, 'z', 14);
  foregrip.scale.x = .90; foregrip.scale.z = .84;
  for (let i = 0; i < 11; i++) {
    const rib = mesh(pump, new THREE.TorusGeometry(.053, .0026, 5, 14), dark, 0, -.029, -.813 + i * .022);
    rib.scale.set(.91, .82, 1);
  }
  batch(pump);

  function hand() {
    const h = new THREE.Group();
    ellipsoid(h, .052, [.89, .56, 1.22], glove, 0, 0, 0);
    // Leather knuckle panel, stitched wrist strap and separately shaped fingers.
    ellipsoid(h, .043, [.9, .3, .92], gloveDark, 0, -.025, .008);
    for (let i = 0; i < 4; i++) {
      const x = -.030 + i * .020;
      const finger = cylinder(h, .0098, .0108, .044, glove, x, .011, -.043, 'z', 8);
      finger.rotation.x -= .4;
      ellipsoid(h, .0106, [1, 1, 1.1], glove, x, .018, -.063);
    }
    const thumb = ellipsoid(h, .017, [.77, .88, 1.8], glove, -.043, .012, -.002);
    thumb.rotation.y = -.45;
    cylinder(h, .039, .038, .037, gloveDark, 0, 0, .053);
    cylinder(h, .035, .034, .023, dirtySkin, 0, 0, .078);
    batch(h);
    return h;
  }
  const rightHand = hand();
  rightHand.position.set(.031, -.115, -.037);
  rightHand.rotation.set(-.95, -.1, -.23);
  group.add(rightHand);
  const leftHand = hand();
  leftHand.position.set(-.012, -.103, -.701);
  leftHand.rotation.set(.12, -.18, .22);
  group.add(leftHand);

  // Arms are individual tapered segments; the support arm follows the pump/loader.
  const armGeometry = new THREE.CylinderGeometry(.047, .069, 1, 12);
  const leftArm = mesh(group, armGeometry, cuff);
  const rightArm = mesh(group, armGeometry, cuff);
  const unitY = new THREE.Vector3(0, 1, 0);
  const armDirection = new THREE.Vector3();
  const leftStart = new THREE.Vector3(-.36, -.29, .19);
  const rightStart = new THREE.Vector3(.30, -.26, .22);
  const leftEnd = new THREE.Vector3();
  const rightEnd = new THREE.Vector3(.06, -.14, .03);
  function pointArm(o, start, end) {
    armDirection.subVectors(end, start);
    o.position.copy(start).add(end).multiplyScalar(.5);
    o.scale.y = armDirection.length();
    o.quaternion.setFromUnitVectors(unitY, armDirection.normalize());
  }
  pointArm(rightArm, rightStart, rightEnd);

  // Reload shell is revealed only while the left hand feeds the loading port.
  const reloadShell = new THREE.Group();
  cylinder(reloadShell, .014, .014, .055, red, 0, 0, 0);
  cylinder(reloadShell, .015, .015, .012, brass, 0, 0, .029);
  batch(reloadShell);
  reloadShell.position.set(.003, .029, -.035);
  reloadShell.rotation.x = .2;
  reloadShell.visible = false;
  leftHand.add(reloadShell);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, .043, -1.146);
  group.add(muzzle);
  const flashMaterial = new THREE.MeshBasicMaterial({ color: 0xffa94d, map: softTexture(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(.34, .34), flashMaterial);
  flash.position.z = -.025; muzzle.add(flash); flash.visible = false;
  const flashCore = new THREE.Mesh(new THREE.ConeGeometry(.045, .24, 5), new THREE.MeshBasicMaterial({ color: 0xfff3be, transparent: true, opacity: .86, depthWrite: false, blending: THREE.AdditiveBlending }));
  flashCore.rotation.x = -Math.PI / 2;
  flashCore.position.z = -.12;
  flashCore.visible = false;
  muzzle.add(flashCore);
  const muzzleLight = new THREE.PointLight(0xffb66d, 0, 6, 2);
  muzzle.add(muzzleLight);
  // Local soft fill lets the hands retain detail in the store's dark corners.
  const fill = new THREE.PointLight(0xb9c9c0, .55, 2.3, 2);
  fill.position.set(-.1, .1, .1); group.add(fill);

  const caseRoot = new THREE.Group(); camera.add(caseRoot);
  const casings = Array.from({ length: 8 }, () => {
    const shell = new THREE.Group();
    cylinder(shell, .014, .014, .048, red, 0, 0, 0);
    cylinder(shell, .015, .015, .012, brass, 0, 0, .027);
    batch(shell); shell.visible = false; caseRoot.add(shell);
    return { root: shell, life: 0, velocity: new THREE.Vector3(), spin: new THREE.Vector3() };
  });
  let casingIndex = 0;
  let elapsedShot = 10;
  let ejected = true;
  let recoil = 0;
  let reloadTarget = false;
  let reloadBlend = 0;
  let aimBlend = 0;
  let walkTime = 0;
  const base = new THREE.Vector3(.235, -.258, -.34);

  function eject() {
    const c = casings[casingIndex++ % casings.length];
    c.root.position.copy(group.position).add(new THREE.Vector3(.084, .005, -.22));
    c.root.rotation.set(.6, 0, 0);
    c.velocity.set(.8 + Math.random() * .5, .45 + Math.random() * .3, .25);
    c.spin.set(8, 5, 11);
    c.life = .72;
    c.root.visible = true;
  }

  function fire() {
    elapsedShot = 0;
    recoil = 1;
    ejected = false;
    flash.rotation.z = Math.random() * Math.PI;
    flashCore.rotation.z = Math.random() * Math.PI;
    flash.visible = flashCore.visible = true;
  }

  function update(dt, t, options = {}) {
    const { moving = false, sprinting = false, reloading = reloadTarget, reloadPhase = 0, aiming = false } = options;
    dt = Math.min(dt, .06);
    elapsedShot += dt;
    recoil *= Math.exp(-dt * 16);
    reloadBlend += (Number(reloading) - reloadBlend) * (1 - Math.exp(-dt * 11));
    aimBlend += (Number(aiming) - aimBlend) * (1 - Math.exp(-dt * 10));
    if (moving) walkTime += dt * (sprinting ? 13 : 8.5);
    const bobAmount = moving ? (sprinting ? .013 : .006) : .0015;
    const bob = Math.sin(moving ? walkTime : t * 1.8) * bobAmount;
    group.position.copy(base);
    group.position.x += Math.cos(walkTime * .5) * (moving ? .006 : .001) - aimBlend * .22;
    group.position.y += bob + aimBlend * .10 - reloadBlend * .016;
    group.position.z += recoil * .09 + aimBlend * .04;
    group.rotation.set(recoil * .12 + reloadBlend * .17 + (sprinting ? .04 : 0), -.018 - reloadBlend * .075, -.025 - reloadBlend * .36 + bob * .5);

    // Pump is pulled back and returned after each shot; the support hand follows.
    let pumpSlide = 0;
    if (elapsedShot > .11 && elapsedShot < .46) {
      pumpSlide = Math.sin(((elapsedShot - .11) / .35) * Math.PI) * .12;
    }
    pump.position.z = pumpSlide;
    if (!ejected && elapsedShot >= .20) { eject(); ejected = true; }

    const phase = clamp(reloadPhase, 0, 1);
    const insert = Math.sin(phase * Math.PI);
    leftHand.position.set(
      mix(-.012, -.04 + insert * .036, reloadBlend),
      mix(-.103, -.27 + insert * .11, reloadBlend),
      mix(-.701 + pumpSlide, -.20 - insert * .03, reloadBlend),
    );
    leftHand.rotation.set(mix(.12, -.35 + insert * .3, reloadBlend), mix(-.18, .1, reloadBlend), mix(.22, -.3, reloadBlend));
    reloadShell.visible = reloading && phase < .72 && reloadBlend > .35;
    leftEnd.copy(leftHand.position).add(new THREE.Vector3(0, -.014, .069));
    pointArm(leftArm, leftStart, leftEnd);
    const flashTime = elapsedShot < .065 ? 1 - elapsedShot / .065 : 0;
    flash.visible = flashCore.visible = flashTime > 0;
    flashMaterial.opacity = flashTime * .94;
    muzzleLight.intensity = flashTime * 12;
    if (flashTime > 0) flash.scale.setScalar(.65 + flashTime * .6);

    for (const c of casings) {
      if (c.life <= 0) continue;
      c.life -= dt;
      c.velocity.y -= 2.6 * dt;
      c.root.position.addScaledVector(c.velocity, dt);
      c.root.rotation.x += c.spin.x * dt;
      c.root.rotation.y += c.spin.y * dt;
      c.root.rotation.z += c.spin.z * dt;
      if (c.life <= 0) c.root.visible = false;
    }
  }

  function reset() {
    elapsedShot = 10; ejected = true; recoil = 0;
    reloadTarget = false; reloadBlend = aimBlend = walkTime = 0;
    for (const c of casings) { c.life = 0; c.root.visible = false; }
    reloadShell.visible = flash.visible = flashCore.visible = false;
    muzzleLight.intensity = 0;
    update(0, 0);
  }
  reset();
  return { group, muzzle, fire, reload: active => { reloadTarget = !!active; }, update, reset };
}
