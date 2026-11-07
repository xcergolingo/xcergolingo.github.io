/** Real Yokohama PLATEAU tiles, in metres. See CREDITS.txt for the data license.
 * All source tiles stay in the skyline. Nearby tiles use the richer mobile meshes.
 */
export class CityWorld {
  constructor(THREE, loader, scene, options = {}) {
    this.THREE = THREE;
    this.loader = loader;
    this.scene = scene;
    this.onProgress = options.onProgress || (() => {});
    this.base = new URL('../assets/city/', import.meta.url);
    this.radius = options.radius || 3200;
    this.maxTiles = options.maxTiles || 12;
    this.maxConcurrent = Math.max(1, options.maxConcurrent || 2);
    this.startupTiles = Math.max(1, options.startupTiles || 4);
    this.timeout = options.timeout || 25000;
    this.loaded = new Map(); // Rich nearby meshes; the skyline remains cached underneath.
    this.skyline = new Map();
    this.loading = new Map();
    this.heightfields = new Map();
    this.queue = [];
    this.failed = new Map();
    this.desired = new Set();
    this.lastPosition = new THREE.Vector3(225.51, 200, 555.55);
    this.ready = false;
    this.visualReady = false;
    this.collisionReady = false;
    this.manifest = null;
    this.disposed = false;
    this.preloading = true;
    this.timer = 0;
    this.stats = { loaded: 0, near: 0, far: 0, skylineLoaded: 0, loading: 0, queued: 0,
      total: 0, heightfields: 0, collisionReady: false, failed: 0, optionalFailed: 0,
      errors: [], bytesLoaded: 0, triangles: 0, detail: 'auto' };
    this.group = new THREE.Group();
    this.group.name = 'Yokohama • PLATEAU city';
    scene.add(this.group);
    this.setDetail(options.detail || 'auto');
    this.initPromise = this.init();
  }

