/**
 * A procedural, wide-windshield flight deck. No external assets are needed.
 * Render scene/camera after the outdoor world, with renderer.clearDepth().
 * State values use metres, metres/second and radians.
 */
export function createCockpit(THREE) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.025, 15);
  // The eye stays at the pilot's seat. Only its local look direction changes.
  camera.rotation.order = 'YXZ';
  const lookLimits = Object.freeze({
    yaw: THREE.MathUtils.degToRad(105),
    pitch: THREE.MathUtils.degToRad(35),
  });
  const root = new THREE.Group();
  scene.add(root);
  let visible = true;
  let aspect = 16 / 9;
  let elapsed = 0;
  let lastDraw = -1;
  let spool = 0.6;
  const disposables = new Set();
  const materials = {};
  const register = (o) => (disposables.add(o), o);
  const mat = (name, color, roughness = 0.75, metalness = 0.08) => {
    const m = register(new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    materials[name] = m;
    return m;
  };
  const graphite = mat('graphite', 0x1b252e, 0.86, 0.06);
  const panel = mat('panel', 0x29323a, 0.72, 0.16);
  const edge = mat('edge', 0x080e14, 0.8, 0.07);
  const softBlack = mat('softBlack', 0x10161d, 0.94, 0.0);
  const metal = mat('metal', 0x73818a, 0.42, 0.62);
  const dullMetal = mat('dullMetal', 0x3f4d57, 0.57, 0.44);
  const ivory = mat('ivory', 0xd1d7cf, 0.54, 0.08);
  const amber = mat('amber', 0xb88b39, 0.42, 0.24);
  const warningRed = mat('warningRed', 0x873c31, 0.52, 0.08);
  const frameRubber = mat('frameRubber', 0x111a20, 0.9, 0.03);

  scene.add(new THREE.HemisphereLight(0xd6e8ff, 0x182029, 2.2));
  const sun = new THREE.DirectionalLight(0xffead4, 2.1);
  sun.position.set(-3, 5, 4);
  scene.add(sun);
  const instrumentGlow = new THREE.PointLight(0x93d1c1, 0.22, 3);
  instrumentGlow.position.set(0, -0.6, -1.8);
  scene.add(instrumentGlow);

  function mesh(geometry, material, x = 0, y = 0, z = 0, parent = root) {
    register(geometry);
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function box(w, h, d, material, x, y, z, parent = root) {
    return mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z, parent);
  }
  function cylinderBetween(a, b, radius, material, parent = root, segments = 10) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
    const delta = to.clone().sub(from);
    const m = mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), segments), material,
      (from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2, parent);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return m;
  }
  function placeRail(rail, a, b) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
    const delta = to.sub(from);
    rail.position.copy(from).addScaledVector(delta, 0.5);
    rail.scale.y = delta.length() / rail.geometry.parameters.height;
    rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  }
  function roundedShape(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function roundedBox(w, h, d, r, material, x, y, z, parent = root) {
    return mesh(new THREE.ExtrudeGeometry(roundedShape(w, h, r), {
      depth: d, bevelEnabled: true, bevelSegments: 1, steps: 1,
      bevelSize: Math.min(0.008, r / 3), bevelThickness: 0.006, curveSegments: 4,
    }), material, x, y, z, parent);
  }
  function canvasTexture(width, height, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (draw) draw(ctx, width, height);
    const texture = register(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return { canvas, ctx, texture };
  }
  function texturedPlane(w, h, texture, x, y, z, parent = root) {
    const m = register(new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    return mesh(new THREE.PlaneGeometry(w, h), m, x, y, z, parent);
  }
  function label(text, w, h, x, y, z, color = '#bac4ca', background = '#253039', parent = root) {
    const tex = canvasTexture(512, 64, (ctx, W, H) => {
      ctx.fillStyle = background; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '500 28px Arial, sans-serif'; ctx.fillText(text, W / 2, H / 2 + 1);
    });
    return texturedPlane(w, h, tex.texture, x, y, z, parent);
  }

  // The shell is shaped like a real curved glareshield, rather than a floating rectangle.
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-2.85, -0.78);
  bodyShape.lineTo(-2.0, -0.64);
  bodyShape.lineTo(-0.95, -0.605);
  bodyShape.lineTo(0.95, -0.605);
  bodyShape.lineTo(2.0, -0.64);
  bodyShape.lineTo(2.85, -0.78);
  bodyShape.lineTo(2.85, -1.9);
  bodyShape.lineTo(-2.85, -1.9);
  bodyShape.closePath();
  mesh(new THREE.ExtrudeGeometry(bodyShape, {
    depth: 0.34, bevelEnabled: true, bevelSegments: 2,
    bevelSize: 0.035, bevelThickness: 0.025, steps: 1, curveSegments: 3,
  }), graphite, 0, 0, -3.2);

  // Thick padded glare shield, thin metal lip and recessed front panel.
  roundedBox(4.16, 0.095, 0.43, 0.03, softBlack, 0, -0.63, -3.06);
  box(4.18, 0.018, 0.035, dullMetal, 0, -0.686, -2.622);
  roundedBox(4.56, 0.66, 0.025, 0.05, panel, 0, -1.055, -2.845);
  box(0.022, 0.65, 0.012, edge, -1.86, -1.055, -2.805);
  box(0.022, 0.65, 0.012, edge, 0.55, -1.055, -2.805);
  box(0.022, 0.65, 0.012, edge, 1.31, -1.055, -2.805);

  // Low-profile autopilot / warning strip immediately below the glareshield.
  const upperStrip = new THREE.Group(); root.add(upperStrip);
  roundedBox(2.72, 0.13, 0.035, 0.014, edge, 0.15, -0.718, -2.83, upperStrip);
  const annunciator = canvasTexture(1536, 96);
  texturedPlane(2.55, 0.095, annunciator.texture, 0.12, -0.715, -2.785, upperStrip);

  const screenGroup = new THREE.Group(); root.add(screenGroup);
  const screwPositions = [];
  const knobPositions = [];
  function display(w, h, x, y, screen, name) {
    const group = new THREE.Group(); screenGroup.add(group);
    group.position.set(x, y, 0);
    roundedBox(w + 0.08, h + 0.075, 0.065, 0.023, edge, 0, 0, -2.80, group);
    roundedBox(w + 0.017, h + 0.016, 0.005, 0.009, dullMetal, 0, 0, -2.73, group);
    texturedPlane(w, h, screen.texture, 0, 0, -2.718, group);
    // Tiny bezel labels, side keys and fasteners give the screens a physical frame.
    for (let side of [-1, 1]) {
      for (let j = 0; j < 4; j++) {
        box(0.017, 0.018, 0.012, graphite, side * (w / 2 + 0.023), (j - 1.5) * h * 0.21, -2.718, group);
      }
      for (let end of [-1, 1]) screwPositions.push([x + side * (w / 2 + 0.024), y + end * (h / 2 + 0.02), -2.72]);
    }
    const tag = label(name, w * 0.65, 0.017, 0, -h / 2 - 0.024, -2.717, '#9daeb6', '#0c141b', group);
    return { group, tag, width: w, height: h, x, y };
  }
  const pfd = canvasTexture(768, 512);
  const nav = canvasTexture(768, 512);
  const engine = canvasTexture(384, 512);
  const copilot = canvasTexture(768, 512);
  const primaryDisplay = display(0.77, 0.435, -1.01, -1.045, pfd, 'PRIMARY FLIGHT DISPLAY');
  const navDisplay = display(0.77, 0.435, -0.08, -1.045, nav, 'NAVIGATION DISPLAY');
  const engineDisplay = display(0.34, 0.435, 0.93, -1.045, engine, 'ENGINE / CONFIG');
  const copilotDisplay = display(0.77, 0.435, 1.80, -1.045, copilot, 'FLIGHT DIRECTOR');

  // Three small standby instruments have recessed rings and painted tick marks.
  const standbyGroup = new THREE.Group(); root.add(standbyGroup);
  const standby = canvasTexture(256, 768);
  for (let i = 0; i < 3; i++) {
    const y = -0.88 - i * 0.155;
    const ring = mesh(new THREE.TorusGeometry(0.064, 0.008, 6, 28), dullMetal, 0.56, y, -2.75, standbyGroup);
    const back = mesh(new THREE.CircleGeometry(0.059, 28), edge, 0.56, y, -2.758, standbyGroup);
    const texture = standby.texture.clone(); register(texture);
    texture.repeat.set(1, 1 / 3); texture.offset.set(0, (2 - i) / 3);
    const planeMaterial = register(new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    const face = mesh(new THREE.CircleGeometry(0.055, 28), planeMaterial, 0.56, y, -2.735, standbyGroup);
    face.userData.faceTexture = texture;
  }

  // Flush annunciators and adjustment knobs, drawn with instancing.
  for (let x of [-1.76, -1.64, -1.52, 1.36, 1.48]) {
    knobPositions.push([x, -0.795, -2.75, 0.026]);
    knobPositions.push([x, -1.27, -2.75, 0.024]);
  }
  for (let x of [-1.13, -0.70, -0.15, 0.28, 0.77, 1.15]) {
    knobPositions.push([x, -0.725, -2.72, 0.023]);
  }
  for (let x of [-2.15, -1.88, 0.48, 1.31, 2.23]) {
    for (let y of [-0.78, -1.32]) screwPositions.push([x, y, -2.79]);
  }
  const dummy = new THREE.Object3D();
  const screwGeo = register(new THREE.CylinderGeometry(0.008, 0.008, 0.005, 8));
  const screws = new THREE.InstancedMesh(screwGeo, metal, screwPositions.length);
  screwPositions.forEach(([x, y, z], i) => {
    dummy.position.set(x, y, z); dummy.rotation.set(Math.PI / 2, 0, 0); dummy.scale.set(1, 1, 1);
    dummy.updateMatrix(); screws.setMatrixAt(i, dummy.matrix);
  });
  root.add(screws);
  const knobGeo = register(new THREE.CylinderGeometry(1, 1.1, 1.3, 12));
  const knobs = new THREE.InstancedMesh(knobGeo, graphite, knobPositions.length);
  knobPositions.forEach(([x, y, z, r], i) => {
    dummy.position.set(x, y, z); dummy.rotation.set(Math.PI / 2, 0, 0); dummy.scale.set(r, r, r);
    dummy.updateMatrix(); knobs.setMatrixAt(i, dummy.matrix);
  });
  root.add(knobs);
  const knobMarkGeo = register(new THREE.BoxGeometry(0.004, 0.012, 0.002));
  const knobMarks = new THREE.InstancedMesh(knobMarkGeo, ivory, knobPositions.length);
  knobPositions.forEach(([x, y, z, r], i) => {
    dummy.position.set(x, y + r * 0.46, z + r * 0.68); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
    dummy.updateMatrix(); knobMarks.setMatrixAt(i, dummy.matrix);
  });
  root.add(knobMarks);

  // Gear, flaps and a small master-caution button on the right-hand panel.
  const systemsGroup = new THREE.Group(); root.add(systemsGroup);
  const gearLights = [];
  for (const [x, y] of [[1.28, -0.87], [1.24, -0.94], [1.32, -0.94]]) {
    roundedBox(0.036, 0.027, 0.009, 0.005, edge, x, y, -2.745, systemsGroup);
    const lamp = register(new THREE.MeshBasicMaterial({ color: 0x75d6a4, toneMapped: false }));
    mesh(new THREE.PlaneGeometry(0.023, 0.014), lamp, x, y, -2.728, systemsGroup);
    gearLights.push(lamp);
  }
  label('GEAR', 0.13, 0.022, 1.28, -0.827, -2.72, '#9aaab4', '#253039', systemsGroup);
  const gearLever = new THREE.Group(); systemsGroup.add(gearLever);
  gearLever.position.set(1.28, -1.09, -2.72);
  cylinderBetween([0, 0, 0], [0, -0.065, 0.055], 0.008, metal, gearLever);
  mesh(new THREE.TorusGeometry(0.021, 0.007, 6, 14), ivory, 0, -0.065, 0.055, gearLever);

  // A compact, articulated yoke. It remains below the windshield sightline.
  const yoke = new THREE.Group(); root.add(yoke);
  const yokeHome = new THREE.Vector3(-0.96, -1.19, -2.10);
  yoke.position.copy(yokeHome);
  const yokePivot = new THREE.Group(); yoke.add(yokePivot);
  cylinderBetween([0, -0.30, -0.09], [0, -0.035, 0.055], 0.038, graphite, yokePivot);
  roundedBox(0.20, 0.10, 0.065, 0.033, softBlack, 0, -0.025, 0.025, yokePivot);
  for (let sign of [-1, 1]) {
    cylinderBetween([sign * 0.06, -0.035, 0.07], [sign * 0.19, 0.015, 0.07], 0.031, softBlack, yokePivot, 12);
    cylinderBetween([sign * 0.19, 0.015, 0.07], [sign * 0.22, 0.135, 0.055], 0.034, softBlack, yokePivot, 12);
    roundedBox(0.065, 0.105, 0.055, 0.027, graphite, sign * 0.215, 0.105, 0.04, yokePivot);
    box(0.028, 0.027, 0.011, sign < 0 ? warningRed : dullMetal, sign * 0.215, 0.141, 0.098, yokePivot);
    for (let j = 0; j < 3; j++) box(0.058, 0.004, 0.004, edge, sign * 0.212, 0.078 + j * 0.021, 0.103, yokePivot);
  }
  label('G  /  FLIGHT', 0.132, 0.024, 0, -0.012, 0.096, '#aab8c1', '#10161d', yokePivot);

  // Just the upper edge of the centre pedestal is visible from the normal eye point.
  const pedestal = new THREE.Group(); root.add(pedestal);
  pedestal.position.set(1.05, -1.44, -2.22);
  roundedBox(0.60, 0.40, 0.28, 0.04, graphite, 0, 0, -0.14, pedestal);
  const throttleLevers = [];
  for (const x of [-0.085, 0.085]) {
    box(0.025, 0.25, 0.01, edge, x, 0.035, 0.16, pedestal);
    const pivot = new THREE.Group(); pedestal.add(pivot); pivot.position.set(x, -0.06, 0.13);
    cylinderBetween([0, 0, 0], [0, 0.17, 0.045], 0.012, metal, pivot);
    roundedBox(0.095, 0.052, 0.052, 0.018, ivory, 0, 0.17, 0.025, pivot);
    throttleLevers.push(pivot);
  }

  // Windshield surround: no centre pillar obscures the route ahead.
  const surround = new THREE.Group(); root.add(surround);
  const leftPost = new THREE.Group(), rightPost = new THREE.Group();
  surround.add(leftPost, rightPost);
  function makePost(parent, sign) {
    cylinderBetween([sign * 0.07, 1.13, -2.43], [sign * 0.14, -0.60, -2.79], 0.038, frameRubber, parent, 6);
    cylinderBetween([sign * 0.06, 1.12, -2.46], [sign * 0.13, -0.59, -2.82], 0.012, dullMetal, parent, 6);
    for (let y of [0.94, 0.27, -0.43]) {
      mesh(new THREE.SphereGeometry(0.008, 6, 4), metal, sign * (0.075 + (1.13 - y) * 0.04), y, -2.41 - (1.13 - y) * 0.207, parent);
    }
  }
  makePost(leftPost, -1); makePost(rightPost, 1);
  const topBeam = roundedBox(4.6, 0.115, 0.20, 0.025, frameRubber, 0, 1.19, -2.47, surround);
  const topLip = box(4.6, 0.012, 0.025, dullMetal, 0, 1.115, -2.41, surround);
  const leftSill = cylinderBetween([-2.25, -0.62, -2.75], [-2.72, -0.85, -1.3], 0.05, frameRubber);
  const rightSill = cylinderBetween([2.25, -0.62, -2.75], [2.72, -0.85, -1.3], 0.05, frameRubber);
  const leftUpperRail = cylinderBetween([-2.25, 1.13, -2.43], [-2.72, 1.28, -1.3], 0.038, frameRubber);
  const rightUpperRail = cylinderBetween([2.25, 1.13, -2.43], [2.72, 1.28, -1.3], 0.038, frameRubber);
  // Small visor edges and a magnetic-compass box stay at the very top of the view.
  const compassBox = new THREE.Group(); surround.add(compassBox);
  roundedBox(0.27, 0.075, 0.05, 0.015, edge, 0, 1.105, -2.42, compassBox);
  const compassStrip = canvasTexture(384, 64);
  texturedPlane(0.23, 0.044, compassStrip.texture, 0, 1.102, -2.36, compassBox);

  // A restrained tint along the extreme windshield edges; the centre is transparent.
  const glassMaterial = register(new THREE.MeshBasicMaterial({
    color: 0x9ac1cd, transparent: true, opacity: 0.035, depthWrite: false,
    side: THREE.DoubleSide, toneMapped: false,
  }));
  const leftGlass = mesh(new THREE.PlaneGeometry(0.16, 1.5), glassMaterial, -2.04, 0.20, -2.68, surround);
  const rightGlass = mesh(new THREE.PlaneGeometry(0.16, 1.5), glassMaterial, 2.04, 0.20, -2.68, surround);

  // A real cabin surrounds the fixed eye, so turning the camera reveals side
  // windows and consoles instead of leaving a forward-facing dashboard overlay.
  const sideGlassMaterial = register(new THREE.MeshBasicMaterial({
    color: 0xb0cbd2, transparent: true, opacity: 0.018, depthWrite: false,
    side: THREE.DoubleSide, toneMapped: false,
  }));
  const upholstery = mat('upholstery', 0x31414b, 0.98, 0.0);
  const headliner = mat('headliner', 0x37434a, 0.96, 0.0);
  const cabinFloor = box(5.5, 0.08, 4.25, softBlack, 0, -2.10, -0.7);
  const cabinRoof = box(5.5, 0.085, 4.25, headliner, 0, 1.43, -0.7);
  cabinFloor.name = 'cabin-floor';
  cabinRoof.name = 'cabin-roof';
  const sideCabins = [];
  const quarterWindows = [];
  const quarterPanels = [];
  for (const sign of [-1, 1]) {
    const side = new THREE.Group(); root.add(side);
    side.position.x = sign * 2.72;
    side.name = sign < 0 ? 'left-side-cabin' : 'right-side-cabin';
    sideCabins.push(side);

    // The uninterrupted opening spans the entire horizontal side view. Its
    // rear post is behind the eye, beyond the 105-degree centre look limit.
    box(0.10, 1.15, 2.8, graphite, sign * 0.01, -1.49, 0.05, side);
    box(0.045, 0.64, 2.4, panel, -sign * 0.06, -1.46, 0.05, side);
    cylinderBetween([0, -0.85, -1.3], [0, -0.85, 1.45], 0.045, frameRubber, side, 8);
    cylinderBetween([0, 1.28, -1.3], [0, 1.28, 1.45], 0.04, frameRubber, side, 8);
    cylinderBetween([0, -0.85, 1.45], [0, 1.28, 1.45], 0.055, frameRubber, side, 8);
    cylinderBetween([-sign * 0.025, -0.91, -1.3], [-sign * 0.025, -0.91, 1.45], 0.012, dullMetal, side, 6);
    const sideWindow = mesh(new THREE.PlaneGeometry(2.69, 2.06), sideGlassMaterial, 0, 0.215, 0.075, side);
    sideWindow.rotation.y = Math.PI / 2;
    sideWindow.name = sign < 0 ? 'left-side-window' : 'right-side-window';

    const quarterGeometry = new THREE.BufferGeometry();
    quarterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
    quarterGeometry.setIndex([0, 1, 2, 0, 2, 3]);
    const quarterWindow = mesh(quarterGeometry, sideGlassMaterial);
    quarterWindow.name = sign < 0 ? 'left-quarter-window' : 'right-quarter-window';
    quarterWindows.push(quarterWindow);
    const quarterPanelGeometry = new THREE.BufferGeometry();
    quarterPanelGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
    quarterPanelGeometry.setIndex(sign < 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
    quarterPanels.push(mesh(quarterPanelGeometry, graphite));

    // Armrest, shallow side console, recessed handle and a small switch panel
    // remain below the window, leaving the city unobstructed at eye level.
    box(0.33, 0.14, 2.26, softBlack, -sign * 0.16, -1.04, -0.05, side);
    box(0.31, 0.035, 0.67, panel, -sign * 0.18, -0.951, -0.77, side);
    for (const z of [-0.98, -0.80, -0.62]) {
      box(0.07, 0.013, 0.09, edge, -sign * 0.18, -0.926, z, side);
      cylinderBetween([-sign * 0.18, -0.92, z], [-sign * 0.18, -0.87, z + 0.015], 0.009, metal, side, 6);
    }
    box(0.05, 0.12, 0.36, edge, -sign * 0.081, -1.35, 0.55, side);
    cylinderBetween([-sign * 0.14, -1.35, 0.43], [-sign * 0.14, -1.35, 0.67], 0.018, dullMetal, side, 8);
    const sideLabel = new THREE.Group(); side.add(sideLabel);
    sideLabel.position.set(-sign * 0.08, -1.13, -0.70);
    sideLabel.rotation.y = -sign * Math.PI / 2;
    label('CABIN  /  LIGHTS', 0.52, 0.042, 0, 0, 0, '#a9b7ba', '#29323a', sideLabel);
  }

  // A low copilot seat adds depth when looking aft of the right window. Its
  // back stays below the horizon and behind the side-window sightline.
  const copilotSeat = new THREE.Group(); root.add(copilotSeat);
  copilotSeat.name = 'copilot-seat';
  copilotSeat.position.set(1.18, -1.47, 0.70);
  roundedBox(0.65, 0.16, 0.70, 0.065, upholstery, 0, 0, -0.34, copilotSeat);
  const seatBack = roundedBox(0.64, 0.90, 0.15, 0.08, upholstery, 0, 0.52, 0.33, copilotSeat);
  seatBack.rotation.x = -0.10;
  roundedBox(0.32, 0.19, 0.13, 0.055, upholstery, 0, 1.03, 0.39, copilotSeat);
  box(0.26, 0.43, 0.35, dullMetal, 0, -0.28, 0, copilotSeat);

  function mono(ctx, size, align = 'left', color = '#d9eee5') {
    ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
  }
  function line(ctx, x1, y1, x2, y2, color = '#eaf5ed', width = 2) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  const deg = (r) => r * 180 / Math.PI;
  const headingDeg = (h) => ((deg(h) % 360) + 360) % 360;
  const pad = (n) => String(Math.round(n) % 360).padStart(3, '0');
  function drawPFD(target, state, compact = false) {
    const { ctx: c, canvas: { width: W, height: H } } = target;
    const roll = Number.isFinite(state.roll) ? state.roll : 0;
    const pitch = Number.isFinite(state.pitch) ? state.pitch : 0;
    const speed = Math.max(0, (state.speed || 0) * 1.94384);
    const feet = Math.max(0, (state.altitude || 0) * 3.28084);
    const cx = W * 0.5, cy = H * 0.49;
    c.fillStyle = '#050e14'; c.fillRect(0, 0, W, H);
    c.save(); c.beginPath(); c.rect(W * 0.19, H * 0.10, W * 0.62, H * 0.72); c.clip();
    c.translate(cx, cy); c.rotate(-roll);
    const p = Math.max(-60, Math.min(60, deg(pitch))) * 4.1;
    const sky = c.createLinearGradient(0, -H, 0, H);
    sky.addColorStop(0, '#073367'); sky.addColorStop(0.5, '#267fa3'); sky.addColorStop(1, '#7ab4c5');
    c.fillStyle = sky; c.fillRect(-W, -H * 2 + p, W * 2, H * 2);
    c.fillStyle = '#775332'; c.fillRect(-W, p, W * 2, H * 2);
    line(c, -W, p, W, p, '#e0e8de', 3);
    for (let angle = -50; angle <= 50; angle += 5) {
      if (!angle) continue;
      const yy = p - angle * 4.1;
      const len = angle % 10 === 0 ? 86 : 42;
      line(c, -len, yy, len, yy, '#e4ece5', angle % 10 === 0 ? 2 : 1.5);
      if (angle % 10 === 0) {
        mono(c, 19, 'right', '#e4ece5'); c.fillText(Math.abs(angle), -len - 9, yy);
        mono(c, 19, 'left', '#e4ece5'); c.fillText(Math.abs(angle), len + 9, yy);
      }
    }
    c.restore();
    // Bank arc and index.
    c.save(); c.translate(cx, cy);
    c.beginPath(); c.arc(0, 0, 176, -Math.PI * 0.84, -Math.PI * 0.16);
    c.strokeStyle = '#dfece4'; c.lineWidth = 2; c.stroke();
    for (const d of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
      const a = (d - 90) * Math.PI / 180, long = d % 30 === 0;
      line(c, Math.cos(a) * 176, Math.sin(a) * 176, Math.cos(a) * (long ? 160 : 167), Math.sin(a) * (long ? 160 : 167), '#f1f5e9', 2);
    }
    c.rotate(-roll); c.beginPath(); c.moveTo(0, -166); c.lineTo(-10, -148); c.lineTo(10, -148); c.closePath(); c.fillStyle = '#f1f4d7'; c.fill(); c.restore();
    // Fixed aircraft symbol and a small flight-director cue.
    line(c, cx - 77, cy, cx - 27, cy, '#090f12', 12); line(c, cx + 27, cy, cx + 77, cy, '#090f12', 12);
    line(c, cx - 77, cy, cx - 27, cy, '#ffdc68', 5); line(c, cx + 27, cy, cx + 77, cy, '#ffdc68', 5);
    line(c, cx - 27, cy, cx - 27, cy + 13, '#ffdc68', 5); line(c, cx + 27, cy, cx + 27, cy + 13, '#ffdc68', 5);
    c.fillStyle = '#ffdc68'; c.fillRect(cx - 4, cy - 4, 8, 8);
    const guidance = state.autopilot ? '#e58cf0' : '#6de9ba';
    c.strokeStyle = guidance; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy + 31, 9, 0, Math.PI * 2); c.stroke();
    line(c, cx - 20, cy + 31, cx - 9, cy + 31, guidance, 2); line(c, cx + 9, cy + 31, cx + 20, cy + 31, guidance, 2);
    line(c, cx, cy + 22, cx, cy + 13, guidance, 2);
    // Airspeed and altitude tapes.
    const tapeTop = H * 0.15, tapeBottom = H * 0.79;
    c.fillStyle = '#10202b'; c.fillRect(W * 0.04, tapeTop, W * 0.135, tapeBottom - tapeTop);
    c.fillRect(W * 0.825, tapeTop, W * 0.145, tapeBottom - tapeTop);
    for (let dv = -60; dv <= 60; dv += 10) {
      const v = Math.floor(speed / 10) * 10 + dv;
      const yy = cy - (v - speed) * 3.4;
      if (v >= 0 && yy > tapeTop + 8 && yy < tapeBottom - 6) {
        mono(c, 22, 'right'); c.fillText(v, W * 0.139, yy);
        line(c, W * 0.145, yy, W * 0.171, yy, '#d1e6dc', 2);
      }
      const ft = Math.floor(feet / 100) * 100 + dv * 10;
      const ay = cy - (ft - feet) * 0.33;
      if (ft >= 0 && ay > tapeTop + 8 && ay < tapeBottom - 6) {
        mono(c, 20, 'left'); c.fillText(ft, W * 0.856, ay);
        line(c, W * 0.827, ay, W * 0.846, ay, '#d1e6dc', 2);
      }
    }
    c.fillStyle = '#030b10'; c.fillRect(W * 0.028, cy - 22, W * 0.16, 44); c.fillRect(W * 0.813, cy - 22, W * 0.175, 44);
    c.strokeStyle = '#e7f0e6'; c.lineWidth = 2; c.strokeRect(W * 0.028, cy - 22, W * 0.16, 44); c.strokeRect(W * 0.813, cy - 22, W * 0.175, 44);
    mono(c, 33, 'center', '#f8fff2'); c.fillText(Math.round(speed), W * 0.106, cy + 1);
    mono(c, 30, 'center', '#f8fff2'); c.fillText(Math.round(feet / 10) * 10, W * 0.9, cy + 1);
    mono(c, 18, 'center', '#89b2bb'); c.fillText('KTS', W * 0.105, H * 0.85); c.fillText('FT', W * 0.9, H * 0.85);
    // Flight-mode annunciator.
    mono(c, 23, 'center', '#73e8b5'); c.fillText(state.autopilot ? 'AP 1' : 'FD', W * 0.3, 25);
    c.fillText(state.gear ? 'GEAR DN' : 'FLIGHT', W * 0.5, 25);
    c.fillText(state.autopilot ? 'NAV' : 'MANUAL', W * 0.7, 25);
    line(c, W * 0.21, 44, W * 0.79, 44, '#365b61', 1);
    // Bottom heading strip.
    c.fillStyle = '#101e29'; c.fillRect(W * 0.21, H * 0.84, W * 0.58, H * 0.13);
    const hdg = headingDeg(state.heading || 0);
    for (let n = -3; n <= 3; n++) {
      const heading = (Math.floor(hdg / 10) * 10 + n * 10 + 360) % 360;
      let offset = heading - hdg; if (offset > 180) offset -= 360; if (offset < -180) offset += 360;
      const xx = cx + offset * 6.4;
      if (xx > W * 0.22 && xx < W * 0.78) {
        line(c, xx, H * 0.84, xx, H * 0.862, '#d4e4d8', 2);
        mono(c, 20, 'center', '#dce9db'); c.fillText(pad(heading), xx, H * 0.918);
      }
    }
    c.fillStyle = '#030b10'; c.fillRect(cx - 36, H * 0.88, 72, 38);
    mono(c, 26, 'center', '#d0f8f1'); c.fillText(pad(hdg), cx, H * 0.918);
    const vertical = (state.verticalSpeed || 0) * 196.85;
    mono(c, 18, 'right', '#b9d8c7'); c.fillText(`${vertical >= 0 ? '+' : ''}${Math.round(vertical / 50) * 50}`, W * 0.98, H * 0.95);
    if (state.stalled || state.warning) {
      const text = state.stalled ? 'STALL' : String(state.warning).slice(0, 18).toUpperCase();
      c.fillStyle = '#813622'; c.fillRect(cx - 104, H * 0.71, 208, 34);
      mono(c, 23, 'center', '#ffe4a0'); c.fillText(text, cx, H * 0.745);
    }
    target.texture.needsUpdate = true;
  }

  function drawNav(state) {
    const { ctx: c, canvas: { width: W, height: H } } = nav;
    c.fillStyle = '#050f14'; c.fillRect(0, 0, W, H);
    const cx = W * 0.5, cy = H * 0.83, radius = H * 0.63;
    const hdg = headingDeg(state.heading || 0);
    const suppliedRoute = state.route || state.waypoints || [];
    const position = state.position || state;
    const hasPosition = Number.isFinite(position.x) && Number.isFinite(position.z);
    const route = hasPosition ? suppliedRoute.filter(p => Number.isFinite(p.x) && Number.isFinite(p.z)) : [];
    const rangeM = Math.max(500, state.navRangeM || 3704);
    mono(c, 23, 'left', '#dce9dd'); c.fillText(route.length ? 'MAP' : 'HEADING', 22, 27);
    mono(c, 21, 'center', '#7bd6b6'); c.fillText(`HDG ${pad(hdg)}°`, cx, 27);
    mono(c, 21, 'right', '#aac6c4'); c.fillText(`${(rangeM / 1852).toFixed(rangeM % 1852 ? 1 : 0)} NM`, W - 22, 27);
    c.save(); c.beginPath(); c.rect(22, 55, W - 44, H - 85); c.clip();
    for (let n = 1; n <= 3; n++) {
      c.beginPath(); c.arc(cx, cy, radius * n / 3, Math.PI, 2 * Math.PI);
      c.strokeStyle = n === 3 ? '#9eb9ad' : '#2e525a'; c.lineWidth = n === 3 ? 2 : 1.3; c.stroke();
    }
    line(c, cx, cy, cx, cy - radius, '#34545b', 1);
    for (let d = -90; d <= 90; d += 10) {
      const a = (d - 90) * Math.PI / 180;
      const edgeR = radius, inset = d % 30 === 0 ? 14 : 8;
      line(c, cx + Math.cos(a) * edgeR, cy + Math.sin(a) * edgeR,
        cx + Math.cos(a) * (edgeR - inset), cy + Math.sin(a) * (edgeR - inset), '#afc9bb', 1.5);
      if (d % 30 === 0) {
        mono(c, 21, 'center', '#dceade');
        c.fillText(pad((hdg + d + 360) % 360), cx + Math.cos(a) * (edgeR - 32), cy + Math.sin(a) * (edgeR - 32));
      }
    }
    // Plot real game waypoints if supplied. No invented terrain or route is presented as a map.
    if (hasPosition) {
      const scale = radius / rangeM;
      c.save(); c.translate(cx, cy); c.rotate(-(state.heading || 0));
      const plot = p => [(p.x - position.x) * scale, (p.z - position.z) * scale];
      if (state.navCoastline?.length) {
        c.beginPath();
        state.navCoastline.forEach((point, i) => {
          const p = Array.isArray(point) ? { x: point[0], z: point[1] } : point;
          const [x, y] = plot(p); i ? c.lineTo(x, y) : c.moveTo(x, y);
        });
        c.strokeStyle = '#246779'; c.lineWidth = 2; c.stroke();
      }
      if (route.length) {
        c.beginPath(); route.forEach((p, i) => {
          const [x, y] = plot(p); i ? c.lineTo(x, y) : c.moveTo(x, y);
        });
        c.strokeStyle = '#dd84d2'; c.lineWidth = 2.5; c.stroke();
        route.forEach((p, i) => {
          const [x, y] = plot(p);
          if (Math.abs(x) > W || Math.abs(y) > H * 1.5) return;
          c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + 6, y); c.lineTo(x, y + 6); c.lineTo(x - 6, y); c.closePath();
          c.strokeStyle = i === state.activeWaypoint ? '#fff3bd' : '#efb1df'; c.lineWidth = 2; c.stroke();
          c.save(); c.translate(x, y); c.rotate(state.heading || 0);
          mono(c, 16, 'left', '#9fc3b6'); c.fillText(String(p.label || p.name || `W${i + 1}`).slice(0, 12).toUpperCase(), 10, -4);
          c.restore();
        });
      }
      c.restore();
    }
    c.restore();
    // Aircraft and track vector always stay fixed at the bottom of the navigation display.
    line(c, cx, cy - 17, cx, cy + 15, '#ffffff', 3);
    line(c, cx - 18, cy + 4, cx + 18, cy + 4, '#ffffff', 3);
    line(c, cx - 8, cy + 14, cx + 8, cy + 14, '#ffffff', 2);
    c.fillStyle = '#09151b'; c.fillRect(0, H - 43, W, 43);
    mono(c, 19, 'left', '#97c5ba'); c.fillText('YOKOHAMA', 20, H - 22);
    mono(c, 20, 'right', '#d7e7d8'); c.fillText(`GS ${Math.round((state.speed || 0) * 1.94384)} KTS`, W - 20, H - 22);
    nav.texture.needsUpdate = true;
  }

  function drawEngine(state) {
    const { ctx: c, canvas: { width: W, height: H } } = engine;
    c.fillStyle = '#071015'; c.fillRect(0, 0, W, H);
    mono(c, 20, 'center', '#9ac6b5'); c.fillText('POWER', W / 2, 25);
    for (let i = 0; i < 2; i++) {
      const cx = W * (i ? 0.73 : 0.27), cy = 119, r = 63;
      c.beginPath(); c.arc(cx, cy, r, Math.PI * 0.8, Math.PI * 2.2);
      c.strokeStyle = '#35544f'; c.lineWidth = 5; c.stroke();
      c.beginPath(); c.arc(cx, cy, r, Math.PI * 0.8, Math.PI * (0.8 + 1.4 * spool));
      c.strokeStyle = '#8addaf'; c.lineWidth = 5; c.stroke();
      const a = Math.PI * (0.8 + 1.4 * spool);
      line(c, cx, cy, cx + Math.cos(a) * (r - 7), cy + Math.sin(a) * (r - 7), '#d5ead7', 2);
      mono(c, 29, 'center', '#e3f4dd'); c.fillText(Math.round(spool * 100), cx, cy + 39);
      mono(c, 15, 'center', '#7fa298'); c.fillText(i ? 'ENG 2' : 'ENG 1', cx, cy + 67);
    }
    line(c, 24, 222, W - 24, 222, '#35504d', 1);
    const rows = [
      ['THRUST', `${Math.round((state.throttle || 0) * 100)} %`],
      ['V / S', `${(state.verticalSpeed || 0) >= 0 ? '+' : ''}${Math.round((state.verticalSpeed || 0) * 196.85 / 50) * 50}`],
      ['GEAR', state.gear ? 'DOWN' : 'UP'],
      ['FLAPS', `${Math.round((state.flaps || 0) * 30)}°`],
    ];
    rows.forEach(([name, value], i) => {
      mono(c, 18, 'left', '#7faaa5'); c.fillText(name, 23, 260 + i * 53);
      mono(c, 25, 'right', '#d8ead6'); c.fillText(value, W - 23, 260 + i * 53);
    });
    mono(c, 17, 'center', '#78c7aa'); c.fillText('SYSTEMS NORMAL', W / 2, H - 22);
    engine.texture.needsUpdate = true;
  }

  function drawStandby(state) {
    const c = standby.ctx, W = 256;
    c.fillStyle = '#071017'; c.fillRect(0, 0, W, 768);
    for (let i = 0; i < 3; i++) {
      const cy = 128 + i * 256;
      c.save(); c.beginPath(); c.arc(128, cy, 124, 0, Math.PI * 2); c.clip();
      if (i === 0) {
        c.translate(128, cy); c.rotate(-(state.roll || 0));
        const yy = (state.pitch || 0) * 140;
        c.fillStyle = '#276d93'; c.fillRect(-180, -250, 360, 250 + yy);
        c.fillStyle = '#806044'; c.fillRect(-180, yy, 360, 250);
        line(c, -180, yy, 180, yy, '#f2e9d2', 4);
        c.restore();
        line(c, 68, cy, 110, cy, '#ffe498', 5); line(c, 146, cy, 188, cy, '#ffe498', 5);
        c.fillStyle = '#ffe498'; c.fillRect(123, cy - 5, 10, 10);
      } else {
        const val = i === 1 ? Math.max(0, (state.speed || 0) * 1.94384) : Math.max(0, (state.altitude || 0) * 3.28084);
        for (let n = 0; n < 24; n++) {
          const a = n / 24 * Math.PI * 2;
          line(c, 128 + Math.cos(a) * 105, cy + Math.sin(a) * 105, 128 + Math.cos(a) * (n % 3 === 0 ? 86 : 95), cy + Math.sin(a) * (n % 3 === 0 ? 86 : 95), '#b8ccc7', 3);
        }
        const angle = (i === 1 ? val / 350 : (val % 1000) / 1000) * Math.PI * 2 - Math.PI / 2;
        line(c, 128, cy, 128 + Math.cos(angle) * 87, cy + Math.sin(angle) * 87, '#f4edce', 5);
        mono(c, 24, 'center', '#9fb6b7'); c.fillText(i === 1 ? 'KTS' : 'FT', 128, cy + 56);
        mono(c, 26, 'center', '#e4ead8'); c.fillText(Math.round(val), 128, cy - 43);
        c.restore();
      }
    }
    standby.texture.needsUpdate = true;
    standbyGroup.traverse((obj) => {
      if (obj.userData.faceTexture) obj.userData.faceTexture.needsUpdate = true;
    });
  }

  function drawAnnunciators(state) {
    const c = annunciator.ctx, W = annunciator.canvas.width, H = annunciator.canvas.height;
    c.fillStyle = '#081118'; c.fillRect(0, 0, W, H);
    const entries = [
      ['COURSE', `${pad(headingDeg(state.heading || 0))}°`],
      ['IAS / MACH', `${Math.round((state.speed || 0) * 1.94384)}`],
      ['FLIGHT MODE', state.autopilot ? 'AUTOPILOT' : 'MANUAL'],
      ['ALTITUDE', `${Math.round((state.altitude || 0) * 3.28084 / 10) * 10}`],
      ['VERT SPEED', `${(state.verticalSpeed || 0) >= 0 ? '+' : ''}${Math.round((state.verticalSpeed || 0) * 196.85 / 50) * 50}`],
    ];
    entries.forEach(([name, value], i) => {
      const x = (i + 0.5) * W / entries.length;
      mono(c, 17, 'center', '#789394'); c.fillText(name, x, 23);
      mono(c, 30, 'center', i === 2 ? '#95dcb7' : '#e3d5a0'); c.fillText(value, x, 62);
      if (i) line(c, i * W / entries.length, 12, i * W / entries.length, H - 13, '#273d43', 2);
    });
    annunciator.texture.needsUpdate = true;
    const cc = compassStrip.ctx;
    cc.fillStyle = '#0a1012'; cc.fillRect(0, 0, 384, 64);
    mono(cc, 35, 'center', '#e4dcc6'); cc.fillText(`${pad(headingDeg(state.heading || 0))}°`, 192, 34);
    line(cc, 192, 2, 192, 10, '#e9a96b', 3);
    compassStrip.texture.needsUpdate = true;
  }

  function resize(newAspect) {
    aspect = Math.max(0.4, newAspect || 16 / 9);
    camera.aspect = aspect;
    // A slightly wider vertical lens in portrait makes the flight deck less intrusive.
    camera.fov = aspect < 1.2 ? 56 : 50;
    camera.updateProjectionMatrix();
    const halfWidthAtPost = 2.44 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect;
    leftPost.position.x = -halfWidthAtPost * 0.91;
    rightPost.position.x = halfWidthAtPost * 0.91;
    topBeam.scale.x = (halfWidthAtPost * 2.12) / 4.6;
    topLip.scale.x = topBeam.scale.x;
    const topY = 2.44 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    topBeam.position.y = topY + 0.02;
    topLip.position.y = topY - 0.055;
    compassBox.position.y = topY - 1.215;
    leftGlass.position.x = -halfWidthAtPost * 0.95;
    rightGlass.position.x = halfWidthAtPost * 0.95;
    const cabinHalfWidth = Math.max(2.72, halfWidthAtPost * 0.94 + 0.24);
    cabinFloor.scale.x = cabinRoof.scale.x = cabinHalfWidth / 2.72;
    for (let i = 0; i < sideCabins.length; i++) {
      const sign = i === 0 ? -1 : 1;
      sideCabins[i].position.x = sign * cabinHalfWidth;
      const frontTop = [sign * (halfWidthAtPost * 0.91 + 0.07), 1.13, -2.43];
      const frontBottom = [sign * (halfWidthAtPost * 0.91 + 0.14), -0.60, -2.79];
      const sideTop = [sign * cabinHalfWidth, 1.28, -1.3];
      const sideBottom = [sign * cabinHalfWidth, -0.85, -1.3];
      placeRail(i === 0 ? leftUpperRail : rightUpperRail, frontTop, sideTop);
      placeRail(i === 0 ? leftSill : rightSill, frontBottom, sideBottom);
      const geometry = quarterWindows[i].geometry;
      geometry.attributes.position.array.set([...frontTop, ...sideTop, ...sideBottom, ...frontBottom]);
      geometry.attributes.position.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      const lowerPanel = quarterPanels[i].geometry;
      lowerPanel.attributes.position.array.set([
        ...frontBottom, ...sideBottom,
        sign * cabinHalfWidth, -2.10, -1.3,
        frontBottom[0], -2.10, frontBottom[2],
      ]);
      lowerPanel.attributes.position.needsUpdate = true;
      lowerPanel.computeVertexNormals();
      lowerPanel.computeBoundingSphere();
    }
    const narrow = aspect < 1.2;
    navDisplay.group.visible = !narrow;
    copilotDisplay.group.visible = aspect > 1.7;
    standbyGroup.visible = !narrow;
    systemsGroup.visible = !narrow;
    pedestal.visible = !narrow;
    upperStrip.visible = !narrow;
    primaryDisplay.group.position.x = narrow ? -0.20 : -1.01;
    primaryDisplay.group.position.y = narrow ? -1.15 : -1.045;
    primaryDisplay.group.scale.set(narrow ? 0.9 : 1, narrow ? 0.9 : 1, 1);
    engineDisplay.group.position.x = narrow ? 0.42 : 0.93;
    engineDisplay.group.position.y = narrow ? -1.15 : -1.045;
    engineDisplay.group.scale.set(narrow ? 0.9 : 1, narrow ? 0.9 : 1, 1);
    yoke.position.x = narrow ? -0.34 : yokeHome.x;
    yoke.position.y = narrow ? -1.37 : yokeHome.y;
    yoke.scale.setScalar(narrow ? 0.65 : 1);
    // Keep the panoramic dashboard continuous on ultrawide screens.
    scene.userData.cockpitAspect = aspect;
  }

  function setLook(yaw = 0, pitch = 0) {
    // Match the world camera's local Euler(pitch, yaw, 0, 'YXZ') exactly:
    // positive yaw looks left and positive pitch looks up. Never orbit the eye.
    const safeYaw = Number.isFinite(yaw) ? THREE.MathUtils.clamp(yaw, -lookLimits.yaw, lookLimits.yaw) : 0;
    const safePitch = Number.isFinite(pitch) ? THREE.MathUtils.clamp(pitch, -lookLimits.pitch, lookLimits.pitch) : 0;
    camera.rotation.set(safePitch, safeYaw, 0, 'YXZ');
  }

  function update(state = {}, dt = 1 / 60) {
    elapsed += Math.max(0, Math.min(dt, 0.1));
    if (!visible) return;
    const throttle = Math.max(0, Math.min(1, state.throttle ?? 0.6));
    spool += (throttle - spool) * (1 - Math.exp(-Math.max(dt, 0) * 3.5));
    const controls = state.controls || {};
    yokePivot.rotation.z = -(controls.roll || 0) * 0.58;
    yokePivot.rotation.x = (controls.pitch || 0) * 0.14;
    yokePivot.position.z = (controls.pitch || 0) * 0.055;
    for (let i = 0; i < throttleLevers.length; i++) throttleLevers[i].rotation.x = -0.35 + throttle * 0.72;
    gearLever.rotation.x = state.gear ? 0 : -0.9;
    for (const light of gearLights) light.color.setHex(state.gear ? 0x75d6a4 : 0x172b28);
    const motion = Math.min(1, (state.speed || 0) / 100);
    root.position.y = Math.sin(elapsed * 26) * 0.00055 * motion;
    root.position.x = Math.sin(elapsed * 19) * 0.0003 * motion;
    // 12.5 Hz is enough for instruments and avoids redrawing four canvases every frame.
    if (elapsed - lastDraw >= 0.08 || lastDraw < 0) {
      lastDraw = elapsed;
      drawPFD(pfd, state);
      drawNav(state);
      drawEngine(state);
      drawStandby(state);
      drawAnnunciators(state);
      // Copilot shares the same flight data. Avoid a second expensive horizon drawing.
      if (copilotDisplay.group.visible) {
        copilot.ctx.drawImage(pfd.canvas, 0, 0);
        copilot.texture.needsUpdate = true;
      }
    }
  }

  function setVisible(value) {
    visible = Boolean(value);
    root.visible = visible;
  }

  function dispose() {
    for (const item of disposables) item.dispose?.();
    scene.clear();
  }

  resize(16 / 9);
  update({ speed: 72, altitude: 300, heading: 0, pitch: 0, roll: 0, throttle: 0.62, gear: false, flaps: 0 }, 0);
  return { scene, camera, update, resize, setLook, lookLimits, setVisible, dispose };
}
