/**
 * Two procedural models reconstructed from Xin Wang's RC-aircraft photographs.
 * +Z nose, +Y up. No external textures or model files are required.
 * Factories return an independently reusable Three.js Group and animation hook.
 */

const TAU = Math.PI * 2;

function profileAt(stations, z) {
  const ss = stations.slice().sort((a, b) => a[0] - b[0]);
  if (z <= ss[0][0]) return ss[0];
  if (z >= ss[ss.length - 1][0]) return ss[ss.length - 1];
  for (let i = 1; i < ss.length; i++) {
    if (z <= ss[i][0]) {
      const a = ss[i - 1], b = ss[i], t = (z - a[0]) / (b[0] - a[0]);
      return [z, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t,
        (a[3] || 0) + ((b[3] || 0) - (a[3] || 0)) * t,
        (a[4] || 0) + ((b[4] || 0) - (a[4] || 0)) * t];
    }
  }
  return ss[0];
}

function paintedTexture(THREE, name, draw, width = 1024, height = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = name + ' texture'; texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Paint follows the fuselage, rather than sitting on a floating rectangular card.
function bodyMarking(THREE, H, parent, name, stations, side, z, y, width, height, draw) {
  const nx = 40, ny = 12, positions = [], uvs = [], indices = [];
  for (let j = 0; j <= ny; j++) {
    const v = j / ny, yy = y + (v - .5) * height;
    for (let i = 0; i <= nx; i++) {
      const u = i / nx, zz = z + (.5 - u) * width * side;
      const p = profileAt(stations, zz), f = Math.min(.99, Math.abs((yy - p[3]) / Math.max(.001, p[2])));
      positions.push(p[4] + side * (p[1] * Math.sqrt(1 - f * f) + .012), yy, zz);
      uvs.push(u, v);
    }
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + nx + 1;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices); geom.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    map: paintedTexture(THREE, name, draw), transparent: true, alphaTest: .025,
    roughness: .55, metalness: .1, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2
  });
  material.name = name + ' ink';
  const mark = H.mesh(parent, name, geom, material); mark.castShadow = false; mark.renderOrder = 3; return mark;
}

function ringSeam(H, parent, stations, z, name, color = 0x34434a, opacity = .34, from = 0, to = TAU) {
  const p = profileAt(stations, z), pts = [];
  for (let i = 0; i <= 64; i++) {
    const a = from + (to - from) * i / 64;
    pts.push([p[4] + Math.sin(a) * (p[1] + .008), p[3] + Math.cos(a) * (p[2] + .008), z]);
  }
  return H.line(parent, name, pts, color, opacity);
}

function redStar(H, ctx, w, h) {
  H.star(ctx, w / 2, h / 2, Math.min(w, h) * .47, '#eff1ef');
  H.star(ctx, w / 2, h / 2, Math.min(w, h) * .375, '#b94046');
}

function lowVisRoundel(ctx, w, h) {
  const cx = w / 2, cy = h / 2, r = h * .46;
  ctx.strokeStyle = '#33434b'; ctx.fillStyle = '#9ca9ac'; ctx.lineWidth = h * .055;
  ctx.fillRect(w * .04, h * .30, w * .92, h * .40);
  ctx.strokeRect(w * .04, h * .30, w * .92, h * .40);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .39 : r * .87;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath(); ctx.fillStyle = '#34454e'; ctx.fill();
}

function wingSeams(H, parent, side, points, color = 0x3e4f57) {
  const upper = points.map(p => [side * p[0], p[1], p[2]]);
  H.line(parent, 'Upper wing access / control surface seam', upper, color, .43);
}

