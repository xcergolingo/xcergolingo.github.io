import * as THREE from './vendor/three.module.js';
import { createHelpers } from './atelier-models/core.js';
import { createF16 } from './atelier-models/f16.js';
import { createYak130, createF15 } from './atelier-models/military.js';
import { createRareBear, createFalcon } from './atelier-models/sport.js';

// The four factories above are verbatim Flightline Atelier revision 2 sources:
// e606e7787e9ce84416775b299b089e4e9d24d145. Game adaptations stay in this file.
export const ATELIER_JET_IDS = Object.freeze(['f16', 'yak130', 'rare-bear', 'f15', 'falcon']);
const SPECS = {
  f16: { factory: createF16, scale: .36, clearance: .5938, cockpit: { z: 2.43, y: .405, length: 2.73, height: .57, seats: 1 } },
  yak130: { factory: createYak130, scale: .36, clearance: .673, cockpit: { z: 2.91, y: .427, length: 3.14, height: .68, seats: 2 } },
  'rare-bear': { factory: createRareBear, scale: .34, clearance: .5622, cockpit: { z: 3.16, y: .44, length: 3.05, height: .62, seats: 2, eye: [0, .90, 3.34] } },
  f15: { factory: createF15, scale: .4, clearance: .725, cockpit: { z: 3.04, y: .44, length: 2.54, height: .61, seats: 1 } },
  falcon: { factory: createFalcon, scale: .33, clearance: .5035, cockpit: { z: 3.18, y: .38, length: 3.11, height: .43, seats: 1 } }
};
const clamp = value => Math.max(0, Math.min(1, value));
const MOVING_MESH_NAMES = new Set([
  'Upper hinged strut', 'Polished lower strut', 'Oleo outer sleeve',
  'Folding knee joint', 'Knee hinge pin', 'Retraction actuator cylinder',
  'Retraction actuator piston', 'Torque scissor upper link', 'Torque scissor lower link',
  'Turbine warm core', 'Pilot helmet', 'Dark visor'
]);

