import { GLTFLoader } from './vendor/GLTFLoader.js';

// The archer is a real skinned, textured human mesh. All motion below is a
// continuous skeletal pose: no pose sheets, frame swapping, or screen-space limbs.
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const mix = (a, b, t) => a + (b - a) * t;

/** Semantic aliases preserve the source bone names and inverse bind matrices. */
export function canonicalBoneName(name) {
  const compact = name.replace(/[\s:_-]/g, '');
  if (/^mixamorig/i.test(compact)) return compact.replace(/^mixamorig/i, '');
  const biped = compact.replace(/^Bip\d+/i, '');
  if (biped === 'Pelvis') return 'Hips';
  const limb = /^([LR])(Clavicle|UpperArm|Forearm|Hand|Thigh|Calf|Foot|Toe0)$/i.exec(biped);
  if (limb) {
    const side = limb[1].toUpperCase() === 'L' ? 'Left' : 'Right';
    const part = {clavicle:'Shoulder',upperarm:'Arm',forearm:'ForeArm',hand:'Hand',thigh:'UpLeg',calf:'Leg',foot:'Foot',toe0:'ToeBase'}[limb[2].toLowerCase()];
    return side + part;
  }
  const finger = /^([LR])Finger([0-4])([12]?)$/i.exec(biped);
  if (finger) return (finger[1].toUpperCase() === 'L' ? 'Left' : 'Right') + 'Hand' + ['Thumb','Index','Middle','Ring','Pinky'][Number(finger[2])] + (finger[3] ? Number(finger[3]) + 1 : 1);
  return biped;
}

/** Two-bone geometry used for arms and planted legs. All inputs share one space. */
export function solveTwoBonePoints(THREE, start, end, pole, upperLength, lowerLength) {
  const forward = end.clone().sub(start);
  const rawDistance = forward.length();
  if (rawDistance < 1e-7) forward.set(0, 0, -1); else forward.divideScalar(rawDistance);
  const distance = clamp(rawDistance, Math.abs(upperLength - lowerLength) + .0001, upperLength + lowerLength - .0001);
  const along = (upperLength * upperLength - lowerLength * lowerLength + distance * distance) / (2 * distance);
  const side = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
  const bend = pole.clone().sub(start).addScaledVector(forward, -pole.clone().sub(start).dot(forward));
  if (bend.lengthSq() < .000001) {
    bend.crossVectors(forward, new THREE.Vector3(0, 1, 0));
    if (bend.lengthSq() < .000001) bend.set(1, 0, 0);
  }
  bend.normalize();
  return {
    elbow: start.clone().addScaledVector(forward, along).addScaledVector(bend, side),
    wrist: start.clone().addScaledVector(forward, distance),
    reachable: rawDistance <= upperLength + lowerLength && rawDistance >= Math.abs(upperLength - lowerLength)
  };
}

/** Projectile origin is its metal tip; local forward is -Z. Length is 84 cm. */
export function createArrowMesh(THREE) {
  const arrow = new THREE.Group();
  arrow.name = 'archery-arrow';
  const carbon = new THREE.MeshStandardMaterial({ color: 0x352e29, roughness: .42, metalness: .12 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xaab9bc, roughness: .3, metalness: .85 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf5e9c5, roughness: .7, side: THREE.DoubleSide });
  const orange = new THREE.MeshStandardMaterial({ color: 0xe19e3b, roughness: .62, side: THREE.DoubleSide });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.0032, .0032, .79, 7), carbon);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = .425;
  arrow.add(shaft);
  const point = new THREE.Mesh(new THREE.ConeGeometry(.0105, .055, 5), metal);
  point.rotation.x = -Math.PI / 2;
  point.position.z = .0275;
  arrow.add(point);
  const nock = new THREE.Mesh(new THREE.CylinderGeometry(.0044, .0044, .021, 6), orange);
  nock.rotation.x = Math.PI / 2;
  nock.position.z = .830;
  arrow.add(nock);
  const feather = new THREE.Shape();
  feather.moveTo(0, 0); feather.lineTo(.075, .018); feather.quadraticCurveTo(.093, .015, .103, 0); feather.closePath();
  const featherGeometry = new THREE.ShapeGeometry(feather);
  for (let i = 0; i < 3; i++) {
    const vane = new THREE.Mesh(featherGeometry, i === 0 ? orange : white);
    vane.rotation.y = -Math.PI / 2;
    const vaneGroup = new THREE.Group();
    vaneGroup.rotation.z = i * Math.PI * 2 / 3;
    vaneGroup.position.z = .705;
    vaneGroup.add(vane);
    arrow.add(vaneGroup);
  }
  arrow.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return arrow;
}