function makeStore(THREE, H, parent, side, outer, material, white, dark) {
  const x = side * (outer ? 3.68 : 2.35), y = outer ? -.87 : -.92;
  const pylon = H.fin(parent, outer ? 'Outer store pylon' : 'Inner store pylon',
    [[-.01, .12], [-.49, -.08], [-.57, -.78], [-.03, -1.05]], .085, x, material);
  pylon.userData.part = 'pylon';
  if (!outer) {
    H.loft(parent, 'Streamlined underwing display tank', [
      [1.02, .006, .006, y, x], [.87, .12, .13, y, x], [.54, .235, .25, y, x],
      [-.43, .25, .27, y, x], [-1.0, .17, .19, y, x], [-1.32, .015, .015, y, x]
    ], white);
    H.wing(parent, 'Display tank stabilizing fin', [
      [x - .22, -.72, -1.17, y, .025], [x - .44, -.95, -1.32, y, .015]
    ], material);
    H.wing(parent, 'Display tank stabilizing fin', [
      [x + .22, -.72, -1.17, y, .025], [x + .44, -.95, -1.32, y, .015]
    ], material);
    H.ellipsoid(parent, 'Tank inspection cap', [x, y + .255, .48], [.06, .009, .10], dark);
  } else {
    H.loft(parent, 'Static multi-aperture display pod', [
      [.30, .255, .255, y, x], [.12, .29, .29, y, x], [-.86, .29, .29, y, x],
      [-1.18, .235, .235, y, x], [-1.29, .03, .03, y, x]
    ], material);
    H.mesh(parent, 'White pod face', new THREE.CircleGeometry(.255, 40), white, [x, y, .307]);
    for (let k = 0; k < 7; k++) {
      const a = (k - 1) * TAU / 6, r = k ? .157 : 0;
      H.mesh(parent, 'Recessed static pod aperture', new THREE.CircleGeometry(k ? .058 : .064, 16),
        dark, [x + Math.cos(a) * r, y + Math.sin(a) * r, .313]);
    }
    ringSeam(H, parent, [[-.95, .294, .294, y, x], [.12, .294, .294, y, x]], -.64, 'Pod shell seam', 0x35434a, .4);
  }
}

