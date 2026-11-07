/**
 * Obstacle-aware flow-field navigation shared by every enemy.
 * The grid is rebuilt only when the target moves or its refresh timer expires;
 * monsters then follow the same field with line-of-sight smoothing. No physics
 * engine or browser API is needed, which also makes simulation checks possible.
 */
export class FlowField {
  constructor(colliders = [], options = {}) {
    this.obstacles = colliders;
    this.cell = options.cell ?? 0.5;
    this.radius = options.radius ?? 0.43;
    this.minX = options.minX ?? -16;
    this.maxX = options.maxX ?? 16;
    this.minZ = options.minZ ?? -24;
    this.maxZ = options.maxZ ?? 10;
    this.width = Math.ceil((this.maxX - this.minX) / this.cell);
    this.height = Math.ceil((this.maxZ - this.minZ) / this.cell);
    this.size = this.width * this.height;
    this.blocked = new Uint8Array(this.size);
    this.distance = new Int16Array(this.size);
    this.next = new Int32Array(this.size);
    this.queue = new Int32Array(this.size);
    this.goal = -1;
    this.cooldown = 0;
    this.direction = { x: 0, z: 0 };
    this.buildObstacles();
    this.invalidate();
  }

  invalidate() {
    this.cooldown = 0;
    this.goal = -1;
    this.distance.fill(-1);
    this.next.fill(-1);
  }

  buildObstacles() {
    const p = this.radius;
    for (let i = 0; i < this.size; i++) {
      const x = this.minX + ((i % this.width) + 0.5) * this.cell;
      const z = this.minZ + (Math.floor(i / this.width) + 0.5) * this.cell;
      this.blocked[i] = this.obstacles.some(o =>
        x >= o.minX - p && x <= o.maxX + p &&
        z >= o.minZ - p && z <= o.maxZ + p
      ) ? 1 : 0;
    }
  }

  cellIndex(x, z) {
    const cx = Math.max(0, Math.min(this.width - 1, Math.floor((x - this.minX) / this.cell)));
    const cz = Math.max(0, Math.min(this.height - 1, Math.floor((z - this.minZ) / this.cell)));
    return cz * this.width + cx;
  }

