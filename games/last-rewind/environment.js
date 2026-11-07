/**
 * LAST REWIND — procedural rental-store art and static collision geometry.
 * Every texture is drawn locally. No image or model service is required.
 */
import * as THREE from './vendor/three.module.js';

export function buildEnvironment(scene, { mobile = false } = {}) {
  const colliders = [];
  const shootables = [];
  const root = new THREE.Group();
  root.name = 'Midnight Video — environment';
  scene.add(root);
  scene.background = new THREE.Color(0x080e17);
  scene.fog = new THREE.FogExp2(0x101924, 0.015);

  let seed = 77531;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  const palette = [0x386e76, 0x98454c, 0xb2a170, 0x667390, 0x806174, 0x677d5d, 0xb96e42, 0xa5a394, 0x323841];
  const batches = new Map();
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const matrix = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const rotation = new THREE.Euler();

  function texture(w, h, paint, repeatX = 1, repeatY = 1) {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d'); paint(ctx, w, h);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(repeatX, repeatY);
    map.anisotropy = mobile ? 2 : 4;
    return map;
  }
  const standard = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.83, metalness: 0, ...extra });
  const substrate = standard(0xffffff);
  const metal = standard(0xffffff, { roughness: 0.55, metalness: 0.52 });
  const plastic = standard(0xffffff, { roughness: 0.55, metalness: 0.04 });
  const glowWhite = standard(0xc8ece2, { emissive: 0xc3efe0, emissiveIntensity: 2.6, roughness: 0.4 });
  const glowWarm = standard(0xf9dd9c, { emissive: 0xffb354, emissiveIntensity: 2.1 });
  const glowRed = standard(0xff564b, { emissive: 0xff2116, emissiveIntensity: 2.6 });
  const dark = standard(0x101316, { roughness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x729a9c, transparent: true, opacity: 0.12, roughness: 0.18, metalness: 0.4, depthWrite: false, side: THREE.DoubleSide });

  // Repeated furnishings and media are instanced to keep the shop inexpensive.
  function part(material, x, y, z, w, h, d, color = 0xffffff, ry = 0, rx = 0, rz = 0) {
    if (!batches.has(material)) batches.set(material, []);
    batches.get(material).push({ x, y, z, w, h, d, color, ry, rx, rz });
  }
  function box(w, h, d, material, x, y, z, solid = false) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
    if (solid) shootables.push(mesh);
    return mesh;
  }
  function obstacle(x, z, w, d, height = 3.8) {
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, height });
  }
  function plane(map, x, y, z, w, h, ry = 0, emissive = 0x000000, intensity = 0) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), standard(0xffffff, { map, emissive, emissiveMap: map, emissiveIntensity: intensity, side: THREE.DoubleSide }));
    mesh.position.set(x, y, z); mesh.rotation.y = ry; root.add(mesh); return mesh;
  }
  function sign(text, x, y, z, w, h, options = {}) {
    const { fg = '#f3e1ba', bg = '#213b3b', sub = '', rotate = 0, glow = 0, font = 'bold' } = options;
    const map = texture(768, 192, (c, cw, ch) => {
      c.fillStyle = bg; c.fillRect(0, 0, cw, ch);
      c.strokeStyle = fg; c.globalAlpha = 0.7; c.lineWidth = 5; c.strokeRect(11, 11, cw - 22, ch - 22); c.globalAlpha = 1;
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = fg;
      const size = text.length > 13 ? 61 : text.length > 9 ? 72 : 92;
      c.font = `${font} ${size}px Arial`;
      c.fillText(text, cw / 2, sub ? 76 : 99, cw - 58);
      if (sub) { c.font = '22px monospace'; c.fillText(sub, cw / 2, 145, cw - 65); }
      for (let i = 0; i < 100; i++) { c.fillStyle = `rgba(0,0,0,${rnd() * 0.13})`; c.fillRect(rnd() * cw, rnd() * ch, rnd() * 70, 1); }
    });
    return plane(map, x, y, z, w, h, rotate, glow ? 0xffffff : 0, glow);
  }

  // Worn blue patterned commercial carpet, with thin fibers and faded tracks.
  const carpetMap = texture(512, 512, (c, w, h) => {
    c.fillStyle = '#30383e'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 17000; i++) {
      const v = 38 + rnd() * 40; c.fillStyle = `rgb(${v * .8},${v * .99},${v * 1.06})`;
      c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    c.strokeStyle = 'rgba(141,119,91,.23)'; c.lineWidth = 2;
    for (let y = 16; y < h; y += 64) for (let x = 16; x < w; x += 64) {
      c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x + 6, y); c.moveTo(x, y - 6); c.lineTo(x, y + 6); c.stroke();
    }
    c.fillStyle = 'rgba(0,0,0,.07)'; for (let i = 0; i < 15; i++) { c.beginPath(); c.ellipse(rnd()*w,rnd()*h,12+rnd()*30,4+rnd()*12,rnd()*6,0,Math.PI*2); c.fill(); }
  }, 10, 10);
  const carpet = standard(0xffffff, { map: carpetMap, roughness: 1 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), carpet);
  floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; root.add(floor);
  const tileMap = texture(512, 512, (c, w, h) => {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      c.fillStyle = (x+y)%2 ? '#35413f' : '#acb4a5'; c.fillRect(x*64,y*64,64,64);
      c.strokeStyle = '#50564e'; c.lineWidth = 2; c.strokeRect(x*64+1,y*64+1,62,62);
      for(let i=0;i<60;i++){c.fillStyle=`rgba(20,28,22,${rnd()*.13})`;c.fillRect(x*64+rnd()*64,y*64+rnd()*64,1+rnd()*5,1);}
    }
  }, 4, 1);
  const tile = new THREE.Mesh(new THREE.PlaneGeometry(20, 4), standard(0xffffff, { map: tileMap, roughness: 0.53 }));
  tile.rotation.x = -Math.PI/2; tile.position.set(0, .012, -8); tile.receiveShadow = true; root.add(tile);
  const matMap = texture(512,256,(c,w,h)=>{c.fillStyle='#1f2525';c.fillRect(0,0,w,h);c.strokeStyle='#6e7566';c.lineWidth=9;c.strokeRect(10,10,w-20,h-20);c.fillStyle='#b2b29b';c.font='bold 60px Arial';c.textAlign='center';c.fillText('BE KIND.',w/2,110);c.font='bold 53px Arial';c.fillText('REWIND.',w/2,174);});
  const welcome = plane(matMap, 0,.025,-8.55,3,1.5); welcome.rotation.x=-Math.PI/2;

  const wallMap = texture(512,512,(c,w,h)=>{
    c.fillStyle='#969887';c.fillRect(0,0,w,h);
    for(let i=0;i<8000;i++){c.fillStyle=`rgba(${rnd()>.5?'21,27,22':'230,225,197'},${rnd()*.07})`;c.fillRect(rnd()*w,rnd()*h,1+rnd()*4,1+rnd()*3);}
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.7,'rgba(0,0,0,.03)');g.addColorStop(1,'rgba(20,30,25,.3)');c.fillStyle=g;c.fillRect(0,0,w,h);
  }, 5, 1);
  const wall = standard(0xffffff,{map:wallMap});
  box(.32,3.8,20,wall,-10,1.9,0,true); obstacle(-10,0,.32,20);
  box(.32,3.8,20,wall,10,1.9,0,true); obstacle(10,0,.32,20);
  box(20,3.8,.32,wall,0,1.9,10,true); obstacle(0,10,20,.32);
  // Waist-high dark wood wainscoting and continuous burgundy trim.
  for(const x of [-9.81,9.81]){part(substrate,x,.42,0,.05,.84,20,0x283b3b);part(substrate,x,.88,0,.09,.07,20,0x6e2632);}
  part(substrate,0,.42,9.8,20,.84,.05,0x283b3b);part(substrate,0,.88,9.77,20,.07,.09,0x6e2632);
  part(substrate,0,3.27,9.8,20,.27,.09,0x692735);
  for(const x of [-9.8,9.8])part(substrate,x,3.27,0,.09,.27,20,0x692735);
  const ceilingMap = texture(512,512,(c,w,h)=>{
    c.fillStyle='#6f766d';c.fillRect(0,0,w,h);c.fillStyle='#85897a';c.fillRect(5,5,w-10,h-10);
    for(let i=0;i<4500;i++){c.fillStyle=`rgba(24,34,29,${rnd()*.12})`;c.fillRect(rnd()*w,rnd()*h,1+rnd()*2,1);}
    c.strokeStyle='#a6aa96';c.lineWidth=3;c.strokeRect(4,4,w-8,h-8);
    c.fillStyle='rgba(84,63,31,.11)';c.beginPath();c.ellipse(115,90,140,75,.3,0,7);c.fill();
  }, 10, 10);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(20,20),standard(0xffffff,{map:ceilingMap,side:THREE.DoubleSide}));
  ceiling.position.y=3.8;ceiling.rotation.x=Math.PI/2;root.add(ceiling);

  // Front glazing: both sides stay solid; the center double door is held open.
  const frameColor=0x293b3d;
  for(const x of [-5.9,5.9]){
    box(8.2,.55,.25,standard(0x34413b),x,.275,-10,true);obstacle(x,-10,8.2,.3,3.8);
    box(8.2,.72,.25,wall,x,3.44,-10,true);
    box(8.1,2.52,.035,glass,x,1.81,-9.99);
    part(metal,x,.56,-9.94,8.2,.07,.1,frameColor);part(metal,x,3.07,-9.94,8.2,.07,.1,frameColor);
  }
  box(3.6,.72,.25,wall,0,3.44,-10,true);
  for(const x of [-9.86,-5.9,-1.85,1.85,5.9,9.86])part(metal,x,1.82,-9.91,.09,2.55,.12,frameColor);
  for(const side of [-1,1]){
    // Open leaves sit outside the entrance, preserving its full walkable width.
    part(metal,side*1.91,1.53,-10.85,.07,2.94,1.7,0x2b3638);
    part(metal,side*1.91,.07,-10.85,.08,.08,1.7,0x2b3638);
    part(metal,side*1.91,3,-10.85,.08,.08,1.7,0x2b3638);
    const pane=box(.018,2.8,1.56,glass,side*1.91,1.53,-10.85);pane.castShadow=false;
    part(metal,side*1.88,1.3,-11.4,.07,.47,.05,0xb2b3a3);
    obstacle(side*1.91,-10.85,.11,1.72,3.05);
  }
  part(metal,0,3.05,-9.9,3.7,.08,.15,0x243539);
  sign('MIDNIGHT VIDEO',0,3.43,-9.82,6.9,.5,{bg:'#50242c',fg:'#f1ce9d',sub:'OPEN LATE · RETURN TOMORROW'});
  // Simple physical neon tubes and a soft alpha halo are visible from the shop.
  const neonMap=texture(512,256,(c,w,h)=>{
    c.clearRect(0,0,w,h);c.textAlign='center';c.textBaseline='middle';c.font='italic bold 132px Arial';
    c.shadowColor='#ff170e';c.shadowBlur=35;c.lineWidth=6;c.strokeStyle='#ff3022';c.strokeText('OPEN',w/2,h/2);
    c.shadowBlur=13;c.strokeStyle='#ffb1a1';c.lineWidth=2;c.strokeText('OPEN',w/2,h/2);
    c.strokeStyle='#ff3b2e';c.lineWidth=4;c.beginPath();c.roundRect(14,20,w-28,h-40,68);c.stroke();
  });
  const neonMaterial = new THREE.MeshBasicMaterial({map:neonMap,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  const neon=new THREE.Mesh(new THREE.PlaneGeometry(3.25,1.55),neonMaterial);neon.position.set(-5.6,2.06,-9.75);root.add(neon);
  const neonLight=new THREE.PointLight(0xff2b18,5.6,7,2);neonLight.position.set(-5.6,1.8,-8.9);root.add(neonLight);
  // Film-rental decals printed on glass.
  sign('2 NIGHTS / $2',5.6,2.2,-9.76,2.5,.7,{bg:'#9f7838',fg:'#201b13',sub:'THE WEEKEND STARTS HERE'});
  sign('PUSH',1.92,1.63,-11.43,.4,.16,{rotate:Math.PI/2,bg:'#e3d8bb',fg:'#272c26'});

  // Fluorescent fixtures: emissive panels plus a small number of real lights.
  for(const x of [-6.6,0,6.6])for(const z of [-6.4,.3,7]){
    part(metal,x,3.69,z,1.2,.16,2.35,0x303b3b);
    part(glowWhite,x,3.595,z,1.05,.025,2.17);
    for(let k=-2;k<=2;k++)part(metal,x+k*.22,3.573,z,.018,.012,2.16,0x72817c);
  }
  scene.add(new THREE.HemisphereLight(0xcedddd,0x262a2c,1.4));
  const fill=new THREE.AmbientLight(0x94a6aa,.34);scene.add(fill);
  for(const [x,z,intensity] of [[0,-5,24],[0,3,27],[-7,5,16],[7,3,14]]){
    const light=new THREE.PointLight(0xc4e2d4,intensity,16,2);light.position.set(x,3.3,z);root.add(light);
  }
  const mainLight=new THREE.SpotLight(0xe7e3c8,54,22,1.1,.78,1.5);mainLight.position.set(0,3.45,1.5);mainLight.target.position.set(0,0,-2);root.add(mainLight,mainLight.target);
  mainLight.castShadow=!mobile;mainLight.shadow.mapSize.set(1024,1024);mainLight.shadow.bias=-.001;mainLight.shadow.normalBias=.04;mainLight.shadow.camera.near=.5;mainLight.shadow.camera.far=22;
  const exteriorMoon=new THREE.DirectionalLight(0x7693bf,.6);exteriorMoon.position.set(-6,15,-20);root.add(exteriorMoon);

  const titles=['LAST SIGNAL','DEAD FREQUENCY','FINAL PATROL','NIGHT DRIVE','DEEP BLUE','THE VISITOR','AFTER HOURS','LOST SUMMER'];
  const caseMaterials = titles.map((title, i) => {
    const hues=['#aac0ba','#b54b4f','#d1aa58','#7a94ad','#47747e','#b3b594','#bd804d','#815e81'];
    const map=texture(128,512,(c,w,h)=>{
      c.fillStyle=hues[i];c.fillRect(0,0,w,h);c.fillStyle='#172128';c.fillRect(4,4,w-8,20);c.fillRect(5,h-72,w-10,66);
      c.strokeStyle='rgba(255,255,255,.3)';c.strokeRect(4,4,w-8,h-8);
      c.save();c.translate(w/2,h/2-20);c.rotate(-Math.PI/2);c.textAlign='center';c.fillStyle=i===1?'#f1dcca':'#142029';c.font='bold 35px Arial';c.fillText(title,0,10,h-110);c.restore();
      c.fillStyle='#e9dfbc';c.font='bold 24px Arial';c.textAlign='center';c.fillText('VHS',w/2,h-29);
      c.fillStyle='#f5e7bd';c.fillRect(18,42,85,30);c.fillStyle='#35352d';c.font='16px monospace';c.fillText(String(1000+i*137),60,63);
    });
    return standard(0xffffff,{map,roughness:.67});
  });
  function addSpine(type,x,y,z,w,h,d,ry=0,color=0xffffff){part(caseMaterials[type%caseMaterials.length],x,y,z,w,h,d,color,ry);}
  function shelfRow(x, z, length, side = true) {
    const width=side?1.16:.52, height=2.2;
    obstacle(x,z,width+.08,length+.08,height);
    part(substrate,x,1.08,z,.1,2.1,length,0x29312f);
    part(substrate,x,.12,z,width,.24,length,0x212d2c);
    for(const y of [.29,.78,1.27,1.76,2.2]){
      part(substrate,x,y,z,width,.08,length+.08,0x64715e);
      for(const s of [-1,1])part(substrate,x+s*(width/2+.018),y,z,.037,.1,length+.08,0xceb791);
    }
    for(const pz of [z-length/2,z,z+length/2])part(metal,x,1.13,pz,width,2.2,.075,0x3d4a41);
    const sides=side?[-1,1]:[x>0?-1:1];
    for(const s of sides)for(let level=0;level<4;level++){
      let pz=z-length/2+.18;
      while(pz<z+length/2-.11){
        const bookW=.1+rnd()*.032, bookH=.33+rnd()*.055;
        if(rnd()<.055){pz+=bookW+.035;continue;}
        // A spine faces the aisle; its full face carries a legible title texture.
        addSpine(Math.floor(rnd()*8),x+s*(width/2-.17),.35+level*.49+bookH/2,pz,bookW,bookH,.255,s*Math.PI/2,[0xffffff,0xe6ddd2,0xc8ded8,0xd4d6e5][Math.floor(rnd()*4)]);
        pz+=bookW+.012;
      }
    }
  }
  shelfRow(-4.5,-1,8);shelfRow(4.5,-1,8);
  shelfRow(-9.47,-2.1,12,false);shelfRow(9.47,-1.2,14,false);
  // Front endcaps carry a few oversized face-out sleeves.
  const coverMaps=[];
  function movieCover(i) {
    if(coverMaps[i])return coverMaps[i];
    const colors=[['#071c22','#df9b4e'],['#10232a','#b8333d'],['#25292d','#b8b879'],['#1e1830','#d65e55'],['#07262c','#528d9b'],['#242130','#d3a878'],['#22332f','#a5b5aa'],['#3d2740','#ce9862']];
    const [bg,ink]=colors[i%8];
    return coverMaps[i]=texture(512,768,(c,w,h)=>{
      c.fillStyle=bg;c.fillRect(0,0,w,h);
      const g=c.createRadialGradient(w*.5,h*.45,4,w*.5,h*.45,h*.5);g.addColorStop(0,ink+'bb');g.addColorStop(1,bg);c.fillStyle=g;c.fillRect(0,0,w,h);
      c.strokeStyle=ink;c.lineWidth=3;c.strokeRect(17,17,w-34,h-34);
      c.fillStyle=ink;c.globalAlpha=.7;
      if(i%3===0){
        for(let k=0;k<10;k++){let x=k*59-35;c.fillRect(x,h*.35+rnd()*120,45,h*.49);}
        c.fillStyle='#0b1017';c.beginPath();c.ellipse(280,368,45,60,0,0,7);c.fill();c.beginPath();c.moveTo(230,414);c.lineTo(319,414);c.lineTo(378,667);c.lineTo(163,667);c.fill();
        c.fillStyle='#e9a376';c.fillRect(248,358,12,4);c.fillRect(291,358,12,4);
      }else if(i%3===1){
        c.beginPath();c.arc(256,300,120,0,7);c.fill();c.fillStyle='#111923';c.beginPath();c.ellipse(256,360,82,150,0,0,7);c.fill();c.fillStyle=ink;c.beginPath();c.ellipse(223,310,16,8,-.15,0,7);c.ellipse(286,310,16,8,.15,0,7);c.fill();
        c.strokeStyle=ink;for(let j=0;j<6;j++){c.beginPath();c.moveTo(60+j*80,50);c.lineTo(150+j*25,600);c.stroke();}
      }else{
        c.fillStyle='#171e23';c.beginPath();c.moveTo(40,580);c.lineTo(190,210);c.lineTo(300,210);c.lineTo(460,580);c.fill();
        c.strokeStyle=ink;c.lineWidth=5;for(let j=0;j<4;j++){c.beginPath();c.moveTo(256,250+j*75);c.lineTo(256,290+j*75);c.stroke();}
        c.fillStyle=ink;c.fillRect(108,426,295,66);c.fillStyle='#0d1821';c.fillRect(128,444,52,16);c.fillRect(332,444,52,16);
      }
      c.globalAlpha=1;c.textAlign='center';c.fillStyle='#f0dec3';c.font='18px monospace';c.fillText('A MIDNIGHT VIDEO ORIGINAL',256,61);
      const words=titles[i].split(' ');c.font='bold 62px Impact, Arial';
      words.forEach((word,j)=>c.fillText(word,256,590+j*65,450));
      c.font='17px monospace';c.fillStyle=ink;c.fillText(i%2?'SOME THINGS SHOULD STAY BURIED.':'THE LAST SHOW IS NEVER THE LAST.',256,729,444);
      for(let k=0;k<2500;k++){c.fillStyle=`rgba(${rnd()>.5?'255,255,255':'0,0,0'},${rnd()*.075})`;c.fillRect(rnd()*w,rnd()*h,2+rnd()*3,1);}
    });
  }
  for(const [x,section] of [[-4.5,'ACTION'],[4.5,'HORROR']]){
    sign(section,x,2.49,3.07,1.8,.44,{bg:section==='ACTION'?'#785c35':'#692834',sub:section==='ACTION'?'HEROES NEVER DIE':'NEW FEARS. EVERY FRIDAY.'});
    for(let j=0;j<2;j++){
      part(substrate,x,1.25+j*.7,3.075,1.13,.56,.06,0x182426);
      plane(movieCover(j+(x>0?1:2)),x-.29,1.25+j*.7,3.115,.39,.55);plane(movieCover(j+4),x+.29,1.25+j*.7,3.116,.39,.55);
    }
  }
  sign('NEW RELEASES',8.98,2.82,-1.7,4.2,.64,{rotate:-Math.PI/2,bg:'#a5843e',fg:'#171f20',sub:'TAKE SOMETHING HOME TONIGHT'});
  sign('CLASSICS',-9.26,2.8,-2,3.2,.56,{rotate:Math.PI/2,bg:'#354745',sub:'THE ONES YOU KNOW BY HEART'});

  // Wall movie posters in slightly tarnished frames.
  function poster(i,x,y,z,w,h,ry=0){
    const frame=box(w+.1,h+.1,.07,metal,x,y,z);frame.rotation.y=ry;
    const v=new THREE.Vector3(0,0,.044).applyAxisAngle(new THREE.Vector3(0,1,0),ry);
    plane(movieCover(i),x+v.x,y,z+v.z,w,h,ry);
  }
  poster(2,-9.75,2.12,6.8,1.7,2.3,Math.PI/2);
  poster(1,9.74,2.1,7.35,1.7,2.3,-Math.PI/2);
  poster(0,5.4,2.04,9.76,1.55,2.25,Math.PI);
  poster(6,7.6,2.04,9.76,1.55,2.25,Math.PI);
  // Back wall rental racks, where the starting player can turn and resupply.
  for(let x=-3.9;x<=2.4;x+=.25){
    for(let level=0;level<3;level++){
      addSpine(Math.floor(rnd()*8),x,.7+level*.5,9.42,.19,.4,.12,0);
    }
  }
  for(const y of [.44,.95,1.45,1.95])part(substrate,-.7,y,9.48,6.9,.06,.52,0x5e6f61);
  obstacle(-.7,9.5,6.9,.58,2.0);
  sign('STAFF PICKS',-.7,2.57,9.72,4.9,.5,{rotate:Math.PI,bg:'#573a39',sub:'PLEASE RETURN ALL TAPES REWOUND'});
  // A closed adults-only section sign, without explicit images or content.
  part(substrate,-8.65,1.47,9.76,2.15,2.94,.12,0x2a272d);
  for(let j=0;j<16;j++)part(substrate,-9.65+j*.132,1.5,9.66,.037,2.7,.045,j%2?0x825843:0x4c2b32);
  sign('XXX',-8.65,3.12,9.61,1.95,.45,{rotate:Math.PI,bg:'#462633',fg:'#dcbca4',sub:'18+ ONLY'});
  sign('EMPLOYEES ONLY',-6.3,2.8,9.68,1.8,.4,{rotate:Math.PI,bg:'#36423c',fg:'#d3d0b9'});
  box(1.8,2.7,.11,standard(0x435048),-6.3,1.35,9.74,true);
  part(metal,-5.65,1.2,9.63,.12,.13,.08,0xbdac79);

  // Checkout: shaped counter, CRT, keyboard/register, tape stacks, papers.
  obstacle(-7,5.3,4.56,1.8,1.14);
  box(4.4,1.02,1.65,standard(0x3c514a),-7,.51,5.3,true);
  const counterTop=box(4.56,.12,1.8,standard(0x897d62,{roughness:.55}),-7,1.08,5.3,true);
  part(substrate,-7,.47,6.14,4.15,.7,.035,0x263c38);
  for(let x=-9;x<-5;x+=.23)part(substrate,x,.47,6.17,.025,.7,.03,0x55615b);
  sign('MEMBERSHIP IS FREE',-7,.62,6.2,2.3,.43,{bg:'#4a292c',fg:'#e1c79e',sub:'YOUR NEXT OBSESSION IS ON US'});
  // CRT casing is a beveled-looking layered cabinet with curved glass screen.
  const crtBody=box(1.1,.83,.85,standard(0x454a42),-8.16,1.55,5.2);crtBody.rotation.y=.14;
  part(substrate,-8.16,1.18,5.2,.66,.12,.6,0x252e2d);
  const crtFront=box(.98,.73,.08,dark,-8.11,1.55,5.66);crtFront.rotation.y=.14;
  const crtCanvas=document.createElement('canvas');crtCanvas.width=256;crtCanvas.height=192;
  const crtCtx=crtCanvas.getContext('2d');const crtTexture=new THREE.CanvasTexture(crtCanvas);crtTexture.colorSpace=THREE.SRGBColorSpace;
  const crtScreenMaterial=new THREE.MeshBasicMaterial({map:crtTexture,color:0xa5c6ae,toneMapped:false});
  const crtScreen=new THREE.Mesh(new THREE.PlaneGeometry(.75,.55),crtScreenMaterial);crtScreen.position.set(-8.17,1.58,5.723);crtScreen.rotation.y=.14;root.add(crtScreen);
  const crtLight=new THREE.PointLight(0x89b9ad,1.6,3.3,2);crtLight.position.set(-8.15,1.6,5.85);root.add(crtLight);
  part(plastic,-7.68,1.33,5.74,.065,.055,.035,0x141d1b);part(glowWhite,-7.68,1.23,5.74,.014,.012,.035,0xb2ffd2);
  // Cash register hood, raised display, keys and cash drawer.
  part(plastic,-5.9,1.24,5.25,.94,.28,.69,0x9c9d81);
  part(substrate,-5.9,1.15,5.25,1.03,.12,.78,0x303d36);
  part(plastic,-5.9,1.48,5.04,.71,.3,.19,0xafb29b);
  part(dark,-5.9,1.51,5.149,.52,.1,.015);
  sign('$ 2.00',-5.9,1.51,5.164,.48,.077,{bg:'#102820',fg:'#8ddea8'});
  for(let a=0;a<6;a++)for(let b=0;b<4;b++)part(plastic,-6.19+a*.108,1.391,5.16+b*.105,.076,.018,.07,(a===5?0x8f433c:0x65766b));
  part(metal,-5.9,1.16,5.648,.7,.02,.015,0x8f9784);
  for(let j=0;j<4;j++)part(plastic,-7.1,1.17+j*.065,5.05,.36,.06,.58,j%2?0x704c4a:0x30363c, .1+j*.01);
  const receiptMap=texture(256,256,(c,w,h)=>{c.fillStyle='#d6cfb6';c.fillRect(0,0,w,h);c.fillStyle='#4f524a';c.font='bold 21px monospace';c.fillText('MIDNIGHT VIDEO',25,35);c.font='13px monospace';for(let i=0;i<8;i++)c.fillText(['RENTAL RECEIPT','11/06/1997  23:59','FINAL PATROL     2.00','RETURN IN 2 NIGHTS','THANK YOU'][i%5],20,60+i*22);});
  for(let j=0;j<3;j++){const paper=plane(receiptMap,-6.78+j*.11,1.148+j*.003,5.65+j*.03,.35,.5);paper.rotation.x=-Math.PI/2;paper.rotation.z=j*.17;}
  // Coffee mug, pencil jar, receipt roll and desk telephone.
  const mug=new THREE.Mesh(new THREE.CylinderGeometry(.12,.10,.22,14),standard(0x948a62));mug.position.set(-7.54,1.23,5.85);root.add(mug);
  const coffee=new THREE.Mesh(new THREE.CircleGeometry(.101,14),standard(0x231914));coffee.rotation.x=-Math.PI/2;coffee.position.set(-7.54,1.342,5.85);root.add(coffee);
  part(plastic,-9.01,1.2,5.6,.34,.13,.53,0x2a332d,.2);part(plastic,-9.01,1.31,5.61,.4,.1,.13,0x1a2220,.2);
  sign('CLOSING SHIFT',-7.1,2.92,8.9,3.4,.56,{bg:'#7f6e41',fg:'#1f2826',sub:'LOCK UP. CASH OUT. STAY ALIVE.'});

  // Outside: wet asphalt, sidewalk, road markings and a detailed parked sedan.
  const asphaltMap=texture(256,256,(c,w,h)=>{c.fillStyle='#131c24';c.fillRect(0,0,w,h);for(let i=0;i<10000;i++){const v=20+rnd()*30;c.fillStyle=`rgba(${v},${v+5},${v+9},.8)`;c.fillRect(rnd()*w,rnd()*h,1,1);}},10,6);
  const street=new THREE.Mesh(new THREE.PlaneGeometry(60,60),standard(0xffffff,{map:asphaltMap,roughness:.44,metalness:.14}));street.rotation.x=-Math.PI/2;street.position.set(0,-.03,-10);root.add(street);
  const pavement=box(30,.14,3.2,standard(0x4a5151,{roughness:.91}),0,-.06,-11.55);pavement.receiveShadow=true;
  for(let x=-15;x<15;x+=2.5)part(substrate,x,.018,-11.55,.015,.015,3.2,0x242e31);
  part(substrate,0,.015,-13.16,30,.05,.1,0x71807b);
  for(let x=-24;x<24;x+=6)part(substrate,x,-.005,-19,3.1,.012,.09,0x8e8b63);
  for(const x of [-11,11]){
    part(metal,x,2.65,-13.2,.1,5.3,.1,0x333e44);part(metal,x+.5,5.25,-13.2,1.1,.09,.09,0x333e44);part(glowWarm,x+1,5.19,-13.2,.4,.08,.28);
    const streetLight=new THREE.PointLight(0xf0b973,24,16,2);streetLight.position.set(x+1,4.9,-13.2);root.add(streetLight);
  }
  // A distant lit storefront gives the glass a clear nighttime depth cue.
  for(const [x,w,h]of[[-16,10,10],[-4,12,12],[10,10,9],[22,11,15]]){
    box(w,h,7,standard(0x15242b),x,h/2,-30,true);
    for(let xx=x-w/2+1.2;xx<x+w/2-.5;xx+=1.9)for(let yy=2;yy<h-.6;yy+=2.1){if(rnd()>.55)part(rnd()>.35?glowWarm:glowWhite,xx,yy,-26.48,.75,1.1,.015,rnd()>.3?0x667765:0x30444f);}
    part(substrate,x,1.85,-26.35,w-.8,2.4,.12,0x243839);
  }
  sign('24 HR LAUNDROMAT',-4.4,3.38,-26.21,9,.65,{bg:'#122f34',fg:'#80b6ac',glow:.25});
  const car=new THREE.Group();car.position.set(5.7,.01,-15.4);car.rotation.y=-.17;root.add(car);
  function cb(w,h,d,mat,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;car.add(m);return m;}
  const carPaint=standard(0x45626a,{roughness:.43,metalness:.55});const carTrim=standard(0x172125,{roughness:.6});const carWindows=standard(0x142731,{roughness:.18,metalness:.55});
  cb(4.5,.45,1.84,carPaint,0,.62,0);cb(4.3,.14,1.78,carPaint,0,.89,0);
  cb(2.23,.67,1.65,carWindows,-.2,1.2,0);cb(2.3,.09,1.7,carPaint,-.2,1.56,0);
  cb(.075,.67,1.69,carPaint,-.35,1.22,0);cb(.09,.65,1.69,carPaint,-1.32,1.2,0);cb(.1,.61,1.69,carPaint,.94,1.19,0);
  cb(1.06,.11,1.78,carPaint,1.68,.97,0);cb(.71,.1,1.78,carPaint,-1.91,.97,0);
  cb(4.46,.09,1.9,carTrim,0,.53,0);cb(.12,.18,1.87,carTrim,2.24,.63,0);cb(.12,.18,1.87,carTrim,-2.24,.63,0);
  const tireMat=standard(0x111719,{roughness:.98});
  const rimMat=standard(0x9a9f94,{metalness:.7,roughness:.4});
  for(const x of [-1.43,1.42])for(const z of [-.88,.88]){
    const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.37,.37,.23,16),tireMat);wheel.rotation.x=Math.PI/2;wheel.position.set(x,.39,z);car.add(wheel);
    const rim=new THREE.Mesh(new THREE.CylinderGeometry(.21,.21,.241,12),rimMat);rim.rotation.x=Math.PI/2;rim.position.copy(wheel.position);car.add(rim);
  }
  for(const z of [-.65,.65]){cb(.04,.21,.44,standard(0xd8d3ab,{emissive:0xafa47d,emissiveIntensity:.4}),2.31,.81,z);cb(.03,.19,.4,glowRed,-2.31,.79,z);}
  cb(.04,.17,.7,carTrim,2.315,.61,0);
  for(const z of [-.94,.94]){cb(.23,.09,.04,rimMat,-.14,.91,z);cb(.23,.09,.04,rimMat,-.99,.91,z);cb(.24,.17,.17,carPaint,.68,1.08,z);}
  const carBounds=new THREE.Box3().setFromObject(car);
  colliders.push({minX:carBounds.min.x-.04,maxX:carBounds.max.x+.04,minZ:carBounds.min.z-.04,maxZ:carBounds.max.z+.04,height:1.6});
  car.traverse(o=>{if(o.isMesh)shootables.push(o);});
  // World perimeter prevents leaving the defended block.
  obstacle(-16,-7,.4,34,6);obstacle(16,-7,.4,34,6);obstacle(0,-24,32,.4,6);obstacle(0,10,32,.4,6);

  // Small readable, nonblocking details: power outlets, waste bin and cables.
  for(const z of [-5.9,4.4])part(plastic,9.79,.34,z,.045,.16,.1,0x969b85);
  const bin=new THREE.Mesh(new THREE.CylinderGeometry(.33,.27,.62,12),standard(0x314840));bin.position.set(-9.2,.31,7.3);root.add(bin);
  part(substrate,-9.2,.64,7.3,.31,.025,.27,0x978f6d,.31);
  const fire=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.53,12),standard(0x9d352e,{metalness:.15}));fire.position.set(9.74,1.04,-8.2);root.add(fire);part(metal,9.74,1.36,-8.2,.08,.1,.15,0x66736e);

  // Flush the repeated geometry after all furnishings have been described.
  for (const [material, entries] of batches) {
    const instances = new THREE.InstancedMesh(unitBox, material, entries.length);
    instances.castShadow = true; instances.receiveShadow = true;
    for (let i=0;i<entries.length;i++) {
      const e=entries[i];pos.set(e.x,e.y,e.z);scl.set(e.w,e.h,e.d);rotation.set(e.rx,e.ry,e.rz);quat.setFromEuler(rotation);matrix.compose(pos,quat,scl);
      instances.setMatrixAt(i,matrix);instances.setColorAt(i,new THREE.Color(e.color));
    }
    instances.instanceMatrix.needsUpdate=true;if(instances.instanceColor)instances.instanceColor.needsUpdate=true;instances.computeBoundingSphere();root.add(instances);
    // Fixtures above the player and paper scraps should not catch bullets.
    if(material!==glowWhite&&material!==glowWarm&&material!==glowRed)shootables.push(instances);
  }

  // Store damage appears as restrained crack strips on the front glass.
  const damageGroup=new THREE.Group();root.add(damageGroup);
  const crackMaterial=new THREE.LineBasicMaterial({color:0xa0c4c2,transparent:true,opacity:.68});
  for(const x of [-6.8,5.8]){
    for(let j=0;j<9;j++){
      const points=[];let cx=x,cy=1.5;points.push(new THREE.Vector3(cx,cy,-9.73));
      const angle=j/9*Math.PI*2;
      for(let k=1;k<5;k++){cx+=Math.cos(angle)*(.12+rnd()*.22);cy+=Math.sin(angle)*(.12+rnd()*.18);points.push(new THREE.Vector3(cx,cy,-9.73));}
      const crack=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),crackMaterial);damageGroup.add(crack);
    }
  }
  damageGroup.visible=false;
  let integrity=100,staticTick=0;
  function update(dt,t){
    staticTick+=dt;
    if(staticTick>.12){
      staticTick=0;const c=crtCtx;c.fillStyle='#16352d';c.fillRect(0,0,256,192);
      for(let y=0;y<192;y+=3){const v=45+rnd()*115;c.fillStyle=`rgba(${v*.77},${v},${v*.86},.65)`;c.fillRect(0,y,256,1+rnd()*2);}
      c.fillStyle='rgba(186,219,194,.25)';c.fillRect(0,(t*23)%192,256,8);
      c.fillStyle='#afc6a7';c.font='bold 18px monospace';c.fillText('PLAY ▶',17,27);c.font='17px monospace';c.fillText('23:59',178,27);
      c.fillStyle='#c5d6b6';c.font='bold 17px monospace';c.textAlign='center';c.fillText('PLEASE REWIND',128,161);c.textAlign='left';crtTexture.needsUpdate=true;
    }
    const flicker=(Math.sin(t*2.11)>0.993||Math.sin(t*12.3)>.999)? .7:1;
    neonMaterial.opacity=flicker;neonLight.intensity=5.6*flicker;
    crtLight.intensity=1.6+Math.sin(t*13)*.1;
    damageGroup.visible=integrity<65;
    if(integrity<30)neonMaterial.opacity*=.83+.15*Math.sin(t*17);
  }
  function setIntegrity(value){integrity=value;}
  function reset(){integrity=100;damageGroup.visible=false;neonMaterial.opacity=1;}
  update(1,0);
  return {colliders,shootables,entrance:new THREE.Vector3(0,0,-9),update,reset,setIntegrity};
}