export function createYak130(THREE, H) {
  const group = new THREE.Group(); group.name = 'Yak-130 · Grey trainer 92';
  const skin = H.mat(0x72858d, { roughness: .34, metalness: .56, clearcoat: .35 });
  skin.name = 'Yak metallic blue grey';
  const wingSkin = H.mat(0x809198, { roughness: .38, metalness: .48, clearcoat: .25 });
  const nosePaint = H.mat(0x4b5e67, { roughness: .37, metalness: .42, clearcoat: .27 });
  const pale = H.mat(0xd5dedf, { roughness: .39, metalness: .24 });
  const dark = H.mat(0x101b20, { roughness: .72, metalness: .18, clearcoat: 0 });
  const black = H.mat(0x2a373c, { roughness: .48, metalness: .32 });
  const silver = H.mat(0xa6b5bb, { roughness: .29, metalness: .77 });
  const stations = [
    [5.88, .008, .008, -.14], [5.55, .155, .155, -.085], [5.12, .31, .28, -.025],
    [4.55, .435, .365, .015], [3.90, .52, .425, .045], [3.20, .61, .49, .045],
    [2.45, .69, .545, .012], [1.65, .82, .595, -.025], [.60, 1.00, .61, -.045],
    [-.60, 1.06, .56, -.015], [-1.85, .97, .485, .005], [-3.00, .82, .40, .025],
    [-4.00, .64, .32, .06], [-5.05, .41, .23, .07], [-5.46, .12, .12, .07]
  ];
  H.loft(group, 'Blended trainer fuselage', stations, skin);
  H.loft(group, 'Dark dielectric radome', stations.slice(0, 5), nosePaint, { subdiv: 5 });
  ringSeam(H, group, stations, 3.91, 'Radome join', 0x26383f, .52);
  H.rod(group, 'Nose pitot', [0, -.14, 5.78], [0, -.14, 6.13], .016, silver, .005);

  // Continuous side nacelles give the Yak its characteristic broad shoulders.
  const exhausts = [];
  for (const side of [-1, 1]) {
    H.loft(group, 'Blended twin engine fairing', [
      [1.76, .14, .18, -.15, side * .68], [1.28, .33, .36, -.23, side * .82],
      [.30, .47, .46, -.26, side * .77], [-1.35, .45, .43, -.24, side * .71],
      [-3.20, .41, .39, -.20, side * .60], [-4.90, .36, .35, -.16, side * .52]
    ], skin);
    H.intake(group, 'Yak cheek air intake', { x: side * .90, y: -.17, z: 1.76, width: .75, height: .70, depth: 1.38, color: 0x8c9aa0 });
    H.wing(group, 'Blended leading edge root extension', [
      [side * .48, 3.21, -1.73, .21, .13], [side * 1.01, 1.96, -1.94, .13, .16],
      [side * 1.65, .59, -2.15, .055, .14]
    ], skin);
    H.wing(group, 'Yak swept main wing', [
      [side * .78, 1.45, -2.22, .015, .20], [side * 1.62, .58, -2.38, .025, .15],
      [side * 4.92, -.80, -2.41, .12, .068]
    ], wingSkin);
    H.rod(group, 'Wingtip rail', [side * 4.95, .12, -.71], [side * 4.95, .09, -2.68], .052, nosePaint, .04);
    H.wing(group, 'Yak all moving horizontal tail', [
      [side * .45, -3.35, -5.20, .33, .11], [side * 1.06, -3.40, -5.40, .36, .085],
      [side * 2.88, -4.08, -5.70, .39, .042]
    ], wingSkin);
    wingSeams(H, group, side, [[1.62, .103, -.04], [4.82, .151, -1.17]]);
    wingSeams(H, group, side, [[1.35, .09, -1.83], [4.78, .17, -1.99], [4.78, .155, -2.35]]);
    wingSeams(H, group, side, [[3.15, .137, -1.91], [3.13, .129, -2.37]]);
    wingSeams(H, group, side, [[.82, .405, -4.90], [2.77, .42, -5.29]]);
    H.decal(group, 'Red wing star', { width: 1.02, height: .83, pos: [side * 3.57, .184, -1.50], rot: [-Math.PI / 2, 0, side < 0 ? Math.PI : 0], draw: (c, w, h) => redStar(H, c, w, h) });
    H.ellipsoid(group, side < 0 ? 'Port navigation lamp' : 'Starboard navigation lamp', [side * 4.94, .151, -.89], [.054, .04, .10],
      H.mat(side < 0 ? 0xc62c39 : 0x4b9671, { emissive: side < 0 ? 0x600b12 : 0x0b4c20, emissiveIntensity: .45, roughness: .19 }));
    makeStore(THREE, H, group, side, false, wingSkin, pale, dark);
    makeStore(THREE, H, group, side, true, skin, pale, dark);
    exhausts.push(H.exhaust(group, { x: side * .52, y: -.16, z: -4.91, r: .355, length: .59 }));

    bodyMarking(THREE, H, group, 'Yak red 92 aircraft number', stations, side, 3.12, -.055, .79, .42,
      (c, w, h) => { c.font = 'bold italic 370px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 19; c.strokeStyle = '#eef0e9'; c.strokeText('92', w / 2, h / 2 + 14); c.fillStyle = '#ac383e'; c.fillText('92', w / 2, h / 2 + 14); });
    bodyMarking(THREE, H, group, 'Yak 130 nose title', stations, side, 4.06, -.11, .61, .18,
      (c, w, h) => { c.font = 'italic 245px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#c7d2d4'; c.fillText('ЯК-130', w / 2, h / 2); });
    bodyMarking(THREE, H, group, 'Yak cockpit service markings', stations, side, 2.20, .06, .40, .30,
      (c, w, h) => {
        c.strokeStyle = '#9d555b'; c.lineWidth = 9; c.strokeRect(145, 80, 450, 300);
        c.fillStyle = '#e0d4ad'; c.font = 'bold 72px Arial'; c.fillText('RESCUE', 165, 180);
        c.fillStyle = '#b25a60'; c.beginPath(); c.moveTo(810, 360); c.lineTo(650, 250); c.lineTo(650, 470); c.fill();
      });
  }

  H.loft(group, 'Dorsal fairing behind the tandem cockpit', [
    [1.78, .30, .17, .52], [1.20, .43, .27, .51], [.20, .38, .22, .49],
    [-1.25, .31, .17, .46], [-2.90, .20, .15, .38], [-3.50, .08, .05, .33]
  ], skin);
  const cockpit = H.cockpit(group, { z: 2.91, y: .427, length: 3.14, width: 1.075, height: .68, seats: 2,
    frame: 0x394c56, glass: 0xb7c9cd, pilot: true, sideHinge: true });
  H.fin(group, 'Yak swept vertical stabilizer', [[.25, -2.51], [2.88, -4.10], [2.89, -4.73], [.22, -5.34]], .105, 0, skin);
  H.fin(group, 'Dark tail cap', [[2.71, -4.00], [2.88, -4.10], [2.89, -4.73], [2.72, -4.78]], .112, 0, nosePaint);
  for (const side of [-1, 1]) {
    H.decal(group, 'Yak tail red star', { width: .73, height: .78, pos: [side * .078, 1.94, -4.10], rot: [0, side * Math.PI / 2, 0], draw: (c, w, h) => redStar(H, c, w, h) });
    H.decal(group, 'Yak tail monogram', { width: .82, height: .34, pos: [side * .078, .95, -4.39], rot: [0, side * Math.PI / 2, 0], draw: (c, w, h) => { c.font = 'italic 340px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#dce6e9'; c.fillText('ЯК', w / 2, h / 2); } });
    H.line(group, 'Rudder hinge', [[side * .077, .33, -5.04], [side * .077, 2.78, -4.56]], 0x2f424b, .5);
    H.line(group, 'Tail forward access panel', [[side * .077, .45, -3.10], [side * .077, 1.14, -3.48], [side * .077, 1.14, -3.82], [side * .077, .45, -3.55]], 0x4d626b, .45);
  }

  for (const z of [4.55, 1.95, -.1, -1.7, -3.52]) ringSeam(H, group, stations, z, 'Fuselage panel joint', 0x344b55, .27);
  for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 28; i++) {
      const z = 3.50 - i * .23, p = profileAt(stations, z), a = side * .88;
      pts.push([Math.sin(a) * (p[1] + .01), p[3] + Math.cos(a) * (p[2] + .012), z]);
    }
    H.line(group, 'Longitudinal shoulder panel seam', pts, 0x405660, .30);
    H.decal(group, 'Dorsal service outline', { width: .38, height: .80, pos: [side * .58, .606, -.25], rot: [-Math.PI / 2, 0, 0], draw: (c, w, h) => { c.strokeStyle = '#af6871'; c.lineWidth = 12; c.strokeRect(90, 55, w - 180, h - 110); c.font = '60px Arial'; c.fillStyle = '#b58388'; c.textAlign = 'center'; c.fillText('NO STEP', w / 2, 130); } });
  }
  H.rod(group, 'Dorsal antenna', [0, .55, -2.25], [0, .85, -2.43], .024, black, .006);
  H.rod(group, 'Nose angle sensor', [.27, -.02, 5.10], [.39, -.03, 5.28], .014, silver, .006);
  H.rod(group, 'Nose angle sensor', [-.27, -.02, 5.10], [-.39, -.03, 5.28], .014, silver, .006);
  const gear = H.gear(group, {
    noseZ: 3.94, mainZ: -.63, track: 1.05, groundY: -1.80, wheelRadius: .225, mainRadius: .30,
    noseHinge: [0, -.10, 3.94], noseStow: [0, -.10, 2.47],
    mainHinge: [.74, -.22, -.63], mainStow: [.90, -.22, .65], mainFlat: false,
    noseBay: { min: [-.19, -10, 2.14], max: [.19, .10, 4.16] },
    mainBay: { min: [.58, -10, -.83], max: [1.26, .06, 1.05] },
    bayCeilingY: .24, noseBayCeilingY: .20,
    skinNames: [
      'Blended trainer fuselage', 'Dark dielectric radome', 'Blended twin engine fairing',
      'Intake outer fairing', 'Blended leading edge root extension', 'Yak swept main wing'
    ]
  });
  gear.setDown(1);
  return {
    group,
    info: { source: 'IMG_6738.jpeg / IMG_6739.jpeg', type: 'Tandem trainer', livery: 'Grey · red star · 92' },
    update(dt, state) {
      gear.setDown(state.gear ?? 1); cockpit.setOpen(state.canopy ?? 0);
      for (const exhaust of exhausts) if (exhaust.glow) exhaust.glow.material.emissiveIntensity = .10 + state.engine * 2.2;
    }
  };
}