function makeBow(THREE) {
  const bow = new THREE.Group();
  bow.name = 'connected-recurve-bow';
  const wood = new THREE.MeshStandardMaterial({ color: 0x684529, roughness: .48, metalness: .04 });
  const laminate = new THREE.MeshStandardMaterial({ color: 0xb58b4c, roughness: .4, metalness: .18 });
  const gripMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2922, roughness: .88 });
  const stringMaterial = new THREE.MeshStandardMaterial({ color: 0xf0dfb4, roughness: .7 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xd9b361, roughness: .35, metalness: .66 });
  const limbs = [];
  const segments = 26, radial = 8;
  for (const sign of [-1, 1]) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array((segments + 1) * radial * 3);
    const indices = [];
    for (let i = 0; i < segments; i++) for (let j = 0; j < radial; j++) {
      const a = i * radial + j, b = i * radial + (j + 1) % radial, c = a + radial, d = b + radial;
      indices.push(a, c, b, b, c, d);
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setIndex(indices);
    const mesh = new THREE.Mesh(geometry, wood);
    mesh.castShadow = true;
    bow.add(mesh);
    // A fine center lamination catches the side light without a heavy glow.
    const strip = new THREE.Mesh(geometry.clone(), laminate);
    strip.scale.x = .26;
    strip.position.x = .001;
    strip.castShadow = true;
    bow.add(strip);
    limbs.push({ sign, mesh, geometry, strip, positions });
  }
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.024, .025, .17, 12), gripMaterial);
  grip.rotation.z = -.035;
  grip.castShadow = true;
  bow.add(grip);
  for (let i = -4; i <= 4; i++) {
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(.025, .0015, 5, 15), laminate);
    wrap.rotation.x = Math.PI / 2;
    wrap.position.y = i * .017;
    bow.add(wrap);
  }
  const rest = new THREE.Mesh(new THREE.BoxGeometry(.052, .008, .035), brass);
  rest.position.set(-.009, .055, -.015);
  bow.add(rest);
  const serving = new THREE.Mesh(new THREE.SphereGeometry(.006, 8, 6), brass);
  bow.add(serving);
  const stringGeometry = new THREE.CylinderGeometry(.0022, .0022, 1, 6);
  const strings = [new THREE.Mesh(stringGeometry, stringMaterial), new THREE.Mesh(stringGeometry, stringMaterial)];
  strings.forEach(s => { s.castShadow = true; bow.add(s); });
  const nockedArrow = createArrowMesh(THREE);
  bow.add(nockedArrow);
  const axisY = new THREE.Vector3(0, 1, 0);
  const top = new THREE.Vector3(), bottom = new THREE.Vector3(), nock = new THREE.Vector3();
  const positionSegment = (mesh, a, b) => {
    const delta = b.clone().sub(a);
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.scale.set(1, delta.length(), 1);
    mesh.quaternion.setFromUnitVectors(axisY, delta.normalize());
  };
  function update(draw, release, time, drawLength = .44) {
    for (const limb of limbs) {
      let o = 0;
      for (let i = 0; i <= segments; i++) {
        const u = i / segments;
        const y = limb.sign * (.08 + (.65 - .025 * draw) * u);
        const z = .02 + .11 * Math.sin(Math.PI * u) + .015 * u + draw * .13 * u * u - .035 * Math.sin(Math.PI * 2 * u);
        const dy = limb.sign * (.65 - .025 * draw);
        const dz = .11 * Math.PI * Math.cos(Math.PI * u) + .015 + draw * .26 * u - .07 * Math.PI * Math.cos(Math.PI * 2 * u);
        const length = Math.hypot(dy, dz);
        const ny = -dz / length, nz = dy / length;
        const width = mix(.0205, .011, u), depth = mix(.0075, .0045, u);
        for (let j = 0; j < radial; j++) {
          const angle = j * Math.PI * 2 / radial;
          limb.positions[o++] = Math.cos(angle) * width;
          limb.positions[o++] = y + Math.sin(angle) * depth * ny;
          limb.positions[o++] = z + Math.sin(angle) * depth * nz;
        }
      }
      limb.geometry.attributes.position.needsUpdate = true;
      limb.geometry.computeVertexNormals();
      limb.geometry.computeBoundingSphere();
      limb.strip.geometry.attributes.position.array.set(limb.positions);
      limb.strip.geometry.attributes.position.needsUpdate = true;
      limb.strip.geometry.computeVertexNormals();
      limb.strip.geometry.computeBoundingSphere();
    }
    top.set(0, .73 - .025 * draw, .035 + .13 * draw);
    bottom.set(0, -.73 + .025 * draw, .035 + .13 * draw);
    nock.set(Math.sin(time * 73) * release * .009, .055, .18 + drawLength * draw);
    positionSegment(strings[0], top, nock);
    positionSegment(strings[1], nock, bottom);
    serving.position.copy(nock);
    nockedArrow.position.set(0, .055, nock.z - .84);
    nockedArrow.visible = release < .065;
  }
  update(0, 0, 0);
  return { group: bow, update, nockedArrow, nock };
}

