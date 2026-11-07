import * as THREE from './vendor/three.module.js';

// Original procedural characters. Everything here is geometry or a canvas drawing.
const TAU = Math.PI * 2;
const INK = '#181523', CREAM = '#fff0c7', YELLOW = '#f6bd35';
const sphereGeometry = new THREE.SphereGeometry(1, 16, 12);
const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 12);
const sharedGeometries = new Set([sphereGeometry, cylinderGeometry]);
const gradient = new THREE.DataTexture(new Uint8Array([69, 151, 220, 255]), 4, 1, THREE.RedFormat);
gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
gradient.needsUpdate = true;
const materials = new Map();
function toon(color) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshToonMaterial({ color, gradientMap: gradient }));
  return materials.get(color);
}
const inkMaterial = new THREE.ShaderMaterial({
  uniforms: { width: { value: 0.028 }, ink: { value: new THREE.Color(INK) } },
  vertexShader: 'uniform float width; void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position+normal*width,1.0);}',
  fragmentShader: 'uniform vec3 ink; void main(){gl_FragColor=vec4(ink,1.0);}',
  side: THREE.BackSide,
});
function outlined(geometry, material, parent, position, scale, width = 0.028) {
  const mesh = new THREE.Mesh(geometry, typeof material === 'string' ? toon(material) : material);
  if (position) mesh.position.set(...position);
  if (scale) mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const outline = new THREE.Mesh(geometry, inkMaterial);
  outline.name = 'ink outline';
  outline.castShadow = false;
  mesh.add(outline);
  if (width !== 0.028) {
    const custom = inkMaterial.clone();
    custom.uniforms.width.value = width;
    outline.material = custom;
    outline.userData.ownedMaterial = true;
  }
  parent?.add(mesh);
  return mesh;
}
function ball(parent, position, scale, color = CREAM) {
  return outlined(sphereGeometry, color, parent, position, scale);
}
function cylinder(parent, position, scale, color = INK, alongZ = false) {
  const result = outlined(cylinderGeometry, color, parent, position, scale);
  if (alongZ) result.rotation.x = Math.PI / 2;
  return result;
}
function roundedBoxGeometry(w, h, d, radius = 0.05) {
  const geometry = new THREE.BoxGeometry(w, h, d, 4, 4, 4);
  const p = geometry.attributes.position, n = geometry.attributes.normal;
  const ix = w / 2 - radius, iy = h / 2 - radius, iz = d / 2 - radius;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const cx = THREE.MathUtils.clamp(x, -ix, ix), cy = THREE.MathUtils.clamp(y, -iy, iy), cz = THREE.MathUtils.clamp(z, -iz, iz);
    let dx = x - cx, dy = y - cy, dz = z - cz;
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len; dy /= len; dz /= len;
    p.setXYZ(i, cx + dx * radius, cy + dy * radius, cz + dz * radius);
    n.setXYZ(i, dx, dy, dz);
  }
  return geometry;
}
function rounded(parent, position, dimensions, color, radius = 0.045) {
  return outlined(roundedBoxGeometry(...dimensions, radius), color, parent, position);
}
function texture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const result = new THREE.CanvasTexture(canvas);
  result.colorSpace = THREE.SRGBColorSpace;
  result.anisotropy = 4;
  return result;
}
function decal(parent, map, width, height, position) {
  const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, toneMapped: false });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  plane.position.set(...position);
  plane.userData.ownedMaterial = true;
  parent.add(plane);
  return plane;
}