  nearestFree(x, z) {
    const original = this.cellIndex(x, z);
    if (!this.blocked[original]) return original;
    const cx = original % this.width;
    const cz = Math.floor(original / this.width);
    let result = -1, best = Infinity;
    for (let radius = 1; radius <= 9 && result < 0; radius++) {
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;
          const ix = cx + dx, iz = cz + dz;
          if (ix < 0 || iz < 0 || ix >= this.width || iz >= this.height) continue;
          const index = iz * this.width + ix;
          if (this.blocked[index]) continue;
          const px = this.minX + (ix + 0.5) * this.cell;
          const pz = this.minZ + (iz + 0.5) * this.cell;
          const d = (px - x) ** 2 + (pz - z) ** 2;
          if (d < best) { best = d; result = index; }
        }
      }
    }
    return result;
  }

  /** Returns true when a segment crosses an inflated solid fixture or wall. */
  blockedSegment(ax, az, bx, bz, radius = this.radius) {
    const vx = bx - ax, vz = bz - az;
    for (const o of this.obstacles) {
      const minX = o.minX - radius, maxX = o.maxX + radius;
      const minZ = o.minZ - radius, maxZ = o.maxZ + radius;
      let t0 = 0, t1 = 1;
      if (Math.abs(vx) < 1e-9) {
        if (ax <= minX || ax >= maxX) continue;
      } else {
        let a = (minX - ax) / vx, b = (maxX - ax) / vx;
        if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, b);
        if (t0 > t1) continue;
      }
      if (Math.abs(vz) < 1e-9) {
        if (az <= minZ || az >= maxZ) continue;
      } else {
        let a = (minZ - az) / vz, b = (maxZ - az) / vz;
        if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, b);
        if (t0 > t1) continue;
      }
      if (t0 <= t1 && t1 > 0.0001 && t0 < 0.9999) return true;
    }
    return false;
  }

  update(dt, player) {
    this.cooldown -= dt;
    const target = this.nearestFree(player.x, player.z);
    if (target < 0 || (target === this.goal && this.cooldown > 0)) return;
    this.cooldown = 0.35;
    this.goal = target;
    this.distance.fill(-1);
    this.next.fill(-1);
    let read = 0, write = 0;
    this.queue[write++] = target;
    this.distance[target] = 0;
    this.next[target] = target;
    while (read < write) {
      const current = this.queue[read++];
      const x = current % this.width, z = Math.floor(current / this.width);
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dz) || x + dx < 0 || x + dx >= this.width || z + dz < 0 || z + dz >= this.height) continue;
          const index = current + dz * this.width + dx;
          if (this.blocked[index] || this.distance[index] >= 0) continue;
          // A diagonal may not squeeze through the corner between two fixtures.
          if (dx && dz && (this.blocked[current + dx] || this.blocked[current + dz * this.width])) continue;
          this.distance[index] = this.distance[current] + 1;
          this.next[index] = current;
          this.queue[write++] = index;
        }
      }
    }
  }

  steer(position, target) {
    let x = target.x, z = target.z;
    if (this.blockedSegment(position.x, position.z, x, z)) {
      let index = this.nearestFree(position.x, position.z);
      if (index < 0 || this.next[index] < 0) {
        this.direction.x = 0; this.direction.z = 0;
        return this.direction;
      }
      let waypoint = this.next[index];
      // Looking a few cells ahead removes the robotic stair-step movement.
      for (let step = 0; step < 5; step++) {
        const candidate = this.next[waypoint];
        if (candidate < 0 || candidate === waypoint) break;
        const px = this.minX + ((candidate % this.width) + 0.5) * this.cell;
        const pz = this.minZ + (Math.floor(candidate / this.width) + 0.5) * this.cell;
        if (this.blockedSegment(position.x, position.z, px, pz)) break;
        waypoint = candidate;
      }
      x = this.minX + ((waypoint % this.width) + 0.5) * this.cell;
      z = this.minZ + (Math.floor(waypoint / this.width) + 0.5) * this.cell;
    }
    const dx = x - position.x, dz = z - position.z;
    const length = Math.hypot(dx, dz);
    this.direction.x = length > 0.015 ? dx / length : 0;
    this.direction.z = length > 0.015 ? dz / length : 0;
    return this.direction;
  }

  /** Resolve a moving circle against solid AABBs, including rounded corners. */
  move(position, dx, dz, radius) {
    position.x = Math.max(this.minX + radius, Math.min(this.maxX - radius, position.x + dx));
    position.z = Math.max(this.minZ + radius, Math.min(this.maxZ - radius, position.z + dz));
    for (let iteration = 0; iteration < 3; iteration++) {
      let collided = false;
      for (const o of this.obstacles) {
        const px = Math.max(o.minX, Math.min(o.maxX, position.x));
        const pz = Math.max(o.minZ, Math.min(o.maxZ, position.z));
        const vx = position.x - px, vz = position.z - pz;
        const squared = vx * vx + vz * vz;
        if (squared >= radius * radius) continue;
        collided = true;
        if (squared > 0.000001) {
          const distance = Math.sqrt(squared);
          const push = (radius - distance + 0.001) / distance;
          position.x += vx * push; position.z += vz * push;
        } else {
          const sides = [
            position.x - o.minX, o.maxX - position.x,
            position.z - o.minZ, o.maxZ - position.z
          ];
          const minimum = Math.min(...sides);
          const side = sides.indexOf(minimum);
          if (side === 0) position.x = o.minX - radius - 0.001;
          if (side === 1) position.x = o.maxX + radius + 0.001;
          if (side === 2) position.z = o.minZ - radius - 0.001;
          if (side === 3) position.z = o.maxZ + radius + 0.001;
        }
      }
      if (!collided) break;
    }
    return position;
  }
}
