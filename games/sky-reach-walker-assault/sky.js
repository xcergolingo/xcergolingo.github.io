import * as THREE from './vendor/three.module.js';

/** Continuous atmospheric sky and fixed, physically positioned ringed giant. */
export function createSky(scene) {
  const skyGroup = new THREE.Group();
  skyGroup.name = 'Distant sky';
  scene.add(skyGroup);
  const palettes = {
    elysia: ['#448cc1', '#c5e4db', '#92b3a0'],
    vesper: ['#476e61', '#c7d6a4', '#779c88'],
    sahra: ['#9b796f', '#f2d3a0', '#b79781'],
    nivalis: ['#527ca9', '#d5e5e9', '#9cbdc9'],
  };
  const uniforms = {
    uAtmosphere: { value: 1 },
    uTime: { value: 0 },
    uZenith: { value: new THREE.Color(palettes.elysia[0]) },
    uHorizon: { value: new THREE.Color(palettes.elysia[1]) },
    uLower: { value: new THREE.Color(palettes.elysia[2]) },
    uSun: { value: new THREE.Vector3(0.62, 0.64, -0.45).normalize() },
  };
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uAtmosphere;
      uniform float uTime;
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uLower;
      uniform vec3 uSun;
      varying vec3 vDirection;
      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float noise2(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash21(i), hash21(i + vec2(1., 0.)), f.x),
                   mix(hash21(i + vec2(0., 1.)), hash21(i + vec2(1., 1.)), f.x), f.y);
      }
      float cloudNoise(vec2 p) {
        return noise2(p) * .57 + noise2(p * 2.13 + 9.2) * .28 + noise2(p * 4.31 - 4.7) * .15;
      }
      void main() {
        vec3 d = normalize(vDirection);
        float up = smoothstep(0.0, .92, max(0.0, d.y));
        vec3 atmosphere = mix(uHorizon, uZenith, pow(up, .65));
        atmosphere = mix(atmosphere, uLower, 1.0 - smoothstep(-.65, -.02, d.y));
        float sunlight = max(0.0, dot(d, uSun));
        atmosphere += vec3(1., .72, .40) * pow(sunlight, 16.0) * .10;
        atmosphere += vec3(1., .88, .68) * smoothstep(.9995, .99988, sunlight) * 2.5;
        atmosphere += vec3(1., .82, .56) * pow(sunlight, 350.0) * .16;

        // Three low-frequency octaves describe a diffuse galactic cloud, without textures.
        vec2 uv = vec2(atan(d.z, d.x) * 2.55, asin(clamp(d.y, -1., 1.)) * 4.5);
        float broad = cloudNoise(uv + vec2(3.2, 8.4));
        float dust = cloudNoise(uv * 2.1 + vec2(13.7, -1.8));
        float ribbon = exp(-abs(d.y + d.x * .38 + .12) * 4.6);
        float glow = pow(max(0.0, broad - .27), 1.65) * ribbon;
        vec3 deepSpace = vec3(.004, .006, .020);
        deepSpace += vec3(.19, .047, .31) * glow * 1.4;
        deepSpace += vec3(.045, .085, .19) * pow(dust, 2.5) * ribbon * .58;
        deepSpace *= 1.0 - smoothstep(.57, .86, dust) * ribbon * .58;
        vec3 col = mix(deepSpace, atmosphere, clamp(uAtmosphere, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(150000, 32, 20), skyMaterial);
  dome.frustumCulled = false;
  dome.renderOrder = -100;
  skyGroup.add(dome);

  let seed = 128713;
  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const starCount = 2100;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  const starColor = new THREE.Color();
  for (let i = 0; i < starCount; i++) {
    const y = random() * 2 - 1, angle = random() * Math.PI * 2;
    const r = Math.sqrt(1 - y * y);
    starPositions.set([Math.cos(angle) * r * 146000, y * 146000, Math.sin(angle) * r * 146000], i * 3);
    const temperature = random();
    starColor.set(temperature > .85 ? '#f3b9d3' : temperature > .45 ? '#b7d9ff' : '#fff4d8');
    starColors.set([starColor.r, starColor.g, starColor.b], i * 3);
    starSizes[i] = random() > .95 ? 2.8 + random() * 1.3 : .8 + random() * 1.5;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('aColor', new THREE.BufferAttribute(starColors, 3));
  starGeometry.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
  const starMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uPixelRatio: { value: Math.min(1.5, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 aColor;
      attribute float aSize;
      uniform float uPixelRatio;
      varying vec3 vColor;
      void main() {
        vColor = aColor;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
        gl_PointSize = aSize * uPixelRatio;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vColor;
      void main() {
        float r = length(gl_PointCoord - .5) * 2.;
        float a = (1. - smoothstep(.10, 1., r)) * uOpacity;
        gl_FragColor = vec4(vColor, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  stars.frustumCulled = false;
  stars.renderOrder = -95;
  skyGroup.add(stars);

  const giant = new THREE.Group();
  giant.name = 'Ringed gas giant';
  giant.position.set(-18000, 18000, -39000);
  giant.userData.radius = 10500;
  scene.add(giant);
  const giantMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uAtmosphere: { value: 1 },
      uAirColor: { value: new THREE.Color(palettes.elysia[1]) },
      uCamera: { value: new THREE.Vector3() },
      uSun: { value: new THREE.Vector3(-.5, .65, .75).normalize() },
    },
    depthWrite: true,
    vertexShader: `
      varying vec3 vLocal;
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vLocal = normalize(position);
        vWorld = (modelMatrix * vec4(position, 1.)).xyz;
        vNormal = normalize((modelMatrix * vec4(normal, 0.)).xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uAtmosphere;
      uniform vec3 uAirColor;
      uniform vec3 uCamera;
      uniform vec3 uSun;
      varying vec3 vLocal;
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec3 n = normalize(vNormal);
        float latitude = vLocal.y + sin(vLocal.x * 12. + vLocal.z * 9.) * .008;
        float bands = sin(latitude * 88. + sin(latitude * 37.) * 2.);
        float fine = sin(latitude * 235. + sin(vLocal.z * 22.) * .4);
        float swirls = sin(latitude * 29. + sin(vLocal.x * 6. + vLocal.z * 8.) * .6);
        vec3 cream = vec3(.87, .72, .51);
        vec3 ochre = vec3(.53, .36, .23);
        vec3 col = mix(cream, ochre, smoothstep(-.2, .8, bands) * .36);
        col += fine * .025 + swirls * .045;
        float shade = .18 + .82 * smoothstep(-.22, .92, dot(n, uSun));
        col *= shade;
        float rim = pow(1. - max(0., dot(n, normalize(uCamera - vWorld))), 3.);
        col += vec3(.55, .66, .69) * rim * .22;
        col = mix(col, uAirColor, uAtmosphere * .31);
        gl_FragColor = vec4(col, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const gasBall = new THREE.Mesh(new THREE.SphereGeometry(10500, 64, 36), giantMaterial);
  gasBall.rotation.z = -.23;
  gasBall.renderOrder = -80;
  giant.add(gasBall);
  const ringMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uAtmosphere: { value: 1 },
      uAirColor: { value: new THREE.Color(palettes.elysia[1]) },
    },
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying vec2 vLocal;
      void main() {
        vLocal = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uAtmosphere;
      uniform vec3 uAirColor;
      varying vec2 vLocal;
      void main() {
        float radius = length(vLocal);
        float p = (radius - 14000.) / 9000.;
        float bands = .55 + .17 * sin(p * 120.) + .14 * sin(p * 471.) + .06 * sin(p * 973.);
        float gap = 1. - smoothstep(.015, .026, abs(p - .57));
        float smallerGap = 1. - smoothstep(.004, .012, abs(p - .24));
        float edge = smoothstep(0., .035, p) * (1. - smoothstep(.94, 1., p));
        float alpha = edge * (.48 + bands * .34) * (1. - gap * .87) * (1. - smallerGap * .65);
        vec3 col = mix(vec3(.39, .29, .23), vec3(.86, .75, .59), bands);
        float planetShadow = smoothstep(-1100., 500., vLocal.y) * (1. - smoothstep(7000., 10000., abs(vLocal.x)));
        col *= 1. - planetShadow * .55;
        col = mix(col, uAirColor, uAtmosphere * .28);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const rings = new THREE.Mesh(new THREE.RingGeometry(14000, 23000, 180, 1), ringMaterial);
  rings.rotation.set(1.68, -.16, -.23);
  rings.renderOrder = -75;
  giant.add(rings);

  // World-fixed cumulus: all puffs render in one instanced draw call.
  const cloudMaterial = new THREE.MeshLambertMaterial({
    color: '#f7f4df',
    transparent: true,
    opacity: .91,
    depthWrite: false,
    emissive: '#6b817b',
    emissiveIntensity: .22,
  });
  const cloudCount = 250;
  const clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), cloudMaterial, cloudCount);
  clouds.name = 'Elysia cumulus';
  const transform = new THREE.Object3D();
  for (let c = 0; c < 50; c++) {
    const x = (random() - .5) * 14000;
    const z = (random() - .5) * 14000;
    const y = 950 + random() * 500;
    const width = 65 + random() * 110;
    for (let puff = 0; puff < 5; puff++) {
      transform.position.set(x + (puff - 2) * width * .8, y + Math.sin(puff * 1.2) * width * .2, z + (random() - .5) * width);
      transform.scale.set(width * (1 + random() * .65), width * (.35 + random() * .45), width * (.8 + random() * .7));
      transform.rotation.set(random() * .4, random() * Math.PI, random() * .3);
      transform.updateMatrix();
      clouds.setMatrixAt(c * 5 + puff, transform.matrix);
    }
  }
  clouds.instanceMatrix.needsUpdate = true;
  clouds.frustumCulled = false;
  scene.add(clouds);

  const targets = [new THREE.Color(), new THREE.Color(), new THREE.Color()];
  const cameraPosition = new THREE.Vector3();
  let lastTime = -1;
  return {
    giant,
    update(camera, atmosphere = 1, worldKind = 'elysia', time = 0) {
      const air = THREE.MathUtils.clamp(atmosphere, 0, 1);
      const dt = lastTime < 0 ? 1 : Math.min(.1, Math.max(0, time - lastTime));
      lastTime = time;
      const blend = 1 - Math.exp(-dt * 2.8);
      const colors = palettes[worldKind] || palettes.elysia;
      targets.forEach((color, i) => color.set(colors[i]));
      uniforms.uZenith.value.lerp(targets[0], blend);
      uniforms.uHorizon.value.lerp(targets[1], blend);
      uniforms.uLower.value.lerp(targets[2], blend);
      uniforms.uAtmosphere.value = air;
      uniforms.uTime.value = time;
      camera.getWorldPosition(cameraPosition);
      skyGroup.position.copy(cameraPosition);
      starMaterial.uniforms.uOpacity.value = Math.pow(1 - air, 1.35) * .94;
      stars.visible = air < .97;
      giantMaterial.uniforms.uCamera.value.copy(cameraPosition);
      giantMaterial.uniforms.uAtmosphere.value = air;
      giantMaterial.uniforms.uAirColor.value.copy(uniforms.uHorizon.value);
      ringMaterial.uniforms.uAtmosphere.value = air;
      ringMaterial.uniforms.uAirColor.value.copy(uniforms.uHorizon.value);
      clouds.visible = worldKind === 'elysia' && air > .03;
      cloudMaterial.opacity = .91 * Math.pow(air, .55);
    },
  };
}
