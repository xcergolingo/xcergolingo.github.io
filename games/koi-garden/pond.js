/* GoLingo Koi Garden — original procedural pond art and swimming simulation. */
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

function rng(seed = 1) {
  let n = seed >>> 0;
  return () => {
    n += 0x6d2b79f5;
    let t = n;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundedRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function smoothPath(ctx, points) {
  const last = points[points.length - 1];
  ctx.beginPath();
  ctx.moveTo((last[0] + points[0][0]) / 2, (last[1] + points[0][1]) / 2);
  for (let i = 0; i < points.length; i++) {
    const p = points[i], next = points[(i + 1) % points.length];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + next[0]) / 2, (p[1] + next[1]) / 2);
  }
  ctx.closePath();
}

function smoothFlatPath(ctx, points, count) {
  const last = (count - 1) * 2;
  ctx.beginPath();
  ctx.moveTo((points[last] + points[0]) / 2, (points[last + 1] + points[1]) / 2);
  for (let i = 0; i < count; i++) {
    const p = i * 2, next = ((i + 1) % count) * 2;
    ctx.quadraticCurveTo(points[p], points[p + 1], (points[p] + points[next]) / 2, (points[p + 1] + points[next + 1]) / 2);
  }
  ctx.closePath();
}

const THEMES = {
  jade: {
    center: '#b8d7c2', middle: '#8fc3b1', edge: '#467f78', deep: '#255a58',
    leafLight: '#72975c', leaf: '#447c51', leafDark: '#285f44',
    tint: 'rgba(32,105,94,.035)', pearl: '#f8d791', ripple: 'rgba(246,253,226,',
    flower: '#f1b6b5', petal: '#fbe4d5', night: false,
  },
  dusk: {
    center: '#b8c2ac', middle: '#8ca99a', edge: '#456c69', deep: '#284b51',
    leafLight: '#979260', leaf: '#54744d', leafDark: '#355d48',
    tint: 'rgba(152,92,86,.045)', pearl: '#ffd09a', ripple: 'rgba(255,225,199,',
    flower: '#e8a395', petal: '#ffd4bd', night: false,
  },
  moon: {
    center: '#547c81', middle: '#365c69', edge: '#193b4c', deep: '#102a3c',
    leafLight: '#557967', leaf: '#345c56', leafDark: '#24494a',
    tint: 'rgba(40,73,113,.07)', pearl: '#dfebc1', ripple: 'rgba(203,237,247,',
    flower: '#d1c0d5', petal: '#eee9ed', night: true,
  },
};

const WIDTHS = [
  [0, 0.012], [.035, .046], [.10, .085], [.20, .119], [.33, .127],
  [.46, .113], [.59, .087], [.73, .059], [.86, .034], [.96, .022], [1, .019],
];

function widthAt(t) {
  for (let i = 1; i < WIDTHS.length; i++) {
    if (t <= WIDTHS[i][0]) {
      const a = WIDTHS[i - 1], b = WIDTHS[i];
      return lerp(a[1], b[1], (t - a[0]) / (b[0] - a[0]));
    }
  }
  return .019;
}

const SCALE_LAYOUT = Array.from({ length: 98 }, (_, i) => {
  const row = Math.floor(i / 14), col = i % 14;
  const t = .23 + col * .048 + (row % 2) * .022;
  return { t, side: (row - 3) * .029, width: widthAt(t), highlight: col % 2 === 0 };
});

export class Pond {
  constructor(canvas, { onCollect = () => {}, onMove = () => {} } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    if (!this.ctx) throw new Error('This browser cannot draw the pond.');
    this.onCollect = onCollect;
    this.onMove = onMove;
    this.active = false;
    this.paused = false;
    this.theme = 'jade';
    this.growth = 0;
    this.safeArea = {};
    this.time = 0;
    this.pearls = [];
    this.ripples = [];
    this.sparks = [];
    this.keys = new Set();
    this.target = null;
    this.pointerDown = false;
    this._pickupCooldown = 0;
    this._wakeClock = 0;
    this._idleUntil = 0;
    this._raf = null;
    this._hidden = document.hidden === true;
    this._needsDraw = true;
    this._slowSeconds = 0;
    this._fastSeconds = 0;
    this._lastQualityChange = -Infinity;
    this._bodyScratch = new Float32Array(112);
    this._patchScratch = new Float32Array(24);
    this._patchShapes = new Map();
    this._renderBend = 0;
    this._seed = 43;
    this._random = rng(3021);
    this._destroyed = false;
    this.stats = { fps: 60, frames: 0 };
    this.player = this._makeFish(0, 0, 0, 'kohaku', 1, 1.5);
    this.player.player = true;
    this.companions = [];
    this._caustic = this._makeCaustics();
    this._shadows = {
      koi: this._makeFishShadow(false),
      dragon: this._makeFishShadow(true),
    };
    this._petals = Array.from({ length: 13 }, (_, i) => ({
      u: this._random(), v: this._random(), angle: this._random() * TAU,
      speed: .35 + this._random() * .65, size: 2.6 + this._random() * 3.3, phase: i * 1.9,
    }));
    this._motes = Array.from({ length: 45 }, () => ({
      u: this._random(), v: this._random(), size: .5 + this._random(), phase: this._random() * TAU,
    }));
    this.canvas.style.touchAction = 'none';
    this.canvas.style.webkitUserSelect = 'none';
    this.canvas.style.userSelect = 'none';
    this._bindEvents();
    this.resize();
    this._lastFrame = performance.now();
    this._tick = (now) => {
      this._raf = null;
      if (this._destroyed || this._hidden) return;
      if (this._nextDpr != null) { this._setDpr(this._nextDpr); this._nextDpr = null; }
      const rawElapsed = Math.max(0, (now - this._lastFrame) / 1000);
      const elapsed = Math.min(rawElapsed, .25);
      this._lastFrame = now;
      if (!this.paused) {
        // Preserve swimming speed on slower devices without skipping collisions.
        // A bounded catch-up also prevents jumps after returning from a hidden tab.
        const steps = Math.max(1, Math.ceil(elapsed / (1 / 30)));
        for (let i = 0; i < steps && !this.paused; i++) {
          this.time += elapsed / steps;
          this._update(elapsed / steps);
        }
      }
      if (!this.paused || this._needsDraw) {
        const renderStart = performance.now();
        this._draw();
        const renderMs = performance.now() - renderStart;
        this._needsDraw = false;
        this.stats.frames++;
        if (!this.paused && rawElapsed > .001) {
          this.stats.fps = this.stats.fps * .97 + Math.min(240, 1 / rawElapsed) * .03;
          this._adaptResolution(rawElapsed, renderMs, now);
        }
      }
      if (!this.paused) this._scheduleFrame();
    };
    this._scheduleFrame();
  }

  _makeFish(x, y, angle, type, scale, phase) {
    return { x, y, angle, type, scale, phase, speed: 22, turnRate: 0, bend: 0, goal: null, nextGoal: 0, seed: phase * 71 + 5 };
  }

  _scheduleFrame() {
    if (!this._destroyed && !this._hidden && this._raf == null && this._tick) this._raf = requestAnimationFrame(this._tick);
  }

  _invalidate() { this._needsDraw = true; this._scheduleFrame(); }

  _setDpr(value) {
    this.dpr = clamp(value, Math.min(1, this._maxDpr), this._maxDpr);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.stats.dpr = this.dpr;
    this._needsDraw = true;
  }

  _adaptResolution(frameSeconds, renderMs, now) {
    const elapsed = Math.min(frameSeconds, .12);
    this.stats.renderMs = (this.stats.renderMs ?? renderMs) * .94 + renderMs * .06;
    const slow = frameSeconds > 1 / 43 && this.stats.renderMs > 11;
    const fast = frameSeconds < 1 / 53 && this.stats.renderMs < 9;
    this._slowSeconds = slow ? this._slowSeconds + elapsed : Math.max(0, this._slowSeconds - elapsed * 2);
    this._fastSeconds = fast ? this._fastSeconds + elapsed : 0;
    if (this._slowSeconds > 2.8 && now - this._lastQualityChange > 5000 && this.dpr > 1) {
      this._nextDpr = Math.max(1, this.dpr - .25);
    } else if (this._fastSeconds > 12 && now - this._lastQualityChange > 15000 && this.dpr < this._maxDpr) {
      this._nextDpr = Math.min(this._maxDpr, this.dpr + .25);
    }
    if (this._nextDpr != null) {
      this._lastQualityChange = now;
      this._slowSeconds = this._fastSeconds = 0;
    }
  }

