/**
 * A slim, articulated village cyclist. All assets are original geometry and
 * tiny locally painted material maps; no external model or network request.
 * Local forward is -Z. The returned group is the world-position/yaw root.
 */
export function createRiderModel(THREE, { isMobile = false } = {}) {
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const up = v(0, 1, 0);
  const rnd = n => { const x = Math.sin(n * 91.17 + 3.42) * 47191.191; return x - Math.floor(x); };
  const group = new THREE.Group(); group.name = 'Vincent — slender cyclist';
  const rig = new THREE.Group(); rig.name = 'Bicycle lean and trick rig'; group.add(rig);
  const upper = new THREE.Group(); upper.name = 'Fitted coat and upper body';
  const HIP_Y = 1.72, HIP_Z = .38;
  upper.position.set(0, HIP_Y, HIP_Z); rig.add(upper);

  function paintMap(kind) {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); if (!g) return null;
    const palette = kind === 'coat' ? ['#163e9d', '#2155c0', '#2d6cdd', '#4e89e1'] :
      kind === 'leather' ? ['#4d3023', '#684634', '#8c6243', '#b0865a'] :
      ['#bc944c', '#d6b763', '#edce7c', '#f6df9d'];
    g.fillStyle = palette[1]; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 420; i++) {
      const x = rnd(i * 7 + 3) * 256, y = rnd(i * 13 + 7) * 256;
      g.strokeStyle = palette[i % palette.length]; g.globalAlpha = .25 + rnd(i + 11) * .35;
      g.lineWidth = kind === 'straw' ? .65 : .7 + rnd(i * 5) * 1.4;
      const dx = kind === 'straw' ? 6 + rnd(i + 6) * 19 : 2 + rnd(i + 6) * 8;
      const dy = kind === 'coat' ? -4 - rnd(i + 10) * 13 : kind === 'straw' ? 1 : -2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx, y + dy); g.stroke();
    }
    g.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = isMobile ? 2 : 4;
    return texture;
  }
  const coatMap = paintMap('coat'), strawMap = paintMap('straw'), leatherMap = paintMap('leather');
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .88, ...extra });
  const M = {
    coat: mat(coatMap ? 0xffffff : 0x2359c4, { map: coatMap, roughness: .95 }),
    seam: mat(0x12367f), lapel: mat(0x3876ce),
    trousers: mat(0x292a31), shoe: mat(0x1c2027),
    skin: mat(0xc59673, { roughness: .95 }),
    hair: mat(0x62382a), eyes: mat(0x242b36),
    straw: mat(strawMap ? 0xffffff : 0xe6c97b, { map: strawMap, roughness: 1 }),
    hatBand: mat(0x4b543f), leather: mat(leatherMap ? 0xffffff : 0x76513b, { map: leatherMap }),
    leatherEdge: mat(0xb48d59), buckle: mat(0xbb9b58, { metalness: .5, roughness: .4 }),
    scarf: mat(0xab463c, { side: THREE.DoubleSide, roughness: 1 }),
    frame: mat(0x314350, { metalness: .56, roughness: .4 }),
    chrome: mat(0xa9b0af, { metalness: .72, roughness: .32 }),
    rubber: mat(0x111721, { roughness: 1 }),
    lamp: mat(0xffecc1, { emissive: 0xffdc8d, emissiveIntensity: 3.2 }),
    tail: mat(0xfa4947, { emissive: 0xff221e, emissiveIntensity: 3.3 })
  };

  // The immobile details of each assembly are merged by material. A model
  // with many carefully shaped details therefore stays under 50 draw meshes.
  function builder(parent, origin = v()) {
    const buckets = new Map();
    const dummy = new THREE.Object3D();
    function add(geo, material, position = v(), rotation = v(), scale = v(1, 1, 1)) {
      dummy.position.copy(position).sub(origin); dummy.rotation.set(rotation.x, rotation.y, rotation.z);
      dummy.scale.copy(scale); dummy.updateMatrix();
      let transformed = geo.clone().applyMatrix4(dummy.matrix);
      if (transformed.index) { const nonIndexed = transformed.toNonIndexed(); transformed.dispose(); transformed = nonIndexed; }
      if (!transformed.attributes.normal) transformed.computeVertexNormals();
      const key = material.uuid;
      if (!buckets.has(key)) buckets.set(key, { material, geometries: [] });
      buckets.get(key).geometries.push(transformed); geo.dispose();
    }
    function tube(a, b, radius, material, sides = 7) {
      const d = b.clone().sub(a), mid = a.clone().add(b).multiplyScalar(.5);
      const geo = new THREE.CylinderGeometry(radius, radius, d.length(), sides);
      const q = new THREE.Quaternion().setFromUnitVectors(up, d.normalize());
      geo.applyQuaternion(q); add(geo, material, mid);
    }
    function box(w, h, d, material, x, y, z, rz = 0) {
      add(new THREE.BoxGeometry(w, h, d), material, v(x, y, z), v(0, 0, rz));
    }
    function finish() {
      for (const { material, geometries } of buckets.values()) {
        const positions = [], normals = [], uvs = [];
        for (const geo of geometries) {
          const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
          for (let i = 0; i < p.count; i++) {
            positions.push(p.getX(i), p.getY(i), p.getZ(i));
            normals.push(n.getX(i), n.getY(i), n.getZ(i));
            uvs.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
          }
          geo.dispose();
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, material); mesh.castShadow = !isMobile;
        parent.add(mesh);
      }
      buckets.clear();
    }
    return { add, tube, box, finish };
  }

  // Elliptical sections give the coat an actual chest, narrow waist and
  // shoulders. In particular its depth is NOT equal to its shoulder width.
  function loft(sections, sides = 16) {
    const positions = [], uvs = [], indices = [];
    sections.forEach(([y, rx, rz, cz], j) => {
      for (let i = 0; i <= sides; i++) {
        const a = i / sides * TAU;
        positions.push(Math.cos(a) * rx, y, cz + Math.sin(a) * rz);
        uvs.push(i / sides, j / (sections.length - 1));
      }
    });
    for (let j = 0; j < sections.length - 1; j++) for (let i = 0; i < sides; i++) {
      const a = j * (sides + 1) + i, b = a + sides + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
    // The two ends are closed to remain valid from side/jump views.
    for (const [row, reverse] of [[0, true], [sections.length - 1, false]]) {
      const section = sections[row], center = positions.length / 3;
      positions.push(0, section[0], section[3]); uvs.push(.5, .5);
      for (let i = 0; i < sides; i++) {
        const a = row * (sides + 1) + i, b = a + 1;
        if (reverse) indices.push(center, a, b); else indices.push(center, b, a);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices); geo.computeVertexNormals(); return geo;
  }
  function ellipsoid(rx, ry, rz) {
    return new THREE.SphereGeometry(1, 14, 10).scale(rx, ry, rz);
  }

  const bikeParts = builder(rig);
  const FRONT_Z = -1.08, REAR_Z = 1.06, WHEEL_Y = .61, RADIUS = .57;
  const crank = v(0, .84, .13), seat = v(0, 1.64, .43), neck = v(0, 1.59, -.70);
  bikeParts.tube(crank, seat, .035, M.frame);
  bikeParts.tube(seat, neck, .035, M.frame);
  bikeParts.tube(neck, crank, .04, M.frame);
  for (const side of [-1, 1]) {
    const rear = v(side * .085, WHEEL_Y, REAR_Z);
    bikeParts.tube(rear, v(side * .045, crank.y, crank.z), .025, M.frame);
    bikeParts.tube(rear, v(side * .04, seat.y - .09, seat.z), .024, M.frame);
  }
  bikeParts.tube(v(0, 1.54, .43), v(0, 1.73, .43), .035, M.chrome);
  bikeParts.add(ellipsoid(.185, .055, .275), M.shoe, v(0, 1.72, .43));
  bikeParts.add(new THREE.TorusGeometry(.22, .022, 6, 24), M.chrome, v(.11, crank.y, crank.z), v(0, Math.PI / 2, 0));
  // The chain uses two exceptionally thin dark runs rather than a solid box.
  bikeParts.tube(v(.13, .99, .13), v(.13, .68, 1.06), .011, M.chrome, 4);
  bikeParts.tube(v(.13, .68, .13), v(.13, .55, 1.06), .011, M.chrome, 4);
  bikeParts.tube(v(-.1, 1.12, .57), v(-.1, 1.12, 1.32), .024, M.chrome);
  bikeParts.tube(v(.1, 1.12, .57), v(.1, 1.12, 1.32), .024, M.chrome);
  bikeParts.box(.24, .025, .72, M.frame, 0, 1.12, .97);
  bikeParts.box(.14, .12, .085, M.tail, 0, 1.10, 1.38);
  const rearGuard = [];
  for (let i = 0; i <= 18; i++) {
    const a = .08 * Math.PI + i / 18 * .84 * Math.PI;
    rearGuard.push(v(0, WHEEL_Y + Math.sin(a) * .655, REAR_Z + Math.cos(a) * .655));
  }
  bikeParts.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rearGuard), 26, .03, 6, false), M.frame);
  bikeParts.finish();

  // The front assembly really turns. Hands follow its grips, rather than
  // drifting off fixed handlebar geometry when the cyclist leans.
  const steering = new THREE.Group(); steering.name = 'Steering fork and handlebars';
  steering.position.set(0, 1.58, -.70); rig.add(steering);
  const forkParts = builder(steering);
  for (const side of [-1, 1]) forkParts.tube(v(side * .075, .03, 0), v(side * .075, -.97, -.38), .025, M.chrome);
  forkParts.tube(v(0, -.06, 0), v(0, .25, -.12), .036, M.frame);
  const barCurve = new THREE.CatmullRomCurve3([
    v(-.46, .22, -.01), v(-.28, .27, -.13), v(0, .27, -.17), v(.28, .27, -.13), v(.46, .22, -.01)
  ]);
  forkParts.add(new THREE.TubeGeometry(barCurve, 20, .023, 6, false), M.chrome);
  for (const side of [-1, 1]) forkParts.tube(v(side * .35, .22, -.01), v(side * .49, .22, -.01), .035, M.rubber);
  const frontGuard = [];
  for (let i = 0; i <= 18; i++) {
    const a = .09 * Math.PI + i / 18 * .82 * Math.PI;
    frontGuard.push(v(0, -.97 + Math.sin(a) * .655, -.38 + Math.cos(a) * .655));
  }
  forkParts.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(frontGuard), 26, .03, 6, false), M.frame);
  forkParts.add(ellipsoid(.115, .115, .105), M.frame, v(0, -.07, -.25));
  forkParts.add(ellipsoid(.087, .087, .025), M.lamp, v(0, -.07, -.346));
  forkParts.finish();
  const headlight = new THREE.SpotLight(0xffdf9b, 15, 23, .43, .9, 1.6);
  headlight.position.set(0, -.08, -.39); headlight.target.position.set(0, -1.25, -8);
  steering.add(headlight, headlight.target);

  const wheels = [];
  function makeWheel(parent, y, z) {
    const wheel = new THREE.Group(); wheel.position.set(0, y, z); parent.add(wheel);
    const parts = builder(wheel);
    parts.add(new THREE.TorusGeometry(RADIUS, .045, 8, 36), M.rubber, v(), v(0, Math.PI / 2, 0));
    parts.add(new THREE.TorusGeometry(.515, .015, 5, 32), M.chrome, v(), v(0, Math.PI / 2, 0));
    parts.add(new THREE.CylinderGeometry(.055, .055, .20, 8), M.chrome, v(), v(0, 0, Math.PI / 2));
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * TAU;
      parts.tube(v((i % 2 ? 1 : -1) * .04, 0, 0), v(0, Math.sin(a) * .515, Math.cos(a) * .515), .0055, M.chrome, 3);
    }
    parts.finish(); wheels.push(wheel);
  }
  makeWheel(rig, WHEEL_Y, REAR_Z); makeWheel(steering, WHEEL_Y - 1.58, FRONT_Z + .70);

  const bodyParts = builder(upper, v(0, HIP_Y, HIP_Z));
  bodyParts.add(loft([
    [1.53, .235, .155, .45], [1.60, .265, .17, .425],
    [1.78, .245, .16, .38], [1.96, .205, .133, .285],
    [2.18, .225, .145, .175], [2.38, .27, .15, .065],
    [2.52, .305, .14, -.002], [2.59, .265, .125, -.035],
    [2.66, .11, .093, -.065]
  ], 18), M.coat);
  // Subtle structure: lapels, center seam, hip pockets and a tailored collar.
  bodyParts.tube(v(0, 1.62, .255), v(0, 2.37, -.092), .008, M.seam, 4);
  for (const side of [-1, 1]) {
    bodyParts.tube(v(side * .09, 2.61, -.16), v(side * .135, 2.39, -.105), .027, M.lapel, 5);
    bodyParts.tube(v(side * .115, 1.98, .15), v(side * .185, 2.015, .16), .011, M.lapel, 4);
    bodyParts.tube(v(side * .228, 1.63, .47), v(side * .20, 1.98, .4), .007, M.seam, 4);
  }
  for (let i = 0; i < 4; i++) bodyParts.add(ellipsoid(.014, .014, .012), M.buckle,
    v(-.025, 2.34 - i * .16, -.09 + i * .078));
  bodyParts.add(new THREE.CylinderGeometry(.105, .12, .12, 14), M.scarf, v(0, 2.655, -.065));
  bodyParts.add(new THREE.CylinderGeometry(.075, .088, .18, 12), M.skin, v(0, 2.73, -.075));
  // Sculpted cheeks/jaw replace an oversized spherical head.
  bodyParts.add(loft([
    [2.744, .061, .055, -.085], [2.78, .101, .092, -.095],
    [2.835, .137, .122, -.089], [2.92, .157, .139, -.074],
    [3.005, .15, .13, -.059], [3.074, .119, .105, -.051],
    [3.115, .05, .046, -.049]
  ], 20), M.skin);
  for (const side of [-1, 1]) {
    bodyParts.add(ellipsoid(.024, .052, .024), M.skin, v(side * .158, 2.89, -.06));
    bodyParts.add(ellipsoid(.026, .011, .009), M.eyes, v(side * .066, 2.943, -.205));
    bodyParts.tube(v(side * .041, 2.975, -.208), v(side * .096, 2.974, -.194), .007, M.hair, 4);
  }
  bodyParts.add(ellipsoid(.031, .050, .041), M.skin, v(0, 2.888, -.224));
  bodyParts.add(ellipsoid(.107, .063, .012), M.hair, v(0, 2.794, -.184));
  bodyParts.tube(v(-.035, 2.822, -.209), v(.035, 2.822, -.209), .005, M.hair, 4);
  const hairCap = new THREE.SphereGeometry(1, 18, 10, 0, TAU, 0, Math.PI * .65).scale(.164, .15, .146);
  bodyParts.add(hairCap, M.hair, v(0, 2.99, -.036));
  // Wide but paper-thin boater brim, low crown and dark woven band.
  bodyParts.add(new THREE.CylinderGeometry(.38, .385, .035, 32).scale(1, 1, .83), M.straw, v(0, 3.111, -.05));
  bodyParts.add(new THREE.CylinderGeometry(.205, .22, .162, 24).scale(1, 1, .89), M.straw, v(0, 3.209, -.05));
  bodyParts.add(new THREE.CylinderGeometry(.22, .222, .043, 24).scale(1, 1, .89), M.hatBand, v(0, 3.158, -.05));
  bodyParts.add(new THREE.CylinderGeometry(.205, .207, .012, 24).scale(1, 1, .89), M.straw, v(0, 3.294, -.05));

  // A small worn leather satchel is fitted to the back, not a giant box.
  bodyParts.box(.405, .53, .135, M.leather, 0, 2.15, .435);
  bodyParts.box(.365, .455, .02, M.leatherEdge, 0, 2.14, .51);
  bodyParts.box(.33, .418, .025, M.leather, 0, 2.14, .528);
  bodyParts.box(.41, .13, .041, M.leather, 0, 2.375, .526);
  bodyParts.box(.042, .135, .032, M.leatherEdge, 0, 2.335, .555);
  bodyParts.box(.065, .047, .038, M.buckle, 0, 2.30, .572);
  for (const side of [-1, 1]) {
    bodyParts.tube(v(side * .215, 2.56, .1), v(side * .162, 2.38, .43), .019, M.leather, 5);
    bodyParts.tube(v(side * .16, 2.38, .5), v(side * .16, 1.94, .48), .012, M.leatherEdge, 4);
  }
  bodyParts.finish();

  const pelvis = new THREE.Mesh(ellipsoid(.215, .145, .18), M.trousers);
  pelvis.position.set(0, HIP_Y, HIP_Z); rig.add(pelvis);

  function dynamicTube(sides, rings, material) {
    const geo = new THREE.BufferGeometry(), positions = new Float32Array(rings * sides * 3), indices = [];
    for (let j = 0; j < rings - 1; j++) for (let i = 0; i < sides; i++) {
      const a = j * sides + i, b = j * sides + (i + 1) % sides;
      indices.push(a, b, a + sides, b, b + sides, a + sides);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geo.setIndex(indices);
    const uv = new Float32Array(rings * sides * 2);
    for (let j = 0; j < rings; j++) for (let i = 0; i < sides; i++) {
      uv[(j * sides + i) * 2] = i / sides; uv[(j * sides + i) * 2 + 1] = j / (rings - 1);
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const mesh = new THREE.Mesh(geo, material); mesh.frustumCulled = false; rig.add(mesh);
    const tangent = v(), axisA = v(), axisB = v(), basis = v(1, 0, 0);
    function update(points, radii) {
      const attr = geo.attributes.position;
      for (let j = 0; j < rings; j++) {
        tangent.copy(points[Math.min(j + 1, rings - 1)]).sub(points[Math.max(0, j - 1)]).normalize();
        axisA.crossVectors(tangent, Math.abs(tangent.x) > .9 ? up : basis).normalize();
        axisB.crossVectors(tangent, axisA).normalize();
        for (let i = 0; i < sides; i++) {
          const a = i / sides * TAU, ca = Math.cos(a) * radii[j], sa = Math.sin(a) * radii[j];
          attr.setXYZ(j * sides + i, points[j].x + axisA.x * ca + axisB.x * sa,
            points[j].y + axisA.y * ca + axisB.y * sa, points[j].z + axisA.z * ca + axisB.z * sa);
        }
      }
      attr.needsUpdate = true; geo.computeVertexNormals();
    }
    return { mesh, update };
  }

  const arms = [-1, 1].map(side => {
    const sleeve = dynamicTube(9, 5, M.coat);
    const hand = new THREE.Mesh(ellipsoid(.06, .048, .072), M.skin); rig.add(hand);
    return { side, sleeve, hand, root: v(), elbow: v(), wrist: v(),
      points: [v(), v(), v(), v(), v()], hint: v(), direction: v() };
  });
  const legs = [-1, 1].map(side => {
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(.071, .096, 1, 10), M.trousers);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(.047, .07, 1, 10), M.trousers);
    const shoe = new THREE.Mesh(ellipsoid(.081, .061, .17), M.shoe);
    const pedal = new THREE.Mesh(new THREE.BoxGeometry(.14, .038, .18), M.frame);
    const crankArm = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, 1, 6), M.chrome);
    rig.add(thigh, shin, shoe, pedal, crankArm);
    return { side, thigh, shin, shoe, pedal, crankArm, hip: v(side * .16, HIP_Y, HIP_Z), ankle: v(), knee: v(), pedalCenter: v(), crankStart: v(side * .18, crank.y, crank.z) };
  });
  const segDirection = v(), segMid = v();
  function segment(mesh, a, b) {
    segDirection.copy(b).sub(a); const length = segDirection.length();
    segMid.copy(a).add(b).multiplyScalar(.5); mesh.position.copy(segMid);
    mesh.quaternion.setFromUnitVectors(up, segDirection.multiplyScalar(1 / Math.max(.0001, length)));
    mesh.scale.y = length;
  }

  // Two small split coattails flutter without widening the human silhouette.
  const clothMaterial = M.coat.clone(); clothMaterial.side = THREE.DoubleSide;
  const tails = [-1, 1].map(side => {
    const geo = new THREE.PlaneGeometry(.225, .30, 1, 3);
    const mesh = new THREE.Mesh(geo, clothMaterial); mesh.position.set(side * .122, 1.54, .575);
    mesh.rotation.x = -.15; rig.add(mesh); return { mesh, side };
  });
  const scarfGeo = new THREE.BufferGeometry();
  const scarfPositions = new Float32Array(14 * 3), scarfIndices = [];
  for (let i = 0; i < 6; i++) { const a = i * 2; scarfIndices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  scarfGeo.setAttribute('position', new THREE.BufferAttribute(scarfPositions, 3)); scarfGeo.setIndex(scarfIndices);
  const scarf = new THREE.Mesh(scarfGeo, M.scarf); scarf.frustumCulled = false; upper.add(scarf);

  let pedalPhase = .7;
  function animate(timeMs, dt, state) {
    const speed = Math.max(0, Number(state.speed) || 0), wind = clamp(speed / 19, 0, 1);
    const steeringAmount = clamp(Number(state.steerSmooth) || 0, -1, 1);
    pedalPhase = (pedalPhase + speed * dt * .72) % TAU;
    for (const wheel of wheels) wheel.rotation.x -= speed * dt / RADIUS;
    steering.rotation.y = steeringAmount * .25;
    upper.rotation.x = -wind * .035;
    upper.rotation.z = steeringAmount * .025 + Math.sin(pedalPhase * 2) * wind * .007;
    upper.position.y = HIP_Y + Math.sin(pedalPhase * 2) * wind * .006;
    upper.updateMatrix(); steering.updateMatrix();
    for (const leg of legs) {
      const a = pedalPhase + (leg.side < 0 ? 0 : Math.PI);
      leg.ankle.set(leg.side * .19, crank.y + Math.sin(a) * .265 + .09, crank.z + Math.cos(a) * .265);
      // Two-link IK: fixed femur/shin lengths, knee bent toward bicycle front.
      const dy = leg.ankle.y - leg.hip.y, dz = leg.ankle.z - leg.hip.z;
      const d = Math.max(.01, Math.hypot(dy, dz)), L1 = .64, L2 = .65;
      const along = clamp((L1 * L1 - L2 * L2 + d * d) / (2 * d), .02, L1);
      const bend = Math.sqrt(Math.max(.0001, L1 * L1 - along * along));
      leg.knee.set(leg.side * .186, leg.hip.y + dy / d * along - dz / d * bend,
        leg.hip.z + dz / d * along + dy / d * bend);
      segment(leg.thigh, leg.hip, leg.knee); segment(leg.shin, leg.knee, leg.ankle);
      leg.shoe.position.copy(leg.ankle); leg.shoe.position.z -= .065;
      leg.shoe.rotation.x = -.08 + Math.sin(a) * .085;
      leg.pedalCenter.copy(leg.ankle); leg.pedalCenter.y -= .09;
      leg.pedal.position.copy(leg.pedalCenter); segment(leg.crankArm, leg.crankStart, leg.pedalCenter);
    }
    for (const arm of arms) {
      arm.root.set(arm.side * .285, 2.525 - HIP_Y, -.005 - HIP_Z).applyMatrix4(upper.matrix);
      arm.wrist.set(arm.side * .445, .22, -.01).applyMatrix4(steering.matrix);
      arm.direction.copy(arm.wrist).sub(arm.root); const d = arm.direction.length(); arm.direction.normalize();
      const l1 = .545, l2 = .54, along = clamp((l1 * l1 - l2 * l2 + d * d) / (2 * d), .01, l1);
      const bend = Math.sqrt(Math.max(.001, l1 * l1 - along * along));
      arm.hint.set(arm.side, .05, .15); arm.hint.addScaledVector(arm.direction, -arm.hint.dot(arm.direction)).normalize();
      arm.elbow.copy(arm.root).addScaledVector(arm.direction, along).addScaledVector(arm.hint, bend);
      arm.points[0].copy(arm.root); arm.points[1].copy(arm.root).lerp(arm.elbow, .53);
      arm.points[2].copy(arm.elbow); arm.points[3].copy(arm.elbow).lerp(arm.wrist, .52); arm.points[4].copy(arm.wrist);
      arm.sleeve.update(arm.points, [.097, .081, .072, .060, .047]);
      arm.hand.position.copy(arm.wrist); arm.hand.rotation.y = steering.rotation.y;
    }
    for (const { mesh, side } of tails) {
      mesh.rotation.x = -.10 - wind * .18 + Math.sin(timeMs * .005 + side) * wind * .045;
      mesh.rotation.z = side * .035 + Math.sin(pedalPhase) * .015;
    }
    const sp = scarfGeo.attributes.position;
    for (let i = 0; i <= 6; i++) {
      const t = i / 6, width = .105 * (1 - t * .45);
      const x = -.055 + Math.sin(timeMs * .005 - t * 4) * t * (.015 + wind * .065);
      const y = 2.64 - HIP_Y - t * (.23 - wind * .11);
      const z = .075 - HIP_Z + t * (.34 + wind * .28);
      sp.setXYZ(i * 2, x - width / 2, y, z); sp.setXYZ(i * 2 + 1, x + width / 2, y + .012 * t, z);
    }
    sp.needsUpdate = true; scarfGeo.computeVertexNormals();
    let roll = (Number(state.lean) || 0) * .18;
    if (state.trickDuration > 0) {
      const t = clamp((timeMs - state.trickStart) / state.trickDuration, 0, 1);
      if (t < 1) roll += t * t * (3 - 2 * t) * TAU;
      else state.trickDuration = 0;
    }
    rig.rotation.z = roll;
  }
  animate(0, 0, { speed: 0, lean: 0, steerSmooth: 0, trickDuration: 0 });
  group.userData.modelVersion = 'slender-rider-v11';
  group.userData.proportions = { shoulderWidth: .61, waistWidth: .41, hatTop: 3.30, satchelWidth: .405, wheelRadius: RADIUS };
  return { group, rig, animate, headlight };
}