// Rounded-square nacelles become circular around the F-15 exhausts. This retains
// the broad, angular shoulders visible in the reference instead of two cylinders.
function nacelleGeometry(THREE, stations) {
  const pos = [], uv = [], indices = [], count = 32;
  function ring(w, h, radius) {
    const out = [], corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    for (let c = 0; c < 4; c++) {
      const [sx, sy] = corners[c], centerX = sx * (w / 2 - radius), centerY = sy * (h / 2 - radius);
      for (let k = 0; k < 8; k++) {
        const a = c * Math.PI / 2 + k / 7 * Math.PI / 2;
        out.push([centerX + Math.cos(a) * radius, centerY + Math.sin(a) * radius]);
      }
    }
    return out;
  }
  // Rectangle corners in counterclockwise order with an arc from right to top.
  function goodRing(w, h, r) {
    const out = [];
    for (let k = 0; k < count; k++) {
      const a = TAU * k / count, ca = Math.cos(a), sa = Math.sin(a);
      out.push([(w / 2 - r) * Math.sign(ca) + r * ca, (h / 2 - r) * Math.sign(sa) + r * sa]);
    }
    return out;
  }
  for (let j = 0; j < stations.length; j++) {
    const [z, x, y, w, h, r] = stations[j];
    const rr = goodRing(w, h, r);
    for (let k = 0; k <= count; k++) {
      const p = rr[k % count]; pos.push(x + p[0], y + p[1], z); uv.push(k / count, j / (stations.length - 1));
    }
  }
  for (let j = 0; j < stations.length - 1; j++) for (let k = 0; k < count; k++) {
    const a = j * (count + 1) + k, b = a + count + 1;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geom = new THREE.BufferGeometry(); geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geom.setIndex(indices); geom.computeVertexNormals();
  return geom;
}

function angularIntake(THREE, H, parent, side, skin, inner) {
  const x = side * .95, y = -.17, width = .96, height = .88;
  const perimeter = [
    [-width / 2, height / 2, 2.00], [width / 2, height / 2, 2.00],
    [width / 2, -height / 2, 1.61], [-width / 2, -height / 2, 1.61]
  ];
  const innerPerimeter = perimeter.map(p => [p[0] * .87, p[1] * .86, p[2] - .065]);
  const pos = [], idx = [];
  for (let i = 0; i < 4; i++) { const a = perimeter[i], b = innerPerimeter[i]; pos.push(x + a[0], y + a[1], a[2], x + b[0], y + b[1], b[2]); }
  for (let i = 0; i < 4; i++) { const a = i * 2, b = ((i + 1) % 4) * 2; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const rim = skin.clone(); rim.side = THREE.DoubleSide; rim.name = 'Intake precision edge';
  H.mesh(parent, 'F-15 rectangular intake lip', g, rim);
  const tunnelPos = [], tunnelIdx = [];
  for (const p of innerPerimeter) tunnelPos.push(x + p[0], y + p[1], p[2]);
  for (const p of innerPerimeter) tunnelPos.push(x + p[0] * .77, y + p[1] * .80, .36);
  for (let i = 0; i < 4; i++) { const n = (i + 1) % 4; tunnelIdx.push(i, n, i + 4, n, n + 4, i + 4); }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tunnelPos, 3)); tg.setIndex(tunnelIdx); tg.computeVertexNormals();
  const duct = inner.clone(); duct.side = THREE.DoubleSide;
  H.mesh(parent, 'F-15 deeply recessed intake duct', tg, duct);
  H.box(parent, 'Intake shadow terminus', [.68, .59, .025], [x, y, .335], H.mat(0x050b0f, { roughness: 1, clearcoat: 0 }));
  // Variable inlet ramp and a slim exterior splitter plate.
  H.box(parent, 'Inlet internal compression ramp', [.78, .035, .62], [x, y + .20, 1.18], inner, [-.22, 0, 0]);
  H.box(parent, 'Intake splitter plate', [.035, .88, 1.03], [x - side * .51, -.13, 1.51], skin, [-.075, 0, 0]);
}