  _turnFish(f, heading, dt, maxRate) {
    const error = angleDelta(f.angle, heading);
    const wantedRate = clamp(error * 3.8, -maxRate, maxRate);
    f.turnRate += (wantedRate - f.turnRate) * (1 - Math.exp(-dt * 9));
    f.angle += f.turnRate * dt;
    f.bend += (clamp(f.turnRate / 3.2, -1, 1) - f.bend) * (1 - Math.exp(-dt * 5));
    return error;
  }

  _fishLength(f) {
    return this.baseLength * f.scale * (f.player ? 1 + this.growth * .22 : 1) * (f.type === 'dragon' ? 1.17 : 1);
  }

  _mouthPosition(f = this.player) {
    const offset = this._fishLength(f) * .456;
    return { x: f.x + Math.cos(f.angle) * offset, y: f.y + Math.sin(f.angle) * offset };
  }

  _bindEvents() {
    this._onPointerDown = (event) => {
      if (!this.active || this.paused || event.button > 0) return;
      event.preventDefault();
      this.pointerDown = true;
      this._pointerId = event.pointerId;
      try { this.canvas.setPointerCapture(event.pointerId); } catch (_) { /* detached canvas */ }
      this._steer(event, true);
      this.onMove();
    };
    this._onPointerMove = (event) => {
      if (this.pointerDown && event.pointerId === this._pointerId && this.active && !this.paused) {
        event.preventDefault();
        this._steer(event, false);
      }
    };
    this._onPointerUp = (event) => {
      if (event.pointerId === this._pointerId) {
        this.pointerDown = false;
        if (!this.target) this._idleUntil = this.time + 1.8;
      }
    };
    this._onKeyDown = (event) => {
      const tag = document.activeElement?.tagName;
      if (!this.active || this.paused || event.altKey || event.metaKey || event.ctrlKey ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(tag || '') || document.activeElement?.isContentEditable) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(event.key)) {
        event.preventDefault();
        this.keys.add(event.key.toLowerCase());
      }
    };
    this._onKeyUp = (event) => this.keys.delete(event.key.toLowerCase());
    this._onBlur = () => { this.keys.clear(); this.pointerDown = false; };
    this._onResize = () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => { this._resizeTimer = null; this.resize(); }, 100);
    };
    this._onVisibility = () => {
      this._hidden = document.hidden === true;
      this._lastFrame = performance.now();
      this._slowSeconds = this._fastSeconds = 0;
      this.keys.clear(); this.pointerDown = false;
      if (this._hidden) {
        if (this._raf != null) cancelAnimationFrame(this._raf);
        this._raf = null;
      } else this._invalidate();
    };
    this.canvas.addEventListener('pointerdown', this._onPointerDown, { passive: false });
    this.canvas.addEventListener('pointermove', this._onPointerMove, { passive: false });
    this.canvas.addEventListener('pointerup', this._onPointerUp);
    this.canvas.addEventListener('pointercancel', this._onPointerUp);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', this._onVisibility);
  }

  _steer(event, first) {
    const box = this.canvas.getBoundingClientRect();
    let x = event.clientX - box.left, y = event.clientY - box.top;
    const hit = this.pearls.find((p) => {
      const labelHalf = (p.labelWidth || 90) / 2 + 5;
      return Math.hypot(x - p.x, y - p.y) < 34 ||
        (Math.abs(x - p.x) < labelHalf && y > p.y + 15 && y < p.y + 54);
    });
    if (hit) { x = hit.x; y = hit.y; hit.armed = true; }
    this.target = { x: clamp(x, 25, this.w - 25), y: clamp(y, 25, this.h - 25), id: hit?.id };
    this._idleUntil = 0;
    if (first) this._ripple(x, y, .7);
  }

  resize() {
    clearTimeout(this._resizeTimer);
    this._resizeTimer = null;
    const oldW = this.w || 0, oldH = this.h || 0;
    const oldBounds = oldW && oldH ? this._pearlBounds() : null;
    const layout = oldBounds ? this.pearls.map((p) => ({
      pearl: p,
      u: clamp((p.x - oldBounds.left) / Math.max(1, oldBounds.right - oldBounds.left), 0, 1),
      v: clamp((p.y - oldBounds.top) / Math.max(1, oldBounds.bottom - oldBounds.top), 0, 1),
    })) : [];
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, rect.width || window.innerWidth);
    this.h = Math.max(1, rect.height || window.innerHeight);
    const pendingInsets = this._pendingSafeArea;
    if (pendingInsets) { this.safeArea = pendingInsets; this._pendingSafeArea = null; }
    this._maxDpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this._setDpr(Math.min(this.dpr || this._maxDpr, this._maxDpr));
    if (oldW === this.w && oldH === this.h && this._backdrop && !pendingInsets) { this._invalidate(); return; }
    this.baseLength = this.w < 600 ? 101 : 132;
    if (!oldW || !oldH) {
      this.player.x = this.w * .52;
      this.player.y = this.h * .54;
      this.player.angle = -.5;
      const starts = [[.19, .38, .55], [.76, .62, 2.6], [.68, .22, 1.8], [.25, .77, -.9], [.85, .38, 2.9]];
      this.companions = starts.map(([u, v, a], i) => this._makeFish(
        this.w * u, this.h * v, a, ['sanke', 'ogon', 'kohaku', 'silver', 'sanke'][i],
        [.72, .63, .67, .58, .46][i], i * 1.34 + .6,
      ));
    } else {
      for (const f of [this.player, ...this.companions]) {
        f.x = f.x / oldW * this.w;
        f.y = f.y / oldH * this.h;
        f.goal = null;
      }
      if (this.target) {
        this.target.x = this.target.x / oldW * this.w;
        this.target.y = this.target.y / oldH * this.h;
      }
    }
    const bounds = this._pearlBounds();
    for (const { pearl, u, v } of layout) {
      pearl.x = lerp(bounds.left, bounds.right, u);
      pearl.y = lerp(bounds.top, bounds.bottom, v);
    }
    if (oldW !== this.w || oldH !== this.h || !this._backdrop) {
      this._buildBackdrop();
      this._buildCanopy();
    }
    for (const p of this.pearls) Object.assign(p, this._preparePearlLabel(p.label));
    this._keepPearlsInBounds();
    this._separatePearls();
    this._syncGuidedTarget();
    this._invalidate();
  }

  _pearlBounds() {
    const compact = this.h < 500;
    const mobile = this.w < 600;
    const safe = this.safeArea;
    const top = Number.isFinite(safe.top) ? safe.top : compact ? 99 : mobile ? 151 : 168;
    const bottom = Number.isFinite(safe.bottom) ? safe.bottom : compact ? 126 : mobile ? 232 : 214;
    const left = Number.isFinite(safe.left) ? safe.left : Math.min(95, this.w * .21);
    const right = Number.isFinite(safe.right) ? safe.right : Math.min(95, this.w * .21);
    const safeTop = clamp(Math.min(top, this.h - bottom - 30), 30, Math.max(30, this.h - 60));
    const safeLeft = clamp(left, 30, Math.max(30, this.w - 60));
    return {
      left: safeLeft, right: clamp(this.w - Math.max(30, right), safeLeft + 30, Math.max(safeLeft + 30, this.w - 30)),
      top: safeTop, bottom: clamp(this.h - bottom, safeTop + 30, Math.max(safeTop + 30, this.h - 30)),
    };
  }

  // Values are inset margins in CSS pixels, measured from each canvas edge.
  setSafeArea(insets = {}) {
    const rect = this.canvas.getBoundingClientRect();
    if (Math.abs(rect.width - this.w) > .5 || Math.abs(rect.height - this.h) > .5) {
      // HUD resize handlers can run before our debounced viewport commit. Keep
      // the old coordinates intact until the new dimensions and insets agree.
      this._pendingSafeArea = { ...insets };
      this._onResize();
      return;
    }
    this._pendingSafeArea = null;
    const previous = this._pearlBounds();
    this.safeArea = { ...insets };
    const next = this._pearlBounds();
    for (const p of this.pearls) {
      const u = clamp((p.x - previous.left) / Math.max(1, previous.right - previous.left), 0, 1);
      const v = clamp((p.y - previous.top) / Math.max(1, previous.bottom - previous.top), 0, 1);
      p.x = lerp(next.left, next.right, u);
      p.y = lerp(next.top, next.bottom, v);
    }
    this._keepPearlsInBounds();
    this._separatePearls();
    this._syncGuidedTarget();
    this._invalidate();
  }

  _syncGuidedTarget() {
    if (this.target?.id != null) {
      const p = this.pearls.find((pearl) => pearl.id === this.target.id);
      if (p) { this.target.x = p.x; this.target.y = p.y; }
    }
  }

  _separatePearls() {
    const bounds = this._pearlBounds(), placed = [];
    const clearance = (p, x, y) => {
      let score = Infinity;
      for (const other of placed) {
        score = Math.min(score, Math.hypot(x - other.x, y - other.y) - 55,
          Math.max(Math.abs(x - other.x) - ((p.labelWidth || 90) + (other.labelWidth || 90)) / 2 - 9, Math.abs(y - other.y) - 42));
      }
      return score;
    };
    for (const p of this.pearls) {
      if (clearance(p, p.x, p.y) < 0) {
        let best = null, bestDistance = Infinity, fallback = null, bestScore = -Infinity;
        for (let row = 0; row <= 10; row++) for (let col = 0; col <= 10; col++) {
          const x = lerp(bounds.left, bounds.right, col / 10), y = lerp(bounds.top, bounds.bottom, row / 10);
          const score = clearance(p, x, y), distance = Math.hypot(x - p.x, y - p.y);
          if (score >= 0 && distance < bestDistance) { best = { x, y }; bestDistance = distance; }
          if (score > bestScore) { fallback = { x, y }; bestScore = score; }
        }
        const destination = best || fallback;
        if (destination) { p.x = destination.x; p.y = destination.y; }
      }
      placed.push(p);
    }
  }

  _keepPearlsInBounds() {
    const b = this._pearlBounds();
    for (const p of this.pearls) {
      p.x = clamp(p.x, b.left, b.right);
      p.y = clamp(p.y, b.top, b.bottom);
    }
  }

  setPearls(items = []) {
    const b = this._pearlBounds();
    const previous = new Map(this.pearls.map((p) => [p.id, p]));
    const random = rng(++this._seed * 209);
    const mobile = this.w < 600;
    const slots = mobile
      ? [[.13, .15], [.87, .30], [.17, .69], [.86, .88], [.5, .48], [.55, .03]]
      : [[.19, .26], [.79, .20], [.49, .71], [.91, .76], [.10, .86], [.53, .03]];
    const offset = Math.floor(random() * slots.length);
    const next = items.slice(0, 8).map((item, i) => {
      const old = previous.get(item.id);
      const slot = slots[(i + offset) % slots.length];
      const x = item.x ?? old?.x ?? lerp(b.left, b.right, clamp(slot[0] + (random() - .5) * .06, 0, 1));
      const y = item.y ?? old?.y ?? lerp(b.top, b.bottom, clamp(slot[1] + (random() - .5) * .04, 0, 1));
      return { ...item, x: clamp(x, b.left, b.right), y: clamp(y, b.top, b.bottom),
        born: old?.born ?? this.time, phase: old?.phase ?? random() * TAU,
        ...this._preparePearlLabel(item.label), fresh: !old, armed: old?.armed ?? false };
    });
    const placed = next.filter((p) => !p.fresh);
    const mouth = this._mouthPosition();
    for (const p of next) {
      if (!p.fresh) continue;
      let best = { x: p.x, y: p.y }, bestScore = -Infinity;
      let bestSafe = null, bestSafeScore = -Infinity;
      for (let attempt = 0; attempt < 110; attempt++) {
        const x = attempt === 0 ? p.x : lerp(b.left, b.right, random());
        const y = attempt === 0 ? p.y : lerp(b.top, b.bottom, random());
        const fishClearance = Math.min(Math.hypot(x - this.player.x, y - this.player.y) - 84,
          Math.hypot(x - mouth.x, y - mouth.y) - 84);
        let score = fishClearance;
        for (const other of placed) {
          score = Math.min(score, Math.hypot(x - other.x, y - other.y) - 55);
          const dx = Math.abs(x - other.x), dy = Math.abs(y - other.y);
          // Space both the pearls and their readable labels on fresh/refill placement.
          score = Math.min(score, Math.max(dx - (p.labelWidth + other.labelWidth) / 2 - 9, dy - 42));
        }
        if (score > bestScore) { bestScore = score; best = { x, y }; }
        if (fishClearance >= 0 && score > bestSafeScore) { bestSafeScore = score; bestSafe = { x, y }; }
        if (score >= 0) break;
      }
      if (bestSafe) best = bestSafe;
      p.x = best.x; p.y = best.y;
      // On an exceptionally cramped screen, an unavoidable nearby pearl must first
      // be left behind before it can be collected, so a refill cannot award free XP.
      p.armed = Math.hypot(p.x - mouth.x, p.y - mouth.y) >= 65 && Math.hypot(p.x - this.player.x, p.y - this.player.y) >= 65;
      delete p.fresh;
      placed.push(p);
    }
    this.pearls = next;
    this._keepPearlsInBounds();
    this._invalidate();
  }

  _preparePearlLabel(value) {
    const fontSize = this.w < 600 ? 15 : 16;
    this.ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    const full = String(value ?? '');
    const maxWidth = Math.min(this.w < 600 ? 148 : 205, this.w * .42) - 28;
    if (this.ctx.measureText(full).width <= maxWidth) return { displayLabel: full, labelWidth: this.ctx.measureText(full).width + 28 };
    const chars = Array.from(full);
    let lo = 0, hi = chars.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (this.ctx.measureText(chars.slice(0, mid).join('') + '…').width <= maxWidth) lo = mid;
      else hi = mid - 1;
    }
    const displayLabel = chars.slice(0, lo).join('') + '…';
    return { displayLabel, labelWidth: this.ctx.measureText(displayLabel).width + 28 };
  }

  getPearls() { return this.pearls.map(({ id, label, x, y }) => ({ id, label, x, y })); }
  setActive(value) {
    this.active = !!value;
    if (!value) { this.keys.clear(); this.pointerDown = false; this.target = null; this._idleUntil = 0; }
    this._invalidate();
  }
  setPaused(value) {
    const paused = !!value;
    if (paused === this.paused) return;
    this.paused = paused;
    this.keys.clear(); this.pointerDown = false;
    this._lastFrame = performance.now();
    if (this._raf != null) cancelAnimationFrame(this._raf);
    this._raf = null;
    this._invalidate();
  }
  setGrowth(value) { this.growth = clamp(Number(value) || 0, 0, 1); this._invalidate(); }
  setKoi(type) {
    if (!['kohaku', 'sanke', 'ogon', 'dragon'].includes(type)) return;
    this.player.type = type;
    this.burst(this.player.x, this.player.y, type === 'dragon' ? '#ffdc8d' : '#fff3cd');
  }
  setTheme(theme) {
    if (!THEMES[theme] || theme === this.theme) return;
    this.theme = theme;
    this._buildBackdrop();
    this._buildCanopy();
    this._invalidate();
  }
  guideTo(id) {
    const p = this.pearls.find((pearl) => pearl.id === id);
    if (!p) return false;
    p.armed = true;
    this.target = { x: p.x, y: p.y, id: p.id };
    this._idleUntil = 0;
    this._ripple(p.x, p.y, 1);
    this.onMove();
    return true;
  }

  burst(x = this.player.x, y = this.player.y, color = '#fff1bc') {
    this._ripple(x, y, 1.3);
    for (let i = 0; i < 22; i++) {
      const a = this._random() * TAU, speed = 12 + this._random() * 55;
      this.sparks.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, age: 0, life: .65 + this._random() * .7, size: 1 + this._random() * 2.3, color });
    }
    this._invalidate();
  }

  _ripple(x, y, strength = 1) {
    this.ripples.push({ x, y, age: 0, strength });
    if (this.ripples.length > 30) this.ripples.shift();
  }

  _update(dt) {
    this._pickupCooldown = Math.max(0, this._pickupCooldown - dt);
    const p = this.player;
    const length = this._fishLength(p);
    let desiredAngle = p.angle, desiredSpeed = 0, targetDistance = Infinity;
    const kx = (this.keys.has('arrowright') || this.keys.has('d') ? 1 : 0) - (this.keys.has('arrowleft') || this.keys.has('a') ? 1 : 0);
    const ky = (this.keys.has('arrowdown') || this.keys.has('s') ? 1 : 0) - (this.keys.has('arrowup') || this.keys.has('w') ? 1 : 0);
    if (this.active && (kx || ky)) {
      desiredAngle = Math.atan2(ky, kx);
      desiredSpeed = this.w < 600 ? 155 : 190;
      this.target = null;
      this._idleUntil = this.time + 1.5;
    } else if (this.active && this.target) {
      const dx = this.target.x - p.x, dy = this.target.y - p.y;
      const dist = Math.hypot(dx, dy);
      targetDistance = dist;
      const arrivalRadius = this.target.id != null ? 7 : 14;
      if (dist <= arrivalRadius || (dist < arrivalRadius + 1.5 && p.speed < 18)) {
        this.target = null; p.goal = null;
        this._idleUntil = this.time + 1.8;
      } else {
        desiredAngle = Math.atan2(dy, dx);
        desiredSpeed = Math.min(this.w < 600 ? 155 : 190, (dist - arrivalRadius) * 2.8);
      }
    } else if (this.active && (this.pointerDown || this.time < this._idleUntil)) {
      desiredSpeed = 0;
    } else {
      if (!p.goal || this.time > p.nextGoal || Math.hypot(p.goal.x - p.x, p.goal.y - p.y) < 65) {
        p.goal = { x: this.w * (.24 + this._random() * .53), y: this.h * (.28 + this._random() * .46) };
        p.nextGoal = this.time + 14;
      }
      desiredAngle = Math.atan2(p.goal.y - p.y, p.goal.x - p.x);
      desiredSpeed = this.active ? 9 : 20;
    }
    const turn = this._turnFish(p, desiredAngle, dt, 3.2);
    desiredSpeed *= Math.max(.08, Math.cos(turn));
    const response = desiredSpeed < p.speed ? 7 : 3.5;
    p.speed += (desiredSpeed - p.speed) * (1 - Math.exp(-dt * response));
    const travel = Math.min(p.speed * dt, targetDistance);
    p.x = clamp(p.x + Math.cos(p.angle) * travel, 15, this.w - 15);
    p.y = clamp(p.y + Math.sin(p.angle) * travel, 15, this.h - 15);
    p.phase += dt * (2.2 + p.speed * .025);
    this._wakeClock += dt;
    if (this.active && p.speed > 45 && this._wakeClock >= .3) {
      this._wakeClock = 0;
      this._ripple(p.x - Math.cos(p.angle) * length * .55, p.y - Math.sin(p.angle) * length * .55, .28);
    }
    for (const f of this.companions) {
      if (!f.goal || this.time > f.nextGoal || Math.hypot(f.goal.x - f.x, f.goal.y - f.y) < 60) {
        f.goal = { x: this.w * (.08 + this._random() * .84), y: this.h * (.12 + this._random() * .78) };
        f.nextGoal = this.time + 11 + this._random() * 10;
      }
      let angle = Math.atan2(f.goal.y - f.y, f.goal.x - f.x);
      const playerDistance = Math.hypot(f.x - p.x, f.y - p.y);
      if (playerDistance < length * .75) angle = Math.atan2(f.y - p.y, f.x - p.x);
      this._turnFish(f, angle, dt, .8);
      f.speed = 18 + f.scale * 15 + Math.sin(this.time * .3 + f.seed) * 3;
      f.x = clamp(f.x + Math.cos(f.angle) * f.speed * dt, -20, this.w + 20);
      f.y = clamp(f.y + Math.sin(f.angle) * f.speed * dt, -20, this.h + 20);
      f.phase += dt * (2 + f.speed * .025);
    }
    if (this.active && !this._pickupCooldown) {
      const mouth = this._mouthPosition(p);
      for (const pearl of this.pearls) {
        if (!pearl.armed && Math.hypot(pearl.x - mouth.x, pearl.y - mouth.y) > 65 && Math.hypot(pearl.x - p.x, pearl.y - p.y) > 65) pearl.armed = true;
      }
      const hit = this.pearls.find((pearl) => pearl.armed && (Math.hypot(pearl.x - mouth.x, pearl.y - mouth.y) < 27 || Math.hypot(pearl.x - p.x, pearl.y - p.y) < 23));
      if (hit) {
        this.pearls = this.pearls.filter((pearl) => pearl !== hit);
        this._pickupCooldown = .45;
        if (this.target?.id === hit.id) {
          this.target = null; p.goal = null;
          this._idleUntil = this.time + 1.4;
        }
        this.burst(hit.x, hit.y, hit.color || THEMES[this.theme].pearl);
        this.onCollect(hit.id);
      }
    }
    for (const r of this.ripples) r.age += dt;
    this.ripples = this.ripples.filter((r) => r.age < 2.5);
    for (const s of this.sparks) { s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 1 - dt * .9; s.vy *= 1 - dt * .9; }
    this.sparks = this.sparks.filter((s) => s.age < s.life);
  }

  _canvasLayer() {
    const canvas = document.createElement('canvas');
    const resolution = this._maxDpr || this.dpr;
    canvas.width = Math.round(this.w * resolution);
    canvas.height = Math.round(this.h * resolution);
    const ctx = canvas.getContext('2d');
    ctx.scale(resolution, resolution);
    return [canvas, ctx];
  }

  _buildBackdrop() {
    const [canvas, c] = this._canvasLayer();
    this._backdrop = canvas;
    const t = THEMES[this.theme], random = rng(98713);
    const gradient = c.createRadialGradient(this.w * .56, this.h * .43, 25, this.w * .5, this.h * .5, Math.max(this.w * .67, this.h * .72));
    gradient.addColorStop(0, t.center); gradient.addColorStop(.5, t.middle); gradient.addColorStop(1, t.edge);
    c.fillStyle = gradient; c.fillRect(0, 0, this.w, this.h);
    // A fine mineral bed, visible through the water rather than a flat color.
    for (let i = 0; i < Math.min(4300, this.w * this.h / 240); i++) {
      const x = random() * this.w, y = random() * this.h, r = random() * 1.25 + .25;
      c.fillStyle = random() > .5 ? 'rgba(244,231,189,.12)' : 'rgba(49,100,87,.075)';
      c.beginPath(); c.ellipse(x, y, r * 1.6, r, random() * TAU, 0, TAU); c.fill();
    }
    for (let i = 0; i < 58; i++) {
      const x = random() * this.w, y = random() * this.h;
      c.strokeStyle = t.night ? 'rgba(165,199,188,.025)' : 'rgba(249,243,202,.075)';
      c.lineWidth = .7;
      c.beginPath(); c.moveTo(x - 80, y);
      c.bezierCurveTo(x - 20, y - 14, x + 25, y + 14, x + 130, y - 4);
      c.stroke();
    }
    // Rounded river pebbles concentrate at the banks and recede with depth.
    for (let i = 0; i < 160; i++) {
      let x = random() * this.w, y = random() * this.h;
      const edge = Math.min(x / this.w, 1 - x / this.w, y / this.h, 1 - y / this.h);
      if (edge > .18 && random() > .13) continue;
      const radius = 2 + random() * (edge < .10 ? 13 : 5);
      this._stone(c, x, y, radius, random, .25 + (1 - edge) * .3);
    }
    // Submerged grasses wave in arcing fans along the shallow edges.
    for (const [u, v, flip] of [[.02, .60, 1], [.96, .76, -1], [.82, .99, -1]]) {
      c.save(); c.translate(this.w * u, this.h * v); c.scale(flip, 1);
      for (let i = 0; i < 11; i++) {
        const endX = 28 + random() * 110, endY = -12 - random() * 145;
        c.fillStyle = `rgba(43,112,86,${.07 + random() * .07})`;
        c.beginPath(); c.moveTo(0, 0);
        c.bezierCurveTo(10, -40, endX * .75, endY * .9, endX, endY);
        c.bezierCurveTo(endX * .7, endY * .85, 0, -25, 0, 0); c.fill();
      }
      c.restore();
    }
    // Soft reflected canopy shadows fall across the pond floor.
    c.save(); c.filter = 'blur(10px)'; c.fillStyle = 'rgba(20,63,53,.09)';
    for (let i = 0; i < 66; i++) {
      const x = this.w * (.64 + random() * .46), y = this.h * (-.1 + random() * .5);
      c.beginPath(); c.ellipse(x, y, 13 + random() * 28, 5 + random() * 10, -.8, 0, TAU); c.fill();
    }
    c.restore();
    const shade = c.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * .22, this.w / 2, this.h / 2, Math.hypot(this.w, this.h) * .58);
    shade.addColorStop(0, 'rgba(9,45,41,0)'); shade.addColorStop(1, 'rgba(9,45,41,.24)');
    c.fillStyle = shade; c.fillRect(0, 0, this.w, this.h);
    if (t.night) {
      const moon = c.createRadialGradient(this.w * .72, this.h * .30, 10, this.w * .72, this.h * .3, this.w * .36);
      moon.addColorStop(0, 'rgba(195,223,220,.15)'); moon.addColorStop(1, 'rgba(149,199,213,0)');
      c.fillStyle = moon; c.fillRect(0, 0, this.w, this.h);
    }
  }

  _stone(c, x, y, size, random, alpha = 1) {
    c.save(); c.translate(x, y); c.rotate(random() * TAU); c.globalAlpha = alpha;
    const points = Array.from({ length: 9 }, (_, i) => {
      const a = i / 9 * TAU, r = size * (.8 + random() * .3);
      return [Math.cos(a) * r * 1.3, Math.sin(a) * r];
    });
    c.shadowColor = 'rgba(15,47,42,.28)'; c.shadowBlur = 6; c.shadowOffsetY = 4;
    const tone = random();
    const grad = c.createLinearGradient(-size, -size, size, size);
    grad.addColorStop(0, tone > .5 ? '#bac4ab' : '#a4b0a4');
    grad.addColorStop(.65, tone > .5 ? '#899f8c' : '#748e86'); grad.addColorStop(1, '#58786d');
    c.fillStyle = grad; smoothPath(c, points); c.fill();
    c.shadowBlur = 0; c.strokeStyle = 'rgba(218,227,201,.16)'; c.lineWidth = .7; c.stroke();
    c.restore();
  }

  _makeCaustics() {
    const size = 256, grid = 5, cell = size / grid, random = rng(882);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const c = canvas.getContext('2d'), image = c.createImageData(size, size);
    const points = Array.from({ length: grid * grid }, () => [random() * .8 + .1, random() * .8 + .1]);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const xx = x + Math.sin(y / size * TAU * 2) * 7, yy = y + Math.sin(x / size * TAU) * 10;
      const gx = Math.floor(xx / cell), gy = Math.floor(yy / cell);
      let d1 = 1e6, d2 = 1e6;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const cx = gx + i, cy = gy + j, pp = points[((cy % grid + grid) % grid) * grid + ((cx % grid + grid) % grid)];
        const dx = (cx + pp[0]) * cell - xx, dy = (cy + pp[1]) * cell - yy;
        const d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      }
      const edge = Math.sqrt(d2) - Math.sqrt(d1);
      const bright = Math.pow(Math.max(0, 1 - edge / 8), 3);
      const k = (y * size + x) * 4;
      image.data[k] = 248; image.data[k + 1] = 255; image.data[k + 2] = 213;
      image.data[k + 3] = Math.round(bright * 91);
    }
    c.putImageData(image, 0, 0);
    return canvas;
  }

  _buildCanopy() {
    const [canvas, c] = this._canvasLayer();
    this._canopy = canvas;
    const random = rng(442), mobile = this.w < 600;
    const s = mobile ? .78 : 1;
    const clusters = [
      [-14, this.h * .21, 38, 7, 1],
      [this.w + 16, this.h * .15, 43, 7, -1],
      [this.w - 9, this.h * .87, 45, 8, -1],
      [-10, this.h - 24, 48, 7, 1],
    ];
    for (const [cx, cy, size, count, direction] of clusters) {
      const pads = [];
      for (let i = 0; i < count; i++) {
        const x = cx + direction * (random() * 100 - 15) * s;
        const y = cy + (random() - .5) * 155 * s;
        const r = size * (.5 + random() * .65) * s;
        pads.push([x, y, r, random() * TAU, random()]);
      }
      pads.sort((a, b) => a[1] - b[1]);
      for (const [x, y, r, angle, seed] of pads) this._lily(c, x, y, r, angle, seed);
    }
    const flowers = [
      [mobile ? 36 : 57, this.h * .21, 25 * s, .4],
      [this.w - (mobile ? 22 : 46), this.h * .84, 31 * s, -.6],
      [this.w - 28, this.h * .12, 17 * s, .15],
    ];
    for (const flower of flowers) this._lotus(c, ...flower);
    // Fine willow leaves frame the view without covering the swimming space.
    this._branch(c, this.w + 8, -8, -1, s, 0);
    this._branch(c, -18, this.h * .72, 1, s * .7, .6);
  }

  _lily(c, x, y, radius, angle, seed) {
    const theme = THEMES[this.theme];
    c.save(); c.translate(x, y); c.rotate(angle); c.scale(1, .88);
    const padPath = () => {
      c.beginPath(); c.moveTo(-radius * .11, radius * .04);
      for (let i = 0; i <= 68; i++) {
        const a = .29 + i / 68 * (TAU - .58);
        const r = radius * (1 + .025 * Math.sin(a * 6 + seed * 8) + .023 * Math.cos(a * 3));
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.lineTo(-radius * .11, radius * .04); c.closePath();
    };
    c.shadowColor = 'rgba(9,47,35,.29)'; c.shadowBlur = 15; c.shadowOffsetX = 5; c.shadowOffsetY = 9;
    const grad = c.createLinearGradient(-radius * .7, -radius, radius * .7, radius);
    grad.addColorStop(0, theme.leafLight); grad.addColorStop(.48, theme.leaf); grad.addColorStop(1, theme.leafDark);
    c.fillStyle = grad; padPath(); c.fill();
    c.shadowBlur = 0; c.shadowOffsetX = c.shadowOffsetY = 0;
    c.strokeStyle = 'rgba(191,210,131,.25)'; c.lineWidth = 1; c.stroke();
    c.save(); padPath(); c.clip();
    for (let i = 0; i < 15; i++) {
      const a = .38 + i / 14 * (TAU - .76);
      const ex = Math.cos(a) * radius * .96, ey = Math.sin(a) * radius * .96;
      c.strokeStyle = i % 2 ? 'rgba(171,197,122,.16)' : 'rgba(21,68,44,.21)'; c.lineWidth = .85;
      c.beginPath(); c.moveTo(-radius * .1, radius * .03);
      c.quadraticCurveTo(ex * .43 - 2, ey * .5, ex, ey); c.stroke();
      for (let j = 1; j <= 3; j++) {
        const q = j * .22, xx = ex * q, yy = ey * q;
        c.lineWidth = .4; c.beginPath(); c.moveTo(xx, yy);
        c.quadraticCurveTo(xx + Math.cos(a - .5) * radius * .14, yy + Math.sin(a - .5) * radius * .14, Math.cos(a - .12) * radius * (q + .22), Math.sin(a - .12) * radius * (q + .22)); c.stroke();
      }
    }
    const glaze = c.createRadialGradient(-radius * .32, -radius * .43, 0, -radius * .2, -radius * .3, radius);
    glaze.addColorStop(0, 'rgba(224,225,165,.15)'); glaze.addColorStop(.6, 'rgba(231,236,173,0)');
    c.fillStyle = glaze; c.fillRect(-radius, -radius, radius * 2, radius * 2);
    c.restore();
    for (const [dx, dy, rr] of [[-.29, -.34, .07], [.3, .17, .035]]) {
      c.fillStyle = 'rgba(230,246,221,.33)'; c.beginPath(); c.ellipse(dx * radius, dy * radius, radius * rr, radius * rr * .8, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(252,255,239,.6)'; c.beginPath(); c.arc(dx * radius - 1, dy * radius - 1, .8, 0, TAU); c.fill();
    }
    c.restore();
  }

  _lotus(c, x, y, size, angle) {
    const t = THEMES[this.theme];
    c.save(); c.translate(x, y); c.rotate(angle);
    c.shadowColor = 'rgba(26,53,41,.3)'; c.shadowBlur = 9; c.shadowOffsetY = 6;
    c.fillStyle = 'rgba(49,84,52,.7)'; c.beginPath(); c.ellipse(0, 5, size * .82, size * .47, 0, 0, TAU); c.fill();
    c.shadowBlur = 0; c.shadowOffsetY = 0;
    for (let layer = 0; layer < 3; layer++) {
      const count = [10, 8, 6][layer], length = size * [1, .76, .49][layer];
      for (let i = 0; i < count; i++) {
        c.save(); c.rotate(i / count * TAU + layer * .36);
        const grad = c.createLinearGradient(0, 6, 0, -length);
        grad.addColorStop(0, '#d98e9b'); grad.addColorStop(.48, t.flower); grad.addColorStop(1, t.petal);
        c.fillStyle = grad; c.strokeStyle = 'rgba(255,239,218,.48)'; c.lineWidth = .55;
        c.beginPath(); c.moveTo(0, 6);
        c.bezierCurveTo(-length * .49, -length * .12, -length * .35, -length * .76, 0, -length);
        c.bezierCurveTo(length * .4, -length * .70, length * .45, -length * .1, 0, 6); c.fill(); c.stroke();
        c.strokeStyle = 'rgba(173,87,116,.12)'; c.lineWidth = .6;
        c.beginPath(); c.moveTo(0, 2); c.quadraticCurveTo(2, -length * .5, 0, -length * .9); c.stroke();
        c.restore();
      }
    }
    c.fillStyle = '#f4d48b'; c.beginPath(); c.arc(0, 0, size * .18, 0, TAU); c.fill();
    for (let i = 0; i < 11; i++) {
      const a = i * 2.4, r = Math.sqrt(i / 11) * size * .14;
      c.fillStyle = i % 2 ? '#fff0b9' : '#c39350'; c.beginPath(); c.arc(Math.cos(a) * r, Math.sin(a) * r, .8, 0, TAU); c.fill();
    }
    c.restore();
  }

  _branch(c, x, y, direction, scale, rotation) {
    const t = THEMES[this.theme];
    c.save(); c.translate(x, y); c.scale(direction * scale, scale); c.rotate(rotation);
    c.shadowColor = 'rgba(10,47,37,.18)'; c.shadowBlur = 8; c.shadowOffsetY = 5;
    for (let j = 0; j < 5; j++) {
      c.save(); c.rotate(.10 + j * .27);
      const length = 150 + j * 18;
      c.strokeStyle = '#597552'; c.lineWidth = 1.7;
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(60, length * .42, 18, length); c.stroke();
      for (let i = 1; i < 9; i++) {
        const u = i / 9, xx = Math.sin(u * Math.PI) * 28, yy = length * u;
        for (const side of [-1, 1]) {
          c.save(); c.translate(xx, yy); c.rotate(side * .9 - .2);
          const leaf = 21 + Math.sin(u * Math.PI) * 12;
          c.fillStyle = i % 3 ? t.leaf : t.leafLight;
          c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-4, leaf * .45, -3, leaf * .8, 0, leaf);
          c.bezierCurveTo(5, leaf * .65, 7, leaf * .15, 0, 0); c.fill();
          c.strokeStyle = 'rgba(179,200,136,.2)'; c.lineWidth = .4; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, leaf * .85); c.stroke();
          c.restore();
        }
      }
      c.restore();
    }
    c.restore();
  }

  _bodyY(t, phase, length, lateral = 0, dragon = false) {
    const amplitude = dragon ? .10 : .065;
    return Math.sin(phase - t * 4.4) * t * t * length * amplitude + lateral * length + this._renderBend * t * t * length * .095;
  }

  _bodyPoint(t, phase, length, lateral = 0, dragon = false) {
    return [(.47 - t * .94) * length, this._bodyY(t, phase, length, lateral, dragon)];
  }

  _bodyPath(c, phase, length, dragon = false) {
    const points = this._bodyScratch;
    let index = 0;
    for (let i = 0; i <= 27; i++) {
      const t = i / 27;
      points[index++] = (.47 - t * .94) * length;
      points[index++] = this._bodyY(t, phase, length, -widthAt(t) * (dragon ? .75 : 1), dragon);
    }
    for (let i = 27; i >= 0; i--) {
      const t = i / 27;
      points[index++] = (.47 - t * .94) * length;
      points[index++] = this._bodyY(t, phase, length, widthAt(t) * (dragon ? .75 : 1), dragon);
    }
    smoothFlatPath(c, points, 56);
  }

  _tail(c, f, length, shadow = false) {
    const dragon = f.type === 'dragon', [x, y] = this._bodyPoint(1, f.phase, length, 0, dragon);
    const flick = Math.sin(f.phase - 4.8) * .12 - (f.bend || 0) * .17;
    c.save(); c.translate(x, y); c.rotate(flick);
    const l = length * (dragon ? .39 : .32), spread = length * (dragon ? .20 : .17);
    const bend = Math.sin(f.phase - 5.3) * length * .048;
    const tailPath = () => {
      c.beginPath(); c.moveTo(length * .025, -length * .017);
      c.bezierCurveTo(-l * .45, -spread * .42, -l * .81, -spread + bend, -l, -spread + bend);
      c.bezierCurveTo(-l * 1.02, -spread * .46 + bend, -l * .73, -spread * .18 + bend, -l * .59, bend * .65);
      c.bezierCurveTo(-l * .75, spread * .22 + bend, -l, spread * .56 + bend, -l * .97, spread + bend);
      c.bezierCurveTo(-l * .61, spread * .79 + bend, -l * .39, spread * .29, length * .025, length * .017); c.closePath();
    };
    if (shadow) { tailPath(); c.fill(); c.restore(); return; }
    const gold = f.type === 'ogon' || dragon;
    const g = c.createLinearGradient(0, 0, -l, 0);
    g.addColorStop(0, gold ? 'rgba(224,178,75,.82)' : 'rgba(239,238,215,.80)');
    g.addColorStop(.65, gold ? 'rgba(245,214,129,.56)' : 'rgba(240,244,223,.56)');
    g.addColorStop(1, gold ? 'rgba(253,232,159,.30)' : 'rgba(235,246,225,.27)');
    c.fillStyle = g; tailPath(); c.fill();
    c.strokeStyle = gold ? 'rgba(255,237,162,.6)' : 'rgba(250,255,232,.52)'; c.lineWidth = .65; c.stroke();
    c.save(); tailPath(); c.clip();
    for (let pass = 0; pass < 2; pass++) {
      c.strokeStyle = pass ? 'rgba(97,130,107,.20)' : 'rgba(250,255,230,.4)';
      c.lineWidth = .65; c.beginPath();
      for (let i = -6 + pass; i <= 6; i += 2) {
        const q = i / 6;
        c.moveTo(0, q * length * .014);
        c.quadraticCurveTo(-l * .5, q * spread * .4 + bend * .3, -l * 1.05, q * spread + bend);
      }
      c.stroke();
    }
    c.restore();
    c.restore();
  }

  _fin(c, f, length, t, side, size, shadow = false) {
    const dragon = f.type === 'dragon';
    const [x, y] = this._bodyPoint(t, f.phase, length, widthAt(t) * side * .75, dragon);
    c.save(); c.translate(x, y); c.scale(1, side); c.rotate(Math.sin(f.phase + side * .8) * .08);
    const span = length * size, swept = length * size * .85;
    const shape = () => {
      c.beginPath(); c.moveTo(length * .035, 0);
      c.bezierCurveTo(length * .01, span * .58, -swept * .45, span, -swept * 1.09, span * .88);
      c.bezierCurveTo(-swept * 1.11, span * .5, -swept * .8, span * .11, -length * .045, -length * .01); c.closePath();
    };
    if (shadow) { shape(); c.fill(); c.restore(); return; }
    const gold = f.type === 'ogon' || dragon;
    const g = c.createLinearGradient(0, 0, -swept * .6, span);
    g.addColorStop(0, gold ? 'rgba(220,181,91,.77)' : 'rgba(218,224,202,.73)');
    g.addColorStop(1, gold ? 'rgba(255,227,144,.34)' : 'rgba(247,248,225,.37)');
    c.fillStyle = g; shape(); c.fill();
    c.strokeStyle = gold ? 'rgba(255,232,170,.55)' : 'rgba(250,255,234,.52)'; c.lineWidth = .65; c.stroke();
    c.save(); shape(); c.clip();
    for (let pass = 0; pass < 2; pass++) {
      c.strokeStyle = pass ? 'rgba(102,134,108,.18)' : 'rgba(255,255,237,.36)'; c.lineWidth = .6;
      c.beginPath();
      for (let i = pass; i < 8; i += 2) {
        const u = i / 7;
        c.moveTo(length * .02, 0);
        c.quadraticCurveTo(-swept * u * .48, span * .6, -swept * (u * .8 + .25), span * (.96 - u * .13));
      }
      c.stroke();
    }
    c.restore(); c.restore();
  }

  _patch(c, phase, length, t, side, rx, ry, color, seed, dragon = false) {
    let shape = this._patchShapes.get(seed);
    if (!shape) {
      shape = new Float32Array(24);
      const random = rng(seed);
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU, radius = .77 + random() * .42;
        shape[i * 2] = t + Math.cos(a) * rx * radius;
        shape[i * 2 + 1] = side + Math.sin(a) * ry * radius;
      }
      this._patchShapes.set(seed, shape);
    }
    const points = this._patchScratch;
    for (let i = 0; i < 12; i++) {
      const tt = shape[i * 2];
      points[i * 2] = (.47 - tt * .94) * length;
      points[i * 2 + 1] = this._bodyY(tt, phase, length, shape[i * 2 + 1], dragon);
    }
    c.fillStyle = color; smoothFlatPath(c, points, 12); c.fill();
  }

  _makeFishShadow(dragon) {
    const canvas = document.createElement('canvas');
    canvas.width = 420; canvas.height = 190;
    const c = canvas.getContext('2d'), length = 230;
    c.translate(270, 95);
    c.filter = 'blur(9px)';
    c.fillStyle = 'rgba(17,62,54,.17)';
    const fish = { type: dragon ? 'dragon' : 'kohaku', phase: 1.5 };
    this._bodyPath(c, fish.phase, length, dragon); c.fill();
    this._tail(c, fish, length, true);
    this._fin(c, fish, length, .25, -1, dragon ? .25 : .18, true);
    this._fin(c, fish, length, .25, 1, dragon ? .25 : .18, true);
    return canvas;
  }

  _fish(c, f) {
    const dragon = f.type === 'dragon';
    const length = this._fishLength(f);
    const gold = f.type === 'ogon' || dragon;
    this._renderBend = f.bend || 0;
    // Blurring every moving fin costs a full raster pass in Canvas2D. A soft
    // cached silhouette preserves depth with one small image draw per fish.
    const shadowScale = length / 230;
    c.save(); c.translate(f.x + 7, f.y + 13); c.rotate(f.angle);
    c.drawImage(this._shadows[dragon ? 'dragon' : 'koi'], -270 * shadowScale, -95 * shadowScale, 420 * shadowScale, 190 * shadowScale);
    c.restore();
    c.save(); c.translate(f.x, f.y); c.rotate(f.angle);
    this._tail(c, f, length);
    this._fin(c, f, length, .64, -1, .105);
    this._fin(c, f, length, .64, 1, .105);
    this._fin(c, f, length, .25, -1, dragon ? .25 : .185);
    this._fin(c, f, length, .25, 1, dragon ? .25 : .185);
    this._bodyPath(c, f.phase, length, dragon);
    const bodyGradient = c.createLinearGradient(0, -length * .14, 0, length * .14);
    if (gold) {
      bodyGradient.addColorStop(0, '#b08c42'); bodyGradient.addColorStop(.23, '#e5bb66');
      bodyGradient.addColorStop(.46, '#ffe7a0'); bodyGradient.addColorStop(.63, '#edcb7a'); bodyGradient.addColorStop(1, '#a68d50');
    } else if (f.type === 'silver') {
      bodyGradient.addColorStop(0, '#7d9f9c'); bodyGradient.addColorStop(.28, '#cbdcd3'); bodyGradient.addColorStop(.49, '#f5f8e8'); bodyGradient.addColorStop(1, '#87afa9');
    } else {
      bodyGradient.addColorStop(0, '#aebfb0'); bodyGradient.addColorStop(.20, '#e2e6d2');
      bodyGradient.addColorStop(.44, '#fff9e4'); bodyGradient.addColorStop(.61, '#f2f2df'); bodyGradient.addColorStop(1, '#b6c9b6');
    }
    c.fillStyle = bodyGradient; c.fill();
    c.save(); c.clip();
    if (!gold && f.type !== 'silver') {
      this._patch(c, f.phase, length, .11, -.008, .10, .065, '#d86439', 123);
      this._patch(c, f.phase, length, .15, -.022, .075, .048, '#e87b44', 124);
      this._patch(c, f.phase, length, .40, -.043, .145, .102, '#d56237', 18);
      this._patch(c, f.phase, length, .42, -.064, .105, .078, '#e27b43', 19);
      this._patch(c, f.phase, length, .72, .025, .102, .068, '#db693c', 39);
      if (f.type === 'sanke') {
        this._patch(c, f.phase, length, .30, .08, .08, .068, '#334843', 14);
        this._patch(c, f.phase, length, .56, -.04, .08, .067, '#304641', 44);
        this._patch(c, f.phase, length, .84, -.02, .06, .039, '#3b5147', 25);
        this._patch(c, f.phase, length, .11, .062, .047, .046, '#3e4e45', 75);
      }
    }
    // Overlapping scales follow the spine; head and gill covers remain smooth.
    c.lineWidth = Math.max(.45, length * .004);
    const scaleRadius = length * .023;
    c.strokeStyle = gold ? 'rgba(117,91,38,.24)' : 'rgba(73,111,87,.12)';
    c.beginPath();
    for (const scale of SCALE_LAYOUT) {
      if (Math.abs(scale.side) > scale.width * (dragon ? .75 : 1) + .01) continue;
      const x = (.47 - scale.t * .94) * length;
      const y = this._bodyY(scale.t, f.phase, length, scale.side, dragon);
      c.moveTo(x + scaleRadius * .58168309, y - scaleRadius * .8134155);
      c.arc(x, y, scaleRadius, -.95, .95);
    }
    c.stroke();
    if (gold) {
      c.strokeStyle = 'rgba(255,246,180,.38)'; c.beginPath();
      const r = scaleRadius * .83;
      for (const scale of SCALE_LAYOUT) {
        if (!scale.highlight || Math.abs(scale.side) > scale.width * (dragon ? .75 : 1) + .01) continue;
        const x = (.47 - scale.t * .94) * length + .7;
        const y = this._bodyY(scale.t, f.phase, length, scale.side, dragon) - .5;
        c.moveTo(x + r * .69670671, y - r * .71735609);
        c.arc(x, y, r, -.8, .8);
      }
      c.stroke();
    }
    // A thin dorsal ridge catches the sun along the curved body.
    c.strokeStyle = gold ? 'rgba(255,245,184,.44)' : 'rgba(255,255,244,.42)'; c.lineWidth = length * .018;
    c.beginPath();
    for (let i = 0; i < 18; i++) {
      const pt = this._bodyPoint(.24 + i * .032, f.phase, length, -.008, dragon);
      if (!i) c.moveTo(...pt); else c.lineTo(...pt);
    }
    c.stroke();
    const gloss = c.createLinearGradient(length * .45, -length * .1, length * .2, length * .15);
    gloss.addColorStop(0, 'rgba(255,255,240,.18)'); gloss.addColorStop(1, 'rgba(255,255,240,0)');
    c.fillStyle = gloss; c.fillRect(-length, -length * .2, length * 2, length * .4);
    c.restore();
    // Gill covers, inset eyes, small mouth and barbels give the head its anatomy.
    for (const side of [-1, 1]) {
      const [gx, gy] = this._bodyPoint(.19, f.phase, length, side * .078, dragon);
      c.strokeStyle = gold ? 'rgba(126,97,47,.33)' : 'rgba(90,123,98,.32)'; c.lineWidth = length * .006;
      c.beginPath(); c.moveTo(gx + length * .025, gy - side * length * .047);
      c.quadraticCurveTo(gx - length * .039, gy, gx - length * .015, gy + side * length * .027); c.stroke();
      const [ex, ey] = this._bodyPoint(.075, f.phase, length, side * (dragon ? .047 : .060), dragon);
      c.fillStyle = gold ? '#9e803d' : '#9cae8c'; c.beginPath(); c.ellipse(ex, ey, length * .024, length * .017, 0, 0, TAU); c.fill();
      c.fillStyle = '#172e2a'; c.beginPath(); c.ellipse(ex + length * .004, ey, length * .015, length * .012, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,234,.88)'; c.beginPath(); c.arc(ex + length * .008, ey - length * .004, Math.max(.65, length * .005), 0, TAU); c.fill();
      c.strokeStyle = gold ? 'rgba(255,234,174,.85)' : 'rgba(239,239,212,.85)'; c.lineWidth = Math.max(.7, length * .006);
      c.beginPath(); c.moveTo(length * .435, side * length * .025);
      c.quadraticCurveTo(length * .49, side * length * .053, length * .505, side * length * .037); c.stroke();
    }
    c.strokeStyle = gold ? 'rgba(120,88,45,.42)' : 'rgba(100,123,98,.42)'; c.lineWidth = Math.max(.65, length * .0055);
    c.beginPath(); c.moveTo(length * .454, -length * .018); c.quadraticCurveTo(length * .467, 0, length * .454, length * .018); c.stroke();
    if (dragon) this._dragonDetails(c, f, length);
    if (f.player && this.active) {
      // A quiet glint identifies your koi without covering the fish with a HUD.
      const glow = c.createRadialGradient(length * .55, 0, 0, length * .55, 0, 13);
      glow.addColorStop(0, 'rgba(255,243,188,.53)'); glow.addColorStop(1, 'rgba(255,243,188,0)');
      c.fillStyle = glow; c.beginPath(); c.arc(length * .55, 0, 13, 0, TAU); c.fill();
      c.fillStyle = '#fff4cb'; c.beginPath(); c.arc(length * .55, 0, 2, 0, TAU); c.fill();
    }
    c.restore();
    this._renderBend = 0;
  }

  _dragonDetails(c, f, length) {
    for (const side of [-1, 1]) {
      c.strokeStyle = '#f6dba0'; c.lineWidth = length * .019; c.lineCap = 'round';
      c.beginPath(); c.moveTo(length * .30, side * length * .044);
      c.quadraticCurveTo(length * .29, side * length * .12, length * .22, side * length * .16); c.stroke();
      c.lineWidth = length * .011;
      c.beginPath(); c.moveTo(length * .26, side * length * .12); c.lineTo(length * .32, side * length * .15); c.stroke();
      c.strokeStyle = 'rgba(255,226,155,.68)'; c.lineWidth = length * .008;
      c.beginPath(); c.moveTo(length * .44, side * length * .026);
      c.bezierCurveTo(length * .47, side * length * .21, length * .06, side * length * .21, -length * .16, side * length * (.19 + Math.sin(f.phase) * .025)); c.stroke();
    }
  }

  _drawWater(c) {
    if (!this._causticPattern) this._causticPattern = c.createPattern(this._caustic, 'repeat');
    c.save();
    const scale = this.w < 600 ? 1.6 : 2.0;
    c.globalAlpha = THEMES[this.theme].night ? .17 : .35;
    c.translate(Math.sin(this.time * .13) * 13, Math.cos(this.time * .11) * 13);
    c.scale(scale + Math.sin(this.time * .10) * .04, scale * .78);
    c.fillStyle = this._causticPattern;
    c.fillRect(-100, -100, this.w / scale + 220, this.h / (scale * .78) + 220);
    c.restore();
    // Long, nearly invisible reflection lines keep the surface feeling fluid.
    c.save(); c.lineWidth = .7;
    for (let i = 0; i < 8; i++) {
      const y = this.h * (i + .4) / 8 + Math.sin(this.time * .22 + i) * 9;
      c.strokeStyle = THEMES[this.theme].night ? 'rgba(194,227,228,.045)' : 'rgba(252,255,232,.075)';
      c.beginPath(); c.moveTo(-30, y);
      c.bezierCurveTo(this.w * .3, y - 23, this.w * .6, y + 20, this.w + 30, y - 4); c.stroke();
    }
    c.restore();
  }

  _drawPearls(c) {
    const fontSize = this.w < 600 ? 15 : 16;
    c.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const p of this.pearls) {
      const bob = Math.sin(this.time * 1.65 + p.phase) * 2.5;
      const x = p.x, y = p.y + bob, alpha = clamp((this.time - p.born) * 2, 0, 1);
      c.save(); c.globalAlpha = alpha;
      const halo = c.createRadialGradient(x, y, 2, x, y, 29);
      halo.addColorStop(0, 'rgba(255,235,161,.42)'); halo.addColorStop(.45, 'rgba(255,242,185,.18)'); halo.addColorStop(1, 'rgba(255,241,181,0)');
      c.fillStyle = halo; c.beginPath(); c.arc(x, y, 29, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(255,250,222,.42)'; c.lineWidth = .9;
      c.beginPath(); c.ellipse(x, y + 4, 21 + Math.sin(this.time * 1.2 + p.phase) * 2, 14, 0, 0, TAU); c.stroke();
      c.shadowColor = 'rgba(32,74,56,.22)'; c.shadowBlur = 7; c.shadowOffsetY = 6;
      const pearl = c.createRadialGradient(x - 3, y - 4, 1, x, y, 10);
      pearl.addColorStop(0, '#fffef0'); pearl.addColorStop(.47, '#ffedbe'); pearl.addColorStop(1, p.color || '#cfaa69');
      c.fillStyle = pearl; c.beginPath(); c.arc(x, y, 9, 0, TAU); c.fill();
      c.shadowBlur = 0; c.shadowOffsetY = 0;
      c.strokeStyle = 'rgba(255,255,237,.8)'; c.lineWidth = .8; c.stroke();
      c.fillStyle = '#fffef4'; c.beginPath(); c.arc(x - 2.6, y - 3.4, 2.1, 0, TAU); c.fill();
      const label = p.displayLabel;
      if (label) {
        const width = p.labelWidth;
        c.shadowColor = 'rgba(29,66,48,.11)'; c.shadowBlur = 8; c.shadowOffsetY = 3;
        c.fillStyle = 'rgba(252,251,235,.90)'; roundedRect(c, x - width / 2, y + 19, width, 31, 15.5); c.fill();
        c.shadowBlur = 0; c.shadowOffsetY = 0; c.strokeStyle = 'rgba(255,255,242,.65)'; c.lineWidth = 1; c.stroke();
        c.fillStyle = '#355b4d'; c.fillText(label, x, y + 35);
      }
      c.restore();
    }
  }

  _drawSurface(c) {
    const theme = THEMES[this.theme];
    c.fillStyle = theme.tint; c.fillRect(0, 0, this.w, this.h);
    for (const m of this._motes) {
      const x = (m.u * this.w + Math.sin(this.time * .12 + m.phase) * 12 + this.w) % this.w;
      const y = (m.v * this.h - this.time * 1.1 + this.h * 10) % this.h;
      c.fillStyle = `rgba(255,250,215,${(.08 + Math.sin(this.time * .9 + m.phase) * .045) * (theme.night ? 2 : 1)})`;
      c.beginPath(); c.arc(x, y, m.size, 0, TAU); c.fill();
    }
    for (const p of this._petals) {
      const x = (p.u * this.w + this.time * 2.7 * p.speed + Math.sin(this.time * .16 + p.phase) * 12 + this.w) % (this.w + 20) - 10;
      const y = (p.v * this.h + this.time * 1.25 * p.speed) % (this.h + 20) - 10;
      c.save(); c.translate(x, y); c.rotate(p.angle + Math.sin(this.time * .22 + p.phase) * .4);
      c.shadowColor = 'rgba(40,83,65,.19)'; c.shadowBlur = 3; c.shadowOffsetX = 2; c.shadowOffsetY = 2;
      c.fillStyle = theme.night ? '#cbbfc7' : '#f4d4c7';
      c.beginPath(); c.moveTo(-p.size, 0); c.quadraticCurveTo(0, -p.size * .9, p.size, -.8);
      c.quadraticCurveTo(p.size * .3, p.size * .8, -p.size, 0); c.fill();
      c.restore();
    }
    for (const r of this.ripples) {
      for (let i = 0; i < 2; i++) {
        const age = r.age - i * .22;
        if (age < 0) continue;
        const radius = 5 + age * 26 * r.strength;
        const alpha = Math.max(0, 1 - age / 2.3) * .30 * r.strength;
        c.strokeStyle = `${theme.ripple}${alpha})`; c.lineWidth = .8;
        c.beginPath(); c.ellipse(r.x, r.y, radius, radius * .74, 0, 0, TAU); c.stroke();
        c.strokeStyle = `rgba(31,93,76,${alpha * .3})`;
        c.beginPath(); c.ellipse(r.x, r.y + 1.4, radius + 1, radius * .74, 0, 0, TAU); c.stroke();
      }
    }
    for (const s of this.sparks) {
      c.globalAlpha = Math.max(0, 1 - s.age / s.life); c.fillStyle = s.color;
      c.beginPath(); c.arc(s.x, s.y, s.size, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
    if (this.active && this.target) {
      const distance = Math.hypot(this.target.x - this.player.x, this.target.y - this.player.y);
      if (distance > 45) {
        c.strokeStyle = 'rgba(255,250,223,.5)'; c.lineWidth = 1;
        c.beginPath(); c.arc(this.target.x, this.target.y, 7 + Math.sin(this.time * 3) * 1.5, 0, TAU); c.stroke();
        for (let i = 1; i <= 4; i++) {
          const q = i / 5, x = lerp(this.player.x, this.target.x, q), y = lerp(this.player.y, this.target.y, q);
          c.fillStyle = `rgba(255,252,229,${.08 + q * .16})`;
          c.beginPath(); c.arc(x, y, 1.5, 0, TAU); c.fill();
        }
      }
    }
  }

  _draw() {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.globalAlpha = 1;
    c.drawImage(this._backdrop, 0, 0, this.w, this.h);
    this._drawWater(c);
    for (const f of this.companions) this._fish(c, f);
    this._fish(c, this.player);
    c.fillStyle = THEMES[this.theme].tint; c.fillRect(0, 0, this.w, this.h);
    this._drawPearls(c);
    c.drawImage(this._canopy, 0, 0, this.w, this.h);
    this._drawSurface(c);
  }

  destroy() {
    this._destroyed = true;
    cancelAnimationFrame(this._raf);
    clearTimeout(this._resizeTimer);
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    this.canvas.removeEventListener('pointermove', this._onPointerMove);
    this.canvas.removeEventListener('pointerup', this._onPointerUp);
    this.canvas.removeEventListener('pointercancel', this._onPointerUp);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVisibility);
    this.keys.clear();
  }
}