// Keep every animated assembly and directly animated strut intact. Only static
// siblings are combined; wheel groups, flush doors, and canopy hinges still
// move through the original factory's complete reversible gear mechanism.
function batchStaticChildren(group) {
  for (const child of [...group.children]) if (child.isGroup) batchStaticChildren(child);
  const batches = new Map();
  for (const child of group.children) {
    if (!child.isMesh || Array.isArray(child.material) || child.material.transparent || MOVING_MESH_NAMES.has(child.name)) continue;
    const key = `${child.material.uuid}/${child.castShadow}/${child.receiveShadow}/${child.renderOrder}`;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(child);
  }
  for (const parts of batches.values()) {
    if (parts.length < 2) continue;
    const sources = parts.map(part => { part.updateMatrix(); return part.geometry.clone().applyMatrix4(part.matrix); });
    const vertices = sources.reduce((n, g) => n + g.attributes.position.count, 0);
    const indexCount = sources.reduce((n, g) => n + (g.index?.count ?? g.attributes.position.count), 0);
    const merged = new THREE.BufferGeometry();
    const attributes = new Set(sources.flatMap(g => Object.keys(g.attributes)));
    for (const name of attributes) {
      const sample = sources.find(g => g.attributes[name]).attributes[name];
      const array = new Float32Array(vertices * sample.itemSize);
      let offset = 0;
      for (const source of sources) {
        const count = source.attributes.position.count * sample.itemSize;
        if (source.attributes[name]) array.set(source.attributes[name].array, offset);
        else if (name === 'color') array.fill(1, offset, offset + count);
        offset += count;
      }
      merged.setAttribute(name, new THREE.BufferAttribute(array, sample.itemSize));
    }
    const indices = vertices > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
    let ii = 0, base = 0;
    for (const source of sources) {
      const count = source.index?.count ?? source.attributes.position.count;
      for (let i = 0; i < count; i++) indices[ii++] = base + (source.index ? source.index.getX(i) : i);
      base += source.attributes.position.count;
    }
    merged.setIndex(new THREE.BufferAttribute(indices, 1));
    merged.computeBoundingBox(); merged.computeBoundingSphere();
    const first = parts[0], object = new THREE.Mesh(merged, first.material);
    object.name = `Atelier • ${parts.length} static details`;
    object.castShadow = first.castShadow; object.receiveShadow = first.receiveShadow; object.renderOrder = first.renderOrder;
    object.userData.sourceNames = parts.map(p => p.name);
    parts.forEach(part => { group.remove(part); part.geometry.dispose(); });
    sources.forEach(g => g.dispose());
    group.add(object);
  }
  // Separate source polylines become segments, preserving every seam without
  // connecting unrelated paths or adding one draw call for every panel line.
  const lineBatches = new Map();
  for (const child of group.children) {
    if (!child.isLine || !child.material.isLineBasicMaterial) continue;
    const m = child.material;
    const key = `${m.color.getHexString()}/${m.opacity}/${m.transparent}/${m.depthTest}/${m.depthWrite}/${m.linewidth}/${m.blending}/${child.renderOrder}`;
    if (!lineBatches.has(key)) lineBatches.set(key, []);
    lineBatches.get(key).push(child);
  }
  for (const parts of lineBatches.values()) {
    if (parts.length < 2) continue;
    const positions = [], a = new THREE.Vector3(), b = new THREE.Vector3();
    for (const line of parts) {
      line.updateMatrix();
      const p = line.geometry.attributes.position, step = line.isLineSegments ? 2 : 1;
      for (let i = 0; i < p.count - 1; i += step) {
        a.fromBufferAttribute(p, i).applyMatrix4(line.matrix);
        b.fromBufferAttribute(p, i + 1).applyMatrix4(line.matrix);
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeBoundingSphere();
    const object = new THREE.LineSegments(geometry, parts[0].material);
    object.name = 'Atelier • engraved panel seams'; object.renderOrder = parts[0].renderOrder;
    object.userData.sourceNames = parts.map(p => p.name);
    parts.forEach(part => { group.remove(part); part.geometry.dispose(); });
    group.add(object);
  }
}

function collect(root, predicate) {
  const items = []; root.traverse(object => { if (predicate(object)) items.push(object); }); return items;
}

function cameraMounts(model, spec, bounds) {
  const { scale, cockpit: c } = spec;
  const size = bounds.getSize(new THREE.Vector3());
  const seatZ = c.seats === 1 ? c.z - .12 : c.z + c.length * .19;
  // Rare Bear's original analogue panel sits closer to the front seat than
  // the shared cockpit's digital panel, so its eye is set just behind it.
  const sourceEye = c.eye || [0, c.y + c.height * .58, seatZ + .08];
  const eye = [-sourceEye[0] * scale, sourceEye[1] * scale, -sourceEye[2] * scale];
  const nose = [0, .64 * scale, bounds.min.z + .88 * scale];
  const tip = { y: 0, z: -Infinity }, point = new THREE.Vector3();
  model.traverse(object => {
    if (!object.isMesh) return;
    const p = object.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      point.fromBufferAttribute(p, i).applyMatrix4(object.matrixWorld);
      if (Math.abs(point.x) < size.x * .44) continue;
      tip.y = Math.max(tip.y, point.y); tip.z = Math.max(tip.z, point.z);
    }
  });
  if (!Number.isFinite(tip.z)) tip.z = size.z * .14;
  const wing = side => ({
    position: [side * (size.x * .5 + .055), tip.y + .13, tip.z + .18],
    target: [side * size.x * .1, tip.y + .02, -size.z * 1.5], fov: 82, near: .03
  });
  return {
    cockpit: { position: eye, target: [0, eye[1] - .44, -Math.max(8, size.z * 2)], fov: 78, near: .018 },
    nose: { position: nose, target: [0, nose[1] - .05, -size.z * 3], fov: 78, near: .025 },
    leftWing: wing(-1), rightWing: wing(1),
    tail: { position: [0, bounds.max.y + .14, bounds.max.z + .22], target: [0, .14, -size.z * 1.6], fov: 78, near: .04 }
  };
}

export function createAtelierJet(type) {
  const spec = SPECS[type];
  if (!spec) throw new Error(`Unknown Atelier aircraft: ${type}`);
  const authored = spec.factory(THREE, createHelpers(THREE));
  const model = authored.group;
  const aircraft = new THREE.Group();
  aircraft.name = `RC ${authored.info?.name || type}`;
  model.rotation.y = Math.PI; // Source +Z nose becomes Skyfield -Z.
  model.scale.setScalar(spec.scale);
  aircraft.add(model);
  authored.update(0, { gear: 1, canopy: 0, engine: 0 });
  aircraft.updateMatrixWorld(true);
  const deployedBounds = new THREE.Box3().setFromObject(aircraft);
  const size = deployedBounds.getSize(new THREE.Vector3());
  const mounts = cameraMounts(model, spec, deployedBounds);
  const gearGroup = collect(model, o => o.userData.component === 'landing-gear')[0];
  const wheelObjects = collect(model, o => o.name === 'Wheel, tire and brake');
  const wheels = wheelObjects.map(object => {
    const tire = object.getObjectByName('Rubber tire');
    const radius = (tire.geometry.parameters.radius + tire.geometry.parameters.tube) * spec.scale;
    const sourceStow = object.userData.stowedCenter;
    return {
      object, radius, side: -object.userData.gearSide,
      extendedCenter: object.getWorldPosition(new THREE.Vector3()).toArray(),
      stowedCenter: [-sourceStow[0] * spec.scale, sourceStow[1] * spec.scale, -sourceStow[2] * spec.scale]
    };
  });
  const noseFork = wheels.find(w => w.side === 0)?.object.parent;
  const cockpitHide = collect(model, o => ['Pilot helmet', 'Dark visor', 'Transparent canopy glazing'].includes(o.name));
  const exhausts = collect(model, o => o.name === 'Turbine exhaust nozzle');
  const glowObjects = collect(model, o => o.name === 'Turbine warm core');
  authored.update(0, { gear: 0, canopy: 0, engine: 0 });
  aircraft.updateMatrixWorld(true);
  const retractedMinY = new THREE.Box3().setFromObject(aircraft).min.y;
  authored.update(0, { gear: 1, canopy: 0, engine: 0 });
  aircraft.updateMatrixWorld(true);
  batchStaticChildren(model);

  aircraft.userData = {
    type, span: size.x, length: size.z, groundClearance: spec.clearance,
    bellyClearance: -retractedMinY + .025,
    sourceScale: spec.scale, sourceModel: model,
    source: 'Flightline Atelier revision 2 · e606e7787e9ce84416775b299b089e4e9d24d145',
    propulsion: 'jet', retractableGear: true, gearRevision: 2, gearPosition: 1, gearDuration: 2.5,
    controlSurfaces: {}, cameraMounts: mounts, cockpitHide,
    landingGear: { group: gearGroup, wheels, revision: 2, retractedMinY },
    exhausts, jetThrustMaterials: glowObjects.map(o => o.material),
    animate(dt, frame = {}) {
      const delta = Number.isFinite(dt) ? Math.max(0, dt) : 0;
      const engine = clamp(Number(frame.enginePower ?? frame.throttle) || 0);
      const gear = Number.isFinite(frame.gear) ? clamp(frame.gear) : 1;
      authored.update(delta, { gear, canopy: 0, engine });
      aircraft.userData.gearPosition = gear;
      if (frame.grounded && gear > .98) {
        const speed = Math.max(0, Number(frame.speed ?? frame.airspeed) || 0);
        for (const wheel of wheels) wheel.object.rotation.x += speed * delta / wheel.radius;
      }
      if (noseFork) noseFork.rotation.y = -(Math.max(-1, Math.min(1, Number(frame.yaw) || 0))) * .27 * gear;
    }
  };
  aircraft.updateMatrixWorld(true);
  return aircraft;
}

export default createAtelierJet;
