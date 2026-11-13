import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { createArcher, canonicalBoneName } from '../archer-rig-v6.js';
import {
  launchSpeed, launchVelocity, createArrow, stepArrow,
  predictTrajectory, solvePitchForDistance
} from '../physics-v6.js';

// Load the shipped model and actual skeleton in Node. Only browser-dependent
// material/image declarations are stripped, exclusively in memory. Original
// vertex, skin-weight, bone and inverse-bind data are preserved; no test assets
// or extracted textures are written to disk.
async function loadActualRig() {
  const bytes = await readFile(new URL('../assets/archer-realistic.glb', import.meta.url));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'source must be a GLB');
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  delete json.images;
  delete json.textures;
  delete json.materials;
  delete json.samplers;
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) delete primitive.material;
  const encoded = Buffer.from(JSON.stringify(json));
  const paddedLength = Math.ceil(encoded.length / 4) * 4;
  const binaryChunks = bytes.subarray(20 + jsonLength);
  const memoryGLB = Buffer.alloc(20 + paddedLength + binaryChunks.length, 0x20);
  memoryGLB.writeUInt32LE(0x46546c67, 0);
  memoryGLB.writeUInt32LE(2, 4);
  memoryGLB.writeUInt32LE(memoryGLB.length, 8);
  memoryGLB.writeUInt32LE(paddedLength, 12);
  memoryGLB.writeUInt32LE(0x4e4f534a, 16);
  encoded.copy(memoryGLB, 20);
  binaryChunks.copy(memoryGLB, 20 + paddedLength);
  const arrayBuffer = memoryGLB.buffer.slice(memoryGLB.byteOffset, memoryGLB.byteOffset + memoryGLB.length);
  const gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(arrayBuffer, '', resolve, reject));
  return createArcher(THREE, { gltf });
}

const rig = await loadActualRig();
const bonePosition = name => rig.getBone(name).getWorldPosition(new THREE.Vector3());

test('semantic bones accept Biped, sanitized Biped and Mixamo without renaming source joints', () => {
  for(const [source,expected] of [
    ['Bip01 L UpperArm','LeftArm'],['Bip01_R_Forearm','RightForeArm'],
    ['Bip01LHand','LeftHand'],['Bip01 L Finger2','LeftHandMiddle1'],
    ['Bip01 R Finger21','RightHandMiddle2'],['Bip01 R Finger22','RightHandMiddle3'],
    ['Bip01 L Finger0','LeftHandThumb1'],['Bip01 L Thigh','LeftUpLeg'],
    ['Bip01 R Calf','RightLeg'],['Bip01 Pelvis','Hips'],
    ['mixamorig:LeftHandMiddle1','LeftHandMiddle1']
  ])assert.equal(canonicalBoneName(source),expected);
  assert.match(rig.getBone('LeftArm').name,/Bip01/);
});

test('actual skinned rig: 396 yaw/pitch/draw/release attachment combinations', t => {
  let tested = 0, maxLeft = 0, maxRight = 0, maxFeet = 0, maxDirection = 0;
  for (const yaw of [-.42, 0, .42]) for (const pitch of [-.14, .055, .20, .37]) {
    for (let i = 0; i <= 10; i++) for (const release of [0, .5, 1]) {
      rig.update({ yaw, pitch, draw: i / 10, release, time: 3 });
      const diagnostics = rig.getRigDiagnostics();
      assert.equal(diagnostics.bones, 80);
      assert.equal(diagnostics.meshType, 'SkinnedMesh');
      maxLeft = Math.max(maxLeft, diagnostics.leftWristError);
      maxRight = Math.max(maxRight, diagnostics.rightWristError);
      maxFeet = Math.max(maxFeet,diagnostics.leftFootError,diagnostics.rightFootError);
      const expected = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
      maxDirection = Math.max(maxDirection, expected.distanceTo(rig.getArrowDirection()));
      assert(rig.getMuzzlePosition().toArray().every(Number.isFinite));
      tested++;
    }
  }
  assert.equal(tested, 396);
  assert(maxLeft < .0001, `left wrist error ${maxLeft}`);
  assert(maxRight < .0001, `right wrist error ${maxRight}`);
  assert(maxFeet < .0001, `foot planting error ${maxFeet}`);
  assert(maxDirection < 1e-10, `arrow direction error ${maxDirection}`);
  t.diagnostic(JSON.stringify({ tested, maxLeft, maxRight, maxFeet, maxDirection }));
});