function addQuiver(THREE, group) {
  const quiver = new THREE.Group();
  quiver.position.set(-.18, 1.16, .12);
  quiver.rotation.set(-.18, .07, -.16);
  const leather = new THREE.MeshStandardMaterial({ color: 0x453329, roughness: .91 });
  const piping = new THREE.MeshStandardMaterial({ color: 0x997550, roughness: .58 });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(.070, .052, .49, 12, 1, true), leather);
  tube.castShadow = true;
  quiver.add(tube);
  for (const y of [-.23, .21, .235]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(y < 0 ? .053 : .071, .005, 5, 15), piping);
    rim.rotation.x = Math.PI / 2; rim.position.y = y;
    quiver.add(rim);
  }
  for (let i = 0; i < 5; i++) {
    const a = createArrowMesh(THREE);
    a.rotation.x = -Math.PI / 2;
    a.position.set(Math.cos(i * 2.4) * .036, -.17, Math.sin(i * 2.4) * .031);
    a.scale.setScalar(.82);
    quiver.add(a);
  }
  group.add(quiver);
  // A slim leather sling follows the shoulder/chest/back, rather than leaving
  // the quiver apparently floating behind the athlete.
  const strapCurve=new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.105,1.37,-.16),new THREE.Vector3(.018,1.405,-.17),
    new THREE.Vector3(.165,1.28,-.09),new THREE.Vector3(.145,1.08,.09),
    new THREE.Vector3(.07,.97,.15),new THREE.Vector3(-.125,1.03,.13),
    new THREE.Vector3(-.19,1.22,-.015)
  ],true,'centripetal');
  const ribbonPositions=[],ribbonIndices=[],strapSamples=64;
  for(let i=0;i<=strapSamples;i++){
    const u=i/strapSamples,p=strapCurve.getPointAt(u),t=strapCurve.getTangentAt(u);
    let across=new THREE.Vector3(1,0,0).cross(t);
    if(across.lengthSq()<.01)across=new THREE.Vector3(0,0,1).cross(t);
    across.normalize().multiplyScalar(.013);
    ribbonPositions.push(...p.clone().sub(across).toArray(),...p.clone().add(across).toArray());
    if(i<strapSamples){const n=i*2;ribbonIndices.push(n,n+1,n+2,n+1,n+3,n+2);}
  }
  const ribbonGeometry=new THREE.BufferGeometry();
  ribbonGeometry.setAttribute('position',new THREE.Float32BufferAttribute(ribbonPositions,3));
  ribbonGeometry.setIndex(ribbonIndices);ribbonGeometry.computeVertexNormals();
  const strap=new THREE.Mesh(ribbonGeometry,new THREE.MeshStandardMaterial({color:0x48362b,roughness:.86,side:THREE.DoubleSide}));
  strap.name='leather-quiver-shoulder-strap';strap.castShadow=true;strap.receiveShadow=true;
  group.add(strap);quiver.userData.strap=strap;
  return quiver;
}

