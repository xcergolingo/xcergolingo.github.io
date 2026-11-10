import * as THREE from './vendor/three.module.js';
import { createAircraft as createSourceAircraft } from './silver-jet-source.js';

// The source factory is copied verbatim from Silver Jet Study, commit
// c53fed62e96222937e75973f5e1330b49b0c7ddf. Adaptations live in this file.
export const SILVER_JET_SCALE = .43;
export const SILVER_JET_GROUND_CLEARANCE = .75;

const clamp = (v, low, high) => Math.max(low, Math.min(high, v));

// Merge only siblings with the same material and render state. Existing groups
// remain intact, so the source's tailplane hinges, canopy, and pilot head keep
// their independent transforms and visibility. Indexed vertices, normals, UVs,
// and the pilot's vertex colors are retained without changing the model shape.
function batchStaticChildren(group) {
  for (const child of [...group.children]) {
    if (child.isGroup) batchStaticChildren(child);
  }
  const batches = new Map();
  for (const child of group.children) {
    if (!child.isMesh || child.isSkinnedMesh || Array.isArray(child.material) || child.material.transparent) continue;
    const key = `${child.material.uuid}/${child.castShadow}/${child.receiveShadow}/${child.renderOrder}`;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(child);
  }
  for (const parts of batches.values()) {
    if (parts.length < 2) continue;
    const geometries = parts.map(part => {
      part.updateMatrix();
      return part.geometry.clone().applyMatrix4(part.matrix);
    });
    const totalVertices = geometries.reduce((n, geometry) => n + geometry.attributes.position.count, 0);
    const totalIndices = geometries.reduce((n, geometry) => n + (geometry.index?.count ?? geometry.attributes.position.count), 0);
    const geometry = new THREE.BufferGeometry();
    const attributes = new Set(geometries.flatMap(g => Object.keys(g.attributes)));
    for (const name of attributes) {
      const sample = geometries.find(g => g.attributes[name]).attributes[name];
      const array = new Float32Array(totalVertices * sample.itemSize);
      let offset = 0;
      for (const source of geometries) {
        const count = source.attributes.position.count * sample.itemSize;
        if (source.attributes[name]) array.set(source.attributes[name].array, offset);
        else if (name === 'color') array.fill(1, offset, offset + count);
        offset += count;
      }
      geometry.setAttribute(name, new THREE.BufferAttribute(array, sample.itemSize));
    }
    const indices = totalVertices > 65535 ? new Uint32Array(totalIndices) : new Uint16Array(totalIndices);
    let indexOffset = 0, vertexOffset = 0;
    for (const source of geometries) {
      const count = source.index?.count ?? source.attributes.position.count;
      for (let i = 0; i < count; i++) indices[indexOffset++] = vertexOffset + (source.index ? source.index.getX(i) : i);
      vertexOffset += source.attributes.position.count;
    }
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const first = parts[0], merged = new THREE.Mesh(geometry, first.material);
    merged.name = `Silver Jet • ${parts.length} static details`;
    merged.castShadow = first.castShadow;
    merged.receiveShadow = first.receiveShadow;
    merged.renderOrder = first.renderOrder;
    merged.userData.sourceNames = parts.map(part => part.name);
    for (const part of parts) {
      group.remove(part);
      part.geometry.dispose();
    }
    for (const source of geometries) source.dispose();
    group.add(merged);
  }
}

function addMesh(parent, name, geometry, material, position = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material);
  object.name = name;
  object.position.set(...position);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function strut(parent, name, material, start, end, radius, sides = 10) {
  const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
  const direction = b.clone().sub(a);
  const object = addMesh(parent, name, new THREE.CylinderGeometry(radius, radius, direction.length(), sides), material);
  object.position.copy(a.add(b).multiplyScalar(.5));
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return object;
}