  /** A deadline also covers a stalled response body, so a missing asset cannot hang startup. */
  async fetchAsset(path, json = false) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await fetch(new URL(path, this.base), { signal: controller.signal });
      if (!response.ok) throw new Error(`City asset ${path}: ${response.status}`);
      return await (json ? response.json() : response.arrayBuffer());
    } catch (error) {
      if (controller.signal.aborted) throw new Error(`City asset timed out: ${path}`);
      throw error;
    } finally { clearTimeout(timer); }
  }

  async init() {
    this.manifest = await this.fetchAsset('manifest.json', true);
    this.stats.total = this.manifest.tiles.length;
    const queue = [...this.manifest.tiles];
    const worker = async () => {
      while (queue.length && !this.disposed) {
        const tile = queue.shift();
        try {
          const field = this.decodeHeightfield(await this.fetchAsset(tile.heightfield));
          if (this.disposed) return;
          field.offset = tile.offset_m;
          this.heightfields.set(tile.id, field);
          this.stats.heightfields++;
        } catch (error) {
          this.stats.errors.push({ id: tile.id, stage: 'heightfield', message: String(error.message || error) });
        }
        this.notify();
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    this.ready = true;
    this.collisionReady = this.heightfields.size === this.manifest.tiles.length;
    this.stats.collisionReady = this.collisionReady;
    this.notify();
    return this;
  }

  decodeHeightfield(buffer) {
    const view = new DataView(buffer);
    if (view.getUint32(0, true) !== 0x31464859) throw new Error('Unrecognized city heightfield');
    const width = view.getUint16(4, true), height = view.getUint16(6, true);
    const bounds = [8, 12, 16, 20].map(offset => view.getFloat32(offset, true));
    const step = view.getFloat32(24, true), count = view.getUint32(28, true);
    if (count !== width * height * 2) throw new Error('Invalid city heightfield dimensions');
    const values = new Uint16Array(count);
    let at = 0;
    for (let i = 32; i + 3 < buffer.byteLength; i += 4) {
      const length = view.getUint16(i, true), value = view.getUint16(i + 2, true);
      if (!length || at + length > count) throw new Error('Corrupt city heightfield run');
      values.fill(value, at, at + length);
      at += length;
    }
    if (at !== count) throw new Error('Incomplete city heightfield');
    return { width, height, bounds, step, ground: values.subarray(0, width * height), obstacle: values.subarray(width * height) };
  }

  notify() {
    const visible = new Set([...this.skyline.keys(), ...this.loaded.keys()]);
    this.stats.loaded = visible.size;
    this.stats.near = this.loaded.size;
    this.stats.far = visible.size - this.loaded.size;
    this.stats.skylineLoaded = this.skyline.size;
    this.stats.loading = this.loading.size;
    this.stats.queued = this.queue.length;
    // A distant request or a detail upgrade can fail without interrupting safe flight.
    // A required tile is unavailable only if both genuine representations have failed.
    let critical = 0;
    for (const id of this.desired) {
      if (!visible.has(id) && this.failed.has(`near:${id}`) && this.failed.has(`far:${id}`)) critical++;
    }
    this.stats.failed = critical;
    this.stats.optionalFailed = Math.max(0, this.failed.size - critical * 2);
    this.stats.triangles = 0;
    for (const [id, entry] of this.skyline) {
      if (!this.loaded.has(id)) this.stats.triangles += entry.tile.skyline_triangles || 0;
    }
    for (const entry of this.loaded.values()) this.stats.triangles += entry.tile.model_triangles || 0;
    try { this.onProgress(this.stats); } catch (_) { /* Status UI must not break scenery. */ }
  }

  distanceSquared(tile, position) {
    const b = tile.local_bounds, o = tile.offset_m;
    const dx = Math.max(b[0] + o[0] - position.x, 0, position.x - b[1] - o[0]);
    const dz = Math.max(b[2] + o[2] - position.z, 0, position.z - b[3] - o[2]);
    return dx * dx + dz * dz;
  }

  rank(position, ahead = null) {
    return this.manifest.tiles.map(tile => ({ tile, distance: Math.min(this.distanceSquared(tile, position),
      ahead ? this.distanceSquared(tile, ahead) : Infinity) }))
      .sort((a, b) => a.distance - b.distance || Number(b.tile.textured) - Number(a.tile.textured));
  }

  select(position, radius = this.nearRadius) {
    const ranked = this.rank(position);
    const candidates = ranked.filter(entry => entry.distance <= radius * radius);
    return (candidates.length ? candidates : ranked.slice(0, 4)).slice(0, this.nearLimit).map(entry => entry.tile);
  }

  /** All settings retain all 23 real source tiles; only nearby mesh detail changes. */
  setDetail(mode = 'auto') {
    if (!['auto', 'low', 'high'].includes(mode)) throw new Error(`Unknown city detail: ${mode}`);
    const limits = { low: 4, auto: 8, high: 14 };
    const radii = { low: 1600, auto: 2400, high: 3600 };
    this.detail = mode;
    this.nearLimit = Math.min(this.maxTiles, limits[mode]);
    this.nearRadius = Math.min(this.radius, radii[mode]);
    this.stats.detail = mode;
    this.timer = 1;
    if (this.ready && !this.preloading) this.reconcile(this.lastPosition);
    return mode;
  }

  /** Preload a useful foreground, then fill the whole city while the briefing remains responsive.
   * Optional `ahead` prioritizes the first stretch of a planned flight path.
   */
  async preload(position, radius = 1500, { ahead = null } = {}) {
    await this.initPromise;
    if (this.disposed) return this;
    if (!this.collisionReady) throw new Error('Some city collision data is missing. Please reload to try again.');
    this.lastPosition.copy(position);
    const ranked = this.rank(position, ahead);
    const close = ranked.filter(entry => entry.distance <= radius * radius);
    const tiles = (close.length ? close : ranked).slice(0, Math.min(this.startupTiles, this.nearLimit)).map(entry => entry.tile);
    this.desired = new Set(tiles.map(tile => tile.id));
    const waiting = [...tiles];
    const worker = async () => {
      while (waiting.length && !this.disposed) {
        const tile = waiting.shift();
        await this.loadTile(tile, 'near');
        if (!this.loaded.has(tile.id)) await this.loadTile(tile, 'far');
      }
    };
    await Promise.all(Array.from({ length: this.maxConcurrent }, worker));
    this.visualReady = tiles.every(tile => this.loaded.has(tile.id) || this.skyline.has(tile.id));
    this.notify();
    if (!this.visualReady) throw new Error('The city scenery could not be loaded. Please reload to try again.');
    this.preloading = false;
    this.reconcile(position);
    return this;
  }

  async parseModel(buffer) {
    let expired = false, timeout;
    const parsed = this.loader.parseAsync(buffer, this.base.href).then(gltf => {
      if (expired || this.disposed) { this.release(gltf.scene); throw new Error('City decode was cancelled'); }
      return gltf;
    });
    try {
      return await Promise.race([parsed, new Promise((_, reject) => {
        timeout = setTimeout(() => { expired = true; reject(new Error('City model decode timed out')); }, this.timeout);
      })]);
    } finally { clearTimeout(timeout); }
  }

  async loadTile(tile, level = 'near') {
    const store = level === 'near' ? this.loaded : this.skyline;
    const key = `${level}:${tile.id}`;
    if (this.disposed || store.has(tile.id)) return store.get(tile.id)?.object || null;
    if (this.loading.has(key)) return this.loading.get(key);
    const failure = this.failed.get(key);
    if (failure && performance.now() - failure.time < 15000) return null;
    const promise = (async () => {
      try {
        const path = level === 'near' ? tile.model : (tile.skyline || tile.model);
        const gltf = await this.parseModel(await this.fetchAsset(path));
        if (this.disposed) { this.release(gltf.scene); return null; }
        if (level === 'near' && !this.desired.has(tile.id) && this.skyline.has(tile.id)) {
          this.release(gltf.scene);
          this.failed.delete(key);
          this.stats.bytesLoaded += tile.model_bytes;
          return this.skyline.get(tile.id).object;
        }
        const object = gltf.scene;
        object.name = `${tile.id} • ${level}`;
        object.position.fromArray(tile.offset_m);
        object.userData.cityTile = tile;
        object.userData.cityDetail = level;
        object.traverse(child => {
          if (!child.isMesh) return;
          child.castShadow = false;
          child.receiveShadow = true;
          child.frustumCulled = true;
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          for (const material of materials) {
            if (!material) continue;
            if ('metalness' in material) material.metalness = 0;
            if ('roughness' in material) material.roughness = Math.max(.85, material.roughness || 0);
            if ('envMapIntensity' in material) material.envMapIntensity = .4;
          }
        });
        object.visible = level === 'near' || !this.loaded.has(tile.id);
        this.group.add(object);
        store.set(tile.id, { object, tile, lastUsed: performance.now() });
        if (level === 'near' && this.skyline.has(tile.id)) this.skyline.get(tile.id).object.visible = false;
        if (level === 'far' && this.loaded.has(tile.id) && !this.desired.has(tile.id)) {
          const previous = this.loaded.get(tile.id);
          object.visible = true;
          this.group.remove(previous.object);
          this.release(previous.object);
          this.loaded.delete(tile.id);
        }
        this.failed.delete(key);
        this.stats.bytesLoaded += level === 'near' ? tile.model_bytes : (tile.skyline_bytes || tile.model_bytes);
        this.visualReady = true;
        return object;
      } catch (error) {
        if (this.disposed) return null;
        const message = String(error.message || error);
        this.failed.set(key, { time: performance.now(), message });
        const stage = level === 'near' ? 'model' : 'skyline';
        if (!this.stats.errors.some(e => e.id === tile.id && e.stage === stage)) this.stats.errors.push({ id: tile.id, stage, message });
        return null;
      } finally {
        this.loading.delete(key);
        if (!this.disposed) {
          this.notify();
          if (!this.preloading) this.pump();
        }
      }
    })();
    this.loading.set(key, promise);
    this.notify();
    return promise;
  }

  reconcile(position) {
    if (!this.ready || this.preloading || this.disposed) return;
    const wanted = this.select(position);
    this.desired = new Set(wanted.map(tile => tile.id));
    for (const [id, entry] of this.loaded) {
      if (this.desired.has(id)) entry.lastUsed = performance.now();
      else if (this.skyline.has(id)) {
        // Switch only once the genuine far mesh is ready: never leave a city-shaped hole.
        this.skyline.get(id).object.visible = true;
        this.group.remove(entry.object);
        this.release(entry.object);
        this.loaded.delete(id);
      }
    }
    const queued = [];
    const add = (tile, level, priority) => {
      const key = `${level}:${tile.id}`;
      const store = level === 'near' ? this.loaded : this.skyline;
      const failure = this.failed.get(key);
      if (!store.has(tile.id) && !this.loading.has(key) && (!failure || performance.now() - failure.time >= 15000)) queued.push({ tile, level, priority });
    };
    for (const { tile, distance } of this.rank(position)) {
      // Fill missing districts before refining distant foreground detail.
      if (!this.skyline.has(tile.id)) add(tile, 'far', (this.loaded.has(tile.id) ? 3e8 : 1e7) + distance);
      if (this.desired.has(tile.id)) add(tile, 'near', (distance < 640000 ? 0 : 2e8) + distance);
    }
    this.queue = queued.sort((a, b) => a.priority - b.priority);
    this.pump();
    this.notify();
  }

  pump() {
    if (this.preloading || this.disposed) return;
    while (this.queue.length && this.loading.size < this.maxConcurrent) {
      const task = this.queue.shift();
      this.loadTile(task.tile, task.level);
    }
  }

  update(position, dt = .016) {
    if (!this.ready || this.disposed || !this.manifest) return;
    this.lastPosition.copy(position);
    this.timer += dt;
    if (this.timer < .65) return;
    this.timer = 0;
    this.reconcile(position);
  }

  /** Highest source terrain/building surface in metres. The ocean and uncovered cells are 0. */
  heightAt(x, z, terrainOnly = false) {
    let maximum = 0;
    for (const field of this.heightfields.values()) {
      const lx = x - field.offset[0], lz = z - field.offset[2], b = field.bounds;
      if (lx < b[0] || lx > b[1] || lz < b[2] || lz > b[3]) continue;
      const u = (lx - b[0]) / (b[1] - b[0]) * (field.width - 1);
      const v = (lz - b[2]) / (b[3] - b[2]) * (field.height - 1);
      const ix = Math.min(field.width - 2, Math.max(0, Math.floor(u)));
      const iz = Math.min(field.height - 2, Math.max(0, Math.floor(v)));
      const a = iz * field.width + ix, grid = terrainOnly ? field.ground : field.obstacle;
      let h;
      if (terrainOnly) {
        const fx = u - ix, fz = v - iz;
        h = ((grid[a] * (1 - fx) + grid[a + 1] * fx) * (1 - fz) +
          (grid[a + field.width] * (1 - fx) + grid[a + field.width + 1] * fx) * fz) * field.step;
      } else {
        // Include the previous raster pixel: degenerate wall projections may
        // rasterize on that side of their exact continuous coordinates.
        // This also gives narrow structures a conservative one-cell margin.
        let highest = 0;
        for (let dz = -1; dz <= 1; dz++) {
          const row = Math.min(field.height - 1, Math.max(0, iz + dz)) * field.width;
          for (let dx = -1; dx <= 1; dx++) {
            highest = Math.max(highest, grid[row + Math.min(field.width - 1, Math.max(0, ix + dx))]);
          }
        }
        h = highest * field.step;
      }
      maximum = Math.max(maximum, h + field.offset[1]);
    }
    return maximum;
  }

  /** Returns whether this horizontal position is covered by a source heightfield. */
  contains(x, z) {
    for (const field of this.heightfields.values()) {
      const b = field.bounds, lx = x - field.offset[0], lz = z - field.offset[2];
      if (lx >= b[0] && lx <= b[1] && lz >= b[2] && lz <= b[3]) return true;
    }
    return false;
  }

  retry() {
    this.failed.clear();
    this.timer = 1;
    if (this.ready && !this.preloading) this.reconcile(this.lastPosition);
  }

  release(object) {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    object.traverse(child => {
      if (child.geometry) geometries.add(child.geometry);
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
        if (!material) continue;
        materials.add(material);
        for (const value of Object.values(material)) if (value && value.isTexture) textures.add(value);
      }
    });
    for (const texture of textures) { texture.dispose(); if (texture.source?.data?.close) texture.source.data.close(); }
    for (const material of materials) material.dispose();
    for (const geometry of geometries) geometry.dispose();
  }

  dispose() {
    this.disposed = true;
    for (const entry of [...this.loaded.values(), ...this.skyline.values()]) {
      this.group.remove(entry.object);
      this.release(entry.object);
    }
    this.loaded.clear();
    this.skyline.clear();
    this.queue = [];
    this.heightfields.clear();
    this.scene.remove(this.group);
  }
}