/**
 * Arguments: radians; positive yaw aims toward +X, positive pitch upward.
 * draw is 0..1. release is the follow-through envelope (1 immediately after release,
 * fading to 0 over roughly .45 sec). time is seconds. Group ground origin is (0,0,0).
 */
export async function createArcher(THREE, { gltf: suppliedGltf } = {}) {
  const loader = new GLTFLoader();
  const gltf = suppliedGltf || await loader.loadAsync(new URL('./assets/archer-realistic.glb', import.meta.url).href);
  const group = new THREE.Group();
  group.name = 'GoLingo-skinned-archer';
  const stance = new THREE.Group();
  stance.name = 'open-archery-stance';
  stance.rotation.y = Math.PI / 2;
  group.add(stance);
  const sourceModel = gltf.scene;
  const model = new THREE.Group();
  model.name = 'normalized-human-model';
  model.add(sourceModel);
  sourceModel.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(sourceModel);
  const size = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y < .01) throw new Error('Archer model has invalid standing height');
  const factor = 1.78 / size.y;
  model.scale.setScalar(factor);
  model.position.y = -bounds.min.y * factor + .003;
  const baseModelY = model.position.y;
  stance.add(model);
  const bones = new Map(), rest = new Map();
  model.traverse(o => {
    if (o.isBone) {
      const name = canonicalBoneName(o.name);
      bones.set(name, o);
      rest.set(o, { q: o.quaternion.clone(), p: o.position.clone() });
    }
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true;
      const meshMaterials=Array.isArray(o.material)?o.material:[o.material];
      // Thin alpha-cutout hair cards should not stamp coarse self-shadow patches.
      // The opaque head/body still cast shadows, and the hair still receives light.
      if(meshMaterials.length&&meshMaterials.every(material=>material?.name==='f006_opacity'))o.castShadow=false;
      // Skinned bounds change in IK; the small single character should never pop out.
      o.frustumCulled = false;
      for (const material of meshMaterials) {
        // Preserve the authored face/body normal maps and separate skin/cloth roughness.
        if (material.roughness == null) material.roughness = .78;
        if (material.metalness != null) material.metalness = 0;
        material.envMapIntensity = .6;
      }
    }
  });
  const required = ['LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot', 'Head', 'Neck'];
  for (const name of required) if (!bones.has(name)) throw new Error('Archer skeleton is missing ' + name);
  const bow = makeBow(THREE);
  group.add(bow.group);
  const quiver = addQuiver(THREE, group);
  group.updateMatrixWorld(true);
  const v = () => new THREE.Vector3();
  const q = () => new THREE.Quaternion();
  const axisX = new THREE.Vector3(1, 0, 0), axisY = new THREE.Vector3(0, 1, 0);
  const arm = side => {
    const a = bones.get(side + 'Arm'), b = bones.get(side + 'ForeArm'), c = bones.get(side + 'Hand');
    return { a, b, c, l1: a.getWorldPosition(v()).distanceTo(b.getWorldPosition(v())), l2: b.getWorldPosition(v()).distanceTo(c.getWorldPosition(v())) };
  };
  const leg = side => {
    const a = bones.get(side + 'UpLeg'), b = bones.get(side + 'Leg'), c = bones.get(side + 'Foot');
    return { a, b, c, l1: a.getWorldPosition(v()).distanceTo(b.getWorldPosition(v())), l2: b.getWorldPosition(v()).distanceTo(c.getWorldPosition(v())) };
  };
  const leftArm = arm('Left'), rightArm = arm('Right'), leftLeg = leg('Left'), rightLeg = leg('Right');
  const headForwardLocal=new THREE.Vector3(1,0,0).applyQuaternion(bones.get('Head').getWorldQuaternion(q()).invert());
  const isBiped = [...rest.keys()].some(bone => /^Bip\d+/i.test(bone.name));
  const footTargets = [new THREE.Vector3(-.018, leftLeg.c.getWorldPosition(v()).y, -.22), new THREE.Vector3(.014, rightLeg.c.getWorldPosition(v()).y, .22)];
  let stanceLowering = 0;
  [leftLeg,rightLeg].forEach((chain,index)=>{
    const start=chain.a.getWorldPosition(v()), target=footTargets[index];
    const horizontal=Math.hypot(start.x-target.x,start.z-target.z), reach=(chain.l1+chain.l2)*.985;
    const vertical=Math.sqrt(Math.max(0,reach*reach-horizontal*horizontal));
    stanceLowering=Math.max(stanceLowering,start.y-target.y-vertical+.003);
  });
  stanceLowering=clamp(stanceLowering,0,.09);
  const last = { leftTarget: v(), rightTarget: v(), leftFootTarget: v(), rightFootTarget: v(), draw: 0, pitch: 0, yaw: 0, fullDrawDistance: .62 };
  const handFrames = new Map(), fingerAxes = new Map();
  for (const side of ['Left','Right']) {
    const hand=bones.get(side+'Hand'), middle=bones.get(side+'HandMiddle1');
    const index=bones.get(side+'HandIndex1'), pinky=bones.get(side+'HandPinky1');
    if (!middle || !index || !pinky) continue;
    const inverse=hand.getWorldQuaternion(q()).invert();
    const forward=middle.getWorldPosition(v()).sub(hand.getWorldPosition(v())).normalize();
    const across=index.getWorldPosition(v()).sub(pinky.getWorldPosition(v()));
    across.addScaledVector(forward,-across.dot(forward)).normalize();
    const localAcross=across.clone().applyQuaternion(inverse), localForward=forward.clone().applyQuaternion(inverse);
    const basis=new THREE.Matrix4().makeBasis(localAcross,localForward,localAcross.clone().cross(localForward).normalize());
    handFrames.set(side,q().setFromRotationMatrix(basis).invert());
    // Derive flexion from each relaxed finger's actual bend plane. Biped and
    // Mixamo do not share local hinge axes, and mirrored hands need no guesswork.
    for (const finger of ['Thumb','Index','Middle','Ring','Pinky']) {
      const chain=[1,2,3].map(i=>bones.get(side+'Hand'+finger+i));
      if (chain.some(b=>!b)) continue;
      const first=chain[1].getWorldPosition(v()).sub(chain[0].getWorldPosition(v())).normalize();
      const second=chain[2].getWorldPosition(v()).sub(chain[1].getWorldPosition(v())).normalize();
      let axis=first.clone().cross(second);
      if(axis.lengthSq()<.0004){
        const normal=across.clone().cross(forward).multiplyScalar(side==='Left'?-1:1);
        axis=first.clone().cross(normal);
      }
      axis.normalize();
      for(const bone of chain)fingerAxes.set(bone,axis.clone().applyQuaternion(bone.getWorldQuaternion(q()).invert()).normalize());
    }
  }
  function setWorldQuaternion(bone, desired) {
    bone.quaternion.copy(bone.parent.getWorldQuaternion(q()).invert().multiply(desired));
    bone.updateMatrixWorld(true);
  }
  function aimBone(bone, child, direction) {
    const from = child.getWorldPosition(v()).sub(bone.getWorldPosition(v())).normalize();
    const delta = q().setFromUnitVectors(from, direction.clone().normalize());
    setWorldQuaternion(bone, delta.multiply(bone.getWorldQuaternion(q())));
  }
  function solve(chain, endpoint, pole) {
    const start = chain.a.getWorldPosition(v());
    const posed = solveTwoBonePoints(THREE, start, endpoint, pole, chain.l1, chain.l2);
    aimBone(chain.a, chain.b, posed.elbow.clone().sub(start));
    aimBone(chain.b, chain.c, posed.wrist.clone().sub(chain.b.getWorldPosition(v())));
  }
  function deltaWorld(bone, axis, amount) {
    setWorldQuaternion(bone, q().setFromAxisAngle(axis, amount).multiply(bone.getWorldQuaternion(q())));
  }
  const localToWorld = point => group.localToWorld(point.clone());
  function orientHand(side, direction, up, twist = 0) {
    const hand=bones.get(side+'Hand'), inverseBasis=handFrames.get(side);
    if(!inverseBasis)return;
    const forward=direction.clone().normalize();
    const across=up.clone().addScaledVector(forward,-up.dot(forward)).normalize();
    const normal=across.clone().cross(forward).normalize();
    const desired=q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across,forward,normal)).multiply(inverseBasis);
    setWorldQuaternion(hand,desired);
    if(twist)deltaWorld(hand,forward,twist);
  }
  function curlFingers(side, amount, release) {
    for (const finger of ['Index', 'Middle', 'Ring', 'Pinky']) for (let joint = 1; joint <= 3; joint++) {
      const b = bones.get(side + 'Hand' + finger + joint);
      if (!b) continue;
      const curl = amount * (joint === 1 ? .52 : .84);
      const hinge=fingerAxes.get(b);
      if(hinge)b.quaternion.multiply(q().setFromAxisAngle(hinge,curl));
    }
    for (let joint = 1; joint <= 3; joint++) {
      const b = bones.get(side + 'HandThumb' + joint);
      if(b&&fingerAxes.has(b))b.quaternion.multiply(q().setFromAxisAngle(fingerAxes.get(b),.18*(1-release*.6)));
    }
  }
  function update({ yaw = 0, pitch = 0, draw = 0, release = 0, time = 0 } = {}) {
    draw = clamp(draw, 0, 1); release = clamp(release, 0, 1); pitch = clamp(pitch, -.65, .85);
    last.draw = draw; last.pitch = pitch; last.yaw = yaw;
    group.rotation.y = -yaw;
    // Restoring local bind transforms before solving prevents accumulated twist drift.
    for (const [bone, base] of rest) { bone.quaternion.copy(base.q); bone.position.copy(base.p); }
    model.position.y = baseModelY - stanceLowering + Math.sin(time * 1.7) * .002;
    group.updateMatrixWorld(true);
    const groupQ = group.getWorldQuaternion(q());
    const worldX = axisX.clone().applyQuaternion(groupQ);
    const worldY = axisY.clone().applyQuaternion(groupQ);
    const spine = bones.get('Spine2');
    if(spine){deltaWorld(spine,worldY,.10);deltaWorld(spine,worldX,pitch*.12);}
    // Biped parents clavicles to Neck; turning the head must not drag the arms.
    const clavicles=['LeftShoulder','RightShoulder'].map(name=>bones.get(name)).filter(Boolean);
    const shoulderFrames=clavicles.map(bone=>({bone,p:bone.getWorldPosition(v()),q:bone.getWorldQuaternion(q())}));
    deltaWorld(bones.get('Neck'), worldY, .24);
    deltaWorld(bones.get('Neck'), worldX, pitch*.16);
    for(const frame of shoulderFrames){frame.bone.position.copy(frame.bone.parent.worldToLocal(frame.p.clone()));setWorldQuaternion(frame.bone,frame.q);}
    deltaWorld(bones.get('Head'), worldY, 1.17);
    deltaWorld(bones.get('Head'), worldX, pitch * .52);

    const lfQ = leftLeg.c.getWorldQuaternion(q()), rfQ = rightLeg.c.getWorldQuaternion(q());
    last.leftFootTarget.copy(localToWorld(footTargets[0]));last.rightFootTarget.copy(localToWorld(footTargets[1]));
    solve(leftLeg,last.leftFootTarget,localToWorld(new THREE.Vector3(.24,.6,-.22)));
    solve(rightLeg,last.rightFootTarget,localToWorld(new THREE.Vector3(.24,.6,.22)));
    setWorldQuaternion(leftLeg.c, lfQ); setWorldQuaternion(rightLeg.c, rfQ);

    const extension = Math.max(draw, release * .93);
    const pitchQ = q().setFromAxisAngle(axisX, pitch);
    const wristOffset = new THREE.Vector3(0, -.018, .055).applyQuaternion(pitchQ);
    const shoulderLocal = group.worldToLocal(leftArm.a.getWorldPosition(v()));
    // Place the full-draw nock beside the actual jaw, then solve the bow distance
    // from measured arm reach. The replacement human has different proportions.
    const face=bones.get('MBottomLip')||bones.get('Head');
    const anchor=group.worldToLocal(face.getWorldPosition(v())).add(new THREE.Vector3(.085,isBiped?-.035:-.055,.105));
    const backward=new THREE.Vector3(0,0,1).applyQuaternion(pitchQ);
    const anchorToWrist=new THREE.Vector3(0,-.055,0).applyQuaternion(pitchQ).add(wristOffset);
    const e=anchor.clone().add(anchorToWrist).sub(shoulderLocal), projection=e.dot(backward);
    const safeReach = (leftArm.l1 + leftArm.l2) * .985;
    const fullDrawDistance=clamp(projection+Math.sqrt(Math.max(.0001,safeReach*safeReach-e.lengthSq()+projection*projection)),.40,.72);
    last.fullDrawDistance=fullDrawDistance;
    const fullGrip=anchor.clone().sub(new THREE.Vector3(0,.055,fullDrawDistance).applyQuaternion(pitchQ));
    const idleGrip=new THREE.Vector3(.25,shoulderLocal.y-.16,-.23);
    const gripLocal=idleGrip.lerp(fullGrip,extension);
    const reach=gripLocal.clone().add(wristOffset).sub(shoulderLocal);
    if (reach.length() > safeReach) {
      gripLocal.copy(shoulderLocal).add(reach.setLength(safeReach)).sub(wristOffset);
    }
    bow.group.position.copy(gripLocal);
    bow.group.quaternion.copy(pitchQ);
    bow.update(draw, release, time,fullDrawDistance-.18);
    group.updateMatrixWorld(true);
    const leftWrist = wristOffset.clone().add(gripLocal);
    const handDraw = Math.max(draw, release);
    const rightWrist = new THREE.Vector3(.012 + release * .012, .030 + release * .012, .205 + (fullDrawDistance-.18) * handDraw + release * .065).applyQuaternion(pitchQ).add(gripLocal);
    last.leftTarget.copy(localToWorld(leftWrist)); last.rightTarget.copy(localToWorld(rightWrist));
    solve(leftArm, last.leftTarget, localToWorld(new THREE.Vector3(.12, mix(1.05, 1.25, extension) + pitch * .14, -.36)));
    solve(rightArm,last.rightTarget,localToWorld(new THREE.Vector3(mix(.46,.43,extension),mix(1.05,1.34,extension),mix(.60,.78,extension))));
    const handForward = new THREE.Vector3(0, .28, -1).normalize().applyQuaternion(pitchQ).applyQuaternion(groupQ);
    const handUp=new THREE.Vector3(0,1,0).applyQuaternion(pitchQ).applyQuaternion(groupQ);
    orientHand('Left',handForward,handUp,-.10);
    orientHand('Right',new THREE.Vector3(0,-.03,-1).applyQuaternion(pitchQ).applyQuaternion(groupQ),handUp,.04);
    curlFingers('Left', 1.15, 0);
    curlFingers('Right', 1.05 * (1 - release), release);
    quiver.position.y = 1.16 + Math.sin(time * 1.7) * .002;
    quiver.userData.strap.position.y=Math.sin(time*1.7)*.002;
    group.updateMatrixWorld(true);
  }
  update({});
  return {
    group,
    update,
    modelName: isBiped?'Rocketbox Female Adult 17 — skeletal archer':'Mixamo skeletal archer',
    getBone(name){return bones.get(name);},
    getMuzzlePosition(target = v()) {
      bow.nockedArrow.updateWorldMatrix(true, false);
      return bow.nockedArrow.getWorldPosition(target);
    },
    getArrowDirection(target = v()) {
      return target.set(0, 0, -1).applyQuaternion(bow.group.getWorldQuaternion(q())).normalize();
    },
    getRigDiagnostics() {
      return {
        leftWristError: leftArm.c.getWorldPosition(v()).distanceTo(last.leftTarget),
        rightWristError: rightArm.c.getWorldPosition(v()).distanceTo(last.rightTarget),
        leftFootError:leftLeg.c.getWorldPosition(v()).distanceTo(last.leftFootTarget),
        rightFootError:rightLeg.c.getWorldPosition(v()).distanceTo(last.rightFootTarget),
        fullDrawDistance:last.fullDrawDistance,
        headForward:headForwardLocal.clone().applyQuaternion(bones.get('Head').getWorldQuaternion(q())).toArray(),
        draw: last.draw, yaw: last.yaw, pitch: last.pitch,
        meshType: 'SkinnedMesh', source: isBiped?'archer-realistic.glb':'Michelle.glb',
        bones: rest.size
      };
    },
    dispose() {
      const geometries = new Set(), materials = new Set(), textures = new Set();
      group.traverse(o => {
        if (o.geometry) geometries.add(o.geometry);
        if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
      });
      for (const m of materials) for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
      for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); for (const t of textures) t.dispose();
    }
  };
}