function addLandingGear(aircraft) {
  const fixed = new THREE.Group();
  fixed.name = 'Silver Jet • extended tricycle landing gear';
  aircraft.add(fixed);
  const alloy = new THREE.MeshStandardMaterial({ color: 0xb5c0c5, metalness: .68, roughness: .3 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xc6d1d3, metalness: .8, roughness: .2 });
  const door = new THREE.MeshStandardMaterial({ color: 0x9caab2, metalness: .48, roughness: .5 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x242a2d, metalness: .02, roughness: .92 });
  const hubs = new THREE.MeshStandardMaterial({ color: 0x687780, metalness: .65, roughness: .34 });
  const wheels = [];

  function wheel(parent, name, position, radius, width) {
    const assembly = new THREE.Group();
    assembly.name = name;
    assembly.position.set(...position);
    parent.add(assembly);
    const tire = new THREE.TorusGeometry(radius * .81, radius * .19, 8, 24);
    tire.rotateY(Math.PI / 2);
    tire.scale(width / (radius * .38), 1, 1);
    addMesh(assembly, `${name} • rounded tire`, tire, rubber);
    const core = new THREE.CylinderGeometry(radius * .87, radius * .87, width * .82, 24);
    core.rotateZ(Math.PI / 2);
    addMesh(assembly, `${name} • tire sidewalls`, core, rubber);
    const rim = new THREE.CylinderGeometry(radius * .49, radius * .49, width * .86, 20);
    rim.rotateZ(Math.PI / 2);
    addMesh(assembly, `${name} • alloy hub`, rim, alloy);
    const axle = new THREE.CylinderGeometry(radius * .16, radius * .16, width * 1.04, 12);
    axle.rotateZ(Math.PI / 2);
    addMesh(assembly, `${name} • axle caps`, axle, hubs);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const angle = i / 5 * Math.PI * 2;
        const bolt = new THREE.CylinderGeometry(radius * .035, radius * .035, .003, 5);
        bolt.rotateZ(Math.PI / 2);
        addMesh(assembly, `${name} • rim fastener`, bolt, hubs, [side * width * .44, Math.cos(angle) * radius * .33, Math.sin(angle) * radius * .33]);
      }
    }
    batchStaticChildren(assembly);
    wheels.push({ object: assembly, radius });
    return assembly;
  }

  for (const side of [-1, 1]) {
    const label = side < 0 ? 'left main' : 'right main';
    strut(fixed, `${label} upper oleo`, alloy, [side * .47, -.19, .19], [side * .58, -.48, .42], .027);
    strut(fixed, `${label} chrome slider`, chrome, [side * .56, -.425, .39], [side * .60, -.585, .46], .016);
    strut(fixed, `${label} axle`, alloy, [side * .59, -.585, .46], [side * .66, -.585, .46], .021);
    strut(fixed, `${label} drag brace`, alloy, [side * .34, -.22, -.02], [side * .58, -.49, .42], .014);
    strut(fixed, `${label} torque link upper`, hubs, [side * .58, -.43, .43], [side * .62, -.49, .50], .009, 6);
    strut(fixed, `${label} torque link lower`, hubs, [side * .62, -.49, .50], [side * .60, -.55, .47], .009, 6);
    const panel = addMesh(fixed, `${label} open bay door`, new THREE.BoxGeometry(.014, .23, .35), door, [side * .43, -.32, .21]);
    panel.rotation.z = side * .16;
    wheel(aircraft, `${label} wheel`, [side * .66, -.585, .46], .14, .084);
  }

  strut(fixed, 'nose gear upper oleo', alloy, [0, -.18, -1.67], [0, -.43, -1.65], .023);
  strut(fixed, 'nose gear chrome slider', chrome, [0, -.35, -1.65], [0, -.49, -1.65], .013);
  strut(fixed, 'nose gear drag brace', alloy, [0, -.19, -1.46], [0, -.40, -1.65], .012);
  for (const side of [-1, 1]) {
    const panel = addMesh(fixed, 'nose gear open bay door', new THREE.BoxGeometry(.008, .14, .37), door, [side * .074, -.25, -1.72]);
    panel.rotation.z = side * .15;
  }
  const noseSteer = new THREE.Group();
  noseSteer.name = 'Silver Jet • nose gear steering';
  noseSteer.position.set(0, -.46, -1.65);
  aircraft.add(noseSteer);
  for (const side of [-1, 1]) {
    strut(noseSteer, 'nose wheel fork', alloy, [side * .048, -.005, 0], [side * .048, -.155, 0], .009, 8);
  }
  strut(noseSteer, 'nose wheel axle', chrome, [-.058, -.155, 0], [.058, -.155, 0], .012);
  wheel(noseSteer, 'nose wheel', [0, -.155, 0], .11, .064);
  batchStaticChildren(fixed);
  // Only the fork's own meshes are batched; the rotating wheel stays a group.
  batchStaticChildren(noseSteer);
  return { wheels, noseSteer };
}