// A tiny dynamic tube rig keeps the entire limb continuous: no elbow or knee joints.
function rubberTube(parent, radius, color, ringCount = 12, sides = 7) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array((ringCount + 1) * (sides + 1) * 3);
  const normals = new Float32Array(positions.length);
  const indices = [];
  for (let i = 0; i < ringCount; i++) for (let j = 0; j < sides; j++) {
    const a = i * (sides + 1) + j, b = a + sides + 1;
    indices.push(a, a + 1, b, b, a + 1, b + 1);
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(indices);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.8, 0), 3);
  const mesh = outlined(geometry, color, parent);
  const tangent = new THREE.Vector3(), normal = new THREE.Vector3(), binormal = new THREE.Vector3();
  function bend(a, b, c, d) {
    for (let i = 0; i <= ringCount; i++) {
      const t = i / ringCount, u = 1 - t;
      const x = u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0];
      const y = u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1];
      const z = u * u * u * a[2] + 3 * u * u * t * b[2] + 3 * u * t * t * c[2] + t * t * t * d[2];
      tangent.set(
        3 * u * u * (b[0] - a[0]) + 6 * u * t * (c[0] - b[0]) + 3 * t * t * (d[0] - c[0]),
        3 * u * u * (b[1] - a[1]) + 6 * u * t * (c[1] - b[1]) + 3 * t * t * (d[1] - c[1]),
        3 * u * u * (b[2] - a[2]) + 6 * u * t * (c[2] - b[2]) + 3 * t * t * (d[2] - c[2])
      ).normalize();
      normal.set(0, 0, 1);
      if (Math.abs(tangent.z) > 0.92) normal.set(1, 0, 0);
      normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
      binormal.crossVectors(tangent, normal).normalize();
      for (let j = 0; j <= sides; j++) {
        const angle = j / sides * TAU;
        const nx = normal.x * Math.cos(angle) + binormal.x * Math.sin(angle);
        const ny = normal.y * Math.cos(angle) + binormal.y * Math.sin(angle);
        const nz = normal.z * Math.cos(angle) + binormal.z * Math.sin(angle);
        const idx = (i * (sides + 1) + j) * 3;
        positions[idx] = x + nx * radius; positions[idx + 1] = y + ny * radius; positions[idx + 2] = z + nz * radius;
        normals[idx] = nx; normals[idx + 1] = ny; normals[idx + 2] = nz;
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.normal.needsUpdate = true;
  }
  return { mesh, bend };
}

