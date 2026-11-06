(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.NavalScene = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  // Original procedural ship models. Everything is projected from real 3D
  // vertices into a Canvas surface, so the ocean view also works without WebGL.
  var TYPES = ['carrier', 'battleship', 'cruiser', 'submarine', 'patrol'];
  var PALETTES = {
    navy: { hull: '#617c91', deck: '#a5afb0', metal: '#869ca9', high: '#bfced1', dark: '#324b60', glass: '#183d52', line: '#deebeb', paint: '#e6bc76', stripe: '#e59e60' },
    arctic: { hull: '#acbbc6', deck: '#c9cecb', metal: '#c4d1d6', high: '#ecf0e9', dark: '#627e94', glass: '#2b5a70', line: '#f1f2e9', paint: '#eab46b', stripe: '#5c879b' },
    copper: { hull: '#876f63', deck: '#b9a48a', metal: '#ad9381', high: '#e0c4a1', dark: '#4f5b61', glass: '#1e4455', line: '#f0d5ad', paint: '#f2c56e', stripe: '#5aa1a0' }
  };
  var svgSerial = 0;
  var meshCache = Object.create(null);
  var TAU = Math.PI * 2;
  var clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  var mix = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  var timeNow = function () { return root.performance && root.performance.now ? root.performance.now() : Date.now(); };

  function typeName(value) {
    var key = String(value === undefined ? 'battleship' : value).toLowerCase();
    var index = /^ship-([0-4])$/.exec(key);
    if (index) return TYPES[Number(index[1])];
    if (/carrier|aircraft/.test(key)) return 'carrier';
    if (/sub/.test(key)) return 'submarine';
    if (/patrol|boat/.test(key)) return 'patrol';
    if (/cruiser|destroyer/.test(key)) return 'cruiser';
    return 'battleship';
  }
  function paletteFor(key) { return PALETTES[key] || PALETTES.navy; }
  function rgb(hex) { return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]; }
  function shade(hex, multiplier) {
    var c = rgb(hex);
    return 'rgb(' + c.map(function (n) { return Math.round(clamp(n * multiplier, 0, 255)); }).join(',') + ')';
  }
  function seeded(index, salt) {
    var x = Math.sin(index * 127.1 + (salt || 0) * 311.7) * 43758.5453123;
    return x - Math.floor(x);
  }
  function v(x, y, z) { return [x, y, z]; }

  function Mesh() { this.items = []; }
  function clipPlane(points, axis, value, above) {
    var result = [];
    for (var i = 0; i < points.length; i++) {
      var a = points[i], b = points[(i + 1) % points.length];
      var ain = above ? a[axis] >= value : a[axis] <= value;
      var bin = above ? b[axis] >= value : b[axis] <= value;
      if (ain) result.push(a);
      if (ain !== bin) {
        var t = (value - a[axis]) / (b[axis] - a[axis]);
        result.push([mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]);
      }
    }
    return result;
  }
  Mesh.prototype.poly = function (points, material, options) {
    // Small planar tiles keep the painter's order correct for fittings resting
    // on long decks. A single 500-unit deck would incorrectly cover its guns.
    var xs = points.map(function (p) { return p[0]; }), zs = points.map(function (p) { return p[2]; });
    var x0 = Math.min.apply(Math, xs), x1 = Math.max.apply(Math, xs);
    var z0 = Math.min.apply(Math, zs), z1 = Math.max.apply(Math, zs);
    var nx = Math.max(1, Math.ceil((x1 - x0) / 28)), nz = Math.max(1, Math.ceil((z1 - z0) / 28));
    for (var ix = 0; ix < nx; ix++) {
      var strip = points;
      if (nx > 1) { strip = clipPlane(strip, 0, mix(x0, x1, ix / nx), true); strip = clipPlane(strip, 0, mix(x0, x1, (ix + 1) / nx), false); }
      for (var iz = 0; iz < nz; iz++) {
        var tile = strip;
        if (nz > 1) { tile = clipPlane(tile, 2, mix(z0, z1, iz / nz), true); tile = clipPlane(tile, 2, mix(z0, z1, (iz + 1) / nz), false); }
        if (tile.length > 2) this.items.push(Object.assign({ p: tile, material: material, kind: 'face' }, options || {}));
      }
    }
  };
  Mesh.prototype.line = function (points, material, width, alpha) {
    for (var i = 0; i < points.length - 1; i++) {
      var a = points[i], b = points[i + 1], count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 24));
      for (var j = 0; j < count; j++) {
        var from = a.map(function (n, k) { return mix(n, b[k], j / count); });
        var to = a.map(function (n, k) { return mix(n, b[k], (j + 1) / count); });
        this.items.push({ p: [from, to], material: material, kind: 'line', width: width || 1, alpha: alpha === undefined ? 1 : alpha });
      }
    }
  };
  Mesh.prototype.prism = function (outline, bottom, top, material, topMaterial) {
    var self = this;
    outline.forEach(function (point, i) {
      var next = outline[(i + 1) % outline.length];
      self.poly([v(point[0], bottom, point[1]), v(next[0], bottom, next[1]), v(next[0], top, next[1]), v(point[0], top, point[1])], material);
    });
    this.poly(outline.map(function (point) { return v(point[0], top, point[1]); }), topMaterial || material, { top: true });
  };
  Mesh.prototype.box = function (x, z, width, depth, bottom, height, material, topMaterial, taper) {
    var w = width / 2, d = depth / 2, t = taper || 0, top = bottom + height;
    var lower = [[x - w, z - d], [x - w, z + d], [x + w, z + d], [x + w, z - d]];
    var upper = [[x - w + t, z - d + t], [x - w + t, z + d - t], [x + w - t, z + d - t], [x + w - t, z - d + t]];
    for (var i = 0; i < 4; i++) {
      var j = (i + 1) % 4;
      this.poly([v(lower[i][0], bottom, lower[i][1]), v(lower[j][0], bottom, lower[j][1]), v(upper[j][0], top, upper[j][1]), v(upper[i][0], top, upper[i][1])], material);
    }
    this.poly(upper.map(function (p) { return v(p[0], top, p[1]); }), topMaterial || material, { top: true });
  };
  Mesh.prototype.cylinder = function (x, z, radius, bottom, height, material, topMaterial, segments) {
    var outline = [], count = segments || 10;
    for (var i = 0; i < count; i++) {
      var angle = TAU * i / count;
      outline.push([x + Math.cos(angle) * radius, z + Math.sin(angle) * radius]);
    }
    this.prism(outline.reverse(), bottom, bottom + height, material, topMaterial);
  };
  Mesh.prototype.barrel = function (x, y, z, length, radius, direction, material) {
    var n = 6, from = [], to = [], dx = Math.cos(direction), dz = Math.sin(direction), px = -dz, pz = dx;
    for (var i = 0; i < n; i++) {
      var angle = TAU * i / n, ry = Math.cos(angle) * radius, rr = Math.sin(angle) * radius;
      from.push(v(x + px * rr, y + ry, z + pz * rr));
      to.push(v(x + dx * length + px * rr, y + ry + length * .035, z + dz * length + pz * rr));
    }
    for (var j = 0; j < n; j++) this.poly([from[j], to[j], to[(j + 1) % n], from[(j + 1) % n]], material);
    this.poly(to, 'dark');
  };

  function hull(mesh, length, width, deckHeight) {
    var sections = [[-.5, .34], [-.43, .48], [-.2, .5], [.12, .48], [.3, .39], [.42, .25], [.485, .07], [.505, 0]];
    var outline = [];
    sections.forEach(function (p) { outline.push([p[0] * length, -p[1] * width]); });
    sections.slice().reverse().forEach(function (p) { outline.push([p[0] * length, p[1] * width]); });
    for (var i = 0; i < outline.length; i++) {
      var a = outline[i], b = outline[(i + 1) % outline.length];
      mesh.poly([v(a[0] * .985, -.5, a[1] * .80), v(b[0] * .985, -.5, b[1] * .80), v(b[0], deckHeight, b[1]), v(a[0], deckHeight, a[1])], 'hull');
      mesh.poly([v(a[0] * .988, 1.4, a[1] * .82), v(b[0] * .988, 1.4, b[1] * .82), v(b[0] * .989, 4.5, b[1] * .845), v(a[0] * .989, 4.5, a[1] * .845)], 'dark');
    }
    mesh.poly(outline.map(function (p) { return v(p[0], deckHeight, p[1]); }), 'deck', { top: true });
    mesh.line(outline.map(function (p) { return v(p[0], deckHeight + .8, p[1]); }).concat([v(outline[0][0], deckHeight + .8, outline[0][1])]), 'high', 1.15, .8);
    return outline;
  }
  function railings(mesh, outline, height, detail) {
    var ring = outline.map(function (p) { return v(p[0], height + 7, p[1]); });
    mesh.line(ring.concat([ring[0]]), 'line', .65, .8);
    if (!detail) return;
    for (var i = 0; i < outline.length; i++) {
      var a = outline[i], b = outline[(i + 1) % outline.length];
      var count = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 24);
      for (var j = 0; j < count; j++) {
        var x = mix(a[0], b[0], j / count), z = mix(a[1], b[1], j / count);
        mesh.line([v(x, height + .8, z), v(x, height + 7, z)], 'line', .5, .65);
      }
    }
  }
  function windows(mesh, x, z, width, depth, y, height) {
    var x1 = x - width / 2, x2 = x + width / 2, z1 = z - depth / 2, z2 = z + depth / 2;
    mesh.poly([v(x2 + .15, y, z1 + 2), v(x2 + .15, y, z2 - 2), v(x2 + .15, y + height, z2 - 2), v(x2 + .15, y + height, z1 + 2)], 'glass', { luminous: true });
    [-1, 1].forEach(function (side) {
      var zz = z + depth / 2 * side + .15 * side;
      mesh.poly([v(x1 + 2, y, zz), v(x2 - 2, y, zz), v(x2 - 2, y + height, zz), v(x1 + 2, y + height, zz)], 'glass', { luminous: true });
      var count = Math.max(2, Math.floor(width / 8));
      for (var i = 1; i < count; i++) {
        var xx = mix(x1 + 2, x2 - 2, i / count);
        mesh.line([v(xx, y, zz + .15 * side), v(xx, y + height, zz + .15 * side)], 'high', .65, .9);
      }
    });
  }
  function turret(mesh, x, z, y, scale, direction, barrels, detail) {
    var r = 15 * scale;
    mesh.cylinder(x, z, r * 1.15, y, 4 * scale, 'dark', 'metal', detail ? 12 : 8);
    var outline = [[-15, -12], [-15, 12], [5, 14], [18, 8], [18, -8], [5, -14]].map(function (p) {
      var xx = p[0] * scale, zz = p[1] * scale;
      return [x + xx * Math.cos(direction) - zz * Math.sin(direction), z + xx * Math.sin(direction) + zz * Math.cos(direction)];
    });
    mesh.prism(outline, y + 4 * scale, y + 15 * scale, 'metal', 'high');
    var count = barrels || 2;
    for (var i = 0; i < count; i++) {
      var across = (i - (count - 1) / 2) * 6 * scale;
      mesh.barrel(x + Math.cos(direction) * 13 * scale - Math.sin(direction) * across, y + 11 * scale, z + Math.sin(direction) * 13 * scale + Math.cos(direction) * across, 42 * scale, 2.25 * scale, direction, 'metal');
    }
    if (detail) mesh.line([v(x - 8 * scale, y + 15.4 * scale, z), v(x + 10 * scale, y + 15.4 * scale, z)], 'line', .7, .5);
  }
  function mast(mesh, x, z, bottom, height, scale, detail) {
    mesh.cylinder(x, z, 2.1 * scale, bottom, height, 'dark', 'high', 6);
    mesh.box(x, z, 23 * scale, 2.8 * scale, bottom + height * .63, 3 * scale, 'metal', 'high');
    mesh.box(x, z, 14 * scale, 2.5 * scale, bottom + height * .84, 2.4 * scale, 'metal', 'high');
    mesh.line([v(x, bottom + height, z), v(x, bottom + height + 15 * scale, z)], 'high', 1, .9);
    if (detail) {
      mesh.line([v(x - 12 * scale, bottom, z - 8 * scale), v(x, bottom + height * .70, z), v(x + 12 * scale, bottom, z + 8 * scale)], 'line', .5, .4);
      mesh.line([v(x, bottom + height * .63, z - 19 * scale), v(x, bottom + height * .63, z + 19 * scale)], 'high', .8, .8);
    }
    // The radar antenna is a faceted tilted panel, with visible supports.
    mesh.poly([v(x - 13 * scale, bottom + height * .76, z + 1), v(x + 13 * scale, bottom + height * .76, z + 1), v(x + 11 * scale, bottom + height * .92, z - 4 * scale), v(x - 11 * scale, bottom + height * .92, z - 4 * scale)], 'dark');
    mesh.line([v(x - 12 * scale, bottom + height * .80, z), v(x + 12 * scale, bottom + height * .80, z)], 'metal', .7, .8);
  }
  function helicopterPad(mesh, x, y, z, radius) {
    var circle = [];
    for (var i = 0; i <= 28; i++) circle.push(v(x + Math.cos(i / 28 * TAU) * radius, y, z + Math.sin(i / 28 * TAU) * radius));
    mesh.line(circle, 'line', 1.1, .75);
    mesh.line([v(x - 9, y, z - 8), v(x - 9, y, z + 8)], 'line', 1.8, .8);
    mesh.line([v(x + 9, y, z - 8), v(x + 9, y, z + 8)], 'line', 1.8, .8);
    mesh.line([v(x - 9, y, z), v(x + 9, y, z)], 'line', 1.8, .8);
  }
  function detailsAlongDeck(mesh, length, width, y, detail) {
    var p;
    for (var side = -1; side <= 1; side += 2) {
      for (var i = 0; i < (detail ? 8 : 4); i++) {
        var x = (-.35 + i / (detail ? 7 : 3) * .58) * length;
        var z = side * width * .37;
        mesh.box(x, z, 9, 5, y, 5, 'metal', 'high');
        if (detail) {
          mesh.line([v(x - 3, y + 6, z), v(x + 3, y + 6, z)], 'dark', 1, 1);
          mesh.box(x, side * width * .45, 3, 1.8, y - 10, 1.7, 'dark', 'dark');
        }
      }
    }
    if (detail) {
      for (var j = 0; j < 7; j++) {
        p = -.4 * length + j * length * .115;
        mesh.line([v(p, y + .2, -width * .40), v(p, y + .2, width * .40)], 'dark', .4, .18);
      }
    }
  }
  function makeWarship(type, detail) {
    var mesh = new Mesh(), isCruiser = type === 'cruiser', length = isCruiser ? 374 : 490, width = isCruiser ? 66 : 88, deck = isCruiser ? 22 : 28;
    var outline = hull(mesh, length, width, deck);
    var front = [[length * .12, -width * .40], [length * .12, width * .40], [length * .30, width * .34], [length * .43, width * .20], [length * .485, 0], [length * .43, -width * .20], [length * .30, -width * .34]];
    mesh.prism(front, deck, deck + 4, 'metal', 'deck');
    detailsAlongDeck(mesh, length, width, deck + .3, detail);
    railings(mesh, outline, deck, detail);
    turret(mesh, length * .32, 0, deck + 5, isCruiser ? .82 : 1.15, 0, isCruiser ? 2 : 3, detail);
    if (!isCruiser) turret(mesh, length * .16, 0, deck + 9, 1.05, 0, 3, detail);
    turret(mesh, -length * .32, 0, deck + 1, isCruiser ? .74 : 1.0, Math.PI, isCruiser ? 2 : 3, detail);
    mesh.box(-20, 0, isCruiser ? 125 : 154, width * .55, deck + .2, 18, 'metal', 'deck', 2);
    mesh.box(10, 0, isCruiser ? 55 : 62, width * .44, deck + 18, 18, 'hull', 'metal', 3);
    mesh.box(22, 0, isCruiser ? 39 : 48, width * .50, deck + 35, 11, 'high', 'metal', 1);
    windows(mesh, 22, 0, isCruiser ? 38 : 47, width * .49, deck + 39, 4.5);
    mesh.box(17, 0, 28, width * .35, deck + 46, 6, 'metal', 'high');
    mesh.cylinder(12, 0, 7, deck + 52, 7, 'metal', 'high', 10);
    mast(mesh, 6, 0, deck + 58, isCruiser ? 42 : 52, 1, detail);
    // Two angled funnels, their dark caps and pale heat shields.
    [-44, -78].forEach(function (x, i) {
      if (isCruiser && i) return;
      mesh.box(x, 0, 22, 23, deck + 18, 25 - i * 5, 'hull', 'dark', 3);
      mesh.box(x + 1, 0, 17, 18, deck + 42 - i * 5, 4, 'dark', 'dark');
      mesh.line([v(x - 10, deck + 29, -11), v(x + 10, deck + 29, -11)], 'high', 1.1, .7);
    });
    [-1, 1].forEach(function (side) {
      turret(mesh, -4, side * width * .36, deck + 1, .48, side * .65, 2, false);
      turret(mesh, -length * .20, side * width * .34, deck + 1, .44, Math.PI - side * .6, 2, false);
      // Lifeboats have their own curved, extruded hull and pale interior.
      mesh.prism([[-63, side * (width * .31 - 4)], [-42, side * (width * .31 - 4)], [-38, side * width * .31], [-42, side * (width * .31 + 4)], [-63, side * (width * .31 + 4)], [-69, side * width * .31]], deck + 18, deck + 24, 'dark', 'high');
      mesh.line([v(-68, deck + 18, side * width * .31), v(-68, deck + 31, side * width * .34), v(-39, deck + 31, side * width * .34), v(-39, deck + 18, side * width * .31)], 'metal', 1.2, .9);
    });
    helicopterPad(mesh, -length * .44, deck + .6, 0, width * .20);
    if (detail) {
      // Foredeck chains and small winches keep the bow from reading as a box.
      [-1, 1].forEach(function (side) {
        mesh.line([v(length * .35, deck + 4.8, side * 10), v(length * .445, deck + 4.8, side * 6)], 'dark', 2.1, .65);
        mesh.cylinder(length * .38, side * 10, 3, deck + 5, 3, 'metal', 'dark', 6);
      });
      mesh.box(-100, 0, 26, 26, deck, 11, 'metal', 'deck');
      mast(mesh, -105, 0, deck + 11, 42, .70, false);
      mesh.line([v(6, deck + 94, 0), v(-105, deck + 46, 0)], 'dark', .6, .55);
    }
    return { mesh: mesh, length: length, width: width, height: deck + 125 };
  }
  function jet(mesh, x, z, y, angle, scale) {
    var c = Math.cos(angle), s = Math.sin(angle);
    var point = function (xx, yy, zz) { return v(x + (xx * c - zz * s) * scale, y + yy * scale, z + (xx * s + zz * c) * scale); };
    mesh.poly([point(22, 1, 0), point(6, 1, -3), point(-15, 1, -3), point(-20, 1, 0), point(-15, 1, 3), point(6, 1, 3)], 'high', { top: true });
    mesh.poly([point(22, 1, 0), point(-16, 1, -3), point(-12, 4, 0), point(7, 4, 0)], 'metal');
    mesh.poly([point(22, 1, 0), point(-16, 1, 3), point(-12, 4, 0), point(7, 4, 0)], 'high');
    mesh.poly([point(4, 1.5, -2), point(-8, 1.5, -18), point(-13, 1.5, -18), point(-10, 1.5, 0), point(-13, 1.5, 18), point(-8, 1.5, 18), point(4, 1.5, 2)], 'metal', { top: true });
    mesh.poly([point(-11, 2, -2), point(-16, 12, -2), point(-23, 12, -2), point(-19, 2, -2)], 'high');
    mesh.poly([point(-11, 2, 2), point(-16, 12, 2), point(-23, 12, 2), point(-19, 2, 2)], 'metal');
    mesh.poly([point(8, 4, -1.6), point(8, 4, 1.6), point(-1, 4, 1.6), point(-1, 4, -1.6)], 'glass', { luminous: true });
  }
  function makeCarrier(detail) {
    var mesh = new Mesh(), length = 574, width = 126;
    hull(mesh, length * .95, width * .77, 28);
    var deck = [[-286, -60], [-262, -72], [98, -72], [275, -46], [287, -25], [287, 32], [196, 66], [-235, 66], [-285, 42]];
    mesh.prism(deck, 27, 34, 'metal', 'dark');
    mesh.line(deck.map(function (p) { return v(p[0], 34.4, p[1]); }).concat([v(deck[0][0], 34.4, deck[0][1])]), 'high', 1.4, .9);
    [-26, 5].forEach(function (z) { mesh.line([v(-259, 34.6, z), v(265, 34.6, z)], 'line', 1.25, .75); });
    for (var i = -240; i < 242; i += 28) mesh.line([v(i, 34.7, -10), v(i + 15, 34.7, -10)], 'paint', 1.4, .95);
    mesh.line([v(-250, 34.7, 43), v(193, 34.7, -38)], 'line', 1.2, .8);
    mesh.line([v(-250, 34.7, 14), v(193, 34.7, -62)], 'line', 1.2, .8);
    [-210, -193, -176, -159].forEach(function (x) { mesh.line([v(x, 34.8, -35), v(x, 34.8, 25)], 'line', 1, .7); });
    mesh.line([v(85, 34.8, 29), v(260, 34.8, 29)], 'paint', 1.8, .9);
    mesh.line([v(87, 34.8, 33), v(261, 34.8, 33)], 'line', .8, .7);
    // The carrier island is offset from the runway, with stepped bridge decks.
    mesh.box(-24, -54, 133, 25, 34, 17, 'hull', 'deck', 3);
    mesh.box(-10, -54, 88, 27, 51, 20, 'metal', 'high', 2);
    mesh.box(3, -55, 71, 32, 71, 10, 'high', 'metal');
    windows(mesh, 3, -55, 70, 31, 74, 4.5);
    mesh.box(-13, -54, 34, 21, 81, 10, 'metal', 'high');
    mast(mesh, -20, -53, 91, 47, 1.1, detail);
    mesh.box(-59, -54, 22, 19, 67, 23, 'hull', 'dark', 3);
    mesh.cylinder(29, -55, 6, 81, 12, 'metal', 'high', 10);
    mesh.cylinder(29, -55, 8, 93, 7, 'high', 'high', 12);
    if (detail) {
      railings(mesh, deck, 34, false);
      [-1, 1].forEach(function (side) {
        for (var j = 0; j < 10; j++) mesh.box(-235 + j * 45, side * 57, 10, 3, 28, 3, 'metal', 'high');
      });
    }
    var aircraft = detail ? [[-218, 49, -.15], [-171, 49, -.15], [-124, 49, -.15], [-77, 49, -.15], [155, 42, .15], [209, 40, .15], [43, -9, 0]] : [[-195, 47, -.1], [-115, 47, -.1], [177, 36, 0]];
    aircraft.forEach(function (a) { jet(mesh, a[0], a[1], 35, a[2], .72); });
    return { mesh: mesh, length: length, width: width, height: 153 };
  }
  function makeSubmarine(detail) {
    var mesh = new Mesh(), length = 330, width = 47;
    var section = [[-165, 2], [-146, 12], [-110, 23], [91, 23], [132, 17], [156, 9], [166, 1]];
    for (var i = 0; i < section.length - 1; i++) {
      for (var j = 0; j < 10; j++) {
        var a = Math.PI * j / 10, b = Math.PI * (j + 1) / 10;
        var p = section[i], q = section[i + 1];
        mesh.poly([v(p[0], Math.sin(a) * p[1] + 2, Math.cos(a) * p[1]), v(q[0], Math.sin(a) * q[1] + 2, Math.cos(a) * q[1]), v(q[0], Math.sin(b) * q[1] + 2, Math.cos(b) * q[1]), v(p[0], Math.sin(b) * p[1] + 2, Math.cos(b) * p[1])], j < 5 ? 'dark' : 'hull');
      }
    }
    mesh.box(-7, 0, 54, 15, 22, 33, 'hull', 'metal', 4);
    mesh.box(-2, 0, 41, 12, 54, 4, 'dark', 'high');
    mesh.box(2, 0, 17, 70, 34, 2.5, 'metal', 'high');
    mesh.box(-143, 0, 23, 78, 7, 3, 'dark', 'metal');
    mesh.poly([v(-151, 12, 0), v(-161, 37, 0), v(-130, 38, 0), v(-120, 12, 0)], 'hull');
    mesh.cylinder(6, 0, 1.8, 58, 20, 'high', 'high', 5);
    mesh.box(9, 0, 8, 3, 75, 3, 'metal', 'dark');
    mesh.cylinder(-11, 0, 1, 58, 28, 'dark', 'dark', 5);
    mesh.poly([v(-19, 46, 7.5), v(10, 46, 7.5), v(10, 50, 7.5), v(-19, 50, 7.5)], 'glass');
    if (detail) {
      [-74, -45, 65, 95].forEach(function (x) { mesh.cylinder(x, 0, 7, 25.1, .8, 'metal', 'dark', 10); });
      for (var k = 0; k < 11; k++) mesh.line([v(-123 + k * 22, 22, -8), v(-123 + k * 22, 22, 8)], 'metal', .7, .6);
      mesh.line([v(-130, 25.7, 0), v(130, 25.7, 0)], 'high', .7, .55);
    }
    return { mesh: mesh, length: length, width: width, height: 87 };
  }
  function makePatrol(detail) {
    var mesh = new Mesh(), length = 228, width = 52, outline = hull(mesh, length, width, 18);
    mesh.box(-12, 0, 77, 32, 18, 20, 'metal', 'high', 3);
    mesh.box(-2, 0, 47, 34, 38, 9, 'high', 'high', 1);
    windows(mesh, -2, 0, 46, 33, 40, 5);
    mesh.box(-3, 0, 34, 28, 47, 2, 'metal', 'high');
    mast(mesh, -20, 0, 49, 26, .67, detail);
    turret(mesh, 69, 0, 19, .58, 0, 1, detail);
    mesh.box(-76, -14, 33, 7, 18, 7, 'dark', 'metal');
    mesh.box(-76, 14, 33, 7, 18, 7, 'dark', 'metal');
    mesh.box(-73, 0, 30, 12, 18, 5, 'deck', 'high');
    mesh.poly([v(7, 31, 16.1), v(35, 25, 16.1), v(35, 27, 16.1), v(7, 34, 16.1)], 'stripe');
    railings(mesh, outline, 18, detail);
    if (detail) detailsAlongDeck(mesh, length, width, 18, false);
    return { mesh: mesh, length: length, width: width, height: 93 };
  }
  function modelFor(type, detail) {
    var key = type + (detail ? '-fine' : '-distant');
    if (!meshCache[key]) meshCache[key] = type === 'carrier' ? makeCarrier(detail) : type === 'submarine' ? makeSubmarine(detail) : type === 'patrol' ? makePatrol(detail) : makeWarship(type, detail);
    return meshCache[key];
  }

  function clipToWater(points) {
    var result = [], level = -1.8;
    for (var i = 0; i < points.length; i++) {
      var a = points[i], b = points[(i + 1) % points.length], ain = a[1] >= level, bin = b[1] >= level;
      if (ain) result.push(a);
      if (ain !== bin) {
        var t = (level - a[1]) / (b[1] - a[1]);
        result.push([mix(a[0], b[0], t), level, mix(a[2], b[2], t)]);
      }
    }
    return result;
  }
  function projection(point, camera) {
    var ground = point[0] * .6 + point[2] * .8;
    return [camera.x + (point[0] * .8 - point[2] * .6) * camera.s,
      camera.y + (ground * .47 - point[1] * .883) * camera.s,
      ground * .883 + point[1] * .47];
  }
  function transformed(point, yaw, roll, bob, sink) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cr = Math.cos(roll), sr = Math.sin(roll);
    var y = point[1] * cr - point[2] * sr + bob - sink;
    var z = point[2] * cr + point[1] * sr;
    return [point[0] * cy - z * sy, y, point[0] * sy + z * cy];
  }
  function paintModel(ctx, model, camera, yaw, roll, bob, sink, palette, blueprint, opacity) {
    var primitives = [];
    model.mesh.items.forEach(function (item) {
      var vertices = item.p.map(function (p) { return transformed(p, yaw, roll, bob, sink); });
      if (item.kind === 'face') vertices = clipToWater(vertices);
      else if (vertices.every(function (p) { return p[1] < -1.8; })) return;
      if (vertices.length < (item.kind === 'face' ? 3 : 2)) return;
      var points = vertices.map(function (p) { return projection(p, camera); });
      var depth = points.reduce(function (sum, p) { return sum + p[2]; }, 0) / points.length;
      if (item.kind === 'line') depth += .3;
      var color = palette[item.material] || item.material;
      if (item.kind === 'face' && !blueprint && !item.luminous) {
        var a = vertices[0], b = vertices[1], c = vertices[2];
        var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        var n = Math.hypot(nx, ny, nz) || 1;
        var light = item.top ? 1.06 : .75 + Math.max(-.2, (-nx * .45 + Math.abs(ny) * .78 - nz * .42) / n) * .32;
        color = shade(color, light);
      }
      primitives.push({ points: points, depth: depth, color: color, item: item });
    });
    primitives.sort(function (a, b) { return a.depth - b.depth; });
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    primitives.forEach(function (primitive) {
      var points = primitive.points, item = primitive.item;
      ctx.globalAlpha = (item.alpha === undefined ? 1 : item.alpha) * opacity;
      ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
      for (var i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
      if (item.kind === 'face') {
        ctx.closePath();
        if (blueprint) {
          ctx.fillStyle = '#092e48'; ctx.globalAlpha *= .65; ctx.fill();
          ctx.strokeStyle = '#93c5d5'; ctx.globalAlpha = .55 * opacity; ctx.lineWidth = .55; ctx.stroke();
        } else {
          ctx.fillStyle = primitive.color; ctx.fill();
          // Filling a subpixel seam prevents light gaps between hull panels.
          ctx.strokeStyle = primitive.color; ctx.lineWidth = .28; ctx.stroke();
        }
      } else {
        ctx.strokeStyle = blueprint ? '#a8d8e8' : primitive.color;
        ctx.lineWidth = clamp(item.width * camera.s, .35, 2.4);
        ctx.stroke();
      }
    });
    ctx.globalAlpha = 1;
  }

  function skyAndWater(ctx, width, height, time, blueprint) {
    var horizon = height * .285;
    var sky = ctx.createLinearGradient(0, 0, 0, horizon + 20);
    sky.addColorStop(0, blueprint ? '#0c243f' : '#518199');
    sky.addColorStop(.75, blueprint ? '#143a54' : '#a5bec9');
    sky.addColorStop(1, blueprint ? '#24546c' : '#d3dfe0');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, width, horizon + 2);
    if (!blueprint) {
      var sun = ctx.createRadialGradient(width * .76, horizon * .52, 2, width * .76, horizon * .52, width * .23);
      sun.addColorStop(0, '#fff4d267'); sun.addColorStop(.35, '#d7e1cd20'); sun.addColorStop(1, '#e4e6da00');
      ctx.fillStyle = sun; ctx.fillRect(0, 0, width, horizon + 30);
      for (var c = 0; c < 7; c++) {
        var cloudX = seeded(c, 32) * width + Math.sin(time * .018 + c) * 5;
        var cloudY = horizon * (.16 + seeded(c, 12) * .48);
        var cloudW = width * (.05 + seeded(c, 5) * .11);
        var cloud = ctx.createRadialGradient(cloudX, cloudY, 0, cloudX, cloudY, cloudW);
        cloud.addColorStop(0, '#f0f2e71b'); cloud.addColorStop(1, '#f0f2e700');
        ctx.save(); ctx.translate(0, cloudY * .55); ctx.scale(1, .45);
        ctx.fillStyle = cloud; ctx.beginPath(); ctx.ellipse(cloudX, cloudY, cloudW, 20 + height * .035, 0, 0, TAU); ctx.fill(); ctx.restore();
      }
    }
    // Two quiet, faceted coastlines. The central channel remains open.
    for (var layer = 0; layer < 2; layer++) {
      ctx.beginPath(); ctx.moveTo(0, horizon + 6);
      var start = layer ? .0 : -.04, extent = layer ? .34 : .48;
      for (var n = 0; n <= 16; n++) {
        var x = (start + n / 16 * extent) * width;
        var envelope = Math.sin(n / 16 * Math.PI);
        var y = horizon - envelope * height * (layer ? .14 : .085) * (.36 + seeded(n, 27 + layer) * .64);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width * extent, horizon + 6); ctx.closePath();
      ctx.fillStyle = blueprint ? (layer ? '#173e54' : '#244e67') : (layer ? '#3e6374' : '#7292a0'); ctx.fill();
      ctx.beginPath(); ctx.moveTo(width * .77, horizon + 5);
      for (var k = 0; k <= 12; k++) {
        var xx = width * (.77 + k / 12 * .27);
        var yy = horizon - Math.sin(k / 14 * Math.PI) * height * (layer ? .15 : .08) * (.5 + seeded(k, 51 + layer) * .5);
        ctx.lineTo(xx, yy);
      }
      ctx.lineTo(width + 2, horizon + 8); ctx.closePath(); ctx.fill();
    }
    var sea = ctx.createLinearGradient(0, horizon, 0, height);
    sea.addColorStop(0, blueprint ? '#124260' : '#3b778c');
    sea.addColorStop(.25, blueprint ? '#103a55' : '#25637e');
    sea.addColorStop(1, blueprint ? '#09263e' : '#10394f');
    ctx.fillStyle = sea; ctx.fillRect(0, horizon, width, height - horizon);
    var glare = ctx.createRadialGradient(width * .74, horizon, 0, width * .74, horizon, width * .47);
    glare.addColorStop(0, '#d1e8d01e'); glare.addColorStop(1, '#d1e8d000');
    ctx.fillStyle = glare; ctx.fillRect(0, horizon, width, height - horizon);
    if (blueprint) {
      ctx.strokeStyle = '#75b6cc15'; ctx.lineWidth = .65;
      var spacing = Math.max(22, width / 40);
      for (var gx = 0; gx < width; gx += spacing) { ctx.beginPath(); ctx.moveTo(gx, horizon); ctx.lineTo(gx, height); ctx.stroke(); }
      for (var gy = horizon; gy < height; gy += spacing) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(width, gy); ctx.stroke(); }
    }
    // Perspective wavelets: compressed near the horizon, broad in the foreground.
    for (var row = 0; row < 25; row++) {
      var f = row / 24, yy0 = horizon + Math.pow(f, 1.65) * (height - horizon);
      var pieces = 8 + Math.floor((1 - f) * 11);
      for (var wave = 0; wave < pieces; wave++) {
        var id = row * 31 + wave, waveX = (wave / pieces + seeded(id, 7) * .07) * width;
        var amplitude = .4 + f * 2.8, waveY = yy0 + Math.sin(time * .63 + id * .91) * amplitude;
        var waveW = (8 + seeded(id, 11) * 42) * (.35 + f * 1.8) * Math.min(1.6, width / 800);
        var lightness = seeded(id, 15);
        ctx.strokeStyle = lightness > .78 ? 'rgba(179,221,222,' + (.04 + f * .13) + ')' : 'rgba(3,34,59,' + (.05 + f * .1) + ')';
        ctx.lineWidth = .6 + f * 1.0;
        ctx.beginPath(); ctx.moveTo(waveX, waveY);
        ctx.bezierCurveTo(waveX + waveW * .3, waveY - amplitude, waveX + waveW * .7, waveY + amplitude, waveX + waveW, waveY);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = '#d4e6df25'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, horizon + .5); ctx.lineTo(width, horizon + .5); ctx.stroke();
  }
  function wake(ctx, model, camera, yaw, time, opacity, blueprint) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw);
    var point = function (x, z) { return projection([x * cy - z * sy, 0, x * sy + z * cy], camera); };
    var shadow = point(-15, 0);
    ctx.save(); ctx.translate(shadow[0], shadow[1] + 6 * camera.s);
    var end = point(model.length / 2, 0), start = point(-model.length / 2, 0);
    var angle = Math.atan2(end[1] - start[1], end[0] - start[0]); ctx.rotate(angle);
    var shadowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, model.length * camera.s * .53);
    shadowGradient.addColorStop(0, '#041b3055'); shadowGradient.addColorStop(1, '#041b3000');
    ctx.scale(1, .15); ctx.fillStyle = shadowGradient; ctx.globalAlpha = opacity;
    ctx.beginPath(); ctx.ellipse(0, 0, model.length * camera.s * .53, model.length * camera.s * .53, 0, 0, TAU); ctx.fill(); ctx.restore();
    ctx.globalAlpha = opacity;
    for (var side = -1; side <= 1; side += 2) {
      for (var line = 0; line < 3; line++) {
        ctx.beginPath();
        for (var i = 0; i <= 18; i++) {
          var f = i / 18, x = -model.length * .43 - f * model.length * .58;
          var z = side * (model.width * .38 + f * model.width * .75 + line * 5 + Math.sin(f * 12 - time * 1.5 + line) * (1 + f * 3));
          var p = point(x, z);
          if (!i) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
        }
        ctx.strokeStyle = blueprint ? '#8dc8dc30' : ['#bde7df55', '#c8e9df2d', '#d5ebe51c'][line];
        ctx.lineWidth = Math.max(.4, camera.s * (1.8 - line * .3)); ctx.stroke();
      }
    }
    for (var foam = 0; foam < 28; foam++) {
      var f = seeded(foam, 16), xx = -model.length * (.43 + f * .6);
      var zz = (seeded(foam, 20) - .5) * (model.width * (.7 + f));
      var pp = point(xx + Math.sin(time + foam) * 2, zz);
      ctx.fillStyle = '#ccece63d'; ctx.beginPath(); ctx.ellipse(pp[0], pp[1], (.7 + f * 1.6) * camera.s, .55 * camera.s, 0, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function drawEffect(ctx, effect, target, width, height, now, reduced) {
    if (!effect) return;
    var t = clamp((now - effect.start) / effect.duration, 0, 1);
    var p = smooth(clamp(t / .25, 0, 1));
    var tx = target[0], ty = target[1];
    if (t < .28 && !reduced) {
      var sx = width * .90, sy = -height * .05;
      var x = mix(sx, tx, p), y = mix(sy, ty, p) - Math.sin(p * Math.PI) * height * .18;
      var gradient = ctx.createLinearGradient(x - 35, y - 24, x, y);
      gradient.addColorStop(0, '#f7e6ba00'); gradient.addColorStop(1, '#fff3cd');
      ctx.strokeStyle = gradient; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 24, y - 20); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = '#fff9e5'; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.fill();
    }
    var impact = clamp((t - .20) / .80, 0, 1);
    if (impact <= 0) return;
    var scale = Math.min(1.1, Math.max(.5, width / 1000));
    if (effect.hit) {
      var flash = ctx.createRadialGradient(tx, ty, 0, tx, ty, (35 + impact * 60) * scale);
      flash.addColorStop(0, 'rgba(255,247,202,' + Math.max(0, 1 - impact * 2.3) + ')');
      flash.addColorStop(.25, 'rgba(255,169,71,' + Math.max(0, .95 - impact * 1.7) + ')');
      flash.addColorStop(1, '#e75f2500'); ctx.fillStyle = flash;
      ctx.fillRect(tx - 100 * scale, ty - 100 * scale, 200 * scale, 200 * scale);
      for (var spark = 0; spark < (reduced ? 5 : 22); spark++) {
        var angle = seeded(spark, 9) * TAU, speed = 22 + seeded(spark, 8) * 72;
        var sx = tx + Math.cos(angle) * speed * impact * scale;
        var sy = ty + Math.sin(angle) * speed * impact * scale - 35 * Math.sin(impact * Math.PI) * scale;
        ctx.globalAlpha = Math.max(0, 1 - impact * 1.5);
        ctx.strokeStyle = spark % 2 ? '#ffd17b' : '#fff3bf'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - Math.cos(angle) * 5, sy - Math.sin(angle) * 5); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (var cloud = 0; cloud < 8; cloud++) {
        var cx = tx + (seeded(cloud, 6) - .5) * (24 + impact * 44) * scale;
        var cy = ty - impact * (35 + seeded(cloud, 13) * 70) * scale;
        var radius = (8 + seeded(cloud, 40) * 10 + impact * 19) * scale;
        var smoke = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        var alpha = Math.sin(Math.PI * impact) * .45;
        smoke.addColorStop(0, 'rgba(29,38,46,' + alpha + ')'); smoke.addColorStop(1, '#1d262e00');
        ctx.fillStyle = smoke; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, TAU); ctx.fill();
      }
    } else {
      ctx.globalAlpha = Math.max(0, 1 - impact);
      ctx.fillStyle = '#d6eff0';
      ctx.beginPath(); ctx.moveTo(tx - 11 * scale, ty); ctx.quadraticCurveTo(tx - 7 * scale, ty - 52 * scale * Math.sin(impact * Math.PI), tx, ty - 70 * scale * Math.sin(impact * Math.PI));
      ctx.quadraticCurveTo(tx + 6 * scale, ty - 48 * scale * Math.sin(impact * Math.PI), tx + 12 * scale, ty); ctx.closePath(); ctx.fill();
      for (var drop = 0; drop < (reduced ? 5 : 14); drop++) {
        var direction = seeded(drop, 1) * TAU, distance = (17 + seeded(drop, 6) * 47) * impact;
        var dx = tx + Math.cos(direction) * distance * scale, dy = ty + Math.sin(direction) * distance * .28 * scale - Math.sin(impact * Math.PI) * (13 + seeded(drop, 8) * 43) * scale;
        ctx.beginPath(); ctx.ellipse(dx, dy, 1.3 * scale, 2.3 * scale, direction, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = 'rgba(207,241,237,' + Math.max(0, .7 - impact * .65) + ')'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(tx, ty + 6, (12 + impact * 90) * scale, (3 + impact * 20) * scale, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function create(canvas, options) {
    options = options || {};
    var ctx = canvas && canvas.getContext ? canvas.getContext('2d', { alpha: false }) : null;
    if (!ctx) {
      if (options.onReady) options.onReady({ ready: false, renderer: 'unavailable' });
      return { setState: function () {}, focusShip: function () {}, attack: function () { return Promise.resolve(); }, resize: function () {}, destroy: function () {} };
    }
    var state = { phase: 'deployment', selectedShip: 'ship-1', skin: 'navy', blueprint: false, paused: false, turn: 'player' };
    var width = 1000, height = 300, dpr = 1, disposed = false, raf = 0, lastFrame = 0;
    var focused = 1, previousFocus = 1, focusStarted = 0, effect = null, attackTimer = 0, attackResolve = null;
    var startTime = timeNow();
    var motionQuery = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var reduced = !!(motionQuery && motionQuery.matches);
    var requestFrame = root.requestAnimationFrame ? root.requestAnimationFrame.bind(root) : function (fn) { return setTimeout(function () { fn(timeNow()); }, 33); };
    var cancelFrame = root.cancelAnimationFrame ? root.cancelAnimationFrame.bind(root) : clearTimeout;
    function isHidden() { return !!(root.document && root.document.hidden); }
    function resize() {
      if (disposed) return;
      var rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { width: canvas.width, height: canvas.height };
      width = Math.max(1, Math.round(rect.width || canvas.clientWidth || 1000));
      height = Math.max(1, Math.round(rect.height || canvas.clientHeight || 300));
      dpr = Math.min(2, Math.max(1, Number(root.devicePixelRatio) || 1));
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render(timeNow());
    }
    function slotsFor(index, mainIndex) {
      var compact = width / height < 2.8 || width < 670;
      var factor = Math.min(width / (compact ? 595 : 1120), height / (compact ? 263 : 315));
      var others = TYPES.map(function (_, i) { return i; }).filter(function (i) { return i !== mainIndex; });
      var slot = index === mainIndex ? 0 : others.indexOf(index) + 1;
      var slots = compact ? [
        [.56, .72, 1.05, 2.0, 1], [.12, .51, .48, 2.15, .70], [.88, .42, .39, 2.0, .62], [.08, .85, .31, 1.95, .45], [1.00, .83, .34, 2.20, .55]
      ] : [
        [.57, .72, 1.15, 2.03, 1], [.255, .51, .62, 2.10, .78], [.82, .47, .59, 2.12, .71], [.10, .78, .56, 1.90, .78], [.925, .83, .67, 2.13, .85]
      ];
      var selected = slots[slot];
      return { x: width * selected[0], y: height * selected[1], s: factor * selected[2], yaw: selected[3], opacity: selected[4], slot: slot };
    }
    function render(now) {
      if (disposed || isHidden()) return;
      var t = reduced || state.paused ? 0 : (now - startTime) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      skyAndWater(ctx, width, height, t, state.blueprint);
      var activeFocus = effect && effect.actionCamera && effect.hit ? TYPES.indexOf(typeName(effect.shipName)) : focused;
      var blend = smooth((now - focusStarted) / 600);
      var fleet = TYPES.map(function (type, index) {
        var next = slotsFor(index, activeFocus), prev = slotsFor(index, previousFocus);
        var animatingFocus = activeFocus === focused && blend < 1;
        if (animatingFocus) {
          next.x = mix(prev.x, next.x, blend); next.y = mix(prev.y, next.y, blend); next.s = mix(prev.s, next.s, blend); next.opacity = mix(prev.opacity, next.opacity, blend);
        }
        next.type = type; next.index = index;
        return next;
      }).sort(function (a, b) { return a.y - b.y; });
      var target = [width * .56, height * .65];
      var attackProgress = effect ? clamp((now - effect.start) / effect.duration, 0, 1) : 0;
      fleet.forEach(function (ship) {
        var model = modelFor(ship.type, ship.slot === 0 || ship.s > .65);
        var main = ship.index === activeFocus;
        var bob = reduced || state.paused ? 0 : Math.sin(t * 1.0 + ship.index * 1.4) * 1.4;
        var roll = reduced || state.paused ? 0 : Math.sin(t * .65 + ship.index) * .012;
        var sink = 0;
        var camera = { x: ship.x, y: ship.y, s: ship.s };
        if (effect && effect.actionCamera && main) {
          var zoom = Math.sin(attackProgress * Math.PI) * (reduced ? .03 : .10);
          camera.s *= 1 + zoom;
          if (effect.sunk) { sink = smooth((attackProgress - .34) / .66) * model.height * 1.05; roll += smooth((attackProgress - .26) / .74) * .23; }
          if (effect.hit && !reduced) { camera.x += Math.sin(attackProgress * 123) * Math.max(0, .5 - Math.abs(attackProgress - .30)) * 3; }
        }
        wake(ctx, model, camera, ship.yaw, t + ship.index, ship.opacity * (1 - sink / (model.height * 1.3)), state.blueprint);
        paintModel(ctx, model, camera, ship.yaw, roll, bob, sink, paletteFor(state.skin), state.blueprint, ship.opacity);
        if (main) {
          var target3D = transformed([model.length * .10, effect && !effect.hit ? 0 : model.height * .33, effect && !effect.hit ? model.width * 1.15 : 0], ship.yaw, 0, 0, Math.min(sink, model.height * .15));
          target = projection(target3D, camera);
        }
      });
      drawEffect(ctx, effect, target, width, height, now, reduced);
      // A subtle foreground fade joins the panorama to the tactical deck.
      var vignette = ctx.createLinearGradient(0, height * .78, 0, height);
      vignette.addColorStop(0, '#071b3000'); vignette.addColorStop(1, '#071b3060');
      ctx.fillStyle = vignette; ctx.fillRect(0, height * .78, width, height * .22);
    }
    function loop(now) {
      raf = 0;
      if (disposed || isHidden()) return;
      // Limit software drawing to 40 fps; boats still ease smoothly at touch scale.
      if (now - lastFrame >= 24 || !lastFrame) { render(now); lastFrame = now; }
      if (!state.paused && (!reduced || effect)) raf = requestFrame(loop);
    }
    function animate() {
      if (!raf && !disposed && !isHidden() && !state.paused && (!reduced || effect)) raf = requestFrame(loop);
    }
    function focusShip(value) {
      var index = TYPES.indexOf(typeName(value));
      if (index !== focused) { previousFocus = focused; focused = index; focusStarted = timeNow() - (reduced || state.paused ? 600 : 0); }
      state.selectedShip = 'ship-' + focused;
      render(timeNow()); animate();
    }
    function setState(values) {
      if (disposed || !values || typeof values !== 'object') return;
      var nextFocus = values.selectedShip;
      ['phase', 'skin', 'blueprint', 'paused', 'turn'].forEach(function (key) { if (Object.prototype.hasOwnProperty.call(values, key)) state[key] = values[key]; });
      if (nextFocus !== undefined) focusShip(nextFocus);
      if (state.paused && raf) { cancelFrame(raf); raf = 0; }
      render(timeNow()); animate();
    }
    function finishAttack() {
      if (attackTimer) { clearTimeout(attackTimer); attackTimer = 0; }
      effect = null;
      if (attackResolve) { var resolve = attackResolve; attackResolve = null; resolve(); }
      if (!disposed) { render(timeNow()); animate(); }
    }
    function attack(data) {
      if (disposed) return Promise.resolve();
      finishAttack();
      data = data || {};
      effect = { start: timeNow(), duration: reduced ? 380 : data.sunk ? 1480 : data.hit ? 980 : 860, hit: !!data.hit, sunk: !!data.sunk, shipName: typeName(data.shipName || state.selectedShip), actionCamera: data.actionCamera !== false, index: Number(data.index) || 0, side: data.side === 'enemy' ? 'enemy' : 'player' };
      var promise = new Promise(function (resolve) { attackResolve = resolve; });
      attackTimer = setTimeout(finishAttack, effect.duration);
      render(timeNow()); animate();
      return promise;
    }
    function visibility() {
      if (isHidden()) { if (raf) cancelFrame(raf); raf = 0; }
      else { lastFrame = 0; render(timeNow()); animate(); }
    }
    function motionChanged(event) { reduced = !!event.matches; if (reduced && raf) { cancelFrame(raf); raf = 0; } render(timeNow()); animate(); }
    var observer = root.ResizeObserver ? new root.ResizeObserver(resize) : null;
    if (observer) observer.observe(canvas);
    else if (root.addEventListener) root.addEventListener('resize', resize);
    if (root.document && root.document.addEventListener) root.document.addEventListener('visibilitychange', visibility);
    if (motionQuery && motionQuery.addEventListener) motionQuery.addEventListener('change', motionChanged);
    function destroy() {
      if (disposed) return;
      disposed = true; if (raf) cancelFrame(raf); raf = 0;
      if (observer) observer.disconnect(); else if (root.removeEventListener) root.removeEventListener('resize', resize);
      if (root.document && root.document.removeEventListener) root.document.removeEventListener('visibilitychange', visibility);
      if (motionQuery && motionQuery.removeEventListener) motionQuery.removeEventListener('change', motionChanged);
      finishAttack();
    }
    resize(); animate();
    if (options.onReady) options.onReady({ ready: true, renderer: 'canvas3d' });
    return { setState: setState, focusShip: focusShip, attack: attack, resize: resize, destroy: destroy };
  }

  function shipSVG(type, length, options) {
    options = options || {};
    type = typeName(type);
    var palette = paletteFor(options.skin), unique = 'nf' + (++svgSerial), damaged = clamp(Number(options.damaged) || 0, 0, 1);
    var sunk = !!options.sunk, vertical = options.orientation === 'vertical';
    var hull = sunk ? '#665f5b' : palette.hull, deck = sunk ? '#898077' : palette.deck, high = sunk ? '#b49883' : palette.high, dark = palette.dark;
    var content = '<defs><linearGradient id="' + unique + 'h" x1="0" y1="0" x2="0" y2="1"><stop stop-color="' + high + '"/><stop offset=".3" stop-color="' + hull + '"/><stop offset="1" stop-color="' + dark + '"/></linearGradient><linearGradient id="' + unique + 'd" x1="0" y1="0" x2="0" y2="1"><stop stop-color="' + deck + '"/><stop offset="1" stop-color="' + hull + '"/></linearGradient></defs>';
    content += '<g' + (vertical ? ' transform="translate(100 0) rotate(90)"' : '') + '>';
    if (type === 'submarine') {
      content += '<path d="M15 49 44 41 63 25Q76 19 102 18H302Q365 19 392 50 365 81 302 82H102Q76 81 63 75L44 59Z" fill="url(#' + unique + 'h)" stroke="' + high + '" stroke-width="1.3"/><path d="M67 50H365" stroke="' + high + '" opacity=".5"/><path d="M44 50 28 12H62L82 50 62 88H28Z" fill="' + hull + '" stroke="' + high + '"/><path d="M167 24 158 9H190L211 30 211 70 190 91H158L167 76Z" fill="' + hull + '" stroke="' + high + '"/><rect x="160" y="31" width="72" height="38" rx="10" fill="' + dark + '" stroke="' + high + '"/><rect x="172" y="36" width="48" height="28" rx="5" fill="' + hull + '"/><rect x="179" y="40" width="31" height="5" rx="1" fill="' + palette.glass + '"/><path d="M207 47h16m-20 8h23" stroke="' + high + '" stroke-width="2"/>';
      [111, 264, 313].forEach(function (x) { content += '<ellipse cx="' + x + '" cy="50" rx="9" ry="8" fill="' + dark + '" stroke="' + high + '" stroke-width="1"/>'; });
    } else {
      var carrier = type === 'carrier';
      content += '<path d="M11 27 31 13H274Q344 15 391 50 344 85 274 87H31L11 73Z" fill="url(#' + unique + 'h)" stroke="' + high + '" stroke-width="1.5"/>';
      content += '<path d="M23 29 37 21H271Q336 22 378 50 336 78 271 79H37L23 71Z" fill="url(#' + unique + 'd)" stroke="' + high + '" stroke-width=".8"/>';
      if (carrier) {
        content += '<path d="M14 14H287L382 33V67L290 91H32L14 78Z" fill="' + dark + '" stroke="' + high + '" stroke-width="1.4"/><path d="M32 33H365M32 58H365M35 79 283 26M35 62 278 10" fill="none" stroke="' + palette.line + '" stroke-width="1.2" opacity=".8"/><path d="M33 46H363" stroke="' + palette.paint + '" stroke-width="1.4" stroke-dasharray="13 7"/><path d="M48 28v34m10-34v34m10-34v34m10-34v34" stroke="' + palette.line + '" opacity=".7"/><rect x="147" y="8" width="104" height="22" rx="4" fill="' + hull + '" stroke="' + high + '"/><rect x="167" y="11" width="61" height="16" rx="2" fill="' + high + '"/><rect x="173" y="14" width="47" height="4" fill="' + palette.glass + '"/><circle cx="189" cy="22" r="5" fill="' + dark + '"/><path d="M189 8v19m-12-12h25" stroke="' + high + '" stroke-width="1.4"/>';
        [73, 116, 159, 202, 291, 334].forEach(function (x, i) { content += '<path d="m' + x + ' 70 12 4-10 4-5 9h-4l1-10-6-3 6-3-1-9h4Z" fill="' + palette.high + '" stroke="' + hull + '" stroke-width=".6" transform="rotate(' + (i < 4 ? -9 : 12) + ' ' + x + ' 75)"/>'; });
      } else {
        // Deck framing, mooring posts and the stripe at the waterline.
        content += '<path d="M34 26H267Q327 26 367 50 327 74 267 74H34Z" fill="none" stroke="' + high + '" stroke-width=".8" opacity=".8"/>';
        for (var p = 43; p < 288; p += 30) content += '<path d="M' + p + ' 18v8m0 48v8" stroke="' + palette.line + '" stroke-width="1" opacity=".7"/>';
        content += '<rect x="115" y="30" width="137" height="40" rx="5" fill="' + dark + '" stroke="' + high + '"/><rect x="144" y="33" width="75" height="34" rx="4" fill="' + hull + '" stroke="' + high + '"/><rect x="193" y="29" width="46" height="42" rx="5" fill="' + high + '"/><path d="M230 34v32m-9-32v32" stroke="' + palette.glass + '" stroke-width="4"/><rect x="174" y="40" width="17" height="20" rx="3" fill="' + dark + '"/><rect x="143" y="40" width="17" height="20" rx="3" fill="' + dark + '"/><path d="M204 32v36m-14-18h28" stroke="' + hull + '" stroke-width="2"/><circle cx="204" cy="50" r="4" fill="' + dark + '"/>';
        var turrets = type === 'patrol' ? [[303, 1]] : type === 'cruiser' ? [[304, 2], [66, -2]] : [[311, 3], [262, 3], [64, -3]];
        turrets.forEach(function (t) {
          var x = t[0], count = Math.abs(t[1]), reverse = t[1] < 0;
          content += '<g' + (reverse ? ' transform="rotate(180 ' + x + ' 50)"' : '') + '><circle cx="' + x + '" cy="50" r="17" fill="' + dark + '" stroke="' + high + '"/><path d="M' + (x - 13) + ' 36h18l13 8v12l-13 8h-18Z" fill="' + hull + '" stroke="' + high + '" stroke-width="1.3"/>';
          for (var j = 0; j < count; j++) { var y = 50 + (j - (count - 1) / 2) * 6; content += '<path d="M' + (x + 9) + ' ' + y + 'h33" stroke="' + dark + '" stroke-width="4.5"/><path d="M' + (x + 9) + ' ' + (y - .7) + 'h32" stroke="' + high + '" stroke-width="2.1"/>'; }
          content += '</g>';
        });
        [129, 177].forEach(function (x) { content += '<rect x="' + x + '" y="23" width="20" height="7" rx="3" fill="' + palette.high + '" stroke="' + dark + '"/><rect x="' + x + '" y="70" width="20" height="7" rx="3" fill="' + palette.high + '" stroke="' + dark + '"/>'; });
        if (type === 'patrol') content += '<path d="m245 29 27 7v4l-27-6" fill="' + palette.stripe + '"/>';
      }
    }
    if (damaged || sunk) {
      var count = sunk ? 4 : Math.max(1, Math.round(damaged * 4));
      for (var scar = 0; scar < count; scar++) {
        var sx = 92 + scar * 68, sy = 46 + (scar % 2 ? 8 : -5);
        content += '<circle cx="' + sx + '" cy="' + sy + '" r="15" fill="#172630" opacity=".72"/><circle cx="' + sx + '" cy="' + sy + '" r="6" fill="' + (sunk ? '#b87756' : '#ef9d55') + '" opacity=".85"/>';
      }
    }
    content += '</g>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + (vertical ? '0 0 100 400' : '0 0 400 100') + '" preserveAspectRatio="none" aria-hidden="true" class="naval-ship-art">' + content + '</svg>';
  }

  return { create: create, shipSVG: shipSVG, types: TYPES.slice() };
});
