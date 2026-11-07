/** A visual route to the current word. It never changes flight or lesson state. */
const MAX_POINTS = 129;
const MAX_SEGMENTS = 96;
const MAX_ARROWS = 24;
const INTERVAL = .1;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const smooth = n => { n = clamp(n, 0, 1); return n * n * (3 - 2 * n); };
const finitePoint = p => p && [p.x, p.y, p.z].every(n => Number.isFinite(n) && Math.abs(n) < 1e7);

export function createPathGuide(THREE, scene, { heightAt = () => 0 } = {}) {
  const T = THREE, terrain = typeof heightAt === 'function' ? heightAt : () => 0;
  const group = new T.Group(); group.name = 'golingo-flight-path'; group.visible = false; scene.add(group);
  const cylinder = new T.CylinderGeometry(1, 1, 1, 8, 1);
  const coreMaterial = new T.MeshBasicMaterial({ color: 0x49deff, transparent: true, opacity: .94, depthTest: true, depthWrite: false, fog: false, toneMapped: false });
  const haloMaterial = new T.MeshBasicMaterial({ color: 0x14bcff, transparent: true, opacity: .19, blending: T.AdditiveBlending, depthTest: true, depthWrite: false, fog: false, toneMapped: false });
  const arrowMaterial = new T.MeshBasicMaterial({ color: 0xc0faff, transparent: true, opacity: .96, depthTest: true, depthWrite: false, fog: false, toneMapped: false });
  const object = new T.Object3D(), axis = new T.Vector3(0, 1, 0), worldUp = new T.Vector3(0, 1, 0);
  const a = new T.Vector3(), b = new T.Vector3(), direction = new T.Vector3();
  const right = new T.Vector3(), up = new T.Vector3(), basis = new T.Matrix4();

  // Two solid bars form a 16 m wide, slightly raised forward-pointing chevron.
  const source = cylinder.toNonIndexed(), vertices = source.getAttribute('position');
  const arrowPositions = new Float32Array(vertices.count * 3 * 2), vertex = new T.Vector3();
  for (let arm = 0; arm < 2; arm++) {
    a.set(arm ? 8 : -8, -3, -6); b.set(0, 3, 6);
    direction.subVectors(b, a); const length = direction.length();
    object.position.copy(a).add(b).multiplyScalar(.5);
    object.quaternion.setFromUnitVectors(axis, direction.normalize());
    object.scale.set(1.05, length, 1.05); object.updateMatrix();
    for (let i = 0; i < vertices.count; i++) {
      vertex.fromBufferAttribute(vertices, i).applyMatrix4(object.matrix);
      vertex.toArray(arrowPositions, (arm * vertices.count + i) * 3);
    }
  }
  source.dispose();
  const arrowGeometry = new T.BufferGeometry();
  arrowGeometry.setAttribute('position', new T.BufferAttribute(arrowPositions, 3));
  arrowGeometry.computeVertexNormals();
  const core = new T.InstancedMesh(cylinder, coreMaterial, MAX_SEGMENTS);
  const halo = new T.InstancedMesh(cylinder, haloMaterial, MAX_SEGMENTS);
  const arrows = new T.InstancedMesh(arrowGeometry, arrowMaterial, MAX_ARROWS);
  core.name = 'flight-path-core'; halo.name = 'flight-path-halo'; arrows.name = 'flight-path-chevrons';
  for (const mesh of [halo, core, arrows]) {
    mesh.count = 0; mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); group.add(mesh);
  }
  halo.renderOrder = 2; core.renderOrder = 3; arrows.renderOrder = 4;

  const points = Array.from({ length: MAX_POINTS }, () => new T.Vector3());
  const lengths = new Float64Array(MAX_POINTS), floors = new Float64Array(MAX_POINTS), filtered = new Float64Array(MAX_POINTS);
  const position = new T.Vector3(), rotation = new T.Quaternion(), target = new T.Vector3(), normal = new T.Vector3();
  const forward = new T.Vector3(), toward = new T.Vector3(), tangent = new T.Vector3();
  const p0 = new T.Vector3(), p1 = new T.Vector3(), p2 = new T.Vector3();
  let enabled = false, disposed = false, dirty = true, hasTarget = false, elapsed = INTERVAL;
  let pointCount = 0, totalLength = 0, rebuilds = 0, clearanceLimited = false, behind = false;
  let lastGrounded = false;

  function hide() { group.visible = false; core.count = halo.count = arrows.count = 0; pointCount = 0; }
  function ground(x, z) { const h = terrain(x, z); return Number.isFinite(h) ? h : 0; }
  function atDistance(distance, output) {
    if (distance <= 0) return output.copy(points[0]);
    if (distance >= totalLength) return output.copy(points[pointCount - 1]);
    let lo = 0, hi = pointCount - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (lengths[mid] < distance) lo = mid; else hi = mid; }
    const span = lengths[hi] - lengths[lo];
    return output.copy(points[lo]).lerp(points[hi], span > 1e-6 ? (distance - lengths[lo]) / span : 0);
  }
  function segment(index, from, to) {
    direction.subVectors(to, from); const length = direction.length();
    object.position.copy(from).add(to).multiplyScalar(.5);
    object.quaternion.setFromUnitVectors(axis, direction.multiplyScalar(1 / Math.max(length, 1e-6)));
    object.scale.set(1.65, length, 1.65); object.updateMatrix(); core.setMatrixAt(index, object.matrix);
    object.scale.set(3, length, 3); object.updateMatrix(); halo.setMatrixAt(index, object.matrix);
  }
  function rebuild(grounded, speed) {
    toward.subVectors(target, position); const distance = toward.length();
    if (!Number.isFinite(distance) || distance < 12) { hide(); return; }
    toward.multiplyScalar(1 / distance);
    forward.set(0, 0, -1).applyQuaternion(rotation);
    if (grounded) { forward.y = 0; if (forward.lengthSq() < .001) forward.set(0, 0, -1); forward.normalize(); }
    const alignment = forward.dot(toward); behind = alignment < 0;
    // A target behind the plane gets a direct bearing guide, without a looping U-turn.
    tangent.copy(toward).lerp(forward, smooth((alignment - .05) / .8)).normalize();
    const ahead = Math.min(clamp(24 + speed * .6, 30, 82), distance * .16);
    p0.copy(position).addScaledVector(tangent, ahead);
    p0.y -= grounded ? 0 : Math.min(14, distance * .025);
    direction.subVectors(target, p0); const chord = direction.length(); direction.normalize();
    const handle = Math.min(chord * .28, 650);
    p1.copy(p0).addScaledVector(tangent, handle);
    tangent.copy(normal);
    if (tangent.lengthSq() < .001 || behind) tangent.copy(direction);
    else {
      tangent.normalize(); if (tangent.dot(direction) < 0) tangent.negate();
      tangent.lerp(direction, .65).normalize();
    }
    p2.copy(target).addScaledVector(tangent, -handle * .75);
    pointCount = clamp(Math.ceil(chord / 18) + 1, 32, MAX_POINTS);
    right.set(-direction.z, 0, direction.x);
    if (right.lengthSq() < .001) right.set(1, 0, 0); else right.normalize();
    clearanceLimited = false;
    const lowStart = grounded || position.y - ground(position.x, position.z) < 45;
    for (let i = 0; i < pointCount; i++) {
      const t = i / (pointCount - 1), u = 1 - t;
      points[i].set(
        u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * target.x,
        u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * target.y,
        u * u * u * p0.z + 3 * u * u * t * p1.z + 3 * u * t * t * p2.z + t * t * t * target.z,
      );
      const p = points[i], clearance = lowStart ? 3 + 25 * smooth(t * chord / 350) : 28;
      const surface = Math.max(ground(p.x, p.z), ground(p.x + right.x * 7, p.z + right.z * 7), ground(p.x - right.x * 7, p.z - right.z * 7));
      floors[i] = Math.max(p.y, surface + clearance);
      if (i === pointCount - 1) {
        // The destination remains the real word, even if terrain makes clearance impossible.
        if (surface + 3 > target.y) clearanceLimited = true;
        floors[i] = target.y;
      }
      p.y = floors[i];
    }
    // Spread sampled terrain rises into a gentle visual arc; this is not a flight planner.
    const slope = lowStart ? .2 : .32;
    for (let i = pointCount - 2; i > 0; i--) points[i].y = Math.max(points[i].y, points[i + 1].y - Math.hypot(points[i].x - points[i + 1].x, points[i].z - points[i + 1].z) * slope);
    for (let i = 1; i < pointCount - 1; i++) points[i].y = Math.max(points[i].y, points[i - 1].y - Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z) * slope);
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < pointCount - 1; i++) filtered[i] = Math.max(floors[i], (points[i - 1].y + 2 * points[i].y + points[i + 1].y) / 4);
      for (let i = 1; i < pointCount - 1; i++) points[i].y = filtered[i];
    }
    points[pointCount - 1].copy(target);
    lengths[0] = 0;
    for (let i = 1; i < pointCount; i++) lengths[i] = lengths[i - 1] + points[i].distanceTo(points[i - 1]);
    totalLength = lengths[pointCount - 1];
    const spacing = Math.max(28, totalLength / MAX_SEGMENTS), dashLength = Math.min(spacing * .58, 46);
    let count = 0;
    for (let end = totalLength; end > .5 && count < MAX_SEGMENTS; end -= spacing) {
      atDistance(Math.max(0, end - dashLength), a); atDistance(end, b);
      segment(count++, a, b);
    }
    core.count = halo.count = count;
    core.instanceMatrix.needsUpdate = halo.instanceMatrix.needsUpdate = true;
    const arrowSpacing = Math.max(135, totalLength / MAX_ARROWS);
    count = 0;
    for (let distanceAlong = totalLength - 65; distanceAlong > 35 && count < MAX_ARROWS; distanceAlong -= arrowSpacing) {
      atDistance(distanceAlong, a); atDistance(Math.min(totalLength, distanceAlong + 4), b);
      direction.subVectors(b, a).normalize();
      right.crossVectors(worldUp, direction);
      if (right.lengthSq() < .001) right.set(1, 0, 0); else right.normalize();
      up.crossVectors(direction, right).normalize(); basis.makeBasis(right, up, direction);
      object.position.copy(a); object.quaternion.setFromRotationMatrix(basis); object.scale.set(1, 1, 1); object.updateMatrix();
      arrows.setMatrixAt(count++, object.matrix);
    }
    arrows.count = count; arrows.instanceMatrix.needsUpdate = true;
    group.visible = enabled && core.count > 0; rebuilds++;
  }

  return {
    get visible() { return group.visible; },
    setVisible(value) {
      value = !!value;
      if (disposed || value === enabled) return;
      enabled = value;
      if (!value) hide(); else dirty = true;
    },
    update(dt, aircraftPosition, aircraftQuaternion, wordTarget, { grounded = false, speed = 0 } = {}) {
      if (disposed) return;
      if (!finitePoint(wordTarget) || !finitePoint(aircraftPosition)) { hasTarget = false; dirty = true; hide(); return; }
      const n = wordTarget.normal;
      const nx = Number.isFinite(n?.x) ? n.x : 0, ny = Number.isFinite(n?.y) ? n.y : 0, nz = Number.isFinite(n?.z) ? n.z : 0;
      if (!hasTarget || target.x !== wordTarget.x || target.y !== wordTarget.y || target.z !== wordTarget.z || normal.x !== nx || normal.y !== ny || normal.z !== nz) {
        target.copy(wordTarget); normal.set(nx, ny, nz); hasTarget = true; dirty = true;
      }
      if (!enabled) return;
      elapsed += clamp(Number.isFinite(dt) ? dt : 0, 0, 1);
      if (grounded !== lastGrounded) dirty = true;
      if (!dirty && elapsed + 1e-8 < INTERVAL) return;
      position.copy(aircraftPosition);
      if (aircraftQuaternion && [aircraftQuaternion.x, aircraftQuaternion.y, aircraftQuaternion.z, aircraftQuaternion.w].every(Number.isFinite)) {
        rotation.copy(aircraftQuaternion); if (rotation.lengthSq() > .001) rotation.normalize(); else rotation.identity();
      } else rotation.identity();
      rebuild(!!grounded, clamp(Number.isFinite(speed) ? speed : 0, 0, 250));
      dirty = false; elapsed = 0; lastGrounded = grounded;
    },
    get diagnostics() {
      const end = pointCount ? points[pointCount - 1] : null;
      return {
        visible: group.visible, enabled, target: hasTarget ? { x: target.x, y: target.y, z: target.z } : null,
        start: pointCount ? { x: points[0].x, y: points[0].y, z: points[0].z } : null,
        endpoint: end ? { x: end.x, y: end.y, z: end.z } : null,
        pointCount, segments: core.count, arrows: arrows.count, maxSegments: MAX_SEGMENTS, maxArrows: MAX_ARROWS,
        length: pointCount ? totalLength : 0, rebuilds, behind, clearanceLimited, drawCalls: group.visible ? 2 + Number(arrows.count > 0) : 0,
      };
    },
    dispose() {
      if (disposed) return;
      enabled = false; hide(); scene.remove(group);
      for (const mesh of [core, halo, arrows]) mesh.dispose();
      cylinder.dispose(); arrowGeometry.dispose(); coreMaterial.dispose(); haloMaterial.dispose(); arrowMaterial.dispose();
      disposed = true; hasTarget = false;
    },
  };
}

export default createPathGuide;