let faceMap, stitchMap, chestMap;
function getFaceMap() {
  if (faceMap) return faceMap;
  faceMap = texture(512, 512, c => {
    c.fillStyle = INK;
    // Two tall pie-cut eyes, drawn by hand rather than borrowed character art.
    for (const x of [166, 350]) {
      c.beginPath(); c.ellipse(x, 191, 52, 91, x === 166 ? -0.06 : 0.07, 0, TAU); c.fill();
      c.fillStyle = CREAM;
      c.beginPath(); c.moveTo(x, 190); c.lineTo(x + 57, 127); c.lineTo(x + 64, 194); c.closePath(); c.fill();
      c.fillStyle = INK;
    }
    c.lineWidth = 15; c.lineCap = 'round';
    c.beginPath(); c.moveTo(109, 93); c.quadraticCurveTo(160, 53, 210, 91); c.stroke();
    c.beginPath(); c.moveTo(302, 89); c.quadraticCurveTo(353, 50, 406, 93); c.stroke();
    c.beginPath(); c.ellipse(260, 295, 36, 21, -0.06, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(111, 342); c.bezierCurveTo(173, 383, 335, 383, 403, 333); c.bezierCurveTo(393, 445, 151, 463, 111, 342); c.fill();
    c.fillStyle = CREAM;
    c.beginPath(); c.moveTo(128, 356); c.bezierCurveTo(214, 396, 323, 389, 384, 349); c.lineTo(372, 389); c.bezierCurveTo(281, 424, 195, 419, 143, 389); c.closePath(); c.fill();
    c.strokeStyle = INK; c.lineWidth = 6;
    for (let x = 167; x < 370; x += 39) { c.beginPath(); c.moveTo(x, 374); c.lineTo(x + 2, 417); c.stroke(); }
    c.lineWidth = 7;
    c.beginPath(); c.moveTo(80, 328); c.lineTo(102, 317); c.stroke();
    c.beginPath(); c.moveTo(413, 312); c.lineTo(439, 327); c.stroke();
  });
  return faceMap;
}
function getStitchMap() {
  if (!stitchMap) stitchMap = texture(128, 128, c => {
    c.strokeStyle = INK; c.lineWidth = 8; c.lineCap = 'round';
    for (let x = 30; x <= 98; x += 34) { c.beginPath(); c.moveTo(x, 25); c.quadraticCurveTo(x - 6, 56, x + 2, 88); c.stroke(); }
  });
  return stitchMap;
}
function getChestMap() {
  if (!chestMap) chestMap = texture(256, 256, c => {
    c.fillStyle = INK; c.beginPath(); c.roundRect(35, 21, 186, 206, 27); c.fill();
    c.fillStyle = CREAM; c.beginPath(); c.roundRect(47, 34, 162, 180, 18); c.fill();
    c.fillStyle = INK; c.textAlign = 'center'; c.font = '900 36px Arial'; c.fillText('TIN / 01', 128, 77);
    c.beginPath(); c.arc(128, 138, 44, Math.PI, 0); c.lineWidth = 12; c.stroke();
    c.strokeStyle = '#d74939'; c.lineWidth = 10; c.beginPath(); c.moveTo(128, 138); c.lineTo(150, 105); c.stroke();
    c.fillStyle = INK; c.font = '900 18px Arial'; c.fillText('OBEY. REPEAT.', 128, 192);
  });
  return chestMap;
}
function glove(parent, position, scale = 1, mirror = 1) {
  const group = new THREE.Group();
  group.position.set(...position); group.scale.setScalar(scale);
  parent.add(group);
  ball(group, [0, 0, 0], [0.195, 0.225, 0.17], CREAM);
  const thumb = ball(group, [-mirror * 0.158, -0.035, 0.065], [0.09, 0.13, 0.115], CREAM);
  thumb.rotation.z = mirror * 0.5;
  cylinder(group, [0, 0.178, -0.005], [0.161, 0.092, 0.145], CREAM);
  decal(group, getStitchMap(), 0.23, 0.24, [0, 0.015, 0.169]);
  return group;
}
function disposeGroup(group) {
  const geometries = new Set(), ownedMaterials = new Set();
  group.traverse(obj => {
    if (obj.geometry && !sharedGeometries.has(obj.geometry)) geometries.add(obj.geometry);
    if (obj.userData.ownedMaterial && obj.material) ownedMaterials.add(obj.material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const mat of ownedMaterials) mat.dispose();
  group.removeFromParent();
}

/** A continuous-limbed wind-up robot, feet at y=0, facing local +Z. */
export function createTinGrunt({ elite = false } = {}) {
  const group = new THREE.Group();
  group.name = elite ? 'Foreman Tin Grunt' : 'Tin Grunt';
  const upper = new THREE.Group(); group.add(upper);
  const bodyMat = toon(elite ? '#d45f89' : YELLOW).clone();
  const headMat = toon(CREAM).clone();
  const body = ball(upper, [0, 1.07, 0], [elite ? 0.47 : 0.43, 0.43, 0.3], bodyMat);
  body.userData.ownedMaterial = true;
  const waist = cylinder(upper, [0, 0.775, 0], [0.31, 0.12, 0.265], INK);
  cylinder(upper, [0, 1.39, 0], [0.14, 0.2, 0.14], INK);
  const head = ball(upper, [0, 1.71, 0.015], [0.59, 0.48, 0.35], headMat);
  head.userData.ownedMaterial = true;
  decal(upper, getFaceMap(), 1.035, 0.84, [0, 1.697, 0.367]);
  decal(upper, getChestMap(), 0.40, 0.42, [0, 1.08, 0.302]);

  const dome = outlined(new THREE.SphereGeometry(0.605, 16, 8, 0, TAU, 0, Math.PI / 2), elite ? '#63314f' : '#7c6638', upper, [0, 2.002, -0.02], [1, 0.31, 0.74]);
  cylinder(upper, [0, 2.005, 0.015], [0.625, 0.052, 0.47], elite ? '#e5769b' : YELLOW);
  cylinder(upper, [0, 2.196, -0.02], [0.075, 0.08, 0.075], INK);

  // Chunky ear screws are one instanced draw, including their outline.
  const boltGeometry = new THREE.CylinderGeometry(0.095, 0.095, 0.1, 6);
  const bolts = new THREE.InstancedMesh(boltGeometry, toon('#726d7a'), 2);
  const boltHull = new THREE.InstancedMesh(boltGeometry, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }), 2);
  boltHull.userData.ownedMaterial = true;
  const temp = new THREE.Object3D();
  for (let i = 0; i < 2; i++) {
    temp.position.set(i ? 0.591 : -0.591, 1.69, 0); temp.rotation.set(0, 0, Math.PI / 2); temp.scale.setScalar(1); temp.updateMatrix(); bolts.setMatrixAt(i, temp.matrix);
    temp.scale.setScalar(1.13); temp.updateMatrix(); boltHull.setMatrixAt(i, temp.matrix);
  }
  upper.add(bolts, boltHull);

  // Actual two-holed butterfly winding key, visible from the sides and back.
  const wind = new THREE.Group(); wind.position.set(0, 1.09, -0.36); upper.add(wind);
  cylinder(wind, [0, 0, -0.1], [0.055, 0.27, 0.055], '#b8a77a', true);
  const shapes = [];
  for (const x of [-0.145, 0.145]) {
    const shape = new THREE.Shape(); shape.absellipse(x, 0, 0.19, 0.14, 0, TAU, false, 0);
    const hole = new THREE.Path(); hole.absellipse(x, 0, 0.094, 0.067, 0, TAU, true, 0); shape.holes.push(hole); shapes.push(shape);
  }
  const key = outlined(new THREE.ExtrudeGeometry(shapes, { depth: 0.052, bevelEnabled: false, curveSegments: 10 }), YELLOW, wind, [0, 0, -0.25]);

  const arms = [rubberTube(group, 0.095, INK), rubberTube(group, 0.095, INK)];
  const legs = [rubberTube(group, 0.105, INK), rubberTube(group, 0.105, INK)];
  const gloves = [glove(group, [-0.64, 0.68, 0.15], 1, -1), glove(group, [0.64, 0.68, 0.15], 1, 1)];
  const shoes = [ball(group, [-0.235, 0.14, 0.14], [0.235, 0.15, 0.34], '#35303c'), ball(group, [0.235, 0.14, 0.14], [0.235, 0.15, 0.34], '#35303c')];
  const socks = [cylinder(group, [-0.235, 0.27, 0.06], [0.12, 0.13, 0.12], CREAM), cylinder(group, [0.235, 0.27, 0.06], [0.12, 0.13, 0.12], CREAM)];
  const shadowMat = new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.23, depthWrite: false });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.68, 20), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; shadow.scale.y = 0.74; shadow.userData.ownedMaterial = true; group.add(shadow);

  function update(time = 0, moving = 0, attack = 0, hit = 0) {
    const walk = THREE.MathUtils.clamp(Number(moving) || 0, 0, 1);
    const phase = time * 8.8;
    const bounce = Math.abs(Math.sin(phase)) * 0.045 * walk + Math.sin(time * 2.7) * 0.012;
    upper.position.y = bounce;
    upper.rotation.z = Math.sin(phase) * 0.035 * walk + Math.sin(time * 55) * hit * 0.13;
    upper.rotation.x = attack * 0.11;
    wind.rotation.z = time * 2.8 + walk * Math.sin(phase) * 0.2;
    bodyMat.emissive.setRGB(hit * 0.7, hit * 0.25, hit * 0.07);
    headMat.emissive.setRGB(hit * 0.35, hit * 0.25, hit * 0.2);
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      const step = Math.sin(phase + i * Math.PI) * walk;
      const lift = Math.max(0, step) * 0.12;
      const footZ = 0.10 + step * 0.30;
      legs[i].bend([s * 0.23, 0.81 + bounce, 0], [s * 0.29, 0.61 + bounce, -step * 0.07], [s * 0.25, 0.35 + lift, footZ], [s * 0.235, 0.23 + lift, footZ]);
      shoes[i].position.set(s * 0.235, 0.14 + lift, footZ + 0.07);
      shoes[i].rotation.x = -step * 0.16;
      socks[i].position.set(s * 0.235, 0.275 + lift, footZ);
      const handX = s * (0.63 - attack * 0.14);
      const handY = 0.71 + Math.max(0, -step) * 0.10 + attack * 0.54 + bounce;
      const handZ = 0.14 - step * 0.20 + attack * 0.62;
      arms[i].bend([s * 0.40, 1.27 + bounce, 0], [s * 0.70, 1.24 + bounce, -step * 0.15], [s * 0.79, 0.91 + bounce + attack * 0.48, handZ * 0.7], [handX, handY + 0.16, handZ]);
      gloves[i].position.set(handX, handY, handZ);
      gloves[i].rotation.z = s * (0.12 - attack * 0.3);
      gloves[i].rotation.x = -attack * 0.7;
    }
  }
  update(0, 0);
  return { group, update, dispose() { disposeGroup(group); } };
}