test('full draw has a near-straight, not locked bow arm; idle elbows are lowered', t => {
  rig.update({ yaw: 0, pitch: .055, draw: 1, release: 0, time: 3 });
  const shoulder = bonePosition('LeftArm'), elbow = bonePosition('LeftForeArm'), wrist = bonePosition('LeftHand');
  const angle = shoulder.sub(elbow).angleTo(wrist.sub(elbow)) * 180 / Math.PI;
  assert(angle > 155 && angle < 176, `full-draw elbow angle ${angle}`);
  const arrow = rig.group.getObjectByName('connected-recurve-bow').getObjectByName('archery-arrow');
  assert(rig.getMuzzlePosition().distanceTo(arrow.getWorldPosition(new THREE.Vector3())) < 1e-10);
  rig.update({ yaw: 0, pitch: .055, draw: 0, release: 0, time: 3 });
  assert(bonePosition('LeftForeArm').y < bonePosition('LeftArm').y);
  assert(bonePosition('RightForeArm').y < bonePosition('RightArm').y);
  t.diagnostic(`full-draw elbow angle: ${angle.toFixed(3)} degrees`);
});

test('draw animation keeps both wrists continuous and attached', () => {
  let previousLeft, previousRight;
  for (let i = 0; i <= 100; i++) {
    rig.update({ yaw: 0, pitch: .055, draw: i / 100, release: 0, time: 3 });
    const left = bonePosition('LeftHand'), right = bonePosition('RightHand');
    if (previousLeft) {
      assert(left.distanceTo(previousLeft) < .02);
      assert(right.distanceTo(previousRight) < .02);
    }
    previousLeft = left; previousRight = right;
  }
});

test('head looks downrange, feet stay planted, and repeated solves do not accumulate drift', () => {
  const pose={yaw:0,pitch:0,draw:1,release:0,time:3};
  rig.update(pose);
  const diagnostics=rig.getRigDiagnostics();
  assert(diagnostics.headForward[2]<-.98,`head should face -Z, got ${diagnostics.headForward}`);
  assert(Math.abs(diagnostics.headForward[0])<.12);
  const names=['Head','Neck','LeftHand','RightHand','LeftFoot','RightFoot'];
  const first=names.map(name=>bonePosition(name));
  for(let i=0;i<100;i++)rig.update({yaw:.4*Math.sin(i),pitch:.3*Math.sin(i*.7),draw:(i%11)/10,release:(i%3)/2,time:i*.13});
  rig.update(pose);
  names.forEach((name,i)=>assert(bonePosition(name).distanceTo(first[i])<1e-9,`${name} accumulated pose drift`));
  assert(rig.group.getObjectByName('leather-quiver-shoulder-strap'));
});

test('full-draw string nock anchors beside the actual jaw instead of in front of the mouth', () => {
  for(const pitch of [-.14,0,.2,.37]){
    rig.update({yaw:0,pitch,draw:1,release:0,time:3});
    const bow=rig.group.getObjectByName('connected-recurve-bow');
    const arrow=bow.getObjectByName('archery-arrow');
    const nock=arrow.localToWorld(new THREE.Vector3(0,0,.84));
    const lip=bonePosition('MBottomLip');
    const jaw=bonePosition('MJaw');
    assert(nock.distanceTo(jaw)<.12,`nock must stay beside jaw; pitch ${pitch}: ${nock.distanceTo(jaw)}`);
    assert(nock.z-lip.z>.07,'string hand belongs at the side of jaw, not in front of mouth');
    assert(nock.y<lip.y,'nock should anchor below the lower lip');
    assert(bonePosition('RightHand').distanceTo(nock)<.06,'drawing wrist must stay at string');
  }
});