export function createF15(THREE, H) {
  const group = new THREE.Group(); group.name = 'F-15 Eagle · Alaska AK';
  const skin = H.mat(0x95a5ab, { roughness: .48, metalness: .30, clearcoat: .16 }); skin.name = 'F15 weathered blue grey';
  const light = H.mat(0xb1bfc2, { roughness: .49, metalness: .27, clearcoat: .15 });
  const upper = H.mat(0x718792, { roughness: .46, metalness: .33, clearcoat: .14 });
  const radome = H.mat(0x81949d, { roughness: .43, metalness: .25, clearcoat: .2 });
  const dark = H.mat(0x263741, { roughness: .69, metalness: .13, clearcoat: 0 });
  const inside = H.mat(0x40545f, { roughness: .7, metalness: .16, clearcoat: 0 });
  const silver = H.mat(0xaab4b7, { roughness: .26, metalness: .84, clearcoat: 0 });
  const stations = [
    [6.10, .006, .006, -.035], [5.77, .16, .16, -.02], [5.25, .31, .28, -.005],
    [4.62, .415, .355, .022], [3.97, .48, .405, .052], [3.31, .54, .44, .075],
    [2.55, .65, .47, .085], [1.69, .77, .47, .075], [.64, 1.19, .42, .085],
    [-.53, 1.39, .39, .11], [-1.68, 1.34, .36, .105], [-2.90, 1.18, .31, .10],
    [-4.12, .96, .25, .10], [-5.24, .50, .13, .10], [-5.66, .06, .04, .10]
  ];
  H.loft(group, 'Eagle central airframe', stations, skin);
  H.loft(group, 'F-15 pointed radome', stations.slice(0, 5), radome);
  ringSeam(H, group, stations, 3.98, 'F15 radome separation', 0x405865, .53);
  H.rod(group, 'Fine nose probe', [0, -.035, 6.02], [0, -.035, 6.22], .011, silver, .003);
  H.loft(group, 'Dorsal spine', [
    [2.11, .33, .12, .45], [1.60, .50, .17, .44], [.30, .56, .14, .40],
    [-1.65, .45, .12, .40], [-3.20, .27, .08, .36], [-4.5, .10, .04, .30]
  ], upper);
  const cockpit = H.cockpit(group, { z: 3.04, y: .44, length: 2.54, width: 1.045, height: .61, seats: 1,
    frame: 0x3c4b53, glass: 0xb9b7a5, pilot: true });
  const exhausts = [];
  const tails = [];
  for (const side of [-1, 1]) {
    H.mesh(group, 'Rectangular to round F15 engine nacelle', nacelleGeometry(THREE, [
      [1.75, side * .94, -.17, .99, .91, .055], [.75, side * .90, -.19, 1.08, .98, .13],
      [-.80, side * .84, -.20, 1.09, .98, .19], [-2.55, side * .79, -.19, 1.00, .91, .26],
      [-3.90, side * .78, -.16, .89, .83, .32], [-5.05, side * .78, -.13, .80, .80, .399]
    ]), skin);
    angularIntake(THREE, H, group, side, light, inside);
    H.wing(group, 'F15 broad swept trapezoidal main wing', [
      [side * 1.04, 1.77, -2.57, .21, .175], [side * 1.70, 1.23, -2.69, .23, .125],
      [side * 3.82, -.86, -2.75, .32, .067]
    ], upper);
    H.wing(group, 'F15 pale outer wing panel', [
      [side * 3.82, -.86, -2.75, .32, .067], [side * 4.17, -1.18, -2.76, .335, .055]
    ], light);
    H.wing(group, 'F15 broad movable stabilator', [
      [side * .60, -3.46, -5.54, -.035, .10], [side * 1.19, -3.48, -5.75, -.045, .085],
      [side * 2.92, -4.43, -6.00, -.15, .038]
    ], skin);
    // Thin leading edge and trailing control-surface panel breaks.
    wingSeams(H, group, side, [[1.56, .304, .67], [3.96, .37, -1.54]], 0x495f6c);
    wingSeams(H, group, side, [[1.58, .295, -2.08], [4.03, .365, -2.33], [4.03, .36, -2.70]], 0x4c626d);
    wingSeams(H, group, side, [[2.64, .33, -2.19], [2.64, .32, -2.71]], 0x415967);
    wingSeams(H, group, side, [[1.11, .022, -5.20], [2.79, -.115, -5.57]], 0x556a73);
    // Engine maintenance panels run along the upper shoulders.
    H.line(group, 'Engine shoulder access panels', [
      [side * .60, .59, .36], [side * 1.02, .56, .29], [side * 1.06, .53, -.62],
      [side * .57, .56, -.61], [side * .60, .59, .36]
    ], 0x3c5260, .45);
    H.line(group, 'Engine spine longitudinal seam', [[side * .74, .526, -.75], [side * .71, .48, -2.88], [side * .68, .39, -4.20]], 0x495f69, .4);
    H.line(group, 'Outer nacelle lower seam', [[side * 1.45, -.25, 1.38], [side * 1.38, -.30, -.70], [side * 1.18, -.33, -3.05], [side * 1.13, -.27, -4.37]], 0x526a76, .35);
    exhausts.push(H.exhaust(group, { x: side * .78, y: -.13, z: -5.03, r: .395, length: .69 }));
    H.ellipsoid(group, side < 0 ? 'Eagle red navigation lamp' : 'Eagle green navigation lamp', [side * 4.16, .36, -1.25], [.038, .027, .10],
      H.mat(side < 0 ? 0xa34549 : 0x4f937a, { emissive: side < 0 ? 0x601017 : 0x104b30, emissiveIntensity: .30, roughness: .2 }));

    const tailGroup = H.group(group, 'F15 separate vertical stabilizer');
    tailGroup.position.x = side * .94;
    const tail = H.fin(tailGroup, 'F15 swept vertical fin', [[.34, -2.95], [2.55, -4.08], [2.55, -4.78], [.31, -5.46]], .103, 0, skin);
    H.fin(tailGroup, 'Tail tip dielectric panel', [[2.37, -3.99], [2.55, -4.08], [2.55, -4.78], [2.37, -4.83]], .108, 0, light);
    H.fin(tailGroup, 'Tail base camouflage panel', [[.32, -3.17], [.80, -3.24], [1.10, -3.55], [.80, -4.02], [.32, -4.15]], .11, 0, upper);
    for (const face of [-1, 1]) {
      H.decal(tailGroup, 'AK Alaska tail code', { width: .88, height: .70, pos: [face * .078, 1.55, -4.39], rot: [0, face * Math.PI / 2, 0], draw: (c, w, h) => { c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold 440px Arial'; c.fillStyle = '#263842'; c.fillText('AK', w / 2, h / 2 + 5); } });
      H.decal(tailGroup, '3 WG tail title', { width: .79, height: .33, pos: [face * .078, .98, -4.56], rot: [0, face * Math.PI / 2, 0], draw: (c, w, h) => { c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold 340px Arial'; c.fillStyle = '#34444d'; c.fillText('3 WG', w / 2, h / 2); } });
      H.decal(tailGroup, 'Tail wing emblem', { width: .33, height: .34, pos: [face * .078, 2.13, -4.39], rot: [0, face * Math.PI / 2, 0], draw: (c, w, h) => {
        c.strokeStyle = '#81939c'; c.lineWidth = 24; c.beginPath(); c.arc(w / 2, h / 2, h * .43, 0, TAU); c.stroke();
        c.lineWidth = 13; c.beginPath(); c.moveTo(w * .31, h * .65); c.lineTo(w * .5, h * .22); c.lineTo(w * .68, h * .65); c.moveTo(w * .36, h * .52); c.lineTo(w * .65, h * .52); c.stroke();
      } });
      H.line(tailGroup, 'Rudder seam', [[face * .077, .38, -5.17], [face * .077, 2.43, -4.59]], 0x526772, .48);
      H.line(tailGroup, 'Tail lower panel seam', [[face * .077, .72, -3.38], [face * .077, .73, -5.23]], 0x58717e, .27);
    }
    tails.push(tailGroup);
    bodyMarking(THREE, H, group, 'Low visibility fuselage USAF insignia', stations, side, 2.53, -.035, .60, .27, lowVisRoundel);
    bodyMarking(THREE, H, group, 'Eagle forward access panel', stations, side, 4.23, -.125, .52, .28,
      (c, w, h) => { c.strokeStyle = '#455c67'; c.lineWidth = 10; c.beginPath(); c.moveTo(105, 85); c.lineTo(850, 85); c.lineTo(810, 435); c.lineTo(70, 435); c.closePath(); c.stroke(); });
    bodyMarking(THREE, H, group, 'Eagle rescue and service stencils', stations, side, 3.17, -.17, .65, .23,
      (c, w, h) => {
        c.fillStyle = '#b7a35f'; c.fillRect(650, 80, 300, 100); c.beginPath(); c.moveTo(615, 135); c.lineTo(680, 70); c.lineTo(680, 200); c.fill();
        c.fillStyle = '#52666e'; c.font = 'bold 76px Arial'; c.fillText('RESCUE', 665, 159);
        c.font = '48px Arial'; c.fillText('DANGER  INTAKE', 90, 350);
        c.fillStyle = '#8b5e58'; c.beginPath(); c.moveTo(170, 90); c.lineTo(120, 180); c.lineTo(220, 180); c.closePath(); c.fill();
      });
    H.decal(group, 'Intake maintenance stencil', { width: .48, height: .40, pos: [side * 1.46, -.03, .74], rot: [0, side * Math.PI / 2, 0], draw: (c, w, h) => {
      c.strokeStyle = '#5e7179'; c.lineWidth = 10; c.beginPath(); c.arc(w / 2, h / 2, h * .25, 0, TAU); c.stroke();
      c.font = '65px Arial'; c.fillStyle = '#4e626c'; c.textAlign = 'center'; c.fillText('NO STEP', w / 2, 450);
    } });
  }
  H.decal(group, 'F15 left wing USAF insignia', { width: 1.10, height: .58, pos: [-2.83, .370, -1.22], rot: [-Math.PI / 2, 0, 0], draw: lowVisRoundel });
  H.decal(group, 'F15 right wing USAF letters', { width: 1.25, height: .43, pos: [2.88, .369, -1.23], rot: [-Math.PI / 2, 0, Math.PI], draw: (c, w, h) => { c.fillStyle = '#4a606c'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold 280px Arial'; c.fillText('USAF', w / 2, h / 2); } });
  for (const z of [4.62, 2.0, .55, -1.58, -3.0]) ringSeam(H, group, stations, z, 'Eagle fuselage joint', 0x536b76, .27);

  // Closed speed brake and raised avionics vents match the aircraft in the photos.
  H.wing(group, 'Dorsal speed brake', [[-.38, .85, -.71, .575, .035], [.38, .85, -.71, .575, .035]], skin);
  H.line(group, 'Speed brake perimeter', [[-.38, .602, .85], [.38, .602, .85], [.38, .602, -.71], [-.38, .602, -.71], [-.38, .602, .85]], 0x354e5d, .5);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) H.box(group, 'Engine cooling louvre', [.22, .018, .037], [side * .62, .55, -1.17 - i * .085], dark);
    H.box(group, 'Navigation formation light strip', [.014, .045, .39], [side * .48, .105, 4.01], H.mat(0xc7c6a6, { roughness: .55, metalness: .1 }));
    H.ellipsoid(group, 'Rear tail warning sensor', [side * .95, .43, -5.43], [.055, .05, .135], dark);
  }
  H.fin(group, 'Dorsal blade antenna', [[.49, -1.18], [.91, -1.42], [.49, -1.64]], .035, 0, skin);
  H.fin(group, 'Under nose antenna', [[-.33, 4.22], [-.51, 4.08], [-.35, 3.85]], .025, 0, dark);
  const gear = H.gear(group, {
    noseZ: 3.48, mainZ: -.89, track: 1.04, groundY: -1.75, wheelRadius: .22, mainRadius: .31,
    noseHinge: [0, -.11, 3.48], noseStow: [0, -.11, 2.06],
    // Keep the forward-folding wheels behind the intake terminus at z = .335.
    mainHinge: [.84, -.20, -.89], mainStow: [1.04, -.20, 0], mainFlat: false,
    noseBay: { min: [-.19, -10, 1.74], max: [.19, .10, 3.70] },
    mainBay: { min: [.58, -10, -1.09], max: [1.27, .06, .41] },
    bayCeilingY: .24, noseBayCeilingY: .20,
    skinNames: ['Eagle central airframe', 'Rectangular to round F15 engine nacelle']
  });
  gear.setDown(1);
  return {
    group,
    info: { source: 'IMG_6732.jpeg / IMG_6734.jpeg', type: 'Twin-engine fighter', livery: 'Alaska AK · 3 WG' },
    update(dt, state) {
      gear.setDown(state.gear ?? 1); cockpit.setOpen(state.canopy ?? 0);
      for (const exhaust of exhausts) if (exhaust.glow) exhaust.glow.material.emissiveIntensity = .10 + state.engine * 2.3;
    }
  };
}