function starGeometry(outer = 0.25, inner = 0.09, count = 7) {
  const shape = new THREE.Shape();
  for (let i = 0; i < count * 2; i++) {
    const angle = i / (count * 2) * TAU;
    const r = i % 2 ? inner : outer * (i % 3 === 0 ? 1.25 : 1);
    const x = Math.cos(angle) * r, y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

/** A camera-relative view model. Render layer 1 after clearDepth(). */
export function createWeapon(camera) {
  const group = new THREE.Group(); group.name = 'The Editor shotgun / view model'; camera.add(group);
  const gun = new THREE.Group(); group.add(gun);
  gun.position.set(0.46, -0.45, -0.62); gun.rotation.set(0.035, -0.065, -0.035);

  // Rounded, weighty receiver and visibly separate barrel / magazine tube.
  rounded(gun, [0, 0.015, -0.22], [0.285, 0.285, 0.63], YELLOW, 0.065);
  rounded(gun, [0, -0.005, 0.20], [0.20, 0.23, 0.30], '#45404a', 0.05);
  const stock = rounded(gun, [0.045, -0.045, 0.285], [0.245, 0.32, 0.20], '#272331', 0.06);
  stock.rotation.x = -0.12;
  rounded(gun, [0, 0.174, -0.18], [0.13, 0.055, 0.37], INK, 0.012);
  const rearSight = rounded(gun, [0, 0.222, 0.015], [0.07, 0.06, 0.045], '#e7dcb9', 0.01);
  cylinder(gun, [0, 0.088, -0.92], [0.073, 1.02, 0.073], '#4c4856', true);
  cylinder(gun, [0, -0.062, -0.86], [0.057, 0.84, 0.057], '#292632', true);
  for (const z of [-0.51, -1.24]) cylinder(gun, [0, 0.087, z], [0.092, 0.058, 0.092], '#ae9d69', true);
  const muzzleRing = outlined(new THREE.TorusGeometry(0.071, 0.023, 7, 16), '#c1b996', gun, [0, 0.088, -1.438]);
  const muzzleHole = new THREE.Mesh(new THREE.CircleGeometry(0.065, 16), toon(INK));
  muzzleHole.position.set(0, 0.088, -1.442); muzzleHole.rotation.y = Math.PI; gun.add(muzzleHole);
  rounded(gun, [0, 0.194, -1.30], [0.036, 0.08, 0.055], YELLOW, 0.008);

  const port = rounded(gun, [-0.143, 0.056, -0.27], [0.012, 0.105, 0.27], INK, 0.005);
  rounded(gun, [-0.155, 0.048, -0.22], [0.02, 0.048, 0.15], '#b1a780', 0.008);
  cylinder(gun, [-0.171, 0.017, -0.16], [0.026, 0.045, 0.026], INK).rotation.z = Math.PI / 2;

  const brandMap = texture(512, 160, c => {
    c.fillStyle = CREAM; c.fillRect(2, 2, 508, 156);
    c.strokeStyle = INK; c.lineWidth = 10; c.strokeRect(5, 5, 502, 150);
    c.fillStyle = INK; c.textAlign = 'center'; c.font = '900 64px Arial'; c.fillText('THE EDITOR', 256, 81);
    c.font = '900 27px Arial'; c.fillText('FINAL WORD • NO. 06', 256, 125);
  });
  const stamp = decal(gun, brandMap, 0.34, 0.108, [0.145, -0.026, -0.20]); stamp.rotation.y = Math.PI / 2;
  const backStampMap = texture(128, 128, c => {
    c.fillStyle = INK; c.beginPath(); c.arc(64, 64, 58, 0, TAU); c.fill();
    c.strokeStyle = CREAM; c.lineWidth = 5; c.beginPath(); c.arc(64, 64, 48, 0, TAU); c.stroke();
    c.fillStyle = CREAM; c.textAlign = 'center'; c.font = '900 54px Arial'; c.fillText('06', 64, 82);
  });
  decal(gun, backStampMap, 0.16, 0.16, [0.005, 0.02, 0.101]);

  const grip = rounded(gun, [0, -0.22, 0.015], [0.16, 0.32, 0.19], '#34313b', 0.045); grip.rotation.x = -0.27;
  const guard = outlined(new THREE.TorusGeometry(0.092, 0.023, 6, 16), YELLOW, gun, [0, -0.20, -0.18], [1, 1.0, 0.8]); guard.rotation.y = Math.PI / 2;
  const trigger = rounded(gun, [0, -0.177, -0.16], [0.025, 0.07, 0.033], INK, 0.009); trigger.rotation.x = 0.26;

  const pump = new THREE.Group(); pump.position.set(0, -0.055, -0.91); gun.add(pump);
  rounded(pump, [0, 0, 0], [0.235, 0.20, 0.38], '#292632', 0.045);
  // Thick ochre ribs read instantly as a pump-action grip.
  for (let i = 0; i < 5; i++) rounded(pump, [0, 0.005, -0.145 + i * 0.073], [0.25, 0.205, 0.027], '#d89e26', 0.012);

  const rightHand = new THREE.Group(); rightHand.position.set(0.015, -0.23, 0.076); rightHand.rotation.set(-0.1, 0.15, -0.18); gun.add(rightHand);
  ball(rightHand, [0, 0, 0], [0.132, 0.16, 0.15], CREAM);
  ball(rightHand, [-0.103, 0.025, -0.065], [0.078, 0.1, 0.103], CREAM);
  decal(rightHand, getStitchMap(), 0.16, 0.17, [0.01, 0.025, 0.148]);
  const rightCuff = cylinder(rightHand, [0.03, -0.142, 0.041], [0.13, 0.10, 0.12], CREAM); rightCuff.rotation.x = -0.25;
  const rightArm = rubberTube(gun, 0.105, INK, 12, 8);
  rightArm.bend([0.33, -0.57, 0.26], [0.22, -0.48, 0.23], [0.03, -0.39, 0.18], [0.05, -0.33, 0.115]);

  const leftHand = new THREE.Group(); leftHand.position.set(-0.013, -0.116, 0.045); leftHand.rotation.set(-0.12, -0.2, 0.4); pump.add(leftHand);
  ball(leftHand, [0, 0, 0], [0.145, 0.119, 0.185], CREAM);
  ball(leftHand, [-0.092, 0.073, -0.025], [0.079, 0.105, 0.102], CREAM);
  const leftStitches = decal(leftHand, getStitchMap(), 0.18, 0.20, [-0.125, -0.004, 0.015]); leftStitches.rotation.y = -Math.PI / 2;
  cylinder(leftHand, [-0.058, -0.086, 0.059], [0.125, 0.085, 0.12], CREAM);
  const leftArm = rubberTube(gun, 0.101, INK, 12, 8);

  const flashMaterial = new THREE.MeshBasicMaterial({ color: '#ffb72c', transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const flashGroup = new THREE.Group(); flashGroup.position.set(0, 0.088, -1.46); flashGroup.visible = false; gun.add(flashGroup);
  const flashOuter = new THREE.Mesh(starGeometry(0.26, 0.09, 7), flashMaterial); flashGroup.add(flashOuter);
  const flashInner = new THREE.Mesh(starGeometry(0.13, 0.05, 5), new THREE.MeshBasicMaterial({ color: '#fff9d9', side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  flashInner.position.z = 0.008; flashGroup.add(flashInner);
  flashOuter.userData.ownedMaterial = flashInner.userData.ownedMaterial = true;
  const flashLight = new THREE.PointLight('#ffbf4d', 0, 5, 2); flashLight.position.copy(flashGroup.position); gun.add(flashLight);

  // The other hand comes right through the center for a Knuckle Sandwich.
  const punch = new THREE.Group(); group.add(punch); punch.visible = false;
  ball(punch, [0, 0, 0], [0.225, 0.21, 0.20], CREAM);
  ball(punch, [0.18, -0.08, -0.03], [0.10, 0.12, 0.13], CREAM);
  decal(punch, getStitchMap(), 0.28, 0.24, [0, 0.02, 0.205]);
  cylinder(punch, [-0.03, -0.18, 0.09], [0.17, 0.13, 0.16], CREAM);
  const punchArm = rubberTube(punch, 0.14, INK, 9, 8);
  punchArm.bend([-0.36, -0.44, 0.20], [-0.25, -0.34, 0.20], [-0.02, -0.27, 0.16], [-0.025, -0.20, 0.11]);

  group.traverse(obj => { obj.layers.set(1); if (obj.isMesh) { obj.castShadow = false; obj.receiveShadow = false; } });
  let flashRemaining = 0, lastTime = 0, recoilAge = 10;
  function update({ time = 0, moveSpeed = 0, recoil = 0, reload = 0, melee = 0, dash = 0 } = {}) {
    const dt = lastTime ? Math.min(0.1, Math.max(0, time - lastTime)) : 0.016;
    lastTime = time; recoilAge += dt;
    const walking = Math.min(Math.abs(moveSpeed) / 6, 1);
    const bobX = Math.sin(time * 8.8) * 0.010 * walking;
    const bobY = Math.abs(Math.cos(time * 8.8)) * 0.014 * walking;
    const reloadArc = reload > 0 ? Math.sin(Math.PI * THREE.MathUtils.clamp(reload, 0, 1)) : 0;
    // Keep a natural, uniformly scaled view model on narrow portrait screens.
    const narrow = THREE.MathUtils.clamp((1.25 - camera.aspect) / (1.25 - 9 / 19.5), 0, 1);
    const fitScale = 1 - narrow * 0.28;
    gun.scale.setScalar(fitScale);
    gun.position.set(0.46 - narrow * 0.29 + bobX + reloadArc * 0.12 * fitScale, -0.45 + narrow * 0.08 + bobY - reloadArc * 0.08 - melee * 0.18, -0.62 - narrow * 0.08 + recoil * 0.13);
    gun.rotation.set(0.035 + recoil * 0.18 - reloadArc * 0.12, -0.065 + dash * 0.13, -0.035 - reloadArc * 0.53 + dash * 0.08);
    const pumpKick = recoilAge < 0.43 ? Math.sin(Math.min(1, recoilAge / 0.43) * Math.PI) * 0.16 : 0;
    pump.position.z = -0.91 + pumpKick;
    leftArm.bend([-0.60, -0.51, 0.22], [-0.39, -0.43, -0.05], [-0.17, -0.30, -0.59 + pumpKick], [-0.06, -0.22, -0.79 + pumpKick]);
    rightHand.rotation.x = -0.1 + reloadArc * 0.15;
    punch.visible = melee > 0.025;
    punch.scale.setScalar(1 - narrow * 0.18);
    punch.position.set((-0.38 + melee * 0.23) * (1 - narrow * 0.25), -0.43 + melee * 0.27, -0.44 - melee * 0.43);
    punch.rotation.set(-melee * 0.35, melee * 0.27, -0.3 + melee * 0.35);
    flashRemaining = Math.max(0, flashRemaining - dt);
    flashGroup.visible = flashRemaining > 0;
    flashGroup.scale.setScalar(0.65 + flashRemaining * 5);
    flashGroup.rotation.z += dt * 23;
    flashLight.intensity = flashRemaining > 0 ? 1.8 : 0;
  }
  update();
  return {
    group,
    update,
    flash() { flashRemaining = 0.065; recoilAge = 0; flashGroup.visible = true; flashGroup.rotation.z = Math.random() * TAU; },
    dispose() { disposeGroup(group); brandMap.dispose(); backStampMap.dispose(); }
  };
}