test('idle arm clears the chest and full-draw elbow is behind its shoulder', t => {
  rig.update({yaw:0,pitch:.055,draw:0,release:0,time:3});
  const shoulder=bonePosition('RightArm'),elbow=bonePosition('RightForeArm'),wrist=bonePosition('RightHand');
  t.diagnostic(JSON.stringify({idle:{shoulder:shoulder.toArray(),elbow:elbow.toArray(),wrist:wrist.toArray()}}));
  assert(elbow.x>.16,'idle elbow must stay in front of the torso');
  assert(wrist.x>.20,'idle string hand must not enter the chest');
  for(const [a,b] of [[shoulder,elbow],[elbow,wrist]])for(const u of [.3,.5,.7,.9]){
    const p=a.clone().lerp(b,u);
    if(p.y>1.05&&p.y<1.37)assert(((p.x-.02)/.135)**2+(p.z/.175)**2>1,'arm segment enters torso cross-section');
  }
  rig.update({yaw:0,pitch:.055,draw:1,release:0,time:3});
  const fullShoulder=bonePosition('RightArm'),fullElbow=bonePosition('RightForeArm');
  t.diagnostic(JSON.stringify({full:{shoulder:fullShoulder.toArray(),elbow:fullElbow.toArray()}}));
  assert(fullElbow.z>fullShoulder.z+.015,'full-draw elbow must pull behind shoulder');
  assert(fullElbow.y<fullShoulder.y+.22,'full-draw elbow must not raise toward the ear');
});

test('physical muzzle, preview and fired arrow agree at the real center target', t => {
  const target = { center: { x: 0, y: 1.7, z: -17 }, radius: .95, index: 1 };
  let yaw = 0, pitch = .055;
  for (let i = 0; i < 6; i++) {
    rig.update({ yaw, pitch, draw: 1, release: 0, time: 3 });
    const p = rig.getMuzzlePosition();
    yaw = Math.atan2(target.center.x - p.x, p.z - target.center.z);
    pitch = solvePitchForDistance(Math.hypot(target.center.x - p.x, p.z - target.center.z), target.center.y - p.y, launchSpeed(1));
  }
  rig.update({ yaw, pitch, draw: 1, release: 0, time: 3 });
  const origin = rig.getMuzzlePosition();
  const velocity = launchVelocity(yaw, pitch, launchSpeed(1));
  assert(rig.getArrowDirection().multiplyScalar(launchSpeed(1)).distanceTo(new THREE.Vector3(velocity.x, velocity.y, velocity.z)) < 1e-10);
  const preview = predictTrajectory(origin, velocity, [target]);
  const fired = createArrow(origin, velocity);
  let impact;
  for (let i = 0; i < 960 && fired.active; i++) impact = stepArrow(fired, 1 / 120, [target]);
  assert.equal(impact?.type, 'target');
  assert.equal(impact.points, 10);
  assert(impact.radialDistance < 1e-7);
  assert.equal(preview.impact?.type, 'target');
  assert(Math.hypot(impact.position.x - preview.impact.position.x, impact.position.y - preview.impact.position.y) < 1e-8);
  t.diagnostic(JSON.stringify({ yaw, pitch, muzzle: origin.toArray(), radialDistance: impact.radialDistance, flightTime: impact.age }));
});

test('100-update diagnostic timing (host only; not a mobile FPS claim)', t => {
  for (let i = 0; i < 20; i++) rig.update({ draw: i / 20, time: i / 60 });
  const start = performance.now();
  for (let i = 0; i < 100; i++) rig.update({ draw: (i % 50) / 50, yaw: .08, pitch: .055, release: 0, time: i / 60 });
  const duration = performance.now() - start;
  assert(Number.isFinite(duration));
  t.diagnostic(`${duration.toFixed(2)} ms for 100 updates; ${(duration / 100).toFixed(3)} ms/update on this execution host. Rendering is not included.`);
});