export function createSilverJet() {
  const aircraft = new THREE.Group();
  aircraft.name = 'RC Silver Jet';
  const model = createSourceAircraft(THREE);
  model.scale.setScalar(SILVER_JET_SCALE);
  aircraft.add(model);
  const sourceBounds = new THREE.Box3().setFromObject(model);
  const size = sourceBounds.getSize(new THREE.Vector3());
  const head = model.getObjectByName('Pilot • head and headset');
  const canopy = model.getObjectByName('Canopy • clear smoke-tinted bubble');
  const leftElevon = model.getObjectByName('tailplane-left');
  const rightElevon = model.getObjectByName('tailplane-right');
  batchStaticChildren(model);
  const landingGear = addLandingGear(aircraft);

  // A restrained glow just inside the original rectangular exhaust mouths.
  const jetThrustMaterial = new THREE.MeshStandardMaterial({
    color: 0x190b06, emissive: 0xff6a29, emissiveIntensity: .1,
    transparent: true, opacity: .25, roughness: 1, metalness: 0,
    depthWrite: false, toneMapped: false
  });
  const exhausts = [-1, 1].map(side => {
    const glow = addMesh(aircraft, `Silver Jet • ${side < 0 ? 'left' : 'right'} exhaust glow`, new THREE.PlaneGeometry(.27, .083), jetThrustMaterial, [side * .565 * SILVER_JET_SCALE, -.065 * SILVER_JET_SCALE, 5.005 * SILVER_JET_SCALE]);
    glow.castShadow = false;
    glow.receiveShadow = false;
    return glow;
  });

  aircraft.userData = {
    type: 'jet', span: size.x, length: size.z,
    groundClearance: SILVER_JET_GROUND_CLEARANCE,
    sourceScale: SILVER_JET_SCALE,
    sourceModel: model,
    source: 'Silver Jet Study · c53fed62e96222937e75973f5e1330b49b0c7ddf',
    controlSurfaces: { leftElevon, rightElevon },
    // All coordinates are metres relative to this unscaled outer group.
    // The cockpit eye sits above the panel and in front of the seat, looking
    // slightly down so the original multifunction displays remain in frame.
    cameraMounts: {
      cockpit: { position: [0, .405, -1.39], target: [0, .10, -8], fov: 72, near: .025 },
      nose: { position: [0, .18, -2.38], target: [0, .14, -12], fov: 78, near: .025 },
      leftWing: { position: [-1.96, .19, .95], target: [-.4, .13, -7], fov: 82, near: .05 },
      rightWing: { position: [1.96, .19, .95], target: [.4, .13, -7], fov: 82, near: .05 },
      tail: { position: [0, .92, 2.52], target: [0, .15, -7], fov: 78, near: .05 }
    },
    // The glass and the pilot's head are restored for every other camera.
    // Keep the torso, hands, cockpit, canopy frame, and HUD visible onboard.
    cockpitHide: [head, canopy].filter(Boolean),
    landingGear, jetThrustMaterial, exhausts,
    animate(dt, frame = {}) {
      const throttle = clamp(Number(frame.throttle) || 0, 0, 1);
      jetThrustMaterial.emissiveIntensity = .06 + .75 * throttle ** 1.6;
      jetThrustMaterial.opacity = .20 + .45 * throttle;
      const speed = Math.max(0, Number(frame.speed ?? frame.airspeed) || 0);
      if (frame.grounded && Number.isFinite(dt)) {
        for (const wheel of landingGear.wheels) wheel.object.rotation.x -= speed * Math.max(0, dt) / wheel.radius;
      }
      landingGear.noseSteer.rotation.y = -clamp(Number(frame.yaw) || 0, -1, 1) * .27;
    }
  };
  aircraft.updateMatrixWorld(true);
  return aircraft;
}

export default createSilverJet;
