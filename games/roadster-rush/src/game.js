import * as THREE from './vendor/three.module.js';
import {createTeslaRoadsterRocket,mergeStaticMeshes} from './model-integration.js';
import {setupRoadsterEnvironment} from './lighting-environment.js';
import {createCaliforniaPalm} from './palm-replacement.js';
import {createLearningApp} from './learning-app.js';

/***************************************************************************
     * 1. WEB AUDIO API SOUND SYNTHESIZER (5,500 PSI Cold-Gas Thrusters & SFX)
     ***************************************************************************/
    class SoundEngine {
      constructor() {
        this.ctx = null;
        this.muted = false;
        this.noiseNode = null;
        this.thrusterGain = null;
        this.thrusterFilter = null;
      }

      init() {
        if (!this.ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if(!AudioCtx)return;
          try{this.ctx = new AudioCtx();}catch{return;}

          // White noise buffer for realistic supersonic cold-gas thruster hiss/whoosh
          const bufSize = this.ctx.sampleRate * 2;
          const noiseBuf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
          const out = noiseBuf.getChannelData(0);
          for (let i = 0; i < bufSize; i++) out[i] = Math.random() * 2 - 1;

          this.noiseNode = this.ctx.createBufferSource();
          this.noiseNode.buffer = noiseBuf;
          this.noiseNode.loop = true;

          this.thrusterFilter = this.ctx.createBiquadFilter();
          this.thrusterFilter.type = 'bandpass';
          this.thrusterFilter.frequency.value = 520;
          this.thrusterFilter.Q.value = 1.4;

          this.thrusterGain = this.ctx.createGain();
          this.thrusterGain.gain.value = 0.0001;

          this.noiseNode.connect(this.thrusterFilter);
          this.thrusterFilter.connect(this.thrusterGain);
          this.thrusterGain.connect(this.ctx.destination);
          this.noiseNode.start();
        }
        if(this.ctx?.state==='suspended')this.ctx.resume().catch(()=>{});
      }

      toggleMute() {
        this.muted = !this.muted;
        if (this.muted && this.thrusterGain) {
          this.thrusterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.03);
        }
        return this.muted;
      }

      setThruster(active) {
        if (!this.ctx || !this.thrusterGain || this.muted) return;
        const now = this.ctx.currentTime;
        this.thrusterFilter.frequency.setTargetAtTime(active ? 680 : 380, now, 0.06);
        this.thrusterGain.gain.setTargetAtTime(active ? 0.14 : 0.0001, now, 0.05);
      }

      playBolt() {
        if (!this.ctx || this.muted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(987.77, now);
        osc.frequency.setValueAtTime(1479.98, now + 0.065);
        g.gain.setValueAtTime(0.15, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.24);
      }

      playRamp() {
        if (!this.ctx || this.muted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(190, now);
        osc.frequency.exponentialRampToValueAtTime(760, now + 0.34);
        g.gain.setValueAtTime(0.18, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.36);
      }

      playKickflip() {
        if (!this.ctx || this.muted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.22);
        g.gain.setValueAtTime(0.18, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      }

      playCrash() {
        if (!this.ctx || this.muted) return;
        this.setThruster(false);
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(125, now);
        osc.frequency.exponentialRampToValueAtTime(26, now + 0.58);
        g.gain.setValueAtTime(0.32, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.6);
      }
    }

    const sfx = new SoundEngine();
    const boot=window.RoadsterBoot,lowGraphics=boot.lowGraphics;
    const isPortrait=()=>innerWidth<651;
    let app=null,collisionShield=0,garageMode=false,garageYaw=2.45,garageElevation=.27,garageRadius=8.4;

    /***************************************************************************
     * 2. SCENE, CAMERA & GOLDEN-HOUR SUNSET ATMOSPHERE (Screenshot Matched)
     ***************************************************************************/
    const LANES = [-5.4, -1.8, 1.8, 5.4]; // 4 highway lanes matching screenshot
    const ROAD_WIDTH = 15.2;
    const BASE_SPEED = 46;
    const MAX_SPEED = 98;
    const GROUND_CLEARANCE_Y = 0.42;
    const MAX_ALTITUDE_Y = 6.4;

    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    // Warm peachy-amber atmospheric distance haze matching the screenshot skyline
    scene.fog = new THREE.FogExp2(0xf2a586, 0.0041);

    // Camera positioned behind and slightly left/above the Roadster looking down the highway
    const camera = new THREE.PerspectiveCamera(isPortrait()?62:52, window.innerWidth / window.innerHeight, 0.1, 480);
    camera.position.set(-0.35, 3.1, 8.2);

    await boot.next('Starting the 3D view');
    const renderer = new THREE.WebGLRenderer({antialias:!lowGraphics,powerPreference:'default'});
    renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();if(boot.getState().status!=='ready')boot.fail(new Error('The 3D view stopped during startup. Try lighter graphics.'));else{if(gameState==='PLAYING')togglePause();app?.toast('Graphics paused. Reload to restore the view.');}});
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,lowGraphics?1:isPortrait()?1.5:1.65));
    renderer.shadowMap.enabled = !lowGraphics;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    container.appendChild(renderer.domElement);

    // Sunset Sky Gradient & Metallic Reflection Environment Map (for Ano White & Gold Glazed glass)
    await boot.next('Lighting the sunset');
    const environmentResources=setupRoadsterEnvironment(THREE,scene,renderer,{exposure:.92,environmentIntensity:.76,lowGraphics});

    // Warm Sunset Directional & Hemisphere Lights
    const hemiLight = new THREE.HemisphereLight(0xf2f5ff, 0x725e68, 2.0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffdfc0, 3.0);
    sunLight.position.set(-28, 45, -55);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = isPortrait()?1024:2048;
    sunLight.shadow.mapSize.height = isPortrait()?1024:2048;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 190;
    const d = 32;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);
    const coolFill=new THREE.DirectionalLight(0xc9e3ff,1.15);coolFill.position.set(12,10,18);scene.add(coolFill);

    /***************************************************************************
     * 3. HIGH-DENSITY LOFTED AUTOMOTIVE SURFACE TESLA ROADSTER ("ROCKET" TRIM)
     * - 40 longitudinal stations x 36 radial cross-section points (`BufferGeometry`)
     * - Smooth vertex normals + `THREE.MeshPhysicalMaterial` automotive clearcoat
     * - Sculpted muscular rear fender haunches, recessed fastback glass & C-pillar buttresses
     * - Kammback carbon fascia, razor-thin glowing red LED bar, 3-strake diffuser & 4 nozzles
     * - Concave multi-spoke turbine wheels with brake rotors & red calipers
     * - Soft ambient-occlusion ground contact shadow that scales/fades with altitude
     ***************************************************************************/
    function createContactShadowTexture() {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 512;
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(128, 256, 18, 128, 256, 120);
      g.addColorStop(0.0, 'rgba(8, 5, 12, 0.88)');
      g.addColorStop(0.55, 'rgba(12, 8, 18, 0.55)');
      g.addColorStop(1.0, 'rgba(12, 8, 18, 0.0)');
      ctx.save();
      ctx.scale(1.0, 1.95);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(128, 131, 120, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return new THREE.CanvasTexture(c);
    }

    await boot.next('Building your Roadster');
    const playerCar = createTeslaRoadsterRocket(THREE,{groundY:GROUND_CLEARANCE_Y});
    if(lowGraphics)playerCar.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){if(m.isMeshPhysicalMaterial)m.clearcoat=0;if(typeof m.metalness==='number')m.metalness=Math.min(m.metalness,.65);}});
    playerCar.position.set(LANES[1], GROUND_CLEARANCE_Y, 0);
    scene.add(playerCar);

    // Fake Soft Dark Contact / Ambient-Occlusion Shadow Blob Directly Under the Car on the Asphalt
    const contactShadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.75, 5.15),
      new THREE.MeshBasicMaterial({
        map: createContactShadowTexture(),
        transparent: true,
        opacity: 0.88,
        depthWrite: false
      })
    );
    contactShadowMesh.rotation.x = -Math.PI / 2;
    contactShadowMesh.position.set(LANES[1], 0.025, 0);
    scene.add(contactShadowMesh);

    /***************************************************************************
     * 4. SCREENSHOT-EXACT HIGHWAY, TERRACOTTA WALLS, FOLIAGE, PALMS & SKYLINE
     ***************************************************************************/
    // Dark Purple-Grey Asphalt Road
    await boot.next('Preparing the highway');
    const roadMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_WIDTH, 440),
      new THREE.MeshStandardMaterial({ color: 0x2c2632, roughness: 0.86 })
    );
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.z = -180;
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);

    // Solid Yellow Left Shoulder Line & Solid White Right Shoulder Line (Exact Screenshot Detail!)
    const shoulderGeo = new THREE.PlaneGeometry(0.22, 440);
    const leftYellowShoulder = new THREE.Mesh(
      shoulderGeo,
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    leftYellowShoulder.rotation.x = -Math.PI / 2;
    leftYellowShoulder.position.set(-ROAD_WIDTH / 2 + 0.42, 0.015, -180);
    scene.add(leftYellowShoulder);

    const rightWhiteShoulder = new THREE.Mesh(
      shoulderGeo,
      new THREE.MeshBasicMaterial({ color: 0xf1f5f9 })
    );
    rightWhiteShoulder.rotation.x = -Math.PI / 2;
    rightWhiteShoulder.position.set(ROAD_WIDTH / 2 - 0.42, 0.015, -180);
    scene.add(rightWhiteShoulder);

    // 3 White Dashed Lane Divider Lines
    const roadDashes = [];
    const dashGeo = new THREE.PlaneGeometry(0.16, 3.6);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    for (let z = 16; z > -360; z -= 10.5) {
      [-3.6, 0, 3.6].forEach(lx => {
        const dMesh = new THREE.Mesh(dashGeo, dashMat);
        dMesh.rotation.x = -Math.PI / 2;
        dMesh.position.set(lx, 0.02, z);
        scene.add(dMesh);
        roadDashes.push(dMesh);
      });
    }

    // Paneled Terracotta Roadside Sound Walls + Concrete Curbs
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xc97b63 });
    const wallPillarMat = new THREE.MeshLambertMaterial({ color: 0xa85d48 });
    const curbMat = new THREE.MeshLambertMaterial({ color: 0x6e626d });

    [-1, 1].forEach(side => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.22, 440), curbMat);
      curb.position.set(side * (ROAD_WIDTH / 2 + 0.65), 0.11, -180);
      curb.receiveShadow = true;
      scene.add(curb);

      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.55, 2.25, 440), wallMat);
      wall.position.set(side * (ROAD_WIDTH / 2 + 1.45), 1.12, -180);
      wall.receiveShadow = true;
      scene.add(wall);
    });

    // Scrolling Wall Pillars & Faceted Low-Poly Green + Magenta Bushes
    const roadsideScenery = [];
    const bushGeo = new THREE.IcosahedronGeometry(1.2, 1);
    const greenBushMat = new THREE.MeshLambertMaterial({ color: 0x3b6e38, flatShading: true });
    const darkGreenMat = new THREE.MeshLambertMaterial({ color: 0x284e27, flatShading: true });
    const plumBushMat = new THREE.MeshLambertMaterial({ color: 0xc44d76, flatShading: true });
    const pillarGeo = new THREE.BoxGeometry(0.72, 2.38, 0.35);

    for (let z = 16; z > -360; z -= 6.0) {
      [-1, 1].forEach(side => {
        // Sound wall vertical pillar seams
        const pillar = new THREE.Mesh(pillarGeo, wallPillarMat);
        pillar.position.set(side * (ROAD_WIDTH / 2 + 1.45), 1.19, z);
        scene.add(pillar);
        roadsideScenery.push(pillar);

        // Upper rounded green foliage behind/above the terracotta wall
        const topBush = new THREE.Mesh(bushGeo, Math.random() > 0.45 ? greenBushMat : darkGreenMat);
        topBush.scale.set(1.2 + Math.random() * 0.4, 0.9 + Math.random() * 0.35, 1.2 + Math.random() * 0.4);
        topBush.position.set(side * (ROAD_WIDTH / 2 + 2.35 + Math.random() * 0.7), 2.35, z + (Math.random() - 0.5) * 2);
        scene.add(topBush);
        roadsideScenery.push(topBush);

        // Lower curb shrubs (green & magenta/plum accents as seen in screenshot)
        if (Math.random() < 0.72) {
          const isPlum = Math.random() < 0.28;
          const curbBush = new THREE.Mesh(bushGeo, isPlum ? plumBushMat : darkGreenMat);
          curbBush.scale.set(0.65, 0.48, 0.78);
          curbBush.position.set(side * (ROAD_WIDTH / 2 + 0.85), 0.42, z + 1.5);
          scene.add(curbBush);
          roadsideScenery.push(curbBush);
        }
      });
    }

    // Slender Inward-Leaning California Fan Palm Trees
    const palmTrees = [];
    for (let z = 14; z > -360; z -= 13.5) {
      [-1, 1].forEach(side => {
        const palm = createCaliforniaPalm(THREE,side);
        mergeStaticMeshes(THREE,palm);
        palm.position.set(side * (ROAD_WIDTH / 2 + 2.1 + Math.random() * 1.1), 0, z + (Math.random() - 0.5) * 3.5);
        scene.add(palm);
        palmTrees.push(palm);
      });
    }

    // Mid-Ground Low-Poly Terracotta/Brown Apartment Blocks with Warm Lit Window Grids
    function createCityFacadeTexture(wallHex, darkWinHex, litWinHex) {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 512;
      const ctx = c.getContext('2d');
      ctx.fillStyle = wallHex;
      ctx.fillRect(0, 0, 256, 512);

      // Dark cornice roof trim
      ctx.fillStyle = '#4a2922';
      ctx.fillRect(0, 0, 256, 18);

      const cols = 4;
      const rows = 8;
      const padX = 20;
      const padY = 28;
      const w = (256 - padX * (cols + 1)) / cols;
      const h = (470 - padY * (rows + 1)) / rows;

      for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols; col++) {
          ctx.fillStyle = Math.random() < 0.38 ? litWinHex : darkWinHex;
          ctx.fillRect(padX + col * (w + padX), 28 + r * (h + padY), w, h);
        }
      }
      return new THREE.CanvasTexture(c);
    }

    const facadeMats = [
      new THREE.MeshLambertMaterial({ map: createCityFacadeTexture('#9a4f40', '#632e27', '#f3a683') }),
      new THREE.MeshLambertMaterial({ map: createCityFacadeTexture('#b56550', '#70352d', '#ffd1a6') }),
      new THREE.MeshLambertMaterial({ map: createCityFacadeTexture('#824136', '#4d221d', '#e59276') })
    ];

    const cityBuildings = [];
    for (let z = 12; z > -360; z -= 21) {
      [-1, 1].forEach(side => {
        const w = 9 + Math.random() * 5;
        const h = 14 + Math.random() * 17;
        const d = 10 + Math.random() * 6;
        const bldg = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          facadeMats[Math.floor(Math.random() * facadeMats.length)]
        );
        bldg.position.set(side * (ROAD_WIDTH / 2 + 9.5 + Math.random() * 8), h / 2, z);
        scene.add(bldg);
        cityBuildings.push(bldg);
      });
    }

    // Distant Hazy Golden-Pink Downtown Skyscraper Silhouette
    const skylineMat = new THREE.MeshBasicMaterial({ color: 0xd98a7c });
    for (let i = 0; i < 30; i++) {
      const w = 10 + Math.random() * 14;
      const h = 26 + Math.random() * 64;
      const skyscraper = new THREE.Mesh(new THREE.BoxGeometry(w, h, 14), skylineMat);
      const xSpread = (i - 15) * 10.5 + (Math.random() - 0.5) * 5;
      skyscraper.position.set(xSpread, h / 2 - 4, -330 - Math.random() * 45);
      scene.add(skyscraper);
    }

    // Dual Green Overhead Highway Gantry Signs (Matches Screenshot)
    const SIGN_TEXT_PAIRS = [
      { left: ["Honking", "Does nothing"], right: ["Rush hour", "Since 1987 ↓"] },
      { left: ["Merge?", "Just fly ▲"], right: ["Sky Next", "Exit 0.59s ↓"] },
      { left: ["Rocket Trim", "5,500 PSI"], right: ["Cold Gas", "Lane Ahead ↓"] }
    ];

    function makeHighwaySignTex(topLine, botLine) {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 256;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#146c43';
      ctx.fillRect(0, 0, 512, 256);
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 12;
      ctx.strokeRect(12, 12, 488, 232);

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 54px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(topLine, 256, 105);

      ctx.fillStyle = '#fde047';
      ctx.font = '700 46px Inter, sans-serif';
      ctx.fillText(botLine, 256, 182);
      return new THREE.CanvasTexture(c);
    }

    function createOverheadGantry(zPos, pairIdx) {
      const group = new THREE.Group();
      const trussMat = new THREE.MeshLambertMaterial({ color: 0x475569 });
      const postGeo = new THREE.CylinderGeometry(0.22, 0.22, 9.0, 8);

      const leftPost = new THREE.Mesh(postGeo, trussMat);
      leftPost.position.set(-ROAD_WIDTH / 2 - 0.55, 4.5, 0);
      const rightPost = leftPost.clone();
      rightPost.position.x = ROAD_WIDTH / 2 + 0.55;

      const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(ROAD_WIDTH + 1.5, 0.38, 0.38), trussMat);
      crossBeam.position.set(0, 8.6, 0);

      const pair = SIGN_TEXT_PAIRS[pairIdx % SIGN_TEXT_PAIRS.length];
      const boardGeo = new THREE.BoxGeometry(5.3, 2.35, 0.18);

      const leftBoard = new THREE.Mesh(
        boardGeo,
        new THREE.MeshBasicMaterial({ map: makeHighwaySignTex(pair.left[0], pair.left[1]) })
      );
      leftBoard.position.set(-3.1, 8.5, 0.16);

      const rightBoard = new THREE.Mesh(
        boardGeo,
        new THREE.MeshBasicMaterial({ map: makeHighwaySignTex(pair.right[0], pair.right[1]) })
      );
      rightBoard.position.set(3.1, 8.5, 0.16);

      group.add(leftPost, rightPost, crossBeam, leftBoard, rightBoard);
      group.position.z = zPos;
      group.userData = { leftBoard, rightBoard };
      scene.add(group);
      return group;
    }

    const gantries = [
      createOverheadGantry(-120, 0),
      createOverheadGantry(-295, 1)
    ];
    let gantryCounter = 2;

    /***************************************************************************
     * 5. TRAFFIC VEHICLES (Purple, Teal, Sky-Blue Sedans & White Box Trucks),
     *    ORANGE CHEVRON JUMP RAMPS & GOLDEN LIGHTNING BOLTS
     ***************************************************************************/
    const TRAFFIC_COLORS = [
      0x9b30ff, // Boxy Purple Sedan (directly ahead of Roadster in screenshot)
      0x38b6b0, // Teal/Cyan Sedan (ahead of purple car & right lane in screenshot)
      0x4fa3e3, // Sky-Blue Coupe (foreground right & behind Roadster in screenshot)
      0xf4b41a, // Golden Yellow Sedan
      0xe85d75  // Coral Red Coupe
    ];

    const trafficPool = [];
    const rampPool = [];
    const boltPool = [];
    const particlePool = [];

    function createTrafficVehicle(isWhiteTruck) {
      const group = new THREE.Group();
      const glassMat = new THREE.MeshLambertMaterial({ color: 0x1e1b2e, flatShading: true });
      const tireMat = new THREE.MeshLambertMaterial({ color: 0x18181b });
      const tailMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
      const plateMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

      let height = 1.38;
      let length = 3.8;
      let bodyMesh = null;
      let cabinMesh = null;

      if (!isWhiteTruck) {
        const col = TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)];
        const paintMat = new THREE.MeshLambertMaterial({ color: col, flatShading: true });

        // Lower boxy sedan body
        const lower = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.54, 3.8), paintMat);
        lower.position.y = 0.46;
        lower.castShadow = true;
        lower.receiveShadow = true;
        bodyMesh = lower;

        // Tapered greenhouse roof
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.48, 1.9), paintMat);
        cabin.position.set(0, 0.94, 0.08);
        cabin.castShadow = true;
        cabinMesh = cabin;

        const win = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.36, 1.62), glassMat);
        win.position.set(0, 0.92, 0.08);

        // Rear taillights & yellow license plate
        const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.13, 0.06), tailMat);
        tlL.position.set(-0.60, 0.52, 1.91);
        const tlR = tlL.clone();
        tlR.position.x = 0.60;

        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.06), plateMat);
        plate.position.set(0, 0.42, 1.91);

        group.add(lower, cabin, win, tlL, tlR, plate);
      } else {
        // White Box Truck (Matches right-center lane in screenshot)
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xf5f2eb, flatShading: true });
        const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.26, 2.32, 5.1), whiteMat);
        cargo.position.set(0, 1.46, 0.35);
        cargo.castShadow = true;
        cargo.receiveShadow = true;
        bodyMesh = cargo;

        const cab = new THREE.Mesh(new THREE.BoxGeometry(2.02, 1.42, 1.5), whiteMat);
        cab.position.set(0, 1.0, -2.85);
        cab.castShadow = true;

        const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.06), tailMat);
        tlL.position.set(-0.75, 0.46, 2.91);
        const tlR = tlL.clone();
        tlR.position.x = 0.75;

        group.add(cargo, cab, tlL, tlR);
        height = 2.65;
        length = 6.1;
      }

      const wGeo = new THREE.CylinderGeometry(0.29, 0.29, 0.22, 10);
      wGeo.rotateZ(Math.PI / 2);
      [
        [-0.88, 0.29, -1.12],
        [0.88, 0.29, -1.12],
        [-0.88, 0.29, 1.12],
        [0.88, 0.29, 1.12]
      ].forEach(([wx, wy, wz]) => {
        const w = new THREE.Mesh(wGeo, tireMat);
        w.position.set(wx, wy, wz);
        group.add(w);
      });

      group.userData = {
        active: false,
        isWhiteTruck,
        bodyMesh,
        cabinMesh,
        speedRatio: 0.42 + Math.random() * 0.18,
        height,
        length,
        width: isWhiteTruck ? 2.24 : 1.84,
        scored: false
      };
      group.visible = false;
      scene.add(group);
      return group;
    }

    for (let i = 0; i < 18; i++) {
      trafficPool.push(createTrafficVehicle(i % 5 === 0));
    }

    // Orange Wedged Jump Ramps with Black Chevron Arrows (Matches center-left lane of screenshot)
    function createChevronRampTexture() {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 512;
      const ctx = c.getContext('2d');

      ctx.fillStyle = '#ff8c1a';
      ctx.fillRect(0, 0, 256, 512);

      ctx.fillStyle = '#fde047';
      ctx.fillRect(0, 0, 16, 512);
      ctx.fillRect(240, 0, 16, 512);

      ctx.fillStyle = '#1f1612';
      for (let y = 38; y < 490; y += 108) {
        ctx.beginPath();
        ctx.moveTo(30, y + 64);
        ctx.lineTo(128, y);
        ctx.lineTo(226, y + 64);
        ctx.lineTo(226, y + 98);
        ctx.lineTo(128, y + 34);
        ctx.lineTo(30, y + 98);
        ctx.closePath();
        ctx.fill();
      }
      return new THREE.CanvasTexture(c);
    }

    const chevronTex = createChevronRampTexture();

    function createHighwayJumpRamp() {
      const group = new THREE.Group();
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(5.5, 0);
      shape.lineTo(0, 1.72);
      shape.closePath();

      const wedgeGeo = new THREE.ExtrudeGeometry(shape, { depth: 2.3, bevelEnabled: false });
      wedgeGeo.center();
      const wedge = new THREE.Mesh(
        wedgeGeo,
        new THREE.MeshLambertMaterial({ color: 0xe06314 })
      );
      wedge.rotation.y = Math.PI / 2;
      wedge.position.y = 0.86;
      wedge.castShadow = true;
      group.add(wedge);

      const topSlope = new THREE.Mesh(
        new THREE.PlaneGeometry(2.28, 5.75),
        new THREE.MeshBasicMaterial({ map: chevronTex })
      );
      topSlope.rotation.x = -Math.PI / 2 + Math.atan2(1.72, 5.5);
      topSlope.position.set(0, 0.90, 0);
      group.add(topSlope);

      group.userData = { active: false, launched: false };
      group.visible = false;
      scene.add(group);
      return group;
    }

    for (let i = 0; i < 4; i++) {
      rampPool.push(createHighwayJumpRamp());
    }

    // Golden Coins / Lightning Bolts
    function createBoltCollectible() {
      const group = new THREE.Group();
      const ringGeo = new THREE.CylinderGeometry(0.58, 0.58, 0.15, 12);
      ringGeo.rotateX(Math.PI / 2);
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        metalness: 0.6,
        roughness: 0.2,
        emissive: 0xd97706,
        emissiveIntensity: 0.4
      });
      const disc = new THREE.Mesh(ringGeo, goldMat);
      group.add(disc);
      group.userData = { active: false };
      group.visible = false;
      scene.add(group);
      return group;
    }

    for (let i = 0; i < 30; i++) {
      boltPool.push(createBoltCollectible());
    }

    // Particle System Pool (5,500 PSI Cold-Gas Vapor, Coin Sparkles, Crash Explosion)
    const pGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
    for (let i = 0; i < 100; i++) {
      const p = new THREE.Mesh(
        pGeo,
        new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 1 })
      );
      p.visible = false;
      p.userData = { active: false, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0.4 };
      scene.add(p);
      particlePool.push(p);
    }

    function spawnParticle(x, y, z, vx, vy, vz, hex, scale = 1, maxLife = 0.38) {
      const p = particlePool.find(item => !item.userData.active);
      if (!p) return;
      p.userData.active = true;
      p.userData.vx = vx;
      p.userData.vy = vy;
      p.userData.vz = vz;
      p.userData.life = 0;
      p.userData.maxLife = maxLife;
      p.position.set(x, y, z);
      p.scale.setScalar(scale);
      p.material.color.setHex(hex);
      p.material.opacity = 1;
      p.visible = true;
    }

    function spawnBurst(x, y, z, hex = 0xfacc15, count = 14, spd = 1) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = (2.5 + Math.random() * 6.5) * spd;
        spawnParticle(
          x, y, z,
          Math.cos(a) * s,
          Math.random() * 5.5 * spd,
          Math.sin(a) * s,
          hex,
          1.15 * spd,
          0.42 + Math.random() * 0.25
        );
      }
    }

    /***************************************************************************
     * 6. INITIAL SCREENSHOT DIORAMA STAGING (Matches Screenshot Immediately)
     ***************************************************************************/
    function stageScreenshotFormation() {
      trafficPool.forEach(v => { v.userData.active = false; v.visible = false; });
      rampPool.forEach(r => { r.userData.active = false; r.visible = false; });

      // 1. Purple Sedan in Lane 1 just ahead of the Roadster
      const purpleCar = trafficPool.find(v => !v.userData.isWhiteTruck && !v.userData.active);
      if (purpleCar) {
        purpleCar.userData.active = true;
        purpleCar.userData.bodyMesh.material.color.setHex(0x9b30ff);
        purpleCar.userData.cabinMesh.material.color.setHex(0x9b30ff);
        purpleCar.position.set(LANES[0], 0, -14);
        purpleCar.visible = true;
      }

      // 2. Teal Sedan in Lane 1 ahead of the Purple Sedan
      const tealCar1 = trafficPool.find(v => !v.userData.isWhiteTruck && !v.userData.active);
      if (tealCar1) {
        tealCar1.userData.active = true;
        tealCar1.userData.bodyMesh.material.color.setHex(0x38b6b0);
        tealCar1.userData.cabinMesh.material.color.setHex(0x38b6b0);
        tealCar1.position.set(LANES[0], 0, -32);
        tealCar1.visible = true;
      }

      // 3. Orange Chevron Jump Ramp in Lane 2 down the highway
      const ramp = rampPool[0];
      ramp.userData.active = true;
      ramp.userData.launched = false;
      ramp.position.set(LANES[1], 0, -82);
      ramp.visible = true;

      // 4. White Box Truck in Lane 3
      const whiteTruck = trafficPool.find(v => v.userData.isWhiteTruck && !v.userData.active);
      if (whiteTruck) {
        whiteTruck.userData.active = true;
        whiteTruck.position.set(LANES[2], 0, -68);
        whiteTruck.visible = true;
      }

      // 5. Teal Sedan & Sky-Blue Coupe in Lane 4 (Right lane)
      const tealCar2 = trafficPool.find(v => !v.userData.isWhiteTruck && !v.userData.active);
      if (tealCar2) {
        tealCar2.userData.active = true;
        tealCar2.userData.bodyMesh.material.color.setHex(0x38b6b0);
        tealCar2.userData.cabinMesh.material.color.setHex(0x38b6b0);
        tealCar2.position.set(LANES[3], 0, -24);
        tealCar2.visible = true;
      }

      const blueCar = trafficPool.find(v => !v.userData.isWhiteTruck && !v.userData.active);
      if (blueCar) {
        blueCar.userData.active = true;
        blueCar.userData.bodyMesh.material.color.setHex(0x4fa3e3);
        blueCar.userData.cabinMesh.material.color.setHex(0x4fa3e3);
        blueCar.position.set(LANES[3], 0, -7);
        blueCar.visible = true;
      }
    }

    /***************************************************************************
     * 7. GAMEPLAY STATE, CONTROLS & SCORE SYSTEM
     ***************************************************************************/
    let gameState = 'MENU'; // MENU, PLAYING, PAUSED, GAMEOVER
    let speed = BASE_SPEED;
    let score = 0;
    let bestScore=0;try{bestScore=Math.max(0,Number(localStorage.getItem('roadster-rush:best:v1'))||0);}catch{}
    let distance = 0;
    let bolts = 0;
    let combo = 1;
    let bestCombo = 1;
    let comboTimer = 0;

    let currentLane = 1;
    let targetX = LANES[currentLane];
    let isThrusting = false;
    let tankPsi = 100;
    let velY = 0;

    let isRolling = false;
    let rollAngle = 0;
    let rollDir = 1;
    let cameraShake = 0;

    let trafficSpawnTimer = 1.1;
    let rampSpawnTimer = 3.5;
    let boltSpawnTimer = 0.9;

    const scoreEl = document.getElementById('hud-score');
    const bestEl = document.getElementById('hud-best');
    const speedEl = document.getElementById('hud-speed');
    const boltsEl = document.getElementById('hud-bolts');
    const psiEl = document.getElementById('hud-psi');
    const fuelBarEl = document.getElementById('hud-fuel-bar');
    const comboBadgeEl = document.getElementById('combo-badge');
    const calloutContainer = document.getElementById('callout-container');

    function showCallout(text, colorClass = 'text-amber-300') {
      const div = document.createElement('div');
      div.className = `callout-popup absolute font-mono-tech font-extrabold text-sm sm:text-base tracking-wider whitespace-nowrap drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] ${colorClass}`;
      div.innerText = text;
      calloutContainer.appendChild(div);
      setTimeout(() => div.remove(), 1150);
    }

    function addBonus(pts, label, colorClass = 'text-amber-300') {
      combo = Math.min(combo + 1, 8);
      if (combo > bestCombo) bestCombo = combo;
      comboTimer = 3.6;
      const total = pts * combo;
      score += total;
      comboBadgeEl.innerText = `COMBO x${combo}`;
      comboBadgeEl.classList.remove('hidden');
      showCallout(`${label} +${total}`, colorClass);
    }

    function changeLane(dir) {
      if (gameState !== 'PLAYING') return;
      const next = Math.max(0, Math.min(LANES.length - 1, currentLane + dir));
      const isAirborneNow = playerCar.position.y > 1.05;

      if (next !== currentLane) {
        currentLane = next;
        targetX = LANES[currentLane];
      }

      // Automatic 360-degree aerial flip / barrel roll whenever moving left or right in the air!
      if (isAirborneNow) {
        triggerKickflipRoll(dir, true);
      }
    }

    function triggerKickflipRoll(dir = 1, fromAirSteer = false) {
      if (gameState !== 'PLAYING') return;
      // Allow chaining / re-triggering flips if the player keeps steering left or right in the air
      if (isRolling && (!fromAirSteer || rollAngle < Math.PI * 0.55)) return;

      // Fire corner cold-gas thrusters to hop if close to the road
      if (playerCar.position.y < 1.55 && tankPsi > 8) {
        velY = Math.max(velY, 9.8);
        tankPsi = Math.max(0, tankPsi - 8);
      }
      isRolling = true;
      rollAngle = 0;
      rollDir = dir;
      cameraShake = 0.18;
      sfx.playKickflip();

      // Side cold-gas thruster burst for the flip impulse
      spawnBurst(
        playerCar.position.x - dir * 0.9,
        playerCar.position.y + 0.35,
        playerCar.position.z,
        0x7dd3fc,
        10,
        0.95
      );
      addBonus(160, fromAirSteer ? 'AIR FLIP' : 'BARREL ROLL', 'text-pink-300');
    }

    window.addEventListener('keydown', (e) => {
      if(e.target.closest?.('input,textarea,select,[contenteditable=true]')||app?.hasDialog())return;
      if(['Space','ArrowUp','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
      if(e.repeat&&['ArrowLeft','ArrowRight','KeyA','KeyD','KeyR','ShiftLeft','ShiftRight','KeyP'].includes(e.code))return;
      if (gameState === 'GAMEOVER' && e.code === 'Space') {
        startGame();
        return;
      }
      if (e.code === 'KeyP') {
        togglePause();
        return;
      }
      if (gameState !== 'PLAYING') return;

      if (e.code === 'ArrowLeft' || e.code === 'KeyA') changeLane(-1);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') changeLane(1);
      else if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        isThrusting = true;
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyR') {
        e.preventDefault();
        triggerKickflipRoll(currentLane < 2 ? 1 : -1);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        isThrusting = false;
      }
    });

    // A held thrust pointer is independent from steering taps with another finger.
    let swipePointer=null,swipeX=0,thrustPointer=null;
    const orbitPointers=new Map();let pinchDistance=0;
    container.addEventListener('pointerdown',e=>{
      container.setPointerCapture(e.pointerId);
      if(garageMode){orbitPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(orbitPointers.size===2){const [a,b]=[...orbitPointers.values()];pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);}return;}
      if(gameState==='PLAYING'&&swipePointer===null){swipePointer=e.pointerId;swipeX=e.clientX;}
    });
    container.addEventListener('pointermove',e=>{
      if(garageMode&&orbitPointers.has(e.pointerId)){
        const old=orbitPointers.get(e.pointerId);orbitPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
        if(orbitPointers.size===1){garageYaw-=(e.clientX-old.x)*.008;garageElevation=THREE.MathUtils.clamp(garageElevation+(e.clientY-old.y)*.004,.06,.85);}
        else if(orbitPointers.size===2){const [a,b]=[...orbitPointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);garageRadius=THREE.MathUtils.clamp(garageRadius+(pinchDistance-distance)*.025,5,24);pinchDistance=distance;}
      }else if(e.pointerId===swipePointer&&gameState==='PLAYING'){const dx=e.clientX-swipeX;if(Math.abs(dx)>38){changeLane(dx>0?1:-1);swipeX=e.clientX;}}
    });
    const releaseWorld=e=>{orbitPointers.delete(e.pointerId);if(e.pointerId===swipePointer)swipePointer=null;};
    for(const type of ['pointerup','pointercancel','lostpointercapture'])container.addEventListener(type,releaseWorld);
    container.addEventListener('wheel',e=>{if(garageMode){e.preventDefault();garageRadius=THREE.MathUtils.clamp(garageRadius+e.deltaY*.008,5,24);}},{passive:false});
    document.getElementById('btn-left').onclick=()=>changeLane(-1);
    document.getElementById('btn-right').onclick=()=>changeLane(1);
    const btnFly=document.getElementById('btn-fly');
    btnFly.addEventListener('pointerdown',e=>{e.preventDefault();if(gameState!=='PLAYING'||thrustPointer!==null)return;thrustPointer=e.pointerId;btnFly.setPointerCapture(e.pointerId);isThrusting=true;btnFly.classList.add('pressed');});
    const releaseThrust=e=>{if(e.pointerId!==thrustPointer)return;thrustPointer=null;isThrusting=false;btnFly.classList.remove('pressed');};
    for(const type of ['pointerup','pointercancel','lostpointercapture'])btnFly.addEventListener(type,releaseThrust);
    document.getElementById('btn-roll').onclick=()=>triggerKickflipRoll(1);
    function releaseInputs(){isThrusting=false;thrustPointer=null;swipePointer=null;orbitPointers.clear();btnFly.classList.remove('pressed');sfx.setThruster(false);}
    window.addEventListener('blur',()=>{releaseInputs();if(gameState==='PLAYING')togglePause();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){releaseInputs();if(gameState==='PLAYING')togglePause();}});

    function togglePause() {
      if (gameState === 'PLAYING') {
        gameState = 'PAUSED';
        releaseInputs();app?.setSuspended(true);
        document.getElementById('pause-notice').classList.remove('hidden');
        sfx.setThruster(false);
        document.getElementById('pause-btn').innerText = '▶';
      } else if (gameState === 'PAUSED') {
        gameState = 'PLAYING';
        app?.setSuspended(false);document.getElementById('pause-notice').classList.add('hidden');
        document.getElementById('pause-btn').innerText = '||';
      }
    }

    document.getElementById('pause-btn').addEventListener('click',()=>{if(!app?.hasDialog())togglePause();});
    document.getElementById('resume-btn').onclick=togglePause;
    document.getElementById('restart-btn').onclick=startGame;
    document.getElementById('mute-btn').addEventListener('click', (e) => {
      sfx.init();
      const muted = sfx.toggleMute();
      e.target.innerText = muted ? '🔇' : '🔊';
    });

    /***************************************************************************
     * 8. PROCEDURAL SPAWNERS (Traffic, Chevron Ramps & Lightning Bolts)
     ***************************************************************************/
    function spawnTrafficWave() {
      const availableLanes = [0,1,2,3].filter(i=>i!==app?.reserveLane());
      const count = Math.random() < 0.58 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const vehicle = trafficPool.find(v => !v.userData.active);
        if (!vehicle||!availableLanes.length) break;
        const pick = Math.floor(Math.random() * availableLanes.length);
        const lIdx = availableLanes.splice(pick, 1)[0];

        vehicle.userData.active = true;
        vehicle.userData.scored = false;
        if (!vehicle.userData.isWhiteTruck) {
          const col = TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)];
          vehicle.userData.bodyMesh.material.color.setHex(col);
          vehicle.userData.cabinMesh.material.color.setHex(col);
        }
        vehicle.position.set(LANES[lIdx], 0, -245 - Math.random() * 25);
        vehicle.visible = true;
      }
    }

    function spawnJumpRamp() {
      const ramp = rampPool.find(r => !r.userData.active);
      if (!ramp) return;
      const lIdx = Math.floor(Math.random() * LANES.length);
      ramp.userData.active = true;
      ramp.userData.launched = false;
      ramp.position.set(LANES[lIdx], 0, -255);
      ramp.visible = true;
    }

    function spawnBoltArc() {
      const lIdx = Math.floor(Math.random() * LANES.length);
      const isAerial = Math.random() < 0.55;
      for (let i = 0; i < 5; i++) {
        const b = boltPool.find(item => !item.userData.active);
        if (!b) break;
        b.userData.active = true;
        const arcY = isAerial ? GROUND_CLEARANCE_Y + Math.sin((i / 4) * Math.PI) * 3.6 + 0.85 : GROUND_CLEARANCE_Y + 0.55;
        b.position.set(LANES[lIdx], arcY, -215 - i * 5.8);
        b.visible = true;
      }
    }

    /***************************************************************************
     * 9. START & GAME OVER FLOW
     ***************************************************************************/
    function startGame() {
      sfx.init();
      gameState = 'PLAYING';
      speed = app?.settings().driveMode==='rush'?BASE_SPEED:30;
      releaseInputs();garageMode=false;collisionShield=0;
      document.body.classList.remove('menu-state','garage-state');
      document.getElementById('garage-panel').classList.add('hidden');
      document.getElementById('pause-notice').classList.add('hidden');
      document.getElementById('pause-btn').textContent='Ⅱ';
      trafficSpawnTimer=2.5;rampSpawnTimer=6;boltSpawnTimer=1.5;rollAngle=0;cameraShake=0;
      playerCar.userData.resetVisuals();
      particlePool.forEach(p=>{p.userData.active=false;p.visible=false;});
      score = 0;
      distance = 0;
      bolts = 0;
      combo = 1;
      bestCombo = 1;
      comboTimer = 0;
      tankPsi = 100;
      velY = 0;
      isThrusting = false;
      isRolling = false;
      comboBadgeEl.classList.add('hidden');

      currentLane = 1;
      targetX = LANES[currentLane];
      playerCar.visible = true;
      playerCar.position.set(targetX, GROUND_CLEARANCE_Y, 0);
      playerCar.rotation.set(0, 0, 0);
      playerCar.userData.bodyGroup.rotation.set(0, 0, 0);

      boltPool.forEach(b => { b.userData.active = false; b.visible = false; });
      stageScreenshotFormation();
      app?.startSession();
      camera.fov=isPortrait()?62:52;camera.updateProjectionMatrix();
      camera.position.set(isPortrait()?targetX:targetX*.62-.28,isPortrait()?3.65:3.05,isPortrait()?10.1:8.6);
      camera.lookAt(isPortrait()?targetX:targetX*.45,1.15,-22);

      document.getElementById('start-modal').classList.add('hidden');
      document.getElementById('gameover-modal').classList.add('hidden');
    }

    function triggerGameOver() {
      if(gameState!=='PLAYING')return;
      gameState = 'GAMEOVER';
      releaseInputs();app?.setSuspended(true);contactShadowMesh.visible=false;
      sfx.playCrash();
      cameraShake = 1.15;
      playerCar.visible = false;

      if (score > bestScore) {
        bestScore = Math.floor(score);
        try{localStorage.setItem('roadster-rush:best:v1',String(bestScore));}catch{}
        bestEl.innerText = bestScore.toLocaleString();
      }

      spawnBurst(playerCar.position.x, playerCar.position.y + 0.5, playerCar.position.z, 0xfacc15, 38, 2.2);
      spawnBurst(playerCar.position.x, playerCar.position.y + 0.5, playerCar.position.z, 0xf97316, 26, 1.8);

      document.getElementById('go-score').innerText = Math.floor(score).toLocaleString();
      document.getElementById('go-dist').innerText = `${Math.floor(distance)} m`;
      document.getElementById('go-bolts').innerText = `⚡ ${bolts}`;
      document.getElementById('go-combo').innerText = `${bestCombo}x`;

      setTimeout(() => {
        if (gameState === 'GAMEOVER') {
          document.getElementById('gameover-modal').classList.remove('hidden');
        }
      }, 650);
    }

    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('retry-btn').addEventListener('click', startGame);

    /***************************************************************************
     * 10. MAIN ANIMATION & PHYSICS LOOP
     ***************************************************************************/
    const clock = new THREE.Clock();

    function animate() {
      if(boot.getState().status==='failed')return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;

      if (gameState === 'PLAYING') {
        const practice=app?.settings().driveMode!=='rush';
        speed = Math.min(practice?43:MAX_SPEED,speed+dt*(practice?.26:.9));
        collisionShield=Math.max(0,collisionShield-dt);
        const step = speed * dt;
        distance += step * 0.45;
        score += step * 0.9 * combo;

        if (combo > 1) {
          comboTimer -= dt;
          if (comboTimer <= 0) {
            combo = 1;
            comboBadgeEl.classList.add('hidden');
          }
        }

        // Smooth Lane Tweening
        const dx = targetX - playerCar.position.x;
        playerCar.position.x += dx * Math.min(1, dt * 12);

        // Spin the Concave Turbine Wheels proportionally to highway velocity
        playerCar.userData.roll(step);
        playerCar.userData.setSteering(THREE.MathUtils.clamp(dx*.08,-.35,.35));

        // Update Altitude-Reactive Soft Ambient-Occlusion Contact Shadow on the Asphalt
        const altAboveRoad = Math.max(0, playerCar.position.y - GROUND_CLEARANCE_Y);
        contactShadowMesh.visible = playerCar.visible;
        contactShadowMesh.position.x = playerCar.position.x;
        contactShadowMesh.position.z = playerCar.position.z;
        const shadowScale = 1.0 + altAboveRoad * 0.12;
        contactShadowMesh.scale.set(shadowScale, shadowScale, 1);
        contactShadowMesh.material.opacity = Math.max(0.14, 0.88 - altAboveRoad * 0.13);

        // 5,500 PSI Cold-Gas Thruster Physics & Plumes
        const thrustActive = isThrusting && tankPsi > 0.5;
        sfx.setThruster(thrustActive);

        playerCar.userData.updateThrusters(thrustActive,isRolling,elapsed);
        const isAirborne=playerCar.position.y>GROUND_CLEARANCE_Y+.25;

        if (thrustActive) {
          velY += 28 * dt;
          tankPsi = Math.max(0, tankPsi - 26 * dt);
          cameraShake = Math.max(cameraShake, 0.055);

          // Cold-Gas Supersonic Cryo Vapor Trail
          spawnParticle(
            playerCar.position.x + (Math.random() - 0.5) * 1.1,
            playerCar.position.y + 0.22,
            playerCar.position.z + 2.5,
            (Math.random() - 0.5) * 2.2,
            (Math.random() - 0.5) * 1.5,
            15 + Math.random() * 6,
            0xbae6fd,
            0.95,
            0.22
          );
        } else {
          velY -= 21.5 * dt;
          if (!isAirborne) {
            tankPsi = Math.min(100, tankPsi + 25 * dt);
          }
        }

        playerCar.position.y += velY * dt;
        if (playerCar.position.y <= GROUND_CLEARANCE_Y) {
          playerCar.position.y = GROUND_CLEARANCE_Y;
          velY = 0;
        } else if (playerCar.position.y >= MAX_ALTITUDE_Y) {
          playerCar.position.y = MAX_ALTITUDE_Y;
          velY = Math.min(0, velY);
        }

        // Body Pitch, Banking & 360° SpaceX Kickflip Barrel Roll
        playerCar.rotation.z = THREE.MathUtils.clamp(-dx*.045,isAirborne?-.48:-.022,isAirborne?.48:.022);
        playerCar.rotation.x = isAirborne?THREE.MathUtils.clamp(velY*.024,-.22,.28):0;

        if (isRolling) {
          rollAngle += dt * Math.PI * 4.8;
          playerCar.userData.bodyGroup.rotation.z = -rollDir * rollAngle;
          if (rollAngle >= Math.PI * 2) {
            isRolling = false;
            playerCar.userData.bodyGroup.rotation.z = 0;
          }
        }

        // Scroll Highway Dashes, Foliage, Palms, City Blocks & Gantries
        roadDashes.forEach(d => {
          d.position.z += step;
          if (d.position.z > 18) d.position.z -= 370;
        });
        roadsideScenery.forEach(item => {
          item.position.z += step;
          if (item.position.z > 20) item.position.z -= 370;
        });
        palmTrees.forEach(p => {
          p.position.z += step;
          if (p.position.z > 20) p.position.z -= 370;
        });
        cityBuildings.forEach(b => {
          b.position.z += step * 0.78;
          if (b.position.z > 28) b.position.z -= 370;
        });
        gantries.forEach(g => {
          g.position.z += step;
          if (g.position.z > 22) {
            g.position.z -= 350;
            const pair = SIGN_TEXT_PAIRS[gantryCounter++ % SIGN_TEXT_PAIRS.length];
            g.userData.leftBoard.material.map?.dispose();g.userData.rightBoard.material.map?.dispose();
            g.userData.leftBoard.material.map = makeHighwaySignTex(pair.left[0], pair.left[1]);
            g.userData.rightBoard.material.map = makeHighwaySignTex(pair.right[0], pair.right[1]);
          }
        });

        // Spawners
        trafficSpawnTimer -= dt;
        if (trafficSpawnTimer <= 0) {
          spawnTrafficWave();
          trafficSpawnTimer = Math.max(0.46, 1.22 - (speed - BASE_SPEED) * 0.011);
        }

        rampSpawnTimer -= dt;
        if (rampSpawnTimer <= 0) {
          spawnJumpRamp();
          rampSpawnTimer = 4.0 + Math.random() * 2.2;
        }

        boltSpawnTimer -= dt;
        if (boltSpawnTimer <= 0) {
          spawnBoltArc();
          boltSpawnTimer = 1.5;
        }

        // Update Orange Chevron Jump Ramps
        for (let i = 0; i < rampPool.length; i++) {
          const r = rampPool[i];
          if (!r.userData.active) continue;
          r.position.z += step;

          if (r.position.z > 18) {
            r.userData.active = false;
            r.visible = false;
            continue;
          }

          const dz = Math.abs(r.position.z - playerCar.position.z);
          const dxRamp = Math.abs(r.position.x - playerCar.position.x);
          if (!r.userData.launched && dz < 2.8 && dxRamp < 1.35 && playerCar.position.y < 1.95) {
            r.userData.launched = true;
            velY = 15.8;
            tankPsi = Math.min(100, tankPsi + 35);
            cameraShake = 0.24;
            sfx.playRamp();
            addBonus(250, 'RAMP LAUNCH', 'text-orange-300');
            spawnBurst(playerCar.position.x, playerCar.position.y, playerCar.position.z, 0xfb923c, 16, 1.3);
          }
        }

        // Update Traffic Vehicles & Collision / Flyover Detection
        for (let i = 0; i < trafficPool.length; i++) {
          const v = trafficPool[i];
          if (!v.userData.active) continue;
          const relSpeed = speed * (1 - v.userData.speedRatio);
          v.position.z += relSpeed * dt;

          if (v.position.z > 20) {
            v.userData.active = false;
            v.visible = false;
            continue;
          }

          const dz = Math.abs(v.position.z - playerCar.position.z);
          const dxCar = Math.abs(v.position.x - playerCar.position.x);
          const hitZ=(v.userData.length+playerCar.userData.dimensions.z)*.44;
          const hitX=(v.userData.width+playerCar.userData.dimensions.x)*.42;

          if (dz < hitZ && dxCar < hitX) {
            if (playerCar.position.y-GROUND_CLEARANCE_Y+.025 < v.userData.height+.08) {
              if(practice){if(collisionShield<=0){collisionShield=1.5;cameraShake=.25;speed=Math.max(25,speed-5);score=Math.max(0,score-80);app?.toast('Keep going — your lesson is safe.');}v.userData.active=false;v.visible=false;}else{triggerGameOver();break;}
            } else if (!v.userData.scored && playerCar.position.y < v.userData.height + 1.6) {
              v.userData.scored = true;
              addBonus(100, 'FLYOVER', 'text-sky-300');
            }
          } else if (
            !v.userData.scored &&
            dz < 2.2 &&
            dxCar >= hitX &&
            dxCar < hitX + 1.15 &&
            playerCar.position.y < v.userData.height + 0.3
          ) {
            v.userData.scored = true;
            addBonus(100, 'CLOSE CALL', 'text-amber-300');
          }
        }

        // Update Golden Bolts
        for (let i = 0; i < boltPool.length; i++) {
          const b = boltPool[i];
          if (!b.userData.active) continue;
          b.position.z += step;
          b.rotation.y += dt * 3.5;

          if (b.position.z > 15) {
            b.userData.active = false;
            b.visible = false;
            continue;
          }

          if (b.position.distanceToSquared(playerCar.position) < 3.6) {
            b.userData.active = false;
            b.visible = false;
            bolts++;
            score += 50 * combo;
            sfx.playBolt();
            spawnBurst(b.position.x, b.position.y, b.position.z, 0xfacc15, 8, 0.85);
          }
        }

        app?.update(dt,step,playerCar,elapsed);
        sceneryInstances.sync();

        // Update HUD Readouts
        scoreEl.innerText = Math.floor(score).toLocaleString();
        speedEl.innerText = `${Math.floor(speed * 2.4)} mph`;
        boltsEl.innerText = bolts;
        psiEl.innerText = `${Math.round(tankPsi)}%`;
        fuelBarEl.style.width = `${Math.round(tankPsi)}%`;
      } else if (gameState === 'MENU') {
        // Subtle idle hover while showcasing the screenshot formation behind the Start modal
        playerCar.position.y = GROUND_CLEARANCE_Y;
        contactShadowMesh.position.x = playerCar.position.x;
        contactShadowMesh.position.z = playerCar.position.z;
      }

      // Update Particles
      for (let i = 0; i < particlePool.length; i++) {
        const p = particlePool[i];
        if (!p.userData.active) continue;
        p.userData.life += dt;
        if (p.userData.life >= p.userData.maxLife) {
          p.userData.active = false;
          p.visible = false;
          continue;
        }
        p.position.x += p.userData.vx * dt;
        p.position.y += p.userData.vy * dt;
        p.position.z += p.userData.vz * dt;
        p.material.opacity = 1 - p.userData.life / p.userData.maxLife;
      }

      if(gameState==='MENU'){
        const yaw=garageMode?garageYaw:2.45+Math.sin(elapsed*.13)*.06;
        const radius=garageMode?garageRadius:isPortrait()?15.8:9.8;
        const elevation=garageMode?garageElevation:.29;
        camera.fov=isPortrait()?45:47;
        camera.position.set(playerCar.position.x+Math.sin(yaw)*radius,1+Math.sin(elevation)*radius,Math.cos(yaw)*radius);
        camera.lookAt(playerCar.position.x+(isPortrait()||garageMode?0:-2.4),isPortrait()&&!garageMode?-2.1:.5,0);
        camera.updateProjectionMatrix();
      }else{
        const camTargetX=isPortrait()?playerCar.position.x:playerCar.position.x*.62-.28;
        const camTargetY=(isPortrait()?3.65:3.05)+(playerCar.position.y-GROUND_CLEARANCE_Y)*.52;
        if(isPortrait())camera.position.x=camTargetX;else camera.position.x+=(camTargetX-camera.position.x)*Math.min(1,dt*6.5);
        camera.position.y+=(camTargetY-camera.position.y)*Math.min(1,dt*6.5);
        camera.position.z=(isPortrait()?10.1:8.6)+Math.max(0,speed-BASE_SPEED)*.018;
        if(cameraShake>.001){camera.position.x+=(Math.random()-.5)*cameraShake;camera.position.y+=(Math.random()-.5)*cameraShake;cameraShake*=Math.pow(.04,dt);}
        camera.lookAt(isPortrait()?playerCar.position.x:playerCar.position.x*.45,playerCar.position.y*.38+.98,-22);
      }
      renderer.render(scene,camera);
      requestAnimationFrame(animate);
    }

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      if(gameState!=='MENU')camera.fov=isPortrait()?62:52;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    function batchMovingMeshes(objects){
      const buckets=new Map();
      for(const object of objects){if(!object.isMesh)continue;const key=object.geometry.uuid+':'+object.material.uuid;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(object);}
      const batches=[];
      for(const items of buckets.values()){if(items.length<2)continue;const first=items[0],mesh=new THREE.InstancedMesh(first.geometry,first.material,items.length);mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);items.forEach(item=>item.visible=false);batches.push({mesh,items});}
      return {sync(){for(const {mesh,items} of batches){items.forEach((item,i)=>{item.updateMatrix();mesh.setMatrixAt(i,item.matrix);});mesh.instanceMatrix.needsUpdate=true;}}};
    }
    const sceneryInstances=batchMovingMeshes([...roadDashes,...roadsideScenery]);sceneryInstances.sync();
    await boot.next('Getting your lesson ready');
    app=createLearningApp({THREE,scene,lanes:LANES,getGameState:()=>gameState,getPlayer:()=>playerCar,getSpeed:()=>speed,getTraffic:()=>trafficPool,onPause:()=>{if(gameState==='PLAYING')togglePause();},onResume:()=>{if(gameState==='PAUSED')togglePause();},onBonus:addBonus,onCollect:(position,color)=>{spawnBurst(position.x,1.5,0,color,18,1.3);sfx.playBolt();}});
    bestEl.textContent=bestScore.toLocaleString();
    document.body.classList.add('menu-state');
    trafficPool.forEach(v=>{v.userData.active=false;v.visible=false;});rampPool.forEach(r=>{r.userData.active=false;r.visible=false;});
    document.getElementById('inspect-btn').onclick=()=>{garageMode=true;garageYaw=2.45;garageElevation=.27;garageRadius=isPortrait()?16:8.4;document.body.classList.add('garage-state');document.getElementById('start-modal').classList.add('hidden');document.getElementById('garage-panel').classList.remove('hidden');};
    document.getElementById('garage-back').onclick=()=>{garageMode=false;document.body.classList.remove('garage-state');document.getElementById('start-modal').classList.remove('hidden');document.getElementById('garage-panel').classList.add('hidden');};
    document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{garageYaw={front:Math.PI,rear:0,side:Math.PI/2}[button.dataset.view];garageElevation=button.dataset.view==='side'?.38:.27;garageRadius=isPortrait()?16:8.4;});
    window.RoadsterRush={getState:()=>({gameState,lane:currentLane,thrusting:isThrusting,speed,graphics:lowGraphics?'low':'standard',car:{dimensions:playerCar.userData.dimensions,optimization:playerCar.userData.optimization},...app.getState(),renderer:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles}})};
    if(new URLSearchParams(location.search).get('debug')==='1')window.RoadsterRush.debug={...app.debug,carScreenBounds(){const dimensions=playerCar.userData.dimensions,points=[];playerCar.updateMatrixWorld(true);camera.updateMatrixWorld(true);for(const x of [-dimensions.x/2,dimensions.x/2])for(const y of [-GROUND_CLEARANCE_Y+.025,dimensions.y-GROUND_CLEARANCE_Y+.025])for(const z of [-dimensions.z/2,dimensions.z/2]){const p=new THREE.Vector3(x,y,z).applyMatrix4(playerCar.matrixWorld).project(camera);points.push({x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2});}return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};}};
    await boot.next('Opening the road');
    animate();
    if(renderer.getContext().isContextLost())throw new Error('The 3D view could not open. Try lighter graphics.');
    boot.ready();
