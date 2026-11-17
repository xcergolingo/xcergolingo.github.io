/* Spoken World — more of the world.
   Ground that is designed (paths, plazas, fields, hedges), a market, landmarks, a playground, a farm, things that float.
   Every shape is drawn facing +Z, standing on y = 0, like the generators in gens.js. */
(function () {
  'use strict';
  const YX = window.YX, G = YX.GEN, mix = YX.mixHex;
  const IRON = '#2b2f36', TRIM = '#f5f1e8', WOOD = '#8a6a48', DARKWOOD = '#5c4330', STONE = '#b9b3a6', GOLD = '#d9b45a', GLASS = '#27425c';
  const AWN = ['#d1483a', '#2f6f73', '#d9a441', '#4f6fa8', '#6b8f4e', '#a84a6a'];
  const ground = { cls: 'ground', solid: false, face: 'none', flat: true, block: false };

  /* ================= ground ================= */
  G.path = Object.assign({
    label: '小径', mainColor: 'color', nouns: ['小径', '石板路', '步道', '人行道', '甬道', '石子路', '园路', 'path', 'footpath', 'walkway', 'trail', 'garden path'],
    params: { length: { d: 10, min: 1, max: 400 }, width: { d: 1.8, min: 0.5, max: 14 }, kind: { d: 'stone', opts: ['stone', 'gravel', 'dirt', 'wood', 'brick', 'steps'] }, color: { d: '#b9ad98', color: 1 } },
    dims: { width: 'width', depth: 'width', size: 'length', height: 'width' }, foot: (p) => [p.length, p.width],
    build(b, p, rand) {
      const L = p.length, W = p.width, K = { stone: ['#b9ad98', 'pave'], gravel: ['#cdbf9f', 'sand'], dirt: ['#a98a64', 'sand'], wood: ['#a07a50', 'wood'], brick: ['#b5694c', 'brick'], steps: ['#c9c3b6', 'pave'] }[p.kind] || ['#b9ad98', 'pave'], col = p.color !== '#b9ad98' ? p.color : K[0];
      if (p.kind === 'steps') { for (let t = -L / 2 + 0.45; t < L / 2; t += 0.95) b.cyl(W * 0.36 + rand() * 0.08, W * 0.4, 0.07, mix(col, '#8f8b84', rand() * 0.35), t, -0.025, (rand() - 0.5) * W * 0.22, { sides: 7, ry: rand() * 50, noShadow: true }); return; }
      const up = rand() * 0.014; // no two paths at exactly the same height: where they cross, one is plainly on top
      b.box(L, 0.085 + up, W, col, 0, -0.045, 0, { tex: K[1], noShadow: true });
      if (p.kind === 'stone' || p.kind === 'brick') for (const s of [-1, 1]) b.box(L, 0.1 + up, 0.13, mix(col, '#6b665c', 0.38), 0, -0.045, s * (W / 2 + 0.05), { noShadow: true });
    },
  }, ground);

  G.plaza = Object.assign({
    label: '广场', mainColor: 'color', nouns: ['广场', '铺装', '地砖', '石板地', '小广场', 'plaza', 'town square', 'paving', 'courtyard', 'patio', 'piazza'],
    params: { size: { d: 9, min: 1.5, max: 200 }, shape: { d: 'round', opts: ['round', 'square'] }, color: { d: '#bfb39f', color: 1 }, trim: { d: '#857a6a', color: 1 } },
    dims: { size: 'size', width: 'size' }, foot: (p) => [p.size * 2, p.size * 2],
    build(b, p) {
      const r = p.size, mid = mix(p.color, p.trim, 0.5);
      if (p.shape === 'square') {
        b.box(r * 2 + 0.5, 0.107, r * 2 + 0.5, p.trim, 0, -0.045, 0, { noShadow: true }); b.box(r * 2, 0.115, r * 2, p.color, 0, -0.045, 0, { tex: 'pave', noShadow: true });
        b.box(r * 1.1, 0.123, r * 1.1, mid, 0, -0.045, 0, { ry: 45, noShadow: true }); b.box(r * 0.95, 0.131, r * 0.95, p.color, 0, -0.045, 0, { ry: 45, tex: 'pave', noShadow: true });
      } else {
        b.cyl(r + 0.28, r + 0.28, 0.107, p.trim, 0, -0.045, 0, { sides: 44, noShadow: true }); b.cyl(r, r, 0.115, p.color, 0, -0.045, 0, { sides: 44, tex: 'pave', noShadow: true });
        b.cyl(r * 0.62, r * 0.62, 0.123, mid, 0, -0.045, 0, { sides: 40, noShadow: true }); b.cyl(r * 0.56, r * 0.56, 0.131, p.color, 0, -0.045, 0, { sides: 40, tex: 'pave', noShadow: true });
        for (let i = 0; i < 8; i++) b.box(0.16, 0.012, r * 0.38, mid, Math.sin(i * 0.7854) * r * 0.81, 0.069, Math.cos(i * 0.7854) * r * 0.81, { ry: i * 45, noShadow: true });
      }
    },
  }, ground);

  const CROPS = { wheat: ['#dcbb5c', 0.6, 1], lavender: ['#8d6fc0', 0.42, 0], tulip: ['#e2495b', 0.34, 0], vegetable: ['#5fa04a', 0.26, 0], sunflower: ['#f2c230', 1.0, 0], corn: ['#86b04e', 1.25, 1], soil: ['#7a5a3c', 0, 0], meadow: ['#8fbf5a', 0, 0] };
  G.field = Object.assign({
    label: '田地', nouns: ['田地', '农田', '麦田', '菜地', '菜园', '花田', '庄稼', '薰衣草田', '向日葵田', '玉米地', '草甸', 'field', 'farmland', 'crops', 'wheat field', 'meadow', 'vegetable patch', 'flower field'],
    params: { width: { d: 24, min: 2, max: 400 }, depth: { d: 16, min: 2, max: 400 }, crop: { d: 'wheat', opts: Object.keys(CROPS), pick: ['wheat', 'lavender', 'tulip', 'vegetable', 'sunflower', 'corn'] } },
    dims: { width: 'width', depth: 'depth', size: 'width' }, foot: (p) => [p.width, p.depth],
    build(b, p, rand) {
      const w = p.width, d = p.depth, C = CROPS[p.crop] || CROPS.wheat, meadow = p.crop === 'meadow';
      b.box(w, 0.07, d, meadow ? '#84b655' : '#7d5d3f', 0, -0.035, 0, { tex: meadow ? 'grass' : 'sand', noShadow: true });
      if (meadow) { const n = Math.min(260, Math.round(w * d * 0.12)); for (let i = 0; i < n; i++) b.sphere(0.1 + rand() * 0.05, ['#f7e36b', '#ffffff', '#e88fb0', '#c79be8', '#ff9d5c'][i % 5], (rand() - 0.5) * w * 0.94, 0.13, (rand() - 0.5) * d * 0.94, { seg: 5, flat: true, noShadow: true }); return; }
      if (!C[1]) return;
      const step = Math.max(1.0, d / 44), n = Math.floor(d / step), TUL = ['#e2495b', '#f2c14e', '#f08fb0', '#fbf6ea', '#c084d6', '#ff8c5a'];
      for (let i = 0; i < n; i++) {
        const z = -d / 2 + step * (i + 0.5), col = p.crop === 'tulip' ? TUL[Math.floor(i / 2) % TUL.length] : mix(C[0], i % 2 ? '#ffffff' : '#000000', 0.05), h = C[1] * (0.92 + rand() * 0.14);
        if (p.crop === 'sunflower' || p.crop === 'tulip' || p.crop === 'lavender') { b.box(w - 0.7, h * 0.72, step * 0.4, '#4f8a45', 0, 0.02, z, { flat: true }); b.box(w - 0.7, h * 0.3, step * 0.58, col, 0, 0.02 + h * 0.7, z, { flat: true }); }
        else b.box(w - 0.7, h, step * 0.6, col, 0, 0.02, z, { flat: true, tex: C[2] ? 'grass' : undefined });
      }
    },
  }, ground);

  /* ================= green edges ================= */
  G.hedge = {
    label: '树篱', cls: 'street', solid: 'box', face: 'road', mainColor: 'color', nouns: ['树篱', '绿篱', '灌木墙', '绿墙', 'hedge', 'hedgerow'],
    params: { length: { d: 6, min: 0.6, max: 160 }, height: { d: 1.1, min: 0.3, max: 6 }, color: { d: '#4f8a45', color: 1 } }, dims: { size: 'length', width: 'length', height: 'height' }, foot: (p) => [p.length, 0.9],
    build(b, p, rand) { const L = p.length, H = p.height, n = Math.max(2, Math.round(L / 0.85)); b.box(L - 0.16, H - 0.3, 0.5, mix(p.color, '#12301c', 0.35), 0, 0, 0); for (let i = 0; i < n; i++) b.foliage(0.5, mix(p.color, i % 2 ? '#ffffff' : '#12301c', 0.03 + rand() * 0.07), -L / 2 + (L * (i + 0.5)) / n, H * 0.5, (rand() - 0.5) * 0.08, { sy: (H * 0.98) / 1.0, sx: 1.05, sz: 0.84, ry: rand() * 360 }); }, // a clipped hedge is still leaves: a dark core, and a row of leafy masses trimmed to one height
  };
  G.planter = {
    label: '花箱', cls: 'street', solid: 'trunk', face: 'road', mainColor: 'color', nouns: ['花箱', '花坛', '花槽', '种植箱', 'planter', 'flower box', 'flower bed', 'planter box'],
    params: { width: { d: 1.6, min: 0.4, max: 12 }, color: { d: '#8a6a48', color: 1 }, flowers: { d: '#e85d75', color: 1, pick: ['#e85d75', '#f2c14e', '#c084d6', '#ff8c5a', '#ffffff', '#e2495b'] } }, dims: { width: 'width', size: 'width' }, foot: (p) => [p.width, 0.7],
    build(b, p, rand) { const w = p.width; b.box(w, 0.5, 0.62, p.color, 0, 0, 0, { tex: 'wood' }); b.box(w + 0.08, 0.07, 0.7, mix(p.color, '#000000', 0.25), 0, 0.46, 0); b.box(w - 0.1, 0.06, 0.52, '#4a3a2a', 0, 0.48, 0); const n = Math.max(3, Math.round(w * 4)); for (let i = 0; i < n; i++) { const x = -w / 2 + 0.16 + ((w - 0.32) * i) / (n - 1), z = (rand() - 0.5) * 0.3; b.foliage(0.2, mix('#4f8a45', '#7ab55c', rand()), x, 0.6, z, { sy: 0.8, ry: rand() * 360 }); if (i % 2 === 0 || rand() < 0.5) b.sphere(0.1, mix(p.flowers, '#ffffff', rand() * 0.3), x + (rand() - 0.5) * 0.1, 0.76 + rand() * 0.08, z, { seg: 5, flat: true }); } },
  };

  /* ================= market ================= */
  const GOODS = { fruit: ['#e8862e', '#d1382b', '#8fbf4a', '#f2c230'], vegetables: ['#5fa04a', '#e8862e', '#8e3b52', '#f0e6c8'], flowers: ['#e85d75', '#f2c14e', '#c084d6', '#ffffff'], bread: ['#c98d4e', '#b5733a', '#e2b874', '#a8642e'], books: ['#3f6f73', '#a8452f', '#d9a441', '#34495e'], fish: ['#aab8c2', '#8fa3b0', '#c9d3da', '#7f95a3'] };
  G.stall = {
    label: '摊位', cls: 'street', solid: 'box', face: 'road', mainColor: 'color', nouns: ['摊位', '小摊', '货摊', '集市摊', '水果摊', '花摊', '菜摊', '面包摊', '书摊', '鱼摊', '摊子', 'stall', 'market stall', 'fruit stand', 'flower stand', 'market stand', 'booth'],
    params: { color: { d: '#d1483a', color: 1, pick: AWN }, goods: { d: 'fruit', opts: Object.keys(GOODS), pick: Object.keys(GOODS) } }, foot: () => [3.0, 2.2],
    build(b, p, rand) {
      const c = p.color, gs = GOODS[p.goods] || GOODS.fruit;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.08, sz > 0 ? 2.15 : 2.5, 0.08, DARKWOOD, sx * 1.36, 0, sz * 0.86);
      b.box(2.8, 0.07, 1.5, WOOD, 0, 0.84, 0.1, { tex: 'wood' }); b.box(2.8, 0.5, 0.04, mix(c, '#000000', 0.12), 0, 0.36, 0.84); b.box(2.8, 0.5, 0.04, TRIM, 0, 0.36, 0.86, { tex: 'stripes' });
      for (let i = 0; i < 8; i++) b.box(0.38, 0.05, 2.25, i % 2 ? TRIM : c, -1.33 + i * 0.38, 2.3, 0.04, { rx: 9 });
      for (let i = 0; i < 8; i++) b.box(0.38, 0.2, 0.04, i % 2 ? TRIM : c, -1.33 + i * 0.38, 1.94, 1.14);
      b.box(2.9, 0.06, 0.06, DARKWOOD, 0, 2.14, 0.88); b.box(2.9, 0.06, 0.06, DARKWOOD, 0, 2.5, -0.86);
      for (let k = 0; k < 3; k++) b.group({ x: -0.92 + k * 0.92, y: 0.93, z: 0.12, rx: 14 }, () => {
        b.box(0.8, 0.2, 1.05, '#b08a5a', 0, 0, 0, { tex: 'wood' }); b.box(0.72, 0.05, 0.97, '#3a2e22', 0, 0.16, 0);
        if (p.goods === 'bread') for (let i = 0; i < 6; i++) b.capsule(0.09, 0.42, gs[(i + k) % 4], -0.2 + (i % 2) * 0.4, 0.28, -0.32 + Math.floor(i / 2) * 0.32, { rz: 90 });
        else if (p.goods === 'books') for (let i = 0; i < 6; i++) b.box(0.3, 0.07 + (i % 3) * 0.05, 0.22, gs[(i + k) % 4], -0.18 + (i % 2) * 0.36, 0.2, -0.32 + Math.floor(i / 2) * 0.32, { ry: rand() * 16 - 8 });
        else if (p.goods === 'fish') { b.box(0.72, 0.05, 0.97, '#eef4f7', 0, 0.2, 0); for (let i = 0; i < 5; i++) b.sphere(0.11, gs[(i + k) % 4], -0.2 + (i % 2) * 0.4, 0.3, -0.36 + i * 0.18, { sx: 2.2, sy: 0.6, seg: 7, metal: 0.4, rough: 0.35 }); }
        else if (p.goods === 'flowers') for (let i = 0; i < 6; i++) { const x = -0.22 + (i % 2) * 0.44, z = -0.33 + Math.floor(i / 2) * 0.33; b.cyl(0.11, 0.09, 0.2, '#5f6b73', x, 0.2, z, { sides: 8, metal: 0.4 }); for (let j = 0; j < 4; j++) b.sphere(0.075, gs[(i + j + k) % 4], x + (rand() - 0.5) * 0.16, 0.5 + rand() * 0.08, z + (rand() - 0.5) * 0.16, { seg: 5, flat: true }); b.cone(0.1, 0.24, '#4f8a45', x, 0.26, z, { sides: 6 }); }
        else for (let i = 0; i < 14; i++) b.sphere(0.095 + rand() * 0.02, gs[k === 1 ? (i % 2) + 1 : (k + (i % 2) * 3) % 4], -0.26 + (i % 4) * 0.175, 0.27 + (i > 9 ? 0.13 : 0), -0.36 + Math.floor(i / 4) * 0.24 + (i > 9 ? 0.1 : 0), { seg: 7 });
      });
      b.box(0.62, 0.34, 0.03, '#2c2f34', 0, 2.42, 0.9); b.box(0.5, 0.06, 0.02, '#f1e6c8', 0, 2.6, 0.92, { noShadow: true }); b.box(0.36, 0.05, 0.02, '#f1e6c8', -0.05, 2.5, 0.92, { noShadow: true });
      b.box(0.5, 0.4, 0.5, '#b08a5a', 1.05, 0, -0.5, { tex: 'wood' }); b.box(0.5, 0.36, 0.46, '#a07a50', -1.0, 0, -0.55, { tex: 'wood', ry: 12 });
    },
  };
  G.cart = {
    label: '小推车', cls: 'street', solid: 'box', face: 'road', mainColor: 'color', nouns: ['小推车', '餐车', '冰淇淋车', '咖啡车', '热狗车', '小吃车', '推车', 'cart', 'food cart', 'ice cream cart', 'coffee cart', 'hot dog cart'],
    params: { color: { d: '#f4f1ea', color: 1, pick: ['#f4f1ea', '#f7c6d9', '#bfe3d0', '#ffe08a', '#bcd6ee'] }, canopy: { d: '#d1483a', color: 1, pick: AWN } }, foot: () => [2.2, 1.3],
    build(b, p) {
      b.box(1.7, 0.75, 0.95, p.color, 0, 0.42, 0); b.box(1.78, 0.06, 1.03, mix(p.color, '#000000', 0.2), 0, 1.17, 0); b.box(1.7, 0.1, 0.02, p.canopy, 0, 0.85, 0.485); b.text('ICE CREAM', 0.13, mix(p.canopy, '#000000', 0.2), 0, 0.6, 0.49);
      for (const s of [-1, 1]) for (const sz of [-1, 1]) b.group({ x: s * 0.62, y: 0.36, z: sz > 0 ? 0.5 : -0.56 }, () => { b.cyl(0.36, 0.36, 0.06, '#2b2f36', 0, 0, 0, { rx: 90, sides: 18 }); b.cyl(0.26, 0.26, 0.07, '#c9ccd1', 0, 0, 0, { rx: 90, sides: 12, metal: 0.5 }); });
      b.box(0.06, 0.42, 0.06, IRON, -0.7, 0, -0.38); b.box(0.05, 0.05, 0.6, IRON, 1.05, 0.95, 0); for (const s of [-1, 1]) b.box(0.4, 0.05, 0.05, IRON, 0.9, 0.95, s * 0.3);
      b.cyl(0.03, 0.03, 1.5, '#d8d8d8', 0, 1.2, 0, { metal: 0.5 }); for (let i = 0; i < 8; i++) b.group({ y: 2.62, ry: i * 45 }, () => b.box(0.62, 0.04, 1.2, i % 2 ? TRIM : p.canopy, 0, 0, 0.56, { rx: 16 }));
      for (let i = 0; i < 3; i++) { b.cone(0.07, 0.2, '#d9a55a', -0.5 + i * 0.3, 1.24, 0.2, { rx: 180, sides: 8 }); b.sphere(0.085, ['#f7c6d9', '#fbf6ea', '#8d5a3b'][i], -0.5 + i * 0.3, 1.3, 0.2, { seg: 8 }); }
    },
  };

  /* ================= landmarks ================= */
  G.clocktower = {
    label: '钟楼', cls: 'building', solid: 'box', face: 'road', mainColor: 'wall', nouns: ['钟楼', '钟塔', '大钟', '塔楼', '大本钟', 'clock tower', 'clocktower', 'bell tower', 'belfry'],
    params: { height: { d: 17, min: 6, max: 120 }, wall: { d: '#e7dcc9', color: 1 }, roofColor: { d: '#3f6f73', color: 1 } }, dims: { height: 'height', size: 'height' }, foot: () => [4.6, 4.6],
    build(b, p) {
      const H = p.height, w = 3.3, sh = H * 0.56, cy = 0.7 + sh, q = mix(p.wall, '#8a7f6c', 0.35);
      b.box(4.5, 0.35, 4.5, STONE, 0, 0, 0, { tex: 'stone' }); b.box(4.0, 0.35, 4.0, STONE, 0, 0.35, 0, { tex: 'stone' });
      b.box(w, sh, w, p.wall, 0, 0.7, 0, { tex: 'plaster' }); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.34, sh, 0.34, q, sx * (w / 2 - 0.1), 0.7, sz * (w / 2 - 0.1), { tex: 'stone' });
      b.box(1.3, 2.3, 0.14, DARKWOOD, 0, 0.7, w / 2 + 0.01, { tex: 'wood' }); b.cyl(0.65, 0.65, 0.14, DARKWOOD, 0, 3.0, w / 2 + 0.01, { rx: 90, sides: 16 }); b.box(1.6, 0.14, 0.2, q, 0, 3.72, w / 2 + 0.02);
      for (let y = 5.2; y < 0.7 + sh - 1.4; y += 3.1) for (let k = 0; k < 4; k++) b.group({ ry: k * 90 }, () => { b.box(0.52, 1.25, 0.1, GLASS, 0, y, w / 2 + 0.005, { rough: 0.25 }); b.box(0.68, 0.1, 0.16, q, 0, y - 0.1, w / 2 + 0.02); });
      b.box(w + 0.5, 0.26, w + 0.5, q, 0, cy, 0); b.box(w + 0.26, 3.5, w + 0.26, p.wall, 0, cy + 0.26, 0, { tex: 'plaster' });
      for (let k = 0; k < 4; k++) b.group({ ry: k * 90 }, () => b.group({ y: cy + 2.0, z: (w + 0.26) / 2 }, () => {
        b.cyl(1.36, 1.36, 0.1, q, 0, 0, 0.0, { rx: 90, sides: 28 }); b.cyl(1.2, 1.2, 0.08, '#fbf8ef', 0, 0, 0.03, { rx: 90, sides: 28, glow: '#fff2cc', glowK: 0.5 });
        for (let i = 0; i < 12; i++) b.box(0.05, i % 3 ? 0.14 : 0.26, 0.02, IRON, Math.sin(i * 0.5236) * 1.0, Math.cos(i * 0.5236) * 1.0 - (i % 3 ? 0.07 : 0.13), 0.125, { rz: -i * 30 });
        b.group({ z: 0.16, anim: { spin: { axis: 'z', speed: -0.0146, phase: -1.0 } } }, () => b.box(0.1, 0.62, 0.03, IRON, 0, 0, 0));
        b.group({ z: 0.2, anim: { spin: { axis: 'z', speed: -0.175, phase: 0.6 } } }, () => b.box(0.06, 0.98, 0.03, IRON, 0, 0, 0));
        b.sphere(0.08, GOLD, 0, 0, 0.22, { metal: 0.7, rough: 0.3 });
      }));
      const by = cy + 3.76; b.box(w + 0.6, 0.24, w + 0.6, q, 0, by, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.42, 2.1, 0.42, p.wall, sx * (w / 2 - 0.12), by + 0.24, sz * (w / 2 - 0.12), { tex: 'plaster' });
      b.box(w + 0.2, 0.3, w + 0.2, p.wall, 0, by + 2.34, 0); b.group({ y: by + 2.2, anim: { swing: { axis: 'z', deg: 9, freq: 0.22 } } }, () => { b.cyl(0.03, 0.03, 0.5, IRON, 0, -0.5, 0); b.cyl(0.24, 0.52, 0.72, GOLD, 0, -1.22, 0, { sides: 14, metal: 0.75, rough: 0.3 }); b.sphere(0.1, IRON, 0, -1.3, 0); });
      b.box(w + 0.7, 0.2, w + 0.7, q, 0, by + 2.64, 0); b.pyramid(w + 0.5, Math.max(3, H * 0.2), w + 0.5, p.roofColor, 0, by + 2.84, 0, { tex: 'roof' });
      const ty = by + 2.84 + Math.max(3, H * 0.2); b.cyl(0.03, 0.05, 1.2, IRON, 0, ty - 0.1, 0); b.sphere(0.14, GOLD, 0, ty + 0.5, 0, { metal: 0.8, rough: 0.25 }); b.box(0.7, 0.04, 0.04, IRON, 0, ty + 0.9, 0); b.cone(0.1, 0.26, GOLD, 0.38, ty + 0.92, 0, { rz: -90, sides: 4 });
      b.anchor('top', 0, ty, 0);
    },
  };
  G.windmill = {
    label: '风车', cls: 'building', solid: 'box', face: 'road', mainColor: 'wall', nouns: ['风车', '风车磨坊', '磨坊', 'windmill', 'mill'],
    params: { height: { d: 11, min: 4, max: 80 }, wall: { d: '#f1ece1', color: 1 }, roofColor: { d: '#6b4a3a', color: 1 }, sails: { d: '#f4efe2', color: 1 } }, dims: { height: 'height', size: 'height' }, foot: (p) => [p.height * 0.5, p.height * 0.5],
    build(b, p) {
      const H = p.height, r0 = H * 0.21, r1 = H * 0.13, L = H * 0.62;
      b.cyl(r0 + 0.25, r0 + 0.35, 0.5, STONE, 0, 0, 0, { sides: 10, tex: 'stone' }); b.cyl(r1, r0, H * 0.8, p.wall, 0, 0.5, 0, { sides: 10, tex: 'plaster' });
      b.cyl(r0 * 0.9 + 0.5, r0 * 0.9 + 0.5, 0.12, WOOD, 0, H * 0.3, 0, { sides: 10, tex: 'wood' }); for (let i = 0; i < 10; i++) b.box(0.07, 0.8, 0.07, WOOD, Math.sin(i * 0.628) * (r0 * 0.9 + 0.42), H * 0.3 + 0.1, Math.cos(i * 0.628) * (r0 * 0.9 + 0.42)); b.torus(r0 * 0.9 + 0.42, 0.04, WOOD, 0, H * 0.3 + 0.9, 0, { rx: 90, sides: 20 });
      b.box(0.95, 1.9, 0.14, DARKWOOD, 0, 0.5, r0 * 0.985, { tex: 'wood' }); for (const yy of [0.46, 0.66]) b.box(0.55, 0.75, 0.12, GLASS, 0, H * yy, r0 - (r0 - r1) * (yy / 0.8) + 0.01, { rough: 0.25 });
      b.cyl(r1 * 0.25, r1 + 0.22, H * 0.2, p.roofColor, 0, 0.5 + H * 0.8, 0, { sides: 10, tex: 'roof' }); b.sphere(0.16, GOLD, 0, 0.5 + H * 1.0 + 0.1, 0, { metal: 0.7 });
      b.cyl(0.14, 0.14, r1 * 0.9, IRON, 0, 0.5 + H * 0.84, r1 * 0.75, { rx: 90, sides: 8 });
      b.group({ y: 0.5 + H * 0.84, z: r1 * 0.75 + r1 * 0.9 + 0.05, anim: { spin: { axis: 'z', speed: 0.42 } } }, () => {
        b.sphere(0.24, IRON, 0, 0, 0, { seg: 8 });
        for (let i = 0; i < 4; i++) b.group({ rz: i * 90 }, () => { b.box(0.1, L, 0.08, DARKWOOD, 0, 0, 0); b.box(L * 0.2, L * 0.72, 0.03, p.sails, L * 0.1 + 0.05, L * 0.24, -0.02); for (let k = 0; k < 6; k++) b.box(L * 0.2, 0.035, 0.05, DARKWOOD, L * 0.1 + 0.05, L * 0.24 + (k * L * 0.72) / 5, 0.02); b.box(0.035, L * 0.72, 0.05, DARKWOOD, L * 0.2 + 0.05, L * 0.24, 0.02); });
      });
      b.anchor('top', 0, 0.5 + H, 0);
    },
  };
  G.lighthouse = {
    label: '灯塔', cls: 'building', solid: 'box', face: 'road', mainColor: 'color', nouns: ['灯塔', 'lighthouse'],
    params: { height: { d: 18, min: 5, max: 120 }, color: { d: '#d1382b', color: 1 } }, dims: { height: 'height', size: 'height' }, foot: (p) => [p.height * 0.36, p.height * 0.36],
    build(b, p) {
      const H = p.height, r0 = H * 0.14, r1 = H * 0.085, n = 5, hh = (H * 0.78) / n;
      b.cyl(r0 + 0.6, r0 + 0.8, 0.5, STONE, 0, 0, 0, { sides: 14, tex: 'stone' });
      for (let i = 0; i < n; i++) { const a = r0 - ((r0 - r1) * i) / n, c = r0 - ((r0 - r1) * (i + 1)) / n; b.cyl(c, a, hh, i % 2 ? '#f6f3ea' : p.color, 0, 0.5 + i * hh, 0, { sides: 16 }); }
      const gy = 0.5 + n * hh; b.box(0.8, 1.8, 0.12, DARKWOOD, 0, 0.5, r0 * 0.99); for (let i = 1; i < n; i += 2) b.box(0.4, 0.6, 0.1, GLASS, 0, 0.5 + i * hh + hh * 0.3, r0 - ((r0 - r1) * (i + 0.5)) / n);
      b.cyl(r1 + 0.7, r1 + 0.55, 0.16, IRON, 0, gy, 0, { sides: 16 }); for (let i = 0; i < 12; i++) b.box(0.04, 0.7, 0.04, IRON, Math.sin(i * 0.5236) * (r1 + 0.62), gy + 0.16, Math.cos(i * 0.5236) * (r1 + 0.62)); b.torus(r1 + 0.62, 0.035, IRON, 0, gy + 0.86, 0, { rx: 90, sides: 20 });
      b.cyl(r1 * 0.82, r1 * 0.82, H * 0.1, '#cfe3ee', 0, gy + 0.16, 0, { sides: 12, opacity: 0.45, rough: 0.1 }); b.sphere(r1 * 0.34, '#fff4c2', 0, gy + 0.16 + H * 0.05, 0, { glow: '#ffe9a0', glowK: 1.6, seg: 10 });
      b.group({ y: gy + 0.16 + H * 0.05, anim: { spin: { axis: 'y', speed: 0.7 } } }, () => { for (const s of [-1, 1]) b.cyl(r1 * 0.9, 0.05, H * 0.55, '#fff4c2', 0, 0, s * r1 * 0.3, { rx: s * 90, sides: 8, opacity: 0.1, unlit: true, glow: '#ffe9a0', glowK: 0.5 }); });
      b.cone(r1 + 0.25, H * 0.09, p.color, 0, gy + 0.16 + H * 0.1, 0, { sides: 12 }); b.sphere(0.14, GOLD, 0, gy + 0.16 + H * 0.19 + 0.08, 0, { metal: 0.7 });
      b.anchor('top', 0, gy + 0.16 + H * 0.19, 0);
    },
  };
  G.ferriswheel = {
    label: '摩天轮', cls: 'building', solid: false, face: 'road', mainColor: 'color', nouns: ['摩天轮', '观览车', 'ferris wheel', 'big wheel'],
    params: { size: { d: 9, min: 3, max: 80 }, color: { d: '#f4f1ea', color: 1 } }, dims: { size: 'size', height: 'size', width: 'size' }, foot: (p) => [p.size * 2.1, p.size * 0.8],
    build(b, p) {
      const R = p.size, hub = R + 1.6, n = 12, CAB = ['#d1483a', '#d9a441', '#2f6f73', '#4f6fa8', '#a84a6a', '#6b8f4e'];
      b.box(R * 1.5, 0.3, R * 0.75, STONE, 0, 0, 0, { tex: 'stone' });
      for (const sz of [-1, 1]) for (const sx of [-1, 1]) b.tube([[sx * R * 0.6, 0.3, sz * R * 0.3], [0, hub, sz * R * 0.09]], 0.16, p.color, {});
      b.cyl(0.3, 0.3, R * 0.3, IRON, 0, hub, -R * 0.15, { rx: 90, sides: 10 });
      b.group({ y: hub, anim: { spin: { axis: 'z', speed: 0.16 } } }, () => {
        for (const sz of [-1, 1]) { b.torus(R, 0.09, p.color, 0, 0, sz * R * 0.07, { sides: 40 }); b.torus(R * 0.55, 0.05, p.color, 0, 0, sz * R * 0.07, { sides: 28 }); for (let i = 0; i < n; i++) b.group({ rz: (i * 360) / n, z: sz * R * 0.07 }, () => b.box(0.07, R, 0.07, p.color, 0, 0, 0)); }
        for (let i = 0; i < n; i++) { const a = (i * 6.2832) / n; b.group({ x: Math.sin(a) * R, y: Math.cos(a) * R, anim: { spin: { axis: 'z', speed: -0.16 } } }, () => { b.cyl(0.04, 0.04, R * 0.16, IRON, 0, 0, -R * 0.08, { rx: 90, sides: 6 }); b.box(0.04, 0.5, 0.04, IRON, 0, -0.5, 0); b.box(1.0, 0.8, 0.9, CAB[i % 6], 0, -1.3, 0); b.box(1.04, 0.36, 0.94, '#cfe3ee', 0, -0.86, 0, { opacity: 0.5 }); b.box(1.12, 0.07, 1.0, mix(CAB[i % 6], '#000000', 0.25), 0, -0.5, 0); }); }
      });
      b.box(2.2, 2.0, 1.8, '#e9e1d3', R * 0.5, 0.3, R * 0.2, { tex: 'plaster' }); b.pyramid(2.6, 0.8, 2.2, '#d1483a', R * 0.5, 2.3, R * 0.2); b.box(0.9, 0.7, 0.05, GLASS, R * 0.5, 1.2, R * 0.2 + 0.91);
    },
  };
  G.church = {
    label: '教堂', cls: 'building', solid: 'box', face: 'road', mainColor: 'wall', nouns: ['教堂', '礼拜堂', '小教堂', 'church', 'chapel'],
    params: { wall: { d: '#efe9dc', color: 1 }, roofColor: { d: '#4a5560', color: 1 } }, foot: () => [8, 15],
    build(b, p) {
      b.box(7.8, 0.4, 14.6, STONE, 0, 0, 0, { tex: 'stone' }); b.box(7, 5.4, 11, p.wall, 0, 0.4, -1.4, { tex: 'plaster' }); b.roof(11.4, 3.6, 7.6, p.roofColor, 0, 5.8, -1.4, { ry: 90, tex: 'roof' });
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { b.box(0.1, 2.6, 0.9, GLASS, s * 3.5, 1.9, -5.3 + i * 2.6, { glow: '#ffd9a0', glowK: 0.5, rough: 0.3 }); b.cyl(0.45, 0.45, 0.1, GLASS, s * 3.5, 4.5, -5.3 + i * 2.6, { rz: 90, sides: 12, glow: '#ffd9a0', glowK: 0.5 }); b.box(0.5, 4.6, 0.5, mix(p.wall, '#8a7f6c', 0.3), s * 3.7, 0.4, -6.6 + i * 2.6); }
      b.box(3.6, 9.5, 3.6, p.wall, 0, 0.4, 5.3, { tex: 'plaster' }); b.box(1.5, 2.6, 0.14, DARKWOOD, 0, 0.4, 7.11, { tex: 'wood' }); b.cyl(0.75, 0.75, 0.14, DARKWOOD, 0, 3.0, 7.11, { rx: 90, sides: 16 });
      b.cyl(0.8, 0.8, 0.1, '#7fa3c8', 0, 6.2, 7.11, { rx: 90, sides: 16, glow: '#ffd9a0', glowK: 0.5 }); for (let k = 0; k < 4; k++) b.group({ ry: k * 90, x: 0, z: 5.3 }, () => b.box(0.7, 1.5, 0.1, IRON, 0, 8.0, 1.81));
      b.box(4.0, 0.25, 4.0, mix(p.wall, '#8a7f6c', 0.3), 0, 9.9, 5.3); b.pyramid(3.8, 6.2, 3.8, p.roofColor, 0, 10.15, 5.3, { tex: 'roof' }); b.box(0.09, 1.3, 0.09, GOLD, 0, 16.2, 5.3, { metal: 0.7 }); b.box(0.7, 0.09, 0.09, GOLD, 0, 17.0, 5.3, { metal: 0.7 });
      b.box(4.4, 0.2, 1.2, STONE, 0, 0, 7.7); b.box(3.8, 0.2, 0.8, STONE, 0, 0.2, 7.5);
    },
  };
  G.statue = {
    label: '雕像', cls: 'street', solid: 'trunk', face: 'road', mainColor: 'color', nouns: ['雕像', '塑像', '铜像', '纪念碑', '雕塑', 'statue', 'monument', 'sculpture'],
    params: { size: { d: 1, min: 0.3, max: 30 }, color: { d: '#6f8f86', color: 1 } }, dims: { size: 'size', height: 'size' }, foot: (p) => [1.8 * p.size, 1.8 * p.size],
    build(b, p) { const c = p.color, o = { metal: 0.5, rough: 0.45 }; b.group({ scale: p.size }, () => { b.box(1.7, 0.3, 1.7, STONE, 0, 0, 0, { tex: 'stone' }); b.box(1.25, 1.3, 1.25, '#cfc9bd', 0, 0.3, 0, { tex: 'stone' }); b.box(1.45, 0.16, 1.45, STONE, 0, 1.6, 0); b.box(0.7, 0.3, 0.02, GOLD, 0, 0.8, 0.635, { metal: 0.7 });
      for (const s of [-1, 1]) b.box(0.2, 0.95, 0.24, c, s * 0.16, 1.76, 0, o); b.box(0.6, 0.85, 0.34, c, 0, 2.7, 0, o); b.sphere(0.2, c, 0, 3.78, 0, Object.assign({ seg: 10 }, o)); b.box(0.16, 0.8, 0.18, c, -0.4, 2.72, 0, Object.assign({ rz: -8 }, o)); b.group({ x: 0.34, y: 3.4, rz: -35 }, () => b.box(0.16, 0.85, 0.18, c, 0, 0, 0, o)); b.cyl(0.02, 0.02, 1.1, c, 0.86, 3.9, 0, o); b.box(0.5, 0.3, 0.02, c, 1.12, 4.66, 0, o); }); },
  };
  G.well = {
    label: '水井', cls: 'street', solid: 'trunk', face: 'road', nouns: ['水井', '井', '古井', 'well', 'wishing well'], params: { roofColor: { d: '#8c3b2e', color: 1 } }, foot: () => [2, 2],
    build(b, p) { b.cyl(0.95, 1.0, 0.85, '#b9b3a6', 0, 0, 0, { sides: 12, tex: 'stone' }); b.cyl(0.72, 0.72, 0.03, '#2a4a5c', 0, 0.6, 0, { sides: 12, rough: 0.1 }); b.torus(0.9, 0.09, '#9a958c', 0, 0.86, 0, { rx: 90, sides: 12 }); for (const s of [-1, 1]) b.box(0.12, 1.7, 0.12, DARKWOOD, s * 0.9, 0.8, 0); b.cyl(0.07, 0.07, 1.9, DARKWOOD, -0.95, 2.1, 0, { rz: -90, sides: 8 }); b.roof(2.3, 0.75, 1.5, p.roofColor, 0, 2.45, 0, { tex: 'roof' }); b.cyl(0.012, 0.012, 0.8, '#d9cfb8', 0, 1.3, 0); b.cyl(0.16, 0.13, 0.26, WOOD, 0, 1.05, 0, { sides: 8 }); },
  };

  /* ================= playground ================= */
  G.slide = {
    label: '滑梯', cls: 'street', solid: 'box', face: 'road', mainColor: 'color', nouns: ['滑梯', '滑滑梯', '溜滑梯', 'slide', 'playground slide'],
    params: { color: { d: '#e8b04a', color: 1, pick: ['#e8b04a', '#d1483a', '#4f6fa8', '#6b8f4e'] } }, foot: () => [1.4, 4.6],
    build(b, p) {
      const c = p.color, fr = '#4f6fa8';
      for (const s of [-1, 1]) { b.box(0.08, 2.9, 0.08, fr, s * 0.42, 0, -1.9); b.box(0.08, 2.9, 0.08, fr, s * 0.42, 0, -1.0); b.box(0.06, 0.06, 0.9, fr, s * 0.42, 2.6, -1.45); }
      b.box(0.92, 0.08, 0.98, '#c9ccd1', 0, 1.7, -1.45); for (let i = 0; i < 6; i++) b.box(0.84, 0.05, 0.07, '#c9ccd1', 0, 0.26 + i * 0.26, -2.02 - (5 - i) * 0.07);
      for (const s of [-1, 1]) b.group({ x: s * 0.42, y: 0, z: -2.02 }, () => b.box(0.06, 1.85, 0.06, fr, 0, 0, -0.2, { rx: -11 }));
      b.group({ y: 1.74, z: -0.98, rx: 31 }, () => { b.box(0.8, 0.06, 3.3, c, 0, 0, 1.65); for (const s of [-1, 1]) b.box(0.07, 0.3, 3.3, mix(c, '#000000', 0.15), s * 0.43, 0, 1.65); });
      b.box(0.8, 0.06, 0.7, c, 0, 0.1, 2.15); for (const s of [-1, 1]) b.box(0.07, 0.24, 0.7, mix(c, '#000000', 0.15), s * 0.43, 0.1, 2.15);
      b.anchor('top', 0, 1.78, -1.45, 0); b.anchor('seat', 0, 0.92, 0.5, 0); b.anchor('seat2', 0, 0.18, 2.1, 0);
    },
  };
  G.swing = {
    label: '秋千', cls: 'street', solid: 'box', face: 'road', mainColor: 'color', nouns: ['秋千', '荡秋千', '秋千架', 'swing', 'swing set', 'swings'],
    params: { color: { d: '#d1483a', color: 1, pick: ['#d1483a', '#4f6fa8', '#6b8f4e', '#e8b04a'] } }, foot: () => [3.6, 2.4],
    build(b, p) {
      const c = p.color;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.tube([[sx * 1.7, 0, sz * 1.1], [sx * 1.6, 2.5, 0]], 0.055, c, {});
      b.cyl(0.055, 0.055, 3.3, c, -1.65, 2.5, 0, { rz: -90, sides: 8 });
      for (const s of [-1, 1]) { for (const k of [-1, 1]) b.cyl(0.012, 0.012, 1.95, '#8a8f96', s * 0.75 + k * 0.24, 0.55, 0, { sides: 4 }); b.box(0.56, 0.05, 0.22, '#2b2f36', s * 0.75, 0.52, 0); }
      b.anchor('seat', -0.75, 0.57, 0, 0); b.anchor('seat2', 0.75, 0.57, 0, 0);
    },
  };
  G.sandbox = {
    label: '沙坑', cls: 'ground', solid: false, face: 'none', flat: true, nouns: ['沙坑', '沙池', '沙箱', 'sandbox', 'sandpit', 'sand pit'], params: { size: { d: 2.6, min: 1, max: 20 } }, dims: { size: 'size', width: 'size' }, foot: (p) => [p.size * 2, p.size * 2],
    build(b, p, rand) { const s = p.size; b.box(s * 2, 0.1, s * 2, '#e3cf9c', 0, -0.02, 0, { tex: 'sand', noShadow: true }); for (const k of [-1, 1]) { b.box(s * 2 + 0.3, 0.26, 0.16, WOOD, 0, 0, k * s, { tex: 'wood' }); b.box(0.16, 0.26, s * 2 + 0.3, WOOD, k * s, 0, 0, { tex: 'wood' }); } b.cone(0.4, 0.36, '#d9c48c', s * 0.3, 0.06, -s * 0.2, { sides: 8 }); b.cone(0.26, 0.24, '#d9c48c', -s * 0.4, 0.06, s * 0.3, { sides: 8 }); b.cyl(0.13, 0.1, 0.2, '#d1483a', -s * 0.2, 0.08, -s * 0.5, { sides: 8 }); b.box(0.05, 0.32, 0.05, '#4f6fa8', s * 0.5, 0.08, s * 0.5, { rz: 24 }); b.sphere(0.16, '#f2c14e', s * 0.55, 0.22, -s * 0.55, { seg: 8 }); },
  };

  /* ================= farm ================= */
  G.barn = {
    label: '谷仓', cls: 'building', solid: 'box', face: 'road', mainColor: 'wall', nouns: ['谷仓', '粮仓', '仓房', '农舍', '牛棚', 'barn', 'farmhouse', 'stable'],
    params: { wall: { d: '#a8372b', color: 1 }, roofColor: { d: '#4a4f57', color: 1 } }, foot: () => [9.5, 12.5],
    build(b, p) {
      const w = 9, d = 12, H = 4.4, c = p.wall;
      b.box(w + 0.3, 0.3, d + 0.3, STONE, 0, 0, 0, { tex: 'stone' }); b.box(w, H, d, c, 0, 0.3, 0, { tex: 'wood' });
      const gp = (k) => [[-w / 2 * k, 0], [w / 2 * k, 0], [(w / 2 - 1.0) * k, 2.0 * k], [(w / 2 - 3.0) * k, 3.4 * k], [0, 3.9 * k], [(-w / 2 + 3.0) * k, 3.4 * k], [(-w / 2 + 1.0) * k, 2.0 * k]];
      b.extrude(gp(1.07), d + 0.7, p.roofColor, 0, H + 0.28, 0); for (const s of [-1, 1]) b.extrude(gp(0.97), 0.1, c, 0, H + 0.3, s * (d / 2 + 0.31));
      for (const s of [-1, 1]) b.box(1.7, 3.3, 0.1, mix(c, '#000000', 0.2), s * 0.9, 0.3, d / 2 + 0.02, { tex: 'wood' });
      b.box(3.7, 0.16, 0.14, TRIM, 0, 3.6, d / 2 + 0.03); for (const s of [-1, 1]) { b.box(0.16, 3.4, 0.14, TRIM, s * 1.85, 0.3, d / 2 + 0.03); b.group({ x: s * 0.9, y: 1.95, z: d / 2 + 0.09 }, () => { b.box(0.12, 3.6, 0.05, TRIM, 0, -1.8, 0, { rz: 27 }); b.box(0.12, 3.6, 0.05, TRIM, 0, -1.8, 0, { rz: -27 }); }); }
      b.box(1.2, 1.1, 0.1, GLASS, 0, H + 1.2, d / 2 + 0.02); b.box(1.4, 0.12, 0.14, TRIM, 0, H + 1.1, d / 2 + 0.03); b.box(1.4, 0.12, 0.14, TRIM, 0, H + 2.3, d / 2 + 0.03);
      b.cyl(0.03, 0.03, 0.8, IRON, 0, H + 4.2, 0); b.cone(0.14, 0.3, GOLD, 0.3, H + 5.0, 0, { rz: -90, sides: 4 }); b.box(0.6, 0.03, 0.03, IRON, 0, H + 4.98, 0);
    },
  };
  G.silo = { label: '筒仓', cls: 'building', solid: 'trunk', face: 'none', mainColor: 'color', nouns: ['筒仓', '粮筒', '饲料塔', 'silo', 'grain silo'], params: { height: { d: 9, min: 3, max: 60 }, color: { d: '#cfd4d8', color: 1 } }, dims: { height: 'height', size: 'height' }, foot: () => [3.6, 3.6],
    build(b, p) { const H = p.height; b.cyl(1.7, 1.7, 0.3, STONE, 0, 0, 0, { sides: 16 }); b.cyl(1.55, 1.55, H, p.color, 0, 0.3, 0, { sides: 18, metal: 0.45, rough: 0.5 }); for (let y = 1.2; y < H; y += 1.5) b.torus(1.57, 0.035, mix(p.color, '#000000', 0.25), 0, 0.3 + y, 0, { rx: 90, sides: 18 }); b.sphere(1.58, mix(p.color, '#ffffff', 0.15), 0, 0.3 + H, 0, { sy: 0.5, seg: 16, metal: 0.45, rough: 0.5 }); b.box(0.08, H, 0.4, IRON, 0, 0.3, 1.6); for (let y = 0.5; y < H; y += 0.4) b.box(0.4, 0.03, 0.05, IRON, 0, 0.3 + y, 1.75); } };
  G.haystack = { label: '草垛', cls: 'nature', solid: 'trunk', face: 'random', nouns: ['草垛', '干草堆', '草堆', '草卷', '干草', 'haystack', 'hay bale', 'hay'], params: { size: { d: 1, min: 0.3, max: 12 }, kind: { d: 'roll', opts: ['roll', 'stack', 'bale'], pick: ['roll', 'roll', 'bale'] } }, dims: { size: 'size', height: 'size' }, foot: (p) => [1.6 * p.size, 1.6 * p.size],
    build(b, p) { const c = '#dcbb5c', d = '#c4a24a'; b.group({ scale: p.size }, () => { if (p.kind === 'stack') { b.cyl(0.5, 1.05, 1.7, c, 0, 0, 0, { sides: 9, flat: true }); b.cone(0.6, 0.6, d, 0, 1.6, 0, { sides: 9, flat: true }); } else if (p.kind === 'bale') { b.box(1.3, 0.6, 0.7, c, 0, 0, 0, { flat: true }); for (const s of [-0.35, 0.35]) b.box(0.03, 0.62, 0.72, '#8a6a48', s, 0, 0); } else { b.cyl(0.7, 0.7, 1.2, c, -0.6, 0.7, 0, { rz: -90, sides: 14 }); for (const r of [0.5, 0.3]) b.torus(r, 0.02, d, 0.61, 0.7, 0, { ry: 90, sides: 14 }); } }); } };
  G.scarecrow = { label: '稻草人', cls: 'street', solid: 'trunk', face: 'me', nouns: ['稻草人', 'scarecrow'], params: { shirt: { d: '#b5533c', color: 1, pick: ['#b5533c', '#4f6fa8', '#6b8f4e'] } }, foot: () => [1.6, 0.6],
    build(b, p) { b.cyl(0.04, 0.05, 2.0, DARKWOOD, 0, 0, 0, { sides: 6 }); b.cyl(0.035, 0.035, 1.7, DARKWOOD, -0.85, 1.42, 0, { rz: -90, sides: 6 }); b.box(0.5, 0.7, 0.22, p.shirt, 0, 0.95, 0, { flat: true }); for (const s of [-1, 1]) { b.box(0.62, 0.2, 0.2, p.shirt, s * 0.52, 1.33, 0); b.cone(0.1, 0.22, '#dcbb5c', s * 0.92, 1.42, 0, { rz: s * 90, sides: 6 }); } b.sphere(0.2, '#e3cf9c', 0, 1.9, 0, { seg: 8 }); b.cone(0.3, 0.3, '#8a6a48', 0, 2.02, 0, { sides: 10 }); b.cyl(0.4, 0.4, 0.03, '#8a6a48', 0, 2.02, 0, { sides: 12 }); for (const s of [-1, 1]) b.sphere(0.025, '#2b2b2b', s * 0.07, 1.93, 0.18); b.cone(0.03, 0.1, '#e8862e', 0, 1.88, 0.2, { rx: 90, sides: 5 }); b.cone(0.16, 0.2, '#dcbb5c', 0, 0.76, 0, { rx: 180, sides: 7 }); } };

  /* ================= on the water ================= */
  G.duck = {
    label: '鸭子', cls: 'creature', solid: false, face: 'random', motion: 'wander', speed: 0.7, block: false, mainColor: 'color', floats: true,
    nouns: ['鸭子', '小鸭', '鸭', '小鸭子', '野鸭', '天鹅', 'duck', 'duckling', 'swan'], params: { color: { d: '#fbf8ef', color: 1, pick: ['#fbf8ef', '#fbf8ef', '#8a6a48', '#f2c230'] }, size: { d: 1, min: 0.3, max: 30 } }, dims: { size: 'size', height: 'size', width: 'size' },
    build(b, p) { const c = p.color; b.group({ scale: p.size, anim: { bob: { amp: 0.015, freq: 0.6 } } }, () => { b.sphere(0.2, c, 0, 0.13, 0, { sz: 1.5, sy: 0.72, seg: 9 }); b.cone(0.1, 0.2, c, 0, 0.14, -0.3, { rx: -70, sides: 6 }); b.cyl(0.055, 0.07, 0.18, c, 0, 0.2, 0.2, { sides: 7 }); b.sphere(0.085, c, 0, 0.41, 0.22, { seg: 8 }); b.box(0.07, 0.03, 0.11, '#e8862e', 0, 0.38, 0.33); for (const s of [-1, 1]) { b.sphere(0.014, '#1b1b1b', s * 0.06, 0.43, 0.27); b.sphere(0.12, mix(c, '#000000', 0.08), s * 0.15, 0.16, -0.02, { sz: 1.5, sy: 0.6, sx: 0.4, seg: 7 }); } }); },
  };
  G.boat = {
    label: '小船', cls: 'street', solid: false, face: 'random', mainColor: 'color', floats: true, nouns: ['小船', '船', '帆船', '划艇', '木船', '渔船', 'boat', 'sailboat', 'rowboat', 'dinghy', 'ship'],
    params: { color: { d: '#f4f1ea', color: 1, pick: ['#f4f1ea', '#d1483a', '#2f6f73', '#4f6fa8', '#d9a441'] }, kind: { d: 'sail', opts: ['sail', 'row'], pick: ['sail', 'sail', 'row'] }, size: { d: 1, min: 0.3, max: 20 } }, dims: { size: 'size', height: 'size', width: 'size' }, foot: (p) => [1.5 * p.size, 3.6 * p.size],
    build(b, p) { const c = p.color; b.group({ scale: p.size, anim: { swing: { axis: 'z', deg: 2.5, freq: 0.22 } } }, () => {
      b.extrude([[-1.7, 0], [1.2, 0], [1.75, 0.5], [-1.7, 0.5]], 1.1, c, 0, 0.02, 0, { ry: -90 }); b.box(1.0, 0.06, 3.0, mix(c, '#000000', 0.2), 0, 0.5, -0.1); b.box(0.9, 0.05, 2.8, WOOD, 0, 0.3, -0.1, { tex: 'wood' }); for (const z of [-0.9, 0.3]) b.box(0.96, 0.05, 0.26, WOOD, 0, 0.42, z, { tex: 'wood' });
      if (p.kind === 'sail') { b.cyl(0.035, 0.045, 3.4, DARKWOOD, 0, 0.3, 0.3, { sides: 6 }); b.extrude([[0, 0], [1.7, 0], [0, 2.7]], 0.02, '#fbf8ef', 0, 0.85, 0.26, { ry: 90 }); b.extrude([[0, 0], [-1.0, 0], [0, 2.0]], 0.02, mix(c, '#fbf8ef', 0.5), 0, 0.95, 0.36, { ry: 90 }); b.cyl(0.02, 0.02, 1.8, DARKWOOD, 0, 0.85, 0.3, { rx: -90, sides: 5 }); b.box(0.3, 0.2, 0.01, '#d1483a', 0.15, 3.5, 0.3); }
      else for (const s of [-1, 1]) b.group({ x: s * 0.5, y: 0.52, z: -0.2, rz: s * 70, ry: s * 12 }, () => { b.cyl(0.02, 0.02, 1.6, WOOD, 0, -0.5, 0, { sides: 5 }); b.box(0.16, 0.4, 0.02, WOOD, 0, 1.1, 0); });
      b.anchor('seat', 0, 0.47, -0.9, 0); b.anchor('seat2', 0, 0.47, 0.3, 0);
    }); },
  };
  G.pier = { label: '栈桥', cls: 'street', solid: false, face: 'none', flat: true, block: false, nouns: ['栈桥', '码头', '木栈道', '栈道', '栈台', 'pier', 'dock', 'jetty', 'boardwalk'], params: { length: { d: 9, min: 2, max: 120 }, width: { d: 2.2, min: 1, max: 12 } }, dims: { size: 'length', width: 'width' }, foot: (p) => [p.width, p.length],
    build(b, p) { const L = p.length, W = p.width, n = Math.round(L / 0.42); for (let i = 0; i < n; i++) b.box(W, 0.06, 0.36, i % 3 ? '#a07a50' : '#8f6c46', 0, 0.38, -L / 2 + (i + 0.5) * (L / n), { tex: 'wood' }); for (const s of [-1, 1]) { b.box(0.1, 0.1, L, DARKWOOD, s * (W / 2 - 0.1), 0.28, 0); for (let z = -L / 2 + 0.4; z <= L / 2; z += 2.2) { b.cyl(0.1, 0.11, 1.5, DARKWOOD, s * (W / 2 - 0.1), -0.5, z, { sides: 7 }); } } for (const s of [-1, 1]) { b.cyl(0.1, 0.11, 1.5, DARKWOOD, s * (W / 2 - 0.1), -0.2, L / 2 - 0.2, { sides: 7 }); b.torus(0.13, 0.03, '#d9cfb8', s * (W / 2 - 0.1), 1.0, L / 2 - 0.2, { rx: 90, sides: 8 }); } b.anchor('top', 0, 0.44, L / 2 - 1, 0); } };
  G.bridge = {
    label: '小桥', cls: 'street', solid: false, face: 'none', block: false, mainColor: 'color', nouns: ['小桥', '桥', '拱桥', '石桥', '木桥', 'bridge', 'footbridge', 'arch bridge'],
    params: { length: { d: 9, min: 3, max: 120 }, width: { d: 2.6, min: 1, max: 20 }, color: { d: '#b9b3a6', color: 1 } }, dims: { size: 'length', width: 'width' }, foot: (p) => [p.width, p.length],
    build(b, p) { const L = p.length, W = p.width, n = 9, rise = Math.min(1.5, L * 0.14), c = p.color, dk = mix(c, '#000000', 0.2);
      for (let i = 0; i < n; i++) { const t0 = i / n - 0.5, t1 = (i + 1) / n - 0.5, y0 = rise * (1 - 4 * t0 * t0), y1 = rise * (1 - 4 * t1 * t1), z = (t0 + t1) / 2 * L, seg = L / n, ang = Math.atan2(y1 - y0, seg) * 57.3, y = (y0 + y1) / 2;
        b.group({ y: y + 0.12, z, rx: -ang }, () => { b.box(W, 0.22, seg + 0.06, c, 0, -0.11, 0, { tex: 'stone' }); for (const s of [-1, 1]) { b.box(0.22, 0.7, seg + 0.06, c, s * (W / 2 - 0.11), 0.1, 0, { tex: 'stone' }); b.box(0.3, 0.1, seg + 0.08, dk, s * (W / 2 - 0.11), 0.8, 0); } }); }
      for (const s of [-1, 1]) { b.box(W + 0.5, 0.9, 0.7, dk, 0, -0.4, s * (L / 2 - 0.2), { tex: 'stone' }); for (const k of [-1, 1]) { b.box(0.36, 1.1, 0.36, c, k * (W / 2 - 0.11), 0.1, s * (L / 2 - 0.1), { tex: 'stone' }); b.sphere(0.2, dk, k * (W / 2 - 0.11), 1.32, s * (L / 2 - 0.1), { seg: 8 }); } }
      b.anchor('top', 0, rise + 0.26, 0, 0); },
  };

  /* ================= light and warmth ================= */
  G.stringlights = {
    label: '串灯', cls: 'street', solid: false, face: 'none', block: false, mainColor: 'color', nouns: ['串灯', '彩灯', '灯串', '小彩灯', '灯带', 'string lights', 'fairy lights', 'festoon lights', 'party lights'],
    params: { length: { d: 10, min: 2, max: 80 }, height: { d: 3.6, min: 1.5, max: 14 }, color: { d: '#ffd98a', color: 1 } }, dims: { size: 'length', width: 'length', height: 'height' }, foot: (p) => [p.length, 0.3],
    build(b, p) { const L = p.length, H = p.height, n = Math.max(6, Math.round(L / 0.7)), sag = Math.min(0.9, L * 0.07), pts = []; for (const s of [-1, 1]) { b.cyl(0.04, 0.06, H + 0.1, IRON, s * L / 2, 0, 0, { sides: 6 }); b.cyl(0.14, 0.18, 0.1, IRON, s * L / 2, 0, 0, { sides: 8 }); }
      for (let i = 0; i <= n; i++) { const t = i / n - 0.5, y = H - sag * (1 - 4 * t * t); pts.push([t * L, y, 0]); if (i > 0 && i < n) b.sphere(0.075, p.color, t * L, y - 0.1, 0, { seg: 6, glow: p.color, glowK: 1.4, unlit: true }); }
      b.tube(pts, 0.012, '#1b1b1b', {}); },
  };
  G.campfire = { label: '篝火', cls: 'street', solid: false, face: 'none', nouns: ['篝火', '营火', '火堆', 'campfire', 'bonfire', 'camp fire'], params: { size: { d: 1, min: 0.3, max: 10 } }, dims: { size: 'size', height: 'size' }, foot: (p) => [1.4 * p.size, 1.4 * p.size],
    build(b, p, rand) { b.group({ scale: p.size }, () => { for (let i = 0; i < 9; i++) b.sphere(0.13 + rand() * 0.05, mix('#8f8b84', '#5f5b55', rand()), Math.sin(i * 0.698) * 0.55, 0.06, Math.cos(i * 0.698) * 0.55, { seg: 5, flat: true }); for (let i = 0; i < 4; i++) b.group({ ry: i * 45 }, () => b.cyl(0.07, 0.08, 0.9, DARKWOOD, -0.45, 0.12, 0, { rz: -72, sides: 6 }));
      for (let i = 0; i < 3; i++) b.group({ anim: { pulse: { amp: 0.22, freq: 1.6 + i * 0.5, phase: i * 2 } } }, () => b.cone(0.3 - i * 0.08, 0.75 - i * 0.14, ['#ff8a2a', '#ffb53a', '#ffe38a'][i], (i - 1) * 0.06, 0.1, i === 1 ? 0.05 : -0.03, { sides: 6, glow: ['#ff8a2a', '#ffb53a', '#ffe38a'][i], glowK: 1.8, unlit: true })); b.halo(3.2, '#ffb060', 0, 0.6, 0); }); } };

  const EN = { path: 'Path', plaza: 'Plaza', field: 'Field', hedge: 'Hedge', planter: 'Planter', stall: 'Market stall', cart: 'Cart', clocktower: 'Clock tower', windmill: 'Windmill', lighthouse: 'Lighthouse', ferriswheel: 'Ferris wheel', church: 'Church', statue: 'Statue', well: 'Well', slide: 'Slide', swing: 'Swing', sandbox: 'Sandbox', barn: 'Barn', silo: 'Silo', haystack: 'Haystack', scarecrow: 'Scarecrow', duck: 'Duck', boat: 'Boat', pier: 'Pier', bridge: 'Bridge', stringlights: 'String lights', campfire: 'Campfire' };
  for (const k in EN) if (G[k]) G[k].en = EN[k];
  for (const k of ['field', 'plaza', 'path', 'campfire', 'haystack', 'sandbox', 'hedge']) if (G[k]) G[k].mass = true; // one of these is already a patch, a pile or a stretch
  // particular kinds people ask for by name
  const KINDS = [['wheat field', 'field', { crop: 'wheat' }], ['tulip field', 'field', { crop: 'tulip' }], ['lavender field', 'field', { crop: 'lavender' }], ['sunflower field', 'field', { crop: 'sunflower' }], ['corn field', 'field', { crop: 'corn' }], ['cornfield', 'field', { crop: 'corn' }], ['vegetable garden', 'field', { crop: 'vegetable', width: 8, depth: 6 }], ['vegetable patch', 'field', { crop: 'vegetable', width: 8, depth: 6 }], ['flower field', 'field', { crop: 'tulip' }], ['meadow', 'field', { crop: 'meadow' }],
    ['麦田', 'field', { crop: 'wheat' }], ['郁金香田', 'field', { crop: 'tulip' }], ['花田', 'field', { crop: 'tulip' }], ['薰衣草田', 'field', { crop: 'lavender' }], ['向日葵田', 'field', { crop: 'sunflower' }], ['玉米地', 'field', { crop: 'corn' }], ['菜地', 'field', { crop: 'vegetable', width: 8, depth: 6 }], ['菜园', 'field', { crop: 'vegetable', width: 8, depth: 6 }], ['草甸', 'field', { crop: 'meadow' }],
    ['sailboat', 'boat', { kind: 'sail' }], ['sailing boat', 'boat', { kind: 'sail' }], ['rowboat', 'boat', { kind: 'row' }], ['rowing boat', 'boat', { kind: 'row' }], ['帆船', 'boat', { kind: 'sail' }], ['划艇', 'boat', { kind: 'row' }], ['小木船', 'boat', { kind: 'row' }],
    ['fruit stall', 'stall', { goods: 'fruit' }], ['fruit stand', 'stall', { goods: 'fruit' }], ['flower stall', 'stall', { goods: 'flowers' }], ['flower stand', 'stall', { goods: 'flowers' }], ['bread stall', 'stall', { goods: 'bread' }], ['bakery stall', 'stall', { goods: 'bread' }], ['fish stall', 'stall', { goods: 'fish' }], ['book stall', 'stall', { goods: 'books' }], ['vegetable stall', 'stall', { goods: 'vegetables' }],
    ['水果摊', 'stall', { goods: 'fruit' }], ['花摊', 'stall', { goods: 'flowers' }], ['面包摊', 'stall', { goods: 'bread' }], ['鱼摊', 'stall', { goods: 'fish' }], ['书摊', 'stall', { goods: 'books' }], ['菜摊', 'stall', { goods: 'vegetables' }],
    ['swan', 'duck', { color: '#fbf8ef', size: 1.7 }], ['duckling', 'duck', { color: '#f2c230', size: 0.5 }], ['天鹅', 'duck', { color: '#fbf8ef', size: 1.7 }], ['小鸭子', 'duck', { color: '#f2c230', size: 0.5 }], ['小鸭', 'duck', { color: '#f2c230', size: 0.5 }],
    ['hay bale', 'haystack', { kind: 'bale' }], ['草卷', 'haystack', { kind: 'roll' }], ['stepping stones', 'path', { kind: 'steps' }], ['gravel path', 'path', { kind: 'gravel' }], ['dirt path', 'path', { kind: 'dirt' }], ['dirt track', 'path', { kind: 'dirt' }], ['brick path', 'path', { kind: 'brick' }], ['wooden path', 'path', { kind: 'wood' }], ['汀步', 'path', { kind: 'steps' }], ['踏脚石', 'path', { kind: 'steps' }], ['石子路', 'path', { kind: 'gravel' }], ['土路', 'path', { kind: 'dirt' }]];
  const build0 = YX.buildNouns;
  YX.buildNouns = function () { build0(); const own = new Set(KINDS.map((k) => k[0])); YX.NOUNS = YX.NOUNS.filter((n) => !own.has(n.w)); for (const [w, type, params] of KINDS) { YX.NOUNS.push({ w, type, params }); if (/^[a-z0-9 ']+$/.test(w)) YX.EN_NOUNS.set(w, { type, params, fam: null, w }); } YX.NOUNS.sort((a, c) => c.w.length - a.w.length); };
  YX.buildNouns();
})();
