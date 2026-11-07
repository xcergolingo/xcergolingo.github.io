import * as THREE from './vendor/three.module.js';

/** Camera-attached, procedural L-96 training rifle. All measurements are visual game units. */
export function createWeapon(camera) {
  const group = new THREE.Group();
  group.name = 'L96-viewmodel';
  const rifle = new THREE.Group();
  group.add(rifle);
  camera.add(group);
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const mat = (color, roughness = .6, metalness = .1, extra = {}) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    materials.add(material);
    return material;
  };
  const olive = mat(0x7b8060, .67, .22);
  const oliveLight = mat(0x9b9e76, .58, .24);
  const charcoal = mat(0x252e33, .42, .65);
  const black = mat(0x141b20, .76, .15);
  const steel = mat(0x64717a, .28, .82);
  const rubber = mat(0x1b2427, .96, .02);
  const gripMat = mat(0x434d48, .92, .04);
  const seamMat = mat(0x8d9176, .9, .0);
  const glass = mat(0x284b50, .1, .9, { emissive: 0x163f4a, emissiveIntensity: .35 });
  const orange = mat(0xf18d4a, .5, .2, { emissive: 0x64310d, emissiveIntensity: .22 });
  const add = (geometry, material, x, y, z, parent = rifle) => {
    geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    parent.add(mesh);
    return mesh;
  };
  const box = (w, h, d, material, x, y, z, parent = rifle) =>
    add(new THREE.BoxGeometry(w, h, d), material, x, y, z, parent);
  const cylinder = (r1, r2, length, material, x, y, z, axis = 'z', parent = rifle, segments = 16) => {
    const mesh = add(new THREE.CylinderGeometry(r1, r2, length, segments), material, x, y, z, parent);
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    return mesh;
  };
  const sphere = (radius, material, x, y, z, parent = rifle, sx = 1, sy = 1, sz = 1) => {
    const mesh = add(new THREE.SphereGeometry(radius, 12, 8), material, x, y, z, parent);
    mesh.scale.set(sx, sy, sz);
    return mesh;
  };
  const instances = (geometry, material, positions, parent = rifle) => {
    geometries.add(geometry);
    const mesh = new THREE.InstancedMesh(geometry, material, positions.length);
    const transform = new THREE.Object3D();
    positions.forEach((p, i) => {
      transform.position.set(p[0], p[1], p[2]);
      transform.rotation.set(p[3] || 0, p[4] || 0, p[5] || 0);
      transform.scale.set(p[6] || 1, p[7] || 1, p[8] || 1);
      transform.updateMatrix();
      mesh.setMatrixAt(i, transform.matrix);
    });
    mesh.frustumCulled = false;
    parent.add(mesh);
    return mesh;
  };

  // Angular chassis, recoil pad, comb and stock-adjustment hardware.
  box(.098, .112, .43, olive, 0, -.028, .125);
  box(.087, .072, .22, oliveLight, 0, .048, .21);
  box(.107, .148, .036, rubber, 0, -.037, .358);
  box(.075, .025, .17, black, 0, .094, .225);
  box(.063, .025, .16, charcoal, 0, -.099, .23);
  cylinder(.014, .014, .08, steel, 0, -.05, .235, 'x');
  cylinder(.021, .021, .012, charcoal, -.049, -.048, .235, 'x');
  instances(new THREE.BoxGeometry(.109, .004, .004), charcoal,
    Array.from({ length: 6 }, (_, i) => [0, -.087 + i * .021, .378]));

  // Receiver and floating barrel. Small strips form a readable flat top rail.
  box(.11, .086, .29, charcoal, 0, .019, -.12);
  box(.116, .032, .28, oliveLight, 0, -.035, -.12);
  box(.072, .028, .35, black, 0, .075, -.10);
  instances(new THREE.BoxGeometry(.086, .012, .012), charcoal,
    Array.from({ length: 13 }, (_, i) => [0, .093, .047 - i * .024]));
  cylinder(.026, .03, .70, charcoal, 0, .014, -.57);
  cylinder(.032, .033, .11, black, 0, .014, -.34);
  cylinder(.030, .030, .023, steel, 0, .014, -.72);
  cylinder(.032, .032, .025, charcoal, 0, .014, -.755);

  // Handguard with inset cooling slots and machined end cap.
  box(.094, .091, .285, olive, 0, -.034, -.36);
  box(.072, .019, .25, oliveLight, 0, .021, -.365);
  box(.097, .087, .021, charcoal, 0, -.033, -.51);
  const vents = [];
  for (let i = 0; i < 6; i++) {
    vents.push([-.0481, -.026, -.255 - i * .042]);
    vents.push([.0481, -.026, -.255 - i * .042]);
  }
  instances(new THREE.BoxGeometry(.0015, .031, .019), black, vents);
  const screws = [];
  for (const z of [-.49, -.225, -.14, .047, .13]) for (const x of [-.057, .057]) screws.push([x, -.008, z, 0, 0, Math.PI / 2]);
  instances(new THREE.CylinderGeometry(.006, .006, .004, 6), steel, screws);
  box(.072, .019, .18, black, 0, -.087, -.375);

  // Visible muzzle brake, open black bore, and side ports.
  cylinder(.037, .033, .084, charcoal, 0, .014, -.957, 'z', rifle, 8);
  cylinder(.022, .022, .002, black, 0, .014, -1.001);
  cylinder(.010, .010, .003, charcoal, 0, .014, -1.003);
  instances(new THREE.BoxGeometry(.003, .026, .012), black,
    [-.981, -.956, -.931].flatMap(z => [[-.0355, .014, z], [.0355, .014, z]]));

  // Scope rings, main tube, larger objective, ocular rubber and glass.
  for (const z of [-.225, -.045]) {
    box(.069, .04, .033, charcoal, 0, .119, z);
    cylinder(.044, .044, .027, black, 0, .17, z);
    cylinder(.007, .007, .081, steel, 0, .13, z, 'x');
  }
  cylinder(.032, .032, .31, charcoal, 0, .17, -.13);
  cylinder(.047, .032, .09, charcoal, 0, .17, -.32);
  cylinder(.050, .050, .034, black, 0, .17, -.38);
  cylinder(.043, .043, .002, glass, 0, .17, -.398);
  cylinder(.041, .035, .095, black, 0, .17, .055);
  cylinder(.047, .047, .033, rubber, 0, .17, .116);
  cylinder(.039, .039, .002, glass, 0, .17, .134);
  // Concentric rings make the scope look engineered without textures.
  for (const z of [.08, .09, .1, -.37, -.38, -.39]) cylinder(.048, .048, .003, charcoal, 0, .17, z);
  cylinder(.026, .026, .04, black, 0, .218, -.13, 'y');
  cylinder(.028, .028, .009, charcoal, 0, .243, -.13, 'y');
  cylinder(.022, .022, .035, black, .041, .17, -.13, 'x');
  cylinder(.025, .025, .008, charcoal, .06, .17, -.13, 'x');
  box(.003, .005, .013, orange, 0, .249, -.13);
  box(.036, .0018, .012, orange, 0, .203, .02);
  // Flip-up front lens cap, opened beside the scope.
  const cap = cylinder(.049, .049, .007, rubber, -.068, .179, -.38);
  cap.rotation.y = -.65;
  box(.043, .012, .016, black, -.045, .171, -.379);

  // Trigger, grip and detachable magazine.
  const pistolGrip = box(.068, .14, .083, rubber, 0, -.125, .015);
  pistolGrip.rotation.x = -.27;
  box(.078, .017, .091, charcoal, 0, -.194, .032);
  box(.065, .015, .133, charcoal, 0, -.121, -.08);
  box(.012, .087, .014, charcoal, -.026, -.084, -.14);
  box(.012, .087, .014, charcoal, .026, -.084, -.14);
  const trigger = box(.012, .05, .012, steel, 0, -.081, -.061);
  trigger.rotation.x = -.22;
  box(.075, .103, .096, charcoal, 0, -.109, -.21);
  box(.083, .012, .105, black, 0, -.166, -.21);
  instances(new THREE.BoxGeometry(.002, .063, .009), black,
    [-.0378, .0378].flatMap(x => [-.237, -.214, -.191].map(z => [x, -.106, z])));

  // Bolt with a separate moving handle and chamber cover.
  const bolt = new THREE.Group();
  rifle.add(bolt);
  cylinder(.019, .019, .17, steel, .031, .03, -.025, 'z', bolt);
  cylinder(.009, .009, .085, steel, .084, .021, .043, 'x', bolt);
  sphere(.021, black, .127, .019, .043, bolt);
  box(.029, .023, .093, black, .052, .026, -.083);
  box(.021, .008, .062, steel, .055, .039, -.075);

  // Folded bipod legs beneath the handguard.
  for (const sign of [-1, 1]) {
    const leg = cylinder(.009, .012, .20, charcoal, sign * .066, -.087, -.422);
    leg.rotation.y = sign * .055;
    box(.029, .017, .036, rubber, sign * .071, -.087, -.319);
    cylinder(.018, .018, .024, steel, sign * .052, -.071, -.515, 'x');
  }

  // Gloved trigger hand and support hand, with stylized sleeves.
  const triggerHand = new THREE.Group();
  triggerHand.position.set(.011, -.137, .063);
  rifle.add(triggerHand);
  sphere(.055, gripMat, 0, 0, 0, triggerHand, .79, 1.17, .9);
  const fingers = [[-.027, .012, -.038], [-.026, -.009, -.039], [-.024, -.028, -.036]];
  for (const [x, y, z] of fingers) {
    const finger = cylinder(.012, .012, .054, gripMat, x, y, z, 'x', triggerHand, 8);
    finger.rotation.y = -.15;
  }
  sphere(.018, gripMat, .035, .021, -.023, triggerHand, .7, 1.1, 1.5);
  box(.045, .006, .039, seamMat, .006, .047, .004, triggerHand);
  const rightArm = cylinder(.058, .075, .31, olive, .11, -.247, .16, 'y');
  rightArm.rotation.set(-.62, 0, -.39);
  const cuff = cylinder(.059, .059, .027, black, .033, -.176, .09, 'y');
  cuff.rotation.x = -.4;

  const supportHand = new THREE.Group();
  supportHand.position.set(-.032, -.119, -.392);
  rifle.add(supportHand);
  sphere(.054, gripMat, 0, 0, 0, supportHand, 1.07, .69, 1.1);
  for (let i = 0; i < 4; i++) cylinder(.011, .011, .063, gripMat, -.031 + i * .018, .016, -.012, 'z', supportHand, 8);
  sphere(.018, gripMat, .047, .012, .01, supportHand, .7, 1.3, 1.7);
  box(.042, .005, .034, seamMat, -.011, -.036, -.003, supportHand);
  const leftArm = cylinder(.055, .072, .34, olive, -.14, -.237, -.273, 'y');
  leftArm.rotation.set(.43, 0, -.60);
  const leftCuff = cylinder(.057, .057, .035, black, -.055, -.145, -.363, 'y');
  leftCuff.rotation.set(.43, 0, -.6);

  // Simple readable serial plate on the visible left flank.
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 384; canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#28312c'; ctx.fillRect(0, 0, 384, 96);
      ctx.fillStyle = '#d4d2b6'; ctx.font = 'bold 37px monospace'; ctx.fillText('L—96 / LONGSHOT', 12, 42);
      ctx.font = '17px monospace'; ctx.fillStyle = '#a6ad98'; ctx.fillText('ROOFTOP TRIALS   //   001', 13, 73);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      textures.add(texture);
      const plateMat = new THREE.MeshBasicMaterial({ map: texture });
      materials.add(plateMat);
      const plate = add(new THREE.PlaneGeometry(.15, .0375), plateMat, -.0495, -.021, .139);
      plate.rotation.y = -Math.PI / 2;
    }
  }

  // Short geometric muzzle flash. It has no persistent lighting or network assets.
  const flashGroup = new THREE.Group();
  flashGroup.position.set(0, .014, -1.025);
  rifle.add(flashGroup);
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffdd99, transparent: true, opacity: .92, blending: THREE.AdditiveBlending, depthWrite: false });
  materials.add(flashMat);
  const flashCore = add(new THREE.ConeGeometry(.065, .23, 7), flashMat, 0, 0, -.1, flashGroup);
  flashCore.rotation.x = -Math.PI / 2;
  const flashWarm = new THREE.MeshBasicMaterial({ color: 0xff8c36, transparent: true, opacity: .62, blending: THREE.AdditiveBlending, depthWrite: false });
  materials.add(flashWarm);
  const flashStar = add(new THREE.ConeGeometry(.11, .12, 5), flashWarm, 0, 0, -.035, flashGroup);
  flashStar.rotation.x = -Math.PI / 2;
  flashGroup.visible = false;
  const flashLight = new THREE.PointLight(0xffb96d, 0, 3, 2);
  flashLight.position.copy(flashGroup.position);
  rifle.add(flashLight);

  let flashRemaining = 0;
  let shotElapsed = 10;
  let reloadWeight = 0;
  let moveWeight = 0;
  const basePosition = new THREE.Vector3(.235, -.315, -.52);
  group.position.copy(basePosition);
  group.rotation.set(.012, -.025, 0);

  function flash() {
    flashRemaining = .075;
    shotElapsed = 0;
    flashGroup.rotation.z = Math.random() * Math.PI;
    flashGroup.visible = true;
  }

  function update(dt, state = {}) {
    const { time = 0, scoped = false, recoil = 0, reloading = false, reloadProgress = 0, moving = false } = state;
    const step = Math.min(Math.max(dt || 0, 0), .1);
    shotElapsed += step;
    flashRemaining = Math.max(0, flashRemaining - step);
    flashGroup.visible = flashRemaining > 0;
    flashLight.intensity = flashRemaining > 0 ? 1.5 * (flashRemaining / .075) : 0;
    group.visible = !scoped;
    moveWeight += ((moving ? 1 : 0) - moveWeight) * Math.min(1, step * 10);
    reloadWeight += ((reloading ? 1 : 0) - reloadWeight) * Math.min(1, step * 8);
    const impulse = Math.max(Math.min(recoil || 0, 1.5), Math.max(0, 1 - shotElapsed / .22) * .65);
    const bobX = Math.sin(time * 8.7) * .006 * moveWeight;
    const bobY = Math.cos(time * 17.4) * .004 * moveWeight;
    group.position.set(basePosition.x + bobX - reloadWeight * .025, basePosition.y + bobY - reloadWeight * .17 - impulse * .015, basePosition.z + impulse * .075);
    group.rotation.set(.012 + impulse * .075 - reloadWeight * .29, -.025 + reloadWeight * .17, reloadWeight * -.38 + bobX * .8);
    // Manual cycling after every shot: handle lifts, draws back, and seats again.
    const cycle = Math.max(0, Math.min(1, (shotElapsed - .16) / .67));
    const boltPull = Math.sin(cycle * Math.PI);
    bolt.position.z = boltPull * .105;
    bolt.rotation.z = -Math.sin(Math.min(cycle * 2, 1) * Math.PI) * .4;
    const reloadHand = reloading ? Math.sin(Math.max(0, Math.min(1, reloadProgress)) * Math.PI) : 0;
    supportHand.position.y = -.119 - reloadHand * .095;
    supportHand.position.z = -.392 + reloadHand * .14;
  }

  function dispose() {
    camera.remove(group);
    geometries.forEach(item => item.dispose());
    materials.forEach(item => item.dispose());
    textures.forEach(item => item.dispose());
  }

  return { group, update, flash, dispose };
}
