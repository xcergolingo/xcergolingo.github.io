import * as THREE from './vendor/three.module.js';

/** Bounded, instanced comic-book debris and world-anchored lettering. */
export function createEffects(scene, camera, containerElement) {
  const layer = document.createElement('div');
  layer.className = 'ink-effects-layer';
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, {
    position: 'fixed', inset: '0', pointerEvents: 'none', overflow: 'hidden',
    zIndex: '25', userSelect: 'none', contain: 'layout style paint'
  });
  (containerElement || document.body).appendChild(layer);

  const ink = new THREE.MeshBasicMaterial({color: '#171523', side: THREE.BackSide});
  const metal = new THREE.MeshBasicMaterial({color: '#ffffff'});
  const palette = ['#ffe9b4', '#ffc943', '#f0d6b5', '#4b747b', '#e77551'];
  const tempColor = new THREE.Color();
  const matrix = new THREE.Matrix4();
  const outlineMatrix = new THREE.Matrix4();
  const tempScale = new THREE.Vector3();
  const tempQuaternion = new THREE.Quaternion();
  const cameraPosition = new THREE.Vector3();
  const cameraDirection = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const relative = new THREE.Vector3();
  const cameraRotation = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const spinRotation = new THREE.Quaternion();

  const star = new THREE.Shape();
  for (let n = 0; n < 16; n++) {
    const a = n / 16 * Math.PI * 2;
    const r = n % 2 ? 0.035 : (n % 4 ? 0.10 : 0.15);
    if (!n) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  star.closePath();
  class SpringCurve extends THREE.Curve {
    getPoint(t, target = new THREE.Vector3()) {
      const a = t * Math.PI * 8;
      return target.set(Math.cos(a) * 0.073, (t - 0.5) * 0.29, Math.sin(a) * 0.073);
    }
  }
  const geometries = [
    new THREE.ExtrudeGeometry(star, {depth: 0.022, bevelEnabled: false}),
    new THREE.BoxGeometry(0.18, 0.11, 0.035),
    new THREE.TorusGeometry(0.065, 0.032, 4, 6),
    new THREE.TubeGeometry(new SpringCurve(), 32, 0.017, 4, false)
  ];
  const capacities = [112, 96, 64, 48];
  const groups = geometries.map((geometry, type) => {
    const mesh = new THREE.InstancedMesh(geometry, metal, capacities[type]);
    const outline = new THREE.InstancedMesh(geometry, ink, capacities[type]);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    outline.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = outline.frustumCulled = false;
    mesh.count = outline.count = 0;
    mesh.name = ['Comic sparks', 'Tin scraps', 'Flying bolts', 'Loose springs'][type];
    scene.add(outline, mesh);
    const particles = Array.from({length: capacities[type]}, () => ({
      active: false, position: new THREE.Vector3(), velocity: new THREE.Vector3(),
      rotation: new THREE.Euler(), spin: new THREE.Vector3(), color: new THREE.Color(),
      size: 1, age: 0, life: 1, gravity: 14, bounces: 0
    }));
    return {mesh, outline, particles, cursor: 0};
  });

  const words = Array.from({length: 14}, () => {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'absolute', top: '0', left: '0', display: 'none',
      fontFamily: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
      fontWeight: '900', fontStyle: 'italic', lineHeight: '1.05',
      letterSpacing: '-.025em', whiteSpace: 'nowrap',
      WebkitTextStroke: '2px #171523', paintOrder: 'stroke fill',
      textShadow: '3px 4px 0 #171523, -1px 2px 0 #fff1cd',
      transformOrigin: '50% 60%', willChange: 'transform, opacity'
    });
    layer.appendChild(el);
    return {el, active: false, position: new THREE.Vector3(), age: 0, life: 0.85, angle: 0, size: 1};
  });
  let wordCursor = 0;

  function burst(position, {color = '#ffc943', count = 16, kind = 'hit'} = {}) {
    count = Math.min(100, Math.max(0, Math.round(count)));
    const death = kind === 'death';
    const dash = kind === 'dash';
    tempColor.set(color);
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      const type = dash ? (r < 0.8 ? 0 : 1)
        : death ? (r < 0.2 ? 0 : r < 0.53 ? 1 : r < 0.78 ? 2 : 3)
        : (r < 0.55 ? 0 : r < 0.8 ? 1 : r < 0.94 ? 2 : 3);
      const pool = groups[type];
      const p = pool.particles[pool.cursor];
      pool.cursor = (pool.cursor + 1) % pool.particles.length;
      p.active = true;
      p.age = 0;
      p.bounces = 0;
      p.life = type === 0 ? 0.24 + Math.random() * 0.25 : 0.65 + Math.random() * 0.8;
      if (dash) p.life *= 0.65;
      p.position.copy(position);
      p.position.x += (Math.random() - 0.5) * 0.25;
      p.position.y += (Math.random() - 0.5) * 0.3;
      p.position.z += (Math.random() - 0.5) * 0.25;
      const a = Math.random() * Math.PI * 2;
      const speed = (death ? 3.1 : 1.5) + Math.random() * (death ? 4.3 : 3.6);
      p.velocity.set(Math.cos(a) * speed, 1.8 + Math.random() * (death ? 5.6 : 3.7), Math.sin(a) * speed);
      p.rotation.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
      p.spin.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18);
      p.size = (type === 0 ? 1.2 : 0.8) + Math.random() * (death ? 1.4 : 0.85);
      p.gravity = type === 0 ? 3 : 14;
      if (type === 0 || dash || Math.random() < 0.28) p.color.copy(tempColor);
      else p.color.set(palette[(Math.random() * palette.length) | 0]);
    }
  }

  function text(position, word, {color = '#ffc943', size = 1} = {}) {
    const item = words[wordCursor];
    wordCursor = (wordCursor + 1) % words.length;
    item.active = true;
    item.position.copy(position);
    item.age = 0;
    item.life = word.length > 11 ? 1.1 : 0.84;
    item.angle = (Math.random() - 0.5) * 23;
    item.size = size;
    item.el.textContent = String(word);
    item.el.style.color = color;
    const fontSize = Math.min(54, Math.max(33, window.innerWidth * 0.037));
    item.el.style.fontSize = `${fontSize * (word.length > 12 ? 0.7 : word.length > 8 ? 0.83 : 1) * size}px`;
    item.el.style.display = 'block';
    item.el.style.opacity = '0';
  }

  function update(dt) {
    dt = Math.min(Math.max(dt, 0), 0.06);
    camera.getWorldPosition(cameraPosition);
    camera.getWorldDirection(cameraDirection);
    camera.getWorldQuaternion(cameraRotation);
    for (let type = 0; type < groups.length; type++) {
      const pool = groups[type];
      let count = 0;
      for (const p of pool.particles) {
        if (!p.active) continue;
        p.age += dt;
        if (p.age >= p.life) { p.active = false; continue; }
        p.velocity.y -= p.gravity * dt;
        p.position.addScaledVector(p.velocity, dt);
        if (p.position.y < 0.045 && p.velocity.y < 0) {
          p.position.y = 0.045;
          p.velocity.y *= -0.32;
          p.velocity.x *= 0.63;
          p.velocity.z *= 0.63;
          p.spin.multiplyScalar(0.6);
          p.bounces++;
          if (p.bounces > 2) p.velocity.y = 0;
        }
        p.rotation.x += p.spin.x * dt;
        p.rotation.y += p.spin.y * dt;
        p.rotation.z += p.spin.z * dt;
        if (type === 0) {
          spinRotation.setFromAxisAngle(zAxis, p.rotation.z);
          tempQuaternion.copy(cameraRotation).multiply(spinRotation);
        } else tempQuaternion.setFromEuler(p.rotation);
        const fade = Math.min(1, (p.life - p.age) / (type === 0 ? 0.2 : 0.3));
        tempScale.setScalar(Math.max(0.005, p.size * fade));
        matrix.compose(p.position, tempQuaternion, tempScale);
        pool.mesh.setMatrixAt(count, matrix);
        pool.mesh.setColorAt(count, p.color);
        tempScale.multiplyScalar(type === 3 ? 1.13 : 1.22);
        outlineMatrix.compose(p.position, tempQuaternion, tempScale);
        pool.outline.setMatrixAt(count, outlineMatrix);
        count++;
      }
      pool.mesh.count = pool.outline.count = count;
      if (count) {
        pool.mesh.instanceMatrix.needsUpdate = true;
        pool.outline.instanceMatrix.needsUpdate = true;
        pool.mesh.instanceColor.needsUpdate = true;
      }
    }

    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const item of words) {
      if (!item.active) continue;
      item.age += dt;
      if (item.age >= item.life) {
        item.active = false;
        item.el.style.display = 'none';
        continue;
      }
      projected.copy(item.position);
      projected.y += item.age * 0.7;
      relative.subVectors(projected, cameraPosition);
      projected.project(camera);
      if (relative.dot(cameraDirection) <= 0.1 || projected.z > 1 || Math.abs(projected.x) > 1.35 || Math.abs(projected.y) > 1.35) {
        item.el.style.opacity = '0';
        continue;
      }
      const t = Math.min(1, item.age / 0.14) - 1;
      const scale = (0.25 + 0.75 * (1 + 2.70158 * t * t * t + 1.70158 * t * t));
      const alpha = Math.min(1, item.age / 0.025, (item.life - item.age) / 0.23);
      const x = (projected.x * 0.5 + 0.5) * w;
      const y = (-projected.y * 0.5 + 0.5) * h - item.age * 20;
      item.el.style.opacity = String(Math.max(0, alpha));
      item.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%) rotate(${item.angle.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
    }
  }

  function clear() {
    for (const pool of groups) {
      for (const p of pool.particles) p.active = false;
      pool.mesh.count = pool.outline.count = 0;
    }
    for (const item of words) {
      item.active = false;
      item.el.style.display = 'none';
    }
  }

  function dispose() {
    clear();
    layer.remove();
    for (const pool of groups) {
      scene.remove(pool.mesh, pool.outline);
      pool.mesh.dispose();
      pool.outline.dispose();
    }
    geometries.forEach(g => g.dispose());
    ink.dispose();
    metal.dispose();
  }

  return {burst, text, update, clear, dispose};
}
