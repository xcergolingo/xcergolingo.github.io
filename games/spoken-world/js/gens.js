/* 言出法随 · built-in procedural generators. Convention: metres, +Y up, front faces +Z, origin = ground centre.
   Builder parts are bottom-centred (box/cyl/cone/roof/pyramid) except sphere/torus (centred). */
'use strict';
(function () {
  const YX = window.YX, G = YX.GEN, mix = YX.mixHex;
  const WALLS = ['#efe3cf', '#e7d2bd', '#d9e2dc', '#f2d9c4', '#cfdbe6', '#e9e1d3', '#e3c9b1', '#dfe6cf', '#f0e6da'];
  const ROOFS = ['#b5533c', '#8a4b3a', '#566573', '#3f5a66', '#7a5c48', '#a8452f', '#4f6b57'];
  const DOORS = ['#2f5d62', '#8c3b2e', '#34495e', '#5b7a3c', '#c98a2b', '#6d3f5b'];
  const AWN = ['#c8553d', '#2f6f73', '#d9a441', '#4f6fa8', '#6b8f4e', '#a84a6a'];
  const CARS = ['#c0392b', '#2e6da4', '#f1c40f', '#ecf0f1', '#34495e', '#27ae60', '#e67e22', '#8e9aa6'];
  const SHIRTS = ['#d9534f', '#3d7ea6', '#e8b04a', '#5a9367', '#8e6bbf', '#f2f2f2', '#2d3e50', '#e58f65'];
  const PANTS = ['#2f3e55', '#4a4a4a', '#6b5b4b', '#27455f', '#3b3b46'];
  const SKINS = ['#f1c9a5', '#e0ac7e', '#c68a5c', '#8d5a3b', '#f6d7bd', '#a8714a'];
  const HAIRS = ['#2b2018', '#4a3323', '#111111', '#7a5230', '#c9a15a', '#8b8b8b'];
  const FLOWERS = ['#e85d75', '#f2c14e', '#f7f3e8', '#c084d6', '#ff8c5a', '#6fb7e8'];
  const GREENS = ['#5f9a4a', '#6faa52', '#4f8a44', '#7ab55c', '#55934a'];
  const TRIM = '#fbf7ef', GLASS = '#3b5269', LIT = '#ffd68a', IRON = '#2b2f33', WOOD = '#a8794f', STONE = '#b9b3a7';
  const pick = (arr, rand) => arr[Math.min(arr.length - 1, Math.floor(rand() * arr.length))];
  YX.PAL = { WALLS, ROOFS, DOORS, AWN, CARS, FLOWERS };

  /* ---------- shared facade pieces (drawn in a facade-local frame: wall plane z=0, facing +Z) ---------- */
  const CURTAINS = ['#f3ead7', '#e9d9c4', '#d8e3ea', '#e7c9b9', '#cfdccb', '#f1e3a8'], LITS = ['#ffd68a', '#ffc47a', '#fbe6bd'], DRAWN = { glow: '#ffcf8a', glowK: 0.4 }; // a few lamp colours only: each is one material for the whole town
  function win(b, x, y, ww, wh, lit, o) {
    o = o || {};
    const trim = o.trim || TRIM, k = Math.abs(Math.round((x * 7.3 + y * 3.1 + ww * 11) * 10)), cur = CURTAINS[k % CURTAINS.length]; // which curtain, which lamp: fixed by where the window is
    b.box(ww + 0.24, wh + 0.24, 0.08, trim, x, y - 0.12, 0);
    b.box(ww, wh, 0.14, GLASS, x, y, 0, lit ? { glow: LITS[k % LITS.length], rough: 0.3 } : { rough: 0.2, metal: 0.2, grad: -0.3 }); // an unlit pane is darker at the top, where it shows the room and not the sky
    if (!o.plain) { b.box(0.06, wh, 0.18, trim, x, y, 0); b.box(ww, 0.06, 0.18, trim, x, y + wh * 0.56, 0);
      if (ww > 0.8 && k % 3) { const cw = ww * (0.16 + (k % 5) * 0.025); for (const s of [-1, 1]) b.box(cw, wh - 0.04, 0.03, lit ? mix(cur, '#ffd9a0', 0.35) : mix(cur, '#5b6470', 0.35), x + s * (ww / 2 - cw / 2), y + 0.02, 0.075, lit ? DRAWN : null); } // curtains drawn back
      else if (ww > 0.8) b.box(ww - 0.04, wh * (0.25 + (k % 4) * 0.08), 0.03, lit ? mix(cur, '#ffd9a0', 0.3) : mix(cur, '#5b6470', 0.3), x, y + wh * (0.75 - (k % 4) * 0.08), 0.075, lit ? DRAWN : null); } // or a blind half down
    b.box(ww + 0.4, 0.08, 0.3, trim, x, y - 0.2, 0.06); b.box(ww + 0.3, 0.1, 0.16, trim, x, y + wh + 0.06, 0.02); // sill and lintel
    if (o.shutters) { b.box(0.38, wh + 0.12, 0.07, o.shutters, x - ww / 2 - 0.33, y - 0.06, 0.03); b.box(0.38, wh + 0.12, 0.07, o.shutters, x + ww / 2 + 0.33, y - 0.06, 0.03); for (const s of [-1, 1]) for (let q = 0; q < 5; q++) b.box(0.3, 0.03, 0.09, mix(o.shutters, '#000000', 0.22), x + s * (ww / 2 + 0.33), y + 0.1 + (q * (wh - 0.2)) / 4, 0.03); }
    if (o.flowers) { b.box(ww + 0.3, 0.24, 0.32, '#7a5a3c', x, y - 0.46, 0.2); for (let i = 0; i < 4; i++) b.foliage(0.17, mix('#4f8a45', '#7ab55c', (i * 0.37) % 1), x - ww / 2 + 0.12 + (i * (ww - 0.24)) / 3, y - 0.2, 0.22, { sy: 0.7 }); for (let i = 0; i < 6; i++) b.sphere(0.07, o.flowers[i % o.flowers.length], x - ww / 2 + 0.08 + (i * (ww - 0.16)) / 5, y - 0.1 + (i % 2) * 0.05, 0.3 + (i % 3) * 0.03, { seg: 6 }); }
  }
  function door(b, x, y, col, lit) {
    for (const s of [-1, 1]) b.box(0.15, 2.34, 0.1, TRIM, x + s * 0.595, y, 0); b.box(1.34, 0.2, 0.1, TRIM, x, y + 2.14, 0); // the frame stays; the leaf hangs on its left edge and swings into the house when someone comes to it
    b.group({ x: x - 0.52, y, anim: { hinge: { axis: 'y', deg: 96 } } }, () => {
      b.box(1.04, 2.14, 0.1, col, 0.52, 0, 0);
      b.box(0.72, 0.9, 0.14, mix(col, '#000000', 0.18), 0.52, 0.22, 0);
      b.box(0.72, 0.52, 0.14, GLASS, 0.52, 1.42, 0, lit ? { glow: LIT, rough: 0.3 } : { rough: 0.22 });
      for (const s of [-1, 1]) b.sphere(0.05, '#d9b45a', 0.9, 1.05, s * 0.09, { metal: 0.8, rough: 0.3 });
    });
  }
  function wheel(b, x, z, r, wd) {
    const s = x >= 0 ? 1 : -1;
    b.group({ x, y: r, z, anim: { roll: { radius: r } } }, () => {
      b.cyl(r, r, wd, '#1b1d20', (wd / 2), 0, 0, { rz: 90, sides: 16 });
      b.cyl(r * 0.52, r * 0.52, wd + 0.03, '#c9ccd1', (wd / 2) + 0.015, 0, 0, { rz: 90, sides: 10, metal: 0.6, rough: 0.4 });
      b.box(0.04, r * 0.9, r * 0.14, '#8a8f96', s * (wd / 2 + 0.02), -r * 0.45, 0);
    });
  }

  /* ================= buildings ================= */
  G.house = {
    label: '房子', cls: 'building', solid: 'box', face: 'road', mainColor: 'wall',
    nouns: ['房子', '屋子', '房屋', '住宅', '小屋', '民居', '别墅', '平房', '小房子', 'house', 'home', 'cottage'],
    params: { floors: { d: 2, min: 1, max: 8, int: 1 }, width: { d: 9, min: 5, max: 22 }, depth: { d: 8, min: 5, max: 18 }, roof: { d: 'gable', opts: ['gable', 'hip', 'flat'] }, wall: { d: '#efe3cf', color: 1, pick: WALLS }, roofColor: { d: '#b5533c', color: 1, pick: ROOFS }, door: { d: '#2f5d62', color: 1, pick: DOORS }, chimney: { d: true, bool: 1 } },
    dims: { height: 'floors', width: 'width', depth: 'depth' },
    foot: (p) => [p.width, p.depth],
    build(b, p, rand) {
      const w = p.width, d = p.depth, n = p.floors, FH = 2.9, base = 0.4, H = n * FH, top = base + H;
      b.box(w + 0.4, base, d + 0.4, '#9a958c', 0, 0, 0, { tex: 'stone' });
      for (let i = 1; i < n; i++) b.box(w + 0.14, 0.16, d + 0.14, TRIM, 0, base + i * FH - 0.08, 0);
      b.box(w + 0.26, 0.22, d + 0.26, TRIM, 0, top - 0.22, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.28, H, 0.28, mix(p.wall, '#ffffff', 0.35), sx * (w / 2 - 0.08), base, sz * (d / 2 - 0.08));
      const bays = Math.max(2, Math.round(w / 3)), sideBays = Math.max(1, Math.round(d / 3.6));
      const doorBay = bays % 2 ? (bays - 1) / 2 : bays / 2 - (rand() < 0.5 ? 0 : 1);
      const doorX = ((doorBay + 0.5) / bays) * w - w / 2;
      { // the walls are a shell with a real doorway in the front: when the door swings open there is a way in, and the room behind it shows
        const T = 0.3, wt = { tex: 'plaster' }, dw = 0.56, dh = 2.2, lw = doorX - dw + w / 2, rw = w / 2 - (doorX + dw);
        b.box(w, H, T, p.wall, 0, base, -d / 2 + T / 2, wt); for (const sd of [-1, 1]) b.box(T, H, d - 2 * T, p.wall, sd * (w / 2 - T / 2), base, 0, wt);
        b.box(lw, H, T, p.wall, -w / 2 + lw / 2, base, d / 2 - T / 2, wt); b.box(rw, H, T, p.wall, w / 2 - rw / 2, base, d / 2 - T / 2, wt); b.box(2 * dw, H - dh, T, p.wall, doorX, base + dh, d / 2 - T / 2, wt);
        b.box(w - 2 * T, 0.12, d - 2 * T, p.wall, 0, top - 0.12, 0, wt);
      }
      const facade = (ry, fw, x, z, nb, front) => b.group({ x, z, ry }, () => {
        for (let f = 0; f < n; f++) for (let i = 0; i < nb; i++) {
          const wx = ((i + 0.5) / nb) * fw - fw / 2, wy = base + f * FH + 1.0, lit = rand() < 0.55;
          if (front && f === 0 && i === doorBay) continue;
          win(b, wx, wy, 1.15, 1.4, lit, front ? { shutters: f > 0 || n === 1 ? p.door : null, flowers: f === 0 ? [pick(FLOWERS, rand), pick(FLOWERS, rand)] : null } : {});
        }
      });
      facade(0, w, 0, d / 2, bays, true); facade(180, w, 0, -d / 2, bays, false);
      facade(90, d, w / 2, 0, sideBays, false); facade(270, d, -w / 2, 0, sideBays, false);
      b.group({ x: 0, z: d / 2 }, () => {
        door(b, doorX, base, p.door, rand() < 0.6);
        b.box(2.0, 0.2, 0.9, STONE, doorX, 0, 0.45, { tex: 'stone' }); b.box(1.6, 0.2, 0.5, STONE, doorX, 0.2, 0.25, { tex: 'stone' });
        b.roof(2.5, 0.55, 1.5, p.roofColor, doorX, base + 2.5, 0.72, { tex: 'roof' });
        b.cyl(0.07, 0.07, 2.5, TRIM, doorX - 1.08, base, 1.32); b.cyl(0.07, 0.07, 2.5, TRIM, doorX + 1.08, base, 1.32);
        b.sphere(0.1, '#fff0c8', doorX + 0.92, base + 2.1, 0.16, { glow: '#ffd9a0' });
      });
      for (const sx of [-1, 1]) { b.foliage(0.62, pick(GREENS, rand), sx * (w / 2 - 0.5), 0.42, d / 2 + 0.55, { sy: 0.8, ry: rand() * 360 }); b.foliage(0.4, pick(GREENS, rand), sx * (w / 2 - 1.25), 0.3, d / 2 + 0.6, { sy: 0.8, ry: rand() * 360 }); }
      let peak = top;
      if (p.roof === 'gable') {
        const rh = Math.min(w, d) * 0.4, ov = 0.55, th = Math.atan2(rh, d / 2), S = (d / 2 + ov) / Math.cos(th), deg = (th * 180) / Math.PI;
        b.roof(w, rh, d, p.wall, 0, top, 0, { tex: 'plaster' });
        b.group({ y: top + rh, rx: deg }, () => b.box(w + 1.1, 0.18, S, p.roofColor, 0, -0.02, S / 2, { tex: 'roof' }));
        b.group({ y: top + rh, rx: -deg }, () => b.box(w + 1.1, 0.18, S, p.roofColor, 0, -0.02, -S / 2, { tex: 'roof' }));
        b.box(w + 1.2, 0.2, 0.46, mix(p.roofColor, '#000000', 0.25), 0, top + rh + 0.02, 0);
        for (const sx of [-1, 1]) { b.cyl(0.42, 0.42, 0.12, GLASS, sx * (w / 2 + 0.02), top + rh * 0.38, 0, { rz: 90, sides: 14, rough: 0.2 }); b.torus(0.46, 0.06, TRIM, sx * (w / 2 + 0.04), top + rh * 0.38, 0, { ry: 90 }); }
        if (p.chimney) { const cx = w * 0.26, cz = -d * 0.2, cy = top + rh * (1 - Math.abs(cz) / (d / 2)) - 0.4; b.box(0.85, 1.9, 0.85, '#9c5a45', cx, cy, cz, { tex: 'brick' }); b.box(1.05, 0.16, 1.05, '#6f6a63', cx, cy + 1.9, cz); b.cyl(0.2, 0.24, 0.3, '#3a3a3a', cx, cy + 2.06, cz); }
        peak = top + rh + 0.22;
      } else if (p.roof === 'hip') {
        const rh = Math.min(w, d) * 0.42;
        b.pyramid(w + 1.1, rh, d + 1.1, p.roofColor, 0, top, 0);
        b.box(w + 1.2, 0.12, d + 1.2, mix(p.roofColor, '#000000', 0.2), 0, top - 0.02, 0);
        b.sphere(0.16, '#d9b45a', 0, top + rh + 0.1, 0, { metal: 0.7, rough: 0.3 });
        peak = top + rh + 0.2;
      } else {
        for (const s of [-1, 1]) { b.box(w + 0.2, 0.6, 0.22, mix(p.wall, '#ffffff', 0.25), 0, top, s * (d / 2)); b.box(0.22, 0.6, d + 0.2, mix(p.wall, '#ffffff', 0.25), s * (w / 2), top, 0); }
        b.box(w - 0.3, 0.06, d - 0.3, '#8f8a80', 0, top, 0);
        b.box(1.3, 0.8, 0.9, '#c9cdd2', -w * 0.22, top, -d * 0.15, { metal: 0.3, rough: 0.6 }); b.cyl(0.5, 0.5, 1.2, '#7a8b99', w * 0.2, top + 0.4, d * 0.12, { metal: 0.3, rough: 0.5 });
        for (let i = 0; i < 3; i++) b.cyl(0.04, 0.04, 0.4, IRON, w * 0.2 + Math.cos(i * 2.1) * 0.4, top, d * 0.12 + Math.sin(i * 2.1) * 0.4);
        peak = top + 0.6;
      }
      b.anchor('roof', 0, peak, 0); b.anchor('door', doorX, 0, d / 2 + 1.6);
    },
  };

  function storefront(b, p, rand, o) {
    const w = p.width, d = p.depth, n = p.floors, H1 = 3.7, FH = 2.9, H = H1 + (n - 1) * FH, wood = '#3a2e27';
    b.box(w + 0.3, 0.3, d + 0.3, '#8f8a82', 0, 0, 0, { tex: 'stone' });
    const wt = { tex: o.wallTex || 'plaster' }, T = 0.27, GL = { opacity: 0.2, rough: 0.05, metal: 0.1 };
    if (n > 1) b.box(w, H - H1, d, p.wall, 0, 0.3 + H1, 0, wt); // the floors above are solid
    b.box(w, H1, T, p.wall, 0, 0.3, -d / 2 + T / 2, wt); for (const s of [-1, 1]) b.box(T, H1, d - T, p.wall, s * (w / 2 - T / 2), 0.3, T / 2, wt); // the ground floor is three walls round the shop
    b.box(w, H1 - 2.75, T, p.wall, 0, 3.05, d / 2 - T / 2, wt); for (const s of [-1, 1]) { b.box(0.5, 2.75, T, p.wall, s * (w / 2 - 0.25), 0.3, d / 2 - T / 2, wt); b.box(w / 2 - 0.65, 0.55, T, p.wall, s * (w / 4 + 0.325), 0.3, d / 2 - T / 2, wt); }
    b.box(w - 0.5, 0.07, d - 0.5, '#f4f0e8', 0, 0.3 + H1 - 0.14, 0, { noShadow: true }); b.box(w - 0.5, 0.012, d - 0.5, '#b9a07c', 0, 0.295, 0, { noShadow: true }); // just proud of the plinth, well under the room's own floor
    b.group({ z: d / 2 }, () => {
      for (const s of [-1, 1]) b.box(w / 2 - 0.85, 0.55, 0.16, wood, s * (w / 4 + 0.225), 0.3, 0);
      const panes = Math.max(2, Math.round((w - 2.4) / 2.2)), pw = (w - 2.6) / panes;
      for (let i = 0; i < panes; i++) {
        const x = -w / 2 + 0.5 + pw / 2 + i * pw + (i >= panes / 2 ? 1.6 : 0);
        b.box(pw - 0.16, 2.1, 0.05, '#bfd6e6', x, 0.85, 0, GL); // glass you can see the shop through
        b.box(pw, 0.1, 0.2, wood, x, 2.95, 0); b.box(0.1, 2.2, 0.2, wood, x - pw / 2, 0.85, 0); b.box(0.1, 2.2, 0.2, wood, x + pw / 2, 0.85, 0);
      }
      for (const s of [-1, 1]) b.box(0.12, 2.75, 0.2, wood, s * 0.71, 0.3, 0); b.box(1.54, 0.12, 0.2, wood, 0, 2.5, 0); b.box(1.54, 0.1, 0.2, wood, 0, 2.95, 0); // a glazed door in a timber frame, a light above it
      b.box(1.3, 0.33, 0.05, '#bfd6e6', 0, 2.62, 0, GL);
      b.group({ x: -0.65, anim: { hinge: { axis: 'y', deg: 96 } } }, () => { // the glazed leaf swings into the shop when someone comes to it
        b.box(1.24, 2.1, 0.05, '#bfd6e6', 0.65, 0.38, 0, GL); b.box(1.3, 0.08, 0.1, wood, 0.65, 0.32, 0);
        for (const s of [-1, 1]) b.box(0.05, 2.14, 0.09, wood, 0.65 + s * 0.63, 0.36, 0); b.box(0.9, 0.05, 0.06, '#d9b45a', 0.65, 1.34, 0.07, { metal: 0.8, rough: 0.3 }); b.box(0.9, 0.05, 0.06, '#d9b45a', 0.65, 1.34, -0.07, { metal: 0.8, rough: 0.3 });
      });
      b.box(1.7, 0.16, 0.7, STONE, 0, 0.14, 0.35, { tex: 'stone' });
      b.box(w - 0.3, 0.72, 0.16, '#2d2a26', 0, H1 - 0.62, 0);
      b.text(p.name, Math.min(0.5, (w - 1.6) / (Math.max(1, String(p.name).length) * 0.62)), '#f6e7c8', 0, H1 - 0.26, 0.1, { glow: 1 }); // long names shrink to fit the board
      b.group({ y: 3.05, z: 0.05, rx: 20 }, () => { b.box(w * 0.92, 0.07, 1.7, p.awning, 0, 0, 0.85, { tex: 'stripes' }); });
      const vy = 3.05 - Math.sin(0.349) * 1.7 - 0.2, vz = 0.05 + Math.cos(0.349) * 1.7;
      const sc = Math.round((w * 0.92) / 0.5);
      for (let i = 0; i < sc; i++) b.box((w * 0.92) / sc - 0.02, 0.26, 0.04, i % 2 ? '#f5efe2' : p.awning, -w * 0.46 + ((i + 0.5) * w * 0.92) / sc, vy, vz);
      for (const s of [-1, 1]) { b.box(0.55, 0.5, 0.55, '#6b4f3a', s * 1.15, 0.3, 0.45, { tex: 'wood' }); b.foliage(0.38, pick(GREENS, rand), s * 1.15, 1.02, 0.45, { sy: 0.9, ry: rand() * 360 }); b.sphere(0.09, pick(FLOWERS, rand), s * 1.15 + 0.14, 1.28, 0.6, { flat: true, seg: 6 }); }
      b.group({ x: w / 2 - 0.5, y: 3.6, z: 0.08 }, () => { b.box(0.06, 0.06, 0.8, IRON, 0, 0.5, 0.4); b.box(0.06, 0.62, 0.62, o.blade || p.awning, 0, -0.2, 0.55); });
    });
    for (let f = 1; f < n; f++) {
      const y = 0.3 + H1 + (f - 1) * FH + 0.9, nb = Math.max(2, Math.round(w / 2.8)), sb = Math.max(1, Math.round(d / 3.4));
      b.box(w + 0.14, 0.14, d + 0.14, TRIM, 0, y - 1.0, 0);
      const row = (ry, fw, x, z, k) => b.group({ x, z, ry }, () => { for (let i = 0; i < k; i++) win(b, ((i + 0.5) / k) * fw - fw / 2, y, 1.1, 1.4, rand() < 0.5); });
      row(0, w, 0, d / 2, nb); row(180, w, 0, -d / 2, nb); row(90, d, w / 2, 0, sb); row(270, d, -w / 2, 0, sb);
    }
    const top = 0.3 + H;
    b.box(w + 0.3, 0.26, d + 0.3, TRIM, 0, top - 0.1, 0);
    for (const s of [-1, 1]) { b.box(w + 0.1, 0.5, 0.2, mix(p.wall, '#ffffff', 0.2), 0, top + 0.16, s * (d / 2)); b.box(0.2, 0.5, d + 0.1, mix(p.wall, '#ffffff', 0.2), s * (w / 2), top + 0.16, 0); }
    b.box(w - 0.3, 0.06, d - 0.3, '#8f8a80', 0, top + 0.16, 0);
    b.box(1.1, 0.7, 0.8, '#c9cdd2', -w * 0.25, top + 0.2, -d * 0.2, { metal: 0.3, rough: 0.6 });
    b.anchor('roof', 0, top + 0.68, 0); b.anchor('door', 0, 0, d / 2 + 1.4);
    return top;
  }
  G.cafe = {
    label: '咖啡馆', cls: 'building', solid: 'box', face: 'road', mainColor: 'wall',
    nouns: ['咖啡馆', '咖啡店', '咖啡厅', '咖啡屋', 'cafe', 'café', 'coffee shop', 'coffeeshop'],
    params: { width: { d: 11, min: 7, max: 22 }, depth: { d: 8, min: 6, max: 16 }, floors: { d: 1, min: 1, max: 4, int: 1 }, wall: { d: '#f3e7d3', color: 1 }, awning: { d: '#c8553d', color: 1, pick: AWN }, name: { d: 'CAFÉ', text: 1 }, tables: { d: 3, min: 0, max: 8, int: 1 } },
    dims: { height: 'floors', width: 'width', depth: 'depth' },
    foot: (p) => [p.width, p.depth],
    build(b, p, rand) {
      const w = p.width, d = p.depth, top = storefront(b, p, rand, {});
      // rooftop cup
      b.group({ x: w * 0.26, y: top + 0.2, z: d * 0.12 }, () => {
        b.cyl(0.95, 0.95, 0.08, '#f4efe6', 0, 0, 0); b.lathe([[0.42, 0.08], [0.62, 0.5], [0.7, 1.0], [0.72, 1.05]], '#f4efe6', 0, 0, 0);
        b.cyl(0.66, 0.66, 0.04, '#4a2e1f', 0, 0.98, 0); b.torus(0.26, 0.07, '#f4efe6', 0.86, 0.6, 0);
        for (let i = 0; i < 3; i++) b.group({ x: -0.25 + i * 0.25, y: 1.5 + i * 0.22, anim: { bob: { amp: 0.14, freq: 0.5, phase: i * 1.7 } } }, () => b.sphere(0.2 - i * 0.03, '#ffffff', 0, 0, 0, { opacity: 0.6, seg: 8 }));
      });
      // terrace
      const n = p.tables, z0 = d / 2 + 2.2;
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? 0 : -w / 2 + 1.4 + (i * (w - 2.8)) / (n - 1);
        b.cyl(0.46, 0.46, 0.05, '#e9e2d4', x, 0.72, z0); b.cyl(0.04, 0.04, 0.72, IRON, x, 0, z0); b.cyl(0.26, 0.28, 0.04, IRON, x, 0, z0);
        for (const s of [-1, 1]) { const cx = x + s * 0.72; b.box(0.4, 0.05, 0.4, WOOD, cx, 0.44, z0, { tex: 'wood' }); b.box(0.05, 0.46, 0.4, WOOD, cx + s * 0.19, 0.46, z0); for (const a of [-1, 1]) for (const c of [-1, 1]) b.cyl(0.025, 0.025, 0.44, IRON, cx + a * 0.16, 0, z0 + c * 0.16); }
        b.cyl(0.07, 0.05, 0.1, '#f4efe6', x + 0.12, 0.77, z0 + 0.08);
        if (i % 2 === 0) { b.cyl(0.03, 0.03, 2.4, '#d8d2c6', x, 0, z0 + 0.02); b.cone(1.25, 0.5, p.awning, x, 2.2, z0, { sides: 8, flat: true }); }
      }
      // string lights
      if (n > 0) for (const s of [-1, 1]) { const px = s * (w / 2 - 0.3), pz = d / 2 + 3.5; b.cyl(0.04, 0.05, 2.9, IRON, px, 0, pz); for (let k = 0; k <= 8; k++) { const t = k / 8; b.sphere(0.07, '#fff1c9', px, 3.3 - Math.sin(t * Math.PI) * 0.35 - t * 0.45, d / 2 + 0.2 + t * 3.3, { glow: '#ffd27a', seg: 6 }); } }
      if (n > 1) for (let k = 0; k <= 12; k++) { const t = k / 12; b.sphere(0.07, '#fff1c9', -w / 2 + 0.3 + t * (w - 0.6), 2.85 - Math.sin(t * Math.PI) * 0.4, d / 2 + 3.5, { glow: '#ffd27a', seg: 6 }); }
      // chalkboard
      b.group({ x: -w / 2 + 0.9, z: d / 2 + 1.1 }, () => { b.box(0.62, 0.95, 0.05, '#2b2b2b', 0, 0, 0.14, { rx: -14 }); b.box(0.62, 0.95, 0.05, '#2b2b2b', 0, 0, -0.14, { rx: 14 }); b.text('COFFEE', 0.16, '#f4efe6', 0, 0.62, 0.3, { rx: -14 }); });
    },
  };
  G.shop = {
    label: '商店', cls: 'building', solid: 'box', face: 'road', mainColor: 'wall',
    nouns: ['商店', '店铺', '小店', '店', '便利店', '超市', '杂货店', 'shop', 'store'],
    params: { width: { d: 8.5, min: 6, max: 20 }, depth: { d: 8, min: 6, max: 16 }, floors: { d: 2, min: 1, max: 5, int: 1 }, wall: { d: '#e7d2bd', color: 1, pick: WALLS }, awning: { d: '#2f6f73', color: 1, pick: AWN }, name: { d: 'SHOP', text: 1, pick: ['BAKERY', 'BOOKS', 'FLOWERS', 'MARKET', 'TEA', 'RECORDS'] } },
    dims: { height: 'floors', width: 'width', depth: 'depth' },
    foot: (p) => [p.width, p.depth],
    build(b, p, rand) { storefront(b, p, rand, { wallTex: rand() < 0.4 ? 'brick' : 'plaster' }); },
  };
  G.tower = {
    label: '高楼', cls: 'building', solid: 'box', face: 'road', mainColor: 'color',
    nouns: ['高楼', '大楼', '楼房', '公寓', '公寓楼', '写字楼', '办公楼', '摩天楼', '摩天大楼', '大厦', '楼', 'tower', 'skyscraper', 'apartment', 'building'],
    params: { floors: { d: 6, min: 2, max: 60, int: 1 }, width: { d: 12, min: 6, max: 40 }, depth: { d: 12, min: 6, max: 40 }, style: { d: 'brick', opts: ['brick', 'glass', 'concrete'] }, color: { d: '#b9765a', color: 1, pick: ['#b9765a', '#c9c2b6', '#8fa3b5', '#a8897a', '#d8cbb8'] } },
    dims: { height: 'floors', width: 'width', depth: 'depth' },
    foot: (p) => [p.width, p.depth],
    build(b, p, rand) {
      const w = p.width, d = p.depth, n = p.floors, FH = 3.1, L = 4.2, H = L + (n - 1) * FH, glassy = p.style === 'glass';
      const body = glassy ? '#34506b' : p.color;
      b.box(w + 0.4, 0.3, d + 0.4, '#8c8880', 0, 0, 0);
      b.box(w, H, d, body, 0, 0.3, 0, glassy ? { rough: 0.2, metal: 0.3 } : { tex: p.style === 'brick' ? 'brick' : 'plaster' });
      const side = (ry, fw, x, z, front) => b.group({ x, z, ry }, () => {
        const nb = Math.max(2, Math.round(fw / (glassy ? 2.0 : 2.7)));
        if (front) {
          b.box(fw * 0.5, 3.0, 0.14, '#2c3138', 0, 0.3, 0); b.box(fw * 0.5 - 0.3, 2.7, 0.18, '#50667a', 0, 0.36, 0, { glow: '#ffe0a8', rough: 0.2, glowK: 0.8 });
          b.box(0.08, 2.7, 0.22, '#2c3138', 0, 0.36, 0); b.box(fw * 0.6, 0.18, 1.6, '#3a3f47', 0, 3.4, 0.8); b.box(fw * 0.4, 0.14, 0.9, STONE, 0, 0.16, 0.45);
        }
        for (let f = 1; f < n; f++) {
          const y = 0.3 + L + (f - 1) * FH;
          if (glassy) {
            b.box(fw + 0.04, 0.34, 0.1, '#c9d3dc', 0, y - 0.17, 0, { metal: 0.4, rough: 0.4 });
            for (let i = 0; i < nb; i++) if (rand() < 0.3) b.box(fw / nb - 0.1, FH - 0.5, 0.08, '#4a6a88', ((i + 0.5) / nb) * fw - fw / 2, y + 0.25, 0, { glow: '#ffe4b0', rough: 0.2, glowK: 0.7 });
          } else {
            for (let i = 0; i < nb; i++) { const x0 = ((i + 0.5) / nb) * fw - fw / 2, lit = rand() < 0.45; b.box(1.5, 1.7, 0.1, TRIM, x0, y + 0.72, 0); b.box(1.3, 1.5, 0.14, GLASS, x0, y + 0.82, 0, lit ? { glow: LIT, rough: 0.3 } : { rough: 0.22 }); b.box(0.06, 1.5, 0.16, TRIM, x0, y + 0.82, 0); if (front && p.style === 'brick' && i % 2 === 0) { b.box(1.9, 0.1, 0.9, '#d9d4c8', x0, y + 0.6, 0.45); b.box(1.9, 0.6, 0.05, IRON, x0, y + 0.7, 0.88); } }
            b.box(fw + 0.1, 0.12, 0.08, mix(body, '#ffffff', 0.3), 0, y - 0.06, 0);
          }
        }
        if (glassy) for (let i = 0; i <= nb; i++) b.box(0.08, H - L, 0.12, '#c9d3dc', (i / nb) * fw - fw / 2, 0.3 + L, 0, { metal: 0.4, rough: 0.4 });
      });
      side(0, w, 0, d / 2, true); side(180, w, 0, -d / 2, false); side(90, d, w / 2, 0, false); side(270, d, -w / 2, 0, false);
      const top = 0.3 + H;
      b.box(w + 0.3, 0.3, d + 0.3, glassy ? '#c9d3dc' : mix(body, '#ffffff', 0.35), 0, top - 0.1, 0);
      for (const s of [-1, 1]) { b.box(w, 0.7, 0.2, mix(body, '#ffffff', 0.2), 0, top + 0.2, s * (d / 2 - 0.1)); b.box(0.2, 0.7, d, mix(body, '#ffffff', 0.2), s * (w / 2 - 0.1), top + 0.2, 0); }
      b.box(w * 0.3, 1.6, d * 0.3, '#8f959c', -w * 0.18, top + 0.2, -d * 0.12); b.cyl(0.9, 0.9, 1.5, '#7a5a44', w * 0.22, top + 0.9, d * 0.15, { tex: 'wood' }); b.cone(1.0, 0.5, '#5a4636', w * 0.22, top + 2.4, d * 0.15, { sides: 12 });
      for (let i = 0; i < 4; i++) b.cyl(0.05, 0.05, 0.9, IRON, w * 0.22 + Math.cos(i * 1.57) * 0.7, top + 0.2, d * 0.15 + Math.sin(i * 1.57) * 0.7);
      b.cyl(0.04, 0.06, 3.2, IRON, -w * 0.18, top + 1.8, -d * 0.12); b.sphere(0.12, '#ff5a4a', -w * 0.18, top + 5.05, -d * 0.12, { emissive: '#ff2a1a' });
      b.anchor('roof', 0, top + 0.95, d * 0.25); b.anchor('door', 0, 0, d / 2 + 2);
    },
  };

  /* ================= nature ================= */
  G.tree = {
    label: '树', cls: 'nature', solid: 'trunk', face: 'random',
    nouns: ['树', '大树', '小树', '树木', '橡树', 'tree'],
    params: { kind: { d: 'oak', opts: ['oak', 'pine', 'birch', 'sakura', 'palm', 'autumn', 'willow'] }, height: { d: 6.5, min: 1.2, max: 45 }, color: { d: '', color: 1, opt: 1 } },
    dims: { height: 'height', size: 'height', width: 'height' },
    foot: (p) => [p.height * 0.5, p.height * 0.5],
    build(b, p, rand) {
      const H = p.height, k = p.kind;
      let cols = k === 'autumn' ? ['#d9822b', '#c8552b', '#e0a63a', '#b5452a'] : k === 'sakura' ? ['#f7c6d9', '#f2a9c4', '#fbdbe7', '#ee9bb8'] : k === 'birch' ? ['#9bc46a', '#b3d67e', '#8ab85c'] : k === 'pine' ? ['#2f6b4a', '#377853', '#2a5f45'] : k === 'willow' ? ['#8fb86a', '#7dab5e', '#9cc474'] : k === 'palm' ? ['#4f9a4a', '#5fae52'] : GREENS;
      if (p.color) cols = [p.color, mix(p.color, '#ffffff', 0.18), mix(p.color, '#000000', 0.16), mix(p.color, '#ffffff', 0.08)];
      const sway = (y, fn, deg) => b.group(p._static ? { y } : { y, anim: { swing: { axis: 'z', deg: deg || 1.5, freq: 0.16 + rand() * 0.1, phase: rand() * 6.28 } } }, fn);
      if (k === 'pine') {
        b.cyl(H * 0.022 + 0.05, H * 0.04 + 0.08, H * 0.3, '#5d4031', 0, 0, 0, { sides: 8, grad: 0.3 });
        // boughs in tiers, each darker where the one above shades it and lighter at its skirt
        sway(H * 0.15, () => { const nt = p._static ? 5 : 7; for (let i = 0; i < nt; i++) { const u = i / nt; b.cone(H * 0.27 * (1 - u * 0.88) * (0.94 + rand() * 0.12), H * (0.3 - u * 0.1), mix(cols[i % cols.length], '#b9d98a', u * 0.14), (rand() - 0.5) * H * 0.012, u * H * 0.74, (rand() - 0.5) * H * 0.012, { sides: 10, grad: -0.42, ry: rand() * 36 }); } }, 0.9);
        b.anchor('top', 0, H * 0.99, 0);
      } else if (k === 'palm') {
        const tx = H * 0.1;
        b.tube([[0, 0, 0], [tx * 0.7, H * 0.35, 0], [tx * 1.1, H * 0.7, 0], [tx, H * 0.93, 0]], H * 0.018 + 0.07, '#8a6f4d', { sides: 7 });
        b.group({ x: tx, y: H * 0.93, anim: { swing: { axis: 'x', deg: 2, freq: 0.2, phase: rand() * 6 } } }, () => {
          for (let i = 0; i < 8; i++) b.group({ ry: i * 45 + rand() * 14 }, () => { b.box(H * 0.07, 0.05, H * 0.2, cols[i % 2], 0, 0, H * 0.1, { rx: 18 }); b.group({ y: -Math.sin(0.31) * H * 0.2, z: Math.cos(0.31) * H * 0.2 }, () => b.box(H * 0.05, 0.04, H * 0.17, cols[(i + 1) % 2], 0, 0, H * 0.085, { rx: 48 })); });
          for (let i = 0; i < 3; i++) b.sphere(H * 0.022 + 0.05, '#5a4030', Math.cos(i * 2.1) * 0.16, -0.14, Math.sin(i * 2.1) * 0.16, { seg: 7 });
        });
        b.anchor('top', tx, H * 0.96, 0);
      } else {
        const birch = k === 'birch', willow = k === 'willow', tH = H * (birch ? 0.5 : 0.42), tr = birch ? H * 0.018 + 0.04 : H * 0.03 + 0.06, bark = birch ? '#e9e6df' : k === 'sakura' ? '#4a3a35' : '#6b4a33';
        b.cyl(tr * 0.72, tr * 1.25, tH, bark, 0, 0, 0, { sides: 9, rx: (rand() - 0.5) * 4, grad: birch ? 0.1 : 0.3 }); b.cyl(tr * 1.2, tr * 1.75, tH * 0.09, bark, 0, 0, 0, { sides: 9, grad: 0.3 }); // the trunk, flaring into the ground
        if (birch) for (let i = 0; i < 5; i++) b.box(tr * 1.2, 0.05, 0.03, '#2b2b2b', (rand() - 0.5) * tr * 0.5, tH * (0.2 + i * 0.15), tr * 0.85);
        for (let i = 0; i < 3; i++) { const a = i * 2.1 + rand(); b.cyl(tr * 0.3, tr * 0.5, H * 0.24, bark, 0, tH * 0.82, 0, { rz: 38 * Math.cos(a), rx: 38 * Math.sin(a), sides: 6 }); }
        const cr = H * (birch ? 0.2 : 0.27), cy = H * (birch ? 0.74 : 0.69), tone = (i) => mix(cols[i % cols.length], rand() < 0.5 ? '#ffffff' : '#12301c', rand() * 0.09);
        sway(cy, () => { // the crown: one mass in the middle, others leaning out of it all round, one on top
          const ring = p._static ? 3 : birch ? 4 : 5, sy = willow ? 1.25 : birch ? 1.1 : 0.88;
          b.foliage(cr * 0.8, tone(0), 0, cr * 0.12, 0, { sy, ry: rand() * 360 });
          for (let i = 0; i < ring; i++) { const a = (i / ring) * 6.283 + rand() * 0.7, rr = cr * (0.5 + rand() * 0.2), dr = cr * (0.5 + rand() * 0.16); b.foliage(rr, tone(i + 1), Math.cos(a) * dr, (rand() - 0.6) * cr * 0.5, Math.sin(a) * dr, { sy, ry: rand() * 360 }); }
          b.foliage(cr * 0.56, tone(ring + 1), (rand() - 0.5) * cr * 0.3, cr * 0.62, (rand() - 0.5) * cr * 0.3, { sy, ry: rand() * 360 });
          if (willow) for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.283 + rand() * 0.3; b.foliage(cr * 0.34, tone(i), Math.cos(a) * cr * 0.82, -cr * 0.72, Math.sin(a) * cr * 0.82, { sy: 2.5, sx: 0.62, sz: 0.62, ry: rand() * 360 }); } // the hanging curtains of a willow
        });
        if (k === 'sakura') for (let i = 0; i < 12; i++) b.box(0.14, 0.01, 0.1, cols[i % 4], (rand() - 0.5) * cr * 3, 0.01, (rand() - 0.5) * cr * 3, { ry: rand() * 180 });
        b.anchor('top', 0, cy + cr * 0.95, 0);
      }
    },
  };
  G.bush = {
    label: '灌木', cls: 'nature', solid: false, face: 'random', nouns: ['灌木', '灌木丛', '草丛', '矮树丛', '树丛', 'bush', 'shrub'],
    params: { size: { d: 1.2, min: 0.4, max: 6 }, color: { d: '#5f9a4a', color: 1, pick: GREENS } }, dims: { size: 'size', height: 'size', width: 'size' },
    build(b, p, rand) { const s = p.size; for (let i = 0; i < 4; i++) { const a = i * 2.1 + rand(); b.foliage(s * (i ? 0.34 + rand() * 0.14 : 0.5), mix(p.color, i % 2 ? '#ffffff' : '#12301c', 0.04 + rand() * 0.08), Math.cos(a) * s * 0.3 * (i ? 1 : 0), s * (i ? 0.26 + rand() * 0.12 : 0.36), Math.sin(a) * s * 0.3 * (i ? 1 : 0), { sy: 0.82, ry: rand() * 360 }); } },
  };
  G.flowers = {
    label: '花丛', cls: 'nature', solid: false, face: 'random', flat: true, nouns: ['花', '花丛', '花坛', '鲜花', '花朵', '花圃', '小花', 'flowers', 'flower bed', 'flower'],
    params: { size: { d: 1.8, min: 0.5, max: 12 }, color: { d: '', color: 1, opt: 1 } }, dims: { size: 'size', width: 'size' },
    build(b, p, rand) {
      const r = p.size; b.cyl(r, r * 1.04, 0.1, '#6a4e38', 0, 0, 0, { sides: 14 });
      const n = Math.min(160, Math.round(r * r * 14));
      for (let i = 0; i < n; i++) { const a = rand() * 6.283, d = Math.sqrt(rand()) * r * 0.92, h = 0.22 + rand() * 0.28, x = Math.cos(a) * d, z = Math.sin(a) * d; b.cyl(0.012, 0.016, h, '#4f8a44', x, 0.1, z, { sides: 4 }); b.sphere(0.07 + rand() * 0.04, p.color ? mix(p.color, '#ffffff', rand() * 0.3) : pick(FLOWERS, rand), x, 0.1 + h, z, { seg: 6, flat: true }); if (i % 3 === 0) b.sphere(0.12, pick(GREENS, rand), x + 0.08, 0.16, z, { seg: 5, flat: true, sy: 0.5 }); }
    },
  };
  G.rock = {
    label: '石头', cls: 'nature', solid: 'box', face: 'random', nouns: ['石头', '岩石', '大石头', '巨石', '石块', 'rock', 'stone', 'boulder'],
    params: { size: { d: 1, min: 0.2, max: 12 }, color: { d: '#8f8b84', color: 1 } }, dims: { size: 'size', height: 'size', width: 'size' },
    build(b, p, rand) { const s = p.size; b.sphere(s * 0.6, p.color, 0, s * 0.3, 0, { flat: true, seg: 6, sy: 0.7, sx: 1.2, ry: rand() * 90 }); b.sphere(s * 0.36, mix(p.color, '#000000', 0.12), s * 0.45, s * 0.18, s * 0.2, { flat: true, seg: 5, sy: 0.75 }); b.sphere(s * 0.22, mix(p.color, '#ffffff', 0.1), -s * 0.4, s * 0.1, -s * 0.3, { flat: true, seg: 5 }); },
  };
  G.pond = {
    label: '池塘', cls: 'ground', wet: 'round', solid: false, face: 'random', flat: true, nouns: ['池塘', '水池', '小湖', '湖', '水塘', 'pond', 'lake'],
    params: { size: { d: 7, min: 2, max: 80 } }, dims: { size: 'size', width: 'size' }, foot: (p) => [p.size * 2, p.size * 2],
    inside: (p) => ({ floor: 0.1, hx: p.size * 0.64, hz: p.size * 0.64, water: true }), // ducks and boats float about on it
    build(b, p, rand) {
      const r = p.size;
      b.cyl(r * 1.06, r * 1.1, 0.1, '#7c8a5e', 0, 0, 0, { sides: 28 });
      b.cyl(r, r, 0.06, '#4f93b8', 0, 0.07, 0, { sides: 28, rough: 0.08, metal: 0.15, opacity: 0.9 });
      const n = Math.round(r * 3.2);
      for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + rand() * 0.2; b.sphere(0.3 + rand() * 0.35, mix('#8f8b84', '#ffffff', rand() * 0.2), Math.cos(a) * r * 1.02, 0.1, Math.sin(a) * r * 1.02, { flat: true, seg: 5, sy: 0.6 }); }
      for (let i = 0; i < Math.round(r * 1.2); i++) { const a = rand() * 6.283, d = rand() * r * 0.8; b.cyl(0.28, 0.28, 0.02, '#5a9a4e', Math.cos(a) * d, 0.135, Math.sin(a) * d, { sides: 9 }); if (i % 3 === 0) b.sphere(0.09, '#f7c6d9', Math.cos(a) * d, 0.2, Math.sin(a) * d, { seg: 6, flat: true }); }
      for (let i = 0; i < Math.round(r * 1.5); i++) { const a = rand() * 6.283, x = Math.cos(a) * r * 0.93, z = Math.sin(a) * r * 0.93, h = 0.7 + rand() * 0.7; b.cyl(0.015, 0.02, h, '#6f8f4a', x, 0.1, z, { sides: 4 }); b.cyl(0.04, 0.04, 0.2, '#6b4a33', x, 0.1 + h, z, { sides: 5 }); }
    },
  };
  G.water = {
    label: '水面', cls: 'ground', wet: 'box', solid: false, face: 'none', flat: true, block: false, nouns: ['水面', '海', '大海', '河', '河流', '小河', '海面', '海洋', 'sea', 'river', 'ocean', 'water'],
    params: { width: { d: 80, min: 4, max: 900 }, depth: { d: 40, min: 2, max: 900 }, color: { d: '#3f86ad', color: 1 } }, dims: { width: 'width', depth: 'depth', size: 'width' }, foot: (p) => [p.width, p.depth],
    inside: (p) => ({ floor: 0.09, hx: p.width * 0.47, hz: p.depth * 0.47, water: true }),
    build(b, p) { b.box(p.width, 0.12, p.depth, p.color, 0, -0.04, 0, { rough: 0.06, metal: 0.2, opacity: 0.9 }); b.box(p.width + 1.2, 0.06, p.depth + 1.2, '#cdbf9a', 0, -0.02, 0, { tex: 'sand', noShadow: true }); },
  };

  G.hill = {
    label: '小山', cls: 'nature', solid: false, face: 'random', mainColor: 'color',
    nouns: ['小山', '山', '山丘', '山坡', '土丘', '山峰', '雪山', '大山', 'hill', 'mountain'],
    params: { size: { d: 14, min: 2, max: 400 }, height: { d: 9, min: 0.5, max: 300 }, color: { d: '#6f9a58', color: 1 }, snow: { d: false, bool: 1 } }, dims: { size: 'size', width: 'size', height: 'height' }, foot: (p) => [p.size * 1.7, p.size * 1.7],
    build(b, p, rand) {
      const R = p.size, H = p.height;
      b.cone(R, H, p.color, 0, -0.05, 0, { sides: 9, flat: true, ry: rand() * 40, tex: 'grass' });
      for (let i = 0; i < 4; i++) { const a = i * 1.57 + rand(), k = 0.45 + rand() * 0.25; b.cone(R * k, H * (0.35 + rand() * 0.3), mix(p.color, i % 2 ? '#ffffff' : '#000000', 0.08), Math.cos(a) * R * 0.5, -0.05, Math.sin(a) * R * 0.5, { sides: 7, flat: true, ry: rand() * 50 }); }
      if (p.snow || H > 60) b.cone(R * 0.34, H * 0.34, '#f4f7fa', 0, H * 0.665, 0, { sides: 9, flat: true, ry: rand() * 40 });
      for (let i = 0; i < 5; i++) { const a = rand() * 6.28, d = R * (0.5 + rand() * 0.3); b.sphere(R * 0.05 + 0.2, '#8f8b84', Math.cos(a) * d, H * (1 - d / R) * 0.9, Math.sin(a) * d, { flat: true, seg: 5 }); }
      b.anchor('top', 0, H, 0);
    },
  };

  /* ================= street furniture ================= */
  G.road = {
    label: '马路', cls: 'ground', solid: false, face: 'none', flat: true, block: false,
    nouns: ['马路', '公路', '道路', '路', '街道', '街', '大街', '小路', 'road', 'street'],
    params: { length: { d: 60, min: 6, max: 800 }, width: { d: 9, min: 3, max: 40 }, sidewalk: { d: true, bool: 1 } },
    dims: { width: 'width', depth: 'width', size: 'length', height: 'width' }, foot: (p) => [p.length, p.width],
    build(b, p) {
      const L = p.length, W = p.width, SW = p.sidewalk ? 2.6 : 0, KW = 0.2, cuts = (p._cuts || []).slice().sort((a, c) => a.t - c.t);
      const spans = (gapOf) => { const out = []; let a = -L / 2; for (const c of cuts) { const g = gapOf(c); if (g == null) continue; const s = c.t - g, e = c.t + g; if (s > a) out.push([a, Math.min(s, L / 2)]); a = Math.max(a, e); } if (a < L / 2) out.push([a, L / 2]); return out.filter((s) => s[1] - s[0] > 0.05); };
      for (const [s, e] of spans((c) => (c.own ? null : c.he))) b.box(e - s, 0.16, W, '#4b4e53', (s + e) / 2, -0.11, 0, { tex: 'asphalt' });
      if (SW) for (const [s, e] of spans((c) => (c.own ? c.he : c.he + 2.6))) for (const sd of [-1, 1]) { b.box(e - s, 0.2, SW - KW, '#cdc8bd', (s + e) / 2, -0.04, sd * (W / 2 + KW + (SW - KW) / 2), { tex: 'pave' }); b.box(e - s, 0.24, KW, '#a39e94', (s + e) / 2, -0.04, sd * (W / 2 + KW / 2)); } // the kerb stands beside the paving, not inside it: two boxes sharing a face flicker against each other from any distance
      const blocked = (t) => cuts.some((c) => Math.abs(t - c.t) < c.he + 4.2);
      if (W >= 5) for (let t = -L / 2 + 2; t < L / 2 - 2; t += 6) if (!blocked(t)) b.box(2.6, 0.02, 0.16, '#e9e3c9', t, 0.05, 0, { noShadow: true });
      for (const c of cuts) for (const sd of [-1, 1]) { const tz = c.t + sd * (c.he + 1.5); if (Math.abs(tz) > L / 2 - 1.2) continue; for (let z = -W / 2 + 0.7; z <= W / 2 - 0.7; z += 1.0) b.box(2.3, 0.02, 0.5, '#efefe6', tz, 0.05, z, { noShadow: true }); }
    },
  };
  G.lamp = {
    label: '路灯', cls: 'street', solid: 'trunk', face: 'none', light: { pos: [0, 4.15, 0], color: '#ffd9a0', power: 1 },
    nouns: ['路灯', '街灯', '灯柱', 'street lamp', 'streetlight', 'lamp post', 'lamp'],
    params: { height: { d: 4.4, min: 2, max: 14 } }, dims: { height: 'height', size: 'height' },
    build(b, p) {
      const h = p.height;
      b.cyl(0.16, 0.22, 0.34, IRON, 0, 0, 0, { sides: 8 }); b.cyl(0.055, 0.08, h - 0.9, IRON, 0, 0.34, 0, { sides: 8 }); b.torus(0.1, 0.03, IRON, 0, h * 0.5, 0, { rx: 90 });
      b.cyl(0.2, 0.1, 0.1, IRON, 0, h - 0.6, 0, { sides: 6 }); b.cyl(0.21, 0.16, 0.44, '#fff3d6', 0, h - 0.5, 0, { glow: '#ffd9a0', sides: 6 });
      b.cone(0.3, 0.24, IRON, 0, h - 0.06, 0, { sides: 6 }); b.sphere(0.05, IRON, 0, h + 0.2, 0); b.halo(3.6, '#ffd9a0', 0, h - 0.3, 0);
      b.anchor('top', 0, h + 0.24, 0);
    },
  };
  G.light = {
    label: '灯', cls: 'street', float: true, solid: false, face: 'me', light: { pos: [0, 2.3, 0.3], always: true },
    nouns: ['灯', '灯光', '聚光灯', '补光灯', '摄影灯', '射灯', '光源', 'light', 'spotlight', 'studio light'],
    params: { color: { d: '#ffe6b0', color: 1 }, power: { d: 1.6, min: 0.2, max: 6 }, height: { d: 2.4, min: 0.5, max: 12 } }, dims: { height: 'height', size: 'power' }, mainColor: 'color',
    build(b, p) {
      const h = p.height;
      for (let i = 0; i < 3; i++) b.cyl(0.02, 0.02, 0.9, IRON, 0, 0, 0, { rz: 38 * Math.cos(i * 2.094), rx: 38 * Math.sin(i * 2.094) });
      b.cyl(0.025, 0.03, h - 0.3, IRON, 0, 0.3, 0);
      b.group({ y: h, rx: 12 }, () => { b.box(0.5, 0.5, 0.34, '#22252a', 0, -0.25, 0); b.box(0.42, 0.42, 0.04, '#ffffff', 0, -0.21, 0.18, { emissive: p.color }); for (const s of [-1, 1]) { b.box(0.03, 0.5, 0.3, '#22252a', s * 0.3, -0.25, 0.3, { ry: s * 25 }); } b.box(0.5, 0.03, 0.3, '#22252a', 0, 0.28, 0.3, { rx: -25 }); });
      b.halo(2.4 * Math.sqrt(p.power), p.color, 0, h, 0.3);
    },
  };
  G.bench = {
    label: '长椅', cls: 'street', solid: 'box', face: 'road', nouns: ['长椅', '长凳', '椅子', '凳子', '座椅', 'bench', 'chair', 'seat'],
    params: { color: { d: '#a8794f', color: 1 } },
    build(b, p) {
      for (let i = 0; i < 4; i++) b.box(1.7, 0.05, 0.11, p.color, 0, 0.45, -0.19 + i * 0.13, { tex: 'wood' });
      b.group({ y: 0.5, z: -0.26, rx: -12 }, () => { for (let i = 0; i < 3; i++) b.box(1.7, 0.11, 0.045, p.color, 0, 0.08 + i * 0.15, 0, { tex: 'wood' }); });
      for (const s of [-1, 1]) { b.box(0.06, 0.45, 0.5, IRON, s * 0.74, 0, -0.02); b.box(0.06, 0.5, 0.06, IRON, s * 0.74, 0.45, -0.29, { rx: -12 }); b.box(0.07, 0.04, 0.5, IRON, s * 0.74, 0.66, -0.03); b.box(0.06, 0.2, 0.06, IRON, s * 0.74, 0.47, 0.19); }
      b.anchor('seat', -0.4, 0, -0.05); b.anchor('seat2', 0.4, 0, -0.05); b.anchor('top', 0, 0.5, 0);
    },
  };
  G.fence = {
    label: '栅栏', cls: 'street', solid: 'box', face: 'road', nouns: ['栅栏', '篱笆', '围栏', '围墙', '护栏', 'fence'],
    params: { length: { d: 8, min: 1, max: 200 }, height: { d: 1.1, min: 0.4, max: 5 }, color: { d: '#f4f1ea', color: 1 } }, dims: { width: 'length', size: 'length', height: 'height' }, foot: (p) => [p.length, 0.4],
    build(b, p) { const L = p.length, h = p.height, n = Math.max(2, Math.round(L / 1.8) + 1); for (let i = 0; i < n; i++) b.box(0.12, h + 0.12, 0.12, p.color, -L / 2 + (i * L) / (n - 1), 0, 0); b.box(L, 0.07, 0.05, p.color, 0, h * 0.3, 0); b.box(L, 0.07, 0.05, p.color, 0, h * 0.78, 0); const k = Math.min(1200, Math.round(L / 0.2)); for (let i = 0; i < k; i++) { const x = -L / 2 + ((i + 0.5) * L) / k; b.box(0.09, h, 0.03, p.color, x, 0.04, 0.04); } },
  };
  G.sign = {
    label: '牌子', cls: 'street', solid: 'trunk', face: 'me', nouns: ['牌子', '招牌', '路牌', '指示牌', '告示牌', '广告牌', '标牌', 'sign', 'billboard'],
    params: { text: { d: 'HELLO', text: 1 }, size: { d: 1, min: 0.3, max: 12 }, color: { d: '#2f5d62', color: 1 } }, dims: { size: 'size', height: 'size', width: 'size' },
    build(b, p) { const s = p.size, bw = Math.max(1.4, String(p.text).length * 0.36 + 0.6) * s; b.cyl(0.05 * s, 0.06 * s, 2.2 * s, WOOD, 0, 0, 0, { sides: 6 }); b.box(bw, 0.8 * s, 0.08 * s, p.color, 0, 1.5 * s, 0.05 * s); b.box(bw + 0.1 * s, 0.07 * s, 0.1 * s, TRIM, 0, 2.3 * s, 0.05 * s); b.text(p.text, 0.42 * s, '#fbf7ef', 0, 1.9 * s, 0.1 * s); b.anchor('top', 0, 2.38 * s, 0); },
  };
  G.mailbox = { label: '邮筒', cls: 'street', solid: 'trunk', face: 'road', nouns: ['邮筒', '信箱', '邮箱', 'mailbox', 'postbox'], params: { color: { d: '#c0392b', color: 1 } }, build(b, p) { b.cyl(0.26, 0.3, 0.12, IRON, 0, 0, 0); b.cyl(0.25, 0.25, 1.0, p.color, 0, 0.12, 0, { sides: 14 }); b.sphere(0.25, p.color, 0, 1.12, 0, { sy: 0.5, seg: 14 }); b.box(0.3, 0.05, 0.04, '#1b1b1b', 0, 0.9, 0.24); b.box(0.22, 0.16, 0.02, '#f2e9c9', 0, 0.55, 0.25); } };
  G.hydrant = { label: '消防栓', cls: 'street', solid: 'trunk', face: 'road', nouns: ['消防栓', '消火栓', 'hydrant', 'fire hydrant'], params: { color: { d: '#d1382b', color: 1 } }, build(b, p) { b.cyl(0.17, 0.2, 0.08, p.color, 0, 0, 0); b.cyl(0.13, 0.14, 0.55, p.color, 0, 0.08, 0, { sides: 10 }); b.sphere(0.14, p.color, 0, 0.64, 0, { sy: 0.7 }); b.cyl(0.04, 0.04, 0.08, '#d9b45a', 0, 0.72, 0); for (const s of [-1, 1]) b.cyl(0.06, 0.06, 0.1, '#d9b45a', s * 0.13, 0.42, 0, { rz: -s * 90, sides: 8 }); b.cyl(0.07, 0.07, 0.1, '#d9b45a', 0, 0.42, 0.12, { rx: 90, sides: 8 }); } };
  G.trashcan = { label: '垃圾桶', cls: 'street', solid: 'trunk', face: 'road', nouns: ['垃圾桶', '垃圾箱', 'trash can', 'bin', 'trashcan'], params: { color: { d: '#3f6b57', color: 1 } }, build(b, p) { b.cyl(0.3, 0.25, 0.85, p.color, 0, 0, 0, { sides: 12 }); b.cyl(0.33, 0.33, 0.07, IRON, 0, 0.85, 0, { sides: 12 }); b.cyl(0.22, 0.22, 0.03, '#111111', 0, 0.9, 0, { sides: 12 }); for (let i = 0; i < 12; i++) b.box(0.03, 0.7, 0.02, mix(p.color, '#000000', 0.25), Math.cos(i * 0.5236) * 0.285, 0.08, Math.sin(i * 0.5236) * 0.285, { ry: -i * 30 }); } };
  G.busstop = {
    label: '公交站', cls: 'street', solid: false, face: 'road', nouns: ['公交站', '公交车站', '车站', '候车亭', '巴士站', 'bus stop', 'busstop'], params: { name: { d: 'BUS', text: 1 } }, foot: () => [4, 1.8],
    build(b, p) { for (const s of [-1, 1]) for (const z of [-0.6, 0.6]) b.box(0.08, 2.5, 0.08, IRON, s * 1.9, 0, z); b.box(4.2, 0.1, 1.7, '#3a4048', 0, 2.5, 0); b.box(3.8, 1.9, 0.04, '#9fc4dd', 0, 0.5, -0.6, { opacity: 0.35, rough: 0.1 }); b.box(0.04, 1.9, 1.2, '#9fc4dd', -1.9, 0.5, 0, { opacity: 0.35, rough: 0.1 }); b.box(2.6, 0.06, 0.4, WOOD, 0, 0.48, -0.3, { tex: 'wood' }); for (const s of [-1, 1]) b.box(0.06, 0.48, 0.36, IRON, s * 1.1, 0, -0.3); b.cyl(0.04, 0.04, 2.9, IRON, 2.5, 0, 0.5); b.cyl(0.34, 0.34, 0.05, '#2e6da4', 2.5, 2.9, 0.5, { rx: 90, sides: 16 }); b.text(p.name, 0.2, '#ffffff', 2.5, 2.9, 0.56); b.anchor('seat', -0.5, 0, -0.26); b.anchor('seat2', 0.5, 0, -0.26); b.anchor('top', 0, 2.6, 0); },
  };
  G.trafficlight = { label: '红绿灯', cls: 'street', solid: 'trunk', face: 'road', nouns: ['红绿灯', '交通灯', '信号灯', 'traffic light'], params: { state: { d: 'green', opts: ['red', 'yellow', 'green'] } }, build(b, p) { b.cyl(0.07, 0.1, 3.2, IRON, 0, 0, 0, { sides: 8 }); b.box(0.36, 1.0, 0.3, '#1d1f22', 0, 3.2, 0); const L = [['red', '#ff3b30'], ['yellow', '#ffcc00'], ['green', '#34c759']]; L.forEach((l, i) => { const on = l[0] === p.state; b.sphere(0.11, on ? l[1] : mix(l[1], '#000000', 0.75), 0, 3.98 - i * 0.3, 0.14, on ? { emissive: l[1] } : {}); b.box(0.3, 0.03, 0.14, '#1d1f22', 0, 4.1 - i * 0.3, 0.2); }); } };
  G.fountain = {
    label: '喷泉', cls: 'street', solid: 'box', face: 'none', nouns: ['喷泉', '喷水池', 'fountain'], params: { size: { d: 2.6, min: 1, max: 14 } }, dims: { size: 'size', width: 'size', height: 'size' }, foot: (p) => [p.size * 2, p.size * 2],
    build(b, p) {
      const k = p.size / 2.6;
      b.group({ scale: k }, () => {
        b.lathe([[0, 0], [2.5, 0], [2.6, 0.16], [2.6, 0.58], [2.38, 0.62], [2.3, 0.26], [0, 0.26]], STONE, 0, 0, 0, { sides: 24 });
        b.cyl(2.3, 2.3, 0.22, '#5aa6c8', 0, 0.28, 0, { rough: 0.08, metal: 0.1, opacity: 0.85, sides: 24 });
        b.cyl(0.24, 0.36, 1.4, STONE, 0, 0.26, 0, { sides: 10 }); b.lathe([[0, 1.5], [0.85, 1.64], [1.02, 1.82], [0.9, 1.86], [0, 1.74]], STONE, 0, 0, 0, { sides: 18 });
        b.cyl(0.84, 0.84, 0.05, '#5aa6c8', 0, 1.8, 0, { rough: 0.08, opacity: 0.85, sides: 18 }); b.cyl(0.12, 0.18, 0.7, STONE, 0, 1.74, 0); b.sphere(0.2, STONE, 0, 2.54, 0);
        b.group({ y: 2.7, anim: { pulse: { amp: 0.03, freq: 0.6 } } }, () => { /* running water holds its shape: it breathes a little, it does not jump */ b.sphere(0.2, '#dff2fb', 0, 0.25, 0, { opacity: 0.7, seg: 8 }); for (let i = 0; i < 6; i++) b.sphere(0.11, '#dff2fb', Math.cos(i * 1.047) * 0.3, 0.05, Math.sin(i * 1.047) * 0.3, { opacity: 0.7, seg: 6 }); });
        for (let i = 0; i < 8; i++) { const a = i * 0.785; b.cyl(0.03, 0.05, 1.5, '#dff2fb', Math.cos(a) * 0.98, 0.34, Math.sin(a) * 0.98, { opacity: 0.5, sides: 5 }); b.group({ x: Math.cos(a) * 1.05, y: 0.42, z: Math.sin(a) * 1.05, anim: { pulse: { amp: 0.35, freq: 1.4, phase: i } } }, () => b.sphere(0.13, '#ffffff', 0, 0, 0, { opacity: 0.6, seg: 6 })); }
      });
      b.anchor('top', 0, 2.75 * k, 0);
    },
  };
  G.table = { label: '桌椅', cls: 'street', solid: 'box', face: 'random', nouns: ['桌子', '桌椅', '餐桌', '小桌', 'table'], params: { color: { d: '#c8553d', color: 1, pick: AWN }, umbrella: { d: true, bool: 1 } }, foot: () => [2.2, 2.2], build(b, p) { b.cyl(0.5, 0.5, 0.05, '#e9e2d4', 0, 0.72, 0); b.cyl(0.04, 0.04, 0.72, IRON, 0, 0, 0); b.cyl(0.28, 0.3, 0.04, IRON, 0, 0, 0); for (let i = 0; i < 3; i++) { const a = i * 2.094; b.group({ x: Math.cos(a) * 0.8, z: Math.sin(a) * 0.8, ry: -(a * 180) / Math.PI - 90 }, () => { b.box(0.4, 0.05, 0.4, WOOD, 0, 0.44, 0, { tex: 'wood' }); b.box(0.4, 0.46, 0.05, WOOD, 0, 0.46, -0.19); for (const x of [-1, 1]) for (const z of [-1, 1]) b.cyl(0.025, 0.025, 0.44, IRON, x * 0.16, 0, z * 0.16); }); } for (let i = 0; i < 3; i++) { const a = i * 2.094; b.anchor('seat' + (i ? i + 1 : ''), Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8, -(a * 180) / Math.PI - 90); } if (p.umbrella) { b.cyl(0.03, 0.03, 2.4, '#d8d2c6', 0, 0, 0); b.cone(1.35, 0.55, p.color, 0, 2.2, 0, { sides: 8, flat: true }); } b.anchor('top', 0, 0.78, 0); } };
  G.bicycle = {
    label: '自行车', cls: 'vehicle', solid: 'box', face: 'road', ride: true, speed: 3.6, mainColor: 'color', nouns: ['自行车', '单车', '脚踏车', 'bicycle', 'bike'],
    params: { color: { d: '#2e6da4', color: 1, pick: CARS } }, foot: () => [0.6, 1.8],
    build(b, p) {
      const tyre = '#1b1d20', steel = '#c9ccd1', grey = '#888888';
      for (const z of [-0.55, 0.55]) b.group({ y: 0.36, z, anim: { roll: { radius: 0.36 } } }, () => { b.torus(0.33, 0.03, tyre, 0, 0, 0, { ry: 90 }); for (let i = 0; i < 4; i++) b.group({ rx: i * 45 }, () => b.box(0.01, 0.62, 0.01, steel, 0, -0.31, 0)); b.box(0.07, 0.07, 0.07, steel, 0, -0.035, 0); });
      b.group({ y: 0.36, anim: { roll: { radius: 0.85 } } }, () => { b.box(0.03, 0.14, 0.14, grey, 0, -0.07, 0); for (const sd of [-1, 1]) b.group({ rx: sd > 0 ? 0 : 180 }, () => { b.box(0.02, 0.17, 0.03, grey, sd * 0.08, 0, 0); b.box(0.1, 0.025, 0.07, tyre, sd * 0.14, 0.16, 0); }); });
      b.tube([[0, 0.36, -0.55], [0, 0.62, -0.1], [0, 0.36, 0]], 0.022, p.color); b.tube([[0, 0.62, -0.1], [0, 0.82, 0.4], [0, 0.36, 0.55]], 0.022, p.color); b.tube([[0, 0.36, 0], [0, 0.82, 0.4]], 0.022, p.color);
      b.cyl(0.02, 0.02, 0.3, grey, 0, 0.62, -0.1, { rx: -8 }); b.box(0.14, 0.05, 0.26, tyre, 0, 0.89, -0.14);
      b.cyl(0.02, 0.02, 0.12, grey, 0, 0.8, 0.4); b.cyl(0.015, 0.015, 0.5, grey, 0.25, 0.9, 0.4, { rz: 90 }); for (const sd of [-1, 1]) b.box(0.09, 0.035, 0.035, tyre, sd * 0.22, 0.885, 0.4);
      b.box(0.05, 0.03, 0.2, p.color, 0, 0.7, -0.62); b.box(0.04, 0.04, 0.03, '#b3261e', 0, 0.66, -0.72, { emissive: '#5a0f0a' });
      b.anchor('seat', 0, 0, -0.14); b.anchor('top', 0, 0.94, -0.14);
    },
  };
  G.gazebo = { label: '凉亭', cls: 'building', solid: false, face: 'none', nouns: ['凉亭', '亭子', '亭', 'gazebo', 'pavilion'], params: { size: { d: 3, min: 1.5, max: 14 }, color: { d: '#8a4b3a', color: 1, pick: ROOFS } }, dims: { size: 'size', width: 'size', height: 'size' }, foot: (p) => [p.size * 2, p.size * 2], inside: (p) => ({ floor: 0.36, hx: p.size * 0.6, hz: p.size * 0.6 }), build(b, p) { const r = p.size, k = r / 3; b.cyl(r, r * 1.03, 0.3, STONE, 0, 0, 0, { sides: 6, tex: 'stone' }); b.cyl(r * 0.92, r * 0.92, 0.06, WOOD, 0, 0.3, 0, { sides: 6, tex: 'wood' }); for (let i = 0; i < 6; i++) { const a = i * 1.047 + 0.5236, x = Math.cos(a) * r * 0.86, z = Math.sin(a) * r * 0.86; b.cyl(0.09 * k + 0.03, 0.1 * k + 0.03, 2.7 * k, TRIM, x, 0.3, z, { sides: 8 }); if (i !== 1) { const a2 = a + 1.047, x2 = Math.cos(a2) * r * 0.86, z2 = Math.sin(a2) * r * 0.86; b.tube([[x, 0.3 + 0.8 * k, z], [x2, 0.3 + 0.8 * k, z2]], 0.04, TRIM); b.tube([[x, 0.3 + 0.4 * k, z], [x2, 0.3 + 0.4 * k, z2]], 0.03, TRIM); } } b.cyl(r * 1.02, r * 1.02, 0.14, TRIM, 0, 0.3 + 2.7 * k, 0, { sides: 6 }); b.cone(r * 1.2, 1.5 * k, p.color, 0, 0.44 + 2.7 * k, 0, { sides: 6, flat: true }); b.sphere(0.14 * k + 0.04, '#d9b45a', 0, 0.5 + 4.2 * k, 0, { metal: 0.7, rough: 0.3 }); b.anchor('top', 0, 0.7 + 4.2 * k, 0); b.anchor('seat', 0, 0.36, 0); } };
  G.tent = { label: '帐篷', cls: 'street', solid: false, face: 'me', nouns: ['帐篷', '营帐', 'tent'], params: { color: { d: '#e67e22', color: 1, pick: AWN }, size: { d: 1, min: 0.4, max: 8 } }, dims: { size: 'size', height: 'size', width: 'size' }, foot: (p) => [2.6 * p.size, 3 * p.size], build(b, p) { const s = p.size; b.group({ scale: s, ry: 90 }, () => { b.roof(3.0, 1.6, 2.4, p.color, 0, 0.02, 0); b.roof(0.06, 1.3, 1.5, '#2a2a2a', 1.5, 0.02, 0); b.box(3.1, 0.03, 2.5, '#5f6b4a', 0, 0, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.tube([[sx * 1.5, 0.9, sz * 0.5], [sx * 2.1, 0, sz * 1.5]], 0.012, '#dddddd'); }); b.anchor('top', 0, 1.65 * s, 0); } };
  G.flag = { label: '旗帜', cls: 'street', solid: 'trunk', face: 'me', nouns: ['旗帜', '旗子', '旗', '旗杆', 'flag'], params: { color: { d: '#c0392b', color: 1, pick: AWN }, height: { d: 6, min: 1.5, max: 40 } }, dims: { height: 'height', size: 'height' }, build(b, p) { const h = p.height; b.cyl(0.12, 0.16, 0.2, STONE, 0, 0, 0); b.cyl(0.035, 0.05, h, '#d8d8d8', 0, 0.2, 0, { metal: 0.5, rough: 0.4 }); b.sphere(0.07, '#d9b45a', 0, h + 0.24, 0, { metal: 0.7, rough: 0.3 }); for (let i = 0; i < 4; i++) b.group({ x: 0.04 + i * 0.36, y: h - 0.85, anim: { swing: { axis: 'y', deg: 7 + i * 5, freq: 0.9, phase: -i * 0.9 } } }, () => b.box(0.37, 0.9, 0.025, i % 2 ? mix(p.color, '#ffffff', 0.08) : p.color, 0.18, 0, 0)); b.anchor('top', 0, h + 0.3, 0); } };

  /* ================= vehicles ================= */
  G.car = {
    label: '汽车', cls: 'vehicle', solid: 'box', face: 'road', motion: 'drive', speed: 7, mainColor: 'color',
    nouns: ['汽车', '小汽车', '轿车', '车', '车子', '小车', 'car'],
    params: { color: { d: '#c0392b', color: 1, pick: CARS }, kind: { d: 'sedan', opts: ['sedan', 'taxi', 'van', 'pickup'] } }, foot: () => [1.9, 4.6],
    build(b, p) {
      const W = 1.82, k = p.kind, col = k === 'taxi' ? '#f2c230' : p.color, dark = '#1f2b38';
      let prof, glass;
      if (k === 'van') { prof = [[-2.3, 0.32], [2.3, 0.32], [2.36, 0.95], [1.95, 1.12], [1.5, 1.88], [-2.3, 1.92]]; glass = [[1.8, 1.16], [1.42, 1.78], [-2.1, 1.8], [-2.1, 1.16]]; }
      else if (k === 'pickup') { prof = [[-2.5, 0.35], [2.3, 0.35], [2.36, 0.82], [1.3, 0.92], [0.82, 1.46], [-0.3, 1.48], [-0.38, 0.95], [-2.5, 0.95]]; glass = [[1.14, 0.96], [0.74, 1.4], [-0.22, 1.41], [-0.26, 0.96]]; }
      else { prof = [[-2.15, 0.32], [2.15, 0.32], [2.2, 0.62], [2.05, 0.78], [1.15, 0.88], [0.55, 1.36], [-0.95, 1.38], [-1.55, 0.95], [-2.1, 0.9], [-2.2, 0.62]]; glass = [[1.0, 0.92], [0.5, 1.31], [-0.9, 1.33], [-1.4, 0.96]]; }
      b.extrude(prof, W, col, 0, 0, 0, { ry: -90, rough: 0.35, metal: 0.25 });
      b.extrude(glass, W + 0.03, dark, 0, 0, 0, { ry: -90, rough: 0.12 });
      const fx = prof[1][0], rx = prof[0][0];
      if (k === 'sedan' || k === 'taxi') {
        b.box(W + 0.05, 0.44, 0.09, col, 0, 0.9, -0.2);
        b.group({ y: 0.9, z: 1.17, rx: -51.3 }, () => b.box(W - 0.22, 0.72, 0.03, dark, 0, 0.02, 0.02, { rough: 0.12 }));
        b.group({ y: 0.97, z: -1.57, rx: 54.4 }, () => b.box(W - 0.22, 0.68, 0.03, dark, 0, 0.02, -0.02, { rough: 0.12 }));
        if (k === 'taxi') { b.box(0.5, 0.16, 0.22, '#fff6c8', 0, 1.38, -0.2, { glow: '#ffe98a' }); for (let i = 0; i < 9; i++) for (const s of [-1, 1]) b.box(0.02, 0.1, 0.2, i % 2 ? '#1b1b1b' : '#ffffff', s * (W / 2 + 0.006), 0.66, -1.5 + i * 0.36); }
      } else if (k === 'van') { b.group({ y: 1.14, z: 1.96, rx: -31 }, () => b.box(W - 0.2, 0.84, 0.03, dark, 0, 0.02, 0.02, { rough: 0.12 })); b.box(W - 0.3, 0.6, 0.03, dark, 0, 1.2, -2.31, { rough: 0.12 }); }
      else { b.group({ y: 0.94, z: 1.32, rx: -42.6 }, () => b.box(W - 0.22, 0.7, 0.03, dark, 0, 0.02, 0.02, { rough: 0.12 })); b.box(W - 0.24, 0.42, 0.03, dark, 0, 0.98, -0.4, { rough: 0.12 }); b.box(W - 0.2, 0.32, 2.0, mix(col, '#000000', 0.5), 0, 0.66, -1.44); }
      for (const s of [-1, 1]) { b.box(0.36, 0.14, 0.06, '#fff6d8', s * 0.6, 0.56, fx + 0.02, { glow: '#fff1c0', glowK: 1.4 }); b.box(0.32, 0.12, 0.06, '#b3261e', s * 0.62, 0.64, rx - 0.02, { emissive: '#5a0f0a' }); b.box(0.12, 0.09, 0.16, col, s * (W / 2 + 0.07), 0.98, fx - 1.35); }
      b.box(W + 0.03, 0.17, 0.14, '#2a2d31', 0, 0.28, fx - 0.02); b.box(W + 0.03, 0.17, 0.14, '#2a2d31', 0, 0.28, rx + 0.02); b.box(0.9, 0.12, 0.03, '#17191c', 0, 0.5, fx + 0.03); b.box(0.5, 0.13, 0.02, '#f2f2f2', 0, 0.33, fx + 0.06);
      const wf = fx - 0.8, wr = rx + 0.82;
      for (const s of [-1, 1]) { wheel(b, s * (W / 2 - 0.2) + (s < 0 ? -0.22 : 0), wf, 0.33, 0.22); wheel(b, s * (W / 2 - 0.2) + (s < 0 ? -0.22 : 0), wr, 0.33, 0.22); }
      b.anchor('top', 0, k === 'van' ? 1.95 : 1.42, k === 'pickup' ? 0.3 : -0.2);
    },
  };
  G.bus = {
    label: '公交车', cls: 'vehicle', solid: 'box', face: 'road', motion: 'drive', speed: 6, mainColor: 'color',
    nouns: ['公交车', '巴士车', '巴士', '公共汽车', '大巴车', '大巴', '公交', 'bus'], params: { color: { d: '#2e8b6f', color: 1, pick: ['#2e8b6f', '#d1382b', '#2e6da4', '#e6a23c'] }, decks: { d: 1, min: 1, max: 2, int: 1 }, name: { d: '12', text: 1 } }, foot: () => [2.6, 10.8],
    dims: { height: 'decks' },
    build(b, p) { // a bus, not a box: a rounded roof line, framed windows, doors, wheel arches, mirrors, a face with lights and a destination
      const W = 2.5, L = 10.4, dd = p.decks >= 2, H = dd ? 4.0 : 2.55, y0 = 0.42, top = y0 + H, hw = W / 2, hl = L / 2, glass = '#2f4456', dk = mix(p.color, '#000000', 0.32), cream = '#f1ede2', trim = '#24272b', R = 0.3;
      const sec = [[-hw, y0], [hw, y0]]; for (let i = 0; i <= 5; i++) { const a = (i / 5) * Math.PI / 2; sec.push([hw - R + Math.cos(a) * R, top - R + Math.sin(a) * R]); } for (let i = 5; i >= 0; i--) { const a = (i / 5) * Math.PI / 2; sec.push([-hw + R - Math.cos(a) * R, top - R + Math.sin(a) * R]); }
      b.extrude(sec, L, p.color, 0, 0, 0, { rough: 0.38, metal: 0.22 });
      b.box(W + 0.02, 0.3, L + 0.02, dk, 0, y0, 0); b.box(W + 0.025, 0.07, L + 0.012, cream, 0, 1.5, 0); // skirt, waist line
      const arch = []; for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI; arch.push([Math.cos(a) * 0.62, Math.sin(a) * 0.62]); }
      for (const z of [3.2, -3.0]) b.extrude(arch, W + 0.03, '#15171a', 0, 0.46, z, { ry: -90 }); // wheel arches
      const doors = [3.95, -0.55], band = (y, h, len, zc, n, step, z0) => { b.box(W + 0.03, h, len, glass, 0, y, zc, { rough: 0.16 }); b.box(W + 0.036, 0.035, len, trim, 0, y + h, zc); for (let i = 0; i < n; i++) { const z = z0 + i * step; if (y < 2.6 && doors.some((d) => Math.abs(z - d) < 0.72)) continue; b.box(W + 0.05, h, 0.09, p.color, 0, y, z); } };
      band(1.62, 0.88, L - 1.5, -0.15, 7, 1.42, -hl + 0.9);
      for (const z of doors) { b.box(0.035, 2.06, 1.2, trim, hw + 0.005, 0.5, z); for (const s of [-1, 1]) b.box(0.04, 1.84, 0.52, glass, hw + 0.013, 0.62, z + s * 0.28, { rough: 0.16 }); b.box(0.05, 0.05, 1.2, cream, hw + 0.01, 0.46, z); } // two doors on the kerb side
      // the face: windscreen, wipers, destination, lights, grille, bumper, mirrors
      b.box(W - 0.3, 1.25, 0.05, glass, 0, 1.25, hl + 0.005, { rough: 0.16 }); for (const s of [-1, 1]) b.group({ x: s * 0.5, y: 1.3, z: hl + 0.04, rz: s * 58 }, () => b.box(0.028, 0.62, 0.02, '#101113', 0, 0, 0));
      b.box(W - 0.5, 0.3, 0.05, '#0d0f12', 0, 2.56, hl + 0.006); b.text(p.name, Math.min(0.24, (W - 0.8) / (Math.max(1, String(p.name).length) * 0.62)), '#ffd27a', 0, 2.71, hl + 0.05, { glow: 1 });
      b.box(W + 0.06, 0.24, 0.16, trim, 0, y0 - 0.02, hl - 0.03); b.box(W + 0.06, 0.24, 0.16, trim, 0, y0 - 0.02, -hl + 0.03); b.box(1.0, 0.13, 0.04, '#15171a', 0, 0.8, hl + 0.012); b.box(0.5, 0.13, 0.02, '#f2f2f2', 0, 0.5, hl + 0.06);
      for (const s of [-1, 1]) {
        b.box(0.36, 0.17, 0.06, '#fff6d8', s * 0.8, 0.76, hl + 0.02, { glow: '#fff1c0', glowK: 1.4 }); b.box(0.12, 0.11, 0.06, '#f0a020', s * 1.08, 0.79, hl + 0.02, { emissive: '#6b4200' });
        b.box(0.05, 0.05, 0.3, trim, s * hw, 2.3, hl + 0.14); b.box(0.07, 0.36, 0.18, trim, s * (hw + 0.015), 1.96, hl + 0.26); // mirrors on arms
        b.box(0.17, 0.42, 0.06, '#b3261e', s * 1.0, 0.84, -hl - 0.02, { emissive: '#5a0f0a' }); b.box(0.17, 0.12, 0.06, '#f0a020', s * 1.0, 1.29, -hl - 0.02, { emissive: '#6b4200' });
        wheel(b, s * (hw - 0.26) + (s < 0 ? -0.28 : 0), 3.2, 0.46, 0.28); wheel(b, s * (hw - 0.26) + (s < 0 ? -0.28 : 0), -3.0, 0.46, 0.28);
      }
      b.box(W - 0.5, 0.8, 0.05, glass, 0, 1.66, -hl - 0.005, { rough: 0.16 }); for (let i = 0; i < 4; i++) b.box(1.3, 0.035, 0.03, '#15171a', 0, 0.92 + i * 0.09, -hl - 0.012); b.box(0.5, 0.13, 0.02, '#f2f2f2', 0, 0.56, -hl - 0.06);
      if (dd) {
        b.box(W + 0.03, 0.14, L + 0.02, cream, 0, 2.88, 0);
        band(3.14, 0.8, L - 0.7, 0, 8, 1.33, -hl + 0.55);
        b.box(W - 0.3, 0.84, 0.05, glass, 0, 3.12, hl + 0.005, { rough: 0.16 }); b.box(W - 0.5, 0.74, 0.05, glass, 0, 3.18, -hl - 0.005, { rough: 0.16 });
      }
      b.box(W - 0.7, 0.07, L - 1.0, cream, 0, top - 0.012, 0); b.box(1.3, 0.2, 1.8, '#d9dbde', 0, top + 0.04, -3.0); b.box(0.7, 0.05, 0.7, '#3a3d42', 0, top + 0.05, 2.6); // roof panel, air conditioning, hatch
      b.anchor('top', 0, top + 0.11, 0);
    },
  };

  /* ================= creatures ================= */
  G.bird = {
    label: '鸟', cls: 'creature', solid: false, face: 'random', motion: 'fly', speed: 6, alt: 14, block: false, mainColor: 'color',
    nouns: ['鸟', '小鸟', '鸟儿', '飞鸟', '麻雀', '鸽子', 'bird'],
    params: { color: { d: '#e8a23a', color: 1, pick: ['#e8a23a', '#4a90c2', '#d9534f', '#f4f1ea', '#3b3b3b', '#7ab55c'] }, size: { d: 1, min: 0.3, max: 30 }, pose: { d: 'fly', opts: ['fly', 'perch'] } }, dims: { size: 'size', height: 'size', width: 'size' },
    build(b, p) {
      const perch = p.pose === 'perch', c = p.color, dk = mix(c, '#000000', 0.28), y0 = perch ? 0.26 : 0;
      b.group({ scale: p.size * 1.25 }, () => {
        b.sphere(0.16, c, 0, y0, 0, { sy: perch ? 1.05 : 0.9, sz: 1.6, seg: 10 }); b.sphere(0.1, mix(c, '#ffffff', 0.35), 0, y0 - 0.05, 0.08, { sz: 1.3, sy: 0.8, seg: 8 });
        b.group({ y: y0 + 0.13, z: 0.2, anim: perch ? { swing: { axis: 'y', deg: 28, freq: 0.35 } } : null }, () => { b.sphere(0.105, c, 0, 0, 0, { seg: 10 }); b.cone(0.035, 0.12, '#e8862a', 0, -0.01, 0.08, { rx: 90, sides: 6 }); for (const s of [-1, 1]) b.sphere(0.02, '#111111', s * 0.07, 0.03, 0.07, { seg: 6 }); });
        b.box(0.13, 0.025, 0.24, dk, 0, y0 - 0.02, -0.34, { rx: perch ? 25 : -8 });
        if (perch) { for (const s of [-1, 1]) { b.box(0.03, 0.2, 0.36, dk, s * 0.15, y0 - 0.08, -0.06, { rx: 8 }); b.cyl(0.012, 0.012, 0.14, '#e8862a', s * 0.06, 0, 0.02); b.box(0.05, 0.012, 0.09, '#e8862a', s * 0.06, 0, 0.05); } }
        else for (const s of [-1, 1]) b.group({ x: s * 0.1, y: y0 + 0.05, anim: { swing: { axis: 'z', deg: 42, freq: 3.2, phase: s > 0 ? 0 : Math.PI } } }, () => { b.box(0.3, 0.025, 0.24, dk, s * 0.15, 0, 0); b.box(0.24, 0.02, 0.17, mix(dk, '#000000', 0.2), s * 0.4, 0, -0.02); });
      });
    },
  };
  G.cat = {
    label: '猫', cls: 'creature', solid: false, face: 'me', motion: 'none', block: false, mainColor: 'color',
    nouns: ['猫', '小猫', '猫咪', '猫猫', 'cat', 'kitten'], params: { color: { d: '#d98b3a', color: 1, pick: ['#d98b3a', '#2b2b2b', '#f4f1ea', '#8e8e8e', '#b08a5f'] }, size: { d: 1, min: 0.3, max: 30 } }, dims: { size: 'size', height: 'size', width: 'size' },
    build(b, p) {
      const c = p.color, lt = mix(c, '#ffffff', 0.4);
      b.group({ scale: p.size }, () => {
        b.sphere(0.19, c, 0, 0.24, 0, { sy: 1.25, seg: 10 }); b.sphere(0.12, lt, 0, 0.22, 0.1, { sy: 1.2, seg: 8 });
        for (const s of [-1, 1]) { b.cyl(0.04, 0.045, 0.24, c, s * 0.07, 0, 0.14, { sides: 6 }); b.sphere(0.06, c, s * 0.14, 0.06, -0.02, { sz: 1.5, seg: 6 }); }
        b.group({ y: 0.54, z: 0.07, anim: { swing: { axis: 'z', deg: 6, freq: 0.3 } } }, () => { b.sphere(0.15, c, 0, 0, 0, { seg: 10 }); for (const s of [-1, 1]) { b.cone(0.055, 0.1, c, s * 0.08, 0.1, 0, { sides: 4, rz: -s * 14 }); b.sphere(0.024, '#7ac74f', s * 0.06, 0.02, 0.13, { seg: 6 }); b.sphere(0.012, '#111111', s * 0.06, 0.02, 0.15, { seg: 5 }); } b.sphere(0.02, '#e88a9a', 0, -0.03, 0.15, { seg: 5 }); b.sphere(0.06, lt, 0, -0.05, 0.11, { seg: 6, sy: 0.7 }); });
        b.group({ y: 0.06, z: -0.16, anim: { swing: { axis: 'y', deg: 24, freq: 0.5 } } }, () => b.tube([[0, 0, 0], [0.16, 0.02, -0.12], [0.3, 0.05, -0.04], [0.36, 0.14, 0.03]], 0.03, c));
      });
    },
  };
  G.dog = {
    label: '狗', cls: 'creature', solid: false, face: 'me', motion: 'wander', speed: 1.6, block: false, mainColor: 'color',
    nouns: ['狗', '小狗', '狗狗', '狗子', 'dog', 'puppy'], params: { color: { d: '#c99a5b', color: 1, pick: ['#c99a5b', '#f0e6d2', '#4a3a2a', '#8a8a8a', '#2b2b2b'] }, size: { d: 1, min: 0.3, max: 30 } }, dims: { size: 'size', height: 'size', width: 'size' },
    build(b, p) {
      const c = p.color, dk = mix(c, '#000000', 0.3);
      b.group({ scale: p.size }, () => {
        b.sphere(0.2, c, 0, 0.44, 0, { sz: 1.9, sy: 0.9, sx: 0.9, seg: 10 });
        [[-1, 0.26, 0], [1, 0.26, 3.14], [-1, -0.26, 3.14], [1, -0.26, 0]].forEach((l) => b.group({ x: l[0] * 0.1, y: 0.36, z: l[1], anim: { swing: { axis: 'x', deg: 26, freq: 2.2, phase: l[2], byVel: 1.4 } } }, () => { b.cyl(0.045, 0.05, 0.36, c, 0, -0.36, 0, { sides: 6 }); b.sphere(0.055, dk, 0, -0.34, 0.02, { seg: 6, sy: 0.6 }); }));
        b.group({ y: 0.62, z: 0.4 }, () => { b.sphere(0.16, c, 0, 0, 0, { seg: 10 }); b.box(0.13, 0.11, 0.17, mix(c, '#ffffff', 0.3), 0, -0.1, 0.12); b.sphere(0.035, '#1b1b1b', 0, -0.01, 0.22, { seg: 6 }); for (const s of [-1, 1]) { b.box(0.05, 0.16, 0.1, dk, s * 0.15, -0.1, -0.02, { rz: s * 12 }); b.sphere(0.022, '#111111', s * 0.07, 0.05, 0.13, { seg: 6 }); } });
        b.group({ y: 0.52, z: -0.36, anim: { swing: { axis: 'y', deg: 32, freq: 3 } } }, () => b.cyl(0.02, 0.04, 0.3, c, 0, 0, 0, { rx: -48, sides: 6 }));
      });
    },
  };
  G.person = {
    label: '人', cls: 'creature', solid: false, face: 'me', motion: 'wander', speed: 1.25, block: false, sits: true, mainColor: 'shirt',
    nouns: ['人', '行人', '路人', '人物', '角色', '演员', '小人', '男人', '女人', 'person', 'people', 'man', 'woman', 'character', 'actor'],
    family: ['skin', 'hair'], // what a child and a parent have in common
    params: { pose: { d: 'walk', opts: ['walk', 'stand', 'sit', 'squat', 'kneel', 'lie', 'wave', 'ride'] }, gesture: { d: 'none', opts: ['none', 'talk', 'laugh', 'cheer', 'clap', 'wave'] }, age: { d: 'adult', opts: ['adult', 'child'] }, hold: { d: 'none', opts: ['none', 'left', 'right', 'both'] }, shirt: { d: '#3d7ea6', color: 1, pick: SHIRTS }, pants: { d: '#2f3e55', color: 1, pick: PANTS }, skin: { d: '#e0ac7e', color: 1, pick: SKINS }, hair: { d: '#2b2018', color: 1, pick: HAIRS }, height: { d: 1.72, min: 0.5, max: 40 }, hairdo: { d: 'short', opts: ['short', 'long', 'bun', 'ponytail', 'bald'], pick: ['short', 'short', 'short', 'long', 'long', 'bun', 'ponytail'] }, hat: { d: 'none', opts: ['none', 'straw', 'cap', 'beanie'], pick: ['none', 'none', 'none', 'none', 'none', 'straw', 'cap', 'beanie'] }, outfit: { d: 'shirt', opts: ['shirt', 'dress', 'coat', 'cape'], pick: ['shirt', 'shirt', 'shirt', 'shirt', 'dress', 'dress', 'coat', 'cape'] }, accent: { d: '#3f6fb5', color: 1, pick: ['#3f6fb5', '#b5533c', '#2f6f73', '#d9a441', '#6b4a8a', '#3d7a4a'] } },
    dims: { height: 'height', size: 'height' },
    build(b, p, rand) {
      const kid = p.age === 'child', pose = p.pose, walk = pose === 'walk', ride = pose === 'ride', g = ride ? 'none' : p.gesture || 'none', ph = (rand ? rand() : 0) * 6.283, hold = ride ? 'none' : p.hold || 'none';
      // a child is not a small adult: bigger head, shorter limbs, shorts and trainers
      const LG = kid ? 0.34 : 0.45, TR = kid ? 0.44 : 0.55, HR = kid ? 0.172 : 0.152, AL = kid ? 0.42 : 0.56, SW = kid ? 0.2 : 0.238, TW = kid ? 0.34 : 0.4, TD = kid ? 0.2 : 0.23, LW = kid ? 0.13 : 0.15, q = LG / 0.45, NOM = kid ? 1.52 : 1.78;
      let hip = 2 * LG, th = [0, 0], sh = [0, 0], arm = [4, 4], lean = 0, armZ = [0, 0];
      if (pose === 'sit') { hip = LG + 0.02; th = [-88, -88]; sh = [86, 86]; arm = [-38, -38]; }
      else if (pose === 'squat') { hip = 0.4 * q; th = [-112, -112]; sh = [134, 134]; arm = [-62, -62]; lean = 16; }
      else if (pose === 'kneel') { hip = LG + 0.05; th = [-90, 0]; sh = [90, 96]; arm = [-20, 0]; }
      else if (pose === 'wave') { armZ = [0, 152]; }
      else if (ride) { hip = 2 * LG * 1.055; th = [-50, -50]; sh = [64, 64]; arm = [-58, -58]; lean = 28; } // hips on the saddle, feet on the pedals, hands on the bar
      if (g === 'talk') arm[1] = pose === 'sit' ? -72 : -56; else if (g === 'cheer') armZ = [150, 150]; else if (g === 'clap') arm = [-64, -64]; else if (g === 'wave') armZ[1] = 152; else if (g === 'laugh') { arm = [arm[0] - 10, arm[1] - 10]; }
      const holds = [hold === 'right' || hold === 'both', hold === 'left' || hold === 'both']; // arm 0 is the figure's right arm
      for (let i = 0; i < 2; i++) if (holds[i]) { armZ[i] = kid ? 118 : 22; arm[i] = 0; }
      const brolly = !!p._wet && !ride && pose !== 'lie' && !holds[0]; if (brolly) { holds[0] = true; arm[0] = -64; armZ[0] = 0; } // in the rain the right hand has an umbrella in it
      const busy = (i) => g === 'cheer' || g === 'clap' || g === 'laugh' || ((g === 'talk' || g === 'wave') && i === 1);
      const legAnim = (i) => (walk ? { swing: { axis: 'x', deg: 30, freq: 1.7, phase: i * Math.PI, byVel: 1.2 } } : ride ? { swing: { axis: 'x', deg: 20, freq: 1.15, phase: i * Math.PI, byVel: 2.4 } } : null);
      const armAnim = (i) => (holds[i] || ride ? null : walk && !busy(i) ? { swing: { axis: 'x', deg: 24, freq: 1.7, phase: (1 - i) * Math.PI, byVel: 1.2 } } : armZ[i] > 0 ? { swing: { axis: 'z', deg: g === 'cheer' ? 11 : 16, freq: g === 'cheer' ? 2.3 : 1.8, phase: ph + i * 2 } } : g === 'talk' && i === 1 ? { swing: { axis: 'x', deg: 14, freq: 0.9, phase: ph } } : g === 'clap' ? { swing: { axis: 'z', deg: 8, freq: 3.2, phase: i * Math.PI } } : g === 'laugh' ? { swing: { axis: 'x', deg: 5, freq: 2.5, phase: ph + i } } : null);
      // a figure, not a stack of boxes: rounded limbs, a waist, a neck, hair that has a shape, and clothes that say something
      const dress = p.outfit === 'dress', coat = p.outfit === 'coat', cape = p.outfit === 'cape', upright = pose === 'walk' || pose === 'stand' || pose === 'wave', shoe = kid ? '#f1f1f1' : mix(p.pants, '#000000', 0.55), sleeve = coat || cape ? 1 : 0.5, TH = LW * 0.5, SHn = LW * 0.42, AR = kid ? 0.043 : 0.048, bare = dress || kid;
      const body = () => {
        for (let i = 0; i < 2; i++) { const s = i ? 1 : -1; b.group({ x: s * (kid ? 0.085 : 0.1), y: hip, rx: th[i], anim: legAnim(i) }, () => {
          b.capsule(TH, LG + TH, dress ? p.skin : p.pants, 0, -LG - TH * 0.5, 0, { sides: 8, seg: 7 });
          if (dress && !upright) { // the skirt goes where the thighs go: seated, squatting or kneeling, it lies over them (it used to stop at the hips and leave them bare)
            b.capsule(TH * 1.32, LG * 0.82, p.shirt, 0, -LG * 0.82, 0, { sides: 8, seg: 7 }); if (i === 0 && th[0] === th[1]) b.box(0.2, LG * 0.8, TH * 2.3, p.shirt, 0.1, -LG * 0.8, 0); }
          b.group({ y: -LG, rx: sh[i], anim: ride ? { swing: { axis: 'x', deg: 21, freq: 1.15, phase: i * Math.PI + 1.5708, byVel: 2.4 } } : null }, () => { b.capsule(SHn, LG + SHn * 0.6, bare ? p.skin : p.pants, 0, -LG, 0, { sides: 8, seg: 7 }); b.capsule(kid ? 0.05 : 0.055, kid ? 0.2 : 0.25, shoe, 0, -LG + 0.005, -0.075, { rx: 90, sides: 8, seg: 7 }); if (!bare) b.cyl(SHn + 0.012, SHn + 0.012, 0.05, mix(p.pants, '#000000', 0.18), 0, -LG + 0.1, 0, { sides: 8 }); }); }); }
        b.group({ y: hip, rx: lean, anim: g === 'laugh' ? { swing: { axis: 'x', deg: 3.5, freq: 2.5, phase: ph + 1 } } : ride ? { swing: { axis: 'z', deg: 2.4, freq: 1.15, phase: 0, byVel: 2.4 } } : null }, () => {
          const top = dress || coat ? p.shirt : p.shirt, wr = TW * 0.4, cr = TW * 0.5, dk = mix(p.shirt, '#000000', 0.2);
          b.sphere(wr * 1.06, dress ? p.shirt : p.pants, 0, 0.02, 0, { sy: 0.62, sz: TD / TW + 0.12, seg: 9 }); // hips
          b.cyl(cr, wr, TR * 0.86, top, 0, 0, 0, { sides: 10, sz: TD / TW + 0.08 }); b.sphere(cr, top, 0, TR * 0.86, 0, { sy: 0.36, sz: TD / TW + 0.08, seg: 9 }); // waist to chest, rounded at the shoulders
          if (!dress && !coat) b.cyl(wr + 0.012, wr + 0.012, 0.05, dk, 0, 0.0, 0, { sides: 10, sz: TD / TW + 0.1 }); // belt
          if (dress) { const sl = upright ? (kid ? 0.3 : 0.46) : 0.16; b.cyl(wr + 0.01, wr + (upright ? 0.14 : 0.06), sl, p.shirt, 0, -sl, 0, { sides: 12, sz: 0.86 }); b.cyl(wr + 0.016, wr + 0.016, 0.04, dk, 0, -0.01, 0, { sides: 10, sz: TD / TW + 0.1 }); }
          if (coat) { const cl = upright ? 0.34 : 0.1; b.cyl(wr + 0.02, wr + 0.05, cl, p.shirt, 0, -cl, 0, { sides: 10, sz: TD / TW + 0.14 }); b.box(0.035, TR * 0.8 + cl, 0.02, dk, 0, -cl, TD * 0.5 + 0.035); for (let q = 0; q < 3; q++) b.sphere(0.016, '#e9e1d3', 0.04, TR * 0.2 + q * 0.14, TD * 0.5 + 0.05, { seg: 5 }); b.cyl(0.085, 0.1, 0.06, dk, 0, TR - 0.02, 0, { sides: 8 }); }
          if (cape) b.group({ y: TR - 0.03, z: -TD * 0.5 - 0.03, anim: walk ? { swing: { axis: 'x', deg: 9, freq: 1.7, phase: ph, byVel: 1.2 } } : { swing: { axis: 'x', deg: 2.5, freq: 0.35, phase: ph } } }, () => { b.extrude([[-0.15, 0], [0.15, 0], [0.3, -(kid ? 0.5 : 0.78)], [-0.3, -(kid ? 0.5 : 0.78)]], 0.025, p.accent, 0, 0, 0, { rx: 9 }); b.cyl(0.1, 0.13, 0.07, p.accent, 0, -0.03, TD * 0.5 + 0.03, { sides: 8 }); });
          b.group({ y: TR, rx: ride ? -20 : 0, anim: g === 'talk' ? { swing: { axis: 'x', deg: 5, freq: 0.8, phase: ph } } : g === 'laugh' ? { swing: { axis: 'x', deg: 9, freq: 2.5, phase: ph } } : null }, () => {
            const hy = 0.06 + HR, hd = p.hairdo, hc = p.hair;
            b.cyl(0.046, 0.054, 0.09, p.skin, 0, -0.01, 0, { sides: 8 }); b.sphere(HR, p.skin, 0, hy, 0, { seg: 12, sy: 1.06 });
            for (const s of [-1, 1]) { b.sphere(kid ? 0.019 : 0.016, '#1b1b1b', s * HR * 0.37, hy + 0.012, HR * 0.93, { seg: 5 }); b.sphere(HR * 0.17, p.skin, s * HR * 0.98, hy, 0.0, { seg: 5, sx: 0.5 }); } // eyes, ears
            b.sphere(HR * 0.11, mix(p.skin, '#b06a4a', 0.35), 0, hy - HR * 0.12, HR * 0.99, { seg: 5 }); // nose
            if (hd !== 'bald') { b.sphere(HR * 1.06, hc, 0, hy + HR * 0.16, -HR * 0.16, { seg: 12, sy: 0.9 }); b.sphere(HR * 0.6, hc, 0, hy + HR * 0.62, HR * 0.42, { seg: 8, sy: 0.5, sx: 1.5 }); } // a cap of hair and a fringe
            if (hd === 'long') { b.capsule(HR * 0.86, HR * 2.5, hc, 0, hy - HR * 1.75, -HR * 0.52, { sides: 9, seg: 8 }); }
            else if (hd === 'bun') b.sphere(HR * 0.46, hc, 0, hy + HR * 1.02, -HR * 0.5, { seg: 8 });
            else if (hd === 'ponytail') b.group({ y: hy + HR * 0.35, z: -HR * 0.95, rx: 28, anim: walk ? { swing: { axis: 'x', deg: 10, freq: 1.7, phase: ph, byVel: 1.2 } } : null }, () => b.capsule(HR * 0.3, HR * 2.1, hc, 0, -HR * 2.0, 0, { sides: 7, seg: 6 }));
            if (p.hat === 'straw') { b.cyl(HR * 2.25, HR * 2.35, 0.02, '#e3c577', 0, hy + HR * 0.52, 0, { sides: 18 }); b.cyl(HR * 0.86, HR * 1.04, HR * 0.72, '#e8cd84', 0, hy + HR * 0.53, 0, { sides: 14 }); b.cyl(HR * 1.06, HR * 1.06, 0.035, p.accent, 0, hy + HR * 0.56, 0, { sides: 14 }); }
            else if (p.hat === 'cap') { b.sphere(HR * 1.1, p.accent, 0, hy + HR * 0.2, -HR * 0.06, { seg: 12, sy: 0.82 }); b.box(HR * 1.5, 0.02, HR * 1.0, p.accent, 0, hy + HR * 0.42, HR * 1.15, { rx: 8 }); }
            else if (p.hat === 'beanie') { b.sphere(HR * 1.12, p.accent, 0, hy + HR * 0.26, -HR * 0.08, { seg: 12, sy: 0.92 }); b.cyl(HR * 1.1, HR * 1.12, 0.05, mix(p.accent, '#ffffff', 0.25), 0, hy + HR * 0.12, -HR * 0.04, { sides: 14 }); b.sphere(HR * 0.26, mix(p.accent, '#ffffff', 0.4), 0, hy + HR * 1.3, -HR * 0.1, { seg: 6 }); }
          });
          for (let i = 0; i < 2; i++) { const s = i ? 1 : -1; b.group({ x: s * SW, y: TR - 0.04, rx: arm[i], rz: s * armZ[i] + s * 5, anim: armAnim(i) }, () => {
            b.sphere(AR * 1.08, top, 0, 0, 0, { seg: 7 }); b.capsule(AR, AL * sleeve + AR, top, 0, -AL * sleeve, 0, { sides: 7, seg: 6 }); if (sleeve < 1) b.capsule(AR * 0.86, AL * 0.56, p.skin, 0, -AL, 0, { sides: 7, seg: 6 }); b.sphere(kid ? 0.048 : 0.055, p.skin, 0, -AL - 0.035, 0, { seg: 7, sy: 1.15 });
            if (brolly && i === 0) b.group({ y: -AL - 0.03, rx: -arm[0] - (kid ? 20 : 24), rz: -13 }, () => { const L = kid ? 0.72 : 0.92, R = kid ? 0.46 : 0.62, uc = ['#22303f', '#b3261e', '#2f6f9f', '#e9e9e4', '#1b1b1b', '#d9a441', p.accent][Math.floor(ph * 1.113) % 7]; // the shaft leans back so the canopy is over the head
              b.cyl(0.012, 0.012, L + 0.12, '#2b2f33', 0, -0.1, 0, { sides: 6, metal: 0.6, rough: 0.4 }); b.torus(0.035, 0.012, '#3a2a1e', 0.035, -0.1, 0, { seg: 6 });
              b.cone(R, R * 0.36, uc, 0, L - 0.02, 0, { sides: 8, flat: true, rough: 0.5 }); b.cone(R * 0.99, R * 0.3, mix(uc, '#000000', 0.35), 0, L - 0.03, 0, { sides: 8, flat: true }); b.cyl(0.008, 0.012, 0.09, '#2b2f33', 0, L + R * 0.34, 0, { sides: 5 }); }); }); }
        });
      };
      const k = (kid && p.height >= 1.6 ? 1.15 : p.height) / NOM; // a child left at the adult default height is child-sized
      if (pose === 'lie') b.group({ scale: k, y: 0.13 * k, z: (kid ? 0.7 : 0.85) * k, rx: -90 }, body); else b.group({ scale: k }, body);
      b.anchor('top', 0, (pose === 'lie' ? 0.3 : hip + TR + 0.065 + 2 * HR + 0.06) * k, 0);
    },
  };

  /* ================= sky ================= */
  G.cloud = {
    label: '云', cls: 'sky', solid: false, face: 'random', motion: 'drift', speed: 0.7, alt: 70, block: false, nouns: ['云', '白云', '云朵', '云彩', 'cloud'],
    params: { size: { d: 1, min: 0.2, max: 12 }, color: { d: '#ffffff', color: 1 } }, dims: { size: 'size', width: 'size', height: 'size' },
    build(b, p, rand) { const s = p.size * 9, n = 5 + Math.floor(rand() * 3), o = { noShadow: true, rough: 1, emissive: '#2c3038' }; // a cloud sits on a flat floor of air and heaps up from it
      for (let i = 0; i < n; i++) { const u = n > 1 ? i / (n - 1) : 0.5, r = s * (0.5 + rand() * 0.35) * (0.72 + 0.5 * Math.sin(u * Math.PI)); b.puff(r, p.color, (u - 0.5) * s * 3.4 + (rand() - 0.5) * s * 0.3, r * 0.3, (rand() - 0.5) * s * 0.8, Object.assign({ sy: 0.6, ry: rand() * 360 }, o)); }
      for (let i = 0; i < 3; i++) { const r = s * (0.42 + rand() * 0.3); b.puff(r, p.color, (rand() - 0.5) * s * 1.7, s * (0.42 + rand() * 0.2), (rand() - 0.5) * s * 0.5, Object.assign({ sy: 0.72, ry: rand() * 360 }, o)); } },
  };
  G.balloon = {
    label: '热气球', cls: 'sky', solid: false, face: 'random', motion: 'hover', speed: 0.5, alt: 22, block: false, mainColor: 'color', nouns: ['热气球', '气球', 'hot air balloon', 'balloon'],
    params: { color: { d: '#d9534f', color: 1, pick: AWN }, size: { d: 1, min: 0.2, max: 10 } }, dims: { size: 'size', height: 'size', width: 'size' },
    build(b, p) {
      const P = [[0.5, 2.2], [1.7, 3.3], [2.7, 4.9], [3.1, 6.5], [2.85, 8.1], [2.0, 9.3], [0.95, 9.95], [0, 10.1]];
      b.group({ scale: p.size }, () => {
        const bands = [[0, 2], [2, 3], [3, 4], [4, 5], [5, 7]];
        bands.forEach((bd, i) => b.lathe(P.slice(bd[0], bd[1] + 1), i % 2 ? '#f6efe2' : p.color, 0, 0, 0, { sides: 16 }));
        b.cyl(0.5, 0.42, 0.12, '#3a3a3a', 0, 2.1, 0); b.sphere(0.2, '#ffcf7a', 0, 1.9, 0, { emissive: '#ff9a3a' });
        b.box(1.0, 0.8, 1.0, '#a9793f', 0, 0, 0, { tex: 'wood' }); b.box(1.08, 0.08, 1.08, '#7a5530', 0, 0.8, 0);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.tube([[sx * 0.48, 0.8, sz * 0.48], [sx * 0.42, 2.15, sz * 0.42]], 0.015, '#dddddd');
      });
      b.anchor('top', 0, 10.2 * p.size, 0);
    },
  };

  /* ================= primitives ================= */

  /* ================= furniture =================
     What rooms are furnished with. Every piece is an object of its own, so it can be pointed at, moved, resized, recoloured or removed like anything else.
     Front faces +Z: a sofa's back, a shelf's back panel and a counter's staff side are at -Z. */
  const STOCK = { books: ['#a33b2e', '#2f5d62', '#d9a441', '#3b4f7a', '#6b8f4e', '#7a3e6b', '#e8e0cf'], bread: ['#c98b4a', '#e0b06a', '#a8682f', '#f0d9a8'], flowers: ['#e2557a', '#f2c14e', '#f28c38', '#c06bd6', '#ffffff', '#e84a4a'], market: ['#d94a3a', '#f29f3d', '#7fb04a', '#f2d94e', '#8e5ab5'], tea: ['#3e6b4f', '#b8433a', '#d9b45a', '#2f3e52', '#e8dcc0'], records: ['#111418', '#d9422f', '#2b6fb3', '#f2c14e', '#7a3e6b'], mixed: ['#c9b38a', '#8aa6b5', '#b56b4f', '#6f8f5a', '#e8dcc0'] };
  const STOCKS = Object.keys(STOCK), dark = (c, k) => mix(c, '#000000', k == null ? 0.12 : k), light = (c, k) => mix(c, '#ffffff', k == null ? 0.14 : k);
  G.sofa = {
    label: '沙发', cls: 'furniture', solid: 'box', face: 'me', mainColor: 'color', nouns: ['沙发', '长沙发', 'sofa', 'couch', 'settee'],
    params: { color: { d: '#5f7a8c', color: 1 }, width: { d: 2.2, min: 1.2, max: 5 } }, dims: { width: 'width' }, foot: (p) => [p.width, 0.95],
    build(b, p) {
      const w = p.width, n = Math.max(1, Math.round((w - 0.44) / 0.85)), cw = (w - 0.44) / n;
      b.box(w, 0.4, 0.95, p.color, 0, 0, 0); b.box(w, 0.5, 0.26, dark(p.color), 0, 0.4, -0.345);
      for (const s of [-1, 1]) b.box(0.22, 0.22, 0.95, dark(p.color), s * (w / 2 - 0.11), 0.4, 0);
      for (let i = 0; i < n; i++) b.box(cw - 0.04, 0.13, 0.62, light(p.color), -w / 2 + 0.22 + cw * (i + 0.5), 0.4, 0.13);
      b.box(0.34, 0.3, 0.1, '#d9a441', -w / 2 + 0.42, 0.53, -0.14, { rx: -12 });
      b.anchor('seat', -Math.min(0.45, w / 4), 0.08, 0.12); b.anchor('seat2', Math.min(0.45, w / 4), 0.08, 0.12); b.anchor('top', 0, 0.53, 0.13);
    },
  };
  G.ftable = {
    label: '桌子', cls: 'furniture', solid: 'box', face: 'me', mainColor: 'color', nouns: ['桌子', '餐桌', '饭桌', '方桌', '长桌', '木桌', 'table', 'dining table'],
    params: { color: { d: '#8a6a48', color: 1 }, width: { d: 1.5, min: 0.4, max: 5 }, depth: { d: 0.9, min: 0.4, max: 3 }, height: { d: 0.74, min: 0.3, max: 1.3 }, top: { d: 'none', opts: ['none', 'vase', 'books', 'cups', 'goods', 'plants'] }, stock: { d: 'mixed', opts: STOCKS } },
    dims: { width: 'width', depth: 'depth', height: 'height' }, foot: (p) => [p.width, p.depth],
    build(b, p) {
      const w = p.width, d = p.depth, h = p.height, c = p.color, cols = STOCK[p.stock] || STOCK.mixed;
      b.box(w, 0.06, d, c, 0, h - 0.06, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.06, h - 0.06, 0.06, dark(c), sx * (w / 2 - 0.07), 0, sz * (d / 2 - 0.07));
      if (p.top === 'vase') { b.cyl(0.12, 0.09, 0.2, '#e8e2d6', 0, h, 0); b.sphere(0.13, '#e2557a', 0, h + 0.28, 0, { flat: true, seg: 6 }); }
      else if (p.top === 'books') { b.box(0.3, 0.03, 0.22, '#e9e2d2', w * 0.18, h, 0); b.box(0.28, 0.03, 0.2, '#3b4f7a', w * 0.18, h + 0.03, 0.01); b.cyl(0.05, 0.04, 0.09, '#f2f2ee', -w * 0.22, h, 0.04); }
      else if (p.top === 'cups') for (const s of [-1, 1]) { b.cyl(0.09, 0.09, 0.012, '#f2f2ee', s * w * 0.22, h, s * 0.08); b.cyl(0.05, 0.04, 0.09, '#f2f2ee', s * w * 0.22, h + 0.012, s * 0.08); }
      else if (p.top === 'goods' || p.top === 'plants') { const nx = Math.max(1, Math.floor((w - 0.1) / 0.43)), nz = Math.max(1, Math.floor((d - 0.05) / 0.44)); for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const k = i + j * nx, gx = (i - (nx - 1) / 2) * 0.43, gz = (j - (nz - 1) / 2) * 0.44; if (p.top === 'plants') { b.cyl(0.13, 0.1, 0.16, '#7a5a3c', gx, h, gz); b.sphere(0.13, cols[k % cols.length], gx, h + 0.2, gz, { flat: true, seg: 6 }); } else b.box(0.3, 0.1 + (k % 3) * 0.05, 0.3, cols[k % cols.length], gx, h, gz); } }
      b.anchor('top', 0, h, 0);
    },
  };
  G.chair = {
    label: '椅子', cls: 'furniture', solid: 'trunk', face: 'me', mainColor: 'color', nouns: ['椅子', '餐椅', '靠背椅', '木椅', 'chair', 'dining chair'], params: { color: { d: '#6e5238', color: 1 } },
    build(b, p) { const c = p.color; b.box(0.42, 0.05, 0.42, c, 0, 0.44, 0); b.box(0.42, 0.5, 0.05, c, 0, 0.49, -0.19); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.04, 0.44, 0.04, dark(c), sx * 0.18, 0, sz * 0.18); b.anchor('seat', 0, 0, 0.02); b.anchor('top', 0, 0.49, 0); },
  };
  G.shelf = {
    label: '架子', cls: 'furniture', solid: 'box', face: 'me', mainColor: 'color', nouns: ['书架', '货架', '架子', '书柜', '置物架', '柜子', 'shelf', 'shelves', 'bookshelf', 'bookcase', 'shelving'],
    params: { color: { d: '#6b4a32', color: 1 }, width: { d: 1.8, min: 0.6, max: 6 }, height: { d: 2.0, min: 0.8, max: 3.2 }, stock: { d: 'books', opts: STOCKS } }, dims: { width: 'width', height: 'height' }, foot: (p) => [p.width, 0.36],
    build(b, p) {
      const w = p.width, h = p.height, c = p.color, cols = STOCK[p.stock] || STOCK.books, rows = Math.max(2, Math.floor(h / 0.44));
      b.box(w, h, 0.06, dark(c, 0.18), 0, 0, -0.14); for (const sx of [-1, 1]) b.box(0.05, h, 0.34, c, sx * (w / 2 - 0.025), 0, 0);
      for (let r = 0; r <= rows; r++) b.box(w, 0.04, 0.34, c, 0, (r * (h - 0.04)) / rows, 0);
      for (let r = 0; r < rows; r++) { let xx = -w / 2 + 0.09, i = 0; while (xx < w / 2 - 0.3) { const bw = 0.16 + ((r * 7 + i * 13) % 5) * 0.045, bh = 0.2 + ((i * 5 + r * 3) % 4) * 0.035; b.box(bw, bh, 0.22, cols[(i + r * 2) % cols.length], xx + bw / 2, 0.04 + (r * (h - 0.04)) / rows, 0.02); xx += bw + 0.03; i++; } }
      b.anchor('top', 0, h, 0);
    },
  };
  G.tv = {
    label: '电视', cls: 'furniture', solid: 'box', face: 'me', mainColor: 'color', nouns: ['电视', '电视机', '电视柜', 'tv', 'television', 'telly', 'tv set'], params: { color: { d: '#4a3a2e', color: 1 }, on: { d: true, bool: 1 } }, foot: () => [1.9, 0.42],
    build(b, p) { b.box(1.9, 0.5, 0.42, p.color, 0, 0, 0); for (const s of [-1, 0, 1]) b.box(0.58, 0.36, 0.02, light(p.color, 0.08), s * 0.62, 0.07, 0.2); b.box(0.3, 0.12, 0.2, '#111418', 0, 0.5, 0.06); b.box(1.36, 0.78, 0.05, '#111418', 0, 0.62, 0.08, p.on ? { glow: '#2c4160', glowK: 0.5 } : {}); b.anchor('top', 0, 1.4, 0); },
  };
  G.kitchen = {
    label: '橱柜', cls: 'furniture', solid: 'box', face: 'me', mainColor: 'color', nouns: ['橱柜', '厨房', '灶台', '料理台', 'kitchen', 'kitchen counter', 'kitchenette', 'kitchen unit'],
    params: { color: { d: '#e6e0d4', color: 1 }, width: { d: 2.5, min: 1.2, max: 5 } }, dims: { width: 'width' }, foot: (p) => [p.width, 0.66],
    build(b, p) {
      const w = p.width, c = p.color, n = Math.max(2, Math.round(w / 0.62));
      b.box(w, 0.9, 0.62, c, 0, 0, 0); b.box(w + 0.06, 0.05, 0.66, '#3c3f44', 0, 0.9, 0); for (let i = 1; i < n; i++) b.box(0.015, 0.8, 0.012, dark(c, 0.25), -w / 2 + (w * i) / n, 0.05, 0.31);
      b.box(0.5, 0.02, 0.4, '#9aa3ab', -w * 0.24, 0.95, 0, { metal: 0.7, rough: 0.3 }); b.cyl(0.02, 0.02, 0.22, '#9aa3ab', -w * 0.24, 0.95, -0.22, { metal: 0.7, rough: 0.3 }); b.box(0.6, 0.02, 0.45, '#1b1d20', w * 0.22, 0.95, 0);
      b.box(w, 0.62, 0.34, dark(c, 0.06), 0, 1.6, -0.14); for (let i = 1; i < n; i++) b.box(0.02, 0.5, 0.02, '#8a8378', -w / 2 + (w * i) / n, 1.66, 0.04);
      b.anchor('top', 0, 0.95, 0.12);
    },
  };
  G.counter = {
    label: '柜台', cls: 'furniture', solid: 'box', face: 'me', mainColor: 'color', nouns: ['柜台', '收银台', '前台', '吧台', '接待台', 'counter', 'checkout', 'till', 'reception desk', 'front desk', 'bar counter'],
    params: { color: { d: '#6b4a32', color: 1 }, width: { d: 2.4, min: 1, max: 6 }, case: { d: false, bool: 1 }, stock: { d: 'bread', opts: STOCKS } }, dims: { width: 'width' }, foot: (p) => [p.width, 0.8],
    build(b, p) {
      const w = p.width, cols = STOCK[p.stock] || STOCK.mixed;
      b.box(w, 1.0, 0.7, p.color, 0, 0, 0); b.box(w + 0.1, 0.06, 0.8, '#dcccae', 0, 1.0, 0); b.box(w - 0.24, 0.7, 0.02, light(p.color, 0.08), 0, 0.15, 0.35);
      b.box(0.36, 0.28, 0.3, '#2c2f34', w / 2 - 0.5, 1.06, 0); b.box(0.3, 0.2, 0.02, '#9fd3c7', w / 2 - 0.5, 1.34, -0.1, { glow: '#9fd3c7', glowK: 0.5 });
      if (p.case && w >= 1.8) { const cw = Math.min(1.3, w - 1.1), cx = -w / 2 + 0.2 + cw / 2, n = Math.max(2, Math.floor(cw / 0.3)); for (let i = 0; i < n; i++) b.sphere(0.11, cols[i % cols.length], cx - cw / 2 + 0.16 + (i * (cw - 0.32)) / Math.max(1, n - 1), 1.16, 0, { sy: 0.7 }); b.box(cw, 0.45, 0.5, '#cfe3ea', cx, 1.06, 0, { rough: 0.1, opacity: 0.32 }); }
      else { b.cyl(0.1, 0.08, 0.16, '#e8e2d6', -w / 2 + 0.5, 1.06, 0); b.sphere(0.13, '#e2557a', -w / 2 + 0.5, 1.31, 0, { flat: true, seg: 6 }); }
      b.anchor('top', 0, 1.06, 0);
    },
  };
  G.plant = {
    label: '盆栽', cls: 'furniture', solid: 'trunk', face: 'none', mainColor: 'pot', nouns: ['盆栽', '绿植', '盆景', '盆花', '室内植物', 'potted plant', 'houseplant', 'house plant', 'pot plant'], params: { pot: { d: '#b5653f', color: 1 }, leaf: { d: '#4f8a4a', color: 1 } },
    build(b, p) { b.cyl(0.2, 0.15, 0.36, p.pot, 0, 0, 0); b.foliage(0.36, p.leaf, 0, 0.62, 0, {}); b.foliage(0.24, light(p.leaf), 0.14, 0.92, -0.05, {}); b.anchor('top', 0, 1.12, 0); },
  };
  G.floorlamp = {
    label: '落地灯', cls: 'furniture', solid: 'trunk', face: 'none', mainColor: 'shade', nouns: ['落地灯', '立灯', '台灯', 'floor lamp', 'standing lamp', 'reading lamp'], params: { shade: { d: '#f3e2b8', color: 1 }, on: { d: true, bool: 1 } },
    build(b, p) { b.cyl(0.16, 0.16, 0.03, '#2c2c2c', 0, 0, 0); b.cyl(0.03, 0.03, 1.5, '#2c2c2c', 0, 0, 0); b.cone(0.24, 0.3, p.shade, 0, 1.45, 0, p.on ? { glow: '#ffd98a', glowK: 0.9 } : {}); b.anchor('top', 0, 1.75, 0); },
  };
  G.rug = {
    label: '地毯', cls: 'furniture', solid: false, flat: true, face: 'me', mainColor: 'color', nouns: ['地毯', '毯子', '地垫', 'rug', 'carpet'],
    params: { color: { d: '#c7a17d', color: 1 }, border: { d: '#8e4a3c', color: 1 }, width: { d: 2.7, min: 0.6, max: 8 }, depth: { d: 3.3, min: 0.6, max: 8 } }, dims: { width: 'width', depth: 'depth' }, foot: (p) => [p.width, p.depth],
    build(b, p) { b.box(p.width, 0.018, p.depth, p.border, 0, 0, 0); b.box(Math.max(0.2, p.width - 0.4), 0.02, Math.max(0.2, p.depth - 0.4), p.color, 0, 0, 0); },
  };
  G.picture = {
    label: '挂画', cls: 'furniture', solid: false, face: 'me', mainColor: 'color', nouns: ['挂画', '相框', '画框', '装饰画', '油画', '海报', 'picture', 'painting', 'picture frame', 'poster', 'artwork'],
    params: { color: { d: '#7fa3b5', color: 1 }, frame: { d: '#3d2f25', color: 1 }, height: { d: 1.45, min: 0.3, max: 3 } }, foot: () => [0.7, 0.2],
    build(b, p) { b.box(0.7, 0.5, 0.03, p.frame, 0, p.height, 0); b.box(0.6, 0.4, 0.035, p.color, 0, p.height + 0.05, 0); b.box(0.22, 0.12, 0.038, light(p.color, 0.35), -0.1, p.height + 0.24, 0); },
  };
  YX.STOCK = STOCK;

  G.box = { label: '方块', cls: 'prim', solid: 'box', face: 'me', mainColor: 'color', nouns: ['方块', '盒子', '箱子', '立方体', '方盒', '砖块', 'box', 'cube', 'block'], params: { width: { d: 1, min: 0.05, max: 200 }, height: { d: 1, min: 0.05, max: 400 }, depth: { d: 1, min: 0.05, max: 200 }, color: { d: '#d9534f', color: 1, pick: AWN }, glow: { d: false, bool: 1 } }, dims: { height: 'height', width: 'width', depth: 'depth' }, build(b, p) { b.box(p.width, p.height, p.depth, p.color, 0, 0, 0, p.glow ? { emissive: p.color } : {}); } };
  G.ball = { label: '球', cls: 'prim', solid: 'box', face: 'me', mainColor: 'color', nouns: ['球', '圆球', '球体', '皮球', 'ball', 'sphere'], params: { size: { d: 0.5, min: 0.03, max: 200 }, color: { d: '#4a90c2', color: 1, pick: AWN }, glow: { d: false, bool: 1 } }, dims: { size: 'size', height: 'size', width: 'size' }, build(b, p) { b.sphere(p.size, p.color, 0, p.size, 0, Object.assign({ seg: 22 }, p.glow ? { emissive: p.color } : {})); } };
  G.cylinder = { label: '圆柱', cls: 'prim', solid: 'box', face: 'me', mainColor: 'color', nouns: ['圆柱', '柱子', '圆柱体', '石柱', 'cylinder', 'pillar', 'column'], params: { radius: { d: 0.5, min: 0.03, max: 100 }, height: { d: 2, min: 0.05, max: 400 }, color: { d: '#d9d4c8', color: 1 } }, dims: { height: 'height', width: 'radius', size: 'radius' }, build(b, p) { b.cyl(p.radius, p.radius, p.height, p.color, 0, 0, 0, { sides: 24 }); } };
  G.cone = { label: '圆锥', cls: 'prim', solid: 'box', face: 'me', mainColor: 'color', nouns: ['圆锥', '锥体', '锥子', 'cone'], params: { radius: { d: 0.6, min: 0.03, max: 100 }, height: { d: 1.5, min: 0.05, max: 400 }, color: { d: '#e67e22', color: 1 } }, dims: { height: 'height', width: 'radius', size: 'radius' }, build(b, p) { b.cone(p.radius, p.height, p.color, 0, 0, 0, { sides: 24 }); } };

  /* ---------- noun dictionary (aliases with presets), longest first ---------- */
  const PRESETS = [
    ['茶几', 'ftable', { height: 0.42, width: 1.1, depth: 0.6 }], ['咖啡桌', 'ftable', { height: 0.42, width: 1.1, depth: 0.6 }], ['书桌', 'ftable', { width: 1.4, depth: 0.7 }], ['办公桌', 'ftable', { width: 1.6, depth: 0.8 }],
    ['樱花树', 'tree', { kind: 'sakura' }], ['樱花', 'tree', { kind: 'sakura' }], ['樱树', 'tree', { kind: 'sakura' }], ['松树', 'tree', { kind: 'pine' }], ['杉树', 'tree', { kind: 'pine' }], ['圣诞树', 'tree', { kind: 'pine' }], ['白桦树', 'tree', { kind: 'birch' }], ['白桦', 'tree', { kind: 'birch' }], ['桦树', 'tree', { kind: 'birch' }], ['椰子树', 'tree', { kind: 'palm' }], ['棕榈树', 'tree', { kind: 'palm' }], ['椰树', 'tree', { kind: 'palm' }], ['柳树', 'tree', { kind: 'willow' }], ['枫树', 'tree', { kind: 'autumn' }], ['红叶树', 'tree', { kind: 'autumn' }],
    ['面包店', 'shop', { name: 'BAKERY' }], ['书店', 'shop', { name: 'BOOKS' }], ['花店', 'shop', { name: 'FLOWERS' }], ['茶馆', 'shop', { name: 'TEA' }], ['唱片店', 'shop', { name: 'RECORDS' }], ['餐厅', 'cafe', { name: 'DINER' }], ['饭店', 'cafe', { name: 'DINER' }], ['酒吧', 'cafe', { name: 'BAR', awning: '#4f6fa8' }], ['面馆', 'cafe', { name: '面' }],
    ['双层巴士车', 'bus', { decks: 2 }], ['双层巴士', 'bus', { decks: 2 }], ['双层公交车', 'bus', { decks: 2 }], ['双层公交', 'bus', { decks: 2 }], ['双层大巴', 'bus', { decks: 2 }], ['双层公共汽车', 'bus', { decks: 2 }], ['单层巴士', 'bus', { decks: 1 }], ['单层公交车', 'bus', { decks: 1 }],
    ['骑自行车的小孩', 'person', { pose: 'ride', age: 'child', height: 1.15 }], ['骑车的小孩', 'person', { pose: 'ride', age: 'child', height: 1.15 }], ['骑自行车的人', 'person', { pose: 'ride' }], ['骑单车的人', 'person', { pose: 'ride' }], ['骑车的人', 'person', { pose: 'ride' }], ['骑行者', 'person', { pose: 'ride' }], ['骑手', 'person', { pose: 'ride' }],
    ['小男孩', 'person', { age: 'child', height: 1.15 }], ['小女孩', 'person', { age: 'child', height: 1.15 }], ['小朋友', 'person', { age: 'child', height: 1.15 }], ['小孩子', 'person', { age: 'child', height: 1.15 }], ['小孩', 'person', { age: 'child', height: 1.15 }], ['孩子', 'person', { age: 'child', height: 1.15 }], ['儿童', 'person', { age: 'child', height: 1.15 }], ['男孩', 'person', { age: 'child', height: 1.25 }], ['女孩', 'person', { age: 'child', height: 1.25 }], ['娃娃', 'person', { age: 'child', height: 0.95 }], ['幼儿', 'person', { age: 'child', height: 0.95 }],
    ['成年人', 'person', { age: 'adult' }], ['大人', 'person', { age: 'adult' }], ['成人', 'person', { age: 'adult' }], ['家长', 'person', { age: 'adult' }], ['爸爸', 'person', { age: 'adult' }], ['妈妈', 'person', { age: 'adult' }], ['父亲', 'person', { age: 'adult' }], ['母亲', 'person', { age: 'adult' }],
    ['出租车', 'car', { kind: 'taxi' }], ['的士', 'car', { kind: 'taxi' }], ['面包车', 'car', { kind: 'van' }], ['货车', 'car', { kind: 'van' }], ['皮卡', 'car', { kind: 'pickup' }], ['卡车', 'car', { kind: 'pickup' }],
    ['玻璃大楼', 'tower', { style: 'glass', floors: 14 }], ['摩天大楼', 'tower', { style: 'glass', floors: 24 }], ['摩天楼', 'tower', { style: 'glass', floors: 24 }], ['写字楼', 'tower', { style: 'glass', floors: 12 }], ['办公楼', 'tower', { style: 'glass', floors: 10 }],
  ];
  const EN_LABEL = { house: 'House', cafe: 'Café', shop: 'Shop', tower: 'Tower', tree: 'Tree', bush: 'Bush', flowers: 'Flowers', rock: 'Rock', pond: 'Pond', water: 'Water', hill: 'Hill', road: 'Road', lamp: 'Street lamp', light: 'Light', bench: 'Bench', fence: 'Fence', sign: 'Sign', mailbox: 'Mailbox', hydrant: 'Hydrant', trashcan: 'Trash can', busstop: 'Bus stop', trafficlight: 'Traffic light', fountain: 'Fountain', table: 'Café table', sofa: 'Sofa', ftable: 'Table', chair: 'Chair', shelf: 'Shelf', tv: 'TV', kitchen: 'Kitchen counter', counter: 'Counter', plant: 'Potted plant', floorlamp: 'Floor lamp', rug: 'Rug', picture: 'Picture', bicycle: 'Bicycle', gazebo: 'Gazebo', tent: 'Tent', flag: 'Flag', car: 'Car', bus: 'Bus', bird: 'Bird', cat: 'Cat', dog: 'Dog', person: 'Person', cloud: 'Cloud', balloon: 'Balloon', box: 'Box', ball: 'Ball', cylinder: 'Cylinder', cone: 'Cone' };
  for (const k in EN_LABEL) if (G[k]) G[k].en = EN_LABEL[k];
  YX.labelOf = (d) => (d ? (YX.lang === 'en' && d.en ? d.en : d.label) : '');
  const EN_PRESETS = [
    ['coffee table', 'ftable', { height: 0.42, width: 1.1, depth: 0.6 }], ['side table', 'ftable', { height: 0.5, width: 0.6, depth: 0.6 }], ['desk', 'ftable', { width: 1.4, depth: 0.7 }], ['armchair', 'sofa', { width: 1.2 }], ['loveseat', 'sofa', { width: 1.6 }],
    ['cherry blossom tree', 'tree', { kind: 'sakura' }], ['cherry tree', 'tree', { kind: 'sakura' }], ['cherry blossom', 'tree', { kind: 'sakura' }], ['sakura tree', 'tree', { kind: 'sakura' }], ['sakura', 'tree', { kind: 'sakura' }], ['blossom tree', 'tree', { kind: 'sakura' }],
    ['pine tree', 'tree', { kind: 'pine' }], ['pine', 'tree', { kind: 'pine' }], ['fir tree', 'tree', { kind: 'pine' }], ['christmas tree', 'tree', { kind: 'pine' }], ['evergreen', 'tree', { kind: 'pine' }],
    ['birch tree', 'tree', { kind: 'birch' }], ['birch', 'tree', { kind: 'birch' }], ['palm tree', 'tree', { kind: 'palm' }], ['palm', 'tree', { kind: 'palm' }], ['willow tree', 'tree', { kind: 'willow' }], ['willow', 'tree', { kind: 'willow' }],
    ['maple tree', 'tree', { kind: 'autumn' }], ['maple', 'tree', { kind: 'autumn' }], ['autumn tree', 'tree', { kind: 'autumn' }], ['oak tree', 'tree', { kind: 'oak' }], ['oak', 'tree', { kind: 'oak' }],
    ['bakery', 'shop', { name: 'BAKERY' }], ['bookstore', 'shop', { name: 'BOOKS' }], ['bookshop', 'shop', { name: 'BOOKS' }], ['book store', 'shop', { name: 'BOOKS' }], ['flower shop', 'shop', { name: 'FLOWERS' }], ['florist', 'shop', { name: 'FLOWERS' }], ['tea house', 'shop', { name: 'TEA' }], ['tea shop', 'shop', { name: 'TEA' }], ['record store', 'shop', { name: 'RECORDS' }], ['record shop', 'shop', { name: 'RECORDS' }], ['market', 'shop', { name: 'MARKET' }], ['grocery store', 'shop', { name: 'MARKET' }], ['convenience store', 'shop', { name: 'MARKET' }],
    ['restaurant', 'cafe', { name: 'DINER' }], ['diner', 'cafe', { name: 'DINER' }], ['bar', 'cafe', { name: 'BAR', awning: '#4f6fa8' }], ['pub', 'cafe', { name: 'PUB', awning: '#4f6fa8' }], ['coffee house', 'cafe', null], ['coffee place', 'cafe', null],
    ['double decker bus', 'bus', { decks: 2 }], ['double deck bus', 'bus', { decks: 2 }], ['double decker', 'bus', { decks: 2 }], ['london bus', 'bus', { decks: 2, color: '#d1382b' }], ['single decker bus', 'bus', { decks: 1 }], ['coach', 'bus', null],
    ['taxi', 'car', { kind: 'taxi' }], ['cab', 'car', { kind: 'taxi' }], ['van', 'car', { kind: 'van' }], ['pickup truck', 'car', { kind: 'pickup' }], ['pickup', 'car', { kind: 'pickup' }], ['truck', 'car', { kind: 'pickup' }], ['sedan', 'car', { kind: 'sedan' }],
    ['skyscraper', 'tower', { style: 'glass', floors: 24 }], ['glass tower', 'tower', { style: 'glass', floors: 14 }], ['office building', 'tower', { style: 'glass', floors: 10 }], ['office tower', 'tower', { style: 'glass', floors: 14 }], ['high rise', 'tower', { style: 'glass', floors: 16 }], ['apartment building', 'tower', null], ['apartment block', 'tower', null],
    ['street light', 'lamp', null], ['lamppost', 'lamp', null], ['streetlamp', 'lamp', null], ['garbage can', 'trashcan', null], ['trash bin', 'trashcan', null], ['flagpole', 'flag', null], ['villa', 'house', null], ['cabin', 'house', null], ['crate', 'box', null],
    ['pigeon', 'bird', null], ['sparrow', 'bird', null], ['seagull', 'bird', { color: '#f4f1ea' }], ['crow', 'bird', { color: '#3b3b3b' }],
    ['kid on a bike', 'person', { pose: 'ride', age: 'child', height: 1.15 }], ['child on a bike', 'person', { pose: 'ride', age: 'child', height: 1.15 }], ['person riding a bike', 'person', { pose: 'ride' }], ['person riding a bicycle', 'person', { pose: 'ride' }], ['person on a bike', 'person', { pose: 'ride' }], ['person on a bicycle', 'person', { pose: 'ride' }], ['bike rider', 'person', { pose: 'ride' }], ['cyclist', 'person', { pose: 'ride' }], ['biker', 'person', { pose: 'ride' }],
    ['little boy', 'person', { age: 'child', height: 1.1 }], ['little girl', 'person', { age: 'child', height: 1.1 }], ['kid', 'person', { age: 'child', height: 1.15 }], ['child', 'person', { age: 'child', height: 1.15 }], ['boy', 'person', { age: 'child', height: 1.25 }], ['girl', 'person', { age: 'child', height: 1.25 }], ['son', 'person', { age: 'child', height: 1.15 }], ['daughter', 'person', { age: 'child', height: 1.15 }], ['toddler', 'person', { age: 'child', height: 0.95 }],
    ['grown up', 'person', { age: 'adult' }], ['adult', 'person', { age: 'adult' }], ['parent', 'person', { age: 'adult' }], ['dad', 'person', { age: 'adult' }], ['mom', 'person', { age: 'adult' }], ['mum', 'person', { age: 'adult' }], ['father', 'person', { age: 'adult' }], ['mother', 'person', { age: 'adult' }],
    ['guy', 'person', null], ['pedestrian', 'person', null], ['human', 'person', null], ['lady', 'person', null],
  ];
  YX.buildNouns = function () {
    const list = [];
    for (const [w, type, params] of PRESETS.concat(EN_PRESETS)) if (G[type]) list.push({ w, type, params });
    const fam = new Map(); for (const type of Object.keys(G)) for (const w of G[type].nouns || []) { const k = w.toLowerCase(); if (!fam.has(k)) fam.set(k, []); fam.get(k).push(type); }
    for (const type of Object.keys(G)) for (const w of G[type].nouns || []) { const k = w.toLowerCase(), f = fam.get(k); list.push({ w: k, type, params: null, fam: f.length > 1 ? f : null }); }
    list.sort((a, c) => c.w.length - a.w.length);
    YX.NOUNS = list;
    const en = new Map();
    for (const n of list) { const k = n.w.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); if (/^[a-z0-9 ']+$/.test(k) && !en.has(k)) en.set(k, { type: n.type, params: n.params, fam: n.fam || null, w: k }); }
    YX.nounPick = (n) => { if (n && n.fam && !n.params && YX.insideOf && YX.insideOf()) { const f = n.fam.find((t) => G[t] && G[t].cls === 'furniture'); if (f) return f; } return n ? n.type : null; }; // indoors the same word means the piece of furniture
    YX.EN_NOUNS = en;
  };
  YX.buildNouns();
})();
